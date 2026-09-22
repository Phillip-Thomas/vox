import type { StoryBeat } from './storyState.ts';
import type { GuidedStoryObjective } from './ux/objectiveDirector.ts';
import { BEAT_DEFINITIONS } from './beats/definitions.ts';
import { normalizeFacts, type StoryObjectiveBeatDisposition, type StoryObjectiveGuidanceFacts } from './beats/objectivePrimitives.ts';
export * from './beats/objectivePrimitives.ts';

/** Generated view of the same declarations the runtime reads. Computed on
 * demand: the beat contracts import runtime directors that import this module,
 * so an eager view built at load time sees a half-initialised BEAT_DEFINITIONS
 * whenever a contract module is the import entry point (as in the beat tests). */
export function storyObjectiveGuidanceClassification(): Partial<Record<StoryBeat, StoryObjectiveBeatDisposition>> {
  return Object.fromEntries(
    Object.values(BEAT_DEFINITIONS).map(contract => [contract.id, contract.disposition])
  ) as Partial<Record<StoryBeat, StoryObjectiveBeatDisposition>>;
}
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
