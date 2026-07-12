import { describe, expect, it } from 'vitest';
import {
  applyOp,
  applyOpChain,
  baseFigure,
  deriveMotifGenome,
  figureRhythmMask,
  makeExtendOp,
  ostinatoCell,
  renderMotif,
  serializeOpChain,
  type MotifFigure,
  type MotifGenome,
  type MotifRenderContext
} from './motif.ts';
import { METER_44, METER_68 } from './transport.ts';
import { MODE_SCALES, pcMod } from './theory.ts';
import {
  ARCHETYPE_TEMPO_BANDS,
  CONTOUR_LEAP_MIN,
  CONTOUR_LEN_MAX,
  CONTOUR_LEN_MIN,
  CONTOUR_MAX_LEAPS,
  FRAGMENT_DEFAULT_NOTES,
  MOTIF_FINAL_DUR_SLOTS,
  MOTIF_MAX_BARS,
  MOTIF_MAX_NOTES,
  RETROGRADE_WONDER_GATE,
  TEMPO_MAX,
  TEMPO_MIN
} from './tuning.ts';

// A hand-built genome for operator tests (independent of the seeded draw).
const genome: MotifGenome = {
  contour: [2, -1, 3],
  rhythmCellId: 'CELL_TIME',
  startTone: 'fifth',
  landTone: 'root',
  baseTempo: 80,
  meter: METER_44
};

describe('genome derivation (§7.1)', () => {
  it('is deterministic per seed', () => {
    expect(deriveMotifGenome(42, 'verdant')).toEqual(deriveMotifGenome(42, 'verdant'));
  });

  it('respects every gene constraint across many seeds', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const g = deriveMotifGenome(seed);
      expect(g.contour.length).toBeGreaterThanOrEqual(CONTOUR_LEN_MIN);
      expect(g.contour.length).toBeLessThanOrEqual(CONTOUR_LEN_MAX);
      let leaps = 0;
      for (const iv of g.contour) {
        const mag = Math.abs(iv);
        expect(mag).toBeGreaterThanOrEqual(1);
        expect(mag).toBeLessThanOrEqual(5);
        if (mag >= CONTOUR_LEAP_MIN) leaps++;
      }
      expect(leaps).toBeLessThanOrEqual(CONTOUR_MAX_LEAPS);
      expect(['root', 'third', 'fifth']).toContain(g.startTone);
      expect(['root', 'fifth']).toContain(g.landTone);
      expect(g.baseTempo).toBeGreaterThanOrEqual(TEMPO_MIN);
      expect(g.baseTempo).toBeLessThanOrEqual(TEMPO_MAX);
      expect(g.meter).toEqual(METER_44); // no archetype → never 6/8
    }
  });

  it('draws tempo from the archetype band', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const g = deriveMotifGenome(seed, 'frozen');
      const [lo, hi] = ARCHETYPE_TEMPO_BANDS.frozen;
      expect(g.baseTempo).toBeGreaterThanOrEqual(lo);
      expect(g.baseTempo).toBeLessThanOrEqual(hi);
    }
  });

  it('gives 6/8 only to wonder-leaning archetypes, as a minority', () => {
    let oceanic68 = 0;
    for (let seed = 1; seed <= 200; seed++) {
      expect(deriveMotifGenome(seed, 'arid').meter).toEqual(METER_44);
      if (deriveMotifGenome(seed, 'oceanic').meter.sixteenthsPerBeat === METER_68.sixteenthsPerBeat) {
        oceanic68++;
      }
    }
    expect(oceanic68).toBeGreaterThan(0);
    expect(oceanic68).toBeLessThan(100); // a minority, not the default
  });

  it('makes two planets different musical places (construction law)', () => {
    const fingerprints = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) {
      const g = deriveMotifGenome(seed);
      fingerprints.add(`${g.contour.join(',')}|${g.rhythmCellId}`);
    }
    expect(fingerprints.size).toBeGreaterThan(40);
  });
});

