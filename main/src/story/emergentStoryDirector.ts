import * as THREE from 'three';
import { subscribeFinalizedLocalGameplayCommand } from '../game/commandDispatchAdapter.ts';
import { getLocalActorId } from '../game/playerActors.ts';
import { getCampfires } from '../game/systems/campfires.ts';
import { getShipRepairStage } from '../game/systems/shipRestoration.ts';
import { getShipPosition } from '../state/shipProximity.ts';
import { registerStoryInteraction } from './storyInteractions.ts';
import { readSystemCompanionBodyTarget } from '../state/systemCompanionBodyTargets.ts';
import { buildStarSystemManifest } from '../game/starSystem.ts';
import { systemSpaceStations } from '../game/spaceStation/spaceStationBody.ts';
import { STORY_COORDINATE } from './world/storyWorld.ts';
import { atLeast, type ShipRepairStage } from './emergentCapabilities.ts';
import { hasMilestone, markMilestone } from '../game/systems/progressionSystem.ts';
import {
  clearVoxelRealityOverrides,
  overrideVoxelRealityEffects
} from '../game/systems/realityRenderSystem.ts';
import { playSfx } from '../audio/sfxEngine.ts';
import { getSpaceFlightSnapshot } from '../state/spaceFlight.ts';
import { getSystemFlightSnapshot } from '../state/systemFlight.ts';
import { getAppStateSnapshot } from '../state/appState.ts';
import {
  commitA4Alive,
  EMERGENT_AUDIT_MILESTONES,
  FIELD_PACK_DROPPED_MILESTONE
} from './emergentAudit.ts';
import {
  hasBankedKestrelKeelMemory
} from './emergentUniqueItems.ts';
import { getAuthoredDiveGuidance } from './emergentDive.ts';
import {
  EMERGENT_MAW_MILESTONES,
  getAuthoredMawGuidance,
  getMawFirstDirectionChoice
} from './emergentMawRepair.ts';
import { emitEmergentStoryEvent } from './emergentStoryEvents.ts';
import { scoreHit, setScoreIntensity } from './storyScore.ts';
import {
  advanceToBeat,
  completeChapter10,
  completeStory,
  getStoryStateSnapshot,
  reactivateStoryAtBeat,
  STORY_MILESTONES,
  type StoryBeat
} from './storyState.ts';
import { spaceStationApproachGeometry } from '../components/SpaceStationApproachDriver.tsx';
import { SCAN_RANGE } from '../game/spaceStation/spaceStationApproach.ts';
import { getPlayerLook, getPlayerWorldPosition } from '../state/playerFrame.ts';
import { commitSpaceStationTarget } from '../state/systemFlight.ts';
import {
  chapter10RelayAnswerDelaySeconds,
  noteChapter10ScoreAnchor
} from './emergentScoreDirector.ts';

/**
 * One anchor, every consumer. The signed rail and the score move together off
 * the same id in the same frame — simultaneity by shared anchor, never by tuned
 * offsets — and the rail's own ordering rules are what keep the sequence honest.
 */
function noteChapter10Anchor(anchorId: string): void {
  activateSignedSceneAnchorById(anchorId);
  noteChapter10ScoreAnchor(anchorId);
}
import { showAuditLine, showCaption, showSystemLine, setWorkOrder } from './storyText.ts';
import { setStoryMoveScale, setStoryTargetFov, SANDBOX_FOV } from './storyInputPolicy.ts';
import { getHabitatWorldState } from '../game/systems/habitatSystem.ts';
import {
  setCinematicLookTarget,
  setCinematicLookWeight
} from './cinematicLook.ts';
import { getFeedRuntime } from './feedRuntime.ts';
import { STORY_PRIMARY_WORLD_ID, TIDEGARDEN_WORLD_ID } from './tidegardenRoute.ts';
import {
  getTidegardenSettlementGuidance,
  hasTidegardenChosenFoundation,
  isHabitatNight,
  tidegardenFoundationMatchesSiteChoice,
  TIDEGARDEN_SETTLEMENT_MILESTONES
} from './tidegardenSettlement.ts';
import { getItemCount } from '../game/systems/inventorySystem.ts';
import { getCurrentDayPhase } from '../game/worldClock.ts';
import { getWreckRelayPose, storyAnchors } from './world/storyWorld.ts';
import { getAuditWorkerPose } from './world/AuditWorker.tsx';
import { heroTreeHandle } from './world/HeroAppleTree.tsx';
import { wreckRelayHandle } from './world/WreckRelay.tsx';
import { createLiveAgentSurfaceTerrain } from '../utils/agentSurfaceNavigationRuntime.ts';
import { planAgentSurfaceRoute } from '../utils/agentSurfaceNavigation.ts';
import {
  groundedSurfaceRouteLength,
  sampleGroundedSurfaceRoute,
  turnGroundedHeadingToward,
  type GroundedSurfaceSample
} from '../utils/groundedSurfaceMotion.ts';
import { resolveSystemBodyMusicIdentity } from '../audio/destinationMusicIdentity.ts';
import {
  activateSignedSceneAnchorById,
  enterSignedSceneAvBeat,
  tickSignedSceneAvRuntime
} from './signedSceneAvRuntime.ts';
import {
  activateVehicleSceneAvEvent,
  VEHICLE_SCENE_AV_EVENTS
} from './vehicleSceneAvAnchors.ts';
import {
  getPhysicalBoardingGuidance,
  getPhysicalBoardingSnapshot,
  hasCompletedPhysicalBoarding,
  hasSealedPhysicalBoarding,
  reconcilePhysicalBoardingSignedAvFromReceipt
} from './physicalBoarding.ts';
import {
  hasFirstHoverGroundedReturn,
  hasFirstLegalHoverReceipt,
  hasWreckDiagnosisReceipt,
  reconcileReconstructionSignedAvFromReceipts
} from './reconstructionEmbodiment.ts';
import {
  getReconstructionCalibrationSnapshot,
  hasReconstructionCalibrationReceipt
} from './reconstructionCalibration.ts';
import { getWreckReconstructionGuidance } from './wreckReconstruction.ts';
import {
  hydrateChapter7BoardingScore,
  syncChapter7ReconstructionScore
} from './emergentScoreDirector.ts';
import {
  activateGuidedStoryObjective,
  clearGuidedStoryObjective,
  observeGuidedStoryMarker,
  getActiveGuidedStoryObjective,
  type GuidedStoryObjective
} from './ux/objectiveDirector.ts';
import {
  resolveStoryObjectiveGuidance,
  type Ch10AskObjectiveState
} from './storyObjectiveGuidance.ts';
import {
  advanceFlightGuidanceDwell,
  CH8_FLIGHT_GUIDANCE_DWELL_SECONDS,
  createFlightGuidanceDwell,
  resetFlightGuidanceDwell
} from './flightGuidanceDwell.model.ts';

const ORIGIN_WORLD_ID = STORY_PRIMARY_WORLD_ID;

interface EmergentDirectorRuntime {
  beat: StoryBeat | null;
  elapsed: number;
  latches: Set<string>;
  completionObservedAt: number;
  /**
   * False until the first tick of a beat has observed the world. Voice latches
   * seed to the CURRENT facts on that tick without firing, so a deep link, a
   * mid-chapter resume or a replay never replays a line the player already
   * heard and never bursts a catch-up stack of captions.
   */
  voiceLatchesSeeded: boolean;
  /**
   * R4. The ch8 exit-window clock accumulates ONLY on frames whose phase is
   * deep_space, so a dive back under the boundary freezes the window where it
   * stands and a re-exit resumes from the held value.
   */
  launchExitHeldSeconds: number;
  /** Raw spaceFlight phase seen on the previous ch8-launch tick; null until seeded. */
  launchPrevPhase: string | null;
  /** Beat-runtime moments of the ch8 paced ladder; -1 until each is observed. */
  launchL1At: number;
  launchL2At: number;
  launchL3At: number;
  launchPhaseEdgeAt: number;
  launchDeepSpaceAt: number;
  /** Which term of the l2DueAt formula was operative; null until L2 fires. */
  launchL2Cause: EmergentL2Cause;
  launchL2DueAt: number;
  /** R3. ch7 stage captions awaiting the single caption slot, in stage order. */
  reconstructCaptionQueue: string[];
  /** Beat-runtime time the caption slot frees for the next queued ch7 line. */
  reconstructSlotBusyUntil: number;
  /** Beat-runtime moments the ch7 exit cadence keys on; -1 until observed. */
  reconstructM6At: number;
  reconstructReceiptAt: number;
  reconstructM7AnchorAt: number;
  /** ch10 beat-runtime moments the REGULATION cadences key on; -1 until seen. */
  ch10FaultReadAt: number;
  ch10RefusedAt: number;
  ch10AnswerAt: number;
  ch10ResolvedAt: number;
}

/** The three-valued cause taxonomy for L2's firing moment (ruling R1). */
export type EmergentL2Cause = 'timer' | 'edge' | 'reveal-guard' | null;

const runtime: EmergentDirectorRuntime = {
  beat: null,
  elapsed: 0,
  latches: new Set(),
  completionObservedAt: -1,
  voiceLatchesSeeded: false,
  launchExitHeldSeconds: 0,
  launchPrevPhase: null,
  launchL1At: -1,
  launchL2At: -1,
  launchL3At: -1,
  launchPhaseEdgeAt: -1,
  launchDeepSpaceAt: -1,
  launchL2Cause: null,
  launchL2DueAt: -1,
  reconstructCaptionQueue: [],
  reconstructSlotBusyUntil: -1,
  reconstructM6At: -1,
  reconstructReceiptAt: -1,
  reconstructM7AnchorAt: -1,
  ch10FaultReadAt: -1,
  ch10RefusedAt: -1,
  ch10AnswerAt: -1,
  ch10ResolvedAt: -1
};

// --- Frozen cadence tables ------------------------------------------------
//
// There is no line queue or scheduler anywhere in the runtime: `storyText.ts`
// is one caption slot plus one audit slot with instant overwrite. The cadence
// IS the scheduler — every offset below is a per-tick elapsed-time check
// against a beat-runtime timestamp, exactly like the file's other holds.
// Contract: .codex/production-runs/2026-08-10-ch7-ch8-voice-repair (D9 / R2).

/**
 * StoryCaptions.tsx reveals one character every 34 ms. Every protection below
 * DERIVES its reveal time from the frozen string's own length through
 * `revealSeconds`, so no slot can silently outrun the line it guards when a
 * string is edited.
 */
const CAPTION_REVEAL_MS_PER_CHAR = 34;

function revealSeconds(line: string): number {
  return (line.length * CAPTION_REVEAL_MS_PER_CHAR) / 1000;
}

/** ch7 exit cadence, measured from the M7 mini-cadence anchor. */
export const CH7_M7_AUDIT_SECONDS = 0;
export const CH7_M7_CAPTION_SECONDS = 0.6;
export const CH7_EXIT_CAPTION_SECONDS = 3;
/**
 * D9. Was 0.65 s: too short for the owner-approved exit line to be read before
 * ch7-board's entry caption overwrites the single caption slot. Pacing only —
 * the advance still keys on the identical durable calibration fact.
 */
export const CH7_EXIT_HOLD_SECONDS = 5;

/**
 * R3 (defect ux-01). Read time each ch7 stage caption holds the single slot on
 * top of its own derived reveal. Stage edges that arrive while the slot is
 * still owed queue their CAPTION; the stage commit, its regulation receipt,
 * the score variant, the anchor and the objective all stay real-time.
 */
export const CH7_STAGE_DWELL_SECONDS = 0.4;

/**
 * ch8 paced ladder (draft-v3, defect vd-01). The two signed launch anchors are
 * measured entry-coincident — both sit in activatedAnchorIds on the first
 * ch8-launch frame with the raw phase still 'surface' — so they cannot carry a
 * caption. L1/L2/L3 are paced off the player's own committed acts instead, read
 * from unprotected state only. The signed anchors keep their score cues and
 * shots and are not touched.
 *
 * Both values are read time on top of a derived reveal, never a substitute for
 * it: the reveal guard in `l2DueAt` is what makes the no-cut law absolute.
 */
export const CH8_L1_MIN_SLOT_SECONDS = 4.5;
export const CH8_L2_MIN_SLOT_SECONDS = 3;

const CH8_L1_CAPTION =
  'the pond answered every time i asked. i am leaving anyway — that is what the answers were for.';
