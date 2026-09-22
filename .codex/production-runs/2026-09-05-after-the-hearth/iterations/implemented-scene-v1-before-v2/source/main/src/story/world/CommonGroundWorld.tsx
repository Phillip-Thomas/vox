import { precompile } from '../../components/effects/shaderWarmup.ts';
import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { voxelSystem } from '../../utils/efficientVoxelSystem.ts';
import { VOXEL_SCALE } from '../../utils/cubeGravityConstants.ts';
import { createLiveAgentSurfaceTerrain } from '../../utils/agentSurfaceNavigationRuntime.ts';
import { heroTreeHandle } from './HeroAppleTree.tsx';
import {
  CG_APPARATUS_SOLIDS,
  type CommonGroundAabb,
  type CommonGroundFooting
} from '../commonGroundRoute.ts';
import {
  MAX_TRACE_POINTS,
  readCommonGroundLive,
  type CommonGroundPoint
} from '../commonGroundState.ts';
import { registerCommonGroundWorld } from '../commonGroundDirector.ts';
import { restoreCommonGroundForWorld } from '../../game/systems/persistence.ts';

// --- The survey apparatus and the drawn trace ----------------------------------------
//
// The apparatus is four boxes and the trace is up to 512 pooled glyphs, and both
// are single instanced meshes sharing one material each. That is the INTENDED
// shape against the accepted +8 draw / +6 material / +6 program / +2 MiB budget;
// it is a design claim, not a measurement, and no render or resource budget is
// claimed as verified here — an independent capture owns that.
//
// NO NEW LIGHT. Light cardinality is fixed at the shipped count; the instrument
// reads by its own silhouette against the ground, which is also why it must be
// legible at POTATO with no effect at all.
//
// Everything is allocated and precompiled at MOUNT, before any critical verb:
// the ±2 second window around the offer, the start, the span offer, the hold,
// the revision and the completion must contain zero first-use of a program or a
// resource, and there are no frame-loop allocations below.

/** The body's grounded clearance above its support surface, as qualified. */
const GROUND_CLEARANCE = 1.05;
/** Pooled trace glyphs: two route slots of at most 128 points each, ×2 spare. */
const TRACE_GLYPH_POOL = 512;

const APPARATUS_COLOR = '#8d9a95';
const APPARATUS_DARK = '#55605d';
/** The trace reads as her own line: the shipped ember, not a new accent. */
const TRACE_COLOR = '#ff5a3c';

function cell(value: number): number {
  return Math.round(value / VOXEL_SCALE);
}

/**
 * Live footing over the actual voxel world.
 *
 * The support column is the cell whose top face the body stands on
 * (`y - 1.05`), the cell above it must be empty, and neither may be water. The
 * body disc is sampled at its centre and at four lateral offsets, so a foot
 * half over a hole is not "supported" merely because its centre is.
 */
function createFooting(planetSize: number, terrainSeed: number, worldId: string): CommonGroundFooting {
  const terrain = createLiveAgentSurfaceTerrain(planetSize, terrainSeed, worldId);
  const supportedColumn = (x: number, y: number, z: number): boolean => {
    const cx = cell(x);
    const cz = cell(z);
    const cy = cell(y - GROUND_CLEARANCE);
    if (!terrain.isSolidVoxel(cx, cy, cz)) return false;
    if (terrain.isSolidVoxel(cx, cy + 1, cz)) return false;
    if (terrain.isWaterVoxel(cx, cy, cz) || terrain.isWaterVoxel(cx, cy + 1, cz)) return false;
    if (terrain.isHazardousVoxel?.(cx, cy, cz)) return false;
    return true;
  };
  return {
    // LIVE, NOT CAPTURED. `createLiveAgentSurfaceTerrain` builds its revision
    // string once, so copying it would pin the value at mount and every later
    // edit would look like no edit at all. The predicates below already read the
    // voxel system live; this makes the invalidation token agree with them.
    get revision(): string {
      return `${voxelSystem.getWorldId()}:${voxelSystem.getEditVersion()}`;
    },
    isSupported: (point: CommonGroundPoint) => supportedColumn(point.x, point.y, point.z)
      && supportedColumn(point.x + 0.5, point.y, point.z)
      && supportedColumn(point.x - 0.5, point.y, point.z)
      && supportedColumn(point.x, point.y, point.z + 0.5)
      && supportedColumn(point.x, point.y, point.z - 0.5)
  };
}

/** The hero tree's EXISTING trunk collider, included in the route guard. */
function trunkSolid(): CommonGroundAabb | null {
  const position = heroTreeHandle.position;
  if (!position) return null;
  const height = Math.max(1, heroTreeHandle.height ?? 7.2);
  return {
    name: 'hero-tree-trunk',
    lo: { x: position.x - 0.55, y: position.y, z: position.z - 0.55 },
    hi: { x: position.x + 0.55, y: position.y + height, z: position.z + 0.55 }
  };
}

const _matrix = new THREE.Matrix4();
const _position = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();
const _scale = new THREE.Vector3();

