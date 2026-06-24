import { MUSIC_LAYER_ASSETS, type MusicLayerId, type MusicLayerAsset } from './musicCatalog.ts';

export type TransitionCue =
  | 'menu'
  | 'surface'
  | 'space'
  | 'atmosphere'
  | 'atmosphereEnter'
  | 'atmosphereLeave'
  | 'systemWarp'
  | 'warp';

export interface ProceduralMusicTargets {
  pulse: number;
  ship: number;
  warp: number;
  life: number;
  wind: number;
  glass: number;
  rumble: number;
  water: number;
  night: number;
}

interface RuntimeLayer {
  asset: MusicLayerAsset;
  buffer: AudioBuffer | null;
  gain: GainNode | null;
  source: AudioBufferSourceNode | null;
  loading: Promise<void> | null;
  targetGain: number;
}

interface ProceduralRuntime {
  pulseOsc: OscillatorNode;
  pulseGain: GainNode;
  shipOsc: OscillatorNode;
  shipGain: GainNode;
  warpNoise: AudioBufferSourceNode;
  warpNoiseFilter: BiquadFilterNode;
  warpNoiseGain: GainNode;
  warpTone: OscillatorNode;
  warpToneGain: GainNode;
  lifeA: OscillatorNode;
  lifeB: OscillatorNode;
  lifeGain: GainNode;
  windNoise: AudioBufferSourceNode;
  windFilter: BiquadFilterNode;
  windGain: GainNode;
  glassA: OscillatorNode;
  glassB: OscillatorNode;
  glassGain: GainNode;
  rumbleOsc: OscillatorNode;
  rumbleGain: GainNode;
  waterNoise: AudioBufferSourceNode;
  waterFilter: BiquadFilterNode;
  waterGain: GainNode;
  nightA: OscillatorNode;
  nightB: OscillatorNode;
  nightGain: GainNode;
}

const ZERO_PROCEDURAL: ProceduralMusicTargets = {
  pulse: 0,
  ship: 0,
  warp: 0,
  life: 0,
  wind: 0,
  glass: 0,
  rumble: 0,
  water: 0,
  night: 0
};

class MusicEngine {
  private context: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  // Master lowpass spliced musicGain -> submergeFilter -> visibilityGain. Open
  // (20kHz) on land so the music chain is transparent; ramped down underwater.
  private submergeFilter: BiquadFilterNode | null = null;
  private visibilityGain: GainNode | null = null;
  private procedural: ProceduralRuntime | null = null;
  private unlocked = false;
  private outputVolume = 0.72;
  private muted = false;
  private visibilityDucked = false;
  private submerged = false;
  private proceduralTargets = ZERO_PROCEDURAL;
  private readonly layers = new Map<MusicLayerId, RuntimeLayer>();

  constructor() {
    for (const asset of MUSIC_LAYER_ASSETS) {
      this.layers.set(asset.id, {
        asset,
        buffer: null,
        gain: null,
        source: null,
        loading: null,
        targetGain: 0
      });
    }
  }

  async unlock(): Promise<void> {
    const context = this.ensureContext();
    if (!context) return;

    this.unlocked = true;
    await context.resume();
    this.startProcedural();
    this.applyOutput(0.05);
    this.applyVisibility(0.05);
    this.setProceduralTargets(this.proceduralTargets, 0.05);
    this.loadAll();
  }

  preload(): void {
    if (!this.context) return;
    this.loadAll();
  }

  setOutput(musicVolume: number, muted: boolean): void {
    this.outputVolume = Math.min(1, Math.max(0, musicVolume));
    this.muted = muted;
    this.applyOutput(0.22);
  }

  setVisibilityDucked(ducked: boolean): void {
    this.visibilityDucked = ducked;
    this.applyVisibility(ducked ? 0.35 : 0.45);
  }

  // Muffle the music bus underwater (mirrors the visibility duck). Edge-driven by
  // AudioDirector so the cutoff snaps on submerge and releases on emerge.
  setSubmerged(submerged: boolean): void {
    this.submerged = submerged;
    this.applySubmerge(submerged ? 0.12 : 0.2);
  }

