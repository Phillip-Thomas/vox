import { afterEach, describe, expect, it } from 'vitest';
import {
  deriveStoryHudTopLeftOcclusion,
  getMeasuredStoryObjectiveCardHeight,
  setMeasuredStoryObjectiveCardHeight,
  solveStoryEdgeLabelPresentation,
  solveStoryHudLayout,
  solveStoryMarkerMotion,
  solveStoryMarkerPresentation,
  STORY_HUD_TOUCH_CONTROL_CLEARANCE_PX
} from './storyHudLayout.ts';

afterEach(() => setMeasuredStoryObjectiveCardHeight(0));

describe('free-era narrow-screen HUD layout', () => {
  it('does not reserve the old full objective card above 390x844 touch controls', () => {
    const layout = solveStoryHudLayout({
      viewportWidth: 390,
      viewportHeight: 844,
      touch: true,
      objectivePresent: true,
      objectiveHeight: 156
    });

    expect(layout.objective.bottom).toBe(STORY_HUD_TOUCH_CONTROL_CLEARANCE_PX);
    expect(layout.objective.heightReserved).toBe(0);
    expect(layout.caption.bottomEdge).toBeLessThan(844 - STORY_HUD_TOUCH_CONTROL_CLEARANCE_PX);
    expect(layout.marker.maxY).toBeLessThan(layout.caption.top);
    expect(layout.objective.width).toBe(354);
  });

  it('keeps the first touch frame compact before the journal trigger is measured', () => {
    const layout = solveStoryHudLayout({
      viewportWidth: 390,
      viewportHeight: 844,
      touch: true,
      objectivePresent: true,
      objectiveHeight: 0
    });

    expect(layout.objective.heightReserved).toBe(0);
    expect(layout.caption.bottomEdge).toBeLessThan(844 - STORY_HUD_TOUCH_CONTROL_CLEARANCE_PX);
  });

  it('keeps the conservative first-frame reservation for the desktop card', () => {
    const layout = solveStoryHudLayout({
      viewportWidth: 1280,
      viewportHeight: 800,
      touch: false,
      objectivePresent: true,
      objectiveHeight: 0
    });

    expect(layout.objective.heightReserved).toBe(150);
  });

  it('keeps captions above controls even when no objective is active', () => {
    const layout = solveStoryHudLayout({
      viewportWidth: 390,
      viewportHeight: 844,
      touch: true,
      objectivePresent: false
    });

    const touchControlsTop = 844 - STORY_HUD_TOUCH_CONTROL_CLEARANCE_PX;
    expect(layout.caption.bottomEdge).toBeLessThan(touchControlsTop);
  });

  it('keeps captions above touch controls on tablets without reserving a full card', () => {
    const layout = solveStoryHudLayout({
      viewportWidth: 1024,
      viewportHeight: 768,
      touch: true,
      objectivePresent: true,
      objectiveHeight: 130
    });

    expect(layout.narrowTouch).toBe(false);
    expect(layout.objective.heightReserved).toBe(0);
    expect(layout.marker.maxY).toBeLessThan(layout.caption.top);
    expect(layout.caption.bottomEdge).toBeLessThan(layout.objective.top);
  });

  it('wraps within a bounded label width and offsets edge labels without changing raw coordinates', () => {
    const layout = solveStoryHudLayout({
      viewportWidth: 390,
      viewportHeight: 844,
      touch: true,
      objectivePresent: true,
      objectiveHeight: 156
    });
    const raw = { x: 70, y: 760 };
    const presentation = solveStoryMarkerPresentation({
      rawX: raw.x,
      rawY: raw.y,
      labelWidth: 240,
      overlayHeight: 48,
      layout
    });

    expect(layout.marker.labelMaxWidth).toBe(240);
    expect(presentation.x).toBe(raw.x);
    expect(presentation.labelOffsetX).toBeGreaterThan(0);
    expect(presentation.y).toBeLessThan(layout.caption.top);
    expect(raw).toEqual({ x: 70, y: 760 });
  });

  it('reserves browser safe areas for the objective card and floating marker', () => {
    const layout = solveStoryHudLayout({
      viewportWidth: 390,
      viewportHeight: 844,
      touch: true,
      objectivePresent: true,
      objectiveHeight: 156,
      safeAreaInsets: { top: 47, right: 12, bottom: 34, left: 8 }
    });
    const presentation = solveStoryMarkerPresentation({
      rawX: 0,
      rawY: 0,
      labelWidth: 180,
      overlayHeight: 48,
      layout
    });

    expect(layout.objective.left).toBe(26);
    expect(layout.objective.bottom).toBe(STORY_HUD_TOUCH_CONTROL_CLEARANCE_PX + 34);
    expect(layout.objective.width).toBe(334);
    expect(layout.marker.minY).toBe(119);
    expect(presentation.x).toBe(18);
    expect(presentation.y).toBeGreaterThanOrEqual(119 + 24);
  });

  it('moves the complete caption-and-objective stack above a bottom safe area', () => {
    const withoutInset = solveStoryHudLayout({
      viewportWidth: 390,
      viewportHeight: 844,
      touch: true,
      objectivePresent: true,
      objectiveHeight: 156
    });
    const withInset = solveStoryHudLayout({
      viewportWidth: 390,
      viewportHeight: 844,
      touch: true,
      objectivePresent: true,
      objectiveHeight: 156,
      safeAreaInsets: { bottom: 34 }
    });

    expect(withInset.objective.bottom - withoutInset.objective.bottom).toBe(34);
    expect(withInset.caption.bottom - withoutInset.caption.bottom).toBe(34);
    expect(withoutInset.caption.bottomEdge - withInset.caption.bottomEdge).toBe(34);
    expect(withInset.objective.top - withInset.caption.bottomEdge).toBe(18);
  });

  it('turns the reduced-motion marker into a stable directional compass', () => {
    const layout = solveStoryHudLayout({
      viewportWidth: 390,
      viewportHeight: 844,
      touch: true,
      objectivePresent: true,
      objectiveHeight: 156,
      safeAreaInsets: { top: 47, right: 0, bottom: 34, left: 0 },
      topLeftOcclusion: { right: 228, bottom: 192 }
    });
    const motion = solveStoryMarkerMotion({
      rawX: 340,
      rawY: 600,
      offscreen: false,
      angle: 0,
      reducedMotion: true,
      layout
    });
    const presentation = solveStoryMarkerPresentation({
      rawX: 340,
      rawY: 600,
      labelWidth: 180,
      overlayHeight: 48,
      layout,
      stabilized: motion.stabilized
    });

    expect(motion).toMatchObject({ glyph: 'chevron', stabilized: true });
    expect(motion.chevronAngle).toBeGreaterThan(0);
    expect(layout.marker.stableLaneLeft).toBe(242);
    expect(layout.marker.stableLaneRight).toBe(372);
    expect(layout.marker.stableLabelMaxWidth).toBe(130);
    expect(layout.marker.stableTop).toBe(206);
    expect(presentation.x).toBe(307);
    expect(presentation.y).toBe(230);
    expect(presentation.y - 24).toBeGreaterThan(58);
    expect(presentation.x - layout.marker.stableLabelMaxWidth / 2).toBeGreaterThan(228);
  });

  it('derives top-left chrome only from rendered vitals and inventory rectangles', () => {
    const occlusion = deriveStoryHudTopLeftOcclusion([
      { left: 12, top: 14, right: 228, bottom: 192, width: 216, height: 178 },
      { left: 14, top: 202, right: 98, bottom: 240, width: 84, height: 38 },
      { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }
    ], 390, 844);

    expect(occlusion).toEqual({ right: 228, bottom: 240 });
    expect(deriveStoryHudTopLeftOcclusion([], 390, 844)).toBeUndefined();
  });

  it('keeps the no-chrome stable marker top-center and left of the M quick action', () => {
    const layout = solveStoryHudLayout({
      viewportWidth: 390,
      viewportHeight: 844,
      touch: true,
      objectivePresent: true,
      objectiveHeight: 156
    });
    const presentation = solveStoryMarkerPresentation({
      rawX: 340,
      rawY: 600,
      labelWidth: 240,
      overlayHeight: 48,
      layout,
      stabilized: true
    });

    expect(layout.marker.stableTop).toBe(layout.marker.minY);
    expect(presentation.x).toBe(195);
    expect(presentation.x + layout.marker.stableLabelMaxWidth / 2).toBe(315);
    expect(presentation.x + layout.marker.stableLabelMaxWidth / 2).toBeLessThan(332);
  });

  it('offsets an off-view redaction label without moving its projected direction anchor', () => {
    const layout = solveStoryHudLayout({
      viewportWidth: 390,
      viewportHeight: 844,
      touch: true,
      objectivePresent: true,
      objectiveHeight: 156,
      safeAreaInsets: { top: 0, right: 6, bottom: 0, left: 8 }
    });
    const anchor = { x: 14 };
    const presentation = solveStoryEdgeLabelPresentation({
      anchorX: anchor.x,
      labelWidth: 184,
      layout
    });
    const renderedLeft = anchor.x - 184 / 2 + presentation.labelOffsetX;

    expect(presentation.labelOffsetX).toBeGreaterThan(0);
    expect(renderedLeft).toBe(layout.marker.viewportInsetLeft);
    expect(presentation.labelMaxWidth).toBeLessThanOrEqual(240);
    expect(anchor).toEqual({ x: 14 });
  });

  it('moves the stable compass below top-left chrome when no readable side rail remains', () => {
    const layout = solveStoryHudLayout({
      viewportWidth: 320,
      viewportHeight: 568,
      touch: true,
      objectivePresent: false,
      topLeftOcclusion: { right: 228, bottom: 192 }
    });
    const presentation = solveStoryMarkerPresentation({
      rawX: 300,
      rawY: 300,
      labelWidth: 200,
      overlayHeight: 48,
      layout,
      stabilized: true
    });

    expect(layout.marker.stableLaneLeft).toBe(layout.marker.viewportInsetLeft);
    expect(presentation.y - 24).toBe(206);
    expect(presentation.y - 24).toBeGreaterThan(192);
  });

  it('keeps normal-motion markers projected into the scene', () => {
    const layout = solveStoryHudLayout({
      viewportWidth: 1280,
      viewportHeight: 720,
      touch: false,
      objectivePresent: true,
      objectiveHeight: 120
    });
    const motion = solveStoryMarkerMotion({
      rawX: 900,
      rawY: 260,
      offscreen: false,
      angle: 0,
      reducedMotion: false,
      layout
    });
    const presentation = solveStoryMarkerPresentation({
      rawX: 900,
      rawY: 260,
      labelWidth: 180,
      overlayHeight: 48,
      layout,
      stabilized: motion.stabilized
    });

    expect(motion).toEqual({ glyph: 'diamond', chevronAngle: 0, stabilized: false });
    expect(presentation.x).toBe(900);
    expect(presentation.y).toBe(260);
    expect(presentation.displacedForObjective).toBe(false);
    expect(presentation.displacedForTopChrome).toBe(false);
  });

  it('moves a projected landscape marker beside observed top-left HUD chrome', () => {
    const layout = solveStoryHudLayout({
      viewportWidth: 844,
      viewportHeight: 390,
      touch: true,
      objectivePresent: true,
      topLeftOcclusion: { right: 252, bottom: 114 }
    });
    const presentation = solveStoryMarkerPresentation({
      rawX: 100,
      rawY: 80,
      labelWidth: 200,
      overlayWidth: 200,
      overlayHeight: 32,
      layout
    });

    expect(presentation.x).toBe(366);
    expect(presentation.y).toBe(88);
    expect(presentation.displacedForTopChrome).toBe(true);
  });

  it('minimally displaces a desktop marker above the measured objective card', () => {
    const layout = solveStoryHudLayout({
      viewportWidth: 1440,
      viewportHeight: 900,
      touch: false,
      objectivePresent: true,
      objectiveHeight: 103.2
    });
    const raw = { x: 324.35, y: 830 };
    const presentation = solveStoryMarkerPresentation({
      rawX: raw.x,
      rawY: raw.y,
      labelWidth: 157.1,
      overlayWidth: 157.1,
      overlayHeight: 29.8,
      layout
    });
    const renderedBottom = presentation.y + 29.8 / 2;

    expect(presentation.displacedForObjective).toBe(true);
    expect(presentation.x).toBe(raw.x);
    expect(renderedBottom).toBeCloseTo(layout.objective.top - 14, 6);
    expect(raw).toEqual({ x: 324.35, y: 830 });
  });

  it('places desktop captions in the clear lane right of the objective card', () => {
    const layout = solveStoryHudLayout({
      viewportWidth: 1280,
      viewportHeight: 720,
      touch: false,
      objectivePresent: true,
      objectiveHeight: 123.2
    });
    const objectiveRight = layout.objective.left + layout.objective.width;
    const captionLeft = layout.caption.left - layout.caption.maxWidth / 2;

    expect(layout.caption.placement).toBe('right-of-objective');
    expect(captionLeft).toBeGreaterThanOrEqual(objectiveRight + 18);
  });

  it('stacks desktop captions above the objective when a side lane is too narrow', () => {
    const layout = solveStoryHudLayout({
      viewportWidth: 800,
      viewportHeight: 720,
      touch: false,
      objectivePresent: true,
      objectiveHeight: 120
    });

    expect(layout.caption.placement).toBe('above-objective');
    expect(layout.caption.bottomEdge).toBe(layout.objective.top - 18);
  });

  it('shares measured objective height without coupling it to React state', () => {
    setMeasuredStoryObjectiveCardHeight(163.5);
    expect(getMeasuredStoryObjectiveCardHeight()).toBe(163.5);
  });
});
