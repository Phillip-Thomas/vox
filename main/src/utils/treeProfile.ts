import * as THREE from 'three';
import { seededUnit } from './worldCoordinates';
import { DEFAULT_TREE_PARAMS, type TreeGenParams } from './treeGen';

// --- Per-planet tree profile -------------------------------------------------
//
// Pure, deterministic module: terrainSeed -> a "species" definition. Every
// parameter is ONE seededUnit(terrainSeed, SALT) draw (worldCoordinates.ts), so
// the SAME planet always grows the SAME tree and DIFFERENT planets grow
// recognizably different trees. NO Math.random anywhere — determinism lives here.
//
// Colours are authored in sRGB then .convertSRGBToLinear() to match the
// GRASS_BASE / LEAF_BASE convention already used by grass/leaf materials, and
// authored conservatively (leaf L<=0.40, flower L<=0.58) so they read rich —
// not blown out — under ACES Filmic tonemapping.
//
// The 9 design parameters (leaf colour + flower colour both mandatory):
//   1 silhouette       — read-at-a-glance canopy shape (6 presets)
//   2 leafColor        — base canopy colour (green family OR alien accent)
//   3 leafTipColor     — derived sun-kissed crust colour
//   4 leafSSSColor     — derived backlit glow tint
//   5 flowerColor      — independent blossom accent (always pops)
//   6 bloomAmount      — fraction of clusters that flower (most planets light)
//   7 trunkHeight      — overall trunk height
//   8 leanTwist        — trunk lean + spiral character (clamped so tubes don't kink)
//   9 canopyDensity + leafScale — fullness / openness knobs

export type Silhouette =
  | 'round'
  | 'conical'
  | 'umbrella'
  | 'weeping'
  | 'wispy'
  | 'frond';

export const SILHOUETTES: Silhouette[] = [
  'round',
  'conical',
  'umbrella',
  'weeping',
  'wispy',
  'frond'
];

// Leaf alpha mode consumed by the shader (broad / needle / frond).
export type LeafMode = 0 | 1 | 2; // 0 broad, 1 needle, 2 frond

export interface TreeProfile {
  terrainSeed: number;
  silhouette: Silhouette;
  /** 0..5 — uShapeId uniform, matches SILHOUETTES index. */
  shapeId: number;
  /** Leaf alpha cutout mode for the shader (broad/needle/frond). */
  leafMode: LeafMode;

  /** Base canopy colour (linear). */
  leafColor: THREE.Color;
  /** Sun-kissed bright crust (linear). */
  leafTipColor: THREE.Color;
  /** Backlit subsurface glow tint (linear). */
  leafSSSColor: THREE.Color;

  /** Blossom accent colour (linear). */
  flowerColor: THREE.Color;
  /** 0..1 fraction of leaf clusters that bloom (0 = bare planet). */
  bloomAmount: number;

  /** Trunk height in world units. */
  trunkHeight: number;
  /** Trunk lean magnitude in radians (already clamped). */
  leanTwist: number;
  /** Canopy fullness multiplier (scales attractor count + leaf cards). */
  canopyDensity: number;
  /** Leaf card size multiplier. */
  leafScale: number;
}

// Salts — one constant per parameter so colours/shape never alias each other.
const SALT_SILHOUETTE = 1;
const SALT_LEAF_HUEROLL = 2;
const SALT_LEAF_HUE = 3;
const SALT_LEAF_SAT = 4;
const SALT_FLOWER_HUE = 5;
const SALT_BLOOM = 6;
const SALT_TRUNK = 7;
const SALT_LEAN = 8;
const SALT_DENSITY = 9;
const SALT_LEAFSCALE = 10;

// Alien (non-green) leaf hue accents, used ~30% of planets. Values in [0,1).
const ALIEN_LEAF_HUES = [0.5, 0.08, 0.95, 0.83]; // teal, amber, coral, violet
// Bright flower accents — always pop against any canopy.
const FLOWER_HUES = [0.95, 0.0, 0.12, 0.83, 0.92, 0.58]; // coral,red,gold,violet,pink,sky

// ACES safety clamps (also asserted in treeProfile.test.ts).
export const LEAF_LIGHT = 0.4; // fixed authored leaf lightness
export const FLOWER_LIGHT_CAP = 0.58;

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Build the deterministic per-planet tree profile for a terrain seed.
 * Same seed -> identical profile (byte-stable colours + params).
 */
