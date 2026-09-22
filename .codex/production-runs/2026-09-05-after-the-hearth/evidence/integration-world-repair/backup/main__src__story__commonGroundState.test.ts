import { describe, expect, it } from 'vitest';
import {
  COMMON_GROUND_SNAPSHOT_VERSION,
  MAX_TRACE_LENGTH_UNITS,
  MAX_TRACE_POINTS,
  appendTraceSample,
  clearUncommittedProposal,
  createCommonGroundSnapshot,
  createTraceSlot,
  hydrateCommonGround,
  invalidateTestedPrefix,
  lastTestedPoint,
  markTestedPrefix,
  migrateCommonGround,
  releaseLiveOccupancy,
  reviseTail,
  serializeCommonGround,
  walkedLength,
  acceptTestedRoute,
  accumulateTraceDistance,
  CG_POSES,
  CG_COMMON_ROUTE_UNITS,
  commonGroundCommonDisplay,
  commonGroundReferenceHeld
} from './commonGroundState.ts';

const sample = (x: number, z: number, corner = false) => ({ x, y: 51.05, z, corner });

function drawStraight(count: number): ReturnType<typeof createTraceSlot> {
  const slot = createTraceSlot(sample(-26, 12));
  for (let index = 1; index < count; index += 1) {
    accumulateTraceDistance(slot, 1);
    appendTraceSample(slot, sample(-26 - index, 12));
  }
  return slot;
}

function matches(actual: unknown, x: number, z: number): void {
  expect(actual).toMatchObject({ x, y: 51.05, z });
}

describe('trace capacity', () => {
  it('stops honestly at whichever cap binds first, without decimating', () => {
    const slot = drawStraight(MAX_TRACE_POINTS + 40);
    // At the qualified one-unit cadence the 120-unit length cap binds before the
    // 128-sample cap. BOTH bind; neither is allowed to thin what was walked.
    expect(slot.atCapacity).toBe(true);
    expect(slot.lengthUnits).toBeLessThanOrEqual(MAX_TRACE_LENGTH_UNITS);
    expect(slot.samples.length).toBeLessThanOrEqual(MAX_TRACE_POINTS);
    expect(slot.samples.length).toBe(MAX_TRACE_LENGTH_UNITS + 1);
    // The recorded samples are the ones actually walked, in order, unthinned.
    matches(slot.samples[1], -27, 12);
    matches(slot.samples[slot.samples.length - 1], -26 - (slot.samples.length - 1), 12);
  });

  it('stops at the length cap even when the sample cap is far away', () => {
    const slot = createTraceSlot(sample(0, 0));
    // 12-unit strides: the length cap (120) binds long before 128 samples.
    for (let index = 1; index < 60; index += 1) {
      accumulateTraceDistance(slot, 12);
      appendTraceSample(slot, sample(index * 12, 0));
    }
    expect(slot.atCapacity).toBe(true);
    expect(slot.walkedUnits).toBeLessThanOrEqual(120);
    expect(slot.samples.length).toBeLessThan(MAX_TRACE_POINTS);
  });

  it('charges wandering between samples against the cap', () => {
    const straight = createTraceSlot(sample(0, 0));
    accumulateTraceDistance(straight, 4);
    appendTraceSample(straight, sample(4, 0));

    const wandering = createTraceSlot(sample(0, 0));
    // She walked a wide loop and ended four units along. The trace records two
    // points either way; the 120-unit cap is about the walk, not the sampling.
    accumulateTraceDistance(wandering, 40);
    appendTraceSample(wandering, sample(4, 0));

    expect(straight.lengthUnits).toBeCloseTo(wandering.lengthUnits, 6);
    expect(wandering.walkedUnits).toBeGreaterThan(straight.walkedUnits);
    expect(wandering.walkedUnits).toBeCloseTo(40, 6);
  });

  it('records a corner inside the cadence spacing but rejects a duplicate point', () => {
    const slot = createTraceSlot(sample(-26, 12));
    accumulateTraceDistance(slot, 0.4);
    expect(appendTraceSample(slot, sample(-26, 12.3, true))).toBe('appended');
    expect(appendTraceSample(slot, sample(-26, 12.3, true))).toBe('too-close');
    expect(appendTraceSample(slot, sample(-26, 12.4))).toBe('too-close');
  });
});

