import { afterEach, describe, expect, it, vi } from 'vitest';

// Consolidation guard (Lane CON): SFX shares audioCore's single AudioContext and
// joins the one post-compressor master node that feeds the one iOS-aware output
// route — no second context, no duplicate route. The SFX sub-master joins in
// PARALLEL with the music compressor, so SFX is never compressed or hidden-tab
// ducked (byte-identical to the pre-consolidation separate-context signal path).

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
      make('compressor', { threshold: fakeParam(), ratio: fakeParam() })
    ),
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

  it('joins the SFX sub-master to the shared master, parallel to the compressor', async () => {
    const env = stubSharedAudioEnv();
    const core = await import('./audioCore.ts');
    const sfx = await import('./sfxEngine.ts');

    core.getAudioContext();
    const master = core.getGameAudioSfxJoinNode() as unknown as FakeNode;
    await sfx.unlockSfxAudio();

    // The music safety compressor feeds the master...
    const compressor = env.created.find(node => node.__kind === 'compressor');
    expect(compressor?.connections).toContain(master);

    // ...and the SFX sub-master joins the SAME master through its own submerge
    // filter — the only biquad terminating at the master. The music submerge
    // filter stays upstream on the music chain (→ sceneEnvelope → visibility →
    // compressor), so it must NOT reach the master.
    const biquadsToMaster = env.created.filter(
      node => node.__kind === 'biquad' && node.connections.includes(master)
    );
    expect(biquadsToMaster).toHaveLength(1);
  });
});
