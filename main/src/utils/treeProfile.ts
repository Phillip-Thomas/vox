import * as THREE from 'three';
import { seededUnit } from './worldCoordinates';
import { buildBiomeProfile } from './biomeProfile';
import { DEFAULT_TREE_PARAMS, type TreeGenParams } from './treeGen';
import { buildWindProfile, type WindProfile } from './windProfile';

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
//   2 leafColor        — base canopy colour (anchored to the biome vegetation hue)
//   3 leafTipColor     — derived sun-kissed crust colour
//   4 leafSSSColor     — derived backlit glow tint
//   5 flowerColor      — independent blossom accent (always pops)
//   6 bloomAmount      — fraction of clusters that flower (most planets light)
//   7 trunkHeight      — overall trunk height
//   8 leanTwist        — trunk lean + spiral character (clamped so tubes don't kink)
//   9 canopyDensity + leafScale — fullness / openness knobs
//   10 species controls — Florasynth-inspired growth knobs consumed by treeGen

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
  /** Shared per-planet atmosphere profile for foliage motion consumers. */
  wind: WindProfile;
  /** Child branch emergence angle in radians. */
  branchJointAngle: number;
  /** New lateral branches attempted per fork. */
  whorlCount: number;
  /** Per-internode random wander. */
  gnarl: number;
  /** Branch tendency to steer upward. */
  gravitropism: number;
  /** 0..1 central leader priority over lateral growth. */
  apicalDominance: number;
  /** 0..1 how quickly apical dominance fades by branch order. */
  apicalDominanceDecay: number;
  /** 0..1 resistance to weight sag. */
  branchStiffness: number;
  /** Foliage cluster spacing multiplier; lower is denser. */
  foliageSpacing: number;
  /** Legacy inward placement knob; fixed at 0 so leaves stay on branch nodes. */
  foliageThreshold: number;
  /** Downward foliage hang angle/position bias. */
  foliageDroop: number;
  /** Base buttress spread. */
  trunkFlare: number;
  /** Bark/trunk silhouette roughness. */
  trunkRoughness: number;
  /** Terminal branch geometry pruning passes. */
  thinFineBranches: number;
}

