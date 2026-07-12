/**
 * Pure contracts for planet visual LOD and data residency.
 *
 * Rendering detail and prepared data are intentionally separate. A renderer may
 * want an exact visual while only a macro payload is resident, and a committed
 * off-screen target may be warm without drawing anything.
 */

export type PlanetVisualState = 'metadata' | 'sky_proxy' | 'macro' | 'exact';

export type PlanetResidencyState =
  | 'metadata'
  | 'sky_proxy'
  | 'warm_target'
  | 'exact_render'
  | 'active_surface';

export type ResidencyQualityTier = 'ULTRA' | 'HIGH' | 'MEDIUM' | 'LOW' | 'POTATO';

export const BYTES_PER_MIB = 1024 * 1024;

export interface ResidencyMemoryBudget {
  warmTargetBytes: number;
  postSettleBytes: number;
}

export const RESIDENCY_MEMORY_BUDGETS: Readonly<Record<ResidencyQualityTier, ResidencyMemoryBudget>> = {
  ULTRA: { warmTargetBytes: 8 * BYTES_PER_MIB, postSettleBytes: 24 * BYTES_PER_MIB },
  HIGH: { warmTargetBytes: 8 * BYTES_PER_MIB, postSettleBytes: 24 * BYTES_PER_MIB },
  MEDIUM: { warmTargetBytes: 6 * BYTES_PER_MIB, postSettleBytes: 16 * BYTES_PER_MIB },
  LOW: { warmTargetBytes: 4 * BYTES_PER_MIB, postSettleBytes: 16 * BYTES_PER_MIB },
  POTATO: { warmTargetBytes: 4 * BYTES_PER_MIB, postSettleBytes: 12 * BYTES_PER_MIB }
};

export interface ProjectionInput {
  /** Camera-to-body-center distance in world units. */
  centerDistance: number;
  /** Conservative body bound radius in world units. */
  boundRadius: number;
  /** Vertical camera field of view in radians. */
  verticalFovRadians: number;
  /** Physical framebuffer height after device-pixel ratio is applied. */
  framebufferHeight: number;
}

export interface FramebufferProjection {
  focalLengthPixels: number;
  closestSurfaceDistance: number;
  projectedBoundRadiusPixels: number;
}

/**
 * Projects a conservative spherical bound into framebuffer pixels.
 *
 * Using the nearest bound surface instead of the center depth deliberately
 * overestimates the radius near a planet. That is preferable for LOD selection:
 * detail can arrive early, but never after a visible silhouette error.
 */
export function projectBoundToFramebuffer(input: ProjectionInput): FramebufferProjection {
  assertPositiveFinite(input.centerDistance, 'centerDistance');
  assertNonNegativeFinite(input.boundRadius, 'boundRadius');
  assertPositiveFinite(input.framebufferHeight, 'framebufferHeight');
  if (!Number.isFinite(input.verticalFovRadians) || input.verticalFovRadians <= 0 || input.verticalFovRadians >= Math.PI) {
    throw new RangeError('verticalFovRadians must be finite and between 0 and PI');
  }

  const focalLengthPixels = input.framebufferHeight / (2 * Math.tan(input.verticalFovRadians / 2));
  const closestSurfaceDistance = Math.max(0, input.centerDistance - input.boundRadius);
  const projectedBoundRadiusPixels = input.boundRadius === 0
    ? 0
    : closestSurfaceDistance === 0
      ? Number.POSITIVE_INFINITY
      : focalLengthPixels * input.boundRadius / closestSurfaceDistance;

  return { focalLengthPixels, closestSurfaceDistance, projectedBoundRadiusPixels };
}

/** Converts a world-space representation error into conservative framebuffer pixels. */
export function projectGeometricErrorToFramebuffer(
  input: ProjectionInput,
  geometricErrorWorld: number
): number {
  assertNonNegativeFinite(geometricErrorWorld, 'geometricErrorWorld');
  if (geometricErrorWorld === 0) return 0;
  const projection = projectBoundToFramebuffer(input);
  if (projection.closestSurfaceDistance === 0) return Number.POSITIVE_INFINITY;
  return projection.focalLengthPixels * geometricErrorWorld / projection.closestSurfaceDistance;
}

export interface VisualLodThresholds {
  minSkyProxyBoundPixels: number;
  minMacroBoundPixels: number;
  minExactBoundPixels: number;
  maxSkyProxyErrorPixels: number;
  maxMacroErrorPixels: number;
  /** Retention band. 0.2 means a state demotes below 80% of its entry threshold. */
  hysteresis: number;
}

