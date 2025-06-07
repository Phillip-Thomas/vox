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

    // Pass relative rotation inputs to PlayerController for all modes
    if (playerController.setRelativeRotation) {
      playerController.setRelativeRotation(
        relativeRotationRef.current.yaw,
        relativeRotationRef.current.pitch
      );
    }
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