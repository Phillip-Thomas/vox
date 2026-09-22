// --- Common Ground (ch13) bounded chapter state -------------------------------------
//
// PURE. No React, no world, no THREE, no persistence, no clock. Everything here
// is a value transformation over the chapter's own facts, so the reciprocal
// survey can be tested exhaustively without a renderer.
//
// The shape is dictated by four things the signed contract says the runtime must
// be able to tell apart, and which an "index into the trace" cannot express:
//
//   1. The intermediate witness is OFF the route (W is at z=10, the survey runs
//      along z=12). A sample index therefore cannot identify where the player
//      stood; the pose itself is stored.
//   2. Two route classes are complete, equal outcomes. The class that was
//      actually earned is a fact, not something re-derived from a length.
//   3. Terra's reciprocal passage has its own progression and its own proof,
//      separate from the worker's test and separate from the saved survey class.
//   4. The final far reference has an OFFER and, independently, a live
//      OCCUPANCY. The offer survives stepping out of the release cylinder; the
//      occupancy does not. Collapsing them into one boolean is what would make
//      "looking away is free" a lie.
//
// Progression authority stays with the milestone ledger. This snapshot carries
// route data and in-chapter position; it never carries "the chapter is done",
// which is why hydration can never manufacture a completion.

export const COMMON_GROUND_SNAPSHOT_VERSION = 1;

// --- Contract-supplied constants ----------------------------------------------------
//
// Every number below is quoted from the signed geometry qualification
// (`.codex/story-runs/2026-09-06-common-ground/staged-geometry-qualification.json`,
// `#/thresholds` and `#/sockets`). None is chosen here.

/** Sample cap AND length cap both bind; capacity stops honestly, never decimates. */
export const MAX_TRACE_POINTS = 128;
export const MAX_TRACE_LENGTH_UNITS = 120;
/** Nominal spacing between recorded samples while walking. */
export const TRACE_SAMPLE_SPACING_UNITS = 1;
/** A heading change larger than this records a corner sample out of cadence. */
export const TRACE_CORNER_SPACING_UNITS = 0.25;

/** Socket-to-socket line-of-reference range. */
export const REFERENCE_RANGE_UNITS = 12;
/** Fixed apparatus plate. */
export const FIXED_REFERENCE_SOCKET_HEIGHT = 1.3;
/** W-7744's visor. */
export const WORKER_REFERENCE_SOCKET_HEIGHT = 1.85;
/** Terra's eye. */
export const PLAYER_REFERENCE_SOCKET_HEIGHT = 1.35;

/** Occupancy (inner) cylinder — entering it establishes/keeps a held reference. */
export const OCCUPANCY_RADIUS_UNITS = 1.25;
export const OCCUPANCY_VERTICAL_UNITS = 0.6;
/** Release (outer) cylinder — leaving it suspends the test. Hysteresis. */
export const RELEASE_RADIUS_UNITS = 1.75;
export const RELEASE_VERTICAL_UNITS = 0.9;

/** Minimum body-to-body separation between the two actors. */
export const BODY_BODY_CLEARANCE_UNITS = 1;

export interface CommonGroundPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Named poses, exactly as qualified. `y` is the grounded body origin. */
export const CG_POSES = Object.freeze({
  /** Fixed survey apparatus base (its socket is +1.30). */
  R: Object.freeze({ x: -34, y: 51.05, z: 20 }),
  /** Survey start. */
  S: Object.freeze({ x: -26, y: 51.05, z: 12 }),
  /** Survey end / common start. */
  E: Object.freeze({ x: -42, y: 51.05, z: 12 }),
  /** Common end. */
  C: Object.freeze({ x: -48, y: 51.05, z: 12 }),
  /** W-7744's reference pose for Terra's comparison (distinct from E). */
  H: Object.freeze({ x: -40, y: 51.05, z: 12 }),
  /** W-7744's inspection pose, and the off-route intermediate witness point. */
  W: Object.freeze({ x: -34, y: 51.05, z: 10 }),
  /** Terra's far reference for his independent test. */
  T: Object.freeze({ x: -44, y: 51.05, z: 12 })
}) satisfies Readonly<Record<string, CommonGroundPoint>>;

export type CommonGroundPoseId = keyof typeof CG_POSES;

/** The measured short survey route: 16 walked units, one housing-shadow example. */
export const CG_ROUTE_SHORT: readonly CommonGroundPoint[] = Object.freeze([
  { x: -26, y: 51.05, z: 12 }, { x: -28, y: 51.05, z: 12 }, { x: -30, y: 51.05, z: 12 },
  { x: -32, y: 51.05, z: 12 }, { x: -34, y: 51.05, z: 12 }, { x: -36, y: 51.05, z: 12 },
  { x: -38, y: 51.05, z: 12 }, { x: -40, y: 51.05, z: 12 }, { x: -42, y: 51.05, z: 12 }
].map(point => Object.freeze(point)));

/** The measured long survey route: 36 walked units, supported end to end. */
export const CG_ROUTE_LONG: readonly CommonGroundPoint[] = Object.freeze([
  { x: -26, y: 51.05, z: 12 }, { x: -26, y: 51.05, z: 14 }, { x: -28, y: 51.05, z: 14 },
  { x: -28, y: 51.05, z: 16 }, { x: -30, y: 51.05, z: 16 }, { x: -30, y: 51.05, z: 18 },
  { x: -32, y: 51.05, z: 18 }, { x: -32, y: 51.05, z: 20 }, { x: -32, y: 51.05, z: 22 },
  { x: -34, y: 51.05, z: 22 }, { x: -36, y: 51.05, z: 22 }, { x: -38, y: 51.05, z: 22 },
  { x: -40, y: 51.05, z: 22 }, { x: -42, y: 51.05, z: 22 }, { x: -42, y: 51.05, z: 20 },
  { x: -42, y: 51.05, z: 18 }, { x: -42, y: 51.05, z: 16 }, { x: -42, y: 51.05, z: 14 },
  { x: -42, y: 51.05, z: 12 }
].map(point => Object.freeze(point)));

