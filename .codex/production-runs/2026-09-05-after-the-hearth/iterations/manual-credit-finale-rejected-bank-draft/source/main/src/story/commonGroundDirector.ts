// --- Common Ground (ch13) director ---------------------------------------------------
//
// The chapter's runtime. It owns four things and nothing else:
//
//   the dormant re-activation watch at the ACTUAL restored Tidegarden core,
//   the per-beat state machine over `commonGroundState`,
//   the guidance facts, marker targets and interaction resolvers,
//   and the dispatch of every signed anchor from its real physical owner.
//
// WHAT IT DOES NOT DO: it never advances on a timer, never completes from a
// caption, a gaze, a marker, a musical phase or a rail, and never fabricates a
// receipt. Every commit below is downstream of a physical fact the player or
// W-7744 actually produced, and each one is idempotent.

import * as THREE from 'three';
import { getAudioSettingsSnapshot } from '../audio/audioSettings.ts';
import { isMusicMuted, peekAudioContext } from '../audio/audioCore.ts';
import { getHabitatWorldState } from '../game/systems/habitatSystem.ts';
import { getLocalActorId } from '../game/playerActors.ts';
import { hasMilestone, markMilestone } from '../game/systems/progressionSystem.ts';
import { getPlayerUp, getPlayerWorldPosition } from '../state/playerFrame.ts';
import {
  PLAYER_CAPSULE_HALF_HEIGHT,
  PLAYER_CAPSULE_RADIUS
} from '../utils/cubeGravityConstants.ts';
import { getSpaceFlightSnapshot } from '../state/spaceFlight.ts';
import { getSystemFlightSnapshot } from '../state/systemFlight.ts';
import { readSystemCompanionBodyTarget } from '../state/systemCompanionBodyTargets.ts';
import { getShipPosition } from '../state/shipProximity.ts';
import { STORY_PRIMARY_WORLD_ID, TIDEGARDEN_WORLD_ID } from './tidegardenRoute.ts';
import { STATION_RETURN_MILESTONES } from './stationReturnStory.ts';
import {
  STORY_MILESTONES,
  advanceToBeat,
  completeChapter13,
  getStoryStateSnapshot,
  reactivateStoryAtBeat,
  type StoryBeat
} from './storyState.ts';
import { registerStoryInteraction, type StoryInteractionCandidate } from './storyInteractions.ts';
import { activateSignedSceneAnchorById } from './signedSceneAvRuntime.ts';
import {
  beginCommonGroundFinalTexture,
  cancelCommonGroundFinalTexture,
  commonGroundFinalTextureHolds,
  enterCommonGroundScoreBeat,
  getCommonGroundScoreDiagnostic,
  releaseCommonGroundScore,
  resetCommonGroundScoreRuntime,
  releaseCommonGroundMood,
  setCommonGroundMood,
  tickCommonGroundFinalTexture,
  type CommonGroundMoodId
} from './commonGroundScore.ts';
import {
  BODY_BODY_CLEARANCE_UNITS,
  CG_COMMON_ROUTE_UNITS,
  CG_POSES,
  CG_ROUTE_COMMON,
  CG_ROUTE_LONG as CG_ROUTE_LONG_RAIL,
  accumulateTraceDistance,
  acceptTestedRoute,
  appendTraceSample,
  clearUncommittedProposal,
  clearAllCommonGroundWorlds,
  createCommonGroundSnapshot,
  createTraceSlot,
  distanceBetween,
  lastTestedPoint,
  markTestedPrefix,
  migrateCommonGround,
  hasNoCommonGroundProgress,
  hasStagedCommonGroundPayload,
  markCommonGroundRestoreSettled,
  putCommonGroundLive,
  readCommonGroundLive,
  releaseLiveOccupancy,
  reviseTail,
  type SurveyRouteClass,
  takeCommonGroundWorldPayload,
  type CommonGroundHoldReason,
  type CommonGroundPoint,
  type CommonGroundSnapshot
} from './commonGroundState.ts';
import {
  CG_FIXED_SOCKET,
  checkReference,
  evaluateOfferedSpan,
  WORKER_BODY_HEIGHT,
  bodiesClear,
  nextOccupancy,
  nextRouteCredit,
  playerSocket,
  walkedSegmentSupported,
  workerSocket,
  NO_ROUTE_CREDIT_CORNER,
  type CommonGroundAabb,
  type CommonGroundFooting,
  type RouteCreditCorner
} from './commonGroundRoute.ts';
import {
  seedCommonGroundActorPose,
  CG_LEG_E_TO_H,
  CG_LEG_H_TO_E,
  CG_LEG_INDEPENDENT_TEST,
  commonGroundActorArrived,
  commonGroundActorPosition,
  getCommonGroundActorState,
  releaseCommonGroundActor,
  resetCommonGroundActor,
  setCommonGroundLeg,
  tickCommonGroundActor
} from './commonGroundActor.ts';
import type { StoryObjectiveGuidanceFacts } from './storyObjectiveGuidance.ts';
import type { Ch13HoldReasonId } from './beats/objectivePrimitives.ts';

export const CH13_BEATS: readonly StoryBeat[] = Object.freeze([
  'ch13-home', 'ch13-return', 'ch13-survey', 'ch13-common'
]);

export function isCommonGroundBeat(beat: StoryBeat | null): boolean {
  return beat !== null && (CH13_BEATS as readonly string[]).includes(beat);
}

/** Reach for a body-to-body action, and for a point on the ground. */
const CG_ACTOR_REACH = 3.4;
const CG_POINT_REACH = 2;
/** The install/review reach the prior contract already uses at the core. */
const CG_CORE_REACH = 4.2;

// --- live world binding ---------------------------------------------------------------

export interface CommonGroundWorldBinding {
  worldId: string;
  footing: CommonGroundFooting;
  /** Existing world solids that must guard the route — the hero tree's trunk. */
  extraSolids: readonly CommonGroundAabb[];
}

let binding: CommonGroundWorldBinding | null = null;

/** Bound by `CommonGroundWorld.tsx`; a mounted world is the readiness boundary. */
export function registerCommonGroundWorld(next: CommonGroundWorldBinding | null): () => void {
  binding = next;
  return () => {
    if (binding === next) binding = null;
  };
}

// --- runtime --------------------------------------------------------------------------

type InstallWatch = 'unknown' | 'awaiting-install' | 'live-install' | 'restored';

interface CommonGroundRuntime {
  beat: StoryBeat | null;
  elapsed: number;
  installWatch: InstallWatch;
  interactionsInstalled: boolean;
  firedAnchors: Set<string>;
  /** The literal reason currently outstanding, retained across a hold. */
  holdReason: CommonGroundHoldReason | null;
  /** Whether the acknowledgement of the fresh install has already been spent. */
  installAcknowledged: boolean;
  /** Cached last published work order, so a same-id copy change can republish. */
  publishedWorkOrder: string | null;
  publishedObjectiveId: string | null;
  runId: number;
  actorId: string;
  /** Last observed player position, for ACTUAL displacement rather than a timer. */
  lastPlayer: CommonGroundPoint | null;
  /**
   * Live corner-residual accounting for the common route, and NOTHING else.
   *
   * It holds displacement the body actually walked while its credit sat pinned
   * at one vertex it had already reached and crossed, so the overshoot of an
   * ordinary rounded corner cannot freeze the span forever. It grants no units
   * by itself, is never persisted or restored, and dies with the beat, the
   * actor, the world and every Continue — see `resetCommonGroundRuntime`.
   */
  routeCorner: RouteCreditCorner;
  /** True while the completed chapter's local tester runs outside a beat. */
  localTester: boolean;
  /**
   * True when the reciprocal proof was ALREADY held when this session started.
   * That, and not "the snapshot came from storage", is what makes a completion
   * a receipt read rather than an event.
   */
  completionWasRestored: boolean;
  /** Units to seed a resumed final-test leg with, consumed once. */
  resumeUnits: number;
  /**
   * Ordered screening-rail traversal of an authored polyline.
   *
   * CONTROLLER STATE, NOT PROGRESS. It decides which point the rail body walks
   * at next and is read by no predicate, no guidance fact, no marker and no
   * receipt; the walked span is measured only from actual displacement.
   */
  railTraversal: CommonGroundRailTraversal | null;
  /**
   * Anchors whose physical fact happened but whose AV activation has not been
   * accepted yet. Ordered by when the facts occurred; never a progression
   * source, never a claim that an anchor activated.
   */
  pendingAnchors: string[];
  /**
   * The BEAT-ENTRY anchor queue, and nothing else.
   *
   * Populated only by `enterCommonGroundBeat` itself — in practice exactly one
   * id, `anc.cg.home-steady` — and emptied by the first `tickCommonGround` of
   * that same beat. It exists because this chapter's entry seam runs BEFORE the
   * first frame and the boot is reported to the chapter as a PAUSE.
   */
  entryAnchors: string[];
  /**
   * A COPY of the last plan the screening rail actually executed.
   *
   * Recorded by `applyCommonGroundRail` so an observer can read what the
   * controller did without RUNNING the controller. It is written by the rail and
   * by nothing else, and read by the probe and by nothing else.
   */
  lastPublishedPlan: CommonGroundRailPlan | null;
}

const runtime: CommonGroundRuntime = {
  beat: null,
  elapsed: 0,
  installWatch: 'unknown',
  interactionsInstalled: false,
  firedAnchors: new Set(),
  holdReason: null,
  installAcknowledged: false,
  publishedWorkOrder: null,
  publishedObjectiveId: null,
  runId: -1,
  actorId: '',
  lastPlayer: null,
  routeCorner: NO_ROUTE_CREDIT_CORNER,
  localTester: false,
  completionWasRestored: false,
  resumeUnits: 0,
  railTraversal: null,
  pendingAnchors: [],
  entryAnchors: [],
  lastPublishedPlan: null
};

export function resetCommonGroundRuntime(options: { clearWorlds?: boolean } = {}): void {
  runtime.runId = getStoryStateSnapshot().runId;
  runtime.beat = null;
  runtime.elapsed = 0;
  runtime.installWatch = 'unknown';
  runtime.firedAnchors.clear();
  runtime.holdReason = null;
  runtime.installAcknowledged = false;
  runtime.publishedWorkOrder = null;
  runtime.publishedObjectiveId = null;
  runtime.lastPlayer = null;
  runtime.routeCorner = NO_ROUTE_CREDIT_CORNER;
  runtime.localTester = false;
  runtime.completionWasRestored = false;
  runtime.resumeUnits = 0;
  runtime.railTraversal = null;
  runtime.lastPublishedPlan = null;
  clearAnchorQueues();
  resetCommonGroundActor();
  resetCommonGroundScoreRuntime();
  if (options.clearWorlds) clearAllCommonGroundWorlds();
}

// --- snapshot access ------------------------------------------------------------------

function currentWorldId(): string {
  return getSystemFlightSnapshot().activePlanetId ?? '';
}

/**
 * The chapter's snapshot for a world, hydrating a staged payload exactly once.
 *
 * ACTOR AND WORLD KEYED. A payload written by another actor, or under another
 * world, hydrates to null and initializes local state instead of grafting; that
 * is the whole reason the identity travels inside the blob.
 */
export function commonGroundSnapshot(worldId = currentWorldId()): CommonGroundSnapshot {
  const actorId = getLocalActorId();
  const live = readCommonGroundLive(worldId);
  // A live snapshot that has actually done or restored something is the truth,
  // full stop: a payload staged behind it must never overwrite newer real work.
  // An EMPTY one is only an uninitialized snapshot — it gets minted by whichever read asks
  // first, and at boot that can precede this world's restore effect, which is
  // exactly how an earned survey came back as `phase: idle`. If the saved bytes
  // have since been staged, they win over the uninitialized snapshot; they still go
  // through the same actor/world validator, and a restored snapshot still
  // enters steady and silent, so nothing earned is replayed into fresh AV.
  if (live && live.actorId === actorId) {
    if (!hasNoCommonGroundProgress(live) || !hasStagedCommonGroundPayload(worldId)) return live;
  }
  const staged = takeCommonGroundWorldPayload(worldId);
  const hydrated = staged == null ? null : migrateCommonGround(staged, actorId, worldId);
  // A rejected payload (another actor, another world, malformed) must not
  // discard the initial snapshot identity either; it simply initializes local state.
  const snapshot = hydrated
    ?? (live && live.actorId === actorId ? live : createCommonGroundSnapshot(actorId, worldId));
  putCommonGroundLive(snapshot);
  // A payload that VALIDATED settles the world. A payload that was rejected
  // deliberately does not: its bytes stay on disk, and this actor's empty state
  // is never allowed to answer for them.
  if (hydrated) markCommonGroundRestoreSettled(worldId);
  // A restored save says where his body was. Put it there before anything asks
  // where he is; the leg he resumes is then built from that pose, and every
  // reference the leg needs is revalidated live from the next frame on.
  const pose = snapshot.common.workerPose ?? snapshot.survey.workerPose;
  if (snapshot.hydrated && pose) {
    seedCommonGroundActorPose(pose);
    runtime.resumeUnits = snapshot.common.workerPose ? snapshot.common.workerUnits : 0;
  }
  return snapshot;
}

/** Record his live pose so a save taken now resumes with his body where it is. */
function rememberWorkerPose(snapshot: CommonGroundSnapshot, lane: 'survey' | 'common'): void {
  const at = commonGroundActorPosition();
  const pose = { x: at.x, y: at.y, z: at.z };
  if (lane === 'survey') snapshot.survey.workerPose = pose;
  else snapshot.common.workerPose = pose;
}

// --- anchors and score ----------------------------------------------------------------

/**
 * Anchor -> mood, exactly as the signed lane binds them.
 *
 * The mood is DERIVED from the anchor rather than authored a second time here,
 * so a cue can only be heard where the contract actually binds it and there is
 * no second table to drift.
 *
 * THIS TABLE IS A BINDING, NOT A PUBLICATION AUTHORITY. Every row records which
 * cue the contract associates with an anchor. Whether that anchor publishes,
 * retains what is current, or releases the beat entirely is decided below, by
 * the two sets that follow.
 */
