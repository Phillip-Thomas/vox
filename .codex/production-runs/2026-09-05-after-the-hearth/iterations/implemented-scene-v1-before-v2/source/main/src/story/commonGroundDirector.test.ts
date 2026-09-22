import { beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { resetProgression, hasMilestone, markMilestone } from '../game/systems/progressionSystem.ts';
import { setPlayerWorldPosition } from '../state/playerFrame.ts';
import { STORY_MILESTONES } from './storyState.ts';
import {
  accumulateTraceDistance,
  appendTraceSample,
  clearAllCommonGroundWorlds,
  createTraceSlot,
  markTestedPrefix,
  CG_COMMON_ROUTE_UNITS,
  CG_POSES,
  CG_ROUTE_COMMON,
  CG_ROUTE_LONG,
  CG_ROUTE_SHORT,
  clearCommonGroundWorld,
  lastTestedPoint,
  serializeCommonGroundForWorld,
  stageCommonGroundWorldPayload
} from './commonGroundState.ts';
import type { CommonGroundFooting } from './commonGroundRoute.ts';
import {
  commitCommonGroundDemonstrationOffer,
  commitCommonGroundFaultReview,
  commitCommonGroundFinalReferenceOffer,
  commitCommonGroundReturnChoice,
  commitCommonGroundSpanOffer,
  commitCommonGroundSurveyStart,
  commitCommonGroundTailReopen,
  commitCommonGroundWitnessOffer,
  commonGroundGuidanceFacts,
  commonGroundMarkerTarget,
  commonGroundRailPlan,
  commonGroundSnapshot,
  enterCommonGroundBeat,
  isCommonGroundBeat,
  registerCommonGroundWorld,
  resetCommonGroundRuntime,
  tickCommonGround
} from './commonGroundDirector.ts';
import { resolveStoryObjectiveGuidance } from './storyObjectiveGuidance.ts';
import {
  commonGroundActorPosition,
  getCommonGroundActorState,
  resetCommonGroundActor
} from './commonGroundActor.ts';

const flatGround: CommonGroundFooting = {
  revision: 'test',
  isSupported: point => Math.abs(point.y - 51.05) < 0.001
};

function standAt(point: { x: number; y: number; z: number }): void {
  setPlayerWorldPosition(new THREE.Vector3(point.x, point.y, point.z));
}

function distanceFrom(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number }
): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

let unbind: (() => void) | null = null;

beforeEach(() => {
  resetProgression();
  clearAllCommonGroundWorlds();
  resetCommonGroundRuntime({ clearWorlds: true });
  unbind?.();
  unbind = registerCommonGroundWorld({ worldId: '', footing: flatGround, extraSolids: [] });
});

describe('the chapter is four beats and nothing else', () => {
  it('claims exactly its own beats', () => {
    for (const beat of ['ch13-home', 'ch13-return', 'ch13-survey', 'ch13-common'] as const) {
      expect(isCommonGroundBeat(beat), beat).toBe(true);
    }
    expect(isCommonGroundBeat('ch10-cold')).toBe(false);
    expect(isCommonGroundBeat('done')).toBe(false);
    expect(isCommonGroundBeat(null)).toBe(false);
  });
});

describe('the home rungs commit on the actual action, once', () => {
  it('refuses the return choice until the fault has actually been reviewed', () => {
    enterCommonGroundBeat('ch13-home');
    expect(commitCommonGroundReturnChoice()).toBe(false);
    expect(hasMilestone(STORY_MILESTONES.ch13ReturnChosen)).toBe(false);

    expect(commitCommonGroundFaultReview()).toBe(true);
    expect(commitCommonGroundReturnChoice()).toBe(true);
    expect(hasMilestone(STORY_MILESTONES.ch13ReturnChosen)).toBe(true);
  });

  it('is idempotent: a repeated commit changes nothing and reports nothing new', () => {
    enterCommonGroundBeat('ch13-home');
    expect(commitCommonGroundFaultReview()).toBe(true);
    expect(commitCommonGroundFaultReview()).toBe(false);
    expect(commitCommonGroundReturnChoice()).toBe(true);
    expect(commitCommonGroundReturnChoice()).toBe(false);
  });

  it('cannot be committed from another beat', () => {
    enterCommonGroundBeat('ch13-survey');
    expect(commitCommonGroundFaultReview()).toBe(false);
    expect(hasMilestone(STORY_MILESTONES.ch13FaultReviewed)).toBe(false);
  });
});

