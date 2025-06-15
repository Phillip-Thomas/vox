import * as THREE from "three"
import { useRef, useState } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { useKeyboardControls, PerspectiveCamera } from "@react-three/drei"
// @ts-ignore - CapsuleCollider exists at runtime but not in types
import { CapsuleCollider, RigidBody, useRapier } from "@react-three/rapier"
import { planetInstancedMesh, planetInstanceMaterials, planetRigidBodies, voxelSystem } from './Planet'
import { useGravityContext } from '../App';
import { usePlayer } from '../context/PlayerContext';
import CameraControls from './CameraControls';
import { 
  CUBE_SIZE_X, 
  CUBE_SIZE_Y, 
  CUBE_SIZE_Z,
  isVoxelExposed,
  voxelToWorldPosition,
  calculateWorldOffset
} from '../utils/voxelUtils';
import { getRandomMaterialType } from '../types/materials';

const SPEED = 5

// MEMORY LEAK FIX: Create reusable objects outside component to avoid recreation
const direction = new THREE.Vector3()
const frontVector = new THREE.Vector3()
const sideVector = new THREE.Vector3()
const tempVector3 = new THREE.Vector3()
const tempVector3_2 = new THREE.Vector3()
const tempVector3_3 = new THREE.Vector3()
const tempColor = new THREE.Color()
const tempMatrix4 = new THREE.Matrix4()
const tempVoxelSet = new Set<string>()

// OPTIMIZATION 2: Memory pool for frequently used objects
const MEMORY_POOL = {
  vectors: Array.from({ length: 10 }, () => new THREE.Vector3()),
  matrices: Array.from({ length: 5 }, () => new THREE.Matrix4()),
  colors: Array.from({ length: 20 }, () => new THREE.Color()),
  vectorIndex: 0,
  matrixIndex: 0,
  colorIndex: 0,
  
  getVector(): THREE.Vector3 {
    const vector = this.vectors[this.vectorIndex];
    this.vectorIndex = (this.vectorIndex + 1) % this.vectors.length;
    return vector.set(0, 0, 0); // Reset to zero
  },
  
  getMatrix(): THREE.Matrix4 {
    const matrix = this.matrices[this.matrixIndex];
    this.matrixIndex = (this.matrixIndex + 1) % this.matrices.length;
    return matrix.identity(); // Reset to identity
  },
  
  getColor(): THREE.Color {
    const color = this.colors[this.colorIndex];
    this.colorIndex = (this.colorIndex + 1) % this.colors.length;
    return color.set(0xffffff); // Reset to white
  }
};

// Highlight colors
const HIGHLIGHT_COLOR = new THREE.Color(0x00ffff) // Cyan highlight - works well with ambient lighting
const originalColors = new Map<number, THREE.Color>() // Store original colors

// Track deleted voxels
const deletedVoxels = new Set<number>() // Track which voxels have been deleted

// Debug function to check voxel system state
const debugVoxelSystem = () => {
  console.log('🔍 Voxel System Debug Info:');
  console.log(`  - allVoxels size: ${voxelSystem.allVoxels.size}`);
  console.log(`  - deletedVoxels size: ${voxelSystem.deletedVoxels.size}`);
  console.log(`  - coordinateToIndex size: ${voxelSystem.coordinateToIndex.size}`);
  console.log(`  - indexToCoordinate size: ${voxelSystem.indexToCoordinate.size}`);
  console.log(`  - maxInstances: ${voxelSystem.maxInstances}`);
  console.log(`  - planetRigidBodies length: ${planetRigidBodies.current.length}`);
  
  // Check for consistency issues
  const allVoxelsArray = Array.from(voxelSystem.allVoxels);
  const mappedVoxels = Array.from(voxelSystem.coordinateToIndex.keys());
  const missingFromMappings = allVoxelsArray.filter(coord => !voxelSystem.coordinateToIndex.has(coord));
  
  console.log(`  - Voxels in allVoxels but not in coordinateToIndex: ${missingFromMappings.length}`);
  if (missingFromMappings.length > 0) {
    console.log(`    First 10 missing:`, missingFromMappings.slice(0, 10));
  }
};

