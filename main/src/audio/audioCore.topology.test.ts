import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  GLUE_ATTACK_S,
  GLUE_KNEE_DB,
  GLUE_MAKEUP_COMP_DB,
  GLUE_RATIO,
  GLUE_RELEASE_S,
  GLUE_THRESH_DB
} from './generative/tuning.ts';
import {
  CEILING_OVERSAMPLE,
  LIM_ATTACK_S,
  LIM_KNEE_DB,
  LIM_MAKEUP_COMP_DB,
  LIM_RATIO,
  LIM_RELEASE_S,
  LIM_THRESH_DB,
  SAFETY_ATTACK_S,
  SAFETY_KNEE_DB,
  SAFETY_MAKEUP_COMP_DB,
  SAFETY_RATIO,
  SAFETY_RELEASE_S,
  SAFETY_THRESH_DB,
  TAIL_REFERENCE_GAIN_DB
} from './mix/mixTuning.ts';

// Stage 2 topology law (audio-10x draft-v3, acceptanceCriteria[5] + score.mixIntent):
// the music path is glue → [safety compressor → trim] → musicDuck → masterOutput,
// the SFX category buses join at masterOutput (diegetic buses through the one
// muffle, ui/voice dry), and the true-peak limiter (compressor → trim → 4×
// ceiling) sits AFTER the join and feeds the route. Every compressor's baked
// makeup is cancelled by a named trim; the only non-cancelling static gain is
// the named TAIL_REFERENCE_GAIN_DB. The offline mirror is identical. This test
// READS audioCore through a recording fake context; it edits nothing.
const UNTOUCHED = 'untouched' as const;
const GLUE_TRIM_LINEAR = Math.pow(10, GLUE_MAKEUP_COMP_DB / 20);
const SAFETY_TRIM_LINEAR = Math.pow(10, (SAFETY_MAKEUP_COMP_DB + TAIL_REFERENCE_GAIN_DB) / 20);
const LIM_TRIM_LINEAR = Math.pow(10, LIM_MAKEUP_COMP_DB / 20);
const LEGACY_SAFETY_THRESHOLD_DB = -20;
const LEGACY_SAFETY_RATIO = 8;

interface FakeParam {
  value: number | typeof UNTOUCHED;
  cancelAndHoldAtTime: ReturnType<typeof vi.fn>;
  cancelScheduledValues: ReturnType<typeof vi.fn>;
  setValueAtTime: ReturnType<typeof vi.fn>;
  setTargetAtTime: ReturnType<typeof vi.fn>;
  linearRampToValueAtTime: ReturnType<typeof vi.fn>;
}

interface FakeNode {
  kind: string;
  targets: FakeNode[];
  connect: (target: FakeNode) => FakeNode;
  disconnect: ReturnType<typeof vi.fn>;
  [key: string]: unknown;
}

function fakeParam(initial: number | typeof UNTOUCHED = UNTOUCHED): FakeParam {
  return {
    value: initial,
    cancelAndHoldAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
    setValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn()
  };
}

function makeRecordingContext() {
  const nodes: FakeNode[] = [];
  const node = (kind: string, extra: Record<string, unknown> = {}): FakeNode => {
    const n: FakeNode = {
      kind,
      targets: [],
      connect(target: FakeNode) {
        n.targets.push(target);
        return target;
      },
      disconnect: vi.fn(),
      ...extra
    };
    nodes.push(n);
    return n;
  };
  const destination = node('destination');
  const ctx = {
    state: 'running',
    currentTime: 0,
    sampleRate: 44100,
    destination,
    resume: vi.fn(() => Promise.resolve()),
    createDynamicsCompressor: vi.fn(() =>
      node('DynamicsCompressor', {
        threshold: fakeParam(),
        ratio: fakeParam(),
        attack: fakeParam(),
        release: fakeParam(),
        knee: fakeParam()
      })
    ),
    createWaveShaper: vi.fn(() => node('WaveShaper', { curve: null, oversample: 'none' })),
    createGain: vi.fn(() => node('Gain', { gain: fakeParam(1) })),
    createBiquadFilter: vi.fn(() =>
      node('BiquadFilter', { frequency: fakeParam(350), Q: fakeParam(1), type: 'lowpass' })
    ),
    createMediaStreamDestination: vi.fn(() => node('MediaStreamDestination', { stream: {} }))
  };
  return { ctx, nodes, destination };
}

