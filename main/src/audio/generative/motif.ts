import type { ArchetypeId } from '../../game/data/planetArchetypes.ts';
import { fnv1a32, seededUnit } from '../../utils/worldCoordinates.ts';
import {
  chordAnchorPc,
  MODE_SCALES,
  pcMod,
  type ChordAnchor,
  type ChordQuality,
  type ModeName
} from './theory.ts';
import { RHYTHM_CELL_IDS, RHYTHM_CELLS, SLOTS_PER_BAR, type RhythmCellId } from './rhythm.ts';
import { METER_44, METER_68, type Meter } from './transport.ts';
import {
  musicUnit,
  SALT_ANCHOR_LAND,
  SALT_ANCHOR_START,
  SALT_CONTOUR_LEN,
  SALT_CONTOUR_SIGN,
  SALT_CONTOUR_STEP,
  SALT_EXTEND_SIGN,
  SALT_EXTEND_STEP,
  SALT_METER,
  SALT_RHYTHM_CELL,
  SALT_TEMPO,
  seededPickWeighted
} from './seededMusic.ts';
import {
  ANCHOR_LAND_WEIGHTS,
  ANCHOR_START_WEIGHTS,
  ARCHETYPE_TEMPO_BANDS,
  CONTOUR_LEAP_MIN,
  CONTOUR_LEN_MAX,
  CONTOUR_LEN_MIN,
  CONTOUR_MAX_LEAPS,
  CONTOUR_STEP_WEIGHTS,
  DEFAULT_TEMPO_BAND,
  FRAGMENT_MIN_NOTES,
  METER_68_ANOMALY_P,
  METER_68_ARCHETYPES,
  METER_68_P,
  MOTIF_FINAL_DUR_SLOTS,
  MOTIF_MAX_BARS,
  MOTIF_MAX_NOTES,
  RETROGRADE_WONDER_GATE,
  TEMPO_MAX,
  TEMPO_MIN
} from './tuning.ts';

// --- Motif DNA (§7.1) and development operators (§7.2) ----------------------------------------
//
// The genome is drawn ONCE per planet from the seed alone — two planets are
// different musical PLACES by construction. The contour is stored in SCALE
// STEPS, mode-free: the current mode/chord renders it, so the same tune
// survives mode drift and era change. The phrase planner never regenerates
// the motif; it DEVELOPS it through operator chains — the unit of variation.

export interface MotifGenome {
  /** Directed contour intervals in scale steps (3–5; at most one leap ≥ 4). */
  contour: number[];
  rhythmCellId: RhythmCellId;
  /** Start chord tone (5th 50% / root 30% / 3rd 20% — the yearning shape). */
  startTone: ChordAnchor;
  /** Landing chord tone (root 80% / 5th 20%). */
  landTone: ChordAnchor;
  /** Sandbox base tempo, bpm, from the archetype band (§8.1). */
  baseTempo: number;
  meter: Meter;
}

