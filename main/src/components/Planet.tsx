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

// Create metallic material for metal blocks
const metallicVoxelMaterial = new THREE.MeshStandardMaterial({
  color: "#ffffff",
  transparent: true,
  alphaTest: 0.1,
  roughness: 0.1, // Low roughness for shine
  metalness: 0.9, // High metalness for reflectivity
  emissive: new THREE.Color(0x000000), // Will be set per instance
  emissiveIntensity: 0.3
});

// Create glowing material for valuable blocks
const glowingVoxelMaterial = new THREE.MeshStandardMaterial({
  color: "#ffffff",
  transparent: true,
  alphaTest: 0.1,
  roughness: 0.05, // Very low roughness for maximum shine
  metalness: 1.0, // Maximum metalness
  emissive: new THREE.Color(0x000000), // Will be set per instance
  emissiveIntensity: 0.4
});

// MEMORY LEAK FIX: Create shared geometries to prevent recreation
// Note: We'll create properly sized geometries and update them when voxel size changes
let voxelGeometry = new THREE.BoxGeometry(1, 1, 1);
let metallicVoxelGeometry = new THREE.BoxGeometry(1.01, 1.01, 1.01);
let glowingVoxelGeometry = new THREE.BoxGeometry(1.01, 1.01, 1.01);

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

