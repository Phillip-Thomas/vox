import React, { useState } from 'react';
import { Physics } from '@react-three/rapier';
import * as THREE from 'three';
import EfficientPlanet from './EfficientPlanet';
import EfficientPlayer from './EfficientPlayer';

// 🌍 CENTRALIZED PLANET CONFIGURATION 🌍
// This is the SINGLE SOURCE OF TRUTH for planet size
// All components (EfficientPlanet, EfficientPlayer) use this value
// System dynamically allocates resources based on this size - no hardcoded limits!
export const planetSize = 200; // Planet radius in voxel units

export default function EfficientScene() {
  const [playerPosition, setPlayerPosition] = useState<THREE.Vector3>(new THREE.Vector3(0, planetSize*2+10, 0));
  
  return (
    <Physics gravity={[0, -9.81, 0]}>
      <EfficientPlanet size={planetSize} playerPosition={playerPosition} />
      <EfficientPlayer planetSize={planetSize} onPositionChange={setPlayerPosition} />
    </Physics>
  );
} 