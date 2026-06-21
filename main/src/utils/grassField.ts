import * as THREE from 'three';
import { voxelCoordToWorld } from './cubeGravityConstants';
import { deterministicTangentForUp } from './surfaceControls';
import { voxelSystem } from './efficientVoxelSystem';
import { MaterialType } from '../types/materials';
import { getGraphicsQuality, type GraphicsQuality } from '../config/graphicsSettings';
import { seededVoxelUnit } from './seededHash';
import { buildGrassProfile, type GrassProfile } from './grassProfile';
import { getWorldTerrainData } from './worldGenCache';
import { createWorldArrivalPose } from './worldArrival';
import { measureWarpMetric } from './warpMetrics';
import type { TerrainVoxel } from './efficientVoxelSystem';

// A grass blade is a thin vertical plane standing on the voxel's outer surface.
// Local space: width along X, height along +Y (root at y=0, tip at y=BLADE_HEIGHT),
// flat in Z. The vertex shader tapers and bends it; CPU only places/orients it.
const BLADE_WIDTH = 0.18;
const BLADE_HEIGHT = 0.9;
// More height segments gives the per-vertex curve/bend a smoother silhouette.
const BLADE_HEIGHT_SEGMENTS = 5;

// Distance from a voxel CENTER to its outer surface in world units. The cube
// renders with boxGeometry args [1.98,1.98,1.98] at VOXEL_SCALE=2, so the face
// sits ~0.99 out along the outward normal. We sink the root a hair (0.97) so the
// base never floats above the cube face after scale variation.
const SURFACE_OFFSET = 0.97;

// Each density unit places a small CLUMP of blades (a tuft) instead of one blade,
// with positional + height + yaw variance, so the field reads as natural tufts
// rather than a uniform lawn. Total blades per voxel = density * BLADES_PER_CLUMP.
export const BLADES_PER_CLUMP = 3;

/**
 * Total blade instances a single grass voxel needs at the given density.
 * `densityMul` is the per-planet biome density multiplier (1 = global default).
 */
export function bladesPerVoxel(density: number, densityMul = 1): number {
  return Math.max(0, Math.round(density * BLADES_PER_CLUMP * densityMul));
}

// Salt for the per-voxel coverage roll (bare-ground patches on sparse biomes).
const COVERAGE_SALT = 71;

/**
 * Tapered, low-poly blade plane. Origin at the root (y=0); grows along +Y.
 * UV.y runs 0 (root) -> 1 (tip) so the shader can bend/taper/colour by height.
 * Width is pre-tapered on the CPU geometry too so the silhouette is correct
 * even without a texture; the shader does the rest.
 */
export function createBladeGeometry(): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(BLADE_WIDTH, BLADE_HEIGHT, 1, BLADE_HEIGHT_SEGMENTS);
  // PlaneGeometry is centred on the origin in XY; shift up so the root is at y=0.
  geo.translate(0, BLADE_HEIGHT / 2, 0);

  const pos = geo.attributes.position as THREE.BufferAttribute;
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const v = uv.getY(i); // 0 at root, 1 at tip
    // Quadratic taper toward the tip so the blade comes to a point.
    const taper = 1.0 - v * v * 0.85;
    pos.setX(i, pos.getX(i) * taper);
    // Bake a gentle forward curve/lean into Z (root planted, tip leans). This
    // reads as a natural blade arc; per-instance yaw rotates it to a random
    // heading so the field isn't all leaning the same way. The wind shader adds
    // motion on top of this resting pose.
    pos.setZ(i, pos.getZ(i) + v * v * (BLADE_HEIGHT * 0.18));
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

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

/**
 * Build the instance matrix for one blade and write it into `target`.
 *
 * Placement: voxel outer surface = voxelCoordToWorld + up * SURFACE_OFFSET, where
 * up = normalize(worldPos) (the planet's LOCAL outward normal — correct on all 6
 * cube faces, no global up assumed). The basis maps local +Y -> up and local +X/+Z
 * -> a deterministic tangent/bitangent, then applies a per-blade yaw around up, a
 * small tilt, a slight scale, and a jitter across the surface.
 */
