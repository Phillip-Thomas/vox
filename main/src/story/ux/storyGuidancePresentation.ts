import type { AppPhase } from '../../state/appState.ts';
import {
  storyHudTakeover,
  storyUsesEmbodiedGuidanceHud,
  type StorySnapshot
} from '../storyState.ts';

/**
 * One presentation hand-off table for the regulation and embodied HUDs. The
 * feed may remain mounted for redaction/camera treatment after embodiment, but
 * objective copy and its directional marker always have exactly one owner.
 */
export interface StoryGuidancePresentationOwnership {
  feedEffectsMounted: boolean;
  regulationObjectiveMounted: boolean;
  regulationMarkerMounted: boolean;
  embodiedObjectiveMounted: boolean;
  embodiedMarkerMounted: boolean;
}

export function getStoryGuidancePresentationOwnership(
  story: StorySnapshot,
  phase: AppPhase
): StoryGuidancePresentationOwnership {
  const playing = phase === 'playing';
  const feedEffectsMounted = playing && storyHudTakeover(story);
  const embodiedGuidance = playing && storyUsesEmbodiedGuidanceHud(story);

  return {
    feedEffectsMounted,
    regulationObjectiveMounted: feedEffectsMounted && !embodiedGuidance,
    regulationMarkerMounted: feedEffectsMounted && !embodiedGuidance,
    embodiedObjectiveMounted: embodiedGuidance,
    embodiedMarkerMounted: embodiedGuidance
  };
}
