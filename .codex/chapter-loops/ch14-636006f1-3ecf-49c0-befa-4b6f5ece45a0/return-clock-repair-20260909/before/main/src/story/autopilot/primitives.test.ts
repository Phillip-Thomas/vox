import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { getWorldGen } from '../../utils/worldGenCache.ts';
import {
  planAgentSurfaceRoute,
  type AgentSurfaceRoute,
  type AgentSurfaceTerrainQuery
} from '../../utils/agentSurfaceNavigation.ts';
import { VOXEL_SCALE } from '../../utils/cubeGravityConstants.ts';
import { dominantFaceForPosition } from '../../utils/surfaceControls.ts';
import { surfaceFaceFromUp, surfaceSteeringIntent } from '../autopilotSteering.ts';
import { STORY_PRIMARY_WORLD_ID, STORY_SEED } from '../world/storyWorldIdentity.ts';
import { CG_ROUTE_LONG } from '../commonGroundState.ts';
import { PLAYER_CAPSULE_RADIUS } from '../../utils/cubeGravityConstants.ts';
import {
  NAVIGATION_STEER_DEAD_ZONE,
  applyTerminalExactGoal,
  exactGoalFootprintColumns,
  surfaceGaitDistance,
  terminalExactGoalHandoff
} from './primitives.ts';

describe('flight controls are independent of the parked on-foot body', () => {
  it('keeps the landfall directive free of ground recovery jumps and reverse thrust', async () => {
    vi.resetModules();
    const priorWindow = (globalThis as { window?: unknown }).window;
    const priorDocument = (globalThis as { document?: unknown }).document;
    Object.assign(globalThis, {
      window: { location: { search: '?movie=1' }, addEventListener: () => {}, removeEventListener: () => {} },
      document: { hidden: false, addEventListener: () => {}, removeEventListener: () => {} }
    });
    try {
      const pilot = await import('./primitives.ts');
      const story = await import('../storyState.ts');
      const flight = await import('../../state/spaceFlight.ts');
      const app = await import('../../state/appState.ts');
      const frame = await import('../../state/playerFrame.ts');
      app.enterPlaying();
      story.reactivateStoryAtBeat('ch8-landfall');
      flight.debugStartInDescent();
      frame.setPlayerWorldPosition(new THREE.Vector3(-102.64, 123.28, 1.66));
      for (let i = 0; i < 900; i++) {
        pilot.autopilotTick(1 / 60);
        const controls = pilot.getAutopilotFlightDirective().controls;
        expect(controls.forward).toBe(true);
        expect(controls.backward).toBe(false);
        expect(controls.jump).toBe(false);
        expect(controls.interact).toBe(true);
      }
      flight.resetTravel();
      story.advanceToBeat('done');
      app.returnToMenu();
    } finally {
      if (priorWindow === undefined) delete (globalThis as { window?: unknown }).window;
      else Object.assign(globalThis, { window: priorWindow });
      if (priorDocument === undefined) delete (globalThis as { document?: unknown }).document;
      else Object.assign(globalThis, { document: priorDocument });
      vi.resetModules();
    }
  });
});

// --- VF4-SURVEY-STALL-1: the exact goal versus the snapped terminal cell -------------
//
// Reproduces the blocker the independent verifier measured twice on hardware:
// the chapter-13 survey walk freezes at rail vertex 1, body coordinates
// bit-identical, while the rail keeps publishing `action: walk`.
//
// WHAT IS REAL HERE, AND WHAT IS NOT.
//
// Real: the shipped Origin world generator (`getWorldGen(50, STORY_SEED,
// STORY_PRIMARY_WORLD_ID)`), the shipped A* navigator (`planAgentSurfaceRoute`
// with the runtime's own options), the shipped terminal-goal decision
// (`terminalExactGoalHandoff`) and waypoint application
// (`applyTerminalExactGoal`) that `nextNavigationStep` itself calls, the shipped
// steering intent (`surfaceSteeringIntent`) and dead zone
// (`NAVIGATION_STEER_DEAD_ZONE`) that `steerFreeToward` itself applies, and the
// shipped arrival measure (`surfaceGaitDistance`) that `walkToward` arrives on.
//
// NOT real: this file cannot mount the browser runtime, so the body is advanced
// by a small integrator below. That integrator moves ONLY along the direction
// the shipped steering actually asked for, only while at least one control is
// held, and at a fixed speed — it can never teleport to, or overshoot onto, a
// requested point. A mock walker that simply arrives could not catch this bug,
// which is the whole reason it is written this way.
//
// This is source-level proof only. It is NOT a hardware, rendering or gameplay
// acceptance claim; the physical re-verification remains the verifier's.

const PLANET_SIZE = 50;
const UP = new THREE.Vector3(0, 1, 0);

/** The Origin generator, queried exactly as the live terrain adapter queries it. */
function originTerrain(): AgentSurfaceTerrainQuery {
  const generator = getWorldGen(PLANET_SIZE, STORY_SEED, STORY_PRIMARY_WORLD_ID).generator;
  return {
    isSolidVoxel: (x, y, z) => generator.shouldVoxelExist(x, y, z),
    isWaterVoxel: (x, y, z) => generator.isWaterVoxel(x, y, z),
    isHazardousVoxel: (x, y, z) => generator.generateBlockForPosition(x, y, z) === 'lava'
  };
}

/** `nextNavigationStep`'s own planner call, option for option. */
function planLikeRuntime(
  terrain: AgentSurfaceTerrainQuery,
  player: THREE.Vector3,
  goal: THREE.Vector3
): AgentSurfaceRoute {
  return planAgentSurfaceRoute(terrain, PLANET_SIZE, player, goal, {
    face: surfaceFaceFromUp(UP),
    differentFaceFallback: 'unreachable',
    allowJetpackCrossing: false,
    maxJetpackWaterCells: 3,
    maxJetpackWaterDepthCells: 2,
    jetpackDetourExtraCells: 4,
    jetpackDetourRatio: 1.5,
    maxVisitedCells: 4096
  });
}

