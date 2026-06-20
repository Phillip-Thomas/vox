import { useCallback, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { CapsuleCollider, RapierRigidBody, RigidBody, useBeforePhysicsStep, useRapier } from '@react-three/rapier';
import { PerspectiveCamera, useKeyboardControls } from '@react-three/drei';
import type { CubeFace } from '../types/cube';
import { efficientPlanetMesh } from './EfficientPlanet';
import CameraControls from './CameraControls';
import { voxelSystem } from '../utils/efficientVoxelSystem';
import {
  DEFAULT_JUMP_SPEED,
  DEFAULT_MOVE_SPEED,
  JumpState,
  SurfaceState,
  applyJumpImpulse,
  areAdjacentFaces,
  chooseFaceFromPosition,
  composeVelocity,
  getSurfaceState,
  integrateLocalGravity,
  makeTangentBasis,
  movementDirectionFromBasis,
  planarCameraBasis,
  predictPosition,
  transitionVelocityAcrossEdge,
  transportControlFrame,
  updateJumpState,
  vectorFromRapier,
  vectorToRapier,
  wrapPositionAroundEdge
} from '../utils/surfaceControls';
import {
  EDGE_HYSTERESIS,
  FIXED_PHYSICS_STEP,
  GROUND_NORMAL_MIN_DOT,
  GROUND_PROBE_FOOT_OFFSET,
  GROUND_PROBE_LENGTH,
  GROUND_PROBE_LIFT,
  PLAYER_CENTER_CLEARANCE,
  PLAYER_EDGE_RADIUS,
  TRANSITION_LOCK_TIME,
  TRANSITION_MIN_INWARD_SPEED
} from '../utils/cubeGravityConstants';

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(0, 0);
const BLOCK_REACH = 8;
const VISUAL_TRANSITION_TIME = 0.42;
const PLAYER_LOCAL_UP = new THREE.Vector3(0, 1, 0);

interface RotationAnimation {
  startTime: number;
  startRotation: THREE.Quaternion;
  targetRotation: THREE.Quaternion;
}

export interface PlayerDebugState {
  face: CubeFace;
  targetFace: CubeFace | null;
  grounded: boolean;
  controlsActive: boolean;
  speed: number;
  gravity: [number, number, number];
  position: [number, number, number];
}

interface EfficientPlayerProps {
  planetSize: number;
  initialPosition?: THREE.Vector3;
  resetPosition?: THREE.Vector3;
  onPositionChange?: (position: THREE.Vector3) => void;
  onSurfaceChange?: (surface: SurfaceState) => void;
  onGroundedChange?: (grounded: boolean) => void;
  onDebugChange?: (debug: PlayerDebugState) => void;
}

export default function EfficientPlayer({
  planetSize,
  initialPosition,
  resetPosition,
  onPositionChange,
  onSurfaceChange,
  onGroundedChange,
  onDebugChange
}: EfficientPlayerProps) {
  const ref = useRef<RapierRigidBody | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const [, get] = useKeyboardControls();
  const { world, rapier } = useRapier();

  const [surfaceState, setSurfaceState] = useState<SurfaceState>(() => getSurfaceState('top'));
  const surfaceRef = useRef<SurfaceState>(surfaceState);
  const visualCameraUp = useRef(surfaceState.up.clone());
  const rotationAnimation = useRef<RotationAnimation | null>(null);
  const lastPlanarForward = useRef(new THREE.Vector3(0, 0, -1));
  const controlsActive = useRef(false);
  const previousDeleteKey = useRef(false);
  const frameCount = useRef(0);
  const transitionCooldown = useRef(0);
  const lastGrounded = useRef(false);
  const lastGroundedNotification = useRef<boolean | null>(null);
  const jumpState = useRef<JumpState>({
    isGrounded: false,
    coyoteTimeRemaining: 0,
    jumpBufferRemaining: 0,
    previousJump: false
  });
  const defaultSpawnPosition = useMemo(
    () => new THREE.Vector3(0, planetSize + PLAYER_CENTER_CLEARANCE + 2, 0),
    [planetSize]
  );
  const initialSpawnPosition = useMemo(
    () => (initialPosition ?? defaultSpawnPosition).clone(),
    [defaultSpawnPosition, initialPosition]
  );
  const resetSpawnPosition = useMemo(
    () => (resetPosition ?? defaultSpawnPosition).clone(),
    [defaultSpawnPosition, resetPosition]
  );

  const setSurface = useCallback((next: SurfaceState) => {
    surfaceRef.current = next;
    setSurfaceState(next);
    onSurfaceChange?.({
      ...next,
      up: next.up.clone(),
      gravity: next.gravity.clone()
    });
  }, [onSurfaceChange]);

  const updateVisualTransition = useCallback(() => {
    const animation = rotationAnimation.current;
    const body = ref.current;
    if (!animation || !body) return;

    const progress = Math.min((performance.now() - animation.startTime) / (VISUAL_TRANSITION_TIME * 1000), 1);
    const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    const rotation = animation.startRotation.clone().slerp(animation.targetRotation, eased);

    body.setRotation(rotation, true);
    visualCameraUp.current.copy(PLAYER_LOCAL_UP).applyQuaternion(rotation).normalize();

    if (progress >= 1) {
      body.setRotation(animation.targetRotation, true);
      visualCameraUp.current.copy(PLAYER_LOCAL_UP).applyQuaternion(animation.targetRotation).normalize();
      rotationAnimation.current = null;
    }
  }, []);

  const checkGrounded = useCallback((position: THREE.Vector3, up: THREE.Vector3) => {
    const basis = makeTangentBasis(up, lastPlanarForward.current);
    const offsets = [
      new THREE.Vector3(0, 0, 0),
      basis.forward.clone().multiplyScalar(GROUND_PROBE_FOOT_OFFSET),
      basis.forward.clone().multiplyScalar(-GROUND_PROBE_FOOT_OFFSET),
      basis.right.clone().multiplyScalar(GROUND_PROBE_FOOT_OFFSET),
      basis.right.clone().multiplyScalar(-GROUND_PROBE_FOOT_OFFSET)
    ];
    const direction = up.clone().multiplyScalar(-1);

    for (const offset of offsets) {
      const origin = position.clone().addScaledVector(up, GROUND_PROBE_LIFT).add(offset);
      const ray = new rapier.Ray(vectorToRapier(origin), vectorToRapier(direction));
      const hit = world.castRayAndGetNormal(ray, GROUND_PROBE_LENGTH, true, undefined, undefined, undefined, ref.current ?? undefined);
      if (!hit) continue;

      const normal = vectorFromRapier(hit.normal).normalize();
      if (normal.dot(up) >= GROUND_NORMAL_MIN_DOT) return true;
    }

    return false;
  }, [rapier, world]);

  const beginTransition = useCallback((
    targetFace: CubeFace,
    sourcePosition: THREE.Vector3,
    sourceVelocity: THREE.Vector3,
    basis: { forward: THREE.Vector3; right: THREE.Vector3 }
  ) => {
    const body = ref.current;
    if (!body) return false;

    const current = surfaceRef.current;
    if (current.face === targetFace || !areAdjacentFaces(current.face, targetFace)) return false;
    updateVisualTransition();

    const target = getSurfaceState(targetFace);
    const currentRotation = body.rotation();
    const startRotation = new THREE.Quaternion(currentRotation.x, currentRotation.y, currentRotation.z, currentRotation.w);
    const deltaRotation = new THREE.Quaternion().setFromUnitVectors(current.up, target.up);
    const targetRotation = new THREE.Quaternion().multiplyQuaternions(deltaRotation, startRotation);
    const transported = transportControlFrame(
      { up: current.up, forward: basis.forward, right: basis.right },
      current.up,
      target.up
    );

    const wrappedPosition = wrapPositionAroundEdge(
      sourcePosition,
      current.up,
      target.up,
      planetSize,
      PLAYER_CENTER_CLEARANCE
    );
    const transitionedVelocity = transitionVelocityAcrossEdge(
      sourceVelocity,
      current.up,
      target.up,
      TRANSITION_MIN_INWARD_SPEED
    );

    body.setTranslation(vectorToRapier(wrappedPosition), true);
    body.setLinvel(vectorToRapier(transitionedVelocity), true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    body.lockRotations(true, true);

    rotationAnimation.current = {
      startTime: performance.now(),
      startRotation,
      targetRotation
    };
    lastPlanarForward.current.copy(transported.forward);
    transitionCooldown.current = TRANSITION_LOCK_TIME;
    setSurface(target);
    return true;
  }, [planetSize, setSurface, updateVisualTransition]);

  const resetPlayer = useCallback(() => {
    const body = ref.current;
    if (!body) return;

    const top = getSurfaceState('top');
    body.setTranslation(vectorToRapier(resetSpawnPosition), true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    body.setRotation(new THREE.Quaternion(), true);
    body.lockRotations(true, true);
    rotationAnimation.current = null;
    visualCameraUp.current.copy(top.up);
    lastPlanarForward.current.set(0, 0, -1);
    transitionCooldown.current = 0;
    setSurface(top);
  }, [resetSpawnPosition, setSurface]);

  const handlePointerLockChange = useCallback((locked: boolean) => {
    controlsActive.current = locked;
    jumpState.current.previousJump = get().jump;
  }, [get]);

  const handleVoxelDeletion = useCallback((camera: THREE.Camera | null) => {
    if (!camera) return;
    const mesh = efficientPlanetMesh.current;
    if (!mesh) return;

    raycaster.far = BLOCK_REACH;
    raycaster.setFromCamera(mouse, camera);
    const hit = raycaster.intersectObject(mesh, false).find(intersection => intersection.instanceId !== undefined);
    if (!hit || hit.instanceId === undefined) return;

    const coord = voxelSystem.getCoordForSlot(hit.instanceId);
    if (!coord) return;

    if (voxelSystem.removeVoxel(coord.x, coord.y, coord.z)) {
      voxelSystem.exposeNeighbors(coord.x, coord.y, coord.z);
    }
  }, []);

  useBeforePhysicsStep(() => {
    const body = ref.current;
    if (!body) return;

    const controls = get();
    if (controls.reset) {
      resetPlayer();
      return;
    }

    const position = vectorFromRapier(body.translation());
    const activeSurface = surfaceRef.current;
    const grounded = checkGrounded(position, activeSurface.up);
    lastGrounded.current = grounded;

    const movementInput = controlsActive.current
      ? {
          forward: controls.forward,
          backward: controls.backward,
          left: controls.left,
          right: controls.right
        }
      : { forward: false, backward: false, left: false, right: false };

    const basis = cameraRef.current
      ? planarCameraBasis(cameraRef.current, activeSurface.up, lastPlanarForward.current)
      : makeTangentBasis(activeSurface.up, lastPlanarForward.current);
    lastPlanarForward.current.copy(basis.forward);

    const moveDirection = movementDirectionFromBasis(movementInput, basis.forward, basis.right);
    const currentVelocity = vectorFromRapier(body.linvel());
    const gravityVelocity = integrateLocalGravity(
      currentVelocity,
      activeSurface.gravity,
      activeSurface.up,
      FIXED_PHYSICS_STEP,
      grounded
    );
    let nextVelocity = composeVelocity(gravityVelocity, moveDirection, activeSurface.up, DEFAULT_MOVE_SPEED);

    const jump = updateJumpState(
      jumpState.current,
      controlsActive.current && controls.jump,
      grounded,
      FIXED_PHYSICS_STEP
    );
    jumpState.current = jump.next;

    if (jump.shouldJump) {
      nextVelocity = applyJumpImpulse(nextVelocity, activeSurface.up, DEFAULT_JUMP_SPEED);
    }

    transitionCooldown.current = Math.max(0, transitionCooldown.current - FIXED_PHYSICS_STEP);
    const transitionLocked = Boolean(rotationAnimation.current) || transitionCooldown.current > 0;

    if (!transitionLocked) {
      const predictedPosition = predictPosition(position, nextVelocity, FIXED_PHYSICS_STEP);
      const targetFace = chooseFaceFromPosition(predictedPosition, activeSurface.face, {
        planetRadius: planetSize,
        hysteresis: EDGE_HYSTERESIS,
        bodyRadius: PLAYER_EDGE_RADIUS,
        velocity: nextVelocity,
        movementDirection: moveDirection
      });

      if (targetFace && beginTransition(targetFace, position, nextVelocity, basis)) {
        return;
      }
    }

    body.setLinvel(vectorToRapier(nextVelocity), true);
  });

  useFrame(() => {
    const body = ref.current;
    if (!body) return;

    frameCount.current += 1;
    updateVisualTransition();
    const position = vectorFromRapier(body.translation());
    onPositionChange?.(position);
    if (lastGroundedNotification.current !== lastGrounded.current) {
      lastGroundedNotification.current = lastGrounded.current;
      onGroundedChange?.(lastGrounded.current);
    }

    const controls = get();
    const deletePressed = controlsActive.current && controls.delete && !previousDeleteKey.current;
    previousDeleteKey.current = controlsActive.current && controls.delete;
    if (deletePressed) {
      handleVoxelDeletion(cameraRef.current);
    }

    if (frameCount.current % 10 === 0) {
      const activeSurface = surfaceRef.current;
      const velocity = vectorFromRapier(body.linvel());
      if (typeof window !== 'undefined') {
        (window as Window & { __voxelDebug?: Record<string, unknown> }).__voxelDebug = {
          ...(window as Window & { __voxelDebug?: Record<string, unknown> }).__voxelDebug,
          player: {
            face: activeSurface.face,
            targetFace: activeSurface.targetFace,
            grounded: lastGrounded.current,
            position: [position.x, position.y, position.z],
            velocity: [velocity.x, velocity.y, velocity.z],
            gravity: [activeSurface.gravity.x, activeSurface.gravity.y, activeSurface.gravity.z],
            transitionCooldown: transitionCooldown.current,
            visualTransitioning: Boolean(rotationAnimation.current)
          }
        };
      }
      onDebugChange?.({
        face: activeSurface.face,
        targetFace: activeSurface.targetFace,
        grounded: lastGrounded.current,
        controlsActive: controlsActive.current,
        speed: velocity.length(),
        gravity: [activeSurface.gravity.x, activeSurface.gravity.y, activeSurface.gravity.z],
        position: [position.x, position.y, position.z]
      });
    }
  });

  return (
    <>
      <CameraControls
        cameraRef={cameraRef}
        activeUp={surfaceState.up}
        getActiveUp={() => visualCameraUp.current}
        onPointerLockChange={handlePointerLockChange}
      />
      <RigidBody
        ref={ref}
        colliders={false}
        mass={1}
        type="dynamic"
        position={[initialSpawnPosition.x, initialSpawnPosition.y, initialSpawnPosition.z]}
        lockRotations
        gravityScale={0}
        linearDamping={0.5}
        angularDamping={0.8}
        canSleep={false}
        ccd
      >
        <CapsuleCollider args={[0.5, 0.5]} />

        <PerspectiveCamera
          ref={cameraRef}
          position={[0, 1, 0]}
          makeDefault
          fov={75}
          near={0.05}
          far={planetSize * 120}
        />

        <mesh>
          <capsuleGeometry args={[0.5, 1]} />
          <meshStandardMaterial color="#3f7fd9" roughness={0.75} />
        </mesh>
      </RigidBody>
    </>
  );
}