const CG_ANCHOR_MOOD: Readonly<Record<string, CommonGroundMoodId>> = Object.freeze({
  'anc.cg.cell-installed': 'restored-home',
  'anc.cg.home-steady': 'restored-home',
  'anc.cg.fault-reviewed': 'restored-home',
  'anc.cg.return-chosen': 'restored-home',
  'anc.cg.hatch-boarded': 'restored-home',
  'anc.cg.lift-committed': 'restored-home',
  'anc.cg.origin-landed': 'restored-home',
  'anc.cg.repeated-measure': 'unreconciled',
  'anc.cg.demonstration-opened': 'unreconciled',
  'anc.cg.survey-started': 'unreconciled',
  'anc.cg.trace-drawn': 'unreconciled',
  'anc.cg.route-offered': 'demonstrating',
  'anc.cg.revision-ready': 'demonstrating',
  'anc.cg.specific-hold': 'refused-hold',
  'anc.cg.witness-held': 'refused-hold',
  'anc.cg.witness-vacated': 'refused-hold',
  'anc.cg.test-resumed': 'refused-hold',
  'anc.cg.tail-reopened': 'demonstrating',
  'anc.cg.route-revised': 'revised',
  'anc.cg.route-tested': 'demonstrating',
  'anc.cg.reciprocal-reference': 'demonstrating',
  'anc.cg.reciprocal-crossed': 'demonstrating',
  'anc.cg.final-reference-offered': 'demonstrating',
  'anc.cg.reference-vacated': 'demonstrating',
  'anc.cg.reference-resumed': 'demonstrating',
  'anc.cg.independent-test': 'demonstrating',
  'anc.cg.complete': 'independent-action-settled',
  'anc.cg.handback': 'independent-action-settled'
});

/**
 * RETAIN THE CURRENT VARIANT. These anchors are real facts with real cue
 * references, and none of them is a change of musical situation.
 *
 * Same-mood de-duplication is not enough on its own, which is the whole point:
 * if the current texture happens to be `revised` and a witness then steps out,
 * a mapped `refused-hold` would be a genuinely different variant and would
 * publish. Readiness to revise is a menu state; reopening a tail is the player
 * picking up a pencil; a body in the way and a reference stepped out of are
 * suspensions, and stepping back in is a resumption. Whatever is playing keeps
 * playing through all of them — the music changes when the ARGUMENT changes.
 */
const CG_RETAINING_ANCHORS: ReadonlySet<string> = new Set([
  'anc.cg.revision-ready',
  'anc.cg.tail-reopened',
  'anc.cg.witness-held',
  'anc.cg.witness-vacated',
  'anc.cg.test-resumed',
  'anc.cg.reference-vacated',
  'anc.cg.reference-resumed'
]);

/**
 * The world conductor's own frames.
 *
 * `anc.cg.return-chosen` RELEASES the chapter's score, and the three travel
 * anchors after it are no-ops. They keep their signed `restored-home` binding in
 * the table above — the cue reference is a fact about the contract — but a cue
 * reference has never been an instruction to publish. Reselecting the hearth's
 * mood at the hatch, at the lift or on the Origin landing would be this chapter
 * scoring somebody else's travel.
 */
const CG_RELEASING_ANCHOR = 'anc.cg.return-chosen';
const CG_WORLD_CONDUCTOR_ANCHORS: ReadonlySet<string> = new Set([
  'anc.cg.hatch-boarded',
  'anc.cg.lift-committed',
  'anc.cg.origin-landed'
]);

/**
 * Publish one signed anchor from its real owner.
 *
 * `once` is the default because a physical fact happens once. The contingent
 * hold/resume anchors pass `once: false` — a reference can genuinely lapse and
 * be re-established more than once, and the score's own de-duplication (same
 * variant, no republication) is what keeps that from restarting a mood.
 */
function noteAnchor(anchorId: string, options: { once?: boolean; entry?: boolean } = {}): boolean {
  const once = options.once ?? true;
  if (once && runtime.firedAnchors.has(anchorId)) return false;
  runtime.firedAnchors.add(anchorId);
  requestAnchorActivation(anchorId, options.entry === true);
  const mood = CG_ANCHOR_MOOD[anchorId];
  const beat = runtime.beat;
  if (mood && beat) {
    if (anchorId === CG_RELEASING_ANCHOR) {
      releaseCommonGroundMood(beat);
    } else if (CG_WORLD_CONDUCTOR_ANCHORS.has(anchorId) || CG_RETAINING_ANCHORS.has(anchorId)) {
      // Deliberately nothing. Whatever is current stays current.
      return true;
    } else if (anchorId === 'anc.cg.complete') {
      // The ONE new behaviour: a live-only texture on a real first completion.
      // Eligibility is the COMPLETION EDGE, not the snapshot's provenance: a
      // save resumed mid-chapter still earns its first completion live.
      beginCommonGroundFinalTexture(beat, {
        restoredCompletion: runtime.completionWasRestored,
        audioUnavailable: commonGroundAudioUnavailable()
      });
    } else if (anchorId === 'anc.cg.handback') {
      // The handback binds the SAME settled cue. It must not become a second
      // door into it: if eligibility was refused a frame ago — restored, muted,
      // no output — this anchor cannot quietly publish the mood anyway, and it
      // must never restart or re-queue a token that is already running.
      if (!commonGroundFinalTextureHolds()) return true;
    } else {
      setCommonGroundMood(beat, mood);
    }
  }
  return true;
}

/**
 * Ask the signed AV rail to activate an anchor, and REMEMBER A REFUSAL.
 *
 * The rail is entered by the shared story director AFTER each chapter's own
 * beat-entry seam (`emergentStoryDirector`: `enterCommonGroundBeat(beat)` then
 * `enterSignedSceneAvBeat(beat)`), so an anchor published at entry is offered
 * to a runtime whose active beat is still the previous one, and it is refused.
 * The old code discarded that boolean while having already spent this module's
 * one-shot latch, so `anc.cg.home-steady` could never activate at all — on a
 * hydrated entry, on a deep link, or in a continuous journey. Measured
 * (VF-ANCHOR-OBS-1): both real F acts performed, both milestones set, the
 * activation history empty.
 *
 * A refusal is not a fact that stopped being true. It is queued, in the order
 * the facts actually happened, and retried while this chapter still owns the
 * beat. NOTHING IS BYPASSED: the retry is the same `activateSignedSceneAnchorById`
 * call, subject to the same ordering, beat membership and one-shot rules, so an
 * anchor the rail legitimately refuses stays unactivated and is simply never
 * reported as having happened.
 */
function requestAnchorActivation(anchorId: string, entry = false): void {
  if (activateSignedSceneAnchorById(anchorId)) {
    const at = runtime.pendingAnchors.indexOf(anchorId);
    if (at >= 0) runtime.pendingAnchors.splice(at, 1);
    const atEntry = runtime.entryAnchors.indexOf(anchorId);
    if (atEntry >= 0) runtime.entryAnchors.splice(atEntry, 1);
    return;
  }
  const queue = entry ? runtime.entryAnchors : runtime.pendingAnchors;
  if (!queue.includes(anchorId)) queue.push(anchorId);
}

/**
 * Drop anything still waiting. Called at every transition that ends the frame
 * this queue belongs to: a beat change, a run change, a pause, a visibility
 * loss, an actor or world change, a reset and the chapter's release.
 *
 * THE BEAT-ENTRY QUEUE IS NOT PRESENTATION, so it is not dropped here.
 *
 * VF3-AVHOME-1, and the reason is in `App.tsx`: this chapter's entry seam is
 * synchronous (`storyDirector`'s `subscribeStory(syncBeat)` fires inside the
 * render that `initStoryFromSave` activates the beat in, before the first
 * frame), while `StoryDirectorDriver` is mounted with
 * `paused={!worldGenReady || !initialRenderReleased || ...}` — so for the entire
 * world-generation and shader-warmup boot the chapter is told 'pause' on every
 * frame, and the old unconditional clear destroyed `anc.cg.home-steady` before
 * any tick could retry it. `firedAnchors` had already latched it, so it could
 * never be re-noted, and `signedSceneAvRuntime`'s ordering guard then refused
 * fault-reviewed and return-chosen behind it for the whole beat. Measured on
 * hardware: both real F acts performed, both milestones set, activationSequence
 * 0 and an empty activation history.
 *
 * A boot is not a player interruption, and the entry anchor is not an
 * acknowledgement of anything live: it is the state of the beat the chapter is
 * currently IN. What keeps this from becoming a deferred unlock is that the
 * queue holds only what `enterCommonGroundBeat` published, is emptied by the
 * first tick of that beat whatever the outcome, and is dropped whole by
 * `clearAnchorQueues` on every beat, run, world, actor, reset and release
 * transition. The live install acknowledgement (`anc.cg.cell-installed`), every
 * mid-beat anchor and the completion token are untouched: they go through
 * `pendingAnchors`, which a pause still empties on the spot.
 */
function clearPendingAnchors(): void {
  runtime.pendingAnchors = [];
}

/** Both queues. Used only where the entry itself has ended. */
function clearAnchorQueues(): void {
  runtime.pendingAnchors = [];
  runtime.entryAnchors = [];
}

/**
 * Retry, ONCE, on the next frame of the same beat.
 *
 * The window is exactly the seam it exists to cross and not one frame more.
 * Whatever this leaves unactivated is a genuine refusal — an ordering rule, a
 * one-shot latch, a beat that has moved on — and it is dropped, never carried.
 * That is what keeps this from becoming a deferred acknowledgement: nothing here
 * can hold an install receipt across a pause, a mute, an unavailable audio host
 * or a Continue and then publish it when the coast clears, because the queue is
 * empty again the moment it has been read.
 *
 * The audio eligibility authorities are untouched either way: the mood, the
 * completion texture and their cancellations are decided by `noteAnchor` at the
 * instant of the fact, not by whether the AV rail accepted the anchor.
 */
function drainPendingAnchors(): void {
  if (runtime.entryAnchors.length === 0 && runtime.pendingAnchors.length === 0) return;
  // The entry's own anchors first, because they happened first.
  const pending = [...runtime.entryAnchors, ...runtime.pendingAnchors];
  clearAnchorQueues();
  for (const anchorId of pending) {
    activateSignedSceneAnchorById(anchorId);
  }
  // One retry. A second refusal is a refusal.
  clearAnchorQueues();
}

/**
 * Muted, silent, or no audio output at all, at the completion edge.
 *
 * Settings alone are not the question. A context that was never unlocked, or is
 * suspended behind an autoplay policy, cannot carry a five-second texture
 * either, and pretending otherwise would start a token nobody hears and then
 * report it as an acknowledgement. Read-only reads through the existing facade:
 * no graph is built, and nothing is unlocked from here.
 *
 * A cancelled texture is never queued for a later unlock. The moment is the
 * moment.
 */
function commonGroundAudioBlockedBy(): 'music-mute' | 'audio-unavailable' | null {
  const audio = getAudioSettingsSnapshot();
  if (audio.muted || audio.musicVolume <= 0 || isMusicMuted()) return 'music-mute';
  const context = peekAudioContext();
  return context === null || context.state !== 'running' ? 'audio-unavailable' : null;
}

function commonGroundAudioUnavailable(): boolean {
  return commonGroundAudioBlockedBy() !== null;
}

/**
 * Advance the live completion token, and keep checking that it can still be
 * heard.
 *
 * Availability is not a question asked once at the edge. A player who mutes
 * during the five seconds, or whose output is suspended by the browser, is a
 * player for whom the texture has stopped existing — so the token is CANCELLED
 * rather than left running silently and then reported as an acknowledgement.
 * A cancelled token is gone; it is never re-armed when audio comes back.
 *
 * Called from the beat tick AND from the `done`-frame entry watch, because the
 * handback retires the beat while the token is still holding.
 */
function tickCommonGroundScore(dt: number): void {
  if (commonGroundFinalTextureHolds()) {
    const blocked = commonGroundAudioBlockedBy();
    if (blocked) {
      cancelCommonGroundFinalTexture(blocked);
      return;
    }
  }
  tickCommonGroundFinalTexture(dt);
}

// --- dormant re-activation ------------------------------------------------------------

function tidegardenCorePosition(): CommonGroundPoint | null {
  const habitat = getHabitatWorldState(TIDEGARDEN_WORLD_ID);
  if (!habitat) return null;
  const [x, y, z] = habitat.core.position;
  return { x, y, z };
}

/** The prior station-continuation contract's own receipts. Read, never reissued. */
function priorBoundaryHeld(actorId: string): boolean {
  return hasMilestone(STATION_RETURN_MILESTONES.stationDeparted, actorId)
    && hasMilestone(STATION_RETURN_MILESTONES.bondedCellInstalled, actorId)
    && hasMilestone(STATION_RETURN_MILESTONES.hearthRestored, actorId);
}

export interface CommonGroundEntryFacts {
  restored: boolean;
  onFootTidegarden: boolean;
  coreAvailable: boolean;
  alreadyEntered: boolean;
}

export function readCommonGroundEntryFacts(actorId = getLocalActorId()): CommonGroundEntryFacts {
  const system = getSystemFlightSnapshot();
  const flight = getSpaceFlightSnapshot();
  return {
    restored: priorBoundaryHeld(actorId),
    onFootTidegarden: system.activePlanetId === TIDEGARDEN_WORLD_ID
      && flight.phase === 'surface'
      && flight.controlMode !== 'flight',
    coreAvailable: tidegardenCorePosition() !== null,
    alreadyEntered: hasMilestone(STORY_MILESTONES.ch13FaultReviewed, actorId)
      || hasMilestone(STORY_MILESTONES.ch13Complete, actorId)
  };
}

export function commonGroundEntryReady(facts: CommonGroundEntryFacts): boolean {
  return facts.restored && facts.onFootTidegarden && facts.coreAvailable && !facts.alreadyEntered;
}

/**
 * The dormant watch. Runs on the frames free play owns and the story does not.
 *
 * IT IS ON FOOT AT THE RESTORED CORE, NOT AT ORIGIN. The chapter opens where the
 * previous one ended — inside a home that works again because a specific part
 * was carried and fitted — and the going back is the choice she makes from
 * there. Re-activation is `reactivateStoryAtBeat`, never `advanceToBeat`: free
 * play is `active: false`, and an advance would leave it that way with a beat
 * nobody is observing.
 */
export function tickCommonGroundEntry(dt: number): boolean {
  syncCommonGroundRun();
  const story = getStoryStateSnapshot();
  if (story.active || story.beat !== 'done') return false;
  const actorId = getLocalActorId();
  const facts = readCommonGroundEntryFacts(actorId);

  // Live install versus restored save, told apart by an actual edge rather than
  // by a flag anyone could set. A session that has ever observed the pre-install
  // state and then sees the receipt appear watched it happen; a session that
  // starts already restored did not, and enters steady and silent.
  if (runtime.installWatch === 'unknown') {
    runtime.installWatch = facts.restored ? 'restored' : 'awaiting-install';
  } else if (runtime.installWatch === 'awaiting-install' && facts.restored) {
    runtime.installWatch = 'live-install';
  }

  tickCommonGroundScore(dt);
  if (!commonGroundEntryReady(facts)) return false;
  if (!reactivateStoryAtBeat('ch13-home')) return false;

  // The acknowledgement belongs to the real install boundary and is spent at
  // most once. A hydrated entry never reaches this line.
  //
  // AND IT IS PUBLISHED HERE, AT THE BOUNDARY, WHICH IS BEFORE THE STEADY ENTRY
  // IT CAUSES. The receipt is signed at order 0 and the steady entry at order 1,
  // and the rail refuses an anchor that would rewind an already newer one. The
  // two are published in that causal order — the install reactivates the beat,
  // and the beat seam then publishes the entry on the following frame — and the
  // pending queue retries them in the same order, so the one live
  // acknowledgement can no longer be thrown away by arriving second.
  if (runtime.installWatch === 'live-install' && !runtime.installAcknowledged) {
    runtime.installAcknowledged = true;
    noteAnchor('anc.cg.cell-installed');
  }
  return true;
}

