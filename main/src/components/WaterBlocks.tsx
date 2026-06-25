import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getGraphicsQuality } from '../config/graphicsSettings.ts';
import { voxelCoordToWorld } from '../utils/cubeGravityConstants.ts';
import { buildWaterFaces, WaterFace } from '../utils/waterVoxels.ts';
import {
  composeWaterEdgeCapMatrix,
  composeWaterFaceMatrix,
  createWaterFacePlacementScratch,
  WATER_FACE_OFFSET,
  WATER_QUAD_SIZE
} from '../utils/waterFacePlacement.ts';
import { createWaterBlocksMaterial, updateWaterBlocksMaterial, applyWaterProfileToMaterial } from '../utils/waterBlocksMaterial.ts';
import { buildWaterProfile } from '../utils/waterProfile.ts';
import { measureWarpMetric } from '../utils/warpMetrics.ts';
import { voxelSystem } from '../utils/efficientVoxelSystem.ts';
import { getWorldGen } from '../utils/worldGenCache.ts';
import { getSunDirection, getMoonDirection } from './SkyController.tsx';
import {
  applyPendingReplicatedWaterFlood,
  clearActiveReplicatedWaterWorld,
  setActiveReplicatedWaterWorld,
  type WaterReplicationTarget
} from '../game/multiplayerReplication.ts';

interface WaterBlocksProps {
  planetSize: number;
  terrainSeed: number;
  worldId?: string;
}

interface FilledMesh extends THREE.InstancedMesh {
  __waterSig?: string;
}

interface WaterFaceGroup {
  x: number;
  y: number;
  z: number;
  dirs: number[];
}

// Neighbour offsets, ordered to match FACE_NORMALS / faceDir (0=+x..5=-z).
const NEIGHBOR_OFFSETS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 0], [-1, 0, 0],
  [0, 1, 0], [0, -1, 0],
  [0, 0, 1], [0, 0, -1]
];

/**
 * Recompute exposed water faces against the LIVE voxel state. A face is emitted
 * for a water cell toward any neighbour that is NOT water and NOT currently solid
 * (`voxelSystem.hasVoxel`). Because water-adjacent terrain is always exposed, a
 * dug block flips to not-solid here and the water's side face appears — so water
 * reads as a 3D block, not a flat sheet. At load (nothing dug) this matches the
 * static generator faces.
 */
function computeLiveWaterFaces(
  waterVoxels: ReadonlyArray<{ x: number; y: number; z: number }>,
  isWater: (x: number, y: number, z: number) => boolean
): WaterFace[] {
  const faces: WaterFace[] = [];
  for (const v of waterVoxels) {
    for (let f = 0; f < 6; f++) {
      const nx = v.x + NEIGHBOR_OFFSETS[f][0];
      const ny = v.y + NEIGHBOR_OFFSETS[f][1];
      const nz = v.z + NEIGHBOR_OFFSETS[f][2];
      if (isWater(nx, ny, nz)) continue; // neighbour is water (interior) -> no face
      if (voxelSystem.hasVoxel(nx, ny, nz)) continue; // hidden behind solid terrain
      faces.push({ x: v.x, y: v.y, z: v.z, faceDir: f }); // air or dug-open -> face
    }
  }
  return faces;
}

// ?waterdebug=1 → render the water as bright OPAQUE magenta (MeshBasicMaterial,
// depthWrite on, no transparency) instead of the water shader. This isolates the
// failure: if magenta shows, geometry/placement/count are FINE and the water
// shader/transparency is what makes it invisible; if magenta is ALSO absent, the
// problem is geometry (count 0 / wrong position / occlusion).
function isWaterDebug(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('waterdebug') === '1';
  } catch {
    return false;
  }
}

