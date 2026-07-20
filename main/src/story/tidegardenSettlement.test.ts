import { beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { BlockId } from '../game/data/blocks.ts';
import { addItem, getItemCount, resetAllInventories } from '../game/systems/inventorySystem.ts';
import { getAccomplishment, resetAccomplishments } from '../game/systems/accomplishmentLedger.ts';
import { getObservation, resetObservations } from '../game/systems/observationLedger.ts';
import { hasMilestone, markMilestone, resetProgression } from '../game/systems/progressionSystem.ts';
import { resetHabitats } from '../game/systems/habitatSystem.ts';
import {
  placePiece,
  resetStructures,
  setFreeBuild
} from '../game/systems/structureSystem.ts';
import type { SpawnTerrainQuery } from '../utils/spawnValidation.ts';
import { getVitals, resetVitals, setVitals } from '../game/systems/survivalVitals.ts';
import { getEmergentStoryEvents, resetEmergentStoryEvents } from './emergentStoryEvents.ts';
import { TIDEGARDEN_WORLD_ID } from './tidegardenRoute.ts';
import {
  activateTidegardenHabitatCore,
  attendTidegardenRelationship,
  canRestAtTidegardenHabitat,
  certifyTidegardenShelter,
  chooseTidegardenHabitatSite,
  commitTidegardenScannerOverload,
  completeTidegardenSafeRest,
  findTidegardenRecommendedHabitatSite,
  getTidegardenChosenHabitatSite,
  getTidegardenSettlementGuidance,
  hasTidegardenChosenFoundation,
  isHabitatNight,
  observeTidegardenAerialSiteSurvey,
  reconcileTidegardenSettlementMilestones,
  recordTidegardenRelationshipObservation,
  resetTidegardenAerialSurveyRuntimeForTests,
  TIDEGARDEN_AERIAL_SURVEY_HOLD_SECONDS,
  TIDEGARDEN_RELATIONSHIP_ID,
  TIDEGARDEN_RELATIONSHIP_OBSERVATION_ID,
  TIDEGARDEN_SETTLEMENT_MILESTONES,
  validateTidegardenHabitatSite,
  type TidegardenRelationshipProof
} from './tidegardenSettlement.ts';

const ACTOR = 'terra';
const LOWER: [number, number, number] = [0, 5, 0];
const UPPER: [number, number, number] = [0, 6, 0];
const PLAYER = new THREE.Vector3(0, 10.2, 0);
const TERRAIN: SpawnTerrainQuery = {
  shouldVoxelExist: (x, y, z) => Math.abs(x) <= 5 && Math.abs(z) <= 5 && y <= 4,
  isWaterVoxel: () => false,
  generateBlockForPosition: () => 'stone' as BlockId
};
const RELATIONSHIP: TidegardenRelationshipProof = {
  worldId: TIDEGARDEN_WORLD_ID,
  relationshipId: TIDEGARDEN_RELATIONSHIP_ID,
  position: new THREE.Vector3(8, 10, 0),
  waterDepth: 3,
  sourceKey: 'deterministic-waterline'
};

beforeEach(() => {
  resetAllInventories();
  resetProgression();
  resetHabitats();
  resetStructures();
  resetAccomplishments();
  resetObservations();
  resetEmergentStoryEvents();
  resetTidegardenAerialSurveyRuntimeForTests();
  resetVitals();
  setFreeBuild(true);
});

describe('Tidegarden settlement proof chain', () => {
  it('provides one persistent next objective through the opening settlement steps', () => {
    expect(getTidegardenSettlementGuidance({
      actorId: ACTOR,
      coreCarried: false,
      foundationPlaced: false,
      night: false
    }).id).toBe('scan-waterline');

    markMilestone(TIDEGARDEN_SETTLEMENT_MILESTONES.scannerOverload, ACTOR);
    expect(getTidegardenSettlementGuidance({
      actorId: ACTOR,
      coreCarried: false,
      foundationPlaced: false,
      night: false
    }).id).toBe('attend-waterline');

    markMilestone(TIDEGARDEN_SETTLEMENT_MILESTONES.relationshipAttended, ACTOR);
    expect(getTidegardenSettlementGuidance({
      actorId: ACTOR,
      coreCarried: false,
      foundationPlaced: false,
      night: false
    }).id).toBe('choose-site');

    expect(chooseTidegardenHabitatSite({
      worldId: TIDEGARDEN_WORLD_ID,
      planetSize: 12,
      playerPosition: PLAYER,
      terrain: TERRAIN,
      actorId: ACTOR,
      eventId: 'site:guidance-choice'
    })).toEqual({ ok: true, idempotent: false });
    expect(getTidegardenSettlementGuidance({
      actorId: ACTOR,
      coreCarried: false,
      foundationPlaced: false,
      night: false
    })).toMatchObject({
      id: 'craft-core',
      markerLabel: 'KESTREL FABRICATOR · CRAFT HABITAT CORE'
    });

    expect(getTidegardenSettlementGuidance({
      actorId: ACTOR,
      coreCarried: true,
      foundationPlaced: false,
      night: false
    }).id).toBe('foundation');
    placePiece(LOWER, 3, 'foundation', 'wood', 2, ACTOR);
    expect(getTidegardenSettlementGuidance({
      actorId: ACTOR,
      coreCarried: true,
      foundationPlaced: true,
      night: false
    }).id).toBe('install-core');
  });

  it('keeps one stable recommended stance and requires the chosen floor face', () => {
    primeScanner();
    attendTidegardenRelationship(RELATIONSHIP, 'relationship:recommended-site', ACTOR);
    const recommendation = findTidegardenRecommendedHabitatSite({
      worldId: TIDEGARDEN_WORLD_ID,
      planetSize: 12,
      playerPosition: PLAYER,
      terrain: TERRAIN,
      actorId: ACTOR
    });
    expect(recommendation.ok).toBe(true);
    if (!recommendation.ok) throw new Error('Expected recommended habitat site.');
    const repeat = findTidegardenRecommendedHabitatSite({
      worldId: TIDEGARDEN_WORLD_ID,
      planetSize: 12,
      playerPosition: PLAYER,
      terrain: TERRAIN,
      actorId: ACTOR
    });
    expect(repeat.ok).toBe(true);
    if (!repeat.ok) throw new Error('Expected repeated habitat recommendation.');
    expect(repeat.approachPosition.toArray()).toEqual(recommendation.approachPosition.toArray());

    expect(chooseTidegardenHabitatSite({
      worldId: TIDEGARDEN_WORLD_ID,
      planetSize: 12,
      playerPosition: recommendation.approachPosition,
      terrain: TERRAIN,
      actorId: ACTOR,
      eventId: 'site:recommended-choice'
    })).toEqual({ ok: true, idempotent: false });
    placePiece(LOWER, 2, 'foundation', 'wood', 2, ACTOR);
    expect(hasTidegardenChosenFoundation(ACTOR)).toBe(false);
    placePiece(LOWER, 3, 'foundation', 'wood', 2, ACTOR);
    expect(hasTidegardenChosenFoundation(ACTOR)).toBe(true);
  });

  it('uses the shared night predicate at every night boundary', () => {
    // Night now opens the instant the sky darkens (~phase 0.505, just after the
    // 0.5 sunset) instead of the old 0.55 lockout, and still closes at the dawn wrap.
    expect(isHabitatNight(0.5)).toBe(false);    // sunset horizon — still dusk-lit
    expect(isHabitatNight(0.51)).toBe(true);    // sky has gone dark
    expect(isHabitatNight(0.75)).toBe(true);    // midnight
    expect(isHabitatNight(0.95)).toBe(true);    // dawn wrap boundary (inclusive)
    expect(isHabitatNight(0.9501)).toBe(false); // past the wrap — rest closes
    expect(isHabitatNight(0.05)).toBe(false);   // morning
  });

  it('lets direct Attend satisfy comprehension while ledger recording remains optional', () => {
    expect(attendTidegardenRelationship(RELATIONSHIP, 'relationship:early', ACTOR)).toEqual({
      ok: false,
      reason: 'scanner-overload-not-observed'
    });
    primeScanner();
    expect(attendTidegardenRelationship(RELATIONSHIP, 'relationship:attend', ACTOR)).toEqual({
      ok: true,
      idempotent: false
    });
    expect(getObservation(TIDEGARDEN_RELATIONSHIP_OBSERVATION_ID, ACTOR)).toBeUndefined();
    expect(getAccomplishment('tidegarden_relationship_attended', ACTOR)).toBeDefined();
    expect(getEmergentStoryEvents().map(event => event.type)).toEqual([
      'settlement_scanner_overload',
      'ecology_relationship_observed',
      'accomplishment_recorded'
    ]);

    expect(recordTidegardenRelationshipObservation(
      RELATIONSHIP,
      'relationship:record',
      ACTOR
    )).toEqual({ ok: true, idempotent: false });
    expect(getObservation(TIDEGARDEN_RELATIONSHIP_OBSERVATION_ID, ACTOR)).toBeDefined();
    const events = getEmergentStoryEvents();
    expect(events[events.length - 1]?.type).toBe('observation_recorded');
  });

  it('relocates lift practice into a non-blocking aerial survey above the chosen site', () => {
    primeScanner();
    attendTidegardenRelationship(RELATIONSHIP, 'relationship:aerial-survey', ACTOR);
    expect(chooseTidegardenHabitatSite({
      worldId: TIDEGARDEN_WORLD_ID,
      planetSize: 12,
      playerPosition: PLAYER,
      terrain: TERRAIN,
      actorId: ACTOR,
      eventId: 'site:aerial-survey'
    })).toEqual({ ok: true, idempotent: false });
    const site = getTidegardenChosenHabitatSite(ACTOR);
    if (!site) throw new Error('Expected a chosen Tidegarden site.');
    const position = site.position.clone().addScaledVector(site.up, 3);
    const sample = {
      actorId: ACTOR,
      runId: 7,
      worldId: TIDEGARDEN_WORLD_ID,
      storyBeat: 'ch9-settle' as const,
      position: position.toArray() as [number, number, number],
      surfaceUp: site.up.toArray() as [number, number, number],
      grounded: false,
      jetpackActive: true,
      dt: 0.1
    };

    expect(observeTidegardenAerialSiteSurvey({ ...sample, grounded: true })).toBe(false);
    expect(observeTidegardenAerialSiteSurvey({ ...sample, storyBeat: 'ch7-reconstruct' })).toBe(false);
    for (let elapsed = 0; elapsed < TIDEGARDEN_AERIAL_SURVEY_HOLD_SECONDS; elapsed += 0.1) {
      observeTidegardenAerialSiteSurvey(sample);
    }
    expect(hasMilestone(TIDEGARDEN_SETTLEMENT_MILESTONES.aerialSiteSurvey, ACTOR)).toBe(true);
    expect(getAccomplishment('tidegarden_aerial_site_survey', ACTOR)).toBeDefined();
    // The relocated rehearsal is exploration, never another settlement gate.
    expect(getTidegardenSettlementGuidance({
      actorId: ACTOR,
      coreCarried: false,
      foundationPlaced: false,
      night: false
    }).id).toBe('craft-core');
  });

  it('rejects wet/unprepared choices and only activates on the chosen valid foundation', () => {
    primeScanner();
    addItem('habitat_core', 1, ACTOR);
    expect(validateTidegardenHabitatSite({
      worldId: TIDEGARDEN_WORLD_ID,
      planetSize: 12,
      playerPosition: PLAYER,
      terrain: TERRAIN,
      actorId: ACTOR
    })).toEqual({ ok: false, reason: 'relationship-not-attended' });

    attendTidegardenRelationship(RELATIONSHIP, 'relationship:attend', ACTOR);
    expect(validateTidegardenHabitatSite({
      worldId: TIDEGARDEN_WORLD_ID,
      planetSize: 12,
      playerPosition: PLAYER,
      terrain: TERRAIN,
      actorId: ACTOR
    })).toEqual({ ok: false, reason: 'site-not-chosen' });

    expect(chooseTidegardenHabitatSite({
      worldId: TIDEGARDEN_WORLD_ID,
      planetSize: 12,
      playerPosition: PLAYER,
      terrain: TERRAIN,
      actorId: ACTOR,
      eventId: 'site:chosen'
    })).toEqual({ ok: true, idempotent: false });
    expect(validateTidegardenHabitatSite({
      worldId: TIDEGARDEN_WORLD_ID,
      planetSize: 12,
      playerPosition: PLAYER,
      terrain: TERRAIN,
      actorId: ACTOR
    })).toEqual({ ok: false, reason: 'foundation-required' });

    placePiece(LOWER, 3, 'foundation', 'wood', 2, ACTOR);
    const validation = validateTidegardenHabitatSite({
      worldId: TIDEGARDEN_WORLD_ID,
      planetSize: 12,
      playerPosition: PLAYER,
      terrain: TERRAIN,
      actorId: ACTOR
    });
    expect(validation.ok).toBe(true);
    if (!validation.ok) throw new Error('Expected valid Habitat Core site.');
    expect(validation.proof.cell).toEqual(LOWER);

    const wetTerrain: SpawnTerrainQuery = {
      ...TERRAIN,
      isWaterVoxel: (_x, y) => y >= 5
    };
    placePiece([2, 5, 0], 3, 'foundation', 'wood', 2, ACTOR);
    expect(validateTidegardenHabitatSite({
      worldId: TIDEGARDEN_WORLD_ID,
      planetSize: 12,
      playerPosition: new THREE.Vector3(4, 10.2, 0),
      terrain: wetTerrain,
      actorId: ACTOR
    })).toEqual({ ok: false, reason: 'site-not-dry-level-clear' });

    expect(activateTidegardenHabitatCore({
      proof: validation.proof,
      eventId: 'habitat:online',
      actorId: ACTOR
    })).toEqual({ ok: true, idempotent: false });
    expect(getItemCount('habitat_core', ACTOR)).toBe(0);
    expect(getEmergentStoryEvents().some(event => (
      event.type === 'station_activated'
      && event.payload.stationId === 'habitat_core'
    ))).toBe(true);

  });

  it('certifies a real enclosure and completes only a live sheltered night rest', () => {
    primeScanner();
    attendTidegardenRelationship(RELATIONSHIP, 'relationship:attend', ACTOR);
    addItem('habitat_core', 1, ACTOR);
    chooseTidegardenHabitatSite({
      worldId: TIDEGARDEN_WORLD_ID,
      planetSize: 12,
      playerPosition: PLAYER,
      terrain: TERRAIN,
      actorId: ACTOR,
      eventId: 'site:chosen'
    });
    placePiece(LOWER, 3, 'foundation', 'wood', 2, ACTOR);
    const site = validateTidegardenHabitatSite({
      worldId: TIDEGARDEN_WORLD_ID,
      planetSize: 12,
      playerPosition: PLAYER,
      terrain: TERRAIN,
      actorId: ACTOR
    });
    if (!site.ok) throw new Error('Expected valid Habitat Core site.');
    activateTidegardenHabitatCore({ proof: site.proof, eventId: 'habitat:online', actorId: ACTOR });

    expect(certifyTidegardenShelter({
      worldId: TIDEGARDEN_WORLD_ID,
      playerPosition: PLAYER,
      eventId: 'shelter:premature',
      actorId: ACTOR
    })).toEqual({ ok: false, reason: 'physical-enclosure-incomplete' });

    buildRoom();
    expect(certifyTidegardenShelter({
      worldId: TIDEGARDEN_WORLD_ID,
      playerPosition: PLAYER,
      eventId: 'shelter:certified',
      actorId: ACTOR
    })).toEqual({ ok: true, idempotent: false });
    expect(getAccomplishment('living_address', ACTOR)).toBeDefined();
    expect(canRestAtTidegardenHabitat(TIDEGARDEN_WORLD_ID, PLAYER, 0.25)).toBe(false);
    expect(completeTidegardenSafeRest({
      worldId: TIDEGARDEN_WORLD_ID,
      playerPosition: PLAYER,
      dayPhase: 0.25,
      eventId: 'rest:day',
      actorId: ACTOR
    })).toEqual({ ok: false, reason: 'rest-requires-night' });

    expect(canRestAtTidegardenHabitat(TIDEGARDEN_WORLD_ID, PLAYER, 0.75)).toBe(true);
    setVitals({ stamina: 27, warmth: 41 }, ACTOR);
    expect(completeTidegardenSafeRest({
      worldId: TIDEGARDEN_WORLD_ID,
      playerPosition: PLAYER,
      dayPhase: 0.75,
      eventId: 'rest:safe',
      actorId: ACTOR
    })).toEqual({ ok: true, idempotent: false });
    expect(getVitals(ACTOR)).toMatchObject({ stamina: 100, warmth: 100 });
    expect(getAccomplishment('second_hearth', ACTOR)).toBeDefined();
    expect(getEmergentStoryEvents().slice(-3).map(event => event.type)).toEqual([
      'safe_rest_completed',
      'two_world_story_handoff',
      'accomplishment_recorded'
    ]);

    const eventCount = getEmergentStoryEvents().length;
    resetProgression();
    expect(reconcileTidegardenSettlementMilestones(TIDEGARDEN_WORLD_ID, ACTOR)).toBe(true);
    expect(hasMilestone(TIDEGARDEN_SETTLEMENT_MILESTONES.relationshipAttended, ACTOR)).toBe(true);
    expect(hasMilestone(TIDEGARDEN_SETTLEMENT_MILESTONES.coreOnline, ACTOR)).toBe(true);
    expect(hasMilestone(TIDEGARDEN_SETTLEMENT_MILESTONES.shelterCertified, ACTOR)).toBe(true);
    expect(hasMilestone(TIDEGARDEN_SETTLEMENT_MILESTONES.safeRestCompleted, ACTOR)).toBe(true);
    expect(hasMilestone(TIDEGARDEN_SETTLEMENT_MILESTONES.twoWorldHandoff, ACTOR)).toBe(true);
    expect(getEmergentStoryEvents()).toHaveLength(eventCount);
  });
});

function primeScanner(): void {
  const result = commitTidegardenScannerOverload({
    worldId: TIDEGARDEN_WORLD_ID,
    renderedFrames: 1,
    visibleSignalIds: ['a', 'b', 'c', 'd', 'e', 'f'],
    relationshipKinds: ['water-root', 'canopy-shelter', 'pollen-route']
  }, 'scanner:physical', ACTOR);
  expect(result.ok).toBe(true);
}

function buildRoom(): void {
  placePiece(UPPER, 2, 'ceiling', 'wood', 2, ACTOR);
  for (const cell of [LOWER, UPPER] as const) {
    for (const face of [0, 1, 4, 5]) {
      placePiece(cell, face, 'wall', 'wood', 2, ACTOR);
    }
  }
}