const CH8_L2_CAPTION = 'hold it. this is the only order left, and i am the one giving it.';
const CH8_L3_CAPTION = 'the site gets small. the tree does not. i keep finding it.';
const CH8_L4_CAPTION =
  'i came down this line without being asked. i am going back up it on purpose.';

const CH7_M1_CAPTION =
  'the wreck that brought me here will leave here. i will build the leaving.';
/** M6, the turn. The one ch7 stage caption the R3 close may never drop. */
const CH7_M6_CAPTION =
  'the last part is the part that thinks. i am being watched now. i put it in anyway.';

/** ch8 exit-window cadence, measured from the observed atmosphere exit (L4). */
export const CH8_ATMOSPHERE_EXIT_CAPTION_SECONDS = 0;
export const CH8_STACK_ONE_SECONDS = 2;
export const CH8_STACK_TWO_SECONDS = 4;
export const CH8_STACK_THREE_SECONDS = 6;
export const CH8_CONTACT_LOGGED_SECONDS = 8.5;
export const CH8_DESIGNATION_CAPTION_SECONDS = 11.5;
export const CH8_OPEN_QUERY_SECONDS = 14;
/**
 * R2. Shipped `tickLaunch()` advanced on the same tick `deep_space` was first
 * observed, so nothing scoped to ch8-launch could survive to speak. Bounded,
 * pacing-only breathing room on the identical durable `deep_space` fact.
 */
export const CH8_EXIT_HOLD_SECONDS = 17;

// --- Chapter 10: the station introduction ---------------------------------
//
// Every constant the frozen scene contract names lands here with its exact
// name. Numbers the contract left to implementation carry their reasoning.

/**
 * The "do not rush" dial. Accumulated `done` free-play time before the fault may
 * be noticed at all. 180s is chosen against the contract's own ST-0 recurrence
 * proof: any outdoor night window of at least three minutes contains at least
 * one complete ST-0 crossing, so the chapter can never open before the sky has
 * had the chance to show the player the dot it will later ask them to fly to.
 * Owner-tunable.
 */
export const CH10_FREEPLAY_GRACE_SECONDS = 180;
/**
 * How near the second hearth's core the player must be for the fault to be
 * noticed. Sits between the shipped rest radius (4.2) and marker-approach
 * distances, so "at the hearth" means inside the shelter's own footprint rather
 * than anywhere on the settlement. Owner-tunable.
 */
export const CH10_HEARTH_NOTICE_RADIUS = 12;
/** Read dwell a REGULATION line holds the band on top of its own reveal. */
export const CH10_REGULATION_DWELL_SECONDS = 0.4;
/** AuditBand.tsx reveals the REGULATION/RELAY register one char every 22 ms. */
const REGULATION_REVEAL_MS_PER_CHAR = 22;
/** The 2.5s diegetic thrust-cold hold at the resolve. HOLD-START alignment. */
export const HOLD_DURATION_MS = 2500;
/** The octave double lands on the first beat-grid point after the anchor. */
export const RESOLVE_QUANTIZE = 'beat' as const;
/** The seam fires only once the sky has finished going black. */
export const SEAM_OF_LIGHT_MIN_BLEND = 0.9;
/** Preferred trigger: the composed reveal, target near view center. */
export const SEAM_VIEW_CONE_DEG = 20;
/**
 * The look-independent floor. Equal BY REFERENCE to the shipped scan range, so
 * the seam and the instrument can never disagree about the same distance.
 */
export const SEAM_FALLBACK_RANGE = SCAN_RANGE;
/** Outside CORRIDOR_RANGE 1,400: no corridor publication, no berth invitation. */
export const STATION_STANDOFF_DISTANCE = 1_500;

function regulationRevealSeconds(line: string): number {
  return (line.length * REGULATION_REVEAL_MS_PER_CHAR) / 1000;
}

/** K1–K11, byte-exact from the frozen contract. */
const K1 = '(the hum has dropped a step. cold is coming through a wall you sealed yourself.)';
const K2 = 'HAB CORE · POWER: ONE BONDED CELL · CONDITION: DEGRADING';
const K3 = 'BONDED CELL IS AN ISSUED COMPONENT. FABRICATION IS NOT AUTHORIZED.';
const K4 = '(a world gives stone, water, wood. it does not give this. this was issued.)';
const K5 = 'PATTERN NOT HELD · CLASS: ISSUED COMPONENT · SOURCE NOT HELD LOCALLY';
const K6 = '(the channel at the wreck never closed. asking is still a thing that can be done.)';
const K7 = 'SOURCE REQUEST LOGGED · COMPONENT: BONDED CELL (ISSUED)';
const K8 = 'SOURCE ON RECORD · ISSUING STATION · THIS SYSTEM · BEARING ATTACHED (ADVISORY)';
const K9 = '(the answer came back before the asking finished.)';
const K10 = '(issued, not offered. the going is still yours.)';
const K11 = '(both fires behind you now. ahead, a light someone else keeps alive.)';

/** The relay speaks as a record, in the third register, with no first person. */
const CH10_RELAY_HEADER = 'WRECK RELAY';
/**
 * Her own tooling identifies itself. K2 self-identifies inline and K7/K8 carry
 * the channel's header; K5 painting headerless in the band that once carried
 * W-7744's orders was an unauthored ambiguity. Only the unanswerable things
 * stay nameless.
 */
const CH10_FABRICATOR_HEADER = 'KESTREL FABRICATOR';

export const CHAPTER_10_COPY = Object.freeze({
  K1, K2, K3, K4, K5, K6, K7, K8, K9, K10, K11
});

const CH7_DIAGNOSIS_LATCH = 'ch7-m1-diagnosis';
const CH8_L1_LATCH = 'ch8-l1-controls';
const CH8_L2_LATCH = 'ch8-l2-self-order';
const CH8_L3_LATCH = 'ch8-l3-site-recedes';
const CH8_LADDER_LATCHES = [CH8_L1_LATCH, CH8_L2_LATCH, CH8_L3_LATCH];

/**
 * M2–M6. One latched moment per committed repair stage, in stage order: the
 * restored ship reports on the WRECK RELAY band (third register, no first
 * person) and the embodied voice answers below it, bare.
 */
const CH7_REPAIR_STAGE_VOICE: readonly {
  readonly stage: ShipRepairStage;
  readonly latch: string;
  readonly audit?: { readonly text: string; readonly header: string };
  readonly caption: string;
}[] = [
  {
    stage: 'bench_online',
    latch: 'ch7-m2-bench-online',
    caption: 'the keel takes the weight first. everything after this is allowed to be heavy.'
  },
  {
    stage: 'frame_restored',
    latch: 'ch7-m3-frame-restored',
    caption: 'it remembers a straight line and goes back to it without being told. i watch that closely.'
  },
  {
    stage: 'hull_sealed',
    latch: 'ch7-m4-hull-sealed',
    audit: { text: 'PRESSURE BOUNDARY HELD · PASSIVE BEACON RESTORED', header: 'WRECK RELAY' },
    caption: 'i closed it, and something inside started listening again. i did that too.'
  },
  {
    stage: 'lift_online',
    latch: 'ch7-m5-lift-online',
    audit: { text: 'POWER BUS LIVE · TRANSPONDER ARMED', header: 'WRECK RELAY' },
    caption: "the ground's hold is a habit, not a law."
  },
  {
    stage: 'flight_ready',
    latch: 'ch7-m6-flight-ready',
    caption: CH7_M6_CAPTION
  }
];
let finalizedLocalCommandStoryAdapterInstalled = false;

// Dwell for the Chapter 8 flight-derived guidance states. Reset at every beat
// entry (so a fresh beat latches its first sample immediately); thereafter it
// holds a stable objective id through an envelope/surface boundary oscillation
// so `activateGuidedStoryObjective` cannot re-pop the card / re-chirp per frame.
// `runtime.elapsed` is the monotonic time source (0 at entry, growing per tick).
const ch8FlightGuidanceDwell = createFlightGuidanceDwell();

/**
 * True only inside `enterEmergentStoryBeat`. Every publish in this file routes
 * through the wrapper below so beat entry can tell "this beat guides nothing"
 * apart from "this beat re-published what was already true" — the distinction
 * the ch9 double-enter defect turned on.
 */
let beatEntryInProgress = false;
let beatEntryPublishedObjective = false;

function publishGuidedObjective(objective: GuidedStoryObjective): boolean {
  if (beatEntryInProgress) beatEntryPublishedObjective = true;
  const activated = activateGuidedStoryObjective(objective);
  // SAME-FRAME MARKER RESOLUTION. Activation deliberately clears markerVisible,
  // and the shared marker driver only answers on the NEXT frame — so between
  // the two, a mandatory rung was observable at `missing-marker`. The next
  // frame healed it, which is exactly why it survived: the invariant is that a
  // mandatory objective is never observable in that state, not that it recovers
  // from it. Chapter 10 resolves its own targets from handles that already
  // exist at publication time, so it can answer in the same frame it publishes.
  // Non-ch10 beats resolve null here and keep their shipped driver behaviour.
  if (activated) {
    const target = getChapter10MarkerTarget(runtime.beat, objective);
    if (target) observeGuidedStoryMarker(target.label);
  }
  return activated;
}

function syncEmergentObjectiveGuidance(beat: StoryBeat | null): void {
  if (!beat) return;
  const actorId = getLocalActorId();
  const guidance = (() => {
    switch (beat) {
      case 'ch4-audit':
        return resolveStoryObjectiveGuidance(beat, {
          auditStage: !hasMilestone(EMERGENT_AUDIT_MILESTONES.fireMismatch, actorId)
            ? 'fire'
            : !hasMilestone(EMERGENT_AUDIT_MILESTONES.lifeMismatch, actorId)
              ? 'life'
              : !hasMilestone(EMERGENT_AUDIT_MILESTONES.treeMismatch, actorId)
                ? 'tree'
                : 'complete'
        });
      case 'ch4-comply':
        return resolveStoryObjectiveGuidance(beat, {
          complianceStage: !hasMilestone(EMERGENT_AUDIT_MILESTONES.fireComplied, actorId)
            ? 'fire'
            : !hasMilestone(EMERGENT_AUDIT_MILESTONES.organicsComplied, actorId)
              ? 'organics'
              : 'complete'
        });
      case 'ch4-defy':
        return resolveStoryObjectiveGuidance(beat, {
          defianceStage: hasMilestone(EMERGENT_AUDIT_MILESTONES.refusalCommitted, actorId)
            ? 'complete'
            : hasMilestone(EMERGENT_AUDIT_MILESTONES.refusalAvailable, actorId)
              ? 'refuse'
              : 'test-maw'
        });
      case 'ch8-launch': {
        const flight = getSpaceFlightSnapshot();
        // Dwell the flight-derived id: an atmosphere boundary can flip phase
        // frame-to-frame; hysteresis stops the objective card re-popping/chirping.
        const rawLaunchState = flight.phase === 'surface'
          ? flight.controlMode === 'flight'
            ? 'surface-flight'
            : 'surface-on-foot'
          : flight.phase === 'deep_space'
            ? 'deep-space'
            : 'launching';
        return resolveStoryObjectiveGuidance(beat, {
          ch8LaunchState: advanceFlightGuidanceDwell(
            ch8FlightGuidanceDwell, rawLaunchState, runtime.elapsed, CH8_FLIGHT_GUIDANCE_DWELL_SECONDS
          ) as typeof rawLaunchState
        });
      }
      case 'ch8-crossing': {
        const system = getSystemFlightSnapshot();
        const tidegardenTargeted = system.target?.kind === 'system_body'
          && system.target.worldId === TIDEGARDEN_WORLD_ID;
        // A surface/descent flight snapshot by itself is not evidence that
        // Tidegarden's approach envelope has been reached. During boot the
        // story snapshot can publish before flight continuity hydrates; only
        // system-body ownership may advance this objective to approach. Dwelled
        // so a boundary oscillation of activePlanetId cannot flap the id.
        const rawCrossingState = system.activePlanetId === TIDEGARDEN_WORLD_ID
          ? 'approach-envelope'
          : tidegardenTargeted
            ? 'hold-course'
            : 'acquire-sibling';
        return resolveStoryObjectiveGuidance(beat, {
          ch8CrossingState: advanceFlightGuidanceDwell(
            ch8FlightGuidanceDwell, rawCrossingState, runtime.elapsed, CH8_FLIGHT_GUIDANCE_DWELL_SECONDS
          ) as typeof rawCrossingState
        });
      }
      case 'ch8-landfall': {
        const flight = getSpaceFlightSnapshot();
        // Dwelled: the surface/flight boundary can oscillate phase/controlMode.
        const rawLandfallState = flight.phase !== 'surface'
          ? 'descent'
          : flight.controlMode === 'flight'
            ? 'surface-flight'
            : 'surface-fps';
        return resolveStoryObjectiveGuidance(beat, {
          ch8LandfallState: advanceFlightGuidanceDwell(
            ch8FlightGuidanceDwell, rawLandfallState, runtime.elapsed, CH8_FLIGHT_GUIDANCE_DWELL_SECONDS
          ) as typeof rawLandfallState
        });
      }
      case 'ch10-cold':
        return resolveStoryObjectiveGuidance(beat, {
          ch10ColdState: hasMilestone(STORY_MILESTONES.ch10FaultRead, actorId)
            ? 'fabrication-attempt'
            : 'fault-read'
        });
      case 'ch10-ask':
        return resolveStoryObjectiveGuidance(beat, {
          ch10AskState: chapter10AskState(actorId)
        });
      case 'ch10-transit':
        return resolveStoryObjectiveGuidance(beat, {
          ch10TransitState: hasMilestone(STORY_MILESTONES.ch10SeamPassed, actorId)
            ? 'resolve'
            : hasMilestone(STORY_MILESTONES.ch10TransitIgnited, actorId)
              ? 'hold'
              : 'ignite'
        });
      default:
        return null;
    }
  })();
  if (guidance && chapter10GuidanceFindable(beat, guidance)) publishGuidedObjective(guidance);
}

