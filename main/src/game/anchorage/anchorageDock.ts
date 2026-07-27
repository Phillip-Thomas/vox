/**
 * Arriving at an anchorage, and leaving it.
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
 * Departure lives here too rather than in a file of its own, and that is the whole
 * point of the direction parameter. A departure written separately drifts: it ends
 * up two seconds long against an arrival of six, or vents pressure it never built,
 * and nobody notices until it feels wrong. Sharing one timeline makes "leaving is
 * arriving backwards" a property the tests can actually assert.
 *
 * It is also the budget for work that must not happen mid-play. Shader compilation,
 * a lighting bake, a first-frame stall — the sequence exists partly so those have
 * somewhere to hide, and lengthening it is cheaper than a hitch on arrival.
 */

import type { Vec3Tuple } from '../starSystem.ts';

/** Arriving at the station, or leaving it. */
export type DockDirection = 'arrive' | 'depart';

export type DockPhase =
  | 'idle'
  // Arrival, in order.
  | 'clamping'
  | 'pressurising'
  | 'hatch'
  | 'disembark'
  // Departure, in order.
  | 'boarding'
  | 'sealing'
  | 'depressurising'
  | 'releasing'
  | 'complete';

/**
 * Stage durations, in seconds.
 *
 * Arrival is weighted toward pressurisation because that is the stage with nothing
 * to look at — it is the wait that makes the hatch worth opening. Departure is
 * weighted toward boarding, because walking back into the lock is the last look at
 * the station you get and cutting it short throws that away.
 *
 * The two totals are deliberately close. A six-second arrival followed by a
 * two-second departure reads as the game losing interest in you.
 */
export const DOCK_TIMING: Record<Exclude<DockPhase, 'idle' | 'complete'>, number> = {
  clamping: 1.1,
  pressurising: 2.0,
  hatch: 1.0,
  disembark: 1.6,

  boarding: 1.6,
  sealing: 1.0,
  depressurising: 1.7,
  releasing: 1.1
};

const ARRIVE_ORDER: DockPhase[] = ['clamping', 'pressurising', 'hatch', 'disembark', 'complete'];
const DEPART_ORDER: DockPhase[] = ['boarding', 'sealing', 'depressurising', 'releasing', 'complete'];

export const DOCK_TOTAL_SECONDS = totalFor('arrive');
export const UNDOCK_TOTAL_SECONDS = totalFor('depart');

function totalFor(direction: DockDirection): number {
  return orderFor(direction)
    .filter(phase => phase !== 'complete')
    .reduce((sum, phase) => sum + DOCK_TIMING[phase as keyof typeof DOCK_TIMING], 0);
}

function orderFor(direction: DockDirection): DockPhase[] {
  return direction === 'arrive' ? ARRIVE_ORDER : DEPART_ORDER;
}

/** Station-normal pressure. The lock starts at hard vacuum, and ends there again. */
export const STATION_PRESSURE_KPA = 101.3;

export type DockEffect =
  | 'clamps-engaged'
  | 'pressure-equalised'
  | 'hatch-open'
  | 'hatch-sealed'
  | 'pressure-vented'
  | 'clamps-released'
  | 'control-handback';

