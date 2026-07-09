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

export const FAUNA_KINDS = ['grazer', 'woolly', 'runner', 'hopper', 'dragonfly'] as const;
export type FaunaKind = typeof FAUNA_KINDS[number];

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
}

export interface FaunaBuildResult {
  count: number;
  voxelCount: number;
  agents: FaunaAgent[];
}

export interface FaunaBuildOptions {
  existingAgents?: FaunaAgent[];
  time?: number;
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
const _b = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _movePos = new THREE.Vector3();
const _moveForward = new THREE.Vector3();
const _moveSide = new THREE.Vector3();
const _moveUp = new THREE.Vector3();
const _routeUp = new THREE.Vector3();
const _agentCullPos = new THREE.Vector3();
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

export function buildFaunaProfile(terrainSeed: number, water?: FaunaWaterClassifier): FaunaProfile {
  const s = terrainSeed | 0;
  const biome = buildBiomeProfile(s);
  const art = buildPlanetArtDirection(s);
  const wind = buildWindProfile(s, biome);
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
    dragonfly: clamp((0.1 + lushness * 0.72 + (1 - aridity) * 0.3 + temperature * 0.12) * art.ecology.faunaWeights.dragonfly, 0.001, 2.2)
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
    weights
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

function materialDensityMul(material: string, profile: FaunaProfile): number {
  if (material === MaterialType.GRASS) return 1;
  if (material === MaterialType.DIRT) return 0.52 + profile.biome.lushness * 0.24;
  if (material === MaterialType.SAND) return 0.14 + profile.biome.aridity * 0.54;
  if (material === MaterialType.STONE) return 0.08 * profile.ecology.richness;
  if (material === MaterialType.BASALT) return 0.1 * profile.ecology.richness;
  return 0;
}

function materialKindMul(material: string, kind: FaunaKind): number {
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
  const weighted = FAUNA_KINDS.map(kind => ({
    kind,
    weight: Math.max(0.001, profile.weights[kind] * materialKindMul(voxel.material, kind))
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
  if (!isFaunaSurfaceDry(x, y, z, profile)) return false;
  if (seededVoxelUnit(x, y, z, FAUNA_COVERAGE_SALT, terrainSeed) > profile.coverage) return false;
  return seededVoxelUnit(x, y, z, FAUNA_DENSITY_SALT, terrainSeed) <= placementChance(density, voxel.material, profile);
}

export function countFaunaVoxels(
  kind: FaunaKind,
  density: number,
  terrainSeed: number,
  profile = buildFaunaProfile(terrainSeed)
): number {
  if (density <= 0) return 0;
  let n = 0;
  for (const voxel of voxelSystem.getAllVoxels().values()) {
    const [x, y, z] = voxel.position;
    if (!shouldPlaceFaunaVoxel(voxel, x, y, z, density, terrainSeed, profile)) continue;
    if (chooseFaunaKindForVoxel(voxel, x, y, z, terrainSeed, profile) === kind) n++;
  }
  return n;
}

function addAttributes(
  geo: THREE.BufferGeometry,
  color: THREE.Color,
  part: number,
  flexMul: number
): THREE.BufferGeometry {
  const work = geo.index ? geo.toNonIndexed() : geo;
  work.deleteAttribute('uv');
  work.computeVertexNormals();
  work.computeBoundingBox();
  const box = work.boundingBox;
  const minY = box?.min.y ?? 0;
  const spanY = Math.max(0.001, (box?.max.y ?? 1) - minY);
  const pos = work.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const parts = new Float32Array(pos.count);
  const flex = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
    parts[i] = part;
    flex[i] = clamp(((pos.getY(i) - minY) / spanY) * flexMul, 0, 1);
  }
  work.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  work.setAttribute('aFaunaPart', new THREE.BufferAttribute(parts, 1));
  work.setAttribute('aFaunaFlex', new THREE.BufferAttribute(flex, 1));
  return work;
}

function cylinderBetween(
  a: THREE.Vector3,
  b: THREE.Vector3,
  radius: number,
  color: THREE.Color,
  part: number,
  flexMul: number,
  radialSegments = 6
): THREE.BufferGeometry {
  const dir = _b.copy(b).sub(a);
  const len = Math.max(0.001, dir.length());
  const geo = new THREE.CylinderGeometry(radius, radius * 0.88, len, radialSegments, 1);
  _quat.setFromUnitVectors(_a.set(0, 1, 0), dir.normalize());
  geo.applyQuaternion(_quat);
  _mid.copy(a).add(b).multiplyScalar(0.5);
  geo.translate(_mid.x, _mid.y, _mid.z);
  return addAttributes(geo, color, part, flexMul);
}

function ellipsoid(
  center: THREE.Vector3,
  scale: THREE.Vector3,
  color: THREE.Color,
  part: number,
  flexMul: number,
  detail = 0
): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(1, detail);
  geo.scale(scale.x, scale.y, scale.z);
  geo.translate(center.x, center.y, center.z);
  return addAttributes(geo, color, part, flexMul);
}

function cone(
  center: THREE.Vector3,
  radius: number,
  height: number,
  color: THREE.Color,
  part: number,
  flexMul: number,
  radialSegments = 5
): THREE.BufferGeometry {
  const geo = new THREE.ConeGeometry(radius, height, radialSegments, 1);
  geo.translate(center.x, center.y, center.z);
  return addAttributes(geo, color, part, flexMul);
}

function wingSheet(
  rootX: number,
  rootY: number,
  rootZ: number,
  side: number,
  length: number,
  spread: number,
  sweep: number,
  color: THREE.Color
): THREE.BufferGeometry {
  const positions = new Float32Array([
    rootX, rootY, rootZ,
    rootX + sweep + length * 0.22, rootY + 0.012, rootZ + side * spread * 0.86,
    rootX + sweep - length * 0.34, rootY - 0.01, rootZ + side * spread,
    rootX - length * 0.16, rootY, rootZ + side * spread * 0.12
  ]);
  const indices = [0, 1, 2, 0, 2, 3];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setIndex(indices);
  const work = geo.toNonIndexed();
  work.computeVertexNormals();
  const pos = work.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const parts = new Float32Array(pos.count);
  const flex = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
    parts[i] = 5;
    flex[i] = clamp(Math.abs(pos.getZ(i) - rootZ) / Math.max(0.001, spread), 0, 1);
  }
  work.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  work.setAttribute('aFaunaPart', new THREE.BufferAttribute(parts, 1));
  work.setAttribute('aFaunaFlex', new THREE.BufferAttribute(flex, 1));
  geo.dispose();
  return work;
}

function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const geo = mergeGeometries(parts, false);
  if (!geo) throw new Error('Failed to merge fauna geometry');
  geo.computeVertexNormals();
  return geo;
}

function legPair(
  x: number,
  z: number,
  hipY: number,
  footY: number,
  xLean: number,
  radius: number,
  color: THREE.Color,
  part: number
): THREE.BufferGeometry[] {
  const hip = new THREE.Vector3(x, hipY, z);
  const knee = new THREE.Vector3(x + xLean * 0.45, (hipY + footY) * 0.5, z);
  const foot = new THREE.Vector3(x + xLean, footY, z);
  return [
    cylinderBetween(hip, knee, radius, color, part, 0.7, 5),
    cylinderBetween(knee, foot, radius * 0.82, color, part, 0.9, 5),
    ellipsoid(foot, new THREE.Vector3(radius * 1.55, radius * 0.65, radius * 1.25), color, part, 0.35, 0)
  ];
}

/**
 * Horse/elk-silhouette grazer: torso carried HIGH on long slim legs (legs are
 * ~45% of standing height), a long angled neck with a mane ridge, a head with a
 * distinct muzzle, and a dropped tail fall. Feet touch local y=0 so the anchor
 * grounds the animal at any body scale. Local head-top ~1.45.
 */
function createGrazerGeometry(profile: FaunaProfile): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [
    // Torso: barrel + chest + hindquarters, slimmer than tall.
    ellipsoid(new THREE.Vector3(-0.02, 0.74, 0), new THREE.Vector3(0.5, 0.23, 0.185), profile.coatBase, 0, 0.18, 1),
    ellipsoid(new THREE.Vector3(0.28, 0.77, 0), new THREE.Vector3(0.24, 0.215, 0.17), profile.coatWarm, 0, 0.16, 1),
    ellipsoid(new THREE.Vector3(-0.34, 0.76, 0), new THREE.Vector3(0.22, 0.21, 0.175), profile.coatBase, 0, 0.16, 0),
    // Neck: long and angled, thicker at the base.
    cylinderBetween(new THREE.Vector3(0.42, 0.84, 0), new THREE.Vector3(0.68, 1.16, 0), 0.095, profile.coatBase, 1, 0.55, 7),
    // Head + muzzle.
    ellipsoid(new THREE.Vector3(0.76, 1.22, 0), new THREE.Vector3(0.145, 0.105, 0.09), profile.coatBase, 1, 0.45, 1),
    ellipsoid(new THREE.Vector3(0.91, 1.15, 0), new THREE.Vector3(0.1, 0.06, 0.06), profile.coatWarm, 1, 0.45, 0),
    // Ears.
    cone(new THREE.Vector3(0.7, 1.36, 0.055), 0.034, 0.13, profile.coatCool, 4, 1, 5),
    cone(new THREE.Vector3(0.7, 1.36, -0.055), 0.034, 0.13, profile.coatCool, 4, 1, 5),
    // Eyes.
    ellipsoid(new THREE.Vector3(0.83, 1.24, 0.082), new THREE.Vector3(0.022, 0.028, 0.015), profile.darkColor, 1, 0.2, 0),
    ellipsoid(new THREE.Vector3(0.83, 1.24, -0.082), new THREE.Vector3(0.022, 0.028, 0.015), profile.darkColor, 1, 0.2, 0),
    // Tail: short dock + hanging hair fall.
    cylinderBetween(new THREE.Vector3(-0.54, 0.8, 0), new THREE.Vector3(-0.63, 0.64, 0.015), 0.032, profile.darkColor, 4, 1, 5),
    ellipsoid(new THREE.Vector3(-0.65, 0.49, 0.02), new THREE.Vector3(0.055, 0.17, 0.045), profile.darkColor, 4, 1, 0)
  ];
  // Mane ridge along the top of the neck.
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    parts.push(ellipsoid(
      new THREE.Vector3(0.38 + t * 0.3, 0.92 + t * 0.35, 0),
      new THREE.Vector3(0.055, 0.078, 0.028),
      profile.darkColor,
      4,
      0.8,
      0
    ));
  }
  // Long slim legs; hooves (foot blobs) reach local y~0.
  [-0.125, 0.125].forEach(z => {
    parts.push(...legPair(0.32, z, 0.6, 0.028, 0.03, 0.037, profile.coatCool, 2));
    parts.push(...legPair(-0.35, z, 0.6, 0.028, -0.035, 0.04, profile.coatCool, 3));
  });
  return merge(parts);
}

