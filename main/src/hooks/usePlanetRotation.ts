import { useRef, useCallback, useState } from 'react';
import * as THREE from 'three';
import { CUBE_SIZE_X, CUBE_SIZE_Y, CUBE_SIZE_Z, calculateWorldOffset } from '../utils/voxelUtils';
import { CubeFace, FACE_ORIENTATIONS } from '../context/PlayerContext';

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
const ROTATE_TIME = 0.65; // 650ms - slower for comfortable body/camera rotation
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
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Even gentler easing for body rotation specifically
function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function usePlanetGravity(voxelSize: number) {
  // OPTIMIZATION 1: Use refs for performance-critical internal state
  const gravity = useRef<[number, number, number]>([0, -9.81, 0]);
  const isChangingRef = useRef(false); // Internal ref for animation logic
  const currentFaceRef = useRef<CubeFace>('top');
  
  // PLAYER MOVEMENT FIX: Keep React state for isChanging so Player component gets updates
  const [isChangingState, setIsChangingState] = useState(false);
  
  const startTime = useRef<number>(Date.now());
  const offset = calculateWorldOffset(voxelSize);
  
  // Animation state for smooth transitions
  const rotationAnimation = useRef<RotationAnimation | null>(null);
  
  // Calculate cube center in world coordinates
  const cubeCenter = new THREE.Vector3(0, 0, 0);
  
  // Pre-calculate cube dimensions for boundary optimization
  const cubeHalfSize = Math.max(CUBE_SIZE_X, CUBE_SIZE_Y, CUBE_SIZE_Z) * voxelSize * 0.5;
  const playerBodyRadius = 1; // Approximate player body radius
  const boundaryMargin = cubeHalfSize - playerBodyRadius;

  // Define face normals for the 6 quadrants
  const faceNormals = {
    top: new THREE.Vector3(0, 1, 0),
    bottom: new THREE.Vector3(0, -1, 0),
    right: new THREE.Vector3(1, 0, 0),
    left: new THREE.Vector3(-1, 0, 0),
    front: new THREE.Vector3(0, 0, 1),
    back: new THREE.Vector3(0, 0, -1)
  };

  const determineQuadrant = useCallback((playerPosition: THREE.Vector3): CubeFace => {
    // OPTIMIZATION 3: Early-out check - if player is far from any face, skip expensive calculations
    if (Math.abs(playerPosition.x) < boundaryMargin &&
        Math.abs(playerPosition.y) < boundaryMargin &&
        Math.abs(playerPosition.z) < boundaryMargin) {
      return currentFaceRef.current;
    }
    
    // Calculate vector from cube center to player
    // MEMORY LEAK FIX: Reuse tempVector3 instead of creating new Vector3
    tempVector3.subVectors(playerPosition, cubeCenter);
    
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
  }, [cubeCenter, boundaryMargin]);

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
  const updateRotationAnimation = useCallback((deltaTime: number, rapierWorld?: any) => {
    if (!rotationAnimation.current || !rotationAnimation.current.isActive) return;

    const animation = rotationAnimation.current;
    const now = performance.now();
    const elapsed = now - animation.startTime;
    const progress = Math.min(elapsed / (ROTATE_TIME * 1000), 1);
    
    // GENTLER EASING: Use quadratic easing for more comfortable body rotation
    const easedProgress = easeInOutQuad(progress);
    
    // MEMORY LEAK FIX: Reuse temp quaternions instead of cloning and creating new ones
    tempQuaternion1.set(animation.startRotation.x, animation.startRotation.y, animation.startRotation.z, animation.startRotation.w);
    tempQuaternion2.set(animation.targetRotation.x, animation.targetRotation.y, animation.targetRotation.z, animation.targetRotation.w);
    tempQuaternion1.slerp(tempQuaternion2, easedProgress);
    
          // CONTROLLED ROTATION: Apply the face transition rotation to prevent rolling
      // This rotates the player to match the new face orientation  
      animation.playerRigidBody.setRotation({
        x: tempQuaternion1.x,
        y: tempQuaternion1.y,
        z: tempQuaternion1.z,
        w: tempQuaternion1.w
      }, true);
    
    // Smoothly interpolate camera up direction
    // MEMORY LEAK FIX: Reuse temp vectors instead of cloning and creating new ones
    tempVector3_2.set(animation.startCameraUp.x, animation.startCameraUp.y, animation.startCameraUp.z);
    tempVector3_3.set(animation.targetCameraUp.x, animation.targetCameraUp.y, animation.targetCameraUp.z);
    tempVector3_2.lerp(tempVector3_3, easedProgress);
    animation.camera.up.copy(tempVector3_2);
    
    // Update projection matrix if it's a perspective or orthographic camera
    if ('updateProjectionMatrix' in animation.camera && typeof animation.camera.updateProjectionMatrix === 'function') {
      animation.camera.updateProjectionMatrix();
    }
    
    // OPTIMIZATION 2: Chain all completion operations instead of using setTimeout
    if (progress >= 1) {
      // 1️⃣ Final rotation snap and physics cleanup
      animation.playerRigidBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
      animation.playerRigidBody.lockRotations(true); // CRITICAL: Prevent rolling after transition
      
      // 2️⃣ CRITICAL: Restore dynamic body type for movement and gravity
      const rigidBody = animation.playerRigidBody;
      
      
      // Wake up and enable the body
      // if (rigidBody.setEnabled) rigidBody.setEnabled(true);
      // if (rigidBody.wakeUp) rigidBody.wakeUp();
      
      // Reset forces and torques for clean state
      if (rigidBody.resetForces) rigidBody.resetForces(true);
      if (rigidBody.resetTorques) rigidBody.resetTorques(true);
      
      console.log('🔧 Player body restoration completed');
      
      // 3️⃣ Update face reference and release guard
      currentFaceRef.current = animation.targetFace;
      isChangingRef.current = false;
      setIsChangingState(false); // Update React state for Player component
      
      // Clean up animation
      rotationAnimation.current.isActive = false;
      rotationAnimation.current = null;
      
      // OPTIMIZATION 5: Gate debug logging behind flag
      if (DEBUG) {
        console.log(`🎯 Face transition completed in ${elapsed.toFixed(1)}ms to ${animation.targetFace}`);
      }
    }
  }, []);

  const changeGravity = useCallback((newFace: CubeFace, playerRigidBody: any, setCurrentFace: (face: CubeFace) => void, camera?: THREE.Camera, currentFace?: CubeFace) => {
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
      // MEMORY LEAK FIX: Reuse tempQuaternion1 instead of creating new Quaternion
      tempQuaternion1.setFromUnitVectors(currentUpDir, newUpDir);
      
      // Get current player rotation
      const currentPlayerRotation = playerRigidBody.rotation();
      // MEMORY LEAK FIX: Reuse tempQuaternion2 instead of creating new Quaternion
      tempQuaternion2.set(
        currentPlayerRotation.x,
        currentPlayerRotation.y,
        currentPlayerRotation.z,
        currentPlayerRotation.w
      );
      
      // Apply delta rotation to current player rotation
      // MEMORY LEAK FIX: Reuse tempQuaternion3 instead of creating new Quaternion
      tempQuaternion3.multiplyQuaternions(tempQuaternion1, tempQuaternion2);
      
      // Get current camera up direction for smooth transition
      // MEMORY LEAK FIX: Reuse tempVector3_2 and tempVector3_3 instead of clone()
      tempVector3_2.copy(camera.up);
      tempVector3_3.copy(newUpDir);
      
      // OPTIMIZATION 2: Set up animation state with all completion logic embedded
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

    // Update face context immediately (this still uses React state for UI updates)
    setCurrentFace(newFace);
    isChangingRef.current = true;
    setIsChangingState(true); // Update React state for Player component
    
    // GAMEPLAY MECHANIC: Delay gravity change so player "falls" onto the new face first
    setTimeout(() => {
      gravity.current[0] = newFaceOrientation.gravity[0]
      gravity.current[1] = newFaceOrientation.gravity[1]
      gravity.current[2] = newFaceOrientation.gravity[2]
    }, 200);
  }, []);

  // Expose current gravity value for consumers
  const getCurrentGravity = useCallback(() => gravity.current, []);
  
  // Expose current face for consumers
  const getCurrentFace = useCallback(() => currentFaceRef.current, []);
  
  // Expose changing state for consumers
  const getIsChanging = useCallback(() => isChangingRef.current, []);

  return {
    gravity: gravity.current, // Current gravity value
    getCurrentGravity, // Function to get current gravity (for polling in useFrame)
    checkBoundaries,
    changeGravity,
    updateRotationAnimation,
    isChanging: isChangingState, // React state for Player component (triggers re-renders)
    getIsChanging, // Function to get current changing state
    currentQuadrant: currentFaceRef.current, // Current face
    getCurrentFace // Function to get current face
  };
} 