function Planet() {
  const { voxelSize: VOXEL_SIZE } = useContext(PlanetContext);
  const rigidBodies = useRef<RapierRigidBody[]>([]);
  const instancedMeshRef = useRef<THREE.InstancedMesh>(null);
  const [planetReady, setPlanetReady] = useState(false);

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
    
    // Add the additional center cube position
    const centerX = Math.floor(CUBE_SIZE_X / 2);
    const centerZ = Math.floor(CUBE_SIZE_Z / 2);
    const topY = CUBE_SIZE_Y;
    voxelSystem.allVoxels.add(`${centerX},${topY},${centerZ}`);

  }, [VOXEL_SIZE]);

  // State for materials, colors, and textures
  const [instanceColors, setInstanceColors] = useState<THREE.Color[]>([]);
  const [instanceMaterials, setInstanceMaterials] = useState<MaterialType[]>([]);
  const [instanceTextures, setInstanceTextures] = useState<(THREE.Texture | null)[]>([]);
  const [materialsLoaded, setMaterialsLoaded] = useState(false);
  
  // State for glowing voxels
  const [glowingVoxels, setGlowingVoxels] = useState<{
    positions: THREE.Vector3[];
    colors: THREE.Color[];
    emissiveColors: THREE.Color[];
    indices: number[];
  }>({ positions: [], colors: [], emissiveColors: [], indices: [] });

  // State for separating metallic vs non-metallic voxels
  const [metallicVoxels, setMetallicVoxels] = useState<{
    positions: THREE.Vector3[];
    colors: THREE.Color[];
    emissiveColors: THREE.Color[];
    indices: number[];
    materials: MaterialType[];
  }>({ positions: [], colors: [], emissiveColors: [], indices: [], materials: [] });

  const [nonMetallicVoxels, setNonMetallicVoxels] = useState<{
    positions: THREE.Vector3[];
    colors: THREE.Color[];
    indices: number[];
    materials: MaterialType[];
  }>({ positions: [], colors: [], indices: [], materials: [] });

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
  const { instances, hiddenVoxels } = useMemo(() => {
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
    return { instances: result.instances, hiddenVoxels: result.hiddenVoxels };
  }, [VOXEL_SIZE]); 
  
  const totalVoxels = voxelSystem.maxInstances; // Use max instances for dynamic expansion

  // MEMORY LEAK FIX: Disable glowing voxels feature to save massive memory
  // This was creating thousands of Vector3 and Color objects every time materials changed
  // Comment out the entire glowing voxels processing for now
  /*
  useEffect(() => {
    if (!materialsLoaded || !instances.length || !instanceMaterials.length) return;
    
    const glowingData = {
      positions: [] as THREE.Vector3[],
      colors: [] as THREE.Color[],
      emissiveColors: [] as THREE.Color[],
      indices: [] as number[]
    };
    
    instanceMaterials.forEach((materialType, index) => {
      const material = MATERIALS[materialType];
      if (material.emissive && material.emissiveIntensity && material.emissiveIntensity > 0) {
        // This is a glowing voxel
        const coordKey = voxelSystem.indexToCoordinate.get(index);
        if (coordKey && instances[index]) {
          const [x, y, z] = coordKey.split(',').map(Number);
          const worldPos = voxelToWorldPosition(x, y, z, VOXEL_SIZE, calculateWorldOffset(VOXEL_SIZE));
          
          glowingData.positions.push(new THREE.Vector3(worldPos[0], worldPos[1], worldPos[2]));
          glowingData.colors.push(material.color.clone());
          glowingData.emissiveColors.push(material.emissive.clone());
          glowingData.indices.push(index);
        }
      }
    });
    setGlowingVoxels(glowingData);
  }, [materialsLoaded, instances, instanceMaterials, VOXEL_SIZE]);
  */

  // MEMORY LEAK FIX: Disable metallic voxels feature to save massive memory  
  // This was creating thousands of Vector3 and Color objects every time materials changed
  // Comment out the entire metallic voxels processing for now
  /*
  useEffect(() => {
    if (!materialsLoaded || !instances.length || !instanceMaterials.length) return;
    
    const metallic = {
      positions: [] as THREE.Vector3[],
      colors: [] as THREE.Color[],
      emissiveColors: [] as THREE.Color[],
      indices: [] as number[],
      materials: [] as MaterialType[]
    };
    
    const nonMetallic = {
      positions: [] as THREE.Vector3[],
      colors: [] as THREE.Color[],
      indices: [] as number[],
      materials: [] as MaterialType[]
    };
    
    instanceMaterials.forEach((materialType, index) => {
      const material = MATERIALS[materialType];
      const isMetallic = materialType === MaterialType.COPPER || 
                        materialType === MaterialType.SILVER || 
                        materialType === MaterialType.GOLD;
      
      const coordKey = voxelSystem.indexToCoordinate.get(index);
      if (coordKey && instances[index]) {
        const [x, y, z] = coordKey.split(',').map(Number);
        const worldPos = voxelToWorldPosition(x, y, z, VOXEL_SIZE, calculateWorldOffset(VOXEL_SIZE));
        const position = new THREE.Vector3(worldPos[0], worldPos[1], worldPos[2]);
        
        if (isMetallic) {
          metallic.positions.push(position);
          metallic.colors.push(material.color.clone());
          metallic.emissiveColors.push(material.emissive?.clone() || new THREE.Color(0x000000));
          metallic.indices.push(index);
          metallic.materials.push(materialType);
        } else {
          nonMetallic.positions.push(position);
          nonMetallic.colors.push(material.color.clone());
          nonMetallic.indices.push(index);
          nonMetallic.materials.push(materialType);
        }
      }
    });
    

    setMetallicVoxels(metallic);
    setNonMetallicVoxels(nonMetallic);
  }, [materialsLoaded, instances, instanceMaterials, VOXEL_SIZE]);
  */

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
      {/* Regular non-metallic voxels */}
      <instancedMesh ref={instancedMeshRef} args={[undefined, undefined, totalVoxels]} count={totalVoxels}>
        <boxGeometry args={[VOXEL_SIZE*.99, VOXEL_SIZE*.99, VOXEL_SIZE*.99]} />
        <primitive object={voxelMaterial} attach="material" />
      </instancedMesh>
      
      {/* MEMORY LEAK FIX: Disabled to save massive memory usage */}
      {/* <MetallicVoxels metallicVoxels={metallicVoxels} voxelSize={VOXEL_SIZE} /> */}
      {/* <GlowingVoxels glowingVoxels={glowingVoxels} voxelSize={VOXEL_SIZE} /> */}
    </InstancedRigidBodies>
  );
}

