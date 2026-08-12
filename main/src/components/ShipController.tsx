import { useCallback, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useRapier } from '@react-three/rapier';
import { PerspectiveCamera, useKeyboardControls } from '@react-three/drei';
import ShipCockpit from './ShipCockpit.tsx';
import {
  SHIP_REST_CLEARANCE,
  shipLevelOrientation,
  shipSurfaceUp
} from '../utils/shipDesign.ts';
import {
  dominantFaceForPosition,
  vectorFromRapier,
  vectorToRapier,
  shipImpactOutcome
} from '../utils/surfaceControls';
import { isTouchActive } from '../utils/mobileInput';
import type { WorldArrivalPose } from '../utils/worldArrival';
import {
  beginAtmosphereWarp,
  beginTravel,
  enterAtmosphere,
  getSpaceFlightSnapshot,
  useSpaceFlight
} from '../state/spaceFlight.ts';
import { playSfx, setShipThrustSfx } from '../audio/sfxEngine.ts';
import { requestMultiplayerPartyWarp } from '../game/multiplayerSession.ts';
import {
  acquireSystemPoseWriter,
  getSystemFlightSnapshot,
  planetLocalPoseToSystemPose,
  releaseSystemPoseWriter,
  resetSystemFlightForInterstellarArrival,
  setActiveSystemPlanet,
  setSystemLocationMode,
  systemPoseToPlanetLocalPose,
  updateSystemShipPose,
  updateSystemShipPoseFromPlanetLocal,
  type SystemPoseWriterLease,
  type SystemVectorTuple
} from '../state/systemFlight.ts';
import { buildStarSystemManifest, type SystemCoordinate } from '../game/starSystem.ts';
import {
  ATMOS_ENTER_ALTITUDE,
  ATMOS_LEAVE_ALTITUDE
} from '../game/atmosphereSpace.ts';
import { LOCAL_SYSTEM_FLIGHT_CAMERA_FAR } from '../game/celestialRenderScale.ts';
import { coordinateKey } from '../utils/worldCoordinates.ts';
import {
  getSystemTravelAssistTarget,
  systemApproachSpeedLimit
} from '../state/systemTravelAssist.ts';
import {
  getShipFlightFeedback,
  resetShipFlightFeedback,
  resolveShipBoost,
  updateShipFlightFeedback,
  type ShipFlightFeedback
} from '../state/shipFlightFeedback.ts';
import { getWorldGen } from '../utils/worldGenCache.ts';
import {
  findValidSpawnSite,
  resolveSafeShipBoardingPosition
} from '../utils/spawnValidation.ts';
import { voxelSystem } from '../utils/efficientVoxelSystem.ts';
import { landingHitMatchesValidatedTerrain } from '../utils/shipLandingValidation.ts';
import { persistShipFlightLocation } from '../state/shipFlightContinuity.ts';
import { getAutopilotFlightDirective } from '../story/autopilot.ts';
import { getStoryStateSnapshot } from '../story/storyState.ts';
import { getStoryInputPolicy } from '../story/storyInputPolicy.ts';
import {
  VEHICLE_SCENE_AV_EVENTS,
  activateLaunchIgnitionFromCreatedSequence,
  activateVehicleSceneAvEvent,
  hasLaunchPhysicallyDeparted
} from '../story/vehicleSceneAvAnchors.ts';
import { isPhysicalBoardingVehicleControlLocked } from '../story/physicalBoarding.ts';

const MOUSE_SENSITIVITY = 0.0016;
/** Camera orientation smoothing rate (higher = snappier). The physics `quat`
 *  stays authoritative; the camera slerps toward it so look isn't twitchy. */
const CAM_SMOOTH = 22;
/** Forward thrust acceleration (world units / s^2). */
const THRUST_ACCEL = 60;
const BOOST_MULTIPLIER = 3.2;
/** Velocity retained per second (mild space drag so the ship is controllable). */
const DAMPING = 0.6;
const MAX_SPEED = 320;
const ROLL_SPEED = 1.6; // rad/s
/** Rest height of the landed ship above the terrain it touched. */
const SHIP_GROUND_CLEARANCE = SHIP_REST_CLEARANCE;
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
 *  reaches space. The gap is hysteresis so the phase can't flap at the boundary.
 *  Shared with the celestial atmosphere→space blend so the visual band and the
 *  phase machine can never drift apart. */
const ATMOS_ENTER = ATMOS_ENTER_ALTITUDE;
const ATMOS_LEAVE = ATMOS_LEAVE_ALTITUDE;
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
const engageState = { charge: 0, waitingForFreshForward: false };

