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
