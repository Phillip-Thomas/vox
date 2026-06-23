import React, { useEffect, useState } from 'react';
import { getMawChargeFraction } from '../../game/systems/mawSystem.ts';
import { ownsChargeTool } from '../../game/systems/loadoutSystem.ts';

/**
 * Faulty-Maw charge bar. Polls the maw charge per frame via rAF (no re-render
 * churn). Only shown while the equipped tool actually runs on charge (the Faulty
 * Maw) — once the Maw is repaired it's self-powered and this disappears. Sits just
 * above the jetpack meter so the two don't overlap.
 */
const MawChargeMeter: React.FC = () => {
  const [frac, setFrac] = useState(0);
  const [usesCharge, setUsesCharge] = useState(false);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setUsesCharge(ownsChargeTool());
      setFrac(getMawChargeFraction());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (!usesCharge) return null;
  const pct = Math.round(Math.max(0, Math.min(1, frac)) * 100);
  const empty = pct <= 0;

  return (
    <div style={{
      position: 'absolute',
      bottom: 92,
      left: '50%',
      transform: 'translateX(-50%)',
      width: 140,
      pointerEvents: 'none',
      textAlign: 'center',
      fontFamily: 'monospace',
      fontSize: 10,
      color: empty ? '#fca5a5' : '#ffd9a0'
    }}>
      <div style={{ marginBottom: 3, letterSpacing: 1, opacity: 0.85 }}>
        {empty ? 'MAW · NO CHARGE' : 'MAW CHARGE'}
      </div>
      <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,200,140,0.18)', overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: pct > 25 ? '#ffb454' : '#fca5a5',
          transition: 'width 0.08s linear'
        }} />
      </div>
    </div>
  );
};

export default MawChargeMeter;
