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
//                  → sceneEnvelopeGain → visibilityGain → compressor → destination
//
// The scene envelope is deliberately independent of the player's music-volume
// setting. Authored moments may shape the shared music bed without mutating a
// preference or competing with hidden-tab and submergence safety rails.

let ctx: AudioContext | null = null;
let musicBus: GainNode | null = null;
let submergeFilter: BiquadFilterNode | null = null;
let sceneEnvelopeGain: GainNode | null = null;
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
let sceneEnvelopeValue = 1;

function submergeCutoff(amount: number): number {
  const a = Math.min(1, Math.max(0, amount));
  // Frequency is perceptual/logarithmic: an exponential interpolation keeps
  // the continuous 0..1 depth rail even across the full audible range.
  return MUSIC_OPEN_CUTOFF_HZ * Math.pow(MUSIC_SUBMERGED_CUTOFF_HZ / MUSIC_OPEN_CUTOFF_HZ, a);
}

// --- iOS media-element output route ------------------------------------------
//
// Pure WebAudio wired straight to `ctx.destination` obeys the iOS hardware
// ringer (silent) switch and goes mute even when the app has volume. Routing
// the tail of the graph through a MediaStreamAudioDestinationNode into a
// `playsinline`, un-muted <audio> element reclassifies the output as *media*
// playback, which ignores the silent switch. This runs on iOS/iPadOS only —
// every other platform keeps the byte-identical direct destination path. The
// route is resilient: if the element's play() rejects it falls back to the
// direct destination and stays armed to retry on the next gesture.

export type AudioOutputRouteMode = 'direct' | 'media-element';

export interface AudioOutputRoute {
  /** Fire from inside a user gesture: (re)attempt the media-element route. */
  activateFromGesture(): void;
  /** Re-attempt resume/playback on tab return (visibility/focus), no gesture. */
  revive(): void;
  /** True once the context is running and the intended output path is live. */
  isConfirmed(): boolean;
  mode(): AudioOutputRouteMode;
  /** Human-readable state for on-device diagnostics. */
  describe(): string;
}

const outputRoutes = new Set<AudioOutputRoute>();
let musicOutputRoute: AudioOutputRoute | null = null;
let visibilityResumeInstalled = false;

/** iOS / iPadOS detection, including iPadOS 13+ masquerading as desktop Safari. */
function isIosLikePlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ reports a Macintosh UA; touch support disambiguates it from a Mac.
  const macLike = /Mac/.test(ua) || navigator.platform === 'MacIntel';
  const touchCapable =
    (typeof document !== 'undefined' && 'ontouchend' in document) ||
    navigator.maxTouchPoints > 1;
  return macLike && touchCapable;
}

/**
 * 'interrupted' is an iOS-only AudioContext state absent from the TS lib types;
 * compare as a string so a phone-call/Siri interruption resumes like 'suspended'.
 */
function contextNeedsResume(context: AudioContext): boolean {
  const state = context.state as string;
  return state === 'suspended' || state === 'interrupted';
}

