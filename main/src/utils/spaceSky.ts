import * as THREE from 'three';

// --- Space sky dome (procedural starfield + nebula) -------------------------
//
// A single large inverted sphere drawn behind everything as the night backdrop.
// One extra draw call, pure procedural fragment math (no textures): a layered
// hash-based starfield with twinkle + a few colored stars, plus a low-frequency
// fbm nebula concentrated along a great-circle band so it reads as a Milky Way.
//
// Visibility is driven by a night factor (1 = full night, 0 = day) so the stars
// fade in at dusk and out at dawn. A slow time-driven rotation inside the shader
// makes the celestial sphere drift so the sky "changes over time".
//
// The dome is FrustumCulled=false / depthWrite=false / fog=false on the mesh +
// material so it surrounds the camera, never z-fights the scene, and isn't
// washed out by scene.fog. renderOrder is set very low so it draws first as the
// backmost layer.

/** World-space radius of the dome. Inside the camera far plane (planetSize*5). */
export const SPACE_DOME_RADIUS = 220;

/** Drawn before everything else so it reads as the backdrop. */
export const SPACE_DOME_RENDER_ORDER = -1000;

/**
 * Map the SkyController daylight factor (0 at night, 1 at midday) to a night
 * factor in [0,1] with a slightly eased ramp so stars linger a touch into dusk
 * and clear cleanly by full day. Pure + deterministic for unit testing.
 */
export function nightFactorFromDaylight(daylight: number): number {
  const n = 1 - Math.min(1, Math.max(0, daylight));
  // Ease-in so stars don't pop instantly at the daylight threshold.
  return n * n * (3 - 2 * n);
}

export interface SpaceSkyUniforms {
  uTime: { value: number };
  uNight: { value: number };
  uSunDir: { value: THREE.Vector3 };
}

const VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    // Direction from the dome center to this vertex; used as the sampling ray.
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform float uNight;
  uniform vec3 uSunDir;
  varying vec3 vDir;

  // --- Hash / noise helpers (cheap, texture-free) ---------------------------
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
  // 4-octave fbm for the soft nebula clouds.
  float fbm(vec3 p) {
    float a = 0.5;
    float s = 0.0;
    for (int i = 0; i < 4; i++) {
      s += a * vnoise(p);
      p *= 2.02;
      a *= 0.5;
    }
    return s;
  }

  // One layer of stars: partition the sphere direction into cells, drop one star
  // per cell with a hashed position/brightness/color and a per-star twinkle.
  vec3 starLayer(vec3 dir, float cells, float density, float twinkle) {
    vec3 p = dir * cells;
    vec3 cell = floor(p);
    vec3 f = fract(p) - 0.5;

    vec3 rnd = hash33(cell);
    // Only a fraction of cells host a star.
    if (rnd.x > density) return vec3(0.0);

    // Sub-cell jitter so stars aren't grid-aligned.
    vec2 jitter = (hash33(cell + 1.7).xy - 0.5) * 0.7;
    vec2 d = f.xy - jitter;
    float dist2 = dot(d, d) + f.z * f.z;

    // Point falloff -> a tight bright core.
    float core = exp(-dist2 * 90.0);

    // Per-star brightness and twinkle phase.
    float bright = 0.35 + 0.65 * rnd.y;
    float tw = 0.65 + 0.35 * sin(uTime * (1.5 + rnd.z * 3.0) + rnd.y * 6.28) * twinkle;

    // A few stars are faintly colored: blue-white, warm, neutral.
    vec3 col;
    if (rnd.z < 0.18) col = vec3(0.65, 0.78, 1.0);      // blue
    else if (rnd.z > 0.86) col = vec3(1.0, 0.82, 0.62); // warm
    else col = vec3(1.0, 1.0, 0.97);                    // neutral white

    return col * core * bright * tw;
  }

  // Slow rotation of the celestial sphere about a tilted axis.
  vec3 rotate(vec3 v, float ang) {
    vec3 axis = normalize(vec3(0.18, 1.0, 0.12));
    float c = cos(ang);
    float s = sin(ang);
    return v * c + cross(axis, v) * s + axis * dot(axis, v) * (1.0 - c);
  }

  void main() {
    vec3 dir = normalize(vDir);
    // Drift the sampling direction slowly over time (celestial rotation).
    vec3 sdir = rotate(dir, uTime * 0.01);

    vec3 color = vec3(0.0);

    // --- Starfield: three layers at different scales for depth ---
    color += starLayer(sdir, 90.0, 0.30, 1.0) * 1.4;
    color += starLayer(sdir + 11.3, 150.0, 0.20, 0.8) * 1.0;
    color += starLayer(sdir + 27.1, 240.0, 0.12, 0.6) * 0.7;

    // --- Nebula / Milky Way band ---
    // Distance from a great-circle plane (normal = tilted axis) -> a band.
    vec3 bandNormal = normalize(vec3(0.35, 0.25, 0.9));
    float band = 1.0 - smoothstep(0.0, 0.55, abs(dot(sdir, bandNormal)));
    // Low-frequency fbm clouds, animated very slowly.
    float clouds = fbm(sdir * 3.0 + vec3(0.0, uTime * 0.004, 0.0));
    clouds = smoothstep(0.45, 1.0, clouds);
    float neb = band * clouds;
    // Two-tone galaxy: deep blue/purple shading toward teal in the densest parts.
    vec3 nebColA = vec3(0.10, 0.06, 0.22); // deep purple-blue
    vec3 nebColB = vec3(0.05, 0.20, 0.26); // teal
    vec3 nebula = mix(nebColA, nebColB, clouds) * neb * 0.9;
    color += nebula;

    // --- Base deep-space gradient (slightly bluer near the band axis) ---
    vec3 deep = mix(vec3(0.010, 0.012, 0.030), vec3(0.020, 0.018, 0.045), band * 0.5);
    color += deep;

    // Faint warm horizon glow opposite the sun residue (cheap, tasteful).
    float horizon = pow(1.0 - abs(dir.y), 6.0);
    color += vec3(0.04, 0.03, 0.05) * horizon;

    // Fade the entire dome in/out with the night factor.
    gl_FragColor = vec4(color * uNight, 1.0);
  }
`;

/**
 * Build the dome's shader material. ShaderMaterial (not Raw) so it works cleanly
 * with three 0.160 without manually wiring projection matrices. fog disabled,
 * depthWrite off, BackSide so we see its inner surface from inside the dome.
 */
export function createSpaceSkyMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uNight: { value: 1 },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) }
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: true,
    fog: false,
    transparent: false
  });
}

const _sunScratch = new THREE.Vector3();

/**
 * Push the day-cycle state into the dome material. `time` is frozen by the
 * caller when animatedShaders is off; `sunDir` is copied (SkyController mutates
 * its vector in place). Returns the resolved night factor for convenience.
 */
export function updateSpaceSky(
  material: THREE.ShaderMaterial,
  time: number,
  daylight: number,
  sunDir: THREE.Vector3
): number {
  const u = material.uniforms as unknown as SpaceSkyUniforms;
  const night = nightFactorFromDaylight(daylight);
  u.uTime.value = time;
  u.uNight.value = night;
  u.uSunDir.value.copy(_sunScratch.copy(sunDir).normalize());
  return night;
}
