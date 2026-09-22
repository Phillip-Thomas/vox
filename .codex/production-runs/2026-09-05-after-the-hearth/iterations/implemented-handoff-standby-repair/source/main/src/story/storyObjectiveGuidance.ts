import type { StoryBeat } from './storyState.ts';
import type { GuidedStoryObjective } from './ux/objectiveDirector.ts';
import { BEAT_DEFINITIONS } from './beats/definitions.ts';
import { normalizeFacts, type StoryObjectiveBeatDisposition, type StoryObjectiveGuidanceFacts } from './beats/objectivePrimitives.ts';
export * from './beats/objectivePrimitives.ts';

/** Generated view of the same declarations the runtime reads. */
export const STORY_OBJECTIVE_GUIDANCE_CLASSIFICATION = Object.fromEntries(
  Object.values(BEAT_DEFINITIONS).map(contract => [contract.id, contract.disposition])
) as Partial<Record<StoryBeat, StoryObjectiveBeatDisposition>>;
export type StoryObjectiveGuidanceBeat = StoryBeat;
export type StoryObjectiveAuthoredBeat = StoryBeat;

export function classifyStoryObjectiveGuidanceBeat(beat: StoryBeat): StoryObjectiveBeatDisposition | 'outside-scope' {
  return BEAT_DEFINITIONS[beat]?.disposition ?? 'outside-scope';
}

/** Pure candidate resolution: contracts decide presentation, facts decide progression. */
export function resolveStoryObjectiveGuidance(
  beat: StoryBeat,
  input: Readonly<Partial<StoryObjectiveGuidanceFacts>> = {}
): GuidedStoryObjective | null {
  return BEAT_DEFINITIONS[beat]?.objective?.(normalizeFacts(input)) ?? null;
}
