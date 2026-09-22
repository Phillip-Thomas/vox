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
  PLAYER_BODY_HEIGHT,
  TRACE_GLYPH_THICKNESS,
  commonGuideGlyphs,
  commonTestedGlyphs,
  firstUnsupportedSegment,
  traceGlyphs,
  type CommonGroundAabb,
  type CommonGroundFooting,
  type TraceGlyph
} from '../commonGroundRoute.ts';
import {
  CG_ROUTE_COMMON,
  MAX_TRACE_POINTS,
  commonGroundCommonDisplay,
  readCommonGroundLive,
  type CommonGroundDisplayKind,
  type CommonGroundPoint,
  type TraceSlot
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
// SHAPE CARRIES STATE, NOT COLOUR. Every glyph comes out of the same prewarmed
// material, so a proposed sample, a tested sample, a stopped end and the planned
// common guide have to be told apart by their form alone — which is the only way
// they survive a muted, unlit, lowest-tier frame. The one unwalked line in the
// chapter is the common E-to-C guide, and it appears only after W-7744 has
// physically reached H. The S-to-E survey is never previewed.
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
/**
 * Pooled trace glyphs: two recorded routes × 128 samples × at most 2 glyphs.
 *
 * The signed grammar costs two instances per represented sample — one bar for a
 * proposed sample, a parallel pair for a tested one, and a two-piece open stop
 * that REPLACES a pair rather than adding to it — so 2 × 128 × 2 is exactly 512
 * and the ceiling is structural rather than a hope. The common guide and the
 * completed common display share the working route's half of that pool.
 */
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
const _euler = new THREE.Euler();

/**
 * Per-slot allocation ceiling.
 *
 * Two recorded routes of at most 128 samples, at most two glyphs each, is
 * exactly the existing 512 pool. The accepted survey keeps its own half whenever
 * it exists, and the common display SHARES the working half rather than asking
 * for a third allocation: while an optional repeat is being drawn, the working
 * route owns that half and the common display yields it.
 */
const SLOT_GLYPH_ALLOCATION = MAX_TRACE_POINTS * 2;

/**
 * What the pooled mesh is currently showing.
 *
 * Kept as mutable primitives rather than a rebuilt key string so a resting frame
 * does no work and allocates nothing: the layout is recomputed only when a
 * recorded sample, a tested prefix, a real hold, the common display state or the
 * live terrain revision has ACTUALLY changed.
 */
interface TraceDisplayCache {
  accepted: TraceSlot | null;
  acceptedSamples: number;
  acceptedTested: number;
  working: TraceSlot | null;
  workingSamples: number;
  workingTested: number;
  workingRevision: number;
  heldIndex: number;
  display: CommonGroundDisplayKind;
  terrain: string;
  active: boolean;
}

function writeGlyphs(mesh: THREE.InstancedMesh, glyphs: readonly TraceGlyph[], from: number): number {
  let index = from;
  for (const glyph of glyphs) {
    if (index >= mesh.instanceMatrix.count) break;
    _position.set(glyph.x, glyph.y, glyph.z);
    _euler.set(0, -glyph.angle, 0);
    _quaternion.setFromEuler(_euler);
    _scale.set(glyph.lengthUnits, TRACE_GLYPH_THICKNESS, glyph.widthUnits);
    mesh.setMatrixAt(index, _matrix.compose(_position, _quaternion, _scale));
    index += 1;
  }
  return index;
}

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
  // The SAME footing and solids the director's route queries use, so the guide's
  // grounding answer cannot disagree with the walk mask's.
  const footingRef = useRef<CommonGroundFooting | null>(null);
  const solidsRef = useRef<readonly CommonGroundAabb[]>([]);
  const cacheRef = useRef<TraceDisplayCache>({
    accepted: null,
    acceptedSamples: -1,
    acceptedTested: -1,
    working: null,
    workingSamples: -1,
    workingTested: -1,
    workingRevision: -1,
    heldIndex: -2,
    display: 'none',
    terrain: ' ',
    active: false
  });

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
    const extraSolids = trunk ? [trunk] : [];
    footingRef.current = footing;
    solidsRef.current = extraSolids;
    const release = registerCommonGroundWorld({ worldId, footing, extraSolids });
    return () => {
      footingRef.current = null;
      solidsRef.current = [];
      release();
    };
  }, [active, planetSize, terrainSeed, worldId]);

  // PREALLOCATE EVERY GLYPH BEFORE ANY VERB. The pool's whole matrix buffer is
  // written and uploaded once at mount, with the instances parked at zero scale,
  // so the frame that first offers, holds, reveals the guide or completes the
  // comparison only rewrites matrices that already exist. No instance attribute
  // is created, resized or first-used inside a critical window.
  useEffect(() => {
    const mesh = traceRef.current;
    if (!mesh) return;
    _position.set(0, 0, 0);
    _quaternion.identity();
    _scale.set(0, 0, 0);
    _matrix.compose(_position, _quaternion, _scale);
    for (let index = 0; index < TRACE_GLYPH_POOL; index += 1) mesh.setMatrixAt(index, _matrix);
    mesh.count = 0;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
  }, []);

  useFrame(() => {
    const mesh = traceRef.current;
    if (!mesh) return;
    const snapshot = active ? readCommonGroundLive(worldId) : null;
    const survey = snapshot?.survey ?? null;
    const accepted = survey?.accepted ?? null;
    const working = survey?.working ?? null;
    // THE HOLD BELONGS TO THE PROPOSAL BEING TESTED. An accepted route is a route
    // whose test finished; it has no stopped end to draw.
    const heldIndex = survey && survey.hold.reason !== null ? survey.hold.atIndex : -1;
    const display = snapshot ? commonGroundCommonDisplay(snapshot) : 'none';
    const ground = footingRef.current;
    const terrain = ground?.revision ?? '';

    const cache = cacheRef.current;
    if (
      cache.active === active
      && cache.accepted === accepted
      && cache.acceptedSamples === (accepted?.samples.length ?? 0)
      && cache.acceptedTested === (accepted?.testedPrefixCount ?? 0)
      && cache.working === working
      && cache.workingSamples === (working?.samples.length ?? 0)
      && cache.workingTested === (working?.testedPrefixCount ?? 0)
      && cache.workingRevision === (working?.tailRevision ?? 0)
      && cache.heldIndex === heldIndex
      && cache.display === display
      && cache.terrain === terrain
    ) return;
    cache.active = active;
    cache.accepted = accepted;
    cache.acceptedSamples = accepted?.samples.length ?? 0;
    cache.acceptedTested = accepted?.testedPrefixCount ?? 0;
    cache.working = working;
    cache.workingSamples = working?.samples.length ?? 0;
    cache.workingTested = working?.testedPrefixCount ?? 0;
    cache.workingRevision = working?.tailRevision ?? 0;
    cache.heldIndex = heldIndex;
    cache.display = display;
    cache.terrain = terrain;

    let count = 0;
    // THE ACCEPTED SURVEY SURVIVES A NEW PROPOSAL. It is earned evidence, and an
    // optional repeat draws alongside it rather than over it.
    if (accepted && accepted.samples.length > 0) {
      count = writeGlyphs(
        mesh,
        traceGlyphs(accepted.samples, { testedPrefixCount: accepted.testedPrefixCount }),
        count
      );
      count = Math.min(count, SLOT_GLYPH_ALLOCATION);
    }
    if (working && working.samples.length > 0) {
      // Capacity already stopped honestly in the slot itself; nothing is
      // decimated here either.
      count = writeGlyphs(
        mesh,
        traceGlyphs(working.samples, {
          testedPrefixCount: working.testedPrefixCount,
          heldIndex
        }),
        count
      );
    } else if (display !== 'none') {
      // The common display uses the RELEASED WORKING ALLOCATION. It is drawn only
      // while no proposal owns that half, which is exactly the lifecycle the lane
      // describes: the guide appears after the survey is accepted, and an
      // optional repeat takes the allocation back.
      if (display === 'planned-guide') {
        // PLANNED AND UNVERIFIED, AND GROUNDED. The line follows the existing
        // qualified polyline and stops where the live ground actually stops
        // carrying it; it never floats over an edit and never replans around one.
        const bad = ground
          ? firstUnsupportedSegment(CG_ROUTE_COMMON, ground, {
              extraSolids: solidsRef.current,
              bodyHeight: PLAYER_BODY_HEIGHT
            })
          : -1;
        const supportedThrough = bad < 0 ? CG_ROUTE_COMMON.length - 1 : bad - 1;
        count = writeGlyphs(mesh, commonGuideGlyphs(CG_ROUTE_COMMON, supportedThrough), count);
      } else {
        count = writeGlyphs(mesh, commonTestedGlyphs(CG_ROUTE_COMMON), count);
      }
    }
    mesh.count = Math.min(count, TRACE_GLYPH_POOL);
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