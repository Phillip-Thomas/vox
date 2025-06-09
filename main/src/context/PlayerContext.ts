import { createContext, useContext, Dispatch, SetStateAction } from 'react';
import * as THREE from 'three';

export interface PlayerState {
  position: THREE.Vector3 | null;
  velocity: THREE.Vector3 | null;
  rotation: THREE.Euler | null;
  camera: THREE.Camera | null;
  controls: any;
  keys: any;
}

export interface PlayerConfig extends PlayerState {
  setPlayerState: Dispatch<SetStateAction<PlayerState>> | null;
  setCamera: ((camera: THREE.Camera) => void) | null;
  playerHeight: number;
  moveSpeed: {
    walk: number;
    run: number;
    jump: number;
  };
  onGround: boolean;
  canJump: boolean;
  isRunning: boolean;
}

const defaultPlayerConfig: PlayerConfig = {
  position: null,
  velocity: null,
  rotation: null,
  camera: null,
  controls: null,
  keys: null,
  setPlayerState: null,
  setCamera: null,
  onGround: false,
  canJump: false,
  isRunning: false,
  playerHeight: 1.8,
  moveSpeed: {
    walk: 5.0,
    run: 8.0,
    jump: 5.0,
  },
};

export const PlayerContext = createContext<PlayerConfig>(defaultPlayerConfig);
export const usePlayer = () => useContext(PlayerContext); 