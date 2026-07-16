// Shared screen-space policy for the free-era story HUD. The R3F marker keeps
// publishing its untouched projection into feedRuntime; these helpers only
// solve how the DOM overlays fit around mobile controls and one another.

export const STORY_HUD_NARROW_WIDTH_PX = 820;
export const STORY_HUD_TOUCH_CONTROL_CLEARANCE_PX = 174;
export const STORY_HUD_OBJECTIVE_FALLBACK_HEIGHT_PX = 150;

const STORY_HUD_TOUCH_SIDE_PX = 18;
const STORY_HUD_DESKTOP_SIDE_PX = 22;
const STORY_HUD_DESKTOP_BOTTOM_PX = 28;
const STORY_HUD_CAPTION_GAP_PX = 18;
const STORY_HUD_CAPTION_ESTIMATED_HEIGHT_PX = 72;
const STORY_HUD_MARKER_GAP_PX = 14;
const STORY_HUD_MARKER_ICON_INSET_PX = 10;
const STORY_HUD_REDUCED_MOTION_ALIGNMENT_PX = 36;
const STORY_HUD_TOP_OCCLUSION_GAP_PX = 14;
const STORY_HUD_MIN_STABLE_RAIL_WIDTH_PX = 96;

export interface StoryHudSafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface StoryHudTopLeftOcclusion {
  /** Right edge of the occupied top-left HUD rectangle, in viewport pixels. */
  right: number;
  /** Bottom edge of the occupied top-left HUD rectangle, in viewport pixels. */
  bottom: number;
}

export interface StoryHudObservedRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

/** Merge only rendered, on-viewport rectangles into the occupied top-left HUD extent. */
export function deriveStoryHudTopLeftOcclusion(
  rects: readonly StoryHudObservedRect[],
  viewportWidth: number,
  viewportHeight: number
): StoryHudTopLeftOcclusion | undefined {
  const width = Math.max(1, finiteOr(viewportWidth, 1));
  const height = Math.max(1, finiteOr(viewportHeight, 1));
  let right = 0;
  let bottom = 0;
  let observed = false;
  for (const rect of rects) {
    if (!Number.isFinite(rect.width) || !Number.isFinite(rect.height)) continue;
    if (rect.width <= 0 || rect.height <= 0) continue;
    if (rect.right <= 0 || rect.bottom <= 0 || rect.left >= width || rect.top >= height) continue;
    right = Math.max(right, clamp(finiteOr(rect.right, 0), 0, width));
    bottom = Math.max(bottom, clamp(finiteOr(rect.bottom, 0), 0, height));
    observed = true;
  }
  return observed ? { right, bottom } : undefined;
}

export interface StoryHudLayoutInput {
  viewportWidth: number;
  viewportHeight: number;
  touch: boolean;
  objectivePresent: boolean;
  /** Measured border-box height. Zero means the first layout pass. */
  objectiveHeight?: number;
  /** Browser-resolved CSS environment insets, in pixels. */
  safeAreaInsets?: Partial<StoryHudSafeAreaInsets>;
  /** Optional top-left HUD chrome the stable reduced-motion marker must avoid. */
  topLeftOcclusion?: Partial<StoryHudTopLeftOcclusion>;
}

export interface StoryHudLayout {
  viewportWidth: number;
  viewportHeight: number;
  narrowTouch: boolean;
  safeAreaInsets: StoryHudSafeAreaInsets;
  objective: {
    left: number;
    bottom: number;
    width: number;
    heightReserved: number;
    top: number;
  };
  caption: {
    bottom: number;
    maxWidth: number;
    top: number;
    bottomEdge: number;
  };
  marker: {
    minY: number;
    maxY: number;
    labelMaxWidth: number;
    viewportInsetLeft: number;
    viewportInsetRight: number;
    stableLaneLeft: number;
    stableLaneRight: number;
    stableTop: number;
    stableLabelMaxWidth: number;
  };
}

