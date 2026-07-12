// --- Sky meaning: the constellation reveal scalar ---------------------------
//
// Story-only. The embodied narrator, staring at the chaos-noise starfield,
// begins to see PATTERN: a deterministic subset of stars kindles and faint
// lines connect them into figures ("the noise resolves"). This module owns the
// single 0..1 scalar the sky shader reads through uConstellation.
//
// Default 0 → the sky is pure chaos noise and the whole constellation branch of
// the shader early-outs. The sandbox NEVER touches this (prime directive: story
// systems are no-ops in the sandbox); only the story director ramps it, during
// the vigil beat. A dev URL flag (`?sky=constellation`) can force it on for
// isolated viewing — opt-in, exactly like the other `?debug`-style flags.

let reveal = 0;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Set the constellation reveal directly (0 chaos .. 1 fully resolved). Clamped.
 * The director may call this per frame with an eased value, or use
 * `tickConstellationReveal` to let this module do the easing.
 */
export function setConstellationReveal(v: number): void {
  reveal = clamp01(v);
}

/** Current reveal (0..1). SpaceSky pushes this into uConstellation each frame. */
export function getConstellationReveal(): number {
  return reveal;
}

// Seconds to travel the full 0→1 (or 1→0) span at `tickConstellationReveal`'s
// max rate. A slow bloom — the pattern should dawn, not snap.
const SMOOTH_SECONDS = 6;

/**
 * Ease the reveal toward `target` (0..1) and return the new value. Frame-rate
 * independent (uses `dt` seconds). Call once per frame from the director in
 * place of `setConstellationReveal` when a smooth ramp is wanted: hold
 * `target = 1` while the vigil beat is live, `target = 0` to let it recede.
 */
export function tickConstellationReveal(dt: number, target: number): number {
  const t = clamp01(target);
  const step = Math.max(0, dt) / SMOOTH_SECONDS;
  if (t > reveal) reveal = Math.min(t, reveal + step);
  else if (t < reveal) reveal = Math.max(t, reveal - step);
  return reveal;
}

// Dev affordance: `?sky=constellation` forces the reveal on (=1) for isolated
// viewing without the director; `?sky=<0..1>` forces a specific level. Read
// once at module load, guarded for SSR. Opt-in only — absent the flag the
// scalar stays 0 and the sandbox is untouched.
if (typeof window !== 'undefined') {
  try {
    const raw = new URLSearchParams(window.location.search).get('sky');
    if (raw === 'constellation') {
      reveal = 1;
    } else if (raw != null) {
      const n = Number(raw);
      if (Number.isFinite(n)) reveal = clamp01(n);
    }
  } catch {
    /* no-op: dev flag only */
  }
}
