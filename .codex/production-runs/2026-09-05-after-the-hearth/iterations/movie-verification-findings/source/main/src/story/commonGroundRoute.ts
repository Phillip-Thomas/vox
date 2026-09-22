// --- Common Ground (ch13) route and reference geometry ------------------------------
//
// PURE over injected terrain queries. Nothing here imports THREE, React, the
// voxel system or the world; the caller supplies "is this footing real" and this
// module answers "is that span demonstrable, and if not, literally why".
//
// The refusal reasons are the whole point of the chapter. "It didn't work" is
// not an answer a surveyor accepts, so every hold names the physical cause and
// each cause has a different, reachable repair:
//
//   reference-out-of-range              -> stand closer, or occupy the witness
//   reference-occluded-survey-housing   -> the apparatus's own backing is in the
//                                          way; occupy the witness or go around
//   reference-occluded-other-solid      -> some other solid (the hero tree's
//                                          trunk collider) is in the way
//   footing-invalid                     -> revise the path; NO witness repairs it
//
// The last line is a rule, not a nicety: an unsafe step is unsafe whoever is
// watching it, so occupancy must never launder it.

import {
  BODY_BODY_CLEARANCE_UNITS,
  FIXED_REFERENCE_SOCKET_HEIGHT,
  OCCUPANCY_RADIUS_UNITS,
  OCCUPANCY_VERTICAL_UNITS,
  PLAYER_REFERENCE_SOCKET_HEIGHT,
  REFERENCE_RANGE_UNITS,
  RELEASE_RADIUS_UNITS,
  RELEASE_VERTICAL_UNITS,
  WORKER_REFERENCE_SOCKET_HEIGHT,
  distanceBetween,
  type CommonGroundHoldReason,
  type CommonGroundPoint
} from './commonGroundState.ts';

export interface CommonGroundAabb {
  readonly name: string;
  readonly lo: CommonGroundPoint;
  readonly hi: CommonGroundPoint;
}

/**
 * The survey apparatus's collision solids, exactly as qualified.
 *
 * backing -> bracket -> stand -> cap is ONE contiguous chain from the dry ground
 * column to the fixed reference plane, and the socket at (-34, 52.35, 20) lies
 * exactly on the cap's top face. There is no floating head, and there is no
 * exemption: all four boxes are in the walk mask, the walked-segment test and
 * every reference ray.
 */
export const CG_APPARATUS_SOLIDS: readonly CommonGroundAabb[] = Object.freeze([
  Object.freeze({
    name: 'backing',
    lo: Object.freeze({ x: -34.8, y: 51.35, z: 19.04 }),
    hi: Object.freeze({ x: -33.2, y: 53.35, z: 19.16 })
  }),
  Object.freeze({
    name: 'stand',
    lo: Object.freeze({ x: -34.2, y: 51.05, z: 19.8 }),
    hi: Object.freeze({ x: -33.8, y: 52.25, z: 20.2 })
  }),
  Object.freeze({
    name: 'bracket',
    lo: Object.freeze({ x: -34.2, y: 51.85, z: 19.04 }),
    hi: Object.freeze({ x: -33.8, y: 52.25, z: 19.9 })
  }),
  Object.freeze({
    name: 'cap',
    lo: Object.freeze({ x: -34.2, y: 52.25, z: 19.8 }),
    hi: Object.freeze({ x: -33.8, y: 52.35, z: 20.2 })
  })
]);

/**
 * The apparatus's fixed reference socket: base + 1.30, lying exactly ON the
 * cap's top face at (-34, 52.35, 20).
 *
 * WRITTEN AS THE QUALIFIED LITERAL, NOT AS `51.05 + 1.3`. In binary that sum is
 * 52.349999999999994 — six femtometres BELOW the cap's top plane, which puts the
 * socket inside its own housing and makes every reference ray an interior
 * crossing. The instrument then occludes itself from everywhere and no route can
 * ever be demonstrated. The contact rule is deliberately epsilon-free (a
 * 0.12-thick slab must still block), so the fix belongs here, in the coordinate,
 * exactly as the qualification states it.
 */
export const CG_FIXED_SOCKET: CommonGroundPoint = Object.freeze({ x: -34, y: 52.35, z: 20 });

/** The nominal socket height the literal above realizes; asserted by the tests. */
export const CG_FIXED_SOCKET_NOMINAL_HEIGHT = FIXED_REFERENCE_SOCKET_HEIGHT;

