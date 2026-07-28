/**
 * The spaceStation commodity table.
 *
 * NOTE ON PLACEMENT: the shipped economy's single source of truth is
 * `shared/economyCatalog.json`, codegenned into both client and server and gated by
 * `catalog:check`. These commodities live here instead because the spaceStation is a
 * dev-flag sandbox and adding sandbox-only goods to shipped codegen would put them
 * in the demo bundle's catalog for no reason. The shape below mirrors a catalog
 * entry deliberately, so migrating is a move rather than a rewrite — and it must
 * migrate before any of this is reachable in a real build.
 *
 * The tiers carry the fiction. Every system has ore; what differs between them is
 * what is *permitted*. So the ladder runs from honest bulk, through goods whose
 * value is a seal rather than a substance, to the tradeable right to produce at all
 * — which is, literally, the buying and selling of cubicles.
 */

export type CommodityId =
  | 'ore'
  | 'water'
  | 'polymer'
  | 'sealed_parts'
  | 'attested_grain'
  | 'allowance'
  | 'aged_lot';

export type CommodityTier =
  /** Honest matter. Heavy, abundant, thin margins. */
  | 'bulk'
  /** The same crate, worth four times more where the seal is honoured. */
  | 'certified'
  /** The right to produce. Weightless and the most expensive thing here. */
  | 'allowance'
  /** Went through a resettlement and came out re-filed. Priced, and forbidden. */
  | 'restricted';

export interface Commodity {
  id: CommodityId;
  /** Shown to the player. Plain, lowercase — the traders' register, not the Regulation's. */
  name: string;
  tier: CommodityTier;
  /** Cubic metres per unit. Cargo volume is the real constraint on a trade run. */
  volume: number;
  /** Reference price at equilibrium stock. */
  basePrice: number;
  /**
   * How far price swings between glut and shortage, as a fraction of base.
   * 0.5 means price ranges from 0.5x base (full) to 1.5x base (empty).
   */
  spread: number;
  /** One line the vendor UI can show. Explains the tier without a tutorial. */
  note: string;
}

export const COMMODITIES: Record<CommodityId, Commodity> = {
  ore: {
    id: 'ore',
    name: 'ore',
    tier: 'bulk',
    volume: 1,
    basePrice: 12,
    spread: 0.45,
    note: 'every system has it. that is the problem with it.'
  },
  water: {
    id: 'water',
    name: 'water',
    tier: 'bulk',
    volume: 1,
    basePrice: 18,
    spread: 0.55,
    note: 'cheap where it falls. not everywhere does it fall.'
  },
  polymer: {
    id: 'polymer',
    name: 'polymer stock',
    tier: 'bulk',
    volume: 0.7,
    basePrice: 34,
    spread: 0.4,
    note: 'refined once. worth carrying if the hold is already going.'
  },
  sealed_parts: {
    id: 'sealed_parts',
    name: 'sealed parts',
    tier: 'certified',
    volume: 0.4,
    basePrice: 155,
    spread: 0.6,
    note: 'the crate is ordinary. the seal is not.'
  },
  attested_grain: {
    id: 'attested_grain',
    name: 'attested grain',
    tier: 'certified',
    volume: 0.8,
    basePrice: 96,
    spread: 0.7,
    note: 'grain, plus a document saying it is grain.'
  },
  allowance: {
    id: 'allowance',
    name: 'production allowance',
    tier: 'allowance',
    volume: 0.02,
    basePrice: 640,
    spread: 0.85,
    note: 'permission to make a thing. weighs nothing. costs everything.'
  },
  aged_lot: {
    id: 'aged_lot',
    name: 'aged lot',
    tier: 'restricted',
    volume: 0.5,
    basePrice: 1_180,
    spread: 1.05,
    note: 'went in as one lot. came out with a longer provenance.'
  }
};

export const COMMODITY_IDS = Object.keys(COMMODITIES) as CommodityId[];

export function commodity(id: CommodityId): Commodity {
  return COMMODITIES[id];
}

/** Price at empty stock and at full stock, from base and spread. */
export function priceBand(id: CommodityId): { min: number; max: number } {
  const entry = COMMODITIES[id];
  return {
    min: entry.basePrice * (1 - entry.spread),
    max: entry.basePrice * (1 + entry.spread)
  };
}