/**
 * A mandatory rung may not be PUBLISHED before the thing it points at exists.
 *
 * Same-frame marker resolution fixed the case where the handle was already
 * there. It could not fix the deep link, where the ladder publishes while the
 * world is still arriving: `station:return:reboard` names the Kestrel's hatch,
 * and the ship mounts a few seconds after the bootstrap, so the rung stood at
 * missing-marker for 3.4 seconds. Waiting is the honest answer — an absent
 * objective is `idle`, which is true (guidance has nothing findable to say yet)
 * where a findable-looking rung pointing at nothing is a lie. The director ticks
 * every frame, so publication follows the handle by one frame.
 *
 * Non-ch10 beats are unaffected: they resolve null here and keep publishing
 * exactly as they ship today.
 */
function chapter10GuidanceFindable(
  beat: StoryBeat,
  objective: GuidedStoryObjective
): boolean {
  if (!beat.startsWith('ch10')) return true;
  if (objective.requiresMarker === false) return true;
  return getChapter10MarkerTarget(beat, objective) !== null;
}

/**
 * The ch10-ask ladder, rung by rung, from durable receipts and unprotected
 * flight facts. Every rung's marker resolves from a handle that already exists
 * (hatch, flight target, wreck site, wreckRelayHandle), so no rung can publish
 * a marker-requiring objective before its target is findable.
 */
function chapter10AskState(actorId: string): Ch10AskObjectiveState {
  const flight = getSpaceFlightSnapshot();
  const system = getSystemFlightSnapshot();
  // WORLD FIRST, RECEIPT SECOND. Both relay rungs mark the relay itself, and
  // the relay exists on the origin world and nowhere else — so neither may be
  // published while another world is the enclosing one, no matter which durable
  // receipts are already held. Reading the answered milestone first is what let
  // `station:bearing-claim` enter on Tidegarden against an unresolvable target
  // and sit at missing-marker, which no mandatory objective may ever do.
  if (system.activePlanetId !== ORIGIN_WORLD_ID) {
    return flight.controlMode === 'flight' ? 'crossing' : 'reboard';
  }
  if (flight.phase !== 'surface' || flight.controlMode === 'flight') return 'landfall';
  if (hasMilestone(STORY_MILESTONES.ch10RelayAnswered, actorId)) return 'bearing-claim';
  return 'relay-query';
}

interface AuditRouteRuntime {
  key: string | null;
  terrainRevision: string | null;
  route: Array<{ position: THREE.Vector3 }>;
  distance: number;
  length: number;
  sample: GroundedSurfaceSample;
}

const auditRoute: AuditRouteRuntime = {
  key: null,
  terrainRevision: null,
  route: [],
  distance: 0,
  length: 0,
  sample: {
    position: new THREE.Vector3(),
    heading: new THREE.Vector3(),
    distance: 0,
    segmentIndex: -1,
    segmentProgress: 0
  }
};
const AUDITOR_WALK_SPEED = 2.45;
const AUDITOR_TURN_SPEED = 5.2;

/** Called by the primary director at the same beat boundary as score/camera reset. */
export function enterEmergentStoryBeat(beat: StoryBeat | null): void {
  ensureFinalizedLocalCommandStoryAdapter();
  ensureChapter10Interactions();
  const leavingA4 = runtime.beat === 'a4-exhale' && beat !== 'a4-exhale';
  if (leavingA4) {
    clearVoxelRealityOverrides();
    getFeedRuntime().cinematic = 0;
    setCinematicLookWeight(0);
    setCinematicLookTarget(null);
    setStoryTargetFov(SANDBOX_FOV);
  }
  runtime.beat = beat;
  runtime.elapsed = 0;
  runtime.latches.clear();
  runtime.completionObservedAt = -1;
  runtime.voiceLatchesSeeded = false;
  runtime.launchExitHeldSeconds = 0;
  runtime.launchPrevPhase = null;
  runtime.launchL1At = -1;
  runtime.launchL2At = -1;
  runtime.launchL3At = -1;
  runtime.launchPhaseEdgeAt = -1;
  runtime.launchDeepSpaceAt = -1;
  runtime.launchL2Cause = null;
  runtime.launchL2DueAt = -1;
  runtime.reconstructCaptionQueue = [];
  runtime.reconstructSlotBusyUntil = -1;
  runtime.reconstructM6At = -1;
  runtime.reconstructReceiptAt = -1;
  runtime.reconstructM7AnchorAt = -1;
  runtime.ch10FaultReadAt = -1;
  runtime.ch10RefusedAt = -1;
  runtime.ch10AnswerAt = -1;
  runtime.ch10ResolvedAt = -1;
  resetFlightGuidanceDwell(ch8FlightGuidanceDwell);
  resetAuditRoute();
  if (beat === 'a4-exhale' && hasMilestone(STORY_MILESTONES.a4)) {
    // Reload after the authority commit reconstructs at the committed front; it
    // never rewinds the living world to the pre-refusal material floor.
    runtime.elapsed = 1.75;
  }

  // LIFECYCLE (defect ux: the shipped ch9 `settle:wait-night` double-enter).
  //
  // Beat entry used to CLEAR guidance unconditionally and then let the entering
  // beat republish. When ch9-settle handed over to ch9-hearth while the same
  // wait-for-night objective was still the honest next action, the clear made
  // `activateGuidedStoryObjective` see a fresh id and emit a SECOND
  // objective-enter cue for an activation the player never re-earned.
  //
  // The clear is now deferred to the end of entry and applied only when the
  // entering beat published nothing of its own. Re-publishing an identical id
  // is a no-op inside the objective director, so the identical objective
  // survives the boundary with exactly one enter cue, while a different
  // objective still replaces it with exactly one — and a beat that guides
  // nothing still clears. Beat change therefore still clears all guidance; it
  // just no longer manufactures an activation to do it.
  beatEntryPublishedObjective = false;
  beatEntryInProgress = true;
  switch (beat) {
    case 'ch4-audit':
      setWorkOrder(['FOLLOW THE INSPECTION.', 'ATTEND EACH MISMATCH.']);
      showAuditLine('AUDIT IN PROGRESS. THREE DEVIATIONS REQUIRE WITNESS.', 'W-7744');
      break;
    case 'ch4-comply':
      setWorkOrder(['RESOLVE HEAT SOURCE.', 'RESOLVE ORGANIC CONTAMINATION.']);
      showAuditLine('RESTORE THE SITE TO ITS VERIFIED FLOOR.', 'W-7744');
      break;
    case 'ch4-defy':
      setWorkOrder(['STERILIZE PRIMARY ORGANIC ANOMALY.']);
      showAuditLine('THE TREE IS THE REMAINING ERROR.', 'W-7744');
      break;
    case 'a4-exhale':
      setWorkOrder([]);
      setScoreIntensity(0.04);
      break;
    case 'ch5-maw':
      // Publish before the first rendered world tick. Cold/direct chapter loads
      // can spend tens of seconds preparing terrain; guidance must not look
      // absent while the Canvas is still waiting to drive tickMaw().
      publishGuidedObjective(getAuthoredMawGuidance(getLocalActorId()));
      showCaption('(something tore free when he ran.)');
      break;
    case 'ch6-dive':
      publishGuidedObjective(getAuthoredDiveGuidance(getLocalActorId()));
      showCaption('(the repaired tool has marked something beneath the water.)');
      break;
    case 'ch7-reconstruct':
      {
        const guidance = getWreckReconstructionGuidance(getLocalActorId());
        publishGuidedObjective({
          ...guidance,
          id: `reconstruct:${guidance.id}`
        });
      }
      showCaption('(repair is not return.)');
      break;
    case 'ch7-board':
      publishGuidedObjective(getPhysicalBoardingGuidance());
      showCaption('(the wreck is waiting for an owner.)');
      break;
    case 'ch8-launch':
      setWorkOrder(['IGNITE. LIFT. LEAVE THE ATMOSPHERE.']);
      break;
    case 'ch8-crossing':
      setWorkOrder(['FIND THE SIBLING WORLD.', 'HOLD COURSE INTO ITS APPROACH ENVELOPE.']);
      showCaption('(there is another world here. it was always here.)');
      break;
    case 'ch8-landfall':
      setWorkOrder(['LAND ON DRY, LEVEL GROUND.', 'EXIT THE KESTREL.']);
      break;
    case 'ch9-settle':
      activateSettlementGuidance(getLocalActorId());
      showCaption('(abundance is not permission. it is a question with many answers.)');
      break;
    case 'ch9-hearth':
      activateSettlementGuidance(getLocalActorId());
      break;
    case 'ch10-cold':
      // The fault is noticed, not announced: no fanfare, one low line, and the
      // ladder the player can act on. K1's claim is score-side and non-visual.
      showCaption(K1);
      break;
    case 'ch10-ask':
      // K6 bridges the beat boundary — it is the reason the player leaves.
      showCaption(K6);
      break;
    default:
      break;
  }
  syncEmergentObjectiveGuidance(beat);
  beatEntryInProgress = false;
  if (!beatEntryPublishedObjective) clearGuidedStoryObjective();
  // Story, score, camera and PostFX all enter the frozen council contract at
  // this same beat boundary. The rail changes presentation only; durable facts
  // above remain the sole progression authority.
  const story = getStoryStateSnapshot();
  enterSignedSceneAvBeat(
    beat,
    story.chapter === 'complete' ? 'completion' : story.chapter === 'none' ? 'sandbox' : 'quit'
  );
}

/**
 * Advances only from durable gameplay facts. Timers provide breathing room
 * after a committed act; they never substitute for it.
 */
export function emergentStoryDirectorTick(dt: number): void {
  const beat = runtime.beat;
  if (!beat) return;
  runtime.elapsed += Math.max(0, dt);
  syncEmergentObjectiveGuidance(beat);
  switch (beat) {
    case 'ch4-audit':
      tickAudit(dt);
      break;
    case 'ch4-comply':
      tickCompliance(dt);
      break;
    case 'ch4-defy':
      tickRefusal(dt);
      break;
    case 'a4-exhale':
      tickA4();
      break;
    case 'ch5-maw':
      tickMaw();
      break;
    case 'ch6-dive':
      tickDive();
      break;
    case 'ch7-reconstruct':
      tickReconstruction();
      break;
    case 'ch7-board':
      tickBoarding();
      break;
    case 'ch8-launch':
      tickLaunch(dt);
      break;
    case 'ch8-crossing':
      tickCrossing();
      break;
    case 'ch8-landfall':
      tickLandfall();
      break;
    case 'ch9-settle':
      tickSettlement();
      break;
    case 'ch9-hearth':
      tickSecondHearth();
      break;
    case 'ch10-cold':
      tickChapter10Cold();
      break;
    case 'ch10-ask':
      tickChapter10Ask();
      break;
    case 'ch10-transit':
      tickChapter10Transit(dt);
      break;
    default:
      break;
  }
  // Last presentation writer in the emergent lane: applies only contracted FOV
  // envelopes and leaves look, movement and interactions player-owned.
  tickSignedSceneAvRuntime(dt);
}