describe('the base figure', () => {
  it('walks the contour onto the rhythm cell', () => {
    const fig = baseFigure(genome);
    expect(fig.notes.map((n) => n.degreeOffset)).toEqual([0, 2, 1, 4]);
    expect(fig.notes.map((n) => n.slot)).toEqual([0, 4, 8, 12]);
    expect(fig.notes.map((n) => n.durationSlots)).toEqual([4, 4, 4, MOTIF_FINAL_DUR_SLOTS]);
    expect(fig.bars).toBe(2); // the held final note crosses the bar line
  });

  it('wraps into later bars when the cell is sparser than the motif', () => {
    const slow: MotifGenome = { ...genome, rhythmCellId: 'CELL_HALF' };
    const fig = baseFigure(slow);
    expect(fig.notes.map((n) => n.slot)).toEqual([0, 8, 16, 24]);
    expect(fig.bars).toBe(2);
  });
});

describe('development operators (§7.2)', () => {
  const base = baseFigure(genome);

  it('invert mirrors around the first note and is an involution', () => {
    const inv = applyOp(base, { kind: 'invert' });
    expect(inv.notes.map((n) => n.degreeOffset)).toEqual([0, -2, -1, -4]);
    expect(applyOp(inv, { kind: 'invert' })).toEqual(base);
  });

  it('retrograde is wonder-gated and an involution once earned', () => {
    expect(applyOp(base, { kind: 'retrograde' }, RETROGRADE_WONDER_GATE - 0.1)).toEqual(base);
    const retro = applyOp(base, { kind: 'retrograde' }, 1);
    expect(retro.notes.map((n) => n.degreeOffset)).toEqual([0, -3, -2, -4]);
    expect(applyOp(retro, { kind: 'retrograde' }, 1)).toEqual(base);
  });

  it('augment doubles the rhythm; diminish undoes it; both respect legality', () => {
    const aug = applyOp(base, { kind: 'augment' });
    expect(aug.notes.map((n) => n.slot)).toEqual([0, 8, 16, 24]);
    expect(aug.bars).toBe(3); // 40 slots of content → 3 bars
    expect(applyOp(aug, { kind: 'diminish' })).toEqual(base);
    // Another augment would exceed MOTIF_MAX_BARS → identity.
    expect(aug.bars * 2).toBeGreaterThan(MOTIF_MAX_BARS);
    expect(applyOp(aug, { kind: 'augment' })).toEqual(aug);
  });

  it('diminish is illegal on an odd (16th-bearing) grid', () => {
    const gallop = baseFigure({ ...genome, rhythmCellId: 'CELL_GALLOP' });
    expect(applyOp(gallop, { kind: 'diminish' })).toEqual(gallop);
  });

  it('fragment keeps the prefix — the ostinato cell', () => {
    const frag = applyOp(base, { kind: 'fragment', amount: 3 });
    expect(frag.notes.length).toBe(3);
    expect(frag.notes.map((n) => n.degreeOffset)).toEqual([0, 2, 1]);
    expect(frag.notes[2].durationSlots).toBe(4); // keeps its gap — loopable
    expect(applyOp(base, { kind: 'fragment', amount: 1 })).toEqual(base); // too small → identity
    expect(ostinatoCell(genome, FRAGMENT_DEFAULT_NOTES).notes.length).toBe(FRAGMENT_DEFAULT_NOTES);
  });

  it('extend appends one interval after the held final note, capped at MOTIF_MAX_NOTES', () => {
    const ext = applyOp(base, { kind: 'extend', amount: -2 });
    expect(ext.notes.length).toBe(5);
    expect(ext.notes[4].degreeOffset).toBe(2);
    expect(ext.notes[4].slot).toBe(12 + MOTIF_FINAL_DUR_SLOTS);
    let fig: MotifFigure = base;
    for (let i = 0; i < 12; i++) fig = applyOp(fig, { kind: 'extend', amount: 1 });
    expect(fig.notes.length).toBe(MOTIF_MAX_NOTES);
  });

  it('transpose and octaveShift move degree space', () => {
    const up = applyOp(base, { kind: 'transpose', amount: 3 });
    expect(up.notes.map((n) => n.degreeOffset)).toEqual([3, 5, 4, 7]);
    const oct = applyOp(base, { kind: 'octaveShift', amount: -1 });
    expect(oct.notes.map((n) => n.degreeOffset)).toEqual([-7, -5, -6, -3]);
  });

  it('serializes chains in doc notation and chains apply in order', () => {
    const ops = [{ kind: 'fragment' as const, amount: 3 }, { kind: 'diminish' as const }];
    expect(serializeOpChain(ops)).toBe('fragment(3)+diminish');
    const zimmer = applyOpChain(base, ops);
    expect(zimmer.notes.map((n) => n.slot)).toEqual([0, 2, 4]);
    expect(zimmer.bars).toBe(1);
  });

  it('gene-consistent extend draws are seeded and leap-law-abiding', () => {
    const leapy: MotifGenome = { ...genome, contour: [4, 1, -2] };
    for (let bar = 0; bar < 64; bar++) {
      const op = makeExtendOp(leapy, 777, bar);
      expect(op).toEqual(makeExtendOp(leapy, 777, bar));
      expect(Math.abs(op.amount!)).toBeLessThan(CONTOUR_LEAP_MIN);
    }
    const mags = new Set<number>();
    for (let bar = 0; bar < 64; bar++) mags.add(Math.abs(makeExtendOp(genome, 777, bar).amount!));
    expect(mags.size).toBeGreaterThan(1);
  });
});

