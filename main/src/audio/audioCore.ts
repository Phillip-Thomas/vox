// --- The audio core ----------------------------------------------------------------------
//
// ONE AudioContext and ONE music output chain, shared by every music engine:
// the streamed-layer/ambient mixer (musicEngine) and the procedural score
// (scoreEngine). One context means one clock — everything that schedules sound
// reads the same `currentTime` — and one output chain means the whole score
// passes through the underwater muffle, the hidden-tab duck, and the safety
// compressor together:
//
//   engine outputs → musicBus (volume · mute) → submergeFilter (lowpass)
//                  → visibilityGain → compressor → destination

let ctx: AudioContext | null = null;
let musicBus: GainNode | null = null;
let submergeFilter: BiquadFilterNode | null = null;
let visibilityGain: GainNode | null = null;

/** Default music-bus volume (shared by the live chain and the offline mirror). */
export const DEFAULT_MUSIC_VOLUME = 0.72;
const COMPRESSOR_THRESHOLD_DB = -20;
const COMPRESSOR_RATIO = 8;
const MUSIC_OUTPUT_SLEW_S = 0.22;
const MUSIC_INITIAL_FADE_S = 0.05;
const MUSIC_SUBMERGED_CUTOFF_HZ = 540;
const MUSIC_OPEN_CUTOFF_HZ = 20000;
const MUSIC_SUBMERGE_FILTER_Q = 0.7;
const MUSIC_SUBMERGE_ENTER_SLEW_S = 0.42;
const MUSIC_SUBMERGE_EXIT_SLEW_S = 0.65;
const MUSIC_VISIBILITY_DUCK_LEVEL = 0.18;
const MUSIC_VISIBILITY_DUCK_SLEW_S = 0.35;
const MUSIC_VISIBILITY_RESTORE_SLEW_S = 0.45;
const AUDIO_PARAM_MIN_SLEW_S = 0.01;
/** A named slew duration means 95% settled: three time constants, never a retroactive ramp. */
export const AUDIO_PARAM_SLEW_SETTLE_TAU_COUNT = 3;
const SUBMERGENCE_AUTOMATION_EPSILON = 0.002;

// Deterministic brown-noise generator constants. A fixed default makes two
// offline renders of the same graph sample-identical; callers may provide a
// voice-specific seed to decorrelate simultaneous noise families.
const DEFAULT_NOISE_SEED = 0x9e3779b9;
const NOISE_XOR_SHIFT_A = 13;
const NOISE_XOR_SHIFT_B = 17;
const NOISE_XOR_SHIFT_C = 5;
const NOISE_UINT_RANGE = 4294967296;
const NOISE_MEMORY = 0.985;
const NOISE_EXCITATION = 0.015;
const NOISE_OUTPUT_GAIN = 3.5;

let volume = DEFAULT_MUSIC_VOLUME;
let muted = false;
let submergence = 0;
let ducked = false;

function submergeCutoff(amount: number): number {
  const a = Math.min(1, Math.max(0, amount));
  // Frequency is perceptual/logarithmic: an exponential interpolation keeps
  // the continuous 0..1 depth rail even across the full audible range.
  return MUSIC_OPEN_CUTOFF_HZ * Math.pow(MUSIC_SUBMERGED_CUTOFF_HZ / MUSIC_OPEN_CUTOFF_HZ, a);
}

export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (ctx) return ctx;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();

  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = COMPRESSOR_THRESHOLD_DB;
  compressor.ratio.value = COMPRESSOR_RATIO;
  compressor.connect(ctx.destination);

  visibilityGain = ctx.createGain();
  visibilityGain.gain.value = ducked ? MUSIC_VISIBILITY_DUCK_LEVEL : 1;
  visibilityGain.connect(compressor);

  submergeFilter = ctx.createBiquadFilter();
  submergeFilter.type = 'lowpass';
  submergeFilter.frequency.value = submergeCutoff(submergence); // open on land (transparent)
  submergeFilter.Q.value = MUSIC_SUBMERGE_FILTER_Q;
  submergeFilter.connect(visibilityGain);

  musicBus = ctx.createGain();
  musicBus.gain.value = 0;
  musicBus.connect(submergeFilter);
  applyOutput(MUSIC_INITIAL_FADE_S);

  return ctx;
}

/** The shared music bus — every music engine's output connects here. */
export function getMusicBus(): GainNode | null {
  getAudioContext();
  return musicBus;
}

/**
 * The context if one already exists — never creates one. Lets late-joining
 * engines (the generative bed) build only after an unlock path made the
 * context, so no pre-gesture AudioContext is ever constructed on their behalf.
 */
export function peekAudioContext(): AudioContext | null {
  return ctx;
}

/** Resume the context from a user gesture (autoplay policy). */
export function unlockAudio(): void {
  const context = getAudioContext();
  if (context && context.state === 'suspended') void context.resume();
}

export function setMusicOutput(nextVolume: number, nextMuted: boolean): void {
  volume = Math.min(1, Math.max(0, nextVolume));
  muted = nextMuted;
  applyOutput(MUSIC_OUTPUT_SLEW_S);
}

export function isMusicMuted(): boolean {
  return muted;
}

/** Continuous underwater muffle; booleans remain compatible with the shipped API. */
export function setMusicSubmerged(next: boolean | number): void {
  const amount = typeof next === 'boolean' ? (next ? 1 : 0) : Math.min(1, Math.max(0, next));
  if (Math.abs(amount - submergence) < SUBMERGENCE_AUTOMATION_EPSILON) return;
  const entering = amount > submergence;
  submergence = amount;
  if (ctx && submergeFilter) {
    rampParam(
      ctx,
      submergeFilter.frequency,
      submergeCutoff(amount),
      entering ? MUSIC_SUBMERGE_ENTER_SLEW_S : MUSIC_SUBMERGE_EXIT_SLEW_S
    );
  }
}