function createWaterEdgeCapGeometry(radius = WATER_FACE_OFFSET, arcSegments = 8, lengthSegments = 6): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= arcSegments; i++) {
    const theta = (i / arcSegments) * Math.PI * 0.5;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    for (let j = 0; j <= lengthSegments; j++) {
      const z = -1 + (j / lengthSegments) * 2;
      positions.push(radius * cos, radius * sin, z);
      normals.push(cos, sin, 0);
      uvs.push(i / arcSegments, j / lengthSegments);
    }
  }

  const row = lengthSegments + 1;
  for (let i = 0; i < arcSegments; i++) {
    for (let j = 0; j < lengthSegments; j++) {
      const a = i * row + j;
      const b = (i + 1) * row + j;
      const c = (i + 1) * row + j + 1;
      const d = i * row + j + 1;
      indices.push(a, b, d, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function WaterBlocksImpl({ planetSize, terrainSeed, worldId }: WaterBlocksProps) {
  const meshRef = useRef<FilledMesh>(null);
  const capMeshRef = useRef<FilledMesh>(null);
  const debug = useMemo(() => isWaterDebug(), []);

  // Static water CELLS (the flooded set) + a fast key lookup. Faces are derived
  // from these against the LIVE voxel state (so digging exposes side faces).
  const gen = useMemo(() => getWorldGen(planetSize, terrainSeed).generator, [planetSize, terrainSeed]);
  // The generator's isWaterVoxel covers the FULL flooded set (interior + surface),
  // so faces are suppressed toward interior water, not just the surface layer.
  const isWater = useMemo(
    () => (x: number, y: number, z: number) => gen.isWaterVoxel(x, y, z),
    [gen]
  );
  const replicatedWater = useMemo<WaterReplicationTarget>(() => ({
    applyWaterFlood: cells => gen.applyDynamicWaterCells(cells.map(([x, y, z]) => ({ x, y, z })))
  }), [gen]);

  useEffect(() => {
    if (!worldId) return undefined;
    setActiveReplicatedWaterWorld(worldId, replicatedWater);
    applyPendingReplicatedWaterFlood(worldId, replicatedWater);
    return () => clearActiveReplicatedWaterWorld(worldId);
  }, [replicatedWater, worldId]);

  // ALL water cells (not just the initially-exposed surface), so digging next to
  // even deep water reveals that cell's side face. One cube scan per world.
  const waterVoxels = useMemo(() => {
    const R = Math.floor(planetSize / 2) + 6;
    const out: Array<{ x: number; y: number; z: number }> = [];
    for (let x = -R; x <= R; x++)
      for (let y = -R; y <= R; y++)
        for (let z = -R; z <= R; z++)
          if (gen.isWaterVoxel(x, y, z)) out.push({ x, y, z });
    return out;
  }, [gen, planetSize]);

  // Subdivided so the vertex-shader wave displacement actually curves the surface
  // (a 1-segment quad has only 4 corners and can't show ripples).
  const geometry = useMemo(() => new THREE.PlaneGeometry(WATER_QUAD_SIZE, WATER_QUAD_SIZE, 6, 6), []);
  const edgeCapGeometry = useMemo(() => createWaterEdgeCapGeometry(), []);
  const material = useMemo(
    () =>
      debug
        ? new THREE.MeshBasicMaterial({ color: 0xff00ff, side: THREE.DoubleSide })
        : createWaterBlocksMaterial(),
    [debug]
  );

  // Per-planet water colours (deep/shallow/sss/foam/night) derived from the shared
  // biome, so the ocean coheres with grass/trees instead of being the same teal on
  // every world. Rebuilt only when the planet seed changes; pushed into the shader
  // uniforms once it has compiled (see useFrame).
  const profile = useMemo(() => buildWaterProfile(terrainSeed), [terrainSeed]);
  const profileAppliedRef = useRef(false);
  useEffect(() => {
    profileAppliedRef.current = false;
  }, [profile, material]);

  // Buffer = natural surface faces + headroom for the extra side faces that
  // digging exposes (each dig reveals at most a few). Generous so common digging
  // never overflows; the fill clamps to capacity regardless.
  const capacity = useMemo(
    () => Math.max(1, buildWaterFaces(planetSize, terrainSeed).length + 8192),
    [planetSize, terrainSeed]
  );

  // Dig-to-fill persistence: re-extend the flood for any already-dug cells (the
  // deletions are persisted, the dynamic flood is not) so water that flowed into a
  // dug channel before a reload comes back. Fixpoint so cascade order is moot. Runs
  // once per world generator; cheap (bounded by the edit count).
  useEffect(() => {
    const deleted = voxelSystem.getDeletedTerrainKeys();
    if (deleted.length === 0) return;
    const isLiveSolid = (x: number, y: number, z: number) =>
      gen.shouldVoxelExist(x, y, z) && !voxelSystem.isDeleted(x, y, z);
    let changed = true;
    while (changed) {
      changed = false;
      for (const k of deleted) {
        const [x, y, z] = k.split(',').map(Number);
        if (gen.extendFloodForDugCell(x, y, z, isLiveSolid).length > 0) changed = true;
      }
    }
  }, [gen]);

  // Recompute faces against the live voxel state + refill, when the voxel edit
  // signature changes (initial population, dig, place). `force` for the first fill.
  const syncWater = useCallback((mesh: FilledMesh, capMesh: FilledMesh, force = false) => {
    const sig = `${voxelSystem.getWorldId()}:${voxelSystem.getEditVersion()}:${gen.getWaterEditVersion()}`;
    if (!force && mesh.__waterSig === sig) return;
    mesh.__waterSig = sig;
    capMesh.__waterSig = sig;
    measureWarpMetric(
      'water:fill_instances',
      () => {
        // Static flooded set + the runtime dig-to-fill cells, so newly-filled
        // cells emit their own faces (not just suppress their neighbours').
        const faces = computeLiveWaterFaces(waterVoxels.concat(gen.getDynamicWaterCells()), isWater);
        const m = new THREE.Matrix4();
        const cellCenter = new THREE.Vector3();
        const placement = createWaterFacePlacementScratch();
        const surfaceGroups = new Map<string, WaterFaceGroup>();
        let slot = 0;
        for (const face of faces) {
          if (slot >= mesh.instanceMatrix.count) break;
          voxelCoordToWorld(face.x, face.y, face.z, cellCenter);
          const kind = composeWaterFaceMatrix(face.faceDir, cellCenter, m, placement);
          mesh.setMatrixAt(slot, m);
          if (kind === 'surface') {
            const key = `${face.x},${face.y},${face.z}`;
            let group = surfaceGroups.get(key);
            if (!group) {
              group = { x: face.x, y: face.y, z: face.z, dirs: [] };
              surfaceGroups.set(key, group);
            }
            group.dirs.push(face.faceDir);
          }
          slot++;
        }
        mesh.count = slot;
        mesh.instanceMatrix.needsUpdate = true;

        let capSlot = 0;
        for (const group of surfaceGroups.values()) {
          if (capSlot >= capMesh.instanceMatrix.count) break;
          if (group.dirs.length < 2) continue;
          voxelCoordToWorld(group.x, group.y, group.z, cellCenter);
          for (let i = 0; i < group.dirs.length - 1; i++) {
            for (let j = i + 1; j < group.dirs.length; j++) {
              if (capSlot >= capMesh.instanceMatrix.count) break;
              if (!composeWaterEdgeCapMatrix(group.dirs[i], group.dirs[j], cellCenter, m, placement)) continue;
              capMesh.setMatrixAt(capSlot, m);
              capSlot++;
            }
          }
        }
        capMesh.count = capSlot;
        capMesh.instanceMatrix.needsUpdate = true;
        if (debug) {
          console.log(`[water] FILL faces=${faces.length} capacity=${capacity} count=${mesh.count} caps=${capMesh.count}`);
        }
        return slot;
      },
      slot => ({ count: slot, capacity })
    );
  }, [gen, waterVoxels, isWater, capacity, debug]);

  useLayoutEffect(() => {
    if (meshRef.current && capMeshRef.current) syncWater(meshRef.current, capMeshRef.current, true);
  }, [syncWater]);

  useEffect(() => () => {
    geometry.dispose();
    edgeCapGeometry.dispose();
    material.dispose();
  }, [geometry, edgeCapGeometry, material]);

  useFrame(state => {
    if (!debug) {
      const waterMat = material as THREE.MeshStandardMaterial;
      // Push per-planet colours once the shader has compiled (uniforms exist).
      if (!profileAppliedRef.current && waterMat.userData.shader) {
        applyWaterProfileToMaterial(profile, waterMat);
        profileAppliedRef.current = true;
      }
      updateWaterBlocksMaterial(waterMat, state.clock.elapsedTime, getSunDirection(), getMoonDirection(), getGraphicsQuality());
    }
    const mesh = meshRef.current;
    const capMesh = capMeshRef.current;
    if (!mesh || !capMesh) return;
    // Rebuild when terrain is edited (dig/place) so newly-exposed water side faces
    // appear and re-covered ones disappear.
    syncWater(mesh, capMesh);
  });

  return (
    <group>
      <instancedMesh
        ref={meshRef}
        args={[geometry, material, capacity]}
        frustumCulled={false}
        renderOrder={2}
      />
      <instancedMesh
        ref={capMeshRef}
        args={[edgeCapGeometry, material, capacity]}
        frustumCulled={false}
        renderOrder={2}
      />
    </group>
  );
}

const WaterBlocks = memo(WaterBlocksImpl);
export default WaterBlocks;
