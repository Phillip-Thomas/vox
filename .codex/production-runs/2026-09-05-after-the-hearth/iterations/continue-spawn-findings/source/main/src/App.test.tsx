import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  STORY_PRIMARY_WORLD_ID,
  TIDEGARDEN_WORLD_ID,
  resolveStoryBootWorldId,
  resolveStoryRuntimeWorldId
} from './story/tidegardenRoute.ts';
import { STORY_COORDINATE } from './story/world/storyWorldIdentity.ts';
import {
  commitSystemBodyTarget,
  commitSystemPlanetHandoff,
  getSystemFlightSnapshot,
  resetSystemFlightForInterstellarArrival,
  resetSystemFlightStoreForTests,
  setActiveSystemPlanet
} from './state/systemFlight.ts';

/**
 * CG-IMPL-013 — the ch13 return crossing, at the seam App.tsx actually uses.
 *
 * MEASURED on hardware (90 s, headed ANGLE GB10, 340 samples): the ship twice
 * flew from the departure world into the origin's activation envelope (centre
 * distance 181.23, then 169.09, both inside the 185 activation radius), the
 * generic same-system handoff COMMITTED — `activePlanetId` and `renderOrigin`
 * became the origin's, `locationMode` 'atmosphere', target cleared — and then
 * `activePlanetId` went back to the departure world, the pose returned to the
 * hearth boarding pad, and `activationEpoch` advanced twice per attempt (3->5,
 * 6->8). It never landed.
 *
 * The cause is not the flight, the aim cone, the speed budget or the readiness
 * shell: it is that `resolveStoryRuntimeWorldId` still answered the DEPARTURE
 * world for `ch13-return` after the handoff had committed, which is what makes
 * App's `storyWorldSwapPending` true and drives the story-world swap effect that
 * re-seats the ship.
 *
 * These tests drive the REAL system-flight store through the REAL commit the app
 * performs (`commitSystemPlanetHandoff` from `beginPreparedSystemTargetHandoff`'s
 * `onMidpoint`), and then evaluate App's own seam expression against the REAL
 * resolver. Nothing is mocked, and no director walk stands in for the sequence.
 */

const ORIGIN = STORY_PRIMARY_WORLD_ID;
const HEARTH = TIDEGARDEN_WORLD_ID;
const ORIGIN_ADDRESS = { system: STORY_COORDINATE, slot: 0 } as const;
const point = (beat: string | null, chapter = 'ch13') => ({ chapter, beat });

/**
 * `App.tsx` lines 537-545, transcribed: the runtime world id, then the swap
 * predicate that fires the story-world swap effect at 622-634.
 */
function appStoryWorldSeam(
  currentWorldId: string,
  routeOnline: boolean,
  storyPoint: { chapter: string; beat: string | null }
) {
  const storyRuntimeWorldId = resolveStoryRuntimeWorldId(
    currentWorldId,
    routeOnline,
    storyPoint,
    getSystemFlightSnapshot().activePlanetId
  );
  return {
    storyRuntimeWorldId,
    storyWorldSwapPending: storyRuntimeWorldId !== currentWorldId
  };
}

/** The launch state: in the departure world's system, on its planet. */
function cruisingFromDeparture(): void {
  resetSystemFlightForInterstellarArrival({
    system: STORY_COORDINATE,
    activePlanetId: HEARTH,
    locationMode: 'local_space',
    pose: { position: [2180, -110, -1635], velocity: [0, 0, 0], quaternion: [0, 0, 0, 1] }
  });
}

/** The shipped handoff, exactly as `onMidpoint` performs it. */
function commitArrivalAtOrigin(): number {
  const activationEpoch = commitSystemBodyTarget(ORIGIN_ADDRESS);
  return commitSystemPlanetHandoff({
    worldId: ORIGIN,
    renderOrigin: [0, 0, 0],
    expectedActivationEpoch: activationEpoch
  });
}