/**
 * The common route: 18 walked units from E to C.
 *
 * THE SIX-UNIT ENDPOINT SEPARATION IS NOT THE PASSAGE. E and C are six units
 * apart in a straight line; the walked span is eighteen, and 8 of those units
 * lie outside the fixed reference. That is the whole reason the second body is
 * necessary, so nothing may shortcut E→C by its endpoints.
 */
export const CG_ROUTE_COMMON: readonly CommonGroundPoint[] = Object.freeze([
  { x: -42, y: 51.05, z: 12 }, { x: -42, y: 51.05, z: 14 }, { x: -42, y: 51.05, z: 16 },
  { x: -44, y: 51.05, z: 16 }, { x: -44, y: 51.05, z: 18 }, { x: -46, y: 51.05, z: 18 },
  { x: -48, y: 51.05, z: 18 }, { x: -48, y: 51.05, z: 16 }, { x: -48, y: 51.05, z: 14 },
  { x: -48, y: 51.05, z: 12 }
].map(point => Object.freeze(point)));

/** Walked length of the common span; the passage is only complete at this value. */
export const CG_COMMON_ROUTE_UNITS = 18;

// --- Trace ---------------------------------------------------------------------------

export interface TraceSample {
  x: number;
  y: number;
  z: number;
  /** True when the sample was recorded by a heading change rather than cadence. */
  corner: boolean;
  /**
   * Actual walked distance accumulated when this sample was recorded.
   *
   * NOT the polyline length up to here. A curve or a loop between two nominal
   * samples is distance she really walked, and the 120-unit cap is about what
   * she walked, not about what got sampled — otherwise wandering between
   * samples is free trace. Carrying it per sample is also what lets a tail
   * revision restore the tested portion's REAL length rather than a straight-
   * line reconstruction of it.
   */
  walkedAt: number;
}

export interface TraceSlot {
  samples: TraceSample[];
  /** Straight-line length of the recorded polyline. Presentation and geometry. */
  lengthUnits: number;
  /** Actual walked distance, including movement between samples. Capped. */
  walkedUnits: number;
  /** Distance walked since the last recorded sample. Never lost to a pause. */
  pendingUnits: number;
  /** Set once, by an ACTUAL completed test. Null on an untested proposal. */
  routeClass: SurveyRouteClass | null;
  /**
   * Number of leading samples an actual test has proven. Never lowered by a
   * revision — the demonstrated argument is not spent by editing what follows it.
   */
  testedPrefixCount: number;
  /** Monotonic. Bumps ONLY when a tail edit actually changes the samples. */
  tailRevision: number;
  /** Index of the last sample in the currently offered span, or null. */
  offeredEndIndex: number | null;
  /** True once capacity stopped growth; the trace stops honestly, not silently. */
  atCapacity: boolean;
}

export type CommonGroundHoldReason =
  | 'reference-out-of-range'
  | 'reference-occluded-survey-housing'
  | 'reference-occluded-other-solid'
  | 'footing-invalid'
  /** An established reference stepped out of its release cylinder. */
  | 'reference-vacant'
  /**
   * A body is standing where the other body has to walk. A TEMPORARY
   * SUSPENSION, not a refusal: it keeps the current texture, publishes no new
   * mood, and is repaired by moving rather than by revising anything.
   */
  | 'body-clearance';

/** Both classes are complete equal outcomes. No ranking is expressed or stored. */
export type SurveyRouteClass = 'fixed-reference' | 'held-reference';

export type SurveyPhase =
  | 'idle'
  | 'awaiting-start'
  | 'drawing'
  | 'offered'
  | 'testing'
  | 'held'
  | 'tested';

export interface WitnessState {
  /**
   * The actual world pose the player must occupy. Stored as a pose because the
   * witness is OFF the route: no sample index can name it.
   */
  pose: CommonGroundPoint;
  /** Explicit [F] offer. Survives leaving the release cylinder. */
  offered: boolean;
  /** Live occupancy of the inner cylinder. Independent of the offer. */
  occupied: boolean;
  /** The tested-sample index at which this witness was first required. */
  requiredFromIndex: number;
}

export interface CommonGroundHomeState {
  faultReviewed: boolean;
  returnChosen: boolean;
}

export interface CommonGroundSurveyState {
  phase: SurveyPhase;
  /**
   * EXACTLY TWO SLOTS, and they mean different things.
   *
   * `accepted` is a route an actual test completed, with the class it earned.
   * `working` is the current proposal. A new proposal, a revision or an
   * explicit clear touches only `working`: the demonstrated route and its class
   * are earned facts and are never quietly replaced by the next attempt. Total
   * storage stays bounded at two, which is also the render pool's shape.
   */
  accepted: TraceSlot | null;
  working: TraceSlot | null;
  witness: WitnessState | null;
  hold: { reason: CommonGroundHoldReason | null; atIndex: number };
  /**
   * He has physically reached the start of the FIRST offered span in this
   * survey. It is not reset by a revision: a reoffered edited suffix resumes
   * from his actual last tested point, and manufacturing a return to W or a
   * replay of the initial approach would be a lie about where his body is.
   */
  approached: boolean;
  /** His actual sampling progress along the offered span. */
  testedIndex: number;
  /**
   * WHERE HIS BODY ACTUALLY IS. Persisted, because a save taken between two
   * samples is a save taken with him standing somewhere real, and resuming him
   * at the start of the span would replay a walk he already made.
   */
  workerPose: CommonGroundPoint | null;
  /** True when the player has voluntarily selected the revision option. */
  revisionReady: boolean;
}

