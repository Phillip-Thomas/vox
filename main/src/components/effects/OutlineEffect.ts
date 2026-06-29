import { Effect, EffectAttribute } from 'postprocessing';
import { Uniform } from 'three';

// --- Stylized depth outline (Phase 4) ----------------------------------------
//
// A subtle dark edge at DEPTH discontinuities (silhouettes / where a near surface
// meets a far one), giving the crisp "realistic-stylized" look its deliberate
// pop without per-object selection — it runs on the whole instanced scene from
// the depth buffer alone. A Sobel-ish 4-tap on linearized view-Z, normalized by
// distance so far terrain doesn't over-outline. Kept thin + low-strength so it
// reads as intentional, not edge noise. No per-frame uniforms, so it needs no
// props/ref (which React 19 + wrapEffect can't serialize).

const fragmentShader = /* glsl */ `
  uniform float uThickness;  // edge sample distance, in texels
  uniform float uStrength;   // how dark the edge gets (0..1)
  uniform float uThreshold;  // relative depth slope that counts as an edge

  void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
    vec2 t = texelSize * uThickness;
    float c = getViewZ(depth);
    float l = getViewZ(readDepth(uv + vec2(-t.x, 0.0)));
    float r = getViewZ(readDepth(uv + vec2( t.x, 0.0)));
    float u = getViewZ(readDepth(uv + vec2(0.0, -t.y)));
    float d = getViewZ(readDepth(uv + vec2(0.0,  t.y)));

    // Sum of absolute neighbour differences, made distance-relative so a flat
    // surface seen at a glancing angle far away doesn't read as an edge.
    float edge = abs(l - c) + abs(r - c) + abs(u - c) + abs(d - c);
    edge /= max(abs(c), 1.0);

    float e = smoothstep(uThreshold, uThreshold * 2.5, edge) * uStrength;
    outputColor = vec4(inputColor.rgb * (1.0 - e), inputColor.a);
  }
`;

export interface OutlineEffectOptions {
  thickness?: number;
  strength?: number;
  threshold?: number;
}

export class OutlineEffect extends Effect {
  constructor({ thickness = 0.95, strength = 0.34, threshold = 0.045 }: OutlineEffectOptions = {}) {
    super('OutlineEffect', fragmentShader, {
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map<string, Uniform>([
        ['uThickness', new Uniform(thickness)],
        ['uStrength', new Uniform(strength)],
        ['uThreshold', new Uniform(threshold)]
      ])
    });
  }
}
