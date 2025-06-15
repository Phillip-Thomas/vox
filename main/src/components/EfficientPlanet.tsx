import React, { useRef, useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { RigidBody } from '@react-three/rapier';
import { voxelSystem } from '../utils/efficientVoxelSystem';
import { MATERIALS, MaterialType } from '../types/materials';
import { ProceduralWorldGenerator } from '../utils/proceduralWorldGenerator';

// Simple material for all voxels
const voxelMaterial = new THREE.MeshStandardMaterial({ 
  color: "#ffffff", // White base so instance colors show
  roughness: 0.8,
  metalness: 0.1
});

// Export for raycasting
export const efficientPlanetMesh = { current: null as THREE.InstancedMesh | null };

// Global functions to manage collision bodies
export let addDynamicCollisionBody: ((x: number, y: number, z: number) => void) | null = null;
export let removeDynamicCollisionBody: ((x: number, y: number, z: number) => void) | null = null;

interface EfficientPlanetProps {
  size?: number; // Cube half-size in voxels (cube extends from -size to +size)
  playerPosition?: THREE.Vector3; // Player position for proximity-based collision
}

// Component for individual voxel collision
function VoxelCollisionBody({ x, y, z, onRef }: { x: number, y: number, z: number, onRef: (ref: any) => void }) {
  const ref = useRef<any>(null);
  
  useEffect(() => {
    if (ref.current) {
      onRef(ref.current);
    }
  }, [onRef]);
  
  const position: [number, number, number] = [x * 2, y * 2, z * 2];
  
  // Get voxel material for color coding the collision box
  const voxelData = voxelSystem.getVoxel(x, y, z);
  const materialColor = voxelData ? voxelData.color : new THREE.Color('red');
  
  return (
    <RigidBody
      ref={ref}
      type="fixed"
      position={position}
      colliders="cuboid"
      onCollisionEnter={() => {
        // Get voxel data to show material and color
        const voxelData = voxelSystem.getVoxel(x, y, z);
        if (voxelData) {
          const material = voxelData.material;
          const colorHex = `#${voxelData.color.getHexString()}`;
          console.log(`💥 Collision detected at (${x},${y},${z}) - Material: ${material}, Color: ${colorHex}`);
        } else {
          console.log(`💥 Collision detected at (${x},${y},${z}) - No voxel data found`);
        }
      }}
    >
      {/* Visible collision box for testing - color-coded by material */}
      <mesh visible={true}>
        <boxGeometry args={[1.98, 1.98, 1.98]} />
        <meshBasicMaterial color={materialColor} transparent opacity={0.3} />
      </mesh>
    </RigidBody>
  );
}

export default function EfficientPlanet({ size, playerPosition }: EfficientPlanetProps) {
  // Ensure size is provided - no default to force explicit configuration
  if (size === undefined) {
    throw new Error('EfficientPlanet: size prop is required - configure in EfficientScene');
  }
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const initialized = useRef(false);
  const rigidBodyRefs = useRef<Map<string, any>>(new Map()); // Store rigid body refs by coordinate
  
  // State to track ALL collision bodies (both initial and dynamic)
  const [allCollisionBodies, setAllCollisionBodies] = useState<Array<{x: number, y: number, z: number, key: string}>>([]); 
  
  // Batch collision body creation refs - moved to top level
  const pendingCollisionBodies = useRef<Array<{x: number, y: number, z: number}>>([]);
  const batchTimeout = useRef<number | null>(null);
  const linkedCount = useRef(0);
  
  // DO NOT CHANGE THIS VALUE
  const COLLISION_RANGE = 5;
  const lastUpdatePosition = useRef<THREE.Vector3 | null>(null);
  
  // Function to check if a voxel is within collision range of player
  const isWithinCollisionRange = (voxelX: number, voxelY: number, voxelZ: number): boolean => {
    if (!playerPosition) return true; // If no player position, create all collision bodies
    
    // Convert voxel coordinates to world coordinates (voxels are at 2x scale)
    const voxelWorldX = voxelX * 2;
    const voxelWorldY = voxelY * 2;
    const voxelWorldZ = voxelZ * 2;
    
    // Calculate distance from player to voxel
    const distance = Math.sqrt(
      Math.pow(playerPosition.x - voxelWorldX, 2) +
      Math.pow(playerPosition.y - voxelWorldY, 2) +
      Math.pow(playerPosition.z - voxelWorldZ, 2)
    );
    
    const isInRange = distance <= COLLISION_RANGE * 2; // Multiply by 2 for world scale
    
    // CRITICAL: Don't create collision bodies too close to player (prevents getting stuck)
    // But allow collision bodies that are slightly below the player (for landing)
    const MIN_DISTANCE_FROM_PLAYER = 1.5; // Minimum 1.5 world units from player
    const tooClose = distance < MIN_DISTANCE_FROM_PLAYER;
    
    // Special case: Allow collision bodies below the player (for landing)
    const isBelow = voxelWorldY < (playerPosition.y - 2); // 2 units below player
    const allowBelowPlayer = isBelow && distance < 4; // Allow within 4 units if below
    
    // Final decision: in range AND (not too close OR allowed below player)
    const shouldCreate = isInRange && (!tooClose || allowBelowPlayer);
    
    return shouldCreate;
  };
  
  // Generate complete original terrain (all voxels that should exist in the cube)
  const originalTerrain = useMemo(() => {
    const terrain: Array<{x: number, y: number, z: number, material: MaterialType, color: THREE.Color}> = [];
    const generator = new ProceduralWorldGenerator();
    
    // Generate ALL voxels within the cube (not just exposed ones)
    // Cube extends from -size to +size in all dimensions
    for (let x = -size; x <= size; x++) {
      for (let y = -size; y <= size; y++) {
        for (let z = -size; z <= size; z++) {
          // All positions within the cube bounds are part of the original terrain
          const material = generator.generateMaterialForPosition(x, y, z);
          const color = MATERIALS[material].color.clone();
          terrain.push({ x, y, z, material, color });
        }
      }
    }
    
    console.log(`🧊 Generated complete original terrain with ${terrain.length} voxels (cube size: ${size*2+1}³)`);
    return terrain;
  }, [size]);

  // Generate initial exposed voxels (only the ones that should be visible)
  const initialVoxels = useMemo(() => {
    const voxels: Array<{x: number, y: number, z: number, material: MaterialType, color: THREE.Color}> = [];
    
    // Only generate exposed voxels from the original terrain
    for (const terrainVoxel of originalTerrain) {
      const isExposed = isVoxelExposed(terrainVoxel.x, terrainVoxel.y, terrainVoxel.z, size);
      
      if (isExposed) {
        voxels.push({ 
          x: terrainVoxel.x, 
          y: terrainVoxel.y, 
          z: terrainVoxel.z, 
          material: terrainVoxel.material, 
          color: terrainVoxel.color 
        });
      }
    }
    
    console.log(`🧊 Generated ${voxels.length} exposed voxels from ${originalTerrain.length} original terrain voxels`);
    console.log(`📊 Voxel Stats: CubeSize=${size*2+1}, Surface=${voxels.length}, Total=${originalTerrain.length}, Surface%=${((voxels.length/originalTerrain.length)*100).toFixed(1)}%`);
    
    return voxels;
  }, [size, originalTerrain]);
  
  // Calculate dynamic buffer size based on ACTUAL exposed voxel count (not estimation)
  const dynamicBufferSize = useMemo(() => {
    // Validate size input
    if (!size || size <= 0) {
      console.error(`❌ Invalid planet size: ${size}. Using fallback.`);
      return 5000; // Fallback size
    }
    
    // Use the ACTUAL exposed voxel count instead of estimation
    const actualSurfaceVoxels = initialVoxels.length;
    
    if (actualSurfaceVoxels === 0) {
      // Fallback to estimation if initialVoxels hasn't been calculated yet
      // For a cube, surface area = 6 * (2*size+1)² - but account for edges/corners
      const cubeSize = size * 2 + 1;
      const estimatedSurfaceVoxels = Math.max(6 * cubeSize * cubeSize - 12 * cubeSize + 8, 1000);
      const expansionBuffer = Math.floor(estimatedSurfaceVoxels * 0.5);
      const totalSize = estimatedSurfaceVoxels + expansionBuffer;
      
      console.log(`🎯 DYNAMIC BUFFER (ESTIMATED): CubeSize=${cubeSize}, EstimatedSurface=${estimatedSurfaceVoxels}, Buffer=${expansionBuffer}, Total=${totalSize}`);
      return totalSize;
    }
    
    // Calculate buffer based on actual surface voxel count
    const expansionBuffer = Math.floor(actualSurfaceVoxels * 0.3); // 30% buffer for dynamic growth
    const totalSize = actualSurfaceVoxels + expansionBuffer;
    
    console.log(`🎯 DYNAMIC BUFFER (ACTUAL): CubeSize=${size*2+1}, ActualSurface=${actualSurfaceVoxels}, Buffer=${expansionBuffer}, Total=${totalSize}`);
    
    // Final validation - never return 0
    if (totalSize <= 0) {
      console.error(`❌ Calculated buffer size is ${totalSize}. Using emergency fallback.`);
      return 5000;
    }
    
    return totalSize;
  }, [size, initialVoxels.length]); // Depends on both size AND actual voxel count

  // Initialize the voxel system
  useEffect(() => {
    if (!meshRef.current || initialized.current) return;
    
    // CRITICAL: Verify mesh capacity before using it
    const actualCapacity = meshRef.current.instanceMatrix?.count || 0;
    console.log(`🔍 MESH VERIFICATION: instancedMesh.count = ${meshRef.current.count} (render count), actualCapacity = ${actualCapacity}, dynamicBufferSize = ${dynamicBufferSize}`);
    
    if (actualCapacity === 0) {
      console.error(`❌ CRITICAL ERROR: Mesh was created with 0 capacity! This will cause slot allocation failures.`);
      console.error(`🔧 Expected capacity: ${dynamicBufferSize}, Actual capacity: ${actualCapacity}`);
    } else if (actualCapacity < dynamicBufferSize) {
      console.warn(`⚠️ CAPACITY MISMATCH: Expected ${dynamicBufferSize}, got ${actualCapacity}`);
    } else {
      console.log(`✅ MESH CAPACITY OK: ${actualCapacity} slots allocated`);
    }
    
    // Configure the voxel system with dynamic capacity
    voxelSystem.expandCapacity(dynamicBufferSize);
    voxelSystem.setMesh(meshRef.current);
    voxelSystem.setOriginalTerrain(originalTerrain);
    efficientPlanetMesh.current = meshRef.current;
    
    // Batch collision body creation function
    const flushPendingCollisionBodies = () => {
      if (pendingCollisionBodies.current.length > 0) {
        const toAdd = pendingCollisionBodies.current.map(body => ({
          ...body,
          key: `collision-${body.x}-${body.y}-${body.z}`
        }));
        
        setAllCollisionBodies((prev: Array<{x: number, y: number, z: number, key: string}>) => {
          // Create a set of existing collision body coordinates for fast lookup
          const existingCoords = new Set(prev.map(body => `${body.x},${body.y},${body.z}`));
          
          // Filter out bodies that already exist
          const newBodies = toAdd.filter(newBody => {
            const coordKey = `${newBody.x},${newBody.y},${newBody.z}`;
            return !existingCoords.has(coordKey);
          });
          
          if (newBodies.length > 0) {
            console.log(`🆕 Batch adding ${newBodies.length} collision bodies (filtered ${toAdd.length - newBodies.length} duplicates)`);
            return [...prev, ...newBodies];
          }
          return prev;
        });
        
        pendingCollisionBodies.current = [];
      }
    };
    
    // Set up collision body management functions
    addDynamicCollisionBody = (x: number, y: number, z: number) => {
      // Only create collision body if within range
      if (!isWithinCollisionRange(x, y, z)) {
        return; // Skip collision body creation for distant voxels
      }
      
      // Check if collision body already exists or is pending
      const coordKey = `${x},${y},${z}`;
      const existsInState = allCollisionBodies.some(body => body.x === x && body.y === y && body.z === z);
      const existsInPending = pendingCollisionBodies.current.some(body => body.x === x && body.y === y && body.z === z);
      
      if (existsInState || existsInPending) {
        console.log(`⚠️ Collision body already exists or pending at (${x}, ${y}, ${z})`);
        return;
      }
      
      // Add to pending batch
      pendingCollisionBodies.current.push({ x, y, z });
      
      // Clear existing timeout and set a new one
      if (batchTimeout.current) {
        clearTimeout(batchTimeout.current);
      }
      
      // Batch process after a short delay
      batchTimeout.current = setTimeout(flushPendingCollisionBodies, 10);
    };
    
    removeDynamicCollisionBody = (x: number, y: number, z: number) => {
      // Immediately remove from rigid body refs and disable collision
      const coordKey = `${x},${y},${z}`;
      const rigidBodyRef = rigidBodyRefs.current.get(coordKey);
      
      if (rigidBodyRef) {
        try {
          rigidBodyRef.setEnabled(false);
          console.log(`🚫 Immediately disabled collision body at (${x},${y},${z})`);
        } catch (error) {
          console.warn(`Failed to disable collision body at (${x},${y},${z}):`, error);
        }
        rigidBodyRefs.current.delete(coordKey);
      }
      
      // Remove from state (this will unmount the component)
      setAllCollisionBodies((prev: Array<{x: number, y: number, z: number, key: string}>) => {
        const filtered = prev.filter((body: {x: number, y: number, z: number, key: string}) => 
          !(body.x === x && body.y === y && body.z === z)
        );
        if (filtered.length !== prev.length) {
          console.log(`🗑️ Removed collision body at (${x},${y},${z}) from state`);
        }
        return filtered;
      });
          };
      
      // Make removal function available globally for immediate access
      (window as any).removeDynamicCollisionBody = removeDynamicCollisionBody;
      
      // Initialize collision bodies only for voxels within range of player
    // But exclude voxels too close to player spawn position to prevent getting stuck
    const playerSpawnPos = new THREE.Vector3(0, size+10, 0); // Player spawn position (above cube top)
    
    const initialCollisionBodies = initialVoxels
      .filter(voxel => {
        // Check if within collision range
        if (!isWithinCollisionRange(voxel.x, voxel.y, voxel.z)) return false;
        
        // Additional check: don't create collision bodies too close to spawn position
        const voxelWorldPos = new THREE.Vector3(voxel.x * 2, voxel.y * 2, voxel.z * 2);
        const distanceFromSpawn = playerSpawnPos.distanceTo(voxelWorldPos);
        
        // Allow collision bodies below spawn position (for landing)
        const isBelowSpawn = voxel.y * 2 < (playerSpawnPos.y - 3); // 3 units below spawn
        const minSpawnDistance = isBelowSpawn ? 2 : 3; // Closer if below spawn
        
        if (distanceFromSpawn < minSpawnDistance) {
          console.log(`🚫 Skipping collision body at (${voxel.x},${voxel.y},${voxel.z}) - too close to spawn (${distanceFromSpawn.toFixed(1)} units, isBelowSpawn: ${isBelowSpawn})`);
          return false;
        }
        
        return true;
      })
      .map(voxel => ({
        x: voxel.x,
        y: voxel.y,
        z: voxel.z,
        key: `collision-${voxel.x}-${voxel.y}-${voxel.z}`
      }));
    setAllCollisionBodies(initialCollisionBodies);
    
    console.log(`🎯 Creating collision bodies for ${initialCollisionBodies.length}/${initialVoxels.length} voxels within range (spawn-safe)`);;
    
    // Add all initial voxels (collision bodies will be linked when they're created)
    let addedCount = 0;
    let failedCount = 0;
    
    console.log(`🚀 INITIALIZATION: Adding ${initialVoxels.length} initial voxels to system with ${dynamicBufferSize} allocated slots`);
    
    for (const voxel of initialVoxels) {
      const success = voxelSystem.addVoxel(voxel.x, voxel.y, voxel.z, voxel.material, voxel.color);
      if (success) {
        addedCount++;
      } else {
        failedCount++;
        
        // Log detailed failure info occasionally, not on every failure
        if (failedCount === 1 || failedCount % 1000 === 0) {
          console.warn(`⚠️ Voxel slot allocation failure #${failedCount} at (${voxel.x}, ${voxel.y}, ${voxel.z})`);
          console.warn(`📊 Progress: ${addedCount} added, ${failedCount} failed, ${initialVoxels.length - addedCount - failedCount} remaining`);
        }
      }
    }
    
    console.log(`✅ VISUAL RENDERING: Added ${addedCount}/${initialVoxels.length} voxels to efficient system`);
    if (failedCount > 0) {
      console.error(`❌ VISUAL RENDERING: Failed to add ${failedCount} voxels due to insufficient slots`);
      console.error(`🔍 This means ${failedCount} surface voxels will be invisible!`);
    }
    
    console.log(`🎯 COLLISION SYSTEM: ${initialCollisionBodies.length}/${initialVoxels.length} voxels have collision bodies`);
    console.log(`📏 COLLISION RANGE: Only voxels within ${COLLISION_RANGE} units of player get collision`);
    console.log('📊 Final system stats:', voxelSystem.getStats());
    
    initialized.current = true;
  }, [initialVoxels]);
  
  // Update collision bodies when player position changes
  useEffect(() => {
    if (!playerPosition || !initialized.current) return;
    
    // Check if player has moved significantly (at least 1 unit)
    const hasMovedSignificantly = !lastUpdatePosition.current || 
      lastUpdatePosition.current.distanceTo(playerPosition) > 1.0;
    
    if (!hasMovedSignificantly) return;
    
    lastUpdatePosition.current = playerPosition.clone();
    
    // Get all current voxels
    const allVoxels = voxelSystem.getAllVoxels();
    const currentCollisionBodies = new Set(allCollisionBodies.map(body => `${body.x},${body.y},${body.z}`));
    
    // Determine which voxels should have collision bodies
    const shouldHaveCollision = new Set<string>();
    let checkedCount = 0;
    let inRangeCount = 0;
    
    for (const [coordKey, voxelData] of allVoxels) {
      const [x, y, z] = coordKey.split(',').map(Number);
      checkedCount++;
      
      if (isWithinCollisionRange(x, y, z)) {
        // Verify the voxel actually exists visually (has a mesh slot)
        if (voxelData.meshSlot !== -1) {
          shouldHaveCollision.add(coordKey);
          inRangeCount++;
        } else {
          console.log(`⚠️ Voxel at (${x},${y},${z}) is in range but has no visual representation (meshSlot: ${voxelData.meshSlot})`);
        }
      }
    }
    
    if (checkedCount > 0) {
      console.log(`🔍 Checked ${checkedCount} voxels, ${inRangeCount} in range and visually present`);
    }
    
    // Find bodies to add and remove
    const toAdd: Array<{x: number, y: number, z: number}> = [];
    const toRemove: Array<{x: number, y: number, z: number}> = [];
    
    // Bodies to add (voxels that should have collision but don't)
    for (const coordKey of shouldHaveCollision) {
      if (!currentCollisionBodies.has(coordKey)) {
        const [x, y, z] = coordKey.split(',').map(Number);
        toAdd.push({x, y, z});
      }
    }
    
    // Bodies to remove (collision bodies that are now out of range)
    for (const body of allCollisionBodies) {
      const coordKey = `${body.x},${body.y},${body.z}`;
      if (!shouldHaveCollision.has(coordKey)) {
        toRemove.push({x: body.x, y: body.y, z: body.z});
      }
    }
    
    // Apply changes
    if (toAdd.length > 0 || toRemove.length > 0) {
      setAllCollisionBodies(prev => {
        let updated = [...prev];
        
        // Remove out-of-range bodies first
        for (const remove of toRemove) {
          updated = updated.filter(body => 
            !(body.x === remove.x && body.y === remove.y && body.z === remove.z)
          );
          
          // Also remove from rigid body refs
          const coordKey = `${remove.x},${remove.y},${remove.z}`;
          rigidBodyRefs.current.delete(coordKey);
        }
        
        // Create a set of remaining coordinates to prevent duplicates
        const remainingCoords = new Set(updated.map(body => `${body.x},${body.y},${body.z}`));
        
        // Add new bodies only if they don't already exist
        for (const add of toAdd) {
          const coordKey = `${add.x},${add.y},${add.z}`;
          if (!remainingCoords.has(coordKey)) {
            updated.push({
              x: add.x,
              y: add.y,
              z: add.z,
              key: `collision-${add.x}-${add.y}-${add.z}`
            });
            remainingCoords.add(coordKey);
          }
        }
        
        if (toAdd.length > 0 || toRemove.length > 0) {
          console.log(`🔄 Updated collision bodies: +${toAdd.length}, -${toRemove.length} (total: ${updated.length}) at player pos (${playerPosition.x.toFixed(1)}, ${playerPosition.y.toFixed(1)}, ${playerPosition.z.toFixed(1)})`);
          
          // Debug: Show some of the added collision bodies
          if (toAdd.length > 0) {
            const sampleAdded = toAdd.slice(0, 3);
            console.log(`📍 Sample added collision bodies:`, sampleAdded.map(v => `(${v.x},${v.y},${v.z})`).join(', '));
            
            // Debug: Check if these collision bodies have corresponding visual voxels
            for (const add of sampleAdded) {
              const voxelData = voxelSystem.getVoxel(add.x, add.y, add.z);
              if (voxelData) {
                console.log(`🔍 Collision body (${add.x},${add.y},${add.z}) -> Visual voxel meshSlot: ${voxelData.meshSlot}`);
              } else {
                console.log(`❌ Collision body (${add.x},${add.y},${add.z}) -> NO VISUAL VOXEL FOUND`);
              }
            }
          }
        }
        
        return updated;
      });
    }
  }, [playerPosition]); // Remove allCollisionBodies dependency to allow more frequent updates
  
  // Debug: Log buffer size at render time
  console.log(`🎯 RENDER TIME: dynamicBufferSize = ${dynamicBufferSize} for cube size ${size*2+1}³`);

  return (
    <>
      {/* Visual representation - instanced mesh for performance */}
      <instancedMesh 
        ref={meshRef} 
        args={[undefined, undefined, dynamicBufferSize]} // Dynamic buffer size based on planet
        count={0} // Will be updated by voxel system
      >
        <boxGeometry args={[1.98, 1.98, 1.98]} />
        <primitive object={voxelMaterial} attach="material" />
      </instancedMesh>
      
      {/* All collision bodies - Managed by voxel system */}
      {allCollisionBodies.map((body: {x: number, y: number, z: number, key: string}) => (
        <VoxelCollisionBody
          key={body.key}
          x={body.x}
          y={body.y}
          z={body.z}
          onRef={(ref) => {
            const coordKey = `${body.x},${body.y},${body.z}`;
            rigidBodyRefs.current.set(coordKey, ref);
            
            // Update voxel system with rigid body reference if voxel exists
            const voxelData = voxelSystem.getVoxel(body.x, body.y, body.z);
            if (voxelData) {
              voxelData.rigidBodyRef = ref;
              linkedCount.current++;
            
            } 
            
          }}
        />
      ))}
    </>
  );
}

// Helper function to determine if a voxel should be exposed
function isVoxelExposed(x: number, y: number, z: number, cubeSize: number): boolean {
  const neighbors = [
    [x+1, y, z], [x-1, y, z],
    [x, y+1, z], [x, y-1, z],
    [x, y, z+1], [x, y, z-1]
  ];
  
  // Check if any neighbor is outside the cube bounds
  for (const [nx, ny, nz] of neighbors) {
    // If neighbor is outside cube bounds (-cubeSize to +cubeSize), this voxel is exposed
    if (nx < -cubeSize || nx > cubeSize || 
        ny < -cubeSize || ny > cubeSize || 
        nz < -cubeSize || nz > cubeSize) {
      return true;
    }
  }
  
  return false;
} 