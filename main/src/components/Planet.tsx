import React, { useMemo, useContext } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { RigidBody } from '@react-three/rapier';
import { Box } from '@react-three/drei';
import { PlanetContext } from '../context/PlanetContext';

const CUBE_SIZE = 10; // Size of the cube in voxels

// Create material once
const voxelMaterial = new THREE.MeshStandardMaterial({ 
  color: "#229922",
  roughness: 0.7,
  metalness: 0.1
});

export default function Planet() {
  const { voxelSize: VOXEL_SIZE } = useContext(PlanetContext);

  // Calculate offset to center the cube
  const offset = -(CUBE_SIZE * VOXEL_SIZE) / 2;

  // Create voxels
  const voxels = [];
  for (let x = 0; x < CUBE_SIZE; x++) {
    for (let y = 0; y < CUBE_SIZE; y++) {
      for (let z = 0; z < CUBE_SIZE; z++) {
        const position: [number, number, number] = [
          x * VOXEL_SIZE + offset,
          y * VOXEL_SIZE + offset,
          z * VOXEL_SIZE + offset
        ];
        
        voxels.push(
          <RigidBody
            key={`${x}-${y}-${z}`}
            type="fixed"
            colliders="cuboid"
            position={position}
          >
            <Box args={[VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE]} material={voxelMaterial} />
          </RigidBody>
        );
      }
    }
  }

  return <>{voxels}</>;
} 