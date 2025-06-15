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

// Animation state interface
interface RotationAnimation {
  isActive: boolean;
  startTime: number;
  duration: number;
  startRotation: { x: number; y: number; z: number; w: number };
  targetRotation: { x: number; y: number; z: number; w: number };
  startCameraUp: { x: number; y: number; z: number };
  targetCameraUp: { x: number; y: number; z: number };
  playerRigidBody: any;
  camera: THREE.Camera;
}

export function usePlanetGravity(voxelSize: number) {
  const [gravity, setGravity] = useState<[number, number, number]>([0, -9.81, 0]);
  const [isChanging, setIsChanging] = useState(false);
  
  const startTime = useRef<number>(Date.now());
  const [currentQuadrant, setCurrentQuadrant] = useState<CubeFace>('top');
  const offset = calculateWorldOffset(voxelSize);
  
  // Animation state for smooth transitions
  const rotationAnimation = useRef<RotationAnimation | null>(null);
  
  // Calculate cube center in world coordinates
  // The calculateWorldOffset is designed to center the cube at the origin
  const cubeCenter = new THREE.Vector3(0, 0, 0);

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
    // Calculate vector from cube center to player
    // MEMORY LEAK FIX: Reuse tempVector3 instead of creating new Vector3
    tempVector3.subVectors(playerPosition, cubeCenter);
    
    // Find which face normal the player's direction most closely aligns with
    let maxDot = -Infinity;
    let closestFace: CubeFace = 'top';
    const dotProducts: Record<string, number> = {};
    
    Object.entries(faceNormals).forEach(([face, normal]) => {
      const dot = tempVector3.dot(normal);
      dotProducts[face] = dot;
      if (dot > maxDot) {
        maxDot = dot;
        closestFace = face as CubeFace;
      }
    });
    
    return closestFace;
  }, [cubeCenter]);

  const checkBoundaries = useCallback((playerPosition: THREE.Vector3) => {
    if (isChanging) return null;
    
    // Wait 0.5 seconds after start before enabling boundary checks
    const timeSinceStart = Date.now() - startTime.current;
    if (timeSinceStart < 500) return null;

    const newQuadrant = determineQuadrant(playerPosition);
    
    // Only trigger change if quadrant actually changed
    if (newQuadrant !== currentQuadrant) {
      setCurrentQuadrant(newQuadrant);
      return newQuadrant;
    }
    
    return null;
  }, [currentQuadrant, determineQuadrant, isChanging]);

  // Function to update rotation animation (called from useFrame)
  const updateRotationAnimation = useCallback((deltaTime: number) => {
    if (!rotationAnimation.current || !rotationAnimation.current.isActive) return;

    const animation = rotationAnimation.current;
    const now = performance.now();
    const elapsed = now - animation.startTime;
    const progress = Math.min(elapsed / animation.duration, 1);
    
    // Use smooth easing function for natural transition
    const easedProgress = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    
    // MEMORY LEAK FIX: Reuse temp quaternions instead of cloning and creating new ones
    tempQuaternion1.set(animation.startRotation.x, animation.startRotation.y, animation.startRotation.z, animation.startRotation.w);
    tempQuaternion2.set(animation.targetRotation.x, animation.targetRotation.y, animation.targetRotation.z, animation.targetRotation.w);
    tempQuaternion1.slerp(tempQuaternion2, easedProgress);
    
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
    
    // Check if animation is complete
    if (progress >= 1) {
      rotationAnimation.current.isActive = false;
      rotationAnimation.current = null;
      console.log(`🎯 Face transition animation completed in ${elapsed.toFixed(1)}ms`);
    }
  }, []);

  const changeGravity = useCallback((newFace: CubeFace, playerRigidBody: any, setCurrentFace: (face: CubeFace) => void, camera?: THREE.Camera, currentFace?: CubeFace) => {
    if (isChanging || !playerRigidBody) return;

    const newFaceOrientation = FACE_ORIENTATIONS[newFace];
    
    console.log(`📐 Final player quaternion: Starting transition to ${newFace}`);

    // Calculate rotation delta between current and new face
    playerRigidBody.lockRotations(false);
    
    if (currentFace && camera) {
      // Alternative approach: Use upDirection vectors to calculate rotation
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
      
      console.log(`📷 Current camera up:`, tempVector3_2);
      console.log(`📷 Target camera up:`, tempVector3_3);
      
             // PERFORMANCE FIX: Set up animation state instead of running synchronous loop
       rotationAnimation.current = {
         isActive: true,
         startTime: performance.now(),
         duration: 750, // Balanced: faster than original 1s but smooth enough
        startRotation: { x: tempQuaternion2.x, y: tempQuaternion2.y, z: tempQuaternion2.z, w: tempQuaternion2.w },
        targetRotation: { x: tempQuaternion3.x, y: tempQuaternion3.y, z: tempQuaternion3.z, w: tempQuaternion3.w },
        startCameraUp: { x: tempVector3_2.x, y: tempVector3_2.y, z: tempVector3_2.z },
        targetCameraUp: { x: tempVector3_3.x, y: tempVector3_3.y, z: tempVector3_3.z },
        playerRigidBody,
        camera
      };

      console.log(`🔄 Applied upDirection delta rotation from ${currentFace} to ${newFace}`);
    }
    
    // Complete player rotation setup
    playerRigidBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
    setTimeout(() => playerRigidBody.lockRotations(true), 100);

    // Update face context
    setCurrentFace(newFace);
    setIsChanging(true);
    
    // Delay gravity change by 0.2 seconds after body rotation
    setTimeout(() => {
      setGravity(newFaceOrientation.gravity);
      console.log(`⬇️ Gravity changed to: [${newFaceOrientation.gravity[0]}, ${newFaceOrientation.gravity[1]}, ${newFaceOrientation.gravity[2]}] (delayed by 200ms)`);
    }, 200);
    
    // Reset changing state after rotation completes (reduced timeout to match shorter animation)
    setTimeout(() => {
      setIsChanging(false);
      console.log(`✅ Face transition completed successfully - Now on face: ${newFace}`);
    }, 1000); // Slightly longer than animation duration for safety
  }, [isChanging]);


  return {
    gravity,
    checkBoundaries,
    changeGravity,
    updateRotationAnimation,
    isChanging: isChanging,
    currentQuadrant
  };
} 