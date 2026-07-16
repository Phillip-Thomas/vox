import {
  Profiler,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ProfilerOnRenderCallback,
  type ReactNode
} from 'react';
import { Physics } from '@react-three/rapier';
import * as THREE from 'three';
import EfficientPlanet, { PlanetStats } from './EfficientPlanet';
import EfficientPlayer, { PlayerDebugState } from './EfficientPlayer';
import GrassField from './GrassField';
import FloraField from './FloraField';
import FaunaField from './FaunaField';
import TreeField from './TreeField';
import SurfaceEffectField from './SurfaceEffectField';
import LooseStoneField from './LooseStoneField';
import ForageField from './ForageField';
import { PlayerTorch, Campfires, type CampfireHydrationPrerequisite } from './Lights';
import StructureField, { BuildGhost } from './StructureField';
import WaterBlocks from './WaterBlocks.tsx';
import UnderwaterDome from './UnderwaterDome.tsx';
import UnderwaterParticles from './UnderwaterParticles.tsx';
import OverviewCamera from './OverviewCamera.tsx';
import MenuCamera from './MenuCamera.tsx';
import AgentCamera from './debug/AgentCamera.tsx';
import SpaceshipPlaceholder from './SpaceshipPlaceholder.tsx';
import ShipController from './ShipController.tsx';
import PlayerAvatarPoseHarness from './PlayerAvatarPoseHarness.tsx';
import {
  subscribeShipExit,
  useSpaceFlight,
  type ShipExitReceipt
} from '../state/spaceFlight.ts';
import {
  FACE_NORMALS,
  dominantFaceForPosition,
  getSurfaceState,
  SurfaceState
} from '../utils/surfaceControls';
import { FIXED_PHYSICS_STEP } from '../utils/cubeGravityConstants';
import {
  ArrivalMode,
  createWorldArrivalPose,
  createWorldArrivalPoseFromSurfaceVoxel
} from '../utils/worldArrival';
import { measureWarpMetric } from '../utils/warpMetrics';
import {
  loadPlayerPose,
  loadVoxelEditsForWorld
} from '../game/systems/persistence.ts';
import { setPlayerLook, setPlayerWorldPosition } from '../state/playerFrame.ts';
import type { CommandContext } from '../game/commands.ts';
import { resolvePlanetProfile } from '../game/PlanetProfile.ts';
import {
  getPodImpactPose,
  getPondPose,
  getStorySidePlane,
  isStoryWorldSeed
} from '../story/world/storyWorld.ts';
import StoryWorldProps from '../story/world/StoryWorldProps.tsx';
import TidegardenSettlementWorld from '../story/world/TidegardenSettlementWorld.tsx';
import { TIDEGARDEN_WORLD_ID } from '../story/tidegardenRoute.ts';
import {
  debugBeatNeedsCampfire,
  getStoryStateSnapshot,
  isStoryDeepLink,
  storyAnchoredSpawn,
  useStoryState
} from '../story/storyState.ts';
import {
  getSystemFlightSnapshot,
  planetLocalPoseToSystemPose,
  resetSystemFlightForInterstellarArrival,
  setActiveSystemPlanet,
  setSystemLocationMode,
  systemPoseToPlanetLocalPose,
  type SystemVectorTuple
} from '../state/systemFlight.ts';
import { coordinateKey } from '../utils/worldCoordinates.ts';
import { getSystemTravelAssistTarget } from '../state/systemTravelAssist.ts';
import { getWorldGen } from '../utils/worldGenCache.ts';
import {
  findValidSpawnSite,
  isDryClearResumePosition,
  resolveSafeShipBoardingPosition,
  resolveShipPlayerEgressPosition
} from '../utils/spawnValidation.ts';
import {
  persistedParkedShipPose,
  persistShipFlightLocation
} from '../state/shipFlightContinuity.ts';
import { shipParkedOrientation } from '../utils/shipDesign.ts';
import {
  INITIAL_LANDFALL_AV_STATE,
  activateVehicleSceneAvEvent,
  advanceLandfallAvState,
  type LandfallAvEvidence
} from '../story/vehicleSceneAvAnchors.ts';
import {
  createScenePlayerPositionMailbox,
  type ScenePlayerPositionMailbox
} from '../utils/scenePlayerPosition.ts';
import type {
  GraphicsQuality,
  QualityProfile
} from '../config/graphicsSettings.ts';
import { setVitals } from '../game/systems/survivalVitals.ts';
import { invalidateAuthoredDiveMotionContinuity } from '../story/emergentDive.ts';
import {
  applyAuthoredDiveReloadRecovery,
  resolveAuthoredDiveReloadRecovery
} from '../story/diveReloadRecovery.ts';

