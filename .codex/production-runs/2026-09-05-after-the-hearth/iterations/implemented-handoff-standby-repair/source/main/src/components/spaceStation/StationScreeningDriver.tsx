import { useEffect, useRef } from 'react';
import { STATION_STORY_MILESTONES, BONDED_CELL_ITEM_ID, type StationStoryObjective } from '../../game/spaceStation/spaceStationStory.ts';
import { hasMilestone } from '../../game/systems/progressionSystem.ts';
import { getItemCount } from '../../game/systems/inventorySystem.ts';

// --- The station screening driver ----------------------------------------------------
//
// The movie's continuation inside the station.
//
// Docking is a hard page navigation, so the autopilot that flew the bearing is
// gone: this page is a different app mode with its own control loop, and the
// story query was deliberately stripped on the way in. What survives is one
// flag (see `stationScreening.ts`), and this component is what reads it.
//
// IT PRESSES THE SAME BUTTONS A PLAYER PRESSES. Movement is synthetic key
// events on the window the interior already listens to; the counter and the
// issuer are opened with [F] against the interior's own proximity prompt; the
// transaction advances by clicking the story panel's own action buttons. It
// never calls a commit directly and never teleports past a gate. That is the
// same rule the flight-side bridges follow, and for the same reason: a
// screening that skips the gates stops being evidence about the game.
//
// Each phase is bounded. A timeout records a visible diagnostic failure; it
// never passes the transaction or pretends the screening is complete.

/** Spacing between committed acts — the flight side's cadence, matched. */
const ACT_DWELL_MS = 900;
/** How long a walk phase may run before the screening gives up on it. */
const WALK_TIMEOUT_MS = 45_000;
/** Look-around dwell in the concourse once the cell is in hand. */
const LOOK_AROUND_MS = 9_000;

type Phase = 'settle' | 'walk' | 'transact' | 'look-around' | 'depart' | 'done' | 'stuck';

/** Arrival or a timeout is never evidence that the component transaction finished. */
export function stationScreeningTransactionComplete(receipt: boolean, itemCount: number): boolean {
  return receipt && itemCount > 0;
}

/**
 * The story panel's own action buttons, in the order the transaction runs.
 * Clicking by test id rather than by index keeps this honest: if the authored
 * flow gains a step, the screening simply performs it too.
 */
const ACTION_TEST_IDS = [
  // Counter: be recorded.
  'spaceStation-present-suit-record',
  'spaceStation-declare-issued-component',
  'spaceStation-registry-continue',
  // Issuer: present the fault, ask what the bond is, take the sealed cell.
  'spaceStation-present-habitat-fault',
  'spaceStation-ask-bond',
  'spaceStation-accept-bonded-cell',
  'spaceStation-issuer-continue'
];

function pressKey(code: string, down: boolean): void {
  window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }));
}

/** The first visible, enabled story action on screen, if any. */
function nextAction(): HTMLElement | null {
  for (const id of ACTION_TEST_IDS) {
    const node = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
    if (!node) continue;
    if (node instanceof HTMLButtonElement && node.disabled) continue;
    const style = window.getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    return node;
  }
  return null;
}

