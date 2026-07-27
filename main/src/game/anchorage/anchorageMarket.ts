import { commodity, priceBand, type CommodityId } from './anchorageCommodities.ts';

/**
 * The market model.
 *
 * Three decisions carry almost all of the behaviour, and each is here for a reason
 * that outlives the sandbox:
 *
 * **Reservoir pricing.** A market holds stock; price is a convex function of how
 * full it is. Not a lookup table, not a static band — the number moves because the
 * shelf is emptier.
 *
 * **Integral pricing with finite depth.** A trade is never priced at spot. Buying q
 * units costs the integral of the price curve across the stock it consumes, so the
 * marginal price rises as you fill your hold. This one property delivers price
 * impact, diminishing returns on a route, bot resistance, and — crucially —
 * multiplayer safety, because there is no quantity at which an NPC will keep
 * trading at a fixed number. An NPC with unbounded depth is a money printer the day
 * two players can both reach it.
 *
 * **Lazy closed-form catch-up.** Nothing ticks. Stock relaxes toward equilibrium on
 * read, in closed form, so a galaxy of markets costs nothing until someone looks at
 * one. Shocks are a sorted event queue applied during that catch-up, and shocks are
 * where the drama lives: a market at equilibrium is a lookup table no matter how
 * elegant its production chain.
 *
 * Everything here is pure. The same functions will run server-side unchanged.
 */

/** Curve exponent. Above 1 makes shortages spike rather than drift. */
const PRICE_EXPONENT = 1.8;
/** Fraction of capacity a market will not sell below. Nobody clears their shelf. */
const RESERVE_FRACTION = 0.04;
/**
 * The vendor's cut, applied each way.
 *
 * Without it the buy and sell curves are the same function and a round trip returns
 * exactly what it cost — the market becomes a free store of value and a player can
 * churn it forever at no cost. The margin is also the economy's first and most
 * important sink: the fee is *deleted*, not paid to anyone, so trading volume drains
 * currency instead of moving it sideways. Logging it from the first commit matters,
 * because by the time inflation is visible in play it is a year of accumulated money
 * and the only remaining fixes are unpopular.
 */
export const VENDOR_MARGIN = 0.065;

export interface MarketStock {
  commodity: CommodityId;
  /** Units currently held. */
  stock: number;
  /** Units at which price bottoms out. */
  capacity: number;
  /** Stock this market relaxes toward when left alone. */
  equilibrium: number;
  /** Relaxation time constant, seconds. Larger means shortages persist. */
  tau: number;
}

export interface MarketShock {
  /** Simulation time the shock lands. */
  at: number;
  commodity: CommodityId;
  /** Signed change in units. Negative is a raid, a loss, a blockade. */
  delta: number;
  /** Shown to the player when they ask why a price moved. */
  reason: string;
}

export interface Market {
  id: string;
  /** Simulation time the stocks were last brought current. */
  lastTick: number;
  lines: MarketStock[];
  /** Sorted ascending by `at`. Consumed as time passes. */
  shocks: MarketShock[];
  /** Shocks already applied, newest first. The vendor can talk about these. */
  history: MarketShock[];
}

export interface Quote {
  commodity: CommodityId;
  /** Units the market will actually transact. May be less than requested. */
  units: number;
  /** Total credits for those units, integrated across the curve. */
  total: number;
  /** total / units, or 0 when nothing is on offer. */
  average: number;
  /** Price of the next unit after this trade — what the player sees move. */
  marginal: number;
  /** Price of the first unit, so the UI can show the impact of its own size. */
  spot: number;
  /** Credits destroyed by this trade. A sink, not a transfer. */
  fee: number;
}

export function spotPrice(id: CommodityId, stock: number, capacity: number): number {
  const { min, max } = priceBand(id);
  const fill = clamp(stock / Math.max(capacity, 1e-6), 0, 1);
  return min + (max - min) * Math.pow(1 - fill, PRICE_EXPONENT);
}

/**
 * Antiderivative of the price curve with respect to stock.
 *
 * The cost of a trade is a difference of this at two stock levels, which is exact
 * and needs no iteration regardless of how many units are moved at once.
 */
function priceIntegral(id: CommodityId, stock: number, capacity: number): number {
  const { min, max } = priceBand(id);
  const c = Math.max(capacity, 1e-6);
  const u = clamp(1 - stock / c, 0, 1);
  const k = PRICE_EXPONENT;
  return min * stock - ((max - min) * c) / (k + 1) * Math.pow(u, k + 1);
}

export function findLine(market: Market, id: CommodityId): MarketStock | null {
  return market.lines.find(line => line.commodity === id) ?? null;
}

