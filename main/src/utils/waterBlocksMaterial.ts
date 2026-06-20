import * as THREE from 'three';
import type { GraphicsQuality } from '../config/graphicsSettings';

// --- Water BLOCK material (Phase 4 — IQ-style procedural ocean) --------------
//
// Water is real voxels rendered as flat SURFACE QUADS (see WaterBlocks.tsx).
// The surface is shaded with a fully procedural ocean model in the spirit of
// Inigo Quilez / Shadertoy ocean shaders, evaluated in WORLD space so it is
// CONTINUOUS across adjacent quads on all six cube faces.
//
// Design (why it looks like water, not a lit slab with a mirror):
//   • Multi-octave, domain-warped FBM swell + a high-frequency ripple field,
//     analytic finite-difference normals (no geometry displacement → gap-free).
//   • A PROCEDURAL reflected SKY (horizon→zenith gradient + sun disk/glow that
//     dims at night and warms at sunset), sampled along the reflection ray —
//     instead of an "obvious" static environment-cubemap mirror.
//   • Schlick Fresnel blends the deep refracted body colour ↔ the reflected sky.
//   • Subsurface-scattering glow (light shining THROUGH wave crests toward the
//     camera), the signature translucent-ocean cue.
//   • A tight, sparkly sun glitter. Reflection + SSS + glitter are added to
//     EMISSIVE so they read as light, not as albedo dimmed by the diffuse term.
//
// COMPILE NOTE (hard-won): all `normal`-dependent shading lives in
// <normal_fragment_begin> (the first chunk where Three declares `normal`) and the
// emissive add-in lives in <emissivemap_fragment> (which runs after). Injecting
// `normal` into <map_fragment> fails to COMPILE (undeclared `normal`) and renders
// nothing — do not move it there. Also: never put backticks in the GLSL strings.

