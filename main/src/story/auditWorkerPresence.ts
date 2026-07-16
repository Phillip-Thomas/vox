import type { StoryChapter } from './storyState.ts';
import { STORY_PRIMARY_WORLD_ID } from './tidegardenRoute.ts';

const AUDITOR_PRESENT_CHAPTERS = new Set<StoryChapter>([
  'ch4',
  'ch5',
  'ch6',
  'ch7',
  'ch8',
  'ch9',
  'complete'
]);

/**
 * W-7744 remains a physical fact on Origin after arriving. He is not copied to
 * Tidegarden; revisiting Origin later in the story remounts the same actor.
 */
export function shouldMountAuditWorker(
  chapter: StoryChapter,
  worldId: string
): boolean {
  return worldId === STORY_PRIMARY_WORLD_ID && AUDITOR_PRESENT_CHAPTERS.has(chapter);
}
