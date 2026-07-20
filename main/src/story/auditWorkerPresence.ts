import type { StoryChapter } from './storyState.ts';
import { STORY_PRIMARY_WORLD_ID } from './tidegardenRoute.ts';

/**
 * W-7744 is embodied only for his arrival, audit, refusal and A4 flight on
 * Origin. The physical pack tear starts a short live grounded exit; completing
 * that exit (or loading a save that already owns the tear receipt) closes his
 * transient render lifetime. Later Origin loads retain the pack, not a stranded
 * copy of its former owner.
 */
export function shouldMountAuditWorker(
  chapter: StoryChapter,
  worldId: string,
  departureComplete: boolean
): boolean {
  return worldId === STORY_PRIMARY_WORLD_ID
    && chapter === 'ch4'
    && !departureComplete;
}
