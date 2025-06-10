import React, { useMemo, useContext, useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { useKeyboardControls } from '@react-three/drei';
import { CuboidCollider, InstancedRigidBodies, InstancedRigidBodyProps, RapierRigidBody} from '@react-three/rapier';
import { PlanetContext } from '../context/PlanetContext';
import { MaterialType, MATERIALS, getRandomMaterialType } from '../types/materials';
import { generateVoxelInstances } from '../utils/instanceGenerator';
import { generateInstanceMaterials } from '../utils/materialGenerator';

// Create material once - using MeshStandardMaterial for roughness/metalness properties
const voxelMaterial = new THREE.MeshStandardMaterial({ 
  color: "#ffffff", // Changed to white so instance colors show properly
  roughness: 0.7,
  metalness: 0.1
});

// Export refs for raycaster access
export const planetInstancedMesh = { current: null as THREE.InstancedMesh | null };
export const planetInstanceMaterials = { current: [] as any[] };
export const planetRigidBodies = { current: [] as RapierRigidBody[] };

export default function Planet() {
  const { voxelSize: VOXEL_SIZE } = useContext(PlanetContext);
  const rigidBodies = useRef<RapierRigidBody[]>([]);
  const instancedMeshRef = useRef<THREE.InstancedMesh>(null);
  const [planetReady, setPlanetReady] = useState(false);
  const [, get] = useKeyboardControls();
  console.log("voxel size", VOXEL_SIZE)
  // Store original positions for reset
  const originalPositions = useRef<[number, number, number][]>([]);

  // Generate materials and colors for each instance
  const { instanceColors, instanceMaterials } = useMemo(() => {
    return generateInstanceMaterials(VOXEL_SIZE);
  }, [VOXEL_SIZE]);

  // Create instances data for InstancedRigidBodies
  const instances = useMemo<InstancedRigidBodyProps[]>(() => {
    const result = generateVoxelInstances(VOXEL_SIZE);
    originalPositions.current = result.originalPositions;
    setPlanetReady(true);
    return result.instances;
  }, [VOXEL_SIZE]); 
  
  const totalVoxels = instances.length; // Use actual instances length instead of fixed calculation
  console.log(totalVoxels);

  // Set colors on the instanced mesh when it's ready
  useEffect(() => {
    if (instancedMeshRef.current && instanceColors.length > 0) {
      instanceColors.forEach((color, index) => {
        instancedMeshRef.current!.setColorAt(index, color);
      });
      instancedMeshRef.current.instanceColor!.needsUpdate = true;
    }
  }, [instanceColors, planetReady]);

  useEffect(() => {
    console.log("Setting userData on", rigidBodies.current.length, "rigid bodies");
    rigidBodies.current.forEach((body, index) => {
        const [x, y, z] = originalPositions.current[index];
        body.setTranslation({ x, y, z }, true);
        body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        body.setAngvel({ x: 0, y: 0, z: 0 }, true);
        
        // Enhance userData with additional info
        if (instances[index]) {
          const userData = {
            ...instances[index].userData,
            key: instances[index].key,
            originalPosition: [x, y, z],
            material: instanceMaterials[index] || instances[index].userData?.material,
            debugIndex: index
          };
          body.userData = userData;
          
          // Debug logging for first few bodies
          if (index < 3) {
            console.log(`Body ${index} userData set:`, userData);
            console.log(`Body ${index} userData after setting:`, body.userData);
          }
        }
    });
    
    // Set up global references for raycaster access
    planetInstancedMesh.current = instancedMeshRef.current;
    planetInstanceMaterials.current = instanceMaterials;
    planetRigidBodies.current = rigidBodies.current;
    
    console.log("Planet raycaster references updated");
  }, [planetReady, instances, instanceMaterials])

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
      <instancedMesh ref={instancedMeshRef} args={[undefined, undefined, totalVoxels]} count={totalVoxels}>
      <boxGeometry args={[VOXEL_SIZE*.9, VOXEL_SIZE*.9, VOXEL_SIZE*.9]} />
      <primitive object={voxelMaterial} attach="material" />
      </instancedMesh>
    </InstancedRigidBodies>
  );
} 