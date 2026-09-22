import * as THREE from 'three';
import { getGraphicsQuality, getQualityProfile, type GraphicsQuality, type QualityProfile } from '../config/graphicsSettings';
import { createFaunaGeometryForKind, type FaunaGeometryDetail } from './faunaGeometry';
import type { VoxelRealityEffects } from '../game/systems/realityRenderSystem';
import { MaterialType } from '../types/materials';
import { voxelSystem } from './efficientVoxelSystem';
import { VOXEL_SCALE, voxelCoordToWorld } from './cubeGravityConstants';
import { deterministicTangentForUp, dominantFaceForPosition, FACE_NORMALS } from './surfaceControls';
import { seededVoxelUnit } from './seededHash';
import { buildBiomeProfile, type BiomeProfile } from './biomeProfile';
import { buildWindProfile, type WindProfile } from './windProfile';
import { seededUnit } from './worldCoordinates';
import { buildPlanetArtDirection, type PaletteRoleColor, type PlanetArtDirection, type PlanetEcology } from './planetArtDirection';
import { isMaterialEligibleForEcology } from './planetEcology';
import type { PlanetProfile } from '../game/PlanetProfile.ts';
import type { FaunaNavigationObstacles } from './faunaNavigationObstacles.ts';
import {
  FAUNA_JOINT_ID,
  FAUNA_KINDS,
  FAUNA_KIND_ID,
  FAUNA_MATERIAL_SLOT_ID,
  FAUNA_MODEL_SCHEMA_VERSION,
  FAUNA_REGION_ID,
  FAUNA_SPECIES,
  buildFaunaPhenotype,
  clampFaunaPose,
  emptyFaunaPose,
  normalizeFaunaLocomotionPhase,
  type FaunaBehavior,
  type FaunaKind,
  type FaunaPhenotype,
  type FaunaRenderSnapshotV1
} from './faunaModel';

export { FAUNA_KINDS, type FaunaKind } from './faunaModel';

/** Live water classification (proceduralWorldGenerator implements this). */
export interface FaunaWaterClassifier {
  isWaterVoxel(x: number, y: number, z: number): boolean;
}

export interface FaunaProfile {
  terrainSeed: number;
  biome: BiomeProfile;
  wind: WindProfile;
  artDirection: PlanetArtDirection;
  ecology: PlanetEcology;
  densityMul: number;
  coverage: number;
  /** Per-planet body-size multiplier from the art direction's faunaScaleBias. */
  scaleMul: number;
  /** Optional live water classifier — ground fauna avoid submerged terrain. */
  water?: FaunaWaterClassifier;
  coatBase: THREE.Color;
  coatWarm: THREE.Color;
  coatCool: THREE.Color;
  woolColor: THREE.Color;
  darkColor: THREE.Color;
  accentColor: THREE.Color;
  wingColor: THREE.Color;
  weights: Record<FaunaKind, number>;
  /** Renderer-neutral, deterministic anatomy shared by every backend adapter. */
  phenotypes: Record<FaunaKind, FaunaPhenotype>;
}

export interface FaunaBuildResult {
  count: number;
  voxelCount: number;
  agents: FaunaAgent[];
}

export interface FaunaBuildOptions {
  existingAgents?: FaunaAgent[];
  time?: number;
  obstacles?: FaunaNavigationObstacles;
}

export interface FaunaAgent {
  kind: FaunaKind;
  terrainSeed: number;
  homeX: number;
  homeY: number;
  homeZ: number;
  x: number;
  y: number;
  z: number;
  toX: number;
  toY: number;
  toZ: number;
  from: THREE.Vector3;
  to: THREE.Vector3;
  progress: number;
  directionIndex: number;
  speed: number;
  scaleSeed: number;
  tiltSeed: number;
  offsetU: number;
  offsetV: number;
  phase: number;
  stridePhase: number;
  stepSalt: number;
  stepCount: number;
  orientation: THREE.Quaternion;
  /** Clock time until which the animal stands grazing (herd kinds only). */
  grazeUntil: number;
  /** Clock time until which the animal is bolting away from the player. */
  fleeUntil: number;
  /** Smoothed 0..1 graze posture driven into the vertex shader (head down). */
  pose: number;
  /** Last live occupancy revision for which the active route was validated. */
  navigationRevision?: string;
}

// Feet are authored to touch local y=0, so the anchor sits just above the face
// plane (0.99) and stays flush at ANY body scale. The old 1.08 offset hovered
// large animals ~0.2 wu off the ground.
const FAUNA_SURFACE_OFFSET = 1.0;
const FAUNA_COVERAGE_SALT = 411;
const FAUNA_DENSITY_SALT = 412;
const FAUNA_PICK_SALT = 413;
const FAUNA_OFFSET_U_SALT = 414;
const FAUNA_OFFSET_V_SALT = 415;
const FAUNA_YAW_SALT = 416;
const FAUNA_SCALE_SALT = 417;
const FAUNA_TILT_SALT = 418;
const TAU = Math.PI * 2;

const _world = new THREE.Vector3();
const _up = new THREE.Vector3();
const _tangent = new THREE.Vector3();
const _bitangent = new THREE.Vector3();
const _basis = new THREE.Matrix4();
const _scratch = new THREE.Matrix4();
const _a = new THREE.Vector3();
const _movePos = new THREE.Vector3();
const _moveForward = new THREE.Vector3();
const _moveSide = new THREE.Vector3();
const _moveUp = new THREE.Vector3();
const _routeUp = new THREE.Vector3();
const _agentCullPos = new THREE.Vector3();
const _blockedRoutePos = new THREE.Vector3();
const _desiredQuat = new THREE.Quaternion();
const _tiltQuat = new THREE.Quaternion();
const _finalQuat = new THREE.Quaternion();
const _scaleVec = new THREE.Vector3();

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function lin(hex: number): THREE.Color {
  return new THREE.Color(hex).convertSRGBToLinear();
}

function hsl(h: number, s: number, l: number): THREE.Color {
  return new THREE.Color().setHSL((h + 1) % 1, clamp(s, 0, 1), clamp(l, 0, 1)).convertSRGBToLinear();
}

function roleColor(role: PaletteRoleColor): THREE.Color {
  return new THREE.Color()
    .setHSL(role.h, role.s, role.l)
    .convertSRGBToLinear();
}

function hueDistance(a: number, b: number): number {
  const d = Math.abs(((a - b + 0.5) % 1) - 0.5);
  return Math.min(d, 1 - d);
}

function separationFromVegetation(hue: number, art: PlanetArtDirection): number {
  return Math.min(
    hueDistance(hue, art.palette.vegetationBase.h),
    hueDistance(hue, art.palette.vegetationTip.h),
    hueDistance(hue, art.palette.canopyBase.h),
    hueDistance(hue, art.palette.canopyTip.h)
  );
}

export function buildFaunaProfile(
  terrainSeed: number,
  water?: FaunaWaterClassifier,
  planetProfile?: PlanetProfile
): FaunaProfile {
  const s = terrainSeed | 0;
  const biome = planetProfile?.biome ?? buildBiomeProfile(s);
  const art = buildPlanetArtDirection(s, planetProfile);
  const wind = buildWindProfile(s, planetProfile ?? biome);
  const { aridity, hue, lushness, saturation, temperature } = biome;
  const hueJitter = (seededUnit(s, 451) - 0.5) * 0.09;
  const coatHue = (hue + hueJitter + 0.035 + aridity * 0.035 + 1) % 1;
  const sat = clamp(saturation * 0.5 + lushness * 0.12 - aridity * 0.08, 0.18, 0.68);

  let readableCoatHue = art.palette.faunaCoat.h;
  const nearVegetation = separationFromVegetation(readableCoatHue, art) < 0.12;
  if (nearVegetation) {
    const candidates = [
      readableCoatHue,
      (readableCoatHue - 0.22 + 1) % 1,
      (readableCoatHue + 0.24) % 1,
      (readableCoatHue + 0.34) % 1
    ];
    readableCoatHue = candidates.reduce((best, candidate) =>
      separationFromVegetation(candidate, art) > separationFromVegetation(best, art) ? candidate : best
    );
  }
  if (hueDistance(readableCoatHue, art.palette.terrainPrimary.h) < 0.06) {
    readableCoatHue = (readableCoatHue + 0.12 + seededUnit(s, 452) * 0.08) % 1;
  }
  const readableCoatSat = clamp(art.palette.faunaCoat.s * (biome.alien ? 0.9 : 0.58) + 0.08, 0.12, biome.alien ? 0.62 : 0.46);
  const readableCoatLight = clamp(art.palette.faunaCoat.l + 0.04 + lushness * 0.04 - aridity * 0.03, 0.34, 0.58);

  const coatBase = hsl(readableCoatHue, readableCoatSat, readableCoatLight);
  const coatWarm = hsl(readableCoatHue + 0.055, clamp(readableCoatSat + 0.08, 0, 0.72), readableCoatLight + 0.08 + temperature * 0.03);
  const coatCool = hsl(readableCoatHue - 0.08, clamp(readableCoatSat + 0.03, 0, 0.68), readableCoatLight - 0.12 + lushness * 0.035);
  const woolColor = hsl(coatHue + 0.035, clamp(sat * 0.28, 0.08, 0.36), 0.78 - aridity * 0.12);
  const darkColor = hsl(coatHue - 0.04, clamp(sat * 0.55, 0.12, 0.46), 0.16 + lushness * 0.03);
  const accentColor = biome.alien
    ? roleColor(art.palette.faunaAccent)
    : lin(0x2f2118);
  const wingColor = roleColor(art.palette.wingGlass);

  const densityMul = clamp(0.18 + lushness * 0.68 + (1 - aridity) * 0.2, 0.12, 1.08);
  const coverage = clamp(0.08 + lushness * 0.28 + (1 - aridity) * 0.08, 0.05, 0.44);
  // Planet-level body size from the art direction (verdant/frozen planets grow
  // bigger herds; sparse archetypes trend leaner). ±~15% around the base sizes.
  const scaleMul = clamp(0.88 + art.shape.faunaScaleBias * 0.3, 0.8, 1.2);

  const weights: Record<FaunaKind, number> = {
    grazer: clamp((0.14 + lushness * 0.82 + (1 - aridity) * 0.28 - temperature * 0.08) * art.ecology.faunaWeights.grazer, 0.001, 2.2),
    woolly: clamp((0.1 + lushness * 0.48 + (1 - temperature) * 0.32 - aridity * 0.24) * art.ecology.faunaWeights.woolly, 0.001, 2.2),
    runner: clamp((0.16 + aridity * 0.38 + temperature * 0.34 + (1 - lushness) * 0.1) * art.ecology.faunaWeights.runner, 0.001, 2.2),
    hopper: clamp((0.14 + aridity * 0.72 + (1 - lushness) * 0.32) * art.ecology.faunaWeights.hopper, 0.001, 2.2),
    dragonfly: clamp((0.1 + lushness * 0.72 + (1 - aridity) * 0.3 + temperature * 0.12) * art.ecology.faunaWeights.dragonfly, 0.001, 2.2),
    fish: clamp((0.2 + (1 - aridity) * 0.5 + lushness * 0.3) * (art.ecology.faunaWeights.fish ?? 0.6), 0.001, 2.2)
  };

  return {
    terrainSeed: s,
    biome,
    wind,
    artDirection: art,
    ecology: art.ecology,
    densityMul,
    coverage,
    scaleMul,
    water,
    coatBase,
    coatWarm,
    coatCool,
    woolColor,
    darkColor,
    accentColor,
    wingColor,
    weights,
    phenotypes: Object.fromEntries(
      FAUNA_KINDS.map(kind => [kind, buildFaunaPhenotype(s, kind)])
    ) as Record<FaunaKind, FaunaPhenotype>
  };
}

export function isFaunaEligibleVoxel(voxel: { material: string; supportsSurfaceResources?: boolean }): boolean {
  return (
    voxel.supportsSurfaceResources !== false &&
    (
      voxel.material === MaterialType.GRASS ||
      voxel.material === MaterialType.DIRT ||
      voxel.material === MaterialType.SAND
    )
  );
}

export function isFaunaEligibleVoxelForProfile(
  voxel: { material: string; supportsSurfaceResources?: boolean },
  profile: FaunaProfile
): boolean {
  if (voxel.supportsSurfaceResources === false) return false;
  return isMaterialEligibleForEcology(profile.ecology, 'fauna', voxel.material as MaterialType);
}

export function isFaunaTravelVoxel(
  kind: FaunaKind,
  voxel: { material: string; supportsSurfaceResources?: boolean },
  profile: FaunaProfile
): boolean {
  if (!isFaunaEligibleVoxelForProfile(voxel, profile)) return false;
  // Fish glide over any eligible seabed material (wetness is enforced by the
  // habitat check, not here).
  if (kind === 'fish') return true;
  if (voxel.material === MaterialType.GRASS) return kind !== 'hopper' || profile.biome.lushness < 0.76;
  if (voxel.material === MaterialType.DIRT) return true;
  if (voxel.material === MaterialType.SAND) {
    if (kind === 'hopper') return true;
    if (kind === 'runner') return profile.biome.aridity > 0.28 || profile.biome.temperature > 0.58;
    if (kind === 'dragonfly') return profile.biome.aridity > 0.58;
    return false;
  }
  if (voxel.material === MaterialType.STONE) return kind === 'runner' || kind === 'hopper';
  if (voxel.material === MaterialType.BASALT) return kind === 'runner' || kind === 'hopper';
  return false;
}

