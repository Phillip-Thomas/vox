/** WaveShaper curve table size (matches the drive curves in generative/timbre.ts). */
export const CEILING_CURVE_SAMPLES = 8192;

/**
 * The true-peak ceiling as a WaveShaper curve: y = x / (1 + |x/c|^n)^(1/n).
 * Unity slope at the origin, transparent well below the ceiling `c` (linear
 * full scale), saturating smoothly to `c` as |x| grows; `n` sets how hard the
 * knee is. Odd-symmetric and monotonic, so it adds no DC and never folds.
 */
export function ceilingCurveSample(x: number, ceilingLinear: number, softness: number): number {
  const c = Math.max(1e-6, ceilingLinear);
  const n = Math.max(1, softness);
  const r = Math.abs(x) / c;
  return x / Math.pow(1 + Math.pow(r, n), 1 / n);
}

export function ceilingCurve(
  ceilingLinear: number,
  softness: number,
  samples = CEILING_CURVE_SAMPLES
): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1;
    curve[i] = ceilingCurveSample(x, ceilingLinear, softness);
  }
  return curve;
}
