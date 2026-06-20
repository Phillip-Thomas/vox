// Phase 5 — custom painterly post effect.
//
// `postprocessing` does not ship a Kuwahara filter, so this is a hand-rolled
// effect that extends the library's `Effect` base class. It implements a small
// (radius 3) Kuwahara filter: the neighbourhood around each pixel is split into
// four overlapping quadrant windows, the mean + variance of each is computed,
// and the mean of the lowest-variance quadrant is emitted. The result is a
// smooth, oil-paint / brush-stroke look that preserves edges (low variance
// wins, so edges aren't blurred across) — the classic painterly aesthetic.
//
// The kernel is intentionally small (radius 3 -> 4x 4x4 windows) to stay cheap
// enough for a fullscreen pass on mid-range hardware. If this still proves too
// heavy on a target device, drop KUWAHARA_RADIUS to 2 via the `radius` option.

import { Effect } from 'postprocessing';
import { Uniform } from 'three';

const KUWAHARA_RADIUS = 3;

// `postprocessing` effects expose `mainImage(inputColor, uv, outputColor)`.
// `texture` (the input buffer) and `resolution` are provided automatically by
// the EffectMaterial; we add `radius` as a tunable uniform/macro.
const fragmentShader = /* glsl */ `
uniform int radius;

// Mean + sum-of-squares accumulation for one quadrant window.
void sampleWindow(
  const in vec2 uv,
  const in vec2 texel,
  const in int x0, const in int x1,
  const in int y0, const in int y1,
  out vec3 mean,
  out float sigma
) {
  vec3 sum = vec3(0.0);
  vec3 sumSq = vec3(0.0);
  float count = 0.0;

  // RADIUS is fixed (3) so loop bounds are compile-time constant — required
  // for older GLSL ES; we mask out-of-window samples instead of dynamic bounds.
  for (int j = -RADIUS; j <= RADIUS; ++j) {
    for (int i = -RADIUS; i <= RADIUS; ++i) {
      if (i < x0 || i > x1 || j < y0 || j > y1) continue;
      vec3 c = texture2D(inputBuffer, uv + vec2(float(i), float(j)) * texel).rgb;
      sum += c;
      sumSq += c * c;
      count += 1.0;
    }
  }

  mean = sum / count;
  // Luminance variance as the quadrant "smoothness" score.
  vec3 variance = abs(sumSq / count - mean * mean);
  sigma = dot(variance, vec3(0.299, 0.587, 0.114));
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 texel = 1.0 / resolution;

  vec3 mean;
  float sigma;
  vec3 bestMean;
  float bestSigma;

  // Quadrant 0: top-left (includes centre row/col -> overlapping windows).
  sampleWindow(uv, texel, -RADIUS, 0, -RADIUS, 0, mean, sigma);
  bestMean = mean; bestSigma = sigma;

  // Quadrant 1: top-right.
  sampleWindow(uv, texel, 0, RADIUS, -RADIUS, 0, mean, sigma);
  if (sigma < bestSigma) { bestSigma = sigma; bestMean = mean; }

  // Quadrant 2: bottom-left.
  sampleWindow(uv, texel, -RADIUS, 0, 0, RADIUS, mean, sigma);
  if (sigma < bestSigma) { bestSigma = sigma; bestMean = mean; }

  // Quadrant 3: bottom-right.
  sampleWindow(uv, texel, 0, RADIUS, 0, RADIUS, mean, sigma);
  if (sigma < bestSigma) { bestSigma = sigma; bestMean = mean; }

  outputColor = vec4(bestMean, inputColor.a);
}
`;

export interface PainterlyEffectOptions {
  /** Kuwahara window radius (1-4). Larger = stronger, slower. Default 3. */
  radius?: number;
}

/**
 * Kuwahara painterly effect. Constructed by `wrapEffect` on the R3F side.
 */
export class PainterlyEffect extends Effect {
  constructor({ radius = KUWAHARA_RADIUS }: PainterlyEffectOptions = {}) {
    super('PainterlyEffect', fragmentShader, {
      // RADIUS must be a compile-time macro for the constant loop bounds.
      defines: new Map<string, string>([['RADIUS', radius.toFixed(0)]]),
      uniforms: new Map<string, Uniform>([['radius', new Uniform(radius)]])
    });
  }
}
