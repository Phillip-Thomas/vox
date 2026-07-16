import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { PLAYER_CENTER_CLEARANCE, VOXEL_SCALE } from './cubeGravityConstants.ts';
import {
  planAgentSurfaceRoute,
  type AgentSurfaceTerrainQuery
} from './agentSurfaceNavigation.ts';

const PLANET_SIZE = 20;
const BASE_HEIGHT = 8;

interface TerrainFixtureOptions {
  heightAt?: (u: number, v: number) => number;
  water?: ReadonlySet<string>;
  waterDepth?: number;
  hazardous?: ReadonlySet<string>;
}

function key(u: number, v: number): string {
  return `${u},${v}`;
}

function terrainFixture(options: TerrainFixtureOptions = {}): AgentSurfaceTerrainQuery {
  const heightAt = options.heightAt ?? (() => BASE_HEIGHT);
  const water = options.water ?? new Set<string>();
  const hazardous = options.hazardous ?? new Set<string>();
  const waterDepth = options.waterDepth ?? 1;
  return {
    isSolidVoxel: (x, y, z) => y === heightAt(x, z),
    isWaterVoxel: (x, y, z) => {
      if (!water.has(key(x, z))) return false;
      const support = heightAt(x, z);
      return y > support && y <= support + waterDepth;
    },
    isHazardousVoxel: (x, y, z) => y === heightAt(x, z) && hazardous.has(key(x, z))
  };
}

function actorPosition(u: number, v: number, height = BASE_HEIGHT): THREE.Vector3 {
  return new THREE.Vector3(
    u * VOXEL_SCALE,
    height * VOXEL_SCALE + PLAYER_CENTER_CLEARANCE,
    v * VOXEL_SCALE
  );
}

function waypointCells(route: ReturnType<typeof planAgentSurfaceRoute>): string[] {
  return route.waypoints.map(point => key(
    Math.round(point.x / VOXEL_SCALE),
    Math.round(point.z / VOXEL_SCALE)
  ));
}

