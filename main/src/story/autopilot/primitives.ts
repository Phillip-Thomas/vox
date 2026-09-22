import { tick as tickUnfinishedMapRail } from './rail-ch14.ts';
import { getUnfinishedMapSnapshot } from '../unfinishedMapDirector.ts';
import { getConstructionGatheringSnapshot } from './resourceGathering.ts';
import { treeFieldHandle } from '../../components/TreeField.tsx';
import { BEAT_DEFINITIONS } from '../beats/definitions.ts';
import { BEAT_RAILS } from './rails.ts';
import { autopilotWorldAccess } from './worldAccess.ts';
import { interactionApproachGoal } from './interactionApproach.ts';
import { movieStationApproach } from './stationApproach.ts';
import { getWorldGen } from '../../utils/worldGenCache.ts';
import * as THREE from 'three';
import { getStoryStateSnapshot, STORY_MILESTONES, type StoryBeat } from '../storyState.ts';
import { applyCommonGroundRail } from '../commonGroundDirector.ts';
import {
  STATION_RETURN_INSTALL_REACH,
  STATION_RETURN_MILESTONES
} from '../stationReturnStory.ts';
import { CG_POSES } from '../commonGroundState.ts';
import { getAppStateSnapshot } from '../../state/appState.ts';
import { getPlayerLook, getPlayerWorldPosition, getPlayerUp } from '../../state/playerFrame.ts';
import { getItemCount } from '../../game/systems/inventorySystem.ts';
import { getCampfires } from '../../game/systems/campfires.ts';
import { getVitals } from '../../game/systems/survivalVitals.ts';
import { hasMilestone } from '../../game/systems/progressionSystem.ts';
import { getLocalActorId } from '../../game/playerActors.ts';
import { getHabitatWorldState } from '../../game/systems/habitatSystem.ts';
import { nearestForageNodeWorld } from '../../components/ForageField.tsx';
import { anomalyStoneHandle } from '../world/AnomalyStone.tsx';
import { signalMesaHandle } from '../world/SignalMesa.tsx';
import { heroTreeHandle } from '../world/HeroAppleTree.tsx';
import { wreckRelayHandle } from '../world/WreckRelay.tsx';
import { st0GazeHandle } from '../../components/SystemCompanionBodies.tsx';
import {
  getKeelMemoryPose,
  storyAnchors,
  STORY_COORDINATE
} from '../world/storyWorld.ts';
import { buildStarSystemManifest } from '../../game/starSystem.ts';
import { isSpawnSettled } from '../../game/spawnSettle.ts';
import { anomalyMassDesignated, vigilRestReady, currentGatherObjectiveStage, currentGatherMarkerResource, nearestGatherResourceTarget } from '../storyDirector.ts';
import { setStoryMoveScale } from '../storyInputPolicy.ts';
import {
  setCinematicGazeIntent,
  setCinematicLookTarget,
  getCinematicLookWeight,
  setCinematicLookWeight,
  type CinematicGazeMode
} from '../cinematicLook.ts';
import { getLensRig, getSideLens, rigMoveBasis } from '../sideLens.ts';
import {
  getDebrisPositions,
  getDebrisScattered,
  isDebrisCollected
} from '../debrisSalvage.ts';
import { CH1_FIXED_TUTORIAL, CH1_QUOTA } from '../storyScript.ts';
import { getSupplyPodPositions, isPodCollected } from '../supplyPods.ts';
import { currentNavWaypointPosition } from '../navWaypoints.ts';
import { taskRowMoveIntent } from '../taskRowNavigation.ts';
import { planAgentSurfaceRoute, type AgentSurfaceRoute } from '../../utils/agentSurfaceNavigation.ts';
import type { CubeFace } from '../../types/cube.ts';
import { createLiveAgentSurfaceTerrain } from '../../utils/agentSurfaceNavigationRuntime.ts';
import { dominantFaceForPosition } from '../../utils/surfaceControls.ts';
import {
  PLAYER_CAPSULE_RADIUS,
  PLAYER_EDGE_RADIUS,
  VOXEL_SCALE
} from '../../utils/cubeGravityConstants.ts';
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
} from '../autopilotSteering.ts';
import {
  EMERGENT_AUDIT_MILESTONES
} from '../emergentAudit.ts';
import { EMERGENT_MAW_MILESTONES } from '../emergentMawRepair.ts';
import { EMERGENT_UNIQUE_ITEM_MILESTONES } from '../emergentUniqueItems.ts';
import {
  AUTHORED_DIVE_ENTER_SUBMERGENCE,
  AUTHORED_DIVE_MILESTONES
} from '../emergentDive.ts';
import { resolveStoryInteraction } from '../storyInteractions.ts';
import { hifiWreckHandle } from '../world/hifiWreck.ts';
import { getShipPosition, isBoardable } from '../../state/shipProximity.ts';
import {
  enterShip,
  exitShip,
  getSpaceFlightSnapshot
} from '../../state/spaceFlight.ts';
import { getSystemFlightSnapshot } from '../../state/systemFlight.ts';
import { getCurrentDayPhase } from '../../game/worldClock.ts';
import { isHabitatNight } from '../tidegardenSettlement.ts';
import { setStoryForcedDayPhase } from '../storyDayPhase.ts';
import {
  buildAndCertifyEmergentMovieShelter,
  completeEmergentMovieSafeRest,
  findEmergentMovieHabitatGoal,
  getEmergentMovieSettlementBinding,
  getEmergentMovieWreckBinding,
  installEmergentMovieHabitatCore,
  openEmergentMovieShelterEgress,
  prepareEmergentMovieHabitatCore,
  prepareEmergentMovieWreckCraft,
  emergentMovieConstructionWoodNeeded,
  emergentMovieShelterView,
  emergentMovieShelterEgressGoal
} from '../emergentMovieRuntime.ts';
import {
  chapter10ClaimedStationBody,
  chapter10WreckSitePosition,
  STATION_STANDOFF_DISTANCE
} from '../emergentStoryDirector.ts';
import { commitSpaceStationDock, spaceStationApproachGeometry } from '../../components/SpaceStationApproachDriver.tsx';
import { spaceStationDockingAuthorized } from '../../game/spaceStation/spaceStationDevFlag.ts';
import {
  getTidegardenChosenHabitatSite,
  TIDEGARDEN_SETTLEMENT_MILESTONES
} from '../tidegardenSettlement.ts';
import { resolveTidegardenSettlementTarget } from '../tidegardenSettlementTargets.ts';
import { STORY_PRIMARY_WORLD_ID, TIDEGARDEN_WORLD_ID } from '../tidegardenRoute.ts';
import { getPlayerSubmersion } from '../../state/playerSubmersion.ts';
import { getLocalPlayerSurfaceContact } from '../../state/playerSurfaceContact.ts';
import {
  autopilotSwimPhysicsOverride,
  nextDiveAimReady,
  nextDiveColumnLock,
  nextDiveRecoveryState,
  planAutopilotSwim,
  type AutopilotSwimMode
} from '../autopilotSwim.ts';
import {
  movieWreckInteractionMotion,
  resolveMovieWreckInteractionAnnulusGoal,
  shouldApproachMovieWreck,
  shouldExitWaterBeforeMovieWreck,
  shouldRecoverMovieWreckWetStart
} from '../autopilotReconstruction.ts';
import { isStoryJetInstalled } from '../emergentCapabilities.ts';
import { plannedJetpackJumpDecision } from '../autopilotJetpackNavigation.ts';
import {
  planReachableCrossFaceRoute,
  shouldExtendCrossFaceContinuation,
  shouldReplanDryWaterContact,
  shouldReplanUnreachableRoute,
  type NavigationSurfaceContactSignature
} from '../autopilotCrossFaceNavigation.ts';

// --- Story autopilot (movie mode) -----------------------------------------------
//
// Dev-only: drives the player through the whole arc so the story can be WATCHED
// and critiqued end to end. `&movie=1` (any ?story= start point) turns it on.
// The autopilot publishes a virtual gamepad that EfficientPlayer merges over the
// real keyboard and aims via the cinematic look-pull. A rail exceeding its
// budget reports an explicit failure; the screening never grants progression.
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

export function isAutopilotDriving(): boolean {
  if (!MOVIE) return false;
  const story = getStoryStateSnapshot();
  if (story.active && !!story.beat && Boolean(BEAT_DEFINITIONS[story.beat]?.rail.tick)
    && getAppStateSnapshot().phase === 'playing') return true;
  // The post-terminal bridges drive the body too.
  return movieDoneBridgeActive() || movieStationBridgeActive() || movieReturnBridgeActive() || movieMapBridgeActive();
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
  /**
   * SYSTEM-SPACE point the movie lane wants the nose on, when the thing being
   * flown toward is not a planet. `targetWorldId` can only name bodies in the
   * system manifest's planet list, and chapter 10's destination is a station —
   * so the one destination in the game that has no world id had no way to be
   * aimed at, and the transit leg thrusted with no bearing.
   *
   * Null for every shipped beat and every ch1-ch9 movie path: the field exists
   * so ONE lane can say a bearing out loud, not so the flight model grows a
   * second steering authority.
   */
  targetSystemPosition: readonly [number, number, number] | null;
  controls: Readonly<AutopilotControls>;
}

/**
 * Beats with a FLIGHT SEGMENT the movie lane must fly. A set, not a chain of
 * beat literals: the literal chain is the bug class this run has now hit three
 * times (the world-prop chapter regex, the boot-world enumeration, and this),
 * and each time the symptom was a new chapter silently doing nothing.
 *
 * ch10-ask carries the return crossing (Tidegarden to the origin world, then
 * landfall by the relay) and ch10-transit carries the whole issued-bearing
 * flight, so both belong here beside ch8's three.
 */
const FLIGHT_DIRECTIVE_BEATS: ReadonlySet<StoryBeat> = new Set([
  'ch8-launch', 'ch8-crossing', 'ch8-landfall',
  'ch10-ask', 'ch10-transit',
  // ch13's return leg is ch10-ask's shape in the other direction: it starts on
  // foot at the hearth, boards, crosses to Origin and lands at the audit site,
  // so like chapter 10 it only speaks while the ship is the body being driven.
  'ch13-return'
]);