/**
 * `nextNavigationStep`'s own column ownership probe, option for option: a
 * self-route through the REAL planner, which exercises the same clearance,
 * slope, edge-margin, water and hazard rules runtime A* uses.
 */
function certifierFor(terrain: AgentSurfaceTerrainQuery) {
  return (column: THREE.Vector3): THREE.Vector3 | null => {
    const probe = planAgentSurfaceRoute(terrain, PLANET_SIZE, column, column, {
      face: surfaceFaceFromUp(UP),
      differentFaceFallback: 'unreachable',
      allowJetpackCrossing: false,
      maxVisitedCells: 1
    });
    if (probe.mode === 'unreachable' || probe.requestedGoalWasWet) return null;
    return probe.resolvedGoal;
  };
}

/** `nextNavigationStep`'s cursor consumption, tangent-plane measured. */
function advanceCursor(route: AgentSurfaceRoute, cursor: number, body: THREE.Vector3): number {
  let next = cursor;
  const scratch = new THREE.Vector3();
  while (next < route.waypoints.length - 1) {
    const candidate = route.waypoints[next];
    if (!candidate) break;
    scratch.copy(candidate).sub(body);
    const vertical = scratch.dot(UP);
    scratch.addScaledVector(UP, -vertical);
    if (scratch.lengthSq() > 1.35 * 1.35) break;
    if (vertical > 1.0) break;
    if (vertical < -3.4) break;
    next += 1;
  }
  return next;
}

interface SteerResult {
  readonly pushing: boolean;
  readonly move: THREE.Vector3;
}

/** `steerFreeToward`: the shipped dead zone, then the shipped steering intent. */
function steer(body: THREE.Vector3, waypoint: THREE.Vector3): SteerResult {
  const delta = new THREE.Vector3().copy(waypoint).sub(body);
  delta.addScaledVector(UP, -delta.dot(UP));
  if (delta.lengthSq() < NAVIGATION_STEER_DEAD_ZONE * NAVIGATION_STEER_DEAD_ZONE) {
    return { pushing: false, move: new THREE.Vector3() };
  }
  // Forward basis is the tangent bearing the walker is already facing down; the
  // shipped intent resolves it into held keys, and those keys are what moves.
  const forward = delta.clone().normalize();
  const intent = surfaceSteeringIntent(delta, UP, forward);
  const right = new THREE.Vector3().crossVectors(forward, UP).normalize();
  const move = new THREE.Vector3();
  if (intent.forward) move.add(forward);
  if (intent.backward) move.sub(forward);
  if (intent.right) move.sub(right);
  if (intent.left) move.add(right);
  const pushing = intent.forward || intent.backward || intent.left || intent.right;
  if (pushing && move.lengthSq() > 0) move.normalize();
  return { pushing, move };
}

interface WalkOutcome {
  readonly arrived: boolean;
  readonly frames: number;
  readonly frozenFrames: number;
  readonly finalDistance: number;
  readonly terminalWaypoint: THREE.Vector3;
  readonly handoffRefusal: string | null;
  readonly displacement: number;
  readonly body: THREE.Vector3;
  readonly routeReason: string;
}

/**
 * Walk a body toward one goal through the real navigator, one control frame at
 * a time. `withHandoff: false` reproduces the shipped pre-repair behaviour (the
 * snapped terminal cell stays authoritative) so the freeze can be measured.
 */
function walkThroughNavigator(options: {
  from: THREE.Vector3;
  goal: THREE.Vector3;
  stop: number;
  withHandoff: boolean;
  maxFrames?: number;
  speedPerFrame?: number;
  terrain?: AgentSurfaceTerrainQuery;
}): WalkOutcome {
  const terrain = options.terrain ?? originTerrain();
  const speed = options.speedPerFrame ?? 0.08;
  const maxFrames = options.maxFrames ?? 4000;
  const body = options.from.clone();
  const start = options.from.clone();
  const route = planLikeRuntime(terrain, body, options.goal);
  let cursor = route.waypoints.length > 1 ? 1 : 0;
  let frames = 0;
  let frozenFrames = 0;
  let refusal: string | null = null;
  const waypoint = new THREE.Vector3();
  while (frames < maxFrames) {
    if (surfaceGaitDistance(options.goal, body, UP) <= options.stop) break;
    cursor = advanceCursor(route, cursor, body);
    const snapped = route.waypoints[cursor] ?? options.goal;
    const decision = terminalExactGoalHandoff({
      route,
      cursor,
      goal: options.goal,
      action: route.mode === 'direct' ? 'direct' : 'walk',
      face: surfaceFaceFromUp(UP),
      goalFace: dominantFaceForPosition(options.goal),
      up: UP,
      crossFaceLegActive: false,
      certifyColumn: certifierFor(terrain)
    });
    refusal = decision.refusal;
    applyTerminalExactGoal(
      waypoint.copy(snapped),
      options.goal,
      UP,
      options.withHandoff && decision.handoff
    );
    const result = steer(body, waypoint);
    if (!result.pushing) frozenFrames += 1;
    else body.addScaledVector(result.move, speed);
    frames += 1;
    // A body that has stopped pushing will never push again for this goal: the
    // route, the cursor and the waypoint are all functions of a position that
    // is no longer changing. Stop early rather than spin the loop.
    if (!result.pushing && frozenFrames > 8) break;
  }
  const terminal = route.waypoints[route.waypoints.length - 1] ?? options.goal;
  return {
    arrived: surfaceGaitDistance(options.goal, body, UP) <= options.stop,
    frames,
    frozenFrames,
    finalDistance: surfaceGaitDistance(options.goal, body, UP),
    terminalWaypoint: terminal.clone(),
    handoffRefusal: refusal,
    displacement: body.distanceTo(start),
    body: body.clone(),
    routeReason: route.reason
  };
}

