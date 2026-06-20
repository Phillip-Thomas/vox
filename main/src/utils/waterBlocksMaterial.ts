import * as THREE from 'three';
import type { GraphicsQuality } from '../config/graphicsSettings';

// --- Water BLOCK material (Phase 4 rearchitecture, fidelity upgrade) ---------
//
// Water is real voxels rendered as flat SURFACE QUADS (see WaterBlocks.tsx). The
// surface is shaded with a high-quality procedural ocean shader that is
// CONTINUOUS across adjacent quads on all six cube faces.
//
// Continuity trick: every wave / ripple / colour field is a function of the
// fragment's WORLD position (and time), NOT of quad-local coordinates. Adjacent
// quads share a world-space boundary, so they evaluate the same field there — no
// per-quad seams. We derive a tangent frame from `localUp = normalize(worldPos)`
// (the cube-sphere outward direction, valid on all six faces).
//
// IMPORTANT COMPILE NOTE: all water shading is injected at <normal_fragment_begin>
// (where Three's `normal` AND `diffuseColor` are both in scope). The previous
// version injected the colour/Fresnel into <map_fragment>, which runs BEFORE
// <normal_fragment_begin> and therefore referenced an UNDECLARED `normal` — the
// fragment shader failed to compile and the water rendered nothing. Do not move
// `normal`-dependent code back into <map_fragment>.

// Colours authored in sRGB then linearized (consumed in linear space).
const DEEP_WATER = new THREE.Color(0x10495e).convertSRGBToLinear();   // looking straight down (deep body)
const SHALLOW_WATER = new THREE.Color(0x2fa8c8).convertSRGBToLinear(); // base / mid tint (turquoise)
const SKY_TINT = new THREE.Color(0xcfe8ff).convertSRGBToLinear();     // grazing / fresnel reflection
const FOAM_COLOR = new THREE.Color(0xf2f9ff).convertSRGBToLinear();   // whitecaps / coastline foam

// Night/ambient visibility floor: a faint self-lit deep-water glow so the ocean
// never collapses to pure black at midnight. Tiny in daylight, keeps water
// discernible under a dark sky.
const NIGHT_FLOOR = new THREE.Color(0x06222e).convertSRGBToLinear();

// Reflection contribution when reflections are enabled.
const REFLECTION_INTENSITY = 1.5;

// World-space tangent-plane wave fields. Everything is a function of world
// position so adjacent quads line up exactly. `wsSwell` is a multi-octave FBM of
// moving sines returning a signed surface height used ONLY for finite-difference
// shading normals + whitecap foam (we never displace geometry). `wsRipple` adds
// crisp high-frequency detail.
const WATER_GLSL = /* glsl */ `
  float wsHash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float wsNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = wsHash21(i);
    float b = wsHash21(i + vec2(1.0, 0.0));
    float c = wsHash21(i + vec2(0.0, 1.0));
    float d = wsHash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  float wsOctave(vec2 p, vec2 dir, float freq, float speed, float t) {
    float phase = dot(p, dir) * freq + t * speed;
    phase += wsNoise(p * freq * 0.5 + t * 0.1) * 1.6;
    return sin(phase);
  }
  float wsSwell(vec2 p, float t) {
    float h = 0.0;
    h += wsOctave(p, vec2(0.92, 0.30),  0.80, 0.90, t) * 1.00;
    h += wsOctave(p, vec2(-0.45, 0.85), 1.30, 0.78, -t) * 0.55;
    h += wsOctave(p, vec2(0.65, -0.72), 2.20, 1.30, t) * 0.30;
    h += wsOctave(p, vec2(-0.80, -0.55), 3.60, 1.75, -t) * 0.17;
    h += wsOctave(p, vec2(0.30, 0.95),  5.40, 2.20, t) * 0.09;
    h += (wsNoise(p * 1.7 + vec2(t * 0.12, -t * 0.09)) - 0.5) * 0.50;
    return h * 0.42;
  }
  float wsRipple(vec2 p, float t) {
    float r = 0.0;
    r += sin(dot(p, vec2(1.0, 0.6)) * 7.0 + t * 2.3) * 0.50;
    r += sin(dot(p, vec2(-0.7, 1.1)) * 9.5 - t * 2.9) * 0.33;
    r += sin(dot(p, vec2(0.5, -1.3)) * 13.0 + t * 3.4) * 0.22;
    r += (wsNoise(p * 6.0 + t * 0.4) - 0.5) * 0.55;
    r += (wsNoise(p * 14.0 - t * 0.6) - 0.5) * 0.30;
    return r * 0.10;
  }
  void wsTangentFrame(vec3 up, out vec3 tangent, out vec3 bitangent) {
    vec3 ref = abs(up.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    tangent = normalize(cross(ref, up));
    bitangent = cross(up, tangent);
  }
`;

