import * as THREE from 'three';
import type { TerrainGenerationConfig, TerrainProfile } from '../config/worldGeneration';
import { createTerrainConfig } from './terrainConfig';
import { seededUnit } from './worldCoordinates';

export const WORLD_PREVIEW_PLANET_RADIUS = 25;

export interface WorldPreviewTraits {
  seed: number;
  terrainConfig: TerrainGenerationConfig;
  terrainProfile: TerrainProfile;
  oceanCoverage: number;
  relief: number;
  valleyStrength: number;
  surfaceFrequency: number;
  landColor: THREE.Color;
  rockColor: THREE.Color;
  oceanColor: THREE.Color;
  atmosphereColor: THREE.Color;
  cloudColor: THREE.Color;
  iceCoverage: number;
}

export function deriveWorldPreviewTraits(
  seed: number,
  planetRadius = WORLD_PREVIEW_PLANET_RADIUS
): WorldPreviewTraits {
  const terrainConfig = createTerrainConfig(seed, planetRadius);
  const terrainProfile = terrainConfig.terrainProfile ?? 'balanced';
  const relief = clamp01(terrainConfig.heightVariation / Math.max(1, planetRadius));
  const valleyStrength = clamp01(terrainConfig.valleyDepth / Math.max(1, planetRadius));
  const oceanCoverage = clamp01(terrainConfig.seaLevelPercentile);
  const surfaceFrequency = clamp01((terrainConfig.mountainFrequency * 7) + (terrainConfig.hillFrequency * 3));
  const palette = paletteForProfile(terrainProfile, seed, oceanCoverage, relief);

  return {
    seed,
    terrainConfig,
    terrainProfile,
    oceanCoverage,
    relief,
    valleyStrength,
    surfaceFrequency,
    landColor: palette.landColor,
    rockColor: palette.rockColor,
    oceanColor: palette.oceanColor,
    atmosphereColor: palette.atmosphereColor,
    cloudColor: palette.cloudColor,
    iceCoverage: clamp01(0.9 - relief * 0.24 + seededUnit(seed, 607) * 0.08)
  };
}

export function previewSurfaceValue(normal: THREE.Vector3, traits: WorldPreviewTraits): number {
  const seedPhase = traits.seed * 0.0001;
  const primaryScale = 2.2 + traits.surfaceFrequency * 9;
  const mountainScale = 5.5 + traits.relief * 8;
  const valleyScale = 3.5 + traits.valleyStrength * 6;
  const primary = Math.sin((normal.x * 1.7 + normal.y * 2.6 + normal.z * 1.1 + seedPhase) * primaryScale);
  const mountain = Math.sin((normal.x * -2.3 + normal.y * 0.7 + normal.z * 3.1 + seedPhase * 1.7) * mountainScale);
  const valley = Math.sin((normal.x * 3.8 + normal.y * -1.2 + normal.z * 2.4 + seedPhase * 2.3) * valleyScale);
  return clamp01((primary * 0.42 + mountain * traits.relief * 0.35 - valley * traits.valleyStrength * 0.22 + 1) * 0.5);
}

function paletteForProfile(
  profile: TerrainProfile,
  seed: number,
  oceanCoverage: number,
  relief: number
) {
  const hueJitter = (seededUnit(seed, 503) - 0.5) * 0.08;
  const wetness = clamp01(oceanCoverage);
  const base = {
    landColor: new THREE.Color(),
    rockColor: new THREE.Color(),
    oceanColor: new THREE.Color().setHSL(0.55 + seededUnit(seed, 509) * 0.08, 0.72, 0.34 + wetness * 0.16),
    atmosphereColor: new THREE.Color().setHSL(0.54 + seededUnit(seed, 521) * 0.1, 0.7, 0.68),
    cloudColor: new THREE.Color().setHSL(0.58, 0.16, 0.85 + seededUnit(seed, 523) * 0.08)
  };

  if (profile === 'mountains') {
    base.landColor.setHSL(0.28 + hueJitter, 0.34, 0.42);
    base.rockColor.setHSL(0.6 + hueJitter, 0.12, 0.48 + relief * 0.12);
  } else if (profile === 'hills') {
    base.landColor.setHSL(0.28 + hueJitter, 0.58, 0.46);
    base.rockColor.setHSL(0.11 + hueJitter, 0.28, 0.42);
  } else if (profile === 'valleys') {
    base.landColor.setHSL(0.34 + hueJitter, 0.62, 0.42);
    base.rockColor.setHSL(0.08 + hueJitter, 0.28, 0.36);
  } else if (profile === 'islands') {
    base.landColor.setHSL(0.24 + hueJitter, 0.7, 0.5);
    base.rockColor.setHSL(0.1 + hueJitter, 0.36, 0.48);
    base.oceanColor.setHSL(0.52 + seededUnit(seed, 541) * 0.08, 0.78, 0.46 + wetness * 0.1);
  } else {
    base.landColor.setHSL(0.26 + hueJitter, 0.52, 0.46);
    base.rockColor.setHSL(0.12 + hueJitter, 0.22, 0.42);
  }

  return base;
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}
