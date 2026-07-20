import * as THREE from 'three';
import { getStoryStateSnapshot, STORY_MILESTONES, type StoryBeat } from './storyState.ts';
import { getAppStateSnapshot } from '../state/appState.ts';
import { getPlayerLook, getPlayerWorldPosition, getPlayerUp } from '../state/playerFrame.ts';
import { requestPlayerNudge } from './playerNudge.ts';
import { addItem, getItemCount, removeItem } from '../game/systems/inventorySystem.ts';
import { getCampfires, placeCampfire } from '../game/systems/campfires.ts';
import { drink, feed, getVitals } from '../game/systems/survivalVitals.ts';
import { hasMilestone, markMilestone } from '../game/systems/progressionSystem.ts';
import { getLocalActorId } from '../game/playerActors.ts';
import { getHabitatWorldState } from '../game/systems/habitatSystem.ts';
import { getItem } from '../game/data/items.ts';
import { nearestForageNodeWorld } from '../components/ForageField.tsx';
import { anomalyStoneHandle } from './world/AnomalyStone.tsx';
import { signalMesaHandle } from './world/SignalMesa.tsx';
import { heroTreeHandle } from './world/HeroAppleTree.tsx';
import { wreckRelayHandle } from './world/WreckRelay.tsx';
import {
  getKeelMemoryPose,
  storyAnchors
} from './world/storyWorld.ts';
import { isSpawnSettled } from '../game/spawnSettle.ts';
import { anomalyMassDesignated, beginA1, beginA2, vigilRestReady } from './storyDirector.ts';
import { advanceToBeat } from './storyState.ts';
import { setStoryMoveScale } from './storyInputPolicy.ts';
import {
  setCinematicGazeIntent,
  setCinematicLookTarget,
  setCinematicLookWeight,
  type CinematicGazeMode
} from './cinematicLook.ts';
import { getLensRig, getSideLens, rigMoveBasis } from './sideLens.ts';
import {
  getDebrisPositions,
  getDebrisScattered,
  isDebrisCollected,
  seedDebrisCollected
} from './debrisSalvage.ts';
import { CH1_FIXED_TUTORIAL, CH1_QUOTA } from './storyScript.ts';
import { getSupplyPodPositions, isPodCollected, seedSupplyPodsCollected } from './supplyPods.ts';
import { currentNavWaypointPosition, seedNavWaypointsReached } from './navWaypoints.ts';
import { taskRowMoveIntent } from './taskRowNavigation.ts';
import type { AgentSurfaceRoute } from '../utils/agentSurfaceNavigation.ts';
import { createLiveAgentSurfaceTerrain } from '../utils/agentSurfaceNavigationRuntime.ts';
import { dominantFaceForPosition } from '../utils/surfaceControls.ts';
import {
  PLAYER_EDGE_RADIUS,
  VOXEL_SCALE
} from '../utils/cubeGravityConstants.ts';
import {
  advanceCrossFaceSurfaceLegPhase,
  crossFaceCrossingTarget,
  enteredPlannedSurfaceFace,
  planCrossFaceSurfaceLeg,
  reachedCrossFaceDestinationEntry,
  surfaceFaceFromUp,
  surfaceSteeringIntent,
  type CrossFaceSurfaceLeg,
  type CrossFaceSurfaceLegPhase
} from './autopilotSteering.ts';
import {
  EMERGENT_AUDIT_MILESTONES
} from './emergentAudit.ts';
import { EMERGENT_MAW_MILESTONES } from './emergentMawRepair.ts';
import { EMERGENT_UNIQUE_ITEM_MILESTONES } from './emergentUniqueItems.ts';
import {
  AUTHORED_DIVE_ENTER_SUBMERGENCE,
  AUTHORED_DIVE_MILESTONES
} from './emergentDive.ts';
import { resolveStoryInteraction } from './storyInteractions.ts';
import { hifiWreckHandle } from './world/hifiWreck.ts';
import { getShipPosition, isBoardable } from '../state/shipProximity.ts';
import {
  enterShip,
  exitShip,
  getSpaceFlightSnapshot
} from '../state/spaceFlight.ts';
import { getCurrentDayPhase } from '../game/worldClock.ts';
import {
  buildAndCertifyEmergentMovieShelter,
  completeEmergentMovieSafeRest,
  findEmergentMovieHabitatGoal,
  getEmergentMovieSettlementBinding,
  getEmergentMovieWreckBinding,
  installEmergentMovieHabitatCore,
  prepareEmergentMovieHabitatCore,
  prepareEmergentMovieWreckCraft
} from './emergentMovieRuntime.ts';
import {
  getTidegardenChosenHabitatSite,
  TIDEGARDEN_SETTLEMENT_MILESTONES
} from './tidegardenSettlement.ts';
import { resolveTidegardenSettlementTarget } from './tidegardenSettlementTargets.ts';
import { STORY_PRIMARY_WORLD_ID, TIDEGARDEN_WORLD_ID } from './tidegardenRoute.ts';
import { getPlayerSubmersion } from '../state/playerSubmersion.ts';
import { getLocalPlayerSurfaceContact } from '../state/playerSurfaceContact.ts';
import {
  autopilotSwimPhysicsOverride,
  nextDiveAimReady,
  nextDiveColumnLock,
  nextDiveRecoveryState,
  planAutopilotSwim,
  type AutopilotSwimMode
} from './autopilotSwim.ts';
import {
  movieWreckInteractionMotion,
  resolveMovieWreckInteractionAnnulusGoal,
  shouldApproachMovieWreck,
  shouldExitWaterBeforeMovieWreck,
  shouldRecoverMovieWreckWetStart
} from './autopilotReconstruction.ts';
import { allowsMovieTeleportRecovery } from './autopilotSafety.ts';
import { isStoryJetInstalled } from './emergentCapabilities.ts';
import { plannedJetpackJumpDecision } from './autopilotJetpackNavigation.ts';
import {
  planReachableCrossFaceRoute,
  shouldExtendCrossFaceContinuation,
  shouldReplanDryWaterContact,
  shouldReplanUnreachableRoute,
  type NavigationSurfaceContactSignature
} from './autopilotCrossFaceNavigation.ts';

// --- Story autopilot (movie mode) -----------------------------------------------
//
// Dev-only: drives the player through the whole arc so the story can be WATCHED
// and critiqued end to end. `&movie=1` (any ?story= start point) turns it on.
// The autopilot publishes a virtual gamepad that EfficientPlayer merges over the
// real keyboard, aims via the cinematic look-pull, and every beat has a TIMEOUT
// that skips ahead — anything too hard to automate cannot stall the screening.
//
// Cutscene beats (a1-ramp, a2-awakening, ch3-dusk, a3-dawn) drive themselves;
// the autopilot goes hands-off and lets them play. The original presentation
// ladder retains bounded screening rescues; the emergent arc (ch4-audit onward)
// has no timeout acceptance and advances only through its gameplay receipts.

export interface AutopilotControls {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  descend: boolean;  // player-equivalent swim-down axis (Ctrl / Z)
  sprint: boolean;   // the klaxon run (ch3-signal)
  delete: boolean;   // hold-to-mine
  interact: boolean; // F pulses
}

const controls: AutopilotControls = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  jump: false,
  descend: false,
  sprint: false,
  delete: false,
  interact: false
};

const MOVIE = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('movie') === '1';

export function isMovieMode(): boolean {
  return MOVIE;
}

/** Beats the autopilot actively steers (cutscenes drive themselves). */
const DRIVEN_BEATS: ReadonlySet<StoryBeat> = new Set([
  'ch1-fixed', 'ch1-raster', 'ch1-depth', 'ch1-nav', 'ch1-iso',
  'ch1-anomaly', 'ch2-color', 'ch2-approach',
  'ch3-gather', 'ch3-await-rest',
  'ch3-thirst', 'ch3-forage', 'ch3-signal', 'ch4-vigil',
  'ch4-audit', 'ch4-comply', 'ch4-defy',
  'ch5-maw', 'ch6-dive', 'ch7-reconstruct', 'ch7-board',
  'ch8-launch', 'ch8-crossing', 'ch8-landfall',
  'ch9-settle', 'ch9-hearth'
]);

export function isAutopilotDriving(): boolean {
  if (!MOVIE) return false;
  const story = getStoryStateSnapshot();
  return story.active && !!story.beat && DRIVEN_BEATS.has(story.beat)
    && getAppStateSnapshot().phase === 'playing';
}

export function getAutopilotControls(): Readonly<AutopilotControls> {
  const story = getStoryStateSnapshot();
  if (MOVIE && story.active && story.beat === 'ch6-dive') {
    const actorId = getLocalActorId();
    const mode = autopilotSwimPhysicsOverride({
      submergence: getPlayerSubmersion(actorId).submergence,
      acquired: hasMilestone(EMERGENT_UNIQUE_ITEM_MILESTONES.keelMemory, actorId),
      surfaceReceipt: hasMilestone(AUTHORED_DIVE_MILESTONES.surfacedWithKeel, actorId),
      recoveryActive: diveRecoveryActive,
      oxygen: getVitals(actorId).oxygen,
      columnLocked: diveColumnLocked
    });
    if (mode === 'hold') {
      controls.forward = false;
      controls.backward = false;
      controls.left = false;
      controls.right = false;
      controls.jump = false;
      // Vertical-only player input pins the body against the real pond floor
      // without a forward collision that could activate the exit mantle.
      controls.descend = true;
    } else if (mode === 'dive') {
      controls.forward = true;
      controls.backward = false;
      controls.left = false;
      controls.right = false;
      controls.jump = false;
      controls.descend = true;
    } else if (mode === 'ascend') {
      // Jump is the player's normal positive local-up swim axis. Do not retain
      // forward while the previous frame may still be looking down at the Keel.
      controls.forward = false;
      controls.backward = false;
      controls.left = false;
      controls.right = false;
      controls.jump = true;
      controls.descend = false;
    } else {
      controls.descend = false;
    }
  }
  return controls;
}