function installOutputRoute(
  context: AudioContext,
  tail: AudioNode,
  label: string
): AudioOutputRoute {
  const canMediaRoute =
    isIosLikePlatform() &&
    typeof document !== 'undefined' &&
    typeof context.createMediaStreamDestination === 'function';

  if (!canMediaRoute) {
    tail.connect(context.destination);
    const route: AudioOutputRoute = {
      activateFromGesture() {},
      revive() {
        if (contextNeedsResume(context)) void context.resume();
      },
      isConfirmed: () => context.state === 'running',
      mode: () => 'direct',
      describe: () => `${label}: direct (${context.state})`
    };
    outputRoutes.add(route);
    return route;
  }

  let mode: AudioOutputRouteMode = 'direct';
  let mediaDest: MediaStreamAudioDestinationNode | null = null;
  let element: HTMLAudioElement | null = null;
  let directConnected = false;

  const setMode = (next: AudioOutputRouteMode): void => {
    if (mode === next) return;
    mode = next;
    console.info(`[audio] ${label} output route -> ${next} (${context.state})`);
  };
  const connectDirect = (): void => {
    if (directConnected) return;
    tail.connect(context.destination);
    directConnected = true;
  };
  const disconnectDirect = (): void => {
    if (!directConnected) return;
    try {
      tail.disconnect(context.destination);
    } catch {
      /* already detached */
    }
    directConnected = false;
  };

  // Terminate the graph at the real destination until the media element is
  // verifiably playing. Before the first gesture the context is suspended
  // anyway, so this only matters as a fallback if the media route never takes.
  connectDirect();

  const ensureMediaNodes = (): void => {
    if (mediaDest) return;
    mediaDest = context.createMediaStreamDestination();
    tail.connect(mediaDest);
    const el = document.createElement('audio');
    el.setAttribute('playsinline', '');
    (el as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
    el.autoplay = false;
    // Deliberately NOT muted — a muted element re-silences under the switch.
    el.srcObject = mediaDest.stream;
    element = el;
  };
  const elementPlaying = (): boolean =>
    !!element && !element.paused && !element.ended && element.readyState > 0;

  const attemptPlay = (onReject: () => void): void => {
    ensureMediaNodes();
    const el = element;
    if (!el) {
      connectDirect();
      return;
    }
    const played = el.play();
    if (!played || typeof played.then !== 'function') {
      // Legacy Safari returns undefined; assume the media route took.
      disconnectDirect();
      setMode('media-element');
      return;
    }
    void played
      .then(() => {
        disconnectDirect();
        setMode('media-element');
      })
      .catch(onReject);
  };

  const route: AudioOutputRoute = {
    activateFromGesture() {
      attemptPlay(() => {
        // Media route rejected: keep the direct path live and stay armed so the
        // next trusted gesture retries el.play().
        connectDirect();
        setMode('direct');
      });
    },
    revive() {
      if (contextNeedsResume(context)) void context.resume();
      if (element && !elementPlaying()) {
        attemptPlay(() => connectDirect());
      }
    },
    isConfirmed: () => context.state === 'running' && elementPlaying(),
    mode: () => mode,
    describe: () =>
      `${label}: ${mode} (${context.state}` +
      `${element ? `, el ${element.paused ? 'paused' : 'playing'}` : ''})`
  };
  outputRoutes.add(route);
  return route;
}

/** Re-attempt resume when returning to a tab with a non-running context. */
function installVisibilityResume(): void {
  if (visibilityResumeInstalled || typeof window === 'undefined') return;
  visibilityResumeInstalled = true;
  const revive = (): void => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    for (const route of outputRoutes) route.revive();
  };
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', revive);
  }
  window.addEventListener('focus', revive);
}

/**
 * True once every installed output route is confirmed live — the context is
 * running and, on iOS, the media-element route is playing. The first-gesture
 * unlock installer uses this to stay armed until unlock verifiably sticks.
 */
export function areGameAudioRoutesConfirmed(): boolean {
  if (outputRoutes.size === 0) return false;
  for (const route of outputRoutes) {
    if (!route.isConfirmed()) return false;
  }
  return true;
}

/** One-line diagnostic of every output route's state and active path. */
export function describeGameAudioOutputRoutes(): string {
  if (outputRoutes.size === 0) return 'audio: no routes installed';
  return [...outputRoutes].map(route => route.describe()).join(' | ');
}

/**
 * Shared installer for the iOS-aware terminal output route. The music chain and
 * the (separate-context) SFX chain both terminate through this so neither is
 * silenced by the hardware ringer switch.
 */
