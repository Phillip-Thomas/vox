import React from 'react';
import { Canvas } from '@react-three/fiber';
import { Stats, Sky, KeyboardControls, PointerLockControls } from '@react-three/drei';
import { Physics, RigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { PlanetContext } from './context/PlanetContext.ts';
import { PlayerContext } from './context/PlayerContext.ts';
import Planet from './components/Planet.tsx';
import Player from './components/Player.tsx';
import './App.css';

interface PlayerState {
  position: THREE.Vector3 | null;
  velocity: THREE.Vector3 | null;
  rotation: THREE.Euler | null;
  camera: THREE.Camera | null;
  controls: any;
  keys: any;
}

interface PlayerConfig {
  playerState: PlayerState;
  setPlayerState: React.Dispatch<React.SetStateAction<PlayerState>>;
  playerHeight: number;
  moveSpeed: {
    walk: number;
    run: number;
    jump: number;
  };
  onGround: boolean;
  canJump: boolean;
  isRunning: boolean;
  camera?: THREE.Camera | null;
  controls?: any;
  keys?: any;
}

interface PlanetConfig {
  radius: number;
  voxelSize: number;
  center: [number, number, number];
}

const App: React.FC = () => {
  const [playerState, setPlayerState] = React.useState<PlayerState>({ 
    position: null,
    velocity: null,
    rotation: null,
    camera: null,
    controls: {},
    keys: {}
  });
  
  const playerConfig: PlayerConfig = {
    playerState,
    setPlayerState,
    playerHeight: 1.8,
    moveSpeed: {
      walk: 5.0,
      run: 8.0,
      jump: 5.0
    },
    onGround: false,
    canJump: false,
    isRunning: false
  };

  const planetConfig: PlanetConfig = { 
    radius: 25, 
    voxelSize: 2, 
    center: [0,0,0] 
  };

  return (
    <KeyboardControls
      map={[
        { name: 'forward', keys: ['ArrowUp', 'KeyW'] },
        { name: 'backward', keys: ['ArrowDown', 'KeyS'] },
        { name: 'left', keys: ['ArrowLeft', 'KeyA'] },
        { name: 'right', keys: ['ArrowRight', 'KeyD'] },
        { name: 'jump', keys: ['Space'] },
        { name: 'reset', keys: ['KeyR'] },
      ]}
    >
      <PlanetContext.Provider value={{...planetConfig, gravity: 9.81}}>
      <PlayerContext.Provider value={{
        ...playerConfig,
        camera: playerState.camera,
        position: playerState.position,
        velocity: playerState.velocity,
        setCamera: (camera: THREE.Camera) => setPlayerState(prev => ({...prev, camera})),
        rotation: playerState.rotation,
        controls: playerState.controls,
        keys: playerState.keys,
        onGround: false,
        canJump: false,
        isRunning: false
      }}>
      <Canvas
        camera={{ position: [0, 5, 10], fov: 75, near: 0.1, far: 1000 }}
        shadows
        style={{ width: '100vw', height: '100vh' }}
      >
        <Stats />
        <Sky sunPosition={[100, 20, 100]} />

        <ambientLight intensity={0.3} />

        <Physics gravity={[0, -9.81, 0]}>
          {/* Large static ground plane */}
          <RigidBody type="fixed" position={[0, -10, 0]}>
            <mesh>
              <boxGeometry args={[100, 1, 100]} />
              <meshStandardMaterial color="#8B4513" />
            </mesh>
          </RigidBody>
          
          <Planet />
          <Player />
        </Physics>
        <PointerLockControls makeDefault />
      </Canvas>
      </PlayerContext.Provider>
      </PlanetContext.Provider>
    </KeyboardControls>
  );
}

export default App; 