  setLayerTargets(targets: Partial<Record<MusicLayerId, number>>, fadeSeconds: number): void {
    for (const layer of this.layers.values()) {
      const target = Math.min(1, Math.max(0, targets[layer.asset.id] ?? 0));
      layer.targetGain = target;
      if (layer.gain && this.context) {
        rampGain(this.context, layer.gain.gain, target, fadeSeconds);
      }
    }
  }

  setProceduralTargets(targets: ProceduralMusicTargets, fadeSeconds: number): void {
    this.proceduralTargets = {
      pulse: Math.min(1, Math.max(0, targets.pulse)),
      ship: Math.min(1, Math.max(0, targets.ship)),
      warp: Math.min(1, Math.max(0, targets.warp)),
      life: Math.min(1, Math.max(0, targets.life)),
      wind: Math.min(1, Math.max(0, targets.wind)),
      glass: Math.min(1, Math.max(0, targets.glass)),
      rumble: Math.min(1, Math.max(0, targets.rumble)),
      water: Math.min(1, Math.max(0, targets.water)),
      night: Math.min(1, Math.max(0, targets.night))
    };

    if (!this.context || !this.procedural) return;
    const { pulse, ship, warp, life, wind, glass, rumble, water, night } = this.proceduralTargets;
    rampGain(this.context, this.procedural.pulseGain.gain, pulse, fadeSeconds);
    rampGain(this.context, this.procedural.shipGain.gain, ship, fadeSeconds);
    rampGain(this.context, this.procedural.warpNoiseGain.gain, warp * 0.045, fadeSeconds);
    rampGain(this.context, this.procedural.warpToneGain.gain, warp * 0.075, fadeSeconds);
    rampGain(this.context, this.procedural.lifeGain.gain, life, fadeSeconds);
    rampGain(this.context, this.procedural.windGain.gain, wind * 0.32, fadeSeconds);
    rampGain(this.context, this.procedural.glassGain.gain, glass, fadeSeconds);
    rampGain(this.context, this.procedural.rumbleGain.gain, rumble * 0.45, fadeSeconds);
    rampGain(this.context, this.procedural.waterGain.gain, water * 0.28, fadeSeconds);
    rampGain(this.context, this.procedural.nightGain.gain, night, fadeSeconds);

    const now = this.context.currentTime;
    this.procedural.warpNoiseFilter.frequency.cancelScheduledValues(now);
    this.procedural.warpNoiseFilter.frequency.setValueAtTime(
      this.procedural.warpNoiseFilter.frequency.value,
      now
    );
    this.procedural.warpNoiseFilter.frequency.linearRampToValueAtTime(
      620 + warp * 5200,
      now + Math.max(0.04, fadeSeconds)
    );
    this.procedural.warpTone.frequency.cancelScheduledValues(now);
    this.procedural.warpTone.frequency.setValueAtTime(this.procedural.warpTone.frequency.value, now);
    this.procedural.warpTone.frequency.linearRampToValueAtTime(
      140 + warp * 720,
      now + Math.max(0.04, fadeSeconds)
    );
    this.procedural.windFilter.frequency.cancelScheduledValues(now);
    this.procedural.windFilter.frequency.setValueAtTime(this.procedural.windFilter.frequency.value, now);
    this.procedural.windFilter.frequency.linearRampToValueAtTime(
      360 + wind * 680,
      now + Math.max(0.04, fadeSeconds)
    );
    this.procedural.waterFilter.frequency.cancelScheduledValues(now);
    this.procedural.waterFilter.frequency.setValueAtTime(this.procedural.waterFilter.frequency.value, now);
    this.procedural.waterFilter.frequency.linearRampToValueAtTime(
      220 + water * 260,
      now + Math.max(0.04, fadeSeconds)
    );
  }

