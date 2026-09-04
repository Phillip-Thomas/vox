import { useEffect, useRef } from 'react';
import { getScreeningCadenceDiag, getScreeningWaitState, isMovieMode } from './autopilot.ts';
import { getStoryStateSnapshot } from './storyState.ts';
import { hudSurface } from '../ui/hudSurfaces.ts';
import { theme } from '../ui/theme.ts';

// --- The screening status overlay ----------------------------------------------------
//
// Movie mode has two jobs and this small surface serves both.
//
// For a VIEWER: the screening spends real time on things it cannot hurry — a
// night falling, a hold, a cutscene playing itself out. On screen that is
// indistinguishable from a hang, and a viewer who believes the movie has broken
// stops watching. After a couple of seconds of genuine stillness this says what
// is being waited for, quietly, and gets out of the way the moment the pilot
// moves again.
//
// For DEBUGGING: with `?debug=1` the same surface carries the beat, the wait
// duration and the action cadence, so anyone watching a run can see which gate
// is holding it rather than guessing from a frozen frame.
//
// It renders only in movie mode. Ordinary play never mounts it.

const POLL_MS = 250;

export default function MovieStatusOverlay(
  { debug = false }: { debug?: boolean }
): React.ReactElement | null {
  const rootRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMovieMode()) return;
    let timer = 0;
    const tick = (): void => {
      const root = rootRef.current;
      const line = lineRef.current;
      const detail = detailRef.current;
      if (!root || !line) return;
      const wait = getScreeningWaitState();
      const show = wait.waiting || debug;
      root.style.opacity = show ? '1' : '0';
      if (show) {
        line.textContent = wait.reason
          ?? (wait.waiting ? 'HOLDING' : 'PLAYING');
      }
      if (detail) {
        const cadence = getScreeningCadenceDiag();
        const story = getStoryStateSnapshot();
        detail.textContent = debug
          ? `${story.beat ?? 'done'} · wait ${wait.seconds.toFixed(1)}s`
            + ` · act ${cadence.sinceAction.toFixed(1)}s${cadence.settling ? ' · settling' : ''}`
          : '';
      }
    };
    tick();
    timer = window.setInterval(tick, POLL_MS);
    return () => window.clearInterval(timer);
  }, [debug]);

  if (!isMovieMode()) return null;

  return (
    <div
      ref={rootRef}
      aria-hidden
      {...hudSurface('movie-status', 'informational')}
      style={{
        position: 'fixed',
        // Bottom-CENTRE is the caption lane and bottom-left is the ledger's, so
        // the screening's own chrome takes the one corner neither story surface
        // claims. It is registered, so the sweep still proves that.
        right: 'calc(18px + env(safe-area-inset-right, 0px))',
        bottom: 'calc(18px + env(safe-area-inset-bottom, 0px))',
        zIndex: theme.z.hud + 3,
        pointerEvents: 'none',
        fontFamily: theme.font.mono,
        fontSize: 10,
        letterSpacing: '0.18em',
        textAlign: 'right',
        color: 'rgba(228,236,231,0.62)',
        opacity: 0,
        transition: 'opacity 420ms ease',
        textShadow: '0 0 8px rgba(0,0,0,0.85)'
      }}
    >
      <div ref={lineRef} />
      <div ref={detailRef} style={{ marginTop: 3, color: 'rgba(228,236,231,0.4)' }} />
    </div>
  );
}
