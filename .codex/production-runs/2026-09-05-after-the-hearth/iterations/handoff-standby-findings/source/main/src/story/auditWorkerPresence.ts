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
  departureComplete: boolean,
  /**
   * The ch13 reciprocal proof is held. He then stays at the audit site as a
   * local tester across free play and later loads, INDEPENDENT of which chapter
   * is active — the chapter ended, he did not leave.
   */
  commonGroundEstablished = false
): boolean {
  // Chapter 13 mounts him again, at Origin, and it is INDEPENDENT of the A4
  // pack-departure latch. That latch is the proof that his chapter-4 render
  // lifetime ended, and it must keep meaning exactly that: ch5-ch12 loads still
  // find the pack and not a stranded copy of its former owner. He comes back in
  // ch13 because he came back — a body that returned, not a body that never left.
  if (worldId !== STORY_PRIMARY_WORLD_ID) return false;
  if (chapter === 'ch13' || commonGroundEstablished) return true;
  return chapter === 'ch4' && !departureComplete;
}
