import React, { useEffect, useRef } from 'react';
import { theme } from '../../ui/theme.ts';
import { getFeedRuntime } from '../feedRuntime.ts';

// --- The cinematic frame -------------------------------------------------------
//
// Letterbox bars + a warm horizon wash for the staged sun events (first dusk,
// A3 dawn). Driven by feedRuntime.cinematic (0..1) from the director's
// envelopes; rAF style-writes only. The wash is deliberately gentle — the REAL
// spectacle is the sky itself, which the director is aiming the camera at.

const BAR_MAX_VH = 11;

const CinematicFrame: React.FC = () => {
  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const washRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const c = getFeedRuntime().cinematic;
      const top = topRef.current;
      const bottom = bottomRef.current;
      const wash = washRef.current;
      if (!top || !bottom || !wash) return;
      const h = `${(c * BAR_MAX_VH).toFixed(2)}vh`;
      top.style.height = h;
      bottom.style.height = h;
      wash.style.opacity = String(c * 0.5);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const bar: React.CSSProperties = {
    position: 'fixed',
    left: 0,
    right: 0,
    height: 0,
    background: '#000',
    pointerEvents: 'none',
    zIndex: theme.z.hud + 6
  };

  return (
    <>
      <div ref={topRef} style={{ ...bar, top: 0 }} />
      <div ref={bottomRef} style={{ ...bar, bottom: 0 }} />
      <div
        ref={washRef}
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: theme.z.hud + 5,
          opacity: 0,
          background:
            'radial-gradient(120% 85% at 50% 62%, rgba(255,158,64,0.16) 0%, rgba(255,120,40,0.07) 45%, rgba(10,8,20,0.18) 100%)',
          mixBlendMode: 'soft-light'
        }}
      />
    </>
  );
};

export default CinematicFrame;
