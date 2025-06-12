import { useRef, useCallback, useState } from 'react';
import * as THREE from 'three';
import { CUBE_SIZE_X, CUBE_SIZE_Y, CUBE_SIZE_Z, calculateWorldOffset } from '../utils/voxelUtils';
import { CubeFace, FACE_ORIENTATIONS } from '../context/PlayerContext';

export function usePlanetGravity(voxelSize: number) {
  const [gravity, setGravity] = useState<[number, number, number]>([0, -9.81, 0]);
  const [isChanging, setIsChanging] = useState(false);
  
  const startTime = useRef<number>(Date.now());
  const [currentQuadrant, setCurrentQuadrant] = useState<CubeFace>('top');
  const offset = calculateWorldOffset(voxelSize);
  
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
    const directionFromCenter = new THREE.Vector3().subVectors(playerPosition, cubeCenter);
    
    // Find which face normal the player's direction most closely aligns with
    let maxDot = -Infinity;
    let closestFace: CubeFace = 'top';
    const dotProducts: Record<string, number> = {};
    
    Object.entries(faceNormals).forEach(([face, normal]) => {
      const dot = directionFromCenter.dot(normal);
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

  const changeGravity = useCallback((newFace: CubeFace, playerRigidBody: any, setCurrentFace: (face: CubeFace) => void, currentFace?: CubeFace) => {
    if (isChanging || !playerRigidBody) return;

    const newFaceOrientation = FACE_ORIENTATIONS[newFace];
    
    console.log(`🔄 Face transition: ${currentFace || 'unknown'} → ${newFace}`);

    // Calculate rotation delta between current and new face
    playerRigidBody.lockRotations(false);
    
    if (currentFace) {
      // Alternative approach: Use upDirection vectors to calculate rotation
      const currentFaceOrientation = FACE_ORIENTATIONS[currentFace];
      const currentUpDir = currentFaceOrientation.upDirection;
      const newUpDir = newFaceOrientation.upDirection;
      
      console.log(`📐 Current face ${currentFace} up:`, currentUpDir);
      console.log(`📐 New face ${newFace} up:`, newUpDir);
      
      // Calculate rotation needed to transform current up to new up
      const deltaQuaternion = new THREE.Quaternion().setFromUnitVectors(currentUpDir, newUpDir);
      
      console.log(`📐 Delta quaternion (upDirection method):`, deltaQuaternion);
      
      // Get current player rotation
      const currentPlayerRotation = playerRigidBody.rotation();
      const currentPlayerQuat = new THREE.Quaternion(
        currentPlayerRotation.x,
        currentPlayerRotation.y,
        currentPlayerRotation.z,
        currentPlayerRotation.w
      );
      
      console.log(`📐 Current player quaternion:`, currentPlayerQuat);
      
      // Apply delta rotation to current player rotation
      const finalRotation = new THREE.Quaternion()
        .multiplyQuaternions(deltaQuaternion, currentPlayerQuat);
      
      console.log(`📐 Final player quaternion:`, finalRotation);
      
      playerRigidBody.setRotation({
        x: finalRotation.x,
        y: finalRotation.y,
        z: finalRotation.z,
        w: finalRotation.w
      }, true);
      
      console.log(`🔄 Applied upDirection delta rotation from ${currentFace} to ${newFace}`);
    } else {
      // First transition - apply new face rotation directly
      const quaternion = new THREE.Quaternion().setFromEuler(newFaceOrientation.characterRotation);
      playerRigidBody.setRotation({
        x: quaternion.x,
        y: quaternion.y,
        z: quaternion.z,
        w: quaternion.w
      }, true);
      
      console.log(`🔄 Applied initial rotation to ${newFace}`);
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
    
    // Reset changing state after rotation completes
    setTimeout(() => {
      setIsChanging(false);
      console.log(`✅ Face transition completed successfully - Now on face: ${newFace}`);
    }, 1500);
  }, [isChanging]);


  return {
    gravity,
    checkBoundaries,
    changeGravity,
    isChanging: isChanging,
    currentQuadrant
  };
} 