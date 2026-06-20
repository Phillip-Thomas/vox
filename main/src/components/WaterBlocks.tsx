import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getGraphicsQuality } from '../config/graphicsSettings.ts';
import { voxelCoordToWorld } from '../utils/cubeGravityConstants.ts';
import { buildWaterFaces, FACE_NORMALS, WaterFace } from '../utils/waterVoxels.ts';
import { createWaterBlocksMaterial, updateWaterBlocksMaterial } from '../utils/waterBlocksMaterial.ts';
import { getSunDirection } from './SkyController.tsx';

interface WaterBlocksProps {
  planetSize: number;
  terrainSeed: number;
}

const FACE_OFFSET = 0.99;
const QUAD_SIZE = 2.0;

const PLANE_NORMAL = new THREE.Vector3(0, 0, 1);
const FACE_QUATERNIONS: THREE.Quaternion[] = FACE_NORMALS.map(([nx, ny, nz]) =>
  new THREE.Quaternion().setFromUnitVectors(PLANE_NORMAL, new THREE.Vector3(nx, ny, nz))
);

interface FilledMesh extends THREE.InstancedMesh {
  __waterFilledFor?: WaterFace[];
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

  const waterFaces = useMemo(
    () => buildWaterFaces(planetSize, terrainSeed),
    [planetSize, terrainSeed]
  );

  const geometry = useMemo(() => new THREE.PlaneGeometry(QUAD_SIZE, QUAD_SIZE), []);
  const material = useMemo(
    () =>
      debug
        ? new THREE.MeshBasicMaterial({ color: 0xff00ff, side: THREE.DoubleSide })
        : createWaterBlocksMaterial(),
    [debug]
  );

  const capacity = Math.max(waterFaces.length, 1);

  const fill = useCallback((mesh: FilledMesh) => {
    const m = new THREE.Matrix4();
    const cellCenter = new THREE.Vector3();
    const facePos = new THREE.Vector3();
    const normal = new THREE.Vector3();
    const scale = new THREE.Vector3(1, 1, 1);
    // Instrumentation: bounding box + radius range of the placed quads.
    const min = new THREE.Vector3(Infinity, Infinity, Infinity);
    const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
    let minR = Infinity;
    let maxR = -Infinity;
    let slot = 0;
    for (const face of waterFaces) {
      if (slot >= mesh.instanceMatrix.count) break;
      voxelCoordToWorld(face.x, face.y, face.z, cellCenter);
      const [nx, ny, nz] = FACE_NORMALS[face.faceDir];
      normal.set(nx, ny, nz);
      facePos.copy(cellCenter).addScaledVector(normal, FACE_OFFSET);
      m.compose(facePos, FACE_QUATERNIONS[face.faceDir], scale);
      mesh.setMatrixAt(slot, m);
      min.min(facePos);
      max.max(facePos);
      const r = facePos.length();
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
      slot++;
    }
    mesh.count = slot;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.__waterFilledFor = waterFaces;

    console.log(
      `[water] FILL faces=${waterFaces.length} capacity=${capacity} count=${mesh.count} ` +
        `debug=${debug} radius(world)=[${minR.toFixed(1)}..${maxR.toFixed(1)}] ` +
        `AABB min=(${min.x.toFixed(1)},${min.y.toFixed(1)},${min.z.toFixed(1)}) ` +
        `max=(${max.x.toFixed(1)},${max.y.toFixed(1)},${max.z.toFixed(1)}) ` +
        `mat=${(mesh.material as THREE.Material).type} ` +
        `visible=${mesh.visible} inScene=${!!mesh.parent}`
    );
  }, [waterFaces, capacity, debug]);

  useLayoutEffect(() => {
    if (meshRef.current) fill(meshRef.current);
  }, [fill]);

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  const logFrame = useRef(0);
  useFrame(state => {
    if (!debug) {
      updateWaterBlocksMaterial(material as THREE.MeshStandardMaterial, state.clock.elapsedTime, getSunDirection(), getGraphicsQuality());
    }

    const mesh = meshRef.current;
    if (!mesh) return;

    const expected = Math.min(waterFaces.length, mesh.instanceMatrix.count);
    if (mesh.__waterFilledFor !== waterFaces || mesh.count !== expected) {
      fill(mesh);
    }

    // Periodic heartbeat: confirm count persists + show camera vs water spatially.
    if (++logFrame.current % 180 === 0) {
      const cam = state.camera.position;
      console.log(
        `[water] tick count=${mesh.count} inScene=${!!mesh.parent} visible=${mesh.visible} ` +
          `camPos=(${cam.x.toFixed(1)},${cam.y.toFixed(1)},${cam.z.toFixed(1)}) ` +
          `camRadius=${cam.length().toFixed(1)}`
      );
    }
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
