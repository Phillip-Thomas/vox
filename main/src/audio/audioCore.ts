// --- The audio core ----------------------------------------------------------------------
//
// ONE AudioContext and ONE game mix, shared by every engine: the streamed-layer/
// ambient mixer (musicEngine), the procedural score (scoreEngine), the
// generative bed (bedEngine) and the SFX engine. One context means one clock —
// everything that schedules sound reads the same `currentTime` — and one
// mastering tail means nothing the player hears can clip:
//
//   music engines → musicBus (volume · mute) → submergeFilter (lowpass)
//                 → sceneEnvelopeGain → visibilityGain
//                 → [Stage 1 glue: compressor → trim → soft clip]
//                 → [Stage 2 safety: compressor → trim] → musicDuck → masterOutput
//   SFX voices    → category bus (gain → duck) ─┬─ world/player/ship → sfxSubmergeFilter ─┐
//                                               └─ ui/voice (dry) ─────────────────────────┴→ sfxOutput → masterOutput
//   masterOutput  → [Stage 2 true-peak limiter: compressor → trim → ceiling] → output route
//
// The scene envelope is deliberately independent of the player's music-volume
// setting. Authored moments may shape the shared music bed without mutating a
// preference or competing with hidden-tab and submergence safety rails. The
// duck matrix and the snapshot mixer write only the category-bus and musicDuck
// gains, from events and from dirty-checked intent — never per frame.

import {
  GLUE_ATTACK_S,
  GLUE_KNEE_DB,
  GLUE_MAKEUP_COMP_DB,
  GLUE_RATIO,
  GLUE_RELEASE_S,
  GLUE_THRESH_DB,
  SOFTCLIP_K
} from './generative/tuning.ts';
import { makeImpulseResponse, tanhDriveCurve, type ImpulseSpec } from './generative/timbre.ts';
import {
  CEILING_DBTP,
  CEILING_OVERSAMPLE,
  CEILING_SOFTNESS,
  LIM_ATTACK_S,
  LIM_KNEE_DB,
  LIM_MAKEUP_COMP_DB,
  LIM_RATIO,
  LIM_RELEASE_S,
  LIM_THRESH_DB,
  MIX_BUSES,
  MIX_SNAPSHOT_EPSILON_DB,
  MIX_SNAPSHOT_SLEW_S,
  SAFETY_ATTACK_S,
  SAFETY_KNEE_DB,
  SAFETY_MAKEUP_COMP_DB,
  SAFETY_RATIO,
  SAFETY_RELEASE_S,
  SAFETY_THRESH_DB,
  SUBMERGED_SFX_BUSES,
  TAIL_REFERENCE_GAIN_DB,
  type MixBus
} from './mix/mixTuning.ts';
import { ceilingCurve } from './mix/ceilingCurve.ts';
import { dbToGain, duckEnvelopePoints, resolveDuck, type DuckSource, type ScoreState } from './mix/duckMatrix.ts';
import {
  MUSIC_SUBMERGE_MUFFLED_HZ,
  MUSIC_SUBMERGE_OPEN_HZ,
  SFX_SUBMERGE_EDGE,
  SFX_SUBMERGE_MUFFLED_HZ,
  SFX_SUBMERGE_OPEN_HZ,
  sameBusGains,
  type MixSnapshot
} from './mix/mixSnapshot.ts';

let ctx: AudioContext | null = null;
let musicBus: GainNode | null = null;
let submergeFilter: BiquadFilterNode | null = null;
let sceneEnvelopeGain: GainNode | null = null;
let visibilityGain: GainNode | null = null;
// The live mastering tail + category buses (Stage 2). `masterOutput` is the
// post-safety unity master where the SFX sub-master joins; the true-peak
// limiter sits after it and feeds the single output route.
let mixTail: MixTail | null = null;
let masterOutput: GainNode | null = null;
let lastSnapshot: MixSnapshot | null = null;
let sfxSubmergedEdge = false;

