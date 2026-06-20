import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useRapier } from '@react-three/rapier';
import { PerspectiveCamera, useKeyboardControls } from '@react-three/drei';
import { vectorToRapier } from '../utils/surfaceControls';
import type { WorldArrivalPose } from '../utils/worldArrival';
import {
  beginLaunch,
  getSpaceFlightSnapshot,
  LAUNCH_ALTITUDE,
  useSpaceFlight
} from '../state/spaceFlight.ts';

const MOUSE_SENSITIVITY = 0.0022;
/** Forward thrust acceleration (world units / s^2). */
const THRUST_ACCEL = 60;
const BOOST_MULTIPLIER = 3.2;
/** Velocity retained per second (mild space drag so the ship is controllable). */
const DAMPING = 0.6;
const MAX_SPEED = 320;
const ROLL_SPEED = 1.6; // rad/s
/** Below this distance-from-origin (minus surface) AND slow, treat as landed. */
const LANDING_ALTITUDE = 6;
const LANDING_SPEED = 14;
/** Pitch clamp (radians) while still in atmosphere; free pitch once in space. */
const ATMOSPHERE_PITCH_CLAMP = Math.PI * 0.49;

interface ShipControllerProps {
  planetSize: number;
  terrainSeed: number;
  arrivalPose: WorldArrivalPose;
  /** Boarding spawn (player position when F was pressed on the surface). */
  boardingPosition: THREE.Vector3;
  onGroundedChange?: (grounded: boolean) => void;
  onPositionChange?: (position: THREE.Vector3) => void;
}

/**
 * First-person 6-DOF spaceship flight controller.
 *
 * Owns its OWN makeDefault camera (far=8000 so the ~2400u impostors stay
 * visible, near=1 reclaims depth precision off-surface). No Rapier rigidbody:
 * position + velocity are integrated manually in useFrame because physics is
 * only needed on the surface; the only Rapier use is a downward raycast for
 * landing detection over a freshly-arrived world.
 *
 * Orientation is a single quaternion. Mouse X -> yaw about the ship's local up,
 * Mouse Y -> pitch about local right, Q/E -> roll about local forward. Thrust is
 * along ship-forward (W/S), with Shift boost. Velocity damps mildly and is
 * capped. EfficientScene REMOUNTS on world swap (key=coordinate), so this reads
 * `phase` ONCE on mount to pick the spawn pose.
 */
