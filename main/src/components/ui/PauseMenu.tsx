import React, { useState } from 'react';
import { theme, glassPanel } from '../../ui/theme.ts';
import {
  getQualityProfile,
  setQualityProfile,
  QUALITY_PROFILES,
  type QualityProfile
} from '../../config/graphicsSettings.ts';

export interface NavApi {
  currentLabel: string;
  seed: number;
  arrivalLabel: string;
  targetX: string;
  targetY: string;
  setTargetX: (v: string) => void;
  setTargetY: (v: string) => void;
  onSetCourse: () => void;
  onRandom: () => void;
  onPrevious: () => void;
  hasPrevious: boolean;
  nearby: { label: string; onClick: () => void }[];
}

interface PauseMenuProps {
  open: boolean;
  onResume: () => void;
  onQuitToMenu: () => void;
  nav: NavApi;
}

const PROFILE_ORDER: QualityProfile[] = ['ULTRA', 'HIGH', 'MEDIUM', 'LOW', 'POTATO'];

/**
 * In-game pause + star map. Opened when pointer lock is lost while playing (Esc),
 * or via the HUD pause button on touch. This is the production home for travel
 * (Set Course / Random / Previous / Nearby) and settings — the old debug
 * "World Coordinates" panel re-styled into the elevated-sci-fi system.
 */
const PauseMenu: React.FC<PauseMenuProps> = ({ open, onResume, onQuitToMenu, nav }) => {
  const [profile, setProfile] = useState<QualityProfile>(() => getQualityProfile());
  if (!open) return null;

  const chooseProfile = (p: QualityProfile) => {
    setProfile(p);
    setQualityProfile(p);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: theme.z.menu,
      fontFamily: theme.font.ui, color: theme.color.text,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
      background: 'radial-gradient(120% 100% at 50% 50%, rgba(5,8,15,0.55) 0%, rgba(5,8,15,0.82) 100%)',
      backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)',
      animation: 'pvFloatIn 200ms ease both'
    }}>
      <div style={{
        ...glassPanel, background: theme.glass.backgroundStrong,
        width: 'min(560px, 94vw)', maxHeight: '88vh', overflowY: 'auto',
        padding: 'clamp(20px, 4vw, 34px)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '0.12em' }}>PARAVOXIA</div>
          <div style={{ fontSize: 11, letterSpacing: '0.24em', color: theme.color.textFaint, textTransform: 'uppercase' }}>Paused</div>
        </div>

        {/* Current location */}
        <div style={{
          display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 14, marginBottom: 18,
          fontFamily: theme.font.mono, fontSize: 12, color: theme.color.textDim
        }}>
          <span>SECTOR <b style={{ color: theme.color.accent }}>{nav.currentLabel}</b></span>
          <span>SEED <b style={{ color: theme.color.text }}>{nav.seed}</b></span>
          <span>{nav.arrivalLabel}</span>
        </div>

        {/* Star map / travel */}
        <Section title="Star Map">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <Field label="X" value={nav.targetX} onChange={nav.setTargetX} onEnter={nav.onSetCourse} />
            <Field label="Y" value={nav.targetY} onChange={nav.setTargetY} onEnter={nav.onSetCourse} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 8 }}>
            <PrimaryButton onClick={nav.onSetCourse}>Set Course</PrimaryButton>
            <SecondaryButton onClick={nav.onRandom}>Random</SecondaryButton>
            <SecondaryButton onClick={nav.onPrevious} disabled={!nav.hasPrevious}>Previous</SecondaryButton>
          </div>

          <div style={{ marginTop: 14, fontSize: 11, letterSpacing: '0.18em', color: theme.color.textFaint, textTransform: 'uppercase' }}>
            Nearby
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 8 }}>
            {nav.nearby.map(n => (
              <button key={n.label} onClick={n.onClick} style={{
                fontFamily: theme.font.mono, fontSize: 11, padding: '7px 4px',
                color: theme.color.textDim, background: theme.color.accentGhost,
                border: '1px solid rgba(125,211,252,0.2)', borderRadius: theme.radius.sm, cursor: 'pointer',
                transition: `all ${theme.transition.base}`
              }}>{n.label}</button>
            ))}
          </div>
        </Section>

        {/* Graphics */}
        <Section title="Graphics">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {PROFILE_ORDER.map(p => (
              <button key={p} onClick={() => chooseProfile(p)} style={{
                fontFamily: theme.font.mono, fontSize: 11, letterSpacing: '0.05em',
                padding: '7px 12px', borderRadius: theme.radius.pill, cursor: 'pointer',
                color: profile === p ? theme.color.void : theme.color.textDim,
                background: profile === p ? theme.color.accent : 'transparent',
                border: `1px solid ${profile === p ? theme.color.accent : 'rgba(125,211,252,0.28)'}`,
                transition: `all ${theme.transition.base}`
              }}>{p}</button>
            ))}
          </div>
          <div style={{ marginTop: 10, fontSize: 11, color: theme.color.textFaint, lineHeight: 1.5 }}>
            {QUALITY_PROFILES[profile].postProcess
              ? 'Cinematic: bloom, reflections, grass & trees at full reach.'
              : 'Performance: lighter shading for smoother framerates.'}
          </div>
        </Section>

        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <PrimaryButton onClick={onResume} grow>▶  Resume</PrimaryButton>
          <SecondaryButton onClick={onQuitToMenu}>Quit to Menu</SecondaryButton>
        </div>
      </div>
    </div>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid rgba(125,211,252,0.12)' }}>
    <div style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: theme.color.accent, marginBottom: 12 }}>
      {title}
    </div>
    {children}
  </div>
);

