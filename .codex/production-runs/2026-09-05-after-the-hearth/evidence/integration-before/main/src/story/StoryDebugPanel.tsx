import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { theme } from '../ui/theme.ts';
import { chapterForBeat, STORY_BEAT_ORDER, useStoryState, type StoryBeat } from './storyState.ts';
import { setLocalPersistenceMode } from '../game/systems/persistence.ts';
import {
  captureSnapshot,
  deleteSnapshot,
  listSnapshots,
  normaliseSnapshotName,
  restoreSnapshotByName,
  writeSnapshot,
  type SnapshotSummary
} from '../game/systems/storySnapshot.ts';
import { HUD_EDGE, hudIconButtonStyle, hudNoSelect } from '../components/hud/hudChrome.ts';
import {
  getActiveMobileHudDisclosure,
  subscribeMobileHudDisclosure,
  toggleMobileHudDisclosure
} from '../components/mobile/mobileHudDisclosure.ts';

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
  'ch4-audit': 'ch4 · the audit route',
  'ch4-comply': 'ch4 · ordered regression',
  'ch4-defy': 'ch4 · refuse.',
  'a4-exhale': 'A4 · Breath (plays)',
  'ch5-maw': 'ch5 · Direction / Maw repair',
  'ch6-dive': 'ch6 · Below / Keel dive',
  'ch7-reconstruct': 'ch7 · restore the Kestrel',
  'ch7-board': 'ch7 · physical boarding',
  'ch8-launch': 'ch8 · launch',
  'ch8-crossing': 'ch8 · local-system crossing',
  'ch8-landfall': 'ch8 · Tidegarden landfall',
  'ch9-settle': 'ch9 · build the second hearth',
  'ch10-cold': 'ch10 · the hum drops a step',
  'ch10-ask': 'ch10 · the crossing back, and the ask',
  'ch10-transit': 'ch10 · the bearing, flown',
  'ch9-hearth': 'ch9 · safe rest / handback',
  done: 'complete  [two-world free play]'
};

/**
 * Take the world back to a saved slot.
 *
 * Restore then reload, and `keep=1` on the way back so the boot path does not
 * immediately wipe what was just restored — `?story=<beat>` normally calls
 * `resetDebugStoryRun()`, which is exactly the behaviour a snapshot exists to
 * escape. Persistence is suppressed first for the same reason the wipe path does
 * it: the beforeunload autosave would otherwise write the live state back over
 * the restored one during this very navigation.
 */
function restoreTo(name: string): void {
  setLocalPersistenceMode('multiplayer');
  if (!restoreSnapshotByName(localStorage, name)) return;
  const params = new URLSearchParams(window.location.search);
  params.set('keep', '1');
  window.location.search = params.toString();
}

/**
 * Backquote toggles the panel.
 *
 * A corner chip is unreachable on desktop, in both states. In play the pointer is
 * locked, so a click never lands on it; paused, `PauseMenu` is a full-screen
 * overlay at `theme.z.menu` (60) and the panel sat at `theme.z.hud + 7` (27), so
 * the menu covered it. The panel was effectively mouse-only on a device that
 * never has a free mouse.
 *
 * Backquote because it is the conventional debug key and collides with nothing:
 * movement is WASD, interact is F, brake is X, HUD is H, pause is Escape.
 */
