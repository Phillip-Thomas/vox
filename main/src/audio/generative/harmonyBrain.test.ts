import { describe, expect, it } from 'vitest';
import { getMusicChord } from '../musicPrimitives.ts';
import {
  advanceHarmonyBar,
  createHarmonyBrain,
  derivePlanetKey,
  publishHarmony,
  type HarmonyBarEvent,
  type HarmonyBrainState,
  type HarmonyRails
} from './harmonyBrain.ts';
import {
  degreeTriad,
  MODE_BRIGHTNESS_CHAIN,
  MODE_DEGREE_SETS,
  pcMod,
  triadId,
  type ModeName
} from './theory.ts';
import {
  CHORD_TABU,
  IONIAN_WARMTH_GATE,
  MODE_DRIFT_MIN_PHRASES,
  PHRASE_BARS,
  TENSION_COLOR_GATE,
  TENSION_PHRYGIAN_GATE,
  VL_COMMON_TONE_TENSION,
  VL_TOTAL_MAX,
  VL_VOICE_MAX
} from './tuning.ts';

// Deterministic rail schedules (pure formulas — reproducible by construction).
const calm = (): HarmonyRails => ({ tension: 0.2, energy: 0.4, warmth: 0.5, chroma: 0.5, golden: 0 });
const varied = (i: number): HarmonyRails => ({
  tension: 0.5 + 0.5 * Math.sin(i * 0.37),
  energy: 0.5 + 0.5 * Math.sin(i * 0.13 + 1),
  warmth: 0.5 + 0.5 * Math.sin(i * 0.05 + 2),
  chroma: 0.5 + 0.5 * Math.sin(i * 0.21 + 3),
  golden: Math.max(0, Math.sin(i * 0.02))
});
const warm = (): HarmonyRails => ({ tension: 0.1, energy: 0.4, warmth: 0.9, chroma: 0.6, golden: 0.2 });

function runBars(
  seed: number,
  bars: number,
  railsFn: (bar: number) => HarmonyRails
): { state: HarmonyBrainState; log: HarmonyBarEvent[] } {
  const state = createHarmonyBrain(seed);
  const log: HarmonyBarEvent[] = [];
  for (let i = 0; i < bars; i++) log.push(advanceHarmonyBar(state, railsFn(i)));
  return { state, log };
}

describe('key derivation (§7.1)', () => {
  it('is deterministic per seed and varies across seeds', () => {
    const a = derivePlanetKey(42);
    const b = derivePlanetKey(42);
    expect(a).toEqual(b);
    const tonics = new Set<number>();
    const modes = new Set<ModeName>();
    for (let seed = 1; seed <= 40; seed++) {
      const key = derivePlanetKey(seed);
      tonics.add(key.tonicPc);
      modes.add(key.homeMode);
    }
    expect(tonics.size).toBeGreaterThanOrEqual(3);
    expect(modes.size).toBeGreaterThanOrEqual(2);
  });

  it('never births a planet in Ionian or Phrygian (owner ruling #3)', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const { homeMode } = derivePlanetKey(seed);
      expect(homeMode).not.toBe('ionian');
      expect(homeMode).not.toBe('phrygian');
    }
    for (let seed = 1; seed <= 50; seed++) {
      const { homeMode } = derivePlanetKey(seed, 'arid');
      expect(['aeolian', 'dorian']).toContain(homeMode);
    }
  });

  it('weights home modes by archetype', () => {
    let aeolianCount = 0;
    for (let seed = 1; seed <= 50; seed++) {
      if (derivePlanetKey(seed, 'arid').homeMode === 'aeolian') aeolianCount++;
    }
    expect(aeolianCount).toBeGreaterThan(30); // weighted 0.85
  });
});