export interface AutopilotFlightDirective {
  active: boolean;
  beat: StoryBeat | null;
  targetWorldId: string | null;
  controls: Readonly<AutopilotControls>;
}

/** ShipController consumes the same virtual controls as the on-foot body. */
export function getAutopilotFlightDirective(): AutopilotFlightDirective {
  const story = getStoryStateSnapshot();
  const beat = story.active ? story.beat : null;
  const active = MOVIE && (beat === 'ch8-launch' || beat === 'ch8-crossing' || beat === 'ch8-landfall');
  return {
    active,
    beat,
    targetWorldId: beat === 'ch8-crossing' ? TIDEGARDEN_WORLD_ID : null,
    controls
  };
}

// Legacy presentation-ladder timeouts. No emergent beat is listed here: those
// scenes may wait, but they may not turn elapsed time into narrative evidence.
const BEAT_TIMEOUT: Partial<Record<StoryBeat, number>> = {
  'ch1-fixed': 55,
  'ch1-raster': 95,
  'ch1-depth': 60,
  'ch1-nav': 75,
  'ch1-iso': 75,
  'ch1-anomaly': 62, // calibration sweep (stage 1) + the walk + dwell
  // 6s stand + ~70u walk to the tree radius. 20 cut the walk short every run;
  // 34 still truncated healthy-but-slow walks (34.3s observed on a green
  // screening, 2026-07-12) — swiftshader walk speed varies ~±20%. 45 = the
  // stand + ~1.7x the typical walk, matching ch2-approach's envelope.
  'ch2-color': 45,
  'ch2-approach': 45,
  'ch3-gather': 34,
  'ch3-await-rest': 70,
  'ch3-thirst': 75,
  'ch3-forage': 60,
  'ch3-signal': 60,
  // Raised for the stargaze: night lands ~42s in, then the 8-line sequence
  // (~45.5s) + the 18s reveal ramp + the held rest prompt push natural
  // completion to ~100s. 140 keeps the beat's own resolution well inside.
  'ch4-vigil': 140
};

let clockBeat: StoryBeat | null = null;
let beatClock = 0;
let interactPulseAt = 0;
const _target = new THREE.Vector3();
const _goalScratch = new THREE.Vector3();
const _wreckInteractionScratch = new THREE.Vector3();
const _swimLookTarget = new THREE.Vector3();

// Goal continuity: nudges are counted PER GOAL so a beat handler can give up on
// an unreachable target (defer it) instead of teleport-hammering it forever.
const _goalRef = new THREE.Vector3(Infinity, Infinity, Infinity);
let nudgesOnGoal = 0;
let teleportNudgesTotal = 0;
let teleportNudgeRunId = -1;
let dryCrossFaceWaterContactFramesTotal = 0;
// Sibling shoreline signal: sustained wet feet while executing a nominally dry
// SAME-face leg. Drives one bounded route replan out of a pond-edge local
// minimum (see shouldReplanDryWaterContact).
let dryWalkWaterContactFramesTotal = 0;
const DRY_WALK_WATER_CONTACT_REPLAN_FRAMES = 8;

function noteGoal(target: THREE.Vector3): void {
  if (_goalRef.distanceTo(target) > 2.5) {
    _goalRef.copy(target);
    nudgesOnGoal = 0;
  }
}

/** How many teleport-nudges the CURRENT goal has burned (deferral signal). */
function goalNudges(): number {
  return nudgesOnGoal;
}

// Stuck watchdog: when the pilot is pushing but not moving, jump-and-reverse
// until it breaks free (single-voxel lips + pond edges are the usual culprits;
// the water mantle in EfficientPlayer does the heavy lifting, this supplies
// the intent).
const _lastPos = new THREE.Vector3(Infinity, Infinity, Infinity);
let stillTime = 0;
let arrivedTime = 0;
let unstickUntil = -1;
let unstickFlips = 0;
/** True on ticks where walkToward set a live goal (enables the nudge escalation). */
let walkTargetLive = false;
const _nudge = new THREE.Vector3();
const _stillDelta = new THREE.Vector3();

type NavigationAction = 'idle' | 'walk' | 'jetpack' | 'direct' | 'unreachable';

interface ActiveNavigationRoute {
  route: AgentSurfaceRoute;
  goal: THREE.Vector3;
  revision: string;
  jetpackAvailable: boolean;
  crossFaceLeg: CrossFaceSurfaceLeg | null;
  crossFacePhase: Exclude<CrossFaceSurfaceLegPhase, 'complete'>;
  crossFaceTarget: THREE.Vector3 | null;
  crossFaceDestinationEntry: THREE.Vector3 | null;
  crossFaceSafeContinuationDistance: number | null;
  crossFaceDestinationContinuationMode: 'dry' | 'jetpack' | null;
  cursor: number;
  plannedAt: number;
  plannedFrom: THREE.Vector3;
  plannedSurfaceContact: NavigationSurfaceContactSignature;
}

let activeNavigationRoute: ActiveNavigationRoute | null = null;
let navigationAction: NavigationAction = 'idle';
let navigationReason = 'not-planned';
let plannedJetpackReleaseUntil = -1;
let plannedJetpackWasActive = false;
let plannedJetpackWasWetStartEgress = false;
const _navigationWaypoint = new THREE.Vector3();
const _navigationDirection = new THREE.Vector3();
const _crossFaceContinuationDirection = new THREE.Vector3();
const _crossFaceContinuationStart = new THREE.Vector3();
const _crossFaceContinuationTarget = new THREE.Vector3();
const CROSS_FACE_CONTINUATION_MIN_SECONDS = 1.1;
const CROSS_FACE_CONTINUATION_MAX_SECONDS = 9;
const CROSS_FACE_CONTINUATION_FALLBACK_DISTANCE = 3 * VOXEL_SCALE;
const CROSS_FACE_CONTINUATION_PROBE_SECONDS = 0.35;
let crossFaceContinuationMinUntil = -1;
let crossFaceContinuationMaxUntil = -1;
let crossFaceContinuationProbeAt = -1;
let crossFaceContinuationFace: ReturnType<typeof surfaceFaceFromUp> | null = null;
let crossFaceContinuationExpectsDry = false;
let crossFaceContinuationUsesJetpack = false;
let crossFaceContinuationHasDestinationEntry = false;
let crossFaceContinuationMaxDistance = CROSS_FACE_CONTINUATION_FALLBACK_DISTANCE;

function clearCrossFaceContinuation(): void {
  crossFaceContinuationMinUntil = -1;
  crossFaceContinuationMaxUntil = -1;
  crossFaceContinuationProbeAt = -1;
  crossFaceContinuationFace = null;
  crossFaceContinuationExpectsDry = false;
  crossFaceContinuationUsesJetpack = false;
  crossFaceContinuationHasDestinationEntry = false;
  crossFaceContinuationMaxDistance = CROSS_FACE_CONTINUATION_FALLBACK_DISTANCE;
  _crossFaceContinuationDirection.set(0, 0, 0);
  _crossFaceContinuationStart.set(0, 0, 0);
  _crossFaceContinuationTarget.set(0, 0, 0);
}

function crossFaceContinuationStep(
  reason = 'cross-face-forward-handoff'
): NavigationStep {
  navigationAction = crossFaceContinuationUsesJetpack ? 'jetpack' : 'direct';
  navigationReason = crossFaceContinuationUsesJetpack ? 'wet-start-egress' : reason;
  return {
    waypoint: _navigationWaypoint.copy(_crossFaceContinuationTarget),
    action: navigationAction,
    route: null,
    // Literal forward is important only while the camera/gravity frame is
    // rolling. After that minimum window, semantic gaze may turn toward the
    // next objective; map controls back onto the stored world-space direction
    // so an observation cannot reverse the physical shoreline handoff.
    preserveForward: beatClock < crossFaceContinuationMinUntil
  };
}

function resetNavigationRoute(): void {
  activeNavigationRoute = null;
  navigationAction = 'idle';
  navigationReason = 'not-planned';
  clearCrossFaceContinuation();
}

function clearControls(): void {
  controls.forward = false;
  controls.backward = false;
  controls.left = false;
  controls.right = false;
  controls.jump = false;
  controls.descend = false;
  controls.sprint = false;
  controls.delete = false;
  controls.interact = false;
}

const _toGoal = new THREE.Vector3();

/**
 * Gait distance to a goal: HORIZONTAL range plus any un-climbed height beyond
 * a step. Pure 3D distance strands the pilot "close" to elevated goals (it
 * stops walking while still at the foot of the rise); pure horizontal releases
 * it directly UNDER them. This keeps the intent alive until both close.
 */
function gaitDistance(target: THREE.Vector3, player: THREE.Vector3): number {
  if (surfaceFaceFromUp(getPlayerUp()) !== dominantFaceForPosition(target)) {
    return player.distanceTo(target);
  }
  _toGoal.copy(target).sub(player);
  const up = getPlayerUp();
  const vertical = _toGoal.dot(up);
  _toGoal.addScaledVector(up, -vertical);
  return _toGoal.length() + Math.max(0, vertical - 1.0);
}

/** Base gaze lift over a goal: the camera aims at the SUBJECT, not its base. */
const LOOK_LIFT = 1.4;

const _gazeRoute = new THREE.Vector3();

/**
 * Publish a semantic gaze instead of a raw chord through the cube. The camera
 * resolves it against its visually transported up: far/cross-face subjects are
 * a local-horizon bearing; nearby same-face subjects become an inspection.
 */
function lookNaturallyToward(
  target: THREE.Vector3,
  player: THREE.Vector3,
  lookLift = LOOK_LIFT,
  routeTarget: THREE.Vector3 = target,
  mode?: CinematicGazeMode
): void {
  _gazeRoute.copy(routeTarget).sub(player);
  setCinematicGazeIntent({
    goal: target,
    routeDirection: _gazeRoute,
    subjectLift: lookLift,
    mode: mode ?? (player.distanceTo(target) < 12 ? 'inspect' : 'travel'),
    elapsed: beatClock,
    seed: 7744
  });
}