// --- beat entry and tick --------------------------------------------------------------

/**
 * A new run is a new chapter.
 *
 * Checked here rather than called from `restartStory`, because storyState is
 * upstream of this module and reaching back down would close a cycle. The run id
 * is the same authority the story director uses for exactly this, and it moves
 * on every explicit replay and every deep-link rehearsal — so a replay cannot
 * inherit an actor mid-leg or a proposal whose save has already been cleared.
 */
function syncCommonGroundRun(): void {
  const story = getStoryStateSnapshot();
  if (story.runId === runtime.runId) return;
  const first = runtime.runId === -1;
  runtime.runId = story.runId;
  if (!first) resetCommonGroundRuntime({ clearWorlds: true });
}

export function enterCommonGroundBeat(beat: StoryBeat | null): void {
  syncCommonGroundRun();
  ensureCommonGroundInteractions();
  const leaving = runtime.beat;
  if (leaving && isCommonGroundBeat(leaving) && !isCommonGroundBeat(beat)) {
    const snapshot = readCommonGroundLive(currentWorldId());
    if (snapshot) releaseLiveOccupancy(snapshot);
    // HE IS NOT HIDDEN BY THE HANDBACK. Once the reciprocal proof is held he
    // stays at the audit site as a local tester; only a chapter exit that is not
    // the completion returns his body to the hidden state ch4 leaves it in.
    if (beat !== null && !hasMilestone(STORY_MILESTONES.ch13Complete, getLocalActorId())) {
      releaseCommonGroundActor();
    }
  }
  // A session that starts already holding the proof watched nothing happen.
  if (runtime.installWatch === 'unknown') {
    runtime.completionWasRestored = hasMilestone(STORY_MILESTONES.ch13Complete, getLocalActorId());
  }
  // A pending activation belongs to the beat whose fact produced it. Carrying it
  // across a boundary would offer it to a rail that has already moved on.
  if (leaving !== beat) clearAnchorQueues();
  runtime.beat = isCommonGroundBeat(beat) ? beat : null;
  runtime.elapsed = 0;
  runtime.publishedObjectiveId = null;
  runtime.publishedWorkOrder = null;
  if (!runtime.beat) {
    enterCommonGroundScoreBeat(null);
    return;
  }
  enterCommonGroundScoreBeat(runtime.beat);
  // The ENTRY anchor. It is published before the AV rail has entered this beat
  // (the shared seam calls `enterSignedSceneAvBeat` immediately after this
  // function), and on a boot it is published before the first frame exists, so
  // it is queued as an entry anchor and retried by this beat's first tick.
  if (runtime.beat === 'ch13-home') noteAnchor('anc.cg.home-steady', { entry: true });
}

export function tickCommonGround(dt: number): void {
  const beat = runtime.beat;
  if (!beat) return;
  runtime.elapsed += Math.max(0, dt);
  // The rail is entered after this chapter's beat seam, so an entry anchor is
  // published one frame before the runtime can accept it.
  drainPendingAnchors();
  tickCommonGroundScore(dt);
  switch (beat) {
    case 'ch13-home':
      tickHome();
      break;
    case 'ch13-return':
      tickReturn(dt);
      break;
    case 'ch13-survey':
      tickSurvey(dt);
      break;
    case 'ch13-common':
      tickCommon(dt);
      break;
    default:
      break;
  }
}

/**
 * Capsule centre -> grounded body origin, in the walker's own gravity frame.
 *
 * THE ONE COORDINATE SEAM OF THIS CHAPTER, and it is a physical fact rather than
 * a tolerance. `getPlayerWorldPosition()` publishes the Rapier body's origin,
 * which is the CENTRE of the capsule collider `EfficientPlayer` mounts
 * (`CapsuleCollider [PLAYER_CAPSULE_HALF_HEIGHT, PLAYER_CAPSULE_RADIUS]`). Every
 * pose this chapter was authored against — `CG_POSES`, the three routes, the
 * sockets, the occupancy cylinders, the footing columns — is a GROUNDED body
 * origin: the point the feet contact. The two differ by the half-height plus the
 * lower cap radius, along the LOCAL up, because this is a cube-gravity world and
 * "down" is not `-Y` on five of its six faces.
 *
 * Reading the raw centre was wrong everywhere, not merely at the rail's arrival
 * radius: `CommonGroundWorld`'s footing samples `cell(y - 1.05)`, so a centre
 * 1.8 above the ground column samples the EMPTY cell above it and reports
 * unsupported — which silently refused the survey start, every trace sample,
 * every witness offer and the far-reference offer. The shared walker
 * (`surfaceGaitDistance`) meanwhile measures tangential range, so it stopped on
 * horizontal distance while this module judged full 3D from 1.8 units up. One
 * conversion here makes the walker, the terrain and the contract agree.
 *
 * NOTHING IS WIDENED, CLAMPED OR SKIPPED. The vertical term stays in every
 * comparison, so a jumping or floating body is still not standing anywhere: it
 * is simply measured from where her feet actually are.
 */
export const CG_PLAYER_GROUND_OFFSET = PLAYER_CAPSULE_HALF_HEIGHT + PLAYER_CAPSULE_RADIUS;

/**
 * Where the player's feet ACTUALLY are, this frame.
 *
 * Exported for the physical regressions, which must place a capsule centre and
 * assert against the ground plane rather than standing a body of zero height on
 * the mark.
 */
export function commonGroundPlayerPose(): CommonGroundPoint {
  const position = getPlayerWorldPosition();
  const up = getPlayerUp();
  return {
    x: position.x - up.x * CG_PLAYER_GROUND_OFFSET,
    y: position.y - up.y * CG_PLAYER_GROUND_OFFSET,
    z: position.z - up.z * CG_PLAYER_GROUND_OFFSET
  };
}

function player(): CommonGroundPoint {
  return commonGroundPlayerPose();
}

function onOrigin(): boolean {
  return getSystemFlightSnapshot().activePlanetId === STORY_PRIMARY_WORLD_ID;
}

// --- ch13-home ------------------------------------------------------------------------

function tickHome(): void {
  const actorId = getLocalActorId();
  const snapshot = commonGroundSnapshot();
  snapshot.home.faultReviewed = snapshot.home.faultReviewed
    || hasMilestone(STORY_MILESTONES.ch13FaultReviewed, actorId);
  snapshot.home.returnChosen = snapshot.home.returnChosen
    || hasMilestone(STORY_MILESTONES.ch13ReturnChosen, actorId);
  if (!snapshot.home.returnChosen) return;
  // The checkpoint is committed AT the boundary, adjacent to the advance. The
  // receipt above already recorded the player's act the instant it happened;
  // this idempotent re-commit is what makes "checkpoint, then advance" one
  // inspectable transition rather than two facts separated by a read.
  markMilestone(STORY_MILESTONES.ch13ReturnChosen, actorId);
  advanceToBeat('ch13-return');
}

/** [F] at the core: the stored audit fault, exactly as it was left. */
export function commitCommonGroundFaultReview(actorId = getLocalActorId()): boolean {
  if (runtime.beat !== 'ch13-home') return false;
  if (hasMilestone(STORY_MILESTONES.ch13FaultReviewed, actorId)) return false;
  markMilestone(STORY_MILESTONES.ch13FaultReviewed, actorId);
  commonGroundSnapshot().home.faultReviewed = true;
  noteAnchor('anc.cg.fault-reviewed');
  return true;
}

/**
 * [F] at the core: accept the invitation.
 *
 * There is no other way in. No night wait, no autoaccept, no teleport and no
 * rail may reach this: the invitation is allowed to stand open forever, and a
 * chapter that begins because the player waited long enough is not a choice.
 */
export function commitCommonGroundReturnChoice(actorId = getLocalActorId()): boolean {
  if (runtime.beat !== 'ch13-home') return false;
  if (!hasMilestone(STORY_MILESTONES.ch13FaultReviewed, actorId)) return false;
  if (hasMilestone(STORY_MILESTONES.ch13ReturnChosen, actorId)) return false;
  markMilestone(STORY_MILESTONES.ch13ReturnChosen, actorId);
  commonGroundSnapshot().home.returnChosen = true;
  noteAnchor('anc.cg.return-chosen');
  return true;
}

// --- ch13-return ----------------------------------------------------------------------

function tickReturn(dt: number): void {
  const actorId = getLocalActorId();
  const flight = getSpaceFlightSnapshot();
  if (flight.controlMode === 'flight') {
    noteAnchor('anc.cg.hatch-boarded');
    if (flight.phase !== 'surface') noteAnchor('anc.cg.lift-committed');
  }
  if (!onOrigin()) return;
  // He is mounted and repeating the measurement from the moment his world is
  // the enclosing one, so the site the player lands at is already occupied.
  driveInspection(dt);
  if (flight.phase !== 'surface' || flight.controlMode === 'flight') return;
  if (distanceBetween(player(), CG_POSES.W) > CG_ACTOR_REACH) return;
  markMilestone(STORY_MILESTONES.ch13OriginLanded, actorId);
  noteAnchor('anc.cg.origin-landed');
  advanceToBeat('ch13-survey');
}

// --- ch13-survey ----------------------------------------------------------------------

function driveInspection(dt: number): void {
  setCommonGroundLeg({ leg: 'inspecting', points: [CG_POSES.W], key: 'cg:inspect' });
  tickActor(dt);
}

function tickActor(dt: number) {
  return tickCommonGroundActor({
    dt,
    footing: binding?.footing ?? null,
    extraSolids: binding?.extraSolids ?? [],
    playerPosition: player(),
    bodyClearanceUnits: 1
  });
}

function referenceOptions() {
  return { extraSolids: binding?.extraSolids ?? [] };
}

function footing(): CommonGroundFooting | null {
  return binding?.footing ?? null;
}

/**
 * The literal cause, for the guidance rung that carries one.
 *
 * A body-clearance suspension is deliberately NOT surfaced as a revision cause:
 * it is repaired by somebody moving, not by editing the route, and offering
 * "reopen the untested span" for it would be an unhelpful lie.
 */
function holdReasonId(reason: CommonGroundHoldReason | null): Ch13HoldReasonId | null {
  return reason === 'body-clearance' || reason === null ? null : reason;
}

/** The real distance the player's body moved since the last director frame. */
function playerDisplacement(body: CommonGroundPoint): number {
  const previous = runtime.lastPlayer;
  runtime.lastPlayer = { ...body };
  if (!previous) return 0;
  const moved = distanceBetween(previous, body);
  // A teleport is not a walk. Anything larger than a plausible frame step is
  // refused outright rather than banked as distance somebody covered on foot.
  return moved > 2 ? 0 : moved;
}

/**
 * A hold edge, published once per real transition.
 *
 * The reason is retained across frames; only a CHANGE fires an anchor. Without
 * this the vacancy and resume anchors fire every tick a body is outside its
 * cylinder, which is not a transition, and the score would be told about a
 * suspension sixty times a second.
 */
function setSurveyHold(
  snapshot: CommonGroundSnapshot,
  reason: CommonGroundHoldReason | null,
  atIndex: number
): void {
  const survey = snapshot.survey;
  const previous = survey.hold.reason;
  if (previous === reason) return;
  survey.hold = { reason, atIndex };
  runtime.holdReason = reason;
  if (reason === null) {
    survey.phase = 'testing';
    // Resumption consumes no new input and never restarts the texture.
    if (previous === 'reference-vacant') noteAnchor('anc.cg.test-resumed', { once: false });
    return;
  }
  survey.phase = 'held';
  if (reason === 'reference-vacant') {
    noteAnchor('anc.cg.witness-vacated', { once: false });
    return;
  }
  // A body in the way is a suspension, not a refusal: no new mood, no anchor.
  if (reason === 'body-clearance') return;
  // Only an ACTUALLY unsupported offered span refuses, and only once.
  noteAnchor('anc.cg.specific-hold');
}

function tickSurvey(dt: number): void {
  const snapshot = commonGroundSnapshot();
  const survey = snapshot.survey;
  const body = player();
  const displacement = playerDisplacement(body);
  const ground = footing();

  // FAIL CLOSED. No measurement can succeed while the world that would have to
  // support it is not mounted: the chapter suspends and earns nothing rather
  // than treating an absent query as a pass.
  //
  // AND THE SUSPENSION MUST NOT MOVE HIM. Once he has walked out to a span,
  // driving the inspection pose would teleport him back to W — a hold is a hold,
  // including a hold caused by a world that has not mounted yet.
  if (!ground) {
    if (!survey.approached) driveInspection(dt);
    return;
  }

  if (!survey.approached
    && (survey.phase === 'idle' || survey.phase === 'awaiting-start' || survey.phase === 'drawing')) {
    driveInspection(dt);
  }
  // His mounted, performed reinspection is the anchor; being looked at is not.
  if (survey.phase === 'idle' || survey.phase === 'awaiting-start') {
    noteAnchor('anc.cg.repeated-measure');
  }

  if (survey.phase === 'drawing' && survey.working) {
    const slot = survey.working;
    const last = slot.samples[slot.samples.length - 1];
    // Actual walked distance is banked whether or not a sample lands, so a loop
    // between two samples is not free trace against the 120-unit cap.
    accumulateTraceDistance(slot, displacement);
    const corner = Math.abs(body.z - last.z) > 0.2 && Math.abs(body.x - last.x) > 0.2;
    // The SEGMENT has to be walkable by a body, not merely the new point.
    if (walkedSegmentSupported(last, body, ground, { extraSolids: binding?.extraSolids ?? [] })) {
      appendTraceSample(slot, { x: body.x, y: body.y, z: body.z, corner });
    }
    // Growth is quiet: no per-sample cue, prompt or microstep exists here, and
    // reaching drawing readiness neither offers the span nor grants proof.
    if (slot.samples.length >= 2 && distanceBetween(body, CG_POSES.E) <= CG_POINT_REACH) {
      noteAnchor('anc.cg.trace-drawn');
    }
  }

  if (survey.phase === 'offered' || survey.phase === 'testing' || survey.phase === 'held') {
    tickWorkerTest(dt, snapshot, ground);
  }

  if (survey.phase === 'tested' && runtime.beat === 'ch13-survey') {
    markMilestone(STORY_MILESTONES.ch13RouteTested, snapshot.actorId);
    advanceToBeat('ch13-common');
  }
}