export function computeBladeMatrix(
  x: number,
  y: number,
  z: number,
  bladeIndex: number,
  target: THREE.Matrix4,
  worldSeed = 0,
  heightMul = 1,
  widthMul = 1
): THREE.Matrix4 {
  voxelCoordToWorld(x, y, z, _world);

  // Local up. Voxels at the exact origin can't define one; fall back to +Y.
  if (_world.lengthSq() < 1e-6) {
    _up.set(0, 1, 0);
  } else {
    _up.copy(_world).normalize();
  }

  deterministicTangentForUp(_up, _tangent); // unit, perpendicular to up
  _bitangent.crossVectors(_up, _tangent).normalize();

  const r0 = seededVoxelUnit(x, y, z, bladeIndex, worldSeed);
  const r1 = seededVoxelUnit(x, y, z, bladeIndex + 101, worldSeed);
  const r2 = seededVoxelUnit(x, y, z, bladeIndex + 202, worldSeed);
  const r3 = seededVoxelUnit(x, y, z, bladeIndex + 303, worldSeed);
  // Per-clump seed so the few blades of one tuft share a rough location/heading
  // (bladeIndex / BLADES_PER_CLUMP), giving "tufts not lawn".
  const clump = Math.floor(bladeIndex / BLADES_PER_CLUMP);
  const c0 = seededVoxelUnit(x, y, z, clump * 7 + 11, worldSeed); // clump position u
  const c1 = seededVoxelUnit(x, y, z, clump * 7 + 23, worldSeed); // clump position v
  const c2 = seededVoxelUnit(x, y, z, clump * 7 + 37, worldSeed); // clump base heading

  // Orientation basis: columns are (tangent, up, bitangent) so local +Y -> up.
  _basis.makeBasis(_tangent, _up, _bitangent);

  // Heading: clump base + small per-blade spread, so a tuft fans out slightly.
  const yaw = c2 * Math.PI * 2.0 + (r0 - 0.5) * 1.2;
  _yaw.makeRotationY(yaw);
  // Small tilt away from vertical (lean), more varied per blade.
  _tilt.makeRotationX((r1 - 0.5) * 0.55); // +/- ~0.27 rad

  // Per-blade scale: independent height vs width so blades vary in stature and
  // slimness rather than just overall size.
  const heightScale = (0.7 + r2 * 0.85) * heightMul; // (0.70..1.55) * planet height
  const widthScale = (0.8 + r3 * 0.5) * widthMul; // (0.80..1.30) * planet width
  _scale.makeScale(widthScale, heightScale, widthScale);

  // Clump center jitter (wide) + tight per-blade jitter around it, all in the
  // tangent plane; then push out to the surface along up. The cell spans ±1
  // (VOXEL_SCALE=2); spread clumps the FULL cell + a little into neighbours
  // (±~1.05) so there are no bare cell borders — those borders are what read as a
  // regular GRID from above. Wider per-blade scatter further breaks the lattice.
  const cu = (c0 - 0.5) * 2.1; // clump center, full cell + slight neighbour overlap
  const cv = (c1 - 0.5) * 2.1;
  const bu = (r2 - 0.5) * 0.34; // blade scatter within the tuft
  const bv = (r3 - 0.5) * 0.34;
  _offset.copy(_up).multiplyScalar(SURFACE_OFFSET);
  _offset.addScaledVector(_tangent, cu + bu);
  _offset.addScaledVector(_bitangent, cv + bv);
  _translate.makeTranslation(
    _world.x + _offset.x,
    _world.y + _offset.y,
    _world.z + _offset.z
  );

  // target = translate * basis * yaw * tilt * scale
  target.copy(_translate);
  target.multiply(_basis);
  target.multiply(_scratch.copy(_yaw).multiply(_tilt).multiply(_scale));
  return target;
}

export interface GrassBuildResult {
  /** Number of blade instances written (= mesh.count). */
  count: number;
  /** Number of source grass voxels found. */
  voxelCount: number;
}

