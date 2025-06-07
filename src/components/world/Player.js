import React, { useRef, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { WORLD_CONFIG } from '../../constants/world';
import { globalCollisionSystem } from '../../utils/VoxelCollisionSystem';
import { PlayerController } from '../../systems/PlayerController';

export default function Player({ mode, onModeChange, onPlayerControllerReady }) {
  const { camera } = useThree();
  const playerControllerRef = useRef(null);
  const keysPressed = useRef({});

  // Initialize PlayerController and collision system
  useEffect(() => {
    // Only initialize if not already initialized
    if (playerControllerRef.current) return;
    
    // Initialize the modular player controller
    playerControllerRef.current = new PlayerController(camera);
    
    // Notify parent component that PlayerController is ready
    if (onPlayerControllerReady) {
      onPlayerControllerReady(playerControllerRef.current);
    }
    
    // Start the collision system's frame updates
    globalCollisionSystem.startFrameUpdates((collisionData) => {
      // Collision data is handled by PlayerController
    });

    return () => {
      // Stop frame updates when component unmounts
      globalCollisionSystem.stopFrameUpdates();
    };
  }, [camera]); // Removed onPlayerControllerReady from dependencies

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (event) => {
      keysPressed.current[event.code] = true;
      
      // Toggle between dev and player mode
      if (event.code === 'KeyF') {
        const newMode = mode === 'dev' ? 'player' : 'dev';
        if (onModeChange) onModeChange(newMode);
      }



      // Reset player to surface position
      if (event.code === 'KeyR') {
        if (playerControllerRef.current) {
          playerControllerRef.current.resetToSurface();
        }
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

  useFrame((state, deltaTime) => {
    if (!playerControllerRef.current) return;

    // Update input state from keyboard
    const inputState = {
      forward: keysPressed.current['KeyW'] || false,
      backward: keysPressed.current['KeyS'] || false,
      left: keysPressed.current['KeyA'] || false,
      right: keysPressed.current['KeyD'] || false,
      jump: keysPressed.current['Space'] || false,
      up: keysPressed.current['KeyE'] || false,    // Dev mode up
      down: keysPressed.current['KeyQ'] || false   // Dev mode down
    };

    // Set input state and update player controller
    playerControllerRef.current.setInputState(inputState);
    playerControllerRef.current.update(deltaTime, mode);

    // Simple boundary checking - keep player within reasonable bounds
    const bounds = WORLD_CONFIG.WORLD_BOUNDS;
    camera.position.x = Math.max(-bounds, Math.min(bounds, camera.position.x));
    camera.position.z = Math.max(-bounds, Math.min(bounds, camera.position.z));
    camera.position.y = Math.max(-50, Math.min(150, camera.position.y));
  });

  // Render performance stats overlay (optional - can be removed for production)
  return null; // Player component only handles logic, no visual elements
} 