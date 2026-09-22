import type { OxygenAudioPlan } from './oxygenAudio.ts';
import {
  applyGameAudioDuck,
  getAudioContext,
  getGameAudioCategoryBusInput,
  makeNoiseBuffer,
  setSfxOutput,
  setSfxSubmerged,
  unlockAudio,
  type NoiseCurve,
  type OfflineSfxBuses
} from './audioCore.ts';
import { isScoreMoodLeading } from './scoreEngine.ts';
import { SfxRateLimiter } from './sfxRateLimiter.ts';
import { onAudioEvent, postAudioEvent } from './mix/audioEventBus.ts';
import type { AudioEvent } from './mix/audioEventQueue.ts';
import {
  JETPACK_LOOP_CATEGORY,
  OXYGEN_PULSE_CATEGORY,
  SFX_CATEGORY,
  SFX_DUCK_SOURCE,
  SFX_PRIORITY,
  SHIP_THRUST_LOOP_CATEGORY
} from './mix/sfxCategories.ts';
import type { SfxBus } from './mix/mixTuning.ts';
import type { ScoreState } from './mix/duckMatrix.ts';
import { varySfxRecipe, REGULATION_SFX, BODY_SFX, ROUND_ROBIN_SFX, SFX_ROUND_ROBIN_SIBLINGS } from './sfx/sfxVariation.ts';
import { resolveSpatialSfx, NEUTRAL_SFX_LISTENER, type AudioPosition, type SfxListener } from './sfx/spatialSfx.ts';
import { COVERAGE_RECIPES, footstepRecipe, type CoverageSfxEvent } from './sfx/coverageRecipes.ts';
import { resolveEraGates } from './generative/worldSignals.ts';
import { connectRadioComb } from './voice/radioComb.ts';

let listener: SfxListener = NEUTRAL_SFX_LISTENER;
let liveSfxSeed = 0;
export function setSfxListener(next: SfxListener): void { listener = next; }
export function setSfxRunSeed(seed: number): void { liveSfxSeed = seed >>> 0; }

export type SfxEvent =
  | CoverageSfxEvent
  | 'jump'
  | 'land'
  | 'mine'
  | 'blocked'
  | 'boardShip'
  | 'exitShip'
  | 'shipLaunch'
  | 'shipBoost'
  | 'shipLand'
  | 'shipCrash'
  | 'splashEnter'
  | 'splashExit'
  // story mode (all procedural — the terminal/feed fiction is square waves + noise)
  | 'terminalKey'
  | 'terminalAdvance'
  | 'terminalAlarm'
  | 'terminalCorrupt'
  | 'storyGlitch'
  | 'storyAwaken'
  | 'storySleep';

/**
 * The SFX bus's own noise colour. Brighter and shorter-memoried than the music
 * bus (audioCore.MUSIC_NOISE_CURVE) — these are the constants every shipped
 * recipe was voiced against, and Stage 0 keeps them exactly. Only the sample
 * *source* changed: a seeded xorshift replaced `Math.random`, so a trigger is
 * reproducible. Recipe-identical, not byte-identical to the old renders.
 */
export const SFX_NOISE_MEMORY = 0.97;
export const SFX_NOISE_EXCITATION = 0.03;
export const SFX_NOISE_OUTPUT_GAIN = 2.4;
export const SFX_NOISE_CURVE: NoiseCurve = {
  memory: SFX_NOISE_MEMORY,
  excitation: SFX_NOISE_EXCITATION,
  outputGain: SFX_NOISE_OUTPUT_GAIN
};