describe('the survey records nothing beside the actor', () => {
  beforeEach(() => enterCommonGroundBeat('ch13-survey'));

  it('opens an awaiting-start state with no sample at all', () => {
    standAt(CG_POSES.W);
    expect(commitCommonGroundDemonstrationOffer()).toBe(true);
    const snapshot = commonGroundSnapshot();
    expect(snapshot.survey.phase).toBe('awaiting-start');
    expect(snapshot.survey.working).toBeNull();
    // The single next rung targets S — never E, and never the actor.
    expect(commonGroundGuidanceFacts().ch13SurveyState).toBe('start');
    expect(commonGroundMarkerTarget('ch13:survey:start')).toEqual(
      new THREE.Vector3(CG_POSES.S.x, CG_POSES.S.y, CG_POSES.S.z)
    );
  });

  it('records the first sample only on a grounded F at S', () => {
    standAt(CG_POSES.W);
    commitCommonGroundDemonstrationOffer();
    standAt(CG_POSES.E);
    expect(commitCommonGroundSurveyStart()).toBe(false);
    expect(commonGroundSnapshot().survey.working).toBeNull();

    standAt(CG_POSES.S);
    expect(commitCommonGroundSurveyStart()).toBe(true);
    expect(commonGroundSnapshot().survey.working?.samples).toHaveLength(1);
    expect(commonGroundGuidanceFacts().ch13SurveyState).toBe('draw');
  });

  it('will not offer a span that was never walked', () => {
    standAt(CG_POSES.W);
    commitCommonGroundDemonstrationOffer();
    standAt(CG_POSES.S);
    commitCommonGroundSurveyStart();
    standAt(CG_POSES.E);
    // One sample is a standing position, not a proposal.
    expect(commitCommonGroundSpanOffer()).toBe(false);
  });

  it('reopens only the unverified tail and preserves the tested prefix', () => {
    const snapshot = commonGroundSnapshot();
    snapshot.survey.phase = 'drawing';
    snapshot.survey.working = createTraceSlot({ ...CG_ROUTE_LONG[0], corner: true });
    for (const point of CG_ROUTE_LONG.slice(1, 6)) {
      accumulateTraceDistance(snapshot.survey.working, 2);
      appendTraceSample(snapshot.survey.working, { ...point, corner: false });
    }
    markTestedPrefix(snapshot.survey.working, 3);
    snapshot.survey.working.offeredEndIndex = snapshot.survey.working.samples.length - 1;

    standAt(CG_ROUTE_LONG[2]); // the last tested point
    expect(commitCommonGroundTailReopen()).toBe(true);
    expect(snapshot.survey.working.samples).toHaveLength(3);
    expect(snapshot.survey.working.testedPrefixCount).toBe(3);
    expect(snapshot.survey.phase).toBe('drawing');
    // The old last-tested-point prompt does not persist during drawing.
    expect(commonGroundGuidanceFacts().ch13SurveyState).not.toBe('revise');
  });

  it('refuses a tail reopen from anywhere but the actual last tested point', () => {
    const snapshot = commonGroundSnapshot();
    snapshot.survey.phase = 'drawing';
    snapshot.survey.working = createTraceSlot({ ...CG_ROUTE_LONG[0], corner: true });
    for (const point of CG_ROUTE_LONG.slice(1, 6)) {
      accumulateTraceDistance(snapshot.survey.working, 2);
      appendTraceSample(snapshot.survey.working, { ...point, corner: false });
    }
    markTestedPrefix(snapshot.survey.working, 3);
    standAt(CG_POSES.C);
    expect(commitCommonGroundTailReopen()).toBe(false);
    expect(snapshot.survey.working.samples).toHaveLength(6);
  });
});