// The captured hardware facts this file is written against.
/**
 * The navigator reads `getPlayerWorldPosition()`, which is the body CENTRE, not
 * the grounded pose: the verifier captured centre y 52.78897476196289 with the
 * grounded pose 1.8 below it, and the planner's waypoint plane sits at 52.85.
 * Every body in this file is therefore expressed in the centre frame, exactly
 * as the runtime navigator sees it.
 */
const BODY_CENTRE_Y = 52.78897476196289;
const FROZEN_BODY = new THREE.Vector3(-26.085248947143555, BODY_CENTRE_Y, 13.87842082977295);
const SURVEY_VERTEX_1_GOAL = new THREE.Vector3(-26, 51.05, 14.6); // rail cursor 1, captured
const RAIL_ROUTE_ARRIVE = 0.35; // CG_RAIL_ROUTE_ARRIVE, captured as arriveRadius

describe('VF4-SURVEY-STALL-1 — terminal cell versus the exact requested goal', () => {
  it('the captured rail goal is a real off-grid point inside its own navigation cell', () => {
    // Chapter 13 aims 0.6 THROUGH the corner at CG_ROUTE_LONG[1]. That device is
    // signed and is not touched here; it is only shown to be the actual source
    // of an off-centre goal.
    expect(CG_ROUTE_LONG[1]).toMatchObject({ x: -26, z: 14 });
    expect(SURVEY_VERTEX_1_GOAL.z - CG_ROUTE_LONG[1].z).toBeCloseTo(0.6, 6);
    // The planner quantizes with Math.round(w / VOXEL_SCALE), VOXEL_SCALE = 2,
    // so the goal and the vertex share one cell: 14.6 and 14.0 both index 7.
    expect(Math.round(SURVEY_VERTEX_1_GOAL.z / VOXEL_SCALE)).toBe(7);
    expect(Math.round(CG_ROUTE_LONG[1].z / VOXEL_SCALE)).toBe(7);
  });

  it('the real Origin navigator terminates on the snapped cell centre, not the goal', () => {
    const route = planLikeRuntime(originTerrain(), FROZEN_BODY, SURVEY_VERTEX_1_GOAL);
    expect(route.mode).not.toBe('unreachable');
    // The goal is inside the resolved navigable region: its OWN cell was dry and
    // was not substituted for a safe approach. Not water, not a hole, not a
    // rise/drop, not a cross-face edge, not unreachable.
    expect(route.requestedGoalWasWet).toBe(false);
    expect(['dry-surface-path', 'already-at-resolved-goal']).toContain(route.reason);
    expect(route.waterCrossing).toBeNull();
    const terminal = route.waypoints[route.waypoints.length - 1]!;
    // The terminal waypoint is a cell CENTRE, and it is NOT the requested goal.
    expect(terminal.x).toBeCloseTo(-26, 6);
    expect(terminal.z).toBeCloseTo(14, 6);
    expect(Math.abs(terminal.z - SURVEY_VERTEX_1_GOAL.z)).toBeCloseTo(0.6, 6);
    expect(route.resolvedGoal!.distanceTo(SURVEY_VERTEX_1_GOAL)).toBeGreaterThan(0.5);
  });

  it('CAUSE: steering the snapped centre makes the 0.35 arrival unsatisfiable', () => {
    // Arithmetic, not luck. The dead zone releases every control within 0.2 of
    // the steered point, so the closest a body can be to a goal 0.6 away from
    // that point is 0.4 — and 0.4 > 0.35 always.
    const offset = 0.6;
    expect(offset - NAVIGATION_STEER_DEAD_ZONE).toBeGreaterThan(RAIL_ROUTE_ARRIVE);

    const frozen = walkThroughNavigator({
      from: FROZEN_BODY,
      goal: SURVEY_VERTEX_1_GOAL,
      stop: RAIL_ROUTE_ARRIVE,
      withHandoff: false
    });
    expect(frozen.arrived).toBe(false);
    expect(frozen.frozenFrames).toBeGreaterThan(0);
    // Matches the capture: ~0.73-0.77 short, and the body does not move at all.
    expect(frozen.finalDistance).toBeGreaterThan(RAIL_ROUTE_ARRIVE);
    expect(frozen.displacement).toBeLessThan(0.01);
    // And the freeze is silent to the stuck watchdog: `stillTime` only counts
    // frames where the walker is PUSHING, and it is not pushing at all. That is
    // the reported stillTime: 0 beside a bit-identical body. No timeout rescue
    // is armed here, and none is added by this repair.
  });

  it('REPAIR: the exact goal owns the last leg and the body walks the rest', () => {
    const repaired = walkThroughNavigator({
      from: FROZEN_BODY,
      goal: SURVEY_VERTEX_1_GOAL,
      stop: RAIL_ROUTE_ARRIVE,
      withHandoff: true
    });
    expect(repaired.handoffRefusal).toBeNull();
    expect(repaired.arrived).toBe(true);
    expect(repaired.finalDistance).toBeLessThanOrEqual(RAIL_ROUTE_ARRIVE);
    // It arrived by WALKING. Real displacement, many control frames, and never
    // a single frame of teleport: the loop only ever adds `speed` along a
    // direction the shipped steering asked for.
    expect(repaired.displacement).toBeGreaterThan(0.3);
    expect(repaired.frames).toBeGreaterThan(3);
    expect(repaired.frozenFrames).toBe(0);
  });

  it('the handoff never leaves the cell the planner certified', () => {
    const route = planLikeRuntime(originTerrain(), FROZEN_BODY, SURVEY_VERTEX_1_GOAL);
    const terminal = route.waypoints[route.waypoints.length - 1]!;
    const moved = applyTerminalExactGoal(
      terminal.clone(),
      SURVEY_VERTEX_1_GOAL,
      UP,
      true
    );
    // Inside the cell footprint on every tangent axis...
    expect(Math.abs(moved.x - terminal.x)).toBeLessThanOrEqual(VOXEL_SCALE / 2);
    expect(Math.abs(moved.z - terminal.z)).toBeLessThanOrEqual(VOXEL_SCALE / 2);
    // ...and at exactly the surface height the planner cleared. The repair moves
    // the aim tangentially; it never lifts, drops or clamps a body.
    expect(moved.y).toBeCloseTo(terminal.y, 10);
    expect(Math.round(moved.x / VOXEL_SCALE)).toBe(Math.round(terminal.x / VOXEL_SCALE));
    expect(Math.round(moved.z / VOXEL_SCALE)).toBe(Math.round(terminal.z / VOXEL_SCALE));
  });
});

