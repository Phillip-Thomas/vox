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

const OxygenMeter: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fillRef      = useRef<HTMLDivElement | null>(null);

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
        <div style={{ height: 5, borderRadius: 3, background: 'rgba(125,211,252,0.2)', overflow: 'hidden' }}>
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
