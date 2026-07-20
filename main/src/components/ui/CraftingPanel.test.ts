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

  it('dismisses the Tidegarden fabricator when the requested Habitat Core is crafted', () => {
    const craftCore = {
      active: true,
      beat: 'ch9-settle',
      runId: 9,
      objectiveId: 'settle:craft-core'
    };
    expect(craftTriggeredStoryTransition(true, craftCore, craftCore, 'habitat_core')).toBe(true);
    expect(craftTriggeredStoryTransition(true, craftCore, craftCore, 'lift_cell')).toBe(false);
    expect(craftTriggeredStoryTransition(false, craftCore, craftCore, 'habitat_core')).toBe(false);
  });
});