function stubLiveEnv() {
  vi.resetModules();
  const recording = makeRecordingContext();
  const win = {
    AudioContext: function AudioContextCtor() {
      return recording.ctx;
    },
    addEventListener: vi.fn()
  };
  const doc = {
    createElement: vi.fn(() => ({
      paused: true,
      ended: false,
      readyState: 2,
      setAttribute: vi.fn(),
      play: vi.fn(() => Promise.resolve())
    })),
    addEventListener: vi.fn(),
    visibilityState: 'visible',
    hidden: false
  };
  vi.stubGlobal('window', win);
  vi.stubGlobal('document', doc);
  vi.stubGlobal('navigator', {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    platform: 'Win32',
    maxTouchPoints: 0
  });
  return recording;
}

/** Follow the single music path from `start` until a node with no targets. */
function walkMusicPath(start: FakeNode): FakeNode[] {
  const path: FakeNode[] = [start];
  let cursor = start;
  const seen = new Set<FakeNode>([start]);
  while (cursor.targets.length > 0) {
    // The music path is a chain: every node on it has exactly one forward target.
    expect(cursor.targets, `${cursor.kind} fans out`).toHaveLength(1);
    cursor = cursor.targets[0];
    expect(seen.has(cursor), 'music path loops').toBe(false);
    seen.add(cursor);
    path.push(cursor);
  }
  return path;
}

function expectGlue(glue: FakeNode, trim: FakeNode, softClip: FakeNode) {
  expect(glue.kind).toBe('DynamicsCompressor');
  expect((glue.threshold as FakeParam).value).toBe(GLUE_THRESH_DB);
  expect((glue.ratio as FakeParam).value).toBe(GLUE_RATIO);
  expect((glue.attack as FakeParam).value).toBe(GLUE_ATTACK_S);
  expect((glue.release as FakeParam).value).toBe(GLUE_RELEASE_S);
  expect((glue.knee as FakeParam).value).toBe(GLUE_KNEE_DB);
  expect(trim.kind).toBe('Gain');
  expect((trim.gain as FakeParam).value).toBeCloseTo(GLUE_TRIM_LINEAR, 12);
  expect(softClip.kind).toBe('WaveShaper');
  expect(softClip.oversample).toBe('2x');
  expect(softClip.curve).toBeInstanceOf(Float32Array);
}

