import React, { useRef, useEffect } from 'react';
import { RigidBody } from '@react-three/rapier';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

const PLAYER_WIDTH = 1;
const PLAYER_HEIGHT = 2;
const CAMERA_OFFSET = [0, PLAYER_HEIGHT / 2, 0];

export default function Player() {
  const rigidBody = useRef(null);
  const { camera } = useThree();

  // Attach camera to the top of the player
  useEffect(() => {
    if (!rigidBody.current) return;
    const updateCamera = () => {
      const position = rigidBody.current.translation();
      camera.position.set(
        position.x + CAMERA_OFFSET[0],
        position.y + CAMERA_OFFSET[1],
        position.z + CAMERA_OFFSET[2]
      );
    };
    // Update camera every frame
    const id = setInterval(updateCamera, 16);
    return () => clearInterval(id);
  }, [camera]);

  return (
    <RigidBody
      ref={rigidBody}
      colliders="cuboid"
      position={[0, 5, 0]}
      mass={1}
      type="dynamic"
      enabledRotations={[false, false, false]}
    >
      {/* Two stacked red voxels */}
      <group>
        <mesh position={[0, -0.5, 0]}>
          <boxGeometry args={[PLAYER_WIDTH, 1, PLAYER_WIDTH]} />
          <meshStandardMaterial color="red" />
        </mesh>
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[PLAYER_WIDTH, 1, PLAYER_WIDTH]} />
          <meshStandardMaterial color="red" />
        </mesh>
      </group>
    </RigidBody>
  );
} 