/** Default music-bus volume (shared by the live chain and the offline mirror). */
export const DEFAULT_MUSIC_VOLUME = 0.72;
/** The pre-Stage-2 safety compressor, kept ONLY for the offline 'pre-stage-2' evidence tail. */
export const LEGACY_SAFETY_THRESHOLD_DB = -20;
export const LEGACY_SAFETY_RATIO = 8;
const MUSIC_OUTPUT_SLEW_S = 0.22;
const MUSIC_INITIAL_FADE_S = 0.05;
const MUSIC_SUBMERGED_CUTOFF_HZ = MUSIC_SUBMERGE_MUFFLED_HZ;
const MUSIC_OPEN_CUTOFF_HZ = MUSIC_SUBMERGE_OPEN_HZ;
const MUSIC_SUBMERGE_FILTER_Q = 0.7;
/** The SFX muffle keeps its own snap-on/gasp-off (shipped sfxEngine constants). */
const SFX_SUBMERGE_FILTER_Q = 0.7;
const SFX_SUBMERGE_ENTER_SLEW_S = 0.08;
const SFX_SUBMERGE_EXIT_SLEW_S = 0.16;
/** The shipped default SFX sub-master level (audioSettings sfxVolume). */
export const DEFAULT_SFX_VOLUME = 0.78;
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
let masterOutputRoute: AudioOutputRoute | null = null;
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

/**
 * Single visibility authority for the shared context. On tab-hide it ducks the
 * music `visibilityGain` (moved here from AudioDirector so one listener owns the
 * duck), and on tab-return it revives the output route. Duck-then-revive is safe:
 * the two touch independent nodes (music `visibilityGain` vs. the terminal
 * route), and on hide the revive self-skips while the duck engages; on show the
 * duck restores while the revive resumes. SFX joins downstream of the compressor
 * and never passes through `visibilityGain`, so this duck never touches SFX —
 * matching the pre-consolidation separate-context behavior exactly.
 */
function installVisibilityResume(): void {
  if (visibilityResumeInstalled || typeof window === 'undefined') return;
  visibilityResumeInstalled = true;
  const reviveRoutes = (): void => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    for (const route of outputRoutes) route.revive();
  };
  const syncMusicVisibilityDuck = (): void => {
    if (typeof document === 'undefined') return;
    setMusicVisibilityDucked(document.hidden);
  };
  const onVisibilityChange = (): void => {
    syncMusicVisibilityDuck();
    reviveRoutes();
  };
  // Settle the duck to current visibility now (AudioDirector did this on mount).
  // The context is built inside a visible-tab gesture in every real flow, so this
  // is a no-op there and only guards a context somehow built while hidden.
  syncMusicVisibilityDuck();
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange);
  }
  window.addEventListener('focus', reviveRoutes);
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
 * Installer for the single iOS-aware terminal output route. The whole game mix
 * — the music chain through the safety compressor and the SFX sub-master joined
 * in parallel — terminates through this one route on one context, so nothing is
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

  // The Stage 2 mastering tail and category buses, built by the same function
  // the offline mirror uses so renders measure what the player hears. Music
  // reaches masterOutput through glue → safety → musicDuck; the SFX category
  // buses join at masterOutput; the true-peak limiter after it feeds the single
  // iOS-aware route.
  mixTail = createMixTail(ctx, { glue: true, tail: 'shipped' });
  masterOutput = mixTail.masterOutput;
  masterOutputRoute = installGameAudioOutputRoute(ctx, mixTail.terminal, 'game');

  visibilityGain = ctx.createGain();
  visibilityGain.gain.value = ducked ? MUSIC_VISIBILITY_DUCK_LEVEL : 1;
  visibilityGain.connect(mixTail.musicIn);

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
 * The post-safety unity master where the SFX category buses join the music —
 * in parallel with the music safety compressor, so SFX bypasses the music
 * compressors, scene envelope, submerge muffle and hidden-tab duck — and from
 * which the Stage 2 true-peak limiter feeds the one output route.
 */
