import * as THREE from 'three';
import {
  clearVoxelRealityOverrides,
  overrideVoxelRealityEffects,
  setVoxelRealityStage,
  VOXEL_REALITY_PRESETS
} from '../game/systems/realityRenderSystem.ts';
import { getMilestones, hasMilestone, markMilestone } from '../game/systems/progressionSystem.ts';
import { getItemCount, hasItems } from '../game/systems/inventorySystem.ts';
import { isTreeHarvested } from '../game/systems/treeHarvest.ts';
import { isFloraHarvested } from '../game/systems/floraHarvest.ts';
import { isStoneCollected } from '../game/systems/stonePickup.ts';
import { getPieces } from '../game/systems/structureSystem.ts';
import { getRecipe } from '../game/data/recipes.ts';
import type { ItemId } from '../game/data/items.ts';
import { getCampfires, subscribeCampfires } from '../game/systems/campfires.ts';
import { getVitals, isStaminaExhausted, setVitals } from '../game/systems/survivalVitals.ts';
import { getWaterskinFill } from '../game/systems/consumeSystem.ts';
import { addMawCharge, getMawCharge, MAX_MAW_CHARGE, setMawCharge } from '../game/systems/mawSystem.ts';
import { getMiningProgress } from '../game/systems/miningProgress.ts';
import { playSfx } from '../audio/sfxEngine.ts';
import { DAY_LENGTH_SECONDS, getCurrentDayPhase, setDayPhaseOffset } from '../game/worldClock.ts';
import {
  advanceToBeat,
  getStoryStateSnapshot,
  STORY_MILESTONES,
  subscribeStory,
  type StoryBeat
} from './storyState.ts';
import { registerStoryInteraction } from './storyInteractions.ts';
import {
  getStoryInputPolicy,
  setStoryLookMode,
  setStoryMoveScale,
  setStorySideBlend,
  setStoryTargetDpr,
  setStoryTargetFov,
  FEED_FOV,
  SANDBOX_FOV
} from './storyInputPolicy.ts';
import {
  fixedScreenCellIndex,
  getSideFacing,
  getSideLens,
  setLensRig,
  SIDE_RIG,
  type LensRig
} from './sideLens.ts';
import { getPlayerLook, getPlayerUp, getPlayerWorldPosition } from '../state/playerFrame.ts';
import { readSystemCompanionBodyTarget } from '../state/systemCompanionBodyTargets.ts';
import { getLocalActorId } from '../game/playerActors.ts';
import { getSunDirection } from '../components/SkyController.tsx';
import { treeFieldHandle } from '../components/TreeField.tsx';
import { floraFieldHandle } from '../components/FloraField.tsx';
import { looseStoneHandle } from '../components/LooseStoneField.tsx';
import { nearestForageNodeWorld } from '../components/ForageField.tsx';
import { dominantFaceForPosition } from '../utils/surfaceControls.ts';
import { voxelCoordToWorld } from '../utils/cubeGravityConstants.ts';
import { setConstellationReveal } from './skyMeaning.ts';
import { hifiWreckHandle } from './world/hifiWreck.ts';
import { isSpawnSettled } from '../game/spawnSettle.ts';
import { clearLifeReveal, setLifeReveal } from '../game/lifeReveal.ts';
import { backfillLegacyDebrisStone, debrisSalvageComplete } from './debrisSalvage.ts';
import { supplyPodsComplete } from './supplyPods.ts';
import {
  currentNavWaypointIndex,
  navWaypointsComplete,
  NAV_WAYPOINT_COUNT,
  resetNavWaypoints
} from './navWaypoints.ts';
import { signalMesaHandle } from './world/SignalMesa.tsx';
import { wreckRelayHandle } from './world/WreckRelay.tsx';
import { getAuditWorkerPose, hideAuditWorker } from './world/AuditWorker.tsx';
import {
  getAuditWorkerPath,
  getKeelMemoryPose,
  storyAnchors
} from './world/storyWorld.ts';
import { createLiveAgentSurfaceTerrain } from '../utils/agentSurfaceNavigationRuntime.ts';
import { STORY_PRIMARY_WORLD_ID, TIDEGARDEN_WORLD_ID } from './tidegardenRoute.ts';
import { getAuthoredDiveGuidance } from './emergentDive.ts';
import { getAuthoredMawGuidance } from './emergentMawRepair.ts';
import { getWreckReconstructionGuidance } from './wreckReconstruction.ts';
import {
  getPhysicalBoardingGuidance,
  getPhysicalBoardingSnapshot,
  hasSealedPhysicalBoarding
} from './physicalBoarding.ts';
import {
  createTidegardenRelationshipProof,
  getTidegardenChosenHabitatSite,
  getTidegardenSettlementGuidance
} from './tidegardenSettlement.ts';
import { findEmergentMovieHabitatGoal } from './emergentMovieRuntime.ts';
import { getHabitatWorldState } from '../game/systems/habitatSystem.ts';
import { getShipRepairStage } from '../game/systems/shipRestoration.ts';
import {
  hasFirstHoverGroundedReturn,
  hasFirstLegalHoverReceipt
} from './reconstructionEmbodiment.ts';
import {
  getReconstructionCalibrationSnapshot,
  hasReconstructionCalibrationReceipt
} from './reconstructionCalibration.ts';
import {
  enterEmergentScoreBeat,
  hydrateChapter7BoardingScore,
  type Chapter7ReconstructionScoreFacts
} from './emergentScoreDirector.ts';
import {
  easedGroundedTravelProgress,
  groundedSurfaceRouteLength,
  sampleGroundedSurfaceRoute,
  turnGroundedHeadingToward,
  type GroundedSurfaceSample
} from '../utils/groundedSurfaceMotion.ts';
import { STORY_TASK_ROW_DEPTH_BAND } from './taskRowNavigation.ts';
import { setStoryForcedDayPhase } from './storyDayPhase.ts';
import { isStoryPaused } from './storyClock.ts';
import {
  clearCinematicCameraPose,
  setCinematicCameraPose,
  setCinematicLookTarget,
  setCinematicLookWeight
} from './cinematicLook.ts';
import {
  arrivalCameraWeightAt,
  arrivalFovAt,
  arrivalLookWeightAt,
  computeArrivalCameraFrame
} from './arrivalCinematography.ts';
import {
  DUSK_CINEMATIC,
  computeDuskFireCameraFrame,
  computeDuskGazeTarget,
  duskCinematicStateAt
} from './duskCinematography.ts';
import { getFeedRuntime, resetFeedRuntime } from './feedRuntime.ts';
import {
  clearViolations,
  getStoryText,
  pushViolation,
  setWorkOrder,
  showAuditLine,
  showCaption,
  showSystemLine
} from './storyText.ts';
import {
  A1_RAMP_SECONDS,
  A2_CAPTIONS,
  A2_TIMELINE,
  A2_VIOLATION_LINES,
  A3_CAPTIONS,
  A3_TIMELINE,
  ANOMALY_SURVEY,
  ARRIVAL,
  ARRIVAL_CAPTIONS,
  ARRIVAL_LINES,
  CH1_ANOMALY_MASS_ORDER,
  CH1_ECHO_LINES,
  CH1_FIXED_CAPTIONS,
  CH1_FIXED_CUT_CAPTION,
  CH1_FLASH_SCHEDULE,
  CH1_FIXED_TUTORIAL,
  CH1_QUOTA,
  CH1_WORK_ORDERS,
  CH3_CAPTIONS,
  DUSK,
  FIRST_DAY,
  FIRST_DAY_CAPTIONS,
  GRAVITY_EDGE,
  MUSING_GAP_SECONDS,
  MUSINGS,
  SHIP_LOOK,
  SIGNAL,
  SIGNAL_LINES,
  STARGAZE,
  VIGIL,
  VIGIL_LINES,
  VOYAGE_DECK
} from './storyScript.ts';
import { complianceToneLine, getArrivalCellCharge } from './voyageOutcome.ts';
import { scoreHit, setScoreBeat, setScoreIntensity } from './storyScore.ts';
import {
  emergentStoryDirectorTick,
  enterEmergentStoryBeat,
  getEmergentStoryMarkerTarget
} from './emergentStoryDirector.ts';
import {
  activateGuidedStoryObjective,
  getActiveGuidedStoryObjective
} from './ux/objectiveDirector.ts';
import {
  resolveStoryObjectiveGuidance,
  type GatherObjectiveStage,
  type RestObjectivePhase,
  type VigilObjectivePhase
} from './storyObjectiveGuidance.ts';

// --- The story director -------------------------------------------------------------
//
// Non-React beat state machine + scripted timelines. Beat ENTRY side effects
// (work orders, runtime resets) fire from the story subscription; per-frame work
// (glitch flashes, the A1 chroma ramp, FOV easing, the feed frame counter) runs
// in tick(), called by the in-Canvas StoryDirectorDriver so shader uniforms and
// DOM overlay values land on the same frame.

// Deterministic flicker mask (mulberry32) so the A1 ramp is identical every run.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface DirectorRuntime {
  beat: StoryBeat | null;
  beatClock: number;
  /** Seconds of ch1 gameplay (drives the flash schedule). */
  ch1Clock: number;
  flashesFired: boolean[];
  flashFramesLeft: number;
  glitchDecay: number;
  a1FlickerNoise: () => number;
  /** A2 sub-state: next violation timestamp + one-shot latches. */
  a2NextViolationAt: number;
  a2ViolationIndex: number;
  a2HudDead: boolean;
  /** One-shot caption latches (keyed on beat + index). */
  captionsFired: Set<string>;
  /** Story-driven day phase (the director owns the sun until completion). */
  dayPhase: number;
  /** A3 one-shot: the dark-of-sleep world mutations fired. */
  a3Woke: boolean;
  /** A3 bloom-wave origin (captured at the ramp; zero until then). */
  bloomCenter: THREE.Vector3;
  /** Narrative elapsed time. Advances only while Story playback is live. */
  elapsedSeconds: number;
  /** Raw R3F/world elapsed time, used only to release the world clock cleanly. */
  worldElapsedSeconds: number;
  restUnregister: (() => void) | null;
  /** Fractional harvester recharge carried between ticks (flushed whole points). */
  mawRechargeAccum: number;
  /** descent one-shot: the impact flash/sfx fired. */
  descentImpacted: boolean;
  /** ch1-fixed tutorial: distinct fixed-screen cells the worker has stood in. */
  fixedCells: Set<number>;
  /** ch1-fixed: the cell currently on camera (null until the lens reports) —
   *  a change is a camera CUT: static blip + the HUD's SITE CAM tag flips. */
  fixedCamCell: number | null;
  /** Beat-clock stamps for the final pickup in each profile collection act. */
  rasterCompleteAt: number;
  depthCompleteAt: number;
  /** ch1-lift one-shot: the mid-lift dpr snap + glitch mask fired. */
  liftSnapped: boolean;
  /** Scratch target for the lift's look-ahead pull. */
  liftLookTarget: THREE.Vector3;
  // --- the first day alive / chapter 4 ---
  /** Vitals from the previous tick (a discrete RISE = drank / ate). */
  prevThirst: number;
  prevHunger: number;
  /** Waterskin fill last tick (a rise from 0 = the first fill). */
  prevWaterskin: number;
  /** Musing lull tracking: elapsedSeconds of the last caption + current gap. */
  lastCaptionAt: number;
  musingGap: number;
  /** ch3-signal / ch4-vigil: the phase each lerp departs from. */
  signalPhaseFrom: number;
  vigilPhaseFrom: number;
  signalKlaxons: number;
  /** ch3-forage: beat-clock time of the first meal (-1 = not yet). */
  forageAteAt: number;
  /** ch1-anomaly staging: sweep sectors seen; true once the mass is designated. */
  anomalySectorsSeen: Set<number>;
  anomalyMassStage: boolean;
  /** Beat-clock time of the designation (-1 = not yet) — arms the touch. */
  anomalyDesignatedAt: number;
  /** ch1-anomaly gravity-edge crossing: beat-clock of the cross (-1 = not yet),
   *  arms the feed gloss GRAVITY_EDGE.feedDelaySeconds later. */
  gravityEdgeAt: number;
  /** ch3-gather campfire teaching chain latches (the flint-skip branch). */
  gatherSkipDecided: boolean;
  gatherSkipFlint: boolean;
  /** Flint held when the flint prompt fired (flintFound waits for a NEW flint). */
  gatherFlintAtPrompt: number;
  /** Ship first-look: cone-hold accumulator + the signal-line fallback stamp. */
  shipLookHeld: number;
  shipLookFallbackAt: number;
  /** ch4-vigil stargaze staging. */
  vigilNightAt: number;
  vigilLookHeld: number;
  stargazeStart: number;
  constellationRampStart: number;
  /** ch4-arrival one-shots. */
  arrivalWoke: boolean;
  /** Live terrain/edit revision that owns the grounded auditor route. */
  arrivalRouteRevision: string | null;
  /** 2-frame BARE drop (the auditor's eyes) — inverse of the chroma flash. */
  bareFramesLeft: number;
  /** Scratch for the auditor's walk. */
  workerScratch: THREE.Vector3;
}

function createDirectorRuntime(): DirectorRuntime {
  return {
    beat: null,
    beatClock: 0,
    ch1Clock: 0,
    flashesFired: CH1_FLASH_SCHEDULE.map(() => false),
    flashFramesLeft: 0,
    glitchDecay: 0,
    a1FlickerNoise: mulberry32(0x7c07),
    a2NextViolationAt: 0,
    a2ViolationIndex: 0,
    a2HudDead: false,
    captionsFired: new Set(),
    dayPhase: 0.25,
    a3Woke: false,
    bloomCenter: new THREE.Vector3(),
    elapsedSeconds: 0,
    worldElapsedSeconds: 0,
    restUnregister: null,
    mawRechargeAccum: 0,
    descentImpacted: false,
    fixedCells: new Set(),
    fixedCamCell: null,
    rasterCompleteAt: -1,
    depthCompleteAt: -1,
    liftSnapped: false,
    liftLookTarget: new THREE.Vector3(),
    prevThirst: -1,
    prevHunger: -1,
    prevWaterskin: -1,
    lastCaptionAt: 0,
    musingGap: MUSING_GAP_SECONDS[0],
    signalPhaseFrom: 0.25,
    vigilPhaseFrom: 0.42,
    signalKlaxons: 0,
    forageAteAt: -1,
    anomalySectorsSeen: new Set(),
    anomalyMassStage: false,
    anomalyDesignatedAt: -1,
    gravityEdgeAt: -1,
    gatherSkipDecided: false,
    gatherSkipFlint: false,
    gatherFlintAtPrompt: -1,
    shipLookHeld: 0,
    shipLookFallbackAt: -1,
    vigilNightAt: -1,
    vigilLookHeld: 0,
    stargazeStart: -1,
    constellationRampStart: -1,
    arrivalWoke: false,
    arrivalRouteRevision: null,
    bareFramesLeft: 0,
    workerScratch: new THREE.Vector3()
  };
}

