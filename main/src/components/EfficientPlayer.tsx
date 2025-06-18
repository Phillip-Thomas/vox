import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
// @ts-ignore - CapsuleCollider exists at runtime but not in types
import { RigidBody, CapsuleCollider, useRapier } from '@react-three/rapier';
import { useKeyboardControls, PerspectiveCamera } from '@react-three/drei';
import { voxelSystem } from '../utils/efficientVoxelSystem';
import { efficientPlanetMesh } from './EfficientPlanet';
import { MATERIALS, MaterialType } from '../types/materials';
import { ProceduralWorldGenerator } from '../utils/proceduralWorldGenerator';
import CameraControls from './CameraControls';
import { CubeFace, FACE_ORIENTATIONS } from '../context/PlayerContext';

// Simple raycaster for voxel interaction
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(0, 0); // Screen center

const SPEED = 5;

// MEMORY LEAK FIX: Create reusable temp objects outside component scope
const tempVector3 = new THREE.Vector3();
const tempQuaternion1 = new THREE.Quaternion();
const tempQuaternion2 = new THREE.Quaternion();
const tempQuaternion3 = new THREE.Quaternion();
const tempVector3_2 = new THREE.Vector3();
const tempVector3_3 = new THREE.Vector3();

// Debug flag for performance-critical logging
const DEBUG = false;

// Animation constants
const ROTATE_TIME = 0.9; // 900ms - even slower for very comfortable body/camera rotation
const BOUNDARY_CHECK_DELAY = 500; // Wait 0.5s after start before enabling boundary checks

// Animation state interface
interface RotationAnimation {
  isActive: boolean;
  startTime: number;
  startRotation: { x: number; y: number; z: number; w: number };
  targetRotation: { x: number; y: number; z: number; w: number };
  startCameraUp: { x: number; y: number; z: number };
  targetCameraUp: { x: number; y: number; z: number };
  playerRigidBody: any;
  camera: THREE.Camera;
  targetFace: CubeFace;
  newFaceOrientation: any;
}

// Smooth easing function - gentler for body rotation
function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

interface EfficientPlayerProps {
  planetSize?: number;
  onPositionChange?: (position: THREE.Vector3) => void;
}

