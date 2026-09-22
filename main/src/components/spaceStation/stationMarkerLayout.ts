interface Rect { left: number; right: number; top: number; bottom: number }

/** The aiming reticle still reserves space when a HUD pushes a bearing inward. */
export function stationMarkerSurfaceReserved(surface: {
  hidden?: boolean;
  dataset: { hudLayer?: string; hudSurface?: string };
}): boolean {
  return !surface.hidden && (surface.dataset.hudSurface === 'station-crosshair'
    || !['modal', 'fullbleed', 'marker'].includes(surface.dataset.hudLayer ?? ''));
}

/** Keep the same bearing on the available play field, clear of registered HUDs. */
export function stationMarkerPosition(x: number, y: number, field: Rect, reserved: readonly Rect[]) {
  // DOMRect exposes these through prototype getters; spreading it can produce
  // an empty object and write NaNpx, leaving the bearing at the HUD's origin.
  let bounds = { left: field.left, right: field.right, top: field.top, bottom: field.bottom };
  const point = () => ({
    x: bounds.left + (x + 1) / 2 * (bounds.right - bounds.left),
    y: bounds.top + (1 - y) / 2 * (bounds.bottom - bounds.top)
  });
  // The ring is 18px; preserve another 8px between its edge and readable content.
  const clearance = 9 + 8;
  for (let pass = 0; pass < reserved.length; pass++) {
    const current = point();
    const blocker = reserved.find(rect => current.x > rect.left - clearance
      && current.x < rect.right + clearance && current.y > rect.top - clearance
      && current.y < rect.bottom + clearance);
    if (!blocker) break;
    const candidates = [
      { ...bounds, top: Math.max(bounds.top, blocker.bottom + clearance) },
      { ...bounds, bottom: Math.min(bounds.bottom, blocker.top - clearance) },
      { ...bounds, left: Math.max(bounds.left, blocker.right + clearance) },
      { ...bounds, right: Math.min(bounds.right, blocker.left - clearance) }
    ].filter(rect => rect.right > rect.left && rect.bottom > rect.top);
    if (!candidates.length) break;
    // Retain the largest playable rectangle instead of shifting a top bearing
    // to a side merely because a portrait work order spans the whole width.
    candidates.sort((a, b) => (b.right - b.left) * (b.bottom - b.top)
      - (a.right - a.left) * (a.bottom - a.top));
    bounds = candidates[0];
  }
  return point();
}