export const DEFAULT_VISUAL_LOD_THRESHOLDS: Readonly<VisualLodThresholds> = {
  minSkyProxyBoundPixels: 6,
  minMacroBoundPixels: 96,
  minExactBoundPixels: 320,
  maxSkyProxyErrorPixels: 2,
  maxMacroErrorPixels: 1,
  hysteresis: 0.2
};

export interface VisualLodInput {
  visible: boolean;
  current: PlanetVisualState;
  projectedBoundRadiusPixels: number;
  skyProxyErrorPixels: number;
  macroErrorPixels: number;
  /** A committed visible target retains at least its macro representation. */
  targetCommitted?: boolean;
  thresholds?: VisualLodThresholds;
}

/** Selects desired visual detail without consulting data residency. */
export function resolvePlanetVisualState(input: VisualLodInput): PlanetVisualState {
  if (!input.visible) return 'metadata';
  assertNonNegativeOrInfinity(input.projectedBoundRadiusPixels, 'projectedBoundRadiusPixels');
  assertNonNegativeOrInfinity(input.skyProxyErrorPixels, 'skyProxyErrorPixels');
  assertNonNegativeOrInfinity(input.macroErrorPixels, 'macroErrorPixels');

  const thresholds = input.thresholds ?? DEFAULT_VISUAL_LOD_THRESHOLDS;
  validateVisualThresholds(thresholds);
  const retention = 1 - thresholds.hysteresis;
  const currentRank = VISUAL_RANK[input.current];

  const wantsSky = input.projectedBoundRadiusPixels >= thresholds.minSkyProxyBoundPixels * (
    currentRank >= VISUAL_RANK.sky_proxy ? retention : 1
  );
  if (!wantsSky && !input.targetCommitted) return 'metadata';

  const wantsMacro = Boolean(input.targetCommitted)
    || input.projectedBoundRadiusPixels >= thresholds.minMacroBoundPixels * (
      currentRank >= VISUAL_RANK.macro ? retention : 1
    )
    || input.skyProxyErrorPixels > thresholds.maxSkyProxyErrorPixels * (
      currentRank >= VISUAL_RANK.macro ? retention : 1
    );

  const wantsExact = input.projectedBoundRadiusPixels >= thresholds.minExactBoundPixels * (
    currentRank >= VISUAL_RANK.exact ? retention : 1
  ) || input.macroErrorPixels > thresholds.maxMacroErrorPixels * (
    currentRank >= VISUAL_RANK.exact ? retention : 1
  );

  if (wantsMacro && wantsExact) return 'exact';
  if (wantsMacro) return 'macro';
  return 'sky_proxy';
}

/** Highest visual state that the currently resident data can render. */
export function visualCapacityForResidency(residency: PlanetResidencyState): PlanetVisualState {
  switch (residency) {
    case 'metadata':
      return 'metadata';
    case 'sky_proxy':
      return 'sky_proxy';
    case 'warm_target':
      return 'macro';
    case 'exact_render':
    case 'active_surface':
      return 'exact';
  }
}

/** Clamps desired detail to available data while keeping the two contracts independent. */
export function resolveRenderableVisualState(
  desired: PlanetVisualState,
  residency: PlanetResidencyState
): PlanetVisualState {
  const capacity = visualCapacityForResidency(residency);
  return VISUAL_RANK[desired] <= VISUAL_RANK[capacity] ? desired : capacity;
}

export interface PlanetResidencyEntry {
  planetId: string;
  state: PlanetResidencyState;
  /** Feature-owned post-settle main-thread bytes, excluding the legacy active-world baseline. */
  bytes: number;
  /** Monotonic access stamp used by byte-weighted eviction. */
  lastTouched: number;
}

export interface PlanetResidencySnapshot {
  epoch: number;
  targetPlanetId: string | null;
  entries: Readonly<Record<string, PlanetResidencyEntry>>;
}

export interface TargetLease {
  planetId: string;
  epoch: number;
}

