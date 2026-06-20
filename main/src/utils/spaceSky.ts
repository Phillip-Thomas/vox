import * as THREE from 'three';

// --- Unified "Cosmos-Through-Glass" sky dome --------------------------------
//
// A single inverted-sphere ShaderMaterial that is now the SOLE visible sky. It
// renders the full procedural cosmos (4-layer starfield + multi-colour nebula +
// Milky Way band + a lit moon over a deep-space base) and then composites a thin
// analytic single-scatter atmosphere ON TOP, morphed by one scalar uDay [0..1].
//
// The physical conceit: cosmos is ADDITIVE radiance multiplied by per-channel
// transmittance T, with in-scatter added on top:  color = cosmos*Tc + inscatter.
// That is what lets a bright star at radiance ~1.0, attenuated to ~0.7 at the
// zenith, still sit well above a low in-scatter floor and READ as a star by day
// (dimmer, slightly blue-shifted) instead of being washed/alpha-blended away.
//
// Night is preserved bit-for-bit: at uDay=0 the dim star layers + nebula are at
// full strength (dayKnock=1) and an early-out returns the pure cosmos with no
// scattering ALU — identical to the loved night/deep_space look.
//
// Material is now OPAQUE (transparent:false, depthWrite:true) — it is the opaque
// backdrop. renderOrder=-1000 draws it first; depthTest=true keeps the planet
// occluding the lower hemisphere. toneMapped stays true so the authored-low
// linear in-scatter gets the same ACES curve as the rest of the scene.

export const SPACE_DOME_RADIUS = 220;
export const SPACE_DOME_RENDER_ORDER = -1000;

/**
 * daylight (0 night .. 1 day) -> day factor (0..1), eased. This is the single
 * master "how much atmosphere vs how much cosmos" scalar fed to uDay. Continuous
 * (smoothstep) so dusk->night is pop-free across the uDay<0.01 early-out.
 */
export function dayFactorFromDaylight(daylight: number): number {
  const d = Math.min(1, Math.max(0, daylight));
  return d * d * (3 - 2 * d);
}

export interface SpaceSkyUniforms {
  uTime: { value: number };
  uDay: { value: number };
  uGolden: { value: number };
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
  uniform float uDay;     // 0 night .. 1 day; master atmosphere/cosmos morph
  uniform float uGolden;  // 0..1 golden-hour factor (warms horizon + sun halo)
  uniform vec3 uSunDir;
  uniform vec3 uMoonDir;
  varying vec3 vDir;

  // --- Day atmosphere tunables ----------------------------------------------
  #define DAY_ZENITH_TAU      1.0   // peak optical depth scale (more atmosphere presence by day)
  #define DAY_STAR_GAIN       0.40  // dim star layers + nebula scaled to this by full day
  #define DAY_COSMOS_DIM      0.55  // global cosmos dim applied by full day (stars clearly fainter)
  #define DAY_INSCATTER_GAIN  26.0  // sky luminance decoupled from the (thin) optical depth so the
                                    // day sky reads as a real luminous blue, not ~0 under ACES
  #define MOON_DAY_DIM        0.30  // daytime moon brightness vs full night
  #define MIE_G               0.80
  #define THIN_ZENITH         0.16  // thin-shell base air-mass at zenith (some atmosphere overhead too)
  #define THIN_HORIZON        0.30  // limb pile-up strength

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

  // --- Analytic single-scatter atmosphere -----------------------------------
  // IQ-grade phase functions.
  float phaseR(float mu) { return 0.05968310365 * (1.0 + mu * mu); }           // 3/(16pi)
  float phaseM(float mu, float g) {
    float g2 = g * g;
    float d = 1.0 + g2 - 2.0 * g * mu;
    return 0.0795774715 * (1.0 - g2) / (d * sqrt(max(d, 1e-4)));               // 1/(4pi) * HG
  }

  // Thin-shell analytic air-mass: tiny at zenith, blows up toward the limb.
  float airMass(float cy) { float c = max(cy, -0.05); return THIN_ZENITH + THIN_HORIZON / (c + 0.09); }

  // Returns LOW-radiance in-scatter + per-channel cosmos transmittance.
  void atmosphere(vec3 d, vec3 s, float day, float golden, out vec3 inscatter, out vec3 T) {
    float mu  = dot(d, s);
    float am  = airMass(d.y);
    // blue base Rayleigh tint -> warm at golden hour
    vec3  kR  = mix(vec3(0.045, 0.110, 0.280), vec3(0.260, 0.130, 0.075), golden);
    vec3  kM  = vec3(1.0, 0.85, 0.62);
    vec3  tauR = kR * (DAY_ZENITH_TAU * am * day);   // colored optical depth (blue thickest)
    float tauM = DAY_ZENITH_TAU * 0.10 * am * day;
    float sunUp = smoothstep(-0.10, 0.18, s.y);      // drains in-scatter at night/twilight
    vec3  isR = kR * phaseR(mu)        * (1.0 - exp(-tauR)) * sunUp;
    vec3  isM = kM * phaseM(mu, MIE_G) * (1.0 - exp(-vec3(tauM))) * sunUp;
    // Twilight horizon airglow, gated by sunUp so it tracks the day rather than
    // sitting as an always-on band on the anti-sun horizon.
    vec3  airglow = vec3(0.20, 0.34, 0.66) * smoothstep(0.30, -0.05, d.y) * day * sunUp * 0.20;
    // Sky luminance is decoupled from the thin optical depth (×GAIN) so the day
    // sky is a perceptible luminous blue under ACES instead of ~0.001 linear.
    inscatter = (isR + isM) * DAY_INSCATTER_GAIN + airglow;
    T = exp(-(tauR + vec3(tauM)));                    // per-channel: blue dimmed most
  }

