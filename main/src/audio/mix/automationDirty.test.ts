import { describe, expect, it } from 'vitest';
import { automationDirty, type AutomationWrite } from './automationDirty.ts';
import { AUTOMATION_CADENCE_S, AUTOMATION_EPSILON } from './mixTuning.ts';

const last: AutomationWrite = { at: 10, fade: 0.8, shipSlew: undefined, values: { a: 0.5, b: 0.2 } };

describe('dirty-checked automation (Stage 2)', () => {
  it('is dirty with no prior write and clean for an unchanged frame', () => {
    expect(automationDirty(null, { a: 0.5 }, 0.8, undefined, 10.016)).toBe(true);
    expect(automationDirty(last, { a: 0.5, b: 0.2 }, 0.8, undefined, 10.016)).toBe(false);
  });

  it('a target moving by more than AUTOMATION_EPSILON is dirty; less is not', () => {
    expect(automationDirty(last, { a: 0.5 + AUTOMATION_EPSILON * 2, b: 0.2 }, 0.8, undefined, 10.016)).toBe(true);
    expect(automationDirty(last, { a: 0.5 + AUTOMATION_EPSILON / 2, b: 0.2 }, 0.8, undefined, 10.016)).toBe(false);
  });

  it('a fade or ship-slew change is dirty even with equal targets', () => {
    expect(automationDirty(last, { a: 0.5, b: 0.2 }, 1.2, undefined, 10.016)).toBe(true);
    expect(automationDirty(last, { a: 0.5, b: 0.2 }, 0.8, 0.5, 10.016)).toBe(true);
  });

  it('the keep-alive cadence forces a write', () => {
    expect(automationDirty(last, { a: 0.5, b: 0.2 }, 0.8, undefined, 10 + AUTOMATION_CADENCE_S)).toBe(true);
  });

  it('steady state writes at most 1/AUTOMATION_CADENCE_S per lane: 8 s of identical frames → ceil(8 / cadence) writes', () => {
    let writes = 0;
    let prev: AutomationWrite | null = null;
    const seconds = 8;
    for (let f = 0; f < 60 * seconds; f++) {
      const t = f / 60;
      if (automationDirty(prev, { a: 0.5 }, 0.8, undefined, t)) {
        writes++;
        prev = { at: t, fade: 0.8, values: { a: 0.5 } };
      }
    }
    expect(writes).toBe(Math.ceil(seconds / AUTOMATION_CADENCE_S));
    // Stage 3 retune: the keep-alive alone must sit well under the 60 writes/s term
    // even across the legacy engine's ~14 procedural lanes (2 writes each).
    expect((14 * 2) / AUTOMATION_CADENCE_S).toBeLessThan(30);
  });
});
