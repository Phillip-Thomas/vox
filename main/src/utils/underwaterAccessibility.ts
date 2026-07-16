export interface VisualAccessibilityPreferences {
  reducedMotion: boolean;
  /** Explicit app/user flash preference. The current browser contract has no
   * standard reduced-flash media query, so reduced motion is also treated as a
   * request to remove transient underwater flashes. */
  reducedFlash: boolean;
}

export interface UnderwaterAccessibilityPolicy {
  cameraSwayScale: number;
  refractionWobbleScale: number;
  animateWaterlineWipe: boolean;
  animateLowOxygenVignette: boolean;
}

export const LOW_OXYGEN_THRESHOLD = 25;
export const WATERLINE_WIPE_SECONDS = 0.35;
export const REDUCED_FLASH_OXYGEN_VIGNETTE = 0.5;

const STANDARD_POLICY: Readonly<UnderwaterAccessibilityPolicy> = Object.freeze({
  cameraSwayScale: 1,
  refractionWobbleScale: 1,
  animateWaterlineWipe: true,
  animateLowOxygenVignette: true
});

const REDUCED_FLASH_POLICY: Readonly<UnderwaterAccessibilityPolicy> = Object.freeze({
  cameraSwayScale: 1,
  refractionWobbleScale: 1,
  animateWaterlineWipe: false,
  animateLowOxygenVignette: false
});

const REDUCED_MOTION_POLICY: Readonly<UnderwaterAccessibilityPolicy> = Object.freeze({
  cameraSwayScale: 0,
  refractionWobbleScale: 0,
  animateWaterlineWipe: false,
  animateLowOxygenVignette: false
});

const STANDARD_PREFERENCES: Readonly<VisualAccessibilityPreferences> = Object.freeze({
  reducedMotion: false,
  reducedFlash: false
});

const REDUCED_MOTION_PREFERENCES: Readonly<VisualAccessibilityPreferences> = Object.freeze({
  reducedMotion: true,
  reducedFlash: false
});

let reducedMotionQuery: MediaQueryList | null = null;
let runtimePreferences: Readonly<VisualAccessibilityPreferences> = STANDARD_PREFERENCES;

/** Pure policy boundary shared by the embodied camera and post-processing pass. */
export function resolveUnderwaterAccessibilityPolicy(
  preferences: VisualAccessibilityPreferences
): Readonly<UnderwaterAccessibilityPolicy> {
  if (preferences.reducedMotion) return REDUCED_MOTION_POLICY;
  if (preferences.reducedFlash) return REDUCED_FLASH_POLICY;
  return STANDARD_POLICY;
}

/** Preserve the shipped crossing wipe exactly in standard mode; accessibility
 * variants rely on the continuously blended medium as a neutral dissolve. */
export function nextWaterlineWipe(
  current: number,
  crossedWaterline: boolean,
  deltaSeconds: number,
  policy: Readonly<UnderwaterAccessibilityPolicy>
): number {
  if (!policy.animateWaterlineWipe) return 0;
  const start = crossedWaterline
    ? 1
    : Number.isFinite(current) ? Math.max(0, Math.min(1, current)) : 0;
  const delta = Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0;
  return Math.max(0, start - delta / WATERLINE_WIPE_SECONDS);
}

/** Low oxygen remains visible as a stable geometric edge treatment when
 * pulsing is reduced; the ordinary variant retains its existing waveform. */
export function resolveLowOxygenVignette(
  oxygen: number,
  elapsedSeconds: number,
  policy: Readonly<UnderwaterAccessibilityPolicy>
): number {
  if (!Number.isFinite(oxygen) || oxygen >= LOW_OXYGEN_THRESHOLD) return 0;
  if (!policy.animateLowOxygenVignette) return REDUCED_FLASH_OXYGEN_VIGNETTE;
  const elapsed = Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0;
  return 0.5 + 0.5 * Math.sin(elapsed * 7);
}

function installReducedMotionQuery(): void {
  if (reducedMotionQuery || typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
  reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const sync = () => {
    runtimePreferences = reducedMotionQuery?.matches
      ? REDUCED_MOTION_PREFERENCES
      : STANDARD_PREFERENCES;
  };
  sync();
  if (typeof reducedMotionQuery.addEventListener === 'function') {
    reducedMotionQuery.addEventListener('change', sync);
  } else {
    reducedMotionQuery.addListener(sync);
  }
}

/** Allocation-free hot-path preference snapshot. */
export function getVisualAccessibilityPreferences(): Readonly<VisualAccessibilityPreferences> {
  installReducedMotionQuery();
  return runtimePreferences;
}