/** ShipController consumes the same virtual controls as the on-foot body. */
export function getAutopilotFlightDirective(): AutopilotFlightDirective {
  const story = getStoryStateSnapshot();
  const beat = story.active ? story.beat : null;
  const interleavesWalkAndFlight = beat === 'ch10-ask' || beat === 'ch10-transit'
    || beat === 'ch13-return';
  // ch8's beats are wholly airborne. Chapter 10 interleaves walking and flying
  // inside one beat, so its directive speaks only while the ship is the body
  // being driven — on-foot frames stay exactly as they are today.
  const inFlight = getSpaceFlightSnapshot().controlMode === 'flight';
  // THE POST-TERMINAL BRIDGES FLY TOO, and they have no beat.
  //
  // `active` used to require a beat, so the station and return bridges asserted
  // thrust into a directive nobody read: `ShipController` takes its controls
  // from `movieFlight.active ? movieFlight.controls : get()`, and with the
  // directive inactive the ship answered an empty keyboard. Both bridges already
  // resolve a real destination, and the shipped steering branches below already
  // know how to fly at a world or at a system point, so the honest fix is to
  // tell the directive they exist rather than to teach the ship a new trick.
  const stationBridge = movieStationBridgeActive();
  const returnBridge = movieReturnBridgeActive();
  const bridgeFlying = (stationBridge || returnBridge) && inFlight;
  const active = MOVIE
    && ((beat !== null && FLIGHT_DIRECTIVE_BEATS.has(beat)
      && (!interleavesWalkAndFlight || inFlight))
      || bridgeFlying);
  return {
    active,
    beat,
    targetWorldId: bridgeFlying
      ? bridgeTargetWorldId(returnBridge)
      : flightDirectiveTargetWorldId(beat),
    targetSystemPosition: bridgeFlying
      ? bridgeTargetSystemPosition(stationBridge, returnBridge)
      : flightDirectiveTargetSystemPosition(beat),
    controls
  };
}

/** The return bridge crosses to Tidegarden; the station bridge flies at a berth. */
function bridgeTargetWorldId(returnBridge: boolean): string | null {
  if (!returnBridge) return null;
  return getSystemFlightSnapshot().activePlanetId === TIDEGARDEN_WORLD_ID
    ? null
    : TIDEGARDEN_WORLD_ID;
}

function bridgeTargetSystemPosition(
  stationBridge: boolean,
  returnBridge: boolean
): readonly [number, number, number] | null {
  // A station is the one destination in the game with no world id, which is why
  // the transit leg needed this branch in the first place.
  if (stationBridge) {
    const body = chapter10ClaimedStationBody();
    return body ? movieStationApproach(body, getSystemFlightSnapshot().pose).target : null;
  }
  if (!returnBridge) return null;
  // Once Tidegarden encloses the ship, aim the descent at the actual hearth
  // rather than at the planet centre, so the landing is somewhere it can land.
  const system = getSystemFlightSnapshot();
  if (system.activePlanetId !== TIDEGARDEN_WORLD_ID) return null;
  const flight = getSpaceFlightSnapshot();
  if (flight.controlMode !== 'flight' || flight.phase === 'surface') return null;
  const habitat = getHabitatWorldState(TIDEGARDEN_WORLD_ID);
  if (!habitat) return null;
  const manifest = buildStarSystemManifest(STORY_COORDINATE);
  const tidegarden = manifest.planets.find(planet => planet.worldId === TIDEGARDEN_WORLD_ID);
  if (!tidegarden) return null;
  return [
    tidegarden.systemPosition[0] + habitat.core.position[0],
    tidegarden.systemPosition[1] + habitat.core.position[1],
    tidegarden.systemPosition[2] + habitat.core.position[2]
  ];
}

/**
 * The system-space point the transit leg flies at: the station the PLAYER
 * committed at the relay, read back out of the same systemFlight target
 * `commitSpaceStationTarget` wrote. The pilot never picks a destination — it
 * only flies the bearing the claim already issued, which is the whole meaning
 * of the beat.
 */
function flightDirectiveTargetSystemPosition(
  beat: StoryBeat | null
): readonly [number, number, number] | null {
  // The origin-side descent aims at the WRECK SITE, which is where the beat
  // lands and the only ground it is known to be able to land on.
  //
  // requestLanding() refuses silently unless the ship is essentially directly
  // over a valid egress site (findValidSpawnSite runs with maxSearchRadius 0
  // and requirePlayerEgress true). Holding the crossing heading put the ship
  // wherever the planet-centre bearing happened to point, so whether the leg
  // completed was a function of arrival POSITION — a lottery that hung the
  // landfall rung indefinitely whenever it came up short. Aiming at the site
  // the contract already tells the pilot to land near removes the lottery.
  if (beat === 'ch10-ask') return chapter10AskDescentSystemTarget();
  // Same lottery, same fix, in the other direction: aim the Origin descent at
  // the audit site rather than at the planet centre, so `requestLanding()` has
  // somewhere valid under the ship when it is asked.
  if (beat === 'ch13-return') return commonGroundDescentSystemTarget();
  if (beat !== 'ch10-transit') return null;
  // DURABLE, not transient. Reading the flight store alone meant a deep link or
  // a reload — which seed the claim milestone without running the commit — gave
  // the movie lane no bearing at all, and the ship held one attitude for the
  // whole beat while the station receded past 222,000 units.
  return chapter10ClaimedStationBody()?.systemPosition ?? null;
}

/** The world the ship is being flown TO, when the leg is a world crossing. */
function flightDirectiveTargetWorldId(beat: StoryBeat | null): string | null {
  if (beat === 'ch8-crossing') return TIDEGARDEN_WORLD_ID;
  if (beat === 'ch13-return') {
    return getSystemFlightSnapshot().activePlanetId === STORY_PRIMARY_WORLD_ID
      ? null
      : STORY_PRIMARY_WORLD_ID;
  }
  // The ask beat's return crossing is ch8's, reversed: hold the origin world's
  // bearing until it is the enclosing world, then release the heading so the
  // descent to the wreck is flown against the surface rather than the body.
  if (beat === 'ch10-ask') {
    return getSystemFlightSnapshot().activePlanetId === STORY_PRIMARY_WORLD_ID
      ? null
      : STORY_PRIMARY_WORLD_ID;
  }
  return null;
}


/**
 * The wreck site in SYSTEM space, for the ch10-ask descent leg only.
 *
 * Derivable, not stored: the site is a pure function of the origin world's size
 * and seed, exactly like the station bearing is a pure function of the system
 * seed. Null until the origin world actually encloses the ship and null once it
 * is down, so the crossing keeps the planet-centre heading it needs to arrive
 * at all and nothing steers a grounded ship.
 */
/** The ch13 audit site in SYSTEM space, for the return leg's descent only. */
export function commonGroundDescentSystemTarget(): readonly [number, number, number] | null {
  const system = getSystemFlightSnapshot();
  if (system.activePlanetId !== STORY_PRIMARY_WORLD_ID) return null;
  const flight = getSpaceFlightSnapshot();
  if (flight.controlMode !== 'flight' || flight.phase === 'surface') return null;
  const manifest = buildStarSystemManifest(STORY_COORDINATE);
  const origin = manifest.planets.find(planet => planet.worldId === STORY_PRIMARY_WORLD_ID);
  if (!origin) return null;
  return [
    origin.systemPosition[0] + CG_POSES.W.x,
    origin.systemPosition[1] + CG_POSES.W.y,
    origin.systemPosition[2] + CG_POSES.W.z
  ];
}

export function chapter10AskDescentSystemTarget(): readonly [number, number, number] | null {
  const system = getSystemFlightSnapshot();
  if (system.activePlanetId !== STORY_PRIMARY_WORLD_ID) return null;
  const flight = getSpaceFlightSnapshot();
  if (flight.controlMode !== 'flight' || flight.phase === 'surface') return null;
  const site = chapter10WreckSitePosition();
  if (!site) return null;
  const manifest = buildStarSystemManifest(STORY_COORDINATE);
  const origin = manifest.planets.find(planet => planet.worldId === STORY_PRIMARY_WORLD_ID);
  if (!origin) return null;
  return [
    origin.systemPosition[0] + site.x,
    origin.systemPosition[1] + site.y,
    origin.systemPosition[2] + site.z
  ];
}


// --- ST-0 idle-gaze bias (D-A3, movie lane only) ----------------------------
//
// Cinematography's ruling, implemented to its exact terms. The night walk from
// the hearth to the fabricator is the run's ST-0 evidence window, and an
// unbiased pilot stares at its goal the whole way, so the dot never lands in
// frame. This lets the pilot GLANCE UP between goal-critical look demands.
//
// It is a gaze bias and nothing else: heading and velocity are untouched, it
// runs only while `isAutopilotDriving()` in the movie lane, and manual play
// cannot reach it. ST-0 acquiring a forced look would be ST-0 acquiring a cue,
// and the no-cue law is absolute — so the player is never steered, only the
// film crew's own camera operator is.
const ST0_GAZE_WEIGHT = 0.35;
const ST0_GAZE_MIN_SECONDS = 1.5;
/**
 * A glance, not a stare — but long enough to actually arrive.
 *
 * At weight 0.35 the shipped look-rate clamp (`pull * 3 * dt` in
 * CameraControls) is an exponential approach with a ~0.95 s time constant, so
 * the first second of any glance is spent in transit and photographs the way
 * there rather than the thing. A 3 s window therefore spent a third of itself
 * off-target and could not meet the ruling's own crossing-frame acceptance.
 * 4.5 s is still well short of the walk and still reads as a look away and
 * back; the ruling's floors — 1.5 s minimum, 0.5 s release, 10 s cooldown —
 * are untouched.
 */
