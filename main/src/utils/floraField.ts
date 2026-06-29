import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { getGraphicsQuality, type GraphicsQuality } from '../config/graphicsSettings';
import type { VoxelRealityEffects } from '../game/systems/realityRenderSystem';
import { MaterialType } from '../types/materials';
import { voxelSystem } from './efficientVoxelSystem';
import { voxelCoordToWorld } from './cubeGravityConstants';
import { deterministicTangentForUp, dominantFaceForPosition, FACE_NORMALS } from './surfaceControls';
import { seededVoxelUnit } from './seededHash';
import { buildBiomeProfile, type BiomeProfile } from './biomeProfile';
import { buildWindProfile, type WindProfile } from './windProfile';
import { buildPlanetArtDirection, type PaletteRoleColor, type PlanetArtDirection, type PlanetEcology } from './planetArtDirection';
import { isMaterialEligibleForEcology } from './planetEcology';

export const FLORA_KINDS = ['cactus', 'fan', 'flower', 'seedhead', 'shrub'] as const;
export type FloraKind = typeof FLORA_KINDS[number];

export interface FloraProfile {
  terrainSeed: number;
  biome: BiomeProfile;
  wind: WindProfile;
  artDirection: PlanetArtDirection;
  ecology: PlanetEcology;
  densityMul: number;
  coverage: number;
  greenBase: THREE.Color;
  greenTip: THREE.Color;
  dryColor: THREE.Color;
  bloomColor: THREE.Color;
  barkColor: THREE.Color;
  weights: Record<FloraKind, number>;
}

export interface FloraBuildResult {
  count: number;
  voxelCount: number;
}

const FLORA_SURFACE_OFFSET = 1.02;
const FLORA_COVERAGE_SALT = 271;
const FLORA_DENSITY_SALT = 272;
const FLORA_PICK_SALT = 273;
const FLORA_OFFSET_U_SALT = 274;
const FLORA_OFFSET_V_SALT = 275;
const FLORA_YAW_SALT = 276;
const FLORA_SCALE_SALT = 277;
const FLORA_TILT_SALT = 278;

const _world = new THREE.Vector3();
const _up = new THREE.Vector3();
const _tangent = new THREE.Vector3();
const _bitangent = new THREE.Vector3();
const _offset = new THREE.Vector3();
const _basis = new THREE.Matrix4();
const _yaw = new THREE.Matrix4();
const _tilt = new THREE.Matrix4();
const _scale = new THREE.Matrix4();
const _translate = new THREE.Matrix4();
const _scratch = new THREE.Matrix4();
const _local = new THREE.Matrix4();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _quat = new THREE.Quaternion();

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function roleColor(role: PaletteRoleColor): THREE.Color {
  return new THREE.Color()
    .setHSL(role.h, role.s, role.l)
    .convertSRGBToLinear();
}

export function buildFloraProfile(terrainSeed: number): FloraProfile {
  const s = terrainSeed | 0;
  const biome = buildBiomeProfile(s);
  const art = buildPlanetArtDirection(s);
  const wind = buildWindProfile(s, biome);
  const { aridity, lushness, temperature } = biome;

  const greenBase = roleColor(art.palette.canopyBase);
  const greenTip = roleColor(art.palette.canopyTip);
  const dryColor = roleColor(art.palette.dryGrass);
  const bloomColor = roleColor(art.palette.flowerAccent);
  const barkColor = roleColor(art.palette.bark);

  const densityMul = clamp(0.32 + lushness * 1.05 + (1 - aridity) * 0.28, 0.28, 1.65);
  const coverage = clamp(0.24 + lushness * 0.62 + aridity * 0.14, 0.18, 0.96);

  const weights: Record<FloraKind, number> = {
    cactus: clamp((0.08 + aridity * 1.35 + Math.max(0, temperature - 0.52) * 0.55 - lushness * 0.62) * art.ecology.floraWeights.cactus, 0.001, 2.4),
    fan: clamp((0.08 + lushness * 0.9 + temperature * 0.28 - aridity * 0.32) * art.ecology.floraWeights.fan, 0.001, 2.4),
    flower: clamp((0.1 + lushness * 1.15 + (1 - aridity) * 0.32) * art.ecology.floraWeights.flower, 0.001, 2.4),
    seedhead: clamp((0.12 + aridity * 0.8 + (1 - lushness) * 0.38) * art.ecology.floraWeights.seedhead, 0.001, 2.4),
    shrub: clamp((0.08 + lushness * 0.7 + (1 - aridity) * 0.38) * art.ecology.floraWeights.shrub, 0.001, 2.4)
  };

  return {
    terrainSeed: s,
    biome,
    wind,
    artDirection: art,
    ecology: art.ecology,
    densityMul,
    coverage,
    greenBase,
    greenTip,
    dryColor,
    bloomColor,
    barkColor,
    weights
  };
}

