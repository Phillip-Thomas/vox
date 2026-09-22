import { afterEach, describe, expect, it, vi } from 'vitest';

// Consolidation guard (Lane CON): SFX shares audioCore's single AudioContext and
// joins the one post-safety master node — no second context, no duplicate route.
// Stage 2: SFX plays through audioCore's category buses (gain → duck → shared
// muffle or dry → sfx sub-master) and joins in PARALLEL with the music safety
// compressor, so SFX is never music-compressed or hidden-tab ducked; only the
// true-peak limiter after the join is shared by both paths.

interface FakeNode {
  __kind: string;
  connections: unknown[];
  connect: (target: unknown) => void;
  disconnect: () => void;
  [key: string]: unknown;
}

function fakeParam() {
  return {
    value: 0,
    cancelAndHoldAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
    setValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn()
  };
}

function fakeNode(kind: string, extra: Record<string, unknown> = {}): FakeNode {
  return {
    __kind: kind,
    connections: [] as unknown[],
    connect(target: unknown) {
      (this as FakeNode).connections.push(target);
    },
    disconnect() {},
    ...extra
  } as FakeNode;
}

/** Non-iOS shared-context environment with a spy on the AudioContext ctor. */
function stubSharedAudioEnv() {
  vi.resetModules();
  let contextConstructions = 0;
  const created: FakeNode[] = [];
  const make = (kind: string, extra: Record<string, unknown> = {}): FakeNode => {
    const node = fakeNode(kind, extra);
    created.push(node);
    return node;
  };
  const ctx = {
    state: 'suspended' as string,
    currentTime: 0,
    sampleRate: 48000,
    destination: fakeNode('destination'),
    resume: vi.fn(() => {
      ctx.state = 'running';
      return Promise.resolve();
    }),
    createDynamicsCompressor: vi.fn(() =>
      make('compressor', {
        threshold: fakeParam(),
        ratio: fakeParam(),
        attack: fakeParam(),
        release: fakeParam(),
        knee: fakeParam()
      })
    ),
    // Stage 1 glue soft clip.
    createWaveShaper: vi.fn(() => make('waveshaper', { curve: null, oversample: 'none' })),
    createGain: vi.fn(() => make('gain', { gain: fakeParam() })),
    createBiquadFilter: vi.fn(() =>
      make('biquad', { frequency: fakeParam(), Q: fakeParam(), type: 'lowpass' })
    )
  };
  const win = {
    AudioContext: function AudioContextCtor() {
      contextConstructions++;
      return ctx;
    },
    addEventListener: vi.fn()
  };
  const doc = { addEventListener: vi.fn(), visibilityState: 'visible', hidden: false };
  const nav = {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    platform: 'Win32',
    maxTouchPoints: 0
  };
  vi.stubGlobal('window', win);
  vi.stubGlobal('document', doc);
  vi.stubGlobal('navigator', nav);
  return { created, contextConstructions: () => contextConstructions };
}

describe('sfxEngine shares the single game AudioContext', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('acquires the shared context and route instead of constructing a second one', async () => {
    const env = stubSharedAudioEnv();
    const core = await import('./audioCore.ts');
    const sfx = await import('./sfxEngine.ts');

    core.getAudioContext(); // build the music chain + master + the one route
    await sfx.unlockSfxAudio(); // build the SFX sub-master and join the master

    // THE consolidation invariant: exactly one AudioContext for the whole game.
    expect(env.contextConstructions()).toBe(1);
    // ...and exactly one terminal output route (no duplicate SFX route).
    const routes = core.describeGameAudioOutputRoutes().split(' | ');
    expect(routes).toHaveLength(1);
    expect(routes[0]).toContain('game:');
  });

  it('plays through the category buses: diegetic buses share the one muffle into the SFX sub-master, ui is dry, all join the master upstream of the limiter', async () => {
    const env = stubSharedAudioEnv();
    const core = await import('./audioCore.ts');
    const sfx = await import('./sfxEngine.ts');

    core.getAudioContext();
    const master = core.getGameAudioSfxJoinNode() as unknown as FakeNode;
    await sfx.unlockSfxAudio();

    // The music safety trim → musicDuck → master; the master feeds the limiter, not the route.
    const compressors = env.created.filter(node => node.__kind === 'compressor');
    expect(compressors).toHaveLength(3);
    // Exactly one biquad terminates at the SFX sub-master (the shared muffle),
    // and that sub-master is the only gain that joins the master besides musicDuck.
    const gainsToMaster = env.created.filter(node => node.__kind === 'gain' && node.connections.includes(master));
    expect(gainsToMaster).toHaveLength(2); // musicDuck and the SFX sub-master
    const biquadsToSfxOutput = env.created.filter(
      node => node.__kind === 'biquad' && gainsToMaster.some(g => node.connections.includes(g))
    );
    expect(biquadsToSfxOutput).toHaveLength(1);
    const sfxOutput = gainsToMaster.find(g => biquadsToSfxOutput[0].connections.includes(g));
    expect(sfxOutput).toBeTruthy();
    // Diegetic buses reach the muffle; ui/voice reach the sub-master directly.
    const muffle = biquadsToSfxOutput[0];
    const player = core.getGameAudioCategoryBusInput('player') as unknown as FakeNode;
    const ui = core.getGameAudioCategoryBusInput('ui') as unknown as FakeNode;
    expect((player.connections[0] as FakeNode).connections).toContain(muffle);
    expect((ui.connections[0] as FakeNode).connections).toContain(sfxOutput);
    // The music submerge filter stays upstream on the music chain: no biquad
    // terminates at the master itself.
    expect(env.created.filter(node => node.__kind === 'biquad' && node.connections.includes(master))).toHaveLength(0);
  });

});

// --- Stage 3 (C6): bundled SFX forward scheduling never touches an unbundled trigger --------------------
import { resolveSfxStartTime } from './sfxEngine.ts';

describe('sfx start-time law (C6 forward scheduling)', () => {
  it('an unbundled playSfx (no atAudioTime) starts now, exactly as shipped', () => {
    expect(resolveSfxStartTime(12.345)).toBe(12.345);
    expect(resolveSfxStartTime(12.345, undefined)).toBe(12.345);
    expect(resolveSfxStartTime(12.345, Number.NaN)).toBe(12.345);
  });
  it('a bundled member starts at its exact forward audio time when it is still ahead', () => {
    expect(resolveSfxStartTime(12.0, 12.4 + 0.014875)).toBeCloseTo(12.414875, 9);
  });
  it('a stale forward time (a hitch past the target) plays now — late, never early', () => {
    expect(resolveSfxStartTime(13.0, 12.9)).toBe(13.0);
  });
});
