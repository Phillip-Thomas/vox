import React, { useEffect, useState } from 'react';
import { getJetpackFuel } from '../EfficientPlayer.tsx';

/**
 * On-foot jetpack fuel bar. Polls EfficientPlayer's module-side fuel value per
 * frame via rAF (no re-render churn) and only shows while fuel is below full
 * (i.e. recently/currently used), so it stays out of the way otherwise.
 */
const JetpackMeter: React.FC = () => {
  const [fuel, setFuel] = useState(1);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setFuel(getJetpackFuel());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (fuel >= 0.999) return null;
  const pct = Math.round(Math.max(0, Math.min(1, fuel)) * 100);
  return (
    <div style={{
      position: 'absolute',
      bottom: 64,
      left: '50%',
      transform: 'translateX(-50%)',
      width: 140,
      pointerEvents: 'none',
      textAlign: 'center',
      fontFamily: 'monospace',
      fontSize: 10,
      color: '#9fd0ff'
    }}>
      <div style={{ marginBottom: 3, letterSpacing: 1, opacity: 0.85 }}>JETPACK</div>
      <div style={{ height: 5, borderRadius: 3, background: 'rgba(125,211,252,0.2)', overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: pct > 25 ? '#7dd3fc' : '#fca5a5',
          transition: 'width 0.08s linear'
        }} />
      </div>
    </div>
  );
};

export default JetpackMeter;