/** What the market charges the player to buy `units` from it. */
export function quoteBuy(market: Market, id: CommodityId, units: number): Quote {
  const line = findLine(market, id);
  if (!line || units <= 0) return emptyQuote(id, line, market);

  const reserve = line.capacity * RESERVE_FRACTION;
  const available = Math.max(0, line.stock - reserve);
  const traded = Math.min(units, available);
  if (traded <= 0) return emptyQuote(id, line, market);

  const after = line.stock - traded;
  const base = priceIntegral(id, line.stock, line.capacity) - priceIntegral(id, after, line.capacity);
  const total = base * (1 + VENDOR_MARGIN);

  return {
    commodity: id,
    units: traded,
    total,
    average: total / traded,
    marginal: spotPrice(id, after, line.capacity),
    spot: spotPrice(id, line.stock, line.capacity),
    fee: total - base
  };
}

/** What the market pays the player to take `units` off them. */
export function quoteSell(market: Market, id: CommodityId, units: number): Quote {
  const line = findLine(market, id);
  if (!line || units <= 0) return emptyQuote(id, line, market);

  const room = Math.max(0, line.capacity - line.stock);
  const traded = Math.min(units, room);
  if (traded <= 0) return emptyQuote(id, line, market);

  const after = line.stock + traded;
  const base = priceIntegral(id, after, line.capacity) - priceIntegral(id, line.stock, line.capacity);
  const total = base * (1 - VENDOR_MARGIN);

  return {
    commodity: id,
    units: traded,
    total,
    average: total / traded,
    marginal: spotPrice(id, after, line.capacity),
    spot: spotPrice(id, line.stock, line.capacity),
    fee: base - total
  };
}

/**
 * Commit a quote. Returns a new market; the input is not mutated, so a caller can
 * quote speculatively without having to undo anything.
 */
export function applyTrade(market: Market, quote: Quote, direction: 'buy' | 'sell'): Market {
  if (quote.units <= 0) return market;
  const delta = direction === 'buy' ? -quote.units : quote.units;
  return {
    ...market,
    lines: market.lines.map(line =>
      line.commodity === quote.commodity
        ? { ...line, stock: clamp(line.stock + delta, 0, line.capacity) }
        : line
    )
  };
}

/**
 * Bring a market current to `now`.
 *
 * Stock relaxes exponentially toward equilibrium, and any shocks scheduled in the
 * elapsed window are applied at the point they land — so a raid that happened while
 * you were three jumps away has had time to partly recover by the time you arrive,
 * exactly as it would have if anyone had been simulating it.
 */
export function advanceMarket(market: Market, now: number): Market {
  if (now <= market.lastTick) return market;

  const due = market.shocks.filter(shock => shock.at <= now);
  const pending = market.shocks.filter(shock => shock.at > now);

  let lines = market.lines;
  let cursor = market.lastTick;

  const relaxTo = (target: number) => {
    const dt = target - cursor;
    if (dt <= 0) return;
    lines = lines.map(line => {
      const decay = Math.exp(-dt / Math.max(line.tau, 1e-6));
      const next = line.equilibrium + (line.stock - line.equilibrium) * decay;
      return { ...line, stock: clamp(next, 0, line.capacity) };
    });
    cursor = target;
  };

  for (const shock of due) {
    relaxTo(Math.max(shock.at, market.lastTick));
    lines = lines.map(line =>
      line.commodity === shock.commodity
        ? { ...line, stock: clamp(line.stock + shock.delta, 0, line.capacity) }
        : line
    );
  }
  relaxTo(now);

  return {
    ...market,
    lastTick: now,
    lines,
    shocks: pending,
    history: [...due.reverse(), ...market.history].slice(0, 8)
  };
}

/**
 * A player's view of a market they are not standing in.
 *
 * Prices age. A quote from three jumps away and six hours ago is a bet, not a fact,
 * and making that explicit is what turns trading from arithmetic into judgement.
 */
export interface MarketObservation {
  marketId: string;
  commodity: CommodityId;
  price: number;
  observedAt: number;
  /** 1 at the moment of observation, decaying with age. */
  confidence: number;
}

/** Confidence halves roughly every `STALENESS_HALF_LIFE` seconds. */
const STALENESS_HALF_LIFE = 900;

export function observationConfidence(observedAt: number, now: number): number {
  const age = Math.max(0, now - observedAt);
  return clamp(Math.pow(0.5, age / STALENESS_HALF_LIFE), 0, 1);
}

export function observeMarket(market: Market, now: number): MarketObservation[] {
  return market.lines.map(line => ({
    marketId: market.id,
    commodity: line.commodity,
    price: spotPrice(line.commodity, line.stock, line.capacity),
    observedAt: now,
    confidence: 1
  }));
}

/** Total cargo volume of a holding, for capacity checks. */
export function cargoVolume(holding: Partial<Record<CommodityId, number>>): number {
  let total = 0;
  for (const [id, units] of Object.entries(holding)) {
    if (!units) continue;
    total += commodity(id as CommodityId).volume * units;
  }
  return total;
}

function emptyQuote(id: CommodityId, line: MarketStock | null, _market: Market): Quote {
  const spot = line ? spotPrice(id, line.stock, line.capacity) : 0;
  return { commodity: id, units: 0, total: 0, average: 0, marginal: spot, spot, fee: 0 };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
