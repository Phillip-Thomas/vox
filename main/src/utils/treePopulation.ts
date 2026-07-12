import type { QualityProfile } from '../config/graphicsSettings.ts';
import { MaterialType } from '../types/materials.ts';
import type { PlanetArtDirection } from './planetArtDirection.ts';
import { isMaterialEligibleForEcology } from './planetEcology.ts';
import { seededVoxelUnit } from './seededHash.ts';

export const MAX_TREE_VARIANTS = 4;

const VARIANT_LIMIT_BY_QUALITY: Record<QualityProfile, number> = {
  ULTRA: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
  POTATO: 0
};

const VARIANT_SALT = 1401;
const VIGOR_A_SALT = 1402;
const VIGOR_B_SALT = 1403;
const WIDTH_SALT = 1404;
const ASYMMETRY_SALT = 1405;
const LEAN_SALT = 1406;
const LEAN_AZIMUTH_SALT = 1407;
// Preserve the legacy grass-tree placement stream so existing harvested coords
// remain meaningful; ecology now gates/scales that same deterministic field.
const PLACEMENT_SALT = 7;

export interface TreePlacementVoxel {
  material: string;
  supportsSurfaceResources?: boolean;
}

/** Caller-owned output for allocation-free instance variation sampling. */
export interface TreeInstanceVariation {
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  leanRadians: number;
  leanAzimuth: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Resolve a requested archetype count against a small quality-specific budget. */
export function resolveTreeVariantCount(
  quality: QualityProfile,
  requestedCount?: number
): number {
  const qualityLimit = VARIANT_LIMIT_BY_QUALITY[quality];
  const requested = requestedCount === undefined || !Number.isFinite(requestedCount)
    ? qualityLimit
    : Math.trunc(requestedCount);
  return clamp(requested, 0, Math.min(MAX_TREE_VARIANTS, qualityLimit));
}

/** Stable voxel-to-archetype assignment. Returns -1 when no variants are active. */
export function treeVariantIndexForVoxel(
  x: number,
  y: number,
  z: number,
  terrainSeed: number,
  variantCount: number
): number {
  const count = Number.isFinite(variantCount)
    ? clamp(Math.trunc(variantCount), 0, MAX_TREE_VARIANTS)
    : 0;
  if (count === 0) return -1;
  return Math.min(count - 1, Math.floor(seededVoxelUnit(x, y, z, VARIANT_SALT, terrainSeed) * count));
}

/**
 * Write a correlated phenotype into `target` without allocating. A shared vigor
 * signal makes tall trees broader while reducing their maximum lean; independent
 * width/asymmetry samples keep the result from collapsing back to uniform scale.
 */
export function writeTreeInstanceVariation(
  x: number,
  y: number,
  z: number,
  terrainSeed: number,
  target: TreeInstanceVariation
): TreeInstanceVariation {
  const vigor = (
    seededVoxelUnit(x, y, z, VIGOR_A_SALT, terrainSeed) +
    seededVoxelUnit(x, y, z, VIGOR_B_SALT, terrainSeed)
  ) * 0.5;
  const widthNoise = seededVoxelUnit(x, y, z, WIDTH_SALT, terrainSeed) - 0.5;
  const asymmetry = (seededVoxelUnit(x, y, z, ASYMMETRY_SALT, terrainSeed) - 0.5) * 0.08;
  const radialScale = 0.86 + vigor * 0.34 + widthNoise * 0.12;
  const leanDrive = seededVoxelUnit(x, y, z, LEAN_SALT, terrainSeed);

  target.scaleX = radialScale * (1 + asymmetry);
  target.scaleY = 0.82 + vigor * 0.58;
  target.scaleZ = radialScale * (1 - asymmetry);
  target.leanRadians = clamp(
    (0.01 + leanDrive * leanDrive * 0.105) * (1.35 - vigor * 0.65),
    0,
    0.155
  );
  target.leanAzimuth = seededVoxelUnit(
    x,
    y,
    z,
    LEAN_AZIMUTH_SALT,
    terrainSeed
  ) * Math.PI * 2;
  return target;
}

export function isTreePlacementEligible(
  voxel: TreePlacementVoxel,
  artDirection: PlanetArtDirection
): boolean {
  return voxel.supportsSurfaceResources !== false && isMaterialEligibleForEcology(
    artDirection,
    'trees',
    voxel.material as MaterialType
  );
}

function treeMaterialDensityMultiplier(material: string, richness: number): number {
  if (material === MaterialType.GRASS) return 1;
  if (material === MaterialType.DIRT) return 0.48 + richness * 0.22;
  if (material === MaterialType.SAND) return 0.28 + (1 - richness) * 0.18;
  if (material === MaterialType.ICE) return 0.16 + richness * 0.14;
  // Future ecology contracts can opt unusual surfaces in without silently
  // producing grass-level forests on them.
  return 0.2;
}

/** Effective per-voxel tree probability after ecology and shape-density biases. */
export function treePlacementChance(
  baseDensity: number,
  voxel: TreePlacementVoxel,
  artDirection: PlanetArtDirection
): number {
  if (baseDensity <= 0 || !isTreePlacementEligible(voxel, artDirection)) return 0;

  const richness = clamp(artDirection.ecology.richness, 0, 1);
  const canopyScale = clamp(artDirection.shape.canopyScale, 0, 1);
  const negativeSpace = clamp(artDirection.shape.negativeSpace, 0, 1);
  // Graphics-profile density is already tuned against the atlas triangle budget;
  // ecology may thin it substantially but never amplify the lushest case above
  // that authored ceiling.
  const ecologyDensity = 0.38 + richness * 0.58;
  const canopyDensity = 0.7 + canopyScale * 0.3;
  const spacingDensity = 1 - negativeSpace * 0.35;
  const materialDensity = treeMaterialDensityMultiplier(voxel.material, richness);

  return clamp(
    baseDensity * ecologyDensity * canopyDensity * spacingDensity * materialDensity,
    0,
    1
  );
}

/** Deterministic placement decision using the ecology-adjusted probability. */
export function shouldPlaceTreeAtVoxel(
  voxel: TreePlacementVoxel,
  x: number,
  y: number,
  z: number,
  baseDensity: number,
  terrainSeed: number,
  artDirection: PlanetArtDirection
): boolean {
  const chance = treePlacementChance(baseDensity, voxel, artDirection);
  return chance > 0 && seededVoxelUnit(x, y, z, PLACEMENT_SALT, terrainSeed) < chance;
}
