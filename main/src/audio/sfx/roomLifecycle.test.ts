import { describe, expect, it } from 'vitest';
import { resolveInteriorRoomFraction, resolveSfxRoomWeights } from './roomPresets.ts';

describe('physical interior audio ownership', () => {
  it('never seals for the controller-transfer frame before actual camera ownership', () => {
    const states = [
      { phase: 'hatch_entering', sealProgress: 0 },
      { phase: 'transfer_requested', sealProgress: 0 },
      { phase: 'sealing', sealProgress: 0 },
      { phase: 'sealing', sealProgress: 0.25 },
      { phase: 'sealing', sealProgress: 0.75 },
      { phase: 'handback', sealProgress: 1 }
    ];
    expect(states.map(state => resolveInteriorRoomFraction(state, 'flight'))).toEqual([0, 0, 0, 0.25, 0.75, 1]);
    expect(resolveInteriorRoomFraction(states[states.length - 1]!, 'player')).toBe(0);
  });
  it('reads the same seal fraction without adding another transition clock', () => {
    const interior = resolveInteriorRoomFraction({ phase: 'sealing', sealProgress: 0.63 }, 'flight');
    const weights = resolveSfxRoomWeights({ era: 1, stage: 'alive', submergence: 0, interior });
    expect(weights.interior).toBeCloseTo(0.63);
    expect(weights.plain).toBeCloseTo(0.37);
    expect(resolveInteriorRoomFraction({ phase: 'idle', sealProgress: 0 }, 'flight')).toBe(1);
  });
});