function expectStage2Tail(path: FakeNode[], tailStartIndex: number) {
  const [glue, glueTrim, softClip, safety, safetyTrim, musicDuck, masterOutput, limiter, limTrim, ceiling, ...terminal] =
    path.slice(tailStartIndex);
  expectGlue(glue, glueTrim, softClip);
  // Safety device: the contracted constants, written once.
  expect(safety.kind).toBe('DynamicsCompressor');
  expect((safety.threshold as FakeParam).value).toBe(SAFETY_THRESH_DB);
  expect((safety.ratio as FakeParam).value).toBe(SAFETY_RATIO);
  expect((safety.knee as FakeParam).value).toBe(SAFETY_KNEE_DB);
  expect((safety.attack as FakeParam).value).toBe(SAFETY_ATTACK_S);
  expect((safety.release as FakeParam).value).toBe(SAFETY_RELEASE_S);
  expect(SAFETY_THRESH_DB).toBe(-6);
  expect(SAFETY_RATIO).toBe(20);
  expect(SAFETY_KNEE_DB).toBeGreaterThanOrEqual(0);
  expect(SAFETY_KNEE_DB).toBeLessThanOrEqual(3);
  expect(SAFETY_ATTACK_S).toBeLessThanOrEqual(0.003);
  expect(SAFETY_RELEASE_S).toBe(0.1);
  // Makeup cancelled + the one named reference gain.
  expect(safetyTrim.kind).toBe('Gain');
  expect((safetyTrim.gain as FakeParam).value).toBeCloseTo(SAFETY_TRIM_LINEAR, 12);
  expect(SAFETY_MAKEUP_COMP_DB).toBeLessThan(0);
  // Music-only duck at unity, then the join.
  expect(musicDuck.kind).toBe('Gain');
  expect((musicDuck.gain as FakeParam).value).toBe(1);
  expect(masterOutput.kind).toBe('Gain');
  expect((masterOutput.gain as FakeParam).value).toBe(1);
  // The true-peak limiter after the join: compressor at the TP target, trim, 4× ceiling.
  expect(limiter.kind).toBe('DynamicsCompressor');
  expect((limiter.threshold as FakeParam).value).toBe(LIM_THRESH_DB);
  expect(LIM_THRESH_DB).toBe(-1);
  expect((limiter.ratio as FakeParam).value).toBe(LIM_RATIO);
  expect((limiter.knee as FakeParam).value).toBe(LIM_KNEE_DB);
  expect(LIM_KNEE_DB).toBe(0);
  expect((limiter.attack as FakeParam).value).toBe(LIM_ATTACK_S);
  expect(LIM_ATTACK_S).toBeGreaterThanOrEqual(0.001);
  expect(LIM_ATTACK_S).toBeLessThanOrEqual(0.003);
  expect((limiter.release as FakeParam).value).toBe(LIM_RELEASE_S);
  expect(LIM_RELEASE_S).toBeGreaterThanOrEqual(0.05);
  expect(LIM_RELEASE_S).toBeLessThanOrEqual(0.1);
  expect(limTrim.kind).toBe('Gain');
  expect((limTrim.gain as FakeParam).value).toBeCloseTo(LIM_TRIM_LINEAR, 12);
  expect(LIM_MAKEUP_COMP_DB).toBeLessThanOrEqual(0);
  expect(ceiling.kind).toBe('WaveShaper');
  expect(ceiling.oversample).toBe(CEILING_OVERSAMPLE);
  expect(ceiling.curve).toBeInstanceOf(Float32Array);
  let ceilingPeak = 0;
  for (const v of ceiling.curve as Float32Array) ceilingPeak = Math.max(ceilingPeak, Math.abs(v));
  expect(ceilingPeak).toBeLessThan(Math.pow(10, -1 / 20));
  expect(terminal.map((n) => n.kind)).toEqual(['destination']);
  return { masterOutput, musicDuck };
}

/** Follow one SFX bus from its input to the master, returning the kinds passed. */
function walkSfxBus(input: FakeNode, master: FakeNode): string[] {
  const kinds: string[] = [];
  let cursor = input;
  const seen = new Set<FakeNode>();
  while (cursor !== master) {
    expect(seen.has(cursor)).toBe(false);
    seen.add(cursor);
    kinds.push(cursor.kind);
    // Stage 4 permits one room-send edge at the diegetic category duck.
    // All other nodes retain the pinned dry path; rooms are created lazily.
    if (kinds.length === 2 && cursor.targets.length === 2) {
      expect(cursor.kind).toBe('Gain');
      expect(cursor.targets[1].kind).toBe('Gain');
      expect(cursor.targets[1].targets).toHaveLength(0);
    } else {
      expect(cursor.targets, `${cursor.kind} fans out`).toHaveLength(1);
    }
    cursor = cursor.targets[0];
  }
  return kinds;
}