function offeredSamples(snapshot: CommonGroundSnapshot): readonly CommonGroundPoint[] {
  const slot = snapshot.survey.working;
  if (!slot) return [];
  const end = slot.offeredEndIndex ?? slot.samples.length - 1;
  return slot.samples.slice(0, end + 1);
}

/**
 * His test of the offered span.
 *
 * Two things this deliberately does NOT do. It does not restart his body at S
 * on a revision — a reoffered edited suffix resumes from his actual last tested
 * pose, and manufacturing a return to the inspection pose would be a lie about
 * where he is standing. And it does not publish the refusal the instant the
 * scan finds a bad sample: he walks the supported prefix first, and the hold is
 * announced when his body actually arrives at the place it stops.
 */
function tickWorkerTest(
  dt: number,
  snapshot: CommonGroundSnapshot,
  ground: CommonGroundFooting
): void {
  const survey = snapshot.survey;
  const slot = survey.working;
  if (!slot) return;
  const samples = offeredSamples(snapshot);
  if (samples.length === 0) return;
  const body = player();
  const solids = binding?.extraSolids ?? [];

  // Occupancy is live and hysteretic, and it is INDEPENDENT of the offer: she
  // may step out of the release cylinder and the offer survives.
  if (survey.witness) {
    survey.witness.occupied = nextOccupancy(survey.witness.occupied, body, survey.witness.pose);
  }
  const held = survey.witness && survey.witness.offered && survey.witness.occupied
    ? playerSocket(survey.witness.pose)
    : null;

  const result = evaluateOfferedSpan(
    samples,
    { fixed: CG_FIXED_SOCKET, held },
    ground,
    { extraSolids: solids, bodyHeight: WORKER_BODY_HEIGHT }
  );

  if (!survey.approached) {
    // The FIRST approach, and only the first. It earns nothing: it grows no
    // tested prefix and proves no span, and it vacates W before any optional
    // witness use.
    setCommonGroundLeg({
      leg: 'approach-start',
      points: [commonGroundActorPosition(), samples[0]],
      key: 'cg:approach'
    });
    const approach = tickActor(dt);
    rememberWorkerPose(snapshot, 'survey');
    if (!commonGroundActorArrived()) {
      if (approach.held) setSurveyHold(snapshot, 'body-clearance', -1);
      else setSurveyHold(snapshot, null, -1);
      return;
    }
    survey.approached = true;
    survey.phase = 'testing';
  }

  // The leg he is on runs from WHERE HE ACTUALLY IS through the remaining
  // samples. On the first offer that is S; after a revision it is his last
  // tested pose, and the tested prefix behind him is never re-walked.
  const from = Math.max(0, Math.min(slot.testedPrefixCount - 1, samples.length - 1));
  const suffix = [commonGroundActorPosition(), ...samples.slice(from + 1)];
  // Path index 0 is where he is standing; sample `j` is at path index `j - from`.
  setCommonGroundLeg({
    leg: 'testing-span',
    points: suffix,
    permittedIndex: Math.max(0, result.supportedPrefix - 1 - from),
    key: `cg:test:${slot.tailRevision}:${from}:${samples.length}`
  });
  const actor = tickActor(dt);
  markTestedPrefix(slot, Math.min(from + actor.sampledIndex + 1, result.supportedPrefix));
  rememberWorkerPose(snapshot, 'survey');

  // He is AT HIS STOP when he has walked everything he is permitted to walk.
  // The refusal is announced there and not a moment before, so the caption
  // arrives with his body rather than with the scan that predicted it.
  const reachedStop = actor.travelled >= actor.permitted - 1e-6;
  if (survey.witness?.offered && !survey.witness.occupied) {
    // An established witness has stepped out: hold at the last safe sample,
    // keep the proof and the offer, and publish the resume objective.
    setSurveyHold(snapshot, 'reference-vacant', actor.sampledIndex + from);
    return;
  }
  if (result.reason && reachedStop) {
    // He has actually arrived at the place he cannot continue from.
    setSurveyHold(snapshot, result.reason, result.firstUnsupportedIndex);
    return;
  }
  if (actor.held && !reachedStop) {
    setSurveyHold(snapshot, 'body-clearance', actor.sampledIndex + from);
    return;
  }
  if (!result.reason) setSurveyHold(snapshot, null, -1);
  if (result.reason || !commonGroundActorArrived()) return;

  const routeClass: SurveyRouteClass = held ? 'held-reference' : 'fixed-reference';
  acceptTestedRoute(snapshot, routeClass);
  noteAnchor('anc.cg.route-tested');
}

/** True while the survey verbs are live: inside the beat, or for a later repeat. */
function surveyVerbsLive(): boolean {
  return runtime.beat === 'ch13-survey' || runtime.localTester;
}

/** [F] beside him: the survey opens actor-scoped and world-scoped, recording nothing. */
export function commitCommonGroundDemonstrationOffer(): boolean {
  if (!surveyVerbsLive()) return false;
  const snapshot = commonGroundSnapshot();
  if (snapshot.survey.phase !== 'idle') return false;
  snapshot.survey.phase = 'awaiting-start';
  noteAnchor('anc.cg.demonstration-opened');
  return true;
}

/** [F] at S: the first sample. Nothing was recorded beside the inspecting actor. */
export function commitCommonGroundSurveyStart(): boolean {
  if (!surveyVerbsLive()) return false;
  const snapshot = commonGroundSnapshot();
  if (snapshot.survey.phase !== 'awaiting-start') return false;
  const body = player();
  if (distanceBetween(body, CG_POSES.S) > CG_POINT_REACH) return false;
  const ground = footing();
  if (!ground || !ground.isSupported(body)) return false;
  // A NEW proposal. The accepted route and the class it earned are untouched,
  // and so is the fact that he once walked out to meet the first one.
  snapshot.survey.working = createTraceSlot({ x: body.x, y: body.y, z: body.z, corner: true });
  snapshot.survey.witness = null;
  snapshot.survey.approached = false;
  snapshot.survey.hold = { reason: null, atIndex: -1 };
  snapshot.survey.phase = 'drawing';
  runtime.lastPlayer = { ...body };
  noteAnchor('anc.cg.survey-started');
  return true;
}

/** [F] at the trace end: the proposal becomes physical. It is not proof. */
export function commitCommonGroundSpanOffer(): boolean {
  if (!surveyVerbsLive()) return false;
  const snapshot = commonGroundSnapshot();
  const slot = snapshot.survey.working;
  if (!slot || snapshot.survey.phase !== 'drawing') return false;
  if (slot.samples.length < 2) return false;
  slot.offeredEndIndex = slot.samples.length - 1;
  snapshot.survey.phase = 'offered';
  snapshot.survey.revisionReady = false;
  noteAnchor('anc.cg.route-offered');
  return true;
}

/**
 * [F] at the actual last tested point: reopen ONLY the unverified tail.
 *
 * A refusal alone never edits the proposal, and neither does a hold, a pause, a
 * failed input or a Continue. This is the one door, and it is the player's. His
 * body does not move: `approached` stays true, so the next offer resumes from
 * where he is standing instead of replaying the walk out to the start.
 */
export function commitCommonGroundTailReopen(): boolean {
  if (!surveyVerbsLive()) return false;
  const snapshot = commonGroundSnapshot();
  const slot = snapshot.survey.working;
  if (!slot) return false;
  const point = lastTestedPoint(slot);
  if (!point) return false;
  if (distanceBetween(player(), point) > CG_POINT_REACH) return false;
  noteAnchor('anc.cg.tail-reopened', { once: false });
  const changed = reviseTail(slot, Math.max(0, slot.testedPrefixCount - 1));
  snapshot.survey.phase = 'drawing';
  snapshot.survey.revisionReady = false;
  snapshot.survey.witness = null;
  snapshot.survey.hold = { reason: null, atIndex: -1 };
  runtime.holdReason = null;
  runtime.lastPlayer = { ...player() };
  if (changed) noteAnchor('anc.cg.route-revised', { once: false });
  return true;
}

/**
 * Whether standing here would actually extend what he can be shown.
 *
 * W IS ONE QUALIFIED EXAMPLE, NOT A STATION. The signed design permits any
 * grounded pose whose socket, range, sight and clearance genuinely hold the end
 * he cannot reach — including proactively, before any refusal. What it does not
 * permit is a prompt that appears everywhere: the offer is available exactly
 * where occupying it changes the answer.
 */
function witnessWouldExtendCoverage(snapshot: CommonGroundSnapshot, body: CommonGroundPoint): boolean {
  const ground = footing();
  const samples = offeredSamples(snapshot);
  if (!ground || samples.length === 0) return false;
  if (!ground.isSupported(body)) return false;
  if (!bodiesClear(body, commonGroundActorPosition())) return false;
  const options = { extraSolids: binding?.extraSolids ?? [], bodyHeight: WORKER_BODY_HEIGHT };
  const without = evaluateOfferedSpan(samples, { fixed: CG_FIXED_SOCKET, held: null }, ground, options);
  if (without.reason === null) return false;
  if (without.reason === 'footing-invalid') return false;
  const withHeld = evaluateOfferedSpan(
    samples, { fixed: CG_FIXED_SOCKET, held: playerSocket(body) }, ground, options
  );
  return withHeld.supportedPrefix > without.supportedPrefix;
}

/** [F] at a qualified grounded pose: a held end is a physical contribution. */
export function commitCommonGroundWitnessOffer(): boolean {
  if (!surveyVerbsLive()) return false;
  const snapshot = commonGroundSnapshot();
  const survey = snapshot.survey;
  // UNSAFE FOOTING IS NEVER REPAIRED BY OCCUPANCY. Bad ground is bad ground
  // whoever is watching it.
  if (survey.hold.reason === 'footing-invalid') return false;
  const body = player();
  if (!witnessWouldExtendCoverage(snapshot, body)) return false;
  survey.witness = {
    pose: { x: body.x, y: body.y, z: body.z },
    offered: true,
    occupied: true,
    requiredFromIndex: survey.hold.atIndex
  };
  setSurveyHold(snapshot, null, -1);
  noteAnchor('anc.cg.witness-held');
  return true;
}

/**
 * Voluntary revision readiness. Presentation only: it changes no route data and
 * no proof, and it never invents a refusal that did not happen.
 */
export function noteCommonGroundRevisionReady(): boolean {
  if (!surveyVerbsLive()) return false;
  const snapshot = commonGroundSnapshot();
  const slot = snapshot.survey.working;
  if (!slot || slot.offeredEndIndex == null) return false;
  if (slot.testedPrefixCount >= slot.samples.length) return false;
  if (snapshot.survey.revisionReady) return false;
  snapshot.survey.revisionReady = true;
  noteAnchor('anc.cg.revision-ready', { once: false });
  return true;
}

// --- ch13-common ----------------------------------------------------------------------

/** How far along a two-point leg a restored pose already is. */
function resumedLegUnits(
  pose: CommonGroundPoint | null,
  leg: readonly CommonGroundPoint[]
): number {
  if (!pose || leg.length < 2) return 0;
  const total = distanceBetween(leg[0], leg[leg.length - 1]);
  const done = distanceBetween(leg[0], pose);
  return Math.max(0, Math.min(total, done));
}

function tickCommon(dt: number): void {
  const snapshot = commonGroundSnapshot();
  const common = snapshot.common;
  const body = player();
  // THE PREVIOUS BODY, CAPTURED BEFORE IT IS OVERWRITTEN. Reading it after the
  // displacement update compares the body with itself, and a zero-length
  // "walked segment" check passes over any gap at all.
  const previousBody = runtime.lastPlayer ? { ...runtime.lastPlayer } : null;
  const displacement = playerDisplacement(body);
  const ground = footing();
  const solids = binding?.extraSolids ?? [];

  // FAIL CLOSED. Nothing about this beat can be measured without the world.
  if (!ground) return;

  if (common.stage === 'none') common.stage = 'positioning-to-h';

  if (common.stage === 'positioning-to-h') {
    setCommonGroundLeg({
      leg: 'position-to-h',
      points: CG_LEG_E_TO_H,
      key: 'cg:e-to-h',
      seedTravelled: resumedLegUnits(common.workerPose, CG_LEG_E_TO_H)
    });
    tickActor(dt);
    rememberWorkerPose(snapshot, 'common');
    if (!commonGroundActorArrived()) return;
    common.stage = 'holding-h';
    // The claim publishes only after his ACTUAL arrival, and this leg earns no
    // comparison or test credit and changes no score state beyond its binding.
    noteAnchor('anc.cg.reciprocal-reference');
    return;
  }

  if (common.stage === 'holding-h' && !common.comparisonProved) {
    setCommonGroundLeg({ leg: 'holding-h', points: [CG_POSES.H], key: 'cg:hold-h' });
    tickActor(dt);
    const socket = workerSocket(commonGroundActorPosition());
    // The same rules as every other test: live range, solid sight, grounding,
    // and an actual walked segment rather than a point that happens to be near.
    const walked = previousBody
      ? walkedSegmentSupported(previousBody, body, ground, { extraSolids: solids })
      : ground.isSupported(body);
    const supported = walked
      && checkReference(socket, playerSocket(body), referenceOptions()).ok;
    if (supported) {
      // The credit rule is unchanged; the corner state only lets a residual left
      // by an ordinary overshoot of a vertex the body ACTUALLY reached and
      // crossed be settled from displacement it actually walked there.
      const step = nextRouteCredit(
        CG_ROUTE_COMMON, body, common.terraUnits, displacement, runtime.routeCorner
      );
      common.terraUnits = step.units;
      runtime.routeCorner = step.corner;
    } else {
      // An unsupported frame proves nothing and banks nothing: the corner state
      // dies with the last live, guarded, referenced frame that earned it.
      runtime.routeCorner = NO_ROUTE_CREDIT_CORNER;
    }
    if (common.terraUnits >= CG_COMMON_ROUTE_UNITS - 1e-6) {
      common.comparisonProved = true;
      markMilestone(STORY_MILESTONES.ch13ReciprocalCrossed, snapshot.actorId);
      noteAnchor('anc.cg.reciprocal-crossed');
    }
    return;
  }

  if (!common.finalReferenceOffered) {
    setCommonGroundLeg({ leg: 'holding-h', points: [CG_POSES.H], key: 'cg:hold-h' });
    tickActor(dt);
    return;
  }

  // Live occupancy of the far reference, with the same hysteresis as the witness.
  const wasOccupied = common.finalReferenceOccupied;
  common.finalReferenceOccupied = nextOccupancy(wasOccupied, body, CG_POSES.T)
    && ground.isSupported(body);
  const socket = playerSocket(CG_POSES.T);

  // HER REFERENCE, AND ONLY HERS. The fixed apparatus plate is not a fallback
  // here: if it could quietly cover part of his test, her offer would be
  // decoration for the stretch the instrument already reaches, which is the
  // opposite of the thing this beat exists to prove. A vacant far reference
  // freezes his pose and keeps every earned unit — including the uncredited
  // repositioning leg, which needs the same reference to be walked at all.
  const referenceLive = common.finalReferenceOccupied;
  if (wasOccupied && !referenceLive) noteAnchor('anc.cg.reference-vacated', { once: false });
  if (!wasOccupied && referenceLive && common.stage !== 'holding-h') {
    // Reentry revalidates and resumes without another F.
    noteAnchor('anc.cg.reference-resumed', { once: false });
  }

  if (common.stage === 'holding-h') common.stage = 'positioning-to-e';
  if (common.stage === 'positioning-to-e') {
    // THE REPOSITIONING LEG NEEDS THE REFERENCE TOO. It earns no proof, but it
    // is only walkable because she is holding an end he can be seen from; a
    // vacant, out-of-range or occluded far reference freezes him where he is.
    if (!referenceLive || !referenceCoversWorker(socket, ground)) return;
    setCommonGroundLeg({
      leg: 'position-to-e',
      points: CG_LEG_H_TO_E,
      key: 'cg:h-to-e',
      seedTravelled: resumedLegUnits(common.workerPose, CG_LEG_H_TO_E)
    });
    tickActor(dt);
    rememberWorkerPose(snapshot, 'common');
    if (!commonGroundActorArrived()) return;
    common.stage = 'testing';
    return;
  }

  if (common.stage !== 'testing' && common.stage !== 'arrived') return;

  const evaluation = evaluateOfferedSpan(
    CG_ROUTE_COMMON,
    { fixed: CG_FIXED_SOCKET, held: referenceLive ? socket : null, useFixed: false },
    ground,
    { extraSolids: solids, bodyHeight: WORKER_BODY_HEIGHT }
  );
  setCommonGroundLeg({
    leg: 'independent-test',
    points: CG_LEG_INDEPENDENT_TEST,
    permittedIndex: Math.max(0, evaluation.supportedPrefix - 1),
    key: 'cg:independent-test',
    // Resumed at the units he had actually walked, not back at E.
    seedTravelled: runtime.resumeUnits
  });
  runtime.resumeUnits = 0;
  const actor = tickActor(dt);
  common.workerUnits = actor.travelled;
  rememberWorkerPose(snapshot, 'common');
  // The anchor begins only when the full traversal ACTUALLY starts — never at
  // the F offer, and never during the H to E positioning leg.
  if (actor.travelled > 0) noteAnchor('anc.cg.independent-test');

  if (!commonGroundActorArrived()) return;
  // ALL EIGHTEEN UNITS, AND HER PASSAGE. Neither alone is the proof.
  if (common.workerUnits + 1e-6 < CG_COMMON_ROUTE_UNITS) return;
  if (!common.comparisonProved) return;
  if (common.committed) return;
  common.committed = true;
  common.stage = 'arrived';
  markMilestone(STORY_MILESTONES.ch13Complete, snapshot.actorId);
  noteAnchor('anc.cg.complete');
  noteAnchor('anc.cg.handback');
  // Controls and progression are free in the same frame the guidance retires.
  completeChapter13();
}

