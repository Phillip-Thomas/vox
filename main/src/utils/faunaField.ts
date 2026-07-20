import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { getGraphicsQuality, type GraphicsQuality } from '../config/graphicsSettings';
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
  type FaunaJoint,
  type FaunaKind,
  type FaunaMaterialSlot,
  type FaunaPhenotype,
  type FaunaRegion,
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
  for (const voxel of voxelSystem.getAllVoxels().values()) {
    const [x, y, z] = voxel.position;
    if (!shouldPlaceFaunaVoxel(voxel, x, y, z, density, terrainSeed, profile)) continue;
    if (!isFaunaHabitatVoxel(kind, x, y, z, profile)) continue;
    if (!hasFaunaBodyClearance(kind, x, y, z, profile)) continue;
    if (obstacles?.isAnchorBlocked(kind, x, y, z)) continue;
    if (chooseFaunaKindForVoxel(voxel, x, y, z, terrainSeed, profile) === kind) n++;
  }
  return n;
}

interface FaunaVertexSemantics {
  region?: FaunaRegion;
  joint?: FaunaJoint;
  jointPivot?: THREE.Vector3;
  jointWeight?: number;
  bendPivot?: THREE.Vector3;
  bendWeight?: number;
  materialSlot?: FaunaMaterialSlot;
}

function defaultRegionForPart(part: number): FaunaRegion {
  if (part < 0.5) return 'body';
  if (part < 1.5) return 'head';
  if (part < 2.5) return 'frontLimb';
  if (part < 3.5) return 'hindLimb';
  if (part < 4.5) return 'tail';
  return 'wing';
}

function defaultMaterialForRegion(region: FaunaRegion): FaunaMaterialSlot {
  if (region === 'eye') return 'eye';
  if (region === 'horn') return 'horn';
  if (region === 'hoof') return 'hoof';
  if (region === 'fleece') return 'fleece';
  if (region === 'wing' || region === 'fin') return 'membrane';
  return 'coat';
}

function addAttributes(
  geo: THREE.BufferGeometry,
  color: THREE.Color,
  part: number,
  flexMul: number,
  semantics: FaunaVertexSemantics = {}
): THREE.BufferGeometry {
  const work = geo;
  work.computeVertexNormals();
  work.computeBoundingBox();
  const box = work.boundingBox;
  const minY = box?.min.y ?? 0;
  const spanY = Math.max(0.001, (box?.max.y ?? 1) - minY);
  const pos = work.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const flex = new Float32Array(pos.count);
  const surface = new Float32Array(pos.count * 4);
  const jointPivots = new Float32Array(pos.count * 3);
  const bends = new Float32Array(pos.count * 4);
  const region = semantics.region ?? defaultRegionForPart(part);
  const joint = semantics.joint ?? 'root';
  const jointPivot = semantics.jointPivot ?? _a.set(0, 0, 0);
  const jointWeight = clamp(semantics.jointWeight ?? 0, 0, 1);
  const bendPivot = semantics.bendPivot ?? jointPivot;
  const bendWeight = clamp(semantics.bendWeight ?? 0, 0, 1);
  const materialSlot = semantics.materialSlot ?? defaultMaterialForRegion(region);
  for (let i = 0; i < pos.count; i++) {
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
    flex[i] = clamp(((pos.getY(i) - minY) / spanY) * flexMul, 0, 1);
    surface[i * 4] = FAUNA_REGION_ID[region];
    surface[i * 4 + 1] = FAUNA_JOINT_ID[joint];
    surface[i * 4 + 2] = jointWeight;
    surface[i * 4 + 3] = FAUNA_MATERIAL_SLOT_ID[materialSlot];
    jointPivots[i * 3] = jointPivot.x;
    jointPivots[i * 3 + 1] = jointPivot.y;
    jointPivots[i * 3 + 2] = jointPivot.z;
    bends[i * 4] = bendPivot.x;
    bends[i * 4 + 1] = bendPivot.y;
    bends[i * 4 + 2] = bendPivot.z;
    bends[i * 4 + 3] = bendWeight;
  }
  if (!work.getAttribute('uv')) {
    const uv = new Float32Array(pos.count * 2);
    const minX = box?.min.x ?? -1;
    const minZ = box?.min.z ?? -1;
    const spanX = Math.max(0.001, (box?.max.x ?? 1) - minX);
    const spanZ = Math.max(0.001, (box?.max.z ?? 1) - minZ);
    for (let i = 0; i < pos.count; i++) {
      uv[i * 2] = (pos.getX(i) - minX) / spanX;
      uv[i * 2 + 1] = (pos.getZ(i) - minZ) / spanZ;
    }
    work.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  }
  work.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  work.setAttribute('aFaunaFlex', new THREE.BufferAttribute(flex, 1));
  // Packed to keep the WebGL instanced adapter below the guaranteed 16-attribute ceiling:
  // x=region, y=joint, z=joint weight, w=material slot.
  work.setAttribute('aFaunaSurface', new THREE.BufferAttribute(surface, 4));
  work.setAttribute('aFaunaJointPivot', new THREE.BufferAttribute(jointPivots, 3));
  work.setAttribute('aFaunaBend', new THREE.BufferAttribute(bends, 4));
  return work;
}

interface FaunaLoftRing {
  x: number;
  y: number;
  z?: number;
  halfHeight: number;
  halfWidth: number;
  topHeight?: number;
  bottomDepth?: number;
  cap?: boolean;
  ruffle?: number;
  rufflePhase?: number;
}

/** Connected ring loft used for torsos, heads, necks, tails, and aquatic bodies. */
function loftHull(
  rings: readonly FaunaLoftRing[],
  color: THREE.Color,
  part: number,
  flexMul: number,
  semantics: FaunaVertexSemantics,
  radialSegments = 8
): THREE.BufferGeometry {
  const ringCount = Math.max(2, rings.length);
  const verticesPerRing = radialSegments;
  const ringVertexCount = ringCount * verticesPerRing;
  const positions = new Float32Array((ringVertexCount + 2) * 3);
  const centers = rings.map(ring => new THREE.Vector3(ring.x, ring.y, ring.z ?? 0));
  const tangents = centers.map((_center, index) => new THREE.Vector3()
    .copy(centers[Math.min(centers.length - 1, index + 1)])
    .sub(centers[Math.max(0, index - 1)])
    .normalize());
  for (let r = 0; r < ringCount; r++) {
    const ring = rings[Math.min(r, rings.length - 1)];
    const tangent = tangents[r];
    const lateral = Math.abs(tangent.z) > 0.88
      ? new THREE.Vector3(1, 0, 0)
      : new THREE.Vector3(0, 0, 1);
    const vertical = new THREE.Vector3().crossVectors(lateral, tangent).normalize();
    lateral.crossVectors(tangent, vertical).normalize();
    for (let s = 0; s < radialSegments; s++) {
      const angle = (s / radialSegments) * TAU;
      const index = (r * verticesPerRing + s) * 3;
      const ruffle = ring.ruffle ?? 0;
      const irregularity = 1 + ruffle * (
        Math.sin(angle * 3 + (ring.rufflePhase ?? r * 0.71)) * 0.62
        + Math.sin(angle * 5 - r * 0.47) * 0.38
      );
      const verticalExtent = Math.cos(angle) >= 0
        ? (ring.topHeight ?? ring.halfHeight)
        : (ring.bottomDepth ?? ring.halfHeight);
      _a.copy(centers[r])
        .addScaledVector(vertical, Math.cos(angle) * verticalExtent * irregularity)
        .addScaledVector(lateral, Math.sin(angle) * ring.halfWidth * irregularity);
      positions[index] = _a.x;
      positions[index + 1] = _a.y;
      positions[index + 2] = _a.z;
    }
  }
  const firstRing = rings[0];
  const lastRing = rings[rings.length - 1];
  positions[ringVertexCount * 3] = firstRing.x;
  positions[ringVertexCount * 3 + 1] = firstRing.y;
  positions[ringVertexCount * 3 + 2] = firstRing.z ?? 0;
  positions[(ringVertexCount + 1) * 3] = lastRing.x;
  positions[(ringVertexCount + 1) * 3 + 1] = lastRing.y;
  positions[(ringVertexCount + 1) * 3 + 2] = lastRing.z ?? 0;
  const indices: number[] = [];
  for (let r = 0; r < ringCount - 1; r++) {
    for (let s = 0; s < radialSegments; s++) {
      const next = (s + 1) % radialSegments;
      const a = r * verticesPerRing + s;
      const b = r * verticesPerRing + next;
      const c = (r + 1) * verticesPerRing + s;
      const d = (r + 1) * verticesPerRing + next;
      indices.push(a, b, c, b, d, c);
    }
  }
  const startCenter = ringVertexCount;
  const endCenter = ringVertexCount + 1;
  for (let s = 0; s < radialSegments; s++) {
    const next = (s + 1) % radialSegments;
    if (firstRing.cap !== false) indices.push(startCenter, next, s);
    const last = (ringCount - 1) * verticesPerRing;
    if (lastRing.cap !== false) indices.push(endCenter, last + s, last + next);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  return addAttributes(geometry, color, part, flexMul, semantics);
}

/** Continuous tapered tube along authored joints; avoids disconnected limb beads. */
function limbTube(
  points: readonly THREE.Vector3[],
  radii: readonly number[],
  color: THREE.Color,
  part: number,
  semantics: FaunaVertexSemantics,
  radialSegments = 5,
  caps: readonly [start: boolean, end: boolean] = [true, true]
): THREE.BufferGeometry {
  const count = Math.max(2, points.length);
  const ringVertexCount = count * radialSegments;
  const positions = new Float32Array((ringVertexCount + 2) * 3);
  const tangent = new THREE.Vector3();
  const side = new THREE.Vector3();
  const binormal = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    tangent.copy(next).sub(prev).normalize();
    side.set(0, 0, 1);
    if (Math.abs(tangent.z) > 0.88) side.set(0, 1, 0);
    binormal.crossVectors(tangent, side).normalize();
    side.crossVectors(binormal, tangent).normalize();
    const radius = radii[Math.min(i, radii.length - 1)];
    for (let s = 0; s < radialSegments; s++) {
      const angle = (s / radialSegments) * TAU;
      const index = (i * radialSegments + s) * 3;
      _a.copy(points[i])
        .addScaledVector(side, Math.cos(angle) * radius)
        .addScaledVector(binormal, Math.sin(angle) * radius);
      positions[index] = _a.x;
      positions[index + 1] = _a.y;
      positions[index + 2] = _a.z;
    }
  }
  positions[ringVertexCount * 3] = points[0].x;
  positions[ringVertexCount * 3 + 1] = points[0].y;
  positions[ringVertexCount * 3 + 2] = points[0].z;
  const lastPoint = points[points.length - 1];
  positions[(ringVertexCount + 1) * 3] = lastPoint.x;
  positions[(ringVertexCount + 1) * 3 + 1] = lastPoint.y;
  positions[(ringVertexCount + 1) * 3 + 2] = lastPoint.z;
  const indices: number[] = [];
  for (let i = 0; i < count - 1; i++) {
    for (let s = 0; s < radialSegments; s++) {
      const next = (s + 1) % radialSegments;
      const a = i * radialSegments + s;
      const b = i * radialSegments + next;
      const c = (i + 1) * radialSegments + s;
      const d = (i + 1) * radialSegments + next;
      indices.push(a, b, c, b, d, c);
    }
  }
  const startCenter = ringVertexCount;
  const endCenter = ringVertexCount + 1;
  const lastRing = (count - 1) * radialSegments;
  for (let s = 0; s < radialSegments; s++) {
    const next = (s + 1) % radialSegments;
    if (caps[0]) indices.push(startCenter, next, s);
    if (caps[1]) indices.push(endCenter, lastRing + s, lastRing + next);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  return addAttributes(geometry, color, part, 1, semantics);
}

function finFan(
  base: THREE.Vector3 | readonly [THREE.Vector3, THREE.Vector3],
  outline: readonly THREE.Vector3[],
  color: THREE.Color,
  semantics: FaunaVertexSemantics,
  halfThickness = 0.006
): THREE.BufferGeometry {
  const polygon = base instanceof THREE.Vector3
    ? [base, ...outline]
    : [base[0], ...outline, base[1]];
  const normal = new THREE.Vector3();
  for (let index = 0; index < polygon.length; index++) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    normal.x += (current.y - next.y) * (current.z + next.z);
    normal.y += (current.z - next.z) * (current.x + next.x);
    normal.z += (current.x - next.x) * (current.y + next.y);
  }
  if (normal.lengthSq() < 1e-8) normal.set(0, 0, 1);
  else normal.normalize();
  const positions: number[] = [];
  const indices: number[] = [];
  const sideVertexCount = polygon.length;
  for (let side = 0; side < 2; side++) {
    const offset = side === 0 ? halfThickness : -halfThickness;
    for (const point of polygon) {
      positions.push(
        point.x + normal.x * offset,
        point.y + normal.y * offset,
        point.z + normal.z * offset
      );
    }
  }
  for (let i = 1; i < polygon.length - 1; i++) {
    indices.push(0, i, i + 1);
    indices.push(sideVertexCount, sideVertexCount + i + 1, sideVertexCount + i);
  }
  for (let i = 0; i < polygon.length; i++) {
    const next = (i + 1) % polygon.length;
    indices.push(i, sideVertexCount + i, next);
    indices.push(next, sideVertexCount + i, sideVertexCount + next);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  return addAttributes(geometry, color, 4, 1, semantics);
}

function ellipsoid(
  center: THREE.Vector3,
  scale: THREE.Vector3,
  color: THREE.Color,
  part: number,
  flexMul: number,
  detail = 0,
  semantics: FaunaVertexSemantics = {}
): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(1, detail > 0 ? 8 : 6, detail > 0 ? 5 : 4);
  geo.scale(scale.x, scale.y, scale.z);
  geo.translate(center.x, center.y, center.z);
  return addAttributes(geo, color, part, flexMul, semantics);
}

