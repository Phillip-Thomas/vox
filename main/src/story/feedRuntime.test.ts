import { beforeEach, describe, expect, it } from 'vitest';
import {
  cameraChromeVisualState,
  cameraFeedVisualState,
  getFeedRuntime,
  resetFeedRuntime
} from './feedRuntime.ts';

describe('camera-feed visual ownership', () => {
  beforeEach(() => resetFeedRuntime());

  it('scales CCTV-only rendering by the external-camera handoff', () => {
    const runtime = getFeedRuntime();
    runtime.desat = 0.8;
    runtime.treatment = 0.6;
    runtime.glitch = 0.4;
    runtime.scanRoll = 0.2;
    runtime.externalCameraMix = 0.25;

    expect(cameraFeedVisualState()).toEqual({
      desat: 0.2,
      treatment: 0.15,
      glitch: 0.1,
      scanRoll: 0.05
    });
    expect(cameraChromeVisualState()).toEqual({ opacity: 0.25, visible: true });
  });

  it('removes every CCTV visual in embodied view without destroying HUD state', () => {
    const runtime = getFeedRuntime();
    runtime.externalCameraMix = 0;
    runtime.flash = 0.75;
    runtime.marker.visible = true;
    runtime.redactionIndicator.visible = true;

    expect(cameraFeedVisualState()).toEqual({
      desat: 0,
      treatment: 0,
      glitch: 0,
      scanRoll: 0
    });
    expect(cameraChromeVisualState()).toEqual({ opacity: 0, visible: false });
    // Flash punctuation and the objective/HUD channel are intentionally not
    // camera-feed post effects, so the handoff leaves them available.
    expect(runtime.flash).toBe(0.75);
    expect(runtime.marker.visible).toBe(true);
    expect(runtime.redactionIndicator.visible).toBe(true);
    expect(runtime.treatment).toBe(1);
  });

  it('restores external-camera ownership on a clean runtime reset', () => {
    getFeedRuntime().externalCameraMix = 0;
    getFeedRuntime().redactionIndicator.visible = true;
    resetFeedRuntime();
    expect(getFeedRuntime().externalCameraMix).toBe(1);
    expect(getFeedRuntime().redactionIndicator.visible).toBe(false);
    expect(cameraFeedVisualState().treatment).toBe(1);
  });

  it('clamps malformed ownership before it reaches DOM opacity/display state', () => {
    getFeedRuntime().externalCameraMix = 4;
    expect(cameraChromeVisualState()).toEqual({ opacity: 1, visible: true });
    getFeedRuntime().externalCameraMix = -2;
    expect(cameraChromeVisualState()).toEqual({ opacity: 0, visible: false });
  });
});
