import * as THREE from 'three';
import { voxelCoordToWorld } from './cubeGravityConstants';
import { deterministicTangentForUp, dominantFaceForPosition, FACE_NORMALS } from './surfaceControls';
import { voxelSystem } from './efficientVoxelSystem';
import { MaterialType } from '../types/materials';
import { seededVoxelUnit } from './seededHash';
import type { GraphicsQuality } from '../config/graphicsSettings';
import type { VoxelRealityEffects } from '../game/systems/realityRenderSystem';
import type { WindProfile } from './windProfile';

const SAND_DUST_SURFACE_OFFSET = 1.03;
const SAND_DUST_BASE_LIFT = 0.025;
const SAND_DUST_WIDTH = 2.35;
const SAND_DUST_HEIGHT = 0.42;
const SAND_DUST_DEPTH = 0.52;
const SAND_DUST_COVERAGE_SALT = 181;
const SAND_DUST_PHASE_SALT = 182;
const SAND_DUST_OFFSET_U_SALT = 183;
const SAND_DUST_OFFSET_V_SALT = 184;
const SAND_DUST_SCALE_SALT = 185;
const SAND_DUST_VEER_SALT = 186;

const DIRT_LIFE_SURFACE_OFFSET = 1.018;
const DIRT_LIFE_BASE_LIFT = 0.018;
const DIRT_LIFE_LENGTH = 1.08;
const DIRT_LIFE_HEIGHT = 0.82;
const DIRT_LIFE_DEPTH = 0.78;
const DIRT_LIFE_COVERAGE_SALT = 211;
const DIRT_LIFE_PHASE_SALT = 212;
const DIRT_LIFE_OFFSET_U_SALT = 213;
const DIRT_LIFE_OFFSET_V_SALT = 214;
const DIRT_LIFE_SCALE_SALT = 215;
const DIRT_LIFE_VEER_SALT = 216;

const _world = new THREE.Vector3();
const _up = new THREE.Vector3();
const _tangent = new THREE.Vector3();
const _bitangent = new THREE.Vector3();
const _wind = new THREE.Vector3();
const _side = new THREE.Vector3();
const _offset = new THREE.Vector3();
const _basis = new THREE.Matrix4();
const _yaw = new THREE.Matrix4();
const _scale = new THREE.Matrix4();
const _translate = new THREE.Matrix4();
const _scratch = new THREE.Matrix4();
const _local = new THREE.Matrix4();

export interface SurfaceEffectBuildResult {
  count: number;
  voxelCount: number;
}

export function sandDustWispsPerVoxel(density: number): number {
  if (density <= 0) return 0;
  return Math.max(1, Math.round(density * 2));
}

export function sandDustCoverage(density: number): number {
  if (density <= 0) return 0;
  return Math.min(1, 0.35 + density * 0.7);
}

export function isSandDustVoxel(voxel: { material: string; supportsSurfaceResources?: boolean }): boolean {
  return voxel.material === MaterialType.SAND && voxel.supportsSurfaceResources !== false;
}

export function dirtLifeClustersPerVoxel(density: number): number {
  if (density <= 0) return 0;
  return Math.max(1, Math.round(density * 2.6));
}

export function dirtLifeCoverage(density: number): number {
  if (density <= 0) return 0;
  return Math.min(1, 0.42 + density * 0.58);
}

export function isDirtLifeVoxel(voxel: { material: string; supportsSurfaceResources?: boolean }): boolean {
  return voxel.material === MaterialType.DIRT && voxel.supportsSurfaceResources !== false;
}

export function countSandDustVoxels(density: number, terrainSeed: number): number {
  if (density <= 0) return 0;
  const coverage = sandDustCoverage(density);
  const perVoxel = sandDustWispsPerVoxel(density);
  let n = 0;
  for (const voxel of voxelSystem.getAllVoxels().values()) {
    if (!isSandDustVoxel(voxel)) continue;
    const [x, y, z] = voxel.position;
    if (seededVoxelUnit(x, y, z, SAND_DUST_COVERAGE_SALT, terrainSeed) > coverage) continue;
    n += perVoxel;
  }
  return n;
}