function tickAudit(dt: number): void {
  const actorId = getLocalActorId();
  moveAuditor(dt, currentAuditTarget(actorId));
  if (hasMilestone(EMERGENT_AUDIT_MILESTONES.fireMismatch, actorId)) {
    once('audit-fire', () => showAuditLine('HEAT SOURCE: PERSISTENT WITHOUT AUTHORIZATION.', 'W-7744'));
  }
  if (hasMilestone(EMERGENT_AUDIT_MILESTONES.lifeMismatch, actorId)) {
    once('audit-life', () => showAuditLine('BIOLOGICAL NOISE HAS BEEN MISCLASSIFIED AS SCENERY.', 'W-7744'));
  }
  if (!hasMilestone(EMERGENT_AUDIT_MILESTONES.treeMismatch, actorId)) return;
  once('audit-tree', () => {
    showAuditLine('PRIMARY ORGANIC ANOMALY CONFIRMED. STERILIZATION AUTHORIZED.', 'W-7744');
    emitEmergentStoryEvent({
      id: `story:audit:${actorId}:sterilization-authorized`,
      type: 'audit_directive_issued',
      actorId,
      worldId: ORIGIN_WORLD_ID,
      payload: { directive: 'sterilization' }
    });
    runtime.completionObservedAt = runtime.elapsed;
  });
  if (runtime.elapsed < runtime.completionObservedAt + 1.25) return;
  markMilestone(STORY_MILESTONES.ch4Audit, actorId);
  advanceToBeat('ch4-comply');
}

function tickCompliance(dt: number): void {
  const actorId = getLocalActorId();
  moveAuditor(dt, currentComplianceTarget(actorId));
  if (hasMilestone(EMERGENT_AUDIT_MILESTONES.fireComplied, actorId)) {
    once('comply-fire', () => showCaption('(the warmth goes out because a voice named it wrong.)'));
  }
  if (!hasMilestone(EMERGENT_AUDIT_MILESTONES.regressionSettled, actorId)) return;
  once('comply-organics', () => {
    showSystemLine('VERIFIED REALITY FLOOR RESTORED.');
    runtime.completionObservedAt = runtime.elapsed;
  });
  if (runtime.elapsed < runtime.completionObservedAt + 1.5) return;
  markMilestone(STORY_MILESTONES.ch4Complied, actorId);
  advanceToBeat('ch4-defy');
}

function tickRefusal(dt: number): void {
  const actorId = getLocalActorId();
  moveAuditor(dt, heroTreeHandle.position
    ? { key: 'refuse-tree', position: heroTreeHandle.position }
    : null);
  if (!hasMilestone(EMERGENT_AUDIT_MILESTONES.refusalCommitted, actorId)) return;
  once('refusal', () => {
    showCaption('no.', 4200);
    setWorkOrder([]);
    setScoreIntensity(0);
    runtime.completionObservedAt = runtime.elapsed;
  });
  if (runtime.elapsed < runtime.completionObservedAt + 2.2) return;
  markMilestone(STORY_MILESTONES.ch4Defied, actorId);
  advanceToBeat('a4-exhale');
}

function tickA4(): void {
  const actorId = getLocalActorId();
  if (runtime.elapsed >= 1.75) {
    once('a4-life-front', () => {
      const committed = commitA4Alive(ORIGIN_WORLD_ID, actorId);
      if (!committed.ok) {
        runtime.latches.delete('a4-life-front');
        return;
      }
      if (!committed.idempotent) {
        playSfx('storyAwaken');
        scoreHit('bloom');
      }
      setScoreIntensity(0.8);
      if (!committed.idempotent) {
        showCaption('(the world exhales where it had been holding still.)');
      }
    });
  }
  if (!hasMilestone(EMERGENT_AUDIT_MILESTONES.a4Alive, actorId)) return;
  const lifeProgress = smoothstep((runtime.elapsed - 1.75) / 3.4);
  overrideVoxelRealityEffects({
    organic: lifeProgress,
    detail: 0.82 + lifeProgress * 0.18,
    atmosphere: 0.72 + lifeProgress * 0.28
  });
  const feed = getFeedRuntime();
  feed.cinematic = sceneEnvelope(runtime.elapsed, 0.25, 1.2, 8.7, 10.5);
  const focus = a4FocusTarget();
  setCinematicLookTarget(focus);
  const gazeEnvelope = sceneEnvelope(runtime.elapsed, 1.5, 2.25, 8.7, 10.5);
  setCinematicLookWeight(focus ? Math.min(0.68, gazeEnvelope * 0.68) : 0);
  setStoryTargetFov(58 + smoothstep((runtime.elapsed - 7.2) / 3.3) * (SANDBOX_FOV - 58));
  if (hasMilestone(EMERGENT_AUDIT_MILESTONES.a4PondVisible, actorId)) {
    once('a4-pond', () => showCaption('(water answers first. then wings. then everything at once.)'));
  }
  if (hasMilestone(EMERGENT_AUDIT_MILESTONES.a4WorkerFlight, actorId)) once('a4-flight', () => {
    showAuditLine('FAULT: W-7744 / MODEL REFUSED BY OBSERVATION', 'AUDIT NETWORK', 5000);
  });
  if (
    runtime.elapsed < 10.5
    || !hasMilestone(FIELD_PACK_DROPPED_MILESTONE, actorId)
    // The pack receipt begins the final grounded tail. Continuous play waits
    // for the rendered body to clear that tail; a receipt-backed reload starts
    // hidden and therefore preserves the same handback without replaying him.
    || getAuditWorkerPose().visible
  ) return;
  markMilestone(STORY_MILESTONES.a4Handback, actorId);
  clearVoxelRealityOverrides();
  feed.cinematic = 0;
  setCinematicLookWeight(0);
  setCinematicLookTarget(null);
  setStoryTargetFov(SANDBOX_FOV);
  setScoreIntensity(0.42);
  advanceToBeat('ch5-maw');
}

function tickMaw(): void {
  const actorId = getLocalActorId();
  publishGuidedObjective(getAuthoredMawGuidance(actorId));
  if (!hasMilestone('maw_repaired', actorId)) return;
  once('maw-repaired', () => {
    markMilestone(STORY_MILESTONES.senseMaw, actorId);
    showCaption('(it does not wake hungry. it wakes listening.)');
  });
  if (!hasMilestone(EMERGENT_MAW_MILESTONES.directionResolved, actorId)) return;
  once('maw-direction', () => {
    const choice = getMawFirstDirectionChoice(actorId);
    showCaption(choice === 'lowered-and-listened'
      ? '(you lower it. the world supplies no order.)'
      : choice === 'harmless-test'
        ? '(it cuts. the world supplies no order.)'
        : '(the world supplies no order. direction was yours.)');
  });
  if (!hasMilestone(EMERGENT_MAW_MILESTONES.pondResonance, actorId)) return;
  once('maw-resonance', () => {
    runtime.completionObservedAt = runtime.elapsed;
    showCaption('(the pond answers in structure, not instruction.)');
  });
  if (runtime.elapsed < runtime.completionObservedAt + 1.2) return;
  markMilestone(STORY_MILESTONES.ch5Maw, actorId);
  advanceToBeat('ch6-dive');
}

function tickDive(): void {
  const actorId = getLocalActorId();
  publishGuidedObjective(getAuthoredDiveGuidance(actorId));
  if (!hasBankedKestrelKeelMemory(actorId)) return;
  once('dive-banked', () => {
    runtime.completionObservedAt = runtime.elapsed;
    showCaption('(returned with breath. returned with a way to leave.)');
  });
  if (runtime.elapsed < runtime.completionObservedAt + 2.6) return;
  markMilestone(STORY_MILESTONES.ch6Dive, actorId);
  advanceToBeat('ch7-reconstruct');
}

function tickReconstruction(): void {
  const actorId = getLocalActorId();
  const repairStage = getShipRepairStage();
  const calibration = getReconstructionCalibrationSnapshot();
  syncChapter7ReconstructionScore({
    repairStage,
    firstHoverComplete: hasFirstLegalHoverReceipt(actorId),
    groundedReturnComplete: hasFirstHoverGroundedReturn(actorId),
    calibrationState: hasReconstructionCalibrationReceipt(actorId)
      ? 'complete'
      : calibration.phase === 'running'
        ? 'active'
        : 'none'
  });
  const guidance = getWreckReconstructionGuidance(actorId);
  publishGuidedObjective({
    ...guidance,
    id: `reconstruct:${guidance.id}`
  });
  reconcileReconstructionSignedAvFromReceipts(actorId, repairStage);
  tickReconstructionVoice(actorId, repairStage);
  // The scar diagnosis remains embodied. Lift rehearsal is now optional
  // exploration on Tidegarden, so ship repair and calibration must not wait on
  // a local hover/landing receipt at the origin wreck.
  if (!hasWreckDiagnosisReceipt(actorId)) return;
  if (repairStage === 'lift_online') {
    return;
  }
  if (getShipRepairStage() !== 'flight_ready') return;
  if (!hasReconstructionCalibrationReceipt(actorId)) return;
  // R3 close: the queue drops here — except M6, the turn, which may never drop.
  if (runtime.reconstructReceiptAt < 0) {
    runtime.reconstructReceiptAt = runtime.elapsed;
    runtime.reconstructCaptionQueue = runtime.reconstructCaptionQueue
      .filter(caption => caption === CH7_M6_CAPTION);
  }
  // M6 still owes the screen its reveal, so the whole mini-cadence waits and
  // then times from the shifted anchor rather than cutting the turn short.
  if (runtime.reconstructCaptionQueue.length > 0) return;
  if (runtime.reconstructM7AnchorAt < 0) {
    const m6RevealDoneAt = runtime.reconstructM6At < 0
      ? -1
      : runtime.reconstructM6At + revealSeconds(CH7_M6_CAPTION);
    runtime.reconstructM7AnchorAt = Math.max(runtime.reconstructReceiptAt, m6RevealDoneAt);
  }
  if (runtime.elapsed < runtime.reconstructM7AnchorAt) return;
  // Frozen ch7 exit cadence, timed from the M7 mini-cadence anchor. The M7
  // stamp and the exit caption share this predicate, and they are separated by
  // their offsets alone — never by reordering the checks below.
  runtime.completionObservedAt = runtime.reconstructM7AnchorAt;
  const sinceCalibration = runtime.elapsed - runtime.reconstructM7AnchorAt;
  if (sinceCalibration >= CH7_M7_AUDIT_SECONDS) {
    once('ch7-m7-calibration', () => showAuditLine(
      'UNSCHEDULED HULL · SITE 7C-θ · INTEREST RAISED',
      'AUDIT NETWORK'
    ));
  }
  if (sinceCalibration >= CH7_M7_CAPTION_SECONDS) {
    once('ch7-m7-caption', () => showCaption(
      'nothing has asked yet. something has started paying attention.'
    ));
  }
  if (sinceCalibration >= CH7_EXIT_CAPTION_SECONDS) {
    once('ch7-exit-line', () => showCaption('the scar remains. now it can carry me.'));
  }
  if (sinceCalibration < CH7_EXIT_HOLD_SECONDS) return;
  markMilestone(STORY_MILESTONES.ch7Reconstructed, actorId);
  advanceToBeat('ch7-board');
}

/**
 * M1–M6. Regulation stamps, then the voice answers — the fixed order inside a
 * moment, because both bands are single-slot. Every line is edge-triggered on
 * a live-observed commit and fires at most once per beat entry. Under R3 the
 * regulation stamp is real-time and the caption joins the queue, so a burst of
 * fast commits can never cut a line's reveal.
 */
function tickReconstructionVoice(actorId: string, repairStage: ShipRepairStage): void {
  const diagnosed = hasWreckDiagnosisReceipt(actorId);
  if (!runtime.voiceLatchesSeeded) {
    runtime.voiceLatchesSeeded = true;
    if (diagnosed) runtime.latches.add(CH7_DIAGNOSIS_LATCH);
    for (const moment of CH7_REPAIR_STAGE_VOICE) {
      if (atLeast(repairStage, moment.stage)) runtime.latches.add(moment.latch);
    }
    return;
  }
  if (diagnosed) {
    // The brackets fall here: a closed file is reopened by the player's own
    // diagnosis, and the voice never returns to parenthetical grammar.
    once(CH7_DIAGNOSIS_LATCH, () => {
      showAuditLine('HULL AT SITE 7C-θ · FILED: TOTAL LOSS · FILE CLOSED', 'WRECK RELAY');
      runtime.reconstructCaptionQueue.push(CH7_M1_CAPTION);
    });
  }
  for (const moment of CH7_REPAIR_STAGE_VOICE) {
    if (!atLeast(repairStage, moment.stage)) break;
    once(moment.latch, () => {
      if (moment.audit) showAuditLine(moment.audit.text, moment.audit.header);
      runtime.reconstructCaptionQueue.push(moment.caption);
    });
  }
  drainReconstructionCaptionQueue();
}

