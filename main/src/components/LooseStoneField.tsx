import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { voxelSystem } from '../utils/efficientVoxelSystem';
import { voxelCoordToWorld } from '../utils/cubeGravityConstants';
import { deterministicTangentForUp, dominantFaceForPosition, FACE_NORMALS } from '../utils/surfaceControls';
import { seededVoxelUnit } from '../utils/seededHash';
import { isDecoratableGrassVoxel } from '../utils/grassField';
import {
  collectStone, getStonePickupVersion, isStoneCollected, resetStonePickup
} from '../game/systems/stonePickup';
import { buildStoneGeometry, createStoneMaterial } from '../utils/looseStone';
import { playSfx } from '../audio/sfxEngine.ts';

// Loose stones are a GAMEPLAY necessity (the bootstrap for stone), so unlike trees
// they do NOT depend on the graphics tree/grass density — a fixed scatter that
// renders regardless of quality profile.
const STONE_SALT = 31;          // distinct hash channel from trees (7) / yaw (11)
const STONE_DENSITY = 0.05;     // ~1 in 20 surface voxels carries a loose stone
const STONE_MAX_DIST = 55;      // only render/scan stones within this radius
// Walk this close (to the rock's GROUND position) to auto-collect. Generous so it
// triggers reliably as you pass over — the player's center sits ~1u above ground.
const PICKUP_RADIUS = 3.2;
// The voxel face is one half-extent (VOXEL_SCALE/2 = 1) out from the center, so a
// rock must sit ABOVE that to rest on the ground rather than buried inside it
// (slightly embedded reads natural).
const SURFACE_OFFSET = 1.25;
const HEADROOM = 32;

interface LooseStoneFieldProps {
  terrainSeed: number;
  playerPosition?: THREE.Vector3;
}

/** Module handle for harvest picking: the instanced rock mesh + a slot→voxel map
 *  (a raycast hit's instanceId → the stone's coord), mirroring treeFieldHandle. */
export const looseStoneHandle: {
  mesh: THREE.InstancedMesh | null;
  slotVoxel: Array<[number, number, number]>;
} = { mesh: null, slotVoxel: [] };

const _world = new THREE.Vector3();
const _up = new THREE.Vector3();
const _tangent = new THREE.Vector3();
const _bitangent = new THREE.Vector3();
const _basis = new THREE.Matrix4();
const _yaw = new THREE.Matrix4();
const _scaleM = new THREE.Matrix4();
const _translate = new THREE.Matrix4();
const _m = new THREE.Matrix4();

function isStoneVoxel(x: number, y: number, z: number, terrainSeed: number): boolean {
  return seededVoxelUnit(x, y, z, STONE_SALT, terrainSeed) < STONE_DENSITY && !isStoneCollected(x, y, z);
}

function countStones(terrainSeed: number, playerPosition?: THREE.Vector3): number {
  let n = 0;
  const maxSq = STONE_MAX_DIST * STONE_MAX_DIST;
  for (const voxel of voxelSystem.getAllVoxels().values()) {
    if (!isDecoratableGrassVoxel(voxel)) continue;
    const [x, y, z] = voxel.position;
    if (!isStoneVoxel(x, y, z, terrainSeed)) continue;
    if (playerPosition) {
      voxelCoordToWorld(x, y, z, _world);
      if (_world.distanceToSquared(playerPosition) > maxSq) continue;
    }
    n++;
  }
  return n;
}

/**
 * Small stones scattered on the ground, collected by proximity (walk near → +stone).
 * Deterministic placement on surface voxels (hash-selected, fixed density), drawn as
 * one InstancedMesh of low-poly pebbles oriented to the cube-face normal. Collected
 * coords live in stonePickup; this skips them and rebuilds (via the pickup version in
 * its signature) so a picked-up stone disappears. Capacity grows like GrassField/
 * TreeField because voxels stream in after mount.
 */
