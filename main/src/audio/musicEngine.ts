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

export interface ProceduralMusicSlewOverrides {
  /** Scene-owned ship-hum edge; all other procedural voices keep their floor. */
  shipGainSeconds?: number;
}

interface RuntimeLayer {
  asset: MusicLayerAsset;
  buffer: AudioBuffer | null;
  gain: GainNode | null;
  source: AudioBufferSourceNode | null;
  loading: Promise<void> | null;
  targetGain: number;
}

interface AutomatableLayer {
  asset: MusicLayerAsset;
  gain: GainNode | null;
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
export const STREAM_LAYER_MIN_SLEW_S = 0.45;
export const PROCEDURAL_MIN_SLEW_S = 0.35;
export const PROCEDURAL_FILTER_MIN_SLEW_S = 0.5;
const MUSIC_ENGINE_UNLOCK_SLEW_S = 0.2;
const STREAM_LAYER_START_SLEW_S = 0.8;
/** Targets below this are effectively silent and do not justify a decode yet. */
export const STREAM_LAYER_LOAD_EPSILON = 0.001;
const DRONE_FOLD_MIN_MULT = 0.75;
const DRONE_FOLD_MAX_MULT = 4;
const DRONE_FOLD_OCTAVE_MIN = -5;
const DRONE_FOLD_OCTAVE_MAX = 5;
const WARP_NOISE_SEED = 0x77617270;
const WIND_NOISE_SEED = 0x77696e64;
const WATER_NOISE_SEED = 0x77617472;
const CUE_NOISE_SEED = 0x63756573;
const OFFLINE_STEM_AUDIT_CARRIER_LEVEL = 0.012;
const OFFLINE_STEM_AUDIT_BUFFER_S = 2;
const OFFLINE_STEM_AUDIT_SEEDS: Readonly<Record<MusicLayerId, number>> = {
  menu: 0x6d656e75,
  surface: 0x73757266,
  deepSpace: 0x64656570,
  shimmer: 0x7368696d,
  warp: 0x6c617965
};

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

const clampUnit = (value: number): number => Math.min(1, Math.max(0, value));

function normalizeProceduralTargets(targets: ProceduralMusicTargets): ProceduralMusicTargets {
  return {
    pulse: clampUnit(targets.pulse),
    ship: clampUnit(targets.ship),
    warp: clampUnit(targets.warp),
    life: clampUnit(targets.life),
    wind: clampUnit(targets.wind),
    glass: clampUnit(targets.glass),
    rumble: clampUnit(targets.rumble),
    water: clampUnit(targets.water),
    night: clampUnit(targets.night)
  };
}

/** Shared by loaded live stems and deterministic offline proxy stems. */
function automateLayerTargets(
  context: BaseAudioContext,
  layers: Iterable<AutomatableLayer>,
  targets: Partial<Record<MusicLayerId, number>>,
  fadeSeconds: number
): void {
  const slew = Math.max(STREAM_LAYER_MIN_SLEW_S, fadeSeconds);
  for (const layer of layers) {
    const target = clampUnit(targets[layer.asset.id] ?? 0);
    layer.targetGain = target;
    if (layer.gain) rampGain(context, layer.gain.gain, target, slew);
  }
}

/** Shared by the shipped runtime and the offline audit graph. */
function automateProceduralTargets(
  context: BaseAudioContext,
  procedural: ProceduralRuntime,
  targets: ProceduralMusicTargets,
  fadeSeconds: number,
  slewOverrides: ProceduralMusicSlewOverrides = {}
): void {
  const gainSlew = Math.max(PROCEDURAL_MIN_SLEW_S, fadeSeconds);
  const filterSlew = Math.max(PROCEDURAL_FILTER_MIN_SLEW_S, fadeSeconds);
  const shipGainSlew = slewOverrides.shipGainSeconds == null
    ? gainSlew
    : Math.max(0, slewOverrides.shipGainSeconds);
  const { pulse, ship, warp, life, wind, glass, rumble, water, night } = targets;
  rampGain(context, procedural.pulseGain.gain, pulse, gainSlew);
  rampGain(context, procedural.shipGain.gain, ship, shipGainSlew);
  rampGain(context, procedural.warpNoiseGain.gain, warp * 0.045, gainSlew);
  rampGain(context, procedural.warpToneGain.gain, warp * 0.075, gainSlew);
  rampGain(context, procedural.lifeGain.gain, life, gainSlew);
  rampGain(context, procedural.windGain.gain, wind * 0.32, gainSlew);
  rampGain(context, procedural.glassGain.gain, glass, gainSlew);
  rampGain(context, procedural.rumbleGain.gain, rumble * 0.45, gainSlew);
  rampGain(context, procedural.waterGain.gain, water * 0.28, gainSlew);
  rampGain(context, procedural.nightGain.gain, night, gainSlew);

  // These filters are just as audible as gains. Route them through the shared
  // start-anchored slew; a bare linear endpoint can interpolate from an old
  // event and present as a current-time cutoff jump in Chromium.
  rampGain(context, procedural.warpNoiseFilter.frequency, 620 + warp * 5200, filterSlew);
  rampGain(context, procedural.warpTone.frequency, 140 + warp * 720, filterSlew);
  rampGain(context, procedural.windFilter.frequency, 360 + wind * 680, filterSlew);
  rampGain(context, procedural.waterFilter.frequency, 220 + water * 260, filterSlew);
}

function retuneProceduralDrones(
  context: BaseAudioContext,
  procedural: ProceduralRuntime,
  rootSemisFromA: number
): void {
  const pc = ((Math.round(rootSemisFromA) % 12) + 12) % 12;
  const rootHz = 55 * Math.pow(2, pc / 12);
  const fold = (hz: number, lo: number, around: number): number => {
    let best = hz;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let octave = DRONE_FOLD_OCTAVE_MIN; octave <= DRONE_FOLD_OCTAVE_MAX; octave++) {
      const candidate = hz * Math.pow(2, octave);
      if (candidate < lo * DRONE_FOLD_MIN_MULT || candidate > lo * DRONE_FOLD_MAX_MULT) continue;
      const distance = Math.abs(Math.log2(candidate / Math.max(Number.EPSILON, around)));
      if (distance < bestDistance) {
        bestDistance = distance;
        best = candidate;
      }
    }
    return best;
  };
  const now = context.currentTime;
  const glide = (param: AudioParam, hz: number): void => {
    param.cancelAndHoldAtTime(now);
    param.setTargetAtTime(hz, now, DRONE_RETUNE_TAU_S);
  };
  glide(
    procedural.shipOsc.frequency,
    fold(rootHz, DRONE_SHIP_FOLD_LO_HZ, procedural.shipOsc.frequency.value)
  );
  glide(
    procedural.pulseOsc.frequency,
    fold(rootHz, DRONE_PULSE_FOLD_LO_HZ, procedural.pulseOsc.frequency.value)
  );
  glide(
    procedural.rumbleOsc.frequency,
    fold(rootHz, DRONE_RUMBLE_FOLD_LO_HZ, procedural.rumbleOsc.frequency.value)
  );
  const lifeHz = fold(rootHz, DRONE_LIFE_FOLD_LO_HZ, procedural.lifeA.frequency.value);
  glide(procedural.lifeA.frequency, lifeHz);
  glide(procedural.lifeB.frequency, lifeHz * FIFTH_RATIO);
  const glassHz = fold(rootHz, DRONE_GLASS_FOLD_LO_HZ, procedural.glassA.frequency.value);
  glide(procedural.glassA.frequency, glassHz);
  glide(procedural.glassB.frequency, glassHz * FIFTH_RATIO);
  const nightHz = fold(rootHz, DRONE_NIGHT_FOLD_LO_HZ, procedural.nightA.frequency.value);
  glide(procedural.nightA.frequency, nightHz);
  glide(procedural.nightB.frequency, nightHz * FIFTH_RATIO);
}

