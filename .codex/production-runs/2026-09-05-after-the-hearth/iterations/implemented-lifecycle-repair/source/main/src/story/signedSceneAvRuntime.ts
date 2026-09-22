import generatedContract from './generatedSceneAvRuntime.json';
import {
  armStoryHit,
  bundlePresentationDue,
  fireStoryHitFallback,
  getStoryScoreMood,
  noteStoryBundleFired,
  noteStoryBundleState,
  setScoreIntensity
} from './storyScore.ts';
import { SANDBOX_FOV, setStoryTargetFov } from './storyInputPolicy.ts';
import {
  subscribeEmergentStoryEvents,
  type EmergentStoryEvent
} from './emergentStoryEvents.ts';
import type { StoryBeat } from './storyState.ts';
import {
  compileSceneAvContract,
  sampleSceneAvRail,
  type CompiledSceneAvRail,
  type SceneAvCueEasing
} from './sceneAvCueRail.ts';
import { getLocalActorId } from '../game/playerActors.ts';
import { hasMilestone } from '../game/systems/progressionSystem.ts';
import {
  EMERGENT_AUDIT_MILESTONES,
  FIELD_PACK_DROPPED_MILESTONE
} from './emergentAudit.ts';
import { EMERGENT_MAW_MILESTONES } from './emergentMawRepair.ts';
import { AUTHORED_DIVE_MILESTONES } from './emergentDive.ts';
import { EMERGENT_UNIQUE_ITEM_MILESTONES } from './emergentUniqueItems.ts';
import {
  CH10_ANCHOR_INTENSITY,
  setEmergentScorePaused
} from './emergentScoreDirector.ts';

export const SIGNED_SCENE_AV_SHA256 =
  '3367b94f9f0fcef14b6158f61e5cd3e3262afa3ae86b4b9574803e3ac48bb47e';
export const SIGNED_SCENE_AV_REVISION = 'intent-v1';
/**
 * The rail now carries two signed contracts. The A4→ch9 contract above remains
 * the rail's identity (`source`); chapter 10 is registered beside it, and every
 * signed contract the generated runtime derives from must appear here with its
 * exact bytes or the runtime refuses to load.
 */
export const CH10_SCENE_AV_SHA256 =
  '0336a4f28bfaa874fffc300f02999e329dbed86d3cdcd53cf7ce3261c48639b1';
export const CH10_SCENE_AV_REVISION = 'draft-v9';
/** Common Ground, ch13. Signed 2026-09-06 by all three directors on scene-v2. */
export const CH13_SCENE_AV_SHA256 =
  '4dbf722b308b92b170313285854e3c9c2abac853b3407bf3e0f4efccfddff88e';
export const CH13_SCENE_AV_REVISION = 'scene-v2';
export const SIGNED_SCENE_AV_SOURCES: readonly {
  readonly sceneId: string;
  readonly contractVersion: string;
  readonly sha256: string;
}[] = Object.freeze([
  Object.freeze({
    sceneId: 'distance-between-fires',
    contractVersion: SIGNED_SCENE_AV_REVISION,
    sha256: SIGNED_SCENE_AV_SHA256
  }),
  Object.freeze({
    sceneId: 'ch10-station-introduction',
    contractVersion: CH10_SCENE_AV_REVISION,
    sha256: CH10_SCENE_AV_SHA256
  }),
  Object.freeze({
    sceneId: 'common-ground',
    contractVersion: CH13_SCENE_AV_REVISION,
    sha256: CH13_SCENE_AV_SHA256
  })
]);
/**
 * 66 anchors from the A4→ch9 contract, chapter 10's exactly ten, and chapter
 * 13's exactly twenty-eight. The census is asserted rather than derived: a
 * regenerated runtime that quietly lost a chapter must fail to load, not run.
 */
const SIGNED_SCENE_AV_ANCHOR_COUNT = 104;

interface SignedAnchor {
  id: string;
  beat: string;
  order: number;
  event: string;
  source: string;
  storyEventRef: string;
  scoreCueRefs: string[];
  shotRefs: string[];
}

interface SignedPostEffect {
  id: string;
  verb: string;
  entryAnchorRef: string;
  exitAnchorRef: string;
  reducedMotion: boolean;
  lowTierFallback: string;
  resetRef: string;
}

interface SignedShot {
  id: string;
  beat: string;
  startAnchorRef: string;
  endAnchorRef: string;
  cameraAuthority: string;
  lens: {
    startFovDeg: number;
    endFovDeg: number;
    durationMs: number;
    easing: string;
    focusTarget: string;
  };
  transition: {
    type: string;
    declaredCut: boolean;
    durationMs: number;
  };
  effects: {
    realityStage: string;
    effectCeiling: string[];
    grade: { presetRef: string | null; resetRef: string };
    lighting: { resetRef: string };
    postEffects: SignedPostEffect[];
  };
  agency: {
    movement: string;
    look: string;
    interaction: string;
    handBackAnchorRef: string;
  };
  resetRef: string;
}

interface SignedScoreCue {
  id: string;
  type: string;
  anchorRef: string;
  relation: string;
  offsetMs: number;
  mixIntent: string;
  resetRef: string;
}

interface SignedSceneAvSource {
  sceneId: string;
  contractVersion: string;
  sha256: string;
  status: string;
}

interface SignedSceneAvContract {
  schema: string;
  source: SignedSceneAvSource;
  sources: SignedSceneAvSource[];
  beats: string[];
  anchors: SignedAnchor[];
  shots: SignedShot[];
  scoreCues: SignedScoreCue[];
  reset: {
    triggers: string[];
    states: Array<{
      id: string;
      domain: string;
      resetValue: string;
      triggers: string[];
    }>;
    sandboxNoOpRequired: boolean;
  };
}

export type SignedSceneAvResetReason =
  | 'beat-exit'
  | 'deep-link'
  | 'replay'
  | 'pause'
  | 'quit'
  | 'focus-loss'
  | 'world-transfer'
  | 'completion'
  | 'sandbox';

