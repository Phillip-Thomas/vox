import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useAppState, enterPlaying, getGameCanvas } from '../../state/appState.ts';
import { isTouchDevice } from '../../utils/mobileInput.ts';
import {
  getQualityProfile,
  getGraphicsQuality,
  setQualityProfile,
  subscribeGraphicsQuality,
  type QualityProfile
} from '../../config/graphicsSettings.ts';
import { theme, glassPanel } from '../../ui/theme.ts';
import AudioControls from './AudioControls.tsx';
import CoopPanel from './CoopPanel.tsx';
import { isCoopAuthEnabled } from '../../game/multiplayerAuth.ts';
import { unlockGameAudio } from '../../audio/gameAudio.ts';
import {
  STORY_CHAPTER_ORDER,
  beginStory,
  canContinueStory,
  getStoryStateSnapshot,
  hasCompletedStory,
  storyEntryPoint,
  useStoryState,
  type StoryChapter
} from '../../story/storyState.ts';
import ControlsReference from './ControlsReference.tsx';

/**
 * The landing screen. Renders over the SAME live <Canvas> that becomes the game:
 * during `phase==='menu'` EfficientScene runs the cinematic orbit camera, so the
 * world is fully generated and warm behind this glass. Because of that, "Free
 * Play" just flips the app phase (the player camera takes over — no remount, no
 * second loading flash) and grabs pointer lock inside the click gesture.
 *
 * It also IS the loading screen: an opaque cover hides the cold first frames and
 * dissolves to a vignette once `sceneReady`, revealing the warmed planet. Free
 * play is disabled until then.
 *
 * The story is the game. The primary call to action is derived from the save,
 * the way a console front-end does it: a fresh install offers NEW GAME, a save
 * in progress offers CONTINUE (with where it resumes), and a finished arc offers
 * CONTINUE into the earned world. Starting over from an existing save is a
 * destructive secondary action behind a confirmation; the sandbox is a
 * secondary mode, never the default.
 */
const PROFILE_ORDER: QualityProfile[] = ['ULTRA', 'HIGH', 'MEDIUM', 'LOW', 'POTATO'];

/** Where a Continue resumes, in player terms (numbers only — chapter names are authored copy). */
function continueSubtitle(chapter: StoryChapter): string {
  if (chapter === 'prologue' || chapter === 'none') return 'Prologue';
  const numbered = STORY_CHAPTER_ORDER.filter(entry => /^ch\d+$/.test(entry));
  const index = numbered.indexOf(chapter);
  if (index < 0) return 'Story';
  return `Chapter ${index + 1} of ${numbered.length}`;
}

function unlockAudio(): void {
  void unlockGameAudio();
}

interface LandingMenuProps {
  startWorldId: string;
  onReplayStory: () => void;
  onReturnToStorySite: () => void;
  returningToStorySite: boolean;
}

