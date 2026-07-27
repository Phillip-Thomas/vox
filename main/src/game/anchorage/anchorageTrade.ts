import type { Vec3Tuple } from '../starSystem.ts';
import { commodity, type CommodityId } from './anchorageCommodities.ts';
import {
  advanceMarket,
  applyTrade,
  cargoVolume,
  quoteBuy,
  quoteSell,
  type Market,
  type Quote
} from './anchorageMarket.ts';
import type { Vendor } from './anchorageVendors.ts';

/**
 * The player's side of a trade, and the reach test that decides who they are
 * talking to.
 *
 * Pure. A trade is proposed, checked and committed as three separate steps so the UI
 * can show exactly why something is refused rather than greying a button out.
 */

/** How close the player must be to a counter to trade across it. */
export const COUNTER_REACH = 3.2;
/** How near the counter's facing the player must be looking. cos of the half-angle. */
const FACING_TOLERANCE = 0.25;

export interface TraderState {
  credits: number;
  hold: Partial<Record<CommodityId, number>>;
  /** Cargo volume in cubic metres. The real constraint on a run. */
  capacity: number;
  /** Running total of credits destroyed by vendor margins. Telemetry, not score. */
  feesPaid: number;
}

export function createTrader(credits = 2_400, capacity = 120): TraderState {
  return { credits, hold: {}, capacity, feesPaid: 0 };
}

export function heldUnits(trader: TraderState, id: CommodityId): number {
  return trader.hold[id] ?? 0;
}

export function usedVolume(trader: TraderState): number {
  return cargoVolume(trader.hold);
}

export function freeVolume(trader: TraderState): number {
  return Math.max(0, trader.capacity - usedVolume(trader));
}

export type TradeRefusal =
  | 'none'
  | 'vendor-has-none'
  | 'cannot-afford'
  | 'hold-full'
  | 'nothing-to-sell'
  | 'vendor-has-no-room';

export interface TradeProposal {
  quote: Quote;
  /** Units actually transactable after money and cargo limits. */
  units: number;
  /** Credits moved for those units. */
  total: number;
  refusal: TradeRefusal;
}

/**
 * What the player could actually do, given the vendor's depth, their money and
 * their remaining hold. Returns a reason rather than silently clamping to zero.
 */
export function proposeBuy(
  trader: TraderState,
  market: Market,
  id: CommodityId,
  requested: number
): TradeProposal {
  const offered = quoteBuy(market, id, requested);
  if (offered.units <= 0) {
    return { quote: offered, units: 0, total: 0, refusal: 'vendor-has-none' };
  }

  const perUnitVolume = commodity(id).volume;
  const volumeLimit = perUnitVolume > 0 ? Math.floor(freeVolume(trader) / perUnitVolume) : requested;
  if (volumeLimit <= 0) {
    return { quote: offered, units: 0, total: 0, refusal: 'hold-full' };
  }

  // Affordability has to be solved against the integral, not the average, because
  // the price rises as the trade proceeds. Bisection on units is exact enough and
  // avoids inverting the curve analytically.
  const affordable = largestAffordable(market, id, Math.min(offered.units, volumeLimit), trader.credits);
  if (affordable <= 0) {
    return { quote: offered, units: 0, total: 0, refusal: 'cannot-afford' };
  }

  const final = quoteBuy(market, id, affordable);
  return {
    quote: final,
    units: final.units,
    total: final.total,
    refusal: affordable < Math.min(offered.units, volumeLimit) ? 'cannot-afford' : 'none'
  };
}

export function proposeSell(
  trader: TraderState,
  market: Market,
  id: CommodityId,
  requested: number
): TradeProposal {
  const held = heldUnits(trader, id);
  if (held <= 0) {
    return { quote: quoteSell(market, id, 0), units: 0, total: 0, refusal: 'nothing-to-sell' };
  }
  const wanted = Math.min(requested, held);
  const offered = quoteSell(market, id, wanted);
  if (offered.units <= 0) {
    return { quote: offered, units: 0, total: 0, refusal: 'vendor-has-no-room' };
  }
  return {
    quote: offered,
    units: offered.units,
    total: offered.total,
    refusal: offered.units < wanted ? 'vendor-has-no-room' : 'none'
  };
}

