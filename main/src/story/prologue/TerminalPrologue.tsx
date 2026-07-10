import React, { useCallback, useEffect, useState } from 'react';
import { enterPlaying, getGameCanvas, useAppState } from '../../state/appState.ts';
import { isTouchDevice } from '../../utils/mobileInput.ts';
import { hasMilestone, markMilestone } from '../../game/systems/progressionSystem.ts';
import { setVoxelRealityStage } from '../../game/systems/realityRenderSystem.ts';
import { advanceToBeat, getStoryStateSnapshot, STORY_MILESTONES } from '../storyState.ts';
import { theme } from '../../ui/theme.ts';
import { playSfx } from '../../audio/sfxEngine.ts';
import { unlockStoryScore } from '../storyScore.ts';
import { isMovieMode } from '../autopilot.ts';
import PrologueVector from './PrologueVector.tsx';
import { DIVE_SECONDS, setVectorMode, vectorScene } from './prologueVectorState.ts';
import RegulationCrawl from './RegulationCrawl.tsx';
import ManifestScreen from './ManifestScreen.tsx';
import VoyageLedger from './VoyageLedger.tsx';
import DebrisDeflection from './DebrisDeflection.tsx';
import TerminalCorruption from './TerminalCorruption.tsx';

// --- The terminal prologue (A0 "The Sleep") -----------------------------------------
//
// A 1-bit green-phosphor corporate terminal, fullscreen and opaque, running over
// the menu phase — the story world swaps and generates INVISIBLY behind it, so
// the crash hard-cut into Ch1 is instant. Phases: crawl → voyage → corruption →
// acknowledge. The final [F] keypress is the user gesture that grabs pointer
// lock for the on-foot chapter.

export const PHOSPHOR = '#7dfca5';
export const PHOSPHOR_DIM = 'rgba(125,252,165,0.55)';
export const PHOSPHOR_FAINT = 'rgba(125,252,165,0.30)';
export const TERMINAL_BG = '#020604';

type ProloguePhase = 'crawl' | 'manifest' | 'voyage' | 'deflect' | 'corruption' | 'acknowledge';

