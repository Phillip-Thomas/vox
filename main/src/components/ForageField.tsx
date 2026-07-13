import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { voxelSystem } from '../utils/efficientVoxelSystem';
import { voxelCoordToWorld } from '../utils/cubeGravityConstants';
import { deterministicTangentForUp, dominantFaceForPosition, FACE_NORMALS } from '../utils/surfaceControls';
import { seededVoxelUnit } from '../utils/seededHash';
import { isDecoratableGrassVoxel } from '../utils/grassField';
import { buildGrassProfile } from '../utils/grassProfile';
import {
  FORAGE_HASH_SALT,
  FORAGE_MAX_DENSITY,
  getForagePickupVersion,
  isDeadwoodNode,
  isForageCollected,
  resetForagePickup
} from '../game/systems/foragePickup';
import type { ForageKind } from '../game/systems/foragePickup.ts';
import type { CommandContext } from '../game/commands.ts';
import { collectForageCommand } from '../game/gameplayCommands.ts';
import { dispatchGameplayCommand } from '../game/commandDispatchAdapter.ts';
import { restoreForageForWorld } from '../game/systems/persistence';
import type { WorldIdentity } from '../game/worldIdentity.ts';
import { playSfx } from '../audio/sfxEngine.ts';

// Edible plants — the FOOD bootstrap. Biome-gated (lush planets feed you, arid ones
// starve you), unlike loose stones (fixed). Proximity pickup like stones.
const FORAGE_TYPE_SALT = 34;  // berry vs root
const FORAGE_BASE = 0.04;     // × biome densityMul → ~1 in 25 (lush) .. 1 in 70 (arid)
const FORAGE_MAX_DIST = 55;
const PICKUP_RADIUS = 3.2;
const SURFACE_OFFSET = 0.55;  // bush base rests just above the voxel face
const HEADROOM = 32;

interface ForageFieldProps {
  commandContext: CommandContext;
  terrainSeed: number;
  persistenceWorld?: WorldIdentity;
  playerPosition?: THREE.Vector3;
  /** Story chapters keep their authored tree economy; sandbox/completed-site play gets deadwood. */
  allowDeadwood?: boolean;
}

const _world = new THREE.Vector3();
const _up = new THREE.Vector3();
const _tangent = new THREE.Vector3();
const _bitangent = new THREE.Vector3();
const _basis = new THREE.Matrix4();
const _yaw = new THREE.Matrix4();
const _scaleM = new THREE.Matrix4();
const _translate = new THREE.Matrix4();
const _m = new THREE.Matrix4();

