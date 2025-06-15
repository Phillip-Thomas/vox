import React, { createContext, useContext } from 'react';
import { Canvas } from '@react-three/fiber';
import { Stats, Sky, KeyboardControls, OrbitControls, PointerLockControls } from '@react-three/drei';
import { EffectComposer, Bloom, ToneMapping } from '@react-three/postprocessing';
import { Physics } from '@react-three/rapier';
import * as THREE from 'three';
import { PlanetContext } from './context/PlanetContext.ts';
import { PlayerContext, PlayerState, CubeFace, FACE_ORIENTATIONS } from './context/PlayerContext.ts';
import Planet from './components/Planet.tsx';
import Player from './components/Player.tsx';
import QuadrantVisualizer from './components/QuadrantVisualizer.tsx';
import { WorldGenerationControls } from './components/WorldGenerationControls.tsx';
import { usePlanetGravity } from './hooks/usePlanetRotation';
import PerformanceMonitor from './components/PerformanceMonitor.tsx';
import Crosshair from './components/Crosshair.tsx';
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
          shadows={false} // PERFORMANCE: Disable shadows to reduce CPU usage
          style={{ width: '100vw', height: '100vh' }}
          gl={{ 
            antialias: false, // PERFORMANCE: Disable antialiasing
            alpha: false, // PERFORMANCE: Disable alpha channel
            powerPreference: "high-performance", // OPTIMIZATION 5: Prefer discrete GPU
            stencil: false, // OPTIMIZATION 5: Disable stencil buffer
            depth: true, // Keep depth buffer for proper rendering
          }}
          performance={{ 
            min: 0.5, // PERFORMANCE: Allow lower frame rates
            max: 1.0, // OPTIMIZATION 5: Cap at 60 FPS equivalent
            debounce: 200 // OPTIMIZATION 5: Debounce performance adjustments
          }}
          frameloop="always" // Keep continuous rendering for consistent input handling
          dpr={[1, 1.5]} // OPTIMIZATION 5: Limit device pixel ratio to reduce render resolution
        >
          <Stats />
          <Sky sunPosition={[100, 20, 100]} />

          {/* PERFORMANCE: Simplified lighting setup to reduce CPU usage */}
          <ambientLight intensity={0.6} />
          <directionalLight position={[10, 10, 5]} intensity={0.4} castShadow={false} />

          <PhysicsWrapper>
            <Planet />
            <Player />
          </PhysicsWrapper>
          
          {/* Post-processing effects for glow - TEMPORARILY DISABLED DUE TO SHADER ERROR */}
          {/* <EffectComposer>
            <Bloom 
              intensity={0.5} // Subtle bloom intensity
              luminanceThreshold={0.2} // Only bright areas glow
              luminanceSmoothing={0.9} // Smooth transition
              radius={0.8} // Glow radius
            />
            <ToneMapping />
          </EffectComposer> */}
          
          {/* Visualize the angular bisector planes */}
          {/* <QuadrantVisualizer voxelSize={planetConfig.voxelSize} visible={true} /> */}
          {/* <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} makeDefault /> */}
          {/* <PointerLockControls makeDefault={true} /> */}
        </Canvas>
        <Crosshair />
        {/* <PerformanceMonitor /> */}
      </GravityProvider>
      </PlayerContext.Provider>
      </PlanetContext.Provider>
      <WorldGenerationControls />
    </KeyboardControls>
  );
};

export default App; 