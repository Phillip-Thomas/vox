import { describe, expect, it } from 'vitest';
import {
  storyUsesEmbodiedGuidanceHud,
  type StoryBeat,
  type StoryChapter,
  type StorySnapshot
} from '../storyState.ts';
import { getStoryGuidancePresentationOwnership } from './storyGuidancePresentation.ts';

function story(
  chapter: StoryChapter,
  beat: StoryBeat | null,
  active = true
): StorySnapshot {
  return { active, chapter, beat, runId: 1 };
}

describe('story guidance presentation hand-off', () => {
  it('begins only after the ch1 lift completes into the embodied anomaly beat', () => {
    expect(storyUsesEmbodiedGuidanceHud(story('ch1', 'ch1-lift'))).toBe(false);
    expect(storyUsesEmbodiedGuidanceHud(story('ch1', 'ch1-anomaly'))).toBe(true);
    expect(storyUsesEmbodiedGuidanceHud(story('ch1', 'a1-ramp'))).toBe(true);
    expect(storyUsesEmbodiedGuidanceHud(story('ch8', 'ch8-crossing'))).toBe(true);
    expect(storyUsesEmbodiedGuidanceHud(story('ch9', 'ch9-hearth'))).toBe(true);
  });

  it('never mounts embodied guidance for inactive or beatless story state', () => {
    expect(storyUsesEmbodiedGuidanceHud(story('ch6', 'ch6-dive', false))).toBe(false);
    expect(storyUsesEmbodiedGuidanceHud(story('none', null))).toBe(false);
  });

  it('keeps feed effects but transfers objective and marker ownership exactly once', () => {
    const external = getStoryGuidancePresentationOwnership(
      story('ch1', 'ch1-lift'),
      'playing'
    );
    expect(external).toEqual({
      feedEffectsMounted: true,
      regulationObjectiveMounted: true,
      regulationMarkerMounted: true,
      embodiedObjectiveMounted: false,
      embodiedMarkerMounted: false
    });

    const embodiedFeed = getStoryGuidancePresentationOwnership(
      story('ch1', 'ch1-anomaly'),
      'playing'
    );
    expect(embodiedFeed).toEqual({
      feedEffectsMounted: true,
      regulationObjectiveMounted: false,
      regulationMarkerMounted: false,
      embodiedObjectiveMounted: true,
      embodiedMarkerMounted: true
    });
    expect(Number(embodiedFeed.regulationObjectiveMounted)
      + Number(embodiedFeed.embodiedObjectiveMounted)).toBe(1);
    expect(Number(embodiedFeed.regulationMarkerMounted)
      + Number(embodiedFeed.embodiedMarkerMounted)).toBe(1);
  });

  it('keeps the embodied objective and marker mounted after the feed era', () => {
    expect(getStoryGuidancePresentationOwnership(
      story('ch6', 'ch6-dive'),
      'playing'
    )).toEqual({
      feedEffectsMounted: false,
      regulationObjectiveMounted: false,
      regulationMarkerMounted: false,
      embodiedObjectiveMounted: true,
      embodiedMarkerMounted: true
    });
  });

  it('mounts no story guidance while the app is on the menu', () => {
    expect(getStoryGuidancePresentationOwnership(
      story('ch1', 'ch1-anomaly'),
      'menu'
    )).toEqual({
      feedEffectsMounted: false,
      regulationObjectiveMounted: false,
      regulationMarkerMounted: false,
      embodiedObjectiveMounted: false,
      embodiedMarkerMounted: false
    });
  });
});
