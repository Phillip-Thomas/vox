import { useEffect, useState } from 'react';
import { getAppStateSnapshot, getGameCanvas } from '../../state/appState.ts';
import { isTouchDevice } from '../../utils/mobileInput.ts';
import { isMovieMode } from '../../story/autopilot.ts';
import { isMapViewOpen } from '../../game/mapView.ts';
import { theme } from '../../ui/theme.ts';
import { hudSurface } from '../../ui/hudSurfaces.ts';

// --- Pointer-lock recovery ----------------------------------------------------------
//
// The prologue's [ACKNOWLEDGE] requests pointer lock inside the click gesture
// and swallows any throw. When that request fails — Chromium's cooldown after a
// recent exitPointerLock, a canvas that is not ready yet, a permissions policy —
// NO `pointerlockchange` event ever fires, so the pause-menu handler that
// normally covers "lock was lost" never runs.
//
// The result is the worst possible first impression: a live, rendering world,
// a work order naming [A]/[D] and [E], and nothing on the keyboard doing
// anything, with no pause menu and no error. Movement, extract and interact are
// all gated on the lock. Recovery already exists — CameraControls re-requests
// lock on any canvas click — but nothing on screen says so, and a player who
// has just been told to press [E] has no reason to try clicking.
//
// So: detect the specific uncovered state and say the one sentence that fixes
// it.
//
// The gate is an explicit "controls are expected to be live" predicate rather
// than the negation of a hand-maintained pause list, because the first version
// WAS such a negation and it false-positived everywhere the list had not been
// updated: the movie lane (the screening's handoff runs from a timer, so the
// browser rejects a lock request made outside a user gesture and lock is never
// held for the whole capture — the prompt would have appeared in every
// screenshot strip and cinematography evidence frame in the project), the open
// Fabricator, and the survey chart. Each of those releases lock ON PURPOSE.

const POLL_MS = 400;

export default function PointerLockRecovery(
  { paused, suppressed = false }: { paused: boolean; suppressed?: boolean }
): React.ReactElement | null {
  const [needsLock, setNeedsLock] = useState(false);

  useEffect(() => {
    if (isTouchDevice()) return;
    const check = (): void => {
      setNeedsLock(
        getAppStateSnapshot().phase === 'playing'
        && !paused
        && !suppressed
        // Every one of these releases pointer lock deliberately.
        && !isMovieMode()
        && !isMapViewOpen()
        && document.pointerLockElement === null
      );
    };
    check();
    // Polled rather than event-driven precisely because the failure mode is
    // the ABSENCE of a pointerlockchange event.
    const timer = window.setInterval(check, POLL_MS);
    document.addEventListener('pointerlockchange', check);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('pointerlockchange', check);
    };
  }, [paused, suppressed]);

  if (!needsLock) return null;

  return (
    <button
      type="button"
      data-testid="pointer-lock-recovery"
      {...hudSurface('pointer-lock-recovery', 'informational')}
      onClick={() => {
        // This button covers the canvas, so the canvas click path cannot run
        // underneath it — request directly, and hide on success. If the request
        // is refused (a lock cooldown still in flight) the poll simply keeps
        // the prompt up and the player can try again.
        try { getGameCanvas()?.requestPointerLock(); } catch { /* poll re-offers */ }
      }}
      style={{
        position: 'fixed',
        left: '50%',
        // NOT `bottom: 18%`. That is the interaction prompt's anchor — both the
        // feed's (RegulationFeedHud) and the embodied one — and this component
        // is mounted outside the story HUD gate on purpose, so it can co-render
        // with either. At a shared anchor and a higher z it painted over the
        // very verb the player needs. It sits above them instead, and above the
        // touch controls, since a player who cannot move also cannot act.
        bottom: 'calc(30% + env(safe-area-inset-bottom, 0px))',
        transform: 'translateX(-50%)',
        zIndex: theme.z.hud + 4,
        border: '1px solid rgba(228,236,231,0.55)',
        background: 'rgba(2,4,3,0.78)',
        color: 'rgba(228,236,231,0.92)',
        font: `500 12px ${theme.font.mono}`,
        letterSpacing: '0.16em',
        padding: '10px 18px',
        cursor: 'pointer'
      }}
    >
      CLICK TO RESUME CONTROL
    </button>
  );
}
