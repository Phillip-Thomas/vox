/**
 * Common Ground (ch13) — bounded trace/snapshot state. PROPOSED CANDIDATE ONLY.
 *
 * Pure TypeScript. No Three, no React, no global store, no side effects, no
 * timers, no persistence I/O. Every numeric bound is caller-supplied
 * (`TraceLimits`) because trace caps, spacing and corner thresholds are
 * contract-supplied input that is not signed yet. Nothing here fabricates a
 * durable milestone from hydration, observation, elapsed time, camera or audio.
 */

export const COMMON_GROUND_SNAPSHOT_VERSION = 1;

export type SlotId = 'accepted' | 'working';
/** Physically distinct, useful explanations. Never collapsed into one. */
export type HoldReason = 'out-of-range' | 'unsupported' | 'occluded' | 'reference-vacated';
export type AdmitRefusal =
  | HoldReason
  | 'non-finite'
  | 'discontinuous'
  | 'below-spacing'
  | 'below-corner-threshold'
  | 'sample-capacity'
  | 'length-capacity';

export interface TracePose { x: number; y: number; z: number }
export interface TraceSample extends TracePose { corner: boolean }
/** Route points are tuple data on the wire: [x, y, z, cornerFlag]. */
export type TraceSampleTuple = readonly [number, number, number, 0 | 1];

export type GroundVerdict = { supported: true } | { supported: false; reason: HoldReason };
/** Caller-supplied live ground check. The module never infers footing itself. */
export type GroundPredicate = (pose: TracePose) => GroundVerdict;

export interface TraceLimits {
  maxSamples: number;
  maxTraceUnits: number;
  sampleSpacing: number;
  minCornerSpacing: number;
  maxSampleStep: number;
}

export interface TraceSlot {
  readonly id: SlotId;
  readonly samples: readonly TraceSample[];
  readonly lengthUnits: number;
  readonly testedPrefixCount: number;
  readonly tailRevision: number;
  readonly offeredEndIndex: number | null;
}

/** The original survey route class. Kept separate from the common comparison. */
export interface SurveyRoutes { readonly accepted: TraceSlot | null; readonly working: TraceSlot | null }
/** The common reciprocal span / final reference. Never merged into survey. */
export interface CommonComparison {
  readonly reciprocalHeld: boolean;
  readonly finalReferenceOffered: boolean;
  readonly committed: boolean;
}

export interface CommonGroundSnapshot {
  readonly version: typeof COMMON_GROUND_SNAPSHOT_VERSION;
  readonly actorId: string;
  readonly worldId: string;
  readonly survey: SurveyRoutes;
  readonly witness: { readonly sampleIndex: number; readonly offered: boolean } | null;
  readonly common: CommonComparison;
  readonly hold: { readonly reason: HoldReason | null };
  readonly safePose: TraceSample | null;
}

export type Outcome<T> = { ok: true; value: T } | { ok: false; reason: string };
const fail = (reason: string): Outcome<never> => ({ ok: false, reason });
const ok = <T,>(value: T): Outcome<T> => ({ ok: true, value });

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const dist = (a: TracePose, b: TracePose) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const copySample = (s: TraceSample): TraceSample => Object.freeze({ x: s.x, y: s.y, z: s.z, corner: !!s.corner });

export function assertTraceLimits(l: TraceLimits): Outcome<TraceLimits> {
  const keys: (keyof TraceLimits)[] = ['maxSamples', 'maxTraceUnits', 'sampleSpacing', 'minCornerSpacing', 'maxSampleStep'];
  for (const k of keys) if (!finite(l[k]) || l[k] <= 0) return fail(`limit:${String(k)}`);
  if (!Number.isInteger(l.maxSamples)) return fail('limit:maxSamples');
  if (l.minCornerSpacing > l.sampleSpacing) return fail('limit:corner-above-spacing');
  return ok(l);
}

export function createEmptySlot(id: SlotId): TraceSlot {
  return Object.freeze({ id, samples: Object.freeze([]), lengthUnits: 0, testedPrefixCount: 0, tailRevision: 0, offeredEndIndex: null });
}

export function createEmptySnapshot(actorId: string, worldId: string): CommonGroundSnapshot {
  return Object.freeze({
    version: COMMON_GROUND_SNAPSHOT_VERSION, actorId, worldId,
    survey: Object.freeze({ accepted: null, working: null }),
    witness: null,
    common: Object.freeze({ reciprocalHeld: false, finalReferenceOffered: false, committed: false }),
    hold: Object.freeze({ reason: null }),
    safePose: null
  });
}

