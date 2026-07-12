import { describe, expect, it } from 'vitest';
import { createBedConductor, planBedBar, type BedBarPlan, type BedConductorState } from './bedConductor.ts';
import { derivePlanetKey } from './harmonyBrain.ts';
import { MODE_SCALES, pcMod, TRIAD_INTERVALS } from './theory.ts';
import { neutralBedSignals, type BedSignals } from './worldSignals.ts';
import { GESTURE_TABU, PARADOX_MEDIANT_RATION, PHRASE_BARS } from './tuning.ts';

const sig = (patch: Partial<BedSignals> = {}): BedSignals => ({ ...neutralBedSignals(), ...patch });

function runBars(
  state: BedConductorState,
  bars: number,
  signalsFor: (bar: number) => BedSignals
): BedBarPlan[] {
  const plans: BedBarPlan[] = [];
  for (let i = 0; i < bars; i++) plans.push(planBedBar(state, signalsFor(i)));
  return plans;
}

describe('bed conductor determinism (grammar law: constrained randomness only)', () => {
  const schedule = (bar: number): BedSignals =>
    sig({
      tension: 0.4 + 0.4 * Math.sin(bar * 0.21),
      energy: 0.5 + 0.4 * Math.sin(bar * 0.11 + 1),
      warmth: 0.5 + 0.4 * Math.sin(bar * 0.05 + 2),
      wonder: 0.7,
      timeSec: bar * 2.5,
      regionUnit: (bar % 7) / 7
    });

  it('two identical runs produce byte-identical plan streams', () => {
    const a = runBars(createBedConductor(97531, { archetype: 'verdant' }), 128, schedule);
    const b = runBars(createBedConductor(97531, { archetype: 'verdant' }), 128, schedule);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('two planets are different musical places', () => {
    const a = runBars(createBedConductor(11111, { archetype: 'verdant' }), 64, schedule);
    const b = runBars(createBedConductor(99999, { archetype: 'frozen' }), 64, schedule);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
    expect(a[0].tempoBpm === b[0].tempoBpm && JSON.stringify(a[8].ostinato) === JSON.stringify(b[8].ostinato)).toBe(false);
  });
});

describe('never a wrong note (§6, §7 render laws)', () => {
  it('every ostinato and melody pitch is a scale tone of the live mode', () => {
    const state = createBedConductor(24680, { archetype: 'anomaly' });
    for (let bar = 0; bar < 256; bar++) {
      const plan = planBedBar(
        state,
        sig({
          tension: 0.5 + 0.5 * Math.sin(bar * 0.17),
          energy: 0.5 + 0.5 * Math.sin(bar * 0.13),
          warmth: 0.5 + 0.5 * Math.sin(bar * 0.07),
          golden: Math.max(0, Math.sin(bar * 0.03)),
          timeSec: bar * 2.2
        })
      );
      const scalePcs = new Set(
        MODE_SCALES[state.harmony.mode].map((iv) => pcMod(state.harmony.tonicPc + iv))
      );
      for (const n of [...plan.ostinato, ...plan.melody]) {
        expect(scalePcs.has(pcMod(n.semis))).toBe(true);
        expect(n.velocity).toBeGreaterThan(0);
        expect(n.velocity).toBeLessThanOrEqual(1);
      }
    }
  });

  it('published tones always include a bass and at least a triad', () => {
    const state = createBedConductor(1357);
    const plans = runBars(state, 64, () => sig({ energy: 0.8 }));
    for (const plan of plans) {
      expect(plan.publish.tones.length).toBeGreaterThanOrEqual(4);
      expect(plan.publish.tones[0]).toBe(plan.publish.root);
    }
  });
});

describe('melody statements (C418 restraint + §7.3 tabu)', () => {
  it('statements start only at phrase boundaries and stay rare outside blooms', () => {
    const state = createBedConductor(555, { archetype: 'verdant' });
    const plans = runBars(state, 400, () => sig({ energy: 0.4, wonder: 0.7 }));
    let stated = 0;
    for (const plan of plans) {
      if (plan.melody.length > 0) {
        expect(plan.phrasePos).toBe(0);
        stated++;
      }
    }
    expect(stated).toBeGreaterThan(0);
    expect(stated).toBeLessThan(400 / PHRASE_BARS / 2); // most phrases the melody is SILENT
  });

  it('statement fingerprints span the chords sounded across the phrase, not just the current chord (§7.3)', () => {
    const state = createBedConductor(555, { archetype: 'verdant' });
    const plans = runBars(state, 1200, (bar) => sig({ energy: 0.75, wonder: 0.8, timeSec: bar * 2 }));
    const statements = plans.filter((p) => p.melodyChain != null);
    expect(statements.length).toBeGreaterThan(0);
    let multiChord = 0;
    for (const p of statements) {
      const ids = p.melodyChordIds;
      expect(ids).not.toBeNull();
      // The context ends on the chord under the statement's first bar…
      expect(ids![ids!.length - 1]).toBe(p.harmony.chordId);
      // …collapses consecutive holds…
      for (let i = 1; i < ids!.length; i++) expect(ids![i]).not.toBe(ids![i - 1]);
      if (ids!.length > 1) multiChord++;
      // …and re-derives exactly from the plan stream's per-bar chords.
      const expected: string[] = [];
      for (let b = Math.max(0, p.barIndex - PHRASE_BARS); b <= p.barIndex; b++) {
        const id = plans[b].harmony.chordId;
        if (expected[expected.length - 1] !== id) expected.push(id);
      }
      expect(ids).toEqual(expected);
    }
    // The context is real (multi-chord), not degenerate single-chord lists.
    expect(multiChord).toBeGreaterThan(0);
  });

  it('gesture tabu: a statement chain never repeats within the gesture window', () => {
    const state = createBedConductor(555, { archetype: 'verdant' });
    const plans = runBars(state, 1200, (bar) => sig({ energy: 0.75, wonder: 0.8, timeSec: bar * 2 }));
    const chains = plans.filter((p) => p.melodyChain != null).map((p) => p.melodyChain);
    expect(chains.length).toBeGreaterThan(4);
    for (let i = 0; i < chains.length; i++) {
      const window = chains.slice(Math.max(0, i - GESTURE_TABU), i);
      expect(window).not.toContain(chains[i]);
    }
  });
});

describe('arrangement + scene policies through the conductor', () => {
  it('warp forces BUILD, BUILD blooms with a guaranteed statement, and warp exit booms into EBB', () => {
    const state = createBedConductor(8080, { archetype: 'verdant' });
    const warpOnAt = 3;
    const plans = runBars(state, PHRASE_BARS * 3, (bar) =>
      sig({ energy: 0.5, wonder: 0.7, warpActive: bar >= warpOnAt, warpProgress: 0.5 })
    );
    expect(plans[PHRASE_BARS].arrangement).toBe('BUILD');
    expect(plans[PHRASE_BARS].buildPhrase).toBe(true);
    const bloom = plans[PHRASE_BARS * 2];
    expect(bloom.arrangement).toBe('BLOOM');
    expect(bloom.bloomEntered).toBe(true);
    expect(bloom.melody.length).toBeGreaterThan(0);
  });

  it('warp exit raises the boom flag once and EBBs at the next boundary', () => {
    const state = createBedConductor(8081, { archetype: 'verdant' });
    const plans = runBars(state, PHRASE_BARS * 3, (bar) =>
      sig({ energy: 0.5, warpActive: bar >= 3 && bar < PHRASE_BARS + 2 })
    );
    const boomBars = plans.filter((p) => p.warpExitBoom);
    expect(boomBars.length).toBe(1);
    expect(boomBars[0].barIndex).toBe(PHRASE_BARS + 2);
    expect(plans[PHRASE_BARS * 2].arrangement).toBe('EBB');
  });

  it('storyTerminal is near-silence: single sub, nothing else', () => {
    const state = createBedConductor(31415);
    const plans = runBars(state, 32, () => sig({ scene: 'storyTerminal' }));
    for (const plan of plans) {
      expect(plan.levels.pad).toBe(0);
      expect(plan.levels.sub).toBeGreaterThan(0);
      expect(plan.ostinato).toEqual([]);
      expect(plan.melody).toEqual([]);
      expect(plan.percussion).toEqual([]);
    }
  });

  it('descent forces the world-clock tick present', () => {
    const state = createBedConductor(2718);
    const plan = planBedBar(state, sig({ scene: 'descent', tension: 0 }));
    expect(plan.tick.present).toBe(true);
  });

  it('underwater: the harmonic rhythm slows and the sub takes the motif', () => {
    const dry = createBedConductor(1618, { archetype: 'oceanic' });
    const dryPlans = runBars(dry, 64, () => sig({ energy: 0.5, submergence: 0 }));
    const wet = createBedConductor(1618, { archetype: 'oceanic' });
    const wetPlans = runBars(wet, 64, () => sig({ energy: 0.5, submergence: 1 }));
    const changes = (plans: BedBarPlan[]): number => plans.filter((p) => p.harmony.changed).length;
    expect(changes(wetPlans)).toBeLessThan(changes(dryPlans));
    expect(wetPlans.every((p) => p.subTakesMotif)).toBe(true);
    expect(dryPlans.every((p) => !p.subTakesMotif)).toBe(true);
  });

  it('travel turns the rhythm: the region salt rotates the Euclidean pattern', () => {
    const here = createBedConductor(4242);
    const herePlan = planBedBar(here, sig({ energy: 0.8, detail: 1, regionUnit: 0 }));
    const there = createBedConductor(4242);
    const therePlan = planBedBar(there, sig({ energy: 0.8, detail: 1, regionUnit: 0.2 }));
    expect(herePlan.percussion.length).toBeGreaterThan(0);
    expect(herePlan.percussion).not.toEqual(therePlan.percussion);
  });
});

describe('stage transitions are events (§8.4 stage row, P5)', () => {
  it('an upward stage flip schedules exactly one bloom, and alive promises a mediant', () => {
    const state = createBedConductor(9091, { archetype: 'verdant' });
    const flipAt = PHRASE_BARS + 3; // mid-phrase: the mediant must WAIT for the boundary
    const plans = runBars(state, PHRASE_BARS * 4, (bar) =>
      sig({
        energy: 0.5,
        era: bar >= flipAt ? 0.9 : 0.6,
        stage: bar >= flipAt ? 'alive' : 'material'
      })
    );
    const blooms = plans.filter((p) => p.stageBloom);
    expect(blooms.length).toBe(1);
    expect(blooms[0].barIndex).toBe(flipAt);
    // The promised mediant fires ON the next phrase boundary, not before.
    const boundary = plans.find((p) => p.barIndex >= flipAt && p.phrasePos === 0)!;
    expect(boundary.stageMediant).toBe(true);
    expect(boundary.harmony.mediant).toBe(true);
    expect(boundary.harmony.changed).toBe(true);
    for (const p of plans) {
      if (p.barIndex > flipAt && p.barIndex < boundary.barIndex) {
        expect(p.stageMediant, `bar ${p.barIndex}`).toBe(false);
      }
    }
  });

  it('a color→material rung blooms but promises no mediant', () => {
    const state = createBedConductor(9092, { archetype: 'verdant' });
    const plans = runBars(state, PHRASE_BARS * 3, (bar) =>
      sig({
        energy: 0.5,
        era: bar >= 5 ? 0.55 : 0.3,
        stage: bar >= 5 ? 'material' : 'color'
      })
    );
    expect(plans.filter((p) => p.stageBloom).length).toBe(1);
    expect(plans.every((p) => !p.stageMediant)).toBe(true);
  });

  it('a fresh conductor adopts the current stage silently and downward flips never bloom', () => {
    const fresh = createBedConductor(9093);
    const first = planBedBar(fresh, sig({ stage: 'alive' }));
    expect(first.stageBloom).toBe(false);
    const down = createBedConductor(9094);
    const plans = runBars(down, 12, (bar) =>
      sig({ stage: bar >= 4 ? 'material' : 'alive', era: bar >= 4 ? 0.6 : 0.9 })
    );
    expect(plans.every((p) => !p.stageBloom && !p.stageMediant)).toBe(true);
  });

  it('story authority swallows the awakening (the story scored it already)', () => {
    const state = createBedConductor(9095, { archetype: 'verdant' });
    const plans = runBars(state, PHRASE_BARS * 3, (bar) =>
      sig({
        storyLeads: true,
        era: bar >= 6 ? 0.9 : 0.6,
        stage: bar >= 6 ? 'alive' : 'material'
      })
    );
    expect(plans.every((p) => !p.stageBloom && !p.stageMediant)).toBe(true);
  });
});

describe('period-authentic era rungs (§8.5, P5)', () => {
  it('bare is monophonic: a lone chip arp of CHORD TONES, no melody statements', () => {
    const state = createBedConductor(1201, { archetype: 'verdant' });
    const plans = runBars(state, PHRASE_BARS * 6, () =>
      sig({ era: 0.05, stage: 'bare', energy: 0.4, wonder: 0.7 })
    );
    let arpNotes = 0;
    for (const plan of plans) {
      expect(plan.chipMono).toBe(true);
      expect(plan.melody).toEqual([]);
      expect(['REST', 'BED']).toContain(plan.arrangement);
      const chord = plan.harmony.chord;
      const chordPcs = new Set(TRIAD_INTERVALS[chord.quality].map((step) => pcMod(chord.rootPc + step)));
      for (const n of plan.ostinato) {
        arpNotes++;
        expect(chordPcs.has(pcMod(n.semis)), `bar ${plan.barIndex}`).toBe(true);
      }
    }
    expect(arpNotes).toBeGreaterThan(0);
  });

  it('paradox splits the world clock and widens the mediant ration', () => {
    const state = createBedConductor(1202, { archetype: 'anomaly' });
    const plans = runBars(state, PHRASE_BARS * 20, (bar) =>
      sig({ stage: 'paradox', era: 1, energy: 0.85, golden: 1, timeSec: bar * 2 })
    );
    expect(plans.every((p) => p.tick.splitHz !== null)).toBe(true);
    const perPhrase = new Map<number, number>();
    for (const p of plans) {
      if (p.harmony.changed && p.harmony.mediant) {
        const phrase = Math.floor(p.barIndex / PHRASE_BARS);
        perPhrase.set(phrase, (perPhrase.get(phrase) ?? 0) + 1);
      }
    }
    for (const [phrase, count] of perPhrase) {
      expect(count, `phrase ${phrase}`).toBeLessThanOrEqual(PARADOX_MEDIANT_RATION);
    }
  });
});

describe('the approach IS the modulation (§8.4, P3 bespoke mechanism)', () => {
  it('arrives home in the destination key by walk or by landing pivot', () => {
    const destSeed = 777001;
    const destKey = derivePlanetKey(destSeed, 'frozen');
    const state = createBedConductor(123456, { archetype: 'verdant' });
    // Make sure the keys actually differ so there is something to do.
    expect(
      state.harmony.tonicPc !== destKey.tonicPc || state.harmony.homeMode !== destKey.homeMode
    ).toBe(true);

    const sceneFor = (bar: number): BedSignals =>
      sig({
        energy: 0.6,
        scene: bar < 16 ? 'surface' : bar < 48 ? 'approach' : 'descent',
        destinationSeed: bar >= 16 && bar < 48 ? destSeed : null,
        destinationArchetype: bar >= 16 && bar < 48 ? 'frozen' : null
      });
    runBars(state, 56, sceneFor);

    expect(state.harmony.tonicPc).toBe(destKey.tonicPc);
    expect(state.harmony.homeMode).toBe(destKey.homeMode);
    expect(state.approach).toBeNull();
  });

  it('an early landing still arrives: pivot or finished walk, the key comes home', () => {
    const destSeed = 424243;
    const destKey = derivePlanetKey(destSeed, 'arid');
    const state = createBedConductor(654321, { archetype: 'oceanic' });
    runBars(state, 24, (bar) =>
      sig({
        // Low energy → slow harmonic rhythm → the walk cannot finish in 4 bars.
        energy: 0.1,
        scene: bar < 8 ? 'surface' : bar < 12 ? 'approach' : 'surface',
        destinationSeed: bar >= 8 && bar < 12 ? destSeed : null,
        destinationArchetype: bar >= 8 && bar < 12 ? 'arid' : null
      })
    );
    // Whatever the guard decided, arrival sounds like arriving: the key is home.
    expect(state.harmony.tonicPc).toBe(destKey.tonicPc);
    expect(state.harmony.homeMode).toBe(destKey.homeMode);
    expect(state.approach).toBeNull();
  });

  it('plans even when the destination resolves after the scene flips', () => {
    const destSeed = 606060;
    const destKey = derivePlanetKey(destSeed, 'crystal');
    const state = createBedConductor(222333, { archetype: 'fungal' });
    runBars(state, 56, (bar) =>
      sig({
        energy: 0.6,
        scene: bar < 16 ? 'surface' : bar < 48 ? 'approach' : 'descent',
        // The flight snapshot lags: the destination appears 3 bars late.
        destinationSeed: bar >= 19 && bar < 48 ? destSeed : null,
        destinationArchetype: bar >= 19 && bar < 48 ? 'crystal' : null
      })
    );
    expect(state.harmony.tonicPc).toBe(destKey.tonicPc);
    expect(state.harmony.homeMode).toBe(destKey.homeMode);
  });

  it('story authority blocks the modulation entirely', () => {
    const destSeed = 999;
    const state = createBedConductor(13579, { archetype: 'verdant' });
    const before = { tonicPc: state.harmony.tonicPc, homeMode: state.harmony.homeMode };
    runBars(state, 40, (bar) =>
      sig({
        energy: 0.6,
        storyLeads: true,
        scene: bar < 8 ? 'surface' : bar < 32 ? 'approach' : 'descent',
        destinationSeed: bar >= 8 && bar < 32 ? destSeed : null
      })
    );
    expect(state.harmony.tonicPc).toBe(before.tonicPc);
    expect(state.harmony.homeMode).toBe(before.homeMode);
  });
});
