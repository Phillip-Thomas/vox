import * as THREE from 'three';
import type { QualityProfile } from '../config/graphicsSettings.ts';
import {
  buildStarSystemManifest,
  type PlanetDescriptor,
  type PlanetSlot,
  type SystemCoordinate,
  type Vec3Tuple
} from '../game/starSystem.ts';
import { seededUnit } from '../utils/worldCoordinates.ts';
import {
  deriveWorldPreviewTraits,
  previewSurfaceValue,
  WORLD_PREVIEW_PLANET_RADIUS
} from '../utils/worldPreview.ts';
import type { PlanetProfile } from '../game/PlanetProfile.ts';

export interface CompanionBodyModel {
  descriptor: PlanetDescriptor;
  relativePosition: Vec3Tuple;
  systemMotion: CompanionSystemMotionProfile;
  bodyMotion: CompanionBodyMotionProfile;
}

export interface CompanionSystemMotionProfile {
  /** Normal of the system's authored orbital plane. */
  orbitAxis: Vec3Tuple;
  /** In-plane axis used for the smaller latitude component of the sky ellipse. */
  latitudeAxis: Vec3Tuple;
  phaseRadians: number;
  periodSeconds: number;
  longitudeAmplitudeRadians: number;
  latitudeAmplitudeRadians: number;
}

export interface CompanionBodyMotionProfile {
  /** Local spin axis, including the body's deterministic obliquity. */
  spinAxis: Vec3Tuple;
  spinPhaseRadians: number;
  spinPeriodSeconds: number;
  cloudPhaseRadians: number;
  /** Cloud drift relative to the rotating terrain, as a fraction of spin speed. */
  cloudDriftRatio: number;
}

export interface CompanionVisualBudget {
  surfaceSubdivisions: number;
  cloudSubdivisions: number;
  ringSegments: number;
  separateCloudShell: boolean;
  exactTerrainShell: boolean;
}

export interface CompanionBodyModelOptions {
  coordinate: SystemCoordinate;
  activePlanetSlot?: PlanetSlot;
  forceSingleBody?: boolean;
  bodyCountOverride?: 1 | 2 | 3;
}

export const COMPANION_MOTION_FADE_START = 0.15;
export const COMPANION_MOTION_FADE_END = 0.65;
export const COMPANION_ORBIT_MIN_PERIOD_SECONDS = 150;
export const COMPANION_ORBIT_MAX_PERIOD_SECONDS = 240;
export const COMPANION_SPIN_MIN_PERIOD_SECONDS = 8 * 60;
export const COMPANION_SPIN_MAX_PERIOD_SECONDS = 16 * 60;

/**
 * Peak apparent star-field drift, in rad/s, as seen from a surface observer.
 * The sky dome's fragment shader rotates the star/nebula direction by
 * `rotate(dir, uTime * 0.01)` (spaceSky.ts main()), with uTime fed the r3f
 * clock's elapsedTime in real seconds on animated profiles
 * (SpaceSky.tsx: `animated ? state.clock.elapsedTime : 0`). A star on the
 * rotation "equator" therefore wheels at 0.01 rad/s (~0.573 deg/s); polar
 * stars slower. This is the reference pace the sibling bodies match.
 */
export const SKY_STARFIELD_DRIFT_RAD_PER_SEC = 0.01;

/**
 * The sibling bodies are deliberately tuned to drift at the SAME PACE as the
 * star field so the surface sky reads as one cohesive system. We aim their peak
 * apparent longitude rate at this fraction of the star drift: just under the
 * peak star rate, so the bodies clearly co-move with the stars (the visible
 * elliptical sweep speed lands ~0.5x–0.8x of the sky rate) without racing them.
 */
export const COMPANION_APPARENT_DRIFT_FRACTION_OF_SKY = 0.8;
export const COMPANION_APPARENT_DRIFT_RATE_RAD_PER_SEC =
  SKY_STARFIELD_DRIFT_RAD_PER_SEC * COMPANION_APPARENT_DRIFT_FRACTION_OF_SKY;