function rebuild(slot: TraceSlot, samples: readonly TraceSample[], patch: Partial<TraceSlot>): TraceSlot {
  let length = 0;
  for (let i = 1; i < samples.length; i += 1) length += dist(samples[i - 1], samples[i]);
  return Object.freeze({ ...slot, samples: Object.freeze(samples.slice()), lengthUnits: length, ...patch });
}

export type AdmitResult =
  | { status: 'appended'; slot: TraceSlot }
  | { status: 'refused'; slot: TraceSlot; reason: AdmitRefusal };

/**
 * Admit ONE actual grounded footstep. Capacity is an honest stop: the slot is
 * returned unchanged with the specific cap that was reached. Nothing recorded
 * is ever dropped, resampled or decimated to make room.
 */
export function appendSample(slot: TraceSlot, pose: TracePose, corner: boolean, limits: TraceLimits, ground: GroundPredicate): AdmitResult {
  const refuse = (reason: AdmitRefusal): AdmitResult => ({ status: 'refused', slot, reason });
  if (!assertTraceLimits(limits).ok) return refuse('non-finite');
  if (!pose || !finite(pose.x) || !finite(pose.y) || !finite(pose.z)) return refuse('non-finite');
  const last = slot.samples[slot.samples.length - 1];
  let step = 0;
  if (last) {
    step = dist(last, pose);
    if (step > limits.maxSampleStep) return refuse('discontinuous');
    if (corner) { if (step < limits.minCornerSpacing) return refuse('below-corner-threshold'); }
    else if (step < limits.sampleSpacing) return refuse('below-spacing');
  }
  const verdict = ground({ x: pose.x, y: pose.y, z: pose.z });
  if (!verdict.supported) return refuse(verdict.reason);
  // Independent caps, independently reported.
  if (slot.samples.length + 1 > limits.maxSamples) return refuse('sample-capacity');
  if (slot.lengthUnits + step > limits.maxTraceUnits) return refuse('length-capacity');
  const next = slot.samples.concat(copySample({ x: pose.x, y: pose.y, z: pose.z, corner }));
  return { status: 'appended', slot: rebuild(slot, next, {}) };
}

/**
 * Cost-free, repeatable revision of the UNVERIFIED tail. The tested prefix is
 * preserved; only real terrain invalidation can lower it.
 */
export function reviseTail(slot: TraceSlot, fromIndex: number): Outcome<TraceSlot> {
  if (!Number.isInteger(fromIndex) || fromIndex < 0 || fromIndex > slot.samples.length) return fail('revise:index');
  if (fromIndex < slot.testedPrefixCount) return fail('revise:would-drop-tested-prefix');
  return ok(rebuild(slot, slot.samples.slice(0, fromIndex), { tailRevision: slot.tailRevision + 1, offeredEndIndex: null }));
}

export interface TestProof { readonly kind: 'grounded-test'; readonly reachedIndex: number }
/** Raise the tested prefix only from an actual test result. */
export function markTestedPrefix(slot: TraceSlot, proof: TestProof): Outcome<TraceSlot> {
  if (!proof || proof.kind !== 'grounded-test') return fail('tested:no-proof');
  const n = proof.reachedIndex;
  if (!Number.isInteger(n) || n < 0 || n > slot.samples.length) return fail('tested:index');
  if (n < slot.testedPrefixCount) return fail('tested:non-monotonic');
  return ok(Object.freeze({ ...slot, testedPrefixCount: n }));
}

export interface TerrainInvalidation { readonly kind: 'voxel-change' | 'support-loss'; readonly fromIndex: number }
/** The ONLY way a tested prefix shrinks. Time/observation/camera cannot do it. */
export function invalidateTestedPrefix(slot: TraceSlot, evidence: TerrainInvalidation): Outcome<TraceSlot> {
  if (!evidence || (evidence.kind !== 'voxel-change' && evidence.kind !== 'support-loss')) return fail('invalidate:no-evidence');
  const i = evidence.fromIndex;
  if (!Number.isInteger(i) || i < 0) return fail('invalidate:index');
  if (i >= slot.testedPrefixCount) return ok(slot);
  return ok(Object.freeze({ ...slot, testedPrefixCount: i }));
}

export interface ProposalResetRequest { readonly explicit: true; readonly actorStationary: boolean; readonly atStartReference: boolean }
/** Explicit uncommitted-proposal reset only. Pause / failed input / Continue must never call this. */
export function clearUncommitted(s: CommonGroundSnapshot, req: ProposalResetRequest): Outcome<CommonGroundSnapshot> {
  if (!req || req.explicit !== true) return fail('reset:not-explicit');
  if (!req.actorStationary) return fail('reset:actor-moving');
  if (!req.atStartReference) return fail('reset:not-at-start-reference');
  return ok(Object.freeze({
    ...s,
    survey: Object.freeze({ accepted: s.survey.accepted, working: null }),
    witness: null,
    hold: Object.freeze({ reason: null })
  }));
}

