import { describe, it, expect } from 'vitest';
import {
  COMMON_GROUND_SNAPSHOT_VERSION, appendSample, authorizeResume, clearUncommitted, commitFinalComparison,
  createEmptySlot, createEmptySnapshot, hydrateCommonGround, invalidateTestedPrefix, markTestedPrefix,
  migrateCommonGround, recordSafePose, reviseTail, serializeCommonGround,
  type CommonGroundSnapshot, type GroundPredicate, type TraceLimits, type TraceSlot
} from './commonGroundTraceState';

// Test-local geometry. The module hardcodes no bound; the signed contract supplies these.
const L: TraceLimits = { maxSamples: 8, maxTraceUnits: 6, sampleSpacing: 1, minCornerSpacing: 0.25, maxSampleStep: 2 };
const FLAT: GroundPredicate = () => ({ supported: true });
const VOID: GroundPredicate = () => ({ supported: false, reason: 'unsupported' });

function walk(slot: TraceSlot, steps: number, limits = L): TraceSlot {
  let s = slot;
  for (let i = 0; i < steps; i += 1) {
    const r = appendSample(s, { x: i, y: 0, z: 0 }, false, limits, FLAT);
    if (r.status === 'appended') s = r.slot;
  }
  return s;
}

describe('footstep admission', () => {
  it('refuses a sub-spacing footstep with an explicit reason rather than silently dropping it', () => {
    const s = walk(createEmptySlot('working'), 1);
    const r = appendSample(s, { x: 0.4, y: 0, z: 0 }, false, L, FLAT);
    expect(r.status).toBe('refused');
    expect(r.status === 'refused' && r.reason).toBe('below-spacing');
    expect(r.slot).toBe(s); // unchanged, no partial write
  });

  it('records a meaningful corner closer than sample spacing but at/above the corner threshold', () => {
    const s = walk(createEmptySlot('working'), 1);
    const tooTight = appendSample(s, { x: 0.1, y: 0, z: 0 }, true, L, FLAT);
    expect(tooTight.status === 'refused' && tooTight.reason).toBe('below-corner-threshold');
    const corner = appendSample(s, { x: 0.3, y: 0, z: 0 }, true, L, FLAT);
    expect(corner.status).toBe('appended');
    expect(corner.status === 'appended' && corner.slot.samples[1].corner).toBe(true);
  });

  it('rejects flying/discontinuous and unsupported poses through the caller predicate', () => {
    const s = walk(createEmptySlot('working'), 1);
    const jump = appendSample(s, { x: 40, y: 12, z: 0 }, false, L, FLAT);
    expect(jump.status === 'refused' && jump.reason).toBe('discontinuous');
    const air = appendSample(s, { x: 1, y: 0, z: 0 }, false, L, VOID);
    expect(air.status === 'refused' && air.reason).toBe('unsupported');
    const nan = appendSample(s, { x: Number.NaN, y: 0, z: 0 }, false, L, FLAT);
    expect(nan.status === 'refused' && nan.reason).toBe('non-finite');
  });
});

describe('honest capacity stop', () => {
  it('stops on the sample cap without decimating any recorded corner', () => {
    let s = createEmptySlot('working');
    for (let i = 0; i < L.maxSamples; i += 1) {
      const r = appendSample(s, { x: i * 0.5, y: 0, z: 0 }, true, { ...L, maxTraceUnits: 1000 }, FLAT);
      expect(r.status).toBe('appended');
      if (r.status === 'appended') s = r.slot;
    }
    const over = appendSample(s, { x: 99, y: 0, z: 0 }, true, { ...L, maxTraceUnits: 1000, maxSampleStep: 1000 }, FLAT);
    expect(over.status === 'refused' && over.reason).toBe('sample-capacity');
    expect(over.slot.samples).toHaveLength(L.maxSamples);
    expect(over.slot.samples.every((p) => p.corner)).toBe(true); // every corner survived
  });

  it('reports the length cap independently of the sample cap', () => {
    const s = walk(createEmptySlot('working'), 7); // 7 samples, 6 units
    expect(s.samples.length).toBeLessThan(L.maxSamples);
    const r = appendSample(s, { x: 7, y: 0, z: 0 }, false, L, FLAT);
    expect(r.status === 'refused' && r.reason).toBe('length-capacity');
  });
});