function leafAppendage(
  root: THREE.Vector3,
  tip: THREE.Vector3,
  halfWidth: number,
  thickness: number,
  color: THREE.Color,
  semantics: FaunaVertexSemantics
): THREE.BufferGeometry {
  const centers = [
    root,
    root.clone().lerp(tip, 0.56).add(new THREE.Vector3(-halfWidth * 0.12, halfWidth * 0.08, 0)),
    tip
  ];
  const widths = [halfWidth * 0.38, halfWidth, halfWidth * 0.055];
  const depths = [thickness * 0.7, thickness, thickness * 0.35];
  const positions = new Float32Array(centers.length * 4 * 3);
  const tangent = tip.clone().sub(root).normalize();
  const widthAxis = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 0, 1), tangent).normalize();
  const depthAxis = new THREE.Vector3().crossVectors(tangent, widthAxis).normalize();
  centers.forEach((center, ring) => {
    const corners: Array<[number, number]> = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
    corners.forEach(([widthSign, depthSign], corner) => {
      _a.copy(center)
        .addScaledVector(widthAxis, widths[ring] * widthSign)
        .addScaledVector(depthAxis, depths[ring] * depthSign);
      const offset = (ring * 4 + corner) * 3;
      positions[offset] = _a.x;
      positions[offset + 1] = _a.y;
      positions[offset + 2] = _a.z;
    });
  });
  const indices: number[] = [];
  for (let ring = 0; ring < centers.length - 1; ring++) {
    for (let side = 0; side < 4; side++) {
      const next = (side + 1) % 4;
      const a = ring * 4 + side;
      const b = ring * 4 + next;
      const c = (ring + 1) * 4 + side;
      const d = (ring + 1) * 4 + next;
      indices.push(a, b, c, b, d, c);
    }
  }
  indices.push(0, 2, 1, 0, 3, 2);
  const last = (centers.length - 1) * 4;
  indices.push(last, last + 1, last + 2, last, last + 2, last + 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  return addAttributes(geometry, color, 4, 1, semantics);
}

function wedgeFoot(
  center: THREE.Vector3,
  length: number,
  height: number,
  width: number,
  color: THREE.Color,
  part: number,
  semantics: FaunaVertexSemantics
): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  for (let index = 0; index < position.count; index++) {
    const localX = position.getX(index);
    const front = localX + 0.5;
    const widthScale = 1 - front * 0.28;
    const heightScale = 1 - front * 0.22;
    position.setXYZ(
      index,
      center.x + localX * length,
      center.y + position.getY(index) * height * heightScale,
      center.z + position.getZ(index) * width * widthScale
    );
  }
  position.needsUpdate = true;
  return addAttributes(geometry, color, part, 0.15, semantics);
}

