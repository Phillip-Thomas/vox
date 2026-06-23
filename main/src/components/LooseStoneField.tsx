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

// Loose stones are a GAMEPLAY necessity (the bootstrap for stone), so unlike trees
// they do NOT depend on the graphics tree/grass density — a fixed scatter that
// renders regardless of quality profile.
const STONE_SALT = 31;          // distinct hash channel from trees (7) / yaw (11)
const STONE_DENSITY = 0.05;     // ~1 in 20 surface voxels carries a loose stone
const STONE_MAX_DIST = 55;      // only render/scan stones within this radius
const PICKUP_RADIUS = 2.4;      // walk this close to auto-collect
// The voxel face is one half-extent (VOXEL_SCALE/2 = 1) out from the center, so a
// rock must sit ABOVE that to rest on the ground rather than buried inside it
// (slightly embedded reads natural).
const SURFACE_OFFSET = 1.25;
const HEADROOM = 32;

interface LooseStoneFieldProps {
  terrainSeed: number;
  playerPosition?: THREE.Vector3;
}

const STONE_COLOR = new THREE.Color(0x7e8389);

/**
 * One irregular boulder shape, shared by every instance. A subdivided icosphere
 * whose vertices are pushed in/out by a few deterministic sines → a lumpy rock, not
 * a regular gem. Per-instance rotation/scale + the world-space surface noise in the
 * material make the repeated shape read as variety. Flat-shaded for chiselled facets
 * that suit the voxel world.
 */
function buildStoneGeometry(): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(0.55, 2);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const d = v.clone().normalize();
    const lump =
      1
      + 0.20 * Math.sin(d.x * 3.1 + d.y * 2.3 + 0.7)
      + 0.16 * Math.sin(d.y * 4.7 + d.z * 1.9 + 2.1)
      + 0.12 * Math.cos(d.z * 5.3 + d.x * 2.1 + 4.0)
      - 0.08 * Math.sin((d.x + d.y + d.z) * 7.0);
    v.multiplyScalar(lump);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

/**
 * Procedural stone material — MeshStandardMaterial + onBeforeCompile so it keeps
 * Three's PBR/lighting/fog and injects 3D value-noise mottling, darkened cavities,
 * and per-instance value variation onto the stone palette. (Flat grey would fail the
 * project's material-quality bar.) Models the bark/voxel approach in treeMaterials.
 */
function createStoneMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff, // the procedural tint below IS the albedo
    roughness: 0.95,
    metalness: 0.0,
    flatShading: true
  });
  material.onBeforeCompile = shader => {
    shader.uniforms.uStoneColor = { value: STONE_COLOR.clone() };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        varying vec3 vStonePos;
        varying float vStoneTint;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vStonePos = transformed;
        #ifdef USE_INSTANCING
          vStoneTint = fract(sin(dot(instanceMatrix[3].xyz, vec3(12.99, 78.23, 37.71))) * 43758.5453);
        #else
          vStoneTint = 0.5;
        #endif`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec3 uStoneColor;
        varying vec3 vStonePos;
        varying float vStoneTint;
        float stHash(vec3 p){ return fract(sin(dot(p, vec3(12.989, 78.233, 37.719))) * 43758.5453); }
        float stNoise(vec3 p){
          vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(mix(stHash(i + vec3(0.,0.,0.)), stHash(i + vec3(1.,0.,0.)), f.x),
                mix(stHash(i + vec3(0.,1.,0.)), stHash(i + vec3(1.,1.,0.)), f.x), f.y),
            mix(mix(stHash(i + vec3(0.,0.,1.)), stHash(i + vec3(1.,0.,1.)), f.x),
                mix(stHash(i + vec3(0.,1.,1.)), stHash(i + vec3(1.,1.,1.)), f.x), f.y), f.z);
        }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        float stCoarse = stNoise(vStonePos * 7.0);
        float stFine   = stNoise(vStonePos * 22.0 + 11.0);
        vec3 stone = uStoneColor;
        stone *= mix(0.80, 1.18, vStoneTint);          // per-rock value variation
        stone *= 0.74 + 0.42 * stCoarse;               // broad mottling
        stone *= 0.90 + 0.18 * stFine;                 // fine grain
        stone *= 0.78 + 0.22 * smoothstep(0.15, 0.65, stCoarse); // darken cavities
        diffuseColor.rgb *= stone;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor - 0.12 * stNoise(vStonePos * 9.0), 0.55, 1.0);`);
  };
  material.customProgramCacheKey = () => 'loose-stone-v1';
  return material;
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
      _bitangent.crossVectors(_up, _tangent).normalize();
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
      near.push({ x, y, z, w: _world.clone() });
      slot++;
    }

    mesh.count = slot;
    mesh.instanceMatrix.needsUpdate = true;
    nearStones.current = near;
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
  // so this cleanup must NOT fire on a mere terrainSeed change).
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);

  useFrame(() => {
    // Proximity pickup: collect any near stone the player is standing close to.
    if (playerPosition) {
      const rSq = PICKUP_RADIUS * PICKUP_RADIUS;
      for (const s of nearStones.current) {
        if (isStoneCollected(s.x, s.y, s.z)) continue;
        if (s.w.distanceToSquared(playerPosition) <= rSq) collectStone(s.x, s.y, s.z);
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
