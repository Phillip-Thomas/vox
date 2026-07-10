import React, { useEffect, useRef } from 'react';
import { theme } from '../../ui/theme.ts';
import { getFeedRuntime } from '../feedRuntime.ts';

// --- The cinematic frame -------------------------------------------------------
//
// Letterbox bars + a warm horizon wash for the staged sun events (first dusk,
// A3 dawn, the 2D→3D lift). Driven by feedRuntime.cinematic (0..1).
//
// PERF-CRITICAL SHAPE: the bars are fixed-height and slide via TRANSFORM
// (compositor-only) — animating `height` forces a full document layout every
// frame, which is exactly the hitch a wide-shot moment can't afford. The wash
// is plain alpha compositing (no mix-blend-mode: blend modes force offscreen
// re-composition of everything beneath). Style writes are change-gated.

const BAR_VH = 11;

const CinematicFrame: React.FC = () => {
  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const washRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    let last = -1;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const c = Math.round(getFeedRuntime().cinematic * 100) / 100;
      if (c === last) return; // change-gated: idle cutscene state costs nothing
      last = c;
      const top = topRef.current;
      const bottom = bottomRef.current;
      const wash = washRef.current;
      if (!top || !bottom || !wash) return;
      top.style.transform = `translateY(${((c - 1) * 100).toFixed(2)}%)`;
      bottom.style.transform = `translateY(${((1 - c) * 100).toFixed(2)}%)`;
      wash.style.opacity = String(c * 0.4);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const bar: React.CSSProperties = {
    position: 'fixed',
    left: 0,
    right: 0,
    height: `${BAR_VH}vh`,
    background: '#000',
    pointerEvents: 'none',
    zIndex: theme.z.hud + 6,
    willChange: 'transform'
  };

  return (
    <>
      <div ref={topRef} style={{ ...bar, top: 0, transform: 'translateY(-100%)' }} />
      <div ref={bottomRef} style={{ ...bar, bottom: 0, transform: 'translateY(100%)' }} />
      <div
        ref={washRef}
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: theme.z.hud + 5,
          opacity: 0,
          background:
            'radial-gradient(120% 85% at 50% 62%, rgba(255,158,64,0.10) 0%, rgba(255,120,40,0.05) 45%, rgba(10,8,20,0.12) 100%)'
        }}
      />
    </>
  );
};

export default CinematicFrame;