describe('the reciprocal claim waits for his body', () => {
  beforeEach(() => enterCommonGroundBeat('ch13-common'));

  const clearOfE = { x: CG_POSES.E.x, y: CG_POSES.E.y, z: CG_POSES.E.z - 3 };

  it('reports preparation until he has actually arrived at H', () => {
    standAt(clearOfE);
    tickCommonGround(0.016);
    expect(commonGroundSnapshot().common.stage).toBe('positioning-to-h');
    expect(commonGroundGuidanceFacts().ch13CommonState).toBe('reciprocal-preparing');

    // Walk him the whole two-unit positioning leg.
    for (let frame = 0; frame < 200; frame += 1) tickCommonGround(0.05);
    expect(commonGroundSnapshot().common.stage).toBe('holding-h');
    expect(commonGroundGuidanceFacts().ch13CommonState).toBe('reciprocal');
  });

  it('credits no comparison for the uncredited positioning leg', () => {
    standAt(clearOfE);
    for (let frame = 0; frame < 200; frame += 1) tickCommonGround(0.05);
    expect(commonGroundSnapshot().common.terraUnits).toBe(0);
    expect(commonGroundSnapshot().common.comparisonProved).toBe(false);
  });

  it('does not credit her passage for standing at the far end', () => {
    standAt(clearOfE);
    for (let frame = 0; frame < 200; frame += 1) tickCommonGround(0.05);
    standAt(CG_POSES.C);
    for (let frame = 0; frame < 30; frame += 1) tickCommonGround(0.05);
    expect(commonGroundSnapshot().common.comparisonProved).toBe(false);
    expect(hasMilestone(STORY_MILESTONES.ch13ReciprocalCrossed)).toBe(false);
  });

  it('records the passage only when she actually walks the traced span', () => {
    standAt(clearOfE);
    for (let frame = 0; frame < 200; frame += 1) tickCommonGround(0.05);
    for (const point of CG_ROUTE_COMMON) {
      standAt(point);
      tickCommonGround(0.05);
    }
    expect(commonGroundSnapshot().common.comparisonProved).toBe(true);
    expect(hasMilestone(STORY_MILESTONES.ch13ReciprocalCrossed)).toBe(true);
    expect(commonGroundGuidanceFacts().ch13CommonState).toBe('offer-final-reference');
  });

  it('separates the far-reference offer from live occupancy', () => {
    const snapshot = commonGroundSnapshot();
    snapshot.common.stage = 'holding-h';
    snapshot.common.comparisonProved = true;

    standAt(CG_POSES.C);
    expect(commitCommonGroundFinalReferenceOffer()).toBe(false);

    standAt(CG_POSES.T);
    expect(commitCommonGroundFinalReferenceOffer()).toBe(true);
    expect(snapshot.common.finalReferenceOffered).toBe(true);
    expect(snapshot.common.finalReferenceOccupied).toBe(true);
    expect(commonGroundGuidanceFacts().ch13CommonState).toBe('release');

    // Stepping out of the release cylinder drops occupancy and keeps the offer.
    standAt({ x: CG_POSES.T.x + 4, y: CG_POSES.T.y, z: CG_POSES.T.z });
    tickCommonGround(0.05);
    expect(snapshot.common.finalReferenceOffered).toBe(true);
    expect(snapshot.common.finalReferenceOccupied).toBe(false);
    expect(commonGroundGuidanceFacts().ch13CommonState).toBe('reference-return');
  });

  it('holds his positioning leg rather than displacing a player standing on it', () => {
    standAt(CG_POSES.E);
    for (let frame = 0; frame < 200; frame += 1) tickCommonGround(0.05);
    // She is standing exactly where he is going. He waits; she is not moved.
    expect(commonGroundSnapshot().common.stage).toBe('positioning-to-h');
    expect(getCommonGroundActorState().held).toBe(true);
  });

  it('never commits completion without the earned reciprocal proof', () => {
    const snapshot = commonGroundSnapshot();
    snapshot.common.stage = 'testing';
    snapshot.common.finalReferenceOffered = true;
    standAt(CG_POSES.T);
    for (let frame = 0; frame < 600; frame += 1) tickCommonGround(0.05);
    // He can walk the whole span; without HER passage it proves nothing.
    expect(getCommonGroundActorState().travelled).toBeGreaterThan(0);
    expect(snapshot.common.committed).toBe(false);
    expect(hasMilestone(STORY_MILESTONES.ch13Complete)).toBe(false);
  });
});