export type WorkerReferenceStage =
  | 'none'
  | 'positioning-to-h'
  | 'holding-h'
  | 'positioning-to-e'
  | 'testing'
  | 'arrived';

export interface CommonGroundCommonState {
  stage: WorkerReferenceStage;
  /** Terra's own walked progress along the common route, in units. */
  terraUnits: number;
  /** Her actual complete E→C passage under his maintained reference. */
  comparisonProved: boolean;
  /** The explicit far-reference offer, separate from live occupancy. */
  finalReferenceOffered: boolean;
  finalReferenceOccupied: boolean;
  /** His own walked progress along the full E→C test, in units. */
  workerUnits: number;
  /** His actual pose, so a resumed leg continues rather than restarting. */
  workerPose: CommonGroundPoint | null;
  /** Commits exactly once, at actual arrival plus the earned reciprocal proof. */
  committed: boolean;
}

export interface CommonGroundSnapshot {
  version: typeof COMMON_GROUND_SNAPSHOT_VERSION;
  /** Identity keying: a snapshot only ever belongs to one actor in one world. */
  actorId: string;
  worldId: string;
  /**
   * True when this value came back from storage rather than from live play.
   * Every acknowledgement, anchor and score edge consults it: a restored save
   * enters steady and silent.
   */
  hydrated: boolean;
  home: CommonGroundHomeState;
  survey: CommonGroundSurveyState;
  common: CommonGroundCommonState;
}

export function createCommonGroundSnapshot(actorId: string, worldId: string): CommonGroundSnapshot {
  return {
    version: COMMON_GROUND_SNAPSHOT_VERSION,
    actorId,
    worldId,
    hydrated: false,
    home: { faultReviewed: false, returnChosen: false },
    survey: {
      phase: 'idle',
      accepted: null,
      working: null,
      witness: null,
      hold: { reason: null, atIndex: -1 },
      approached: false,
      testedIndex: -1,
      workerPose: null,
      revisionReady: false
    },
    common: {
      stage: 'none',
      terraUnits: 0,
      comparisonProved: false,
      finalReferenceOffered: false,
      finalReferenceOccupied: false,
      workerUnits: 0,
      workerPose: null,
      committed: false
    }
  };
}

export function createTraceSlot(first: Omit<TraceSample, 'walkedAt'>): TraceSlot {
  return {
    samples: [{ ...first, walkedAt: 0 }],
    lengthUnits: 0,
    walkedUnits: 0,
    pendingUnits: 0,
    routeClass: null,
    testedPrefixCount: 0,
    tailRevision: 0,
    offeredEndIndex: null,
    atCapacity: false
  };
}

/**
 * Bank actual body displacement against the length cap.
 *
 * Called with the real distance the body moved this frame, whether or not a
 * sample is recorded for it. A pause, a focus loss or a resume neither loses
 * nor invents this debt; it is simply distance she walked.
 */
export function accumulateTraceDistance(slot: TraceSlot, displacement: number): void {
  if (!(displacement > 0) || slot.atCapacity) return;
  const next = slot.walkedUnits + displacement;
  if (next > MAX_TRACE_LENGTH_UNITS) {
    slot.walkedUnits = MAX_TRACE_LENGTH_UNITS;
    slot.pendingUnits = MAX_TRACE_LENGTH_UNITS - slot.samples[slot.samples.length - 1].walkedAt;
    slot.atCapacity = true;
    return;
  }
  slot.walkedUnits = next;
  slot.pendingUnits += displacement;
}

