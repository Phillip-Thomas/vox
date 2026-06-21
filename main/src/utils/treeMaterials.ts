import * as THREE from 'three';
import type { GraphicsQuality } from '../config/graphicsSettings';
import type { TreeProfile } from './treeProfile';

// --- Tree materials — bark + leaves + blossoms + impostor ---------------------
//
// All four are MeshStandardMaterial + onBeforeCompile so they keep Three's full
// PBR / lighting / fog pipeline (consuming the scene lights driven by
// getSunDirection) and inject only the extra stylized effects, mirroring
// grassField.ts / waterBlocksMaterial.ts.
//
// CRITICAL (learned the hard way):
//  • NO backticks inside the GLSL template strings (breaks the JS literal).
//  • `normal` only exists from <normal_fragment_begin> onward — keep all
//    normal-dependent code (leaf SSS uses the surface normal) in that chunk.
//  • Wind bends in OBJECT space (before the instance matrix maps the tree onto
//    the planet normal) so wind works on all 6 cube faces, exactly like grass.
//  • customProgramCacheKey is CONSTANT per material kind so the compiled shader
//    is SHARED across all planets (per-planet colours are uniforms, not defines).
//
// ACES NOTE: leaf base authored L<=0.40, flower L<=0.58, SSS weighted by canopy
// depth so dense interiors don't over-brighten under Filmic tonemapping.

const BARK_COLOR = new THREE.Color(0x6b4a2f).convertSRGBToLinear(); // warm brown
// Fallback leaf colours (overridden per-planet from the TreeProfile).
const LEAF_BASE = new THREE.Color(0x4a7e26).convertSRGBToLinear();
const LEAF_TIP = new THREE.Color(0x8fc24a).convertSRGBToLinear();
const LEAF_SSS = new THREE.Color(0xb7e06a).convertSRGBToLinear();
const FLOWER_COLOR = new THREE.Color(0xff7aa8).convertSRGBToLinear();

// Shared wind helper GLSL (vertex stage, all leafy materials). instWorld keys the
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
    float gust = sin(t * 0.5 + dot(instWorld.xz, vec2(0.025))) * 0.5 + 0.5;
    float sway = sin(t * 1.1 + phase) + 0.4 * sin(t * 2.3 + phase * 1.7);
    float amp = stiff * stiff * (0.10 + 0.18 * gust);
    vec3 off;
    off.x = sway * amp;
    off.z = cos(t * 0.9 + phase * 0.8) * amp * 0.7;
    off.y = 0.0;
    off += extra * stiff;
    return off;
  }
  // small value-noise hash for edge-nibble + dither (anti-banding).
  float twHash21(vec2 p) {
    p = fract(p * vec2(123.34, 345.45));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
  }