export function workerSocket(pose: CommonGroundPoint): CommonGroundPoint {
  return { x: pose.x, y: pose.y + WORKER_REFERENCE_SOCKET_HEIGHT, z: pose.z };
}

export function playerSocket(pose: CommonGroundPoint): CommonGroundPoint {
  return { x: pose.x, y: pose.y + PLAYER_REFERENCE_SOCKET_HEIGHT, z: pose.z };
}

// --- Segment/box predicates ----------------------------------------------------------

/**
 * Inclusive slab test. Used by the WALK mask, the walked-segment test and the
 * body capsule, where touching a solid is contact and contact stops you.
 */
export function segmentHitsBoxInclusive(
  a: CommonGroundPoint,
  b: CommonGroundPoint,
  box: CommonGroundAabb
): boolean {
  let near = 0;
  let far = 1;
  const axes: readonly ['x' | 'y' | 'z', number, number][] = [
    ['x', box.lo.x, box.hi.x],
    ['y', box.lo.y, box.hi.y],
    ['z', box.lo.z, box.hi.z]
  ];
  for (const [axis, lo, hi] of axes) {
    const start = a[axis];
    const delta = b[axis] - start;
    if (delta === 0) {
      if (start < lo || start > hi) return false;
      continue;
    }
    const t0 = (lo - start) / delta;
    const t1 = (hi - start) / delta;
    near = Math.max(near, Math.min(t0, t1));
    far = Math.min(far, Math.max(t0, t1));
    if (near > far) return false;
  }
  return true;
}

/**
 * Reference-ray rule: endpoint-only contact is harmless iff the adjacent OPEN
 * segment stays outside the solid; any interior crossing blocks.
 *
 * Applied symmetrically at both endpoints, to every box, with NO object-specific
 * exemption — the apparatus does not get to be transparent to its own instrument
 * just because it owns it. Exact parametric arithmetic, no spatial epsilon, so a
 * 0.12-thick backing slab still blocks. A segment lying IN a face plane produces
 * a positive-length open interval from the other two slabs and therefore blocks;
 * that is deliberate and conservative.
 */
export function referenceSegmentBlockedBy(
  a: CommonGroundPoint,
  b: CommonGroundPoint,
  box: CommonGroundAabb
): boolean {
  let near = 0;
  let far = 1;
  const axes: readonly ['x' | 'y' | 'z', number, number][] = [
    ['x', box.lo.x, box.hi.x],
    ['y', box.lo.y, box.hi.y],
    ['z', box.lo.z, box.hi.z]
  ];
  for (const [axis, lo, hi] of axes) {
    const start = a[axis];
    const delta = b[axis] - start;
    if (delta === 0) {
      if (start < lo || start > hi) return false;
      continue;
    }
    const t0 = (lo - start) / delta;
    const t1 = (hi - start) / delta;
    near = Math.max(near, Math.min(t0, t1));
    far = Math.min(far, Math.max(t0, t1));
    if (near > far) return false;
  }
  // The overlap is a single touch point at an endpoint (or a tangent corner):
  // the open segment never enters the solid.
  return far > near;
}

export interface ReferenceCheckOptions {
  /** Extra solids beyond the apparatus — the hero tree's existing trunk collider. */
  readonly extraSolids?: readonly CommonGroundAabb[];
  readonly rangeUnits?: number;
}

export interface ReferenceCheck {
  readonly ok: boolean;
  readonly distance: number;
  readonly reason: CommonGroundHoldReason | null;
  readonly blockedBy: string | null;
}

/**
 * One reference relation: socket to socket, in range, with a clear solid
 * segment. Camera direction, reticle, gaze duration, screen visibility and music
 * phase are NOT inputs and never will be — this function cannot see them.
 */
export function checkReference(
  socket: CommonGroundPoint,
  sample: CommonGroundPoint,
  options: ReferenceCheckOptions = {}
): ReferenceCheck {
  const distance = distanceBetween(socket, sample);
  const range = options.rangeUnits ?? REFERENCE_RANGE_UNITS;
  if (distance > range) {
    return { ok: false, distance, reason: 'reference-out-of-range', blockedBy: null };
  }
  for (const box of CG_APPARATUS_SOLIDS) {
    if (!referenceSegmentBlockedBy(socket, sample, box)) continue;
    return {
      ok: false,
      distance,
      reason: 'reference-occluded-survey-housing',
      blockedBy: box.name
    };
  }
  for (const box of options.extraSolids ?? []) {
    if (!referenceSegmentBlockedBy(socket, sample, box)) continue;
    return { ok: false, distance, reason: 'reference-occluded-other-solid', blockedBy: box.name };
  }
  return { ok: true, distance, reason: null, blockedBy: null };
}