export function distanceBetween(a: CommonGroundPoint, b: CommonGroundPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function walkedLength(points: readonly CommonGroundPoint[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += distanceBetween(points[index - 1], points[index]);
  }
  return total;
}

export type AppendOutcome = 'appended' | 'too-close' | 'at-capacity';

/**
 * Record one sample, honouring BOTH caps without decimation.
 *
 * Decimation is the tempting fix and it is forbidden: dropping an interior
 * sample to make room would silently change the demonstrated argument the player
 * walked. When either cap is reached the trace stops and says so.
 */
export function appendTraceSample(
  slot: TraceSlot,
  sample: Omit<TraceSample, 'walkedAt'>
): AppendOutcome {
  if (slot.atCapacity) return 'at-capacity';
  const last = slot.samples[slot.samples.length - 1];
  const step = distanceBetween(last, sample);
  const minimum = sample.corner ? TRACE_CORNER_SPACING_UNITS : TRACE_SAMPLE_SPACING_UNITS;
  if (step < minimum) return 'too-close';
  if (slot.samples.length + 1 > MAX_TRACE_POINTS) {
    slot.atCapacity = true;
    return 'at-capacity';
  }
  // The walked mark is the real distance banked so far, which is at least the
  // straight-line step and is usually more.
  const walkedAt = Math.max(slot.walkedUnits, last.walkedAt + step);
  if (walkedAt > MAX_TRACE_LENGTH_UNITS) {
    slot.atCapacity = true;
    return 'at-capacity';
  }
  slot.samples.push({ ...sample, walkedAt });
  slot.lengthUnits += step;
  slot.walkedUnits = Math.max(slot.walkedUnits, walkedAt);
  slot.pendingUnits = 0;
  return 'appended';
}

/**
 * Reopen only the unverified suffix at `fromIndex`.
 *
 * The tested prefix survives, `tailRevision` bumps only when samples actually
 * changed (a no-op revision must not look like an edit to anything downstream),
 * and the offer is withdrawn because the proposal is no longer the one that was
 * offered.
 */
export function reviseTail(slot: TraceSlot, fromIndex: number): boolean {
  const floor = Math.max(0, slot.testedPrefixCount - 1);
  const cut = Math.max(floor, Math.min(fromIndex, slot.samples.length - 1));
  const removed = slot.samples.length - (cut + 1);
  slot.offeredEndIndex = null;
  slot.atCapacity = false;
  if (removed <= 0) {
    // A NO-OP EDIT IS NOT AN EDIT. The revision number is downstream identity —
    // the actor's leg key, the render slot, the guidance — and bumping it for a
    // reopen that changed nothing would restart all three for no reason.
    slot.pendingUnits = 0;
    return false;
  }
  slot.samples.length = cut + 1;
  slot.lengthUnits = walkedLength(slot.samples);
  // The tested portion's REAL walked length survives; only the discarded tail's
  // distance is given back.
  slot.walkedUnits = slot.samples[slot.samples.length - 1].walkedAt;
  slot.pendingUnits = 0;
  slot.tailRevision += 1;
  return true;
}

/** Growth of the demonstrated prefix. Monotonic: a test never un-proves samples. */
export function markTestedPrefix(slot: TraceSlot, count: number): void {
  slot.testedPrefixCount = Math.max(slot.testedPrefixCount, Math.min(count, slot.samples.length));
}

/**
 * A real terrain edit under the demonstrated prefix. This is the ONLY way the
 * tested prefix shrinks, and it is a physical fact, never a UI action.
 */
export function invalidateTestedPrefix(slot: TraceSlot, fromIndex: number): void {
  slot.testedPrefixCount = Math.max(0, Math.min(slot.testedPrefixCount, fromIndex));
}

/** The last sample an actual test proved — the honest revision point. */
export function lastTestedPoint(slot: TraceSlot | null): TraceSample | null {
  if (!slot || slot.samples.length === 0) return null;
  const index = Math.max(0, slot.testedPrefixCount - 1);
  return slot.samples[index] ?? slot.samples[0];
}

// --- Common display state -------------------------------------------------------------
//
// The scene-v2 amendment (`scene-cinema-lane.json#/commonGuide`) permits exactly
// ONE unwalked visual: the already-qualified E-to-C polyline may be shown as an
// explicitly planned, unverified guide, and only after W-7744 has PHYSICALLY
// reached H. It is never evidence. The initial S-to-E survey keeps no preview at
// all, and nothing here writes a sample, a unit or a proof.

/** How close his recorded body must be to H before the reference reads as held. */
export const REFERENCE_HOLD_TOLERANCE_UNITS = 0.25;

/**
 * Actual H occupancy, revalidated against a real pose rather than a stage label.
 *
 * `stage` alone is a claim; a claim plus the body it describes is a fact. Callers
 * with a live actor position pass it, so a restored save proves readiness from
 * where his body actually is rather than from the word that was serialized.
 */
export function commonGroundReferenceHeld(
  snapshot: CommonGroundSnapshot,
  workerAt: CommonGroundPoint | null = snapshot.common.workerPose
): boolean {
  if (snapshot.common.stage !== 'holding-h') return false;
  if (!workerAt) return false;
  return distanceBetween(workerAt, CG_POSES.H) <= REFERENCE_HOLD_TOLERANCE_UNITS;
}

export type CommonGroundDisplayKind = 'none' | 'planned-guide' | 'tested-common';

/**
 * Which common display the chapter has actually earned.
 *
 * `planned-guide` from his real arrival at H, and it STAYS planned through
 * Terra's passage and through his own test: her scalar `terraUnits` never
 * becomes footsteps, and a displayed line never becomes proof. Only `committed`
 * — his actual final arrival after the full eighteen units, with her reciprocal
 * passage already proved — promotes it to paired tested geometry.
 */
export function commonGroundCommonDisplay(
  snapshot: CommonGroundSnapshot,
  workerAt: CommonGroundPoint | null = snapshot.common.workerPose
): CommonGroundDisplayKind {
  const common = snapshot.common;
  if (common.committed) return 'tested-common';
  if (commonGroundReferenceHeld(snapshot, workerAt)) return 'planned-guide';
  // He has left H for the return leg or his own test; the comparison she already
  // walked is still the thing being checked, so the planned line stays up.
  if (common.stage === 'positioning-to-e' || common.stage === 'testing') return 'planned-guide';
  return 'none';
}

// --- Serialization -------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readSample(value: unknown): TraceSample | null {
  if (!isRecord(value)) return null;
  const x = value.x;
  const y = value.y;
  const z = value.z;
  const walkedAt = value.walkedAt;
  if (typeof x !== 'number' || !Number.isFinite(x)) return null;
  if (typeof y !== 'number' || !Number.isFinite(y)) return null;
  if (typeof z !== 'number' || !Number.isFinite(z)) return null;
  if (typeof walkedAt !== 'number' || !Number.isFinite(walkedAt) || walkedAt < 0) return null;
  if (typeof value.corner !== 'boolean') return null;
  return { x, y, z, corner: value.corner, walkedAt };
}

/**
 * Strict slot read. `undefined` means "no slot", and `INVALID` means the whole
 * snapshot is inconsistent — never a partial graft.
 */
const INVALID = Symbol('invalid');

