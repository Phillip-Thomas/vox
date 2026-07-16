import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MUSIC_LAYER_ASSETS, type MusicLayerId } from './musicCatalog.ts';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

class FakeAudioParam {
  value = 0;
  cancelAndHoldAtTime = vi.fn();
  setTargetAtTime = vi.fn();
}

interface LoadingHarness {
  context: AudioContext;
  bus: AudioNode;
  decodes: Array<Deferred<AudioBuffer>>;
  oscillatorStarts: ReturnType<typeof vi.fn>[];
}

const audio = vi.hoisted(() => ({
  harness: null as LoadingHarness | null,
  rampParam: vi.fn(),
  unlockAudio: vi.fn()
}));

vi.mock('./audioCore.ts', () => ({
  getAudioContext: () => audio.harness?.context ?? null,
  getMusicBus: () => audio.harness?.bus ?? null,
  makeNoiseBuffer: () => ({} as AudioBuffer),
  rampParam: audio.rampParam,
  unlockAudio: audio.unlockAudio
}));

function loadingHarness(): LoadingHarness {
  const decodes: Array<Deferred<AudioBuffer>> = [];
  const oscillatorStarts: ReturnType<typeof vi.fn>[] = [];
  const node = () => ({ connect: vi.fn(), disconnect: vi.fn() });
  const context = {
    currentTime: 0,
    resume: vi.fn(() => Promise.resolve()),
    decodeAudioData: vi.fn(() => {
      const next = deferred<AudioBuffer>();
      decodes.push(next);
      return next.promise;
    }),
    createGain: vi.fn(() => ({ ...node(), gain: new FakeAudioParam() })),
    createOscillator: vi.fn(() => {
      const start = vi.fn();
      oscillatorStarts.push(start);
      return {
        ...node(),
        type: 'sine',
        frequency: new FakeAudioParam(),
        start,
        stop: vi.fn()
      };
    }),
    createBufferSource: vi.fn(() => ({
      ...node(),
      buffer: null,
      loop: false,
      start: vi.fn(),
      stop: vi.fn()
    })),
    createBiquadFilter: vi.fn(() => ({
      ...node(),
      type: 'lowpass',
      frequency: new FakeAudioParam(),
      Q: new FakeAudioParam()
    }))
  } as unknown as AudioContext;
  return { context, bus: node() as unknown as AudioNode, decodes, oscillatorStarts };
}

async function flushTasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt++) {
    if (predicate()) return;
    await Promise.resolve();
  }
  expect(predicate()).toBe(true);
}

describe('live music stem loading', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    audio.harness = loadingHarness();
  });

  it('starts the procedural graph immediately but never fans all stems out at unlock', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8)
    }));
    vi.stubGlobal('fetch', fetchSpy);
    const { getMusicEngine, unlockMusicAudio } = await import('./musicEngine.ts');
    const targets = Object.fromEntries(
      MUSIC_LAYER_ASSETS.map((asset, index) => [asset.id, (index + 1) / MUSIC_LAYER_ASSETS.length])
    ) as Record<MusicLayerId, number>;
    getMusicEngine().setLayerTargets(targets, 0);

    await unlockMusicAudio();
    await flushTasks();

    expect(audio.harness?.oscillatorStarts.length).toBeGreaterThan(0);
    expect(audio.harness?.oscillatorStarts.every(start => start.mock.calls.length === 1)).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenLastCalledWith('/audio/music/warp_surreal_truth.mp3');
    expect(audio.harness?.decodes).toHaveLength(1);

    // A decode in flight owns the sole slot; even repeated target updates may
    // not start a second network/decode job.
    getMusicEngine().setLayerTargets(targets, 0);
    await flushTasks();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('re-evaluates live gains after each decode and loads the new audible priority next', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8)
    }));
    vi.stubGlobal('fetch', fetchSpy);
    const { getMusicEngine, unlockMusicAudio } = await import('./musicEngine.ts');
    const engine = getMusicEngine();
    engine.setLayerTargets({ menu: 0.7, shimmer: 0.2 }, 0);
    await unlockMusicAudio();
    await flushTasks();
    expect(fetchSpy).toHaveBeenLastCalledWith('/audio/music/menu_ambientmain.ogg');

    engine.setLayerTargets({ menu: 0, shimmer: 0.2, deepSpace: 0.9 }, 0);
    await flushTasks();
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    audio.harness?.decodes[0].resolve({} as AudioBuffer);
    await waitFor(() => fetchSpy.mock.calls.length === 2);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenLastCalledWith('/audio/music/deep_space_out_there.ogg');
  });

  it('keeps explicit preload serialized while eventually admitting silent layers', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8)
    }));
    vi.stubGlobal('fetch', fetchSpy);
    const { getMusicEngine, unlockMusicAudio } = await import('./musicEngine.ts');
    const engine = getMusicEngine();
    await unlockMusicAudio();
    await flushTasks();
    expect(fetchSpy).not.toHaveBeenCalled();

    engine.preload();
    await waitFor(() => (audio.harness?.decodes.length ?? 0) === 1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(audio.harness?.decodes).toHaveLength(1);

    audio.harness?.decodes[0].resolve({} as AudioBuffer);
    await waitFor(() => (audio.harness?.decodes.length ?? 0) === 2);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(audio.harness?.decodes).toHaveLength(2);
  });
});
