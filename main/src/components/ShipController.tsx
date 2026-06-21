import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useRapier } from '@react-three/rapier';
import { PerspectiveCamera, useKeyboardControls } from '@react-three/drei';
import { vectorToRapier, shipImpactOutcome } from '../utils/surfaceControls';
import { isTouchActive } from '../utils/mobileInput';
import type { WorldArrivalPose } from '../utils/worldArrival';
import {
  beginAtmosphereWarp,
  beginTravel,
  enterAtmosphere,
  getSpaceFlightSnapshot,
  useSpaceFlight
} from '../state/spaceFlight.ts';

const MOUSE_SENSITIVITY = 0.0016;
/** Camera orientation smoothing rate (higher = snappier). The physics `quat`
 *  stays authoritative; the camera slerps toward it so look isn't twitchy. */
const CAM_SMOOTH = 12;
/** Forward thrust acceleration (world units / s^2). */
const THRUST_ACCEL = 60;
const BOOST_MULTIPLIER = 3.2;
/** Velocity retained per second (mild space drag so the ship is controllable). */
const DAMPING = 0.6;
const MAX_SPEED = 320;
const ROLL_SPEED = 1.6; // rad/s
/** Rest height of the landed ship above the terrain it touched. */
const SHIP_GROUND_CLEARANCE = 2.5;
/** Ship-vs-terrain collision: contact within this clearance triggers a response. */
const CRASH_CLEARANCE = 2.0;
/** Inward (toward-planet) speed above which contact is a CRASH, not a soft stop. */
const CRASH_SPEED = 45;
/** Forced crash-landing settle time (a quick jolt, faster than a gentle F-land). */
const CRASH_LAND_DURATION = 0.5;
/** Press F to land: cast this far toward the planet to find the touchdown point.
 *  Covers the full atmosphere band so F works anywhere once you're inside it. */
const LANDING_APPROACH_DIST = 150;
/** Eased auto-land descent speed (u/s), used to size the touchdown duration. */
const LANDING_DESCENT_SPEED = 26;
const LANDING_MIN_DURATION = 1.2;
const LANDING_MAX_DURATION = 4.0;
/** Atmosphere boundary (altitude = |pos| - surfaceRadius), over a ~50u planet.
 *  You cross into atmosphere well ABOVE the surface (≈2 planet-radii up) so the
 *  approach reads as entering a planet's airspace, not skimming its crust. Flying
 *  DOWN past ATMOS_ENTER enters the atmosphere; climbing UP past ATMOS_LEAVE
 *  reaches space. The gap is hysteresis so the phase can't flap at the boundary. */
const ATMOS_ENTER = 100;
const ATMOS_LEAVE = 135;
/** Launch (Space) ascension: how far off the ground it lifts, and over how long. */
const LAUNCH_RISE = 34;
const LAUNCH_DURATION = 1.4;
/** Max parked peripheral "peek" with the mouse (radians, ~18°). The ship's
 *  heading stays locked while parked; this only nudges the view. */
const MAX_PEEK = 0.32;
/** Pitch clamp (radians) while still in atmosphere; free pitch once in space. */
const ATMOSPHERE_PITCH_CLAMP = Math.PI * 0.49;
/** Seconds of held-thrust-while-locked needed to engage the travel warp. */
const ENGAGE_CHARGE_TIME = 1.3;

/**
 * Engage-charge progress (0..1) for the deep-space "hold W to warp" mechanic,
 * written by ShipController's per-frame loop and read by the DOM HUD reticle
 * (App.tsx) via requestAnimationFrame. A plain module mutable keeps it off the
 * React snapshot so it never triggers re-renders at 60fps.
 */
const engageState = { charge: 0 };

/** Live read of the engage charge (0..1) for the HUD reticle. */
export function getEngageCharge(): number {
  return engageState.charge;
}

// Crash impact flash: timestamp of the last crash; the HUD reads a 0..1 fading
// intensity so it can show a red impact vignette + "CRASHED" message.
const CRASH_FLASH_MS = 1100;
let crashFlashAt = -1e9;
function triggerCrashFlash() {
  crashFlashAt = performance.now();
}
/** Live read of the crash-flash intensity (0..1, fades over ~1s) for the HUD. */
export function getCrashFlash(): number {
  return Math.max(0, 1 - (performance.now() - crashFlashAt) / CRASH_FLASH_MS);
}

/**
 * Build an upright, horizon-facing orientation at a surface position: camera -Z
 * points along a horizon tangent, +Y is local up (away from the planet center).
 * Used for the parked ship and the level-out at touchdown so a landed ship sits
 * naturally on the ground rather than nose-up or nose-into-the-dirt.
 */
