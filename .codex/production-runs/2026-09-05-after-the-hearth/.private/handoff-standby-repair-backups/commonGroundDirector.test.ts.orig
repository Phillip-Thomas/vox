import { readFileSync } from 'node:fs';
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
import { commitHabitatCorePlacement, resetHabitats } from '../game/systems/habitatSystem.ts';
import {
  getPlayerUp,
  getPlayerWorldPosition,
  setPlayerUp,
  setPlayerWorldPosition
} from '../state/playerFrame.ts';
import { resolveStoryInteraction } from './storyInteractions.ts';
import {
  enterShip,
  exitShip,
  getSpaceFlightSnapshot,
  resetTravel
} from '../state/spaceFlight.ts';
import {
  activateSignedSceneAnchorById,
  enterSignedSceneAvBeat,
  getSignedSceneAvDebugSnapshot,
  resetSignedSceneAvRuntime
} from './signedSceneAvRuntime.ts';
// The REAL shared gait, not a chord: the rail's arrival radii and the walker's
// stop radius have to be the same measurement or the movie stalls on the mark.
import { surfaceGaitDistance } from './autopilot/primitives.ts';
import {
  STORY_MILESTONES,
  completeChapter13,
  completeStory,
  storyEntryPoint
} from './storyState.ts';
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
  TRACE_SAMPLE_SPACING_UNITS,
  clearCommonGroundWorld,
  isPristineCommonGround,
  lastTestedPoint,
  serializeCommonGroundForWorld,
  stageCommonGroundWorldPayload
} from './commonGroundState.ts';
import {
  CG_FIXED_SOCKET,
  checkReference,
  playerSocket,
  type CommonGroundFooting
} from './commonGroundRoute.ts';
import {
  applyCommonGroundRail,
  CG_PLAYER_GROUND_OFFSET,
  getCommonGroundProbeSnapshot,
  commonGroundPlayerPose,
  type CommonGroundRailContext,
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
  suspendCommonGroundPresentation,
  tickCommonGround,
  tickCommonGroundEntry
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
import { STORY_PRIMARY_WORLD_ID, TIDEGARDEN_WORLD_ID } from './tidegardenRoute.ts';
import {
  clearCommonGroundForWorld,
  clearWorldStateForWorld,
  restoreCommonGroundForWorld,
  saveWorld
} from '../game/systems/persistence.ts';
import { STORY_SEED } from './world/storyWorldIdentity.ts';

const flatGround: CommonGroundFooting = {
  revision: 'test',
  isSupported: point => Math.abs(point.y - 51.05) < 0.001
};

/**
 * Stand a REAL BODY on a pose.
 *
 * `setPlayerWorldPosition` publishes the Rapier capsule's CENTRE, and the
 * chapter's poses are grounded body origins. The earlier helper wrote the
 * authored y straight into the body — a body of zero height — so every rail,
 * footing, occupancy and socket assertion in this file ran at vertical offset 0
 * and the whole suite was blind to the live 1.8-unit capsule (VF-RAIL-2). Tests
 * now place the centre where the physics actually puts it, along the live up.
 */
function standAt(point: { x: number; y: number; z: number }): void {
  const up = getPlayerUp();
  setPlayerWorldPosition(new THREE.Vector3(
    point.x + up.x * CG_PLAYER_GROUND_OFFSET,
    point.y + up.y * CG_PLAYER_GROUND_OFFSET,
    point.z + up.z * CG_PLAYER_GROUND_OFFSET
  ));
}

/** Raw capsule-centre placement, for the seam's own regressions only. */
function standCapsuleCentreAt(point: { x: number; y: number; z: number }): void {
  setPlayerWorldPosition(new THREE.Vector3(point.x, point.y, point.z));
}

function distanceFrom(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number }
): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

let unbind: (() => void) | null = null;

/**
 * localStorage is absent in the vitest node env, and a Continue regression that
 * skipped the real WorldSave round-trip would prove nothing about it.
 */
class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
  key() { return null; }
  get length() { return this.m.size; }
}

function installMemStorage(): void {
  (globalThis as unknown as { localStorage: MemStorage }).localStorage = new MemStorage();
}