/**
 * Sheep/yak woolly: a fat fleece mass built from overlapping clump shells with
 * a low skirt that hides the leg tops, a wool cap over the brow, a dark bare
 * face, and small curled horns.
 */
function createWoollyGeometry(profile: FaunaProfile): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [
    ellipsoid(new THREE.Vector3(0, 0.5, 0), new THREE.Vector3(0.4, 0.29, 0.24), profile.woolColor, 0, 0.28, 1)
  ];
  const clumps: Array<[number, number, number, number]> = [
    // Back and shoulders.
    [-0.2, 0.58, 0.15, 0.17],
    [0.03, 0.66, 0.17, 0.18],
    [0.22, 0.57, 0.12, 0.16],
    [-0.24, 0.52, -0.13, 0.16],
    [0.02, 0.62, -0.18, 0.17],
    [0.23, 0.52, -0.1, 0.15],
    [-0.08, 0.76, 0, 0.16],
    [0.1, 0.74, 0.06, 0.14],
    [-0.16, 0.72, -0.08, 0.14],
    // Low fleece skirt hanging over the leg tops.
    [0.16, 0.34, 0.16, 0.13],
    [-0.14, 0.33, 0.17, 0.13],
    [0.15, 0.34, -0.17, 0.13],
    [-0.16, 0.33, -0.16, 0.13],
    [-0.32, 0.4, 0, 0.14],
    [0.32, 0.4, 0.02, 0.13]
  ];
  clumps.forEach(([x, y, z, r], index) => {
    parts.push(ellipsoid(
      new THREE.Vector3(x, y, z),
      new THREE.Vector3(r * 1.05, r * 0.78, r),
      profile.woolColor.clone().lerp(profile.coatWarm, index * 0.02),
      0,
      0.46,
      0
    ));
  });
  parts.push(
    // Dark bare face with a wool cap over the brow.
    cylinderBetween(new THREE.Vector3(0.29, 0.58, 0), new THREE.Vector3(0.43, 0.6, 0), 0.08, profile.darkColor, 1, 0.35, 6),
    ellipsoid(new THREE.Vector3(0.54, 0.61, 0), new THREE.Vector3(0.15, 0.11, 0.1), profile.darkColor, 1, 0.42, 0),
    ellipsoid(new THREE.Vector3(0.62, 0.58, 0), new THREE.Vector3(0.07, 0.055, 0.06), profile.darkColor, 1, 0.35, 0),
    ellipsoid(new THREE.Vector3(0.47, 0.72, 0), new THREE.Vector3(0.12, 0.085, 0.1), profile.woolColor, 1, 0.4, 0),
    // Eyes.
    ellipsoid(new THREE.Vector3(0.57, 0.66, 0.078), new THREE.Vector3(0.02, 0.023, 0.013), profile.accentColor, 1, 0.2, 0),
    ellipsoid(new THREE.Vector3(0.57, 0.66, -0.078), new THREE.Vector3(0.02, 0.023, 0.013), profile.accentColor, 1, 0.2, 0),
    // Drooped ears.
    cone(new THREE.Vector3(0.45, 0.68, 0.13), 0.038, 0.11, profile.darkColor, 4, 0.9, 5),
    cone(new THREE.Vector3(0.45, 0.68, -0.13), 0.038, 0.11, profile.darkColor, 4, 0.9, 5),
    // Small curled horns: two angled segments per side.
    cylinderBetween(new THREE.Vector3(0.44, 0.76, 0.08), new THREE.Vector3(0.5, 0.82, 0.15), 0.025, profile.coatCool, 4, 0.6, 5),
    cylinderBetween(new THREE.Vector3(0.5, 0.82, 0.15), new THREE.Vector3(0.55, 0.78, 0.2), 0.019, profile.coatCool, 4, 0.6, 5),
    cylinderBetween(new THREE.Vector3(0.44, 0.76, -0.08), new THREE.Vector3(0.5, 0.82, -0.15), 0.025, profile.coatCool, 4, 0.6, 5),
    cylinderBetween(new THREE.Vector3(0.5, 0.82, -0.15), new THREE.Vector3(0.55, 0.78, -0.2), 0.019, profile.coatCool, 4, 0.6, 5),
    // Wool stub tail.
    ellipsoid(new THREE.Vector3(-0.42, 0.6, 0), new THREE.Vector3(0.075, 0.06, 0.06), profile.woolColor, 4, 0.8, 0)
  );
  [-0.11, 0.11].forEach(z => {
    parts.push(...legPair(0.21, z, 0.36, 0.024, 0.02, 0.036, profile.darkColor, 2));
    parts.push(...legPair(-0.22, z, 0.36, 0.024, -0.02, 0.036, profile.darkColor, 3));
  });
  return merge(parts);
}