export interface WaterBlocksUniforms {
  uTime: { value: number };
  uAnimated: { value: number };
  uReflections: { value: number };
  uSunDir: { value: THREE.Vector3 };
  uDeepColor: { value: THREE.Color };
  uSkyColor: { value: THREE.Color };
  uFoamColor: { value: THREE.Color };
  uNightFloor: { value: THREE.Color };
}

/**
 * Build the shared transparent water-surface MeshStandardMaterial.
 *
 * Transparency: terrain is opaque and drawn first; we set `transparent`,
 * `depthWrite = false` and a high `renderOrder` (set on the mesh) so the sandy
 * seabed shows through. Flat quads have no hollow interior, so `DoubleSide` is
 * fine. The instanced mesh is `frustumCulled = false`.
 */
export function createWaterBlocksMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: SHALLOW_WATER.clone(),
    roughness: 0.06,
    metalness: 0.0,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    side: THREE.DoubleSide,
    envMapIntensity: REFLECTION_INTENSITY
  });

  material.onBeforeCompile = shader => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uAnimated = { value: 1 };
    shader.uniforms.uReflections = { value: 1 };
    shader.uniforms.uSunDir = { value: new THREE.Vector3(0, 1, 0) };
    shader.uniforms.uDeepColor = { value: DEEP_WATER.clone() };
    shader.uniforms.uSkyColor = { value: SKY_TINT.clone() };
    shader.uniforms.uFoamColor = { value: FOAM_COLOR.clone() };
    shader.uniforms.uNightFloor = { value: NIGHT_FLOOR.clone() };
    material.userData.shader = shader;

    // --- Vertex: forward WORLD position + WORLD face-normal. No displacement. ---
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;`
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vec4 wsWorldPosition = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          wsWorldPosition = instanceMatrix * wsWorldPosition;
        #endif
        wsWorldPosition = modelMatrix * wsWorldPosition;
        vWorldPos = wsWorldPosition.xyz;`
      )
      .replace(
        '#include <defaultnormal_vertex>',
        `#include <defaultnormal_vertex>
        vec3 wsObjNormal = objectNormal;
        #ifdef USE_INSTANCING
          wsObjNormal = mat3(instanceMatrix) * wsObjNormal;
        #endif
        vWorldNormal = normalize(mat3(modelMatrix) * wsObjNormal);`
      );

    // --- Fragment: declare fields + WATER_GLSL, then do ALL water shading in
    // <normal_fragment_begin> (where `normal` AND `diffuseColor` are in scope). ---
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uReflections;
        uniform float uTime;
        uniform float uAnimated;
        uniform vec3 uSunDir;
        uniform vec3 uDeepColor;
        uniform vec3 uSkyColor;
        uniform vec3 uFoamColor;
        uniform vec3 uNightFloor;
        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;
        float vWaterTopness;
        float vWaterSparkle;
        ${WATER_GLSL}`
      )
      .replace(
        '#include <normal_fragment_begin>',
        `#include <normal_fragment_begin>
        {
          float wsT = uTime * uAnimated;
          vec3 wUp = normalize(vWorldPos);
          vec3 fn = normalize(vWorldNormal);

          // How "top-facing" this quad is: 1 on the ocean surface (outward
          // faces), ~0 on coastal/cliff side faces which stay calmer & deeper.
          float topness = clamp(dot(fn, wUp), 0.0, 1.0);
          float surf = smoothstep(0.30, 0.80, topness);

          vec3 wTan, wBit;
          wsTangentFrame(wUp, wTan, wBit);
          float waveScale = 0.55;
          vec2 wp = vec2(dot(vWorldPos, wTan), dot(vWorldPos, wBit)) * waveScale;

          // Finite-difference gradients of the swell + ripple fields.
          float e = 0.22;
          float hx = wsSwell(wp + vec2(e, 0.0), wsT) - wsSwell(wp - vec2(e, 0.0), wsT);
          float hz = wsSwell(wp + vec2(0.0, e), wsT) - wsSwell(wp - vec2(0.0, e), wsT);
          float re = 0.09;
          float rx = wsRipple(wp + vec2(re, 0.0), wsT) - wsRipple(wp - vec2(re, 0.0), wsT);
          float rz = wsRipple(wp + vec2(0.0, re), wsT) - wsRipple(wp - vec2(0.0, re), wsT);
          float swellSlope = 0.85;
          float rippleSlope = 3.4;

          vec3 rippled = normalize(
            wUp
            - wTan * (hx * swellSlope + rx * rippleSlope) * surf
            - wBit * (hz * swellSlope + rz * rippleSlope) * surf
          );
          vec3 wsWorldN = normalize(mix(fn, rippled, surf));

          // Feed the rippled normal into Three's PBR specular / IBL (view space).
          normal = normalize((viewMatrix * vec4(wsWorldN, 0.0)).xyz);

          // ---- colour / Fresnel / foam (here, so normal and diffuseColor exist) ----
          vec3 V = normalize(cameraPosition - vWorldPos);
          float ndv = clamp(dot(wsWorldN, V), 0.0, 1.0);
          float fres = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);

          // View-depth body colour: deep blue looking straight down (ndv~1),
          // lightening toward the shallow tint at grazing — reads as water from
          // above AND at grazing, never washing transparent.
          float depthMix = smoothstep(0.15, 0.95, ndv);
          vec3 body = mix(diffuseColor.rgb, uDeepColor, depthMix);
          body *= mix(1.0, 0.78, depthMix);
          float drift = wsNoise(wp * 0.5 + wsT * 0.02) - 0.5;
          body *= 1.0 + drift * 0.12;

          float reflAmt = fres * uReflections;
          vec3 reflTint = mix(body, uSkyColor, reflAmt);

          // Crest whitecap foam on the top surface.
          float crest = smoothstep(0.50, 0.92, wsSwell(wp, wsT)) * surf;
          float foamNoise = wsNoise(wp * 4.0 + vec2(wsT * 0.25, -wsT * 0.18));
          float foam = clamp(crest * (0.55 + 0.45 * foamNoise), 0.0, 1.0);
          reflTint = mix(reflTint, uFoamColor, foam);

          diffuseColor.rgb = reflTint + uNightFloor;
          diffuseColor.a = clamp(diffuseColor.a + reflAmt * 0.30 + foam * 0.40, 0.0, 1.0);
          diffuseColor.a = max(diffuseColor.a, 0.85);

          // Stored for the sun-glint in <emissivemap_fragment> (runs later).
          vWaterTopness = surf;
          vWaterSparkle = clamp((abs(rx) + abs(rz)) * 6.0, 0.0, 1.0);
        }`
      )
      // Sun glint: tight specular core + sparkle + soft sheen aligned to the sun.
      // <emissivemap_fragment> runs AFTER <normal_fragment_begin>, so `normal` and
      // the stored fields are valid here.
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          vec3 V = normalize(cameraPosition - vWorldPos);
          vec3 H = normalize(uSunDir + V);
          float ndh = clamp(dot(normal, normalize((viewMatrix * vec4(H, 0.0)).xyz)), 0.0, 1.0);
          float core = pow(ndh, 480.0);
          float sparkle = pow(ndh, 160.0) * vWaterSparkle * 0.7;
          float sheen = pow(ndh, 40.0) * 0.16;
          float glint = (core + sparkle + sheen) * uReflections * vWaterTopness;
          totalEmissiveRadiance += vec3(1.0, 0.95, 0.84) * glint * 1.6;
        }`
      );
  };

  // Bumped to v4 so the broken v3 program is never reused from cache.
  material.customProgramCacheKey = () => 'water-blocks-pbr-v4';
  return material;
}

const _sunScratch = new THREE.Vector3();

/**
 * Push time / sun direction / quality toggles into the water shader (useFrame).
 * `sunDir` is copied (the SkyController vector is mutated in place).
 */
export function updateWaterBlocksMaterial(
  material: THREE.MeshStandardMaterial,
  time: number,
  sunDir: THREE.Vector3,
  quality: GraphicsQuality
) {
  const shader = material.userData.shader as
    | { uniforms?: Partial<WaterBlocksUniforms> }
    | undefined;
  if (!shader?.uniforms) return;
  const u = shader.uniforms;
  if (u.uTime && quality.waterAnimated) u.uTime.value = time;
  if (u.uAnimated) u.uAnimated.value = quality.waterAnimated ? 1 : 0;
  if (u.uReflections) u.uReflections.value = quality.waterReflections === 'none' ? 0 : 1;
  if (u.uSunDir) u.uSunDir.value.copy(_sunScratch.copy(sunDir).normalize());
  material.envMapIntensity = quality.waterReflections === 'none' ? 0 : REFLECTION_INTENSITY;
}
