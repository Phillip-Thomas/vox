import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getGraphicsQuality } from '../config/graphicsSettings.ts';
import { voxelCoordToWorld } from '../utils/cubeGravityConstants.ts';
import { buildWaterFaces, FACE_NORMALS, WaterFace } from '../utils/waterVoxels.ts';
import { createWaterBlocksMaterial, updateWaterBlocksMaterial, applyWaterProfileToMaterial } from '../utils/waterBlocksMaterial.ts';
import { buildWaterProfile } from '../utils/waterProfile.ts';
import { measureWarpMetric } from '../utils/warpMetrics.ts';
import { voxelSystem } from '../utils/efficientVoxelSystem.ts';
import { getWorldGen } from '../utils/worldGenCache.ts';
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
  const gen = useMemo(() => getWorldGen(planetSize, terrainSeed).generator, [planetSize, terrainSeed]);
  // The generator's isWaterVoxel covers the FULL flooded set (interior + surface),
  // so faces are suppressed toward interior water, not just the surface layer.
  const isWater = useMemo(
    () => (x: number, y: number, z: number) => gen.isWaterVoxel(x, y, z),
    [gen]
  );
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
  const geometry = useMemo(() => new THREE.PlaneGeometry(QUAD_SIZE, QUAD_SIZE, 6, 6), []);
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
        const nrm = new THREE.Vector3();
        const up = new THREE.Vector3();
        const right = new THREE.Vector3();
        const yCol = new THREE.Vector3();
        const topScale = new THREE.Vector3(1, 1, 1);
        // Side walls span the cell FLOOR (-1) up to the water surface (FACE_OFFSET),
        // sit at the cell BOUNDARY, and rise along the cell's outward CUBE AXIS — the
        // same axis the top quad sits on — so the wall top meets the top sheet exactly
        // (no poking above, no inset-too-far).
        const SIDE_BOTTOM = -1.0;
        const SIDE_BOUNDARY = 1.0;
        const sideHeight = FACE_OFFSET - SIDE_BOTTOM;       // ~1.55
        const sideCenterH = (FACE_OFFSET + SIDE_BOTTOM) / 2; // ~-0.225
        let slot = 0;
        for (const face of faces) {
          if (slot >= mesh.instanceMatrix.count) break;
          voxelCoordToWorld(face.x, face.y, face.z, cellCenter);
          const [nx, ny, nz] = FACE_NORMALS[face.faceDir];
          nrm.set(nx, ny, nz);
          // Outward cube axis for this cell (the dominant axis of its centre).
          const ax = Math.abs(cellCenter.x), ay = Math.abs(cellCenter.y), az = Math.abs(cellCenter.z);
          if (ax >= ay && ax >= az) up.set(Math.sign(cellCenter.x) || 1, 0, 0);
          else if (ay >= ax && ay >= az) up.set(0, Math.sign(cellCenter.y) || 1, 0);
          else up.set(0, 0, Math.sign(cellCenter.z) || 1);
          const topness = nrm.dot(up);
          if (topness > 0.5) {
            // Outward/top face: flat 2x2 quad lowered for wave headroom (unchanged).
            facePos.copy(cellCenter).addScaledVector(nrm, FACE_OFFSET);
            m.compose(facePos, FACE_QUATERNIONS[face.faceDir], topScale);
          } else if (topness < -0.5) {
            // Bottom face (water with a void below): a flat quad at the floor
            // boundary, same orientation scheme as the top — NOT a wall (the wall
            // basis degenerates when nrm is antiparallel to up, which rotated it 90°).
            facePos.copy(cellCenter).addScaledVector(nrm, SIDE_BOUNDARY);
            m.compose(facePos, FACE_QUATERNIONS[face.faceDir], topScale);
          } else {
            // Side (or bottom) wall: boundary-placed quad, width = tangent,
            // height = floor->surface along the outward cube axis. Use up x nrm
            // (not nrm x up) so the basis (right, up, nrm) is RIGHT-HANDED and the
            // quad's +z front normal points OUTWARD (nrm), not flipped inward.
            right.crossVectors(up, nrm);
            if (right.lengthSq() < 1e-6) right.set(0, 0, 1).cross(nrm);
            right.normalize();                                // unit -> full cell width (±1)
            yCol.copy(up).multiplyScalar(sideHeight / 2);     // scaled height column
            facePos.copy(cellCenter)
              .addScaledVector(nrm, SIDE_BOUNDARY)
              .addScaledVector(up, sideCenterH);
            m.makeBasis(right, yCol, nrm);
            m.setPosition(facePos);
          }
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
  }, [waterVoxels, isWater, capacity, debug]);

  useLayoutEffect(() => {
    if (meshRef.current) syncWater(meshRef.current, true);
  }, [syncWater]);

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

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