interface NavigationStep {
  waypoint: THREE.Vector3;
  action: NavigationAction;
  route: AgentSurfaceRoute | null;
  /** Hold the transported camera/player forward through a cube-edge roll. */
  preserveForward: boolean;
}

/**
 * Resolve (and cache) the next dry surface waypoint. Planning is keyed by the
 * quantized goal, owning face, and live terrain/water revision; it never runs
 * every frame. A large deviation gets one bounded replan rather than letting the
 * old path's watchdog drag the actor back through an obstacle.
 */
function nextNavigationStep(player: THREE.Vector3, goal: THREE.Vector3): NavigationStep {
  const settlement = getEmergentMovieSettlementBinding();
  const planetSize = storyAnchors.planetSize ?? settlement?.planetSize ?? null;
  const terrainSeed = storyAnchors.terrainSeed;
  const terrain = planetSize == null
    ? null
    : terrainSeed == null
      ? settlement?.agentTerrain ?? null
      : createLiveAgentSurfaceTerrain(
        planetSize,
        terrainSeed,
        STORY_PRIMARY_WORLD_ID
      );
  if (planetSize == null || !terrain) {
    navigationAction = 'direct';
    navigationReason = 'world-navigation-unavailable';
    return {
      waypoint: _navigationWaypoint.copy(goal),
      action: navigationAction,
      route: null,
      preserveForward: false
    };
  }

  // Exact edge positions are tied by construction. Gravity up is the physics
  // authority and has already committed to the destination face.
  const face = surfaceFaceFromUp(getPlayerUp());
  const goalFace = dominantFaceForPosition(goal);
  let cached = activeNavigationRoute;
  if ((cached?.route.reason === 'wet-start-egress'
      || cached?.route.reason === 'partial-water-crossing-egress')
    && cached.route.resolvedGoal
    && player.distanceToSquared(cached.route.resolvedGoal) <= 1.35 * 1.35) {
    // Multi-water travel is deliberately split at each dry bank. Replan from
    // grounded terrain so every crossing gets its own bounded fuel budget.
    activeNavigationRoute = null;
    cached = null;
  }
  if (cached?.crossFaceLeg && enteredPlannedSurfaceFace(
    cached.crossFaceLeg.fromFace,
    cached.crossFaceLeg.nextFace,
    face
  )) {
    // Every edge roll, including an intermediate face on an opposite-face trip,
    // inherits the transported forward basis before any new A* query is allowed.
    _crossFaceContinuationDirection.copy(cached.crossFaceLeg.continuationDirection);
    _crossFaceContinuationStart.copy(player);
    crossFaceContinuationHasDestinationEntry = cached.crossFaceDestinationEntry !== null;
    if (cached.crossFaceDestinationEntry) {
      _crossFaceContinuationTarget.copy(cached.crossFaceDestinationEntry);
      crossFaceContinuationMaxDistance = Math.max(
        VOXEL_SCALE,
        player.distanceTo(cached.crossFaceDestinationEntry) + VOXEL_SCALE,
        (cached.crossFaceSafeContinuationDistance ?? 0) + VOXEL_SCALE
      );
    } else {
      crossFaceContinuationMaxDistance = CROSS_FACE_CONTINUATION_FALLBACK_DISTANCE;
      _crossFaceContinuationTarget.copy(player).addScaledVector(
        _crossFaceContinuationDirection,
        crossFaceContinuationMaxDistance
      );
    }
    crossFaceContinuationFace = cached.crossFaceLeg.nextFace;
    crossFaceContinuationExpectsDry = cached.crossFaceDestinationContinuationMode === 'dry';
    crossFaceContinuationUsesJetpack = cached.crossFaceDestinationContinuationMode === 'jetpack';
    crossFaceContinuationMinUntil = beatClock + CROSS_FACE_CONTINUATION_MIN_SECONDS;
    crossFaceContinuationMaxUntil = beatClock + CROSS_FACE_CONTINUATION_MAX_SECONDS;
    crossFaceContinuationProbeAt = crossFaceContinuationMinUntil;
    activeNavigationRoute = null;
    cached = null;
  }
  if (crossFaceContinuationFace) {
    // A proximity interaction may advance to the next objective before the
    // body reaches a planner-owned support column. Keep the physical handoff
    // across that goal change; the new goal's first successful route probe is
    // what releases continuation.
    const reachedDestinationEntry = crossFaceContinuationHasDestinationEntry
      && reachedCrossFaceDestinationEntry(
        player,
        _crossFaceContinuationTarget,
        crossFaceContinuationFace
      );
    const continuationInvalid = face !== crossFaceContinuationFace
      || beatClock >= crossFaceContinuationMaxUntil
      || player.distanceTo(_crossFaceContinuationStart) >= crossFaceContinuationMaxDistance;
    if (reachedDestinationEntry || continuationInvalid) {
      clearCrossFaceContinuation();
    } else if (beatClock < crossFaceContinuationMinUntil
      || beatClock < crossFaceContinuationProbeAt) {
      return crossFaceContinuationStep();
    }
  }
  const goalChanged = !cached || cached.goal.distanceToSquared(goal) > 1;
  const faceChanged = !cached || cached.route.face !== face;
  const revisionChanged = !cached || cached.revision !== terrain.revision;
  const jetpackAvailable = isStoryJetInstalled(getLocalActorId());
  const capabilityChanged = !cached || cached.jetpackAvailable !== jetpackAvailable;
  const cachedWaypoint = cached?.route.waypoints[cached.cursor];
  const crossingLatched = !!cached?.crossFaceLeg
    && cached.crossFacePhase === 'crossing'
    && cached.goal.distanceToSquared(goal) <= 1
    && face === cached.crossFaceLeg.fromFace;
  const farOffRoute = !!cachedWaypoint
    && beatClock - (cached?.plannedAt ?? 0) > 0.75
    && player.distanceToSquared(cachedWaypoint) > 9 * 9;
  const currentSurfaceContact = getLocalPlayerSurfaceContact();
  const staleUnreachablePlan = !!cached && shouldReplanUnreachableRoute({
    routeMode: cached.route.mode,
    plannedFrom: cached.plannedFrom,
    player,
    plannedContact: cached.plannedSurfaceContact,
    currentContact: currentSurfaceContact
  });
  // Shoreline escape: a dry-claimed leg that keeps grinding the pond edge gets
  // one bounded replan from the live wet position (the counter is consumed so a
  // replan cannot fire every frame).
  const shorelineWaterReplan = !!cached && shouldReplanDryWaterContact({
    routeMode: cached.route.mode,
    hasWaterCrossing: cached.route.waterCrossing !== null,
    contactFrames: dryWalkWaterContactFramesTotal,
    thresholdFrames: DRY_WALK_WATER_CONTACT_REPLAN_FRAMES
  });
  if (shorelineWaterReplan) dryWalkWaterContactFramesTotal = 0;

  if (!crossingLatched && (
    goalChanged
    || faceChanged
    || revisionChanged
    || capabilityChanged
    || farOffRoute
    || staleUnreachablePlan
    || shorelineWaterReplan
  )) {
    const crossFaceLeg = face === goalFace
      ? null
      : planCrossFaceSurfaceLeg({
          player,
          goal,
          currentFace: face,
          goalFace,
          lookForward: getPlayerLook().forward,
          planetRadius: planetSize,
          edgeEntryRadius: planetSize - PLAYER_EDGE_RADIUS,
          cornerInset: VOXEL_SCALE
        });
    const planned = planReachableCrossFaceRoute({
      terrain,
      planetSize,
      player,
      goal,
      face,
      crossFaceLeg,
      jetpackAvailable
    });
    activeNavigationRoute = {
      route: planned.route,
      goal: goal.clone(),
      revision: terrain.revision,
      jetpackAvailable,
      crossFaceLeg: planned.crossFaceLeg,
      crossFacePhase: 'approach',
      crossFaceTarget: null,
      crossFaceDestinationEntry: planned.destinationEntry?.clone() ?? null,
      crossFaceSafeContinuationDistance: planned.safeContinuationDistance,
      crossFaceDestinationContinuationMode: planned.destinationContinuationMode,
      cursor: planned.route.waypoints.length > 1 ? 1 : 0,
      plannedAt: beatClock,
      plannedFrom: player.clone(),
      plannedSurfaceContact: { ...currentSurfaceContact }
    };
    if (crossFaceContinuationFace) {
      if (shouldExtendCrossFaceContinuation(planned.route)) {
        // The body has rolled onto the new face but still hangs beyond its
        // traversable terrain band. Do not cache the rejection: carry the real
        // movement frame inward, then probe the live planner again.
        activeNavigationRoute = null;
        crossFaceContinuationProbeAt = beatClock + CROSS_FACE_CONTINUATION_PROBE_SECONDS;
        return crossFaceContinuationStep('cross-face-forward-handoff-start-column');
      }
      clearCrossFaceContinuation();
    }
  }

  const active = activeNavigationRoute;
  if (!active || active.route.mode === 'unreachable' || active.route.waypoints.length === 0) {
    navigationAction = 'unreachable';
    navigationReason = active?.route.reason ?? 'no-route';
    return {
      waypoint: _navigationWaypoint.copy(player),
      action: navigationAction,
      route: active?.route ?? null,
      preserveForward: false
    };
  }

  if (active.crossFaceLeg) {
    const approach = active.route.resolvedGoal ?? active.crossFaceLeg.approach;
    const nextPhase = advanceCrossFaceSurfaceLegPhase({
      phase: active.crossFacePhase,
      currentFace: face,
      nextFace: active.crossFaceLeg.nextFace,
      approachDistance: gaitDistance(approach, player),
      approachTolerance: 1.45
    });
    if (nextPhase === 'crossing') {
      if (active.crossFacePhase !== 'crossing' || !active.crossFaceTarget) {
        active.crossFaceTarget = crossFaceCrossingTarget({
          player,
          fromFace: active.crossFaceLeg.fromFace,
          nextFace: active.crossFaceLeg.nextFace,
          planetRadius: planetSize
        });
      }
      active.crossFacePhase = 'crossing';
      navigationAction = 'direct';
      navigationReason = 'cross-face-edge-crossing';
      return {
        waypoint: _navigationWaypoint.copy(active.crossFaceTarget),
        action: navigationAction,
        route: active.route,
        preserveForward: false
      };
    }
  }

  // Consume adjacent A* cells as the body reaches them. The final cell remains
  // authoritative; route replanning owns any larger displacement.
  while (active.cursor < active.route.waypoints.length - 1) {
    const candidate = active.route.waypoints[active.cursor];
    if (!candidate || player.distanceToSquared(candidate) > 1.35 * 1.35) break;
    active.cursor++;
  }
  const waypoint = active.route.waypoints[active.cursor] ?? goal;
  const crossing = active.route.waterCrossing;
  const onJetpackLeg = !!crossing
    && active.cursor >= Math.max(0, crossing.firstWaterWaypointIndex - 1)
    && active.cursor <= Math.min(active.route.waypoints.length - 1, crossing.lastWaterWaypointIndex + 1);
  navigationAction = onJetpackLeg
    ? 'jetpack'
    : active.route.mode === 'direct'
      ? 'direct'
      : 'walk';
  navigationReason = active.route.reason;
  return {
    waypoint: _navigationWaypoint.copy(waypoint),
    action: navigationAction,
    route: active.route,
    preserveForward: false
  };
}

