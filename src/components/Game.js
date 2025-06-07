import React, { useEffect } from 'react';
import Terrain from './world/Terrain';
import Player from './world/Player';
import { globalCollisionSystem } from '../utils/VoxelCollisionSystem';

const Game = ({ terrainParameters, terrainKey, playerMode, onModeChange }) => {
  // Reset all terrain collision data when parameters change
  useEffect(() => {
    if (terrainParameters) {
      console.log('Terrain parameters changed - performing complete collision system reset');
      globalCollisionSystem.resetAllTerrain();
    }
  }, [terrainParameters]);

  // Generate a 3x3 grid of terrain chunks for testing
  const renderChunks = () => {
    const chunks = [];
    for (let x = -1; x <= 1; x++) {
      for (let z = -1; z <= 1; z++) {
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
      <Player mode={playerMode} onModeChange={onModeChange} />
    </>
  );
};

export default Game; 