export default function ShipController({
  planetSize,
  arrivalPose,
  boardingPosition,
  onGroundedChange,
  onPositionChange
}: ShipControllerProps) {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const { gl } = useThree();
  const { world, rapier } = useRapier();
  const { phase } = useSpaceFlight();

  // Snapshot phase + spawn inputs ONCE (the component remounts per world swap, so
  // a fresh mount re-reads phase; mid-flight prop churn must NOT reset the ship).
  const spawnPhaseRef = useRef(phase);
  const boardingRef = useRef(boardingPosition.clone());
  const approachRef = useRef(arrivalPose.approachPosition.clone());

  // --- runtime state (mutated per-frame, never triggers re-render) ----------
  const position = useRef(new THREE.Vector3());
  const velocity = useRef(new THREE.Vector3());
  const orientation = useRef(new THREE.Quaternion());
  const pitchInput = useRef(0); // accumulated mouse Y this frame
  const yawInput = useRef(0); // accumulated mouse X this frame
  const isLocked = useRef(false);
  const launchFired = useRef(false);
  const landedNotified = useRef(false);
  const lastPublished = useRef(new THREE.Vector3(Infinity, Infinity, Infinity));
  const [, get] = useKeyboardControls();

  /** Planet surface radius in world units (planetSize = world half-extent). */
  const surfaceRadius = planetSize;

  // Pick spawn position + initial orientation from the mount-time phase. Reads
  // only refs captured at mount, so per-frame prop churn never recomputes it.
  const spawn = useMemo(() => {
    const phaseAtMount = spawnPhaseRef.current;
    const approach = approachRef.current;
    let pos: THREE.Vector3;
    if (phaseAtMount === 'descent' || phaseAtMount === 'approach') {
      // Just warped in above a fresh world: start high, looking down.
      pos = approach.clone();
    } else if (phaseAtMount === 'deep_space') {
      // ?fly=1 debug entry: start well above the planet in open space.
      pos = approach.clone().normalize().multiplyScalar(surfaceRadius + LAUNCH_ALTITUDE + 200);
    } else {
      // surface / launch: lift off from the boarding spot (or the parked ship).
      pos = boardingRef.current.clone();
    }

    // Orient: forward points along the ship's travel intent. On the surface we
    // face "up and out" so thrusting climbs toward launch; in space we face
    // toward the planet so a fresh deep-space spawn sees the world ahead.
    const up = pos.clone().normalize();
    let forward: THREE.Vector3;
    if (phaseAtMount === 'descent' || phaseAtMount === 'approach' || phaseAtMount === 'deep_space') {
      forward = up.clone().negate(); // look toward the planet/origin
    } else {
      forward = up.clone(); // surface: look skyward so W climbs to launch
    }
    const quat = new THREE.Quaternion();
    // Build a basis whose -Z is `forward` and whose +Y is roughly `up`.
    const refUp = Math.abs(forward.dot(up)) > 0.95 ? new THREE.Vector3(0, 0, 1) : up;
    // Matrix4.lookAt is the CAMERA convention (local -Z faces `target`). We want
    // the camera to look ALONG `forward`, so target = forward (NOT negated); the
    // thrust axis is also local -Z, so W then thrusts toward where you look.
    const m = new THREE.Matrix4().lookAt(new THREE.Vector3(), forward.clone(), refUp);
    quat.setFromRotationMatrix(m);
    return { pos, quat };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surfaceRadius]);

  // Initialise runtime refs from the chosen spawn (once).
  useEffect(() => {
    position.current.copy(spawn.pos);
    velocity.current.set(0, 0, 0);
    orientation.current.copy(spawn.quat);
    launchFired.current = false;
    landedNotified.current = false;
  }, [spawn]);

  // --- pointer lock + mouse look (mirrors CameraControls) -------------------
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
      isLocked.current = document.pointerLockElement === element;
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!isLocked.current) return;
      yawInput.current += -event.movementX * MOUSE_SENSITIVITY;
      pitchInput.current += -event.movementY * MOUSE_SENSITIVITY;
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
    };
  }, [gl.domElement]);

  // --- per-frame flight integration -----------------------------------------
  useFrame((_, rawDt) => {
    const cam = cameraRef.current;
    if (!cam) return;
    const dt = Math.min(rawDt, 1 / 30); // clamp big frame gaps
    const controls = get();

    const quat = orientation.current;
    const inAtmosphere = position.current.length() < surfaceRadius + LAUNCH_ALTITUDE;

    // 1) Apply accumulated look deltas as local rotations.
    const localRight = new THREE.Vector3(1, 0, 0).applyQuaternion(quat);
    const localUp = new THREE.Vector3(0, 1, 0).applyQuaternion(quat);
    const localForward = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);

    if (yawInput.current !== 0) {
      quat.premultiply(new THREE.Quaternion().setFromAxisAngle(localUp, yawInput.current));
    }
    if (pitchInput.current !== 0) {
      let pitch = pitchInput.current;
      if (inAtmosphere) {
        // Clamp pitch in atmosphere: don't let nose cross near-vertical relative
        // to the local horizon (prevents disorienting flips near the ground).
        const radialUp = position.current.clone().normalize();
        const currentForward = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
        const elevation = Math.asin(THREE.MathUtils.clamp(currentForward.dot(radialUp), -1, 1));
        const next = THREE.MathUtils.clamp(elevation + pitch, -ATMOSPHERE_PITCH_CLAMP, ATMOSPHERE_PITCH_CLAMP);
        pitch = next - elevation;
      }
      quat.premultiply(new THREE.Quaternion().setFromAxisAngle(localRight, pitch));
    }
    yawInput.current = 0;
    pitchInput.current = 0;

    // 2) Roll (Q/E) about local forward.
    let roll = 0;
    if (controls.rollLeft) roll += ROLL_SPEED * dt;
    if (controls.rollRight) roll -= ROLL_SPEED * dt;
    if (roll !== 0) {
      quat.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, -1), roll));
    }
    quat.normalize();

    // 3) Thrust along ship forward (recompute after rotation).
    localForward.set(0, 0, -1).applyQuaternion(quat);
    const boost = controls.jump ? BOOST_MULTIPLIER : 1;
    let accel = 0;
    if (controls.forward) accel += THRUST_ACCEL * boost;
    if (controls.backward) accel -= THRUST_ACCEL;
    if (accel !== 0) {
      velocity.current.addScaledVector(localForward, accel * dt);
    }

    // 4) Damping + speed clamp.
    const damp = Math.pow(DAMPING, dt);
    velocity.current.multiplyScalar(damp);
    if (velocity.current.length() > MAX_SPEED) {
      velocity.current.setLength(MAX_SPEED);
    }

    // 5) Integrate position.
    position.current.addScaledVector(velocity.current, dt);

    // 6) Drive the camera.
    cam.position.copy(position.current);
    cam.quaternion.copy(quat);

    // 7) Phase-driven launch + landing transitions (read the live snapshot).
    const snap = getSpaceFlightSnapshot().phase;
    const altitude = position.current.length() - surfaceRadius;

    if (snap === 'surface' && !launchFired.current && altitude > LAUNCH_ALTITUDE) {
      launchFired.current = true;
      beginLaunch();
    }

    if (snap === 'descent' && !landedNotified.current) {
      // Forgiving landing: near the surface (raycast or radial heuristic) + slow.
      const speed = velocity.current.length();
      const radialAltitude = altitude;
      let nearGround = radialAltitude < LANDING_ALTITUDE;
      if (!nearGround && radialAltitude < LANDING_ALTITUDE + 20) {
        // Refine with a downward (toward-origin) raycast against terrain.
        const dir = position.current.clone().normalize().negate();
        const ray = new rapier.Ray(vectorToRapier(position.current), vectorToRapier(dir));
        const hit = world.castRay(ray, LANDING_ALTITUDE + 4, true);
        if (hit) nearGround = true;
      }
      if (nearGround && speed < LANDING_SPEED) {
        landedNotified.current = true;
        onGroundedChange?.(true);
      }
    }

    // 8) Publish position so grass/trees/water cull around the ship.
    if (lastPublished.current.distanceToSquared(position.current) > 1) {
      lastPublished.current.copy(position.current);
      onPositionChange?.(position.current.clone());
    }
  });

  return (
    <>
      <PerspectiveCamera
        ref={cameraRef}
        makeDefault
        fov={70}
        near={1}
        far={8000}
      />
      <Cockpit cameraRef={cameraRef} />
    </>
  );
}

