import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  applyGravityCameraTransform,
  clampCameraPitch,
  rotateCameraForwardYaw,
  transportCameraForward
} from '../utils/gravityCamera';
import { isTouchActive } from '../utils/mobileInput';
import { PLAYER_EYE_HEIGHT } from '../utils/cubeGravityConstants';
import { getPlayerLook, setPlayerLook } from '../state/playerFrame';
import { getPlayerSubmergence } from '../state/playerSubmersion';

// Underwater camera sway — a lazy roll about the view axis + a gentle nod, scaled
// by submergence, so the camera reads as floating in a fluid (invisible in a
// screenshot, strongly felt in motion). Amplitudes are tiny on purpose (<~1.3°)
// to avoid sim-sickness. Applied in the camera's LOCAL frame after the look
// transform, recomputed fresh each frame (no accumulation/drift).
const LOCAL_ROLL_AXIS = new THREE.Vector3(0, 0, 1);
const LOCAL_PITCH_AXIS = new THREE.Vector3(1, 0, 0);
const _swayQuat = new THREE.Quaternion();

interface CameraControlsProps {
  cameraRef: React.RefObject<THREE.PerspectiveCamera | null>;
  activeUp: THREE.Vector3;
  getActiveUp?: () => THREE.Vector3;
  onPointerLockChange?: (locked: boolean) => void;
}

const MOUSE_SENSITIVITY = 0.002;
const DESKTOP_LOOK_SMOOTH = 36;
const UP_SYNC_EPSILON = 0.9999;

function CameraControls({ cameraRef, activeUp, getActiveUp, onPointerLockChange }: CameraControlsProps) {
  const { gl } = useThree();
  const surfaceUp = useRef(activeUp.clone().normalize());
  // Seed from the restored look (set by persistence before this mounts) so a reload
  // faces the same way; defaults to forward/level for a fresh game.
  const surfaceForward = useRef(getPlayerLook().forward);
  const pitch = useRef(getPlayerLook().pitch);
  const isLockedRef = useRef(false);
  const nextUp = useRef(new THREE.Vector3());
  const displayQuat = useRef(new THREE.Quaternion());
  const targetQuat = useRef(new THREE.Quaternion());
  const hasDisplayQuat = useRef(false);

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
      // Pointer lock on desktop, OR active touch-look on mobile (synthetic events).
      if (!isLockedRef.current && !isTouchActive()) return;

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

    // Exiting the ship hands control back here WITHOUT releasing pointer lock, so
    // no pointerlockchange fires on mount. Seed the lock state from the current
    // value so look works immediately instead of needing an Escape + re-click.
    handlePointerLockChange();

    return () => {
      element.removeEventListener('click', handleClick);
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('keydown', handleKeyDown);
      onPointerLockChange?.(false);
    };
  }, [gl.domElement, onPointerLockChange]);

  useFrame((state, rawDt) => {
    if (!cameraRef.current) return;
    const dt = Math.min(rawDt, 1 / 30);
    syncSurfaceFrame();
    setPlayerLook(surfaceForward.current, pitch.current); // publish look for persistence
    applyGravityCameraTransform(
      cameraRef.current,
      surfaceUp.current,
      surfaceForward.current,
      pitch.current,
      PLAYER_EYE_HEIGHT
    );

    // Underwater float-sway, scaled by submergence (0 = no effect on land).
    const submergence = getPlayerSubmergence();
    if (submergence > 0.01) {
      const t = state.clock.elapsedTime;
      const roll = (Math.sin(t * 0.5) * 0.015 + Math.sin(t * 0.23) * 0.008) * submergence;
      const nod = Math.sin(t * 0.43) * 0.010 * submergence;
      cameraRef.current.quaternion.multiply(_swayQuat.setFromAxisAngle(LOCAL_ROLL_AXIS, roll));
      cameraRef.current.quaternion.multiply(_swayQuat.setFromAxisAngle(LOCAL_PITCH_AXIS, nod));
    }

    targetQuat.current.copy(cameraRef.current.quaternion);
    const smoothDesktopLook = isLockedRef.current && !isTouchActive();
    if (!hasDisplayQuat.current || !smoothDesktopLook) {
      displayQuat.current.copy(targetQuat.current);
      hasDisplayQuat.current = true;
      return;
    }
    displayQuat.current.slerp(targetQuat.current, 1 - Math.exp(-DESKTOP_LOOK_SMOOTH * dt));
    cameraRef.current.quaternion.copy(displayQuat.current);
    cameraRef.current.updateMatrixWorld(true);
  });

  return null;
}

export default CameraControls;