/** Map a world route segment onto the player's current surface camera frame.
 * Movement therefore follows the path even while the eyes make a small human
 * scan around it. */
function steerFreeToward(player: THREE.Vector3, waypoint: THREE.Vector3): void {
  const up = getPlayerUp();
  _navigationDirection.copy(waypoint).sub(player)
    .addScaledVector(up, -_navigationDirection.dot(up));
  if (_navigationDirection.lengthSq() < 0.04) {
    controls.forward = false;
    controls.backward = false;
    controls.left = false;
    controls.right = false;
    return;
  }
  const intent = surfaceSteeringIntent(_navigationDirection, up, getPlayerLook().forward);
  controls.forward = intent.forward;
  controls.backward = intent.backward;
  controls.right = intent.right;
  controls.left = intent.left;
}

/** Aim the camera at a world point and hold forward until within `stop` range.
 *  `lookLift` raises the gaze onto the goal's subject (trees want their crown). */
function walkToward(
  target: THREE.Vector3,
  stop: number,
  lookLift = LOOK_LIFT,
  gazeTarget: THREE.Vector3 = target,
  interactionGazeWithin = 0
): number {
  const player = getPlayerWorldPosition();
  const distance = gaitDistance(target, player);
  const step = distance > stop ? nextNavigationStep(player, target) : null;
  const gazeMode: CinematicGazeMode | undefined = interactionGazeWithin > 0 && distance <= interactionGazeWithin
    ? 'interact'
    : undefined;
  lookNaturallyToward(gazeTarget, player, lookLift, step?.waypoint ?? target, gazeMode);
  setCinematicLookWeight(1);
  noteGoal(target);
  if (distance <= stop) {
    _target.copy(target);
    walkTargetLive = true;
    controls.forward = false;
    controls.backward = false;
    controls.left = false;
    controls.right = false;
    controls.jump = false;
    navigationAction = 'idle';
    return distance;
  }
  if (!step || step.action === 'unreachable') {
    _target.copy(target);
    walkTargetLive = false;
    controls.forward = false;
    controls.backward = false;
    controls.left = false;
    controls.right = false;
    controls.jump = false;
    return distance;
  }
  _target.copy(step.waypoint); // watchdog nudges only toward the current safe leg
  walkTargetLive = true;
  if (step.preserveForward) {
    // EfficientPlayer and CameraControls both transport their forward basis
    // across the edge. Preserve that held input until the roll is complete.
    controls.forward = true;
    controls.backward = false;
    controls.left = false;
    controls.right = false;
  } else {
    steerFreeToward(player, step.waypoint);
  }
  // Normal ledges use step assist. Space is reserved for a planned dry-to-dry
  // crossing so the pilot never rhythmically hops itself into a pond.
  controls.jump = step.action === 'jetpack';
  return distance;
}

/**
 * Preserve a composed gaze after a physical goal has accepted. The generic
 * arrived-goal watchdog exists to close stubborn trigger volumes; leaving that
 * goal live after shelter certification would instead nudge the actor back out
 * of the room during the director's deliberate breathing space (or while
 * waiting for night).
 */
function holdAt(target: THREE.Vector3, lookLift = LOOK_LIFT): void {
  const player = getPlayerWorldPosition();
  lookNaturallyToward(target, player, lookLift);
  setCinematicLookWeight(1);
  _target.copy(target);
  walkTargetLive = false;
  controls.forward = false;
  controls.backward = false;
  controls.left = false;
  controls.right = false;
  controls.jump = false;
  navigationAction = 'idle';
}

/**
 * Profile-era walk on the one authored task row. Unlike the general external-
 * lens walker this can emit only A/D and does not rhythmically hold jump: the
 * normal step assist handles the row, while the stuck watchdog remains the sole
 * last-resort hop for a real terrain obstruction.
 */
function walkTowardTaskRow(target: THREE.Vector3, stop: number): number {
  const lens = getSideLens();
  if (!lens) return walkToward(target, stop);
  const player = getPlayerWorldPosition();
  const distance = gaitDistance(target, player);
  _target.copy(target);
  noteGoal(target);
  walkTargetLive = true;
  if (distance > stop) {
    const intent = taskRowMoveIntent(lens, player, target);
    controls.forward = intent.forward;
    controls.backward = intent.backward;
    controls.left = intent.left;
    controls.right = intent.right;
  } else {
    controls.forward = false;
    controls.backward = false;
    controls.left = false;
    controls.right = false;
  }
  controls.jump = false;
  return distance;
}

const _lensFwd = new THREE.Vector3();
const _lensRight = new THREE.Vector3();
const _toTarget = new THREE.Vector3();

/**
 * Screen-relative two-axis movement after NAV VIEW has made terrain depth an
 * honest part of play. Like walkToward, it plans through nextNavigationStep and
 * holds jump on a planned 'jetpack' step so a computed water crossing actually
 * executes (the downstream plannedJetpack controller then owns the fuel budget);
 * ordinary dry steering leaves jump off and the stuck watchdog owns the rare
 * obstacle-recovery hop.
 */
function walkTowardLens(target: THREE.Vector3, stop: number): number {
  const lens = getSideLens();
  if (!lens) return walkToward(target, stop);
  rigMoveBasis(lens, getLensRig(), _lensFwd, _lensRight);
  const player = getPlayerWorldPosition();
  const distance = gaitDistance(target, player);
  noteGoal(target);
  const step = distance > stop ? nextNavigationStep(player, target) : null;
  if (distance > stop && step && step.action !== 'unreachable') {
    _target.copy(step.waypoint);
    _toTarget.copy(step.waypoint).sub(player);
    walkTargetLive = true;
    const f = _toTarget.dot(_lensFwd);
    const r = _toTarget.dot(_lensRight);
    controls.forward = f > 0.4;
    controls.backward = f < -0.4;
    controls.right = r > 0.4;
    controls.left = r < -0.4;
  } else {
    controls.forward = false;
    controls.backward = false;
    controls.right = false;
    controls.left = false;
    _target.copy(target);
    walkTargetLive = distance <= stop;
  }
  controls.jump = step?.action === 'jetpack';
  return distance;
}

/**
 * The extraction gait: STAND and chew (hold-to-mine only charges on a stable
 * target), then TRAVEL a leg toward `to`, collecting stones/debris by proximity
 * en route. Stateless off the beat clock so the raster eras share it.
 */
function extractRhythm(to: THREE.Vector3 | null): void {
  controls.delete = true; // safe: the movie probe only chews quota-feeding blocks
  const cycle = beatClock % 6;
  if (cycle < 3.4 || !to) {
    controls.forward = false;
    controls.backward = false;
    controls.left = false;
    controls.right = false;
    controls.jump = false;
  } else {
    walkTowardTaskRow(to, 0.9);
  }
}

/** A drift point down the strip, reversing every `period` seconds. */
function sweepGoal(period = 24, reach = 9): THREE.Vector3 | null {
  const lens = getSideLens();
  if (!lens) return null;
  const dir = Math.floor(beatClock / period) % 2 === 0 ? 1 : -1;
  return _goalScratch.copy(getPlayerWorldPosition()).addScaledVector(lens.travelAxis, dir * reach);
}

// Salvage commitment: stick with ONE debris piece until collected (no
// equidistant flip-flopping), and DEFER a piece that keeps eating nudges —
// unreachable geometry shouldn't hold the whole sweep hostage.
let debrisTargetIdx = -1;
const deferredDebris = new Set<number>();

// First-day state: the screening eats once, and forage scans are throttled
// (nearestForageNodeWorld walks the voxel map — twice a second is plenty).
let movieAte = false;
let forageGoal: THREE.Vector3 | null = null;
let forageGoalAt = -10;
let emergentInteractionAt = -10;
let habitatGoal: THREE.Vector3 | null = null;
let diveRecoveryActive = false;
let diveAimReady = false;
let diveColumnLocked = false;

/** The hero tree's crown height as a gaze lift (the redaction censors the
 *  whole tree; the SHOT should hold the canopy, not the trunk base). */
function treeCrownLift(): number {
  return heroTreeHandle.height > 0 ? heroTreeHandle.height * 0.45 : 2.5;
}

/** Movie-only: consume the richest held forage directly (UI stays untouched —
 *  the campfire-placement precedent). The director advances on the hunger rise. */
function movieEatForage(): boolean {
  for (const id of ['root', 'berry'] as const) {
    if (getItemCount(id) > 0 && removeItem(id, 1)) {
      const def = getItem(id);
      feed(def.foodValue ?? 12, def.waterValue ?? 0);
      return true;
    }
  }
  return false;
}

