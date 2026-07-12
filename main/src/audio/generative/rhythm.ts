import { musicUnit, SALT_HUMANIZE } from './seededMusic.ts';
import { HUMAN_JITTER_MS } from './tuning.ts';

// --- Rhythm engine (§7.1 cell library, §8.2 generators) --------------------------------------
//
// The curated rhythm-cell pool (Weir's lesson: curate the palette hard,
// generate the ARRANGEMENT), the Euclidean pattern generator E(k, n) with
// rotation as the variation operator, and seeded humanization. All pure; all
// onsets live on a canonical 16-slot (sixteenth-note, 4/4) bar grid — 6/8
// adaptation is the renderer's concern (P3).

/** Canonical grid: sixteenth slots per 4/4 bar. */
export const SLOTS_PER_BAR = 16;

export type RhythmCellId =
  | 'CELL_TIME'       // 4 even quarters — Inception
  | 'CELL_DAYONE'     // dotted long-short-short-long — Interstellar
  | 'CELL_TRESILLO'   // E(3,8)
  | 'CELL_CINQUILLO'  // E(5,8)
  | 'CELL_EIGHTS'     // even 8ths
  | 'CELL_HALF'       // 2 half notes
  | 'CELL_OFFBEAT'    // offbeat 8ths — ODESZA
  | 'CELL_GALLOP';    // 8th + two 16ths — chip-era friendly

export interface RhythmCell {
  id: RhythmCellId;
  /** Onset slots within one bar, ascending, 0..SLOTS_PER_BAR-1. */
  onsets: readonly number[];
}

/** The curated library (§7.1). Onsets in sixteenth slots. */
export const RHYTHM_CELLS: Record<RhythmCellId, RhythmCell> = {
  CELL_TIME: { id: 'CELL_TIME', onsets: [0, 4, 8, 12] },
  CELL_DAYONE: { id: 'CELL_DAYONE', onsets: [0, 6, 8, 10] },
  CELL_TRESILLO: { id: 'CELL_TRESILLO', onsets: [0, 6, 12] },
  CELL_CINQUILLO: { id: 'CELL_CINQUILLO', onsets: [0, 4, 6, 10, 12] },
  CELL_EIGHTS: { id: 'CELL_EIGHTS', onsets: [0, 2, 4, 6, 8, 10, 12, 14] },
  CELL_HALF: { id: 'CELL_HALF', onsets: [0, 8] },
  CELL_OFFBEAT: { id: 'CELL_OFFBEAT', onsets: [2, 6, 10, 14] },
  CELL_GALLOP: { id: 'CELL_GALLOP', onsets: [0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15] }
};

/** Stable draw order for the seeded cell pick. */
export const RHYTHM_CELL_IDS: readonly RhythmCellId[] = [
  'CELL_TIME', 'CELL_DAYONE', 'CELL_TRESILLO', 'CELL_CINQUILLO',
  'CELL_EIGHTS', 'CELL_HALF', 'CELL_OFFBEAT', 'CELL_GALLOP'
];

/**
 * Euclidean rhythm E(k, n): k onsets distributed maximally evenly over n
 * slots (Toussaint). Returns ascending onset slots; the k=0 and k≥n edges
 * degenerate sensibly ([] and every slot).
 */
export function euclid(k: number, n: number): number[] {
  const onsets: number[] = [];
  if (n <= 0 || k <= 0) return onsets;
  const kk = Math.min(k, n);
  for (let i = 0; i < n; i++) {
    if ((i * kk) % n < kk) onsets.push(i);
  }
  return onsets;
}

/**
 * Rotate a pattern of onset slots by `rotation` slots over an n-slot cycle —
 * THE Euclidean variation operator (§8.2: salted by quantized world position,
 * so travel turns the rhythm). Returns ascending slots.
 */
export function rotatePattern(onsets: readonly number[], n: number, rotation: number): number[] {
  const r = ((rotation % n) + n) % n;
  return onsets.map((slot) => (slot + r) % n).sort((a, b) => a - b);
}

/**
 * Seeded micro-timing jitter (§8.2): up to ±HUMAN_JITTER_MS × organic, in ms.
 * At organic 0 the grid is machine-perfect — chip eras are SUPPOSED to feel
 * quantized. Deterministic per (seed, noteIndex).
 */
export function humanizeOffsetMs(seed: number, noteIndex: number, organic: number): number {
  const o = Math.min(1, Math.max(0, organic));
  if (o === 0) return 0;
  return (musicUnit(seed, SALT_HUMANIZE, noteIndex) * 2 - 1) * HUMAN_JITTER_MS * o;
}
