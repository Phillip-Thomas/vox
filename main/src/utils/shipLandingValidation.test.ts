import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { CubeFace } from '../types/cube.ts';
import type { ValidatedSpawnSite } from './spawnValidation.ts';
import {
  COLLIDER_HALF_EXTENT,
  voxelCoordToWorld
} from './cubeGravityConstants.ts';
import { landingHitMatchesValidatedTerrain } from './shipLandingValidation.ts';

function siteFor(
  face: CubeFace,
  supportVoxel: { x: number; y: number; z: number },
  up: THREE.Vector3
): ValidatedSpawnSite {
  return {
    kind: 'ship',
    face,
    up,
    supportVoxel,
    position: voxelCoordToWorld(
      supportVoxel.x,
      supportVoxel.y,
      supportVoxel.z
    ).addScaledVector(up, 3.5),
    searchDistanceCells: 0,
    relocated: false
  };
}

function terrainFacePoint(
  site: ValidatedSpawnSite,
  tangent = new THREE.Vector3()
): THREE.Vector3 {
  return voxelCoordToWorld(
    site.supportVoxel.x,
    site.supportVoxel.y,
    site.supportVoxel.z
  ).addScaledVector(site.up, COLLIDER_HALF_EXTENT).add(tangent);
}

describe('ship landing ray validation', () => {
  it('accepts a contact on the validated procedural voxel face', () => {
    const site = siteFor('top', { x: 3, y: 25, z: -4 }, new THREE.Vector3(0, 1, 0));
    const nearCorner = terrainFacePoint(site, new THREE.Vector3(0.98, 0, -0.98));

    expect(landingHitMatchesValidatedTerrain(
      nearCorner,
      new THREE.Vector3(0, 1, 0),
      site
    )).toBe(true);
  });

  it('rejects an elevated prop hit even when the terrain beneath is a valid pad', () => {
    const site = siteFor('top', { x: 3, y: 25, z: -4 }, new THREE.Vector3(0, 1, 0));
    const structureTop = terrainFacePoint(site).addScaledVector(site.up, 0.2);

    expect(landingHitMatchesValidatedTerrain(
      structureTop,
      new THREE.Vector3(0, 1, 0),
      site
    )).toBe(false);
  });

  it('rejects a tree or wall side normal above valid underlying terrain', () => {
    const site = siteFor('top', { x: 3, y: 25, z: -4 }, new THREE.Vector3(0, 1, 0));

    expect(landingHitMatchesValidatedTerrain(
      terrainFacePoint(site),
      new THREE.Vector3(1, 0, 0),
      site
    )).toBe(false);
  });

  it('rejects a coplanar hit outside the selected voxel face', () => {
    const site = siteFor('right', { x: 25, y: 2, z: -4 }, new THREE.Vector3(1, 0, 0));
    const neighbouringPanel = terrainFacePoint(site, new THREE.Vector3(0, 1.2, 0));

    expect(landingHitMatchesValidatedTerrain(
      neighbouringPanel,
      new THREE.Vector3(1, 0, 0),
      site
    )).toBe(false);
  });
});