/** The shipped default SFX sub-master level (audioSettings sfxVolume). */
export { DEFAULT_SFX_VOLUME } from './audioCore.ts';
/** Transparent on land; the muffled cutoff underwater (the bus muffle now lives in audioCore). */
export { SFX_SUBMERGE_MUFFLED_HZ, SFX_SUBMERGE_OPEN_HZ } from './mix/mixSnapshot.ts';
/** Every live trigger renders from rim seed 0; offline rims pass their own. */
export const SFX_LIVE_RIM_SEED = 0;
/** Counter key for the oxygen body clock, which has no SfxEvent of its own. */
const OXYGEN_PULSE_EVENT_ID = 'oxygenPulse';

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** FNV-1a over a string, as an unsigned 32-bit seed. */
export function fnv1a32(text: string): number {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

/**
 * Noise seed for one voice of one trigger. Distinct per (event, trigger,
 * voice) so no two triggers share a waveform, and reproducible so an offline
 * render of a scripted cue list replays bit-identically.
 */
export function sfxNoiseSeed(
  event: string,
  triggerIndex: number,
  voiceIndex: number,
  rimSeed: number
): number {
  return (fnv1a32(`${event}#${triggerIndex}#${voiceIndex}`) ^ (rimSeed >>> 0)) >>> 0;
}

export interface SfxToneVoice {
  kind: 'tone';
  type: OscillatorType;
  from: number;
  to: number;
  duration: number;
  gain: number;
  delay?: number;
}

export interface SfxNoiseVoice {
  kind: 'noise';
  type: BiquadFilterType;
  from: number;
  to: number;
  duration: number;
  gain: number;
  q?: number;
  delay?: number;
}

export type SfxVoice = SfxToneVoice | SfxNoiseVoice;

interface ContinuousLoop {
  source: AudioBufferSourceNode;
  filter: BiquadFilterNode;
  gain: GainNode;
}

/**
 * The shipped recipe for one event: 1–3 voices with their exact hardcoded
 * from/to/duration/gain. This is the single source both the live engine and
 * the offline rim render, so a combined render cannot drift from what plays.
 */
export function sfxRecipe(event: SfxEvent): readonly SfxVoice[] {
  if (event in COVERAGE_RECIPES) return COVERAGE_RECIPES[event as CoverageSfxEvent];
  switch (event) {
    case 'jump':
      return [
        { kind: 'tone', type: 'triangle', from: 135, to: 260, duration: 0.14, gain: 0.035 },
        { kind: 'noise', type: 'highpass', from: 320, to: 900, duration: 0.11, gain: 0.018 }
      ];
    case 'land':
      return [
        { kind: 'tone', type: 'sine', from: 86, to: 48, duration: 0.18, gain: 0.045 },
        { kind: 'noise', type: 'lowpass', from: 360, to: 120, duration: 0.14, gain: 0.035 }
      ];
    case 'mine':
      return [
        { kind: 'noise', type: 'bandpass', from: 1600, to: 700, duration: 0.09, gain: 0.04, q: 1.8 },
        { kind: 'tone', type: 'square', from: 190, to: 95, duration: 0.06, gain: 0.014 }
      ];
    case 'blocked':
      return [
        { kind: 'tone', type: 'triangle', from: 120, to: 70, duration: 0.1, gain: 0.03 }
      ];
    case 'boardShip':
      return [
        { kind: 'tone', type: 'sine', from: 420, to: 620, duration: 0.12, gain: 0.028 },
        { kind: 'tone', type: 'sine', from: 650, to: 840, duration: 0.1, gain: 0.018, delay: 0.08 }
      ];
    case 'exitShip':
      return [
        { kind: 'tone', type: 'sine', from: 620, to: 360, duration: 0.16, gain: 0.026 }
      ];
    case 'shipLaunch':
      return [
        { kind: 'noise', type: 'lowpass', from: 320, to: 850, duration: 0.34, gain: 0.06 },
        { kind: 'tone', type: 'sine', from: 72, to: 110, duration: 0.28, gain: 0.04 }
      ];
    case 'shipBoost':
      return [
        { kind: 'tone', type: 'sine', from: 58, to: 126, duration: 0.34, gain: 0.052 },
        { kind: 'tone', type: 'sawtooth', from: 190, to: 420, duration: 0.18, gain: 0.018 },
        { kind: 'noise', type: 'highpass', from: 520, to: 1800, duration: 0.2, gain: 0.028, q: 0.7 }
      ];
    case 'shipLand':
      return [
        { kind: 'tone', type: 'sine', from: 95, to: 55, duration: 0.22, gain: 0.038 },
        { kind: 'noise', type: 'lowpass', from: 260, to: 90, duration: 0.18, gain: 0.024 }
      ];
    case 'shipCrash':
      return [
        { kind: 'tone', type: 'sawtooth', from: 70, to: 32, duration: 0.34, gain: 0.09 },
        { kind: 'noise', type: 'lowpass', from: 900, to: 110, duration: 0.3, gain: 0.08 }
      ];
    case 'splashEnter':
      return [
        // Plunge: a quick lowpass-swept gulp + a bubble burst, as the muffle clamps on.
        { kind: 'noise', type: 'lowpass', from: 1400, to: 280, duration: 0.24, gain: 0.07 },
        { kind: 'noise', type: 'bandpass', from: 800, to: 1700, duration: 0.18, gain: 0.03, q: 1.2 }
      ];
    case 'splashExit':
      return [
        // Surface: a brighter rising "gasp" as the muffle releases + droplets.
        { kind: 'noise', type: 'highpass', from: 320, to: 1300, duration: 0.26, gain: 0.055 },
        { kind: 'tone', type: 'sine', from: 170, to: 330, duration: 0.18, gain: 0.02 }
      ];
    case 'terminalKey':
      return [
        // A single phosphor keystroke: dry square tick.
        { kind: 'tone', type: 'square', from: 880, to: 860, duration: 0.03, gain: 0.012 }
      ];
    case 'terminalAdvance':
      return [
        // Page feed: two-step chirp, polite and dead.
        { kind: 'tone', type: 'square', from: 520, to: 520, duration: 0.05, gain: 0.02 },
        { kind: 'tone', type: 'square', from: 700, to: 700, duration: 0.05, gain: 0.018, delay: 0.07 }
      ];
    case 'terminalAlarm':
      return [
        // The system raising its voice without raising its voice.
        { kind: 'tone', type: 'square', from: 640, to: 640, duration: 0.1, gain: 0.028 },
        { kind: 'tone', type: 'square', from: 460, to: 460, duration: 0.12, gain: 0.026, delay: 0.13 }
      ];
    case 'terminalCorrupt':
      return [
        // The ledger failing: a falling saw grind + static burst.
        { kind: 'tone', type: 'sawtooth', from: 300, to: 40, duration: 0.5, gain: 0.05 },
        { kind: 'noise', type: 'bandpass', from: 2400, to: 300, duration: 0.45, gain: 0.05, q: 0.8 }
      ];
    case 'storyGlitch':
      return [
        // A 2-frame chroma flash: bright static blink, gone before it registers.
        { kind: 'noise', type: 'highpass', from: 1800, to: 3200, duration: 0.07, gain: 0.035 },
        { kind: 'tone', type: 'square', from: 1200, to: 900, duration: 0.05, gain: 0.012 }
      ];
    case 'storyAwaken':
      return [
        // An opening: slow rising fifth over a warm noise swell (A1/A2 arrivals).
        { kind: 'tone', type: 'sine', from: 220, to: 330, duration: 1.6, gain: 0.035 },
        { kind: 'tone', type: 'sine', from: 330, to: 495, duration: 1.4, gain: 0.022, delay: 0.5 },
        { kind: 'noise', type: 'lowpass', from: 300, to: 1400, duration: 1.8, gain: 0.02 }
      ];
    case 'storySleep':
      return [
        // Lying down by the fire: a soft descending third into dark.
        { kind: 'tone', type: 'sine', from: 260, to: 195, duration: 1.1, gain: 0.03 },
        { kind: 'noise', type: 'lowpass', from: 500, to: 120, duration: 1.3, gain: 0.016 }
      ];
  }
  return [];
}

class SfxEngine {
  private context: AudioContext | null = null;
  private jetpack: ContinuousLoop | null = null;
  private shipThrust: ContinuousLoop | null = null;
  private volume = DEFAULT_SFX_VOLUME_LOCAL;
  private muted = false;
  // Per-event minimum-retrigger gate at the single fire() choke point. Bounds
  // how often dense proximity/pickup cues (`mine`, `terminalKey`) may sound
  // without altering any timbre. See sfxRateLimiter.ts. Stage 2 puts the
  // per-frame event queue IN FRONT of it (postAudioEvent → flush → fire); the
  // limiter and its loop guard stay as the backstop with unchanged thresholds.
  private readonly rateLimiter = new SfxRateLimiter();
  /** Per-event trigger ordinal — the second half of every noise seed. */
  private readonly triggerCounts = new Map<string, number>();
  private readonly eventTrace: { event: string; outcome: 'queued' | 'rate-limited' | 'scheduled'; perfMs: number; audioTime?: number; requestedAudioTime?: number; ordinal?: number; muted?: boolean; renderCostMs?: number }[] = [];
  private trace(entry: Omit<SfxEngine['eventTrace'][number], 'perfMs'>): void {
    this.eventTrace.push({ ...entry, perfMs: nowMs() });
    if (this.eventTrace.length > 1024) this.eventTrace.shift();
  }

  constructor() {
    if (typeof window !== 'undefined') {
      (window as unknown as { __voxSfxDiag?: () => string }).__voxSfxDiag = () =>
        this.rateLimiter.describe(nowMs());
      (window as unknown as { __voxSfxTrace?: () => unknown }).__voxSfxTrace = () => ({
        events: this.eventTrace, triggerCounts: Object.fromEntries(this.triggerCounts),
        note: 'Queue/rim observations; scheduled does not assert acoustic audibility.'
      });
    }
    onAudioEvent((event) => this.onFlushedEvent(event));
  }

  async unlock(): Promise<void> {
    const context = this.ensureContext();
    if (!context) return;
    // One context, one route: audioCore owns resume + iOS media-element route
    // activation for the whole game mix. SFX only re-settles its sub-master.
    unlockAudio();
    await context.resume();
    setSfxOutput(this.volume, this.muted, 0.04);
  }

  setOutput(sfxVolume: number, muted: boolean): void {
    this.volume = clamp01(sfxVolume);
    this.muted = muted;
    setSfxOutput(this.volume, this.muted, 0.12);
  }

  /**
   * Post a trigger to the per-frame event bus. Same-frame duplicates collapse
   * to one and a held level sounds only on its rising edge (audioEventQueue.ts);
   * the flushed event reaches fire() in the same task, so nothing is late.
   */
  play(event: SfxEvent, options?: PlaySfxOptions): void {
    this.trace({ event, outcome: 'queued', requestedAudioTime: options?.atAudioTime });
    postAudioEvent({
      id: event,
      category: SFX_CATEGORY[event],
      priority: SFX_PRIORITY[event] ?? 0,
      position: options?.position,
      material: options?.material,
      params: options?.atAudioTime != null ? { atAudioTime: options.atAudioTime } : undefined
    });
  }

  private onFlushedEvent(event: AudioEvent): void {
    if (!(event.id in SFX_CATEGORY)) return;
    this.fire(event.id as SfxEvent, event.params?.atAudioTime, event.position, event.material);
  }

  /** The single choke point every flushed trigger sounds through. */
  private fire(event: SfxEvent, atAudioTime?: number, position?: AudioPosition, material?: string): void {
    const context = this.ensureContext();
    const output = this.busInput(SFX_CATEGORY[event]);
    if (!context || !output) return;
    void context.resume();

    // Rate gate: drop retriggers that arrive inside this event's minimum
    // interval so dense proximity/pickup loops cannot machine-gun the bus.
    if (!this.rateLimiter.admit(event, nowMs())) { this.trace({ event, outcome: 'rate-limited' }); return; }

    // Composed sync (audio-10x Stage 3, C6): a BUNDLED member carries the exact
    // audio time it must start at (forward-scheduled to the music onset); an
    // unbundled trigger starts now, exactly as before. A stale time (a hitch
    // past the target) plays now — late, never early.
    const at = resolveSfxStartTime(context.currentTime, atAudioTime);
    const ordinal = this.nextTriggerIndex(event);
    const started = nowMs();
    renderDesignedSfx(context, output, event, at, ordinal, liveSfxSeed, { position, listener, material });
    this.trace({ event, outcome: 'scheduled', audioTime: at, requestedAudioTime: atAudioTime, ordinal, muted: this.muted || this.volume <= 0, renderCostMs: nowMs() - started });
    const duck = SFX_DUCK_SOURCE[event];
    if (duck) applyGameAudioDuck(duck, scoreState(), at);
  }

  /**
   * Render Chapter 6's physiological clock on the player bus. Noise-only thumps
   * and breath avoid claiming a pitch or grid from the signed story score, and
   * the bus muffle keeps the body treatment inside the same underwater medium
   * as every other diegetic sound. Not queued: the clock is free-running and
   * never quantized, so it takes the direct door.
   */
  playOxygenPulse(plan: OxygenAudioPlan): void {
    if (!plan.active || plan.pulseGain <= 0) return;
    const context = this.ensureContext();
    const output = this.busInput(OXYGEN_PULSE_CATEGORY);
    if (!context || !output) return;
    void context.resume();

    const at = context.currentTime;
    renderSfxVoices(
      context,
      output,
      oxygenPulseVoices(plan),
      at,
      OXYGEN_PULSE_EVENT_ID,
      this.nextTriggerIndex(OXYGEN_PULSE_EVENT_ID),
      SFX_LIVE_RIM_SEED
    );
    if (plan.criticalBreathGain > 0) applyGameAudioDuck('oxygenCritical', scoreState(), at);
  }

  /**
   * Muffle the diegetic SFX buses underwater. `amount` 0 = open/dry, 1 = fully
   * muffled; the edge (SFX_SUBMERGE_EDGE) snaps the cutoff on entry (the
   * "clunk") and releases it on exit (the "gasp").
   *
   * SINGLE AUTHORITY (S2-D11). The muffle has one owner in the running game:
   * `setMixSnapshot` (audioCore), which resolves `sfxSubmerged` from the same
   * submergence scalar as every other bus term and writes it with the rest of
   * the snapshot. This door (`setSfxSubmerged`) is the scalar-holder's path and
   * is used by the OFFLINE RIM and by callers that hold the raw scalar without
   * a snapshot; it is not a second opinion. Both write the one module-level
   * `sfxSubmergedEdge` flag and both early-out when the edge has not crossed,
   * so they cannot disagree or fight — whichever runs last states the edge, and
   * a snapshot always restates it. Do not add a third writer: resolve the
   * submergence into the snapshot instead.
   */
  setSubmerged(amount: number): void {
    const context = this.ensureContext();
    if (!context) return;
    void context.resume();
    setSfxSubmerged(clamp01(amount));
  }

  setJetpackActive(active: boolean, intensity = 1): void {
    const amount = active ? clamp01(intensity) : 0;
    const loop = amount > 0 ? this.ensureLoop('jetpack') : this.jetpack;
    if (!loop || !this.context) return;
    rampGain(this.context, loop.gain.gain, amount * 0.075, amount > 0 ? 0.06 : 0.16);
    rampParam(this.context, loop.filter.frequency, 520 + amount * 920, 0.08);
  }

  setShipThrust(level: number): void {
    const amount = clamp01(level);
    const loop = amount > 0 ? this.ensureLoop('shipThrust') : this.shipThrust;
    if (!loop || !this.context) return;
    rampGain(this.context, loop.gain.gain, amount * 0.045, amount > 0 ? 0.08 : 0.18);
    rampParam(this.context, loop.filter.frequency, 240 + amount * 560, 0.1);
  }

  private nextTriggerIndex(event: string): number {
    const next = (this.triggerCounts.get(event) ?? 0) + 1;
    this.triggerCounts.set(event, next);
    return next;
  }

  private busInput(bus: SfxBus): AudioNode | null {
    return getGameAudioCategoryBusInput(bus);
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (this.context) return this.context;

    // One shared AudioContext for the whole game — audioCore owns it, its clock,
    // the music chain, the category buses and the single iOS-aware output
    // route. SFX constructs no context and no bus of its own.
    const context = getAudioContext();
    if (!context || !getGameAudioCategoryBusInput('player')) return null;
    this.context = context;
    setSfxOutput(this.volume, this.muted, 0.04);
    return context;
  }

  private ensureLoop(kind: 'jetpack' | 'shipThrust'): ContinuousLoop | null {
    const context = this.ensureContext();
    const output = this.busInput(kind === 'jetpack' ? JETPACK_LOOP_CATEGORY : SHIP_THRUST_LOOP_CATEGORY);
    if (!context || !output) return null;
    void context.resume();

    const existing = kind === 'jetpack' ? this.jetpack : this.shipThrust;
    if (existing) return existing;

    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = makeSfxNoiseBuffer(context, SFX_LOOP_BUFFER_SECONDS, sfxNoiseSeed(kind, 0, 0, SFX_LIVE_RIM_SEED));
    source.loop = true;
    filter.type = kind === 'jetpack' ? 'bandpass' : 'lowpass';
    filter.frequency.value = kind === 'jetpack' ? 520 : 240;
    filter.Q.value = kind === 'jetpack' ? 0.85 : 0.45;
    gain.gain.value = 0;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(output);
    source.start();

    const loop = { source, filter, gain };
    if (kind === 'jetpack') this.jetpack = loop;
    else this.shipThrust = loop;
    return loop;
  }

}

/** Local mirror of audioCore's DEFAULT_SFX_VOLUME (re-exported above). */
const DEFAULT_SFX_VOLUME_LOCAL = 0.78;

/** The duck matrix's score state: a story MOODS beat leads the instrument. */
function scoreState(): ScoreState {
  return { storyLead: isScoreMoodLeading() };
}

function nowMs(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function rampGain(context: AudioContext, param: AudioParam, value: number, fadeSeconds: number): void {
  rampParam(context, param, value, fadeSeconds);
}

function rampParam(context: AudioContext, param: AudioParam, value: number, fadeSeconds: number): void {
  const now = context.currentTime;
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  param.linearRampToValueAtTime(value, now + Math.max(0.01, fadeSeconds));
}

/**
 * The SFX bus's noise source. Same one-pole curve as before — only the sample
 * source changed, from `Math.random` to audioCore's seeded xorshift, so a
 * trigger is reproducible offline. Buffers are intentionally NOT cached: the
 * seed carries the trigger ordinal, so every trigger's waveform is unique by
 * construction and reusing one would change what plays.
 */
function makeSfxNoiseBuffer(
  context: BaseAudioContext,
  seconds: number,
  seed: number
): AudioBuffer {
  return makeNoiseBuffer(context, seconds, seed, SFX_NOISE_CURVE);
}

/** Minimum noise-buffer length: a short recipe still gets a settled tail. */
const SFX_MIN_NOISE_SECONDS = 0.2;
/** The looping jetpack/thrust beds are one buffer, built once. */
const SFX_LOOP_BUFFER_SECONDS = 2.5;

/** The Chapter 6 body clock, as voices rather than as direct node calls. */
export function oxygenPulseVoices(plan: OxygenAudioPlan): readonly SfxVoice[] {
  const voices: SfxVoice[] = [
    { kind: 'noise', type: 'lowpass', from: 185, to: 72, duration: 0.115, gain: plan.pulseGain, q: 0.55 },
    {
      kind: 'noise',
      type: 'lowpass',
      from: 142,
      to: 58,
      duration: 0.095,
      gain: plan.pulseGain * 0.62,
      q: 0.5,
      delay: 0.13
    }
  ];
  if (plan.criticalBreathGain > 0) {
    voices.push({
      kind: 'noise',
      type: 'bandpass',
      from: 760,
      to: 260,
      duration: plan.criticalBreathDurationSeconds,
      gain: plan.criticalBreathGain,
      q: 0.7,
      delay: 0.2
    });
  }
  return voices;
}

/**
 * Instantiate one recipe's voices into `output` at an explicit start time.
 * Live callers pass `context.currentTime`; the offline rim passes the cue's
 * scripted time, so a scripted list renders sample-exactly.
 */
export function renderSfxVoices(
  context: BaseAudioContext,
  output: AudioNode,
  voices: readonly SfxVoice[],
  at: number,
  event: string,
  triggerIndex: number,
  rimSeed: number,
  onEnded?: () => void
): void {
  let remaining = voices.length;
  const ended = () => { if (--remaining === 0) onEnded?.(); };
  for (let i = 0; i < voices.length; i++) {
    const voice = voices[i];
    const start = at + (voice.delay ?? 0);
    if (voice.kind === 'tone') {
      renderSfxTone(context, output, voice, start, ended);
    } else {
      renderSfxNoise(context, output, voice, start, sfxNoiseSeed(event, triggerIndex, i, rimSeed), ended);
    }
  }
}

export interface DesignedSfxOptions {
  position?: AudioPosition;
  listener?: SfxListener;
  material?: string;
  /** Same-build nominal reference for spectral A/B evidence. */
  variation?: boolean;
}

export function renderDesignedSfx(context: BaseAudioContext, output: AudioNode, event: SfxEvent, at: number, ordinal: number, seed: number, options: DesignedSfxOptions = {}): void {
  const ear = options.listener ?? NEUTRAL_SFX_LISTENER;
  const materialGate = resolveEraGates(ear.era, ear.stage ?? 'alive').padChoir;
  const nominal = event === 'footstep' ? footstepRecipe(options.material, materialGate) : sfxRecipe(event);
  const voices = options.variation === false ? nominal : varySfxRecipe(event, nominal, sfxNoiseSeed(event, ordinal, 0, seed), ordinal);
  // The three authored siblings keep stable noise bodies; pitch/envelope/filter
  // draws still use the full trigger index, so every trigger remains distinct.
  const noiseOrdinal = options.variation !== false && ROUND_ROBIN_SFX.has(event) ? (ordinal - 1) % SFX_ROUND_ROBIN_SIBLINGS + 1 : ordinal;
  const position = REGULATION_SFX.has(event) || BODY_SFX.has(event) ? undefined : options.position;
  const spatial = resolveSpatialSfx(position, ear);
  if (spatial.gain === 0) return;
  if ((event.startsWith('objective') || event === 'markerAcquired') && materialGate > 0) {
    const input = context.createGain(); input.connect(output);
    const disconnectComb = connectRadioComb(context, input, output, materialGate);
    renderSfxVoices(context, input, voices, at, event, noiseOrdinal, seed);
    // Keep the short carrier tail, then retire the whole per-cue graph on the
    // context clock; a disconnected one-sample source is only a cleanup timer.
    const cleanup = context.createBufferSource(); cleanup.buffer = context.createBuffer(1, 1, context.sampleRate);
    cleanup.start(at + Math.max(...voices.map(voice => (voice.delay ?? 0) + voice.duration)) + 0.06);
    cleanup.onended = () => { input.disconnect(); disconnectComb(); cleanup.disconnect(); };
    return;
  }
  // Keep centered/dry institutional output on its original path.
  if (!position) {
    renderSfxVoices(context, output, voices, at, event, noiseOrdinal, seed);
    return;
  }
  const gain = context.createGain();
  const filter = context.createBiquadFilter();
  const pan = context.createStereoPanner();
  gain.gain.value = spatial.gain;
  filter.type = 'lowpass'; filter.frequency.value = spatial.cutoffHz;
  pan.pan.value = spatial.pan;
  gain.connect(filter); filter.connect(pan); pan.connect(output);
  renderSfxVoices(context, gain, voices, at, event, noiseOrdinal, seed, () => {
    gain.disconnect(); filter.disconnect(); pan.disconnect();
  });
}

function renderSfxTone(
  context: BaseAudioContext,
  output: AudioNode,
  voice: SfxToneVoice,
  start: number,
  ended?: () => void
): void {
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = voice.type;
  osc.frequency.setValueAtTime(voice.from, start);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, voice.to), start + voice.duration);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(voice.gain, start + voice.duration * 0.18);
  gain.gain.linearRampToValueAtTime(0, start + voice.duration);
  osc.connect(gain);
  gain.connect(output);
  osc.start(start);
  osc.stop(start + voice.duration);
  osc.onended = () => {
    osc.disconnect();
    gain.disconnect();
    ended?.();
  };
}

