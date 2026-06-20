import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface CameraControlsProps {
  cameraRef: React.RefObject<THREE.PerspectiveCamera | null>;
  activeUp: THREE.Vector3;
  suspendUpSync?: boolean;
  onPointerLockChange?: (locked: boolean) => void;
}

function CameraControls({ cameraRef, activeUp, suspendUpSync = false, onPointerLockChange }: CameraControlsProps) {
  const { gl } = useThree();
  const cameraAngles = useRef({ yaw: 0, pitch: 0 });
  const isLockedRef = useRef(false);

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

      const sensitivity = 0.002;
      cameraAngles.current.yaw -= event.movementX * sensitivity;
      cameraAngles.current.pitch -= event.movementY * sensitivity;
      cameraAngles.current.pitch = Math.max(
        -Math.PI / 2 + 0.1,
        Math.min(Math.PI / 2 - 0.1, cameraAngles.current.pitch)
      );
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
    if (!suspendUpSync) {
      cameraRef.current.up.copy(activeUp);
    }
    cameraRef.current.rotation.set(cameraAngles.current.pitch, cameraAngles.current.yaw, 0, 'YXZ');
  });

  return null;
}

export default CameraControls;