// (Cockpit defined below.)

/**
 * Lightweight first-person cockpit frame, parented to the flight camera.
 *
 * Everything sits at z in [-2.2 .. -3.8] in camera space (well beyond the near
 * plane at z=1, so it never clips) and is pushed toward the frustum EDGES so the
 * centre of the view stays clear. A handful of unlit/standard meshes, no shadows.
 * Re-parented every frame to the camera transform via a group whose matrix we
 * sync, because the camera is a makeDefault camera (not part of the JSX tree we
 * can nest under directly without it being the renderer's camera).
 */
function Cockpit({ cameraRef }: { cameraRef: React.RefObject<THREE.PerspectiveCamera | null> }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    const cam = cameraRef.current;
    const grp = groupRef.current;
    if (!cam || !grp) return;
    // Lock the cockpit group to the camera's world transform so the struts feel
    // rigidly attached to the viewpoint.
    grp.position.copy(cam.position);
    grp.quaternion.copy(cam.quaternion);
  });

  const darkMetal = useMemo(
    () => ({ color: '#1a1f29', roughness: 0.55, metalness: 0.7 }),
    []
  );

  return (
    <group ref={groupRef}>
      {/* Lower dashboard lip across the bottom of the view. */}
      <mesh position={[0, -1.05, -2.6]} rotation={[0.5, 0, 0]}>
        <boxGeometry args={[3.4, 0.5, 0.18]} />
        <meshStandardMaterial {...darkMetal} />
      </mesh>

      {/* Left + right canopy struts framing the edges. */}
      <mesh position={[-1.55, 0.35, -2.9]} rotation={[0, 0.32, 0.28]}>
        <boxGeometry args={[0.14, 2.6, 0.14]} />
        <meshStandardMaterial {...darkMetal} />
      </mesh>
      <mesh position={[1.55, 0.35, -2.9]} rotation={[0, -0.32, -0.28]}>
        <boxGeometry args={[0.14, 2.6, 0.14]} />
        <meshStandardMaterial {...darkMetal} />
      </mesh>

      {/* Top canopy bar. */}
      <mesh position={[0, 1.35, -3.2]} rotation={[0.2, 0, 0]}>
        <boxGeometry args={[2.9, 0.14, 0.14]} />
        <meshStandardMaterial {...darkMetal} />
      </mesh>

      {/* A couple of glowing instrument accents on the dashboard. */}
      <mesh position={[-0.85, -0.92, -2.45]} rotation={[0.5, 0, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.05, 16]} />
        <meshStandardMaterial color="#0b2740" emissive="#39d0ff" emissiveIntensity={1.4} />
      </mesh>
      <mesh position={[0.85, -0.92, -2.45]} rotation={[0.5, 0, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.05, 16]} />
        <meshStandardMaterial color="#2a0b0b" emissive="#ff7a39" emissiveIntensity={1.2} />
      </mesh>
      <mesh position={[0, -0.86, -2.4]} rotation={[0.5, 0, 0]}>
        <boxGeometry args={[0.5, 0.08, 0.04]} />
        <meshStandardMaterial color="#06180f" emissive="#46ff9b" emissiveIntensity={1.0} />
      </mesh>
    </group>
  );
}
