import { useCallback, useMemo, useRef, useState } from 'react';
import { Physics } from '@react-three/rapier';
import * as THREE from 'three';
import EfficientPlanet, { PlanetStats } from './EfficientPlanet';
import EfficientPlayer, { PlayerDebugState } from './EfficientPlayer';
import GrassField from './GrassField';
import TreeField from './TreeField';
import WaterBlocks from './WaterBlocks.tsx';
import OverviewCamera from './OverviewCamera.tsx';
import SpaceshipPlaceholder from './SpaceshipPlaceholder.tsx';
import ShipController from './ShipController.tsx';
import { useSpaceFlight } from '../state/spaceFlight.ts';
import { getSurfaceState, SurfaceState } from '../utils/surfaceControls';
import { FIXED_PHYSICS_STEP } from '../utils/cubeGravityConstants';
import {
  ArrivalMode,
  createWorldArrivalPose
} from '../utils/worldArrival';

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
  onGroundedChange?: (grounded: boolean) => void;
  onDebugChange?: (debug: SceneDebugState) => void;
}

export default function EfficientScene({
  terrainSeed = TERRAIN_SEEDS.DEFAULT,
  debugColliders = false,
  arrivalMode = 'surface',
  overview = false,
  onGroundedChange,
  onDebugChange
}: EfficientSceneProps) {
  const { controlMode } = useSpaceFlight();
  const arrivalPose = useMemo(
    () => createWorldArrivalPose(planetSize, terrainSeed),
    [terrainSeed]
  );
  const [initialPlayerPosition] = useState(() => (
    arrivalMode === 'approach'
      ? arrivalPose.approachPosition.clone()
      : arrivalPose.playerSurfacePosition.clone()
  ));
  const [playerPosition, setPlayerPosition] = useState(() => initialPlayerPosition.clone());
  const [surfaceState, setSurfaceState] = useState<SurfaceState>(() => getSurfaceState('top'));
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
      {overview ? (
        <OverviewCamera planetSize={planetSize} />
      ) : controlMode === 'flight' ? (
        <ShipController
          planetSize={planetSize}
          terrainSeed={terrainSeed}
          arrivalPose={arrivalPose}
          boardingPosition={playerPosition}
          onGroundedChange={onGroundedChange}
          onPositionChange={publishPlayerPosition}
        />
      ) : (
        <EfficientPlayer
          planetSize={planetSize}
          initialPosition={initialPlayerPosition}
          resetPosition={arrivalPose.playerSurfacePosition}
          onPositionChange={publishPlayerPosition}
          onSurfaceChange={setSurfaceState}
          onGroundedChange={onGroundedChange}
          onDebugChange={player => updateDebugState({ player })}
        />
      )}
      <SpaceshipPlaceholder
        position={arrivalPose.shipPosition}
        terrainSeed={terrainSeed}
        activeApproach={arrivalMode === 'approach'}
        playerPosition={playerPosition}
      />
      <GrassField terrainSeed={terrainSeed} playerPosition={playerPosition} />
      <TreeField planetSize={planetSize} terrainSeed={terrainSeed} playerPosition={playerPosition} />
      <WaterBlocks planetSize={planetSize} terrainSeed={terrainSeed} />
    </Physics>
  );
}
