import { Effect } from 'postprocessing';
import { Uniform, Color } from 'three';
import type { DeathCause } from '../../game/systems/deathSequence.ts';

// --- Death render pass (perception decompile) ---------------------------------
//
// The visual half of the death sequence on tiers with the post composer
// (ULTRA/HIGH): the COMPOSED FRAME ITSELF decompiles toward the substrate.
// Driven by a single `uProgress` 0..1 from deathSequence, staged inside the
// shader so one signal carries the whole arc:
//
//   p 0.04→0.42  QUANTIZE — the frame mosaics into glyph cells (perception
//                 loses continuous resolution first).
//   p 0.34→0.85  TOKENIZE — each cell decodes to a 4x5 bitmap glyph selected
//                 by its own luminance (blank . : + x 1 0 # █). The world is
//                 still THERE — it is just being read, not rendered.
//   p 0.45→0.95  DRAIN — cell color collapses to green phosphor (the first
//                 terminal: death re-descends the fidelity ladder), inflected
//                 by the cause tint. Slow column drift + scanlines + flicker
//                 finish the CRT read.
//
// A small fraction of cells decode the WRONG glyph each beat (misprediction
// shimmer); `uShimmer` spikes it during rewake — "minor discrepancies are
// expected". Glyph bitmaps are 20-bit floats (bit = col + 4*rowFromTop,
// generated + preview-verified offline), exact well below 2^24.
//
// No-op by uniform: `uProgress <= 0` returns the input unchanged, so the merged
// effect pass costs a single uniform branch when nobody is dying. Samples
// `inputBuffer`/`resolution` directly (same as PainterlyEffect/Underwater).

const fragmentShader = /* glsl */ `
  uniform float uProgress;  // 0..1 master decompile (deathSequence intensity)
  uniform float uTime;      // seconds
  uniform float uRows;      // glyph rows down the frame (cell = res.y / uRows)
  uniform vec3  uPhosphor;  // terminal green (pre-ACES, slightly hot)
  uniform vec3  uCauseTint; // cause inflection, mixed lightly into the phosphor
  uniform float uShimmer;   // extra misprediction rate (rewake)

  float hash21(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }

  // 4x5 bitmap decode. cellUv.y = 0 at the glyph BOTTOM (GL), masks are
  // authored top-down, so flip the row.
  float glyphBit(float g, vec2 cellUv) {
    float c = floor(cellUv.x * 4.0);
    float r = 4.0 - floor(cellUv.y * 5.0);
    float bit = c + 4.0 * r;
    return floor(mod(g / exp2(bit), 2.0));
  }

  // Luminance ramp: blank . : + x 1 0 # █  (the substrate keeps binary digits
  // in the middle of the ramp — most of a dying frame reads as ones and zeros).
  float glyphMask(float level, vec2 cellUv) {
    if (level < 0.5) return 0.0;
    float g;
    if      (level < 1.5) g = 8192.0;     // .
    else if (level < 2.5) g = 8224.0;     // :
    else if (level < 3.5) g = 10016.0;    // +
    else if (level < 4.5) g = 21072.0;    // x
    else if (level < 5.5) g = 467506.0;   // 1
    else if (level < 6.5) g = 432534.0;   // 0
    else if (level < 7.5) g = 390645.0;   // #
    else                  g = 1048575.0;  // █
    return glyphBit(g, cellUv);
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    float p = uProgress;
    if (p <= 0.001) { outputColor = inputColor; return; }

    float cellPx = resolution.y / uRows;
    vec2 px = uv * resolution;
    vec2 cell = floor(px / cellPx);
    vec2 cellUv = fract(px / cellPx);
    vec2 cellCenter = (cell + 0.5) * cellPx / resolution;

    // A. QUANTIZE — mosaic the frame at glyph-cell resolution.
    vec3 quant = texture2D(inputBuffer, cellCenter).rgb;
    float qm = smoothstep(0.04, 0.42, p);
    vec3 col = mix(inputColor.rgb, quant, qm);

    // The cell's own brightness picks its glyph.
    float lum = clamp(dot(quant, vec3(0.299, 0.587, 0.114)), 0.0, 1.0);
    float level = floor(lum * 8.001);

    // Misprediction: a few cells decode the wrong glyph each beat; the rate
    // spikes during rewake (the re-rendered world is a fresh guess).
    float rehash = hash21(cell + floor(uTime * 5.0));
    float rate = 0.04 + 0.30 * uShimmer;
    if (rehash < rate) level = floor((rehash / max(rate, 1e-4)) * 8.999);

    float ink = glyphMask(level, cellUv);

    // Column drift: dim brightness heads sinking down the frame at full
    // substrate — the wake trails above each head and wraps.
    float colSeed = hash21(vec2(cell.x, 3.7));
    float head = fract(colSeed * 9.0 - uTime * (0.05 + 0.14 * colSeed));
    float yNorm = (cell.y * cellPx) / resolution.y;
    float glow = pow(1.0 - fract(yNorm - head), 8.0);
    float rainAmt = smoothstep(0.70, 1.0, p);

    // B/C. TOKENIZE + DRAIN — glyphs keep their cell's color early, collapse
    // to phosphor late.
    vec3 tint = mix(uPhosphor, uCauseTint, 0.22);
    float drain = smoothstep(0.45, 0.95, p);
    vec3 glyphCol = mix(
      quant * (0.55 + 0.75 * ink),
      tint * (0.30 + 0.95 * lum) * ink,
      drain
    );
    glyphCol += tint * ink * glow * rainAmt * 0.45;

    // Ghost static: EMPTY cells catch faint random glyphs near the drift
    // heads, so dark regions read as live substrate instead of dead black.
    float ghostLevel = 1.0 + floor(hash21(cell * 1.7 + floor(uTime * 2.0)) * 6.9);
    float ghostInk = glyphMask(ghostLevel, cellUv) * (1.0 - ink);
    glyphCol += tint * ghostInk * (0.03 + glow * 0.14) * rainAmt;

    float gm = smoothstep(0.34, 0.85, p);
    col = mix(col, glyphCol, gm);

    // CRT finish: scanlines, phosphor flicker, gentle vignette — all scaled
    // by depth so the pass stays invisible at low progress.
    float scan = 0.90 + 0.10 * sin(px.y * 1.9);
    float flicker = 0.95 + 0.05 * sin(uTime * 29.0 + uv.y * 5.0);
    float vig = 0.72 + 0.28 * (1.0 - smoothstep(0.35, 1.0, length(uv - 0.5) * 1.35));
    col *= mix(1.0, scan * flicker * vig, gm * 0.85);

    outputColor = vec4(col, inputColor.a);
  }
`;