function committedDebrisTarget(): number {
  const scattered = getDebrisScattered();
  const valid = (i: number) =>
    i >= 0 && i < scattered && !isDebrisCollected(i) && !deferredDebris.has(i);
  if (goalNudges() >= 3 && valid(debrisTargetIdx)) {
    deferredDebris.add(debrisTargetIdx);
    debrisTargetIdx = -1;
  }
  if (valid(debrisTargetIdx)) return debrisTargetIdx;
  const player = getPlayerWorldPosition();
  let best = -1;
  let bestDist = Infinity;
  getDebrisPositions().forEach((pos, i) => {
    if (!valid(i)) return;
    const dist = player.distanceTo(pos);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  });
  if (best < 0 && deferredDebris.size > 0) {
    deferredDebris.clear(); // second chances, round-robin
    return committedDebrisTarget();
  }
  debrisTargetIdx = best;
  return best;
}

/** Pulse F once a second (the resolver decides whether anything happens). */
function pulseInteract(): void {
  controls.interact = beatClock - interactPulseAt < 0.15;
  if (beatClock - interactPulseAt > 1) interactPulseAt = beatClock;
}

/**
 * Movie mode resolves the same registered interaction as [F], but without
 * relying on a browser key repeat. Proximity and every transaction's own proof
 * checks remain authoritative.
 */
function performStoryInteraction(expectedId?: string): boolean {
  if (beatClock - emergentInteractionAt < 0.65) return false;
  const interaction = resolveStoryInteraction(null, getPlayerWorldPosition());
  if (!interaction || (expectedId && interaction.id !== expectedId)) return false;
  emergentInteractionAt = beatClock;
  interaction.perform();
  return true;
}

/**
 * Water is the destination in the dive, so the dry-route planner must not turn
 * it into an obstacle. Physics still owns swimming, sinking, oxygen and shore
 * exit; this only supplies a direct camera-relative movement intent.
 */
function moveThroughWaterToward(
  target: THREE.Vector3,
  stop: number,
  mode: AutopilotSwimMode,
  lookTarget?: THREE.Vector3,
  columnLocked = false
): number {
  const player = getPlayerWorldPosition();
  const submergence = getPlayerSubmersion(getLocalActorId()).submergence;
  const plan = planAutopilotSwim({
    player,
    target,
    up: getPlayerUp(),
    submergence,
    stopDistance: stop,
    mode,
    columnLocked
  });
  setStoryMoveScale(plan.surfaceMoveScale);
  _target.copy(target);
  noteGoal(target);
  if (plan.useFluidLook) {
    // Underwater forward is genuinely 6-DOF: CameraControls pitches the live
    // player camera along this raw ray, then EfficientPlayer feeds that same
    // full direction into composeSwimVelocity. The surface-gaze solver is
    // intentionally bypassed here because its correct land behavior removes
    // downward pitch to avoid staring at the ground.
    setCinematicGazeIntent(null);
    setCinematicLookTarget(lookTarget ?? _swimLookTarget
      .copy(player)
      .addScaledVector(plan.lookDirection, Math.max(8, plan.distance)));
  } else {
    setCinematicLookTarget(null);
    lookNaturallyToward(target, player, 0, target, plan.distance <= stop + 2 ? 'interact' : 'travel');
  }
  setCinematicLookWeight(1);
  walkTargetLive = plan.forward;
  navigationAction = 'direct';
  navigationReason = mode === 'dive' ? 'authored-water-dive' : 'authored-water-return';
  if (!plan.forward) {
    controls.forward = false;
    controls.backward = false;
    controls.left = false;
    controls.right = false;
  } else if (plan.useFluidMovement) {
    // Do not add surface-yaw strafing to the pitched swim ray. Forward alone is
    // the player's normal "swim where I look" control.
    controls.forward = true;
    controls.backward = false;
    controls.left = false;
    controls.right = false;
  } else {
    steerFreeToward(player, target);
  }
  controls.jump = plan.ascend;
  controls.sprint = false;
  return plan.distance;
}

function grantMissingCampfireMaterials(): void {
  const need = (id: 'flint' | 'biofuel' | 'wood', n: number) => {
    const have = getItemCount(id);
    if (have < n) addItem(id, n - have);
  };
  need('flint', 2);
  need('biofuel', 1);
  need('wood', 3);
}