function levelOrientation(pos: THREE.Vector3): THREE.Quaternion {
  const up = pos.clone().normalize();
  let ref = new THREE.Vector3(0, 0, 1);
  if (Math.abs(up.dot(ref)) > 0.9) ref = new THREE.Vector3(1, 0, 0);
  const forward = new THREE.Vector3().crossVectors(ref, up).normalize();
  const m = new THREE.Matrix4().lookAt(new THREE.Vector3(), forward, up);
  return new THREE.Quaternion().setFromRotationMatrix(m);
}

interface ShipControllerProps {
  planetSize: number;
  terrainSeed: number;
  arrivalPose: WorldArrivalPose;
  /** Boarding spawn (player position when F was pressed on the surface). */
  boardingPosition: THREE.Vector3;
  onGroundedChange?: (grounded: boolean) => void;
  onPositionChange?: (position: THREE.Vector3) => void;
  /** Reports where the ship set down so the parked ship + on-foot exit spawn THERE. */
  onLanded?: (restPosition: THREE.Vector3) => void;
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
  onPositionChange,
  onLanded
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
  // Smoothed camera orientation (slerps toward `orientation`); kept in sync with
  // `orientation` in the scripted branches so resuming free flight never snaps.
  const displayQuat = useRef(new THREE.Quaternion());
  const pitchInput = useRef(0); // accumulated mouse Y this frame
  const yawInput = useRef(0); // accumulated mouse X this frame
  const rollInput = useRef({ left: false, right: false });
  const isLocked = useRef(false);
  // Active eased auto-landing (F-initiated), or null while flying freely. Landing
  // is NEVER automatic — only this sequence sets the ship down. It also slerps the
  // orientation to level so the parked ship rests upright on the surface.
  const landingSeq = useRef<{
    from: THREE.Vector3; to: THREE.Vector3;
    fromQuat: THREE.Quaternion; toQuat: THREE.Quaternion;
    t: number; duration: number;
  } | null>(null);
  // Active launch ascension (Space-initiated from a parked ship), or null.
  const launchSeq = useRef<{ from: THREE.Vector3; to: THREE.Vector3; t: number; duration: number } | null>(null);
  // Parked peripheral "peek" (yaw/pitch radians) — view-only; ship heading locked.
  const lookOffset = useRef({ yaw: 0, pitch: 0 });
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
      // Interstellar arrival (and ?fly=1): start out in open space above the
      // planet, just beyond the atmosphere boundary so the world is prominent and
      // the descent is short. Faces the planet so it's dead ahead.
      pos = approach.clone().normalize().multiplyScalar(surfaceRadius + ATMOS_LEAVE + 25);
    } else {
      // surface / launch: lift off from the boarding spot (or the parked ship).
      pos = boardingRef.current.clone();
    }

    // Orient the ship for the spawn context.
    let quat: THREE.Quaternion;
    if (phaseAtMount === 'descent' || phaseAtMount === 'approach' || phaseAtMount === 'deep_space') {
      // Airborne arrival: face the planet so the world you arrived at is ahead.
      // Matrix4.lookAt is the CAMERA convention (local -Z faces target), so the
      // target is `forward` directly; thrust (local -Z) then follows the view.
      const up = pos.clone().normalize();
      const forward = up.clone().negate();
      const refUp = new THREE.Vector3(0, 0, 1); // forward∥up, so use a safe ref
      const m = new THREE.Matrix4().lookAt(new THREE.Vector3(), forward, refUp);
      quat = new THREE.Quaternion().setFromRotationMatrix(m);
    } else {
      // Parked on the surface: sit level, facing the horizon (upright).
      quat = levelOrientation(pos);
    }
    return { pos, quat };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surfaceRadius]);

  // Initialise runtime refs from the chosen spawn (once).
  useEffect(() => {
    position.current.copy(spawn.pos);
    velocity.current.set(0, 0, 0);
    orientation.current.copy(spawn.quat);
    landingSeq.current = null;
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
      if (!isLocked.current && !isTouchActive()) return;
      yawInput.current += -event.movementX * MOUSE_SENSITIVITY;
      pitchInput.current += -event.movementY * MOUSE_SENSITIVITY;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && document.pointerLockElement === element) {
        document.exitPointerLock();
        return;
      }
      if (event.code === 'KeyQ') {
        rollInput.current.left = true;
      } else if (event.code === 'KeyE') {
        rollInput.current.right = true;
      }

      // F begins a smooth auto-landing when flying in atmosphere over ground.
      // (Landing is never automatic — it only happens when you ask for it.)
      if (event.code === 'KeyF') {
        const live = getSpaceFlightSnapshot();
        if (live.controlMode !== 'flight' || live.phase !== 'descent') return;
        if (landingSeq.current || launchSeq.current || !world) return;
        const downDir = position.current.clone().normalize().negate();
        const ray = new rapier.Ray(vectorToRapier(position.current), vectorToRapier(downDir));
        const hit = world.castRay(ray, LANDING_APPROACH_DIST, true);
        if (!hit) return; // no ground within range (too high / over a gap)
        const up = position.current.clone().normalize();
        const to = position.current.clone()
          .addScaledVector(downDir, hit.timeOfImpact)
          .addScaledVector(up, SHIP_GROUND_CLEARANCE);
        const dist = position.current.distanceTo(to);
        landingSeq.current = {
          from: position.current.clone(),
          to,
          fromQuat: orientation.current.clone(),
          toQuat: levelOrientation(to), // level out as we touch down
          t: 0,
          duration: THREE.MathUtils.clamp(dist / LANDING_DESCENT_SPEED, LANDING_MIN_DURATION, LANDING_MAX_DURATION)
        };
      }

      // Space LAUNCHES a parked ship: a short eased ascension off the ground into
      // atmospheric flight. You can't fly until you launch (and again after landing).
      if (event.code === 'Space') {
        const live = getSpaceFlightSnapshot();
        const parked = live.controlMode === 'flight' && live.phase === 'surface';
        if (!parked || landingSeq.current || launchSeq.current) return;
        const up = position.current.clone().normalize();
        launchSeq.current = {
          from: position.current.clone(),
          to: position.current.clone().addScaledVector(up, LAUNCH_RISE),
          t: 0,
          duration: LAUNCH_DURATION
        };
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'KeyQ') {
        rollInput.current.left = false;
      } else if (event.code === 'KeyE') {
        rollInput.current.right = false;
      }
    };

    element.addEventListener('click', handleClick);
    document.addEventListener('pointerlockchange', handlePointerLockChange);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    // Boarding hands off from the FPS controller WITHOUT releasing pointer lock,
    // so no pointerlockchange fires when we mount. Seed isLocked from the current
    // lock state so mouse-look works immediately (otherwise the player has to
    // Escape + re-click to regain camera rotation).
    handlePointerLockChange();

    return () => {
      element.removeEventListener('click', handleClick);
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [gl.domElement]);

  // --- per-frame flight integration -----------------------------------------
  useFrame((_, rawDt) => {
    const cam = cameraRef.current;
    if (!cam) return;
    const dt = Math.min(rawDt, 1 / 30); // clamp big frame gaps

    // Eased auto-landing (F-initiated): glide the ship down to the touchdown
    // point, ignoring manual control, decelerating into a gentle set-down
    // (easeOutCubic). Only THIS lands the ship — never automatically.
    // Eased auto-landing (F): glide down to the touchdown point AND level out the
    // orientation, then settle as landed (-> parked). Manual control is suspended.
    const land = landingSeq.current;
    if (land) {
      land.t = Math.min(1, land.t + dt / land.duration);
      const e = 1 - Math.pow(1 - land.t, 3); // easeOutCubic — settling finish
      position.current.lerpVectors(land.from, land.to, e);
      orientation.current.slerpQuaternions(land.fromQuat, land.toQuat, e);
      velocity.current.set(0, 0, 0);
      yawInput.current = 0;
      pitchInput.current = 0;
      cam.position.copy(position.current);
      cam.quaternion.copy(orientation.current);
      displayQuat.current.copy(orientation.current);
      if (land.t >= 1) {
        landingSeq.current = null;
        lookOffset.current.yaw = 0;
        lookOffset.current.pitch = 0;
        onLanded?.(land.to.clone());
        onGroundedChange?.(true); // -> parked (surface + flight)
      }
      return;
    }

    // Eased launch ascension (Space from parked): rise off the ground, then go
    // airborne with full control.
    const launch = launchSeq.current;
    if (launch) {
      launch.t = Math.min(1, launch.t + dt / launch.duration);
      const e = launch.t * launch.t * (3 - 2 * launch.t); // smoothstep
      position.current.lerpVectors(launch.from, launch.to, e);
      velocity.current.set(0, 0, 0);
      yawInput.current = 0;
      pitchInput.current = 0;
      cam.position.copy(position.current);
      cam.quaternion.copy(orientation.current);
      displayQuat.current.copy(orientation.current);
      if (launch.t >= 1) {
        launchSeq.current = null;
        enterAtmosphere(); // surface -> descent (now airborne)
      }
      return;
    }

    // Parked on the surface: the ship is grounded and its heading is LOCKED. You
    // can only take a small peripheral "peek" with the mouse; you must press Space
    // to launch before you can fly. No thrust, no rotation.
    const parkedSnap = getSpaceFlightSnapshot();
    if (parkedSnap.controlMode === 'flight' && parkedSnap.phase === 'surface') {
      const lo = lookOffset.current;
      lo.yaw = THREE.MathUtils.clamp(lo.yaw + yawInput.current, -MAX_PEEK, MAX_PEEK);
      lo.pitch = THREE.MathUtils.clamp(lo.pitch + pitchInput.current, -MAX_PEEK, MAX_PEEK);
      yawInput.current = 0;
      pitchInput.current = 0;
      velocity.current.set(0, 0, 0);
      const peek = new THREE.Quaternion().setFromEuler(new THREE.Euler(lo.pitch, lo.yaw, 0, 'YXZ'));
      cam.position.copy(position.current);
      cam.quaternion.copy(orientation.current).multiply(peek);
      displayQuat.current.copy(cam.quaternion);
      return;
    }

    const controls = get();

    const quat = orientation.current;
    const inAtmosphere = position.current.length() < surfaceRadius + ATMOS_LEAVE;

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
    if (rollInput.current.left) roll += ROLL_SPEED * dt;
    if (rollInput.current.right) roll -= ROLL_SPEED * dt;
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

    // 5b) Terrain collision (descent only) — the ship can't pass through the
    // planet. Cast toward local-down; gentle contact soft-stops at the surface,
    // a fast inward impact CRASHES (impact flash + forced crash-landing -> you
    // must re-launch). Colliders stream around the ship because it publishes its
    // position (step 8), so the cast hits real voxels once near the ground.
    if (world && getSpaceFlightSnapshot().phase === 'descent' && !landingSeq.current && !launchSeq.current) {
      const radial = position.current.clone().normalize();
      const downDir = radial.clone().negate();
      const speed = velocity.current.length();
      const probe = Math.max(CRASH_CLEARANCE + 1, speed * dt + CRASH_CLEARANCE);
      const ray = new rapier.Ray(vectorToRapier(position.current), vectorToRapier(downDir));
      const hit = world.castRay(ray, probe, true);
      if (hit && hit.timeOfImpact <= speed * dt + CRASH_CLEARANCE) {
        const inwardSpeed = -velocity.current.dot(radial); // speed toward the planet
        const rest = position.current.clone()
          .addScaledVector(downDir, hit.timeOfImpact)
          .addScaledVector(radial, SHIP_GROUND_CLEARANCE);
        if (shipImpactOutcome(inwardSpeed, CRASH_SPEED) === 'crash') {
          // CRASH: forced crash-landing to the touchdown point + impact flash.
          landingSeq.current = {
            from: position.current.clone(),
            to: rest,
            fromQuat: orientation.current.clone(),
            toQuat: levelOrientation(rest),
            t: 0,
            duration: CRASH_LAND_DURATION
          };
          velocity.current.set(0, 0, 0);
          triggerCrashFlash();
        } else {
          // Soft contact: clamp to the surface and remove the inward velocity
          // component so you skim along instead of sinking through.
          position.current.copy(rest);
          if (inwardSpeed > 0) velocity.current.addScaledVector(radial, inwardSpeed);
        }
      }
    }

    // 6) Drive the camera — slerp the displayed orientation toward the
    // authoritative `quat` so look is smooth, not twitchy (frame-rate independent).
    cam.position.copy(position.current);
    displayQuat.current.slerp(quat, 1 - Math.exp(-CAM_SMOOTH * dt));
    cam.quaternion.copy(displayQuat.current);

    // 7) Phase-driven launch + landing transitions (read the live snapshot).
    const liveSnap = getSpaceFlightSnapshot();
    const snap = liveSnap.phase;
    const altitude = position.current.length() - surfaceRadius;

    // 7a) Engage-to-warp: in deep space, holding forward thrust while a target is
    // locked (the impostor stays in GalaxyImpostors' aim cone, which keeps
    // `target` set) charges a timer; once full, begin travel to that target.
    // Impostors are camera-relative so you can't physically close distance — the
    // held-aim-thrust charge IS the engage mechanic. Releasing W or losing the
    // lock resets the charge.
    if (snap === 'deep_space' && liveSnap.target && controls.forward) {
      engageState.charge += dt / ENGAGE_CHARGE_TIME;
      if (engageState.charge >= 1) {
        engageState.charge = 0;
        beginTravel(liveSnap.target);
      }
    } else if (engageState.charge !== 0) {
      engageState.charge = 0;
    }

    // 7b) Atmosphere boundary — altitude-driven and BIDIRECTIONAL with hysteresis,
    // so you can always fly down to enter and up to leave (no dead-end). The only
    // warp is the interstellar beginTravel above; crossing the atmosphere is
    // seamless continuous flight.
    if (snap === 'deep_space' && altitude < ATMOS_ENTER) {
      beginAtmosphereWarp('enter');  // fly DOWN into atmosphere (mini-warp masks it)
    } else if (snap === 'descent' && altitude > ATMOS_LEAVE) {
      beginAtmosphereWarp('leave');  // climb OUT to deep space (mini-warp masks it)
    }
    // surface -> descent happens ONLY via the launch ascension (Space); landing
    // happens ONLY via F. Neither is automatic.

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