function paint(geo: THREE.BufferGeometry, hex: number): THREE.BufferGeometry {
  const c = new THREE.Color(hex); // ColorManagement → already linear; store raw (vertex colors are linear)
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

// A small leafy bush with a few red berries (baked vertex colours), so it reads as
// "edible plant" at a glance.
function buildForageGeometry(): THREE.BufferGeometry {
  const leaves = new THREE.IcosahedronGeometry(0.5, 0);
  leaves.scale(1, 0.7, 1);
  const parts: THREE.BufferGeometry[] = [paint(leaves, 0x4a7c3a)];
  const berryPos: Array<[number, number, number]> = [[0.25, 0.32, 0.1], [-0.2, 0.36, -0.15], [0.04, 0.46, 0.22]];
  for (const p of berryPos) {
    parts.push(paint(new THREE.IcosahedronGeometry(0.13, 0).translate(p[0], p[1], p[2]), 0xb43c4a));
  }
  return mergeGeometries(parts)!;
}

/** Tiny fallen branches: a resource marker, not decorative vegetation. */
function buildDeadwoodGeometry(): THREE.BufferGeometry {
  const parts = [
    paint(new THREE.BoxGeometry(1.25, 0.16, 0.18).rotateY(0.18).translate(0, 0.12, 0), 0x704726),
    paint(new THREE.BoxGeometry(0.72, 0.12, 0.14).rotateY(-0.72).translate(0.18, 0.19, 0.12), 0x8a5a2c),
    paint(new THREE.BoxGeometry(0.48, 0.1, 0.12).rotateY(0.9).translate(-0.22, 0.2, -0.1), 0x5d381f)
  ];
  return mergeGeometries(parts)!;
}

function isRootNode(x: number, y: number, z: number, seed: number): boolean {
  return seededVoxelUnit(x, y, z, FORAGE_TYPE_SALT, seed) < 0.3;
}

function isForageVoxel(x: number, y: number, z: number, seed: number, density: number): boolean {
  return seededVoxelUnit(x, y, z, FORAGE_HASH_SALT, seed) < density && !isForageCollected(x, y, z);
}

function isDeadwoodVoxel(
  x: number,
  y: number,
  z: number,
  seed: number,
  foodHere: boolean,
  allowDeadwood: boolean
): boolean {
  return allowDeadwood && !foodHere && isDeadwoodNode(x, y, z, seed) && !isForageCollected(x, y, z);
}

/**
 * Nearest uncollected forage node (world position), computed from the same
 * deterministic predicate the field renders with. Used by the story autopilot
 * (movie mode) to seek the first meal honestly — throttle calls, it scans.
 */
export function nearestForageNodeWorld(
  from: THREE.Vector3,
  terrainSeed: number,
  maxDist = 60
): THREE.Vector3 | null {
  const profileDensity = FORAGE_BASE * buildGrassProfile(terrainSeed).densityMul;
  const density = Number.isFinite(profileDensity) && profileDensity > 0 ? profileDensity : FORAGE_BASE;
  let best: THREE.Vector3 | null = null;
  let bestSq = maxDist * maxDist;
  for (const voxel of voxelSystem.getAllVoxels().values()) {
    if (!isDecoratableGrassVoxel(voxel)) continue;
    const [x, y, z] = voxel.position;
    if (!isForageVoxel(x, y, z, terrainSeed, density)) continue;
    const world = voxelCoordToWorld(x, y, z);
    const dSq = world.distanceToSquared(from);
    if (dSq < bestSq) {
      bestSq = dSq;
      best = world;
    }
  }
  return best;
}

/** Scattered edible plants, collected by proximity (walk near → +berries/root). */
export default function ForageField({
  commandContext,
  terrainSeed,
  persistenceWorld,
  playerPosition,
  allowDeadwood = true
}: ForageFieldProps) {
  const geometry = useMemo(() => buildForageGeometry(), []);
  const deadwoodGeometry = useMemo(() => buildDeadwoodGeometry(), []);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 }), []);
  const density = useMemo(() => {
    const d = FORAGE_BASE * buildGrassProfile(terrainSeed).densityMul;
    return Number.isFinite(d) && d > 0 ? Math.min(FORAGE_MAX_DENSITY, d) : FORAGE_BASE; // guard a malformed profile
  }, [terrainSeed]);
  const foodMeshRef = useRef<THREE.InstancedMesh>(null);
  const deadwoodMeshRef = useRef<THREE.InstancedMesh>(null);
  const [capacity, setCapacity] = useState(0);
  const signatureRef = useRef('');
  const lastBucketPos = useRef(new THREE.Vector3(Infinity, Infinity, Infinity));
  const nearNodes = useRef<Array<{ x: number; y: number; z: number; w: THREE.Vector3; kind: ForageKind }>>([]);

  const growCapacity = (needed: number) => {
    setCapacity(prev => (needed <= prev ? prev : Math.ceil(needed * 1.25) + HEADROOM));
  };

  const countNodes = () => {
    let n = 0;
    const maxSq = FORAGE_MAX_DIST * FORAGE_MAX_DIST;
    for (const voxel of voxelSystem.getAllVoxels().values()) {
      if (!isDecoratableGrassVoxel(voxel)) continue;
      const [x, y, z] = voxel.position;
      const foodHere = isForageVoxel(x, y, z, terrainSeed, density);
      if (!foodHere && !isDeadwoodVoxel(x, y, z, terrainSeed, foodHere, allowDeadwood)) continue;
      if (playerPosition) {
        voxelCoordToWorld(x, y, z, _world);
        if (_world.distanceToSquared(playerPosition) > maxSq) continue;
      }
      n++;
    }
    return n;
  };

  const rebuild = () => {
    const foodMesh = foodMeshRef.current;
    const deadwoodMesh = deadwoodMeshRef.current;
    if (!foodMesh || !deadwoodMesh) return;
    const cap = foodMesh.instanceMatrix.count;
    const maxSq = FORAGE_MAX_DIST * FORAGE_MAX_DIST;
    const near: Array<{ x: number; y: number; z: number; w: THREE.Vector3; kind: ForageKind }> = [];

    let foodSlot = 0;
    let deadwoodSlot = 0;
    for (const voxel of voxelSystem.getAllVoxels().values()) {
      if (!isDecoratableGrassVoxel(voxel)) continue;
      const [x, y, z] = voxel.position;
      const foodHere = isForageVoxel(x, y, z, terrainSeed, density);
      const deadwoodHere = isDeadwoodVoxel(x, y, z, terrainSeed, foodHere, allowDeadwood);
      if (!foodHere && !deadwoodHere) continue;

      voxelCoordToWorld(x, y, z, _world);
      if (playerPosition && _world.distanceToSquared(playerPosition) > maxSq) continue;

      _up.copy(FACE_NORMALS[dominantFaceForPosition(_world)]);
      deterministicTangentForUp(_up, _tangent);
      _bitangent.crossVectors(_tangent, _up).normalize(); // right-handed (det +1)
      _basis.makeBasis(_tangent, _up, _bitangent);
      _yaw.makeRotationY(seededVoxelUnit(x, y, z, 13, terrainSeed) * Math.PI * 2);
      const s = 0.7 + seededVoxelUnit(x, y, z, 29, terrainSeed) * 0.5;
      _scaleM.makeScale(s, s, s);
      _translate.makeTranslation(
        _world.x + _up.x * SURFACE_OFFSET,
        _world.y + _up.y * SURFACE_OFFSET,
        _world.z + _up.z * SURFACE_OFFSET
      );
      _m.copy(_translate).multiply(_basis).multiply(_yaw).multiply(_scaleM);
      const kind: ForageKind = deadwoodHere
        ? 'deadwood'
        : isRootNode(x, y, z, terrainSeed) ? 'root' : 'berry';
      if (kind === 'deadwood') {
        if (deadwoodSlot >= cap) continue;
        deadwoodMesh.setMatrixAt(deadwoodSlot++, _m);
      } else {
        if (foodSlot >= cap) continue;
        foodMesh.setMatrixAt(foodSlot++, _m);
      }
      near.push({ x, y, z, w: _world.clone().addScaledVector(_up, 1.0), kind });
    }

    foodMesh.count = foodSlot;
    foodMesh.instanceMatrix.needsUpdate = true;
    deadwoodMesh.count = deadwoodSlot;
    deadwoodMesh.instanceMatrix.needsUpdate = true;
    nearNodes.current = near;
  };

  useEffect(() => { growCapacity(countNodes()); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  useEffect(() => {
    if (capacity <= 0) return;
    rebuild();
    signatureRef.current = `${voxelSystem.getWorldId()}:${terrainSeed}:${allowDeadwood}:${voxelSystem.getEditVersion()}:${getForagePickupVersion()}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capacity]);

  // World-relative — clear, then load this world's already-collected forage.
  useEffect(() => {
    resetForagePickup();
    restoreForageForWorld(persistenceWorld ?? terrainSeed);
  }, [persistenceWorld, terrainSeed]);

  // Dispose GPU resources on unmount only (geometry/material are stable useMemos, so
  // this must NOT fire on a mere terrainSeed change).
  useEffect(() => () => {
    geometry.dispose();
    deadwoodGeometry.dispose();
    material.dispose();
  }, [deadwoodGeometry, geometry, material]);

  useFrame(() => {
    if (playerPosition) {
      const rSq = PICKUP_RADIUS * PICKUP_RADIUS;
      for (const node of nearNodes.current) {
        if (node.kind === 'deadwood' && !allowDeadwood) continue;
        if (isForageCollected(node.x, node.y, node.z)) continue;
        if (node.w.distanceToSquared(playerPosition) <= rSq) {
          const result = dispatchGameplayCommand(() => collectForageCommand(commandContext, {
            x: node.x,
            y: node.y,
            z: node.z,
            kind: node.kind
          }));
          if (result.ok) {
            playSfx('mine'); // a soft confirmation
          }
        }
      }
    }

    const sig = `${voxelSystem.getWorldId()}:${terrainSeed}:${allowDeadwood}:${voxelSystem.getEditVersion()}:${getForagePickupVersion()}`;
    if (sig !== signatureRef.current) {
      const needed = countNodes();
      if (needed > capacity) growCapacity(needed);
      else { signatureRef.current = sig; rebuild(); if (playerPosition) lastBucketPos.current.copy(playerPosition); }
    } else if (playerPosition && lastBucketPos.current.distanceToSquared(playerPosition) > 100) {
      lastBucketPos.current.copy(playerPosition);
      rebuild();
    }
  });

  if (capacity <= 0) return null;
  return (
    <>
      <instancedMesh
        ref={foodMeshRef}
        args={[geometry, material, capacity]}
        frustumCulled={false}
        castShadow={false}
        receiveShadow={false}
      />
      <instancedMesh
        ref={deadwoodMeshRef}
        args={[deadwoodGeometry, material, capacity]}
        frustumCulled={false}
        castShadow={false}
        receiveShadow={false}
      />
    </>
  );
}