describe('the survey holds, revises and resumes without replaying anything', () => {
  /** Offer a walked route by writing the slot the player would have drawn. */
  function offerRoute(route: readonly { x: number; y: number; z: number }[]): void {
    // One idle frame seats him at his actual inspection pose first, exactly as
    // a played run does; his approach then starts from a body, not from nowhere.
    tickCommonGround(0.016);
    const snapshot = commonGroundSnapshot();
    const slot = createTraceSlot({ ...route[0], corner: true });
    for (const point of route.slice(1)) {
      accumulateTraceDistance(slot, 2);
      appendTraceSample(slot, { ...point, corner: false });
    }
    slot.offeredEndIndex = slot.samples.length - 1;
    snapshot.survey.working = slot;
    snapshot.survey.phase = 'offered';
  }

  function run(frames: number, dt = 0.05): void {
    for (let frame = 0; frame < frames; frame += 1) tickCommonGround(dt);
  }

  beforeEach(() => enterCommonGroundBeat('ch13-survey'));

  it('earns nothing at all while the world is not mounted', () => {
    unbind?.();
    unbind = null;
    offerRoute(CG_ROUTE_LONG);
    standAt(CG_POSES.W);
    run(200);
    const snapshot = commonGroundSnapshot();
    // FAIL CLOSED: an absent query is not a pass.
    expect(snapshot.survey.working?.testedPrefixCount).toBe(0);
    expect(snapshot.survey.accepted).toBeNull();
    unbind = registerCommonGroundWorld({ worldId: '', footing: flatGround, extraSolids: [] });
  });

  it('completes the qualified long route on the first try, with no witness', () => {
    offerRoute(CG_ROUTE_LONG);
    standAt(CG_POSES.C);
    run(2000);
    const snapshot = commonGroundSnapshot();
    expect(snapshot.survey.accepted?.routeClass).toBe('fixed-reference');
    expect(snapshot.survey.accepted?.testedPrefixCount)
      .toBe(snapshot.survey.accepted?.samples.length);
    expect(hasMilestone(STORY_MILESTONES.ch13RouteTested)).toBe(true);
  });

  it('holds the short route where the housing actually shadows it, at his stop', () => {
    offerRoute(CG_ROUTE_SHORT);
    standAt(CG_POSES.C);
    run(400);
    const snapshot = commonGroundSnapshot();
    expect(snapshot.survey.phase).toBe('held');
    expect(snapshot.survey.hold.reason).toBe('reference-occluded-survey-housing');
    // He is standing where he actually stopped. On this route the housing
    // shadow starts one sample in, so his stop is the survey start itself —
    // he walked out to it and then could not be shown another step.
    expect(distanceFrom(commonGroundActorPosition(), CG_POSES.S)).toBeLessThan(0.5);
    expect(getCommonGroundActorState().permitted).toBe(0);
    expect(snapshot.survey.accepted).toBeNull();
  });

  it('resumes an edited suffix from his actual pose, never from the start', () => {
    offerRoute(CG_ROUTE_SHORT);
    standAt(CG_POSES.C);
    run(400);
    const snapshot = commonGroundSnapshot();
    const heldAt = { ...commonGroundActorPosition() };
    expect(snapshot.survey.approached).toBe(true);

    // Revise from his last tested point, then re-offer.
    const revisionPoint = lastTestedPoint(snapshot.survey.working)!;
    standAt(revisionPoint);
    expect(commitCommonGroundTailReopen()).toBe(true);
    const slot = snapshot.survey.working!;
    for (const point of [{ x: -30, y: 51.05, z: 16 }, { x: -30, y: 51.05, z: 18 }]) {
      accumulateTraceDistance(slot, 2);
      appendTraceSample(slot, { ...point, corner: true });
    }
    slot.offeredEndIndex = slot.samples.length - 1;
    snapshot.survey.phase = 'offered';

    tickCommonGround(0.016);
    // HE DID NOT GO BACK TO W AND HE DID NOT RESTART AT S.
    expect(snapshot.survey.approached).toBe(true);
    expect(distanceFrom(commonGroundActorPosition(), heldAt)).toBeLessThan(0.5);
    expect(distanceFrom(commonGroundActorPosition(), CG_POSES.W)).toBeGreaterThan(1);
    expect(slot.testedPrefixCount).toBeGreaterThan(0);
  });

  it('reaches every endpoint exactly, initially and again after a revision', () => {
    offerRoute(CG_ROUTE_LONG);
    standAt(CG_POSES.C);
    run(2000);
    const snapshot = commonGroundSnapshot();
    const end = CG_ROUTE_LONG[CG_ROUTE_LONG.length - 1];
    // He walked to the LAST point of the offered span, not to within a
    // forgiving radius of it.
    expect(distanceFrom(commonGroundActorPosition(), end)).toBeLessThan(1e-3);
    expect(snapshot.survey.accepted?.testedPrefixCount).toBe(CG_ROUTE_LONG.length);

    // Now a second, revised proposal, resumed from where he is standing.
    standAt(CG_POSES.S);
    expect(commitCommonGroundSurveyStart()).toBe(false); // still 'tested'
    snapshot.survey.phase = 'awaiting-start';
    expect(commitCommonGroundSurveyStart()).toBe(true);
    const slot = snapshot.survey.working!;
    for (const point of CG_ROUTE_LONG.slice(1)) {
      accumulateTraceDistance(slot, 2);
      appendTraceSample(slot, { ...point, corner: false });
    }
    slot.offeredEndIndex = slot.samples.length - 1;
    snapshot.survey.phase = 'offered';
    standAt(CG_POSES.C);
    run(4000);
    expect(distanceFrom(commonGroundActorPosition(), end)).toBeLessThan(1e-3);
    expect(snapshot.survey.accepted?.testedPrefixCount).toBe(CG_ROUTE_LONG.length);
  });

  it('accepts a held end at a qualified pose that is not the marked example', () => {
    offerRoute(CG_ROUTE_SHORT);
    // One unit off the qualified example, still off-route and still qualified.
    standAt({ x: CG_POSES.W.x - 1, y: CG_POSES.W.y, z: CG_POSES.W.z });
    run(400);
    expect(commitCommonGroundWitnessOffer()).toBe(true);
    const snapshot = commonGroundSnapshot();
    expect(snapshot.survey.witness?.pose.x).toBeCloseTo(CG_POSES.W.x - 1, 6);
    run(2000);
    expect(snapshot.survey.accepted?.routeClass).toBe('held-reference');
  });
});