describe('tail revision', () => {
  it('preserves the tested prefix and only bumps the revision on a real edit', () => {
    const slot = drawStraight(10);
    markTestedPrefix(slot, 4);
    slot.offeredEndIndex = slot.samples.length - 1;

    expect(reviseTail(slot, 3)).toBe(true);
    expect(slot.samples.length).toBe(4);
    expect(slot.testedPrefixCount).toBe(4);
    expect(slot.tailRevision).toBe(1);
    // Reopening withdraws the offer: the proposal is no longer what was offered.
    expect(slot.offeredEndIndex).toBeNull();

    // A second reopen at the same point changes nothing, so it is not an edit.
    expect(reviseTail(slot, 3)).toBe(false);
    expect(slot.tailRevision).toBe(1);
  });

  it('refuses to cut across the demonstrated argument', () => {
    const slot = drawStraight(10);
    markTestedPrefix(slot, 6);
    reviseTail(slot, 0);
    expect(slot.samples.length).toBe(6);
    expect(slot.testedPrefixCount).toBe(6);
  });

  it('never lowers the tested prefix, except on a real terrain invalidation', () => {
    const slot = drawStraight(10);
    markTestedPrefix(slot, 7);
    markTestedPrefix(slot, 3);
    expect(slot.testedPrefixCount).toBe(7);
    invalidateTestedPrefix(slot, 2);
    expect(slot.testedPrefixCount).toBe(2);
  });

  it('reports the last tested point as the honest revision point', () => {
    const slot = drawStraight(10);
    matches(lastTestedPoint(slot), -26, 12); // nothing tested yet -> S
    markTestedPrefix(slot, 5);
    matches(lastTestedPoint(slot), -30, 12);
  });

  it('gives back only the discarded tail\'s real walked distance', () => {
    const slot = createTraceSlot(sample(0, 0));
    accumulateTraceDistance(slot, 6); // wandered six units to reach one along
    appendTraceSample(slot, sample(1, 0));
    accumulateTraceDistance(slot, 1);
    appendTraceSample(slot, sample(2, 0));
    accumulateTraceDistance(slot, 20); // and wandered twenty more on the tail
    appendTraceSample(slot, sample(3, 0));
    markTestedPrefix(slot, 2);

    expect(slot.walkedUnits).toBeCloseTo(27, 6);
    reviseTail(slot, 1);
    // Reaching the last tested sample cost six units of actual walking, and
    // that stands; only the tail's twenty are given back.
    expect(slot.walkedUnits).toBeCloseTo(6, 6);
    expect(slot.pendingUnits).toBe(0);
  });
});

