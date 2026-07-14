// Reading pace and screen-space anchors for the regulation crawl. Keeping this
// math outside React makes the authored copy the source of truth for duration.

export const REGULATION_CRAWL_READING_WPM = 205;
export const REGULATION_CRAWL_BLANK_BEAT_SECONDS = 0.45;
export const REGULATION_CRAWL_ENTRY_EXIT_SECONDS = 4;

export const REGULATION_CRAWL_FIRST_LINE_Y = 0.72;
export const REGULATION_CRAWL_LAST_LINE_Y = 0.28;

export function regulationCrawlDurationSeconds(lines: readonly string[]): number {
  const wordCount = lines.reduce((total, line) => {
    const trimmed = line.trim();
    return total + (trimmed ? trimmed.split(/\s+/).length : 0);
  }, 0);
  const blankCount = lines.filter((line) => line.trim() === '').length;
  const readingSeconds = wordCount / (REGULATION_CRAWL_READING_WPM / 60);

  return Math.ceil(
    readingSeconds
      + blankCount * REGULATION_CRAWL_BLANK_BEAT_SECONDS
      + REGULATION_CRAWL_ENTRY_EXIT_SECONDS
  );
}

export function regulationCrawlScreenTargets(viewportHeight: number): {
  firstLineCenter: number;
  lastLineCenter: number;
} {
  return {
    firstLineCenter: viewportHeight * REGULATION_CRAWL_FIRST_LINE_Y,
    lastLineCenter: viewportHeight * REGULATION_CRAWL_LAST_LINE_Y
  };
}

/** Find an offset in a monotonic rendered-position function. */
export function solveRegulationCrawlOffset(
  target: number,
  lowerOffset: number,
  upperOffset: number,
  sampleCenter: (offset: number) => number
): number {
  let lower = lowerOffset;
  let upper = upperOffset;
  let lowerCenter = sampleCenter(lower);
  let upperCenter = sampleCenter(upper);
  const ascending = lowerCenter <= upperCenter;

  if (!ascending) {
    [lower, upper] = [upper, lower];
    [lowerCenter, upperCenter] = [upperCenter, lowerCenter];
  }

  if (target <= lowerCenter) return lower;
  if (target >= upperCenter) return upper;

  for (let i = 0; i < 28; i += 1) {
    const midpoint = (lower + upper) / 2;
    if (sampleCenter(midpoint) < target) lower = midpoint;
    else upper = midpoint;
  }

  return (lower + upper) / 2;
}
