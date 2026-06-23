import { seededUnit } from './worldCoordinates';
import { archetypeForSeed, PLANET_ARCHETYPES } from '../game/data/planetArchetypes';

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
  /** Primary vegetation hue (sRGB 0..1) — the planet's colour IDENTITY. Water +
   * terrain tint read this directly; grass + canopy read the SPLIT PAIR below. */
  hue: number;
  /** Grass hue: the veg hue shifted one way of a split-complementary PAIR. */
  grassHue: number;
  /** Canopy hue: shifted the OTHER way, so grass + leaves are distinct-but-
   * coordinated complementing colours (not one flat hue). See VEG_PAIR_SPLIT. */
  leafHue: number;
  /** Base vegetation saturation. */
  saturation: number;
  /** True when vegetation sits outside the green family (alien accent planet). */
  alien: boolean;
}

const SALT_LUSH = 51;
const SALT_ARID = 52;
const SALT_TEMP = 53;
const SALT_SAT = 55;
const SALT_VEGHUE = 56;
const SALT_VEGHUE2 = 57;

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

// How strongly a planet's CLIMATE is pulled toward its archetype's climate
// centre. This removes contradictions (no tropical-lush grass on a frozen world)
// WITHOUT collapsing diversity: only lushness/aridity/temperature are reconciled;
// the vegetation HUE / saturation / alien-ness keep their own wide independent
// roll, so e.g. purple grass on a verdant world is preserved by design.
const CLIMATE_RECONCILE = 0.6;

// Bold non-green vegetation accents (sRGB hue 0..1): amber, coral/red, magenta,
// violet, deep blue, cyan-teal. These make alien planets read at a glance.
const ALIEN_VEG_HUES = [0.07, 0.99, 0.90, 0.78, 0.62, 0.50];

// Split-complementary distance between GRASS and CANOPY hues (total, in hue
// units; ~0.20 ≈ 72°). Both stay anchored to the biome identity hue, but sit on
// OPPOSITE sides of it so grass + leaves read as a designed, complementing pair
// instead of the same flat colour. Grass shifts the WARM/yellow way (it's the
// brighter element underfoot), canopy the COOL/blue way (deeper, overhead).
const VEG_PAIR_SPLIT = 0.2;

/**
 * Build the deterministic per-planet biome — the SHARED vegetation/climate anchor
 * that grass (and, next, trees/terrain) derive from. The vegetation hue is its
 * OWN deliberately diverse palette (NOT read back from trees, which were ~70%
 * green and made every planet look the same): ~55% green family spread wide,
 * ~45% bold accent hues. Same seed -> identical biome.
 */
export function buildBiomeProfile(seed: number): BiomeProfile {
  const s = seed | 0;

  // Reconcile the climate axes toward this planet's archetype centre so the
  // climate never contradicts the surface identity (frozen=cold, volcanic=hot,
  // arid=dry). Hue/saturation/alien below are deliberately NOT reconciled.
  const climate = PLANET_ARCHETYPES[archetypeForSeed(s)].climateBias;

  const lushness = clamp(mix(seededUnit(s, SALT_LUSH), climate.lushness, CLIMATE_RECONCILE), 0, 1);
  // Aridity skews wetter, and lush worlds resist drying.
  let aridity = Math.pow(seededUnit(s, SALT_ARID), 1.3);
  aridity = clamp(aridity * (1.25 - lushness * 0.6), 0, 1);
  aridity = clamp(mix(aridity, climate.aridity, CLIMATE_RECONCILE), 0, 1);
  const temperature = clamp(mix(seededUnit(s, SALT_TEMP), climate.temperature, CLIMATE_RECONCILE), 0, 1);

  // Vegetation hue — diverse by design so planets look distinct.
  const hueRoll = seededUnit(s, SALT_VEGHUE);
  let hue: number;
  let alien: boolean;
  if (hueRoll < 0.55) {
    // green family, but a WIDE spread: yellow-green .. emerald .. teal-green.
    hue = 0.18 + seededUnit(s, SALT_VEGHUE2) * 0.30; // 0.18 .. 0.48
    alien = false;
  } else {
    const idx = Math.min(
      ALIEN_VEG_HUES.length - 1,
      Math.floor(seededUnit(s, SALT_VEGHUE2) * ALIEN_VEG_HUES.length)
    );
    hue = ALIEN_VEG_HUES[idx];
    alien = true;
  }
  // Bold saturation so the hue actually reads (arid worlds desaturate somewhat).
  const saturation = clamp(0.5 + seededUnit(s, SALT_SAT) * 0.38 - aridity * 0.2, 0.22, 0.92);

  // Split-complementary veg PAIR around the identity hue: grass warm/yellow side,
  // canopy cool/blue side. Distinct but coordinated (the user's "moderate split").
  const grassHue = (hue - VEG_PAIR_SPLIT / 2 + 1) % 1;
  const leafHue = (hue + VEG_PAIR_SPLIT / 2 + 1) % 1;

  let kind: BiomeKind;
  if (alien) kind = 'alien';
  else if (aridity > 0.58) kind = 'arid';
  else if (lushness > 0.66) kind = 'verdant';
  else if (lushness < 0.34) kind = 'sparse';
  else kind = 'temperate';

  return { seed: s, kind, lushness, aridity, temperature, hue, grassHue, leafHue, saturation, alien };
}
