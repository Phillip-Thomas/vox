/**
 * Arriving at an anchorage.
 *
 * The dock sequence is the only moment the station gets to introduce itself. A
 * player who materialises standing on the apron has been placed in a level; a
 * player who hears the clamps take, watches the lock come up to pressure and then
 * walks out through an opening hatch has arrived somewhere. The difference is
 * entirely choreography, and choreography is timing.
 *
 * Shaped after `story/physicalBoarding.ts` — a phase machine advanced by seconds,
 * emitting effects on transitions rather than driving anything itself. That
 * separation is why this file can be tested at all: the timeline is arithmetic, and
 * the camera, the readout and the audio are three different readers of it.
 *
 * It is also the budget for work that must not happen mid-play. Shader compilation,
 * a lighting bake, a first-frame stall — the sequence exists partly so those have
 * somewhere to hide, and lengthening it is cheaper than a hitch on arrival.
 */

import type { Vec3Tuple } from '../starSystem.ts';

export type DockPhase =
  | 'idle'
  | 'clamping'
  | 'pressurising'
  | 'hatch'
  | 'disembark'
  | 'complete';

/**
 * Stage durations, in seconds.
 *
 * Weighted toward pressurisation because that is the stage with nothing to look at
 * — it is the wait that makes the hatch worth opening. Total is a shade under six
 * seconds, which is long enough to read as a procedure and short enough to sit
 * through on a second visit.
 */
export const DOCK_TIMING: Record<Exclude<DockPhase, 'idle' | 'complete'>, number> = {
  clamping: 1.1,
  pressurising: 2.0,
  hatch: 1.0,
  disembark: 1.6
};

export const DOCK_TOTAL_SECONDS =
  DOCK_TIMING.clamping + DOCK_TIMING.pressurising + DOCK_TIMING.hatch + DOCK_TIMING.disembark;

/** Station-normal pressure. The lock starts at hard vacuum. */
export const STATION_PRESSURE_KPA = 101.3;

export type DockEffect =
  | 'clamps-engaged'
  | 'pressure-equalised'
  | 'hatch-open'
  | 'control-handback';

export interface DockState {
  phase: DockPhase;
  /** Seconds inside the current phase. */
  elapsed: number;
  /** Seconds since the sequence began. */
  total: number;
  /** True once the player has taken control, however they got there. */
  handedBack: boolean;
}

export interface DockAdvance {
  state: DockState;
  effects: DockEffect[];
}

export function createDockState(): DockState {
  return { phase: 'idle', elapsed: 0, total: 0, handedBack: false };
}

export function beginDock(current: DockState): DockState {
  if (current.phase !== 'idle') return current;
  return { phase: 'clamping', elapsed: 0, total: 0, handedBack: false };
}

const ORDER: DockPhase[] = ['clamping', 'pressurising', 'hatch', 'disembark', 'complete'];

/** The effect emitted on *leaving* each stage. */
const EXIT_EFFECT: Partial<Record<DockPhase, DockEffect>> = {
  clamping: 'clamps-engaged',
  pressurising: 'pressure-equalised',
  hatch: 'hatch-open',
  disembark: 'control-handback'
};

/**
 * Advance the sequence. Returns a new state plus whatever transitions were crossed.
 *
 * Loops rather than assuming one stage per call: a dropped frame during arrival is
 * exactly when several boundaries land in one delta, and swallowing the hatch
 * effect because the frame was long would silently drop a sound cue.
 */
