import { useEffect, useMemo, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getGraphicsQuality } from '../config/graphicsSettings.ts';
import { useSpaceFlight } from '../state/spaceFlight.ts';
import { buildBiomeProfile } from '../utils/biomeProfile.ts';
import { localSunElevation, daylightFromElevation, goldenFromElevation } from '../utils/dayNight.ts';
import { getPlayerUp } from '../state/playerFrame.ts';
import { getPlayerSubmergence, getPlayerDepthBelow } from '../state/playerSubmersion.ts';
import SpaceSky from './SpaceSky.tsx';

// Sun/moon are ~CONSTANT directional lights so the lit/dark hemispheres are a
// permanent spatial terminator (chase-the-light); the player's LOCAL daylight
// drives the sky + ambient, not the sun's global brightness.
const SUN_INTENSITY = 1.2;
const MOON_INTENSITY = 0.6;

/**
 * Phase 2 — sky, atmosphere, day/night and fog.
 *
 * Owns the key/fill lighting (a "sun" directionalLight + moon + ambientLight),
 * scene fog, and the day/night cycle drive. The visible sky is the unified
 * SpaceSky "cosmos-through-glass" dome (it reads getSunDirection()/
 * getMoonDirection() and the daylight/golden math computed here). A slow
 * day/night cycle is driven from clock.elapsedTime. All time-driven motion is
 * gated on getGraphicsQuality().animatedShaders so LOW/POTATO profiles hold a
 * static midday with no per-frame cost.
 */

/** Length of one full day/night cycle in seconds. */
export const DAY_LENGTH_SECONDS = 240;

/** World-space distance the sun light is placed from the planet center. */
const SUN_LIGHT_RADIUS = 220;

/** Normal surface fog density (matches the initial FogExp2). Kept light so the
 *  daytime world reads crisp and colourful — 0.014 hazed the whole scene to a
 *  flat milky wash; ~0.005 gives gentle atmospheric depth without the washout. */
const SURFACE_FOG_DENSITY = 0.005;

/**
 * Thinner fog while flying the ship in-atmosphere (launch/descent). The surface
 * density is tuned for a ground-level eye height; from approach altitude it fogs
 * the long aerial sightlines to a flat wash (the same reason OverviewCamera
 * disables fog). This keeps the planet readable on approach, then full fog
 * returns the moment you're back on foot.
 */
const FLIGHT_FOG_DENSITY = 0.0022;

/** Fog density for a given flight phase (in-atmosphere flight thins it out). */
function fogDensityForPhase(phase: string): number {
  return phase === 'descent' || phase === 'launch' ? FLIGHT_FOG_DENSITY : SURFACE_FOG_DENSITY;
}

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

// The day phase currently being rendered (forced value, or the running cycle's
// live phase). Lets tools like the vantage recorder capture the ACTUAL
// time-of-day on screen, not just an explicit ?dayphase.
let liveDayPhase = forcedDayPhase ?? 0.25;
export function getCurrentDayPhase(): number {
  return forcedDayPhase ?? liveDayPhase;
}

// Offset added to the running cycle so a restored save resumes at its saved
// time-of-day (then keeps cycling). Set once at boot by persistence.
let dayPhaseOffset = 0;
export function setDayPhaseOffset(phase: number): void {
  dayPhaseOffset = ((phase % 1) + 1) % 1;
}

// Reusable scratch / palette colors (avoid per-frame allocation in useFrame).
const dayFogColor = new THREE.Color('#8fbdf2'); // was #9ec9ff — slightly deeper so the horizon doesn't wash pale
const goldenFogColor = new THREE.Color('#f0a060');
const nightFogColor = new THREE.Color('#0a1024');

const dayAmbient = new THREE.Color('#bcd4ff');
const nightAmbient = new THREE.Color('#1a2138');

const noonSun = new THREE.Color('#fff4e0');
const goldenSun = new THREE.Color('#ff9c4a');

const tmpColor = new THREE.Color();