const TAU = Math.PI * 2;
const FALLBACK_ORBIT_REFERENCE: Vec3Tuple = [1, 0, 0];

const FACE_FRAMES: ReadonlyArray<{
  normal: Vec3Tuple;
  tangentU: Vec3Tuple;
  tangentV: Vec3Tuple;
}> = [
  { normal: [1, 0, 0], tangentU: [0, 1, 0], tangentV: [0, 0, 1] },
  { normal: [-1, 0, 0], tangentU: [0, 1, 0], tangentV: [0, 0, -1] },
  { normal: [0, 1, 0], tangentU: [0, 0, 1], tangentV: [1, 0, 0] },
  { normal: [0, -1, 0], tangentU: [0, 0, 1], tangentV: [-1, 0, 0] },
  { normal: [0, 0, 1], tangentU: [1, 0, 0], tangentV: [0, 1, 0] },
  { normal: [0, 0, -1], tangentU: [1, 0, 0], tangentV: [0, -1, 0] }
];

export function buildCompanionBodyModels({
  coordinate,
  activePlanetSlot = 0,
  forceSingleBody = false,
  bodyCountOverride
}: CompanionBodyModelOptions): CompanionBodyModel[] {
  const manifest = buildStarSystemManifest(coordinate, {
    forceSingleBody,
    ...(bodyCountOverride === undefined ? {} : { bodyCountOverride })
  });
  const active = manifest.planets.find(planet => planet.address.slot === activePlanetSlot);
  if (!active) return [];
  const orbitReference = manifest.planets[1]?.systemPosition ?? FALLBACK_ORBIT_REFERENCE;
  const systemMotion = companionSystemMotionProfile(manifest.systemSeed, orbitReference);

  return manifest.planets
    .filter(planet => planet.address.slot !== activePlanetSlot)
    .slice(0, 2)
    .map(descriptor => ({
      descriptor,
      relativePosition: [
        descriptor.systemPosition[0] - active.systemPosition[0],
        descriptor.systemPosition[1] - active.systemPosition[1],
        descriptor.systemPosition[2] - active.systemPosition[2]
      ],
      systemMotion,
      bodyMotion: companionBodyMotionProfile(descriptor.seed)
    }));
}

/**
 * Deterministic visual ephemeris for a system. This deliberately does not alter
 * PlanetDescriptor.systemPosition: flight, targeting, persistence, and landing
 * continue to use the authored static layout.
 */
export function companionSystemMotionProfile(
  systemSeed: number,
  orbitReference: Vec3Tuple
): CompanionSystemMotionProfile {
  const reference = normalizedTuple(orbitReference, FALLBACK_ORBIT_REFERENCE);
  let latitudeAxis = normalizedTuple(
    [-reference[2], 0, reference[0]],
    [0, 0, 1]
  );
  let orbitAxis = normalizedTuple(crossTuple(reference, latitudeAxis), [0, 1, 0]);
  // Keep the deterministic plane normal in one hemisphere so the same system
  // never reverses motion merely because the player changes active planets.
  if (orbitAxis[1] < 0) {
    orbitAxis = negateTuple(orbitAxis);
    latitudeAxis = negateTuple(latitudeAxis);
  }

  const periodSeconds = THREE.MathUtils.lerp(
    COMPANION_ORBIT_MIN_PERIOD_SECONDS,
    COMPANION_ORBIT_MAX_PERIOD_SECONDS,
    seededUnit(systemSeed, 823)
  );
  // Derive the sky-ellipse longitude amplitude FROM the period so the peak
  // apparent longitude rate (amplitude * 2π / period) equals the sky-cohesive
  // target for every seed, regardless of the seeded period. The seed still
  // varies how large the ellipse is and how long one loop takes; the pace is
  // pinned to the star field. The motion stays a bounded ellipse (cos/sin over
  // longitude/latitude), so the fade weight converges it smoothly to the exact
  // canonical center with no unbounded angle to unwind.
  const longitudeAmplitudeRadians =
    COMPANION_APPARENT_DRIFT_RATE_RAD_PER_SEC * periodSeconds / TAU;
  return {
    orbitAxis,
    latitudeAxis,
    phaseRadians: seededUnit(systemSeed, 821) * TAU,
    periodSeconds,
    longitudeAmplitudeRadians,
    // Rounder ellipse than before (0.45–0.65 vs 0.24–0.42) so the apparent speed
    // stays closer to the target through the whole sweep instead of stalling at
    // an eccentric turning point — reads as continuous circulation, not a swing.
    latitudeAmplitudeRadians: longitudeAmplitudeRadians
      * THREE.MathUtils.lerp(0.45, 0.65, seededUnit(systemSeed, 827))
  };
}

