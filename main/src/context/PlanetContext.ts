import { createContext, useContext } from 'react';

export interface PlanetConfig {
  radius: number;
  voxelSize: number;
  center: [number, number, number];
  gravity: number;
}

const defaultPlanetConfig: PlanetConfig = {
  radius: 1,
  voxelSize: 1,
  center: [0, 0, 0],
  gravity: -9.81,
};

export const PlanetContext = createContext<PlanetConfig>(defaultPlanetConfig);
export const usePlanet = () => useContext(PlanetContext); 