export function installGameAudioOutputRoute(
  context: AudioContext,
  tail: AudioNode,
  label: string
): AudioOutputRoute {
  const route = installOutputRoute(context, tail, label);
  installVisibilityResume();
  if (typeof window !== 'undefined') {
    (window as unknown as { __voxAudioDiag?: () => string }).__voxAudioDiag =
      describeGameAudioOutputRoutes;
  }
  return route;
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
  musicOutputRoute = installGameAudioOutputRoute(ctx, compressor, 'music');

  visibilityGain = ctx.createGain();
  visibilityGain.gain.value = ducked ? MUSIC_VISIBILITY_DUCK_LEVEL : 1;
  visibilityGain.connect(compressor);

  sceneEnvelopeGain = ctx.createGain();
  sceneEnvelopeGain.gain.value = sceneEnvelopeValue;
  sceneEnvelopeGain.connect(visibilityGain);

  submergeFilter = ctx.createBiquadFilter();
  submergeFilter.type = 'lowpass';
  submergeFilter.frequency.value = submergeCutoff(submergence); // open on land (transparent)
  submergeFilter.Q.value = MUSIC_SUBMERGE_FILTER_Q;
  submergeFilter.connect(sceneEnvelopeGain);

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
  if (!context) return;
  // Resume from 'suspended' AND the iOS-only 'interrupted' state (see
  // contextNeedsResume). Activating the media-element route must happen inside
  // this gesture so el.play() is a trusted call on iOS.
  if (contextNeedsResume(context)) void context.resume();
  musicOutputRoute?.activateFromGesture();
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

export interface MusicSceneEnvelopePoint {
  /** Seconds after the schedule's start anchor. */
  offsetSeconds: number;
  /** Shared-music multiplier, clamped to 0..1. */
  value: number;
}

/** Current audio time without constructing an AudioContext before unlock. */
export function getMusicAudioTime(): number | null {
  return ctx?.currentTime ?? null;
}

/**
 * Exact, start-anchored scene automation. Unlike `rampParamAt`, this is for
 * authored envelopes whose duration and zero-width must remain literal rather
 * than 95%-settled. Callers supply the known value at the anchor so pause and
 * resume cannot infer a stale AudioParam value.
 */
export function scheduleMusicSceneEnvelopeParam(
  param: AudioParam,
  atTime: number,
  points: readonly MusicSceneEnvelopePoint[],
  startValue = param.value
): void {
  const at = Math.max(0, atTime);
  const start = clampMusicEnvelopeValue(startValue);
  const hold = param.cancelAndHoldAtTime;
  if (typeof hold === 'function') {
    hold.call(param, at);
  } else {
    param.cancelScheduledValues(at);
  }
  // Explicitly anchor the ramp. Chromium otherwise may interpolate a newly
  // scheduled endpoint from an older event in the rendered past.
  param.setValueAtTime(start, at);

  const ordered = points
    .filter(point => Number.isFinite(point.offsetSeconds) && Number.isFinite(point.value))
    .map(point => ({
      offsetSeconds: Math.max(0, point.offsetSeconds),
      value: clampMusicEnvelopeValue(point.value)
    }))
    .sort((a, b) => a.offsetSeconds - b.offsetSeconds);
  for (const point of ordered) {
    if (point.offsetSeconds === 0) {
      param.setValueAtTime(point.value, at);
    } else {
      param.linearRampToValueAtTime(point.value, at + point.offsetSeconds);
    }
  }
}

/**
 * Schedule the live shared-music envelope if audio is already unlocked.
 * Returning null is intentional: story events before unlock settle immediately
 * and are never queued to surprise the player after a later gesture.
 */
export function scheduleMusicSceneEnvelope(
  points: readonly MusicSceneEnvelopePoint[],
  atTime?: number,
  startValue = sceneEnvelopeValue
): number | null {
  let finalValue = clampMusicEnvelopeValue(startValue);
  let finalOffset = -1;
  for (const point of points) {
    if (!Number.isFinite(point.offsetSeconds) || !Number.isFinite(point.value)) continue;
    const offset = Math.max(0, point.offsetSeconds);
    if (offset >= finalOffset) {
      finalOffset = offset;
      finalValue = clampMusicEnvelopeValue(point.value);
    }
  }
  sceneEnvelopeValue = finalValue;
  if (!ctx || !sceneEnvelopeGain) return null;
  const at = Math.max(0, atTime ?? ctx.currentTime);
  scheduleMusicSceneEnvelopeParam(sceneEnvelopeGain.gain, at, points, startValue);
  return at;
}

/** Freeze an authored envelope at its analytically known value. */
export function holdMusicSceneEnvelope(value: number, atTime?: number): number | null {
  sceneEnvelopeValue = clampMusicEnvelopeValue(value);
  if (!ctx || !sceneEnvelopeGain) return null;
  const at = Math.max(0, atTime ?? ctx.currentTime);
  const param = sceneEnvelopeGain.gain;
  const hold = param.cancelAndHoldAtTime;
  if (typeof hold === 'function') {
    hold.call(param, at);
  } else {
    param.cancelScheduledValues(at);
  }
  param.setValueAtTime(sceneEnvelopeValue, at);
  return at;
}

/** Settle the scene rail now without changing volume/mute preferences. */
export function setMusicSceneEnvelopeImmediate(value: number): void {
  holdMusicSceneEnvelope(value);
}

function clampMusicEnvelopeValue(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1;
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
  setSceneEnvelope(value: number, atTime?: number, fadeSeconds?: number): void;
  scheduleSceneEnvelope(
    points: readonly MusicSceneEnvelopePoint[],
    atTime?: number,
    startValue?: number
  ): void;
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

  const offlineSceneEnvelope = context.createGain();
  offlineSceneEnvelope.gain.value = 1;
  offlineSceneEnvelope.connect(offlineVisibility);

  const offlineSubmerge = context.createBiquadFilter();
  offlineSubmerge.type = 'lowpass';
  offlineSubmerge.frequency.value = MUSIC_OPEN_CUTOFF_HZ;
  offlineSubmerge.Q.value = MUSIC_SUBMERGE_FILTER_Q;
  offlineSubmerge.connect(offlineSceneEnvelope);

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
    setSceneEnvelope(value, atTime = context.currentTime, fadeSeconds = 0.12) {
      rampParamAt(
        offlineSceneEnvelope.gain,
        clampMusicEnvelopeValue(value),
        atTime,
        fadeSeconds
      );
    },
    scheduleSceneEnvelope(
      points,
      atTime = context.currentTime,
      startValue = offlineSceneEnvelope.gain.value
    ) {
      scheduleMusicSceneEnvelopeParam(
        offlineSceneEnvelope.gain,
        atTime,
        points,
        startValue
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