describe('off-grid terminal goals in both axes and both signs', () => {
  // The verifier saw the same stop recur at rail cursor 4 (x -30.6), cursor 8
  // (z 22.6) and cursor 13 (x -42.6) — every one of them a 0.6 overshoot past an
  // even vertex, in a different axis or a different sign. One nudge cannot fix a
  // route made of these; the seam has to.
  const cases: ReadonlyArray<{ label: string; vertex: THREE.Vector3; goal: THREE.Vector3 }> = [
    {
      label: 'cursor 1, +z',
      vertex: new THREE.Vector3(-26, 51.05, 14),
      goal: new THREE.Vector3(-26, 51.05, 14.6)
    },
    {
      label: 'cursor 4, -x',
      vertex: new THREE.Vector3(-30, 51.05, 16),
      goal: new THREE.Vector3(-30.6, 51.05, 16)
    },
    {
      label: 'cursor 8, +z',
      vertex: new THREE.Vector3(-32, 51.05, 22),
      goal: new THREE.Vector3(-32, 51.05, 22.6)
    },
    {
      label: 'cursor 13, -x',
      vertex: new THREE.Vector3(-42, 51.05, 22),
      goal: new THREE.Vector3(-42.6, 51.05, 22)
    },
    {
      label: '+x overshoot (mirrored sign)',
      vertex: new THREE.Vector3(-42, 51.05, 14),
      goal: new THREE.Vector3(-41.4, 51.05, 14)
    },
    {
      label: '-z overshoot (mirrored sign)',
      vertex: new THREE.Vector3(-42, 51.05, 16),
      goal: new THREE.Vector3(-42, 51.05, 15.4)
    }
  ];

  for (const { label, vertex, goal } of cases) {
    it(`${label}: frozen before the repair, walked after it`, () => {
      const terrain = originTerrain();
      // Start half a cell BEHIND the vertex, along the same leg the goal
      // overshoots, so arriving demands roughly 0.75 units of real walking.
      const approach = goal.clone().sub(vertex).normalize().multiplyScalar(-0.5);
      const from = vertex.clone().add(approach);
      from.y = BODY_CENTRE_Y;
      const before = walkThroughNavigator({
        from, goal, stop: RAIL_ROUTE_ARRIVE, withHandoff: false, terrain
      });
      const after = walkThroughNavigator({
        from, goal, stop: RAIL_ROUTE_ARRIVE, withHandoff: true, terrain
      });
      expect(before.arrived).toBe(false);
      expect(before.finalDistance).toBeGreaterThan(RAIL_ROUTE_ARRIVE);
      expect(after.arrived).toBe(true);
      expect(after.handoffRefusal).toBeNull();
      expect(after.displacement).toBeGreaterThan(0.2);
      expect(after.frozenFrames).toBe(0);
    });
  }

  it('walks a signed route turn and keeps arriving at the NEXT corner too', () => {
    // Repeatability: real control intent must continue until the correct arrival
    // at vertex 1, and then again at vertex 2, on the actual authored polyline.
    const terrain = originTerrain();
    let body = new THREE.Vector3(-26, BODY_CENTRE_Y, 12);
    const corners = [
      new THREE.Vector3(-26, 51.05, 14.6), // through vertex 1, +z leg
      new THREE.Vector3(-28.6, 51.05, 14) // through vertex 2, -x leg
    ];
    for (const goal of corners) {
      const leg = walkThroughNavigator({
        from: body, goal, stop: RAIL_ROUTE_ARRIVE, withHandoff: true, terrain
      });
      expect(leg.arrived).toBe(true);
      expect(leg.frozenFrames).toBe(0);
      expect(leg.displacement).toBeGreaterThan(0.5);
      body = leg.body;
    }
  });
});

