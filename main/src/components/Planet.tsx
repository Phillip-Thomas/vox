import React, { useMemo, useContext, useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useKeyboardControls } from '@react-three/drei';
import { CuboidCollider, InstancedRigidBodies, InstancedRigidBodiesProps, InstancedRigidBodyProps, RapierRigidBody} from '@react-three/rapier';
import { PlanetContext } from '../context/PlanetContext';

const CUBE_SIZE_X = 50// Sze on X axis in voxels
const CUBE_SIZE_Y = 10 // Size on Y axis in voxels
const CUBE_SIZE_Z = 50// Size on Z axis in voxels

// Create material once - using MeshStandardMaterial for roughness/metalness properties
const voxelMaterial = new THREE.MeshStandardMaterial({ 
  color: "#229922",
  roughness: 0.7,
  metalness: 0.1
});

export default function Planet() {
  const { voxelSize: VOXEL_SIZE } = useContext(PlanetContext);
  const rigidBodies = useRef<RapierRigidBody[]>([]);
  const [planetReady, setPlanetReady] = useState(false);
  const [, get] = useKeyboardControls();
console.log("voxel size", VOXEL_SIZE)
  // Store original positions for reset
  const originalPositions = useRef<[number, number, number][]>([]);



    // Create instances data for InstancedRigidBodies
  const instances = useMemo<InstancedRigidBodyProps[]>(() => {
    if (!VOXEL_SIZE) return [];         // wait for a real size
    
    const out: InstancedRigidBodyProps[] = [];
    const positions: [number, number, number][] = [];

    // optional: centre the chunk at the world origin
    const offset = [
      -((CUBE_SIZE_X - 1) * VOXEL_SIZE) / 2,
      -((CUBE_SIZE_Y - 1) * VOXEL_SIZE) / 2,
      -((CUBE_SIZE_Z - 1) * VOXEL_SIZE) / 2,
    ] as const;

    for (let x = 0; x < CUBE_SIZE_X; x++) {
      for (let y = 0; y < CUBE_SIZE_Y; y++) {
        for (let z = 0; z < CUBE_SIZE_Z; z++) {
          const position: [number, number, number] = [
            x * VOXEL_SIZE + offset[0],
            y * VOXEL_SIZE + offset[1],
            z * VOXEL_SIZE + offset[2],
          ];
          
          out.push({
            key: `voxel_${x}_${y}_${z}`,
            position,
            rotation: [0, 0, 0],
            type: "dynamic", // Changed back to dynamic so they can fall
          });
          
          // Store original positions for reset
          positions.push(position);
        }
      }
    }
    originalPositions.current = positions;
    setPlanetReady(true);
    
    return out;
  }, [VOXEL_SIZE]); 
  const totalVoxels = CUBE_SIZE_X * CUBE_SIZE_Y * CUBE_SIZE_Z;
  console.log(totalVoxels);

  useEffect(() => {
    rigidBodies.current.forEach((body, index) => {
        const [x, y, z] = originalPositions.current[index];
        body.setTranslation({ x, y, z }, true);
        body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    });
  }, [planetReady])

  return (
    <InstancedRigidBodies
      key={`voxels-${VOXEL_SIZE}`} 
      instances={instances}
      ref={rigidBodies}
      colliders={false}
      type="fixed"
      gravityScale={0}
    >
      <CuboidCollider args={[VOXEL_SIZE * 0.45, VOXEL_SIZE * 0.45, VOXEL_SIZE * 0.45]} />
      <instancedMesh args={[undefined, undefined, totalVoxels]} count={totalVoxels}>
      <boxGeometry args={[VOXEL_SIZE*.95, VOXEL_SIZE*.95, VOXEL_SIZE*.95]} />
      <primitive object={voxelMaterial} attach="material" />
      </instancedMesh>
    </InstancedRigidBodies>
  );
} 