export interface SignedSceneAvDebugSnapshot {
  sceneId: string;
  contractRevision: string;
  contractSha256: string;
  contractAnchorCount: number;
  active: boolean;
  suspended: boolean;
  beat: StoryBeat | null;
  anchorId: string | null;
  anchorEvent: string | null;
  activationSource: 'beat-boundary' | 'story-event' | 'semantic-event' | null;
  activationSequence: number;
  /** Unique signed anchors observed in this Story run, retained through completion. */
  activationHistoryAnchorIds: string[];
  activatedAnchorIds: string[];
  shot: null | {
    id: string;
    cameraAuthority: string;
    transitionType: string;
    declaredCut: boolean;
    lens: {
      startFovDeg: number;
      endFovDeg: number;
      durationMs: number;
      elapsedMs: number;
      appliedFovDeg: number | null;
      reducedMotion: boolean;
    };
    agency: SignedShot['agency'];
  };
  score: {
    cueRefs: string[];
    intensity: number | null;
    hit: 'bloom' | null;
  };
  postFx: {
    activeEffectIds: string[];
    supportMix: number;
    lowTierFallbacks: string[];
    reducedMotion: boolean;
  };
  lastResetReason: SignedSceneAvResetReason | null;
}

export interface SignedScenePostFxCueState {
  readonly activeEffectIds: readonly string[];
  readonly supportMix: number;
  readonly lowTierFallbacks: readonly string[];
  readonly reducedMotion: boolean;
}

const contract = generatedContract as SignedSceneAvContract;
if (
  contract.schema !== 'paravoxia.sceneAvRuntime.v1'
  || contract.source.contractVersion !== SIGNED_SCENE_AV_REVISION
  || contract.source.sha256 !== SIGNED_SCENE_AV_SHA256
  || contract.anchors.length !== SIGNED_SCENE_AV_ANCHOR_COUNT
  || contract.sources.length !== SIGNED_SCENE_AV_SOURCES.length
  || SIGNED_SCENE_AV_SOURCES.some((expected, index) => (
    contract.sources[index]?.sceneId !== expected.sceneId
    || contract.sources[index]?.contractVersion !== expected.contractVersion
    || contract.sources[index]?.sha256 !== expected.sha256
  ))
) {
  throw new Error('Generated scene AV runtime does not match its frozen signed contracts.');
}

const anchorsById = new Map(contract.anchors.map(anchor => [anchor.id, anchor]));
const shotsById = new Map(contract.shots.map(shot => [shot.id, shot]));
const scoreCuesById = new Map(contract.scoreCues.map(cue => [cue.id, cue]));
const entryAnchorsByBeat = new Map<string, SignedAnchor>();
const anchorsByBeat = new Map<string, SignedAnchor[]>();
for (const anchor of contract.anchors) {
  const entries = anchorsByBeat.get(anchor.beat) ?? [];
  entries.push(anchor);
  anchorsByBeat.set(anchor.beat, entries);
}
for (const entries of anchorsByBeat.values()) {
  entries.sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
}

// Beat entry is not evidence that a physical action happened. Only these five
// symbolic boundaries are allowed to enter the rail without a runtime fact.
// In particular: hatch entry, ignition, atmosphere exit, approach, landfall
// handback, and shelter certification must come from their physical producers.
const SYMBOLIC_BEAT_BOUNDARY_ANCHORS: Readonly<Record<string, string>> = Object.freeze({
  'ch4-audit': 'anc.audit.arrival-handback',
  'ch4-comply': 'anc.comply.fire-order',
  'ch4-defy': 'anc.defy.tree-order',
  'a4-exhale': 'anc.a4.held-stillness',
  'ch5-maw': 'anc.a4.handback',
  // ch10-cold's entry anchor IS the re-activation: the fault is noticed at the
  // boundary itself, and nothing physical precedes it inside the beat.
  'ch10-cold': 'anc.ch10.cold-noticed'
});
for (const [beat, anchorId] of Object.entries(SYMBOLIC_BEAT_BOUNDARY_ANCHORS)) {
  const entryAnchor = anchorsById.get(anchorId);
  if (!entryAnchor) throw new Error(`Unknown symbolic beat-boundary anchor ${anchorId}.`);
  entryAnchorsByBeat.set(beat, entryAnchor);
}

const listeners = new Set<() => void>();
type SignedSceneAvPauseReason =
  | 'pause'
  | 'focus-loss'
  | 'window-blur'
  | 'document-hidden';
const pauseReasons = new Set<SignedSceneAvPauseReason>();
let installed = false;
let activeBeat: StoryBeat | null = null;
let activeAnchor: SignedAnchor | null = null;
let activeShot: SignedShot | null = null;
let activeLensRail: CompiledSceneAvRail | null = null;
let lensElapsedMs = 0;
let appliedFovDeg: number | null = null;
let activeScoreIntensity: number | null = null;
let activeScoreHit: 'bloom' | null = null;
/**
 * anc.maw.repair-answer (audio-10x Stage 3): the receipt and commit are
 * immediate (the caller's arming tick); the Maw's ANSWER — the bloom, the
 * intensity step and the anchor's entry post-effects — chases the returned grid
 * time as one bundle. Beat-runtime clock; pause suspends it with the context.
 */
let pendingScoreAnswer: { anchorId: 'anc.maw.repair-answer'; intensity: number | null; dueMs: number; audibleAudioTime: number | null; fallback: boolean } | null = null;
let runtimeClockMs = 0;
let activationSource: SignedSceneAvDebugSnapshot['activationSource'] = null;
let activationSequence = 0;
let lastResetReason: SignedSceneAvResetReason | null = null;
const activationHistoryAnchorIds = new Set<string>();
const activatedAnchorIds = new Set<string>();
let postFxCueState: SignedScenePostFxCueState = Object.freeze({
  activeEffectIds: Object.freeze([]) as readonly string[],
  supportMix: 0,
  lowTierFallbacks: Object.freeze([]) as readonly string[],
  reducedMotion: false
});

