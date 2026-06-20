import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getGraphicsQuality } from '../config/graphicsSettings';
import { voxelCoordToWorld } from '../utils/cubeGravityConstants';
import { buildWaterVoxels } from '../utils/waterVoxels';
import { createWaterBlocksMaterial, updateWaterBlocksMaterial } from '../utils/waterBlocksMaterial';
import { getSunDirection } from './SkyController';

interface WaterShellProps {
  size: number;
  terrainSeed: number;
}

const tempMatrix = new THREE.Matrix4();

export default function WaterShell({ size, terrainSeed }: WaterShellProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const material = useMemo(() => createWaterBlocksMaterial(), []);
  const waterVoxels = useMemo(() => buildWaterVoxels(size, terrainSeed), [size, terrainSeed]);
  const capacity = Math.max(1, waterVoxels.length);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    for (let i = 0; i < waterVoxels.length; i++) {
      const voxel = waterVoxels[i];
      tempMatrix.identity();
      tempMatrix.setPosition(voxelCoordToWorld(voxel.x, voxel.y, voxel.z));
      mesh.setMatrixAt(i, tempMatrix);
    }

    mesh.count = waterVoxels.length;
    mesh.instanceMatrix.needsUpdate = true;
  }, [waterVoxels]);

  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  useFrame(({ clock }) => {
    updateWaterBlocksMaterial(material, clock.elapsedTime, getSunDirection(), getGraphicsQuality());
  });

  if (waterVoxels.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, material, capacity]}
      count={waterVoxels.length}
      frustumCulled={false}
      renderOrder={20}
    >
      <boxGeometry args={[1.98, 1.98, 1.98]} />
    </instancedMesh>
  );
}
