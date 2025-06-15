import { useMemo, useContext, useRef, useEffect, useState, memo } from 'react';
import * as THREE from 'three';
import { CuboidCollider, InstancedRigidBodies, InstancedRigidBodyProps, RapierRigidBody} from '@react-three/rapier';
import { PlanetContext } from '../context/PlanetContext';
import { generateVoxelInstances } from '../utils/instanceGenerator';
import { generateInstanceMaterials } from '../utils/materialGenerator';
import { 
  CUBE_SIZE_X, 
  CUBE_SIZE_Y, 
  CUBE_SIZE_Z,
  isVoxelExposed,
  voxelToWorldPosition,
  calculateWorldOffset
} from '../utils/voxelUtils';
import { getRandomMaterialType } from '../types/materials';

// Create material once - using MeshStandardMaterial for roughness/metalness properties
const voxelMaterial = new THREE.MeshStandardMaterial({ 
  color: "#ffffff", // Changed to white so instance colors show properly
  roughness: 0.7,
  metalness: 0.1,
  transparent: true, // Enable transparency for voxel deletion
  alphaTest: 0.1 // Don't render pixels with alpha below 0.1
});

// Export refs for raycaster access
export const planetInstancedMesh = { current: null as THREE.InstancedMesh | null };
export const planetInstanceMaterials = { current: [] as any[] };
export const planetRigidBodies = { current: [] as RapierRigidBody[] };
export const planetGravityHook = { current: null as any };

// Global voxel management system
export const voxelSystem = {
  // Track which voxel coordinates exist in the world (including deleted ones)
  allVoxels: new Set<string>(), // "x,y,z" format
  // Track which voxels are currently deleted
  deletedVoxels: new Set<string>(), // "x,y,z" format
  // Map from coordinate string to instance index
  coordinateToIndex: new Map<string, number>(),
  // Map from instance index to coordinate string
  indexToCoordinate: new Map<number, string>(),
  // Track maximum instance count for dynamic expansion
  maxInstances: 0,
};

function Planet() {
  const { voxelSize: VOXEL_SIZE } = useContext(PlanetContext);
  const rigidBodies = useRef<RapierRigidBody[]>([]);
  const instancedMeshRef = useRef<THREE.InstancedMesh>(null);
  const [planetReady, setPlanetReady] = useState(false);
  console.log("voxel size", VOXEL_SIZE)
  // Store original positions for reset
  const originalPositions = useRef<[number, number, number][]>([]);
  
  // Initialize the global voxel system
  useEffect(() => {
    // Clear and rebuild the voxel system data
    voxelSystem.allVoxels.clear();
    voxelSystem.deletedVoxels.clear();
    voxelSystem.coordinateToIndex.clear();
    voxelSystem.indexToCoordinate.clear();
    
    // Populate all possible voxel positions
    for (let x = 0; x < CUBE_SIZE_X; x++) {
      for (let y = 0; y < CUBE_SIZE_Y; y++) {
        for (let z = 0; z < CUBE_SIZE_Z; z++) {
          voxelSystem.allVoxels.add(`${x},${y},${z}`);
        }
      }
    }
    
    console.log("Voxel system initialized with", voxelSystem.allVoxels.size, "total voxels");
  }, [VOXEL_SIZE]);

  // Generate materials and colors for each instance
  const { instanceColors, instanceMaterials } = useMemo(() => {
    return generateInstanceMaterials(VOXEL_SIZE);
  }, [VOXEL_SIZE]);

  // Create instances data for InstancedRigidBodies
  const { instances, hiddenVoxels } = useMemo(() => {
    const result = generateVoxelInstances(VOXEL_SIZE);
    originalPositions.current = result.originalPositions;
    
    // Build coordinate mapping for ALL voxels (both visible and hidden)
    result.instances.forEach((instance, index) => {
      if (instance.userData?.coordinates) {
        const { x, y, z } = (instance.userData as any).coordinates;
        const coordKey = `${x},${y},${z}`;
        voxelSystem.coordinateToIndex.set(coordKey, index);
        voxelSystem.indexToCoordinate.set(index, coordKey);
      }
    });
    
    voxelSystem.maxInstances = result.instances.length;
    setPlanetReady(true);
    return { instances: result.instances, hiddenVoxels: result.hiddenVoxels };
  }, [VOXEL_SIZE]); 
  
  const totalVoxels = voxelSystem.maxInstances; // Use max instances for dynamic expansion
  console.log("Total voxel slots:", totalVoxels);

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
        }
    });
    
    // Set up global references for raycaster access
    planetInstancedMesh.current = instancedMeshRef.current;
    planetInstanceMaterials.current = instanceMaterials;
    planetRigidBodies.current = rigidBodies.current;
    // planetGravityHook will be set externally by the component that manages gravity
    
    console.log("Planet references updated");
  }, [planetReady, instances, instanceMaterials])

  return (
    <InstancedRigidBodies
    key={`voxels-${VOXEL_SIZE}`} 
    instances={instances}
    ref={rigidBodies}
    colliders={'cuboid'}
    type="fixed"
    >
      <instancedMesh ref={instancedMeshRef} args={[undefined, undefined, totalVoxels]} count={totalVoxels}>
        <boxGeometry args={[VOXEL_SIZE*.99, VOXEL_SIZE*.99, VOXEL_SIZE*.99]} />
        <primitive object={voxelMaterial} attach="material" />
        {/* <CuboidCollider args={[VOXEL_SIZE * 0.5, VOXEL_SIZE * 0.5, VOXEL_SIZE * 0.5]} /> */}

      </instancedMesh>
    </InstancedRigidBodies>
  );
}

export default memo(Planet); 