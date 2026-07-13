import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { BlockId } from '../game/data/blocks.ts';
import type { CubeFace } from '../types/cube.ts';
import { FACE_NORMALS } from './surfaceControls.ts';
import {
  findValidSpawnSite,
  isDryClearResumePosition,
  isValidatedSpawnPosition,
  resolveSafePlayerResetPosition,
  resolveSafeShipBoardingPosition,
  resolveShipPlayerEgressPosition,
  shouldBypassSurfaceSpawnSettle,
  type SpawnTerrainQuery
} from './spawnValidation.ts';

function terrainQuery(input: {
  solid: (x: number, y: number, z: number) => boolean;
  water?: (x: number, y: number, z: number) => boolean;
  block?: (x: number, y: number, z: number) => BlockId;
}): SpawnTerrainQuery {
  return {
    shouldVoxelExist: input.solid,
    isWaterVoxel: input.water ?? (() => false),
    generateBlockForPosition: input.block ?? (() => 'stone')
  };
}

describe('spawn validation', () => {
  it('holds normal surface spawns for colliders but releases real approaches', () => {
    expect(shouldBypassSurfaceSpawnSettle(new THREE.Vector3(0, 53.85, 0), 50)).toBe(false);
    expect(shouldBypassSurfaceSpawnSettle(new THREE.Vector3(49, 53.85, 49), 50)).toBe(false);
    expect(shouldBypassSurfaceSpawnSettle(new THREE.Vector3(-53.85, 49, -49), 50)).toBe(false);
    expect(shouldBypassSurfaceSpawnSettle(new THREE.Vector3(58, 0, 0), 50)).toBe(false);
    expect(shouldBypassSurfaceSpawnSettle(new THREE.Vector3(0, -58.01, 0), 50)).toBe(true);
    expect(shouldBypassSurfaceSpawnSettle(new THREE.Vector3(0, 83.85, 0), 50)).toBe(true);
  });

  it('places a player above a dry, level, clear top-face patch', () => {
    const terrain = terrainQuery({
      solid: (x, y, z) => Math.abs(x) <= 5 && Math.abs(z) <= 5 && y <= 4
    });
    const site = findValidSpawnSite(terrain, 12, new THREE.Vector3(0, 12, 0), {
      kind: 'player',
      face: 'top'
    });

    expect(site).not.toBeNull();
    expect(site?.supportVoxel).toEqual({ x: 0, y: 4, z: 0 });
    expect(site?.position.y).toBeCloseTo(11.85);
    expect(site?.relocated).toBe(true); // preferred was a request, not a settled pose
    expect(isValidatedSpawnPosition(terrain, 12, site!.position, 'player')).toBe(true);
  });

  it('preserves a safe persisted pose but rejects embedded and flooded resumes', () => {
    const dry = terrainQuery({
      solid: (x, y, z) => Math.abs(x) <= 5 && Math.abs(z) <= 5 && y <= 4
    });
    expect(isDryClearResumePosition(dry, 12, new THREE.Vector3(0.35, 11.1, -0.4))).toBe(true);
    expect(isDryClearResumePosition(dry, 12, new THREE.Vector3(0, 10.79, 0))).toBe(true);
    expect(isDryClearResumePosition(dry, 12, new THREE.Vector3(0, 8.4, 0))).toBe(false);

    const wet = terrainQuery({
      solid: (x, y, z) => Math.abs(x) <= 5 && Math.abs(z) <= 5 && y <= 4,
      water: (_x, y) => y >= 5
    });
    expect(isDryClearResumePosition(wet, 12, new THREE.Vector3(0, 11.1, 0))).toBe(false);

    const wall = terrainQuery({
      solid: (x, y, z) =>
        (Math.abs(x) <= 5 && Math.abs(z) <= 5 && y <= 4)
        || (x === 1 && z === 0 && (y === 5 || y === 6))
    });
    expect(isDryClearResumePosition(wall, 12, new THREE.Vector3(0.75, 11.1, 0))).toBe(false);

    const cornerWall = terrainQuery({
      solid: (x, y, z) =>
        (Math.abs(x) <= 5 && Math.abs(z) <= 5 && y <= 4)
        || (x === 1 && z === 1 && (y === 5 || y === 6))
    });
    expect(isDryClearResumePosition(
      cornerWall,
      12,
      new THREE.Vector3(0.82, 11.1, 0.56)
    )).toBe(false);
  });

  it('moves away from flooded ground instead of spawning in water', () => {
    const terrain = terrainQuery({
      solid: (x, y, z) => Math.abs(x) <= 7 && Math.abs(z) <= 7 && y <= 6,
      water: (x, y, z) => y === 7 && Math.abs(x) <= 1 && Math.abs(z) <= 1
    });
    const site = findValidSpawnSite(terrain, 16, new THREE.Vector3(0, 16, 0), {
      kind: 'player',
      face: 'top',
      maxSearchRadius: 5
    });

    expect(site).not.toBeNull();
    expect(site!.searchDistanceCells).toBeGreaterThanOrEqual(3);
    expect(terrain.isWaterVoxel(
      site!.supportVoxel.x,
      site!.supportVoxel.y + 1,
      site!.supportVoxel.z
    )).toBe(false);
  });

  it('rejects a stepped ship footprint and selects a genuinely level pad', () => {
    const surfaceHeight = (x: number) => x < 0 ? 4 : 3;
    const terrain = terrainQuery({
      solid: (x, y, z) => Math.abs(x) <= 6 && Math.abs(z) <= 6 && y <= surfaceHeight(x)
    });
    const site = findValidSpawnSite(terrain, 14, new THREE.Vector3(0, 14, 0), {
      kind: 'ship',
      face: 'top',
      maxSearchRadius: 6
    });

    expect(site).not.toBeNull();
    const heights = new Set<number>();
    for (let dx = -1; dx <= 1; dx++) heights.add(surfaceHeight(site!.supportVoxel.x + dx));
    expect(heights.size).toBe(1);
    expect(site!.searchDistanceCells).toBeGreaterThan(0);
  });

  it('recovers an inside-terrain request onto the requested surface face', () => {
    const terrain = terrainQuery({
      solid: (x, y, z) => Math.abs(x) <= 5 && Math.abs(z) <= 5 && y <= 4
    });
    const site = findValidSpawnSite(terrain, 12, new THREE.Vector3(0, 0, 0), {
      kind: 'player',
      face: 'top',
      maxSearchRadius: 4
    });

    expect(site?.face).toBe('top');
    expect(site?.supportVoxel).toEqual({ x: 0, y: 4, z: 0 });
    expect(site!.position.y).toBeGreaterThan(10);
  });

  it('uses the same dry/flat/clear contract on every cube face', () => {
    const terrain = terrainQuery({
      solid: (x, y, z) => Math.max(Math.abs(x), Math.abs(y), Math.abs(z)) <= 4
    });
    const faces: CubeFace[] = ['top', 'bottom', 'right', 'left', 'front', 'back'];

    for (const face of faces) {
      const up = FACE_NORMALS[face];
      const preferred = up.clone().multiplyScalar(12);
      const site = findValidSpawnSite(terrain, 12, preferred, {
        kind: 'ship',
        face,
        maxSearchRadius: 2,
        requirePlayerEgress: true
      });
      expect(site, face).not.toBeNull();
      expect(site!.face).toBe(face);
      expect(site!.supportVoxel.x * up.x + site!.supportVoxel.y * up.y + site!.supportVoxel.z * up.z).toBe(4);
      expect(isValidatedSpawnPosition(terrain, 12, site!.position, 'ship')).toBe(true);
      const egress = resolveShipPlayerEgressPosition(terrain, 12, site!.position, face);
      expect(egress, face).not.toBeNull();
      // Requested capsule is still close enough to board; after its one-unit
      // settle it is closer again.
      expect(egress!.distanceTo(site!.position)).toBeLessThan(3.5);
      const settled = egress!.clone().addScaledVector(up, -1);
      expect(isDryClearResumePosition(terrain, 12, settled)).toBe(true);
    }
  });

  it('rejects capsule-wall intersections on positive and negative cube faces', () => {
    const cases: Array<{
      face: CubeFace;
      position: THREE.Vector3;
      wall: (x: number, y: number, z: number) => boolean;
    }> = [
      { face: 'top', position: new THREE.Vector3(0.75, 11.1, 0), wall: (x, y, z) => x === 1 && z === 0 && (y === 5 || y === 6) },
      { face: 'bottom', position: new THREE.Vector3(0.75, -11.1, 0), wall: (x, y, z) => x === 1 && z === 0 && (y === -5 || y === -6) },
      { face: 'right', position: new THREE.Vector3(11.1, 0.75, 0), wall: (x, y, z) => y === 1 && z === 0 && (x === 5 || x === 6) },
      { face: 'left', position: new THREE.Vector3(-11.1, 0.75, 0), wall: (x, y, z) => y === 1 && z === 0 && (x === -5 || x === -6) },
      { face: 'front', position: new THREE.Vector3(0.75, 0, 11.1), wall: (x, y, z) => x === 1 && y === 0 && (z === 5 || z === 6) },
      { face: 'back', position: new THREE.Vector3(0.75, 0, -11.1), wall: (x, y, z) => x === 1 && y === 0 && (z === -5 || z === -6) }
    ];
    for (const entry of cases) {
      const terrain = terrainQuery({
        solid: (x, y, z) => Math.max(Math.abs(x), Math.abs(y), Math.abs(z)) <= 4
          || entry.wall(x, y, z)
      });
      expect(
        isDryClearResumePosition(terrain, 12, entry.position),
        entry.face
      ).toBe(false);
    }
  });

  it('rejects a ship pad when its actual tail-side player exit is flooded', () => {
    const dry = terrainQuery({
      solid: (x, y, z) => Math.abs(x) <= 5 && Math.abs(z) <= 5 && y <= 4
    });
    const ship = findValidSpawnSite(dry, 12, new THREE.Vector3(0, 12, 0), {
      kind: 'ship',
      face: 'top',
      maxSearchRadius: 0
    });
    expect(ship).not.toBeNull();
    const egress = resolveShipPlayerEgressPosition(dry, 12, ship!.position, 'top');
    expect(egress).not.toBeNull();
    const wetX = Math.round(egress!.x / 2);
    const wetZ = Math.round(egress!.z / 2);
    const floodedExit = terrainQuery({
      solid: (x, y, z) => Math.abs(x) <= 5 && Math.abs(z) <= 5 && y <= 4,
      water: (x, y, z) => x === wetX && z === wetZ && y === 5
    });

    expect(findValidSpawnSite(floodedExit, 12, ship!.position, {
      kind: 'ship',
      face: 'top',
      maxSearchRadius: 0,
      requirePlayerEgress: true
    })).toBeNull();
    expect(resolveShipPlayerEgressPosition(floodedExit, 12, ship!.position, 'top')).toBeNull();
  });

  it('relocates R/recovery when the live reset support was dug and flooded', () => {
    const reset = new THREE.Vector3(0, 11.85, 0);
    const terrain = terrainQuery({
      solid: (x, y, z) => Math.abs(x) <= 6 && Math.abs(z) <= 6 && y <= 4
        && !(x === 0 && y === 4 && z === 0),
      water: (x, y, z) => x === 0 && y === 4 && z === 0
    });
    const resolved = resolveSafePlayerResetPosition(terrain, 14, reset, {
      face: 'top',
      maxSearchRadius: 6
    });

    expect(resolved).not.toBeNull();
    expect(resolved!.distanceTo(reset)).toBeGreaterThan(2);
    const settled = resolved!.clone();
    settled.y -= 1;
    expect(isDryClearResumePosition(terrain, 14, settled)).toBe(true);
  });

  it('refuses stale ship boarding and can relocate to a complete live pad', () => {
    const original = new THREE.Vector3(0, 11.5, 0);
    const terrain = terrainQuery({
      solid: (x, y, z) => Math.abs(x) <= 7 && Math.abs(z) <= 7 && y <= 4
        && !(x === 0 && y === 4 && z === 0),
      water: (x, y, z) => x === 0 && y === 4 && z === 0
    });

    expect(resolveSafeShipBoardingPosition(terrain, 16, original, 0)).toBeNull();
    const relocated = resolveSafeShipBoardingPosition(terrain, 16, original, 7);
    expect(relocated).not.toBeNull();
    expect(relocated!.distanceTo(original)).toBeGreaterThan(2);
    expect(isValidatedSpawnPosition(terrain, 16, relocated!, 'ship')).toBe(true);
    expect(resolveShipPlayerEgressPosition(terrain, 16, relocated!)).not.toBeNull();
  });

  it('returns null when the bounded search contains no dry site', () => {
    const terrain = terrainQuery({
      solid: (x, y, z) => Math.abs(x) <= 5 && Math.abs(z) <= 5 && y <= 4,
      water: (_x, y) => y >= 5
    });
    expect(findValidSpawnSite(terrain, 12, new THREE.Vector3(0, 12, 0), {
      kind: 'ship',
      face: 'top',
      maxSearchRadius: 4
    })).toBeNull();
  });

  it('rejects lava support even when the pad is otherwise flat and dry', () => {
    const terrain = terrainQuery({
      solid: (x, y, z) => Math.abs(x) <= 5 && Math.abs(z) <= 5 && y <= 4,
      block: () => 'lava'
    });
    expect(findValidSpawnSite(terrain, 12, new THREE.Vector3(0, 12, 0), {
      kind: 'player',
      face: 'top',
      maxSearchRadius: 4
    })).toBeNull();
  });
});