describe('determinism (grammar law 2)', () => {
  it('replays an identical log for the same seed and rail history', () => {
    const first = runBars(777, 256, varied);
    const second = runBars(777, 256, varied);
    expect(JSON.stringify(second.log)).toBe(JSON.stringify(first.log));
    expect(second.state.chord).toEqual(first.state.chord);
    expect(second.state.mode).toBe(first.state.mode);
  });

  it('diverges across planet seeds', () => {
    const logs = new Set<string>();
    for (const seed of [11, 12, 13, 14, 15]) {
      logs.add(runBars(seed, 64, calm).log.map((e) => e.chordId).join('|'));
    }
    expect(logs.size).toBeGreaterThan(1);
  });
});

describe('voice-leading legality over a long run (grammar law 3)', () => {
  const seed = 4242;
  const bars = 400;
  const { log } = runBars(seed, bars, varied);
  const changes = log.filter((e) => e.changed);

  it('actually changes chords', () => {
    expect(changes.length).toBeGreaterThan(40);
  });

  it('keeps every transition inside the displacement bounds', () => {
    for (const e of changes) {
      expect(e.displacement, `bar ${e.barIndex}`).toBeLessThanOrEqual(VL_TOTAL_MAX);
      expect(e.maxVoice, `bar ${e.barIndex}`).toBeLessThanOrEqual(VL_VOICE_MAX);
    }
  });

  it('holds a common tone whenever tension is below the gate', () => {
    for (const e of changes) {
      if (varied(e.barIndex).tension < VL_COMMON_TONE_TENSION) {
        expect(e.commonTones, `bar ${e.barIndex}`).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('never repeats the current chord on a change', () => {
    let last = log[0].chordId;
    for (const e of log) {
      if (e.changed) {
        expect(e.chordId).not.toBe(last);
      }
      last = e.chordId;
    }
  });

  it('plays only mode-degree chords or flagged mediants', () => {
    let mode: ModeName = derivePlanetKey(seed).homeMode;
    const tonicPc = derivePlanetKey(seed).tonicPc;
    for (const e of log) {
      if (e.modeDrifted) mode = e.modeDrifted;
      if (!e.changed || e.mediant) continue;
      const ids = MODE_DEGREE_SETS[mode].map((d) => triadId(degreeTriad(tonicPc, d)));
      expect(ids, `bar ${e.barIndex} in ${mode}`).toContain(e.chordId);
    }
  });
});

describe('no-repeat window (grammar law 5)', () => {
  it('forbids the last CHORD_TABU chords except sanctioned bypasses', () => {
    const { state, log } = runBars(999, 400, varied);
    const recent: string[] = [log[0].chordId];
    let mode: ModeName = state.homeMode;
    const tonicPc = state.tonicPc;
    // Replay from scratch to track mode over time.
    mode = derivePlanetKey(999).homeMode;
    for (const e of log) {
      if (e.modeDrifted) mode = e.modeDrifted;
      if (!e.changed) continue;
      const tonicId = triadId(degreeTriad(tonicPc, MODE_DEGREE_SETS[mode][0]));
      const window = recent.slice(-CHORD_TABU);
      if (!e.tabuBypass && !(e.cadenceBiased && e.chordId === tonicId)) {
        expect(window, `bar ${e.barIndex}`).not.toContain(e.chordId);
      }
      if (recent[recent.length - 1] !== e.chordId) recent.push(e.chordId);
    }
  });
});

describe('mediant ration and phrase discipline (§6.3)', () => {
  it('spends at most one mediant per phrase, only at phrase boundaries', () => {
    const { log } = runBars(31337, 640, varied);
    const perPhrase = new Map<number, number>();
    for (const e of log) {
      if (!e.changed || !e.mediant) continue;
      expect(e.phrasePos, `bar ${e.barIndex}`).toBe(0); // no hitScheduled in this run
      const phrase = Math.floor(e.barIndex / PHRASE_BARS);
      perPhrase.set(phrase, (perPhrase.get(phrase) ?? 0) + 1);
    }
    for (const [phrase, count] of perPhrase) {
      expect(count, `phrase ${phrase}`).toBeLessThanOrEqual(1);
    }
  });

  it('plans a curve exactly at phrase boundaries', () => {
    const { log } = runBars(5, 64, calm);
    for (const e of log) {
      if (e.phrasePos === 0) expect(e.curvePlanned).not.toBeNull();
      else expect(e.curvePlanned).toBeNull();
    }
  });

  it('never cadence-biases a RISE phrase', () => {
    const state = createHarmonyBrain(21);
    for (let i = 0; i < 128; i++) {
      const e = advanceHarmonyBar(state, varied(i), { forcedShape: 'RISE' });
      expect(e.cadenceBiased).toBe(false);
    }
  });
});

describe('mode drift (§6.2 weather, never an event)', () => {
  it('steps one chain neighbor at a time with the minimum phrase spacing', () => {
    const { log } = runBars(2718, 1600, varied);
    let mode = derivePlanetKey(2718).homeMode;
    let lastDriftPhrase = -Infinity;
    for (const e of log) {
      if (!e.modeDrifted) continue;
      const from = MODE_BRIGHTNESS_CHAIN.indexOf(mode);
      const to = MODE_BRIGHTNESS_CHAIN.indexOf(e.modeDrifted);
      expect(Math.abs(to - from), `bar ${e.barIndex}`).toBe(1);
      const phrase = Math.floor(e.barIndex / PHRASE_BARS);
      expect(phrase - lastDriftPhrase).toBeGreaterThanOrEqual(MODE_DRIFT_MIN_PHRASES);
      // Gates: major is earned; the ♭2 is strain.
      if (e.modeDrifted === 'ionian') {
        expect(varied(e.barIndex).warmth).toBeGreaterThanOrEqual(IONIAN_WARMTH_GATE);
      }
      if (e.modeDrifted === 'phrygian') {
        expect(varied(e.barIndex).tension).toBeGreaterThan(TENSION_PHRYGIAN_GATE);
      }
      mode = e.modeDrifted;
      lastDriftPhrase = phrase;
    }
  });

  it('drifts at all over a long warm run', () => {
    const { log } = runBars(1618, 1600, warm);
    expect(log.some((e) => e.modeDrifted !== null)).toBe(true);
  });
});

describe('color discipline (§6.3)', () => {
  it('never plays exotic colors below the tension gate, never a dominant seventh', () => {
    const { log } = runBars(8080, 640, varied);
    for (const e of log) {
      if (!e.changed) continue;
      const rails = varied(e.barIndex);
      if (rails.tension <= TENSION_COLOR_GATE) {
        expect(e.chord.colorIntervals, `bar ${e.barIndex}`).not.toContain(13);
        expect(e.chord.colorIntervals, `bar ${e.barIndex}`).not.toContain(18);
      }
      if (e.chord.quality === 'maj') {
        // maj + minor 7th = dominant 7th — outlawed by construction.
        expect(e.chord.colorIntervals).not.toContain(10);
      } else {
        expect(e.chord.colorIntervals).not.toContain(11);
      }
    }
  });
});

describe('publishing the harmonic center (grammar law 1)', () => {
  it('publishes bass-rooted tones that match the brain state', () => {
    const { state } = runBars(606, 100, varied);
    const published = publishHarmony(state);
    const heard = getMusicChord();
    expect(heard.root).toBe(published.root);
    expect(heard.root).toBe(pcMod(state.chord.rootPc));
    expect([...heard.chord]).toEqual(published.tones);
    expect(published.tones[0]).toBe(state.voicing.bass);
    for (const upper of state.voicing.uppers) {
      expect(published.tones).toContain(upper);
    }
    // Every published tone belongs to the chord (triad + colors) — no wrong notes.
    const legalPcs = new Set<number>();
    const base = state.chord.quality === 'maj' ? [0, 4, 7] : [0, 3, 7];
    for (const iv of [...base, ...state.chord.colorIntervals]) {
      legalPcs.add(pcMod(state.chord.rootPc + iv));
    }
    for (const tone of published.tones) {
      expect(legalPcs.has(pcMod(tone)), `tone ${tone}`).toBe(true);
    }
  });
});