describe('hydration', () => {
  function completed(): Record<string, unknown> {
    const snapshot = createCommonGroundSnapshot('actor-a', 'world-a');
    snapshot.home.faultReviewed = true;
    snapshot.home.returnChosen = true;
    const slot = drawStraight(6);
    markTestedPrefix(slot, slot.samples.length);
    slot.offeredEndIndex = slot.samples.length - 1;
    snapshot.survey.working = slot;
    snapshot.survey.approached = true;
    acceptTestedRoute(snapshot, 'held-reference');
    snapshot.common.stage = 'arrived';
    snapshot.common.terraUnits = 18;
    snapshot.common.workerUnits = 18;
    snapshot.common.workerPose = { x: -48, y: 51.05, z: 12 };
    snapshot.common.comparisonProved = true;
    snapshot.common.finalReferenceOffered = true;
    snapshot.common.finalReferenceOccupied = true;
    snapshot.common.committed = true;
    return serializeCommonGround(snapshot) as Record<string, unknown>;
  }

  function mutated(mutate: (value: Record<string, unknown>) => void): Record<string, unknown> {
    const value = completed();
    mutate(value);
    return value;
  }

  const hydrate = (value: unknown) => hydrateCommonGround(value, 'actor-a', 'world-a');

  it('accepts a consistent completed save whole', () => {
    const restored = hydrate(completed());
    expect(restored).not.toBeNull();
    expect(restored?.hydrated).toBe(true);
    expect(restored?.survey.accepted?.routeClass).toBe('held-reference');
    expect(restored?.survey.working).toBeNull();
    expect(restored?.common.committed).toBe(true);
    // Live-only facts are never restored; the body has to be there.
    expect(restored?.common.finalReferenceOccupied).toBe(false);
  });

  it('rejects a foreign actor or world outright rather than grafting', () => {
    expect(hydrateCommonGround(completed(), 'actor-b', 'world-a')).toBeNull();
    expect(hydrateCommonGround(completed(), 'actor-a', 'world-b')).toBeNull();
    expect(hydrate(mutated(value => { value.version = 99; }))).toBeNull();
  });

  it('rejects the whole snapshot when a structure is missing, never substituting an empty one', () => {
    expect(hydrate(mutated(value => { delete value.home; }))).toBeNull();
    expect(hydrate(mutated(value => { delete value.survey; }))).toBeNull();
    expect(hydrate(mutated(value => { delete value.common; }))).toBeNull();
  });

  it('rejects a malformed sample rather than keeping a partial trace', () => {
    const partial = mutated(value => {
      (value.survey as Record<string, unknown>).accepted = { samples: [{ x: 1, y: 2 }] };
    });
    // NOT "the slot becomes null": the entire snapshot is inconsistent.
    expect(hydrate(partial)).toBeNull();
  });

  it('rejects every impossible tuple a real run could not have produced', () => {
    const cases: Array<[string, (value: Record<string, unknown>) => void]> = [
      ['committed with no crossing', value => {
        (value.common as Record<string, unknown>).comparisonProved = false;
      }],
      ['a crossing that never reached eighteen units', value => {
        (value.common as Record<string, unknown>).terraUnits = 4;
      }],
      ['a completion he never walked', value => {
        (value.common as Record<string, unknown>).workerUnits = 3;
      }],
      ['a far reference offered before any comparison', value => {
        const common = value.common as Record<string, unknown>;
        common.comparisonProved = false;
        common.terraUnits = 0;
        common.committed = false;
      }],
      ['an accepted route with no earned class', value => {
        const accepted = (value.survey as Record<string, unknown>).accepted as Record<string, unknown>;
        accepted.routeClass = null;
      }],
      ['a class on a half-tested route', value => {
        const accepted = (value.survey as Record<string, unknown>).accepted as Record<string, unknown>;
        accepted.testedPrefixCount = 2;
      }],
      ['an offered index past the end of the trace', value => {
        const accepted = (value.survey as Record<string, unknown>).accepted as Record<string, unknown>;
        accepted.offeredEndIndex = 99;
      }],
      ['a walked distance shorter than the geometry it stores', value => {
        const accepted = (value.survey as Record<string, unknown>).accepted as Record<string, unknown>;
        accepted.walkedUnits = 0.5;
      }],
      ['a walked distance beyond the cap', value => {
        const accepted = (value.survey as Record<string, unknown>).accepted as Record<string, unknown>;
        accepted.walkedUnits = 500;
      }],
      ['an invitation accepted but never opened', value => {
        (value.home as Record<string, unknown>).faultReviewed = false;
      }],
      ['a tested phase with nothing accepted', value => {
        (value.survey as Record<string, unknown>).accepted = null;
      }],
      ['a stage that presupposes an offer that was never made', value => {
        const common = value.common as Record<string, unknown>;
        common.finalReferenceOffered = false;
        common.committed = false;
        common.stage = 'testing';
      }],
      ['a live leg with no pose to resume it from', value => {
        const common = value.common as Record<string, unknown>;
        common.stage = 'testing';
        common.committed = false;
        common.workerPose = null;
      }]
    ];
    for (const [label, mutate] of cases) {
      expect(hydrate(mutated(mutate)), label).toBeNull();
    }
  });

  it('resumes an unfinished save without crediting a live leg or a live occupancy', () => {
    const snapshot = createCommonGroundSnapshot('actor-a', 'world-a');
    snapshot.home.faultReviewed = true;
    snapshot.home.returnChosen = true;
    const slot = drawStraight(6);
    markTestedPrefix(slot, 3);
    slot.offeredEndIndex = slot.samples.length - 1;
    snapshot.survey.working = slot;
    snapshot.survey.approached = true;
    snapshot.survey.phase = 'testing';
    // A live leg is only resumable if the save says where his body was.
    snapshot.survey.workerPose = { x: -30, y: 51.05, z: 12 };
    snapshot.survey.witness = {
      pose: { x: -34, y: 51.05, z: 10 }, offered: true, occupied: true, requiredFromIndex: 2
    };
    const restored = hydrate(serializeCommonGround(snapshot));
    expect(restored).not.toBeNull();
    expect(restored?.survey.working?.testedPrefixCount).toBe(3);
    expect(restored?.survey.witness?.offered).toBe(true);
    expect(restored?.survey.witness?.occupied).toBe(false);
    // He walked out to the start once, and that fact survives: a revision must
    // not replay the approach.
    expect(restored?.survey.approached).toBe(true);
    // His pose is a fact about a body that was somewhere, and it survives.
    expect(restored?.survey.workerPose).toEqual({ x: -30, y: 51.05, z: 12 });
    // The leg is PRESERVED, not collapsed: he was mid-test, and the reference
    // he needs is revalidated live on the next frame rather than forgiven.
    expect(restored?.survey.phase).toBe('testing');
  });

  it('refuses a live leg that has no pose to resume from', () => {
    const snapshot = createCommonGroundSnapshot('actor-a', 'world-a');
    snapshot.home.faultReviewed = true;
    snapshot.home.returnChosen = true;
    const slot = drawStraight(4);
    slot.offeredEndIndex = slot.samples.length - 1;
    snapshot.survey.working = slot;
    snapshot.survey.phase = 'testing';
    snapshot.survey.workerPose = null;
    expect(hydrate(serializeCommonGround(snapshot))).toBeNull();
  });

  it('resumes his final test at the units he actually walked', () => {
    const snapshot = createCommonGroundSnapshot('actor-a', 'world-a');
    snapshot.home.faultReviewed = true;
    snapshot.home.returnChosen = true;
    const slot = drawStraight(5);
    markTestedPrefix(slot, slot.samples.length);
    snapshot.survey.working = slot;
    snapshot.survey.approached = true;
    acceptTestedRoute(snapshot, 'fixed-reference');
    snapshot.common.stage = 'testing';
    snapshot.common.terraUnits = 18;
    snapshot.common.comparisonProved = true;
    snapshot.common.finalReferenceOffered = true;
    snapshot.common.workerUnits = 7.5;
    snapshot.common.workerPose = { x: -44, y: 51.05, z: 17 };

    const restored = hydrate(serializeCommonGround(snapshot));
    expect(restored).not.toBeNull();
    // NOT collapsed back to standing at H: he was mid-test, and the units he
    // walked are not given back by closing the game.
    expect(restored?.common.stage).toBe('testing');
    expect(restored?.common.workerUnits).toBeCloseTo(7.5, 6);
    expect(restored?.common.workerPose).toEqual({ x: -44, y: 51.05, z: 17 });
    expect(restored?.common.finalReferenceOccupied).toBe(false);
  });

  it('treats absent and legacy data as local initialization, never as a throw', () => {
    expect(migrateCommonGround(null, 'actor-a', 'world-a')).toBeNull();
    expect(migrateCommonGround({ habitat: {} }, 'actor-a', 'world-a')).toBeNull();
    expect(migrateCommonGround('legacy', 'actor-a', 'world-a')).toBeNull();
  });

  it('does not serialize live occupancy at all', () => {
    const written = completed() as {
      survey: { accepted: Record<string, unknown> };
      common: Record<string, unknown>;
    };
    expect(written.common).not.toHaveProperty('finalReferenceOccupied');
    expect(written).toMatchObject({ version: COMMON_GROUND_SNAPSHOT_VERSION });
  });
});