export interface GrassInstanceBuffer extends GrassBuildResult {
  matrices: Float32Array;
}

export function isDecoratableGrassVoxel(voxel: { material: string; supportsSurfaceResources?: boolean }) {
  return voxel.material === MaterialType.GRASS && voxel.supportsSurfaceResources !== false;
}

export interface GrassInstanceParams {
  density: number;
  maxDistance: number;
  playerWorld: THREE.Vector3 | null;
  worldSeed: number;
  heightMul: number;
  widthMul: number;
  densityMul: number;
  coverage: number;
}

const MAX_GRASS_INSTANCE_BUFFERS = 4;
const grassInstanceBuffers = new Map<string, GrassInstanceBuffer>();

function grassPlayerKey(playerWorld: THREE.Vector3 | null) {
  if (!playerWorld) return 'none';
  return `${playerWorld.x.toFixed(2)},${playerWorld.y.toFixed(2)},${playerWorld.z.toFixed(2)}`;
}

function grassInstanceBufferKey(params: GrassInstanceParams) {
  return [
    params.worldSeed,
    params.density,
    params.maxDistance,
    params.heightMul.toFixed(4),
    params.widthMul.toFixed(4),
    params.densityMul.toFixed(4),
    params.coverage.toFixed(4),
    grassPlayerKey(params.playerWorld)
  ].join(':');
}

function rememberGrassInstanceBuffer(key: string, buffer: GrassInstanceBuffer) {
  grassInstanceBuffers.delete(key);
  grassInstanceBuffers.set(key, buffer);

  while (grassInstanceBuffers.size > MAX_GRASS_INSTANCE_BUFFERS) {
    const oldest = grassInstanceBuffers.keys().next().value;
    if (oldest === undefined) break;
    grassInstanceBuffers.delete(oldest);
  }
}

function getRememberedGrassInstanceBuffer(key: string) {
  const existing = grassInstanceBuffers.get(key);
  if (!existing) return null;
  grassInstanceBuffers.delete(key);
  grassInstanceBuffers.set(key, existing);
  return existing;
}

function shouldSkipGrassVoxel(
  voxel: { material: string; supportsSurfaceResources?: boolean },
  x: number,
  y: number,
  z: number,
  params: GrassInstanceParams
) {
  if (!isDecoratableGrassVoxel(voxel)) return true;
  if (params.coverage < 1 && seededVoxelUnit(x, y, z, COVERAGE_SALT, params.worldSeed) > params.coverage) {
    return true;
  }

  if (params.maxDistance > 0 && params.playerWorld) {
    voxelCoordToWorld(x, y, z, _world);
    if (_world.distanceToSquared(params.playerWorld) > params.maxDistance * params.maxDistance) return true;
  }

  return false;
}

export function buildGrassInstanceBuffer(
  terrainVoxels: TerrainVoxel[],
  params: GrassInstanceParams
): GrassInstanceBuffer {
  const bladeCount = bladesPerVoxel(params.density, params.densityMul);
  let voxelCount = 0;
  for (const voxel of terrainVoxels) {
    if (isDecoratableGrassVoxel(voxel)) voxelCount++;
  }

  const maxPotentialInstances = voxelCount * bladeCount;
  const matrices = new Float32Array(maxPotentialInstances * 16);
  const m = new THREE.Matrix4();
  let slot = 0;

  for (const voxel of terrainVoxels) {
    if (!isDecoratableGrassVoxel(voxel)) continue;
    const { x, y, z } = voxel;
    if (shouldSkipGrassVoxel(voxel, x, y, z, params)) continue;

    for (let b = 0; b < bladeCount; b++) {
      computeBladeMatrix(x, y, z, b, m, params.worldSeed, params.heightMul, params.widthMul);
      m.toArray(matrices, slot * 16);
      slot++;
    }
  }

  return {
    count: slot,
    voxelCount,
    matrices: matrices.slice(0, slot * 16)
  };
}