// --- Footing -------------------------------------------------------------------------

export interface CommonGroundFooting {
  /** Dry, solid, fully supporting the body disc at this grounded pose. */
  isSupported(point: CommonGroundPoint): boolean;
  /** Opaque token; a change means the terrain moved and routes must revalidate. */
  readonly revision: string;
}

/** Body extents, as qualified. The player is tall; W-7744 is not. */
export const PLAYER_BODY_HEIGHT = 3.6;
export const WORKER_BODY_HEIGHT = 2.01;
export const BODY_RADIUS = 0.5;

export interface WalkedSegmentOptions {
  denseSpacing?: number;
  extraSolids?: readonly CommonGroundAabb[];
  /** Standing height of the body being swept. Defaults to the player's. */
  bodyHeight?: number;
  bodyRadius?: number;
}

function bodyOverlapsBox(
  point: CommonGroundPoint,
  radius: number,
  height: number,
  box: CommonGroundAabb
): boolean {
  return point.x + radius > box.lo.x && point.x - radius < box.hi.x
    && point.z + radius > box.lo.z && point.z - radius < box.hi.z
    && point.y + height > box.lo.y && point.y < box.hi.y;
}

/**
 * A walked segment is supported only if the BODY can actually walk it.
 *
 * The foot-point line is not the query, and the difference is not academic: the
 * apparatus backing starts at y=51.35 and the ground is at 51.05, so a grounded
 * centre line passes cleanly UNDER a slab an upright body walks straight into.
 * Sweeping the body's own extent is what makes the walk mask agree with what the
 * player can see. The fixture boxes are unchanged — checking a body's extent is
 * not the same thing as quietly enlarging a solid into a hidden wall.
 *
 * Dense sampling at 0.25 against a 0.5 radius also means nothing tunnels: a
 * point-only test is exactly what would let a route shortcut a corner or slip
 * through a gap it never fits through.
 */
export function walkedSegmentSupported(
  from: CommonGroundPoint,
  to: CommonGroundPoint,
  footing: CommonGroundFooting,
  options: WalkedSegmentOptions = {}
): boolean {
  const spacing = options.denseSpacing ?? 0.25;
  const radius = options.bodyRadius ?? BODY_RADIUS;
  const height = options.bodyHeight ?? PLAYER_BODY_HEIGHT;
  const length = distanceBetween(from, to);
  const steps = length <= 0 ? 0 : Math.max(1, Math.ceil(length / spacing));
  for (let index = 0; index <= steps; index += 1) {
    const t = steps === 0 ? 0 : index / steps;
    const point = {
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
      z: from.z + (to.z - from.z) * t
    };
    if (!footing.isSupported(point)) return false;
    for (const box of CG_APPARATUS_SOLIDS) {
      if (bodyOverlapsBox(point, radius, height, box)) return false;
    }
    for (const box of options.extraSolids ?? []) {
      if (bodyOverlapsBox(point, radius, height, box)) return false;
    }
  }
  return true;
}

/** Whole-route footing validity, reported at the first bad segment. */
export function firstUnsupportedSegment(
  points: readonly CommonGroundPoint[],
  footing: CommonGroundFooting,
  options: WalkedSegmentOptions = {}
): number {
  for (let index = 1; index < points.length; index += 1) {
    if (!walkedSegmentSupported(points[index - 1], points[index], footing, options)) return index;
  }
  return -1;
}

// --- Test progression ----------------------------------------------------------------

