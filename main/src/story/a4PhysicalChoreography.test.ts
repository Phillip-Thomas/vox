import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { AgentSurfaceTerrainQuery } from '../utils/agentSurfaceNavigation.ts';
import {
  a4HerdDistance,
  planA4GroundedRoute,
  sampleA4GroundedRoute
} from './a4PhysicalChoreography.ts';
import { getWorldGen } from '../utils/worldGenCache.ts';
import {
  getAuditWorkerPath,
  getFieldPackPose,
  getHeroTreePose,
  STORY_SEED
} from './world/storyWorld.ts';
import { STORY_PRIMARY_WORLD_ID } from './tidegardenRoute.ts';
import { authoredFrameDelta } from './authoredFrameTime.ts';

const flatDryTerrain: AgentSurfaceTerrainQuery = {
  isSolidVoxel: (_x, y) => y <= 10,
  isWaterVoxel: () => false,
  isHazardousVoxel: () => false
};

describe('A4 physical choreography route', () => {
  it('keeps herd, worker and tear on one dry grounded route', () => {
    const route = planA4GroundedRoute(
      flatDryTerrain,
      50,
      new THREE.Vector3(-12, 21.05, 0),
      new THREE.Vector3(12, 21.05, 8)
    );
    expect(route).not.toBeNull();
    if (!route) return;
    expect(route.length).toBeGreaterThan(10);
    expect(route.branchDistance).toBeLessThan(route.length);

    const workerAtTear = sampleA4GroundedRoute(route, route.branchDistance);
    expect(workerAtTear.position.y).toBeCloseTo(21.05, 2);
    expect(workerAtTear.heading.dot(route.up)).toBeCloseTo(0, 6);
    expect(a4HerdDistance(route, 1, 2)).toBeGreaterThan(0);
    expect(a4HerdDistance(route, 60, 0)).toBeGreaterThan(a4HerdDistance(route, 60, 4));
  });

  it('refuses a route whose only crossing is water', () => {
    const wetBarrier: AgentSurfaceTerrainQuery = {
      ...flatDryTerrain,
      isWaterVoxel: x => x >= -1 && x <= 1
    };
    expect(planA4GroundedRoute(
      wetBarrier,
      10,
      new THREE.Vector3(-8, 21.05, 0),
      new THREE.Vector3(8, 21.05, 0)
    )).toBeNull();
  });

  it('guarantees a dry authored route on the pinned story world', () => {
    const generator = getWorldGen(50, STORY_SEED, STORY_PRIMARY_WORLD_ID).generator;
    const terrain: AgentSurfaceTerrainQuery = {
      isSolidVoxel: (x, y, z) => generator.shouldVoxelExist(x, y, z),
      isWaterVoxel: (x, y, z) => generator.isWaterVoxel(x, y, z),
      isHazardousVoxel: (x, y, z) => generator.generateBlockForPosition(x, y, z) === 'lava'
    };
    const pack = getFieldPackPose(50, STORY_SEED, terrain);
    const approach = getAuditWorkerPath(50, STORY_SEED, terrain);
    expect(pack).not.toBeNull();
    expect(approach.length).toBeGreaterThan(1);
    if (!pack || approach.length === 0) return;
    const relayFallbackRoute = planA4GroundedRoute(
      terrain,
      50,
      approach[approach.length - 1].position,
      pack.position.clone().addScaledVector(pack.up, -0.13),
      pack.up
    );
    expect(relayFallbackRoute).not.toBeNull();
    expect(relayFallbackRoute?.length).toBeGreaterThan(4);

    // Both a continuous run and an isolated predecessor rehearsal start from
    // ch4-defy's terminal staging at the tree, not the much older relay post.
    const tree = getHeroTreePose(50, STORY_SEED);
    const terminalRoute = planA4GroundedRoute(
      terrain,
      50,
      tree.position.clone().addScaledVector(tree.up, 0.1),
      pack.position.clone().addScaledVector(pack.up, -0.13),
      pack.up
    );
    expect(terminalRoute).not.toBeNull();
    expect(terminalRoute?.length).toBeLessThan(relayFallbackRoute?.length ?? Infinity);
    if (!terminalRoute) return;

    // Reproduce the failed headed run's 0.447 FPS cadence. Bounded authored
    // catch-up must reach the physical branch well inside its 180s boundary,
    // while visibility loss contributes no progress.
    const rawFrameSeconds = 1 / 0.447;
    const workerStartSeconds = 2.15;
    const workerSpeed = 4.35;
    const handoffBreathSeconds = 10.5;
    let authoredElapsed = 0;
    let workerDistance = 0;
    let wallSeconds = 0;
    expect(authoredFrameDelta(1 / 60)).toBeCloseTo(1 / 60, 8);
    expect(authoredFrameDelta(rawFrameSeconds, { hidden: true })).toBe(0);
    while (wallSeconds < 180 && (
      authoredElapsed < handoffBreathSeconds
      || workerDistance < terminalRoute.branchDistance
    )) {
      const dt = authoredFrameDelta(rawFrameSeconds);
      authoredElapsed += dt;
      if (authoredElapsed >= workerStartSeconds) {
        workerDistance = Math.min(terminalRoute.length, workerDistance + dt * workerSpeed);
      }
      wallSeconds += rawFrameSeconds;
    }
    expect(authoredElapsed).toBeGreaterThanOrEqual(handoffBreathSeconds);
    expect(workerDistance).toBeGreaterThanOrEqual(terminalRoute.branchDistance);
    expect(wallSeconds).toBeLessThan(180);
  });
});
