import * as THREE from 'three';

// --- Unified "Cosmos-Through-Glass" sky dome --------------------------------
//
// A single inverted-sphere ShaderMaterial that is now the SOLE visible sky. It
// renders the full procedural cosmos (4-layer starfield + multi-colour nebula +
// Milky Way band + a lit moon over a deep-space base) and then composites a
// luminous per-planet daytime atmosphere ON TOP, morphed by one scalar uDay
// [0..1] (with a golden-hour factor uGolden).
//
// The physical conceit: cosmos is ADDITIVE radiance multiplied by per-channel
// transmittance T, with in-scatter added on top:  color = cosmos*Tc + inscatter.
// That is what lets a bright star at radiance ~1.0, attenuated to ~0.7 at the
// zenith, still sit well above a low in-scatter floor and READ as a star by day
// (dimmer, slightly blue-shifted) instead of being washed/alpha-blended away.
//
// The day branch is a real lit sky — a 3-stop luminous gradient, a climbing warm
// sunset band that hue-shifts ember -> salmon (so it never muds into the blue),
// a bloomed sun, drifting sun-lit gold-rimmed CLOUD banks, and in-dome crepuscular
// SHAFTS — yet the cosmos still shows THROUGH it (only dimmed, washed near the sun).
// Clouds + shafts are the most expensive part and are gated by uCloudQuality so
// low-end profiles skip them while still getting the gradient + sun.
//
// Night is preserved: at uDay=0 the dim star layers + nebula are at full strength
// (dayKnock=1) and an early-out returns the pure cosmos with no scattering ALU.
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
  uCloudQuality: { value: number };  // 0 none .. 0.7 clouds .. 1 clouds+shafts (perf tier)
  uSunDir: { value: THREE.Vector3 };
  uMoonDir: { value: THREE.Vector3 };
  uUp: { value: THREE.Vector3 };  // player's local up — orients atmosphere/horizon
  // Per-planet daytime atmosphere palette (set once per planet, not per frame).
  uAtmoLow: { value: THREE.Color };   // luminous horizon / low-sky
  uAtmoHigh: { value: THREE.Color };  // deeper upper-sky
  uSunGlow: { value: THREE.Color };   // sun bloom / aureole tint
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
  uniform float uDay;          // 0 night .. 1 day; master atmosphere/cosmos morph
  uniform float uGolden;       // 0..1 golden-hour factor (warms horizon + sun halo)
  uniform float uCloudQuality; // 0 none .. 0.7 clouds .. 1 clouds+shafts (perf tier)
  uniform vec3 uSunDir;
  uniform vec3 uMoonDir;
  uniform vec3 uUp;        // player's local up (orients the horizon gradient)
  uniform vec3 uAtmoLow;   // luminous horizon / low-sky (per planet)
  uniform vec3 uAtmoHigh;  // deeper upper-sky (per planet)
  uniform vec3 uSunGlow;   // sun bloom tint (per planet)
  varying vec3 vDir;

  // --- Day atmosphere tunables ----------------------------------------------
  #define DAY_ZENITH_TAU      0.85  // peak optical depth scale (subtle atmosphere over the cosmos)
  #define DAY_STAR_GAIN       0.65  // keep dim star layers + nebula visible through daylight glass
  #define DAY_COSMOS_DIM      0.75  // preserve the cosmos as the base everywhere, even at full day
  #define DAY_INSCATTER_GAIN  4.5   // thin atmospheric veil; pulled down at golden so it never washes out
  #define MOON_DAY_DIM        0.30  // daytime moon brightness vs full night
  #define MIE_G               0.80
  #define MIE_G_CLOUD         0.62
  #define THIN_ZENITH         0.16  // thin-shell air-mass at the zenith
  #define HORIZON_AIRMASS     0.07  // gentle, CAPPED horizon thickening (~1.4x zenith, no hemisphere seam)
  #define MID_BAND_BOOST      1.10  // luminous mid-band = gently brightened low-sky (no clip ridge)
  #define DAY_NEBULA_LIFT     1.35  // surgical day-only nebula lift so colour survives the glass

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

  // One star layer with the RING FIX. starLayer voxelizes dir*cells; binning a
  // constant-radius direction shell into the cartesian grid otherwise paints
  // CONCENTRIC RINGS at the +/-x,+/-y,+/-z lattice poles. Two fixes kill them:
  //   A: a per-cell lattice-space warp (amplitude ~0.6 cell) scrambles floor()
  //      membership at the poles — density-preserving reshuffle.
  //   B: jitter z too and use the full 3D distance (kills the coherent f.z term).
  vec3 starLayer(vec3 dir, float cells, float density, float twinkle, float sizePow) {
    vec3 p = dir * cells;
    p += 0.6 * (vec3(
      vnoise(p * 0.9 + 7.0),
      vnoise(p * 0.9 + 23.0),
      vnoise(p * 0.9 + 41.0)
    ) - 0.5);
    vec3 cell = floor(p);
    vec3 f = fract(p) - 0.5;
    vec3 rnd = hash33(cell);
    if (rnd.x > density) return vec3(0.0);
    vec3 jitter = (hash33(cell + 1.7) - 0.5) * 0.7;
    vec3 d = f - jitter;
    float dist2 = dot(d, d);
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

  // Gentle, CAPPED horizon thickening (~1.4x zenith, no hemisphere seam).
  // cy = dot(dir, uUp), so it tracks the player's LOCAL horizon on every face.
  float airMass(float cy) {
    float c = clamp(cy, 0.0, 1.0);
    return THIN_ZENITH + (1.0 - c) * HORIZON_AIRMASS;
  }

  // Returns LOW-radiance in-scatter + per-channel cosmos transmittance.
  void atmosphere(vec3 d, vec3 s, float cyLocal, float day, float golden, out vec3 inscatter, out vec3 T) {
    float mu  = dot(d, s);
    float am  = airMass(cyLocal);
    // blue base Rayleigh tint -> warm at golden hour
    vec3  kR  = mix(vec3(0.050, 0.200, 0.340), vec3(0.260, 0.130, 0.075), golden);
    vec3  kM  = vec3(1.0, 0.85, 0.62);
    vec3  tauR = kR * (DAY_ZENITH_TAU * am * day);   // colored optical depth (blue thickest)
    float tauM = DAY_ZENITH_TAU * 0.10 * am * day;
    float sunUp = smoothstep(-0.10, 0.18, dot(s, uUp));   // LOCAL sun-up; drains in-scatter at twilight
    vec3  isR = kR * phaseR(mu)        * (1.0 - exp(-tauR)) * sunUp;
    vec3  isM = kM * phaseM(mu, MIE_G) * (1.0 - exp(-vec3(tauM))) * sunUp;
    vec3  airglow = vec3(0.20, 0.34, 0.66) * day * sunUp * 0.015;
    // Pull the broad veil DOWN at golden hour so the warmth concentrates into the
    // sunset band instead of washing the whole sky to a milky cream haze.
    float veilGain = DAY_INSCATTER_GAIN * (1.0 - 0.72 * golden);
    inscatter = (isR + isM) * veilGain + airglow;
    T = exp(-(tauR + vec3(tauM)));                   // per-channel: blue dimmed most
  }

  // --- Luminous 3-stop gradient + climbing sunset band + bloomed sun ---------
  void dayAtmosphere(vec3 dir, vec3 s, float cyLocal, float day, float golden,
                     float sunUp, out vec3 skyOut, out vec3 sunOut) {
    float mu = dot(dir, s);
    float h  = clamp(cyLocal, 0.0, 1.0);          // 0 horizon .. 1 zenith (above)

    // Luminous 3-stop ramp from the per-planet palette: pale low-sky -> brightened
    // mid -> deep upper-sky. At golden hour deepen the zenith (toward black, hue
    // kept) so the warm horizon has a rich dark counterpoint instead of a wash.
    vec3 hiStop = mix(uAtmoHigh, uAtmoHigh * 0.40, golden);
    vec3 midC = uAtmoLow * MID_BAND_BOOST;
    // wide, overlapping ramps so the gradient is one smooth wash (no banded ridge
    // even on pale low-saturation palettes where the mid would otherwise clip).
    vec3 sky  = mix(uAtmoLow, midC,   smoothstep(0.0,  0.35, h));
    sky       = mix(sky,      hiStop, smoothstep(0.15, 0.90, h));
    sky      *= mix(1.0, 0.60, golden);  // lower the cool-sky key at golden; warmth added below

    // Warm SUNSET band: a horizon band by day that CLIMBS toward the sun at golden.
    // Its hue shifts with height — deep ember-orange at the skyline -> salmon/pink
    // up high — so where it fades into the blue zenith it reads violet, not mud-brown.
    float lowMask    = smoothstep(mix(0.30, 0.62, golden), -0.04, cyLocal);
    float sunward    = pow(max(mu, 0.0), mix(2.0, 2.6, golden));
    vec3  warmLow    = vec3(1.0, 0.30, 0.08);   // deep ember at the skyline
    vec3  warmHigh   = vec3(1.0, 0.52, 0.46);   // salmon/pink as it climbs
    vec3  sunsetWarm = mix(warmLow, warmHigh, smoothstep(-0.02, 0.34, cyLocal));
    sky = mix(sky, sunsetWarm, clamp((0.16 + golden * 1.15) * sunward * lowMask, 0.0, 0.92));
    // deep-red ember hugging the horizon, strongest at golden -> a burning skyline.
    float ember = smoothstep(0.16, -0.05, cyLocal) * pow(max(mu, 0.0), 1.4);
    sky = mix(sky, vec3(0.90, 0.22, 0.08), clamp(golden * 0.55 * ember, 0.0, 0.6));

    // Subtle cool per-planet sky-glow tint near the sun, high up (fades at golden).
    float toSunTight = pow(max(mu, 0.0), 6.0);
    sky = mix(sky, uSunGlow, toSunTight * 0.10 * (1.0 - golden));

    // in-scatter veil ON TOP (real air-mass falloff; teal-blue -> warm at golden).
    vec3 inscatter, T;
    atmosphere(dir, s, cyLocal, day, golden, inscatter, T);
    sky += inscatter;

    skyOut = sky * day * sunUp;

    // Brilliant bloomed sun: hot white disc + COMPACT warm aureole (tight so the
    // low sun is an intense point, not a sky-wide bloom that greys everything out).
    float disc    = smoothstep(0.9989 - golden * 0.0005, 0.99975, mu);
    float aureole = pow(max(mu, 0.0), 22.0) * 0.7
                  + exp((mu - 1.0) * 60.0) * 1.3;
    vec3  glowTint = mix(vec3(1.0, 0.85, 0.60), vec3(1.0, 0.46, 0.18), golden);
    vec3  discCol  = vec3(1.0, 0.97, 0.90) * disc * 10.0;
    sunOut = (discCol + glowTint * aureole * (1.0 + golden * 0.9)) * sunUp;
  }

  // --- Drifting, sun-lit, gold-rimmed cloud bands ---------------------------
  // returns rgb = lit colour, w = coverage alpha (already x day x sunUp).
  // Clouds exist DAY AND NIGHT: coverage is day-INDEPENDENT; only the LIGHTING
  // morphs (sun-lit + gold rims by day -> sky-ambient -> moon-lit silver by night)
  // so they never pop in/out at the terminator. ambient is the sky/space tint the
  // bodies sit in (pale by day, dark at night) so they read as clouds, not smudges.
  vec4 cloudBands(vec3 dir, vec3 up, vec3 s, vec3 m, float golden, float day, float sunUp, vec3 ambient) {
    if (uCloudQuality < 0.5) return vec4(0.0);
    float cy = dot(dir, up);
    vec3 horiz = dir - up * cy;                      // horizontal component
    // squash vertical -> broad horizontal banks with some tower; LOCAL frame.
    vec3 cp = vec3(horiz.x * 2.0, cy * 3.4, horiz.z * 2.0);
    cp += vec3(uTime * 0.012, uTime * 0.002, uTime * 0.006); // slow drift
    float warp  = fbm(cp * 0.45 + 9.0);
    float cloud = fbm(cp * 1.15 + warp * 0.9);
    // two-threshold: broken bodies with clear gaps (cosmos shows through).
    float coverage = smoothstep(0.50, 0.84, cloud);
    coverage = mix(coverage, smoothstep(0.46, 0.98, cloud), 0.5);
    // DRAPE: clouds across mid sky, fading into the horizon haze, thinning at zenith.
    coverage *= smoothstep(-0.06, 0.20, cy);
    coverage *= 1.0 - smoothstep(0.82, 1.0, clamp(cy, 0.0, 1.0));
    coverage *= mix(1.0, 0.62, golden);               // break up a touch at golden
    if (coverage <= 0.001) return vec4(0.0);          // clear-sky early-bail

    float cmu = dot(dir, s);                          // toward sun
    float cmm = dot(dir, m);                          // toward moon
    // Sun lighting (day): bright sun-facing side + gold forward-scatter rim.
    float sunSide = smoothstep(-0.30, 0.70, cmu);
    vec3  sunCol  = mix(vec3(0.85, 0.88, 0.96), vec3(1.0, 0.72, 0.42), golden);
    float hg   = phaseM(cmu, MIE_G_CLOUD);
    float sRim = pow(max(cmu, 0.0), 4.0) * 1.6 + hg * 0.25;
    vec3  goldRim = mix(vec3(1.0, 0.78, 0.44), vec3(1.0, 0.44, 0.16), golden) * sRim * (2.2 + golden * 1.6);
    vec3  sunLight = (sunCol * sunSide + goldRim) * day * sunUp;
    // Moon lighting (night): cool fill + soft silver rim on the moon-facing side.
    float moonUp   = smoothstep(-0.06, 0.12, dot(m, up));
    float moonSide = smoothstep(-0.40, 0.80, cmm);
    float mRim     = pow(max(cmm, 0.0), 5.0);
    vec3  moonLight = (vec3(0.26, 0.32, 0.48) * moonSide + vec3(0.50, 0.58, 0.78) * mRim)
                      * moonUp * (1.0 - day) * 0.7;
    vec3  cloudCol = ambient + sunLight + moonLight;
    // feather thin edges so the cosmos/sky shows through the wisps.
    float a = coverage * (0.55 + 0.45 * smoothstep(0.0, 0.65, coverage));
    return vec4(cloudCol, a);
  }

  // --- In-dome crepuscular shafts (brighten cloud gaps) ---------------------
  vec3 lightShafts(vec3 dir, vec3 s, float golden, float day, float sunUp, float coverage) {
    if (uCloudQuality < 0.99) return vec3(0.0);       // HIGH/ULTRA dome extra
    float mu  = dot(dir, s);
    float ang = acos(clamp(mu, -1.0, 1.0));
    // Smooth radial falloff that reaches EXACTLY zero inside the sun-ward hemisphere,
    // so the shafts feather out instead of hard-stopping at the 90°-from-sun line
    // (the old if (mu < 0) return 0 cut them dead while still ~11% bright).
    float reach = exp(-ang * 1.5) * smoothstep(1.65, 1.05, ang);
    if (reach <= 0.0) return vec3(0.0);
    vec3  perp = normalize(dir - s * mu + 1e-4);
    // radial streaks: layered noise around the sun axis, animated, broad fan.
    float n1 = fbm(perp * 6.0 + vec3(0.0, 0.0, uTime * 0.03));
    float n2 = fbm(perp * 14.0 - vec3(uTime * 0.02, 0.0, 0.0));
    float streak = smoothstep(0.30, 0.85, n1 * 0.7 + n2 * 0.3);
    float shafts = streak * reach * (0.35 + 0.65 * (1.0 - coverage)) * sunUp * day;
    vec3 tint = mix(vec3(1.0, 0.93, 0.78), vec3(1.0, 0.66, 0.32), golden);
    return tint * shafts * (0.45 + golden * 0.6);
  }

  // 1/255 hash dither (kills banding in the smooth day gradient under ACES).
  float dither(vec3 dir) { return (hash31(dir * 937.0) - 0.5) / 255.0; }

  void main() {
    vec3 dir  = normalize(vDir);
    vec3 sdir = rotate(dir, uTime * 0.01); // slow celestial drift (stars/nebula)

    // Cheap global warp before cellularizing (large-scale irregularity); the
    // per-cell ring fix inside starLayer sits on top of this.
    vec3 wdir = sdir + 0.045 * vec3(
      vnoise(sdir * 2.7 + 13.0),
      vnoise(sdir * 2.7 + 31.0),
      vnoise(sdir * 2.7 + 57.0)
    );

    // ---- COSMOS (night math; dim layers knocked down by day) ----
    float dayKnock = mix(1.0, DAY_STAR_GAIN, uDay);
    vec3 cosmos  = starLayer(wdir,        80.0, 0.34, 1.0,  80.0) * 1.5;            // brightest: full
    cosmos += starLayer(wdir + 11.3, 140.0, 0.24, 0.85, 110.0) * 1.1  * dayKnock;   // dimmer: knock down
    cosmos += starLayer(wdir + 27.1, 220.0, 0.15, 0.6,  150.0) * 0.8  * dayKnock;
    cosmos += starLayer(wdir + 53.7, 360.0, 0.10, 0.4,  200.0) * 0.55 * dayKnock;
    vec3 neb = nebulaField(sdir) * 1.1 * dayKnock;                                  // split out for day-only lift
    cosmos += neb;
    cosmos += vec3(0.010, 0.013, 0.030);                                           // deep-space base
    // Moon kept separate so the per-channel horizon transmittance doesn't redden it.
    vec3 moonCol = moon(dir, uMoonDir);

    // ---- Sun/moon geometry + clouds (exist day AND night) ----
    vec3  s = normalize(uSunDir);
    vec3  m = normalize(uMoonDir);
    float sunUp = smoothstep(-0.06, 0.12, dot(s, uUp));   // sun above the LOCAL horizon

    // Cloud ambient: dark blue silhouette by night -> pale sky-tint by day, so the
    // bodies always read as clouds (not dark smudges) and never pop at the terminator.
    vec3 cloudAmb = mix(vec3(0.035, 0.045, 0.085), uAtmoLow * 0.80 + vec3(0.05), uDay);
    vec4 cb = cloudBands(dir, uUp, s, m, uGolden, uDay, sunUp, cloudAmb);

    // ---- NIGHT / DEEP-SPACE: cosmos + (moonlit) clouds + moon. In deep space the
    // component passes uCloudQuality=0, so cb is empty and the void stays pure cosmos.
    if (uDay < 0.01) {
      vec3 nightCol = mix(cosmos, cb.rgb, cb.a);
      nightCol += moonCol;
      nightCol += dither(dir);
      gl_FragColor = vec4(nightCol, 1.0);
      return;
    }

    // ---- DAY: luminous per-planet atmosphere LAYERED OVER the preserved cosmos.
    float mu    = dot(dir, s);
    float toSun = pow(max(mu, 0.0), 3.0);
    float cyLocal = dot(dir, uUp);

    vec3 skyCol, sunCol;
    dayAtmosphere(dir, s, cyLocal, uDay, uGolden, sunUp, skyCol, sunCol);

    // cosmos preserved by day: gentle dim + wash near sun + chromatic transmittance.
    vec3 inscatter, T;
    atmosphere(dir, s, cyLocal, uDay, uGolden, inscatter, T);
    float cosmosDim = mix(1.0, DAY_COSMOS_DIM, uDay) * (1.0 - 0.45 * uDay * toSun);
    vec3  cosmosDay = cosmos * cosmosDim * mix(vec3(1.0), T, uDay);
    cosmosDay += neb * (uDay * (DAY_NEBULA_LIFT - 1.0));    // surgical day-only nebula lift

    vec3 color = cosmosDay + skyCol;

    // clouds OVER cosmos+sky (gaps reveal cosmos).
    color = mix(color, cb.rgb, cb.a);

    // shafts in the gaps (sun-ward, daytime).
    color += lightShafts(dir, s, uGolden, uDay, sunUp, clamp(cb.a, 0.0, 1.0));

    // sun on top, then moon.
    color += sunCol;
    color += moonCol * mix(1.0, MOON_DAY_DIM, uDay);

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
      uCloudQuality: { value: 1.0 },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uMoonDir: { value: new THREE.Vector3(0, -1, 0) },
      uUp: { value: new THREE.Vector3(0, 1, 0) },
      // Default nebular-blue atmosphere (overridden per-planet via setSpaceSkyAtmosphere).
      uAtmoLow: { value: new THREE.Color(0.85, 0.78, 0.98) },
      uAtmoHigh: { value: new THREE.Color(0.20, 0.30, 0.62) },
      uSunGlow: { value: new THREE.Color(1.0, 0.82, 0.95) }
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
const _upScratch = new THREE.Vector3();
const _defaultUp = new THREE.Vector3(0, 1, 0);

/**
 * Push day-cycle state into the dome. `time` is frozen by the caller when
 * animation is off; sun/moon dirs are copied (the controller mutates its vectors
 * in place). `golden` is the golden-hour factor (0..1), computed caller-side to
 * match SkyController exactly. `cloudQuality` gates the dome's clouds + shafts
 * (0 none, 0.7 clouds, 1 clouds+shafts). Returns the resolved day factor.
 */
export function updateSpaceSky(
  material: THREE.ShaderMaterial,
  time: number,
  daylight: number,
  golden: number,
  sunDir: THREE.Vector3,
  moonDir: THREE.Vector3,
  up: THREE.Vector3 = _defaultUp,
  cloudQuality = 1.0
): number {
  const u = material.uniforms as unknown as SpaceSkyUniforms;
  const day = dayFactorFromDaylight(daylight);
  u.uTime.value = time;
  u.uDay.value = day;
  u.uGolden.value = golden;
  u.uCloudQuality.value = cloudQuality;
  u.uSunDir.value.copy(_sunScratch.copy(sunDir).normalize());
  u.uMoonDir.value.copy(_moonScratch.copy(moonDir).normalize());
  u.uUp.value.copy(_upScratch.copy(up).normalize());
  return day;
}

/**
 * Set the per-planet daytime atmosphere palette (luminous low-sky, deep upper-sky,
 * sun-bloom tint). Called once when the planet changes — NOT per frame. Night /
 * deep space are unaffected (the day branch alone reads these).
 */
export function setSpaceSkyAtmosphere(
  material: THREE.ShaderMaterial,
  low: THREE.Color,
  high: THREE.Color,
  glow: THREE.Color
): void {
  const u = material.uniforms as unknown as SpaceSkyUniforms;
  u.uAtmoLow.value.copy(low);
  u.uAtmoHigh.value.copy(high);
  u.uSunGlow.value.copy(glow);
}
