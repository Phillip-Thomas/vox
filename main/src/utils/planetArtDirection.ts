import { MaterialType } from '../types/materials.ts';
import { buildBiomeProfile, type BiomeKind } from './biomeProfile.ts';
import { seededUnit } from './worldCoordinates.ts';
import { archetypeForSeed, type ArchetypeId } from '../game/data/planetArchetypes.ts';
import type { QualityProfile } from '../config/graphicsSettings.ts';

export type PaletteFamily =
  | 'analogous'
  | 'split-complement'
  | 'triadic-muted'
  | 'earth-and-jewel'
  | 'warm-cool-polar'
  | 'monochrome-accent'
  | 'alien-iridescent'
  | 'volcanic-ember'
  | 'frozen-mineral'
  | 'fungal-bioglow';

export interface PaletteRoleColor {
  h: number;
  s: number;
  l: number;
  hex: string;
}

export interface PlanetPaletteRoles {
  skyLow: PaletteRoleColor;
  skyHigh: PaletteRoleColor;
  sunGlow: PaletteRoleColor;
  fogTint: PaletteRoleColor;
  postGradeTint: PaletteRoleColor;
  terrainPrimary: PaletteRoleColor;
  terrainSecondary: PaletteRoleColor;
  soilDark: PaletteRoleColor;
  sandLight: PaletteRoleColor;
  rockBase: PaletteRoleColor;
  mineralAccent: PaletteRoleColor;
  hazardAccent: PaletteRoleColor;
  vegetationBase: PaletteRoleColor;
  vegetationTip: PaletteRoleColor;
  dryGrass: PaletteRoleColor;
  vegetationSSS: PaletteRoleColor;
  canopyBase: PaletteRoleColor;
  canopyTip: PaletteRoleColor;
  canopySSS: PaletteRoleColor;
  flowerAccent: PaletteRoleColor;
  bark: PaletteRoleColor;
  waterDeep: PaletteRoleColor;
  waterShallow: PaletteRoleColor;
  waterFoam: PaletteRoleColor;
  waterSSS: PaletteRoleColor;
  faunaCoat: PaletteRoleColor;
  faunaAccent: PaletteRoleColor;
  wingGlass: PaletteRoleColor;
}

export interface PlanetArtBudgets {
  dominant: number;
  secondary: number;
  accent: number;
  hazardAccent: number;
  valueContrast: number;
  saturationBudget: number;
}

export interface PlanetShapeTokens {
  roundness: number;
  angularity: number;
  verticality: number;
  leafCardDensity: number;
  bladeThinness: number;
  propSoftness: number;
  shardSpikiness: number;
  surfaceReliefScale: number;
  canopyScale: number;
  faunaScaleBias: number;
  negativeSpace: number;
}

export type EcologyLayer =
  | 'grass'
  | 'trees'
  | 'flora'
  | 'fauna'
  | 'rocks'
  | 'surfaceEffects'
  | 'forage';

export interface PlanetEcology {
  richness: number;
  materialEligibility: Record<EcologyLayer, MaterialType[]>;
  floraWeights: Record<string, number>;
  faunaWeights: Record<string, number>;
  surfaceEffectWeights: Record<string, number>;
}

export interface PlanetMaterialPhenomena {
  sandDust: number;
  looseSoilLife: number;
  pollen: number;
  frost: number;
  lavaHeat: number;
  ash: number;
  crystalGlints: number;
  metallicFlecks: number;
  fungalSpores: number;
}

export interface PlanetQualityHints {
  densityBiasByProfile: Record<QualityProfile, number>;
  shaderFeatureBudget: Record<QualityProfile, number>;
}

export interface PlanetArtDirection {
  seed: number;
  archetype: ArchetypeId;
  biomeKind: BiomeKind;
  /** Visual quality standard. Trees are the north star; grass is the ground-detail support. */
  styleReference: {
    primary: 'trees';
    secondary: 'grass';
    notes: string;
  };
  paletteFamily: PaletteFamily;
  palette: PlanetPaletteRoles;
  budgets: PlanetArtBudgets;
  ecology: PlanetEcology;
  shape: PlanetShapeTokens;
  windDrama: number;
  materialPhenomena: PlanetMaterialPhenomena;
  qualityHints: PlanetQualityHints;
  scores: {
    roleContrast: number;
    paletteDiversity: number;
    accentBudget: number;
  };
}

