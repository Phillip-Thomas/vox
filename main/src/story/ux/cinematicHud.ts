import { useEffect, useState } from 'react';
import { getFeedRuntime } from '../feedRuntime.ts';

// Letterboxed cinematics (feedRuntime.cinematic, 0..1, driven by the story
// director's staged sun events and the 2D→3D lift) draw bars over the whole
// frame. The informational sandbox HUD should get out from under them: fade out
// while the bars are in, fade back on decay. Kept as a shared threshold + hook
// so CinematicFrame's drawing and the HUD's hiding agree on "a cinematic is in".

/** Any cinematic envelope above this counts as "letterbox is in". */
export const CINEMATIC_HUD_HIDE_THRESHOLD = 0.05;

/** Pure predicate — the HUD hides once the cinematic envelope crosses in. */
export function cinematicHidesHud(
  cinematic: number,
  threshold: number = CINEMATIC_HUD_HIDE_THRESHOLD
): boolean {
  return Number.isFinite(cinematic) && cinematic > threshold;
}

/**
 * rAF-sampled, change-gated subscription to the cinematic envelope (mirrors
 * CinematicFrame's own sampler). Returns whether the informational HUD should be
 * hidden; only flips React state on a threshold crossing, so an idle cutscene
 * state costs nothing and a running one re-renders at most twice.
 */
export function useCinematicHudHidden(
  threshold: number = CINEMATIC_HUD_HIDE_THRESHOLD
): boolean {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let raf = 0;
    let last = hidden;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const next = cinematicHidesHud(getFeedRuntime().cinematic, threshold);
      if (next === last) return; // change-gated
      last = next;
      setHidden(next);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threshold]);

  return hidden;
}