/**
 * Fox-silhouette runner: deep chest tapering to a slim waist, a long bushy
 * tail carried low with a pale tip, tall alert ears, and a pointed muzzle
 * ending in a dark nose. Feet touch local y=0.
 */
function createRunnerGeometry(profile: FaunaProfile): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [
    // Chest-forward torso, tapering rear.
    ellipsoid(new THREE.Vector3(0.04, 0.46, 0), new THREE.Vector3(0.3, 0.17, 0.14), profile.coatWarm, 0, 0.2, 1),
    ellipsoid(new THREE.Vector3(0.2, 0.44, 0), new THREE.Vector3(0.17, 0.19, 0.15), profile.coatWarm, 0, 0.18, 0),
    ellipsoid(new THREE.Vector3(-0.22, 0.48, 0), new THREE.Vector3(0.18, 0.145, 0.12), profile.coatBase, 0, 0.18, 0),
    // Pale chest tuft.
    ellipsoid(new THREE.Vector3(0.3, 0.36, 0), new THREE.Vector3(0.1, 0.11, 0.1), profile.woolColor, 0, 0.2, 0),
    // Head, pointed muzzle, dark nose.
    ellipsoid(new THREE.Vector3(0.45, 0.6, 0), new THREE.Vector3(0.14, 0.11, 0.095), profile.coatWarm, 1, 0.45, 1),
    ellipsoid(new THREE.Vector3(0.6, 0.55, 0), new THREE.Vector3(0.1, 0.05, 0.048), profile.coatCool, 1, 0.42, 0),
    ellipsoid(new THREE.Vector3(0.69, 0.54, 0), new THREE.Vector3(0.026, 0.024, 0.024), profile.darkColor, 1, 0.35, 0),
    // Tall alert ears.
    cone(new THREE.Vector3(0.4, 0.79, 0.065), 0.046, 0.2, profile.coatCool, 4, 1, 5),
    cone(new THREE.Vector3(0.4, 0.79, -0.065), 0.046, 0.2, profile.coatCool, 4, 1, 5),
    // Eyes.
    ellipsoid(new THREE.Vector3(0.55, 0.63, 0.082), new THREE.Vector3(0.02, 0.024, 0.014), profile.darkColor, 1, 0.2, 0),
    ellipsoid(new THREE.Vector3(0.55, 0.63, -0.082), new THREE.Vector3(0.02, 0.024, 0.014), profile.darkColor, 1, 0.2, 0),
    // Bushy tail: dock low, brush swelling behind, pale tip curling up.
    cylinderBetween(new THREE.Vector3(-0.34, 0.46, 0), new THREE.Vector3(-0.52, 0.4, 0.02), 0.042, profile.coatBase, 4, 1, 6),
    ellipsoid(new THREE.Vector3(-0.6, 0.4, 0.03), new THREE.Vector3(0.1, 0.082, 0.078), profile.coatWarm, 4, 1, 0),
    ellipsoid(new THREE.Vector3(-0.73, 0.44, 0.04), new THREE.Vector3(0.105, 0.085, 0.08), profile.coatBase, 4, 1, 0),
    ellipsoid(new THREE.Vector3(-0.84, 0.5, 0.045), new THREE.Vector3(0.062, 0.055, 0.05), profile.woolColor, 4, 1, 0)
  ];
  [-0.09, 0.09].forEach(z => {
    parts.push(...legPair(0.2, z, 0.36, 0.022, 0.06, 0.031, profile.darkColor, 2));
    parts.push(...legPair(-0.2, z, 0.36, 0.022, -0.07, 0.033, profile.darkColor, 3));
  });
  return merge(parts);
}

