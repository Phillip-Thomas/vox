import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
const { Vector2, Vector3, Quaternion, Euler } = THREE;

const DragCameraControls = ({ enabled = true, playerController = null }) => {
  const { camera, gl } = useThree();
  const isDragRef = useRef(false);
  const previousMousePositionRef = useRef(new Vector2());
  
  // Store relative rotation inputs instead of absolute rotations
  const relativeRotationRef = useRef({ yaw: 0, pitch: 0 });
  const mouseSensitivity = 0.003;
  const maxPitch = Math.PI / 3; // Limit looking up/down to 60 degrees

  useEffect(() => {
    if (!enabled) return;

    const canvas = gl.domElement;

    const handleMouseDown = (event) => {
      if (event.button === 0) { // Left mouse button
        isDragRef.current = true;
        previousMousePositionRef.current.set(event.clientX, event.clientY);
        canvas.style.cursor = 'grabbing';
        event.preventDefault();
      }
    };

    const handleMouseMove = (event) => {
      if (!isDragRef.current) return;

      const deltaX = event.clientX - previousMousePositionRef.current.x;
      const deltaY = event.clientY - previousMousePositionRef.current.y;

      // Update relative rotation values
      relativeRotationRef.current.yaw -= deltaX * mouseSensitivity;
      relativeRotationRef.current.pitch -= deltaY * mouseSensitivity;
      
      // Clamp pitch to prevent excessive looking up/down
      relativeRotationRef.current.pitch = Math.max(
        -maxPitch, 
        Math.min(maxPitch, relativeRotationRef.current.pitch)
      );

      previousMousePositionRef.current.set(event.clientX, event.clientY);
      event.preventDefault();
    };

    const handleMouseUp = (event) => {
      if (event.button === 0) { // Left mouse button
        isDragRef.current = false;
        canvas.style.cursor = 'grab';
        event.preventDefault();
      }
    };

    const handleMouseLeave = () => {
      isDragRef.current = false;
      canvas.style.cursor = 'default';
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    // Set initial cursor style
    canvas.style.cursor = 'grab';

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      canvas.style.cursor = 'default';
    };
  }, [enabled, camera, gl, mouseSensitivity]);

  // Apply relative rotations to camera orientation each frame
  useFrame(() => {
    if (!enabled || !playerController) return;

    // Only apply drag controls in player mode, and only when PlayerController allows it
    if (!playerController.allowCameraControl) {
      // Pass relative rotation inputs to PlayerController instead of directly controlling camera
      if (playerController.setRelativeRotation) {
        playerController.setRelativeRotation(
          relativeRotationRef.current.yaw,
          relativeRotationRef.current.pitch
        );
        
        // Debug logging removed to prevent spam
      }
      return;
    }

    // Dev mode: Apply rotations directly (for free-flying camera)
    const upDirection = playerController.getRadialDirection();
    
    // Create base orientation aligned with planet surface
    const forward = new Vector3(0, 0, -1); // Default forward
    const tangentialForward = forward.clone().sub(
      upDirection.clone().multiplyScalar(forward.dot(upDirection))
    ).normalize();
    
    const rightDirection = new Vector3().crossVectors(tangentialForward, upDirection).normalize();
    
    // Apply relative yaw rotation around the up direction
    const yawRotation = new Quaternion().setFromAxisAngle(upDirection, relativeRotationRef.current.yaw);
    const rotatedForward = tangentialForward.clone().applyQuaternion(yawRotation);
    const rotatedRight = rightDirection.clone().applyQuaternion(yawRotation);
    
    // Apply relative pitch rotation around the right direction
    const pitchRotation = new Quaternion().setFromAxisAngle(rotatedRight, relativeRotationRef.current.pitch);
    const finalForward = rotatedForward.clone().applyQuaternion(pitchRotation);
    const finalUp = upDirection.clone().applyQuaternion(pitchRotation);
    
    // Recalculate right to maintain orthogonality
    const finalRight = new Vector3().crossVectors(finalForward, finalUp).normalize();
    
    // Create final rotation matrix and apply to camera
    const rotationMatrix = new THREE.Matrix4();
    rotationMatrix.makeBasis(finalRight, finalUp, finalForward.multiplyScalar(-1));
    
    const targetQuaternion = new Quaternion().setFromRotationMatrix(rotationMatrix);
    camera.quaternion.copy(targetQuaternion);
  });

  // Method to reset relative rotations (useful for debugging)
  const resetRotation = () => {
    relativeRotationRef.current.yaw = 0;
    relativeRotationRef.current.pitch = 0;
  };

  // Expose the reset method
  React.useImperativeHandle(playerController?.dragControlsRef, () => ({
    resetRotation
  }));

  return null;
};

export default DragCameraControls; 