/**
 * True when the voxel's walking surface is above the waterline (the cell over
 * its outward face is not flooded). Ground fauna never spawn on or step onto
 * submerged terrain; dragonflies hover, so they may cross water.
 */
export function isFaunaSurfaceDry(
  x: number,
  y: number,
  z: number,
  profile: Pick<FaunaProfile, 'water'>
): boolean {
  if (!profile.water) return true;
  voxelCoordToWorld(x, y, z, _world);
  const up = FACE_NORMALS[dominantFaceForPosition(_world)];
  return !profile.water.isWaterVoxel(x + Math.round(up.x), y + Math.round(up.y), z + Math.round(up.z));
}

/**
 * Kind-aware habitat: ground fauna need a dry walking surface, FISH need a
 * flooded one (they anchor to the submerged seabed and swim in the water column
 * above it), and dragonflies take either — they hover.
 */
export function isFaunaHabitatVoxel(
  kind: FaunaKind,
  x: number,
  y: number,
  z: number,
  profile: Pick<FaunaProfile, 'water'>
): boolean {
  if (kind === 'dragonfly') return true;
  const dry = isFaunaSurfaceDry(x, y, z, profile);
  return kind === 'fish' ? !dry : dry;
}

function materialDensityMul(material: string, profile: FaunaProfile): number {
  if (material === MaterialType.GRASS) return 1;
  if (material === MaterialType.DIRT) return 0.52 + profile.biome.lushness * 0.24;
  if (material === MaterialType.SAND) return 0.14 + profile.biome.aridity * 0.54;
  if (material === MaterialType.STONE) return 0.08 * profile.ecology.richness;
  if (material === MaterialType.BASALT) return 0.1 * profile.ecology.richness;
  return 0;
}

function materialKindMul(material: string, kind: FaunaKind): number {
  // Fish care about the seabed only loosely: sandy shallows read best, but any
  // submerged eligible material hosts them.
  if (kind === 'fish') {
    return material === MaterialType.SAND ? 1.2 : material === MaterialType.DIRT ? 1 : 0.8;
  }
  if (material === MaterialType.SAND) {
    return kind === 'hopper' ? 1.52 : kind === 'runner' ? 0.92 : kind === 'dragonfly' ? 0.08 : kind === 'grazer' ? 0.12 : 0.04;
  }
  if (material === MaterialType.DIRT) {
    return kind === 'hopper' ? 0.88 : kind === 'runner' ? 0.78 : kind === 'dragonfly' ? 0.56 : kind === 'grazer' ? 0.62 : 0.52;
  }
  if (material === MaterialType.GRASS) {
    return kind === 'grazer' ? 1.18 : kind === 'woolly' ? 1.08 : kind === 'dragonfly' ? 0.88 : kind === 'runner' ? 0.62 : 0.48;
  }
  if (material === MaterialType.STONE || material === MaterialType.BASALT) {
    return kind === 'runner' ? 0.86 : kind === 'hopper' ? 0.64 : kind === 'dragonfly' ? 0.22 : 0.04;
  }
  return 0;
}

function placementChance(density: number, material: string, profile: FaunaProfile): number {
  return clamp(Math.sqrt(Math.max(0, density)) * 0.48 * profile.densityMul * materialDensityMul(material, profile), 0, 1);
}

export function chooseFaunaKindForVoxel(
  voxel: { material: string },
  x: number,
  y: number,
  z: number,
  terrainSeed: number,
  profile: FaunaProfile
): FaunaKind {
  // Fish own flooded voxels; walkers own dry ones; dragonflies patrol both
  // (slightly favoring the shore).
  const wet = !isFaunaSurfaceDry(x, y, z, profile);
  const habitatMul = (kind: FaunaKind): number => {
    if (kind === 'fish') return wet ? 6 : 0;
    if (kind === 'dragonfly') return wet ? 0.7 : 1;
    return wet ? 0 : 1;
  };
  const weighted = FAUNA_KINDS.map(kind => ({
    kind,
    weight: Math.max(0.001, profile.weights[kind] * materialKindMul(voxel.material, kind) * habitatMul(kind))
  }));
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  let pick = seededVoxelUnit(x, y, z, FAUNA_PICK_SALT, terrainSeed) * total;
  for (const entry of weighted) {
    pick -= entry.weight;
    if (pick <= 0) return entry.kind;
  }
  return weighted[weighted.length - 1].kind;
}

export function shouldPlaceFaunaVoxel(
  voxel: { material: string; supportsSurfaceResources?: boolean },
  x: number,
  y: number,
  z: number,
  density: number,
  terrainSeed: number,
  profile: FaunaProfile
): boolean {
  if (density <= 0 || !isFaunaEligibleVoxelForProfile(voxel, profile)) return false;
  if (seededVoxelUnit(x, y, z, FAUNA_COVERAGE_SALT, terrainSeed) > profile.coverage) return false;
  // Flooded voxels host fish shoals a bit more densely than the open ground
  // hosts walkers. Habitat (dry-vs-wet per kind) is enforced by the callers
  // via isFaunaHabitatVoxel once the kind is chosen.
  const wetBoost = !isFaunaSurfaceDry(x, y, z, profile) ? 1.5 : 1;
  return seededVoxelUnit(x, y, z, FAUNA_DENSITY_SALT, terrainSeed) <=
    Math.min(1, placementChance(density, voxel.material, profile) * wetBoost);
}

export function countFaunaVoxels(
  kind: FaunaKind,
  density: number,
  terrainSeed: number,
  profile = buildFaunaProfile(terrainSeed),
  obstacles?: FaunaNavigationObstacles
): number {
  if (density <= 0) return 0;
  let n = 0;
  for (const voxel of voxelSystem.voxelValues()) {
    const [x, y, z] = voxel.position;
    if (!shouldPlaceFaunaVoxel(voxel, x, y, z, density, terrainSeed, profile)) continue;
    if (!isFaunaHabitatVoxel(kind, x, y, z, profile)) continue;
    if (!hasFaunaBodyClearance(kind, x, y, z, profile)) continue;
    if (obstacles?.isAnchorBlocked(kind, x, y, z)) continue;
    if (chooseFaunaKindForVoxel(voxel, x, y, z, terrainSeed, profile) === kind) n++;
  }
  return n;
}

export type { FaunaGeometryDetail } from './faunaGeometry';

/** Fur micro-normal strength per graphics profile (0 disables the fragment fur pass). */
export function faunaShaderDetailForProfile(profile: QualityProfile): number {
  if (profile === 'ULTRA') return 1;
  if (profile === 'HIGH') return 0.85;
  if (profile === 'MEDIUM') return 0.5;
  if (profile === 'LOW') return 0.2;
  return 0;
}

/** Geometry detail tier for the current graphics profile. */
export function faunaDetailForProfile(profile: QualityProfile): FaunaGeometryDetail {
  if (profile === 'ULTRA' || profile === 'HIGH') return 'high';
  if (profile === 'MEDIUM') return 'medium';
  return 'low';
}

/**
 * Builds one species' instanced geometry: an SDF-sculpted body plus explicit
 * limbs, horns, ears, wings, fins, and eyes (see faunaGeometry.ts).
 */
export function createFaunaGeometry(
  kind: FaunaKind,
  profile = buildFaunaProfile(0),
  detail: FaunaGeometryDetail = 'high'
): THREE.BufferGeometry {
  return createFaunaGeometryForKind(kind, profile, detail);
}

export function faunaKindId(kind: FaunaKind): number {
  return FAUNA_KIND_ID[kind];
}

export function prepareFaunaInstanceAttributes(
  geometry: THREE.BufferGeometry,
  capacity: number
): THREE.InstancedBufferAttribute {
  const attr = ensureFaunaScalarAttribute(geometry, 'aFaunaSeed', capacity);
  ensureFaunaScalarAttribute(geometry, 'aFaunaStride', capacity);
  ensureFaunaScalarAttribute(geometry, 'aFaunaPose', capacity);
  return attr;
}

function ensureFaunaScalarAttribute(
  geometry: THREE.BufferGeometry,
  name: string,
  capacity: number
): THREE.InstancedBufferAttribute {
  const existing = geometry.getAttribute(name) as THREE.InstancedBufferAttribute | undefined;
  if (existing && existing.count >= capacity) return existing;
  const attr = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, capacity)), 1);
  attr.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute(name, attr);
  return attr;
}

const FAUNA_NOISE = /* glsl */ `
  float fnHash21(vec2 p) {
    p = fract(p * vec2(223.43, 521.71));
    p += dot(p, p + 37.17);
    return fract(p.x * p.y);
  }
  float fnNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = fnHash21(i);
    float b = fnHash21(i + vec2(1.0, 0.0));
    float c = fnHash21(i + vec2(0.0, 1.0));
    float d = fnHash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  float fnFbm(vec2 p) {
    return 0.5 * fnNoise(p) + 0.3 * fnNoise(p * 2.07 + 11.3) + 0.2 * fnNoise(p * 4.31 - 7.1);
  }
  float fnIs(float value, float id) {
    return 1.0 - smoothstep(0.35, 0.65, abs(value - id));
  }
`;

/**
 * One lit material per species. Species, regions, and material slots ride in
 * uniforms and packed vertex attributes so the whole herd shares one program.
 *
 * Fragment features: species markings (dorsal stripe, countershading, socks,
 * agouti ticking, scale lattice, abdomen bands), fur micro-normals and a
 * fresnel sheen, iris/pupil eyes with night eyeshine, thin-film iridescence
 * on insect bodies and wing membranes with venation, fin rays, and restrained
 * bioluminescent markings that wake at night.
 */
