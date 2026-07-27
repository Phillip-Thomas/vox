import { describe, expect, it } from 'vitest';
import { priceBand, type CommodityId } from './anchorageCommodities.ts';
import {
  advanceMarket,
  applyTrade,
  cargoVolume,
  findLine,
  observationConfidence,
  quoteBuy,
  quoteSell,
  spotPrice,
  type Market
} from './anchorageMarket.ts';

function market(overrides: Partial<Market> = {}): Market {
  return {
    id: 'test',
    lastTick: 0,
    lines: [
      { commodity: 'ore', stock: 500, capacity: 1_000, equilibrium: 500, tau: 300 },
      { commodity: 'allowance', stock: 20, capacity: 100, equilibrium: 20, tau: 900 }
    ],
    shocks: [],
    history: [],
    ...overrides
  };
}

describe('spot price', () => {
  it('is high when empty and low when full, within the commodity band', () => {
    const band = priceBand('ore');
    expect(spotPrice('ore', 0, 1_000)).toBeCloseTo(band.max, 5);
    expect(spotPrice('ore', 1_000, 1_000)).toBeCloseTo(band.min, 5);
    const mid = spotPrice('ore', 500, 1_000);
    expect(mid).toBeGreaterThan(band.min);
    expect(mid).toBeLessThan(band.max);
  });

  it('falls monotonically as stock rises', () => {
    let previous = Infinity;
    for (let stock = 0; stock <= 1_000; stock += 50) {
      const price = spotPrice('ore', stock, 1_000);
      expect(price).toBeLessThanOrEqual(previous + 1e-9);
      previous = price;
    }
  });
});

describe('integral pricing', () => {
  it('charges more per unit than spot when buying, because the shelf empties', () => {
    const m = market();
    const small = quoteBuy(m, 'ore', 1);
    const large = quoteBuy(m, 'ore', 400);
    expect(small.average).toBeGreaterThanOrEqual(small.spot - 1e-6);
    expect(large.average).toBeGreaterThan(small.average);
    // And the price of the next unit has moved up.
    expect(large.marginal).toBeGreaterThan(large.spot);
  });

  it('pays less per unit than spot when selling, because the shelf fills', () => {
    const m = market();
    const small = quoteSell(m, 'ore', 1);
    const large = quoteSell(m, 'ore', 400);
    expect(large.average).toBeLessThan(small.average);
    expect(large.marginal).toBeLessThan(large.spot);
  });

  it('agrees with a numeric integration of the price curve', () => {
    const m = market();
    const units = 300;
    const quote = quoteBuy(m, 'ore', units);

    // Midpoint rule over the same stock range.
    const steps = 6_000;
    const step = units / steps;
    let numeric = 0;
    for (let i = 0; i < steps; i++) {
      const stock = 500 - (i + 0.5) * step;
      numeric += spotPrice('ore', stock, 1_000) * step;
    }
    // The quote carries the vendor's margin on top of the raw integral.
    expect(quote.total - quote.fee).toBeCloseTo(numeric, 2);
  });

  it('is symmetric: selling back what you bought returns the market to where it was', () => {
    const m = market();
    const buy = quoteBuy(m, 'ore', 250);
    const afterBuy = applyTrade(m, buy, 'buy');
    const sell = quoteSell(afterBuy, 'ore', 250);
    const afterSell = applyTrade(afterBuy, sell, 'sell');

    expect(findLine(afterSell, 'ore')!.stock).toBeCloseTo(500, 6);
    // And you lose money doing it. Without a spread the two integrals are identical
    // and a round trip is free, which makes the market a free store of value.
    expect(sell.total).toBeLessThan(buy.total);
    expect(buy.total - sell.total).toBeGreaterThan(buy.total * 0.1);
  });

  it('destroys the fee rather than moving it, so trade drains currency', () => {
    const m = market();
    const buy = quoteBuy(m, 'ore', 200);
    const sell = quoteSell(applyTrade(m, buy, 'buy'), 'ore', 200);
    // The player's loss on a round trip is exactly the two fees.
    expect(buy.total - sell.total).toBeCloseTo(buy.fee + sell.fee, 6);
    expect(buy.fee).toBeGreaterThan(0);
  });
});

describe('finite depth', () => {
  it('never sells the market below its reserve, however much is asked for', () => {
    const m = market();
    const quote = quoteBuy(m, 'ore', 10_000);
    expect(quote.units).toBeLessThan(500);
    const after = applyTrade(m, quote, 'buy');
    expect(findLine(after, 'ore')!.stock).toBeGreaterThan(0);
  });

  it('never accepts more than the market has room for', () => {
    const m = market();
    const quote = quoteSell(m, 'ore', 10_000);
    expect(quote.units).toBe(500);
    const after = applyTrade(m, quote, 'sell');
    expect(findLine(after, 'ore')!.stock).toBeCloseTo(1_000, 6);
  });

  it('quotes nothing rather than throwing for an unstocked commodity', () => {
    const quote = quoteBuy(market(), 'aged_lot', 5);
    expect(quote.units).toBe(0);
    expect(quote.total).toBe(0);
  });
});