export function isFloraEligibleVoxel(voxel: { material: string; supportsSurfaceResources?: boolean }): boolean {
  return (
    voxel.supportsSurfaceResources !== false &&
    (
      voxel.material === MaterialType.GRASS ||
      voxel.material === MaterialType.DIRT ||
      voxel.material === MaterialType.SAND
    )
  );
}

export function isFloraEligibleVoxelForProfile(
  voxel: { material: string; supportsSurfaceResources?: boolean },
  profile: FloraProfile
): boolean {
  if (voxel.supportsSurfaceResources === false) return false;
  return isMaterialEligibleForEcology(profile.ecology, 'flora', voxel.material as MaterialType);
}

function materialDensityMul(material: string, profile: FloraProfile): number {
  if (material === MaterialType.GRASS) return 1.0;
  if (material === MaterialType.DIRT) return 0.68 + profile.biome.lushness * 0.22;
  if (material === MaterialType.SAND) return 0.34 + profile.biome.aridity * 0.46;
  if (material === MaterialType.CRYSTAL) return 0.22 * profile.ecology.richness;
  if (material === MaterialType.BASALT) return 0.12 * profile.ecology.richness;
  if (material === MaterialType.STONE) return 0.1 * profile.ecology.richness;
  return 0;
}

function materialKindMul(material: string, kind: FloraKind): number {
  if (material === MaterialType.SAND) {
    return kind === 'cactus' ? 1.7 : kind === 'seedhead' ? 0.95 : kind === 'fan' ? 0.28 : kind === 'shrub' ? 0.18 : 0.06;
  }
  if (material === MaterialType.DIRT) {
    return kind === 'cactus' ? 0.42 : kind === 'seedhead' ? 0.78 : kind === 'fan' ? 0.58 : kind === 'flower' ? 0.74 : 0.7;
  }
  if (material === MaterialType.GRASS) {
    return kind === 'cactus' ? 0.06 : kind === 'seedhead' ? 0.34 : kind === 'fan' ? 0.86 : kind === 'flower' ? 1.15 : 0.82;
  }
  if (material === MaterialType.CRYSTAL) {
    return kind === 'fan' ? 0.75 : kind === 'flower' ? 0.55 : kind === 'shrub' ? 0.36 : kind === 'seedhead' ? 0.28 : 0.05;
  }
  if (material === MaterialType.BASALT || material === MaterialType.STONE) {
    return kind === 'seedhead' ? 0.55 : kind === 'shrub' ? 0.38 : kind === 'cactus' ? 0.28 : 0.12;
  }
  return 0;
}

function placementChance(density: number, material: string, profile: FloraProfile): number {
  return clamp(Math.sqrt(Math.max(0, density)) * 0.72 * profile.densityMul * materialDensityMul(material, profile), 0, 1);
}

export function chooseFloraKindForVoxel(
  voxel: { material: string },
  x: number,
  y: number,
  z: number,
  terrainSeed: number,
  profile: FloraProfile
): FloraKind {
  const weighted = FLORA_KINDS.map(kind => ({
    kind,
    weight: Math.max(0.001, profile.weights[kind] * materialKindMul(voxel.material, kind))
  }));
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  let pick = seededVoxelUnit(x, y, z, FLORA_PICK_SALT, terrainSeed) * total;
  for (const entry of weighted) {
    pick -= entry.weight;
    if (pick <= 0) return entry.kind;
  }
  return weighted[weighted.length - 1].kind;
}