describe('tested prefix and cost-free tail revision', () => {
  it('preserves the tested prefix across repeated revisions and bumps tailRevision only on edit', () => {
    const walked = walk(createEmptySlot('working'), 5);
    const tested = markTestedPrefix(walked, { kind: 'grounded-test', reachedIndex: 3 });
    expect(tested.ok).toBe(true);
    if (!tested.ok) return;
    const a = reviseTail(tested.value, 4);
    const b = a.ok ? reviseTail(a.value, 3) : a;
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    expect(b.value.testedPrefixCount).toBe(3); // never lowered, no revision cost
    expect(b.value.tailRevision).toBe(2);
    expect(b.value.samples).toHaveLength(3);
    expect(reviseTail(b.value, 2).ok).toBe(false); // cannot cut into tested ground
  });

  it('lowers the tested prefix only on real terrain evidence, never from time or observation', () => {
    const tested = markTestedPrefix(walk(createEmptySlot('working'), 5), { kind: 'grounded-test', reachedIndex: 4 });
    if (!tested.ok) return;
    expect(invalidateTestedPrefix(tested.value, { kind: 'observed' } as never).ok).toBe(false);
    const real = invalidateTestedPrefix(tested.value, { kind: 'voxel-change', fromIndex: 2 });
    expect(real.ok && real.value.testedPrefixCount).toBe(2);
    expect(markTestedPrefix(tested.value, { kind: 'grounded-test', reachedIndex: 1 }).ok).toBe(false);
  });
});

describe('reset scope and completion honesty', () => {
  const seeded = (): CommonGroundSnapshot => {
    const base = createEmptySnapshot('w7744', 'origin');
    return { ...base, survey: { accepted: walk(createEmptySlot('accepted'), 3), working: walk(createEmptySlot('working'), 2) }, witness: { sampleIndex: 1, offered: true } };
  };

  it('clears only uncommitted work and refuses implicit resets', () => {
    const s = seeded();
    expect(clearUncommitted(s, { explicit: true, actorStationary: false, atStartReference: true }).ok).toBe(false);
    expect(clearUncommitted(s, { explicit: true, actorStationary: true, atStartReference: false }).ok).toBe(false);
    const r = clearUncommitted(s, { explicit: true, actorStationary: true, atStartReference: true });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.survey.accepted).toBe(s.survey.accepted); // accepted route untouched
    expect(r.value.survey.working).toBeNull();
    expect(r.value.witness).toBeNull();
    expect(r.value.common).toEqual(s.common);
  });

  it('commits final comparison once and never replays completion on repeat', () => {
    const base = createEmptySnapshot('w7744', 'origin');
    const offered: CommonGroundSnapshot = { ...base, common: { ...base.common, reciprocalHeld: true, finalReferenceOffered: true } };
    expect(commitFinalComparison(offered, { kind: 'grounded-arrival', reciprocalProof: false, clearance: true }).refusal).toBe('commit:no-reciprocal-proof');
    const first = commitFinalComparison(offered, { kind: 'grounded-arrival', reciprocalProof: true, clearance: true });
    expect(first.emitCompletion).toBe(true);
    const second = commitFinalComparison(first.snapshot, { kind: 'grounded-arrival', reciprocalProof: true, clearance: true });
    expect(second.emitCompletion).toBe(false);
    expect(second.refusal).toBe('commit:already-committed');
    expect(second.snapshot.common.committed).toBe(true);
  });

  it('never accepts a renderer pose or authorizes resume without a live ground check', () => {
    const s = createEmptySnapshot('w7744', 'origin');
    expect(recordSafePose(s, { x: 3, y: 9, z: 0 }, VOID).ok).toBe(false);
    expect(authorizeResume(s, () => ({ supported: true })).ok).toBe(false); // no safe pose yet
    const posed = recordSafePose(s, { x: 3, y: 0, z: 0 }, FLAT);
    if (!posed.ok) return;
    const held = authorizeResume(posed.value, () => ({ supported: false, reason: 'reference-vacated' }));
    expect(held.ok && held.value.hold.reason).toBe('reference-vacated');
    const resumed = authorizeResume(posed.value, () => ({ supported: true }));
    expect(resumed.ok && resumed.value.hold.reason).toBeNull();
  });
});

