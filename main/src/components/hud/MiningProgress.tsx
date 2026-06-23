import React, { useEffect, useState } from 'react';
import { getMiningProgress } from '../../game/systems/miningProgress.ts';

/**
 * Crosshair mining ring. While the player holds to harvest, a ring around the
 * centre fills toward 100%; it turns red when the targeted voxel needs a stronger
 * tool than the one equipped. Polls the mining-progress mutable via its own rAF
 * (like TargetReticle's engage charge) so 60fps progress never re-renders the app.
 */
const SIZE = 30;       // px, ring diameter
const STROKE = 3;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

const MiningProgress: React.FC = () => {
  const [pct, setPct] = useState(0);
  const [active, setActive] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const p = getMiningProgress();
      setActive(p.active);
      setBlocked(p.blocked);
      setPct(p.pct);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (!active) return null;
  const color = blocked ? '#ff6b6b' : '#7dd3fc';
  // Blocked has no real progress — show a full faint ring as a "can't break" cue.
  const shown = blocked ? 1 : pct;

  return (
    <div style={{
      position: 'absolute', top: '50%', left: '50%',
      transform: 'translate(-50%, -50%)',
      width: SIZE, height: SIZE, pointerEvents: 'none', zIndex: 24
    }}>
      <svg width={SIZE} height={SIZE} style={{ display: 'block' }}>
        <circle
          cx={SIZE / 2} cy={SIZE / 2} r={R}
          fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2} cy={SIZE / 2} r={R}
          fill="none" stroke={color} strokeWidth={STROKE} strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={CIRC * (1 - shown)}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          opacity={blocked ? 0.6 : 1}
        />
      </svg>
    </div>
  );
};

export default MiningProgress;
