import React, { useEffect, useState } from 'react';
import { useAppState, enterPlaying, getGameCanvas } from '../../state/appState.ts';
import { isTouchDevice } from '../../utils/mobileInput.ts';
import {
  getQualityProfile,
  setQualityProfile,
  QUALITY_PROFILES,
  type QualityProfile
} from '../../config/graphicsSettings.ts';
import { theme, glassPanel } from '../../ui/theme.ts';

/**
 * The landing screen. Renders over the SAME live <Canvas> that becomes the game:
 * during `phase==='menu'` EfficientScene runs the cinematic orbit camera, so the
 * world is fully generated and warm behind this glass. Because of that, "Play
 * Now" just flips the app phase (the player camera takes over — no remount, no
 * second loading flash) and grabs pointer lock inside the click gesture.
 *
 * It also IS the loading screen: an opaque cover hides the cold first frames and
 * dissolves to a vignette once `sceneReady`, revealing the warmed planet. Play is
 * disabled until then.
 */
const PROFILE_ORDER: QualityProfile[] = ['ULTRA', 'HIGH', 'MEDIUM', 'LOW', 'POTATO'];

const LandingMenu: React.FC = () => {
  const { phase, sceneReady } = useAppState();
  const isTouch = isTouchDevice();
  const [panel, setPanel] = useState<null | 'controls' | 'graphics'>(null);
  const [profile, setProfile] = useState<QualityProfile>(() => getQualityProfile());
  // Keep the overlay mounted briefly after Play so it can fade out over the
  // now-live game instead of cutting hard.
  const [gone, setGone] = useState(phase !== 'menu');

  useEffect(() => {
    if (phase === 'playing') {
      const t = setTimeout(() => setGone(true), 480);
      return () => clearTimeout(t);
    }
    setGone(false);
    return undefined;
  }, [phase]);

  if (gone) return null;
  const leaving = phase === 'playing';

  const play = () => {
    if (!sceneReady || leaving) return;
    // Pointer lock MUST be requested synchronously inside this gesture. The
    // player's CameraControls seeds its lock state from document.pointerLockElement
    // on mount, so requesting before it mounts is fine (skip on touch).
    if (!isTouch) {
      try { getGameCanvas()?.requestPointerLock(); } catch { /* ignore */ }
    }
    enterPlaying();
  };

  const chooseProfile = (p: QualityProfile) => {
    setProfile(p);
    setQualityProfile(p);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: theme.z.menu,
        fontFamily: theme.font.ui,
        color: theme.color.text,
        opacity: leaving ? 0 : 1,
        transition: `opacity ${theme.transition.slow}`,
        pointerEvents: leaving ? 'none' : 'auto'
      }}
    >
      {/* Opaque cover that hides the cold first frames, then dissolves to reveal
          the warmed cinematic planet behind the glass. */}
      <div style={{
        position: 'absolute', inset: 0, background: theme.color.void,
        opacity: sceneReady ? 0 : 1,
        transition: `opacity ${theme.transition.reveal}`,
        pointerEvents: 'none'
      }} />
      {/* Legibility vignette over the live render. */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        opacity: sceneReady ? 1 : 0,
        transition: `opacity ${theme.transition.reveal}`,
        background:
          'radial-gradient(120% 100% at 30% 35%, rgba(5,8,15,0) 30%, rgba(5,8,15,0.45) 72%, rgba(5,8,15,0.82) 100%),' +
          'linear-gradient(180deg, rgba(5,8,15,0.35) 0%, rgba(5,8,15,0) 30%)'
      }} />

      {/* Content column, anchored lower-left for a cinematic feel. */}
      <div style={{
        position: 'absolute',
        left: 'min(8vw, 88px)',
        bottom: 'max(12vh, 96px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 22,
        maxWidth: 'min(92vw, 520px)'
      }}>
        <div style={{ animation: 'pvFloatIn 700ms cubic-bezier(0.22,1,0.36,1) both' }}>
          <div style={{
            // inline-block + nowrap so the box sizes to the full word — otherwise
            // the gradient (clipped to this element's box, capped by the column's
            // maxWidth) doesn't reach the last letter and the "A" renders transparent.
            display: 'inline-block',
            whiteSpace: 'nowrap',
            fontSize: 'clamp(38px, 7.5vw, 72px)',
            fontWeight: 800,
            letterSpacing: '0.1em',
            lineHeight: 1.08,
            margin: 0,
            paddingRight: '0.12em',
            background: `linear-gradient(180deg, ${theme.color.text} 0%, ${theme.color.accent} 130%)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            textShadow: '0 2px 30px rgba(125,211,252,0.25)'
          }}>
            PARAVOXIA
          </div>
          <div style={{
            marginTop: 12, fontSize: 'clamp(13px, 2vw, 16px)',
            letterSpacing: '0.32em', textTransform: 'uppercase',
            color: theme.color.textDim, paddingLeft: 3
          }}>
            A Voxel Universe
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
          animation: 'pvFloatIn 700ms 120ms cubic-bezier(0.22,1,0.36,1) both' }}>
          <button
            onClick={play}
            disabled={!sceneReady}
            style={{
              fontFamily: theme.font.ui,
              fontSize: 17, fontWeight: 700, letterSpacing: '0.06em',
              color: sceneReady ? theme.color.void : theme.color.textFaint,
              background: sceneReady
                ? `linear-gradient(180deg, ${theme.color.accent}, ${theme.color.accentStrong})`
                : 'rgba(125,211,252,0.10)',
              border: 'none',
              borderRadius: theme.radius.pill,
              padding: '15px 42px',
              cursor: sceneReady ? 'pointer' : 'default',
              boxShadow: sceneReady ? '0 8px 30px rgba(56,189,248,0.45)' : 'none',
              transition: `all ${theme.transition.base}`,
              outline: 'none'
            }}
          >
            {sceneReady ? '▶  Play Now' : 'Generating world…'}
          </button>

          {!sceneReady && (
            <span style={{
              width: 18, height: 18, borderRadius: '50%',
              border: `2px solid ${theme.color.accentGhost}`,
              borderTopColor: theme.color.accent,
              animation: 'pvSpin 0.8s linear infinite', display: 'inline-block'
            }} />
          )}

          <GhostLink active={panel === 'controls'} onClick={() => setPanel(p => p === 'controls' ? null : 'controls')}>Controls</GhostLink>
          <GhostLink active={panel === 'graphics'} onClick={() => setPanel(p => p === 'graphics' ? null : 'graphics')}>Graphics</GhostLink>
        </div>

        {panel === 'controls' && (
          <Panel>
            <PanelTitle>Controls</PanelTitle>
            <Row k={isTouch ? 'Left stick' : 'WASD / Arrows'} v="Move" />
            <Row k={isTouch ? 'Right side' : 'Mouse'} v="Look" />
            <Row k={isTouch ? 'JMP' : 'Space'} v="Jump / jetpack" />
            <Row k={isTouch ? 'MINE' : 'E'} v="Mine / harvest block" />
            <Row k={isTouch ? 'F' : 'F'} v="Board / exit ship" />
            <Row k={isTouch ? '—' : 'Esc'} v="Pause & star map" />
          </Panel>
        )}

        {panel === 'graphics' && (
          <Panel>
            <PanelTitle>Graphics quality</PanelTitle>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
              {PROFILE_ORDER.map(p => (
                <button
                  key={p}
                  onClick={() => chooseProfile(p)}
                  style={{
                    fontFamily: theme.font.mono, fontSize: 11, letterSpacing: '0.06em',
                    padding: '7px 12px', borderRadius: theme.radius.pill, cursor: 'pointer',
                    color: profile === p ? theme.color.void : theme.color.textDim,
                    background: profile === p ? theme.color.accent : 'transparent',
                    border: `1px solid ${profile === p ? theme.color.accent : 'rgba(125,211,252,0.28)'}`,
                    transition: `all ${theme.transition.base}`
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: theme.color.textFaint, lineHeight: 1.5 }}>
              {QUALITY_PROFILES[profile].postProcess
                ? 'Cinematic: bloom, reflections, grass & trees at full reach.'
                : 'Performance: lighter shading for smoother framerates.'}
            </div>
          </Panel>
        )}
      </div>

      <div style={{
        position: 'absolute', right: 'min(8vw, 88px)', bottom: 'max(12vh, 96px)',
        textAlign: 'right', color: theme.color.textFaint, fontFamily: theme.font.mono,
        fontSize: 11, letterSpacing: '0.08em', lineHeight: 1.6, pointerEvents: 'none'
      }}>
        <div>EXPLORE · FLY · BUILD</div>
        <div style={{ opacity: 0.7 }}>v0.1 · early build</div>
      </div>
    </div>
  );
};

const GhostLink: React.FC<{ active?: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    style={{
      fontFamily: theme.font.ui, fontSize: 14, letterSpacing: '0.04em',
      color: active ? theme.color.accent : theme.color.textDim,
      background: 'transparent', border: 'none', cursor: 'pointer',
      padding: '8px 4px', transition: `color ${theme.transition.base}`,
      borderBottom: `1px solid ${active ? theme.color.accentSoft : 'transparent'}`
    }}
  >
    {children}
  </button>
);

const Panel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    ...glassPanel, padding: '16px 18px', maxWidth: 360,
    animation: 'pvFloatIn 240ms ease both'
  }}>
    {children}
  </div>
);

const PanelTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase',
    color: theme.color.accent, marginBottom: 10
  }}>
    {children}
  </div>
);

const Row: React.FC<{ k: string; v: string }> = ({ k, v }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, fontSize: 13, padding: '3px 0' }}>
    <span style={{ fontFamily: theme.font.mono, color: theme.color.accent, opacity: 0.92 }}>{k}</span>
    <span style={{ color: theme.color.textDim }}>{v}</span>
  </div>
);

export default LandingMenu;