export function createPlanetResidencySnapshot(
  entries: readonly PlanetResidencyEntry[] = []
): PlanetResidencySnapshot {
  const record: Record<string, PlanetResidencyEntry> = {};
  for (const entry of entries) {
    validateResidencyEntry(entry);
    if (record[entry.planetId]) throw new Error(`duplicate planet residency entry: ${entry.planetId}`);
    record[entry.planetId] = { ...entry };
  }
  activeSurfaceOwner(record);
  if (entries.some(entry => isPreparedTargetResidency(entry.state))) {
    throw new Error('initial warm/exact residency requires an explicit committed target');
  }
  return { epoch: 0, targetPlanetId: null, entries: record };
}

/** Starts a new target generation epoch, invalidating every prior worker result. */
export function commitPlanetTarget(
  snapshot: PlanetResidencySnapshot,
  planetId: string
): PlanetResidencySnapshot {
  assertPlanetId(planetId);
  const preparedOwner = preparedTargetOwner(snapshot.entries);
  if (preparedOwner !== null && preparedOwner !== planetId) {
    throw new Error(`cannot commit ${planetId} while ${preparedOwner} owns warm/exact target residency`);
  }
  return {
    ...snapshot,
    epoch: snapshot.epoch + 1,
    targetPlanetId: planetId
  };
}

/** Cancels the target and atomically demotes any target-owned detail to a proxy. */
export function cancelPlanetTarget(
  snapshot: PlanetResidencySnapshot,
  retainedProxyBytes = 0,
  lastTouched = 0
): PlanetResidencySnapshot {
  assertByteCount(retainedProxyBytes, 'retainedProxyBytes');
  assertNonNegativeFinite(lastTouched, 'lastTouched');
  const target = snapshot.targetPlanetId;
  const entries = { ...snapshot.entries };
  if (target) {
    const current = entries[target];
    if (current && isPreparedTargetResidency(current.state)) {
      entries[target] = {
        ...current,
        state: 'sky_proxy',
        bytes: retainedProxyBytes,
        lastTouched
      };
    }
  }
  return {
    epoch: snapshot.epoch + 1,
    targetPlanetId: null,
    entries
  };
}

export function currentTargetLease(snapshot: PlanetResidencySnapshot): TargetLease | null {
  return snapshot.targetPlanetId === null
    ? null
    : { planetId: snapshot.targetPlanetId, epoch: snapshot.epoch };
}

export function isCurrentTargetLease(snapshot: PlanetResidencySnapshot, lease: TargetLease): boolean {
  return snapshot.targetPlanetId === lease.planetId && snapshot.epoch === lease.epoch;
}

export type ResidencyTransitionRejection =
  | 'stale_epoch'
  | 'not_committed_target'
  | 'prepared_target_conflict'
  | 'active_surface_conflict'
  | 'warm_payload_over_budget'
  | 'post_settle_over_budget';

export type ResidencyTransitionResult =
  | { accepted: true; snapshot: PlanetResidencySnapshot }
  | { accepted: false; reason: ResidencyTransitionRejection; snapshot: PlanetResidencySnapshot };

export interface ResidencyTransitionRequest {
  planetId: string;
  epoch: number;
  state: PlanetResidencyState;
  bytes: number;
  lastTouched: number;
  quality: ResidencyQualityTier;
}

/**
 * Applies a residency change only when the target lease and byte budgets permit it.
 * Stale worker results are rejected without changing the snapshot.
 */
export function transitionPlanetResidency(
  snapshot: PlanetResidencySnapshot,
  request: ResidencyTransitionRequest
): ResidencyTransitionResult {
  assertPlanetId(request.planetId);
  assertByteCount(request.bytes, 'bytes');
  assertNonNegativeFinite(request.lastTouched, 'lastTouched');
  const budget = RESIDENCY_MEMORY_BUDGETS[request.quality];

  if (request.epoch !== snapshot.epoch) {
    return { accepted: false, reason: 'stale_epoch', snapshot };
  }

  if (isPreparedTargetResidency(request.state)) {
    if (snapshot.targetPlanetId !== request.planetId) {
      return { accepted: false, reason: 'not_committed_target', snapshot };
    }
    const owner = preparedTargetOwner(snapshot.entries);
    if (owner !== null && owner !== request.planetId) {
      return { accepted: false, reason: 'prepared_target_conflict', snapshot };
    }
    if (request.state === 'warm_target' && request.bytes > budget.warmTargetBytes) {
      return { accepted: false, reason: 'warm_payload_over_budget', snapshot };
    }
  }

  if (request.state === 'active_surface') {
    const owner = activeSurfaceOwner(snapshot.entries);
    if (owner !== null && owner !== request.planetId) {
      return { accepted: false, reason: 'active_surface_conflict', snapshot };
    }
  }

  const entries = {
    ...snapshot.entries,
    [request.planetId]: {
      planetId: request.planetId,
      state: request.state,
      bytes: request.bytes,
      lastTouched: request.lastTouched
    }
  };
  if (totalResidencyBytes(entries) > budget.postSettleBytes) {
    return { accepted: false, reason: 'post_settle_over_budget', snapshot };
  }

  return { accepted: true, snapshot: { ...snapshot, entries } };
}