export interface SpanTestSource {
  /** The fixed apparatus socket is always available. */
  readonly fixed: CommonGroundPoint;
  /** An occupied, offered reference socket, or null when nobody is holding one. */
  readonly held: CommonGroundPoint | null;
  /**
   * False when the fixed apparatus reference is NOT an available source.
   *
   * His final independent test is witnessed from the separate far Terra socket
   * and from nowhere else: letting the fixed plate quietly cover part of it
   * would mean her offer was decoration for the stretch the apparatus already
   * reaches, which is the opposite of the thing being proved.
   */
  readonly useFixed?: boolean;
  /**
   * The socket height of the body actually walking the span.
   *
   * REFERENCES ARE SOCKET TO SOCKET. Measuring to the ground under a walker's
   * feet would put every ray below the apparatus cap's top face and make the
   * instrument occlude itself from its own reference plane; the qualification
   * pins the cap below every ray socket precisely so endpoint contact stays
   * harmless. Defaults to W-7744's visor, the body that tests offered spans.
   */
  readonly travellerSocketHeight?: number;
}

export interface SpanTestResult {
  /** How many leading samples are actually demonstrable right now. */
  readonly supportedPrefix: number;
  /** Null when the whole offered span is supported. */
  readonly reason: CommonGroundHoldReason | null;
  readonly blockedBy: string | null;
  /** Index of the first sample that could not be supported, or -1. */
  readonly firstUnsupportedIndex: number;
}

/**
 * Walk the offered span and stop at the first sample no available reference can
 * hold, reporting the literal cause.
 *
 * Footing is checked FIRST and separately: an unsafe step is reported as
 * `footing-invalid` and is not reconsidered under a held reference, because a
 * witness cannot make bad ground safe.
 */
export function evaluateOfferedSpan(
  samples: readonly CommonGroundPoint[],
  source: SpanTestSource,
  footing: CommonGroundFooting,
  options: ReferenceCheckOptions & WalkedSegmentOptions = {}
): SpanTestResult {
  if (samples.length === 0) {
    return { supportedPrefix: 0, reason: 'footing-invalid', blockedBy: null, firstUnsupportedIndex: 0 };
  }
  const socketHeight = source.travellerSocketHeight ?? WORKER_REFERENCE_SOCKET_HEIGHT;
  for (let index = 0; index < samples.length; index += 1) {
    if (index > 0 && !walkedSegmentSupported(samples[index - 1], samples[index], footing, options)) {
      return {
        supportedPrefix: index,
        reason: 'footing-invalid',
        blockedBy: null,
        firstUnsupportedIndex: index
      };
    }
    const travelling: CommonGroundPoint = {
      x: samples[index].x,
      y: samples[index].y + socketHeight,
      z: samples[index].z
    };
    const useFixed = source.useFixed !== false;
    const fixed = useFixed
      ? checkReference(source.fixed, travelling, options)
      : null;
    if (fixed?.ok) continue;
    const held = source.held ? checkReference(source.held, travelling, options) : null;
    if (held?.ok) continue;
    const failure = fixed ?? held;
    return {
      supportedPrefix: index,
      reason: failure?.reason ?? 'reference-vacant',
      blockedBy: failure?.blockedBy ?? null,
      firstUnsupportedIndex: index
    };
  }
  return {
    supportedPrefix: samples.length,
    reason: null,
    blockedBy: null,
    firstUnsupportedIndex: -1
  };
}

// --- Occupancy hysteresis ------------------------------------------------------------

function withinCylinder(
  body: CommonGroundPoint,
  pose: CommonGroundPoint,
  radius: number,
  vertical: number
): boolean {
  return Math.hypot(body.x - pose.x, body.z - pose.z) <= radius
    && Math.abs(body.y - pose.y) <= vertical;
}

export function withinOccupancyCylinder(body: CommonGroundPoint, pose: CommonGroundPoint): boolean {
  return withinCylinder(body, pose, OCCUPANCY_RADIUS_UNITS, OCCUPANCY_VERTICAL_UNITS);
}

export function withinReleaseCylinder(body: CommonGroundPoint, pose: CommonGroundPoint): boolean {
  return withinCylinder(body, pose, RELEASE_RADIUS_UNITS, RELEASE_VERTICAL_UNITS);
}

/**
 * Occupancy with hysteresis: entering the inner cylinder establishes it, and
 * only leaving the OUTER one drops it. Turning on the spot, or drifting a few
 * centimetres, cannot flicker a held reference.
 */
export function nextOccupancy(
  occupied: boolean,
  body: CommonGroundPoint,
  pose: CommonGroundPoint
): boolean {
  return occupied ? withinReleaseCylinder(body, pose) : withinOccupancyCylinder(body, pose);
}