describe('the ch13 return crossing keeps the world its own handoff committed', () => {
  beforeEach(() => {
    cruisingFromDeparture();
  });

  afterEach(() => {
    resetSystemFlightStoreForTests();
  });

  it('does not claim the destination before the flight has earned it', () => {
    // Still cruising: the app is in the departure world and the flight store
    // still names the departure planet. Nothing may pre-place her at the origin.
    const seam = appStoryWorldSeam(HEARTH, true, point('ch13-return'));
    expect(seam.storyRuntimeWorldId).toBe(HEARTH);
    expect(seam.storyWorldSwapPending).toBe(false);
    expect(getSystemFlightSnapshot().activePlanetId).toBe(HEARTH);
  });

  it('holds the origin after the real handoff commits, and does not reclaim the hearth', () => {
    const before = getSystemFlightSnapshot().activationEpoch;
    const activationEpoch = commitArrivalAtOrigin();

    // The generic handoff itself is unchanged and still works.
    const flight = getSystemFlightSnapshot();
    expect(flight.activePlanetId).toBe(ORIGIN);
    expect(flight.lastActivePlanetId).toBe(ORIGIN);
    expect(flight.locationMode).toBe('atmosphere');
    expect(flight.target).toBeNull();
    expect(flight.renderOrigin).toEqual([0, 0, 0]);
    // One aim + one commit. The measured capture showed +2 per attempt because
    // a second mutator ran; there must be no reclaim here.
    expect(activationEpoch).toBe(before + 2);

    // App's own seam, on the committed state: no swap is pending, so the
    // story-world swap effect never runs and ShipController is never handed the
    // hearth again.
    const seam = appStoryWorldSeam(ORIGIN, true, point('ch13-return'));
    expect(seam.storyRuntimeWorldId).toBe(ORIGIN);
    expect(seam.storyWorldSwapPending).toBe(false);
  });

  it('keeps the landed beats on the origin, so the landing sticks', () => {
    commitArrivalAtOrigin();
    for (const beat of ['ch13-survey', 'ch13-common']) {
      const seam = appStoryWorldSeam(ORIGIN, true, point(beat));
      expect(seam.storyRuntimeWorldId).toBe(ORIGIN);
      expect(seam.storyWorldSwapPending).toBe(false);
    }
  });

  it('reproduces the measured reclaim if the second mutator runs anyway', () => {
    commitArrivalAtOrigin();
    // `ShipController.tsx:472-473` — the call the telemetry pinned as the second
    // epoch increment. If anything ever re-seats the active planet, the crossing
    // is no longer committed and the resolver must NOT pretend it is.
    setActiveSystemPlanet(HEARTH);
    const seam = appStoryWorldSeam(ORIGIN, true, point('ch13-return'));
    expect(seam.storyRuntimeWorldId).toBe(HEARTH);
    expect(seam.storyWorldSwapPending).toBe(true);
  });

  it('stays uncommitted while the runtime and the flight store disagree', () => {
    // World swapped, flight store has not: this is exactly the half-state the
    // resolver must refuse to honour.
    expect(
      resolveStoryRuntimeWorldId(ORIGIN, true, point('ch13-return'), HEARTH)
    ).toBe(HEARTH);
    // Flight store swapped, world has not.
    commitArrivalAtOrigin();
    expect(
      resolveStoryRuntimeWorldId(HEARTH, true, point('ch13-return'), ORIGIN)
    ).toBe(HEARTH);
  });

  it('refuses the crossing rule entirely when the route is not online', () => {
    commitArrivalAtOrigin();
    expect(
      resolveStoryRuntimeWorldId(ORIGIN, false, point('ch13-return'), ORIGIN)
    ).toBe(ORIGIN);
    // ...and the same offline answer is the boot resolver's, not a crossing
    // exception: an offline route can never own the sibling world.
    expect(resolveStoryBootWorldId(ORIGIN, false, point('ch13-return'))).toBe(ORIGIN);
  });

  it('leaves a reload mid-crossing on the world the ship launched from', () => {
    commitArrivalAtOrigin();
    // The boot resolver is deliberately untouched: a Continue during the
    // crossing restarts from the hearth and the flight must be flown again.
    // If this ever answers the origin, arrival has been granted, not earned.
    expect(resolveStoryBootWorldId(HEARTH, true, point('ch13-return'))).toBe(HEARTH);
    expect(resolveStoryBootWorldId(ORIGIN, true, point('ch13-return'))).toBe(HEARTH);
  });
});

describe('the other crossings are unchanged', () => {
  afterEach(() => {
    resetSystemFlightStoreForTests();
  });

  it('ch10-ask still commits and holds the origin', () => {
    cruisingFromDeparture();
    commitArrivalAtOrigin();
    const seam = appStoryWorldSeam(ORIGIN, true, point('ch10-ask', 'ch10'));
    expect(seam.storyRuntimeWorldId).toBe(ORIGIN);
    expect(seam.storyWorldSwapPending).toBe(false);
  });

  it('ch8-crossing still commits and holds the hearth', () => {
    resetSystemFlightForInterstellarArrival({
      system: STORY_COORDINATE,
      activePlanetId: null,
      locationMode: 'local_space',
      pose: { position: [0, 0, 0], velocity: [0, 0, 0], quaternion: [0, 0, 0, 1] }
    });
    const activationEpoch = commitSystemBodyTarget({ system: STORY_COORDINATE, slot: 1 });
    commitSystemPlanetHandoff({
      worldId: HEARTH,
      renderOrigin: [2180, -110, -1635],
      expectedActivationEpoch: activationEpoch
    });
    const seam = appStoryWorldSeam(HEARTH, true, point('ch8-crossing', 'ch8'));
    expect(seam.storyRuntimeWorldId).toBe(HEARTH);
    expect(seam.storyWorldSwapPending).toBe(false);
  });

  it('a beat that is not a crossing gets the boot answer, committed or not', () => {
    cruisingFromDeparture();
    commitArrivalAtOrigin();
    // ch13-home is at the restored second hearth; a committed origin handoff
    // must not turn a non-crossing beat into one.
    expect(resolveStoryRuntimeWorldId(ORIGIN, true, point('ch13-home'), ORIGIN))
      .toBe(resolveStoryBootWorldId(ORIGIN, true, point('ch13-home')));
    expect(resolveStoryRuntimeWorldId(ORIGIN, true, point(null), ORIGIN))
      .toBe(resolveStoryBootWorldId(ORIGIN, true, point(null)));
  });
});