function createHopperGeometry(profile: FaunaProfile): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [
    ellipsoid(new THREE.Vector3(-0.05, 0.34, 0), new THREE.Vector3(0.24, 0.16, 0.14), profile.coatCool, 0, 0.2, 1),
    ellipsoid(new THREE.Vector3(0.2, 0.47, 0), new THREE.Vector3(0.13, 0.1, 0.09), profile.coatBase, 1, 0.5, 0),
    ellipsoid(new THREE.Vector3(0.31, 0.44, 0), new THREE.Vector3(0.06, 0.04, 0.05), profile.coatWarm, 1, 0.4, 0),
    cone(new THREE.Vector3(0.15, 0.67, 0.055), 0.032, 0.22, profile.coatWarm, 4, 1, 5),
    cone(new THREE.Vector3(0.15, 0.67, -0.055), 0.032, 0.22, profile.coatWarm, 4, 1, 5),
    ellipsoid(new THREE.Vector3(0.3, 0.49, 0.075), new THREE.Vector3(0.017, 0.021, 0.012), profile.darkColor, 1, 0.2, 0),
    ellipsoid(new THREE.Vector3(0.3, 0.49, -0.075), new THREE.Vector3(0.017, 0.021, 0.012), profile.darkColor, 1, 0.2, 0),
    ellipsoid(new THREE.Vector3(-0.28, 0.36, 0), new THREE.Vector3(0.06, 0.04, 0.04), profile.coatWarm, 4, 0.75, 0)
  ];
  [-0.075, 0.075].forEach(z => {
    parts.push(...legPair(0.12, z, 0.25, 0.02, 0.06, 0.026, profile.darkColor, 2));
    // Oversized haunches sell the hop silhouette.
    parts.push(...legPair(-0.18, z, 0.26, 0.022, -0.15, 0.043, profile.darkColor, 3));
  });
  return merge(parts);
}

