/** Presentation clocks belong to one station visit, not to a transient HUD panel. */
export interface StationPresentation {
  objectives: Map<string, number>;
  lowLines: Map<string, number>;
  lowLine: { element: { style: { opacity: string }; dataset?: Record<string, string | undefined> }; startedAt: number; delayMs: number; durationMs: number; reduced: boolean } | null;
}

export function createStationPresentation(concourseAlreadyEntered: boolean): StationPresentation {
  return {
    objectives: new Map(),
    lowLine: null,
    // A restored milestone has already delivered its line. Reloading is not entry.
    lowLines: new Map(concourseAlreadyEntered ? [['concourse-warmth', -Infinity]] : [])
  };
}

export function startPresentationOnce(clocks: Map<string, number>, id: string, now: number): number {
  const previous = clocks.get(id);
  if (previous !== undefined) return previous;
  clocks.set(id, now);
  return now;
}

/** Absolute visit time avoids restarting or double-counting on HUD rerenders. */
export function presentationOpacity(
  startedAt: number, now: number, delayMs: number, durationMs: number, reducedMotion: boolean
): number {
  const elapsed = Math.max(0, now - startedAt);
  if (elapsed < delayMs) return 0;
  if (elapsed >= delayMs + durationMs) return 1;
  // Reduced motion keeps the authored full-opacity instant; it omits the fade.
  if (reducedMotion) return 0;
  return (elapsed - delayMs) / durationMs;
}

/** Called in the station frame before rendering, using the same clock as fill. */
export function updateStationLowLine(presentation: StationPresentation, frameTimestampMs: number): void {
  const line = presentation.lowLine;
  if (!line) return;
  line.element.style.opacity = String(presentationOpacity(line.startedAt, frameTimestampMs,
    line.delayMs, line.durationMs, line.reduced));
  if (line.element.dataset) line.element.dataset.stationFrameTimestampMs = String(frameTimestampMs);
}
