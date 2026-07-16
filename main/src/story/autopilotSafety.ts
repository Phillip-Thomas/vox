import type { StoryBeat } from './storyState.ts';

const RECEIPT_DRIVEN_EMERGENT_BEATS: ReadonlySet<StoryBeat> = new Set([
  'ch4-audit',
  'ch4-comply',
  'ch4-defy',
  'a4-exhale',
  'ch5-maw',
  'ch6-dive',
  'ch7-reconstruct',
  'ch7-board',
  'ch8-launch',
  'ch8-crossing',
  'ch8-landfall',
  'ch9-settle',
  'ch9-hearth'
]);

/**
 * Legacy screening chapters retain their development-only escape hatch. The
 * signed emergent rail advances only through physical gameplay receipts, so a
 * teleport can never be used as navigation recovery there.
 */
export function allowsMovieTeleportRecovery(beat: StoryBeat | null): boolean {
  return beat !== null && !RECEIPT_DRIVEN_EMERGENT_BEATS.has(beat);
}