export function applyGrassInstanceBuffer(
  mesh: THREE.InstancedMesh,
  buffer: GrassInstanceBuffer
): GrassBuildResult {
  const count = Math.min(buffer.count, mesh.instanceMatrix.count);
  mesh.instanceMatrix.array.set(buffer.matrices.subarray(0, count * 16), 0);
  mesh.count = count;
  mesh.instanceMatrix.needsUpdate = true;
  return { count, voxelCount: buffer.voxelCount };
}

export function getPrewarmedGrassInstanceBuffer(
  terrainSeed: number,
  density: number,
  maxDistance: number,
  playerWorld: THREE.Vector3 | null,
  profile: GrassProfile
): GrassInstanceBuffer | null {
  return getRememberedGrassInstanceBuffer(grassInstanceBufferKey({
    density,
    maxDistance,
    playerWorld,
    worldSeed: terrainSeed,
    heightMul: profile.heightMul,
    widthMul: profile.widthMul,
    densityMul: profile.densityMul,
    coverage: profile.coverage
  }));
}

export function prewarmGrassInstancesForWorld(
  planetSize: number,
  terrainSeed: number,
  playerWorld: THREE.Vector3
): GrassInstanceBuffer | null {
  const quality = getGraphicsQuality();
  if (quality.grassDensity <= 0) return null;

  const profile = buildGrassProfile(terrainSeed);
  const params: GrassInstanceParams = {
    density: quality.grassDensity,
    maxDistance: quality.grassMaxDistance,
    playerWorld,
    worldSeed: terrainSeed,
    heightMul: profile.heightMul,
    widthMul: profile.widthMul,
    densityMul: profile.densityMul,
    coverage: profile.coverage
  };
  const key = grassInstanceBufferKey(params);
  const existing = getRememberedGrassInstanceBuffer(key);
  if (existing) {
    rememberGrassInstanceBuffer(key, existing);
    return existing;
  }

  const buffer = measureWarpMetric(
    'grass:prewarm_instances',
    () => buildGrassInstanceBuffer(getWorldTerrainData(planetSize, terrainSeed).initialVoxels, params),
    result => ({ count: result.count, voxelCount: result.voxelCount })
  );
  rememberGrassInstanceBuffer(key, buffer);
  return buffer;
}

const scheduledGrassPrewarms = new Set<string>();

export function scheduleGrassInstancePrewarm(planetSize: number, terrainSeed: number): void {
  if (typeof window === 'undefined') return;

  const quality = getGraphicsQuality();
  if (quality.grassDensity <= 0) return;

  const profile = buildGrassProfile(terrainSeed);
  const key = [
    'approach',
    planetSize,
    terrainSeed,
    quality.grassDensity,
    quality.grassMaxDistance,
    profile.heightMul.toFixed(4),
    profile.widthMul.toFixed(4),
    profile.densityMul.toFixed(4),
    profile.coverage.toFixed(4)
  ].join(':');
  if (scheduledGrassPrewarms.has(key)) return;
  scheduledGrassPrewarms.add(key);

  const run = () => {
    scheduledGrassPrewarms.delete(key);
    const arrivalPose = createWorldArrivalPose(planetSize, terrainSeed);
    prewarmGrassInstancesForWorld(planetSize, terrainSeed, arrivalPose.approachPosition);
  };

  const scheduler = window as unknown as {
    requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
  };
  if (scheduler.requestIdleCallback) {
    scheduler.requestIdleCallback(run, { timeout: 100 });
  } else {
    window.setTimeout(run, 100);
  }
}

/**
 * Fill `mesh` with blade instances for every grass voxel currently exposed.
 * Each voxel gets `bladesPerVoxel(density)` blades (density tufts of
 * BLADES_PER_CLUMP each). Returns the instance count actually written.
 * Far-from-player culling: blades whose voxel center is beyond `maxDistance`
 * from `playerWorld` are skipped (when maxDistance > 0 and playerWorld given).
 */
