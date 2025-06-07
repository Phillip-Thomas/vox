import React, { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Sky, OrbitControls, Stats } from '@react-three/drei';
import Game from './components/Game';
import TerrainControls from './components/ui/TerrainControls';
import DragCameraControls from './components/ui/DragCameraControls';
import PerformanceStats from './components/ui/PerformanceStats';
import './App.css';

function App() {
  const [terrainParameters, setTerrainParameters] = useState(null);
  const [showControls, setShowControls] = useState(false);
  const [showPerformanceStats, setShowPerformanceStats] = useState(false);
  const [terrainKey, setTerrainKey] = useState(0); // Force terrain regeneration
  const [playerMode, setPlayerMode] = useState('player');

  // Handle terrain parameter changes
  const handleParametersChange = (newParams) => {
    setTerrainParameters(newParams);
    setTerrainKey(prev => prev + 1); // Force terrain regeneration
  };

  // Handle terrain controls toggle
  const toggleTerrainControls = () => {
    setShowControls(prev => !prev);
  };

  // Handle performance stats toggle
  const togglePerformanceStats = () => {
    setShowPerformanceStats(prev => !prev);
  };

  // Handle player mode changes
  const handleModeChange = (newMode) => {
    setPlayerMode(newMode);
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.code === 'KeyT') {
        event.preventDefault();
        toggleTerrainControls();
      }
      if (event.code === 'KeyP') {
        event.preventDefault();
        togglePerformanceStats();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="App">
      <Canvas
        camera={{
          position: [0, 30, 20],
          fov: 60,
          near: 0.5,
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
        
        <Game 
          terrainParameters={terrainParameters}
          terrainKey={terrainKey}
          playerMode={playerMode}
          onModeChange={handleModeChange}
        />
        
        {/* Camera Controls - conditional based on player mode */}
        {playerMode === 'dev' ? (
          <OrbitControls 
            enabled={!showControls}
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            maxDistance={200}
            minDistance={5}
          />
        ) : (
          <DragCameraControls 
            enabled={!showControls}
          />
        )}
        <Stats />
      </Canvas>
      
      {/* Mode indicator - outside Canvas */}
      <div style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        color: playerMode === 'dev' ? '#00ff00' : '#ff8800',
        fontFamily: 'monospace',
        fontSize: '14px',
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: '8px 12px',
        borderRadius: '4px',
        zIndex: 1000
      }}>
        Mode: {playerMode.toUpperCase()}
      </div>
      
      {/* Performance Stats - outside Canvas */}
      <PerformanceStats visible={showPerformanceStats && process.env.NODE_ENV === 'development'} />
      
      <div className="instructions">
        {playerMode === 'dev' 
          ? 'Mouse to look around • Scroll to zoom • Right-click drag to pan • WASD to move • Q/E up/down • F to toggle mode • T for terrain controls • P for collision stats'
          : 'Drag to look around • WASD to move • Space to jump • F to toggle mode • T for terrain controls • P for collision stats'
        }
      </div>
      
      <TerrainControls 
        onParametersChange={handleParametersChange}
        isVisible={showControls}
        onToggleVisibility={toggleTerrainControls}
      />
    </div>
  );
}

export default App; 