export function setMusicVisibilityDucked(next: boolean): void {
  ducked = next;
  if (ctx && visibilityGain) {
    rampParam(
      ctx,
      visibilityGain.gain,
      next ? MUSIC_VISIBILITY_DUCK_LEVEL : 1,
      next ? MUSIC_VISIBILITY_DUCK_SLEW_S : MUSIC_VISIBILITY_RESTORE_SLEW_S
    );
  }
}

function applyOutput(fadeSeconds: number): void {
  if (!ctx || !musicBus) return;
  rampParam(ctx, musicBus.gain, muted ? 0 : volume, fadeSeconds);
}

export function rampParam(
  context: BaseAudioContext,
  param: AudioParam,
  value: number,
  fadeSeconds: number
): void {
  rampParamAt(param, value, context.currentTime, fadeSeconds);
}

/**
 * Schedule a continuity-preserving slew at an arbitrary audio time.
 *
 * A linear-ramp endpoint is unsafe here: Chromium can interpolate that new
 * endpoint from an older automation event when `cancelAndHoldAtTime()` has no
 * future event to cancel. At a current-time story handoff that retroactively
 * spans the rendered past and presents as an instantaneous gain cut. A
 * start-anchored target curve cannot interpolate before `at`, remains
 * continuous when interrupted, and works for both current and future events.
 * The named duration is the 95%-settled time (three time constants).
 */
export function rampParamAt(
  param: AudioParam,
  value: number,
  atTime: number,
  fadeSeconds: number
): void {
  const at = Math.max(0, atTime);
  const hold = param.cancelAndHoldAtTime;
  if (typeof hold === 'function') {
    hold.call(param, at);
  } else {
    param.cancelScheduledValues(at);
  }
  param.setTargetAtTime(
    value,
    at,
    Math.max(AUDIO_PARAM_MIN_SLEW_S, fadeSeconds) / AUDIO_PARAM_SLEW_SETTLE_TAU_COUNT
  );
}

export interface OfflineMusicChainControls {
  bus: GainNode;
  setSubmergence(amount: number, atTime?: number): void;
  setVisibilityDucked(next: boolean, atTime?: number): void;
}

/** Full controllable offline mirror of the live music output chain. */
export function createOfflineMusicRuntimeChain(
  context: BaseAudioContext
): OfflineMusicChainControls {
  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = COMPRESSOR_THRESHOLD_DB;
  compressor.ratio.value = COMPRESSOR_RATIO;
  compressor.connect(context.destination);

  const offlineVisibility = context.createGain();
  offlineVisibility.gain.value = 1;
  offlineVisibility.connect(compressor);

  const offlineSubmerge = context.createBiquadFilter();
  offlineSubmerge.type = 'lowpass';
  offlineSubmerge.frequency.value = MUSIC_OPEN_CUTOFF_HZ;
  offlineSubmerge.Q.value = MUSIC_SUBMERGE_FILTER_Q;
  offlineSubmerge.connect(offlineVisibility);

  const bus = context.createGain();
  bus.gain.value = DEFAULT_MUSIC_VOLUME;
  bus.connect(offlineSubmerge);
  let offlineSubmergence = 0;
  return {
    bus,
    setSubmergence(amount, atTime = context.currentTime) {
      const next = Math.min(1, Math.max(0, amount));
      if (Math.abs(next - offlineSubmergence) < SUBMERGENCE_AUTOMATION_EPSILON) return;
      const entering = next > offlineSubmergence;
      offlineSubmergence = next;
      rampParamAt(
        offlineSubmerge.frequency,
        submergeCutoff(next),
        atTime,
        entering ? MUSIC_SUBMERGE_ENTER_SLEW_S : MUSIC_SUBMERGE_EXIT_SLEW_S
      );
    },
    setVisibilityDucked(next, atTime = context.currentTime) {
      rampParamAt(
        offlineVisibility.gain,
        next ? MUSIC_VISIBILITY_DUCK_LEVEL : 1,
        atTime,
        next ? MUSIC_VISIBILITY_DUCK_SLEW_S : MUSIC_VISIBILITY_RESTORE_SLEW_S
      );
    }
  };
}

/** Neutral-state convenience retained for the shipped soak callers. */
export function createOfflineMusicChain(context: BaseAudioContext): GainNode {
  return createOfflineMusicRuntimeChain(context).bus;
}

export function makeNoiseBuffer(
  context: BaseAudioContext,
  seconds: number,
  seed = DEFAULT_NOISE_SEED
): AudioBuffer {
  const frameCount = Math.max(1, Math.floor(context.sampleRate * seconds));
  const buffer = context.createBuffer(1, frameCount, context.sampleRate);
  const data = buffer.getChannelData(0);
  let sample = 0;
  let state = (seed >>> 0) || DEFAULT_NOISE_SEED;
  const unit = (): number => {
    state ^= state << NOISE_XOR_SHIFT_A;
    state ^= state >>> NOISE_XOR_SHIFT_B;
    state ^= state << NOISE_XOR_SHIFT_C;
    return (state >>> 0) / NOISE_UINT_RANGE;
  };
  for (let i = 0; i < frameCount; i++) {
    // Brown-ish noise sits behind the music as air/sea texture instead of
    // reading as bright broadband static.
    sample = sample * NOISE_MEMORY + (unit() * 2 - 1) * NOISE_EXCITATION;
    data[i] = sample * NOISE_OUTPUT_GAIN;
  }
  return buffer;
}
