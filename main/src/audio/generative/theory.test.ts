import { describe, expect, it } from 'vitest';
import {
  chromaticMediants,
  degreeTriad,
  isDiatonic,
  MODE_BRIGHTNESS_CHAIN,
  MODE_CADENCE_ROOTS,
  MODE_DEGREE_SETS,
  MODE_SCALES,
  modeTonicTriad,
  pcMod,
  plrTransform,
  tonnetzDistance,
  triadPcs,
  type ModeName,
  type TriadSpec
} from './theory.ts';

const MODES = Object.keys(MODE_SCALES) as ModeName[];

describe('mode brightness chain', () => {
  it('orders neighbors exactly one accidental apart', () => {
    for (let i = 1; i < MODE_BRIGHTNESS_CHAIN.length; i++) {
      const a = new Set(MODE_SCALES[MODE_BRIGHTNESS_CHAIN[i - 1]]);
      const b = new Set(MODE_SCALES[MODE_BRIGHTNESS_CHAIN[i]]);
      const diff = [...a].filter((x) => !b.has(x)).length + [...b].filter((x) => !a.has(x)).length;
      expect(diff, `${MODE_BRIGHTNESS_CHAIN[i - 1]} → ${MODE_BRIGHTNESS_CHAIN[i]}`).toBe(2);
    }
  });

  it('runs dark to bright', () => {
    expect(MODE_BRIGHTNESS_CHAIN[0]).toBe('phrygian');
    expect(MODE_BRIGHTNESS_CHAIN[MODE_BRIGHTNESS_CHAIN.length - 1]).toBe('lydian');
  });
});

describe('degree sets (§6.3 film-modal vocabulary)', () => {
  it('keeps every degree triad diatonic to its mode', () => {
    for (const mode of MODES) {
      for (const degree of MODE_DEGREE_SETS[mode]) {
        const triad = degreeTriad(0, degree);
        expect(isDiatonic(triad, 0, mode), `${mode} degree ${degree.root}`).toBe(true);
      }
    }
  });

  it('never contains a diminished triad (maj/min only, by construction)', () => {
    for (const mode of MODES) {
      for (const degree of MODE_DEGREE_SETS[mode]) {
        expect(['maj', 'min']).toContain(degree.quality);
      }
    }
  });

  it('has cadence roots that are a subset of the degree set, tonic included', () => {
    for (const mode of MODES) {
      const roots = MODE_DEGREE_SETS[mode].map((d) => d.root);
      for (const cadence of MODE_CADENCE_ROOTS[mode]) {
        expect(roots, `${mode} cadence ${cadence}`).toContain(cadence);
      }
      expect(MODE_CADENCE_ROOTS[mode]).toContain(0);
    }
  });

  it('starts every set on the tonic with mode-correct quality', () => {
    expect(modeTonicTriad(0, 'aeolian').quality).toBe('min');
    expect(modeTonicTriad(0, 'dorian').quality).toBe('min');
    expect(modeTonicTriad(0, 'mixolydian').quality).toBe('maj');
    expect(modeTonicTriad(0, 'lydian').quality).toBe('maj');
  });
});

describe('neo-Riemannian transforms', () => {
  const sample: TriadSpec[] = [];
  for (let pc = 0; pc < 12; pc++) {
    sample.push({ rootPc: pc, quality: 'maj' }, { rootPc: pc, quality: 'min' });
  }

  it('P, L, R are involutions', () => {
    for (const t of sample) {
      for (const op of ['P', 'L', 'R'] as const) {
        const back = plrTransform(plrTransform(t, op), op);
        expect(back.rootPc).toBe(t.rootPc);
        expect(back.quality).toBe(t.quality);
      }
    }
  });

  it('each transform moves exactly one voice by 1–2 semitones', () => {
    for (const t of sample) {
      for (const op of ['P', 'L', 'R'] as const) {
        const before = new Set(triadPcs(t));
        const after = new Set(triadPcs(plrTransform(t, op)));
        const gone = [...before].filter((pc) => !after.has(pc));
        const added = [...after].filter((pc) => !before.has(pc));
        expect(gone.length).toBe(1);
        expect(added.length).toBe(1);
        const move = Math.min(pcMod(added[0] - gone[0]), pcMod(gone[0] - added[0]));
        expect(move).toBeGreaterThanOrEqual(1);
        expect(move).toBeLessThanOrEqual(2);
      }
    }
  });

  it('tonnetz distance: zero to self, one to PLR images, symmetric', () => {
    for (const t of sample) {
      expect(tonnetzDistance(t, t)).toBe(0);
      for (const op of ['P', 'L', 'R'] as const) {
        const img = plrTransform(t, op);
        expect(tonnetzDistance(t, img)).toBe(1);
        expect(tonnetzDistance(img, t)).toBe(1);
      }
    }
  });

  it('chromatic mediants are same-quality, ±3/±4 roots, PLR chains ≤ 2', () => {
    for (const t of sample) {
      const mediants = chromaticMediants(t);
      expect(mediants.length).toBe(4);
      for (const m of mediants) {
        expect(m.quality).toBe(t.quality);
        const step = Math.min(pcMod(m.rootPc - t.rootPc), pcMod(t.rootPc - m.rootPc));
        expect([3, 4]).toContain(step);
        expect(tonnetzDistance(t, m)).toBeLessThanOrEqual(2);
      }
    }
  });
});