const ST0_GAZE_MAX_SECONDS = 4.5;
const ST0_GAZE_RELEASE_SECONDS = 0.5;
const ST0_GAZE_COOLDOWN_SECONDS = 10;
const ST0_GAZE_PITCH_CAP_RADIANS = (25 * Math.PI) / 180;
/**
 * The aim point is a PROXY on the ST-0 ray a few metres out, not a far point in
 * the sky, and that is load-bearing rather than cosmetic.
 *
 * `solveSurfaceGaze` only lets the true subject own pitch when the subject is
 * on the viewer's own cube face AND within `inspectRange` tangentially;
 * otherwise it keeps the eyes on the travel bearing with a small seeded scan
 * and clamps pitch to +15°. A goal 240 m along the ray has ~217 m of tangential
 * range, so the glance yawed toward ST-0's azimuth and then never pitched up at
 * all — the state machine engaged (D-A3's 7/432 samples) while the dot stayed
 * out of frame. Ten metres puts the proxy inside the direct band on the
 * viewer's own face, so the solver aims at the true elevation, and the +25° cap
 * below is enforced on the ray BEFORE the proxy is built rather than left to
 * the solver's travel clamp.
 */
const ST0_GAZE_REACH = 10;
/*
  GOAL-CRITICAL MEANS ARRIVING, NOT "WALKING NEAR THE GOAL".

  Both demands were a flat 10 m, and the instrumented run measured the
  consequence: 346 of 419 walked frames were goal-critical, i.e. the glance was
  suppressed for 83% of the only window it is allowed to exist in. That is not a
  tuning nicety — the Kestrel is parked AT the hearth in this chapter, so the
  contract's nominated walk is a few seconds long and never leaves a 10 m
  radius, which made the demand permanent and the bias unreachable even on a
  night when ST-0 is up.

  The demands are now the distances at which the acts actually commit, which is
  what the ruling's words mean: the eyes come down for the act, not for the
  approach. Below these the walk is arriving and the glance releases inside its
  half-second; above them it is travelling and may look up.
*/
const CH10_CORE_COMMIT_DISTANCE = 2;
const CH10_FABRICATOR_COMMIT_DISTANCE = 6;

let st0GazeStartedAt = -Infinity;
let st0GazeEndedAt = -Infinity;
let st0GazeActive = false;
let st0GazeRestoreWeight = 1;
/**
 * Read-only instrumentation for the ST-0 glance. Published on `window` so a
 * probe can measure the predicate instead of arguing about it; no runtime path
 * reads it back, and it costs a handful of field writes per walked frame.
 */
const st0GazeDiag = {
  frames: 0,
  framesMovie: 0,
  framesDriving: 0,
  framesAvailable: 0,
  framesGoalCritical: 0,
  framesAllConjunctsTrue: 0,
  framesEngaged: 0,
  engagements: 0,
  movie: false,
  driving: false,
  aboveHorizon: false,
  haveDirection: false,
  goalCritical: false,
  engaged: false,
  blockedBy: null as string | null,
  beat: null as StoryBeat | null,
  beatClock: 0,
  cooldownRemaining: 0,
  aimPitchDeg: 0
};

/** The probe seam. Returns a copy so a sample cannot be mutated after the fact. */
export function getSt0GazeDiag(): Readonly<typeof st0GazeDiag> {
  return { ...st0GazeDiag };
}

/**
 * Published on `window` as well as exported, and that redundancy is deliberate:
 * a probe that reaches the diagnostic through its own dynamic import cannot
 * prove it is reading the SAME module instance the game is writing, and "the
 * counters are all zero" then has two explanations. A window global has exactly
 * one. Written from inside the tick, so its presence is itself evidence the
 * autopilot is running.
 */
function publishSt0GazeDiag(): void {
  if (typeof window === 'undefined') return;
  (window as unknown as { __st0Gaze?: object }).__st0Gaze = st0GazeDiag;
}

const _st0GazeGoal = new THREE.Vector3();
const _st0GazeAim = new THREE.Vector3();
const _st0GazeTangent = new THREE.Vector3();

function resetSt0GazeBias(): void {
  if (st0GazeActive) setCinematicLookWeight(st0GazeRestoreWeight);
  st0GazeActive = false;
  st0GazeStartedAt = -Infinity;
  st0GazeEndedAt = -Infinity;
}

/**
 * Returns true when the pilot is currently glancing at ST-0, in which case the
 * caller must NOT issue its own look this frame. `goalCritical` is the caller's
 * statement that the shot needs its eyes on the goal right now — arriving,
 * acting, or anything the beat is about; a demand disengages within half a
 * second and starts the cooldown.
 */
function tickSt0GazeBias(player: THREE.Vector3, goalCritical: boolean): boolean {
  // EVERY CONJUNCT, MEASURED SEPARATELY, EVERY FRAME.
  //
  // G-1: the solver repair was proven correct in isolation and the crossing
  // strip did not move at all. That is the exact failure shape this run has
  // been bitten by repeatedly — a state machine that is right in a unit test
  // and never reached on the live path — so the engage predicate is no longer
  // something to reason about. It is published, conjunct by conjunct, with the
  // frame counters needed to tell "never engaged" apart from "engaged, sampled
  // elsewhere". Diagnostic only: nothing reads it back.
  const driving = isAutopilotDriving();
  const aboveHorizon = st0GazeHandle.aboveHorizon;
  const haveDirection = st0GazeHandle.direction !== null;
  st0GazeDiag.frames++;
  publishSt0GazeDiag();
  st0GazeDiag.movie = MOVIE;
  st0GazeDiag.driving = driving;
  st0GazeDiag.aboveHorizon = aboveHorizon;
  st0GazeDiag.haveDirection = haveDirection;
  st0GazeDiag.goalCritical = goalCritical;
  st0GazeDiag.beat = getStoryStateSnapshot().beat;
  st0GazeDiag.beatClock = Math.round(beatClock * 100) / 100;
  st0GazeDiag.cooldownRemaining = Math.max(
    0,
    Math.round((ST0_GAZE_COOLDOWN_SECONDS - (beatClock - st0GazeEndedAt)) * 100) / 100
  );
  if (MOVIE) st0GazeDiag.framesMovie++;
  if (driving) st0GazeDiag.framesDriving++;
  if (aboveHorizon && haveDirection) st0GazeDiag.framesAvailable++;
  if (goalCritical) st0GazeDiag.framesGoalCritical++;
  if (MOVIE && driving && aboveHorizon && haveDirection && !goalCritical) {
    st0GazeDiag.framesAllConjunctsTrue++;
  }

  if (!MOVIE || !driving) {
    resetSt0GazeBias();
    st0GazeDiag.engaged = false;
    st0GazeDiag.blockedBy = !MOVIE ? 'not-movie-lane' : 'autopilot-not-driving';
    return false;
  }
  const up = getPlayerUp();
  const available = aboveHorizon && haveDirection;
  const held = beatClock - st0GazeStartedAt;

  if (st0GazeActive) {
    // A goal-critical demand releases the glance, but never mid-flick: the
    // minimum dwell is what makes it read as looking rather than twitching.
    const mustRelease = goalCritical || !available;
    if (mustRelease && held >= ST0_GAZE_RELEASE_SECONDS) {
      st0GazeActive = false;
      st0GazeEndedAt = beatClock;
      // Hand the walk's own look authority straight back, at exactly the
      // strength it had before the glance borrowed it.
      setCinematicLookWeight(st0GazeRestoreWeight);
      st0GazeDiag.engaged = false;
      st0GazeDiag.blockedBy = goalCritical ? 'released-goal-critical' : 'released-st0-set';
      return false;
    }
    // The ruling's floor is 1.5s and it is enforced here rather than assumed:
    // retuning the glance length down can never take it below a look.
    if (!mustRelease && held >= Math.max(ST0_GAZE_MIN_SECONDS, ST0_GAZE_MAX_SECONDS)) {
      st0GazeActive = false;
      st0GazeEndedAt = beatClock;
      setCinematicLookWeight(st0GazeRestoreWeight);
      st0GazeDiag.engaged = false;
      st0GazeDiag.blockedBy = 'glance-complete';
      return false;
    }
  } else {
    if (goalCritical || !available) {
      st0GazeDiag.engaged = false;
      st0GazeDiag.blockedBy = goalCritical ? 'goal-critical-look-demand' : 'st0-below-horizon';
      return false;
    }
    if (beatClock - st0GazeEndedAt < ST0_GAZE_COOLDOWN_SECONDS) {
      st0GazeDiag.engaged = false;
      st0GazeDiag.blockedBy = 'cooldown';
      return false;
    }
    st0GazeActive = true;
    st0GazeStartedAt = beatClock;
    st0GazeRestoreWeight = getCinematicLookWeight();
    st0GazeDiag.engagements++;
  }

  const direction = st0GazeHandle.direction;
  if (!direction) {
    resetSt0GazeBias();
    return false;
  }
  // Pitch cap: look UP toward the dot, but never crane past +25 degrees, so the
  // walk keeps its footing in frame and the horizon never leaves the shot. The
  // capped ray is REBUILT from its own tangent at exactly the cap angle;
  // clipping the up-component and re-normalizing (the earlier spelling) lands
  // above the cap, because normalizing grows the tangent back and the elevation
  // with it — measurably +25.4 degrees rather than +25.
  _st0GazeAim.copy(direction).normalize();
  const rise = THREE.MathUtils.clamp(_st0GazeAim.dot(up), -1, 1);
  if (Math.asin(rise) > ST0_GAZE_PITCH_CAP_RADIANS) {
    _st0GazeTangent.copy(_st0GazeAim).addScaledVector(up, -rise);
    if (_st0GazeTangent.lengthSq() < 1e-8) return false;
    _st0GazeTangent.normalize();
    _st0GazeAim
      .copy(_st0GazeTangent)
      .multiplyScalar(Math.cos(ST0_GAZE_PITCH_CAP_RADIANS))
      .addScaledVector(up, Math.sin(ST0_GAZE_PITCH_CAP_RADIANS))
      .normalize();
  }
  _st0GazeGoal.copy(player).addScaledVector(_st0GazeAim, ST0_GAZE_REACH);
  setCinematicLookWeight(ST0_GAZE_WEIGHT);
  // `inspect`, not `travel`: travel's +15° pitch ceiling sits below the ruling's
  // own +25° cap and would silently overrule it. Inspect's ±30° band contains
  // the cap, so the cap enforced on the ray above is the only one that binds,
  // and inspect's smaller scan keeps the glance human rather than mechanical.
  // Route direction is the aim itself — the eyes move, the walk does not.
  lookNaturallyToward(_st0GazeGoal, player, 0, _st0GazeGoal, 'inspect');
  st0GazeDiag.engaged = true;
  st0GazeDiag.blockedBy = null;
  st0GazeDiag.framesEngaged++;
  st0GazeDiag.aimPitchDeg = Math.round(
    (Math.asin(THREE.MathUtils.clamp(_st0GazeAim.dot(up), -1, 1)) * 180 / Math.PI) * 100
  ) / 100;
  return true;
}

