import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  unlockMusicAudio: vi.fn(() => Promise.resolve()),
  unlockSfxAudio: vi.fn(() => Promise.resolve()),
  unlockStoryScore: vi.fn()
}));

vi.mock('./musicEngine.ts', () => ({ unlockMusicAudio: mocks.unlockMusicAudio }));
vi.mock('./sfxEngine.ts', () => ({ unlockSfxAudio: mocks.unlockSfxAudio }));
vi.mock('../story/storyScore.ts', () => ({ unlockStoryScore: mocks.unlockStoryScore }));

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

describe('shared game audio unlock', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
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
    expect(fake.listeners.size).toBe(0);
    expect(fake.removeEventListener).toHaveBeenCalledTimes(3);

    cleanup();
    expect(fake.removeEventListener).toHaveBeenCalledTimes(3);
  });
});
