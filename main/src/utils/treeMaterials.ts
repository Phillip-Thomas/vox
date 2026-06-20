import * as THREE from 'three';
import type { GraphicsQuality } from '../config/graphicsSettings';

// --- Tree materials — bark + leaves, MeshStandardMaterial + onBeforeCompile ---
//
// Both materials keep Three's full PBR/lighting/fog pipeline and inject only the
// extra effects through onBeforeCompile, mirroring grassField.ts / waterBlocksMaterial.ts.
//
// CRITICAL (learned the hard way):
//  • NO backticks inside the GLSL template strings (breaks the JS literal).
//  • `normal` only exists from <normal_fragment_begin> onward — keep all
//    normal-dependent code (leaf SSS uses the surface normal) in that chunk.
//  • Wind bends in OBJECT space (before the instance matrix maps the tree onto
//    the planet normal) so wind works on all 6 cube faces, exactly like grass.
//
// Wind model (shared idea): bend amount = aStiff (0 root .. 1 tip) * windField,
// where windField is a low-freq gust + per-instance world-position phase. Bark
// gets a slow whole-tree sway; leaves add a high-freq per-card flutter via aPhase.

const BARK_COLOR = new THREE.Color(0x6b4a2f).convertSRGBToLinear(); // warm brown
const LEAF_BASE = new THREE.Color(0x4a7e26).convertSRGBToLinear(); // mid green, pulled toward the grass hue family (~93deg) for cohesion
const LEAF_TIP = new THREE.Color(0x8fc24a).convertSRGBToLinear(); // bright green
const LEAF_SSS = new THREE.Color(0xb7e06a).convertSRGBToLinear(); // backlit glow

// Shared wind helper GLSL (vertex stage, both materials). instWorld keys the
// phase so neighbouring trees sway out of step; uTime drives the gust.
const TREE_WIND_GLSL = /* glsl */ `
  // Returns an object-space bend offset for a vertex.
  // p          : object-space transformed position (its xz drives the sway plane)
  // stiff      : 0 at root .. 1 at tips (more flex higher up)
  // instWorld  : per-instance world position (phase key)
  // t          : time (already gated to 0 when animation is off)
  // extra      : per-vertex high-freq term (leaf flutter), vec3(0) for bark
  vec3 twWindOffset(vec3 p, float stiff, vec3 instWorld, float t, vec3 extra) {
    float phase = dot(instWorld, vec3(0.13, 0.11, 0.17));
    // travelling gust across the planet (uses world pos so gusts move), 0..1-ish
    float gust = sin(t * 0.5 + dot(instWorld.xz, vec2(0.025))) * 0.5 + 0.5;
    // whole-tree sway, two octaves
    float sway = sin(t * 1.1 + phase) + 0.4 * sin(t * 2.3 + phase * 1.7);
    float amp = stiff * stiff * (0.10 + 0.18 * gust);
    vec3 off;
    off.x = sway * amp;
    off.z = cos(t * 0.9 + phase * 0.8) * amp * 0.7;
    off.y = 0.0;
    // high-freq flutter (leaves) added on top, scaled by stiffness
    off += extra * stiff;
    return off;
  }
`;

export interface TreeMaterialUniforms {
  uTime: { value: number };
  uWind: { value: number };
  uSunDir: { value: THREE.Vector3 };
}

/**
 * Bark / branch material. Brown, high roughness, hierarchical wind sway in the
 * vertex shader (object space, magnitude scaled by aStiff). Cheap bark value
 * variation in the fragment shader. Per-instance tint via instanceColor works.
 */
export function createBarkMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: 0x6b4a2f,
    roughness: 0.95,
    metalness: 0.0
  });

  material.onBeforeCompile = shader => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uWind = { value: 1 };
    shader.uniforms.uBarkColor = { value: BARK_COLOR.clone() };
    material.userData.shader = shader;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform float uWind;
        attribute float aStiff;
        varying float vBarkV; // height-ish coord for bark shading
        ${TREE_WIND_GLSL}`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vBarkV = transformed.y;
        #ifdef USE_INSTANCING
          vec3 twInstWorld = instanceMatrix[3].xyz;
        #else
          vec3 twInstWorld = vec3(0.0);
        #endif
        transformed += twWindOffset(transformed, aStiff, twInstWorld, uTime * uWind, vec3(0.0));`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uBarkColor;
        varying float vBarkV;
        float twHash(float n) { return fract(sin(n) * 43758.5453); }`
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        // Cheap vertical bark banding: a little darker in grooves, lighter on ribs.
        float band = sin(vBarkV * 9.0) * 0.5 + 0.5;
        float grain = twHash(floor(vBarkV * 22.0));
        vec3 bark = uBarkColor * (0.82 + 0.22 * band) * (0.9 + 0.18 * grain);
        diffuseColor.rgb *= bark;`
      );
  };

  material.customProgramCacheKey = () => 'tree-bark-v1';
  return material;
}

/**
 * Leaf material. DoubleSide, alpha-tested rounded-leaf cutout computed
 * procedurally from the card UV (no texture). Green with per-tree tint
 * (instanceColor), a base->edge gradient, hierarchical wind + high-freq flutter
 * in the vertex shader, and subsurface backlight toward the sun added to
 * emissive (canopy glows when you look toward the sun through it).
 *
 * Leaf alpha: a soft rounded quad. We treat the card UV as [0,1]^2, build a
 * radial falloff from the centre, and alphaTest it to a leaf-ish blob. Documented
 * choice: procedural rounded card (cheap, no texture fetch, reads chunky/stylized).
 */
