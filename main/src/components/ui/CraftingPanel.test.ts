import { describe, expect, it } from 'vitest';
import { craftTriggeredStoryTransition } from './CraftingPanel.tsx';

describe('CraftingPanel story hand-off', () => {
  const gather = { active: true, beat: 'ch3-gather', runId: 4 };

  it('dismisses only after a successful craft changes the active story beat', () => {
    expect(craftTriggeredStoryTransition(true, gather, {
      active: true,
      beat: 'ch3-dusk',
      runId: 4
    })).toBe(true);

    expect(craftTriggeredStoryTransition(false, gather, {
      active: true,
      beat: 'ch3-dusk',
      runId: 4
    })).toBe(false);
    expect(craftTriggeredStoryTransition(true, gather, gather)).toBe(false);
  });

  it('also dismisses when crafting crosses a story activation boundary', () => {
    expect(craftTriggeredStoryTransition(true, {
      active: false,
      beat: null,
      runId: 1
    }, {
      active: true,
      beat: 'ch3-gather',
      runId: 2
    })).toBe(true);
  });
});