// Salts — one constant per parameter so colours/shape never alias each other.
const SALT_SILHOUETTE = 1;
const SALT_LEAF_HUE = 3;
const SALT_LEAF_SAT = 4;
const SALT_FLOWER_HUE = 5;
const SALT_BLOOM = 6;
const SALT_TRUNK = 7;
const SALT_LEAN = 8;
const SALT_DENSITY = 9;
const SALT_LEAFSCALE = 10;
const SALT_BRANCH_ANGLE = 11;
const SALT_WHORLS = 12;
const SALT_GNARL = 13;
const SALT_GRAVITROPISM = 14;
const SALT_APICAL = 15;
const SALT_APICAL_DECAY = 16;
const SALT_BRANCH_STIFFNESS = 17;
const SALT_FOLIAGE_SPACING = 18;
const SALT_FOLIAGE_DROOP = 20;
const SALT_TRUNK_FLARE = 21;
const SALT_TRUNK_ROUGHNESS = 22;
const SALT_THIN_BRANCHES = 23;

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

  // 2 — leaf colour (MANDATORY). Anchored to the planet's BIOME canopy hue — the
  // COOL/blue side of the biome's split-complementary veg pair (grass takes the
  // warm side), so canopy + grass read as a coordinated, complementing pair
  // rather than the same flat colour — plus a small per-tree signature offset so
  // two same-biome worlds still differ. Saturation/lightness and the flower
  // accent below stay the tree's OWN, so blossoms remain the independent pop.
  const biome = buildBiomeProfile(s);
  const wind = buildWindProfile(s, biome);
  const hueJitter = (seededUnit(s, SALT_LEAF_HUE) - 0.5) * 0.06; // +/-0.03
  const leafHue = (biome.leafHue + hueJitter + 1) % 1;
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

  // 7 — trunk height. The old 3.5..7.5 range kept many canopies at player
  // scale. Raise the floor and widen the spread so trees read as something you
  // look up into, while clamping below "giant forest" territory.
  const heightRoll = seededUnit(s, SALT_TRUNK);
  let trunkHeight = 5.8 + Math.pow(heightRoll, 0.82) * 4.5; // ~5.8..10.3
  if (silhouette === 'conical') trunkHeight += 0.5;
  if (silhouette === 'umbrella') trunkHeight -= 0.2;
  if (silhouette === 'frond' || silhouette === 'wispy') {
    trunkHeight = Math.max(trunkHeight, 7.0);
  }
  trunkHeight = clamp(trunkHeight, 5.6, 10.9);

  // 8 — lean / twist. Kept SMALL and per-PLANET: this only bakes a subtle trunk
  // bend + spiral character into the shared geometry. The visible tree-to-tree
  // lean (slight, varied direction) comes from a PER-INSTANCE tilt in TreeField,
  // so a forest never reads as "every trunk tipped the same large angle". Clamped
  // so trunk tube tangents don't kink.
  const leanTwist = clamp((seededUnit(s, SALT_LEAN) - 0.5) * 0.2, -0.1, 0.1);

  // 9 — fullness knobs.
  // Fuller trees are now the baseline. Density stays deterministic, but the
  // range sits ABOVE the old max so every planet gets a real canopy instead of
  // a sparse prop. Shape-specific multipliers in paramsFromProfile keep the
  // silhouettes distinct while sharing one generator.
  const canopyDensity = 1.35 + seededUnit(s, SALT_DENSITY) * 0.65; // 1.35..2.0
  const leafScale = 0.72 + seededUnit(s, SALT_LEAFSCALE) * 0.32; // 0.72..1.04

  // 10 — species controls. These are compact, deterministic equivalents of the
  // big procedural-editor knobs seen in Florasynth: angle/whorls/tropism/apical
  // dominance/branch weight/foliage placement/trunk character. Ranges are narrow
  // enough to keep the existing L-system bounded but wide enough to make planets
  // feel like different species.
  const angleBase =
    silhouette === 'conical'
      ? 0.48
      : silhouette === 'umbrella'
        ? 0.72
        : silhouette === 'weeping'
          ? 0.62
          : silhouette === 'wispy'
            ? 0.58
            : 0.62;
  const branchJointAngle = clamp(
    angleBase + (seededUnit(s, SALT_BRANCH_ANGLE) - 0.5) * 0.22,
    0.36,
    0.92
  );
  const whorlRoll = seededUnit(s, SALT_WHORLS);
  const whorlCount =
    silhouette === 'conical'
      ? 2
      : silhouette === 'umbrella'
        ? whorlRoll > 0.35 ? 3 : 2
        : 2 + Math.floor(whorlRoll * 2); // 2..3
  const gnarl = clamp(0.06 + seededUnit(s, SALT_GNARL) * 0.22, 0.04, 0.3);
  const gravitropism = clamp(
    (silhouette === 'weeping' ? 0.04 : silhouette === 'conical' ? 0.16 : 0.08) +
      seededUnit(s, SALT_GRAVITROPISM) * 0.08,
    0.02,
    0.22
  );
  const apicalDominance = clamp(
    (silhouette === 'conical' ? 0.78 : silhouette === 'umbrella' ? 0.34 : 0.52) +
      (seededUnit(s, SALT_APICAL) - 0.5) * 0.26,
    0.2,
    0.95
  );
  const apicalDominanceDecay = clamp(
    0.08 + seededUnit(s, SALT_APICAL_DECAY) * 0.22,
    0.04,
    0.34
  );
  const branchStiffness = clamp(
    (silhouette === 'weeping' ? 0.34 : silhouette === 'umbrella' ? 0.54 : 0.62) +
      seededUnit(s, SALT_BRANCH_STIFFNESS) * 0.28,
    0.25,
    0.95
  );
  const foliageSpacing = clamp(
    (silhouette === 'wispy' ? 0.76 : 0.68) +
      seededUnit(s, SALT_FOLIAGE_SPACING) * 0.32,
    0.56,
    1.14
  );
  // Foliage previously walked 0..2 segments inward from selected tips. That made
  // several species read as leaves orbiting the trunk. Keep the field for saved
  // profile/debug compatibility, but lock the visible placement to branch nodes.
  const foliageThreshold = 0;
  const foliageDroop = clamp(
    (silhouette === 'weeping' ? 0.78 : silhouette === 'frond' ? 0.5 : 0.18) +
      seededUnit(s, SALT_FOLIAGE_DROOP) * 0.32,
    0,
    1
  );
  const trunkFlare = clamp(
    (silhouette === 'frond' ? 0.18 : 0.08) + seededUnit(s, SALT_TRUNK_FLARE) * 0.32,
    0.04,
    0.48
  );
  const trunkRoughness = clamp(0.03 + seededUnit(s, SALT_TRUNK_ROUGHNESS) * 0.13, 0, 0.18);
  const thinFineBranches = seededUnit(s, SALT_THIN_BRANCHES) > 0.78 ? 1 : 0;

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
    leafScale,
    wind,
    branchJointAngle,
    whorlCount,
    gnarl,
    gravitropism,
    apicalDominance,
    apicalDominanceDecay,
    branchStiffness,
    foliageSpacing,
    foliageThreshold,
    foliageDroop,
    trunkFlare,
    trunkRoughness,
    thinFineBranches
  };
}

