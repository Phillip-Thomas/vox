import { useEffect, useRef } from 'react';
import { getVitals } from '../../game/systems/survivalVitals.ts';
import { getPlayerSubmergence, isPlayerSubmerged } from '../../state/playerSubmersion.ts';

// Breath gauge. Appears while underwater OR while oxygen < 100 (recovering).
// Fades out silently once fully refilled and out of water.
// Below 25% oxygen the bar pulses and shifts to alarm-red to cue the player.
//
// DOM-mutation rAF pattern (same as VitalsMeter): static structure rendered
// once, inner fill width and container opacity mutated each frame — zero
// React re-render overhead per tick.

const LOW_OXYGEN = 25; // threshold below which alarm state kicks in

// --- The oxygen tick at every level (parity member) ----------------------------------
//
// The shipped meter only pulses BELOW 25%, which means the breath cue a hearing
// player has had the whole dive — the body clock under the water — exists for a
// deaf player only once it has become an emergency. The parity member gives the
// meter a tick at EVERY level, riding the score's own per-pulse callback
// (oxygenAudio.ts) so the visual and the audible breath are one clock and cannot
// drift. The AUDIO CADENCE IS UNTOUCHED: this reads the pulse, it does not make one.
//
// Reduced motion: a brightness pulse is motion, so under RM the tick becomes a
// POSITIONAL fill-edge marker that advances one step per pulse — the same
// information, carried by place instead of by change.
//
// NOTHING CALLS `pulseOxygenTick()` YET. Stage 4/6 integration binds it to the
// oxygen body clock; until then the meter behaves exactly as it shipped.

/** How far the RM edge marker steps per pulse, in px, before wrapping. */
export const OXYGEN_TICK_RM_STEP_PX = 3;
export const OXYGEN_TICK_RM_STEPS = 4;
/** One frame of brightened edge, non-RM. */
export const OXYGEN_TICK_FLASH_MS = 90;

type OxygenTickListener = (pulse: number) => void;
const oxygenTickListeners = new Set<OxygenTickListener>();
let oxygenPulse = 0;

/** One breath. Called from the score's per-pulse callback once wired. */
export function pulseOxygenTick(): void {
  oxygenPulse += 1;
  for (const listener of oxygenTickListeners) listener(oxygenPulse);
}

export function subscribeOxygenTick(listener: OxygenTickListener): () => void {
  oxygenTickListeners.add(listener);
  return () => {
    oxygenTickListeners.delete(listener);
  };
}

export function readOxygenPulseCount(): number {
  return oxygenPulse;
}

export interface OxygenTickPresentation {
  /** Non-RM: the tick's opacity this instant. RM: always 1. */
  opacity: number;
  /** RM: horizontal offset of the edge marker, px. Non-RM: always 0. */
  offsetPx: number;
}

/**
 * Pure so the two forms can be tested without a browser: under reduced motion the
 * marker MOVES and never changes brightness; otherwise it BRIGHTENS and never moves.
 */
export function solveOxygenTickPresentation(
  pulse: number,
  reducedMotion: boolean
): OxygenTickPresentation {
  if (reducedMotion) {
    return { opacity: 1, offsetPx: (pulse % OXYGEN_TICK_RM_STEPS) * OXYGEN_TICK_RM_STEP_PX };
  }
  return { opacity: 1, offsetPx: 0 };
}

const OxygenMeter: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fillRef      = useRef<HTMLDivElement | null>(null);
  const tickRef      = useRef<HTMLDivElement | null>(null);

  // The tick rides the score's pulse, at every level. DOM-mutated like the rest of
  // this meter so a breath costs no React render.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const reducedMotion =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false;
    const unsubscribe = subscribeOxygenTick(pulse => {
      const el = tickRef.current;
      if (!el) return;
      const form = solveOxygenTickPresentation(pulse, reducedMotion);
      el.dataset.oxygenPulse = String(pulse);
      el.dataset.oxygenTickForm = reducedMotion ? 'positional' : 'brightness';
      if (reducedMotion) {
        el.style.opacity = String(form.opacity);
        el.style.transform = `translateX(${form.offsetPx}px)`;
        return;
      }
      el.style.transform = 'translateX(0px)';
      el.style.opacity = '1';
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        if (tickRef.current) tickRef.current.style.opacity = '0';
      }, OXYGEN_TICK_FLASH_MS);
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const o = getVitals().oxygen;
      const submerged = isPlayerSubmerged();
      const submergence = getPlayerSubmergence();

      const container = containerRef.current;
      const fill      = fillRef.current;
      if (container) {
        // Fade: fully visible while submerged, graceful fade-in/out on the 0..0.5
        // submergence range when surfacing. Also visible at reduced opacity while
        // oxygen is recovering (o < 100) so the player can see it refilling.
        const alpha = submerged
          ? 1
          : o < 100
            ? Math.max(0.4, Math.min(1, submergence * 2 + (1 - o / 100) * 0.8))
            : 0;
        container.style.opacity = String(alpha);
        container.style.pointerEvents = 'none';
      }
      if (fill) {
        const pct = Math.max(0, Math.min(100, o));
        fill.style.width = `${pct}%`;
        // Alarm: red below LOW_OXYGEN; normal: sky-blue matching the water theme
        fill.style.background = pct <= LOW_OXYGEN ? '#f87171' : '#7dd3fc';
        // CSS pulse class toggled via inline animation shorthand to avoid a
        // stylesheet dependency; only active in alarm state.
        fill.style.animation = pct <= LOW_OXYGEN
          ? 'oxPulse 0.7s ease-in-out infinite alternate'
          : 'none';
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <>
      {/* Keyframe injected once into a style tag so no external CSS file is needed */}
      <style>{`@keyframes oxPulse { from { opacity: 1; } to { opacity: 0.35; } }`}</style>
      <div
        ref={containerRef}
        style={{
          position: 'absolute',
          bottom: 88,                   // above JetpackMeter (64) with a gap
          left: '50%',
          transform: 'translateX(-50%)',
          width: 140,
          pointerEvents: 'none',
          textAlign: 'center',
          fontFamily: 'monospace',
          fontSize: 10,
          color: '#9fd0ff',
          transition: 'opacity 0.4s ease'
        }}
      >
        <div style={{ marginBottom: 3, letterSpacing: 1, opacity: 0.85 }}>BREATH</div>
        <div
          style={{
            position: 'relative',
            height: 5,
            borderRadius: 3,
            background: 'rgba(125,211,252,0.2)',
            overflow: 'hidden'
          }}
        >
          {/* The breath tick: a bright edge at the right of the track, dark until a
              pulse arrives. At every level, not only under the alarm threshold. */}
          <div
            ref={tickRef}
            data-oxygen-tick="breath"
            data-oxygen-pulse="0"
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: 2,
              height: '100%',
              background: '#e8f6ff',
              opacity: 0,
              pointerEvents: 'none'
            }}
          />
          <div
            ref={fillRef}
            style={{
              height: '100%',
              width: '100%',
              background: '#7dd3fc',
              borderRadius: 3,
              transition: 'width 0.12s linear'
            }}
          />
        </div>
      </div>
    </>
  );
};

export default OxygenMeter;
