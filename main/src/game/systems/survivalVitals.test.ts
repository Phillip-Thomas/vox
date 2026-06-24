import { describe, it, expect, beforeEach } from 'vitest';
import {
  getVitals, getStamina, tickVitals, applyStamina, canSprint, setVitals, resetVitals, feed, drink
} from './survivalVitals.ts';

beforeEach(() => resetVitals());

describe('vitals decay', () => {
  it('starts full', () => {
    const v = getVitals();
    expect(v).toEqual({ health: 100, hunger: 100, thirst: 100, warmth: 100, stamina: 100, oxygen: 100 });
  });

  it('decays hunger + thirst only when active', () => {
    tickVitals(10, false); // paused (menu/flight/space)
    expect(getVitals().hunger).toBe(100);
    tickVitals(60, true);  // 60s on-foot
    const v = getVitals();
    expect(v.hunger).toBeLessThan(100);
    expect(v.thirst).toBeLessThan(100);
    expect(v.thirst).toBeLessThan(v.hunger); // thirst decays faster
    expect(v.warmth).toBe(100); // held full until temperature model
  });

  it('clamps at 0 (never negative)', () => {
    tickVitals(100000, true);
    const v = getVitals();
    expect(v.hunger).toBe(0);
    expect(v.thirst).toBe(0);
  });

  it('does no health damage yet (non-lethal phase)', () => {
    tickVitals(100000, true); // starve + dehydrate fully
    expect(getVitals().health).toBe(100);
  });

  it('slowly regens health while well-fed + hydrated', () => {
    setVitals({ health: 80 }); // hunger/thirst still full
    tickVitals(60, true);
    expect(getVitals().health).toBeGreaterThan(80);
  });

  it('regens health only ABOVE the well-fed threshold (boundary)', () => {
    // Short ticks so within-tick decay doesn't itself cross the threshold.
    setVitals({ health: 80, hunger: 50, thirst: 100 }); // hunger at threshold (50, not > 50)
    tickVitals(0.5, true);
    expect(getVitals().health).toBe(80); // no regen
    setVitals({ health: 80, hunger: 60, thirst: 100 }); // clearly above
    tickVitals(0.5, true);
    expect(getVitals().health).toBeGreaterThan(80); // regen
  });
});

describe('stamina + sprint gating', () => {
  it('drains while sprinting, regens otherwise', () => {
    applyStamina(2, true);
    const drained = getStamina();
    expect(drained).toBeLessThan(100);
    applyStamina(1, false);
    expect(getStamina()).toBeGreaterThan(drained);
  });

  it('exhausts at 0 and blocks sprint until recovered past the threshold', () => {
    applyStamina(100, true); // drain to empty
    expect(getStamina()).toBe(0);
    expect(canSprint()).toBe(false); // exhausted
    applyStamina(1, false); // small regen, still below recover threshold (30)
    expect(canSprint()).toBe(false);
    applyStamina(100, false); // full regen, past threshold
    expect(canSprint()).toBe(true);
  });
});

describe('satisfiers (eat/drink)', () => {
  it('feed restores hunger (and a little thirst for juicy foods), clamped', () => {
    setVitals({ hunger: 50, thirst: 50 });
    feed(30, 10);
    expect(getVitals().hunger).toBe(80);
    expect(getVitals().thirst).toBe(60);
    feed(100);
    expect(getVitals().hunger).toBe(100); // clamped
  });

  it('drink restores thirst, clamped', () => {
    setVitals({ thirst: 70 });
    drink(50);
    expect(getVitals().thirst).toBe(100);
  });
});

describe('save/restore', () => {
  it('round-trips via setVitals (clamped)', () => {
    setVitals({ health: 42, hunger: 7, thirst: 200, warmth: -5, stamina: 50 });
    const v = getVitals();
    expect(v.health).toBe(42);
    expect(v.hunger).toBe(7);
    expect(v.thirst).toBe(100); // clamped high
    expect(v.warmth).toBe(0);   // clamped low
    expect(v.stamina).toBe(50);
  });
});
