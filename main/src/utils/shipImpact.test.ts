import { describe, expect, it } from 'vitest';
import { shipImpactOutcome } from './surfaceControls';

describe('shipImpactOutcome', () => {
  const CRASH = 45;
  it('crashes on a fast inward impact', () => {
    expect(shipImpactOutcome(80, CRASH)).toBe('crash');
    expect(shipImpactOutcome(46, CRASH)).toBe('crash');
  });
  it('soft-stops on gentle contact', () => {
    expect(shipImpactOutcome(44, CRASH)).toBe('soft');
    expect(shipImpactOutcome(0, CRASH)).toBe('soft');
    expect(shipImpactOutcome(-10, CRASH)).toBe('soft'); // moving away
  });
});