/** Whether her held socket actually covers where his body is right now. */
function referenceCoversWorker(socket: CommonGroundPoint, ground: CommonGroundFooting): boolean {
  const at = commonGroundActorPosition();
  if (!ground.isSupported(at)) return false;
  return checkReference(socket, workerSocket(at), referenceOptions()).ok;
}

/** [F] at the separate far reference T: conditions for his choice, not a command. */
export function commitCommonGroundFinalReferenceOffer(): boolean {
  if (runtime.beat !== 'ch13-common') return false;
  const snapshot = commonGroundSnapshot();
  const common = snapshot.common;
  if (!common.comparisonProved || common.finalReferenceOffered) return false;
  const body = player();
  if (!nextOccupancy(false, body, CG_POSES.T)) return false;
  const ground = footing();
  if (ground && !ground.isSupported(body)) return false;
  common.finalReferenceOffered = true;
  common.finalReferenceOccupied = true;
  noteAnchor('anc.cg.final-reference-offered');
  return true;
}

// --- guidance -------------------------------------------------------------------------

export function commonGroundGuidanceFacts(): Partial<StoryObjectiveGuidanceFacts> {
  const snapshot = commonGroundSnapshot();
  const flight = getSpaceFlightSnapshot();
  const survey = snapshot.survey;
  const common = snapshot.common;
  return {
    ch13HomeState: snapshot.home.faultReviewed ? 'choose-return' : 'review',
    // THE ARRIVAL IS PART OF THE TRIP, NOT A SECOND DEPARTURE.
    //
    // Reading control mode first published `ch13:return:board` — "Follow the
    // hatch marker. [F] Board the Kestrel." — the moment the player stepped out
    // of the ship they had just landed at the audit site, and kept publishing it
    // for the whole walk to W-7744. It read a boarded/unboarded flag as if the
    // only reason to be on foot were that the trip had not started.
    //
    // The world is asked first instead. Once the enclosing world IS Origin and
    // the ship is actually down, this rung is the ARRIVAL: still boarded, the
    // real next action is to disembark; already embodied, it is to walk to the
    // marker. Both are the SAME objective id and the SAME `Origin · audit site`
    // label as the flight, so the standing copy is replaced in place with no
    // second entry cue, no milestone and no new input. Off Origin, and in the
    // air over it, nothing changes: boarding and lift keep their own real
    // readiness, and the descent keeps the signed flight work order.
    //
    // Nothing here completes anything. `tickReturn` still requires the actual
    // grounded Origin world, the embodied hand-back and the physical reach of
    // W-7744 before `anc.cg.origin-landed` and the survey.
    ch13ReturnState: (() => {
      const grounded = flight.phase === 'surface';
      if (onOrigin() && grounded) {
        return flight.controlMode === 'flight'
          ? ('origin-disembark' as const)
          : ('origin-on-foot' as const);
      }
      if (flight.controlMode !== 'flight') return 'board' as const;
      return grounded ? ('launch' as const) : ('origin' as const);
    })(),
    ch13SurveyState: (() => {
      if (survey.phase === 'idle') return 'offer' as const;
      if (survey.phase === 'awaiting-start') return 'start' as const;
      if (survey.phase === 'drawing') {
        const slot = survey.working;
        const ready = slot != null
          && slot.samples.length >= 2
          && distanceBetween(player(), CG_POSES.E) <= CG_POINT_REACH;
        return ready ? ('offer-span' as const) : ('draw' as const);
      }
      if (survey.phase === 'held') {
        if (survey.hold.reason === 'reference-vacant') return 'witness-return' as const;
        if (survey.hold.reason === 'footing-invalid') return 'revise' as const;
        // A body-clearance suspension keeps the standing order it interrupted:
        // the repair is somebody moving, not a route edit and not a held
        // reference. A suspension DURING THE APPROACH keeps the preparing copy —
        // the signed v2 variant names the clearance suspension explicitly as
        // part of the preparation state, and "is testing" would be false while
        // his body is still standing short of the offered start.
        if (survey.hold.reason === 'body-clearance') {
          return survey.approached ? ('test' as const) : ('test-preparing' as const);
        }
        return survey.witness?.offered ? ('witness-return' as const) : ('witness' as const);
      }
      if (survey.revisionReady) return 'revise' as const;
      return survey.approached ? ('test' as const) : ('test-preparing' as const);
    })(),
    ch13CommonState: (() => {
      if (!common.comparisonProved) {
        return common.stage === 'holding-h'
          ? ('reciprocal' as const)
          : ('reciprocal-preparing' as const);
      }
      if (!common.finalReferenceOffered) return 'offer-final-reference' as const;
      return common.finalReferenceOccupied ? ('release' as const) : ('reference-return' as const);
    })(),
    ch13HoldReason: holdReasonId(survey.hold.reason)
  };
}

// --- markers --------------------------------------------------------------------------

const _marker = new THREE.Vector3();

function vector(point: CommonGroundPoint | null): THREE.Vector3 | null {
  return point ? _marker.set(point.x, point.y, point.z).clone() : null;
}

/**
 * One marker authority. Every rung resolves to a REAL world handle: the actual
 * core, the actual ship, the actual worker body, the actual survey points and
 * the actual trace end. No rung invents a coordinate, and no mandatory rung is
 * left without a target.
 */
export function commonGroundMarkerTarget(objectiveId: string): THREE.Vector3 | null {
  const snapshot = commonGroundSnapshot();
  switch (objectiveId) {
    case 'ch13:home:review':
    case 'ch13:home:choose-return':
      return vector(tidegardenCorePosition());
    case 'ch13:return:board': {
      const ship = getShipPosition();
      return ship ? _marker.set(ship[0], ship[1], ship[2]).clone() : null;
    }
    case 'ch13:return:origin': {
      if (onOrigin()) return vector(CG_POSES.W);
      const body = readSystemCompanionBodyTarget(STORY_PRIMARY_WORLD_ID);
      return body ? body.clone() : null;
    }
    case 'ch13:survey:offer':
    case 'ch13:survey:test':
      return vector(commonGroundActorPosition());
    case 'ch13:survey:start':
      return vector(CG_POSES.S);
    case 'ch13:survey:draw':
      return vector(CG_POSES.E);
    case 'ch13:survey:offer-span': {
      const slot = snapshot.survey.working;
      const end = slot?.samples[slot.samples.length - 1] ?? null;
      return vector(end);
    }
    case 'ch13:survey:revise':
      return vector(lastTestedPoint(snapshot.survey.working));
    case 'ch13:survey:witness':
    case 'ch13:survey:witness-return':
      return vector(snapshot.survey.witness?.pose ?? CG_POSES.W);
    case 'ch13:common:reciprocal':
      return vector(CG_POSES.C);
    case 'ch13:common:offer-final-reference':
    case 'ch13:common:release':
    case 'ch13:common:reference-return':
      return vector(CG_POSES.T);
    default:
      return null;
  }
}

/** The marker projection space differs for the one interplanetary rung. */
export function commonGroundMarkerProjection(objectiveId: string): 'surface' | 'spatial' {
  return objectiveId === 'ch13:return:origin' && !onOrigin() ? 'spatial' : 'surface';
}

// --- interactions ---------------------------------------------------------------------

function reach(target: CommonGroundPoint | null, limit: number): boolean {
  return target !== null && distanceBetween(player(), target) <= limit;
}

export function ensureCommonGroundInteractions(): void {
  if (runtime.interactionsInstalled) return;
  runtime.interactionsInstalled = true;
  registerStoryInteraction((): StoryInteractionCandidate | null => {
    const beat = runtime.beat;
    if (!beat) return null;
    const snapshot = commonGroundSnapshot();
    switch (beat) {
      case 'ch13-home': {
        if (!reach(tidegardenCorePosition(), CG_CORE_REACH)) return null;
        if (!snapshot.home.faultReviewed) {
          return {
            id: 'story-ch13-fault-review',
            verb: 'Review the stored audit fault',
            perform: () => { commitCommonGroundFaultReview(); }
          };
        }
        if (snapshot.home.returnChosen) return null;
        return {
          id: 'story-ch13-choose-return',
          verb: 'Choose to revisit the Origin audit site',
          perform: () => { commitCommonGroundReturnChoice(); }
        };
      }
      case 'ch13-survey': {
        const survey = snapshot.survey;
        if (survey.phase === 'idle') {
          return reach(commonGroundActorPosition(), CG_ACTOR_REACH)
            ? {
                id: 'story-ch13-offer-route',
                verb: 'Offer to demonstrate a route',
                perform: () => { commitCommonGroundDemonstrationOffer(); }
              }
            : null;
        }
        if (survey.phase === 'awaiting-start') {
          return reach(CG_POSES.S, CG_POINT_REACH)
            ? {
                id: 'story-ch13-survey-start',
                verb: 'Begin recording your route',
                perform: () => { commitCommonGroundSurveyStart(); }
              }
            : null;
        }
        if (survey.phase === 'drawing') {
          const slot = survey.working;
          if (slot && slot.samples.length >= 2 && reach(CG_POSES.E, CG_POINT_REACH)) {
            return {
              id: 'story-ch13-offer-span',
              verb: 'Offer the walked span',
              perform: () => { commitCommonGroundSpanOffer(); }
            };
          }
          return null;
        }
        // A HELD END IS OFFERED WHEREVER STANDING THERE ACTUALLY HELPS.
        // W is the qualified example the marker points at, not an exclusive
        // station, and the offer is available proactively — she does not have to
        // wait to be refused before contributing. What it is not is a prompt
        // that follows her around: it appears exactly where occupying the pose
        // extends what he can be shown.
        if (!survey.witness?.offered && witnessWouldExtendCoverage(snapshot, player())) {
          return {
            id: 'story-ch13-hold-witness',
            verb: 'Offer this end',
            perform: () => { commitCommonGroundWitnessOffer(); }
          };
        }
        const revisionPoint = lastTestedPoint(survey.working);
        if (revisionPoint && reach(revisionPoint, CG_POINT_REACH)) {
          noteCommonGroundRevisionReady();
          return {
            id: 'story-ch13-revise-tail',
            verb: 'Reopen the untested span',
            perform: () => { commitCommonGroundTailReopen(); }
          };
        }
        return null;
      }
      case 'ch13-common': {
        const common = snapshot.common;
        if (!common.comparisonProved || common.finalReferenceOffered) return null;
        return reach(CG_POSES.T, CG_POINT_REACH)
          ? {
              id: 'story-ch13-offer-final-reference',
              verb: 'Offer this end',
              perform: () => { commitCommonGroundFinalReferenceOffer(); }
            }
          : null;
      }
      default:
        return null;
    }
  }, { owner: 'ch13-common-ground' });

  // The completed chapter's optional repeat. Registered separately because it
  // lives OUTSIDE any beat: the chapter is over, the accepted route is retained,
  // and he is still standing there as a local tester who will look at another
  // one. It grants nothing and re-earns nothing.
  registerStoryInteraction((): StoryInteractionCandidate | null => {
    if (!runtime.localTester) return null;
    const snapshot = commonGroundSnapshot();
    if (snapshot.survey.phase !== 'idle' && snapshot.survey.phase !== 'tested') return null;
    return reach(commonGroundActorPosition(), CG_ACTOR_REACH)
      ? {
          id: 'story-ch13-repeat-survey',
          verb: 'Demonstrate another route',
          interactionClass: 'optional-observation',
          perform: () => { commitCommonGroundRepeatSurvey(); }
        }
      : null;
  }, { owner: 'ch13-common-ground-repeat', interactionClass: 'optional-observation', priority: 100 });
}

