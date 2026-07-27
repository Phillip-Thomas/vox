import { seededUnit } from '../../utils/worldCoordinates.ts';
import type { Vec3Tuple } from '../starSystem.ts';
import { COMMODITY_IDS, type CommodityId, type CommodityTier } from './anchorageCommodities.ts';
import { concourseStallSites, type StallSite } from './anchorageDressing.ts';
import type { Market, MarketShock, MarketStock } from './anchorageMarket.ts';
import type { AnchorageDescriptor, CellId } from './anchorageTypes.ts';

/**
 * Vendors: the people behind the counters.
 *
 * A vendor is three things bundled together — a place you can stand, a market you
 * can trade against, and a persona the conversation layer speaks through. Keeping
 * them in one seeded record means the trader who sells you sealed parts is the same
 * one who complains about the seal office, without any of that being authored twice.
 *
 * The persona fields are deliberately small and concrete. They are what gets handed
 * to a language model as a character sheet, and a model given "brisk, unimpressed,
 * wants a berth of her own, resents the queue" produces a person; a model given a
 * paragraph of atmosphere produces atmosphere.
 */

export interface VendorPersona {
  /** What they sell, in their own words. */
  trade: string;
  /** How they talk. One or two adjectives, no prose. */
  manner: string;
  /** What they are trying to get. Gives a conversation somewhere to go. */
  want: string;
  /** What they are sick of. Gives them something to volunteer unprompted. */
  grievance: string;
  /** Their opening line when the player first steps up. Authored, never generated. */
  greeting: string;
}

export interface Vendor {
  id: string;
  cellId: CellId;
  /** Designation, in the Regulation's register. */
  designation: string;
  /** What people actually call them. */
  name: string;
  /** Point on the counter the player interacts across. */
  counter: Vec3Tuple;
  /** Where the trader stands. */
  stand: Vec3Tuple;
  facing: number;
  specialty: CommodityTier;
  persona: VendorPersona;
  market: Market;
}

/** Designation letters, so a row of stalls does not read as one family. */
const LETTERS = ['M', 'K', 'R', 'V', 'D', 'T', 'H', 'S', 'B', 'N'];

const VERNACULAR = [
  'Six', 'Kite', 'Marget', 'Pell', 'Third', 'Bell', 'Onni', 'Vask',
  'Dray', 'Salt', 'Nine', 'Tam', 'Ro', 'Wick', 'Hob', 'Esk'
];

const MANNER = [
  'brisk, unimpressed',
  'talkative, keeps losing the thread',
  'quiet, weighs everything twice',
  'cheerful in a way that does not reach the eyes',
  'formal, still uses the old forms',
  'tired, honest about it'
];

const WANT = [
  'a berth of her own instead of a contract',
  'one clean manifest, just once',
  'passage out for a relative still dockside',
  'the seal office to answer a query filed two years ago',
  'enough put by to stop taking restricted lots',
  'somebody to confirm she is not imagining the schedule'
];

const GRIEVANCE = [
  'the queue at the Counter never moves before third shift',
  'tariffs went up again and nobody posted a notice',
  'the last resettlement took half a pallet and gave back a different one',
  'haulers who quote volume and deliver mass',
  'inspectors who weigh the crate and never read the seal',
  'the overhead fittings on this row have been out for a month'
];

/** Which commodities a stall of each specialty actually stocks. */
const STOCK_BY_SPECIALTY: Record<CommodityTier, CommodityId[]> = {
  bulk: ['ore', 'water', 'polymer'],
  certified: ['sealed_parts', 'attested_grain', 'polymer'],
  allowance: ['allowance', 'sealed_parts'],
  restricted: ['aged_lot', 'allowance', 'attested_grain']
};

/**
 * Specialty mix along the row. Mostly honest bulk, a good showing of certified
 * goods, allowances rarer, and exactly the occasional stall willing to discuss a
 * lot that came out of a resettlement with a longer provenance than it went in with.
 */
function specialtyFor(unit: number): CommodityTier {
  if (unit < 0.42) return 'bulk';
  if (unit < 0.76) return 'certified';
  if (unit < 0.92) return 'allowance';
  return 'restricted';
}

/**
 * The pitches this anchorage's traders occupy.
 *
 * Separate from `buildAnchorageVendors` because the vendor record carries a live
 * market, and everything that only needs to know *where a trader stands* — the
 * figure rendered behind the counter, a collision assertion, a capture harness —
 * must not be forced to depend on state that changes every time someone buys
 * something. The seed derivation lives here once so nobody re-derives it and puts
 * the shopkeeper two metres inside a wall.
 */
export function anchorageVendorSites(descriptor: AnchorageDescriptor): StallSite[] {
  const concourse = descriptor.graph.cells.find(cell => cell.kind === 'concourse');
  if (!concourse) return [];
  return concourseStallSites(concourse, (descriptor.seed ^ Math.imul(3, 2654435761)) >>> 0);
}

