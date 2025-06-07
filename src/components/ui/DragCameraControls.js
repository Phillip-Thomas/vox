import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector2, Euler } from 'three';

const DragCameraControls = ({ enabled = true }) => {
  const { camera, gl } = useThree();
  const isDragRef = useRef(false);
  const previousMousePositionRef = useRef(new Vector2());
  const rotationRef = useRef({ x: 0, y: 0 }); // Store rotation values
  const mouseSensitivity = 0.003;

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

      // Update rotation values
      // Horizontal movement controls yaw (rotation around Y axis)
      rotationRef.current.y -= deltaX * mouseSensitivity;
      
      // Vertical movement controls pitch (rotation around X axis)
      rotationRef.current.x -= deltaY * mouseSensitivity;

      // Clamp vertical rotation to prevent flipping
      rotationRef.current.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotationRef.current.x));

      // Apply rotations in the correct order (YXZ)
      camera.rotation.order = 'YXZ';
      camera.rotation.y = rotationRef.current.y;
      camera.rotation.x = rotationRef.current.x;
      camera.rotation.z = 0; // Keep roll at 0

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

  // This component doesn't render anything, it just handles camera controls
  return null;
};

export default DragCameraControls; 