/** Two bodies may not stand on top of each other; the reference is a place. */
export function bodiesClear(a: CommonGroundPoint, b: CommonGroundPoint): boolean {
  return Math.hypot(a.x - b.x, a.z - b.z) >= BODY_BODY_CLEARANCE_UNITS;
}

/**
 * Progress along a fixed authored polyline, in walked units.
 *
 * Endpoint proximity is NOT progress. A body must actually traverse the span,
 * so progress advances only while the body is near the segment it claims to be
 * walking, and never jumps ahead of the segment it has reached.
 */
export function routeProgressUnits(
  route: readonly CommonGroundPoint[],
  body: CommonGroundPoint,
  previousUnits: number,
  displacementUnits: number,
  corridorRadius = 2.5
): number {
  // NO DISPLACEMENT, NO PROGRESS. A stationary body earns nothing, however long
  // it stands there and however many times it is sampled, which is what makes
  // standing at C worth zero and a timer worth nothing at all.
  if (!(displacementUnits > 0)) return previousUnits;
  // The ceiling is computed ONCE from the progress already earned, so repeated
  // iterations of the scan below cannot compound an allowance, and a later
  // segment's proximity cannot be claimed ahead of the frontier.
  const ceiling = previousUnits + displacementUnits;
  let travelled = 0;
  let best = previousUnits;
  for (let index = 1; index < route.length; index += 1) {
    const from = route[index - 1];
    const to = route[index];
    const segment = distanceBetween(from, to);
    if (segment <= 0) continue;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const t = Math.max(0, Math.min(1,
      ((body.x - from.x) * dx + (body.y - from.y) * dy + (body.z - from.z) * dz)
        / (segment * segment)));
    const closest = { x: from.x + dx * t, y: from.y + dy * t, z: from.z + dz * t };
    const arc = travelled + segment * t;
    if (arc > best && arc <= ceiling && distanceBetween(body, closest) <= corridorRadius) {
      best = arc;
    }
    travelled += segment;
  }
  return Math.min(best, travelled);
}

// --- Display grammar ------------------------------------------------------------------
//
// PURE PLACEMENT MATH, no THREE and no mesh. The renderer turns each placement
// into one instance matrix in the existing pooled unit-box mesh, so the shape a
// player reads is decided here and can be asserted without a GPU.
//
// The signed grammar (`scene-cinema-lane.json#/trace/glyphRealization`) is a
// SHAPE grammar, deliberately, because colour and glow are unavailable evidence:
// they are gone on the lowest tier, gone under a colour-blind profile, and gone
// in a muted, unlit night frame. So:
//
//   proposed sample  -> ONE short bar along the recorded local segment. The gaps
//                       between successive bars are what make it read broken.
//   tested sample    -> TWO parallel bars with a visible gap between them.
//   held endpoint    -> the endpoint's PAIR is REPLACED by two transverse
//                       half-bars with an open centre. Never a third glyph.
//   common guide     -> one thin continuous bar per existing polyline segment.
//
// Two instances per sample is the hard ceiling, and it is what makes 2 x 128
// recorded samples fit the existing 512-instance pool exactly.

/** A single instance of the shared unit-box trace geometry, in world space. */
export interface TraceGlyph {
  /** Centre of the box. `y` already includes the surface offset. */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Rotation about +Y, radians. 0 points along +X. */
  readonly angle: number;
  /** Extent along the bar's own axis. */
  readonly lengthUnits: number;
  /** Extent across the bar. */
  readonly widthUnits: number;
}

/** Sits on the ground rather than in it; the same offset the first pass used. */
export const TRACE_SURFACE_OFFSET = 0.06;
export const TRACE_GLYPH_THICKNESS = 0.06;
/** A proposed/tested bar is short: it marks a place, it does not connect places. */
export const TRACE_BAR_MIN_LENGTH = 0.2;
export const TRACE_BAR_MAX_LENGTH = 0.7;
export const TRACE_BAR_WIDTH = 0.09;
/** The paired stroke's two rails and the gap that makes them read as two. */
export const TRACE_PAIR_WIDTH = 0.07;
export const TRACE_PAIR_SEPARATION = 0.22;
/** The open transverse stop: a bar ACROSS the path, split around an open centre. */
export const TRACE_STOP_SPAN = 0.62;
export const TRACE_STOP_OPENING = 0.2;
/** The planned common guide is a thin continuous line, not a row of marks. */
export const COMMON_GUIDE_WIDTH = 0.05;
/** Sample positions used by the completed paired common display. */
export const COMMON_TESTED_SAMPLE_COUNT = 31;

