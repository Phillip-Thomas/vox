import React, { createContext, useContext } from 'react';
import { Canvas } from '@react-three/fiber';
import { Stats, Sky, KeyboardControls, OrbitControls, PointerLockControls } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import * as THREE from 'three';
import { PlanetContext } from './context/PlanetContext.ts';
import { PlayerContext, PlayerState, CubeFace, FACE_ORIENTATIONS } from './context/PlayerContext.ts';
import Planet from './components/Planet.tsx';
import Player from './components/Player.tsx';
import QuadrantVisualizer from './components/QuadrantVisualizer.tsx';
import { WorldGenerationControls } from './components/WorldGenerationControls.tsx';
import { usePlanetGravity } from './hooks/usePlanetRotation';
import './App.css';



// Gravity context to share gravity state between components
const GravityContext = createContext<ReturnType<typeof usePlanetGravity> | null>(null);

export function useGravityContext() {
  const context = useContext(GravityContext);
  if (!context) {
    throw new Error('useGravityContext must be used within GravityProvider');
  }
  return context;
}

// Gravity provider component
function GravityProvider({ children }: { children: React.ReactNode }) {
  const voxelSize = 2.0;
  const gravityState = usePlanetGravity(voxelSize);
  
  return (
    <GravityContext.Provider value={gravityState}>
      {children}
    </GravityContext.Provider>
  );
}

// Physics wrapper component that uses gravity from context
function PhysicsWrapper({ children }: { children: React.ReactNode }) {
  const { gravity } = useGravityContext();
  
  return (
    <Physics gravity={gravity}>
      {children}
    </Physics>
  );
}

const App: React.FC = () => {
  const [playerState, setPlayerState] = React.useState<PlayerState>({ 
    position: null,
    velocity: null,
    rotation: null,
    camera: null,
    controls: {},
    keys: {},
    currentFace: 'top' as CubeFace,
    faceOrientation: FACE_ORIENTATIONS.top
  });
  
  const setCurrentFace = React.useCallback((face: CubeFace) => {
    setPlayerState(prev => ({
      ...prev,
      currentFace: face,
      faceOrientation: FACE_ORIENTATIONS[face]
    }));
  }, []);
  
  const playerConfig = {
    ...playerState,
    setPlayerState,
    setCurrentFace,
    playerHeight: 1.8,
    moveSpeed: {
      walk: 5.0,
      run: 8.0,
      jump: 5.0
    },
    onGround: false,
    canJump: false,
    isRunning: false,
    setCamera: (camera: THREE.Camera) => setPlayerState(prev => ({...prev, camera}))
  };

  const planetConfig = React.useMemo(() => ({ 
    radius: 25, 
    voxelSize: 2, 
    center: [0,0,0] as [number, number, number],
    gravity: 9.81
  }), []);

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
      <PlanetContext.Provider value={planetConfig}>
      <PlayerContext.Provider value={playerConfig}>
      <GravityProvider>
        <Canvas
          // camera={{ position: [0, 20, 20], fov: 75, near: 0.1, far: 1000 }}
          shadows
          style={{ width: '100vw', height: '100vh' }}
        >
          <Stats />
          <Sky sunPosition={[100, 20, 100]} />

          <ambientLight intensity={0.3} />

          <PhysicsWrapper>
            <Planet />
            <Player />
          </PhysicsWrapper>
          
          {/* Visualize the angular bisector planes */}
          {/* <QuadrantVisualizer voxelSize={planetConfig.voxelSize} visible={true} /> */}
          {/* <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} makeDefault /> */}
          {/* <PointerLockControls makeDefault={true} /> */}
        </Canvas>
      </GravityProvider>
      </PlayerContext.Provider>
      </PlanetContext.Provider>
      <WorldGenerationControls />
    </KeyboardControls>
  );
};

export default App; 