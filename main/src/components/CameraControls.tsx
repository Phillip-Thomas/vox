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
import { getCameraSubmergence } from '../state/playerSubmersion';
import { getStoryInputPolicy, SANDBOX_FOV, SANDBOX_POLICY } from '../story/storyInputPolicy.ts';
import { createFeedLookState, feedAccumulateLook } from '../story/feedCamera.ts';
import { applyActiveRigTransform, applyLiftCameraTransform, applyOverheadCameraTransform, getLensRig, getSideLens, rigMoveBasis } from '../story/sideLens.ts';
import { isMapViewOpen, syncChartScreenUp, MAP_VIEW_HEIGHT } from '../game/mapView.ts';
import {
  applyCinematicCameraPose,
  getCinematicCameraPose,
  getCinematicGazeIntent,
  getCinematicLookTarget,
  getCinematicLookWeight
} from '../story/cinematicLook.ts';
import { createSurfaceGazeResult, solveSurfaceGaze } from '../utils/surfaceGaze.ts';
import { getSunDirection } from './SkyController.tsx';

const _sideForward = new THREE.Vector3();
const _sideRight = new THREE.Vector3();
const _sunTangent = new THREE.Vector3();
const _pullDir = new THREE.Vector3();
const _gazeEye = new THREE.Vector3();
const _gazeResult = createSurfaceGazeResult();

// Underwater camera sway — a lazy roll about the view axis + a gentle nod, scaled
// by submergence, so the camera reads as floating in a fluid (invisible in a
// screenshot, strongly felt in motion). Amplitudes are tiny on purpose (<~1.3°)
// to avoid sim-sickness. Applied in the camera's LOCAL frame after the look
// transform, recomputed fresh each frame (no accumulation/drift).
const LOCAL_ROLL_AXIS = new THREE.Vector3(0, 0, 1);
const LOCAL_PITCH_AXIS = new THREE.Vector3(1, 0, 0);
const _swayQuat = new THREE.Quaternion();