  // 1/255 hash dither (kills banding in the smooth day gradient under ACES).
  float dither(vec3 dir) { return (hash31(dir * 937.0) - 0.5) / 255.0; }

  void main() {
    vec3 dir  = normalize(vDir);
    vec3 sdir = rotate(dir, uTime * 0.01); // slow celestial drift (stars/nebula)

    // ---- COSMOS (night math; dim layers knocked down by day) ----
    float dayKnock = mix(1.0, DAY_STAR_GAIN, uDay);
    vec3 cosmos  = starLayer(sdir,        80.0, 0.34, 1.0,  80.0) * 1.5;            // brightest: full
    cosmos += starLayer(sdir + 11.3, 140.0, 0.24, 0.85, 110.0) * 1.1  * dayKnock;   // dimmer: knock down
    cosmos += starLayer(sdir + 27.1, 220.0, 0.15, 0.6,  150.0) * 0.8  * dayKnock;
    cosmos += starLayer(sdir + 53.7, 360.0, 0.10, 0.4,  200.0) * 0.55 * dayKnock;
    cosmos += nebulaField(sdir) * 1.1 * dayKnock;
    cosmos += vec3(0.010, 0.013, 0.030);                                           // deep-space base
    // Moon kept separate so the per-channel horizon transmittance doesn't redden it.
    vec3 moonCol = moon(dir, uMoonDir);

    // ---- NIGHT / DEEP-SPACE: byte-identical, no scattering ALU ----
    if (uDay < 0.01) { gl_FragColor = vec4(cosmos + moonCol, 1.0); return; }

    // ---- DAY: thin scattering over surviving cosmos ----
    vec3 s = normalize(uSunDir);
    vec3 inscatter, T;
    atmosphere(dir, s, uDay, uGolden, inscatter, T);

    float mu        = dot(dir, s);
    float sunGlow   = smoothstep(0.92, 1.0, mu);            // suppress cosmos near sun
    float horizGlow = smoothstep(0.30, -0.05, dir.y);       // and near the bright limb
    // Cosmos is attenuated by the transmittance EVERYWHERE by day (so the whole
    // sky reads as "cosmos seen through atmosphere", not bare night), with EXTRA
    // local wash where a real sky blows out: near the sun and the bright limb.
    vec3  Tc = mix(vec3(1.0), T, uDay);
    float localWash = uDay * max(sunGlow, horizGlow);
    Tc *= (1.0 - 0.92 * localWash);

    vec3 dayCosmos = cosmos * mix(1.0, DAY_COSMOS_DIM, uDay);

    // Visible sun: tight disc + a broad, soft aureole (replaces drei's sun).
    // Gaussian falloff so ACES rolls into white gracefully rather than a hard step.
    float disc    = smoothstep(0.99955, 0.99988, mu);
    float aureole = pow(sunGlow, 2.0) * 0.45 + exp((mu - 1.0) * 110.0) * 0.9;
    vec3  sun  = (vec3(1.0, 0.93, 0.80) * disc * 5.0
               + vec3(1.0, 0.84, 0.60) * aureole) * smoothstep(-0.05, 0.10, s.y);

    vec3 color = dayCosmos * Tc + inscatter + sun + moonCol * mix(1.0, MOON_DAY_DIM, uDay);
    color += dither(dir);
    gl_FragColor = vec4(color, 1.0);
  }
`;

export function createSpaceSkyMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uDay: { value: 0 },
      uGolden: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uMoonDir: { value: new THREE.Vector3(0, -1, 0) }
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: THREE.BackSide,
    depthWrite: true,       // opaque backdrop now: writes depth so it is the far wall
    depthTest: true,        // occluded by the opaque planet, shows in open sky
    transparent: false,     // opaque pass; renderOrder -1000 draws it first
    fog: false
    // toneMapped left at default (true) so ACES applies to the authored-low values.
  });
}

const _sunScratch = new THREE.Vector3();
const _moonScratch = new THREE.Vector3();

/**
 * Push day-cycle state into the dome. `time` is frozen by the caller when
 * animation is off; sun/moon dirs are copied (the controller mutates its vectors
 * in place). `golden` is the golden-hour factor (0..1), computed caller-side to
 * match SkyController exactly. Returns the resolved day factor.
 */
export function updateSpaceSky(
  material: THREE.ShaderMaterial,
  time: number,
  daylight: number,
  golden: number,
  sunDir: THREE.Vector3,
  moonDir: THREE.Vector3
): number {
  const u = material.uniforms as unknown as SpaceSkyUniforms;
  const day = dayFactorFromDaylight(daylight);
  u.uTime.value = time;
  u.uDay.value = day;
  u.uGolden.value = golden;
  u.uSunDir.value.copy(_sunScratch.copy(sunDir).normalize());
  u.uMoonDir.value.copy(_moonScratch.copy(moonDir).normalize());
  return day;
}
