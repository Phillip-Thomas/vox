import { createContext, useContext, Dispatch, SetStateAction } from 'react';
import * as THREE from 'three';

export type CubeFace = 'top' | 'bottom' | 'left' | 'right' | 'front' | 'back';

export interface FaceOrientation {
  gravity: [number, number, number];
  characterRotation: THREE.Euler;
  upDirection: THREE.Vector3;
  forwardDirection: THREE.Vector3;
  rightDirection: THREE.Vector3;
}

export interface PlayerState {
  position: THREE.Vector3 | null;
  velocity: THREE.Vector3 | null;
  rotation: THREE.Euler | null;
  camera: THREE.Camera | null;
  controls: any;
  keys: any;
  currentFace: CubeFace;
  faceOrientation: FaceOrientation;
}

export interface PlayerConfig extends PlayerState {
  setPlayerState: Dispatch<SetStateAction<PlayerState>> | null;
  setCamera: ((camera: THREE.Camera) => void) | null;
  setCurrentFace: ((face: CubeFace) => void) | null;
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

// Face orientation definitions
export const FACE_ORIENTATIONS: Record<CubeFace, FaceOrientation> = {
  top: {
    gravity: [0, -9.81, 0],
    characterRotation: new THREE.Euler(0, 0, 0),
    upDirection: new THREE.Vector3(0, 1, 0),
    forwardDirection: new THREE.Vector3(0, 0, -1),
    rightDirection: new THREE.Vector3(1, 0, 0)
  },
  bottom: {
    gravity: [0, 9.81, 0],
    characterRotation: new THREE.Euler(0, -Math.PI, -Math.PI), // Rotate around Z instead of X to avoid flip
    upDirection: new THREE.Vector3(0, -1, 0),
    forwardDirection: new THREE.Vector3(0, 0, 1), // Keep forward consistent
    rightDirection: new THREE.Vector3(-1, 0, 0)  // Flip right to maintain consistency
  },
  left: {
    gravity: [9.81, 0, 0],
    characterRotation: new THREE.Euler(0, 0, Math.PI / 2), // Negative rotation for smoother transition
    upDirection: new THREE.Vector3(-1, 0, 0),
    forwardDirection: new THREE.Vector3(0, 0, -1),
    rightDirection: new THREE.Vector3(0, -1, 0)
  },
  right: {
    gravity: [-9.81, 0, 0], // Gravity points toward right face (+X direction)
    characterRotation: new THREE.Euler(0, 0, -Math.PI / 2),
    upDirection: new THREE.Vector3(1, 0, 0),
    forwardDirection: new THREE.Vector3(0, 0, -1),
    rightDirection: new THREE.Vector3(0, 1, 0)
  },
  front: {
    gravity: [0, 0, -9.81],
    characterRotation: new THREE.Euler(Math.PI / 2, 0, 0), // Positive rotation
    upDirection: new THREE.Vector3(0, 0, 1),
    forwardDirection: new THREE.Vector3(0, -1, 0),
    rightDirection: new THREE.Vector3(1, 0, 0)
  },
  back: {
    gravity: [0, 0, 9.81],
    characterRotation: new THREE.Euler(-Math.PI / 2, 0, 0), // Negative rotation
    upDirection: new THREE.Vector3(0, 0, -1),
    forwardDirection: new THREE.Vector3(0, -1, 0),
    rightDirection: new THREE.Vector3(1, 0, 0)
  }
};

const defaultPlayerConfig: PlayerConfig = {
  position: null,
  velocity: null,
  rotation: null,
  camera: null,
  controls: null,
  keys: null,
  currentFace: 'top',
  faceOrientation: FACE_ORIENTATIONS.top,
  setPlayerState: null,
  setCamera: null,
  setCurrentFace: null,
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