beforeEach(() => {
  // The published up is a module singleton; a face test must not leak into the
  // next case's coordinate frame.
  setPlayerUp(new THREE.Vector3(0, 1, 0));
  resetProgression();
  resetHabitats();
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

// --- the screening rail is an ordinary body on ordinary controls ----------------------
//
// CG-IMPL-004 and CG-IMPL-005. Both defects were invisible to a spy that always
// succeeds and to a stub body that teleports onto every emitted goal, so this
// harness refuses to be either one:
//
//   * the performer here is the REAL shared performer's algorithm — cadence
//     first, then the LIVE resolver, then the dwell, then the act — over the
//     real registered ch13 resolvers. A rail that spends the dwell before
//     asking starves exactly as the hardware movie did.
//   * the body here walks. It moves a bounded step per frame toward the emitted
//     goal and stops inside the requested radius, so a plan that stops short of
//     a pose, or cuts the corners of a measured span, fails here too.
//
// Nothing in this block relaxes a predicate: every unit of the comparison is
// credited by the production `routeProgressUnits` from the body's own
// displacement, and every act is the one the live resolver was offering.

/** `SCREENING_ACTION_DWELL_SECONDS` in `autopilot/primitives.ts`. */
const SCREENING_DWELL_SECONDS = 0.85;
/** An ordinary walking pace, in units per second. */
const RAIL_WALK_SPEED = 4.5;
/** The authored grounded plane every ch13 pose sits on. */
const GROUND_PLANE_Y = CG_POSES.S.y;

interface RailAct {
  readonly id: string;
  readonly at: number;
}

function createRailHarness(dt: number) {
  const acts: RailAct[] = [];
  const goals: (readonly [number, number, number])[] = [];
  let clock = 0;
  let lastActionAt = -10;
  let pathUnits = 0;
  let maxStep = 0;

  /** The shared performer's ACTUAL order of operations. */
  function performStoryInteraction(id: string): boolean {
    if (clock - lastActionAt < SCREENING_DWELL_SECONDS) return false;
    const interaction = resolveStoryInteraction(null, getPlayerWorldPosition());
    if (!interaction || interaction.id !== id) return false;
    lastActionAt = clock;
    interaction.perform();
    acts.push({ id, at: clock });
    return true;
  }

  const ctx = {
    controls: { forward: false, jump: false, sprint: false, interact: false },
    _goalScratch: new THREE.Vector3(),
    clearControls: () => {
      ctx.controls.forward = false;
      ctx.controls.jump = false;
      ctx.controls.sprint = false;
      ctx.controls.interact = false;
    },
    /**
     * Faithful to the shared walker AND to the body it walks.
     *
     * Two things the earlier stub got wrong, and VF-RAIL-2 is what they cost.
     * It measured a straight 3D chord where `walkToward` measures
     * `surfaceGaitDistance` — tangential range in the walker's own gravity
     * frame, plus only the rise/drop it cannot step — and it LERPED the body at
     * the goal in three dimensions, which quietly sank the capsule centre onto
     * a ground-authored pose and produced a body of zero height. The real body
     * is a capsule whose centre rests one standing offset above the surface it
     * is on; gravity owns that axis and the walk owns the tangent.
     */
    walkToward: (goal: THREE.Vector3, stop: number) => {
      const from = getPlayerWorldPosition().clone();
      const up = getPlayerUp();
      const distance = surfaceGaitDistance(goal, from, up, new THREE.Vector3());
      if (distance > stop) {
        const toGoal = goal.clone().sub(from);
        toGoal.addScaledVector(up, -toGoal.dot(up));
        const tangential = toGoal.length();
        if (tangential > 1e-9) {
          const step = Math.min(RAIL_WALK_SPEED * dt, tangential);
          const next = from.clone().addScaledVector(toGoal.divideScalar(tangential), step);
          // Stay on the fixture's ground: the collider rests here, it does not
          // fly down onto an authored mark.
          next.addScaledVector(up, GROUND_PLANE_Y + CG_PLAYER_GROUND_OFFSET - next.dot(up));
          pathUnits += from.distanceTo(next);
          maxStep = Math.max(maxStep, from.distanceTo(next));
          setPlayerWorldPosition(next);
        }
      }
      return distance; // the real walker reports the distance BEFORE it moves
    },
    getPlayerWorldPosition: () => getPlayerWorldPosition(),
    enterShip: () => undefined,
    exitShip: () => undefined,
    getSpaceFlightSnapshot: () => ({ controlMode: 'walk', phase: 'surface' }),
    // Exposed so a rail that reached for the cadence would share THIS clock and
    // starve the performer below, exactly as the shipped defect did.
    screeningActionReady: () => clock - lastActionAt >= SCREENING_DWELL_SECONDS,
    noteScreeningAction: () => { lastActionAt = clock; },
    performStoryInteraction: performStoryInteraction as unknown as (id: never) => unknown
  };

  return {
    ctx,
    acts,
    goals,
    get clock() { return clock; },
    get pathUnits() { return pathUnits; },
    get maxStep() { return maxStep; },
    /** One frame of the real loop: the world ticks, then the rail presses. */
    frame(): ReturnType<typeof applyCommonGroundRail> {
      tickCommonGround(dt);
      const plan = applyCommonGroundRail(ctx as unknown as CommonGroundRailContext);
      if (plan.target) goals.push(plan.target);
      clock += dt;
      return plan;
    },
    run(frames: number, until?: () => boolean): number {
      for (let index = 0; index < frames; index += 1) {
        if (until?.()) return index;
        this.frame();
      }
      return frames;
    }
  };
}

/** The route vertex an emitted goal belongs to. Vertices are 2 units apart. */
function goalVertexIndex(
  route: readonly { x: number; y: number; z: number }[],
  goal: readonly [number, number, number]
): number {
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  route.forEach((point, index) => {
    const distance = Math.hypot(point.x - goal[0], point.y - goal[1], point.z - goal[2]);
    if (distance >= bestDistance) return;
    bestDistance = distance;
    best = index;
  });
  return best;
}

describe('the movie walks the route and acts on the shared cadence', () => {
  it('never reaches for the cadence it does not own', () => {
    const source = readFileSync(
      new URL('./commonGroundDirector.ts', import.meta.url).pathname, 'utf8'
    );
    const rail = source.slice(source.indexOf('export interface CommonGroundRailContext'));
    // The chapter rail cannot consume the screening dwell, by construction: the
    // surface it is handed does not carry it.
    expect(rail).not.toContain('noteScreeningAction');
    expect(rail).not.toContain('screeningActionReady');
    expect(rail).toContain('ctx.performStoryInteraction(plan.interactionId as never)');
  });

  it('acts once through the real performer and waits out the next dwell', () => {
    enterCommonGroundBeat('ch13-survey');
    standAt({ x: CG_POSES.W.x + 5, y: CG_POSES.W.y, z: CG_POSES.W.z });
    const harness = createRailHarness(0.05);
    harness.run(400, () => commonGroundSnapshot().survey.phase === 'drawing');

    const offers = harness.acts.filter(act => act.id === 'story-ch13-offer-route');
    const starts = harness.acts.filter(act => act.id === 'story-ch13-survey-start');
    // It acted, which the shipped rail could not: it spent the dwell first and
    // the shared performer then refused every act it had already paid for.
    expect(offers).toHaveLength(1);
    expect(starts).toHaveLength(1);
    expect(commonGroundSnapshot().survey.phase).toBe('drawing');
    // And the cadence between the two acts is the shared one, unshortened.
    expect(starts[0].at - offers[0].at).toBeGreaterThanOrEqual(SCREENING_DWELL_SECONDS);
    // A walked approach, not a teleport onto the goal.
    expect(harness.maxStep).toBeLessThanOrEqual(RAIL_WALK_SPEED * 0.05 + 1e-9);
  });

  it('walks the long survey polyline in order, without returning to the start', () => {
    enterCommonGroundBeat('ch13-survey');
    standAt({ x: CG_POSES.W.x + 5, y: CG_POSES.W.y, z: CG_POSES.W.z });
    const harness = createRailHarness(0.05);
    harness.run(400, () => commonGroundSnapshot().survey.phase === 'drawing');
    expect(commonGroundSnapshot().survey.phase).toBe('drawing');

    const targeted: number[] = [];
    const reached = new Set<number>();
    const startedPath = harness.pathUnits;
    for (let frame = 0; frame < 4000; frame += 1) {
      if (commonGroundSnapshot().survey.phase !== 'drawing') break;
      const plan = harness.frame();
      if (plan.reason !== 'walking the demonstrated route' || !plan.target) continue;
      const index = goalVertexIndex(CG_ROUTE_LONG, plan.target);
      if (targeted[targeted.length - 1] !== index) targeted.push(index);
      // HER FEET, not the capsule centre 1.8 units above them.
      const body = commonGroundPlayerPose();
      CG_ROUTE_LONG.forEach((point, at) => {
        if (Math.hypot(body.x - point.x, body.y - point.y, body.z - point.z) <= 0.6) reached.add(at);
      });
    }

    // ORDER, AND NO SKIPS. The old stateless scan re-selected the already
    // walked start the moment the body left it by more than its fixed radius.
    for (let at = 1; at < targeted.length; at += 1) {
      expect(targeted[at], `goal ${at} after ${targeted[at - 1]}`).toBeGreaterThan(targeted[at - 1]);
    }
    expect(targeted[0]).toBeLessThanOrEqual(1);
    expect(targeted[targeted.length - 1]).toBe(CG_ROUTE_LONG.length - 1);
    expect(new Set(targeted).size).toBe(targeted.length);

    // The BODY went through every authored vertex, not just the emitted goals.
    for (let at = 1; at < CG_ROUTE_LONG.length; at += 1) {
      expect(reached.has(at), `vertex ${at} walked`).toBe(true);
    }
    // No shortcut: the walked path is the authored 36 units, less only the
    // stop radius the feet are allowed to settle inside at the far end.
    expect(harness.pathUnits - startedPath).toBeGreaterThanOrEqual(35);

    // It arrived, and the span it offers is the one it actually walked.
    expect(harness.acts.some(act => act.id === 'story-ch13-offer-span')).toBe(true);
    expect(commonGroundSnapshot().survey.phase).not.toBe('drawing');

    // THE RECORDED SAMPLES, not the authored polyline. The first sample is
    // written wherever the body was standing when it began, and the last
    // wherever it was when it offered; both have to be the authored ends, and
    // both have to stand from the fixed reference on their own.
    const slot = commonGroundSnapshot().survey.working
      ?? commonGroundSnapshot().survey.accepted;
    const samples = slot?.samples ?? [];
    expect(samples.length).toBeGreaterThan(2);
    // The recording BEGAN at the authored start, on its supported side: the
    // aim through the head plus the stop radius, and nothing looser.
    expect(distanceFrom(samples[0], CG_POSES.S)).toBeLessThanOrEqual(0.7);
    // And it ENDED at the authored end, within one sample of the grid the
    // trace records on — the same grid a player walking here would get.
    expect(distanceFrom(samples[samples.length - 1], CG_POSES.E))
      .toBeLessThanOrEqual(TRACE_SAMPLE_SPACING_UNITS);
    expect(slot?.walkedUnits ?? 0).toBeGreaterThanOrEqual(35);
    for (const sample of samples) {
      const check = checkReference(CG_FIXED_SOCKET, playerSocket(sample), {});
      expect(check.ok, `sample ${JSON.stringify(sample)}: ${check.reason ?? ''}`).toBe(true);
    }
  });

  it('walks all eighteen actual units of the common span and arrives at the far end', () => {
    enterCommonGroundBeat('ch13-common');
    standAt(CG_POSES.E);
    const harness = createRailHarness(0.05);

    // He takes the reciprocal reference first, and she gets out of the way of
    // his positioning leg by walking, not by being moved.
    harness.run(600, () => commonGroundSnapshot().common.stage === 'holding-h');
    expect(commonGroundSnapshot().common.stage).toBe('holding-h');
    expect(getCommonGroundActorState().held).toBe(false);
    expect(commonGroundSnapshot().common.terraUnits).toBe(0);

    const targeted: number[] = [];
    const reached = new Set<number>();
    const startedPath = harness.pathUnits;
    for (let frame = 0; frame < 4000; frame += 1) {
      if (commonGroundSnapshot().common.comparisonProved) break;
      const plan = harness.frame();
      if (plan.reason !== 'walking the common span' || !plan.target) continue;
      const index = goalVertexIndex(CG_ROUTE_COMMON, plan.target);
      if (targeted[targeted.length - 1] !== index) targeted.push(index);
      // HER FEET, not the capsule centre 1.8 units above them.
      const body = commonGroundPlayerPose();
      CG_ROUTE_COMMON.forEach((point, at) => {
        if (Math.hypot(body.x - point.x, body.y - point.y, body.z - point.z) <= 0.6) reached.add(at);
      });
    }

    // THE PRODUCTION PREDICATE CLOSED IT. Nothing here credits a unit: every
    // one of the eighteen came from `routeProgressUnits` reading this body's
    // own frame-by-frame displacement inside the corridor.
    expect(commonGroundSnapshot().common.terraUnits).toBeGreaterThanOrEqual(CG_COMMON_ROUTE_UNITS);
    expect(commonGroundSnapshot().common.comparisonProved).toBe(true);
    expect(hasMilestone(STORY_MILESTONES.ch13ReciprocalCrossed)).toBe(true);

    for (let at = 1; at < targeted.length; at += 1) {
      expect(targeted[at], `goal ${at} after ${targeted[at - 1]}`).toBeGreaterThan(targeted[at - 1]);
    }
    expect(targeted[targeted.length - 1]).toBe(CG_ROUTE_COMMON.length - 1);
    expect(new Set(targeted).size).toBe(targeted.length);
    for (let at = 1; at < CG_ROUTE_COMMON.length; at += 1) {
      expect(reached.has(at), `vertex ${at} walked`).toBe(true);
    }
    // Eighteen walked units, walked. Endpoint separation is six.
    expect(harness.pathUnits - startedPath).toBeGreaterThanOrEqual(CG_COMMON_ROUTE_UNITS);
    expect(harness.maxStep).toBeLessThanOrEqual(RAIL_WALK_SPEED * 0.05 + 1e-9);

    // And it goes on to occupy the far reference it then offers.
    harness.run(400, () => commonGroundSnapshot().common.finalReferenceOffered);
    expect(commonGroundSnapshot().common.finalReferenceOffered).toBe(true);
    expect(commonGroundSnapshot().common.finalReferenceOccupied).toBe(true);
  });

  it('rebuilds the traversal from the body after a restore, and grants nothing', () => {
    enterCommonGroundBeat('ch13-common');
    standAt(CG_POSES.E);
    const harness = createRailHarness(0.05);
    harness.run(600, () => commonGroundSnapshot().common.stage === 'holding-h');
    harness.run(200, () => {
      const body = commonGroundPlayerPose();
      return goalVertexIndex(CG_ROUTE_COMMON, [body.x, body.y, body.z]) >= 5;
    });
    const midUnits = commonGroundSnapshot().common.terraUnits;
    expect(midUnits).toBeGreaterThan(0);
    expect(commonGroundSnapshot().common.comparisonProved).toBe(false);

    // A Continue puts the body back where the save says it was. The controller
    // has to follow the body; the body never follows the controller.
    standAt(CG_ROUTE_COMMON[1]);
    const plan = harness.frame();
    expect(plan.reason).toBe('walking the common span');
    expect(goalVertexIndex(CG_ROUTE_COMMON, plan.target ?? [0, 0, 0])).toBeLessThanOrEqual(2);
    // The rebuild is a move goal and nothing else: no unit was created by it.
    expect(commonGroundSnapshot().common.terraUnits).toBeLessThanOrEqual(midUnits + 0.5);
    expect(commonGroundSnapshot().common.comparisonProved).toBe(false);
  });

  it('steps off the span he has to test instead of offering itself as a witness', () => {
    enterCommonGroundBeat('ch13-survey');
    standAt({ x: CG_POSES.W.x + 5, y: CG_POSES.W.y, z: CG_POSES.W.z });
    const harness = createRailHarness(0.05);
    harness.run(6000, () => commonGroundSnapshot().survey.phase === 'offered');
    expect(commonGroundSnapshot().survey.phase).toBe('offered');

    // Her last recorded sample is under her own feet, and it is on his span.
    harness.run(6000, () => commonGroundSnapshot().survey.phase === 'tested');
    expect(commonGroundSnapshot().survey.phase).toBe('tested');
    // He walked it himself. No witness was invented to unblock her own body,
    // and no hold was left standing.
    expect(harness.acts.some(act => act.id === 'story-ch13-hold-witness')).toBe(false);
    expect(commonGroundSnapshot().survey.hold.reason).toBeNull();
    expect(getCommonGroundActorState().held).toBe(false);
    expect(hasMilestone(STORY_MILESTONES.ch13RouteTested)).toBe(true);
    // And it is the FIRST-TRY class the long route was chosen to demonstrate:
    // the span stands from the fixed reference, with no contingent witness.
    expect(commonGroundSnapshot().survey.accepted?.routeClass).toBe('fixed-reference');
    expect(commonGroundSnapshot().survey.witness).toBeNull();
  });

  it('performs BOTH home rungs at the core, in order, one dwell apart', () => {
    // The beat the hardware movie actually stalled on: the ready [F] prompt
    // stood at the core for the whole run because the rail spent the screening
    // dwell and the shared performer then refused the act it had paid for.
    expect(commitHabitatCorePlacement({
      actorId: 'local',
      worldId: TIDEGARDEN_WORLD_ID,
      shelterId: 'ch13-home-fixture',
      cell: [0, 0, 0],
      supportCell: [0, -1, 0],
      position: [-20, 51.05, 30],
      up: [0, 1, 0],
      eventId: 'ch13-home-fixture'
    })).toBe(true);
    enterCommonGroundBeat('ch13-home');
    standAt({ x: -20, y: 51.05, z: 40 });

    const harness = createRailHarness(0.05);
    harness.run(600, () => commonGroundSnapshot().home.returnChosen);

    expect(harness.acts.map(act => act.id)).toEqual([
      'story-ch13-fault-review',
      'story-ch13-choose-return'
    ]);
    expect(hasMilestone(STORY_MILESTONES.ch13FaultReviewed)).toBe(true);
    expect(hasMilestone(STORY_MILESTONES.ch13ReturnChosen)).toBe(true);
    expect(harness.acts[1].at - harness.acts[0].at).toBeGreaterThanOrEqual(SCREENING_DWELL_SECONDS);
  });

  it('stops clear of his body on the return approach and at the survey offer', () => {
    // W is his inspection pose, not an empty mark. Both approaches that end
    // beside him must stop outside the clearance his own leg is held by, or the
    // rail manufactures the stand-off the chapter never resolves by displacing
    // anyone.
    enterCommonGroundBeat('ch13-survey');
    standAt(CG_POSES.C);
    tickCommonGround(0.016);
    const worker = commonGroundActorPosition();
    const approach = commonGroundRailPlan();
    expect(approach.action).toBe('walk');
    expect(approach.arriveRadius).toBeGreaterThanOrEqual(1);
    expect(approach.arriveRadius).toBeLessThan(3.4);

    enterCommonGroundBeat('ch13-return');
    markMilestone(STORY_MILESTONES.ch13ReturnChosen);
    const plan = commonGroundRailPlan();
    if (plan.action === 'walk' && plan.target) {
      expect(plan.arriveRadius).toBeGreaterThanOrEqual(1);
    }
    void worker;
  });
});

// --- CG-IMPL-006: the live body is a capsule, and its centre is not a pose ----
//
// VF-RAIL-2 measured Terra standing ON the survey start for four and a half
// minutes while the rail's arrival gate could never close: `getPlayerWorldPosition`
// publishes the Rapier capsule CENTRE (half-height 1.3 + radius 0.5 = 1.8 above
// the contact point) and every ch13 pose is a grounded body origin. The 3026
// tests could not see it because they stood a body of zero height on the mark.
//
// These regressions place a REAL centre, against the REAL voxel-column footing
// rule the mounted world uses, and assert from the feet.

/**
 * The mounted world's actual support test (`CommonGroundWorld.createFooting`):
 * the column under `y - 1.05`, the cell above it empty, sampled at the body
 * disc's centre and four lateral offsets. Voxel scale is 2, so the ch13 ground
 * column is cell 25 and its top face is world y 51.
 */
const voxelGround: CommonGroundFooting = {
  revision: 'voxel-fixture',
  isSupported: point => {
    const column = (x: number, z: number): boolean => {
      if (Math.round((point.y - 1.05) / 2) !== 25) return false;
      // A flat, solid authored plot around the chapter's poses.
      return x >= -60 && x <= -10 && z >= -10 && z <= 40;
    };
    return column(point.x, point.z)
      && column(point.x + 0.5, point.z) && column(point.x - 0.5, point.z)
      && column(point.x, point.z + 0.5) && column(point.x, point.z - 0.5);
  }
};

/** The residual the hardware measured: she rests a shade below the nominal plane. */
const MEASURED_REST_RESIDUAL = 0.06;

describe('the chapter reads the actual physical body, not an idealized mark', () => {
  it('derives the grounded pose from the real capsule constants and the live up', () => {
    // The exact figures from `EfficientPlayer`'s CapsuleCollider.
    expect(CG_PLAYER_GROUND_OFFSET).toBeCloseTo(1.8, 10);

    standCapsuleCentreAt({ x: -26, y: 52.85, z: 12 });
    expect(commonGroundPlayerPose().y).toBeCloseTo(51.05, 10);

    // The hardware sample: centre 52.79 over an authored plane of 51.05.
    standCapsuleCentreAt({ x: -26.13, y: 52.79, z: 12 });
    const feet = commonGroundPlayerPose();
    expect(feet.y).toBeCloseTo(51.05 - MEASURED_REST_RESIDUAL, 6);
    expect(distanceFrom(feet, CG_POSES.S)).toBeLessThan(0.2);
    // ...while the raw centre is 1.7+ away and can never satisfy a subunit gate.
    expect(distanceFrom(getPlayerWorldPosition(), CG_POSES.S)).toBeGreaterThan(1.7);
  });

  it('reads the pose along the LIVE up, so another cube face is not a fall', () => {
    setPlayerUp(new THREE.Vector3(1, 0, 0));
    standCapsuleCentreAt({ x: 51.05 + CG_PLAYER_GROUND_OFFSET, y: -26, z: 12 });
    const feet = commonGroundPlayerPose();
    expect(feet.x).toBeCloseTo(51.05, 10);
    expect(feet.y).toBeCloseTo(-26, 10);
  });

  it('begins the recording from a real standing body, at the measured rest height', () => {
    unbind?.();
    unbind = registerCommonGroundWorld({ worldId: '', footing: voxelGround, extraSolids: [] });
    enterCommonGroundBeat('ch13-survey');
    commonGroundSnapshot().survey.phase = 'awaiting-start';

    // The exact hardware body: capsule centre 52.79 beside S.
    standCapsuleCentreAt({ x: -26.13, y: 52.79, z: 12 });
    expect(voxelGround.isSupported(commonGroundPlayerPose())).toBe(true);
    expect(commitCommonGroundSurveyStart()).toBe(true);
    expect(commonGroundSnapshot().survey.phase).toBe('drawing');
    // The first sample is written under her FEET, on the ground she is standing
    // on — not 1.8 units up in the air where the capsule's origin is.
    const first = commonGroundSnapshot().survey.working?.samples[0];
    expect(first?.y).toBeCloseTo(51.05 - MEASURED_REST_RESIDUAL, 6);
  });

  it('refuses a body of zero height: the old fixture is not a standing player', () => {
    unbind?.();
    unbind = registerCommonGroundWorld({ worldId: '', footing: voxelGround, extraSolids: [] });
    enterCommonGroundBeat('ch13-survey');
    commonGroundSnapshot().survey.phase = 'awaiting-start';

    // Exactly what `standAt` used to do: the CENTRE placed on the authored pose.
    // Her feet would then be 1.8 units inside the ground, which is not a place a
    // body can be, and the mounted world's footing says so.
    standCapsuleCentreAt(CG_POSES.S);
    expect(voxelGround.isSupported(commonGroundPlayerPose())).toBe(false);
    expect(commitCommonGroundSurveyStart()).toBe(false);
    expect(commonGroundRailPlan().action).toBe('walk');
  });

  it('grants nothing to a jumping body: standing is standing', () => {
    unbind?.();
    unbind = registerCommonGroundWorld({ worldId: '', footing: voxelGround, extraSolids: [] });
    enterCommonGroundBeat('ch13-survey');
    commonGroundSnapshot().survey.phase = 'awaiting-start';

    // Mid-jump over the mark: horizontally perfect, vertically airborne.
    standCapsuleCentreAt({ x: CG_POSES.S.x, y: CG_POSES.S.y + CG_PLAYER_GROUND_OFFSET + 1.2, z: CG_POSES.S.z });
    expect(voxelGround.isSupported(commonGroundPlayerPose())).toBe(false);
    expect(commitCommonGroundSurveyStart()).toBe(false);
    // The rail keeps walking rather than pressing: no phantom arrival.
    expect(commonGroundRailPlan().action).toBe('walk');

    // She lands. Nothing was granted while she was in the air, and the same
    // ordinary act now works from the same horizontal place.
    standAt(CG_POSES.S);
    expect(commitCommonGroundSurveyStart()).toBe(true);
  });

  it('refuses the far reference to a body hovering over the occupancy cylinder', () => {
    unbind?.();
    unbind = registerCommonGroundWorld({ worldId: '', footing: voxelGround, extraSolids: [] });
    enterCommonGroundBeat('ch13-common');
    const snapshot = commonGroundSnapshot();
    snapshot.common.comparisonProved = true;

    standCapsuleCentreAt({ x: CG_POSES.T.x, y: CG_POSES.T.y + CG_PLAYER_GROUND_OFFSET + 1.4, z: CG_POSES.T.z });
    expect(commitCommonGroundFinalReferenceOffer()).toBe(false);
    standAt(CG_POSES.T);
    expect(commitCommonGroundFinalReferenceOffer()).toBe(true);
  });

  it('agrees with the shared gait: where the walker stops, the rail can act', () => {
    // The seam VF-RAIL-2 exposed is a DISAGREEMENT between two measurements.
    // `walkToward` stops on `surfaceGaitDistance` (tangential range, since the
    // 1.8-unit drop is well inside GAIT_STEP_DOWN); the director judged full 3D
    // from the capsule centre. Both must now name the same body.
    const centre = new THREE.Vector3(
      CG_POSES.S.x + 0.3, CG_POSES.S.y + CG_PLAYER_GROUND_OFFSET, CG_POSES.S.z
    );
    const goal = new THREE.Vector3(CG_POSES.S.x, CG_POSES.S.y, CG_POSES.S.z);
    const gait = surfaceGaitDistance(goal, centre, new THREE.Vector3(0, 1, 0), new THREE.Vector3());
    expect(gait).toBeCloseTo(0.3, 6);

    setPlayerWorldPosition(centre);
    expect(distanceFrom(commonGroundPlayerPose(), CG_POSES.S)).toBeCloseTo(0.3, 6);
    // The old comparison, for the record: 1.82 from a walker that had stopped.
    expect(getPlayerWorldPosition().distanceTo(goal)).toBeGreaterThan(1.8);
  });

  it('walks the long survey to a real F on the mark, from a real capsule body', () => {
    unbind?.();
    unbind = registerCommonGroundWorld({ worldId: '', footing: voxelGround, extraSolids: [] });
    enterCommonGroundBeat('ch13-survey');
    standAt({ x: CG_POSES.W.x + 5, y: CG_POSES.W.y, z: CG_POSES.W.z });

    const harness = createRailHarness(0.05);
    harness.run(600, () => commonGroundSnapshot().survey.phase === 'drawing');

    // The act the hardware could never reach, now reached by a body whose
    // centre is 1.8 units above every authored mark it walks to.
    expect(harness.acts.map(act => act.id)).toContain('story-ch13-survey-start');
    expect(commonGroundSnapshot().survey.phase).toBe('drawing');
    expect(getPlayerWorldPosition().y).toBeCloseTo(CG_POSES.S.y + CG_PLAYER_GROUND_OFFSET, 6);
  });
});

// --- CG-IMPL-007: the screening's own recovery from a boarded on-foot beat ---

describe('an on-foot ch13 beat is never walked from inside the ship', () => {
  afterEach(() => {
    resetTravel();
  });

  it('leaves a landed ship on the two on-foot beats, and only then walks', () => {
    // The boot owner is repaired in `storyState`; this is the rail refusing to
    // stall if it ever holds flight controls during a beat that is walked.
    for (const beat of ['ch13-survey', 'ch13-common'] as const) {
      resetTravel();
      enterCommonGroundBeat(beat);
      standAt(CG_POSES.E);
      expect(commonGroundRailPlan().action, `${beat} on foot`).not.toBe('exit-ship');

      expect(enterShip()).toBe(true);
      expect(getSpaceFlightSnapshot()).toMatchObject({ phase: 'surface', controlMode: 'flight' });
      const boarded = commonGroundRailPlan();
      expect(boarded.action, beat).toBe('exit-ship');
      // It grants nothing on the way out.
      expect(boarded.interactionId).toBeNull();
      expect(hasMilestone(STORY_MILESTONES.ch13RouteTested), beat).toBe(false);
      expect(hasMilestone(STORY_MILESTONES.ch13Complete), beat).toBe(false);

      // And the shipped exit is what the rail body actually presses.
      const ctx = {
        controls: { forward: false, jump: false, sprint: false, interact: false },
        _goalScratch: new THREE.Vector3(),
        clearControls: () => undefined,
        walkToward: () => 0,
        getPlayerWorldPosition: () => getPlayerWorldPosition(),
        enterShip: () => undefined,
        exitShip: () => { exitShip(); },
        getSpaceFlightSnapshot,
        performStoryInteraction: () => false
      };
      applyCommonGroundRail(ctx as unknown as CommonGroundRailContext);
      expect(getSpaceFlightSnapshot(), beat)
        .toMatchObject({ phase: 'surface', controlMode: 'fps' });
      expect(commonGroundRailPlan().action, `${beat} recovered`).not.toBe('exit-ship');
    }
  });

  it('does not disembark anybody on the beats that are flown', () => {
    // ch13-return is the beat that boards, lifts, crosses and lands. Its own
    // exit-ship branch belongs to the landing, not to holding flight controls,
    // and nothing above may have reached it.
    resetTravel();
    enterCommonGroundBeat('ch13-return');
    markMilestone(STORY_MILESTONES.ch13ReturnChosen);
    expect(enterShip()).toBe(true);
    const plan = commonGroundRailPlan();
    // Not on the origin in this fixture, so it is still the launch/crossing
    // sequence — never an immediate disembark.
    expect(plan.action).not.toBe('exit-ship');
    expect(getSpaceFlightSnapshot()).toMatchObject({ controlMode: 'flight' });
  });
});

// --- CG-IMPL-008: the home anchors, through the REAL signed AV runtime -------
//
// No spy, no always-success mock. These drive `signedSceneAvRuntime` itself, in
// the exact order the shared story director uses it, and read its own
// activation history. VF-ANCHOR-OBS-1 measured a hydrated ch13-home performing
// both real F acts, setting both milestones, and activating nothing at all.

/**
 * The shipped beat seam, in its real order.
 *
 * `emergentStoryDirector.enterEmergentBeat` calls `enterCommonGroundBeat(beat)`
 * FIRST and `enterSignedSceneAvBeat(beat)` after it, so anything this chapter
 * publishes at entry is offered to a rail still sitting on the previous beat.
 * Reproducing that order is the whole point: reversing it here would hide the
 * defect exactly as the old always-success spy did.
 */
function enterBeatThroughTheRealSeam(beat: 'ch13-home' | 'ch13-return' | 'ch13-survey' | 'ch13-common'): void {
  enterCommonGroundBeat(beat);
  enterSignedSceneAvBeat(beat, 'quit');
}

function activatedAnchors(): string[] {
  return getSignedSceneAvDebugSnapshot().activationHistoryAnchorIds;
}

/** The prior station-continuation contract's receipts. Read, never reissued. */
function seedPriorBoundaryReceipts(): void {
  markMilestone('story:ch11-station-departed');
  markMilestone('story:ch12-bonded-cell-installed');
  markMilestone('story:ch12-hearth-restored');
}

function standTidegardenHome(): void {
  resetSystemFlightForInterstellarArrival({
    system: STORY_COORDINATE,
    locationMode: 'surface',
    activePlanetId: TIDEGARDEN_WORLD_ID,
    pose: { position: [0, 0, 0], velocity: [0, 0, 0], quaternion: [0, 0, 0, 1] }
  });
  resetTravel();
  expect(commitHabitatCorePlacement({
    actorId: 'local',
    worldId: TIDEGARDEN_WORLD_ID,
    shelterId: 'ch13-anchor-fixture',
    cell: [0, 0, 0],
    supportCell: [0, -1, 0],
    position: [-20, 51.05, 30],
    up: [0, 1, 0],
    eventId: 'ch13-anchor-fixture'
  })).toBe(true);
  standAt({ x: -20, y: 51.05, z: 31 });
}

describe('the home anchors activate from their real facts, in the signed order', () => {
  beforeEach(() => {
    resetSignedSceneAvRuntime('sandbox');
  });

  afterEach(() => {
    resetSignedSceneAvRuntime('sandbox');
    resetTravel();
  });

  it('publishes the ONE live install acknowledgement before the steady entry', () => {
    // A session that watched the pre-install state and then saw the receipt
    // appear is the only session that earns the acknowledgement.
    completeStory();
    standTidegardenHome();
    expect(tickCommonGroundEntry(0.016)).toBe(false); // pre-install: nothing yet
    expect(activatedAnchors()).toEqual([]);

    seedPriorBoundaryReceipts();
    // The install boundary itself: the receipt appears, the watch sees the edge,
    // the beat re-activates and the one acknowledgement is published.
    expect(tickCommonGroundEntry(0.016)).toBe(true);
    // `reactivateStoryAtBeat` publishes synchronously, so the shared director's
    // whole beat seam has ALREADY run inside that call: this chapter's entry
    // published the steady anchor (refused — the rail was still on the previous
    // beat, and it is queued), the rail then arrived at ch13-home, and only then
    // did the install boundary above publish its receipt. The receipt is signed
    // at order 0 and the steady entry at order 1, and that is the order they
    // reach the rail.
    tickCommonGround(0.016);
    expect(activatedAnchors()).toEqual(['anc.cg.cell-installed', 'anc.cg.home-steady']);

    // Exactly one acknowledgement, however many frames run.
    tickCommonGroundEntry(0.016);
    tickCommonGround(0.016);
    expect(activatedAnchors().filter(id => id === 'anc.cg.cell-installed')).toHaveLength(1);

    // And the later real F acts still carry their own anchors.
    standAt({ x: -20, y: 51.05, z: 31 });
    expect(commitCommonGroundFaultReview()).toBe(true);
    expect(commitCommonGroundReturnChoice()).toBe(true);
    tickCommonGround(0.016);
    expect(activatedAnchors()).toEqual([
      'anc.cg.cell-installed',
      'anc.cg.home-steady',
      'anc.cg.fault-reviewed',
      'anc.cg.return-chosen'
    ]);
  });

  it('restores a hydrated entry silently and STILL activates every later anchor', () => {
    // The measured defect. A restored save cannot produce the live install
    // receipt, and the contract says it must not: "a hydrated entry is steady
    // and silent and consumes no second cell". That may not make the rest of
    // the beat unreachable.
    seedPriorBoundaryReceipts();
    enterBeatThroughTheRealSeam('ch13-home');
    tickCommonGround(0.016);
    expect(activatedAnchors()).toEqual(['anc.cg.home-steady']);
    expect(activatedAnchors()).not.toContain('anc.cg.cell-installed');

    standAt({ x: -20, y: 51.05, z: 31 });
    expect(commitCommonGroundFaultReview()).toBe(true);
    tickCommonGround(0.016);
    expect(commitCommonGroundReturnChoice()).toBe(true);
    tickCommonGround(0.016);
    expect(activatedAnchors()).toEqual([
      'anc.cg.home-steady',
      'anc.cg.fault-reviewed',
      'anc.cg.return-chosen'
    ]);
    // And the release is the one the score contract binds to return-chosen:
    // handed back to the world conductor, no beat and no override held.
    expect(getCommonGroundScoreDiagnostic().beat).toBeNull();
    expect(getCommonGroundScoreDiagnostic().mood).toBeNull();
  });

  it('does not spend a refused activation: the fact is retried, never faked', () => {
    seedPriorBoundaryReceipts();
    // The rail is NOT at the beat yet — exactly the live seam order.
    enterCommonGroundBeat('ch13-home');
    expect(activatedAnchors()).toEqual([]);
    // The old code latched here and the anchor was gone forever.
    enterSignedSceneAvBeat('ch13-home', 'quit');
    tickCommonGround(0.016);
    expect(activatedAnchors()).toEqual(['anc.cg.home-steady']);
    // The retry is idempotent: it does not republish on later frames.
    tickCommonGround(0.016);
    tickCommonGround(0.016);
    expect(activatedAnchors().filter(id => id === 'anc.cg.home-steady')).toHaveLength(1);
  });

  it('blocks the entry on a missing receipt, the wrong world and the wrong actor', () => {
    completeStory();
    standTidegardenHome();

    // Missing receipt: no install, no entry, no anchor.
    markMilestone('story:ch11-station-departed');
    expect(tickCommonGroundEntry(0.016)).toBe(false);
    expect(activatedAnchors()).toEqual([]);

    // All receipts, but she is not on Tidegarden's surface on foot.
    seedPriorBoundaryReceipts();
    resetSystemFlightForInterstellarArrival({
      system: STORY_COORDINATE,
      locationMode: 'surface',
      activePlanetId: STORY_PRIMARY_WORLD_ID,
      pose: { position: [0, 0, 0], velocity: [0, 0, 0], quaternion: [0, 0, 0, 1] }
    });
    expect(tickCommonGroundEntry(0.016)).toBe(false);
    expect(activatedAnchors()).toEqual([]);

    // Another actor's saved chapter never grafts onto this one.
    const foreign = commonGroundSnapshot(TIDEGARDEN_WORLD_ID);
    expect(foreign.actorId).toBe('local');
    clearCommonGroundWorld(TIDEGARDEN_WORLD_ID);
    stageCommonGroundWorldPayload(TIDEGARDEN_WORLD_ID, {
      version: 1,
      actorId: 'somebody-else',
      worldId: TIDEGARDEN_WORLD_ID,
      home: { faultReviewed: true, returnChosen: true },
      survey: {
        phase: 'idle', accepted: null, working: null, witness: null,
        hold: { reason: null, atIndex: -1 }, approached: false, testedIndex: -1,
        workerPose: null, revisionReady: false
      },
      common: {
        stage: 'none', terraUnits: 0, comparisonProved: false,
        finalReferenceOffered: false, workerUnits: 0, workerPose: null, committed: false
      }
    });
    expect(commonGroundSnapshot(TIDEGARDEN_WORLD_ID).home.faultReviewed).toBe(false);
  });

  it('is replay- and reset-safe: a new run re-earns its anchors from zero', () => {
    seedPriorBoundaryReceipts();
    enterBeatThroughTheRealSeam('ch13-home');
    tickCommonGround(0.016);
    expect(activatedAnchors()).toEqual(['anc.cg.home-steady']);

    resetCommonGroundRuntime({ clearWorlds: true });
    resetSignedSceneAvRuntime('sandbox');
    expect(activatedAnchors()).toEqual([]);
    // Nothing pending survives a reset and re-fires into the next run.
    tickCommonGround(0.016);
    expect(activatedAnchors()).toEqual([]);

    enterBeatThroughTheRealSeam('ch13-home');
    tickCommonGround(0.016);
    expect(activatedAnchors()).toEqual(['anc.cg.home-steady']);
  });

  it('never defers a MID-BEAT acknowledgement across a pause, a mute or a Continue', () => {
    // The rule this protects is unchanged, and it is what keeps the entry-anchor
    // repair below from becoming a deferred unlock: a refusal that survives the
    // frame it belonged to is a refusal. Every anchor except the beat's own
    // entry — including `anc.cg.cell-installed`, the one live install
    // acknowledgement — goes through the ordinary pending queue, which a pause
    // still empties on the spot.
    seedPriorBoundaryReceipts();
    enterBeatThroughTheRealSeam('ch13-home');
    tickCommonGround(0.016);
    expect(activatedAnchors()).toEqual(['anc.cg.home-steady']);

    // The rail leaves. A mid-beat fact is now published into nothing.
    resetSignedSceneAvRuntime('sandbox');
    standAt({ x: -20, y: 51.05, z: 31 });
    expect(commitCommonGroundFaultReview()).toBe(true);
    expect(getCommonGroundProbeSnapshot().pendingAnchors).toEqual(['anc.cg.fault-reviewed']);

    // The pause ends the frame it belonged to, and it is DROPPED, not held.
    suspendCommonGroundPresentation('pause');
    expect(getCommonGroundProbeSnapshot().pendingAnchors).toEqual([]);
    enterSignedSceneAvBeat('ch13-home', 'quit');
    tickCommonGround(0.016);
    tickCommonGround(0.016);
    expect(activatedAnchors()).not.toContain('anc.cg.fault-reviewed');
    // ...and the local latch is not a claim that it activated.
    expect((getCommonGroundDiagnostic().anchors as string[])).toContain('anc.cg.fault-reviewed');
  });

  /**
   * VF3-AVHOME-1 — the BOOT, in the order the app actually performs it.
   *
   * `App.tsx` mounts `<StoryDirectorDriver paused={!worldGenReady ||
   * !initialRenderReleased || ...} />`, and `initStoryFromSave` activates the
   * beat inside a `useState` initializer, so `storyDirector`'s
   * `subscribeStory(syncBeat)` runs the whole beat seam BEFORE the first frame
   * exists — and every frame of world generation and shader warmup then reaches
   * this chapter as `suspendCommonGroundPresentation('pause')`. That is not a
   * hypothesis about visibility: it is what those two lines do together.
   *
   * Measured on hardware: firedAnchors ['anc.cg.home-steady',
   * 'anc.cg.fault-reviewed'], AV activationSequence 0, activation history empty,
   * pendingAnchors already empty at 11 ms, and the first accepted anchor was
   * anc.cg.hatch-boarded in the NEXT beat.
   */
  it('survives the boot: the entry anchor is retried after world-gen and warmup', () => {
    seedPriorBoundaryReceipts();
    // 1. The synchronous entry seam, before any frame. The rail is elsewhere.
    enterCommonGroundBeat('ch13-home');
    enterSignedSceneAvBeat('ch13-home', 'quit');
    expect(activatedAnchors()).toEqual([]);
    expect(getCommonGroundProbeSnapshot().pendingAnchors).toEqual(['anc.cg.home-steady']);

    // 2. World generation and shader warmup: the driver is `paused`, so nothing
    //    ticks and the chapter is suspended on every one of these frames.
    for (let frame = 0; frame < 30; frame += 1) suspendCommonGroundPresentation('pause');
    expect(activatedAnchors()).toEqual([]);

    // 3. The first real frame.
    tickCommonGround(0.016);
    expect(activatedAnchors()).toEqual(['anc.cg.home-steady']);
    // One retry, then the queue is empty whatever happened.
    expect(getCommonGroundProbeSnapshot().pendingAnchors).toEqual([]);

    // 4. And the cascade is gone: the real F acts now publish.
    standAt({ x: -20, y: 51.05, z: 31 });
    expect(commitCommonGroundFaultReview()).toBe(true);
    expect(commitCommonGroundReturnChoice()).toBe(true);
    tickCommonGround(0.016);
    expect(activatedAnchors()).toEqual([
      'anc.cg.home-steady',
      'anc.cg.fault-reviewed',
      'anc.cg.return-chosen'
    ]);
  });

  it('drops the entry anchor when the entry itself ends, not when a frame does', () => {
    seedPriorBoundaryReceipts();
    enterCommonGroundBeat('ch13-home');
    enterSignedSceneAvBeat('ch13-home', 'quit');
    expect(getCommonGroundProbeSnapshot().pendingAnchors).toEqual(['anc.cg.home-steady']);
    // A world change, an actor change, a reset and an exit each END the entry.
    suspendCommonGroundPresentation('world-change');
    expect(getCommonGroundProbeSnapshot().pendingAnchors).toEqual([]);
    tickCommonGround(0.016);
    expect(activatedAnchors()).toEqual([]);
    // ...and the latch is still not a claim that anything activated.
    expect((getCommonGroundDiagnostic().anchors as string[])).toContain('anc.cg.home-steady');
  });

  it('keeps the entry queue bounded to one beat entry and one retry', () => {
    seedPriorBoundaryReceipts();
    // Repeated entries of the SAME beat cannot accumulate: the latch refuses a
    // second note, and a transition clears the queue outright.
    for (let attempt = 0; attempt < 5; attempt += 1) enterCommonGroundBeat('ch13-home');
    expect(getCommonGroundProbeSnapshot().pendingAnchors).toEqual(['anc.cg.home-steady']);
    enterCommonGroundBeat('ch13-return');
    expect(getCommonGroundProbeSnapshot().pendingAnchors).toEqual([]);
    enterSignedSceneAvBeat('ch13-return', 'quit');
    tickCommonGround(0.016);
    expect(activatedAnchors()).not.toContain('anc.cg.home-steady');
  });

  it('drops a pending activation at a beat transition rather than carrying it', () => {
    seedPriorBoundaryReceipts();
    enterCommonGroundBeat('ch13-home');
    enterCommonGroundBeat('ch13-return');
    enterSignedSceneAvBeat('ch13-return', 'quit');
    tickCommonGround(0.016);
    expect(activatedAnchors()).not.toContain('anc.cg.home-steady');
  });

  it('lets a first-try legal survey reach route-tested with no contingency at all', () => {
    // The same category error, downstream: the signed contingent anchors were
    // treated as prerequisites, so a route that never needed a hold, a witness
    // or a revision could never publish the anchor for completing.
    enterBeatThroughTheRealSeam('ch13-survey');
    // Every act below is the live resolver's, pressed by the screening rail
    // through the shared performer: the offer, the start, the walk and the span.
    standAt({ x: CG_POSES.W.x + 5, y: CG_POSES.W.y, z: CG_POSES.W.z });
    const harness = createRailHarness(0.05);
    harness.run(400, () => commonGroundSnapshot().survey.phase === 'drawing');
    harness.run(6000, () => commonGroundSnapshot().survey.phase === 'tested');
    expect(commonGroundSnapshot().survey.phase).toBe('tested');
    expect(commonGroundSnapshot().survey.accepted?.routeClass).toBe('fixed-reference');

    const fired = activatedAnchors();
    expect(fired).toContain('anc.cg.route-offered');
    expect(fired).toContain('anc.cg.route-tested');
    // ...and no contingency was invented to get there.
    for (const contingent of [
      'anc.cg.specific-hold', 'anc.cg.witness-held', 'anc.cg.witness-vacated',
      'anc.cg.test-resumed', 'anc.cg.tail-reopened', 'anc.cg.route-revised'
    ]) {
      expect(fired, contingent).not.toContain(contingent);
    }
  });
});

// --- the common beat, with a real body and an honest fixture ----------------

describe('the reciprocal comparison measures a real standing body', () => {
  it('accrues her passage while she actually walks it, and not before', () => {
    unbind?.();
    unbind = registerCommonGroundWorld({ worldId: '', footing: voxelGround, extraSolids: [] });
    enterCommonGroundBeat('ch13-common');
    standAt(CG_POSES.E);
    const harness = createRailHarness(0.05);
    // He takes the reference at H first — the rail steps her clear of his leg
    // rather than being displaced — and her span is not measured until he has.
    harness.run(1200, () => commonGroundSnapshot().common.stage === 'holding-h');
    expect(commonGroundSnapshot().common.stage).toBe('holding-h');
    expect(commonGroundSnapshot().common.terraUnits).toBe(0);

    harness.run(4000, () => commonGroundSnapshot().common.comparisonProved);
    expect(commonGroundSnapshot().common.terraUnits).toBeCloseTo(CG_COMMON_ROUTE_UNITS, 3);
    expect(commonGroundSnapshot().common.comparisonProved).toBe(true);
    // Her feet ended on the far end of the authored span.
    expect(distanceFrom(commonGroundPlayerPose(), CG_POSES.C)).toBeLessThan(1);
  });

  it('measures nothing at all for a body of zero height', () => {
    // The old fixture, restated as the negative it is: a centre standing on the
    // authored plane has its feet inside the ground, the walked segment is not
    // supported, and no unit of the comparison may be credited to it.
    unbind?.();
    unbind = registerCommonGroundWorld({ worldId: '', footing: voxelGround, extraSolids: [] });
    enterCommonGroundBeat('ch13-common');
    standAt({ x: CG_POSES.E.x, y: CG_POSES.E.y, z: CG_POSES.E.z - 3 });
    for (let frame = 0; frame < 400; frame += 1) tickCommonGround(0.05);
    expect(commonGroundSnapshot().common.stage).toBe('holding-h');

    for (const point of CG_ROUTE_COMMON) {
      standCapsuleCentreAt(point);
      tickCommonGround(0.05);
    }
    expect(commonGroundSnapshot().common.terraUnits).toBe(0);
    expect(commonGroundSnapshot().common.comparisonProved).toBe(false);
  });

  it('tells an unearned debug fixture apart from a real survey behind it', () => {
    // A deep link into ch13-common is a SYNTHETIC state: the survey it claims to
    // follow was never walked. The chapter says so rather than pretending, and
    // it grants nothing for standing in it.
    enterCommonGroundBeat('ch13-common');
    standAt(CG_POSES.E);
    tickCommonGround(0.05);
    const diagnostic = getCommonGroundDiagnostic();
    expect((diagnostic.survey as Record<string, unknown>).acceptedSamples).toBe(0);
    expect((diagnostic.survey as Record<string, unknown>).acceptedClass).toBeNull();
    expect((diagnostic.common as Record<string, unknown>).comparisonProved).toBe(false);
    expect(hasMilestone(STORY_MILESTONES.ch13RouteTested)).toBe(false);
    expect(hasMilestone(STORY_MILESTONES.ch13Complete)).toBe(false);
    // ...and a hydrated Continue that DID earn one is a different state, read
    // from the same accessor.
    const snapshot = commonGroundSnapshot();
    snapshot.survey.working = createTraceSlot({ ...CG_POSES.S, corner: true });
    appendTraceSample(snapshot.survey.working, { ...CG_POSES.E, corner: false });
    markTestedPrefix(snapshot.survey.working, 2);
    acceptTestedRoute(snapshot, 'fixed-reference');
    expect((getCommonGroundDiagnostic().survey as Record<string, unknown>).acceptedClass)
      .toBe('fixed-reference');
  });
});

// --- read-only observability -------------------------------------------------

describe('the chapter can be observed without being touched', () => {
  it('reports the real capsule centre, the grounded pose and the frame between', () => {
    unbind?.();
    unbind = registerCommonGroundWorld({ worldId: '', footing: voxelGround, extraSolids: [] });
    enterCommonGroundBeat('ch13-survey');
    standCapsuleCentreAt({ x: -26.13, y: 52.79, z: 12 });

    const probe = getCommonGroundProbeSnapshot();
    expect(probe.beat).toBe('ch13-survey');
    expect(probe.bodyCentre[1]).toBeCloseTo(52.79, 6);
    expect(probe.bodyPose[1]).toBeCloseTo(52.79 - CG_PLAYER_GROUND_OFFSET, 6);
    expect(probe.up).toEqual([0, 1, 0]);
    expect(probe.groundOffsetUnits).toBeCloseTo(1.8, 10);
    expect(probe.supported).toBe(true);
    expect(probe.worldBound).toBe(true);
    expect(probe.pendingAnchors).toEqual([]);
    // No rail has run, so there is no plan — not an invented one.
    expect(probe.rail).toBeNull();
    // And the chapter's own score state, so a verifier can record the mood that
    // is actually current and how far the live completion texture has run.
    expect(probe.score.beat).toBe('ch13-survey');
    expect(probe.score.finalTextureSeconds).toBeNull();
    expect(probe.score.mood).toBe(getCommonGroundScoreDiagnostic().mood);
  });

  it('reports the plan the rail EXECUTED, and never runs the planner itself', () => {
    // Observer effect. `commonGroundRailPlan` advances the ordered traversal
    // cursor, so a probe that called it would steer the run it is watching —
    // and in manual play would run a controller nobody started.
    unbind?.();
    unbind = registerCommonGroundWorld({ worldId: '', footing: voxelGround, extraSolids: [] });
    enterCommonGroundBeat('ch13-survey');
    commonGroundSnapshot().survey.phase = 'drawing';
    commonGroundSnapshot().survey.working = createTraceSlot({ ...CG_POSES.S, corner: true });
    standAt(CG_POSES.S);

    const harness = createRailHarness(0.05);
    harness.run(40);
    const executed = getCommonGroundProbeSnapshot().rail;
    expect(executed).not.toBeNull();
    expect(executed?.reason).toBe('walking the demonstrated route');

    // Put the body ON a later vertex, where one call to the planner WOULD
    // consume vertices and move the cursor on.
    standAt(CG_ROUTE_LONG[3]);
    const cursorBefore = getCommonGroundProbeSnapshot().railCursor;
    expect(cursorBefore).not.toBeNull();
    const stateBefore = JSON.stringify(getCommonGroundDiagnostic());
    const bodyBefore = commonGroundPlayerPose();
    const railBefore = getCommonGroundProbeSnapshot().rail;

    // A hundred reads move nothing: not the cursor, not the body, not a unit,
    // not an anchor, not a milestone.
    for (let read = 0; read < 100; read += 1) getCommonGroundProbeSnapshot();
    expect(getCommonGroundProbeSnapshot().railCursor).toBe(cursorBefore);
    expect(JSON.stringify(getCommonGroundDiagnostic())).toBe(stateBefore);
    expect(commonGroundPlayerPose()).toEqual(bodyBefore);
    expect(getCommonGroundProbeSnapshot().rail).toEqual(railBefore);
    expect(hasMilestone(STORY_MILESTONES.ch13RouteTested)).toBe(false);

    // (That the rail itself DOES advance this cursor is proved by the ordered
    // traversal cases above; this one is only about the observer.)
  });

  it('is a copy, and cannot be used to change anything', () => {
    enterCommonGroundBeat('ch13-survey');
    standAt(CG_POSES.S);
    applyCommonGroundRail(createRailHarness(0.05).ctx as unknown as CommonGroundRailContext);
    const before = getCommonGroundProbeSnapshot();
    (before.pendingAnchors as string[]).push('anc.cg.route-tested');
    (before.diagnostic as Record<string, unknown>).beat = 'ch13-common';
    if (before.rail?.target) {
      (before.rail.target as unknown as number[])[0] = 999;
      before.rail.interactionId = 'story-ch13-survey-start';
    }
    const after = getCommonGroundProbeSnapshot();
    expect(after.pendingAnchors).toEqual([]);
    expect(after.diagnostic.beat).toBe('ch13-survey');
    expect(after.rail?.target?.[0]).not.toBe(999);
    // And no milestone, anchor or unit moved because it was read.
    expect(hasMilestone(STORY_MILESTONES.ch13RouteTested)).toBe(false);
  });
});

// --- CG-IMPL-008, mid-beat Continue: an earned predecessor is not a pending one

describe('a Continue that already earned an anchor does not block the next one', () => {
  beforeEach(() => {
    resetSignedSceneAvRuntime('sandbox');
  });

  afterEach(() => {
    resetSignedSceneAvRuntime('sandbox');
  });

  it('activates return-chosen after a restore that already reviewed the fault', () => {
    // The mid-beat Continue the anchor ledger cannot see: the review really
    // happened, in an earlier session, and its receipt is durable. The AV rail
    // clears activatedAnchorIds at beat entry, so anc.cg.fault-reviewed (order 2,
    // required) is unactivated in THIS runtime and must not be replayed - while
    // the new, real return-choice F must still carry its own anchor.
    markMilestone(STORY_MILESTONES.ch13FaultReviewed);
    const snapshot = commonGroundSnapshot();
    snapshot.home.faultReviewed = true;

    enterBeatThroughTheRealSeam('ch13-home');
    tickCommonGround(0.016);
    expect(activatedAnchors()).toEqual(['anc.cg.home-steady']);

    expect(commitCommonGroundReturnChoice()).toBe(true);
    tickCommonGround(0.016);
    expect(hasMilestone(STORY_MILESTONES.ch13ReturnChosen)).toBe(true);
    expect(activatedAnchors()).toContain('anc.cg.return-chosen');
    // ...and the review it did not perform is NOT replayed into the ledger.
    expect(activatedAnchors()).not.toContain('anc.cg.fault-reviewed');
  });

  it('still refuses the next anchor when its predecessor was never earned', () => {
    // The exemption is a RECEIPT, not a bypass. With no review receipt at all,
    // the return choice cannot be committed and its anchor cannot activate.
    enterBeatThroughTheRealSeam('ch13-home');
    tickCommonGround(0.016);
    expect(commitCommonGroundReturnChoice()).toBe(false);
    expect(activateSignedSceneAnchorById('anc.cg.return-chosen')).toBe(false);
    expect(activatedAnchors()).toEqual(['anc.cg.home-steady']);
  });

  /**
   * The case root asked for and the verifier could not produce: a VALID Continue
   * taken DURING the survey, before `story:ch13-route-tested` exists at all.
   *
   * There are only six durable ch13 milestones, and every survey predecessor is
   * keyed on the FINAL one, so an unfinished survey's save can carry no receipt
   * that excuses them. What it CAN carry, and does, is its own world-scoped
   * chapter state — and this walks that state through the real
   * `serializeCommonGround` -> WorldSave -> localStorage -> `loadWorld` ->
   * `stageCommonGroundWorldPayload` -> `hydrateCommonGround` validator ->
   * chapter seam path, not a hand-built object.
   */
  it('resumes a mid-DRAWING Continue and earns the next new anchor', () => {
    installMemStorage();
    resetSystemFlightForInterstellarArrival({
      system: STORY_COORDINATE,
      activePlanetId: STORY_PRIMARY_WORLD_ID,
      locationMode: 'surface',
      pose: { position: [0, 0, 0], velocity: [0, 0, 0], quaternion: [0, 0, 0, 1] }
    });
    const world = { worldId: STORY_PRIMARY_WORLD_ID, seed: STORY_SEED };
    unbind?.();
    unbind = registerCommonGroundWorld({
      worldId: STORY_PRIMARY_WORLD_ID,
      footing: flatGround,
      extraSolids: []
    });

    // --- Session one: open the demonstration, start the recording, draw. -----
    enterBeatThroughTheRealSeam('ch13-survey');
    seedCommonGroundActorPose(CG_POSES.W);
    standAt(CG_POSES.W);
    for (let frame = 0; frame < 20; frame += 1) tickCommonGround(0.016);
    expect(commitCommonGroundDemonstrationOffer()).toBe(true);
    standAt(CG_POSES.S);
    expect(commitCommonGroundSurveyStart()).toBe(true);
    // Walk three real samples of the short route. No fixture, no grant.
    for (const point of CG_ROUTE_SHORT.slice(1, 4)) {
      standAt(point);
      tickCommonGround(0.016);
    }
    tickCommonGround(0.016);
    const drawn = commonGroundSnapshot().survey.working?.samples.length ?? 0;
    expect(commonGroundSnapshot().survey.phase).toBe('drawing');
    expect(drawn).toBeGreaterThan(1);
    // She has not reached E yet, so `anc.cg.trace-drawn` has NOT fired: the save
    // is taken in the middle of the drawing, which is exactly the case asked for.
    expect(activatedAnchors()).toEqual([
      'anc.cg.repeated-measure',
      'anc.cg.demonstration-opened',
      'anc.cg.survey-started'
    ]);
    // The unfinished survey holds NO durable milestone. That is the point.
    expect(hasMilestone(STORY_MILESTONES.ch13RouteTested)).toBe(false);

    // --- Continue: the real save, a cold runtime, the real restore. ----------
    saveWorld(world);
    resetCommonGroundRuntime({ clearWorlds: true });
    resetSignedSceneAvRuntime('sandbox');
    resetCommonGroundActor();
    unbind?.();
    unbind = registerCommonGroundWorld({
      worldId: STORY_PRIMARY_WORLD_ID,
      footing: flatGround,
      extraSolids: []
    });
    restoreCommonGroundForWorld(world);
    enterBeatThroughTheRealSeam('ch13-survey');
    tickCommonGround(0.016);

    // The actual path and progress survived, through the validator.
    const resumed = commonGroundSnapshot();
    expect(resumed.hydrated).toBe(true);
    expect(resumed.survey.phase).toBe('drawing');
    // A new proposal legitimately clears `approached` (he must walk out to meet
    // THIS route), so the honest retained facts are the drawing itself.
    expect(resumed.survey.working?.samples).toHaveLength(drawn);
    expect(resumed.survey.working?.walkedUnits ?? 0).toBeGreaterThan(0);
    expect(resumed.survey.working?.samples[0]).toMatchObject({
      x: CG_POSES.S.x,
      z: CG_POSES.S.z
    });

    // The old acts are SILENT: nothing she already did is replayed into the
    // fresh ledger, and no receipt was manufactured for them.
    expect(activatedAnchors()).not.toContain('anc.cg.survey-started');
    expect(activatedAnchors()).not.toContain('anc.cg.demonstration-opened');
    expect(hasMilestone(STORY_MILESTONES.ch13RouteTested)).toBe(false);

    // --- And the NEXT NEW act is usable. ------------------------------------
    for (const point of CG_ROUTE_SHORT.slice(4)) {
      standAt(point);
      tickCommonGround(0.016);
    }
    standAt(CG_POSES.E);
    expect(commitCommonGroundSpanOffer()).toBe(true);
    tickCommonGround(0.016);
    expect(commonGroundSnapshot().survey.phase).toBe('offered');
    expect(activatedAnchors()).toContain('anc.cg.route-offered');
  });

  it('excuses NOTHING from a restore that has no recording at all', () => {
    // The negative control for the state-backed exemption: a validated save
    // taken before the demonstration was ever opened carries no working and no
    // accepted slot, so every survey anchor is still genuinely pending.
    installMemStorage();
    resetSystemFlightForInterstellarArrival({
      system: STORY_COORDINATE,
      activePlanetId: STORY_PRIMARY_WORLD_ID,
      locationMode: 'surface',
      pose: { position: [0, 0, 0], velocity: [0, 0, 0], quaternion: [0, 0, 0, 1] }
    });
    const world = { worldId: STORY_PRIMARY_WORLD_ID, seed: STORY_SEED };
    unbind?.();
    unbind = registerCommonGroundWorld({
      worldId: STORY_PRIMARY_WORLD_ID,
      footing: flatGround,
      extraSolids: []
    });
    // The world's restore runs on entry exactly as CommonGroundWorld orders it,
    // and legitimately finds nothing. THAT is what makes this world's emptiness
    // a recorded fact rather than an unread initial snapshot.
    restoreCommonGroundForWorld(world);
    enterBeatThroughTheRealSeam('ch13-survey');
    expect(commonGroundSnapshot().survey.phase).toBe('idle');
    saveWorld(world);

    resetCommonGroundRuntime({ clearWorlds: true });
    resetSignedSceneAvRuntime('sandbox');
    restoreCommonGroundForWorld(world);
    enterBeatThroughTheRealSeam('ch13-survey');
    expect(commonGroundSnapshot().hydrated).toBe(true);

    // The offer's anchor cannot be jumped to, and the final proof is untouched:
    // it is still keyed to a durable milestone this save cannot hold.
    expect(activateSignedSceneAnchorById('anc.cg.route-offered')).toBe(false);
    expect(activateSignedSceneAnchorById('anc.cg.route-tested')).toBe(false);
    expect(hasMilestone(STORY_MILESTONES.ch13RouteTested)).toBe(false);
  });

  it('resumes a mid-TESTING Continue without replaying his walk or her offer', () => {
    // The other unfinished shape root named: the span is already offered and he
    // is out on it, and the save is still before `story:ch13-route-tested`.
    installMemStorage();
    resetSystemFlightForInterstellarArrival({
      system: STORY_COORDINATE,
      activePlanetId: STORY_PRIMARY_WORLD_ID,
      locationMode: 'surface',
      pose: { position: [0, 0, 0], velocity: [0, 0, 0], quaternion: [0, 0, 0, 1] }
    });
    const world = { worldId: STORY_PRIMARY_WORLD_ID, seed: STORY_SEED };
    unbind?.();
    unbind = registerCommonGroundWorld({
      worldId: STORY_PRIMARY_WORLD_ID,
      footing: flatGround,
      extraSolids: []
    });

    enterBeatThroughTheRealSeam('ch13-survey');
    seedCommonGroundActorPose(CG_POSES.W);
    standAt(CG_POSES.W);
    for (let frame = 0; frame < 20; frame += 1) tickCommonGround(0.016);
    expect(commitCommonGroundDemonstrationOffer()).toBe(true);
    standAt(CG_POSES.S);
    expect(commitCommonGroundSurveyStart()).toBe(true);
    for (const point of CG_ROUTE_SHORT.slice(1)) {
      standAt(point);
      tickCommonGround(0.016);
    }
    expect(commitCommonGroundSpanOffer()).toBe(true);
    for (let frame = 0; frame < 40; frame += 1) tickCommonGround(0.05);
    const phaseBefore = commonGroundSnapshot().survey.phase;
    expect(['offered', 'testing', 'held']).toContain(phaseBefore);
    const testedBefore = commonGroundSnapshot().survey.working?.testedPrefixCount ?? 0;
    const poseBefore = commonGroundSnapshot().survey.workerPose;
    expect(hasMilestone(STORY_MILESTONES.ch13RouteTested)).toBe(false);

    saveWorld(world);
    resetCommonGroundRuntime({ clearWorlds: true });
    resetSignedSceneAvRuntime('sandbox');
    resetCommonGroundActor();
    unbind?.();
    unbind = registerCommonGroundWorld({
      worldId: STORY_PRIMARY_WORLD_ID,
      footing: flatGround,
      extraSolids: []
    });
    restoreCommonGroundForWorld(world);
    enterBeatThroughTheRealSeam('ch13-survey');
    const resumed = commonGroundSnapshot();

    // His earned progress and his body survive; nothing is re-walked from zero.
    expect(resumed.survey.phase).toBe(phaseBefore);
    expect(resumed.survey.working?.offeredEndIndex).not.toBeNull();
    expect(resumed.survey.working?.testedPrefixCount ?? 0).toBe(testedBefore);
    if (poseBefore) expect(resumed.survey.workerPose).toMatchObject(poseBefore);

    // The old acts stay silent: her offer is not republished into the fresh
    // ledger and no receipt was manufactured for it.
    expect(activatedAnchors()).not.toContain('anc.cg.route-offered');
    expect(activatedAnchors()).not.toContain('anc.cg.survey-started');

    // And the test he is still performing keeps producing REAL new events. The
    // short route runs past the survey housing, so his sightline to the fixed
    // socket is genuinely occluded and the chapter publishes its signed hold —
    // an anchor that is ordered AFTER every predecessor this unfinished save
    // cannot hold a milestone for, and which was refused before this repair.
    standAt(CG_POSES.E);
    for (let frame = 0; frame < 200 && commonGroundSnapshot().survey.hold.reason == null; frame += 1) {
      tickCommonGround(0.05);
    }
    expect(commonGroundSnapshot().survey.hold.reason).toBe('reference-occluded-survey-housing');
    expect(activatedAnchors()).toContain('anc.cg.specific-hold');
    // The unfinished survey still holds NO final receipt: a real hold is a real
    // hold, and nothing here completes it.
    expect(hasMilestone(STORY_MILESTONES.ch13RouteTested)).toBe(false);
    expect(activatedAnchors()).not.toContain('anc.cg.route-tested');
  });

  it('resumes a mid-common Continue: an earned crossing is not a pending one', () => {
    // The same shape one beat later. A save taken after the reciprocal crossing
    // and reloaded before the far-reference offer holds the crossing's receipt;
    // it must not be replayed, and the offer she then actually makes must still
    // publish.
    markMilestone(STORY_MILESTONES.ch13ReciprocalCrossed);
    enterBeatThroughTheRealSeam('ch13-common');
    const snapshot = commonGroundSnapshot();
    snapshot.common.stage = 'holding-h';
    snapshot.common.terraUnits = CG_COMMON_ROUTE_UNITS;
    snapshot.common.comparisonProved = true;
    standAt(CG_POSES.T);
    expect(commitCommonGroundFinalReferenceOffer()).toBe(true);
    tickCommonGround(0.016);
    expect(activatedAnchors()).toContain('anc.cg.final-reference-offered');
    expect(activatedAnchors()).not.toContain('anc.cg.reciprocal-crossed');
  });
});

// --- PC-SAVE-OVERWRITTEN: an autosave must not destroy the world it left ------------
//
// Reproduces the loss the producer harvested from the actual run-4 capture:
// an earned, unfinished ch13 survey (phase drawing, 4 samples, 2.0905 walked,
// 1186 bytes) came back as `phase: "idle"`, 606 bytes, `working: null`.
//
// The ordering is the point, and the storage snapshot alone could not identify
// it: the write is NOT attributed to the Continue click here. Each stage of the
// real boot is stepped through separately so the exact frame that destroys the
// bytes is named.
describe('a partial ch13 survey survives the real Continue lifecycle', () => {
  const ORIGIN = { worldId: STORY_PRIMARY_WORLD_ID, seed: STORY_SEED };
  const SIBLING = { worldId: `${STORY_PRIMARY_WORLD_ID}:p1`, seed: 1600321158 };

  function standOnWorld(worldId: string): void {
    resetSystemFlightForInterstellarArrival({
      system: STORY_COORDINATE,
      activePlanetId: worldId,
      locationMode: 'surface',
      pose: { position: [0, 0, 0], velocity: [0, 0, 0], quaternion: [0, 0, 0, 1] }
    });
    unbind?.();
    unbind = registerCommonGroundWorld({ worldId, footing: flatGround, extraSolids: [] });
  }

  function savedSurvey(worldId: string): Record<string, unknown> | null {
    const raw = (globalThis as unknown as { localStorage: MemStorage })
      .localStorage.getItem(`pvx.v1.world.${worldId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { commonGround?: { survey?: Record<string, unknown> } };
    return parsed.commonGround?.survey ?? null;
  }

  /** Earn a genuine partial drawing on Origin. No fixture, no grant. */
  function earnPartialDrawing(): number {
    standOnWorld(STORY_PRIMARY_WORLD_ID);
    enterBeatThroughTheRealSeam('ch13-survey');
    seedCommonGroundActorPose(CG_POSES.W);
    standAt(CG_POSES.W);
    for (let frame = 0; frame < 20; frame += 1) tickCommonGround(0.016);
    expect(commitCommonGroundDemonstrationOffer()).toBe(true);
    standAt(CG_POSES.S);
    expect(commitCommonGroundSurveyStart()).toBe(true);
    for (const point of CG_ROUTE_SHORT.slice(1, 4)) {
      standAt(point);
      tickCommonGround(0.016);
    }
    tickCommonGround(0.016);
    const samples = commonGroundSnapshot().survey.working?.samples.length ?? 0;
    expect(commonGroundSnapshot().survey.phase).toBe('drawing');
    expect(samples).toBeGreaterThan(1);
    return samples;
  }

  it('names the exact frame that used to destroy the earned bytes', () => {
    installMemStorage();
    const drawn = earnPartialDrawing();
    saveWorld(ORIGIN);
    expect(savedSurvey(STORY_PRIMARY_WORLD_ID)).toMatchObject({ phase: 'drawing' });
    const earned = savedSurvey(STORY_PRIMARY_WORLD_ID)!;
    expect((earned.working as { samples: unknown[] }).samples).toHaveLength(drawn);

    // --- Continue: a cold runtime boots. Nothing has been restored yet. ------
    resetCommonGroundRuntime({ clearWorlds: true });
    resetSignedSceneAvRuntime('sandbox');
    resetCommonGroundActor();
    standOnWorld(STORY_PRIMARY_WORLD_ID);

    // THE FRAME. `restoreCommonGroundForWorld` is a world-keyed React effect and
    // has NOT run yet; something reads the chapter snapshot for the world the
    // app is still nominally on, and that read mints an empty initial snapshot for
    // Origin. No beat has been entered here, so the chapter does not own this
    // world — which is precisely what makes the value an uninitialized snapshot rather than
    // a fact. This is a read, not the Continue click, and not the world switch.
    const initialSnapshot = commonGroundSnapshot(STORY_PRIMARY_WORLD_ID);
    expect(initialSnapshot.hydrated).toBe(false);
    expect(initialSnapshot.survey.phase).toBe('idle');
    expect(isPristineCommonGround(initialSnapshot)).toBe(true);

    // Story entry meanwhile resolves to the sibling world and ch13-return —
    // exactly the beat and coordinate the capture recorded after Continue — so
    // App's world-change autosave writes the world it is LEAVING.
    standOnWorld(SIBLING.worldId);
    // The sibling is the ACTIVE world now, so its own restore effect runs and
    // legitimately finds nothing. Origin's never did.
    restoreCommonGroundForWorld(SIBLING);
    enterBeatThroughTheRealSeam('ch13-return');
    tickCommonGround(0.016);
    saveWorld(ORIGIN);

    // The earned bytes are still there. Previously this wrote phase "idle" with
    // `working: null` over four real samples.
    const afterAutosave = savedSurvey(STORY_PRIMARY_WORLD_ID);
    expect(afterAutosave).toMatchObject({ phase: 'drawing' });
    expect((afterAutosave!.working as { samples: unknown[] }).samples).toHaveLength(drawn);
    expect(afterAutosave!.working).toMatchObject({ walkedUnits: expect.any(Number) });
    expect((afterAutosave!.working as { walkedUnits: number }).walkedUnits).toBeGreaterThan(0);

    // The sibling world DID enter the chapter, so it writes its own — genuinely
    // empty — record, exactly as the capture shows for `-1,-1:p1`. What it must
    // never do is inherit Origin's drawing: no cross-world leak in either
    // direction.
    commonGroundSnapshot(SIBLING.worldId); // the sibling's own live read
    saveWorld(SIBLING);
    expect(savedSurvey(SIBLING.worldId)).toMatchObject({ phase: 'idle', working: null });
    expect(savedSurvey(STORY_PRIMARY_WORLD_ID)).toMatchObject({ phase: 'drawing' });
  });

  it('the initial snapshot does not shadow the payload staged behind it', () => {
    installMemStorage();
    const drawn = earnPartialDrawing();
    saveWorld(ORIGIN);
    resetCommonGroundRuntime({ clearWorlds: true });
    resetSignedSceneAvRuntime('sandbox');
    resetCommonGroundActor();
    standOnWorld(STORY_PRIMARY_WORLD_ID);

    // Initial snapshot first...
    expect(commonGroundSnapshot(STORY_PRIMARY_WORLD_ID).hydrated).toBe(false);

    // ...and only THEN the restore effect fires, exactly as CommonGroundWorld
    // orders it (a world-keyed useEffect, which runs after the first render).
    // The earned state must still win over the uninitialized snapshot minted ahead of it.
    restoreCommonGroundForWorld(ORIGIN);
    enterBeatThroughTheRealSeam('ch13-survey');
    tickCommonGround(0.016);
    const resumed = commonGroundSnapshot(STORY_PRIMARY_WORLD_ID);
    expect(resumed.hydrated).toBe(true);
    expect(resumed.survey.phase).toBe('drawing');
    expect(resumed.survey.working?.samples).toHaveLength(drawn);
    expect(resumed.survey.working?.samples[0]).toMatchObject({
      x: CG_POSES.S.x, z: CG_POSES.S.z
    });

    // Silent restore: nothing already earned is replayed into fresh AV history.
    expect(activatedAnchors()).not.toContain('anc.cg.survey-started');
    expect(activatedAnchors()).not.toContain('anc.cg.demonstration-opened');

    // And a NEW real act is live and activates its own AV.
    for (const point of CG_ROUTE_SHORT.slice(4)) {
      standAt(point);
      tickCommonGround(0.016);
    }
    standAt(CG_POSES.E);
    expect(commitCommonGroundSpanOffer()).toBe(true);
    tickCommonGround(0.016);
    expect(commonGroundSnapshot().survey.phase).toBe('offered');
    expect(activatedAnchors()).toContain('anc.cg.route-offered');
  });

  it('a lawful continuous save with its earned predecessor resumes the survey', () => {
    // The run-4 fixture seeded ch13-fault-reviewed and ch13-return-chosen but
    // never `story:ch13-origin-landed`, and `storyEntryPoint` resolves exactly
    // that set to ch13-return. Resuming at the boarding beat was therefore
    // LAWFUL for those milestones — a fixture predecessor gap, not a wrong-world
    // selection bug. With the earned predecessor present, the same bytes resume
    // in the survey.
    installMemStorage();
    markMilestone(STORY_MILESTONES.ch13FaultReviewed);
    markMilestone(STORY_MILESTONES.ch13ReturnChosen);
    expect(storyEntryPoint()).toMatchObject({ chapter: 'ch13', beat: 'ch13-return' });
    markMilestone(STORY_MILESTONES.ch13OriginLanded);
    expect(storyEntryPoint()).toMatchObject({ chapter: 'ch13', beat: 'ch13-survey' });

    const drawn = earnPartialDrawing();
    saveWorld(ORIGIN);
    resetCommonGroundRuntime({ clearWorlds: true });
    resetSignedSceneAvRuntime('sandbox');
    resetCommonGroundActor();
    standOnWorld(STORY_PRIMARY_WORLD_ID);
    restoreCommonGroundForWorld(ORIGIN);
    enterBeatThroughTheRealSeam(
      storyEntryPoint().beat as 'ch13-survey'
    );
    tickCommonGround(0.016);

    const resumed = commonGroundSnapshot();
    expect(resumed.hydrated).toBe(true);
    expect(resumed.survey.phase).toBe('drawing');
    expect(resumed.survey.working?.samples).toHaveLength(drawn);
    // Still no manufactured completion receipt.
    expect(hasMilestone(STORY_MILESTONES.ch13RouteTested)).toBe(false);
    // The pose the save recorded is where he stands, not a replayed journey.
    saveWorld(ORIGIN);
    expect(savedSurvey(STORY_PRIMARY_WORLD_ID)).toMatchObject({ phase: 'drawing' });
  });

  it('retains, but never grafts, another actor\'s payload on disk', () => {
    installMemStorage();
    earnPartialDrawing();
    saveWorld(ORIGIN);
    // Rewrite the ACTUAL stored record so the foreign owner is what the real
    // restore route finds; nothing is staged by hand here.
    const store = (globalThis as unknown as { localStorage: MemStorage }).localStorage;
    const key = `pvx.v1.world.${STORY_PRIMARY_WORLD_ID}`;
    const record = JSON.parse(store.getItem(key)!) as { commonGround: { actorId: string } };
    record.commonGround.actorId = 'someone-else';
    store.setItem(key, JSON.stringify(record));
    const foreign = savedSurvey(STORY_PRIMARY_WORLD_ID);
    expect(foreign).toMatchObject({ phase: 'drawing' });

    resetCommonGroundRuntime({ clearWorlds: true });
    resetCommonGroundActor();
    standOnWorld(STORY_PRIMARY_WORLD_ID);
    restoreCommonGroundForWorld(ORIGIN);

    // The validator rejects it and local state initializes instead...
    const local = commonGroundSnapshot(STORY_PRIMARY_WORLD_ID);
    expect(local.hydrated).toBe(false);
    expect(local.survey.phase).toBe('idle');
    expect(local.actorId).not.toBe('someone-else');

    // ...and rejecting a payload is a hydration decision, never a licence for
    // this actor's empty state to erase the other actor's bytes.
    saveWorld(ORIGIN);
    expect(savedSurvey(STORY_PRIMARY_WORLD_ID)).toEqual(foreign);
    // Still true after further ordinary autosaves.
    saveWorld(ORIGIN);
    expect(savedSurvey(STORY_PRIMARY_WORLD_ID)).toEqual(foreign);
  });

  /** The whole stored chapter field, not just its survey. */
  function savedChapter(worldId: string): unknown {
    const raw = (globalThis as unknown as { localStorage: MemStorage })
      .localStorage.getItem(`pvx.v1.world.${worldId}`);
    if (!raw) return undefined;
    return (JSON.parse(raw) as { commonGround?: unknown }).commonGround;
  }

  it('an EARLIER empty restore never licenses erasing a payload read later', () => {
    // Ownership has a lifetime. This world answered "nothing here" once, which
    // lawfully lets emptiness be saved. Later, IN THE SAME SESSION, a present
    // payload is actually read for it. That newer read cannot borrow the older
    // absent answer: if the validator rejects the payload, the empty local
    // state must NOT be allowed to write itself over bytes that are really there.
    installMemStorage();
    const drawn = earnPartialDrawing();
    saveWorld(ORIGIN);
    const store = (globalThis as unknown as { localStorage: MemStorage }).localStorage;
    const key = `pvx.v1.world.${STORY_PRIMARY_WORLD_ID}`;
    const record = JSON.parse(store.getItem(key)!) as { commonGround: { actorId: string } };
    record.commonGround.actorId = 'someone-else';
    const arrivesLater = JSON.stringify(record);
    store.removeItem(key);

    // --- a session that first reads this world while it is genuinely empty ---
    resetCommonGroundRuntime({ clearWorlds: true });
    resetSignedSceneAvRuntime('sandbox');
    resetCommonGroundActor();
    standOnWorld(STORY_PRIMARY_WORLD_ID);
    restoreCommonGroundForWorld(ORIGIN); // absent: a real answer
    enterBeatThroughTheRealSeam('ch13-survey');
    tickCommonGround(0.016);
    // Emptiness is a fact after that read, and it may lawfully be saved.
    expect(isPristineCommonGround(commonGroundSnapshot(STORY_PRIMARY_WORLD_ID))).toBe(false);
    saveWorld(ORIGIN);
    expect(savedSurvey(STORY_PRIMARY_WORLD_ID)).toMatchObject({ phase: 'idle' });

    // --- the same world now really does hold a payload, and it is READ -------
    store.setItem(key, arrivesLater);
    const foreign = savedSurvey(STORY_PRIMARY_WORLD_ID);
    expect(foreign).toMatchObject({ phase: 'drawing' });
    expect((foreign!.working as { samples: unknown[] }).samples).toHaveLength(drawn);
    restoreCommonGroundForWorld(ORIGIN);

    // The validator rejects it and local state initializes, exactly as before...
    const local = commonGroundSnapshot(STORY_PRIMARY_WORLD_ID);
    expect(local.hydrated).toBe(false);
    expect(local.survey.phase).toBe('idle');
    expect(local.actorId).not.toBe('someone-else');
    // ...but the stale absent answer does not survive the newer present read.
    expect(isPristineCommonGround(local)).toBe(true);
    saveWorld(ORIGIN);
    expect(savedSurvey(STORY_PRIMARY_WORLD_ID)).toEqual(foreign);
    // Still true after further ordinary autosaves in the same session.
    saveWorld(ORIGIN);
    tickCommonGround(0.016);
    saveWorld(ORIGIN);
    expect(savedSurvey(STORY_PRIMARY_WORLD_ID)).toEqual(foreign);
  });

  it('keeps a MALFORMED payload read after an empty one, and still plays on', () => {
    installMemStorage();
    earnPartialDrawing();
    saveWorld(ORIGIN);
    const store = (globalThis as unknown as { localStorage: MemStorage }).localStorage;
    const key = `pvx.v1.world.${STORY_PRIMARY_WORLD_ID}`;
    const record = JSON.parse(store.getItem(key)!) as { commonGround: unknown };
    record.commonGround = { survey: 'not-a-record', common: 7 };
    const damaged = JSON.stringify(record);
    store.removeItem(key);

    resetCommonGroundRuntime({ clearWorlds: true });
    resetSignedSceneAvRuntime('sandbox');
    resetCommonGroundActor();
    standOnWorld(STORY_PRIMARY_WORLD_ID);
    restoreCommonGroundForWorld(ORIGIN); // absent
    enterBeatThroughTheRealSeam('ch13-survey');
    tickCommonGround(0.016);
    saveWorld(ORIGIN);

    store.setItem(key, damaged);
    const onDisk = savedChapter(STORY_PRIMARY_WORLD_ID);
    restoreCommonGroundForWorld(ORIGIN);
    const local = commonGroundSnapshot(STORY_PRIMARY_WORLD_ID);
    expect(local.hydrated).toBe(false);
    saveWorld(ORIGIN);
    // Unreadable is not empty: the damaged bytes are kept for a repair, not
    // silently replaced by this actor's idle state.
    expect(savedChapter(STORY_PRIMARY_WORLD_ID)).toEqual(onDisk);

    // And the chapter is not frozen by that: real new play still saves.
    seedCommonGroundActorPose(CG_POSES.W);
    standAt(CG_POSES.W);
    for (let f = 0; f < 20; f += 1) tickCommonGround(0.016);
    expect(commitCommonGroundDemonstrationOffer()).toBe(true);
    saveWorld(ORIGIN);
    expect(savedSurvey(STORY_PRIMARY_WORLD_ID))
      .toMatchObject({ phase: commonGroundSnapshot(STORY_PRIMARY_WORLD_ID).survey.phase });
    expect(savedSurvey(STORY_PRIMARY_WORLD_ID)).not.toBe('not-a-record');
    expect(savedChapter(STORY_PRIMARY_WORLD_ID)).not.toEqual(onDisk);
  });

  it('survives an autosave in the window between staging and hydration', () => {
    // A completed READ of a present payload is not proof it was validated. If
    // an autosave lands after the restore stages the bytes but before the next
    // tick consumes them, the uninitialized snapshot must still not answer for the world.
    installMemStorage();
    const drawn = earnPartialDrawing();
    saveWorld(ORIGIN);

    resetCommonGroundRuntime({ clearWorlds: true });
    resetSignedSceneAvRuntime('sandbox');
    resetCommonGroundActor();
    standOnWorld(STORY_PRIMARY_WORLD_ID);

    // Initial snapshot exists first, restore then stages the earned payload...
    enterBeatThroughTheRealSeam('ch13-survey');
    expect(commonGroundSnapshot(STORY_PRIMARY_WORLD_ID).hydrated).toBe(false);
    restoreCommonGroundForWorld(ORIGIN);

    // ...and the autosave lands HERE, before any tick consumes it.
    saveWorld(ORIGIN);
    expect(savedSurvey(STORY_PRIMARY_WORLD_ID)).toMatchObject({ phase: 'drawing' });

    // The very next tick then hydrates it, and it is still all there.
    tickCommonGround(0.016);
    const resumed = commonGroundSnapshot(STORY_PRIMARY_WORLD_ID);
    expect(resumed.hydrated).toBe(true);
    expect(resumed.survey.working?.samples).toHaveLength(drawn);
    saveWorld(ORIGIN);
    expect(savedSurvey(STORY_PRIMARY_WORLD_ID)).toMatchObject({ phase: 'drawing' });
  });

  it('never lets a late payload overwrite genuinely newer live work', () => {
    installMemStorage();
    earnPartialDrawing();
    saveWorld(ORIGIN);
    const stale = JSON.parse(
      (globalThis as unknown as { localStorage: MemStorage })
        .localStorage.getItem(`pvx.v1.world.${STORY_PRIMARY_WORLD_ID}`)!
    ) as { commonGround: unknown };

    // Live work continues past the save, then the old bytes arrive late.
    for (const point of CG_ROUTE_SHORT.slice(4)) {
      standAt(point);
      tickCommonGround(0.016);
    }
    const live = commonGroundSnapshot().survey.working?.samples.length ?? 0;
    stageCommonGroundWorldPayload(STORY_PRIMARY_WORLD_ID, stale.commonGround);
    const after = commonGroundSnapshot(STORY_PRIMARY_WORLD_ID);
    expect(after.survey.working?.samples).toHaveLength(live);
    expect(after.hydrated).toBe(false); // still the live run, not a restore
  });

  it('an explicit world clear still removes the record', () => {
    // Retention must not become immortality: the deliberate reset path is
    // unchanged, and it takes the whole record with it.
    installMemStorage();
    earnPartialDrawing();
    saveWorld(ORIGIN);
    expect(savedSurvey(STORY_PRIMARY_WORLD_ID)).not.toBeNull();
    clearWorldStateForWorld(ORIGIN);
    expect(savedSurvey(STORY_PRIMARY_WORLD_ID)).toBeNull();
    saveWorld(ORIGIN);
    expect(savedSurvey(STORY_PRIMARY_WORLD_ID)).toBeNull();
  });
});

// --- Regression guards for the ownership signal itself --------------------------------
describe('beat entry is not proof that a world was restored', () => {
  const ORIGIN = { worldId: STORY_PRIMARY_WORLD_ID, seed: STORY_SEED };

  function savedSurveyPhase(): string | undefined {
    const raw = (globalThis as unknown as { localStorage: MemStorage })
      .localStorage.getItem(`pvx.v1.world.${STORY_PRIMARY_WORLD_ID}`);
    if (!raw) return undefined;
    return (JSON.parse(raw) as {
      commonGround?: { survey?: { phase?: string } };
    }).commonGround?.survey?.phase;
  }

  function standOrigin(): void {
    resetSystemFlightForInterstellarArrival({
      system: STORY_COORDINATE,
      activePlanetId: STORY_PRIMARY_WORLD_ID,
      locationMode: 'surface',
      pose: { position: [0, 0, 0], velocity: [0, 0, 0], quaternion: [0, 0, 0, 1] }
    });
    unbind?.();
    unbind = registerCommonGroundWorld({
      worldId: STORY_PRIMARY_WORLD_ID, footing: flatGround, extraSolids: []
    });
  }

  function earn(): number {
    standOrigin();
    restoreCommonGroundForWorld(ORIGIN);
    enterBeatThroughTheRealSeam('ch13-survey');
    seedCommonGroundActorPose(CG_POSES.W);
    standAt(CG_POSES.W);
    for (let f = 0; f < 20; f += 1) tickCommonGround(0.016);
    expect(commitCommonGroundDemonstrationOffer()).toBe(true);
    standAt(CG_POSES.S);
    expect(commitCommonGroundSurveyStart()).toBe(true);
    for (const point of CG_ROUTE_SHORT.slice(1, 4)) {
      standAt(point);
      tickCommonGround(0.016);
    }
    tickCommonGround(0.016);
    return commonGroundSnapshot().survey.working?.samples.length ?? 0;
  }

  it('entering the booting beat BEFORE the restore still keeps the earned bytes', () => {
    // The exact ordering root flagged: the director enters ch13-survey on the
    // booting world first, and only afterwards does the world-keyed restore
    // effect stage the saved payload. If beat entry counted as ownership, the
    // uninitialized snapshot would be authoritative and would overwrite the save again.
    installMemStorage();
    const drawn = earn();
    saveWorld(ORIGIN);
    expect(savedSurveyPhase()).toBe('drawing');

    resetCommonGroundRuntime({ clearWorlds: true });
    resetSignedSceneAvRuntime('sandbox');
    resetCommonGroundActor();
    standOrigin();

    // Beat entry FIRST, restore later.
    enterBeatThroughTheRealSeam('ch13-survey');
    tickCommonGround(0.016);
    expect(commonGroundSnapshot(STORY_PRIMARY_WORLD_ID).hydrated).toBe(false);
    expect(isPristineCommonGround(commonGroundSnapshot(STORY_PRIMARY_WORLD_ID))).toBe(true);

    // An autosave landing in this window must not destroy the drawing.
    saveWorld(ORIGIN);
    expect(savedSurveyPhase()).toBe('drawing');

    // And when the restore finally runs, the earned state takes over.
    restoreCommonGroundForWorld(ORIGIN);
    tickCommonGround(0.016);
    const resumed = commonGroundSnapshot(STORY_PRIMARY_WORLD_ID);
    expect(resumed.hydrated).toBe(true);
    expect(resumed.survey.working?.samples).toHaveLength(drawn);
    saveWorld(ORIGIN);
    expect(savedSurveyPhase()).toBe('drawing');
  });

  it('a completed restore that finds nothing DOES make emptiness a fact', () => {
    // The other side of the same signal: a legacy or brand-new record with no
    // chapter field is a real answer, and the world may then write itself.
    installMemStorage();
    standOrigin();
    restoreCommonGroundForWorld(ORIGIN);
    enterBeatThroughTheRealSeam('ch13-survey');
    tickCommonGround(0.016);
    expect(isPristineCommonGround(commonGroundSnapshot(STORY_PRIMARY_WORLD_ID))).toBe(false);
    saveWorld(ORIGIN);
    expect(savedSurveyPhase()).toBe('idle');
  });

  it('a legitimately new action after a bare entry is never dropped', () => {
    installMemStorage();
    standOrigin();
    // No restore has run; the snapshot starts as an initial snapshot...
    enterBeatThroughTheRealSeam('ch13-survey');
    expect(isPristineCommonGround(commonGroundSnapshot())).toBe(true);
    // ...but real play immediately makes it authoritative, initial snapshot or not.
    seedCommonGroundActorPose(CG_POSES.W);
    standAt(CG_POSES.W);
    for (let f = 0; f < 20; f += 1) tickCommonGround(0.016);
    expect(commitCommonGroundDemonstrationOffer()).toBe(true);
    expect(isPristineCommonGround(commonGroundSnapshot())).toBe(false);
    saveWorld(ORIGIN);
    expect(savedSurveyPhase()).not.toBe(undefined);
  });

  it('the explicit scoped clear removes the stored chapter field for good', () => {
    installMemStorage();
    earn();
    saveWorld(ORIGIN);
    expect(savedSurveyPhase()).toBe('drawing');

    clearCommonGroundForWorld(ORIGIN);
    expect(savedSurveyPhase()).toBeUndefined();
    // Carry-forward must not resurrect it on the next save, or on a reload.
    saveWorld(ORIGIN);
    expect(savedSurveyPhase()).toBeUndefined();
    restoreCommonGroundForWorld(ORIGIN);
    enterBeatThroughTheRealSeam('ch13-survey');
    expect(commonGroundSnapshot().survey.phase).toBe('idle');
    expect(commonGroundSnapshot().hydrated).toBe(false);
    saveWorld(ORIGIN);
    expect(savedSurveyPhase()).toBe('idle');
  });
});