describe('the final test is witnessed from her end and nowhere else', () => {
  beforeEach(() => enterCommonGroundBeat('ch13-common'));

  function primed() {
    const snapshot = commonGroundSnapshot();
    snapshot.common.stage = 'positioning-to-e';
    snapshot.common.comparisonProved = true;
    snapshot.common.terraUnits = 18;
    snapshot.common.finalReferenceOffered = true;
    return snapshot;
  }

  it('freezes his pose when she leaves, and never rewinds what he walked', () => {
    const snapshot = primed();
    standAt(CG_POSES.T);
    for (let frame = 0; frame < 120; frame += 1) tickCommonGround(0.05);
    const walked = getCommonGroundActorState().travelled;
    expect(walked).toBeGreaterThan(0);

    standAt({ x: CG_POSES.T.x + 6, y: CG_POSES.T.y, z: CG_POSES.T.z });
    for (let frame = 0; frame < 120; frame += 1) tickCommonGround(0.05);
    expect(snapshot.common.finalReferenceOccupied).toBe(false);
    // Held exactly where he was. Not rewound to an earlier supported prefix.
    expect(getCommonGroundActorState().travelled).toBeGreaterThanOrEqual(walked);
    expect(snapshot.common.committed).toBe(false);
  });

  it('resumes on reentry without another F, and commits only at the full span', () => {
    const snapshot = primed();
    standAt(CG_POSES.T);
    for (let frame = 0; frame < 40; frame += 1) tickCommonGround(0.05);
    standAt({ x: CG_POSES.T.x + 6, y: CG_POSES.T.y, z: CG_POSES.T.z });
    for (let frame = 0; frame < 40; frame += 1) tickCommonGround(0.05);
    expect(snapshot.common.committed).toBe(false);

    standAt(CG_POSES.T);
    // No second offer is made, and no input is consumed.
    for (let frame = 0; frame < 2000; frame += 1) tickCommonGround(0.05);
    expect(snapshot.common.workerUnits).toBeCloseTo(CG_COMMON_ROUTE_UNITS, 4);
    expect(snapshot.common.committed).toBe(true);
    expect(hasMilestone(STORY_MILESTONES.ch13Complete)).toBe(true);
  });

  it('does not commit a hair short of the full eighteen units', () => {
    const snapshot = primed();
    standAt(CG_POSES.T);
    // Stop the clock while he is inside the last third of a unit.
    let frames = 0;
    while (frames < 4000 && getCommonGroundActorState().travelled < CG_COMMON_ROUTE_UNITS - 0.3) {
      tickCommonGround(0.01);
      frames += 1;
    }
    expect(getCommonGroundActorState().travelled).toBeLessThan(CG_COMMON_ROUTE_UNITS);
    expect(snapshot.common.committed).toBe(false);
    expect(hasMilestone(STORY_MILESTONES.ch13Complete)).toBe(false);
  });
});

