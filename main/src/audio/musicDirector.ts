import type { AppPhase } from '../state/appState.ts';
import type { ControlMode, FlightPhase } from '../state/spaceFlight.ts';
import type { PlanetProfile } from '../game/PlanetProfile.ts';
import type { MusicLayerId } from './musicCatalog.ts';
import type { ProceduralMusicTargets, TransitionCue } from './musicEngine.ts';

export type MusicScene =
  | 'menu'
  | 'surface'
  | 'surfaceShip'
  | 'launch'
  | 'deepSpace'
  | 'approach'
  | 'descent';

export interface MusicMix {
  layers: Partial<Record<MusicLayerId, number>>;
  procedural: ProceduralMusicTargets;
  fadeSeconds: number;
}

export interface PlanetMusicMood {
  lush: number;
  ocean: number;
  arid: number;
  cold: number;
  volcanic: number;
  crystal: number;
  metallic: number;
  fungal: number;
  anomaly: number;
}

export const NEUTRAL_PLANET_MOOD: PlanetMusicMood = {
  lush: 0,
  ocean: 0,
  arid: 0,
  cold: 0,
  volcanic: 0,
  crystal: 0,
  metallic: 0,
  fungal: 0,
  anomaly: 0
};

const EMPTY_PROCEDURAL: ProceduralMusicTargets = {
  pulse: 0,
  ship: 0,
  warp: 0,
  life: 0,
  wind: 0,
  glass: 0,
  rumble: 0,
  water: 0,
  night: 0
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function weight(profile: PlanetProfile, id: keyof PlanetProfile['biomeWeights']): number {
  return profile.biomeWeights[id] ?? 0;
}

export function resolvePlanetMusicMood(profile: PlanetProfile): PlanetMusicMood {
  return {
    lush: clamp01(
      (profile.archetype === 'verdant' ? 0.7 : 0) +
      profile.palette.saturation * 0.16 +
      weight(profile, 'forest') * 0.18 +
      weight(profile, 'grassland') * 0.12
    ),
    ocean: clamp01((profile.archetype === 'oceanic' ? 0.78 : 0) + weight(profile, 'coast') * 0.28),
    arid: clamp01((profile.archetype === 'arid' ? 0.82 : 0) + weight(profile, 'mesa') * 0.22),
    cold: clamp01((profile.archetype === 'frozen' ? 0.82 : 0) + weight(profile, 'highland') * 0.18),
    volcanic: clamp01((profile.archetype === 'volcanic' ? 0.86 : 0) + weight(profile, 'volcanic_scar') * 0.22),
    crystal: clamp01((profile.archetype === 'crystal' ? 0.84 : 0) + weight(profile, 'crystal_field') * 0.24),
    metallic: profile.archetype === 'metallic' ? 0.9 : 0,
    fungal: profile.archetype === 'fungal' ? 0.86 : 0,
    anomaly: profile.archetype === 'anomaly' ? 0.95 : 0
  };
}

export function resolveMusicScene(
  appPhase: AppPhase,
  flightPhase: FlightPhase,
  controlMode: ControlMode
): MusicScene {
  if (appPhase === 'menu') return 'menu';
  if (flightPhase === 'deep_space') return 'deepSpace';
  if (flightPhase === 'approach') return 'approach';
  if (flightPhase === 'descent') return 'descent';
  if (flightPhase === 'launch') return 'launch';
  if (flightPhase === 'surface' && controlMode === 'flight') return 'surfaceShip';
  return 'surface';
}

export function transitionCueForScene(
  previous: MusicScene,
  next: MusicScene
): TransitionCue | null {
  if (previous === next) return null;
  if (next === 'deepSpace' || next === 'launch') return 'space';
  if (next === 'approach' || next === 'descent') return 'atmosphere';
  if (next === 'surface' || next === 'surfaceShip') return 'surface';
  return 'menu';
}

export function resolveMusicMix(
  scene: MusicScene,
  warpIntensity: number,
  mood: PlanetMusicMood = NEUTRAL_PLANET_MOOD,
  daylight = 1
): MusicMix {
  const intensity = clamp01(warpIntensity);
  const day = clamp01(daylight);
  const base = baseMixForScene(scene, mood, day);
  const duck = 1 - intensity * 0.38;
  const layers: Partial<Record<MusicLayerId, number>> = {};

  for (const [id, gain] of Object.entries(base.layers) as Array<[MusicLayerId, number]>) {
    layers[id] = gain * duck;
  }

  layers.warp = Math.max(base.layers.warp ?? 0, intensity * 0.34);

  return {
    layers,
    procedural: {
      pulse: base.procedural.pulse * duck + intensity * 0.08,
      ship: base.procedural.ship * duck,
      warp: Math.max(base.procedural.warp, intensity),
      life: base.procedural.life * duck,
      wind: base.procedural.wind * duck,
      glass: base.procedural.glass * duck,
      rumble: base.procedural.rumble * duck,
      water: base.procedural.water * duck,
      night: base.procedural.night * duck
    },
    fadeSeconds: intensity > 0 ? 0.18 : base.fadeSeconds
  };
}

function baseMixForScene(scene: MusicScene, mood: PlanetMusicMood, daylight: number): MusicMix {
  const night = 1 - daylight;
  const gentle = clamp01(mood.lush * 0.75 + mood.ocean * 0.45 + mood.fungal * 0.28);
  const strange = clamp01(
    mood.anomaly * 0.9 +
    mood.crystal * 0.46 +
    mood.metallic * 0.38 +
    mood.volcanic * 0.34
  );
  const harsh = clamp01(mood.arid * 0.55 + mood.volcanic * 0.7 + mood.metallic * 0.46 + mood.anomaly * 0.62);

  const shimmer = 0.045 + gentle * daylight * 0.11 + mood.ocean * 0.07 + mood.crystal * 0.08 + night * 0.045;
  const surfaceAccent = clamp01(
    0.018 +
    mood.arid * 0.08 +
    mood.cold * 0.035 +
    strange * 0.09 +
    harsh * 0.045 +
    night * 0.055 -
    gentle * daylight * 0.07
  );

  // Keep planet identity in the sourced music layers for now. Continuous generated
  // oscillator/noise beds read as static or fixed tones over long play sessions.
  const biomeProcedural = EMPTY_PROCEDURAL;

  switch (scene) {
    case 'menu':
      return {
        layers: { menu: 0.44, shimmer: 0.12 },
        procedural: EMPTY_PROCEDURAL,
        fadeSeconds: 2.8
      };
    case 'surface':
      return {
        layers: {
          surface: surfaceAccent,
          shimmer,
          warp: strange * 0.018 + mood.volcanic * 0.012
        },
        procedural: biomeProcedural,
        fadeSeconds: 3.0
      };
    case 'surfaceShip':
      return {
        layers: { surface: surfaceAccent * 0.8, shimmer: shimmer * 1.05 },
        procedural: { ...biomeProcedural, pulse: 0.025, ship: 0.16 },
        fadeSeconds: 1.8
      };
    case 'launch':
      return {
        layers: {
          surface: surfaceAccent * 0.55,
          deepSpace: 0.18,
          shimmer: shimmer * 1.15
        },
        procedural: { ...biomeProcedural, pulse: 0.07, ship: 0.2 },
        fadeSeconds: 1.6
      };
    case 'deepSpace':
      return {
        layers: { deepSpace: 0.38, shimmer: 0.16 },
        procedural: { ...EMPTY_PROCEDURAL, pulse: 0.085, ship: 0.13 },
        fadeSeconds: 2.6
      };
    case 'approach':
      return {
        layers: {
          deepSpace: 0.18,
          surface: surfaceAccent * 0.8,
          shimmer: shimmer * 1.05,
          warp: 0.035 + strange * 0.04
        },
        procedural: { ...biomeProcedural, pulse: 0.055, ship: 0.14, warp: 0.05 },
        fadeSeconds: 1.6
      };
    case 'descent':
      return {
        layers: {
          deepSpace: 0.1,
          surface: surfaceAccent,
          shimmer,
          warp: 0.025 + strange * 0.03
        },
        procedural: { ...biomeProcedural, pulse: 0.04, ship: 0.12, warp: 0.03 },
        fadeSeconds: 1.8
      };
  }
}
