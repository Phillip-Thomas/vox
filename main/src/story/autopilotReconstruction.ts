export const MOVIE_WRECK_INTERACTION_REACH = 4.2;
export const MOVIE_WRECK_INTERACTION_MIN_REACH = 2.65;
export const MOVIE_WRECK_INTERACTION_PREFERRED_REACH = 3.4;
export const MOVIE_WRECK_HOVER_APPROACH_REACH = 1.05;
export const MOVIE_WRECK_DRY_HANDOFF_SUBMERGENCE = 0.01;

type Vec3Tuple = readonly [number, number, number];

export type MovieWreckInteractionMotion = 'approach' | 'retreat' | 'hold';
export type MovieWreckReconstructionMotionOwner =
  | 'workbench'
  | 'hover-rehearsal'
  | 'grounded-return';

export interface MovieWreckHoverRehearsalState {
  active: boolean;
  airborneObserved: boolean;
}

export function createMovieWreckHoverRehearsalState(): MovieWreckHoverRehearsalState {
  return { active: false, airborneObserved: false };
}

/** A new story run is a hard ownership boundary even when its first beat is unchanged. */
export function reconcileMovieWreckHoverRehearsalRun(
  state: MovieWreckHoverRehearsalState,
  previousRunId: number,
  nextRunId: number
): MovieWreckHoverRehearsalState {
  return previousRunId === nextRunId
    ? state
    : createMovieWreckHoverRehearsalState();
}

/**
 * Embodiment owns locomotion once the diagnosed Lift Cell is online. The
 * visual workbench annulus must not pull an airborne player away from the
 * physical socket or preempt the receipt's grounded-return half.
 */
export function movieWreckReconstructionMotionOwner(input: {
  diagnosed: boolean;
  liftInstalled: boolean;
  hoverSocketAvailable: boolean;
  firstHoverComplete: boolean;
  groundedReturnComplete: boolean;
}): MovieWreckReconstructionMotionOwner {
  if (!input.diagnosed || !input.liftInstalled || !input.hoverSocketAvailable) {
    return 'workbench';
  }
  if (!input.firstHoverComplete) return 'hover-rehearsal';
  if (!input.groundedReturnComplete) return 'grounded-return';
  return 'workbench';
}

/**
 * Once the grounded body reaches the hover socket, keep movie locomotion
 * released for the whole physical jump/jet attempt. Reacquiring a moving
 * surface goal while airborne injects lateral velocity and can carry the body
 * out of the real proof envelope. A failed attempt may re-approach only after
 * unsupported flight has been observed and the body is physically supported
 * again; merely waiting on the ground must not churn the latch every frame.
 */
export function advanceMovieWreckHoverRehearsal(
  state: MovieWreckHoverRehearsalState,
  input: { withinApproach: boolean; physicallySupported: boolean }
): MovieWreckHoverRehearsalState {
  if (!state.active) {
    return input.withinApproach
      ? { active: true, airborneObserved: !input.physicallySupported }
      : state;
  }
  const airborneObserved = state.airborneObserved || !input.physicallySupported;
  if (airborneObserved && input.physicallySupported) {
    return createMovieWreckHoverRehearsalState();
  }
  return { active: true, airborneObserved };
}

/** Keep using the real swim/mantle controls until a surfaced dive is materially dry. */
export function shouldExitWaterBeforeMovieWreck(submergence: number): boolean {
  return Number.isFinite(submergence)
    && submergence > MOVIE_WRECK_DRY_HANDOFF_SUBMERGENCE;
}

/**
 * A surfaced capsule can report effectively zero eye submergence while its
 * ground column is still water. Keep using the player-equivalent surface
 * steering until dry navigation can actually own the route.
 */
export function shouldRecoverMovieWreckWetStart(routeReason: string): boolean {
  return routeReason === 'start-column-not-traversable';
}

/**
 * Stop locomotion as soon as the live wreck interaction is physically in
 * reach. Continuing toward the bench's tighter navigation stop can hold a
 * planned jetpack press across the Lift Cell install, preventing the required
 * release -> first-hover press edge.
 */
export function shouldApproachMovieWreck(distance: number): boolean {
  return movieWreckInteractionMotion(distance) === 'approach';
}

/**
 * Keep the automated body in a legible interaction annulus. The upper bound
 * stays inside HifiWreck's real 4.4wu F reach; the lower bound prevents the
 * eye/body from settling inside the bench, detached panels, or hull.
 */
export function movieWreckInteractionMotion(distance: number): MovieWreckInteractionMotion {
  if (!Number.isFinite(distance) || distance > MOVIE_WRECK_INTERACTION_REACH) {
    return 'approach';
  }
  if (distance < MOVIE_WRECK_INTERACTION_MIN_REACH) return 'retreat';
  return 'hold';
}

/**
 * Pick a grounded point radially outside the workstation at the preferred
 * viewing distance. The caller feeds this goal through the ordinary validated
 * surface route planner; this helper never moves the player or grants a receipt.
 */
export function resolveMovieWreckInteractionAnnulusGoal(input: {
  player: Vec3Tuple;
  workstation: Vec3Tuple;
  wreck: Vec3Tuple;
  surfaceUp: Vec3Tuple;
}): [number, number, number] | null {
  if (![...input.player, ...input.workstation, ...input.wreck, ...input.surfaceUp]
    .every(Number.isFinite)) return null;

  const upLength = Math.hypot(...input.surfaceUp);
  if (upLength <= 1e-6) return null;
  const up: Vec3Tuple = [
    input.surfaceUp[0] / upLength,
    input.surfaceUp[1] / upLength,
    input.surfaceUp[2] / upLength
  ];
  const offset: [number, number, number] = [
    input.player[0] - input.workstation[0],
    input.player[1] - input.workstation[1],
    input.player[2] - input.workstation[2]
  ];
  const vertical = dot(offset, up);
  let tangent: [number, number, number] = [
    offset[0] - up[0] * vertical,
    offset[1] - up[1] * vertical,
    offset[2] - up[2] * vertical
  ];
  let tangentLength = Math.hypot(...tangent);
  if (tangentLength <= 1e-6) {
    // At the exact bench centre, retreat through its open approach side rather
    // than choosing an arbitrary axis that could point back through the hull.
    const outward: [number, number, number] = [
      input.workstation[0] - input.wreck[0],
      input.workstation[1] - input.wreck[1],
      input.workstation[2] - input.wreck[2]
    ];
    const outwardVertical = dot(outward, up);
    tangent = [
      outward[0] - up[0] * outwardVertical,
      outward[1] - up[1] * outwardVertical,
      outward[2] - up[2] * outwardVertical
    ];
    tangentLength = Math.hypot(...tangent);
  }
  if (tangentLength <= 1e-6) return null;

  const verticalSquared = vertical * vertical;
  const planarReach = Math.sqrt(Math.max(
    0,
    MOVIE_WRECK_INTERACTION_PREFERRED_REACH ** 2 - verticalSquared
  ));
  const scale = planarReach / tangentLength;
  return [
    input.workstation[0] + tangent[0] * scale + up[0] * vertical,
    input.workstation[1] + tangent[1] * scale + up[1] * vertical,
    input.workstation[2] + tangent[2] * scale + up[2] * vertical
  ];
}

/** The lift rehearsal needs the body under the upper socket, not merely in F reach. */
export function shouldApproachMovieWreckHoverSocket(distance: number): boolean {
  return !Number.isFinite(distance) || distance > MOVIE_WRECK_HOVER_APPROACH_REACH;
}

function dot(left: Vec3Tuple, right: Vec3Tuple): number {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}
