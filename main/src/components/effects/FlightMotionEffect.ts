import { Effect, EffectAttribute } from 'postprocessing';
import { Uniform } from 'three';

const fragmentShader = /* glsl */`
  uniform float uMotion;
  uniform float uBoost;

  void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
    if (uMotion <= 0.001) { outputColor = inputColor; return; }

    float distanceFromEye = -getViewZ(depth);
    float farMask = smoothstep(8.0, 42.0, distanceFromEye);
    vec2 fromCenter = uv - vec2(0.5);
    float radius = length(fromCenter);
    float edgeMask = smoothstep(0.18, 0.68, radius);
    float amount = uMotion * farMask * edgeMask;
    if (amount <= 0.001) { outputColor = inputColor; return; }

    vec2 direction = fromCenter * (0.008 + uBoost * 0.013) * amount;
    vec2 uv1 = clamp(uv - direction * 0.65, vec2(0.001), vec2(0.999));
    vec2 uv2 = clamp(uv - direction * 1.35, vec2(0.001), vec2(0.999));
    vec2 uv3 = clamp(uv - direction * 2.1, vec2(0.001), vec2(0.999));
    vec3 tap1 = texture2D(inputBuffer, uv1).rgb;
    vec3 tap2 = texture2D(inputBuffer, uv2).rgb;
    vec3 tap3 = texture2D(inputBuffer, uv3).rgb;
    vec3 streak = (tap1 + tap2 + tap3) / 3.0;

    // Restrained peripheral spectral separation, derived from existing taps.
    streak.r = mix(streak.r, tap1.r, uBoost * 0.22);
    streak.b = mix(streak.b, tap3.b, uBoost * 0.18);
    outputColor = vec4(mix(inputColor.rgb, streak, amount * 0.72), inputColor.a);
  }
`;

export class FlightMotionEffect extends Effect {
  constructor() {
    super('FlightMotionEffect', fragmentShader, {
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map<string, Uniform>([
        ['uMotion', new Uniform(0)],
        ['uBoost', new Uniform(0)]
      ])
    });
    activeFlightMotion = this;
  }

  setFrame(motion: number, boost: number): void {
    this.uniforms.get('uMotion')!.value = Math.min(1, Math.max(0, Number.isFinite(motion) ? motion : 0));
    this.uniforms.get('uBoost')!.value = Math.min(1, Math.max(0, Number.isFinite(boost) ? boost : 0));
  }
}

let activeFlightMotion: FlightMotionEffect | null = null;
export function getFlightMotion(): FlightMotionEffect | null {
  return activeFlightMotion;
}