const Field: React.FC<{ label: string; value: string; onChange: (v: string) => void; onEnter: () => void }> = ({ label, value, onChange, onEnter }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11, color: theme.color.textDim, letterSpacing: '0.1em' }}>
    {label}
    <input
      type="number"
      value={value}
      onChange={e => onChange(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') onEnter(); }}
      style={{
        fontFamily: theme.font.mono, fontSize: 14, color: theme.color.text,
        background: 'rgba(5,8,15,0.6)', border: '1px solid rgba(125,211,252,0.25)',
        borderRadius: theme.radius.sm, padding: '9px 11px', outline: 'none', width: '100%', boxSizing: 'border-box'
      }}
    />
  </label>
);

const PrimaryButton: React.FC<{ onClick: () => void; children: React.ReactNode; grow?: boolean }> = ({ onClick, children, grow }) => (
  <button onClick={onClick} style={{
    flex: grow ? 1 : undefined,
    fontFamily: theme.font.ui, fontSize: 14, fontWeight: 700, letterSpacing: '0.04em',
    color: theme.color.void, background: `linear-gradient(180deg, ${theme.color.accent}, ${theme.color.accentStrong})`,
    border: 'none', borderRadius: theme.radius.md, padding: '11px 16px', cursor: 'pointer',
    boxShadow: '0 6px 20px rgba(56,189,248,0.35)', transition: `all ${theme.transition.base}`
  }}>{children}</button>
);

const SecondaryButton: React.FC<{ onClick: () => void; children: React.ReactNode; disabled?: boolean }> = ({ onClick, children, disabled }) => (
  <button onClick={onClick} disabled={disabled} style={{
    fontFamily: theme.font.ui, fontSize: 13, fontWeight: 600,
    color: disabled ? theme.color.textFaint : theme.color.text,
    background: 'rgba(125,211,252,0.08)',
    border: '1px solid rgba(125,211,252,0.25)', borderRadius: theme.radius.md,
    padding: '11px 16px', cursor: disabled ? 'default' : 'pointer',
    transition: `all ${theme.transition.base}`
  }}>{children}</button>
);

export default PauseMenu;
