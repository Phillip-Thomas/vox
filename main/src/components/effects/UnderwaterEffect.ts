import { Effect, EffectAttribute } from 'postprocessing';
import { Uniform, Color, Vector2 } from 'three';

// --- Underwater screen pass (depth-based) ------------------------------------
//
// The depth-driven half of the underwater look, composited just before the final
// ToneMapping on tiers that have the post composer (ULTRA/HIGH). Everything is a
// function of the scene DEPTH (eye->geometry distance) + a single `uSubmergence`
// 0..1 from playerSubmersion, so the whole effect is a no-op above water and
// fades in with the SAME signal as the fog / audio / particles (no waterline
// desync). Layered on top of the always-on FogExp2 underwater override, which is
// the cheap fallback for tiers without a composer.
//
// Composition (after IQ "Better Fog" — absorb, then inscatter):
//   1. Refraction WOBBLE: animated UV displacement of the input (edge-faded so we
//      never sample off-buffer), for the "looking through water" shimmer.
//   2. Beer-Lambert EXTINCTION: per-channel exp(-sigma*dist) so red dies within a
//      couple of metres and the residual is blue-green (the bulk of "underwater").
//   3. Volumetric HAZE: distance inscatter toward a water colour, brighter toward
//      the sun's screen position.
//   4. GOD RAYS: soft shafts sourced only from the sun/Snell aperture. Earlier
//      versions blurred every bright scene pixel toward the sun, which copied
//      nearby voxel texture highlights into repeated underwater artifacts.
//   5. VIGNETTE: gentle radial darken (deepened by the low-oxygen pulse).
//   6. WIPE: a brief refraction-distorted water-line band on the submerge/emerge
//      crossing, driven by an edge-triggered uWipe.
//
// Samples `inputBuffer`/`resolution` directly (same as PainterlyEffect) for the
// wobble + godray taps; `EffectAttribute.DEPTH` adds the `depth` arg + getViewZ.

const fragmentShader = /* glsl */ `
  uniform float uSubmergence;   // 0..1 smoothed eye-underwater
  uniform float uTime;
  uniform vec3  uSigma;         // per-channel extinction coefficient (per world unit)
  uniform vec3  uDeepTint;      // colour distant geometry fades to (linear)
  uniform vec3  uHaze;          // inscattered haze colour
  uniform vec3  uHazeSun;       // haze colour toward the sun
  uniform float uFogDensity;    // inscatter density
  uniform vec2  uSunScreen;     // sun projected to screen uv (.x < -10 = behind/off)
  uniform float uGodrays;       // 0/1 enable god-ray shafts
  uniform float uWobble;        // refraction amplitude scale (0 disables)
  uniform float uVignette;      // extra vignette (0..1, low-oxygen pulse adds here)
  uniform float uWipe;          // 0..1 crossing wipe (0 = none)

  void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
    float s = uSubmergence;
    if (s <= 0.001) { outputColor = inputColor; return; }

    // 1. Refraction wobble — displace the sampled uv, faded to 0 at the screen
    // edges so a displaced tap can never read outside the buffer (edge smear).
    vec2 duv = vec2(0.0);
    if (uWobble > 0.0) {
      float t = uTime;
      vec2 w;
      w.x = sin(uv.y * 22.0 + t * 1.3) + 0.5 * sin(uv.y * 47.0 + t * 1.9);
      w.y = cos(uv.x * 19.0 + t * 1.1) + 0.5 * cos(uv.x * 53.0 + t * 1.7);
      float edge = smoothstep(0.0, 0.07, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));
      duv = w * (uWobble * 0.0032) * s * edge;
    }
    vec3 col = texture2D(inputBuffer, uv + duv).rgb;

    // 2. Beer-Lambert extinction by eye->geometry distance (water writes no depth,
    // so getViewZ here is the distance to the seabed/terrain behind the surface —
    // exactly what we want). Red has the largest sigma so it vanishes first.
    float dist = -getViewZ(depth);
    vec3 T = exp(-uSigma * dist);
    col = col * T + uDeepTint * (1.0 - T);

    // 3. Volumetric haze inscatter, brighter toward the sun's screen position.
    float fog = 1.0 - exp(-dist * uFogDensity);
    float sun = 0.0;
    if (uSunScreen.x > -10.0) sun = clamp(1.0 - length(uv - uSunScreen) * 1.3, 0.0, 1.0);
    vec3 haze = mix(uHaze, uHazeSun, pow(sun, 2.0));
    col = mix(col, haze, fog);

    // Nearby voxel detail stays readable, but underwater should still feel like
    // a medium. Gently cool/desaturate warm close surfaces so sand/stone texture
    // does not overpower the whole view before fog has much distance to work on.
    float mediumWash = s * mix(0.09, 0.22, fog);
    float luma = dot(col, vec3(0.299, 0.587, 0.114));
    vec3 cooled = mix(vec3(luma) * uHaze, col * vec3(0.82, 0.98, 1.12), 0.72);
    col = mix(col, cooled, mediumWash);
    col += (uHazeSun * 0.45 + vec3(0.02, 0.18, 0.22)) * s * (1.0 - fog) * 0.055;

    // 4. God rays. Source-gate the samples to the sun/Snell aperture, then tint
    // the shaft analytically. This keeps terrain highlights from being copied
    // into repeating bands while preserving the sun-peeking-through-water effect.
    if (uGodrays > 0.5 && uSunScreen.x > -10.0) {
      vec2 apertureUv = clamp(uSunScreen, vec2(0.02), vec2(0.98));
      float offscreenFade = exp(-length(uSunScreen - apertureUv) * 1.75);
      vec2 toAperture = apertureUv - uv;
      float apertureDist = length(toAperture);
      vec2 dir = toAperture * (1.0 / 28.0) * 0.96;
      vec2 coord = uv;
      float decay = 1.0;
      vec3 shaft = vec3(0.0);
      for (int i = 0; i < 28; i++) {
        coord += dir;
        if (coord.x < 0.0 || coord.x > 1.0 || coord.y < 0.0 || coord.y > 1.0) break;
        float aperture = smoothstep(0.66, 0.0, length(coord - apertureUv));
        vec3 smp = texture2D(inputBuffer, coord).rgb;
        float lum = dot(smp, vec3(0.333));
        float brightSource = smoothstep(0.62, 1.05, lum);
        shaft += uHazeSun * aperture * (0.25 + 0.75 * brightSource) * decay;
        decay *= 0.94;
      }
      float angle = atan(toAperture.y, toAperture.x);
      float bands =
        0.82
        + 0.10 * sin(angle * 11.0 + uTime * 0.18)
        + 0.06 * sin(angle * 19.0 - uTime * 0.13);
      bands = clamp(bands, 0.62, 1.0);
      float viewFalloff = smoothstep(1.25, 0.08, apertureDist);
      float waterColumn = smoothstep(0.10, 0.78, fog);
      col += shaft * (1.0 / 28.0) * 0.62 * s * offscreenFade * viewFalloff * waterColumn * bands;
    }

    // 5. Vignette — gentle radial darken, deepened by the low-oxygen pulse.
    float vig = 1.0 - smoothstep(0.35, 0.95, length(uv - 0.5));
    col *= mix(1.0, 0.55 + 0.45 * vig, s * (0.6 + 0.4 * uVignette));

    // 6. Crossing wipe — a refraction-distorted water line sweeping the screen.
    if (uWipe > 0.001) {
      float line = uWipe; // 1 at the moment of crossing -> 0
      float wobbleY = 0.012 * sin(uv.x * 30.0 + uTime * 6.0);
      float y = uv.y + wobbleY;
      float band = smoothstep(line - 0.05, line, y) * (1.0 - smoothstep(line, line + 0.05, y));
      col += (uHazeSun + uDeepTint) * band * 0.8;
    }

    outputColor = vec4(mix(inputColor.rgb, col, s), inputColor.a);
  }
`;