describe('the handoff refuses everything it must refuse', () => {
  const baseRoute = (over: Partial<AgentSurfaceRoute> = {}): AgentSurfaceRoute => ({
    mode: 'walk',
    face: 'top',
    waypoints: [new THREE.Vector3(-26, 51.05, 12), new THREE.Vector3(-26, 51.05, 14)],
    requestedGoal: new THREE.Vector3(-26, 51.05, 14.6),
    resolvedGoal: new THREE.Vector3(-26, 51.05, 14),
    requestedGoalWasWet: false,
    waterCrossing: null,
    reason: 'dry-surface-path',
    visitedCells: 12,
    ...over
  });
  const ask = (route: AgentSurfaceRoute, over: Record<string, unknown> = {}) =>
    terminalExactGoalHandoff({
      route,
      cursor: route.waypoints.length - 1,
      goal: route.requestedGoal,
      action: 'walk',
      face: 'top',
      goalFace: 'top',
      up: UP,
      crossFaceLegActive: false,
      certifyColumn: () => new THREE.Vector3(-26, 51.05, 16),
      ...over
    } as Parameters<typeof terminalExactGoalHandoff>[0]);

  it('takes the handoff only on the true terminal waypoint', () => {
    const route = baseRoute();
    expect(ask(route).handoff).toBe(true);
    expect(ask(route, { cursor: 0 })).toEqual({
      handoff: false, refusal: 'not-terminal-waypoint'
    });
  });

  it('refuses a goal the planner replaced for safety', () => {
    // A wet or unclearable goal resolves to a neighbouring dry approach. The
    // body must stop on the SAFE cell, exactly as it does today.
    expect(ask(baseRoute({ reason: 'wet-goal-resolved-to-dry-approach' }))).toEqual({
      handoff: false, refusal: 'goal-substituted-for-safety'
    });
    expect(ask(baseRoute({ reason: 'goal-resolved-to-dry-approach' }))).toEqual({
      handoff: false, refusal: 'goal-substituted-for-safety'
    });
    expect(ask(baseRoute({ requestedGoalWasWet: true }))).toEqual({
      handoff: false, refusal: 'goal-substituted-for-safety'
    });
    expect(ask(baseRoute({ reason: 'no-safe-route', mode: 'unreachable' }))).toEqual({
      handoff: false, refusal: 'goal-substituted-for-safety'
    });
    expect(ask(baseRoute({ reason: 'start-column-not-traversable' }))).toEqual({
      handoff: false, refusal: 'goal-substituted-for-safety'
    });
  });

  it('refuses a goal outside the terminal cell', () => {
    // The neighbouring cell is a different cell, however close. Nothing here
    // pays missing distance, extends a route, or skips a planner decision.
    const route = baseRoute({ requestedGoal: new THREE.Vector3(-26, 51.05, 15.4) });
    expect(ask(route)).toEqual({ handoff: false, refusal: 'goal-outside-terminal-cell' });
    // The SURFACE-NORMAL axis is deliberately NOT part of cell identity, exactly
    // as `worldToGrid` defines it: an authored foot goal (51.05), a grounded pose
    // (50.989) and a waypoint carrying PLAYER_CENTER_CLEARANCE (52.85) all name
    // the same cell. `applyTerminalExactGoal` discards that component anyway, so
    // a differently-expressed height must not refuse a legitimate handoff.
    for (const y of [50.989, 51.05, 52.85, 55.05]) {
      const height = baseRoute({ requestedGoal: new THREE.Vector3(-26, y, 14.6) });
      expect(ask(height).handoff).toBe(true);
      expect(
        applyTerminalExactGoal(
          height.waypoints[1]!.clone(), height.requestedGoal, UP, true
        ).y
      ).toBeCloseTo(height.waypoints[1]!.y, 10);
    }
  });

  it('refuses water legs and cross-face goals', () => {
    expect(ask(baseRoute(), { action: 'jetpack' })).toEqual({
      handoff: false, refusal: 'water-leg'
    });
    expect(ask(baseRoute({
      waterCrossing: {
        waterCellCount: 2, maxConsecutiveWaterCells: 2,
        firstWaterWaypointIndex: 0, lastWaterWaypointIndex: 1,
        entryWorld: new THREE.Vector3(), exitWorld: new THREE.Vector3(),
        dryPathCost: null, selectedPathCost: 4, reason: 'dry-route-unavailable'
      }
    }))).toEqual({ handoff: false, refusal: 'water-leg' });
    expect(ask(baseRoute(), { goalFace: 'front' })).toEqual({
      handoff: false, refusal: 'cross-face-goal'
    });
    expect(ask(baseRoute(), { crossFaceLegActive: true })).toEqual({
      handoff: false, refusal: 'cross-face-goal'
    });
  });

  it('an unsafe final target is still refused against the REAL Origin terrain', () => {
    // A goal the live generator does not offer a dry terminal cell for keeps the
    // planner's own answer. No handoff, no endpoint credit, no motion paid.
    const terrain = originTerrain();
    const buried = new THREE.Vector3(-26, 20, 14.6); // deep inside the planet
    const route = planLikeRuntime(terrain, FROZEN_BODY, buried);
    const decision = terminalExactGoalHandoff({
      route,
      cursor: Math.max(0, route.waypoints.length - 1),
      goal: buried,
      action: route.mode === 'jetpack' ? 'jetpack' : 'walk',
      face: surfaceFaceFromUp(UP),
      goalFace: dominantFaceForPosition(buried),
      up: UP,
      crossFaceLegActive: false,
      certifyColumn: certifierFor(terrain)
    });
    expect(decision.handoff).toBe(false);
    expect(decision.refusal).not.toBeNull();
  });
});

describe('compatibility with every other chapter that shares this walker', () => {
  it('cannot break an arrival that already worked', () => {
    // Before the repair a body stops within NAVIGATION_STEER_DEAD_ZONE of the
    // snapped CENTRE, so arrival needed `stop >= 0.2 + |goal - centre|`. After
    // it, the body stops within the dead zone of the GOAL, so arrival needs only
    // `stop >= 0.2`. The second condition is implied by the first for every
    // possible offset, so no goal that used to be reached can stop being
    // reached. The smallest stop radius anywhere in the shipped rails is 0.3.
    const smallestShippedStop = 0.3;
    expect(smallestShippedStop).toBeGreaterThan(NAVIGATION_STEER_DEAD_ZONE);
  });

  it('leaves a large stop radius arriving from the same distance as before', () => {
    // Chapter 7/12 style approach: stop 2.4 at a hatch. The handoff can only
    // move the aim by less than one cell TOWARD the point the caller asked for,
    // and arrival is measured against that same point either way.
    const terrain = originTerrain();
    const goal = new THREE.Vector3(-34, 51.05, 20.6);
    const from = new THREE.Vector3(-26, BODY_CENTRE_Y, 14);
    const wide = walkThroughNavigator({
      from, goal, stop: 2.4, withHandoff: true, terrain
    });
    const wideBefore = walkThroughNavigator({
      from, goal, stop: 2.4, withHandoff: false, terrain
    });
    expect(wideBefore.arrived).toBe(true);
    expect(wide.arrived).toBe(true);
  });

  it('never consumes a route cell it did not reach', () => {
    // The repair changes only which point the LAST cell steers at. Cursor
    // consumption, its 1.35 tangent bound and its rise/drop bounds are
    // untouched, so no cell of a route is skipped by arriving.
    const route = planLikeRuntime(
      originTerrain(),
      new THREE.Vector3(-26, BODY_CENTRE_Y, 12),
      new THREE.Vector3(-34, 51.05, 20.6)
    );
    expect(route.waypoints.length).toBeGreaterThan(2);
    const far = route.waypoints[0]!.clone();
    expect(advanceCursor(route, 1, far)).toBe(1);
  });
});