let clockBeat: StoryBeat | null = null;
let beatClock = 0;
let interactPulseAt = 0;

// --- Screening cadence ---------------------------------------------------------------
//
// A rail that satisfies every gate the instant it is reachable does not read as
// someone playing; it reads as a script being executed. Several stretches —
// the gather chain, the audit, the ch10 rungs — commit two or three acts inside
// a second, and the screening blinks through them before a viewer can register
// that anything happened.
//
// So committed acts are spaced, and the pilot holds still briefly afterwards,
// the way a person pauses on the thing they just did. The dwell is deliberately
// short: this is a watchability fix, not a slow-motion mode, and a viewer who
// already understood the beat should never be waiting on it.
//
// The clock is the screening's own elapsed time, NOT `beatClock`, so the cadence
// survives a beat change — otherwise the first act of a new beat always fires
// on the same frame as the last act of the old one, which is exactly the seam
// that reads worst.
let screeningClock = 0;
let lastScreeningActionAt = -10;

/** Minimum spacing between two committed acts. */
const SCREENING_ACTION_DWELL_SECONDS = 0.85;
/** Stillness after an act, so the frame can register what just happened. */
const SCREENING_SETTLE_SECONDS = 0.4;

/** True when enough has elapsed since the last committed act to perform another. */
function screeningActionReady(): boolean {
  return screeningClock - lastScreeningActionAt >= SCREENING_ACTION_DWELL_SECONDS;
}

/** Record a committed act; starts both the dwell and the settle. */
function noteScreeningAction(): void {
  lastScreeningActionAt = screeningClock;
}

/** True during the brief hold immediately after an act. */
function screeningSettling(): boolean {
  return screeningClock - lastScreeningActionAt < SCREENING_SETTLE_SECONDS;
}

// --- Screening wait state ------------------------------------------------------------
//
// The screening spends real time waiting on conditions it cannot hurry: a day
// phase, a settle, a hold, a cutscene playing itself out. On screen that is
// indistinguishable from a hang, and a viewer who thinks the movie has broken
// stops watching. This publishes what the rail is waiting FOR, so the overlay
// can say so — and so a debugging viewer can see which gate is holding.
export interface ScreeningWaitState {
  /** True once the pilot has been asserting nothing for long enough to notice. */
  waiting: boolean;
  seconds: number;
  beat: StoryBeat | null;
  /** Short human phrase naming the gate, when one is known. */
  reason: string | null;
}

/** Below this, a pause is just the cadence doing its job — not a wait. */
const SCREENING_WAIT_NOTICE_SECONDS = 2.5;

let waitingSince = -1;

/** Legacy per-beat rail facts, read by the beat contracts until Batch 5 moves the rails. */
export function autopilotBeatTimeout(beat: StoryBeat): number | null {
  return BEAT_DEFINITIONS[beat]?.rail.stuckAfterSeconds ?? null;
}
export function autopilotWaitReason(beat: StoryBeat): string | null {
  return BEAT_DEFINITIONS[beat]?.rail.waitReason ?? null;
}

// --- Rail backstops --------------------------------------------------------------------
//
// Every place the screening grants an item, seeds a milestone or advances a
// beat on the player's behalf is a BACKSTOP: it keeps a movie run green while
// the rail underneath it may be broken (the 2026-09-04 `FIBER 4/6` softlock hid
// behind exactly this). Batch 5 of PARAVOXIA_STORY_PIPELINE_REFACTOR_PLAN.md
// deletes them; this log is the evidence for which ones ever fire. Read it
// from `window.__railBackstops` — the seam probe prints it after a full run.

export interface RailBackstopEvent {
  beat: StoryBeat | null;
  kind: string;
  /** Seconds into the beat when the backstop fired. */
  beatSeconds: number;
  /** Seconds into the screening. */
  screeningSeconds: number;
}

const railBackstops: RailBackstopEvent[] = [];

const railStuckEvents: RailBackstopEvent[] = [];
function reportRailStuck(kind: string): void {
  const story = getStoryStateSnapshot();
  const event: RailBackstopEvent = {
    beat: story.active ? story.beat : null,
    kind,
    beatSeconds: Math.round(beatClock * 10) / 10,
    screeningSeconds: Math.round(screeningClock * 10) / 10
  };
  if (railStuckEvents.some(previous => previous.beat === event.beat)) return;
  railStuckEvents.push(event);
  if (typeof window !== 'undefined') {
    (window as unknown as { __railStuck?: RailBackstopEvent[] }).__railStuck = railStuckEvents;
  }
  console.error(`[autopilot] rail-stuck: ${event.beat} @${event.beatSeconds}s — ${kind}`);
}

export function getRailBackstops(): readonly RailBackstopEvent[] {
  return railBackstops;
}

function tickScreeningWaitState(moving: boolean): void {
  if (moving) {
    waitingSince = -1;
    return;
  }
  waitingSince = waitingSince < 0 ? screeningClock : waitingSince;
}

export function getScreeningWaitState(): ScreeningWaitState {
  const story = getStoryStateSnapshot();
  const beat = story.active ? story.beat : null;
  const seconds = waitingSince < 0 ? 0 : screeningClock - waitingSince;
  const bridging = movieDoneBridgeActive();
  return {
    waiting: seconds >= SCREENING_WAIT_NOTICE_SECONDS || bridging || railStuckEvents.some(event => event.beat === beat),
    seconds: Math.round(seconds * 10) / 10,
    beat,
    reason: railStuckEvents.some(event => event.beat === beat)
      ? 'SCREENING CANNOT REACH THE OBJECTIVE'
      : bridging
      ? 'NIGHT FALLING OVER THE SETTLEMENT'
      : movieStationBridgeActive()
        ? 'APPROACHING THE STATION'
        : (beat ? autopilotWaitReason(beat) : null)
  };
}

export function getScreeningCadenceDiag(): {
  clock: number;
  sinceAction: number;
  settling: boolean;
} {
  return {
    clock: Math.round(screeningClock * 10) / 10,
    sinceAction: Math.round((screeningClock - lastScreeningActionAt) * 10) / 10,
    settling: screeningSettling()
  };
}
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

/**
 * Beat seconds between retries of a cached UNREACHABLE plan while the walker is
 * frozen by it. Long enough that a genuinely impossible goal costs one bounded
 * A* every few seconds rather than one per frame; short enough that a body that
 * only just settled, or terrain that only just streamed in, is seen promptly.
 */
const UNREACHABLE_REPLAN_SECONDS = 4;

/**
 * At least one second between the ch10 egress face opening and the autopilot's
 * first step, so no captured strip frame can straddle the change.
 */
const CH10_EGRESS_HOLD_SECONDS = 1;

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
let unstickUntil = -1;
let unstickFlips = 0;
/** True on ticks where walkToward set a live goal (enables the nudge escalation). */
let walkTargetLive = false;
const _stillDelta = new THREE.Vector3();

export type NavigationAction = 'idle' | 'walk' | 'jetpack' | 'direct' | 'unreachable';

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
  /** Terminal exact-goal decision for THIS plan; resolved lazily. */
  exactGoalHandoff: TerminalGoalHandoff | null;
  /** The EXACT goal `exactGoalHandoff` certified. A moved target re-decides. */
  exactGoalHandoffFor: THREE.Vector3 | null;
}

let activeNavigationRoute: ActiveNavigationRoute | null = null;
let navigationAction: NavigationAction = 'idle';
let navigationReason = 'not-planned';
let plannedJetpackReleaseUntil = -1;
let plannedJetpackWasActive = false;
let plannedJetpackWasWetStartEgress = false;
const _navigationWaypoint = new THREE.Vector3();
const _navigationDirection = new THREE.Vector3();
/** Tangential centre->exact-goal offset inside one certified terminal cell. */
const _exactGoalOffset = new THREE.Vector3();
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

/** A rise this walker climbs with ordinary step assist, so it is already "here". */
export const GAIT_STEP_UP = 1.0;
/**
 * A drop this walker simply steps down. Deliberately the SAME bound the
 * waypoint consumer below uses for "an extreme perch is off-route, not
 * arrived" — the two measures must agree about what counts as underfoot.
 */
export const GAIT_STEP_DOWN = 3.4;

/**
 * Gait distance to a goal, measured in the walker's own gravity frame:
 * TANGENTIAL range, plus any rise it has not yet climbed, plus any drop it
 * cannot simply step down.
 *
 * Pure 3D distance strands the pilot "close" to elevated goals (it stops
 * walking at the foot of the rise); pure tangential range releases it directly
 * under — or, worse, directly OVER — them. Both vertical terms are load-bearing.
 *
 * The rise term alone is what shipped, and it hid an owner-reported defect: a
 * habitat core buried 45.8 units straight down measured 6.8 and satisfied every
 * arrival gate in chapter 10, while the player-facing interaction prompt —
 * euclidean, and correct — refused to appear at all. A goal below the floor is
 * as unreached as a goal above the ceiling, and this now says so.
 */
export function surfaceGaitDistance(
  target: THREE.Vector3,
  player: THREE.Vector3,
  up: THREE.Vector3,
  scratch: THREE.Vector3 = new THREE.Vector3()
): number {
  scratch.copy(target).sub(player);
  const vertical = scratch.dot(up);
  scratch.addScaledVector(up, -vertical);
  return scratch.length()
    + Math.max(0, vertical - GAIT_STEP_UP)
    + Math.max(0, -vertical - GAIT_STEP_DOWN);
}

function gaitDistance(target: THREE.Vector3, player: THREE.Vector3): number {
  if (surfaceFaceFromUp(getPlayerUp()) !== dominantFaceForPosition(target)) {
    return player.distanceTo(target);
  }
  return surfaceGaitDistance(target, player, getPlayerUp(), _toGoal);
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
 * The two world axes that span a face's tangent plane.
 *
 * `agentSurfaceNavigation.worldToGrid` quantizes x/y/z and then projects onto
 * that face's `tangentU`/`tangentV`, so a navigation cell is identified by TWO
 * indices, not three. The surface-normal axis is deliberately not part of it.
 */
function tangentAxes(up: THREE.Vector3): readonly THREE.Vector3[] {
  const axes = [
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 0, 1)
  ];
  return axes.filter(axis => Math.abs(axis.dot(up)) < 0.5);
}