`;

export interface TreeMaterialUniforms {
  uTime: { value: number };
  uWind: { value: number };
  uSunDir: { value: THREE.Vector3 };
}

/**
 * Bark / branch material. Brown, high roughness, hierarchical wind sway in the
 * vertex shader. Trunk top harmonizes faintly toward the planet leaf colour so
 * bark/canopy read as one tree. Per-instance tint via instanceColor works.
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
    shader.uniforms.uLeafBase = { value: LEAF_BASE.clone() };
    material.userData.shader = shader;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform float uWind;
        attribute float aStiff;
        varying float vBarkV;
        varying float vBarkU;
        varying float vBarkStiff;
        ${TREE_WIND_GLSL}`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vBarkV = transformed.y;
        vBarkU = uv.x;
        vBarkStiff = aStiff;
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
        uniform vec3 uLeafBase;
        varying float vBarkV;
        varying float vBarkU;
        varying float vBarkStiff;
        float twBHash(float n) { return fract(sin(n) * 43758.5453); }`
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        // --- procedural bark: vertical ridges running AROUND the trunk + fibrous
        //     height grain + dark crevices, so the stem reads as textured wood
        //     instead of a smooth tube. vBarkU = around (0..1), vBarkV = height. --
        float ridges = sin(vBarkU * 6.2831853 * 5.0) * 0.5 + 0.5;       // ~5 ridges
        float fiber  = sin(vBarkV * 26.0 + ridges * 3.0) * 0.5 + 0.5;   // up-fibers
        float grain  = twBHash(floor(vBarkV * 30.0) + floor(vBarkU * 7.0) * 13.0);
        float crevice = smoothstep(0.42, 0.0, ridges);                  // deep grooves
        vec3 bark = uBarkColor;
        bark *= 0.66 + 0.42 * ridges;        // ridge highlight vs groove shadow
        bark *= 0.86 + 0.20 * fiber;         // vertical fibers
        bark *= 0.82 + 0.30 * grain;         // mottled wood
        bark *= 1.0 - 0.45 * crevice;        // darken the crevices
        // young twigs harmonize faintly toward the canopy colour.
        bark = mix(bark, mix(bark, uLeafBase, 0.35), smoothstep(0.6, 1.0, vBarkStiff));
        diffuseColor.rgb *= bark;`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        // crevices are rougher than the smooth ridge crowns -> bark catches light.
        float twCrev = smoothstep(0.42, 0.0, sin(vBarkU * 6.2831853 * 5.0) * 0.5 + 0.5);
        roughnessFactor = clamp(roughnessFactor + 0.08 * twCrev - 0.04, 0.0, 1.0);`
      );
  };

  material.customProgramCacheKey = () => 'tree-bark-v4';
  return material;
}

// Shared leaf vertex injection (used by leaf + impostor; impostor passes 0 wind).
function leafVertexCommon(shader: THREE.WebGLProgramParametersWithUniforms) {
  shader.vertexShader = shader.vertexShader
    .replace(
      '#include <common>',
      `#include <common>
      uniform float uTime;
      uniform float uWind;
      attribute float aStiff;
      attribute float aPhase;
      attribute float aCanopyY;
      attribute float aFlower;
      attribute float aLeafRand;
      varying vec2 vLeafUv;
      varying float vTint;
      varying float vCanopyY;
      varying float vFlower;
      varying float vLeafRand;
      varying vec3 vWorldPos;
      ${TREE_WIND_GLSL}`
    )
    .replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vLeafUv = uv;
      vCanopyY = aCanopyY;
      vFlower = aFlower;
      vLeafRand = aLeafRand;
      #ifdef USE_INSTANCING
        vec3 twInstWorld = instanceMatrix[3].xyz;
      #else
        vec3 twInstWorld = vec3(0.0);
      #endif
      vTint = fract(sin(dot(twInstWorld, vec3(12.99, 78.23, 37.71))) * 43758.5453);
      float twT = uTime * uWind;
      vec3 flutter = vec3(
        sin(twT * 6.0 + aPhase) * 0.05,
        sin(twT * 5.0 + aPhase * 1.3) * 0.03,
        cos(twT * 6.5 + aPhase * 0.7) * 0.05
      );
      transformed += twWindOffset(transformed, aStiff, twInstWorld, twT, flutter);`
    )
    .replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      vWorldPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;`
    );
}

/**
 * Leaf material. DoubleSide, alpha-tested procedural cutout (broad/needle/frond
 * via uLeafMode). Per-planet base/tip/SSS colours, a deep-interior->crust
 * gradient + canopy AO baked in aCanopyY, hierarchical wind + flutter, per-cluster
 * flower pops (uFlowerColor*uBloom), and two-sided subsurface backlight toward the
 * sun (day) AND a faint cool moon backlight (night) so canopies aren't black after
 * dusk. Authored for ACES (depth-weighted SSS, conservative lightness).
 */
export function createLeafMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.85,
    metalness: 0.0,
    side: THREE.DoubleSide,
    alphaTest: 0.5
  });

  material.onBeforeCompile = shader => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uWind = { value: 1 };
    shader.uniforms.uSunDir = { value: new THREE.Vector3(0, 1, 0) };
    shader.uniforms.uMoonDir = { value: new THREE.Vector3(0, -1, 0) };
    shader.uniforms.uLeafBase = { value: LEAF_BASE.clone() };
    shader.uniforms.uLeafTip = { value: LEAF_TIP.clone() };
    shader.uniforms.uLeafSSS = { value: LEAF_SSS.clone() };
    shader.uniforms.uFlowerColor = { value: FLOWER_COLOR.clone() };
    shader.uniforms.uBloom = { value: 0 };
    shader.uniforms.uShapeId = { value: 0 };
    shader.uniforms.uLeafMode = { value: 0 };
    material.userData.shader = shader;

    leafVertexCommon(shader);

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uSunDir;
        uniform vec3 uMoonDir;
        uniform vec3 uLeafBase;
        uniform vec3 uLeafTip;
        uniform vec3 uLeafSSS;
        uniform vec3 uFlowerColor;
        uniform float uBloom;
        uniform float uLeafMode;
        uniform float uShapeId;
        varying vec2 vLeafUv;
        varying float vTint;
        varying float vCanopyY;
        varying float vFlower;
        varying float vLeafRand;
        varying vec3 vWorldPos;
        vec3 vLeafSSSTerm;
        float twFHash21(vec2 p) {
          p = fract(p * vec2(123.34, 345.45));
          p += dot(p, p + 34.345);
          return fract(p.x * p.y);
        }
        // --- Procedural 2D leaf-outline SDFs (literal port of tree1's IQ
        // isosceles-triangle SDF, composed into leaf silhouettes). Card space is
        // lp = vLeafUv*2-1: origin at centre, +y = tip. Negative = inside leaf.
        // True signed distance, so fwidth() AA is stable (no shimmer). -----------
        float twTri(vec2 p, vec2 q) {
          p.x = abs(p.x);
          vec2 a = p - q * clamp(dot(p, q) / dot(q, q), 0.0, 1.0);
          vec2 b = p - q * vec2(clamp(p.x / q.x, 0.0, 1.0), 1.0);
          float s = -sign(q.y);
          vec2 d = min(vec2(dot(a, a), s * (p.x * q.y - p.y * q.x)),
                       vec2(dot(b, b), s * (p.y - q.y)));
          return -sqrt(d.x) * sign(d.y);
        }
        // OVATE / broad leaf: superellipse-ish body slimmed at the petiole.
        float twLeafOvate(vec2 p) {
          float y = p.y * 0.5 + 0.5;                 // 0 base .. 1 tip
          float w = 0.60 * sin(3.14159 * clamp(y, 0.0, 1.0));
          w *= mix(0.65, 1.0, smoothstep(0.0, 0.28, y));   // slim the base
          float body = abs(p.x) - w;                 // <0 inside
          float caps = max(p.y - 0.98, -p.y - 0.98);
          return max(body, caps);
        }
        // MAPLE / palmate: central lobe + two ~35deg side lobes + serrated rim.
        float twLeafMaple(vec2 p) {
          p.y = -p.y;                                // flip so tip is +y in tri space
          float d = twTri(p - vec2(0.0, -0.55), vec2(0.42, 1.05));   // central lobe
          vec2 ps = p; ps.y -= 0.28; ps.x = abs(ps.x) - 0.40;
          float c = cos(0.62), s = sin(0.62);
          ps = mat2(c, -s, s, c) * ps;
          d = min(d, twTri(ps, vec2(0.22, 0.62)));
          float serr = (abs(fract((p.y + abs(p.x) * 2.0) * 7.0) - 0.5)) * 0.05;
          return d - serr;
        }
        // LANCEOLATE / needle blade — slim spear, fattest in the middle.
        float twLeafLance(vec2 p) {
          float y = p.y * 0.5 + 0.5;
          float w = 0.22 * sin(3.14159 * clamp(y, 0.0, 1.0)) + 0.03;
          return max(abs(p.x) - w, abs(p.y) - 0.99);
        }
        // FROND leaflet — narrow blade with pinnate (feathered) notches.
        float twLeafFrond(vec2 p) {
          float y = p.y * 0.5 + 0.5;
          float w = 0.30 * (1.0 - smoothstep(0.55, 1.0, y)) * smoothstep(0.0, 0.12, y) + 0.02;
          float d = max(abs(p.x) - w, abs(p.y) - 0.99);
          float notch = (abs(fract(y * 9.0) - 0.5)) * 0.035;
          return d + notch * step(0.06, abs(p.x));   // feathered edge
        }`
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        // ===== LEAF-SHAPED alpha cut (no more squares). Evaluate the leaf
        // outline SDF in card space and discard everything outside it. =====
        vec2 lp = vLeafUv * 2.0 - 1.0;     // origin centre, +y = tip
        float d;
        if (uLeafMode > 1.5) {
          d = twLeafFrond(lp);             // frond leaflet
        } else if (uLeafMode > 0.5) {
          d = twLeafLance(lp);             // needle / lanceolate blade
        } else {
          // broad: palmate maple for round/umbrella, ovate for weeping/wispy.
          d = (uShapeId < 0.5 || (uShapeId > 1.5 && uShapeId < 2.5))
              ? twLeafMaple(lp)
              : twLeafOvate(lp);
        }
        // per-leaf size jitter so the crown edge isn't a uniform stamp.
        d -= (vLeafRand - 0.5) * 0.05;
        // crisp cut + ~1px soft rim from the field's screen-space derivative.
        float aa = max(fwidth(d), 1e-3);   // clamp min to kill grazing shimmer
        float leafAlpha = 1.0 - smoothstep(-aa, aa, d);
        diffuseColor.a *= leafAlpha;       // alphaTest=0.5 discards the corners

        // midrib + veins + rim darkening, reusing the SAME signed field (cheap).
        float midrib = 1.0 - smoothstep(0.0, 0.035, abs(lp.x) * (0.6 + 0.4 * vLeafUv.y));
        float veins  = smoothstep(0.9, 1.0, abs(fract((lp.y - abs(lp.x)) * 6.0) - 0.5) * 2.0);
        float rim    = smoothstep(-0.18, 0.0, d);   // darker toward the cut edge
        float shade  = 1.0 - 0.18 * rim - 0.10 * veins + 0.06 * midrib;

        // Deep-interior -> sun-kissed crust gradient (aCanopyY) + per-card UV.
        float g = clamp(0.40 * vLeafUv.y + 0.45 * vCanopyY + 0.15 * vTint, 0.0, 1.0);
        g = sqrt(g); // smooth bias, avoids posterized AO steps
        vec3 leaf = mix(uLeafBase, uLeafTip, g);
        leaf *= shade;                      // midrib / veins / rim from the SDF

        // Strengthened volumetric AO: deep interior darker (undersides are
        // grounded later in normal_fragment_begin where the normal exists).
        float ao = mix(0.45, 1.0, smoothstep(0.0, 1.0, vCanopyY));
        leaf *= ao;

        // Per-tree tint (warm/cool) + per-LEAF micro variation.
        float tintWarm = (vTint - 0.5) * 0.22;
        leaf.r *= 1.0 + tintWarm;
        leaf.b *= 1.0 - tintWarm * 0.5;
        leaf *= 0.92 + 0.16 * vLeafRand;

        // Flower pop: flowering clusters tint toward the bloom colour near crust.
        float bloomMask = vFlower * uBloom * smoothstep(0.45, 0.9, vCanopyY);
        leaf = mix(leaf, uFlowerColor, bloomMask * 0.8);

        // dither to kill banding on the smooth gradient.
        leaf += (twFHash21(gl_FragCoord.xy) - 0.5) * (1.0 / 255.0);
        diffuseColor.rgb *= leaf;`
      )
      .replace(
        '#include <normal_fragment_begin>',
        `#include <normal_fragment_begin>
        // Ground the canopy undersides now that the normal exists (volumetric AO).
        diffuseColor.rgb *= mix(0.80, 1.0, clamp(normal.y * 0.5 + 0.5, 0.0, 1.0));
        vLeafSSSTerm = vec3(0.0);
        {
          vec3 V = normalize(cameraPosition - vWorldPos);
          // depth weight: crust glows, dense interior stays grounded. Capped at
          // 1.0 so the emissive backlight can't stack into an ACES white-out.
          float depthW = 0.5 + 0.5 * vCanopyY;
          // --- daytime sun backlight ---
          float backlit = pow(clamp(dot(V, -uSunDir), 0.0, 1.0), 3.0);
          float trans = clamp((abs(dot(normal, uSunDir)) + 0.4) / 1.4, 0.0, 1.0);
          float daylight = smoothstep(-0.1, 0.25, uSunDir.y);
          vLeafSSSTerm += uLeafSSS * backlit * trans * daylight * depthW * 0.8;
          // --- faint cool moon backlight at night ---
          float mback = pow(clamp(dot(V, -uMoonDir), 0.0, 1.0), 3.0);
          float mtrans = clamp((abs(dot(normal, uMoonDir)) + 0.4) / 1.4, 0.0, 1.0);
          float night = smoothstep(-0.05, 0.2, uMoonDir.y) * (1.0 - daylight);
          vLeafSSSTerm += uLeafSSS * mback * mtrans * night * depthW * 0.16;
          // --- canopy interior glow / fake multi-scatter (port of tree1's soft
          //     light-through-leaves). Daylight-gated + capped so alien canopies
          //     don't over-warm into a white-out under ACES. ---
          float interior = 1.0 - vCanopyY;            // deep interior glows
          float sunWrap  = pow(clamp(dot(normal, uSunDir) * 0.5 + 0.5, 0.0, 1.0), 1.5);
          vLeafSSSTerm += uLeafSSS * interior * sunWrap * daylight * 0.22;
        }`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += vLeafSSSTerm;`
      );
  };

  material.customProgramCacheKey = () => 'tree-leaf-v3';
  return material;
}