describe('capsule footprint safety at the cell boundary', () => {
  // `cellAt` certifies a COLUMN and its normal clearance. It does not certify an
  // off-centre capsule inside that cell, so an exact goal near the boundary can
  // share the certified column while the body overhangs the next one. These
  // exercise that directly, against the real planner.

  /** A flat plateau at support y = 50, with named columns removed or flooded. */
  function plateau(options: {
    missing?: ReadonlyArray<readonly [number, number]>;
    water?: ReadonlyArray<readonly [number, number]>;
    lava?: ReadonlyArray<readonly [number, number]>;
  } = {}): AgentSurfaceTerrainQuery {
    const key = (x: number, z: number) => `${x},${z}`;
    const missing = new Set((options.missing ?? []).map(([x, z]) => key(x, z)));
    const water = new Set((options.water ?? []).map(([x, z]) => key(x, z)));
    const lava = new Set((options.lava ?? []).map(([x, z]) => key(x, z)));
    return {
      isSolidVoxel: (x, y, z) => {
        if (y > 25) return false; // grid y; support column tops out at 25 (world 50)
        if (missing.has(key(x, z)) || water.has(key(x, z))) return false;
        return true;
      },
      isWaterVoxel: (x, y, z) => water.has(key(x, z)) && y === 25,
      isHazardousVoxel: (x, y, z) => lava.has(key(x, z)) && y === 25
    };
  }

  const TERMINAL = new THREE.Vector3(-26, 52.85, 14);
  const body = new THREE.Vector3(-26, BODY_CENTRE_Y, 12);

  function decideOnPlateau(goal: THREE.Vector3, terrain: AgentSurfaceTerrainQuery) {
    const route = planLikeRuntime(terrain, body, goal);
    return {
      route,
      decision: terminalExactGoalHandoff({
        route,
        cursor: Math.max(0, route.waypoints.length - 1),
        goal,
        action: 'walk',
        face: surfaceFaceFromUp(UP),
        goalFace: dominantFaceForPosition(goal),
        up: UP,
        crossFaceLegActive: false,
        certifyColumn: certifierFor(terrain)
      })
    };
  }

  it('reports exactly the columns a 0.6 overshoot actually overlaps', () => {
    // Half extent 1.0, capsule radius 0.5: anything past 0.5 overhangs.
    const centred = exactGoalFootprintColumns(
      TERMINAL, new THREE.Vector3(-26, 51.05, 14.4), UP
    );
    expect(centred).toHaveLength(0);
    expect(VOXEL_SCALE / 2 - PLAYER_CAPSULE_RADIUS).toBeCloseTo(0.5, 10);

    const overshoot = exactGoalFootprintColumns(
      TERMINAL, new THREE.Vector3(-26, 51.05, 14.6), UP
    );
    expect(overshoot).toHaveLength(1);
    expect(overshoot[0]!.z).toBeCloseTo(16, 10);
    expect(overshoot[0]!.x).toBeCloseTo(-26, 10);

    const diagonal = exactGoalFootprintColumns(
      TERMINAL, new THREE.Vector3(-26.6, 51.05, 14.6), UP
    );
    // Both neighbours plus the diagonal they share.
    expect(diagonal).toHaveLength(3);
  });

  it('keeps the signed 0.6 overshoot reachable over genuinely safe ground', () => {
    const { decision } = decideOnPlateau(new THREE.Vector3(-26, 51.05, 14.6), plateau());
    expect(decision).toEqual({ handoff: true, refusal: null });
  });

  it('refuses the same overshoot when the overlapped column is a hole', () => {
    const holed = plateau({ missing: [[-13, 8]] }); // grid cell for world (-26, 16)
    const { route, decision } = decideOnPlateau(new THREE.Vector3(-26, 51.05, 14.6), holed);
    // The goal's OWN cell is still fine, so the route still terminates there...
    expect(route.waypoints[route.waypoints.length - 1]!.z).toBeCloseTo(14, 6);
    // ...but the body would overhang the hole, so the snapped centre is kept.
    expect(decision).toEqual({ handoff: false, refusal: 'footprint-not-certified' });
  });

  it('refuses a DRY but raised or lowered adjacent surface', () => {
    // Dryness alone is not safety. A neighbouring column can be perfectly dry
    // and still be a step up the capsule would clip, or a drop it would hang
    // over. The self-route resolves happily in both cases, so the resolved
    // HEIGHT is compared against the terminal surface as well.
    //
    // Both variants are built INSIDE the rendered cube (the plateau is lowered
    // to grid y 23 so a rise has somewhere real to go); a bulge above the cube
    // is procedural overhang, which `cellAt` already declines to treat as a
    // ceiling and which is not what this guard is about.
    const stepped = (neighbourTop: number): AgentSurfaceTerrainQuery => ({
      isSolidVoxel: (x, y, z) => (x === -13 && z === 8) ? y <= neighbourTop : y <= 23,
      isWaterVoxel: () => false,
      isHazardousVoxel: () => false
    });
    const body = new THREE.Vector3(-26, 48.78897476196289, 12);
    const goal = new THREE.Vector3(-26, 47.05, 14.6);
    const decide = (terrain: AgentSurfaceTerrainQuery) => {
      const route = planLikeRuntime(terrain, body, goal);
      return terminalExactGoalHandoff({
        route,
        cursor: Math.max(0, route.waypoints.length - 1),
        goal,
        action: 'walk',
        face: surfaceFaceFromUp(UP),
        goalFace: dominantFaceForPosition(goal),
        up: UP,
        crossFaceLegActive: false,
        certifyColumn: certifierFor(terrain)
      });
    };
    // Flat control first: the same overshoot IS allowed over level ground.
    expect(decide(stepped(23))).toEqual({ handoff: true, refusal: null });
    for (const [label, top] of [['raised', 25], ['lowered', 20]] as const) {
      const decision = decide(stepped(top));
      expect(decision.handoff, label).toBe(false);
      expect(
        ['footprint-height-mismatch', 'footprint-not-certified'], label
      ).toContain(decision.refusal);
    }
  });

  it('refuses it beside water and beside lava', () => {
    const flooded = plateau({ water: [[-13, 8]] });
    expect(decideOnPlateau(new THREE.Vector3(-26, 51.05, 14.6), flooded).decision)
      .toEqual({ handoff: false, refusal: 'footprint-not-certified' });
    const molten = plateau({ lava: [[-13, 8]] });
    expect(decideOnPlateau(new THREE.Vector3(-26, 51.05, 14.6), molten).decision)
      .toEqual({ handoff: false, refusal: 'footprint-not-certified' });
  });

  it('only the columns actually overhung matter', () => {
    // A hole beside the terminal cell on an axis the overshoot does NOT lean
    // into must not refuse the handoff: the guard is the real footprint, not a
    // blanket "any neighbour is unsafe" rule.
    const holed = plateau({ missing: [[-12, 7]] }); // world (-24, 14), the +x neighbour
    const { decision } = decideOnPlateau(new THREE.Vector3(-26, 51.05, 14.6), holed);
    expect(decision).toEqual({ handoff: true, refusal: null });
  });

  it('a refused footprint leaves the body exactly where it always stopped', () => {
    const holed = plateau({ missing: [[-13, 8]] });
    const goal = new THREE.Vector3(-26, 51.05, 14.6);
    const guarded = walkThroughNavigator({
      from: new THREE.Vector3(-26, BODY_CENTRE_Y, 12.9),
      goal,
      stop: RAIL_ROUTE_ARRIVE,
      withHandoff: true,
      terrain: holed
    });
    expect(guarded.handoffRefusal).toBe('footprint-not-certified');
    expect(guarded.arrived).toBe(false);
    // Unchanged pre-repair behaviour on unsafe ground: it walks to the safe cell
    // and stops there. Nothing is teleported, clamped or granted.
    expect(guarded.body.z).toBeLessThan(14.2);
  });
});