describe('Continue resumes a body, not a checkpoint', () => {
  /** A complete, tested route, exactly as an accepted slot must look. */
  function acceptedRoute() {
    const slot = createTraceSlot({ ...CG_ROUTE_LONG[0], corner: true });
    for (const point of CG_ROUTE_LONG.slice(1)) {
      accumulateTraceDistance(slot, 2);
      appendTraceSample(slot, { ...point, corner: false });
    }
    markTestedPrefix(slot, slot.samples.length);
    slot.routeClass = 'fixed-reference';
    return slot;
  }

  function saveAndReload(): void {
    const snapshot = commonGroundSnapshot();
    const worldId = snapshot.worldId;
    const written = serializeCommonGroundForWorld(worldId);
    clearAllCommonGroundWorlds();
    resetCommonGroundActor();
    stageCommonGroundWorldPayload(worldId, written);
    commonGroundSnapshot(worldId);
  }

  it('resumes a fractional survey leg where his body actually was', () => {
    enterCommonGroundBeat('ch13-survey');
    tickCommonGround(0.016);
    const snapshot = commonGroundSnapshot();
    const slot = createTraceSlot({ ...CG_ROUTE_LONG[0], corner: true });
    for (const point of CG_ROUTE_LONG.slice(1)) {
      accumulateTraceDistance(slot, 2);
      appendTraceSample(slot, { ...point, corner: false });
    }
    slot.offeredEndIndex = slot.samples.length - 1;
    snapshot.survey.working = slot;
    snapshot.survey.phase = 'offered';
    standAt(CG_POSES.C);
    for (let frame = 0; frame < 120; frame += 1) tickCommonGround(0.05);
    const before = { ...commonGroundActorPosition() };
    const testedBefore = snapshot.survey.working!.testedPrefixCount;
    expect(distanceFrom(before, CG_POSES.W)).toBeGreaterThan(1);

    saveAndReload();
    const restored = commonGroundSnapshot();
    // He is standing where he was, not back at his inspection pose or at S.
    expect(distanceFrom(commonGroundActorPosition(), before)).toBeLessThan(0.01);
    expect(restored.survey.approached).toBe(true);
    expect(restored.survey.working?.testedPrefixCount).toBe(testedBefore);
    // And one frame later he continues rather than restarting.
    tickCommonGround(0.05);
    expect(distanceFrom(commonGroundActorPosition(), before)).toBeLessThan(0.5);
  });

  it('resumes the uncredited E-to-H leg without re-walking it', () => {
    enterCommonGroundBeat('ch13-common');
    const snapshot = commonGroundSnapshot();
    snapshot.survey.accepted = acceptedRoute();
    standAt({ x: CG_POSES.E.x, y: CG_POSES.E.y, z: CG_POSES.E.z - 3 });
    for (let frame = 0; frame < 8; frame += 1) tickCommonGround(0.05);
    const before = { ...commonGroundActorPosition() };
    expect(distanceFrom(before, CG_POSES.E)).toBeGreaterThan(0.1);
    expect(distanceFrom(before, CG_POSES.H)).toBeGreaterThan(0.1);

    saveAndReload();
    expect(commonGroundSnapshot().common.stage).toBe('positioning-to-h');
    expect(distanceFrom(commonGroundActorPosition(), before)).toBeLessThan(0.01);
    tickCommonGround(0.05);
    // Forward from where he was, never back to E.
    expect(distanceFrom(commonGroundActorPosition(), CG_POSES.H))
      .toBeLessThan(distanceFrom(before, CG_POSES.H) + 1e-6);
  });

  it('resumes the final E-to-C test at the units he actually walked', () => {
    enterCommonGroundBeat('ch13-common');
    const snapshot = commonGroundSnapshot();
    snapshot.survey.accepted = acceptedRoute();
    snapshot.common.stage = 'positioning-to-e';
    snapshot.common.comparisonProved = true;
    snapshot.common.terraUnits = CG_COMMON_ROUTE_UNITS;
    snapshot.common.finalReferenceOffered = true;
    standAt(CG_POSES.T);
    for (let frame = 0; frame < 60; frame += 1) tickCommonGround(0.05);
    const walked = snapshot.common.workerUnits;
    expect(walked).toBeGreaterThan(1);
    expect(walked).toBeLessThan(CG_COMMON_ROUTE_UNITS);

    saveAndReload();
    const restored = commonGroundSnapshot();
    expect(restored.common.stage).toBe('testing');
    expect(restored.common.workerUnits).toBeCloseTo(walked, 6);
    standAt(CG_POSES.T);
    tickCommonGround(0.05);
    // He continues from there; the walk is not given back by a reload.
    expect(getCommonGroundActorState().travelled).toBeGreaterThanOrEqual(walked - 1e-6);
    for (let frame = 0; frame < 2000; frame += 1) tickCommonGround(0.05);
    expect(restored.common.workerUnits).toBeCloseTo(CG_COMMON_ROUTE_UNITS, 4);
    expect(restored.common.committed).toBe(true);
  });
});

