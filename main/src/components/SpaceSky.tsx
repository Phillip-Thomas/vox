import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getGraphicsQuality } from '../config/graphicsSettings.ts';
import {
  SPACE_DOME_RADIUS,
  SPACE_DOME_RENDER_ORDER,
  createSpaceSkyMaterial,
  updateSpaceSky,
  setSpaceSkyAtmosphere
} from '../utils/spaceSky.ts';
import { getSunDirection, getMoonDirection } from './SkyController.tsx';
import { useSpaceFlight } from '../state/spaceFlight.ts';
import { localDaylight, localGolden } from '../utils/dayNight.ts';
import { getPlayerUp } from '../state/playerFrame.ts';
import { buildPlanetAtmosphereProfile } from '../utils/planetVisualProfile.ts';
import { getVoxelRealityEffects } from '../game/systems/realityRenderSystem.ts';
import { getConstellationReveal } from '../story/skyMeaning.ts';
import {
  atmosphereSpaceBlend,
  planetLocalCameraRadius
} from '../game/atmosphereSpace.ts';
import { NOMINAL_PLANET_FACE_RADIUS } from '../game/starSystem.ts';
import { getSystemFlightSnapshot, type SystemVectorTuple } from '../state/systemFlight.ts';
import type { PlanetProfile } from '../game/PlanetProfile.ts';

// The dome is camera-centered at every altitude and rendered as a depthless
// background. Only atmospheric uniforms change during launch; celestial
// directions never inherit a planet-centered -> camera-centered transform.

/**
 * Procedural starfield + nebula backdrop. Rendered from within SkyController's
 * JSX. Owns its own gated useFrame that reads the shared sun direction and the
 * same 240s clock so its motion/visibility stays consistent with the sky.
 */
export default function SpaceSky({
  terrainSeed = 0,
  planetProfile,
  activePlanetSystemPosition
}: {
  terrainSeed?: number;
  planetProfile?: PlanetProfile;
  activePlanetSystemPosition: SystemVectorTuple;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const material = useMemo(() => createSpaceSkyMaterial(), []);
  const { phase } = useSpaceFlight();
  const inSpace = phase === 'deep_space';

  // Per-planet daytime atmosphere tint (static per seed; night/space unaffected).
  useEffect(() => {
    const { lowSky, highSky, sunGlow } = buildPlanetAtmosphereProfile(terrainSeed, planetProfile);
    setSpaceSkyAtmosphere(matRef.current ?? material, lowSky, highSky, sunGlow);
  }, [material, planetProfile, terrainSeed]);

  // Seed the dome on mount from the LOCAL day/night (sun vs the player's up) so
  // the first frame is correct even when shader animation is disabled.
  useMemo(() => {
    const sun = getSunDirection();
    const up = getPlayerUp();
    const cloudQuality = getGraphicsQuality().skyClouds ? 1.0 : 0.0;
    updateSpaceSky(material, 0, localDaylight(sun, up), localGolden(sun, up), sun, getMoonDirection(), up, cloudQuality, getVoxelRealityEffects(), getConstellationReveal());
  }, [material]);

  // In deep space the cosmos is ALWAYS fully visible. Force the dome to full
  // night (daylight=0 -> uDay=0 -> early-out) the moment we enter space, so even on profiles
  // with animatedShaders=false (which skip the per-frame update below) the stars
  // are on immediately. Restoring normal phases is handled by the useFrame path.
  useEffect(() => {
    const mat = matRef.current ?? material;
    if (!inSpace) return;
    // daylight=0 -> uDay=0 -> early-out -> pure cosmos; golden + clouds off in the void.
    updateSpaceSky(mat, 0, 0, 0, getSunDirection(), getMoonDirection(), getPlayerUp(), 0, getVoxelRealityEffects(), getConstellationReveal());
  }, [inSpace, material]);

  useFrame(state => {
    // Translation follows the camera exactly; scale and orientation remain fixed.
    // The star-direction mapping therefore cannot swim during atmosphere exit.
    const flight = getSystemFlightSnapshot();
    const blend = atmosphereSpaceBlend(
      planetLocalCameraRadius(
        state.camera.position,
        flight.renderOrigin,
        activePlanetSystemPosition
      ),
      NOMINAL_PLANET_FACE_RADIUS
    );
    const mesh = meshRef.current;
    if (mesh) {
      mesh.position.copy(state.camera.position);
      mesh.scale.setScalar(1);
    }

    const mat = matRef.current;
    if (!mat) return;
    const q = getGraphicsQuality();
    const animated = q.animatedShaders;

    // Settled in deep space on a non-animated profile: the inSpace effect above
    // already seeded the pure cosmos and nothing changes per frame.
    if (inSpace && !animated && blend >= 1) return;

    // LOCAL day/night from the live sun direction vs the player's up, faded out
    // by the altitude blend: the day sky thins into the cosmos as you climb the
    // atmosphere-exit band (and thickens back on the way down), converging on
    // uDay=0 well before the phase flag flips. Just uniform writes per frame;
    // shader twinkle stays frozen on non-animated profiles (time = 0).
    const sun = getSunDirection();
    const up = getPlayerUp();
    updateSpaceSky(
      mat,
      animated ? state.clock.elapsedTime : 0,
      localDaylight(sun, up) * (1 - blend),
      localGolden(sun, up) * (1 - blend),
      sun,
      getMoonDirection(),
      up,
      (q.skyClouds ? 1.0 : 0.0) * (1 - blend),
      getVoxelRealityEffects(),
      getConstellationReveal()
    );
  });

  return (
    <mesh
      ref={meshRef}
      renderOrder={SPACE_DOME_RENDER_ORDER}
      frustumCulled={false}
    >
      <sphereGeometry args={[SPACE_DOME_RADIUS, 64, 32]} />
      <primitive object={material} ref={matRef} attach="material" />
    </mesh>
  );
}