export function buildGrassInstances(
  mesh: THREE.InstancedMesh,
  density: number,
  maxDistance = 0,
  playerWorld: THREE.Vector3 | null = null,
  worldSeed = 0,
  heightMul = 1,
  widthMul = 1,
  densityMul = 1,
  coverage = 1
): GrassBuildResult {
  const m = new THREE.Matrix4();
  let slot = 0;
  let voxelCount = 0;
  const capacity = mesh.instanceMatrix.count;
  const maxDistSq = maxDistance * maxDistance;

  const bladeCount = bladesPerVoxel(density, densityMul);
  const voxels = voxelSystem.getAllVoxels();
  for (const voxel of voxels.values()) {
    if (!isDecoratableGrassVoxel(voxel)) continue;
    voxelCount++;

    const [x, y, z] = voxel.position;

    // Bare-ground patches: on sparse/arid biomes only a fraction of voxels grow
    // grass, so the planet shows soil between tufts instead of a full carpet.
    if (coverage < 1 && seededVoxelUnit(x, y, z, COVERAGE_SALT, worldSeed) > coverage) {
      continue;
    }

    if (maxDistance > 0 && playerWorld) {
      voxelCoordToWorld(x, y, z, _world);
      if (_world.distanceToSquared(playerWorld) > maxDistSq) continue;
    }

    for (let b = 0; b < bladeCount; b++) {
      if (slot >= capacity) break;
      computeBladeMatrix(x, y, z, b, m, worldSeed, heightMul, widthMul);
      mesh.setMatrixAt(slot, m);
      slot++;
    }
    if (slot >= capacity) break;
  }

  mesh.count = slot;
  mesh.instanceMatrix.needsUpdate = true;
  return { count: slot, voxelCount };
}

/** Count exposed grass voxels (cheap signature for change detection). */
export function countGrassVoxels(): number {
  let n = 0;
  const voxels = voxelSystem.getAllVoxels();
  for (const voxel of voxels.values()) {
    if (isDecoratableGrassVoxel(voxel)) n++;
  }
  return n;
}

// Colours authored in sRGB then linearized, since they multiply the linear-space
// diffuse inside <map_fragment>.
const GRASS_BASE = new THREE.Color(0x4a7a24).convertSRGBToLinear(); // darker root
const GRASS_TIP = new THREE.Color(0x9bd64a).convertSRGBToLinear(); // brighter tip
// Fallbacks (overridden per-planet from the GrassProfile).
const GRASS_DRY = new THREE.Color(0xb8a24c).convertSRGBToLinear(); // straw/gold
const GRASS_SSS = new THREE.Color(0xc7ef7a).convertSRGBToLinear(); // backlit glow

const GRASS_NOISE = /* glsl */ `
  float gfHash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  // smooth value noise for large-scale dryness / lushness patches.
  float gfNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = gfHash21(i);
    float b = gfHash21(i + vec2(1.0, 0.0));
    float c = gfHash21(i + vec2(0.0, 1.0));
    float d = gfHash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
`;

/**
 * Grass MeshStandardMaterial. We keep Three's full PBR/lighting/fog pipeline and
 * only inject wind (vertex) + a base->tip colour gradient (fragment) through
 * onBeforeCompile, mirroring voxelMaterial.ts. Wind is entirely in the vertex
 * shader (zero per-frame JS per blade); root (uv.y~=0) stays planted.
 *
 * Alpha: the blade is a solid tapered plane with NO alphaTest, so there is no
 * depth-sort/transparency cost. side = DoubleSide so blades show from any angle.
 */