/** Cambered, high-aspect insect wing. Only the dragonfly renderer uses this helper. */
function wingSheet(
  rootX: number,
  rootY: number,
  rootZ: number,
  side: number,
  chord: number,
  span: number,
  sweep: number,
  color: THREE.Color
): THREE.BufferGeometry {
  const spanStops = [0, 0.18, 0.43, 0.72, 1];
  const chordScale = [0.16, 0.72, 1, 0.72, 0.06];
  const positions = new Float32Array(spanStops.length * 3 * 3);
  const uv = new Float32Array(spanStops.length * 3 * 2);
  for (let station = 0; station < spanStops.length; station++) {
    const t = spanStops[station];
    const centerX = rootX + sweep * t - chord * 0.05 * Math.sin(Math.PI * t);
    const halfChord = chord * chordScale[station] * 0.5;
    const camber = Math.sin(Math.PI * t) * 0.014;
    for (let row = 0; row < 3; row++) {
      const chordPosition = 1 - row;
      const vertex = station * 3 + row;
      positions[vertex * 3] = centerX + halfChord * chordPosition;
      positions[vertex * 3 + 1] = rootY + camber + (row === 1 ? 0.006 : 0);
      positions[vertex * 3 + 2] = rootZ + side * span * t;
      uv[vertex * 2] = row * 0.5;
      uv[vertex * 2 + 1] = t;
    }
  }
  const indices: number[] = [];
  for (let station = 0; station < spanStops.length - 1; station++) {
    for (let row = 0; row < 2; row++) {
      const a = station * 3 + row;
      const b = a + 1;
      const c = (station + 1) * 3 + row;
      const d = c + 1;
      if (side > 0) indices.push(a, c, b, b, c, d);
      else indices.push(a, b, c, b, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(indices);
  const work = geo;
  work.computeVertexNormals();
  const pos = work.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const flex = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
    flex[i] = clamp(Math.abs(pos.getZ(i) - rootZ) / Math.max(0.001, span), 0, 1);
  }
  work.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  work.setAttribute('aFaunaFlex', new THREE.BufferAttribute(flex, 1));
  const pivot = new Float32Array(pos.count * 3);
  const bend = new Float32Array(pos.count * 4);
  const surface = new Float32Array(pos.count * 4);
  for (let i = 0; i < pos.count; i++) {
    pivot[i * 3] = rootX;
    pivot[i * 3 + 1] = rootY;
    pivot[i * 3 + 2] = rootZ;
    bend[i * 4] = rootX;
    bend[i * 4 + 1] = rootY;
    bend[i * 4 + 2] = rootZ;
    surface[i * 4] = FAUNA_REGION_ID.wing;
    surface[i * 4 + 1] = FAUNA_JOINT_ID[side > 0 ? 'leftWing' : 'rightWing'];
    surface[i * 4 + 2] = flex[i];
    surface[i * 4 + 3] = FAUNA_MATERIAL_SLOT_ID.membrane;
  }
  work.setAttribute('aFaunaSurface', new THREE.BufferAttribute(surface, 4));
  work.setAttribute('aFaunaJointPivot', new THREE.BufferAttribute(pivot, 3));
  work.setAttribute('aFaunaBend', new THREE.BufferAttribute(bend, 4));
  return work;
}

/** Applies head/tail semantics to the fish's single connected hull. */
function finishFishHull(
  geometry: THREE.BufferGeometry,
  headColor: THREE.Color,
  headStartX: number,
  noseX: number,
  tailStartX: number,
  tailTipX: number,
  tailPivot: THREE.Vector3
): THREE.BufferGeometry {
  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  const color = geometry.getAttribute('color') as THREE.BufferAttribute;
  const surface = geometry.getAttribute('aFaunaSurface') as THREE.BufferAttribute;
  const pivot = geometry.getAttribute('aFaunaJointPivot') as THREE.BufferAttribute;
  for (let index = 0; index < position.count; index++) {
    const x = position.getX(index);
    if (x >= headStartX) {
      const amount = clamp((x - headStartX) / Math.max(0.001, noseX - headStartX), 0, 1);
      const blend = amount * amount * (3 - 2 * amount);
      color.setXYZ(
        index,
        color.getX(index) + (headColor.r - color.getX(index)) * blend,
        color.getY(index) + (headColor.g - color.getY(index)) * blend,
        color.getZ(index) + (headColor.b - color.getZ(index)) * blend
      );
      surface.setX(index, FAUNA_REGION_ID.head);
    } else if (x <= tailStartX) {
      const weight = clamp((tailStartX - x) / Math.max(0.001, tailStartX - tailTipX), 0, 1);
      surface.setXYZW(index, FAUNA_REGION_ID.tail, FAUNA_JOINT_ID.tail, weight, FAUNA_MATERIAL_SLOT_ID.scale);
      pivot.setXYZ(index, tailPivot.x, tailPivot.y, tailPivot.z);
    }
  }
  color.needsUpdate = true;
  surface.needsUpdate = true;
  pivot.needsUpdate = true;
  return geometry;
}

function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const geo = mergeGeometries(parts, false);
  if (!geo) throw new Error('Failed to merge fauna geometry');
  geo.computeVertexNormals();
  return geo;
}

function articulatedLeg(
  chain: readonly [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3],
  color: THREE.Color,
  part: number,
  radius: number,
  footLength = radius * 3.4,
  footWidth = radius * 2.25
): THREE.BufferGeometry[] {
  const [hip, knee, hock, foot] = chain;
  const z = hip.z;
  const joint: FaunaJoint = part === 2
    ? (z > 0 ? 'frontLeft' : 'frontRight')
    : (z > 0 ? 'hindLeft' : 'hindRight');
  const region = part === 2 ? 'frontLimb' : 'hindLimb';
  const common: FaunaVertexSemantics = {
    region,
    joint,
    jointPivot: hip,
    jointWeight: 1,
    materialSlot: 'skin'
  };
  const upperOverlap = knee.clone().lerp(hock, 0.055);
  const lowerOverlap = knee.clone().lerp(hip, 0.055);
  return [
    limbTube(
      [hip, knee, upperOverlap],
      [radius * 1.18, radius, radius * 0.98],
      color,
      part,
      common,
      4,
      [true, false]
    ),
    limbTube(
      [lowerOverlap, knee, hock, foot],
      [radius * 1.04, radius * 1.02, radius * 0.76, radius * 0.62],
      color,
      part,
      { ...common, bendPivot: knee, bendWeight: 1 },
      4,
      [false, true]
    ),
    wedgeFoot(
      new THREE.Vector3(foot.x + radius * 1.5, foot.y, foot.z),
      footLength,
      radius * 0.82,
      footWidth,
      color,
      part,
      {
        region: 'hoof', joint, jointPivot: hip, jointWeight: 1,
        bendPivot: knee, bendWeight: 1, materialSlot: 'hoof'
      }
    )
  ];
}

function speciesColor(base: number, planetTint: THREE.Color, tintAmount = 0.26): THREE.Color {
  return new THREE.Color(base).lerp(planetTint, clamp(tintAmount, 0, 0.45));
}

/**
 * Horse/elk-silhouette grazer: torso carried HIGH on long slim legs (legs are
 * ~45% of standing height), a long angled neck with a mane ridge, a head with a
 * distinct muzzle, and a dropped tail fall. Feet touch local y=0 so the anchor
 * grounds the animal at any body scale. Local head-top ~1.45.
 */
function createGrazerGeometry(profile: FaunaProfile): THREE.BufferGeometry {
  const p = profile.phenotypes.grazer;
  const earSpread = 0.035 + p.earSplay * 0.07;
  const neckPivot = new THREE.Vector3(0.42, 0.82, 0);
  const tailPivot = new THREE.Vector3(-0.54, 0.79, 0);
  const tailEnd = new THREE.Vector3(tailPivot.x - 0.28 * p.tailLength, 0.5 + p.tailLift * 0.08, 0.02);
  const coat = speciesColor(0x8f8058, profile.coatBase);
  const coatLight = speciesColor(0xc2ad79, profile.coatWarm, 0.22);
  const dark = speciesColor(0x292823, profile.darkColor, 0.18);
  const horn = speciesColor(0x6f654d, profile.coatCool, 0.2);
  const leg = speciesColor(0x554a36, profile.coatCool, 0.24);
  const parts: THREE.BufferGeometry[] = [
    loftHull([
      { x: -0.55 * p.bodyLength, y: 0.75, halfHeight: 0.08, topHeight: 0.08, bottomDepth: 0.08, halfWidth: 0.08 },
      { x: -0.45 * p.bodyLength, y: 0.76, halfHeight: 0.17, topHeight: 0.15 * p.bodyHeight, bottomDepth: 0.18 * p.bodyHeight, halfWidth: 0.15 * p.bodyWidth },
      { x: -0.28 * p.bodyLength, y: 0.77, halfHeight: 0.2, topHeight: 0.19 * p.bodyHeight, bottomDepth: 0.22 * p.bodyHeight, halfWidth: 0.18 * p.bodyWidth },
      { x: -0.05, y: 0.76, halfHeight: 0.205, topHeight: 0.2 * p.bodyHeight, bottomDepth: 0.21 * p.bodyHeight, halfWidth: 0.19 * p.bodyWidth },
      { x: 0.18 * p.bodyLength, y: 0.77, halfHeight: 0.21, topHeight: 0.2 * p.bodyHeight, bottomDepth: 0.22 * p.bodyHeight, halfWidth: 0.18 * p.bodyWidth },
      { x: 0.36 * p.bodyLength, y: 0.8, halfHeight: 0.23, topHeight: 0.22 * p.bodyHeight, bottomDepth: 0.24 * p.bodyHeight, halfWidth: 0.17 * p.bodyWidth },
      { x: 0.48 * p.bodyLength, y: 0.84, halfHeight: 0.135, topHeight: 0.12, bottomDepth: 0.15, halfWidth: 0.12 }
    ], coat, 0, 0.2, { region: 'body', materialSlot: 'coat' }, 8),
    loftHull([
      { x: 0.35, y: 0.82, halfHeight: 0.14, topHeight: 0.14, bottomDepth: 0.14, halfWidth: 0.13, cap: false },
      { x: 0.44, y: 0.94, halfHeight: 0.135, topHeight: 0.13, bottomDepth: 0.14, halfWidth: 0.115 },
      { x: 0.53 * p.neckLength, y: 1.06 * p.neckRise + 0.1, halfHeight: 0.115, topHeight: 0.11, bottomDepth: 0.12, halfWidth: 0.1 },
      { x: 0.6 * p.neckLength, y: 1.16 * p.neckRise + 0.14, halfHeight: 0.1, topHeight: 0.095, bottomDepth: 0.105, halfWidth: 0.085 },
      { x: 0.66 * p.neckLength, y: 1.22 * p.neckRise + 0.14, halfHeight: 0.078, topHeight: 0.075, bottomDepth: 0.08, halfWidth: 0.075 }
    ], coat, 1, 0.6, {
      region: 'head', joint: 'neck', jointPivot: neckPivot, jointWeight: 1, materialSlot: 'coat'
    }, 8),
    loftHull([
      { x: 0.62, y: 1.22, halfHeight: 0.08, topHeight: 0.08, bottomDepth: 0.08, halfWidth: 0.075, cap: false },
      { x: 0.71, y: 1.25, halfHeight: 0.115, topHeight: 0.12, bottomDepth: 0.11, halfWidth: 0.1 },
      { x: 0.8, y: 1.23, halfHeight: 0.11, topHeight: 0.1, bottomDepth: 0.12, halfWidth: 0.09 },
      { x: 0.85, y: 1.19, halfHeight: 0.075, topHeight: 0.065, bottomDepth: 0.08, halfWidth: 0.07 }
    ], coatLight, 1, 0.5, {
      region: 'head', joint: 'neck', jointPivot: neckPivot, jointWeight: 1, materialSlot: 'skin'
    }, 8),
    loftHull([
      { x: 0.79, y: 1.18, halfHeight: 0.07, topHeight: 0.06, bottomDepth: 0.075, halfWidth: 0.07, cap: false },
      { x: 0.91 * p.muzzleLength, y: 1.16, halfHeight: 0.06, topHeight: 0.055, bottomDepth: 0.065, halfWidth: 0.06 },
      { x: 1.01 * p.muzzleLength, y: 1.15, halfHeight: 0.045, topHeight: 0.04, bottomDepth: 0.045, halfWidth: 0.05 }
    ], coatLight.clone().lerp(new THREE.Color(0xd9ceb0), 0.2), 1, 0.45, {
      region: 'head', joint: 'neck', jointPivot: neckPivot, jointWeight: 1, materialSlot: 'skin'
    }, 8),
    leafAppendage(new THREE.Vector3(0.65, 1.34, earSpread), new THREE.Vector3(0.57, 1.49, earSpread * 1.3), 0.052 * p.earScale, 0.008, coatLight, {
      region: 'ear', joint: 'neck', jointPivot: neckPivot, jointWeight: 1, materialSlot: 'skin'
    }),
    leafAppendage(new THREE.Vector3(0.65, 1.34, -earSpread), new THREE.Vector3(0.57, 1.49, -earSpread * 1.3), 0.052 * p.earScale, 0.008, coatLight, {
      region: 'ear', joint: 'neck', jointPivot: neckPivot, jointWeight: 1, materialSlot: 'skin'
    }),
    // Eyes.
    ellipsoid(new THREE.Vector3(0.79, 1.265, 0.091), new THREE.Vector3(0.024, 0.018, 0.006), dark, 1, 0.2, 0, {
      region: 'eye', joint: 'neck', jointPivot: neckPivot, jointWeight: 1, materialSlot: 'eye'
    }),
    ellipsoid(new THREE.Vector3(0.79, 1.265, -0.091), new THREE.Vector3(0.024, 0.018, 0.006), dark, 1, 0.2, 0, {
      region: 'eye', joint: 'neck', jointPivot: neckPivot, jointWeight: 1, materialSlot: 'eye'
    }),
    limbTube([
      tailPivot,
      new THREE.Vector3(-0.62, 0.68 + p.tailLift * 0.05, 0.012),
      tailEnd
    ], [0.038, 0.032, 0.018], dark, 4, {
      region: 'tail', joint: 'tail', jointPivot: tailPivot, jointWeight: 1, materialSlot: 'coat'
    }, 5)
  ];
  parts.push(leafAppendage(
    tailEnd,
    tailEnd.clone().add(new THREE.Vector3(-0.035, -0.12, 0.005)),
    0.035,
    0.012,
    dark,
    { region: 'tail', joint: 'tail', jointPivot: tailPivot, jointWeight: 1, materialSlot: 'coat' }
  ));
  parts.push(finFan(
    new THREE.Vector3(0.39, 0.91, 0),
    [
      new THREE.Vector3(0.42, 1.02, 0),
      new THREE.Vector3(0.53, 1.12 + p.crest * 0.04, 0),
      new THREE.Vector3(0.65, 1.29, 0),
      new THREE.Vector3(0.7, 1.24, 0)
    ],
    dark,
    { region: 'mane', joint: 'neck', jointPivot: neckPivot, jointWeight: 1, materialSlot: 'coat' }
  ));
  [-1, 1].forEach(side => {
    parts.push(limbTube([
      new THREE.Vector3(0.68, 1.34, side * 0.055),
      new THREE.Vector3(0.63, 1.44, side * 0.07),
      new THREE.Vector3(0.56, 1.51, side * 0.085),
      new THREE.Vector3(0.49, 1.54, side * 0.075)
    ], [0.022, 0.018, 0.012, 0.006].map(radius => radius * p.appendageScale), horn, 4, {
      region: 'horn', joint: 'neck', jointPivot: neckPivot, jointWeight: 1, materialSlot: 'horn'
    }, 6));
  });
  // Long antelope limbs with distinct knee/hock chains and wedge hooves.
  [-0.125, 0.125].forEach(z => {
    const radius = 0.036 * p.limbSlenderness;
    parts.push(...articulatedLeg([
      new THREE.Vector3(0.3, 0.67 * p.shoulderHeight, z),
      new THREE.Vector3(0.28, 0.47, z),
      new THREE.Vector3(0.34, 0.27, z),
      new THREE.Vector3(0.33, 0.055, z)
    ], leg, 2, radius, 0.13, 0.085));
    parts.push(...articulatedLeg([
      new THREE.Vector3(-0.34, 0.68 * p.hipHeight, z),
      new THREE.Vector3(-0.2, 0.49, z),
      new THREE.Vector3(-0.41, 0.25, z),
      new THREE.Vector3(-0.35, 0.055, z)
    ], leg, 3, radius * 1.06, 0.14, 0.09));
  });
  return merge(parts);
}

/**
 * Sheep/yak woolly: a continuous irregular fleece shell with a low skirt, a
 * wool cap over the brow, a dark bare face, and small curled horns.
 */
function createWoollyGeometry(profile: FaunaProfile): THREE.BufferGeometry {
  const p = profile.phenotypes.woolly;
  const massScale = 0.75 + p.mass * 0.25;
  const fleeceRuffle = 0.016 + p.fleece * 0.02;
  const earSpread = 0.07 + p.earSplay * 0.085;
  const neckPivot = new THREE.Vector3(0.3, 0.57, 0);
  const fleece = speciesColor(0xb8b2a5, profile.woolColor, 0.2);
  const skin = speciesColor(0x34302d, profile.darkColor, 0.16);
  const horn = speciesColor(0x776b53, profile.coatCool, 0.18);
  const eye = speciesColor(0x171513, profile.accentColor, 0.12);
  const parts: THREE.BufferGeometry[] = [
    // One continuous irregular fleece shell replaces the old fifteen blob clumps.
    loftHull([
      { x: -0.48 * p.bodyLength, y: 0.56, halfHeight: 0.1, topHeight: 0.1 * massScale, bottomDepth: 0.1 * massScale, halfWidth: 0.11 * massScale, ruffle: fleeceRuffle * 0.4 },
      { x: -0.4 * p.bodyLength, y: 0.58, halfHeight: 0.245, topHeight: 0.22 * p.bodyHeight * massScale, bottomDepth: 0.27 * p.bodyHeight * massScale, halfWidth: 0.2 * p.bodyWidth * massScale, ruffle: fleeceRuffle },
      { x: -0.24 * p.bodyLength, y: 0.6, halfHeight: 0.28, topHeight: 0.25 * p.bodyHeight * massScale, bottomDepth: 0.31 * p.bodyHeight * massScale, halfWidth: 0.25 * p.bodyWidth * massScale, ruffle: fleeceRuffle * 0.8 },
      { x: 0, y: 0.61, halfHeight: 0.3, topHeight: 0.27 * p.bodyHeight * massScale, bottomDepth: 0.33 * p.bodyHeight * massScale, halfWidth: 0.27 * p.bodyWidth * massScale, ruffle: fleeceRuffle },
      { x: 0.22 * p.bodyLength, y: 0.6, halfHeight: 0.285, topHeight: 0.25 * p.bodyHeight * massScale, bottomDepth: 0.32 * p.bodyHeight * massScale, halfWidth: 0.26 * p.bodyWidth * massScale, ruffle: fleeceRuffle * 0.85 },
      { x: 0.4 * p.bodyLength, y: 0.58, halfHeight: 0.25, topHeight: 0.21 * p.bodyHeight * massScale, bottomDepth: 0.29 * p.bodyHeight * massScale, halfWidth: 0.22 * p.bodyWidth * massScale, ruffle: fleeceRuffle },
      { x: 0.49 * p.bodyLength, y: 0.57, halfHeight: 0.13, topHeight: 0.11 * massScale, bottomDepth: 0.15 * massScale, halfWidth: 0.13 * massScale, ruffle: fleeceRuffle * 0.4 },
      { x: 0.525, y: 0.595, halfHeight: 0.095, topHeight: 0.09, bottomDepth: 0.1, halfWidth: 0.085, ruffle: fleeceRuffle * 0.3 },
      { x: 0.55, y: 0.61, halfHeight: 0.045, topHeight: 0.045, bottomDepth: 0.05, halfWidth: 0.045, ruffle: fleeceRuffle * 0.18, cap: false }
    ], fleece, 0, 0.44, { region: 'fleece', materialSlot: 'fleece' }, 12),
    loftHull([
      { x: 0.3, y: 0.63, halfHeight: 0.13, topHeight: 0.12, bottomDepth: 0.14, halfWidth: 0.13, cap: false },
      { x: 0.42, y: 0.65, halfHeight: 0.15, topHeight: 0.14, bottomDepth: 0.16, halfWidth: 0.12 },
      { x: 0.55, y: 0.61, halfHeight: 0.13, topHeight: 0.11, bottomDepth: 0.15, halfWidth: 0.1 },
      { x: 0.67 * p.muzzleLength, y: 0.55, halfHeight: 0.065, topHeight: 0.05, bottomDepth: 0.075, halfWidth: 0.065 }
    ], skin, 1, 0.44, {
      region: 'head', joint: 'neck', jointPivot: neckPivot, jointWeight: 1, materialSlot: 'skin'
    }, 10),
    // Eyes.
    ellipsoid(new THREE.Vector3(0.54, 0.66, 0.101), new THREE.Vector3(0.022, 0.017, 0.006), eye, 1, 0.2, 0, {
      region: 'eye', joint: 'neck', jointPivot: neckPivot, jointWeight: 1, materialSlot: 'eye'
    }),
    ellipsoid(new THREE.Vector3(0.54, 0.66, -0.101), new THREE.Vector3(0.022, 0.017, 0.006), eye, 1, 0.2, 0, {
      region: 'eye', joint: 'neck', jointPivot: neckPivot, jointWeight: 1, materialSlot: 'eye'
    }),
    // Ears sit below the horn roots and project laterally.
    leafAppendage(new THREE.Vector3(0.38, 0.68, earSpread * 0.88), new THREE.Vector3(0.38, 0.65, earSpread * 1.58), 0.045 * p.earScale, 0.009, skin, {
      region: 'ear', joint: 'neck', jointPivot: neckPivot, jointWeight: 1, materialSlot: 'skin'
    }),
    leafAppendage(new THREE.Vector3(0.38, 0.68, -earSpread * 0.88), new THREE.Vector3(0.38, 0.65, -earSpread * 1.58), 0.045 * p.earScale, 0.009, skin, {
      region: 'ear', joint: 'neck', jointPivot: neckPivot, jointWeight: 1, materialSlot: 'skin'
    }),
    limbTube([new THREE.Vector3(0.31, 0.77, 0.14), new THREE.Vector3(0.29, 0.84, 0.19), new THREE.Vector3(0.35, 0.82, 0.25), new THREE.Vector3(0.44, 0.76, 0.29), new THREE.Vector3(0.51, 0.7, 0.27)], [0.03, 0.027, 0.022, 0.015, 0.006], horn, 4, {
      region: 'horn', joint: 'neck', jointPivot: neckPivot, jointWeight: 1, materialSlot: 'horn'
    }, 6),
    limbTube([new THREE.Vector3(0.31, 0.77, -0.14), new THREE.Vector3(0.29, 0.84, -0.19), new THREE.Vector3(0.35, 0.82, -0.25), new THREE.Vector3(0.44, 0.76, -0.29), new THREE.Vector3(0.51, 0.7, -0.27)], [0.03, 0.027, 0.022, 0.015, 0.006], horn, 4, {
      region: 'horn', joint: 'neck', jointPivot: neckPivot, jointWeight: 1, materialSlot: 'horn'
    }, 6),
    // Wool stub tail.
    loftHull([
      { x: -0.43, y: 0.59, halfHeight: 0.045, halfWidth: 0.05, cap: false },
      { x: -0.43 - 0.1 * p.tailLength, y: 0.6, halfHeight: 0.05, halfWidth: 0.05 },
      { x: -0.43 - 0.18 * p.tailLength, y: 0.59, halfHeight: 0.018, halfWidth: 0.022 }
    ], fleece, 4, 0.8, {
      region: 'tail', joint: 'tail', jointPivot: new THREE.Vector3(-0.4, 0.57, 0), jointWeight: 1, materialSlot: 'fleece'
    }, 6)
  ];
  [-0.145, 0.145].forEach(z => {
    const radius = 0.045 * p.limbSlenderness;
    parts.push(...articulatedLeg([
      new THREE.Vector3(0.24, 0.43 * p.shoulderHeight, z),
      new THREE.Vector3(0.22, 0.28, z),
      new THREE.Vector3(0.27, 0.13, z),
      new THREE.Vector3(0.27, 0.045, z)
    ], skin, 2, radius, 0.14, 0.12));
    parts.push(...articulatedLeg([
      new THREE.Vector3(-0.24, 0.43 * p.hipHeight, z),
      new THREE.Vector3(-0.16, 0.29, z),
      new THREE.Vector3(-0.29, 0.14, z),
      new THREE.Vector3(-0.27, 0.045, z)
    ], skin, 3, radius * 1.05, 0.15, 0.125));
  });
  return merge(parts);
}

/**
 * Fox-silhouette runner: deep chest tapering to a slim waist, a long bushy
 * tail carried low with a pale tip, tall alert ears, and a pointed muzzle
 * ending in a dark nose. Feet touch local y=0.
 */
function createRunnerGeometry(profile: FaunaProfile): THREE.BufferGeometry {
  const p = profile.phenotypes.runner;
  const earSpread = 0.045 + p.earSplay * 0.095;
  const neckPivot = new THREE.Vector3(0.3, 0.5, 0);
  const tailPivot = new THREE.Vector3(-0.38, 0.47, 0);
  const coat = speciesColor(0xa4663f, profile.coatWarm, 0.24);
  const coatLight = speciesColor(0xd2b58b, profile.woolColor, 0.2);
  const dark = speciesColor(0x2d2824, profile.darkColor, 0.16);
  const ear = speciesColor(0x755039, profile.coatCool, 0.2);
  const parts: THREE.BufferGeometry[] = [
    loftHull([
      { x: -0.49 * p.bodyLength, y: 0.5, halfHeight: 0.075, topHeight: 0.07, bottomDepth: 0.08, halfWidth: 0.08 },
      { x: -0.39 * p.bodyLength, y: 0.51, halfHeight: 0.16, topHeight: 0.15 * p.bodyHeight, bottomDepth: 0.17 * p.bodyHeight, halfWidth: 0.14 * p.bodyWidth },
      { x: -0.25 * p.bodyLength, y: 0.52, halfHeight: 0.175, topHeight: 0.17 * p.bodyHeight, bottomDepth: 0.18 * p.bodyHeight, halfWidth: 0.15 * p.bodyWidth },
      { x: -0.08, y: 0.51, halfHeight: 0.13, topHeight: 0.12 * p.bodyHeight, bottomDepth: 0.14 * p.bodyHeight, halfWidth: 0.11 * p.bodyWidth },
      { x: 0.1, y: 0.51, halfHeight: 0.175, topHeight: 0.16 * p.bodyHeight, bottomDepth: 0.19 * p.bodyHeight, halfWidth: 0.14 * p.bodyWidth },
      { x: 0.25 * p.bodyLength, y: 0.53, halfHeight: 0.21, topHeight: 0.2 * p.bodyHeight, bottomDepth: 0.22 * p.bodyHeight, halfWidth: 0.15 * p.bodyWidth },
      { x: 0.35 * p.bodyLength, y: 0.57, halfHeight: 0.15, topHeight: 0.14, bottomDepth: 0.16, halfWidth: 0.12 }
    ], coat, 0, 0.22, { region: 'body', materialSlot: 'coat' }, 8),
    loftHull([
      { x: 0.29, y: 0.56, halfHeight: 0.14, halfWidth: 0.12, cap: false },
      { x: 0.38, y: 0.64, halfHeight: 0.115, topHeight: 0.11, bottomDepth: 0.12, halfWidth: 0.1 },
      { x: 0.47, y: 0.68, halfHeight: 0.095, topHeight: 0.09, bottomDepth: 0.1, halfWidth: 0.085 }
    ], coat, 1, 0.42, {
      region: 'head', joint: 'neck', jointPivot: neckPivot, jointWeight: 1, materialSlot: 'coat'
    }, 10),
    loftHull([
      { x: 0.43, y: 0.68, halfHeight: 0.09, halfWidth: 0.085, cap: false },
      { x: 0.52, y: 0.7, halfHeight: 0.12, topHeight: 0.12, bottomDepth: 0.11, halfWidth: 0.1 },
      { x: 0.61, y: 0.67, halfHeight: 0.105, topHeight: 0.1, bottomDepth: 0.11, halfWidth: 0.085 },
      { x: 0.66, y: 0.64, halfHeight: 0.075, topHeight: 0.07, bottomDepth: 0.08, halfWidth: 0.07 }
    ], coat, 1, 0.5, {
      region: 'head', joint: 'neck', jointPivot: neckPivot, jointWeight: 1, materialSlot: 'skin'
    }, 10),
    loftHull([
      { x: 0.6, y: 0.64, halfHeight: 0.07, halfWidth: 0.065, cap: false },
      { x: 0.74 * p.muzzleLength, y: 0.59, halfHeight: 0.06, topHeight: 0.055, bottomDepth: 0.065, halfWidth: 0.05 },
      { x: 0.86 * p.muzzleLength, y: 0.56, halfHeight: 0.04, topHeight: 0.035, bottomDepth: 0.045, halfWidth: 0.035 }
    ], coatLight, 1, 0.45, {
      region: 'head', joint: 'neck', jointPivot: neckPivot, jointWeight: 1, materialSlot: 'skin'
    }, 8),
    leafAppendage(new THREE.Vector3(0.48, 0.76, earSpread * 0.78), new THREE.Vector3(0.4, 0.97, earSpread * 1.18), 0.065 * p.earScale, 0.009, ear, {
      region: 'ear', joint: 'neck', jointPivot: neckPivot, jointWeight: 1, materialSlot: 'skin'
    }),
    leafAppendage(new THREE.Vector3(0.48, 0.76, -earSpread * 0.78), new THREE.Vector3(0.4, 0.97, -earSpread * 1.18), 0.065 * p.earScale, 0.009, ear, {
      region: 'ear', joint: 'neck', jointPivot: neckPivot, jointWeight: 1, materialSlot: 'skin'
    }),
    // Eyes.
    ellipsoid(new THREE.Vector3(0.56, 0.71, 0.101), new THREE.Vector3(0.021, 0.016, 0.006), dark, 1, 0.2, 0, {
      region: 'eye', joint: 'neck', jointPivot: neckPivot, jointWeight: 1, materialSlot: 'eye'
    }),
    ellipsoid(new THREE.Vector3(0.56, 0.71, -0.101), new THREE.Vector3(0.021, 0.016, 0.006), dark, 1, 0.2, 0, {
      region: 'eye', joint: 'neck', jointPivot: neckPivot, jointWeight: 1, materialSlot: 'eye'
    }),
    ellipsoid(new THREE.Vector3(0.865 * p.muzzleLength, 0.56, 0), new THREE.Vector3(0.025, 0.022, 0.029), dark, 1, 0.15, 0, {
      region: 'head', joint: 'neck', jointPivot: neckPivot, jointWeight: 1, materialSlot: 'skin'
    }),
    loftHull([
      { x: tailPivot.x, y: tailPivot.y, halfHeight: 0.045, halfWidth: 0.05, cap: false },
      { x: -0.55, y: 0.48, z: 0.015, halfHeight: 0.07, halfWidth: 0.06 },
      { x: -0.7, y: 0.41 + p.tailLift * 0.04, z: 0.025, halfHeight: 0.095, halfWidth: 0.085 },
      { x: -0.86, y: 0.39 + p.tailLift * 0.07, z: 0.035, halfHeight: 0.12, halfWidth: 0.105 },
      { x: -1, y: 0.44 + p.tailLift * 0.08, z: 0.035, halfHeight: 0.085, halfWidth: 0.075 },
      { x: -1.1 * p.tailLength / 1.18, y: 0.49 + p.tailLift * 0.08, z: 0.025, halfHeight: 0.025, halfWidth: 0.025 }
    ], coat.clone().lerp(dark, 0.18), 4, 1, {
      region: 'tail', joint: 'tail', jointPivot: tailPivot, jointWeight: 1, materialSlot: 'coat'
    }, 10)
  ];
  [-0.115, 0.115].forEach(z => {
    const radius = 0.032 * p.limbSlenderness;
    parts.push(...articulatedLeg([
      new THREE.Vector3(0.25, 0.55 * p.shoulderHeight, z),
      new THREE.Vector3(0.18, 0.34, z),
      new THREE.Vector3(0.28, 0.12, z),
      new THREE.Vector3(0.31, 0.045, z)
    ], dark, 2, radius, 0.14, 0.09));
    parts.push(...articulatedLeg([
      new THREE.Vector3(-0.29, 0.52 * p.hipHeight, z),
      new THREE.Vector3(-0.1, 0.36, z),
      new THREE.Vector3(-0.34, 0.17, z),
      new THREE.Vector3(-0.27, 0.045, z)
    ], dark, 3, radius * 1.08, 0.15, 0.095));
  });
  return merge(parts);
}

function createHopperGeometry(profile: FaunaProfile): THREE.BufferGeometry {
  const p = profile.phenotypes.hopper;
  const earSpread = 0.035 + p.earSplay * 0.096;
  const neckPivot = new THREE.Vector3(0.13, 0.58, 0);
  const tailPivot = new THREE.Vector3(-0.34, 0.52, 0);
  const coat = speciesColor(0x887252, profile.coatCool, 0.24);
  const coatLight = speciesColor(0xb8a47a, profile.coatBase, 0.2);
  const dark = speciesColor(0x342e27, profile.darkColor, 0.16);
  const limbColor = speciesColor(0x5f513d, profile.coatCool, 0.2);
  const parts: THREE.BufferGeometry[] = [
    loftHull([
      { x: -0.38, y: 0.42, halfHeight: 0.15, topHeight: 0.14, bottomDepth: 0.16, halfWidth: 0.13 },
      { x: -0.28, y: 0.45, halfHeight: 0.24, topHeight: 0.23 * p.hipHeight, bottomDepth: 0.25 * p.hipHeight, halfWidth: 0.2 * p.bodyWidth },
      { x: -0.1, y: 0.48, halfHeight: 0.255, topHeight: 0.24 * p.bodyHeight, bottomDepth: 0.27 * p.bodyHeight, halfWidth: 0.21 * p.bodyWidth },
      { x: 0.06, y: 0.53, halfHeight: 0.2, topHeight: 0.19 * p.bodyHeight, bottomDepth: 0.21 * p.bodyHeight, halfWidth: 0.17 * p.bodyWidth },
      { x: 0.17, y: 0.59, halfHeight: 0.125, topHeight: 0.11, bottomDepth: 0.14, halfWidth: 0.11 }
    ], coat, 0, 0.25, { region: 'body', materialSlot: 'coat' }, 12),
    loftHull([
      { x: 0.13, y: 0.58, halfHeight: 0.075, topHeight: 0.07, bottomDepth: 0.08, halfWidth: 0.08, cap: false },
      { x: 0.23, y: 0.66, halfHeight: 0.125, topHeight: 0.13, bottomDepth: 0.12, halfWidth: 0.11 },
      { x: 0.34, y: 0.65, halfHeight: 0.11, topHeight: 0.1, bottomDepth: 0.12, halfWidth: 0.09 },
      { x: 0.4, y: 0.61, halfHeight: 0.065, topHeight: 0.055, bottomDepth: 0.075, halfWidth: 0.065 }
    ], coatLight, 1, 0.5, {
      region: 'head', joint: 'neck', jointPivot: neckPivot, jointWeight: 1, materialSlot: 'skin'
    }, 10),
    leafAppendage(new THREE.Vector3(0.2, 0.75, earSpread * 0.78), new THREE.Vector3(0.08, 1.03, earSpread * 1.2), 0.07 * p.earScale, 0.01, coatLight, {
      region: 'ear', joint: 'neck', jointPivot: neckPivot, jointWeight: 1, materialSlot: 'skin'
    }),
    leafAppendage(new THREE.Vector3(0.2, 0.75, -earSpread * 0.78), new THREE.Vector3(0.08, 1.03, -earSpread * 1.2), 0.07 * p.earScale, 0.01, coatLight, {
      region: 'ear', joint: 'neck', jointPivot: neckPivot, jointWeight: 1, materialSlot: 'skin'
    }),
    ellipsoid(new THREE.Vector3(0.32, 0.69, 0.091), new THREE.Vector3(0.022, 0.018, 0.006), dark, 1, 0.2, 1, {
      region: 'eye', joint: 'neck', jointPivot: neckPivot, jointWeight: 1, materialSlot: 'eye'
    }),
    ellipsoid(new THREE.Vector3(0.32, 0.69, -0.091), new THREE.Vector3(0.022, 0.018, 0.006), dark, 1, 0.2, 1, {
      region: 'eye', joint: 'neck', jointPivot: neckPivot, jointWeight: 1, materialSlot: 'eye'
    }),
    loftHull([
      { x: -0.34, y: 0.52, halfHeight: 0.045, halfWidth: 0.05, cap: false },
      { x: -0.52, y: 0.44, halfHeight: 0.055, halfWidth: 0.05 },
      { x: -0.7, y: 0.36, halfHeight: 0.05, halfWidth: 0.045 },
      { x: -0.88, y: 0.31, halfHeight: 0.04, halfWidth: 0.035 },
      { x: -1.02 * p.tailLength / 0.24, y: 0.34, halfHeight: 0.018, halfWidth: 0.018 }
    ], coat.clone().lerp(coatLight, 0.18), 4, 0.75, {
      region: 'tail', joint: 'tail', jointPivot: tailPivot, jointWeight: 1, materialSlot: 'coat'
    }, 8)
  ];
  [-0.105, 0.105].forEach(z => {
    const frontHip = new THREE.Vector3(0.1, 0.55, z * 0.76);
    const frontJoint: FaunaJoint = z > 0 ? 'frontLeft' : 'frontRight';
    const frontElbow = new THREE.Vector3(0.22, 0.42, z * 0.76);
    parts.push(limbTube([frontHip, frontElbow], [0.03, 0.024], limbColor, 2, {
      region: 'frontLimb', joint: frontJoint, jointPivot: frontHip, jointWeight: 1, materialSlot: 'skin'
    }, 6));
    parts.push(limbTube([
      frontElbow,
      new THREE.Vector3(0.29, 0.35, z * 0.76),
      new THREE.Vector3(0.35, 0.34, z * 0.76)
    ], [0.024, 0.018, 0.014], limbColor, 2, {
      region: 'frontLimb', joint: frontJoint, jointPivot: frontHip, jointWeight: 1,
      bendPivot: frontElbow, bendWeight: 1, materialSlot: 'skin'
    }, 6));
    parts.push(...articulatedLeg([
      new THREE.Vector3(-0.23, 0.48, z),
      new THREE.Vector3(0.02, 0.32, z),
      new THREE.Vector3(-0.28, 0.12, z),
      new THREE.Vector3(-0.12, 0.045, z)
    ], limbColor, 3, 0.05 * p.limbSlenderness, 0.3, 0.115));
  });
  return merge(parts);
}

function createDragonflyGeometry(profile: FaunaProfile): THREE.BufferGeometry {
  const p = profile.phenotypes.dragonfly;
  const abdomen = speciesColor(0x3f5452, profile.accentColor, 0.22);
  const thorax = speciesColor(0x354441, profile.darkColor, 0.16);
  const edge = speciesColor(0x65736d, profile.coatWarm, 0.18);
  const membrane = speciesColor(0xa3b7b6, profile.wingColor, 0.2);
  const eye = speciesColor(0x17292b, profile.accentColor, 0.14);
  const abdomenPivot = new THREE.Vector3(-0.08, 0.5, 0);
  const foreSpan = 0.76 * p.appendageScale;
  const hindSpan = 0.61 * p.appendageScale;
  const parts: THREE.BufferGeometry[] = [
    loftHull([
      { x: -0.82 * p.bodyLength, y: 0.505, halfHeight: 0.011, halfWidth: 0.011 },
      { x: -0.72 * p.bodyLength, y: 0.497, halfHeight: 0.017, halfWidth: 0.017 },
      { x: -0.61 * p.bodyLength, y: 0.493, halfHeight: 0.021, halfWidth: 0.021 },
      { x: -0.5 * p.bodyLength, y: 0.492, halfHeight: 0.025, halfWidth: 0.025 },
      { x: -0.39 * p.bodyLength, y: 0.493, halfHeight: 0.029, halfWidth: 0.029 },
      { x: -0.29 * p.bodyLength, y: 0.495, halfHeight: 0.033, halfWidth: 0.033 },
      { x: -0.21 * p.bodyLength, y: 0.498, halfHeight: 0.037, halfWidth: 0.037 },
      { x: -0.14 * p.bodyLength, y: 0.5, halfHeight: 0.042, halfWidth: 0.042 },
      { x: -0.075, y: 0.505, halfHeight: 0.048, halfWidth: 0.047 }
    ], abdomen, 4, 0.72, { region: 'tail', joint: 'tail', jointPivot: abdomenPivot, jointWeight: 1, materialSlot: 'skin' }, 8),
    loftHull([
      { x: -0.1, y: 0.505, halfHeight: 0.054, halfWidth: 0.05 },
      { x: -0.035, y: 0.512, halfHeight: 0.09, halfWidth: 0.075 },
      { x: 0.045, y: 0.515, halfHeight: 0.108, topHeight: 0.105, bottomDepth: 0.11, halfWidth: 0.088 },
      { x: 0.115, y: 0.518, halfHeight: 0.092, halfWidth: 0.08 },
      { x: 0.165, y: 0.52, halfHeight: 0.061, halfWidth: 0.06 }
    ], thorax, 0, 0.3, { region: 'body', materialSlot: 'skin' }, 8),
    loftHull([
      { x: 0.14, y: 0.52, halfHeight: 0.056, halfWidth: 0.06 },
      { x: 0.21, y: 0.525, halfHeight: 0.075, halfWidth: 0.085 },
      { x: 0.285, y: 0.525, halfHeight: 0.071, halfWidth: 0.088 },
      { x: 0.345, y: 0.515, halfHeight: 0.036, halfWidth: 0.045 }
    ], thorax, 1, 0.36, { region: 'head', materialSlot: 'skin' }, 8),
    ellipsoid(new THREE.Vector3(0.276, 0.548, 0.083), new THREE.Vector3(0.045, 0.05, 0.018), eye, 1, 0.24, 0, { region: 'eye', materialSlot: 'eye' }),
    ellipsoid(new THREE.Vector3(0.276, 0.548, -0.083), new THREE.Vector3(0.045, 0.05, 0.018), eye, 1, 0.24, 0, { region: 'eye', materialSlot: 'eye' }),
    wingSheet(0.045, 0.585, 0.058, 1, 0.12 * p.appendageScale, foreSpan, 0.035, membrane),
    wingSheet(0.045, 0.585, -0.058, -1, 0.12 * p.appendageScale, foreSpan, 0.035, membrane),
    wingSheet(-0.055, 0.575, 0.054, 1, 0.18 * p.appendageScale, hindSpan, -0.145, membrane),
    wingSheet(-0.055, 0.575, -0.054, -1, 0.18 * p.appendageScale, hindSpan, -0.145, membrane)
  ];
  [-1, 1].forEach(side => {
    const wingJoint: FaunaJoint = side > 0 ? 'leftWing' : 'rightWing';
    parts.push(
      limbTube([
        new THREE.Vector3(0.045, 0.585, side * 0.058),
        new THREE.Vector3(0.105, 0.596, side * (0.058 + foreSpan * 0.31)),
        new THREE.Vector3(0.105, 0.598, side * (0.058 + foreSpan * 0.68)),
        new THREE.Vector3(0.08, 0.585, side * (0.058 + foreSpan))
      ], [0.0065, 0.0055, 0.0045, 0.002], edge, 5, {
        region: 'wing', joint: wingJoint, jointPivot: new THREE.Vector3(0.045, 0.585, side * 0.058), jointWeight: 1, materialSlot: 'skin'
      }, 3),
      limbTube([
        new THREE.Vector3(-0.055, 0.575, side * 0.054),
        new THREE.Vector3(-0.015, 0.588, side * (0.054 + hindSpan * 0.34)),
        new THREE.Vector3(-0.05, 0.588, side * (0.054 + hindSpan * 0.68)),
        new THREE.Vector3(-0.2, 0.575, side * (0.054 + hindSpan))
      ], [0.0065, 0.0055, 0.004, 0.002], edge, 5, {
        region: 'wing', joint: wingJoint, jointPivot: new THREE.Vector3(-0.055, 0.575, side * 0.054), jointWeight: 1, materialSlot: 'skin'
      }, 3)
    );
  });
  const legPairs: Array<[number, number, number]> = [
    [0.095, 0.24, 0.16],
    [0.01, -0.015, 0.19],
    [-0.075, -0.29, 0.18]
  ];
  legPairs.forEach(([rootX, footX, reach], pair) => {
    [-1, 1].forEach(side => {
      parts.push(limbTube([
        new THREE.Vector3(rootX, 0.445, side * 0.055),
        new THREE.Vector3(rootX + (footX - rootX) * 0.38, 0.385 - pair * 0.007, side * reach * 0.66),
        new THREE.Vector3(footX, 0.36 - pair * 0.008, side * reach)
      ], [0.008, 0.0055, 0.003], thorax, 2, { region: 'frontLimb', materialSlot: 'skin' }, 3));
    });
  });
  return merge(parts);
}

/** Reef fish with one connected fusiform hull and a readable fin hierarchy. */
function createFishGeometry(profile: FaunaProfile): THREE.BufferGeometry {
  const p = profile.phenotypes.fish;
  const bodyColor = speciesColor(0x537b82, profile.wingColor, 0.24);
  const headColor = speciesColor(0x71979a, profile.accentColor, 0.2);
  const finColor = speciesColor(0x496d74, profile.coatCool, 0.2);
  const eyeColor = speciesColor(0x142329, profile.darkColor, 0.1);
  const gillColor = speciesColor(0x31545b, profile.accentColor, 0.14);
  const heightScale = 0.76 + p.bodyHeight * 0.16;
  const widthScale = 0.75 + p.bodyWidth * 0.75;
  const tailBaseX = -0.52 * p.bodyLength;
  const tailPivot = new THREE.Vector3(-0.18, 0.35, 0);
  const noseX = 0.9 * p.muzzleLength;
  const hull = finishFishHull(loftHull([
    { x: tailBaseX, y: 0.35, halfHeight: 0.032, halfWidth: 0.034 },
    { x: -0.43 * p.bodyLength, y: 0.35, halfHeight: 0.075 * heightScale, halfWidth: 0.06 * widthScale },
    { x: -0.33 * p.bodyLength, y: 0.355, halfHeight: 0.14 * heightScale, halfWidth: 0.09 * widthScale },
    { x: -0.2 * p.bodyLength, y: 0.36, halfHeight: 0.19 * heightScale, topHeight: 0.18 * heightScale, bottomDepth: 0.2 * heightScale, halfWidth: 0.108 * widthScale },
    { x: -0.07, y: 0.36, halfHeight: 0.22 * heightScale, topHeight: 0.205 * heightScale, bottomDepth: 0.235 * heightScale, halfWidth: 0.118 * widthScale },
    { x: 0.09, y: 0.36, halfHeight: 0.215 * heightScale, topHeight: 0.2 * heightScale, bottomDepth: 0.23 * heightScale, halfWidth: 0.12 * widthScale },
    { x: 0.22, y: 0.36, halfHeight: 0.185 * heightScale, topHeight: 0.175 * heightScale, bottomDepth: 0.195 * heightScale, halfWidth: 0.112 * widthScale },
    { x: 0.32, y: 0.355, halfHeight: 0.145 * heightScale, topHeight: 0.14 * heightScale, bottomDepth: 0.15 * heightScale, halfWidth: 0.097 * widthScale },
    { x: 0.4, y: 0.345, halfHeight: 0.1 * heightScale, halfWidth: 0.073 * widthScale },
    { x: noseX - 0.025, y: 0.335, halfHeight: 0.055 * heightScale, halfWidth: 0.048 * widthScale },
    { x: noseX, y: 0.335, halfHeight: 0.022, halfWidth: 0.025 }
  ], bodyColor, 0, 0.38, { region: 'body', materialSlot: 'scale' }, 12), headColor, 0.22, noseX, -0.18, tailBaseX, tailPivot);
  const caudalTipX = tailBaseX - 0.38 * p.tailLength;
  const eyeZ = 0.1 * widthScale;
  const parts: THREE.BufferGeometry[] = [
    hull,
    ellipsoid(new THREE.Vector3(0.315, 0.41, eyeZ), new THREE.Vector3(0.026, 0.022, 0.009), eyeColor, 1, 0.15, 1, { region: 'eye', materialSlot: 'eye' }),
    ellipsoid(new THREE.Vector3(0.315, 0.41, -eyeZ), new THREE.Vector3(0.026, 0.022, 0.009), eyeColor, 1, 0.15, 1, { region: 'eye', materialSlot: 'eye' }),
    // The two lobes leave a true notch instead of reading as a diamond billboard.
    finFan(
      [
        new THREE.Vector3(tailBaseX + 0.008, 0.37, 0),
        new THREE.Vector3(tailBaseX - 0.038, 0.355, 0)
      ],
      [
        new THREE.Vector3(caudalTipX + 0.035, 0.59, 0),
        new THREE.Vector3(caudalTipX, 0.55, 0),
        new THREE.Vector3(caudalTipX + 0.1, 0.405, 0)
      ],
      finColor,
      { region: 'fin', joint: 'fin', jointPivot: new THREE.Vector3(tailBaseX, 0.35, 0), jointWeight: 1, materialSlot: 'membrane' },
      0.012
    ),
    finFan(
      [
        new THREE.Vector3(tailBaseX - 0.038, 0.345, 0),
        new THREE.Vector3(tailBaseX + 0.008, 0.33, 0)
      ],
      [
        new THREE.Vector3(caudalTipX + 0.035, 0.11, 0),
        new THREE.Vector3(caudalTipX, 0.15, 0),
        new THREE.Vector3(caudalTipX + 0.1, 0.295, 0)
      ],
      finColor,
      { region: 'fin', joint: 'fin', jointPivot: new THREE.Vector3(tailBaseX, 0.35, 0), jointWeight: 1, materialSlot: 'membrane' },
      0.012
    ),
    // Long swept dorsal and small anal stabilize the silhouette; they do not wag with the tail.
    finFan(
      [new THREE.Vector3(-0.25, 0.535, 0), new THREE.Vector3(0.24, 0.525, 0)],
      [
        new THREE.Vector3(-0.18, 0.585, 0),
        new THREE.Vector3(-0.05, 0.64 + p.crest * 0.018, 0),
        new THREE.Vector3(0.14, 0.595, 0)
      ],
      finColor,
      { region: 'fin', materialSlot: 'membrane' }
    ),
    finFan(
      [new THREE.Vector3(-0.18, 0.165, 0), new THREE.Vector3(0.13, 0.18, 0)],
      [new THREE.Vector3(-0.08, 0.09, 0), new THREE.Vector3(0.07, 0.12, 0)],
      finColor,
      { region: 'fin', materialSlot: 'membrane' }
    )
  ];
  [-1, 1].forEach(side => {
    const sideZ = side * 0.105 * widthScale;
    parts.push(
      finFan(
        [new THREE.Vector3(0.2, 0.36, sideZ), new THREE.Vector3(0.12, 0.3, sideZ)],
        [
          new THREE.Vector3(-0.05, 0.25, side * 0.22 * widthScale),
          new THREE.Vector3(0.08, 0.285, side * 0.19 * widthScale)
        ],
        finColor,
        { region: 'fin', joint: 'fin', jointPivot: new THREE.Vector3(0.17, 0.34, sideZ), jointWeight: 0.18, materialSlot: 'membrane' }
      ),
      limbTube([
        new THREE.Vector3(0.255, 0.46, sideZ * 0.98),
        new THREE.Vector3(0.225, 0.37, sideZ * 1.04),
        new THREE.Vector3(0.25, 0.285, sideZ * 0.98)
      ], [0.0045, 0.004, 0.003], gillColor, 1, { region: 'head', materialSlot: 'scale' }, 3)
    );
  });
  return merge(parts);
}

export function createFaunaGeometry(kind: FaunaKind, profile = buildFaunaProfile(0)): THREE.BufferGeometry {
  switch (kind) {
    case 'grazer':
      return createGrazerGeometry(profile);
    case 'woolly':
      return createWoollyGeometry(profile);
    case 'runner':
      return createRunnerGeometry(profile);
    case 'hopper':
      return createHopperGeometry(profile);
    case 'dragonfly':
      return createDragonflyGeometry(profile);
    case 'fish':
      return createFishGeometry(profile);
  }
  return createGrazerGeometry(profile);
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
`;

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
    shader.uniforms.uFaunaKind = { value: faunaKindId(kind) };
    shader.uniforms.uFaunaSSSColor = { value: profile.coatWarm.clone().lerp(profile.wingColor, kind === 'dragonfly' ? 0.55 : 0.12) };
    shader.uniforms.uFaunaRimColor = { value: profile.accentColor.clone().lerp(profile.wingColor, kind === 'dragonfly' ? 0.55 : 0.18) };
    shader.uniforms.uFaunaWingColor = { value: profile.wingColor.clone() };
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
        varying vec3 vFaunaLocalPos;
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
        float faunaJointAngle(float joint, float stride, float seed, float time, float kind, float pose) {
          float phase = stride * 6.2831853 + seed * 1.445;
          float wave = sin(phase);
          float frontLeft = 1.0 - smoothstep(0.35, 0.65, abs(joint - ${FAUNA_JOINT_ID.frontLeft.toFixed(1)}));
          float frontRight = 1.0 - smoothstep(0.35, 0.65, abs(joint - ${FAUNA_JOINT_ID.frontRight.toFixed(1)}));
          float hindLeft = 1.0 - smoothstep(0.35, 0.65, abs(joint - ${FAUNA_JOINT_ID.hindLeft.toFixed(1)}));
          float hindRight = 1.0 - smoothstep(0.35, 0.65, abs(joint - ${FAUNA_JOINT_ID.hindRight.toFixed(1)}));
          float neck = 1.0 - smoothstep(0.35, 0.65, abs(joint - ${FAUNA_JOINT_ID.neck.toFixed(1)}));
          float tail = 1.0 - smoothstep(0.35, 0.65, abs(joint - ${FAUNA_JOINT_ID.tail.toFixed(1)}));
          float leftWing = 1.0 - smoothstep(0.35, 0.65, abs(joint - ${FAUNA_JOINT_ID.leftWing.toFixed(1)}));
          float rightWing = 1.0 - smoothstep(0.35, 0.65, abs(joint - ${FAUNA_JOINT_ID.rightWing.toFixed(1)}));
          float fin = 1.0 - smoothstep(0.35, 0.65, abs(joint - ${FAUNA_JOINT_ID.fin.toFixed(1)}));
          float woolly = 1.0 - smoothstep(0.35, 0.65, abs(kind - ${FAUNA_KIND_ID.woolly.toFixed(1)}));
          float hopper = 1.0 - smoothstep(0.35, 0.65, abs(kind - ${FAUNA_KIND_ID.hopper.toFixed(1)}));
          float angle = wave * 0.25 * (frontLeft - frontRight - hindLeft + hindRight) * (1.0 - hopper);
          angle += hopper * wave * (0.08 * (frontLeft + frontRight) - 0.13 * (hindLeft + hindRight));
          angle += neck * (wave * 0.025 - pose * (1.02 - woolly * 0.42));
          angle += tail * sin(time * (3.2 + seed) + phase) * 0.22;
          angle += (leftWing - rightWing) * sin(time * (15.0 + seed * 3.0) + phase) * 0.82;
          angle += fin * sin(time * (4.2 + seed * 1.5) + phase) * 0.42;
          return angle;
        }
        float faunaBendAngle(float joint, float stride, float seed, float kind) {
          float wave = sin(stride * 6.2831853 + seed * 1.445);
          float frontLeft = 1.0 - smoothstep(0.35, 0.65, abs(joint - ${FAUNA_JOINT_ID.frontLeft.toFixed(1)}));
          float frontRight = 1.0 - smoothstep(0.35, 0.65, abs(joint - ${FAUNA_JOINT_ID.frontRight.toFixed(1)}));
          float hindLeft = 1.0 - smoothstep(0.35, 0.65, abs(joint - ${FAUNA_JOINT_ID.hindLeft.toFixed(1)}));
          float hindRight = 1.0 - smoothstep(0.35, 0.65, abs(joint - ${FAUNA_JOINT_ID.hindRight.toFixed(1)}));
          float hopper = 1.0 - smoothstep(0.35, 0.65, abs(kind - ${FAUNA_KIND_ID.hopper.toFixed(1)}));
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
          float normalJointAngle = faunaJointAngle(
            aFaunaJoint,
            aFaunaStride,
            fract(aFaunaSeed),
            uTime,
            uFaunaKind,
            clamp(aFaunaPose, 0.0, 1.0)
          ) * aFaunaJointWeight * uFaunaMotion;
          float normalBendAngle = faunaBendAngle(
            aFaunaJoint,
            aFaunaStride,
            fract(aFaunaSeed),
            uFaunaKind
          ) * aFaunaBend.w * uFaunaMotion;
          objectNormal = faunaRotateZ(objectNormal, normalBendAngle);
          float wingJoint = step(6.5, aFaunaJoint) * (1.0 - step(8.5, aFaunaJoint));
          float tailJoint = 1.0 - smoothstep(0.35, 0.65, abs(aFaunaJoint - ${FAUNA_JOINT_ID.tail.toFixed(1)}));
          float finJoint = 1.0 - smoothstep(0.35, 0.65, abs(aFaunaJoint - ${FAUNA_JOINT_ID.fin.toFixed(1)}));
          float lateralJoint = clamp(tailJoint + finJoint, 0.0, 1.0);
          objectNormal = mix(objectNormal, faunaRotateZ(objectNormal, normalJointAngle), 1.0 - wingJoint - lateralJoint);
          objectNormal = mix(objectNormal, faunaRotateX(objectNormal, normalJointAngle), wingJoint);
          objectNormal = mix(objectNormal, faunaRotateY(objectNormal, normalJointAngle), lateralJoint);
        }`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vFaunaFlex = aFaunaFlex;
        vFaunaRegion = aFaunaRegion;
        vFaunaMaterialSlot = aFaunaMaterialSlot;
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
        float stridePhase = aFaunaStride * 6.2831853 + phase * 0.23;
        float stepWave = sin(stridePhase);
        float breathWave = sin(uTime * (0.74 + seed * 0.18) + phase);
        float motion = uFaunaMotion;
        float bodyBob = (abs(stepWave) * 0.016 + breathWave * 0.006) * motion;
        float hopKind = 1.0 - smoothstep(0.35, 0.65, abs(uFaunaKind - ${FAUNA_KIND_ID.hopper.toFixed(1)}));
        float hop = pow(max(0.0, stepWave), 1.6) * hopKind * motion;
        float jointAngle = faunaJointAngle(
          aFaunaJoint,
          aFaunaStride,
          seed,
          uTime,
          uFaunaKind,
          clamp(aFaunaPose, 0.0, 1.0)
        ) * aFaunaJointWeight * motion;
        float wingJoint = step(6.5, aFaunaJoint) * (1.0 - step(8.5, aFaunaJoint));
        float tailJoint = 1.0 - smoothstep(0.35, 0.65, abs(aFaunaJoint - ${FAUNA_JOINT_ID.tail.toFixed(1)}));
        float finJoint = 1.0 - smoothstep(0.35, 0.65, abs(aFaunaJoint - ${FAUNA_JOINT_ID.fin.toFixed(1)}));
        float lateralJoint = clamp(tailJoint + finJoint, 0.0, 1.0);
        float bendAngle = faunaBendAngle(aFaunaJoint, aFaunaStride, seed, uFaunaKind)
          * motion;
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
        transformed = aFaunaJointPivot + jointRotated;

        float limbJoint = step(1.5, aFaunaJoint) * (1.0 - step(5.5, aFaunaJoint));
        float rootJoint = 1.0 - smoothstep(0.35, 0.65, abs(aFaunaJoint - ${FAUNA_JOINT_ID.root.toFixed(1)}));
        float neckJoint = 1.0 - smoothstep(0.35, 0.65, abs(aFaunaJoint - ${FAUNA_JOINT_ID.neck.toFixed(1)}));
        float fishKind = 1.0 - smoothstep(0.35, 0.65, abs(uFaunaKind - ${FAUNA_KIND_ID.fish.toFixed(1)}));
        float plantedLift = pow(max(0.0, sin(stridePhase + aFaunaJoint * 3.14159265)), 1.8);
        transformed.y += plantedLift * 0.042 * limbJoint * aFaunaJointWeight * motion * (1.0 - hopKind);
        transformed.y += bodyBob * (rootJoint + neckJoint * 0.82);
        transformed.y += hop * 0.14;
        transformed.y -= clamp(aFaunaPose, 0.0, 1.0) * neckJoint
          * (0.5 + 0.5 * sin(uTime * 2.4 + phase)) * 0.018 * motion;
        transformed.z += sin(uTime * (4.2 + seed * 1.5) + phase - position.x * 2.4)
          * max(0.0, -position.x - 0.04) * 0.08 * fishKind * motion;

        float flexibleRegion = max(
          1.0 - smoothstep(0.35, 0.65, abs(aFaunaRegion - ${FAUNA_REGION_ID.ear.toFixed(1)})),
          max(
            1.0 - smoothstep(0.35, 0.65, abs(aFaunaRegion - ${FAUNA_REGION_ID.mane.toFixed(1)})),
            tailJoint
          )
        );
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
        uniform float uFaunaVisibility;
        uniform float uFaunaChroma;
        uniform float uFaunaKind;
        uniform vec3 uFaunaSSSColor;
        uniform vec3 uFaunaRimColor;
        uniform vec3 uFaunaWingColor;
        uniform vec3 uSunDir;
        uniform vec3 uMoonDir;
        varying float vFaunaFlex;
        varying float vFaunaRegion;
        varying float vFaunaMaterialSlot;
        varying float vFaunaGust;
        varying float vFaunaShade;
        varying float vFaunaSeed;
        varying vec3 vFaunaLocalPos;
        varying vec3 vFaunaWorldPos;
        varying vec3 vFaunaWorldNormal;
        vec3 vFaunaGlowTerm;
        ${FAUNA_NOISE}`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float luma = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
        diffuseColor.rgb = mix(vec3(luma) * 0.84, diffuseColor.rgb, clamp(uFaunaChroma, 0.0, 1.0));
        vec3 p = vFaunaLocalPos;
        float bodyPart = clamp(
          1.0 - smoothstep(0.35, 0.65, abs(vFaunaRegion - ${FAUNA_REGION_ID.body.toFixed(1)}))
          + 1.0 - smoothstep(0.35, 0.65, abs(vFaunaRegion - ${FAUNA_REGION_ID.fleece.toFixed(1)})),
          0.0,
          1.0
        );
        float headPart = 1.0 - smoothstep(0.35, 0.65, abs(vFaunaRegion - ${FAUNA_REGION_ID.head.toFixed(1)}));
        float frontLimb = 1.0 - smoothstep(0.35, 0.65, abs(vFaunaRegion - ${FAUNA_REGION_ID.frontLimb.toFixed(1)}));
        float hindLimb = 1.0 - smoothstep(0.35, 0.65, abs(vFaunaRegion - ${FAUNA_REGION_ID.hindLimb.toFixed(1)}));
        float legPart = clamp(frontLimb + hindLimb, 0.0, 1.0);
        float wingRegion = 1.0 - smoothstep(0.35, 0.65, abs(vFaunaRegion - ${FAUNA_REGION_ID.wing.toFixed(1)}));
        float finRegion = 1.0 - smoothstep(0.35, 0.65, abs(vFaunaRegion - ${FAUNA_REGION_ID.fin.toFixed(1)}));
        float wingPart = clamp(wingRegion + finRegion, 0.0, 1.0);
        float eyeSlot = 1.0 - smoothstep(0.35, 0.65, abs(vFaunaMaterialSlot - ${FAUNA_MATERIAL_SLOT_ID.eye.toFixed(1)}));
        float hornSlot = 1.0 - smoothstep(0.35, 0.65, abs(vFaunaMaterialSlot - ${FAUNA_MATERIAL_SLOT_ID.horn.toFixed(1)}));
        float hoofSlot = 1.0 - smoothstep(0.35, 0.65, abs(vFaunaMaterialSlot - ${FAUNA_MATERIAL_SLOT_ID.hoof.toFixed(1)}));
        float fleeceSlot = 1.0 - smoothstep(0.35, 0.65, abs(vFaunaMaterialSlot - ${FAUNA_MATERIAL_SLOT_ID.fleece.toFixed(1)}));
        float membraneSlot = 1.0 - smoothstep(0.35, 0.65, abs(vFaunaMaterialSlot - ${FAUNA_MATERIAL_SLOT_ID.membrane.toFixed(1)}));
        float accentPart = clamp(eyeSlot + hornSlot + hoofSlot, 0.0, 1.0);

        float dorsal = smoothstep(-0.08, 0.2, p.y) * (1.0 - smoothstep(0.10, 0.34, abs(p.z)));
        // Belly band scaled for the raised horse-height torso (body ~0.5-1.0).
        float underside = smoothstep(0.7, 0.25, p.y);
        float coatNoise = 0.48 * fnNoise(p.xy * 8.0 + vec2(vFaunaSeed * 11.0, uFaunaKind * 3.7))
          + 0.52 * fnNoise(p.xz * 8.0 + vec2(uFaunaKind * 2.9, vFaunaSeed * 7.0));
        float spots = smoothstep(0.61, 0.86, coatNoise);
        float bands = smoothstep(0.78, 0.98, abs(sin((p.x + p.y * 0.14 + vFaunaSeed) * 16.0)));
        float wool = 0.5 * fnNoise(p.xy * 17.0 + vec2(vFaunaSeed * 4.0, uFaunaKind))
          + 0.5 * fnNoise(p.yz * 18.0 + vec2(uFaunaKind, vFaunaSeed * 5.0));
        float kindGrazer = 1.0 - smoothstep(0.35, 0.65, abs(uFaunaKind - ${FAUNA_KIND_ID.grazer.toFixed(1)}));
        float kindWoolly = 1.0 - smoothstep(0.35, 0.65, abs(uFaunaKind - ${FAUNA_KIND_ID.woolly.toFixed(1)}));
        float kindRunner = 1.0 - smoothstep(0.35, 0.65, abs(uFaunaKind - ${FAUNA_KIND_ID.runner.toFixed(1)}));
        float kindHopper = 1.0 - smoothstep(0.35, 0.65, abs(uFaunaKind - ${FAUNA_KIND_ID.hopper.toFixed(1)}));
        float kindDragonfly = 1.0 - smoothstep(0.35, 0.65, abs(uFaunaKind - ${FAUNA_KIND_ID.dragonfly.toFixed(1)}));
        float kindFish = 1.0 - smoothstep(0.35, 0.65, abs(uFaunaKind - ${FAUNA_KIND_ID.fish.toFixed(1)}));

        diffuseColor.rgb *= 0.76 + vFaunaShade * 0.24 + vFaunaGust * 0.055 + vFaunaFlex * 0.035;
        diffuseColor.rgb *= 1.0 - underside * bodyPart * 0.18;
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.68, 0.72, 0.76), dorsal * bodyPart * kindGrazer * 0.34);
        diffuseColor.rgb *= 0.86 + wool * fleeceSlot * kindWoolly * 0.28;
        float runnerSaddle = smoothstep(-0.04, 0.2, p.y) * smoothstep(0.08, 0.34, abs(p.x));
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * (0.68 + bands * 0.34), bodyPart * kindRunner * (0.2 + runnerSaddle * 0.18));
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * (0.78 + spots * 0.38), bodyPart * kindHopper * 0.32);
        diffuseColor.rgb = mix(diffuseColor.rgb, mix(diffuseColor.rgb, uFaunaRimColor, bands * 0.26), bodyPart * kindDragonfly);
        // Fish: pale countershaded belly + an iridescent flank band shimmer.
        float belly = smoothstep(0.36, 0.16, p.y);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.4 + vec3(0.07), belly * bodyPart * kindFish * 0.6);
        diffuseColor.rgb = mix(diffuseColor.rgb, uFaunaWingColor, bands * bodyPart * kindFish * 0.3);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.68, legPart * (1.0 - hoofSlot) * 0.28);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.025, 0.03, 0.028), eyeSlot * 0.92);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.72, 0.69, 0.62), clamp(hornSlot + hoofSlot, 0.0, 1.0) * 0.46);
        diffuseColor.rgb = mix(diffuseColor.rgb, mix(uFaunaWingColor, uFaunaWingColor + vec3(0.12, 0.15, 0.17), vFaunaFlex), membraneSlot * (0.62 + vFaunaGust * 0.12));
        diffuseColor.rgb += vec3(0.016, 0.012, 0.008) * accentPart * (1.0 - membraneSlot);
        float stableMicro = fnNoise(p.xy * 34.0 + vec2(p.z * 11.0 + vFaunaSeed * 17.0, uFaunaKind * 5.3));
        diffuseColor.rgb *= 0.985 + stableMicro * 0.03;`
      )
      .replace(
        '#include <normal_fragment_begin>',
        `#include <normal_fragment_begin>
        vFaunaGlowTerm = vec3(0.0);
        {
          vec3 V = normalize(cameraPosition - vFaunaWorldPos);
          vec3 Nw = normalize(vFaunaWorldNormal);
          float daylight = smoothstep(-0.1, 0.25, uSunDir.y);
          float night = smoothstep(-0.05, 0.2, uMoonDir.y) * (1.0 - daylight);
          float rim = pow(clamp(1.0 - max(dot(Nw, V), 0.0), 0.0, 1.0), 2.25);
          float wrap = clamp((dot(Nw, uSunDir) + 0.42) / 1.42, 0.0, 1.0);
          float backlit = pow(clamp(dot(V, -uSunDir), 0.0, 1.0), 2.6);
          float moonBack = pow(clamp(dot(V, -uMoonDir), 0.0, 1.0), 2.8);
          float membrane = 1.0 - smoothstep(0.35, 0.65, abs(vFaunaMaterialSlot - ${FAUNA_MATERIAL_SLOT_ID.membrane.toFixed(1)}));
          float eye = 1.0 - smoothstep(0.35, 0.65, abs(vFaunaMaterialSlot - ${FAUNA_MATERIAL_SLOT_ID.eye.toFixed(1)}));
          float bodyMass = 1.0 - membrane;
          diffuseColor.rgb = mix(diffuseColor.rgb * 0.82, diffuseColor.rgb, 0.48 + wrap * 0.52);
          vFaunaGlowTerm += uFaunaRimColor * rim * (0.025 + 0.055 * daylight) * bodyMass * (1.0 - eye);
          vFaunaGlowTerm += uFaunaSSSColor * backlit * wrap * daylight * (0.035 + vFaunaFlex * 0.04) * bodyMass * (1.0 - eye);
          vFaunaGlowTerm += uFaunaSSSColor * moonBack * night * 0.014 * bodyMass;
          vFaunaGlowTerm += uFaunaWingColor * rim * membrane * (0.055 + vFaunaFlex * 0.07);
        }`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        {
          float eye = 1.0 - smoothstep(0.35, 0.65, abs(vFaunaMaterialSlot - ${FAUNA_MATERIAL_SLOT_ID.eye.toFixed(1)}));
          float horn = 1.0 - smoothstep(0.35, 0.65, abs(vFaunaMaterialSlot - ${FAUNA_MATERIAL_SLOT_ID.horn.toFixed(1)}));
          float hoof = 1.0 - smoothstep(0.35, 0.65, abs(vFaunaMaterialSlot - ${FAUNA_MATERIAL_SLOT_ID.hoof.toFixed(1)}));
          float fleece = 1.0 - smoothstep(0.35, 0.65, abs(vFaunaMaterialSlot - ${FAUNA_MATERIAL_SLOT_ID.fleece.toFixed(1)}));
          float scale = 1.0 - smoothstep(0.35, 0.65, abs(vFaunaMaterialSlot - ${FAUNA_MATERIAL_SLOT_ID.scale.toFixed(1)}));
          float membrane = 1.0 - smoothstep(0.35, 0.65, abs(vFaunaMaterialSlot - ${FAUNA_MATERIAL_SLOT_ID.membrane.toFixed(1)}));
          roughnessFactor = mix(roughnessFactor, 0.12, eye * 0.92);
          roughnessFactor = mix(roughnessFactor, 0.42, horn * 0.7);
          roughnessFactor = mix(roughnessFactor, 0.58, hoof * 0.62);
          roughnessFactor = mix(roughnessFactor, 0.98, fleece * 0.82);
          roughnessFactor = mix(roughnessFactor, 0.44, scale * 0.5);
          roughnessFactor = mix(roughnessFactor, 0.28, membrane * 0.58);
          roughnessFactor = clamp(roughnessFactor, 0.06, 1.0);
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

  material.customProgramCacheKey = () => 'fauna-field-v9';
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

  for (const voxel of voxelSystem.getAllVoxels().values()) {
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