describe('snapshot validation and leakage', () => {
  const round = (s: CommonGroundSnapshot) => JSON.parse(JSON.stringify(serializeCommonGround(s)));
  const full = (): CommonGroundSnapshot => {
    const base = createEmptySnapshot('w7744', 'origin');
    const tested = markTestedPrefix(walk(createEmptySlot('accepted'), 4), { kind: 'grounded-test', reachedIndex: 2 });
    return { ...base, survey: { accepted: tested.ok ? tested.value : null, working: walk(createEmptySlot('working'), 2) } };
  };

  it('round-trips survey slots as tuple data and keeps the two route classes distinct', () => {
    const raw = round(full());
    expect(raw.survey.accepted.samples[0]).toEqual([0, 0, 0, 0]);
    expect(raw.common).toEqual({ reciprocalHeld: false, finalReferenceOffered: false, committed: false });
    const back = hydrateCommonGround(raw, 'w7744', 'origin', L);
    expect(back?.survey.accepted?.samples).toHaveLength(4);
    expect(back?.survey.accepted?.testedPrefixCount).toBe(2);
    expect(back?.survey.working?.id).toBe('working');
    expect(back?.survey.accepted?.id).toBe('accepted');
    expect(back?.hold.reason).toBeNull(); // a hold is live, never hydrated
  });

  it('returns null for absent, legacy, wrong-actor and wrong-world input instead of a partial graft', () => {
    const raw = round(full());
    expect(hydrateCommonGround(undefined, 'w7744', 'origin', L)).toBeNull();
    expect(hydrateCommonGround({ samples: [[0, 0, 0]] }, 'w7744', 'origin', L)).toBeNull();
    expect(migrateCommonGround({ version: 0, samples: [] })).toBeNull();
    expect(hydrateCommonGround({ ...raw, version: COMMON_GROUND_SNAPSHOT_VERSION + 1 }, 'w7744', 'origin', L)).toBeNull();
    expect(hydrateCommonGround(raw, 'other-actor', 'origin', L)).toBeNull();
    expect(hydrateCommonGround(raw, 'w7744', 'tidegarden', L)).toBeNull();
  });

  it('rejects malformed and oversized saved state rather than truncating it', () => {
    const raw = round(full());
    expect(hydrateCommonGround({ ...raw, survey: { accepted: { ...raw.survey.accepted, samples: [[0, 0, 'x', 0]] }, working: null } }, 'w7744', 'origin', L)).toBeNull();
    expect(hydrateCommonGround({ ...raw, survey: { accepted: { ...raw.survey.accepted, testedPrefixCount: 99 }, working: null } }, 'w7744', 'origin', L)).toBeNull();
    expect(hydrateCommonGround({ ...raw, survey: { accepted: { ...raw.survey.accepted, id: 'working' }, working: null } }, 'w7744', 'origin', L)).toBeNull();
    expect(hydrateCommonGround(raw, 'w7744', 'origin', { ...L, maxSamples: 3 })).toBeNull();   // oversized by count
    expect(hydrateCommonGround(raw, 'w7744', 'origin', { ...L, maxTraceUnits: 2 })).toBeNull(); // oversized by length
    expect(hydrateCommonGround({ ...raw, witness: { sampleIndex: 50, offered: true } }, 'w7744', 'origin', L)).toBeNull();
  });

  it('takes defensive copies so mutating caller or saved data cannot reach into state', () => {
    const raw = round(full());
    const back = hydrateCommonGround(raw, 'w7744', 'origin', L);
    raw.survey.accepted.samples[0][0] = 999;
    raw.survey.accepted.samples.push([50, 0, 0, 1]);
    expect(back?.survey.accepted?.samples[0].x).toBe(0);
    expect(back?.survey.accepted?.samples).toHaveLength(4);
    const mutable = { x: 1, y: 0, z: 0 };
    const appended = appendSample(createEmptySlot('working'), mutable, false, L, FLAT);
    mutable.x = 777;
    expect(appended.status === 'appended' && appended.slot.samples[0].x).toBe(1);
    const exported = serializeCommonGround(full());
    exported.survey.accepted!.samples.length = 0;
    expect(serializeCommonGround(full()).survey.accepted!.samples).toHaveLength(4);
  });

  it('cannot fabricate completion from hydration alone', () => {
    const raw = round(full());
    const back = hydrateCommonGround(raw, 'w7744', 'origin', L);
    expect(back?.common.committed).toBe(false);
    expect(hydrateCommonGround({ ...raw, common: { reciprocalHeld: 'yes', finalReferenceOffered: true, committed: true } }, 'w7744', 'origin', L)).toBeNull();
    // A stored true commit is preserved, but re-entry still emits no completion.
    const committed = { ...raw, common: { ...raw.common, finalReferenceOffered: true, committed: true } };
    const resumed = hydrateCommonGround(committed, 'w7744', 'origin', L);
    expect(resumed?.common.committed).toBe(true);
    expect(commitFinalComparison(resumed!, { kind: 'grounded-arrival', reciprocalProof: true, clearance: true }).emitCompletion).toBe(false);
  });
});