// Glowing Voxels Component
function GlowingVoxels({ glowingVoxels, voxelSize }: { 
  glowingVoxels: { positions: THREE.Vector3[]; colors: THREE.Color[]; emissiveColors: THREE.Color[]; indices: number[] };
  voxelSize: number;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  

  
  useEffect(() => {
    if (!meshRef.current || glowingVoxels.positions.length === 0) return;
    
    const mesh = meshRef.current;
    const matrix = new THREE.Matrix4();
    
    // Set positions and colors for each glowing voxel
    glowingVoxels.positions.forEach((position, index) => {
      matrix.setPosition(position);
      mesh.setMatrixAt(index, matrix);
      mesh.setColorAt(index, glowingVoxels.colors[index]);
    });
    
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    
    // Set emissive color on the material (we'll use the first emissive color as base)
    if (glowingVoxels.emissiveColors.length > 0) {
      const material = mesh.material as THREE.MeshStandardMaterial;
      material.emissive = glowingVoxels.emissiveColors[0];
      material.emissiveIntensity = 0.3;
    }
  }, [glowingVoxels, voxelSize]);
  
  // Add subtle pulsing animation - OPTIMIZED: Use useFrame instead of separate RAF loop
  useFrame(() => {
    if (!meshRef.current || glowingVoxels.positions.length === 0) return;
    
    const material = meshRef.current.material as THREE.MeshStandardMaterial;
    const time = Date.now() * 0.003; // Slightly faster pulsing
    const intensity = 0.3 + Math.sin(time) * 0.2; // Pulse between 0.1 and 0.5
    material.emissiveIntensity = intensity;
  });
  
  if (glowingVoxels.positions.length === 0) return null;
  
  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, glowingVoxels.positions.length]} count={glowingVoxels.positions.length}>
      <boxGeometry args={[voxelSize * 1.01, voxelSize * 1.01, voxelSize * 1.01]} />
      <primitive object={glowingVoxelMaterial} attach="material" />
    </instancedMesh>
  );
}

// Metallic Voxels Component
function MetallicVoxels({ metallicVoxels, voxelSize }: { 
  metallicVoxels: { positions: THREE.Vector3[]; colors: THREE.Color[]; emissiveColors: THREE.Color[]; indices: number[]; materials: MaterialType[] };
  voxelSize: number;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  

  
  // useEffect(() => {
  //   if (!meshRef.current || metallicVoxels.positions.length === 0) return;
    
  //   const mesh = meshRef.current;
  //   const matrix = new THREE.Matrix4();
    
  //   // Set positions and colors for each metallic voxel
  //   metallicVoxels.positions.forEach((position, index) => {
  //     matrix.setPosition(position);
  //     mesh.setMatrixAt(index, matrix);
  //     mesh.setColorAt(index, metallicVoxels.colors[index]);
  //   });
    
  //   mesh.instanceMatrix.needsUpdate = true;
  //   if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    
  //   // Set emissive color on the material (we'll use the first emissive color as base)
  //   if (metallicVoxels.emissiveColors.length > 0) {
  //     const material = mesh.material as THREE.MeshStandardMaterial;
  //     material.emissive = metallicVoxels.emissiveColors[0];
  //     material.emissiveIntensity = 0.3;
      
  //     // Adjust material properties based on the dominant metal type
  //     const dominantMetal = metallicVoxels.materials[0];
  //     if (dominantMetal === MaterialType.GOLD) {
  //       material.metalness = 1.0;
  //       material.roughness = 0.05;
  //       material.emissiveIntensity = 0.6;
  //     } else if (dominantMetal === MaterialType.SILVER) {
  //       material.metalness = 0.95;
  //       material.roughness = 0.08;
  //       material.emissiveIntensity = 0.55;
  //     } else if (dominantMetal === MaterialType.COPPER) {
  //       material.metalness = 0.9;
  //       material.roughness = 0.1;
  //       material.emissiveIntensity = 0.5;
  //     }
  //   }
  // }, [metallicVoxels, voxelSize]);
  
  // // Add subtle pulsing animation - OPTIMIZED: Use useFrame instead of separate RAF loop
  // useFrame(() => {
  //   if (!meshRef.current || metallicVoxels.positions.length === 0) return;
    
  //   const material = meshRef.current.material as THREE.MeshStandardMaterial;
  //   const time = Date.now() * 0.003; // Slightly faster pulsing
  //   const intensity = 0.3 + Math.sin(time) * 0.2; // Pulse between 0.1 and 0.5
  //   material.emissiveIntensity = intensity;
  // });
  
  if (metallicVoxels.positions.length === 0) return null;
  
  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, metallicVoxels.positions.length]} count={metallicVoxels.positions.length}>
      <boxGeometry args={[voxelSize * 1.01, voxelSize * 1.01, voxelSize * 1.01]} />
      <primitive object={metallicVoxelMaterial} attach="material" />
    </instancedMesh>
  );
}

export default memo(Planet); 