// --- Underwater fog override -------------------------------------------------
// When the eye is submerged, blend the scene fog toward a dense blue-green by the
// submergence factor, deepening with depth. This is the CHEAP, ALL-TIERS path —
// it gives a believable underwater wash even on POTATO/LOW where there's no
// post-processing composer (the depth-based extinction pass is layered on top for
// ULTRA/HIGH). Applied over the day/night base fog so time-of-day still reads.
const UW_FOG_SHALLOW = new THREE.Color('#1d6f78'); // near-surface teal
const UW_FOG_DEEP = new THREE.Color('#062330');    // deep blue-green murk
const UW_FOG_DENSITY = 0.085;                      // dense underwater haze
const UW_DEPTH_RANGE = 26;                          // world units to reach full-deep tint
const _uwColor = new THREE.Color();

/**
 * Blend `fog` from its day/night base toward the underwater palette by
 * submergence (0 = restore base, 1 = full underwater). Pure-ish: only mutates
 * `fog` + the module scratch color. Cheap enough to run every frame on any tier.
 */
function applyWaterFog(
  fog: THREE.FogExp2,
  baseColor: THREE.Color,
  baseDensity: number,
  submergence: number,
  depthBelow: number
) {
  if (submergence <= 0.001) {
    fog.color.copy(baseColor);
    fog.density = baseDensity;
    return;
  }
  const depthT = THREE.MathUtils.clamp(depthBelow / UW_DEPTH_RANGE, 0, 1);
  _uwColor.copy(UW_FOG_SHALLOW).lerp(UW_FOG_DEEP, depthT);
  fog.color.copy(baseColor).lerp(_uwColor, submergence);
  fog.density = THREE.MathUtils.lerp(baseDensity, UW_FOG_DENSITY, submergence);
}

// --- Deep-space mode palette -------------------------------------------------
// In deep space we want true black void (no blue atmospheric haze, no fog
// washing out distant impostors) plus a steady cool key light so the
// MeshStandard ship/cockpit reads. These are space-only; the day/night cycle is
// untouched in every other phase.
const SPACE_FOG_COLOR = new THREE.Color('#000008'); // near-black void
const SPACE_FOG_DENSITY = 0.00002;                  // effectively no fog (impostors stay crisp)
const SPACE_SUN_COLOR = new THREE.Color('#dfe6ff'); // cool starlight key
const SPACE_SUN_INTENSITY = 1.1;
const SPACE_AMBIENT_COLOR = new THREE.Color('#26304d');
const SPACE_AMBIENT_INTENSITY = 0.32;

/**
 * Force the fog/lighting into deep-space mode. Collapses fog to a near-zero black
 * void so distant impostors aren't fogged out, and gives the scene a steady cool
 * key light (SpaceSky owns the starfield, forced to full cosmos via daylight=0).
 * No per-frame allocation.
 */
