import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  dominantFaceForPosition,
  FACE_NORMALS,
  GRAVITY_STRENGTH,
  getSurfaceState,
  quaternionForUp,
  integrateLocalGravity,
  JETPACK_MAX_FUEL,
  JETPACK_MAX_UP_SPEED,
  JETPACK_REFILL_RATE,
  JETPACK_THRUST,
  makeTangentBasis,
  movementDirectionFromBasis,
  planarCameraBasis,
  predictPosition,
  reprojectVelocityOntoFace,
  transitionVelocityAcrossEdge,
  transportControlFrame,
  updateJumpState,
  vectorFromRapier,
  vectorToRapier,
  wrapPositionAroundEdge
} from '../utils/surfaceControls';
import { resolveSurfaceFrame } from '../utils/surfaceResolver';
import { smoothUpForPosition } from '../utils/gravityField';
import { setPlayerUp } from '../state/playerFrame';
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
  TRANSITION_MIN_INWARD_SPEED,
  VOXEL_SCALE
} from '../utils/cubeGravityConstants';
import { isTouchActive } from '../utils/mobileInput';
import { MaterialType } from '../types/materials';
import { canHarvestVoxel, harvestVoxel } from '../game/systems/harvestingSystem';
import { setLookedAtVoxel, type LookedAtVoxel } from '../game/systems/targeting';

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(0, 0);
const BLOCK_REACH = 8;
const PLAYER_TOOL_TIER = 3;
// Continuous smooth-gravity field is now the DEFAULT (no faces/transitions/
// resolver — can't fall off or get stuck by construction). The discrete 6-face
// state machine stays available via ?gravity=discrete as a one-session safety
// hatch; once smooth is confirmed across all scenarios the discrete machinery
// (surfaceResolver, chooseFaceFromPosition, beginTransition, wrap/cooldowns) can
// be deleted.
const SMOOTH_GRAVITY = typeof window === 'undefined'
  || new URLSearchParams(window.location.search).get('gravity') !== 'discrete';
// Scratch for the cheap "what am I looking at" voxel ray-march (avoids a
// 125k-instance InstancedMesh raycast every frame).
const _lookOrigin = new THREE.Vector3();
const _lookDir = new THREE.Vector3();

// Rotation taking oldUp -> newUp, robust for the ANTIPARALLEL case (top<->bottom
// after a straight tunnel-through) where setFromUnitVectors is degenerate.
function rotationBetweenUps(oldUp: THREE.Vector3, newUp: THREE.Vector3): THREE.Quaternion {
  const d = THREE.MathUtils.clamp(oldUp.dot(newUp), -1, 1);
  if (d < -0.9999) {
    const axis = (Math.abs(oldUp.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1));
    axis.cross(oldUp).normalize();
    return new THREE.Quaternion().setFromAxisAngle(axis, Math.PI);
  }
  return new THREE.Quaternion().setFromUnitVectors(oldUp, newUp);
}