/** Draw the planet's motif genome from its seed (deterministic identity). */
export function deriveMotifGenome(planetSeed: number, archetype?: ArchetypeId): MotifGenome {
  const lenSpan = CONTOUR_LEN_MAX - CONTOUR_LEN_MIN + 1;
  const len = CONTOUR_LEN_MIN +
    Math.min(lenSpan - 1, Math.floor(seededUnit(planetSeed, SALT_CONTOUR_LEN) * lenSpan));
  const contour: number[] = [];
  let leaps = 0;
  for (let i = 0; i < len; i++) {
    const weights = leaps >= CONTOUR_MAX_LEAPS
      ? CONTOUR_STEP_WEIGHTS.filter(([steps]) => steps < CONTOUR_LEAP_MIN)
      : CONTOUR_STEP_WEIGHTS;
    const magnitude = seededPickWeighted(weights, musicUnit(planetSeed, SALT_CONTOUR_STEP, i));
    if (magnitude >= CONTOUR_LEAP_MIN) leaps++;
    const sign = musicUnit(planetSeed, SALT_CONTOUR_SIGN, i) < 0.5 ? -1 : 1;
    contour.push(sign * magnitude);
  }

  const cellIndex = Math.min(
    RHYTHM_CELL_IDS.length - 1,
    Math.floor(seededUnit(planetSeed, SALT_RHYTHM_CELL) * RHYTHM_CELL_IDS.length)
  );
  const startTone = seededPickWeighted(ANCHOR_START_WEIGHTS, seededUnit(planetSeed, SALT_ANCHOR_START));
  const landTone = seededPickWeighted(ANCHOR_LAND_WEIGHTS, seededUnit(planetSeed, SALT_ANCHOR_LAND));

  const band = archetype ? ARCHETYPE_TEMPO_BANDS[archetype] : DEFAULT_TEMPO_BAND;
  const baseTempo = Math.min(
    TEMPO_MAX,
    Math.max(TEMPO_MIN, Math.round(band[0] + seededUnit(planetSeed, SALT_TEMPO) * (band[1] - band[0])))
  );

  const meterEligible = archetype != null && METER_68_ARCHETYPES.includes(archetype);
  const meterP = archetype === 'anomaly' ? METER_68_ANOMALY_P : METER_68_P;
  const meter = meterEligible && seededUnit(planetSeed, SALT_METER) < meterP ? METER_68 : METER_44;

  return { contour, rhythmCellId: RHYTHM_CELL_IDS[cellIndex], startTone, landTone, baseTempo, meter };
}

// --- The figure: a developed form of the motif ---------------------------------------------------

export interface MotifNote {
  /** Onset slot on the canonical sixteenth grid (may cross into later bars). */
  slot: number;
  /** Held duration in slots (gap to the next onset; final note holds MOTIF_FINAL_DUR_SLOTS). */
  durationSlots: number;
  /** Scale-degree offset from the anchor tone (first note of the BASE figure = 0). */
  degreeOffset: number;
}

export interface MotifFigure {
  notes: MotifNote[];
  /** Bars the figure spans on the canonical grid. */
  bars: number;
}

function figureBars(notes: readonly MotifNote[]): number {
  if (notes.length === 0) return 1;
  const last = notes[notes.length - 1];
  return Math.max(1, Math.ceil((last.slot + last.durationSlots) / SLOTS_PER_BAR));
}

/**
 * The base figure: the contour walked from the anchor (N = contour + 1
 * notes), placed on the rhythm cell's onsets, wrapping into further bars when
 * the cell has fewer onsets than the motif has notes.
 */
export function baseFigure(genome: MotifGenome): MotifFigure {
  const cell = RHYTHM_CELLS[genome.rhythmCellId];
  const noteCount = genome.contour.length + 1;
  const notes: MotifNote[] = [];
  let degree = 0;
  for (let i = 0; i < noteCount; i++) {
    if (i > 0) degree += genome.contour[i - 1];
    const slot = cell.onsets[i % cell.onsets.length] + SLOTS_PER_BAR * Math.floor(i / cell.onsets.length);
    notes.push({ slot, durationSlots: 0, degreeOffset: degree });
  }
  for (let i = 0; i < notes.length; i++) {
    notes[i].durationSlots =
      i < notes.length - 1 ? notes[i + 1].slot - notes[i].slot : MOTIF_FINAL_DUR_SLOTS;
  }
  return { notes, bars: figureBars(notes) };
}

// --- Development operators (§7.2) ------------------------------------------------------------------

export type MotifOpKind =
  | 'transpose'    // diatonic shift by `amount` scale steps
  | 'invert'       // contour mirrored around the first note
  | 'augment'      // rhythm ×2
  | 'diminish'     // rhythm ×0.5 (legal only on an even grid)
  | 'fragment'     // keep the first `amount` notes — the ostinato cell
  | 'extend'       // append one gene-consistent interval of `amount` steps
  | 'octaveShift'  // ± `amount` octaves (degree space: ±7 per octave)
  | 'retrograde';  // pitch order reversed (rare, wonder-gated)

export interface MotifOp {
  kind: MotifOpKind;
  /** transpose: steps; fragment: n notes; extend: signed interval; octaveShift: ±octaves. */
  amount?: number;
}

/** Doc-notation serialization ("fragment(3)+diminish") — the gesture identity. */
export function serializeOpChain(ops: readonly MotifOp[]): string {
  return ops.map((op) => (op.amount != null ? `${op.kind}(${op.amount})` : op.kind)).join('+');
}

