import * as THREE from 'three';

// =============================================================================
// COCKPIT SURFACE SHADING — one material for the whole Kestrel flight deck.
//
// The cockpit used to be flat-shaded `meshStandardMaterial` over merged boxes,
// which reads as untextured blocking: large unbroken fields of one value, no
// contact darkening, no sense of manufacture. This module replaces that with a
// single custom shader that recovers the things a AAA interior actually gets
// from authored maps — panel breakup, seams, fasteners, wear, grime, contact
// occlusion, and directional practical lighting — WITHOUT any texture fetch,
// extra draw call, or post pass.
//
// The whole thing rests on one structural fact: the cockpit is a CHILD OF THE
// FLIGHT CAMERA. Its object space is therefore a fixed, known frame with the
// pilot's eye at the origin. That means:
//
//   * view vector  = normalize(-position)          (no camera uniform)
//   * light rig    = constants in object space     (no three.js lights, no
//                                                   lights loop, no shadows)
//   * detail projection is stable                  (triplanar in object space
//                                                   never swims, because the
//                                                   geometry never moves)
//
// So the fragment cost is a fixed ~4 analytic lights + procedural detail, with
// none of the uniform/branch overhead a MeshStandardMaterial pays. It renders
// cheaper than what it replaces while carrying far more information.
//
// Per-vertex authoring channel (`aSurf`), written by shipDesign's `paint()`:
//   x = material id (SURFACE_* below)
//   y = baked ambient occlusion, 0 = fully occluded .. 1 = open
//   z = per-part variation seed, 0..1 (breaks up repeated parts)
//   w = detail scale — object-space frequency of panels/seams on this part
// =============================================================================

/** Matte composite cabin panel: the default hull liner. */
export const SURFACE_COMPOSITE = 0;
/** Brushed structural metal: frame beams, hinges, ribs. */
export const SURFACE_METAL = 1;
/** Dark rubberized acoustic inset / recessed void. */
export const SURFACE_INSET = 2;
/** Glossy painted accent trim. */
export const SURFACE_TRIM = 3;
/** Seat and coaming padding: matte, quilted, no seams. */
export const SURFACE_PAD = 4;

export interface CockpitSurfaceUniforms {
  uTime: { value: number };
  uBoost: { value: number };
  uAccent: { value: THREE.Color };
  uAmber: { value: THREE.Color };
  /** Colour of the light coming through the canopy (space, sky, or atmosphere). */
  uCanopy: { value: THREE.Color };
  /** Overall practical-lighting gain; dips during warp/atmosphere transitions. */
  uCabin: { value: number };
}

