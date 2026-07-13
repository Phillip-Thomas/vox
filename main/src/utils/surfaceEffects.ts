import * as THREE from 'three';
import { voxelCoordToWorld } from './cubeGravityConstants';
import { deterministicTangentForUp, dominantFaceForPosition, FACE_NORMALS } from './surfaceControls';
import { voxelSystem } from './efficientVoxelSystem';
import { MaterialType } from '../types/materials';
import { seededVoxelUnit } from './seededHash';
import type { GraphicsQuality } from '../config/graphicsSettings';
import type { VoxelRealityEffects } from '../game/systems/realityRenderSystem';
import type { WindProfile } from './windProfile';

// =============================================================================
// GROUNDED VOXEL SURFACE EFFECTS
// =============================================================================
//
// Replaces the old lifted ribbon/card "phenomena" (which read as an aura hanging
// over every voxel) with three grounded primitives:
//
//  1. SHEETS  — one quad lying flush ON each exposed eligible face. The fragment
//     shader samples WORLD-SPACE noise in the face's tangent plane, so patterns
//     (blowing sand streams, soil moisture, glinting frost) continue seamlessly
//     across every run of adjacent same-material voxels instead of repeating a
//     per-voxel motif. Wind advection uses the shared planet WindProfile.
//  2. MOTES   — sparse, tiny airborne particles (pollen, spores, embers) that
//     drift downwind through a small wrap-around cell, for the few phenomena
//     that genuinely belong in the air. Small + dim: atmosphere, not aura.
//  3. CRITTERS — see surfaceCritters.ts: worm/caterpillar agents that crawl
//     across adjacent same-material voxels.
//
// All layers stay mapped to the global systems: per-planet WindProfile,
// VoxelRealityEffects stage gating, art-direction palette colors, and the
// GraphicsQuality density/distance/animatedShaders gates.
// =============================================================================

export type SurfaceEffectId =
  | 'sandFlow'
  | 'soilLife'
  | 'frost'
  | 'crystalGlints'
  | 'metallicFlecks'
  | 'ashDrift'
  | 'lavaCrust'
  | 'pollen'
  | 'fungalSpores'
  | 'lavaEmbers'
  | 'wormLife'
  | 'grassLife';

export type SurfaceSheetKind = 'flow' | 'soil' | 'glint';

export interface SurfaceSheetConfig {
  id: SurfaceEffectId;
  kind: SurfaceSheetKind;
  materials: MaterialType[];
  /** Primary surface color (linear). flow: lofted grains; soil: moist loam; glint: facet base. */
  colorA: THREE.Color;
  /** Secondary/highlight color (linear). */
  colorB: THREE.Color;
  /** Tertiary color (linear): soil wet-trail / glint emissive core. */
  colorC: THREE.Color;
  /** Overall strength 0..1 — scales alpha, then further scaled by density. */
  intensity: number;
  /** World-space frequency of broad activity patches (lower = larger patches). */
  patchScale: number;
  /** Advection rate of the pattern downwind (flow) or trail creep (soil). */
  flowSpeed: number;
  /** Micro-detail frequency: grain cells (flow), crumb casts (soil), facet cells (glint). */
  grainScale: number;
  /** Glint twinkle sharpness/energy 0..1. */
  sparkle: number;
  /** Emissive lift for glint cores (lava crust, crystal). */
  emissive: number;
  /** Frost-feather streak amount (glint kind only). */
  feather: number;
  salt: number;
}

export interface SurfaceMoteConfig {
  id: SurfaceEffectId;
  materials: MaterialType[];
  colorA: THREE.Color;
  colorB: THREE.Color;
  coverageBase: number;
  coverageGain: number;
  motesPerVoxel: number;
  /** World-space particle size (a mote is TINY: 0.02..0.07). */
  size: number;
  /** Minimum height above the face. */
  baseLift: number;
  /** Vertical wander range above baseLift. */
  liftRange: number;
  /** Downwind drift speed in world units/s. */
  driftSpeed: number;
  /** Upward loop speed (embers/spores rise, pollen ~0 hovers). */
  rise: number;
  alpha: number;
  /** Emissive brightness multiplier (embers glow). */
  emissive: number;
  salt: number;
}

export interface SurfaceEffectBuildResult {
  count: number;
  voxelCount: number;
}