describe('audioCore Stage 2 mastering tail and category buses (read-only law)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('live chain: musicBus → submerge → sceneEnvelope → visibility → glue → safety → trim → musicDuck → master → limiter → trim → ceiling → route', async () => {
    const { nodes } = stubLiveEnv();
    const core = await import('./audioCore.ts');
    const bus = core.getMusicBus() as unknown as FakeNode;
    expect(bus).toBeTruthy();
    const path = walkMusicPath(bus);
    expect(path.slice(0, 4).map((n) => n.kind)).toEqual(['Gain', 'BiquadFilter', 'Gain', 'Gain']);
    expect(path[3].targets).toHaveLength(1);
    const { masterOutput } = expectStage2Tail(path, 4);
    // Exactly three compressors exist in the whole graph: glue, safety, limiter.
    expect(nodes.filter((n) => n.kind === 'DynamicsCompressor')).toHaveLength(3);
    // The SFX join node is the post-safety master, upstream of the limiter.
    expect(core.getGameAudioSfxJoinNode()).toBe(masterOutput);
    // Diegetic buses: gain → duck → the one muffle → sfxOutput → master; ui is dry.
    const player = core.getGameAudioCategoryBusInput('player') as unknown as FakeNode;
    expect(walkSfxBus(player, masterOutput)).toEqual(['Gain', 'Gain', 'BiquadFilter', 'Gain']);
    const ship = core.getGameAudioCategoryBusInput('ship') as unknown as FakeNode;
    expect(walkSfxBus(ship, masterOutput)).toEqual(['Gain', 'Gain', 'BiquadFilter', 'Gain']);
    const world = core.getGameAudioCategoryBusInput('world') as unknown as FakeNode;
    expect(walkSfxBus(world, masterOutput)).toEqual(['Gain', 'Gain', 'BiquadFilter', 'Gain']);
    const ui = core.getGameAudioCategoryBusInput('ui') as unknown as FakeNode;
    expect(walkSfxBus(ui, masterOutput)).toEqual(['Gain', 'Gain', 'Gain']);
    const voice = core.getGameAudioCategoryBusInput('voice') as unknown as FakeNode;
    expect(walkSfxBus(voice, masterOutput)).toEqual(['Gain', 'Gain', 'Gain']);
    // One SFX muffle, one SFX sub-master, shared by every bus.
    expect(player.targets[0].targets[0]).toBe(ship.targets[0].targets[0]);
    expect(ui.targets[0].targets[0]).toBe(player.targets[0].targets[0].targets[0]);
  });

  it('offline mirror: identical tail; pre-tail taps before the tail; pre-stage-2 is the Stage 1 tail with the legacy safety compressor and no limiter', async () => {
    stubLiveEnv();
    const core = await import('./audioCore.ts');
    const shipped = makeRecordingContext();
    const chain = core.createOfflineMusicRuntimeChain(shipped.ctx as unknown as BaseAudioContext);
    const path = walkMusicPath(chain.bus as unknown as FakeNode);
    expect(path.slice(0, 4).map((n) => n.kind)).toEqual(['Gain', 'BiquadFilter', 'Gain', 'Gain']);
    const { masterOutput } = expectStage2Tail(path, 4);
    expect(chain.sfxJoin).toBe(masterOutput);
    expect(shipped.nodes.filter((n) => n.kind === 'DynamicsCompressor')).toHaveLength(3);
    expect(walkSfxBus(chain.sfx.input('player') as unknown as FakeNode, masterOutput)).toEqual([
      'Gain',
      'Gain',
      'BiquadFilter',
      'Gain'
    ]);

    const preTail = makeRecordingContext();
    const tap = core.createOfflineMusicRuntimeChain(preTail.ctx as unknown as BaseAudioContext, { tail: 'pre-tail' });
    expect(walkMusicPath(tap.bus as unknown as FakeNode).map((n) => n.kind)).toEqual([
      'Gain',
      'BiquadFilter',
      'Gain',
      'Gain',
      'Gain',
      'Gain',
      'destination'
    ]);
    expect(preTail.nodes.filter((n) => n.kind === 'DynamicsCompressor')).toHaveLength(0);

    const legacy = makeRecordingContext();
    const old = core.createOfflineMusicRuntimeChain(legacy.ctx as unknown as BaseAudioContext, { tail: 'pre-stage-2' });
    const oldPath = walkMusicPath(old.bus as unknown as FakeNode);
    expect(oldPath.map((n) => n.kind)).toEqual([
      'Gain',
      'BiquadFilter',
      'Gain',
      'Gain',
      'DynamicsCompressor',
      'Gain',
      'WaveShaper',
      'DynamicsCompressor',
      'Gain',
      'Gain',
      'destination'
    ]);
    expectGlue(oldPath[4], oldPath[5], oldPath[6]);
    const safety = oldPath[7];
    expect((safety.threshold as FakeParam).value).toBe(LEGACY_SAFETY_THRESHOLD_DB);
    expect((safety.ratio as FakeParam).value).toBe(LEGACY_SAFETY_RATIO);
    expect((safety.knee as FakeParam).value).toBe(UNTOUCHED);
  });
});