export default function EfficientPlayer({ planetSize, onPositionChange }: EfficientPlayerProps) {
  if (planetSize === undefined) {
    throw new Error('EfficientPlayer: planetSize prop is required - configure in EfficientScene');
  }
  
  const ref = useRef<any>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const [, get] = useKeyboardControls();
  const { world } = useRapier(); // Access the physics world
  
  // Track previous delete key state for single-press detection
  const prevDeleteKeyRef = useRef(false);
  
  // Dynamic gravity system state
  const gravity = useRef<[number, number, number]>([0, -9.81, 0]);
  const isChangingRef = useRef(false);
  const currentFaceRef = useRef<CubeFace>('top');
  const [isChangingState, setIsChangingState] = useState(false);
  const [currentFace, setCurrentFace] = useState<CubeFace>('top');
  const startTime = useRef<number>(Date.now());
  const rotationAnimation = useRef<RotationAnimation | null>(null);
  const frameCount = useRef(0);
  
  // Calculate planet boundaries for face transitions
  const planetRadius = planetSize / 2;
  const playerBodyRadius = 1;
  const boundaryMargin = planetRadius - playerBodyRadius;
  
  // Define face normals for the 6 faces of the planet
  const faceNormals = {
    top: new THREE.Vector3(0, 1, 0),
    bottom: new THREE.Vector3(0, -1, 0),
    right: new THREE.Vector3(1, 0, 0),
    left: new THREE.Vector3(-1, 0, 0),
    front: new THREE.Vector3(0, 0, 1),
    back: new THREE.Vector3(0, 0, -1)
  };
  
  const determineQuadrant = useCallback((playerPosition: THREE.Vector3): CubeFace => {
    // Early-out check - if player is far from any face, skip expensive calculations
    if (Math.abs(playerPosition.x) < boundaryMargin &&
        Math.abs(playerPosition.y) < boundaryMargin &&
        Math.abs(playerPosition.z) < boundaryMargin) {
      return currentFaceRef.current;
    }
    
    // Calculate vector from planet center to player
    tempVector3.copy(playerPosition);
    
    // Find which face normal the player's direction most closely aligns with
    let maxDot = -Infinity;
    let closestFace: CubeFace = 'top';
    
    Object.entries(faceNormals).forEach(([face, normal]) => {
      const dot = tempVector3.dot(normal);
      if (dot > maxDot) {
        maxDot = dot;
        closestFace = face as CubeFace;
      }
    });
    
    return closestFace;
  }, [boundaryMargin]);

  const checkBoundaries = useCallback((playerPosition: THREE.Vector3) => {
    if (isChangingRef.current) return null;
    
    // Wait before enabling boundary checks
    const timeSinceStart = Date.now() - startTime.current;
    if (timeSinceStart < BOUNDARY_CHECK_DELAY) return null;

    const newQuadrant = determineQuadrant(playerPosition);
    
    // Only trigger change if quadrant actually changed
    if (newQuadrant !== currentFaceRef.current) {
      return newQuadrant;
    }
    
    return null;
  }, [determineQuadrant]);

  // Function to update rotation animation (called from useFrame)
  const updateRotationAnimation = useCallback((deltaTime: number) => {
    if (!rotationAnimation.current || !rotationAnimation.current.isActive) return;

    const animation = rotationAnimation.current;
    const now = performance.now();
    const elapsed = now - animation.startTime;
    const progress = Math.min(elapsed / (ROTATE_TIME * 1000), 1);
    
    // Use gentle easing for comfortable body rotation
    const easedProgress = easeInOutQuad(progress);
    
    // Smoothly interpolate player rotation
    tempQuaternion1.set(animation.startRotation.x, animation.startRotation.y, animation.startRotation.z, animation.startRotation.w);
    tempQuaternion2.set(animation.targetRotation.x, animation.targetRotation.y, animation.targetRotation.z, animation.targetRotation.w);
    tempQuaternion1.slerp(tempQuaternion2, easedProgress);
    
    // Apply the face transition rotation to prevent rolling
    animation.playerRigidBody.setRotation({
      x: tempQuaternion1.x,
      y: tempQuaternion1.y,
      z: tempQuaternion1.z,
      w: tempQuaternion1.w
    }, true);
    
    // Smoothly interpolate camera up direction
    tempVector3_2.set(animation.startCameraUp.x, animation.startCameraUp.y, animation.startCameraUp.z);
    tempVector3_3.set(animation.targetCameraUp.x, animation.targetCameraUp.y, animation.targetCameraUp.z);
    tempVector3_2.lerp(tempVector3_3, easedProgress);
    animation.camera.up.copy(tempVector3_2);
    
    // Update projection matrix
    if ('updateProjectionMatrix' in animation.camera && typeof animation.camera.updateProjectionMatrix === 'function') {
      animation.camera.updateProjectionMatrix();
    }
    
    // Complete the transition
    if (progress >= 1) {
      // Final rotation snap and physics cleanup
      animation.playerRigidBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
      animation.playerRigidBody.lockRotations(true);
      
      // Reset forces and torques for clean state
      if (animation.playerRigidBody.resetForces) animation.playerRigidBody.resetForces(true);
      if (animation.playerRigidBody.resetTorques) animation.playerRigidBody.resetTorques(true);
      
      console.log('🔧 Player body restoration completed');
      
      // Update face reference and release guard
      currentFaceRef.current = animation.targetFace;
      isChangingRef.current = false;
      setIsChangingState(false);
      
      // Clean up animation
      rotationAnimation.current.isActive = false;
      rotationAnimation.current = null;
      
      if (DEBUG) {
        console.log(`🎯 Face transition completed in ${elapsed.toFixed(1)}ms to ${animation.targetFace}`);
      }
    }
  }, []);

  const changeGravity = useCallback((newFace: CubeFace, playerRigidBody: any, camera?: THREE.Camera) => {
    if (isChangingRef.current || !playerRigidBody) return;

    const newFaceOrientation = FACE_ORIENTATIONS[newFace];
    
    if (DEBUG) {
      console.log(`📐 Starting transition to ${newFace}`);
    }
    
    // Unlock rotations for the controlled animation
    playerRigidBody.lockRotations(false);
    console.log('🔓 Unlocked rotations for face transition');
    
    if (currentFace && camera) {
      // Calculate rotation delta between current and new face
      const currentFaceOrientation = FACE_ORIENTATIONS[currentFace];
      const currentUpDir = currentFaceOrientation.upDirection;
      const newUpDir = newFaceOrientation.upDirection;
      
      // Calculate rotation needed to transform current up to new up
      tempQuaternion1.setFromUnitVectors(currentUpDir, newUpDir);
      
      // Get current player rotation
      const currentPlayerRotation = playerRigidBody.rotation();
      tempQuaternion2.set(
        currentPlayerRotation.x,
        currentPlayerRotation.y,
        currentPlayerRotation.z,
        currentPlayerRotation.w
      );
      
      // Apply delta rotation to current player rotation
      tempQuaternion3.multiplyQuaternions(tempQuaternion1, tempQuaternion2);
      
      // Get current camera up direction for smooth transition
      tempVector3_2.copy(camera.up);
      tempVector3_3.copy(newUpDir);
      
      // Set up animation state
      rotationAnimation.current = {
        isActive: true,
        startTime: performance.now(),
        startRotation: { x: tempQuaternion2.x, y: tempQuaternion2.y, z: tempQuaternion2.z, w: tempQuaternion2.w },
        targetRotation: { x: tempQuaternion3.x, y: tempQuaternion3.y, z: tempQuaternion3.z, w: tempQuaternion3.w },
        startCameraUp: { x: tempVector3_2.x, y: tempVector3_2.y, z: tempVector3_2.z },
        targetCameraUp: { x: tempVector3_3.x, y: tempVector3_3.y, z: tempVector3_3.z },
        playerRigidBody,
        camera,
        targetFace: newFace,
        newFaceOrientation
      };

      if (DEBUG) {
        console.log(`🔄 Applied upDirection delta rotation from ${currentFace} to ${newFace}`);
      }
    }
    
    // Set angular velocity to zero
    playerRigidBody.setAngvel({ x: 0, y: 0, z: 0 }, true);

    // Update face context immediately 
    setCurrentFace(newFace);
    isChangingRef.current = true;
    setIsChangingState(true);
    
    // Delay gravity change so player "falls" onto the new face first
    setTimeout(() => {
      gravity.current[0] = newFaceOrientation.gravity[0];
      gravity.current[1] = newFaceOrientation.gravity[1];
      gravity.current[2] = newFaceOrientation.gravity[2];
    }, 200);
  }, [currentFace]);

  // Get current gravity for physics world application
  const getCurrentGravity = useCallback(() => gravity.current, []);
  
  // Get current face orientation for movement
  const faceOrientation = FACE_ORIENTATIONS[currentFace];

  useEffect(() => {
    if (ref.current && ref.current.isSleeping) {
        ref.current.wakeUp();
    }
  }, [ref.current?.isSleeping])
  
  useFrame((state, deltaTime) => {
    if (!ref.current) return;
    
    frameCount.current++;
    
    // Update rotation animation if active
    updateRotationAnimation(deltaTime);
    
    // Apply current gravity to physics world every frame
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
    
    // Update player position for proximity-based collision
    if (onPositionChange) {
      const position = ref.current.translation();
      onPositionChange(new THREE.Vector3(position.x, position.y, position.z));
    }
    
    // Check boundaries every 3 frames for face transitions
    if (frameCount.current % 3 === 0) {
      const translation = ref.current.translation();
      tempVector3.set(translation.x, translation.y, translation.z);
      const boundary = checkBoundaries(tempVector3);
      if (boundary) {
        changeGravity(boundary, ref.current, state.camera);
      }
    }
    
    const { forward, backward, left, right, jump, delete: deleteKey } = get();
    
    // Movement using face-relative directions
    const direction = new THREE.Vector3();
    
    if (forward || backward || left || right) {
      // Use face orientation for movement instead of camera-relative
      if (forward) direction.add(faceOrientation.forwardDirection);
      if (backward) direction.sub(faceOrientation.forwardDirection);
      if (right) direction.add(faceOrientation.rightDirection);
      if (left) direction.sub(faceOrientation.rightDirection);
      
      // Normalize and apply speed
      if (direction.length() > 0) {
        direction.normalize().multiplyScalar(SPEED);
        
        // Apply movement while preserving gravity component
        const currentVel = ref.current.linvel();
        
        // Calculate gravity component of current velocity
        tempVector3_2.copy(faceOrientation.upDirection).multiplyScalar(-1); // gravityDirection
        const gravityComponent = tempVector3_2.dot(tempVector3.set(currentVel.x, currentVel.y, currentVel.z));
        tempVector3_2.multiplyScalar(gravityComponent); // gravityVelComponent
        
        // New velocity = surface movement + gravity component
        tempVector3_3.copy(direction).add(tempVector3_2);
        
        // Wake up the rigid body
        ref.current.wakeUp();
        ref.current.setEnabled(true);
        
        ref.current.setLinvel({
          x: tempVector3_3.x,
          y: tempVector3_3.y,
          z: tempVector3_3.z
        });
      }
    }
    
    // Jumping in the "up" direction relative to current face
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
    
    // Handle voxel deletion with E key - only on fresh key press
    const deleteKeyPressed = deleteKey && !prevDeleteKeyRef.current;
    prevDeleteKeyRef.current = deleteKey;
    
    if (deleteKeyPressed) {
      handleVoxelDeletion(cameraRef.current);
    }
  });
  
  const handleVoxelDeletion = (camera: THREE.Camera | null) => {
    if (!camera) return;
    
    const mesh = efficientPlanetMesh.current;
    if (!mesh) return;
    
    // Cast ray from camera center
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(mesh);
    
    if (intersects.length > 0 && intersects[0].instanceId !== undefined) {
      const instanceId = intersects[0].instanceId;
      
      // Find which voxel this instance represents
      const allVoxels = voxelSystem.getAllVoxels();
      let targetVoxel: {x: number, y: number, z: number} | null = null;
      
      for (const [coordKey, voxelData] of allVoxels) {
        if (voxelData.meshSlot === instanceId) {
          const [x, y, z] = coordKey.split(',').map(Number);
          targetVoxel = { x, y, z };
          break;
        }
      }
      
      if (targetVoxel) {
        console.log(`🎯 Deleting voxel at (${targetVoxel.x}, ${targetVoxel.y}, ${targetVoxel.z})`);
        
        // Remove the voxel
        voxelSystem.removeVoxel(targetVoxel.x, targetVoxel.y, targetVoxel.z);
        
        // Expose any neighbors that should now be visible using proportional generation
        const materialGenerator = (x: number, y: number, z: number) => generateMaterialForPosition(x, y, z, planetSize);
        voxelSystem.exposeNeighbors(targetVoxel.x, targetVoxel.y, targetVoxel.z, materialGenerator);
        
        console.log('📊 Updated stats:', voxelSystem.getStats());
      }
    }
  };
  
  return (
    <>
      <CameraControls cameraRef={cameraRef} />
      <RigidBody 
        ref={ref} 
        colliders={false}
        mass={1}
        type="dynamic" 
        position={[0, planetSize + 10, 0]}
        lockRotations={true}
        linearDamping={0.5}
        angularDamping={0.8}
        canSleep={false}
      >
        {/* Physics collider */}
        <CapsuleCollider args={[0.5, 0.5]} />
        
        {/* Camera attached to player */}
        <PerspectiveCamera 
          ref={cameraRef} 
          position={[0, 1, 0]} 
          makeDefault 
          fov={75} 
          far={1000} 
        />
        
        {/* Visual representation */}
        <mesh>
          <capsuleGeometry args={[0.5, 1]} />
          <meshStandardMaterial color="blue" />
        </mesh>
      </RigidBody>
    </>
  );
}

// Proportional material generator for newly exposed voxels
function generateMaterialForPosition(x: number, y: number, z: number, planetSize: number): {material: string, color: THREE.Color} {
  const distance = Math.sqrt(x*x + y*y + z*z);
  const planetRadius = planetSize / 2;
  
  // Create proportional world generation config matching the planet
  const proportionalConfig = {
    planetRadius: planetRadius,
    coreRadiusPercent: 0.15, // Core is 15% of planet radius
    surfaceThickness: Math.max(1, Math.floor(planetRadius * 0.05)), // Surface is 5% of radius, minimum 1 block
    coreRadius: 2 // Legacy fallback
  };
  
  const generator = new ProceduralWorldGenerator(proportionalConfig);
  const materialType = generator.generateMaterialForPosition(x, y, z);
  
  return { 
    material: materialType, 
    color: MATERIALS[materialType].color.clone() 
  };
} 