function createDragonflyGeometry(profile: FaunaProfile): THREE.BufferGeometry {
  const body = profile.darkColor.clone().lerp(profile.accentColor, 0.36);
  const gold = profile.coatWarm.clone().lerp(profile.accentColor, 0.28);
  const eye = profile.wingColor.clone().lerp(profile.accentColor, 0.3);
  const parts: THREE.BufferGeometry[] = [
    cylinderBetween(new THREE.Vector3(-0.66, 0.48, 0), new THREE.Vector3(-0.08, 0.49, 0), 0.035, body, 0, 0.45, 7),
    ellipsoid(new THREE.Vector3(0.03, 0.5, 0), new THREE.Vector3(0.13, 0.09, 0.075), body, 0, 0.36, 1),
    ellipsoid(new THREE.Vector3(0.23, 0.51, 0), new THREE.Vector3(0.09, 0.07, 0.068), body, 1, 0.44, 0),
    ellipsoid(new THREE.Vector3(0.29, 0.54, 0.052), new THREE.Vector3(0.04, 0.04, 0.034), eye, 1, 0.35, 0),
    ellipsoid(new THREE.Vector3(0.29, 0.54, -0.052), new THREE.Vector3(0.04, 0.04, 0.034), eye, 1, 0.35, 0),
    wingSheet(0.0, 0.58, 0.055, 1, 0.48, 0.62, 0.16, profile.wingColor),
    wingSheet(0.0, 0.58, -0.055, -1, 0.48, 0.62, 0.16, profile.wingColor),
    wingSheet(-0.12, 0.565, 0.05, 1, 0.38, 0.48, -0.08, profile.wingColor.clone().lerp(gold, 0.18)),
    wingSheet(-0.12, 0.565, -0.05, -1, 0.38, 0.48, -0.08, profile.wingColor.clone().lerp(gold, 0.18))
  ];
  const legPairs: Array<[number, number]> = [[0.08, 0.09], [0, 0], [-0.1, -0.1]];
  legPairs.forEach(([x, dx]) => {
    parts.push(
      cylinderBetween(new THREE.Vector3(x, 0.43, 0.05), new THREE.Vector3(x + dx, 0.29, 0.18), 0.008, body, 4, 0.75, 4),
      cylinderBetween(new THREE.Vector3(x, 0.43, -0.05), new THREE.Vector3(x + dx, 0.29, -0.18), 0.008, body, 4, 0.75, 4)
    );
  });
  for (let i = 0; i < 5; i++) {
    parts.push(ellipsoid(
      new THREE.Vector3(-0.58 + i * 0.1, 0.49, 0),
      new THREE.Vector3(0.028, 0.029, 0.03),
      i % 2 === 0 ? gold : body,
      0,
      0.24,
      0
    ));
  }
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
  }
  return createGrazerGeometry(profile);
}

