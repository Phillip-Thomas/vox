const COCKPIT_REFERENCE_ASPECT = 1.42;

/**
 * The shell should crop against a narrow viewport instead of collapsing into
 * the pilot's forward view. Instruments need slightly more fitting room, but
 * must retain enough of their authored width to remain readable.
 */
export const COCKPIT_SHELL_X_SCALE_FLOOR = 0.78;
export const COCKPIT_INSTRUMENT_X_SCALE_FLOOR = 0.7;

export interface ShipCockpitViewportLayout {
  aspect: number;
  shellScaleX: number;
  instrumentScaleX: number;
}

/** Pure viewport fitting used by the camera-child cockpit rig. */
export function getShipCockpitViewportLayout(
  width: number,
  height: number
): ShipCockpitViewportLayout {
  const safeWidth = Number.isFinite(width) ? Math.max(1, width) : 1;
  const safeHeight = Number.isFinite(height) ? Math.max(1, height) : 1;
  const aspect = safeWidth / safeHeight;
  const authoredScaleX = Math.min(1, aspect / COCKPIT_REFERENCE_ASPECT);

  return {
    aspect,
    shellScaleX: Math.max(COCKPIT_SHELL_X_SCALE_FLOOR, authoredScaleX),
    instrumentScaleX: Math.max(COCKPIT_INSTRUMENT_X_SCALE_FLOOR, authoredScaleX)
  };
}
