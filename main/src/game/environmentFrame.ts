import type {
  PlanetDescriptor,
  StarSystemManifest,
  Vec3Tuple
} from './starSystem.ts';

export interface AtmosphereSurfaceBands {
  /** Full planet environment at or below this conservative surface distance. */
  innerSurfaceDistance: number;
  /** Pure system-space environment at or above this conservative surface distance. */
  outerSurfaceDistance: number;
}

export interface EnvironmentFrameInput {
  manifest: StarSystemManifest;
  shipSystemPosition: Vec3Tuple;
  previousDominantPlanetId: string | null;
  atmosphere: AtmosphereSurfaceBands;
  systemDayPhase: number;
  /**
   * A challenger must be closer by more than this many surface-distance units
   * before ownership changes. This prevents midpoint jitter without blending owners.
   */
  dominanceHysteresisDistance?: number;
}

export interface BodyEnvironmentDistance {
  planetId: string;
  seed: number;
  centerDistance: number;
  conservativeSurfaceDistance: number;
}

export interface DirectionalStarFrame {
  seed: number;
  hue: number;
  intensity: number;
  direction: Vec3Tuple;
  /** Normalized to [0, 1). */
  dayPhase: number;
}

export interface RenderEnvironmentFrame {
  kind: 'space' | 'planet';
  planetId: string | null;
  seed: number | null;
  /** Smooth planet contribution. Space contributes `1 - atmosphereInfluence`. */
  atmosphereInfluence: number;
  spaceInfluence: number;
}

export interface EnvironmentFrame {
  /** Nearest conservative body after ownership hysteresis. */
  dominantPlanetId: string | null;
  dominantPlanetSeed: number | null;
  /**
   * Discrete gravity candidate. This is never blended and is intentionally
   * independent from the continuous render-environment blend.
   */
  gravityOwnerPlanetId: string | null;
  gravityOwnerPlanetSeed: number | null;
  /** Null in pure system space; never falls back to a stale current world. */
  activeEnvironmentPlanetId: string | null;
  activeEnvironmentPlanetSeed: number | null;
  dominantDistance: BodyEnvironmentDistance | null;
  renderEnvironment: RenderEnvironmentFrame;
  star: DirectionalStarFrame;
}

export const DEFAULT_DOMINANCE_HYSTERESIS_DISTANCE = 20;

/**
 * Resolves the system environment without consulting React state or world globals.
 *
 * Gravity ownership remains a single discrete body. Atmosphere, fog, grading, and
 * audio may consume the continuous render blend, which reaches a clean space frame
 * outside the selected body's outer atmosphere band.
 */
export function resolveEnvironmentFrame(input: EnvironmentFrameInput): EnvironmentFrame {
  validatePosition(input.shipSystemPosition);
  validateAtmosphereBands(input.atmosphere);
  if (!Number.isFinite(input.systemDayPhase)) {
    throw new RangeError('systemDayPhase must be finite');
  }
  const hysteresis = input.dominanceHysteresisDistance ?? DEFAULT_DOMINANCE_HYSTERESIS_DISTANCE;
  assertNonNegativeFinite(hysteresis, 'dominanceHysteresisDistance');

  const distances = input.manifest.planets.map(planet => bodyDistance(planet, input.shipSystemPosition));
  const dominantDistance = selectDominantBody(
    distances,
    input.previousDominantPlanetId,
    hysteresis
  );
  const atmosphereInfluence = dominantDistance
    ? atmosphereInfluenceAtDistance(
      dominantDistance.conservativeSurfaceDistance,
      input.atmosphere
    )
    : 0;
  const hasActiveEnvironment = dominantDistance !== null && atmosphereInfluence > 0;
  const activeEnvironmentPlanetId = hasActiveEnvironment ? dominantDistance.planetId : null;
  const activeEnvironmentPlanetSeed = hasActiveEnvironment ? dominantDistance.seed : null;
  const star = directionalStarFrame(input.manifest, input.systemDayPhase);

  return {
    dominantPlanetId: dominantDistance?.planetId ?? null,
    dominantPlanetSeed: dominantDistance?.seed ?? null,
    gravityOwnerPlanetId: dominantDistance?.planetId ?? null,
    gravityOwnerPlanetSeed: dominantDistance?.seed ?? null,
    activeEnvironmentPlanetId,
    activeEnvironmentPlanetSeed,
    dominantDistance,
    renderEnvironment: {
      kind: hasActiveEnvironment ? 'planet' : 'space',
      planetId: activeEnvironmentPlanetId,
      seed: activeEnvironmentPlanetSeed,
      atmosphereInfluence,
      spaceInfluence: 1 - atmosphereInfluence
    },
    star
  };
}