function readSlot(value: unknown): TraceSlot | null | typeof INVALID {
  if (value == null) return null;
  if (!isRecord(value) || !Array.isArray(value.samples)) return INVALID;
  const samples: TraceSample[] = [];
  for (const raw of value.samples) {
    const sample = readSample(raw);
    if (!sample) return INVALID;
    samples.push(sample);
  }
  if (samples.length === 0 || samples.length > MAX_TRACE_POINTS) return INVALID;
  // Walk marks must be monotonic, and each must be at least the straight-line
  // distance: a save cannot claim a shorter walk than the geometry it stores.
  for (let index = 1; index < samples.length; index += 1) {
    const step = distanceBetween(samples[index - 1], samples[index]);
    if (samples[index].walkedAt + 1e-6 < samples[index - 1].walkedAt + step) return INVALID;
  }
  const lengthUnits = walkedLength(samples);
  const walkedUnits = typeof value.walkedUnits === 'number' && Number.isFinite(value.walkedUnits)
    ? value.walkedUnits
    : NaN;
  if (!Number.isFinite(walkedUnits)) return INVALID;
  if (walkedUnits + 1e-6 < samples[samples.length - 1].walkedAt) return INVALID;
  if (walkedUnits > MAX_TRACE_LENGTH_UNITS + 1e-6) return INVALID;
  if (lengthUnits > MAX_TRACE_LENGTH_UNITS + 1e-6) return INVALID;
  const tested = value.testedPrefixCount;
  if (typeof tested !== 'number' || !Number.isInteger(tested) || tested < 0 || tested > samples.length) {
    return INVALID;
  }
  const tailRevision = value.tailRevision;
  if (typeof tailRevision !== 'number' || !Number.isInteger(tailRevision) || tailRevision < 0) {
    return INVALID;
  }
  const offeredRaw = value.offeredEndIndex;
  let offeredEndIndex: number | null = null;
  if (offeredRaw != null) {
    if (typeof offeredRaw !== 'number' || !Number.isInteger(offeredRaw)
      || offeredRaw < 0 || offeredRaw >= samples.length) return INVALID;
    offeredEndIndex = offeredRaw;
  }
  const routeClassRaw = value.routeClass;
  let routeClass: SurveyRouteClass | null = null;
  if (routeClassRaw != null) {
    if (routeClassRaw !== 'fixed-reference' && routeClassRaw !== 'held-reference') return INVALID;
    // A CLASS IS EARNED BY A COMPLETED TEST. A slot that claims one while part
    // of it was never demonstrated is not a route that was tested.
    if (tested !== samples.length) return INVALID;
    routeClass = routeClassRaw;
  }
  if (typeof value.atCapacity !== 'boolean') return INVALID;
  return {
    samples,
    lengthUnits,
    walkedUnits,
    pendingUnits: 0,
    routeClass,
    testedPrefixCount: tested,
    tailRevision,
    offeredEndIndex,
    atCapacity: value.atCapacity
  };
}

function readPoint(value: unknown): CommonGroundPoint | null | typeof INVALID {
  if (value == null) return null;
  if (!isRecord(value)) return INVALID;
  const { x, y, z } = value;
  if (typeof x !== 'number' || !Number.isFinite(x)) return INVALID;
  if (typeof y !== 'number' || !Number.isFinite(y)) return INVALID;
  if (typeof z !== 'number' || !Number.isFinite(z)) return INVALID;
  return { x, y, z };
}

function readWitness(value: unknown): WitnessState | null | typeof INVALID {
  if (value == null) return null;
  if (!isRecord(value)) return INVALID;
  const pose = isRecord(value.pose) ? value.pose : null;
  if (!pose) return INVALID;
  const { x, y, z } = pose;
  if (typeof x !== 'number' || !Number.isFinite(x)) return INVALID;
  if (typeof y !== 'number' || !Number.isFinite(y)) return INVALID;
  if (typeof z !== 'number' || !Number.isFinite(z)) return INVALID;
  if (typeof value.offered !== 'boolean') return INVALID;
  const requiredFromIndex = value.requiredFromIndex;
  if (typeof requiredFromIndex !== 'number' || !Number.isInteger(requiredFromIndex)
    || requiredFromIndex < -1) return INVALID;
  return {
    pose: { x, y, z },
    offered: value.offered,
    // Occupancy is a LIVE fact. It is never restored; the body has to be there.
    occupied: false,
    requiredFromIndex
  };
}

const SURVEY_PHASES: readonly SurveyPhase[] = [
  'idle', 'awaiting-start', 'drawing', 'offered', 'testing', 'held', 'tested'
];
const WORKER_STAGES: readonly WorkerReferenceStage[] = [
  'none', 'positioning-to-h', 'holding-h', 'positioning-to-e', 'testing', 'arrived'
];
const HOLD_REASONS: readonly CommonGroundHoldReason[] = [
  'reference-out-of-range',
  'reference-occluded-survey-housing',
  'reference-occluded-other-solid',
  'footing-invalid',
  'reference-vacant',
  'body-clearance'
];

/** Serializable form. Live-only occupancy is deliberately not written. */
export function serializeCommonGround(snapshot: CommonGroundSnapshot): unknown {
  const slot = (value: TraceSlot | null): unknown => value
    ? {
        samples: value.samples.map(sample => ({ ...sample })),
        walkedUnits: value.walkedUnits,
        routeClass: value.routeClass,
        testedPrefixCount: value.testedPrefixCount,
        tailRevision: value.tailRevision,
        offeredEndIndex: value.offeredEndIndex,
        atCapacity: value.atCapacity
      }
    : null;
  return {
    version: COMMON_GROUND_SNAPSHOT_VERSION,
    actorId: snapshot.actorId,
    worldId: snapshot.worldId,
    home: { ...snapshot.home },
    survey: {
      phase: snapshot.survey.phase,
      accepted: slot(snapshot.survey.accepted),
      working: slot(snapshot.survey.working),
      witness: snapshot.survey.witness
        ? {
            pose: { ...snapshot.survey.witness.pose },
            offered: snapshot.survey.witness.offered,
            requiredFromIndex: snapshot.survey.witness.requiredFromIndex
          }
        : null,
      hold: { ...snapshot.survey.hold },
      approached: snapshot.survey.approached,
      testedIndex: snapshot.survey.testedIndex,
      workerPose: snapshot.survey.workerPose ? { ...snapshot.survey.workerPose } : null,
      revisionReady: snapshot.survey.revisionReady
    },
    common: {
      stage: snapshot.common.stage,
      terraUnits: snapshot.common.terraUnits,
      comparisonProved: snapshot.common.comparisonProved,
      finalReferenceOffered: snapshot.common.finalReferenceOffered,
      workerUnits: snapshot.common.workerUnits,
      workerPose: snapshot.common.workerPose ? { ...snapshot.common.workerPose } : null,
      committed: snapshot.common.committed
    }
  };
}