export function totalResidencyBytes(entries: Readonly<Record<string, PlanetResidencyEntry>>): number {
  return Object.values(entries).reduce((total, entry) => total + entry.bytes, 0);
}

export interface WeightedResidencyItem {
  key: string;
  bytes: number;
  lastTouched: number;
  protected?: boolean;
}

export interface WeightedEvictionPlan {
  retained: string[];
  evicted: string[];
  retainedBytes: number;
  fits: boolean;
}

/** Plans deterministic oldest-first eviction against a byte budget. */
export function planByteWeightedEviction(
  items: readonly WeightedResidencyItem[],
  byteBudget: number
): WeightedEvictionPlan {
  assertByteCount(byteBudget, 'byteBudget');
  const seen = new Set<string>();
  for (const item of items) {
    assertPlanetId(item.key);
    assertByteCount(item.bytes, 'item.bytes');
    assertNonNegativeFinite(item.lastTouched, 'item.lastTouched');
    if (seen.has(item.key)) throw new Error(`duplicate weighted item: ${item.key}`);
    seen.add(item.key);
  }

  let retainedBytes = items.reduce((total, item) => total + item.bytes, 0);
  const evicted = new Set<string>();
  const candidates = items
    .filter(item => !item.protected)
    .sort((a, b) => a.lastTouched - b.lastTouched || a.key.localeCompare(b.key));

  for (const item of candidates) {
    if (retainedBytes <= byteBudget) break;
    retainedBytes -= item.bytes;
    evicted.add(item.key);
  }

  return {
    retained: items.filter(item => !evicted.has(item.key)).map(item => item.key),
    evicted: items.filter(item => evicted.has(item.key)).map(item => item.key),
    retainedBytes,
    fits: retainedBytes <= byteBudget
  };
}

export interface PlanetActivationBands {
  exactCenterDistance: number;
  exactSurfaceDistance: number;
  activeCenterDistance: number;
  activeSurfaceDistance: number;
}

export interface PlanetActivationInput {
  targetCommitted: boolean;
  workerReady: boolean;
  centerDistance: number;
  surfaceDistance: number;
  stoppingDistance: number;
  readinessMargin: number;
  idleResidency: 'metadata' | 'sky_proxy';
  bands: PlanetActivationBands;
}

export interface PlanetActivationDecision {
  recommendedResidency: PlanetResidencyState;
  canPromoteExactRender: boolean;
  canActivateSurface: boolean;
  shouldLimitApproach: boolean;
  readinessBoundaryDistance: number;
  readinessSlack: number;
}

/**
 * Resolves target preparation/activation without mutating flight or residency.
 * Both center and nearest-surface bands must pass; late payloads engage approach
 * limiting before the ship consumes its stopping-distance safety margin.
 */
export function decidePlanetActivation(input: PlanetActivationInput): PlanetActivationDecision {
  assertNonNegativeFinite(input.centerDistance, 'centerDistance');
  assertNonNegativeFinite(input.surfaceDistance, 'surfaceDistance');
  assertNonNegativeFinite(input.stoppingDistance, 'stoppingDistance');
  assertNonNegativeFinite(input.readinessMargin, 'readinessMargin');
  validateActivationBands(input.bands);

  const readinessBoundaryDistance = input.stoppingDistance + input.readinessMargin;
  const readinessSlack = input.surfaceDistance - readinessBoundaryDistance;
  const shouldLimitApproach = input.targetCommitted && !input.workerReady && readinessSlack <= 0;
  const canPromoteExactRender = input.targetCommitted
    && input.workerReady
    && input.centerDistance <= input.bands.exactCenterDistance
    && input.surfaceDistance <= input.bands.exactSurfaceDistance;
  const canActivateSurface = canPromoteExactRender
    && input.centerDistance <= input.bands.activeCenterDistance
    && input.surfaceDistance <= input.bands.activeSurfaceDistance;

  const recommendedResidency: PlanetResidencyState = !input.targetCommitted
    ? input.idleResidency
    : canActivateSurface
      ? 'active_surface'
      : canPromoteExactRender
        ? 'exact_render'
        : 'warm_target';

  return {
    recommendedResidency,
    canPromoteExactRender,
    canActivateSurface,
    shouldLimitApproach,
    readinessBoundaryDistance,
    readinessSlack
  };
}