export function buildAnchorageVendors(descriptor: AnchorageDescriptor): Vendor[] {
  const concourse = descriptor.graph.cells.find(cell => cell.kind === 'concourse');
  if (!concourse) return [];

  return anchorageVendorSites(descriptor).map((site, index) => {
    const salt = index * 101 + 7;
    const specialty = specialtyFor(seededUnit(descriptor.seed, salt));
    const letter = LETTERS[Math.floor(seededUnit(descriptor.seed, salt + 1) * LETTERS.length)];
    const digits = 1_000 + Math.floor(seededUnit(descriptor.seed, salt + 2) * 8_999);
    const name = VERNACULAR[Math.floor(seededUnit(descriptor.seed, salt + 3) * VERNACULAR.length)];

    const persona: VendorPersona = {
      trade: tradeLine(specialty),
      manner: MANNER[Math.floor(seededUnit(descriptor.seed, salt + 4) * MANNER.length)],
      want: WANT[Math.floor(seededUnit(descriptor.seed, salt + 5) * WANT.length)],
      grievance: GRIEVANCE[Math.floor(seededUnit(descriptor.seed, salt + 6) * GRIEVANCE.length)],
      greeting: greetingFor(specialty, seededUnit(descriptor.seed, salt + 7))
    };

    return {
      id: `vendor-${index}`,
      cellId: concourse.id,
      designation: `${letter}-${digits}`,
      name,
      counter: site.counter,
      stand: site.stand,
      facing: site.facing,
      specialty,
      persona,
      market: buildVendorMarket(`vendor-${index}`, specialty, descriptor.seed, salt)
    };
  });
}

function tradeLine(specialty: CommodityTier): string {
  switch (specialty) {
    case 'bulk':
      return 'ore, water and polymer stock — honest weight, thin margins';
    case 'certified':
      return 'sealed parts and attested goods — the seal is what you are paying for';
    case 'allowance':
      return 'production allowances — the right to make a thing, not the thing';
    default:
      return 'lots with unusual provenance, discussed quietly';
  }
}

function greetingFor(specialty: CommodityTier, unit: number): string {
  const options: Record<CommodityTier, string[]> = {
    bulk: [
      'weight or volume? i price both, you will prefer one.',
      'nothing here is rare. that is rather the point of it.'
    ],
    certified: [
      'you are buying the seal. the crate comes free.',
      'i can attest to all of it. i can attest to the attestation, if you like.'
    ],
    allowance: [
      'permission is the only stock that does not spoil.',
      'you want to make something. i sell the part where you are allowed to.'
    ],
    restricted: [
      'ask about the ordinary shelf first. we can get to the other one.',
      'i keep two ledgers. the interesting one is not on the counter.'
    ]
  };
  const list = options[specialty];
  return list[Math.floor(unit * list.length) % list.length];
}

function buildVendorMarket(
  id: string,
  specialty: CommodityTier,
  seed: number,
  salt: number
): Market {
  const stocked = STOCK_BY_SPECIALTY[specialty];
  const lines: MarketStock[] = stocked.map((commodityId, i) => {
    const roll = seededUnit(seed, salt + 30 + i * 3);
    const capacity = Math.round(180 + roll * 900);
    // Equilibrium sits away from the middle so no two stalls quote the same price
    // for the same good — the row itself is an arbitrage opportunity.
    const equilibrium = capacity * (0.25 + seededUnit(seed, salt + 31 + i * 3) * 0.55);
    return {
      commodity: commodityId,
      stock: equilibrium * (0.6 + seededUnit(seed, salt + 32 + i * 3) * 0.8),
      capacity,
      equilibrium,
      tau: 240 + seededUnit(seed, salt + 33 + i * 3) * 900
    };
  });

  return {
    id,
    lastTick: 0,
    lines,
    shocks: buildShocks(stocked, seed, salt),
    history: []
  };
}

/**
 * Scheduled disruptions.
 *
 * Shipped before any production chain, deliberately. A static supply model with a
 * war on feels alive; a perfectly balanced chain at equilibrium is a lookup table.
 * Reasons are written to be quotable — a vendor asked why a price moved should have
 * something specific to say.
 */
const SHOCK_REASONS = [
  'a hauler went missing on the inbound leg',
  'the resettlement took a bonded pallet with it',
  'tariff notice landed with no warning',
  'the Counter suspended a seal batch pending query',
  'somebody bought the whole shelf yesterday',
  'an inbound convoy arrived three days early'
];

function buildShocks(stocked: CommodityId[], seed: number, salt: number): MarketShock[] {
  const shocks: MarketShock[] = [];
  const count = 2 + Math.floor(seededUnit(seed, salt + 60) * 4);
  for (let i = 0; i < count; i++) {
    const roll = seededUnit(seed, salt + 70 + i * 4);
    const target = stocked[Math.floor(seededUnit(seed, salt + 71 + i * 4) * stocked.length)];
    const magnitude = 40 + seededUnit(seed, salt + 72 + i * 4) * 260;
    shocks.push({
      at: 60 + i * 240 + seededUnit(seed, salt + 73 + i * 4) * 180,
      commodity: target,
      // Losses outnumber windfalls, which is what keeps a market from settling.
      delta: roll < 0.68 ? -magnitude : magnitude * 0.7,
      reason: SHOCK_REASONS[Math.floor(roll * SHOCK_REASONS.length) % SHOCK_REASONS.length]
    });
  }
  return shocks.sort((a, b) => a.at - b.at);
}

/** Commodities this vendor will discuss at all. */
export function vendorStock(vendor: Vendor): CommodityId[] {
  return vendor.market.lines.map(line => line.commodity);
}

export { COMMODITY_IDS };
