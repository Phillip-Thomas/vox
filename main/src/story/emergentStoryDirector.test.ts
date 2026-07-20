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
  emergentStoryDirectorTick,
  enterEmergentStoryBeat
} from './emergentStoryDirector.ts';
import {
  getEmergentStoryEvents,
  resetEmergentStoryEvents
} from './emergentStoryEvents.ts';
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
import { clearStoryText, getStoryText } from './storyText.ts';

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
}

function expectBeat(beat: StoryBeat): void {
  expect(getStoryStateSnapshot().beat).toBe(beat);
}

function tick(seconds: number): void {
  emergentStoryDirectorTick(seconds);
}

function syncEnteredBeat(): void {
  enterEmergentStoryBeat(getStoryStateSnapshot().beat);
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
    tick(0.64);
    expectBeat('ch7-reconstruct');
    tick(0.02);
    expectBeat('ch7-board');
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