const VISUAL_RANK: Readonly<Record<PlanetVisualState, number>> = {
  metadata: 0,
  sky_proxy: 1,
  macro: 2,
  exact: 3
};

function isPreparedTargetResidency(state: PlanetResidencyState): boolean {
  return state === 'warm_target' || state === 'exact_render';
}

function preparedTargetOwner(
  entries: Readonly<Record<string, PlanetResidencyEntry>>
): string | null {
  let owner: string | null = null;
  for (const entry of Object.values(entries)) {
    if (!isPreparedTargetResidency(entry.state)) continue;
    if (owner !== null && owner !== entry.planetId) {
      throw new Error(`prepared target residency is owned by both ${owner} and ${entry.planetId}`);
    }
    owner = entry.planetId;
  }
  return owner;
}

function activeSurfaceOwner(
  entries: Readonly<Record<string, PlanetResidencyEntry>>
): string | null {
  let owner: string | null = null;
  for (const entry of Object.values(entries)) {
    if (entry.state !== 'active_surface') continue;
    if (owner !== null && owner !== entry.planetId) {
      throw new Error(`active surface residency is owned by both ${owner} and ${entry.planetId}`);
    }
    owner = entry.planetId;
  }
  return owner;
}

function validateVisualThresholds(thresholds: VisualLodThresholds): void {
  assertNonNegativeFinite(thresholds.minSkyProxyBoundPixels, 'minSkyProxyBoundPixels');
  assertNonNegativeFinite(thresholds.minMacroBoundPixels, 'minMacroBoundPixels');
  assertNonNegativeFinite(thresholds.minExactBoundPixels, 'minExactBoundPixels');
  assertNonNegativeFinite(thresholds.maxSkyProxyErrorPixels, 'maxSkyProxyErrorPixels');
  assertNonNegativeFinite(thresholds.maxMacroErrorPixels, 'maxMacroErrorPixels');
  if (thresholds.minMacroBoundPixels < thresholds.minSkyProxyBoundPixels) {
    throw new RangeError('minMacroBoundPixels must be at least minSkyProxyBoundPixels');
  }
  if (thresholds.minExactBoundPixels < thresholds.minMacroBoundPixels) {
    throw new RangeError('minExactBoundPixels must be at least minMacroBoundPixels');
  }
  if (!Number.isFinite(thresholds.hysteresis) || thresholds.hysteresis < 0 || thresholds.hysteresis >= 1) {
    throw new RangeError('hysteresis must be finite and in [0, 1)');
  }
}

function validateResidencyEntry(entry: PlanetResidencyEntry): void {
  assertPlanetId(entry.planetId);
  assertByteCount(entry.bytes, 'bytes');
  assertNonNegativeFinite(entry.lastTouched, 'lastTouched');
}

function validateActivationBands(bands: PlanetActivationBands): void {
  assertNonNegativeFinite(bands.exactCenterDistance, 'exactCenterDistance');
  assertNonNegativeFinite(bands.exactSurfaceDistance, 'exactSurfaceDistance');
  assertNonNegativeFinite(bands.activeCenterDistance, 'activeCenterDistance');
  assertNonNegativeFinite(bands.activeSurfaceDistance, 'activeSurfaceDistance');
  if (bands.activeCenterDistance > bands.exactCenterDistance) {
    throw new RangeError('activeCenterDistance cannot exceed exactCenterDistance');
  }
  if (bands.activeSurfaceDistance > bands.exactSurfaceDistance) {
    throw new RangeError('activeSurfaceDistance cannot exceed exactSurfaceDistance');
  }
}

function assertPlanetId(value: string): void {
  if (typeof value !== 'string' || value.length === 0) throw new TypeError('planet id must be non-empty');
}

function assertByteCount(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${label} must be a non-negative safe integer`);
}

function assertPositiveFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${label} must be positive and finite`);
}

function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${label} must be non-negative and finite`);
}

function assertNonNegativeOrInfinity(value: number, label: string): void {
  if (Number.isNaN(value) || value < 0) throw new RangeError(`${label} must be non-negative`);
}
