import { useEffect, useRef } from 'react';
import { getVitals, type VitalsState } from '../../game/systems/survivalVitals';

// Five survival meters, bottom-left. The static structure renders ONCE; the rAF loop
// mutates each fill's width via a ref (no per-frame React re-render — lighter than the
// setState-per-frame meters, same poll cadence).
const BARS: Array<{ key: keyof VitalsState; label: string; color: string }> = [
  { key: 'health',  label: 'HP',  color: '#ff6b6b' },
  { key: 'hunger',  label: 'FED', color: '#f59e0b' },
  { key: 'thirst',  label: 'HYD', color: '#3b82f6' },
  { key: 'warmth',  label: 'WRM', color: '#fbbf24' },
  { key: 'stamina', label: 'STA', color: '#34d399' }
];

const pct = (n: number) => `${Math.max(0, Math.min(100, n))}%`;

const VitalsMeter: React.FC = () => {
  const fills = useRef<Array<HTMLDivElement | null>>([]);
  const initial = getVitals();

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const v = getVitals();
      for (let i = 0; i < BARS.length; i++) {
        const el = fills.current[i];
        if (el) el.style.width = pct(v[BARS[i].key]);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div style={{
      position: 'absolute', left: 14, bottom: 14, display: 'flex', flexDirection: 'column',
      gap: 4, fontFamily: 'monospace', fontSize: 10, pointerEvents: 'none', userSelect: 'none'
    }}>
      {BARS.map((b, i) => (
        <div key={b.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 26, color: '#cbd5e1', textShadow: '0 1px 2px #000' }}>{b.label}</span>
          <div style={{ width: 120, height: 5, background: 'rgba(0,0,0,0.45)', borderRadius: 3, overflow: 'hidden' }}>
            <div
              ref={el => { fills.current[i] = el; }}
              style={{ width: pct(initial[b.key]), height: '100%', background: b.color, borderRadius: 3, transition: 'width 0.12s linear' }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export default VitalsMeter;