export function buildTreeProfile(terrainSeed: number): TreeProfile {
  const s = terrainSeed | 0;

  // 1 — silhouette (read-at-a-glance shape).
  const shapeId = Math.min(5, Math.floor(seededUnit(s, SALT_SILHOUETTE) * 6));
  const silhouette = SILHOUETTES[shapeId];
  const leafMode: LeafMode =
    silhouette === 'conical' ? 1 : silhouette === 'frond' ? 2 : 0;

  // 2 — leaf colour (MANDATORY). Mostly cohesive greens; ~30% alien accents.
  const hueRoll = seededUnit(s, SALT_LEAF_HUEROLL);
  let leafHue: number;
  if (hueRoll < 0.7) {
    // green -> lime -> teal family (~72..150deg), harmonizes with grass 0x4a7a24.
    leafHue = 0.2 + seededUnit(s, SALT_LEAF_HUE) * 0.22;
  } else {
    const ai = Math.min(
      ALIEN_LEAF_HUES.length - 1,
      Math.floor(seededUnit(s, SALT_LEAF_HUE) * ALIEN_LEAF_HUES.length)
    );
    leafHue = ALIEN_LEAF_HUES[ai];
  }
  const leafSat = clamp(0.45 + seededUnit(s, SALT_LEAF_SAT) * 0.22, 0, 0.7);
  const leafColor = new THREE.Color()
    .setHSL(leafHue, leafSat, LEAF_LIGHT)
    .convertSRGBToLinear();

  // 3 — derived sun-kissed crust (brighter, slightly hue-shifted).
  const leafTipColor = new THREE.Color()
    .setHSL(
      (leafHue + 0.03) % 1,
      clamp(leafSat - 0.05, 0, 1),
      0.55
    )
    .convertSRGBToLinear();

  // 4 — derived backlit subsurface glow (warmest, lightest).
  const leafSSSColor = new THREE.Color()
    .setHSL((leafHue + 0.02) % 1, clamp(leafSat + 0.08, 0, 1), 0.62)
    .convertSRGBToLinear();

  // 5 — flower colour (MANDATORY, independent so blossoms always read).
  const fi = Math.min(
    FLOWER_HUES.length - 1,
    Math.floor(seededUnit(s, SALT_FLOWER_HUE) * FLOWER_HUES.length)
  );
  const flowerColor = new THREE.Color()
    .setHSL(FLOWER_HUES[fi], 0.7, FLOWER_LIGHT_CAP)
    .convertSRGBToLinear();

  // 6 — bloom amount. pow(roll,2) -> most planets lightly flower, a few bloom hard.
  const bloomRoll = Math.pow(seededUnit(s, SALT_BLOOM), 2);
  const bloomAmount = bloomRoll < 0.12 ? 0 : (bloomRoll - 0.12) / 0.88;

  // 7 — trunk height. frond/wispy skew tall.
  let trunkHeight = 3.5 + seededUnit(s, SALT_TRUNK) * 4;
  if (silhouette === 'frond' || silhouette === 'wispy') {
    trunkHeight = Math.max(trunkHeight, 5.5);
  }

  // 8 — lean / twist (clamped so trunk tube tangents don't kink).
  const leanTwist = clamp((seededUnit(s, SALT_LEAN) - 0.5) * 0.6, -0.35, 0.35);

  // 9 — fullness knobs.
  const canopyDensity = 0.5 + seededUnit(s, SALT_DENSITY) * 0.5; // 0.5..1.0
  const leafScale = 0.7 + seededUnit(s, SALT_LEAFSCALE) * 0.6; // 0.7..1.3

  return {
    terrainSeed: s,
    silhouette,
    shapeId,
    leafMode,
    leafColor,
    leafTipColor,
    leafSSSColor,
    flowerColor,
    bloomAmount,
    trunkHeight,
    leanTwist,
    canopyDensity,
    leafScale
  };
}

// Silhouette -> geometry shaping overrides applied on top of DEFAULT_TREE_PARAMS.
function silhouettePreset(silhouette: Silhouette): Partial<TreeGenParams> {
  switch (silhouette) {
    case 'conical':
      return { crownCenterFrac: 0.55, crownRadius: 1.6 };
    case 'umbrella':
      return { crownCenterFrac: 0.9, crownRadius: 2.6 };
    case 'weeping':
      return { crownCenterFrac: 0.78, crownRadius: 2.2 };
    case 'wispy':
      return { crownCenterFrac: 0.7, crownRadius: 1.9 };
    case 'frond':
      return { crownCenterFrac: 0.95, crownRadius: 1.7 };
    case 'round':
    default:
      return {};
  }
}

/**
 * Convert a profile into the concrete TreeGenParams the geometry builder needs.
 * Starts from DEFAULT_TREE_PARAMS, applies the silhouette preset, then scales by
 * the profile's fullness knobs. Passes silhouette / shaping flags through so
 * treeGen can reshape the attractor cloud + bend nodes.
 */
export function paramsFromProfile(profile: TreeProfile): TreeGenParams {
  const preset = silhouettePreset(profile.silhouette);
  const base: TreeGenParams = { ...DEFAULT_TREE_PARAMS, ...preset };

  const attractorCount = Math.max(
    40,
    Math.round(base.attractorCount * profile.canopyDensity)
  );
  // Some shapes need a denser card budget than the base. Weeping must clothe a
  // full crown AND hang cascading curtains; conical must fill a solid cone so the
  // trunk doesn't show between whorls. A normal budget leaves bare gaps.
  const leafBudgetMul =
    profile.silhouette === 'weeping'
      ? 1.7
      : profile.silhouette === 'conical'
        ? 1.6
        : 1;
  const maxLeafCards = Math.max(
    60,
    Math.round(base.maxLeafCards * profile.canopyDensity * leafBudgetMul)
  );
  const leafSize = base.leafSize * profile.leafScale;

  // wispy thins the crown further.
  const wispyMul = profile.silhouette === 'wispy' ? 0.6 : 1;

  return {
    ...base,
    height: profile.trunkHeight,
    attractorCount: Math.round(attractorCount * wispyMul),
    maxLeafCards,
    leafSize,
    silhouette: profile.silhouette,
    leanTwist: profile.leanTwist,
    bloomAmount: profile.bloomAmount
  };
}
