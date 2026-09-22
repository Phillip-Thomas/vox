import type { StoryBeat } from '../storyState.ts';
import type { RailRuntime } from '../autopilot.ts';
import { BEAT_DEFINITIONS } from '../beats/definitions.ts';

export const BEAT_RAILS: Partial<Record<StoryBeat, (ctx: RailRuntime) => void>> = Object.fromEntries(
  Object.values(BEAT_DEFINITIONS).filter(beat => beat.rail.tick).map(beat => [beat.id, beat.rail.tick])
);