function reducedMotionPreferred(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function publish(): void {
  const snapshot = getSignedSceneAvDebugSnapshot();
  if (typeof window !== 'undefined') {
    (window as unknown as { __paravoxiaSceneAv?: SignedSceneAvDebugSnapshot })
      .__paravoxiaSceneAv = snapshot;
  }
  for (const listener of listeners) listener();
}

function currentPostEffects(): SignedPostEffect[] {
  if (!activeShot || pauseReasons.size > 0) return [];
  // The repair answer's own entry effects are members of the answer bundle and
  // wait for it; every other effect keeps its shipped activation tick.
  const answerHeld = pendingScoreAnswer != null && activeAnchor?.id === 'anc.maw.repair-committed';
  return activeShot.effects.postEffects.filter(effect => (
    (effect.entryAnchorRef === activeAnchor?.id && !answerHeld)
    || (effect.entryAnchorRef !== effect.exitAnchorRef && effect.entryAnchorRef === activeShot?.startAnchorRef)
  ));
}

function refreshPostFxCueState(): void {
  const effects = currentPostEffects();
  postFxCueState = Object.freeze({
    activeEffectIds: Object.freeze(effects.map(effect => effect.id)),
    supportMix: effects.length > 0 ? 1 : 0,
    lowTierFallbacks: Object.freeze(effects.map(effect => effect.lowTierFallback)),
    reducedMotion: reducedMotionPreferred()
  });
}

function resetScoreOverlay(): void {
  const mood = activeBeat ? getStoryScoreMood(activeBeat) : null;
  if (mood) setScoreIntensity(mood.baseline);
  activeScoreIntensity = mood?.baseline ?? null;
  activeScoreHit = null;
  pendingScoreAnswer = null;
}

function resetTransientOwners(reason: SignedSceneAvResetReason): void {
  setStoryTargetFov(SANDBOX_FOV);
  appliedFovDeg = null;
  resetScoreOverlay();
  lastResetReason = reason;
}

function signedLensEasing(easing: string): SceneAvCueEasing {
  const normalized = easing.toLowerCase();
  if (normalized.includes('linear')) return 'linear';
  if (normalized.includes('ease-in') && !normalized.includes('ease-out')) return 'ease_in';
  if (normalized.includes('ease-out') && !normalized.includes('ease-in')) return 'ease_out';
  return 'smoothstep';
}

function numericLensAuthorized(shot: SignedShot): boolean {
  // The inherited audit handback is deliberately symbolic: its equal 50-degree
  // fields are schema mirrors, not permission to overwrite the live camera.
  if (shot.id === 'cin.audit.01-inherited-world') return false;
  // Vehicle lens rigs remain owned by the real flight feedback controller.
  return shot.cameraAuthority !== 'lens-rig';
}

function createLensRail(shot: SignedShot, anchor: SignedAnchor): CompiledSceneAvRail | null {
  if (!numericLensAuthorized(shot) || shot.lens.durationMs <= 0) return null;
  return compileSceneAvContract({
    sceneId: shot.id,
    revision: contract.source.contractVersion,
    anchors: [{ id: anchor.id, timeSeconds: 0 }],
    cues: [{
      id: `${shot.id}:fov`,
      channel: 'fov',
      owner: 'cinematography',
      anchorId: anchor.id,
      durationSeconds: shot.lens.durationMs / 1000,
      from: shot.lens.startFovDeg,
      to: shot.lens.endFovDeg,
      easing: signedLensEasing(shot.lens.easing),
      reducedMotion: reducedMotionLensHold(shot)
    }]
  });
}

function applyLens(): void {
  if (!activeShot || pauseReasons.size > 0 || !numericLensAuthorized(activeShot)) {
    appliedFovDeg = null;
    return;
  }
  const reducedMotion = reducedMotionPreferred();
  const lens = activeShot.lens;
  const durationMs = Math.max(0, lens.durationMs);
  const sampled = activeLensRail && lensElapsedMs < durationMs
    ? sampleSceneAvRail(activeLensRail, lensElapsedMs / 1000, { reducedMotion }).fov
    : null;
  appliedFovDeg = sampled?.amount
    ?? (reducedMotion ? reducedMotionLensHold(activeShot).to : lens.endFovDeg);
  setStoryTargetFov(appliedFovDeg);
}

/**
 * What reduced motion HOLDS instead of easing.
 *
 * Skipping a lens move is an accessibility promise about MOTION, not a licence
 * to change what the frame contains. For a dramatic push the neutral sandbox
 * FOV is right — the move was the effect, so not moving means not doing it.
 * Chapter 10's transit FOV is not an effect: 70 is the vehicle's own state, the
 * fact of sitting in a cockpit, and holding 75 there made MEDIUM with reduced
 * motion frame the station differently from every other profile. Reduced motion
 * still skips the EASE — from and to are equal, so nothing animates — it just
 * skips it to the value the shot actually lands on.
 *
 * Scoped to ch10 deliberately: the shipped ch1-ch9 shots keep their existing
 * reduced-motion behaviour byte-for-byte.
 */
function reducedMotionLensHold(shot: SignedShot): { from: number; to: number } {
  if (!shot.beat.startsWith('ch10')) return { from: SANDBOX_FOV, to: SANDBOX_FOV };
  return { from: shot.lens.endFovDeg, to: shot.lens.endFovDeg };
}

function scoreIntensityFor(anchor: SignedAnchor): number | null {
  // Chapter 10 publishes its ladder explicitly rather than deriving one from
  // anchor position: the contract pins a value per anchor and names this
  // function as the single authority for every intensity claim it makes.
  if (anchor.beat.startsWith('ch10')) return CH10_ANCHOR_INTENSITY[anchor.id] ?? null;
  // Chapter 7's score follows committed repair and boarding facts. Its signed
  // anchors still own camera/PostFX evidence, but may not manufacture a second
  // time/index-based intensity progression over the gameplay-derived mix.
  if (anchor.beat === 'ch7-reconstruct' || anchor.beat === 'ch7-board') return null;
  // Chapter 13 is the same case and for a sharper reason. Its texture is chosen
  // by the chapter's own physical facts through the existing mood facade, and
  // several of its anchors are deliberately SILENT — the guide appearing, the
  // preparation copy becoming the ready copy, a body stepping out of a reference.
  // An index-derived ladder would turn every one of those into a rise in
  // intensity, which is precisely the acknowledgement the signed lane says those
  // moments do not get.
  if (anchor.beat.startsWith('ch13')) return null;
  const mood = activeBeat ? getStoryScoreMood(activeBeat) : null;
  if (!mood || anchor.scoreCueRefs.length === 0) return null;
  const beatAnchors = anchorsByBeat.get(activeBeat ?? anchor.beat) ?? [anchor];
  const progress = beatAnchors.length <= 1
    ? 1
    : Math.max(0, beatAnchors.indexOf(anchor)) / (beatAnchors.length - 1);
  if (anchor.beat === 'ch4-audit' || anchor.beat === 'ch4-comply') {
    return mood.baseline * (1 - progress * 0.45);
  }
  if (anchor.beat === 'ch4-defy') return mood.baseline * (1 - progress * 0.65);
  return mood.baseline * (0.75 + progress * 0.25);
}

function scoreHitFor(anchor: SignedAnchor): 'bloom' | null {
  // The unresolved opening belongs to the atomic repair receipt. First
  // direction is deliberately unstung: use and withholding remain choices,
  // not a success state the score is allowed to judge.
  return anchor.id === 'anc.maw.repair-committed' ? 'bloom' : null;
}

function applyScore(anchor: SignedAnchor, allowHit: boolean): void {
  const intensity = scoreIntensityFor(anchor);
  const hit = allowHit ? scoreHitFor(anchor) : null;
  if (hit) {
    // The commit and its receipt fired on this tick (the caller). Only the
    // answer takes a breath: bloom + intensity step + entry effects at bundleAt.
    const arm = armStoryHit('anc.maw.repair-answer', { beatClock: runtimeClockMs / 1000 });
    noteStoryBundleState('anc.maw.repair-answer', runtimeClockMs / 1000);
    pendingScoreAnswer = {
      anchorId: 'anc.maw.repair-answer',
      intensity,
      dueMs: runtimeClockMs + arm.bundleDelayS * 1000,
      audibleAudioTime: arm.audibleAudioTime,
      fallback: arm.fallback
    };
    activeScoreHit = null;
    return;
  }
  if (pendingScoreAnswer) return; // a resume re-apply must not pre-empt the pending answer
  activeScoreIntensity = intensity;
  if (intensity != null) setScoreIntensity(intensity);
  activeScoreHit = null;
}

/** The answer bundle fires on the first tick at or past its target (late on a hitch, never early). */
function tickPendingScoreAnswer(): void {
  if (!pendingScoreAnswer) return;
  if (!bundlePresentationDue(runtimeClockMs / 1000, pendingScoreAnswer.dueMs / 1000, pendingScoreAnswer.audibleAudioTime)) return;
  const answer = pendingScoreAnswer;
  pendingScoreAnswer = null;
  activeScoreIntensity = answer.intensity;
  if (answer.intensity != null) setScoreIntensity(answer.intensity);
  activeScoreHit = 'bloom';
  if (answer.fallback) fireStoryHitFallback(answer.anchorId);
  noteStoryBundleFired(answer.anchorId, runtimeClockMs / 1000);
  refreshPostFxCueState();
  publish();
}

function activateAnchor(
  anchor: SignedAnchor,
  source: Exclude<SignedSceneAvDebugSnapshot['activationSource'], null>,
  allowHit = true
): boolean {
  if (!activeBeat || activatedAnchorIds.has(anchor.id)) return false;
  const isBeatEntry = source === 'beat-boundary'
    && entryAnchorsByBeat.get(activeBeat)?.id === anchor.id;
  if (anchor.beat !== activeBeat && !isBeatEntry) return false;
  const currentOrder = activeAnchor?.beat === activeBeat ? activeAnchor.order : -Infinity;
  const isLateDirectReceipt = anchor.order < currentOrder
    && isDirectReceiptAnchor(anchor);
  // Direct observations are a parallel sensory rail, not prerequisites for the
  // physical transaction. A fast diver may reveal the Keel before oxygen falls
  // through 75, then legitimately receive the body-clock cue later.
  if (anchor.order < currentOrder && !isLateDirectReceipt) return false;
  const beatAnchors = anchorsByBeat.get(activeBeat) ?? [];
  const earlierRequiredAnchorPending = beatAnchors.some(candidate => (
    candidate.order < anchor.order && stillWaitingOn(candidate, anchor)
  ));
  if (earlierRequiredAnchorPending) return false;
  if (!isBeatEntry && !isOptionalAnchor(anchor) && !isDirectReceiptAnchor(anchor)
    && !CONDITIONAL_ANCHORS.has(anchor.id)) {
    const nextRequiredAnchor = beatAnchors.find(candidate => stillWaitingOn(candidate, anchor));
    if (nextRequiredAnchor?.id !== anchor.id) return false;
  }
  if (isLateDirectReceipt) {
    // Preserve evidence ordering without rewinding an already newer physical
    // shot (potentially the dry-shore handoff) back to underwater language.
    activationSequence += 1;
    activationHistoryAnchorIds.add(anchor.id);
    activatedAnchorIds.add(anchor.id);
    publish();
    return true;
  }
  activeAnchor = anchor;
  activeShot = anchor.shotRefs.map(ref => shotsById.get(ref)).find(Boolean) ?? null;
  activeLensRail = activeShot ? createLensRail(activeShot, anchor) : null;
  lensElapsedMs = 0;
  appliedFovDeg = null;
  activationSource = source;
  activationSequence += 1;
  activationHistoryAnchorIds.add(anchor.id);
  activatedAnchorIds.add(anchor.id);
  applyLens();
  applyScore(anchor, allowHit && pauseReasons.size === 0);
  refreshPostFxCueState();
  publish();
  return true;
}

const RELOCATED_OPTIONAL_ANCHORS = new Set([
  // Kept readable for legacy saves/contracts, but new runs earn their optional
  // jetpack exploration above the chosen Tidegarden site. Route readiness may
  // therefore advance directly from the installed Lift Cell.
  'anc.reconstruct.first-hover'
]);

function isOptionalAnchor(anchor: SignedAnchor): boolean {
  return anchor.event.endsWith(':optional')
    || RELOCATED_OPTIONAL_ANCHORS.has(anchor.id);
}

/**
 * Signed anchors that MAY NOT HAPPEN, and therefore cannot be prerequisites.
 *
 * Ordering is the invariant that makes a physical transaction inspectable, and
 * none of it is removed here: an anchor listed below still has its signed order,
 * still cannot rewind an already newer shot, and still fires only from its real
 * producer. What is corrected is a category error — treating an event the
 * contract itself declares conditional as a gate every LATER event must wait
 * behind. When the condition does not occur, the rest of the beat is refused
 * forever, and the local producer spends its one-shot latch on the refusal.
 *
 * Each id is here because the signed scene-v2 contract says so, in these words:
 *
 *   `anc.cg.cell-installed` — "/syncAnchors/0" is "the actual live install
 *     receipt from the prior station-continuation contract", and its acceptance
 *     criterion states that "a hydrated entry is steady and silent and consumes
 *     no second cell". A restored save or a valid deep link therefore CANNOT
 *     produce it, while "/syncAnchors/1" (home-steady) must still "restore the
 *     steady home variant on hydrated entry" and "/guidance/objectives/0" must
 *     still reach the review objective "without replaying the transaction".
 *     Measured (VF-ANCHOR-OBS-1): a hydrated ch13-home performed both real F
 *     acts and set both milestones while no home anchor ever activated.
 *
 *   `anc.cg.revision-ready` and the eight anchors whose signed event text begins
 *     "Contingent:" — "/syncAnchors/12" says "No refusal is required, no F has
 *     committed yet ... A valid current route may remain unchanged";
 *     "/syncAnchors/13" says "any supported route, including the measured long
 *     route, may complete without this anchor. Do not force failure"; and
 *     "/syncAnchors/19" says "first-try success is legal". A first-try legal
 *     route would otherwise never reach route-tested, and a common span walked
 *     without a reference lapse would never reach `anc.cg.complete`.
 *
 * `signedSceneAvRuntime.test.ts` asserts this set against the compiled contract
 * so a future anchor cannot drift out of it silently.
 */
const CONDITIONAL_ANCHORS: ReadonlySet<string> = new Set([
  'anc.cg.cell-installed',
  'anc.cg.revision-ready',
  'anc.cg.specific-hold',
  'anc.cg.witness-held',
  'anc.cg.witness-vacated',
  'anc.cg.test-resumed',
  'anc.cg.tail-reopened',
  'anc.cg.route-revised',
  'anc.cg.reference-vacated',
  'anc.cg.reference-resumed'
]);

/** True when the contract declares this anchor conditional rather than required. */
export function isConditionalSignedAnchor(anchorId: string): boolean {
  return CONDITIONAL_ANCHORS.has(anchorId);
}

/**
 * Durable receipts that make a REQUIRED anchor's event ALREADY TRUE.
 *
 * A beat entry clears `activatedAnchorIds`, which is right: this runtime's
 * ledger is per-entry, and an anchor that did not happen in this session did not
 * happen in this session. But "not in this ledger" is not the same as "has not
 * happened", and conflating them makes a mid-beat Continue refuse the NEXT
 * action: a save taken after the fault review and reloaded before the return
 * choice has the review's receipt in the milestone ledger, must not replay it,
 * and must still be able to publish the return choice the player actually makes.
 *
 * This map is consulted ONLY to answer "is that predecessor still pending?".
 * It never activates anything, writes no activation history, replays no cue or
 * shot, and manufactures no receipt: an anchor whose event is already true is
 * simply not a thing later anchors are waiting for. The ids are the chapter's
 * own committed milestones, the same strings its director marks.
 */
const RECEIPT_SATISFIED_ANCHORS: Readonly<Record<string, string>> = Object.freeze({
  // Each anchor's own committed receipt.
  'anc.cg.fault-reviewed': 'story:ch13-fault-reviewed',
  'anc.cg.return-chosen': 'story:ch13-return-chosen',
  'anc.cg.origin-landed': 'story:ch13-origin-landed',
  'anc.cg.route-tested': 'story:ch13-route-tested',
  'anc.cg.reciprocal-crossed': 'story:ch13-reciprocal-crossed',
  'anc.cg.complete': 'story:ch13-complete',
  // And the legal transaction chain each of those receipts IMPLIES, by the same
  // doctrine `progressionAnchorsForBeat` already states: a later durable receipt
  // implies every earlier physical receipt that had to precede it. These are
  // implications of the chapter's own predicates, not conveniences:
  //   the Origin landing cannot exist without the boarding and the lift;
  'anc.cg.hatch-boarded': 'story:ch13-origin-landed',
  'anc.cg.lift-committed': 'story:ch13-origin-landed',
  //   an ACCEPTED, tested route cannot exist without the inspection that opened
  //   it, the offer, the grounded start, the drawn trace and the offered span;
  'anc.cg.repeated-measure': 'story:ch13-route-tested',
  'anc.cg.demonstration-opened': 'story:ch13-route-tested',
  'anc.cg.survey-started': 'story:ch13-route-tested',
  'anc.cg.trace-drawn': 'story:ch13-route-tested',
  'anc.cg.route-offered': 'story:ch13-route-tested',
  //   her eighteen-unit crossing is only creditable while he MAINTAINS the
  //   reference at H, so the crossing's receipt implies he reached it;
  'anc.cg.reciprocal-reference': 'story:ch13-reciprocal-crossed',
  //   and the completion implies her far-reference offer and his own test.
  'anc.cg.final-reference-offered': 'story:ch13-complete',
  'anc.cg.independent-test': 'story:ch13-complete'
});

function anchorReceiptAlreadyHeld(anchor: SignedAnchor): boolean {
  const milestone = RECEIPT_SATISFIED_ANCHORS[anchor.id];
  return milestone != null && hasMilestone(milestone, getLocalActorId());
}

function progressionEntryForAnchor(anchor: SignedAnchor): ProgressionAnchor | undefined {
  if (!activeBeat) return undefined;
  return progressionAnchorsForBeat(activeBeat).find(entry => entry.anchorId === anchor.id);
}

function isDirectReceiptAnchor(anchor: SignedAnchor): boolean {
  return progressionEntryForAnchor(anchor)?.directReceiptRequired === true;
}

function isMissingDirectReceiptAnchor(anchor: SignedAnchor): boolean {
  const entry = progressionEntryForAnchor(anchor);
  return entry?.directReceiptRequired === true
    && !hasMilestone(entry.milestone, getLocalActorId());
}

function isPendingOrderedAnchor(anchor: SignedAnchor): boolean {
  return !isOptionalAnchor(anchor)
    && !isMissingDirectReceiptAnchor(anchor)
    && !CONDITIONAL_ANCHORS.has(anchor.id);
}

/**
 * Is `candidate` something `activating` still has to wait for?
 *
 * An anchor is never a prerequisite for ITSELF: its own receipt is committed
 * immediately before it is published, which is the correct order, and reading
 * that as "already satisfied, therefore not the next required one" would refuse
 * the very act that just happened.
 */
function stillWaitingOn(candidate: SignedAnchor, activating: SignedAnchor): boolean {
  if (candidate.id === activating.id) return true;
  if (!isPendingOrderedAnchor(candidate)) return false;
  if (activatedAnchorIds.has(candidate.id)) return false;
  return !anchorReceiptAlreadyHeld(candidate);
}

interface ProgressionAnchor {
  anchorId: string;
  milestone: string;
  /**
   * This beat is observational, not implied by a later transaction receipt and
   * never a prerequisite for that transaction's physical anchors.
   */
  directReceiptRequired?: boolean;
}

/**
 * A later durable receipt implies every earlier physical receipt in its legal
 * transaction chain. Rebuild those presentation anchors after reload and when
 * an online authority delta arrives without replaying score hits or effects as
 * if the action had just happened.
 */
function progressionAnchorsForBeat(beat: StoryBeat): readonly ProgressionAnchor[] {
  if (beat === 'a4-exhale') return [
    { anchorId: 'anc.a4.life-front', milestone: EMERGENT_AUDIT_MILESTONES.a4Alive },
    { anchorId: 'anc.a4.pond-wakes', milestone: EMERGENT_AUDIT_MILESTONES.a4PondVisible },
    { anchorId: 'anc.a4.herd-crest', milestone: EMERGENT_AUDIT_MILESTONES.a4HerdVisible },
    { anchorId: 'anc.a4.w7744-flight', milestone: EMERGENT_AUDIT_MILESTONES.a4WorkerFlight },
    { anchorId: 'anc.a4.pack-torn', milestone: FIELD_PACK_DROPPED_MILESTONE }
  ];
  if (beat === 'ch5-maw') return [
    { anchorId: 'anc.maw.pack-attended', milestone: EMERGENT_UNIQUE_ITEM_MILESTONES.mawRepairKit },
    { anchorId: 'anc.maw.kit-acquired', milestone: EMERGENT_UNIQUE_ITEM_MILESTONES.mawRepairKit },
    { anchorId: 'anc.maw.repair-begun', milestone: 'maw_repaired' },
    { anchorId: 'anc.maw.repair-committed', milestone: 'maw_repaired' },
    { anchorId: 'anc.maw.direction-handback', milestone: EMERGENT_MAW_MILESTONES.directionResolved },
    { anchorId: 'anc.maw.pond-resonance', milestone: EMERGENT_MAW_MILESTONES.pondResonance }
  ];
  if (beat === 'ch6-dive') return [
    { anchorId: 'anc.dive.waterline', milestone: AUTHORED_DIVE_MILESTONES.waterlineEntered },
    {
      anchorId: 'anc.dive.oxygen-authored',
      milestone: AUTHORED_DIVE_MILESTONES.oxygen75,
      directReceiptRequired: true
    },
    { anchorId: 'anc.dive.keel-revealed', milestone: AUTHORED_DIVE_MILESTONES.keelSonarRevealed },
    { anchorId: 'anc.dive.keel-freed', milestone: EMERGENT_UNIQUE_ITEM_MILESTONES.keelMemory },
    { anchorId: 'anc.dive.surface', milestone: AUTHORED_DIVE_MILESTONES.surfacedWithKeel },
    { anchorId: 'anc.dive.shore-bank', milestone: EMERGENT_UNIQUE_ITEM_MILESTONES.keelMemoryBanked }
  ];
  return [];
}

function hydrateSignedAnchorsFromProgression(): void {
  if (!activeBeat) return;
  const entries = progressionAnchorsForBeat(activeBeat);
  const actorId = getLocalActorId();
  let furthestCommittedIndex = -1;
  for (let index = 0; index < entries.length; index++) {
    if (hasMilestone(entries[index].milestone, actorId)) furthestCommittedIndex = index;
  }
  for (let index = 0; index <= furthestCommittedIndex; index++) {
    if (entries[index].directReceiptRequired && !hasMilestone(entries[index].milestone, actorId)) {
      continue;
    }
    const anchor = anchorsById.get(entries[index].anchorId);
    if (anchor) activateAnchor(anchor, 'semantic-event', false);
  }
}

function anchorIdsForEvent(event: EmergentStoryEvent): string[] {
  switch (event.type) {
    case 'audit_mismatch':
      return [event.payload.kind === 'fire'
        ? 'anc.audit.fire-check'
        : event.payload.kind === 'life'
          ? 'anc.audit.life-as-noise'
          : 'anc.audit.tree-distance'];
    case 'audit_directive_issued':
      return ['anc.audit.directive'];
    case 'compliance_committed':
      return event.payload.kind === 'fire'
        ? ['anc.comply.fire-commit', 'anc.comply.organics-order']
        : ['anc.comply.organics-commit', 'anc.comply.regression-floor'];
    case 'protected_tree_tool_refused':
      return ['anc.defy.tool-refusal'];
    case 'tree_refusal_available':
      return ['anc.defy.refuse-available'];
    case 'refusal_committed':
      return ['anc.defy.no-committed'];
    case 'reality_stage_committed':
      return ['anc.a4.life-front'];
    case 'a4_pond_response_visible':
      return ['anc.a4.pond-wakes'];
    case 'a4_herd_route_visible':
      return ['anc.a4.herd-crest'];
    case 'a4_w7744_fault_recorded':
      return ['anc.a4.w7744-flight'];
    case 'field_pack_dropped':
      return ['anc.a4.pack-torn'];
    case 'maw_repair_kit_acquired':
      // The unique kit can only be acquired through the physical field-pack
      // interaction, so that one accepted transaction proves attendance first.
      return ['anc.maw.pack-attended', 'anc.maw.kit-acquired'];
    case 'maw_repair_begun':
      return ['anc.maw.repair-begun'];
    case 'maw_repaired':
      return ['anc.maw.repair-committed'];
    case 'maw_direction_resolved':
      return ['anc.maw.direction-handback'];
    case 'keel_resonance_detected':
      return ['anc.maw.pond-resonance'];
    case 'submersion_changed':
      return event.payload.submerged ? ['anc.dive.waterline'] : [];
    case 'oxygen_threshold':
      return event.payload.direction === 'falling' ? ['anc.dive.oxygen-authored'] : [];
    case 'keel_revealed':
      return ['anc.dive.keel-revealed'];
    case 'keel_memory_acquired':
      return ['anc.dive.keel-freed'];
    case 'dive_surfaced':
      return ['anc.dive.surface'];
    case 'keel_memory_banked':
      return ['anc.dive.shore-bank'];
    case 'ship_repair_stage':
      if (event.payload.to === 'bench_online') return ['anc.reconstruct.bench-online'];
      if (event.payload.to === 'frame_restored') return ['anc.reconstruct.frame-restored'];
      if (event.payload.to === 'hull_sealed') return ['anc.reconstruct.hull-sealed'];
      if (event.payload.to === 'lift_online') return ['anc.reconstruct.lift-online'];
      if (event.payload.to === 'flight_ready') {
        // Route readiness is durable ship state; calibration is a separate
        // eight-second embodied receipt owned by reconstructionCalibration.
        return ['anc.reconstruct.route-online'];
      }
      return [];
    case 'ship_boarded':
      return ['anc.board.cockpit-handback'];
    case 'ship_launched':
      return ['anc.launch.ignition'];
    case 'system_body_targeted':
      return ['anc.crossing.sibling-targeted'];
    case 'planet_arrived':
      return ['anc.landfall.touchdown'];
    case 'ecology_relationship_observed':
      return ['anc.settle.relationship-attended'];
    case 'settlement_scanner_overload':
      return ['anc.settle.scanner-overload'];
    case 'settlement_site_chosen':
      return ['anc.settle.site-chosen'];
    case 'settlement_foundation_placed':
      return ['anc.settle.first-foundation'];
    case 'station_activated':
      return event.payload.stationId === 'habitat_core' ? ['anc.settle.core-online'] : [];
    case 'shelter_certified':
      return ['anc.settle.shelter-certified'];
    case 'safe_rest_completed':
      // Safe rest has already revalidated local night and the live enclosure.
      return ['anc.hearth.ecology-night', 'anc.hearth.safe-rest'];
    case 'two_world_story_handoff':
      return ['anc.hearth.freeplay-handback'];
    default:
      return [];
  }
}

function handleStoryEvent(event: EmergentStoryEvent): void {
  // Shared-world receipts may describe another player. They must not seize the
  // local player's signed camera, score, or post-processing rail.
  if (event.actorId && event.actorId !== getLocalActorId()) return;
  if (event.type === 'maw_repair_cancelled') {
    cancelMawRepairPresentation();
    return;
  }
  for (const anchorId of anchorIdsForEvent(event)) {
    const anchor = anchorsById.get(anchorId);
    if (anchor) activateAnchor(anchor, 'story-event');
  }
}

function cancelMawRepairPresentation(): void {
  if (activeBeat !== 'ch5-maw' || !activatedAnchorIds.has('anc.maw.repair-begun')) return;
  activatedAnchorIds.delete('anc.maw.repair-begun');
  activeAnchor = anchorsById.get('anc.maw.kit-acquired') ?? null;
  activeShot = null;
  activeLensRail = null;
  lensElapsedMs = 0;
  appliedFovDeg = SANDBOX_FOV;
  setStoryTargetFov(SANDBOX_FOV);
  activationSource = 'story-event';
  resetScoreOverlay();
  refreshPostFxCueState();
  publish();
}

function ensureInstalled(): void {
  if (installed) return;
  installed = true;
  subscribeEmergentStoryEvents(handleStoryEvent);
  if (typeof window !== 'undefined') {
    window.addEventListener('blur', () => setSignedSceneAvWindowFocused(false));
    window.addEventListener('focus', () => setSignedSceneAvWindowFocused(true));
    document.addEventListener('visibilitychange', () => {
      setSignedSceneAvDocumentVisible(!document.hidden);
    });
  }
}

export function enterSignedSceneAvBeat(
  beat: StoryBeat | null,
  inactiveReason: 'quit' | 'completion' | 'sandbox' = 'sandbox'
): void {
  ensureInstalled();
  if (!beat || !anchorsByBeat.has(beat)) {
    resetSignedSceneAvRuntime(beat === 'done' ? 'completion' : inactiveReason);
    return;
  }
  let beatChanged = false;
  let carriedShotAcrossBeat = false;
  if (activeBeat !== beat) {
    // A frozen shot may begin on the outgoing beat's final anchor while being
    // declared as part of the incoming beat. That exact contract shape is the
    // sole cross-beat continuity permission: keep only the current anchor and
    // its shot owners until the incoming beat publishes its next anchor.
    carriedShotAcrossBeat = activeBeat !== null
      && activeAnchor !== null
      && activeShot !== null
      && activeShot.beat === beat
      && activeShot.startAnchorRef === activeAnchor.id;
    if (activeBeat !== null && !carriedShotAcrossBeat) resetTransientOwners('beat-exit');
    beatChanged = true;
    activeBeat = beat;
    activatedAnchorIds.clear();
    if (!carriedShotAcrossBeat) {
      activeAnchor = null;
      activeShot = null;
      activeLensRail = null;
      lensElapsedMs = 0;
      appliedFovDeg = null;
      activationSource = null;
    }
  }
  const entry = entryAnchorsByBeat.get(beat);
  if (entry) activateAnchor(entry, 'beat-boundary', false);
  else if (beatChanged) {
    if (carriedShotAcrossBeat) {
      // setScoreBeat runs immediately before this boundary and retunes the
      // instrument. Reassert only the carried rail's intensity; never replay a
      // hit. Lens and effects retain their elapsed/current state.
      if (activeScoreIntensity != null) setScoreIntensity(activeScoreIntensity);
      applyLens();
    } else {
      resetScoreOverlay();
    }
    refreshPostFxCueState();
    publish();
  }
  hydrateSignedAnchorsFromProgression();
}

/**
 * Activate a signed anchor by id from a runtime producer that already owns the
 * fact. Ordering, one-shot latching and beat membership are enforced by
 * `activateAnchor`, so a producer cannot fire an anchor out of sequence or
 * twice — which is what makes the chapter-10 seam-before-resolve invariant
 * executable rather than merely asserted.
 */
export function activateSignedSceneAnchorById(anchorId: string): boolean {
  const anchor = anchorsById.get(anchorId);
  return anchor ? activateAnchor(anchor, 'story-event') : false;
}

/** Future runtime producers can publish a frozen semantic key without coupling to AV. */
export function activateSignedSceneSemanticEvent(event: string): boolean {
  const anchor = contract.anchors.find(candidate => candidate.event === event && candidate.beat === activeBeat);
  return anchor ? activateAnchor(anchor, 'semantic-event') : false;
}

export function tickSignedSceneAvRuntime(dtSeconds: number): void {
  hydrateSignedAnchorsFromProgression();
  if (!activeBeat || !activeShot || pauseReasons.size > 0) return;
  const deltaMs = Math.max(0, Math.min(0.1, dtSeconds)) * 1000;
  runtimeClockMs += deltaMs;
  tickPendingScoreAnswer();
  const previousFov = appliedFovDeg;
  lensElapsedMs = Math.min(Math.max(0, activeShot.lens.durationMs), lensElapsedMs + deltaMs);
  applyLens();
  if (appliedFovDeg !== previousFov) publish();
}

export function setSignedSceneAvPaused(paused: boolean): void {
  setPauseReason('pause', paused);
}

export function setSignedSceneAvFocused(focused: boolean): void {
  setPauseReason('focus-loss', !focused);
}

/** Independent browser lifecycle owners: neither recovery may clear the other. */
export function setSignedSceneAvWindowFocused(focused: boolean): void {
  setPauseReason('window-blur', !focused);
}

export function setSignedSceneAvDocumentVisible(visible: boolean): void {
  setPauseReason('document-hidden', !visible);
}

function setPauseReason(reason: SignedSceneAvPauseReason, enabled: boolean): void {
  const wasSuspended = pauseReasons.size > 0;
  if (enabled) pauseReasons.add(reason);
  else pauseReasons.delete(reason);
  const suspended = pauseReasons.size > 0;
  if (suspended !== wasSuspended) setEmergentScorePaused(suspended);
  if (suspended && !wasSuspended) {
    resetTransientOwners(reason === 'pause' ? 'pause' : 'focus-loss');
  }
  if (!suspended && wasSuspended && activeAnchor) {
    applyLens();
    applyScore(activeAnchor, false);
  }
  if (suspended !== wasSuspended) {
    refreshPostFxCueState();
    publish();
  }
}

export function resetSignedSceneAvRuntime(reason: SignedSceneAvResetReason = 'sandbox'): void {
  resetTransientOwners(reason);
  activeBeat = null;
  activeAnchor = null;
  activeShot = null;
  activeLensRail = null;
  lensElapsedMs = 0;
  activationSource = null;
  activatedAnchorIds.clear();
  // Completion and quit are sampling/handback boundaries inside the same run.
  // A fresh sandbox, replay, or deep link starts a new coverage history.
  if (reason === 'sandbox' || reason === 'replay' || reason === 'deep-link') {
    activationHistoryAnchorIds.clear();
  }
  const wasSuspended = pauseReasons.size > 0;
  pauseReasons.clear();
  if (wasSuspended) setEmergentScorePaused(false);
  refreshPostFxCueState();
  publish();
}

export function subscribeSignedSceneAv(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSignedSceneAvContract(): Readonly<SignedSceneAvContract> {
  return contract;
}

/** Allocation-free hot-path view for the postprocessing frame loop. */
export function getSignedScenePostFxCueState(): Readonly<SignedScenePostFxCueState> {
  return postFxCueState;
}

export function getSignedSceneAvDebugSnapshot(): SignedSceneAvDebugSnapshot {
  const reducedMotion = reducedMotionPreferred();
  return {
    sceneId: contract.source.sceneId,
    contractRevision: contract.source.contractVersion,
    contractSha256: contract.source.sha256,
    contractAnchorCount: contract.anchors.length,
    active: activeBeat !== null,
    suspended: pauseReasons.size > 0,
    beat: activeBeat,
    anchorId: activeAnchor?.id ?? null,
    anchorEvent: activeAnchor?.event ?? null,
    activationSource,
    activationSequence,
    activationHistoryAnchorIds: [...activationHistoryAnchorIds],
    activatedAnchorIds: [...activatedAnchorIds],
    shot: activeShot ? {
      id: activeShot.id,
      cameraAuthority: activeShot.cameraAuthority,
      transitionType: activeShot.transition.type,
      declaredCut: activeShot.transition.declaredCut,
      lens: {
        startFovDeg: activeShot.lens.startFovDeg,
        endFovDeg: activeShot.lens.endFovDeg,
        durationMs: activeShot.lens.durationMs,
        elapsedMs: lensElapsedMs,
        appliedFovDeg,
        reducedMotion
      },
      agency: { ...activeShot.agency }
    } : null,
    score: {
      cueRefs: activeAnchor?.scoreCueRefs.filter(ref => scoreCuesById.has(ref)) ?? [],
      intensity: activeScoreIntensity,
      hit: activeScoreHit
    },
    postFx: {
      activeEffectIds: [...postFxCueState.activeEffectIds],
      supportMix: postFxCueState.supportMix,
      lowTierFallbacks: [...postFxCueState.lowTierFallbacks],
      reducedMotion: postFxCueState.reducedMotion
    },
    lastResetReason
  };
}