export function getGameAudioSfxJoinNode(): AudioNode | null {
  getAudioContext();
  return masterOutput;
}

/**
 * The input of one SFX category bus (Stage 2). Every SFX voice connects here;
 * the bus applies the snapshot gain, the duck, the muffle (world/player/ship
 * only) and the sfx volume before joining masterOutput.
 */
export function getGameAudioCategoryBusInput(bus: Exclude<MixBus, 'music'>): AudioNode | null {
  getAudioContext();
  return mixTail?.buses[bus].input ?? null;
}

/** The SFX sub-master level (audioSettings sfxVolume · mute), slewed. */
export function setSfxOutput(volume: number, nextMuted: boolean, fadeSeconds: number): void {
  if (!ctx || !mixTail) return;
  const v = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 0;
  rampParam(ctx, mixTail.sfxOutput.gain, nextMuted ? 0 : v, fadeSeconds);
}

/**
 * Edge-driven SFX muffle: the world/player/ship buses snap to the muffled
 * cutoff when the shared submergence scalar crosses SFX_SUBMERGE_EDGE and
 * release on the way out (the "clunk" and the "gasp"). ui/voice never pass it.
 */
export function setSfxSubmerged(amount: number): void {
  const submerged = (Number.isFinite(amount) ? amount : 0) > SFX_SUBMERGE_EDGE;
  if (submerged === sfxSubmergedEdge && lastSnapshot) return;
  sfxSubmergedEdge = submerged;
  if (!ctx || !mixTail) return;
  scheduleSfxSubmerge(mixTail, submerged, ctx.currentTime);
}

/**
 * Apply one duck edge (Stage 2 duck matrix): the buses the source pushes aside
 * take a literal attack → hold → release envelope on their duck gain, anchored
 * at `atTime`. Under a story lead the music column is capped (resolveDuck).
 */
export function applyGameAudioDuck(source: DuckSource, state: ScoreState, atTime?: number): void {
  if (!ctx || !mixTail) return;
  scheduleDuck(mixTail, source, state, atTime ?? ctx.currentTime);
}

/**
 * Write the resolved mix snapshot (Stage 2 snapshot mixer). Bus gains are
 * dirty-checked against the last applied snapshot and slewed over
 * MIX_SNAPSHOT_SLEW_S; the SFX submerge edge follows the same scalar. The
 * music bus itself is never re-levelled here (the snapshot's music gain is 0 dB
 * by law), and nothing is written when nothing changed.
 */
export function setMixSnapshot(snapshot: MixSnapshot): void {
  if (!ctx || !mixTail) return;
  if (!lastSnapshot || !sameBusGains(lastSnapshot, snapshot, MIX_SNAPSHOT_EPSILON_DB)) {
    applySnapshotGains(ctx, mixTail, snapshot, ctx.currentTime, MIX_SNAPSHOT_SLEW_S);
  }
  if (!lastSnapshot || snapshot.sfxSubmerged !== sfxSubmergedEdge) {
    sfxSubmergedEdge = snapshot.sfxSubmerged;
    scheduleSfxSubmerge(mixTail, snapshot.sfxSubmerged, ctx.currentTime);
  }
  lastSnapshot = snapshot;
  mixTail.setRoom(snapshot.roomPresetId, snapshot.quality, ctx.currentTime, snapshot.roomWeights);
}