describe('every published rung has a marker, a work order and one entry', () => {
  const rungs = [
    ['ch13-home', 'ch13HomeState', ['review', 'choose-return']],
    ['ch13-return', 'ch13ReturnState', ['board', 'launch', 'origin']],
    ['ch13-survey', 'ch13SurveyState',
      ['offer', 'start', 'draw', 'offer-span', 'test-preparing', 'test', 'revise', 'witness', 'witness-return']],
    ['ch13-common', 'ch13CommonState',
      ['reciprocal-preparing', 'reciprocal', 'offer-final-reference', 'release', 'reference-return']]
  ] as const;

  it('resolves an actionable standing work order for every state of every beat', () => {
    const seen = new Set<string>();
    for (const [beat, factKey, states] of rungs) {
      for (const state of states) {
        const objective = resolveStoryObjectiveGuidance(beat, { [factKey]: state });
        expect(objective, `${beat}:${state}`).not.toBeNull();
        expect(objective!.workOrder.length, `${beat}:${state}`).toBeGreaterThan(0);
        expect(objective!.workOrder.every(line => line.trim().length > 0)).toBe(true);
        expect(objective!.markerLabel.trim().length).toBeGreaterThan(0);
        seen.add(objective!.id);
      }
    }
    // Exactly the seventeen signed rung ids, and no eighteenth.
    expect([...seen].sort()).toEqual([
      'ch13:common:offer-final-reference',
      'ch13:common:reciprocal',
      'ch13:common:reference-return',
      'ch13:common:release',
      'ch13:home:choose-return',
      'ch13:home:review',
      'ch13:return:board',
      'ch13:return:launch',
      'ch13:return:origin',
      'ch13:survey:draw',
      'ch13:survey:offer',
      'ch13:survey:offer-span',
      'ch13:survey:revise',
      'ch13:survey:start',
      'ch13:survey:test',
      'ch13:survey:witness',
      'ch13:survey:witness-return'
    ]);
  });

  it('declares no world target for the control-only launch rung, and one for the rest', () => {
    const launch = resolveStoryObjectiveGuidance('ch13-return', { ch13ReturnState: 'launch' })!;
    expect(launch.requiresMarker).toBe(false);
    expect(launch.workOrder).toEqual(['Hold [Space] to ignite and lift.']);
    expect(commonGroundMarkerTarget('ch13:return:launch')).toBeNull();

    for (const id of [
      'ch13:survey:start', 'ch13:survey:draw', 'ch13:survey:witness',
      'ch13:common:reciprocal', 'ch13:common:release'
    ]) {
      expect(commonGroundMarkerTarget(id), id).not.toBeNull();
    }
  });

  it('keeps the same id and marker label when a preparation rung becomes true', () => {
    const preparing = resolveStoryObjectiveGuidance('ch13-survey', { ch13SurveyState: 'test-preparing' })!;
    const testing = resolveStoryObjectiveGuidance('ch13-survey', { ch13SurveyState: 'test' })!;
    expect(preparing.id).toBe(testing.id);
    expect(preparing.markerLabel).toBe(testing.markerLabel);
    expect(preparing.workOrder).not.toEqual(testing.workOrder);
    // Neither claims he is testing before he is.
    expect(preparing.workOrder[0]).not.toContain('is testing');
    expect(testing.workOrder[0]).toContain('is testing');
  });

  it('carries the exact literal cause only when a hold actually exists', () => {
    const voluntary = resolveStoryObjectiveGuidance('ch13-survey', { ch13SurveyState: 'revise' })!;
    expect(voluntary.workOrder).toHaveLength(2);
    const refused = resolveStoryObjectiveGuidance('ch13-survey', {
      ch13SurveyState: 'revise',
      ch13HoldReason: 'reference-occluded-survey-housing'
    })!;
    expect(refused.workOrder).toHaveLength(3);
    expect(refused.workOrder[2]).toBe('REFERENCE OCCLUDED · SURVEY HOUSING');
  });
});