describe('scoped clearing', () => {
  it('clears only the working proposal and never the accepted route', () => {
    const snapshot = createCommonGroundSnapshot('actor-a', 'world-a');
    const first = drawStraight(5);
    markTestedPrefix(first, first.samples.length);
    snapshot.survey.working = first;
    acceptTestedRoute(snapshot, 'held-reference');

    snapshot.survey.working = drawStraight(8);
    markTestedPrefix(snapshot.survey.working, 4);
    snapshot.common.comparisonProved = true;
    snapshot.common.committed = true;

    clearUncommittedProposal(snapshot);

    expect(snapshot.survey.working?.samples.length).toBe(4);
    expect(snapshot.survey.accepted?.samples.length).toBe(5);
    expect(snapshot.survey.accepted?.routeClass).toBe('held-reference');
    expect(snapshot.common.comparisonProved).toBe(true);
    expect(snapshot.common.committed).toBe(true);
  });

  it('releases presentation occupancy without touching route data', () => {
    const snapshot = createCommonGroundSnapshot('actor-a', 'world-a');
    snapshot.survey.working = drawStraight(5);
    snapshot.survey.witness = {
      pose: { x: -34, y: 51.05, z: 10 }, offered: true, occupied: true, requiredFromIndex: 1
    };
    snapshot.common.finalReferenceOccupied = true;

    releaseLiveOccupancy(snapshot);

    expect(snapshot.survey.witness?.occupied).toBe(false);
    expect(snapshot.survey.witness?.offered).toBe(true);
    expect(snapshot.common.finalReferenceOccupied).toBe(false);
    expect(snapshot.survey.working?.samples.length).toBe(5);
  });
});

describe('walked length', () => {
  it('measures the walked span, not the endpoint separation', () => {
    // The common route's endpoints are 6 units apart; the passage is 18.
    const detour = [sample(-42, 12), sample(-42, 16), sample(-48, 16), sample(-48, 12)];
    expect(walkedLength(detour)).toBeCloseTo(4 + 6 + 4, 6);
    expect(walkedLength([detour[0], detour[3]])).toBeCloseTo(6, 6);
  });
});

// --- the common display is earned, never displayed into existence ---------------------