export function createGrassMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    // WHITE base: the per-planet grad (uBaseColor/uTipColor) is the SOLE albedo,
    // multiplied into diffuseColor in <map_fragment>. A non-white base here tints
    // every planet toward that hue — a green base was washing alien (teal/violet)
    // biomes back to green, which is why per-planet colours weren't visible.
    color: 0xffffff,
    roughness: 0.9,
    metalness: 0.0,
    side: THREE.DoubleSide
  });

  material.onBeforeCompile = shader => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uWind = { value: 1 };
    shader.uniforms.uBaseColor = { value: GRASS_BASE.clone() };
    shader.uniforms.uTipColor = { value: GRASS_TIP.clone() };
    shader.uniforms.uDryColor = { value: GRASS_DRY.clone() };
    shader.uniforms.uSSSColor = { value: GRASS_SSS.clone() };
    shader.uniforms.uDryness = { value: 0.2 };
    shader.uniforms.uSunDir = { value: new THREE.Vector3(0, 1, 0) };
    shader.uniforms.uWindDir = { value: new THREE.Vector2(1, 0) };
    shader.uniforms.uWindStrength = { value: 1 };
    shader.uniforms.uRound = { value: 0.85 };
    material.userData.shader = shader;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform float uWind;
        uniform float uWindStrength;
        uniform float uRound;
        uniform vec2 uWindDir;
        varying float vHeight;
        varying float vTint;      // per-blade hue/brightness variation [0,1]
        varying vec3 vGrassWPos;  // world position (dryness patches + view dir)
        varying vec3 vGrassWNrm;  // world-space rounded normal (SSS + sheen)
        ${GRASS_NOISE}`
      )
      // ROUNDED BLADE NORMAL: a flat plane has one dull flat normal. Tilt the
      // normal across the blade width (uv.x) so each blade lights like a curved
      // surface — the single biggest cheap lushness win (the false-earth look).
      .replace(
        '#include <beginnormal_vertex>',
        `vec3 objectNormal = normalize(vec3((uv.x - 0.5) * 2.0 * uRound, 0.18, 1.0));`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vHeight = uv.y;

        // Per-instance world position (instanceMatrix col 3) keys the wind phase
        // so neighbouring blades sway out of step, and seeds a per-blade tint.
        vec3 instWorld = instanceMatrix[3].xyz;
        float phase = dot(instWorld, vec3(0.21, 0.17, 0.13));
        vTint = gfHash21(instWorld.xz + instWorld.y);

        // Tip moves most, root planted: pow(uv.y, 2) weighting on all motion.
        float h2 = uv.y * uv.y;
        float bendAmount = h2 * 0.35 * uWind * uWindStrength;

        // Layered wind: a slow low-frequency gust that drifts across the field
        // (uses world position, not just phase, so gusts travel) plus a faster
        // per-blade flutter. Stays bounded so it never looks seasick.
        float gust = sin(uTime * 0.6 + dot(instWorld.xz, vec2(0.03)) ) * 0.6 + 0.4; // 0..1-ish
        float sway = sin(uTime * 1.6 + phase) + 0.4 * sin(uTime * 3.4 + phase * 1.7);
        float flutter = sin(uTime * 7.0 + phase * 2.3) * 0.18; // high-freq shimmer

        // Bend along the PLANET wind direction (object XZ, perpendicular to the
        // blade's +Y) so the whole field leans/gusts as one coherent wind, plus a
        // small perpendicular cross-breeze. Root (uv.y~=0) stays planted (h2).
        vec2 wdir = normalize(uWindDir + vec2(1e-4, 0.0));
        float drive = sway * (0.6 + 0.7 * gust) + flutter;
        float cross = cos(uTime * 1.3 + phase * 0.8) * 0.25;
        transformed.x += (wdir.x * drive - wdir.y * cross) * bendAmount;
        transformed.z += (wdir.y * drive + wdir.x * cross) * bendAmount;

        vGrassWPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        vGrassWNrm = normalize((modelMatrix * instanceMatrix * vec4(objectNormal, 0.0)).xyz);`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uBaseColor;
        uniform vec3 uTipColor;
        uniform vec3 uDryColor;
        uniform vec3 uSSSColor;
        uniform float uDryness;
        uniform vec3 uSunDir;
        varying float vHeight;
        varying float vTint;
        varying vec3 vGrassWPos;
        varying vec3 vGrassWNrm;
        ${GRASS_NOISE}`
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        // Base (root) -> tip vertical gradient (uniforms already in linear space).
        // sqrt bias keeps most of the blade bright/lush, only the base darkened.
        float g = clamp(vHeight, 0.0, 1.0);
        vec3 grad = mix(uBaseColor, uTipColor, sqrt(g));

        // Per-blade hue/brightness variation breaks up uniformity.
        float tintWarm = (vTint - 0.5) * 0.18;
        grad.r *= 1.0 + tintWarm;
        grad.g *= 1.0 + tintWarm * 0.4;
        grad.b *= 1.0 - tintWarm * 0.6;
        grad *= 0.88 + vTint * 0.24;

        // Large-scale dryness PATCHES: sun-bleached straw drifts across the field
        // (tips dry first), so the meadow isn't a uniform carpet. Per-planet
        // dryness amount from the grass profile.
        float dryPatch = gfNoise(vGrassWPos.xz * 0.06);
        float dry = smoothstep(0.42, 0.86, dryPatch) * uDryness;
        grad = mix(grad, uDryColor, dry * (0.35 + 0.65 * g));

        // Base ambient occlusion: blades pack near the ground -> less light there.
        grad *= mix(0.55, 1.0, smoothstep(0.0, 0.45, vHeight));

        diffuseColor.rgb *= grad;`
      )
      // Sun-directional translucency + sheen, added emissively (cheap, no light
      // loop). Backlit tips glow toward the sun; a tight sheen rim adds the lush
      // highlight. World-space normal/view keep it consistent with uSunDir.
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          vec3 V = normalize(cameraPosition - vGrassWPos);
          vec3 N = normalize(vGrassWNrm);
          float daylight = smoothstep(-0.1, 0.25, uSunDir.y);
          float tipw = vHeight * vHeight; // tips translucent, base opaque
          float backlit = pow(clamp(dot(V, -uSunDir), 0.0, 1.0), 3.0);
          float trans = clamp((abs(dot(N, uSunDir)) + 0.4) / 1.4, 0.0, 1.0);
          totalEmissiveRadiance += uSSSColor * backlit * trans * daylight * tipw * 0.5;
          float sheen = pow(clamp(dot(N, normalize(uSunDir + V)), 0.0, 1.0), 8.0);
          totalEmissiveRadiance += uSSSColor * sheen * daylight * tipw * 0.15;
        }`
      );
  };

  material.customProgramCacheKey = () => 'grass-pbr-v3';
  return material;
}

const _gsun = new THREE.Vector3();

/**
 * Push per-planet COLOURS + biome params from the grass profile into the material
 * (call once the shader has compiled). Colours are uniforms, so the program stays
 * shared across planets.
 */
export function applyGrassProfileToMaterial(
  profile: GrassProfile,
  material: THREE.MeshStandardMaterial
): void {
  const u = (material.userData.shader as
    | { uniforms?: Record<string, { value: unknown }> }
    | undefined)?.uniforms;
  if (!u) return;
  if (u.uBaseColor) u.uBaseColor.value = profile.baseColor;
  if (u.uTipColor) u.uTipColor.value = profile.tipColor;
  if (u.uDryColor) u.uDryColor.value = profile.dryColor;
  if (u.uSSSColor) u.uSSSColor.value = profile.sssColor;
  if (u.uDryness) (u.uDryness.value as number) = profile.dryness;
  if (u.uWindStrength) (u.uWindStrength.value as number) = profile.windStrength;
  if (u.uRound) (u.uRound.value as number) = profile.roundness;
  if (u.uWindDir) (u.uWindDir.value as THREE.Vector2).copy(profile.windDir);
}

/** Push time + wind gating + sun direction into the grass shader (per frame). */
export function updateGrassMaterial(
  material: THREE.MeshStandardMaterial,
  time: number,
  quality: GraphicsQuality,
  sunDir?: THREE.Vector3
) {
  const shader = material.userData.shader as
    | { uniforms?: Record<string, { value: unknown }> }
    | undefined;
  if (!shader?.uniforms) return;
  const u = shader.uniforms;
  // Freeze time when animation is off so wind costs nothing and blades stand still.
  if (u.uTime && quality.animatedShaders) (u.uTime.value as number) = time;
  if (u.uWind) (u.uWind.value as number) = quality.animatedShaders ? 1 : 0;
  if (sunDir && u.uSunDir) {
    _gsun.copy(sunDir).normalize();
    (u.uSunDir.value as THREE.Vector3).copy(_gsun);
  }
}