export function shouldPlaceFloraVoxel(
  voxel: { material: string; supportsSurfaceResources?: boolean },
  x: number,
  y: number,
  z: number,
  density: number,
  terrainSeed: number,
  profile: FloraProfile
): boolean {
  if (density <= 0 || !isFloraEligibleVoxelForProfile(voxel, profile)) return false;
  if (seededVoxelUnit(x, y, z, FLORA_COVERAGE_SALT, terrainSeed) > profile.coverage) return false;
  return seededVoxelUnit(x, y, z, FLORA_DENSITY_SALT, terrainSeed) <= placementChance(density, voxel.material, profile);
}

export function countFloraVoxels(
  kind: FloraKind,
  density: number,
  terrainSeed: number,
  profile = buildFloraProfile(terrainSeed)
): number {
  if (density <= 0) return 0;
  let n = 0;
  for (const voxel of voxelSystem.getAllVoxels().values()) {
    const [x, y, z] = voxel.position;
    if (!shouldPlaceFloraVoxel(voxel, x, y, z, density, terrainSeed, profile)) continue;
    if (chooseFloraKindForVoxel(voxel, x, y, z, terrainSeed, profile) === kind) n++;
  }
  return n;
}

function addAttributes(geo: THREE.BufferGeometry, color: THREE.Color, flexMul: number): THREE.BufferGeometry {
  const work = geo.index ? geo.toNonIndexed() : geo;
  work.deleteAttribute('uv');
  work.computeVertexNormals();
  work.computeBoundingBox();
  const box = work.boundingBox;
  const minY = box?.min.y ?? 0;
  const spanY = Math.max(0.001, (box?.max.y ?? 1) - minY);
  const pos = work.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const flex = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
    flex[i] = clamp(((pos.getY(i) - minY) / spanY) * flexMul, 0, 1);
  }
  work.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  work.setAttribute('aFloraFlex', new THREE.BufferAttribute(flex, 1));
  return work;
}

function cylinderBetween(
  a: THREE.Vector3,
  b: THREE.Vector3,
  radius: number,
  color: THREE.Color,
  flexMul: number,
  radialSegments = 7
): THREE.BufferGeometry {
  const dir = _b.copy(b).sub(a);
  const len = Math.max(0.001, dir.length());
  const geo = new THREE.CylinderGeometry(radius, radius * 0.92, len, radialSegments, 2);
  _quat.setFromUnitVectors(_a.set(0, 1, 0), dir.normalize());
  geo.applyQuaternion(_quat);
  _mid.copy(a).add(b).multiplyScalar(0.5);
  geo.translate(_mid.x, _mid.y, _mid.z);
  return addAttributes(geo, color, flexMul);
}

function ellipsoid(
  center: THREE.Vector3,
  scale: THREE.Vector3,
  color: THREE.Color,
  flexMul: number,
  detail = 1
): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(1, detail);
  geo.scale(scale.x, scale.y, scale.z);
  geo.translate(center.x, center.y, center.z);
  return addAttributes(geo, color, flexMul);
}

function leafBlade(
  length: number,
  width: number,
  lift: number,
  angle: number,
  color: THREE.Color,
  flexMul: number
): THREE.BufferGeometry {
  const positions = new Float32Array([
    0, 0, 0,
    length * 0.42, lift * 0.35, -width,
    length * 0.42, lift * 0.35, width,
    length, lift, 0
  ]);
  const indices = [0, 1, 2, 1, 3, 2];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.rotateY(angle);
  return addAttributes(geo, color, flexMul);
}

function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const geo = mergeGeometries(parts, false);
  if (!geo) throw new Error('Failed to merge flora geometry');
  geo.computeVertexNormals();
  return geo;
}

function createCactusGeometry(profile: FloraProfile): THREE.BufferGeometry {
  const green = new THREE.Color()
    .setHSL(
      0.34 + profile.biome.temperature * 0.035,
      clamp(0.44 + profile.biome.lushness * 0.16 - profile.biome.aridity * 0.08, 0.32, 0.68),
      0.34 + profile.biome.lushness * 0.08
    )
    .convertSRGBToLinear();
  const bloom = profile.bloomColor;
  return merge([
    cylinderBetween(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1.15, 0), 0.115, green, 0.45),
    cylinderBetween(new THREE.Vector3(0.06, 0.48, 0), new THREE.Vector3(0.36, 0.48, 0), 0.068, green, 0.65),
    cylinderBetween(new THREE.Vector3(0.36, 0.48, 0), new THREE.Vector3(0.36, 0.83, 0), 0.062, green, 0.78),
    cylinderBetween(new THREE.Vector3(-0.06, 0.68, 0), new THREE.Vector3(-0.28, 0.68, 0), 0.058, green, 0.68),
    cylinderBetween(new THREE.Vector3(-0.28, 0.68, 0), new THREE.Vector3(-0.28, 0.98, 0), 0.052, green, 0.82),
    ellipsoid(new THREE.Vector3(0, 1.24, 0), new THREE.Vector3(0.08, 0.055, 0.08), bloom, 0.95, 0)
  ]);
}

