import { useCallback, useMemo, useRef, useState } from 'react';
import { Physics } from '@react-three/rapier';
import * as THREE from 'three';
import EfficientPlanet, { PlanetStats } from './EfficientPlanet';
import EfficientPlayer, { PlayerDebugState } from './EfficientPlayer';
import GrassField from './GrassField';
import TreeField from './TreeField';
import LooseStoneField from './LooseStoneField';
import { PlayerTorch, Campfires } from './Lights';
import StructureField, { BuildGhost } from './StructureField';
import WaterBlocks from './WaterBlocks.tsx';
import OverviewCamera from './OverviewCamera.tsx';
import MenuCamera from './MenuCamera.tsx';
import AgentCamera from './debug/AgentCamera.tsx';
import SpaceshipPlaceholder from './SpaceshipPlaceholder.tsx';
import ShipController from './ShipController.tsx';
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

export const planetSize = 50;

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
  onGroundedChange?: (grounded: boolean) => void;
  onDebugChange?: (debug: SceneDebugState) => void;
}

export default function EfficientScene({
  terrainSeed = TERRAIN_SEEDS.DEFAULT,
  debugColliders = false,
  arrivalMode = 'surface',
  overview = false,
  agent = false,
  cinematic = false,
  onGroundedChange,
  onDebugChange
}: EfficientSceneProps) {
  const { controlMode } = useSpaceFlight();
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
  const [initialPlayerPosition] = useState(() => {
    if (arrivalMode === 'approach') return arrivalPose.approachPosition.clone();
    // Returning to a saved world: spawn where you stood, facing how you faced
    // (seed the camera look before CameraControls mounts).
    const saved = loadPlayerPose(terrainSeed);
    if (saved) {
      setPlayerLook(new THREE.Vector3(...saved.forward), saved.pitch);
      const pos = new THREE.Vector3(...saved.pos);
      setPlayerWorldPosition(pos); // correct immediately, before the first frame publishes
      return pos;
    }
    return arrivalPose.playerSurfacePosition.clone();
  });
  const [playerPosition, setPlayerPosition] = useState(() => initialPlayerPosition.clone());
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
  const debugStateRef = useRef<SceneDebugState>({ player: null, planet: null });

  const updateDebugState = useCallback((patch: Partial<SceneDebugState>) => {
    const next = { ...debugStateRef.current, ...patch };
    debugStateRef.current = next;
    onDebugChange?.(next);
  }, [onDebugChange]);

  const publishPlayerPosition = useCallback((position: THREE.Vector3) => {
    if (lastPublishedPlayerPosition.current.distanceToSquared(position) <= 1) return;
    const next = position.clone();
    lastPublishedPlayerPosition.current.copy(next);
    setPlayerPosition(next);
  }, []);

  return (
    <Physics gravity={[0, 0, 0]} timeStep={FIXED_PHYSICS_STEP} maxCcdSubsteps={2}>
      <EfficientPlanet
        size={planetSize}
        playerPosition={playerPosition}
        surfaceUp={surfaceState.up}
        terrainSeed={terrainSeed}
        debugColliders={debugColliders}
        onStatsChange={planet => updateDebugState({ planet })}
      />
      {agent ? (
        <AgentCamera planetSize={planetSize} onPositionChange={publishPlayerPosition} />
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
          arrivalPose={arrivalPose}
          boardingPosition={playerPosition}
          onGroundedChange={onGroundedChange}
          onPositionChange={publishPlayerPosition}
          onLanded={handleLanded}
        />
      ) : (
        <EfficientPlayer
          planetSize={planetSize}
          initialPosition={landedShipPos ?? initialPlayerPosition}
          resetPosition={arrivalPose.playerSurfacePosition}
          onPositionChange={publishPlayerPosition}
          onSurfaceChange={setSurfaceState}
          onGroundedChange={onGroundedChange}
          onDebugChange={player => updateDebugState({ player })}
        />
      )}
      <SpaceshipPlaceholder
        position={landedShipPos ?? arrivalPose.shipPosition}
        terrainSeed={terrainSeed}
        activeApproach={arrivalMode === 'approach'}
        playerPosition={playerPosition}
      />
      <GrassField terrainSeed={terrainSeed} playerPosition={playerPosition} />
      <TreeField planetSize={planetSize} terrainSeed={terrainSeed} playerPosition={playerPosition} />
      <LooseStoneField terrainSeed={terrainSeed} playerPosition={playerPosition} />
      <PlayerTorch playerPosition={playerPosition} />
      <Campfires terrainSeed={terrainSeed} />
      <StructureField terrainSeed={terrainSeed} />
      <BuildGhost />
      <WaterBlocks planetSize={planetSize} terrainSeed={terrainSeed} />
    </Physics>
  );
}