/** A renderer/animation pose is never trusted; it must pass a live ground check. */
export function recordSafePose(s: CommonGroundSnapshot, pose: TracePose, ground: GroundPredicate): Outcome<CommonGroundSnapshot> {
  if (!pose || !finite(pose.x) || !finite(pose.y) || !finite(pose.z)) return fail('safe-pose:non-finite');
  const verdict = ground({ x: pose.x, y: pose.y, z: pose.z });
  if (!verdict.supported) return fail(`safe-pose:${verdict.reason}`);
  return ok(Object.freeze({ ...s, safePose: copySample({ x: pose.x, y: pose.y, z: pose.z, corner: false }) }));
}

export type GeometryPredicate = (s: CommonGroundSnapshot) => GroundVerdict;
/** Resume is authorized by live geometry revalidation, never by stored state alone. */
export function authorizeResume(s: CommonGroundSnapshot, revalidate: GeometryPredicate): Outcome<CommonGroundSnapshot> {
  if (!s.safePose) return fail('resume:no-safe-pose');
  const verdict = revalidate(s);
  if (!verdict.supported) return ok(Object.freeze({ ...s, hold: Object.freeze({ reason: verdict.reason }) }));
  return ok(Object.freeze({ ...s, hold: Object.freeze({ reason: null }) }));
}

export interface ArrivalProof { readonly kind: 'grounded-arrival'; readonly reciprocalProof: boolean; readonly clearance: boolean }
/** Commits exactly once. A repeat experiment never re-emits completion. */
export function commitFinalComparison(s: CommonGroundSnapshot, proof: ArrivalProof): { snapshot: CommonGroundSnapshot; emitCompletion: boolean; refusal: string | null } {
  if (!s.common.finalReferenceOffered) return { snapshot: s, emitCompletion: false, refusal: 'commit:no-final-reference' };
  if (!proof || proof.kind !== 'grounded-arrival') return { snapshot: s, emitCompletion: false, refusal: 'commit:no-arrival' };
  if (!proof.reciprocalProof) return { snapshot: s, emitCompletion: false, refusal: 'commit:no-reciprocal-proof' };
  if (!proof.clearance) return { snapshot: s, emitCompletion: false, refusal: 'commit:no-clearance' };
  if (s.common.committed) return { snapshot: s, emitCompletion: false, refusal: 'commit:already-committed' };
  return { snapshot: Object.freeze({ ...s, common: Object.freeze({ ...s.common, committed: true }) }), emitCompletion: true, refusal: null };
}

// ---------------------------------------------------------------- persistence

interface SerializedSlot { id: SlotId; samples: TraceSampleTuple[]; testedPrefixCount: number; tailRevision: number; offeredEndIndex: number | null }
export interface SerializedCommonGround {
  version: number; actorId: string; worldId: string;
  survey: { accepted: SerializedSlot | null; working: SerializedSlot | null };
  witness: { sampleIndex: number; offered: boolean } | null;
  common: { reciprocalHeld: boolean; finalReferenceOffered: boolean; committed: boolean };
  safePose: TraceSampleTuple | null;
}

const serializeSlot = (s: TraceSlot | null): SerializedSlot | null => s === null ? null : ({
  id: s.id,
  samples: s.samples.map((p) => [p.x, p.y, p.z, p.corner ? 1 : 0] as TraceSampleTuple),
  testedPrefixCount: s.testedPrefixCount, tailRevision: s.tailRevision, offeredEndIndex: s.offeredEndIndex
});

/** `lengthUnits` and `hold` are deliberately not persisted: length is recomputed
 *  from the tuples, and a hold is a live condition, not a saved fact. */