describe('a route is profitable, then less so because you traded it', () => {
  it('erodes its own margin as the player works it', () => {
    let m = market();
    const margins: number[] = [];
    for (let run = 0; run < 5; run++) {
      const quote = quoteBuy(m, 'ore', 80);
      margins.push(quote.average);
      m = applyTrade(m, quote, 'buy');
    }
    for (let i = 1; i < margins.length; i++) {
      expect(margins[i]).toBeGreaterThan(margins[i - 1]);
    }
    // Buying got 20%+ more expensive without anyone tuning a cooldown.
    expect(margins[margins.length - 1] / margins[0]).toBeGreaterThan(1.2);
  });
});

describe('lazy catch-up', () => {
  it('relaxes toward equilibrium without ticking', () => {
    const m = market({
      lines: [{ commodity: 'ore', stock: 100, capacity: 1_000, equilibrium: 500, tau: 300 }]
    });
    const after = advanceMarket(m, 300);
    const stock = findLine(after, 'ore')!.stock;
    // One time constant closes ~63% of the gap.
    expect(stock).toBeCloseTo(500 + (100 - 500) * Math.exp(-1), 4);
    expect(after.lastTick).toBe(300);
  });

  it('is path-independent: one long step equals many short ones', () => {
    const start = market({
      lines: [{ commodity: 'ore', stock: 80, capacity: 1_000, equilibrium: 500, tau: 240 }]
    });
    const single = advanceMarket(start, 1_200);

    let stepped = start;
    for (let t = 100; t <= 1_200; t += 100) stepped = advanceMarket(stepped, t);

    expect(findLine(stepped, 'ore')!.stock).toBeCloseTo(findLine(single, 'ore')!.stock, 6);
  });

  it('never runs backwards', () => {
    const m = advanceMarket(market(), 500);
    expect(advanceMarket(m, 100)).toBe(m);
  });
});

describe('shocks', () => {
  it('applies a shock at the point it lands, then keeps relaxing', () => {
    const m = market({
      lines: [{ commodity: 'ore', stock: 500, capacity: 1_000, equilibrium: 500, tau: 600 }],
      shocks: [{ at: 100, commodity: 'ore', delta: -400, reason: 'convoy lost' }]
    });
    const after = advanceMarket(m, 700);
    const stock = findLine(after, 'ore')!.stock;

    // Dropped hard, then partly recovered — not still at 100, not back at 500.
    expect(stock).toBeGreaterThan(100);
    expect(stock).toBeLessThan(500);
    expect(after.shocks).toHaveLength(0);
    expect(after.history[0].reason).toBe('convoy lost');
  });

  it('raises the price of the thing it removed', () => {
    const before = market({
      lines: [{ commodity: 'ore', stock: 500, capacity: 1_000, equilibrium: 500, tau: 6_000 }],
      shocks: [{ at: 10, commodity: 'ore', delta: -350, reason: 'blockade' }]
    });
    const priceBefore = spotPrice('ore', 500, 1_000);
    const after = advanceMarket(before, 20);
    const priceAfter = spotPrice('ore', findLine(after, 'ore')!.stock, 1_000);
    expect(priceAfter).toBeGreaterThan(priceBefore * 1.15);
  });

  it('leaves future shocks pending', () => {
    const m = market({
      shocks: [
        { at: 50, commodity: 'ore', delta: -100, reason: 'now' },
        { at: 5_000, commodity: 'ore', delta: -100, reason: 'later' }
      ]
    });
    const after = advanceMarket(m, 100);
    expect(after.shocks.map(shock => shock.reason)).toEqual(['later']);
  });
});

describe('stale information', () => {
  it('decays confidence with age and never goes negative', () => {
    expect(observationConfidence(0, 0)).toBe(1);
    expect(observationConfidence(0, 900)).toBeCloseTo(0.5, 5);
    expect(observationConfidence(0, 9_000)).toBeGreaterThanOrEqual(0);
    expect(observationConfidence(500, 100)).toBe(1);
  });
});

describe('cargo volume', () => {
  it('sums by commodity volume, not unit count', () => {
    const holding: Partial<Record<CommodityId, number>> = { ore: 100, allowance: 100 };
    // 100 ore at 1.0 plus 100 allowances at 0.02.
    expect(cargoVolume(holding)).toBeCloseTo(102, 6);
  });

  it('treats allowances as effectively weightless, which is the whole joke', () => {
    expect(cargoVolume({ allowance: 500 })).toBeLessThan(cargoVolume({ ore: 20 }));
  });
});

describe('purity', () => {
  it('does not mutate the market it is given', () => {
    const m = market();
    const snapshot = JSON.parse(JSON.stringify(m));
    applyTrade(m, quoteBuy(m, 'ore', 100), 'buy');
    advanceMarket(m, 5_000);
    expect(m).toEqual(snapshot);
  });
});
