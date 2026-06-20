import * as THREE from 'three';
import type { GraphicsQuality } from '../config/graphicsSettings';

// --- Water material v2 — stylized spherical Gerstner ocean -------------------
//
// Rewritten after a 4-reviewer adversarial audit. Key decisions (all to fix
// proven bugs in v1):
//
// • EVERYTHING is a continuous function of WORLD position. The wave field is a
//   sum of 3D directional sines of worldPos (NO tangent-frame projection), and
//   vertices are displaced along `up = normalize(worldPos)` (+ a horizontal
//   "choppy" Gerstner pinch along the tangential gradient). Because the
//   displacement is a pure function of worldPos, two quads sharing a world-space
//   vertex — even across cube-face edges — get the IDENTICAL displacement vector,
//   so the sheet never tears and there is no pole/ref seam (v1 had both).
// • The shading normal is the ANALYTIC gradient of the displaced height, using
//   the SAME `uWaveAmp` the vertex uses — so lighting matches geometry exactly
//   (v1's normal was ~1.69x too steep and decoupled from amplitude).
// • UNLIT composition: diffuseColor.rgb is driven to 0 and the final look is
//   composed by hand as mix(refractedBody, reflectedSky, Fresnel) + SSS + glint,
//   routed through emissive — so we don't double-count Three's diffuse+GGX on top
//   of our reflection (v1 stacked them → over-bright, ACES grey-out, bloom).
// • Stylized (Sea-of-Thieves) look: crest-driven color ramp, steepness-driven
//   foam, broken (ripple-jittered) procedural sky reflection, streaked sun glint.
// • Perf: analytic derivatives (no 5x finite-difference), exp() sun disk (no
//   pow(x,600)), FrontSide, distance LOD on the ripple detail.
//
// COMPILE NOTE: all normal-dependent shading lives in <normal_fragment_begin>
// (first chunk where `normal` exists); the emissive add-in lives in
// <emissivemap_fragment> (runs after). Never reference `normal` in <map_fragment>.
// Never put backticks inside the GLSL template strings.

const DEEP_WATER = new THREE.Color(0x0a3550).convertSRGBToLinear();
const SHALLOW_WATER = new THREE.Color(0x2bb6c8).convertSRGBToLinear();
const FOAM_COLOR = new THREE.Color(0xeef7ff).convertSRGBToLinear();
const SSS_COLOR = new THREE.Color(0x33b88f).convertSRGBToLinear();
const NIGHT_FLOOR = new THREE.Color(0x05222f).convertSRGBToLinear();

// Shared GLSL (injected into BOTH stages). highp for stable sin() at world coords.
const WATER_GLSL = /* glsl */ `
  precision highp float;

  float wsHash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  // --- Swell: 5 vertical-displacement 3D directional sines (world space) ------
  // Wave vectors K (direction*frequency). |K| ~ 2*pi/wavelength. On a radius-50
  // planet these wavelengths (~9..30 world units) read as open-ocean swell.
  const int WS_SWELL = 5;
  const vec3  WS_K[5]  = vec3[5](
    vec3( 0.27,  0.05,  0.10),
    vec3(-0.09,  0.07,  0.33),
    vec3( 0.21, -0.06, -0.30),
    vec3(-0.34, -0.04,  0.14),
    vec3( 0.12,  0.31, -0.06)
  );
  const float WS_A[5]  = float[5](1.00, 0.62, 0.42, 0.28, 0.18);
  const float WS_SP[5] = float[5](0.55, 0.70, 0.92, 1.15, 1.40);

  // --- Detail: 4 higher-frequency sines used for NORMAL detail only -----------
  const int WS_DET = 4;
  const vec3  WD_K[4]  = vec3[4](
    vec3( 0.95,  0.10,  0.55),
    vec3(-0.70,  0.20,  1.05),
    vec3( 1.30, -0.15, -0.60),
    vec3(-0.40,  0.05,  1.60)
  );
  const float WD_A[4]  = float[4](0.16, 0.12, 0.09, 0.07);
  const float WD_SP[4] = float[4](2.1, 2.7, 3.3, 4.0);

  // Swell height + its analytic 3D gradient (dHeight/dWorldPos).
  void wsSwell(vec3 P, float t, out float h, out vec3 grad) {
    h = 0.0; grad = vec3(0.0);
    for (int i = 0; i < WS_SWELL; i++) {
      vec3 K = WS_K[i];
      float ph = dot(P, K) + t * WS_SP[i];
      float a = WS_A[i];
      h    += a * sin(ph);
      grad += a * cos(ph) * K;     // exact derivative — matches displacement
    }
    h *= 0.42; grad *= 0.42;
  }

  // Detail gradient only (no displacement); faded by lod (1 near, 0 far).
  vec3 wsDetailGrad(vec3 P, float t, float lod) {
    vec3 grad = vec3(0.0);
    for (int i = 0; i < WS_DET; i++) {
      vec3 K = WD_K[i];
      float ph = dot(P, K) + t * WD_SP[i];
      grad += WD_A[i] * cos(ph) * K;
    }
    return grad * lod;
  }

  // Tangential component of a gradient (project out the radial part).
  vec3 wsTangential(vec3 grad, vec3 up) { return grad - up * dot(grad, up); }

  // Procedural reflected sky for reflection ray rd. Horizon->zenith gradient with
  // a horizon haze band + a soft exp() sun disk/glow; dims to night, warms at
  // sunset. Linear-space (authored as linear, NOT sRGB).
  vec3 wsSkyColor(vec3 rd, vec3 sunDir, vec3 up) {
    float elev = dot(sunDir, up);
    float daylight = smoothstep(-0.18, 0.22, elev);
    float h = clamp(dot(rd, up) * 0.5 + 0.5, 0.0, 1.0);
    vec3 zenithDay   = vec3(0.05, 0.20, 0.48);
    vec3 horizonDay  = vec3(0.42, 0.60, 0.80);
    vec3 zenithNight = vec3(0.004, 0.010, 0.028);
    vec3 horizonNight= vec3(0.018, 0.032, 0.062);
    vec3 zenith  = mix(zenithNight, zenithDay, daylight);
    vec3 horizon = mix(horizonNight, horizonDay, daylight);
    vec3 sky = mix(horizon, zenith, pow(h, 0.55));
    // horizon haze band sells outdoor scale
    sky += vec3(0.10, 0.13, 0.16) * daylight * (1.0 - smoothstep(0.0, 0.18, abs(h - 0.5)));
    // sun: soft glow + tight disk via exp (cheap, no pow(x,600) precision cliff)
    float sd = max(dot(rd, sunDir), 0.0);
    vec3 sunWarm = vec3(1.0, 0.45, 0.18);
    vec3 sunHigh = vec3(1.0, 0.96, 0.88);
    vec3 sunCol = mix(sunWarm, sunHigh, smoothstep(0.0, 0.35, elev));
    float glow = exp((sd - 1.0) * 14.0) * 0.5;
    float disk = exp((sd - 1.0) * 1400.0) * 4.0;
    sky += sunCol * (glow + disk) * daylight;
    return sky;
  }
`;