function renderSfxNoise(
  context: BaseAudioContext,
  output: AudioNode,
  voice: SfxNoiseVoice,
  start: number,
  seed: number,
  ended?: () => void
): void {
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  source.buffer = makeSfxNoiseBuffer(
    context,
    Math.max(SFX_MIN_NOISE_SECONDS, voice.duration),
    seed
  );
  filter.type = voice.type;
  filter.frequency.setValueAtTime(voice.from, start);
  filter.frequency.exponentialRampToValueAtTime(Math.max(1, voice.to), start + voice.duration);
  filter.Q.value = voice.q ?? 0.75;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(voice.gain, start + voice.duration * 0.08);
  gain.gain.linearRampToValueAtTime(0, start + voice.duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(output);
  source.start(start);
  source.stop(start + voice.duration);
  source.onended = () => {
    source.disconnect();
    filter.disconnect();
    gain.disconnect();
    ended?.();
  };
}

let engine: SfxEngine | null = null;

export function getSfxEngine(): SfxEngine {
  engine ??= new SfxEngine();
  return engine;
}

export function unlockSfxAudio(): Promise<void> {
  return getSfxEngine().unlock();
}

/**
 * Options for a BUNDLED trigger (audio-10x Stage 3, C6). `atAudioTime` is the
 * exact audio-clock start (the bundle's music onset plus the measured
 * music-vs-SFX tail offset). Unbundled callers pass nothing and are never shifted.
 */
export interface PlaySfxOptions {
  atAudioTime?: number;
  position?: AudioPosition;
  material?: string;
}

export function playSfx(event: SfxEvent, options?: PlaySfxOptions): void {
  getSfxEngine().play(event, options);
}

/** Test seam: the audio-clock start a flushed trigger resolves to (schedule law). */
export function resolveSfxStartTime(currentTime: number, atAudioTime?: number): number {
  return atAudioTime != null && Number.isFinite(atAudioTime) ? Math.max(currentTime, atAudioTime) : currentTime;
}

export function setJetpackSfx(active: boolean, intensity?: number): void {
  getSfxEngine().setJetpackActive(active, intensity);
}

/** Scalar-holder's door to the muffle; `setMixSnapshot` is the live authority (S2-D11, see setSubmerged). */
export function setSubmergedSfx(amount: number): void {
  getSfxEngine().setSubmerged(amount);
}

export function setShipThrustSfx(level: number): void {
  getSfxEngine().setShipThrust(level);
}

// --- Offline SFX rim (Stage 0 evidence floor; Stage 2 category buses) -----------------------------------
//
// Renders into the offline mirror's category buses — the same gain → duck →
// muffle-or-dry → sfxOutput → master chain the live engine plays through —
// against any BaseAudioContext, with every trigger taking an explicit start
// time. Nothing here runs in the game: it exists so a scripted cue list can be
// rendered sample-exactly alongside the music for combined loudness evidence,
// with the duck matrix applied exactly as live.

export interface OfflineSfxRim {
  /** The rim's bus set (the mirror's category buses). */
  buses: OfflineSfxBuses;
  play(event: SfxEvent, at: number, options?: DesignedSfxOptions): void;
  playOxygenPulse(plan: OxygenAudioPlan, at: number): void;
  setSubmerged(amount: number, at: number): void;
  setJetpackActive(active: boolean, intensity: number, at: number): void;
  setShipThrust(level: number, at: number): void;
}

export interface OfflineSfxRimOptions {
  /** The duck matrix's score state at a cue time (default: no story lead). */
  storyLead?: () => boolean;
}

/**
 * Anchored ramps for the offline rim only. The live engine keeps its own
 * `rampParam` byte-for-byte; this variant exists because an offline cue list
 * schedules into the future, where `currentTime` is the wrong anchor.
 */
function rampParamAtOffline(
  param: AudioParam,
  value: number,
  at: number,
  fadeSeconds: number
): void {
  const hold = param.cancelAndHoldAtTime;
  if (typeof hold === 'function') {
    hold.call(param, at);
  } else {
    param.cancelScheduledValues(at);
    param.setValueAtTime(param.value, at);
  }
  param.linearRampToValueAtTime(value, at + Math.max(0.01, fadeSeconds));
}

export function beginSfxOffline(
  context: BaseAudioContext,
  buses: OfflineSfxBuses,
  seed: number,
  options: OfflineSfxRimOptions = {}
): OfflineSfxRim {
  const storyLead = options.storyLead ?? (() => false);
  const stateAt = (): ScoreState => ({ storyLead: storyLead() });

  const triggerCounts = new Map<string, number>();
  const nextTriggerIndex = (event: string): number => {
    const next = (triggerCounts.get(event) ?? 0) + 1;
    triggerCounts.set(event, next);
    return next;
  };

  const loops = new Map<'jetpack' | 'shipThrust', ContinuousLoop>();
  const ensureLoop = (kind: 'jetpack' | 'shipThrust', at: number): ContinuousLoop => {
    const existing = loops.get(kind);
    if (existing) return existing;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = makeSfxNoiseBuffer(
      context,
      SFX_LOOP_BUFFER_SECONDS,
      sfxNoiseSeed(kind, 0, 0, seed)
    );
    source.loop = true;
    filter.type = kind === 'jetpack' ? 'bandpass' : 'lowpass';
    filter.frequency.value = kind === 'jetpack' ? 520 : 240;
    filter.Q.value = kind === 'jetpack' ? 0.85 : 0.45;
    gain.gain.value = 0;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(buses.input(kind === 'jetpack' ? JETPACK_LOOP_CATEGORY : SHIP_THRUST_LOOP_CATEGORY));
    source.start(at);
    const loop = { source, filter, gain };
    loops.set(kind, loop);
    return loop;
  };

  return {
    buses,
    play(event, at, design) {
      renderDesignedSfx(context, buses.input(SFX_CATEGORY[event]), event, at, nextTriggerIndex(event), seed, design);
      const duck = SFX_DUCK_SOURCE[event];
      if (duck) buses.duck(duck, stateAt(), at);
    },
    playOxygenPulse(plan, at) {
      if (!plan.active || plan.pulseGain <= 0) return;
      renderSfxVoices(
        context,
        buses.input(OXYGEN_PULSE_CATEGORY),
        oxygenPulseVoices(plan),
        at,
        OXYGEN_PULSE_EVENT_ID,
        nextTriggerIndex(OXYGEN_PULSE_EVENT_ID),
        seed
      );
      if (plan.criticalBreathGain > 0) buses.duck('oxygenCritical', stateAt(), at);
    },
    setSubmerged(amount, at) {
      buses.setSubmerged(clamp01(amount), at);
    },
    setJetpackActive(active, intensity, at) {
      const amount = active ? clamp01(intensity) : 0;
      const loop = amount > 0 ? ensureLoop('jetpack', at) : loops.get('jetpack');
      if (!loop) return;
      rampParamAtOffline(loop.gain.gain, amount * 0.075, at, amount > 0 ? 0.06 : 0.16);
      rampParamAtOffline(loop.filter.frequency, 520 + amount * 920, at, 0.08);
    },
    setShipThrust(level, at) {
      const amount = clamp01(level);
      const loop = amount > 0 ? ensureLoop('shipThrust', at) : loops.get('shipThrust');
      if (!loop) return;
      rampParamAtOffline(loop.gain.gain, amount * 0.045, at, amount > 0 ? 0.08 : 0.18);
      rampParamAtOffline(loop.filter.frequency, 240 + amount * 560, at, 0.1);
    }
  };
}