  playTransitionCue(cue: TransitionCue): void {
    if (!this.unlocked) return;
    const context = this.ensureContext();
    const output = this.musicGain;
    if (!context || !output) return;

    if (cue === 'warp' || cue === 'systemWarp') {
      this.playCueOscillator(context, output, {
        type: 'sawtooth',
        duration: 1.15,
        gain: 0.08,
        fromFrequency: 70,
        toFrequency: 620
      });
      this.playCueOscillator(context, output, {
        type: 'sine',
        duration: 1.15,
        gain: 0.05,
        fromFrequency: 900,
        toFrequency: 1800
      });
      return;
    }

    if (cue === 'atmosphereEnter') {
      this.playNoiseCue(context, output, {
        duration: 0.55,
        gain: 0.018,
        filterType: 'lowpass',
        fromFrequency: 1250,
        toFrequency: 260
      });
      return;
    }

    if (cue === 'atmosphereLeave') {
      this.playNoiseCue(context, output, {
        duration: 0.52,
        gain: 0.014,
        filterType: 'highpass',
        fromFrequency: 220,
        toFrequency: 1100
      });
      return;
    }

    if (cue === 'space') {
      this.playCueOscillator(context, output, {
        type: 'triangle',
        duration: 1.4,
        gain: 0.055,
        fromFrequency: 90,
        toFrequency: 180
      });
      return;
    }

    if (cue === 'atmosphere') {
      this.playNoiseCue(context, output, {
        duration: 0.48,
        gain: 0.012,
        filterType: 'lowpass',
        fromFrequency: 900,
        toFrequency: 320
      });
      return;
    }

    if (cue === 'surface') {
      this.playCueOscillator(context, output, {
        type: 'sine',
        duration: 0.95,
        gain: 0.04,
        fromFrequency: 170,
        toFrequency: 110
      });
      return;
    }

    this.playCueOscillator(context, output, {
      type: 'sine',
      duration: 1.1,
      gain: 0.035,
      fromFrequency: 260,
      toFrequency: 390
    });
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (this.context) return this.context;

    const ContextCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!ContextCtor) return null;

    const context = new ContextCtor();
    const musicGain = context.createGain();
    const submergeFilter = context.createBiquadFilter();
    const visibilityGain = context.createGain();
    musicGain.gain.value = 0;
    visibilityGain.gain.value = 1;
    submergeFilter.type = 'lowpass';
    submergeFilter.frequency.value = 20000; // open on land (acoustically transparent)
    submergeFilter.Q.value = 0.7;
    musicGain.connect(submergeFilter);
    submergeFilter.connect(visibilityGain);
    visibilityGain.connect(context.destination);

