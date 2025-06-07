import React, { useRef, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { WORLD_CONFIG } from '../../constants/world';
import { globalCollisionSystem } from '../../utils/VoxelCollisionSystem';

export default function Player({ mode, onModeChange }) {
  const { camera } = useThree();
  const isGroundedRef = useRef(true); // Use ref for more reliable state management
  const velocityRef = useRef(new Vector3());
  const jumpInputRef = useRef(false); // Track jump input separately
  const lastJumpTimeRef = useRef(0); // Prevent jump spam
  
  const keysPressed = useRef({});
  const MOVE_SPEED = 0.5;
  const JUMP_FORCE = 0.5; // Increased jump force
  const GRAVITY = 0.02; // Slightly increased gravity

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (event) => {
      keysPressed.current[event.code] = true;
      
      // Toggle between dev and player mode
      if (event.code === 'KeyF') {
        const newMode = mode === 'dev' ? 'player' : 'dev';
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
      isGroundedRef.current = true;
    } else {
      // Player mode - physics-based movement with collision detection
      
      // Handle jumping with more reliable input detection
      if (keys['Space']) {
        jumpInputRef.current = true;
      } else {
        jumpInputRef.current = false;
      }

      // Apply jump if input is pressed and player is grounded
      const now = Date.now();
      const canJump = isGroundedRef.current && 
                      velocity.y <= 0.1 && 
                      (now - lastJumpTimeRef.current) > 100; // 100ms cooldown
      
      if (jumpInputRef.current && canJump) {
        velocity.y = JUMP_FORCE;
        isGroundedRef.current = false; // Set airborne immediately
        lastJumpTimeRef.current = now;
        console.log('Jump triggered!', { velocity: velocity.y, grounded: isGroundedRef.current }); // Debug log
      }

      // Apply gravity when not grounded
      if (!isGroundedRef.current || velocity.y > 0) {
        velocity.y -= GRAVITY;
      }

      // Calculate target position with movement
      const targetPosition = camera.position.clone();
      
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
        
        // Apply horizontal movement to target position
        targetPosition.add(direction);
      }

      // Apply vertical velocity (jumping/falling) to target position
      targetPosition.y += velocity.y;

      // Check collision and get corrected position
      const collisionResult = globalCollisionSystem.checkPlayerCollision(
        camera.position,
        targetPosition,
        velocity
      );

      // Debug: Log collision results periodically
      if (Math.floor(Date.now() / 1000) % 2 === 0 && Date.now() % 1000 < 16) { // Every 2 seconds
        console.log('Collision check:', {
          currentPos: camera.position.toArray().map(n => n.toFixed(1)),
          targetPos: targetPosition.toArray().map(n => n.toFixed(1)),
          onGround: collisionResult.onGround,
          velocity: velocity.toArray().map(n => n.toFixed(2))
        });
      }

      // Apply collision results
      camera.position.copy(collisionResult.position);
      velocity.copy(collisionResult.velocity);
      
      // Update grounded state with debug logging
      const wasGrounded = isGroundedRef.current;
      isGroundedRef.current = collisionResult.onGround;
      
      if (!wasGrounded && isGroundedRef.current) {
        console.log('Player landed on ground'); // Debug log
      }

      // Apply material-specific effects (like friction)
      if (collisionResult.materialProperties && collisionResult.onGround) {
        const friction = collisionResult.materialProperties.friction;
        // Apply friction to horizontal movement (future enhancement)
        // This could affect sliding on ice, sand, etc.
      }
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