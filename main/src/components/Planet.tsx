import { useMemo, useContext, useRef, useEffect, useState, memo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, InstancedRigidBodies, InstancedRigidBodyProps, RapierRigidBody} from '@react-three/rapier';
import { PlanetContext } from '../context/PlanetContext';
import { generateVoxelInstances } from '../utils/instanceGenerator';
import { generateInstanceMaterials } from '../utils/materialGenerator';
import { MaterialType, MATERIALS } from '../types/materials';
import { 
  CUBE_SIZE_X, 
  CUBE_SIZE_Y, 
  CUBE_SIZE_Z,
  isVoxelExposed,
  voxelToWorldPosition,
  calculateWorldOffset
} from '../utils/voxelUtils';
import { getRandomMaterialType } from '../types/materials';

// Create material once - using MeshStandardMaterial for emissive glow effects
const voxelMaterial = new THREE.MeshStandardMaterial({ 
  color: "#ffffff", // White so instance colors show properly
  transparent: true, // Enable transparency for voxel deletion
  alphaTest: 0.1, // Don't render pixels with alpha below 0.1
  roughness: 200, // Slightly rough for realistic look
  metalness: 0.1 // Slightly metallic for ores
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

// Debug function to check instance color
export const debugInstanceColor = (instanceIndex: number) => {
  if (planetInstancedMesh.current) {
    const color = new THREE.Color();
    planetInstancedMesh.current.getColorAt(instanceIndex, color);
    console.log(`🔍 RETRIEVED Color for instance ${instanceIndex}: #${color.getHexString()} RGB: (${color.r}, ${color.g}, ${color.b})`);
    return color;
  }
  return null;
};

// OPTIMIZATION 1: Memoize Planet component to prevent unnecessary re-renders
const Planet = memo(function Planet() {
  const { voxelSize: VOXEL_SIZE } = useContext(PlanetContext);
  const rigidBodies = useRef<RapierRigidBody[]>([]);
  const instancedMeshRef = useRef<THREE.InstancedMesh>(null);
  const [planetReady, setPlanetReady] = useState(false);

  // Store original positions for reset
  const originalPositions = useRef<[number, number, number][]>([]);
  
  // OPTIMIZATION: Memoize voxel system initialization to prevent recreation
  const voxelSystemInitialized = useMemo(() => {
    // Clear and rebuild the voxel system data only when VOXEL_SIZE changes
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
    
    // Add the additional center cube position
    const centerX = Math.floor(CUBE_SIZE_X / 2);
    const centerZ = Math.floor(CUBE_SIZE_Z / 2);
    const topY = CUBE_SIZE_Y;
    voxelSystem.allVoxels.add(`${centerX},${topY},${centerZ}`);
    
    return true;
  }, [VOXEL_SIZE]);

  // State for materials, colors, and textures
  const [instanceColors, setInstanceColors] = useState<THREE.Color[]>([]);
  const [instanceMaterials, setInstanceMaterials] = useState<MaterialType[]>([]);
  const [instanceTextures, setInstanceTextures] = useState<(THREE.Texture | null)[]>([]);
  const [materialsLoaded, setMaterialsLoaded] = useState(false);

  // Generate materials and colors for each instance
  useEffect(() => {
    const loadMaterials = async () => {
      try {
        const result = await generateInstanceMaterials(VOXEL_SIZE);
        setInstanceColors(result.instanceColors);
        setInstanceMaterials(result.instanceMaterials);
        setInstanceTextures(result.instanceTextures);
        setMaterialsLoaded(true);
        
      } catch (error) {
        console.error('Failed to load materials:', error);
      }
    };
    
    loadMaterials();
  }, [VOXEL_SIZE]);
  
  // Create instances data for InstancedRigidBodies
  const { instances } = useMemo(() => {
    const result = generateVoxelInstances(VOXEL_SIZE);
    originalPositions.current = result.originalPositions;
    
    // Build coordinate mapping for ALL voxels (both visible and hidden)
    let mappedCount = 0;
    result.instances.forEach((instance, index) => {
      if (instance.userData?.coordinates) {
        const { x, y, z } = (instance.userData as any).coordinates;
        const coordKey = `${x},${y},${z}`;
        voxelSystem.coordinateToIndex.set(coordKey, index);
        voxelSystem.indexToCoordinate.set(index, coordKey);
        mappedCount++;
      }
    });
    
    // Essential voxel count information for performance analysis
    const totalVoxels = CUBE_SIZE_X * CUBE_SIZE_Y * CUBE_SIZE_Z + 1; // +1 for center cube
    const renderedVoxels = result.instances.length - result.hiddenVoxels.size;
    
    console.log(`📊 VOXEL COUNT: Total=${totalVoxels}, Rendered=${renderedVoxels}, Hidden=${result.hiddenVoxels.size}`);
    console.log(`🎯 PERFORMANCE: Rendering ${((renderedVoxels/totalVoxels)*100).toFixed(1)}% of total voxels`);
    
    // If allVoxels is still empty, repopulate it as a safeguard
    if (voxelSystem.allVoxels.size === 0) {
      for (let x = 0; x < CUBE_SIZE_X; x++) {
        for (let y = 0; y < CUBE_SIZE_Y; y++) {
          for (let z = 0; z < CUBE_SIZE_Z; z++) {
            voxelSystem.allVoxels.add(`${x},${y},${z}`);
          }
        }
      }
      // Add the additional center cube position
      const centerX = Math.floor(CUBE_SIZE_X / 2);
      const centerZ = Math.floor(CUBE_SIZE_Z / 2);
      const topY = CUBE_SIZE_Y;
      voxelSystem.allVoxels.add(`${centerX},${topY},${centerZ}`);
    }
    
    voxelSystem.maxInstances = result.instances.length;
    setPlanetReady(true);
    return { instances: result.instances };
  }, [VOXEL_SIZE]); 
  
  const totalVoxels = voxelSystem.maxInstances; // Use max instances for dynamic expansion

  // Set colors and textures on the instanced mesh when ready
  useEffect(() => {
    if (instancedMeshRef.current && instanceColors.length > 0 && materialsLoaded) {
      instanceColors.forEach((color: THREE.Color, index: number) => {
        instancedMeshRef.current!.setColorAt(index, color);
      });
      instancedMeshRef.current.instanceColor!.needsUpdate = true;
      
      // Apply texture to the material if we have textures
      if (instanceTextures.length > 0 && instanceTextures[0]) {
        // For now, use the first available texture as the base texture
        // In a more sophisticated system, you'd handle per-instance textures
        const material = instancedMeshRef.current.material as THREE.MeshStandardMaterial;
        material.map = instanceTextures[0];
        material.needsUpdate = true;
      }
    }
  }, [instanceColors, instanceTextures, materialsLoaded, planetReady]);

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
    
    // Make debug function available globally
    (window as any).debugInstanceColor = debugInstanceColor;

  }, [planetReady, instances, instanceMaterials])

  // VISIBILITY FIX: Sync instancedMesh positions with physics bodies to hide internal voxels
  useEffect(() => {
    if (!instancedMeshRef.current || !rigidBodies.current.length || !instances.length) return;
    
    const mesh = instancedMeshRef.current;
    const matrix = new THREE.Matrix4();
    
    // Set positions for each instance based on the instance data (not physics bodies)
    instances.forEach((instance, index) => {
      const [x, y, z] = instance.position as [number, number, number];
      matrix.setPosition(x, y, z);
      mesh.setMatrixAt(index, matrix);
    });
    
    mesh.instanceMatrix.needsUpdate = true;
    
    console.log(`🔧 Synced ${instances.length} voxel positions with instancedMesh`);
  }, [instances, planetReady])

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
      </instancedMesh>
    </InstancedRigidBodies>
  );
})

export default Planet; 