// Chart roll easing: while the map is open, the camera's WORLD frame eases
// toward the overhead target so a face change sweeps the 90° like the cube
// rolling under you, instead of hard-cutting to the new orientation.
const MAP_ROLL_SMOOTH = 7;
const _mapWorldPos = new THREE.Vector3();
const _mapWorldQuat = new THREE.Quaternion();
const _mapParentPos = new THREE.Vector3();
const _mapParentQuat = new THREE.Quaternion();

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
  const feedLook = useRef(createFeedLookState());
  const nextUp = useRef(new THREE.Vector3());
  const displayQuat = useRef(new THREE.Quaternion());
  const targetQuat = useRef(new THREE.Quaternion());
  const hasDisplayQuat = useRef(false);
  const mapDisplayPos = useRef(new THREE.Vector3());
  const mapDisplayQuat = useRef(new THREE.Quaternion());
  const mapDisplayActive = useRef(false);

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
      // Story Regulation Feed: quantized CCTV look (compass-snapped yaw, pinned
      // pitch) on the SAME forward/pitch state, so A2's release is seamless.
      const storyPolicy = getStoryInputPolicy();
      if (storyPolicy.lookMode === 'side') return; // raster era: no mouse look at all
      if (isMapViewOpen()) return; // the chart doesn't yaw; look resumes on close
      if (storyPolicy.lookMode === 'feed') {
        feedAccumulateLook(
          feedLook.current,
          event.movementX,
          event.movementY,
          surfaceForward.current,
          surfaceUp.current,
          pitch,
          storyPolicy.feedBlend
        );
        return;
      }
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

    // Cinematic look pull: while the weight is up, steer toward the target — a
    // world position (autopilot aiming / lift facing) or, with none set, the
    // live sun (the staged dusk/dawn). Runs BEFORE the side branch so the lift
    // blend's first-person endpoint inherits the pulled look. Additive over
    // mouse input — control dissolves back to the player as the weight decays.
    const pull = getCinematicLookWeight();
    if (pull > 0.001) {
      const gazeIntent = getCinematicGazeIntent();
      const lookTarget = getCinematicLookTarget();
      if (gazeIntent) {
        cameraRef.current.getWorldPosition(_gazeEye);
        solveSurfaceGaze({
          eye: _gazeEye,
          viewerUp: surfaceUp.current,
          currentForward: surfaceForward.current,
          goal: gazeIntent.goal,
          goalUp: gazeIntent.goalUp,
          subjectLift: gazeIntent.subjectLift,
          routeDirection: gazeIntent.routeDirection,
          mode: gazeIntent.mode,
          elapsed: gazeIntent.elapsed,
          seed: gazeIntent.seed
        }, _gazeResult);
        _pullDir.copy(_gazeResult.direction);
      } else if (lookTarget) {
        cameraRef.current.getWorldPosition(_pullDir).multiplyScalar(-1).add(lookTarget);
        _pullDir.normalize();
      } else {
        _pullDir.copy(getSunDirection());
      }
      _sunTangent.copy(_pullDir).addScaledVector(surfaceUp.current, -_pullDir.dot(surfaceUp.current));
      if (_sunTangent.lengthSq() > 1e-6) {
        _sunTangent.normalize();
        const k = Math.min(1, pull * 3 * dt);
        surfaceForward.current.lerp(_sunTangent, k).normalize();
        const targetPitch = clampCameraPitch(Math.asin(THREE.MathUtils.clamp(_pullDir.dot(surfaceUp.current), -1, 1)));
        pitch.current += (targetPitch - pitch.current) * k;
      }
    }

    // Story raster era: fixed side-scroller camera (mouse look ignored; look
    // state untouched so CCTV/free resume where the player last looked). During
    // the ch1 LIFT, sideBlend carries the camera from the side vantage INTO the
    // worker's eyes — the literal 2D→3D moment.
    const storyPolicy = getStoryInputPolicy();
    // StoryDirector stops ticking the instant Story deactivates. Restore the
    // physical lens here too, so quit/reset and completion cannot strand a
    // narrowed authored FOV in the sandbox.
    if (storyPolicy === SANDBOX_POLICY && Math.abs(cameraRef.current.fov - SANDBOX_FOV) > 1e-6) {
      cameraRef.current.fov = SANDBOX_FOV;
      cameraRef.current.updateProjectionMatrix();
    }
    const sideLens = storyPolicy.lookMode === 'side' ? getSideLens() : null;
    if (sideLens) {
      if (storyPolicy.sideBlend <= 0.001) {
        rigMoveBasis(sideLens, getLensRig(), _sideForward, _sideRight);
        setPlayerLook(_sideForward, 0); // fields/persistence see the into-screen facing
        applyActiveRigTransform(cameraRef.current, sideLens, dt);
      } else {
        setPlayerLook(surfaceForward.current, pitch.current);
        applyLiftCameraTransform(
          cameraRef.current,
          sideLens,
          surfaceUp.current,
          surfaceForward.current,
          pitch.current,
          PLAYER_EYE_HEIGHT,
          storyPolicy.sideBlend
        );
      }
      hasDisplayQuat.current = false; // don't slerp across the mode switch
      mapDisplayActive.current = false;
      return;
    }

    setPlayerLook(surfaceForward.current, pitch.current); // publish look for persistence

    // The survey chart ([M]): straight-down overhead in place of the eyes,
    // oriented by the rolled chart frame (axis-aligned per face, continuous
    // across edges — the look state is ignored and preserved untouched, so
    // closing lands exactly where you were).
    if (isMapViewOpen() && storyPolicy.lookMode === 'free' && getCinematicCameraPose().weight <= 0.001) {
      const camera = cameraRef.current;
      applyOverheadCameraTransform(camera, surfaceUp.current, syncChartScreenUp(surfaceUp.current), MAP_VIEW_HEIGHT);
      camera.getWorldPosition(_mapWorldPos);
      camera.getWorldQuaternion(_mapWorldQuat);
      if (mapDisplayActive.current) {
        // Ease the world frame toward the overhead target (the cube-roll
        // sweep on a face change). Opening the map snaps (else branch).
        const k = 1 - Math.exp(-MAP_ROLL_SMOOTH * dt);
        mapDisplayPos.current.lerp(_mapWorldPos, k);
        mapDisplayQuat.current.slerp(_mapWorldQuat, k);
        const parent = camera.parent;
        if (parent) {
          parent.getWorldQuaternion(_mapParentQuat);
          parent.getWorldPosition(_mapParentPos);
          _mapParentQuat.invert();
          camera.position.copy(mapDisplayPos.current).sub(_mapParentPos).applyQuaternion(_mapParentQuat);
          camera.quaternion.copy(_mapParentQuat).multiply(mapDisplayQuat.current);
        } else {
          camera.position.copy(mapDisplayPos.current);
          camera.quaternion.copy(mapDisplayQuat.current);
        }
        camera.updateMatrixWorld(true);
      } else {
        mapDisplayPos.current.copy(_mapWorldPos);
        mapDisplayQuat.current.copy(_mapWorldQuat);
        mapDisplayActive.current = true;
      }
      hasDisplayQuat.current = false;
      return;
    }
    mapDisplayActive.current = false;

    applyGravityCameraTransform(
      cameraRef.current,
      surfaceUp.current,
      surfaceForward.current,
      pitch.current,
      PLAYER_EYE_HEIGHT
    );

    // Arrival and other authored booms blend from the already-correct embodied
    // gravity frame. The rigid body and persisted look never move; weight 0 is
    // therefore an exact return to the player's eyes, including on reset/quit.
    applyCinematicCameraPose(cameraRef.current);

    // Underwater float-sway, scaled by submergence (0 = no effect on land).
    const submergence = getCameraSubmergence();
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