export function companionBodyMotionProfile(seed: number): CompanionBodyMotionProfile {
  const tilt = THREE.MathUtils.degToRad(6 + seededUnit(seed, 839) * 16);
  const azimuth = seededUnit(seed, 853) * TAU;
  const sinTilt = Math.sin(tilt);
  return {
    spinAxis: [
      Math.cos(azimuth) * sinTilt,
      Math.cos(tilt),
      Math.sin(azimuth) * sinTilt
    ],
    spinPhaseRadians: seededUnit(seed, 857) * TAU,
    spinPeriodSeconds: THREE.MathUtils.lerp(
      COMPANION_SPIN_MIN_PERIOD_SECONDS,
      COMPANION_SPIN_MAX_PERIOD_SECONDS,
      seededUnit(seed, 859)
    ),
    cloudPhaseRadians: seededUnit(seed, 863) * TAU,
    cloudDriftRatio: THREE.MathUtils.lerp(0.1, 0.24, seededUnit(seed, 877))
  };
}

/**
 * Full on the surface, then smoothly gone well before deep-space targeting.
 * Returning an exact zero at/above the end boundary is intentional: the
 * renderer and all canonical travel systems meet on precisely the same center.
 */
export function companionPresentationMotionWeight(
  spaceBlend: number,
  canonicalTargetingActive = false
): number {
  if (canonicalTargetingActive) return 0;
  if (!Number.isFinite(spaceBlend) || spaceBlend <= COMPANION_MOTION_FADE_START) return 1;
  if (spaceBlend >= COMPANION_MOTION_FADE_END) return 0;
  const t = (spaceBlend - COMPANION_MOTION_FADE_START)
    / (COMPANION_MOTION_FADE_END - COMPANION_MOTION_FADE_START);
  return 1 - t * t * (3 - 2 * t);
}

/**
 * Apply the small system-wide sky ellipse to one canonical active→sibling
 * vector. The two rotations are shared by every sibling, preserving radii,
 * opposition, pairwise separation, and reciprocal views. Pass `out` from a
 * render loop to keep this allocation-free.
 */
export function companionApparentRelativePosition(
  relativePosition: Vec3Tuple,
  profile: CompanionSystemMotionProfile,
  elapsedSeconds: number,
  spaceBlend: number,
  canonicalTargetingActive = false,
  out: THREE.Vector3 = new THREE.Vector3()
): THREE.Vector3 {
  const weight = companionPresentationMotionWeight(spaceBlend, canonicalTargetingActive);
  if (weight === 0) {
    return out.set(relativePosition[0], relativePosition[1], relativePosition[2]);
  }

  const phase = periodicPhase(profile.phaseRadians, elapsedSeconds, profile.periodSeconds);
  const longitude = Math.cos(phase) * profile.longitudeAmplitudeRadians * weight;
  const latitude = Math.sin(phase) * profile.latitudeAmplitudeRadians * weight;
  rotateTupleAroundAxis(relativePosition, profile.orbitAxis, longitude, out);
  rotateVectorAroundAxis(out, profile.latitudeAxis, latitude, out);
  return out;
}

/** Current canonical terrain-spin phase, expressed on the shortest signed arc. */
export function companionBodySpinPhase(
  profile: CompanionBodyMotionProfile,
  elapsedSeconds: number
): number {
  return wrapSignedRadians(
    periodicPhase(profile.spinPhaseRadians, elapsedSeconds, profile.spinPeriodSeconds)
  );
}