/**
 * The optional repeat, after the chapter has handed back.
 *
 * It opens a NEW proposal and nothing else: the accepted route and the class it
 * earned stay retained, no milestone moves, no beat re-activates, the completion
 * texture is never replayed, and the chapter cannot be completed a second time.
 */
export function commitCommonGroundRepeatSurvey(): boolean {
  if (!runtime.localTester) return false;
  const snapshot = commonGroundSnapshot();
  if (snapshot.survey.phase !== 'idle' && snapshot.survey.phase !== 'tested') return false;
  clearUncommittedProposal(snapshot);
  snapshot.survey.phase = 'idle';
  cancelCommonGroundFinalTexture('optional-survey-action');
  return true;
}

/**
 * The persistent local tester, on frames the story does not own.
 *
 * After the handback he is not a chapter prop that vanished with its beat: he is
 * a body who stayed at the audit site. ONE POSE AUTHORITY, independent of
 * whether a chapter is active, and it never replays the A4 departure or the
 * completion texture. The same survey machinery drives an optional repeat, so a
 * second route is tested by the same predicates as the first.
 */
export function tickCommonGroundFreePlay(dt: number): void {
  const story = getStoryStateSnapshot();
  if (story.active || runtime.beat !== null) {
    runtime.localTester = false;
    return;
  }
  const actorId = getLocalActorId();
  if (!hasMilestone(STORY_MILESTONES.ch13Complete, actorId) || !onOrigin()) {
    runtime.localTester = false;
    return;
  }
  runtime.localTester = true;
  ensureCommonGroundInteractions();
  const snapshot = commonGroundSnapshot();
  const ground = footing();
  if (!ground) return;
  if (snapshot.survey.phase === 'idle' || snapshot.survey.phase === 'tested') {
    setCommonGroundLeg({ leg: 'arrived', points: [CG_POSES.C], key: 'cg:local-tester' });
    tickActor(dt);
    return;
  }
  tickSurvey(dt);
}

// --- lifecycle seams ------------------------------------------------------------------

/** Pause, focus loss and visibility loss cancel the live-only texture at once. */
export function suspendCommonGroundPresentation(
  reason: 'pause' | 'visibility-loss' | 'exit' | 'reset' | 'world-change' | 'actor-change'
): void {
  cancelCommonGroundFinalTexture(reason);
  // A suspension ends the frame the retry belongs to. An acknowledgement that
  // was refused before a pause is not published after it.
  //
  // A pause or a visibility loss leaves the chapter ON this beat, so the beat's
  // own entry anchor is still its current state and is retried by its first
  // tick — see `clearPendingAnchors`, and note that the boot itself arrives here
  // as 'pause'. An exit, reset, world change or actor change ends the entry, and
  // takes the entry queue with it.
  if (reason === 'pause' || reason === 'visibility-loss') clearPendingAnchors();
  else clearAnchorQueues();
  const snapshot = readCommonGroundLive(currentWorldId());
  if (snapshot) releaseLiveOccupancy(snapshot);
}

export function releaseCommonGroundChapter(): void {
  clearAnchorQueues();
  releaseCommonGroundScore(runtime.beat);
  releaseCommonGroundActor();
  runtime.beat = null;
}

/** Diagnostic read for probes and the debug panel. Never a progression source. */
export function getCommonGroundDiagnostic(): Record<string, unknown> {
  const snapshot = readCommonGroundLive(currentWorldId());
  const actor = getCommonGroundActorState();
  return {
    beat: runtime.beat,
    installWatch: runtime.installWatch,
    anchors: [...runtime.firedAnchors],
    holdReason: runtime.holdReason,
    worker: { ...actor, position: commonGroundActorPosition() },
    survey: snapshot
      ? {
          phase: snapshot.survey.phase,
          approached: snapshot.survey.approached,
          samples: snapshot.survey.working?.samples.length ?? 0,
          lengthUnits: snapshot.survey.working?.lengthUnits ?? 0,
          walkedUnits: snapshot.survey.working?.walkedUnits ?? 0,
          testedPrefix: snapshot.survey.working?.testedPrefixCount ?? 0,
          tailRevision: snapshot.survey.working?.tailRevision ?? 0,
          witnessOffered: snapshot.survey.witness?.offered ?? false,
          witnessOccupied: snapshot.survey.witness?.occupied ?? false,
          acceptedSamples: snapshot.survey.accepted?.samples.length ?? 0,
          acceptedClass: snapshot.survey.accepted?.routeClass ?? null
        }
      : null,
    common: snapshot
      ? {
          stage: snapshot.common.stage,
          terraUnits: snapshot.common.terraUnits,
          comparisonProved: snapshot.common.comparisonProved,
          finalReferenceOffered: snapshot.common.finalReferenceOffered,
          finalReferenceOccupied: snapshot.common.finalReferenceOccupied,
          workerUnits: snapshot.common.workerUnits,
          committed: snapshot.common.committed
        }
      : null
  };
}

/**
 * READ-ONLY probe snapshot for an independent verifier. Never a progression
 * source, and never a preparation.
 *
 * The existing journey probe can see the player, the worker, receipts and the
 * AV rail, but nothing of this chapter's own route state — so an independent
 * measurement could not tell a real survey from a synthetic fixture, could not
 * see which hold was live, and could not distinguish the capsule centre from
 * the grounded pose the predicates actually use. That is exactly the seam
 * VF-RAIL-2 turned out to be.
 *
 * Everything below is a copy of a value this module already computes for
 * gameplay. There is no setter, no handle, no mutable reference and nothing
 * that can be reached by normal play: `StoryDirectorDriver` publishes it only
 * under an explicit probe/debug query parameter.
 */
export interface CommonGroundProbeSnapshot {
  beat: StoryBeat | null;
  /** The raw Rapier capsule centre, as published by the physics body. */
  bodyCentre: readonly [number, number, number];
  /** The grounded body origin every predicate in this chapter measures from. */
  bodyPose: readonly [number, number, number];
  /** The live local up the conversion above used. */
  up: readonly [number, number, number];
  groundOffsetUnits: number;
  /** Whether the mounted world actually supports her at that grounded pose. */
  supported: boolean | null;
  worldBound: boolean;
  /**
   * The last plan the screening rail ACTUALLY EXECUTED, copied, or null.
   *
   * NOT a fresh call to the planner. `commonGroundRailPlan` advances the ordered
   * traversal cursor, so asking it what it would do IS the controller taking a
   * step: a probe that called it would steer the run it claims to be watching,
   * and in manual play it would run a controller nobody started. Null here means
   * exactly what it says — no rail has published a plan on this run — and never
   * a plan invented for the reader.
   */
  rail: {
    action: CommonGroundRailAction;
    target: readonly [number, number, number] | null;
    interactionId: string | null;
    reason: string;
    arriveRadius: number;
  } | null;
  /**
   * The screening controller's ordered cursor index, or null when no traversal
   * is in progress. CONTROLLER STATE, exposed only so an observer can tell a
   * stalled walk from a walked one; no predicate reads it and reading it here
   * cannot advance it.
   */
  railCursor: number | null;
  /**
   * The chapter's own score state, copied from the existing pure diagnostic:
   * which beat it is scoring, the mood actually current, and how far the
   * live-only completion texture has run. Reading it starts, cancels and
   * schedules nothing.
   */
  score: {
    beat: StoryBeat | null;
    mood: string | null;
    finalTextureSeconds: number | null;
  };
  diagnostic: Record<string, unknown>;
  pendingAnchors: readonly string[];
}

export function getCommonGroundProbeSnapshot(): CommonGroundProbeSnapshot {
  const centre = getPlayerWorldPosition();
  const up = getPlayerUp();
  const pose = commonGroundPlayerPose();
  const ground = footing();
  const plan = runtime.lastPublishedPlan;
  return {
    beat: runtime.beat,
    bodyCentre: [centre.x, centre.y, centre.z],
    bodyPose: [pose.x, pose.y, pose.z],
    up: [up.x, up.y, up.z],
    groundOffsetUnits: CG_PLAYER_GROUND_OFFSET,
    // A read of the world's own predicate at a pose. It allocates nothing in the
    // chapter and writes nothing anywhere.
    supported: ground ? ground.isSupported(pose) : null,
    worldBound: binding !== null,
    rail: plan
      ? {
          action: plan.action,
          target: plan.target ? [plan.target[0], plan.target[1], plan.target[2]] : null,
          interactionId: plan.interactionId,
          reason: plan.reason,
          arriveRadius: plan.arriveRadius
        }
      : null,
    railCursor: runtime.railTraversal ? runtime.railTraversal.index : null,
    score: (() => {
      const scoreState = getCommonGroundScoreDiagnostic();
      return {
        beat: scoreState.beat,
        mood: scoreState.mood,
        finalTextureSeconds: scoreState.finalTextureSeconds
      };
    })(),
    diagnostic: getCommonGroundDiagnostic(),
    // A detached copy of BOTH queues, entry first, so an observer sees the same
    // order the retry will use. Reading it runs nothing and changes nothing.
    pendingAnchors: [...runtime.entryAnchors, ...runtime.pendingAnchors]
  };
}

// --- rail plan ------------------------------------------------------------------------
//
// The ch13 rails use the SAME predicates and the SAME actions the player uses.
// This function decides nothing the player is not also being told; it is a
// reading of the live objective state expressed as move/look/act, and it can
// only ever produce an action the interaction resolver above already offers.
//
// It cannot grant, mark or advance anything. A rail that cannot make progress
// reports stuck, and stuck means stuck.

export type CommonGroundRailAction =
  | 'walk'
  | 'interact'
  | 'board'
  | 'launch'
  | 'fly'
  | 'land'
  | 'exit-ship'
  | 'hold';

export interface CommonGroundRailPlan {
  action: CommonGroundRailAction;
  target: readonly [number, number, number] | null;
  /** Only ever an id the live resolver is currently offering. */
  interactionId: string | null;
  /** Meaningful debug readout; permitted, and never a predicate. */
  reason: string;
  /**
   * The stop radius ordinary movement should use for this goal.
   *
   * A MOVE PARAMETER, NEVER A PREDICATE. Nothing downstream reads it to decide
   * that anything happened; it exists because one blanket radius either stops
   * the body short of a pose the live resolver measures, or cuts the corners of
   * a span the world measures in walked units.
   */
  arriveRadius: number;
}

/**
 * Reach tolerance for a route VERTEX: how close the body must be to count as
 * standing beside it. UNCHANGED (0.35). It is the cursor's tolerance, not the
 * walker's, and it is deliberately not narrowed: `vertexReached` still refuses
 * every turn the body has not physically crossed.
 */
const CG_RAIL_ROUTE_ARRIVE = 0.35;
/**
 * Stop radius the WALKER is given for a route waypoint. TIGHTER than the vertex
 * tolerance above, and tighter than it used to be (0.35).
 *
 * The two were one number, and conflating them is half of CG-IMPL-010. The
 * shared walker releases its controls inside `NAVIGATION_STEER_DEAD_ZONE` (0.2)
 * of the steered waypoint OR inside this stop radius, whichever is reached
 * first; the corner aim below has to clear whichever of the two is larger, or
 * the body parks short of the vertex plane and the cursor can never advance.
 * Handing the walker 0.35 spent the whole corner aim on a stop the cursor did
 * not need. Nothing is loosened by this: a smaller stop radius asks the body to
 * walk FURTHER, and the vertex tolerance is untouched.
 */
const CG_RAIL_ROUTE_STOP = 0.15;
/** Stop radius for a named pose: well inside the 1.25-unit occupancy cylinder. */
const CG_RAIL_POSE_ARRIVE = 0.6;
/** Stop radius beside a body: inside actor reach, outside body clearance. */
const CG_RAIL_BODY_ARRIVE = 2.4;
/** Stop radius at the habitat core, unchanged from the shipped approach. */
const CG_RAIL_CORE_ARRIVE = 1.2;

const HOLD: CommonGroundRailPlan = {
  action: 'hold', target: null, interactionId: null, reason: 'nothing to do',
  arriveRadius: CG_RAIL_POSE_ARRIVE
};

/**
 * STANDING CLEAR IS A PLACE, AND THE PLACE HAS TO EXIST.
 *
 * The shipped standby derived one point arithmetically — `E.z - 3` — and it is
 * not ground. MEASURED on the real generator at the audit site's own identity
 * (seed 3215739679, world `-1,-1`, planetSize 50, `VOXEL_SCALE` 2): every cell
 * south of the survey line at `x = -42` is WATER. The shipped planner therefore
 * answered `requestedGoalWasWet`, substituted the nearest dry cell — the one the
 * body was already standing in — and returned `already-at-resolved-goal` with a
 * single waypoint. The rail kept publishing a walk, the body never moved, and
 * W-7744 waited on a clearance she could not give him. It was not the odd
 * coordinate: the lattice-aligned `z = 10` is under the same water.
 *
 * The replacement is a SELECTION, not a second constant, because the span he is
 * testing is whatever she actually recorded, not an authored route. A candidate
 * qualifies only if the live footing supports it and it clears — from polyline
 * SEGMENTS, not vertices — every span he still has to walk: his current leg
 * through the remaining offered samples, his positioning leg E->H, and the
 * common route (which is also his independent test). Nearest qualifying
 * candidate wins, so she walks the shortest honest distance off his path.
 *
 * If nothing qualifies she is told nothing, and `walkTo` reports a hold. A rail
 * that cannot make progress reports stuck; it does not invent a place to stand.
 */
const CG_STANDBY_CLEARANCE_UNITS = BODY_BODY_CLEARANCE_UNITS * 2 + CG_RAIL_POSE_ARRIVE;

/**
 * Candidate standby positions: voxel cell centres on the audit site's dry
 * shelf, each one confirmed supported by the shipped footing rule over the real
 * generator and reachable from S, E, W and C by the shipped surface planner
 * (`dry-surface-path`, not a substituted goal). They are waiting places only —
 * no pose, route, socket, reference or objective is defined here, and nothing
 * is asked of the player that ordinary movement does not already do.
 */
const CG_STANDBY_CANDIDATES: readonly CommonGroundPoint[] = Object.freeze([
  { x: -40, y: CG_POSES.E.y, z: 8 },
  { x: -38, y: CG_POSES.E.y, z: 8 },
  { x: -36, y: CG_POSES.E.y, z: 6 },
  { x: -36, y: CG_POSES.E.y, z: 16 },
  { x: -30, y: CG_POSES.E.y, z: 8 },
  { x: -46, y: CG_POSES.E.y, z: 22 },
  { x: -48, y: CG_POSES.E.y, z: 22 }
].map(point => Object.freeze(point)));

/** Planar distance from a point to a SEGMENT — the thing his body walks. */
function segmentDistance(
  point: CommonGroundPoint,
  from: CommonGroundPoint,
  to: CommonGroundPoint
): number {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const lengthSq = dx * dx + dz * dz;
  const px = point.x - from.x;
  const pz = point.z - from.z;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, (px * dx + pz * dz) / lengthSq));
  return Math.hypot(px - t * dx, pz - t * dz);
}

