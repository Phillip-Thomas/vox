import React, { useEffect } from 'react';
import Terrain from './world/Terrain';
import Player from './world/Player';
import { globalCollisionSystem } from '../utils/VoxelCollisionSystem';

const Game = ({ terrainParameters, terrainKey, playerMode, onModeChange, onPlayerControllerReady }) => {
  // Reset all terrain collision data when parameters change
  useEffect(() => {
    if (terrainParameters) {
      console.log('Terrain parameters changed - performing complete collision system reset');
      globalCollisionSystem.resetAllTerrain();
    }
  }, [terrainParameters]);

  // Generate a 5x5 grid of terrain chunks to show full spherical planet
  const renderChunks = () => {
    const chunks = [];
    for (let x = -2; x <= 2; x++) {
      for (let z = -2; z <= 2; z++) {
        chunks.push(
          <Terrain 
            key={`${terrainKey}-${x}-${z}`}
            chunkX={x}
            chunkZ={z}
            terrainParameters={terrainParameters}
          />
        );
      }
    }
    return chunks;
  };

  return (
    <>
      {renderChunks()}
      <Player 
        mode={playerMode} 
        onModeChange={onModeChange} 
        onPlayerControllerReady={onPlayerControllerReady}
      />
    </>
  );
};

export default Game; 