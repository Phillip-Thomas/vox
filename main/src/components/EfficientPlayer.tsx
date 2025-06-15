import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
// @ts-ignore - CapsuleCollider exists at runtime but not in types
import { RigidBody, CapsuleCollider } from '@react-three/rapier';
import { useKeyboardControls, PerspectiveCamera } from '@react-three/drei';
import { voxelSystem } from '../utils/efficientVoxelSystem';
import { efficientPlanetMesh } from './EfficientPlanet';
import { MATERIALS, MaterialType } from '../types/materials';
import CameraControls from './CameraControls';

// Simple raycaster for voxel interaction
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(0, 0); // Screen center

const SPEED = 5;

interface EfficientPlayerProps {
  planetSize?: number;
  onPositionChange?: (position: THREE.Vector3) => void;
}

export default function EfficientPlayer({ planetSize, onPositionChange }: EfficientPlayerProps) {
  // Ensure planetSize is provided - no default to force explicit configuration
  if (planetSize === undefined) {
    throw new Error('EfficientPlayer: planetSize prop is required - configure in EfficientScene');
  }
  const ref = useRef<any>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const [, get] = useKeyboardControls();
  
  // Track previous delete key state for single-press detection
  const prevDeleteKeyRef = useRef(false);
  
  useFrame((state) => {
    if (!ref.current) return;
    
    // CRITICAL: Wake up the rigid body every frame to prevent sleeping/getting stuck
    if (ref.current.wakeUp) {
      ref.current.wakeUp();
    }
    
    // Debug: Check if player is sleeping (log occasionally)
    if (ref.current.isSleeping && Math.random() < 0.01) { // 1% chance per frame
      console.log(`😴 Player was sleeping, waking up...`);
    }
    
    // Update player position for proximity-based collision
    if (onPositionChange) {
      const position = ref.current.translation();
      onPositionChange(new THREE.Vector3(position.x, position.y, position.z));
    }
    
    const { forward, backward, left, right, jump, delete: deleteKey } = get();
    
    // Movement using camera-relative directions
    const direction = new THREE.Vector3();
    
    if (forward || backward || left || right) {
      // Ensure player is awake when trying to move
      if (ref.current.wakeUp) {
        ref.current.wakeUp();
      }
      
      // Get camera direction for movement
      const cameraDirection = new THREE.Vector3();
      if (cameraRef.current) {
        cameraRef.current.getWorldDirection(cameraDirection);
        
        // Calculate right vector
        const rightVector = new THREE.Vector3();
        rightVector.crossVectors(cameraDirection, cameraRef.current.up).normalize();
        
        // Build movement direction
        if (forward) direction.add(cameraDirection);
        if (backward) direction.sub(cameraDirection);
        if (right) direction.add(rightVector);
        if (left) direction.sub(rightVector);
        
        // Normalize and apply speed
        if (direction.length() > 0) {
          direction.normalize().multiplyScalar(SPEED);
          
          // Apply movement while preserving Y velocity (gravity)
          const currentVel = ref.current.linvel();
          ref.current.setLinvel({
            x: direction.x,
            y: currentVel.y, // Preserve gravity
            z: direction.z
          });
        }
      }
    }
    
    // Jumping
    if (jump) {
      // Ensure player is awake when jumping
      if (ref.current.wakeUp) {
        ref.current.wakeUp();
      }
      
      const currentVel = ref.current.linvel();
      ref.current.setLinvel({
        x: currentVel.x,
        y: Math.max(currentVel.y, 8), // Jump force
        z: currentVel.z
      });
    }
    
    // Handle voxel deletion with E key - only on fresh key press
    const deleteKeyPressed = deleteKey && !prevDeleteKeyRef.current; // Fresh press detection
    prevDeleteKeyRef.current = deleteKey; // Update previous state
    
    if (deleteKeyPressed) {
      handleVoxelDeletion(cameraRef.current);
    }
  });
  
  const handleVoxelDeletion = (camera: THREE.Camera | null) => {
    if (!camera) return;
    
    const mesh = efficientPlanetMesh.current;
    if (!mesh) return;
    
    // Cast ray from camera center
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(mesh);
    
    if (intersects.length > 0 && intersects[0].instanceId !== undefined) {
      const instanceId = intersects[0].instanceId;
      
      // Find which voxel this instance represents
      const allVoxels = voxelSystem.getAllVoxels();
      let targetVoxel: {x: number, y: number, z: number} | null = null;
      
      for (const [coordKey, voxelData] of allVoxels) {
        if (voxelData.meshSlot === instanceId) {
          const [x, y, z] = coordKey.split(',').map(Number);
          targetVoxel = { x, y, z };
          break;
        }
      }
      
      if (targetVoxel) {
        console.log(`🎯 Deleting voxel at (${targetVoxel.x}, ${targetVoxel.y}, ${targetVoxel.z})`);
        
        // Remove the voxel
        voxelSystem.removeVoxel(targetVoxel.x, targetVoxel.y, targetVoxel.z);
        
        // Expose any neighbors that should now be visible
        voxelSystem.exposeNeighbors(targetVoxel.x, targetVoxel.y, targetVoxel.z, generateMaterialForPosition);
        
        console.log('📊 Updated stats:', voxelSystem.getStats());
      }
    }
  };
  
  return (
    <>
      <CameraControls cameraRef={cameraRef} />
      <RigidBody 
        ref={ref} 
        colliders={false}
        mass={1}
        type="dynamic" 
        position={[0, planetSize*2+10, 0]}
        lockRotations={true}
        linearDamping={0.5}
        angularDamping={0.8}
        canSleep={false}
      >
        {/* Physics collider */}
        <CapsuleCollider args={[0.5, 0.5]} />
        
        {/* Camera attached to player */}
        <PerspectiveCamera 
          ref={cameraRef} 
          position={[0, 1, 0]} 
          makeDefault 
          fov={75} 
          far={100} 
        />
        
        {/* Visual representation */}
        <mesh>
          <capsuleGeometry args={[0.5, 1]} />
          <meshStandardMaterial color="blue" />
        </mesh>
      </RigidBody>
    </>
  );
}

// Simple material generator for newly exposed voxels
function generateMaterialForPosition(x: number, y: number, z: number): {material: string, color: THREE.Color} {
  const distance = Math.sqrt(x*x + y*y + z*z);
  
  // Simple material based on distance from center
  if (distance < 3) {
    return { material: MaterialType.LAVA, color: MATERIALS[MaterialType.LAVA].color.clone() };
  } else if (distance < 8) {
    return { material: MaterialType.STONE, color: MATERIALS[MaterialType.STONE].color.clone() };
  } else {
    return { material: MaterialType.DIRT, color: MATERIALS[MaterialType.DIRT].color.clone() };
  }
} 