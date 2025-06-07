import React from 'react';
import { Canvas } from '@react-three/fiber';
import { Sky, PointerLockControls, Stats } from '@react-three/drei';
import Game from './components/Game';
import './App.css';

function App() {
  return (
    <div className="App">
      <Canvas
        camera={{
          position: [0, 10, 0],
          fov: 60,
          near: 0.1,
          far: 1000
        }}
        shadows
      >
        <Sky
          distance={450000}
          sunPosition={[0, 1, 0]}
          inclination={0}
          azimuth={0.25}
        />
        <ambientLight intensity={0.4} />
        <directionalLight 
          position={[10, 10, 5]} 
          intensity={1} 
          castShadow 
          shadow-mapSize={[2048, 2048]}
        />
        
        <Game />
        
        <PointerLockControls />
        <Stats />
      </Canvas>
      
      <div className="crosshair">+</div>
      <div className="instructions">
        Click to play • WASD to move • Mouse to look around
      </div>
    </div>
  );
}

export default App; 