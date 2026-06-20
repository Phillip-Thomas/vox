import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getGraphicsQuality } from '../config/graphicsSettings.ts';
import {
  SPACE_DOME_RADIUS,
  SPACE_DOME_RENDER_ORDER,
  createSpaceSkyMaterial,
  updateSpaceSky
} from '../utils/spaceSky.ts';
import { getSunDirection, getMoonDirection, getForcedDayPhase, DAY_LENGTH_SECONDS } from './SkyController.tsx';
import { useSpaceFlight } from '../state/spaceFlight.ts';

/** Phase (0..1) used when animation is disabled — matches SkyController midday. */
const STATIC_DAY_PHASE = 0.25;

// In deep space the dome must follow the camera (it's a skybox) AND sit beyond
// ALL scene content — the voxel planet at the origin (up to a few hundred units
// away) and the camera-relative galaxy impostors (~2400-3500). depthTest stays
// true, so scaling the radius-220 dome up to ~7000 (still inside the ship
// camera's far=8000) keeps everything correctly drawing OVER the starfield
// rather than the stars punching through the planet/impostors.
const DEEP_SPACE_DOME_SCALE = 32; // 220 * 32 ≈ 7040 world units

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/**
 * Sun elevation (normalized y) for a day phase. Mirrors SkyController's
 * applyDayPhase direction construction exactly so daylight/golden derived here
 * stay locked to the visible sun without threading a value through props.
 */
function sunElevationForPhase(phase: number): number {
  const angle = phase * Math.PI * 2;
  const dirY = Math.sin(angle);
  const dirX = Math.cos(angle) * 0.55;
  const dirZ = Math.sin(angle * 0.5) * 0.35 + 0.2;
  const len = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ) || 1;
  return dirY / len;
}

/** daylight (0..1) for a phase — matches SkyController's elevation->daylight. */
function daylightForPhase(phase: number): number {
  return smoothstep(-0.12, 0.18, sunElevationForPhase(phase));
}

/** golden-hour factor (0..1) for a phase — matches SkyController's `golden`. */
function goldenForPhase(phase: number): number {
  const elevation = sunElevationForPhase(phase);
  const daylight = smoothstep(-0.12, 0.18, elevation);
  return daylight * (1 - smoothstep(0.05, 0.32, elevation));
}

/**
 * Procedural starfield + nebula backdrop. Rendered from within SkyController's
 * JSX. Owns its own gated useFrame that reads the shared sun direction and the
 * same 240s clock so its motion/visibility stays consistent with the sky.
 */
export default function SpaceSky() {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const material = useMemo(() => createSpaceSkyMaterial(), []);
  const { phase } = useSpaceFlight();
  const inSpace = phase === 'deep_space';

  // Seed a static-midday state on mount so the first frame is correct even when
  // animation is disabled (thin daytime atmosphere over surviving cosmos).
  useMemo(() => {
    updateSpaceSky(
      material,
      0,
      daylightForPhase(STATIC_DAY_PHASE),
      goldenForPhase(STATIC_DAY_PHASE),
      getSunDirection(),
      getMoonDirection()
    );
  }, [material]);

  // In deep space the cosmos is ALWAYS fully visible. Force the dome to full
  // night (daylight=0 -> uDay=0 -> early-out) the moment we enter space, so even on profiles
  // with animatedShaders=false (which skip the per-frame update below) the stars
  // are on immediately. Restoring normal phases is handled by the useFrame path.
  useEffect(() => {
    const mat = matRef.current ?? material;
    if (!inSpace) return;
    // daylight=0 -> uDay=0 -> early-out -> pure cosmos; golden irrelevant.
    updateSpaceSky(mat, 0, 0, 0, getSunDirection(), getMoonDirection());
  }, [inSpace, material]);

  useFrame(state => {
    // Skybox placement first, every frame regardless of the animation gate: on
    // the surface the dome sits at the origin (radius 220, the planet occludes
    // its lower half); in deep space it follows the camera and scales out beyond
    // all content so the starfield is a true backdrop.
    const mesh = meshRef.current;
    if (mesh) {
      if (inSpace) {
        mesh.position.copy(state.camera.position);
        mesh.scale.setScalar(DEEP_SPACE_DOME_SCALE);
      } else if (mesh.scale.x !== 1) {
        mesh.position.set(0, 0, 0);
        mesh.scale.setScalar(1);
      }
    }

    const mat = matRef.current;
    if (!mat) return;
    const animated = getGraphicsQuality().animatedShaders;
    const forced = getForcedDayPhase();

    // Deep space: stars/nebula forced fully on (uDay=0 -> early-out) every frame regardless
    // of the day cycle. When animated, keep advancing time for twinkle/drift;
    // when not, the mount/enter-space effect already seeded full night so we can
    // skip per-frame work entirely.
    if (inSpace) {
      if (!animated) return;
      updateSpaceSky(mat, state.clock.elapsedTime, 0, 0, getSunDirection(), getMoonDirection());
      return;
    }

    if (!animated && forced === null) return; // frozen: mount seed already applied

    const dayPhase = forced ?? (state.clock.elapsedTime / DAY_LENGTH_SECONDS) % 1;
    updateSpaceSky(
      mat,
      state.clock.elapsedTime,
      daylightForPhase(dayPhase),
      goldenForPhase(dayPhase),
      getSunDirection(),
      getMoonDirection()
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
