import { useCallback, useRef, useState } from 'react';
import { Physics } from '@react-three/rapier';
import * as THREE from 'three';
import EfficientPlanet, { PlanetStats } from './EfficientPlanet';
import EfficientPlayer, { PlayerDebugState } from './EfficientPlayer';
import GrassField from './GrassField';
import TreeField from './TreeField';
import WaterBlocks from './WaterBlocks.tsx';
import OverviewCamera from './OverviewCamera.tsx';
import { getSurfaceState, SurfaceState } from '../utils/surfaceControls';
import { FIXED_PHYSICS_STEP } from '../utils/cubeGravityConstants';

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
  /** DEBUG (?overview=1): mount a non-interactive overhead camera instead of the
   *  pointer-lock player so the ocean can be inspected/screenshotted. */
  overview?: boolean;
  onDebugChange?: (debug: SceneDebugState) => void;
}

export default function EfficientScene({
  terrainSeed = TERRAIN_SEEDS.DEFAULT,
  debugColliders = false,
  overview = false,
  onDebugChange
}: EfficientSceneProps) {
  const [playerPosition, setPlayerPosition] = useState(() => new THREE.Vector3(0, planetSize + 4, 0));
  const [surfaceState, setSurfaceState] = useState<SurfaceState>(() => getSurfaceState('top'));
  const debugStateRef = useRef<SceneDebugState>({ player: null, planet: null });

  const updateDebugState = useCallback((patch: Partial<SceneDebugState>) => {
    const next = { ...debugStateRef.current, ...patch };
    debugStateRef.current = next;
    onDebugChange?.(next);
  }, [onDebugChange]);

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
      ) : (
        <EfficientPlayer
          planetSize={planetSize}
          onPositionChange={setPlayerPosition}
          onSurfaceChange={setSurfaceState}
          onDebugChange={player => updateDebugState({ player })}
        />
      )}
      <GrassField playerPosition={playerPosition} />
      <TreeField planetSize={planetSize} terrainSeed={terrainSeed} playerPosition={playerPosition} />
      <WaterBlocks planetSize={planetSize} terrainSeed={terrainSeed} />
    </Physics>
  );
}
