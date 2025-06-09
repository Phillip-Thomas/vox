import React, { createContext, useContext } from 'react';

interface PlanetContextType {
  voxelSize: number;
}

const PlanetContext = createContext<PlanetContextType>({
  voxelSize: 1.0 // 1 unit per voxel
});

export const usePlanet = () => useContext(PlanetContext);

export const PlanetProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <PlanetContext.Provider value={{
      voxelSize: 1.0
    }}>
      {children}
    </PlanetContext.Provider>
  );
}; 