export interface UnderwaterEffectOptions {
  /** Per-channel extinction coefficient (per world unit). Red >> green > blue. */
  sigma?: Color;
  /** Colour distant geometry fades to (deep water). */
  deepTint?: Color;
  /** Inscattered haze colour. */
  haze?: Color;
  /** Haze colour toward the sun. */
  hazeSun?: Color;
  /** Inscatter density. */
  fogDensity?: number;
  /** Enable god-ray shafts (quality-gated). */
  godrays?: boolean;
  /** Refraction wobble amplitude (0 disables; quality-gated). */
  wobble?: number;
}

export class UnderwaterEffect extends Effect {
  constructor({
    sigma = new Color(0.24, 0.075, 0.045),
    deepTint = new Color(0.015, 0.10, 0.15),
    haze = new Color(0.035, 0.20, 0.28),
    hazeSun = new Color(0.36, 0.62, 0.68),
    fogDensity = 0.037,
    godrays = true,
    wobble = 1.0
  }: UnderwaterEffectOptions = {}) {
    super('UnderwaterEffect', fragmentShader, {
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map<string, Uniform>([
        ['uSubmergence', new Uniform(0)],
        ['uTime', new Uniform(0)],
        ['uSigma', new Uniform(sigma)],
        ['uDeepTint', new Uniform(deepTint)],
        ['uHaze', new Uniform(haze)],
        ['uHazeSun', new Uniform(hazeSun)],
        ['uFogDensity', new Uniform(fogDensity)],
        ['uSunScreen', new Uniform(new Vector2(-100, -100))],
        ['uGodrays', new Uniform(godrays ? 1 : 0)],
        ['uWobble', new Uniform(wobble)],
        ['uVignette', new Uniform(0)],
        ['uWipe', new Uniform(0)]
      ])
    });
    activeUnderwater = this;
  }

  /** Per-frame drive (PostFX useFrame). sunScreen in uv space; x<-10 = off-screen. */
  setFrame(submergence: number, time: number, sunScreenX: number, sunScreenY: number, wipe: number, vignette: number) {
    this.uniforms.get('uSubmergence')!.value = submergence;
    this.uniforms.get('uTime')!.value = time;
    const sun = this.uniforms.get('uSunScreen')!.value as Vector2;
    sun.set(sunScreenX, sunScreenY);
    this.uniforms.get('uWipe')!.value = wipe;
    this.uniforms.get('uVignette')!.value = vignette;
  }

  /** Per-planet colours (drive from the water profile). */
  setPalette(sigma: Color, deepTint: Color, haze: Color, hazeSun: Color) {
    (this.uniforms.get('uSigma')!.value as Color).copy(sigma);
    (this.uniforms.get('uDeepTint')!.value as Color).copy(deepTint);
    (this.uniforms.get('uHaze')!.value as Color).copy(haze);
    (this.uniforms.get('uHazeSun')!.value as Color).copy(hazeSun);
  }
}

// Module-level handle (props/ref can't cross wrapEffect — see ColorGradeEffect).
let activeUnderwater: UnderwaterEffect | null = null;
export function getUnderwater(): UnderwaterEffect | null {
  return activeUnderwater;
}