function finiteOr(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function safeInset(value: number | undefined): number {
  return Math.max(0, finiteOr(value, 0));
}

function normalizeSafeAreaInsets(
  insets: Partial<StoryHudSafeAreaInsets> | undefined
): StoryHudSafeAreaInsets {
  return {
    top: safeInset(insets?.top),
    right: safeInset(insets?.right),
    bottom: safeInset(insets?.bottom),
    left: safeInset(insets?.left)
  };
}

/**
 * Reserve a bottom-up stack on touch screens:
 * controls -> objective card -> caption -> marker field. The measured card
 * height replaces the conservative first-frame fallback without a React render.
 */
export function solveStoryHudLayout(input: StoryHudLayoutInput): StoryHudLayout {
  const viewportWidth = Math.max(1, finiteOr(input.viewportWidth, 1));
  const viewportHeight = Math.max(1, finiteOr(input.viewportHeight, 1));
  const narrowTouch = input.touch && viewportWidth <= STORY_HUD_NARROW_WIDTH_PX;
  const safeAreaInsets = normalizeSafeAreaInsets(input.safeAreaInsets);
  const side = input.touch ? STORY_HUD_TOUCH_SIDE_PX : STORY_HUD_DESKTOP_SIDE_PX;
  const objectiveBottomBase = input.touch
    ? STORY_HUD_TOUCH_CONTROL_CLEARANCE_PX
    : STORY_HUD_DESKTOP_BOTTOM_PX;
  const objectiveBottom = objectiveBottomBase + safeAreaInsets.bottom;
  const measuredHeight = Math.max(0, finiteOr(input.objectiveHeight, 0));
  const objectiveHeight = input.objectivePresent
    ? Math.max(measuredHeight, measuredHeight > 0 ? 0 : STORY_HUD_OBJECTIVE_FALLBACK_HEIGHT_PX)
    : 0;
  const objectiveLeft = side + safeAreaInsets.left;
  const objectiveRight = side + safeAreaInsets.right;
  const objectiveWidth = Math.max(1, Math.min(360, viewportWidth - objectiveLeft - objectiveRight));
  const objectiveTop = viewportHeight - objectiveBottom - objectiveHeight;

  const captionBottom = input.touch
    ? objectiveBottom + objectiveHeight + STORY_HUD_CAPTION_GAP_PX
    : Math.max(32 + safeAreaInsets.bottom, viewportHeight * 0.12);
  const captionBottomEdge = viewportHeight - captionBottom;
  const captionMaxWidth = Math.max(1, Math.min(640, narrowTouch
    ? viewportWidth - objectiveLeft - objectiveRight
    : Math.min(viewportWidth * 0.8, viewportWidth - objectiveLeft - objectiveRight)));
  const captionTop = captionBottomEdge - (input.touch
    ? STORY_HUD_CAPTION_ESTIMATED_HEIGHT_PX
    : 52);

  const markerEdgeY = input.touch ? 34 : 44;
  const markerMinY = markerEdgeY + safeAreaInsets.top;
  const markerBottomLimit = viewportHeight - markerEdgeY - safeAreaInsets.bottom;
  const markerMaxY = input.touch
    ? clamp(captionTop - STORY_HUD_MARKER_GAP_PX, markerMinY + 24, markerBottomLimit)
    : markerBottomLimit;
  const markerViewportLeft = objectiveLeft;
  const markerViewportRight = Math.max(markerViewportLeft, viewportWidth - objectiveRight);
  let stableLaneLeft = markerViewportLeft;
  const stableLaneRight = markerViewportRight;
  let stableTop = markerMinY;
  const occlusionRight = clamp(
    finiteOr(input.topLeftOcclusion?.right, markerViewportLeft),
    markerViewportLeft,
    markerViewportRight
  );
  const occlusionBottom = clamp(
    finiteOr(input.topLeftOcclusion?.bottom, markerMinY),
    markerMinY,
    markerMaxY
  );

  if (narrowTouch && input.topLeftOcclusion && occlusionBottom > markerMinY) {
    // Any observed top-left chrome moves the stable compass below that chrome.
    // This also clears the independent top-right quick-action row, whose lower
    // edge sits well above the vitals/inventory lower edge on touch layouts.
    stableTop = Math.min(
      markerMaxY,
      occlusionBottom + STORY_HUD_TOP_OCCLUSION_GAP_PX
    );
    const rightRailLeft = Math.max(
      markerViewportLeft,
      occlusionRight + STORY_HUD_TOP_OCCLUSION_GAP_PX
    );
    if (stableLaneRight - rightRailLeft >= STORY_HUD_MIN_STABLE_RAIL_WIDTH_PX) {
      stableLaneLeft = rightRailLeft;
    }
  }
  const labelMaxWidth = Math.max(1, Math.min(
    narrowTouch ? 240 : 320,
    markerViewportRight - markerViewportLeft
  ));

  return {
    viewportWidth,
    viewportHeight,
    narrowTouch,
    safeAreaInsets,
    objective: {
      left: objectiveLeft,
      bottom: objectiveBottom,
      width: objectiveWidth,
      heightReserved: objectiveHeight,
      top: objectiveTop
    },
    caption: {
      bottom: captionBottom,
      maxWidth: captionMaxWidth,
      top: captionTop,
      bottomEdge: captionBottomEdge
    },
    marker: {
      minY: markerMinY,
      maxY: markerMaxY,
      labelMaxWidth,
      viewportInsetLeft: markerViewportLeft,
      viewportInsetRight: objectiveRight,
      stableLaneLeft,
      stableLaneRight,
      stableTop,
      stableLabelMaxWidth: Math.max(1, Math.min(
        labelMaxWidth,
        stableLaneRight - stableLaneLeft
      ))
    }
  };
}

export interface StoryMarkerMotionInput {
  rawX: number;
  rawY: number;
  offscreen: boolean;
  angle: number;
  reducedMotion: boolean;
  layout: StoryHudLayout;
}

export interface StoryMarkerMotion {
  glyph: 'diamond' | 'chevron';
  chevronAngle: number;
  stabilized: boolean;
}

/**
 * Reduced-motion players get a stable compass lane instead of a marker that
 * traverses the entire viewport. The small glyph may still rotate because its
 * direction is essential guidance; when the target is aligned, it rests as a
 * diamond.
 */
export function solveStoryMarkerMotion(input: StoryMarkerMotionInput): StoryMarkerMotion {
  if (!input.reducedMotion) {
    return {
      glyph: input.offscreen ? 'chevron' : 'diamond',
      chevronAngle: finiteOr(input.angle, 0),
      stabilized: false
    };
  }

  const safeCenterX = (
    input.layout.safeAreaInsets.left
    + input.layout.viewportWidth
    - input.layout.safeAreaInsets.right
  ) / 2;
  const centerY = input.layout.viewportHeight / 2;
  const dx = finiteOr(input.rawX, safeCenterX) - safeCenterX;
  const dy = finiteOr(input.rawY, centerY) - centerY;
  const aligned = !input.offscreen
    && Math.hypot(dx, dy) <= STORY_HUD_REDUCED_MOTION_ALIGNMENT_PX;

  return {
    glyph: aligned ? 'diamond' : 'chevron',
    chevronAngle: input.offscreen
      ? finiteOr(input.angle, 0)
      : Math.atan2(dy, dx),
    stabilized: true
  };
}

export interface StoryMarkerPresentationInput {
  rawX: number;
  rawY: number;
  labelWidth: number;
  overlayHeight: number;
  layout: StoryHudLayout;
  /** Pin to the collision-free safe-area lane for the reduced-motion compass. */
  stabilized?: boolean;
}

export interface StoryMarkerPresentation {
  x: number;
  y: number;
  labelOffsetX: number;
}

/**
 * Clamp only the rendered marker. feedRuntime's raw x/y/label contract remains
 * unchanged for telemetry, marker health, and downstream consumers.
 */
export function solveStoryMarkerPresentation(
  input: StoryMarkerPresentationInput
): StoryMarkerPresentation {
  const { layout } = input;
  const minX = layout.safeAreaInsets.left + STORY_HUD_MARKER_ICON_INSET_PX;
  const maxX = Math.max(
    minX,
    layout.viewportWidth - layout.safeAreaInsets.right - STORY_HUD_MARKER_ICON_INSET_PX
  );
  const safeCenterX = (minX + maxX) / 2;
  const x = input.stabilized
    ? (layout.marker.stableLaneLeft + layout.marker.stableLaneRight) / 2
    : clamp(finiteOr(input.rawX, safeCenterX), minX, maxX);
  const halfHeight = Math.max(0, finiteOr(input.overlayHeight, 0)) / 2;
  const minY = layout.marker.minY + halfHeight;
  const maxY = Math.max(minY, layout.marker.maxY - halfHeight);
  const y = input.stabilized
    ? clamp(layout.marker.stableTop + halfHeight, minY, maxY)
    : clamp(finiteOr(input.rawY, minY), minY, maxY);

  const labelMaxWidth = input.stabilized
    ? layout.marker.stableLabelMaxWidth
    : layout.marker.labelMaxWidth;
  const labelWidth = Math.min(
    Math.max(0, finiteOr(input.labelWidth, 0)),
    labelMaxWidth
  );
  const halfLabel = labelWidth / 2;
  const left = x - halfLabel;
  const right = x + halfLabel;
  let labelOffsetX = 0;
  const labelBoundaryLeft = input.stabilized
    ? layout.marker.stableLaneLeft
    : layout.marker.viewportInsetLeft;
  const labelBoundaryRight = input.stabilized
    ? layout.marker.stableLaneRight
    : layout.viewportWidth - layout.marker.viewportInsetRight;
  if (left < labelBoundaryLeft) {
    labelOffsetX = labelBoundaryLeft - left;
  } else if (right > labelBoundaryRight) {
    labelOffsetX = labelBoundaryRight - right;
  }

  return { x, y, labelOffsetX };
}

export interface StoryEdgeLabelPresentationInput {
  /** Keep this authoritative anchor unchanged; only the label is offset. */
  anchorX: number;
  labelWidth: number;
  layout: StoryHudLayout;
}

export interface StoryEdgeLabelPresentation {
  labelOffsetX: number;
  labelMaxWidth: number;
}

/**
 * Fit an edge-indicator label inside the safe story-HUD content lane without
 * moving its projected chevron anchor or changing the authored direction.
 */
export function solveStoryEdgeLabelPresentation(
  input: StoryEdgeLabelPresentationInput
): StoryEdgeLabelPresentation {
  const { layout } = input;
  const leftBoundary = layout.marker.viewportInsetLeft;
  const rightBoundary = layout.viewportWidth - layout.marker.viewportInsetRight;
  const anchorX = finiteOr(input.anchorX, (leftBoundary + rightBoundary) / 2);
  const labelMaxWidth = Math.max(
    1,
    Math.min(layout.marker.labelMaxWidth, rightBoundary - leftBoundary)
  );
  const labelWidth = Math.min(
    Math.max(0, finiteOr(input.labelWidth, 0)),
    labelMaxWidth
  );
  const halfLabel = labelWidth / 2;
  const labelLeft = anchorX - halfLabel;
  const labelRight = anchorX + halfLabel;
  let labelOffsetX = 0;
  if (labelLeft < leftBoundary) {
    labelOffsetX = leftBoundary - labelLeft;
  } else if (labelRight > rightBoundary) {
    labelOffsetX = rightBoundary - labelRight;
  }
  return { labelOffsetX, labelMaxWidth };
}

/**
 * Resolve CSS env() safe-area values once per viewport shape. Kept separate
 * from the pure solver so layout policy remains deterministic and testable.
 */
export function readStoryHudSafeAreaInsets(): StoryHudSafeAreaInsets {
  if (typeof document === 'undefined') return normalizeSafeAreaInsets(undefined);
  const host = document.body ?? document.documentElement;
  if (!host) return normalizeSafeAreaInsets(undefined);

  const probe = document.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  Object.assign(probe.style, {
    position: 'fixed',
    visibility: 'hidden',
    pointerEvents: 'none',
    paddingTop: 'env(safe-area-inset-top, 0px)',
    paddingRight: 'env(safe-area-inset-right, 0px)',
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    paddingLeft: 'env(safe-area-inset-left, 0px)'
  });
  host.appendChild(probe);
  const computed = window.getComputedStyle(probe);
  const insets = normalizeSafeAreaInsets({
    top: Number.parseFloat(computed.paddingTop),
    right: Number.parseFloat(computed.paddingRight),
    bottom: Number.parseFloat(computed.paddingBottom),
    left: Number.parseFloat(computed.paddingLeft)
  });
  probe.remove();
  return insets;
}

let measuredObjectiveCardHeight = 0;

export function setMeasuredStoryObjectiveCardHeight(height: number): void {
  measuredObjectiveCardHeight = Math.max(0, finiteOr(height, 0));
}

export function getMeasuredStoryObjectiveCardHeight(): number {
  return measuredObjectiveCardHeight;
}