const TerminalPrologue: React.FC = () => {
  const { sceneReady } = useAppState();
  const isTouch = isTouchDevice();
  // Debug jumps (?story=manifest|voyage|deflect|crash) start mid-prologue.
  const [phase, setPhase] = useState<ProloguePhase>(() => {
    const beat = getStoryStateSnapshot().beat;
    if (beat === 'manifest') return 'manifest';
    if (beat === 'voyage') return 'voyage';
    if (beat === 'deflect') return 'deflect';
    if (beat === 'crash') return 'corruption';
    return 'crawl';
  });
  const [skipVisible, setSkipVisible] = useState(() => hasMilestone(STORY_MILESTONES.prologueSeen));
  // True while the voyage→deflect dive plays: the ledger unmounts so the
  // vector layer has the whole screen for the chase.
  const [diving, setDiving] = useState(false);

  // The vector layer's scene follows the phase — deep-link entries land on the
  // settled mode; live transitions play their bridges (fly-in, align, dive).
  useEffect(() => {
    if (phase === 'crawl') setVectorMode('void');
    else if (phase === 'manifest') setVectorMode(vectorScene.mode === 'void' ? 'enter' : 'dock');
    else if (phase === 'voyage') setVectorMode('voyage');
    else if (phase === 'deflect' || phase === 'corruption' || phase === 'acknowledge') {
      // 'dive' hands off to 'court' itself (see the voyage onDone below); a
      // deep link straight to these phases just gets the dim residual stars.
      if (vectorScene.mode !== 'dive' && vectorScene.mode !== 'court') setVectorMode('court');
    }
  }, [phase]);

  // The fly-in settles into the dock hold once it lands.
  useEffect(() => {
    if (phase !== 'manifest') return;
    const timer = setTimeout(() => setVectorMode('dock'), 3200);
    return () => clearTimeout(timer);
  }, [phase]);

  // The skip affordance appears for everyone once the crawl has played once.
  useEffect(() => {
    if (phase !== 'crawl') setSkipVisible(true);
  }, [phase]);

  const handoff = useCallback(() => {
    playSfx('terminalAdvance');
    markMilestone(STORY_MILESTONES.prologueSeen);
    setVoxelRealityStage('bare');
    if (!isTouch) {
      try { getGameCanvas()?.requestPointerLock(); } catch { /* ignore */ }
    }
    advanceToBeat('descent');
    enterPlaying();
  }, [isTouch]);

  // Movie screenings acknowledge the directive themselves once the world is warm.
  useEffect(() => {
    if (!isMovieMode() || phase !== 'acknowledge' || !sceneReady) return;
    const timer = setTimeout(handoff, 2500);
    return () => clearTimeout(timer);
  }, [phase, sceneReady, handoff]);

  // Shell keyboard: Tab skips ahead to the acknowledge screen; F acknowledges.
  // Any keypress is also an audio-unlock gesture (deep links skip the menu click).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      unlockStoryScore();
      if (e.code === 'Tab') {
        e.preventDefault();
        if (phase !== 'acknowledge') setPhase('corruption');
      } else if (e.code === 'KeyF' && phase === 'acknowledge' && sceneReady) {
        handoff();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, sceneReady, handoff]);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: theme.z.loading + 5,
      background: TERMINAL_BG,
      color: PHOSPHOR,
      fontFamily: theme.font.mono,
      overflow: 'hidden',
      letterSpacing: '0.1em'
    }}>
      {/* The persistent phosphor vector scene — every phase plays inside it. */}
      <PrologueVector />

      {phase === 'crawl' && <RegulationCrawl onDone={() => { advanceToBeat('manifest'); setPhase('manifest'); }} />}
      {phase === 'manifest' && <ManifestScreen onDone={() => { advanceToBeat('voyage'); setPhase('voyage'); }} />}
      {phase === 'voyage' && !diving && (
        <VoyageLedger
          onDone={() => {
            setDiving(true);
            // The DIVE: debris streams off the planet, the ship banks and runs
            // for it, the camera chases, the picture collapses to a scanline —
            // and the oscilloscope court re-expands from that same line.
            setVectorMode('dive');
            playSfx('terminalCorrupt');
            setTimeout(() => {
              setVectorMode('court');
              advanceToBeat('deflect');
              setPhase('deflect');
            }, DIVE_SECONDS * 1000);
          }}
        />
      )}
      {phase === 'deflect' && <DebrisDeflection onDone={() => { advanceToBeat('crash'); setPhase('corruption'); }} />}
      {phase === 'corruption' && <TerminalCorruption onDone={() => setPhase('acknowledge')} />}
      {phase === 'acknowledge' && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 26,
          animation: 'pvTermFlicker 3.2s steps(3, jump-none) infinite'
        }}>
          <div style={{ fontSize: 12, color: PHOSPHOR_DIM }}>POD SEPARATION CONFIRMED · SUIT LOOP ONLY</div>
          <div style={{ fontSize: 20 }}>SURFACE IN 40 SECONDS.</div>
          <div style={{ fontSize: 12, color: PHOSPHOR_DIM }}>THIS WAS NOT SCHEDULED.</div>
          <div style={{ fontSize: 11, color: PHOSPHOR_DIM, marginTop: 6 }}>
            VISUAL CORTEX LINK: RASTER MODE (1-BIT) AVAILABLE · PAN-TILT SURVEY OFFLINE
          </div>
          <div style={{ marginTop: 18, fontSize: 14, letterSpacing: '0.2em' }}>
            {sceneReady
              ? <button
                  onClick={() => sceneReady && handoff()}
                  style={{
                    fontFamily: theme.font.mono, fontSize: 14, letterSpacing: '0.2em',
                    color: TERMINAL_BG, background: PHOSPHOR,
                    border: 'none', padding: '12px 30px', cursor: 'pointer'
                  }}
                >
                  [F] BRACE FOR SURFACE
                </button>
              : <span style={{ color: PHOSPHOR_FAINT }}>RESOLVING SURFACE INDEX…</span>}
          </div>
        </div>
      )}

      {/* CRT chrome: scanlines + curvature vignette over every phase. */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.32) 0px, rgba(0,0,0,0.32) 1px, transparent 1px, transparent 3px)'
      }} />
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(110% 90% at 50% 50%, rgba(0,0,0,0) 58%, rgba(0,0,0,0.5) 88%, rgba(0,0,0,0.85) 100%)'
      }} />

      {skipVisible && phase !== 'acknowledge' && (
        <div style={{
          position: 'absolute', right: 26, bottom: 20, fontSize: 11,
          color: PHOSPHOR_FAINT, letterSpacing: '0.18em', pointerEvents: 'none'
        }}>
          [TAB] SKIP TRANSMISSION
        </div>
      )}

      <style>{`
        @keyframes pvTermFlicker {
          0%, 92% { opacity: 1; }
          93% { opacity: 0.72; }
          94%, 100% { opacity: 0.97; }
        }
      `}</style>
    </div>
  );
};

export default TerminalPrologue;
