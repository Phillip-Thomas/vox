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

export const FAUNA_KINDS = ['grazer', 'woolly', 'runner', 'hopper', 'dragonfly'] as const;
export type FaunaKind = typeof FAUNA_KINDS[number];

export interface FaunaProfile {
  terrainSeed: number;
  biome: BiomeProfile;
  wind: WindProfile;
  densityMul: number;
  coverage: number;
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

export interface FaunaAgent {
  kind: FaunaKind;
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
  stepSalt: number;
  stepCount: number;
  orientation: THREE.Quaternion;
}

const FAUNA_SURFACE_OFFSET = 1.08;
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

export function buildFaunaProfile(terrainSeed: number): FaunaProfile {
  const s = terrainSeed | 0;
  const biome = buildBiomeProfile(s);
  const wind = buildWindProfile(s, biome);
  const { aridity, hue, lushness, saturation, temperature } = biome;
  const hueJitter = (seededUnit(s, 451) - 0.5) * 0.09;
  const coatHue = (hue + hueJitter + 0.035 + aridity * 0.035 + 1) % 1;
  const sat = clamp(saturation * 0.5 + lushness * 0.12 - aridity * 0.08, 0.18, 0.68);

  const coatBase = hsl(coatHue, sat, 0.42 + lushness * 0.05);
  const coatWarm = hsl(coatHue + 0.06, clamp(sat + 0.05, 0, 0.72), 0.5 + temperature * 0.05);
  const coatCool = hsl(coatHue - 0.08, clamp(sat + 0.03, 0, 0.72), 0.34 + lushness * 0.04);
  const woolColor = hsl(coatHue + 0.035, clamp(sat * 0.28, 0.08, 0.36), 0.78 - aridity * 0.12);
  const darkColor = hsl(coatHue - 0.04, clamp(sat * 0.55, 0.12, 0.46), 0.16 + lushness * 0.03);
  const accentColor = biome.alien
    ? hsl(biome.leafHue + 0.18, 0.62, 0.54)
    : lin(0x2f2118);
  const wingColor = hsl(biome.leafHue + 0.42, 0.34 + lushness * 0.16, 0.72);

  const densityMul = clamp(0.18 + lushness * 0.68 + (1 - aridity) * 0.2, 0.12, 1.08);
  const coverage = clamp(0.08 + lushness * 0.28 + (1 - aridity) * 0.08, 0.05, 0.44);

  const weights: Record<FaunaKind, number> = {
    grazer: clamp(0.14 + lushness * 0.82 + (1 - aridity) * 0.28 - temperature * 0.08, 0.03, 1.38),
    woolly: clamp(0.1 + lushness * 0.48 + (1 - temperature) * 0.32 - aridity * 0.24, 0.025, 1.12),
    runner: clamp(0.16 + aridity * 0.38 + temperature * 0.34 + (1 - lushness) * 0.1, 0.05, 1.25),
    hopper: clamp(0.14 + aridity * 0.72 + (1 - lushness) * 0.32, 0.04, 1.4),
    dragonfly: clamp(0.1 + lushness * 0.72 + (1 - aridity) * 0.3 + temperature * 0.12, 0.025, 1.25)
  };

  return {
    terrainSeed: s,
    biome,
    wind,
    densityMul,
    coverage,
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

export function isFaunaTravelVoxel(
  kind: FaunaKind,
  voxel: { material: string; supportsSurfaceResources?: boolean },
  profile: FaunaProfile
): boolean {
  if (!isFaunaEligibleVoxel(voxel)) return false;
  if (voxel.material === MaterialType.GRASS) return kind !== 'hopper' || profile.biome.lushness < 0.76;
  if (voxel.material === MaterialType.DIRT) return true;
  if (voxel.material === MaterialType.SAND) {
    if (kind === 'hopper') return true;
    if (kind === 'runner') return profile.biome.aridity > 0.28 || profile.biome.temperature > 0.58;
    if (kind === 'dragonfly') return profile.biome.aridity > 0.58;
    return false;
  }
  return false;
}

function materialDensityMul(material: string, profile: FaunaProfile): number {
  if (material === MaterialType.GRASS) return 1;
  if (material === MaterialType.DIRT) return 0.52 + profile.biome.lushness * 0.24;
  if (material === MaterialType.SAND) return 0.14 + profile.biome.aridity * 0.54;
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
  if (density <= 0 || !isFaunaEligibleVoxel(voxel)) return false;
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

function createGrazerGeometry(profile: FaunaProfile): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [
    ellipsoid(new THREE.Vector3(0, 0.56, 0), new THREE.Vector3(0.48, 0.25, 0.2), profile.coatBase, 0, 0.18, 1),
    ellipsoid(new THREE.Vector3(0.18, 0.6, 0), new THREE.Vector3(0.25, 0.23, 0.18), profile.coatWarm, 0, 0.16, 0),
    cylinderBetween(new THREE.Vector3(0.34, 0.66, 0), new THREE.Vector3(0.56, 0.85, 0), 0.105, profile.coatBase, 1, 0.55, 6),
    ellipsoid(new THREE.Vector3(0.68, 0.9, 0), new THREE.Vector3(0.18, 0.13, 0.12), profile.coatBase, 1, 0.45, 1),
    ellipsoid(new THREE.Vector3(0.82, 0.86, 0), new THREE.Vector3(0.11, 0.07, 0.075), profile.coatWarm, 1, 0.45, 0),
    cone(new THREE.Vector3(0.6, 1.08, 0.08), 0.045, 0.18, profile.coatCool, 4, 1, 5),
    cone(new THREE.Vector3(0.6, 1.08, -0.08), 0.045, 0.18, profile.coatCool, 4, 1, 5),
    ellipsoid(new THREE.Vector3(0.8, 0.94, 0.103), new THREE.Vector3(0.024, 0.03, 0.018), profile.darkColor, 1, 0.2, 0),
    ellipsoid(new THREE.Vector3(0.8, 0.94, -0.103), new THREE.Vector3(0.024, 0.03, 0.018), profile.darkColor, 1, 0.2, 0),
    cylinderBetween(new THREE.Vector3(-0.42, 0.64, 0), new THREE.Vector3(-0.68, 0.78, 0.02), 0.038, profile.accentColor, 4, 1, 5),
    ellipsoid(new THREE.Vector3(-0.76, 0.82, 0.03), new THREE.Vector3(0.09, 0.055, 0.055), profile.accentColor, 4, 1, 0)
  ];
  [-0.12, 0.12].forEach(z => {
    parts.push(...legPair(0.26, z, 0.4, 0.06, 0.04, 0.04, profile.darkColor, 2));
    parts.push(...legPair(-0.27, z, 0.4, 0.06, -0.04, 0.043, profile.darkColor, 3));
  });
  for (let i = 0; i < 4; i++) {
    parts.push(ellipsoid(
      new THREE.Vector3(0.35 + i * 0.07, 0.83 + i * 0.035, 0),
      new THREE.Vector3(0.06, 0.045, 0.05),
      profile.accentColor,
      4,
      1,
      0
    ));
  }
  return merge(parts);
}

function createWoollyGeometry(profile: FaunaProfile): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [
    ellipsoid(new THREE.Vector3(0, 0.48, 0), new THREE.Vector3(0.39, 0.28, 0.23), profile.woolColor, 0, 0.28, 1)
  ];
  const clumps: Array<[number, number, number, number]> = [
    [-0.2, 0.54, 0.15, 0.16],
    [0.03, 0.62, 0.17, 0.17],
    [0.22, 0.53, 0.12, 0.15],
    [-0.24, 0.48, -0.13, 0.15],
    [0.02, 0.58, -0.18, 0.16],
    [0.23, 0.48, -0.1, 0.14],
    [-0.08, 0.72, 0, 0.15]
  ];
  clumps.forEach(([x, y, z, r], index) => {
    parts.push(ellipsoid(
      new THREE.Vector3(x, y, z),
      new THREE.Vector3(r * 1.05, r * 0.78, r),
      profile.woolColor.clone().lerp(profile.coatWarm, index * 0.025),
      0,
      0.46,
      0
    ));
  });
  parts.push(
    cylinderBetween(new THREE.Vector3(0.29, 0.56, 0), new THREE.Vector3(0.43, 0.58, 0), 0.08, profile.darkColor, 1, 0.35, 6),
    ellipsoid(new THREE.Vector3(0.54, 0.59, 0), new THREE.Vector3(0.15, 0.11, 0.1), profile.darkColor, 1, 0.42, 0),
    ellipsoid(new THREE.Vector3(0.62, 0.56, 0), new THREE.Vector3(0.07, 0.055, 0.06), profile.darkColor, 1, 0.35, 0),
    cone(new THREE.Vector3(0.46, 0.72, 0.08), 0.04, 0.12, profile.darkColor, 4, 0.9, 5),
    cone(new THREE.Vector3(0.46, 0.72, -0.08), 0.04, 0.12, profile.darkColor, 4, 0.9, 5),
    ellipsoid(new THREE.Vector3(-0.4, 0.58, 0), new THREE.Vector3(0.07, 0.055, 0.055), profile.woolColor, 4, 0.8, 0)
  );
  [-0.11, 0.11].forEach(z => {
    parts.push(...legPair(0.21, z, 0.32, 0.03, 0.02, 0.036, profile.darkColor, 2));
    parts.push(...legPair(-0.22, z, 0.32, 0.03, -0.02, 0.036, profile.darkColor, 3));
  });
  return merge(parts);
}

function createRunnerGeometry(profile: FaunaProfile): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [
    ellipsoid(new THREE.Vector3(0, 0.43, 0), new THREE.Vector3(0.37, 0.18, 0.15), profile.coatWarm, 0, 0.2, 1),
    ellipsoid(new THREE.Vector3(0.43, 0.57, 0), new THREE.Vector3(0.16, 0.12, 0.1), profile.coatWarm, 1, 0.45, 1),
    ellipsoid(new THREE.Vector3(0.56, 0.53, 0), new THREE.Vector3(0.09, 0.055, 0.06), profile.coatCool, 1, 0.42, 0),
    cone(new THREE.Vector3(0.38, 0.76, 0.07), 0.04, 0.18, profile.coatCool, 4, 1, 5),
    cone(new THREE.Vector3(0.38, 0.76, -0.07), 0.04, 0.18, profile.coatCool, 4, 1, 5),
    ellipsoid(new THREE.Vector3(0.54, 0.59, 0.086), new THREE.Vector3(0.02, 0.024, 0.014), profile.darkColor, 1, 0.2, 0),
    ellipsoid(new THREE.Vector3(0.54, 0.59, -0.086), new THREE.Vector3(0.02, 0.024, 0.014), profile.darkColor, 1, 0.2, 0),
    cylinderBetween(new THREE.Vector3(-0.32, 0.48, 0), new THREE.Vector3(-0.66, 0.61, 0.03), 0.05, profile.accentColor, 4, 1, 6),
    ellipsoid(new THREE.Vector3(-0.78, 0.65, 0.04), new THREE.Vector3(0.13, 0.065, 0.055), profile.accentColor, 4, 1, 0)
  ];
  [-0.09, 0.09].forEach(z => {
    parts.push(...legPair(0.2, z, 0.31, 0.03, 0.06, 0.033, profile.darkColor, 2));
    parts.push(...legPair(-0.2, z, 0.31, 0.03, -0.07, 0.034, profile.darkColor, 3));
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
    parts.push(...legPair(0.12, z, 0.25, 0.04, 0.06, 0.026, profile.darkColor, 2));
    parts.push(...legPair(-0.18, z, 0.24, 0.03, -0.14, 0.036, profile.darkColor, 3));
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

export function prepareFaunaInstanceAttributes(
  geometry: THREE.BufferGeometry,
  capacity: number
): THREE.InstancedBufferAttribute {
  const existing = geometry.getAttribute('aFaunaSeed') as THREE.InstancedBufferAttribute | undefined;
  if (existing && existing.count >= capacity) return existing;
  const attr = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, capacity)), 1);
  attr.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('aFaunaSeed', attr);
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

export function createFaunaMaterial(): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    vertexColors: true,
    side: THREE.DoubleSide,
    transparent: true,
    alphaTest: 0.025,
    depthWrite: true,
    depthTest: true
  });

  material.onBeforeCompile = shader => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uFaunaVisibility = { value: 1 };
    shader.uniforms.uFaunaMotion = { value: 1 };
    shader.uniforms.uFaunaChroma = { value: 1 };
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
        uniform float uTime;
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
        vec2 gustUv = windUv * max(uWindGustScale, 0.001)
          + vec2(uTime * uWindGustSpeed, sin(uTime * uWindGustSpeed * 0.37) * 0.18);
        float gust = smoothstep(0.18, 0.9, fnNoise(gustUv + seed * 8.0));
        vFaunaGust = gust;
        float phase = seed * 6.2831853;
        float stepWave = sin(uTime * (3.3 + seed * 1.1) + phase);
        float trotWave = sin(uTime * (5.2 + seed * 1.3) + phase);
        float side = sign(position.z + 0.001);
        float motion = uFaunaMotion;
        float bodyBob = abs(stepWave) * 0.018 * motion;
        if (aFaunaPart < 0.5) {
          transformed.y += bodyBob;
        } else if (aFaunaPart < 1.5) {
          transformed.y += (sin(uTime * (2.1 + seed) + phase) * 0.022 + bodyBob) * motion;
          transformed.x += cos(uTime * 1.4 + phase) * 0.012 * motion;
        } else if (aFaunaPart < 2.5) {
          float gait = trotWave * side;
          transformed.x += gait * 0.045 * motion;
          transformed.y += max(0.0, gait) * 0.055 * motion;
        } else if (aFaunaPart < 3.5) {
          float gait = -trotWave * side;
          transformed.x += gait * 0.05 * motion;
          transformed.y += max(0.0, gait) * 0.06 * motion;
        } else if (aFaunaPart < 4.5) {
          float tail = sin(uTime * (4.1 + uWindGustSpeed + seed) + phase + position.x * 3.0);
          transformed.z += tail * (0.045 + aFaunaFlex * 0.07) * motion;
          transformed.y += gust * aFaunaFlex * 0.018 * uWindGustStrength * motion;
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
        vFaunaShade = clamp(position.y * 0.72 + 0.35, 0.38, 1.2);`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uFaunaVisibility;
        uniform float uFaunaChroma;
        varying float vFaunaPart;
        varying float vFaunaFlex;
        varying float vFaunaGust;
        varying float vFaunaShade;`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float luma = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
        diffuseColor.rgb = mix(vec3(luma) * 0.84, diffuseColor.rgb, clamp(uFaunaChroma, 0.0, 1.0));
        diffuseColor.rgb *= 0.78 + vFaunaShade * 0.22 + vFaunaGust * 0.06 + vFaunaFlex * 0.04;
        float wingPart = smoothstep(4.5, 5.5, vFaunaPart);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb + vec3(0.08, 0.13, 0.14), wingPart * (0.45 + vFaunaFlex * 0.25));
        diffuseColor.rgb += vec3(0.025, 0.02, 0.012) * smoothstep(3.5, 4.5, vFaunaPart) * (1.0 - wingPart);`
      )
      .replace(
        '#include <alphamap_fragment>',
        `#include <alphamap_fragment>
        diffuseColor.a *= clamp(uFaunaVisibility, 0.0, 1.0);
        diffuseColor.a *= mix(1.0, 0.5 + vFaunaFlex * 0.18, smoothstep(4.5, 5.5, vFaunaPart));`
      );
  };

  material.customProgramCacheKey = () => 'fauna-field-v2';
  return material;
}

export function faunaScaleForKind(kind: FaunaKind, scaleSeed: number): [number, number, number] {
  const baseScale =
    kind === 'grazer' ? 1.34 + scaleSeed * 0.56 :
      kind === 'woolly' ? 1.08 + scaleSeed * 0.44 :
        kind === 'runner' ? 0.78 + scaleSeed * 0.28 :
          kind === 'dragonfly' ? 0.52 + scaleSeed * 0.18 :
            0.64 + scaleSeed * 0.22;
  const yScale = baseScale * (
    kind === 'dragonfly' ? 0.94 :
      kind === 'hopper' ? 1.08 :
        kind === 'grazer' ? 1.08 :
          kind === 'woolly' ? 1.04 :
          1
  );
  return [baseScale, yScale, baseScale];
}

function faunaSpeedForKind(kind: FaunaKind, profile: FaunaProfile, jitter: number): number {
  const climate = profile.biome.aridity * 0.16 + profile.biome.temperature * 0.1 - profile.biome.lushness * 0.06;
  const base =
    kind === 'grazer' ? 0.42 :
      kind === 'woolly' ? 0.32 :
        kind === 'runner' ? 0.76 :
          kind === 'dragonfly' ? 1.05 :
            0.62;
  return Math.max(0.18, base + climate + (jitter - 0.5) * 0.16);
}

export function faunaLevelTransitionLift(kind: FaunaKind, levelDelta: number, progress: number): number {
  const amount = Math.abs(levelDelta);
  if (amount < 0.001) return 0;
  const t = clamp(progress, 0, 1);
  const base =
    kind === 'dragonfly' ? 0.38 :
      kind === 'hopper' ? 0.58 :
        kind === 'runner' ? 0.68 :
          0.78;
  return (base + Math.min(2, amount) * VOXEL_SCALE * 0.18) * Math.sin(Math.PI * t);
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
    if (voxel && isFaunaTravelVoxel(kind, voxel, profile)) return [nx, ny, nz];
  }
  return null;
}

function chooseFaunaNextVoxel(agent: FaunaAgent, terrainSeed: number, profile: FaunaProfile): [number, number, number] {
  const turnRoll = seededVoxelUnit(agent.x, agent.y, agent.z, agent.stepSalt + agent.stepCount, terrainSeed);
  const turnFirst = turnRoll < 0.18 ? 1 : turnRoll < 0.36 ? -1 : 0;
  const order = turnFirst === 0
    ? [agent.directionIndex, agent.directionIndex + 1, agent.directionIndex - 1, agent.directionIndex + 2]
    : [agent.directionIndex + turnFirst, agent.directionIndex, agent.directionIndex - turnFirst, agent.directionIndex + 2];

  for (const candidateDir of order) {
    const candidate = findFaunaTravelCandidate(agent.kind, agent.x, agent.y, agent.z, candidateDir, profile);
    if (!candidate) continue;
    agent.directionIndex = mod4(candidateDir);
    return candidate;
  }

  agent.directionIndex = mod4(agent.directionIndex + 2);
  return [agent.x, agent.y, agent.z];
}

function setFaunaRoute(agent: FaunaAgent, terrainSeed: number, profile: FaunaProfile): void {
  agent.stepCount += 1;
  agent.x = agent.toX;
  agent.y = agent.toY;
  agent.z = agent.toZ;
  agent.from.copy(agent.to);
  const [nx, ny, nz] = chooseFaunaNextVoxel(agent, terrainSeed, profile);
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
    stepSalt: FAUNA_PICK_SALT + Math.floor(seededVoxelUnit(x, y, z, FAUNA_SCALE_SALT + 53, terrainSeed) * 4096),
    stepCount: 0,
    orientation: new THREE.Quaternion()
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

function computeFaunaAgentMatrix(
  agent: FaunaAgent,
  time: number,
  rotationAlpha: number,
  target: THREE.Matrix4
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
  const [sx, sy, sz] = faunaScaleForKind(agent.kind, agent.scaleSeed);
  _tiltQuat.setFromAxisAngle(_a.set(1, 0, 0), (agent.tiltSeed - 0.5) * (agent.kind === 'dragonfly' ? 0.18 : 0.08));
  _finalQuat.copy(agent.orientation).multiply(_tiltQuat);
  _scaleVec.set(sx, sy, sz);
  target.compose(_movePos, _finalQuat, _scaleVec);
  return target;
}

export function updateFaunaAgents(
  mesh: THREE.InstancedMesh,
  agents: FaunaAgent[],
  time: number,
  deltaTime: number,
  terrainSeed: number,
  profile = buildFaunaProfile(terrainSeed)
): FaunaBuildResult {
  const dt = clamp(deltaTime, 0, 0.12);
  const count = Math.min(agents.length, mesh.instanceMatrix.count);
  for (let i = 0; i < count; i++) {
    const agent = agents[i];
    const turnRate = agent.kind === 'dragonfly' ? 4.8 : agent.kind === 'woolly' ? 3.4 : 4.2;
    const rotationAlpha = 1 - Math.exp(-turnRate * dt);
    const distance = Math.max(0.001, agent.from.distanceTo(agent.to));
    agent.progress += dt * agent.speed / distance;
    while (agent.progress >= 1) {
      agent.progress -= 1;
      setFaunaRoute(agent, terrainSeed, profile);
      if (agent.from.distanceToSquared(agent.to) < 0.0001) {
        agent.progress = 0;
        break;
      }
    }
    computeFaunaAgentMatrix(agent, time, rotationAlpha, _scratch);
    mesh.setMatrixAt(i, _scratch);
  }
  mesh.count = count;
  mesh.instanceMatrix.needsUpdate = true;
  return { count, voxelCount: count, agents };
}

export function buildFaunaInstances(
  kind: FaunaKind,
  mesh: THREE.InstancedMesh,
  density: number,
  maxDistance: number,
  playerWorld: THREE.Vector3 | null,
  terrainSeed: number,
  profile = buildFaunaProfile(terrainSeed)
): FaunaBuildResult {
  const capacity = mesh.instanceMatrix.count;
  const maxDistSq = maxDistance * maxDistance;
  const seedAttr = prepareFaunaInstanceAttributes(mesh.geometry, capacity);
  const agents: FaunaAgent[] = [];
  let voxelCount = 0;

  if (density <= 0) {
    mesh.count = 0;
    mesh.instanceMatrix.needsUpdate = true;
    return { count: 0, voxelCount: 0, agents };
  }

  for (const voxel of voxelSystem.getAllVoxels().values()) {
    if (agents.length >= capacity) break;
    const [x, y, z] = voxel.position;
    if (!shouldPlaceFaunaVoxel(voxel, x, y, z, density, terrainSeed, profile)) continue;
    if (chooseFaunaKindForVoxel(voxel, x, y, z, terrainSeed, profile) !== kind) continue;
    if (!isFaunaTravelVoxel(kind, voxel, profile)) continue;

    voxelCoordToWorld(x, y, z, _world);
    if (maxDistance > 0 && playerWorld && _world.distanceToSquared(playerWorld) > maxDistSq) continue;

    voxelCount++;
    const agent = createFaunaAgent(kind, x, y, z, terrainSeed, profile);
    computeFaunaAgentMatrix(agent, 0, 1, _scratch);
    mesh.setMatrixAt(agents.length, _scratch);
    seedAttr.setX(agents.length, agent.phase / TAU);
    agents.push(agent);
  }

  mesh.count = agents.length;
  mesh.instanceMatrix.needsUpdate = true;
  seedAttr.needsUpdate = true;
  return { count: agents.length, voxelCount, agents };
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
  reality: VoxelRealityEffects
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
}

export function currentFaunaDensity(): number {
  return getGraphicsQuality().faunaDensity;
}
