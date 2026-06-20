import { useEffect, useMemo, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Sky } from '@react-three/drei';
import { Sky as SkyImpl } from 'three-stdlib';
import * as THREE from 'three';
import { getGraphicsQuality } from '../config/graphicsSettings.ts';
import SpaceSky from './SpaceSky.tsx';

/**
 * Phase 2 — sky, atmosphere, day/night and fog.
 *
 * Owns the visible sky dome (drei <Sky>), the key/fill lighting (a "sun"
 * directionalLight + ambientLight), scene fog, and a starfield. A slow
 * day/night cycle is driven from clock.elapsedTime. All time-driven motion is
 * gated on getGraphicsQuality().animatedShaders so LOW/POTATO profiles hold a
 * static midday with no per-frame cost.
 */

/** Length of one full day/night cycle in seconds. */
export const DAY_LENGTH_SECONDS = 240;

/** World-space distance the sun light is placed from the planet center. */
const SUN_LIGHT_RADIUS = 220;

/** Phase (0..1) used when animation is disabled — midday. */
const STATIC_DAY_PHASE = 0.25;

// ---------------------------------------------------------------------------
// Shared sun direction. Later phases (e.g. Phase 4 water fresnel) read this to
// keep specular highlights aligned with the visible sun.
// ---------------------------------------------------------------------------
const sunDirection = new THREE.Vector3(0, 1, 0);

/**
 * Current sun direction in world space (normalized, points from the planet
 * toward the sun). Returns a reference to a shared module-level vector; copy it
 * if you need to retain the value. Reusable across phases.
 */
export function getSunDirection(): THREE.Vector3 {
  return sunDirection;
}

// Moon direction (world space, points from planet toward the moon). The moon
// rides roughly opposite the sun so it is up exactly when the sun has set,
// lighting the night. Shared like sunDirection so water/sky can read it.
const moonDirection = new THREE.Vector3(0, -1, 0);

/** Current moon direction in world space (normalized). Shared module vector. */
export function getMoonDirection(): THREE.Vector3 {
  return moonDirection;
}

// Slight tilt so the moon's arc isn't a perfect mirror of the sun's.
const MOON_TILT = new THREE.Vector3(0.15, 0.0, -0.22);
const moonColor = new THREE.Color('#aebfe8'); // cool moonlight

// Debug: ?dayphase=0.75 freezes the day cycle at a phase (0=sunrise, .25=noon,
// .5=sunset, .75=midnight) so the night sky/moon can be inspected immediately.
const forcedDayPhase: number | null = (() => {
  try {
    const v = new URLSearchParams(window.location.search).get('dayphase');
    if (v === null) return null;
    const f = parseFloat(v);
    return Number.isFinite(f) ? ((f % 1) + 1) % 1 : null;
  } catch {
    return null;
  }
})();

/** Forced day phase from ?dayphase=, or null when the cycle runs normally. */
export function getForcedDayPhase(): number | null {
  return forcedDayPhase;
}

// Reusable scratch / palette colors (avoid per-frame allocation in useFrame).
const dayFogColor = new THREE.Color('#9ec9ff');
const goldenFogColor = new THREE.Color('#f0a060');
const nightFogColor = new THREE.Color('#0a1024');

const dayAmbient = new THREE.Color('#bcd4ff');
const nightAmbient = new THREE.Color('#1a2138');

const noonSun = new THREE.Color('#fff4e0');
const goldenSun = new THREE.Color('#ff9c4a');
const nightSun = new THREE.Color('#2a3a6a');

const tmpColor = new THREE.Color();

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/**
 * Resolve all time-of-day driven values from a day phase in [0,1).
 *  phase 0.00 = sunrise (sun on the horizon, east)
 *  phase 0.25 = noon (sun overhead)
 *  phase 0.50 = sunset (horizon, west)
 *  phase 0.75 = midnight (sun fully below)
 */
