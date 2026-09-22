import type { StoryBeat } from './storyState.ts';

/** Compatibility query: every screening chapter now uses real movement recovery. */
export function allowsMovieTeleportRecovery(_beat: StoryBeat | null): boolean { return false; }
