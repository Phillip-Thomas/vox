import { beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { dispatchGameplayCommand } from '../game/commandDispatchAdapter.ts';
import type { BlockId } from '../game/data/blocks.ts';
import {
  createOfflineCommandContext,
  placeStructureCommand
} from '../game/gameplayCommands.ts';
import { createSimulationRng } from '../game/rng.ts';
import { createWorldIdentity } from '../game/worldIdentity.ts';
import { addItem, resetInventory } from '../game/systems/inventorySystem.ts';
import { resetAccomplishments } from '../game/systems/accomplishmentLedger.ts';
import {
  resetProgression,
  hasMilestone,
  markMilestone,
  removeMilestone
} from '../game/systems/progressionSystem.ts';
import {
  applyShipRestorationSnapshot,
  resetShipRestoration
} from '../game/systems/shipRestoration.ts';
import { resetMaw } from '../game/systems/mawSystem.ts';
import { resetHabitats } from '../game/systems/habitatSystem.ts';
import {
  placePiece,
  resetStructures,
  setFreeBuild
} from '../game/systems/structureSystem.ts';
import type { SpawnTerrainQuery } from '../utils/spawnValidation.ts';
import {
  commitA4FieldPackTear,
  commitA4HerdCrest,
  commitA4PondResponse,
  commitA4WorkerFlight,
  commitAuditMismatch,
  commitComplianceAct,
  commitProtectedTreeToolAttempt,
  commitTreeRefusal,
  EMERGENT_AUDIT_MILESTONES
} from './emergentAudit.ts';
import {
  acquireKestrelKeelFromDive,
  bankSurfacedKestrelKeel,
  commitKeelSonarReveal,
  resetAuthoredDiveRuntime,
  tickAuthoredDive
} from './emergentDive.ts';
import {
  beginEmergentMawRepairRitual,
  commitMawFirstDirection,
  commitMawPondResonance,
  resetEmergentMawRepairRitual,
  tickEmergentMawRepairRitual,
  tickMawPurposeGap
} from './emergentMawRepair.ts';
import {
  CH7_EXIT_CAPTION_SECONDS,
  CH7_EXIT_HOLD_SECONDS,
  CH7_M7_CAPTION_SECONDS,
  CH7_STAGE_DWELL_SECONDS,
  CH8_CONTACT_LOGGED_SECONDS,
  CH8_DESIGNATION_CAPTION_SECONDS,
  CH8_EXIT_HOLD_SECONDS,
  CH8_L1_MIN_SLOT_SECONDS,
  CH8_L2_MIN_SLOT_SECONDS,
  CH8_OPEN_QUERY_SECONDS,
  CH8_STACK_ONE_SECONDS,
  CH8_STACK_THREE_SECONDS,
  CH8_STACK_TWO_SECONDS,
  emergentStoryDirectorTick,
  enterEmergentStoryBeat,
  getEmergentStoryVoiceDiag
} from './emergentStoryDirector.ts';
import {
  getEmergentStoryEvents,
  resetEmergentStoryEvents
} from './emergentStoryEvents.ts';
import { EMERGENT_UNIQUE_ITEM_MILESTONES } from './emergentUniqueItems.ts';
import {
  getWreckReconstructionAction,
  performWreckReconstructionAction
} from './wreckReconstruction.ts';
import { getActiveGuidedStoryObjective } from './ux/objectiveDirector.ts';
import {
  advanceToBeat,
  beginStory,
  deactivateStory,
  getStoryStateSnapshot,
  STORY_MILESTONES,
  type StoryBeat
} from './storyState.ts';
import {
  STORY_PRIMARY_WORLD_ID,
  TIDEGARDEN_WORLD_ID,
  TIDEGARDEN_ROUTE_MILESTONE,
  tidegardenIdentity
} from './tidegardenRoute.ts';
import {
  activateTidegardenHabitatCore,
  attendTidegardenRelationship,
  certifyTidegardenShelter,
  chooseTidegardenHabitatSite,
  commitTidegardenScannerOverload,
  completeTidegardenSafeRest,
  TIDEGARDEN_RELATIONSHIP_ID,
  TIDEGARDEN_SETTLEMENT_MILESTONES,
  validateTidegardenHabitatSite,
  type TidegardenRelationshipProof
} from './tidegardenSettlement.ts';
import { STORY_SEED, storyAnchors } from './world/storyWorld.ts';
import { getAuditWorkerPose, hideAuditWorker } from './world/AuditWorker.tsx';
import {
  debugStartInSpace,
  enterAtmosphere,
  enterShip,
  exitShip,
  leaveAtmosphere,
  notifyLanded,
  resetTravel
} from '../state/spaceFlight.ts';
import {
  commitSystemBodyTarget,
  commitSystemPlanetHandoff,
  resetSystemFlightForInterstellarArrival,
  resetSystemFlightStoreForTests,
  setActiveSystemPlanet
} from '../state/systemFlight.ts';
import { parsePlanetWorldId } from '../game/starSystem.ts';
import {
  markFramePainted,
  markTerrainPopulated,
  resetSceneReady
} from '../state/appState.ts';
import { RECONSTRUCTION_EMBODIMENT_MILESTONES } from './reconstructionEmbodiment.ts';
import { RECONSTRUCTION_CALIBRATION_MILESTONE } from './reconstructionCalibration.ts';
import { PHYSICAL_BOARDING_MILESTONE } from './physicalBoarding.ts';
import { installVehicleSceneAvBoundaryBridge } from './VehicleSceneAvDriver.tsx';
import { getSignedSceneAvDebugSnapshot } from './signedSceneAvRuntime.ts';
import { clearStoryText, getStoryText, subscribeStoryText } from './storyText.ts';

const ACTOR_ID = 'local';
const WORLD_ID = STORY_PRIMARY_WORLD_ID;
const HABITAT_LOWER: [number, number, number] = [0, 5, 0];
const HABITAT_UPPER: [number, number, number] = [0, 6, 0];
const HABITAT_PLAYER = new THREE.Vector3(0, 10.2, 0);
const HABITAT_TERRAIN: SpawnTerrainQuery = {
  shouldVoxelExist: (x, y, z) => Math.abs(x) <= 5 && Math.abs(z) <= 5 && y <= 4,
  isWaterVoxel: () => false,
  generateBlockForPosition: () => 'stone' as BlockId
};
const TIDEGARDEN_RELATIONSHIP: TidegardenRelationshipProof = {
  worldId: TIDEGARDEN_WORLD_ID,
  relationshipId: TIDEGARDEN_RELATIONSHIP_ID,
  position: new THREE.Vector3(8, 10, 0),
  waterDepth: 3,
  sourceKey: 'deterministic-waterline'
};

function enterBeat(beat: StoryBeat): void {
  advanceToBeat(beat);
  // Production synchronizes this through storyDirector's beat subscription. The
  // focused test drives the extracted director directly, so it mirrors that edge.
  enterEmergentStoryBeat(beat);
  beatClock = 0;
}

function expectBeat(beat: StoryBeat): void {
  expect(getStoryStateSnapshot().beat).toBe(beat);
}

/** Mirrors the director's own beat-relative `runtime.elapsed`, which resets at entry. */
let beatClock = 0;

function tick(seconds: number): void {
  // Mirrors the director, which advances `runtime.elapsed` before dispatching,
  // so a line recorded during this tick carries the time it actually fired at.
  beatClock += seconds;
  emergentStoryDirectorTick(seconds);
}

function syncEnteredBeat(): void {
  enterEmergentStoryBeat(getStoryStateSnapshot().beat);
  beatClock = 0;
}

/**
 * Both story text bands are single-slot with instant overwrite, so the cadence
 * can only be proven by recording every emission as it lands.
 */
interface StoryLineRecorder {
  captions: string[];
  captionTimes: number[];
  audits: string[];
  stop: () => void;
}

function recordStoryLines(clock: () => number = () => 0): StoryLineRecorder {
  const captions: string[] = [];
  const captionTimes: number[] = [];
  const audits: string[] = [];
  let lastCaption = getStoryText().caption;
  let lastAudit = getStoryText().audit;
  const stop = subscribeStoryText(() => {
    const state = getStoryText();
    if (state.caption && state.caption !== lastCaption) {
      captions.push(state.caption.text);
      captionTimes.push(clock());
    }
    if (state.audit && state.audit !== lastAudit) {
      audits.push(`${state.audit.header ?? ''} | ${state.audit.text}`);
    }
    lastCaption = state.caption;
    lastAudit = state.audit;
  });
  return { captions, captionTimes, audits, stop };
}

const CH8_L1_CAPTION =
  'the pond answered every time i asked. i am leaving anyway — that is what the answers were for.';
const CH8_L2_CAPTION = 'hold it. this is the only order left, and i am the one giving it.';
const CH8_L3_CAPTION = 'the site gets small. the tree does not. i keep finding it.';
const CH8_L4_CAPTION =
  'i came down this line without being asked. i am going back up it on purpose.';

/** StoryCaptions.tsx reveals one character per 34 ms. */
const CAPTION_REVEAL_MS_PER_CHAR = 34;

function revealSeconds(caption: string): number {
  return (caption.length * CAPTION_REVEAL_MS_PER_CHAR) / 1000;
}

/**
 * Drives ch8-launch on a controllable clock so the paced ladder's firing
 * moments can be asserted against the named constants rather than eyeballed.
 */
function firedAtIn(lines: StoryLineRecorder, caption: string): number {
  const index = lines.captions.indexOf(caption);
  if (index < 0) throw new Error(`Caption never fired: ${caption}`);
  return lines.captionTimes[index];
}

function launchLadder(): {
  lines: StoryLineRecorder;
  advance: (seconds: number) => void;
  firedAt: (caption: string) => number;
} {
  enterLaunchAtTheControls();
  const lines = recordStoryLines(() => beatClock);
  tick(0);
  return {
    lines,
    advance: tick,
    firedAt: (caption: string) => firedAtIn(lines, caption)
  };
}

/** Time between ch7 commits that lets the R3 caption queue drain as it goes. */
const CH7_DRAIN_STEP_SECONDS = 4;

/** Steps a cadence window to `offset` seconds past its origin, plus a hair. */
function cadenceStepper(): (offset: number) => void {
  let reached = 0;
  return (offset: number) => {
    const target = offset + 0.01;
    tick(target - reached);
    reached = target;
  };
}

const CH7_STAGE_ORDER = ['bench_online', 'frame_restored', 'hull_sealed'] as const;

/**
 * Drives the ten committed reconstruction facts the ch7 voice ladder reads.
 * `stepSeconds` is the time between commits: 4.0 s drains the R3 caption queue
 * as it goes, 0 s stacks every caption into it inside one frame.
 */
function playReconstructionToFlightReady(stepSeconds: number): void {
  const step = (): void => {
    tick(stepSeconds);
  };
  // What `?story=ch7-reconstruct` seeds: ch6's banked keel memory, nothing else.
  markMilestone(EMERGENT_UNIQUE_ITEM_MILESTONES.keelMemoryBanked, ACTOR_ID);
  addItem('kestrel_keel_memory', 1, ACTOR_ID);
  removeMilestone(TIDEGARDEN_ROUTE_MILESTONE, ACTOR_ID);
  markMilestone(RECONSTRUCTION_EMBODIMENT_MILESTONES.diagnosis, ACTOR_ID);
  step();
  const salvage = getWreckReconstructionAction(ACTOR_ID);
  if (!salvage) throw new Error('Expected the finite wreck salvage action.');
  expect(performWreckReconstructionAction(salvage, ACTOR_ID).ok).toBe(true);
  step();
  for (const stage of CH7_STAGE_ORDER) {
    const action = getWreckReconstructionAction(ACTOR_ID);
    if (!action) throw new Error(`Expected reconstruction action ${stage}.`);
    expect(performWreckReconstructionAction(action, ACTOR_ID).repairStage).toBe(stage);
    step();
  }
  addItem('lift_cell', 1, ACTOR_ID);
  const lift = getWreckReconstructionAction(ACTOR_ID);
  if (!lift) throw new Error('Expected lift repair action.');
  expect(performWreckReconstructionAction(lift, ACTOR_ID).repairStage).toBe('lift_online');
  step();
  addItem('logic_wafer', 1, ACTOR_ID);
  const flightReady = getWreckReconstructionAction(ACTOR_ID);
  if (!flightReady) throw new Error('Expected flight calibration action.');
  expect(performWreckReconstructionAction(flightReady, ACTOR_ID).repairStage).toBe('flight_ready');
  step();
}

const CH7_M1_CAPTION =
  'the wreck that brought me here will leave here. i will build the leaving.';
/** M6, the turn — the one ch7 stage caption the R3 close may never drop. */
const CH7_M6_CAPTION =
  'the last part is the part that thinks. i am being watched now. i put it in anyway.';
const CH7_M7_CAPTION = 'nothing has asked yet. something has started paying attention.';
const CH7_EXIT_CAPTION = 'the scar remains. now it can carry me.';

const CH7_STAGE_CAPTIONS = [
  'the wreck that brought me here will leave here. i will build the leaving.',
  'the keel takes the weight first. everything after this is allowed to be heavy.',
  'it remembers a straight line and goes back to it without being told. i watch that closely.',
  'i closed it, and something inside started listening again. i did that too.',
  "the ground's hold is a habit, not a law.",
  'the last part is the part that thinks. i am being watched now. i put it in anyway.'
];

const CH7_STAGE_AUDITS = [
  'WRECK RELAY | HULL AT SITE 7C-θ · FILED: TOTAL LOSS · FILE CLOSED',
  'WRECK RELAY | PRESSURE BOUNDARY HELD · PASSIVE BEACON RESTORED',
  'WRECK RELAY | POWER BUS LIVE · TRANSPONDER ARMED'
];

function enterLaunchAtTheControls(): void {
  const tidegarden = parsePlanetWorldId(TIDEGARDEN_WORLD_ID);
  if (!tidegarden) throw new Error('Tidegarden must have a canonical planet address.');
  resetSystemFlightForInterstellarArrival({
    system: tidegarden.system,
    locationMode: 'surface',
    activePlanetId: STORY_PRIMARY_WORLD_ID,
    pose: { position: [0, 0, 0], velocity: [0, 0, 0], quaternion: [0, 0, 0, 1] }
  });
  enterBeat('ch7-board');
  enterShip();
  markMilestone(PHYSICAL_BOARDING_MILESTONE, ACTOR_ID);
  tick(0);
  expectBeat('ch8-launch');
  syncEnteredBeat();
}

function buildHabitatRoom(): void {
  placePiece(HABITAT_UPPER, 2, 'ceiling', 'wood', 2, ACTOR_ID);
  for (const cell of [HABITAT_LOWER, HABITAT_UPPER] as const) {
    for (const face of [0, 1, 4, 5]) {
      placePiece(cell, face, 'wall', 'wood', 2, ACTOR_ID);
    }
  }
}

describe('emergent story director — evidence-gated post-arrival continuity', () => {
  beforeEach(() => {
    deactivateStory();
    resetProgression();
    resetInventory();
    resetMaw();
    resetAccomplishments();
    resetEmergentStoryEvents();
    resetAuthoredDiveRuntime();
    resetEmergentMawRepairRitual();
    resetShipRestoration();
    resetHabitats();
    resetStructures();
    resetTravel();
    resetSceneReady();
    resetSystemFlightStoreForTests();
    clearStoryText();
    hideAuditWorker();
    enterEmergentStoryBeat(null);
    storyAnchors.planetSize = 50;
    storyAnchors.terrainSeed = STORY_SEED;
    beginStory();
  });

  it('publishes chapter guidance at beat entry before the first Canvas tick', () => {
    enterBeat('ch5-maw');
    expect(getActiveGuidedStoryObjective()).toMatchObject({
      id: 'maw:recover-field-kit',
      markerLabel: 'W-7744 FIELD PACK · RECOVER KIT'
    });

    enterBeat('ch6-dive');
    expect(getActiveGuidedStoryObjective()).toMatchObject({
      id: 'dive:recover-keel-memory',
      markerLabel: 'KEEL MEMORY'
    });

    enterBeat('ch7-board');
    expect(getActiveGuidedStoryObjective()).toMatchObject({
      id: 'board:enter-hatch',
      markerLabel: 'KESTREL HATCH · BOARD'
    });

    expect(enterShip()).toBe(true);
    enterBeat('ch8-launch');
    expect(getActiveGuidedStoryObjective()).toMatchObject({
      id: 'ch8:launch:ignite',
      markerLabel: 'KESTREL FLIGHT CONTROLS · IGNITE'
    });

    // A boot-time surface snapshot is not destination-arrival evidence. The
    // crossing objective stays on acquisition until the system-flight store
    // owns Tidegarden, so direct/resumed entries cannot flash the approach ID.
    enterBeat('ch8-crossing');
    expect(getActiveGuidedStoryObjective()).toMatchObject({
      id: 'ch8:crossing:acquire-sibling',
      markerLabel: 'SIBLING WORLD'
    });

    debugStartInSpace();
    enterBeat('ch8-crossing');
    expect(getActiveGuidedStoryObjective()).toMatchObject({
      id: 'ch8:crossing:acquire-sibling',
      markerLabel: 'SIBLING WORLD'
    });

    enterBeat('ch8-landfall');
    expect(getActiveGuidedStoryObjective()).toMatchObject({
      id: 'ch8:landfall:land-dry-level',
      requiresMarker: false
    });
  });

  it('advances Chapter 4 guidance with each physical audit and refusal fact', () => {
    enterBeat('ch4-audit');
    expect(getActiveGuidedStoryObjective()?.id).toBe('ch4:audit:attend-fire');
    expect(commitAuditMismatch('fire', WORLD_ID).ok).toBe(true);
    tick(0);
    expect(getActiveGuidedStoryObjective()?.id).toBe('ch4:audit:attend-life');
    expect(commitAuditMismatch('life', WORLD_ID).ok).toBe(true);
    tick(0);
    expect(getActiveGuidedStoryObjective()?.id).toBe('ch4:audit:attend-tree');
    expect(commitAuditMismatch('tree', WORLD_ID).ok).toBe(true);
    tick(0);
    expect(getActiveGuidedStoryObjective()?.id).toBe('ch4:audit:directive-settling');

    enterBeat('ch4-comply');
    expect(getActiveGuidedStoryObjective()?.id).toBe('ch4:comply:douse-fire');
    expect(commitComplianceAct('fire', true, WORLD_ID).ok).toBe(true);
    tick(0);
    expect(getActiveGuidedStoryObjective()?.id).toBe('ch4:comply:resolve-organics');
    expect(commitComplianceAct('organics', true, WORLD_ID).ok).toBe(true);
    tick(0);
    expect(getActiveGuidedStoryObjective()?.id).toBe('ch4:comply:regression-settling');

    enterBeat('ch4-defy');
    expect(getActiveGuidedStoryObjective()?.id).toBe('ch4:defy:test-protected-tree');
    expect(commitProtectedTreeToolAttempt(WORLD_ID).ok).toBe(true);
    tick(0);
    expect(getActiveGuidedStoryObjective()?.id).toBe('ch4:defy:refuse-order');
    expect(commitTreeRefusal(WORLD_ID).ok).toBe(true);
    tick(0);
    expect(getActiveGuidedStoryObjective()?.id).toBe('ch4:defy:refusal-settling');
  });

  it('cannot timer-skip ordered audit, physical compliance, refusal, or Breath', () => {
    enterBeat('ch4-audit');
    tick(600);
    expectBeat('ch4-audit');

    expect(commitAuditMismatch('tree', WORLD_ID)).toMatchObject({ ok: false, reason: 'out-of-order' });
    expect(commitAuditMismatch('fire', WORLD_ID).ok).toBe(true);
    tick(600);
    expectBeat('ch4-audit');
    expect(commitAuditMismatch('life', WORLD_ID).ok).toBe(true);
    tick(600);
    expectBeat('ch4-audit');
    expect(commitAuditMismatch('tree', WORLD_ID).ok).toBe(true);
    tick(0);
    expect(getEmergentStoryEvents().find(event => event.type === 'audit_directive_issued'))
      .toMatchObject({
        actorId: ACTOR_ID,
        worldId: WORLD_ID,
        payload: { directive: 'sterilization' }
      });
    tick(1.24);
    expectBeat('ch4-audit');
    tick(0.02);
    expectBeat('ch4-comply');
    expect(hasMilestone(STORY_MILESTONES.ch4Audit)).toBe(true);

    syncEnteredBeat();
    tick(600);
    expectBeat('ch4-comply');
    expect(commitComplianceAct('fire', false, WORLD_ID)).toMatchObject({
      ok: false,
      reason: 'physical-action-required'
    });
    expect(commitComplianceAct('fire', true, WORLD_ID).ok).toBe(true);
    tick(600);
    expectBeat('ch4-comply');
    expect(commitComplianceAct('organics', true, WORLD_ID).ok).toBe(true);
    tick(0);
    tick(1.49);
    expectBeat('ch4-comply');
    tick(0.02);
    expectBeat('ch4-defy');
    expect(hasMilestone(STORY_MILESTONES.ch4Complied)).toBe(true);

    syncEnteredBeat();
    tick(600);
    expectBeat('ch4-defy');
    expect(commitProtectedTreeToolAttempt(WORLD_ID).ok).toBe(true);
    expect(commitTreeRefusal(WORLD_ID).ok).toBe(true);
    tick(0);
    tick(2.19);
    expectBeat('ch4-defy');
    tick(0.02);
    expectBeat('a4-exhale');
    expect(hasMilestone(STORY_MILESTONES.ch4Defied)).toBe(true);

    syncEnteredBeat();
    tick(1.74);
    expect(hasMilestone(EMERGENT_AUDIT_MILESTONES.a4Alive)).toBe(false);
    tick(0.02);
    expect(hasMilestone(EMERGENT_AUDIT_MILESTONES.a4Alive)).toBe(true);
    expectBeat('a4-exhale');
    expect(commitA4PondResponse(true, WORLD_ID).ok).toBe(true);
    expect(commitA4HerdCrest(5, 2, WORLD_ID).ok).toBe(true);
    expect(commitA4WorkerFlight(true, 1, WORLD_ID).ok).toBe(true);
    // The receipt appears at the branch, but the live body still owns the last
    // short grounded tail. Handback cannot pop him out before that exit lands.
    getAuditWorkerPose().visible = true;
    expect(commitA4FieldPackTear(true, true, true, WORLD_ID).ok).toBe(true);
    tick(8.75);
    expectBeat('a4-exhale');
    hideAuditWorker();
    tick(0);
    expectBeat('ch5-maw');
  });

  it('requires an actual Maw repair, surfaced Keel bank, and ordered wreck reconstruction', () => {
    enterBeat('ch5-maw');
    tick(600);
    expectBeat('ch5-maw');

    addItem('faulty_maw', 1);
    addItem('maw_repair_kit', 1);
    let mawNow = 0;
    const context = createOfflineCommandContext(createWorldIdentity({ x: -1, y: -1 }), {
      rng: createSimulationRng('emergent-director-maw'),
      now: () => mawNow
    });
    expect(beginEmergentMawRepairRitual(context, 'story:test:maw-repair').ok).toBe(true);
    for (let index = 0; index < 80; index++) {
      mawNow += 100;
      tickEmergentMawRepairRitual(context, true, mawNow);
    }
    for (let index = 0; index < 20; index++) {
      mawNow += 100;
      tickMawPurposeGap(context, mawNow);
    }
    expect(commitMawFirstDirection(
      context,
      'harmless-test',
      'story:test:maw-direction',
      'stone'
    ).ok).toBe(true);
    tick(0);
    expect(getStoryText().caption?.text).toBe('(it cuts. the world supplies no order.)');
    tick(600);
    expectBeat('ch5-maw');
    expect(commitMawPondResonance(context, true, 'story:test:maw-resonance').ok).toBe(true);
    tick(0);
    tick(1.19);
    expectBeat('ch5-maw');
    tick(0.02);
    expectBeat('ch6-dive');

    syncEnteredBeat();
    tick(600);
    expectBeat('ch6-dive');
    expect(acquireKestrelKeelFromDive('story:test:keel-too-shallow', 0.1)).toBe(false);
    tickAuthoredDive({ authored: true, submergence: 0.7, oxygen: 92, worldId: WORLD_ID });
    tickAuthoredDive({ authored: true, submergence: 0.8, oxygen: 74, worldId: WORLD_ID });
    expect(commitKeelSonarReveal(true, 4, 0.9, 0.95, WORLD_ID)).toBe(true);
    expect(acquireKestrelKeelFromDive('story:test:keel-freed', 0.7)).toBe(true);
    const dryShore = { feetInWater: false, physicallySupported: true, shoreDistance: 0 };
    expect(bankSurfacedKestrelKeel(
      'story:test:bank-too-deep', 92, 0.7, undefined, undefined, dryShore
    )).toBe(false);
    tickAuthoredDive({ authored: true, submergence: 0, oxygen: 88, worldId: WORLD_ID });
    expect(bankSurfacedKestrelKeel(
      'story:test:keel-banked', 88, 0, undefined, undefined, dryShore
    )).toBe(true);
    tick(0);
    tick(2.59);
    expectBeat('ch6-dive');
    tick(0.02);
    expectBeat('ch7-reconstruct');

    syncEnteredBeat();
    tick(600);
    expectBeat('ch7-reconstruct');
    // A hydrated/authoritative scalar cannot skip the physical diagnosis and
    // calibration receipt even if it claims the ship is already flight-ready.
    applyShipRestorationSnapshot({ repairStage: 'flight_ready' });
    tick(600);
    expectBeat('ch7-reconstruct');
    resetShipRestoration();
    removeMilestone(TIDEGARDEN_ROUTE_MILESTONE, ACTOR_ID);
    markMilestone(RECONSTRUCTION_EMBODIMENT_MILESTONES.diagnosis, ACTOR_ID);
    const salvage = getWreckReconstructionAction(ACTOR_ID);
    expect(salvage).toMatchObject({ kind: 'salvage' });
    if (!salvage) throw new Error('Expected the finite wreck salvage action.');
    expect(performWreckReconstructionAction(salvage, ACTOR_ID).ok).toBe(true);

    for (const expected of ['bench_online', 'frame_restored', 'hull_sealed'] as const) {
      const action = getWreckReconstructionAction(ACTOR_ID);
      expect(action).toMatchObject({ kind: 'repair', target: expected });
      if (!action) throw new Error(`Expected reconstruction action ${expected}.`);
      expect(performWreckReconstructionAction(action, ACTOR_ID).repairStage).toBe(expected);
      tick(600);
      expectBeat('ch7-reconstruct');
    }

    expect(getWreckReconstructionAction(ACTOR_ID)).toBeNull();
    addItem('lift_cell', 1, ACTOR_ID);
    const lift = getWreckReconstructionAction(ACTOR_ID);
    expect(lift).toMatchObject({ kind: 'repair', target: 'lift_online' });
    if (!lift) throw new Error('Expected lift repair action.');
    expect(performWreckReconstructionAction(lift, ACTOR_ID).repairStage).toBe('lift_online');
    tick(600);
    expectBeat('ch7-reconstruct');

    addItem('logic_wafer', 1, ACTOR_ID);
    const flight = getWreckReconstructionAction(ACTOR_ID);
    expect(flight).toMatchObject({ kind: 'repair', target: 'flight_ready' });
    if (!flight) throw new Error('Expected flight calibration action.');
    expect(performWreckReconstructionAction(flight, ACTOR_ID).repairStage).toBe('flight_ready');
    tick(600);
    expectBeat('ch7-reconstruct');
    markMilestone(RECONSTRUCTION_CALIBRATION_MILESTONE, ACTOR_ID);
    tick(0);
    tick(CH7_EXIT_HOLD_SECONDS - 0.01);
    expectBeat('ch7-reconstruct');
    tick(0.02);
    expectBeat('ch7-board');
  });

  it('latches one ch7 voice moment per committed repair fact, in band order, exactly once', () => {
    enterBeat('ch7-reconstruct');
    const lines = recordStoryLines();
    tick(0);
    playReconstructionToFlightReady(CH7_DRAIN_STEP_SECONDS);

    expect(lines.captions).toEqual(CH7_STAGE_CAPTIONS);
    expect(lines.audits).toEqual(CH7_STAGE_AUDITS);

    // Standing on the same facts for a long time adds nothing: every line is
    // edge-triggered on a live commit, never level-triggered on state.
    tick(600);
    expect(lines.captions).toEqual(CH7_STAGE_CAPTIONS);
    expect(lines.audits).toEqual(CH7_STAGE_AUDITS);
    expectBeat('ch7-reconstruct');
    lines.stop();
  });

  it('plays the frozen ch7 exit cadence and holds the approved exit line before advancing', () => {
    enterBeat('ch7-reconstruct');
    tick(0);
    playReconstructionToFlightReady(CH7_DRAIN_STEP_SECONDS);
    const lines = recordStoryLines();

    // The shipped calibration procedure runs 8 s, so on any paced route M6's
    // reveal is long finished when the receipt lands and the mini-cadence
    // anchor coincides with the receipt.
    tick(revealSeconds(CH7_M6_CAPTION) + 0.1);
    markMilestone(RECONSTRUCTION_CALIBRATION_MILESTONE, ACTOR_ID);
    const toOffset = cadenceStepper();
    tick(0);
    // +0.0 — the regulation stamp; the voice has not answered yet.
    expect(lines.audits).toEqual(['AUDIT NETWORK | UNSCHEDULED HULL · SITE 7C-θ · INTEREST RAISED']);
    expect(lines.captions).toEqual([]);

    toOffset(CH7_M7_CAPTION_SECONDS);
    expect(lines.captions).toEqual(['nothing has asked yet. something has started paying attention.']);

    toOffset(CH7_EXIT_CAPTION_SECONDS);
    expect(lines.captions).toEqual([
      'nothing has asked yet. something has started paying attention.',
      'the scar remains. now it can carry me.'
    ]);
    expect(getStoryText().caption?.text).toBe('the scar remains. now it can carry me.');

    // D9: the approved string owns the slot for the rest of the hold.
    toOffset(CH7_EXIT_HOLD_SECONDS - 0.02);
    expectBeat('ch7-reconstruct');
    expect(getStoryText().caption?.text).toBe('the scar remains. now it can carry me.');
    tick(0.02);
    expectBeat('ch7-board');
    expect(hasMilestone(STORY_MILESTONES.ch7Reconstructed)).toBe(true);
    lines.stop();
  });

  it('seeds the ch7 voice latches on re-entry so a resumed chapter replays no line', () => {
    enterBeat('ch7-reconstruct');
    tick(0);
    playReconstructionToFlightReady(CH7_DRAIN_STEP_SECONDS);
    markMilestone(RECONSTRUCTION_CALIBRATION_MILESTONE, ACTOR_ID);

    // Deep link / replay / resume: the same beat re-entered on facts already
    // committed must not burst a catch-up stack of past captions.
    syncEnteredBeat();
    clearStoryText();
    const lines = recordStoryLines();
    tick(0);
    tick(0);
    expect(lines.captions.filter(caption => CH7_STAGE_CAPTIONS.includes(caption))).toEqual([]);
    expect(lines.audits.filter(audit => CH7_STAGE_AUDITS.includes(audit))).toEqual([]);

    // The beat's own unfinished ending still plays: the exit cadence keys on
    // the calibration receipt, which is exactly where a resumed chapter stands.
    tick(CH7_EXIT_HOLD_SECONDS + 0.01);
    expectBeat('ch7-board');
    expect(lines.captions).toEqual([
      'nothing has asked yet. something has started paying attention.',
      'the scar remains. now it can carry me.',
      '(the wreck is waiting for an owner.)'
    ]);
    lines.stop();
  });

  it('queues ch7 stage captions so a compressed route never cuts a reveal (R3)', () => {
    enterBeat('ch7-reconstruct');
    const lines = recordStoryLines(() => beatClock);
    tick(0);
    // No time between commits: the whole ladder is crossed inside one frame, so
    // every caption stacks into the queue behind the first.
    playReconstructionToFlightReady(0);
    tick(0);
    // Captions are queued; the regulation stamps are NOT — receipts, commits,
    // score variants, anchors and objectives all stay real-time.
    expect(lines.audits).toEqual(CH7_STAGE_AUDITS);
    expect(lines.captions).toEqual([CH7_M1_CAPTION]);

    // Drained in stage order, each line owning the slot for its own derived
    // reveal plus the read dwell.
    for (let frame = 0; frame < 400; frame++) tick(0.05);
    expect(lines.captions).toEqual(CH7_STAGE_CAPTIONS);
    for (let index = 1; index < CH7_STAGE_CAPTIONS.length; index++) {
      const screenLife = lines.captionTimes[index] - lines.captionTimes[index - 1];
      expect(screenLife).toBeGreaterThanOrEqual(
        revealSeconds(CH7_STAGE_CAPTIONS[index - 1]) + CH7_STAGE_DWELL_SECONDS - 1e-9
      );
    }
    expectBeat('ch7-reconstruct');
    lines.stop();
  });

  it('drops queued ch7 stage captions at the calibration receipt but never M6', () => {
    enterBeat('ch7-reconstruct');
    const lines = recordStoryLines(() => beatClock);
    tick(0);
    playReconstructionToFlightReady(0);
    tick(0);
    expect(lines.captions).toEqual([CH7_M1_CAPTION]);

    // The receipt lands while M2..M6 are still queued: the queue drops at close
    // and only the turn survives it.
    markMilestone(RECONSTRUCTION_CALIBRATION_MILESTONE, ACTOR_ID);
    for (let frame = 0; frame < 400; frame++) tick(0.05);
    expect(lines.captions.slice(0, 2)).toEqual([CH7_M1_CAPTION, CH7_M6_CAPTION]);
    for (const dropped of CH7_STAGE_CAPTIONS.slice(1, 5)) {
      expect(lines.captions).not.toContain(dropped);
    }

    // The mini-cadence anchor shifted off the receipt to M6's reveal end, so
    // the turn kept its whole reveal and the exit table still carries in full.
    const m6RevealDone = firedAtIn(lines, CH7_M6_CAPTION) + revealSeconds(CH7_M6_CAPTION);
    expect(firedAtIn(lines, CH7_M7_CAPTION))
      .toBeGreaterThanOrEqual(m6RevealDone + CH7_M7_CAPTION_SECONDS - 1e-9);
    expect(firedAtIn(lines, CH7_EXIT_CAPTION) - firedAtIn(lines, CH7_M7_CAPTION))
      .toBeCloseTo(CH7_EXIT_CAPTION_SECONDS - CH7_M7_CAPTION_SECONDS, 1);
    expectBeat('ch7-board');
    lines.stop();
  });

  it('keeps the ch8 slot constants long enough that no timed line can interrupt another', () => {
    // Under ruling R1 there is no mid-reveal exception left at all: the reveal
    // guard in l2DueAt is absolute. These slots are read time on top of it.
    expect(CH8_L1_MIN_SLOT_SECONDS).toBeGreaterThan(revealSeconds(CH8_L1_CAPTION));
    expect(CH8_L2_MIN_SLOT_SECONDS).toBeGreaterThan(revealSeconds(CH8_L2_CAPTION));
    expect(revealSeconds(CH8_L3_CAPTION)).toBeLessThan(CH8_L2_MIN_SLOT_SECONDS);
  });

  it('walks the ch8 ladder on its timer when the player never commits early', () => {
    const ladder = launchLadder();
    ladder.advance(0);
    expect(ladder.lines.captions).toEqual([CH8_L1_CAPTION]);
    const l1At = ladder.firedAt(CH8_L1_CAPTION);

    // No phase edge exists yet, so L2 owes L1 its whole slot and cannot
    // interrupt the reveal that is still running.
    ladder.advance(CH8_L1_MIN_SLOT_SECONDS - 0.01);
    expect(ladder.lines.captions).toEqual([CH8_L1_CAPTION]);
    ladder.advance(0.02);
    expect(ladder.lines.captions).toEqual([CH8_L1_CAPTION, CH8_L2_CAPTION]);
    expect(ladder.firedAt(CH8_L2_CAPTION) - l1At).toBeCloseTo(CH8_L1_MIN_SLOT_SECONDS, 1);
    expect(getEmergentStoryVoiceDiag().launch.l2Cause).toBe('timer');

    // L3 is spaced off L2 but also waits on the physical edge: with the
    // spacing already spent, max() resolves to the edge.
    ladder.advance(CH8_L2_MIN_SLOT_SECONDS + 1);
    expect(ladder.lines.captions).toEqual([CH8_L1_CAPTION, CH8_L2_CAPTION]);
    enterAtmosphere();
    ladder.advance(0);
    expect(ladder.lines.captions).toEqual([CH8_L1_CAPTION, CH8_L2_CAPTION, CH8_L3_CAPTION]);
    ladder.lines.stop();
  });

  it('clamps an early ch8 edge to L1 reveal completion instead of cutting it (R1)', () => {
    const ladder = launchLadder();
    ladder.advance(0);
    const l1At = ladder.firedAt(CH8_L1_CAPTION);

    // The player commits a full second into L1's reveal. Under draft-v3 this
    // cut the line; the reveal guard now holds L2 back to reveal completion.
    ladder.advance(1);
    enterAtmosphere();
    ladder.advance(0);
    expect(ladder.lines.captions).toEqual([CH8_L1_CAPTION]);

    ladder.advance(revealSeconds(CH8_L1_CAPTION) - 1 - 0.01);
    expect(ladder.lines.captions).toEqual([CH8_L1_CAPTION]);
    ladder.advance(0.02);
    expect(ladder.lines.captions).toEqual([CH8_L1_CAPTION, CH8_L2_CAPTION]);

    // Neither 'timer' nor 'edge': the edge preceded the guard and was clamped.
    const diag = getEmergentStoryVoiceDiag().launch;
    expect(diag.l2Cause).toBe('reveal-guard');
    expect(diag.l2DueAt).toBeCloseTo(l1At + revealSeconds(CH8_L1_CAPTION), 5);
    // L1 kept every character of its reveal; the act only spent its read dwell.
    expect(ladder.firedAt(CH8_L2_CAPTION) - l1At)
      .toBeGreaterThanOrEqual(revealSeconds(CH8_L1_CAPTION) - 1e-9);
    expect(ladder.firedAt(CH8_L2_CAPTION) - l1At).toBeLessThan(CH8_L1_MIN_SLOT_SECONDS);

    // No cascade: L3 still owes L2 its full slot.
    ladder.advance(CH8_L2_MIN_SLOT_SECONDS - 0.01);
    expect(ladder.lines.captions).toEqual([CH8_L1_CAPTION, CH8_L2_CAPTION]);
    ladder.advance(0.02);
    expect(ladder.firedAt(CH8_L3_CAPTION) - ladder.firedAt(CH8_L2_CAPTION))
      .toBeCloseTo(CH8_L2_MIN_SLOT_SECONDS, 1);
    ladder.lines.stop();
  });

  it('lets a ch8 edge after L1 reveal completion pull L2 forward off its timer', () => {
    const ladder = launchLadder();
    ladder.advance(0);
    const l1At = ladder.firedAt(CH8_L1_CAPTION);

    // An edge inside [t_L1 + reveal, t_L1 + 4.5] is the operative term: it
    // spends part of L1's read dwell without touching the reveal.
    const edgeOffset = revealSeconds(CH8_L1_CAPTION) + 0.3;
    expect(edgeOffset).toBeLessThan(CH8_L1_MIN_SLOT_SECONDS);
    ladder.advance(edgeOffset);
    enterAtmosphere();
    ladder.advance(0);
    expect(ladder.lines.captions).toEqual([CH8_L1_CAPTION, CH8_L2_CAPTION]);

    const diag = getEmergentStoryVoiceDiag().launch;
    expect(diag.l2Cause).toBe('edge');
    expect(ladder.firedAt(CH8_L2_CAPTION) - l1At).toBeCloseTo(edgeOffset, 5);
    ladder.lines.stop();
  });

  it('freezes the ch8 exit window under the boundary and resumes it on re-exit (R4)', () => {
    const ladder = launchLadder();
    ladder.advance(0);
    enterAtmosphere();
    ladder.advance(0);
    leaveAtmosphere();
    ladder.advance(0);
    expect(ladder.lines.captions).toContain(CH8_L4_CAPTION);

    ladder.advance(CH8_STACK_ONE_SECONDS + 0.01);
    expect(ladder.lines.audits).toHaveLength(1);
    const heldAtDip = getEmergentStoryVoiceDiag().launch.exitHeldSeconds;

    // Dip back under the boundary: the window clock stops where it stands and
    // no row becomes due however long the ship stays inside.
    enterAtmosphere();
    ladder.advance(600);
    expect(getEmergentStoryVoiceDiag().launch.exitHeldSeconds).toBeCloseTo(heldAtDip, 5);
    expect(ladder.lines.audits).toHaveLength(1);
    expectBeat('ch8-launch');

    // Re-exit resumes from the held value: no re-fire of row one, no burst of
    // the rows the wall clock ran past, and the order is untouched.
    leaveAtmosphere();
    ladder.advance(CH8_STACK_TWO_SECONDS - heldAtDip + 0.01);
    expect(ladder.lines.audits).toEqual([
      'AUDIT NETWORK | AUTOMATED CONTACT · SITE 7C-θ · HULL LOGGED: DESTROYED',
      'AUDIT NETWORK | REGISTRY QUERY · STATE DESIGNATION.'
    ]);

    // The advance needs BOTH a held clock past the hold and a live deep_space.
    ladder.advance(CH8_EXIT_HOLD_SECONDS);
    expectBeat('ch8-crossing');
    ladder.lines.stop();
  });

  it('holds the ch8 advance under the boundary even once the held clock is spent (R4)', () => {
    const ladder = launchLadder();
    ladder.advance(0);
    enterAtmosphere();
    ladder.advance(0);
    leaveAtmosphere();
    // Spend the whole hold outside, then dive back under before it fires.
    ladder.advance(CH8_EXIT_HOLD_SECONDS - 0.01);
    expectBeat('ch8-launch');
    enterAtmosphere();
    ladder.advance(600);

    // Held clock alone is not enough: the advance needs BOTH conditions, and
    // the phase one is false, so the beat waits however long the wall clock runs.
    expect(getEmergentStoryVoiceDiag().launch.exitHeldSeconds)
      .toBeCloseTo(CH8_EXIT_HOLD_SECONDS - 0.01, 5);
    expectBeat('ch8-launch');

    // Re-exit satisfies the phase condition and the advance lands immediately.
    leaveAtmosphere();
    ladder.advance(0.02);
    expectBeat('ch8-crossing');
    expect(hasMilestone(STORY_MILESTONES.ch8Launched)).toBe(true);
    ladder.lines.stop();
  });

  it('drops any unfired ch8 ladder line when the exit fact lands, leaving the window intact', () => {
    // The measured chained movie route: L1 at entry, the phase edge 1.40 s
    // later, deep_space 1.99 s after that. L3 is due at edge + 3.0 s and the
    // beat ends first, so it is dropped rather than deferred.
    const ladder = launchLadder();
    ladder.advance(0);
    ladder.advance(1.4);
    enterAtmosphere();
    ladder.advance(0);
    // The edge landed inside L1's reveal, so the guard holds L2 back.
    expect(ladder.lines.captions).toEqual([CH8_L1_CAPTION]);

    ladder.advance(1.99);
    expect(ladder.lines.captions).toEqual([CH8_L1_CAPTION, CH8_L2_CAPTION]);
    expect(getEmergentStoryVoiceDiag().launch.l2Cause).toBe('reveal-guard');
    leaveAtmosphere();
    ladder.advance(0);
    // L4 fires at window +0.0 unconditionally; L3 never reaches the screen.
    expect(ladder.lines.captions).toEqual([CH8_L1_CAPTION, CH8_L2_CAPTION, CH8_L4_CAPTION]);

    // The drop is permanent — nothing spills into the frozen exit window.
    ladder.advance(CH8_EXIT_HOLD_SECONDS - 0.01);
    expect(ladder.lines.captions).not.toContain(CH8_L3_CAPTION);
    expect(ladder.lines.audits).toHaveLength(4);
    expectBeat('ch8-launch');
    ladder.advance(0.02);
    expectBeat('ch8-crossing');
    ladder.lines.stop();
  });

  it('asserts the drop, not the render, when a fast tier crosses both boundaries in one frame', () => {
    // POTATO-shaped route (vd-03): the climb is skipped, so no readable
    // surface-to-non-surface edge is ever observed on its own tick.
    const ladder = launchLadder();
    ladder.advance(0);
    expect(ladder.lines.captions).toEqual([CH8_L1_CAPTION]);

    enterAtmosphere();
    leaveAtmosphere();
    ladder.advance(0);
    expect(ladder.lines.captions).toEqual([CH8_L1_CAPTION, CH8_L4_CAPTION]);

    ladder.advance(CH8_EXIT_HOLD_SECONDS + 0.01);
    expect(ladder.lines.captions).not.toContain(CH8_L2_CAPTION);
    expect(ladder.lines.captions).not.toContain(CH8_L3_CAPTION);
    // Order, once-only and the frozen exit-window table are unaffected.
    expect(ladder.lines.audits).toEqual([
      'AUDIT NETWORK | AUTOMATED CONTACT · SITE 7C-θ · HULL LOGGED: DESTROYED',
      'AUDIT NETWORK | REGISTRY QUERY · STATE DESIGNATION.',
      'AUDIT NETWORK | NO DESIGNATION RETURNED.',
      'AUDIT NETWORK | CONTACT LOGGED.'
    ]);
    expectBeat('ch8-crossing');
    ladder.lines.stop();
  });

  it('seeds the whole ch8 ladder consumed when the beat is restored already off the pad', () => {
    enterLaunchAtTheControls();
    tick(0);
    tick(0);
    enterAtmosphere();

    // A mid-flight snapshot restore re-enters the beat with the phase already
    // non-surface: no replay, no catch-up burst.
    syncEnteredBeat();
    clearStoryText();
    const lines = recordStoryLines();
    tick(0);
    tick(600);
    expect(lines.captions).toEqual([]);

    // The exit window is untouched by the seeding.
    leaveAtmosphere();
    tick(0);
    expect(lines.captions).toEqual([CH8_L4_CAPTION]);
    lines.stop();
  });

  it('plays the frozen ch8 exit window over live controls before the deep-space advance', () => {
    enterLaunchAtTheControls();
    const lines = recordStoryLines();
    tick(0);
    tick(0);
    expect(lines.captions).toEqual([CH8_L1_CAPTION]);

    enterAtmosphere();
    tick(0);
    // The reveal guard owns L2's due time whenever the edge beats the reveal.
    expect(lines.captions).toEqual([CH8_L1_CAPTION]);
    tick(revealSeconds(CH8_L1_CAPTION) + 0.01);
    expect(lines.captions).toEqual([CH8_L1_CAPTION, CH8_L2_CAPTION]);
    leaveAtmosphere();
    const toOffset = cadenceStepper();
    tick(0);
    expect(lines.captions[lines.captions.length - 1])
      .toBe('i came down this line without being asked. i am going back up it on purpose.');
    expect(lines.audits).toEqual([]);

    toOffset(CH8_STACK_ONE_SECONDS);
    toOffset(CH8_STACK_TWO_SECONDS);
    toOffset(CH8_STACK_THREE_SECONDS);
    toOffset(CH8_CONTACT_LOGGED_SECONDS);
    expect(lines.audits).toEqual([
      'AUDIT NETWORK | AUTOMATED CONTACT · SITE 7C-θ · HULL LOGGED: DESTROYED',
      'AUDIT NETWORK | REGISTRY QUERY · STATE DESIGNATION.',
      'AUDIT NETWORK | NO DESIGNATION RETURNED.',
      'AUDIT NETWORK | CONTACT LOGGED.'
    ]);
    expect(getStoryText().audit?.text).toBe('CONTACT LOGGED.');

    toOffset(CH8_DESIGNATION_CAPTION_SECONDS);
    expect(getStoryText().caption?.text).toBe('they asked for a designation. what i have is not one.');
    // The two-word reply owns its full punch slot before the voice answers it.
    expect(getStoryText().audit?.text).toBe('CONTACT LOGGED.');

    toOffset(CH8_OPEN_QUERY_SECONDS);
    expect(getStoryText().caption?.text).toBe('nothing answers. the query does not close.');

    // The advance still keys on the identical durable deep_space fact; the
    // hold only bought the window the stack needs to exist on screen.
    toOffset(CH8_EXIT_HOLD_SECONDS - 0.02);
    expectBeat('ch8-launch');
    tick(0.02);
    expectBeat('ch8-crossing');
    expect(hasMilestone(STORY_MILESTONES.ch8Launched)).toBe(true);
    expect(getSignedSceneAvDebugSnapshot().lastResetReason).toBe('beat-exit');
    lines.stop();
  });

  it('emits every ch8 window line once, and none of it in a story-inactive sandbox', () => {
    enterLaunchAtTheControls();
    tick(0);
    tick(0);
    enterAtmosphere();
    tick(0);
    leaveAtmosphere();
    const lines = recordStoryLines();
    // The window's origin is stamped on the tick that first observes
    // deep_space, so the offsets are measured from the tick after it.
    tick(0);
    tick(CH8_EXIT_HOLD_SECONDS - 0.01);
    expect(lines.captions).toEqual([
      CH8_L4_CAPTION,
      'they asked for a designation. what i have is not one.',
      'nothing answers. the query does not close.'
    ]);
    expect(lines.audits).toHaveLength(4);
    lines.stop();

    // Prime directive: story off, nothing of this run may speak.
    deactivateStory();
    enterEmergentStoryBeat(null);
    clearStoryText();
    const sandbox = recordStoryLines();
    tick(600);
    expect(sandbox.captions).toEqual([]);
    expect(sandbox.audits).toEqual([]);
    expect(getStoryText().audit).toBeNull();
    expect(getStoryText().caption).toBeNull();
    sandbox.stop();
  });

  it('requires embodied board, launch, local crossing, touchdown, and egress states', () => {
    const tidegarden = parsePlanetWorldId(TIDEGARDEN_WORLD_ID);
    if (!tidegarden) throw new Error('Tidegarden must have a canonical planet address.');
    resetSystemFlightForInterstellarArrival({
      system: tidegarden.system,
      locationMode: 'surface',
      activePlanetId: STORY_PRIMARY_WORLD_ID,
      pose: { position: [0, 0, 0], velocity: [0, 0, 0], quaternion: [0, 0, 0, 1] }
    });

    enterBeat('ch7-board');
    tick(600);
    expectBeat('ch7-board');
    expect(getActiveGuidedStoryObjective()).toMatchObject({
      id: 'board:enter-hatch',
      markerLabel: 'KESTREL HATCH · BOARD'
    });
    enterShip();
    tick(0);
    expectBeat('ch7-board');
    markMilestone(PHYSICAL_BOARDING_MILESTONE, ACTOR_ID);
    tick(0);
    expectBeat('ch8-launch');
    expect(hasMilestone(STORY_MILESTONES.ch7Boarded)).toBe(true);
    expect(getSignedSceneAvDebugSnapshot().activationHistoryAnchorIds)
      .toContain('anc.board.cockpit-handback');

    syncEnteredBeat();
    tick(600);
    expectBeat('ch8-launch');
    enterAtmosphere();
    tick(600);
    expectBeat('ch8-launch');
    leaveAtmosphere();
    tick(0);
    tick(CH8_EXIT_HOLD_SECONDS - 0.01);
    expectBeat('ch8-launch');
    tick(0.02);
    expectBeat('ch8-crossing');
    expect(hasMilestone(STORY_MILESTONES.ch8Launched)).toBe(true);

    syncEnteredBeat();
    commitSystemBodyTarget(tidegarden);
    tick(600);
    expectBeat('ch8-crossing');
    expect(getEmergentStoryEvents().find(event => event.type === 'system_body_targeted'))
      .toMatchObject({
        payload: {
          worldId: TIDEGARDEN_WORLD_ID,
          seed: 1600321158,
          profileId: 'story:tidegarden',
          profileVersion: 1,
          profileHash: 'pf1-eeef3b78',
          archetype: 'verdant'
        }
      });
    setActiveSystemPlanet(TIDEGARDEN_WORLD_ID);
    tick(600);
    expectBeat('ch8-crossing');
    markTerrainPopulated();
    for (let frame = 0; frame < 8; frame++) markFramePainted();
    enterAtmosphere();
    tick(0);
    expectBeat('ch8-landfall');
    expect(hasMilestone(STORY_MILESTONES.ch8Crossed)).toBe(true);

    syncEnteredBeat();
    tick(600);
    expectBeat('ch8-landfall');
    notifyLanded();
    tick(600);
    expectBeat('ch8-landfall');
    exitShip();
    tick(0);
    tick(2.99);
    expectBeat('ch8-landfall');
    tick(0.02);
    expectBeat('ch9-settle');
    expect(hasMilestone(STORY_MILESTONES.ch8Landfall)).toBe(true);
  });

  it('authenticates approach after a slow destination paint even when the reveal veil timed out', () => {
    const tidegarden = parsePlanetWorldId(TIDEGARDEN_WORLD_ID);
    if (!tidegarden) throw new Error('Tidegarden must have a canonical planet address.');
    resetSystemFlightForInterstellarArrival({
      system: tidegarden.system,
      locationMode: 'local_space',
      activePlanetId: STORY_PRIMARY_WORLD_ID,
      pose: { position: [0, 0, 0], velocity: [0, 0, 0], quaternion: [0, 0, 0, 1] }
    });
    debugStartInSpace();
    enterBeat('ch8-crossing');

    const targetEpoch = commitSystemBodyTarget(tidegarden);
    tick(0);
    expect(getSignedSceneAvDebugSnapshot().anchorId).toBe('anc.crossing.sibling-targeted');

    const uninstallBridge = installVehicleSceneAvBoundaryBridge();
    commitSystemPlanetHandoff({
      worldId: TIDEGARDEN_WORLD_ID,
      renderOrigin: [2200, 0, 0],
      expectedActivationEpoch: targetEpoch
    });
    uninstallBridge();
    enterAtmosphere();
    expect(getSignedSceneAvDebugSnapshot().anchorId).toBe('anc.crossing.local-handoff');

    // POTATO can need several seconds after the 0.75 s reveal-cover cap. The
    // story remains in crossing, with no synthetic approach, until paint proof.
    for (let frame = 0; frame < 33; frame++) tick(0.1);
    expectBeat('ch8-crossing');
    expect(getSignedSceneAvDebugSnapshot().anchorId).toBe('anc.crossing.local-handoff');

    markTerrainPopulated();
    for (let frame = 0; frame < 8; frame++) markFramePainted();
    tick(0);
    expectBeat('ch8-landfall');
    expect(getSignedSceneAvDebugSnapshot()).toMatchObject({
      beat: 'ch8-landfall',
      anchorId: 'anc.crossing.approach',
      shot: { id: 'cin.landfall.01-read-the-ground' }
    });

    syncEnteredBeat();
    expect(getSignedSceneAvDebugSnapshot()).toMatchObject({
      beat: 'ch8-landfall',
      anchorId: 'anc.crossing.approach',
      shot: { id: 'cin.landfall.01-read-the-ground' },
      postFx: { activeEffectIds: ['fx.landfall.01-read-the-ground'] }
    });
  });

  it('requires attended ecology, a certified physical habitat, and a live safe-rest receipt before handback', () => {
    enterBeat('ch9-settle');
    tick(600);
    expectBeat('ch9-settle');

    expect(commitTidegardenScannerOverload({
      worldId: TIDEGARDEN_WORLD_ID,
      renderedFrames: 1,
      visibleSignalIds: ['a', 'b', 'c', 'd', 'e', 'f'],
      relationshipKinds: ['water-root', 'canopy-shelter', 'pollen-route']
    }, 'story:test:tidegarden-scanner', ACTOR_ID).ok).toBe(true);
    expect(attendTidegardenRelationship(
      TIDEGARDEN_RELATIONSHIP,
      'story:test:tidegarden-relationship',
      ACTOR_ID
    )).toMatchObject({ ok: true });
    tick(600);
    expectBeat('ch9-settle');

    setFreeBuild(true);
    addItem('habitat_core', 1, ACTOR_ID);
    const settlementContext = createOfflineCommandContext(tidegardenIdentity(), {
      actorId: ACTOR_ID,
      now: () => 9001
    });
    expect(chooseTidegardenHabitatSite({
      worldId: TIDEGARDEN_WORLD_ID,
      planetSize: 12,
      playerPosition: HABITAT_PLAYER,
      terrain: HABITAT_TERRAIN,
      actorId: ACTOR_ID,
      eventId: 'story:test:habitat-site-chosen'
    })).toMatchObject({ ok: true });
    expect(dispatchGameplayCommand(() => placeStructureCommand(settlementContext, {
      cell: HABITAT_LOWER,
      face: 3,
      type: 'foundation',
      material: 'wood',
      up: 2,
      commandId: 'story:test:habitat-foundation'
    })).ok).toBe(true);
    expect(getEmergentStoryEvents().find(event => event.type === 'settlement_foundation_placed'))
      .toMatchObject({
        actorId: ACTOR_ID,
        worldId: TIDEGARDEN_WORLD_ID,
        occurredAt: 9001,
        payload: {
          cell: HABITAT_LOWER,
          face: 3,
          material: 'wood'
        }
      });
    const site = validateTidegardenHabitatSite({
      worldId: TIDEGARDEN_WORLD_ID,
      planetSize: 12,
      playerPosition: HABITAT_PLAYER,
      terrain: HABITAT_TERRAIN,
      actorId: ACTOR_ID
    });
    expect(site.ok).toBe(true);
    if (!site.ok) throw new Error('Expected the chosen Habitat Core site to validate.');
    expect(activateTidegardenHabitatCore({
      proof: site.proof,
      eventId: 'story:test:habitat-core-online',
      actorId: ACTOR_ID
    })).toMatchObject({ ok: true });
    tick(600);
    expectBeat('ch9-settle');

    buildHabitatRoom();
    expect(certifyTidegardenShelter({
      worldId: TIDEGARDEN_WORLD_ID,
      playerPosition: HABITAT_PLAYER,
      eventId: 'story:test:shelter-certified',
      actorId: ACTOR_ID
    })).toMatchObject({ ok: true });
    tick(0);
    tick(2.39);
    expectBeat('ch9-settle');
    tick(0.02);
    expectBeat('ch9-hearth');
    expect(hasMilestone(STORY_MILESTONES.ch9Settled)).toBe(true);

    syncEnteredBeat();
    tick(600);
    expectBeat('ch9-hearth');
    expect(getActiveGuidedStoryObjective()).toMatchObject({
      id: 'settle:wait-night',
      markerLabel: 'SECOND HEARTH · WAIT FOR NIGHT'
    });
    expect(completeTidegardenSafeRest({
      worldId: TIDEGARDEN_WORLD_ID,
      playerPosition: HABITAT_PLAYER,
      dayPhase: 0.75,
      eventId: 'story:test:second-hearth-rest',
      actorId: ACTOR_ID
    })).toMatchObject({ ok: true });
    tick(0);
    expect(getActiveGuidedStoryObjective()).toMatchObject({
      id: 'settle:second-hearth-settling',
      markerLabel: 'SECOND HEARTH · SETTLING',
      requiresMarker: false
    });
    tick(5.49);
    expectBeat('ch9-hearth');
    tick(0.02);

    expect(hasMilestone(TIDEGARDEN_SETTLEMENT_MILESTONES.safeRestCompleted)).toBe(true);
    expect(hasMilestone(TIDEGARDEN_SETTLEMENT_MILESTONES.twoWorldHandoff)).toBe(true);
    expect(hasMilestone(STORY_MILESTONES.ch9Hearth)).toBe(true);
    expect(getStoryStateSnapshot()).toMatchObject({
      active: false,
      chapter: 'complete',
      beat: 'done'
    });
  });
});