function normalizeXZ(dx: number, dz: number): { x: number; z: number } | null {
  const length = Math.hypot(dx, dz);
  if (!(length > 1e-6)) return null;
  return { x: dx / length, z: dz / length };
}

/**
 * The direction a mark at `index` is aligned to.
 *
 * At a corner this is the BISECTOR of the actual recorded incoming and outgoing
 * segments, which is what "orient bars from actual recorded incoming/outgoing
 * segments" means for a mark that has two of them. It is never an axis-aligned
 * default, and never an enlarged square standing in for a turn.
 */
function localTangent(
  points: readonly CommonGroundPoint[],
  index: number
): { x: number; z: number } {
  const previous = index > 0 ? points[index - 1] : null;
  const next = index + 1 < points.length ? points[index + 1] : null;
  const here = points[index];
  const incoming = previous ? normalizeXZ(here.x - previous.x, here.z - previous.z) : null;
  const outgoing = next ? normalizeXZ(next.x - here.x, next.z - here.z) : null;
  if (incoming && outgoing) {
    const bisector = normalizeXZ(incoming.x + outgoing.x, incoming.z + outgoing.z);
    // A perfect reversal has no bisector; keep the incoming heading rather than
    // inventing one.
    return bisector ?? incoming;
  }
  return incoming ?? outgoing ?? { x: 1, z: 0 };
}

/** Clamped to the REAL local spacing, so a dense corner cannot draw over itself. */
function localBarLength(points: readonly CommonGroundPoint[], index: number): number {
  let spacing = Infinity;
  if (index > 0) spacing = Math.min(spacing, distanceBetween(points[index - 1], points[index]));
  if (index + 1 < points.length) {
    spacing = Math.min(spacing, distanceBetween(points[index], points[index + 1]));
  }
  if (!Number.isFinite(spacing)) spacing = TRACE_BAR_MAX_LENGTH;
  return Math.max(TRACE_BAR_MIN_LENGTH, Math.min(TRACE_BAR_MAX_LENGTH, spacing * 0.55));
}

function angleOf(direction: { x: number; z: number }): number {
  return Math.atan2(direction.z, direction.x);
}

export interface TraceGlyphOptions {
  /** Leading samples an ACTUAL test has proven. Those read as paired strokes. */
  readonly testedPrefixCount?: number;
  /** Sample index where a real hold stopped the test, or -1/null for none. */
  readonly heldIndex?: number | null;
}

/**
 * Lay out one recorded survey route.
 *
 * Every recorded sample is represented — nothing is decimated to fit, because a
 * dropped interior sample would silently change the argument she walked. The
 * caller is responsible for the pool ceiling; capacity already stopped honestly
 * upstream, in the slot itself.
 */
export function traceGlyphs(
  points: readonly CommonGroundPoint[],
  options: TraceGlyphOptions = {}
): TraceGlyph[] {
  const glyphs: TraceGlyph[] = [];
  const tested = Math.max(0, Math.min(options.testedPrefixCount ?? 0, points.length));
  const held = options.heldIndex ?? -1;
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const y = point.y + TRACE_SURFACE_OFFSET;
    const tangent = localTangent(points, index);
    const angle = angleOf(tangent);
    if (index === held && held >= 0) {
      // THE OPEN TRANSVERSE STOP REPLACES THE PAIR. The endpoint where his test
      // actually stopped reads as a barrier across the path with its middle
      // left open — the shape of "this is as far as this went", not a decorated
      // version of the mark before it.
      const half = Math.max(0.08, (TRACE_STOP_SPAN - TRACE_STOP_OPENING) / 2);
      const offset = TRACE_STOP_OPENING / 2 + half / 2;
      const across = { x: -tangent.z, z: tangent.x };
      const acrossAngle = angleOf(across);
      for (const sign of [-1, 1]) {
        glyphs.push({
          x: point.x + across.x * offset * sign,
          y,
          z: point.z + across.z * offset * sign,
          angle: acrossAngle,
          lengthUnits: half,
          widthUnits: TRACE_BAR_WIDTH
        });
      }
      continue;
    }
    const length = localBarLength(points, index);
    if (index < tested) {
      const normal = { x: -tangent.z, z: tangent.x };
      const offset = TRACE_PAIR_SEPARATION / 2;
      for (const sign of [-1, 1]) {
        glyphs.push({
          x: point.x + normal.x * offset * sign,
          y,
          z: point.z + normal.z * offset * sign,
          angle,
          lengthUnits: length,
          widthUnits: TRACE_PAIR_WIDTH
        });
      }
      continue;
    }
    glyphs.push({ x: point.x, y, z: point.z, angle, lengthUnits: length, widthUnits: TRACE_BAR_WIDTH });
  }
  return glyphs;
}

