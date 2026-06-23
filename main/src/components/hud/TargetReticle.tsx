import React, { useEffect, useState } from 'react';
import { useSpaceFlight } from '../../state/spaceFlight.ts';
import { isTouchDevice } from '../../utils/mobileInput.ts';
import { getEngageState } from '../ShipController.tsx';

/**
 * Centred deep-space targeting reticle. Shown only when an impostor is locked in
 * the aim cone (store `target` set while phase==='deep_space'). The charge bar
 * reflects the held-forward engage timer, polled per-frame from ShipController's
 * module mutable via rAF so 60fps charging never re-renders the rest of the app.
 */
const TargetReticle: React.FC = () => {
  const { phase, target } = useSpaceFlight();
  const [charge, setCharge] = useState(0);
  const [waitingForFreshForward, setWaitingForFreshForward] = useState(false);
  const active = phase === 'deep_space' && target !== null;
  const touch = isTouchDevice();

  useEffect(() => {
    if (!active) {
      setCharge(0);
      setWaitingForFreshForward(false);
      return;
    }
    let raf = 0;
    const tick = () => {
      const engage = getEngageState();
      setCharge(engage.charge);
      setWaitingForFreshForward(engage.waitingForFreshForward);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  if (!active || !target) return null;
  const pct = Math.round(Math.min(charge, 1) * 100);
  const prompt = waitingForFreshForward
    ? (touch ? 'center stick, then hold forward' : 'release W, then hold to warp')
    : (touch ? 'hold joystick forward to warp' : 'hold W to warp');

  return (
    <div style={{
      position: 'absolute',
      top: 'calc(50% + 26px)',
      left: '50%',
      transform: 'translateX(-50%)',
      color: '#7dffb0',
      fontFamily: 'monospace',
      background: 'rgba(0,0,0,0.55)',
      padding: '6px 12px',
      borderRadius: 6,
      fontSize: 12,
      textAlign: 'center',
      lineHeight: 1.4,
      border: '1px solid rgba(125,255,176,0.45)',
      pointerEvents: 'none',
      minWidth: 180
    }}>
      <div style={{ fontWeight: 'bold', letterSpacing: 1 }}>
        {pct >= 100 ? 'ENGAGING' : '▶ LOCK'} {target.x},{target.y}
      </div>
      <div style={{ opacity: 0.8, marginTop: 2 }}>{prompt}</div>
      <div style={{
        marginTop: 5,
        height: 4,
        borderRadius: 2,
        background: 'rgba(125,255,176,0.2)',
        overflow: 'hidden'
      }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: '#7dffb0',
          transition: 'width 0.05s linear'
        }} />
      </div>
    </div>
  );
};

export default TargetReticle;