const SURFACE_VERTEX = /* glsl */`
  attribute vec4 aSurf;

  varying vec3 vPos;
  varying vec3 vNrm;
  varying vec3 vCol;
  varying vec4 vSurf;

  void main() {
    vPos = position;
    vNrm = normal;
    vCol = color;
    vSurf = aSurf;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Shared detail/lighting body. The fragment shader is deliberately branch-light:
// material behaviour is selected with step()/mix() weights rather than an `if`
// chain, so a quad straddling two materials never serialises.
const SURFACE_FRAGMENT = /* glsl */`
  uniform float uTime;
  uniform float uBoost;
  uniform vec3 uAccent;
  uniform vec3 uAmber;
  uniform vec3 uCanopy;
  uniform float uCabin;

  varying vec3 vPos;
  varying vec3 vNrm;
  varying vec3 vCol;
  varying vec4 vSurf;

  #include <common>
  // Neither the colorspace nor the tone-mapping helper declarations belong here.
  // three's fragment prefix already carries colorspace_pars unconditionally, and
  // carries tonemapping_pars exactly when the renderer is tone mapping. Adding
  // either by hand compiles fine under the composer (which sets NoToneMapping)
  // and then fails to compile on every tier WITHOUT the composer, where the
  // prefix supplies them — a redefinition that silently blanks the whole cabin
  // on MEDIUM and below. The tonemapping_fragment call site below is guarded
  // by TONE_MAPPING, so it is correct in both configurations.

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  // One analytic practical: a point light with inverse-square-ish falloff plus a
  // Blinn specular lobe. Four of these ARE the cabin lighting model.
  vec3 practical(vec3 p, vec3 lightPos, vec3 color, float power, float gloss,
                 vec3 N, vec3 V, float specGain) {
    vec3 d = lightPos - p;
    float r2 = max(dot(d, d), 0.04);
    vec3 L = d * inversesqrt(r2);
    float att = power / (1.0 + r2 * 0.14);
    float lambert = max(dot(N, L), 0.0);
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), gloss) * specGain;
    return color * att * (lambert + spec);
  }

  void main() {
    // Flat facets straight from the merged non-indexed geometry, then flipped to
    // face the pilot: every cabin box is a solid seen from inside, so the useful
    // normal is always the one pointing back at the eye.
    vec3 N = normalize(vNrm);
    vec3 V = normalize(-vPos);
    N = dot(N, V) < 0.0 ? -N : N;

    float matId = vSurf.x;
    float ao = vSurf.y;
    float seed = vSurf.z;
    float scale = vSurf.w;

    float isMetal = 1.0 - min(abs(matId - 1.0), 1.0);
    float isInset = 1.0 - min(abs(matId - 2.0), 1.0);
    float isTrim = 1.0 - min(abs(matId - 3.0), 1.0);
    float isPad = 1.0 - min(abs(matId - 4.0), 1.0);
    float isPanel = 1.0 - clamp(isMetal + isInset + isTrim + isPad, 0.0, 1.0);

    // ---- triplanar detail projection (object space, so it never swims) ------
    vec3 an = abs(N);
    vec2 uv = an.x > max(an.y, an.z) ? vPos.zy
            : an.y > an.z            ? vPos.xz
                                     : vPos.xy;
    uv = uv * scale + seed * 17.0;

    // ---- panel breakup: every cell is a separately-stamped plate ------------
    vec2 cell = floor(uv);
    float plate = hash21(cell);
    float plate2 = hash21(cell + 31.7);

    // Primary seams, plus a half-frequency secondary run present on only some
    // cells — a single uniform grid reads as wallpaper, an interrupted one reads
    // as panelling.
    vec2 g = abs(fract(uv) - 0.5);
    float seam = 1.0 - smoothstep(0.0, 0.055, min(g.x, g.y));
    vec2 g2 = abs(fract(uv * 0.5 + 0.25) - 0.5);
    float seam2 = (1.0 - smoothstep(0.0, 0.03, min(g2.x, g2.y))) * step(0.62, plate2);
    seam = max(seam, seam2);

    // Fasteners at plate corners on structural surfaces only.
    vec2 rivet = fract(uv) - 0.5;
    float rivetMask = (1.0 - smoothstep(0.03, 0.06, length(rivet)))
      * step(0.45, plate) * (isMetal + isPanel);

    // ---- surface grain -----------------------------------------------------
    float grain = vnoise(uv * 9.0) * 0.6 + vnoise(uv * 31.0) * 0.4;
    // Brushed anisotropy: fine directional streaks that only metal gets.
    float brushed = vnoise(vec2(uv.x * 220.0, uv.y * 3.0));
    // Woven weave for the acoustic liner and padding.
    float weave = abs(sin(uv.x * 46.0)) * abs(sin(uv.y * 46.0));

    // ---- albedo ------------------------------------------------------------
    vec3 albedo = vCol;
    // Per-plate value variation is the single biggest readability win: it turns
    // one flat field into a wall of individually finished panels.
    albedo *= 0.86 + plate * 0.28;
    albedo *= 0.9 + grain * 0.2;
    albedo = mix(albedo, albedo * (0.72 + brushed * 0.5), isMetal);
    albedo = mix(albedo, albedo * (0.82 + weave * 0.3), isInset + isPad);
    // Seams cut dark; the lip just outside them catches a highlight, which is
    // what actually sells a recess without any normal map.
    albedo *= mix(1.0, 0.42, seam * (1.0 - isPad));
    albedo *= 1.0 + rivetMask * 0.55;

    // Edge wear: paint scuffed back to bright alloy along seam lips and on
    // upward-facing ledges where hands and boots land.
    float wear = smoothstep(0.55, 1.0, plate2)
      * (smoothstep(0.25, 0.9, seam) + max(N.y, 0.0) * 0.55)
      * (1.0 - isInset) * (1.0 - isPad);
    albedo = mix(albedo, vec3(0.62, 0.64, 0.68), clamp(wear * 0.35, 0.0, 0.35));

    // Grime settles in the crevices the AO bake already found, and runs down
    // from horizontal ledges.
    float grime = (1.0 - ao) * (0.45 + 0.55 * vnoise(uv * 2.3));
    albedo *= 1.0 - grime * 0.4;

    // ---- lighting ----------------------------------------------------------
    float gloss = mix(18.0, 74.0, isMetal) + isTrim * 60.0;
    gloss = mix(gloss, 6.0, isInset + isPad);
    float specGain = mix(0.35, 1.15, isMetal) + isTrim * 0.7;
    specGain = mix(specGain, 0.04, isInset + isPad);
    // Micro-roughness modulation stops the speculars reading as plastic sheen.
    specGain *= 0.55 + grain * 0.9;

    vec3 lit = vec3(0.0);
    // Key: the canopy. A wide forward-and-up wash carrying whatever is outside.
    vec3 keyDir = normalize(vec3(0.0, 0.42, -1.0));
    vec3 H = normalize(keyDir + V);
    float keyOcclusion = 0.3 + 0.7 * ao;
    lit += uCanopy * keyOcclusion
      * (max(dot(N, keyDir), 0.0) * 2.4
         + pow(max(dot(N, H), 0.0), gloss) * specGain * 1.6);

    // Practicals: port nav rail, starboard engine rail, overhead spine, dash.
    // These four ARE the cabin: the rails are what the pilot's eye adapts to,
    // so they carry more of the exposure than the key does.
    lit += practical(vPos, vec3(-3.30, -0.72, -1.42), uAccent, 4.4, gloss, N, V, specGain);
    lit += practical(vPos, vec3( 3.30, -0.72, -1.42), uAmber,  4.4, gloss, N, V, specGain);
    lit += practical(vPos, vec3( 0.00,  1.46, -1.72), uCanopy * 0.5 + uAccent * 0.5,
                     3.2, gloss, N, V, specGain);
    lit += practical(vPos, vec3( 0.00, -0.88, -2.34), uAccent * 0.6 + uAmber * 0.4,
                     3.4, gloss, N, V, specGain);

    // Engine bloom from behind the bulkhead, driven by boost. It arrives as a
    // warm rim on aft-facing surfaces, which is what makes acceleration read
    // inside the cabin rather than only through the canopy.
    // Kept deliberately faint at rest: a constant warm rim over every grazing
    // surface tints the whole cabin, and a blue-grey cabin tinted orange reads
    // as violet, not as light. It is a boost cue, so it lives on boost.
    float rim = pow(1.0 - max(dot(N, V), 0.0), 2.6);
    // Desaturated toward white on purpose: a saturated orange rim over blue-grey
    // structure resolves as magenta, which reads as a colour error rather than
    // as the drive lighting the cabin.
    lit += mix(uAmber, vec3(1.0), 0.4) * (0.06 + uBoost * 1.35) * rim * (0.4 + 0.6 * ao);

    // Hemispheric bounce: cool from the canopy above, warm off the cabin floor.
    // Its floor is what keeps an unlit corner readable instead of pure black,
    // and the AO bake is what stops that floor from flattening the volume.
    float hemi = N.y * 0.5 + 0.5;
    // The floor half of the hemisphere is kept close to neutral. A saturated
    // warm bounce reads as violet once it lands on a blue-grey liner, and the
    // roof underside is the largest surface it hits.
    vec3 bounce = mix(vec3(0.17, 0.155, 0.145), uCanopy * 0.9 + vec3(0.10, 0.15, 0.22), hemi);
    lit += bounce * (0.22 + 0.78 * ao);

    vec3 color = albedo * lit * uCabin;

    // Self-lit trim: the accent piping stays legible even in an unlit cabin.
    color += albedo * isTrim * uAccent * 1.2;

    gl_FragColor = vec4(color, 1.0);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/**
 * The one material every solid cockpit surface uses. Callers keep the returned
 * uniforms object and drive it per frame; the material itself is stateless.
 */
export function createCockpitSurfaceMaterial(
  accent: THREE.Color,
  amber: THREE.Color
): { material: THREE.ShaderMaterial; uniforms: CockpitSurfaceUniforms } {
  const uniforms: CockpitSurfaceUniforms = {
    uTime: { value: 0 },
    uBoost: { value: 0 },
    uAccent: { value: accent.clone() },
    uAmber: { value: amber.clone() },
    uCanopy: { value: new THREE.Color(0x8fb4d8).convertSRGBToLinear() },
    uCabin: { value: 1 }
  };
  const material = new THREE.ShaderMaterial({
    uniforms: uniforms as unknown as Record<string, THREE.IUniform>,
    vertexShader: SURFACE_VERTEX,
    fragmentShader: SURFACE_FRAGMENT,
    vertexColors: true,
    // Solid enclosure: keep both sides so a clipped ledge never shows a hole.
    side: THREE.DoubleSide
  });
  return { material, uniforms };
}