export function createLeafMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: 0x4f8a32,
    roughness: 0.85,
    metalness: 0.0,
    side: THREE.DoubleSide,
    alphaTest: 0.5
  });

  material.onBeforeCompile = shader => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uWind = { value: 1 };
    shader.uniforms.uSunDir = { value: new THREE.Vector3(0, 1, 0) };
    shader.uniforms.uLeafBase = { value: LEAF_BASE.clone() };
    shader.uniforms.uLeafTip = { value: LEAF_TIP.clone() };
    shader.uniforms.uLeafSSS = { value: LEAF_SSS.clone() };
    material.userData.shader = shader;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform float uWind;
        attribute float aStiff;
        attribute float aPhase;
        varying vec2 vLeafUv;
        varying float vTint;
        varying vec3 vWorldPos;
        ${TREE_WIND_GLSL}`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vLeafUv = uv;
        #ifdef USE_INSTANCING
          vec3 twInstWorld = instanceMatrix[3].xyz;
        #else
          vec3 twInstWorld = vec3(0.0);
        #endif
        vTint = fract(sin(dot(twInstWorld, vec3(12.99, 78.23, 37.71))) * 43758.5453);
        float t = uTime * uWind;
        // high-freq flutter, per-card phase; small object-space wiggle on x/z
        vec3 flutter = vec3(
          sin(t * 6.0 + aPhase) * 0.05,
          sin(t * 5.0 + aPhase * 1.3) * 0.03,
          cos(t * 6.5 + aPhase * 0.7) * 0.05
        );
        transformed += twWindOffset(transformed, aStiff, twInstWorld, t, flutter);`
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vWorldPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uSunDir;
        uniform vec3 uLeafBase;
        uniform vec3 uLeafTip;
        uniform vec3 uLeafSSS;
        varying vec2 vLeafUv;
        varying float vTint;
        varying vec3 vWorldPos;
        vec3 vLeafSSSTerm;`
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        // Procedural rounded-leaf alpha from the card UV: radial blob, soft edge.
        vec2 lp = vLeafUv * 2.0 - 1.0;
        // squash to a leaf-ish oval and round the corners
        float r = length(vec2(lp.x * 1.05, lp.y * 0.85));
        float leafAlpha = 1.0 - smoothstep(0.72, 0.96, r);
        diffuseColor.a *= leafAlpha;

        // base -> tip green gradient across the card, plus per-tree tint variation.
        float g = clamp(vLeafUv.y, 0.0, 1.0);
        vec3 leaf = mix(uLeafBase, uLeafTip, g);
        float tintWarm = (vTint - 0.5) * 0.28;
        leaf.r *= 1.0 + tintWarm;
        leaf.g *= 1.0 + tintWarm * 0.3;
        leaf.b *= 1.0 - tintWarm * 0.5;
        leaf *= 0.85 + vTint * 0.3; // brightness jitter per tree
        diffuseColor.rgb *= leaf;`
      )
      // SSS uses the surface normal -> must live in <normal_fragment_begin>.
      .replace(
        '#include <normal_fragment_begin>',
        `#include <normal_fragment_begin>
        vLeafSSSTerm = vec3(0.0);
        {
          vec3 V = normalize(cameraPosition - vWorldPos);
          // Backlight: glow when the view ray points toward the sun THROUGH the
          // leaf (i.e. we're on the shadow side looking at a lit back face).
          float backlit = pow(clamp(dot(V, -uSunDir), 0.0, 1.0), 3.0);
          // Wrapped transmission term using the leaf normal (front or back).
          float trans = clamp((dot(normal, uSunDir) + 0.4) / 1.4, 0.0, 1.0);
          float wrapBack = clamp((dot(-normal, uSunDir) + 0.4) / 1.4, 0.0, 1.0);
          float thru = max(trans, wrapBack);
          float daylight = smoothstep(-0.1, 0.25, uSunDir.y);
          vLeafSSSTerm = uLeafSSS * backlit * thru * daylight * 1.2;
        }`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += vLeafSSSTerm;`
      );
  };

  material.customProgramCacheKey = () => 'tree-leaf-v1';
  return material;
}

const _sun = new THREE.Vector3();

/** Push uTime / wind gating / sun direction into both tree materials. */
export function updateTreeMaterials(
  bark: THREE.MeshStandardMaterial,
  leaf: THREE.MeshStandardMaterial,
  time: number,
  sunDir: THREE.Vector3,
  quality: GraphicsQuality
) {
  const animated = quality.animatedShaders;
  _sun.copy(sunDir).normalize();

  const barkShader = bark.userData.shader as
    | { uniforms?: Record<string, { value: unknown }> }
    | undefined;
  if (barkShader?.uniforms) {
    const u = barkShader.uniforms;
    if (u.uTime && animated) (u.uTime.value as number) = time;
    if (u.uWind) (u.uWind.value as number) = animated ? 1 : 0;
  }

  const leafShader = leaf.userData.shader as
    | { uniforms?: Record<string, { value: unknown }> }
    | undefined;
  if (leafShader?.uniforms) {
    const u = leafShader.uniforms;
    if (u.uTime && animated) (u.uTime.value as number) = time;
    if (u.uWind) (u.uWind.value as number) = animated ? 1 : 0;
    if (u.uSunDir) (u.uSunDir.value as THREE.Vector3).copy(_sun);
  }
}