/**
 * Cell centres whose column must ALSO be certified before the body may stand at
 * `point` instead of the cell centre.
 *
 * `cellAt` certifies one column and its normal clearance — it does not certify
 * every off-centre capsule footprint inside that cell. With `VOXEL_SCALE` 2 the
 * half extent is 1.0 and the capsule radius is 0.5, so any tangential offset
 * beyond 0.5 pushes part of the body into a neighbouring column. Those columns
 * are returned here and are probed through the real planner, so a goal beside a
 * wall, a hole, water or lava is refused on the actual terrain rather than by a
 * guessed offset limit.
 */
export function exactGoalFootprintColumns(
  terminal: THREE.Vector3,
  goal: THREE.Vector3,
  up: THREE.Vector3
): THREE.Vector3[] {
  const tangential = goal.clone().sub(terminal);
  tangential.addScaledVector(up, -tangential.dot(up));
  const reach = VOXEL_SCALE / 2 - PLAYER_CAPSULE_RADIUS;
  const overlapped: THREE.Vector3[] = [];
  for (const axis of tangentAxes(up)) {
    const component = tangential.dot(axis);
    if (Math.abs(component) <= reach) continue;
    overlapped.push(axis.clone().multiplyScalar(Math.sign(component) * VOXEL_SCALE));
  }
  const columns = overlapped.map(offset => terminal.clone().add(offset));
  // Both axes overlapping also puts the capsule over the diagonal column.
  if (overlapped.length === 2) {
    columns.push(terminal.clone().add(overlapped[0]!).add(overlapped[1]!));
  }
  return columns;
}

/** Why a terminal exact-goal handoff was refused. `null` means it was taken. */
export type TerminalGoalHandoffRefusal =
  | 'not-terminal-waypoint'
  | 'goal-substituted-for-safety'
  | 'goal-outside-terminal-cell'
  | 'footprint-not-certified'
  | 'footprint-height-mismatch'
  | 'water-leg'
  | 'cross-face-goal';

export interface TerminalGoalHandoff {
  readonly handoff: boolean;
  readonly refusal: TerminalGoalHandoffRefusal | null;
}

/**
 * May the EXACT requested goal own the last leg, instead of the snapped cell?
 *
 * Every A* waypoint is `voxelCoordToWorld(cell.support)` — a cell CENTRE — and
 * the terminal one is never consumed, so it stays the steering target forever.
 * `steerFreeToward` then releases all four controls inside tangent radius
 * `NAVIGATION_STEER_DEAD_ZONE`, while `walkToward` only arrives on the distance
 * to the goal the caller actually asked for. With `VOXEL_SCALE` 2 a goal may sit
 * up to one unit off its own cell centre, so the closest the body can come while
 * steering is still live is `offset - 0.2`. Chapter 13 aims 0.6 THROUGH each
 * route corner (`CG_RAIL_CORNER_OVERSHOOT`, which is what keeps arc credit at or
 * under real displacement) and stops at 0.35: 0.6 - 0.2 = 0.4 > 0.35, so the
 * arrival predicate was not merely unlucky, it was unsatisfiable. The body
 * parked, every control false — which is also why the stuck watchdog never
 * armed, since it only counts stillness while the pilot is PUSHING.
 *
 * The repair is deliberately the smallest one that exists: the exact goal must
 * lie in the very cell A* terminated on, that cell must be the goal's OWN cell
 * rather than a safe substitute, and every further column the capsule actually
 * overlaps there must be certified by the SAME planner. Steering to it is then
 * ordinary walking inside a region the navigator has itself cleared — no radius
 * is widened, no dead zone is weakened, no cell is skipped, and a goal the
 * planner had to substitute for safety (water, hazard, no clearance) keeps the
 * safe cell exactly as before.
 *
 * TWO DELIBERATE ASYMMETRIES, both matching the planner's own contract:
 *
 * - Only the TANGENT axes are compared. `worldToGrid` projects onto the face's
 *   `tangentU`/`tangentV`; the surface-normal index is not part of cell identity
 *   and cannot be compared meaningfully anyway, because an authored foot goal
 *   (51.05), a grounded pose (50.989) and a waypoint carrying
 *   `PLAYER_CENTER_CLEARANCE` (52.85) are three legitimate conventions for the
 *   same place. `applyTerminalExactGoal` discards the normal component outright
 *   and keeps the height the planner cleared, so nothing is decided by it.
 * - The footprint is certified against real terrain rather than capped by a
 *   small offset limit, so a signed 0.6 corner overshoot stays reachable
 *   wherever the ground is genuinely safe.
 */
export function terminalExactGoalHandoff(input: {
  route: Pick<
    AgentSurfaceRoute,
    'mode' | 'reason' | 'waypoints' | 'requestedGoalWasWet' | 'waterCrossing'
  >;
  cursor: number;
  goal: THREE.Vector3;
  action: NavigationAction;
  face: CubeFace;
  goalFace: CubeFace;
  up: THREE.Vector3;
  crossFaceLegActive: boolean;
  /**
   * Real planner ownership probe for one column; see `exactGoalFootprintColumns`.
   * Returns the SURFACE the planner resolved there, or null if it owns none.
   * The point is returned rather than a boolean because dryness alone is not
   * safety: a wall top and a pit floor are both dry.
   */
  certifyColumn: (point: THREE.Vector3) => THREE.Vector3 | null;
}): TerminalGoalHandoff {
  const { route, cursor, goal } = input;
  const refuse = (refusal: TerminalGoalHandoffRefusal): TerminalGoalHandoff =>
    ({ handoff: false, refusal });
  const terminal = route.waypoints[route.waypoints.length - 1];
  if (!terminal || cursor !== route.waypoints.length - 1) {
    return refuse('not-terminal-waypoint');
  }
  // A cross-face trip is owned by the edge machinery above; the goal is not on
  // the face this body is standing on and its cell index is not comparable.
  if (input.crossFaceLegActive || input.face !== input.goalFace) {
    return refuse('cross-face-goal');
  }
  // Jetpack legs and water crossings keep the planner's cleared waypoint.
  if (input.action === 'jetpack' || route.waterCrossing !== null) {
    return refuse('water-leg');
  }
  // A goal the planner REPLACED is not inside the region it resolved. Keeping
  // the safe approach cell is the whole protection for wet, hazardous and
  // unclearable goals, and it stays.
  if (
    route.requestedGoalWasWet
    || (route.reason !== 'dry-surface-path' && route.reason !== 'already-at-resolved-goal')
  ) {
    return refuse('goal-substituted-for-safety');
  }
  // The goal must fall inside the terminal cell's own tangential footprint.
  // Waypoints are exact multiples of VOXEL_SCALE, so a half-extent bound on each
  // tangent axis is precisely `worldToGrid` index equality on that axis.
  const tangential = goal.clone().sub(terminal);
  tangential.addScaledVector(input.up, -tangential.dot(input.up));
  for (const axis of tangentAxes(input.up)) {
    if (Math.abs(tangential.dot(axis)) > VOXEL_SCALE / 2) {
      return refuse('goal-outside-terminal-cell');
    }
  }
  // And the body's actual footprint there must stand on certified ground AT THE
  // SAME SURFACE. A self-route resolves to whatever dry column it finds, and a
  // raised wall top or a lowered pit floor is perfectly dry — standing
  // off-centre over either is exactly the unsafe final approach this guard
  // exists to prevent, so the resolved height is compared too. The bound is
  // half a cell: the same surface layer, not a step up or a drop.
  for (const column of exactGoalFootprintColumns(terminal, goal, input.up)) {
    const resolved = input.certifyColumn(column);
    if (!resolved) return refuse('footprint-not-certified');
    const rise = resolved.clone().sub(terminal).dot(input.up);
    if (Math.abs(rise) > VOXEL_SCALE / 2) return refuse('footprint-height-mismatch');
  }
  return { handoff: true, refusal: null };
}

/**
 * Move a terminal waypoint onto the exact goal WITHIN its own cell.
 *
 * Tangential component only: the planner owns the surface height it cleared, so
 * the body keeps that clearance and simply finishes the walk. With no handoff
 * the snapped waypoint is returned untouched.
 */