/** Is `op` legal on `figure`? (Illegal ops apply as identity — choosers pre-filter.) */
export function opLegal(figure: MotifFigure, op: MotifOp, wonder = 0): boolean {
  switch (op.kind) {
    case 'augment':
      return figure.bars * 2 <= MOTIF_MAX_BARS;
    case 'diminish':
      return figure.notes.every((n) => n.slot % 2 === 0 && n.durationSlots % 2 === 0);
    case 'fragment': {
      const n = op.amount ?? 0;
      return n >= FRAGMENT_MIN_NOTES && n < figure.notes.length;
    }
    case 'extend':
      return figure.notes.length < MOTIF_MAX_NOTES;
    case 'retrograde':
      return wonder >= RETROGRADE_WONDER_GATE;
    default:
      return true;
  }
}

/** Apply one operator (illegal → identity). Never mutates the input figure. */
export function applyOp(figure: MotifFigure, op: MotifOp, wonder = 0): MotifFigure {
  if (!opLegal(figure, op, wonder)) return figure;
  const notes = figure.notes.map((n) => ({ ...n }));
  switch (op.kind) {
    case 'transpose': {
      const steps = op.amount ?? 0;
      for (const n of notes) n.degreeOffset += steps;
      break;
    }
    case 'invert': {
      const pivot = notes[0]?.degreeOffset ?? 0;
      for (const n of notes) n.degreeOffset = 2 * pivot - n.degreeOffset;
      break;
    }
    case 'augment': {
      for (const n of notes) {
        n.slot *= 2;
        n.durationSlots *= 2;
      }
      break;
    }
    case 'diminish': {
      for (const n of notes) {
        n.slot /= 2;
        n.durationSlots /= 2;
      }
      break;
    }
    case 'fragment': {
      notes.length = op.amount ?? notes.length;
      break;
    }
    case 'extend': {
      const last = notes[notes.length - 1];
      notes.push({
        slot: last.slot + last.durationSlots,
        durationSlots: MOTIF_FINAL_DUR_SLOTS,
        degreeOffset: last.degreeOffset + (op.amount ?? 1)
      });
      break;
    }
    case 'octaveShift': {
      const degrees = 7 * (op.amount ?? 0);
      for (const n of notes) n.degreeOffset += degrees;
      break;
    }
    case 'retrograde': {
      const offsets = notes.map((n) => n.degreeOffset).reverse();
      const rebase = offsets[0] ?? 0;
      for (let i = 0; i < notes.length; i++) notes[i].degreeOffset = offsets[i] - rebase;
      break;
    }
  }
  return { notes, bars: figureBars(notes) };
}

/** Apply an operator CHAIN — the unit of variation (§7.2). */
export function applyOpChain(figure: MotifFigure, ops: readonly MotifOp[], wonder = 0): MotifFigure {
  let out = figure;
  for (const op of ops) out = applyOp(out, op, wonder);
  return out;
}

/**
 * A gene-consistent extend interval (§7.2): drawn from the contour weight
 * set, leap magnitudes excluded when the genome already carries its leap.
 */
export function makeExtendOp(genome: MotifGenome, planetSeed: number, barIndex: number): MotifOp {
  const hasLeap = genome.contour.some((iv) => Math.abs(iv) >= CONTOUR_LEAP_MIN);
  const weights = hasLeap
    ? CONTOUR_STEP_WEIGHTS.filter(([steps]) => steps < CONTOUR_LEAP_MIN)
    : CONTOUR_STEP_WEIGHTS;
  const magnitude = seededPickWeighted(weights, musicUnit(planetSeed, SALT_EXTEND_STEP, barIndex));
  const sign = musicUnit(planetSeed, SALT_EXTEND_SIGN, barIndex) < 0.5 ? -1 : 1;
  return { kind: 'extend', amount: sign * magnitude };
}

/** The ostinato voice is always fragment(motif) (§7.2). */
export function ostinatoCell(genome: MotifGenome, n: number): MotifFigure {
  return applyOp(baseFigure(genome), { kind: 'fragment', amount: n });
}