/**
 * R3. Hands the single caption slot to at most one queued ch7 line per frame,
 * in stage order, and only once the line before it has owned the screen for
 * its own derived reveal plus the read dwell.
 */
function drainReconstructionCaptionQueue(): void {
  if (runtime.reconstructCaptionQueue.length === 0) return;
  if (runtime.elapsed < runtime.reconstructSlotBusyUntil) return;
  const caption = runtime.reconstructCaptionQueue.shift();
  if (caption === undefined) return;
  runtime.reconstructSlotBusyUntil =
    runtime.elapsed + revealSeconds(caption) + CH7_STAGE_DWELL_SECONDS;
  if (caption === CH7_M6_CAPTION) runtime.reconstructM6At = runtime.elapsed;
  showCaption(caption);
}

function tickBoarding(): void {
  const flight = getSpaceFlightSnapshot();
  const actorId = getLocalActorId();
  const boarding = getPhysicalBoardingSnapshot();
  const sealed = hasSealedPhysicalBoarding(actorId, ORIGIN_WORLD_ID);
  if (sealed && (boarding.phase === 'idle' || boarding.phase === 'cancelled')) {
    // A restored save reconstructs steady cockpit sound without replaying the
    // one-shot pressure silence. Live transactions retain their phase edge.
    once('board-score-hydrated', () => hydrateChapter7BoardingScore({
      sealed: true,
      transactionId: boarding.transactionId ?? undefined
    }));
  }
  publishGuidedObjective(getPhysicalBoardingGuidance());
  reconcilePhysicalBoardingSignedAvFromReceipt(actorId, ORIGIN_WORLD_ID);
  // Control ownership changes behind the hatch before the pressure boundary
  // closes. Do not collapse that staged transaction into "flight mode exists".
  if (getSystemFlightSnapshot().activePlanetId !== ORIGIN_WORLD_ID) return;
  // Keep both state-evidence predicates independently inspectable: formal
  // acceptance must prove cockpit ownership and a still-grounded ship rather
  // than treating either half of the conjunction as implied by the other.
  if (flight.controlMode !== 'flight') return;
  if (flight.phase !== 'surface') return;
  if (!hasCompletedPhysicalBoarding(actorId, ORIGIN_WORLD_ID)) return;
  once('boarded', () => {
    markMilestone(STORY_MILESTONES.ch7Boarded, actorId);
    advanceToBeat('ch8-launch');
  });
}

function tickLaunch(dt: number): void {
  const flight = getSpaceFlightSnapshot();
  tickLaunchVoice(flight.phase, flight.controlMode);
  if (flight.controlMode !== 'flight' || flight.phase !== 'deep_space') return;
  // R4. The window clock accumulates only while the ship is actually outside
  // the atmosphere: a dive back under the boundary freezes it where it stands
  // and a re-exit resumes from the held value, so no row is skipped, replayed
  // or burst. The advance below needs both the held clock and a live
  // deep_space phase, which the guard above already proves.
  if (runtime.launchDeepSpaceAt < 0) runtime.launchDeepSpaceAt = runtime.elapsed;
  runtime.launchExitHeldSeconds += Math.max(0, dt);
  const sinceExit = runtime.launchExitHeldSeconds;
  if (sinceExit >= CH8_ATMOSPHERE_EXIT_CAPTION_SECONDS) {
    once('ch8-l4-atmosphere-exit', () => showCaption(CH8_L4_CAPTION));
  }
  if (sinceExit >= CH8_STACK_ONE_SECONDS) {
    once('ch8-stack-one', () => showAuditLine(
      'AUTOMATED CONTACT · SITE 7C-θ · HULL LOGGED: DESTROYED',
      'AUDIT NETWORK'
    ));
  }
  if (sinceExit >= CH8_STACK_TWO_SECONDS) {
    once('ch8-stack-two', () => showAuditLine('REGISTRY QUERY · STATE DESIGNATION.', 'AUDIT NETWORK'));
  }
  if (sinceExit >= CH8_STACK_THREE_SECONDS) {
    once('ch8-stack-three', () => showAuditLine('NO DESIGNATION RETURNED.', 'AUDIT NETWORK'));
  }
  if (sinceExit >= CH8_CONTACT_LOGGED_SECONDS) {
    once('ch8-contact-logged', () => showAuditLine('CONTACT LOGGED.', 'AUDIT NETWORK'));
  }
  if (sinceExit >= CH8_DESIGNATION_CAPTION_SECONDS) {
    once('ch8-designation', () => showCaption(
      'they asked for a designation. what i have is not one.'
    ));
  }
  if (sinceExit >= CH8_OPEN_QUERY_SECONDS) {
    once('ch8-open-query', () => showCaption('nothing answers. the query does not close.'));
  }
  if (sinceExit < CH8_EXIT_HOLD_SECONDS) return;
  const actorId = getLocalActorId();
  emitEmergentStoryEvent({
    id: `story:launch:${actorId}:origin-exit`,
    type: 'ship_launched',
    actorId,
    worldId: ORIGIN_WORLD_ID,
    payload: { worldId: ORIGIN_WORLD_ID }
  });
  markMilestone(STORY_MILESTONES.ch8Launched, actorId);
  advanceToBeat('ch8-crossing');
}

/**
 * L1–L3, the paced ladder. Every trigger reads unprotected state only and each
 * line is spaced off the player's own prior committed act, with the one
 * readable mid-beat physical edge as an accelerator.
 */
function tickLaunchVoice(phase: string, controlMode: string): void {
  if (!runtime.voiceLatchesSeeded) {
    runtime.voiceLatchesSeeded = true;
    runtime.launchPrevPhase = phase;
    // A mid-flight snapshot restore enters already off the pad: the whole
    // ladder seeds consumed, so nothing replays and nothing bursts. A pristine
    // deep link boots on the pad at phase 'surface' and plays all three.
    if (phase !== 'surface') for (const latch of CH8_LADDER_LATCHES) runtime.latches.add(latch);
    return;
  }
  const previousPhase = runtime.launchPrevPhase;
  runtime.launchPrevPhase = phase;
  if (phase === 'deep_space') {
    // Drop rule: any line still unfired when the exit fact lands is dropped for
    // this run. Nothing queues, defers or spills into the frozen exit window,
    // and an exit that lands mid-reveal is authored truncation.
    for (const latch of CH8_LADDER_LATCHES) runtime.latches.add(latch);
    return;
  }
  // The accelerator: the raw surface-to-non-surface edge across consecutive
  // ticks. Caption pacing only — no score, objective, camera or persistence.
  if (
    runtime.launchPhaseEdgeAt < 0
    && previousPhase === 'surface'
    && phase !== 'surface'
    && controlMode === 'flight'
  ) runtime.launchPhaseEdgeAt = runtime.elapsed;

  if (ch8FlightGuidanceDwell.stableState === 'surface-flight') {
    once(CH8_L1_LATCH, () => {
      runtime.launchL1At = runtime.elapsed;
      showCaption(CH8_L1_CAPTION);
    });
  }
  if (runtime.launchL1At < 0) return;
  // R1/F1a. l2DueAt = max(t_L1 + revealSeconds(L1), min(t_L1 + slot, t_edge)).
  // Committing early still pulls L2 forward onto the act it describes, but the
  // reveal guard is absolute: the edge may spend L1's read dwell down to zero
  // and can never cut a character of its reveal. The mid-reveal exception that
  // draft-v3 carried is retired — no reveal is ever cut by any cause.
  const l2RevealGuardAt = runtime.launchL1At + revealSeconds(CH8_L1_CAPTION);
  const l2TimerAt = runtime.launchL1At + CH8_L1_MIN_SLOT_SECONDS;
  const l2PulledAt = runtime.launchPhaseEdgeAt < 0
    ? l2TimerAt
    : Math.min(l2TimerAt, runtime.launchPhaseEdgeAt);
  const l2DueAt = Math.max(l2RevealGuardAt, l2PulledAt);
  if (runtime.elapsed >= l2DueAt) {
    once(CH8_L2_LATCH, () => {
      runtime.launchL2At = runtime.elapsed;
      runtime.launchL2DueAt = l2DueAt;
      runtime.launchL2Cause = l2DueAt > l2PulledAt
        ? 'reveal-guard'
        : l2PulledAt < l2TimerAt ? 'edge' : 'timer';
      showCaption(CH8_L2_CAPTION);
    });
  }
  if (runtime.launchL2At < 0 || runtime.launchPhaseEdgeAt < 0) return;
  // L3 at max(t_phaseEdge, t_L2 + CH8_L2_MIN_SLOT_SECONDS). The drop rule above
  // is what keeps it strictly before the first deep_space observation.
  const l3DueAt = Math.max(
    runtime.launchPhaseEdgeAt,
    runtime.launchL2At + CH8_L2_MIN_SLOT_SECONDS
  );
  if (runtime.elapsed >= l3DueAt) {
    once(CH8_L3_LATCH, () => {
      runtime.launchL3At = runtime.elapsed;
      showCaption(CH8_L3_CAPTION);
    });
  }
}

export interface EmergentStoryVoiceDiag {
  beat: StoryBeat | null;
  elapsed: number;
  reconstruct: {
    queuedCaptions: string[];
    slotBusyUntil: number;
    t_M6: number;
    t_calibrationReceipt: number;
    t_M7Anchor: number;
  };
  launch: {
    t_L1: number;
    t_L2: number;
    t_L3: number;
    t_phaseEdge: number;
    t_deepSpace: number;
    l2DueAt: number;
    l2Cause: EmergentL2Cause;
    exitHeldSeconds: number;
  };
}

/**
 * Read-only emission trace for the verification probes. It reports the derived
 * moments the capture spec asserts — the ch7 receipt/anchor relation and the
 * ch8 ladder's due time and cause taxonomy — none of which is recoverable from
 * the story-text store alone. Snapshot only: it creates no state and drives
 * nothing.
 */
export function getEmergentStoryVoiceDiag(): EmergentStoryVoiceDiag {
  return {
    beat: runtime.beat,
    elapsed: runtime.elapsed,
    reconstruct: {
      queuedCaptions: [...runtime.reconstructCaptionQueue],
      slotBusyUntil: runtime.reconstructSlotBusyUntil,
      t_M6: runtime.reconstructM6At,
      t_calibrationReceipt: runtime.reconstructReceiptAt,
      t_M7Anchor: runtime.reconstructM7AnchorAt
    },
    launch: {
      t_L1: runtime.launchL1At,
      t_L2: runtime.launchL2At,
      t_L3: runtime.launchL3At,
      t_phaseEdge: runtime.launchPhaseEdgeAt,
      t_deepSpace: runtime.launchDeepSpaceAt,
      l2DueAt: runtime.launchL2DueAt,
      l2Cause: runtime.launchL2Cause,
      exitHeldSeconds: runtime.launchExitHeldSeconds
    }
  };
}

function tickCrossing(): void {
  const system = getSystemFlightSnapshot();
  const flight = getSpaceFlightSnapshot();
  const actorId = getLocalActorId();
  if (system.target?.kind === 'system_body' && system.target.worldId === TIDEGARDEN_WORLD_ID) {
    const identity = resolveSystemBodyMusicIdentity(system.target);
    if (identity) {
      once('sibling-targeted', () => emitEmergentStoryEvent({
        id: `story:crossing:${actorId}:sibling-targeted`,
        type: 'system_body_targeted',
        actorId,
        worldId: TIDEGARDEN_WORLD_ID,
        payload: {
          worldId: TIDEGARDEN_WORLD_ID,
          seed: identity.seed,
          profileId: identity.profileId,
          profileVersion: identity.profileVersion,
          profileHash: identity.profileHash,
          archetype: identity.archetype
        }
      }));
    }
  }
  if (
    system.activePlanetId !== TIDEGARDEN_WORLD_ID
    || flight.phase === 'deep_space'
    || !getAppStateSnapshot().sceneReady
  ) return;
  // The short handoff veil may time out before a low-tier renderer has painted
  // eight destination frames. The director owns the durable fallback: once the
  // same physical world/flight/paint predicate that permits progression is true,
  // authenticate approach before changing beats. The signed landfall shot that
  // starts here must remain live through the beat boundary until touchdown.
  activateVehicleSceneAvEvent(VEHICLE_SCENE_AV_EVENTS.crossingApproach);
  markMilestone(STORY_MILESTONES.ch8Crossed, actorId);
  advanceToBeat('ch8-landfall');
}