export function applyTerminalExactGoal(
  waypoint: THREE.Vector3,
  goal: THREE.Vector3,
  up: THREE.Vector3,
  handoff: boolean
): THREE.Vector3 {
  if (!handoff) return waypoint;
  _exactGoalOffset.copy(goal).sub(waypoint);
  _exactGoalOffset.addScaledVector(up, -_exactGoalOffset.dot(up));
  return waypoint.add(_exactGoalOffset);
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
  // STATIONARY UNREACHABLE DEADLOCK. `shouldReplanUnreachableRoute` only fires
  // once the body has MOVED (or gained support) since the rejected plan — but an
  // unreachable step stops the walker dead (`walkToward` clears every control),
  // so nothing ever moves and the cached rejection is never revisited. A run
  // that lands on a face the planner momentarily refuses therefore stands still
  // for the rest of the session (2026-09-09 ch10-ask: 660s at one position with
  // `routeAction: unreachable`). Retry the SAME planner on a bounded cadence so
  // late terrain hydration, a settled body or a moved handle can be seen. This
  // relaxes no tolerance and grants nothing: an honestly unreachable goal simply
  // stays unreachable and the beat still reports itself stuck.
  const unreachableRetryDue = !!cached
    && cached.route.mode === 'unreachable'
    && beatClock - cached.plannedAt >= UNREACHABLE_REPLAN_SECONDS;
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
    || unreachableRetryDue
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
      plannedSurfaceContact: { ...currentSurfaceContact },
      exactGoalHandoff: null,
      exactGoalHandoffFor: null
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
  // authoritative; route replanning owns any larger displacement. Like
  // gaitDistance, consumption is measured in the surface tangent plane: raw 3D
  // distance never consumes a waypoint the body stands directly ABOVE (e.g. the
  // ch1-anomaly start on the signal-mesa summit, whose ground route begins at
  // its base), which leaves steerFreeToward's horizontal dead zone with no
  // intent at all — a frozen actor. A cell below the feet within a bounded,
  // survivable drop is passed; a cell still to be CLIMBED stays live.
  while (active.cursor < active.route.waypoints.length - 1) {
    const candidate = active.route.waypoints[active.cursor];
    if (!candidate) break;
    _navigationDirection.copy(candidate).sub(player);
    const up = getPlayerUp();
    const vertical = _navigationDirection.dot(up); // + above the player, - below
    _navigationDirection.addScaledVector(up, -vertical);
    if (_navigationDirection.lengthSq() > 1.35 * 1.35) break;
    if (vertical > 1.0) break; // an un-climbed rise is not yet consumed
    if (vertical < -3.4) break; // an extreme perch is off-route, not "arrived"
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
  // Sub-cell precision INSIDE the planner's own terminal cell. See
  // `terminalExactGoalHandoff`: the A* waypoint is a snapped cell centre, and a
  // goal that sits off-centre within that same certified cell is otherwise
  // unreachable by construction.
  //
  // Decided once per (plan, exact goal). The route cache tolerates a goal that
  // drifts by up to one unit before it replans, so binding this decision to the
  // plan alone would let a certification taken for the OLD target authorise a
  // moved one. It is therefore keyed on the exact goal as well — the probes
  // below re-run only when the target actually changes, never per frame, and no
  // full A* is forced by that recheck.
  if (active.exactGoalHandoff === null
    || !active.exactGoalHandoffFor
    || !active.exactGoalHandoffFor.equals(goal)) {
    active.exactGoalHandoffFor = goal.clone();
    active.exactGoalHandoff = terminalExactGoalHandoff({
      route: active.route,
      cursor: active.route.waypoints.length - 1,
      goal,
      action: navigationAction,
      face,
      goalFace,
      up: getPlayerUp(),
      crossFaceLegActive: !!active.crossFaceLeg,
      // The planner's own idiom: a self-route is an exact ownership probe that
      // exercises the same clearance, slope, edge-margin, water and hazard rules
      // runtime A* uses. Nothing here relaxes a tolerance.
      certifyColumn: column => {
        const probe = planAgentSurfaceRoute(terrain, planetSize, column, column, {
          face,
          differentFaceFallback: 'unreachable',
          allowJetpackCrossing: false,
          maxVisitedCells: 1
        });
        if (probe.mode === 'unreachable' || probe.requestedGoalWasWet) return null;
        return probe.resolvedGoal;
      }
    });
  }
  const handoff = active.cursor === active.route.waypoints.length - 1
    ? active.exactGoalHandoff
    : { handoff: false, refusal: 'not-terminal-waypoint' as const };
  applyTerminalExactGoal(
    _navigationWaypoint.copy(waypoint),
    goal,
    getPlayerUp(),
    handoff.handoff
  );
  return {
    waypoint: _navigationWaypoint,
    action: navigationAction,
    route: active.route,
    preserveForward: false
  };
}

/**
 * Tangential radius inside which the walker stops issuing directional input.
 *
 * UNCHANGED VALUE (0.2, i.e. the historical `lengthSq < 0.04`). It is named only
 * so the arrival arithmetic can be stated and tested: every shipped stop radius
 * is at least 0.3, so a body steered at the goal it was actually given can
 * always close the gap, while a body steered at a snapped cell centre 0.6 away
 * provably cannot. Weakening this radius would be a safety change and is
 * deliberately NOT the repair.
 */
export const NAVIGATION_STEER_DEAD_ZONE = 0.2;

/** Map a world route segment onto the player's current surface camera frame.
 * Movement therefore follows the path even while the eyes make a small human
 * scan around it. */
function steerFreeToward(player: THREE.Vector3, waypoint: THREE.Vector3): void {
  const up = getPlayerUp();
  _navigationDirection.copy(waypoint).sub(player)
    .addScaledVector(up, -_navigationDirection.dot(up));
  if (_navigationDirection.lengthSq() < NAVIGATION_STEER_DEAD_ZONE * NAVIGATION_STEER_DEAD_ZONE) {
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
  // Post-act stillness. The gaze above still holds the subject — only the feet
  // wait — so the shot stays on the thing that just happened instead of
  // whipping away from it on the same frame.
  if (screeningSettling()) {
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
function holdAt(target: THREE.Vector3, lookLift = LOOK_LIFT, mode?: CinematicGazeMode): void {
  const player = getPlayerWorldPosition();
  lookNaturallyToward(target, player, lookLift, target, mode);
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
let treeApproach: THREE.Vector3 | null = null;
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
    if (getItemCount(id) > 0 && autopilotWorldAccess.consume(id)) return true;
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
  if (beatClock - interactPulseAt > 1 && screeningActionReady()) {
    interactPulseAt = beatClock;
    noteScreeningAction();
  }
}

/**
 * Movie mode resolves the same registered interaction as [F], but without
 * relying on a browser key repeat. Proximity and every transaction's own proof
 * checks remain authoritative.
 */
function performStoryInteraction(expectedId?: string): boolean {
  if (beatClock - emergentInteractionAt < 0.65) return false;
  // The shared cadence spaces acts across beats as well as within one.
  if (!screeningActionReady()) return false;
  const interaction = resolveStoryInteraction(null, getPlayerWorldPosition());
  if (!interaction || (expectedId && interaction.id !== expectedId)) return false;
  emergentInteractionAt = beatClock;
  noteScreeningAction();
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

/** Ticked by StoryDirectorDriver every frame while in movie mode. */

// --- The screening's `done` bridge ---------------------------------------------------
//
// Chapter 10 is a RE-ACTIVATION out of `done`, not a continuation: `ch9-hearth`
// hands the world back with `active: false, beat: 'done'`, and the fault is
// NOTICED rather than announced — the player has to be home, at night, inside
// the hearth's footprint, after a free-play grace. That is the right shape for
// a player and a dead end for a screening: `isAutopilotDriving()` requires
// `story.active`, so at `done` the pilot has no driver at all and simply stands
// where the hearth left them, forever. A full movie run ended at the shelter.
//
// `emergentStoryDirector` already assumed this was solved — its entry comment
// says chapter 10 "is also reachable by ... the movie lane" — but no bridge was
// ever built. This is it. It deliberately drives the pilot to satisfy the REAL
// authored gate rather than jumping the beat, so the screening keeps exercising
// the same entry condition a player does, which is exactly what the movie owes
// its second job as a debugging instrument.
const doneBridge = { phase: -1, active: false };

/**
 * Sky-sweep rate for the ch4 vigil, radians per second. ~5 degrees/s: slow
 * enough to read as someone taking the sky in, fast enough that the reveal's
 * 18-second ramp plus its lead-in lines carries the frame across a wide arc.
 */
const VIGIL_SKY_SWEEP_RAD_PER_SECOND = 0.09;
/** Out/up ratio of the vigil sky framing. atan(7/6) ~ 0.86 rad of pitch. */
const VIGIL_SKY_OUT = 6;
const VIGIL_SKY_UP = 7;

/**
 * Where the vigil's stargaze shot looks, `clock` seconds into the beat.
 *
 * Pure and exported so the two things that matter can be tested rather than
 * asserted in a comment: the framing never drops below the director's look-up
 * gate (or the constellation ramp would never start), and the bearing actually
 * sweeps (or the reveal is a coin flip again).
 */
export function vigilSkyLookTarget(
  player: THREE.Vector3,
  up: THREE.Vector3,
  fire: THREE.Vector3,
  clock: number,
  out: THREE.Vector3
): THREE.Vector3 {
  const horizontal = out.copy(fire).sub(player);
  horizontal.addScaledVector(up, -horizontal.dot(up));
  if (horizontal.lengthSq() < 0.04) horizontal.set(1, 0, 0);
  horizontal.normalize();
  horizontal.applyAxisAngle(up, clock * VIGIL_SKY_SWEEP_RAD_PER_SECOND);
  return out
    .multiplyScalar(VIGIL_SKY_OUT)
    .addScaledVector(up, VIGIL_SKY_UP)
    .add(player);
}

/** Night, comfortably past the ~0.505 sunset edge `isHabitatNight` opens on. */
const MOVIE_BRIDGE_NIGHT_PHASE = 0.62;
/** A whole day in ~25s: a visible dusk-to-night time-lapse, not a snap cut. */
const MOVIE_BRIDGE_PHASE_PER_SECOND = 0.04;

/**
 * True while the screening is standing in `done` with chapter 10 still ahead of
 * it. Part of `isAutopilotDriving()` so the player body accepts the bridge's
 * controls; every other consumer of that predicate treats the bridge exactly
 * like any other driven beat, which is what we want.
 */
// The optional record invitation is an ordinary action after the real ch13
// handback. The screening has to take that action before a ch14 rail can run.
function movieMapBridgeActive(): boolean {
  if (!MOVIE) return false;
  const story = getStoryStateSnapshot();
  if (story.active || story.beat !== 'done') return false;
  const record = getUnfinishedMapSnapshot();
  return record.ready && !record.opened;
}

function movieDoneBridgeActive(): boolean {
  if (!MOVIE) return false;
  const story = getStoryStateSnapshot();
  if (story.active || story.beat !== 'done') return false;
  if (getAppStateSnapshot().phase !== 'playing') return false;
  const actorId = getLocalActorId();
  return hasMilestone(STORY_MILESTONES.ch9Hearth, actorId)
    && !hasMilestone(STORY_MILESTONES.ch10Complete, actorId);
}

export function isMovieDoneBridgeActive(): boolean {
  return movieDoneBridgeActive();
}

/**
 * Phase two of the screening's post-terminal run: chapter 10 is finished, the
 * threshold hand-back has granted `story:station-docking-authorized`, and the
 * station is now a place the player may actually enter. The chapter itself
 * deliberately ends at a 1,500-unit standoff and refuses the invitation — that
 * ending is unchanged. This carries the SCREENING past it, because a movie that
 * stops outside the door of the thing it spent a chapter travelling to is not
 * the movie the owner asked for.
 */
function movieStationBridgeActive(): boolean {
  if (!MOVIE) return false;
  const story = getStoryStateSnapshot();
  if (story.active || story.beat !== 'done') return false;
  if (getAppStateSnapshot().phase !== 'playing') return false;
  const actorId = getLocalActorId();
  // ONCE THE STATION HAS BEEN LEFT, THIS BRIDGE IS DONE. Its predicate is
  // "chapter 10 finished and docking is authorized", both of which stay true
  // forever, so without this it would fly the pilot straight back to the door
  // it just came out of, in a loop, carrying the cell it went in for.
  if (hasMilestone(STATION_RETURN_MILESTONES.stationDeparted, actorId)) return false;
  return hasMilestone(STORY_MILESTONES.ch10Complete, actorId)
    && spaceStationDockingAuthorized();
}

/**
 * Phase three: the trip home with the cell.
 *
 * The station issued a sealed component and the second hearth is on another
 * world. This carries the screening across that gap using the prior contract's
 * OWN transaction — the shipped `story-ch12-install-bonded-cell` interaction at
 * the actual core — and stops the instant that receipt exists. It never installs
 * on the player's behalf, never grants the cell and never marks the receipt.
 */
function movieReturnBridgeActive(): boolean {
  if (!MOVIE) return false;
  const story = getStoryStateSnapshot();
  if (story.active || story.beat !== 'done') return false;
  if (getAppStateSnapshot().phase !== 'playing') return false;
  const actorId = getLocalActorId();
  return hasMilestone(STATION_RETURN_MILESTONES.stationDeparted, actorId)
    && !hasMilestone(STATION_RETURN_MILESTONES.bondedCellInstalled, actorId);
}

export function isMovieReturnBridgeActive(): boolean {
  return movieReturnBridgeActive();
}

/**
 * Fly home and fit the part. Same controls, same gates, same [F].
 *
 * The one thing this must not do is claim the install. `installTidegardenBondedCell`
 * checks the world, the pending receipt, the live core and the reach, and takes
 * the cell out of the pack; the bridge walks the pilot into that reach and
 * presses the button the prompt is already offering.
 */
function tickMovieReturnBridge(): void {
  clearControls();
  const flight = getSpaceFlightSnapshot();
  const system = getSystemFlightSnapshot();
  const home = system.activePlanetId === TIDEGARDEN_WORLD_ID;
  if (flight.controlMode !== 'flight') {
    if (home) {
      const habitat = getHabitatWorldState(TIDEGARDEN_WORLD_ID);
      if (!habitat) return;
      const core = _goalScratch.set(...habitat.core.position);
      if (walkToward(core, 1.6, 0.9) <= STATION_RETURN_INSTALL_REACH) {
        performStoryInteraction('story-ch12-install-bonded-cell');
      }
      return;
    }
    const parked = getShipPosition();
    if (!parked) return;
    const hatch = _goalScratch.set(parked[0], parked[1], parked[2]);
    walkToward(hatch, 2.4, 1.1);
    if (getPlayerWorldPosition().distanceTo(hatch) <= 3.5) enterShip();
    return;
  }
  if (home) {
    if (flight.phase === 'surface') {
      exitShip();
      return;
    }
    // The same descent grammar the ch10 return leg uses: hold the heading the
    // directive supplies and ask to land.
    controls.forward = true;
    controls.interact = true;
    return;
  }
  controls.jump = flight.phase === 'surface';
  controls.forward = flight.phase !== 'surface';
  controls.sprint = false;
}

export function isMovieStationBridgeActive(): boolean {
  return movieStationBridgeActive();
}

/**
 * Close the last of the bearing and commit the dock.
 *
 * Docking is the same procedure a player performs: the approach driver's own
 * contact, its own `canDock`, its own authorization fence. The screening does
 * not teleport into the station and does not bypass a gate — it presses the
 * button. That is what keeps this lane usable as evidence.
 */
function tickMovieStationBridge(): void {
  clearControls();
  const flight = getSpaceFlightSnapshot();
  if (flight.controlMode !== 'flight') {
    const parked = getShipPosition();
    if (!parked) return;
    const hatch = _goalScratch.set(parked[0], parked[1], parked[2]);
    walkToward(hatch, 2.4, 1.1);
    if (getPlayerWorldPosition().distanceTo(hatch) <= 3.5) enterShip();
    return;
  }
  const contact = spaceStationApproachGeometry();
  if (contact?.readout.canDock) {
    // Hold still on the threshold for a breath before committing, so the cut
    // into the station is not the same frame the corridor opens.
    if (screeningActionReady()) {
      noteScreeningAction();
      commitSpaceStationDock();
    }
    return;
  }
  // Fly in. No sprint: the ch10 transit established FOV 70 for this approach
  // and boost would re-open the same undeclared lens move that pass removed.
  const body = chapter10ClaimedStationBody();
  controls.jump = flight.phase === 'surface';
  controls.forward = flight.phase !== 'surface' && body !== null
    && movieStationApproach(body, getSystemFlightSnapshot().pose).forward;
  controls.sprint = false;
}

/** Seconds of forced phase advance so far, for the waiting-state readout. */
export function getMovieDoneBridgePhase(): number | null {
  return doneBridge.active ? doneBridge.phase : null;
}

/**
 * Walk home and let the night come. The pilot heads for the hearth core; the
 * sky is run forward at a visible rate until it is night and then held there,
 * so the wait reads as time passing rather than as a hang. Once both facts are
 * true the authored watch in `tickChapter10FreePlayEntry` opens the chapter on
 * its own — this function never marks a milestone or advances a beat.
 */
function tickMovieDoneBridge(dt: number): void {
  clearControls();
  doneBridge.active = true;
  const habitat = getHabitatWorldState(TIDEGARDEN_WORLD_ID);
  if (!habitat) return;
  if (doneBridge.phase < 0) doneBridge.phase = getCurrentDayPhase();
  const core = _goalScratch.set(...habitat.core.position);
  walkToward(core, 0.5, 0.9);
  // Hold the sky at night once it arrives; before that, run it forward.
  if (!isHabitatNight(doneBridge.phase)) {
    doneBridge.phase = (doneBridge.phase + MOVIE_BRIDGE_PHASE_PER_SECOND * Math.max(0, dt)) % 1;
    setStoryForcedDayPhase(doneBridge.phase);
    return;
  }
  doneBridge.phase = MOVIE_BRIDGE_NIGHT_PHASE;
  setStoryForcedDayPhase(MOVIE_BRIDGE_NIGHT_PHASE);
}

function publishAutopilotDebug(beat: StoryBeat | null): void {
  // Dev affordance (movie only): capture harnesses sample the pilot's state.
  if (typeof window !== 'undefined') {
    const pos = getPlayerWorldPosition();
    (window as unknown as { __autopilot?: object }).__autopilot = {
      beat,
      clock: Math.round(beatClock * 10) / 10,
      backstops: railBackstops.length,
      stuck: railStuckEvents.length,
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
      surfaceContact: getLocalPlayerSurfaceContact(),
      construction: beat === 'ch9-settle' ? getConstructionGatheringSnapshot() : null,
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

}

export function autopilotTick(dt: number): void {
  if (!MOVIE) return;
  // Published before anything else can fail, so a probe can tell "the autopilot
  // never ticked" from "it ticked and never reached a walk phase": the global
  // exists with frames 0 in the second case and is absent in the first.
  publishSt0GazeDiag();
  const story = getStoryStateSnapshot();
  if (story.runId !== teleportNudgeRunId) {
    teleportNudgeRunId = story.runId;
    teleportNudgesTotal = 0;
    screeningClock = 0;
    railStuckEvents.length = 0;
    railBackstops.length = 0;
    lastScreeningActionAt = -10;
    dryCrossFaceWaterContactFramesTotal = 0;
    dryWalkWaterContactFramesTotal = 0;
  }
  const beat = story.active ? story.beat : null;
  if (beat !== clockBeat) {
    clockBeat = beat;
    beatClock = 0;
    interactPulseAt = -10;
    stillTime = 0;
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
    treeApproach = null;
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
  // Post-terminal travel still uses the navigator's timed edge handoffs and
  // action spacing. Its clocks must advance while that bridge owns play.
  if (!beat && isAutopilotDriving()) {
    beatClock += dt;
    screeningClock += dt;
  }
  if (!beat && movieMapBridgeActive()) {
    tickUnfinishedMapRail(railRuntime);
    publishAutopilotDebug(null);
    tickScreeningWaitState(controls.forward || controls.backward || controls.left || controls.right);
    return;
  }
  if (!beat && movieDoneBridgeActive()) {
    tickMovieDoneBridge(dt);
    publishAutopilotDebug(null);
    tickScreeningWaitState(false);
    return;
  }
  if (!beat && movieStationBridgeActive()) {
    tickMovieStationBridge();
    publishAutopilotDebug(null);
    tickScreeningWaitState(controls.forward || controls.jump);
    return;
  }
  if (!beat && movieReturnBridgeActive()) {
    tickMovieReturnBridge();
    publishAutopilotDebug(null);
    tickScreeningWaitState(controls.forward || controls.jump);
    return;
  }
  if (beat) doneBridge.active = false;
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
  screeningClock += dt;
  walkTargetLive = false; // walkToward re-asserts it below when a goal is live
  const timeout = autopilotBeatTimeout(beat) ?? Infinity;
  if (beatClock > timeout) reportRailStuck(`objective incomplete after ${timeout}s; ${navigationReason}`);

  if (getSpaceFlightSnapshot().controlMode === 'flight') {
    // The on-foot body stays parked while the ship moves. Each flight rail owns
    // its controls; ground recovery must neither persist nor infer a stall here.
    clearControls();
    stillTime = 0;
    unstickUntil = -1;
    unstickFlips = 0;
    plannedJetpackReleaseUntil = -1;
    plannedJetpackWasActive = false;
    plannedJetpackWasWetStartEgress = false;
    _lastPos.set(Infinity, Infinity, Infinity);
  }

  (BEAT_RAILS[beat])?.(railRuntime);

  // One place, after the beat switch has decided this frame's controls.
  tickScreeningWaitState(controls.forward || controls.backward
    || controls.left || controls.right || controls.jump);

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

  publishAutopilotDebug(beat);

  // A rail can enter flight this tick. Only the on-foot controller uses the
  // player body's displacement to decide whether ground recovery is needed.
  if (getSpaceFlightSnapshot().controlMode === 'flight') return;

  // --- stuck watchdog (runs over whatever the beat handler decided) -----------
  const pushing = controls.forward || controls.backward || controls.left || controls.right;
  const plannedRecoveryUnsafe = navigationAction === 'jetpack' || navigationAction === 'unreachable';
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
    // Recovery is the same jump/side-step the player can perform. Failed
    // recovery remains observable by the stuck reporter; no pose is teleported.
    unstickUntil = beatClock + 1.6;
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

/** Capabilities exposed to rails; state is shared with the player's virtual controls. */
const railRuntime = {
  get getItemCount() { return getItemCount; },
  get CH1_FIXED_TUTORIAL() { return CH1_FIXED_TUTORIAL; },
  get extractRhythm() { return extractRhythm; },
  get sweepGoal() { return sweepGoal; },
  get controls() { return controls; },
  get getSideLens() { return getSideLens; },
  get walkTowardTaskRow() { return walkTowardTaskRow; },
  get _goalScratch() { return _goalScratch; },
  get getPlayerWorldPosition() { return getPlayerWorldPosition; },
  get CH1_QUOTA() { return CH1_QUOTA; },
  get committedDebrisTarget() { return committedDebrisTarget; },
  get getDebrisPositions() { return getDebrisPositions; },
  get getSupplyPodPositions() { return getSupplyPodPositions; },
  get isPodCollected() { return isPodCollected; },
  get currentNavWaypointPosition() { return currentNavWaypointPosition; },
  get walkTowardLens() { return walkTowardLens; },
  get signalMesaHandle() { return signalMesaHandle; },
  get anomalyMassDesignated() { return anomalyMassDesignated; },
  get setCinematicGazeIntent() { return setCinematicGazeIntent; },
  get beatClock() { return beatClock; },
  set beatClock(value: typeof beatClock) { beatClock = value; },
  get getPlayerUp() { return getPlayerUp; },
  get setCinematicLookTarget() { return setCinematicLookTarget; },
  get setCinematicLookWeight() { return setCinematicLookWeight; },
  get anomalyStoneHandle() { return anomalyStoneHandle; },
  get walkToward() { return walkToward; },
  get pulseInteract() { return pulseInteract; },
  get heroTreeHandle() { return heroTreeHandle; },
  get treeApproach() { return treeApproach; },
  set treeApproach(value: typeof treeApproach) { treeApproach = value; },
  get storyAnchors() { return storyAnchors; },
  get interactionApproachGoal() { return interactionApproachGoal; },
  get getWorldGen() { return getWorldGen; },
  get STORY_PRIMARY_WORLD_ID() { return STORY_PRIMARY_WORLD_ID; },
  get treeCrownLift() { return treeCrownLift; },
  get getCampfires() { return getCampfires; },
  get screeningActionReady() { return screeningActionReady; },
  get autopilotWorldAccess() { return autopilotWorldAccess; },
  get noteScreeningAction() { return noteScreeningAction; },
  get currentGatherObjectiveStage() { return currentGatherObjectiveStage; },
  get constructionTreeTargets() { return treeFieldHandle.pickTargets; },
  get nearestGatherResourceTarget() { return nearestGatherResourceTarget; },
  get currentGatherMarkerResource() { return currentGatherMarkerResource; },
  get _target() { return _target; },
  get movieAte() { return movieAte; },
  set movieAte(value: typeof movieAte) { movieAte = value; },
  get clearControls() { return clearControls; },
  get movieEatForage() { return movieEatForage; },
  get forageGoalAt() { return forageGoalAt; },
  set forageGoalAt(value: typeof forageGoalAt) { forageGoalAt = value; },
  get forageGoal() { return forageGoal; },
  set forageGoal(value: typeof forageGoal) { forageGoal = value; },
  get nearestForageNodeWorld() { return nearestForageNodeWorld; },
  get wreckRelayHandle() { return wreckRelayHandle; },
  get vigilRestReady() { return vigilRestReady; },
  get vigilSkyLookTarget() { return vigilSkyLookTarget; },
  get getLocalActorId() { return getLocalActorId; },
  get hasMilestone() { return hasMilestone; },
  get EMERGENT_AUDIT_MILESTONES() { return EMERGENT_AUDIT_MILESTONES; },
  get performStoryInteraction() { return performStoryInteraction; },
  get EMERGENT_MAW_MILESTONES() { return EMERGENT_MAW_MILESTONES; },
  get EMERGENT_UNIQUE_ITEM_MILESTONES() { return EMERGENT_UNIQUE_ITEM_MILESTONES; },
  get getPlayerSubmersion() { return getPlayerSubmersion; },
  get AUTHORED_DIVE_MILESTONES() { return AUTHORED_DIVE_MILESTONES; },
  get diveRecoveryActive() { return diveRecoveryActive; },
  set diveRecoveryActive(value: typeof diveRecoveryActive) { diveRecoveryActive = value; },
  get AUTHORED_DIVE_ENTER_SUBMERGENCE() { return AUTHORED_DIVE_ENTER_SUBMERGENCE; },
  get nextDiveRecoveryState() { return nextDiveRecoveryState; },
  get getVitals() { return getVitals; },
  get getKeelMemoryPose() { return getKeelMemoryPose; },
  get diveAimReady() { return diveAimReady; },
  set diveAimReady(value: typeof diveAimReady) { diveAimReady = value; },
  get moveThroughWaterToward() { return moveThroughWaterToward; },
  get nextDiveAimReady() { return nextDiveAimReady; },
  get getPlayerLook() { return getPlayerLook; },
  get diveColumnLocked() { return diveColumnLocked; },
  set diveColumnLocked(value: typeof diveColumnLocked) { diveColumnLocked = value; },
  get nextDiveColumnLock() { return nextDiveColumnLock; },
  get getEmergentMovieWreckBinding() { return getEmergentMovieWreckBinding; },
  get hifiWreckHandle() { return hifiWreckHandle; },
  get shouldExitWaterBeforeMovieWreck() { return shouldExitWaterBeforeMovieWreck; },
  get movieWreckInteractionMotion() { return movieWreckInteractionMotion; },
  get shouldApproachMovieWreck() { return shouldApproachMovieWreck; },
  get navigationAction() { return navigationAction; },
  set navigationAction(value: typeof navigationAction) { navigationAction = value; },
  get shouldRecoverMovieWreckWetStart() { return shouldRecoverMovieWreckWetStart; },
  get navigationReason() { return navigationReason; },
  set navigationReason(value: typeof navigationReason) { navigationReason = value; },
  get resetNavigationRoute() { return resetNavigationRoute; },
  get resolveMovieWreckInteractionAnnulusGoal() { return resolveMovieWreckInteractionAnnulusGoal; },
  get _wreckInteractionScratch() { return _wreckInteractionScratch; },
  get holdAt() { return holdAt; },
  get emergentMovieShelterView() { return emergentMovieShelterView; },
  get emergentMovieShelterEgressGoal() { return emergentMovieShelterEgressGoal; },
  get emergentMovieConstructionWoodNeeded() { return emergentMovieConstructionWoodNeeded; },
  get prepareEmergentMovieWreckCraft() { return prepareEmergentMovieWreckCraft; },
  get getShipPosition() { return getShipPosition; },
  get isBoardable() { return isBoardable; },
  get enterShip() { return enterShip; },
  get getSpaceFlightSnapshot() { return getSpaceFlightSnapshot; },
  get exitShip() { return exitShip; },
  get getEmergentMovieSettlementBinding() { return getEmergentMovieSettlementBinding; },
  get getHabitatWorldState() { return getHabitatWorldState; },
  get TIDEGARDEN_WORLD_ID() { return TIDEGARDEN_WORLD_ID; },
  get TIDEGARDEN_SETTLEMENT_MILESTONES() { return TIDEGARDEN_SETTLEMENT_MILESTONES; },
  get getTidegardenChosenHabitatSite() { return getTidegardenChosenHabitatSite; },
  get habitatGoal() { return habitatGoal; },
  set habitatGoal(value: typeof habitatGoal) { habitatGoal = value; },
  get resolveTidegardenSettlementTarget() { return resolveTidegardenSettlementTarget; },
  get findEmergentMovieHabitatGoal() { return findEmergentMovieHabitatGoal; },
  get prepareEmergentMovieHabitatCore() { return prepareEmergentMovieHabitatCore; },
  get installEmergentMovieHabitatCore() { return installEmergentMovieHabitatCore; },
  get buildAndCertifyEmergentMovieShelter() { return buildAndCertifyEmergentMovieShelter; },
  get completeEmergentMovieSafeRest() { return completeEmergentMovieSafeRest; },
  get getCurrentDayPhase() { return getCurrentDayPhase; },
  get CH10_EGRESS_HOLD_SECONDS() { return CH10_EGRESS_HOLD_SECONDS; },
  get openEmergentMovieShelterEgress() { return openEmergentMovieShelterEgress; },
  get STORY_MILESTONES() { return STORY_MILESTONES; },
  get tickSt0GazeBias() { return tickSt0GazeBias; },
  get CH10_CORE_COMMIT_DISTANCE() { return CH10_CORE_COMMIT_DISTANCE; },
  get CH10_FABRICATOR_COMMIT_DISTANCE() { return CH10_FABRICATOR_COMMIT_DISTANCE; },
  get getSystemFlightSnapshot() { return getSystemFlightSnapshot; },
  get chapter10AskDescentSystemTarget() { return chapter10AskDescentSystemTarget; },
  get spaceStationApproachGeometry() { return spaceStationApproachGeometry; },
  get STATION_STANDOFF_DISTANCE() { return STATION_STANDOFF_DISTANCE; },
  // Chapter 13's rail body is reached THROUGH the runtime rather than imported
  // by each rail file. A rail that imported the director directly would close a
  // real module cycle — `definitions.ts` reaches the ch13 contracts, which
  // reach their rails — and the symptom is an undefined contract in
  // `BEAT_DEFINITIONS` at import time, not a warning.
  get applyCommonGroundRail() { return applyCommonGroundRail; }
};
export type RailRuntime = typeof railRuntime;