describe('rendering (§7.1: mode-free contour, the mode/chord render it)', () => {
  const ctx: MotifRenderContext = {
    tonicPc: 0,
    mode: 'aeolian',
    chordRootPc: 0,
    chordQuality: 'min',
    anchorSemis: 12,
    snapLanding: true
  };

  it('anchors on the start tone and lands on the landing tone', () => {
    const rendered = renderMotif(baseFigure(genome), genome, ctx);
    expect(pcMod(rendered[0].semis)).toBe(7); // starts on the 5th
    expect(pcMod(rendered[rendered.length - 1].semis)).toBe(0); // lands on the root
  });

  it('keeps every pitch inside the mode scale (never a wrong note)', () => {
    for (const mode of ['aeolian', 'dorian', 'mixolydian', 'lydian'] as const) {
      const scalePcs = new Set(MODE_SCALES[mode].map((iv) => pcMod(iv)));
      const rendered = renderMotif(baseFigure(genome), genome, { ...ctx, mode });
      for (const note of rendered) expect(scalePcs.has(pcMod(note.semis))).toBe(true);
    }
  });

  it('places the anchor nearest the requested register', () => {
    const low = renderMotif(baseFigure(genome), genome, { ...ctx, anchorSemis: 12 });
    const high = renderMotif(baseFigure(genome), genome, { ...ctx, anchorSemis: 24 });
    expect(low[0].semis).toBe(7);
    expect(high[0].semis).toBe(19);
  });

  it('survives mode drift: the same figure renders in any mode', () => {
    const a = renderMotif(baseFigure(genome), genome, ctx);
    const b = renderMotif(baseFigure(genome), genome, { ...ctx, mode: 'dorian' });
    expect(a.length).toBe(b.length);
    expect(a.map((n) => n.slot)).toEqual(b.map((n) => n.slot));
  });

  it('snaps a chromatic (mediant) anchor to the nearest scale degree', () => {
    // E major over A-aeolian: root pc 4 is not in the scale; nearest is pc 3.
    const rendered = renderMotif(baseFigure(genome), { ...genome, startTone: 'root' }, {
      ...ctx,
      chordRootPc: 4,
      chordQuality: 'maj',
      snapLanding: false
    });
    expect(pcMod(rendered[0].semis)).toBe(3);
  });

  it('does not snap the landing of a looping cell', () => {
    const cell = ostinatoCell(genome, 3);
    const rendered = renderMotif(cell, genome, { ...ctx, snapLanding: false });
    // Degree offsets [0, 2, 1] from the 5th (degree 4 in aeolian): 7, 10, 8.
    expect(rendered.map((n) => n.semis)).toEqual([7, 10, 8]);
  });

  it('rhythm fingerprints differ across developments', () => {
    const base = baseFigure(genome);
    expect(figureRhythmMask(base)).not.toBe(figureRhythmMask(applyOp(base, { kind: 'augment' })));
    expect(figureRhythmMask(base)).toBe(figureRhythmMask(applyOp(base, { kind: 'invert' })));
  });
});
