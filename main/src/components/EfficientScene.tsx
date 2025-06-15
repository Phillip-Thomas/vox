import React, { useState } from 'react';
import { Physics } from '@react-three/rapier';
import * as THREE from 'three';
import EfficientPlanet from './EfficientPlanet';
import EfficientPlayer from './EfficientPlayer';

export default function EfficientScene() {
  // 🌍 CENTRALIZED PLANET CONFIGURATION 🌍
  // This is the SINGLE SOURCE OF TRUTH for planet size
  // All components (EfficientPlanet, EfficientPlayer) use this value
  // System dynamically allocates resources based on this size - no hardcoded limits!
  const planetSize = 50; // Planet radius in voxel units
  const [playerPosition, setPlayerPosition] = useState<THREE.Vector3>(new THREE.Vector3(0, planetSize*2+10, 0));
  
  return (
    <Physics gravity={[0, -9.81, 0]}>
      <EfficientPlanet size={planetSize} playerPosition={playerPosition} />
      <EfficientPlayer planetSize={planetSize} onPositionChange={setPlayerPosition} />
    </Physics>
  );
} 