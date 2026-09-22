import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import LandingMenu from './LandingMenu.tsx';

const state = vi.hoisted(() => ({
  completed: false, inProgress: false, chapter: 'prologue', active: false,
  begin: vi.fn(), play: vi.fn(), sceneReady: true,
  effects: [] as (() => void)[],
  buttons: [] as React.ButtonHTMLAttributes<HTMLButtonElement>[]
}));
// Exercise the rendered menu's real click handler without a DOM or GPU.
vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual,
    useState: (initial: unknown) => [initial, vi.fn()],
    useEffect: (effect: () => void) => { state.effects.push(effect); },
    useMemo: (compute: () => unknown) => compute(),
    useSyncExternalStore: (_subscribe: unknown, read: () => unknown) => read()
  };
});
vi.mock('../../state/appState.ts', () => ({
  useAppState: () => ({ phase: 'menu', sceneReady: state.sceneReady }),
  enterPlaying: state.play, getGameCanvas: () => null
}));
vi.mock('../../story/storyState.ts', () => ({
  STORY_CHAPTER_ORDER: ['prologue', 'ch1', 'ch10', 'ch13', 'ch14', 'complete'],
  useStoryState: () => ({ active: state.active, chapter: state.chapter }),
  canContinueStory: () => state.inProgress,
  hasCompletedStory: () => state.completed,
  storyEntryPoint: () => ({ chapter: state.chapter }),
  beginStory: state.begin, getStoryStateSnapshot: () => ({ active: state.active, chapter: state.chapter })
}));
vi.mock('../../utils/mobileInput.ts', () => ({ isTouchDevice: () => true }));
vi.mock('../../audio/gameAudio.ts', () => ({ unlockGameAudio: vi.fn() }));
vi.mock('../../game/multiplayerAuth.ts', () => ({ isCoopAuthEnabled: () => false }));
vi.mock('../../config/graphicsSettings.ts', () => ({
  getQualityProfile: () => 'HIGH', getGraphicsQuality: () => 'HIGH',
  setQualityProfile: vi.fn(), subscribeGraphicsQuality: () => () => {}
}));
vi.mock('./AudioControls.tsx', () => ({ default: () => null }));
vi.mock('./CoopPanel.tsx', () => ({ default: () => null }));
vi.mock('./ControlsReference.tsx', () => ({ default: () => null }));

function renderMenu() {
  const returnToSite = vi.fn();
  const tree = LandingMenu({ startWorldId: 'origin', onReplayStory: vi.fn(),
    onReturnToStorySite: returnToSite, returningToStorySite: false }) as React.ReactElement | null;
  function collect(node: React.ReactNode): void {
    React.Children.forEach(node, child => {
      if (!React.isValidElement<{ children?: React.ReactNode }>(child)) return;
      if (child.type === 'button') state.buttons.push(child.props);
      collect(child.props.children);
    });
  }
  collect(tree);
  const html = renderToStaticMarkup(tree);
  const primary = state.buttons.find(button => button['aria-describedby'] === 'landing-story-subtitle');
  expect(primary).toBeDefined();
  return { html, returnToSite, click: () => primary!.onClick!({} as React.MouseEvent<HTMLButtonElement>) };
}

describe('LandingMenu Continue selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.buttons.length = 0; state.effects.length = 0; state.sceneReady = true;
    Object.assign(state, { completed: false, inProgress: false, chapter: 'prologue', active: false });
    state.begin.mockImplementation(() => { state.active = true; });
  });
  it.each(['ch10', 'ch13', 'ch14'])('resumes unfinished %s despite completed ch9', chapter => {
    Object.assign(state, { completed: true, inProgress: true, chapter });
    const menu = renderMenu();
    expect(menu.html).toContain('Continue');
    expect(menu.html).toContain('Resume · Chapter');
    expect(menu.html).not.toContain('Story complete');
    menu.click();
    expect(state.begin).toHaveBeenCalledOnce();
    expect(menu.returnToSite).not.toHaveBeenCalled();
    expect(state.play).toHaveBeenCalledOnce();
  });
  it('finishes a Continue clicked before the scene is ready', () => {
    Object.assign(state, { completed: true, inProgress: true, chapter: 'ch14', sceneReady: false });
    renderMenu().click();
    state.effects.forEach(effect => effect());
    expect(state.play).not.toHaveBeenCalled();
    state.sceneReady = true; state.effects.length = 0;
    renderMenu(); state.effects.forEach(effect => effect());
    expect(state.play).toHaveBeenCalledOnce();
  });
  it('returns a terminal save to its earned world', () => {
    Object.assign(state, { completed: true, chapter: 'complete' });
    const menu = renderMenu();
    expect(menu.html).toContain('Story complete · Return to your world');
    menu.click();
    expect(menu.returnToSite).toHaveBeenCalledOnce();
    expect(state.begin).not.toHaveBeenCalled();
  });
  it.each([false, true])('preserves early entry with an existing save = %s', inProgress => {
    state.inProgress = inProgress;
    const menu = renderMenu();
    expect(menu.html).toContain(inProgress ? 'Resume · Prologue' : 'Begin the story');
    menu.click();
    expect(state.begin).toHaveBeenCalledOnce();
    expect(menu.returnToSite).not.toHaveBeenCalled();
    expect(state.play).not.toHaveBeenCalled();
  });
  it('keeps Free Play independent of unfinished later chapters', () => {
    Object.assign(state, { completed: true, inProgress: true, chapter: 'ch14' });
    const menu = renderMenu();
    const freePlay = state.buttons.find(button => button.title?.startsWith('Open sandbox'));
    expect(freePlay).toBeDefined();
    freePlay!.onClick!({} as React.MouseEvent<HTMLButtonElement>);
    expect(state.play).toHaveBeenCalledOnce();
    expect(state.begin).not.toHaveBeenCalled();
    expect(menu.returnToSite).not.toHaveBeenCalled();
  });
});
