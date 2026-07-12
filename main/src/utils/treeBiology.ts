import * as THREE from 'three';

/** Minimal vector shape accepted by the pure biology helpers. */
export interface Vec3Like {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface TreeLightOptions {
  /** Radius, in local tree units, within which existing wood can shade a tip. */
  influenceRadius?: number;
  /** Exponential attenuation applied to accumulated local occupancy. */
  shadeStrength?: number;
  /** How strongly the current shoot direction persists. */
  forwardWeight?: number;
  /** Baseline bias toward local tree-up (+Y). */
  upwardWeight?: number;
  /** Strength of steering away from nearby occupied space. */
  opennessWeight?: number;
  /** Hard iteration cap; callers should still pass a spatially bounded list. */
  maxOccupiedNodes?: number;
}

export const DEFAULT_TREE_LIGHT_OPTIONS: Readonly<Required<TreeLightOptions>> = Object.freeze({
  influenceRadius: 3,
  shadeStrength: 0.65,
  forwardWeight: 0.45,
  upwardWeight: 0.55,
  opennessWeight: 1.15,
  maxOccupiedNodes: 512
});

export interface PipeModelOptions {
  /** Leonardo/pipe-model exponent: 2 means cross-sectional area is conserved. */
  exponent?: number;
  /** Safety ceiling in local tree units. */
  maxRadius?: number;
  /** Defensive cap for malformed or unexpectedly large support counts. */
  maxSupportedTips?: number;
}

export const DEFAULT_PIPE_MODEL_OPTIONS: Readonly<Required<PipeModelOptions>> = Object.freeze({
  exponent: 2,
  maxRadius: 2,
  maxSupportedTips: 4096
});

export interface CantileverSagOptions {
  /** Unit-conversion coefficient for the normalized tree mass/radius system. */
  bendScale?: number;
  /** Maximum permanent bend contributed by one solve, in radians. */
  maxSagRadians?: number;
  /** Denominator floor that prevents fine twigs from producing infinities. */
  minRadius?: number;
  /** Denominator floor for very soft wood. */
  minStiffness?: number;
}

export const DEFAULT_CANTILEVER_SAG_OPTIONS: Readonly<Required<CantileverSagOptions>> =
  Object.freeze({
    bendScale: 1e-5,
    maxSagRadians: 0.65,
    minRadius: 0.015,
    minStiffness: 0.05
  });

const EPSILON = 1e-9;
const MAX_LIGHT_RADIUS = 100;
const MAX_LIGHT_SAMPLES = 4096;
const MAX_MASS = 1e6;
const MAX_LEVER_ARM = 1e4;
const MAX_STIFFNESS = 1e6;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function bounded(value: number | undefined, min: number, max: number, fallback: number): number {
  if (value === undefined || Number.isNaN(value)) return fallback;
  if (value === Infinity) return max;
  if (value === -Infinity) return min;
  return clamp(value, min, max);
}

function finiteCoordinate(value: number): number | null {
  return Number.isFinite(value) ? value : null;
}

function smooth01(value: number): number {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Estimate the fraction of local sky available to a growth tip and write the
 * direction of the most open nearby space into `outOpenDirection`.
 *
 * Assumptions: tree-local +Y is skyward; nearby nodes are soft spherical shade
 * casters; nodes above the tip occlude much more than nodes below it. This is a
 * deterministic occupancy heuristic, not a physical raycast. It is intended to
 * run repeatedly during bounded procedural generation, so it allocates no
 * temporary vectors and inspects at most `maxOccupiedNodes` entries.
 *
 * @returns normalized light exposure in [0, 1].
 */
export function estimateTreeLight(
  tipPosition: Vec3Like,
  tipDirection: Vec3Like,
  occupiedNodes: readonly Vec3Like[],
  outOpenDirection: THREE.Vector3,
  options: TreeLightOptions = DEFAULT_TREE_LIGHT_OPTIONS
): number {
  const influenceRadius = bounded(
    options.influenceRadius,
    0.01,
    MAX_LIGHT_RADIUS,
    DEFAULT_TREE_LIGHT_OPTIONS.influenceRadius
  );
  const shadeStrength = bounded(
    options.shadeStrength,
    0,
    8,
    DEFAULT_TREE_LIGHT_OPTIONS.shadeStrength
  );
  const forwardWeight = bounded(
    options.forwardWeight,
    0,
    4,
    DEFAULT_TREE_LIGHT_OPTIONS.forwardWeight
  );
  const upwardWeight = bounded(
    options.upwardWeight,
    0,
    4,
    DEFAULT_TREE_LIGHT_OPTIONS.upwardWeight
  );
  const opennessWeight = bounded(
    options.opennessWeight,
    0,
    4,
    DEFAULT_TREE_LIGHT_OPTIONS.opennessWeight
  );
  const maxOccupiedNodes = Math.floor(
    bounded(
      options.maxOccupiedNodes,
      0,
      MAX_LIGHT_SAMPLES,
      DEFAULT_TREE_LIGHT_OPTIONS.maxOccupiedNodes
    )
  );

  const tx = finiteCoordinate(tipPosition.x) ?? 0;
  const ty = finiteCoordinate(tipPosition.y) ?? 0;
  const tz = finiteCoordinate(tipPosition.z) ?? 0;
  const radiusSq = influenceRadius * influenceRadius;

  let shade = 0;
  let openX = 0;
  let openY = 0;
  let openZ = 0;

  const count = Math.min(occupiedNodes.length, maxOccupiedNodes);
  for (let i = 0; i < count; i++) {
    const occupied = occupiedNodes[i];
    const ox = finiteCoordinate(occupied.x);
    const oy = finiteCoordinate(occupied.y);
    const oz = finiteCoordinate(occupied.z);
    if (ox === null || oy === null || oz === null) continue;

    const dx = ox - tx;
    const dy = oy - ty;
    const dz = oz - tz;
    const distanceSq = dx * dx + dy * dy + dz * dz;
    // A caller may include the current tip in the occupancy list; it must not
    // shade itself or create a divide-by-zero direction.
    if (distanceSq <= EPSILON || distanceSq > radiusSq) continue;

    const distance = Math.sqrt(distanceSq);
    const invDistance = 1 / distance;
    const proximity = 1 - distance / influenceRadius;
    const vertical = dy * invDistance;
    const skyward = smooth01((vertical + 0.2) / 1.2);
    const weight = proximity * proximity * (0.06 + 0.94 * skyward);

    shade += weight;
    // Horizontal blockers steer growth sideways. A blocker above should not
    // attract a shoot downward; only blockers below contribute an upward term.
    openX -= dx * invDistance * weight;
    openY += Math.max(0, -vertical) * weight * 0.35;
    openZ -= dz * invDistance * weight;
  }

  let dirX = finiteCoordinate(tipDirection.x) ?? 0;
  let dirY = finiteCoordinate(tipDirection.y) ?? 1;
  let dirZ = finiteCoordinate(tipDirection.z) ?? 0;
  let dirLength = Math.hypot(dirX, dirY, dirZ);
  if (dirLength <= EPSILON) {
    dirX = 0;
    dirY = 1;
    dirZ = 0;
    dirLength = 1;
  }
  dirX /= dirLength;
  dirY /= dirLength;
  dirZ /= dirLength;

  let resultX = dirX * forwardWeight;
  let resultY = dirY * forwardWeight + upwardWeight;
  let resultZ = dirZ * forwardWeight;
  const openLength = Math.hypot(openX, openY, openZ);
  if (openLength > EPSILON && opennessWeight > 0) {
    const scale = (opennessWeight * Math.min(1, shade)) / openLength;
    resultX += openX * scale;
    resultY += openY * scale;
    resultZ += openZ * scale;
  }

  const resultLength = Math.hypot(resultX, resultY, resultZ);
  if (resultLength <= EPSILON || !Number.isFinite(resultLength)) {
    outOpenDirection.set(0, 1, 0);
  } else {
    outOpenDirection.set(
      resultX / resultLength,
      resultY / resultLength,
      resultZ / resultLength
    );
  }

  // Every accepted occupancy contribution is non-negative, so adding a node can
  // only preserve or reduce exposure. Vertical position is already encoded in
  // `weight`: overhead material shades strongly while material below barely does.
  return clamp(Math.exp(-shadeStrength * shade), 0, 1);
}

/**
 * Convert light availability into a bounded growth multiplier.
 *
 * Shade tolerance interpolates the response from linear light toward sqrt(light),
 * improving dim-light vigor without allowing growth in complete darkness.
 * Bright-growth priority uses the FloraSynth-inspired `1 + p*(light - 0.5)`
 * response: it rewards bright tips and suppresses shaded tips.
 */
export function growthVigor(
  light: number,
  shadeTolerance: number,
  brightGrowthPriority: number
): number {
  const safeLight = bounded(light, 0, 1, 0);
  const tolerance = bounded(shadeTolerance, 0, 1, 0);
  const priority = bounded(brightGrowthPriority, 0, 5, 0);
  const shadeAdjusted = safeLight + (Math.sqrt(safeLight) - safeLight) * tolerance;
  const brightResponse = Math.max(0, 1 + priority * (safeLight - 0.5));
  return clamp(shadeAdjusted * brightResponse, 0, 2);
}

/**
 * Pipe-model branch radius from the number of living tips supported downstream.
 * With the default exponent 2, four equal terminal pipes require twice the
 * radius of one terminal pipe. A branch supporting no living tips returns zero.
 */
export function pipeModelRadius(
  supportedLivingTips: number,
  terminalRadius: number,
  options: PipeModelOptions = DEFAULT_PIPE_MODEL_OPTIONS
): number {
  const maxRadius = bounded(
    options.maxRadius,
    1e-6,
    100,
    DEFAULT_PIPE_MODEL_OPTIONS.maxRadius
  );
  const maxSupportedTips = bounded(
    options.maxSupportedTips,
    1,
    1e6,
    DEFAULT_PIPE_MODEL_OPTIONS.maxSupportedTips
  );
  const exponent = bounded(
    options.exponent,
    1.25,
    4,
    DEFAULT_PIPE_MODEL_OPTIONS.exponent
  );
  const tips = bounded(supportedLivingTips, 0, maxSupportedTips, 0);
  const tipRadius = bounded(terminalRadius, 0, maxRadius, 0);
  if (tips <= 0 || tipRadius <= 0) return 0;
  return Math.min(maxRadius, tipRadius * Math.pow(tips, 1 / exponent));
}

/**
 * Estimate a downward cantilever deflection angle in radians.
 *
 * This intentionally uses the simplified trend described by FloraSynth rather
 * than pretending to be a unit-complete beam solver: sag grows with downstream
 * mass and lever arm, and falls sharply with stiffness and radius^4. Floors and
 * a per-solve angle ceiling keep malformed or hair-thin branches stable.
 */
export function cantileverSagAngle(
  downstreamMass: number,
  leverArm: number,
  radius: number,
  stiffness: number,
  options: CantileverSagOptions = DEFAULT_CANTILEVER_SAG_OPTIONS
): number {
  const bendScale = bounded(
    options.bendScale,
    0,
    1,
    DEFAULT_CANTILEVER_SAG_OPTIONS.bendScale
  );
  const maxSagRadians = bounded(
    options.maxSagRadians,
    0,
    Math.PI * 0.5,
    DEFAULT_CANTILEVER_SAG_OPTIONS.maxSagRadians
  );
  const minRadius = bounded(
    options.minRadius,
    1e-6,
    10,
    DEFAULT_CANTILEVER_SAG_OPTIONS.minRadius
  );
  const minStiffness = bounded(
    options.minStiffness,
    1e-6,
    MAX_STIFFNESS,
    DEFAULT_CANTILEVER_SAG_OPTIONS.minStiffness
  );

  const mass = bounded(downstreamMass, 0, MAX_MASS, 0);
  const lever = bounded(leverArm, 0, MAX_LEVER_ARM, 0);
  const safeRadius = Math.max(minRadius, bounded(radius, 0, 1e3, minRadius));
  const safeStiffness = Math.max(
    minStiffness,
    bounded(stiffness, 0, MAX_STIFFNESS, minStiffness)
  );
  const denominator = safeStiffness * Math.pow(safeRadius, 4);
  const sag = (bendScale * mass * lever) / denominator;
  if (!Number.isFinite(sag)) return maxSagRadians;
  return clamp(sag, 0, maxSagRadians);
}