export interface WaterBlocksUniforms {
  uTime: { value: number };
  uAnimated: { value: number };
  uReflections: { value: number };
  uSunDir: { value: THREE.Vector3 };
  uWaveAmp: { value: number };
  uChoppy: { value: number };
  uDeepColor: { value: THREE.Color };
  uShallowColor: { value: THREE.Color };
  uFoamColor: { value: THREE.Color };
  uSSSColor: { value: THREE.Color };
  uNightFloor: { value: THREE.Color };
}

export function createWaterBlocksMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: 0x000000,
    // High roughness + 0 metal/env: Three's lit path contributes ~nothing; the
    // whole ocean look is our procedural emissive (unlit composition).
    roughness: 0.9,
    metalness: 0.0,
    transparent: true,
    opacity: 1.0,
    depthWrite: false,
    side: THREE.FrontSide,
    envMapIntensity: 0.0
  });

  material.onBeforeCompile = shader => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uAnimated = { value: 1 };
    shader.uniforms.uReflections = { value: 1 };
    shader.uniforms.uSunDir = { value: new THREE.Vector3(0, 1, 0) };
    shader.uniforms.uWaveAmp = { value: 0.7 };
    shader.uniforms.uChoppy = { value: 0.6 };
    shader.uniforms.uDeepColor = { value: DEEP_WATER.clone() };
    shader.uniforms.uShallowColor = { value: SHALLOW_WATER.clone() };
    shader.uniforms.uFoamColor = { value: FOAM_COLOR.clone() };
    shader.uniforms.uSSSColor = { value: SSS_COLOR.clone() };
    shader.uniforms.uNightFloor = { value: NIGHT_FLOOR.clone() };
    material.userData.shader = shader;

    // ---------------- VERTEX: world-space Gerstner displacement ----------------
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform float uAnimated;
        uniform float uWaveAmp;
        uniform float uChoppy;
        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;
        ${WATER_GLSL}`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          mat4 wsMW = modelMatrix * instanceMatrix;        // instanced world xform
          vec3 wsP = (wsMW * vec4(transformed, 1.0)).xyz;
          vec3 wsUp = normalize(wsP + 1e-5);
          float wsH; vec3 wsGrad;
          wsSwell(wsP, uTime * uAnimated, wsH, wsGrad);
          vec3 wsGt = wsTangential(wsGrad, wsUp);
          // vertical lift along up + horizontal pinch toward crests (-tangential
          // gradient) for Gerstner choppiness. Pure function of world pos -> welds.
          vec3 dispWorld = wsUp * (wsH * uWaveAmp) - wsGt * (uChoppy * uWaveAmp);
          // back into object space (instanceMatrix/modelMatrix are rigid -> transpose = inverse-rotation)
          transformed += transpose(mat3(wsMW)) * dispWorld;
        }`
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vWorldPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;`
      )
      .replace(
        '#include <defaultnormal_vertex>',
        `#include <defaultnormal_vertex>
        vec3 wsObjN = objectNormal;
        #ifdef USE_INSTANCING
          wsObjN = mat3(instanceMatrix) * wsObjN;
        #endif
        vWorldNormal = normalize(mat3(modelMatrix) * wsObjN);`
      );

    // ---------------- FRAGMENT: analytic normal + unlit composition ------------
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uReflections;
        uniform float uTime;
        uniform float uAnimated;
        uniform float uWaveAmp;
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
          vec3 P = vWorldPos;
          vec3 up = normalize(P + 1e-5);
          vec3 fnrm = normalize(vWorldNormal);
          float topness = clamp(dot(fnrm, up), 0.0, 1.0);
          float surf = smoothstep(0.30, 0.80, topness);

          // Distance LOD: fade fine ripple detail (anti-alias + perf) far out.
          float dist = length(cameraPosition - P);
          float lod = 1.0 - smoothstep(35.0, 90.0, dist);

          // Swell height + analytic gradient (matched to the vertex amplitude).
          float h; vec3 grad;
          wsSwell(P, wsT, h, grad);
          vec3 gtSwell = wsTangential(grad, up);
          vec3 gtDetail = wsTangential(wsDetailGrad(P, wsT, lod), up);

          // True surface normal of the displaced height field (amplitude-exact):
          // tilt up by the tangential slope = uWaveAmp * tangentialGradient.
          vec3 N = normalize(up - (gtSwell + gtDetail) * uWaveAmp * surf);
          normal = normalize((viewMatrix * vec4(N, 0.0)).xyz);

          vec3 V = normalize(cameraPosition - P);
          float ndv = clamp(dot(N, V), 0.0, 1.0);
          float fres = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);

          // --- Refracted body: crest-driven color ramp (stylized SoT) ---
          float crestShade = smoothstep(-0.25, 0.30, h);           // trough->crest
          vec3 refracted = mix(uDeepColor, uShallowColor, crestShade);
          // steepness-driven foam: whitecaps only where the surface is steep
          float steep = length(gtSwell) * uWaveAmp;
          float foam = smoothstep(0.28, 0.62, steep) * surf;
          foam *= 0.6 + 0.4 * wsHash21(floor(P.xz * 3.0) + floor(P.yz));
          refracted = mix(refracted, uFoamColor, clamp(foam, 0.0, 1.0));

          // --- Reflected sky: jitter reflection ray by ripple slope (break mirror) ---
          vec3 R = reflect(-V, N);
          R = normalize(R - gtDetail * 1.5);
          vec3 reflected = wsSkyColor(R, uSunDir, up);

          // --- Subsurface scattering: warm glow through back-lit crests ---
          vec3 Lup = normalize(uSunDir + up * 0.5);
          float backlit = pow(clamp(dot(V, -Lup), 0.0, 1.0), 4.0);
          float wrap = clamp((dot(N, uSunDir) + 0.3) / 1.3, 0.0, 1.0);
          float thick = clamp(h * 0.5 + 0.5, 0.0, 1.0);
          float sss = backlit * wrap * thick * smoothstep(-0.05, 0.25, dot(uSunDir, up));
          vec3 sssTerm = uSSSColor * sss * 1.1;

          // --- Sun glitter: anisotropic streak + ripple sparkle, band-limited ---
          vec3 H = normalize(uSunDir + V);
          float ndh = clamp(dot(N, H), 0.0, 1.0);
          float spec = exp((ndh - 1.0) * 120.0);                   // soft core (exp, not pow600)
          float sparkleAmt = clamp(length(gtDetail) * uWaveAmp * 3.0, 0.0, 1.0);
          float glint = (spec * 1.6 + exp((ndh - 1.0) * 600.0) * sparkleAmt) * lod;
          vec3 glintTerm = vec3(1.0, 0.96, 0.85) * glint;

          // --- Unlit composition: Fresnel-partitioned, routed through emissive ---
          vec3 col = mix(refracted, reflected, fres * uReflections)
                   + (sssTerm + glintTerm) * uReflections
                   + uNightFloor;
          vWaterEmissive = col;
          diffuseColor.rgb = vec3(0.0);    // kill Three's lit path (no double count)

          // Fresnel-driven alpha: see-through looking down, opaque at grazing; foam opaque.
          float alpha = mix(0.55, 0.97, fres);
          alpha = max(alpha, clamp(foam, 0.0, 1.0));
          diffuseColor.a = alpha;
        }`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += vWaterEmissive;`
      );
  };

  material.customProgramCacheKey = () => 'water-blocks-iq-v2';
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