function applyDayPhase(
  phase: number,
  sunLight: THREE.DirectionalLight,
  moonLight: THREE.DirectionalLight,
  ambient: THREE.AmbientLight,
  fog: THREE.FogExp2,
  sky: SkyImpl | null
) {
  const angle = phase * Math.PI * 2;
  // Sun travels a vertical great circle: up at noon, down at midnight.
  // Using a world-space arc; the player walks all six cube faces, so this is a
  // global light direction rather than anything tied to a per-player "up".
  const dirX = Math.cos(angle) * 0.55;
  const dirY = Math.sin(angle);
  const dirZ = Math.sin(angle * 0.5) * 0.35 + 0.2;
  sunDirection.set(dirX, dirY, dirZ).normalize();

  sunLight.position
    .copy(sunDirection)
    .multiplyScalar(SUN_LIGHT_RADIUS);

  // Daylight factor: 1 when sun is high, 0 once it is below the horizon.
  const elevation = sunDirection.y; // -1..1
  const daylight = smoothstep(-0.12, 0.18, elevation);
  // Golden factor: peaks when the sun is near the horizon during the day.
  const golden = daylight * (1 - smoothstep(0.05, 0.32, elevation));

  // --- Sun (directional) light ---
  // Low night floor (~0.03) so night light comes from the MOON (cool), not a
  // weird warm sun-from-below glow.
  sunLight.intensity = 0.03 + daylight * 1.17;
  tmpColor.copy(nightSun).lerp(noonSun, daylight);
  tmpColor.lerp(goldenSun, golden * 0.85);
  sunLight.color.copy(tmpColor);

  // --- Moon (directional) light: rises as the sun sets, lighting the night ---
  // Roughly anti-sun (so it's up at night) with a slight tilt; rendered as a
  // self-lit full moon by SpaceSky, so we light the world from its direction.
  moonDirection.copy(sunDirection).multiplyScalar(-1).add(MOON_TILT).normalize();
  moonLight.position.copy(moonDirection).multiplyScalar(SUN_LIGHT_RADIUS);
  const night = 1.0 - daylight;
  // Fade in only once the moon is actually above the horizon.
  const moonUp = smoothstep(-0.05, 0.25, moonDirection.y);
  moonLight.intensity = night * moonUp * 0.45;
  moonLight.color.copy(moonColor);

  // --- Ambient (fill) light ---
  ambient.intensity = 0.18 + daylight * 0.42;
  ambient.color.copy(nightAmbient).lerp(dayAmbient, daylight);

  // --- Fog color: night navy -> day blue, warming at golden hour ---
  tmpColor.copy(nightFogColor).lerp(dayFogColor, daylight);
  tmpColor.lerp(goldenFogColor, golden * 0.8);
  fog.color.copy(tmpColor);

  // --- Atmospheric dome: collapse the Preetham scattering as night falls so the
  // sky goes genuinely dark and the custom star dome (SpaceSky) dominates. The
  // drei <Sky> never reaches black on its own; scaling rayleigh/turbidity toward
  // tiny values drains its brightness while keeping a normal blue day + golden
  // hour. The sun uniform is positioned elsewhere (useFrame / mount). ---
  if (sky) {
    const u = sky.material.uniforms;
    // Day: full atmosphere. Night: nearly none (a faint floor avoids artifacts).
    u.rayleigh.value = 0.06 + daylight * 2.94;       // ~3 day -> ~0.06 night
    u.turbidity.value = 0.4 + daylight * 9.6;        // ~10 day -> ~0.4 night
    u.mieCoefficient.value = 0.002 + daylight * 0.003;
    u.mieDirectionalG.value = 0.8;
  }

  return { sunDirection, daylight };
}

export default function SkyController() {
  const scene = useThree(state => state.scene);

  const skyRef = useRef<SkyImpl>(null);
  const sunLightRef = useRef<THREE.DirectionalLight>(null);
  const moonLightRef = useRef<THREE.DirectionalLight>(null);
  const ambientRef = useRef<THREE.AmbientLight>(null);

  // FogExp2 gives cheap exponential atmospheric depth across the ~50u planet.
  // ~0.014 keeps the planet clearly visible while still reading depth.
  const fog = useMemo(() => new THREE.FogExp2('#9ec9ff', 0.014), []);

  // Sun position handed to <Sky>. We rotate the actual SkyImpl uniform in
  // useFrame, but seed it at a representative value so the initial frame looks
  // right before useFrame runs.
  const initialSunPosition = useMemo<[number, number, number]>(
    () => [
      sunDirection.x * 100,
      sunDirection.y * 100,
      sunDirection.z * 100
    ],
    []
  );

  useEffect(() => {
    const previousFog = scene.fog;
    scene.fog = fog;
    return () => {
      scene.fog = previousFog;
    };
  }, [scene, fog]);

  // Apply a static midday state once on mount so the first frame is correct
  // even if animation is disabled.
  useEffect(() => {
    const sunLight = sunLightRef.current;
    const moonLight = moonLightRef.current;
    const ambient = ambientRef.current;
    if (!sunLight || !moonLight || !ambient) return;
    applyDayPhase(forcedDayPhase ?? STATIC_DAY_PHASE, sunLight, moonLight, ambient, fog, skyRef.current);
    const skyMat = skyRef.current?.material;
    if (skyMat) {
      (skyMat.uniforms.sunPosition.value as THREE.Vector3)
        .copy(sunDirection)
        .multiplyScalar(100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame(state => {
    const sunLight = sunLightRef.current;
    const moonLight = moonLightRef.current;
    const ambient = ambientRef.current;
    if (!sunLight || !moonLight || !ambient) return;

    const animated = getGraphicsQuality().animatedShaders;

    // When not animated, the static mount effect already set everything; skip
    // per-frame work entirely. (SpaceSky owns its own gated useFrame.)
    if (!animated) return;

    const phase = forcedDayPhase ?? (state.clock.elapsedTime / DAY_LENGTH_SECONDS) % 1;
    applyDayPhase(phase, sunLight, moonLight, ambient, fog, skyRef.current);

    // Drive the <Sky> shader's sun uniform to match.
    const skyMat = skyRef.current?.material;
    if (skyMat) {
      (skyMat.uniforms.sunPosition.value as THREE.Vector3)
        .copy(sunDirection)
        .multiplyScalar(100);
    }
  });

  return (
    <>
      <Sky ref={skyRef} sunPosition={initialSunPosition} />
      <SpaceSky />
      <directionalLight ref={sunLightRef} castShadow={false} intensity={1} />
      <directionalLight ref={moonLightRef} castShadow={false} intensity={0} />
      <ambientLight ref={ambientRef} intensity={0.5} />
    </>
  );
}