/**
 * STRICT hydration. Anything that could not have been produced by actual play
 * returns null and the world initializes local state instead.
 *
 * "Strict" here means the impossible TUPLES, not just the wrong identity: a
 * committed reciprocal proof with no crossing, a held final reference with no
 * comparison, a route class on a half-tested route, a walked distance shorter
 * than the geometry it stores. A partial graft would be worse than a reset,
 * because it would look earned.
 */
export function hydrateCommonGround(
  raw: unknown,
  actorId: string,
  worldId: string
): CommonGroundSnapshot | null {
  if (!isRecord(raw)) return null;
  if (raw.version !== COMMON_GROUND_SNAPSHOT_VERSION) return null;
  if (raw.actorId !== actorId || raw.worldId !== worldId) return null;
  // No `{}` substitution: a snapshot missing a structure is malformed, not empty.
  if (!isRecord(raw.home) || !isRecord(raw.survey) || !isRecord(raw.common)) return null;
  const home = raw.home;
  const survey = raw.survey;
  const common = raw.common;

  if (typeof home.faultReviewed !== 'boolean' || typeof home.returnChosen !== 'boolean') return null;
  // She cannot have accepted an invitation she never opened.
  if (home.returnChosen && !home.faultReviewed) return null;

  const accepted = readSlot(survey.accepted);
  const working = readSlot(survey.working);
  if (accepted === INVALID || working === INVALID) return null;
  // The accepted slot is BY DEFINITION a completed test; the working slot is by
  // definition a proposal that has not become one.
  if (accepted && accepted.routeClass === null) return null;
  if (working && working.routeClass !== null) return null;

  const witness = readWitness(survey.witness);
  if (witness === INVALID) return null;
  if (witness && working && witness.requiredFromIndex >= working.samples.length) return null;

  if (!SURVEY_PHASES.includes(survey.phase as SurveyPhase)) return null;
  if (typeof survey.approached !== 'boolean') return null;
  if (typeof survey.revisionReady !== 'boolean') return null;
  const testedIndex = survey.testedIndex;
  if (typeof testedIndex !== 'number' || !Number.isInteger(testedIndex) || testedIndex < -1) return null;
  if (!isRecord(survey.hold)) return null;
  const holdReasonRaw = survey.hold.reason;
  if (holdReasonRaw != null && !HOLD_REASONS.includes(holdReasonRaw as CommonGroundHoldReason)) return null;
  const holdIndex = survey.hold.atIndex;
  if (typeof holdIndex !== 'number' || !Number.isInteger(holdIndex) || holdIndex < -1) return null;

  const surveyWorkerPose = readPoint(survey.workerPose);
  const commonWorkerPose = readPoint(common.workerPose);
  if (surveyWorkerPose === INVALID || commonWorkerPose === INVALID) return null;

  const phase = survey.phase as SurveyPhase;
  if (phase === 'tested' && !accepted) return null;
  if ((phase === 'drawing' || phase === 'offered' || phase === 'testing' || phase === 'held')
    && !working) return null;
  if (phase === 'offered' || phase === 'testing' || phase === 'held') {
    if (!working || working.offeredEndIndex == null) return null;
  }

  if (!WORKER_STAGES.includes(common.stage as WorkerReferenceStage)) return null;
  if (typeof common.comparisonProved !== 'boolean') return null;
  if (typeof common.finalReferenceOffered !== 'boolean') return null;
  if (typeof common.committed !== 'boolean') return null;
  const terraUnits = common.terraUnits;
  const workerUnits = common.workerUnits;
  if (typeof terraUnits !== 'number' || !Number.isFinite(terraUnits) || terraUnits < 0) return null;
  if (typeof workerUnits !== 'number' || !Number.isFinite(workerUnits) || workerUnits < 0) return null;
  if (terraUnits > CG_COMMON_ROUTE_UNITS + 1e-6) return null;
  if (workerUnits > CG_COMMON_ROUTE_UNITS + 1e-6) return null;
  // The impossible tuples, written out because they are the interesting ones.
  if (common.comparisonProved && terraUnits + 1e-6 < CG_COMMON_ROUTE_UNITS) return null;
  if (common.finalReferenceOffered && !common.comparisonProved) return null;
  if (common.committed && !common.comparisonProved) return null;
  if (common.committed && !common.finalReferenceOffered) return null;
  if (common.committed && workerUnits + 1e-6 < CG_COMMON_ROUTE_UNITS) return null;
  const stageRaw = common.stage as WorkerReferenceStage;
  if ((stageRaw === 'positioning-to-e' || stageRaw === 'testing') && !common.finalReferenceOffered) {
    return null;
  }
  if (stageRaw === 'arrived' && !common.committed) return null;
  // The chapter's own reciprocal proof needs an accepted survey route behind it.
  if (common.comparisonProved && !accepted) return null;

  // NOTHING IS REPLAYED AND NOTHING IS RE-EARNED.
  //
  // An earlier draft collapsed every live stage back to a standing one, which
  // sounded conservative and was not: it made a reload re-walk uncredited
  // positioning he had already done, and it threw away the units of his final
  // test. His pose and his progress are facts about a body that was somewhere;
  // they are restored and then REVALIDATED live against range, sight, grounding
  // and occupancy, which is where the actual safety lives. A stage that claims a
  // live leg without a pose to resume it from is rejected outright above.
  if ((phase === 'testing' || phase === 'held') && !surveyWorkerPose) return null;
  if ((stageRaw === 'positioning-to-h' || stageRaw === 'positioning-to-e' || stageRaw === 'testing')
    && !commonWorkerPose) return null;
  const stage: WorkerReferenceStage = stageRaw;

  return {
    version: COMMON_GROUND_SNAPSHOT_VERSION,
    actorId,
    worldId,
    hydrated: true,
    home: { faultReviewed: home.faultReviewed, returnChosen: home.returnChosen },
    survey: {
      phase,
      accepted,
      working,
      witness,
      hold: {
        reason: (holdReasonRaw ?? null) as CommonGroundHoldReason | null,
        atIndex: holdIndex
      },
      // He is not standing anywhere until the live world says so, but the fact
      // that he ONCE reached the start is durable: a resumed revision must not
      // replay the initial approach.
      approached: survey.approached,
      testedIndex,
      workerPose: surveyWorkerPose,
      revisionReady: false
    },
    common: {
      stage,
      terraUnits,
      comparisonProved: common.comparisonProved,
      finalReferenceOffered: common.finalReferenceOffered,
      // Live only.
      finalReferenceOccupied: false,
      workerUnits,
      workerPose: commonWorkerPose,
      committed: common.committed
    }
  };
}