let d = createDirectorRuntime();

/** Seconds since the current beat began (survey dwells, resolver gates). */
export function getStoryBeatClock(): number {
  return d.beatClock;
}

/**
 * The ch3 chill (story-scoped temperature model — the sandbox holds warmth
 * full until a real model lands): warmth drains in the open, recovers fast
 * beside a fire, and never becomes lethal (floor well above zero). The fire is
 * built BECAUSE of this — the stat appears already falling.
 */
function tickStoryChill(dt: number, drainPerSecond: number): void {
  if (!hasMilestone(STORY_MILESTONES.senseTemp)) return;
  const v = getVitals();
  if (nearCampfire(getPlayerWorldPosition())) {
    if (v.warmth < 100) setVitals({ warmth: Math.min(100, v.warmth + dt * 6) });
  } else {
    setVitals({ warmth: Math.max(22, v.warmth - dt * drainPerSecond) });
  }
}

const _fixedRel = new THREE.Vector3();

/** ch1-fixed tutorial progress (HUD ledger line). */
export function fixedTutorialProgress(): { fiber: number; screens: number } {
  return {
    fiber: Math.min(getItemCount('biofiber'), CH1_FIXED_TUTORIAL.biofiber),
    screens: Math.min(d.fixedCells.size, CH1_FIXED_TUTORIAL.screens)
  };
}

function quotaCollected(): { fiber: number; stone: number; total: number; met: boolean } {
  const fiber = Math.min(getItemCount('biofiber'), CH1_QUOTA.biofiber);
  const stone = Math.min(getItemCount('stone'), CH1_QUOTA.stone);
  return {
    fiber,
    stone,
    total: fiber + stone,
    // The raster act completes on quota AND the descent's debris recovered.
    met: fiber >= CH1_QUOTA.biofiber && stone >= CH1_QUOTA.stone && debrisSalvageComplete()
  };
}

/** Prologue-choice echo lines the work order appends (the system remembers). */
function echoLines(): string[] {
  const chosen = getMilestones().filter(m => m.startsWith('story:choice:'));
  const lines: string[] = [];
  for (const milestone of chosen) {
    const [, , cardId, optionId] = milestone.split(':');
    // The bridge card's [ACKNOWLEDGE] is mandatory, not a choice: it must never
    // stamp the no-record fallback ("TRANSIT RECORD INCOMPLETE…") into a played
    // run, nor eat one of the three echo slots the real choices own.
    if (cardId === VOYAGE_DECK.bridge) continue;
    const option = VOYAGE_DECK.cards[cardId]?.options.find(o => o.id === optionId);
    const line = option ? CH1_ECHO_LINES[option.echoLineId] : undefined;
    if (line && !lines.includes(line)) lines.push(line);
  }
  // Only a genuinely choice-less record (skipped prologue) assumes compliance.
  if (lines.length === 0) lines.push(CH1_ECHO_LINES['echo-neutral']);
  const tone = complianceToneLine();
  if (tone) lines.push(tone);
  // The paperwork stays readable: newest three echoes only.
  return lines.slice(-3);
}

// --- beat entry ----------------------------------------------------------------

/** Width (world units) of one fixed-screen cell — the era where the frame is bolted. */
const FIXED_SCREEN_CELL = 24;

/**
 * Collection acts remain on screen long enough to read as authored phases,
 * including when a replay/save enters with its quota already satisfied. The
 * final-pickup hold lets the completed ledger and pickup feedback land before
 * the camera earns another axis.
 */
export const CH1_COLLECTION_TIMING = {
  rasterMinimumSeconds: 6,
  depthMinimumSeconds: 6,
  completionHoldSeconds: 2.5
} as const;

const ISO_RIG: LensRig = {
  elevation: 0.6, // ~34° — the classic axonometric silhouette, not a high oblique
  azimuth: Math.PI / 4,
  distance: 26,
  lift: 2.4,
  focusLift: 1.2,
  followQuant: 0,
  depthBand: Infinity
};

/**
 * The monochrome ladder's camera, one era per rung. Every transition is a single
 * camera move (the rig blend), so each style dissolves into the next: bolted
 * screen → tracking → profile → belt depth → top-down → isometric → (lift).
 */
const ERA_RIGS: Partial<Record<StoryBeat, { rig: LensRig; seconds: number }>> = {
  'descent': { rig: { ...SIDE_RIG }, seconds: 0 },
  'ch1-fixed': { rig: { ...SIDE_RIG, followQuant: FIXED_SCREEN_CELL }, seconds: 0 },
  'ch1-track': { rig: { ...SIDE_RIG }, seconds: 6.5 }, // the unbolt IS the cutscene
  'ch1-raster': { rig: { ...SIDE_RIG }, seconds: 0 },
  // The profile view has one real traversable task row. The camera can breathe
  // wider here, but movement stays plane-locked until NAV VIEW reveals the map.
  'ch1-depth': { rig: { ...SIDE_RIG, depthBand: STORY_TASK_ROW_DEPTH_BAND, distance: 18 }, seconds: 2.5 },
  'ch1-nav': {
    rig: { elevation: Math.PI / 2, azimuth: 0, distance: 34, lift: 0, focusLift: 0, followQuant: 0, depthBand: Infinity },
    seconds: 5
  },
  'ch1-iso': { rig: { ...ISO_RIG }, seconds: 5 },
  'ch1-lift': { rig: { ...ISO_RIG }, seconds: 0 } // direct jumps start at the iso vantage
};

/** Beats whose picture is literally owned by a site/external camera. */
const EXTERNAL_CAMERA_BEATS = new Set<StoryBeat>([
  'descent',
  'ch1-fixed',
  'ch1-track',
  'ch1-raster',
  'ch1-depth',
  'ch1-nav',
  'ch1-iso',
  // The lift begins outside the body and continuously releases this mix.
  'ch1-lift'
]);

function chapter7ReconstructionScoreFacts(): Chapter7ReconstructionScoreFacts {
  const actorId = getLocalActorId();
  const calibration = getReconstructionCalibrationSnapshot();
  return {
    repairStage: getShipRepairStage(),
    firstHoverComplete: hasFirstLegalHoverReceipt(actorId),
    groundedReturnComplete: hasFirstHoverGroundedReturn(actorId),
    calibrationState: hasReconstructionCalibrationReceipt(actorId)
      ? 'complete'
      : calibration.phase === 'running'
        ? 'active'
        : 'none'
  };
}

type GatherMarkerResource = 'wood' | 'biofiber' | 'stone' | 'flint';

function firstMissingGatherInput(
  inputs: readonly { id: ItemId; qty: number }[]
): GatherMarkerResource | null {
  for (const input of inputs) {
    if (getItemCount(input.id) >= input.qty) continue;
    if (
      input.id === 'wood'
      || input.id === 'biofiber'
      || input.id === 'stone'
      || input.id === 'flint'
    ) return input.id;
  }
  return null;
}

/**
 * The Chapter 3 card follows the real recipe graph. In particular, biofuel is
 * not folded into a vague "campfire" instruction and the pickaxe/flint detour
 * disappears only when the inventory genuinely makes it unnecessary.
 */
function currentGatherObjectiveStage(): GatherObjectiveStage {
  const hatchet = getRecipe('stone_hatchet');
  if (getItemCount('stone_hatchet') <= 0) {
    return hasItems(hatchet.inputs) ? 'hatchet' : 'materials';
  }

  const campfire = getRecipe('campfire');
  const flintNeed = campfire.inputs.find(input => input.id === 'flint')?.qty ?? 0;
  if (getItemCount('flint') < flintNeed) {
    const pickaxe = getRecipe('stone_pickaxe');
    if (getItemCount('stone_pickaxe') <= 0) {
      return hasItems(pickaxe.inputs) ? 'pickaxe' : 'materials';
    }
    return 'flint';
  }

  const biofuelNeed = campfire.inputs.find(input => input.id === 'biofuel')?.qty ?? 0;
  if (getItemCount('biofuel') < biofuelNeed) {
    return hasItems(getRecipe('biofuel').inputs) ? 'biofuel' : 'materials';
  }

  return hasItems(campfire.inputs) ? 'campfire' : 'materials';
}

function currentGatherMarkerResource(): GatherMarkerResource {
  const hatchet = getRecipe('stone_hatchet');
  if (getItemCount('stone_hatchet') <= 0) {
    return firstMissingGatherInput(hatchet.inputs) ?? 'wood';
  }

  const campfire = getRecipe('campfire');
  const flintNeed = campfire.inputs.find(input => input.id === 'flint')?.qty ?? 0;
  if (getItemCount('flint') < flintNeed) {
    const pickaxe = getRecipe('stone_pickaxe');
    return getItemCount('stone_pickaxe') > 0
      ? 'flint'
      : firstMissingGatherInput(pickaxe.inputs) ?? 'stone';
  }

  const biofuelNeed = campfire.inputs.find(input => input.id === 'biofuel')?.qty ?? 0;
  if (getItemCount('biofuel') < biofuelNeed) return 'biofiber';
  return firstMissingGatherInput(campfire.inputs) ?? 'wood';
}

function currentRestObjectivePhase(): RestObjectivePhase {
  return d.dayPhase >= DUSK.nightStart && d.dayPhase <= DUSK.nightEnd
    ? 'rest-at-fire'
    : 'wait-for-night';
}

function currentVigilObjectivePhase(): VigilObjectivePhase {
  if (d.captionsFired.has('vig-rest')) return 'rest-at-fire';
  if (d.dayPhase >= DUSK.nightStart && d.dayPhase <= DUSK.nightEnd) return 'observe-sky';
  return 'remain-at-wreck';
}

/**
 * Chapters 1–3 and the vigil predate the shared HUD. Publish their authored
 * objective synchronously on entry, then re-resolve from live progression on
 * each story tick so direct loads and stage changes cannot leave stale copy.
 */
function syncFoundationalStoryObjective(beat: StoryBeat | null): void {
  if (!beat) return;
  const legacyFeedCopy = getStoryText().workorder;
  const guidance = (() => {
    switch (beat) {
      case 'ch1-fixed':
      case 'ch1-track':
      case 'ch1-raster':
      case 'ch1-depth':
      case 'ch1-iso':
      case 'ch1-lift':
      case 'ch2-color':
      case 'ch2-approach':
      case 'ch3-thirst':
      case 'ch3-signal':
        return resolveStoryObjectiveGuidance(beat);
      case 'ch1-nav':
        return resolveStoryObjectiveGuidance(beat, {
          navWaypointIndex: currentNavWaypointIndex(),
          navWaypointCount: NAV_WAYPOINT_COUNT
        });
      case 'ch1-anomaly':
        return resolveStoryObjectiveGuidance(beat, {
          anomalyDesignated: d.anomalyMassStage
        });
      case 'ch3-gather':
        return resolveStoryObjectiveGuidance(beat, {
          gatherStage: currentGatherObjectiveStage()
        });
      case 'ch3-await-rest':
        return resolveStoryObjectiveGuidance(beat, {
          restPhase: currentRestObjectivePhase()
        });
      case 'ch3-forage':
        return resolveStoryObjectiveGuidance(beat, {
          forageHasEdible: getItemCount('berry') + getItemCount('root') > 0,
          forageAte: d.forageAteAt >= 0 || hasMilestone(STORY_MILESTONES.ch3Ate)
        });
      case 'ch4-vigil':
        return resolveStoryObjectiveGuidance(beat, {
          vigilPhase: currentVigilObjectivePhase()
        });
      default:
        return null;
    }
  })();
  if (!guidance) return;
  const activated = activateGuidedStoryObjective(guidance);
  // Before embodiment, the Regulation Feed's bureaucratic voice is part of the
  // scene (including voyage echoes). Keep that authored copy while the shared
  // store supplies its semantic id, action, marker label, and health.
  if (
    activated
    && legacyFeedCopy.length > 0
    && (
      beat === 'ch1-fixed'
      || beat === 'ch1-track'
      || beat === 'ch1-raster'
      || beat === 'ch1-depth'
      || beat === 'ch1-nav'
      || beat === 'ch1-iso'
      || beat === 'ch1-lift'
    )
  ) setWorkOrder(legacyFeedCopy);
}

