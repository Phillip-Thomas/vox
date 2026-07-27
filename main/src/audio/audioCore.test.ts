import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AUDIO_PARAM_SLEW_SETTLE_TAU_COUNT,
  rampParamAt,
  scheduleMusicSceneEnvelopeParam
} from './audioCore.ts';

function fakeParam() {
  return {
    value: 0,
    cancelAndHoldAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
    setValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn()
  };
}

function fakeNode(extra: Record<string, unknown> = {}) {
  return { connect: vi.fn(), disconnect: vi.fn(), ...extra };
}

function fakeAudioElement() {
  const el = {
    paused: true,
    ended: false,
    readyState: 2,
    autoplay: false,
    playsInline: false,
    srcObject: null as unknown,
    setAttribute: vi.fn(),
    play: vi.fn(() => {
      el.paused = false;
      return Promise.resolve();
    })
  };
  return el;
}

interface EnvOptions {
  ios?: boolean;
  state?: string;
  media?: boolean;
}

function stubAudioEnv(opts: EnvOptions = {}) {
  // Fresh module instance so the cached AudioContext / route registry reset.
  vi.resetModules();
  const audioEl = fakeAudioElement();
  const ctx = {
    state: opts.state ?? 'suspended',
    currentTime: 0,
    destination: fakeNode(),
    resume: vi.fn(() => {
      ctx.state = 'running';
      return Promise.resolve();
    }),
    createDynamicsCompressor: vi.fn(() => fakeNode({ threshold: fakeParam(), ratio: fakeParam() })),
    createGain: vi.fn(() => fakeNode({ gain: fakeParam() })),
    createBiquadFilter: vi.fn(() => fakeNode({ frequency: fakeParam(), Q: fakeParam(), type: 'lowpass' })),
    ...(opts.media
      ? { createMediaStreamDestination: vi.fn(() => fakeNode({ stream: {} })) }
      : {})
  };
  const win = {
    AudioContext: function AudioContextCtor() {
      return ctx;
    },
    addEventListener: vi.fn()
  };
  const doc = {
    createElement: vi.fn(() => audioEl),
    addEventListener: vi.fn(),
    visibilityState: 'visible',
    hidden: false,
    ...(opts.ios ? { ontouchend: null } : {})
  };
  const nav = opts.ios
    ? { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', platform: 'iPhone', maxTouchPoints: 5 }
    : { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', platform: 'Win32', maxTouchPoints: 0 };
  vi.stubGlobal('window', win);
  vi.stubGlobal('document', doc);
  vi.stubGlobal('navigator', nav);
  return { ctx, audioEl };
}

describe('audioCore unlock and iOS output routing', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('resumes an iOS "interrupted" context, not just "suspended"', async () => {
    const { ctx } = stubAudioEnv({ ios: false, state: 'interrupted' });
    const core = await import('./audioCore.ts');
    core.unlockAudio();
    expect(ctx.resume).toHaveBeenCalledTimes(1);
    vi.resetModules();
  });

  it('does not resume an already-running context', async () => {
    const { ctx } = stubAudioEnv({ ios: false, state: 'running' });
    const core = await import('./audioCore.ts');
    core.unlockAudio();
    expect(ctx.resume).not.toHaveBeenCalled();
    vi.resetModules();
  });

  it('keeps the direct destination route on non-iOS platforms', async () => {
    stubAudioEnv({ ios: false, state: 'suspended', media: true });
    const core = await import('./audioCore.ts');
    core.getAudioContext();
    core.unlockAudio();
    await Promise.resolve();
    await Promise.resolve();
    expect(core.describeGameAudioOutputRoutes()).toContain('game: direct');
    expect(core.areGameAudioRoutesConfirmed()).toBe(true);
    vi.resetModules();
  });

  it('routes through a playsinline media element on iOS and confirms only when it plays', async () => {
    const { audioEl } = stubAudioEnv({ ios: true, state: 'suspended', media: true });
    const core = await import('./audioCore.ts');
    core.getAudioContext();
    // Before the gesture the media element is not playing: not yet confirmed.
    expect(core.areGameAudioRoutesConfirmed()).toBe(false);

    core.unlockAudio();
    // Flush the el.play() promise chain that upgrades the route.
    await Promise.resolve();
    await Promise.resolve();

    expect(audioEl.setAttribute).toHaveBeenCalledWith('playsinline', '');
    expect(audioEl.play).toHaveBeenCalledTimes(1);
    expect(core.describeGameAudioOutputRoutes()).toContain('game: media-element');
    expect(core.areGameAudioRoutesConfirmed()).toBe(true);
    vi.resetModules();
  });
});

const FALLBACK_AT_S = 5;
const FALLBACK_SLEW_S = 1.2;
const FALLBACK_TARGET = 0.25;

describe('audioCore continuity-safe automation', () => {
  it('uses a start-timed target curve when cancelAndHoldAtTime is unavailable', () => {
    const cancelScheduledValues = vi.fn();
    const setTargetAtTime = vi.fn();
    const linearRampToValueAtTime = vi.fn();
    const param = {
      cancelScheduledValues,
      setTargetAtTime,
      linearRampToValueAtTime
    } as unknown as AudioParam;

    rampParamAt(param, FALLBACK_TARGET, FALLBACK_AT_S, FALLBACK_SLEW_S);

    expect(cancelScheduledValues).toHaveBeenCalledExactlyOnceWith(FALLBACK_AT_S);
    expect(setTargetAtTime).toHaveBeenCalledExactlyOnceWith(
      FALLBACK_TARGET,
      FALLBACK_AT_S,
      FALLBACK_SLEW_S / AUDIO_PARAM_SLEW_SETTLE_TAU_COUNT
    );
    expect(linearRampToValueAtTime).not.toHaveBeenCalled();
  });

  it('start-anchors literal scene-envelope points without target-curve drift', () => {
    const cancelAndHoldAtTime = vi.fn();
    const setValueAtTime = vi.fn();
    const linearRampToValueAtTime = vi.fn();
    const param = {
      value: 0.65,
      cancelAndHoldAtTime,
      cancelScheduledValues: vi.fn(),
      setValueAtTime,
      linearRampToValueAtTime
    } as unknown as AudioParam;

    scheduleMusicSceneEnvelopeParam(
      param,
      5,
      [
        { offsetSeconds: 0.04, value: 0 },
        { offsetSeconds: 0.14, value: 0 },
        { offsetSeconds: 0.26, value: 1 }
      ],
      0.65
    );

    expect(cancelAndHoldAtTime).toHaveBeenCalledExactlyOnceWith(5);
    expect(setValueAtTime).toHaveBeenCalledExactlyOnceWith(0.65, 5);
    expect(linearRampToValueAtTime.mock.calls).toEqual([
      [0, 5.04],
      [0, 5.14],
      [1, 5.26]
    ]);
  });
});