export function faunaKindId(kind: FaunaKind): number {
  switch (kind) {
    case 'grazer':
      return 0;
    case 'woolly':
      return 1;
    case 'runner':
      return 2;
    case 'hopper':
      return 3;
    case 'dragonfly':
      return 4;
  }
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
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    side: THREE.DoubleSide,
    transparent: true,
    alphaTest: 0.025,
    depthWrite: true,
    depthTest: true,
    roughness: 0.82,
    metalness: 0.0
  });

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
        attribute float aFaunaPart;
        attribute float aFaunaFlex;
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
        varying float vFaunaPart;
        varying float vFaunaFlex;
        varying float vFaunaGust;
        varying float vFaunaShade;
        varying float vFaunaSeed;
        varying vec3 vFaunaLocalPos;
        varying vec3 vFaunaWorldPos;
        varying vec3 vFaunaWorldNormal;
        ${FAUNA_NOISE}`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vFaunaPart = aFaunaPart;
        vFaunaFlex = aFaunaFlex;
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
        float trotWave = sin(stridePhase * (1.0 + seed * 0.035));
        float breathWave = sin(uTime * (0.74 + seed * 0.18) + phase);
        float side = sign(position.z + 0.001);
        float motion = uFaunaMotion;
        float bodyBob = (abs(stepWave) * 0.016 + breathWave * 0.006) * motion;
        // Legs pivot from the hip: swing amplitude grows toward the foot so the
        // hip stays planted in the body and the FOOT strides — instead of the
        // whole leg translating and skating over the ground.
        float legSwing = smoothstep(0.62, 0.04, position.y);
        // Hoppers bounce instead of trotting: the whole body arcs with the
        // stride cycle while the legs tuck (front) and extend (hind).
        float hopKind = 1.0 - smoothstep(0.35, 0.65, abs(uFaunaKind - 3.0));
        float hop = pow(max(0.0, stepWave), 1.6) * hopKind * motion;
        if (aFaunaPart < 0.5) {
          transformed.y += bodyBob + hop * 0.14;
          // Fore-aft walk rock: shoulders and hips counter-dip with the stride.
          transformed.y += stepWave * position.x * 0.02 * (1.0 - hopKind) * motion;
        } else if (aFaunaPart < 1.5) {
          transformed.y += (sin(uTime * (2.1 + seed) + phase) * 0.02 + bodyBob) * motion + hop * 0.14;
          // Stride-coupled head nod (horses nod as they walk).
          transformed.y += stepWave * 0.02 * (1.0 - hopKind) * motion;
          transformed.x += cos(uTime * 1.4 + phase) * 0.012 * motion;
        } else if (aFaunaPart < 2.5) {
          float gait = trotWave * side * (1.0 - hopKind);
          transformed.x += gait * 0.2 * legSwing * motion;
          transformed.y += max(0.0, gait) * 0.11 * legSwing * motion + hop * 0.1;
          transformed.x -= hop * legSwing * 0.08;
        } else if (aFaunaPart < 3.5) {
          float gait = -trotWave * side * (1.0 - hopKind);
          transformed.x += gait * 0.22 * legSwing * motion;
          transformed.y += max(0.0, gait) * 0.12 * legSwing * motion + hop * 0.1;
          transformed.x += hop * legSwing * 0.1;
        } else if (aFaunaPart < 4.5) {
          float tail = sin(uTime * (4.1 + uWindGustSpeed + seed) + phase + position.x * 3.0);
          transformed.z += tail * (0.045 + aFaunaFlex * 0.07) * motion;
          transformed.y += gust * aFaunaFlex * 0.018 * uWindGustStrength * motion + hop * 0.12;
        } else {
          float wing = sin(uTime * (34.0 + seed * 12.0) + phase + side * 0.8);
          float wing2 = cos(uTime * (27.0 + seed * 9.0) + phase + position.x * 2.2);
          transformed.y += wing * (0.035 + aFaunaFlex * 0.14) * motion;
          transformed.z += side * wing2 * aFaunaFlex * 0.03 * motion;
          transformed.x += sin(uTime * 4.3 + phase) * aFaunaFlex * 0.012 * motion;
        }
        float windFlex = max(0.0, aFaunaFlex - 0.28);
        float windWave = sin(uTime * (1.15 + uWindGustSpeed) + phase + position.y * 2.2);
        float windDrive = (windWave * (0.2 + gust * uWindGustStrength) + uWindTurbulence * 0.05) * windFlex * motion;
        transformed.x += windDir.x * windDrive * 0.045 * uWindStrength;
        transformed.z += windDir.y * windDrive * 0.045 * uWindStrength;
        // Grazing pose: fold the head/neck (and its riders — ears, mane, horns)
        // down toward the ground around the neck root, with a gentle nibble bob.
        float graze = clamp(aFaunaPose, 0.0, 1.0);
        bool grazeBone = (aFaunaPart >= 0.5 && aFaunaPart < 1.5)
          || (aFaunaPart >= 3.5 && aFaunaPart < 4.5 && position.x > 0.3);
        if (graze > 0.003 && grazeBone) {
          float woollyKind = 1.0 - smoothstep(0.35, 0.65, abs(uFaunaKind - 1.0));
          vec2 pivot = mix(vec2(0.42, 0.8), vec2(0.3, 0.56), woollyKind);
          float ang = graze * (1.05 - woollyKind * 0.42);
          float ca = cos(ang);
          float sa = sin(ang);
          vec2 rel = vec2(transformed.x - pivot.x, transformed.y - pivot.y);
          transformed.x = pivot.x + rel.x * ca + rel.y * sa;
          transformed.y = pivot.y - rel.x * sa + rel.y * ca;
          transformed.y -= graze * (0.5 + 0.5 * sin(uTime * 2.4 + phase)) * 0.028 * motion;
        }
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
        varying float vFaunaPart;
        varying float vFaunaFlex;
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
        float bodyPart = 1.0 - smoothstep(1.35, 1.65, vFaunaPart);
        float headPart = 1.0 - smoothstep(0.35, 0.65, abs(vFaunaPart - 1.0));
        float legPart = smoothstep(1.5, 2.2, vFaunaPart) * (1.0 - smoothstep(3.35, 3.6, vFaunaPart));
        float accentPart = smoothstep(3.45, 4.2, vFaunaPart) * (1.0 - smoothstep(4.45, 4.7, vFaunaPart));
        float wingPart = smoothstep(4.5, 5.5, vFaunaPart);

        float dorsal = smoothstep(-0.08, 0.2, p.y) * (1.0 - smoothstep(0.10, 0.34, abs(p.z)));
        // Belly band scaled for the raised horse-height torso (body ~0.5-1.0).
        float underside = smoothstep(0.7, 0.25, p.y);
        float spots = smoothstep(0.68, 0.96, fnNoise(p.xz * 9.0 + vec2(vFaunaSeed * 11.0, uFaunaKind * 3.7)));
        float bands = smoothstep(0.88, 1.0, abs(sin((p.x + vFaunaSeed) * 18.0)));
        float wool = fnNoise(p.xz * 15.0 + vec2(p.y * 2.0 + vFaunaSeed * 4.0, uFaunaKind));
        float kindGrazer = 1.0 - smoothstep(0.35, 0.65, abs(uFaunaKind - 0.0));
        float kindWoolly = 1.0 - smoothstep(0.35, 0.65, abs(uFaunaKind - 1.0));
        float kindRunner = 1.0 - smoothstep(0.35, 0.65, abs(uFaunaKind - 2.0));
        float kindHopper = 1.0 - smoothstep(0.35, 0.65, abs(uFaunaKind - 3.0));
        float kindDragonfly = 1.0 - smoothstep(0.35, 0.65, abs(uFaunaKind - 4.0));

        diffuseColor.rgb *= 0.76 + vFaunaShade * 0.24 + vFaunaGust * 0.055 + vFaunaFlex * 0.035;
        diffuseColor.rgb *= 1.0 - underside * bodyPart * 0.18;
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.68, 0.72, 0.76), dorsal * bodyPart * kindGrazer * 0.34);
        diffuseColor.rgb *= 0.9 + wool * bodyPart * kindWoolly * 0.22;
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * (0.72 + bands * 0.42), bodyPart * kindRunner * 0.26);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * (0.78 + spots * 0.38), bodyPart * kindHopper * 0.32);
        diffuseColor.rgb = mix(diffuseColor.rgb, mix(diffuseColor.rgb, uFaunaRimColor, bands * 0.26), bodyPart * kindDragonfly);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.62, legPart * 0.38);
        diffuseColor.rgb += uFaunaRimColor * accentPart * 0.045;
        diffuseColor.rgb = mix(diffuseColor.rgb, mix(uFaunaWingColor, uFaunaWingColor + vec3(0.16, 0.2, 0.22), vFaunaFlex), wingPart * (0.62 + vFaunaGust * 0.16));
        diffuseColor.rgb += vec3(0.025, 0.02, 0.012) * accentPart * (1.0 - wingPart);
        diffuseColor.rgb += vec3((fnNoise(gl_FragCoord.xy * 0.55 + vec2(vFaunaSeed)) - 0.5) * (1.0 / 255.0));`
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
          float wingPart = smoothstep(4.5, 5.5, vFaunaPart);
          float bodyMass = 1.0 - wingPart;
          diffuseColor.rgb = mix(diffuseColor.rgb * 0.82, diffuseColor.rgb, 0.48 + wrap * 0.52);
          vFaunaGlowTerm += uFaunaRimColor * rim * (0.08 + 0.16 * daylight) * bodyMass;
          vFaunaGlowTerm += uFaunaSSSColor * backlit * wrap * daylight * (0.12 + vFaunaFlex * 0.16) * bodyMass;
          vFaunaGlowTerm += uFaunaSSSColor * moonBack * night * 0.045 * bodyMass;
          vFaunaGlowTerm += uFaunaWingColor * rim * wingPart * (0.16 + vFaunaFlex * 0.2);
        }`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        {
          float wingPart = smoothstep(4.5, 5.5, vFaunaPart);
          float legPart = smoothstep(1.5, 2.2, vFaunaPart) * (1.0 - smoothstep(3.35, 3.6, vFaunaPart));
          roughnessFactor = mix(roughnessFactor, 0.34, wingPart * 0.55);
          roughnessFactor = clamp(roughnessFactor + legPart * 0.08, 0.0, 1.0);
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
        diffuseColor.a *= clamp(uFaunaVisibility, 0.0, 1.0);
        diffuseColor.a *= mix(1.0, 0.34 + vFaunaFlex * 0.22 + vFaunaGust * 0.08, smoothstep(4.5, 5.5, vFaunaPart));`
      );
  };

  material.customProgramCacheKey = () => 'fauna-field-v6';
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
            0.68;
  return Math.max(0.18, base + climate + (jitter - 0.5) * 0.16);
}