function createFanGeometry(profile: FloraProfile): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [
    cylinderBetween(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.2, 0), 0.04, profile.barkColor, 0.25)
  ];
  for (let i = 0; i < 9; i++) {
    const t = i / 9;
    const angle = t * Math.PI * 2 + (i % 2) * 0.08;
    const len = 0.38 + (i % 3) * 0.065;
    const width = 0.055 + (i % 4) * 0.01;
    const lift = 0.12 + (i % 5) * 0.028;
    const color = profile.greenBase.clone().lerp(profile.greenTip, 0.32 + t * 0.28);
    const leaf = leafBlade(len, width, lift, angle, color, 1);
    leaf.translate(0, 0.07, 0);
    parts.push(leaf);
  }
  return merge(parts);
}

function createFlowerGeometry(profile: FloraProfile): THREE.BufferGeometry {
  const top = new THREE.Vector3(0, 0.82, 0);
  const parts: THREE.BufferGeometry[] = [
    cylinderBetween(new THREE.Vector3(0, 0, 0), top, 0.018, profile.greenBase, 1, 6)
  ];
  for (let i = 0; i < 4; i++) {
    const leaf = leafBlade(0.24 + i * 0.018, 0.038, 0.07 + i * 0.012, i * Math.PI * 0.5 + 0.24, profile.greenTip, 0.75);
    leaf.translate(0, 0.16 + i * 0.075, 0);
    parts.push(leaf);
  }
  parts.push(ellipsoid(top, new THREE.Vector3(0.048, 0.05, 0.048), profile.bloomColor, 1, 0));
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const petal = ellipsoid(
      new THREE.Vector3(Math.cos(angle) * 0.075, top.y, Math.sin(angle) * 0.075),
      new THREE.Vector3(0.062, 0.022, 0.034),
      profile.bloomColor,
      1,
      0
    );
    petal.rotateY(angle);
    parts.push(petal);
  }
  return merge(parts);
}

function createSeedheadGeometry(profile: FloraProfile): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 7; i++) {
    const angle = (i / 7) * Math.PI * 2;
    const lean = 0.09 + (i % 3) * 0.035;
    const height = 0.48 + (i % 4) * 0.085;
    const tip = new THREE.Vector3(Math.cos(angle) * lean, height, Math.sin(angle) * lean);
    parts.push(cylinderBetween(new THREE.Vector3(0, 0, 0), tip, 0.012 + (i % 2) * 0.004, profile.greenBase, 1, 5));
    if (i < 4) {
      parts.push(ellipsoid(tip, new THREE.Vector3(0.035, 0.1, 0.035), profile.dryColor, 1, 0));
    }
  }
  return merge(parts);
}

function createShrubGeometry(profile: FloraProfile): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [
    cylinderBetween(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.34, 0), 0.035, profile.barkColor, 0.3)
  ];
  const centers: Array<[number, number, number, number]> = [
    [0, 0.43, 0, 0.25],
    [0.19, 0.35, 0.06, 0.19],
    [-0.17, 0.34, -0.08, 0.18],
    [0.05, 0.58, -0.11, 0.17],
    [-0.02, 0.25, 0.18, 0.16]
  ];
  centers.forEach(([x, y, z, r], index) => {
    const color = profile.greenBase.clone().lerp(profile.greenTip, 0.25 + index * 0.09);
    parts.push(ellipsoid(new THREE.Vector3(x, y, z), new THREE.Vector3(r, r * 0.72, r), color, 0.82, 0));
  });
  return merge(parts);
}

