import { describe, expect, it } from 'vitest';
import { deriveMotifGenome } from './motif.ts';
import { moodScaleLattice, planMoodPhrase, type MoodMelodyContext } from './moodMelody.ts';
import { MOOD_MELODY_CENTER_SEMIS, MOOD_VELOCITY_FLOOR } from './tuning.ts';

// --- Story-mood melody generalization (§10.5, P5) --------------------------------------------
//
// The mood's `melody.scale` FILTERS the planet's motif genome: every pitch is
// chordRoot + a mood scale tone BY CONSTRUCTION, the render is seeded (no
// Math.random), and two planets haunt the same beat with different tunes.

// Real scales from the shipped MOODS table (no schema change — we only read them).
const MOOD_SCALES: ReadonlyArray<readonly number[]> = [
  [0, 2, 3, 5, 7, 8, 10, 12], // voyage / ch1-raster (natural minor)
  [0, 2, 4, 7, 9, 12, 14], // ch3-forage (pentatonic-ish major)
  [0, 2, 4, 5, 7, 9, 11, 12], // a3-dawn (major)
  [0, 3, 6, 10, 12], // ch4-vigil (the detuned vigil)
  [0, 7, 12, 14, 19, 24] // celestial idle bed
];

const ctx = (scale: readonly number[], chordRoot = 0, wonder = 0.5): MoodMelodyContext => ({
  scale,
  chordRoot,
  wonder
});

const pc12 = (n: number): number => ((n % 12) + 12) % 12;

describe('mood-scale lattice', () => {
  it('reduces a scale to unique ascending pitch classes (octave duplicates dropped)', () => {
    expect(moodScaleLattice([0, 2, 4, 7, 9, 12, 14])).toEqual([0, 2, 4, 7, 9]);
    expect(moodScaleLattice([0, 7, 12, 14, 19, 24])).toEqual([0, 2, 7]);
  });
});

describe('never a wrong note (the filter law)', () => {
  it('every pitch of every phrase is chordRoot + a mood scale tone', () => {
    for (const scale of MOOD_SCALES) {
      const latticePcs = new Set(moodScaleLattice(scale));
      for (const seed of [5, 8, 10, 777]) {
        const genome = deriveMotifGenome(seed, 'verdant');
        for (let slot = 0; slot < 24; slot++) {
          for (const chordRoot of [0, 3, 8]) {
            const notes = planMoodPhrase(genome, ctx(scale, chordRoot), seed, slot);
            for (const n of notes) {
              expect(latticePcs.has(pc12(n.semis - chordRoot)), `scale ${scale} seed ${seed}`).toBe(true);
              expect(n.velocity).toBeGreaterThanOrEqual(MOOD_VELOCITY_FLOOR);
              expect(n.velocity).toBeLessThanOrEqual(1);
              expect(Number.isFinite(n.semis)).toBe(true);
            }
          }
        }
      }
    }
  });

  it('a degenerate one-tone scale composes silence instead of a wrong note', () => {
    const genome = deriveMotifGenome(5, 'verdant');
    expect(planMoodPhrase(genome, ctx([0, 12]), 5, 0)).toEqual([]);
  });
});

describe('determinism and identity (grammar law 2 / §7.1)', () => {
  it('replays byte-identically for the same (genome, seed, slot, chord)', () => {
    const genome = deriveMotifGenome(42, 'frozen');
    const a = planMoodPhrase(genome, ctx(MOOD_SCALES[0], 3), 42, 7);
    const b = planMoodPhrase(genome, ctx(MOOD_SCALES[0], 3), 42, 7);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.length).toBeGreaterThan(0);
  });

  it('two planets haunt the same mood with different tunes', () => {
    const a = deriveMotifGenome(5, 'verdant');
    const b = deriveMotifGenome(10, 'volcanic');
    const phraseA = planMoodPhrase(a, ctx(MOOD_SCALES[0]), 5, 0);
    const phraseB = planMoodPhrase(b, ctx(MOOD_SCALES[0]), 10, 0);
    expect(JSON.stringify(phraseA)).not.toBe(JSON.stringify(phraseB));
  });

  it('development varies phrases over time (the chain is the unit of variation)', () => {
    const genome = deriveMotifGenome(5, 'verdant');
    const rendered = new Set<string>();
    for (let slot = 0; slot < 16; slot++) {
      rendered.add(JSON.stringify(planMoodPhrase(genome, ctx(MOOD_SCALES[2]), 5, slot)));
    }
    expect(rendered.size).toBeGreaterThan(3);
  });
});

describe('register and rhythm discipline', () => {
  it('phrases stay near the mood register center and keep ascending onsets', () => {
    for (const seed of [5, 8, 10]) {
      const genome = deriveMotifGenome(seed);
      for (let slot = 0; slot < 12; slot++) {
        const notes = planMoodPhrase(genome, ctx(MOOD_SCALES[2]), seed, slot);
        if (notes.length === 0) continue;
        const mean = notes.reduce((acc, n) => acc + n.semis, 0) / notes.length;
        expect(Math.abs(mean - MOOD_MELODY_CENTER_SEMIS)).toBeLessThanOrEqual(12);
        for (let i = 1; i < notes.length; i++) {
          expect(notes[i].slot).toBeGreaterThan(notes[i - 1].slot);
          expect(notes[i - 1].durationSlots).toBeGreaterThan(0);
        }
      }
    }
  });
});