/** Cloud drift relative to terrain spin, sampled in the existing shader. */
export function companionCloudDriftPhase(
  profile: CompanionBodyMotionProfile,
  elapsedSeconds: number
): number {
  const driftPeriod = profile.spinPeriodSeconds / Math.max(profile.cloudDriftRatio, 1e-6);
  return wrapSignedRadians(periodicPhase(profile.cloudPhaseRadians, elapsedSeconds, driftPeriod));
}

function periodicPhase(initialRadians: number, elapsedSeconds: number, periodSeconds: number): number {
  const safeTime = Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0;
  const safePeriod = Number.isFinite(periodSeconds) && periodSeconds > 0 ? periodSeconds : 1;
  const cycleTime = ((safeTime % safePeriod) + safePeriod) % safePeriod;
  return normalizeRadians(initialRadians + cycleTime / safePeriod * TAU);
}

function normalizeRadians(value: number): number {
  return ((value % TAU) + TAU) % TAU;
}

function wrapSignedRadians(value: number): number {
  const normalized = normalizeRadians(value);
  return normalized > Math.PI ? normalized - TAU : normalized;
}

function normalizedTuple(value: Vec3Tuple, fallback: Vec3Tuple): Vec3Tuple {
  const length = Math.hypot(value[0], value[1], value[2]);
  if (!Number.isFinite(length) || length <= 1e-9) return [...fallback];
  return [value[0] / length, value[1] / length, value[2] / length];
}

