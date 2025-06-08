import React from 'react';
import { Canvas } from '@react-three/fiber';
import { Stats } from '@react-three/drei';
import * as THREE from 'three';
import { PlanetContext } from './context/PlanetContext';
import { PlayerContext } from './context/PlayerContext';
import Planet from './components/Planet';
import Player from './components/Player';
import './App.css';

function App() {
  const [playerState, setPlayerState] = React.useState({ position: new THREE.Vector3() });
  
  const playerConfig = {
    playerState,
    setPlayerState,
    playerHeight: 1.8,
    moveSpeed: {
      walk: 5.0,
      run: 8.0,
      jump: 5.0
    }
  };

  const planetConfig = { 
    radius: 250, 
    voxelSize: 0.5, 
    center: [0,0,0] 
  };

  return (
    <PlanetContext.Provider value={planetConfig}>
    <PlayerContext.Provider value={playerConfig}>
    <Canvas
      camera={{ fov: 60, near: 0.1, far: 1000 }}
      shadows
      style={{ width: '100vw', height: '100vh' }}
    >
      <Stats />
      {/* basic lights & sky */}
      <hemisphereLight skyColor={0x87ceeb} groundColor={0x444444} intensity={0.6} />
      <directionalLight position={[100, 200, 100]} intensity={0.8} />

      <Planet />
      <Player />
    </Canvas>
    </PlayerContext.Provider>
    </PlanetContext.Provider>
  );
}

export default App; 