// Stride cycles per unit of travel — large animals take slower, longer steps.
function faunaStrideRateForKind(kind: FaunaKind): number {
  if (kind === 'runner') return 1.1;
  if (kind === 'hopper') return 0.85;
  if (kind === 'dragonfly') return 2.2;
  if (kind === 'woolly') return 0.72;
  return 0.56;
}

export function faunaLevelTransitionLift(kind: FaunaKind, levelDelta: number, progress: number): number {
  const amount = Math.abs(levelDelta);
  if (amount < 0.001) return 0;
  const t = clamp(progress, 0, 1);
  const base =
    kind === 'dragonfly' ? 0.38 :
      kind === 'hopper' ? 0.62 :
        kind === 'runner' ? 0.8 :
          kind === 'woolly' ? 0.95 :
            1.12;
  return (base + Math.min(2, amount) * VOXEL_SCALE * 0.18) * Math.sin(Math.PI * t);
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

  const hoverOffset = kind === 'dragonfly' ? 1.72 + scaleSeed * 0.42 : FAUNA_SURFACE_OFFSET;
  const scatter = kind === 'dragonfly' ? 1.2 : 0.74;
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

function mod4(n: number): number {
  return ((n % 4) + 4) % 4;
}

function findFaunaTravelCandidate(
  kind: FaunaKind,
  x: number,
  y: number,
  z: number,
  directionIndex: number,
  profile: FaunaProfile
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
    // Ground fauna never wade: submerged coast/lakebed voxels are off-limits.
    if (kind !== 'dragonfly' && !isFaunaSurfaceDry(nx, ny, nz, profile)) continue;
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

function isHerdKind(kind: FaunaKind): boolean {
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
  fleeFrom?: THREE.Vector3 | null
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
        const candidate = findFaunaTravelCandidate(agent.kind, agent.x, agent.y, agent.z, candidateDir, profile);
        if (!candidate) continue;
        agent.directionIndex = mod4(candidateDir);
        return candidate;
      }
      agent.directionIndex = mod4(agent.directionIndex + 2);
      return [agent.x, agent.y, agent.z];
    }
  }

  for (const candidateDir of [agent.directionIndex, agent.directionIndex + 1, agent.directionIndex - 1, agent.directionIndex + 2]) {
    const candidate = findFaunaTravelCandidate(agent.kind, agent.x, agent.y, agent.z, candidateDir, profile);
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
  fleeFrom?: THREE.Vector3 | null
): void {
  agent.stepCount += 1;
  agent.x = agent.toX;
  agent.y = agent.toY;
  agent.z = agent.toZ;
  agent.from.copy(agent.to);
  const [nx, ny, nz] = chooseFaunaNextVoxel(agent, terrainSeed, profile, herdmates, fleeFrom);
  agent.toX = nx;
  agent.toY = ny;
  agent.toZ = nz;
  computeFaunaAnchor(nx, ny, nz, agent.kind, agent.offsetU, agent.offsetV, agent.scaleSeed, agent.to);
}

