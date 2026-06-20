import * as THREE from 'three';

// --- Space sky dome (procedural deep-space: stars + nebulae + moon) ----------
//
// A large inverted sphere composited as an ADDITIVE overlay on top of the drei
// atmospheric <Sky>. Additive + night-gated means: by day it adds ~nothing (blue
// sky shows through), and at night it layers a dense starfield, colourful nebulae,
// a Milky Way band and a lit moon over the darkened atmosphere — so the stars are
// never occluded/washed by the (opaque) atmosphere dome. One extra draw call,
// pure procedural fragment math (no textures).
//
// depthTest=true + depthWrite=false: the dome sits at radius 220, so the opaque
// planet correctly occludes it (stars hidden behind terrain) while open sky shows
// the cosmos. fog=false so scene fog never tints it.

export const SPACE_DOME_RADIUS = 220;
export const SPACE_DOME_RENDER_ORDER = -1000;

/** daylight (0 night .. 1 day) -> night factor (0..1), eased. */
export function nightFactorFromDaylight(daylight: number): number {
  const n = 1 - Math.min(1, Math.max(0, daylight));
  return n * n * (3 - 2 * n);
}

/**
 * daylight (0 night .. 1 day) -> day factor (0..1), eased. Drives the faint
 * daytime celestial layer (brightest stars + a whisper of nebula over the blue
 * sky). Kept independent from uNight so the night branch is byte-for-byte the
 * same as before; this only governs the new low-strength day contribution.
 */
export function dayFactorFromDaylight(daylight: number): number {
  const d = Math.min(1, Math.max(0, daylight));
  return d * d * (3 - 2 * d);
}

export interface SpaceSkyUniforms {
  uTime: { value: number };
  uNight: { value: number };
  uDay: { value: number };
  uSunDir: { value: THREE.Vector3 };
  uMoonDir: { value: THREE.Vector3 };
}

const VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform float uNight;
  uniform float uDay;   // 0 night .. 1 day; drives the faint daytime celestial layer
  uniform vec3 uSunDir;
  uniform vec3 uMoonDir;
  varying vec3 vDir;

  // --- Daytime celestial tunables -------------------------------------------
  // A tasteful "whisper" of cosmos over the blue: only the brightest stars and a
  // very faint nebula tint, fading out near the sun and toward the bright
  // horizon. Strengths are deliberately tiny so it never greys the sky.
  #define DAY_STAR_STRENGTH   0.85  // brightest-layer star intensity by day
  #define DAY_NEBULA_STRENGTH 0.34  // nebula tint intensity by day
  #define DAY_ALPHA_GAIN      2.6   // how aggressively bright features show through
  #define DAY_MAX_ALPHA       0.85  // ceiling on the day layer's opacity

  float hash31(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }
  vec3 hash33(vec3 p) {
    p = vec3(
      dot(p, vec3(127.1, 311.7, 74.7)),
      dot(p, vec3(269.5, 183.3, 246.1)),
      dot(p, vec3(113.5, 271.9, 124.6))
    );
    return fract(sin(p) * 43758.5453);
  }
  float vnoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n000 = hash31(i + vec3(0.0, 0.0, 0.0));
    float n100 = hash31(i + vec3(1.0, 0.0, 0.0));
    float n010 = hash31(i + vec3(0.0, 1.0, 0.0));
    float n110 = hash31(i + vec3(1.0, 1.0, 0.0));
    float n001 = hash31(i + vec3(0.0, 0.0, 1.0));
    float n101 = hash31(i + vec3(1.0, 0.0, 1.0));
    float n011 = hash31(i + vec3(0.0, 1.0, 1.0));
    float n111 = hash31(i + vec3(1.0, 1.0, 1.0));
    return mix(
      mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
      mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
      f.z
    );
  }
  float fbm(vec3 p) {
    float a = 0.5;
    float s = 0.0;
    for (int i = 0; i < 5; i++) {
      s += a * vnoise(p);
      p *= 2.03;
      a *= 0.5;
    }
    return s;
  }

  // One star layer: cellularize the direction, drop a hashed star per cell.
  vec3 starLayer(vec3 dir, float cells, float density, float twinkle, float sizePow) {
    vec3 p = dir * cells;
    vec3 cell = floor(p);
    vec3 f = fract(p) - 0.5;
    vec3 rnd = hash33(cell);
    if (rnd.x > density) return vec3(0.0);
    vec2 jitter = (hash33(cell + 1.7).xy - 0.5) * 0.7;
    vec2 d = f.xy - jitter;
    float dist2 = dot(d, d) + f.z * f.z;
    float core = exp(-dist2 * sizePow);
    float bright = 0.35 + 0.65 * rnd.y;
    float tw = 0.6 + 0.4 * sin(uTime * (1.5 + rnd.z * 3.0) + rnd.y * 6.28) * twinkle;
    vec3 col;
    if (rnd.z < 0.20) col = vec3(0.62, 0.76, 1.0);      // blue-white
    else if (rnd.z > 0.84) col = vec3(1.0, 0.80, 0.58); // warm
    else col = vec3(1.0, 1.0, 0.97);                    // neutral
    return col * core * bright * tw;
  }

  vec3 rotate(vec3 v, float ang) {
    vec3 axis = normalize(vec3(0.18, 1.0, 0.12));
    float c = cos(ang);
    float s = sin(ang);
    return v * c + cross(axis, v) * s + axis * dot(axis, v) * (1.0 - c);
  }

  // Rich multi-colour nebula field: domain-warped fbm clouds with dust lanes,
  // concentrated along a Milky Way band, tinted by a slow region field so
  // different parts of the sky glow in different colours.
  vec3 nebulaField(vec3 d) {
    vec3 q = d * 2.2;
    float warp = fbm(q * 0.6 + vec3(uTime * 0.004, 0.0, 0.0));
    float base = fbm(q + warp * 1.2);
    float lanes = fbm(q * 2.7 + 5.0);
    float density = smoothstep(0.42, 0.95, base);
    density *= mix(0.45, 1.0, lanes);                 // carve dark dust lanes

    vec3 bandN = normalize(vec3(0.35, 0.25, 0.9));
    float band = 1.0 - smoothstep(0.0, 0.62, abs(dot(d, bandN)));
    density *= 0.30 + 0.95 * band;                    // brightest along the band

    float region = fbm(d * 0.9 + 12.0);
    vec3 cBlue = vec3(0.10, 0.22, 0.66);
    vec3 cMag  = vec3(0.55, 0.10, 0.48);
    vec3 cTeal = vec3(0.06, 0.42, 0.46);
    vec3 cGold = vec3(0.48, 0.32, 0.12);
    vec3 col = mix(cBlue, cMag, smoothstep(0.25, 0.55, region));
    col = mix(col, cTeal, smoothstep(0.55, 0.74, region));
    col = mix(col, cGold, smoothstep(0.80, 0.93, region));
    return col * density;
  }

  // The moon: a lit disc with maria/crater mottling + limb darkening, and a soft
  // halo. Self-lit (stylized full moon) so it is bright when up at night.
  vec3 moon(vec3 dir, vec3 moonDir) {
    float md = dot(dir, moonDir);
    vec3 halo = vec3(0.42, 0.52, 0.78) * exp((md - 1.0) * 55.0) * 0.35;
    if (md < 0.992) return halo;
    float ang = acos(clamp(md, -1.0, 1.0));
    float R = 0.072; // angular radius (~4 deg)
    float disc = 1.0 - smoothstep(R * 0.86, R, ang);
    vec3 ref = abs(moonDir.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    vec3 t = normalize(cross(ref, moonDir));
    vec3 b = cross(moonDir, t);
    vec2 uv = vec2(dot(dir, t), dot(dir, b)) / R;
    float maria = fbm(vec3(uv * 2.6, 0.0));
    float surface = mix(0.7, 1.05, maria);
    float r2 = clamp(dot(uv, uv), 0.0, 1.0);
    float limb = sqrt(max(1.0 - r2 * 0.9, 0.0));
    vec3 moonCol = vec3(0.96, 0.95, 0.86) * surface * (0.55 + 0.45 * limb);
    return moonCol * disc + halo;
  }

  // Faint daytime celestial layer: only the brightest stars + a whisper of
  // nebula, blended OVER the blue via an alpha driven by the feature luminance
  // (not a flat factor) so dim regions stay fully transparent and never grey the
  // sky. No dense dim star layers, no dark space base — pure additive-feeling
  // colour with luminance-keyed alpha. Returns premultiplied-style (col, alpha).
  vec4 dayCelestial(vec3 dir) {
    vec3 sdir = rotate(dir, uTime * 0.01);

    // Only the brightest/sparsest star layer (the top night layer), dimmed.
    vec3 color = starLayer(sdir, 80.0, 0.34, 1.0, 80.0) * DAY_STAR_STRENGTH;

    // A whisper of nebula tint (no dark base, no dust-darkening below zero).
    color += nebulaField(sdir) * DAY_NEBULA_STRENGTH;

    // Fade the celestial out toward the bright sun and the washed-out horizon so
    // the whisper only reads in the deeper-blue upper sky away from the sun.
    float sunMask = 1.0 - smoothstep(0.70, 0.98, dot(dir, normalize(uSunDir)));
    float horizon = smoothstep(-0.08, 0.22, dir.y); // dir.y is normalized vDir.y
    color *= sunMask * horizon * uDay;

    // Alpha tracks feature luminance: bright stars/nebula peek through, empty sky
    // contributes nothing (alpha 0 -> blue untouched). Ceiling keeps it subtle.
    float lum = max(color.r, max(color.g, color.b));
    float alpha = clamp(lum * DAY_ALPHA_GAIN, 0.0, DAY_MAX_ALPHA);
    return vec4(color, alpha);
  }

  void main() {
    // Day: render only the faint celestial whisper (cheap — one star layer +
    // nebula). At pure midday uDay~1 but the luminance-keyed alpha keeps it to a
    // tasteful hint; toward dusk this hands off to the night branch below.
    if (uNight < 0.01) { gl_FragColor = dayCelestial(normalize(vDir)); return; }

    vec3 dir = normalize(vDir);
    vec3 sdir = rotate(dir, uTime * 0.01); // slow celestial drift (stars/nebula)

    vec3 color = vec3(0.0);

    // Dense layered starfield (4 layers, varied size/twinkle).
    color += starLayer(sdir, 80.0, 0.34, 1.0, 80.0) * 1.5;
    color += starLayer(sdir + 11.3, 140.0, 0.24, 0.85, 110.0) * 1.1;
    color += starLayer(sdir + 27.1, 220.0, 0.15, 0.6, 150.0) * 0.8;
    color += starLayer(sdir + 53.7, 360.0, 0.10, 0.4, 200.0) * 0.55;

    // Nebulae / Milky Way.
    color += nebulaField(sdir) * 1.1;

    // Deep-space base (dark, slightly blue). This is the night backdrop the stars
    // sit on once the cosmos cross-fades in over the atmosphere.
    color += vec3(0.010, 0.013, 0.030);

    // Moon (uses the un-rotated direction; driven by uMoonDir from the controller).
    color += moon(dir, uMoonDir);

    // Normal-blend cross-fade: alpha = night. At full night the cosmos REPLACES
    // the (never-truly-black) atmosphere instead of merely adding to its grey,
    // so stars/nebula/moon read against true dark space. By day alpha=0 -> the
    // blue atmospheric sky shows through untouched.
    gl_FragColor = vec4(color, uNight);
  }
`;

export function createSpaceSkyMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uNight: { value: 1 },
      uDay: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uMoonDir: { value: new THREE.Vector3(0, -1, 0) }
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: true,        // occluded by the opaque planet, shows in open sky
    transparent: true,      // renders in the transparent pass, AFTER the opaque <Sky>
    blending: THREE.NormalBlending, // cross-fade (alpha=night) so night REPLACES the grey atmosphere
    fog: false
  });
}

const _sunScratch = new THREE.Vector3();
const _moonScratch = new THREE.Vector3();

/**
 * Push day-cycle state into the dome. `time` is frozen by the caller when
 * animation is off; sun/moon dirs are copied (the controller mutates its vectors
 * in place). Returns the resolved night factor.
 */
export function updateSpaceSky(
  material: THREE.ShaderMaterial,
  time: number,
  daylight: number,
  sunDir: THREE.Vector3,
  moonDir: THREE.Vector3
): number {
  const u = material.uniforms as unknown as SpaceSkyUniforms;
  const night = nightFactorFromDaylight(daylight);
  u.uTime.value = time;
  u.uNight.value = night;
  u.uDay.value = dayFactorFromDaylight(daylight);
  u.uSunDir.value.copy(_sunScratch.copy(sunDir).normalize());
  u.uMoonDir.value.copy(_moonScratch.copy(moonDir).normalize());
  return night;
}
