// --- Bed timbre grammar (Stage 1, pure) --------------------------------------------------------
//
// The pure half of the Stage 1 instrument: impulse-response synthesis shared
// by every convolver in the music path, the drive/soft-clip transfer curves,
// and the quality-tier resolver. Nothing here touches WebAudio; bedEngine and
// scoreEngine only turn these arrays into node buffers/curves once at build.

/** Quality tier for the bed graph: `full` desktop, `lean` mobile/low. */
export type BedQualityTier = 'full' | 'lean';

export interface BedQualityHint {
  /** navigator.hardwareConcurrency (undefined when unknown). */
  hardwareConcurrency?: number;
  /** navigator.deviceMemory in GB (Chromium only; undefined when unknown). */
  deviceMemoryGb?: number;
  /** Coarse-pointer / mobile viewport. */
  coarsePointer?: boolean;
  /** The game's own render quality tier, when the caller knows it. */
  renderQuality?: 'high' | 'medium' | 'low' | 'potato';
}

/** Below this many logical cores the bed runs the lean tier. */
export const BED_LEAN_CORES_MAX = 4;
/** At or under this much device memory (GB) the bed runs the lean tier. */
export const BED_LEAN_MEMORY_GB_MAX = 4;

/**
 * Tier selection is a pure function of the hint: mobile is a budget, not a
 * gate (owner decision), so a coarse pointer, a small core count, small memory,
 * or the low/potato render tier all select `lean`. Unknown fields never demote.
 */
export function resolveBedQualityTier(hint: BedQualityHint): BedQualityTier {
  if (hint.renderQuality === 'low' || hint.renderQuality === 'potato') return 'lean';
  if (hint.coarsePointer) return 'lean';
  if (hint.hardwareConcurrency != null && hint.hardwareConcurrency <= BED_LEAN_CORES_MAX) return 'lean';
  if (hint.deviceMemoryGb != null && hint.deviceMemoryGb <= BED_LEAN_MEMORY_GB_MAX) return 'lean';
  return 'full';
}

// --- Drive curves -------------------------------------------------------------------------------------

/** WaveShaper curve resolution (odd so the centre sample is exactly zero). */
export const DRIVE_CURVE_SAMPLES = 4097;

/**
 * Unity-small-signal tanh: y = tanh(k·x) / k. The slope at zero is exactly 1,
 * so a stage at wet 0 and a stage at wet 1 carry the same level for quiet
 * material — drive adds harmonics, never gain (no makeup anywhere in the chain).
 * The curve is odd-symmetric and monotonic by construction.
 */
export function tanhDriveCurve(k: number, samples = DRIVE_CURVE_SAMPLES): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(samples);
  const kk = Math.max(1e-6, k);
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1;
    curve[i] = Math.tanh(kk * x) / kk;
  }
  return curve;
}

/** Closed-form ceiling of a unity-slope tanh curve at |x| = 1. */
export function tanhDriveCeiling(k: number): number {
  const kk = Math.max(1e-6, k);
  return Math.tanh(kk) / kk;
}

// --- Impulse responses --------------------------------------------------------------------------------

export interface ImpulseSpec {
  sampleRate: number;
  /** Total length including pre-delay, seconds. */
  seconds: number;
  /** Late-tail decay exponent: amplitude ∝ (1 − t/T)^decay (the shipped shape). */
  decay: number;
  /** Deterministic seed; the right channel derives a decorrelated sub-seed. */
  seed: number;
  /** Onset of the first reflection, ms. */
  preDelayMs: number;
  /** Early-reflection tap count (seeded times inside the window below). */
  earlyTaps: number;
  earlyWindowMs: readonly [min: number, max: number];
  /** Early tap amplitude (absolute, per tap). */
  earlyLevel: number;
  /** Late-tail noise amplitude at onset (absolute; taps should stand above it). */
  lateLevel: number;
  /** The diffuse tail builds in over this many ms after the pre-delay. */
  lateOnsetMs: number;
  /** One-pole lowpass over the late tail (the room's air), Hz. */
  hfDampHz: number;
  channels: 1 | 2;
}

const IMPULSE_SUBSEED_RIGHT = 0x9e3779b9;

function xorshift(seed: number): () => number {
  let s = (seed >>> 0) || 0x1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

/**
 * Early reflections + HF-damped late tail, deterministic per seed. The left
 * and right channels share tap TIMES (a room has one geometry) but carry
 * independent tail noise and independent tap signs, so the pair is
 * decorrelated without smearing the onset. Returns one Float32Array per channel.
 */
export function makeImpulseResponse(spec: ImpulseSpec): Float32Array<ArrayBuffer>[] {
  const frames = Math.max(1, Math.floor(spec.sampleRate * spec.seconds));
  const preDelay = Math.min(frames - 1, Math.floor((spec.preDelayMs / 1000) * spec.sampleRate));
  const tailFrames = Math.max(1, frames - preDelay);
  // One-pole lowpass coefficient for the tail damping.
  const damp = Math.exp((-2 * Math.PI * spec.hfDampHz) / spec.sampleRate);
  const tapRand = xorshift(spec.seed ^ 0x7461_7073);
  const [tapMin, tapMax] = spec.earlyWindowMs;
  const taps: number[] = [];
  for (let i = 0; i < spec.earlyTaps; i++) {
    const ms = tapMin + (tapMax - tapMin) * tapRand();
    taps.push(Math.min(frames - 1, preDelay + Math.floor((ms / 1000) * spec.sampleRate)));
  }
  const out: Float32Array<ArrayBuffer>[] = [];
  for (let ch = 0; ch < spec.channels; ch++) {
    const data = new Float32Array(frames);
    const rand = xorshift(ch === 0 ? spec.seed : (spec.seed ^ IMPULSE_SUBSEED_RIGHT) >>> 0);
    const signRand = xorshift((spec.seed ^ 0x7369_676e) + ch * 977);
    let lp = 0;
    const onsetFrames = Math.max(1, Math.floor((spec.lateOnsetMs / 1000) * spec.sampleRate));
    for (let i = preDelay; i < frames; i++) {
      const u = (i - preDelay) / tailFrames;
      const build = Math.min(1, (i - preDelay) / onsetFrames);
      const env = Math.pow(1 - u, spec.decay) * build * spec.lateLevel;
      const white = rand() * 2 - 1;
      lp = lp * damp + white * (1 - damp);
      data[i] = lp * env;
    }
    for (const at of taps) {
      const sign = signRand() < 0.5 ? -1 : 1;
      data[at] += sign * spec.earlyLevel;
    }
    out.push(data);
  }
  return out;
}

/** Ratio of energy above `hz` to total energy — the damping proof for tests. */
export function highBandEnergyFraction(data: Float32Array, sampleRate: number, hz: number): number {
  // Two cascaded first-order highpasses (12 dB/oct). Approximate by
  // construction — the value is the DIFFERENCE between two responses.
  const a = Math.exp((-2 * Math.PI * hz) / sampleRate);
  let y1 = 0;
  let y2 = 0;
  let x1Prev = 0;
  let y1Prev = 0;
  let high = 0;
  let total = 0;
  for (let i = 0; i < data.length; i++) {
    const x = data[i];
    y1 = a * (y1 + x - x1Prev);
    x1Prev = x;
    y2 = a * (y2 + y1 - y1Prev);
    y1Prev = y1;
    high += y2 * y2;
    total += x * x;
  }
  return total > 0 ? high / total : 0;
}