export function createFaunaMaterial(
  kind: FaunaKind = 'grazer',
  profile = buildFaunaProfile(0)
): THREE.MeshStandardMaterial {
  const doubleSided = kind === 'dragonfly';
  const roughness = kind === 'woolly'
    ? 0.96
    : kind === 'fish'
      ? 0.42
      : kind === 'dragonfly'
        ? 0.36
        : 0.84;
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    side: doubleSided ? THREE.DoubleSide : THREE.FrontSide,
    transparent: false,
    alphaTest: 0,
    depthWrite: true,
    depthTest: true,
    roughness,
    metalness: 0.0
  });
  // Fauna is assembled into one instanced draw per species. Per-fragment alpha
  // hashing made thin fins and wings sparkle against the terrain and read as
  // missing or inverted faces, so keep coverage deterministic and express
  // membrane thinness through color, roughness, and rim lighting instead.
  material.alphaHash = false;

  material.onBeforeCompile = shader => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uFaunaVisibility = { value: 1 };
    shader.uniforms.uFaunaMotion = { value: 1 };
    shader.uniforms.uFaunaChroma = { value: 1 };
    shader.uniforms.uFaunaDetail = { value: 1 };
    shader.uniforms.uFaunaKind = { value: faunaKindId(kind) };
    shader.uniforms.uFaunaSSSColor = { value: profile.coatWarm.clone().lerp(profile.wingColor, kind === 'dragonfly' ? 0.55 : 0.12) };
    shader.uniforms.uFaunaRimColor = { value: profile.accentColor.clone().lerp(profile.wingColor, kind === 'dragonfly' ? 0.55 : 0.18) };
    shader.uniforms.uFaunaWingColor = { value: profile.wingColor.clone() };
    shader.uniforms.uFaunaAccentColor = { value: profile.accentColor.clone() };
    shader.uniforms.uFaunaSheenColor = { value: profile.coatWarm.clone().lerp(new THREE.Color(1, 1, 1), 0.35) };
    // Alien ecologies glow openly at night; familiar ones only hint at it.
    shader.uniforms.uFaunaBioGlow = { value: profile.biome.alien ? 1 : 0.32 };
    shader.uniforms.uSunDir = { value: new THREE.Vector3(0, 1, 0) };
    shader.uniforms.uMoonDir = { value: new THREE.Vector3(0, -1, 0) };
    shader.uniforms.uWindStrength = { value: 1 };
    shader.uniforms.uWindGustStrength = { value: 1 };
    shader.uniforms.uWindGustScale = { value: 0.04 };
    shader.uniforms.uWindGustSpeed = { value: 0.45 };
    shader.uniforms.uWindTurbulence = { value: 0.5 };
    shader.uniforms.uWindDir = { value: new THREE.Vector2(1, 0) };
    shader.uniforms.uWindOffset = { value: new THREE.Vector2(0, 0) };
    material.userData.shader = shader;

    const J = FAUNA_JOINT_ID;
    const K = FAUNA_KIND_ID;
    const R = FAUNA_REGION_ID;
    const S = FAUNA_MATERIAL_SLOT_ID;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float aFaunaFlex;
        attribute vec4 aFaunaSurface;
        attribute vec3 aFaunaJointPivot;
        attribute vec4 aFaunaBend;
        attribute float aFaunaSeed;
        attribute float aFaunaStride;
        attribute float aFaunaPose;
        uniform float uTime;
        uniform float uFaunaKind;
        uniform float uFaunaMotion;
        uniform float uWindStrength;
        uniform float uWindGustStrength;
        uniform float uWindGustScale;
        uniform float uWindGustSpeed;
        uniform float uWindTurbulence;
        uniform vec2 uWindDir;
        uniform vec2 uWindOffset;
        varying float vFaunaFlex;
        varying float vFaunaRegion;
        varying float vFaunaMaterialSlot;
        varying float vFaunaGust;
        varying float vFaunaShade;
        varying float vFaunaSeed;
        varying vec2 vFaunaUv;
        varying vec3 vFaunaLocalPos;
        varying vec3 vFaunaLocalNormal;
        varying vec3 vFaunaEyeAxis;
        varying vec3 vFaunaWorldPos;
        varying vec3 vFaunaWorldNormal;
        #define aFaunaRegion aFaunaSurface.x
        #define aFaunaJoint aFaunaSurface.y
        #define aFaunaJointWeight aFaunaSurface.z
        #define aFaunaMaterialSlot aFaunaSurface.w
        vec3 faunaRotateX(vec3 value, float angle) {
          float c = cos(angle);
          float s = sin(angle);
          return vec3(value.x, value.y * c - value.z * s, value.y * s + value.z * c);
        }
        vec3 faunaRotateY(vec3 value, float angle) {
          float c = cos(angle);
          float s = sin(angle);
          return vec3(value.x * c + value.z * s, value.y, -value.x * s + value.z * c);
        }
        vec3 faunaRotateZ(vec3 value, float angle) {
          float c = cos(angle);
          float s = sin(angle);
          return vec3(value.x * c - value.y * s, value.x * s + value.y * c, value.z);
        }
        float faunaIs(float value, float id) {
          return 1.0 - smoothstep(0.35, 0.65, abs(value - id));
        }
        float faunaJointAngle(float joint, float stride, float seed, float time, float kind, float pose) {
          float phase = stride * 6.2831853 + seed * 1.445;
          float wave = sin(phase);
          float frontLeft = faunaIs(joint, ${J.frontLeft.toFixed(1)});
          float frontRight = faunaIs(joint, ${J.frontRight.toFixed(1)});
          float hindLeft = faunaIs(joint, ${J.hindLeft.toFixed(1)});
          float hindRight = faunaIs(joint, ${J.hindRight.toFixed(1)});
          float neck = faunaIs(joint, ${J.neck.toFixed(1)});
          float tail = faunaIs(joint, ${J.tail.toFixed(1)});
          float leftWing = faunaIs(joint, ${J.leftWing.toFixed(1)});
          float rightWing = faunaIs(joint, ${J.rightWing.toFixed(1)});
          float fin = faunaIs(joint, ${J.fin.toFixed(1)});
          float woolly = faunaIs(kind, ${K.woolly.toFixed(1)});
          float hopper = faunaIs(kind, ${K.hopper.toFixed(1)});
          float runner = faunaIs(kind, ${K.runner.toFixed(1)});
          float dragonfly = faunaIs(kind, ${K.dragonfly.toFixed(1)});
          float angle = wave * 0.25 * (frontLeft - frontRight - hindLeft + hindRight) * (1.0 - hopper);
          angle += hopper * wave * (0.08 * (frontLeft + frontRight) - 0.13 * (hindLeft + hindRight));
          // Neck: a little nod with the stride, a slow idle sway, and the graze drop.
          angle += neck * (wave * 0.025 + sin(time * 0.53 + seed * 9.0) * 0.035 - pose * (1.02 - woolly * 0.42));
          angle += tail * (sin(time * (2.2 + seed) + phase) * (0.16 + runner * 0.14) + dragonfly * sin(time * 1.3 + seed * 4.0) * 0.05);
          angle += (leftWing - rightWing) * sin(time * (15.0 + seed * 3.0) + phase) * 0.82;
          angle += fin * sin(time * (4.2 + seed * 1.5) + phase) * 0.42;
          return angle;
        }
        float faunaNeckYaw(float seed, float time, float pose) {
          // Idle look-around; suppressed while grazing.
          return (sin(time * 0.31 + seed * 17.0) * 0.6 + sin(time * 0.77 + seed * 5.0) * 0.4) * 0.14 * (1.0 - pose * 0.7);
        }
        float faunaBendAngle(float joint, float stride, float seed, float kind) {
          float wave = sin(stride * 6.2831853 + seed * 1.445);
          float frontLeft = faunaIs(joint, ${J.frontLeft.toFixed(1)});
          float frontRight = faunaIs(joint, ${J.frontRight.toFixed(1)});
          float hindLeft = faunaIs(joint, ${J.hindLeft.toFixed(1)});
          float hindRight = faunaIs(joint, ${J.hindRight.toFixed(1)});
          float hopper = faunaIs(kind, ${K.hopper.toFixed(1)});
          float diagonal = wave * (frontLeft - frontRight - hindLeft + hindRight);
          float hopFold = wave * (0.34 * (frontLeft + frontRight) - 0.52 * (hindLeft + hindRight));
          return mix(-diagonal * 0.34, hopFold, hopper);
        }
        ${FAUNA_NOISE}`
      )
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
        {
          float seedN = fract(aFaunaSeed);
          float poseN = clamp(aFaunaPose, 0.0, 1.0);
          float normalJointAngle = faunaJointAngle(aFaunaJoint, aFaunaStride, seedN, uTime, uFaunaKind, poseN)
            * aFaunaJointWeight * uFaunaMotion;
          float normalBendAngle = faunaBendAngle(aFaunaJoint, aFaunaStride, seedN, uFaunaKind) * aFaunaBend.w * uFaunaMotion;
          objectNormal = faunaRotateZ(objectNormal, normalBendAngle);
          float wingJoint = step(6.5, aFaunaJoint) * (1.0 - step(8.5, aFaunaJoint));
          float tailJoint = faunaIs(aFaunaJoint, ${J.tail.toFixed(1)});
          float finJoint = faunaIs(aFaunaJoint, ${J.fin.toFixed(1)});
          float neckJointN = faunaIs(aFaunaJoint, ${J.neck.toFixed(1)});
          float lateralJoint = clamp(tailJoint + finJoint, 0.0, 1.0);
          objectNormal = mix(objectNormal, faunaRotateZ(objectNormal, normalJointAngle), 1.0 - wingJoint - lateralJoint);
          objectNormal = mix(objectNormal, faunaRotateX(objectNormal, normalJointAngle), wingJoint);
          objectNormal = mix(objectNormal, faunaRotateY(objectNormal, normalJointAngle), lateralJoint);
          float yawN = faunaNeckYaw(seedN, uTime, poseN) * neckJointN * aFaunaJointWeight * uFaunaMotion;
          objectNormal = faunaRotateY(objectNormal, yawN);
          vFaunaLocalNormal = objectNormal;
        }`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vFaunaFlex = aFaunaFlex;
        vFaunaRegion = aFaunaRegion;
        vFaunaMaterialSlot = aFaunaMaterialSlot;
        vFaunaUv = uv;
        vec3 instWorld = instanceMatrix[3].xyz;
        vec2 windDir = normalize(uWindDir + vec2(0.0001, 0.0));
        vec2 windSide = vec2(-windDir.y, windDir.x);
        vec2 windUv = vec2(
          dot(instWorld.xz + uWindOffset, windDir),
          dot(instWorld.xz + uWindOffset, windSide)
        );
        float seed = fract(aFaunaSeed);
        vFaunaSeed = seed;
        vec2 gustUv = windUv * max(uWindGustScale, 0.001)
          + vec2(uTime * uWindGustSpeed, sin(uTime * uWindGustSpeed * 0.37) * 0.18);
        float gust = smoothstep(0.18, 0.9, fnNoise(gustUv + seed * 8.0));
        vFaunaGust = gust;
        float phase = seed * 6.2831853;
        float pose = clamp(aFaunaPose, 0.0, 1.0);
        float stridePhase = aFaunaStride * 6.2831853 + phase * 0.23;
        float stepWave = sin(stridePhase);
        float breathWave = sin(uTime * (0.74 + seed * 0.18) + phase);
        float motion = uFaunaMotion;
        float bodyBob = (abs(stepWave) * 0.016 + breathWave * 0.006) * motion;
        float hopKind = faunaIs(uFaunaKind, ${K.hopper.toFixed(1)});
        float fishKind = faunaIs(uFaunaKind, ${K.fish.toFixed(1)});
        float dragonflyKind = faunaIs(uFaunaKind, ${K.dragonfly.toFixed(1)});
        float hop = pow(max(0.0, stepWave), 1.6) * hopKind * motion;
        float jointAngle = faunaJointAngle(aFaunaJoint, aFaunaStride, seed, uTime, uFaunaKind, pose)
          * aFaunaJointWeight * motion;
        float wingJoint = step(6.5, aFaunaJoint) * (1.0 - step(8.5, aFaunaJoint));
        float tailJoint = faunaIs(aFaunaJoint, ${J.tail.toFixed(1)});
        float finJoint = faunaIs(aFaunaJoint, ${J.fin.toFixed(1)});
        float lateralJoint = clamp(tailJoint + finJoint, 0.0, 1.0);
        float bendAngle = faunaBendAngle(aFaunaJoint, aFaunaStride, seed, uFaunaKind) * motion;
        vec3 bendRelative = transformed - aFaunaBend.xyz;
        transformed = mix(
          transformed,
          aFaunaBend.xyz + faunaRotateZ(bendRelative, bendAngle),
          aFaunaBend.w
        );
        vec3 jointRelative = transformed - aFaunaJointPivot;
        vec3 jointRotated = faunaRotateZ(jointRelative, jointAngle);
        jointRotated = mix(jointRotated, faunaRotateX(jointRelative, jointAngle), wingJoint);
        jointRotated = mix(jointRotated, faunaRotateY(jointRelative, jointAngle), lateralJoint);
        float limbJoint = step(1.5, aFaunaJoint) * (1.0 - step(5.5, aFaunaJoint));
        float rootJoint = faunaIs(aFaunaJoint, ${J.root.toFixed(1)});
        float neckJoint = faunaIs(aFaunaJoint, ${J.neck.toFixed(1)});
        float yaw = faunaNeckYaw(seed, uTime, pose) * neckJoint * aFaunaJointWeight * motion;
        jointRotated = faunaRotateY(jointRotated, yaw);
        transformed = aFaunaJointPivot + jointRotated;
        // Eye gaze axis follows the head.
        vFaunaEyeAxis = faunaRotateY(faunaRotateZ(aFaunaBend.xyz, jointAngle), yaw);

        float bodyRegion = faunaIs(aFaunaRegion, ${R.body.toFixed(1)}) + faunaIs(aFaunaRegion, ${R.fleece.toFixed(1)});
        float earRegion = faunaIs(aFaunaRegion, ${R.ear.toFixed(1)});
        float tailRegion = faunaIs(aFaunaRegion, ${R.tail.toFixed(1)});
        float finRegion = faunaIs(aFaunaRegion, ${R.fin.toFixed(1)});
        float maneRegion = faunaIs(aFaunaRegion, ${R.mane.toFixed(1)});
        // Ribcage breathing: flanks swell along the normal.
        transformed += objectNormal * breathWave * 0.007 * clamp(bodyRegion, 0.0, 1.0) * abs(objectNormal.z) * motion * (1.0 - dragonflyKind);
        // Ear flicks: brief, occasional.
        float flick = pow(max(0.0, sin(uTime * 0.9 + seed * 13.0)), 36.0) * earRegion * aFaunaFlex;
        transformed.x -= flick * 0.03 * motion;
        transformed.z += flick * 0.012 * sign(position.z) * motion;
        // Tail: vertical wag on top of the lateral swish; fins flutter.
        transformed.y += sin(uTime * 1.7 + phase) * 0.018 * aFaunaFlex * tailRegion * motion * (1.0 - fishKind - dragonflyKind);
        transformed.z += sin(uTime * 5.6 + phase + position.x * 9.0 + position.y * 7.0) * 0.012 * aFaunaFlex * finRegion * motion;

        float plantedLift = pow(max(0.0, sin(stridePhase + aFaunaJoint * 3.14159265)), 1.8);
        transformed.y += plantedLift * 0.042 * limbJoint * aFaunaJointWeight * motion * (1.0 - hopKind);
        transformed.y += bodyBob * (rootJoint + neckJoint * 0.82);
        transformed.y += hop * 0.14;
        transformed.y -= pose * neckJoint * (0.5 + 0.5 * sin(uTime * 2.4 + phase)) * 0.018 * motion;
        transformed.z += sin(uTime * (4.2 + seed * 1.5) + phase - position.x * 2.4)
          * max(0.0, -position.x - 0.04) * 0.08 * fishKind * motion;

        float flexibleRegion = max(earRegion, max(maneRegion, tailJoint));
        float windFlex = max(0.0, aFaunaFlex - 0.28) * flexibleRegion;
        float windWave = sin(uTime * (1.15 + uWindGustSpeed) + phase + position.y * 2.2);
        float windDrive = (windWave * (0.2 + gust * uWindGustStrength) + uWindTurbulence * 0.05) * windFlex * motion * (1.0 - fishKind);
        transformed.x += windDir.x * windDrive * 0.045 * uWindStrength;
        transformed.z += windDir.y * windDrive * 0.045 * uWindStrength;
        vFaunaShade = clamp(position.y * 0.72 + 0.35, 0.38, 1.2);
        vFaunaLocalPos = transformed;
        vFaunaWorldPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        vFaunaWorldNormal = normalize((modelMatrix * instanceMatrix * vec4(objectNormal, 0.0)).xyz);`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform float uFaunaVisibility;
        uniform float uFaunaChroma;
        uniform float uFaunaDetail;
        uniform float uFaunaKind;
        uniform float uFaunaBioGlow;
        uniform vec3 uFaunaSSSColor;
        uniform vec3 uFaunaRimColor;
        uniform vec3 uFaunaWingColor;
        uniform vec3 uFaunaAccentColor;
        uniform vec3 uFaunaSheenColor;
        uniform vec3 uSunDir;
        uniform vec3 uMoonDir;
        varying float vFaunaFlex;
        varying float vFaunaRegion;
        varying float vFaunaMaterialSlot;
        varying float vFaunaGust;
        varying float vFaunaShade;
        varying float vFaunaSeed;
        varying vec2 vFaunaUv;
        varying vec3 vFaunaLocalPos;
        varying vec3 vFaunaLocalNormal;
        varying vec3 vFaunaEyeAxis;
        varying vec3 vFaunaWorldPos;
        varying vec3 vFaunaWorldNormal;
        vec3 vFaunaGlowTerm;
        float vFaunaSheen;
        float vFaunaMembraneMask;
        ${FAUNA_NOISE}`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float luma = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
        diffuseColor.rgb = mix(vec3(luma) * 0.84, diffuseColor.rgb, clamp(uFaunaChroma, 0.0, 1.0));
        vec3 p = vFaunaLocalPos;
        vec3 nl = normalize(vFaunaLocalNormal);
        float bodyPart = clamp(fnIs(vFaunaRegion, ${R.body.toFixed(1)}) + fnIs(vFaunaRegion, ${R.fleece.toFixed(1)}), 0.0, 1.0);
        float headPart = fnIs(vFaunaRegion, ${R.head.toFixed(1)});
        float earPart = fnIs(vFaunaRegion, ${R.ear.toFixed(1)});
        float tailPart = fnIs(vFaunaRegion, ${R.tail.toFixed(1)});
        float manePart = fnIs(vFaunaRegion, ${R.mane.toFixed(1)});
        float frontLimb = fnIs(vFaunaRegion, ${R.frontLimb.toFixed(1)});
        float hindLimb = fnIs(vFaunaRegion, ${R.hindLimb.toFixed(1)});
        float legPart = clamp(frontLimb + hindLimb, 0.0, 1.0);
        float wingRegion = fnIs(vFaunaRegion, ${R.wing.toFixed(1)});
        float finRegion = fnIs(vFaunaRegion, ${R.fin.toFixed(1)});
        float eyeSlot = fnIs(vFaunaMaterialSlot, ${S.eye.toFixed(1)});
        float hornSlot = fnIs(vFaunaMaterialSlot, ${S.horn.toFixed(1)});
        float hoofSlot = fnIs(vFaunaMaterialSlot, ${S.hoof.toFixed(1)});
        float fleeceSlot = fnIs(vFaunaMaterialSlot, ${S.fleece.toFixed(1)});
        float membraneSlot = fnIs(vFaunaMaterialSlot, ${S.membrane.toFixed(1)});
        float skinSlot = fnIs(vFaunaMaterialSlot, ${S.skin.toFixed(1)});
        float scaleSlot = fnIs(vFaunaMaterialSlot, ${S.scale.toFixed(1)});
        float accentPart = clamp(eyeSlot + hornSlot + hoofSlot, 0.0, 1.0);
        float kindGrazer = fnIs(uFaunaKind, ${K.grazer.toFixed(1)});
        float kindWoolly = fnIs(uFaunaKind, ${K.woolly.toFixed(1)});
        float kindRunner = fnIs(uFaunaKind, ${K.runner.toFixed(1)});
        float kindHopper = fnIs(uFaunaKind, ${K.hopper.toFixed(1)});
        float kindDragonfly = fnIs(uFaunaKind, ${K.dragonfly.toFixed(1)});
        float kindFish = fnIs(uFaunaKind, ${K.fish.toFixed(1)});
        float mammal = kindGrazer + kindWoolly + kindRunner + kindHopper;
        vFaunaMembraneMask = membraneSlot;

        // Shared fields: dorsal band, belly, flank, and a per-animal seed drift.
        vec2 seedDrift = vec2(vFaunaSeed * 11.0, uFaunaKind * 3.7);
        float dorsal = smoothstep(0.35, 0.95, nl.y) * (1.0 - smoothstep(0.06, 0.22, abs(p.z)));
        float underside = smoothstep(0.25, -0.75, nl.y);
        float flank = smoothstep(0.3, 0.9, abs(nl.z));
        float coatFbm = fnFbm(p.xy * 7.0 + seedDrift) * 0.55 + fnFbm(p.xz * 7.0 + seedDrift.yx) * 0.45;
        float ticking = fnNoise(p.xy * 60.0 + p.z * 23.0 + seedDrift) * 0.6 + fnNoise(p.zy * 58.0 - seedDrift) * 0.4;
        float wool = 0.5 * fnNoise(p.xy * 17.0 + vec2(vFaunaSeed * 4.0, uFaunaKind))
          + 0.5 * fnNoise(p.yz * 18.0 + vec2(uFaunaKind, vFaunaSeed * 5.0));

        diffuseColor.rgb *= 0.78 + vFaunaShade * 0.22 + vFaunaGust * 0.04 + vFaunaFlex * 0.03;

        // Grazer: dark dorsal stripe, dappled rump, pale belly and throat, dark lower legs.
        {
          float rumpDapple = smoothstep(0.55, 0.8, coatFbm) * smoothstep(0.1, -0.3, p.x) * (1.0 - underside);
          float stripe = dorsal * bodyPart * 0.28;
          vec3 g = diffuseColor.rgb;
          g = mix(g, g * vec3(0.66, 0.66, 0.7), stripe);
          g = mix(g, g * 1.25 + vec3(0.03), rumpDapple * bodyPart * 0.55);
          g = mix(g, g * 1.28 + vec3(0.02), underside * bodyPart * 0.7);
          g = mix(g, g * vec3(0.7, 0.66, 0.6), legPart * (1.0 - hoofSlot) * smoothstep(0.5, 0.15, p.y) * 0.5);
          diffuseColor.rgb = mix(diffuseColor.rgb, g, kindGrazer);
        }
        // Woolly: fibre clumps in the fleece, a grey-dark face.
        {
          vec3 w = diffuseColor.rgb;
          w *= 0.86 + wool * fleeceSlot * 0.3;
          w = mix(w, w * vec3(0.94, 0.9, 0.86), (1.0 - fleeceSlot) * bodyPart * 0.3);
          diffuseColor.rgb = mix(diffuseColor.rgb, w, kindWoolly);
        }
        // Runner: dark socks and ear tips, white belly, darker saddle.
        {
          vec3 r = diffuseColor.rgb;
          float saddle = dorsal * bodyPart * smoothstep(0.35, 0.05, abs(p.x + 0.05));
          r = mix(r, r * vec3(0.72, 0.62, 0.55), saddle * 0.45);
          r = mix(r, r * 1.35 + vec3(0.05), underside * (bodyPart + headPart) * 0.75);
          r = mix(r, r * 0.35, legPart * smoothstep(0.32, 0.1, p.y) * 0.85);
          r = mix(r, r * 0.35, earPart * smoothstep(0.55, 0.95, vFaunaFlex));
          diffuseColor.rgb = mix(diffuseColor.rgb, r, kindRunner);
        }
        // Hopper: agouti ticking, white belly, dark ear tips, pale ear interiors.
        {
          vec3 h = diffuseColor.rgb;
          h *= 0.88 + ticking * 0.24 * (bodyPart + headPart);
          h = mix(h, h * 1.35 + vec3(0.06), underside * bodyPart * 0.8);
          h = mix(h, h * 0.4, earPart * smoothstep(0.75, 0.98, vFaunaFlex));
          h = mix(h, h * vec3(1.15, 0.95, 0.9), earPart * smoothstep(0.1, 0.7, nl.x) * 0.5);
          diffuseColor.rgb = mix(diffuseColor.rgb, h, kindHopper);
        }
        // Dragonfly: banded abdomen, iridescent chitin.
        {
          vec3 d = diffuseColor.rgb;
          float bands = smoothstep(0.35, 0.65, abs(fract(p.x * 10.4 + 0.3) - 0.5));
          d = mix(d, mix(d * 0.55, uFaunaAccentColor * 0.9, 0.6), bands * tailPart * 0.85);
          d = mix(d, d * 1.15 + uFaunaAccentColor * 0.12, bodyPart * smoothstep(0.2, 0.9, nl.y) * 0.5);
          diffuseColor.rgb = mix(diffuseColor.rgb, d, kindDragonfly);
        }
        // Fish: scale lattice, iridescent flank band, pale belly, lateral line.
        {
          vec3 f = diffuseColor.rgb;
          vec2 sp = vec2(p.x * 46.0, p.y * 46.0 + p.z * 8.0);
          sp.x += step(0.5, fract(sp.y * 0.5)) * 0.5;
          vec2 cellUv = fract(sp) - 0.5;
          float scaleRing = smoothstep(0.62, 0.5, length(cellUv + vec2(0.0, 0.18)));
          float scaleEdge = smoothstep(0.5, 0.42, length(cellUv + vec2(0.0, 0.18)));
          float belly = smoothstep(0.36, 0.16, p.y);
          f *= 1.0 - (scaleRing - scaleEdge) * 0.22 * scaleSlot;
          f = mix(f, f * 1.45 + vec3(0.08), belly * scaleSlot * 0.65);
          f = mix(f, uFaunaWingColor * 1.1, flank * scaleSlot * smoothstep(0.24, 0.42, p.y) * smoothstep(0.5, 0.36, p.y) * 0.32);
          float lateral = 1.0 - smoothstep(0.004, 0.012, abs(p.y - 0.365 - sin(p.x * 3.0) * 0.008));
          f = mix(f, f * 0.7, lateral * scaleSlot * 0.5);
          diffuseColor.rgb = mix(diffuseColor.rgb, f, kindFish);
        }

        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.02, 0.024, 0.022), eyeSlot);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.78, 0.74, 0.66), hornSlot * 0.4);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.7, 0.66, 0.6), hoofSlot * 0.5);
        // Horn/antler ridges.
        diffuseColor.rgb *= 1.0 - hornSlot * smoothstep(0.6, 0.9, abs(sin(p.y * 90.0 + p.x * 40.0))) * 0.12;
        // Membranes: wing venation and fin rays.
        {
          vec3 m = mix(uFaunaWingColor, uFaunaWingColor + vec3(0.12, 0.15, 0.17), vFaunaFlex);
          float chordLine = min(abs(vFaunaUv.x - 0.14), min(abs(vFaunaUv.x - 0.5), abs(vFaunaUv.x - 0.86)));
          float spanLine = abs(fract(vFaunaUv.y * 14.0 + 0.5) - 0.5) / 14.0;
          float vein = 1.0 - smoothstep(0.006, 0.02, min(chordLine * 0.35, spanLine));
          float stigma = smoothstep(0.08, 0.02, abs(vFaunaUv.y - 0.82)) * smoothstep(0.3, 0.1, vFaunaUv.x);
          m = mix(m, m * 0.55, vein * wingRegion * 0.7);
          m = mix(m, uFaunaAccentColor * 0.6, stigma * wingRegion);
          float rays = smoothstep(0.55, 0.9, abs(sin((p.y * 3.0 - p.x * 1.4 + p.z * 2.0) * 34.0)));
          m = mix(m, m * 0.72, rays * finRegion * 0.5);
          diffuseColor.rgb = mix(diffuseColor.rgb, m, membraneSlot * (0.7 + vFaunaGust * 0.1));
        }
        diffuseColor.rgb += vec3(0.016, 0.012, 0.008) * accentPart * (1.0 - membraneSlot);
        float stableMicro = fnNoise(p.xy * 34.0 + vec2(p.z * 11.0 + vFaunaSeed * 17.0, uFaunaKind * 5.3));
        diffuseColor.rgb *= 0.985 + stableMicro * 0.03;
        vFaunaSheen = mammal * (fleeceSlot * 0.5 + (1.0 - fleeceSlot) * (0.32 - skinSlot * 0.2)) * (1.0 - eyeSlot) * (1.0 - hornSlot) * (1.0 - hoofSlot);`
      )
      .replace(
        '#include <normal_fragment_begin>',
        `#include <normal_fragment_begin>
        vFaunaGlowTerm = vec3(0.0);
        {
          vec3 V = normalize(cameraPosition - vFaunaWorldPos);
          vec3 Nw = normalize(vFaunaWorldNormal) * faceDirection;
          vec3 nl2 = normalize(vFaunaLocalNormal);
          float daylight = smoothstep(-0.1, 0.25, uSunDir.y);
          float night = smoothstep(-0.05, 0.2, uMoonDir.y) * (1.0 - daylight);
          float dusk = 1.0 - daylight;
          float membrane = vFaunaMembraneMask;
          float eye = fnIs(vFaunaMaterialSlot, ${S.eye.toFixed(1)});
          float fleece = fnIs(vFaunaMaterialSlot, ${S.fleece.toFixed(1)});
          float skin = fnIs(vFaunaMaterialSlot, ${S.skin.toFixed(1)});
          float horn = fnIs(vFaunaMaterialSlot, ${S.horn.toFixed(1)});
          float hoof = fnIs(vFaunaMaterialSlot, ${S.hoof.toFixed(1)});
          float kindDragonfly2 = fnIs(uFaunaKind, ${K.dragonfly.toFixed(1)});
          float kindFish2 = fnIs(uFaunaKind, ${K.fish.toFixed(1)});
          float kindGrazer2 = fnIs(uFaunaKind, ${K.grazer.toFixed(1)});
          float kindHopper2 = fnIs(uFaunaKind, ${K.hopper.toFixed(1)});
          float kindRunner2 = fnIs(uFaunaKind, ${K.runner.toFixed(1)});
          float mammal2 = 1.0 - kindDragonfly2 - kindFish2;
          float tail2 = fnIs(vFaunaRegion, ${R.tail.toFixed(1)});
          float ear2 = fnIs(vFaunaRegion, ${R.ear.toFixed(1)});
          float bodyMass = 1.0 - membrane;

          // Fur micro-normals: strands lie along the body (+x) and drape down the flanks.
          float furWeight = uFaunaDetail * mammal2 * (1.0 - eye) * (1.0 - horn) * (1.0 - hoof) * (fleece * 1.6 + (1.0 - fleece) * (1.0 - skin * 0.7));
          if (furWeight > 0.001) {
            vec3 lp = vFaunaLocalPos;
            float freq = mix(70.0, 26.0, fleece);
            vec2 furUv = vec2(lp.x * freq * 0.35 + lp.z * freq * 0.1, lp.y * freq + lp.z * freq * 0.6);
            float strand = fnNoise(furUv + vFaunaSeed * 9.0) - fnNoise(furUv + vec2(0.0, 0.9) + vFaunaSeed * 9.0);
            float clump = fnNoise(lp.xy * 14.0 + lp.z * 6.0) - fnNoise(lp.xy * 14.0 + lp.z * 6.0 + vec2(0.07, 0.0));
            vec3 T = normalize(cross(Nw, vec3(0.0, 1.0, 0.0) + vec3(0.02, 0.0, 0.01)));
            vec3 B = cross(Nw, T);
            Nw = normalize(Nw + (T * strand * 0.35 + B * (strand * 0.25 + clump * 1.2)) * furWeight * 0.28);
            normal = normalize((viewMatrix * vec4(Nw, 0.0)).xyz);
          }
          // Eyes: iris ring, pupil, wet highlight.
          if (eye > 0.5) {
            vec3 axis = normalize(vFaunaEyeAxis + vec3(0.0001));
            float gaze = dot(nl2, axis);
            float pupil = smoothstep(0.86, 0.92, gaze);
            float iris = smoothstep(0.68, 0.74, gaze) * (1.0 - pupil);
            float irisRing = smoothstep(0.68, 0.72, gaze) * (1.0 - smoothstep(0.72, 0.78, gaze));
            vec3 irisColor = mix(vec3(0.5, 0.32, 0.12), uFaunaAccentColor * 1.3, kindDragonfly2 * 0.3 + uFaunaBioGlow * 0.35);
            irisColor *= 0.55 + 0.45 * fnNoise(vec2(atan(nl2.z, nl2.y) * 6.0, gaze * 40.0));
            float facet = smoothstep(0.55, 0.75, fnNoise(nl2.xy * 32.0 + nl2.z * 18.0)) * kindDragonfly2;
            diffuseColor.rgb = mix(diffuseColor.rgb, irisColor, iris * (1.0 - kindDragonfly2 * 0.8));
            diffuseColor.rgb = mix(diffuseColor.rgb, irisColor * 0.35, irisRing * (1.0 - kindDragonfly2));
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.012, 0.012, 0.014), pupil);
            diffuseColor.rgb = mix(diffuseColor.rgb, uFaunaAccentColor * 0.5, facet * 0.45);
            // Tapetum eyeshine when the moon is up.
            float shine = pow(max(dot(Nw, V), 0.0), 9.0) * night;
            vFaunaGlowTerm += mix(vec3(0.55, 0.62, 0.35), uFaunaAccentColor, 0.4) * shine * 0.5 * uFaunaBioGlow;
          }
          float rim = pow(clamp(1.0 - max(dot(Nw, V), 0.0), 0.0, 1.0), 2.25);
          float wrap = clamp((dot(Nw, uSunDir) + 0.42) / 1.42, 0.0, 1.0);
          float backlit = pow(clamp(dot(V, -uSunDir), 0.0, 1.0), 2.6);
          float moonBack = pow(clamp(dot(V, -uMoonDir), 0.0, 1.0), 2.8);
          diffuseColor.rgb = mix(diffuseColor.rgb * 0.82, diffuseColor.rgb, 0.48 + wrap * 0.52);
          // Fur sheen: soft fresnel glow in the coat's warm tone.
          vFaunaGlowTerm += uFaunaSheenColor * pow(rim, 0.8) * vFaunaSheen * (0.045 + 0.09 * daylight) * bodyMass;
          vFaunaGlowTerm += uFaunaRimColor * rim * (0.02 + 0.045 * daylight) * bodyMass * (1.0 - eye);
          vFaunaGlowTerm += uFaunaSSSColor * backlit * wrap * daylight * (0.035 + vFaunaFlex * 0.04) * bodyMass * (1.0 - eye);
          vFaunaGlowTerm += uFaunaSSSColor * (backlit * daylight * 0.12 + 0.02) * ear2 * mammal2;
          vFaunaGlowTerm += uFaunaSSSColor * moonBack * night * 0.014 * bodyMass;
          // Membranes: thin-film shimmer toward the edges.
          vec3 film = mix(uFaunaWingColor, uFaunaWingColor.gbr * 0.8 + uFaunaAccentColor * 0.3, pow(rim, 1.5));
          vFaunaGlowTerm += film * rim * membrane * (0.07 + vFaunaFlex * 0.08);
          // Chitin iridescence on the insect body.
          vFaunaGlowTerm += mix(uFaunaAccentColor, uFaunaWingColor, rim) * pow(rim, 1.4) * kindDragonfly2 * bodyMass * (1.0 - eye) * 0.14;
          // Bioluminescent markings wake at dusk: abdomen bands, lateral line and fin edges,
          // antler tips, ear tips, tail tip.
          float glowWake = dusk * uFaunaBioGlow;
          vec3 lp2 = vFaunaLocalPos;
          float bands2 = smoothstep(0.35, 0.65, abs(fract(lp2.x * 10.4 + 0.3) - 0.5));
          float lateral2 = 1.0 - smoothstep(0.004, 0.014, abs(lp2.y - 0.365 - sin(lp2.x * 3.0) * 0.008));
          float finEdge = smoothstep(0.7, 1.0, vFaunaFlex) * membrane;
          float bioPattern = bands2 * tail2 * kindDragonfly2 * 0.8
            + (lateral2 * (1.0 - membrane) + finEdge * 0.6) * kindFish2 * 0.7
            + horn * smoothstep(1.45, 1.62, lp2.y) * kindGrazer2 * 0.9
            + ear2 * smoothstep(0.8, 0.98, vFaunaFlex) * kindHopper2 * 0.6
            + tail2 * smoothstep(0.85, 1.0, vFaunaFlex) * kindRunner2 * 0.5;
          float pulse = 0.8 + 0.2 * sin(uTime * 1.3 + vFaunaSeed * 6.2831853 + lp2.x * 4.0);
          vFaunaGlowTerm += uFaunaAccentColor * bioPattern * glowWake * pulse * 0.5;
        }`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        {
          float eye = fnIs(vFaunaMaterialSlot, ${S.eye.toFixed(1)});
          float horn = fnIs(vFaunaMaterialSlot, ${S.horn.toFixed(1)});
          float hoof = fnIs(vFaunaMaterialSlot, ${S.hoof.toFixed(1)});
          float fleece = fnIs(vFaunaMaterialSlot, ${S.fleece.toFixed(1)});
          float skin = fnIs(vFaunaMaterialSlot, ${S.skin.toFixed(1)});
          float scale = fnIs(vFaunaMaterialSlot, ${S.scale.toFixed(1)});
          float membrane = fnIs(vFaunaMaterialSlot, ${S.membrane.toFixed(1)});
          float kindDragonfly3 = fnIs(uFaunaKind, ${K.dragonfly.toFixed(1)});
          roughnessFactor = mix(roughnessFactor, 0.08, eye * 0.95);
          roughnessFactor = mix(roughnessFactor, 0.42, horn * 0.7);
          roughnessFactor = mix(roughnessFactor, 0.5, hoof * 0.65);
          roughnessFactor = mix(roughnessFactor, 0.97, fleece * 0.85);
          roughnessFactor = mix(roughnessFactor, 0.62, skin * (1.0 - kindDragonfly3) * 0.5);
          roughnessFactor = mix(roughnessFactor, 0.34, skin * kindDragonfly3 * 0.8);
          roughnessFactor = mix(roughnessFactor, 0.36, scale * 0.6);
          roughnessFactor = mix(roughnessFactor, 0.24, membrane * 0.6);
          roughnessFactor = clamp(roughnessFactor, 0.05, 1.0);
        }`
      )
      .replace(
        '#include <metalnessmap_fragment>',
        `#include <metalnessmap_fragment>
        {
          float skin = fnIs(vFaunaMaterialSlot, ${S.skin.toFixed(1)});
          float scale = fnIs(vFaunaMaterialSlot, ${S.scale.toFixed(1)});
          float kindDragonfly4 = fnIs(uFaunaKind, ${K.dragonfly.toFixed(1)});
          metalnessFactor = max(metalnessFactor, skin * kindDragonfly4 * 0.3 + scale * 0.12);
        }`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += vFaunaGlowTerm;`
      )
      .replace(
        '#include <alphamap_fragment>',
        `#include <alphamap_fragment>
        diffuseColor.a *= clamp(uFaunaVisibility, 0.0, 1.0);`
      );
  };

  material.customProgramCacheKey = () => 'fauna-field-v10';
  return material;
}

/**
 * World-scale hierarchy anchored to the player (PLAYER_STANDING_HEIGHT = 3.6
 * world units ≈ 1.8m, so 1 wu ≈ 0.5m). Local geometry heights (head top):
 * grazer ~1.45, woolly ~0.9, runner ~0.85, hopper ~0.78. Targets:
 *  - grazer  (horse/elk)  ~3.0–3.5 wu tall — eye-level with the player.
 *  - woolly  (sheep/yak)  ~1.7–2.1 wu.
 *  - runner  (fox/hound)  ~1.15–1.45 wu.
 *  - hopper  (hare)       ~0.7–0.95 wu.
 *  - dragonfly            unchanged giant-insect scale.
 * `planetMul` is the per-planet faunaScaleBias multiplier from the art direction.
 */
export function faunaScaleForKind(kind: FaunaKind, scaleSeed: number, planetMul = 1): [number, number, number] {
  const baseScale = (
    kind === 'grazer' ? 1.95 + scaleSeed * 0.32 :
      kind === 'woolly' ? 1.85 + scaleSeed * 0.4 :
        kind === 'runner' ? 1.35 + scaleSeed * 0.35 :
          kind === 'dragonfly' ? 0.52 + scaleSeed * 0.18 :
            kind === 'fish' ? 0.55 + scaleSeed * 0.4 :
              0.87 + scaleSeed * 0.26
  ) * planetMul;
  const yScale = baseScale * (
    kind === 'dragonfly' ? 0.94 :
      kind === 'hopper' ? 1.08 :
        kind === 'grazer' ? 1.06 :
          kind === 'woolly' ? 1.04 :
          1
  );
  return [baseScale, yScale, baseScale];
}

function faunaSpeedForKind(kind: FaunaKind, profile: FaunaProfile, jitter: number): number {
  const climate = profile.biome.aridity * 0.16 + profile.biome.temperature * 0.1 - profile.biome.lushness * 0.06;
  // Bigger bodies cover more ground per stride; keep the ambient, unhurried feel.
  const base =
    kind === 'grazer' ? 0.6 :
      kind === 'woolly' ? 0.42 :
        kind === 'runner' ? 0.95 :
          kind === 'dragonfly' ? 1.2 :
            kind === 'fish' ? 0.55 :
              0.68;
  return Math.max(0.18, base + climate + (jitter - 0.5) * 0.16);
}

// Stride cycles per unit of travel — large animals take slower, longer steps.
function faunaStrideRateForKind(kind: FaunaKind): number {
  return FAUNA_SPECIES[kind].strideCyclesPerUnit;
}

export function faunaLevelTransitionLift(kind: FaunaKind, levelDelta: number, progress: number): number {
  const amount = Math.abs(levelDelta);
  if (amount < 0.001) return 0;
  const t = clamp(progress, 0, 1);
  const base =
    kind === 'dragonfly' ? 0.32 :
      kind === 'fish' ? 0.25 :
        kind === 'hopper' ? 0.42 :
          kind === 'runner' ? 0.22 :
            kind === 'woolly' ? 0.25 :
              0.28;
  return (base + Math.min(2, amount) * VOXEL_SCALE * 0.06) * Math.sin(Math.PI * t);
}

/**
 * Renderer-neutral handoff for one live agent. The current Three.js field and
 * future skinned/WebGPU adapters can consume the same stable simulation state.
 */
export function createFaunaRenderSnapshot(
  agent: FaunaAgent,
  time: number,
  planetScaleMul = 1
): FaunaRenderSnapshotV1 {
  const fleeing = time < agent.fleeUntil;
  const grazing = !fleeing && time < agent.grazeUntil;
  const behavior: FaunaBehavior = fleeing
    ? 'flee'
    : grazing
      ? 'graze'
      : agent.kind === 'dragonfly'
        ? 'fly'
        : agent.kind === 'fish'
          ? 'swim'
          : agent.kind === 'hopper'
            ? 'hop'
            : FAUNA_SPECIES[agent.kind].defaultBehavior;
  const t = clamp(agent.progress, 0, 1);
  const position = agent.from.clone().lerp(agent.to, t);
  const routeUp = FACE_NORMALS[dominantFaceForPosition(agent.from)].clone();
  position.addScaledVector(routeUp, faunaLevelTransitionLift(agent.kind, agentLevelDelta(agent), t));
  const up = FACE_NORMALS[dominantFaceForPosition(position)].clone();
  const forward = agent.to.clone().sub(agent.from);
  forward.addScaledVector(up, -forward.dot(up));
  if (forward.lengthSq() < 0.0001) deterministicTangentForUp(up, forward);
  else forward.normalize();
  const locomotionSpeed = grazing ? 0 : agent.speed * (fleeing ? FLEE_SPEED_MUL : 1);
  const velocity = forward.clone().multiplyScalar(locomotionSpeed);
  const scale = faunaScaleForKind(agent.kind, agent.scaleSeed, planetScaleMul);
  const phenotype = buildFaunaPhenotype(agent.terrainSeed, agent.kind);
  const pose = clampFaunaPose({
    ...emptyFaunaPose(),
    locomotion: locomotionSpeed > 0.001 ? 1 : 0,
    graze: agent.pose,
    alert: fleeing ? 1 : 0,
    flee: fleeing ? 1 : 0,
    hop: agent.kind === 'hopper' && !grazing ? 1 : 0,
    swim: agent.kind === 'fish' ? 1 : 0,
    wingbeat: agent.kind === 'dragonfly' ? 1 : 0,
    breathe: 1
  });
  return {
    schemaVersion: FAUNA_MODEL_SCHEMA_VERSION,
    agentId: `${agent.terrainSeed}:${agent.kind}:${agent.homeX}:${agent.homeY}:${agent.homeZ}`,
    kind: agent.kind,
    kindId: FAUNA_KIND_ID[agent.kind],
    morphologyId: phenotype.morphologyId,
    behavior,
    position: [position.x, position.y, position.z],
    rotation: [agent.orientation.x, agent.orientation.y, agent.orientation.z, agent.orientation.w],
    scale,
    velocity: [velocity.x, velocity.y, velocity.z],
    forward: [forward.x, forward.y, forward.z],
    up: [up.x, up.y, up.z],
    locomotionPhase: normalizeFaunaLocomotionPhase(agent.stridePhase),
    locomotionSpeed,
    pose
  };
}

function faunaAgentKey(kind: FaunaKind, x: number, y: number, z: number): string {
  return `${kind}:${x}:${y}:${z}`;
}

function faunaHomeKey(agent: FaunaAgent): string {
  return faunaAgentKey(agent.kind, agent.homeX, agent.homeY, agent.homeZ);
}

function computeFaunaAnchor(
  x: number,
  y: number,
  z: number,
  kind: FaunaKind,
  offsetU: number,
  offsetV: number,
  scaleSeed: number,
  target: THREE.Vector3
): THREE.Vector3 {
  voxelCoordToWorld(x, y, z, _world);
  _up.copy(FACE_NORMALS[dominantFaceForPosition(_world)]);
  deterministicTangentForUp(_up, _tangent);
  _bitangent.crossVectors(_up, _tangent).normalize();

  // Fish swim in the first water cell above the seabed (the wet-habitat check
  // guarantees that cell is flooded); dragonflies hover higher over ground.
  const hoverOffset =
    kind === 'dragonfly' ? 1.72 + scaleSeed * 0.42 :
      kind === 'fish' ? 1.3 + scaleSeed * 0.5 :
        FAUNA_SURFACE_OFFSET;
  const scatter = kind === 'dragonfly' ? 1.2 : kind === 'fish' ? 1.1 : 0.74;
  target.copy(_world);
  target.addScaledVector(_up, hoverOffset);
  target.addScaledVector(_tangent, offsetU * scatter);
  target.addScaledVector(_bitangent, offsetV * scatter);
  return target;
}

function surfaceNeighborSteps(x: number, y: number, z: number): Array<[number, number, number]> {
  voxelCoordToWorld(x, y, z, _world);
  const face = dominantFaceForPosition(_world);
  if (face === 'top' || face === 'bottom') return [[1, 0, 0], [0, 0, 1], [-1, 0, 0], [0, 0, -1]];
  if (face === 'left' || face === 'right') return [[0, 1, 0], [0, 0, 1], [0, -1, 0], [0, 0, -1]];
  return [[1, 0, 0], [0, 1, 0], [-1, 0, 0], [0, -1, 0]];
}

function surfaceUpCoordStep(x: number, y: number, z: number): [number, number, number] {
  voxelCoordToWorld(x, y, z, _world);
  const up = FACE_NORMALS[dominantFaceForPosition(_world)];
  return [
    Math.round(up.x),
    Math.round(up.y),
    Math.round(up.z)
  ];
}

export function hasFaunaBodyClearance(
  kind: FaunaKind,
  x: number,
  y: number,
  z: number,
  profile: FaunaProfile
): boolean {
  if (kind === 'dragonfly' || kind === 'fish') return true;
  const clearanceCells = faunaStructureClearanceCells(kind, profile);
  const [ux, uy, uz] = surfaceUpCoordStep(x, y, z);
  for (let step = 1; step <= clearanceCells; step++) {
    if (voxelSystem.getVoxel(x + ux * step, y + uy * step, z + uz * step)) return false;
  }
  return true;
}

/** Build-grid height occupied by a member of this species at the supplied size seed. */
export function faunaStructureClearanceCells(
  kind: FaunaKind,
  profile: FaunaProfile,
  scaleSeed = 0.5
): number {
  const [, yScale] = faunaScaleForKind(kind, scaleSeed, profile.scaleMul);
  return Math.max(1, Math.ceil(FAUNA_SPECIES[kind].bodyClearance * yScale / VOXEL_SCALE));
}

function mod4(n: number): number {
  return ((n % 4) + 4) % 4;
}

function findFaunaTravelCandidate(
  kind: FaunaKind,
  x: number,
  y: number,
  z: number,
  directionIndex: number,
  profile: FaunaProfile,
  obstacles?: FaunaNavigationObstacles
): [number, number, number] | null {
  const steps = surfaceNeighborSteps(x, y, z);
  const [sx, sy, sz] = steps[mod4(directionIndex)];
  const [ux, uy, uz] = surfaceUpCoordStep(x, y, z);
  const climbs = kind === 'dragonfly' ? [0, 1, -1, 2, -2] : [0, 1, -1];
  for (const climb of climbs) {
    const nx = x + sx + ux * climb;
    const ny = y + sy + uy * climb;
    const nz = z + sz + uz * climb;
    const voxel = voxelSystem.getVoxel(nx, ny, nz);
    if (!voxel || !isFaunaTravelVoxel(kind, voxel, profile)) continue;
    // Ground fauna never wade; fish never beach; dragonflies cross freely.
    if (!isFaunaHabitatVoxel(kind, nx, ny, nz, profile)) continue;
    if (!hasFaunaBodyClearance(kind, nx, ny, nz, profile)) continue;
    if (obstacles?.isAnchorBlocked(kind, nx, ny, nz)) continue;
    if (obstacles?.isRouteBlocked(kind, x, y, z, nx, ny, nz)) continue;
    return [nx, ny, nz];
  }
  return null;
}

// --- Herd behavior -----------------------------------------------------------
// Grazers and woollies drift into loose groups: when a route is chosen and the
// nearest same-kind animal is beyond the comfort band, most picks head toward
// it; when crowding, they separate. Inside the band they wander as before, so
// herds stay loose and organic instead of stacking into a clump.
const HERD_ATTRACT_DISTANCE = 9;
const HERD_SEPARATE_DISTANCE = 3.2;
const HERD_MAX_RANGE = 36;
const HERD_BIAS_CHANCE = 0.75;
const _herdDelta = new THREE.Vector3();
const _fleeDir = new THREE.Vector3();

// Grazing: on arriving at a voxel a herd animal may stop and put its head down.
// Seeing a nearby herd-mate grazing makes joining in much more likely, so herds
// drift into shared grazing pauses instead of milling constantly.
const GRAZE_CHANCE = 0.22;
const GRAZE_MATE_BONUS = 0.35;
const GRAZE_MIN_SECONDS = 2.6;
const GRAZE_VAR_SECONDS = 3.4;
const GRAZE_COOLDOWN_SECONDS = 6;

// Fleeing: a player rushing an animal (or looming right over it) startles it
// into a short burst directly away. Walking up slowly does not.
const FLEE_RADIUS = 8;
const FLEE_PANIC_RADIUS = 2.6;
const FLEE_APPROACH_SPEED = 3.2; // player speed toward the animal, wu/s
const FLEE_DURATION_SECONDS = 2.6;
const FLEE_SPEED_MUL = 2.6;

// Herding doubles as SCHOOLING for fish: same attract/separate steering.
function isHerdKind(kind: FaunaKind): boolean {
  return kind === 'grazer' || kind === 'woolly' || kind === 'fish';
}

// Only land herbivores stop to put their head down; fish school but never graze.
function isGrazeKind(kind: FaunaKind): boolean {
  return kind === 'grazer' || kind === 'woolly';
}

/** Surface-step index (0..3) best aligned with a world-space direction. */
function stepIndexTowardDelta(x: number, y: number, z: number, delta: THREE.Vector3): number {
  const steps = surfaceNeighborSteps(x, y, z);
  let best = -Infinity;
  let bestIndex = 0;
  for (let i = 0; i < steps.length; i++) {
    const [sx, sy, sz] = steps[i];
    const score = delta.x * sx + delta.y * sy + delta.z * sz;
    if (score > best) {
      best = score;
      bestIndex = i;
    }
  }
  return bestIndex;
}

/**
 * Surface-step index steering the agent toward (or away from) its nearest
 * herd-mate, or null when solitary/comfortable/out of range. Pure w.r.t. the
 * agents passed in; exported for tests.
 */
export function chooseHerdDirectionIndex(agent: FaunaAgent, herdmates: readonly FaunaAgent[]): number | null {
  if (!isHerdKind(agent.kind)) return null;
  let nearest: FaunaAgent | null = null;
  let bestDsq = Infinity;
  for (const other of herdmates) {
    if (other === agent || other.kind !== agent.kind) continue;
    const dsq = agent.to.distanceToSquared(other.to);
    if (dsq < bestDsq) {
      bestDsq = dsq;
      nearest = other;
    }
  }
  if (!nearest) return null;
  const dist = Math.sqrt(bestDsq);
  if (dist > HERD_MAX_RANGE) return null;
  let sign = 0;
  if (dist > HERD_ATTRACT_DISTANCE) sign = 1;
  else if (dist < HERD_SEPARATE_DISTANCE) sign = -1;
  else return null;

  voxelCoordToWorld(agent.x, agent.y, agent.z, _world);
  _herdDelta.copy(nearest.to).sub(_world).multiplyScalar(sign);
  return stepIndexTowardDelta(agent.x, agent.y, agent.z, _herdDelta);
}

function chooseFaunaNextVoxel(
  agent: FaunaAgent,
  terrainSeed: number,
  profile: FaunaProfile,
  herdmates?: readonly FaunaAgent[],
  fleeFrom?: THREE.Vector3 | null,
  obstacles?: FaunaNavigationObstacles
): [number, number, number] {
  const herdDir = !fleeFrom && herdmates ? chooseHerdDirectionIndex(agent, herdmates) : null;
  if (fleeFrom) {
    // Bolt directly away from the threat; the candidate scan below still finds
    // the nearest viable lane if the straight-away step is blocked.
    voxelCoordToWorld(agent.x, agent.y, agent.z, _world);
    _fleeDir.copy(_world).sub(fleeFrom);
    agent.directionIndex = mod4(stepIndexTowardDelta(agent.x, agent.y, agent.z, _fleeDir));
  } else if (herdDir !== null &&
    seededVoxelUnit(agent.x, agent.y, agent.z, agent.stepSalt + agent.stepCount + 7, terrainSeed) < HERD_BIAS_CHANCE) {
    agent.directionIndex = mod4(herdDir);
  } else {
    const turnRoll = seededVoxelUnit(agent.x, agent.y, agent.z, agent.stepSalt + agent.stepCount, terrainSeed);
    const turnFirst = turnRoll < 0.18 ? 1 : turnRoll < 0.36 ? -1 : 0;
    if (turnFirst !== 0) {
      const order = [agent.directionIndex + turnFirst, agent.directionIndex, agent.directionIndex - turnFirst, agent.directionIndex + 2];
      for (const candidateDir of order) {
        const candidate = findFaunaTravelCandidate(agent.kind, agent.x, agent.y, agent.z, candidateDir, profile, obstacles);
        if (!candidate) continue;
        agent.directionIndex = mod4(candidateDir);
        return candidate;
      }
      agent.directionIndex = mod4(agent.directionIndex + 2);
      return [agent.x, agent.y, agent.z];
    }
  }

  for (const candidateDir of [agent.directionIndex, agent.directionIndex + 1, agent.directionIndex - 1, agent.directionIndex + 2]) {
    const candidate = findFaunaTravelCandidate(agent.kind, agent.x, agent.y, agent.z, candidateDir, profile, obstacles);
    if (!candidate) continue;
    agent.directionIndex = mod4(candidateDir);
    return candidate;
  }

  agent.directionIndex = mod4(agent.directionIndex + 2);
  return [agent.x, agent.y, agent.z];
}

function setFaunaRoute(
  agent: FaunaAgent,
  terrainSeed: number,
  profile: FaunaProfile,
  herdmates?: readonly FaunaAgent[],
  fleeFrom?: THREE.Vector3 | null,
  obstacles?: FaunaNavigationObstacles
): void {
  agent.stepCount += 1;
  agent.x = agent.toX;
  agent.y = agent.toY;
  agent.z = agent.toZ;
  agent.from.copy(agent.to);
  const [nx, ny, nz] = chooseFaunaNextVoxel(agent, terrainSeed, profile, herdmates, fleeFrom, obstacles);
  agent.toX = nx;
  agent.toY = ny;
  agent.toZ = nz;
  computeFaunaAnchor(nx, ny, nz, agent.kind, agent.offsetU, agent.offsetV, agent.scaleSeed, agent.to);
  agent.navigationRevision = obstacles?.revision?.();
}

function createFaunaAgent(
  kind: FaunaKind,
  x: number,
  y: number,
  z: number,
  terrainSeed: number,
  profile: FaunaProfile,
  obstacles?: FaunaNavigationObstacles
): FaunaAgent {
  const offsetU = seededVoxelUnit(x, y, z, FAUNA_OFFSET_U_SALT, terrainSeed) - 0.5;
  const offsetV = seededVoxelUnit(x, y, z, FAUNA_OFFSET_V_SALT, terrainSeed) - 0.5;
  const scaleSeed = seededVoxelUnit(x, y, z, FAUNA_SCALE_SALT, terrainSeed);
  const directionIndex = Math.floor(seededVoxelUnit(x, y, z, FAUNA_YAW_SALT, terrainSeed) * 4);
  const agent: FaunaAgent = {
    kind,
    terrainSeed,
    homeX: x,
    homeY: y,
    homeZ: z,
    x,
    y,
    z,
    toX: x,
    toY: y,
    toZ: z,
    from: new THREE.Vector3(),
    to: new THREE.Vector3(),
    progress: seededVoxelUnit(x, y, z, FAUNA_DENSITY_SALT + 19, terrainSeed) * 0.82,
    directionIndex,
    speed: faunaSpeedForKind(kind, profile, seededVoxelUnit(x, y, z, FAUNA_PICK_SALT + 31, terrainSeed)),
    scaleSeed,
    tiltSeed: seededVoxelUnit(x, y, z, FAUNA_TILT_SALT, terrainSeed),
    offsetU,
    offsetV,
    phase: seededVoxelUnit(x, y, z, FAUNA_PICK_SALT + 47, terrainSeed) * Math.PI * 2,
    stridePhase: seededVoxelUnit(x, y, z, FAUNA_PICK_SALT + 61, terrainSeed),
    stepSalt: FAUNA_PICK_SALT + Math.floor(seededVoxelUnit(x, y, z, FAUNA_SCALE_SALT + 53, terrainSeed) * 4096),
    stepCount: 0,
    orientation: new THREE.Quaternion(),
    grazeUntil: 0,
    fleeUntil: 0,
    pose: 0
  };
  computeFaunaAnchor(x, y, z, kind, offsetU, offsetV, scaleSeed, agent.from);
  agent.to.copy(agent.from);
  setFaunaRoute(agent, terrainSeed, profile, undefined, undefined, obstacles);
  return agent;
}

function agentLevelDelta(agent: FaunaAgent): number {
  const [ux, uy, uz] = surfaceUpCoordStep(agent.x, agent.y, agent.z);
  return (agent.toX - agent.x) * ux + (agent.toY - agent.y) * uy + (agent.toZ - agent.z) * uz;
}

function computeFaunaAgentCullPosition(agent: FaunaAgent, target: THREE.Vector3): THREE.Vector3 {
  const t = clamp(agent.progress, 0, 1);
  return target.copy(agent.from).lerp(agent.to, t);
}

function isFaunaAgentVisibleInRange(
  agent: FaunaAgent,
  maxDistance: number,
  playerWorld: THREE.Vector3 | null
): boolean {
  if (maxDistance <= 0 || !playerWorld) return true;
  const padded = maxDistance + VOXEL_SCALE * 3;
  return computeFaunaAgentCullPosition(agent, _agentCullPos).distanceToSquared(playerWorld) <= padded * padded;
}

function isFaunaAgentStillValid(
  kind: FaunaKind,
  agent: FaunaAgent,
  density: number,
  terrainSeed: number,
  profile: FaunaProfile,
  obstacles?: FaunaNavigationObstacles
): boolean {
  if (agent.kind !== kind || agent.terrainSeed !== terrainSeed) return false;
  const homeVoxel = voxelSystem.getVoxel(agent.homeX, agent.homeY, agent.homeZ);
  const currentVoxel = voxelSystem.getVoxel(agent.x, agent.y, agent.z);
  const targetVoxel = voxelSystem.getVoxel(agent.toX, agent.toY, agent.toZ);
  if (!homeVoxel || !currentVoxel || !targetVoxel) return false;
  if (!shouldPlaceFaunaVoxel(homeVoxel, agent.homeX, agent.homeY, agent.homeZ, density, terrainSeed, profile)) return false;
  if (chooseFaunaKindForVoxel(homeVoxel, agent.homeX, agent.homeY, agent.homeZ, terrainSeed, profile) !== kind) return false;
  if (!isFaunaHabitatVoxel(kind, agent.x, agent.y, agent.z, profile) ||
    !isFaunaHabitatVoxel(kind, agent.toX, agent.toY, agent.toZ, profile)) return false;
  if (!hasFaunaBodyClearance(kind, agent.x, agent.y, agent.z, profile) ||
    !hasFaunaBodyClearance(kind, agent.toX, agent.toY, agent.toZ, profile)) return false;
  if (obstacles?.isAnchorBlocked(kind, agent.x, agent.y, agent.z) ||
    obstacles?.isAnchorBlocked(kind, agent.toX, agent.toY, agent.toZ)) return false;
  if ((agent.x !== agent.toX || agent.y !== agent.toY || agent.z !== agent.toZ) &&
    obstacles?.isRouteBlocked(kind, agent.x, agent.y, agent.z, agent.toX, agent.toY, agent.toZ)) return false;
  return isFaunaTravelVoxel(kind, currentVoxel, profile) && isFaunaTravelVoxel(kind, targetVoxel, profile);
}

function computeFaunaAgentMatrix(
  agent: FaunaAgent,
  time: number,
  rotationAlpha: number,
  target: THREE.Matrix4,
  planetScaleMul = 1
): THREE.Matrix4 {
  const t = clamp(agent.progress, 0, 1);
  _movePos.copy(agent.from).lerp(agent.to, t);
  _routeUp.copy(FACE_NORMALS[dominantFaceForPosition(agent.from)]);
  _movePos.addScaledVector(_routeUp, faunaLevelTransitionLift(agent.kind, agentLevelDelta(agent), t));
  _moveUp.copy(FACE_NORMALS[dominantFaceForPosition(_movePos)]);
  _moveForward.copy(agent.to).sub(agent.from);
  _moveForward.addScaledVector(_moveUp, -_moveForward.dot(_moveUp));
  if (_moveForward.lengthSq() < 0.0001) {
    deterministicTangentForUp(_moveUp, _moveForward);
  } else {
    _moveForward.normalize();
  }
  _moveSide.crossVectors(_moveForward, _moveUp);
  if (_moveSide.lengthSq() < 0.0001) {
    deterministicTangentForUp(_moveUp, _moveSide);
  } else {
    _moveSide.normalize();
  }

  if (agent.kind === 'dragonfly') {
    _movePos.addScaledVector(_moveUp, Math.sin(time * 1.7 + agent.phase) * 0.16);
    _movePos.addScaledVector(_moveSide, Math.sin(time * 0.83 + agent.phase * 0.7) * 0.1);
  } else if (agent.kind === 'fish') {
    // Buoyant drift: a slow rise-and-fall plus gentle lateral wander.
    _movePos.addScaledVector(_moveUp, Math.sin(time * 0.9 + agent.phase) * 0.14);
    _movePos.addScaledVector(_moveSide, Math.sin(time * 0.6 + agent.phase * 0.7) * 0.09);
  }

  _basis.makeBasis(_moveForward, _moveUp, _moveSide);
  _desiredQuat.setFromRotationMatrix(_basis);
  agent.orientation.slerp(_desiredQuat, clamp(rotationAlpha, 0, 1));
  const [sx, sy, sz] = faunaScaleForKind(agent.kind, agent.scaleSeed, planetScaleMul);
  _tiltQuat.setFromAxisAngle(_a.set(1, 0, 0), (agent.tiltSeed - 0.5) * (agent.kind === 'dragonfly' ? 0.18 : 0.08));
  _finalQuat.copy(agent.orientation).multiply(_tiltQuat);
  _scaleVec.set(sx, sy, sz);
  target.compose(_movePos, _finalQuat, _scaleVec);
  return target;
}

/** Arrival hook: a herd animal may stop to graze (much likelier beside a grazing mate). */
function maybeStartGrazing(
  agent: FaunaAgent,
  time: number,
  agents: readonly FaunaAgent[],
  terrainSeed: number
): boolean {
  if (!isGrazeKind(agent.kind)) return false;
  if (time < agent.grazeUntil + GRAZE_COOLDOWN_SECONDS) return false;
  let mateGrazing = false;
  for (const other of agents) {
    if (other === agent || other.kind !== agent.kind) continue;
    if (time < other.grazeUntil &&
      agent.to.distanceToSquared(other.to) < HERD_ATTRACT_DISTANCE * HERD_ATTRACT_DISTANCE) {
      mateGrazing = true;
      break;
    }
  }
  const chance = GRAZE_CHANCE + (mateGrazing ? GRAZE_MATE_BONUS : 0);
  const roll = seededVoxelUnit(agent.x, agent.y, agent.z, agent.stepSalt + agent.stepCount + 13, terrainSeed);
  if (roll > chance) return false;
  const durRoll = seededVoxelUnit(agent.x, agent.y, agent.z, agent.stepSalt + agent.stepCount + 17, terrainSeed);
  agent.grazeUntil = time + GRAZE_MIN_SECONDS + durRoll * GRAZE_VAR_SECONDS;
  return true;
}

/** Startle check: fast approach inside FLEE_RADIUS, or looming at point blank. */
function maybeStartFleeing(
  agent: FaunaAgent,
  time: number,
  playerWorld: THREE.Vector3,
  playerVelocity: THREE.Vector3 | null
): void {
  if (agent.kind === 'dragonfly' || time < agent.fleeUntil) return;
  computeFaunaAgentCullPosition(agent, _agentCullPos);
  const dsq = _agentCullPos.distanceToSquared(playerWorld);
  if (dsq >= FLEE_RADIUS * FLEE_RADIUS) return;
  const dist = Math.sqrt(Math.max(dsq, 1e-8));
  let threat = dist < FLEE_PANIC_RADIUS;
  if (!threat && playerVelocity) {
    _fleeDir.copy(_agentCullPos).sub(playerWorld).multiplyScalar(1 / dist);
    threat = playerVelocity.dot(_fleeDir) > FLEE_APPROACH_SPEED;
  }
  if (threat) {
    agent.fleeUntil = time + FLEE_DURATION_SECONDS;
    agent.grazeUntil = 0;
  }
}

function isFaunaRouteObstructed(
  agent: FaunaAgent,
  obstacles: FaunaNavigationObstacles
): boolean {
  if (obstacles.isAnchorBlocked(agent.kind, agent.x, agent.y, agent.z) ||
    obstacles.isAnchorBlocked(agent.kind, agent.toX, agent.toY, agent.toZ)) return true;
  if (agent.x === agent.toX && agent.y === agent.toY && agent.z === agent.toZ) return false;
  return obstacles.isRouteBlocked(
    agent.kind,
    agent.x,
    agent.y,
    agent.z,
    agent.toX,
    agent.toY,
    agent.toZ
  );
}

/**
 * Resolve a barrier that appeared during a stride without recreating the agent.
 * The visible position becomes the new interpolation origin, while the nearer
 * unblocked endpoint becomes the logical lane used to choose a deterministic
 * side-step. Gait phase, pose, and smoothed orientation are preserved.
 */
function replanObstructedFaunaRoute(
  agent: FaunaAgent,
  terrainSeed: number,
  profile: FaunaProfile,
  obstacles: FaunaNavigationObstacles,
  herdmates: readonly FaunaAgent[],
  fleeFrom: THREE.Vector3 | null,
  revision?: string
): void {
  _blockedRoutePos.copy(agent.from).lerp(agent.to, clamp(agent.progress, 0, 1));
  // Preserve the same level-transition arc used by the renderer. Ambient
  // dragonfly/fish oscillation remains shader-like motion and is reapplied once
  // by computeFaunaAgentMatrix on the new route.
  _routeUp.copy(FACE_NORMALS[dominantFaceForPosition(agent.from)]);
  _blockedRoutePos.addScaledVector(
    _routeUp,
    faunaLevelTransitionLift(agent.kind, agentLevelDelta(agent), clamp(agent.progress, 0, 1))
  );
  const targetBlocked = obstacles.isAnchorBlocked(agent.kind, agent.toX, agent.toY, agent.toZ);
  const currentBlocked = obstacles.isAnchorBlocked(agent.kind, agent.x, agent.y, agent.z);
  const settleAtTarget = !targetBlocked && (currentBlocked || agent.progress >= 0.5);
  if (settleAtTarget) {
    agent.x = agent.toX;
    agent.y = agent.toY;
    agent.z = agent.toZ;
  }

  agent.toX = agent.x;
  agent.toY = agent.y;
  agent.toZ = agent.z;
  computeFaunaAnchor(
    agent.x,
    agent.y,
    agent.z,
    agent.kind,
    agent.offsetU,
    agent.offsetV,
    agent.scaleSeed,
    agent.to
  );
  agent.stepCount += 1;
  const [nx, ny, nz] = chooseFaunaNextVoxel(
    agent,
    terrainSeed,
    profile,
    herdmates,
    fleeFrom,
    obstacles
  );
  agent.from.copy(_blockedRoutePos);
  agent.toX = nx;
  agent.toY = ny;
  agent.toZ = nz;
  computeFaunaAnchor(nx, ny, nz, agent.kind, agent.offsetU, agent.offsetV, agent.scaleSeed, agent.to);
  agent.progress = 0;
  agent.grazeUntil = 0;
  agent.navigationRevision = revision;
}

export function updateFaunaAgents(
  mesh: THREE.InstancedMesh,
  agents: FaunaAgent[],
  time: number,
  deltaTime: number,
  terrainSeed: number,
  profile = buildFaunaProfile(terrainSeed),
  playerWorld: THREE.Vector3 | null = null,
  playerVelocity: THREE.Vector3 | null = null,
  obstacles?: FaunaNavigationObstacles
): FaunaBuildResult {
  const dt = clamp(deltaTime, 0, 0.12);
  const count = Math.min(agents.length, mesh.instanceMatrix.count);
  const navigationRevision = obstacles?.revision?.();
  const strideAttr = mesh.geometry.getAttribute('aFaunaStride') as THREE.InstancedBufferAttribute | undefined;
  const poseAttr = mesh.geometry.getAttribute('aFaunaPose') as THREE.InstancedBufferAttribute | undefined;
  for (let i = 0; i < count; i++) {
    const agent = agents[i];
    if (playerWorld) maybeStartFleeing(agent, time, playerWorld, playerVelocity);
    const fleeing = time < agent.fleeUntil;
    const grazing = !fleeing && time < agent.grazeUntil;
    const fleeFrom = fleeing ? playerWorld : null;
    const speedMul = fleeing ? FLEE_SPEED_MUL : 1;
    const navigationChanged = obstacles !== undefined && (
      navigationRevision === undefined || agent.navigationRevision !== navigationRevision
    );
    if (obstacles && navigationChanged) {
      if (isFaunaRouteObstructed(agent, obstacles)) {
        replanObstructedFaunaRoute(
          agent,
          terrainSeed,
          profile,
          obstacles,
          agents,
          fleeFrom,
          navigationRevision
        );
      } else {
        agent.navigationRevision = navigationRevision;
      }
    }
    agent.pose += ((grazing ? 1 : 0) - agent.pose) * (1 - Math.exp(-5 * dt));

    const turnRate = agent.kind === 'dragonfly' ? 4.8 : agent.kind === 'woolly' ? 3.4 : 4.2;
    const rotationAlpha = 1 - Math.exp(-(fleeing ? turnRate * 1.6 : turnRate) * dt);
    const distance = agent.from.distanceTo(agent.to);
    if (grazing) {
      // Hold position, head down; the route resumes when the pause ends.
    } else if (distance > 0.001) {
      agent.stridePhase = (agent.stridePhase + dt * agent.speed * speedMul * faunaStrideRateForKind(agent.kind)) % 1;
      agent.progress += dt * agent.speed * speedMul / distance;
      while (agent.progress >= 1) {
        agent.progress -= 1;
        if (!fleeing && maybeStartGrazing(agent, time, agents, terrainSeed)) {
          agent.progress = 1;
          break;
        }
        setFaunaRoute(agent, terrainSeed, profile, agents, fleeFrom, obstacles);
        if (agent.from.distanceToSquared(agent.to) < 0.0001) {
          agent.progress = 0;
          break;
        }
      }
    } else {
      agent.progress = 0;
      setFaunaRoute(agent, terrainSeed, profile, agents, fleeFrom, obstacles);
    }
    if (strideAttr) strideAttr.setX(i, agent.stridePhase);
    if (poseAttr) poseAttr.setX(i, agent.pose);
    computeFaunaAgentMatrix(agent, time, rotationAlpha, _scratch, profile.scaleMul);
    mesh.setMatrixAt(i, _scratch);
  }
  mesh.count = count;
  mesh.instanceMatrix.needsUpdate = true;
  if (strideAttr) strideAttr.needsUpdate = true;
  if (poseAttr) poseAttr.needsUpdate = true;
  return { count, voxelCount: count, agents };
}

export function buildFaunaInstances(
  kind: FaunaKind,
  mesh: THREE.InstancedMesh,
  density: number,
  maxDistance: number,
  playerWorld: THREE.Vector3 | null,
  terrainSeed: number,
  profile = buildFaunaProfile(terrainSeed),
  options: FaunaBuildOptions = {}
): FaunaBuildResult {
  const capacity = mesh.instanceMatrix.count;
  const maxDistSq = maxDistance * maxDistance;
  const seedAttr = prepareFaunaInstanceAttributes(mesh.geometry, capacity);
  const strideAttr = mesh.geometry.getAttribute('aFaunaStride') as THREE.InstancedBufferAttribute;
  const poseAttr = mesh.geometry.getAttribute('aFaunaPose') as THREE.InstancedBufferAttribute;
  const agents: FaunaAgent[] = [];
  const includedHomes = new Set<string>();
  const time = options.time ?? 0;
  const obstacles = options.obstacles;

  if (density <= 0) {
    mesh.count = 0;
    mesh.instanceMatrix.needsUpdate = true;
    return { count: 0, voxelCount: 0, agents };
  }

  const addAgent = (agent: FaunaAgent, preserveOrientation: boolean) => {
    if (agents.length >= capacity) return;
    computeFaunaAgentMatrix(agent, time, preserveOrientation ? 0 : 1, _scratch, profile.scaleMul);
    mesh.setMatrixAt(agents.length, _scratch);
    seedAttr.setX(agents.length, agent.phase / TAU);
    strideAttr.setX(agents.length, agent.stridePhase);
    poseAttr.setX(agents.length, agent.pose);
    includedHomes.add(faunaHomeKey(agent));
    agents.push(agent);
  };

  for (const agent of options.existingAgents ?? []) {
    if (agents.length >= capacity) break;
    if (!isFaunaAgentStillValid(kind, agent, density, terrainSeed, profile, obstacles)) continue;
    if (!isFaunaAgentVisibleInRange(agent, maxDistance, playerWorld)) continue;
    agent.navigationRevision = obstacles?.revision?.();
    addAgent(agent, true);
  }

  for (const voxel of voxelSystem.voxelValues()) {
    if (agents.length >= capacity) break;
    const [x, y, z] = voxel.position;
    if (includedHomes.has(faunaAgentKey(kind, x, y, z))) continue;
    if (!shouldPlaceFaunaVoxel(voxel, x, y, z, density, terrainSeed, profile)) continue;
    if (!isFaunaHabitatVoxel(kind, x, y, z, profile)) continue;
    if (!hasFaunaBodyClearance(kind, x, y, z, profile)) continue;
    if (obstacles?.isAnchorBlocked(kind, x, y, z)) continue;
    if (chooseFaunaKindForVoxel(voxel, x, y, z, terrainSeed, profile) !== kind) continue;
    if (!isFaunaTravelVoxel(kind, voxel, profile)) continue;

    voxelCoordToWorld(x, y, z, _world);
    if (maxDistance > 0 && playerWorld && _world.distanceToSquared(playerWorld) > maxDistSq) continue;

    const agent = createFaunaAgent(kind, x, y, z, terrainSeed, profile, obstacles);
    addAgent(agent, false);
  }

  mesh.count = agents.length;
  mesh.instanceMatrix.needsUpdate = true;
  seedAttr.needsUpdate = true;
  strideAttr.needsUpdate = true;
  poseAttr.needsUpdate = true;
  return { count: agents.length, voxelCount: agents.length, agents };
}

export function applyFaunaWindProfileToMaterial(profile: WindProfile, material: THREE.Material): void {
  const u = (material.userData.shader as
    | { uniforms?: Record<string, { value: unknown }> }
    | undefined)?.uniforms;
  if (!u) return;
  if (u.uWindStrength) (u.uWindStrength.value as number) = profile.strength;
  if (u.uWindGustStrength) (u.uWindGustStrength.value as number) = profile.gustStrength;
  if (u.uWindGustScale) (u.uWindGustScale.value as number) = profile.gustScale;
  if (u.uWindGustSpeed) (u.uWindGustSpeed.value as number) = profile.gustSpeed;
  if (u.uWindTurbulence) (u.uWindTurbulence.value as number) = profile.turbulence;
  if (u.uWindDir) (u.uWindDir.value as THREE.Vector2).copy(profile.direction);
  if (u.uWindOffset) (u.uWindOffset.value as THREE.Vector2).copy(profile.offset);
}

export function updateFaunaMaterial(
  material: THREE.Material,
  time: number,
  quality: GraphicsQuality,
  reality: VoxelRealityEffects,
  sunDir?: THREE.Vector3,
  moonDir?: THREE.Vector3
): void {
  const u = (material.userData.shader as
    | { uniforms?: Record<string, { value: unknown }> }
    | undefined)?.uniforms;
  if (!u) return;
  if (u.uTime && quality.animatedShaders) (u.uTime.value as number) = time;
  if (u.uFaunaVisibility) {
    (u.uFaunaVisibility.value as number) = Math.min(1.12, Math.max(0, reality.organic * 0.92 + reality.detail * 0.18));
  }
  if (u.uFaunaMotion) {
    (u.uFaunaMotion.value as number) = quality.animatedShaders
      ? Math.min(1.25, Math.max(0, reality.organic * 0.58 + reality.atmosphere * 0.48))
      : 0;
  }
  if (u.uFaunaChroma) {
    (u.uFaunaChroma.value as number) = Math.min(1, Math.max(0, reality.chroma));
  }
  if (u.uFaunaDetail) {
    (u.uFaunaDetail.value as number) = faunaShaderDetailForProfile(getQualityProfile());
  }
  if (sunDir && u.uSunDir) {
    (u.uSunDir.value as THREE.Vector3).copy(sunDir).normalize();
  }
  if (moonDir && u.uMoonDir) {
    (u.uMoonDir.value as THREE.Vector3).copy(moonDir).normalize();
  }
}

export function currentFaunaDensity(): number {
  return getGraphicsQuality().faunaDensity;
}
