import React from 'react';
import { Canvas } from '@react-three/fiber';
import { Stats, Sky, KeyboardControls } from '@react-three/drei';
import EfficientScene from './components/EfficientScene.tsx';
import Crosshair from './components/Crosshair.tsx';
import './App.css';

const App: React.FC = () => {
  return (
    <KeyboardControls
      map={[
        { name: 'forward', keys: ['ArrowUp', 'KeyW'] },
        { name: 'backward', keys: ['ArrowDown', 'KeyS'] },
        { name: 'left', keys: ['ArrowLeft', 'KeyA'] },
        { name: 'right', keys: ['ArrowRight', 'KeyD'] },
        { name: 'jump', keys: ['Space'] },
        { name: 'reset', keys: ['KeyR'] },
        { name: 'delete', keys: ['KeyE'] },
      ]}
    >
      <Canvas
        shadows={false}
        gl={{ 
          antialias: false,
          alpha: false,
          powerPreference: "high-performance",
          stencil: false,
          depth: true,
        }}
        performance={{ 
          min: 0.5,
          max: 1.0,
          debounce: 200
        }}
        frameloop="always"
        dpr={[1, 1.5]}
      >
        <Stats />
        <Sky sunPosition={[100, 20, 100]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 10, 5]} intensity={0.4} castShadow={false} />
        
        <EfficientScene />
      </Canvas>
      <Crosshair />
      
      <div style={{
        position: 'absolute',
        top: 10,
        left: 10,
        color: 'white',
        fontFamily: 'monospace',
        background: 'rgba(0,0,0,0.7)',
        padding: '10px',
        borderRadius: '5px'
      }}>
        <h3>Efficient Voxel System</h3>
        <p>WASD: Move</p>
        <p>Space: Jump</p>
        <p>E: Delete voxel</p>
        <p>Only surface voxels rendered!</p>
      </div>
    </KeyboardControls>
  );
};

export default App; 