const LandingMenu: React.FC<LandingMenuProps> = ({
  startWorldId,
  onReplayStory,
  onReturnToStorySite,
  returningToStorySite
}) => {
  const { phase, sceneReady } = useAppState();
  const story = useStoryState();
  const isTouch = isTouchDevice();
  const [panel, setPanel] = useState<null | 'controls' | 'graphics' | 'audio' | 'coop' | 'newGame'>(null);
  const graphicsQuality = useSyncExternalStore(
    subscribeGraphicsQuality,
    getGraphicsQuality,
    getGraphicsQuality
  );
  const profile = getQualityProfile();
  const coopEnabled = useMemo(() => isCoopAuthEnabled(), []);
  const compactMenu = useMemo(() => (typeof window === 'undefined' ? false : window.innerWidth <= 700), []);
  const storyInProgress = canContinueStory();
  // The historical hearth arc can be complete while a later chapter is live.
  // Resume that chapter before offering the completed arc's world return.
  const storyCompleted = !storyInProgress && hasCompletedStory();
  const hasStorySave = storyCompleted || storyInProgress;
  const resumePoint = storyInProgress ? storyEntryPoint() : null;
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

  // Resumed chapters have no prologue overlay to hand the shell into play.
  // A click can precede scene readiness, so finish that transition once ready.
  useEffect(() => {
    if (phase === 'menu' && sceneReady && story.active && story.chapter !== 'prologue') enterPlaying();
  }, [phase, sceneReady, story.active, story.chapter]);

  if (gone) return null;
  const leaving = phase === 'playing';

  const play = () => {
    if (!sceneReady || leaving) return;
    unlockAudio();
    // Commit the shell transition before asking the browser for pointer lock.
    // Some Chromium builds synchronously re-enter document focus/lock handling;
    // the menu must never remain over a successfully locked game if that happens.
    enterPlaying();
    // Pointer lock MUST be requested synchronously inside this gesture. The
    // player's CameraControls seeds its lock state from document.pointerLockElement
    // on mount, so requesting during this same handler is safe (skip on touch).
    if (!isTouch) {
      try { getGameCanvas()?.requestPointerLock(); } catch { /* ignore */ }
    }
  };

  const startOrContinueStory = () => {
    if (leaving || story.active || returningToStorySite) return;
    unlockAudio();
    if (storyCompleted) {
      onReturnToStorySite();
      return;
    }
    // The prologue overlay takes the screen immediately; the story-world swap
    // and generation happen behind its opaque terminal.
    beginStory();
    const started = getStoryStateSnapshot();
    if (!started.active || started.chapter !== 'prologue') play();
  };

  const chooseProfile = (p: QualityProfile) => {
    setQualityProfile(p);
  };

  return (
    <div
      onPointerDown={unlockAudio}
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
      <div className="pv-landing-content" style={{
        position: 'absolute',
        left: 'min(8vw, 88px)',
        bottom: 'max(12vh, 96px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 22,
        maxWidth: 'min(92vw, 560px)',
        maxHeight: 'calc(100% - 32px)',
        overflowY: 'auto',
        padding: '4px 8px 4px 4px'
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
            Make no mistakes
          </div>
        </div>

        {/* Primary actions: the story CTA, the sandbox, and (with a save) a new game. */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap',
          animation: 'pvFloatIn 700ms 120ms cubic-bezier(0.22,1,0.36,1) both' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button
              onClick={startOrContinueStory}
              disabled={returningToStorySite}
              aria-describedby="landing-story-subtitle"
              style={{
                fontFamily: theme.font.ui,
                fontSize: 17, fontWeight: 700, letterSpacing: '0.06em',
                color: theme.color.void,
                background: `linear-gradient(180deg, ${theme.color.accent}, ${theme.color.accentStrong})`,
                border: 'none',
                borderRadius: theme.radius.pill,
                padding: '15px 42px',
                cursor: returningToStorySite ? 'wait' : 'pointer',
                boxShadow: '0 8px 30px rgba(56,189,248,0.45)',
                transition: `all ${theme.transition.base}`,
                outline: 'none'
              }}
            >
              {returningToStorySite
                ? '◈  Preparing Site…'
                : hasStorySave ? '▶  Continue' : '▶  New Game'}
            </button>
            <div id="landing-story-subtitle" style={{
              fontFamily: theme.font.mono, fontSize: 11, letterSpacing: '0.14em',
              textTransform: 'uppercase', color: theme.color.textDim, paddingLeft: 6
            }}>
              {storyCompleted
                ? 'Story complete · Return to your world'
                : resumePoint
                  ? `Resume · ${continueSubtitle(resumePoint.chapter)}`
                  : 'Begin the story'}
            </div>
          </div>

          <button
            onClick={play}
            disabled={!sceneReady}
            title="Open sandbox: explore, fly and build without the story"
            style={{
              fontFamily: theme.font.ui,
              fontSize: 15, fontWeight: 700, letterSpacing: '0.06em',
              color: sceneReady ? theme.color.accent : theme.color.textFaint,
              background: 'transparent',
              border: `1px solid ${sceneReady ? theme.color.accentSoft : 'rgba(125,211,252,0.14)'}`,
              borderRadius: theme.radius.pill,
              padding: '13px 30px',
              cursor: sceneReady ? 'pointer' : 'default',
              transition: `all ${theme.transition.base}`,
              outline: 'none'
            }}
          >
            {sceneReady ? '◈  Free Play' : 'Generating world…'}
          </button>

          {hasStorySave && (
            <GhostLink
              active={panel === 'newGame'}
              aria-expanded={panel === 'newGame'}
              aria-controls="landing-new-game-confirmation"
              style={{ marginTop: 7 }}
              onClick={() => setPanel(p => p === 'newGame' ? null : 'newGame')}
            >New Game</GhostLink>
          )}

          {!sceneReady && (
            <span style={{
              width: 18, height: 18, borderRadius: '50%', marginTop: 15,
              border: `2px solid ${theme.color.accentGhost}`,
              borderTopColor: theme.color.accent,
              animation: 'pvSpin 0.8s linear infinite', display: 'inline-block'
            }} />
          )}
        </div>

        {/* Settings row. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginTop: -8,
          animation: 'pvFloatIn 700ms 200ms cubic-bezier(0.22,1,0.36,1) both' }}>
          <GhostLink
            active={panel === 'controls'}
            aria-expanded={panel === 'controls'}
            aria-controls="landing-controls-reference"
            onClick={() => setPanel(p => p === 'controls' ? null : 'controls')}
          >Controls</GhostLink>
          <GhostLink active={panel === 'graphics'} onClick={() => setPanel(p => p === 'graphics' ? null : 'graphics')}>Graphics</GhostLink>
          <GhostLink active={panel === 'audio'} onClick={() => setPanel(p => p === 'audio' ? null : 'audio')}>Audio</GhostLink>
          {coopEnabled && (
            <GhostLink active={panel === 'coop'} onClick={() => setPanel(p => p === 'coop' ? null : 'coop')}>Co-op</GhostLink>
          )}
        </div>

        {panel === 'controls' && (
          <Panel id="landing-controls-reference" wide>
            <PanelTitle id="landing-controls-title">Controls</PanelTitle>
            <ControlsReference
              labelledBy="landing-controls-title"
              context={{ device: isTouch ? 'touch' : 'desktop', mode: 'overview' }}
            />
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
              {graphicsQuality.postProcess
                ? 'Cinematic: bloom, reflections, grass & trees at full reach.'
                : 'Performance: lighter shading for smoother framerates.'}
            </div>
          </Panel>
        )}

        {panel === 'audio' && (
          <Panel>
            <PanelTitle>Audio</PanelTitle>
            <AudioControls compact />
          </Panel>
        )}

        {panel === 'coop' && (
          <Panel>
            <CoopPanel startWorldId={startWorldId} />
          </Panel>
        )}

        {panel === 'newGame' && (
          <Panel id="landing-new-game-confirmation">
            <PanelTitle>New Game</PanelTitle>
            <div style={{ color: theme.color.textDim, fontSize: 13, lineHeight: 1.55 }}>
              {storyCompleted
                ? 'Starting over resets Story progress, the Story site, carried inventory, suit status, and saved Story pose. Worlds outside the Story site remain saved.'
                : `Your current run (${continueSubtitle(resumePoint?.chapter ?? 'prologue')}) will be erased along with the Story site, carried inventory, suit status, and saved Story pose. Worlds outside the Story site remain saved.`}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button
                type="button"
                onClick={() => setPanel(null)}
                style={{
                  flex: 1, minHeight: 40, borderRadius: theme.radius.md,
                  border: '1px solid rgba(125,211,252,0.24)',
                  background: 'rgba(125,211,252,0.07)', color: theme.color.text,
                  fontFamily: theme.font.ui, fontWeight: 650, cursor: 'pointer'
                }}
              >Cancel</button>
              <button
                type="button"
                onClick={onReplayStory}
                style={{
                  flex: 1.4, minHeight: 40, borderRadius: theme.radius.md,
                  border: '1px solid rgba(252,165,165,0.3)',
                  background: 'rgba(252,165,165,0.08)', color: theme.color.danger,
                  fontFamily: theme.font.ui, fontWeight: 750, cursor: 'pointer'
                }}
              >Start New Game</button>
            </div>
          </Panel>
        )}
      </div>

      <div style={{
        position: 'absolute', right: 'min(8vw, 88px)', bottom: 'max(12vh, 96px)',
        textAlign: 'right', color: theme.color.textFaint, fontFamily: theme.font.mono,
        fontSize: 11, letterSpacing: '0.08em', lineHeight: 1.6, pointerEvents: 'none',
        display: compactMenu && panel ? 'none' : undefined
      }}>
        <div>EXPLORE · FLY · BUILD</div>
        <div style={{ opacity: 0.7 }}>v0.1 · early build</div>
      </div>
    </div>
  );
};

const GhostLink: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }> = ({ active, children, style, ...props }) => (
  <button
    {...props}
    style={{
      fontFamily: theme.font.ui, fontSize: 14, letterSpacing: '0.04em',
      color: active ? theme.color.accent : theme.color.textDim,
      background: 'transparent', border: 'none', cursor: 'pointer',
      padding: '8px 4px', transition: `color ${theme.transition.base}`,
      borderBottom: `1px solid ${active ? theme.color.accentSoft : 'transparent'}`,
      ...style
    }}
  >
    {children}
  </button>
);

const Panel: React.FC<{ children: React.ReactNode; id?: string; wide?: boolean }> = ({ children, id, wide }) => (
  <div id={id} style={{
    ...glassPanel, padding: '16px 18px', maxWidth: wide ? 560 : 360,
    animation: 'pvFloatIn 240ms ease both'
  }}>
    {children}
  </div>
);

const PanelTitle: React.FC<{ children: React.ReactNode; id?: string }> = ({ children, id }) => (
  <div id={id} style={{
    fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase',
    color: theme.color.accent, marginBottom: 10
  }}>
    {children}
  </div>
);

export default LandingMenu;
