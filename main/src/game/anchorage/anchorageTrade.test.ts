import { describe, expect, it } from 'vitest';
import { buildAnchorageDescriptor } from './anchorageDescriptor.ts';
import { findLine, spotPrice, type Market } from './anchorageMarket.ts';
import {
  advanceVendors,
  commitBuy,
  commitSell,
  createTrader,
  freeVolume,
  heldUnits,
  proposeBuy,
  proposeSell,
  usedVolume,
  vendorInReach,
  COUNTER_REACH
} from './anchorageTrade.ts';
import { buildAnchorageVendors } from './anchorageVendors.ts';

const descriptor = buildAnchorageDescriptor({ system: { x: -19, y: -17 }, index: 0 });
const vendors = buildAnchorageVendors(descriptor);

function oreMarket(stock = 500): Market {
  return {
    id: 'm',
    lastTick: 0,
    lines: [{ commodity: 'ore', stock, capacity: 1_000, equilibrium: 500, tau: 300 }],
    shocks: [],
    history: []
  };
}

describe('vendor generation', () => {
  it('produces a populated row with a mix of specialties', () => {
    expect(vendors.length).toBeGreaterThan(8);
    const specialties = new Set(vendors.map(vendor => vendor.specialty));
    expect(specialties.size).toBeGreaterThan(1);
    expect(specialties.has('bulk')).toBe(true);
  });

  it('gives every vendor a stocked market and a complete persona', () => {
    for (const vendor of vendors) {
      expect(vendor.market.lines.length).toBeGreaterThan(0);
      expect(vendor.persona.trade.length).toBeGreaterThan(0);
      expect(vendor.persona.manner.length).toBeGreaterThan(0);
      expect(vendor.persona.want.length).toBeGreaterThan(0);
      expect(vendor.persona.grievance.length).toBeGreaterThan(0);
      expect(vendor.persona.greeting.length).toBeGreaterThan(0);
      expect(vendor.designation).toMatch(/^[A-Z]-\d{4}$/);
    }
  });

  it('is deterministic for a descriptor', () => {
    const again = buildAnchorageVendors(descriptor);
    expect(again.map(v => `${v.designation}:${v.specialty}`)).toEqual(
      vendors.map(v => `${v.designation}:${v.specialty}`)
    );
  });

  it('prices the same good differently across the row, so the row is arbitrage', () => {
    const oreSellers = vendors.filter(vendor =>
      vendor.market.lines.some(line => line.commodity === 'ore')
    );
    expect(oreSellers.length).toBeGreaterThan(1);
    const prices = oreSellers.map(vendor => {
      const line = findLine(vendor.market, 'ore')!;
      return spotPrice('ore', line.stock, line.capacity);
    });
    expect(Math.max(...prices) - Math.min(...prices)).toBeGreaterThan(0.5);
  });
});

describe('reach', () => {
  const vendor = vendors[0];
  const towardCounter = (from: [number, number, number]): [number, number, number] => {
    const dx = vendor.counter[0] - from[0];
    const dz = vendor.counter[2] - from[2];
    const length = Math.hypot(dx, dz) || 1;
    return [dx / length, 0, dz / length];
  };
  /** A point in the aisle, on the opposite side of the counter from the trader. */
  const aisleSide = Math.sign(vendor.counter[2] - vendor.stand[2]) || 1;
  const standing = (gap: number): [number, number, number] => [
    vendor.counter[0],
    0,
    vendor.counter[2] + aisleSide * gap
  ];

  it('finds the vendor when close and facing them', () => {
    const from = standing(1.4);
    const reach = vendorInReach(vendors, from, towardCounter(from));
    expect(reach?.vendor.id).toBe(vendor.id);
  });

  it('finds nobody when facing away', () => {
    const from = standing(1.4);
    const away = towardCounter(from);
    expect(vendorInReach(vendors, from, [-away[0], 0, -away[2]])).toBeNull();
  });

  it('finds nobody from across the room', () => {
    const from: [number, number, number] = [vendor.counter[0] + 400, 0, vendor.counter[2]];
    expect(vendorInReach(vendors, from, towardCounter(from))).toBeNull();
  });

  it('respects the stated reach distance', () => {
    const from = standing(COUNTER_REACH + 0.5);
    expect(vendorInReach(vendors, from, towardCounter(from))).toBeNull();
  });
});