function tickLandfall(): void {
  const system = getSystemFlightSnapshot();
  const flight = getSpaceFlightSnapshot();
  if (system.activePlanetId !== TIDEGARDEN_WORLD_ID || flight.phase !== 'surface') return;
  const actorId = getLocalActorId();
  once('touchdown', () => emitEmergentStoryEvent({
    id: `story:landfall:${actorId}:touchdown`,
    type: 'planet_arrived',
    actorId,
    worldId: TIDEGARDEN_WORLD_ID,
    payload: { worldId: TIDEGARDEN_WORLD_ID }
  }));
  if (flight.controlMode !== 'fps') return;
  once('first-footfall', () => {
    runtime.completionObservedAt = runtime.elapsed;
    showCaption('(a world does not begin when you see it. it begins when it holds your weight.)');
  });
  if (runtime.elapsed < runtime.completionObservedAt + 3) return;
  markMilestone(STORY_MILESTONES.ch8Landfall, actorId);
  advanceToBeat('ch9-settle');
}

function activateSettlementGuidance(actorId: ReturnType<typeof getLocalActorId>): void {
  const foundationPlaced = hasTidegardenChosenFoundation(actorId);
  const dayPhase = getCurrentDayPhase();
  const settlementGuidance = getTidegardenSettlementGuidance({
    actorId,
    coreCarried: getItemCount('habitat_core', actorId) > 0,
    foundationPlaced,
    night: isHabitatNight(dayPhase)
  });
  publishGuidedObjective({
    ...settlementGuidance,
    id: `settle:${settlementGuidance.id}`
  });
}

function tickSettlement(): void {
  const actorId = getLocalActorId();
  activateSettlementGuidance(actorId);
  if (hasMilestone(TIDEGARDEN_SETTLEMENT_MILESTONES.relationshipAttended, actorId)) {
    once('settlement-relationship', () => {
      showCaption('(roots hold the bank. the bank slows the water. neither stands alone.)');
    });
  }
  if (hasMilestone(TIDEGARDEN_SETTLEMENT_MILESTONES.coreOnline, actorId)) {
    once('settlement-core', () => {
      showSystemLine('HABITAT CORE ONLINE · ADDRESS NOT YET PROVEN');
    });
  }
  const proofComplete = hasMilestone(
    TIDEGARDEN_SETTLEMENT_MILESTONES.relationshipAttended,
    actorId
  ) && hasMilestone(
    TIDEGARDEN_SETTLEMENT_MILESTONES.coreOnline,
    actorId
  ) && hasMilestone(
    TIDEGARDEN_SETTLEMENT_MILESTONES.shelterCertified,
    actorId
  );
  if (!proofComplete) return;
  once('settlement-certified', () => {
    runtime.completionObservedAt = runtime.elapsed;
    showCaption('(not a claim on the world. an address inside a relationship.)');
  });
  if (runtime.elapsed < runtime.completionObservedAt + 2.4) return;
  markMilestone(STORY_MILESTONES.ch9Settled, actorId);
  advanceToBeat('ch9-hearth');
}

function tickSecondHearth(): void {
  const actorId = getLocalActorId();
  const restCommitted = hasMilestone(
    TIDEGARDEN_SETTLEMENT_MILESTONES.safeRestCompleted,
    actorId
  );
  const handoffCommitted = hasMilestone(
    TIDEGARDEN_SETTLEMENT_MILESTONES.twoWorldHandoff,
    actorId
  );
  if (!restCommitted || !handoffCommitted) {
    activateSettlementGuidance(actorId);
    return;
  }
  publishGuidedObjective({
    id: 'settle:second-hearth-settling',
    kind: 'wait',
    markerLabel: 'SECOND HEARTH · SETTLING',
    workOrder: [
      'THE SECOND HEARTH IS SAFE.',
      'LET THE TWO-WORLD HANDOFF SETTLE.'
    ],
    requiresMarker: false
  });
  once('second-hearth-rest', () => {
    runtime.completionObservedAt = runtime.elapsed;
    setWorkOrder([]);
    setScoreIntensity(0.36);
    showCaption('(one fire behind you. one fire here. home is the distance you can keep alive.)', 6500);
  });
  if (runtime.elapsed < runtime.completionObservedAt + 5.5) return;
  completeStory();
}

// --- Chapter 10 -------------------------------------------------------------

/**
 * K7's reveal plus its settle: the answer may never land before the request has
 * finished painting. 55 chars at the shipped 22 ms/char REGULATION rate is
 * 1.21s; +0.15s settle gives the 1.36s the contract records as an inequality.
 * The score's own answer offset is asserted against this in the test seam, so a
 * future retune fails loudly instead of silently reordering the exchange.
 */
export const K7_REVEAL_GUARD_SECONDS = regulationRevealSeconds(K7) + 0.15;

export interface Chapter10ColdEntryFacts {
  /** Durable: the two-world arc finished. */
  storyComplete: boolean;
  /** Durable: free play was handed back at the second hearth. */
  twoWorldHandoff: boolean;
  onTidegarden: boolean;
  night: boolean;
  /** Metres from the second hearth's core, or null when no hearth exists. */
  hearthDistance: number | null;
  /** Accumulated `done` free-play seconds. */
  freePlaySeconds: number;
}

/**
 * The entry mechanism, as a pure predicate. The fault is NOTICED, not
 * announced: nothing fires anywhere the player is not, and if they never come
 * home at night the story waits indefinitely.
 */
export function chapter10ColdEntryReady(facts: Chapter10ColdEntryFacts): boolean {
  return facts.storyComplete
    && facts.twoWorldHandoff
    && facts.onTidegarden
    && facts.night
    && facts.hearthDistance !== null
    && facts.hearthDistance <= CH10_HEARTH_NOTICE_RADIUS
    && facts.freePlaySeconds >= CH10_FREEPLAY_GRACE_SECONDS;
}

const chapter10FreePlayWatch = { seconds: 0 };

export function resetChapter10FreePlayWatch(): void {
  chapter10FreePlayWatch.seconds = 0;
}

export function getChapter10FreePlaySeconds(): number {
  return chapter10FreePlayWatch.seconds;
}

/** Live read of the entry facts. Never mutates; safe to sample from a probe. */
export function readChapter10ColdEntryFacts(
  actorId: string = getLocalActorId()
): Chapter10ColdEntryFacts {
  const habitat = getHabitatWorldState(TIDEGARDEN_WORLD_ID);
  const corePosition = habitat
    ? new THREE.Vector3(...habitat.core.position)
    : null;
  return {
    storyComplete: hasMilestone(STORY_MILESTONES.complete, actorId),
    twoWorldHandoff: hasMilestone(
      TIDEGARDEN_SETTLEMENT_MILESTONES.twoWorldHandoff,
      actorId
    ),
    onTidegarden: getSystemFlightSnapshot().activePlanetId === TIDEGARDEN_WORLD_ID,
    night: isHabitatNight(getCurrentDayPhase()),
    hearthDistance: corePosition
      ? getPlayerWorldPosition().distanceTo(corePosition)
      : null,
    freePlaySeconds: chapter10FreePlayWatch.seconds
  };
}

/**
 * Accumulates the `done` free-play grace and re-activates the story when the
 * player is home, at night, at the hearth. Returns true on the frame chapter 10
 * opens.
 *
 * Free play runs with `story.active === false`, so the only module that can
 * host this is one that ticks on those frames: `StoryDirectorDriver.tsx` calls
 * it from its story-inactive branch, which is the one place the player is and
 * the story is not. Chapter 10 is also reachable by its deep links, the resume
 * ladder and the movie lane, all of which bypass this watch entirely.
 */
export function tickChapter10FreePlayEntry(dt: number): boolean {
  const story = getStoryStateSnapshot();
  if (story.active || story.beat !== 'done') return false;
  chapter10FreePlayWatch.seconds += Math.max(0, dt);
  const actorId = getLocalActorId();
  if (hasMilestone(STORY_MILESTONES.ch10ColdNoticed, actorId)) return false;
  if (!chapter10ColdEntryReady(readChapter10ColdEntryFacts(actorId))) return false;
  markMilestone(STORY_MILESTONES.ch10ColdNoticed, actorId);
  return reactivateStoryAtBeat('ch10-cold');
}

// --- ch10 receipts ----------------------------------------------------------
//
// The physical verbs of ch10-cold and the relay live on world surfaces that are
// outside this run's mutation boundary (`src/story/world/`, the interaction id
// union, the craft surfaces). These are the receipt seams those producers — and
// the movie lane's autopilot — commit through, so the ladder, the captions, the
// score anchors and the telemetry are all driven by one durable fact each,
// exactly as every shipped chapter drives itself.

/** [F] at the habitat core: read the machine's own account of itself. */
export function commitChapter10FaultRead(actorId: string = getLocalActorId()): boolean {
  if (runtime.beat !== 'ch10-cold') return false;
  if (hasMilestone(STORY_MILESTONES.ch10FaultRead, actorId)) return false;
  markMilestone(STORY_MILESTONES.ch10FaultRead, actorId);
  return true;
}

/** [F] at the Kestrel Fabricator: attempt a replacement, and be refused. */
export function commitChapter10FabricationAttempt(
  actorId: string = getLocalActorId()
): boolean {
  if (runtime.beat !== 'ch10-cold') return false;
  if (!hasMilestone(STORY_MILESTONES.ch10FaultRead, actorId)) return false;
  if (hasMilestone(STORY_MILESTONES.ch10FabricationRefused, actorId)) return false;
  markMilestone(STORY_MILESTONES.ch10FabricationRefused, actorId);
  return true;
}

/** [F] at the wreck relay: the game's first outbound request to another party. */
export function commitChapter10RelayRequest(
  actorId: string = getLocalActorId()
): boolean {
  if (runtime.beat !== 'ch10-ask') return false;
  if (hasMilestone(STORY_MILESTONES.ch10RelayAsked, actorId)) return false;
  markMilestone(STORY_MILESTONES.ch10RelayAsked, actorId);
  return true;
}

/**
 * [F] at the wreck relay: the agency peak. The story waits here forever — no
 * timeout, no nudge and no automation may claim on the player's behalf.
 */
export function commitChapter10BearingClaim(
  actorId: string = getLocalActorId()
): boolean {
  if (runtime.beat !== 'ch10-ask') return false;
  if (!hasMilestone(STORY_MILESTONES.ch10RelayAnswered, actorId)) return false;
  if (hasMilestone(STORY_MILESTONES.ch10BearingClaimed, actorId)) return false;
  const contact = spaceStationApproachGeometry();
  markMilestone(STORY_MILESTONES.ch10BearingClaimed, actorId);
  // The bearing is claimed BEFORE the target is committed, because the durable
  // milestone is the fence commitSpaceStationTarget tests in story worlds.
  if (contact) commitSpaceStationTarget(contact.body.address);
  return true;
}

const _ch10RelayFallback = new THREE.Vector3();
const _ch10StationMarker = new THREE.Vector3();

/**
 * The wreck relay's ground position, whether or not its prop is mounted.
 *
 * `wreckRelayHandle` is published by the WreckRelay component, and that
 * component's mount predicate (`StoryWorldProps.tsx#firstDayOrLater`) tests
 * chapter with a single-digit pattern, so it does not recognise ch10 — the
 * handle is therefore null through the whole ask beat. The pose itself is a
 * PURE function of the world's size and seed, so the marker resolves from the
 * same arithmetic the prop would have used, on the first world only, where that
 * arithmetic is the relay's. Routed as q-ch10-relay-prop-mount: the marker is
 * correct today, but the relay's own scenery is still absent from ch10 and its
 * mount predicate lives on a protected path.
 */
export function chapter10WreckSitePosition(): THREE.Vector3 | null {
  if (wreckRelayHandle.position) return wreckRelayHandle.position;
  if (getSystemFlightSnapshot().activePlanetId !== ORIGIN_WORLD_ID) return null;
  const planetSize = storyAnchors.planetSize;
  const terrainSeed = storyAnchors.terrainSeed;
  if (planetSize === null || terrainSeed === null) return null;
  return _ch10RelayFallback.copy(getWreckRelayPose(planetSize, terrainSeed).position);
}