export default function LooseStoneField({ terrainSeed, playerPosition }: LooseStoneFieldProps) {
  // Irregular boulder (~0.55 base radius; voxels are VOXEL_SCALE=2 wide) + a
  // procedural stone material, so rocks read as natural stone, not flat gems.
  const geometry = useMemo(() => buildStoneGeometry(), []);
  const material = useMemo(() => createStoneMaterial(), []);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const [capacity, setCapacity] = useState(0);
  const signatureRef = useRef('');
  const lastBucketPos = useRef(new THREE.Vector3(Infinity, Infinity, Infinity));
  // Near stones (coord + world pos) for the per-frame proximity pickup scan.
  const nearStones = useRef<Array<{ x: number; y: number; z: number; w: THREE.Vector3 }>>([]);

  const growCapacity = (needed: number) => {
    setCapacity(prev => (needed <= prev ? prev : Math.ceil(needed * 1.25) + HEADROOM));
  };

  const rebuild = () => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const cap = mesh.instanceMatrix.count;
    const maxSq = STONE_MAX_DIST * STONE_MAX_DIST;
    const near: Array<{ x: number; y: number; z: number; w: THREE.Vector3 }> = [];

    let slot = 0;
    for (const voxel of voxelSystem.getAllVoxels().values()) {
      if (slot >= cap) break;
      if (!isDecoratableGrassVoxel(voxel)) continue;
      const [x, y, z] = voxel.position;
      if (!isStoneVoxel(x, y, z, terrainSeed)) continue;

      voxelCoordToWorld(x, y, z, _world);
      if (playerPosition && _world.distanceToSquared(playerPosition) > maxSq) continue;

      _up.copy(FACE_NORMALS[dominantFaceForPosition(_world)]);
      deterministicTangentForUp(_up, _tangent);
      // bitangent = tangent × up makes makeBasis(tangent, up, bitangent) RIGHT-handed
      // (det +1). The reverse (up × tangent) is left-handed → it mirrors each
      // instance, flipping triangle winding so you'd see the rock's inside faces.
      _bitangent.crossVectors(_tangent, _up).normalize();
      _basis.makeBasis(_tangent, _up, _bitangent);
      _yaw.makeRotationY(seededVoxelUnit(x, y, z, 13, terrainSeed) * Math.PI * 2);
      const s = 0.7 + seededVoxelUnit(x, y, z, 29, terrainSeed) * 0.6; // 0.7 .. 1.3
      _scaleM.makeScale(s, s * 0.7, s); // squashed pebble
      _translate.makeTranslation(
        _world.x + _up.x * SURFACE_OFFSET,
        _world.y + _up.y * SURFACE_OFFSET,
        _world.z + _up.z * SURFACE_OFFSET
      );
      _m.copy(_translate).multiply(_basis).multiply(_yaw).multiply(_scaleM);
      mesh.setMatrixAt(slot, _m);
      looseStoneHandle.slotVoxel[slot] = [x, y, z];
      // Pickup position = the rock's GROUND point (voxel center + one half-extent
      // out), which is near the player's feet — far closer than the voxel center,
      // so the proximity radius actually catches it.
      near.push({ x, y, z, w: _world.clone().addScaledVector(_up, 1.0) });
      slot++;
    }

    mesh.count = slot;
    mesh.instanceMatrix.needsUpdate = true;
    nearStones.current = near;
    looseStoneHandle.mesh = mesh;
    looseStoneHandle.slotVoxel.length = slot;
  };

  const neededCapacity = () => countStones(terrainSeed, playerPosition);

  useEffect(() => { growCapacity(neededCapacity()); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  useEffect(() => {
    if (capacity <= 0) return;
    rebuild();
    signatureRef.current = `${voxelSystem.getWorldId()}:${terrainSeed}:${voxelSystem.getEditVersion()}:${getStonePickupVersion()}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capacity]);

  // Reset collected state on world swap (coords are world-relative).
  useEffect(() => { resetStonePickup(); }, [terrainSeed]);

  // Dispose GPU resources on unmount only (geometry/material are stable useMemos,
  // so this cleanup must NOT fire on a mere terrainSeed change). Clear the handle.
  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
    looseStoneHandle.mesh = null;
    looseStoneHandle.slotVoxel.length = 0;
  }, [geometry, material]);

  useFrame(() => {
    // Proximity pickup: collect any near stone the player is standing close to.
    if (playerPosition) {
      const rSq = PICKUP_RADIUS * PICKUP_RADIUS;
      for (const s of nearStones.current) {
        if (isStoneCollected(s.x, s.y, s.z)) continue;
        if (s.w.distanceToSquared(playerPosition) <= rSq) {
          collectStone(s.x, s.y, s.z);
          playSfx('mine'); // a short chip as confirmation the stone was gathered
        }
      }
    }

    // Rebuild when the world/edits/pickups change, or the player moved enough to
    // re-bucket which stones are within render/scan range.
    const sig = `${voxelSystem.getWorldId()}:${terrainSeed}:${voxelSystem.getEditVersion()}:${getStonePickupVersion()}`;
    if (sig !== signatureRef.current) {
      const needed = neededCapacity();
      if (needed > capacity) growCapacity(needed);
      else { signatureRef.current = sig; rebuild(); if (playerPosition) lastBucketPos.current.copy(playerPosition); }
    } else if (playerPosition && lastBucketPos.current.distanceToSquared(playerPosition) > 100) {
      lastBucketPos.current.copy(playerPosition);
      rebuild();
    }
  });

  if (capacity <= 0) return null;
  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, capacity]}
      frustumCulled={false}
      castShadow={false}
      receiveShadow={false}
    />
  );
}
