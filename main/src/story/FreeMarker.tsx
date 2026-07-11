import React, { useEffect, useRef } from 'react';
import { theme } from '../ui/theme.ts';
import { getFeedRuntime } from './feedRuntime.ts';

// --- The free-era survey marker -------------------------------------------------------
//
// The suit's objective designator AFTER the feed dies: a small diamond (in
// frame) or edge chevron (out of frame) with a lowercase tag. Same feedRuntime
// marker struct + driver math as the feed-era bracket — only the chrome changed:
// the awakened world gets a whisper, not a work order. rAF-driven, zero React.

const INK = 'rgba(235, 245, 240, 0.72)';

const FreeMarker: React.FC = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const diamondRef = useRef<HTMLDivElement>(null);
  const chevronRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const root = rootRef.current;
      const diamond = diamondRef.current;
      const chevron = chevronRef.current;
      const label = labelRef.current;
      if (!root || !diamond || !chevron || !label) return;
      const m = getFeedRuntime().marker;
      if (!m.visible) {
        root.style.display = 'none';
        return;
      }
      root.style.display = 'flex';
      root.style.transform = `translate(${m.x}px, ${m.y}px) translate(-50%, -50%)`;
      diamond.style.display = m.offscreen ? 'none' : 'block';
      chevron.style.display = m.offscreen ? 'block' : 'none';
      chevron.style.transform = `rotate(${m.angle}rad)`;
      label.textContent = m.label.toLowerCase();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      ref={rootRef}
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        display: 'none',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 5,
        zIndex: theme.z.hud + 2,
        pointerEvents: 'none'
      }}
    >
      <div
        ref={diamondRef}
        style={{
          width: 9,
          height: 9,
          border: `1px solid ${INK}`,
          transform: 'rotate(45deg)',
          boxShadow: '0 0 8px rgba(0,0,0,0.5)'
        }}
      />
      <div
        ref={chevronRef}
        style={{
          width: 0,
          height: 0,
          borderTop: '5px solid transparent',
          borderBottom: '5px solid transparent',
          borderLeft: `9px solid ${INK}`
        }}
      />
      <div
        ref={labelRef}
        style={{
          fontFamily: theme.font.mono,
          fontSize: 11,
          letterSpacing: '0.08em',
          color: INK,
          textShadow: '0 1px 8px rgba(0,0,0,0.7)',
          whiteSpace: 'nowrap'
        }}
      />
    </div>
  );
};

export default FreeMarker;
