import { describe, expect, it } from 'vitest';
import {
  BYTES_PER_MIB,
  DEFAULT_VISUAL_LOD_THRESHOLDS,
  RESIDENCY_MEMORY_BUDGETS,
  cancelPlanetTarget,
  commitPlanetTarget,
  createPlanetResidencySnapshot,
  currentTargetLease,
  decidePlanetActivation,
  isCurrentTargetLease,
  planByteWeightedEviction,
  projectBoundToFramebuffer,
  projectGeometricErrorToFramebuffer,
  resolvePlanetVisualState,
  resolveRenderableVisualState,
  transitionPlanetResidency,
  visualCapacityForResidency
} from './planetResidency.ts';

const FOV_70 = 70 * Math.PI / 180;

describe('framebuffer projection', () => {
  it('uses physical framebuffer pixels after DPR', () => {
    const css = projectBoundToFramebuffer({
      centerDistance: 2_000,
      boundRadius: 50,
      verticalFovRadians: FOV_70,
      framebufferHeight: 720
    });
    const dpr2 = projectBoundToFramebuffer({
      centerDistance: 2_000,
      boundRadius: 50,
      verticalFovRadians: FOV_70,
      framebufferHeight: 1_440
    });

    expect(dpr2.projectedBoundRadiusPixels).toBeCloseTo(css.projectedBoundRadiusPixels * 2, 10);
    expect(css.closestSurfaceDistance).toBe(1_950);
  });

  it('projects representation error with the same conservative nearest-surface depth', () => {
    const input = {
      centerDistance: 600,
      boundRadius: 60,
      verticalFovRadians: FOV_70,
      framebufferHeight: 1_080
    };
    const projection = projectBoundToFramebuffer(input);
    const error = projectGeometricErrorToFramebuffer(input, 2);

    expect(error).toBeCloseTo(projection.focalLengthPixels * 2 / 540, 10);
    expect(projectGeometricErrorToFramebuffer(input, 0)).toBe(0);
  });

  it('returns an infinite conservative bound when the camera reaches the bound', () => {
    expect(projectBoundToFramebuffer({
      centerDistance: 50,
      boundRadius: 50,
      verticalFovRadians: FOV_70,
      framebufferHeight: 720
    }).projectedBoundRadiusPixels).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('visual representation', () => {
  const base = {
    visible: true,
    current: 'metadata' as const,
    skyProxyErrorPixels: 0.5,
    macroErrorPixels: 0.25
  };

  it('selects metadata, proxy, macro, and exact independently from residency', () => {
    expect(resolvePlanetVisualState({ ...base, projectedBoundRadiusPixels: 5.9 })).toBe('metadata');
    expect(resolvePlanetVisualState({ ...base, projectedBoundRadiusPixels: 6 })).toBe('sky_proxy');
    expect(resolvePlanetVisualState({ ...base, projectedBoundRadiusPixels: 96 })).toBe('macro');
    expect(resolvePlanetVisualState({ ...base, projectedBoundRadiusPixels: 320 })).toBe('exact');
  });

  it('promotes when screen-space geometric error exceeds a representation budget', () => {
    expect(resolvePlanetVisualState({
      ...base,
      current: 'sky_proxy',
      projectedBoundRadiusPixels: 40,
      skyProxyErrorPixels: DEFAULT_VISUAL_LOD_THRESHOLDS.maxSkyProxyErrorPixels + 0.01
    })).toBe('macro');
    expect(resolvePlanetVisualState({
      ...base,
      current: 'macro',
      projectedBoundRadiusPixels: 120,
      macroErrorPixels: DEFAULT_VISUAL_LOD_THRESHOLDS.maxMacroErrorPixels + 0.01
    })).toBe('exact');
  });

  it('retains each visual tier through a 20 percent demotion band', () => {
    expect(resolvePlanetVisualState({
      ...base,
      current: 'sky_proxy',
      projectedBoundRadiusPixels: 4.81
    })).toBe('sky_proxy');
    expect(resolvePlanetVisualState({
      ...base,
      current: 'sky_proxy',
      projectedBoundRadiusPixels: 4.79
    })).toBe('metadata');

    expect(resolvePlanetVisualState({
      ...base,
      current: 'macro',
      projectedBoundRadiusPixels: 76.81
    })).toBe('macro');
    expect(resolvePlanetVisualState({
      ...base,
      current: 'macro',
      projectedBoundRadiusPixels: 76.79
    })).toBe('sky_proxy');

    expect(resolvePlanetVisualState({
      ...base,
      current: 'exact',
      projectedBoundRadiusPixels: 256.01
    })).toBe('exact');
    expect(resolvePlanetVisualState({
      ...base,
      current: 'exact',
      projectedBoundRadiusPixels: 255.99
    })).toBe('macro');
  });

  it('keeps desired detail separate from the representation currently resident', () => {
    expect(visualCapacityForResidency('warm_target')).toBe('macro');
    expect(resolveRenderableVisualState('exact', 'metadata')).toBe('metadata');
    expect(resolveRenderableVisualState('exact', 'sky_proxy')).toBe('sky_proxy');
    expect(resolveRenderableVisualState('exact', 'warm_target')).toBe('macro');
    expect(resolveRenderableVisualState('exact', 'exact_render')).toBe('exact');
  });
});

describe('residency budgets and owner separation', () => {
  it('publishes the planned per-tier warm and post-settle byte caps', () => {
    expect(RESIDENCY_MEMORY_BUDGETS.ULTRA).toEqual({
      warmTargetBytes: 8 * BYTES_PER_MIB,
      postSettleBytes: 24 * BYTES_PER_MIB
    });
    expect(RESIDENCY_MEMORY_BUDGETS.MEDIUM.warmTargetBytes).toBe(6 * BYTES_PER_MIB);
    expect(RESIDENCY_MEMORY_BUDGETS.LOW.warmTargetBytes).toBe(4 * BYTES_PER_MIB);
    expect(RESIDENCY_MEMORY_BUDGETS.POTATO.postSettleBytes).toBe(12 * BYTES_PER_MIB);
  });

  it('allows one active source to coexist with one committed warm target', () => {
    const sourceActive = createPlanetResidencySnapshot([{
      planetId: '0,0',
      state: 'active_surface',
      bytes: 2 * BYTES_PER_MIB,
      lastTouched: 0
    }]);
    const committed = commitPlanetTarget(sourceActive, '0,0:p1');
    const warm = transitionPlanetResidency(committed, {
      planetId: '0,0:p1',
      epoch: committed.epoch,
      state: 'warm_target',
      bytes: 4 * BYTES_PER_MIB,
      lastTouched: 1,
      quality: 'HIGH'
    });
    expect(warm.accepted).toBe(true);
    if (!warm.accepted) return;

    expect(warm.snapshot.entries['0,0']).toMatchObject({ state: 'active_surface' });
    expect(warm.snapshot.entries['0,0:p1']).toMatchObject({ state: 'warm_target' });
    expect(() => commitPlanetTarget(warm.snapshot, '0,0:p2')).toThrow(/owns warm\/exact target/);
    expect(transitionPlanetResidency(warm.snapshot, {
      planetId: '0,0:p2',
      epoch: warm.snapshot.epoch,
      state: 'exact_render',
      bytes: 1,
      lastTouched: 2,
      quality: 'HIGH'
    })).toMatchObject({ accepted: false, reason: 'not_committed_target' });
  });

  it('rejects a second active surface until the atomic owner transfer demotes the source', () => {
    const sourceActive = createPlanetResidencySnapshot([{
      planetId: '0,0',
      state: 'active_surface',
      bytes: 1,
      lastTouched: 0
    }]);
    const committed = commitPlanetTarget(sourceActive, '0,0:p1');

    expect(transitionPlanetResidency(committed, {
      planetId: '0,0:p1',
      epoch: committed.epoch,
      state: 'active_surface',
      bytes: 1,
      lastTouched: 1,
      quality: 'HIGH'
    })).toMatchObject({ accepted: false, reason: 'active_surface_conflict' });

    expect(() => createPlanetResidencySnapshot([
      { planetId: '0,0', state: 'active_surface', bytes: 1, lastTouched: 0 },
      { planetId: '0,0:p1', state: 'active_surface', bytes: 1, lastTouched: 0 }
    ])).toThrow(/active surface residency is owned by both/);
  });

  it('rejects warm payload and total post-settle budget overruns', () => {
    const initial = createPlanetResidencySnapshot([{
      planetId: '0,0',
      state: 'sky_proxy',
      bytes: 9 * BYTES_PER_MIB,
      lastTouched: 0
    }]);
    const committed = commitPlanetTarget(initial, '0,0:p1');

    expect(transitionPlanetResidency(committed, {
      planetId: '0,0:p1',
      epoch: committed.epoch,
      state: 'warm_target',
      bytes: 4 * BYTES_PER_MIB + 1,
      lastTouched: 1,
      quality: 'POTATO'
    })).toMatchObject({ accepted: false, reason: 'warm_payload_over_budget' });

    expect(transitionPlanetResidency(committed, {
      planetId: '0,0:p1',
      epoch: committed.epoch,
      state: 'warm_target',
      bytes: 4 * BYTES_PER_MIB,
      lastTouched: 1,
      quality: 'POTATO'
    })).toMatchObject({ accepted: false, reason: 'post_settle_over_budget' });
  });

  it('evicts oldest unprotected data by bytes and reports an impossible protected set', () => {
    const plan = planByteWeightedEviction([
      { key: 'old-small', bytes: 2, lastTouched: 1 },
      { key: 'old-large', bytes: 7, lastTouched: 2 },
      { key: 'target', bytes: 6, lastTouched: 0, protected: true },
      { key: 'new', bytes: 3, lastTouched: 3 }
    ], 11);
    expect(plan.evicted).toEqual(['old-small', 'old-large']);
    expect(plan.retained).toEqual(['target', 'new']);
    expect(plan.retainedBytes).toBe(9);
    expect(plan.fits).toBe(true);

    expect(planByteWeightedEviction([
      { key: 'protected', bytes: 12, lastTouched: 0, protected: true }
    ], 10)).toMatchObject({ fits: false, retainedBytes: 12, evicted: [] });
  });
});

describe('activation readiness', () => {
  const bands = {
    exactCenterDistance: 650,
    exactSurfaceDistance: 600,
    activeCenterDistance: 230,
    activeSurfaceDistance: 180
  };

  it('holds a late target outside its stopping-distance readiness margin', () => {
    const decision = decidePlanetActivation({
      targetCommitted: true,
      workerReady: false,
      centerDistance: 390,
      surfaceDistance: 340,
      stoppingDistance: 280,
      readinessMargin: 80,
      idleResidency: 'sky_proxy',
      bands
    });

    expect(decision.recommendedResidency).toBe('warm_target');
    expect(decision.readinessBoundaryDistance).toBe(360);
    expect(decision.readinessSlack).toBe(-20);
    expect(decision.shouldLimitApproach).toBe(true);
    expect(decision.canPromoteExactRender).toBe(false);
  });

  it('requires commit, worker readiness, center band, and surface band for activation', () => {
    const ready = decidePlanetActivation({
      targetCommitted: true,
      workerReady: true,
      centerDistance: 220,
      surfaceDistance: 170,
      stoppingDistance: 100,
      readinessMargin: 50,
      idleResidency: 'sky_proxy',
      bands
    });
    expect(ready).toMatchObject({
      recommendedResidency: 'active_surface',
      canPromoteExactRender: true,
      canActivateSurface: true,
      shouldLimitApproach: false
    });

    expect(decidePlanetActivation({
      targetCommitted: false,
      workerReady: true,
      centerDistance: 100,
      surfaceDistance: 50,
      stoppingDistance: 0,
      readinessMargin: 0,
      idleResidency: 'metadata',
      bands
    })).toMatchObject({
      recommendedResidency: 'metadata',
      canPromoteExactRender: false,
      canActivateSurface: false
    });
  });
});

describe('target epochs and stale results', () => {
  it('invalidates an old worker result after cancellation and retargeting', () => {
    const first = commitPlanetTarget(createPlanetResidencySnapshot(), '0,0:p1');
    const firstLease = currentTargetLease(first);
    expect(firstLease).not.toBeNull();

    const cancelled = cancelPlanetTarget(first);
    const second = commitPlanetTarget(cancelled, '0,0:p2');
    expect(isCurrentTargetLease(second, firstLease!)).toBe(false);
    expect(currentTargetLease(second)).toEqual({ planetId: '0,0:p2', epoch: 3 });

    expect(transitionPlanetResidency(second, {
      planetId: '0,0:p1',
      epoch: first.epoch,
      state: 'warm_target',
      bytes: 1,
      lastTouched: 1,
      quality: 'HIGH'
    })).toMatchObject({ accepted: false, reason: 'stale_epoch' });
  });

  it('atomically demotes target detail when cancellation advances the epoch', () => {
    const sourceActive = createPlanetResidencySnapshot([{
      planetId: '0,0',
      state: 'active_surface',
      bytes: 1 * BYTES_PER_MIB,
      lastTouched: 1
    }]);
    const committed = commitPlanetTarget(sourceActive, '0,0:p1');
    const result = transitionPlanetResidency(committed, {
      planetId: '0,0:p1',
      epoch: committed.epoch,
      state: 'exact_render',
      bytes: 3 * BYTES_PER_MIB,
      lastTouched: 4,
      quality: 'HIGH'
    });
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;

    const cancelled = cancelPlanetTarget(result.snapshot, 64_000, 5);
    expect(cancelled.targetPlanetId).toBeNull();
    expect(cancelled.epoch).toBe(result.snapshot.epoch + 1);
    expect(cancelled.entries['0,0:p1']).toMatchObject({
      state: 'sky_proxy',
      bytes: 64_000,
      lastTouched: 5
    });
    expect(cancelled.entries['0,0']).toMatchObject({
      state: 'active_surface',
      bytes: 1 * BYTES_PER_MIB,
      lastTouched: 1
    });
  });
});