// Linear-space body/foam colours (the GLSL works in linear; ACES tonemaps after).
const DEEP_WATER = new THREE.Color(0x0a3a4f).convertSRGBToLinear();   // deep refracted body
const SHALLOW_WATER = new THREE.Color(0x2ba6c6).convertSRGBToLinear(); // shallow/grazing tint
const FOAM_COLOR = new THREE.Color(0xeef7ff).convertSRGBToLinear();   // whitecaps
const SSS_COLOR = new THREE.Color(0x1f9e86).convertSRGBToLinear();    // translucent teal-green glow
const NIGHT_FLOOR = new THREE.Color(0x05202c).convertSRGBToLinear();  // keeps water visible at night

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
    phase += wsNoise(p * freq * 0.5 + t * 0.1) * 1.6; // phase warp
    return sin(phase);
  }
  // Multi-octave swell with a low-frequency domain warp for organic, non-grating
  // wave fronts. Signed height used only for finite-difference normals + foam.
  float wsSwell(vec2 q, float t) {
    vec2 w = vec2(wsNoise(q * 0.35 + t * 0.05), wsNoise(q * 0.35 + 7.3 - t * 0.04)) - 0.5;
    vec2 p = q + w * 1.5; // domain warp
    float h = 0.0;
    h += wsOctave(p, vec2(0.92, 0.30),  0.80, 0.90, t) * 1.00;
    h += wsOctave(p, vec2(-0.45, 0.85), 1.30, 0.78, -t) * 0.55;
    h += wsOctave(p, vec2(0.65, -0.72), 2.20, 1.30, t) * 0.30;
    h += wsOctave(p, vec2(-0.80, -0.55), 3.60, 1.75, -t) * 0.17;
    h += wsOctave(p, vec2(0.30, 0.95),  5.40, 2.20, t) * 0.09;
    h += (wsNoise(p * 1.7 + vec2(t * 0.12, -t * 0.09)) - 0.5) * 0.45;
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
  // Procedural reflected sky for a reflection ray rd, given the sun direction and
  // the local up. Horizon→zenith gradient + sun disk/glow; dims to night-navy as
  // the sun drops below the local horizon, warms near sunset. All linear-space.
  vec3 wsSkyColor(vec3 rd, vec3 sunDir, vec3 up) {
    float elev = dot(sunDir, up);                       // sun elevation vs local up
    float daylight = smoothstep(-0.18, 0.22, elev);
    float h = clamp(dot(rd, up) * 0.5 + 0.5, 0.0, 1.0); // 0 nadir → 1 zenith
    vec3 zenithDay  = vec3(0.06, 0.22, 0.50);
    vec3 horizonDay = vec3(0.40, 0.58, 0.78);
    vec3 zenithNight  = vec3(0.006, 0.012, 0.030);
    vec3 horizonNight = vec3(0.020, 0.035, 0.070);
    vec3 zenith  = mix(zenithNight, zenithDay, daylight);
    vec3 horizon = mix(horizonNight, horizonDay, daylight);
    vec3 sky = mix(horizon, zenith, pow(h, 0.55));
    float sd = max(dot(rd, sunDir), 0.0);
    vec3 sunWarm = vec3(1.0, 0.45, 0.18);
    vec3 sunHigh = vec3(1.0, 0.96, 0.88);
    vec3 sunCol = mix(sunWarm, sunHigh, smoothstep(0.0, 0.35, elev));
    sky += sunCol * (pow(sd, 8.0) * 0.45 + pow(sd, 360.0) * 4.0) * daylight;
    return sky;
  }
`;

export interface WaterBlocksUniforms {
  uTime: { value: number };
  uAnimated: { value: number };
  uReflections: { value: number };
  uSunDir: { value: THREE.Vector3 };
  uDeepColor: { value: THREE.Color };
  uShallowColor: { value: THREE.Color };
  uFoamColor: { value: THREE.Color };
  uSSSColor: { value: THREE.Color };
  uNightFloor: { value: THREE.Color };
}

export function createWaterBlocksMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: SHALLOW_WATER.clone(),
    // High roughness + zero metalness/envMap: the standard model contributes only
    // a soft, neutral base. ALL the ocean look (reflection, SSS, glitter) is our
    // procedural emissive — so there's no "obvious" cubemap mirror, and the look
    // doesn't depend on the (static, midday) scene environment.
    roughness: 0.55,
    metalness: 0.0,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    side: THREE.DoubleSide,
    envMapIntensity: 0.0
  });

  material.onBeforeCompile = shader => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uAnimated = { value: 1 };
    shader.uniforms.uReflections = { value: 1 };
    shader.uniforms.uSunDir = { value: new THREE.Vector3(0, 1, 0) };
    shader.uniforms.uDeepColor = { value: DEEP_WATER.clone() };
    shader.uniforms.uShallowColor = { value: SHALLOW_WATER.clone() };
    shader.uniforms.uFoamColor = { value: FOAM_COLOR.clone() };
    shader.uniforms.uSSSColor = { value: SSS_COLOR.clone() };
    shader.uniforms.uNightFloor = { value: NIGHT_FLOOR.clone() };
    shader.uniforms.uWaveAmp = { value: 0.45 };
    material.userData.shader = shader;

    // --- Vertex: displace along the surface by the world-space swell, then
    // forward WORLD position + WORLD face-normal. The displacement uses the SAME
    // wsSwell field (in world space) the fragment uses for normals, so geometry
    // ripples and shading stay consistent AND adjacent quads share heights at the
    // seam (gap-free). ---
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform float uAnimated;
        uniform float uWaveAmp;
        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;
        ${WATER_GLSL}`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          // World position of this vertex BEFORE displacement, to sample the wave.
          vec4 wpre = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            wpre = instanceMatrix * wpre;
          #endif
          wpre = modelMatrix * wpre;
          vec3 wUpV = normalize(wpre.xyz);
          vec3 tanV, bitV;
          wsTangentFrame(wUpV, tanV, bitV);
          float waveScale = 0.5; // MUST match the fragment so normals align
          vec2 wpp = vec2(dot(wpre.xyz, tanV), dot(wpre.xyz, bitV)) * waveScale;
          float hV = wsSwell(wpp, uTime * uAnimated);
          // Displace along the quad's object +Z, which instanceMatrix maps to the
          // world face normal (~local up). World-space height => seamless quads.
          transformed.z += hV * uWaveAmp;
        }`
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

    // --- Fragment: all water shading in <normal_fragment_begin>; emissive add-in
    // (reflection + SSS + glitter) applied in <emissivemap_fragment>. ---
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uReflections;
        uniform float uTime;
        uniform float uAnimated;
        uniform vec3 uSunDir;
        uniform vec3 uDeepColor;
        uniform vec3 uShallowColor;
        uniform vec3 uFoamColor;
        uniform vec3 uSSSColor;
        uniform vec3 uNightFloor;
        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;
        vec3 vWaterEmissive;
        ${WATER_GLSL}`
      )
      .replace(
        '#include <normal_fragment_begin>',
        `#include <normal_fragment_begin>
        vWaterEmissive = vec3(0.0);
        {
          float wsT = uTime * uAnimated;
          vec3 wUp = normalize(vWorldPos);
          vec3 fn = normalize(vWorldNormal);
          float topness = clamp(dot(fn, wUp), 0.0, 1.0);
          float surf = smoothstep(0.30, 0.80, topness);

          vec3 wTan, wBit;
          wsTangentFrame(wUp, wTan, wBit);
          float waveScale = 0.5;
          vec2 wp = vec2(dot(vWorldPos, wTan), dot(vWorldPos, wBit)) * waveScale;

          // Analytic normals from the swell + ripple gradients.
          float e = 0.20;
          float hC = wsSwell(wp, wsT);
          float hx = wsSwell(wp + vec2(e, 0.0), wsT) - wsSwell(wp - vec2(e, 0.0), wsT);
          float hz = wsSwell(wp + vec2(0.0, e), wsT) - wsSwell(wp - vec2(0.0, e), wsT);
          float re = 0.08;
          float rx = wsRipple(wp + vec2(re, 0.0), wsT) - wsRipple(wp - vec2(re, 0.0), wsT);
          float rz = wsRipple(wp + vec2(0.0, re), wsT) - wsRipple(wp - vec2(0.0, re), wsT);
          float swellSlope = 0.95;
          float rippleSlope = 3.2;

          vec3 rippled = normalize(
            wUp
            - wTan * (hx * swellSlope + rx * rippleSlope) * surf
            - wBit * (hz * swellSlope + rz * rippleSlope) * surf
          );
          vec3 N = normalize(mix(fn, rippled, surf));
          normal = normalize((viewMatrix * vec4(N, 0.0)).xyz);

          vec3 V = normalize(cameraPosition - vWorldPos);
          float ndv = clamp(dot(N, V), 0.0, 1.0);
          float fres = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);

          // Refracted body colour: deep looking straight down, shallow at grazing.
          float depthMix = smoothstep(0.08, 0.92, ndv);
          vec3 body = mix(uShallowColor, uDeepColor, depthMix);
          body *= 1.0 + (wsNoise(wp * 0.5 + wsT * 0.02) - 0.5) * 0.10;

          // Foam on wave crests (top faces only).
          float crest = smoothstep(0.55, 0.95, hC) * surf;
          float foam = clamp(crest * (0.6 + 0.4 * wsNoise(wp * 4.0 + wsT * 0.3)), 0.0, 1.0);
          body = mix(body, uFoamColor, foam);

          // The lit diffuse body (kept fairly dim so reflection/SSS dominate the
          // read), plus a night floor so it never goes pure black.
          diffuseColor.rgb = body + uNightFloor;
          diffuseColor.a = clamp(diffuseColor.a + fres * 0.35 + foam * 0.45, 0.0, 1.0);
          diffuseColor.a = max(diffuseColor.a, 0.82);

          // ---- Emissive ocean optics (reflection + SSS + glitter) ----
          vec3 R = reflect(-V, N);
          vec3 skyRefl = wsSkyColor(R, uSunDir, wUp);
          vec3 reflTerm = skyRefl * fres;

          // Subsurface scattering: warm-through-the-wave glow when looking toward
          // the sun across a crest. Classic translucent-ocean cue.
          float backlit = pow(clamp(dot(V, -uSunDir), 0.0, 1.0), 3.0);
          float sss = backlit * clamp(hC * 0.5 + 0.5, 0.0, 1.0) * smoothstep(-0.05, 0.25, dot(uSunDir, wUp));
          vec3 sssTerm = uSSSColor * sss * 0.9;

          // Sun glitter: tight core + ripple sparkle.
          vec3 H = normalize(uSunDir + V);
          float ndh = clamp(dot(N, H), 0.0, 1.0);
          float sparkle = clamp((abs(rx) + abs(rz)) * 6.0, 0.0, 1.0);
          float glint = pow(ndh, 600.0) * 1.4 + pow(ndh, 200.0) * sparkle * 0.5;
          vec3 glintTerm = vec3(1.0, 0.96, 0.85) * glint;

          vWaterEmissive = (reflTerm + sssTerm + glintTerm) * uReflections * surf;
        }`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += vWaterEmissive;`
      );
  };

  // Bumped so older broken/cheaper programs are never reused from cache.
  material.customProgramCacheKey = () => 'water-blocks-iq-v1';
  return material;
}

const _sunScratch = new THREE.Vector3();

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
}