/** Cause inflection tints (pre-ACES, matched to the hot phosphor scale). */
const DEATH_CAUSE_TINTS: Record<DeathCause, Color> = {
  cold: new Color(0.75, 1.15, 1.45),     // ice-white blue
  drowning: new Color(0.35, 1.05, 1.30), // deep cyan
  lava: new Color(1.55, 0.85, 0.30),     // amber
  unknown: new Color(0.55, 1.35, 0.65)   // the phosphor itself
};

export class DeathRenderEffect extends Effect {
  constructor() {
    super('DeathRenderEffect', fragmentShader, {
      uniforms: new Map<string, Uniform>([
        ['uProgress', new Uniform(0)],
        ['uTime', new Uniform(0)],
        ['uRows', new Uniform(62)],
        ['uPhosphor', new Uniform(new Color(0.55, 1.35, 0.65))],
        ['uCauseTint', new Uniform(new Color(0.55, 1.35, 0.65))],
        ['uShimmer', new Uniform(0)]
      ])
    });
    activeDeathRender = this;
  }

  /** Per-frame drive (PostFX useFrame). shimmer: 1 during rewake. */
  setFrame(progress: number, time: number, cause: DeathCause, shimmer: number) {
    const p = Math.min(1, Math.max(0, progress));
    this.uniforms.get('uProgress')!.value = p;
    if (p <= 0) return; // parked — skip the remaining writes
    this.uniforms.get('uTime')!.value = time;
    this.uniforms.get('uShimmer')!.value = shimmer;
    (this.uniforms.get('uCauseTint')!.value as Color).copy(DEATH_CAUSE_TINTS[cause]);
  }
}

// Module-level handle (props/ref can't cross wrapEffect — see ColorGradeEffect).
let activeDeathRender: DeathRenderEffect | null = null;
export function getDeathRender(): DeathRenderEffect | null {
  return activeDeathRender;
}