// Voxel cubes render as boxGeometry [1.98^3] at VOXEL_SCALE=2, so the face
// plane sits 0.99 from the center. Sheets hover 0.012 above it — visually flush
// but clear of z-fighting (plus polygonOffset on the material).
const SHEET_SURFACE_OFFSET = 1.002;
const SHEET_SIZE = 2.0;
// Motes drift inside a wrap-around cell this many world units across, centered
// on their spawn voxel, so they visibly cross into neighboring voxels.
const MOTE_DRIFT_CELL = 3.2;

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

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

// -----------------------------------------------------------------------------
// Eligibility + exposure
// -----------------------------------------------------------------------------

export function isSurfaceEffectVoxel(
  voxel: { material: string; supportsSurfaceResources?: boolean },
  config: Pick<SurfaceSheetConfig | SurfaceMoteConfig, 'materials'>
): boolean {
  return voxel.supportsSurfaceResources !== false && config.materials.includes(voxel.material as MaterialType);
}

/** True when the cell blocks light/effects: any live voxel, or undug original terrain. */
function isSolidCell(x: number, y: number, z: number): boolean {
  if (voxelSystem.hasVoxel(x, y, z)) return true;
  return voxelSystem.wasOriginalTerrain(x, y, z) && !voxelSystem.isDeleted(x, y, z);
}

/**
 * Whether the voxel's outward (dominant) face is actually open to the air.
 * The old system skipped this and decorated faces buried under cliffs/overhangs.
 */
export function isVoxelFaceOpen(x: number, y: number, z: number): boolean {
  voxelCoordToWorld(x, y, z, _world);
  const up = FACE_NORMALS[dominantFaceForPosition(_world)];
  return !isSolidCell(x + Math.round(up.x), y + Math.round(up.y), z + Math.round(up.z));
}

// -----------------------------------------------------------------------------
// Density scaling (pure, unit-tested)
// -----------------------------------------------------------------------------

/**
 * Reality-stage multiplier for spawned surface effects, independent of device
 * quality. bare/color stages render nothing; alive/paradox render fully.
 */
export function surfaceEffectRealityDensityScale(reality: VoxelRealityEffects): number {
  return clamp(
    Math.max(
      reality.atmosphere,
      reality.organic,
      reality.thermal,
      reality.crystalline,
      reality.metal,
      reality.detail * 0.72
    ),
    0,
    1.35
  );
}

/**
 * Sheet pattern strength for a density (sheets never drop voxels — continuity).
 * Flat response floor keeps low-weight planets clearly readable: ecology
 * weights of ~0.3 still need a visible phenomenon, just a calmer one.
 */
export function surfaceSheetIntensity(density: number, config: Pick<SurfaceSheetConfig, 'intensity'>): number {
  if (density <= 0) return 0;
  return clamp(config.intensity * (0.68 + 0.32 * Math.min(density, 1.35)), 0, 1);
}

export function surfaceMotesPerVoxel(density: number, config: Pick<SurfaceMoteConfig, 'motesPerVoxel'>): number {
  if (density <= 0 || config.motesPerVoxel <= 0) return 0;
  return Math.max(1, Math.round(density * config.motesPerVoxel));
}

export function surfaceMoteCoverage(
  density: number,
  config: Pick<SurfaceMoteConfig, 'coverageBase' | 'coverageGain'>
): number {
  if (density <= 0) return 0;
  return clamp(config.coverageBase + density * config.coverageGain, 0, 1);
}

/**
 * Per-effect visibility from the reality stage — which "reality channels" light
 * up each phenomenon. Mirrors the shared render contract used by grass/water.
 */
export function surfaceEffectVisibility(id: SurfaceEffectId, reality: VoxelRealityEffects): number {
  switch (id) {
    case 'sandFlow':
      return reality.atmosphere * 0.9 + reality.detail * 0.2;
    case 'ashDrift':
      return reality.thermal * 0.5 + reality.atmosphere * 0.6;
    case 'soilLife':
      return reality.detail * 0.35 + reality.organic * 0.85;
    case 'wormLife':
      return reality.organic * 0.9 + reality.detail * 0.2;
    case 'grassLife':
      return reality.organic;
    case 'frost':
    case 'crystalGlints':
      return reality.crystalline * 0.88 + reality.detail * 0.18;
    case 'metallicFlecks':
      return reality.metal * 0.9 + reality.detail * 0.16;
    case 'lavaCrust':
    case 'lavaEmbers':
      return reality.thermal;
    case 'pollen':
    case 'fungalSpores':
      return reality.organic * 0.8 + reality.atmosphere * 0.35;
    default:
      return reality.detail;
  }
}

