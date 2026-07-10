import React, { useEffect, useRef } from 'react';
import { theme } from '../../ui/theme.ts';
import { getFeedRuntime } from '../feedRuntime.ts';

/** A3's sleep: a full-black fade the director drives via feedRuntime.sleepFade. */
const SleepFade: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const el = ref.current;
      if (!el) return;
      const fade = getFeedRuntime().sleepFade;
      el.style.opacity = String(fade);
      el.style.display = fade > 0.001 ? 'block' : 'none';
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: theme.z.loading,
        background: '#000',
        opacity: 0,
        display: 'none',
        pointerEvents: 'none'
      }}
    />
  );
};

export default SleepFade;
