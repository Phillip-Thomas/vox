import { createContext, useContext } from 'react';

export const PlayerContext = createContext({ 
    position: null,
    velocity: null,
    rotation: null,
    camera: null,
    controls: null,
    keys: null,
    setPlayerState: null,
    setCamera: null,
    playerHeight: 1.8, // meters, typical height for first-person games
    moveSpeed: {
        walk: 5.0, // meters per second
        run: 8.0, // meters per second
        jump: 5.0, // initial jump velocity in m/s
    },
});

export const usePlayer = () => useContext(PlayerContext); 