/** One persistent procedural graph, shared by live playback and offline audits. */
function createProceduralRuntime(
  context: BaseAudioContext,
  output: AudioNode
): ProceduralRuntime {
  const pulseOsc = context.createOscillator();
  const pulseGain = context.createGain();
  pulseOsc.type = 'sine';
  pulseOsc.frequency.value = 47;
  pulseGain.gain.value = 0;
  pulseOsc.connect(pulseGain);
  pulseGain.connect(output);
  pulseOsc.start();

  const shipOsc = context.createOscillator();
  const shipGain = context.createGain();
  shipOsc.type = 'triangle';
  shipOsc.frequency.value = 64;
  shipGain.gain.value = 0;
  shipOsc.connect(shipGain);
  shipGain.connect(output);
  shipOsc.start();

  const warpNoise = context.createBufferSource();
  const warpNoiseFilter = context.createBiquadFilter();
  const warpNoiseGain = context.createGain();
  warpNoise.buffer = makeNoiseBuffer(context, 2, WARP_NOISE_SEED);
  warpNoise.loop = true;
  warpNoiseFilter.type = 'bandpass';
  warpNoiseFilter.frequency.value = 620;
  warpNoiseFilter.Q.value = 0.8;
  warpNoiseGain.gain.value = 0;
  warpNoise.connect(warpNoiseFilter);
  warpNoiseFilter.connect(warpNoiseGain);
  warpNoiseGain.connect(output);
  warpNoise.start();

  const warpTone = context.createOscillator();
  const warpToneGain = context.createGain();
  warpTone.type = 'sine';
  warpTone.frequency.value = 140;
  warpToneGain.gain.value = 0;
  warpTone.connect(warpToneGain);
  warpToneGain.connect(output);
  warpTone.start();

  const lifeGain = context.createGain();
  const lifeA = context.createOscillator();
  const lifeB = context.createOscillator();
  lifeA.type = 'sine';
  lifeB.type = 'triangle';
  lifeA.frequency.value = 174.61;
  lifeB.frequency.value = 220;
  lifeGain.gain.value = 0;
  lifeA.connect(lifeGain);
  lifeB.connect(lifeGain);
  lifeGain.connect(output);
  lifeA.start();
  lifeB.start();

  const windNoise = context.createBufferSource();
  const windFilter = context.createBiquadFilter();
  const windGain = context.createGain();
  windNoise.buffer = makeNoiseBuffer(context, 3, WIND_NOISE_SEED);
  windNoise.loop = true;
  windFilter.type = 'lowpass';
  windFilter.frequency.value = 360;
  windFilter.Q.value = 0.35;
  windGain.gain.value = 0;
  windNoise.connect(windFilter);
  windFilter.connect(windGain);
  windGain.connect(output);
  windNoise.start();

  const glassGain = context.createGain();
  const glassA = context.createOscillator();
  const glassB = context.createOscillator();
  glassA.type = 'sine';
  glassB.type = 'sine';
  glassA.frequency.value = 659.25;
  glassB.frequency.value = 987.77;
  glassGain.gain.value = 0;
  glassA.connect(glassGain);
  glassB.connect(glassGain);
  glassGain.connect(output);
  glassA.start();
  glassB.start();

  const rumbleOsc = context.createOscillator();
  const rumbleGain = context.createGain();
  rumbleOsc.type = 'sawtooth';
  rumbleOsc.frequency.value = 36;
  rumbleGain.gain.value = 0;
  rumbleOsc.connect(rumbleGain);
  rumbleGain.connect(output);
  rumbleOsc.start();

  const waterNoise = context.createBufferSource();
  const waterFilter = context.createBiquadFilter();
  const waterGain = context.createGain();
  waterNoise.buffer = makeNoiseBuffer(context, 3, WATER_NOISE_SEED);
  waterNoise.loop = true;
  waterFilter.type = 'lowpass';
  waterFilter.frequency.value = 220;
  waterFilter.Q.value = 0.4;
  waterGain.gain.value = 0;
  waterNoise.connect(waterFilter);
  waterFilter.connect(waterGain);
  waterGain.connect(output);
  waterNoise.start();

  const nightGain = context.createGain();
  const nightA = context.createOscillator();
  const nightB = context.createOscillator();
  nightA.type = 'sine';
  nightB.type = 'triangle';
  nightA.frequency.value = 82.41;
  nightB.frequency.value = 123.47;
  nightGain.gain.value = 0;
  nightA.connect(nightGain);
  nightB.connect(nightGain);
  nightGain.connect(output);
  nightA.start();
  nightB.start();

  return {
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

class MusicEngine {
  // The engine's output into the shared music bus (audioCore owns volume/mute,
  // the submerge muffle, and the visibility duck for the whole music mix).
  private context: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private procedural: ProceduralRuntime | null = null;
  private unlocked = false;
  private proceduralTargets = ZERO_PROCEDURAL;
  private readonly layers = new Map<MusicLayerId, RuntimeLayer>();
  /** Exactly one fetch/decode may own this slot at a time. */
  private activeLayerLoad: Promise<void> | null = null;
  private layerLoadScheduled = false;
  /** Explicit preload eventually visits silent layers, still through one slot. */
  private preloadAllLayers = false;
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
    if (this.musicGain) rampGain(context, this.musicGain.gain, 1, MUSIC_ENGINE_UNLOCK_SLEW_S);
    this.setProceduralTargets(this.proceduralTargets, MUSIC_ENGINE_UNLOCK_SLEW_S);
    // The score/procedural graph is audible immediately. Streamed texture stems
    // join only when their live target is audible, one fetch/decode at a time;
    // decoding the entire catalog inside the input gesture can starve the world
    // mount and make both the first score and scene transition appear frozen.
    this.scheduleNextLayerLoad();
  }

  preload(): void {
    if (!this.context) return;
    this.preloadAllLayers = true;
    this.scheduleNextLayerLoad();
  }

  setLayerTargets(targets: Partial<Record<MusicLayerId, number>>, fadeSeconds: number): void {
    if (this.context) {
      automateLayerTargets(this.context, this.layers.values(), targets, fadeSeconds);
      if (this.unlocked) this.scheduleNextLayerLoad();
      return;
    }
    for (const layer of this.layers.values()) {
      layer.targetGain = clampUnit(targets[layer.asset.id] ?? 0);
    }
  }

  setProceduralTargets(
    targets: ProceduralMusicTargets,
    fadeSeconds: number,
    slewOverrides: ProceduralMusicSlewOverrides = {}
  ): void {
    this.proceduralTargets = normalizeProceduralTargets(targets);

    if (!this.context || !this.procedural) return;
    automateProceduralTargets(
      this.context,
      this.procedural,
      this.proceduralTargets,
      fadeSeconds,
      slewOverrides
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
    retuneProceduralDrones(this.context, this.procedural, pc);
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

  private nextLayerToLoad(): RuntimeLayer | null {
    let selected: RuntimeLayer | null = null;
    for (const layer of this.layers.values()) {
      if (layer.buffer || layer.loading) continue;
      if (!this.preloadAllLayers && layer.targetGain <= STREAM_LAYER_LOAD_EPSILON) continue;
      // Highest current gain wins. Map insertion order is the stable tie-break,
      // so identical targets remain deterministic across runs.
      if (!selected || layer.targetGain > selected.targetGain) selected = layer;
    }
    return selected;
  }

  private scheduleNextLayerLoad(): void {
    if (!this.context || this.activeLayerLoad || this.layerLoadScheduled) return;
    // AudioDirector publishes targets every frame. Once all requested stems are
    // resident (or already attempted), do not enqueue an empty microtask on
    // every one of those updates.
    if (!this.nextLayerToLoad()) return;
    this.layerLoadScheduled = true;
    queueMicrotask(() => {
      this.layerLoadScheduled = false;
      if (!this.context || this.activeLayerLoad) return;
      const layer = this.nextLayerToLoad();
      if (!layer) return;
      const load = this.loadLayer(layer);
      this.activeLayerLoad = load;
      void load.then(() => {
        if (this.activeLayerLoad === load) this.activeLayerLoad = null;
        // Re-evaluate live targets after every decode. A scene transition may
        // have made a different stem more valuable while this one was loading.
        this.scheduleNextLayerLoad();
      });
    });
  }

  private loadLayer(layer: RuntimeLayer): Promise<void> {
    const context = this.context;
    if (!context || layer.buffer) return Promise.resolve();
    if (layer.loading) return layer.loading;

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
    return layer.loading;
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
    rampGain(context, gain.gain, layer.targetGain, STREAM_LAYER_START_SLEW_S);
  }

  private startProcedural(): void {
    if (!this.context || !this.musicGain || this.procedural) return;

    this.procedural = createProceduralRuntime(this.context, this.musicGain);

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

    source.buffer = makeNoiseBuffer(context, Math.max(0.2, options.duration), CUE_NOISE_SEED);
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

export interface OfflineMusicEngineRuntime {
  setProceduralTargets(
    targets: ProceduralMusicTargets,
    fadeSeconds: number,
    slewOverrides?: ProceduralMusicSlewOverrides
  ): void;
  setLayerTargets(targets: Partial<Record<MusicLayerId, number>>, fadeSeconds: number): void;
  retuneDronesToChordRoot(rootSemisFromA: number): void;
}

export interface OfflineMusicEngineRuntimeOptions {
  /** Opt-in noise carriers for audits that must render streamed-layer slews. */
  includeStemAuditCarriers?: boolean;
}

interface OfflineAuditLayer extends AutomatableLayer {
  source: AudioBufferSourceNode | null;
  trim: GainNode | null;
}

/**
 * Bounded, fetch-free mirror of the shipped legacy music engine for offline
 * sweeps. The procedural graph and both target automators are the live ones.
 * Catalog GainNodes always exist so their live slew path remains exercisable.
 * Owner/evidence renders are silent on those lanes by default; dedicated
 * smoothness audits may opt into quiet seeded non-pitched noise carriers. No
 * streamed asset is fetched or retired.
 */
export function createOfflineMusicEngineRuntime(
  context: BaseAudioContext,
  out: AudioNode,
  options: OfflineMusicEngineRuntimeOptions = {}
): OfflineMusicEngineRuntime {
  const procedural = createProceduralRuntime(context, out);
  const layers = new Map<MusicLayerId, OfflineAuditLayer>();

  for (const asset of MUSIC_LAYER_ASSETS) {
    const gain = context.createGain();
    gain.gain.value = 0;
    gain.connect(out);
    let source: AudioBufferSourceNode | null = null;
    let trim: GainNode | null = null;
    if (options.includeStemAuditCarriers) {
      source = context.createBufferSource();
      trim = context.createGain();
      source.buffer = makeNoiseBuffer(
        context,
        OFFLINE_STEM_AUDIT_BUFFER_S,
        OFFLINE_STEM_AUDIT_SEEDS[asset.id]
      );
      source.loop = true;
      trim.gain.value = OFFLINE_STEM_AUDIT_CARRIER_LEVEL;
      source.connect(trim);
      trim.connect(gain);
      source.start();
    }
    layers.set(asset.id, { asset, source, trim, gain, targetGain: 0 });
  }

  return {
    setProceduralTargets(targets, fadeSeconds, slewOverrides) {
      automateProceduralTargets(
        context,
        procedural,
        normalizeProceduralTargets(targets),
        fadeSeconds,
        slewOverrides
      );
    },
    setLayerTargets(targets, fadeSeconds) {
      automateLayerTargets(context, layers.values(), targets, fadeSeconds);
    },
    retuneDronesToChordRoot(rootSemisFromA) {
      retuneProceduralDrones(context, procedural, rootSemisFromA);
    }
  };
}

let engine: MusicEngine | null = null;

export function getMusicEngine(): MusicEngine {
  engine ??= new MusicEngine();
  return engine;
}

export function unlockMusicAudio(): Promise<void> {
  return getMusicEngine().unlock();
}