const CommonGroundWorld: React.FC<{
  planetSize: number;
  terrainSeed: number;
  worldId: string;
  /** True only while a ch13 beat owns the frame; the sandbox never mounts this. */
  active: boolean;
}> = ({ planetSize, terrainSeed, worldId, active }) => {
  const groupRef = useRef<THREE.Group>(null);
  const apparatusRef = useRef<THREE.InstancedMesh>(null);
  const traceRef = useRef<THREE.InstancedMesh>(null);

  const materials = useMemo(() => ({
    housing: new THREE.MeshStandardMaterial({ color: APPARATUS_COLOR, roughness: 0.8, metalness: 0.1 }),
    trace: new THREE.MeshStandardMaterial({
      color: TRACE_COLOR,
      roughness: 0.9,
      emissive: new THREE.Color(TRACE_COLOR),
      emissiveIntensity: 0.35
    })
  }), []);
  useEffect(() => () => {
    materials.housing.dispose();
    materials.trace.dispose();
  }, [materials]);

  // The apparatus never moves, so its instance matrices are written once, at
  // mount, and the buffer is then static for the whole chapter.
  useEffect(() => {
    const mesh = apparatusRef.current;
    if (!mesh) return;
    CG_APPARATUS_SOLIDS.forEach((box, index) => {
      _position.set((box.lo.x + box.hi.x) / 2, (box.lo.y + box.hi.y) / 2, (box.lo.z + box.hi.z) / 2);
      _scale.set(box.hi.x - box.lo.x, box.hi.y - box.lo.y, box.hi.z - box.lo.z);
      _quaternion.identity();
      mesh.setMatrixAt(index, _matrix.compose(_position, _quaternion, _scale));
    });
    mesh.count = CG_APPARATUS_SOLIDS.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
  }, []);

  // PREWARM. Compile both programs and upload both buffers at mount, so the
  // first offered span cannot be the frame that compiles a shader.
  useEffect(() => {
    const root = groupRef.current;
    if (root) return precompile(root);
  }, []);

  // This world's saved chapter state, staged for the director to validate. The
  // same reset-then-load shape every other per-world field uses.
  useEffect(() => {
    if (!worldId) return;
    restoreCommonGroundForWorld({ worldId, seed: terrainSeed });
  }, [terrainSeed, worldId]);

  useEffect(() => {
    // READINESS GATES THE QUERIES. Binding before this world's voxels are the
    // resident ones would answer route questions about somebody else's ground.
    if (!active || !worldId) return;
    const footing = createFooting(planetSize, terrainSeed, worldId);
    const trunk = trunkSolid();
    return registerCommonGroundWorld({
      worldId,
      footing,
      extraSolids: trunk ? [trunk] : []
    });
  }, [active, planetSize, terrainSeed, worldId]);

  useFrame(() => {
    const mesh = traceRef.current;
    if (!mesh) return;
    const snapshot = active ? readCommonGroundLive(worldId) : null;
    // The proposal being drawn, or the accepted route once one is retained.
    const samples = (snapshot?.survey.working ?? snapshot?.survey.accepted)?.samples ?? null;
    if (!samples || samples.length === 0) {
      if (mesh.count !== 0) {
        mesh.count = 0;
        mesh.instanceMatrix.needsUpdate = true;
      }
      return;
    }
    // Bounded by construction: the slot itself cannot exceed the sample cap, and
    // the pool holds two such slots twice over. Capacity stops honestly upstream;
    // nothing is decimated to fit here either.
    const count = Math.min(samples.length, MAX_TRACE_POINTS, TRACE_GLYPH_POOL);
    for (let index = 0; index < count; index += 1) {
      const sample = samples[index];
      _position.set(sample.x, sample.y + 0.06, sample.z);
      _quaternion.identity();
      // A corner reads slightly larger: the trace records where she turned, and
      // that is a fact about the argument rather than decoration.
      const size = sample.corner ? 0.34 : 0.22;
      _scale.set(size, 0.06, size);
      mesh.setMatrixAt(index, _matrix.compose(_position, _quaternion, _scale));
    }
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
  });

  return (
    <group ref={groupRef}>
      {/*
        REAL COLLIDERS, not just a walk-mask entry. The route guard stops the
        chapter from PLANNING through the housing; it cannot stop the player's
        live body walking through a thing they can see. The same literal AABBs
        are registered as fixed colliders, the way the hero tree's trunk already
        is: the instrument is real, and you cannot walk through the argument.
      */}
      {active && (
        <RigidBody type="fixed" colliders={false}>
          {CG_APPARATUS_SOLIDS.map(box => (
            <CuboidCollider
              key={box.name}
              args={[
                (box.hi.x - box.lo.x) / 2,
                (box.hi.y - box.lo.y) / 2,
                (box.hi.z - box.lo.z) / 2
              ]}
              position={[
                (box.lo.x + box.hi.x) / 2,
                (box.lo.y + box.hi.y) / 2,
                (box.lo.z + box.hi.z) / 2
              ]}
            />
          ))}
        </RigidBody>
      )}
      <instancedMesh
        ref={apparatusRef}
        args={[undefined, undefined, CG_APPARATUS_SOLIDS.length]}
        material={materials.housing}
        castShadow={false}
        receiveShadow={false}
      >
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
      <instancedMesh
        ref={traceRef}
        args={[undefined, undefined, TRACE_GLYPH_POOL]}
        material={materials.trace}
        castShadow={false}
        receiveShadow={false}
      >
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
    </group>
  );
};

export default CommonGroundWorld;
export { APPARATUS_DARK, createFooting, trunkSolid, TRACE_GLYPH_POOL };