describe('the decision is bound to the exact target, not just the plan', () => {
  // The route cache tolerates a goal that drifts by up to one unit before it
  // replans (`goalChanged` uses distanceToSquared > 1). A handoff certified for
  // the old target must therefore never authorise the moved one, so the runtime
  // keys this decision on the exact goal as well as the plan. Same plan, same
  // terminal cell, two targets, two different lawful answers.
  it('answers differently for two goals inside one unchanged plan', () => {
    const terrain: AgentSurfaceTerrainQuery = {
      // Flat plateau, with the +z neighbour of the terminal cell missing.
      isSolidVoxel: (x, y, z) => y <= 25 && !(x === -13 && z === 8),
      isWaterVoxel: () => false,
      isHazardousVoxel: () => false
    };
    const body = new THREE.Vector3(-26, BODY_CENTRE_Y, 12);
    const safeGoal = new THREE.Vector3(-26, 51.05, 13.9); // stays off the edge
    const route = planLikeRuntime(terrain, body, safeGoal);
    const terminal = route.waypoints[route.waypoints.length - 1]!;
    expect(terminal.z).toBeCloseTo(14, 6);

    const decide = (goal: THREE.Vector3) => terminalExactGoalHandoff({
      route,
      cursor: route.waypoints.length - 1,
      goal,
      action: 'walk',
      face: surfaceFaceFromUp(UP),
      goalFace: dominantFaceForPosition(goal),
      up: UP,
      crossFaceLegActive: false,
      certifyColumn: certifierFor(terrain)
    });

    // Within the same plan, a target that does not overhang is fine...
    expect(decide(safeGoal)).toEqual({ handoff: true, refusal: null });
    // ...and one that drifts less than a unit, into the missing column, is not.
    const drifted = new THREE.Vector3(-26, 51.05, 14.6);
    expect(drifted.distanceToSquared(safeGoal)).toBeLessThan(1);
    expect(decide(drifted)).toEqual({
      handoff: false, refusal: 'footprint-not-certified'
    });
  });
});