/** The last applied snapshot (diagnostics). */
export function getMixSnapshot(): MixSnapshot | null {
  return lastSnapshot;
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
  masterOutputRoute?.activateFromGesture();
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

export interface OfflineSfxBuses {
  setRoom?(room: RoomPresetId, quality: 'full' | 'lean', atTime: number): void;
  /** The input of one SFX category bus. */
  input(bus: Exclude<MixBus, 'music'>): AudioNode;
  /** Edge-driven muffle on the world/player/ship buses (same scalar, same edge). */
  setSubmerged(amount: number, atTime: number): void;
  /** The SFX sub-master level (0..1) — 0 keeps the events firing but inaudible (duck traces). */
  setOutput(gain: number, atTime: number): void;
  /** One duck edge from the matrix, anchored at `atTime`. */
  duck(source: DuckSource, state: ScoreState, atTime: number): void;
}

export interface OfflineMusicChainControls {
  bus: GainNode;
  /**
   * The post-safety unity master, mirroring the live `masterOutput` (see
   * getGameAudioSfxJoinNode): the SFX category buses join here and the
   * true-peak limiter follows, exactly as the player's output route does.
   */
  sfxJoin: AudioNode;
  /** The SFX category buses of the mirror (the offline SFX rim renders into these). */
  sfx: OfflineSfxBuses;
  setSubmergence(amount: number, atTime?: number): void;
  setSceneEnvelope(value: number, atTime?: number, fadeSeconds?: number): void;
  scheduleSceneEnvelope(
    points: readonly MusicSceneEnvelopePoint[],
    atTime?: number,
    startValue?: number
  ): void;
  setVisibilityDucked(next: boolean, atTime?: number): void;
  /** Apply a resolved mix snapshot's bus gains (the live setMixSnapshot, anchored). */
  applySnapshot(snapshot: MixSnapshot, atTime?: number): void;
}

/**
 * Which mastering tail the offline mirror builds.
 *  - 'shipped'     — the live chain (default).
 *  - 'pre-tail'    — a tap BEFORE the mastering tail: visibility → master → destination,
 *                    no glue, no safety compressor, no limiter. Stage 2 evidence uses it to
 *                    prove a tail change is confined to the tail (pre-tail renders identical).
 *  - 'pre-stage-2' — the Stage 1 tail: glue → legacy safety compressor (-20 dB / 8:1, its
 *                    baked makeup uncancelled) → master → destination, no limiter. The
 *                    old-versus-new comparisons render both tails from one instrument.
 */
export type OfflineMusicTailMode = 'shipped' | 'pre-tail' | 'pre-stage-2';

/** Stage bypasses for the static-gain measurements (never used by the live chain). */
export interface MixTailBypass {
  safety?: boolean;
  safetyTrim?: boolean;
  limiter?: boolean;
  limiterTrim?: boolean;
  ceiling?: boolean;
  /** Bypass the measured reference gain (see TAIL_REFERENCE_GAIN_DB). */
  referenceGain?: boolean;
}

/** Full controllable offline mirror of the live music output chain. */
export interface OfflineMusicChainOptions {
  /** Stage 1 glue stage (default true = the live chain). `false` = pre-Stage-1 topology. */
  glue?: boolean;
  /** Mastering-tail selection for evidence renders (default 'shipped'). */
  tail?: OfflineMusicTailMode;
  /** Evidence-only stage bypasses. */
  bypass?: MixTailBypass;
}

export function createOfflineMusicRuntimeChain(
  context: BaseAudioContext,
  options: OfflineMusicChainOptions = {}
): OfflineMusicChainControls {
  const tail = createMixTail(context, {
    glue: options.glue ?? true,
    tail: options.tail ?? 'shipped',
    bypass: options.bypass
  });
  tail.terminal.connect(context.destination);

  const offlineVisibility = context.createGain();
  offlineVisibility.gain.value = 1;
  offlineVisibility.connect(tail.musicIn);

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
  let offlineSfxSubmerged = false;
  return {
    bus,
    sfxJoin: tail.masterOutput,
    sfx: {
      input: (b) => tail.buses[b].input,
      setSubmerged(amount, atTime) {
        const submerged = amount > SFX_SUBMERGE_EDGE;
        if (submerged === offlineSfxSubmerged) return;
        offlineSfxSubmerged = submerged;
        scheduleSfxSubmerge(tail, submerged, atTime);
      },
      setOutput(gain, atTime) {
        tail.sfxOutput.gain.setValueAtTime(Math.min(1, Math.max(0, gain)), Math.max(0, atTime));
      },
      duck(source, state, atTime) {
        scheduleDuck(tail, source, state, atTime);
      },
      setRoom(room, quality, atTime) { tail.setRoom(room, quality, atTime); }
    },
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
    },
    applySnapshot(snapshot, atTime = context.currentTime) {
      applySnapshotGains(context, tail, snapshot, atTime, MIX_SNAPSHOT_SLEW_S);
      tail.setRoom(snapshot.roomPresetId, snapshot.quality, atTime, snapshot.roomWeights);
    }
  };
}

