import React, { useMemo, useState } from 'react';
import { theme } from '../ui/theme.ts';
import { chapterForBeat, STORY_BEAT_ORDER, useStoryState, type StoryBeat } from './storyState.ts';
import { setLocalPersistenceMode } from '../game/systems/persistence.ts';

// --- Story debug panel -----------------------------------------------------------
//
// Dev-only beat teleporter: one button per beat, before AND after every key
// point (transition beats like a1-ramp play the awakening; the beat after
// starts settled). Jumps navigate via `?story=<beat>` + reload — a fresh module
// graph and scene mount is the only state reset that never lies.
//
// Shown when the session is already a debug session (?story= present or
// ?debug=1). Collapsed to a corner chip by default.

const BEAT_LABELS: Record<StoryBeat, string> = {
  crawl: 'crawl (intro)',
  manifest: 'manifest (berthing)',
  voyage: 'voyage (oregon trail)',
  deflect: 'deflect (pong)',
  crash: 'crash (corruption)',
  descent: 'descent (crash landing, plays)',
  'ch1-fixed': 'ch1 · fixed-screen tutorial',
  'ch1-track': 'TRACKING UNBOLT (plays)',
  'ch1-raster': 'ch1 · side-scroller quota',
  'ch1-depth': 'ch1 · work-line pods',
  'ch1-nav': 'ch1 · top-down nav',
  'ch1-iso': 'ch1 · isometric climb',
  'ch1-lift': '2D→3D LIFT (plays)',
  'ch1-anomaly': 'ch1 · embodied survey → stone  [pre-A1]',
  'a1-ramp': 'A1 · color ramp (plays)',
  'ch2-color': 'ch2 · color feed  [post-A1]',
  'ch2-approach': 'ch2 · redacted tree  [pre-A2]',
  'a2-awakening': 'A2 · liberation (plays)',
  'ch3-gather': 'ch3 · gather  [post-A2]',
  'ch3-dusk': 'ch3 · dusk cutscene (plays)',
  'ch3-await-rest': 'ch3 · night → rest  [pre-A3]',
  'a3-dawn': 'A3 · dawn (plays)',
  'ch3-thirst': 'ch3 · the dry morning  [post-A3]',
  'ch3-forage': 'ch3 · the first meal',
  'ch3-signal': 'ch3 · the klaxon (sprint)',
  'ch4-vigil': 'ch4 · scheduled sleep',
  'ch4-arrival': 'ch4 · THE OTHER WORKER (plays)',
  done: 'complete  [post-arrival sandbox]'
};

export function storyDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const p = new URLSearchParams(window.location.search);
  return p.has('story') || p.get('debug') === '1';
}

function jumpTo(beat: StoryBeat | 'menu' | 'reset' | 'movie'): void {
  const params = new URLSearchParams(window.location.search);
  if (beat === 'reset' || beat === 'movie') {
    // Wipe the game save (story milestones live in it) and restart the run.
    // CRITICAL: suppress local persistence FIRST — the app's beforeunload
    // autosave otherwise resurrects the save during this very navigation.
    setLocalPersistenceMode('multiplayer');
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('pvx.')) localStorage.removeItem(key);
    }
    params.set('story', '1');
    if (beat === 'movie') params.set('movie', '1');
    else params.delete('movie');
  } else if (beat === 'menu') {
    params.delete('story');
    params.delete('movie');
  } else {
    params.set('story', beat);
  }
  window.location.search = params.toString();
}

const StoryDebugPanel: React.FC = () => {
  const story = useStoryState();
  const [open, setOpen] = useState(false);
  const chapters = useMemo(() => {
    const groups = new Map<string, StoryBeat[]>();
    for (const beat of STORY_BEAT_ORDER) {
      const chapter = chapterForBeat(beat);
      if (!groups.has(chapter)) groups.set(chapter, []);
      groups.get(chapter)!.push(beat);
    }
    return [...groups.entries()];
  }, []);

  const chip: React.CSSProperties = {
    fontFamily: theme.font.mono,
    fontSize: 10,
    letterSpacing: '0.1em',
    color: theme.color.accent,
    background: 'rgba(8,13,24,0.85)',
    border: `1px solid ${theme.color.accentGhost}`,
    borderRadius: theme.radius.sm,
    padding: '5px 9px',
    cursor: 'pointer'
  };

  return (
    <div style={{
      position: 'fixed',
      left: 12,
      top: '38%',
      zIndex: theme.z.toast,
      fontFamily: theme.font.mono,
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      maxHeight: '58vh',
      overflowY: 'auto'
    }}>
      <button style={chip} onClick={() => setOpen(o => !o)}>
        ⛿ STORY {open ? '▾' : '▸'} {story.beat ?? story.chapter}
      </button>
      {open && (
        <>
          {chapters.map(([chapter, beats]) => (
            <React.Fragment key={chapter}>
              <div style={{ fontSize: 9, color: theme.color.textFaint, letterSpacing: '0.2em', marginTop: 4 }}>
                {chapter.toUpperCase()}
              </div>
              {beats.map(beat => (
                <button
                  key={beat}
                  style={{
                    ...chip,
                    textAlign: 'left',
                    color: story.beat === beat ? theme.color.void : theme.color.textDim,
                    background: story.beat === beat ? theme.color.accent : 'rgba(8,13,24,0.85)'
                  }}
                  onClick={() => jumpTo(beat)}
                >
                  {BEAT_LABELS[beat]}
                </button>
              ))}
            </React.Fragment>
          ))}
          <button style={{ ...chip, marginTop: 6, color: theme.color.good }} onClick={() => jumpTo('movie')}>▶ movie run (autopilot)</button>
          <button style={chip} onClick={() => jumpTo('menu')}>◦ sandbox menu</button>
          <button style={{ ...chip, color: theme.color.danger }} onClick={() => jumpTo('reset')}>⟲ wipe save, fresh run</button>
        </>
      )}
    </div>
  );
};

export default StoryDebugPanel;