// -----------------------------------------------------------------------------
// Counting (capacity sizing)
// -----------------------------------------------------------------------------

export function countSurfaceSheetVoxels(
  config: SurfaceSheetConfig,
  density: number,
  _terrainSeed: number
): number {
  if (density <= 0) return 0;
  let n = 0;
  for (const voxel of voxelSystem.getAllVoxels().values()) {
    if (!isSurfaceEffectVoxel(voxel, config)) continue;
    const [x, y, z] = voxel.position;
    if (!isVoxelFaceOpen(x, y, z)) continue;
    n++;
  }
  return n;
}

export function countSurfaceMoteVoxels(
  config: SurfaceMoteConfig,
  density: number,
  terrainSeed: number
): number {
  if (density <= 0) return 0;
  const coverage = surfaceMoteCoverage(density, config);
  const perVoxel = surfaceMotesPerVoxel(density, config);
  let n = 0;
  for (const voxel of voxelSystem.getAllVoxels().values()) {
    if (!isSurfaceEffectVoxel(voxel, config)) continue;
    const [x, y, z] = voxel.position;
    if (!isVoxelFaceOpen(x, y, z)) continue;
    if (seededVoxelUnit(x, y, z, config.salt, terrainSeed) > coverage) continue;
    n += perVoxel;
  }
  return n;
}

// -----------------------------------------------------------------------------
// Geometry
// -----------------------------------------------------------------------------

/** Unit quad lying in local XZ (normal = +Y); the instance basis maps +Y to the face normal. */
export function createSurfaceSheetGeometry(): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(1, 1, 1, 1);
  geo.rotateX(-Math.PI / 2);
  return geo;
}

/**
 * A mote is a tiny crossed pair of quads centered on the origin (unit size;
 * instance scale sets the world size, ~0.02-0.07).
 */
export function createSurfaceMoteGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const addCard = (axis: 'x' | 'z') => {
    const base = positions.length / 3;
    if (axis === 'x') {
      positions.push(-0.5, -0.5, 0, 0.5, -0.5, 0, -0.5, 0.5, 0, 0.5, 0.5, 0);
    } else {
      positions.push(0, -0.5, -0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5, 0.5);
    }
    uvs.push(0, 0, 1, 0, 0, 1, 1, 1);
    indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  };

  addCard('x');
  addCard('z');

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// -----------------------------------------------------------------------------
// Shared GLSL
// -----------------------------------------------------------------------------

export const SURFACE_NOISE_GLSL = /* glsl */ `
  float seHash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float seNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = seHash21(i);
    float b = seHash21(i + vec2(1.0, 0.0));
    float c = seHash21(i + vec2(0.0, 1.0));
    float d = seHash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  // GLSL port of deterministicTangentForUp: same helper-axis pick + projection,
  // so shader tangent frames match CPU placement frames on all 6 cube faces.
  vec3 seTangentForUp(vec3 up) {
    vec3 helper = abs(up.x) < 0.9
      ? vec3(1.0, 0.0, 0.0)
      : (abs(up.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0));
    return normalize(helper - up * dot(helper, up));
  }
`;

const SHEET_WIND_UNIFORMS_GLSL = /* glsl */ `
  uniform float uTime;
  uniform float uVisibility;
  uniform float uIntensity;
  uniform float uPatchScale;
  uniform float uFlowSpeed;
  uniform float uGrainScale;
  uniform float uSparkle;
  uniform float uEmissive;
  uniform float uFeather;
  uniform float uFadeEnd;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorC;
  uniform float uWindStrength;
  uniform float uWindGustStrength;
  uniform float uWindGustScale;
  uniform float uWindGustSpeed;
  uniform float uWindTurbulence;
  uniform vec2 uWindDir;
  uniform vec2 uWindOffset;
`;