/** Neutral-state convenience retained for the shipped soak callers. */
export function createOfflineMusicChain(
  context: BaseAudioContext,
  options: OfflineMusicChainOptions = {}
): GainNode {
  return createOfflineMusicRuntimeChain(context, options).bus;
}

// --- The mastering tail and category buses (shared verbatim by live and offline) --------------------

interface CategoryBus {
  /** Where voices connect: the snapshot gain. */
  input: GainNode;
  gain: GainNode;
  duck: GainNode;
}

export interface MixTail {
  setRoom(room: RoomPresetId, quality: 'full' | 'lean', atTime: number, weights?: SfxRoomWeights): void;
  /** The node the music path (visibilityGain) connects to. */
  musicIn: AudioNode;
  /** Music-only duck gain, post safety, pre join. */
  musicDuck: GainNode;
  /** Post-safety unity master; SFX joins here. */
  masterOutput: GainNode;
  buses: Record<Exclude<MixBus, 'music'>, CategoryBus>;
  sfxSubmergeFilter: BiquadFilterNode;
  sfxOutput: GainNode;
  /** The node that feeds the output route / destination (post limiter and ceiling). */
  terminal: AudioNode;
}

interface MixTailOptions {
  glue: boolean;
  tail: OfflineMusicTailMode;
  bypass?: MixTailBypass;
}

