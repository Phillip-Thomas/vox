import * as THREE from 'three';
import { MATERIAL_ORDER, MATERIALS, MaterialType } from '../types/materials';
import { GraphicsQuality } from '../config/graphicsSettings';

// Builds the shared voxel MeshStandardMaterial. We keep Three's full PBR /
// IBL / lighting pipeline and only INJECT inputs via onBeforeCompile:
//   - per-instance material id (aInstanceData.x) selects roughness / metalness
//     / emissive from compile-time LUTs (honors materials.ts).
//   - aInstanceData.y is a 6-bit face-occupancy mask -> per-corner baked AO.
//   - triplanar procedural value-noise adds surface variation.
// Effects are toggled by uniforms (uTriplanar / uAO / uAnimated) so a single
// compiled program serves every quality profile.

const N = MATERIAL_ORDER.length;

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
    lavaId: MATERIAL_ORDER.indexOf(MaterialType.LAVA)
  };
}

// Cheap IQ-style value noise for triplanar detail.
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
`;

export function createVoxelMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.95,
    metalness: 0.02
  });

  const { rough, metal, emissive, lavaId } = buildLUTs();

  material.onBeforeCompile = shader => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uAnimated = { value: 1 };
    shader.uniforms.uTriplanar = { value: 1 };
    shader.uniforms.uAO = { value: 1 };
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
        varying float vMatId;
        varying float vAO;
        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;
        ${NOISE_GLSL}
        ${rough}
        ${metal}
        ${emissive}`
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        if (uTriplanar > 0.5) {
          vec3 bw = abs(vWorldNormal);
          bw /= (bw.x + bw.y + bw.z + 1e-5);
          float scale = 0.75;
          float d =
            vmFbm(vWorldPos.yz * scale) * bw.x +
            vmFbm(vWorldPos.xz * scale) * bw.y +
            vmFbm(vWorldPos.xy * scale) * bw.z;
          diffuseColor.rgb *= mix(0.82, 1.10, d);
        }`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = VOXEL_ROUGH[int(vMatId + 0.5)];`
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
            float phase = dot(vWorldPos, vec3(0.15));
            float pulse = 0.85 + 0.15 * sin(uTime * 1.5 + phase);
            e *= mix(1.0, pulse, uAnimated);
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
  // and reserves room for future variants (e.g. painterly).
  material.customProgramCacheKey = () => 'voxel-pbr-v1';

  return material;
}

/** Push time + quality-derived toggles into the shader (called from useFrame). */
export function updateVoxelMaterial(
  material: THREE.MeshStandardMaterial,
  time: number,
  quality: GraphicsQuality
) {
  const shader = material.userData.shader as { uniforms?: Record<string, { value: number }> } | undefined;
  if (!shader?.uniforms) return;
  const u = shader.uniforms;
  if (u.uTime) u.uTime.value = time;
  if (u.uAnimated) u.uAnimated.value = quality.animatedShaders ? 1 : 0;
  if (u.uTriplanar) u.uTriplanar.value = quality.triplanarDetail ? 1 : 0;
  if (u.uAO) u.uAO.value = quality.bakedAO ? 1 : 0;
}
