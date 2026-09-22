import type { AppPhase } from '../../state/appState.ts';
import { surveyBracketMode } from '../feed/surveyBrackets.ts';
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
  /**
   * The survey brackets: the site designating quota targets the 1-bit render
   * cannot distinguish. Only the two beats that order the player to take
   * something the world gives no material cue for; every later rung has either
   * a real directional marker or restored chroma.
   */
  surveyBracketsMounted: boolean;
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
    embodiedMarkerMounted: embodiedGuidance,
    surveyBracketsMounted: feedEffectsMounted
      && !embodiedGuidance
      && surveyBracketMode(story.beat) !== null
  };
}