/** Clearance from a whole walked span. A vertex-only test misses the middle. */
function spanClearance(point: CommonGroundPoint, span: readonly CommonGroundPoint[]): number {
  if (span.length === 0) return Infinity;
  const head = span[0];
  if (!head) return Infinity;
  if (span.length === 1) return Math.hypot(point.x - head.x, point.z - head.z);
  let nearest = Infinity;
  for (let index = 0; index < span.length - 1; index += 1) {
    const from = span[index];
    const to = span[index + 1];
    if (!from || !to) continue;
    nearest = Math.min(nearest, segmentDistance(point, from, to));
  }
  return nearest;
}

/** Everything his body still has to walk through, from LIVE state. */
function standbySpans(snapshot: CommonGroundSnapshot): ReadonlyArray<readonly CommonGroundPoint[]> {
  const spans: Array<readonly CommonGroundPoint[]> = [
    [commonGroundActorPosition()],
    CG_LEG_E_TO_H,
    // His independent test IS the common route, and she walks it herself
    // afterwards; a standby parked on it would block both.
    CG_ROUTE_COMMON
  ];
  const samples = offeredSamples(snapshot);
  const slot = snapshot.survey.working;
  if (samples.length > 0 && slot) {
    // The span he is actually testing: from where he stands, through every
    // sample he has not tested yet. Recorded samples, never an authored route.
    const from = Math.max(0, Math.min(slot.testedPrefixCount - 1, samples.length - 1));
    spans.push([commonGroundActorPosition(), ...samples.slice(from)]);
  }
  return spans;
}