describe('buying', () => {
  it('moves goods and money, and records the fee', () => {
    const trader = createTrader(5_000, 200);
    const market = oreMarket();
    const proposal = proposeBuy(trader, market, 'ore', 50);
    expect(proposal.refusal).toBe('none');

    const result = commitBuy(trader, market, proposal);
    expect(heldUnits(result.trader, 'ore')).toBe(50);
    expect(result.trader.credits).toBeCloseTo(5_000 - proposal.total, 6);
    expect(result.trader.feesPaid).toBeGreaterThan(0);
    expect(findLine(result.market, 'ore')!.stock).toBeCloseTo(450, 6);
  });

  it('refuses when the hold is full and says so', () => {
    const trader = { ...createTrader(50_000, 10), hold: { ore: 10 } };
    const proposal = proposeBuy(trader, oreMarket(), 'ore', 50);
    expect(proposal.refusal).toBe('hold-full');
    expect(proposal.units).toBe(0);
  });

  it('never lets the player spend more than they have', () => {
    const trader = createTrader(200, 500);
    const market = oreMarket();
    const proposal = proposeBuy(trader, market, 'ore', 400);
    expect(proposal.total).toBeLessThanOrEqual(200);
    const result = commitBuy(trader, market, proposal);
    expect(result.trader.credits).toBeGreaterThanOrEqual(0);
  });

  it('accounts for the rising price when solving affordability', () => {
    const trader = createTrader(1_000, 500);
    const market = oreMarket();
    const proposal = proposeBuy(trader, market, 'ore', 1_000);
    // Priced at flat spot this budget would buy noticeably more than the integral
    // allows, so a naive credits/spot would overspend.
    const naive = 1_000 / proposal.quote.spot;
    expect(proposal.units).toBeLessThan(naive);
    expect(proposal.total).toBeLessThanOrEqual(1_000 + 1e-6);
  });

  it('respects cargo volume rather than unit count', () => {
    const trader = createTrader(500_000, 10);
    const market: Market = {
      id: 'm',
      lastTick: 0,
      lines: [{ commodity: 'allowance', stock: 90, capacity: 100, equilibrium: 90, tau: 300 }],
      shocks: [],
      history: []
    };
    // Allowances are 0.02 m³, so a 10 m³ hold takes hundreds of them.
    const proposal = proposeBuy(trader, market, 'allowance', 80);
    expect(proposal.units).toBeGreaterThan(50);
    expect(usedVolume(commitBuy(trader, market, proposal).trader)).toBeLessThanOrEqual(10 + 1e-6);
  });
});

describe('selling', () => {
  it('refuses what the player does not carry', () => {
    const proposal = proposeSell(createTrader(), oreMarket(), 'ore', 10);
    expect(proposal.refusal).toBe('nothing-to-sell');
  });

  it('returns money, frees the hold, and clears the line when emptied', () => {
    const trader = { ...createTrader(0, 200), hold: { ore: 40 } };
    const market = oreMarket(400);
    const proposal = proposeSell(trader, market, 'ore', 40);
    const result = commitSell(trader, market, proposal);

    expect(result.trader.credits).toBeGreaterThan(0);
    expect(heldUnits(result.trader, 'ore')).toBe(0);
    expect('ore' in result.trader.hold).toBe(false);
    expect(freeVolume(result.trader)).toBeCloseTo(200, 6);
  });

  it('caps at the room the vendor has left', () => {
    const trader = { ...createTrader(0, 5_000), hold: { ore: 900 } };
    const proposal = proposeSell(trader, oreMarket(950), 'ore', 900);
    expect(proposal.units).toBe(50);
    expect(proposal.refusal).toBe('vendor-has-no-room');
  });
});

describe('a run round the row loses money on churn', () => {
  it('cannot be farmed by buying and reselling at the same stall', () => {
    let trader = createTrader(6_000, 400);
    let market = oreMarket();

    for (let i = 0; i < 6; i++) {
      const buy = proposeBuy(trader, market, 'ore', 60);
      ({ trader, market } = commitBuy(trader, market, buy));
      const sell = proposeSell(trader, market, 'ore', 60);
      ({ trader, market } = commitSell(trader, market, sell));
    }

    expect(trader.credits).toBeLessThan(6_000);
    expect(trader.feesPaid).toBeGreaterThan(0);
    // Everything lost went to the sink, nothing leaked into the market's stock.
    expect(findLine(market, 'ore')!.stock).toBeCloseTo(500, 4);
  });
});

describe('vendor advancement', () => {
  it('brings markets current and returns the same object when nothing moved', () => {
    const advanced = advanceVendors(vendors, 1_200);
    expect(advanced[0].market.lastTick).toBe(1_200);
    const again = advanceVendors(advanced, 1_200);
    expect(again[0]).toBe(advanced[0]);
  });

  it('lets scheduled shocks move prices over time', () => {
    const early = advanceVendors(vendors, 30);
    const late = advanceVendors(vendors, 3_000);
    const priceOf = (list: typeof vendors, index: number) => {
      const line = list[index].market.lines[0];
      return spotPrice(line.commodity, line.stock, line.capacity);
    };
    const moved = vendors.some((_, index) => Math.abs(priceOf(early, index) - priceOf(late, index)) > 0.5);
    expect(moved).toBe(true);
  });
});
