import { afterEach, describe, expect, it, vi } from 'vitest';
import { MUSIC_LAYER_ASSETS, type MusicLayerId } from './musicCatalog.ts';
import {
  AUDIO_PARAM_SLEW_SETTLE_TAU_COUNT
} from './audioCore.ts';
import {
  createOfflineMusicEngineRuntime,
  PROCEDURAL_FILTER_MIN_SLEW_S,
  PROCEDURAL_MIN_SLEW_S,
  STREAM_LAYER_MIN_SLEW_S,
  type ProceduralMusicTargets
} from './musicEngine.ts';

const TEST_SAMPLE_RATE = 100;
const TEST_CURRENT_TIME_S = 8;
const ZERO_REQUESTED_SLEW_S = 0;
const TEST_TIME_EPSILON_S = 1e-9;
const PROCEDURAL_NOISE_SOURCE_COUNT = 3;

class FakeAudioParam {
  private currentValue = 0;
  hardValueWrites = 0;
  readonly cancelAndHoldAtTime = vi.fn();
  readonly cancelScheduledValues = vi.fn();
  readonly setValueAtTime = vi.fn();
  readonly linearRampToValueAtTime = vi.fn();
  readonly exponentialRampToValueAtTime = vi.fn();
  readonly setTargetAtTime = vi.fn();

  get value(): number {
    return this.currentValue;
  }

  set value(next: number) {
    this.currentValue = next;
    this.hardValueWrites++;
  }

  resetAutomationAudit(): void {
    this.hardValueWrites = 0;
    this.cancelAndHoldAtTime.mockClear();
    this.cancelScheduledValues.mockClear();
    this.setValueAtTime.mockClear();
    this.linearRampToValueAtTime.mockClear();
    this.exponentialRampToValueAtTime.mockClear();
    this.setTargetAtTime.mockClear();
  }
}

interface FakeContextAudit {
  context: BaseAudioContext;
  output: AudioNode;
  params: FakeAudioParam[];
  created: {
    gains: number;
    oscillators: number;
    buffers: number;
    bufferSources: number;
    filters: number;
  };
  started: ReturnType<typeof vi.fn>[];
}

function fakeContext(): FakeContextAudit {
  const params: FakeAudioParam[] = [];
  const started: ReturnType<typeof vi.fn>[] = [];
  const created = { gains: 0, oscillators: 0, buffers: 0, bufferSources: 0, filters: 0 };
  const param = (): FakeAudioParam => {
    const next = new FakeAudioParam();
    params.push(next);
    return next;
  };
  const node = () => ({ connect: vi.fn(), disconnect: vi.fn() });
  const startable = () => {
    const start = vi.fn();
    started.push(start);
    return { ...node(), start, stop: vi.fn() };
  };

  const context = {
    currentTime: TEST_CURRENT_TIME_S,
    sampleRate: TEST_SAMPLE_RATE,
    createGain: vi.fn(() => {
      created.gains++;
      return { ...node(), gain: param() };
    }),
    createOscillator: vi.fn(() => {
      created.oscillators++;
      return { ...startable(), frequency: param(), type: 'sine' };
    }),
    createBufferSource: vi.fn(() => {
      created.bufferSources++;
      return { ...startable(), buffer: null, loop: false };
    }),
    createBiquadFilter: vi.fn(() => {
      created.filters++;
      return { ...node(), frequency: param(), Q: param(), type: 'lowpass' };
    }),
    createBuffer: vi.fn((_channels: number, frames: number) => {
      created.buffers++;
      const data = new Float32Array(frames);
      return { getChannelData: vi.fn(() => data) };
    })
  } as unknown as BaseAudioContext;

  return { context, output: node() as unknown as AudioNode, params, created, started };
}

const MID_PROCEDURAL_TARGETS: ProceduralMusicTargets = {
  pulse: 0.2,
  ship: 0.3,
  warp: 0.4,
  life: 0.5,
  wind: 0.6,
  glass: 0.7,
  rumble: 0.8,
  water: 0.9,
  night: 1
};

const ALL_LAYER_TARGETS = Object.fromEntries(
  MUSIC_LAYER_ASSETS.map((asset, index) => [asset.id, (index + 1) / MUSIC_LAYER_ASSETS.length])
) as Record<MusicLayerId, number>;

