import React from 'react';
import Terrain from './world/Terrain';
import Player from './world/Player';

const Game = ({ terrainParameters, terrainKey, onModeChange }) => {
  return (
    <>
      <Terrain 
        key={terrainKey}
        terrainParameters={terrainParameters}
      />
      <Player onModeChange={onModeChange} />
    </>
  );
};

export default Game; 