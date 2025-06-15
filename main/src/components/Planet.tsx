import { useMemo, useContext, useRef, useEffect, useState, memo, useCallback } from 'react';
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
import { 
  applyPhysicsOptimizations, 
  monitorPhysicsPerformance, 
  getPhysicsPerformanceStats,
  optimizeTerrainColliders,
  DEFAULT_PHYSICS_CONFIG 
} from '../utils/physicsOptimization';

// Create material once - using MeshStandardMaterial for emissive glow effects
const voxelMaterial = new THREE.MeshStandardMaterial({ 
  color: "#ffffff", // White so instance colors show properly
  transparent: true, // Enable transparency for voxel deletion
  alphaTest: 0.1, // Don't render pixels with alpha below 0.1
  roughness: 200, // Slightly rough for realistic look
  metalness: 0.1 // Slightly metallic for oresl
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
  // NEW: Track mapping between original indices and compact visual indices
  originalToCompact: new Map<number, number>(),
  compactToOriginal: new Map<number, number>(),
  // NEW: Function to rebuild compact layout
  rebuildCompactLayout: null as ((mesh: THREE.InstancedMesh, instances: any[], colors: THREE.Color[]) => void) | null,
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
  
  // OPTIMIZATION: Only allocate GPU memory for exposed voxels + buffer for future expansion
  const exposedVoxelCount = useMemo(() => {
    return instances.length > 0 ? instances.filter((inst: any) => inst.userData?.isExposed).length : 0;
  }, [instances]);
  
  // Allocate buffer size with 20% extra for dynamic voxel exposure during gameplay
  const optimizedBufferSize = Math.max(exposedVoxelCount + Math.floor(exposedVoxelCount * 0.2), 1000);
  
  console.log(`🎯 GPU OPTIMIZATION: Exposed=${exposedVoxelCount}, Buffer=${optimizedBufferSize}, Saved=${voxelSystem.maxInstances - optimizedBufferSize} instances`);
  
  const totalVoxels = optimizedBufferSize; // Use optimized buffer size instead of maxInstances

  // Set colors and textures on the instanced mesh when ready - OPTIMIZED for compact layout
  useEffect(() => {
    if (instancedMeshRef.current && instanceColors.length > 0 && materialsLoaded) {
      // OPTIMIZATION: Only set colors for exposed voxels in compact arrangement
      let compactColorIndex = 0;
      instances.forEach((instance: any, originalIndex: number) => {
        if (instance.userData?.isExposed && instanceColors[originalIndex]) {
          instancedMeshRef.current!.setColorAt(compactColorIndex, instanceColors[originalIndex]);
          compactColorIndex++;
        }
      });
      if (instancedMeshRef.current.instanceColor) {
        instancedMeshRef.current.instanceColor.needsUpdate = true;
      }
      
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
            debugIndex: index,
            // Add performance tracking data
            isOptimized: true,
            canSleep: true,
            lastActivity: Date.now()
          };
          body.userData = userData;
        }
    });
    
    // Apply comprehensive physics optimizations
    applyPhysicsOptimizations(rigidBodies.current, {
      ...DEFAULT_PHYSICS_CONFIG,
      enableSleeping: true,
      disableCCD: true,
      optimizeDamping: true,
      monitorPerformance: true
    });
    
    // Set up global references for raycaster access
    planetInstancedMesh.current = instancedMeshRef.current;
    planetInstanceMaterials.current = instanceMaterials;
    planetRigidBodies.current = rigidBodies.current;
    // planetGravityHook will be set externally by the component that manages gravity
    
    // Make debug function available globally
    (window as any).debugInstanceColor = debugInstanceColor;
    
    // CRITICAL OPTIMIZATION: Disable collision detection for terrain colliders
    setTimeout(() => {
      const optimizedColliders = optimizeTerrainColliders(rigidBodies.current, instances);
      console.log(`🚀 COLLIDER OPTIMIZATION: Disabled collision detection for ${optimizedColliders} terrain colliders`);
    }, 100); // Small delay to ensure colliders are fully initialized
    
    // Log detailed performance statistics
    console.log(getPhysicsPerformanceStats(rigidBodies.current));
    console.log(`🎯 PHYSICS OPTIMIZATION: Applied performance settings to ${rigidBodies.current.length} rigid bodies`);
    console.log(`⚡ SLEEP OPTIMIZATION: All bodies configured with canSleep=true for automatic performance scaling`);

  }, [planetReady, instances, instanceMaterials])

  // Create the rebuild compact layout function
  const rebuildCompactLayout = useCallback((mesh: THREE.InstancedMesh, instances: any[], colors: THREE.Color[]) => {
    const matrix = new THREE.Matrix4();
    let compactIndex = 0;
    
    // Clear previous mappings
    voxelSystem.originalToCompact.clear();
    voxelSystem.compactToOriginal.clear();
    
    // Build compact layout with proper mappings
    instances.forEach((instance: any, originalIndex: number) => {
      // Check if voxel is exposed AND not deleted
      const coordKey = voxelSystem.indexToCoordinate.get(originalIndex);
      const isExposed = (instance.userData as any)?.isExposed;
      const isDeleted = coordKey ? voxelSystem.deletedVoxels.has(coordKey) : false;
      
      if (isExposed && !isDeleted) {
        // Set position matrix
        const [x, y, z] = instance.position as [number, number, number];
        matrix.setPosition(x, y, z);
        mesh.setMatrixAt(compactIndex, matrix);
        
        // Set color
        if (colors[originalIndex]) {
          mesh.setColorAt(compactIndex, colors[originalIndex]);
        }
        
        // Update mappings
        voxelSystem.originalToCompact.set(originalIndex, compactIndex);
        voxelSystem.compactToOriginal.set(compactIndex, originalIndex);
        
        compactIndex++;
      }
    });
    
    // Update mesh properties - with null safety checks
    mesh.count = compactIndex;
    if (mesh.instanceMatrix) {
      mesh.instanceMatrix.needsUpdate = true;
    }
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
    
    console.log(`🔄 REBUILT COMPACT LAYOUT: ${compactIndex} visible voxels, ${instances.length - compactIndex} hidden/deleted`);
  }, []);

  // Set the rebuild function in voxelSystem for Player.tsx access
  useEffect(() => {
    voxelSystem.rebuildCompactLayout = rebuildCompactLayout;
  }, [rebuildCompactLayout]);

  // OPTIMIZED VISIBILITY: Initial compact layout setup
  useEffect(() => {
    if (!instancedMeshRef.current || !rigidBodies.current.length || !instances.length) return;
    
    const mesh = instancedMeshRef.current;
    rebuildCompactLayout(mesh, instances, instanceColors);
  }, [instances, instanceColors, planetReady, rebuildCompactLayout])

  // PERFORMANCE MONITORING: Track physics optimization effectiveness
  useEffect(() => {
    if (!planetReady || rigidBodies.current.length === 0) return;
    
    const monitorInterval = setInterval(() => {
      const stats = monitorPhysicsPerformance(rigidBodies.current);
      
      // Only log if there's significant activity or we want periodic updates
      if (stats.activeBodies > 0 || Date.now() % 30000 < 1000) { // Log every 30 seconds or when active
        console.log(`📊 PHYSICS MONITOR: ${stats.sleepingBodies}/${stats.totalBodies} bodies sleeping (${(stats.performanceRatio * 100).toFixed(1)}% efficiency)`);
        
        // Performance warnings
        if (stats.performanceRatio < 0.5 && stats.totalBodies > 100) {
          console.warn(`⚠️ PERFORMANCE WARNING: Only ${(stats.performanceRatio * 100).toFixed(1)}% of rigid bodies are sleeping. Consider optimizing active interactions.`);
        }
      }
    }, 5000); // Check every 5 seconds
    
    return () => clearInterval(monitorInterval);
  }, [planetReady]);

  return (
    <InstancedRigidBodies
    key={`voxels-${VOXEL_SIZE}`} 
    instances={instances}
    ref={rigidBodies}
    colliders={'cuboid'}
    type="kinematicPosition"
    ccd={false}
    canSleep={true}
    >
      <instancedMesh ref={instancedMeshRef} args={[undefined, undefined, totalVoxels]} count={totalVoxels}>
        <boxGeometry args={[VOXEL_SIZE*.99, VOXEL_SIZE*.99, VOXEL_SIZE*.99]} />
        <primitive object={voxelMaterial} attach="material" />
      </instancedMesh>
    </InstancedRigidBodies>
  );
})

export default Planet; 