export interface TradeResult {
  trader: TraderState;
  market: Market;
  proposal: TradeProposal;
}

export function commitBuy(
  trader: TraderState,
  market: Market,
  proposal: TradeProposal
): TradeResult {
  if (proposal.units <= 0) return { trader, market, proposal };
  const id = proposal.quote.commodity;
  return {
    trader: {
      ...trader,
      credits: trader.credits - proposal.total,
      feesPaid: trader.feesPaid + proposal.quote.fee,
      hold: { ...trader.hold, [id]: heldUnits(trader, id) + proposal.units }
    },
    market: applyTrade(market, proposal.quote, 'buy'),
    proposal
  };
}

export function commitSell(
  trader: TraderState,
  market: Market,
  proposal: TradeProposal
): TradeResult {
  if (proposal.units <= 0) return { trader, market, proposal };
  const id = proposal.quote.commodity;
  const remaining = heldUnits(trader, id) - proposal.units;
  const hold = { ...trader.hold };
  if (remaining > 1e-9) hold[id] = remaining;
  else delete hold[id];

  return {
    trader: {
      ...trader,
      credits: trader.credits + proposal.total,
      feesPaid: trader.feesPaid + proposal.quote.fee,
      hold
    },
    market: applyTrade(market, proposal.quote, 'sell'),
    proposal
  };
}

/** Largest unit count whose integrated cost fits the budget. */
function largestAffordable(
  market: Market,
  id: CommodityId,
  ceiling: number,
  budget: number
): number {
  if (quoteBuy(market, id, ceiling).total <= budget) return ceiling;
  let low = 0;
  let high = ceiling;
  for (let i = 0; i < 40; i++) {
    const mid = (low + high) / 2;
    if (quoteBuy(market, id, mid).total <= budget) low = mid;
    else high = mid;
  }
  return Math.floor(low);
}

export interface VendorReach {
  vendor: Vendor;
  distance: number;
}

/**
 * The vendor the player is close enough to, and facing.
 *
 * Distance alone puts you in conversation with whoever is behind you when two rows
 * face each other across a four-metre aisle, so the look direction has to count.
 */
export function vendorInReach(
  vendors: Vendor[],
  position: Vec3Tuple,
  lookDirection: Vec3Tuple
): VendorReach | null {
  let best: VendorReach | null = null;

  for (const vendor of vendors) {
    const dx = vendor.counter[0] - position[0];
    const dz = vendor.counter[2] - position[2];
    const distance = Math.hypot(dx, dz);
    if (distance > COUNTER_REACH) continue;
    if (distance > 1e-6) {
      const dot = (dx * lookDirection[0] + dz * lookDirection[2]) / distance;
      if (dot < FACING_TOLERANCE) continue;
    }
    if (!best || distance < best.distance) best = { vendor, distance };
  }
  return best;
}

/** Bring every vendor's market current. Cheap: closed-form, no ticking. */
export function advanceVendors(vendors: Vendor[], now: number): Vendor[] {
  return vendors.map(vendor => {
    const market = advanceMarket(vendor.market, now);
    return market === vendor.market ? vendor : { ...vendor, market };
  });
}

export function refusalText(refusal: TradeRefusal): string {
  switch (refusal) {
    case 'vendor-has-none':
      return 'none on the shelf.';
    case 'cannot-afford':
      return 'not enough credits.';
    case 'hold-full':
      return 'hold is full.';
    case 'nothing-to-sell':
      return 'you are not carrying any.';
    case 'vendor-has-no-room':
      return 'no room for more.';
    default:
      return '';
  }
}
