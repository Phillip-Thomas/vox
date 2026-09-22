import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- CG-IMPL-016: the driver's own foreground seam -------------------------------------
//
// THE REAL CALLBACK, NOT A REGEX OVER IT. This file renders the shipped
// `StoryDirectorDriver`, captures the per-frame callback it actually registers
// with `useFrame`, and runs it against the real exported suspension seam it
// calls. Reading the source for a condition would prove nothing about which
// frames reach that call.
const driverTest = vi.hoisted(() => ({
  frame: null as null | ((state: unknown, dt: number) => void),
  suspend: vi.fn(),
  story: { active: true, beat: 'ch13-common-ground' as string | null }
}));

vi.mock('@react-three/fiber', () => ({
  useFrame: (callback: (state: unknown, dt: number) => void) => {
    driverTest.frame = callback;
  },
  useThree: (selector?: (state: unknown) => unknown) => {
    const state = {
      camera: { isPerspectiveCamera: false },
      clock: { elapsedTime: 0, getElapsedTime: () => 0 },
      gl: { domElement: { clientWidth: 1280, clientHeight: 720 } },
      size: { width: 1280, height: 720 },
      scene: {}
    };
    return selector ? selector(state) : state;
  },
  addAfterEffect: () => () => {}
}));

vi.mock('./storyState.ts', async importOriginal => {
  const actual = await importOriginal<typeof import('./storyState.ts')>();
  return {
    ...actual,
    getStoryStateSnapshot: () => ({ ...actual.getStoryStateSnapshot(), ...driverTest.story })
  };
});

vi.mock('./commonGroundDirector.ts', async importOriginal => {
  const actual = await importOriginal<typeof import('./commonGroundDirector.ts')>();
  return { ...actual, suspendCommonGroundPresentation: driverTest.suspend };
});

import { enterPlaying, returnToMenu } from '../state/appState.ts';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import StoryDirectorDriver from './StoryDirectorDriver.tsx';

function mountDriver(paused: boolean): (state: unknown, dt: number) => void {
  driverTest.frame = null;
  renderToStaticMarkup(createElement(StoryDirectorDriver, { paused, planetRadius: 50 }));
  const frame = driverTest.frame;
  if (!frame) throw new Error('the driver registered no per-frame callback');
  return frame;
}

/** One real frame through the shipped callback. */
function runFrame(options: {
  paused?: boolean;
  active?: boolean;
  phase?: string;
  hidden?: boolean;
}): void {
  driverTest.story = { active: options.active ?? true, beat: 'ch13-common-ground' };
  // The REAL app phase and the REAL visibility the driver reads, not a stub of
  // its own predicate.
  if ((options.phase ?? 'playing') === 'playing') enterPlaying(); else returnToMenu();
  if (options.hidden) {
    (globalThis as { document?: unknown }).document = { visibilityState: 'hidden' };
  } else {
    delete (globalThis as { document?: unknown }).document;
  }
  const frame = mountDriver(options.paused ?? false);
  frame({
    camera: { isPerspectiveCamera: false },
    clock: { elapsedTime: 0, getElapsedTime: () => 0 },
    gl: { domElement: { clientWidth: 1280, clientHeight: 720 } },
    size: { width: 1280, height: 720 },
    scene: {}
  }, 1 / 60);
}

describe('the driver suspends the finale only for an actual interruption (CG-IMPL-016)', () => {
  beforeEach(() => {
    driverTest.suspend.mockClear();
  });

  afterEach(() => {
    driverTest.story = { active: true, beat: 'ch13-common-ground' };
    delete (globalThis as { document?: unknown }).document;
    enterPlaying();
  });

  it('does NOT cancel on the normal handback frame, where the story just went inactive', () => {
    // The measured window: the completion frame is visible, focused, playing and
    // unpaused, and only `story.active` has turned false because the story is
    // DONE. That frame is the signed exception, and this callback is a necessary
    // condition for the token surviving it — the driver is one caller among the
    // seams that can cancel, and the others are asserted below and at their own
    // modules.
    runFrame({ active: false });
    expect(driverTest.suspend).not.toHaveBeenCalled();
  });

  it('still cancels a paused frame, with the pause reason, done or not', () => {
    runFrame({ active: true, paused: true });
    expect(driverTest.suspend).toHaveBeenCalledWith('pause');
    driverTest.suspend.mockClear();
    // A story that finished and was then paused is an interruption of the token,
    // and the exception does not cover it.
    runFrame({ active: false, paused: true });
    expect(driverTest.suspend).toHaveBeenCalledWith('pause');
  });

  it('still cancels a hidden document, done or not', () => {
    runFrame({ active: true, hidden: true });
    expect(driverTest.suspend).toHaveBeenCalledWith('visibility-loss');
    driverTest.suspend.mockClear();
    runFrame({ active: false, hidden: true });
    expect(driverTest.suspend).toHaveBeenCalledWith('visibility-loss');
  });

  it('still cancels when the app phase leaves play — menu, quit or any exit', () => {
    runFrame({ active: true, phase: 'menu' });
    expect(driverTest.suspend).toHaveBeenCalledTimes(1);
    driverTest.suspend.mockClear();
    runFrame({ active: false, phase: 'menu' });
    expect(driverTest.suspend).toHaveBeenCalledTimes(1);
  });

  it('never suspends an ordinary live foreground frame', () => {
    runFrame({ active: true });
    expect(driverTest.suspend).not.toHaveBeenCalled();
  });
});