describe('planAgentSurfaceRoute', () => {
  it('walks a deterministic dry same-face route with cardinal world waypoints', () => {
    const terrain = terrainFixture();
    const first = planAgentSurfaceRoute(
      terrain,
      PLANET_SIZE,
      actorPosition(-4, 0),
      actorPosition(4, 0)
    );
    const second = planAgentSurfaceRoute(
      terrain,
      PLANET_SIZE,
      actorPosition(-4, 0),
      actorPosition(4, 0)
    );

    expect(first.mode).toBe('walk');
    expect(first.reason).toBe('dry-surface-path');
    expect(first.waterCrossing).toBeNull();
    expect(waypointCells(first)).toEqual(waypointCells(second));
    expect(waypointCells(first)).toEqual([
      '-4,0', '-3,0', '-2,0', '-1,0', '0,0', '1,0', '2,0', '3,0', '4,0'
    ]);
  });

  it('prefers a modest dry detour over an unnecessary jetpack crossing', () => {
    const water = new Set([key(0, 0)]);
    const route = planAgentSurfaceRoute(
      terrainFixture({ water }),
      PLANET_SIZE,
      actorPosition(-4, 0),
      actorPosition(4, 0)
    );

    expect(route.mode).toBe('walk');
    expect(route.waterCrossing).toBeNull();
    expect(waypointCells(route)).not.toContain('0,0');
  });

  it('uses one short safe jetpack crossing when the dry detour is substantially longer', () => {
    const water = new Set<string>();
    for (let v = -4; v <= 4; v++) water.add(key(0, v));
    const route = planAgentSurfaceRoute(
      terrainFixture({ water }),
      PLANET_SIZE,
      actorPosition(-4, 0),
      actorPosition(4, 0)
    );

    expect(route.mode).toBe('jetpack');
    expect(route.reason).toBe('dry-detour-substantially-longer');
    expect(route.waterCrossing).toMatchObject({
      waterCellCount: 1,
      maxConsecutiveWaterCells: 1,
      reason: 'dry-detour-substantially-longer'
    });
    expect(route.waterCrossing!.dryPathCost).toBeGreaterThan(route.waterCrossing!.selectedPathCost);
  });

  it('uses a bounded short crossing when no dry route exists', () => {
    const water = new Set<string>();
    for (let v = -7; v <= 7; v++) water.add(key(0, v));
    const route = planAgentSurfaceRoute(
      terrainFixture({ water }),
      PLANET_SIZE,
      actorPosition(-4, 0),
      actorPosition(4, 0),
      { maxJetpackWaterCells: 1 }
    );

    expect(route.mode).toBe('jetpack');
    expect(route.reason).toBe('dry-route-unavailable-short-water-crossing');
    expect(route.waterCrossing).toMatchObject({
      waterCellCount: 1,
      dryPathCost: null,
      reason: 'dry-route-unavailable'
    });

    const withoutJetpack = planAgentSurfaceRoute(
      terrainFixture({ water }),
      PLANET_SIZE,
      actorPosition(-4, 0),
      actorPosition(4, 0),
      { maxJetpackWaterCells: 1, allowJetpackCrossing: false }
    );
    expect(withoutJetpack.mode).toBe('unreachable');
    expect(withoutJetpack.waterCrossing).toBeNull();
  });

  it('refuses a water crossing wider than the configured safe cell budget', () => {
    const water = new Set<string>();
    for (let u = -1; u <= 1; u++) {
      for (let v = -12; v <= 12; v++) water.add(key(u, v));
    }
    const route = planAgentSurfaceRoute(
      terrainFixture({ water }),
      PLANET_SIZE,
      actorPosition(-4, 0),
      actorPosition(4, 0),
      { maxJetpackWaterCells: 2 }
    );

    expect(route.mode).toBe('unreachable');
    expect(route.waterCrossing).toBeNull();
  });

  it('splits a wet start into a nearest-dry egress before budgeting later water', () => {
    const water = new Set<string>();
    for (let v = -7; v <= 7; v++) {
      water.add(key(-2, v));
      water.add(key(1, v));
    }
    const terrain = terrainFixture({ water });
    const egress = planAgentSurfaceRoute(
      terrain,
      PLANET_SIZE,
      actorPosition(-2, 0),
      actorPosition(4, 0),
      { maxJetpackWaterCells: 1 }
    );

    expect(egress.mode).toBe('jetpack');
    expect(egress.reason).toBe('wet-start-egress');
    expect(waypointCells(egress)).toEqual(['-2,0', '-1,0']);
    expect(egress.waterCrossing?.waterCellCount).toBe(1);

    const onward = planAgentSurfaceRoute(
      terrain,
      PLANET_SIZE,
      egress.resolvedGoal!,
      actorPosition(4, 0),
      { maxJetpackWaterCells: 1 }
    );
    expect(onward.mode).toBe('jetpack');
    expect(onward.reason).not.toBe('wet-start-egress');
  });

  it('returns a dry partial bank when the goal needs multiple water crossings', () => {
    const water = new Set<string>();
    for (let v = -7; v <= 7; v++) {
      water.add(key(-2, v));
      water.add(key(1, v));
    }
    const terrain = terrainFixture({ water });
    const first = planAgentSurfaceRoute(
      terrain,
      PLANET_SIZE,
      actorPosition(-4, 0),
      actorPosition(4, 0),
      { maxJetpackWaterCells: 1 }
    );

    expect(first.mode).toBe('jetpack');
    expect(first.reason).toBe('partial-water-crossing-egress');
    const firstWaypointCells = waypointCells(first);
    expect(firstWaypointCells[firstWaypointCells.length - 1]).toBe('0,0');
    expect(first.waterCrossing?.waterCellCount).toBe(1);

    const second = planAgentSurfaceRoute(
      terrain,
      PLANET_SIZE,
      first.resolvedGoal!,
      actorPosition(4, 0),
      { maxJetpackWaterCells: 1 }
    );
    expect(second.mode).toBe('jetpack');
    expect(second.reason).not.toBe('partial-water-crossing-egress');
    const secondWaypointCells = waypointCells(second);
    expect(secondWaypointCells[secondWaypointCells.length - 1]).toBe('4,0');
  });

  it('resolves a wet goal to the deterministic nearest dry approach', () => {
    const water = new Set([key(3, 0)]);
    const route = planAgentSurfaceRoute(
      terrainFixture({ water }),
      PLANET_SIZE,
      actorPosition(-3, 0),
      actorPosition(3, 0)
    );

    expect(route.mode).toBe('walk');
    expect(route.requestedGoalWasWet).toBe(true);
    expect(route.reason).toBe('wet-goal-resolved-to-dry-approach');
    expect(route.resolvedGoal?.x).toBe(2 * VOXEL_SCALE);
    expect(waypointCells(route)).not.toContain('3,0');
  });

  it('enforces the one-cell slope limit and routes around a two-cell pillar', () => {
    const heightAt = (u: number, v: number) => u === 0 && v === 0 ? BASE_HEIGHT + 2 : BASE_HEIGHT;
    const route = planAgentSurfaceRoute(
      terrainFixture({ heightAt }),
      PLANET_SIZE,
      actorPosition(-3, 0),
      actorPosition(3, 0)
    );

    expect(route.mode).toBe('walk');
    expect(waypointCells(route)).not.toContain('0,0');
  });

  it('ignores logical terrain beyond the rendered shell when checking body clearance', () => {
    const radiusCells = PLANET_SIZE / VOXEL_SCALE;
    const terrain: AgentSurfaceTerrainQuery = {
      // The generator may report a logical bulge at y=radius+1 even though the
      // renderer/collider world ends at radius. The exposed boundary remains a
      // valid floor and the invisible bulge cannot block it.
      isSolidVoxel: (_x, y) => y === radiusCells || y === radiusCells + 1,
      isWaterVoxel: () => false
    };
    const route = planAgentSurfaceRoute(
      terrain,
      PLANET_SIZE,
      actorPosition(-3, 0, radiusCells),
      actorPosition(3, 0, radiusCells),
      { allowJetpackCrossing: false }
    );

    expect(route.mode).toBe('walk');
    expect(waypointCells(route)).toEqual([
      '-3,0', '-2,0', '-1,0', '0,0', '1,0', '2,0', '3,0'
    ]);
  });

  it('returns the explicit direct fallback for a different cube face', () => {
    const start = actorPosition(0, 0);
    const goal = new THREE.Vector3(
      BASE_HEIGHT * VOXEL_SCALE + PLAYER_CENTER_CLEARANCE,
      0,
      0
    );
    const route = planAgentSurfaceRoute(terrainFixture(), PLANET_SIZE, start, goal);

    expect(route.mode).toBe('direct');
    expect(route.reason).toBe('different-face-direct-fallback');
    expect(route.waypoints).toHaveLength(2);
    expect(route.waypoints[0].equals(start)).toBe(true);
    expect(route.waypoints[1].equals(goal)).toBe(true);
  });

  it('halts deterministically at the configured A* visit budget', () => {
    const route = planAgentSurfaceRoute(
      terrainFixture(),
      PLANET_SIZE,
      actorPosition(-4, 0),
      actorPosition(4, 0),
      { maxVisitedCells: 1, allowJetpackCrossing: false }
    );

    expect(route.mode).toBe('unreachable');
    expect(route.reason).toBe('search-budget-exhausted');
    expect(route.visitedCells).toBe(2);
  });
});