/**
 * Legacy or absent data initializes LOCAL state only. It never resets user
 * construction, never restores pristine terrain, and never removes a durable
 * fact that lives in the milestone ledger.
 */
export function migrateCommonGround(
  raw: unknown,
  actorId: string,
  worldId: string
): CommonGroundSnapshot | null {
  if (raw == null) return null;
  try {
    return hydrateCommonGround(raw, actorId, worldId);
  } catch {
    return null;
  }
}

/**
 * Explicit proposal reset. Clears only what the player is currently proposing;
 * the demonstrated prefix, the saved route class and the committed reciprocal
 * proof are earned facts and are untouched.
 *
 * Pause, focus loss, a failed input and Continue must NEVER call this.
 */
export function clearUncommittedProposal(snapshot: CommonGroundSnapshot): void {
  const slot = snapshot.survey.working;
  if (slot) reviseTail(slot, Math.max(0, slot.testedPrefixCount - 1));
  snapshot.survey.witness = null;
  snapshot.survey.hold = { reason: null, atIndex: -1 };
  snapshot.survey.revisionReady = false;
  // THE ACCEPTED ROUTE IS UNTOUCHED. Clearing a proposal is not forgetting a
  // demonstration, and the class it earned is not spent by trying again.
  if (snapshot.survey.phase !== 'tested') {
    snapshot.survey.phase = slot ? 'drawing' : 'awaiting-start';
  }
}

/**
 * Move the current proposal into the accepted slot with the class it earned.
 *
 * Bounded at two: if a route class was already retained, the new one replaces
 * the slot only when it is a DIFFERENT class, so both complete outcomes can be
 * held at once and neither is silently overwritten by a repeat of its own kind.
 */
export function acceptTestedRoute(
  snapshot: CommonGroundSnapshot,
  routeClass: SurveyRouteClass
): void {
  const slot = snapshot.survey.working;
  if (!slot) return;
  slot.routeClass = routeClass;
  markTestedPrefix(slot, slot.samples.length);
  snapshot.survey.accepted = slot;
  snapshot.survey.working = null;
  snapshot.survey.phase = 'tested';
}

/** Presentation ownership only: what a pause or a world departure may drop. */
export function releaseLiveOccupancy(snapshot: CommonGroundSnapshot): void {
  if (snapshot.survey.witness) snapshot.survey.witness.occupied = false;
  snapshot.common.finalReferenceOccupied = false;
}

// --- World-scoped snapshot store ------------------------------------------------------
//
// Deliberately here, in the PURE module, and not in the director.
//
// `persistence.ts` needs to read and write this at the WorldSave boundary, and
// the director imports `storyState.ts`, which imports `persistence.ts`. Putting
// the store beside the reducers keeps that cycle from existing at all, and it
// mirrors exactly how the Habitat Core's world-keyed truth is already reached.

const liveByWorld = new Map<string, CommonGroundSnapshot>();
const pendingByWorld = new Map<string, unknown>();
const restoreSettledWorlds = new Set<string>();

/**
 * Nothing has happened in this world yet, and nothing was restored into it.
 *
 * The chapter's snapshot is created lazily by whoever asks for it first, and at
 * boot that can easily be a director tick for the world the app is leaving —
 * BEFORE `restoreCommonGroundForWorld` has staged that world's saved bytes. Such
 * a snapshot is not a fact about the world; it is an empty placeholder, and it
 * must never be allowed to represent the world to the save file or to shadow the
 * payload that arrives a moment later. A snapshot that was hydrated, or that
 * carries any real progress at all, is authoritative and is NOT pristine.
 */
export function isPristineCommonGround(snapshot: CommonGroundSnapshot): boolean {
  if (!hasNoCommonGroundProgress(snapshot)) return false;
  // Bytes are staged but not yet VALIDATED into live state. A completed read of
  // a present payload is not proof that it was accepted, and an autosave landing
  // in that window would let the placeholder answer for a world whose own saved
  // state is still sitting in the queue.
  if (pendingByWorld.has(snapshot.worldId)) return true;
  return !hasCommonGroundRestoreSettled(snapshot.worldId);
}