/**
 * Blossom material. Small alpha-tested 5-petal flower cards, vivid uFlowerColor,
 * gentle wind, faint emissive pop so blooms read at distance. Mounted only when
 * the planet's bloomAmount > 0.
 */
export function createBlossomMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.7,
    metalness: 0.0,
    side: THREE.DoubleSide,
    alphaTest: 0.5
  });

  material.onBeforeCompile = shader => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uWind = { value: 1 };
    shader.uniforms.uFlowerColor = { value: FLOWER_COLOR.clone() };
    material.userData.shader = shader;

    leafVertexCommon(shader);

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uFlowerColor;
        varying vec2 vLeafUv;
        varying float vTint;
        varying float vCanopyY;
        varying float vFlower;
        varying vec3 vWorldPos;`
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        // 5-petal flower alpha from polar UV, fwidth-cut for a crisp edge.
        vec2 fp = vLeafUv * 2.0 - 1.0;
        float ang = atan(fp.y, fp.x);
        float rad = length(fp);
        float petals = 0.62 + 0.28 * cos(ang * 5.0);
        float fd = rad - petals;                 // <0 inside the flower
        float faa = max(fwidth(fd), 1e-3);
        float flowerAlpha = 1.0 - smoothstep(-faa, faa, fd);
        diffuseColor.a *= flowerAlpha;
        // bright centre, saturated petals + a small stamen dot.
        float centre = 1.0 - smoothstep(0.0, 0.28, rad);
        float stamen = 1.0 - smoothstep(0.08, 0.14, rad);
        vec3 col = mix(uFlowerColor, uFlowerColor * 1.6, centre);
        col = mix(col, vec3(1.0, 0.92, 0.55), stamen * 0.7);  // warm pollen centre
        col *= 0.92 + vTint * 0.16;
        diffuseColor.rgb *= col;`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        // faint self-pop so blossoms read against the canopy.
        totalEmissiveRadiance += uFlowerColor * 0.12;`
      );
  };

  material.customProgramCacheKey = () => 'tree-blossom-v3';
  return material;
}

/**
 * Impostor material — a stripped leaf shader for the 2-quad cross billboard used
 * at distance. Same per-planet colours so the LOD swap is colour-matched; no
 * fancy SSS (far away). Wind frozen by passing uWind 0 from TreeField.
 */
export function createImpostorMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.9,
    metalness: 0.0,
    side: THREE.DoubleSide,
    alphaTest: 0.4
  });

  material.onBeforeCompile = shader => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uWind = { value: 0 };
    shader.uniforms.uLeafBase = { value: LEAF_BASE.clone() };
    shader.uniforms.uLeafTip = { value: LEAF_TIP.clone() };
    material.userData.shader = shader;

    leafVertexCommon(shader);

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uLeafBase;
        uniform vec3 uLeafTip;
        varying vec2 vLeafUv;
        varying float vTint;
        varying float vCanopyY;
        varying float vFlower;
        varying vec3 vWorldPos;
        float twIHash21(vec2 p) {
          p = fract(p * vec2(123.34, 345.45));
          p += dot(p, p + 34.345);
          return fract(p.x * p.y);
        }`
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        // soft blobby crown silhouette with a nibbled edge, fwidth-cut.
        vec2 lp = vLeafUv * 2.0 - 1.0;
        float r = length(vec2(lp.x, lp.y * 1.1));
        float nibble = (twIHash21(floor(vLeafUv * 6.0)) - 0.5) * 0.22;
        float id = r - (0.9 + nibble);          // <0 inside the crown blob
        float iaa = max(fwidth(id), 1e-3);
        float a = 1.0 - smoothstep(-iaa, iaa, id);
        diffuseColor.a *= a;
        float g = sqrt(clamp(vCanopyY, 0.0, 1.0));
        vec3 leaf = mix(uLeafBase, uLeafTip, g) * (0.7 + 0.3 * g);
        leaf *= 0.9 + vTint * 0.2;
        diffuseColor.rgb *= leaf;`
      );
  };

  material.customProgramCacheKey = () => 'tree-impostor-v3';
  return material;
}

const _sun = new THREE.Vector3();
const _moon = new THREE.Vector3();

type ShaderHolder = {
  userData: { shader?: { uniforms?: Record<string, { value: unknown }> } };
};

/**
 * Push per-planet COLOURS from the profile into all four tree materials ONCE
 * (call after mount). Colours are uniforms, not defines, so shaders stay shared.
 */
export function applyTreeProfileToMaterials(
  profile: TreeProfile,
  bark: THREE.MeshStandardMaterial,
  leaf: THREE.MeshStandardMaterial,
  blossom: THREE.MeshStandardMaterial | null,
  impostor: THREE.MeshStandardMaterial | null
): void {
  const set = (mat: ShaderHolder | null, key: string, value: unknown) => {
    const u = mat?.userData.shader?.uniforms;
    if (u && u[key]) u[key].value = value;
  };

  set(bark, 'uLeafBase', profile.leafColor);

  set(leaf, 'uLeafBase', profile.leafColor);
  set(leaf, 'uLeafTip', profile.leafTipColor);
  set(leaf, 'uLeafSSS', profile.leafSSSColor);
  set(leaf, 'uFlowerColor', profile.flowerColor);
  set(leaf, 'uBloom', profile.bloomAmount);
  set(leaf, 'uShapeId', profile.shapeId);
  set(leaf, 'uLeafMode', profile.leafMode);

  set(blossom, 'uFlowerColor', profile.flowerColor);

  set(impostor, 'uLeafBase', profile.leafColor);
  set(impostor, 'uLeafTip', profile.leafTipColor);
}

/** Push uTime / wind gating / sun+moon direction into all tree materials. */
export function updateTreeMaterials(
  bark: THREE.MeshStandardMaterial,
  leaf: THREE.MeshStandardMaterial,
  blossom: THREE.MeshStandardMaterial | null,
  _impostor: THREE.MeshStandardMaterial | null,
  time: number,
  sunDir: THREE.Vector3,
  moonDir: THREE.Vector3,
  quality: GraphicsQuality
) {
  const animated = quality.animatedShaders;
  _sun.copy(sunDir).normalize();
  _moon.copy(moonDir).normalize();

  const pushTimeWind = (mat: ShaderHolder | null) => {
    const u = mat?.userData.shader?.uniforms;
    if (!u) return;
    if (u.uTime && animated) (u.uTime.value as number) = time;
    if (u.uWind) (u.uWind.value as number) = animated ? 1 : 0;
  };

  pushTimeWind(bark as unknown as ShaderHolder);
  pushTimeWind(leaf as unknown as ShaderHolder);
  pushTimeWind(blossom as unknown as ShaderHolder | null);
  // impostor wind stays frozen (created with uWind 0).

  const leafU = (leaf as unknown as ShaderHolder).userData.shader?.uniforms;
  if (leafU) {
    if (leafU.uSunDir) (leafU.uSunDir.value as THREE.Vector3).copy(_sun);
    if (leafU.uMoonDir) (leafU.uMoonDir.value as THREE.Vector3).copy(_moon);
  }
}