// Silhouette -> geometry shaping overrides applied on top of DEFAULT_TREE_PARAMS.
function silhouettePreset(silhouette: Silhouette): Partial<TreeGenParams> {
  switch (silhouette) {
    case 'conical':
      return { crownCenterFrac: 0.55, crownRadius: 1.85 };
    case 'umbrella':
      return { crownCenterFrac: 0.9, crownRadius: 2.85 };
    case 'weeping':
      return { crownCenterFrac: 0.78, crownRadius: 2.45 };
    case 'wispy':
      return { crownCenterFrac: 0.7, crownRadius: 2.1 };
    case 'frond':
      return { crownCenterFrac: 0.95, crownRadius: 2.0 };
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
  const heightScale = clamp(profile.trunkHeight / DEFAULT_TREE_PARAMS.height, 1, 1.98);
  const crownScale = clamp(1 + (heightScale - 1) * 0.36, 1.04, 1.36);
  const woodScale = clamp(1 + (heightScale - 1) * 0.22, 1, 1.22);
  const leafMassScale = clamp(1 + (crownScale - 1) * 0.78, 1, 1.28);

  const attractorCount = Math.max(
    40,
    Math.round(base.attractorCount * profile.canopyDensity * leafMassScale)
  );
  // Some shapes need a denser card budget than the base. These are silhouette
  // multipliers, not separate species systems: every variant still uses the same
  // phyllotaxis leaf builder, but gets enough cards to look intentional.
  const leafBudgetMul =
    profile.silhouette === 'weeping'
      ? 2.35
      : profile.silhouette === 'conical'
        ? 2.65
        : profile.silhouette === 'umbrella'
          ? 2.35
          : profile.silhouette === 'frond'
            ? 2.05
            : profile.silhouette === 'wispy'
              ? 2.25
              : 2.35;
  const maxLeafCards = Math.max(
    60,
    Math.round(
      base.maxLeafCards *
        profile.canopyDensity *
        leafBudgetMul *
        leafMassScale *
        clamp(1.18 - (profile.foliageSpacing - 0.56) * 0.22, 0.92, 1.18)
    )
  );
  const leafSize = base.leafSize * profile.leafScale * clamp(0.96 + (heightScale - 1) * 0.14, 1, 1.12);

  // Wispy is still lighter than the rest, but it no longer drops below baseline.
  // It should read as fine, airy foliage, not an unfinished tree.
  const wispyMul = profile.silhouette === 'wispy' ? 0.96 : 1;

  return {
    ...base,
    height: profile.trunkHeight,
    crownRadius: base.crownRadius * crownScale,
    baseRadius: base.baseRadius * woodScale,
    attractorCount: Math.round(attractorCount * wispyMul),
    maxLeafCards,
    leafSize,
    silhouette: profile.silhouette,
    leanTwist: profile.leanTwist,
    bloomAmount: profile.bloomAmount,
    branchJointAngle: profile.branchJointAngle,
    whorlCount: profile.whorlCount,
    gnarl: profile.gnarl,
    gravitropism: profile.gravitropism,
    apicalDominance: profile.apicalDominance,
    apicalDominanceDecay: profile.apicalDominanceDecay,
    branchStiffness: profile.branchStiffness,
    foliageSpacing: profile.foliageSpacing,
    foliageThreshold: profile.foliageThreshold,
    foliageDroop: profile.foliageDroop,
    trunkFlare: profile.trunkFlare,
    trunkRoughness: profile.trunkRoughness,
    thinFineBranches: profile.thinFineBranches
  };
}