export function StationScreeningDriver({
  objective,
  nearTarget,
  panelOpen,
  scene,
  docking,
  walkIntent
}: {
  objective: StationStoryObjective | null;
  nearTarget: boolean;
  panelOpen: boolean;
  scene: string;
  docking: boolean;
  walkIntent: React.MutableRefObject<boolean>;
}): null {
  const phase = useRef<Phase>('settle');
  const phaseSince = useRef(performance.now());
  const lastActAt = useRef(0);
  const walking = useRef(false);
  const stuckReason = useRef<string | null>(null);
  // Props are read from a timer, so keep a live view of them.
  const live = useRef({ objective, nearTarget, panelOpen, scene, docking });
  live.current = { objective, nearTarget, panelOpen, scene, docking };

  useEffect(() => {
    const publish = (): void => {
      const acquired = stationScreeningTransactionComplete(
        hasMilestone(STATION_STORY_MILESTONES.bondedCellAcquired), getItemCount(BONDED_CELL_ITEM_ID));
      (window as typeof window & { __stationScreening?: unknown }).__stationScreening = {
        phase: phase.current, objectiveId: live.current.objective?.id ?? null,
        stuck: stuckReason.current, acquired, completed: phase.current === 'done' && acquired,
        phaseSeconds: (performance.now() - phaseSince.current) / 1000
      };
    };
    const setPhase = (next: Phase): void => {
      if (phase.current === next) return;
      phase.current = next;
      phaseSince.current = performance.now();
      publish();
    };
    const setWalking = (next: boolean): void => {
      if (walking.current === next) return;
      walking.current = next;
      walkIntent.current = next;
      pressKey('KeyW', next);
    };

    const fail = (reason: string): void => {
      stuckReason.current = reason;
      setWalking(false);
      setPhase('stuck');
      console.error(`[station-screening] stuck: ${reason}`);
    };
    publish();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const state = live.current;
      const inPhaseMs = now - phaseSince.current;
      publish();
      if (phase.current === 'stuck' || phase.current === 'done') return;
      const acquired = stationScreeningTransactionComplete(
        hasMilestone(STATION_STORY_MILESTONES.bondedCellAcquired), getItemCount(BONDED_CELL_ITEM_ID));

      // The docking choreography owns the camera; the screening waits it out.
      if (state.docking || state.scene !== 'interior') {
        setWalking(false);
        // A departure that has reached the dock choreography is FINISHED, not
        // restarted: the undock navigation owns the rest of the trip home.
        if (phase.current === 'depart') setPhase('done');
        else setPhase('settle');
        return;
      }

      // The cell is in hand. The screening used to END here, at a shop counter,
      // with the movie's whole reason for coming to the station still sitting
      // in the pack. It now holds for a beat and then walks back out through the
      // interior's OWN airlock objective — the same prompt, the same [F], the
      // same commit — because a screening that stops at the door of the thing it
      // travelled a chapter to reach is not the movie anyone asked for.
      if (acquired && !state.panelOpen
        && phase.current !== 'look-around' && phase.current !== 'depart') {
        setWalking(false);
        setPhase('look-around');
        return;
      }
      switch (phase.current) {
        case 'settle': {
          // A breath after arrival before anything moves, so the cut into the
          // station is not immediately followed by a walk.
          if (inPhaseMs > 1_800) {
            if (state.objective) setPhase('walk');
            else if (acquired) setPhase('look-around');
            else fail('arrival-has-no-objective-or-bonded-cell');
          }
          break;
        }
        case 'walk': {
          if (!state.objective) { fail('objective-disappeared-before-cell-acquired'); break; }
          if (state.panelOpen) { setWalking(false); setPhase('transact'); break; }
          if (inPhaseMs > WALK_TIMEOUT_MS) { fail(`walk-timeout:${state.objective.id}`); break; }
          if (state.nearTarget) {
            setWalking(false);
            if (now - lastActAt.current >= ACT_DWELL_MS) {
              lastActAt.current = now;
              // The interior's own [F] against its own proximity prompt.
              pressKey('KeyF', true);
              pressKey('KeyF', false);
            }
            break;
          }
          setWalking(true);
          break;
        }
        case 'transact': {
          if (!state.panelOpen) {
            // The panel closed: either the step advanced or the transaction is
            // finished. `objective` decides which.
            if (acquired) setPhase('look-around');
            else if (state.objective) setPhase('walk');
            else fail('transaction-closed-without-objective-or-cell');
            break;
          }
          if (inPhaseMs > 12_000) { fail(`transaction-timeout:${state.objective?.id ?? 'unknown'}`); break; }
          if (now - lastActAt.current < ACT_DWELL_MS) break;
          const action = nextAction();
          if (action) {
            lastActAt.current = now;
            action.click();
          }
          break;
        }
        case 'look-around': {
          // Hold on the concourse for a beat before leaving, rather than cutting
          // straight from a transaction into a walk.
          setWalking(false);
          if (!acquired) { fail('bonded-cell-receipt-lost'); break; }
          if (inPhaseMs > LOOK_AROUND_MS) setPhase('depart');
          break;
        }
        case 'depart': {
          if (!acquired) { fail('bonded-cell-receipt-lost'); break; }
          // The interior publishes its own airlock objective once the
          // transaction is finished. The screening follows it exactly as a
          // player does; if it never appears, that is a stuck report, not a
          // reason to reach past it.
          if (!state.objective) { fail('no-departure-objective-after-acquisition'); break; }
          if (state.objective.targetKind !== 'airlock') {
            fail(`unexpected-departure-objective:${state.objective.id}`);
            break;
          }
          if (inPhaseMs > WALK_TIMEOUT_MS) { fail('depart-timeout'); break; }
          if (state.nearTarget) {
            setWalking(false);
            if (now - lastActAt.current >= ACT_DWELL_MS) {
              lastActAt.current = now;
              pressKey('KeyF', true);
              pressKey('KeyF', false);
            }
            break;
          }
          setWalking(true);
          break;
        }
        default:
          setWalking(false);
          break;
      }
    }, 250);

    return () => {
      window.clearInterval(timer);
      walkIntent.current = false;
      if (walking.current) pressKey('KeyW', false);
    };
  }, [walkIntent]);

  return null;
}