/** Rhythm fingerprint of a figure (feeds the §7.3 phrase hash). */
export function figureRhythmMask(figure: MotifFigure): number {
  return fnv1a32(figure.notes.map((n) => `${n.slot}:${n.durationSlots}`).join('.'));
}

// --- Rendering: mode/chord realize the mode-free contour (§7.1) ------------------------------------

export interface MotifRenderContext {
  tonicPc: number;
  mode: ModeName;
  chordRootPc: number;
  chordQuality: ChordQuality;
  /** Absolute semitone (above A1) the anchor tone should sit nearest. */
  anchorSemis: number;
  /** Snap the final note to the landing tone (full statements yes; looping cells no). */
  snapLanding: boolean;
}

export interface RenderedNote {
  slot: number;
  durationSlots: number;
  /** Semitones above A1. */
  semis: number;
}

/** Semitone of absolute scale degree D (…-1, 0..6, 7…) of `mode` on `tonicPc`. */
function pitchOfDegree(tonicPc: number, scale: readonly number[], degree: number): number {
  const octave = Math.floor(degree / 7);
  const step = degree - octave * 7;
  return tonicPc + 12 * octave + scale[step];
}

/** Scale-degree index (0..6) whose pc is nearest `pc` (ties → lower degree). */
function nearestDegreeIndex(tonicPc: number, scale: readonly number[], pc: number): number {
  let best = 0;
  let bestDist = Infinity;
  for (let j = 0; j < scale.length; j++) {
    const scalePc = pcMod(tonicPc + scale[j]);
    const raw = Math.abs(scalePc - pc);
    const dist = Math.min(raw, 12 - raw);
    if (dist < bestDist) {
      bestDist = dist;
      best = j;
    }
  }
  return best;
}

/**
 * Render a figure to pitches: anchor the first note on the start chord tone
 * nearest `anchorSemis`, walk the degree offsets along the CURRENT mode, and
 * (for full statements) snap the landing note to the landing chord tone
 * nearest where the contour ended. Every pitch is a scale tone by
 * construction (anchor snaps to the nearest degree when a mediant chord goes
 * chromatic) — never a wrong note.
 */
export function renderMotif(
  figure: MotifFigure,
  genome: MotifGenome,
  ctx: MotifRenderContext
): RenderedNote[] {
  if (figure.notes.length === 0) return [];
  const scale = MODE_SCALES[ctx.mode];
  const startPc = chordAnchorPc(ctx.chordRootPc, ctx.chordQuality, genome.startTone);
  const startIdx = nearestDegreeIndex(ctx.tonicPc, scale, startPc);
  // Octave placement: the anchor instance nearest anchorSemis.
  let anchorDegree = startIdx;
  let bestDist = Infinity;
  for (let octave = -2; octave <= 6; octave++) {
    const d = startIdx + 7 * octave;
    const dist = Math.abs(pitchOfDegree(ctx.tonicPc, scale, d) - ctx.anchorSemis);
    if (dist < bestDist) {
      bestDist = dist;
      anchorDegree = d;
    }
  }
  const rendered: RenderedNote[] = figure.notes.map((n) => ({
    slot: n.slot,
    durationSlots: n.durationSlots,
    semis: pitchOfDegree(ctx.tonicPc, scale, anchorDegree + n.degreeOffset)
  }));
  if (ctx.snapLanding && rendered.length > 1) {
    const landPc = chordAnchorPc(ctx.chordRootPc, ctx.chordQuality, genome.landTone);
    const landIdx = nearestDegreeIndex(ctx.tonicPc, scale, landPc);
    const unsnapped = rendered[rendered.length - 1].semis;
    let best = pitchOfDegree(ctx.tonicPc, scale, landIdx);
    let bestLandDist = Math.abs(best - unsnapped);
    for (let octave = -2; octave <= 6; octave++) {
      const pitch = pitchOfDegree(ctx.tonicPc, scale, landIdx + 7 * octave);
      const dist = Math.abs(pitch - unsnapped);
      if (dist < bestLandDist) {
        bestLandDist = dist;
        best = pitch;
      }
    }
    rendered[rendered.length - 1].semis = best;
  }
  return rendered;
}