/** Live read of the engage state for the HUD reticle. */
export function getEngageState(): { charge: number; waitingForFreshForward: boolean } {
  return engageState;
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

// Level-out orientation shared with the parked exterior (shipLevelOrientation):
// the landing sequence slerps to this so a landed ship sits upright facing the
// horizon, and SpaceshipPlaceholder renders the parked hull in the same frame.
const levelOrientation = shipLevelOrientation;

declare global {
  interface Window {
    __paravoxiaShipProbe?: {
      injectLookDelta(yawRadians: number, pitchRadians: number): void;
      setLocalPosition(x: number, y: number, z: number): void;
      getFeedback(): ShipFlightFeedback;
      getFov(): number;
      getCockpitStats(): {
        meshes: number;
        triangles: number;
        materials: number;
        transparentMaterials: number;
        scale: number;
      };
    };
  }
}

interface ShipControllerProps {
  planetSize: number;
  paused?: boolean;
  terrainSeed: number;
  systemCoordinate: SystemCoordinate;
  activePlanetWorldId: string;
  planetSystemPosition?: SystemVectorTuple;
  arrivalPose: WorldArrivalPose;
  /** Validated parked-ship rest point used when boarding on the surface. */
  boardingPosition: THREE.Vector3;
  /** Persisted parked heading; used only when the exact pad remains valid. */
  boardingQuaternion?: THREE.Quaternion;
  onGroundedChange?: (grounded: boolean) => void;
  onPositionChange?: (position: THREE.Vector3) => void;
  /** Reports where the ship set down so the parked ship + on-foot exit spawn THERE. */
  onLanded?: (restPosition: THREE.Vector3, quaternion: THREE.Quaternion) => void;
}

/**
 * First-person 6-DOF spaceship flight controller.
 *
 * Owns its OWN makeDefault camera. Its shared local-system depth budget covers
 * the widest companion pair plus the remote-system background band; near=1
 * reclaims depth precision off-surface. No Rapier rigidbody:
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
  paused = false,
  terrainSeed,
  systemCoordinate,
  activePlanetWorldId,
  planetSystemPosition = [0, 0, 0],
  arrivalPose,
  boardingPosition,
  boardingQuaternion,
  onGroundedChange,
  onPositionChange,
  onLanded
}: ShipControllerProps) {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const { gl } = useThree();
  const { world, rapier } = useRapier();
  const { phase } = useSpaceFlight();
  const spawnTerrain = useMemo(
    () => {
      const generator = getWorldGen(planetSize, terrainSeed, activePlanetWorldId).generator;
      return {
        shouldVoxelExist: (x: number, y: number, z: number) =>
          generator.shouldVoxelExist(x, y, z) && !voxelSystem.isDeleted(x, y, z),
        isWaterVoxel: (x: number, y: number, z: number) =>
          voxelSystem.isDeleted(x, y, z) || generator.isWaterVoxel(x, y, z),
        generateBlockForPosition: (x: number, y: number, z: number) =>
          generator.generateBlockForPosition(x, y, z)
      };
    },
    [activePlanetWorldId, planetSize, terrainSeed]
  );

  // Snapshot phase + spawn inputs ONCE (the component remounts per world swap, so
  // a fresh mount re-reads phase; mid-flight prop churn must NOT reset the ship).
  const spawnPhaseRef = useRef(phase);
  const boardingRef = useRef(boardingPosition.clone());
  const boardingQuaternionRef = useRef(boardingQuaternion?.clone() ?? null);
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
  const warpEngageRef = useRef({
    targetKey: null as string | null,
    armed: false
  });
  // Active eased auto-landing (F-initiated), or null while flying freely. Landing
  // is NEVER automatic — only this sequence sets the ship down. It also slerps the
  // orientation to level so the parked ship rests upright on the surface.
  const landingSeq = useRef<{
    from: THREE.Vector3; to: THREE.Vector3;
    fromQuat: THREE.Quaternion; toQuat: THREE.Quaternion;
    t: number; duration: number;
    crashed?: boolean;
  } | null>(null);
  // Active launch ascension (Space-initiated from a parked ship), or null.
  const launchSeq = useRef<{ from: THREE.Vector3; to: THREE.Vector3; t: number; duration: number } | null>(null);
  // Parked peripheral "peek" (yaw/pitch radians) — view-only; ship heading locked.
  const lookOffset = useRef({ yaw: 0, pitch: 0 });
  const lastPublished = useRef(new THREE.Vector3(Infinity, Infinity, Infinity));
  const feedbackForward = useRef(new THREE.Vector3());
  const boostWasActive = useRef(false);
  const systemPoseWriter = useRef<SystemPoseWriterLease | null>(null);
  const localSystemPose = useRef({
    position: [0, 0, 0] as [number, number, number],
    velocity: [0, 0, 0] as [number, number, number],
    quaternion: [0, 0, 0, 1] as [number, number, number, number]
  });
  const [, get] = useKeyboardControls();

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('systemprobe') !== '1') return undefined;
    const bridge = {
      injectLookDelta(yawRadians: number, pitchRadians: number) {
        if (Number.isFinite(yawRadians)) yawInput.current += yawRadians;
        if (Number.isFinite(pitchRadians)) pitchInput.current += pitchRadians;
      },
      setLocalPosition(x: number, y: number, z: number) {
        if (![x, y, z].every(Number.isFinite)) return;
        position.current.set(x, y, z);
        velocity.current.set(0, 0, 0);
      },
      getFeedback: () => ({ ...getShipFlightFeedback() }),
      getFov: () => cameraRef.current?.fov ?? 70,
      getCockpitStats: () => {
        const cockpit = cameraRef.current?.getObjectByName('ship-cockpit');
        let meshes = 0;
        let triangles = 0;
        const materials = new Set<THREE.Material>();
        cockpit?.traverse(object => {
          const mesh = object as THREE.Mesh;
          if (!mesh.isMesh) return;
          meshes++;
          const geometry = mesh.geometry as THREE.BufferGeometry;
          const instanceCount = (mesh as THREE.InstancedMesh).isInstancedMesh
            ? (mesh as THREE.InstancedMesh).count
            : 1;
          triangles += (geometry.index
            ? geometry.index.count / 3
            : (geometry.attributes.position?.count ?? 0) / 3) * instanceCount;
          const meshMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const material of meshMaterials) materials.add(material);
        });
        return {
          meshes,
          triangles,
          materials: materials.size,
          transparentMaterials: [...materials].filter(material => material.transparent).length,
          // Portrait fitting now lives on the pressure-shell child rather than
          // the rigid camera root. Keep system-probe telemetry attached to the
          // visible enclosure it is intended to measure.
          scale: cameraRef.current?.getObjectByName('ship-cockpit-pressure-shell')?.scale.x ?? 1
        };
      }
    };
    window.__paravoxiaShipProbe = bridge;
    return () => {
      if (window.__paravoxiaShipProbe === bridge) delete window.__paravoxiaShipProbe;
    };
  }, []);

  /** Planet surface radius in world units (planetSize = world half-extent). */
  const surfaceRadius = planetSize;
  const movieSystemManifest = useMemo(
    () => buildStarSystemManifest(systemCoordinate, { bodyCountOverride: 2 }),
    [systemCoordinate.x, systemCoordinate.y]
  );

  // Pick spawn position + initial orientation from the mount-time phase. Reads
  // only refs captured at mount, so per-frame prop churn never recomputes it.
  const spawn = useMemo(() => {
    const phaseAtMount = spawnPhaseRef.current;
    const approach = approachRef.current;
    const systemFlightAtMount = getSystemFlightSnapshot();
    const restoringSameSystemFlight =
      systemFlightAtMount.systemId === coordinateKey(systemCoordinate) &&
      systemFlightAtMount.activePlanetId === activePlanetWorldId &&
      systemFlightAtMount.locationMode !== 'surface';

    if (restoringSameSystemFlight) {
      const localPose = systemPoseToPlanetLocalPose(
        systemFlightAtMount.pose,
        planetSystemPosition
      );
      return {
        pos: new THREE.Vector3(...localPose.position),
        velocity: new THREE.Vector3(...localPose.velocity),
        quat: new THREE.Quaternion(...localPose.quaternion),
        restoredFromSystemPose: true,
        relocatedSurfaceSpawn: false
      };
    }

    let pos: THREE.Vector3;
    let relocatedSurfaceSpawn = false;
    if (phaseAtMount === 'descent' || phaseAtMount === 'approach') {
      // Just warped in above a fresh world: start high, looking down.
      pos = approach.clone();
    } else if (phaseAtMount === 'deep_space') {
      // Interstellar arrival (and ?fly=1): start out in open space above the
      // planet, just beyond the atmosphere boundary so the world is prominent and
      // the descent is short. Faces the planet so it's dead ahead.
      pos = approach.clone().normalize().multiplyScalar(surfaceRadius + ATMOS_LEAVE + 25);
    } else {
      // Surface / launch: revalidate at the instant of boarding. The pad may
      // have been mined or flooded since touchdown; a last-frame edit race can
      // relocate the craft to the nearest complete ship+egress pad, never into
      // the stale hole.
      const safeBoarding = resolveSafeShipBoardingPosition(
        spawnTerrain,
        planetSize,
        boardingRef.current,
        Math.floor(planetSize / 2)
      );
      if (!safeBoarding) {
        throw new Error('No dry, level ship boarding pad exists on this surface.');
      }
      pos = safeBoarding;
      relocatedSurfaceSpawn = pos.distanceToSquared(boardingRef.current) > 0.01;
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
    } else if (!relocatedSurfaceSpawn && boardingQuaternionRef.current) {
      // A valid persisted pad owns its last real touchdown heading. Never replace
      // it with the deterministic arrival orientation on a reload/remount.
      quat = boardingQuaternionRef.current.clone().normalize();
    } else {
      // Parked on the surface: sit level, facing the horizon (upright).
      quat = levelOrientation(pos);
    }
    return {
      pos,
      velocity: new THREE.Vector3(),
      quat,
      restoredFromSystemPose: false,
      relocatedSurfaceSpawn
    };
  }, [
    activePlanetWorldId,
    planetSize,
    planetSystemPosition,
    spawnTerrain,
    surfaceRadius,
    systemCoordinate
  ]);

  // Initialise runtime refs from the chosen spawn (once).
  useEffect(() => {
    position.current.copy(spawn.pos);
    velocity.current.copy(spawn.velocity);
    orientation.current.copy(spawn.quat);
    landingSeq.current = null;
  }, [spawn]);

  useEffect(() => {
    if (spawn.relocatedSurfaceSpawn) onLanded?.(spawn.pos, spawn.quat);
  }, [onLanded, spawn]);

  useEffect(() => {
    const systemId = coordinateKey(systemCoordinate);
    const localPose = {
      position: [position.current.x, position.current.y, position.current.z] as const,
      velocity: [velocity.current.x, velocity.current.y, velocity.current.z] as const,
      quaternion: [
        orientation.current.x,
        orientation.current.y,
        orientation.current.z,
        orientation.current.w
      ] as const
    };
    const systemPose = planetLocalPoseToSystemPose(localPose, planetSystemPosition);
    const current = getSystemFlightSnapshot();
    const initialPhase = spawnPhaseRef.current;
    if (current.systemId !== systemId) {
      resetSystemFlightForInterstellarArrival({
        system: systemCoordinate,
        activePlanetId: activePlanetWorldId,
        locationMode: initialPhase === 'surface'
          ? 'surface'
          : initialPhase === 'deep_space'
            ? 'local_space'
            : 'atmosphere',
        pose: systemPose,
        renderOrigin: planetSystemPosition
      });
    } else if (current.activePlanetId !== activePlanetWorldId) {
      setActiveSystemPlanet(activePlanetWorldId);
    }

    const lease = acquireSystemPoseWriter(`ship:${activePlanetWorldId}`);
    systemPoseWriter.current = lease;
    if (lease) updateSystemShipPose(lease, systemPose);
    return () => {
      if (lease) releaseSystemPoseWriter(lease);
      if (systemPoseWriter.current === lease) systemPoseWriter.current = null;
    };
  }, [
    activePlanetWorldId,
    planetSystemPosition,
    systemCoordinate,
    spawn
  ]);

  // Flight poses are hot-path state in systemFlight, while durable ship state is
  // deliberately checkpointed only at phase boundaries and a light interval.
  // This keeps reloads close to the rendered craft without publishing React or
  // localStorage writes every frame.
  useEffect(() => {
    const systemId = coordinateKey(systemCoordinate);
    const capture = () => {
      const livePhase = getSpaceFlightSnapshot().phase;
      const locationMode = livePhase === 'surface'
        ? 'surface'
        : livePhase === 'deep_space'
          ? 'local_space'
          : 'atmosphere';
      persistShipFlightLocation({
        system: systemCoordinate,
        systemId,
        worldId: activePlanetWorldId,
        systemPosition: planetSystemPosition,
        layoutVersion: getSystemFlightSnapshot().layoutVersion,
        locationMode,
        parkedPose: locationMode === 'surface'
          ? {
              position: [position.current.x, position.current.y, position.current.z],
              quaternion: [
                orientation.current.x,
                orientation.current.y,
                orientation.current.z,
                orientation.current.w
              ]
            }
          : undefined
      });
    };
    capture();
    const interval = window.setInterval(capture, 10_000);
    return () => {
      window.clearInterval(interval);
      capture();
    };
  }, [activePlanetWorldId, phase, planetSystemPosition, systemCoordinate]);

  useEffect(() => () => {
    setShipThrustSfx(0);
    resetShipFlightFeedback();
  }, []);

  const requestLanding = useCallback(() => {
    const live = getSpaceFlightSnapshot();
    if (live.controlMode !== 'flight' || live.phase !== 'descent') return;
    if (landingSeq.current || launchSeq.current || !world) return;
    const downDir = position.current.clone().normalize().negate();
    const ray = new rapier.Ray(vectorToRapier(position.current), vectorToRapier(downDir));
    const hit = world.castRayAndGetNormal(ray, LANDING_APPROACH_DIST, true);
    if (!hit) return;
    const contactUp = vectorFromRapier(hit.normal).normalize();
    const contactPoint = position.current.clone().addScaledVector(downDir, hit.timeOfImpact);
    const contactRest = contactPoint.clone().addScaledVector(contactUp, SHIP_GROUND_CLEARANCE);
    const site = findValidSpawnSite(spawnTerrain, planetSize, contactRest, {
      kind: 'ship',
      face: dominantFaceForPosition(contactUp),
      maxSearchRadius: 0,
      requirePlayerEgress: true
    });
    if (!site || !landingHitMatchesValidatedTerrain(contactPoint, contactUp, site)) return;
    const to = site.position;
    const dist = position.current.distanceTo(to);
    landingSeq.current = {
      from: position.current.clone(),
      to,
      fromQuat: orientation.current.clone(),
      toQuat: levelOrientation(to, site.up),
      t: 0,
      duration: THREE.MathUtils.clamp(
        dist / LANDING_DESCENT_SPEED,
        LANDING_MIN_DURATION,
        LANDING_MAX_DURATION
      ),
      crashed: false
    };
  }, [planetSize, rapier, spawnTerrain, world]);

  const requestLaunch = useCallback(() => {
    if (isPhysicalBoardingVehicleControlLocked()) return;
    const live = getSpaceFlightSnapshot();
    const parked = live.controlMode === 'flight' && live.phase === 'surface';
    if (!parked || landingSeq.current || launchSeq.current) return;
    const up = shipSurfaceUp(position.current);
    playSfx('shipLaunch');
    launchSeq.current = {
      from: position.current.clone(),
      to: position.current.clone().addScaledVector(up, LAUNCH_RISE),
      t: 0,
      duration: LAUNCH_DURATION
    };
    activateLaunchIgnitionFromCreatedSequence(getStoryStateSnapshot().beat);
  }, []);

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
      if (paused) return;
      if (!isLocked.current && !isTouchActive()) return;
      yawInput.current += -event.movementX * MOUSE_SENSITIVITY;
      pitchInput.current += -event.movementY * MOUSE_SENSITIVITY;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (paused) return;
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
        requestLanding();
      }

      // Space LAUNCHES a parked ship: a short eased ascension off the ground into
      // atmospheric flight. You can't fly until you launch (and again after landing).
      if (event.code === 'Space') {
        requestLaunch();
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
  }, [gl.domElement, paused, requestLanding, requestLaunch]);

  // --- per-frame flight integration -----------------------------------------
  useFrame((_, rawDt) => {
    const cam = cameraRef.current;
    if (!cam || paused) return;
    const dt = Math.min(rawDt, 1 / 30); // clamp big frame gaps
    const movieFlight = getAutopilotFlightDirective();
    if (movieFlight.active && movieFlight.controls.jump) requestLaunch();
    if (movieFlight.active && movieFlight.controls.interact) requestLanding();

    const syncFlightFeedback = (
      throttle: number,
      boost: boolean,
      acceleration: number,
      approachLimited = false
    ) => {
      const live = getSpaceFlightSnapshot();
      const speed = velocity.current.length();
      feedbackForward.current.set(0, 0, -1).applyQuaternion(orientation.current);
      const state = updateShipFlightFeedback({
        active: live.controlMode === 'flight',
        phase: live.phase,
        throttle,
        boost,
        speed,
        maxSpeed: MAX_SPEED,
        acceleration,
        forwardSpeed: velocity.current.dot(feedbackForward.current),
        approachLimited
      }, dt);

      const engineLevel = boost ? 1 : Math.abs(throttle);
      setShipThrustSfx(engineLevel);
      if (boost && !boostWasActive.current) playSfx('shipBoost');
      boostWasActive.current = boost;

      if (Math.abs(cam.fov - state.fov) > 0.001) {
        cam.fov = state.fov;
        cam.updateProjectionMatrix();
      }
    };

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
      syncFlightFeedback(land.crashed ? 0 : 0.18, false, land.crashed ? -1 : -0.18);
      if (land.t >= 1) {
        landingSeq.current = null;
        setShipThrustSfx(0);
        if (!land.crashed) playSfx('shipLand');
        lookOffset.current.yaw = 0;
        lookOffset.current.pitch = 0;
        onLanded?.(land.to.clone(), land.toQuat.clone());
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
      if (hasLaunchPhysicallyDeparted(launch.from, position.current, launch.to)) {
        activateVehicleSceneAvEvent(VEHICLE_SCENE_AV_EVENTS.launchLiftoff);
      }
      velocity.current.set(0, 0, 0);
      yawInput.current = 0;
      pitchInput.current = 0;
      cam.position.copy(position.current);
      cam.quaternion.copy(orientation.current);
      displayQuat.current.copy(orientation.current);
      syncFlightFeedback(0.55, false, 0.55);
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
      syncFlightFeedback(0, false, 0);
      return;
    }

    const controls = movieFlight.active ? movieFlight.controls : get();

    const quat = orientation.current;
    const inAtmosphere = position.current.length() < surfaceRadius + ATMOS_LEAVE;

    // 1) Apply accumulated look deltas as local rotations.
    const localRight = new THREE.Vector3(1, 0, 0).applyQuaternion(quat);
    const localUp = new THREE.Vector3(0, 1, 0).applyQuaternion(quat);
    const localForward = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);

    if (movieFlight.active) {
      const desiredDirection = new THREE.Vector3();
      if (movieFlight.beat === 'ch8-launch') {
        desiredDirection.copy(position.current).normalize();
      } else if (movieFlight.beat === 'ch8-landfall') {
        desiredDirection.copy(position.current).normalize().negate();
      } else if (movieFlight.targetWorldId) {
        const descriptor = movieSystemManifest.planets.find(
          planet => planet.worldId === movieFlight.targetWorldId
        );
        if (descriptor) {
          const systemPose = getSystemFlightSnapshot().pose.position;
          desiredDirection.set(
            descriptor.systemPosition[0] - systemPose[0],
            descriptor.systemPosition[1] - systemPose[1],
            descriptor.systemPosition[2] - systemPose[2]
          ).normalize();
        }
      } else if (movieFlight.targetSystemPosition) {
        // A destination that is not a world. `targetWorldId` can only name
        // bodies in the planet manifest, and chapter 10 flies at a station —
        // the one destination in the game with no world id, which is why that
        // leg thrusted with no bearing at all. Same slerp, same clamps, same
        // everything else; this branch only supplies the point. Null on every
        // shipped beat, so no manual or ch1-ch9 movie frame can reach it.
        const systemPose = getSystemFlightSnapshot().pose.position;
        desiredDirection.set(
          movieFlight.targetSystemPosition[0] - systemPose[0],
          movieFlight.targetSystemPosition[1] - systemPose[1],
          movieFlight.targetSystemPosition[2] - systemPose[2]
        ).normalize();
      }
      if (desiredDirection.lengthSq() > 0.5) {
        const referenceUp = Math.abs(desiredDirection.y) < 0.88
          ? new THREE.Vector3(0, 1, 0)
          : new THREE.Vector3(0, 0, 1);
        const desired = new THREE.Quaternion().setFromRotationMatrix(
          new THREE.Matrix4().lookAt(new THREE.Vector3(), desiredDirection, referenceUp)
        );
        quat.slerp(desired, 1 - Math.exp(-2.4 * dt));
      }
    }

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
    const boostActive = resolveShipBoost(
      controls.sprint,
      controls.jump,
      isTouchActive(),
      controls.forward
    );
    const boost = boostActive ? BOOST_MULTIPLIER : 1;
    // D-A6: THE HOLD MUST HOLD, in manual flight as much as in the movie lane.
    // The director already freezes movement at the resolve anchor and releases
    // it exactly at the hand-back, but in flight nothing consumed that freeze —
    // so a manual pilot could fly straight through the 2.5s hold the closing
    // shot is built on. THRUST ONLY: attitude and look stay live, because the
    // hold is about not travelling, not about taking the camera away.
    //
    // Scoped to ch10-transit rather than to the move scale alone. Several
    // shipped ch1-ch9 sequences freeze movement, and rather than rely on the
    // claim that none of them can coincide with a flight frame, this cannot
    // reach them by construction.
    const storyNow = getStoryStateSnapshot();
    const thrustHeld = storyNow.active
      && storyNow.beat === 'ch10-transit'
      && getStoryInputPolicy().moveSpeedScale === 0;
    let accel = 0;
    if (!thrustHeld) {
      if (controls.forward) accel += THRUST_ACCEL * boost;
      if (controls.backward) accel -= THRUST_ACCEL;
    }
    if (accel !== 0) {
      velocity.current.addScaledVector(localForward, accel * dt);
    }

    // 4) Damping + speed clamp.
    const damp = Math.pow(DAMPING, dt);
    velocity.current.multiplyScalar(damp);
    if (velocity.current.length() > MAX_SPEED) {
      velocity.current.setLength(MAX_SPEED);
    }

    const assistTarget = getSystemTravelAssistTarget();
    let approachLimited = false;
    if (assistTarget && getSpaceFlightSnapshot().phase === 'deep_space') {
      const systemX = position.current.x + planetSystemPosition[0];
      const systemY = position.current.y + planetSystemPosition[1];
      const systemZ = position.current.z + planetSystemPosition[2];
      const dx = assistTarget.systemPosition[0] - systemX;
      const dy = assistTarget.systemPosition[1] - systemY;
      const dz = assistTarget.systemPosition[2] - systemZ;
      const centerDistance = Math.hypot(dx, dy, dz);
      if (centerDistance > 1e-6) {
        const invDistance = 1 / centerDistance;
        const dirX = dx * invDistance;
        const dirY = dy * invDistance;
        const dirZ = dz * invDistance;
        const inwardSpeed = velocity.current.x * dirX
          + velocity.current.y * dirY
          + velocity.current.z * dirZ;
        const limit = systemApproachSpeedLimit(centerDistance, assistTarget.ready);
        if (inwardSpeed > limit) {
          approachLimited = true;
          const excess = inwardSpeed - limit;
          velocity.current.x -= dirX * excess;
          velocity.current.y -= dirY * excess;
          velocity.current.z -= dirZ * excess;
        }
      }
    }

    // 5) Integrate position.
    position.current.addScaledVector(velocity.current, dt);

    // 5b) Terrain collision (descent only) — the ship can't pass through the
    // planet. Cast toward local-down; gentle contact soft-stops at the surface,
    // a fast inward impact CRASHES (impact flash + forced crash-landing -> you
    // must re-launch). Colliders stream around the ship because it publishes its
    // position (step 8), so the cast hits real voxels once near the ground.
    if (
      world
      && getSpaceFlightSnapshot().phase === 'descent'
      && !landingSeq.current
      && !launchSeq.current
      // A radial ground probe cannot find a new impact while the craft is
      // gaining radius. Skip Rapier broad-phase work through the launch climb.
      && velocity.current.dot(position.current) <= 0
    ) {
      const radial = position.current.clone().normalize();
      const downDir = radial.clone().negate();
      const speed = velocity.current.length();
      const probe = Math.max(CRASH_CLEARANCE + 1, speed * dt + CRASH_CLEARANCE);
      const ray = new rapier.Ray(vectorToRapier(position.current), vectorToRapier(downDir));
      const hit = world.castRayAndGetNormal(ray, probe, true);
      if (hit && hit.timeOfImpact <= speed * dt + CRASH_CLEARANCE) {
        const contactUp = vectorFromRapier(hit.normal).normalize();
        const inwardSpeed = -velocity.current.dot(contactUp); // speed into the contacted face
        const contactPoint = position.current.clone()
          .addScaledVector(downDir, hit.timeOfImpact);
        const contactRest = contactPoint.clone()
          .addScaledVector(contactUp, SHIP_GROUND_CLEARANCE);
        if (shipImpactOutcome(inwardSpeed, CRASH_SPEED) === 'crash') {
          const safeSite = findValidSpawnSite(spawnTerrain, planetSize, contactRest, {
            kind: 'ship',
            face: dominantFaceForPosition(contactUp),
            maxSearchRadius: 0,
            requirePlayerEgress: true
          });
          const hitValidatedTerrain = safeSite
            && landingHitMatchesValidatedTerrain(contactPoint, contactUp, safeSite);
          // A prop, water, steep, or blocked impact can damage and deflect the
          // ship, but it must not become a parked spawn on terrain beneath it.
          if (!safeSite || !hitValidatedTerrain) {
            position.current.copy(contactRest).addScaledVector(contactUp, CRASH_CLEARANCE);
            velocity.current.addScaledVector(contactUp, Math.max(0, inwardSpeed) + 8);
            setShipThrustSfx(0);
            playSfx('shipCrash');
            triggerCrashFlash();
          } else {
            // CRASH: forced crash-landing to the touchdown point + impact flash.
            landingSeq.current = {
              from: position.current.clone(),
              to: safeSite.position,
              fromQuat: orientation.current.clone(),
              toQuat: levelOrientation(safeSite.position, safeSite.up),
              t: 0,
              duration: CRASH_LAND_DURATION,
              crashed: true
            };
            velocity.current.set(0, 0, 0);
            setShipThrustSfx(0);
            playSfx('shipCrash');
            triggerCrashFlash();
          }
        } else {
          // Soft contact: clamp to the surface and remove the inward velocity
          // component so you skim along instead of sinking through.
          position.current.copy(contactRest);
          if (inwardSpeed > 0) velocity.current.addScaledVector(contactUp, inwardSpeed);
        }
      }
    }

    // 6) Drive the camera — slerp the displayed orientation toward the
    // authoritative `quat` so look is smooth, not twitchy (frame-rate independent).
    cam.position.copy(position.current);
    displayQuat.current.slerp(quat, 1 - Math.exp(-CAM_SMOOTH * dt));
    cam.quaternion.copy(displayQuat.current);
    // The engine reads what the ship is actually doing: held means no throttle,
    // so the hold is heard as well as seen.
    const throttle = thrustHeld
      ? 0
      : controls.forward ? (boostActive ? 1 : 0.58) : controls.backward ? -0.34 : 0;
    syncFlightFeedback(
      throttle,
      boostActive,
      accel / (THRUST_ACCEL * BOOST_MULTIPLIER),
      approachLimited
    );

    // 7) Phase-driven launch + landing transitions (read the live snapshot).
    const liveSnap = getSpaceFlightSnapshot();
    const snap = liveSnap.phase;
    const altitude = position.current.length() - surfaceRadius;

    // 7a) Engage-to-warp: forward thrust must begin after the current target
    // lock appears. Holding W or the touch stick before highlight still flies
    // normally, but it will not charge warp until released and pressed again.
    const forwardDown = controls.forward;
    const targetKey = snap === 'deep_space' && liveSnap.target
      ? `${liveSnap.target.x},${liveSnap.target.y}`
      : null;
    const engage = warpEngageRef.current;
    if (!targetKey || !liveSnap.target) {
      engage.targetKey = null;
      engage.armed = false;
      engageState.charge = 0;
      engageState.waitingForFreshForward = false;
    } else {
      if (engage.targetKey !== targetKey) {
        engage.targetKey = targetKey;
        engage.armed = !forwardDown;
        engageState.charge = 0;
      }
      if (!forwardDown) {
        engage.armed = true;
        engageState.charge = 0;
      }
      engageState.waitingForFreshForward = forwardDown && !engage.armed;
      if (forwardDown && engage.armed) {
        engageState.charge += dt / ENGAGE_CHARGE_TIME;
        if (engageState.charge >= 1) {
          engageState.charge = 0;
          engage.armed = false;
          engageState.waitingForFreshForward = false;
          if (!requestMultiplayerPartyWarp(liveSnap.target)) beginTravel(liveSnap.target);
        }
      } else if (engageState.charge !== 0) {
        engageState.charge = 0;
      }
    }

    // 7b) Atmosphere boundary — altitude-driven and BIDIRECTIONAL with hysteresis,
    // so you can always fly down to enter and up to leave (no dead-end). The only
    // warp is the interstellar beginTravel above; crossing the atmosphere is
    // seamless continuous flight.
    const ownsActivePlanet = getSystemFlightSnapshot().activePlanetId === activePlanetWorldId;
    if (ownsActivePlanet && snap === 'deep_space' && altitude < ATMOS_ENTER) {
      beginAtmosphereWarp('enter');  // fly DOWN through the atmospheric exposure veil
    } else if (ownsActivePlanet && snap === 'descent' && altitude > ATMOS_LEAVE) {
      beginAtmosphereWarp('leave');  // climb OUT through the atmospheric exposure veil
    }
    // surface -> descent happens ONLY via the launch ascension (Space); landing
    // happens ONLY via F. Neither is automatic.

    // 8) Publish position so grass/trees/water cull around the ship.
    if (lastPublished.current.distanceToSquared(position.current) > 1) {
      lastPublished.current.copy(position.current);
      // The scene mailbox copies synchronously; avoid allocating a disposable
      // Vector3 for every high-speed atmospheric sample.
      onPositionChange?.(position.current);
    }
  });

  // Canonical system pose publication is deliberately separate from React state.
  // It runs after local flight integration, including early-return landing/launch
  // branches, so every rendered ship frame has a matching system-space pose.
  useFrame(() => {
    const lease = systemPoseWriter.current;
    if (!lease) return;
    const localPose = localSystemPose.current;
    localPose.position[0] = position.current.x;
    localPose.position[1] = position.current.y;
    localPose.position[2] = position.current.z;
    localPose.velocity[0] = velocity.current.x;
    localPose.velocity[1] = velocity.current.y;
    localPose.velocity[2] = velocity.current.z;
    localPose.quaternion[0] = orientation.current.x;
    localPose.quaternion[1] = orientation.current.y;
    localPose.quaternion[2] = orientation.current.z;
    localPose.quaternion[3] = orientation.current.w;
    updateSystemShipPoseFromPlanetLocal(lease, localPose, planetSystemPosition);
    const livePhase = getSpaceFlightSnapshot().phase;
    setSystemLocationMode(
      livePhase === 'surface'
        ? 'surface'
        : livePhase === 'deep_space'
          ? 'local_space'
          : 'atmosphere'
    );
  });

  return (
    // The cockpit is a CHILD of the flight camera: rigidly attached in the scene
    // graph, so it can never lag the camera write (a separate world-space sync
    // ran a frame behind at flight speed and flickered).
    <PerspectiveCamera
      ref={cameraRef}
      makeDefault
      fov={70}
      near={1}
      far={LOCAL_SYSTEM_FLIGHT_CAMERA_FAR}
    >
      <ShipCockpit terrainSeed={terrainSeed} />
    </PerspectiveCamera>
  );
}
