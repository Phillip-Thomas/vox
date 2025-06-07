import React from 'react';
import Terrain from './world/Terrain';
import Player from './world/Player';

const Game = ({ terrainParameters, terrainKey, playerMode, onModeChange }) => {
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