export function serializeCommonGround(s: CommonGroundSnapshot): SerializedCommonGround {
  return {
    version: COMMON_GROUND_SNAPSHOT_VERSION, actorId: s.actorId, worldId: s.worldId,
    survey: { accepted: serializeSlot(s.survey.accepted), working: serializeSlot(s.survey.working) },
    witness: s.witness ? { sampleIndex: s.witness.sampleIndex, offered: s.witness.offered } : null,
    common: { ...s.common },
    safePose: s.safePose ? [s.safePose.x, s.safePose.y, s.safePose.z, 0] : null
  };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function hydrateSlot(raw: unknown, id: SlotId, limits: TraceLimits): TraceSlot | null | 'invalid' {
  if (raw === null || raw === undefined) return null;
  if (!isRecord(raw) || raw.id !== id) return 'invalid';
  if (!Array.isArray(raw.samples)) return 'invalid';
  if (raw.samples.length > limits.maxSamples) return 'invalid'; // oversized: reject, never truncate
  const samples: TraceSample[] = [];
  for (const t of raw.samples) {
    if (!Array.isArray(t) || t.length !== 4) return 'invalid';
    const [x, y, z, c] = t as unknown[];
    if (!finite(x) || !finite(y) || !finite(z) || (c !== 0 && c !== 1)) return 'invalid';
    samples.push(copySample({ x, y, z, corner: c === 1 }));
  }
  let length = 0;
  for (let i = 1; i < samples.length; i += 1) {
    const step = dist(samples[i - 1], samples[i]);
    if (step > limits.maxSampleStep) return 'invalid';
    length += step;
  }
  if (length > limits.maxTraceUnits) return 'invalid';
  const tested = raw.testedPrefixCount, rev = raw.tailRevision, offered = raw.offeredEndIndex;
  if (!Number.isInteger(tested) || (tested as number) < 0 || (tested as number) > samples.length) return 'invalid';
  if (!Number.isInteger(rev) || (rev as number) < 0) return 'invalid';
  if (offered !== null && (!Number.isInteger(offered) || (offered as number) < 0 || (offered as number) >= samples.length)) return 'invalid';
  return Object.freeze({ id, samples: Object.freeze(samples), lengthUnits: length, testedPrefixCount: tested as number, tailRevision: rev as number, offeredEndIndex: offered as number | null });
}

/** Absent / legacy / unknown-version input becomes `null`. Never throws. */
export function migrateCommonGround(raw: unknown): SerializedCommonGround | null {
  if (!isRecord(raw)) return null;
  if (raw.version !== COMMON_GROUND_SNAPSHOT_VERSION) return null;
  return raw as unknown as SerializedCommonGround;
}

/**
 * Strict, actor/world-scoped hydration. Any mismatch or malformation returns
 * `null` (a fresh run), never a partial graft. Hydration alone never sets
 * `committed`, a hold, or a tested prefix that was not actually stored.
 */
export function hydrateCommonGround(raw: unknown, actorId: string, worldId: string, limits: TraceLimits): CommonGroundSnapshot | null {
  if (!assertTraceLimits(limits).ok) return null;
  const migrated = migrateCommonGround(raw);
  if (!migrated) return null;
  const r = migrated as unknown as Record<string, unknown>;
  if (r.actorId !== actorId || r.worldId !== worldId) return null;
  if (!isRecord(r.survey) || !isRecord(r.common)) return null;
  const accepted = hydrateSlot((r.survey as Record<string, unknown>).accepted, 'accepted', limits);
  const working = hydrateSlot((r.survey as Record<string, unknown>).working, 'working', limits);
  if (accepted === 'invalid' || working === 'invalid') return null;
  const c = r.common as Record<string, unknown>;
  for (const k of ['reciprocalHeld', 'finalReferenceOffered', 'committed']) if (typeof c[k] !== 'boolean') return null;
  let witness: CommonGroundSnapshot['witness'] = null;
  if (r.witness !== null && r.witness !== undefined) {
    if (!isRecord(r.witness)) return null;
    const idx = r.witness.sampleIndex;
    if (!Number.isInteger(idx) || (idx as number) < 0 || typeof r.witness.offered !== 'boolean') return null;
    const host = working ?? accepted;
    if (!host || (idx as number) >= host.samples.length) return null;
    witness = Object.freeze({ sampleIndex: idx as number, offered: r.witness.offered as boolean });
  }
  let safePose: TraceSample | null = null;
  if (r.safePose !== null && r.safePose !== undefined) {
    const t = r.safePose;
    if (!Array.isArray(t) || t.length !== 4 || !finite(t[0]) || !finite(t[1]) || !finite(t[2])) return null;
    safePose = copySample({ x: t[0], y: t[1], z: t[2], corner: false });
  }
  return Object.freeze({
    version: COMMON_GROUND_SNAPSHOT_VERSION, actorId, worldId,
    survey: Object.freeze({ accepted, working }),
    witness,
    common: Object.freeze({ reciprocalHeld: !!c.reciprocalHeld, finalReferenceOffered: !!c.finalReferenceOffered, committed: !!c.committed }),
    hold: Object.freeze({ reason: null }),
    safePose
  });
}
