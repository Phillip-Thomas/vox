import React, { useEffect, useState } from 'react';
import { getCrashFlash } from '../ShipController.tsx';

/**
 * Ship crash feedback: a red impact vignette + "CRASHED" message that fades over
 * ~1s after a fast terrain impact. Polls ShipController's module-side flash value.
 */
const CrashFlash: React.FC = () => {
  const [intensity, setIntensity] = useState(0);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setIntensity(getCrashFlash());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (intensity <= 0) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <div style={{
        position: 'absolute',
        inset: 0,
        boxShadow: `inset 0 0 ${120 * intensity}px ${40 * intensity}px rgba(220,40,30,${0.55 * intensity})`
      }} />
      <div style={{
        position: 'absolute',
        top: '38%',
        left: '50%',
        transform: 'translateX(-50%)',
        color: '#ff5544',
        fontFamily: 'monospace',
        fontWeight: 'bold',
        letterSpacing: 2,
        fontSize: 26,
        textShadow: '0 0 8px rgba(0,0,0,0.8)',
        opacity: intensity
      }}>
        CRASHED — SPACE to re-launch
      </div>
    </div>
  );
};

export default CrashFlash;