// Shared fragment prelude: world tangent-plane coordinates + gust cells + fade.
// Sampling by WORLD position is what makes the pattern continuous across all
// adjacent voxels of the same material.
const SHEET_FRAGMENT_PRELUDE = /* glsl */ `
  vec3 seUp = normalize(vSeUp);
  vec3 seT = seTangentForUp(seUp);
  vec3 seB = normalize(cross(seUp, seT));
  vec2 seP = vec2(dot(vSePos, seT), dot(vSePos, seB));
  vec2 seW = normalize(uWindDir + vec2(0.0001, 0.0));
  vec2 sePw = vec2(dot(seP, seW), dot(seP, vec2(-seW.y, seW.x)));
  float seGust = smoothstep(0.24, 0.86,
    seNoise(seP * uWindGustScale + seW * (uTime * uWindGustSpeed) + uWindOffset));
  float seDist = distance(cameraPosition, vSePos);
  float seFade = uFadeEnd > 0.0 ? 1.0 - smoothstep(uFadeEnd * 0.62, uFadeEnd, seDist) : 1.0;
  float seAlpha = 0.0;
  vec3 seCol = uColorA;
`;

export const SURFACE_SHEET_KIND_GLSL: Record<SurfaceSheetKind, string> = {
  // Wind-driven saltation: long thin streams advected downwind, alive inside
  // moving gust patches, with skittering bright grains. Sand + ash films.
  flow: /* glsl */ `
    float seT1 = uTime * uFlowSpeed * (0.7 + 0.5 * uWindStrength);
    float seS1 = seNoise(vec2(sePw.x * 0.42 - seT1, sePw.y * 2.4));
    float seS2 = seNoise(vec2(sePw.x * 0.9 - seT1 * 1.63 + 37.0, sePw.y * 4.6 + 11.0));
    float seStreaks = smoothstep(0.42, 0.9, seS1 * 0.7 + seS2 * 0.6);
    float sePatch = smoothstep(0.22, 0.78,
      seNoise(seP * uPatchScale + seW * (uTime * 0.02) + uWindOffset * 0.63));
    vec2 seGrainUv = vec2(
      sePw.x * uGrainScale - seT1 * 2.2,
      sePw.y * uGrainScale * 1.6
    );
    vec2 seGrainCell = floor(seGrainUv);
    vec2 seGrainLocal = fract(seGrainUv) - 0.5;
    float seGrainSeed = seHash21(seGrainCell + uWindOffset);
    vec2 seGrainJitter = vec2(
      seHash21(seGrainCell + 13.7),
      seHash21(seGrainCell + 47.1)
    ) - 0.5;
    seGrainLocal -= seGrainJitter * 0.42;
    float seGrainShape = 1.0 - smoothstep(
      0.08,
      0.2,
      length(vec2(seGrainLocal.x * 0.42, seGrainLocal.y * 2.8))
    );
    float seGrains = step(0.88, seGrainSeed) * seGrainShape;
    float seFlow = seStreaks * (0.3 + 0.7 * sePatch) * (0.5 + 0.5 * seGust * uWindGustStrength);
    seCol = mix(uColorA, uColorB, clamp(seS2 * 0.8 + seGust * 0.3, 0.0, 1.0));
    seCol += uColorB * seGrains * seFlow * 0.6;
    // Streams and shaped grains carry the effect. No full-cell alpha floor:
    // even if this legacy material is used by a harness, its carrier stays hidden.
    seAlpha = uIntensity * uVisibility * seFade
      * (seFlow * (0.75 + 0.25 * seS2) + seGrains * seFlow * 0.24);
  `,
  // Living topsoil: moisture patches breathing across the field, crumbly worm
  // casts catching light, and thin wet crawl-trails that creep and fade.
  soil: /* glsl */ `
    float seM1 = seNoise(seP * 1.6 + uWindOffset * 0.4);
    float seM2 = seNoise(seP * 3.8 + vec2(17.0, 3.0));
    float seMoist = smoothstep(0.28, 0.82,
      seM1 * 0.66 + seM2 * 0.44 + sin(uTime * 0.05 + seM1 * 6.28318) * 0.05);
    float seCastN = seNoise(seP * uGrainScale + uWindOffset);
    float seCasts = smoothstep(0.76, 0.94, seCastN);
    float seCastHi = smoothstep(0.86, 0.975, seCastN);
    float seTrailT = uTime * uFlowSpeed;
    float seTr = seNoise(seP * 1.3 + vec2(seTrailT, -seTrailT * 0.6));
    // Trails live in regional colonies, not across every face.
    float seTrailPatch = smoothstep(0.52, 0.86, seNoise(seP * 0.22 + uWindOffset));
    float seTrail = smoothstep(0.9, 0.985, 1.0 - abs(seTr * 2.0 - 1.0)) * seTrailPatch;
    float seFresh = clamp(0.45 + 0.55 * sin(uTime * 0.3 + seHash21(floor(seP * 0.4)) * 6.28318), 0.0, 1.0);
    seCol = mix(uColorB, uColorA, seMoist);
    seCol = mix(seCol, uColorB * 1.18, seCastHi * 0.6);
    seCol = mix(seCol, uColorC, seTrail * seFresh);
    // Quieter than grass/sand from gameplay distance: a soft moisture wash with
    // local casts and a few fresh trails, not a full crack network.
    seAlpha = uIntensity * uVisibility * seFade
      * clamp(seMoist * 0.26 + seCasts * 0.55 + seTrail * seFresh * 0.8, 0.0, 1.0);
  `,
  // Sparse micro-facets embedded in the surface that twinkle over time and as
  // the viewer moves. Frost adds wind-combed feather streaks; lava crust runs
  // the same cells hot through uEmissive.
  glint: /* glsl */ `
    vec2 seCellUv = seP * uGrainScale;
    vec2 seCell = floor(seCellUv);
    vec2 seCf = fract(seCellUv) - 0.5;
    float seH = seHash21(seCell + uWindOffset);
    float sePresent = step(1.0 - 0.06 - uIntensity * 0.22, seH);
    vec3 seV = normalize(cameraPosition - vSePos);
    float seFacing = clamp(dot(seV, seUp), 0.0, 1.0);
    float seTw = pow(clamp(0.5 + 0.5 * sin(uTime * (1.2 + seH * 5.0) + seH * 41.0 + seFacing * 8.0), 0.0, 1.0),
      2.0 + uSparkle * 8.0);
    float seFacet = smoothstep(0.42, 0.05, length(seCf));
    float seGlint = sePresent * seTw * seFacet;
    float seFeather = uFeather
      * smoothstep(0.62, 0.96, seNoise(vec2(sePw.x * 0.8, sePw.y * 4.6) + uWindOffset))
      * smoothstep(0.35, 0.9, seNoise(seP * uPatchScale + uWindOffset * 1.7));
    seCol = mix(uColorA, uColorB, seTw);
    seEmissiveEnergy = seGlint * uEmissive * uVisibility * seFade;
    seAlpha = uVisibility * seFade
      * clamp(seGlint * (0.55 + uSparkle * 0.45) + seFeather * 0.4, 0.0, 1.0)
      * clamp(uIntensity * 1.6, 0.0, 1.0);
  `
};

