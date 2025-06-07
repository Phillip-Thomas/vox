import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const Player = () => {
  const { camera } = useThree();
  const velocity = useRef(new THREE.Vector3());
  const direction = useRef(new THREE.Vector3());
  const keys = useRef({});

  // Player physics constants
  const MOVEMENT_SPEED = 5;
  const JUMP_SPEED = 8;
  const GRAVITY = -20;
  const GROUND_LEVEL = 10; // Approximate ground level

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (event) => {
      keys.current[event.code] = true;
    };

    const handleKeyUp = (event) => {
      keys.current[event.code] = false;
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Update player movement each frame
  useFrame((state, delta) => {
    
    // Reset movement direction
    direction.current.set(0, 0, 0);

    // Get camera forward and right vectors
    const forward = new THREE.Vector3();
    state.camera.getWorldDirection(forward);
    forward.y = 0; // Remove vertical component for horizontal movement
    forward.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(forward, state.camera.up).normalize();

    // Handle movement input
    if (keys.current['KeyW']) {
      direction.current.add(forward);
    }
    if (keys.current['KeyS']) {
      direction.current.sub(forward);
    }
    if (keys.current['KeyA']) {
      direction.current.sub(right);
    }
    if (keys.current['KeyD']) {
      direction.current.add(right);
    }

    // Normalize diagonal movement
    if (direction.current.length() > 0) {
      direction.current.normalize();
      direction.current.multiplyScalar(MOVEMENT_SPEED);
    }

    // Apply horizontal movement
    velocity.current.x = direction.current.x;
    velocity.current.z = direction.current.z;

    // Handle jumping
    if (keys.current['Space'] && Math.abs(state.camera.position.y - GROUND_LEVEL) < 1) {
      velocity.current.y = JUMP_SPEED;
    }

    // Apply gravity
    velocity.current.y += GRAVITY * delta;

    // Apply movement to camera
    state.camera.position.add(velocity.current.clone().multiplyScalar(delta));

    // Simple ground collision
    if (state.camera.position.y < GROUND_LEVEL) {
      state.camera.position.y = GROUND_LEVEL;
      velocity.current.y = 0;
    }

    // Keep player within reasonable bounds
    const WORLD_BOUND = 50;
    state.camera.position.x = THREE.MathUtils.clamp(state.camera.position.x, -WORLD_BOUND, WORLD_BOUND);
    state.camera.position.z = THREE.MathUtils.clamp(state.camera.position.z, -WORLD_BOUND, WORLD_BOUND);
  });

  // Visual representation of the player (optional - just for debugging)
  return (
    <mesh position={[0, GROUND_LEVEL - 1, 0]} visible={false}>
      <boxGeometry args={[1, 2, 1]} />
      <meshBasicMaterial color="blue" />
    </mesh>
  );
};

export default Player; 