/**
 * The station this run's bearing names, resolved from DURABLE state.
 *
 * The claim commits a systemFlight target, but that store is transient: a
 * `?story=ch10-transit` deep link and any reload seed `story:ch10-bearing-claimed`
 * without ever running the commit, so anything that read the store alone saw
 * nothing and the transit flew with no bearing at all. The system's stations are
 * a pure function of its seed, so the claimed one is recoverable: prefer the
 * committed target when the store has it, and otherwise reconstruct the same
 * body the claim would have committed. Null before the claim — the bearing is
 * the player's to earn and is never anticipated.
 */
export function chapter10ClaimedStationBody(actorId: string = getLocalActorId()) {
  if (!hasMilestone(STORY_MILESTONES.ch10BearingClaimed, actorId)) return null;
  const manifest = buildStarSystemManifest(STORY_COORDINATE);
  const bodies = systemSpaceStations(STORY_COORDINATE, manifest.systemSeed, 0);
  if (bodies.length === 0) return null;
  const target = getSystemFlightSnapshot().target;
  if (target?.kind === 'space_station') {
    const committed = bodies.find(candidate => candidate.worldId === target.worldId);
    if (committed) return committed;
  }
  return bodies[0];
}

/**
 * Re-commit the claimed bearing when the runtime arrived without it. Idempotent
 * and durable-milestone gated, so it can never invent a target the player has
 * not claimed, and a deep link, a reload and a continuous run all fly the same
 * bearing — the contract's reload-purity term applied to the flight store.
 */
export function reconcileChapter10StationTarget(actorId: string = getLocalActorId()): boolean {
  if (getSystemFlightSnapshot().target?.kind === 'space_station') return false;
  const body = chapter10ClaimedStationBody(actorId);
  if (!body) return false;
  commitSpaceStationTarget(body.address);
  return true;
}

/**
 * The committed station target's world position, from durable state rather than
 * from the approach instrument: the bearing is held for the whole transit, and
 * the instrument only speaks inside its own scan range.
 */
function chapter10StationTargetPosition(): THREE.Vector3 | null {
  const system = getSystemFlightSnapshot();
  const body = chapter10ClaimedStationBody();
  if (!body) return null;
  // Render space: the ship's own pose is the origin the player is drawn at.
  return _ch10StationMarker
    .set(
      body.systemPosition[0] - system.pose.position[0],
      body.systemPosition[1] - system.pose.position[1],
      body.systemPosition[2] - system.pose.position[2]
    )
    .add(getPlayerWorldPosition());
}

export interface Chapter10MarkerTarget {
  position: THREE.Vector3;
  label: string;
  projectionSpace?: 'surface' | 'spatial';
}

/**
 * World-space half of the chapter-10 objective contract.
 *
 * The shared marker must be present the FRAME a mandatory objective enters —
 * that is the lifecycle law, and a deep link is the path most likely to break
 * it, because the objective publishes from durable milestones while the world
 * is still arriving. Every target below therefore resolves from a handle that
 * already exists at publication time: the habitat core the bootstrap certified,
 * the Kestrel's own pose, the wreck relay planted at the crash site, and the
 * committed flight targets. If a handle is genuinely absent the answer is null
 * and the HUD says so honestly rather than pointing at nothing.
 */
export function getChapter10MarkerTarget(
  beat: StoryBeat | null,
  objective = getActiveGuidedStoryObjective()
): Chapter10MarkerTarget | null {
  if (!beat || !beat.startsWith('ch10') || !objective) return null;
  if (objective.requiresMarker === false) return null;
  const label = objective.markerLabel;
  switch (objective.id) {
    case 'station:fault-read': {
      const core = chapter10HabitatCorePosition();
      return core ? { position: core.clone(), label } : null;
    }
    case 'station:fabrication-attempt':
    case 'station:return:reboard': {
      const fabricator = chapter10FabricatorPosition();
      return fabricator ? { position: fabricator.clone(), label } : null;
    }
    case 'station:relay-query':
    case 'station:bearing-claim': {
      const relay = chapter10WreckSitePosition();
      return relay ? { position: relay.clone(), label } : null;
    }
    case 'station:return:crossing': {
      // The crossing back is ch8's grammar in the opposite direction, so it
      // borrows ch8's marker treatment exactly: a spatial bearing, not a
      // surface route.
      const origin = readSystemCompanionBodyTarget(ORIGIN_WORLD_ID);
      return origin ? { position: origin, label, projectionSpace: 'spatial' } : null;
    }
    case 'station:return:landfall': {
      // The descent goal is the wreck site itself, read as a bearing rather
      // than a surface route: the player is still in the air.
      const site = chapter10WreckSitePosition();
      return site ? { position: site.clone(), label, projectionSpace: 'spatial' } : null;
    }
    case 'station:transit:hold': {
      const station = chapter10StationTargetPosition();
      return station
        ? { position: station.clone(), label, projectionSpace: 'spatial' }
        : null;
    }
    default:
      return null;
  }
}

// --- ch10 player verbs ------------------------------------------------------
//
// Four prompts, one resolver, registered once. Every one of them reads the live
// beat and the durable milestones and resolves from a handle that already
// exists, so a prompt can never appear before the thing it names does. The
// perform bodies are the receipt seams above: the prompt licenses the act, the
// receipt records it, and the tick owns every consequence.

const CH10_CORE_INTERACT_DISTANCE = 4.2;
const CH10_FABRICATOR_INTERACT_DISTANCE = 6;
const CH10_RELAY_INTERACT_DISTANCE = 4.2;

let chapter10InteractionsInstalled = false;

function withinChapter10Reach(
  position: THREE.Vector3,
  target: THREE.Vector3 | null,
  distance: number
): boolean {
  return target !== null && position.distanceTo(target) <= distance;
}

const _ch10InteractionTarget = new THREE.Vector3();

function chapter10HabitatCorePosition(): THREE.Vector3 | null {
  const habitat = getHabitatWorldState(TIDEGARDEN_WORLD_ID);
  return habitat ? _ch10InteractionTarget.set(...habitat.core.position) : null;
}

function chapter10FabricatorPosition(): THREE.Vector3 | null {
  // The fabricator is the Kestrel's own, carried since chapter 7.
  const ship = getShipPosition();
  return ship ? _ch10InteractionTarget.set(ship[0], ship[1], ship[2]) : null;
}

function ensureChapter10Interactions(): void {
  if (chapter10InteractionsInstalled) return;
  chapter10InteractionsInstalled = true;
  registerStoryInteraction((_camera, position) => {
    const actorId = getLocalActorId();
    switch (runtime.beat) {
      case 'ch10-cold': {
        if (!hasMilestone(STORY_MILESTONES.ch10FaultRead, actorId)) {
          return withinChapter10Reach(position, chapter10HabitatCorePosition(), CH10_CORE_INTERACT_DISTANCE)
            ? {
                id: 'story-ch10-fault-read',
                verb: 'Read the hearth fault',
                perform: () => { commitChapter10FaultRead(actorId); }
              }
            : null;
        }
        if (hasMilestone(STORY_MILESTONES.ch10FabricationRefused, actorId)) return null;
        return withinChapter10Reach(position, chapter10FabricatorPosition(), CH10_FABRICATOR_INTERACT_DISTANCE)
          ? {
              id: 'story-ch10-fabrication-attempt',
              // Reads the same as the amended work order's action, so the
              // prompt and the card name one act in one voice.
              verb: 'Attempt to fabricate a replacement cell',
              perform: () => { commitChapter10FabricationAttempt(actorId); }
            }
          : null;
      }
      case 'ch10-ask': {
        const relay = wreckRelayHandle.position;
        if (!withinChapter10Reach(position, relay, CH10_RELAY_INTERACT_DISTANCE)) return null;
        if (hasMilestone(STORY_MILESTONES.ch10RelayAnswered, actorId)) {
          // The rite. It waits here indefinitely and is only ever performed.
          return hasMilestone(STORY_MILESTONES.ch10BearingClaimed, actorId)
            ? null
            : {
                id: 'story-ch10-bearing-claim',
                verb: 'Claim the bearing',
                perform: () => { commitChapter10BearingClaim(actorId); }
              };
        }
        if (hasMilestone(STORY_MILESTONES.ch10RelayAsked, actorId)) return null;
        return {
          id: 'story-ch10-relay-query',
          verb: 'Request a source for a bonded cell',
          perform: () => { commitChapter10RelayRequest(actorId); }
        };
      }
      default:
        return null;
    }
  }, { owner: 'ch10-station-introduction' });
}

// --- ch10 ticks -------------------------------------------------------------

function tickChapter10Cold(): void {
  const actorId = getLocalActorId();
  if (hasMilestone(STORY_MILESTONES.ch10FaultRead, actorId)) {
    once('ch10-fault-read', () => {
      runtime.ch10FaultReadAt = runtime.elapsed;
      noteChapter10Anchor('anc.ch10.fault-read');
      showAuditLine(K2);
    });
  }
  if (runtime.ch10FaultReadAt >= 0) {
    // The record is two REGULATION lines and one low answer, spaced off their
    // own derived reveals so the single band never cuts a line.
    const sinceRecord = runtime.elapsed - runtime.ch10FaultReadAt;
    const k3At = regulationRevealSeconds(K2) + CH10_REGULATION_DWELL_SECONDS;
    if (sinceRecord >= k3At) once('ch10-k3', () => showAuditLine(K3));
    if (sinceRecord >= k3At + regulationRevealSeconds(K3) + CH10_REGULATION_DWELL_SECONDS) {
      once('ch10-k4', () => showCaption(K4));
    }
  }
  if (!hasMilestone(STORY_MILESTONES.ch10FabricationRefused, actorId)) return;
  once('ch10-refused', () => {
    runtime.ch10RefusedAt = runtime.elapsed;
    runtime.completionObservedAt = runtime.elapsed;
    // Refusal as subtraction: the square fifth answers once and stops, and the
    // melody voice does not return for the remainder of the beat.
    noteChapter10Anchor('anc.ch10.fabrication-refused');
    showAuditLine(K5, CH10_FABRICATOR_HEADER);
  });
  // K6 paints at ch10-ask entry, so the beat may not advance before K5 has been
  // read: the boundary waits on the line, never the other way round.
  if (runtime.elapsed < runtime.completionObservedAt
    + regulationRevealSeconds(K5) + CH10_REGULATION_DWELL_SECONDS) return;
  // The checkpoint is committed at the boundary itself, adjacent to the
  // advance: the receipt above records the player's act the instant it happens,
  // and this idempotent re-commit is what makes "checkpoint, then advance" one
  // inspectable transition rather than two facts separated by a read delay.
  markMilestone(STORY_MILESTONES.ch10FabricationRefused, actorId);
  advanceToBeat('ch10-ask');
}

function tickChapter10Ask(): void {
  const actorId = getLocalActorId();
  if (hasMilestone(STORY_MILESTONES.ch10RelayAsked, actorId)) {
    once('ch10-relay-ask', () => {
      runtime.ch10AnswerAt = runtime.elapsed + chapter10RelayAnswerDelaySeconds();
      noteChapter10Anchor('anc.ch10.relay-ask');
      showAuditLine(K7, CH10_RELAY_HEADER);
    });
  }
  if (runtime.ch10AnswerAt >= 0 && runtime.elapsed >= runtime.ch10AnswerAt) {
    once('ch10-relay-answer', () => {
      // ONE anchor, two consumers, same frame: K8's paint-begin and the answer
      // figure's audio onset. Never tuned offsets — the simultaneity is the
      // shared anchor itself, and the wrongness is metric, not dynamic.
      markMilestone(STORY_MILESTONES.ch10RelayAnswered, actorId);
      noteChapter10Anchor('anc.ch10.relay-answer');
      showAuditLine(K8, CH10_RELAY_HEADER);
    });
    if (runtime.elapsed >= runtime.ch10AnswerAt + regulationRevealSeconds(K8)) {
      once('ch10-k9', () => showCaption(K9));
    }
  }
  if (!hasMilestone(STORY_MILESTONES.ch10BearingClaimed, actorId)) return;
  once('ch10-bearing-claimed', () => {
    runtime.completionObservedAt = runtime.elapsed;
    noteChapter10Anchor('anc.ch10.bearing-claimed');
    showCaption(K10);
  });
  if (runtime.elapsed < runtime.completionObservedAt + revealSeconds(K10)) return;
  markMilestone(STORY_MILESTONES.ch10BearingClaimed, actorId);
  advanceToBeat('ch10-transit');
}

