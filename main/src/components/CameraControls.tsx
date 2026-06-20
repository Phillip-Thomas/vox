import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  applyGravityCameraTransform,
  clampCameraPitch,
  rotateCameraForwardYaw,
  transportCameraForward
} from '../utils/gravityCamera';

interface CameraControlsProps {
  cameraRef: React.RefObject<THREE.PerspectiveCamera | null>;
  activeUp: THREE.Vector3;
  getActiveUp?: () => THREE.Vector3;
  onPointerLockChange?: (locked: boolean) => void;
}

const CAMERA_EYE_HEIGHT = 1;
const MOUSE_SENSITIVITY = 0.002;
const UP_SYNC_EPSILON = 0.9999;

function CameraControls({ cameraRef, activeUp, getActiveUp, onPointerLockChange }: CameraControlsProps) {
  const { gl } = useThree();
  const surfaceUp = useRef(activeUp.clone().normalize());
  const surfaceForward = useRef(new THREE.Vector3(0, 0, -1));
  const pitch = useRef(0);
  const isLockedRef = useRef(false);
  const nextUp = useRef(new THREE.Vector3());

  const syncSurfaceFrame = () => {
    nextUp.current.copy(getActiveUp?.() ?? activeUp).normalize();

    if (surfaceUp.current.dot(nextUp.current) < UP_SYNC_EPSILON) {
      transportCameraForward(surfaceForward.current, surfaceUp.current, nextUp.current, surfaceForward.current);
    }

    surfaceUp.current.copy(nextUp.current);
  };

  useEffect(() => {
    const element = gl.domElement;

    const handleClick = async (event: MouseEvent) => {
      if (event.target !== element || document.pointerLockElement) return;
      try {
        await element.requestPointerLock();
      } catch (error) {
        console.warn('Pointer lock request failed:', error);
      }
    };

    const handlePointerLockChange = () => {
      const locked = document.pointerLockElement === element;
      isLockedRef.current = locked;
      onPointerLockChange?.(locked);
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!isLockedRef.current) return;

      syncSurfaceFrame();
      rotateCameraForwardYaw(
        surfaceForward.current,
        surfaceUp.current,
        -event.movementX * MOUSE_SENSITIVITY,
        surfaceForward.current
      );
      pitch.current = clampCameraPitch(pitch.current - event.movementY * MOUSE_SENSITIVITY);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && document.pointerLockElement === element) {
        document.exitPointerLock();
      }
    };

    element.addEventListener('click', handleClick);
    document.addEventListener('pointerlockchange', handlePointerLockChange);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      element.removeEventListener('click', handleClick);
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('keydown', handleKeyDown);
      onPointerLockChange?.(false);
    };
  }, [gl.domElement, onPointerLockChange]);

  useFrame(() => {
    if (!cameraRef.current) return;
    syncSurfaceFrame();
    applyGravityCameraTransform(
      cameraRef.current,
      surfaceUp.current,
      surfaceForward.current,
      pitch.current,
      CAMERA_EYE_HEIGHT
    );
  });

  return null;
}

export default CameraControls;
