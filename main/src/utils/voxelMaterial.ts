import * as THREE from 'three';
import { MATERIAL_ORDER, MATERIALS, MaterialType } from '../types/materials';
import { GraphicsQuality } from '../config/graphicsSettings';
import {
  getVoxelRealityEffects,
  type VoxelRealityEffects
} from '../game/systems/realityRenderSystem';
import type { TerrainProfile } from './terrainProfile';
import type { WindProfile } from './windProfile';

// Builds the shared voxel MeshStandardMaterial. We keep Three's full PBR /
// IBL / lighting pipeline and only INJECT inputs via onBeforeCompile:
//   - per-instance material id (aInstanceData.x) selects roughness / metalness
//     / emissive from compile-time LUTs (honors materials.ts).
//   - aInstanceData.y is a 6-bit face-occupancy mask -> per-corner baked AO.
//   - triplanar procedural value-noise adds surface variation.
// Effects are toggled by uniforms (uTriplanar / uAO / uAnimated) so a single
// compiled program serves every quality profile.

const N = MATERIAL_ORDER.length;

export const VOXEL_SHADER_DETAIL_MATERIALS = new Set<MaterialType>([
  MaterialType.STONE,
  MaterialType.DIRT,
  MaterialType.WOOD,
  MaterialType.LAVA,
  MaterialType.GRASS,
  MaterialType.COPPER,
  MaterialType.GOLD,
  MaterialType.SILVER,
  MaterialType.SAND,
  MaterialType.BASALT,
  MaterialType.ICE,
  MaterialType.CRYSTAL
]);

export function hasVoxelShaderDetail(material: MaterialType): boolean {
  return VOXEL_SHADER_DETAIL_MATERIALS.has(material);
}

function glslFloatArray(name: string, values: number[]): string {
  const body = values.map(v => v.toFixed(4)).join(', ');
  return `const float ${name}[${N}] = float[${N}](${body});`;
}

function glslVec3Array(name: string, values: THREE.Color[]): string {
  const body = values
    .map(c => `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`)
    .join(', ');
  return `const vec3 ${name}[${N}] = vec3[${N}](${body});`;
}

function buildLUTs() {
  const rough: number[] = [];
  const metal: number[] = [];
  const emissive: THREE.Color[] = [];

  for (const mat of MATERIAL_ORDER) {
    const m = MATERIALS[mat];
    rough.push(m.roughness ?? 0.95);
    metal.push(m.metalness ?? 0.02);
    // Emissive constants are baked into GLSL (LINEAR space), so linearize the
    // sRGB material color and pre-multiply by intensity.
    const e = (m.emissive ? m.emissive.clone() : new THREE.Color(0, 0, 0)).convertSRGBToLinear();
    e.multiplyScalar(m.emissiveIntensity ?? 0);
    emissive.push(e);
  }

  return {
    rough: glslFloatArray('VOXEL_ROUGH', rough),
    metal: glslFloatArray('VOXEL_METAL', metal),
    emissive: glslVec3Array('VOXEL_EMISSIVE', emissive),
    lavaId: MATERIAL_ORDER.indexOf(MaterialType.LAVA),
    materialIds: buildMaterialIdGLSL(),
    palette: buildPaletteGLSL()
  };
}

function buildMaterialIdGLSL(): string {
  return [
    `const int MAT_STONE = ${MATERIAL_ORDER.indexOf(MaterialType.STONE)};`,
    `const int MAT_DIRT = ${MATERIAL_ORDER.indexOf(MaterialType.DIRT)};`,
    `const int MAT_WOOD = ${MATERIAL_ORDER.indexOf(MaterialType.WOOD)};`,
    `const int MAT_GRASS = ${MATERIAL_ORDER.indexOf(MaterialType.GRASS)};`,
    `const int MAT_LAVA = ${MATERIAL_ORDER.indexOf(MaterialType.LAVA)};`,
    `const int MAT_SAND = ${MATERIAL_ORDER.indexOf(MaterialType.SAND)};`,
    `const int MAT_BASALT = ${MATERIAL_ORDER.indexOf(MaterialType.BASALT)};`,
    `const int MAT_ICE = ${MATERIAL_ORDER.indexOf(MaterialType.ICE)};`,
    `const int MAT_CRYSTAL = ${MATERIAL_ORDER.indexOf(MaterialType.CRYSTAL)};`,
    `const int MAT_COPPER = ${MATERIAL_ORDER.indexOf(MaterialType.COPPER)};`,
    `const int MAT_GOLD = ${MATERIAL_ORDER.indexOf(MaterialType.GOLD)};`,
    `const int MAT_SILVER = ${MATERIAL_ORDER.indexOf(MaterialType.SILVER)};`
  ].join('\n        ');
}