export const planetSize = 50;
const PRIMARY_SYSTEM_POSITION = [0, 0, 0] as const;

export const TERRAIN_SEEDS = {
  DEFAULT: 12345,
  MOUNTAINS: 54321,
  HILLS: 98765,
  VALLEYS: 13579,
  ISLANDS: 24680,
  RANDOM: () => Math.floor(Math.random() * 999999)
};

export interface SceneDebugState {
  player: PlayerDebugState | null;
  planet: PlanetStats | null;
}

interface EfficientSceneProps {
  commandContext: CommandContext;
  graphicsProfile: QualityProfile;
  graphicsQuality: GraphicsQuality;
  activePlanetSystemPosition?: SystemVectorTuple;
  terrainSeed?: number;
  debugColliders?: boolean;
  arrivalMode?: ArrivalMode;
  /** DEBUG (?overview=1): mount a non-interactive overhead camera instead of the
   *  pointer-lock player so the ocean can be inspected/screenshotted. */
  overview?: boolean;
  /** DEBUG (?agent=1): mount the scriptable verification-harness camera + the
   *  window.__game bridge instead of any player/ship camera. */
  agent?: boolean;
  /** Landing screen: mount the cinematic orbit camera (no player/ship) so the
   *  world renders + warms up behind the menu. */
  cinematic?: boolean;
  profileSystemTravel?: boolean;
  paused?: boolean;
  onGroundedChange?: (grounded: boolean) => void;
  onDebugChange?: (debug: SceneDebugState) => void;
}