/** Smooth planet contribution across authored nearest-surface atmosphere bands. */
export function atmosphereInfluenceAtDistance(
  conservativeSurfaceDistance: number,
  bands: AtmosphereSurfaceBands
): number {
  assertNonNegativeFinite(conservativeSurfaceDistance, 'conservativeSurfaceDistance');
  validateAtmosphereBands(bands);
  if (conservativeSurfaceDistance <= bands.innerSurfaceDistance) return 1;
  if (conservativeSurfaceDistance >= bands.outerSurfaceDistance) return 0;

  const t = (conservativeSurfaceDistance - bands.innerSurfaceDistance)
    / (bands.outerSurfaceDistance - bands.innerSurfaceDistance);
  const smooth = t * t * (3 - 2 * t);
  return 1 - smooth;
}

/** Shared directional-star input used by surface lighting and proxy terminators. */
export function directionalStarFrame(
  manifest: Pick<StarSystemManifest, 'star'>,
  systemDayPhase: number
): DirectionalStarFrame {
  if (!Number.isFinite(systemDayPhase)) throw new RangeError('systemDayPhase must be finite');
  const dayPhase = normalizeDayPhase(systemDayPhase);
  const angle = dayPhase * Math.PI * 2;
  const direction = normalizeTuple([
    Math.cos(angle) * 0.55,
    Math.sin(angle),
    Math.sin(angle * 0.5) * 0.35 + 0.2
  ]);
  return {
    seed: manifest.star.seed,
    hue: manifest.star.hue,
    intensity: manifest.star.intensity,
    direction,
    dayPhase
  };
}

export function normalizeDayPhase(dayPhase: number): number {
  if (!Number.isFinite(dayPhase)) throw new RangeError('dayPhase must be finite');
  return ((dayPhase % 1) + 1) % 1;
}

function bodyDistance(
  planet: PlanetDescriptor,
  shipSystemPosition: Vec3Tuple
): BodyEnvironmentDistance {
  validatePosition(planet.systemPosition);
  assertNonNegativeFinite(planet.surfaceBoundRadius, 'surfaceBoundRadius');
  const centerDistance = Math.hypot(
    shipSystemPosition[0] - planet.systemPosition[0],
    shipSystemPosition[1] - planet.systemPosition[1],
    shipSystemPosition[2] - planet.systemPosition[2]
  );
  return {
    planetId: planet.worldId,
    seed: planet.seed,
    centerDistance,
    conservativeSurfaceDistance: Math.max(0, centerDistance - planet.surfaceBoundRadius)
  };
}

function selectDominantBody(
  distances: readonly BodyEnvironmentDistance[],
  previousDominantPlanetId: string | null,
  hysteresisDistance: number
): BodyEnvironmentDistance | null {
  if (distances.length === 0) return null;
  const nearest = [...distances].sort((a, b) => (
    a.conservativeSurfaceDistance - b.conservativeSurfaceDistance
    || a.centerDistance - b.centerDistance
    || a.planetId.localeCompare(b.planetId)
  ))[0];
  if (!previousDominantPlanetId) return nearest;

  const previous = distances.find(distance => distance.planetId === previousDominantPlanetId);
  if (!previous || previous.planetId === nearest.planetId) return nearest;
  return previous.conservativeSurfaceDistance <= nearest.conservativeSurfaceDistance + hysteresisDistance
    ? previous
    : nearest;
}

function normalizeTuple(value: Vec3Tuple): Vec3Tuple {
  const length = Math.hypot(value[0], value[1], value[2]);
  if (length <= 1e-12) return [0, 1, 0];
  return [value[0] / length, value[1] / length, value[2] / length];
}

function validateAtmosphereBands(bands: AtmosphereSurfaceBands): void {
  assertNonNegativeFinite(bands.innerSurfaceDistance, 'innerSurfaceDistance');
  assertNonNegativeFinite(bands.outerSurfaceDistance, 'outerSurfaceDistance');
  if (bands.outerSurfaceDistance <= bands.innerSurfaceDistance) {
    throw new RangeError('outerSurfaceDistance must exceed innerSurfaceDistance');
  }
}

function validatePosition(position: Vec3Tuple): void {
  if (position.length !== 3 || position.some(value => !Number.isFinite(value))) {
    throw new RangeError('system position must contain three finite values');
  }
}

function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be non-negative and finite`);
  }
}