export function advanceDock(current: DockState, deltaSeconds: number): DockAdvance {
  if (current.phase === 'idle' || current.phase === 'complete') {
    return { state: current, effects: [] };
  }
  const dt = Math.max(0, deltaSeconds);
  const effects: DockEffect[] = [];

  let phase: DockPhase = current.phase;
  let elapsed = current.elapsed + dt;
  const total = current.total + dt;

  for (;;) {
    const duration = DOCK_TIMING[phase as keyof typeof DOCK_TIMING];
    if (duration === undefined || elapsed < duration) break;
    const effect = EXIT_EFFECT[phase];
    if (effect) effects.push(effect);
    elapsed -= duration;
    phase = ORDER[ORDER.indexOf(phase) + 1] ?? 'complete';
    if (phase === 'complete') {
      elapsed = 0;
      break;
    }
  }

  return {
    state: { phase, elapsed, total, handedBack: current.handedBack || phase === 'complete' },
    effects
  };
}

/**
 * Cut to the end.
 *
 * A sequence you cannot skip is one you resent by the fourth arrival. The handback
 * effect still fires, because whatever was waiting on it — control, audio state, a
 * precompile that has to be flushed — still has to happen.
 */
export function skipDock(current: DockState): DockAdvance {
  if (current.phase === 'idle' || current.phase === 'complete') {
    return { state: current, effects: [] };
  }
  return {
    state: { phase: 'complete', elapsed: 0, total: DOCK_TOTAL_SECONDS, handedBack: true },
    effects: ['control-handback']
  };
}

export function dockInputLocked(state: DockState): boolean {
  return state.phase !== 'idle' && state.phase !== 'complete';
}

export interface DockReadout {
  phase: DockPhase;
  /** Per-stage progress, 0..1, each reaching 1 only once its stage is done. */
  clamp: number;
  pressure: number;
  hatch: number;
  /** Lock pressure in kPa, for the gauge. */
  pressureKpa: number;
  /** 0 sealed, 1 fully open. Drives the hatch iris. */
  aperture: number;
  /** 0 dark lock, 1 full station light. Drives the reveal. */
  reveal: number;
  /** 0 at the lock, 1 at the point control is handed over. */
  travel: number;
  /** Opacity for the readout panel itself, so it leaves before you do. */
  panelOpacity: number;
}

function stageProgress(state: DockState, phase: keyof typeof DOCK_TIMING): number {
  const index = ORDER.indexOf(phase);
  const currentIndex = ORDER.indexOf(state.phase);
  if (state.phase === 'idle') return 0;
  if (currentIndex > index || state.phase === 'complete') return 1;
  if (currentIndex < index) return 0;
  return clamp01(state.elapsed / DOCK_TIMING[phase]);
}

export function dockReadout(state: DockState): DockReadout {
  const clamp = stageProgress(state, 'clamping');
  const pressure = stageProgress(state, 'pressurising');
  const hatch = stageProgress(state, 'hatch');
  const walk = stageProgress(state, 'disembark');

  return {
    phase: state.phase,
    clamp,
    pressure,
    hatch,
    pressureKpa: STATION_PRESSURE_KPA * pressure,
    aperture: easeInOut(hatch),
    // Light arrives with the hatch and is at full value before you step out, so the
    // apron is a place you can see rather than a place you emerge into.
    reveal: clamp01(hatch * 0.85 + walk * 0.15),
    travel: easeInOut(walk),
    // The panel is a lock instrument. It belongs to the lock, so it goes as the
    // hatch opens rather than following you out onto the deck.
    panelOpacity: state.phase === 'complete' ? 0 : 1 - clamp01(hatch * 0.7 + walk)
  };
}

/** Where the arrival happens: inside the lock, and where you are set down. */
export interface DockRoute {
  lock: Vec3Tuple;
  deck: Vec3Tuple;
}

/** Eye position along the dolly, at readout `travel`. */
export function dockEyeAt(route: DockRoute, travel: number, eyeHeight: number): Vec3Tuple {
  const t = clamp01(travel);
  return [
    route.lock[0] + (route.deck[0] - route.lock[0]) * t,
    route.lock[1] + (route.deck[1] - route.lock[1]) * t + eyeHeight,
    route.lock[2] + (route.deck[2] - route.lock[2]) * t
  ];
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function easeInOut(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}
