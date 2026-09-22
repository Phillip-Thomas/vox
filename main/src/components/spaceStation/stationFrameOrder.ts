/** Negative priorities order updates without taking over the renderer/PostFX. */
export const STATION_FRAME_PRIORITY = { walk: -3, interior: -2, fill: -1, presentation: -0.5 } as const;

/** The document timeline equals this frame's rAF timestamp, shared by callbacks. */
export function stationFrameTime(): number {
  const timestamp = typeof document === 'undefined' ? null : document.timeline?.currentTime;
  return typeof timestamp === 'number' ? timestamp : performance.now();
}