function createFaunaAgent(
  kind: FaunaKind,
  x: number,
  y: number,
  z: number,
  terrainSeed: number,
  profile: FaunaProfile
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
  setFaunaRoute(agent, terrainSeed, profile);
  return agent;
}

function agentLevelDelta(agent: FaunaAgent): number {
  const [ux, uy, uz] = surfaceUpCoordStep(agent.x, agent.y, agent.z);
  return (agent.toX - agent.x) * ux + (agent.toY - agent.y) * uy + (agent.toZ - agent.z) * uz;
}

function computeFaunaAgentCullPosition(agent: FaunaAgent, target: THREE.Vector3): THREE.Vector3 {
  const t = clamp(agent.progress, 0, 1);
  const eased = t * t * (3 - 2 * t);
  return target.copy(agent.from).lerp(agent.to, eased);
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
  profile: FaunaProfile
): boolean {
  if (agent.kind !== kind || agent.terrainSeed !== terrainSeed) return false;
  const homeVoxel = voxelSystem.getVoxel(agent.homeX, agent.homeY, agent.homeZ);
  const currentVoxel = voxelSystem.getVoxel(agent.x, agent.y, agent.z);
  const targetVoxel = voxelSystem.getVoxel(agent.toX, agent.toY, agent.toZ);
  if (!homeVoxel || !currentVoxel || !targetVoxel) return false;
  if (!shouldPlaceFaunaVoxel(homeVoxel, agent.homeX, agent.homeY, agent.homeZ, density, terrainSeed, profile)) return false;
  if (chooseFaunaKindForVoxel(homeVoxel, agent.homeX, agent.homeY, agent.homeZ, terrainSeed, profile) !== kind) return false;
  if (kind !== 'dragonfly' && (
    !isFaunaSurfaceDry(agent.x, agent.y, agent.z, profile) ||
    !isFaunaSurfaceDry(agent.toX, agent.toY, agent.toZ, profile)
  )) return false;
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
  const eased = t * t * (3 - 2 * t);
  _movePos.copy(agent.from).lerp(agent.to, eased);
  _routeUp.copy(FACE_NORMALS[dominantFaceForPosition(agent.from)]);
  _movePos.addScaledVector(_routeUp, faunaLevelTransitionLift(agent.kind, agentLevelDelta(agent), eased));
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
  if (!isHerdKind(agent.kind)) return false;
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

export function updateFaunaAgents(
  mesh: THREE.InstancedMesh,
  agents: FaunaAgent[],
  time: number,
  deltaTime: number,
  terrainSeed: number,
  profile = buildFaunaProfile(terrainSeed),
  playerWorld: THREE.Vector3 | null = null,
  playerVelocity: THREE.Vector3 | null = null
): FaunaBuildResult {
  const dt = clamp(deltaTime, 0, 0.12);
  const count = Math.min(agents.length, mesh.instanceMatrix.count);
  const strideAttr = mesh.geometry.getAttribute('aFaunaStride') as THREE.InstancedBufferAttribute | undefined;
  const poseAttr = mesh.geometry.getAttribute('aFaunaPose') as THREE.InstancedBufferAttribute | undefined;
  for (let i = 0; i < count; i++) {
    const agent = agents[i];
    if (playerWorld) maybeStartFleeing(agent, time, playerWorld, playerVelocity);
    const fleeing = time < agent.fleeUntil;
    const grazing = !fleeing && time < agent.grazeUntil;
    const fleeFrom = fleeing ? playerWorld : null;
    const speedMul = fleeing ? FLEE_SPEED_MUL : 1;
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
        setFaunaRoute(agent, terrainSeed, profile, agents, fleeFrom);
        if (agent.from.distanceToSquared(agent.to) < 0.0001) {
          agent.progress = 0;
          break;
        }
      }
    } else {
      agent.progress = 0;
      setFaunaRoute(agent, terrainSeed, profile, agents, fleeFrom);
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
    if (!isFaunaAgentStillValid(kind, agent, density, terrainSeed, profile)) continue;
    if (!isFaunaAgentVisibleInRange(agent, maxDistance, playerWorld)) continue;
    addAgent(agent, true);
  }

  for (const voxel of voxelSystem.getAllVoxels().values()) {
    if (agents.length >= capacity) break;
    const [x, y, z] = voxel.position;
    if (includedHomes.has(faunaAgentKey(kind, x, y, z))) continue;
    if (!shouldPlaceFaunaVoxel(voxel, x, y, z, density, terrainSeed, profile)) continue;
    if (chooseFaunaKindForVoxel(voxel, x, y, z, terrainSeed, profile) !== kind) continue;
    if (!isFaunaTravelVoxel(kind, voxel, profile)) continue;

    voxelCoordToWorld(x, y, z, _world);
    if (maxDistance > 0 && playerWorld && _world.distanceToSquared(playerWorld) > maxDistSq) continue;

    const agent = createFaunaAgent(kind, x, y, z, terrainSeed, profile);
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