/**
 * Nothing has happened in this snapshot — content only.
 *
 * Deliberately separate from `isPristineCommonGround`, which answers a
 * different question ("may this speak for the world in the save file?") and
 * therefore also consults whether the world's restore has run. THIS one answers
 * "is there any live work here that a restore would destroy?", so a completed
 * restore is irrelevant to it: a payload arriving behind an empty placeholder
 * must still be able to take over, and real progress must never be replaced.
 */
export function hasNoCommonGroundProgress(snapshot: CommonGroundSnapshot): boolean {
  if (snapshot.hydrated) return false;
  const { home, survey, common } = snapshot;
  return !home.faultReviewed
    && !home.returnChosen
    && survey.phase === 'idle'
    && survey.accepted === null
    && survey.working === null
    && survey.witness === null
    && survey.hold.reason === null
    && !survey.approached
    && survey.testedIndex === -1
    && survey.workerPose === null
    && !survey.revisionReady
    && common.stage === 'none'
    && common.terraUnits === 0
    && !common.comparisonProved
    && !common.finalReferenceOffered
    && common.workerUnits === 0
    && common.workerPose === null
    && !common.committed;
}

/**
 * This world's restore has RUN — with a payload, or with none to find.
 *
 * Deliberately driven by `persistence.restoreCommonGroundForWorld` and by
 * nothing else. Entering a beat is NOT proof that a world's saved bytes were
 * loaded: at boot the director can enter a beat before the world-keyed restore
 * effect has fired, and treating that entry as ownership would make the very
 * placeholder authoritative and reinstate the overwrite it is meant to prevent.
 * Only a completed restore can distinguish "genuinely empty" from "not read
 * yet", so only a completed restore sets this.
 */
export function markCommonGroundRestoreSettled(worldId: string): void {
  if (worldId) restoreSettledWorlds.add(worldId);
}

/**
 * Settle a world whose restore found NOTHING to load.
 *
 * "Absent" and "legacy record with no chapter field" are real answers, and a
 * world that got one may speak for itself. A PRESENT payload is not settled
 * here: it is settled only once it has actually been validated into live state,
 * because a payload that is rejected (another actor, another world, malformed)
 * must leave its bytes on disk rather than let this actor's empty state erase
 * them.
 */
export function settleCommonGroundIfNothingStaged(worldId: string): void {
  if (worldId && !pendingByWorld.has(worldId)) restoreSettledWorlds.add(worldId);
}

export function hasCommonGroundRestoreSettled(worldId: string): boolean {
  return restoreSettledWorlds.has(worldId);
}

/**
 * Persistence hands the raw blob over; identity is validated at first live use.
 *
 * A PRESENT payload also RETIRES any older "nothing was there" answer for this
 * world. That answer settled the world on the strength of an ABSENT read, and
 * these bytes are proof that the world is not empty after all — a newer present
 * read may not borrow ownership from an older absent one. Until the payload is
 * actually validated into live state (`markCommonGroundRestoreSettled`), or a
 * later read genuinely finds nothing again (`settleCommonGroundIfNothingStaged`),
 * this actor's empty state must not speak for the world. Without this, a payload
 * rejected as foreign, cross-world or malformed leaves no pending bytes, the
 * stale settled bit answers instead, and an idle snapshot overwrites a record
 * that was just read off disk.
 *
 * Only that stale ownership KNOWLEDGE is dropped. Live work is untouched:
 * genuine progress and a hydrated snapshot are authoritative through
 * `hasNoCommonGroundProgress`, independently of this flag.
 */
export function stageCommonGroundWorldPayload(worldId: string, raw: unknown): void {
  if (raw == null) {
    pendingByWorld.delete(worldId);
    return;
  }
  pendingByWorld.set(worldId, raw);
  restoreSettledWorlds.delete(worldId);
}

/** Is a saved payload still waiting to be validated into live state? */
export function hasStagedCommonGroundPayload(worldId: string): boolean {
  return pendingByWorld.has(worldId);
}

export function takeCommonGroundWorldPayload(worldId: string): unknown {
  const raw = pendingByWorld.get(worldId) ?? null;
  pendingByWorld.delete(worldId);
  return raw;
}

export function putCommonGroundLive(snapshot: CommonGroundSnapshot): void {
  liveByWorld.set(snapshot.worldId, snapshot);
}

export function readCommonGroundLive(worldId: string): CommonGroundSnapshot | null {
  return liveByWorld.get(worldId) ?? null;
}

/**
 * What `saveWorld` writes beside `habitat`. Null when this world has no chapter
 * state to speak for — INCLUDING the case where the only live snapshot is a
 * pristine placeholder. A null here means "I know nothing about this world", and
 * `saveWorld` answers it by keeping whatever is already on disk; it must never
 * be read as "this world is empty now".
 */
export function serializeCommonGroundForWorld(worldId: string): unknown {
  const snapshot = liveByWorld.get(worldId);
  if (!snapshot || isPristineCommonGround(snapshot)) return null;
  return serializeCommonGround(snapshot);
}

/** ONE world only. Clearing Origin must never touch Tidegarden's chapter state. */
export function clearCommonGroundWorld(worldId: string): void {
  liveByWorld.delete(worldId);
  pendingByWorld.delete(worldId);
  restoreSettledWorlds.delete(worldId);
}

export function clearAllCommonGroundWorlds(): void {
  liveByWorld.clear();
  pendingByWorld.clear();
  restoreSettledWorlds.clear();
}