describe('persistence and the world boundary', () => {
  it('round-trips an unfinished proposal through the world save', () => {
    enterCommonGroundBeat('ch13-survey');
    tickCommonGround(0.016);
    const snapshot = commonGroundSnapshot();
    const slot = createTraceSlot({ ...CG_ROUTE_LONG[0], corner: true });
    for (const point of CG_ROUTE_LONG.slice(1, 5)) {
      accumulateTraceDistance(slot, 2);
      appendTraceSample(slot, { ...point, corner: false });
    }
    markTestedPrefix(slot, 2);
    slot.offeredEndIndex = slot.samples.length - 1;
    snapshot.survey.working = slot;
    snapshot.survey.approached = true;
    snapshot.survey.phase = 'offered';

    const worldId = snapshot.worldId;
    const written = serializeCommonGroundForWorld(worldId);
    expect(written).not.toBeNull();

    clearAllCommonGroundWorlds();
    stageCommonGroundWorldPayload(worldId, written);
    const restored = commonGroundSnapshot();
    expect(restored.hydrated).toBe(true);
    expect(restored.survey.working?.samples.length).toBe(5);
    expect(restored.survey.working?.testedPrefixCount).toBe(2);
    expect(restored.survey.approached).toBe(true);
  });

  it('keeps one world chapter record out of another world record', () => {
    enterCommonGroundBeat('ch13-home');
    commonGroundSnapshot('world-a').home.faultReviewed = true;
    expect(commonGroundSnapshot('world-b').home.faultReviewed).toBe(false);
    // And a payload written for one world never hydrates into the other.
    const written = serializeCommonGroundForWorld('world-a');
    stageCommonGroundWorldPayload('world-b', written);
    clearCommonGroundWorld('world-b');
    stageCommonGroundWorldPayload('world-b', written);
    expect(commonGroundSnapshot('world-b').home.faultReviewed).toBe(false);
  });
});

describe('the rail presses what the player is offered', () => {
  it('never names an action outside the chapter', () => {
    enterCommonGroundBeat(null);
    expect(commonGroundRailPlan()).toMatchObject({ action: 'hold', interactionId: null });
  });

  it('walks to the core and then performs the rung that is actually live', () => {
    enterCommonGroundBeat('ch13-home');
    // No habitat core is mounted in this fixture, so the rail reports honestly
    // rather than inventing a coordinate to walk to.
    expect(commonGroundRailPlan()).toMatchObject({ action: 'hold' });
    expect(commonGroundRailPlan().reason).toContain('core');
  });

  it('offers the demonstration only from within reach of his actual body', () => {
    enterCommonGroundBeat('ch13-survey');
    standAt(CG_POSES.C);
    tickCommonGround(0.016); // he takes his inspection pose at W
    expect(commonGroundRailPlan()).toMatchObject({ action: 'walk' });
    standAt(CG_POSES.W);
    expect(commonGroundRailPlan()).toMatchObject({
      action: 'interact',
      interactionId: 'story-ch13-offer-route'
    });
  });

  it('reports a meaningful reason on every plan it produces', () => {
    enterCommonGroundBeat('ch13-common');
    markMilestone(STORY_MILESTONES.ch13RouteTested);
    standAt(CG_POSES.E);
    const plan = commonGroundRailPlan();
    expect(plan.reason.length).toBeGreaterThan(0);
    expect(['walk', 'interact', 'hold']).toContain(plan.action);
  });
});