export function countDirtLifeVoxels(density: number, terrainSeed: number): number {
  if (density <= 0) return 0;
  const coverage = dirtLifeCoverage(density);
  const perVoxel = dirtLifeClustersPerVoxel(density);
  let n = 0;
  for (const voxel of voxelSystem.getAllVoxels().values()) {
    if (!isDirtLifeVoxel(voxel)) continue;
    const [x, y, z] = voxel.position;
    if (seededVoxelUnit(x, y, z, DIRT_LIFE_COVERAGE_SALT, terrainSeed) > coverage) continue;
    n += perVoxel;
  }
  return n;
}

export function createSandDustGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const addRibbon = (z: number, zSkew: number) => {
    const base = positions.length / 3;
    positions.push(
      -0.5, 0.0, -z,
       0.5, 0.0, z,
      -0.5 + zSkew, 1.0, z,
       0.5 + zSkew, 1.0, -z
    );
    uvs.push(0, 0, 1, 0, 0, 1, 1, 1);
    indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  };

  addRibbon(0, 0.12);
  addRibbon(0.34, -0.08);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function createDirtLifeGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const kinds: number[] = [];
  const indices: number[] = [];

  const addVertex = (x: number, y: number, z: number, u: number, v: number, kind: number) => {
    positions.push(x, y, z);
    uvs.push(u, v);
    kinds.push(kind);
  };

  const addMound = (
    cx: number,
    cz: number,
    width: number,
    depth: number,
    height: number,
    angle: number,
    kind: number,
    phase: number
  ) => {
    const top = positions.length / 3;
    const ca = Math.cos(angle);
    const sa = Math.sin(angle);
    const ringStart = top + 1;
    const segments = 7;
    addVertex(cx, height, cz, phase, 1, kind);
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      const irregular = 0.82 + ((i * 37 + Math.round(phase * 100)) % 19) / 72;
      const x = Math.cos(a) * width * irregular;
      const z = Math.sin(a) * depth * (1.04 - (irregular - 0.82) * 0.35);
      addVertex(
        cx + x * ca - z * sa,
        0,
        cz + x * sa + z * ca,
        i / (segments - 1),
        0,
        kind
      );
    }
    for (let i = 0; i < segments; i++) {
      indices.push(top, ringStart + ((i + 1) % segments), ringStart + i);
    }
  };

  addMound(-0.31, -0.17, 0.26, 0.18, 0.105, 0.24, 0, 0.08);
  addMound(0.05, -0.17, 0.24, 0.15, 0.085, -0.45, 0, 0.18);
  addMound(0.31, 0.08, 0.22, 0.16, 0.075, 0.82, 0, 0.31);
  addMound(-0.12, 0.19, 0.21, 0.13, 0.07, -0.2, 0, 0.44);
  addMound(-0.43, 0.08, 0.15, 0.1, 0.05, 0.56, 0, 0.57);
  addMound(0.0, 0.04, 0.14, 0.095, 0.052, -0.1, 0, 0.69);
  addMound(0.43, -0.13, 0.12, 0.08, 0.043, 0.75, 0, 0.78);
  addMound(-0.02, -0.36, 0.1, 0.065, 0.036, -0.9, 0, 0.86);
  addMound(0.18, 0.32, 0.095, 0.06, 0.032, 0.35, 0, 0.94);

  addMound(-0.18, 0.025, 0.072, 0.024, 0.038, -0.12, 1, 0.28);
  addMound(0.18, -0.085, 0.064, 0.022, 0.034, 0.16, 1, 0.44);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('aDirtKind', new THREE.Float32BufferAttribute(kinds, 1));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function lin(hex: number): THREE.Color {
  return new THREE.Color(hex).convertSRGBToLinear();
}