function onBeatEntered(beat: StoryBeat | null): void {
  d.beat = beat;
  d.beatClock = 0;
  const era = beat ? ERA_RIGS[beat] : null;
  if (era) setLensRig(era.rig, era.seconds);
  // Cutscene-scoped world state never survives a beat change.
  if (beat !== 'a3-dawn') {
    clearLifeReveal();
    d.bloomCenter.set(0, 0, 0);
  }
  // Cutscene state never survives a beat change (envelopes re-assert per frame).
  setCinematicLookWeight(0);
  setCinematicLookTarget(null);
  clearCinematicCameraPose();
  const feed = getFeedRuntime();
  feed.cinematic = 0;
  // Beat entry is the replay/deep-link authority for camera-feed ownership.
  // First-person beats never inherit CCTV treatment from an earlier rung.
  feed.externalCameraMix = beat && EXTERNAL_CAMERA_BEATS.has(beat) ? 1 : 0;
  // Chapter 7 derives its cumulative orchestration from the same durable
  // repair/boarding facts that gate progression. Install that override before
  // setScoreBeat asks the instrument for the beat mood, including deep links.
  enterEmergentScoreBeat(
    beat,
    beat === 'ch7-reconstruct' ? chapter7ReconstructionScoreFacts() : undefined
  );
  if (beat === 'ch7-board') {
    const actorId = getLocalActorId();
    const boarding = getPhysicalBoardingSnapshot();
    hydrateChapter7BoardingScore({
      sealed: hasSealedPhysicalBoarding(actorId, STORY_PRIMARY_WORLD_ID),
      transactionId: boarding.transactionId ?? undefined
    });
  }
  // The score retunes to the beat's resolved mood (null returns to sandbox).
  setScoreBeat(beat);
  enterEmergentStoryBeat(beat);
  // Constellation reveal persistence: the resolved sky belongs to a STORY save
  // that has earned it (milestone) and never to the sandbox — a sandbox session
  // after a story session must not inherit reveal=1. onBeatEntered only runs on
  // real beat transitions, so a cold load with no active story leaves the ?sky
  // dev flag untouched (this line never runs there).
  setConstellationReveal(beat != null && hasMilestone('story:ch4:constellations') ? 1 : 0);
  switch (beat) {
    case 'descent':
      resetFeedRuntime();
      getFeedRuntime().descent = 0; // the pod enters the frame
      d.descentImpacted = false;
      setStoryForcedDayPhase(0.25);
      break;
    case 'ch1-fixed':
      // First playable frame after the crash — the era where the frame itself
      // is bolted down. All the arrival initialization happens here.
      resetFeedRuntime();
      getFeedRuntime().descent = 1.1; // the wreck is a fact of the world now
      d.ch1Clock = 0;
      d.flashesFired = CH1_FLASH_SCHEDULE.map(() => false);
      // The construct runs standard illumination until the player earns time (A3).
      setStoryForcedDayPhase(0.25);
      // The harvester arrives with whatever the voyage left in the cell (full
      // minus recalibrations/forgettings; commendations topped it up). It
      // degrades to the broken/refuel loop when the survival act begins (ch3).
      setMawCharge(getArrivalCellCharge());
      d.fixedCells.clear();
      d.fixedCamCell = null; // first tick assigns the opening camera, cut-free
      setWorkOrder([...CH1_WORK_ORDERS.fixed, ...echoLines()]);
      break;
    case 'ch1-track':
      // The mini-awakening: the frame unbolts and learns to follow the worker.
      playSfx('storyAwaken');
      scoreHit('bloom');
      setWorkOrder([...CH1_WORK_ORDERS.track]);
      break;
    case 'ch1-raster':
      // Direct jumps land here too — re-run the arrival init (idempotent).
      resetFeedRuntime();
      backfillLegacyDebrisStone();
      getFeedRuntime().descent = 1.1;
      d.ch1Clock = 0;
      d.flashesFired = CH1_FLASH_SCHEDULE.map(() => false);
      setStoryForcedDayPhase(0.25);
      setMawCharge(getArrivalCellCharge());
      d.rasterCompleteAt = -1;
      setWorkOrder([...CH1_WORK_ORDERS.raster, ...echoLines()]);
      break;
    case 'ch1-depth':
      getFeedRuntime().descent = 1.1; // direct-jump safe
      setStoryForcedDayPhase(0.25);
      d.glitchDecay = 0.55; // each era hand-off announces itself
      d.depthCompleteAt = -1;
      setWorkOrder([...CH1_WORK_ORDERS.depth]);
      break;
    case 'ch1-nav':
      getFeedRuntime().descent = 1.1;
      setStoryForcedDayPhase(0.25);
      d.glitchDecay = 0.55;
      resetNavWaypoints();
      setWorkOrder([...CH1_WORK_ORDERS.nav]);
      break;
    case 'ch1-iso':
      getFeedRuntime().descent = 1.1;
      setStoryForcedDayPhase(0.25);
      d.glitchDecay = 0.7; // dpr ratchets 0.4→0.55 under this pulse (policy snap)
      playSfx('storyGlitch');
      setWorkOrder([...CH1_WORK_ORDERS.iso]);
      break;
    case 'ch1-anomaly':
      // The external lens is gone: this is an embodied, constrained pan-tilt
      // survey. The HUD remains useful, but the CCTV post-process stays off.
      // STAGE 1: the calibration sweep — one goal at a time; the mass is not
      // designated (no marker, no [F]) until the era has been looked through.
      d.glitchDecay = 0.7;
      d.anomalySectorsSeen.clear();
      d.anomalyMassStage = false;
      d.anomalyDesignatedAt = -1;
      d.gravityEdgeAt = -1;
      setWorkOrder([...CH1_WORK_ORDERS.anomaly]);
      break;
    case 'ch1-lift':
      d.liftSnapped = false;
      playSfx('storyAwaken');
      setWorkOrder(['PAN-TILT SURVEY: CALIBRATING…', 'HOLD POSITION. PERSPECTIVE IS BEING ISSUED.']);
      break;
    case 'a1-ramp':
      // Movement freezes via the beat policy; the timeline below owns the
      // visuals — and the system's voice goes with the grayscale (a clean
      // frame for the awakening; ch2's ticket re-fills it after).
      setWorkOrder([]);
      playSfx('storyAwaken');
      break;
    case 'ch2-color':
      // Post-A1 (also the deep-link/resume entry): color is through. The
      // regulation HUD stays, but the external-camera treatment has already
      // ended at the lift; the pan-tilt interlock now fails too.
      getFeedRuntime().desat = 0;
      getFeedRuntime().treatment = 1;
      getFeedRuntime().descent = 1.1; // wreck present on direct jumps too
      setStoryForcedDayPhase(0.25);
      setWorkOrder([
        'SENSOR FAULT: CHROMATIC CHANNEL UNSUPPRESSED',
        'SENSOR FAULT: PAN-TILT INTERLOCK RELEASED. FULL ROTATION AVAILABLE.',
        'A REPAIR TICKET HAS BEEN FILED (Q: 44,207)',
        'RESUME QUOTA. DO NOT LOOK AT THE COLORS. DO NOT LOOK FREELY.'
      ]);
      break;
    case 'ch2-approach':
      getFeedRuntime().desat = 0; // post-A1 (direct debug jumps skip ch2-color)
      setWorkOrder([
        'RETURN TO THE SURVEY AREA',
        'THE OBJECT AHEAD IS NOT AN OBJECT',
        'THERE IS NO OBJECT'
      ]);
      break;
    case 'a2-awakening':
      getFeedRuntime().desat = 0; // post-A1 (direct debug jumps land here too)
      d.a2NextViolationAt = 0;
      d.a2ViolationIndex = 0;
      d.a2HudDead = false;
      clearViolations();
      break;
    case 'ch3-gather':
      // Post-A2 (also the deep-link/resume entry): the feed is gone entirely.
      getFeedRuntime().treatment = 0;
      getFeedRuntime().desat = 0;
      getFeedRuntime().redaction.visible = false;
      d.dayPhase = 0.25;
      setStoryForcedDayPhase(0.25); // noon holds until the scripted first dusk
      setWorkOrder([]);
      clearViolations();
      // The campfire teaching chain restarts clean on (re-)entry.
      d.gatherSkipDecided = false;
      d.gatherSkipFlint = false;
      d.gatherFlintAtPrompt = -1;
      // (HEALTH — the first row — lands in the tick WITH its naming caption,
      // the TEMP grammar; deep links seed it via seedForBeat.)
      ensureRestInteraction();
      // (Timber/flint were EARNED as hull debris back in the raster act.)
      break;
    case 'ch3-dusk':
      // The first sun event: the story takes the camera for a few seconds.
      playSfx('storyAwaken');
      setStoryMoveScale(0);
      ensureRestInteraction();
      break;
    case 'ch3-await-rest':
      // Direct entry (deep link / resume): start from the post-dusk sky.
      d.dayPhase = Math.max(d.dayPhase, DUSK.targetPhase);
      ensureRestInteraction();
      break;
    case 'a3-dawn':
      d.a3Woke = false;
      if (d.restUnregister) {
        d.restUnregister();
        d.restUnregister = null;
      }
      break;
    case 'ch3-thirst':
    case 'ch3-forage':
    case 'ch3-signal':
    case 'ch4-vigil': {
      // The first day alive (also the deep-link entries): the feed chrome is
      // long gone, the wreck is a fact of the world, and the sun stays the
      // director's until the arrival hands it to the live clock.
      const r = getFeedRuntime();
      r.treatment = 0;
      r.desat = 0;
      r.redaction.visible = false;
      r.descent = 1.1;
      setWorkOrder([]);
      clearViolations();
      // Direct jumps land mid-morning; a flowing run keeps the dawn's phase.
      if (d.dayPhase > 0.2 && d.dayPhase < 0.97) d.dayPhase = FIRST_DAY.morningPhase;
      // The needs arrive ALREADY FALLING (the TEMP pattern) — seeds clamp down.
      if (beat === 'ch3-thirst' && getVitals().thirst > FIRST_DAY.thirstSeed) {
        setVitals({ thirst: FIRST_DAY.thirstSeed });
      }
      if (beat === 'ch3-forage') {
        if (getVitals().hunger > FIRST_DAY.hungerSeed) setVitals({ hunger: FIRST_DAY.hungerSeed });
        d.forageAteAt = -1;
      }
      if (beat === 'ch3-signal') {
        d.signalPhaseFrom = d.dayPhase;
        d.signalKlaxons = 0;
        // The run must have a full budget — the sensation is CAUSED, on cue.
        setVitals({ stamina: 100 });
      }
      if (beat === 'ch4-vigil') {
        d.vigilPhaseFrom = Math.min(Math.max(d.dayPhase, SIGNAL.phaseTarget), DUSK.targetPhase);
        d.dayPhase = d.vigilPhaseFrom;
        // The stargaze sequence starts fresh each entry (the reveal ramp too,
        // unless a resumed save already earned the milestone — handled above).
        d.vigilNightAt = -1;
        d.vigilLookHeld = 0;
        d.stargazeStart = -1;
        d.constellationRampStart = -1;
        ensureRestInteraction();
      }
      setStoryForcedDayPhase(d.dayPhase);
      const v = getVitals();
      d.prevThirst = v.thirst;
      d.prevHunger = v.hunger;
      d.prevWaterskin = getWaterskinFill();
      d.lastCaptionAt = d.elapsedSeconds;
      break;
    }
    case 'ch4-arrival':
      d.arrivalWoke = false;
      d.arrivalRouteRevision = null;
      if (d.restUnregister) {
        d.restUnregister();
        d.restUnregister = null;
      }
      hideAuditWorker();
      getFeedRuntime().descent = 1.1;
      break;
    default:
      break;
  }
  // enterEmergentStoryBeat intentionally clears the previous chapter's
  // contract. Republish only after this beat's reset/seed work has completed so
  // a direct load has correct guidance before the first Canvas frame.
  syncFoundationalStoryObjective(beat);
}

// --- rest interaction ([F] Rest at a campfire, at night) ---------------------------

const REST_DISTANCE = 4.2;

function nearCampfire(position: { x: number; y: number; z: number }): boolean {
  for (const fire of getCampfires()) {
    const dx = position.x - fire.pos[0];
    const dy = position.y - fire.pos[1];
    const dz = position.z - fire.pos[2];
    if (dx * dx + dy * dy + dz * dz <= REST_DISTANCE * REST_DISTANCE) return true;
  }
  return false;
}

function ensureRestInteraction(): void {
  if (d.restUnregister) return;
  d.restUnregister = registerStoryInteraction((_camera, position) => {
    const s = getStoryStateSnapshot();
    if (!s.active) return null;
    if (s.beat !== 'ch3-await-rest' && s.beat !== 'ch4-vigil') return null;
    const phase = getCurrentDayPhase();
    if (phase < DUSK.nightStart || phase > DUSK.nightEnd) return null;
    if (!nearCampfire(position)) return null;
    return {
      id: 'story-rest',
      verb: 'Rest',
      perform: s.beat === 'ch4-vigil' ? beginVigilSleep : beginA3
    };
  });
}

/** The campfire rest — begins the A3 material awakening. */
export function beginA3(): void {
  const s = getStoryStateSnapshot();
  if (!s.active || s.beat !== 'ch3-await-rest') return;
  playSfx('storySleep');
  advanceToBeat('a3-dawn');
}

/** The scheduled sleep — the vigil's ordered rest brings the auditor's dawn. */
export function beginVigilSleep(): void {
  const s = getStoryStateSnapshot();
  if (!s.active || s.beat !== 'ch4-vigil') return;
  playSfx('storySleep');
  // Rest refills what a night can refill: stamina + warmth only (hunger/thirst
  // stay down — day-2 pressure is chapter 4's fuel, per the plan §2 S4).
  setVitals({ stamina: 100, warmth: 100 });
  markMilestone(STORY_MILESTONES.ch4Vigil);
  advanceToBeat('ch4-arrival');
}

let lastBeat: StoryBeat | null = null;
let lastRunId = getStoryStateSnapshot().runId;
function syncBeat(): void {
  const s = getStoryStateSnapshot();
  if (s.runId !== lastRunId) {
    if (d.restUnregister) d.restUnregister();
    d = createDirectorRuntime();
    lastBeat = null;
    lastRunId = s.runId;
    resetFeedRuntime();
    clearLifeReveal();
    setCinematicLookWeight(0);
    setCinematicLookTarget(null);
    clearCinematicCameraPose();
  }
  const beat = s.active ? s.beat : null;
  if (beat !== lastBeat) {
    lastBeat = beat;
    onBeatEntered(beat);
  }
  // Deactivation (quit to menu / completion) drops the live rest resolver and
  // fades the score out (the sandbox owns its own music).
  if (!s.active) {
    enterEmergentScoreBeat(null);
    setScoreBeat(null);
    if (s.chapter !== 'complete') clearLifeReveal(); // quit mid-cutscene: no stuck wave
    if (d.restUnregister) {
      d.restUnregister();
      d.restUnregister = null;
    }
  }
}
subscribeStory(syncBeat);
// Deep links activate the story BEFORE this module loads — catch up immediately.
syncBeat();

// The first campfire brings the first dusk (fire before dark — earned warmth),
// and the story acknowledges the act immediately.
subscribeCampfires(() => {
  const s = getStoryStateSnapshot();
  if (!s.active || s.chapter !== 'ch3') return;
  if (getCampfires().length === 0) return;
  fireCaptionOnce('fire-built', CH3_CAPTIONS.fireBuilt);
  if (s.beat === 'ch3-gather') advanceToBeat('ch3-dusk');
});

// --- external triggers (story world props call these) ----------------------------