/** The nearest qualifying place to wait, or null when there honestly is none. */
function standbyPoint(
  snapshot: CommonGroundSnapshot,
  body: CommonGroundPoint
): CommonGroundPoint | null {
  const ground = footing();
  const spans = standbySpans(snapshot);
  let best: CommonGroundPoint | null = null;
  let bestDistance = Infinity;
  for (const candidate of CG_STANDBY_CANDIDATES) {
    // Real terrain, when the world is bound: a waiting place she cannot stand
    // on is the bug this replaces.
    if (ground && !ground.isSupported(candidate)) continue;
    let clear = true;
    for (const span of spans) {
      if (spanClearance(candidate, span) < CG_STANDBY_CLEARANCE_UNITS) {
        clear = false;
        break;
      }
    }
    if (!clear) continue;
    const distance = distanceBetween(body, candidate);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return best;
}

function walkTo(
  point: CommonGroundPoint | null,
  reason: string,
  arriveRadius = CG_RAIL_POSE_ARRIVE
): CommonGroundRailPlan {
  if (!point) {
    return {
      action: 'hold', target: null, interactionId: null, reason: `${reason}: no target`,
      arriveRadius
    };
  }
  return {
    action: 'walk', target: [point.x, point.y, point.z], interactionId: null, reason, arriveRadius
  };
}

function act(
  id: string,
  point: CommonGroundPoint,
  reason: string,
  arriveRadius = CG_RAIL_POSE_ARRIVE
): CommonGroundRailPlan {
  return {
    action: 'interact', target: [point.x, point.y, point.z], interactionId: id, reason, arriveRadius
  };
}

// --- ordered controller traversal -----------------------------------------------------
//
// An authored polyline is walked IN ORDER.
//
// The previous scan was stateless: it took the first point farther than a fixed
// radius from the body, so the instant the body left the start by more than that
// radius the already-walked start became the next target again, and the walk
// oscillated at the first vertex instead of crossing the span.
//
// THIS CURSOR IS CONTROLLER STATE AND NOTHING ELSE. It emits a move goal. It
// grants no units, proves no passage, and no predicate anywhere reads it: the
// walked span is still measured only by `routeProgressUnits` from the body's
// ACTUAL frame-by-frame displacement, and the survey trace is still only the
// samples the body actually produced on supported ground. When the body is not
// where an ordinary forward walk could have left it — a beat change, a Continue,
// a revision, a different route, a restored pose — the cursor is rebuilt from
// where the body genuinely is, and never from anywhere ahead of it.

/**
 * Aim PAST a corner rather than at it.
 *
 * `routeProgressUnits` credits at most the displacement of the frame it is
 * given, so a body that cuts a corner advances its own projection farther than
 * it actually walked and permanently loses the difference — the 18-unit span
 * then never closes however long the walk continues. Walking THROUGH the vertex
 * costs a little extra real distance and keeps arc gain at or under displacement
 * on every frame, which is what lets the honest predicate close by itself.
 */
const CG_RAIL_CORNER_OVERSHOOT = 0.24;
/**
 * WHY 0.24, MEASURED RATHER THAN CHOSEN.
 *
 * The aim has to clear two real walls at once, and on the western end of the
 * COMMON polyline they very nearly meet.
 *
 * FLOOR — the aim must be further past the vertex plane than the walker's own
 * release radius, or the body stops short and `vertexReached` (which demands an
 * actual crossing at a turn) never fires. The release radius is
 * `NAVIGATION_STEER_DEAD_ZONE` = 0.2, and `CG_RAIL_ROUTE_STOP` above is smaller
 * than that, so the floor is 0.2.
 *
 * CEILING — the navigator hands the exact goal its last leg only while the
 * capsule's footprint there is certified by the same planner. With
 * `VOXEL_SCALE` 2 and a 0.5 capsule radius that footprint reaches 0.5 from the
 * cell centre, and on a cube planet the local up is TILTED: discarding the
 * normal component of the 1.8-unit gap between an authored foot goal (y 51.05)
 * and a waypoint carrying the planner's clearance (y 52.85) leaves a real
 * tangential residue of 1.8 * |up.x| * up.y. At COMMON vertex 6, (-48, ., 18),
 * one cell from the planet-face edge, that residue is ~0.256 by the time the
 * body is at the vertex plane. 0.2 + 0.256 = 0.456: the entire slack at that
 * corner is ~0.044 of a unit, and the shipped 0.6 spent it four times over.
 * That — not the 0.6 arithmetic alone — is why the exact-goal handoff was
 * refused at COMMON vertices 3, 6 and 9 while every SURVEY corner certified.
 *
 * 0.24 sits above the floor and leaves the handoff standing past the plane at
 * all three. NOTHING here widens a radius, weakens the dead zone, bypasses the
 * footprint certification or credits a unit: the aim moved, the proof did not.
 * `main/src/story/autopilot/primitives.test.ts` measures both walls against the
 * real Origin terrain, the real planner and the real steering seam.
 */
/** Beyond this the body is not on the leg the cursor believes it is walking. */
const CG_RAIL_LEG_TOLERANCE = 3;
/** How far THROUGH the head of a polyline an approach aims. */
const CG_RAIL_START_AIM = 0.35;

interface CommonGroundRailTraversal {
  /** Run, actor, world, beat and route identity. A change forces a rebuild. */
  key: string;
  /** Index of the vertex the controller is currently walking toward. */
  index: number;
}

interface RailRouteOptions {
  /** Stop radius the body will actually use for these waypoints. */
  readonly arrive: number;
  /** How far past the polyline's own final vertex a completed traversal aims. */
  readonly terminalOvershoot: number;
}

interface SegmentProjection {
  readonly t: number;
  readonly distance: number;
}

function projectOnSegment(
  from: CommonGroundPoint,
  to: CommonGroundPoint,
  body: CommonGroundPoint
): SegmentProjection {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const lengthSq = dx * dx + dy * dy + dz * dz;
  if (!(lengthSq > 0)) return { t: 0, distance: distanceBetween(body, from) };
  const t = Math.max(0, Math.min(1,
    ((body.x - from.x) * dx + (body.y - from.y) * dy + (body.z - from.z) * dz) / lengthSq));
  const closest = { x: from.x + dx * t, y: from.y + dy * t, z: from.z + dz * t };
  return { t, distance: distanceBetween(body, closest) };
}

/** Unit direction INTO `route[index]`, or null at the head of the polyline. */
function legDirection(
  route: readonly CommonGroundPoint[],
  index: number
): CommonGroundPoint | null {
  if (index <= 0 || index >= route.length) return null;
  const from = route[index - 1];
  const to = route[index];
  const length = distanceBetween(from, to);
  if (!(length > 0)) return null;
  return { x: (to.x - from.x) / length, y: (to.y - from.y) / length, z: (to.z - from.z) / length };
}

/** True when the polyline actually changes direction at this vertex. */
function routeTurnsAt(route: readonly CommonGroundPoint[], index: number): boolean {
  const into = legDirection(route, index);
  const out = legDirection(route, index + 1);
  if (!into || !out) return false;
  return into.x * out.x + into.y * out.y + into.z * out.z < 0.999;
}

/** The body has genuinely reached this vertex: standing at it, or past it. */
function vertexReached(
  route: readonly CommonGroundPoint[],
  index: number,
  body: CommonGroundPoint,
  arrive: number
): boolean {
  const point = route[index];
  const distance = distanceBetween(body, point);
  const direction = legDirection(route, index);
  if (!direction) return distance <= arrive;
  const along = (body.x - point.x) * direction.x
    + (body.y - point.y) * direction.y
    + (body.z - point.z) * direction.z;
  // Past the vertex plane, and still beside the vertex rather than somewhere
  // else on the map that happens to lie on the far side of it.
  const passed = along >= 0 && distance <= arrive + CG_RAIL_CORNER_OVERSHOOT + 1;
  // AT A TURN THE BODY MUST ACTUALLY PASS THE VERTEX.
  //
  // Turning even a fraction of a unit early cuts the corner, and a cut corner
  // swings the body's own projection AROUND the corner farther than the body
  // walked in that frame. `routeProgressUnits` refuses that frame outright —
  // its allowance is exactly the displacement it was given — and the refusal is
  // permanent, because every later projection is then further beyond the
  // allowance than the last. Measured with a walking body, four cut corners
  // froze the eighteen-unit comparison at four. A straight vertex has no corner
  // to cut, so arriving inside the stop radius is enough there.
  if (routeTurnsAt(route, index)) return passed;
  return passed || distance <= arrive;
}

/**
 * Rebuild the cursor from where the body ACTUALLY is.
 *
 * The rebuilt index is the vertex ahead of the body's own projection, so a
 * reconstruction can only ever aim at a point the body has not passed. It reads
 * the body and the authored polyline and nothing else — no recorded progress,
 * no milestone, no receipt — so it cannot manufacture a position.
 */
function reconstructRouteCursor(
  route: readonly CommonGroundPoint[],
  body: CommonGroundPoint,
  arrive: number
): number {
  if (route.length <= 1) return Math.max(0, route.length - 1);
  let bestDistance = Number.POSITIVE_INFINITY;
  let cursor = 0;
  for (let index = 1; index < route.length; index += 1) {
    const projection = projectOnSegment(route[index - 1], route[index], body);
    if (projection.distance > bestDistance) continue;
    bestDistance = projection.distance;
    cursor = projection.t >= 1 - 1e-6 ? Math.min(index + 1, route.length - 1) : index;
    // Still short of the head: the head is what to walk to.
    if (index === 1 && projection.t <= 1e-6 && distanceBetween(body, route[0]) > arrive) cursor = 0;
  }
  return cursor;
}

/** The move goal for a cursor position, aimed through corners and the end. */
function railGoal(
  route: readonly CommonGroundPoint[],
  index: number,
  options: RailRouteOptions
): CommonGroundPoint {
  const point = route[index];
  const direction = legDirection(route, index);
  if (!direction) return point;
  const overshoot = index === route.length - 1
    ? options.terminalOvershoot
    : (routeTurnsAt(route, index) ? CG_RAIL_CORNER_OVERSHOOT : 0);
  if (!(overshoot > 0)) return point;
  return {
    x: point.x + direction.x * overshoot,
    y: point.y + direction.y * overshoot,
    z: point.z + direction.z * overshoot
  };
}

/** A point a step through the head of a polyline, along its own first leg. */
function routeHeadApproach(route: readonly CommonGroundPoint[]): CommonGroundPoint {
  const head = route[0];
  const direction = legDirection(route, 1);
  if (!direction) return head;
  return {
    x: head.x + direction.x * CG_RAIL_START_AIM,
    y: head.y + direction.y * CG_RAIL_START_AIM,
    z: head.z + direction.z * CG_RAIL_START_AIM
  };
}

/** Identity of the traversal in progress. Any change rebuilds it honestly. */
function railRouteKey(tag: string, route: readonly CommonGroundPoint[]): string {
  const head = route[0];
  const tail = route[route.length - 1];
  return [
    runtime.runId, runtime.actorId, currentWorldId(), runtime.beat ?? 'none', tag,
    route.length, `${head.x},${head.y},${head.z}`, `${tail.x},${tail.y},${tail.z}`
  ].join('|');
}

/** The ordered next goal on an authored polyline. Controller state only. */
function railWaypoint(
  route: readonly CommonGroundPoint[],
  body: CommonGroundPoint,
  key: string,
  options: RailRouteOptions
): CommonGroundPoint {
  const last = route.length - 1;
  if (last <= 0) return route[Math.max(0, last)] ?? body;
  let traversal = runtime.railTraversal;
  if (!traversal || traversal.key !== key) {
    traversal = { key, index: reconstructRouteCursor(route, body, options.arrive) };
    runtime.railTraversal = traversal;
  } else if (traversal.index > 0) {
    const leg = projectOnSegment(route[traversal.index - 1], route[traversal.index], body);
    if (leg.distance > CG_RAIL_LEG_TOLERANCE) {
      // Not on the leg it believes it is walking. Something moved the body that
      // was not this walk; rebuild from the body rather than steering at a
      // vertex it never approached.
      traversal.index = reconstructRouteCursor(route, body, options.arrive);
    }
  }
  // Ordinary forward progress: consume only vertices the body has REACHED, and
  // never reconsider one behind it.
  while (traversal.index < last && vertexReached(route, traversal.index, body, options.arrive)) {
    traversal.index += 1;
  }
  return railGoal(route, traversal.index, options);
}

/**
 * True while her body sits on the part of the offered span he still has to walk.
 *
 * Read from the offered samples ahead of his tested prefix under the SAME
 * clearance rule that holds his leg, so the rail steps out of a hold it is
 * itself causing instead of leaving him waiting on her — and instead of
 * offering a witness, which repairs an end he cannot reach and has never
 * repaired a body standing in the way.
 */
function standingOnHisTest(snapshot: CommonGroundSnapshot, body: CommonGroundPoint): boolean {
  const survey = snapshot.survey;
  if (survey.phase !== 'offered' && survey.phase !== 'testing' && survey.phase !== 'held') return false;
  // A real reference hold is repaired by the witness branch below, at a pose
  // that is off the trace anyway. Only her own obstruction is answered here.
  if (survey.hold.reason !== null && survey.hold.reason !== 'body-clearance') return false;
  // An established, occupied witness is a contribution, not an obstruction.
  if (survey.witness?.offered && survey.witness.occupied) return false;
  const slot = survey.working;
  if (!slot) return false;
  const samples = offeredSamples(snapshot);
  const from = Math.max(0, Math.min(slot.testedPrefixCount - 1, samples.length - 1));
  for (let index = from; index < samples.length; index += 1) {
    if (!bodiesClear(body, samples[index])) return true;
  }
  return false;
}

export function commonGroundRailPlan(): CommonGroundRailPlan {
  const beat = runtime.beat;
  if (!beat) return HOLD;
  const snapshot = commonGroundSnapshot();
  const body = player();
  switch (beat) {
    case 'ch13-home': {
      const core = tidegardenCorePosition();
      if (!core) return { ...HOLD, reason: 'habitat core not mounted' };
      if (distanceBetween(body, core) > CG_CORE_REACH) {
        return walkTo(core, 'walking to the core', CG_RAIL_CORE_ARRIVE);
      }
      return snapshot.home.faultReviewed
        ? act('story-ch13-choose-return', core, 'choosing the return', CG_RAIL_CORE_ARRIVE)
        : act('story-ch13-fault-review', core, 'reviewing the stored fault', CG_RAIL_CORE_ARRIVE);
    }
    case 'ch13-return': {
      const flight = getSpaceFlightSnapshot();
      if (flight.controlMode !== 'flight') {
        if (onOrigin()) {
          // W IS HIS POSE, NOT AN EMPTY MARK. He is already mounted and
          // inspecting there by the time she lands, so the approach stops at
          // body distance — inside the reach this beat closes on, and outside
          // the clearance his own leg is held by. Walking onto him would
          // manufacture the body-clearance stand-off the chapter is careful
          // never to resolve by displacing anybody.
          return walkTo(CG_POSES.W, 'approaching W-7744 on foot', CG_RAIL_BODY_ARRIVE);
        }
        const ship = getShipPosition();
        if (!ship) return { ...HOLD, reason: 'no ship pose' };
        return {
          action: 'board', target: ship, interactionId: null, reason: 'boarding the Kestrel',
          arriveRadius: CG_RAIL_BODY_ARRIVE
        };
      }
      if (onOrigin()) {
        if (flight.phase === 'surface') {
          return { ...HOLD, action: 'exit-ship', reason: 'landed at Origin' };
        }
        return { ...HOLD, action: 'land', reason: 'descending to the audit site' };
      }
      if (flight.phase === 'surface') {
        return { ...HOLD, action: 'launch', reason: 'igniting and lifting' };
      }
      return { ...HOLD, action: 'fly', reason: 'crossing to Origin' };
    }
    case 'ch13-survey':
    case 'ch13-common': {
      // BOTH OF THESE BEATS HAPPEN ON FOOT.
      //
      // The causal owner of the boarded entry is the deep-link seeding in
      // `storyState.initStoryFromSave`, which is repaired at source. This is the
      // screening's own recovery, not a substitute for it: if a rail ever finds
      // itself holding surface FLIGHT controls during an on-foot beat, walking
      // does nothing at all and the run stalls forever (measured: 243 s, zero
      // displacement, W-7744 mounted 44 m away). Leaving a landed ship is the
      // shipped ordinary action a player takes here, through the same
      // `exitShip` the ch13-return branch below already uses.
      //
      // It is NOT a per-frame auto-disembark: this plan is reached only by the
      // screening rail, only inside these two beats, and only while the ship is
      // parked on the surface with flight controls held. A player's own
      // boarding during free movement is never touched, no milestone is
      // granted, and nothing here advances the chapter.
      const onFootFlight = getSpaceFlightSnapshot();
      if (onFootFlight.controlMode === 'flight' && onFootFlight.phase === 'surface') {
        return { ...HOLD, action: 'exit-ship', reason: 'leaving the landed ship for an on-foot beat' };
      }
      return beat === 'ch13-survey'
        ? surveyRailPlan(snapshot, body)
        : commonRailPlan(snapshot, body);
    }
    default:
      return HOLD;
  }
}

function surveyRailPlan(
  snapshot: CommonGroundSnapshot,
  body: CommonGroundPoint
): CommonGroundRailPlan {
  const survey = snapshot.survey;
if (survey.phase === 'idle') {
  const worker = commonGroundActorPosition();
  return distanceBetween(body, worker) > CG_ACTOR_REACH
    ? walkTo(worker, 'approaching W-7744', CG_RAIL_BODY_ARRIVE)
    : act('story-ch13-offer-route', worker, 'offering to demonstrate a route', CG_RAIL_BODY_ARRIVE);
}
if (survey.phase === 'awaiting-start') {
  // ARRIVE, THEN RECORD.
  //
  // The resolver offers this two units out and a player may take it
  // there. The rail must not, because the FIRST SAMPLE IS WRITTEN AT THE
  // BODY'S ACTUAL POSE: recording two units short of the start, on the
  // approach line in from his inspection pose, put the opening samples in
  // the survey housing's shadow and stopped his first-try test on an
  // occlusion the authored route does not contain.
  //
  // So the approach is aimed a step THROUGH the start along the route's
  // own first leg. The clean side of the start is the side the route
  // leaves by, and aiming through it puts the settling body there instead
  // of behind it. The act reach is the aim plus the stop radius, so the
  // body can never settle outside the reach it is waiting on.
  if (distanceBetween(body, CG_POSES.S) > CG_RAIL_START_AIM + CG_RAIL_ROUTE_ARRIVE) {
    return walkTo(
      routeHeadApproach(CG_ROUTE_LONG_RAIL), 'walking to the survey start', CG_RAIL_ROUTE_ARRIVE
    );
  }
  return act('story-ch13-survey-start', CG_POSES.S, 'beginning the recording', CG_RAIL_ROUTE_ARRIVE);
}
if (survey.phase === 'drawing') {
  // The measured LONG route: supported end to end from the fixed
  // reference, so a screening demonstrates the first-try-legal class
  // without needing the contingent witness to exist.
  // A PLAYER may offer the span anywhere inside the resolver's reach; the
  // rail waits until the body has actually ARRIVED at the authored end,
  // so the span it demonstrates is the whole walked route rather than one
  // that stops two units short of it. This tightens only what the rail
  // does, never what the resolver offers.
  if (distanceBetween(body, CG_POSES.E) <= CG_RAIL_POSE_ARRIVE
    && (survey.working?.samples.length ?? 0) >= 2) {
    return act('story-ch13-offer-span', CG_POSES.E, 'offering the walked span');
  }
  // Ordered traversal, keyed to the revision so a reopened tail is
  // rebuilt from his actual last tested pose rather than replayed.
  const options: RailRouteOptions = {
    arrive: CG_RAIL_ROUTE_ARRIVE,
    // The end of this span is a PLACE she has to be near, not a walked
    // total, and the fixed reference's range is tight at that corner, so
    // the traversal stops at the authored end instead of past it.
    terminalOvershoot: 0
  };
  const key = railRouteKey(`survey-long:${survey.working?.tailRevision ?? 0}`, CG_ROUTE_LONG_RAIL);
  return walkTo(
    railWaypoint(CG_ROUTE_LONG_RAIL, body, key, options),
    'walking the demonstrated route',
    CG_RAIL_ROUTE_STOP
  );
}
// STAND CLEAR OF HIS TEST. Her last recorded sample is under her own feet,
// and that sample is on the span he now has to walk. A body in the way
// holds him rather than displacing her, so the honest answer is ordinary
// movement off the trace — NOT an intermediate witness, which repairs a
// reference she cannot reach and never repairs her own obstruction.
if (standingOnHisTest(snapshot, body)) {
  return walkTo(standbyPoint(snapshot, body), 'standing clear of the span he is testing');
}
if (survey.hold.reason && survey.hold.reason !== 'footing-invalid'
  && survey.hold.reason !== 'body-clearance' && !survey.witness?.offered) {
  return distanceBetween(body, CG_POSES.W) > CG_POINT_REACH
    ? walkTo(CG_POSES.W, `repairing ${survey.hold.reason} by occupying the marked reference`)
    : act('story-ch13-hold-witness', CG_POSES.W, 'offering the intermediate reference');
}
if (survey.hold.reason === 'reference-vacant') {
  return walkTo(survey.witness?.pose ?? CG_POSES.W, 'returning to the marked reference');
}
if (survey.hold.reason === 'footing-invalid') {
  const point = lastTestedPoint(survey.working);
  if (!point) return { ...HOLD, reason: 'no tested point to revise from' };
  return distanceBetween(body, point) > CG_POINT_REACH
    ? walkTo(point, 'returning to the last tested point')
    : act('story-ch13-revise-tail', point, 'reopening the untested span');
}
  return { ...HOLD, reason: 'following his test' };
}

function commonRailPlan(
  snapshot: CommonGroundSnapshot,
  body: CommonGroundPoint
): CommonGroundRailPlan {
  const common = snapshot.common;
if (!common.comparisonProved) {
  if (common.stage !== 'holding-h') {
    // STAND CLEAR. He walks E -> H, and his first step is off the pose she
    // would otherwise be standing on; a body in the way holds him forever
    // rather than displacing her, so the honest instruction is to move.
    return walkTo(standbyPoint(snapshot, body), 'standing clear while he takes the reference');
  }
  // The span is measured in WALKED UNITS, so this traversal walks through
  // every corner and through the far end. It earns nothing by arriving:
  // `routeProgressUnits` still credits only actual displacement inside the
  // corridor, frame by frame.
  const options: RailRouteOptions = {
    arrive: CG_RAIL_ROUTE_ARRIVE,
    terminalOvershoot: CG_RAIL_CORNER_OVERSHOOT
  };
  const key = railRouteKey('common', CG_ROUTE_COMMON);
  return walkTo(
    railWaypoint(CG_ROUTE_COMMON, body, key, options),
    'walking the common span',
    CG_RAIL_ROUTE_STOP
  );
}
if (!common.finalReferenceOffered) {
  // The offer is only accepted from INSIDE the occupancy cylinder, so the
  // rail closes to its stop radius before pressing rather than spending
  // the cadence on attempts the transaction will refuse.
  return distanceBetween(body, CG_POSES.T) > CG_RAIL_POSE_ARRIVE
    ? walkTo(CG_POSES.T, 'walking to the far reference')
    : act('story-ch13-offer-final-reference', CG_POSES.T, 'offering the far end');
}
  return common.finalReferenceOccupied
    ? { ...HOLD, reason: 'holding the far reference while he tests' }
    : walkTo(CG_POSES.T, 'returning to the far reference');
}

/**
 * The structural surface a ch13 rail needs. Declared here rather than importing
 * `RailRuntime`, because `autopilot/primitives.ts` reaches the beat contracts
 * (which reach the rails) and a value import back into it would close a cycle.
 */
export interface CommonGroundRailContext {
  clearControls(): void;
  controls: { forward: boolean; jump: boolean; sprint: boolean; interact: boolean };
  _goalScratch: THREE.Vector3;
  /**
   * The shared walker. `stop` is the radius the feet stop inside; `lookLift`
   * raises the gaze onto the goal's subject. The third argument was previously
   * declared here as a slow radius, which the shared walker does not have.
   */
  walkToward(goal: THREE.Vector3, stop: number, lookLift?: number): number;
  getPlayerWorldPosition(): THREE.Vector3;
  enterShip(): void;
  exitShip(): void;
  getSpaceFlightSnapshot(): { controlMode: string; phase: string };
  /**
   * The shared performer, and the ONLY door to an act.
   *
   * The screening cadence is deliberately absent from this surface. It belongs
   * to the performer, which re-resolves the live interaction, re-checks its
   * proximity and every transaction predicate, and spends the dwell only when
   * an act has actually happened. A chapter rail that consumed the cadence
   * first left the performer refusing the act it had just paid for.
   */
  performStoryInteraction(id: never): unknown;
}

/**
 * The one ch13 rail body, shared by all four beats because they do the same
 * thing: read the plan the director already published FOR THE PLAYER, and press
 * it. Move, look, act — nothing else. The plan can only ever name an interaction
 * the live resolver is currently offering, so a screening cannot reach a verb a
 * player could not, and nothing here grants, marks or advances anything.
 */
export function applyCommonGroundRail(ctx: CommonGroundRailContext): CommonGroundRailPlan {
  ctx.clearControls();
  const plan = commonGroundRailPlan();
  // The one place a plan is published, because it is the one place a plan is
  // acted on. The read-only probe reports THIS, rather than asking the planner
  // again and thereby stepping the controller it is supposed to be watching.
  runtime.lastPublishedPlan = {
    action: plan.action,
    target: plan.target ? [plan.target[0], plan.target[1], plan.target[2]] : null,
    interactionId: plan.interactionId,
    reason: plan.reason,
    arriveRadius: plan.arriveRadius
  };
  const flight = ctx.getSpaceFlightSnapshot();
  switch (plan.action) {
    case 'walk': {
      if (plan.target) {
        ctx.walkToward(
          ctx._goalScratch.set(plan.target[0], plan.target[1], plan.target[2]),
          plan.arriveRadius
        );
      }
      break;
    }
    case 'interact': {
      if (!plan.target || !plan.interactionId) break;
      const goal = ctx._goalScratch.set(plan.target[0], plan.target[1], plan.target[2]);
      ctx.walkToward(goal, plan.arriveRadius);
      // NO CADENCE IS SPENT HERE, and no reach is judged here either. The
      // performer resolves what the player is actually being offered at this
      // body position, refuses anything that is not this plan's id, and owns
      // the dwell between acts. A rail that pre-consumed the dwell starved
      // every act while its ready prompt stayed on screen.
      ctx.performStoryInteraction(plan.interactionId as never);
      break;
    }
    case 'board': {
      if (!plan.target) break;
      const hatch = ctx._goalScratch.set(plan.target[0], plan.target[1], plan.target[2]);
      ctx.walkToward(hatch, 2.4, 1.1);
      if (ctx.getPlayerWorldPosition().distanceTo(hatch) <= 3.5) ctx.enterShip();
      break;
    }
    case 'launch':
      ctx.controls.jump = flight.controlMode === 'flight' && flight.phase === 'surface';
      break;
    case 'fly':
      // No sprint: the chapter-10 pass established FOV 70 for this lineage, and
      // boost would reopen the undeclared lens move that pass removed.
      ctx.controls.forward = true;
      ctx.controls.sprint = false;
      break;
    case 'land':
      ctx.controls.forward = true;
      ctx.controls.interact = true;
      break;
    case 'exit-ship':
      ctx.exitShip();
      break;
    case 'hold':
    default:
      break;
  }
  return plan;
}