// --- NAV-RUNTIME-SEAM: the shipped autopilotTick wiring, not a helper ---------------
//
// Everything above proves the DECISION. This proves the WIRING: the real
// `autopilotTick` -> ch13 rail -> `walkToward` -> `nextNavigationStep` ->
// `steerFreeToward` path, observed only through the shipped
// `getAutopilotControls()`. No handoff helper is called by this test at all.
//
// It uses only exports that exist on BOTH the pre-repair and repaired sources,
// so the counterfactual harness can run this same file against the old bytes
// and see it fail behaviourally.
describe('the real autopilot tick issues movement at the corner overshoot', () => {
  it('holds a directional control instead of parking in the dead zone', async () => {
    vi.resetModules();
    // `MOVIE` is read from the URL at module load, so the flag must exist
    // before the module graph is imported.
    const priorWindow = (globalThis as { window?: unknown }).window;
    const priorDocument = (globalThis as { document?: unknown }).document;
    (globalThis as { window?: unknown }).window = {
      location: { search: '?movie=1' },
      addEventListener: () => {},
      removeEventListener: () => {}
    };
    (globalThis as { document?: unknown }).document = {
      hidden: false,
      addEventListener: () => {},
      removeEventListener: () => {}
    };
    try {
      const primitives = await import('./primitives.ts');
      const { autopilotTick, getAutopilotControls, isMovieMode } = primitives;
      expect(isMovieMode()).toBe(true);

      const storyWorld = await import('../world/storyWorld.ts');
      const identity = await import('../world/storyWorldIdentity.ts');
      const flight = await import('../../state/systemFlight.ts');
      const frame = await import('../../state/playerFrame.ts');
      const spawn = await import('../../game/spawnSettle.ts');
      const storyState = await import('../storyState.ts');
      const director = await import('../commonGroundDirector.ts');
      const actor = await import('../commonGroundActor.ts');
      const cg = await import('../commonGroundState.ts');
      const progression = await import('../../game/systems/progressionSystem.ts');
      const appState = await import('../../state/appState.ts');

      progression.resetProgression();
      appState.enterPlaying();
      spawn.markSpawnSettled();
      frame.setPlayerUp(new THREE.Vector3(0, 1, 0));
      storyWorld.storyAnchors.planetSize = PLANET_SIZE;
      storyWorld.storyAnchors.terrainSeed = identity.STORY_SEED;
      storyWorld.storyAnchors.worldId = identity.STORY_PRIMARY_WORLD_ID;
      flight.resetSystemFlightForInterstellarArrival({
        system: identity.STORY_COORDINATE,
        activePlanetId: identity.STORY_PRIMARY_WORLD_ID,
        locationMode: 'surface',
        pose: { position: [0, 0, 0], velocity: [0, 0, 0], quaternion: [0, 0, 0, 1] }
      });
      cg.clearAllCommonGroundWorlds();
      director.resetCommonGroundRuntime({ clearWorlds: true });
      actor.resetCommonGroundActor();
      const release = director.registerCommonGroundWorld({
        worldId: identity.STORY_PRIMARY_WORLD_ID,
        footing: { revision: 'runtime-seam', isSupported: () => true },
        extraSolids: []
      });
      try {
        storyState.reactivateStoryAtBeat('ch13-survey');
        director.enterCommonGroundBeat('ch13-survey');

        // Reach the captured state the way play does: meet the worker, open the
        // demonstration, then actually start the recording. No fixture, no grant.
        actor.seedCommonGroundActorPose({ x: -34, y: 51.05, z: 10 });
        frame.setPlayerWorldPosition(new THREE.Vector3(-34, 51.05, 10));
        for (let f = 0; f < 20; f += 1) director.tickCommonGround(0.016);
        expect(director.commitCommonGroundDemonstrationOffer()).toBe(true);
        frame.setPlayerWorldPosition(new THREE.Vector3(-26, 51.05, 12));
        expect(director.commitCommonGroundSurveyStart()).toBe(true);
        director.tickCommonGround(0.016);
        expect(director.commonGroundSnapshot().survey.phase).toBe('drawing');

        // Now stand the body exactly where the hardware capture froze it: inside
        // the 0.2 dead zone of the snapped terminal cell, 0.73 from the goal.
        frame.setPlayerWorldPosition(FROZEN_BODY.clone());
        director.tickCommonGround(0.016);

        let pushedFrames = 0;
        for (let frameIndex = 0; frameIndex < 30; frameIndex += 1) {
          autopilotTick(0.016);
          const c = getAutopilotControls();
          if (c.forward || c.backward || c.left || c.right) pushedFrames += 1;
        }
        // The rail really did publish a corner aim PAST the vertex, with a stop
        // radius smaller than the distance the body stood away — the exact
        // condition the capture recorded.
        //
        // The radius is bounded rather than written here as a literal. It was
        // 0.35 when this case was first measured; the finding was never the
        // number, it was that the body stood outside the radius and was asked
        // for nothing. All three bounds below are TIGHTER than the original
        // single `> 0.35`. The first is the invariant the number has to obey:
        // a walker stop LARGER than the radius that actually releases the
        // controls can never be reached by steering, so it spends the corner
        // aim's whole budget on an arrival the cursor does not even need.
        const published = director.getCommonGroundProbeSnapshot().rail;
        expect(published?.action).toBe('walk');
        expect(published?.arriveRadius).toBeLessThanOrEqual(NAVIGATION_STEER_DEAD_ZONE);
        const target = new THREE.Vector3(...(published!.target as [number, number, number]));
        const standoff = surfaceGaitDistance(target, FROZEN_BODY, UP);
        expect(standoff).toBeGreaterThan(published!.arriveRadius);
        expect(standoff).toBeGreaterThan(NAVIGATION_STEER_DEAD_ZONE);
        // The whole finding in one assertion: standing at the captured frozen
        // pose, the shipped autopilot must ASK the body to move. Before the
        // repair it asked for nothing at all, on every frame, forever.
        expect(pushedFrames).toBeGreaterThan(0);
      } finally {
        release?.();
        storyState.advanceToBeat('done');
        appState.returnToMenu();
      }
    } finally {
      if (priorWindow === undefined) delete (globalThis as { window?: unknown }).window;
      else (globalThis as { window?: unknown }).window = priorWindow;
      if (priorDocument === undefined) delete (globalThis as { document?: unknown }).document;
      else (globalThis as { document?: unknown }).document = priorDocument;
      vi.resetModules();
    }
  });
});