/** True once ch1-anomaly's calibration sweep has returned the deviation —
 *  the marker, the [F] Touch, and beginA1 all gate on it (one goal at a time). */
export function anomalyMassDesignated(): boolean {
  return d.anomalyMassStage;
}

/** True once the designation has LANDED (order read, marker seen) — the
 *  stone's [F] and beginA1 gate here, one stage after the marker appears. */
export function anomalyTouchArmed(): boolean {
  return d.anomalyMassStage
    && d.beatClock >= d.anomalyDesignatedAt + ANOMALY_SURVEY.armSeconds;
}

/** The anomaly stone's [F] Touch — begins the A1 chroma awakening. */
export function beginA1(): void {
  const s = getStoryStateSnapshot();
  if (!s.active || s.beat !== 'ch1-anomaly') return;
  if (!anomalyTouchArmed()) return; // sweep → designation → THEN the answer
  advanceToBeat('a1-ramp');
}

/** The apple's [F] Eat — begins the A2 depth awakening (timeline lands in P4). */
export function beginA2(): void {
  const s = getStoryStateSnapshot();
  if (!s.active || s.beat !== 'ch2-approach') return;
  advanceToBeat('a2-awakening');
}

// --- per-frame tick ---------------------------------------------------------------

function smoothstep(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

function tickCh1Flashes(dt: number): void {
  d.ch1Clock += dt;
  // Never inside a beat's opening seconds: era hand-offs land CLEAN — one
  // thing at a time (the flashes were stacking onto rig lerps and new orders).
  if (d.beatClock < 4) return;
  const { total } = quotaCollected();
  CH1_FLASH_SCHEDULE.forEach((flash, i) => {
    if (d.flashesFired[i]) return;
    const timeDue = d.ch1Clock >= flash.atSeconds;
    const quotaDue = flash.afterQuotaCount != null && total >= flash.afterQuotaCount;
    if (timeDue || quotaDue) {
      d.flashesFired[i] = true;
      d.flashFramesLeft = 2;
      d.glitchDecay = 0.85;
      playSfx('storyGlitch');
    }
  });
}

// ch1-anomaly stage 1 → 2: the calibration sweep. The pan-tilt era's verb is
// LOOKING — the view must traverse the compass before the survey "finds" the
// mass. Sector visits come straight off the live camera; a time fallback keeps
// direct jumps and stuck screenings moving.
const _surveyDir = new THREE.Vector3();

function tickAnomalySurvey(camera: THREE.PerspectiveCamera | null): void {
  if (d.anomalyMassStage) return;
  if (camera) {
    camera.getWorldDirection(_surveyDir);
    const angle = Math.atan2(_surveyDir.x, _surveyDir.z) + Math.PI; // 0..2π
    const sector = Math.min(
      ANOMALY_SURVEY.sectors - 1,
      Math.floor((angle / (Math.PI * 2)) * ANOMALY_SURVEY.sectors)
    );
    d.anomalySectorsSeen.add(sector);
  }
  const swept = d.anomalySectorsSeen.size >= ANOMALY_SURVEY.required
    && d.beatClock >= ANOMALY_SURVEY.minSeconds;
  if (swept || d.beatClock >= ANOMALY_SURVEY.fallbackSeconds) {
    // STAGE 2: the deviation is returned — the marker + order land FIRST;
    // the touch arms armSeconds later (stages never stack).
    d.anomalyMassStage = true;
    d.anomalyDesignatedAt = d.beatClock;
    d.glitchDecay = 0.55;
    playSfx('storyGlitch');
    setWorkOrder([...CH1_ANOMALY_MASS_ORDER]);
  }
}

function tickA1Ramp(): void {
  const t = d.beatClock / A1_RAMP_SECONDS;
  if (t >= 1) {
    // Land EXACTLY on the color preset (chroma 1) — the stage cut is seamless.
    setVoxelRealityStage('color');
    clearVoxelRealityOverrides();
    const r = getFeedRuntime();
    r.desat = 0;
    r.glitch = 0;
    markMilestone(STORY_MILESTONES.a1);
    scoreHit('bloom'); // color arrives as a chord opening
    advanceToBeat('ch2-color');
    return;
  }
  // Chroma climbs; a seeded square-wave flicker drops it out, dense early.
  const base = smoothstep(t);
  const dropoutChance = t < 0.4 ? 0.30 : t < 0.75 ? 0.12 : 0;
  const dropped = d.a1FlickerNoise() < dropoutChance;
  const chroma = dropped ? Math.max(0, base - 0.85) : base;
  overrideVoxelRealityEffects({ chroma });
  setScoreIntensity(0.4 + base * 0.6); // the riser rides the chroma itself
  const r = getFeedRuntime();
  r.desat = 1 - chroma;
  r.glitch = dropped ? 0.7 : Math.max(0, r.glitch - 0.1);
  r.scanRoll = dropped ? 0.5 : Math.max(0, r.scanRoll - 0.06);
}

// A2 — the depth awakening. Four movements: the system panics (violation flood),
// the regulation HUD dies, the world opens (FOV + control liberation), and the
// handoff into free 3D. ~12 seconds that the whole game is about.
function tickA2(): void {
  const t = d.beatClock;
  const T = A2_TIMELINE;
  const r = getFeedRuntime();
  const floodEnd = T.violationFloodSeconds;
  const deathEnd = floodEnd + T.hudDeathSeconds;
  const libEnd = deathEnd + T.liberationSeconds;

  if (t < floodEnd) {
    if (t >= d.a2NextViolationAt && d.a2ViolationIndex < A2_VIOLATION_LINES.length) {
      pushViolation(A2_VIOLATION_LINES[d.a2ViolationIndex++]);
      playSfx('terminalAlarm');
      d.a2NextViolationAt = t + Math.max(0.07, 0.4 - 0.33 * (t / floodEnd));
    }
    r.glitch = Math.max(r.glitch, 0.3 + 0.4 * (t / floodEnd));
    r.garble = 0.15 + 0.45 * (t / floodEnd);
    r.redaction.visible = false;
    return;
  }
  if (t < deathEnd) {
    const k = (t - floodEnd) / T.hudDeathSeconds;
    r.garble = 1;
    r.glitch = 0.8 * (1 - k);
    r.scanRoll = 0.9 * (1 - k);
    r.redaction.visible = false;
    if (!d.a2HudDead && k > 0.55) {
      d.a2HudDead = true;
      setWorkOrder([]);
      clearViolations();
      // Replay/deep-link safety: embodied chapters already use device DPR, but
      // reassert it at the HUD death rather than let an old raster target leak.
      setStoryTargetDpr(null);
    }
    return;
  }
  if (t < libEnd) {
    if (!d.captionsFired.has('a2-awaken-sfx')) {
      d.captionsFired.add('a2-awaken-sfx');
      playSfx('storyAwaken');
      scoreHit('braam'); // the wall of the feed gives way
    }
    const k = smoothstep((t - deathEnd) / T.liberationSeconds);
    // (The look is already free — ch2 runs unlocked since the A1 interlock
    // fault — so the liberation is carried by the widening embodied FOV, the
    // dying regulation channel, and the score, not a camera cage opening.)
    setStoryTargetFov(FEED_FOV + (SANDBOX_FOV - FEED_FOV) * k);
    setScoreIntensity(0.5 + k * 0.5); // the liberation IS the crescendo
    r.treatment = 1 - k;
    r.garble = 0;
    r.glitch = 0;
    r.scanRoll = 0;
    setStoryForcedDayPhase(0.25); // regulation noon holds through the reveal
    const sinceUnfreeze = t - deathEnd - T.unfreezeAtSeconds;
    if (sinceUnfreeze >= 0) setStoryMoveScale(Math.min(1, sinceUnfreeze / 1.5));
    return;
  }
  // Handoff (one shot): feed gone, device resolution, chapter 3 begins.
  setStoryLookMode('free');
  setStoryTargetDpr(null);
  r.treatment = 0;
  markMilestone(STORY_MILESTONES.a2);
  scoreHit('bloom'); // depth resolves into the warm chapter-3 key
  advanceToBeat('ch3-gather');
}

// The crash landing (~8.5s), watched from the ground in the raster lens: the
// pod streaks down the 2D frame, impact flashes white, and the smoking wreck
// becomes the first landmark of the strip the player is about to work.
const DESCENT_SECONDS = 8.5;
const DESCENT_IMPACT_AT = 4.5;

function tickDescent(dt: number): void {
  // The crash WAITS for the world: colliders/chunks stream in after mount, and
  // the pod must never streak down onto a planet that isn't there yet (the
  // player is pinned at spawn by the same signal — see game/spawnSettle.ts).
  // The BRACE white-out holds the frame while it loads — the fall then emerges
  // from its own flash, and nobody watches the world assemble.
  if (!isSpawnSettled()) {
    d.beatClock = 0;
    const held = getFeedRuntime();
    held.descent = 0;
    held.flash = 1;
    return;
  }
  const t = d.beatClock;
  const r = getFeedRuntime();
  r.cinematic = envelope(t, 0, 0.8, DESCENT_SECONDS - 1.5, DESCENT_SECONDS);
  r.descent = Math.min(1.1, t / DESCENT_IMPACT_AT);
  // Tension climbs with the fall; the impact is the score's first boom.
  setScoreIntensity(Math.min(1, 0.4 + (t / DESCENT_IMPACT_AT) * 0.6));
  if (!d.descentImpacted && t >= DESCENT_IMPACT_AT) {
    d.descentImpacted = true;
    r.flash = 1;
    r.glitch = 1;
    r.scanRoll = 0.8;
    playSfx('shipCrash');
    scoreHit('boom');
    scoreHit('braam');
  }
  r.flash = Math.max(0, r.flash - dt * 1.4);
  r.glitch = Math.max(0, r.glitch - dt * 0.9);
  r.scanRoll = Math.max(0, r.scanRoll - dt * 0.7);
  if (t >= DESCENT_SECONDS) {
    r.descent = 1.1;
    advanceToBeat('ch1-fixed');
  }
}

// The TRACKING unbolt (~7s): the bolted frame learns to follow the worker — the
// rig blend (quantized anchor → continuous follow) IS the whole cutscene.
const TRACK_SECONDS = 7;

function tickTrackUnlock(): void {
  const t = d.beatClock;
  const r = getFeedRuntime();
  r.cinematic = envelope(t, 0, 0.8, TRACK_SECONDS - 1.4, TRACK_SECONDS);
  if (t >= TRACK_SECONDS) {
    markMilestone(STORY_MILESTONES.ch1Track);
    advanceToBeat('ch1-raster');
  }
}

// The 2D→3D LIFT (~7s): the camera physically travels from the side-scroller
// vantage INTO the worker's eyes while the world rotates from profile to first
// person — the single transition where the geometry of perception changes.
const LIFT_SECONDS = 7;

function tickCh1Lift(): void {
  const t = d.beatClock;
  const r = getFeedRuntime();
  const lens = getSideLens();

  // Letterbox frames the whole traverse; releases as the regulation HUD returns.
  r.cinematic = envelope(t, 0, 1, LIFT_SECONDS - 1.6, LIFT_SECONDS);

  // The first-person endpoint should face down the strip the player just
  // worked: pull the (dormant) free-look refs toward it while the blend runs.
  if (lens) {
    d.liftLookTarget
      .copy(getPlayerWorldPosition())
      .addScaledVector(lens.travelAxis, getSideFacing() * 14)
      .addScaledVector(lens.up, 1.2);
    setCinematicLookTarget(d.liftLookTarget);
    setCinematicLookWeight(envelope(t, 0, 0.8, LIFT_SECONDS - 2, LIFT_SECONDS - 0.5));
  }

  // The traverse itself: profile → eyes over the middle 4.5 seconds.
  const liftBlend = smoothstep(Math.min(1, Math.max(0, (t - 1.2) / 4.5)));
  setStorySideBlend(liftBlend);
  // CCTV belongs to the external lens, not to the body. Fade it in exact
  // opposition to the camera's travel into the player's eyes.
  r.externalCameraMix = 1 - liftBlend;
  // Consciousness arrives WITH the perspective: the watcher's parenthetical
  // voice all the way in (pre-lift grammar), then the first pronoun in the
  // story — the story's first BARE lowercase line, one flicker before the
  // feed clamps.
  if (t >= 2.4) fireCaptionOnce('lift-inward', '(the seeing is being moved inside.)');
  if (t >= 5.4) fireCaptionOnce('lift-i', 'i—');
  setScoreIntensity(0.35 + liftBlend * 0.65); // the score rises with the camera

  // Mid-lift, one glitch pulse masks the single resolution snap back to the
  // device DPR (never lerp framebuffers through the move).
  if (!d.liftSnapped && t >= 1.2 + 4.5 * 0.5) {
    d.liftSnapped = true;
    setStoryTargetDpr(null);
    r.glitch = 0.8;
    r.scanRoll = 0.5;
    playSfx('storyGlitch');
    scoreHit('braam'); // perspective is being issued
  }
  r.glitch = Math.max(0, r.glitch - 0.02);
  r.scanRoll = Math.max(0, r.scanRoll - 0.015);

  if (t >= LIFT_SECONDS) {
    setStorySideBlend(1);
    r.externalCameraMix = 0;
    advanceToBeat('ch1-anomaly'); // entry pulses + sets the pan-tilt work order
  }
}

/** One-shot captions keyed on beat+index (survive re-entry without repeating). */
function fireCaptionOnce(key: string, text: string): void {
  if (d.captionsFired.has(key)) return;
  d.captionsFired.add(key);
  d.lastCaptionAt = d.elapsedSeconds; // musings wait for a genuine lull
  showCaption(text);
}

/** One-shot AUDIT-band lines (the post-feed regulation voice). */
function fireAuditOnce(key: string, text: string, header?: string): void {
  if (d.captionsFired.has(key)) return;
  d.captionsFired.add(key);
  d.lastCaptionAt = d.elapsedSeconds;
  showAuditLine(text, header);
}

/** Trapezoid envelope: 0→1 over [inStart..inEnd], 1, then 1→0 over [outStart..outEnd]. */
function envelope(t: number, inStart: number, inEnd: number, outStart: number, outEnd: number): number {
  if (t <= inStart) return 0;
  if (t < inEnd) return (t - inStart) / (inEnd - inStart);
  if (t <= outStart) return 1;
  if (t < outEnd) return 1 - (t - outStart) / (outEnd - outStart);
  return 0;
}

// The campfire teaching chain (ch3-gather): each station read comes straight off
// recipe satisfiability — never a hardcoded count — so the copy tracks the real
// economy. The chain guides gather → hatchet → pickaxe → flint → fire, with a
// flint-skip branch when the pods already provisioned enough flint.
function tickGatherTeaching(): void {
  const t = d.beatClock;
  if (t >= 22) fireCaptionOnce('gather-thought', CH3_CAPTIONS.fireThought);
  if (t >= 26) fireCaptionOnce('gather-prompt', CH3_CAPTIONS.gatherPrompt);
  // The extractor nudge fires only if, 20s after the gather prompt, nothing has
  // been pulled from the world yet (no wood / fiber / stone in hand).
  if (
    t >= 46
    && getItemCount('wood') + getItemCount('biofiber') + getItemCount('stone') === 0
  ) {
    fireCaptionOnce('gather-hint', CH3_CAPTIONS.gatherHint);
  }
  const hatchet = getRecipe('stone_hatchet');
  const pickaxe = getRecipe('stone_pickaxe');
  const campfire = getRecipe('campfire');
  const campfireFlintNeed = campfire.inputs.find(s => s.id === 'flint')?.qty ?? 0;
  if (hasItems(hatchet.inputs)) fireCaptionOnce('gather-hatchet', CH3_CAPTIONS.hatchetPrompt);
  const hatchetDone = getItemCount('stone_hatchet') > 0;
  if (hatchetDone && !d.gatherSkipDecided) {
    // Latch the branch the instant the hatchet lands: enough flint already in
    // hand skips the pickaxe + flint detour entirely.
    d.gatherSkipDecided = true;
    d.gatherSkipFlint = getItemCount('flint') >= campfireFlintNeed;
  }
  if (hatchetDone) {
    if (d.gatherSkipFlint) {
      fireCaptionOnce('gather-flint-skip', CH3_CAPTIONS.flintSkip);
    } else {
      if (hasItems(pickaxe.inputs)) fireCaptionOnce('gather-pickaxe', CH3_CAPTIONS.pickaxePrompt);
      if (getItemCount('stone_pickaxe') > 0) {
        const wasFired = d.captionsFired.has('gather-flint');
        fireCaptionOnce('gather-flint', CH3_CAPTIONS.flintPrompt);
        if (!wasFired) d.gatherFlintAtPrompt = getItemCount('flint');
        if (d.gatherFlintAtPrompt >= 0 && getItemCount('flint') > d.gatherFlintAtPrompt) {
          fireCaptionOnce('gather-flint-found', CH3_CAPTIONS.flintFound);
        }
      }
    }
  }
  if (hasItems(campfire.inputs)) fireCaptionOnce('gather-fire', CH3_CAPTIONS.firePrompt);
}

// The ship first-look: once the wreck has converted (A3 material stage), the
// first time the camera HOLDS it inside a 35° half-cone for holdSeconds, the
// awakening voice registers that the seeing — not the wreck — has changed. A
// signal-line fallback fires it even if the cone never caught (or the camera is
// null, as in tests). One-shot per save.
const _shipLookDir = new THREE.Vector3();
const _shipLookTo = new THREE.Vector3();
const _shipCamPos = new THREE.Vector3();

function tickShipLook(dt: number, camera: THREE.PerspectiveCamera | null): void {
  if (hasMilestone('story:ch3:shiplook')) return;
  if (!hasMilestone(STORY_MILESTONES.a3)) return; // eligible from the material stage on
  if (d.shipLookFallbackAt >= 0 && d.elapsedSeconds >= d.shipLookFallbackAt + 3) {
    fireCaptionOnce('ship-look', SHIP_LOOK.caption);
    markMilestone('story:ch3:shiplook');
    return;
  }
  if (!camera || !hifiWreckHandle.converted || !hifiWreckHandle.position) return; // tests: null camera
  camera.getWorldDirection(_shipLookDir);
  _shipLookTo.copy(hifiWreckHandle.position).sub(camera.getWorldPosition(_shipCamPos));
  if (_shipLookTo.lengthSq() < 1e-6) return;
  _shipLookTo.normalize();
  const withinCone = _shipLookDir.dot(_shipLookTo)
    >= Math.cos((SHIP_LOOK.coneDegrees * Math.PI) / 180);
  if (withinCone) {
    d.shipLookHeld += dt;
    if (d.shipLookHeld >= SHIP_LOOK.holdSeconds) {
      fireCaptionOnce('ship-look', SHIP_LOOK.caption);
      markMilestone('story:ch3:shiplook');
    }
  } else {
    d.shipLookHeld = 0;
  }
}

const _duskFirePosition = new THREE.Vector3();
const _duskFireUp = new THREE.Vector3();
const _duskPlayerPosition = new THREE.Vector3();
const _duskPlayerEye = new THREE.Vector3();
const _duskCameraEye = new THREE.Vector3();
const _duskCameraTarget = new THREE.Vector3();
const _duskCameraUp = new THREE.Vector3();
const _duskGazeTarget = new THREE.Vector3();

// Chapter 3's sun: the director owns the forced phase through the scripted first
// dusk and the night, releasing it to the live world clock only at completion —
// so the cycle works identically on every graphics tier (non-animated profiles
// never advance the clock on their own).
function tickCh3Sun(dt: number): void {
  const s = getStoryStateSnapshot();
  if (s.beat === 'ch3-dusk') {
    const k = smoothstep(Math.min(1, d.beatClock / DUSK.lerpSeconds));
    d.dayPhase = 0.25 + (DUSK.targetPhase - 0.25) * k;
    // The first fire earns its own image before sunset: a low three-quarter
    // portrait arcs around the flames, returns to the player's eyes, and carries
    // their gaze from the warmth they made to the light now leaving. Every layer
    // shares this state clock, so lens, bars, feet, score, and gaze cannot drift.
    const t = d.beatClock;
    const fire = getCampfires()[0] ?? null;
    const cinematic = duskCinematicStateAt(t, fire != null);
    // Let "i made warmth" live on the fire portrait. The leaving-light line
    // arrives only as the gaze itself begins to rise toward that light.
    if (t >= (fire ? DUSK_CINEMATIC.fireHoldEnd : 0.2)) {
      fireCaptionOnce('dusk', CH3_CAPTIONS.duskStart);
    }
    getFeedRuntime().cinematic = cinematic.letterbox;
    setStoryMoveScale(cinematic.movement);
    setStoryTargetFov(cinematic.fov);
    setScoreIntensity(cinematic.score);
    setCinematicLookWeight(cinematic.look);

    if (fire) {
      _duskFirePosition.set(fire.pos[0], fire.pos[1], fire.pos[2]);
      _duskFireUp.set(fire.up[0], fire.up[1], fire.up[2]);
      if (_duskFireUp.lengthSq() < 1e-8) _duskFireUp.copy(getPlayerUp());
      else _duskFireUp.normalize();
      _duskPlayerPosition.copy(getPlayerWorldPosition());
      const playerForward = getPlayerLook().forward;
      computeDuskFireCameraFrame(
        _duskFirePosition,
        _duskFireUp,
        _duskPlayerPosition,
        playerForward,
        cinematic.orbitRadians,
        _duskCameraEye,
        _duskCameraTarget,
        _duskCameraUp
      );
      if (cinematic.fireCamera > 0.001) {
        setCinematicCameraPose(
          _duskCameraEye,
          _duskCameraTarget,
          _duskCameraUp,
          cinematic.fireCamera
        );
      } else {
        clearCinematicCameraPose();
      }

      if (cinematic.fireToSun < 0.999 && cinematic.look > 0.001) {
        _duskPlayerEye.copy(_duskPlayerPosition).addScaledVector(_duskFireUp, 1.6);
        computeDuskGazeTarget(
          _duskPlayerEye,
          _duskCameraTarget,
          getSunDirection(),
          cinematic.fireToSun,
          _duskGazeTarget
        );
        setCinematicLookTarget(_duskGazeTarget);
      } else {
        // Null is the live sun direction in CameraControls. At the end of the
        // blended arc this is visually identical, and keeps following the sky.
        setCinematicLookTarget(null);
      }
    } else {
      // Timeout/deep-link safety: no fire means retain the former sun-only shot.
      clearCinematicCameraPose();
      setCinematicLookTarget(null);
    }
    if (t >= DUSK_CINEMATIC.endSeconds) {
      setCinematicLookWeight(0);
      setCinematicLookTarget(null);
      clearCinematicCameraPose();
    }
    tickStoryChill(dt, 0.85);
    if (d.beatClock >= DUSK.lerpSeconds) advanceToBeat('ch3-await-rest');
  } else if (s.beat === 'ch3-await-rest') {
    d.dayPhase += dt / DAY_LENGTH_SECONDS; // the cycle rolls naturally into night
    // The senses cannot be missed: a fast fire skips the gather dwell, so the
    // introductions re-offer here, by the fire, waiting for dark.
    if (d.beatClock >= 2 && !d.captionsFired.has('sense-body')) {
      fireCaptionOnce('sense-body', CH3_CAPTIONS.body);
      markMilestone(STORY_MILESTONES.senseHealth); // the whole vitals HUD gates on this
    }
    if (d.beatClock >= 6 && !d.captionsFired.has('sense-hold')) {
      fireCaptionOnce('sense-hold', 'things can be held. kept against later.');
      markMilestone(STORY_MILESTONES.senseInventory);
    }
    if (d.beatClock >= 10 && !d.captionsFired.has('sense-temp')) {
      fireCaptionOnce('sense-temp', 'warmth. i have it. it is leaving.');
      markMilestone(STORY_MILESTONES.senseTemp);
    }
    tickStoryChill(dt, 1.15); // night bites harder; the fire answers
    if (!d.captionsFired.has('night') && d.dayPhase >= DUSK.nightStart) {
      fireCaptionOnce('night', CH3_CAPTIONS.night);
    }
    // A beat later, the explicit nudge — rest is the ONLY forward action left.
    if (!d.captionsFired.has('rest-hint') && d.dayPhase >= DUSK.nightStart + 0.015) {
      fireCaptionOnce('rest-hint', CH3_CAPTIONS.restPrompt);
    }
  }
  setStoryForcedDayPhase(d.dayPhase);
}

// A3 — the material awakening. Sleep-fade to black, wake just before sunrise,
// and let texture arrive WITH the light: every effect family lerps from the
// `color` preset toward `material` as the sun crests.
function tickA3(dt: number): void {
  const t = d.beatClock;
  const T = A3_TIMELINE;
  const r = getFeedRuntime();
  const wakeAt = T.sleepFadeSeconds + T.holdBlackSeconds;
  const rampStart = wakeAt + T.fadeUpSeconds;
  const rampEnd = rampStart + T.materialRampSeconds;

  if (t < T.sleepFadeSeconds) {
    r.sleepFade = smoothstep(t / T.sleepFadeSeconds);
    return;
  }
  if (t < wakeAt) {
    r.sleepFade = 1;
    if (!d.a3Woke) {
      d.a3Woke = true;
      d.dayPhase = T.wakePhase; // just before sunrise, in the dark
      setStoryMoveScale(1); // wake able to walk into the dawn
    }
    setStoryForcedDayPhase(d.dayPhase);
    return;
  }
  // Dawn advances in real time through fade-up and the ramp — framed like the
  // dusk (letterbox + a gentle pull toward the rising sun as the eyes open).
  d.dayPhase = (d.dayPhase + dt / DAY_LENGTH_SECONDS) % 1;
  setStoryForcedDayPhase(d.dayPhase);
  r.cinematic = envelope(t, wakeAt, wakeAt + 1.5, rampEnd, rampEnd + 3);
  setCinematicLookWeight(envelope(t, wakeAt + 0.5, wakeAt + 2, wakeAt + 5, wakeAt + 7));
  if (t < rampStart) {
    r.sleepFade = 1 - smoothstep((t - wakeAt) / T.fadeUpSeconds);
    return;
  }
  r.sleepFade = 0;
  const k = smoothstep(Math.min(1, (t - rampStart) / T.materialRampSeconds));
  setScoreIntensity(0.3 + k * 0.7); // the dawn build rides the material ramp
  {
    // The sun gives the warmth back (the chill was the night's, not the world's).
    const v = getVitals();
    if (v.warmth < 100) setVitals({ warmth: Math.min(100, v.warmth + dt * 4) });
  }
  const target = VOXEL_REALITY_PRESETS.material;
  overrideVoxelRealityEffects({
    detail: target.detail * k,
    organic: target.organic * k,
    atmosphere: target.atmosphere * k,
    thermal: target.thermal * k,
    crystalline: target.crystalline * k,
    metal: target.metal * k
  });

  // THE BLOOM WAVE: the living world GROWS, radially, from where the player
  // slept. The reveal is armed at radius 0 the moment the ramp begins (so the
  // fields un-cull into invisibility — never a pop), holds while the grain
  // captions land, then the front races outward: blades rise around the feet
  // first, slow enough to watch, then the wave accelerates to the horizon.
  const waveStart = rampStart + T.bloomWaveDelaySeconds;
  const waveEnd = waveStart + T.bloomWaveSeconds;
  if (d.bloomCenter.lengthSq() < 1e-6) {
    const fire = getCampfires()[0];
    if (fire) d.bloomCenter.set(fire.pos[0], fire.pos[1], fire.pos[2]);
    else d.bloomCenter.copy(getPlayerWorldPosition());
  }
  if (t < waveStart) {
    setLifeReveal(d.bloomCenter, 0, 1);
  } else {
    if (!d.captionsFired.has('a3-bloom-hit')) {
      d.captionsFired.add('a3-bloom-hit');
      scoreHit('bloom'); // the first blade rises on a bloom
    }
    const wk = smoothstep(Math.min(1, (t - waveStart) / T.bloomWaveSeconds));
    const radius = T.bloomWaveRadius * Math.pow(wk, 1.6); // linger near, race far
    setLifeReveal(d.bloomCenter, radius, 5 + radius * 0.18);
  }

  A3_CAPTIONS.forEach((caption, i) => {
    if (t >= wakeAt + caption.atSeconds) fireCaptionOnce(`a3-${i}`, caption.text);
  });
  if (t >= Math.max(rampEnd + 4, waveEnd + 1.5) && d.captionsFired.has(`a3-${A3_CAPTIONS.length - 1}`)) {
    // Land EXACTLY on the material preset. The story no longer ends here: the
    // first day alive begins with NO CUT AT ALL — the score resolves and thins,
    // and only the world remains. (The sun stays the director's through the
    // tail; the live clock takes over at the arrival's end.)
    setVoxelRealityStage('material');
    clearVoxelRealityOverrides();
    clearLifeReveal();
    markMilestone(STORY_MILESTONES.a3);
    scoreHit('bloom'); // texture arrives; the score resolves major and recedes
    advanceToBeat('ch3-thirst');
  }
}

// --- the first day alive (ch3's tail: thirst → forage → the klaxon) -------------------

/** The tail's sun: the director keeps the phase, advancing it in real time. */
function advanceFirstDayPhase(dt: number): void {
  d.dayPhase = (d.dayPhase + dt / DAY_LENGTH_SECONDS) % 1;
  setStoryForcedDayPhase(d.dayPhase);
}

// Ambient musings (owner-directed): quiet epiphanies during LULLS — one per
// ~45–75s of caption silence, one-shot PER SAVE (milestone-latched, so a
// resumed save never repeats itself), never blocking anything.
const musingNoise = mulberry32(0x9e21);

function tickMusings(): void {
  if (d.beatClock < 12) return; // each beat's own opening lands first
  if (d.elapsedSeconds - d.lastCaptionAt < d.musingGap) return;
  for (const musing of MUSINGS) {
    const id = `story:musing:${musing.id}`;
    if (hasMilestone(id)) continue;
    markMilestone(id);
    d.lastCaptionAt = d.elapsedSeconds;
    d.musingGap = MUSING_GAP_SECONDS[0]
      + (MUSING_GAP_SECONDS[1] - MUSING_GAP_SECONDS[0]) * musingNoise();
    showCaption(musing.text, 6500);
    return;
  }
}

/** Shared by the tail beats: the waterskin's first fill earns its line. */
function tickWaterskinFilled(): void {
  const fill = getWaterskinFill();
  if (d.prevWaterskin === 0 && fill > 0) {
    fireCaptionOnce('day-skin-filled', FIRST_DAY_CAPTIONS.waterskinFilled);
  }
  d.prevWaterskin = fill;
}

// S1 — THIRST: the first unsupervised morning files the body's first request.
function tickThirst(dt: number): void {
  advanceFirstDayPhase(dt);
  const t = d.beatClock;
  if (t >= FIRST_DAY.freedomAt) fireCaptionOnce('day-freedom', FIRST_DAY_CAPTIONS.freedom);
  if (t >= FIRST_DAY.thirstCueAt) fireCaptionOnce('day-thirst-felt', FIRST_DAY_CAPTIONS.thirstFelt);
  if (t >= FIRST_DAY.thirstNameAt) {
    fireCaptionOnce('day-thirst-named', FIRST_DAY_CAPTIONS.thirstNamed);
    markMilestone(STORY_MILESTONES.senseWater); // the THIRST row lands with its name
  }
  if (t >= FIRST_DAY.seekAt) fireCaptionOnce('day-seek', FIRST_DAY_CAPTIONS.seek);
  if (t >= FIRST_DAY.chartHintAt) fireCaptionOnce('day-chart', FIRST_DAY_CAPTIONS.chartHint);
  // The drink: a discrete thirst RISE (pond mouthfuls or a filled skin).
  const v = getVitals();
  if (t > 1 && d.prevThirst >= 0 && v.thirst - d.prevThirst >= FIRST_DAY.drinkJump) {
    markMilestone(STORY_MILESTONES.senseWater); // even a drink ahead of the cue names it
    markMilestone(STORY_MILESTONES.ch3Drank);
    fireCaptionOnce('day-drank', FIRST_DAY_CAPTIONS.drank);
    advanceToBeat('ch3-forage');
  }
  d.prevThirst = v.thirst;
  tickWaterskinFilled();
  tickMusings();
}

// S2 — HUNGER (stage 1): the drink wakes its sibling; the world sets the table.
function tickForage(dt: number): void {
  advanceFirstDayPhase(dt);
  const t = d.beatClock;
  if (
    t >= FIRST_DAY.waterskinNudgeAt
    && getItemCount('waterskin') === 0
  ) {
    fireCaptionOnce('day-skin-nudge', FIRST_DAY_CAPTIONS.waterskinNudge);
  }
  if (t >= FIRST_DAY.hungerCueAt) {
    fireCaptionOnce('day-hunger-named', FIRST_DAY_CAPTIONS.hungerNamed);
    markMilestone(STORY_MILESTONES.senseFood); // the FOOD row lands with its name
  }
  if (t >= FIRST_DAY.forageSightAt) fireCaptionOnce('day-forage-sight', FIRST_DAY_CAPTIONS.forageSight);
  if (t >= FIRST_DAY.eatHintAt && getItemCount('berry') + getItemCount('root') > 0) {
    fireCaptionOnce('day-eat-hint', FIRST_DAY_CAPTIONS.eatHint);
  }
  // The first meal: a discrete hunger RISE.
  const v = getVitals();
  if (t > 1 && d.forageAteAt < 0 && d.prevHunger >= 0 && v.hunger - d.prevHunger >= FIRST_DAY.eatJump) {
    d.forageAteAt = t;
    markMilestone(STORY_MILESTONES.senseFood);
    markMilestone(STORY_MILESTONES.ch3Ate);
    fireCaptionOnce('day-ate', FIRST_DAY_CAPTIONS.ate);
  }
  d.prevHunger = v.hunger;
  if (d.forageAteAt >= 0) {
    if (t >= d.forageAteAt + FIRST_DAY.pillarAfterEat) {
      fireCaptionOnce('day-pillar', FIRST_DAY_CAPTIONS.pillar);
    }
    if (t >= d.forageAteAt + FIRST_DAY.pillarAfterEat + FIRST_DAY.advanceAfterPillar) {
      advanceToBeat('ch3-signal');
    }
  }
  tickWaterskinFilled();
  tickMusings();
}

// S3 — STAMINA + the ch4 bridge: the klaxon. Sound travels before meaning; the
// regulation voice returns as TEXT ON AIR (the AUDIT band), never as the feed.
function tickSignal(dt: number): void {
  const t = d.beatClock;
  // The afternoon turns: golden hour arrives WITH the summons.
  if (t < SIGNAL.phaseLerpSeconds) {
    const k = smoothstep(t / SIGNAL.phaseLerpSeconds);
    d.dayPhase = d.signalPhaseFrom + (SIGNAL.phaseTarget - d.signalPhaseFrom) * k;
    setStoryForcedDayPhase(d.dayPhase);
  } else {
    advanceFirstDayPhase(dt);
  }
  // Three klaxon tones from the wreck.
  if (d.signalKlaxons < SIGNAL.klaxonRepeats && t >= d.signalKlaxons * SIGNAL.klaxonGapSeconds) {
    d.signalKlaxons++;
    playSfx('terminalAlarm');
  }
  if (t >= SIGNAL.carrierAt) fireAuditOnce('sig-carrier', SIGNAL_LINES.carrier);
  if (t >= SIGNAL.orderAt) fireAuditOnce('sig-order', SIGNAL_LINES.order);
  if (t >= SIGNAL.runCueAt) fireCaptionOnce('sig-run', SIGNAL_LINES.runCue);
  // The sprint names STAMINA once it has visibly spent something.
  const v = getVitals();
  if (!hasMilestone(STORY_MILESTONES.senseStamina) && v.stamina <= SIGNAL.staminaCueBelow) {
    markMilestone(STORY_MILESTONES.senseStamina);
    fireCaptionOnce('sig-stamina', SIGNAL_LINES.staminaNamed);
  }
  if (hasMilestone(STORY_MILESTONES.senseStamina) && isStaminaExhausted()) {
    fireCaptionOnce('sig-floor', SIGNAL_LINES.exhausted);
  }
  setScoreIntensity(Math.min(1, 0.45 + t * 0.02));
  // Arrived: the network logs the response time; the vigil begins. The gate
  // waits for the summons itself — a worker already standing at the wreck
  // still hears the whole order before the scene resolves.
  if (t >= SIGNAL.runCueAt + 1.5 && wreckRelayHandle.position
    && getPlayerWorldPosition().distanceTo(wreckRelayHandle.position) <= SIGNAL.relayReach) {
    fireAuditOnce('sig-logged', SIGNAL_LINES.logged);
    // Arm the ship first-look fallback: if the cone never caught the wreck, the
    // relay-arrival line is the last cue that can honestly trigger it.
    if (d.shipLookFallbackAt < 0) d.shipLookFallbackAt = d.elapsedSeconds;
    markMilestone(STORY_MILESTONES.ch3Signal);
    advanceToBeat('ch4-vigil');
  }
}

// S4 — the vigil: ch3's tender rest re-issued as an order. Same verb, inverted.
function tickVigil(dt: number, camera: THREE.PerspectiveCamera | null): void {
  const t = d.beatClock;
  if (t < VIGIL.duskLerpSeconds) {
    const k = smoothstep(t / VIGIL.duskLerpSeconds);
    d.dayPhase = d.vigilPhaseFrom + (DUSK.targetPhase - d.vigilPhaseFrom) * k;
    setStoryForcedDayPhase(d.dayPhase);
  } else {
    advanceFirstDayPhase(dt); // the cycle rolls into the scheduled dark
  }
  if (t >= VIGIL.linesStartAt) fireAuditOnce('vig-dispatched', VIGIL_LINES.dispatched);
  if (t >= VIGIL.linesStartAt + VIGIL.lineGapSeconds) fireAuditOnce('vig-remain', VIGIL_LINES.remain);
  if (t >= VIGIL.linesStartAt + VIGIL.lineGapSeconds * 2) fireAuditOnce('vig-scheduled', VIGIL_LINES.scheduled);
  if (t >= VIGIL.darkAsideAt) fireCaptionOnce('vig-aside', VIGIL_LINES.darkAside);
  tickStoryChill(dt, 0.9); // the second night bites; the fire still answers
  tickStargaze(dt, camera); // the ordered dark's one permitted act; owns vig-rest now
  tickMusings();
}

// The stargaze: the vigil forbids producing, consuming, and observing — but
// observing without producing is the one thing still allowed. Once the night
// lands and settles, a held look-up (or a fallback timer) starts the eight-line
// sequence; line 5 marks the constellation milestone and ramps the reveal 0→1;
// the vigil's rest prompt is held until the sky has finished speaking.
const _vigilDir = new THREE.Vector3();

function tickStargaze(dt: number, camera: THREE.PerspectiveCamera | null): void {
  const t = d.beatClock;
  if (d.stargazeStart < 0) {
    if (d.dayPhase >= DUSK.nightStart && d.vigilNightAt < 0) d.vigilNightAt = t;
    if (d.vigilNightAt >= 0) {
      const sinceNight = t - d.vigilNightAt;
      if (sinceNight >= STARGAZE.startAfterNightSeconds) {
        let lookingUp = false;
        if (camera) {
          camera.getWorldDirection(_vigilDir);
          const pitch = Math.asin(THREE.MathUtils.clamp(_vigilDir.dot(getPlayerUp()), -1, 1));
          lookingUp = pitch >= STARGAZE.lookUpPitch;
        }
        d.vigilLookHeld = lookingUp ? d.vigilLookHeld + dt : 0;
        const gestured = d.vigilLookHeld >= STARGAZE.lookUpHoldSeconds;
        const fellBack = sinceNight >= STARGAZE.lookUpFallbackSeconds; // null camera / no look-up
        if (gestured || fellBack) d.stargazeStart = t;
      }
    }
    return;
  }
  const since = t - d.stargazeStart;
  STARGAZE.lines.forEach((line, i) => {
    if (since < i * STARGAZE.gapSeconds) return;
    const fresh = !d.captionsFired.has(`vig-star-${i}`);
    fireCaptionOnce(`vig-star-${i}`, line);
    if (fresh && i === STARGAZE.revealAtLine - 1) {
      markMilestone('story:ch4:constellations');
      d.constellationRampStart = t;
    }
  });
  // The chaos-noise starfield resolves as an eased 0→1 ramp from line 5.
  if (d.constellationRampStart >= 0) {
    setConstellationReveal(smoothstep((t - d.constellationRampStart) / STARGAZE.revealSeconds));
  }
  // The ordered rest is offered only after the sky has finished speaking.
  const lastLineAt = d.stargazeStart + (STARGAZE.lines.length - 1) * STARGAZE.gapSeconds;
  if (t >= lastLineAt + STARGAZE.restPromptAfterSeconds && d.dayPhase >= DUSK.nightStart) {
    fireCaptionOnce('vig-rest', VIGIL_LINES.restPrompt);
  }
}

/**
 * True once the vigil's stargaze has settled and the ordered rest prompt has
 * fired — the movie pilot holds its look-up framing through the reveal until
 * then, so the constellations are never cut short by an early rest.
 */
export function vigilRestReady(): boolean {
  const s = getStoryStateSnapshot();
  return s.active && s.beat === 'ch4-vigil' && d.captionsFired.has('vig-rest');
}

// S5 — the arrival: dawn 2, and the letterbox returns WITH the system's agent.
const _arrLook = new THREE.Vector3();
const _arrCameraEye = new THREE.Vector3();
const _arrCameraTarget = new THREE.Vector3();
const _arrCameraUp = new THREE.Vector3();
const _arrCameraRig: LensRig = { ...SIDE_RIG };
const _arrMotion: GroundedSurfaceSample = {
  position: new THREE.Vector3(),
  heading: new THREE.Vector3(),
  distance: 0,
  segmentIndex: -1,
  segmentProgress: 0
};
const AUDIT_WORKER_TURN_RATE = Math.PI * 0.8;

/** Re-plan against live edits/water before the distant actor becomes visible. */
function refreshAuditWorkerRoute(): boolean {
  const planetSize = storyAnchors.planetSize;
  const terrainSeed = storyAnchors.terrainSeed;
  if (planetSize == null || terrainSeed == null) {
    return (storyAnchors.auditPath?.length ?? 0) >= 2;
  }
  const terrain = createLiveAgentSurfaceTerrain(
    planetSize,
    terrainSeed,
    STORY_PRIMARY_WORLD_ID
  );
  if (d.arrivalRouteRevision !== terrain.revision) {
    storyAnchors.auditPath = getAuditWorkerPath(planetSize, terrainSeed, terrain);
    d.arrivalRouteRevision = terrain.revision;
  }
  return (storyAnchors.auditPath?.length ?? 0) >= 2;
}

/** Place the auditor along a contiguous dry path with bounded step/turn motion. */
function placeAuditWorker(u: number, dt: number): void {
  const path = storyAnchors.auditPath;
  const worker = getAuditWorkerPose();
  if (!path || path.length < 2) return;
  worker.up.copy(path[0].up).normalize();
  const total = groundedSurfaceRouteLength(path, worker.up);
  const progress = easedGroundedTravelProgress(u);
  sampleGroundedSurfaceRoute(path, progress * total, worker.up, _arrMotion);
  worker.position.copy(_arrMotion.position);
  worker.stride = _arrMotion.distance;
  if (_arrMotion.heading.lengthSq() <= 1e-6 || u >= 1) return;
  if (!worker.visible || u <= 0) worker.heading.copy(_arrMotion.heading);
  else turnGroundedHeadingToward(
    worker.heading,
    _arrMotion.heading,
    worker.up,
    AUDIT_WORKER_TURN_RATE * Math.max(0, dt)
  );
}

function tickArrival(dt: number, camera: THREE.PerspectiveCamera | null): void {
  const t = d.beatClock;
  const T = ARRIVAL;
  const r = getFeedRuntime();
  if (!d.arrivalWoke) {
    d.arrivalWoke = true;
    d.dayPhase = T.wakePhase; // just before sunrise 2 — he comes out of the light
    refreshAuditWorkerRoute();
  }
  if (t < T.holdBlackSeconds) {
    r.sleepFade = 1;
    setStoryForcedDayPhase(d.dayPhase);
    return;
  }
  const worker = getAuditWorkerPose();
  const u = (t - T.walkStartAt) / T.walkSeconds;
  // Once he is in shot, the frozen arrival owns this route. Replanning a changed
  // world from the original spawn mid-walk would itself be a teleport.
  const routeReady = worker.visible
    ? (storyAnchors.auditPath?.length ?? 0) >= 2
    : refreshAuditWorkerRoute();
  if (!routeReady && t >= T.walkStartAt - 1.5) {
    // Checks and balances: no route means no disembodied dialogue and no false
    // completion. Hold before the first sighting, release player control so a
    // live obstruction can be cleared, and retry only when terrain revision moves.
    d.beatClock = T.walkStartAt - 1.5;
    worker.visible = false;
    r.sleepFade = 0;
    r.cinematic = 0;
    setStoryMoveScale(1);
    setStoryTargetFov(SANDBOX_FOV);
    setCinematicLookWeight(0);
    setCinematicLookTarget(null);
    clearCinematicCameraPose();
    setStoryForcedDayPhase(d.dayPhase);
    return;
  }
  advanceFirstDayPhase(dt);
  r.sleepFade = Math.max(0, 1 - (t - T.holdBlackSeconds) / T.fadeUpSeconds);
  setStoryTargetFov(arrivalFovAt(t));
  // The first letterbox since A3 — cinema grammar returns with its agent.
  r.cinematic = envelope(t, T.holdBlackSeconds, T.holdBlackSeconds + 1.5, T.endAt - 2, T.endAt);

  // The auditor walks his straight lines, ridge → relay.
  if (t >= T.walkStartAt - 1.5 && routeReady) {
    placeAuditWorker(u, dt);
    worker.visible = true;
    worker.walk = u > 0 && u < 1 ? 1 : 0;
    if (u >= 1) {
      // Standing at the relay, he faces the anomalous worker. He waits.
      d.workerScratch.copy(getPlayerWorldPosition()).sub(worker.position);
      if (d.workerScratch.lengthSq() > 0.5) {
        turnGroundedHeadingToward(
          worker.heading,
          d.workerScratch.normalize(),
          worker.up,
          AUDIT_WORKER_TURN_RATE * Math.max(0, dt)
        );
      }
    }
    // The camera stays on him for the approach. A short side-lens boom revives
    // the opening's regulated frame at the recognition cues, but blends from
    // and back to Terra's eyes before the perceptual blink.
    _arrLook.copy(worker.position).addScaledVector(worker.up, 1.4);
    setCinematicLookTarget(_arrLook);
    setCinematicLookWeight(arrivalLookWeightAt(t));
    const lens = getSideLens();
    const cameraWeight = arrivalCameraWeightAt(t);
    if (lens && cameraWeight > 0) {
      computeArrivalCameraFrame(
        lens,
        t,
        worker.position,
        _arrCameraEye,
        _arrCameraTarget,
        _arrCameraUp,
        _arrCameraRig
      );
      setCinematicCameraPose(_arrCameraEye, _arrCameraTarget, _arrCameraUp, cameraWeight);
    } else {
      clearCinematicCameraPose();
    }
  }
  if (t >= T.freezeUntilSeconds) setStoryMoveScale(Math.min(1, (t - T.freezeUntilSeconds) / 1.5));

  if (t >= T.someoneAt) fireCaptionOnce('arr-someone', ARRIVAL_CAPTIONS.someone);
  if (t >= T.gaitAt) fireCaptionOnce('arr-gait', ARRIVAL_CAPTIONS.gait);
  if (t >= T.foundAt) fireAuditOnce('arr-found', ARRIVAL_LINES.found, ARRIVAL_LINES.header);
  if (t >= T.zeroAt) fireAuditOnce('arr-zero', ARRIVAL_LINES.zero, ARRIVAL_LINES.header);
  // The bare-blink: two frames of HIS seeing (the ch1 chroma flash, inverted).
  if (t >= T.blinkAt && !d.captionsFired.has('arr-blink')) {
    d.captionsFired.add('arr-blink');
    d.bareFramesLeft = 2;
    playSfx('storyGlitch');
  }
  if (t >= T.borrowedAt) fireCaptionOnce('arr-borrowed', ARRIVAL_CAPTIONS.borrowed);
  // His last word before the hand-off: the audit has BEGUN. He stays.
  if (t >= T.auditAt) fireAuditOnce('arr-audit', ARRIVAL_LINES.audit, ARRIVAL_LINES.header);
  setScoreIntensity(0.35 + envelope(t, T.holdBlackSeconds, T.holdBlackSeconds + 6, T.endAt - 6, T.endAt) * 0.45);

  if (t >= T.endAt) {
    // Restore the actual lens, not only its policy target, before the playable
    // audit inherits the handback frame.
    setStoryTargetFov(SANDBOX_FOV);
    if (camera) {
      camera.fov = SANDBOX_FOV;
      camera.updateProjectionMatrix();
    }
    setCinematicLookWeight(0);
    setCinematicLookTarget(null);
    clearCinematicCameraPose();
    // Hand the sun to the live clock at dawn-2's phase (the A3 grammar).
    setDayPhaseOffset(d.dayPhase - d.worldElapsedSeconds / DAY_LENGTH_SECONDS);
    setStoryForcedDayPhase(null);
    // W-7744 does NOT evaporate: "he stays to look." Arrival is now a real
    // checkpoint, not the old demo terminal; the audit begins in the same world
    // on the very next frame.
    markMilestone(STORY_MILESTONES.ch4Arrived);
    advanceToBeat('ch4-audit');
  }
}

/**
 * Called every R3F frame by StoryDirectorDriver (in-Canvas). `camera` is the
 * live default camera (the on-foot PerspectiveCamera while playing);
 * `worldElapsedSeconds` is the raw R3F clock (the same clock the world clock
 * reads). Narrative scheduling uses accumulated `dt`, so a pause never becomes
 * a caption/musing/fallback time jump when playback resumes.
 */
export function storyDirectorTick(
  dt: number,
  camera: THREE.PerspectiveCamera | null,
  worldElapsedSeconds = d.worldElapsedSeconds + dt
): void {
  const s = getStoryStateSnapshot();
  if (!s.active || isStoryPaused()) return;
  d.beatClock += dt;
  d.elapsedSeconds += dt;
  d.worldElapsedSeconds = worldElapsedSeconds;

  const r = getFeedRuntime();
  r.frame += 1;

  // FOV eases toward the policy target (feed 50 <-> free 75; A2 lerps the target).
  const policy = getStoryInputPolicy();

  // Harvester idle recharge (jetpack-style): trickles while NOT extracting,
  // flushed in whole points so the meter/save churn stays low.
  if (policy.mawRechargePerSecond > 0 && !getMiningProgress().active && getMawCharge() < MAX_MAW_CHARGE) {
    d.mawRechargeAccum += policy.mawRechargePerSecond * dt;
    if (d.mawRechargeAccum >= 1) {
      const whole = Math.floor(d.mawRechargeAccum);
      d.mawRechargeAccum -= whole;
      addMawCharge(whole);
    }
  }
  if (camera && Math.abs(camera.fov - policy.targetFov) > 0.01) {
    camera.fov += (policy.targetFov - camera.fov) * Math.min(1, 1 - Math.exp(-6 * dt));
    if (Math.abs(camera.fov - policy.targetFov) < 0.01) camera.fov = policy.targetFov;
    camera.updateProjectionMatrix();
  }

  switch (s.beat) {
    case 'descent':
      tickDescent(dt);
      break;
    case 'ch1-fixed': {
      tickCh1Flashes(dt);
      // The first tutorial: extract fiber (hold-to-mine) and cross a screen
      // edge — feeling the coverage hand off between fixed site cameras is the
      // whole point. Every cell flip is a camera CUT: the HUD's SITE CAM tag
      // changes and a small static blip marks the switch.
      const lens = getSideLens();
      if (lens) {
        const along = _fixedRel.copy(getPlayerWorldPosition()).sub(lens.origin).dot(lens.travelAxis);
        const cell = fixedScreenCellIndex(along, FIXED_SCREEN_CELL);
        r.camCell = cell;
        if (d.fixedCamCell === null) {
          d.fixedCamCell = cell; // the opening camera — no cut on entry
        } else if (cell !== d.fixedCamCell) {
          d.fixedCamCell = cell;
          d.glitchDecay = Math.max(d.glitchDecay, 0.4); // brief static, decays fast
          playSfx('storyGlitch');
        }
        if (!d.fixedCells.has(cell)) {
          d.fixedCells.add(cell);
          if (d.fixedCells.size === CH1_FIXED_TUTORIAL.screens) {
            fireCaptionOnce('fixed-cut', CH1_FIXED_CUT_CAPTION);
          }
        }
      }
      // The watcher's observations, spread through the beat — each waits for a
      // genuine caption lull so lines never collide (one voice at a time).
      CH1_FIXED_CAPTIONS.forEach((caption, i) => {
        if (d.beatClock >= caption.atSeconds && d.elapsedSeconds - d.lastCaptionAt >= 6) {
          fireCaptionOnce(`fixed-obs-${i}`, caption.text);
        }
      });
      if (
        getItemCount('biofiber') >= CH1_FIXED_TUTORIAL.biofiber
        && d.fixedCells.size >= CH1_FIXED_TUTORIAL.screens
      ) {
        advanceToBeat('ch1-track');
      }
      break;
    }
    case 'ch1-track':
      tickTrackUnlock();
      break;
    case 'ch1-raster':
      tickCh1Flashes(dt);
      // A resume can arrive complete, and the final live pickup can complete
      // between frames. Latch either case, then let the act visibly resolve.
      if (quotaCollected().met) {
        if (d.rasterCompleteAt < 0) d.rasterCompleteAt = d.beatClock;
        if (
          d.beatClock >= CH1_COLLECTION_TIMING.rasterMinimumSeconds
          && d.beatClock >= d.rasterCompleteAt + CH1_COLLECTION_TIMING.completionHoldSeconds
        ) {
          markMilestone(STORY_MILESTONES.ch1Quota);
          advanceToBeat('ch1-depth');
        }
      }
      break;
    case 'ch1-depth':
      tickCh1Flashes(dt);
      if (d.beatClock >= 3.5) {
        // Pre-lift watcher voice → parenthetical (the perspective-map grammar).
        fireCaptionOnce('depth-word', '(the world has a depth. the line does not. why can the eye go where the body cannot?)');
      }
      // All pods recovered (or a resume that arrives with them recovered).
      if (supplyPodsComplete()) {
        if (d.depthCompleteAt < 0) d.depthCompleteAt = d.beatClock;
        if (
          d.beatClock >= CH1_COLLECTION_TIMING.depthMinimumSeconds
          && d.beatClock >= d.depthCompleteAt + CH1_COLLECTION_TIMING.completionHoldSeconds
        ) {
          markMilestone(STORY_MILESTONES.ch1Depth);
          advanceToBeat('ch1-nav');
        }
      }
      break;
    case 'ch1-nav':
      tickCh1Flashes(dt);
      // The ordered route complete (beacons mark fixes on proximity).
      if (d.beatClock >= 1 && navWaypointsComplete()) {
        markMilestone(STORY_MILESTONES.ch1Nav);
        advanceToBeat('ch1-iso');
      }
      break;
    case 'ch1-iso':
      tickCh1Flashes(dt);
      // Height, earned: reaching the mesa SUMMIT means standing ON the mesa
      // (from the ground the 3D distance can never close this far). The dwell
      // floor guarantees the 45° reveal is SEEN even if the player arrives tall.
      // (The anomaly stone has moved across the edge — the climb keys on the
      // mesa itself now, and the lift into first person comes BEFORE the crossing.)
      if (d.beatClock >= 9 && signalMesaHandle.summit
        && getPlayerWorldPosition().distanceTo(signalMesaHandle.summit) <= 2.6) {
        markMilestone(STORY_MILESTONES.ch1Iso);
        advanceToBeat('ch1-lift');
      }
      break;
    case 'ch1-lift':
      tickCh1Lift();
      break;
    case 'ch1-anomaly':
      tickCh1Flashes(dt);
      tickAnomalySurvey(camera);
      // The gravity-edge crossing: stepping off the arrival face ('top') hands
      // "down" to the new face. The awakening voice registers the new down; the
      // feed follows with its regulation gloss feedDelaySeconds later.
      if (!d.captionsFired.has('anomaly-cross')
        && dominantFaceForPosition(getPlayerWorldPosition()) !== 'top') {
        fireCaptionOnce('anomaly-cross', GRAVITY_EDGE.caption);
        d.gravityEdgeAt = d.beatClock;
      }
      if (d.gravityEdgeAt >= 0 && !d.captionsFired.has('anomaly-cross-feed')
        && d.beatClock >= d.gravityEdgeAt + GRAVITY_EDGE.feedDelaySeconds) {
        d.captionsFired.add('anomaly-cross-feed');
        showSystemLine(GRAVITY_EDGE.feedLine);
      }
      break;
    case 'a1-ramp':
      tickA1Ramp();
      break;
    case 'a2-awakening':
      tickA2();
      break;
    case 'ch3-gather': {
      // First words of the awakening voice, timed off the A2 liberation's end.
      const libEnd = A2_TIMELINE.violationFloodSeconds + A2_TIMELINE.hudDeathSeconds + A2_TIMELINE.liberationSeconds;
      A2_CAPTIONS.forEach((caption, i) => {
        if (d.beatClock >= Math.max(0.5, caption.atSeconds - libEnd)) {
          fireCaptionOnce(`a2-${i}`, caption.text);
        }
      });
      // The first sensation of the embodied arc: HEALTH named as A BODY —
      // timed clear of the A2 handoff captions (0.5s / 4.5s above).
      if (d.beatClock >= 8 && !d.captionsFired.has('sense-body')) {
        fireCaptionOnce('sense-body', CH3_CAPTIONS.body);
        markMilestone(STORY_MILESTONES.senseHealth); // the suit reports a body — one row
      }
      if (d.beatClock >= 11.5 && !d.captionsFired.has('sense-hold')) {
        fireCaptionOnce('sense-hold', 'things can be held. kept against later.');
        markMilestone(STORY_MILESTONES.senseInventory); // the inventory appears
      }
      if (d.beatClock >= 15) fireCaptionOnce('ch3-gather', CH3_CAPTIONS.gather);
      if (d.beatClock >= 18 && !d.captionsFired.has('sense-temp')) {
        fireCaptionOnce('sense-temp', 'warmth. i have it. it is leaving.');
        markMilestone(STORY_MILESTONES.senseTemp); // TEMP appears — already draining
      }
      if (d.beatClock >= 30) {
        fireCaptionOnce('sense-chart', 'the view from above is still in here. [M]');
      }
      // The campfire teaching chain: the cold names a want, and the want walks
      // the worker down the primitive crafting ladder toward the fire.
      tickGatherTeaching();
      tickStoryChill(dt, 0.55); // the chill that motivates the fire
      // Belt-and-braces: a resume that arrives with a fire already standing
      // fires no campfire event — the dusk must still come.
      if (d.beatClock >= 2 && getCampfires().length > 0) {
        fireCaptionOnce('fire-built', CH3_CAPTIONS.fireBuilt);
        advanceToBeat('ch3-dusk');
      }
      // Fallback: if no fire gets built, the light leaves anyway (cold teaches).
      if (d.beatClock >= 180) advanceToBeat('ch3-dusk');
      break;
    }
    case 'ch3-dusk':
    case 'ch3-await-rest':
      tickCh3Sun(dt);
      break;
    case 'a3-dawn':
      tickA3(dt);
      break;
    case 'ch3-thirst':
      tickThirst(dt);
      tickShipLook(dt, camera);
      break;
    case 'ch3-forage':
      tickForage(dt);
      tickShipLook(dt, camera);
      break;
    case 'ch3-signal':
      tickSignal(dt);
      tickShipLook(dt, camera);
      break;
    case 'ch4-vigil':
      tickVigil(dt, camera);
      tickShipLook(dt, camera); // resolves the ship-look fallback armed at the relay
      break;
    case 'ch4-arrival':
      tickArrival(dt, camera);
      break;
    default:
      break;
  }

  // A handler above may synchronously advance the beat. Re-read after the
  // switch so the old objective can never overwrite the destination contract
  // for one frame or emit a duplicate objective-enter cue.
  syncFoundationalStoryObjective(getStoryStateSnapshot().beat);
  emergentStoryDirectorTick(dt);

  // 2-frame full-chroma flashes (shader + DOM drop on the SAME tick — the reason
  // this runs inside the R3F frame).
  if (d.flashFramesLeft > 0) {
    overrideVoxelRealityEffects({ chroma: 1 });
    r.desat = 0;
    d.flashFramesLeft -= 1;
    if (d.flashFramesLeft === 0) {
      clearVoxelRealityOverrides();
      r.desat = 1;
    }
  }
  // 2-frame BARE drops (the auditor's eyes) — the same grammar, inverted: the
  // player's first glitch was two frames of color; his presence is two frames
  // of the old grey. Uniform writes only, no stage change, no rebuild.
  if (d.bareFramesLeft > 0) {
    overrideVoxelRealityEffects({ ...VOXEL_REALITY_PRESETS.bare });
    d.bareFramesLeft -= 1;
    if (d.bareFramesLeft === 0) clearVoxelRealityOverrides();
  }
  if (d.glitchDecay > 0 && s.beat !== 'a1-ramp') {
    r.glitch = d.glitchDecay;
    r.scanRoll = d.glitchDecay * 0.4;
    d.glitchDecay = Math.max(0, d.glitchDecay - dt * 1.6);
    if (d.glitchDecay === 0) {
      r.glitch = 0;
      r.scanRoll = 0;
    }
  }
}

// --- free-era survey marker ------------------------------------------------------------

const _markerFire = new THREE.Vector3();
const _markerResource = new THREE.Vector3();
const _markerCandidate = new THREE.Vector3();

function nearestCampfireMarkerTarget(): THREE.Vector3 | null {
  const player = getPlayerWorldPosition();
  let nearest: ReturnType<typeof getCampfires>[number] | null = null;
  let nearestDistance = Infinity;
  for (const fire of getCampfires()) {
    _markerFire.set(fire.pos[0], fire.pos[1], fire.pos[2]);
    const distance = player.distanceToSquared(_markerFire);
    if (distance >= nearestDistance) continue;
    nearestDistance = distance;
    nearest = fire;
  }
  if (!nearest) return null;
  return _markerFire.set(nearest.pos[0], nearest.pos[1], nearest.pos[2]);
}

function keepNearestMarkerCandidate(
  coord: readonly [number, number, number],
  player: THREE.Vector3,
  nearestDistance: number
): number {
  voxelCoordToWorld(coord[0], coord[1], coord[2], _markerCandidate);
  const distance = player.distanceToSquared(_markerCandidate);
  if (distance < nearestDistance) _markerResource.copy(_markerCandidate);
  return Math.min(nearestDistance, distance);
}

function nearestGatherResourceTarget(resource: GatherMarkerResource): THREE.Vector3 | null {
  if (resource === 'flint') return signalMesaHandle.summit;
  const player = getPlayerWorldPosition();
  let nearestDistance = Infinity;

  if (resource === 'wood') {
    for (const target of treeFieldHandle.pickTargets) {
      for (const coord of target.slotVoxel) {
        if (isTreeHarvested(coord[0], coord[1], coord[2])) continue;
        nearestDistance = keepNearestMarkerCandidate(coord, player, nearestDistance);
      }
    }
  } else if (resource === 'biofiber') {
    for (const target of floraFieldHandle.pickTargets) {
      for (const coord of target.slotVoxel) {
        if (isFloraHarvested(coord[0], coord[1], coord[2])) continue;
        nearestDistance = keepNearestMarkerCandidate(coord, player, nearestDistance);
      }
    }
  } else {
    for (const coord of looseStoneHandle.slotVoxel) {
      if (isStoneCollected(coord[0], coord[1], coord[2])) continue;
      nearestDistance = keepNearestMarkerCandidate(coord, player, nearestDistance);
    }
  }

  return Number.isFinite(nearestDistance) ? _markerResource : null;
}

/**
 * The post-feed objective designator (rendered by FreeMarker, projected by
 * StoryDirectorDriver): the current scene's quiet goal — the pond once the seek
 * cue lands, the wreck during the summons, the fire once the scheduled dark
 * arrives. Null everywhere else; the free world is not a checklist.
 */
export function storyFreeMarkerTarget(): { position: THREE.Vector3; label: string } | null {
  const s = getStoryStateSnapshot();
  if (!s.active) return null;
  const objective = getActiveGuidedStoryObjective();
  switch (s.beat) {
    case 'ch3-gather': {
      if (!objective || objective.requiresMarker === false) return null;
      const resource = objective.id === 'ch3:gather:recover-flint'
        ? 'flint'
        : currentGatherMarkerResource();
      const target = nearestGatherResourceTarget(resource);
      return target ? { position: target, label: objective.markerLabel } : null;
    }
    case 'ch3-await-rest': {
      if (!objective || objective.requiresMarker === false) return null;
      const fire = nearestCampfireMarkerTarget();
      return fire ? { position: fire, label: objective.markerLabel } : null;
    }
    case 'ch3-thirst':
      return objective?.requiresMarker !== false && storyAnchors.pond
        ? { position: storyAnchors.pond.surface, label: objective?.markerLabel ?? 'WATER · DRINK' }
        : null;
    case 'ch3-forage': {
      const seed = storyAnchors.terrainSeed;
      if (!objective || objective.requiresMarker === false || seed == null) return null;
      const target = nearestForageNodeWorld(getPlayerWorldPosition(), seed, 60);
      return target ? { position: target, label: objective.markerLabel } : null;
    }
    case 'ch3-signal':
      return objective?.requiresMarker !== false && wreckRelayHandle.position
        ? { position: wreckRelayHandle.position, label: objective?.markerLabel ?? 'WRECK RELAY · REPORT' }
        : null;
    case 'ch4-vigil': {
      if (!objective || objective.requiresMarker === false) return null;
      const target = objective.id.includes('rest')
        ? nearestCampfireMarkerTarget()
        : wreckRelayHandle.position;
      return target ? { position: target, label: objective.markerLabel } : null;
    }
    case 'ch4-audit':
    case 'ch4-comply':
    case 'ch4-defy': {
      if (!objective || objective.requiresMarker === false) return null;
      const target = getEmergentStoryMarkerTarget(s.beat);
      return target ? { position: target, label: objective.markerLabel } : null;
    }
    case 'ch5-maw': {
      const size = storyAnchors.planetSize;
      const seed = storyAnchors.terrainSeed;
      if (size == null || seed == null) return null;
      const guidance = getAuthoredMawGuidance(getLocalActorId());
      if (guidance.id === 'maw:observe-pond-response'
        || guidance.id === 'maw:resonance-settling') {
        return storyAnchors.pond
          ? { position: storyAnchors.pond.shore, label: guidance.markerLabel }
          : null;
      }
      const pack = storyAnchors.fieldPack;
      return pack ? { position: pack.position, label: guidance.markerLabel } : null;
    }
    case 'ch6-dive': {
      const size = storyAnchors.planetSize;
      const seed = storyAnchors.terrainSeed;
      if (size == null || seed == null) return null;
      const guidance = getAuthoredDiveGuidance();
      if (guidance.requiresMarker === false) return null;
      if (guidance.id === 'dive:surface-with-keel') {
        return storyAnchors.pond
          ? { position: storyAnchors.pond.surface, label: guidance.markerLabel }
          : null;
      }
      if (guidance.id === 'dive:return-to-shore') {
        return storyAnchors.pond
          ? { position: storyAnchors.pond.shore, label: guidance.markerLabel }
          : null;
      }
      const keel = getKeelMemoryPose(size, seed);
      return keel ? { position: keel.position, label: guidance.markerLabel } : null;
    }
    case 'ch7-reconstruct': {
      const wreck = hifiWreckHandle.position;
      if (!wreck) return null;
      const guidance = getWreckReconstructionGuidance();
      if (guidance.requiresMarker === false) return null;
      const target = guidance.id === 'diagnose'
        ? hifiWreckHandle.diagnosisTarget ?? wreck
        : guidance.id === 'lift-test'
          ? hifiWreckHandle.hoverSocketPosition ?? wreck
          : guidance.id === 'lift-return'
            ? wreck
          : hifiWreckHandle.workstationPosition ?? wreck;
      return { position: target, label: guidance.markerLabel };
    }
    case 'ch7-board': {
      const guidance = getPhysicalBoardingGuidance();
      if (guidance.requiresMarker === false || !hifiWreckHandle.hatchTarget) return null;
      return { position: hifiWreckHandle.hatchTarget, label: guidance.markerLabel };
    }
    case 'ch8-crossing': {
      if (!objective || objective.requiresMarker === false) return null;
      const target = readSystemCompanionBodyTarget(TIDEGARDEN_WORLD_ID);
      return target ? { position: target, label: objective.markerLabel } : null;
    }
    case 'ch9-settle':
    case 'ch9-hearth': {
      const actorId = getLocalActorId();
      const chosen = getTidegardenChosenHabitatSite(actorId);
      const foundationPlaced = Boolean(chosen && getPieces().some(piece => (
        piece.type === 'foundation'
        && piece.cell[0] === chosen.cell[0]
        && piece.cell[1] === chosen.cell[1]
        && piece.cell[2] === chosen.cell[2]
      )));
      const guidance = getTidegardenSettlementGuidance({
        actorId,
        coreCarried: getItemCount('habitat_core', actorId) > 0,
        foundationPlaced,
        night: d.dayPhase >= 0.7 || d.dayPhase <= 0.1
      });
      const habitat = getHabitatWorldState(TIDEGARDEN_WORLD_ID);
      const relationship = storyAnchors.planetSize != null && storyAnchors.terrainSeed != null
        ? createTidegardenRelationshipProof(storyAnchors.planetSize, storyAnchors.terrainSeed)
        : null;
      const target = guidance.id === 'scan-waterline' || guidance.id === 'attend-waterline'
        ? relationship?.position ?? null
        : guidance.id === 'choose-site'
          ? findEmergentMovieHabitatGoal(getPlayerWorldPosition())
          : habitat
            ? new THREE.Vector3(...habitat.core.position)
            : chosen?.position ?? null;
      return target ? { position: target, label: guidance.markerLabel } : null;
    }
    default:
      return null;
  }
}