// -----------------------------------------------------------------------------
// Materials
// -----------------------------------------------------------------------------

/**
 * Flush surface sheet. MeshStandardMaterial keeps the effect inside the scene's
 * lighting/fog (no unlit glow at night), with the pattern injected via
 * onBeforeCompile like grass/voxel materials.
 */
export function createSurfaceSheetMaterial(config: SurfaceSheetConfig): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.92,
    metalness: 0,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    side: THREE.FrontSide
  });

  material.userData.effectId = config.id;
  material.userData.sheetKind = config.kind;

  material.onBeforeCompile = shader => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uVisibility = { value: 1 };
    shader.uniforms.uIntensity = { value: config.intensity };
    shader.uniforms.uPatchScale = { value: config.patchScale };
    shader.uniforms.uFlowSpeed = { value: config.flowSpeed };
    shader.uniforms.uGrainScale = { value: config.grainScale };
    shader.uniforms.uSparkle = { value: config.sparkle };
    shader.uniforms.uEmissive = { value: config.emissive };
    shader.uniforms.uFeather = { value: config.feather };
    shader.uniforms.uFadeEnd = { value: 0 };
    shader.uniforms.uColorA = { value: config.colorA.clone() };
    shader.uniforms.uColorB = { value: config.colorB.clone() };
    shader.uniforms.uColorC = { value: config.colorC.clone() };
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
        varying vec3 vSePos;
        varying vec3 vSeUp;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vSePos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        vSeUp = normalize((modelMatrix * instanceMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        ${SHEET_WIND_UNIFORMS_GLSL}
        varying vec3 vSePos;
        varying vec3 vSeUp;
        float seEmissiveEnergy = 0.0;
        ${SURFACE_NOISE_GLSL}`
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        {
          ${SHEET_FRAGMENT_PRELUDE}
          ${SURFACE_SHEET_KIND_GLSL[config.kind]}
          if (seAlpha < 0.004) discard;
          diffuseColor.rgb = seCol;
          diffuseColor.a = seAlpha;
        }`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += uColorC * seEmissiveEnergy;`
      );
  };

  material.customProgramCacheKey = () => `surface-sheet-${config.kind}-v2`;
  return material;
}

/** Tiny drifting airborne particles. Unlit (they are specks, not surfaces). */
export function createSurfaceMoteMaterial(config: SurfaceMoteConfig): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
    toneMapped: true
  });

  material.userData.effectId = config.id;

  material.onBeforeCompile = shader => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uVisibility = { value: 1 };
    shader.uniforms.uAlpha = { value: config.alpha };
    shader.uniforms.uEmissiveBoost = { value: config.emissive };
    shader.uniforms.uDriftSpeed = { value: config.driftSpeed };
    shader.uniforms.uRise = { value: config.rise };
    shader.uniforms.uLiftRange = { value: config.liftRange };
    shader.uniforms.uDriftCell = { value: MOTE_DRIFT_CELL };
    shader.uniforms.uFadeEnd = { value: 0 };
    shader.uniforms.uColorA = { value: config.colorA.clone() };
    shader.uniforms.uColorB = { value: config.colorB.clone() };
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
        uniform float uVisibility;
        uniform float uDriftSpeed;
        uniform float uRise;
        uniform float uLiftRange;
        uniform float uDriftCell;
        uniform float uWindStrength;
        uniform float uWindTurbulence;
        uniform vec2 uWindOffset;
        varying vec2 vMoteUv;
        varying float vMoteSeed;
        varying float vMoteFade;
        ${SURFACE_NOISE_GLSL}`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vMoteUv = uv;
        vec3 instWorld = instanceMatrix[3].xyz;
        float seed = seHash21(instWorld.xz + instWorld.y + uWindOffset);
        vMoteSeed = seed;
        // Instance basis columns are (wind, up, side) scaled by mote size; undo
        // the scale so the drift is authored in world units.
        float invSx = 1.0 / max(length(instanceMatrix[0].xyz), 0.0001);
        float invSy = 1.0 / max(length(instanceMatrix[1].xyz), 0.0001);
        float invSz = 1.0 / max(length(instanceMatrix[2].xyz), 0.0001);
        float half_ = uDriftCell * 0.5;
        // Downwind travel wraps around the spawn cell; sideways meander + a
        // vertical loop (embers/spores rise, pollen hovers and bobs).
        float travel = mod(uTime * uDriftSpeed * (0.55 + seed * 0.9) * uWindStrength + seed * uDriftCell * 4.0, uDriftCell) - half_;
        float meander = (seNoise(vec2(uTime * 0.13 + seed * 7.0, seed * 29.0)) - 0.5) * uDriftCell * 0.5 * uWindTurbulence;
        float liftLoop = uRise > 0.001
          ? mod(uTime * uRise * (0.6 + seed * 0.8) + seed * uLiftRange * 3.0, uLiftRange)
          : (0.5 + 0.5 * sin(uTime * (0.5 + seed) + seed * 6.28318)) * uLiftRange;
        transformed.x += travel * invSx;
        transformed.z += meander * invSz;
        transformed.y += liftLoop * invSy;
        // Fade at the wrap edges (and at the top of a rising loop) so motes
        // never pop in or out.
        float edgeFade = 1.0 - smoothstep(half_ - 0.6, half_, abs(travel));
        float riseFade = uRise > 0.001 ? 1.0 - smoothstep(uLiftRange * 0.72, uLiftRange, liftLoop) : 1.0;
        vMoteFade = edgeFade * riseFade * uVisibility;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform float uAlpha;
        uniform float uEmissiveBoost;
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        varying vec2 vMoteUv;
        varying float vMoteSeed;
        varying float vMoteFade;`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float twinkle = 0.5 + 0.5 * sin(uTime * (1.4 + vMoteSeed * 3.0) + vMoteSeed * 6.28318);
        diffuseColor.rgb = mix(uColorA, uColorB, twinkle) * (1.0 + uEmissiveBoost * twinkle);
        float shape = smoothstep(0.5, 0.12, length(vMoteUv - 0.5));
        float a = uAlpha * vMoteFade * shape;
        if (a < 0.004) discard;
        diffuseColor.a = a;`
      );
  };

  material.customProgramCacheKey = () => 'surface-mote-v1';
  return material;
}

