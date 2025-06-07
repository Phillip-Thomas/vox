import React, { useRef, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { WORLD_CONFIG } from '../../constants/world';

export default function Player({ onModeChange }) {
  const { camera } = useThree();
  const [mode, setMode] = useState('dev'); // 'dev' or 'player'
  const [isGrounded, setIsGrounded] = useState(true);
  const velocityRef = useRef(new Vector3());
  
  const keysPressed = useRef({});
  const MOVE_SPEED = 0.5;
  const JUMP_FORCE = 0.4;
  const GRAVITY = 0.015;

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (event) => {
      keysPressed.current[event.code] = true;
      
      // Toggle between dev and player mode
      if (event.code === 'KeyF') {
        const newMode = mode === 'dev' ? 'player' : 'dev';
        setMode(newMode);
        if (onModeChange) onModeChange(newMode);
      }
    };

    const handleKeyUp = (event) => {
      keysPressed.current[event.code] = false;
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [mode, onModeChange]);

  useFrame(() => {
    const keys = keysPressed.current;
    const moveVector = new Vector3();
    const velocity = velocityRef.current;

    // Basic WASD movement
    if (keys['KeyW']) moveVector.z -= MOVE_SPEED;
    if (keys['KeyS']) moveVector.z += MOVE_SPEED;
    if (keys['KeyA']) moveVector.x -= MOVE_SPEED;
    if (keys['KeyD']) moveVector.x += MOVE_SPEED;

    if (mode === 'dev') {
      // Dev mode - free flying with Q/E for up/down
      if (keys['KeyQ']) moveVector.y -= MOVE_SPEED;
      if (keys['KeyE']) moveVector.y += MOVE_SPEED;
      
      // Apply movement directly to camera
      camera.position.add(moveVector);
      
      // Reset velocity and grounded state in dev mode
      velocity.set(0, 0, 0);
      setIsGrounded(true);
    } else {
      // Player mode - physics-based movement
      
      // Handle jumping
      if (keys['Space'] && isGrounded) {
        velocity.y = JUMP_FORCE;
        setIsGrounded(false);
      }

      // Apply gravity when not grounded
      if (!isGrounded) {
        velocity.y -= GRAVITY;
      }

      // Simple ground check (enhance this with proper collision detection later)
      const groundLevel = 2;
      if (camera.position.y <= groundLevel && velocity.y <= 0) {
        camera.position.y = groundLevel;
        velocity.y = 0;
        setIsGrounded(true);
      }

      // Transform movement relative to camera direction for player mode
      if (moveVector.length() > 0) {
        // Get camera forward and right vectors
        const forward = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        const right = new Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        
        // Remove Y component to keep movement horizontal
        forward.y = 0;
        right.y = 0;
        forward.normalize();
        right.normalize();
        
        // Calculate movement direction
        const direction = new Vector3();
        direction.addScaledVector(forward, -moveVector.z); // W/S
        direction.addScaledVector(right, moveVector.x);    // A/D
        
        // Apply horizontal movement
        camera.position.add(direction);
      }

      // Apply vertical velocity (jumping/falling)
      camera.position.y += velocity.y;
    }

    // Keep player within world bounds using WORLD_CONFIG
    const bounds = WORLD_CONFIG.WORLD_BOUNDS;
    camera.position.x = Math.max(-bounds, Math.min(bounds, camera.position.x));
    camera.position.z = Math.max(-bounds, Math.min(bounds, camera.position.z));
    camera.position.y = Math.max(1, Math.min(100, camera.position.y));
  });

  // Return null since this component only handles logic, no visual elements
  return null;
} 