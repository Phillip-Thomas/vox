import { afterEach, describe, expect, it, vi } from 'vitest';

// --- The pre-gesture invariant (audioCore peekAudioContext contract) ---------------------------
//
// The bed is a LATE-JOINING engine: it may only build once an unlock path
// (user gesture) has already constructed the shared AudioContext. The rAF
// conductor calls updateBedSignals every frame from the first render — none
// of those calls may construct a suspended pre-gesture context on the bed's
// behalf (getMusicBus() would, if fetched before the peek is checked).

describe('bedEngine pre-gesture invariant', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('updateBedSignals never constructs an AudioContext before an unlock made one', async () => {
    const constructed = vi.fn();
    class SpyAudioContext {
      constructor() {
        constructed();
      }
    }
    vi.stubGlobal('window', { AudioContext: SpyAudioContext });
    vi.resetModules();
    const [{ updateBedSignals }, { neutralBedSignals }] = await Promise.all([
      import('./bedEngine.ts'),
      import('./generative/worldSignals.ts')
    ]);
    // Several frames of intent writes — the per-frame path must stay inert.
    for (let i = 0; i < 4; i++) updateBedSignals(neutralBedSignals());
    expect(constructed).not.toHaveBeenCalled();
  });
});

describe('bedEngine authority target', () => {
  it('resolves the current scene at resume instead of a cached pre-story gain', async () => {
    const [{ resolveBedLeadTarget }, { BED_MASTER_GAIN, BED_SCENE_POLICY }] = await Promise.all([
      import('./bedEngine.ts'),
      import('./generative/tuning.ts')
    ]);
    const beforeStory = resolveBedLeadTarget('surface');
    const afterStory = resolveBedLeadTarget('storyTerminal');
    expect(beforeStory).toBe(BED_MASTER_GAIN * BED_SCENE_POLICY.surface.gain);
    expect(afterStory).toBe(BED_MASTER_GAIN * BED_SCENE_POLICY.storyTerminal.gain);
    expect(afterStory).not.toBe(beforeStory);
  });
});

describe('bedEngine planned hit window', () => {
  it('keeps a mid-bar beat request on the next beat of the already-planned bar', async () => {
    const { resolvePlannedBedQuantum } = await import('./bedEngine.ts');
    const window = { start: 10, end: 14, barIndex: 8, beatsPerBar: 4 };
    expect(resolvePlannedBedQuantum(window, 11.2, 'beat')).toBe(12);
    expect(resolvePlannedBedQuantum(window, 11.2, 'bar')).toBeNull();
    expect(resolvePlannedBedQuantum(window, 9.9, 'phrase')).toBe(10);
  });
});