function applySpaceMode(
  sunLight: THREE.DirectionalLight,
  moonLight: THREE.DirectionalLight,
  ambient: THREE.AmbientLight,
  fog: THREE.FogExp2
) {
  // Steady cool key light from the existing "sun" direction (whatever it last
  // held); castShadow stays false (set in JSX). Not dimmed to the night floor.
  sunLight.intensity = SPACE_SUN_INTENSITY;
  sunLight.color.copy(SPACE_SUN_COLOR);

  // No second light source needed in the void.
  moonLight.intensity = 0;

  ambient.intensity = SPACE_AMBIENT_INTENSITY;
  ambient.color.copy(SPACE_AMBIENT_COLOR);

  // Black void + (near) zero fog density so impostors at distance stay visible.
  fog.color.copy(SPACE_FOG_COLOR);
  fog.density = SPACE_FOG_DENSITY;
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
  fog: THREE.FogExp2
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

  // LOCAL daylight: the sun's elevation relative to the PLAYER's up (the sun
  // lights the hemisphere it faces). The terminator is a real, walkable boundary
  // that also sweeps as the sun rotates — chase the light or the dark.
  const elevation = localSunElevation(sunDirection, getPlayerUp());
  const daylight = daylightFromElevation(elevation);
  const golden = goldenFromElevation(elevation);

  // --- Sun (directional) light ---
  // CONSTANT: the sun always shines, so the lit hemisphere is permanent and N·L
  // gives the day/night terminator on terrain. The player's local daylight drives
  // the sky + ambient below, NOT the sun's brightness.
  sunLight.intensity = SUN_INTENSITY;
  tmpColor.copy(noonSun).lerp(goldenSun, golden * 0.85);
  sunLight.color.copy(tmpColor);

  // --- Moon (directional) light: lights the anti-sun (night) hemisphere ---
  // Also ~constant; N·L keeps it off the day side, so the far side reads cool-night.
  moonDirection.copy(sunDirection).multiplyScalar(-1).add(MOON_TILT).normalize();
  moonLight.position.copy(moonDirection).multiplyScalar(SUN_LIGHT_RADIUS);
  moonLight.intensity = MOON_INTENSITY;
  moonLight.color.copy(moonColor);

  // --- Ambient (fill) light: LOCAL — dark on the player's night side, lifted by day.
  ambient.intensity = 0.14 + daylight * 0.46;
  ambient.color.copy(nightAmbient).lerp(dayAmbient, daylight);

  // --- Fog color: night navy -> day blue, warming at golden hour ---
  tmpColor.copy(nightFogColor).lerp(dayFogColor, daylight);
  tmpColor.lerp(goldenFogColor, golden * 0.8);
  fog.color.copy(tmpColor);
  // Restore normal atmospheric depth (deep-space mode collapses this to ~0).
  fog.density = SURFACE_FOG_DENSITY;

  // The visible sky (atmosphere + cosmos) is the SpaceSky dome; it reads
  // getSunDirection()/getMoonDirection() and mirrors this daylight/golden math
  // for its uDay/uGolden uniforms, so no Preetham uniforms to drive here.

  return { sunDirection, daylight, golden };
}

interface SkyControllerProps {
  /** Current planet seed — drives a SUBTLE per-biome fog tint + density so each
   *  world's atmosphere feels distinct (Phase 1 cohesion). */
  terrainSeed?: number;
}

// Subtle per-biome fog: a low-saturation atmosphere tint + small density variation,
// so planets differ without the fog ever becoming heavy. Derived once per seed.
const FOG_BIOME_MIX = 0.16; // how far the time-of-day fog lerps toward the biome tint
function biomeFog(terrainSeed: number): { tint: THREE.Color; densityMul: number } {
  const b = buildBiomeProfile(terrainSeed);
  // Alien worlds tint toward their vegetation hue; otherwise a gentle warm(arid)/
  // cool(cold) shift by temperature. Low saturation keeps it subtle.
  const hue = b.alien ? b.hue : (0.06 + b.temperature * 0.12);
  const tint = new THREE.Color().setHSL(hue, 0.16 + b.aridity * 0.12, 0.62);
  // Lush worlds a touch hazier, arid/sparse crisper (0.8 .. ~1.3).
  const densityMul = 0.8 + b.lushness * 0.5;
  return { tint, densityMul };
}

