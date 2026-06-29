import { useEffect, useRef } from 'react';
import { getVitals } from '../../game/systems/survivalVitals';
import { getMawChargeFraction } from '../../game/systems/mawSystem.ts';
import { ownsChargeTool } from '../../game/systems/loadoutSystem.ts';
import { getJetpackFuel } from '../EfficientPlayer.tsx';
import { isTouchDevice } from '../../utils/mobileInput.ts';
import { theme } from '../../ui/theme.ts';
import { hudGlassPanelStyle } from './hudChrome.ts';
import {
  formatJetpackFuelFraction,
  formatMawChargeFraction,
  formatVitalsValue,
  formatVitalsWidth,
  getVitalsPanelPlacement,
  VITAL_BARS
} from './VitalsMeter.model.ts';

const VitalsMeter: React.FC = () => {
  const fills = useRef<Array<HTMLDivElement | null>>([]);
  const values = useRef<Array<HTMLSpanElement | null>>([]);
  const jetpackFill = useRef<HTMLDivElement | null>(null);
  const jetpackValue = useRef<HTMLSpanElement | null>(null);
  const mawRow = useRef<HTMLDivElement | null>(null);
  const mawFill = useRef<HTMLDivElement | null>(null);
  const mawValue = useRef<HTMLSpanElement | null>(null);
  const initial = getVitals();
  const touch = isTouchDevice();
  const placement = getVitalsPanelPlacement(touch);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const v = getVitals();
      for (let i = 0; i < VITAL_BARS.length; i++) {
        const value = v[VITAL_BARS[i].key];
        const el = fills.current[i];
        if (el) el.style.width = formatVitalsWidth(value);
        const valueEl = values.current[i];
        if (valueEl) valueEl.textContent = formatVitalsValue(value);
      }
      const jetpackPct = getJetpackFuel() * 100;
      if (jetpackFill.current) {
        jetpackFill.current.style.width = formatVitalsWidth(jetpackPct);
        jetpackFill.current.style.background = jetpackPct > 25
          ? 'linear-gradient(90deg, #7dd3fc, rgba(255,255,255,0.82))'
          : 'linear-gradient(90deg, #fca5a5, rgba(255,255,255,0.72))';
      }
      if (jetpackValue.current) jetpackValue.current.textContent = formatJetpackFuelFraction(getJetpackFuel());
      const mawActive = ownsChargeTool();
      const mawPct = getMawChargeFraction() * 100;
      if (mawRow.current) mawRow.current.style.display = mawActive ? 'grid' : 'none';
      if (mawFill.current) {
        mawFill.current.style.width = formatVitalsWidth(mawPct);
        mawFill.current.style.background = mawPct > 25
          ? 'linear-gradient(90deg, #ffb454, rgba(255,255,255,0.82))'
          : 'linear-gradient(90deg, #fca5a5, rgba(255,255,255,0.72))';
      }
      if (mawValue.current) mawValue.current.textContent = formatMawChargeFraction(getMawChargeFraction());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <section
      aria-label="Survival vitals"
      data-testid="vitals-meter"
      style={hudGlassPanelStyle({
        position: 'absolute',
        left: placement.left,
        top: placement.top,
        width: placement.width,
        zIndex: theme.z.hud + 4,
        padding: touch ? '10px 10px 9px' : '11px 12px 10px',
        borderRadius: theme.radius.md,
        background: 'linear-gradient(180deg, rgba(10,18,32,0.78), rgba(5,9,17,0.60))',
        boxShadow: '0 14px 40px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.05)'
      })}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
        color: theme.color.accent,
        fontSize: 10,
        fontWeight: 900,
        letterSpacing: 0
      }}>
        <span>SUIT HUD</span>
        <span style={{ color: theme.color.textFaint, fontSize: 9, fontWeight: 700 }}>LIVE</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {VITAL_BARS.map((b, i) => (
          <div key={b.key} style={{ display: 'grid', gridTemplateColumns: '52px 1fr 34px', gap: 7, alignItems: 'center' }}>
            <span style={{ color: theme.color.textDim, fontSize: 9, fontWeight: 800 }}>{b.label}</span>
            <div style={{
              height: 8,
              borderRadius: 999,
              background: 'rgba(3,7,14,0.72)',
              border: '1px solid rgba(125,211,252,0.12)',
              overflow: 'hidden',
              boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.58)'
            }}>
              <div
                ref={el => { fills.current[i] = el; }}
                style={{
                  width: formatVitalsWidth(initial[b.key]),
                  height: '100%',
                  borderRadius: 999,
                  background: `linear-gradient(90deg, ${b.tone}, rgba(255,255,255,0.82))`,
                  boxShadow: `0 0 14px ${b.glow}`,
                  transition: 'width 0.12s linear',
                  willChange: 'width'
                }}
              />
            </div>
            <span
              ref={el => { values.current[i] = el; }}
              style={{ color: theme.color.text, fontSize: 9, fontWeight: 900, textAlign: 'right' }}
            >
              {formatVitalsValue(initial[b.key])}
            </span>
          </div>
        ))}
        <div
          data-testid="jetpack-hud-row"
          style={{ display: 'grid', gridTemplateColumns: '52px 1fr 34px', gap: 7, alignItems: 'center' }}
        >
          <span style={{ color: theme.color.textDim, fontSize: 9, fontWeight: 800 }}>JET</span>
          <div style={{
            height: 8,
            borderRadius: 999,
            background: 'rgba(3,7,14,0.72)',
            border: '1px solid rgba(125,211,252,0.16)',
            overflow: 'hidden',
            boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.58)'
          }}>
            <div
              ref={jetpackFill}
              style={{
                width: formatVitalsWidth(getJetpackFuel() * 100),
                height: '100%',
                borderRadius: 999,
                background: 'linear-gradient(90deg, #7dd3fc, rgba(255,255,255,0.82))',
                boxShadow: '0 0 14px rgba(125,211,252,0.30)',
                transition: 'width 0.12s linear',
                willChange: 'width'
              }}
            />
          </div>
          <span
            ref={jetpackValue}
            style={{ color: theme.color.text, fontSize: 9, fontWeight: 900, textAlign: 'right' }}
          >
            {formatJetpackFuelFraction(getJetpackFuel())}
          </span>
        </div>
        <div
          ref={mawRow}
          data-testid="maw-hud-row"
          style={{ display: ownsChargeTool() ? 'grid' : 'none', gridTemplateColumns: '52px 1fr 34px', gap: 7, alignItems: 'center' }}
        >
          <span style={{ color: theme.color.textDim, fontSize: 9, fontWeight: 800 }}>MAW</span>
          <div style={{
            height: 8,
            borderRadius: 999,
            background: 'rgba(3,7,14,0.72)',
            border: '1px solid rgba(255,180,84,0.16)',
            overflow: 'hidden',
            boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.58)'
          }}>
            <div
              ref={mawFill}
              style={{
                width: formatVitalsWidth(getMawChargeFraction() * 100),
                height: '100%',
                borderRadius: 999,
                background: 'linear-gradient(90deg, #ffb454, rgba(255,255,255,0.82))',
                boxShadow: '0 0 14px rgba(255,180,84,0.28)',
                transition: 'width 0.12s linear',
                willChange: 'width'
              }}
            />
          </div>
          <span
            ref={mawValue}
            style={{ color: theme.color.text, fontSize: 9, fontWeight: 900, textAlign: 'right' }}
          >
            {formatMawChargeFraction(getMawChargeFraction())}
          </span>
        </div>
      </div>
      <div style={{
        height: 1,
        marginTop: 9,
        background: 'linear-gradient(90deg, rgba(125,211,252,0.34), rgba(125,211,252,0))'
      }} />
    </section>
  );
};

export default VitalsMeter;