const TOGGLE_KEY = 'Backquote';

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
  // Re-read on every open rather than subscribing: slots change only when this
  // panel changes them, and a storage listener for that would be ceremony.
  const [slots, setSlots] = useState<SnapshotSummary[]>([]);
  const refreshSlots = useCallback(() => {
    try {
      setSlots(listSnapshots(localStorage));
    } catch {
      setSlots([]);
    }
  }, []);
  // Governed disclosure state: on mobile this is mutually exclusive with the
  // Systems / inventory / suit disclosures (one owner open at a time); on
  // desktop it simply behaves as an independent toggle.
  const activeDisclosure = useSyncExternalStore(
    subscribeMobileHudDisclosure,
    getActiveMobileHudDisclosure,
    () => null
  );
  const open = activeDisclosure === 'story-debug';
  useEffect(() => {
    if (open) refreshSlots();
  }, [open, refreshSlots]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== TOGGLE_KEY) return;
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
      event.preventDefault();
      // Opening has to hand the mouse back, or the panel appears and every
      // button under it is still unclickable — which is the bug this replaces,
      // moved one step later.
      if (!open) document.exitPointerLock?.();
      toggleMobileHudDisclosure('story-debug');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  const chapters = useMemo(() => {
    const groups = new Map<string, StoryBeat[]>();
    for (const beat of STORY_BEAT_ORDER) {
      const chapter = chapterForBeat(beat);
      if (!groups.has(chapter)) groups.set(chapter, []);
      groups.get(chapter)!.push(beat);
    }
    return [...groups.entries()];
  }, []);

  // Menu-row style shared with the beat/action buttons in the disclosure panel.
  const rowStyle = (activeBeat: boolean): React.CSSProperties => ({
    width: '100%',
    textAlign: 'left',
    padding: '6px 11px',
    border: 0,
    borderTop: '1px solid rgba(125,211,252,0.1)',
    background: activeBeat ? theme.color.accent : 'transparent',
    color: activeBeat ? theme.color.void : theme.color.textDim,
    fontFamily: theme.font.mono,
    fontSize: 10,
    letterSpacing: '0.06em',
    cursor: 'pointer',
    touchAction: 'manipulation',
    ...hudNoSelect
  });

  return (
    // Anchored top-right, tucked one action-rail height below the corner
    // actions so the two never collide, and clear of the left-edge story HUD,
    // objective card, marker, and the bottom touch-control region.
    <div
      data-testid="story-debug-panel"
      style={{
        position: 'fixed',
        top: `calc(${HUD_EDGE + 52}px + env(safe-area-inset-top, 0px))`,
        right: `calc(${HUD_EDGE}px + env(safe-area-inset-right, 0px))`,
        // Above PauseMenu (theme.z.menu) and the downed/complete panels that sit
        // just over it, below the loading veil. A debug tool that a pause overlay
        // can bury is a debug tool you cannot reach at the moment you want it.
        zIndex: theme.z.menu + 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 6,
        pointerEvents: 'auto'
      }}
    >
      <button
        type="button"
        aria-label={open ? 'Close story beat teleporter' : 'Open story beat teleporter'}
        aria-expanded={open}
        aria-controls="story-debug-disclosure"
        title={`STORY · ${story.beat ?? story.chapter}`}
        onClick={() => toggleMobileHudDisclosure('story-debug')}
        style={{ ...hudIconButtonStyle(open), fontSize: 15 }}
      >
        ⛿
      </button>

      {open && (
        <div
          id="story-debug-disclosure"
          role="group"
          aria-label="Story beat teleporter"
          style={{
            width: 216,
            maxHeight: '62vh',
            overflowY: 'auto',
            border: theme.glass.border,
            borderRadius: theme.radius.md,
            background: 'linear-gradient(160deg, rgba(10,18,31,0.98), rgba(5,9,17,0.97))',
            boxShadow: '0 18px 44px rgba(0,0,0,0.48)',
            backdropFilter: theme.glass.blur,
            WebkitBackdropFilter: theme.glass.blur,
            fontFamily: theme.font.mono
          }}
        >
          <div style={{ padding: '9px 11px 6px', color: theme.color.textFaint, fontSize: 9, letterSpacing: '0.18em' }}>
            BEAT TELEPORTER · {story.beat ?? story.chapter}
          </div>
          <div style={{ padding: '0 11px 6px', color: theme.color.textFaint, fontSize: 9 }}>
            ` toggles this panel
          </div>

          {/*
            Snapshots. A beat jump reconstructs the *prerequisites* of a beat and
            never a point partway through one, so iterating on the last twenty
            seconds of a beat used to mean replaying the whole chain. Reach the
            moment once, keep it, and it is a reload away from then on.
          */}
          <div style={{ padding: '6px 11px 2px', fontSize: 9, color: theme.color.textFaint, letterSpacing: '0.2em' }}>
            SNAPSHOTS
          </div>
          <button
            type="button"
            style={{ ...rowStyle(false), color: theme.color.good }}
            onClick={() => {
              const raw = window.prompt('snapshot name', story.beat ?? 'slot');
              if (raw === null) return;
              const name = normaliseSnapshotName(raw);
              writeSnapshot(
                localStorage,
                captureSnapshot(localStorage, name, { now: Date.now(), beat: story.beat ?? null })
              );
              refreshSlots();
            }}
          >
            ⭓ keep this moment
          </button>
          {slots.length === 0 && (
            <div style={{ padding: '4px 11px 6px', fontSize: 9, color: theme.color.textFaint }}>
              none yet
            </div>
          )}
          {slots.map(slot => (
            <div key={slot.name} style={{ display: 'flex', alignItems: 'stretch' }}>
              <button
                type="button"
                style={{ ...rowStyle(false), flex: 1 }}
                onClick={() => restoreTo(slot.name)}
                title={`${slot.keyCount} keys · ${Math.round(slot.bytes / 1024)}kB`}
              >
                ⤺ {slot.name}
                {slot.beat ? ` · ${slot.beat}` : ''}
              </button>
              <button
                type="button"
                style={{ ...rowStyle(false), width: 30, textAlign: 'center', color: theme.color.danger }}
                onClick={() => {
                  deleteSnapshot(localStorage, slot.name);
                  refreshSlots();
                }}
                title={`delete ${slot.name}`}
              >
                ×
              </button>
            </div>
          ))}
          {chapters.map(([chapter, beats]) => (
            <React.Fragment key={chapter}>
              <div style={{ padding: '6px 11px 2px', fontSize: 9, color: theme.color.textFaint, letterSpacing: '0.2em' }}>
                {chapter.toUpperCase()}
              </div>
              {beats.map(beat => (
                <button
                  key={beat}
                  type="button"
                  style={rowStyle(story.beat === beat)}
                  onClick={() => jumpTo(beat)}
                >
                  {BEAT_LABELS[beat]}
                </button>
              ))}
            </React.Fragment>
          ))}
          <button type="button" style={{ ...rowStyle(false), color: theme.color.good, marginTop: 4 }} onClick={() => jumpTo('movie')}>
            ▶ movie run (autopilot)
          </button>
          <button type="button" style={rowStyle(false)} onClick={() => jumpTo('menu')}>
            ◦ sandbox menu
          </button>
          <button type="button" style={{ ...rowStyle(false), color: theme.color.danger }} onClick={() => jumpTo('reset')}>
            ⟲ wipe save, fresh run
          </button>
        </div>
      )}
    </div>
  );
};

export default StoryDebugPanel;