// Make debug function available globally
(window as any).debugVoxelSystem = debugVoxelSystem;

// OPTIMIZATION 6: Enhanced raycast system with better memory management
function useVisualRaycast() {
  const raycaster = new THREE.Raycaster()
  const lastCameraState = useRef({ position: new THREE.Vector3(), rotation: new THREE.Euler() })
  const cachedResult = useRef<any>(null)
  const cacheValidFrames = useRef(0)
  const frameSkipCounter = useRef(0)
  
  // MEMORY LEAK FIX: Reuse objects instead of creating new ones each frame
  const tempPosition = useRef(new THREE.Vector3())
  const tempRotation = useRef(new THREE.Euler())
  const tempNDC = useRef(new THREE.Vector2(0, 0))
  
  // OPTIMIZATION 6: Further reduce raycast distance and improve culling
  raycaster.far = 8; // Reduced from 10 - Only raycast up to 8 units away
  raycaster.near = 0.1; // Set near plane to avoid precision issues
  
  return (camera: THREE.Camera, instancedMesh: THREE.InstancedMesh | null) => {
    if (!instancedMesh) return null
    
    // OPTIMIZATION 6: Skip raycasting every other frame to reduce CPU load
    frameSkipCounter.current++
    if (frameSkipCounter.current % 2 === 0 && cachedResult.current) {
      return cachedResult.current
    }
    
    // SMART CACHING: Only recalculate if camera moved significantly
    // MEMORY LEAK FIX: Reuse temp objects instead of creating new ones
    tempPosition.current.copy(camera.position)
    tempRotation.current.copy(camera.rotation)
    
    const positionDelta = tempPosition.current.distanceTo(lastCameraState.current.position)
    const rotationDelta = Math.abs(tempRotation.current.x - lastCameraState.current.rotation.x) + 
                         Math.abs(tempRotation.current.y - lastCameraState.current.rotation.y)
    
    // OPTIMIZATION 6: More aggressive caching - increased frame count and reduced thresholds
    if (positionDelta < 0.03 && rotationDelta < 0.015 && cacheValidFrames.current < 5 && cachedResult.current) {
      cacheValidFrames.current++
      return cachedResult.current
    }
    
    // Cast ray from camera center (screen center)
    // MEMORY LEAK FIX: Reuse NDC vector
    raycaster.setFromCamera(tempNDC.current, camera)
    
    // OPTIMIZATION 6: Only get first intersection with early termination
    const hits = raycaster.intersectObject(instancedMesh, false)
    
    let result = null
    if (hits.length > 0 && hits[0].instanceId !== undefined) {
      result = {
        instanceIndex: hits[0].instanceId,
        point: hits[0].point,
        distance: hits[0].distance,
        face: hits[0].face,
        normal: hits[0].face?.normal
      }
    }
    
    // Update cache - reuse existing objects
    lastCameraState.current.position.copy(tempPosition.current)
    lastCameraState.current.rotation.copy(tempRotation.current)
    cachedResult.current = result
    cacheValidFrames.current = 0
    
    return result
  }
}