describe('offline legacy music audit rim', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses positive named minimum slews and no hard target setters after graph initialization', () => {
    expect(STREAM_LAYER_MIN_SLEW_S).toBeGreaterThan(0);
    expect(PROCEDURAL_MIN_SLEW_S).toBeGreaterThan(0);
    expect(PROCEDURAL_FILTER_MIN_SLEW_S).toBeGreaterThan(0);

    const audit = fakeContext();
    const runtime = createOfflineMusicEngineRuntime(audit.context, audit.output);
    for (const audioParam of audit.params) audioParam.resetAutomationAudit();

    runtime.setProceduralTargets(MID_PROCEDURAL_TARGETS, ZERO_REQUESTED_SLEW_S);
    runtime.setLayerTargets(ALL_LAYER_TARGETS, ZERO_REQUESTED_SLEW_S);
    runtime.retuneDronesToChordRoot(7);

    const slewed = audit.params.filter((audioParam) =>
      audioParam.cancelAndHoldAtTime.mock.calls.length > 0
    );
    const slewDurations = slewed.flatMap((audioParam) =>
      audioParam.setTargetAtTime.mock.calls.map(
        ([, , timeConstant]) => timeConstant * AUDIO_PARAM_SLEW_SETTLE_TAU_COUNT
      )
    );

    expect(slewed).toHaveLength(10 + 4 + MUSIC_LAYER_ASSETS.length + 9);
    const withDuration = (target: number): number[] =>
      slewDurations.filter((seconds) => Math.abs(seconds - target) < TEST_TIME_EPSILON_S);
    expect(withDuration(PROCEDURAL_MIN_SLEW_S)).toHaveLength(10);
    expect(withDuration(PROCEDURAL_FILTER_MIN_SLEW_S)).toHaveLength(4);
    expect(withDuration(STREAM_LAYER_MIN_SLEW_S)).toHaveLength(MUSIC_LAYER_ASSETS.length);
    expect(audit.params.every((audioParam) => audioParam.hardValueWrites === 0)).toBe(true);
    expect(audit.params.every((audioParam) => audioParam.setValueAtTime.mock.calls.length === 0)).toBe(
      true
    );
    expect(
      audit.params.every((audioParam) => audioParam.cancelScheduledValues.mock.calls.length === 0)
    ).toBe(true);
    expect(slewed.every((audioParam) => audioParam.linearRampToValueAtTime.mock.calls.length === 0))
      .toBe(true);
  });

  it('defaults owner renders to silent stem lanes and opts into non-pitched audit carriers', () => {
    const ownerAudit = fakeContext();
    createOfflineMusicEngineRuntime(ownerAudit.context, ownerAudit.output);
    const smoothnessAudit = fakeContext();
    createOfflineMusicEngineRuntime(smoothnessAudit.context, smoothnessAudit.output, {
      includeStemAuditCarriers: true
    });

    expect(ownerAudit.created.bufferSources).toBe(PROCEDURAL_NOISE_SOURCE_COUNT);
    expect(ownerAudit.created.buffers).toBe(PROCEDURAL_NOISE_SOURCE_COUNT);
    expect(smoothnessAudit.created.bufferSources - ownerAudit.created.bufferSources).toBe(
      MUSIC_LAYER_ASSETS.length
    );
    expect(smoothnessAudit.created.buffers - ownerAudit.created.buffers).toBe(
      MUSIC_LAYER_ASSETS.length
    );
    // Audit carriers are seeded noise buffers, never fixed-pitch oscillators.
    expect(smoothnessAudit.created.oscillators).toBe(ownerAudit.created.oscillators);
    // Both modes retain every layer GainNode and therefore the exact slew path.
    expect(smoothnessAudit.created.gains - ownerAudit.created.gains).toBe(MUSIC_LAYER_ASSETS.length);
  });

  it('creates one bounded persistent audit graph and never fetches or allocates on updates', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const audit = fakeContext();
    const runtime = createOfflineMusicEngineRuntime(audit.context, audit.output, {
      includeStemAuditCarriers: true
    });
    const initialCreated = { ...audit.created };
    const initialStarts = audit.started.length;

    for (let step = 0; step < 8; step++) {
      const amount = step / 7;
      runtime.setProceduralTargets(
        { ...MID_PROCEDURAL_TARGETS, warp: amount, night: 1 - amount },
        ZERO_REQUESTED_SLEW_S
      );
      runtime.setLayerTargets({ surface: amount, deepSpace: 1 - amount }, ZERO_REQUESTED_SLEW_S);
    }

    expect(audit.created).toEqual(initialCreated);
    expect(audit.started).toHaveLength(initialStarts);
    expect(audit.started.every((start) => start.mock.calls.length === 1)).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