/**
 * The planned, unverified common guide over the EXISTING E-to-C polyline.
 *
 * No search, no new route and no stored samples: the vertices are the qualified
 * ones. `supportedThrough` is the last vertex index the live ground actually
 * carries; beyond it the line simply stops, with the same open transverse stop
 * the walked grammar uses, rather than floating over an edited hole or
 * replanning itself around one. A truncated guide changes no state and grants no
 * proof — the existing hold and repair still own that.
 */
export function commonGuideGlyphs(
  route: readonly CommonGroundPoint[],
  supportedThrough: number = route.length - 1
): TraceGlyph[] {
  const glyphs: TraceGlyph[] = [];
  const last = Math.max(0, Math.min(supportedThrough, route.length - 1));
  for (let index = 1; index <= last; index += 1) {
    const from = route[index - 1];
    const to = route[index];
    const direction = normalizeXZ(to.x - from.x, to.z - from.z);
    const length = distanceBetween(from, to);
    if (!direction || !(length > 0)) continue;
    glyphs.push({
      x: (from.x + to.x) / 2,
      y: (from.y + to.y) / 2 + TRACE_SURFACE_OFFSET,
      z: (from.z + to.z) / 2,
      angle: angleOf(direction),
      lengthUnits: length,
      widthUnits: COMMON_GUIDE_WIDTH
    });
  }
  if (last < route.length - 1) {
    const point = route[last];
    const tangent = localTangent(route, last);
    const across = { x: -tangent.z, z: tangent.x };
    const half = Math.max(0.08, (TRACE_STOP_SPAN - TRACE_STOP_OPENING) / 2);
    const offset = TRACE_STOP_OPENING / 2 + half / 2;
    const acrossAngle = angleOf(across);
    for (const sign of [-1, 1]) {
      glyphs.push({
        x: point.x + across.x * offset * sign,
        y: point.y + TRACE_SURFACE_OFFSET,
        z: point.z + across.z * offset * sign,
        angle: acrossAngle,
        lengthUnits: half,
        widthUnits: TRACE_BAR_WIDTH
      });
    }
  }
  return glyphs;
}

/** Evenly spaced positions along an authored polyline, endpoints included. */
export function sampleRouteEvenly(
  route: readonly CommonGroundPoint[],
  count: number
): CommonGroundPoint[] {
  if (route.length === 0 || count <= 0) return [];
  if (route.length === 1 || count === 1) return [route[0]];
  const lengths: number[] = [];
  let total = 0;
  for (let index = 1; index < route.length; index += 1) {
    const segment = distanceBetween(route[index - 1], route[index]);
    lengths.push(segment);
    total += segment;
  }
  const out: CommonGroundPoint[] = [];
  for (let step = 0; step < count; step += 1) {
    let remaining = (total * step) / (count - 1);
    let index = 0;
    while (index < lengths.length && remaining > lengths[index]) {
      remaining -= lengths[index];
      index += 1;
    }
    if (index >= lengths.length) {
      out.push(route[route.length - 1]);
      continue;
    }
    const from = route[index];
    const to = route[index + 1];
    const t = lengths[index] > 0 ? remaining / lengths[index] : 0;
    out.push({
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
      z: from.z + (to.z - from.z) * t
    });
  }
  return out;
}

/**
 * The completed common display: paired tested strokes at qualified positions.
 *
 * Reached ONLY from a validated completion. It is the same paired grammar the
 * walked survey uses for a tested sample, because by then it means the same
 * thing: a body actually went along there and the reference actually held.
 */
export function commonTestedGlyphs(route: readonly CommonGroundPoint[]): TraceGlyph[] {
  const points = sampleRouteEvenly(route, COMMON_TESTED_SAMPLE_COUNT);
  return traceGlyphs(points, { testedPrefixCount: points.length });
}
