import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The one seam a node test cannot supply: a real audio output. Everything else
// about eligibility — the completion edge, the settings mute, the cancellations
// — is the production code path.
const output = vi.hoisted(() => ({ state: 'running' as string | null }));
vi.mock('../audio/audioCore.ts', async importOriginal => {
  const actual = await importOriginal<typeof import('../audio/audioCore.ts')>();
  return {
    ...actual,
    isMusicMuted: () => false,
    peekAudioContext: () => (output.state === null ? null : { state: output.state })
  };
});
import * as THREE from 'three';
import { resetProgression, hasMilestone, markMilestone } from '../game/systems/progressionSystem.ts';
import { setPlayerWorldPosition } from '../state/playerFrame.ts';
import { STORY_MILESTONES, completeChapter13 } from './storyState.ts';
import {
  acceptTestedRoute,
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
  commitCommonGroundRepeatSurvey,
  commonGroundGuidanceFacts,
  getCommonGroundDiagnostic,
  noteCommonGroundRevisionReady,
  tickCommonGroundFreePlay,
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
  resetCommonGroundActor,
  seedCommonGroundActorPose
} from './commonGroundActor.ts';
import {
  commonGroundMood,
  getCommonGroundScoreDiagnostic,
  resetCommonGroundScoreRuntime,
  setCommonGroundMood
} from './commonGroundScore.ts';
import { getStoryScoreMood, resetStoryScoreRuntime } from './storyScore.ts';
import { setMusicMuted, setMusicVolume } from '../audio/audioSettings.ts';
import {
  resetSystemFlightForInterstellarArrival,
  resetSystemFlightStoreForTests
} from '../state/systemFlight.ts';
import { STORY_COORDINATE } from './world/storyWorldIdentity.ts';
import { STORY_PRIMARY_WORLD_ID } from './tidegardenRoute.ts';

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

// --- the preparing copy tells the truth while his body is still short of the span -----