function createMixTail(context: BaseAudioContext, options: MixTailOptions): MixTail {
  const bypass = options.bypass ?? {};
  const masterOutput = context.createGain();
  masterOutput.gain.value = 1;

  // Music side of the tail, built back to front so each stage knows its `next`.
  const musicDuck = context.createGain();
  musicDuck.gain.value = 1;
  musicDuck.connect(masterOutput);
  let musicIn: AudioNode = musicDuck;
  if (options.tail === 'pre-stage-2') {
    const legacy = context.createDynamicsCompressor();
    legacy.threshold.value = LEGACY_SAFETY_THRESHOLD_DB;
    legacy.ratio.value = LEGACY_SAFETY_RATIO;
    legacy.connect(musicDuck);
    musicIn = options.glue ? createMusicGlueStage(context, legacy) : legacy;
  } else if (options.tail === 'shipped') {
    const safetyIn = createSafetyStage(context, musicDuck, bypass);
    musicIn = options.glue ? createMusicGlueStage(context, safetyIn) : safetyIn;
  }
  // 'pre-tail': visibility → musicDuck → master, no processing.

  // SFX category buses: gain (snapshot) → duck → muffle or dry → sfxOutput → master.
  const sfxOutput = context.createGain();
  sfxOutput.gain.value = DEFAULT_SFX_VOLUME;
  sfxOutput.connect(masterOutput);
  const sfxSubmergeFilter = context.createBiquadFilter();
  sfxSubmergeFilter.type = 'lowpass';
  sfxSubmergeFilter.frequency.value = SFX_SUBMERGE_OPEN_HZ;
  sfxSubmergeFilter.Q.value = SFX_SUBMERGE_FILTER_Q;
  sfxSubmergeFilter.connect(sfxOutput);
  const buses = {} as Record<Exclude<MixBus, 'music'>, CategoryBus>;
  for (const bus of MIX_BUSES) {
    if (bus === 'music') continue;
    const gain = context.createGain();
    gain.gain.value = 1;
    const duck = context.createGain();
    duck.gain.value = 1;
    gain.connect(duck);
    duck.connect(SUBMERGED_SFX_BUSES.includes(bus) ? sfxSubmergeFilter : sfxOutput);
    buses[bus] = { input: gain, gain, duck };
  }

  // The true-peak limiter after the join (shipped tail only).
  const terminal: AudioNode =
    options.tail === 'shipped' ? createLimiterStage(context, masterOutput, bypass) : masterOutput;

  // Rooms are built only when used. The lean bank has two feedback-delay
  // spaces; full uses the same deterministic impulse generator as the score.
  const roomInput = context.createGain();
  buses.world.duck.connect(roomInput);
  buses.player.duck.connect(roomInput);
  buses.ship.duck.connect(roomInput);
  const rooms = new Map<string, GainNode>();
  let activeQuality: 'full' | 'lean' | null = null;
  const lastRoomGains = new Map<string, number>();
  const setRoom = (requested: RoomPresetId, quality: 'full' | 'lean', atTime: number, weights?: SfxRoomWeights) => {
    const targets = new Map<string, number>();
    const requestedWeights = weights ?? { [requested]: 1 };
    for (const [id, weight] of Object.entries(requestedWeights)) {
      const room = sfxRoomForTier(id as RoomPresetId, quality);
      const key = `${quality}:${room}`;
      targets.set(key, (targets.get(key) ?? 0) + weight * SFX_ROOM_PRESETS[room].send);
      if (weight <= 0 || rooms.has(key)) continue;
      const preset = SFX_ROOM_PRESETS[room];
      const send = context.createGain(); send.gain.value = 0; roomInput.connect(send);
      if (quality === 'lean') {
        const delay = context.createDelay(1);
        const filter = context.createBiquadFilter();
        const feedback = context.createGain();
        delay.delayTime.value = room === 'underwater' ? 0.071 : 0.029;
        filter.type = 'lowpass'; filter.frequency.value = preset.dampingHz;
        feedback.gain.value = room === 'underwater' ? 0.58 : 0.24;
        send.connect(delay); delay.connect(filter); filter.connect(feedback); feedback.connect(delay); filter.connect(sfxOutput);
      } else {
        const reverb = context.createConvolver();
        reverb.buffer = makeImpulseBuffer(context, { seconds: preset.seconds, decay: 3, seed: 0x726f6f6d + Object.keys(SFX_ROOM_PRESETS).indexOf(room), channels: 2, preDelayMs: preset.preDelayMs, hfDampHz: preset.dampingHz, earlyTaps: room === 'station' ? 16 : 8, earlyWindowMs: [8, 60], earlyLevel: 0.3, lateLevel: 0.5, lateOnsetMs: 30 });
        send.connect(reverb); reverb.connect(sfxOutput);
      }
      rooms.set(key, send);
    }
    const discrete = !weights || activeQuality !== quality;
    for (const [key, node] of rooms) {
      const target = targets.get(key) ?? 0;
      if (Math.abs(target - (lastRoomGains.get(key) ?? -1)) < 0.0001) continue;
      if (discrete) rampParamAt(node.gain, target, atTime, SFX_ROOM_CROSSFADE_S);
      else { node.gain.cancelScheduledValues(atTime); node.gain.setValueAtTime(target, atTime); }
      lastRoomGains.set(key, target);
    }
    activeQuality = quality;
  };
  return { musicIn, musicDuck, masterOutput, buses, sfxSubmergeFilter, sfxOutput, terminal, setRoom };
}

/**
 * The Stage 1 music-bus glue: glue compressor → unity-slope tanh soft clip,
 * feeding `next`. Shared verbatim by the live chain and the offline mirror so
 * renders measure what the player hears.
 */