const FAMILY_BY_ARCHETYPE: Record<ArchetypeId, PaletteFamily[]> = {
  verdant: ['analogous', 'split-complement'],
  arid: ['earth-and-jewel', 'split-complement'],
  frozen: ['frozen-mineral', 'warm-cool-polar'],
  volcanic: ['volcanic-ember', 'warm-cool-polar'],
  oceanic: ['analogous', 'warm-cool-polar'],
  crystal: ['alien-iridescent', 'triadic-muted'],
  metallic: ['monochrome-accent', 'earth-and-jewel'],
  fungal: ['fungal-bioglow', 'triadic-muted'],
  anomaly: ['alien-iridescent', 'triadic-muted', 'monochrome-accent']
};

const SALT_FAMILY = 611;
const SALT_BASE = 612;
const SALT_ACCENT = 613;
const SALT_SOFTNESS = 614;

const ALL_SURFACE_ORGANIC = [MaterialType.GRASS, MaterialType.DIRT];
const DRY_ORGANIC = [MaterialType.SAND, MaterialType.DIRT];
const MINERAL_SURFACE = [MaterialType.STONE, MaterialType.BASALT, MaterialType.CRYSTAL];
const ALL_SURFACE_EFFECT_MATERIALS = [
  MaterialType.SAND,
  MaterialType.DIRT,
  MaterialType.GRASS,
  MaterialType.ICE,
  MaterialType.BASALT,
  MaterialType.LAVA,
  MaterialType.CRYSTAL,
  MaterialType.STONE,
  MaterialType.COPPER,
  MaterialType.GOLD,
  MaterialType.SILVER
];

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function mixHue(a: number, b: number, t: number): number {
  let d = b - a;
  if (d > 0.5) d -= 1;
  if (d < -0.5) d += 1;
  return (a + d * t + 1) % 1;
}

export function circularHueDistance(a: number, b: number): number {
  const d = Math.abs(a - b);
  return Math.min(d, 1 - d);
}

function rgbChannelToHex(v: number): string {
  return Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, '0');
}

export function hslToRgb({ h, s, l }: Pick<PaletteRoleColor, 'h' | 's' | 'l'>): [number, number, number] {
  const hueToRgb = (p: number, q: number, t0: number) => {
    let t = t0;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hueToRgb(p, q, h + 1 / 3), hueToRgb(p, q, h), hueToRgb(p, q, h - 1 / 3)];
}

export function roleHex(color: Pick<PaletteRoleColor, 'h' | 's' | 'l'>): string {
  const [r, g, b] = hslToRgb(color);
  return `#${rgbChannelToHex(r)}${rgbChannelToHex(g)}${rgbChannelToHex(b)}`;
}

function role(h: number, s: number, l: number): PaletteRoleColor {
  const color = {
    h: (h + 1) % 1,
    s: clamp(s, 0, 1),
    l: clamp(l, 0, 1)
  };
  return { ...color, hex: roleHex(color) };
}