    this.context = context;
    this.musicGain = musicGain;
    this.submergeFilter = submergeFilter;
    this.visibilityGain = visibilityGain;
    return context;
  }

  private applyOutput(fadeSeconds: number): void {
    if (!this.context || !this.musicGain) return;
    rampGain(this.context, this.musicGain.gain, this.muted ? 0 : this.outputVolume, fadeSeconds);
  }

  private applyVisibility(fadeSeconds: number): void {
    if (!this.context || !this.visibilityGain) return;
    rampGain(this.context, this.visibilityGain.gain, this.visibilityDucked ? 0.18 : 1, fadeSeconds);
  }

  private applySubmerge(fadeSeconds: number): void {
    if (!this.context || !this.submergeFilter) return;
    rampGain(this.context, this.submergeFilter.frequency, this.submerged ? 540 : 20000, fadeSeconds);
  }

  private loadAll(): void {
    for (const layer of this.layers.values()) {
      this.loadLayer(layer);
    }
  }

  private loadLayer(layer: RuntimeLayer): void {
    const context = this.context;
    if (!context || layer.buffer || layer.loading) return;

    layer.loading = fetch(layer.asset.url)
      .then(response => {
        if (!response.ok) throw new Error(`Unable to load ${layer.asset.url}`);
        return response.arrayBuffer();
      })
      .then(data => context.decodeAudioData(data))
      .then(buffer => {
        layer.buffer = buffer;
        this.startLayer(layer);
      })
      .catch(error => {
        console.warn('[audio] music layer failed to load', layer.asset.url, error);
      });
  }

  private startLayer(layer: RuntimeLayer): void {
    const context = this.context;
    const output = this.musicGain;
    if (!context || !output || !layer.buffer || layer.source) return;

    const gain = context.createGain();
    const source = context.createBufferSource();
    source.buffer = layer.buffer;
    source.loop = true;
    gain.gain.value = 0;
    source.connect(gain);
    gain.connect(output);
    source.start();

    layer.gain = gain;
    layer.source = source;
    rampGain(context, gain.gain, layer.targetGain, 0.8);
  }

  private startProcedural(): void {
    if (!this.context || !this.musicGain || this.procedural) return;

    const pulseOsc = this.context.createOscillator();
    const pulseGain = this.context.createGain();
    pulseOsc.type = 'sine';
    pulseOsc.frequency.value = 47;
    pulseGain.gain.value = 0;
    pulseOsc.connect(pulseGain);
    pulseGain.connect(this.musicGain);
    pulseOsc.start();

    const shipOsc = this.context.createOscillator();
    const shipGain = this.context.createGain();
    shipOsc.type = 'triangle';
    shipOsc.frequency.value = 64;
    shipGain.gain.value = 0;
    shipOsc.connect(shipGain);
    shipGain.connect(this.musicGain);
    shipOsc.start();

    const warpNoise = this.context.createBufferSource();
    const warpNoiseFilter = this.context.createBiquadFilter();
    const warpNoiseGain = this.context.createGain();
    warpNoise.buffer = makeNoiseBuffer(this.context, 2);
    warpNoise.loop = true;
    warpNoiseFilter.type = 'bandpass';
    warpNoiseFilter.frequency.value = 620;
    warpNoiseFilter.Q.value = 0.8;
    warpNoiseGain.gain.value = 0;
    warpNoise.connect(warpNoiseFilter);
    warpNoiseFilter.connect(warpNoiseGain);
    warpNoiseGain.connect(this.musicGain);
    warpNoise.start();

    const warpTone = this.context.createOscillator();
    const warpToneGain = this.context.createGain();
    warpTone.type = 'sine';
    warpTone.frequency.value = 140;
    warpToneGain.gain.value = 0;
    warpTone.connect(warpToneGain);
    warpToneGain.connect(this.musicGain);
    warpTone.start();

    const lifeGain = this.context.createGain();
    const lifeA = this.context.createOscillator();
    const lifeB = this.context.createOscillator();
    lifeA.type = 'sine';
    lifeB.type = 'triangle';
    lifeA.frequency.value = 174.61;
    lifeB.frequency.value = 220;
    lifeGain.gain.value = 0;
    lifeA.connect(lifeGain);
    lifeB.connect(lifeGain);
    lifeGain.connect(this.musicGain);
    lifeA.start();
    lifeB.start();

    const windNoise = this.context.createBufferSource();
    const windFilter = this.context.createBiquadFilter();
    const windGain = this.context.createGain();
    windNoise.buffer = makeNoiseBuffer(this.context, 3);
    windNoise.loop = true;
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 360;
    windFilter.Q.value = 0.35;
    windGain.gain.value = 0;
    windNoise.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(this.musicGain);
    windNoise.start();

    const glassGain = this.context.createGain();
    const glassA = this.context.createOscillator();
    const glassB = this.context.createOscillator();
    glassA.type = 'sine';
    glassB.type = 'sine';
    glassA.frequency.value = 659.25;
    glassB.frequency.value = 987.77;
    glassGain.gain.value = 0;
    glassA.connect(glassGain);
    glassB.connect(glassGain);
    glassGain.connect(this.musicGain);
    glassA.start();
    glassB.start();

    const rumbleOsc = this.context.createOscillator();
    const rumbleGain = this.context.createGain();
    rumbleOsc.type = 'sawtooth';
    rumbleOsc.frequency.value = 36;
    rumbleGain.gain.value = 0;
    rumbleOsc.connect(rumbleGain);
    rumbleGain.connect(this.musicGain);
    rumbleOsc.start();

    const waterNoise = this.context.createBufferSource();
    const waterFilter = this.context.createBiquadFilter();
    const waterGain = this.context.createGain();
    waterNoise.buffer = makeNoiseBuffer(this.context, 3);
    waterNoise.loop = true;
    waterFilter.type = 'lowpass';
    waterFilter.frequency.value = 220;
    waterFilter.Q.value = 0.4;
    waterGain.gain.value = 0;
    waterNoise.connect(waterFilter);
    waterFilter.connect(waterGain);
    waterGain.connect(this.musicGain);
    waterNoise.start();

    const nightGain = this.context.createGain();
    const nightA = this.context.createOscillator();
    const nightB = this.context.createOscillator();
    nightA.type = 'sine';
    nightB.type = 'triangle';
    nightA.frequency.value = 82.41;
    nightB.frequency.value = 123.47;
    nightGain.gain.value = 0;
    nightA.connect(nightGain);
    nightB.connect(nightGain);
    nightGain.connect(this.musicGain);
    nightA.start();
    nightB.start();

    this.procedural = {
      pulseOsc,
      pulseGain,
      shipOsc,
      shipGain,
      warpNoise,
      warpNoiseFilter,
      warpNoiseGain,
      warpTone,
      warpToneGain,
      lifeA,
      lifeB,
      lifeGain,
      windNoise,
      windFilter,
      windGain,
      glassA,
      glassB,
      glassGain,
      rumbleOsc,
      rumbleGain,
      waterNoise,
      waterFilter,
      waterGain,
      nightA,
      nightB,
      nightGain
    };
  }

  private playCueOscillator(
    context: AudioContext,
    output: AudioNode,
    options: {
      type: OscillatorType;
      duration: number;
      gain: number;
      fromFrequency: number;
      toFrequency: number;
    }
  ): void {
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = options.type;
    oscillator.frequency.setValueAtTime(options.fromFrequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(1, options.toFrequency),
      now + options.duration
    );
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(options.gain, now + options.duration * 0.18);
    gain.gain.linearRampToValueAtTime(0, now + options.duration);
    oscillator.connect(gain);
    gain.connect(output);
    oscillator.start(now);
    oscillator.stop(now + options.duration);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }

  private playNoiseCue(
    context: AudioContext,
    output: AudioNode,
    options: {
      duration: number;
      gain: number;
      filterType: BiquadFilterType;
      fromFrequency: number;
      toFrequency: number;
    }
  ): void {
    const now = context.currentTime;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();

    source.buffer = makeNoiseBuffer(context, Math.max(0.2, options.duration));
    filter.type = options.filterType;
    filter.frequency.setValueAtTime(options.fromFrequency, now);
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(1, options.toFrequency),
      now + options.duration
    );
    filter.Q.value = 0.55;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(options.gain, now + options.duration * 0.16);
    gain.gain.linearRampToValueAtTime(0, now + options.duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(output);
    source.start(now);
    source.stop(now + options.duration);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }
}

function rampGain(context: AudioContext, param: AudioParam, value: number, fadeSeconds: number): void {
  const now = context.currentTime;
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  param.linearRampToValueAtTime(value, now + Math.max(0.01, fadeSeconds));
}

function makeNoiseBuffer(context: AudioContext, seconds: number): AudioBuffer {
  const frameCount = Math.max(1, Math.floor(context.sampleRate * seconds));
  const buffer = context.createBuffer(1, frameCount, context.sampleRate);
  const data = buffer.getChannelData(0);
  let sample = 0;
  for (let i = 0; i < frameCount; i++) {
    // Brown-ish noise sits behind the music as air/sea texture instead of
    // reading as bright broadband static.
    sample = sample * 0.985 + (Math.random() * 2 - 1) * 0.015;
    data[i] = sample * 3.5;
  }
  return buffer;
}

let engine: MusicEngine | null = null;

export function getMusicEngine(): MusicEngine {
  engine ??= new MusicEngine();
  return engine;
}

export function unlockMusicAudio(): Promise<void> {
  return getMusicEngine().unlock();
}

export function setSubmergedMusic(submerged: boolean): void {
  getMusicEngine().setSubmerged(submerged);
}
