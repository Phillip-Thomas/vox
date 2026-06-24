import { describe, it, expect, beforeEach } from 'vitest';
import {
  getWaterskinFill, fillWaterskin, useWaterskin, setWaterskinFill, resetWaterskin, MAX_WATERSKIN
} from './consumeSystem.ts';
import { getVitals, setVitals, resetVitals } from './survivalVitals.ts';

beforeEach(() => { resetWaterskin(); resetVitals(); });

describe('waterskin', () => {
  it('fills and clamps to max', () => {
    fillWaterskin(40);
    expect(getWaterskinFill()).toBe(40);
    fillWaterskin(1000);
    expect(getWaterskinFill()).toBe(MAX_WATERSKIN);
  });

  it('drinking drains the skin and restores thirst', () => {
    setVitals({ thirst: 20 });
    fillWaterskin(100);
    const drunk = useWaterskin(40);
    expect(drunk).toBe(40);
    expect(getWaterskinFill()).toBe(60);
    expect(getVitals().thirst).toBe(60); // 20 + 40
  });

  it('an empty skin drinks nothing', () => {
    setVitals({ thirst: 30 });
    expect(useWaterskin(40)).toBe(0);
    expect(getVitals().thirst).toBe(30);
  });

  it('restores from a save (clamped)', () => {
    setWaterskinFill(250);
    expect(getWaterskinFill()).toBe(MAX_WATERSKIN);
  });
});