/**
 * The seam of light, as a pure edge. Both trigger paths are the same latch: the
 * composed view-cone reveal is preferred, the look-independent range is the
 * floor, and either one records the SAME durable milestone so the resolver and
 * the signed rail can never disagree about whether the seam happened.
 */
export interface Chapter10SeamFacts {
  atmosphereSpaceBlend: number;
  /** Degrees between view center and the committed target; null when unknown. */
  stationOffAxisDeg: number | null;
  /** Distance to the station; null when it is not on instruments. */
  stationDistance: number | null;
}

export function chapter10SeamConditionMet(facts: Chapter10SeamFacts): boolean {
  if (!(facts.atmosphereSpaceBlend >= SEAM_OF_LIGHT_MIN_BLEND)) return false;
  const withinCone = facts.stationOffAxisDeg !== null
    && facts.stationOffAxisDeg <= SEAM_VIEW_CONE_DEG;
  const withinFallback = facts.stationDistance !== null
    && facts.stationDistance <= SEAM_FALLBACK_RANGE;
  return withinCone || withinFallback;
}

const _stationBearing = new THREE.Vector3();

export function readChapter10SeamFacts(): Chapter10SeamFacts {
  const flight = getSpaceFlightSnapshot();
  const contact = spaceStationApproachGeometry();
  // Deep space pins the blend at 1: any point inside SEAM_FALLBACK_RANGE of the
  // station is more than 1,700 units off the nearest world by construction.
  const blend = flight.phase === 'deep_space' ? 1 : 0;
  if (!contact) {
    return { atmosphereSpaceBlend: blend, stationOffAxisDeg: null, stationDistance: null };
  }
  const pose = getSystemFlightSnapshot().pose;
  _stationBearing.set(
    contact.body.systemPosition[0] - pose.position[0],
    contact.body.systemPosition[1] - pose.position[1],
    contact.body.systemPosition[2] - pose.position[2]
  );
  const forward = getPlayerLook().forward;
  const offAxisDeg = _stationBearing.lengthSq() > 1e-6
    ? THREE.MathUtils.radToDeg(_stationBearing.normalize().angleTo(forward))
    : 0;
  return {
    atmosphereSpaceBlend: blend,
    stationOffAxisDeg: offAxisDeg,
    stationDistance: contact.readout.distance
  };
}

function tickChapter10Transit(dt: number): void {
  const actorId = getLocalActorId();
  // The bearing before anything else: a deep link or a reload arrives holding
  // the durable claim with an empty flight store, and everything downstream —
  // the marker, the boundary telemetry, the movie lane's attitude — reads that
  // target. Idempotent, so a continuous run pays nothing.
  reconcileChapter10StationTarget(actorId);
  const flight = getSpaceFlightSnapshot();
  if (flight.controlMode === 'flight' && flight.phase !== 'surface') {
    once('ch10-transit-ignite', () => {
      markMilestone(STORY_MILESTONES.ch10TransitIgnited, actorId);
      noteChapter10Anchor('anc.ch10.transit-ignite');
    });
  }
  if (!hasMilestone(STORY_MILESTONES.ch10TransitIgnited, actorId)) return;

  // THE LATCH. Once fired it never un-fires inside the beat, regardless of look
  // direction, blend or distance; the durable milestone is what makes a
  // mid-transit reload re-enter the post-seam state without re-firing.
  if (!hasMilestone(STORY_MILESTONES.ch10SeamPassed, actorId)
    && chapter10SeamConditionMet(readChapter10SeamFacts())) {
    markMilestone(STORY_MILESTONES.ch10SeamPassed, actorId);
    noteChapter10Anchor('anc.ch10.seam-of-light');
  }
  // ORDERING INVARIANT: the resolve cannot fire while the seam is unset. Motion
  // is continuous and the standoff is strictly inside the fallback range, so
  // every possible flight passes the seam strictly earlier — this guard makes
  // that geometric truth an executable one.
  if (!hasMilestone(STORY_MILESTONES.ch10SeamPassed, actorId)) return;

  const contact = spaceStationApproachGeometry();
  if (contact && contact.readout.distance <= STATION_STANDOFF_DISTANCE) {
    once('ch10-station-resolved', () => {
      runtime.ch10ResolvedAt = runtime.elapsed;
      markMilestone(STORY_MILESTONES.ch10StationResolved, actorId);
      // The hold begins at the anchor + 0 and K11 keys off the anchor directly,
      // so the text never waits on the score's quantize choice.
      noteChapter10Anchor('anc.ch10.station-resolved');
      setStoryMoveScale(0);
      showCaption(K11, 6500);
    });
  }
  if (runtime.ch10ResolvedAt < 0) return;
  if (runtime.elapsed < runtime.ch10ResolvedAt + HOLD_DURATION_MS / 1000) return;
  once('ch10-threshold-handback', () => {
    // Mandatory, visible hand-back: thrust re-arms, guidance clears to nothing,
    // and free play resumes in space with the bearing held and no way in.
    setStoryMoveScale(1);
    setWorkOrder([]);
    clearGuidedStoryObjective();
    noteChapter10Anchor('anc.ch10.threshold-handback');
    completeChapter10();
  });
  void dt;
}

/**
 * Building remains owned by the normal command lane. This adapter translates
 * only its accepted Tidegarden foundation receipt into Story vocabulary; it
 * cannot infer a foundation from selected UI state or an attempted placement.
 */
function ensureFinalizedLocalCommandStoryAdapter(): void {
  if (finalizedLocalCommandStoryAdapterInstalled) return;
  finalizedLocalCommandStoryAdapterInstalled = true;
  subscribeFinalizedLocalGameplayCommand(result => {
    if (runtime.beat !== 'ch9-settle') return;
    const actorId = getLocalActorId();
    for (const event of result.events) {
      if (
        event.type !== 'structure_placed'
        || event.worldId !== TIDEGARDEN_WORLD_ID
        || event.actorId !== actorId
      ) continue;
      const payload = foundationPlacementPayload(event.payload);
      if (!payload || !tidegardenFoundationMatchesSiteChoice(actorId, payload.cell)) continue;
      emitEmergentStoryEvent({
        id: `story:settle:${actorId}:foundation:${event.eventId}`,
        type: 'settlement_foundation_placed',
        actorId,
        worldId: event.worldId,
        occurredAt: event.timeMs,
        payload: {
          transactionEventId: event.eventId,
          ...payload
        }
      });
    }
  });
}

function foundationPlacementPayload(value: unknown): {
  cell: [number, number, number];
  face: number;
  material: string;
} | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const payload = value as Record<string, unknown>;
  if (
    payload.type !== 'foundation'
    || !Array.isArray(payload.cell)
    || payload.cell.length !== 3
    || !payload.cell.every(coordinate => Number.isInteger(coordinate))
    || !Number.isInteger(payload.face)
    || typeof payload.material !== 'string'
    || payload.material.length === 0
  ) return null;
  return {
    cell: [payload.cell[0] as number, payload.cell[1] as number, payload.cell[2] as number],
    face: payload.face as number,
    material: payload.material
  };
}

function once(id: string, action: () => void): void {
  if (runtime.latches.has(id)) return;
  runtime.latches.add(id);
  action();
}

/**
 * World-space half of the shared objective contract for the audit/refusal
 * sequence. The DOM card and edge marker both read the same progression stage;
 * the worker's locomotion reuses these exact target resolvers below.
 */
export function getEmergentStoryMarkerTarget(
  beat: StoryBeat | null,
  actorId: string = getLocalActorId()
): THREE.Vector3 | null {
  switch (beat) {
    case 'ch4-audit':
      return currentAuditTarget(actorId)?.position ?? null;
    case 'ch4-comply':
      return currentComplianceTarget(actorId)?.position ?? null;
    case 'ch4-defy':
      return heroTreeHandle.position;
    default:
      return null;
  }
}

function currentAuditTarget(actorId: string): { key: string; position: THREE.Vector3 } | null {
  if (!hasMilestone(EMERGENT_AUDIT_MILESTONES.fireMismatch, actorId)) {
    const fire = getCampfires()[0];
    return fire ? { key: 'audit-fire', position: tupleVector(fire.pos) } : null;
  }
  if (!hasMilestone(EMERGENT_AUDIT_MILESTONES.lifeMismatch, actorId)) {
    return storyAnchors.pond ? { key: 'audit-life', position: storyAnchors.pond.shore } : null;
  }
  if (!hasMilestone(EMERGENT_AUDIT_MILESTONES.treeMismatch, actorId)) {
    return heroTreeHandle.position ? { key: 'audit-tree', position: heroTreeHandle.position } : null;
  }
  return null;
}

function currentComplianceTarget(actorId: string): { key: string; position: THREE.Vector3 } | null {
  if (!hasMilestone(EMERGENT_AUDIT_MILESTONES.fireComplied, actorId)) {
    const fire = getCampfires()[0];
    return fire ? { key: 'comply-fire', position: tupleVector(fire.pos) } : null;
  }
  if (!hasMilestone(EMERGENT_AUDIT_MILESTONES.organicsComplied, actorId)) {
    return wreckRelayHandle.position ? { key: 'comply-organics', position: wreckRelayHandle.position } : null;
  }
  return null;
}

/**
 * W-7744 uses the same dry A* surface contract and grounded step sampler as the
 * movie agent. A terrain edit replans from his current validated root; no lerp
 * ever cuts through water, a voxel, or a height discontinuity.
 */
function moveAuditor(
  dt: number,
  target: { key: string; position: THREE.Vector3 } | null
): void {
  const size = storyAnchors.planetSize;
  const seed = storyAnchors.terrainSeed;
  const worker = getAuditWorkerPose();
  if (!target || size === null || seed === null || !worker.visible) {
    worker.walk = 0;
    resetAuditRoute();
    return;
  }
  const terrain = createLiveAgentSurfaceTerrain(size, seed, ORIGIN_WORLD_ID);
  if (auditRoute.key !== target.key || auditRoute.terrainRevision !== terrain.revision) {
    const planned = planAgentSurfaceRoute(terrain, size, worker.position, target.position, {
      face: 'top',
      differentFaceFallback: 'unreachable',
      clearanceCells: 2,
      maxSlopeCells: 1,
      edgeMarginCells: 1,
      maxVisitedCells: 8192,
      waypointClearanceWorld: 1.05,
      allowJetpackCrossing: false
    });
    auditRoute.key = target.key;
    auditRoute.terrainRevision = terrain.revision;
    auditRoute.route = planned.mode === 'walk' || planned.mode === 'direct'
      ? planned.waypoints.map(position => ({ position }))
      : [];
    auditRoute.distance = 0;
    auditRoute.length = groundedSurfaceRouteLength(auditRoute.route, worker.up);
  }
  if (auditRoute.route.length === 0 || auditRoute.length <= 0.01) {
    worker.walk = 0;
    return;
  }
  auditRoute.distance = Math.min(auditRoute.length, auditRoute.distance + dt * AUDITOR_WALK_SPEED);
  sampleGroundedSurfaceRoute(
    auditRoute.route,
    auditRoute.distance,
    worker.up,
    auditRoute.sample
  );
  worker.position.copy(auditRoute.sample.position);
  if (auditRoute.sample.heading.lengthSq() > 1e-6) {
    turnGroundedHeadingToward(
      worker.heading,
      auditRoute.sample.heading,
      worker.up,
      AUDITOR_TURN_SPEED * dt
    );
  }
  worker.stride = auditRoute.sample.distance;
  worker.walk = auditRoute.distance < auditRoute.length ? 1 : 0;
}

function resetAuditRoute(): void {
  auditRoute.key = null;
  auditRoute.terrainRevision = null;
  auditRoute.route = [];
  auditRoute.distance = 0;
  auditRoute.length = 0;
}

function tupleVector(value: readonly [number, number, number]): THREE.Vector3 {
  return new THREE.Vector3(value[0], value[1], value[2]);
}

function a4FocusTarget(): THREE.Vector3 | null {
  if (runtime.elapsed < 4.2) return heroTreeHandle.position;
  if (runtime.elapsed < 6.8) return storyAnchors.pond?.surface ?? heroTreeHandle.position;
  return storyAnchors.fieldPack?.position ?? heroTreeHandle.position;
}

function smoothstep(value: number): number {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

function sceneEnvelope(time: number, inStart: number, inEnd: number, outStart: number, outEnd: number): number {
  const fadeIn = smoothstep((time - inStart) / Math.max(0.001, inEnd - inStart));
  const fadeOut = 1 - smoothstep((time - outStart) / Math.max(0.001, outEnd - outStart));
  return Math.min(fadeIn, fadeOut);
}
