import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { globalCollisionSystem } from '../../utils/VoxelCollisionSystem';

const CollisionDebugger = ({ enabled = false, showActiveRegion = false, showPlayerAABB = false, showBodyCenter = false }) => {
  const activeRegionRef = useRef();
  const playerAABBRef = useRef();
  const bodyCenterRef = useRef();
  
  // Create geometries for visualization
  const boxGeometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const sphereGeometry = useMemo(() => new THREE.SphereGeometry(0.1, 8, 8), []);
  
  const wireframeMaterial = useMemo(() => new THREE.MeshBasicMaterial({ 
    color: 0x00ff00, 
    wireframe: true,
    transparent: true,
    opacity: 0.3
  }), []);
  
  const playerAABBMaterial = useMemo(() => new THREE.MeshBasicMaterial({ 
    color: 0xff0000, 
    wireframe: true,
    transparent: true,
    opacity: 0.5
  }), []);

  const bodyCenterMaterial = useMemo(() => new THREE.MeshBasicMaterial({ 
    color: 0xffff00
  }), []);

  useFrame(({ camera }) => {
    if (!enabled) return;
    
    // Update active collision region visualization
    if (showActiveRegion && activeRegionRef.current) {
      const region = globalCollisionSystem.activeCollisionRegion;
      if (region) {
        const center = region.getCenter(new THREE.Vector3());
        const size = region.getSize(new THREE.Vector3());
        
        activeRegionRef.current.position.copy(center);
        activeRegionRef.current.scale.copy(size);
      }
    }
    
    // Update player AABB visualization  
    if (showPlayerAABB && playerAABBRef.current) {
      const playerAABB = globalCollisionSystem.playerAABB;
      if (playerAABB) {
        const center = playerAABB.getCenter(new THREE.Vector3());
        const size = playerAABB.getSize(new THREE.Vector3());
        
        playerAABBRef.current.position.copy(center);
        playerAABBRef.current.scale.copy(size);
      }
    }

    // Update body center visualization
    if (showBodyCenter && bodyCenterRef.current) {
      const bodyCenter = globalCollisionSystem.playerBodyCenter;
      if (bodyCenter) {
        bodyCenterRef.current.position.copy(bodyCenter);
      }
    }
  });

  if (!enabled) return null;

  return (
    <group>
      {/* Active collision region */}
      {showActiveRegion && (
        <mesh ref={activeRegionRef} geometry={boxGeometry} material={wireframeMaterial} />
      )}
      
      {/* Player AABB - now shows 3x3x3 collision body */}
      {showPlayerAABB && (
        <mesh ref={playerAABBRef} geometry={boxGeometry} material={playerAABBMaterial} />
      )}

      {/* Body center indicator */}
      {showBodyCenter && (
        <mesh ref={bodyCenterRef} geometry={sphereGeometry} material={bodyCenterMaterial} />
      )}
    </group>
  );
};

export default CollisionDebugger; 