function createMusicGlueStage(context: BaseAudioContext, next: AudioNode): AudioNode {
  const glue = context.createDynamicsCompressor();
  glue.threshold.value = GLUE_THRESH_DB;
  glue.ratio.value = GLUE_RATIO;
  glue.attack.value = GLUE_ATTACK_S;
  glue.release.value = GLUE_RELEASE_S;
  glue.knee.value = GLUE_KNEE_DB;
  // Unity static gain: cancel the compressor's built-in makeup before the clip.
  const trim = context.createGain();
  trim.gain.value = Math.pow(10, GLUE_MAKEUP_COMP_DB / 20);
  const softClip = context.createWaveShaper();
  softClip.curve = tanhDriveCurve(SOFTCLIP_K);
  softClip.oversample = '2x';
  glue.connect(trim);
  trim.connect(softClip);
  softClip.connect(next);
  return glue;
}

/**
 * The Stage 2 safety device: a 20:1 compressor at -6 dB with a 3 ms attack —
 * only a runaway sum reaches it — followed by the trim that cancels Chrome's
 * baked makeup for this curve (SAFETY_MAKEUP_COMP_DB, measured) and the named
 * reference gain the pre-Stage-2 tail carried (TAIL_REFERENCE_GAIN_DB, measured),
 * so the tail's static gain at bare and colour level is unchanged. Returns the
 * stage's input.
 */
function createSafetyStage(context: BaseAudioContext, next: AudioNode, bypass: MixTailBypass): AudioNode {
  const trim = context.createGain();
  const trimDb =
    (bypass.safetyTrim ? 0 : SAFETY_MAKEUP_COMP_DB) + (bypass.referenceGain ? 0 : TAIL_REFERENCE_GAIN_DB);
  trim.gain.value = Math.pow(10, trimDb / 20);
  trim.connect(next);
  if (bypass.safety) return trim;
  const safety = context.createDynamicsCompressor();
  safety.threshold.value = SAFETY_THRESH_DB;
  safety.ratio.value = SAFETY_RATIO;
  safety.knee.value = SAFETY_KNEE_DB;
  safety.attack.value = SAFETY_ATTACK_S;
  safety.release.value = SAFETY_RELEASE_S;
  safety.connect(trim);
  return safety;
}

/**
 * The Stage 2 true-peak limiter, honestly described: Chrome's DynamicsCompressor
 * at 20:1 with a hard knee, 1 ms attack and 80 ms release at the true-peak
 * target (a look-ahead limiter in effect — the node carries a fixed pre-delay),
 * its baked makeup cancelled by LIM_MAKEUP_COMP_DB, then a 4×-oversampled
 * WaveShaper ceiling whose asymptote sits at CEILING_DBTP. The compressor does
 * the programme-level protection; the ceiling bounds what its attack lets by.
 * The 4× oversampled analyser measures the result (see evidence/stage-2).
 */
function createLimiterStage(context: BaseAudioContext, from: AudioNode, bypass: MixTailBypass): AudioNode {
  let head: AudioNode = from;
  if (!bypass.limiter) {
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = LIM_THRESH_DB;
    limiter.ratio.value = LIM_RATIO;
    limiter.knee.value = LIM_KNEE_DB;
    limiter.attack.value = LIM_ATTACK_S;
    limiter.release.value = LIM_RELEASE_S;
    head.connect(limiter);
    head = limiter;
  }
  const trim = context.createGain();
  trim.gain.value = Math.pow(10, (bypass.limiterTrim || bypass.limiter ? 0 : LIM_MAKEUP_COMP_DB) / 20);
  head.connect(trim);
  head = trim;
  if (!bypass.ceiling) {
    const ceiling = context.createWaveShaper();
    ceiling.curve = ceilingCurve(Math.pow(10, CEILING_DBTP / 20), CEILING_SOFTNESS);
    ceiling.oversample = CEILING_OVERSAMPLE;
    head.connect(ceiling);
    head = ceiling;
  }
  return head;
}