function glslColor(hex: number): string {
  const c = lin(hex);
  return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`;
}

const DUST_COLOR = lin(0xf0dfb8);
const DIRT_LOAM_DARK = glslColor(0xc48248);
const DIRT_LOAM_MID = glslColor(0xe0a062);
const DIRT_LOAM_LIGHT = glslColor(0xffd59c);
const DIRT_WORM_DARK = glslColor(0x6f3f2f);
const DIRT_WORM_WET = glslColor(0x9a604b);

const DUST_NOISE_GLSL = /* glsl */ `
  float sdHash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float sdNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = sdHash21(i);
    float b = sdHash21(i + vec2(1.0, 0.0));
    float c = sdHash21(i + vec2(0.0, 1.0));
    float d = sdHash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
`;

export function createSandDustMaterial(): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({
    color: DUST_COLOR,
    transparent: true,
    opacity: 0.36,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
    toneMapped: true
  });

  material.onBeforeCompile = shader => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uDustVisibility = { value: 1 };
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
        uniform float uTime;
        uniform float uDustVisibility;
        uniform float uWindStrength;
        uniform float uWindGustStrength;
        uniform float uWindGustScale;
        uniform float uWindGustSpeed;
        uniform float uWindTurbulence;
        uniform vec2 uWindDir;
        uniform vec2 uWindOffset;
        varying vec2 vDustUv;
        varying float vDustSeed;
        varying float vDustGust;
        ${DUST_NOISE_GLSL}`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vDustUv = uv;
        vec3 instWorld = instanceMatrix[3].xyz;
        float seed = sdHash21(instWorld.xz + instWorld.y + uWindOffset);
        vDustSeed = seed;
        vec2 windDir = normalize(uWindDir + vec2(0.0001, 0.0));
        vec2 windSide = vec2(-windDir.y, windDir.x);
        vec2 windUv = vec2(
          dot(instWorld.xz + uWindOffset, windDir),
          dot(instWorld.xz + uWindOffset, windSide)
        );
        vec2 gustUv = windUv * max(uWindGustScale, 0.001)
          + vec2(uTime * uWindGustSpeed, sin(uTime * uWindGustSpeed * 0.43) * 0.18);
        float gust = smoothstep(0.22, 0.88, sdNoise(gustUv + seed * 7.0));
        vDustGust = gust;
        float h = clamp(uv.y, 0.0, 1.0);
        float stream = sin(uTime * (1.25 + uWindGustSpeed) + seed * 6.28318 + position.x * 3.8);
        float flutter = sin(uTime * (3.6 + uWindTurbulence * 2.0) + seed * 11.0 + position.z * 5.0);
        transformed.x += (stream * 0.12 + gust * 0.22) * h * uWindStrength * uDustVisibility;
        transformed.y += (0.025 + gust * 0.07 + flutter * 0.018) * h * h * uWindGustStrength * uDustVisibility;
        transformed.z += flutter * 0.08 * h * uWindTurbulence * uDustVisibility;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform float uDustVisibility;
        varying vec2 vDustUv;
        varying float vDustSeed;
        varying float vDustGust;
        ${DUST_NOISE_GLSL}`
      )
      .replace(
        '#include <alphamap_fragment>',
        `#include <alphamap_fragment>
        float xEdge = smoothstep(0.0, 0.14, vDustUv.x) * (1.0 - smoothstep(0.84, 1.0, vDustUv.x));
        float yEdge = smoothstep(0.0, 0.2, vDustUv.y) * (1.0 - smoothstep(0.62, 1.0, vDustUv.y));
        float thread = sdNoise(vec2(vDustUv.x * 7.5 + uTime * 0.34 + vDustSeed * 9.0, vDustUv.y * 1.8));
        float plume = smoothstep(0.42, 0.95, thread) * (0.34 + vDustGust * 0.54);
        diffuseColor.a *= uDustVisibility * xEdge * yEdge * plume * 0.78;`
      );
  };

  material.customProgramCacheKey = () => 'sand-dust-v2';
  return material;
}

export function createDirtLifeMaterial(): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 1,
    alphaTest: 0.025,
    depthWrite: true,
    depthTest: true,
    side: THREE.DoubleSide,
    toneMapped: true
  });

  material.onBeforeCompile = shader => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uDirtVisibility = { value: 1 };
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
        attribute float aDirtKind;
        uniform float uTime;
        uniform float uDirtVisibility;
        uniform float uWindStrength;
        uniform float uWindGustStrength;
        uniform float uWindGustScale;
        uniform float uWindGustSpeed;
        uniform float uWindTurbulence;
        uniform vec2 uWindDir;
        uniform vec2 uWindOffset;
        varying vec2 vDirtUv;
        varying float vDirtKind;
        varying float vDirtSeed;
        varying float vDirtGust;
        varying float vDirtHeight;
        ${DUST_NOISE_GLSL}`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vDirtUv = uv;
        vDirtKind = aDirtKind;
        vec3 instWorld = instanceMatrix[3].xyz;
        float seed = sdHash21(instWorld.xz + instWorld.y + uWindOffset + vec2(19.73, 4.17));
        vDirtSeed = seed;
        vDirtHeight = position.y;
        vec2 windDir = normalize(uWindDir + vec2(0.0001, 0.0));
        vec2 windSide = vec2(-windDir.y, windDir.x);
        vec2 windUv = vec2(
          dot(instWorld.xz + uWindOffset, windDir),
          dot(instWorld.xz + uWindOffset, windSide)
        );
        vec2 gustUv = windUv * max(uWindGustScale, 0.001)
          + vec2(uTime * uWindGustSpeed, sin(uTime * uWindGustSpeed * 0.43) * 0.18);
        float gust = smoothstep(0.24, 0.9, sdNoise(gustUv + seed * 5.0));
        vDirtGust = gust;
        float crawl = sin(uTime * (3.0 + uWindGustSpeed * 0.35) + seed * 6.28318 + uv.x * 9.8);
        float tiny = sin(uTime * (2.4 + uWindTurbulence) + seed * 12.0 + uv.x * 17.0);
        if (aDirtKind > 0.5) {
          float travel = fract(uTime * (0.16 + uWindGustSpeed * 0.065) + seed * 1.7 + uv.x * 0.08) - 0.5;
          transformed.x += travel * 0.58 * uDirtVisibility;
          transformed.y += (0.008 + abs(crawl) * 0.02 + gust * 0.008) * uDirtVisibility;
          transformed.z += crawl * 0.085 * uDirtVisibility;
        } else {
          transformed.x += (gust - 0.5) * 0.018 * position.y * uWindStrength * uDirtVisibility;
          transformed.y += (gust * 0.012 + tiny * 0.005) * uWindGustStrength * uDirtVisibility;
          transformed.z += tiny * 0.01 * position.y * uWindTurbulence * uDirtVisibility;
        }`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform float uDirtVisibility;
        varying vec2 vDirtUv;
        varying float vDirtKind;
        varying float vDirtSeed;
        varying float vDirtGust;
        varying float vDirtHeight;
        ${DUST_NOISE_GLSL}`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float soilNoise = sdNoise(vec2(vDirtUv.x * 5.2 + vDirtSeed * 7.0, vDirtUv.y * 4.4 - vDirtSeed * 3.0));
        vec3 soil = mix(${DIRT_LOAM_DARK}, ${DIRT_LOAM_MID}, smoothstep(0.1, 0.62, soilNoise));
        soil = mix(soil, ${DIRT_LOAM_LIGHT}, smoothstep(0.3, 1.0, soilNoise) * (0.34 + vDirtHeight * 4.4));
        soil *= 1.04 + vDirtHeight * 2.2 + vDirtGust * 0.1;
        float crawlPulse = smoothstep(0.38, 0.92, sdNoise(vec2(vDirtUv.x * 4.2 - uTime * 0.16 + vDirtSeed * 6.0, vDirtSeed * 3.7)));
        vec3 crawler = mix(${DIRT_WORM_DARK}, ${DIRT_WORM_WET}, crawlPulse * 0.5 + vDirtGust * 0.16);
        diffuseColor.rgb = mix(soil, crawler, step(0.5, vDirtKind));`
      )
      .replace(
        '#include <alphamap_fragment>',
        `#include <alphamap_fragment>
        float crawlerPulse = 0.56 + 0.34 * sin(uTime * 3.4 + vDirtSeed * 6.28318 + vDirtUv.x * 8.0);
        float alpha = mix(0.95, crawlerPulse * 0.55, step(0.5, vDirtKind));
        diffuseColor.a *= clamp(uDirtVisibility, 0.0, 1.0) * alpha;`
      );
  };

  material.customProgramCacheKey = () => 'dirt-life-v4';
  return material;
}

function computeSandDustMatrix(
  x: number,
  y: number,
  z: number,
  wispIndex: number,
  target: THREE.Matrix4,
  terrainSeed: number,
  windProfile: WindProfile
): THREE.Matrix4 {
  voxelCoordToWorld(x, y, z, _world);
  _up.copy(FACE_NORMALS[dominantFaceForPosition(_world)]);
  deterministicTangentForUp(_up, _tangent);
  _bitangent.crossVectors(_up, _tangent).normalize();

  const dir = windProfile.direction;
  _wind.copy(_tangent).multiplyScalar(dir.x).addScaledVector(_bitangent, dir.y).normalize();
  if (_wind.lengthSq() < 1e-5) _wind.copy(_tangent);
  _side.crossVectors(_up, _wind).normalize();
  if (_side.lengthSq() < 1e-5) _side.copy(_bitangent);

  const phaseSalt = SAND_DUST_PHASE_SALT + wispIndex * 17;
  const r0 = seededVoxelUnit(x, y, z, SAND_DUST_OFFSET_U_SALT + wispIndex * 31, terrainSeed);
  const r1 = seededVoxelUnit(x, y, z, SAND_DUST_OFFSET_V_SALT + wispIndex * 31, terrainSeed);
  const r2 = seededVoxelUnit(x, y, z, SAND_DUST_SCALE_SALT + wispIndex * 31, terrainSeed);
  const r3 = seededVoxelUnit(x, y, z, SAND_DUST_VEER_SALT + wispIndex * 31, terrainSeed);
  const r4 = seededVoxelUnit(x, y, z, phaseSalt, terrainSeed);

  _offset.copy(_up).multiplyScalar(SAND_DUST_SURFACE_OFFSET + SAND_DUST_BASE_LIFT + r4 * 0.035);
  _offset.addScaledVector(_wind, (r0 - 0.5) * 1.08);
  _offset.addScaledVector(_side, (r1 - 0.5) * 1.45);

  _basis.makeBasis(_wind, _up, _side);
  _yaw.makeRotationY((r3 - 0.5) * 0.92);
  _scale.makeScale(
    SAND_DUST_WIDTH * (0.72 + r2 * 0.68) * (0.85 + windProfile.gustStrength * 0.12),
    SAND_DUST_HEIGHT * (0.72 + r4 * 0.72),
    SAND_DUST_DEPTH * (0.65 + r1 * 0.75)
  );
  _translate.makeTranslation(_world.x + _offset.x, _world.y + _offset.y, _world.z + _offset.z);

  target.copy(_translate);
  target.multiply(_basis);
  target.multiply(_local.copy(_yaw).multiply(_scale));
  return target;
}

function computeDirtLifeMatrix(
  x: number,
  y: number,
  z: number,
  clusterIndex: number,
  target: THREE.Matrix4,
  terrainSeed: number,
  windProfile: WindProfile
): THREE.Matrix4 {
  voxelCoordToWorld(x, y, z, _world);
  _up.copy(FACE_NORMALS[dominantFaceForPosition(_world)]);
  deterministicTangentForUp(_up, _tangent);
  _bitangent.crossVectors(_up, _tangent).normalize();

  const dir = windProfile.direction;
  _wind.copy(_tangent).multiplyScalar(dir.x).addScaledVector(_bitangent, dir.y).normalize();
  if (_wind.lengthSq() < 1e-5) _wind.copy(_tangent);
  _side.crossVectors(_up, _wind).normalize();
  if (_side.lengthSq() < 1e-5) _side.copy(_bitangent);

  const phaseSalt = DIRT_LIFE_PHASE_SALT + clusterIndex * 17;
  const r0 = seededVoxelUnit(x, y, z, DIRT_LIFE_OFFSET_U_SALT + clusterIndex * 31, terrainSeed);
  const r1 = seededVoxelUnit(x, y, z, DIRT_LIFE_OFFSET_V_SALT + clusterIndex * 31, terrainSeed);
  const r2 = seededVoxelUnit(x, y, z, DIRT_LIFE_SCALE_SALT + clusterIndex * 31, terrainSeed);
  const r3 = seededVoxelUnit(x, y, z, DIRT_LIFE_VEER_SALT + clusterIndex * 31, terrainSeed);
  const r4 = seededVoxelUnit(x, y, z, phaseSalt, terrainSeed);

  _offset.copy(_up).multiplyScalar(DIRT_LIFE_SURFACE_OFFSET + DIRT_LIFE_BASE_LIFT + r4 * 0.018);
  _offset.addScaledVector(_wind, (r0 - 0.5) * 1.48);
  _offset.addScaledVector(_side, (r1 - 0.5) * 1.48);

  _basis.makeBasis(_wind, _up, _side);
  _yaw.makeRotationY((r3 - 0.5) * (0.9 + windProfile.veer * 0.35));
  _scale.makeScale(
    DIRT_LIFE_LENGTH * (0.72 + r2 * 0.72),
    DIRT_LIFE_HEIGHT * (0.82 + r4 * 0.42),
    DIRT_LIFE_DEPTH * (0.72 + r1 * 0.66)
  );
  _translate.makeTranslation(_world.x + _offset.x, _world.y + _offset.y, _world.z + _offset.z);

  target.copy(_translate);
  target.multiply(_basis);
  target.multiply(_local.copy(_yaw).multiply(_scale));
  return target;
}

export function buildSandDustInstances(
  mesh: THREE.InstancedMesh,
  density: number,
  maxDistance: number,
  playerWorld: THREE.Vector3 | null,
  terrainSeed: number,
  windProfile: WindProfile
): SurfaceEffectBuildResult {
  const capacity = mesh.instanceMatrix.count;
  const maxDistSq = maxDistance * maxDistance;
  const perVoxel = sandDustWispsPerVoxel(density);
  const coverage = sandDustCoverage(density);
  let slot = 0;
  let voxelCount = 0;

  if (density <= 0 || perVoxel <= 0) {
    mesh.count = 0;
    mesh.instanceMatrix.needsUpdate = true;
    return { count: 0, voxelCount: 0 };
  }

  for (const voxel of voxelSystem.getAllVoxels().values()) {
    if (slot >= capacity) break;
    if (!isSandDustVoxel(voxel)) continue;
    const [x, y, z] = voxel.position;
    if (seededVoxelUnit(x, y, z, SAND_DUST_COVERAGE_SALT, terrainSeed) > coverage) continue;

    voxelCoordToWorld(x, y, z, _world);
    if (maxDistance > 0 && playerWorld && _world.distanceToSquared(playerWorld) > maxDistSq) continue;

    voxelCount++;
    for (let i = 0; i < perVoxel && slot < capacity; i++) {
      computeSandDustMatrix(x, y, z, i, _scratch, terrainSeed, windProfile);
      mesh.setMatrixAt(slot, _scratch);
      slot++;
    }
  }

  mesh.count = slot;
  mesh.instanceMatrix.needsUpdate = true;
  return { count: slot, voxelCount };
}

export function buildDirtLifeInstances(
  mesh: THREE.InstancedMesh,
  density: number,
  maxDistance: number,
  playerWorld: THREE.Vector3 | null,
  terrainSeed: number,
  windProfile: WindProfile
): SurfaceEffectBuildResult {
  const capacity = mesh.instanceMatrix.count;
  const maxDistSq = maxDistance * maxDistance;
  const perVoxel = dirtLifeClustersPerVoxel(density);
  const coverage = dirtLifeCoverage(density);
  let slot = 0;
  let voxelCount = 0;

  if (density <= 0 || perVoxel <= 0) {
    mesh.count = 0;
    mesh.instanceMatrix.needsUpdate = true;
    return { count: 0, voxelCount: 0 };
  }

  for (const voxel of voxelSystem.getAllVoxels().values()) {
    if (slot >= capacity) break;
    if (!isDirtLifeVoxel(voxel)) continue;
    const [x, y, z] = voxel.position;
    if (seededVoxelUnit(x, y, z, DIRT_LIFE_COVERAGE_SALT, terrainSeed) > coverage) continue;

    voxelCoordToWorld(x, y, z, _world);
    if (maxDistance > 0 && playerWorld && _world.distanceToSquared(playerWorld) > maxDistSq) continue;

    voxelCount++;
    for (let i = 0; i < perVoxel && slot < capacity; i++) {
      computeDirtLifeMatrix(x, y, z, i, _scratch, terrainSeed, windProfile);
      mesh.setMatrixAt(slot, _scratch);
      slot++;
    }
  }

  mesh.count = slot;
  mesh.instanceMatrix.needsUpdate = true;
  return { count: slot, voxelCount };
}

export function applySandDustWindProfileToMaterial(profile: WindProfile, material: THREE.Material): void {
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

export function applyDirtLifeWindProfileToMaterial(profile: WindProfile, material: THREE.Material): void {
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

export function updateSandDustMaterial(
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
  if (u.uDustVisibility) {
    (u.uDustVisibility.value as number) = quality.animatedShaders
      ? Math.min(1.35, Math.max(0, reality.atmosphere))
      : 0;
  }
}

export function updateDirtLifeMaterial(
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
  if (u.uDirtVisibility) {
    (u.uDirtVisibility.value as number) = quality.animatedShaders
      ? Math.min(1.18, Math.max(0, reality.detail * 0.35 + reality.organic * 0.85))
      : 0;
  }
}
