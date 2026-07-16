import { beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { addItem, resetInventory } from '../game/systems/inventorySystem.ts';
import { hasMilestone, markMilestone, resetProgression } from '../game/systems/progressionSystem.ts';
import { getVitals, resetVitals, setVitals } from '../game/systems/survivalVitals.ts';
import {
  isDryClearResumePosition,
  type SpawnTerrainQuery
} from '../utils/spawnValidation.ts';
import { getWorldGen } from '../utils/worldGenCache.ts';
import {
  AUTHORED_DIVE_MILESTONES,
  invalidateAuthoredDiveMotionContinuity,
  resetAuthoredDiveRuntime,
  tickAuthoredDive
} from './emergentDive.ts';
import {
  applyAuthoredDiveReloadRecovery,
  resolveAuthoredDiveReloadRecovery
} from './diveReloadRecovery.ts';
import { STORY_PRIMARY_WORLD_ID } from './tidegardenRoute.ts';
import { getPondPose, STORY_SEED } from './world/storyWorld.ts';

const ACTOR = 'chapter-6-reload-test';
const PLANET_SIZE = 50;

function canonicalTerrain(): SpawnTerrainQuery {
  const generator = getWorldGen(PLANET_SIZE, STORY_SEED, STORY_PRIMARY_WORLD_ID).generator;
  return {
    shouldVoxelExist: (x, y, z) => generator.shouldVoxelExist(x, y, z),
    isWaterVoxel: (x, y, z) => generator.isWaterVoxel(x, y, z),
    generateBlockForPosition: (x, y, z) => generator.generateBlockForPosition(x, y, z)
  };
}

describe('Chapter 6 dive reload recovery', () => {
  beforeEach(() => {
    resetAuthoredDiveRuntime();
    resetInventory(ACTOR);
    resetProgression(ACTOR);
    resetVitals(ACTOR);
  });

  it('resolves the canonical mid-dive reload onto a validated dry pond shore', () => {
    const terrain = canonicalTerrain();
    const pond = getPondPose(PLANET_SIZE, STORY_SEED, STORY_PRIMARY_WORLD_ID);
    const plan = resolveAuthoredDiveReloadRecovery({
      terrain,
      planetSize: PLANET_SIZE,
      pond,
      fallbackPosition: new THREE.Vector3(0, PLANET_SIZE + 20, 0)
    });

    expect(pond).not.toBeNull();
    expect(plan).not.toBeNull();
    expect(plan).toMatchObject({
      oxygen: 100,
      invalidateMotionContinuity: true,
      pitch: 0,
      source: 'pond-shore'
    });
    expect(isDryClearResumePosition(terrain, PLANET_SIZE, plan!.position)).toBe(true);
    expect(plan!.shoreDistance).not.toBeNull();
    expect(plan!.shoreDistance!).toBeLessThan(18);
    const expectedLook = pond!.surface.clone().sub(plan!.position).normalize();
    expect(plan!.lookDirection.dot(expectedLook)).toBeCloseTo(1, 6);
  });

  it('invalidates wet-to-dry continuity before restoring oxygen and publishing shore', () => {
    const terrain = canonicalTerrain();
    const pond = getPondPose(PLANET_SIZE, STORY_SEED, STORY_PRIMARY_WORLD_ID);
    const plan = resolveAuthoredDiveReloadRecovery({
      terrain,
      planetSize: PLANET_SIZE,
      pond,
      fallbackPosition: new THREE.Vector3(0, PLANET_SIZE + 20, 0)
    });
    expect(plan).not.toBeNull();

    tickAuthoredDive({
      authored: true,
      actorId: ACTOR,
      worldId: STORY_PRIMARY_WORLD_ID,
      submergence: 0.8,
      oxygen: 90
    });
    addItem('kestrel_keel_memory', 1, ACTOR);
    markMilestone('story:item:kestrel-keel-memory:acquired', ACTOR);

    const order: string[] = [];
    let publishedPosition = new THREE.Vector3();
    const applied = applyAuthoredDiveReloadRecovery(plan!, {
      invalidateMotionContinuity: () => {
        order.push('continuity');
        invalidateAuthoredDiveMotionContinuity(ACTOR);
      },
      setLook: () => order.push('look'),
      restoreOxygen: oxygen => {
        order.push('oxygen');
        setVitals({ oxygen }, ACTOR);
      },
      setWorldPosition: position => {
        order.push('position');
        publishedPosition = position;
      }
    });

    expect(order).toEqual(['continuity', 'look', 'oxygen', 'position']);
    expect(getVitals(ACTOR).oxygen).toBe(100);
    expect(publishedPosition.toArray()).toEqual(plan!.position.toArray());
    expect(applied.toArray()).toEqual(plan!.position.toArray());

    // The first dry body sample after relocation initializes a new sequence. It
    // cannot cash the already-held Keel into an authored surfacing receipt.
    tickAuthoredDive({
      authored: true,
      actorId: ACTOR,
      worldId: STORY_PRIMARY_WORLD_ID,
      submergence: 0,
      oxygen: 100
    });
    expect(hasMilestone(AUTHORED_DIVE_MILESTONES.surfacedWithKeel, ACTOR)).toBe(false);
  });

  it('uses only a validated dry arrival fallback when the authored shore is unavailable', () => {
    const terrain = canonicalTerrain();
    const pond = getPondPose(PLANET_SIZE, STORY_SEED, STORY_PRIMARY_WORLD_ID);
    const shorePlan = resolveAuthoredDiveReloadRecovery({
      terrain,
      planetSize: PLANET_SIZE,
      pond,
      fallbackPosition: new THREE.Vector3(0, PLANET_SIZE + 20, 0)
    });
    expect(shorePlan).not.toBeNull();

    const fallback = resolveAuthoredDiveReloadRecovery({
      terrain,
      planetSize: PLANET_SIZE,
      pond: null,
      fallbackPosition: shorePlan!.position,
      fallbackLookDirection: new THREE.Vector3(1, 0, 0)
    });

    expect(fallback).toMatchObject({
      source: 'arrival-fallback',
      oxygen: 100,
      shoreDistance: null
    });
    expect(isDryClearResumePosition(terrain, PLANET_SIZE, fallback!.position)).toBe(true);
    expect(fallback!.lookDirection.toArray()).toEqual([1, 0, 0]);
  });

  it('refuses to publish either candidate when neither has dry physical support', () => {
    const unsupported: SpawnTerrainQuery = {
      shouldVoxelExist: () => false,
      isWaterVoxel: () => false,
      generateBlockForPosition: () => 'stone'
    };

    expect(resolveAuthoredDiveReloadRecovery({
      terrain: unsupported,
      planetSize: 12,
      pond: {
        shore: new THREE.Vector3(0, 12, 0),
        surface: new THREE.Vector3(0, 10, 0)
      },
      fallbackPosition: new THREE.Vector3(4, 12, 0),
      maxSearchRadius: 2,
      fallbackSearchRadius: 2
    })).toBeNull();
  });
});
