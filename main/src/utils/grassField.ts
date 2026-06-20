import * as THREE from 'three';
import { voxelCoordToWorld } from './cubeGravityConstants';
import { deterministicTangentForUp } from './surfaceControls';
import { voxelSystem } from './efficientVoxelSystem';
import { MaterialType } from '../types/materials';
import type { GraphicsQuality } from '../config/graphicsSettings';
import { seededVoxelUnit } from './seededHash';

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

/** Total blade instances a single grass voxel needs at the given density. */
export function bladesPerVoxel(density: number): number {
  return Math.max(0, density) * BLADES_PER_CLUMP;
}

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
  worldSeed = 0
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
  const heightScale = 0.7 + r2 * 0.85; // 0.70 .. 1.55
  const widthScale = 0.8 + r3 * 0.5; // 0.80 .. 1.30
  _scale.makeScale(widthScale, heightScale, widthScale);

  // Clump center jitter (wide) + tight per-blade jitter around it, all in the
  // tangent plane; then push out to the surface along up.
  const cu = (c0 - 0.5) * 0.95; // clump center, spread across the voxel face
  const cv = (c1 - 0.5) * 0.95;
  const bu = (r2 - 0.5) * 0.22; // blade scatter within the tuft
  const bv = (r3 - 0.5) * 0.22;
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

export function isDecoratableGrassVoxel(voxel: { material: string; supportsSurfaceResources?: boolean }) {
  return voxel.material === MaterialType.GRASS && voxel.supportsSurfaceResources !== false;
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
  worldSeed = 0
): GrassBuildResult {
  const m = new THREE.Matrix4();
  let slot = 0;
  let voxelCount = 0;
  const capacity = mesh.instanceMatrix.count;
  const maxDistSq = maxDistance * maxDistance;

  const bladeCount = bladesPerVoxel(density);
  const voxels = voxelSystem.getAllVoxels();
  for (const voxel of voxels.values()) {
    if (!isDecoratableGrassVoxel(voxel)) continue;
    voxelCount++;

    const [x, y, z] = voxel.position;

    if (maxDistance > 0 && playerWorld) {
      voxelCoordToWorld(x, y, z, _world);
      if (_world.distanceToSquared(playerWorld) > maxDistSq) continue;
    }

    for (let b = 0; b < bladeCount; b++) {
      if (slot >= capacity) break;
      computeBladeMatrix(x, y, z, b, m, worldSeed);
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

const GRASS_NOISE = /* glsl */ `
  float gfHash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
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
    color: 0x6aa632,
    roughness: 0.95,
    metalness: 0.0,
    side: THREE.DoubleSide
  });

  material.onBeforeCompile = shader => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uWind = { value: 1 };
    shader.uniforms.uBaseColor = { value: GRASS_BASE.clone() };
    shader.uniforms.uTipColor = { value: GRASS_TIP.clone() };
    material.userData.shader = shader;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform float uWind;
        varying float vHeight;
        varying float vTint; // per-blade hue/brightness variation [0,1]
        ${GRASS_NOISE}`
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
        float bendAmount = h2 * 0.35 * uWind;

        // Layered wind: a slow low-frequency gust that drifts across the field
        // (uses world position, not just phase, so gusts travel) plus a faster
        // per-blade flutter. Stays bounded so it never looks seasick.
        float gust = sin(uTime * 0.6 + dot(instWorld.xz, vec2(0.03)) ) * 0.6 + 0.4; // 0..1-ish
        float sway = sin(uTime * 1.6 + phase) + 0.4 * sin(uTime * 3.4 + phase * 1.7);
        float flutter = sin(uTime * 7.0 + phase * 2.3) * 0.18; // high-freq shimmer

        // Bend in OBJECT space along local X/Z (perpendicular to the blade's +Y),
        // before the instance matrix rotates it onto the surface normal. Root
        // (uv.y~=0) stays planted because every term is weighted by h2.
        transformed.x += (sway * (0.6 + 0.7 * gust) + flutter) * bendAmount;
        transformed.z += cos(uTime * 1.3 + phase * 0.8) * bendAmount * 0.5;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uBaseColor;
        uniform vec3 uTipColor;
        varying float vHeight;
        varying float vTint;`
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        // Base (root) -> tip vertical gradient (uniforms already in linear space).
        // Bias the gradient toward the tip a touch (sqrt) so most of the blade
        // reads bright/lush, with only the very base darkened (false-earth look).
        float g = clamp(vHeight, 0.0, 1.0);
        vec3 grad = mix(uBaseColor, uTipColor, sqrt(g));

        // Per-blade hue/brightness variation: cooler & slightly darker for some
        // blades, warmer & brighter for others, breaking up uniformity.
        float tintWarm = (vTint - 0.5) * 0.18;
        grad.r *= 1.0 + tintWarm;
        grad.g *= 1.0 + tintWarm * 0.4;
        grad.b *= 1.0 - tintWarm * 0.6;
        grad *= 0.88 + vTint * 0.24; // overall brightness jitter

        // Fake subsurface/translucency: lift the tip a little so backlit blade
        // tips glow, cheap approximation without a light loop.
        grad += uTipColor * (g * g) * 0.12;

        diffuseColor.rgb *= grad;`
      );
  };

  material.customProgramCacheKey = () => 'grass-pbr-v2';
  return material;
}

/** Push time + wind gating into the grass shader (called from useFrame). */
export function updateGrassMaterial(
  material: THREE.MeshStandardMaterial,
  time: number,
  quality: GraphicsQuality
) {
  const shader = material.userData.shader as
    | { uniforms?: Record<string, { value: number }> }
    | undefined;
  if (!shader?.uniforms) return;
  const u = shader.uniforms;
  // Freeze time when animation is off so wind costs nothing and blades stand still.
  if (u.uTime && quality.animatedShaders) u.uTime.value = time;
  if (u.uWind) u.uWind.value = quality.animatedShaders ? 1 : 0;
}
