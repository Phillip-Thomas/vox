import React, { useMemo, useContext, useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { useKeyboardControls } from '@react-three/drei';
import { CuboidCollider, InstancedRigidBodies, InstancedRigidBodyProps, RapierRigidBody} from '@react-three/rapier';
import { PlanetContext } from '../context/PlanetContext';
import { MaterialType, MATERIALS, getRandomMaterialType } from '../types/materials';

const CUBE_SIZE_X = 50// Sze on X axis in voxels
const CUBE_SIZE_Y = 5 // Size on Y axis in voxels
const CUBE_SIZE_Z = 50// Size on Z axis in voxels

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
    if (!VOXEL_SIZE) return { instanceColors: [], instanceMaterials: [] };
    
    const colors: THREE.Color[] = [];
    const materials: MaterialType[] = [];
    const totalVoxels = CUBE_SIZE_X * CUBE_SIZE_Y * CUBE_SIZE_Z + 1; // +1 for additional cube
    
    for (let i = 0; i < totalVoxels; i++) {
      // Use the helper function to get a random material type
      const randomMaterialType = getRandomMaterialType();
      const material = MATERIALS[randomMaterialType];
      
      materials.push(randomMaterialType);
      colors.push(material.color.clone());
    }
    
    return { instanceColors: colors, instanceMaterials: materials };
  }, [VOXEL_SIZE]);

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
          
          const materialType = getRandomMaterialType();
          out.push({
            key: `voxel_${x}_${y}_${z}`,
            position,
            rotation: [0, 0, 0],
            args: {
              userData: {
                material: getRandomMaterialType(),
                voxelType: 'special',
                note: 'center cube'
              }
            },
            userData: {
              material: materialType,
              coordinates: { x, y, z },
              voxelType: 'terrain'
            },
            type: "dynamic", // Changed back to dynamic so they can fall
          });
          
          // Store original positions for reset
          positions.push(position);
        }
      }
    }
    
    // Add one additional cube in center, one row up from the top
    const centerX = Math.floor(CUBE_SIZE_X / 2);
    const centerZ = Math.floor(CUBE_SIZE_Z / 2);
    const topY = CUBE_SIZE_Y; // One row above the existing top
    
    const additionalPosition: [number, number, number] = [
      centerX * VOXEL_SIZE + offset[0],
      topY * VOXEL_SIZE + offset[1],
      centerZ * VOXEL_SIZE + offset[2],
    ];
    
    out.push({
      key: `voxel_${centerX}_${topY}_${centerZ}`,
      position: additionalPosition,
      rotation: [0, 0, 0],
      type: "dynamic",
      args: {
        userData: {
          material: getRandomMaterialType(),
          coordinates: { x: centerX, y: topY, z: centerZ },
          voxelType: 'special',
          note: 'center cube'
        }
      }

    });
    
    positions.push(additionalPosition);
    
    originalPositions.current = positions;
    setPlanetReady(true);
    
    return out;
  }, [VOXEL_SIZE]); 
  const totalVoxels = CUBE_SIZE_X * CUBE_SIZE_Y * CUBE_SIZE_Z + 1; // +1 for the additional cube
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