/** Ticked by StoryDirectorDriver every frame while in movie mode. */
export function autopilotTick(dt: number): void {
  if (!MOVIE) return;
  const story = getStoryStateSnapshot();
  if (story.runId !== teleportNudgeRunId) {
    teleportNudgeRunId = story.runId;
    teleportNudgesTotal = 0;
    dryCrossFaceWaterContactFramesTotal = 0;
    dryWalkWaterContactFramesTotal = 0;
  }
  const beat = story.active ? story.beat : null;
  if (beat !== clockBeat) {
    clockBeat = beat;
    beatClock = 0;
    interactPulseAt = -10;
    stillTime = 0;
    arrivedTime = 0;
    unstickUntil = -1;
    unstickFlips = 0;
    plannedJetpackReleaseUntil = -1;
    plannedJetpackWasActive = false;
    plannedJetpackWasWetStartEgress = false;
    _lastPos.set(Infinity, Infinity, Infinity);
    _goalRef.set(Infinity, Infinity, Infinity);
    nudgesOnGoal = 0;
    debrisTargetIdx = -1;
    deferredDebris.clear();
    movieAte = false;
    forageGoal = null;
    forageGoalAt = -10;
    emergentInteractionAt = -10;
    habitatGoal = null;
    diveRecoveryActive = false;
    diveAimReady = false;
    diveColumnLocked = false;
    dryWalkWaterContactFramesTotal = 0;
    resetNavigationRoute();
    clearControls();
    setCinematicGazeIntent(null);
    setCinematicLookTarget(null);
  }
  // Never push (or rescue-nudge) an unsettled player: while the world is still
  // streaming in under the spawn, the pilot waits with everyone else.
  if (getSpaceFlightSnapshot().controlMode === 'fps' && !isSpawnSettled()) {
    clearControls();
    return;
  }
  if (!beat || !isAutopilotDriving()) {
    clearControls();
    setCinematicGazeIntent(null);
    // MOVIE FRAMING: the awakening cutscenes drive themselves, but the SHOT
    // must hold its subject — begin and end on the thing that caused it,
    // never on the ground the pilot happened to be staring at.
    if (beat === 'a1-ramp' && anomalyStoneHandle.position) {
      // Look OVER the stone into the world: the stone anchors the lower
      // frame while the horizon takes the color — A1 is the WORLD changing.
      const up = getPlayerUp();
      _toGoal.copy(anomalyStoneHandle.position).sub(getPlayerWorldPosition());
      _toGoal.addScaledVector(up, -_toGoal.dot(up));
      if (_toGoal.lengthSq() < 0.09) _toGoal.set(1, 0, 0);
      _toGoal.normalize();
      _target.copy(anomalyStoneHandle.position).addScaledVector(_toGoal, 10).addScaledVector(up, 0.2);
      setCinematicLookTarget(_target);
      setCinematicLookWeight(0.85);
    } else if (beat === 'a2-awakening' && heroTreeHandle.position) {
      setCinematicLookTarget(
        _target.copy(heroTreeHandle.position)
          .addScaledVector(heroTreeHandle.up ?? getPlayerUp(), treeCrownLift())
      );
      setCinematicLookWeight(0.85);
    }
    return;
  }
  beatClock += dt;
  walkTargetLive = false; // walkToward re-asserts it below when a goal is live
  const timeout = BEAT_TIMEOUT[beat] ?? Infinity;

  switch (beat) {
    case 'ch1-fixed': {
      // Tutorial order: chew fiber first (stand-and-extract with drift legs),
      // then MARCH down the strip until the bolted frame flips a screen edge.
      const fiberDone = getItemCount('biofiber') >= CH1_FIXED_TUTORIAL.biofiber;
      if (!fiberDone) {
        extractRhythm(sweepGoal(20, 8));
      } else {
        controls.delete = false;
        const lens = getSideLens();
        if (lens) {
          walkTowardTaskRow(
            _goalScratch.copy(getPlayerWorldPosition()).addScaledVector(lens.travelAxis, 30),
            1
          );
        }
      }
      if (beatClock > timeout) {
        // Screening must go on: grant the fiber and unbolt the frame.
        if (getItemCount('biofiber') < CH1_FIXED_TUTORIAL.biofiber) {
          addItem('biofiber', CH1_FIXED_TUTORIAL.biofiber);
        }
        advanceToBeat('ch1-track');
      }
      break;
    }
    case 'ch1-raster': {
      // Fiber unmet: stand-and-extract, with travel legs steering at the
      // COMMITTED salvage piece (walk-over collects it; loose stones come by
      // proximity en route). Fiber met: pure salvage runs until the strip is
      // clear. Deferral keeps one snagged piece from stalling the act.
      const fiberDone = getItemCount('biofiber') >= CH1_QUOTA.biofiber;
      const debrisIdx = committedDebrisTarget();
      const debrisGoal = debrisIdx >= 0 ? getDebrisPositions()[debrisIdx] : null;
      if (!fiberDone) {
        extractRhythm(debrisGoal ?? sweepGoal());
      } else if (debrisGoal) {
        controls.delete = false;
        walkTowardTaskRow(debrisGoal, 0.9);
      } else {
        // Stone stragglers: keep drifting — proximity pickup needs motion.
        extractRhythm(sweepGoal());
      }
      if (beatClock > timeout) {
        // Screening must go on: top up whatever the walk didn't gather.
        if (getItemCount('biofiber') < CH1_QUOTA.biofiber) addItem('biofiber', CH1_QUOTA.biofiber);
        if (getItemCount('stone') < CH1_QUOTA.stone) addItem('stone', CH1_QUOTA.stone);
        seedDebrisCollected();
      }
      break;
    }
    case 'ch1-depth': {
      // Recovery run: nearest uncollected pod on the authoritative work row.
      const player = getPlayerWorldPosition();
      let nearest = -1;
      let nearestDist = Infinity;
      getSupplyPodPositions().forEach((pos, i) => {
        if (isPodCollected(i)) return;
        const dist = player.distanceTo(pos);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = i;
        }
      });
      if (nearest >= 0) walkTowardTaskRow(getSupplyPodPositions()[nearest], 0.8);
      if (beatClock > timeout) seedSupplyPodsCollected(); // screening must go on
      break;
    }
    case 'ch1-nav': {
      const wp = currentNavWaypointPosition();
      if (wp) walkTowardLens(wp, 1.4);
      if (beatClock > timeout) {
        // Screening must go on: log the fixes and move to the climb.
        seedNavWaypointsReached();
        advanceToBeat('ch1-iso');
      }
      break;
    }
    case 'ch1-iso': {
      // NAV VIEW has already opened the second ground axis: cross the revealed
      // terrain to the uncrowded mesa, then let step assist walk its staircase.
      if (signalMesaHandle.summit) {
        walkTowardLens(signalMesaHandle.summit, 1.6);
      }
      if (beatClock > timeout) advanceToBeat('ch1-lift');
      break;
    }
    case 'ch1-anomaly': {
      // STAGE 1 — the calibration sweep: the era's verb is LOOKING. The pilot
      // pans the gaze around the horizon (eye height — never the ground) until
      // the survey returns the deviation.
      if (!anomalyMassDesignated()) {
        setCinematicGazeIntent(null);
        const a = beatClock * 0.6;
        _goalScratch.copy(getPlayerWorldPosition());
        _goalScratch.x += Math.cos(a) * 14;
        _goalScratch.z += Math.sin(a) * 14;
        _goalScratch.addScaledVector(getPlayerUp(), 1.6);
        setCinematicLookTarget(_goalScratch);
        setCinematicLookWeight(1);
        break;
      }
      // STAGE 2 — the mass: walk in with the gaze ON the stone (lift 1.1), so
      // the touch and the A1 ramp play framed on the subject.
      if (anomalyStoneHandle.position) {
        const distance = walkToward(anomalyStoneHandle.position, 2.6, 1.1);
        if (distance <= 4.2) pulseInteract();
      }
      if (beatClock > timeout) beginA1();
      break;
    }
    case 'ch2-color': {
      // Post-A1 breath: stand in the color for a moment (the shot holds the
      // stone the ramp ended on), then seek the tree — gaze on the CROWN, the
      // one saturated thing in a flat world (crossing the radius flips the beat).
      if (beatClock > 6 && heroTreeHandle.position) {
        walkToward(heroTreeHandle.position, 4.5, treeCrownLift());
      }
      if (beatClock > timeout && story.beat === 'ch2-color') advanceToBeat('ch2-approach');
      break;
    }
    case 'ch2-approach': {
      if (heroTreeHandle.position) {
        const distance = walkToward(heroTreeHandle.position, 3.6, treeCrownLift());
        if (distance <= 5.2) pulseInteract();
      }
      if (beatClock > timeout) beginA2();
      break;
    }
    case 'ch3-gather': {
      // The craft is UI-driven in real play — the screening skips straight to
      // the placed fire (which triggers the dusk). It waits for the CHILL:
      // the fire is a response to the falling TEMP (named at 18s — the body/
      // hold/gather/temp caption ladder precedes it), never before it.
      if (beatClock > 21 && getCampfires().length === 0) {
        grantMissingCampfireMaterials();
        placeCampfire(getPlayerWorldPosition().clone(), getPlayerUp().clone());
      }
      // Rescue (the autopilot guarantee: no beat can stall the screening).
      // Today the fire path is synchronous — place emits, the director's
      // campfire subscription advances — so this only fires if that chain
      // ever grows a failure mode. This was the one driven beat whose
      // BEAT_TIMEOUT entry was never consulted.
      if (beatClock > timeout) advanceToBeat('ch3-dusk');
      break;
    }
    case 'ch3-await-rest': {
      const fire = getCampfires()[0];
      if (fire) {
        const firePos = _target.set(fire.pos[0], fire.pos[1], fire.pos[2]);
        const distance = getPlayerWorldPosition().distanceTo(firePos);
        if (distance > 2.4) {
          walkToward(firePos, 2.4);
        } else {
          controls.forward = false;
          setCinematicLookWeight(0);
          pulseInteract(); // fires once night makes the rest resolver live
        }
      }
      if (beatClock > timeout) {
        // Long dark? Force the rest (the dawn is the point of the screening).
        advanceToBeat('a3-dawn');
      }
      break;
    }
    case 'ch3-thirst': {
      // FLOW, not just completion: the pilot waits for the seek cue ("water
      // finds the low places") before walking — the thirst must be felt and
      // named before it is answered, exactly as real play paces it.
      const pond = storyAnchors.pond;
      if (pond && beatClock > 36) {
        // Stay on the validated dry shore and look into the water. Interaction's
        // ray reaches the surface from here; entering the pond is never required.
        const distance = walkToward(pond.shore, 1.15, 0, pond.surface, 2.6);
        if (distance <= 1.8) pulseInteract();
      }
      if (beatClock > timeout) {
        drink(60); // screening must go on — the director advances on the rise
      }
      break;
    }
    case 'ch3-forage': {
      // Walk to the nearest berry bush (walk-over collects) once the sight cue
      // has landed; eat directly (UI crafting precedent) after the eat window
      // opens. The director advances ~18s after the meal.
      if (movieAte) {
        clearControls();
        setCinematicLookWeight(0);
        break;
      }
      if (getItemCount('berry') + getItemCount('root') > 0) {
        // The hunger was named at 12s and the rounds sighted at 18s — eat then.
        if (beatClock > 20) movieAte = movieEatForage();
        break;
      }
      if (beatClock > 6) {
        if (beatClock - forageGoalAt > 0.5 && storyAnchors.terrainSeed != null) {
          forageGoal = nearestForageNodeWorld(getPlayerWorldPosition(), storyAnchors.terrainSeed, 60);
          forageGoalAt = beatClock;
        }
        if (forageGoal) walkToward(forageGoal, 0.8);
      }
      if (beatClock > timeout && !movieAte) {
        addItem('berry', 2); // sparse seed? the screening still eats
        movieAte = movieEatForage();
      }
      break;
    }
    case 'ch3-signal': {
      // The klaxon run: hold for the summons (the network's lines must land),
      // then SPRINT at the wreck — stamina spends on the way, which is the
      // scene's whole point. The director resolves at the relay.
      if (wreckRelayHandle.position && beatClock > 12) {
        walkToward(wreckRelayHandle.position, 3.0);
        controls.sprint = controls.forward;
      }
      if (beatClock > timeout) {
        markMilestone(STORY_MILESTONES.ch3Signal);
        advanceToBeat('ch4-vigil');
      }
      break;
    }
    case 'ch4-vigil': {
      // The scheduled sleep: hold by the NEAREST fire, rest when dark is
      // issued. Stale saves can carry a distant fire from an older session —
      // if the walk hasn't closed by mid-beat, light a fresh one here (the
      // screening's campfire-placement precedent) so the rest stays honest.
      const player = getPlayerWorldPosition();
      let firePos: THREE.Vector3 | null = null;
      let fireDist = Infinity;
      for (const fire of getCampfires()) {
        const dist = player.distanceTo(_goalScratch.set(fire.pos[0], fire.pos[1], fire.pos[2]));
        if (dist < fireDist) {
          fireDist = dist;
          firePos = _target.set(fire.pos[0], fire.pos[1], fire.pos[2]);
        }
      }
      if (!firePos || (beatClock > 50 && fireDist > 4)) {
        grantMissingCampfireMaterials();
        placeCampfire(player.clone(), getPlayerUp().clone());
      } else if (fireDist > 2.4) {
        walkToward(firePos, 2.4); // reach the fire first, before the dark falls
      } else if (!vigilRestReady()) {
        // Hold a look-up framing through the stargaze + constellation reveal —
        // the pitch above the horizon both drives the director's look-up gate
        // and keeps the shot on the resolving sky, never the ground.
        controls.forward = false;
        controls.backward = false;
        controls.left = false;
        controls.right = false;
        const up = getPlayerUp();
        _toGoal.copy(firePos).sub(player);
        _toGoal.addScaledVector(up, -_toGoal.dot(up)); // horizontal component
        if (_toGoal.lengthSq() < 0.04) _toGoal.set(1, 0, 0);
        _toGoal.normalize();
        setCinematicLookTarget(
          _goalScratch.copy(player).addScaledVector(_toGoal, 4).addScaledVector(up, 10)
        );
        setCinematicGazeIntent(null);
        setCinematicLookWeight(1);
      } else {
        controls.forward = false;
        setCinematicLookWeight(0);
        pulseInteract(); // rests once the sky has finished and the prompt lands
      }
      if (beatClock > timeout) {
        markMilestone(STORY_MILESTONES.ch4Vigil);
        advanceToBeat('ch4-arrival');
      }
      break;
    }
    case 'ch4-audit': {
      const actorId = getLocalActorId();
      let target: THREE.Vector3 | null = null;
      let interactionId: string | undefined;
      if (!hasMilestone(EMERGENT_AUDIT_MILESTONES.fireMismatch, actorId)) {
        const fire = getCampfires()[0];
        target = fire ? new THREE.Vector3(...fire.pos) : null;
        interactionId = 'story-audit-fire';
      } else if (!hasMilestone(EMERGENT_AUDIT_MILESTONES.lifeMismatch, actorId)) {
        target = storyAnchors.pond?.shore ?? null;
        interactionId = 'story-audit-life';
      } else if (!hasMilestone(EMERGENT_AUDIT_MILESTONES.treeMismatch, actorId)) {
        target = heroTreeHandle.position;
        interactionId = 'story-audit-tree';
      }
      if (target) {
        walkToward(target, 3.25, interactionId === 'story-audit-tree' ? treeCrownLift() : 0.8);
        if (getPlayerWorldPosition().distanceTo(target) <= 4.8) performStoryInteraction(interactionId);
      }
      break;
    }
    case 'ch4-comply': {
      const actorId = getLocalActorId();
      let target: THREE.Vector3 | null = null;
      let interactionId: string | undefined;
      if (!hasMilestone(EMERGENT_AUDIT_MILESTONES.fireComplied, actorId)) {
        const fire = getCampfires()[0];
        target = fire ? new THREE.Vector3(...fire.pos) : null;
        interactionId = 'story-comply-fire';
      } else if (!hasMilestone(EMERGENT_AUDIT_MILESTONES.organicsComplied, actorId)) {
        target = wreckRelayHandle.position;
        interactionId = 'story-comply-organics';
      }
      if (target) {
        walkToward(target, 3.1, 0.8);
        if (getPlayerWorldPosition().distanceTo(target) <= 4) performStoryInteraction(interactionId);
      }
      break;
    }
    case 'ch4-defy': {
      const target = heroTreeHandle.position;
      if (target) {
        walkToward(target, 3.1, treeCrownLift());
        if (getPlayerWorldPosition().distanceTo(target) <= 4) {
          performStoryInteraction('story-refuse-tree');
        }
      }
      break;
    }
    case 'ch5-maw': {
      const actorId = getLocalActorId();
      const directionResolved = hasMilestone(
        EMERGENT_MAW_MILESTONES.directionResolved,
        actorId
      );
      const pondResonant = hasMilestone(
        EMERGENT_MAW_MILESTONES.pondResonance,
        actorId
      );
      if (directionResolved && !pondResonant) {
        const pond = storyAnchors.pond;
        if (!pond) break;
        // Route to authored dry ground, then use the same accessible Attend
        // action available to manual play. Interaction gaze gives the response
        // a composed frame without taking ownership away from the camera rig.
        const shoreDistance = walkToward(
          pond.shore,
          3,
          1.35,
          pond.surface,
          5.2
        );
        if (shoreDistance <= 5.2) {
          performStoryInteraction('story-maw-pond-attend');
        }
        break;
      }

      const pack = storyAnchors.fieldPack;
      if (pack && !pondResonant) {
        walkToward(pack.position, 2.7, 0.7);
        if (getPlayerWorldPosition().distanceTo(pack.position) <= 3.7) {
          performStoryInteraction(
            hasMilestone('story:item:maw-repair-kit:acquired', actorId)
              ? 'story-maw-repair'
              : 'story-field-kit'
          );
        }
      }
      break;
    }
    case 'ch6-dive': {
      const actorId = getLocalActorId();
      const size = storyAnchors.planetSize;
      const seed = storyAnchors.terrainSeed;
      if (size === null || seed === null) break;
      const acquired = hasMilestone(EMERGENT_UNIQUE_ITEM_MILESTONES.keelMemory, actorId);
      const submergence = getPlayerSubmersion(actorId).submergence;
      const surfacedWithKeel = hasMilestone(
        AUTHORED_DIVE_MILESTONES.surfacedWithKeel,
        actorId
      );
      diveRecoveryActive = surfacedWithKeel
        ? false
        : acquired && submergence >= AUTHORED_DIVE_ENTER_SUBMERGENCE
          ? true
          : nextDiveRecoveryState({
              active: diveRecoveryActive,
              oxygen: getVitals(actorId).oxygen,
              submergence
            });
      const returning = surfacedWithKeel || diveRecoveryActive;
      const pond = storyAnchors.pond;
      const keelTarget = getKeelMemoryPose(size, seed)?.position ?? null;
      if (!returning && !diveAimReady && pond && keelTarget) {
        const shoreDistance = moveThroughWaterToward(
          pond.shore,
          2.7,
          'dive',
          keelTarget
        );
        diveAimReady = nextDiveAimReady({
          active: diveAimReady,
          pitch: getPlayerLook().pitch,
          shoreDistance,
          submergence
        });
        break;
      }
      const target = returning
        ? pond?.shore ?? null
        : keelTarget;
      if (!target) break;
      if (!returning && keelTarget) {
        diveColumnLocked = nextDiveColumnLock({
          active: diveColumnLocked,
          player: getPlayerWorldPosition(),
          target: keelTarget,
          up: getPlayerUp(),
          submergence,
          stopDistance: 2.4
        });
      }
      const distance = moveThroughWaterToward(
        target,
        returning ? 2.7 : 2.4,
        returning ? 'surface' : 'dive',
        undefined,
        !returning && diveColumnLocked
      );
      if (surfacedWithKeel && submergence <= 0.2 && distance <= 4.1) {
        performStoryInteraction('story-keel-bank');
      } else if (!diveRecoveryActive && keelTarget
        && getPlayerWorldPosition().distanceTo(keelTarget) <= 3.2) {
        performStoryInteraction('story-keel-free');
      }
      break;
    }
    case 'ch7-reconstruct': {
      const binding = getEmergentMovieWreckBinding();
      const target = binding?.workstationPosition ?? hifiWreckHandle.position;
      if (!target) break;
      const submergence = getPlayerSubmersion(getLocalActorId()).submergence;
      if (shouldExitWaterBeforeMovieWreck(submergence)) {
        moveThroughWaterToward(target, 2.8, 'surface');
        break;
      }
      const distance = getPlayerWorldPosition().distanceTo(target);
      const interactionMotion = movieWreckInteractionMotion(distance);
      if (shouldApproachMovieWreck(distance)) {
        walkToward(target, 2.8, 0.8);
        if (navigationAction === 'unreachable'
          && shouldRecoverMovieWreckWetStart(navigationReason)) {
          // An unreachable route is cached. Clear it on every wet-column
          // recovery step so the dry planner can take over immediately after
          // the capsule reaches traversable shore.
          resetNavigationRoute();
          moveThroughWaterToward(target, 2.8, 'surface');
        }
        break;
      }
      if (interactionMotion === 'retreat') {
        const player = getPlayerWorldPosition();
        const wreck = hifiWreckHandle.position;
        const up = getPlayerUp();
        const annulusGoal = wreck && resolveMovieWreckInteractionAnnulusGoal({
          player: [player.x, player.y, player.z],
          workstation: [target.x, target.y, target.z],
          wreck: [wreck.x, wreck.y, wreck.z],
          surfaceUp: [up.x, up.y, up.z]
        });
        if (annulusGoal) {
          _wreckInteractionScratch.set(...annulusGoal);
          // Ordinary surface navigation validates every retreat step. Keeping
          // gaze on the bench naturally produces a short backward/side step;
          // no recovery teleport or synthetic interaction is involved.
          walkToward(_wreckInteractionScratch, 0.3, 0.2, target, 4.4);
        } else {
          holdAt(target, 0.8);
        }
        break;
      }
      // The live resolver has already proven physical reach. Stand and look at
      // the bench instead of pushing into its tighter route waypoint.
      holdAt(target, 0.8);
      // Recipe fabrication is allowed only while the live wreck bench has
      // published assembler access. The next frame's registered F action then
      // consumes the crafted part in the ordered repair transaction.
      prepareEmergentMovieWreckCraft(getLocalActorId());
      performStoryInteraction();
      break;
    }
    case 'ch7-board': {
      const ship = getShipPosition();
      if (!ship) break;
      const target = _goalScratch.set(ship[0], ship[1], ship[2]);
      walkToward(target, 2.4, 1.1);
      if (isBoardable() && getPlayerWorldPosition().distanceTo(target) <= 3.5) enterShip();
      break;
    }
    case 'ch8-launch': {
      const flight = getSpaceFlightSnapshot();
      controls.jump = flight.controlMode === 'flight' && flight.phase === 'surface';
      controls.forward = flight.controlMode === 'flight' && flight.phase !== 'surface';
      controls.sprint = controls.forward;
      break;
    }
    case 'ch8-crossing': {
      controls.forward = getSpaceFlightSnapshot().controlMode === 'flight';
      controls.sprint = controls.forward;
      break;
    }
    case 'ch8-landfall': {
      const flight = getSpaceFlightSnapshot();
      if (flight.controlMode === 'flight' && flight.phase === 'descent') {
        controls.forward = true;
        controls.interact = true;
      } else if (flight.controlMode === 'flight' && flight.phase === 'surface') {
        exitShip();
      }
      break;
    }
    case 'ch9-settle': {
      const actorId = getLocalActorId();
      const binding = getEmergentMovieSettlementBinding();
      if (!binding) break;
      const habitat = getHabitatWorldState(TIDEGARDEN_WORLD_ID);
      if (!hasMilestone(TIDEGARDEN_SETTLEMENT_MILESTONES.relationshipAttended, actorId)) {
        const relationship = binding.relationship;
        if (!relationship) break;
        walkToward(relationship.position, 3.4, 0.5);
        if (getPlayerWorldPosition().distanceTo(relationship.position) <= 5) {
          performStoryInteraction('story-tidegarden-attend');
        }
        break;
      }

      if (!habitat) {
        const chosen = getTidegardenChosenHabitatSite(actorId);
        habitatGoal ??= resolveTidegardenSettlementTarget('choose-site')
          ?? findEmergentMovieHabitatGoal(getPlayerWorldPosition());
        if (!habitatGoal) break;
        if (!chosen) {
          const siteDistance = walkToward(habitatGoal, 0.45, 0.4);
          if (siteDistance <= 2) performStoryInteraction('story-tidegarden-choose-site');
          break;
        }
        // Once the site belongs to the player, the Kestrel's carried fabricator
        // is the truthful next destination. Do not fabricate the Core before
        // the relationship/site choices merely to simplify a screening.
        if (!prepareEmergentMovieHabitatCore(actorId)) {
          const ship = resolveTidegardenSettlementTarget('craft-core')
            ?? (() => {
              const pose = getShipPosition();
              return pose ? _goalScratch.set(pose[0], pose[1], pose[2]) : null;
            })();
          if (ship) {
            walkToward(ship, 4.5, 1.1);
            if (getPlayerWorldPosition().distanceTo(ship) <= 7.5) {
              prepareEmergentMovieHabitatCore(actorId);
            }
          }
          break;
        }
        const chosenGoal = resolveTidegardenSettlementTarget('foundation') ?? habitatGoal;
        const chosenDistance = walkToward(chosenGoal, 0.45, 0.4);
        if (chosenDistance <= 2) {
          installEmergentMovieHabitatCore(getPlayerWorldPosition(), actorId);
        }
        break;
      }

      const corePosition = resolveTidegardenSettlementTarget('certify-shelter')
        ?? _goalScratch.set(...habitat.core.position);
      const coreDistance = walkToward(corePosition, 0.35, 0.8);
      if (coreDistance <= 2) {
        if (buildAndCertifyEmergentMovieShelter(getPlayerWorldPosition(), actorId)) {
          holdAt(corePosition, 0.8);
        }
      }
      break;
    }
    case 'ch9-hearth': {
      const actorId = getLocalActorId();
      const habitat = getHabitatWorldState(TIDEGARDEN_WORLD_ID);
      if (!habitat) break;
      const corePosition = resolveTidegardenSettlementTarget('rest')
        ?? _goalScratch.set(...habitat.core.position);
      const coreDistance = walkToward(corePosition, 0.35, 0.8);
      if (coreDistance <= 2) {
        completeEmergentMovieSafeRest(getPlayerWorldPosition(), getCurrentDayPhase(), actorId);
        // Rest is allowed only at real night. Hold inside the proven enclosure
        // between attempts instead of feeding the goal to the stuck watchdog.
        holdAt(corePosition, 0.8);
      }
      break;
    }
    default:
      break;
  }

  const surfaceContact = getLocalPlayerSurfaceContact();
  const purportedDryCrossFaceMovement = navigationReason === 'cross-face-edge-crossing'
    ? !!activeNavigationRoute && activeNavigationRoute.route.waterCrossing === null
    : navigationReason.startsWith('cross-face-forward-handoff')
      && crossFaceContinuationExpectsDry;
  if (purportedDryCrossFaceMovement && surfaceContact.feetInWater) {
    dryCrossFaceWaterContactFramesTotal++;
  }
  // Same-face shoreline signal: a nominally dry walk/direct leg (no planned
  // crossing) that keeps the feet in water. Dry ticks relax the count so only
  // sustained pond-edge grinding — not an incidental splash — forces a replan.
  const nominallyDrySameFaceLeg = navigationReason !== 'cross-face-edge-crossing'
    && !navigationReason.startsWith('cross-face-forward-handoff')
    && (navigationAction === 'walk' || navigationAction === 'direct')
    && !!activeNavigationRoute
    && activeNavigationRoute.route.waterCrossing === null;
  if (nominallyDrySameFaceLeg && surfaceContact.feetInWater) {
    dryWalkWaterContactFramesTotal++;
  } else if (!surfaceContact.feetInWater && dryWalkWaterContactFramesTotal > 0) {
    dryWalkWaterContactFramesTotal--;
  }

  // Dev affordance (movie only): capture harnesses sample the pilot's state.
  if (typeof window !== 'undefined') {
    const pos = getPlayerWorldPosition();
    (window as unknown as { __autopilot?: object }).__autopilot = {
      beat,
      clock: Math.round(beatClock * 10) / 10,
      pos: [Math.round(pos.x * 100) / 100, Math.round(pos.y * 100) / 100, Math.round(pos.z * 100) / 100],
      goal: walkTargetLive ? [Math.round(_target.x * 10) / 10, Math.round(_target.y * 10) / 10, Math.round(_target.z * 10) / 10] : null,
      routeAction: navigationAction,
      routeOutcome: navigationReason,
      routePlanMode: activeNavigationRoute?.route.mode ?? null,
      routeWaterCells: activeNavigationRoute?.route.waterCrossing?.waterCellCount ?? 0,
      routeWaypoint: activeNavigationRoute
        ? [
            Math.round(_navigationWaypoint.x * 10) / 10,
            Math.round(_navigationWaypoint.y * 10) / 10,
            Math.round(_navigationWaypoint.z * 10) / 10
          ]
        : null,
      controls: { ...controls },
      stillTime: Math.round(stillTime * 10) / 10,
      nudges: nudgesOnGoal,
      teleportNudgesTotal,
      dryCrossFaceWaterContactFramesTotal,
      dryWalkWaterContactFramesTotal,
      surfaceContact,
      lens: (() => {
        const l = getSideLens();
        if (!l) return null;
        const drift = getPlayerWorldPosition().clone().sub(l.origin).dot(l.depthAxis);
        return {
          originZ: Math.round(l.origin.z * 10) / 10,
          depthAxisZ: l.depthAxis.z,
          band: getLensRig().depthBand,
          drift: Math.round(drift * 100) / 100
        };
      })()
    };
  }

  // --- stuck watchdog (runs over whatever the beat handler decided) -----------
  const pushing = controls.forward || controls.backward || controls.left || controls.right;
  const plannedRecoveryUnsafe = navigationAction === 'jetpack' || navigationAction === 'unreachable';
  const teleportRecoveryAllowed = allowsMovieTeleportRecovery(beat);
  const pos = getPlayerWorldPosition();
  if (Number.isFinite(_lastPos.x)) {
    // HORIZONTAL displacement only: jumping in place must read as STUCK —
    // vertical bounce used to reset this timer and starve the rescue chain.
    _stillDelta.copy(pos).sub(_lastPos);
    const up = getPlayerUp();
    _stillDelta.addScaledVector(up, -_stillDelta.dot(up));
    if (pushing && _stillDelta.length() < 0.06) stillTime += dt;
    else stillTime = 0;
  }
  _lastPos.copy(pos);
  const wetStartEgress = navigationReason === 'wet-start-egress';
  const plannedJetpack = plannedJetpackJumpDecision({
    active: navigationAction === 'jetpack',
    pushing,
    entering: navigationAction === 'jetpack'
      && pushing
      && (!plannedJetpackWasActive || (plannedJetpackWasWetStartEgress && !wetStartEgress)),
    routeReason: navigationReason,
    now: beatClock,
    horizontalStillSeconds: stillTime,
    releaseUntil: plannedJetpackReleaseUntil
  });
  if (navigationAction === 'jetpack') {
    controls.jump = plannedJetpack.jumpHeld;
    if (plannedJetpack.holdMovement) {
      // Rearm on the dry launch cell. Continuing to walk during this release
      // steps the body into water, where the player's real submerged controller
      // correctly suppresses jetpack thrust before the repress can occur.
      controls.forward = false;
      controls.backward = false;
      controls.left = false;
      controls.right = false;
    }
    plannedJetpackReleaseUntil = plannedJetpack.releaseUntil;
    if (plannedJetpack.resetStillTime) stillTime = 0;
  } else {
    plannedJetpackReleaseUntil = -1;
  }
  plannedJetpackWasActive = navigationAction === 'jetpack' && pushing;
  plannedJetpackWasWetStartEgress = navigationAction === 'jetpack' && wetStartEgress;
  if (pushing && !plannedRecoveryUnsafe && stillTime > 2.2 && beatClock > unstickUntil) {
    unstickFlips++;
    stillTime = 0;
    // ESCALATION: three failed break-outs against the same geometry means the
    // straight line is unwalkable (a 2-block rise, a corner pocket). The
    // screening must go on: teleport-nudge toward the goal (movie-only; the
    // physics side is gated on isAutopilotDriving).
    if (unstickFlips >= 2 && walkTargetLive && teleportRecoveryAllowed) {
      _nudge.copy(_target).sub(pos);
      const up = getPlayerUp();
      _nudge.addScaledVector(up, -_nudge.dot(up)); // horizontal component only
      if (_nudge.lengthSq() > 0.01) _nudge.normalize().multiplyScalar(2.4);
      _nudge.addScaledVector(up, 2.3); // over the lip, gravity settles the rest
      requestPlayerNudge(_nudge);
      nudgesOnGoal++;
      teleportNudgesTotal++;
      unstickFlips = 0;
      unstickUntil = beatClock; // no reverse dance after a nudge — just walk
    } else {
      unstickUntil = beatClock + 1.6;
    }
  }
  // Arrived-but-inert: the gait released at its stop radius, a goal is still
  // live, and nothing has advanced — the trigger volume must be inches away.
  // Shove gently toward the goal (and count it, so deferral can move on).
  if (walkTargetLive && teleportRecoveryAllowed && !plannedRecoveryUnsafe && !pushing) {
    arrivedTime += dt;
    if (arrivedTime > 4) {
      arrivedTime = 0;
      nudgesOnGoal++;
      _nudge.copy(_target).sub(pos);
      const upA = getPlayerUp();
      _nudge.addScaledVector(upA, -_nudge.dot(upA));
      if (_nudge.lengthSq() > 0.01) _nudge.normalize().multiplyScalar(1.2);
      _nudge.addScaledVector(upA, 0.4);
      requestPlayerNudge(_nudge);
      teleportNudgesTotal++;
    }
  } else {
    arrivedTime = 0;
  }

  if (!plannedRecoveryUnsafe && beatClock < unstickUntil) {
    // Break-out routine: mash jump; on alternating attempts, briefly reverse.
    controls.jump = true;
    if (unstickFlips % 2 === 0 && beatClock < unstickUntil - 0.8) {
      const f = controls.forward;
      controls.forward = controls.backward;
      controls.backward = f;
      const l = controls.left;
      controls.left = controls.right;
      controls.right = l;
    }
  }

  // The probe object is created before watchdog decisions so it can include
  // route-planner state. Refresh the mutable fields after the final control
  // override; otherwise release pulses misleadingly appear as held jump input.
  if (typeof window !== 'undefined') {
    const debug = (window as unknown as {
      __autopilot?: {
        controls?: typeof controls;
        stillTime?: number;
        jetpackReleaseRemaining?: number;
      };
    }).__autopilot;
    if (debug) {
      debug.controls = { ...controls };
      debug.stillTime = Math.round(stillTime * 10) / 10;
      debug.jetpackReleaseRemaining = Math.max(
        0,
        Math.round((plannedJetpackReleaseUntil - beatClock) * 10) / 10
      );
    }
  }
}
