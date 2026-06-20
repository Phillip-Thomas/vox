import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getGraphicsQuality } from '../config/graphicsSettings.ts';
import {
  SPACE_DOME_RADIUS,
  SPACE_DOME_RENDER_ORDER,
  createSpaceSkyMaterial,
  updateSpaceSky
} from '../utils/spaceSky.ts';
import { getSunDirection, DAY_LENGTH_SECONDS } from './SkyController.tsx';

/** Phase (0..1) used when animation is disabled — matches SkyController midday. */
const STATIC_DAY_PHASE = 0.25;

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/**
 * Recompute the daylight factor for a given day phase. This mirrors
 * SkyController's applyDayPhase elevation->daylight mapping exactly so the star
 * fade stays locked to the visible sun without SkyController having to thread a
 * value down through props/context.
 */
function daylightForPhase(phase: number): number {
  const angle = phase * Math.PI * 2;
  const dirY = Math.sin(angle);
  // applyDayPhase normalizes a 3D direction; only the elevation (y) matters here
  // and normalization preserves its sign and the smoothstep edges chosen below.
  const dirX = Math.cos(angle) * 0.55;
  const dirZ = Math.sin(angle * 0.5) * 0.35 + 0.2;
  const len = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ) || 1;
  const elevation = dirY / len;
  return smoothstep(-0.12, 0.18, elevation);
}

/**
 * Procedural starfield + nebula backdrop. Rendered from within SkyController's
 * JSX. Owns its own gated useFrame that reads the shared sun direction and the
 * same 240s clock so its motion/visibility stays consistent with the sky.
 */
export default function SpaceSky() {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const material = useMemo(() => createSpaceSkyMaterial(), []);

  // Seed a static-midday state on mount so the first frame is correct even when
  // animation is disabled (stars effectively absent at midday -> uNight ~ 0).
  useMemo(() => {
    updateSpaceSky(material, 0, daylightForPhase(STATIC_DAY_PHASE), getSunDirection());
  }, [material]);

  useFrame(state => {
    const mat = matRef.current;
    if (!mat) return;
    const animated = getGraphicsQuality().animatedShaders;
    if (!animated) return; // frozen: mount seed already applied

    const phase = (state.clock.elapsedTime / DAY_LENGTH_SECONDS) % 1;
    updateSpaceSky(mat, state.clock.elapsedTime, daylightForPhase(phase), getSunDirection());
  });

  return (
    <mesh
      renderOrder={SPACE_DOME_RENDER_ORDER}
      frustumCulled={false}
    >
      <sphereGeometry args={[SPACE_DOME_RADIUS, 64, 32]} />
      <primitive object={material} ref={matRef} attach="material" />
    </mesh>
  );
}