export function createFloraGeometry(kind: FloraKind, profile = buildFloraProfile(0)): THREE.BufferGeometry {
  switch (kind) {
    case 'cactus':
      return createCactusGeometry(profile);
    case 'fan':
      return createFanGeometry(profile);
    case 'flower':
      return createFlowerGeometry(profile);
    case 'seedhead':
      return createSeedheadGeometry(profile);
    case 'shrub':
      return createShrubGeometry(profile);
    default:
      kind satisfies never;
      return createFlowerGeometry(profile);
  }
}

const FLORA_NOISE = /* glsl */ `
  float flHash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float flNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = flHash21(i);
    float b = flHash21(i + vec2(1.0, 0.0));
    float c = flHash21(i + vec2(0.0, 1.0));
    float d = flHash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
`;

export function createFloraMaterial(): THREE.MeshBasicMaterial {
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
    shader.uniforms.uFloraVisibility = { value: 1 };
    shader.uniforms.uFloraMotion = { value: 1 };
    shader.uniforms.uFloraChroma = { value: 1 };
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
        attribute float aFloraFlex;
        uniform float uTime;
        uniform float uFloraMotion;
        uniform float uWindStrength;
        uniform float uWindGustStrength;
        uniform float uWindGustScale;
        uniform float uWindGustSpeed;
        uniform float uWindTurbulence;
        uniform vec2 uWindDir;
        uniform vec2 uWindOffset;
        varying float vFloraFlex;
        varying float vFloraGust;
        ${FLORA_NOISE}`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vFloraFlex = aFloraFlex;
        vec3 instWorld = instanceMatrix[3].xyz;
        vec2 windDir = normalize(uWindDir + vec2(0.0001, 0.0));
        vec2 windSide = vec2(-windDir.y, windDir.x);
        vec2 windUv = vec2(
          dot(instWorld.xz + uWindOffset, windDir),
          dot(instWorld.xz + uWindOffset, windSide)
        );
        float seed = flHash21(instWorld.xz + instWorld.y + uWindOffset);
        vec2 gustUv = windUv * max(uWindGustScale, 0.001)
          + vec2(uTime * uWindGustSpeed, sin(uTime * uWindGustSpeed * 0.43) * 0.18);
        float gust = smoothstep(0.2, 0.9, flNoise(gustUv + seed * 6.0));
        vFloraGust = gust;
        float flex = aFloraFlex * aFloraFlex;
        float sway = sin(uTime * (1.05 + uWindGustSpeed) + seed * 6.28318 + position.y * 1.7);
        float flutter = sin(uTime * (3.6 + uWindTurbulence * 2.0) + seed * 11.0 + position.x * 2.4);
        float drive = (sway * (0.42 + gust * uWindGustStrength) + flutter * 0.12) * flex * uFloraMotion;
        float cross = cos(uTime * (0.85 + uWindGustSpeed) + seed * 4.0 + gust * 3.0)
          * flex * (0.04 + uWindTurbulence * 0.08) * uFloraMotion;
        transformed.x += (windDir.x * drive + windSide.x * cross) * 0.14 * uWindStrength;
        transformed.z += (windDir.y * drive + windSide.y * cross) * 0.14 * uWindStrength;
        transformed.y += gust * flex * 0.012 * uWindGustStrength * uFloraMotion;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uFloraVisibility;
        uniform float uFloraChroma;
        varying float vFloraFlex;
        varying float vFloraGust;`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float luma = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
        diffuseColor.rgb = mix(vec3(luma) * 0.82, diffuseColor.rgb, clamp(uFloraChroma, 0.0, 1.0));
        diffuseColor.rgb *= 0.88 + vFloraFlex * 0.18 + vFloraGust * 0.08;`
      )
      .replace(
        '#include <alphamap_fragment>',
        `#include <alphamap_fragment>
        diffuseColor.a *= clamp(uFloraVisibility, 0.0, 1.0);`
      );
  };

  material.customProgramCacheKey = () => 'flora-field-v1';
  return material;
}

function computeFloraMatrix(
  x: number,
  y: number,
  z: number,
  kind: FloraKind,
  target: THREE.Matrix4,
  terrainSeed: number
): THREE.Matrix4 {
  voxelCoordToWorld(x, y, z, _world);
  _up.copy(FACE_NORMALS[dominantFaceForPosition(_world)]);
  deterministicTangentForUp(_up, _tangent);
  _bitangent.crossVectors(_up, _tangent).normalize();

  const r0 = seededVoxelUnit(x, y, z, FLORA_OFFSET_U_SALT, terrainSeed);
  const r1 = seededVoxelUnit(x, y, z, FLORA_OFFSET_V_SALT, terrainSeed);
  const r2 = seededVoxelUnit(x, y, z, FLORA_YAW_SALT, terrainSeed);
  const r3 = seededVoxelUnit(x, y, z, FLORA_SCALE_SALT, terrainSeed);
  const r4 = seededVoxelUnit(x, y, z, FLORA_TILT_SALT, terrainSeed);

  _offset.copy(_up).multiplyScalar(FLORA_SURFACE_OFFSET);
  _offset.addScaledVector(_tangent, (r0 - 0.5) * 1.08);
  _offset.addScaledVector(_bitangent, (r1 - 0.5) * 1.08);

  _basis.makeBasis(_tangent, _up, _bitangent);
  _yaw.makeRotationY(r2 * Math.PI * 2);
  _tilt.makeRotationX((r4 - 0.5) * 0.18);

  const baseScale =
    kind === 'cactus' ? 0.92 + r3 * 0.78 :
    kind === 'shrub' ? 0.78 + r3 * 0.54 :
    kind === 'flower' ? 0.72 + r3 * 0.44 :
    kind === 'fan' ? 0.78 + r3 * 0.48 :
    0.8 + r3 * 0.5;
  const yScale = baseScale * (
    kind === 'flower' ? 1.08 :
    kind === 'seedhead' ? 1.14 :
    kind === 'cactus' ? 1.22 :
    1
  );
  _scale.makeScale(baseScale, yScale, baseScale);
  _translate.makeTranslation(_world.x + _offset.x, _world.y + _offset.y, _world.z + _offset.z);

  target.copy(_translate);
  target.multiply(_basis);
  target.multiply(_local.copy(_yaw).multiply(_tilt).multiply(_scale));
  return target;
}

export function buildFloraInstances(
  kind: FloraKind,
  mesh: THREE.InstancedMesh,
  density: number,
  maxDistance: number,
  playerWorld: THREE.Vector3 | null,
  terrainSeed: number,
  profile = buildFloraProfile(terrainSeed)
): FloraBuildResult {
  const capacity = mesh.instanceMatrix.count;
  const maxDistSq = maxDistance * maxDistance;
  let slot = 0;
  let voxelCount = 0;

  if (density <= 0) {
    mesh.count = 0;
    mesh.instanceMatrix.needsUpdate = true;
    return { count: 0, voxelCount: 0 };
  }

  for (const voxel of voxelSystem.getAllVoxels().values()) {
    if (slot >= capacity) break;
    const [x, y, z] = voxel.position;
    if (!shouldPlaceFloraVoxel(voxel, x, y, z, density, terrainSeed, profile)) continue;
    if (chooseFloraKindForVoxel(voxel, x, y, z, terrainSeed, profile) !== kind) continue;

    voxelCoordToWorld(x, y, z, _world);
    if (maxDistance > 0 && playerWorld && _world.distanceToSquared(playerWorld) > maxDistSq) continue;

    voxelCount++;
    computeFloraMatrix(x, y, z, kind, _scratch, terrainSeed);
    mesh.setMatrixAt(slot, _scratch);
    slot++;
  }

  mesh.count = slot;
  mesh.instanceMatrix.needsUpdate = true;
  return { count: slot, voxelCount };
}

export function applyFloraWindProfileToMaterial(profile: WindProfile, material: THREE.Material): void {
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

export function updateFloraMaterial(
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
  if (u.uFloraVisibility) {
    (u.uFloraVisibility.value as number) = Math.min(1.18, Math.max(0, reality.organic * 0.9 + reality.detail * 0.2));
  }
  if (u.uFloraMotion) {
    (u.uFloraMotion.value as number) = quality.animatedShaders
      ? Math.min(1.35, Math.max(0, reality.atmosphere * 0.55 + reality.organic * 0.62))
      : 0;
  }
  if (u.uFloraChroma) {
    (u.uFloraChroma.value as number) = Math.min(1, Math.max(0, reality.chroma));
  }
}

export function currentFloraDensity(): number {
  return getGraphicsQuality().floraDensity;
}