function crossTuple(a: Vec3Tuple, b: Vec3Tuple): Vec3Tuple {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function negateTuple(value: Vec3Tuple): Vec3Tuple {
  return [-value[0], -value[1], -value[2]];
}

function rotateTupleAroundAxis(
  value: Vec3Tuple,
  axis: Vec3Tuple,
  angle: number,
  out: THREE.Vector3
): THREE.Vector3 {
  return rotateComponentsAroundAxis(value[0], value[1], value[2], axis, angle, out);
}

function rotateVectorAroundAxis(
  value: THREE.Vector3,
  axis: Vec3Tuple,
  angle: number,
  out: THREE.Vector3
): THREE.Vector3 {
  return rotateComponentsAroundAxis(value.x, value.y, value.z, axis, angle, out);
}

function rotateComponentsAroundAxis(
  x: number,
  y: number,
  z: number,
  axis: Vec3Tuple,
  angle: number,
  out: THREE.Vector3
): THREE.Vector3 {
  if (angle === 0) return out.set(x, y, z);
  const [axisX, axisY, axisZ] = axis;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const dot = axisX * x + axisY * y + axisZ * z;
  const oneMinusCosine = 1 - cosine;
  return out.set(
    x * cosine + (axisY * z - axisZ * y) * sine + axisX * dot * oneMinusCosine,
    y * cosine + (axisZ * x - axisX * z) * sine + axisY * dot * oneMinusCosine,
    z * cosine + (axisX * y - axisY * x) * sine + axisZ * dot * oneMinusCosine
  );
}

export function companionVisualBudget(profile: QualityProfile): CompanionVisualBudget {
  switch (profile) {
    case 'ULTRA':
      return { surfaceSubdivisions: 32, cloudSubdivisions: 22, ringSegments: 112, separateCloudShell: true, exactTerrainShell: true };
    case 'HIGH':
      return { surfaceSubdivisions: 28, cloudSubdivisions: 18, ringSegments: 96, separateCloudShell: true, exactTerrainShell: true };
    case 'MEDIUM':
      return { surfaceSubdivisions: 20, cloudSubdivisions: 12, ringSegments: 64, separateCloudShell: true, exactTerrainShell: false };
    case 'LOW':
      return { surfaceSubdivisions: 14, cloudSubdivisions: 0, ringSegments: 36, separateCloudShell: false, exactTerrainShell: false };
    case 'POTATO':
      return { surfaceSubdivisions: 8, cloudSubdivisions: 0, ringSegments: 20, separateCloudShell: false, exactTerrainShell: false };
  }
}

export const EXACT_SHELL_FULL_DISTANCE = 420;
export const EXACT_SHELL_START_DISTANCE = 1_050;
export const EXACT_TERRAIN_BATCH_SIZE = 5_000;
export const EXACT_WATER_BATCH_SIZE = 4_096;

/** Legacy surface-sky framing radius retained for stable near-sky proxy depth. */
export const SURFACE_SKY_INNER_RADIUS = 208;
export const SURFACE_SKY_PREFERRED_DISTANCE = 138;
export const SURFACE_SKY_EXIT_FRACTION = 0.78;

export interface CompanionCelestialPlacementInput {
  /** True camera → body-center distance in render units. */
  physicalDistance: number;
  /** Ray exit distance through the legacy surface-sky framing sphere. */
  skyExitDistance: number;
  /** atmosphereSpaceBlend: 0 = sky-dome surrogate, 1 = physical placement. */
  spaceBlend: number;
  nominalFaceRadius: number;
  /** Horizon extinction fade (0..1) that applies in pure surrogate mode. */
  horizonExtinction: number;
}

export interface CompanionCelestialPlacement {
  /** Body-center distance along the TRUE view ray from the camera. */
  centerDistance: number;
  scale: number;
  /** Material visibility (surrogate horizon fade relaxes to 1 in space). */
  visibility: number;
}

/**
 * Places a companion body along its true view direction for any point in the
 * atmosphere ⇄ space transition. Scale follows center depth at the same ratio,
 * so the rendered geometry's angular silhouette is EXACTLY invariant while
 * parallax ramps in. At spaceBlend=1 the result is the physical placement
 * (centerDistance = physicalDistance, scale = nominalFaceRadius, no horizon fade).
 *
 * Pass `out` from a per-frame caller to avoid allocating on every call.
 */
export function companionCelestialPlacement(
  input: CompanionCelestialPlacementInput,
  out: CompanionCelestialPlacement = { centerDistance: 0, scale: 0, visibility: 0 }
): CompanionCelestialPlacement {
  const blend = THREE.MathUtils.clamp(input.spaceBlend, 0, 1);
  const surrogateDistance = Math.min(
    SURFACE_SKY_PREFERRED_DISTANCE,
    Math.max(input.skyExitDistance, 2) * SURFACE_SKY_EXIT_FRACTION
  );
  out.centerDistance = THREE.MathUtils.lerp(surrogateDistance, input.physicalDistance, blend);
  out.scale = out.centerDistance * input.nominalFaceRadius / Math.max(1e-6, input.physicalDistance);
  out.visibility = THREE.MathUtils.lerp(input.horizonExtinction, 1, blend);
  return out;
}

export function companionExactTerrainFaceCount(instanceData: Float32Array, terrainCount: number): number {
  let faces = 0;
  for (let index = 0; index < terrainCount; index++) {
    let hiddenMask = Math.trunc(instanceData[index * 2 + 1]) & 0x3f;
    let hiddenFaces = 0;
    while (hiddenMask !== 0) {
      hiddenMask &= hiddenMask - 1;
      hiddenFaces++;
    }
    faces += 6 - hiddenFaces;
  }
  return faces;
}

export function companionExactShellDrawCount(terrainFaceCount: number, waterFaceCount: number): number {
  const terrainDraws = terrainFaceCount > 0 ? 1 : 0;
  const waterDraws = Math.ceil(Math.max(0, waterFaceCount) / EXACT_WATER_BATCH_SIZE);
  return terrainDraws + waterDraws;
}

export function companionExactShellTriangleCount(terrainFaceCount: number, waterFaceCount: number): number {
  return Math.max(0, terrainFaceCount + waterFaceCount) * 2;
}

/** Exact terrain dissolves in well before activation so landmarks never jump. */
export function companionExactShellBlend(centerDistance: number): number {
  if (!Number.isFinite(centerDistance)) return 0;
  const t = THREE.MathUtils.clamp(
    (centerDistance - EXACT_SHELL_FULL_DISTANCE)
      / (EXACT_SHELL_START_DISTANCE - EXACT_SHELL_FULL_DISTANCE),
    0,
    1
  );
  const smooth = t * t * (3 - 2 * t);
  return 1 - smooth;
}

export function createCompanionSurfaceGeometry(
  seed: number,
  requestedSubdivisions: number,
  planetProfile?: PlanetProfile
): THREE.BufferGeometry {
  const subdivisions = THREE.MathUtils.clamp(Math.trunc(requestedSubdivisions), 2, 32);
  const traits = deriveWorldPreviewTraits(seed, WORLD_PREVIEW_PLANET_RADIUS, planetProfile);
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const direction = new THREE.Vector3();
  const color = new THREE.Color();
  const ice = new THREE.Color('#d9e7ed');
  const row = subdivisions + 1;

  for (const face of FACE_FRAMES) {
    const baseVertex = positions.length / 3;
    for (let y = 0; y <= subdivisions; y++) {
      const v = -1 + (y / subdivisions) * 2;
      for (let x = 0; x <= subdivisions; x++) {
        const u = -1 + (x / subdivisions) * 2;
        const px = face.normal[0] + face.tangentU[0] * u + face.tangentV[0] * v;
        const py = face.normal[1] + face.tangentU[1] * u + face.tangentV[1] * v;
        const pz = face.normal[2] + face.tangentU[2] * u + face.tangentV[2] * v;
        direction.set(px, py, pz).normalize();

        const surface = previewSurfaceValue(direction, traits);
        const relief = (surface - 0.5) * (0.045 + traits.relief * 0.085);
        const oceanInset = surface < traits.oceanCoverage ? -0.012 : 0;
        const displacement = 1 + relief + oceanInset;
        positions.push(px * displacement, py * displacement, pz * displacement);
        uvs.push(x / subdivisions, y / subdivisions);

        const latitude = Math.abs(direction.y);
        if (surface < traits.oceanCoverage) {
          color.copy(traits.oceanColor).offsetHSL(0, 0, (surface - traits.oceanCoverage) * 0.1);
        } else if (latitude > traits.iceCoverage) {
          color.copy(ice);
        } else if (surface > 0.78 - traits.relief * 0.12) {
          color.copy(traits.rockColor);
        } else {
          color.copy(traits.landColor).lerp(
            traits.rockColor,
            THREE.MathUtils.clamp((surface - 0.56) * (1 + traits.relief), 0, 0.5)
          );
        }
        color.multiplyScalar(0.86 + surface * 0.22);
        colors.push(color.r, color.g, color.b);
      }
    }

    for (let y = 0; y < subdivisions; y++) {
      for (let x = 0; x < subdivisions; x++) {
        const a = baseVertex + y * row + x;
        const b = a + 1;
        const c = a + row;
        const d = c + 1;
        indices.push(a, b, c, b, d, c);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();
  return geometry;
}

export function createCompanionCloudGeometry(
  seed: number,
  subdivisions: number,
  planetProfile?: PlanetProfile
): THREE.BufferGeometry {
  const geometry = createCompanionSurfaceGeometry(seed, subdivisions, planetProfile);
  const traits = deriveWorldPreviewTraits(seed, WORLD_PREVIEW_PLANET_RADIUS, planetProfile);
  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 4);
  const direction = new THREE.Vector3();
  const phase = seed * 0.00017;

  for (let index = 0; index < position.count; index++) {
    direction.set(position.getX(index), position.getY(index), position.getZ(index)).normalize();
    const bands = Math.sin((direction.x * 2.1 + direction.z * 3.7 + phase) * 5.2);
    const broken = Math.sin((direction.y * 4.4 - direction.z * 2.3 + phase * 1.7) * 7.1);
    const coverage = THREE.MathUtils.smoothstep(bands * 0.62 + broken * 0.38, 0.18, 0.72);
    colors[index * 4] = traits.cloudColor.r;
    colors[index * 4 + 1] = traits.cloudColor.g;
    colors[index * 4 + 2] = traits.cloudColor.b;
    colors[index * 4 + 3] = coverage * 0.42;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));
  return geometry;
}