// -----------------------------------------------------------------------------
// Instance placement
// -----------------------------------------------------------------------------

function surfaceFrame(x: number, y: number, z: number): void {
  voxelCoordToWorld(x, y, z, _world);
  _up.copy(FACE_NORMALS[dominantFaceForPosition(_world)]);
  deterministicTangentForUp(_up, _tangent);
  _bitangent.crossVectors(_up, _tangent).normalize();
}

function computeSurfaceSheetMatrix(x: number, y: number, z: number, target: THREE.Matrix4): THREE.Matrix4 {
  surfaceFrame(x, y, z);
  // Right-handed frame (Z = X x Y): the legacy (tangent, up, up x tangent)
  // basis mirrors the winding (negative determinant), which back-face-culls a
  // FrontSide sheet. DoubleSide layers never noticed; a flush quad must.
  _side.crossVectors(_tangent, _up).normalize();
  _basis.makeBasis(_tangent, _up, _side);
  _scale.makeScale(SHEET_SIZE, 1, SHEET_SIZE);
  _offset.copy(_up).multiplyScalar(SHEET_SURFACE_OFFSET);
  _translate.makeTranslation(_world.x + _offset.x, _world.y + _offset.y, _world.z + _offset.z);
  target.copy(_translate);
  target.multiply(_basis);
  target.multiply(_scale);
  return target;
}