export default function Player() {
  const ref = useRef<any>(null)
  const [, get] = useKeyboardControls()
  const visualRaycast = useVisualRaycast()
  const { controls } = useThree()
  const { checkBoundaries, isChanging, changeGravity, updateRotationAnimation, getCurrentGravity } = useGravityContext();
  const { currentFace, faceOrientation, setCurrentFace } = usePlayer();
  const cameraRef = useRef<THREE.PerspectiveCamera>(null)
  const { world } = useRapier() // Access the physics world
  
  // State for voxel highlighting
  const [highlightedInstance, setHighlightedInstance] = useState<number | null>(null)
  
  // Track previous delete key state for single-press detection
  const prevDeleteKeyRef = useRef(false)
  
  // Function to highlight a voxel instance
  const highlightVoxel = (instanceIndex: number) => {
    // TEMPORARILY DISABLED FOR DEBUGGING - so you can see true colors
    // return;
    
    const mesh = planetInstancedMesh.current
    if (!mesh) return
    

    
    // Store original color if not already stored
    if (!originalColors.has(instanceIndex)) {
      // MEMORY LEAK FIX: Reuse tempColor instead of creating new Color
      mesh.getColorAt(instanceIndex, tempColor)
      originalColors.set(instanceIndex, tempColor.clone())
      

    }
    
    // Set highlight color
    mesh.setColorAt(instanceIndex, HIGHLIGHT_COLOR)
    mesh.instanceColor!.needsUpdate = true
  }
  
  // Function to restore original voxel color
  const restoreVoxelColor = (instanceIndex: number) => {
    const mesh = planetInstancedMesh.current
    if (!mesh) return
    
    const originalColor = originalColors.get(instanceIndex)
    if (originalColor) {
      mesh.setColorAt(instanceIndex, originalColor)
      mesh.instanceColor!.needsUpdate = true
    }
  }
  
  // Function to expose a hidden voxel - COMPACT LAYOUT AWARE
  const exposeVoxel = (x: number, y: number, z: number) => {
    const coordKey = `${x},${y},${z}`
    const instanceIndex = voxelSystem.coordinateToIndex.get(coordKey)
    
    if (instanceIndex === undefined) {
      return null
    }
    
    const rigidBody = planetRigidBodies.current[instanceIndex]
    if (!rigidBody) {
      return null
    }
    
    console.log(`🌟 EXPOSING VOXEL: Instance ${instanceIndex} at (${x}, ${y}, ${z})`)
    
    // Calculate proper world position
    const offset = calculateWorldOffset(2.0) // Use the voxel size
    const worldPosition = voxelToWorldPosition(x, y, z, 2.0, offset)
    
    // Move the rigid body to its proper position and enable it
    rigidBody.setTranslation({ x: worldPosition[0], y: worldPosition[1], z: worldPosition[2] }, true)
    rigidBody.setBodyType(1, true) // 1 = kinematic position
    rigidBody.setEnabled(true) // Enable the body
    
    // Mark as exposed in userData
    if (rigidBody.userData) {
      (rigidBody.userData as any).isExposed = true;
    }
    
    // Remove from deleted voxels if it was there
    voxelSystem.deletedVoxels.delete(coordKey)
    deletedVoxels.delete(instanceIndex)
    
             // Trigger compact layout rebuild to include this newly exposed voxel
    const mesh = planetInstancedMesh.current;
    if (voxelSystem.rebuildCompactLayout && mesh && planetInstanceMaterials.current && mesh.instanceMatrix && mesh.instanceColor) {
      // CRITICAL FIX: Only process originally exposed voxels to avoid buffer overflow
      const instances: any[] = [];
      const colors: THREE.Color[] = [];
      
      for (let idx = 0; idx < voxelSystem.maxInstances; idx++) {
        const coordKey = voxelSystem.indexToCoordinate.get(idx);
        if (!coordKey) continue;
        
        // Skip deleted voxels - ONLY check coordinate-based deletion
        if (voxelSystem.deletedVoxels.has(coordKey)) {
          continue;
        }
        
        // CRITICAL: Include voxels that were originally exposed OR newly exposed
        const rigidBody = planetRigidBodies.current[idx];
        if (!rigidBody || !rigidBody.userData) {
          continue;
        }
        
        // Check if voxel is exposed (either originally or newly exposed)
        const isOriginallyExposed = (rigidBody.userData as any).isExposed;
        const isNewlyExposed = rigidBody.isEnabled() && rigidBody.translation().x < 50000; // Not at hidden position
        
        if (!isOriginallyExposed && !isNewlyExposed) {
          continue;
        }
        
        const [x, y, z] = coordKey.split(',').map(Number);
        const offset = calculateWorldOffset(2.0);
        const worldPosition = voxelToWorldPosition(x, y, z, 2.0, offset);
        
        instances.push({
          position: worldPosition,
          userData: { isExposed: true }
        });
        
        // Get original color from the mesh if possible
        const originalColor = new THREE.Color();
        const compactIndex = voxelSystem.originalToCompact.get(idx);
        if (mesh.getColorAt && compactIndex !== undefined) {
          mesh.getColorAt(compactIndex, originalColor);
        } else {
          // Fallback to white if we can't get the original color
          originalColor.setHex(0xffffff);
        }
        colors.push(originalColor);
      }
      
      voxelSystem.rebuildCompactLayout(mesh, instances, colors);
      
      console.log(`🔄 COMPACT LAYOUT REBUILT after exposing voxel ${instanceIndex}`);
    }
    
    return instanceIndex
  }

  // Function to check neighbors and expose hidden voxels
  const exposeNeighboringVoxels = (deletedX: number, deletedY: number, deletedZ: number) => {
    const neighbors = [
      [deletedX + 1, deletedY, deletedZ], // right
      [deletedX - 1, deletedY, deletedZ], // left
      [deletedX, deletedY + 1, deletedZ], // up
      [deletedX, deletedY - 1, deletedZ], // down
      [deletedX, deletedY, deletedZ + 1], // forward
      [deletedX, deletedY, deletedZ - 1], // backward
    ]
    
    neighbors.forEach(([nx, ny, nz]) => {
      // Skip if neighbor is within bounds
      if (nx < 0 || nx >= CUBE_SIZE_X || 
          ny < 0 || ny >= CUBE_SIZE_Y || 
          nz < 0 || nz >= CUBE_SIZE_Z) {
        return
      }
      
      const neighborCoordKey = `${nx},${ny},${nz}`
      
      // Skip if this neighbor doesn't exist in the original world
      if (!voxelSystem.allVoxels.has(neighborCoordKey)) {
        return
      }
      
      // Skip if this neighbor doesn't have a coordinate mapping (shouldn't happen now, but safety check)
      if (!voxelSystem.coordinateToIndex.has(neighborCoordKey)) {
        return
      }
      
      // CRITICAL: Skip if this neighbor was deleted by the user
      // We should NEVER bring back user-deleted voxels
      if (voxelSystem.deletedVoxels.has(neighborCoordKey)) {
        return
      }
      
      // Skip if this neighbor is already visible (check by looking at rigid body position)
      const neighborInstanceIndex = voxelSystem.coordinateToIndex.get(neighborCoordKey)
      const neighborRigidBody = planetRigidBodies.current[neighborInstanceIndex!]
      if (neighborRigidBody) {
        const pos = neighborRigidBody.translation()
        // If the voxel is not at the "hidden" position (100000+), it's already visible
        if (pos.x < 50000) {
          return
        }
      }
      
      // Check if this voxel should now be exposed
      // MEMORY LEAK FIX: Reuse a global Set instead of creating new one each time
      tempVoxelSet.clear()
      
      // Rebuild the current state of existing voxels (excluding deleted ones)
      for (const voxelCoord of voxelSystem.allVoxels) {
        if (!voxelSystem.deletedVoxels.has(voxelCoord)) {
          tempVoxelSet.add(voxelCoord)
        }
      }
      
      if (isVoxelExposed(nx, ny, nz, tempVoxelSet)) {
        // Since we already checked that coordinate mapping exists, this should work
        exposeVoxel(nx, ny, nz)
      }
    })
  }

  // Function to delete a voxel - COMPACT LAYOUT AWARE
  const deleteVoxel = (instanceIndex: number) => {
    const mesh = planetInstancedMesh.current
    const rigidBody = planetRigidBodies.current[instanceIndex]
    
    if (!mesh || !rigidBody) return
    
    // Get the coordinates for this instance
    const coordKey = voxelSystem.indexToCoordinate.get(instanceIndex)
    if (!coordKey) {
      return
    }
    
    const [x, y, z] = coordKey.split(',').map(Number)
    
    // Mark as deleted in the voxel system
    deletedVoxels.add(instanceIndex)
    voxelSystem.deletedVoxels.add(coordKey)
    
    console.log(`🗑️ DELETING VOXEL: Instance ${instanceIndex} at (${x}, ${y}, ${z})`)
    
    // PHYSICS DELETION: Move far away and disable to avoid concurrent access issues
    try {
      // Move the rigid body far away first
      rigidBody.setTranslation({ x: 100000, y: 100000, z: 100000 }, true);
      // Then disable it
      rigidBody.setEnabled(false);
    } catch (error) {
      console.warn('Failed to disable rigid body:', error);
    }
    
        // IMMEDIATE VISUAL DELETION: Rebuild compact layout immediately without physics access
    if (voxelSystem.rebuildCompactLayout && planetInstanceMaterials.current && mesh.instanceMatrix && mesh.instanceColor) {
      // CRITICAL FIX: Only process voxels that were originally exposed to avoid buffer overflow
      // The mesh buffer was allocated based on exposed voxels, not all voxels
      const instances: any[] = [];
      const colors: THREE.Color[] = [];
      
      // Iterate through original instances to maintain proper indexing
      for (let idx = 0; idx < voxelSystem.maxInstances; idx++) {
        const coordKey = voxelSystem.indexToCoordinate.get(idx);
        if (!coordKey) continue;
        
        // Skip deleted voxels - ONLY check coordinate-based deletion
        if (voxelSystem.deletedVoxels.has(coordKey)) {
          continue;
        }
        
        // CRITICAL: Include voxels that were originally exposed OR newly exposed
        const rigidBody = planetRigidBodies.current[idx];
        if (!rigidBody || !rigidBody.userData) {
          continue;
        }
        
        // Check if voxel is exposed (either originally or newly exposed)
        const isOriginallyExposed = (rigidBody.userData as any).isExposed;
        const isNewlyExposed = rigidBody.isEnabled() && rigidBody.translation().x < 50000; // Not at hidden position
        
        if (!isOriginallyExposed && !isNewlyExposed) {
          continue;
        }
        
        const [x, y, z] = coordKey.split(',').map(Number);
        const offset = calculateWorldOffset(2.0);
        const worldPosition = voxelToWorldPosition(x, y, z, 2.0, offset);
        
        instances.push({
          position: worldPosition,
          userData: { isExposed: true }
        });
        
        // Get original color from the mesh if possible
        const originalColor = new THREE.Color();
        const compactIndex = voxelSystem.originalToCompact.get(idx);
        if (mesh.getColorAt && compactIndex !== undefined) {
          mesh.getColorAt(compactIndex, originalColor);
        } else {
          // Fallback to white if we can't get the original color
          originalColor.setHex(0xffffff);
        }
        colors.push(originalColor);
      }
      
      console.log(`🔧 BUFFER SAFE: Processing ${instances.length} instances (buffer limit respected)`);
      voxelSystem.rebuildCompactLayout(mesh, instances, colors);
      console.log(`👻 IMMEDIATELY REBUILT LAYOUT excluding deleted voxel ${instanceIndex}`);
    }
    
    // Check neighboring voxels to see if any should now be exposed
    exposeNeighboringVoxels(x, y, z)
  }
  
  // Performance optimization: Throttle expensive operations
  const frameCount = useRef(0);
  
  useFrame((state, deltaTime) => {
    if (!ref.current) return
    
    frameCount.current++;
    const { forward, backward, left, right, jump, delete: deleteKey } = get()
    const velocity = ref.current.linvel()
    
    // Update rotation animation if active and pass the physics world
    updateRotationAnimation(deltaTime, world);
    
    // CRITICAL: Apply current gravity to physics world every frame
    const currentGravity = getCurrentGravity();
    if (world && world.gravity) {
      const worldGravity = world.gravity;
      if (worldGravity.x !== currentGravity[0] || 
          worldGravity.y !== currentGravity[1] || 
          worldGravity.z !== currentGravity[2]) {
        world.gravity.x = currentGravity[0];
        world.gravity.y = currentGravity[1];
        world.gravity.z = currentGravity[2];
        console.log(`🌍 Applied gravity to physics world: [${currentGravity[0]}, ${currentGravity[1]}, ${currentGravity[2]}]`);
      }
    }
    
    // Get player position and position camera relative to player
    const translation = ref.current.translation()
    
    // OPTIMIZATION: Only check boundaries every 3 frames (reduces CPU usage)
    if (frameCount.current % 3 === 0) {
      // MEMORY LEAK FIX: Reuse tempVector3 instead of creating new Vector3
      tempVector3.set(translation.x, translation.y, translation.z);
      const boundary = checkBoundaries(tempVector3);
      if (boundary && setCurrentFace) {
        // Use the original changeGravity function which handles both gravity and player rotation
        changeGravity(boundary, ref.current, setCurrentFace, state.camera, currentFace);
      }
    }
    
    // Allow player movement even during face transitions (kinematic body can still be moved)
    // The isChanging check is removed to allow movement during smooth rotations
    if (true) {
      // Simple camera-relative movement
      direction.set(0, 0, 0)
      
      if (forward || backward || left || right) {
        // Ensure camera world matrix is up to date before getting direction
        state.camera?.updateMatrixWorld(true)
        
        // MEMORY LEAK FIX: Reuse temp vectors instead of creating new ones
        state.camera?.getWorldDirection(tempVector3) // cameraForward
        
        // Project camera forward onto the current face plane to get proper movement direction
        // Remove any component along the face's up direction to keep movement on the surface
        tempVector3_2.copy(faceOrientation.upDirection) // faceUp
        tempVector3_3.copy(tempVector3) // projectedForward
        const dotProduct = tempVector3_2.dot(tempVector3)
        tempVector3_3.addScaledVector(tempVector3_2, -dotProduct)
        
        // Calculate right direction by crossing projected forward with face up
        // Reuse tempVector3 for cameraRight since we don't need the original cameraForward anymore
        tempVector3.crossVectors(tempVector3_3, tempVector3_2).normalize() // cameraRight
        
        // Build movement direction from input using projected camera directions
        direction.set(0, 0, 0)
        if (forward) direction.add(tempVector3_3) // projectedForward
        if (backward) direction.sub(tempVector3_3) // projectedForward
        if (right) direction.add(tempVector3) // cameraRight
        if (left) direction.sub(tempVector3) // cameraRight
        
        // Normalize and apply speed
        if (direction.length() > 0) {
          direction.normalize().multiplyScalar(SPEED)
        }
      
        // Apply movement preserving only gravity component of velocity
        const currentVel = ref.current.linvel()
        // MEMORY LEAK FIX: Reuse temp vectors instead of creating new ones
        tempVector3.set(currentVel.x, currentVel.y, currentVel.z) // currentVelVector
        
        // Calculate gravity component of current velocity
        tempVector3_2.copy(faceOrientation.upDirection).multiplyScalar(-1) // gravityDirection
        const gravityComponent = tempVector3_2.dot(tempVector3)
        tempVector3_2.multiplyScalar(gravityComponent) // gravityVelComponent
        
        // New velocity = surface movement + gravity component
        // Reuse tempVector3_3 for newVelocity
        tempVector3_3.copy(direction).add(tempVector3_2)
        
        // Debug logging
        const beforeVel = ref.current.linvel()

        
        // Wake up the rigid body if it's sleeping and force it to be enabled
        ref.current.wakeUp()
        ref.current.setEnabled(true)
        
        // HYBRID MOVEMENT: Handle both dynamic and kinematic body types
        const bodyType = ref.current.bodyType?.() || 'unknown';
        
        if (bodyType === 2) {
          // Kinematic body - use position-based movement
          const currentPos = ref.current.translation();
          const newPos = {
            x: currentPos.x + tempVector3_3.x * deltaTime,
            y: currentPos.y + tempVector3_3.y * deltaTime,
            z: currentPos.z + tempVector3_3.z * deltaTime
          };
          
          if (ref.current.setNextKinematicTranslation) {
            ref.current.setNextKinematicTranslation(newPos);
          } else {
            ref.current.setTranslation(newPos, true);
          }
          console.log(`🔧 Kinematic movement: [${tempVector3_3.x.toFixed(2)}, ${tempVector3_3.y.toFixed(2)}, ${tempVector3_3.z.toFixed(2)}]`);
        } else {
          // Dynamic body - use velocity-based movement
          ref.current.setLinvel({ 
            x: tempVector3_3.x,
            y: tempVector3_3.y,
            z: tempVector3_3.z
          });
          // console.log(`🔧 Dynamic movement: [${tempVector3_3.x.toFixed(2)}, ${tempVector3_3.y.toFixed(2)}, ${tempVector3_3.z.toFixed(2)}]`);
        }

      }
      
      // // Handle jumping - jump in the "up" direction relative to current face (keep this as-is)
      if (jump) {
        const currentVel = ref.current.linvel();
        const jumpForce = 1;
        const jumpVector = faceOrientation.upDirection.clone().multiplyScalar(jumpForce);
        
        ref.current.setLinvel({ 
          x: currentVel.x + jumpVector.x, 
          y: currentVel.y + jumpVector.y, 
          z: currentVel.z + jumpVector.z 
        });
      }
    }

    // Raycast for voxel interaction - run every frame for responsiveness
    const hitInfo = visualRaycast(state.camera, planetInstancedMesh.current)
    
    // Handle voxel highlighting - only for non-deleted voxels
    if (hitInfo && !deletedVoxels.has(hitInfo.instanceIndex) && hitInfo.instanceIndex !== highlightedInstance) {
      // Check if we have coordinate mapping for this instance
      const coordKey = voxelSystem.indexToCoordinate.get(hitInfo.instanceIndex)
      if (!coordKey) {
        // Try to get coordinates from rigid body userData as fallback
        const rigidBody = planetRigidBodies.current[hitInfo.instanceIndex]
        if (rigidBody && rigidBody.userData && (rigidBody.userData as any).coordinates) {
          const { x, y, z } = (rigidBody.userData as any).coordinates
          const newCoordKey = `${x},${y},${z}`
          // Add missing mapping
          voxelSystem.coordinateToIndex.set(newCoordKey, hitInfo.instanceIndex)
          voxelSystem.indexToCoordinate.set(hitInfo.instanceIndex, newCoordKey)
  
        } else {
          return // Skip this instance
        }
      }
      
      // Restore previous highlighted voxel if exists
      if (highlightedInstance !== null) {
        restoreVoxelColor(highlightedInstance)
      }
      
      // Highlight new voxel
      highlightVoxel(hitInfo.instanceIndex)
      setHighlightedInstance(hitInfo.instanceIndex)
      
      const material = planetInstanceMaterials.current[hitInfo.instanceIndex]
      const rigidBody = planetRigidBodies.current[hitInfo.instanceIndex]
      

    } else if ((!hitInfo || deletedVoxels.has(hitInfo.instanceIndex)) && highlightedInstance !== null) {
      // No voxel hit or hit a deleted voxel, restore previous highlighted voxel
      restoreVoxelColor(highlightedInstance)
      setHighlightedInstance(null)
    }
    
    // Handle voxel deletion with E key - only on fresh key press
    const deleteKeyPressed = deleteKey && !prevDeleteKeyRef.current // Fresh press detection
    prevDeleteKeyRef.current = deleteKey // Update previous state
    
    if (deleteKeyPressed && highlightedInstance !== null && !deletedVoxels.has(highlightedInstance)) {
      // Double-check we have coordinates before deleting
      const coordKey = voxelSystem.indexToCoordinate.get(highlightedInstance)
      if (coordKey) {
        deleteVoxel(highlightedInstance)
        restoreVoxelColor(highlightedInstance) // Clean up highlight
        setHighlightedInstance(null)
      }
    }
  })
  
    return (
    <>
      <CameraControls cameraRef={cameraRef} />
      <RigidBody ref={ref} colliders={false} mass={1} type="dynamic" position={[0, CUBE_SIZE_Y + 2, 0]} lockRotations={true}>
        <CapsuleCollider args={[.5, .5]} />
        <PerspectiveCamera ref={cameraRef} position={[0, 1, 0]} makeDefault fov={75} far={100} />
        <capsuleGeometry args={[0.5, 0.5]} />
      </RigidBody>
    </>
  )
} 
