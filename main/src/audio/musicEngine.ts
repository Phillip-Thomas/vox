import { MUSIC_LAYER_ASSETS, type MusicLayerId, type MusicLayerAsset } from './musicCatalog.ts';
import {
  getAudioContext,
  getMusicBus,
  makeNoiseBuffer,
  rampParam as rampGain,
  unlockAudio
} from './audioCore.ts';

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

// P3 drone-retune constants: fold ranges keep each drone in its shipped
// register while its PITCH obeys the harmonic center (kill fixed pitches).
const DRONE_RETUNE_TAU_S = 1.4;
const FIFTH_RATIO = 1.5;
const DRONE_SHIP_FOLD_LO_HZ = 48; // hum stays near the shipped 64 Hz weight
const DRONE_PULSE_FOLD_LO_HZ = 34; // deep transit pulse (was fixed 47 Hz)
const DRONE_RUMBLE_FOLD_LO_HZ = 27.5; // sub rumble (was fixed 36 Hz)
const DRONE_LIFE_FOLD_LO_HZ = 138; // life shimmer pair (was 174.61/220)
const DRONE_GLASS_FOLD_LO_HZ = 550; // glass pair (was E5/B5)
const DRONE_NIGHT_FOLD_LO_HZ = 70; // night pair (was E2/B2)

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
  // The engine's output into the shared music bus (audioCore owns volume/mute,
  // the submerge muffle, and the visibility duck for the whole music mix).
  private context: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private procedural: ProceduralRuntime | null = null;
  private unlocked = false;
  private proceduralTargets = ZERO_PROCEDURAL;
  private readonly layers = new Map<MusicLayerId, RuntimeLayer>();
  /** Last published chord-root pc (semitones from A) — applied when drones start. */
  private chordRootPc: number | null = null;

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
    unlockAudio();
    await context.resume();
    this.startProcedural();
    if (this.musicGain) rampGain(context, this.musicGain.gain, 1, 0.05);
    this.setProceduralTargets(this.proceduralTargets, 0.05);
    this.loadAll();
  }

  preload(): void {
    if (!this.context) return;
    this.loadAll();
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

  /**
   * P3 — the drone-bank kill path (PARAVOXIA_SCORE.md defect #2): every
   * pitched drone retunes to the published harmonic center instead of its
   * legacy fixed pitch. The ship hum folds the chord root into its hum
   * register (§8.4 surfaceShip row); pulse/rumble sit in root sub octaves;
   * the (currently silent) life/glass/night pairs hold root+fifth so any
   * future gain can never clash with the key. Glides are slow — retuning
   * reads as the world breathing, not as an event.
   */
  retuneDronesToChordRoot(rootSemisFromA: number): void {
    const pc = ((Math.round(rootSemisFromA) % 12) + 12) % 12;
    this.chordRootPc = pc;
    if (!this.context || !this.procedural) return;
    const rootHz = 55 * Math.pow(2, pc / 12);
    const fold = (hz: number, lo: number): number => {
      let f = hz;
      while (f >= lo * 2) f /= 2;
      while (f < lo) f *= 2;
      return f;
    };
    const now = this.context.currentTime;
    const glide = (param: AudioParam, hz: number): void => {
      param.cancelScheduledValues(now);
      param.setTargetAtTime(hz, now, DRONE_RETUNE_TAU_S);
    };
    const p = this.procedural;
    glide(p.shipOsc.frequency, fold(rootHz, DRONE_SHIP_FOLD_LO_HZ));
    glide(p.pulseOsc.frequency, fold(rootHz, DRONE_PULSE_FOLD_LO_HZ));
    glide(p.rumbleOsc.frequency, fold(rootHz, DRONE_RUMBLE_FOLD_LO_HZ));
    const lifeHz = fold(rootHz, DRONE_LIFE_FOLD_LO_HZ);
    glide(p.lifeA.frequency, lifeHz);
    glide(p.lifeB.frequency, lifeHz * FIFTH_RATIO);
    const glassHz = fold(rootHz, DRONE_GLASS_FOLD_LO_HZ);
    glide(p.glassA.frequency, glassHz);
    glide(p.glassB.frequency, glassHz * FIFTH_RATIO);
    const nightHz = fold(rootHz, DRONE_NIGHT_FOLD_LO_HZ);
    glide(p.nightA.frequency, nightHz);
    glide(p.nightB.frequency, nightHz * FIFTH_RATIO);
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
    if (this.context) return this.context;
    const context = getAudioContext();
    const bus = getMusicBus();
    if (!context || !bus) return null;

    const musicGain = context.createGain();
    musicGain.gain.value = 0; // faded to 1 on unlock
    musicGain.connect(bus);

    this.context = context;
    this.musicGain = musicGain;
    return context;
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
      // (retuned to the harmonic center right below when a chord was published)
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

    // A chord may have been published before the drones existed: obey it now.
    if (this.chordRootPc != null) this.retuneDronesToChordRoot(this.chordRootPc);
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

let engine: MusicEngine | null = null;

export function getMusicEngine(): MusicEngine {
  engine ??= new MusicEngine();
  return engine;
}

export function unlockMusicAudio(): Promise<void> {
  return getMusicEngine().unlock();
}