function computeSurfaceMoteMatrix(
  config: SurfaceMoteConfig,
  x: number,
  y: number,
  z: number,
  moteIndex: number,
  target: THREE.Matrix4,
  terrainSeed: number,
  windProfile: WindProfile
): THREE.Matrix4 {
  surfaceFrame(x, y, z);

  const dir = windProfile.direction;
  _wind.copy(_tangent).multiplyScalar(dir.x).addScaledVector(_bitangent, dir.y).normalize();
  if (_wind.lengthSq() < 1e-5) _wind.copy(_tangent);
  _side.crossVectors(_up, _wind).normalize();
  if (_side.lengthSq() < 1e-5) _side.copy(_bitangent);

  const salt = config.salt + moteIndex * 41;
  const r0 = seededVoxelUnit(x, y, z, salt + 1, terrainSeed);
  const r1 = seededVoxelUnit(x, y, z, salt + 2, terrainSeed);
  const r2 = seededVoxelUnit(x, y, z, salt + 3, terrainSeed);
  const r3 = seededVoxelUnit(x, y, z, salt + 4, terrainSeed);

  _offset.copy(_up).multiplyScalar(1.0 + config.baseLift);
  _offset.addScaledVector(_wind, (r0 - 0.5) * 1.8);
  _offset.addScaledVector(_side, (r1 - 0.5) * 1.8);

  const size = config.size * (0.7 + r2 * 0.6);
  _basis.makeBasis(_wind, _up, _side);
  _yaw.makeRotationY((r3 - 0.5) * Math.PI);
  _scale.makeScale(size, size, size);
  _translate.makeTranslation(_world.x + _offset.x, _world.y + _offset.y, _world.z + _offset.z);

  target.copy(_translate);
  target.multiply(_basis);
  target.multiply(_local.copy(_yaw).multiply(_scale));
  return target;
}

export function buildSurfaceSheetInstances(
  config: SurfaceSheetConfig,
  mesh: THREE.InstancedMesh,
  density: number,
  maxDistance: number,
  playerWorld: THREE.Vector3 | null,
  _terrainSeed: number
): SurfaceEffectBuildResult {
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
    if (!isSurfaceEffectVoxel(voxel, config)) continue;
    const [x, y, z] = voxel.position;
    if (!isVoxelFaceOpen(x, y, z)) continue;

    voxelCoordToWorld(x, y, z, _world);
    if (maxDistance > 0 && playerWorld && _world.distanceToSquared(playerWorld) > maxDistSq) continue;

    voxelCount++;
    computeSurfaceSheetMatrix(x, y, z, _scratch);
    mesh.setMatrixAt(slot, _scratch);
    slot++;
  }

  mesh.count = slot;
  mesh.instanceMatrix.needsUpdate = true;
  return { count: slot, voxelCount };
}

