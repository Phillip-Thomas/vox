// --- Regulation Feed per-frame runtime ---------------------------------------------
//
// Mutable singleton (the WarpOverlay pattern): the in-Canvas StoryDirectorDriver
// writes these scalars each R3F frame; the DOM overlays read them in their own
// rAF and mutate styles/text directly. Nothing here touches React — zero
// re-renders per frame by construction.

export interface FeedMarker {
  visible: boolean;
  /** Screen-space anchor (px). When offscreen, clamped to the viewport edge. */
  x: number;
  y: number;
  /** True when the target is outside the frame — render as an edge chevron. */
  offscreen: boolean;
  /** Chevron heading when offscreen (radians, screen-space; 0 = pointing right). */
  angle: number;
  label: string;
}

export interface FeedRedaction {
  visible: boolean;
  /** Screen-space rect in px (already clamped to the viewport). */
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  /** 0..1 — box edge jitter / label instability near the tree. */
  stress: number;
}

export interface FeedRuntime {
  /** Opacity of the saturation-kill layer (0 during chroma flashes / post-A1). */
  desat: number;
  /** Master opacity of the dither/scanline/vignette treatment (A2 dissolves it). */
  treatment: number;
  /** Instantaneous glitch-tear intensity for the imperative canvas (0 = idle). */
  glitch: number;
  /** Feed frame counter (the HUD timestamp). */
  frame: number;
  /** 0..1 — HUD text corruption (frame counter garbles near the tree / in A2). */
  garble: number;
  /** Scanline roll impulse (0 = steady drift; pulses on glitches). */
  scanRoll: number;
  /** A3 sleep fade: 0 = clear, 1 = full black (SleepFade overlay opacity). */
  sleepFade: number;
  /** Cinematic frame (0..1): letterbox bars + warm wash for the sun events. */
  cinematic: number;
  /** Hard white flash (0..1) — pod impact, A-moment punctuation. Decays fast. */
  flash: number;
  /** Descent cutscene progress: -1 idle, 0..1 falling, >1 wreck landed. */
  descent: number;
  /** ch1-fixed: the fixed-screen cell index the worker stands in — the HUD's
   *  SITE CAM tag derives its id from this (the camera-switch fiction). */
  camCell: number;
  redaction: FeedRedaction;
  /** Survey marker — the feed's target designator (the ch1 anomaly objective). */
  marker: FeedMarker;
}

const runtime: FeedRuntime = {
  desat: 1,
  treatment: 1,
  glitch: 0,
  frame: 0,
  garble: 0,
  scanRoll: 0,
  sleepFade: 0,
  cinematic: 0,
  flash: 0,
  descent: -1,
  camCell: 0,
  redaction: { visible: false, x: 0, y: 0, w: 0, h: 0, label: '', stress: 0 },
  marker: { visible: false, x: 0, y: 0, offscreen: false, angle: 0, label: '' }
};

export function getFeedRuntime(): FeedRuntime {
  return runtime;
}

export function resetFeedRuntime(): void {
  runtime.desat = 1;
  runtime.treatment = 1;
  runtime.glitch = 0;
  runtime.frame = 0;
  runtime.garble = 0;
  runtime.scanRoll = 0;
  runtime.sleepFade = 0;
  runtime.cinematic = 0;
  runtime.flash = 0;
  runtime.descent = -1;
  runtime.camCell = 0;
  runtime.redaction.visible = false;
  runtime.redaction.stress = 0;
  runtime.redaction.label = '';
  runtime.marker.visible = false;
}
