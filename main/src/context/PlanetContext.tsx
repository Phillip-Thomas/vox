import React, { createContext, useContext, useState } from 'react';

interface PlanetContextType {
  voxelSize: number;
  handleToIndex: Map<number, number>;
  setHandleToIndex: (map: Map<number, number>) => void;
  instancedApi: any;
  setInstancedApi: (api: any) => void;
  instanceMaterials: any[];
  setInstanceMaterials: (materials: any[]) => void;
}

const PlanetContext = createContext<PlanetContextType>({
  voxelSize: 1.0, // 1 unit per voxel
  handleToIndex: new Map(),
  setHandleToIndex: () => {},
  instancedApi: null,
  setInstancedApi: () => {},
  instanceMaterials: [],
  setInstanceMaterials: () => {},
});

export const usePlanet = () => useContext(PlanetContext);

export const PlanetProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [handleToIndex, setHandleToIndex] = useState<Map<number, number>>(new Map());
  const [instancedApi, setInstancedApi] = useState<any>(null);
  const [instanceMaterials, setInstanceMaterials] = useState<any[]>([]);

  return (
    <PlanetContext.Provider value={{
      voxelSize: 2.0, // Updated to match your current voxel size
      handleToIndex,
      setHandleToIndex,  
      instancedApi,
      setInstancedApi,
      instanceMaterials,
      setInstanceMaterials,
    }}>
      {children}
    </PlanetContext.Provider>
  );
}; 