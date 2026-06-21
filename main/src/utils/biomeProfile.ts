import { seededUnit } from './worldCoordinates';
import { buildTreeProfile } from './treeProfile';

// --- Per-planet BIOME profile ------------------------------------------------
//
// The shared "what kind of world is this" anchor. Pure + deterministic:
// terrainSeed -> a climate (lushness / aridity / temperature) + a vegetation
// hue. Grass derives its density/height/dryness/colour from this (grassProfile),
// and trees/terrain/atmosphere can derive from it later so a planet reads as ONE
// cohesive biome instead of unrelated props.
//
// COHESION: the vegetation hue is pulled from this planet's TREE-leaf hue, so
// grass + canopy share a colour family. VARIETY comes from the climate axes —
// two green planets can still be a sparse short savanna vs a dense tall jungle.

export type BiomeKind =
  | 'verdant'    // lush, dense, deep green
  | 'temperate'  // balanced meadow
  | 'sparse'     // thin, short cover
  | 'arid'       // dry, golden, patchy
  | 'alien';     // non-green vegetation (teal/violet/coral/amber)

export interface BiomeProfile {
  seed: number;
  kind: BiomeKind;
  /** 0 sparse/short .. 1 dense/tall. Drives grass density + height. */
  lushness: number;
  /** 0 wet/green .. 1 desert. Drives dryness + golden bleaching + bare patches. */
  aridity: number;
  /** 0 cold .. 1 hot. Small hue bias (cold -> cooler, hot -> warmer). */
  temperature: number;
  /** Primary vegetation hue (sRGB 0..1), cohered with the trees. */
  hue: number;
  /** Base vegetation saturation. */
  saturation: number;
  /** True when vegetation sits outside the green family (alien accent planet). */
  alien: boolean;
}

const SALT_LUSH = 51;
const SALT_ARID = 52;
const SALT_TEMP = 53;
const SALT_HUEJIT = 54;
const SALT_SAT = 55;

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

const _hsl = { h: 0, s: 0, l: 0 };

/**
 * Build the deterministic per-planet biome. Same seed -> identical biome.
 */
export function buildBiomeProfile(seed: number): BiomeProfile {
  const s = seed | 0;

  // Cohesion: read the planet's tree-leaf hue (linear -> sRGB for HSL).
  const leaf = buildTreeProfile(s).leafColor.clone().convertLinearToSRGB();
  leaf.getHSL(_hsl);
  const baseHue = _hsl.h;
  // Alien when the leaf hue is outside the green family (~matches treeProfile's
  // ~30% alien rate). Green family is roughly hue 0.18 .. 0.46.
  const alien = !(baseHue > 0.18 && baseHue < 0.46);

  const lushness = seededUnit(s, SALT_LUSH); // 0..1, full range -> dramatic spread
  // Aridity skews wetter, and lush worlds resist drying.
  let aridity = Math.pow(seededUnit(s, SALT_ARID), 1.3);
  aridity = clamp(aridity * (1.25 - lushness * 0.6), 0, 1);
  const temperature = seededUnit(s, SALT_TEMP);

  const hue = (baseHue + (seededUnit(s, SALT_HUEJIT) - 0.5) * 0.06 + 1) % 1;
  const saturation = clamp(0.42 + seededUnit(s, SALT_SAT) * 0.36 - aridity * 0.22, 0.12, 0.88);

  let kind: BiomeKind;
  if (alien) kind = 'alien';
  else if (aridity > 0.58) kind = 'arid';
  else if (lushness > 0.66) kind = 'verdant';
  else if (lushness < 0.34) kind = 'sparse';
  else kind = 'temperate';

  return { seed: s, kind, lushness, aridity, temperature, hue, saturation, alien };
}