// Jetpack fuel as a normalized 0..1 value, exposed module-side so the HUD can
// poll it per-frame (mirrors ShipController.getEngageCharge) without re-rendering.
let jetpackFuelDisplay = 1;
export function getJetpackFuel(): number {
  return jetpackFuelDisplay;
}
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

  // Seed gravity from the SPAWN position's face, not a hardcoded 'top'. Exiting
  // the ship spawns you wherever you landed it (any of the 6 faces); initializing
  // to 'top' left gravity pointing the wrong way for the first frames (and mid-
  // face it never auto-corrected, since chooseFaceFromPosition only fires at edges).
  const [surfaceState, setSurfaceState] = useState<SurfaceState>(
    () => getSurfaceState(initialPosition ? dominantFaceForPosition(initialPosition) : 'top')
  );
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
  const jetpackFuel = useRef(JETPACK_MAX_FUEL);
  const defaultSpawnPosition = useMemo(
    () => new THREE.Vector3(0, planetSize + PLAYER_CENTER_CLEARANCE + 2, 0),
    [planetSize]
  );
  const initialSpawnPosition = useMemo(
    () => (initialPosition ?? defaultSpawnPosition).clone(),
    [defaultSpawnPosition, initialPosition]
  );
  // Initial body rotation aligned to the SPAWN face (not identity/top), so the
  // capsule + camera are correctly oriented on the first frame after exiting the
  // ship on any face — no tilted body poking into view before a transition fires.
  const initialSpawnQuat = useMemo(
    () => quaternionForUp(FACE_NORMALS[dominantFaceForPosition(initialSpawnPosition)]),
    [initialSpawnPosition]
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

  // Emit the initial (spawn-position-derived) surface once on mount so the scene
  // and planet orient collision streaming correctly from the first frame after a
  // spawn or ship exit, not just after the first edge transition.
  useEffect(() => {
    onSurfaceChange?.({
      ...surfaceRef.current,
      up: surfaceRef.current.up.clone(),
      gravity: surfaceRef.current.gravity.clone()
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    // Validate the wrap actually lands on the target face — otherwise the edge
    // heuristic mis-fired (corner ambiguity); reject and let the resolver correct.
    if (dominantFaceForPosition(wrappedPosition) !== targetFace) return false;
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

  // Resolver-driven correction (NO position wrap — you're already physically on
  // the target face): used for tunnel-exit snaps and escape recovery. Reorients
  // gravity, reprojects velocity so a face change can't launch you sideways,
  // eases the camera, and optionally clamps the position back inside the planet.
  const beginReorient = useCallback((
    targetFace: CubeFace,
    velocity: THREE.Vector3,
    clampPosition?: THREE.Vector3
  ) => {
    const body = ref.current;
    if (!body) return;
    const current = surfaceRef.current;
    const target = getSurfaceState(targetFace);

    if (clampPosition) body.setTranslation(vectorToRapier(clampPosition), true);

    const reprojected = reprojectVelocityOntoFace(velocity, target.up);
    body.setLinvel(vectorToRapier(reprojected), true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    body.lockRotations(true, true);

    if (target.face !== current.face) {
      updateVisualTransition();
      const cr = body.rotation();
      const startRotation = new THREE.Quaternion(cr.x, cr.y, cr.z, cr.w);
      const delta = rotationBetweenUps(current.up, target.up);
      const targetRotation = new THREE.Quaternion().multiplyQuaternions(delta, startRotation);
      rotationAnimation.current = {
        startTime: performance.now(),
        startRotation,
        targetRotation
      };
      lastPlanarForward.current.applyQuaternion(delta).normalize();
      transitionCooldown.current = TRANSITION_LOCK_TIME;
      setSurface(target);
    }
  }, [setSurface, updateVisualTransition]);

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

    const voxel = voxelSystem.getVoxel(coord.x, coord.y, coord.z);
    if (!voxel || !canHarvestVoxel({ blockId: voxel.blockId, deposit: voxel.deposit, toolTier: PLAYER_TOOL_TIER })) {
      return;
    }

    if (voxelSystem.removeVoxel(coord.x, coord.y, coord.z)) {
      harvestVoxel({ blockId: voxel.blockId, deposit: voxel.deposit, toolTier: PLAYER_TOOL_TIER });
      voxelSystem.exposeNeighbors(coord.x, coord.y, coord.z);
    }
  }, []);

  // Cheap ray-march to find the voxel under the crosshair, for the "looking at"
  // readout. Marches in voxel space (round(world/VOXEL_SCALE)) over the reach —
  // O(reach) Map lookups instead of testing every instance.
  const updateLookedAt = useCallback((camera: THREE.Camera | null) => {
    if (!camera || !(controlsActive.current || isTouchActive())) {
      setLookedAtVoxel(null);
      return;
    }
    camera.getWorldPosition(_lookOrigin);
    camera.getWorldDirection(_lookDir);
    let found: LookedAtVoxel | null = null;
    for (let t = 1.0; t <= BLOCK_REACH; t += 0.45) {
      const vx = Math.round((_lookOrigin.x + _lookDir.x * t) / VOXEL_SCALE);
      const vy = Math.round((_lookOrigin.y + _lookDir.y * t) / VOXEL_SCALE);
      const vz = Math.round((_lookOrigin.z + _lookDir.z * t) / VOXEL_SCALE);
      if (voxelSystem.hasVoxel(vx, vy, vz)) {
        const voxel = voxelSystem.getVoxel(vx, vy, vz);
        found = voxel
          ? {
              material: voxel.material as MaterialType,
              blockId: voxel.blockId,
              deposit: voxel.deposit
            }
          : null;
        break;
      }
    }
    setLookedAtVoxel(found);
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

    transitionCooldown.current = Math.max(0, transitionCooldown.current - FIXED_PHYSICS_STEP);

    // Active surface frame. Either the continuous smooth-gravity FIELD prototype
    // (?gravity=smooth — no faces/transitions/resolver, can't fall off or get
    // stuck by construction) or the discrete 6-face state machine (default), with
    // the resolver as its single authority + anti-escape guard.
    let activeUp: THREE.Vector3;
    let activeGravity: THREE.Vector3;

    if (SMOOTH_GRAVITY) {
      activeUp = smoothUpForPosition(position, { radius: planetSize });
      activeGravity = activeUp.clone().multiplyScalar(-GRAVITY_STRENGTH);
      // Continuous field -> orient the capsule + camera directly each frame; no
      // transition animation needed (the field never jumps).
      body.setRotation(quaternionForUp(activeUp), true);
      visualCameraUp.current.copy(activeUp);
      surfaceRef.current = {
        face: dominantFaceForPosition(position),
        up: activeUp,
        gravity: activeGravity,
        phase: 'stable',
        targetFace: null
      };
    } else {
      // --- SURFACE RESOLVER: single authority on which face's gravity applies,
      // run FIRST so grounding/movement evaluate against the RESOLVED up. Handles
      // tunnel-exit snaps + the hard anti-escape guard; intentional edge-walks
      // fall through ('hold') to the existing path below.
      const preVelocity = vectorFromRapier(body.linvel());
      const resolved = resolveSurfaceFrame({
        position,
        velocity: preVelocity,
        currentFace: surfaceRef.current.face,
        planetRadius: planetSize
      });
      if (resolved.mode === 'escape') {
        beginReorient(resolved.face, resolved.velocityCorrection ?? preVelocity, resolved.positionClamp);
        return;
      }
      const reorientLocked = Boolean(rotationAnimation.current) || transitionCooldown.current > 0;
      if (resolved.mode === 'snap' && !reorientLocked) {
        beginReorient(resolved.face, preVelocity);
        return;
      }
      activeUp = surfaceRef.current.up;
      activeGravity = surfaceRef.current.gravity;
    }

    // Publish the local up so the sky/lighting can drive LOCAL day/night
    // (chase-the-light): the sun lights the hemisphere this up faces.
    setPlayerUp(activeUp);

    const grounded = checkGrounded(position, activeUp);
    lastGrounded.current = grounded;

    // Input is enabled by pointer lock (desktop) OR active touch controls (mobile).
    const active = controlsActive.current || isTouchActive();

    const movementInput = active
      ? {
          forward: controls.forward,
          backward: controls.backward,
          left: controls.left,
          right: controls.right
        }
      : { forward: false, backward: false, left: false, right: false };

    const basis = cameraRef.current
      ? planarCameraBasis(cameraRef.current, activeUp, lastPlanarForward.current)
      : makeTangentBasis(activeUp, lastPlanarForward.current);
    lastPlanarForward.current.copy(basis.forward);

    const moveDirection = movementDirectionFromBasis(movementInput, basis.forward, basis.right);
    const currentVelocity = vectorFromRapier(body.linvel());
    const gravityVelocity = integrateLocalGravity(
      currentVelocity,
      activeGravity,
      activeUp,
      FIXED_PHYSICS_STEP,
      grounded
    );
    let nextVelocity = composeVelocity(gravityVelocity, moveDirection, activeUp, DEFAULT_MOVE_SPEED);

    const jump = updateJumpState(
      jumpState.current,
      active && controls.jump,
      grounded,
      FIXED_PHYSICS_STEP
    );
    jumpState.current = jump.next;

    if (jump.shouldJump) {
      nextVelocity = applyJumpImpulse(nextVelocity, activeUp, DEFAULT_JUMP_SPEED);
    }

    // Hold-jump jetpack: once airborne, holding jump burns limited fuel for a
    // gentle upward thrust (controlled hover/boost), capped so it's not a rocket.
    // Fuel refills while grounded. shouldJump (the ground impulse) takes priority.
    const jumpHeld = active && controls.jump;
    if (grounded) {
      jetpackFuel.current = Math.min(
        JETPACK_MAX_FUEL,
        jetpackFuel.current + JETPACK_REFILL_RATE * FIXED_PHYSICS_STEP
      );
    } else if (jumpHeld && !jump.shouldJump && jetpackFuel.current > 0) {
      jetpackFuel.current = Math.max(0, jetpackFuel.current - FIXED_PHYSICS_STEP);
      const upSpeed = nextVelocity.dot(activeUp);
      if (upSpeed < JETPACK_MAX_UP_SPEED) {
        const add = Math.min(JETPACK_THRUST * FIXED_PHYSICS_STEP, JETPACK_MAX_UP_SPEED - upSpeed);
        nextVelocity.addScaledVector(activeUp, add);
      }
    }
    jetpackFuelDisplay = jetpackFuel.current / JETPACK_MAX_FUEL;

    // (cooldown already decremented at the top of the step, before the resolver.)
    // Edge-walk is part of the DISCRETE system only; the smooth field never needs it.
    const transitionLocked = Boolean(rotationAnimation.current) || transitionCooldown.current > 0;

    if (!SMOOTH_GRAVITY && !transitionLocked) {
      const predictedPosition = predictPosition(position, nextVelocity, FIXED_PHYSICS_STEP);
      const targetFace = chooseFaceFromPosition(predictedPosition, surfaceRef.current.face, {
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
    const deleteActive = controlsActive.current || isTouchActive();
    const deletePressed = deleteActive && controls.delete && !previousDeleteKey.current;
    previousDeleteKey.current = deleteActive && controls.delete;
    if (deletePressed) {
      handleVoxelDeletion(cameraRef.current);
    }

    // Update the "looking at" readout a few times/sec (cheap voxel march).
    if (frameCount.current % 4 === 0) {
      updateLookedAt(cameraRef.current);
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
        quaternion={[initialSpawnQuat.x, initialSpawnQuat.y, initialSpawnQuat.z, initialSpawnQuat.w]}
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

        {/* First-person body. Hidden: the camera is a child of this same rigid
            body, so the blue capsule would clip into the bottom of the view as
            gravity reorients near an edge (the "blue horizontal plane" artifact).
            Overview/agent cameras don't mount this rig, so nothing else needs it. */}
        <mesh visible={false}>
          <capsuleGeometry args={[0.5, 1]} />
          <meshStandardMaterial color="#3f7fd9" roughness={0.75} />
        </mesh>
      </RigidBody>
    </>
  );
}
