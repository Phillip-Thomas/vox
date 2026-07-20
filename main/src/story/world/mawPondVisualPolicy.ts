import type { StoryBeat } from '../storyState.ts';

export type MawPondVisualPhase = 'absent' | 'prewarm' | 'revealed';

/**
 * Hero interaction frames may reveal already-resident GPU resources, but they
 * must not create lights, materials, geometry, or shader variants. A4 gives the
 * pond response an early hidden prewarm window; Ch5 direct entry still has the
 * complete repair ritual before its reveal.
 */
export function resolveMawPondVisualPhase(
  storyActive: boolean,
  beat: StoryBeat | null,
  directionResolved: boolean
): MawPondVisualPhase {
  if (!storyActive || (beat !== 'a4-exhale' && beat !== 'ch5-maw' && beat !== 'ch6-dive')) {
    return 'absent';
  }
  return directionResolved ? 'revealed' : 'prewarm';
}

export const MAW_POND_GLOW_TECHNIQUE = 'prewarmed-additive-unlit' as const;