// Stylized art-direction palette, authored in sRGB then linearized for the
// shader (pipeline is linear + ACES). These are TINTS the detail math nudges
// the instanceColor toward — they are NOT a hard replacement, so the
// per-instance instanceColor variation is preserved. Chosen to sit cohesively
// with the grass blades (0x4a7a24 -> 0x9bd64a) and water shallow (0x2bb6c8).
function lin(hex: number): string {
  const c = new THREE.Color(hex).convertSRGBToLinear();
  return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`;
}

function buildPaletteGLSL(): string {
  return [
    // DIRT: warm earthy browns. Crevice (dark, damp) -> base -> high clod (sun).
    `const vec3 DIRT_DARK   = ${lin(0x4a2f17)};`,
    `const vec3 DIRT_BASE   = ${lin(0x7a4a22)};`,
    `const vec3 DIRT_LIGHT  = ${lin(0xa6743a)};`,
    `const vec3 DIRT_PEBBLE = ${lin(0xc9a878)};`,
    `const vec3 DIRT_THREAD = ${lin(0x744020)};`,
    // STONE: cool greys, darker cracks, faint mineral fleck.
    `const vec3 STONE_DARK  = ${lin(0x55595c)};`,
    `const vec3 STONE_BASE  = ${lin(0x858c90)};`,
    `const vec3 STONE_LIGHT = ${lin(0xa9b0b3)};`,
    `const vec3 STONE_FLECK = ${lin(0xcfd6d2)};`,
    // SAND: warm tan keyed slightly toward the shallow-water tint.
    `const vec3 SAND_DARK   = ${lin(0xa89564)};`,
    `const vec3 SAND_BASE   = ${lin(0xcab98a)};`,
    `const vec3 SAND_LIGHT  = ${lin(0xe6d9ad)};`,
    `const vec3 SAND_DUST   = ${lin(0xf1e5bd)};`,
    // GRASS block: harmonize with grass blades (base 0x4a7a24 -> tip 0x9bd64a).
    `const vec3 MOSS_DARK   = ${lin(0x3f6a20)};`,
    `const vec3 MOSS_BASE   = ${lin(0x5f9a2e)};`,
    `const vec3 MOSS_LIGHT  = ${lin(0x83c043)};`,
    // WOOD: bark grain with warmer inner ridges.
    `const vec3 WOOD_DARK   = ${lin(0x442713)};`,
    `const vec3 WOOD_BASE   = ${lin(0x7a4822)};`,
    `const vec3 WOOD_LIGHT  = ${lin(0xb8793e)};`,
    `const vec3 WOOD_RING   = ${lin(0xd0a15c)};`,
    // LAVA: boiling core through dark cooling scum.
    `const vec3 LAVA_DEEP   = ${lin(0x6b1308)};`,
    `const vec3 LAVA_ORANGE = ${lin(0xff5a1e)};`,
    `const vec3 LAVA_HOT    = ${lin(0xfff1a8)};`,
    `const vec3 LAVA_SCUM   = ${lin(0x211816)};`,
    // ORE vein fleck (bright mineral catch-light).
    `const vec3 ORE_VEIN    = ${lin(0xd8ddd0)};`,
    // BASALT: cool black volcanic stone with sparse warm mineral glow.
    `const vec3 BASALT_DARK  = ${lin(0x15151a)};`,
    `const vec3 BASALT_BASE  = ${lin(0x2c2a30)};`,
    `const vec3 BASALT_EDGE  = ${lin(0x4a454b)};`,
    `const vec3 BASALT_WARM  = ${lin(0xff6a25)};`,
    // ICE: blue-white translucent facets.
    `const vec3 ICE_DEEP     = ${lin(0x78aeca)};`,
    `const vec3 ICE_BASE     = ${lin(0xcfe6f5)};`,
    `const vec3 ICE_WHITE    = ${lin(0xf4fbff)};`,
    `const vec3 ICE_GLOW     = ${lin(0x9ee8ff)};`,
    // CRYSTAL: cyan facets with violet shadow and bright ridge highlights.
    `const vec3 CRYSTAL_DARK = ${lin(0x176a91)};`,
    `const vec3 CRYSTAL_BASE = ${lin(0x6fe0ff)};`,
    `const vec3 CRYSTAL_HI   = ${lin(0xc8fbff)};`,
    `const vec3 CRYSTAL_VIO  = ${lin(0x7a69ff)};`
  ].join('\n        ');
}

// ---------------------------------------------------------------------------
// HD surface library (voxel-pbr-v2).
//
// Goal: turn the flat per-face slabs into stylized (Sea-of-Thieves-ish) soil /
// rock / sand / moss. Two ingredients drive everything:
//   1. vmHeight(p, mid) -> a per-material triplanar HEIGHT FIELD in world space.
//      Its GRADIENT (finite differences) tilts the shading normal in
//      <normal_fragment_begin> for real lit relief (the #1 HD cue).
//   2. vmSurface(...) -> a per-material COLOR/TONAL detail in <map_fragment>
//      that multiplies the existing instanceColor diffuse (clods, pebbles,
//      cracks, grain, moss, veins) plus a low-freq macro tint.
//
// All high-frequency detail is faded with distance (vWorldPos vs cameraPosition)
// so far voxels do not shimmer/alias, and the whole thing is gated by uTriplanar
// so MEDIUM / LOW / POTATO stay cheap (they fall back to a flat slab).
//
// NOTE: no backticks inside this GLSL string. normal-dependent code lives in
// <normal_fragment_begin>, never in <map_fragment>.
// ---------------------------------------------------------------------------
const NOISE_GLSL = /* glsl */ `
  float vmHash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float vmNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = vmHash21(i);
    float b = vmHash21(i + vec2(1.0, 0.0));
    float c = vmHash21(i + vec2(0.0, 1.0));
    float d = vmHash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  float vmFbm(vec2 p) {
    return 0.6 * vmNoise(p) + 0.4 * vmNoise(p * 2.03 + 7.1);
  }
  // 3-octave fbm for richer multi-scale clumping.
  float vmFbm3(vec2 p) {
    float a = 0.5  * vmNoise(p);
    float b = 0.25 * vmNoise(p * 2.07 + 11.3);
    float c = 0.125 * vmNoise(p * 4.13 + 27.7);
    return (a + b + c) / 0.875;
  }
  // Sparse speckle: returns ~1 in a few small cells, 0 elsewhere (pebbles /
  // mineral fleck). thresh near 1 -> rarer. Cheap single hash per cell.
  float vmSpeckle(vec2 p, float thresh) {
    vec2 c = floor(p);
    float h = vmHash21(c + 3.7);
    float s = smoothstep(thresh, thresh + 0.06, h);
    // soften within the cell so a speckle reads as a rounded grain, not a square.
    vec2 f = fract(p) - 0.5;
    float d = 1.0 - smoothstep(0.18, 0.40, length(f));
    return s * d;
  }
  // Ridged noise (stone cracks / striations): sharp valleys.
  float vmRidge(vec2 p) {
    float n = vmFbm(p);
    return 1.0 - abs(2.0 * n - 1.0);
  }

  // Triplanar weights from a world normal (sharpened so faces read crisply).
  vec3 vmTriW(vec3 n) {
    vec3 w = abs(n);
    w = pow(w, vec3(3.0));
    return w / (w.x + w.y + w.z + 1e-5);
  }

  // Triplanar-blended scalar fbm sampler (3-octave) at a given frequency.
  float vmTriFbm(vec3 p, vec3 w, float freq) {
    return vmFbm3(p.yz * freq) * w.x
         + vmFbm3(p.xz * freq) * w.y
         + vmFbm3(p.xy * freq) * w.z;
  }
  float vmTriFbm2(vec3 p, vec3 w, float freq) {
    return vmFbm(p.yz * freq) * w.x
         + vmFbm(p.xz * freq) * w.y
         + vmFbm(p.xy * freq) * w.z;
  }
  float vmTriRidge(vec3 p, vec3 w, float freq) {
    return vmRidge(p.yz * freq) * w.x
         + vmRidge(p.xz * freq) * w.y
         + vmRidge(p.xy * freq) * w.z;
  }
  float vmTriSpeckle(vec3 p, vec3 w, float freq, float thresh) {
    return vmSpeckle(p.yz * freq, thresh) * w.x
         + vmSpeckle(p.xz * freq, thresh) * w.y
         + vmSpeckle(p.xy * freq, thresh) * w.z;
  }
  vec2 vmWindBasis(vec3 p) {
    vec2 dir = normalize(uWindDir + vec2(0.0001, 0.0));
    vec2 side = vec2(-dir.y, dir.x);
    vec2 xz = p.xz + uWindOffset;
    float t = uTime * uAnimated * uWindGustSpeed * (0.65 + uWindStrength * 0.18);
    return vec2(dot(xz, dir), dot(xz, side)) * max(uWindGustScale, 0.001)
      + vec2(t, sin(t * 0.43) * 0.18);
  }
  float vmWindGust(vec3 p, float scaleMul) {
    vec2 uv = vmWindBasis(p) * scaleMul;
    float broad = vmFbm3(uv);
    float strand = sin(uv.x * 8.0 + broad * 5.0 + uTime * uAnimated * 0.4) * 0.5 + 0.5;
    return broad * 0.68 + strand * 0.32;
  }

  // Per-material triplanar HEIGHT field used ONLY for the bump gradient. Each
  // branch's silhouette matches the material's color detail in vmSurface below.
  // Returns roughly 0..1. mid follows MATERIAL_ORDER through MAT_* constants.
  float vmHeight(vec3 p, vec3 w, int mid) {
    if (mid == MAT_DIRT) {
      // DIRT: big clumpy clods + small pebble bumps.
      float clods = vmTriFbm(p, w, 0.9);
      float pebbles = vmTriSpeckle(p, w, 3.2, 0.86);
      return clods * 0.85 + pebbles * 0.5;
    } else if (mid == MAT_STONE) {
      // STONE: cracked / striated ridges.
      float crack = vmTriRidge(p, w, 1.1);
      float layer = vmTriFbm2(p, w, 0.35);
      return crack * 0.7 + layer * 0.4;
    } else if (mid == MAT_SAND) {
      // SAND: fine grain + slow large ripples.
      float ripple = sin(p.x * 1.6 + p.z * 1.1 + vmTriFbm2(p, w, 0.5) * 3.0) * 0.5 + 0.5;
      float grain = vmTriFbm(p, w, 5.0);
      return ripple * 0.5 + grain * 0.45;
    } else if (mid == MAT_GRASS) {
      // GRASS block: soft mossy lumps.
      return vmTriFbm(p, w, 1.3) * 0.7;
    } else if (mid == MAT_WOOD) {
      // WOOD: vertical bark grain with broader knot ridges.
      float grain = vmTriRidge(p + vec3(0.0, p.y * 0.18, 0.0), w, 1.65);
      float knot = vmTriFbm2(p + vec3(3.1, 0.0, -1.7), w, 0.7);
      return grain * 0.55 + knot * 0.38;
    } else if (mid == MAT_LAVA) {
      // LAVA: slow boiling blisters; thermal stage decides whether it moves.
      float thermal = max(uRealityThermal, 0.0);
      float t = uTime * uAnimated * thermal * 0.22;
      vec3 q = p + vec3(t * 1.3, sin(t * 0.7) * 0.25, -t * 0.65);
      float boil = vmTriFbm(q, w, 1.3);
      float cells = vmTriRidge(q, w, 2.45);
      return (boil * 0.58 + cells * 0.48) * max(thermal, 0.25);
    } else if (mid == MAT_BASALT) {
      // BASALT: fractured plates with subtle horizontal strata.
      float plates = vmTriRidge(p, w, 1.45);
      float strata = sin((p.y + p.x * 0.2 + p.z * 0.13) * 2.1) * 0.5 + 0.5;
      return plates * 0.85 + strata * 0.28;
    } else if (mid == MAT_ICE) {
      // ICE: smoother broad facets with shallow internal cracks.
      float facets = vmTriRidge(p, w, 0.95);
      float frost = vmTriFbm(p, w, 2.4);
      return facets * 0.48 + frost * 0.22;
    } else if (mid == MAT_CRYSTAL) {
      // CRYSTAL: hard angular ridges and glinting micro facets.
      float ridge = vmTriRidge(p, w, 2.0);
      float facet = vmTriFbm2(p, w, 0.7);
      return ridge * 0.9 + facet * 0.35;
    } else if (mid == MAT_COPPER || mid == MAT_GOLD || mid == MAT_SILVER) {
      // ORES: embedded vein ridges under the metallic BRDF.
      float vein = vmTriRidge(p, w, 1.35);
      float chip = vmTriSpeckle(p, w, 3.3, 0.86);
      return vein * 0.46 + chip * 0.38;
    }
    // Fallback: gentle generic relief.
    return vmTriFbm2(p, w, 0.9) * 0.5;
  }
`;

// Per-material COLOR/TONAL detail. Multiplies (tints) the existing diffuse so
// instanceColor + AO survive. fade in 0..1 band-limits high-freq detail with
// distance (1 close, 0 far) to kill shimmer. up = how top-facing the surface is
// (planet-relative, used for grass-block tops). Needs the palette consts above.
const SURFACE_GLSL = /* glsl */ `
  vec3 vmSurface(
    vec3 baseRGB,
    vec3 p,
    vec3 w,
    int mid,
    float fade,
    float up,
    float detailFx,
    float organicFx,
    float atmosphereFx,
    float thermalFx,
    float crystallineFx,
    float metalFx
  ) {
    vec3 col = baseRGB;

    float baseLuma = dot(baseRGB, vec3(0.299, 0.587, 0.114));
    float macro = vmTriFbm2(p, w, 0.06);
    float macroMul = mix(1.0, mix(0.90, 1.12, macro), detailFx);
    col *= macroMul;

    if (mid == MAT_DIRT) {
      float dirtFx = max(detailFx, atmosphereFx * 0.35);
      float clods = vmTriFbm(p, w, 0.9);
      float crev = vmTriFbm2(p, w, 1.7);
      float pebble = vmTriSpeckle(p, w, 3.2, 0.86) * fade;
      float topSoil = smoothstep(0.18, 0.88, up);
      float dryWisp = smoothstep(0.54, 0.88, vmWindGust(p, 0.85)) * atmosphereFx * fade * topSoil;
      float threadField = vmTriFbm2(p + vec3(12.7, 0.0, -4.9), w, 0.78);
      float threadCoord = p.x * 1.7 + p.z * 0.9 + threadField * 2.6 + uTime * uAnimated * organicFx * 0.045;
      float threadLine = 1.0 - smoothstep(0.028, 0.13, abs(fract(threadCoord) - 0.5));
      float threadPatch = smoothstep(0.58, 0.86, vmTriFbm2(p + vec3(-2.0, 5.0, 9.0), w, 1.05));
      float livingThread = threadLine * threadPatch * organicFx * fade * topSoil;
      vec3 dirt = mix(DIRT_DARK, DIRT_BASE, smoothstep(0.25, 0.6, clods));
      dirt = mix(dirt, DIRT_LIGHT, smoothstep(0.56, 0.95, clods) * 0.95);
      dirt *= mix(0.78, 1.07, smoothstep(0.18, 0.74, crev));
      dirt = mix(dirt, DIRT_PEBBLE, pebble * 0.82 + dryWisp * 0.30);
      dirt = mix(dirt, DIRT_THREAD, livingThread * 0.24);
      float dRef = dot(DIRT_BASE, vec3(0.299, 0.587, 0.114));
      dirt *= clamp(baseLuma / max(dRef, 1e-3), 0.75, 1.3) * macroMul;
      col = mix(col, dirt, 0.92 * dirtFx);

    } else if (mid == MAT_STONE) {
      float crack = vmTriRidge(p, w, 1.1);
      float fleck = vmTriSpeckle(p, w, 4.5, 0.90) * fade;
      vec3 stone = mix(STONE_BASE, STONE_LIGHT, smoothstep(0.5, 0.95, crack));
      stone = mix(STONE_DARK, stone, smoothstep(0.12, 0.45, crack));
      stone = mix(stone, STONE_FLECK, fleck * 0.5);
      float sRef = dot(STONE_BASE, vec3(0.299, 0.587, 0.114));
      stone *= clamp(baseLuma / max(sRef, 1e-3), 0.8, 1.25) * macroMul;
      col = mix(col, stone, 0.9 * detailFx);

    } else if (mid == MAT_BASALT) {
      float basaltFx = max(detailFx, max(thermalFx * 0.45, atmosphereFx * 0.28));
      float plates = vmTriRidge(p, w, 1.45);
      float strata = sin((p.y + p.x * 0.2 + p.z * 0.13) * 2.1) * 0.5 + 0.5;
      float warm = vmTriSpeckle(p, w, 3.8, 0.92) * fade;
      float ash = smoothstep(0.62, 0.92, vmWindGust(p, 1.25)) * atmosphereFx * fade;
      vec3 basalt = mix(BASALT_DARK, BASALT_BASE, smoothstep(0.18, 0.52, plates));
      basalt = mix(basalt, BASALT_EDGE, smoothstep(0.66, 1.0, plates) * 0.6);
      basalt *= mix(0.82, 1.08, strata);
      basalt = mix(basalt, BASALT_WARM, warm * (0.28 + thermalFx * 0.34));
      basalt = mix(basalt, STONE_FLECK, ash * 0.16);
      float bRef = dot(BASALT_BASE, vec3(0.299, 0.587, 0.114));
      basalt *= clamp(baseLuma / max(bRef, 1e-3), 0.75, 1.35) * macroMul;
      col = mix(col, basalt, 0.92 * basaltFx);

    } else if (mid == MAT_ICE) {
      float iceFx = max(detailFx, crystallineFx);
      float facets = vmTriRidge(p, w, 0.95);
      float frost = vmTriFbm(p, w, 2.4);
      float windFrost = smoothstep(0.54, 0.9, vmWindGust(p + vec3(11.0, 0.0, -5.0), 1.15))
        * atmosphereFx * crystallineFx * fade * smoothstep(0.15, 0.95, up);
      vec3 ice = mix(ICE_DEEP, ICE_BASE, smoothstep(0.18, 0.68, frost));
      ice = mix(ice, ICE_WHITE, smoothstep(0.58, 1.0, facets) * 0.72 + windFrost * 0.38);
      ice += ICE_GLOW * smoothstep(0.35, 0.9, 1.0 - facets) * 0.08 * crystallineFx;
      float iRef = dot(ICE_BASE, vec3(0.299, 0.587, 0.114));
      ice *= clamp(baseLuma / max(iRef, 1e-3), 0.82, 1.2) * macroMul;
      col = mix(col, ice, 0.9 * iceFx);

    } else if (mid == MAT_CRYSTAL) {
      float crystalFx = max(detailFx, crystallineFx);
      float ridge = vmTriRidge(p, w, 2.0);
      float facet = vmTriFbm2(p, w, 0.7);
      float glint = vmTriSpeckle(p, w, 5.2, 0.88) * fade * crystallineFx;
      vec3 crystal = mix(CRYSTAL_DARK, CRYSTAL_BASE, smoothstep(0.25, 0.8, facet));
      crystal = mix(crystal, CRYSTAL_VIO, smoothstep(0.1, 0.32, ridge) * 0.28 * crystalFx);
      crystal = mix(crystal, CRYSTAL_HI, smoothstep(0.72, 1.0, ridge) * 0.72 * crystalFx + glint * 0.42);
      float cRef = dot(CRYSTAL_BASE, vec3(0.299, 0.587, 0.114));
      crystal *= clamp(baseLuma / max(cRef, 1e-3), 0.8, 1.28) * macroMul;
      col = mix(col, crystal, 0.94 * crystalFx);

    } else if (mid == MAT_SAND) {
      float sandFx = max(detailFx, atmosphereFx * 0.55);
      float ripple = sin(p.x * 1.6 + p.z * 1.1 + vmTriFbm2(p, w, 0.5) * 3.0) * 0.5 + 0.5;
      float sparkle = vmTriSpeckle(p, w, 7.0, 0.82) * fade;
      float gust = vmWindGust(p, 1.0);
      float dust = smoothstep(0.58, 0.88, gust) * atmosphereFx * fade * smoothstep(0.18, 0.92, up);
      vec3 sand = mix(SAND_DARK, SAND_BASE, smoothstep(0.3, 0.7, ripple));
      sand = mix(sand, SAND_LIGHT, smoothstep(0.6, 1.0, ripple) * 0.7);
      sand += SAND_LIGHT * sparkle * 0.35 * detailFx;
      sand = mix(sand, SAND_DUST, dust * 0.42);
      float saRef = dot(SAND_BASE, vec3(0.299, 0.587, 0.114));
      sand *= clamp(baseLuma / max(saRef, 1e-3), 0.85, 1.2) * macroMul;
      col = mix(col, sand, 0.88 * sandFx);

    } else if (mid == MAT_GRASS) {
      float grassFx = max(detailFx, organicFx);
      float moss = vmTriFbm(p, w, 1.3);
      float windShade = smoothstep(0.52, 0.9, vmWindGust(p, 0.95)) * atmosphereFx * organicFx * fade;
      vec3 mossCol = mix(MOSS_DARK, MOSS_BASE, smoothstep(0.3, 0.7, moss));
      mossCol = mix(mossCol, MOSS_LIGHT, smoothstep(0.65, 1.0, moss) * 0.8);
      mossCol = mix(mossCol, MOSS_LIGHT, windShade * 0.2);

      float clods = vmTriFbm(p, w, 0.9);
      vec3 dirtCol = mix(DIRT_DARK, DIRT_BASE, smoothstep(0.25, 0.7, clods));

      float topMask = smoothstep(0.45, 0.85, up);
      float fringe = smoothstep(0.2, 0.45, up) * (1.0 - topMask);
      vec3 g = mix(dirtCol, mossCol, topMask);
      g = mix(g, MOSS_BASE, fringe * 0.6 * organicFx);
      float gRef = dot(MOSS_BASE, vec3(0.299, 0.587, 0.114));
      g *= clamp(baseLuma / max(gRef, 1e-3), 0.8, 1.25) * macroMul;
      col = mix(col, g, 0.9 * grassFx);

    } else if (mid == MAT_WOOD) {
      float woodFx = max(detailFx, organicFx * 0.75);
      float grain = vmTriRidge(p + vec3(0.0, p.y * 0.18, 0.0), w, 1.65);
      float ring = sin(p.y * 3.2 + vmTriFbm2(p, w, 0.52) * 4.0) * 0.5 + 0.5;
      float knot = vmTriSpeckle(p, w, 1.75, 0.88) * fade;
      vec3 wood = mix(WOOD_DARK, WOOD_BASE, smoothstep(0.16, 0.7, grain));
      wood = mix(wood, WOOD_LIGHT, smoothstep(0.52, 1.0, ring) * 0.34);
      wood = mix(wood, WOOD_RING, knot * 0.42);
      float wRef = dot(WOOD_BASE, vec3(0.299, 0.587, 0.114));
      wood *= clamp(baseLuma / max(wRef, 1e-3), 0.75, 1.32) * macroMul;
      col = mix(col, wood, 0.9 * woodFx);

    } else if (mid == MAT_LAVA) {
      float lavaFx = max(detailFx * 0.55, thermalFx);
      float t = uTime * uAnimated * thermalFx * (0.18 + uWindStrength * 0.03);
      vec3 q = p + vec3(t * 1.35, sin(t * 0.73) * 0.18, -t * 0.62);
      float boil = vmTriFbm(q, w, 1.3);
      float cells = vmTriRidge(q, w, 2.45);
      float crust = vmTriFbm2(q + vec3(4.0, 0.0, -2.0), w, 0.55);
      float hot = smoothstep(0.62, 1.0, max(boil, cells));
      vec3 lava = mix(LAVA_DEEP, LAVA_ORANGE, smoothstep(0.22, 0.82, boil));
      lava = mix(lava, LAVA_HOT, hot * (0.46 + thermalFx * 0.28));
      lava = mix(lava, LAVA_SCUM, smoothstep(0.58, 0.93, crust) * (0.18 + detailFx * 0.18));
      float lRef = dot(LAVA_ORANGE, vec3(0.299, 0.587, 0.114));
      lava *= clamp(baseLuma / max(lRef, 1e-3), 0.68, 1.22);
      col = mix(col, lava, 0.94 * lavaFx);

    } else if (mid == MAT_COPPER || mid == MAT_GOLD || mid == MAT_SILVER) {
      float vein = vmTriSpeckle(p, w, 3.0, 0.85) * fade;
      float striation = smoothstep(0.62, 1.0, vmTriRidge(p, w, 1.35));
      col = mix(col, ORE_VEIN, (vein * 0.22 + striation * 0.08) * metalFx);

    } else {
      float d = vmTriFbm2(p, w, 0.75);
      col *= mix(1.0, mix(0.86, 1.10, d), detailFx);
    }
    return col;
  }
`;

export function createVoxelMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.95,
    metalness: 0.02
  });

  const { rough, metal, emissive, lavaId, materialIds, palette } = buildLUTs();

  material.onBeforeCompile = shader => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uAnimated = { value: 1 };
    shader.uniforms.uTriplanar = { value: 1 };
    shader.uniforms.uAO = { value: 1 };
    shader.uniforms.uRealityChroma = { value: 1 };
    shader.uniforms.uRealityDetail = { value: 1 };
    shader.uniforms.uRealityOrganic = { value: 1 };
    shader.uniforms.uRealityAtmosphere = { value: 1 };
    shader.uniforms.uRealityThermal = { value: 1 };
    shader.uniforms.uRealityCrystalline = { value: 1 };
    shader.uniforms.uRealityMetal = { value: 1 };
    shader.uniforms.uWindDir = { value: new THREE.Vector2(1, 0) };
    shader.uniforms.uWindStrength = { value: 1 };
    shader.uniforms.uWindGustScale = { value: 0.04 };
    shader.uniforms.uWindGustSpeed = { value: 0.42 };
    shader.uniforms.uWindOffset = { value: new THREE.Vector2(0, 0) };
    // Per-planet biome tint for ORGANIC ground (dirt/grass/sand). Defaults to a
    // no-op (strength 0) so terrain is unchanged until a profile is applied.
    shader.uniforms.uTerrainTint = { value: new THREE.Color(1, 1, 1) };
    shader.uniforms.uTerrainTintStrength = { value: 0 };
    material.userData.shader = shader;

    // --- Vertex: forward material id + world pos/normal, bake per-corner AO.
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute vec2 aInstanceData;
        uniform float uAO;
        varying float vMatId;
        varying float vAO;
        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vMatId = aInstanceData.x;
        vWorldPos = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);

        // Baked AO: darken a box corner for each solid face-neighbour meeting it.
        int aoMask = int(aInstanceData.y + 0.5);
        vec3 sgn = sign(position);
        float occ = 0.0;
        if (sgn.x > 0.0 && (aoMask & 1) != 0) occ += 1.0;
        if (sgn.x < 0.0 && (aoMask & 2) != 0) occ += 1.0;
        if (sgn.y > 0.0 && (aoMask & 4) != 0) occ += 1.0;
        if (sgn.y < 0.0 && (aoMask & 8) != 0) occ += 1.0;
        if (sgn.z > 0.0 && (aoMask & 16) != 0) occ += 1.0;
        if (sgn.z < 0.0 && (aoMask & 32) != 0) occ += 1.0;
        float ao = clamp(1.0 - occ * 0.22, 0.4, 1.0);
        vAO = mix(1.0, ao, uAO);`
      );

    // --- Fragment: declare LUTs + varyings, then feed Three's BRDF inputs.
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform float uAnimated;
        uniform float uTriplanar;
        uniform float uRealityChroma;
        uniform float uRealityDetail;
        uniform float uRealityOrganic;
        uniform float uRealityAtmosphere;
        uniform float uRealityThermal;
        uniform float uRealityCrystalline;
        uniform float uRealityMetal;
        uniform vec2 uWindDir;
        uniform float uWindStrength;
        uniform float uWindGustScale;
        uniform float uWindGustSpeed;
        uniform vec2 uWindOffset;
        uniform vec3 uTerrainTint;
        uniform float uTerrainTintStrength;
        varying float vMatId;
        varying float vAO;
        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;
        ${palette}
        ${materialIds}
        ${NOISE_GLSL}
        ${SURFACE_GLSL}
        ${rough}
        ${metal}
        ${emissive}

        // Distance fade for high-freq detail (1 near -> 0 far) to stop shimmer.
        float vmDetailFade() {
          float dist = length(vWorldPos - cameraPosition);
          return 1.0 - smoothstep(28.0, 70.0, dist);
        }`
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        if (uTriplanar > 0.5) {
          vec3 w = vmTriW(vWorldNormal);
          int mid = int(vMatId + 0.5);
          float fade = vmDetailFade();
          // up: how planet-outward this face points (for grass-block tops).
          float up = clamp(dot(vWorldNormal, normalize(vWorldPos)), 0.0, 1.0);
          diffuseColor.rgb = vmSurface(
            diffuseColor.rgb,
            vWorldPos,
            w,
            mid,
            fade,
            up,
            uRealityDetail,
            uRealityOrganic,
            uRealityAtmosphere,
            uRealityThermal,
            uRealityCrystalline,
            uRealityMetal
          );
        }
        // Per-planet biome tint on ORGANIC ground only (dirt/grass/sand) so soil
        // coheres with the planet's grass/water; mineral materials stay neutral.
        // Luma-preserving: rescale the tint to the pixel's brightness then blend,
        // so we shift HUE without lightening/darkening. Runs on every quality tier
        // (independent of uTriplanar) so even flat slabs carry the biome.
        if (uTerrainTintStrength > 0.0) {
          int tmid = int(vMatId + 0.5);
          if (tmid == MAT_DIRT || tmid == MAT_GRASS || tmid == MAT_SAND) {
            float pLuma = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
            float tLuma = max(dot(uTerrainTint, vec3(0.299, 0.587, 0.114)), 1e-3);
            vec3 tintAtLuma = uTerrainTint * (pLuma / tLuma);
            diffuseColor.rgb = mix(diffuseColor.rgb, tintAtLuma, uTerrainTintStrength);
          }
        }`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        if (uRealityChroma < 0.999) {
          float realityLuma = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
          diffuseColor.rgb = mix(vec3(realityLuma), diffuseColor.rgb, uRealityChroma);
        }`
      )
      .replace(
        '#include <normal_fragment_begin>',
        `#include <normal_fragment_begin>
        // --- Triplanar procedural BUMP relief (the #1 HD cue). Perturb the
        // shading normal by the gradient of the per-material world-space height
        // field, then transform the perturbed WORLD normal into VIEW space for
        // the BRDF. Gated by uTriplanar; faded with distance to avoid aliasing.
        if (uTriplanar > 0.5 && uRealityDetail > 0.001) {
          int bmid = int(vMatId + 0.5);
          vec3 bw = vmTriW(vWorldNormal);
          float bfade = vmDetailFade();
          // Strength fades to 0 far away so far voxels stay smooth/quiet.
          float reliefFx = uRealityDetail;
          if (bmid == MAT_DIRT) reliefFx = max(uRealityDetail * 0.62, uRealityOrganic * 0.35);
          if (bmid == MAT_LAVA) reliefFx = max(uRealityDetail * 0.55, uRealityThermal * 0.82);
          if (bmid == MAT_ICE || bmid == MAT_CRYSTAL) reliefFx = max(uRealityDetail, uRealityCrystalline * 0.78);
          if (bmid == MAT_WOOD || bmid == MAT_GRASS) reliefFx = max(uRealityDetail, uRealityOrganic * 0.65);
          if (bmid == MAT_COPPER || bmid == MAT_GOLD || bmid == MAT_SILVER) reliefFx = max(uRealityDetail, uRealityMetal * 0.62);
          float strength = mix(0.12, 0.55, bfade) * clamp(reliefFx, 0.0, 1.25);
          // Finite-difference gradient of the height field in world space.
          float eps = 0.06;
          float h0 = vmHeight(vWorldPos, bw, bmid);
          float hx = vmHeight(vWorldPos + vec3(eps, 0.0, 0.0), bw, bmid);
          float hy = vmHeight(vWorldPos + vec3(0.0, eps, 0.0), bw, bmid);
          float hz = vmHeight(vWorldPos + vec3(0.0, 0.0, eps), bw, bmid);
          vec3 grad = vec3(hx - h0, hy - h0, hz - h0) / eps;
          // Remove the component along the face normal -> tangent-plane tilt.
          vec3 wn = normalize(vWorldNormal);
          grad -= wn * dot(grad, wn);
          vec3 perturbedWorld = normalize(wn - grad * strength);
          // World -> view space (normalMatrix is for model-view; use viewMatrix).
          vec3 vn = normalize((viewMatrix * vec4(perturbedWorld, 0.0)).xyz);
          normal = vn;
        }`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = VOXEL_ROUGH[int(vMatId + 0.5)];
        // STONE reads a touch harder on raised faces; DIRT slightly rougher.
        if (uTriplanar > 0.5 && uRealityDetail > 0.001) {
          int rmid = int(vMatId + 0.5);
          vec3 rw = vmTriW(vWorldNormal);
          if (rmid == MAT_STONE) {
            float crack = vmTriRidge(vWorldPos, rw, 1.1);
            roughnessFactor *= mix(1.0, mix(1.05, 0.86, smoothstep(0.4, 0.95, crack)), uRealityDetail);
          } else if (rmid == MAT_BASALT) {
            float plate = vmTriRidge(vWorldPos, rw, 1.45);
            roughnessFactor *= mix(1.0, mix(1.08, 0.82, smoothstep(0.55, 1.0, plate)), uRealityDetail);
          } else if (rmid == MAT_ICE) {
            float facet = vmTriRidge(vWorldPos, rw, 0.95);
            roughnessFactor *= mix(1.0, mix(0.72, 1.12, smoothstep(0.2, 0.8, facet)), max(uRealityDetail, uRealityCrystalline));
          } else if (rmid == MAT_CRYSTAL) {
            float ridge = vmTriRidge(vWorldPos, rw, 2.0);
            roughnessFactor *= mix(1.0, mix(0.72, 0.45, smoothstep(0.65, 1.0, ridge)), max(uRealityDetail, uRealityCrystalline));
          } else if (rmid == MAT_LAVA) {
            float cell = vmTriRidge(vWorldPos + vec3(uTime * uAnimated * 0.18, 0.0, 0.0), rw, 2.45);
            roughnessFactor *= mix(1.0, mix(0.92, 0.48, smoothstep(0.58, 1.0, cell)), uRealityThermal);
          } else if (rmid == MAT_WOOD) {
            float grain = vmTriRidge(vWorldPos, rw, 1.65);
            roughnessFactor *= mix(1.0, mix(1.08, 0.82, smoothstep(0.48, 1.0, grain)), max(uRealityDetail, uRealityOrganic));
          }
        }`
      )
      .replace(
        '#include <metalnessmap_fragment>',
        `#include <metalnessmap_fragment>
        metalnessFactor = VOXEL_METAL[int(vMatId + 0.5)];`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          int mid = int(vMatId + 0.5);
          vec3 e = VOXEL_EMISSIVE[mid];
          if (mid == ${lavaId}) {
            vec3 ew = vmTriW(vWorldNormal);
            float phase = dot(vWorldPos, vec3(0.15));
            float boil = vmTriFbm(vWorldPos + vec3(uTime * uAnimated * 0.24, 0.0, -uTime * uAnimated * 0.11), ew, 1.3);
            float cells = vmTriRidge(vWorldPos, ew, 2.45);
            float pulse = 0.82 + 0.18 * sin(uTime * 1.5 + phase);
            float hot = smoothstep(0.62, 1.0, max(boil, cells));
            e *= mix(1.0, pulse + hot * 0.34, uAnimated * uRealityThermal);
            e += LAVA_HOT * hot * 0.42 * uRealityThermal;
          } else if (mid == MAT_BASALT) {
            vec3 ew = vmTriW(vWorldNormal);
            float ember = vmTriSpeckle(vWorldPos, ew, 3.8, 0.94) * vmDetailFade();
            e += BASALT_WARM * ember * 0.18 * uRealityThermal;
          } else if (mid == MAT_ICE) {
            vec3 ew = vmTriW(vWorldNormal);
            float inner = 1.0 - vmTriRidge(vWorldPos, ew, 0.95);
            float frost = smoothstep(0.58, 0.9, vmWindGust(vWorldPos, 1.1)) * uRealityAtmosphere;
            e += ICE_GLOW * (smoothstep(0.45, 0.9, inner) * 0.04 + frost * 0.025) * uRealityCrystalline;
          } else if (mid == MAT_CRYSTAL) {
            vec3 ew = vmTriW(vWorldNormal);
            float ridge = vmTriRidge(vWorldPos, ew, 2.0);
            float glint = vmTriSpeckle(vWorldPos, ew, 5.2, 0.9) * vmDetailFade();
            e += CRYSTAL_HI * (smoothstep(0.72, 1.0, ridge) * 0.18 + glint * 0.22) * uRealityCrystalline;
          } else if (mid == MAT_COPPER || mid == MAT_GOLD || mid == MAT_SILVER) {
            vec3 ew = vmTriW(vWorldNormal);
            float glint = vmTriSpeckle(vWorldPos, ew, 4.6, 0.91) * vmDetailFade();
            e += ORE_VEIN * glint * 0.035 * uRealityMetal;
          }
          totalEmissiveRadiance += e;
        }`
      )
      .replace(
        '#include <aomap_fragment>',
        `#include <aomap_fragment>
        reflectedLight.indirectDiffuse *= vAO;`
      );
  };

  // Single shared material on one mesh: a stable key avoids per-object recompiles
  // and reserves room for future variants (e.g. painterly). Bumped to v5 when
  // narrative reality-stage uniforms and planet-wind block effects were added.
  material.customProgramCacheKey = () => 'voxel-pbr-v5';

  return material;
}

/**
 * Push the per-planet terrain tint from the profile into the material (call once
 * the shader has compiled; re-call when the planet seed changes). The palette is
 * baked GLSL, so we only drive the soil hue-nudge uniforms — the program stays
 * shared across planets.
 */
export function applyTerrainProfileToMaterial(
  profile: TerrainProfile,
  material: THREE.MeshStandardMaterial
): void {
  const u = (material.userData.shader as
    | { uniforms?: Record<string, { value: unknown }> }
    | undefined)?.uniforms;
  if (!u) return;
  if (u.uTerrainTint) (u.uTerrainTint.value as THREE.Color).copy(profile.tintColor);
  if (u.uTerrainTintStrength) (u.uTerrainTintStrength.value as number) = profile.tintStrength;
}

/** Push the deterministic per-planet wind profile into block-surface effects. */
export function applyVoxelWindProfileToMaterial(
  profile: WindProfile,
  material: THREE.MeshStandardMaterial
): void {
  const u = (material.userData.shader as
    | { uniforms?: Record<string, { value: unknown }> }
    | undefined)?.uniforms;
  if (!u) return;
  if (u.uWindDir) (u.uWindDir.value as THREE.Vector2).copy(profile.direction);
  if (u.uWindStrength) (u.uWindStrength.value as number) = profile.strength;
  if (u.uWindGustScale) (u.uWindGustScale.value as number) = profile.gustScale;
  if (u.uWindGustSpeed) (u.uWindGustSpeed.value as number) = profile.gustSpeed;
  if (u.uWindOffset) (u.uWindOffset.value as THREE.Vector2).copy(profile.offset);
}

/** Push time + quality-derived toggles into the shader (called from useFrame). */
export function updateVoxelMaterial(
  material: THREE.MeshStandardMaterial,
  time: number,
  quality: GraphicsQuality,
  reality: VoxelRealityEffects = getVoxelRealityEffects()
) {
  const shader = material.userData.shader as { uniforms?: Record<string, { value: unknown }> } | undefined;
  if (!shader?.uniforms) return;
  const u = shader.uniforms;
  const animated = quality.animatedShaders ? 1 : 0;
  const chroma = reality.chroma;
  const detail = quality.triplanarDetail ? reality.detail : 0;
  const organic = quality.triplanarDetail ? reality.organic : 0;
  const atmosphere = quality.triplanarDetail && quality.animatedShaders ? reality.atmosphere : 0;
  const thermal = quality.animatedShaders ? reality.thermal : 0;
  const crystalline = quality.triplanarDetail ? reality.crystalline : 0;
  const metal = quality.triplanarDetail ? reality.metal : 0;
  const hasSurfaceEffects = detail + organic + atmosphere + thermal + crystalline + metal > 0.001;

  if (u.uTime) (u.uTime.value as number) = time;
  if (u.uAnimated) (u.uAnimated.value as number) = animated;
  if (u.uTriplanar) (u.uTriplanar.value as number) = quality.triplanarDetail && hasSurfaceEffects ? 1 : 0;
  if (u.uAO) (u.uAO.value as number) = quality.bakedAO ? 1 : 0;
  if (u.uRealityChroma) (u.uRealityChroma.value as number) = chroma;
  if (u.uRealityDetail) (u.uRealityDetail.value as number) = detail;
  if (u.uRealityOrganic) (u.uRealityOrganic.value as number) = organic;
  if (u.uRealityAtmosphere) (u.uRealityAtmosphere.value as number) = atmosphere;
  if (u.uRealityThermal) (u.uRealityThermal.value as number) = thermal;
  if (u.uRealityCrystalline) (u.uRealityCrystalline.value as number) = crystalline;
  if (u.uRealityMetal) (u.uRealityMetal.value as number) = metal;
}
