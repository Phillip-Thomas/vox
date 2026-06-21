import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getGraphicsQuality } from '../config/graphicsSettings.ts';
import { voxelCoordToWorld } from '../utils/cubeGravityConstants.ts';
import { buildWaterFaces, buildWaterVoxels, FACE_NORMALS, WaterFace } from '../utils/waterVoxels.ts';
import { createWaterBlocksMaterial, updateWaterBlocksMaterial } from '../utils/waterBlocksMaterial.ts';
import { measureWarpMetric } from '../utils/warpMetrics.ts';
import { voxelSystem } from '../utils/efficientVoxelSystem.ts';
import { getSunDirection, getMoonDirection } from './SkyController.tsx';

interface WaterBlocksProps {
  planetSize: number;
  terrainSeed: number;
}

// Rest position of the water surface along its cell's outward axis. The cell
// spans ±1.0 world units (VOXEL_SCALE=2) so the cell TOP is at +1.0. We rest the
// surface BELOW the top so wave crests have headroom to rise WITHOUT poking above
// the voxel. Constraint: FACE_OFFSET + uWaveAmp*~1.05 <= 1.0 (see waterBlocksMaterial).
const FACE_OFFSET = 0.55;
const QUAD_SIZE = 2.0;

const PLANE_NORMAL = new THREE.Vector3(0, 0, 1);
const FACE_QUATERNIONS: THREE.Quaternion[] = FACE_NORMALS.map(([nx, ny, nz]) =>
  new THREE.Quaternion().setFromUnitVectors(PLANE_NORMAL, new THREE.Vector3(nx, ny, nz))
);

interface FilledMesh extends THREE.InstancedMesh {
  __waterSig?: string;
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

function WaterBlocksImpl({ planetSize, terrainSeed }: WaterBlocksProps) {
  const meshRef = useRef<FilledMesh>(null);
  const debug = useMemo(() => isWaterDebug(), []);

  // Static water CELLS (the flooded set) + a fast key lookup. Faces are derived
  // from these against the LIVE voxel state (so digging exposes side faces).
  const waterVoxels = useMemo(
    () => buildWaterVoxels(planetSize, terrainSeed),
    [planetSize, terrainSeed]
  );
  // The generator's isWaterVoxel covers the FULL flooded set (interior + surface),
  // so faces are correctly suppressed toward interior water, not just surface.
  const isWater = useMemo(() => {
    const gen = getWorldGen(planetSize, terrainSeed).generator;
    return (x: number, y: number, z: number) => gen.isWaterVoxel(x, y, z);
  }, [planetSize, terrainSeed]);

  // Subdivided so the vertex-shader wave displacement actually curves the surface
  // (a 1-segment quad has only 4 corners and can't show ripples).
  const geometry = useMemo(() => new THREE.PlaneGeometry(QUAD_SIZE, QUAD_SIZE, 6, 6), []);
  const material = useMemo(
    () =>
      debug
        ? new THREE.MeshBasicMaterial({ color: 0xff00ff, side: THREE.DoubleSide })
        : createWaterBlocksMaterial(),
    [debug]
  );

  // Buffer = natural surface faces + headroom for the extra side faces that
  // digging exposes (each dig reveals at most a few). Generous so common digging
  // never overflows; the fill clamps to capacity regardless.
  const capacity = useMemo(
    () => Math.max(1, buildWaterFaces(planetSize, terrainSeed).length + 2048),
    [planetSize, terrainSeed]
  );

  // Recompute faces against the live voxel state + refill, when the voxel edit
  // signature changes (initial population, dig, place). `force` for the first fill.
  const syncWater = useCallback((mesh: FilledMesh, force = false) => {
    const sig = `${voxelSystem.getWorldId()}:${voxelSystem.getEditVersion()}`;
    if (!force && mesh.__waterSig === sig) return;
    mesh.__waterSig = sig;
    measureWarpMetric(
      'water:fill_instances',
      () => {
        const faces = computeLiveWaterFaces(waterVoxels, isWater);
        const m = new THREE.Matrix4();
        const cellCenter = new THREE.Vector3();
        const facePos = new THREE.Vector3();
        const normal = new THREE.Vector3();
        const scale = new THREE.Vector3(1, 1, 1);
        let slot = 0;
        for (const face of faces) {
          if (slot >= mesh.instanceMatrix.count) break;
          voxelCoordToWorld(face.x, face.y, face.z, cellCenter);
          const [nx, ny, nz] = FACE_NORMALS[face.faceDir];
          normal.set(nx, ny, nz);
          facePos.copy(cellCenter).addScaledVector(normal, FACE_OFFSET);
          m.compose(facePos, FACE_QUATERNIONS[face.faceDir], scale);
          mesh.setMatrixAt(slot, m);
          slot++;
        }
        mesh.count = slot;
        mesh.instanceMatrix.needsUpdate = true;
        if (debug) {
          console.log(`[water] FILL faces=${faces.length} capacity=${capacity} count=${mesh.count}`);
        }
        return slot;
      },
      slot => ({ count: slot, capacity })
    );
  }, [waterVoxels, waterKeys, capacity, debug]);

  useLayoutEffect(() => {
    if (meshRef.current) syncWater(meshRef.current, true);
  }, [syncWater]);

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  useFrame(state => {
    if (!debug) {
      updateWaterBlocksMaterial(material as THREE.MeshStandardMaterial, state.clock.elapsedTime, getSunDirection(), getMoonDirection(), getGraphicsQuality());
    }
    const mesh = meshRef.current;
    if (!mesh) return;
    // Rebuild when terrain is edited (dig/place) so newly-exposed water side faces
    // appear and re-covered ones disappear.
    syncWater(mesh);
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, capacity]}
      frustumCulled={false}
      renderOrder={2}
    />
  );
}

const WaterBlocks = memo(WaterBlocksImpl);
export default WaterBlocks;