describe('the survey work order never claims a test that has not started', () => {
  function offer(route: readonly { x: number; y: number; z: number }[]): void {
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

  beforeEach(() => enterCommonGroundBeat('ch13-survey'));

  it('says PREPARING while he walks out, and only then says testing', () => {
    offer(CG_ROUTE_LONG);
    standAt(CG_POSES.C);
    tickCommonGround(0.05);
    expect(commonGroundSnapshot().survey.approached).toBe(false);
    expect(commonGroundGuidanceFacts().ch13SurveyState).toBe('test-preparing');
    for (let frame = 0; frame < 400; frame += 1) tickCommonGround(0.05);
    expect(commonGroundSnapshot().survey.approached).toBe(true);
    expect(commonGroundGuidanceFacts().ch13SurveyState).not.toBe('test-preparing');
  });

  it('KEEPS the preparing copy through a body-clearance suspension of the approach', () => {
    offer(CG_ROUTE_LONG);
    // She stands on the ground he has to cross to reach the offered start. He
    // waits; she is never pushed or teleported.
    standAt(CG_POSES.S);
    for (let frame = 0; frame < 60; frame += 1) tickCommonGround(0.05);
    const snapshot = commonGroundSnapshot();
    expect(snapshot.survey.approached).toBe(false);
    expect(snapshot.survey.hold.reason).toBe('body-clearance');
    // "is walking" would be false here; "is preparing to test" is still true.
    expect(commonGroundGuidanceFacts().ch13SurveyState).toBe('test-preparing');
    const objective = resolveStoryObjectiveGuidance('ch13-survey', commonGroundGuidanceFacts());
    expect(objective?.workOrder).toEqual([
      'W-7744 is preparing to test the offered route.',
      'Keep his approach clear. Follow his progress, or return to the last tested point to revise.'
    ]);

    // She moves. It recovers with no extra input, no new [F] and no proof.
    standAt({ x: CG_POSES.S.x, y: CG_POSES.S.y, z: CG_POSES.S.z + 6 });
    for (let frame = 0; frame < 400; frame += 1) tickCommonGround(0.05);
    expect(commonGroundSnapshot().survey.approached).toBe(true);
  });

  it('uses the neutral offered-route label in BOTH states, under one id', () => {
    const preparing = resolveStoryObjectiveGuidance('ch13-survey', {
      ...commonGroundGuidanceFacts(), ch13SurveyState: 'test-preparing'
    });
    const testing = resolveStoryObjectiveGuidance('ch13-survey', {
      ...commonGroundGuidanceFacts(), ch13SurveyState: 'test'
    });
    expect(preparing?.id).toBe('ch13:survey:test');
    expect(testing?.id).toBe('ch13:survey:test');
    expect(preparing?.markerLabel).toBe('W-7744 \u00b7 offered route');
    expect(testing?.markerLabel).toBe(preparing?.markerLabel);
    // The old label asserted progress the preparing state does not have.
    expect(preparing?.markerLabel).not.toContain('test in progress');
    expect(testing?.workOrder).toEqual([
      'W-7744 is testing the offered route.',
      'Follow his progress, or return to the last tested point to revise.'
    ]);
  });
});

// --- the score changes when the argument changes, and not otherwise ------------------

describe('the chapter score retains, releases, and never scores a menu', () => {
  beforeEach(() => {
    resetCommonGroundScoreRuntime();
    resetStoryScoreRuntime();
  });

  function currentMood() {
    return getCommonGroundScoreDiagnostic().mood;
  }

  it('RETAINS whatever is current through readiness, reopening and suspension', () => {
    enterCommonGroundBeat('ch13-survey');
    // Reach a real refusal, so the current variant is genuinely `refused-hold`
    // rather than the one a mapped table would have chosen next.
    tickCommonGround(0.016);
    const snapshot = commonGroundSnapshot();
    const slot = createTraceSlot({ ...CG_ROUTE_SHORT[0], corner: true });
    for (const point of CG_ROUTE_SHORT.slice(1)) {
      accumulateTraceDistance(slot, 2);
      appendTraceSample(slot, { ...point, corner: false });
    }
    slot.offeredEndIndex = slot.samples.length - 1;
    snapshot.survey.working = slot;
    snapshot.survey.phase = 'offered';
    standAt(CG_POSES.C);
    for (let frame = 0; frame < 400; frame += 1) tickCommonGround(0.05);
    expect(snapshot.survey.hold.reason).toBe('reference-occluded-survey-housing');
    expect(currentMood()).toBe('refused-hold');

    // Voluntary revision readiness is a MENU STATE. It is not a change of
    // musical situation, and a mapped `demonstrating` here would be exactly the
    // convenient variant the lane forbids.
    expect(noteCommonGroundRevisionReady()).toBe(true);
    expect(currentMood()).toBe('refused-hold');

    // Nor is picking up the pencil.
    standAt(lastTestedPoint(slot)!);
    expect(commitCommonGroundTailReopen()).toBe(true);
    // The tail actually changed, so `revised` is a REAL cue and does publish.
    expect(currentMood()).toBe('revised');
  });

  it('never lets a witness stepping out or back in reselect a mood', () => {
    enterCommonGroundBeat('ch13-survey');
    setCommonGroundMood('ch13-survey', 'revised');
    const snapshot = commonGroundSnapshot();
    snapshot.survey.witness = {
      pose: { ...CG_POSES.W }, offered: true, occupied: true, requiredFromIndex: 1
    };
    const slot = createTraceSlot({ ...CG_ROUTE_SHORT[0], corner: true });
    for (const point of CG_ROUTE_SHORT.slice(1)) {
      accumulateTraceDistance(slot, 2);
      appendTraceSample(slot, { ...point, corner: false });
    }
    slot.offeredEndIndex = slot.samples.length - 1;
    snapshot.survey.working = slot;
    snapshot.survey.phase = 'offered';
    snapshot.survey.approached = true;
    // She walks away from the witness point, then back.
    standAt(CG_POSES.C);
    for (let frame = 0; frame < 40; frame += 1) tickCommonGround(0.05);
    expect(currentMood()).toBe('revised');
    standAt(CG_POSES.W);
    for (let frame = 0; frame < 40; frame += 1) tickCommonGround(0.05);
    expect(currentMood()).toBe('revised');
  });

  it('RELEASES at the return choice, and scores none of the travel after it', () => {
    enterCommonGroundBeat('ch13-home');
    tickCommonGround(0.016);
    expect(currentMood()).toBe('restored-home');
    expect(commitCommonGroundFaultReview()).toBe(true);
    expect(commitCommonGroundReturnChoice()).toBe(true);
    // Released to the world conductor: no beat selected, no override held.
    const diagnostic = getCommonGroundScoreDiagnostic();
    expect(diagnostic.beat).toBeNull();
    expect(diagnostic.mood).toBeNull();
    expect(getStoryScoreMood('ch13-home')).toBeNull();

    // And the hatch, the lift and the landing do not put the hearth back on.
    enterCommonGroundBeat('ch13-return');
    for (let frame = 0; frame < 20; frame += 1) tickCommonGround(0.05);
    expect(getCommonGroundScoreDiagnostic().mood).not.toBe('restored-home');
  });
});

// --- the completion texture has ONE door, and it stays honest for five seconds -------

describe('the completion texture cannot be earned by anything but a live completion', () => {
  beforeEach(() => {
    resetCommonGroundScoreRuntime();
    resetStoryScoreRuntime();
    output.state = 'running';
    setMusicMuted(false);
    setMusicVolume(0.8);
    enterCommonGroundBeat('ch13-common');
  });

  afterEach(() => {
    output.state = 'running';
    setMusicMuted(false);
    setMusicVolume(0.8);
  });

  function completeTheChapter() {
    const snapshot = commonGroundSnapshot();
    // His body is where the chapter left it: at the reference he held while she
    // walked her eighteen units.
    seedCommonGroundActorPose(CG_POSES.H);
    snapshot.common.workerPose = { ...CG_POSES.H };
    snapshot.common.stage = 'positioning-to-e';
    snapshot.common.comparisonProved = true;
    snapshot.common.terraUnits = CG_COMMON_ROUTE_UNITS;
    snapshot.common.finalReferenceOffered = true;
    standAt(CG_POSES.T);
    for (let frame = 0; frame < 2000 && !snapshot.common.committed; frame += 1) {
      tickCommonGround(0.05);
    }
    expect(snapshot.common.committed).toBe(true);
    return snapshot;
  }

  it('opens on a real completion and publishes the settled mood once', () => {
    completeTheChapter();
    expect(getCommonGroundScoreDiagnostic().mood).toBe('independent-action-settled');
    expect(getCommonGroundScoreDiagnostic().finalTextureSeconds).not.toBeNull();
  });

  it('refuses at an unavailable output, and the HANDBACK cannot smuggle it in', () => {
    // Both `anc.cg.complete` and `anc.cg.handback` bind the same settled cue.
    // The second must not become a second door into it.
    output.state = 'suspended';
    completeTheChapter();
    const diagnostic = getCommonGroundScoreDiagnostic();
    expect(diagnostic.finalTextureSeconds).toBeNull();
    expect(diagnostic.mood).not.toBe('independent-action-settled');
    // The handback fires in the same frame as the completion and binds the same
    // cue; the settled texture must not reach the facade through it.
    expect(getStoryScoreMood('ch13-common'))
      .not.toEqual(commonGroundMood('independent-action-settled'));
  });

  it('refuses when the player has muted the music at that exact edge', () => {
    setMusicMuted(true);
    completeTheChapter();
    expect(getCommonGroundScoreDiagnostic().finalTextureSeconds).toBeNull();
    // And it is not queued for a later unlock: unmuting afterwards earns nothing.
    setMusicMuted(false);
    for (let frame = 0; frame < 60; frame += 1) tickCommonGround(0.05);
    expect(getCommonGroundScoreDiagnostic().finalTextureSeconds).toBeNull();
  });

  it('CANCELS mid-token when the output goes away, and never re-arms', () => {
    completeTheChapter();
    expect(getCommonGroundScoreDiagnostic().finalTextureSeconds).not.toBeNull();
    // Availability is not a question asked once. She mutes two seconds in.
    setMusicMuted(true);
    tickCommonGround(0.05);
    expect(getCommonGroundScoreDiagnostic().finalTextureSeconds).toBeNull();
    setMusicMuted(false);
    for (let frame = 0; frame < 60; frame += 1) tickCommonGround(0.05);
    expect(getCommonGroundScoreDiagnostic().finalTextureSeconds).toBeNull();
  });

  it('cancels on a suspended context mid-token too', () => {
    completeTheChapter();
    output.state = 'suspended';
    tickCommonGround(0.05);
    expect(getCommonGroundScoreDiagnostic().finalTextureSeconds).toBeNull();
  });

  it('gives a completed restore no texture at all', () => {
    resetCommonGroundRuntime({ clearWorlds: true });
    markMilestone(STORY_MILESTONES.ch13Complete);
    enterCommonGroundBeat('ch13-common');
    completeTheChapter();
    expect(getCommonGroundScoreDiagnostic().finalTextureSeconds).toBeNull();
  });
});

// --- he stays, and the accepted route stays with him ---------------------------------

describe('the completed site keeps a local tester and an optional repeat', () => {
  /** An accepted, fully tested route, exactly as the survey leaves one. */
  function acceptRoute() {
    const snapshot = commonGroundSnapshot();
    const slot = createTraceSlot({ ...CG_ROUTE_LONG[0], corner: true });
    for (const point of CG_ROUTE_LONG.slice(1)) {
      accumulateTraceDistance(slot, 2);
      appendTraceSample(slot, { ...point, corner: false });
    }
    slot.offeredEndIndex = slot.samples.length - 1;
    markTestedPrefix(slot, slot.samples.length);
    snapshot.survey.working = slot;
    acceptTestedRoute(snapshot, 'held-reference');
    return snapshot;
  }

  beforeEach(() => {
    // The persistent tester is Origin-scoped: he stayed at the audit site, so
    // the flight state has to actually be AT Origin, in Origin's system.
    resetSystemFlightForInterstellarArrival({
      system: STORY_COORDINATE,
      activePlanetId: STORY_PRIMARY_WORLD_ID,
      locationMode: 'surface',
      pose: { position: [0, 0, 0], velocity: [0, 0, 0], quaternion: [0, 0, 0, 1] }
    });
    enterCommonGroundBeat('ch13-survey');
    tickCommonGround(0.016);
  });

  afterEach(() => {
    resetSystemFlightStoreForTests();
  });

  it('keeps him present and offers a repeat AFTER the chapter has been handed back', () => {
    const snapshot = acceptRoute();
    // The real handback: the chapter completes and the world is the player's.
    completeChapter13();
    snapshot.common.committed = true;
    // The chapter is over: no beat owns the frame any more.
    enterCommonGroundBeat(null);
    for (let frame = 0; frame < 10; frame += 1) tickCommonGroundFreePlay(0.05);
    expect(getCommonGroundDiagnostic().beat).toBeNull();
    // He is not hidden with his beat, and he has ONE pose authority.
    expect(getCommonGroundActorState()).toBeDefined();
    expect(commitCommonGroundRepeatSurvey()).toBe(true);
  });

  it('a repeat reuses the working slot and NEVER spends the accepted proof', () => {
    const snapshot = acceptRoute();
    completeChapter13();
    snapshot.common.committed = true;
    const acceptedSamples = snapshot.survey.accepted?.samples.length ?? 0;
    expect(acceptedSamples).toBeGreaterThan(0);
    enterCommonGroundBeat(null);
    for (let frame = 0; frame < 10; frame += 1) tickCommonGroundFreePlay(0.05);

    expect(commitCommonGroundRepeatSurvey()).toBe(true);
    expect(snapshot.survey.phase).toBe('idle');
    // The earned route and the class it earned are untouched by the next attempt.
    expect(snapshot.survey.accepted?.samples.length).toBe(acceptedSamples);
    expect(snapshot.survey.accepted?.routeClass).toBe('held-reference');
    expect(snapshot.survey.working).toBeNull();

    // The player begins a second proposal. The working slot is what fills.
    expect(commitCommonGroundDemonstrationOffer()).toBe(true);
    standAt(CG_POSES.S);
    expect(commitCommonGroundSurveyStart()).toBe(true);
    expect(snapshot.survey.working?.samples.length).toBe(1);
    expect(snapshot.survey.accepted?.samples.length).toBe(acceptedSamples);
    // And the completed comparison remains the earned one, not a redrawn one.
    expect(snapshot.common.committed).toBe(true);
  });

  it('an optional repeat cancels the completion texture rather than replaying it', () => {
    const snapshot = acceptRoute();
    completeChapter13();
    snapshot.common.committed = true;
    enterCommonGroundBeat(null);
    for (let frame = 0; frame < 10; frame += 1) tickCommonGroundFreePlay(0.05);
    resetCommonGroundScoreRuntime();
    expect(commitCommonGroundRepeatSurvey()).toBe(true);
    expect(getCommonGroundScoreDiagnostic().finalTextureSeconds).toBeNull();
  });
});
