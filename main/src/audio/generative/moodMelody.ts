import { applyOp, baseFigure, opLegal, type MotifFigure, type MotifGenome } from './motif.ts';
import type { ChordAnchor } from './theory.ts';
import { musicUnit, SALT_MOOD_CHAIN, SALT_MOOD_VEL } from './seededMusic.ts';
import {
  MELODY_CHAIN_POOL,
  MOOD_CHAIN_CANDIDATES,
  MOOD_MELODY_CENTER_SEMIS,
  MOOD_VELOCITY_FLOOR
} from './tuning.ts';

// --- Story-mood melody generalization (§10.5 / §8.5 note, P5) --------------------------------------
//
// A story mood's `melody.scale` (ScoreMood, semitones above the CURRENT CHORD
// ROOT — the shipped random walk's own convention) becomes a FILTER over the
// planet's motif genome: the genome's mode-free contour walks the mood scale's
// degree lattice instead of the planet mode, so the planet's tune haunts the
// story beats, played in the mood's mode. Every pitch is `chordRoot + a mood
// scale tone` BY CONSTRUCTION — the same never-a-wrong-note guarantee the
// shipped walk had, now with motif identity, development operators, and
// seeded determinism (no Math.random in any generative path).
//
// NO `MOODS` schema change: this module only reads `melody.scale`.

export interface MoodMelodyContext {
  /** The mood's melody scale, semitones above the current chord root. */
  scale: readonly number[];
  /** Current chord root, semitones above the mood root (ScoreMood chord space). */
  chordRoot: number;
  /** Wonder rail 0..1 (gates the rare retrograde, §7.2). */
  wonder: number;
}

export interface MoodPhraseNote {
  /** Onset in sixteenth slots from the phrase start (§7.1 canonical grid). */
  slot: number;
  durationSlots: number;
  /** Semitones above the mood root (caller applies its own octave shift). */
  semis: number;
  /** 0..1, seeded (MOOD_VELOCITY_FLOOR..1). */
  velocity: number;
}

const pc12 = (n: number): number => ((n % 12) + 12) % 12;

/** Octave-periodic degree lattice of a mood scale (unique pcs, ascending). */
export function moodScaleLattice(scale: readonly number[]): number[] {
  return [...new Set(scale.map(pc12))].sort((a, b) => a - b);
}

const latticeValue = (lattice: readonly number[], degree: number): number => {
  const n = lattice.length;
  const octave = Math.floor(degree / n);
  return lattice[degree - octave * n] + 12 * octave;
};

/** Lattice index whose pc is nearest `pc` (circular distance; ties → lower). */
function nearestLatticeIndex(lattice: readonly number[], pc: number): number {
  let best = 0;
  let bestDist = Infinity;
  for (let j = 0; j < lattice.length; j++) {
    const raw = Math.abs(lattice[j] - pc);
    const dist = Math.min(raw, 12 - raw);
    if (dist < bestDist) {
      bestDist = dist;
      best = j;
    }
  }
  return best;
}

/** Anchor interval above the chord root for a chord-anchor gene (quality-agnostic). */
const anchorInterval = (anchor: ChordAnchor): number =>
  anchor === 'root' ? 0 : anchor === 'fifth' ? 7 : 4;

/**
 * Seeded, legality-checked operator chain for this phrase (§7.2: the chain is
 * the unit of variation). Falls back to the base figure when every candidate
 * chain is illegal on this genome.
 */
function developFigure(
  genome: MotifGenome,
  planetSeed: number,
  phraseSlot: number,
  wonder: number
): MotifFigure {
  const pool = MELODY_CHAIN_POOL;
  const start = Math.floor(musicUnit(planetSeed, SALT_MOOD_CHAIN, phraseSlot) * pool.length);
  for (let i = 0; i < Math.min(MOOD_CHAIN_CANDIDATES, pool.length); i++) {
    const chain = pool[(start + i) % pool.length];
    let figure: MotifFigure | null = baseFigure(genome);
    for (const op of chain) {
      if (!opLegal(figure, op, wonder)) {
        figure = null;
        break;
      }
      figure = applyOp(figure, op, wonder);
    }
    if (figure) return figure;
  }
  return baseFigure(genome);
}

/**
 * Plan one mood-melody phrase: the planet's developed motif rendered onto the
 * mood's scale lattice. Anchored on the genome's start tone nearest the mood
 * register center, landing snapped to the genome's landing tone, the whole
 * phrase octave-clamped toward the center (the lattice is octave-periodic, so
 * the clamp preserves both contour and scale membership). Deterministic per
 * (planetSeed, phraseSlot, chordRoot, scale).
 */
export function planMoodPhrase(
  genome: MotifGenome,
  ctx: MoodMelodyContext,
  planetSeed: number,
  phraseSlot: number
): MoodPhraseNote[] {
  const lattice = moodScaleLattice(ctx.scale);
  if (lattice.length < 2) return []; // a degenerate scale cannot carry a tune
  const figure = developFigure(genome, planetSeed, phraseSlot, ctx.wonder);
  if (figure.notes.length === 0) return [];

  // Anchor: the start-tone degree, at the octave nearest the register center.
  const startIdx = nearestLatticeIndex(lattice, pc12(anchorInterval(genome.startTone)));
  let anchorDegree = startIdx;
  let bestDist = Infinity;
  for (let octave = -2; octave <= 3; octave++) {
    const d = startIdx + lattice.length * octave;
    const dist = Math.abs(latticeValue(lattice, d) - MOOD_MELODY_CENTER_SEMIS);
    if (dist < bestDist) {
      bestDist = dist;
      anchorDegree = d;
    }
  }

  const values = figure.notes.map((n) => latticeValue(lattice, anchorDegree + n.degreeOffset));

  // Landing snap (§7.1): the final note lands on the landing tone's nearest
  // lattice instance.
  if (values.length > 1) {
    const landIdx = nearestLatticeIndex(lattice, pc12(anchorInterval(genome.landTone)));
    const unsnapped = values[values.length - 1];
    let best = latticeValue(lattice, landIdx);
    let bestLand = Math.abs(best - unsnapped);
    for (let octave = -2; octave <= 3; octave++) {
      const v = latticeValue(lattice, landIdx + lattice.length * octave);
      const dist = Math.abs(v - unsnapped);
      if (dist < bestLand) {
        bestLand = dist;
        best = v;
      }
    }
    values[values.length - 1] = best;
  }

  // Whole-octave register clamp toward the center (developed chains like
  // octaveShift can fly; the lattice is octave-periodic so this is free).
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const octaveShift = 12 * Math.round((MOOD_MELODY_CENTER_SEMIS - mean) / 12);

  return figure.notes.map((n, i) => ({
    slot: n.slot,
    durationSlots: n.durationSlots,
    semis: ctx.chordRoot + values[i] + octaveShift,
    velocity:
      MOOD_VELOCITY_FLOOR +
      (1 - MOOD_VELOCITY_FLOOR) * musicUnit(planetSeed, SALT_MOOD_VEL, phraseSlot * 61 + i)
  }));
}
