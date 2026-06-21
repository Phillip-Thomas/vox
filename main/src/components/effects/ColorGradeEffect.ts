import { Effect } from 'postprocessing';
import { Uniform, Color } from 'three';

// --- Unified color-grade pass (Phase 2 cohesion) -----------------------------
//
// A single, cheap full-screen grade applied to the WHOLE frame so sky, terrain,
// foliage and water read as one graded image instead of independently-authored
// shaders. Driven per-frame from the planet BIOME (atmosphere tint + saturation)
// and the SUN elevation (golden-hour warmth, night cool/contrast). Kept subtle —
// cohesion, not an Instagram filter. Custom Effect (mirrors PainterlyEffect) so
// we control lift/contrast/sat/tint exactly; runs before the final ToneMapping.

const fragmentShader = /* glsl */ `
  uniform vec3 uTint;       // biome atmosphere colour (linear-ish)
  uniform float uTintAmt;   // how far to push toward the tint (0..~0.25)
  uniform float uWarm;      // -1 cool .. +1 warm (golden hour positive, night negative)
  uniform float uSat;       // saturation multiplier (~0.9..1.2)
  uniform float uContrast;  // contrast around mid grey (~0.95..1.15)

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec3 c = inputColor.rgb;

    // saturation around luma
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = mix(vec3(l), c, uSat);

    // contrast around mid grey
    c = (c - 0.5) * uContrast + 0.5;

    // gentle biome tint (multiplicative pull toward the atmosphere colour)
    c = mix(c, c * uTint, uTintAmt);

    // warm/cool shift (golden hour warms, night cools)
    c.r *= 1.0 + uWarm * 0.05;
    c.b *= 1.0 - uWarm * 0.05;

    outputColor = vec4(clamp(c, 0.0, 1.0), inputColor.a);
  }
`;

export interface ColorGradeOptions {
  tint?: Color;
  tintAmount?: number;
  warm?: number;
  saturation?: number;
  contrast?: number;
}

export class ColorGradeEffect extends Effect {
  constructor({
    tint = new Color(1, 1, 1),
    tintAmount = 0.12,
    warm = 0,
    saturation = 1.05,
    contrast = 1.03
  }: ColorGradeOptions = {}) {
    super('ColorGradeEffect', fragmentShader, {
      uniforms: new Map<string, Uniform>([
        ['uTint', new Uniform(tint)],
        ['uTintAmt', new Uniform(tintAmount)],
        ['uWarm', new Uniform(warm)],
        ['uSat', new Uniform(saturation)],
        ['uContrast', new Uniform(contrast)]
      ])
    });
    activeColorGrade = this;
  }

  setGrade(tint: Color, tintAmount: number, saturation: number, warm: number, contrast: number) {
    (this.uniforms.get('uTint')!.value as Color).copy(tint);
    this.uniforms.get('uTintAmt')!.value = tintAmount;
    this.uniforms.get('uSat')!.value = saturation;
    this.uniforms.get('uWarm')!.value = warm;
    this.uniforms.get('uContrast')!.value = contrast;
  }
}

// Module-level handle to the live effect. We CANNOT pass props/ref through
// wrapEffect (React 19 serializes them -> circular-structure crash), so PostFX
// drives the grade through this instead.
let activeColorGrade: ColorGradeEffect | null = null;
export function getColorGrade(): ColorGradeEffect | null {
  return activeColorGrade;
}