export default function EfficientScene({
  commandContext,
  graphicsProfile,
  graphicsQuality,
  activePlanetSystemPosition = PRIMARY_SYSTEM_POSITION,
  terrainSeed = TERRAIN_SEEDS.DEFAULT,
  debugColliders = false,
  arrivalMode = 'surface',
  overview = false,
  agent = false,
  cinematic = false,
  profileSystemTravel = false,
  paused = false,
  onGroundedChange,
  onDebugChange
}: EfficientSceneProps) {
  const { controlMode, phase } = useSpaceFlight();
  const story = useStoryState();
  const debugCampfirePrerequisite = useMemo<CampfireHydrationPrerequisite | null>(() => {
    if (!isStoryWorldSeed(terrainSeed)
      || !isStoryDeepLink()
      || !debugBeatNeedsCampfire(story.beat)) return null;
    const plane = getStorySidePlane(planetSize, terrainSeed);
    const pos = plane.origin.clone().addScaledVector(plane.up, 0.2);
    return {
      pos: [pos.x, pos.y, pos.z],
      up: [plane.up.x, plane.up.y, plane.up.z]
    };
  }, [story.beat, terrainSeed]);
  const planetProfile = useMemo(
    () => resolvePlanetProfile({
      worldId: commandContext.world.worldId,
      seed: terrainSeed
    }).profile,
    [commandContext.world.worldId, terrainSeed]
  );
  // Chapters before the A2 depth awakening allow no smooth props at all.
  const storyPreAwakened = story.active
    && (story.chapter === 'prologue' || story.chapter === 'ch1' || story.chapter === 'ch2');
  // In a story world the player's ship is the CRASH WRECK (voxel DescentPod →
  // hi-fi HifiWreck at the impact site, mounted by StoryWorldProps). The sandbox
  // parked ship must never appear alongside it — suppress it for the whole story
  // (active chapters AND the completed 'done' world). Non-story seeds: unchanged.
  const storyWorldShip = isStoryWorldSeed(terrainSeed) && (story.active || story.chapter === 'complete');
  const spawnTerrain = useMemo(() => {
    const entry = getWorldGen(planetSize, terrainSeed, commandContext.world.worldId);
    const persisted = loadVoxelEditsForWorld(commandContext.world);
    const deleted = persisted?.fingerprint === entry.voxels.length
      ? new Set(persisted.removed.map(([x, y, z]) => `${x},${y},${z}`))
      : new Set<string>();
    return {
      shouldVoxelExist: (x: number, y: number, z: number) =>
        entry.generator.shouldVoxelExist(x, y, z) && !deleted.has(`${x},${y},${z}`),
      // A persisted hole is hazardous even before WaterBlocks replays dynamic
      // flooding; treating it as wet prevents arrival from choosing its floor.
      isWaterVoxel: (x: number, y: number, z: number) =>
        deleted.has(`${x},${y},${z}`) || entry.generator.isWaterVoxel(x, y, z),
      generateBlockForPosition: (x: number, y: number, z: number) =>
        entry.generator.generateBlockForPosition(x, y, z)
    };
  }, [commandContext.world, terrainSeed]);
  const arrivalPose = useMemo(
    () => measureWarpMetric(
      'scene:arrival_pose',
      () => {
        const canonical = createWorldArrivalPose(
          planetSize,
          terrainSeed,
          commandContext.world.worldId
        );
        const exact = findValidSpawnSite(
          spawnTerrain,
          planetSize,
          canonical.shipPosition,
          {
            kind: 'ship',
            face: 'top',
            maxSearchRadius: 0,
            requirePlayerEgress: !storyWorldShip
          }
        );
        const resolved = exact ?? findValidSpawnSite(
          spawnTerrain,
          planetSize,
          canonical.shipPosition,
          {
            kind: 'ship',
            face: 'top',
            maxSearchRadius: Math.floor(planetSize),
            requirePlayerEgress: !storyWorldShip
          }
        );
        if (!resolved) {
          throw new Error(`No live dry arrival pad exists for terrain seed ${terrainSeed}.`);
        }
        const pose = createWorldArrivalPoseFromSurfaceVoxel(resolved.supportVoxel);
        if (!storyWorldShip) {
          const playerEgress = resolveShipPlayerEgressPosition(
            spawnTerrain,
            planetSize,
            pose.shipPosition,
            resolved.face
          );
          if (!playerEgress) {
            throw new Error(`Arrival pad for terrain seed ${terrainSeed} has no safe ship exit.`);
          }
          pose.playerSurfacePosition.copy(playerEgress);
          pose.approachPosition.copy(playerEgress).addScaledVector(resolved.up, 30);
        }
        return pose;
      },
      pose => ({
        surfaceX: pose.surfaceVoxel.x,
        surfaceY: pose.surfaceVoxel.y,
        surfaceZ: pose.surfaceVoxel.z
      })
    ),
    [commandContext.world.worldId, spawnTerrain, storyWorldShip, terrainSeed]
  );
  const storyWreckBoardingPosition = useMemo(() => {
    if (!storyWorldShip) return null;
    const impact = getPodImpactPose(planetSize, terrainSeed);
    return impact.position.clone().addScaledVector(impact.up, 0.6);
  }, [storyWorldShip, terrainSeed]);
  useEffect(() => {
    const face = dominantFaceForPosition(arrivalPose.shipPosition);
    const up = FACE_NORMALS[face];
    const expectedSettled = arrivalPose.playerSurfacePosition.clone().addScaledVector(up, -1);
    const exactShip = findValidSpawnSite(
      spawnTerrain,
      planetSize,
      arrivalPose.shipPosition,
      {
        kind: 'ship',
        face,
        maxSearchRadius: 0,
        requirePlayerEgress: !storyWorldShip
      }
    );
    const host = window as Window & { __voxelDebug?: Record<string, unknown> };
    host.__voxelDebug = {
      ...host.__voxelDebug,
      spawn: {
        terrainSeed,
        face,
        supportVoxel: arrivalPose.surfaceVoxel,
        playerRequested: arrivalPose.playerSurfacePosition.toArray(),
        playerExpectedSettled: expectedSettled.toArray(),
        shipRequested: arrivalPose.shipPosition.toArray(),
        safe: exactShip !== null
          && isDryClearResumePosition(spawnTerrain, planetSize, expectedSettled)
      }
    };
  }, [arrivalPose, spawnTerrain, storyWorldShip, terrainSeed]);
  const systemFlightAtMount = useRef(getSystemFlightSnapshot()).current;
  const restoringSameSystemRuntime = systemFlightAtMount.systemId === coordinateKey(commandContext.world.coordinate)
    && systemFlightAtMount.activePlanetId === commandContext.world.worldId
    && systemFlightAtMount.locationMode !== 'surface';
  const [initialPlayerPosition] = useState(() => {
    const canRestoreSystemPosition = controlMode === 'flight' && restoringSameSystemRuntime;
    if (canRestoreSystemPosition) {
      const localPose = systemPoseToPlanetLocalPose(
        systemFlightAtMount.pose,
        activePlanetSystemPosition
      );
      const restored = new THREE.Vector3(...localPose.position);
      setPlayerWorldPosition(restored);
      return restored;
    }
    if (arrivalMode === 'approach') return arrivalPose.approachPosition.clone();
    // The monochrome ladder ANCHORS to the arrival site (strip/wreck/pods/mesa
    // are all placed off it): while those chapters run, a saved pose — off the
    // work row, in the pond, mid-map — must never override the spawn.
    const storyAtMount = getStoryStateSnapshot();
    const saved = storyAnchoredSpawn(storyAtMount)
      ? null
      : loadPlayerPose(commandContext.world);
    if (saved) {
      if (storyAtMount.active && storyAtMount.beat === 'ch6-dive') {
        const pond = getPondPose(
          planetSize,
          terrainSeed,
          commandContext.world.worldId
        );
        const recovery = resolveAuthoredDiveReloadRecovery({
          terrain: spawnTerrain,
          planetSize,
          pond,
          fallbackPosition: arrivalPose.playerSurfacePosition,
          fallbackLookDirection: new THREE.Vector3(...saved.forward)
        });
        if (!recovery) {
          throw new Error('No dry Chapter 6 reload site exists at the pond or canonical arrival.');
        }
        return applyAuthoredDiveReloadRecovery(recovery, {
          invalidateMotionContinuity: () => {
            invalidateAuthoredDiveMotionContinuity(commandContext.actorId);
          },
          setLook: (direction, pitch) => setPlayerLook(direction, pitch),
          restoreOxygen: oxygen => setVitals({ oxygen }, commandContext.actorId),
          setWorldPosition: position => setPlayerWorldPosition(position)
        });
      }
      setPlayerLook(new THREE.Vector3(...saved.forward), saved.pitch);
      const savedPosition = new THREE.Vector3(...saved.pos);
      const resumeIsSafe = isDryClearResumePosition(spawnTerrain, planetSize, savedPosition);
      const validated = resumeIsSafe
        ? null
        : findValidSpawnSite(
          spawnTerrain,
          planetSize,
          savedPosition,
          { kind: 'player', maxSearchRadius: 12 }
        );
      const pos = resumeIsSafe
        ? savedPosition
        : validated?.position ?? arrivalPose.playerSurfacePosition.clone();
      setPlayerWorldPosition(pos); // correct immediately, before the first frame publishes
      return pos;
    }
    setPlayerWorldPosition(arrivalPose.playerSurfacePosition); // ditto for the arrival
    return arrivalPose.playerSurfacePosition.clone();
  });
  const playerPositionMailboxRef = useRef<ScenePlayerPositionMailbox | null>(null);
  playerPositionMailboxRef.current ??= createScenePlayerPositionMailbox(initialPlayerPosition);
  const playerPositionMailbox = playerPositionMailboxRef.current;
  const playerPosition = playerPositionMailbox.position;
  // Every field consumer polls this vector from useFrame and owns its own
  // distance bucket. Sharing the live mailbox avoids an otherwise redundant
  // second React publication stream.
  const fieldPlayerPosition = playerPosition;
  const [systemFieldStage, setSystemFieldStage] = useState(
    restoringSameSystemRuntime ? 0 : 6
  );
  const [departureFieldStage, setDepartureFieldStage] = useState(6);
  const departureFieldStageRef = useRef(6);
  useEffect(() => {
    let frame = 0;
    const updateDepartureStage = () => {
      const target = getSystemTravelAssistTarget();
      let desiredStage = 6;
      if (target) {
        const flight = getSystemFlightSnapshot();
        const distance = Math.hypot(
          target.systemPosition[0] - flight.pose.position[0],
          target.systemPosition[1] - flight.pose.position[1],
          target.systemPosition[2] - flight.pose.position[2]
        );
        desiredStage = distance < 220
          ? 0
          : distance < 300
            ? 1
            : distance < 450
              ? 2
              : distance < 600
                ? 3
                : distance < 800
                  ? 4
                  : distance < 1000
                    ? 5
                    : 6;
      }
      const current = departureFieldStageRef.current;
      const next = current < desiredStage
        ? current + 1
        : current > desiredStage
          ? current - 1
          : current;
      if (next !== current) {
        departureFieldStageRef.current = next;
        setDepartureFieldStage(next);
      }
      frame = window.requestAnimationFrame(updateDepartureStage);
    };
    frame = window.requestAnimationFrame(updateDepartureStage);
    return () => window.cancelAnimationFrame(frame);
  }, []);
  const visibleSystemFieldStage = Math.min(systemFieldStage, departureFieldStage);
  useEffect(() => {
    if (systemFieldStage >= 6) return undefined;
    let frame = 0;
    const advance = () => {
      if (systemFieldStage < 2) {
        setSystemFieldStage(stage => Math.min(6, stage + 1));
        return;
      }
      const flight = getSystemFlightSnapshot();
      const dx = flight.pose.position[0] - activePlanetSystemPosition[0];
      const dy = flight.pose.position[1] - activePlanetSystemPosition[1];
      const dz = flight.pose.position[2] - activePlanetSystemPosition[2];
      const nearSurface = Math.hypot(dx, dy, dz) <= planetSize + 70;
      const approachSpeed = Math.hypot(...flight.pose.velocity);
      if (nearSurface && approachSpeed <= 90) {
        setSystemFieldStage(stage => Math.min(6, stage + 1));
        return;
      }
      frame = window.requestAnimationFrame(advance);
    };
    frame = window.requestAnimationFrame(advance);
    return () => window.cancelAnimationFrame(frame);
  }, [activePlanetSystemPosition, systemFieldStage]);
  // Where the ship last set down this world (null until you land). Drives the
  // parked-ship position AND the on-foot exit spawn so you leave the ship exactly
  // where you flew it down, not back at the deterministic arrival site. Resets to
  // null on world swap (EfficientScene remounts).
  const persistedParked = useMemo(() => persistedParkedShipPose({
    systemId: coordinateKey(commandContext.world.coordinate),
    worldId: commandContext.world.worldId
  }), [commandContext.world.coordinate, commandContext.world.worldId]);
  const validatedPersistedParked = useMemo(() => {
    if (!persistedParked) return null;
    const position = new THREE.Vector3(...persistedParked.position);
    if (!resolveSafeShipBoardingPosition(spawnTerrain, planetSize, position, 0)) return null;
    return {
      position,
      quaternion: new THREE.Quaternion(...persistedParked.quaternion).normalize()
    };
  }, [persistedParked, spawnTerrain]);
  const [landedShipPos, setLandedShipPos] = useState<THREE.Vector3 | null>(
    () => validatedPersistedParked?.position.clone() ?? null
  );
  const [landedShipQuaternion, setLandedShipQuaternion] = useState<THREE.Quaternion | null>(
    () => validatedPersistedParked?.quaternion.clone() ?? null
  );
  const handleLanded = useCallback((rest: THREE.Vector3, quaternion: THREE.Quaternion) => {
    setLandedShipPos(rest.clone());
    setLandedShipQuaternion(quaternion.clone().normalize());
  }, []);
  // The repaired Story hull boards from its one persistent impact-site exterior.
  // Capture that as the parked pose when control transfers so exiting before
  // launch cannot snap the player back to the generic arrival pad.
  useEffect(() => {
    if (!storyWreckBoardingPosition || controlMode !== 'flight' || landedShipPos) return;
    setLandedShipPos(storyWreckBoardingPosition.clone());
    setLandedShipQuaternion(shipParkedOrientation(storyWreckBoardingPosition));
  }, [controlMode, landedShipPos, storyWreckBoardingPosition]);
  const landedPlayerEgress = useMemo(() => {
    if (!landedShipPos) return null;
    // Ship and player have different origins above the same support. Reusing the
    // lower ship rest point as the capsule center embeds the player's feet in the
    // voxel; resolve the player-specific clearance before the FPS rig remounts.
    return resolveShipPlayerEgressPosition(
      spawnTerrain,
      planetSize,
      landedShipPos
    );
  }, [landedShipPos, spawnTerrain]);
  const landedPlayerSpawn = landedShipPos
    ? landedPlayerEgress ?? arrivalPose.playerSurfacePosition
    : initialPlayerPosition;
  const landfallAvStateRef = useRef({ ...INITIAL_LANDFALL_AV_STATE });
  const successfulShipExitPendingRef = useRef<ShipExitReceipt | null>(null);
  const pendingGroundedFootfallRef = useRef(false);
  const applyLandfallAvEvidence = useCallback((evidence: LandfallAvEvidence) => {
    const advance = advanceLandfallAvState(landfallAvStateRef.current, evidence);
    landfallAvStateRef.current = advance.state;
    for (const event of advance.events) activateVehicleSceneAvEvent(event);
    return advance.events.length > 0;
  }, []);

  const commitResolvedLandfallExit = useCallback(() => {
    if (
      !successfulShipExitPendingRef.current
      || commandContext.world.worldId !== TIDEGARDEN_WORLD_ID
      || !landedShipPos
      || !landedPlayerEgress
    ) return;
    const receipt = successfulShipExitPendingRef.current;
    const activePlanetId = getSystemFlightSnapshot().activePlanetId;
    applyLandfallAvEvidence({
      kind: 'egress',
      worldId: commandContext.world.worldId,
      activePlanetId,
      previousControlMode: receipt.previousControlMode,
      controlMode: receipt.controlMode,
      egressResolved: true
    });
    if (!landfallAvStateRef.current.egressCleared) return;
    successfulShipExitPendingRef.current = null;
    if (
      pendingGroundedFootfallRef.current
    ) {
      pendingGroundedFootfallRef.current = false;
      applyLandfallAvEvidence({
        kind: 'grounded',
        worldId: commandContext.world.worldId,
        activePlanetId,
        controlMode: 'fps',
        grounded: true
      });
    }
  }, [
    applyLandfallAvEvidence,
    commandContext.world.worldId,
    landedPlayerEgress,
    landedShipPos
  ]);

  // The hatch cue owns an exact successful exitShip receipt. If egress geometry
  // is still resolving, retain that receipt and authenticate only once the dry
  // Tidegarden player capsule position exists.
  useLayoutEffect(() => subscribeShipExit(receipt => {
    if (
      commandContext.world.worldId !== TIDEGARDEN_WORLD_ID
      || getSystemFlightSnapshot().activePlanetId !== TIDEGARDEN_WORLD_ID
    ) return;
    successfulShipExitPendingRef.current = receipt;
    commitResolvedLandfallExit();
  }), [commandContext.world.worldId, commitResolvedLandfallExit]);

  useEffect(() => {
    commitResolvedLandfallExit();
  }, [commitResolvedLandfallExit]);

  const handleControllerGroundedChange = useCallback((grounded: boolean) => {
    onGroundedChange?.(grounded);
    if (
      !grounded
      || controlMode !== 'fps'
      || commandContext.world.worldId !== TIDEGARDEN_WORLD_ID
    ) return;
    if (!landfallAvStateRef.current.egressCleared) {
      pendingGroundedFootfallRef.current = true;
      return;
    }
    applyLandfallAvEvidence({
      kind: 'grounded',
      worldId: commandContext.world.worldId,
      activePlanetId: getSystemFlightSnapshot().activePlanetId,
      controlMode,
      grounded
    });
  }, [
    applyLandfallAvEvidence,
    commandContext.world.worldId,
    controlMode,
    onGroundedChange
  ]);
  const [surfaceState, setSurfaceState] = useState<SurfaceState>(
    () => getSurfaceState(dominantFaceForPosition(initialPlayerPosition))
  );
  const debugStateRef = useRef<SceneDebugState>({ player: null, planet: null });

  // Keep the canonical system context valid even while the ship controller is
  // absent (menu, debug camera, or on foot). Continuous pose ownership remains
  // exclusive to ShipController; this only publishes boundary state.
  useEffect(() => {
    if (controlMode === 'flight') return;
    let current = getSystemFlightSnapshot();
    const systemId = coordinateKey(commandContext.world.coordinate);
    const parked = landedShipPos ?? storyWreckBoardingPosition ?? arrivalPose.shipPosition;
    const parkedQuaternion = landedShipQuaternion ?? shipParkedOrientation(parked);
    if (current.systemId !== systemId) {
      resetSystemFlightForInterstellarArrival({
        system: commandContext.world.coordinate,
        activePlanetId: commandContext.world.worldId,
        locationMode: 'surface',
        pose: planetLocalPoseToSystemPose({
          position: [parked.x, parked.y, parked.z],
          velocity: [0, 0, 0],
          quaternion: [
            parkedQuaternion.x,
            parkedQuaternion.y,
            parkedQuaternion.z,
            parkedQuaternion.w
          ]
        }, activePlanetSystemPosition),
        renderOrigin: activePlanetSystemPosition
      });
      current = getSystemFlightSnapshot();
    }
    if (current.activePlanetId !== commandContext.world.worldId) {
      setActiveSystemPlanet(commandContext.world.worldId);
    }
    setSystemLocationMode('surface');
    persistShipFlightLocation({
      system: commandContext.world.coordinate,
      systemId,
      worldId: commandContext.world.worldId,
      systemPosition: activePlanetSystemPosition,
      layoutVersion: getSystemFlightSnapshot().layoutVersion,
      locationMode: 'surface',
      parkedPose: {
        position: [parked.x, parked.y, parked.z],
        quaternion: [
          parkedQuaternion.x,
          parkedQuaternion.y,
          parkedQuaternion.z,
          parkedQuaternion.w
        ]
      }
    });
  }, [
    activePlanetSystemPosition,
    arrivalPose.shipPosition,
    commandContext.world.coordinate,
    commandContext.world.worldId,
    controlMode,
    landedShipPos,
    landedShipQuaternion,
    storyWreckBoardingPosition
  ]);

  const updateDebugState = useCallback((patch: Partial<SceneDebugState>) => {
    const next = { ...debugStateRef.current, ...patch };
    debugStateRef.current = next;
    onDebugChange?.(next);
  }, [onDebugChange]);
  // Debug adapters cross a passive-effect boundary in the planet and a frame
  // boundary in the player. Stable identities prevent debug state publication
  // from recreating those subscriptions after every App render.
  const updatePlanetDebugState = useCallback(
    (planet: PlanetStats) => updateDebugState({ planet }),
    [updateDebugState]
  );
  const updatePlayerDebugState = useCallback(
    (player: PlayerDebugState) => updateDebugState({ player }),
    [updateDebugState]
  );

  const publishPlayerPosition = useCallback((position: THREE.Vector3) => {
    // Continuous coordinates belong to the R3F loop, not React reconciliation.
    // During deep-space flight the surface scene remains anchored to its planet.
    if (phase === 'deep_space') return;
    playerPositionMailbox.publish(position);
  }, [phase, playerPositionMailbox]);

  return (
    <Physics paused={paused} gravity={[0, 0, 0]} timeStep={FIXED_PHYSICS_STEP} maxCcdSubsteps={2}>
      <ProfiledSystemSubsystem enabled={profileSystemTravel} id="terrain">
        <EfficientPlanet
          size={planetSize}
          playerPosition={playerPosition}
          surfaceUp={surfaceState.up}
          terrainSeed={terrainSeed}
          planetProfile={planetProfile}
          persistenceWorld={commandContext.world}
          debugColliders={debugColliders}
          onStatsChange={updatePlanetDebugState}
        />
      </ProfiledSystemSubsystem>
      <ProfiledSystemSubsystem enabled={profileSystemTravel} id="controller">
        {agent ? (
        <AgentCamera
          planetSize={planetSize}
          terrainSeed={terrainSeed}
          worldId={commandContext.world.worldId}
          planetProfile={planetProfile}
          worldCoordinate={commandContext.world.coordinate}
          onPositionChange={publishPlayerPosition}
        />
      ) : overview ? (
        <OverviewCamera planetSize={planetSize} />
      ) : cinematic ? (
        <MenuCamera
          planetSize={planetSize}
          streamTarget={arrivalPose.playerSurfacePosition}
          onPositionChange={publishPlayerPosition}
        />
      ) : controlMode === 'flight' ? (
        <ShipController
          paused={paused}
          planetSize={planetSize}
          terrainSeed={terrainSeed}
          systemCoordinate={commandContext.world.coordinate}
          activePlanetWorldId={commandContext.world.worldId}
          planetSystemPosition={activePlanetSystemPosition}
          arrivalPose={arrivalPose}
          boardingPosition={landedShipPos ?? storyWreckBoardingPosition ?? arrivalPose.shipPosition}
          boardingQuaternion={landedShipQuaternion ?? undefined}
          onGroundedChange={handleControllerGroundedChange}
          onPositionChange={publishPlayerPosition}
          onLanded={handleLanded}
        />
      ) : (
        <EfficientPlayer
          paused={paused}
          commandContext={commandContext}
          planetSize={planetSize}
          terrainSeed={terrainSeed}
          initialPosition={landedPlayerSpawn}
          resetPosition={landedShipPos ? landedPlayerSpawn : arrivalPose.playerSurfacePosition}
          resetShipPosition={storyWorldShip ? undefined : landedShipPos ?? arrivalPose.shipPosition}
          onPositionChange={publishPlayerPosition}
          onSurfaceChange={setSurfaceState}
          onGroundedChange={handleControllerGroundedChange}
          onDebugChange={updatePlayerDebugState}
        />
        )}
      </ProfiledSystemSubsystem>
      {/* Pre-A2 story chapters permit NOTHING smooth: the hauler is diegetically
          "disassembled" and forage berries return with the living world. In a
          story world the ship is the crash wreck (StoryWorldProps mounts it), so
          the sandbox parked ship is suppressed for the whole story. */}
      {!storyPreAwakened && !storyWorldShip && (
        <SpaceshipPlaceholder
          position={landedShipPos ?? arrivalPose.shipPosition}
          parkedQuaternion={landedShipQuaternion ?? undefined}
          planetSize={planetSize}
          terrainSeed={terrainSeed}
          worldId={commandContext.world.worldId}
          activeApproach={arrivalMode === 'approach'}
          playerPosition={playerPosition}
        />
      )}
      {/* Story-mode bespoke props (anomaly stone, hero apple tree) — story world only. */}
      {isStoryWorldSeed(terrainSeed) && (
        <StoryWorldProps
          planetSize={planetSize}
          terrainSeed={terrainSeed}
          commandContext={commandContext}
        />
      )}
      {commandContext.world.worldId === TIDEGARDEN_WORLD_ID && (
        <TidegardenSettlementWorld
          planetSize={planetSize}
          terrainSeed={terrainSeed}
          commandContext={commandContext}
          shipPosition={landedShipPos ?? arrivalPose.shipPosition}
        />
      )}
      <PlayerAvatarPoseHarness worldId={commandContext.world.worldId} />
      {visibleSystemFieldStage >= 3 && graphicsQuality.grassDensity > 0 && (
        <GrassField
          key={`grass-${graphicsProfile}-${graphicsQuality.grassDensity}-${graphicsQuality.grassMaxDistance}`}
          terrainSeed={terrainSeed}
          planetProfile={planetProfile}
          playerPosition={fieldPlayerPosition}
        />
      )}
      {visibleSystemFieldStage >= 4 && (
        <ProfiledSystemSubsystem enabled={profileSystemTravel} id="vegetation">
        <FloraField
          key={`flora-${graphicsProfile}-${graphicsQuality.floraDensity}-${graphicsQuality.floraMaxDistance}`}
          terrainSeed={terrainSeed}
          planetProfile={planetProfile}
          persistenceWorld={commandContext.world}
          playerPosition={fieldPlayerPosition}
          progressiveMount={restoringSameSystemRuntime}
        />
        {graphicsQuality.treeDensity > 0 && (
          <TreeField
            key={`trees-${graphicsProfile}-${graphicsQuality.treeDensity}-${graphicsQuality.treeMaxDistance}`}
            planetSize={planetSize}
            terrainSeed={terrainSeed}
            planetProfile={planetProfile}
            persistenceWorld={commandContext.world}
            playerPosition={fieldPlayerPosition}
          />
        )}
        </ProfiledSystemSubsystem>
      )}
      {visibleSystemFieldStage >= 5 && graphicsQuality.faunaDensity > 0 && (
        <ProfiledSystemSubsystem enabled={profileSystemTravel} id="fauna">
          <FaunaField
            key={`fauna-${graphicsProfile}-${graphicsQuality.faunaDensity}-${graphicsQuality.faunaMaxDistance}`}
            terrainSeed={terrainSeed}
            worldId={commandContext.world.worldId}
            planetProfile={planetProfile}
            playerPosition={fieldPlayerPosition}
            planetSize={planetSize}
            progressiveMount={restoringSameSystemRuntime}
          />
        </ProfiledSystemSubsystem>
      )}
      {visibleSystemFieldStage >= 6 && (
        <ProfiledSystemSubsystem enabled={profileSystemTravel} id="surface-details">
        {graphicsQuality.voxelEffectDensity > 0 && (
          <SurfaceEffectField
            key={`surface-effects-${graphicsProfile}-${graphicsQuality.voxelEffectDensity}-${graphicsQuality.voxelEffectMaxDistance}`}
            terrainSeed={terrainSeed}
            planetProfile={planetProfile}
            playerPosition={fieldPlayerPosition}
          />
        )}
        <LooseStoneField commandContext={commandContext} terrainSeed={terrainSeed} persistenceWorld={commandContext.world} playerPosition={fieldPlayerPosition} />
        {!storyPreAwakened && (
          <ForageField
            commandContext={commandContext}
            terrainSeed={terrainSeed}
            planetProfile={planetProfile}
            persistenceWorld={commandContext.world}
            playerPosition={fieldPlayerPosition}
            allowDeadwood={!story.active}
          />
        )}
        </ProfiledSystemSubsystem>
      )}
      <PlayerTorch playerPosition={playerPosition} />
      {visibleSystemFieldStage >= 2 && (
        <ProfiledSystemSubsystem enabled={profileSystemTravel} id="structures">
        <Campfires
          terrainSeed={terrainSeed}
          persistenceWorld={commandContext.world}
          hydrationPrerequisite={debugCampfirePrerequisite}
        />
        <StructureField terrainSeed={terrainSeed} persistenceWorld={commandContext.world} />
        <BuildGhost />
        </ProfiledSystemSubsystem>
      )}
      {visibleSystemFieldStage >= 1 && (
        <ProfiledSystemSubsystem enabled={profileSystemTravel} id="water">
          <WaterBlocks
            planetSize={planetSize}
            terrainSeed={terrainSeed}
            worldId={commandContext.world.worldId}
            planetProfile={planetProfile}
          />
        </ProfiledSystemSubsystem>
      )}
      {/* Underwater: the surface-seen-from-below dome + near-field marine snow /
          bubbles. Both self-gate on submergence (invisible above water) and on
          the underwater graphics knobs, so they're cheap to leave mounted. */}
      <UnderwaterDome />
      {graphicsQuality.underwaterParticles && (
        <UnderwaterParticles key={`underwater-particles-${graphicsProfile}`} />
      )}
    </Physics>
  );
}

const recordSubsystemProfile: ProfilerOnRenderCallback = (
  id,
  phase,
  actualDuration,
  baseDuration,
  startTime,
  commitTime
) => {
  const win = window as unknown as {
    __paravoxiaSystemReactProfiles?: Array<Record<string, string | number>>;
  };
  const samples = win.__paravoxiaSystemReactProfiles ?? [];
  samples.push({ id, phase, actualDuration, baseDuration, startTime, commitTime });
  if (samples.length > 160) samples.splice(0, samples.length - 160);
  win.__paravoxiaSystemReactProfiles = samples;
};

function ProfiledSystemSubsystem({
  enabled,
  id,
  children
}: {
  enabled: boolean;
  id: string;
  children: ReactNode;
}) {
  if (!enabled) return children;
  return <Profiler id={id} onRender={recordSubsystemProfile}>{children}</Profiler>;
}