export default function SkyController({ terrainSeed = 0 }: SkyControllerProps) {
  const scene = useThree(state => state.scene);
  const { phase } = useSpaceFlight();
  const inSpace = phase === 'deep_space';

  const fogBiome = useMemo(() => biomeFog(terrainSeed), [terrainSeed]);

  const sunLightRef = useRef<THREE.DirectionalLight>(null);
  const moonLightRef = useRef<THREE.DirectionalLight>(null);
  const ambientRef = useRef<THREE.AmbientLight>(null);

  // FogExp2 gives cheap exponential atmospheric depth across the ~50u planet.
  // ~0.014 keeps the planet clearly visible while still reading depth.
  const fog = useMemo(() => new THREE.FogExp2('#9ec9ff', SURFACE_FOG_DENSITY), []);
  // The day/night fog BEFORE the underwater override, captured each update so the
  // submerged blend always lerps from the correct base (and restores it on
  // surfacing) — needed on non-animated tiers where the base isn't recomputed.
  const baseFogColor = useRef(new THREE.Color('#9ec9ff'));
  const baseFogDensity = useRef(SURFACE_FOG_DENSITY);

  useEffect(() => {
    const previousFog = scene.fog;
    scene.fog = fog;
    return () => {
      scene.fog = previousFog;
    };
  }, [scene, fog]);

  // Apply the correct mode once on mount / whenever the space<->surface boundary
  // is crossed, so the first frame is right even on profiles with
  // animatedShaders=false (which skip the per-frame update below). In deep space
  // we collapse the atmosphere/fog and switch to the steady space key light; in
  // every other phase we restore the static-midday day/night state.
  useEffect(() => {
    const sunLight = sunLightRef.current;
    const moonLight = moonLightRef.current;
    const ambient = ambientRef.current;
    if (!sunLight || !moonLight || !ambient) return;
    if (inSpace) {
      applySpaceMode(sunLight, moonLight, ambient, fog);
      return;
    }
    liveDayPhase = forcedDayPhase ?? STATIC_DAY_PHASE;
    const r = applyDayPhase(liveDayPhase, sunLight, moonLight, ambient, fog);
    fog.color.lerp(fogBiome.tint, FOG_BIOME_MIX * (0.45 + 0.55 * r.daylight));
    fog.density = fogDensityForPhase(phase) * fogBiome.densityMul;
    baseFogColor.current.copy(fog.color);
    baseFogDensity.current = fog.density;
    applyWaterFog(fog, baseFogColor.current, baseFogDensity.current, getPlayerSubmergence(), getPlayerDepthBelow());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inSpace, phase, fogBiome]);

  useFrame(state => {
    const sunLight = sunLightRef.current;
    const moonLight = moonLightRef.current;
    const ambient = ambientRef.current;
    if (!sunLight || !moonLight || !ambient) return;

    const animated = getGraphicsQuality().animatedShaders;

    // Deep space: always-on space backdrop, atmosphere/fog collapsed, steady key
    // light — held regardless of the day cycle AND regardless of animatedShaders.
    // The boundary effect above already applied it; the (static) values don't
    // change per frame, so non-animated profiles need no per-frame work, and
    // animated profiles only need a cheap re-assert to win over any stale state.
    if (inSpace) {
      if (!animated) return;
      applySpaceMode(sunLight, moonLight, ambient, fog);
      return;
    }

    // When not animated, the static mount/boundary effect already set the base
    // day/night fog; we still blend the underwater override over it each frame
    // (submergence changes per frame), then skip the rest. (SpaceSky owns its own
    // gated useFrame.)
    if (!animated) {
      applyWaterFog(fog, baseFogColor.current, baseFogDensity.current, getPlayerSubmergence(), getPlayerDepthBelow());
      return;
    }

    const dayPhase = forcedDayPhase ?? ((state.clock.elapsedTime / DAY_LENGTH_SECONDS) + dayPhaseOffset) % 1;
    liveDayPhase = dayPhase;
    const r = applyDayPhase(dayPhase, sunLight, moonLight, ambient, fog);
    fog.color.lerp(fogBiome.tint, FOG_BIOME_MIX * (0.45 + 0.55 * r.daylight));
    fog.density = fogDensityForPhase(phase) * fogBiome.densityMul;
    baseFogColor.current.copy(fog.color);
    baseFogDensity.current = fog.density;
    applyWaterFog(fog, baseFogColor.current, baseFogDensity.current, getPlayerSubmergence(), getPlayerDepthBelow());
  });

  return (
    <>
      <SpaceSky terrainSeed={terrainSeed} />
      <directionalLight ref={sunLightRef} castShadow={false} intensity={1} />
      <directionalLight ref={moonLightRef} castShadow={false} intensity={0} />
      <ambientLight ref={ambientRef} intensity={0.5} />
    </>
  );
}
