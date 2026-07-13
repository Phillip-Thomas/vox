import {
  Profiler,
  useCallback,
  useEffect,
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
import { PlayerTorch, Campfires } from './Lights';
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
import { useSpaceFlight } from '../state/spaceFlight.ts';
import { dominantFaceForPosition, getSurfaceState, SurfaceState } from '../utils/surfaceControls';
import { FIXED_PHYSICS_STEP } from '../utils/cubeGravityConstants';
import {
  ArrivalMode,
  createWorldArrivalPose
} from '../utils/worldArrival';
import { measureWarpMetric } from '../utils/warpMetrics';
import { loadPlayerPose } from '../game/systems/persistence.ts';
import { setPlayerLook, setPlayerWorldPosition } from '../state/playerFrame.ts';
import type { CommandContext } from '../game/commands.ts';
import { isStoryWorldSeed } from '../story/world/storyWorld.ts';
import StoryWorldProps from '../story/world/StoryWorldProps.tsx';
import { getStoryStateSnapshot, storyAnchoredSpawn, useStoryState } from '../story/storyState.ts';
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
  onGroundedChange?: (grounded: boolean) => void;
  onDebugChange?: (debug: SceneDebugState) => void;
}

export default function EfficientScene({
  commandContext,
  activePlanetSystemPosition = PRIMARY_SYSTEM_POSITION,
  terrainSeed = TERRAIN_SEEDS.DEFAULT,
  debugColliders = false,
  arrivalMode = 'surface',
  overview = false,
  agent = false,
  cinematic = false,
  profileSystemTravel = false,
  onGroundedChange,
  onDebugChange
}: EfficientSceneProps) {
  const { controlMode, phase } = useSpaceFlight();
  const story = useStoryState();
  // Chapters before the A2 depth awakening allow no smooth props at all.
  const storyPreAwakened = story.active
    && (story.chapter === 'prologue' || story.chapter === 'ch1' || story.chapter === 'ch2');
  // In a story world the player's ship is the CRASH WRECK (voxel DescentPod →
  // hi-fi HifiWreck at the impact site, mounted by StoryWorldProps). The sandbox
  // parked ship must never appear alongside it — suppress it for the whole story
  // (active chapters AND the completed 'done' world). Non-story seeds: unchanged.
  const storyWorldShip = isStoryWorldSeed(terrainSeed) && (story.active || story.chapter === 'complete');
  const arrivalPose = useMemo(
    () => measureWarpMetric(
      'scene:arrival_pose',
      () => createWorldArrivalPose(planetSize, terrainSeed),
      pose => ({
        surfaceX: pose.surfaceVoxel.x,
        surfaceY: pose.surfaceVoxel.y,
        surfaceZ: pose.surfaceVoxel.z
      })
    ),
    [terrainSeed]
  );
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
    const saved = storyAnchoredSpawn(getStoryStateSnapshot())
      ? null
      : loadPlayerPose(commandContext.world);
    if (saved) {
      setPlayerLook(new THREE.Vector3(...saved.forward), saved.pitch);
      const pos = new THREE.Vector3(...saved.pos);
      setPlayerWorldPosition(pos); // correct immediately, before the first frame publishes
      return pos;
    }
    setPlayerWorldPosition(arrivalPose.playerSurfacePosition); // ditto for the arrival
    return arrivalPose.playerSurfacePosition.clone();
  });
  const [playerPosition, setPlayerPosition] = useState(() => initialPlayerPosition.clone());
  const [fieldPlayerPosition, setFieldPlayerPosition] = useState(
    () => initialPlayerPosition.clone()
  );
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
  const [landedShipPos, setLandedShipPos] = useState<THREE.Vector3 | null>(null);
  const handleLanded = useCallback((rest: THREE.Vector3) => setLandedShipPos(rest.clone()), []);
  const [surfaceState, setSurfaceState] = useState<SurfaceState>(
    () => getSurfaceState(dominantFaceForPosition(initialPlayerPosition))
  );
  const lastPublishedPlayerPosition = useRef(playerPosition.clone());
  const lastPublishedPlayerAt = useRef(0);
  const lastPublishedFieldAt = useRef(0);
  const debugStateRef = useRef<SceneDebugState>({ player: null, planet: null });

  // Keep the canonical system context valid even while the ship controller is
  // absent (menu, debug camera, or on foot). Continuous pose ownership remains
  // exclusive to ShipController; this only publishes boundary state.
  useEffect(() => {
    if (controlMode === 'flight') return;
    const current = getSystemFlightSnapshot();
    const systemId = coordinateKey(commandContext.world.coordinate);
    if (current.systemId !== systemId) {
      const parked = landedShipPos ?? arrivalPose.shipPosition;
      resetSystemFlightForInterstellarArrival({
        system: commandContext.world.coordinate,
        activePlanetId: commandContext.world.worldId,
        locationMode: 'surface',
        pose: planetLocalPoseToSystemPose({
          position: [parked.x, parked.y, parked.z],
          velocity: [0, 0, 0],
          quaternion: [0, 0, 0, 1]
        }, activePlanetSystemPosition),
        renderOrigin: activePlanetSystemPosition
      });
      return;
    }
    if (current.activePlanetId !== commandContext.world.worldId) {
      setActiveSystemPlanet(commandContext.world.worldId);
    }
    setSystemLocationMode('surface');
  }, [
    activePlanetSystemPosition,
    arrivalPose.shipPosition,
    commandContext.world.coordinate,
    commandContext.world.worldId,
    controlMode,
    landedShipPos
  ]);

  const updateDebugState = useCallback((patch: Partial<SceneDebugState>) => {
    const next = { ...debugStateRef.current, ...patch };
    debugStateRef.current = next;
    onDebugChange?.(next);
  }, [onDebugChange]);

  const publishPlayerPosition = useCallback((position: THREE.Vector3) => {
    // Deep-space culling follows the canonical system pose and does not need to
    // rerender every surface field. In atmosphere, 15 Hz is enough for collision
    // and ecology streaming while keeping React out of the 60 Hz flight loop.
    if (phase === 'deep_space') return;
    if (lastPublishedPlayerPosition.current.distanceToSquared(position) <= 1) return;
    const now = typeof performance === 'undefined' ? Date.now() : performance.now();
    if (now - lastPublishedPlayerAt.current < 1000 / 15) return;
    lastPublishedPlayerAt.current = now;
    const next = position.clone();
    lastPublishedPlayerPosition.current.copy(next);
    setPlayerPosition(next);
    if (
      controlMode === 'fps'
      || phase === 'surface'
      || now - lastPublishedFieldAt.current >= 400
    ) {
      lastPublishedFieldAt.current = now;
      setFieldPlayerPosition(next.clone());
    }
  }, [controlMode, phase]);

  return (
    <Physics gravity={[0, 0, 0]} timeStep={FIXED_PHYSICS_STEP} maxCcdSubsteps={2}>
      <ProfiledSystemSubsystem enabled={profileSystemTravel} id="terrain">
        <EfficientPlanet
          size={planetSize}
          playerPosition={playerPosition}
          surfaceUp={surfaceState.up}
          terrainSeed={terrainSeed}
          persistenceWorld={commandContext.world}
          debugColliders={debugColliders}
          onStatsChange={planet => updateDebugState({ planet })}
        />
      </ProfiledSystemSubsystem>
      <ProfiledSystemSubsystem enabled={profileSystemTravel} id="controller">
        {agent ? (
        <AgentCamera
          planetSize={planetSize}
          terrainSeed={terrainSeed}
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
          planetSize={planetSize}
          terrainSeed={terrainSeed}
          systemCoordinate={commandContext.world.coordinate}
          activePlanetWorldId={commandContext.world.worldId}
          planetSystemPosition={activePlanetSystemPosition}
          arrivalPose={arrivalPose}
          boardingPosition={playerPosition}
          onGroundedChange={onGroundedChange}
          onPositionChange={publishPlayerPosition}
          onLanded={handleLanded}
        />
      ) : (
        <EfficientPlayer
          commandContext={commandContext}
          planetSize={planetSize}
          terrainSeed={terrainSeed}
          initialPosition={landedShipPos ?? initialPlayerPosition}
          resetPosition={arrivalPose.playerSurfacePosition}
          onPositionChange={publishPlayerPosition}
          onSurfaceChange={setSurfaceState}
          onGroundedChange={onGroundedChange}
          onDebugChange={player => updateDebugState({ player })}
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
          terrainSeed={terrainSeed}
          activeApproach={arrivalMode === 'approach'}
          playerPosition={playerPosition}
        />
      )}
      {/* Story-mode bespoke props (anomaly stone, hero apple tree) — story world only. */}
      {isStoryWorldSeed(terrainSeed) && <StoryWorldProps planetSize={planetSize} terrainSeed={terrainSeed} />}
      <PlayerAvatarPoseHarness worldId={commandContext.world.worldId} />
      {visibleSystemFieldStage >= 3 && (
        <GrassField terrainSeed={terrainSeed} playerPosition={fieldPlayerPosition} />
      )}
      {visibleSystemFieldStage >= 4 && (
        <ProfiledSystemSubsystem enabled={profileSystemTravel} id="vegetation">
        <FloraField
          terrainSeed={terrainSeed}
          persistenceWorld={commandContext.world}
          playerPosition={fieldPlayerPosition}
          progressiveMount={restoringSameSystemRuntime}
        />
        <TreeField planetSize={planetSize} terrainSeed={terrainSeed} persistenceWorld={commandContext.world} playerPosition={fieldPlayerPosition} />
        </ProfiledSystemSubsystem>
      )}
      {visibleSystemFieldStage >= 5 && (
        <ProfiledSystemSubsystem enabled={profileSystemTravel} id="fauna">
          <FaunaField
            terrainSeed={terrainSeed}
            playerPosition={fieldPlayerPosition}
            planetSize={planetSize}
            progressiveMount={restoringSameSystemRuntime}
          />
        </ProfiledSystemSubsystem>
      )}
      {visibleSystemFieldStage >= 6 && (
        <ProfiledSystemSubsystem enabled={profileSystemTravel} id="surface-details">
        <SurfaceEffectField terrainSeed={terrainSeed} playerPosition={fieldPlayerPosition} />
        <LooseStoneField commandContext={commandContext} terrainSeed={terrainSeed} persistenceWorld={commandContext.world} playerPosition={fieldPlayerPosition} />
        {!storyPreAwakened && (
          <ForageField commandContext={commandContext} terrainSeed={terrainSeed} persistenceWorld={commandContext.world} playerPosition={fieldPlayerPosition} />
        )}
        </ProfiledSystemSubsystem>
      )}
      <PlayerTorch playerPosition={playerPosition} />
      {visibleSystemFieldStage >= 2 && (
        <ProfiledSystemSubsystem enabled={profileSystemTravel} id="structures">
        <Campfires terrainSeed={terrainSeed} persistenceWorld={commandContext.world} />
        <StructureField terrainSeed={terrainSeed} persistenceWorld={commandContext.world} />
        <BuildGhost />
        </ProfiledSystemSubsystem>
      )}
      {visibleSystemFieldStage >= 1 && (
        <ProfiledSystemSubsystem enabled={profileSystemTravel} id="water">
          <WaterBlocks planetSize={planetSize} terrainSeed={terrainSeed} worldId={commandContext.world.worldId} />
        </ProfiledSystemSubsystem>
      )}
      {/* Underwater: the surface-seen-from-below dome + near-field marine snow /
          bubbles. Both self-gate on submergence (invisible above water) and on
          the underwater graphics knobs, so they're cheap to leave mounted. */}
      <UnderwaterDome />
      <UnderwaterParticles />
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