export interface DockState {
  direction: DockDirection;
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

export function createDockState(direction: DockDirection = 'arrive'): DockState {
  return { direction, phase: 'idle', elapsed: 0, total: 0, handedBack: false };
}

export function beginDock(current: DockState, direction: DockDirection = current.direction): DockState {
  if (current.phase !== 'idle') return current;
  return { direction, phase: orderFor(direction)[0], elapsed: 0, total: 0, handedBack: false };
}

/** Start a departure from scratch, whatever the incoming state was. */
export function beginUndock(): DockState {
  return beginDock(createDockState('depart'), 'depart');
}

/** The effect emitted on *leaving* each stage. */
const EXIT_EFFECT: Partial<Record<DockPhase, DockEffect>> = {
  clamping: 'clamps-engaged',
  pressurising: 'pressure-equalised',
  hatch: 'hatch-open',
  disembark: 'control-handback',

  boarding: 'hatch-sealed',
  sealing: 'pressure-vented',
  depressurising: 'clamps-released',
  releasing: 'control-handback'
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
  const order = orderFor(current.direction);

  let phase: DockPhase = current.phase;
  let elapsed = current.elapsed + dt;
  const total = current.total + dt;

  for (;;) {
    const duration = DOCK_TIMING[phase as keyof typeof DOCK_TIMING];
    if (duration === undefined || elapsed < duration) break;
    const effect = EXIT_EFFECT[phase];
    if (effect) effects.push(effect);
    elapsed -= duration;
    phase = order[order.indexOf(phase) + 1] ?? 'complete';
    if (phase === 'complete') {
      elapsed = 0;
      break;
    }
  }

  return {
    state: {
      direction: current.direction,
      phase,
      elapsed,
      total,
      handedBack: current.handedBack || phase === 'complete'
    },
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
    state: {
      direction: current.direction,
      phase: 'complete',
      elapsed: 0,
      total: totalFor(current.direction),
      handedBack: true
    },
    effects: ['control-handback']
  };
}

export function dockInputLocked(state: DockState): boolean {
  return state.phase !== 'idle' && state.phase !== 'complete';
}

export interface DockReadout {
  direction: DockDirection;
  phase: DockPhase;
  /** 1 while the clamps hold, 0 while they do not. */
  clamp: number;
  /** 1 at station pressure, 0 at vacuum. */
  pressure: number;
  /** 1 with the hatch fully open. */
  hatch: number;
  pressureKpa: number;
  /** 0 sealed, 1 fully open. Drives the hatch iris. */
  aperture: number;
  /** 0 dark lock, 1 full station light. Drives the reveal. */
  reveal: number;
  /** Position along the lock-to-deck axis: 0 in the lock, 1 out on the deck. */
  travel: number;
  /** Opacity for the readout panel itself. */
  panelOpacity: number;
  /** Heading for the instrument. */
  title: string;
}

/** Progress through one named stage, 0 before it, 1 after it. */
function stageProgress(state: DockState, phase: keyof typeof DOCK_TIMING): number {
  const order = orderFor(state.direction);
  const index = order.indexOf(phase as DockPhase);
  if (index < 0) return 0;
  const currentIndex = order.indexOf(state.phase);
  if (state.phase === 'idle') return 0;
  if (state.phase === 'complete' || currentIndex > index) return 1;
  if (currentIndex < index) return 0;
  return clamp01(state.elapsed / DOCK_TIMING[phase]);
}

export function dockReadout(state: DockState): DockReadout {
  if (state.direction === 'depart') return departReadout(state);

  const clamp = stageProgress(state, 'clamping');
  const pressure = stageProgress(state, 'pressurising');
  const hatch = stageProgress(state, 'hatch');
  const walk = stageProgress(state, 'disembark');

  return {
    direction: 'arrive',
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
    panelOpacity: state.phase === 'complete' ? 0 : 1 - clamp01(hatch * 0.7 + walk),
    title: 'BERTH ASSIGNED · HOLD FOR CYCLE'
  };
}

/**
 * Leaving, which is arriving backwards.
 *
 * Everything that rose on the way in falls on the way out, and the walk runs from
 * the deck back to the lock rather than the other way. Written as its own function
 * rather than as one-minus-the-arrival because the *order* differs — you seal
 * before you vent, and on the way in you pressurise before you open — and a
 * mirrored timeline that also mirrored the ordering would have you opening a hatch
 * onto vacuum.
 */
function departReadout(state: DockState): DockReadout {
  const boarding = stageProgress(state, 'boarding');
  const sealing = stageProgress(state, 'sealing');
  const venting = stageProgress(state, 'depressurising');
  const releasing = stageProgress(state, 'releasing');

  return {
    direction: 'depart',
    phase: state.phase,
    clamp: 1 - releasing,
    pressure: 1 - venting,
    hatch: 1 - sealing,
    pressureKpa: STATION_PRESSURE_KPA * (1 - venting),
    aperture: 1 - easeInOut(sealing),
    // The light goes with the hatch. Once it is shut you are in a dark lock with
    // an instrument panel, which is exactly where you started on the way in.
    reveal: clamp01(1 - (sealing * 0.85 + boarding * 0.15)),
    // Walking back in: from the deck toward the lock.
    travel: 1 - easeInOut(boarding),
    // The panel comes up as the hatch closes — the mirror of it leaving as the
    // hatch opened.
    panelOpacity: state.phase === 'complete' ? 0 : clamp01(sealing * 1.4 + boarding * 0.2),
    title: 'DEPARTURE CLEARED · STAND BY'
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