export function buildSurfaceMoteInstances(
  config: SurfaceMoteConfig,
  mesh: THREE.InstancedMesh,
  density: number,
  maxDistance: number,
  playerWorld: THREE.Vector3 | null,
  terrainSeed: number,
  windProfile: WindProfile
): SurfaceEffectBuildResult {
  const capacity = mesh.instanceMatrix.count;
  const maxDistSq = maxDistance * maxDistance;
  const perVoxel = surfaceMotesPerVoxel(density, config);
  const coverage = surfaceMoteCoverage(density, config);
  let slot = 0;
  let voxelCount = 0;

  if (density <= 0 || perVoxel <= 0) {
    mesh.count = 0;
    mesh.instanceMatrix.needsUpdate = true;
    return { count: 0, voxelCount: 0 };
  }

  for (const voxel of voxelSystem.getAllVoxels().values()) {
    if (slot >= capacity) break;
    if (!isSurfaceEffectVoxel(voxel, config)) continue;
    const [x, y, z] = voxel.position;
    if (!isVoxelFaceOpen(x, y, z)) continue;
    if (seededVoxelUnit(x, y, z, config.salt, terrainSeed) > coverage) continue;

    voxelCoordToWorld(x, y, z, _world);
    if (maxDistance > 0 && playerWorld && _world.distanceToSquared(playerWorld) > maxDistSq) continue;

    voxelCount++;
    for (let i = 0; i < perVoxel && slot < capacity; i++) {
      computeSurfaceMoteMatrix(config, x, y, z, i, _scratch, terrainSeed, windProfile);
      mesh.setMatrixAt(slot, _scratch);
      slot++;
    }
  }

  mesh.count = slot;
  mesh.instanceMatrix.needsUpdate = true;
  return { count: slot, voxelCount };
}

// -----------------------------------------------------------------------------
// Per-frame uniform plumbing
// -----------------------------------------------------------------------------

type ShaderUniforms = { uniforms?: Record<string, { value: unknown }> };

/** Push the shared planet wind profile into any surface-effect material. */
export function applySurfaceEffectWindProfileToMaterial(profile: WindProfile, material: THREE.Material): void {
  const u = (material.userData.shader as ShaderUniforms | undefined)?.uniforms;
  if (!u) return;
  if (u.uWindStrength) (u.uWindStrength.value as number) = profile.strength;
  if (u.uWindGustStrength) (u.uWindGustStrength.value as number) = profile.gustStrength;
  if (u.uWindGustScale) (u.uWindGustScale.value as number) = profile.gustScale;
  if (u.uWindGustSpeed) (u.uWindGustSpeed.value as number) = profile.gustSpeed;
  if (u.uWindTurbulence) (u.uWindTurbulence.value as number) = profile.turbulence;
  if (u.uWindDir) (u.uWindDir.value as THREE.Vector2).copy(profile.direction);
  if (u.uWindOffset) (u.uWindOffset.value as THREE.Vector2).copy(profile.offset);
}

/**
 * Per-frame update: time (frozen when animatedShaders is off), reality-stage
 * visibility for this effect id, and the distance fade horizon.
 */
export function updateSurfaceEffectMaterial(
  material: THREE.Material,
  time: number,
  quality: GraphicsQuality,
  reality: VoxelRealityEffects
): void {
  const u = (material.userData.shader as ShaderUniforms | undefined)?.uniforms;
  if (!u) return;
  const id = material.userData.effectId as SurfaceEffectId | undefined;
  if (u.uTime && quality.animatedShaders) (u.uTime.value as number) = time;
  if (u.uVisibility) {
    (u.uVisibility.value as number) = quality.animatedShaders && id
      ? Math.min(1.35, Math.max(0, surfaceEffectVisibility(id, reality)))
      : 0;
  }
  if (u.uFadeEnd) (u.uFadeEnd.value as number) = quality.voxelEffectMaxDistance;
}