/** Literal, start-anchored gain automation for the SFX muffle (the shipped linear snap). */
function linearRampParam(param: AudioParam, value: number, atTime: number, seconds: number): void {
  const at = Math.max(0, atTime);
  const hold = param.cancelAndHoldAtTime;
  if (typeof hold === 'function') {
    hold.call(param, at);
  } else {
    param.cancelScheduledValues(at);
  }
  param.setValueAtTime(param.value, at);
  param.linearRampToValueAtTime(value, at + Math.max(AUDIO_PARAM_MIN_SLEW_S, seconds));
}

function scheduleSfxSubmerge(tail: MixTail, submerged: boolean, atTime: number): void {
  linearRampParam(
    tail.sfxSubmergeFilter.frequency,
    submerged ? SFX_SUBMERGE_MUFFLED_HZ : SFX_SUBMERGE_OPEN_HZ,
    atTime,
    submerged ? SFX_SUBMERGE_ENTER_SLEW_S : SFX_SUBMERGE_EXIT_SLEW_S
  );
}

function scheduleDuck(tail: MixTail, source: DuckSource, state: ScoreState, atTime: number): void {
  const row = resolveDuck(source, state);
  for (const bus of Object.keys(row) as MixBus[]) {
    const shape = row[bus];
    if (!shape) continue;
    const param = bus === 'music' ? tail.musicDuck.gain : tail.buses[bus].duck.gain;
    const points = duckEnvelopePoints(shape, 1).map((p) => ({ offsetSeconds: p.offsetS, value: p.gain }));
    // A re-trigger mid-duck re-anchors at the current gain and dives again.
    scheduleMusicSceneEnvelopeParam(param, atTime, points, Math.min(1, param.value));
  }
}

function applySnapshotGains(
  context: BaseAudioContext,
  tail: MixTail,
  snapshot: MixSnapshot,
  atTime: number,
  slewSeconds: number
): void {
  void context;
  for (const bus of MIX_BUSES) {
    if (bus === 'music') continue; // the snapshot never re-levels music (law)
    rampParamAt(tail.buses[bus].gain.gain, dbToGain(Math.min(0, snapshot.busGainDb[bus])), atTime, slewSeconds);
  }
}

/** Build a convolver buffer from the shared pure impulse generator. */
export function makeImpulseBuffer(
  context: BaseAudioContext,
  spec: Omit<ImpulseSpec, 'sampleRate'>
): AudioBuffer {
  const channels = makeImpulseResponse({ ...spec, sampleRate: context.sampleRate });
  const buffer = context.createBuffer(channels.length, channels[0].length, context.sampleRate);
  channels.forEach((data, ch) => buffer.copyToChannel(data, ch));
  return buffer;
}

/**
 * The one-pole colouring a seeded noise buffer is shaped by. The music curve
 * is brown-ish air/sea texture; the SFX bus keeps its own brighter curve
 * (sfxEngine.SFX_NOISE_CURVE) so the shared generator can serve both without
 * either changing what it sounds like.
 */
export interface NoiseCurve {
  memory: number;
  excitation: number;
  outputGain: number;
}

/** The music bus's noise colour — the historic makeNoiseBuffer behaviour. */
export const MUSIC_NOISE_CURVE: NoiseCurve = {
  memory: NOISE_MEMORY,
  excitation: NOISE_EXCITATION,
  outputGain: NOISE_OUTPUT_GAIN
};

export function makeNoiseBuffer(
  context: BaseAudioContext,
  seconds: number,
  seed = DEFAULT_NOISE_SEED,
  curve: NoiseCurve = MUSIC_NOISE_CURVE
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
    sample = sample * curve.memory + (unit() * 2 - 1) * curve.excitation;
    data[i] = sample * curve.outputGain;
  }
  return buffer;
}
import { SFX_ROOM_CROSSFADE_S, SFX_ROOM_PRESETS, sfxRoomForTier, type SfxRoomWeights } from './sfx/roomPresets.ts';
import type { RoomPresetId } from './mix/mixSnapshot.ts';
