import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  unlockMusicAudio: vi.fn(() => Promise.resolve()),
  unlockSfxAudio: vi.fn(() => Promise.resolve()),
  unlockStoryScore: vi.fn(),
  areGameAudioRoutesConfirmed: vi.fn(() => true)
}));

vi.mock('./musicEngine.ts', () => ({ unlockMusicAudio: mocks.unlockMusicAudio }));
vi.mock('./sfxEngine.ts', () => ({ unlockSfxAudio: mocks.unlockSfxAudio }));
vi.mock('../story/storyScore.ts', () => ({ unlockStoryScore: mocks.unlockStoryScore }));
vi.mock('./audioCore.ts', () => ({
  areGameAudioRoutesConfirmed: mocks.areGameAudioRoutesConfirmed
}));

interface FakeGestureTarget {
  target: EventTarget;
  listeners: Map<string, EventListener>;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
}

function fakeGestureTarget(): FakeGestureTarget {
  const listeners = new Map<string, EventListener>();
  const addEventListener = vi.fn((type: string, listener: EventListenerOrEventListenerObject | null) => {
    if (typeof listener === 'function') listeners.set(type, listener);
  });
  const removeEventListener = vi.fn((type: string) => {
    listeners.delete(type);
  });
  return {
    target: { addEventListener, removeEventListener } as unknown as EventTarget,
    listeners,
    addEventListener,
    removeEventListener
  };
}

/** Drain the unlock promise chain (allSettled → then → in-flight reset). */
async function flushMicrotasks(ticks = 12): Promise<void> {
  for (let i = 0; i < ticks; i++) await Promise.resolve();
}

describe('shared game audio unlock', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.areGameAudioRoutesConfirmed.mockReturnValue(true);
  });

  it('coalesces concurrent calls but lets a later gesture retry resume', async () => {
    const { unlockGameAudio } = await import('./gameAudio.ts');

    const first = unlockGameAudio();
    const concurrent = unlockGameAudio();

    expect(concurrent).toBe(first);
    expect(mocks.unlockStoryScore).toHaveBeenCalledTimes(1);
    expect(mocks.unlockMusicAudio).toHaveBeenCalledTimes(1);
    expect(mocks.unlockSfxAudio).toHaveBeenCalledTimes(1);
    await first;

    await unlockGameAudio();
    expect(mocks.unlockStoryScore).toHaveBeenCalledTimes(2);
    expect(mocks.unlockMusicAudio).toHaveBeenCalledTimes(2);
    expect(mocks.unlockSfxAudio).toHaveBeenCalledTimes(2);
  });

  it('ignores synthetic input and unlocks once on the first trusted gameplay gesture', async () => {
    const { installGameAudioUnlockOnFirstTrustedGesture } = await import('./gameAudio.ts');
    const fake = fakeGestureTarget();
    const cleanup = installGameAudioUnlockOnFirstTrustedGesture(fake.target);

    expect([...fake.listeners.keys()]).toEqual(['pointerdown', 'keydown', 'touchstart']);
    fake.listeners.get('keydown')?.({ isTrusted: false } as Event);
    expect(mocks.unlockMusicAudio).not.toHaveBeenCalled();

    fake.listeners.get('keydown')?.({ isTrusted: true } as Event);
    expect(mocks.unlockStoryScore).toHaveBeenCalledTimes(1);
    expect(mocks.unlockMusicAudio).toHaveBeenCalledTimes(1);
    expect(mocks.unlockSfxAudio).toHaveBeenCalledTimes(1);
    // Teardown is deferred until the unlock promise settles and the routes
    // report confirmed. Flush microtasks, then assert the listeners are gone.
    await flushMicrotasks();
    expect(fake.listeners.size).toBe(0);
    expect(fake.removeEventListener).toHaveBeenCalledTimes(3);

    cleanup();
    expect(fake.removeEventListener).toHaveBeenCalledTimes(3);
  });

  it('stays armed across gestures until a resume verifiably sticks', async () => {
    const { installGameAudioUnlockOnFirstTrustedGesture } = await import('./gameAudio.ts');
    const fake = fakeGestureTarget();
    installGameAudioUnlockOnFirstTrustedGesture(fake.target);

    // First trusted gesture: resume did not stick (routes not confirmed).
    mocks.areGameAudioRoutesConfirmed.mockReturnValue(false);
    fake.listeners.get('pointerdown')?.({ isTrusted: true } as Event);
    await flushMicrotasks();
    expect(mocks.unlockMusicAudio).toHaveBeenCalledTimes(1);
    expect(fake.listeners.size).toBe(3);
    expect(fake.removeEventListener).not.toHaveBeenCalled();

    // Second trusted gesture: routes now confirmed, so the installer tears down.
    mocks.areGameAudioRoutesConfirmed.mockReturnValue(true);
    fake.listeners.get('pointerdown')?.({ isTrusted: true } as Event);
    await flushMicrotasks();
    expect(mocks.unlockMusicAudio).toHaveBeenCalledTimes(2);
    expect(fake.listeners.size).toBe(0);
    expect(fake.removeEventListener).toHaveBeenCalledTimes(3);
  });
});
