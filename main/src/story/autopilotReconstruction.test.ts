import { describe, expect, it } from 'vitest';
import {
  MOVIE_WRECK_INTERACTION_REACH,
  MOVIE_WRECK_INTERACTION_MIN_REACH,
  MOVIE_WRECK_INTERACTION_PREFERRED_REACH,
  MOVIE_WRECK_HOVER_APPROACH_REACH,
  advanceMovieWreckHoverRehearsal,
  createMovieWreckHoverRehearsalState,
  movieWreckReconstructionMotionOwner,
  movieWreckInteractionMotion,
  reconcileMovieWreckHoverRehearsalRun,
  resolveMovieWreckInteractionAnnulusGoal,
  shouldExitWaterBeforeMovieWreck,
  shouldApproachMovieWreck,
  shouldApproachMovieWreckHoverSocket,
  shouldRecoverMovieWreckWetStart
} from './autopilotReconstruction.ts';

describe('movie wreck approach', () => {
  it('releases locomotion at the physical interaction boundary', () => {
    expect(shouldApproachMovieWreck(MOVIE_WRECK_INTERACTION_REACH)).toBe(false);
    expect(shouldApproachMovieWreck(MOVIE_WRECK_INTERACTION_REACH - 0.01)).toBe(false);
    expect(shouldApproachMovieWreck(MOVIE_WRECK_INTERACTION_REACH + 0.01)).toBe(true);
  });

  it('keeps approaching when no trustworthy distance exists', () => {
    expect(shouldApproachMovieWreck(Number.NaN)).toBe(true);
    expect(shouldApproachMovieWreck(Number.POSITIVE_INFINITY)).toBe(true);
  });

  it('retreats from near-field occlusion into the real interaction annulus', () => {
    expect(movieWreckInteractionMotion(MOVIE_WRECK_INTERACTION_MIN_REACH - 0.01))
      .toBe('retreat');
    expect(movieWreckInteractionMotion(MOVIE_WRECK_INTERACTION_MIN_REACH)).toBe('hold');
    expect(movieWreckInteractionMotion(MOVIE_WRECK_INTERACTION_REACH)).toBe('hold');
    expect(movieWreckInteractionMotion(MOVIE_WRECK_INTERACTION_REACH + 0.01))
      .toBe('approach');
  });

  it('plans a grounded outward annulus goal without exceeding 4.4 workbench reach', () => {
    const goal = resolveMovieWreckInteractionAnnulusGoal({
      player: [0.25, 1.4, 0.5],
      workstation: [0, 1.8, 0],
      wreck: [0, 1.8, -2.5],
      surfaceUp: [0, 1, 0]
    });
    expect(goal).not.toBeNull();
    expect(goal?.[1]).toBeCloseTo(1.4);
    expect(Math.hypot(goal![0], goal![1] - 1.8, goal![2]))
      .toBeCloseTo(MOVIE_WRECK_INTERACTION_PREFERRED_REACH);
    expect(Math.hypot(goal![0], goal![1] - 1.8, goal![2])).toBeLessThan(4.4);
  });

  it('uses the workstation opening as the exact-centre retreat direction', () => {
    const goal = resolveMovieWreckInteractionAnnulusGoal({
      player: [0, 0, 0],
      workstation: [0, 0, 0],
      wreck: [0, 0, -2.5],
      surfaceUp: [0, 1, 0]
    });
    expect(goal?.[0]).toBe(0);
    expect(goal?.[1]).toBe(0);
    expect(goal?.[2]).toBeCloseTo(MOVIE_WRECK_INTERACTION_PREFERRED_REACH);
  });

  it('moves beneath the upper socket after ordinary bench reach has accepted', () => {
    expect(MOVIE_WRECK_HOVER_APPROACH_REACH).toBeLessThan(MOVIE_WRECK_INTERACTION_REACH);
    expect(shouldApproachMovieWreckHoverSocket(MOVIE_WRECK_HOVER_APPROACH_REACH + 0.01)).toBe(true);
    expect(shouldApproachMovieWreckHoverSocket(MOVIE_WRECK_HOVER_APPROACH_REACH)).toBe(false);
  });

  it('holds horizontal locomotion from grounded socket arrival through airborne rehearsal', () => {
    const arrived = advanceMovieWreckHoverRehearsal(
      createMovieWreckHoverRehearsalState(),
      { withinApproach: true, physicallySupported: true }
    );
    expect(arrived).toEqual({ active: true, airborneObserved: false });

    const airborne = advanceMovieWreckHoverRehearsal(arrived, {
      withinApproach: false,
      physicallySupported: false
    });
    expect(airborne).toEqual({ active: true, airborneObserved: true });

    expect(advanceMovieWreckHoverRehearsal(airborne, {
      withinApproach: false,
      physicallySupported: false
    })).toEqual({ active: true, airborneObserved: true });
  });

  it('releases a failed rehearsal only after airborne flight returns to support', () => {
    const waiting = advanceMovieWreckHoverRehearsal(
      { active: true, airborneObserved: false },
      { withinApproach: true, physicallySupported: true }
    );
    expect(waiting.active).toBe(true);

    const airborne = advanceMovieWreckHoverRehearsal(waiting, {
      withinApproach: false,
      physicallySupported: false
    });
    expect(advanceMovieWreckHoverRehearsal(airborne, {
      withinApproach: false,
      physicallySupported: true
    })).toEqual(createMovieWreckHoverRehearsalState());
  });

  it('does not latch before the body reaches the physical hover approach', () => {
    expect(advanceMovieWreckHoverRehearsal(
      createMovieWreckHoverRehearsalState(),
      { withinApproach: false, physicallySupported: true }
    )).toEqual(createMovieWreckHoverRehearsalState());
  });

  it('clears a latched rehearsal across a same-beat story run restart', () => {
    const latched = { active: true, airborneObserved: false };
    expect(reconcileMovieWreckHoverRehearsalRun(latched, 17, 18))
      .toEqual(createMovieWreckHoverRehearsalState());
    expect(reconcileMovieWreckHoverRehearsalRun(latched, 18, 18)).toBe(latched);
  });

  it('gives the physical hover and landing priority over the visual workbench annulus', () => {
    const base = {
      diagnosed: true,
      liftInstalled: true,
      hoverSocketAvailable: true,
      firstHoverComplete: false,
      groundedReturnComplete: false
    };
    expect(movieWreckReconstructionMotionOwner(base)).toBe('hover-rehearsal');
    expect(movieWreckReconstructionMotionOwner({
      ...base,
      firstHoverComplete: true
    })).toBe('grounded-return');
    expect(movieWreckReconstructionMotionOwner({
      ...base,
      firstHoverComplete: true,
      groundedReturnComplete: true
    })).toBe('workbench');
  });

  it('keeps diagnosis and an unavailable hover socket under workbench ownership', () => {
    const base = {
      diagnosed: false,
      liftInstalled: true,
      hoverSocketAvailable: true,
      firstHoverComplete: false,
      groundedReturnComplete: false
    };
    expect(movieWreckReconstructionMotionOwner(base)).toBe('workbench');
    expect(movieWreckReconstructionMotionOwner({
      ...base,
      diagnosed: true,
      hoverSocketAvailable: false
    })).toBe('workbench');
  });

  it('finishes the physical water exit before handing reconstruction to dry navigation', () => {
    expect(shouldExitWaterBeforeMovieWreck(0.72)).toBe(true);
    expect(shouldExitWaterBeforeMovieWreck(0.011)).toBe(true);
    expect(shouldExitWaterBeforeMovieWreck(0.01)).toBe(false);
    expect(shouldExitWaterBeforeMovieWreck(0)).toBe(false);
  });

  it('keeps surface-steering only while the dry planner rejects the wet start column', () => {
    expect(shouldRecoverMovieWreckWetStart('start-column-not-traversable')).toBe(true);
    expect(shouldRecoverMovieWreckWetStart('goal-column-not-traversable')).toBe(false);
    expect(shouldRecoverMovieWreckWetStart('path-found')).toBe(false);
  });
});