export function relativeLuma(color: Pick<PaletteRoleColor, 'h' | 's' | 'l'>): number {
  const [r, g, b] = hslToRgb(color).map(v => {
    const c = clamp(v, 0, 1);
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function saturationClamp(value: number, budget: number): number {
  return clamp(value, 0.06, budget);
}

export function roleContrastScore(palette: PlanetPaletteRoles): number {
  const pairs: Array<[PaletteRoleColor, PaletteRoleColor, number]> = [
    [palette.skyLow, palette.terrainPrimary, 0.12],
    [palette.skyHigh, palette.rockBase, 0.18],
    [palette.waterDeep, palette.terrainPrimary, 0.08],
    [palette.vegetationBase, palette.canopyBase, 0.04],
    [palette.faunaCoat, palette.terrainPrimary, 0.06],
    [palette.flowerAccent, palette.canopyBase, 0.1]
  ];
  const passed = pairs.reduce((sum, [a, b, min]) => {
    const d = Math.abs(relativeLuma(a) - relativeLuma(b));
    return sum + clamp(d / min, 0, 1);
  }, 0);
  return passed / pairs.length;
}

export function paletteDiversityScore(palette: PlanetPaletteRoles): number {
  const sampled = [
    palette.terrainPrimary,
    palette.terrainSecondary,
    palette.vegetationBase,
    palette.canopyBase,
    palette.waterShallow,
    palette.mineralAccent,
    palette.flowerAccent,
    palette.skyLow
  ];
  let hueSpread = 0;
  let lumaSpread = 0;
  for (let i = 0; i < sampled.length; i++) {
    for (let j = i + 1; j < sampled.length; j++) {
      hueSpread += circularHueDistance(sampled[i].h, sampled[j].h);
      lumaSpread += Math.abs(relativeLuma(sampled[i]) - relativeLuma(sampled[j]));
    }
  }
  const denom = (sampled.length * (sampled.length - 1)) / 2;
  return clamp((hueSpread / denom) * 2.6 + (lumaSpread / denom) * 1.4, 0, 1);
}

export function accentBudgetScore(budgets: Pick<PlanetArtBudgets, 'accent' | 'hazardAccent'>): number {
  const accent = budgets.accent <= 0.11 ? 1 : clamp(1 - (budgets.accent - 0.11) / 0.12, 0, 1);
  const hazard = budgets.hazardAccent <= 0.055 ? 1 : clamp(1 - (budgets.hazardAccent - 0.055) / 0.08, 0, 1);
  return Math.min(accent, hazard);
}

function selectPaletteFamily(seed: number, archetype: ArchetypeId): PaletteFamily {
  const families = FAMILY_BY_ARCHETYPE[archetype];
  return families[Math.min(families.length - 1, Math.floor(seededUnit(seed, SALT_FAMILY) * families.length))];
}

function paletteRoles(seed: number, archetype: ArchetypeId, family: PaletteFamily): PlanetPaletteRoles {
  const biome = buildBiomeProfile(seed);
  const identity = (biome.hue + (seededUnit(seed, SALT_BASE) - 0.5) * 0.05 + 1) % 1;
  const accentRoll = seededUnit(seed, SALT_ACCENT);
  const jewel = (identity + 0.38 + accentRoll * 0.18) % 1;
  const warm = mixHue(identity, 0.08, archetype === 'arid' || archetype === 'volcanic' ? 0.7 : 0.25);
  const cool = mixHue(identity, 0.58, archetype === 'frozen' || archetype === 'oceanic' ? 0.72 : 0.32);
  const terrainHue = (() => {
    if (family === 'volcanic-ember') return 0.035;
    if (family === 'frozen-mineral') return 0.57;
    if (family === 'earth-and-jewel') return 0.095;
    if (family === 'monochrome-accent') return mixHue(identity, 0.62, 0.4);
    if (family === 'fungal-bioglow') return mixHue(identity, 0.78, 0.45);
    return mixHue(identity, warm, 0.38);
  })();
  const skyHue = (() => {
    if (family === 'volcanic-ember') return 0.64;
    if (family === 'frozen-mineral') return 0.58;
    if (family === 'alien-iridescent') return mixHue(cool, jewel, 0.25);
    if (family === 'fungal-bioglow') return mixHue(0.74, identity, 0.22);
    return cool;
  })();
  const mineralHue = (() => {
    if (family === 'volcanic-ember') return 0.04;
    if (family === 'frozen-mineral') return 0.52;
    if (family === 'monochrome-accent') return jewel;
    if (family === 'fungal-bioglow') return 0.81;
    return jewel;
  })();
  const satBudget = family === 'alien-iridescent' || family === 'fungal-bioglow' ? 0.82 : 0.68;
  const vegSat = saturationClamp(biome.saturation + 0.04, satBudget);
  const canopySat = saturationClamp(biome.saturation + 0.02, satBudget);
  const groundSat = family === 'monochrome-accent' ? 0.16 : family === 'volcanic-ember' ? 0.34 : 0.38;
  const waterHue = mixHue(0.55, identity, biome.alien ? 0.55 : 0.28);

  return {
    skyLow: role(skyHue, saturationClamp(0.35, satBudget), 0.56),
    skyHigh: role((skyHue + 0.03) % 1, saturationClamp(0.48, satBudget), 0.8),
    sunGlow: role(warm, 0.58, 0.7),
    fogTint: role(skyHue, 0.2, 0.62),
    postGradeTint: role(mixHue(identity, skyHue, 0.5), 0.18, 0.52),
    terrainPrimary: role(terrainHue, groundSat, family === 'volcanic-ember' ? 0.24 : 0.34),
    terrainSecondary: role((terrainHue + 0.035) % 1, clamp(groundSat - 0.05, 0.08, 0.62), 0.45),
    soilDark: role((terrainHue + 0.02) % 1, clamp(groundSat + 0.08, 0.08, 0.68), 0.22),
    sandLight: role(0.105, 0.34, 0.62),
    rockBase: role(family === 'monochrome-accent' ? 0.62 : terrainHue, family === 'monochrome-accent' ? 0.08 : 0.2, 0.38),
    mineralAccent: role(mineralHue, saturationClamp(0.72, satBudget), family === 'volcanic-ember' ? 0.58 : 0.54),
    hazardAccent: role(family === 'frozen-mineral' ? 0.56 : 0.03, 0.86, 0.54),
    vegetationBase: role(biome.grassHue, vegSat, 0.31),
    vegetationTip: role((biome.grassHue + 0.025) % 1, clamp(vegSat - 0.04, 0.08, satBudget), 0.54),
    dryGrass: role((biome.grassHue + 0.06) % 1, clamp(vegSat * 0.42, 0.08, 0.42), 0.52),
    vegetationSSS: role((biome.grassHue + 0.015) % 1, clamp(vegSat + 0.1, 0.08, satBudget), 0.6),
    canopyBase: role(biome.leafHue, canopySat, 0.38),
    canopyTip: role((biome.leafHue + 0.03) % 1, clamp(canopySat - 0.05, 0.08, satBudget), 0.55),
    canopySSS: role((biome.leafHue + 0.02) % 1, clamp(canopySat + 0.08, 0.08, satBudget), 0.62),
    flowerAccent: role(jewel, saturationClamp(0.76, 0.88), 0.57),
    bark: role(0.075, 0.34, 0.28),
    waterDeep: role(waterHue, 0.58, 0.12),
    waterShallow: role((waterHue + 0.025) % 1, 0.48, 0.56),
    waterFoam: role(mixHue(waterHue, 0.58, 0.25), 0.12, 0.93),
    waterSSS: role((waterHue + 0.04) % 1, 0.62, 0.48),
    faunaCoat: role((identity + 0.07) % 1, clamp(biome.saturation * 0.42, 0.16, 0.58), 0.44),
    faunaAccent: role(jewel, 0.58, 0.52),
    wingGlass: role((waterHue + 0.12) % 1, 0.38, 0.72)
  };
}

function ecologyFor(archetype: ArchetypeId, richness: number): PlanetEcology {
  const base: PlanetEcology = {
    richness,
    materialEligibility: {
      grass: [MaterialType.GRASS],
      trees: [MaterialType.GRASS, MaterialType.DIRT],
      flora: [MaterialType.GRASS, MaterialType.DIRT, MaterialType.SAND],
      fauna: [MaterialType.GRASS, MaterialType.DIRT, MaterialType.SAND],
      rocks: [MaterialType.STONE, MaterialType.BASALT, MaterialType.ICE, MaterialType.CRYSTAL],
      surfaceEffects: ALL_SURFACE_EFFECT_MATERIALS,
      forage: [MaterialType.GRASS, MaterialType.DIRT]
    },
    floraWeights: { cactus: 0.2, fan: 0.7, flower: 0.8, seedhead: 0.5, shrub: 0.7 },
    faunaWeights: { grazer: 0.7, woolly: 0.5, runner: 0.45, hopper: 0.4, dragonfly: 0.55 },
    surfaceEffectWeights: { sandDust: 0.3, looseSoilLife: 0.35, pollen: 0.45, frost: 0, lavaHeat: 0, ash: 0, crystalGlints: 0, metallicFlecks: 0, fungalSpores: 0 }
  };

  if (archetype === 'verdant') {
    base.materialEligibility.surfaceEffects = [MaterialType.GRASS, MaterialType.DIRT, MaterialType.SAND];
    base.floraWeights = { cactus: 0.03, fan: 0.9, flower: 1.2, seedhead: 0.5, shrub: 1.0 };
    base.faunaWeights = { grazer: 1.2, woolly: 0.8, runner: 0.4, hopper: 0.35, dragonfly: 0.9 };
    base.surfaceEffectWeights = { ...base.surfaceEffectWeights, pollen: 1, looseSoilLife: 0.8 };
  } else if (archetype === 'arid') {
    base.materialEligibility.grass = [];
    base.materialEligibility.trees = [MaterialType.DIRT, MaterialType.SAND];
    base.materialEligibility.flora = [MaterialType.DIRT, MaterialType.SAND];
    base.materialEligibility.fauna = [MaterialType.DIRT, MaterialType.SAND];
    base.materialEligibility.surfaceEffects = [MaterialType.SAND, MaterialType.DIRT, MaterialType.STONE];
    base.floraWeights = { cactus: 1.4, fan: 0.25, flower: 0.08, seedhead: 1.0, shrub: 0.35 };
    base.faunaWeights = { grazer: 0.12, woolly: 0.08, runner: 0.9, hopper: 1.2, dragonfly: 0.12 };
    base.surfaceEffectWeights = { ...base.surfaceEffectWeights, sandDust: 1.2, looseSoilLife: 0.25 };
  } else if (archetype === 'frozen') {
    base.materialEligibility.grass = [];
    base.materialEligibility.trees = [MaterialType.DIRT, MaterialType.ICE];
    base.materialEligibility.surfaceEffects = [MaterialType.ICE, MaterialType.STONE, MaterialType.DIRT];
    base.floraWeights = { cactus: 0.02, fan: 0.2, flower: 0.08, seedhead: 0.35, shrub: 0.32 };
    base.faunaWeights = { grazer: 0.12, woolly: 0.75, runner: 0.18, hopper: 0.08, dragonfly: 0.03 };
    base.surfaceEffectWeights = { ...base.surfaceEffectWeights, frost: 1.15, pollen: 0.03 };
  } else if (archetype === 'volcanic') {
    base.materialEligibility.grass = [];
    base.materialEligibility.trees = [MaterialType.DIRT];
    base.materialEligibility.flora = [MaterialType.DIRT, MaterialType.BASALT];
    base.materialEligibility.fauna = [MaterialType.DIRT, MaterialType.BASALT];
    base.materialEligibility.surfaceEffects = [MaterialType.BASALT, MaterialType.LAVA, MaterialType.SAND, MaterialType.STONE];
    base.floraWeights = { cactus: 0.12, fan: 0.08, flower: 0.02, seedhead: 0.16, shrub: 0.12 };
    base.faunaWeights = { grazer: 0.02, woolly: 0.02, runner: 0.25, hopper: 0.3, dragonfly: 0.05 };
    base.surfaceEffectWeights = { ...base.surfaceEffectWeights, lavaHeat: 1.2, ash: 1.1, sandDust: 0.3 };
  } else if (archetype === 'oceanic') {
    base.materialEligibility.grass = [MaterialType.GRASS, MaterialType.DIRT];
    base.materialEligibility.surfaceEffects = [MaterialType.GRASS, MaterialType.DIRT, MaterialType.SAND];
    base.floraWeights = { cactus: 0.05, fan: 1.0, flower: 0.8, seedhead: 0.45, shrub: 0.8 };
    base.faunaWeights = { grazer: 0.65, woolly: 0.25, runner: 0.22, hopper: 0.18, dragonfly: 1.15 };
    base.surfaceEffectWeights = { ...base.surfaceEffectWeights, pollen: 0.7, looseSoilLife: 0.55 };
  } else if (archetype === 'crystal') {
    base.materialEligibility.grass = [];
    base.materialEligibility.flora = [MaterialType.DIRT, MaterialType.CRYSTAL];
    base.materialEligibility.fauna = [MaterialType.DIRT];
    base.materialEligibility.surfaceEffects = [MaterialType.CRYSTAL, MaterialType.STONE, MaterialType.DIRT];
    base.floraWeights = { cactus: 0.12, fan: 0.38, flower: 0.28, seedhead: 0.22, shrub: 0.2 };
    base.faunaWeights = { grazer: 0.06, woolly: 0.04, runner: 0.18, hopper: 0.16, dragonfly: 0.22 };
    base.surfaceEffectWeights = { ...base.surfaceEffectWeights, crystalGlints: 1.25 };
  } else if (archetype === 'metallic') {
    base.materialEligibility.grass = [];
    base.materialEligibility.trees = [];
    base.materialEligibility.flora = [MaterialType.DIRT, MaterialType.STONE];
    base.materialEligibility.fauna = [MaterialType.DIRT, MaterialType.STONE];
    base.materialEligibility.surfaceEffects = [MaterialType.STONE, MaterialType.COPPER, MaterialType.GOLD, MaterialType.SILVER, MaterialType.BASALT];
    base.floraWeights = { cactus: 0.06, fan: 0.12, flower: 0.04, seedhead: 0.1, shrub: 0.08 };
    base.faunaWeights = { grazer: 0.02, woolly: 0.02, runner: 0.12, hopper: 0.08, dragonfly: 0.04 };
    base.surfaceEffectWeights = { ...base.surfaceEffectWeights, metallicFlecks: 1.2 };
  } else if (archetype === 'fungal') {
    base.materialEligibility.surfaceEffects = [MaterialType.GRASS, MaterialType.DIRT, MaterialType.STONE];
    base.floraWeights = { cactus: 0.02, fan: 1.05, flower: 0.55, seedhead: 0.35, shrub: 1.2 };
    base.faunaWeights = { grazer: 0.42, woolly: 0.38, runner: 0.22, hopper: 0.32, dragonfly: 0.7 };
    base.surfaceEffectWeights = { ...base.surfaceEffectWeights, fungalSpores: 1.2, looseSoilLife: 0.9 };
  } else {
    base.materialEligibility.grass = ALL_SURFACE_ORGANIC;
    base.materialEligibility.trees = DRY_ORGANIC;
    base.materialEligibility.flora = [...ALL_SURFACE_ORGANIC, ...MINERAL_SURFACE];
    base.materialEligibility.fauna = ALL_SURFACE_ORGANIC;
    base.materialEligibility.surfaceEffects = ALL_SURFACE_EFFECT_MATERIALS;
    base.floraWeights = { cactus: 0.35, fan: 0.5, flower: 0.45, seedhead: 0.4, shrub: 0.45 };
    base.faunaWeights = { grazer: 0.18, woolly: 0.12, runner: 0.28, hopper: 0.2, dragonfly: 0.42 };
    base.surfaceEffectWeights = { ...base.surfaceEffectWeights, crystalGlints: 0.85, fungalSpores: 0.55, metallicFlecks: 0.45 };
  }
  return base;
}

function shapeTokens(seed: number, archetype: ArchetypeId): PlanetShapeTokens {
  const soft = seededUnit(seed, SALT_SOFTNESS);
  const spiky = archetype === 'crystal' || archetype === 'volcanic' || archetype === 'anomaly';
  const sparse = archetype === 'arid' || archetype === 'metallic' || archetype === 'crystal';
  return {
    roundness: clamp((spiky ? 0.25 : 0.58) + soft * 0.22, 0.12, 0.9),
    angularity: clamp((spiky ? 0.72 : 0.28) + (1 - soft) * 0.22, 0.08, 0.92),
    verticality: clamp((archetype === 'verdant' ? 0.76 : archetype === 'arid' ? 0.52 : 0.42) + seededUnit(seed, 615) * 0.22, 0.2, 0.95),
    leafCardDensity: clamp((sparse ? 0.42 : 0.78) + seededUnit(seed, 616) * 0.18, 0.18, 1),
    bladeThinness: clamp(0.68 + seededUnit(seed, 617) * 0.24, 0.5, 0.96),
    propSoftness: clamp((archetype === 'fungal' ? 0.78 : 0.46) + soft * 0.2, 0.16, 0.96),
    shardSpikiness: clamp((spiky ? 0.72 : 0.16) + seededUnit(seed, 618) * 0.2, 0.04, 0.96),
    surfaceReliefScale: clamp((archetype === 'volcanic' ? 0.88 : 0.42) + seededUnit(seed, 619) * 0.22, 0.18, 1),
    canopyScale: clamp((archetype === 'verdant' ? 0.92 : sparse ? 0.38 : 0.68) + seededUnit(seed, 620) * 0.12, 0.22, 1),
    faunaScaleBias: clamp((archetype === 'verdant' || archetype === 'frozen' ? 0.72 : 0.48) + seededUnit(seed, 621) * 0.16, 0.25, 0.95),
    negativeSpace: clamp((sparse ? 0.76 : 0.34) + seededUnit(seed, 622) * 0.14, 0.12, 0.92)
  };
}

function phenomena(ecology: PlanetEcology): PlanetMaterialPhenomena {
  return {
    sandDust: ecology.surfaceEffectWeights.sandDust ?? 0,
    looseSoilLife: ecology.surfaceEffectWeights.looseSoilLife ?? 0,
    pollen: ecology.surfaceEffectWeights.pollen ?? 0,
    frost: ecology.surfaceEffectWeights.frost ?? 0,
    lavaHeat: ecology.surfaceEffectWeights.lavaHeat ?? 0,
    ash: ecology.surfaceEffectWeights.ash ?? 0,
    crystalGlints: ecology.surfaceEffectWeights.crystalGlints ?? 0,
    metallicFlecks: ecology.surfaceEffectWeights.metallicFlecks ?? 0,
    fungalSpores: ecology.surfaceEffectWeights.fungalSpores ?? 0
  };
}

export function buildPlanetArtDirection(seed: number): PlanetArtDirection {
  const s = seed | 0;
  const archetype = archetypeForSeed(s);
  const biome = buildBiomeProfile(s);
  const paletteFamily = selectPaletteFamily(s, archetype);
  const palette = paletteRoles(s, archetype, paletteFamily);
  const richness = clamp(
    0.18 + biome.lushness * 0.58 + (1 - biome.aridity) * 0.16 +
      (archetype === 'volcanic' || archetype === 'metallic' ? -0.18 : 0) +
      (archetype === 'fungal' || archetype === 'verdant' ? 0.18 : 0),
    0.04,
    1
  );
  const ecology = ecologyFor(archetype, richness);
  const accent = archetype === 'anomaly' ? 0.1 : archetype === 'fungal' || archetype === 'crystal' ? 0.085 : 0.065;
  const budgets: PlanetArtBudgets = {
    dominant: 0.64,
    secondary: 0.27,
    accent,
    hazardAccent: archetype === 'volcanic' || archetype === 'frozen' ? 0.05 : 0.035,
    valueContrast: roleContrastScore(palette),
    saturationBudget: paletteFamily === 'alien-iridescent' || paletteFamily === 'fungal-bioglow' ? 0.82 : 0.68
  };

  return {
    seed: s,
    archetype,
    biomeKind: biome.kind,
    styleReference: {
      primary: 'trees',
      secondary: 'grass',
      notes: 'Canopy fullness, branch-aligned foliage, rich leaf color, and wind-coherent tree motion set the target vibe for all procedural layers.'
    },
    paletteFamily,
    palette,
    budgets,
    ecology,
    shape: shapeTokens(s, archetype),
    windDrama: clamp(0.25 + seededUnit(s, 623) * 0.45 + (archetype === 'arid' || archetype === 'frozen' ? 0.22 : 0), 0, 1),
    materialPhenomena: phenomena(ecology),
    qualityHints: {
      densityBiasByProfile: { ULTRA: 1, HIGH: 0.86, MEDIUM: 0.58, LOW: 0.32, POTATO: 0 },
      shaderFeatureBudget: { ULTRA: 1, HIGH: 0.82, MEDIUM: 0.5, LOW: 0.22, POTATO: 0 }
    },
    scores: {
      roleContrast: budgets.valueContrast,
      paletteDiversity: paletteDiversityScore(palette),
      accentBudget: accentBudgetScore(budgets)
    }
  };
}