describe('the planned common guide appears only from a real body at H', () => {
  const at = (point: { x: number; y: number; z: number }, dx = 0) => ({
    x: point.x + dx, y: point.y, z: point.z
  });

  function common() {
    return createCommonGroundSnapshot('actor', 'origin');
  }

  it('shows nothing before the survey is even tested', () => {
    expect(commonGroundCommonDisplay(common())).toBe('none');
  });

  it('shows nothing while he is still WALKING to the reference', () => {
    const snapshot = common();
    snapshot.common.stage = 'positioning-to-h';
    snapshot.common.workerPose = at(CG_POSES.E, -1);
    expect(commonGroundCommonDisplay(snapshot)).toBe('none');
  });

  it('refuses a stage label whose body is not actually at H', () => {
    // The claim and the body have to agree. A snapshot that says "holding" while
    // he stands two units away is exactly the inconsistency the guide must not
    // reward with a visible line.
    const snapshot = common();
    snapshot.common.stage = 'holding-h';
    snapshot.common.workerPose = at(CG_POSES.H, 2);
    expect(commonGroundReferenceHeld(snapshot)).toBe(false);
    expect(commonGroundCommonDisplay(snapshot)).toBe('none');
    snapshot.common.workerPose = null;
    expect(commonGroundCommonDisplay(snapshot)).toBe('none');
  });

  it('never appears from elapsed time, route choice or her own scalar progress', () => {
    const snapshot = common();
    snapshot.common.stage = 'positioning-to-h';
    snapshot.common.workerPose = at(CG_POSES.E);
    snapshot.common.terraUnits = CG_COMMON_ROUTE_UNITS;
    snapshot.common.finalReferenceOffered = true;
    snapshot.common.finalReferenceOccupied = true;
    expect(commonGroundCommonDisplay(snapshot)).toBe('none');
  });

  it('appears at his ACTUAL arrival and stays PLANNED through both passages', () => {
    const snapshot = common();
    snapshot.common.stage = 'holding-h';
    snapshot.common.workerPose = at(CG_POSES.H);
    expect(commonGroundCommonDisplay(snapshot)).toBe('planned-guide');
    // Her full eighteen units do not promote it: her passage is her proof, not
    // his test, and a displayed line is never either.
    snapshot.common.terraUnits = CG_COMMON_ROUTE_UNITS;
    snapshot.common.comparisonProved = true;
    expect(commonGroundCommonDisplay(snapshot)).toBe('planned-guide');
    snapshot.common.stage = 'positioning-to-e';
    expect(commonGroundCommonDisplay(snapshot)).toBe('planned-guide');
    // Nor does his test, right up to the last fraction of the last unit.
    snapshot.common.stage = 'testing';
    snapshot.common.workerUnits = CG_COMMON_ROUTE_UNITS - 0.01;
    expect(commonGroundCommonDisplay(snapshot)).toBe('planned-guide');
  });

  it('promotes to paired tested geometry only from a validated commit', () => {
    const snapshot = common();
    snapshot.common.stage = 'testing';
    snapshot.common.comparisonProved = true;
    snapshot.common.workerUnits = CG_COMMON_ROUTE_UNITS;
    expect(commonGroundCommonDisplay(snapshot)).toBe('planned-guide');
    snapshot.common.committed = true;
    snapshot.common.stage = 'arrived';
    expect(commonGroundCommonDisplay(snapshot)).toBe('tested-common');
  });

  it('writes nothing: choosing a display is a read, not a fact', () => {
    const snapshot = common();
    snapshot.common.stage = 'holding-h';
    snapshot.common.workerPose = at(CG_POSES.H);
    const before = JSON.stringify(snapshot);
    commonGroundCommonDisplay(snapshot);
    commonGroundCommonDisplay(snapshot);
    expect(JSON.stringify(snapshot)).toBe(before);
    // In particular it seeds no survey samples and no route.
    expect(snapshot.survey.accepted).toBeNull();
    expect(snapshot.survey.working).toBeNull();
    expect(snapshot.common.terraUnits).toBe(0);
  });

  it('survives a reload the same way, because it reads the pose that was saved', () => {
    const snapshot = common();
    snapshot.common.stage = 'holding-h';
    snapshot.common.workerPose = { ...CG_POSES.H };
    const restored = hydrateCommonGround(
      JSON.parse(JSON.stringify(serializeCommonGround(snapshot))), 'actor', 'origin'
    );
    expect(restored).not.toBeNull();
    expect(commonGroundCommonDisplay(restored!)).toBe('planned-guide');
    // And a restored snapshot cannot conjure the completed display.
    expect(restored!.common.committed).toBe(false);
  });
});
