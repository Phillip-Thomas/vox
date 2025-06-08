import { createContext, useContext } from 'react';

// holds immutable planet parameters so they are defined once
export const PlanetContext = createContext({ 
    radius: 1,
    voxelSize: 0.25,
    center: [0,0,0],
    gravity: -9.81, // m/s^2, negative because it pulls towards planet center
});

export const usePlanet = () => useContext(PlanetContext); 