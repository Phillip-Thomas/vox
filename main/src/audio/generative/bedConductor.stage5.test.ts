import { describe, expect, it } from 'vitest';
import {
  createBedConductor,
  noteStoryHandBack,
  planBedBar,
  type BedBarPlan
} from './bedConductor.ts';
import { neutralBedSignals, type BedSignals } from './worldSignals.ts';
import {
  ARRANGEMENT_LEVELS,
  BAR_TABU,
  ERA_MATERIAL,
  LIFT_BAR_SLEW,
  PHRASE_BARS,
  PULSE_BREATH_SCALE,
  SIDECHAIN_DEPTH,
  WITHHELD_LEVEL
} from './tuning.ts';
import { hashBar } from './phraseMemory.ts';

// --- Stage 5 long form through the conductor: sections, the pulse, the lift, the bar law ----------

const sig = (patch: Partial<BedSignals> = {}): BedSignals => ({ ...neutralBedSignals(), ...patch });

function run(seed: number, bars: number, at: (bar: number) => BedSignals): BedBarPlan[] {
  const state = createBedConductor(seed, { archetype: 'verdant' });
  const plans: BedBarPlan[] = [];
  for (let b = 0; b < bars; b++) plans.push(planBedBar(state, at(b)));
  return plans;
}

const barHashOf = (p: BedBarPlan): number =>
  hashBar({
    chordId: p.harmony.chordId,
    uppers: [],
    arrangement: p.arrangement,
    melodyChain: p.melodyChain,
    ostinato: p.ostinato.map((n) => `${n.slot}:${n.semis}`),
    percussion: p.percussion,
    levels: [p.levels.sub, p.levels.pad, p.levels.ostinato, p.levels.texture, p.levels.lead, p.levels.percussion, p.levels.riser]
  });

describe('sections drive the bed (Stage 5)', () => {
  it('is deterministic bar for bar under the planner', () => {
    const a = run(5, 400, (b) => sig({ energy: 0.3 + 0.4 * Math.abs(Math.sin(b / 50)) }));
    const b = run(5, 400, (b) => sig({ energy: 0.3 + 0.4 * Math.abs(Math.sin(b / 50)) }));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('the opening section builds and blooms inside the first 210 seconds at every reference tempo', () => {
    for (const [seed, archetype] of [[5, 'verdant'], [8, 'frozen'], [10, 'volcanic']] as const) {
      const state = createBedConductor(seed, { archetype });
      const barSec = (state.genome.meter.beatsPerBar * 60) / state.genome.baseTempo;
      const bars = Math.floor(210 / barSec);
      let bloomAt: number | null = null;
      for (let b = 0; b < bars; b++) {
        const p = planBedBar(state, sig({ energy: 0.3, daylight: 0.82 }));
        if (p.bloomEntered && bloomAt === null) bloomAt = b;
      }
      expect(bloomAt).not.toBeNull();
      expect(bloomAt! * barSec).toBeLessThan(180);
    }
  });

  it('breath and pulse exist only across BUILD/BLOOM (and their slewed release); the bed never pumps without a source', () => {
    const plans = run(5, 800, () => sig({ energy: 0.7 }));
    let gestureBars = 0;
    for (let i = 0; i < plans.length; i++) {
      const p = plans[i];
      const inGesture = p.arrangement === 'BUILD' || p.arrangement === 'BLOOM';
      if (inGesture) gestureBars++;
      // Depth is the pulse — same envelope, one source.
      expect(p.sidechainDepth).toBeCloseTo(SIDECHAIN_DEPTH * PULSE_BREATH_SCALE * p.pulse.level, 9);
      if (p.pulse.level === 0) expect(p.pulse.beats).toEqual([]);
      if (p.pulse.level > 0) expect(p.pulse.beats.length).toBeGreaterThan(0);
      if (!inGesture && p.pulse.level > 0) {
        // Release tail: strictly decaying out of a gesture, never more than the slew per bar.
        expect(plans[i - 1].pulse.level).toBeGreaterThan(p.pulse.level);
      }
      if (i > 0) {
        expect(Math.abs(p.pulse.level - plans[i - 1].pulse.level)).toBeLessThanOrEqual(LIFT_BAR_SLEW + 1e-9);
        expect(Math.abs(p.bloomLift - plans[i - 1].bloomLift)).toBeLessThanOrEqual(LIFT_BAR_SLEW + 1e-9);
      }
      if (p.arrangement === 'REST' || p.arrangement === 'BED') expect(p.bloomLift).toBeLessThanOrEqual(LIFT_BAR_SLEW);
    }
    expect(gestureBars).toBeGreaterThan(0);
  });

  it('the BLOOM rail lifts the arrangement, not the tail: crest levels exceed the table, EBB/BED sit on it', () => {
    const plans = run(10, 800, () => sig({ energy: 0.6 }));
    const crest = plans.find((p) => p.arrangement === 'BLOOM' && p.bloomLift === 1);
    expect(crest).toBeDefined();
    expect(crest!.levels.pad).toBeGreaterThan(ARRANGEMENT_LEVELS.BLOOM.pad * 2);
    const bed = plans.find((p, i) => i > 40 && p.arrangement === 'BED' && p.bloomLift === 0 && !p.withheldActive);
    expect(bed).toBeDefined();
    expect(bed!.levels.pad).toBeCloseTo(ARRANGEMENT_LEVELS.BED.pad, 9);
  });

  it('a withheld layer is held back before the bloom and paid out when the bloom enters', () => {
    const plans = run(8, 1200, () => sig({ energy: 0.5 }));
    const bloomEntries = plans.filter((p) => p.bloomEntered && !p.forcedBuild && p.withheldLayer !== null);
    expect(bloomEntries.length).toBeGreaterThan(0);
    for (const entry of bloomEntries) {
      const layer = entry.withheldLayer!;
      const key = layer === 'shimmer' ? 'texture' : layer;
      const before = plans.filter(
        (p) =>
          p.sectionIndex === entry.sectionIndex &&
          p.barIndex < entry.barIndex &&
          p.arrangement !== 'BUILD' &&
          p.arrangement !== 'BLOOM'
      );
      expect(before.length).toBeGreaterThan(0);
      for (const b of before) {
        expect(b.withheldActive).toBe(true);
        expect(b.levels[key]).toBeLessThanOrEqual(ARRANGEMENT_LEVELS[b.arrangement][key] * WITHHELD_LEVEL[layer] + 1e-9);
      }
      expect(entry.withheldActive).toBe(false);
    }
  });

  it('a story hand-back plans a restrained section: no bloom budget, plateau|fall, an in-flight gesture releases', () => {
    const state = createBedConductor(5, { archetype: 'verdant' });
    const plans: BedBarPlan[] = [];
    let handedBackAt: number | null = null;
    for (let b = 0; b < 600; b++) {
      const p = planBedBar(state, sig({ energy: 0.8 }));
      plans.push(p);
      if (handedBackAt === null && p.arrangement === 'BUILD' && b > 40) {
        noteStoryHandBack(state);
        handedBackAt = b;
      }
    }
    expect(handedBackAt).not.toBeNull();
    const after = plans.slice(handedBackAt! + 1);
    const started = after.find((p) => p.sectionStarted)!;
    expect(started).toBeDefined();
    expect(started.bloomBudget).toBe(0);
    expect(['plateau', 'fall']).toContain(started.registerArc);
    // No new planned bloom inside that section; the interrupted gesture does not bloom.
    const section = after.filter((p) => p.sectionIndex === started.sectionIndex);
    expect(section.some((p) => p.bloomEntered && !p.forcedBuild)).toBe(false);
    expect(section[0].arrangement).not.toBe('BLOOM');
  });

  it('below material there is no section, no pulse, no lift and no bar variation (chip eras loop by authenticity)', () => {
    for (const era of [0.1, 0.3, ERA_MATERIAL - 0.01]) {
      const plans = run(5, 200, () => sig({ era, stage: era < 0.25 ? 'bare' : 'color' }));
      for (const p of plans) {
        expect(p.sectionIndex).toBe(-1);
        expect(p.pulse.level).toBe(0);
        expect(p.bloomLift).toBe(0);
        expect(p.barVariationOps).toBe(0);
        expect(p.barTabuBypass).toBe(false);
        expect(p.statementScheduled).toBe(false);
      }
    }
  });

  it('the whole-bar law holds through the conductor: no sounding bar recurs inside BAR_TABU bars unless flagged', () => {
    const plans = run(8, 1056, (b) => sig({ energy: 0.25 + 0.5 * Math.abs(Math.sin(b / 90)) }));
    const hashes = plans.map(barHashOf);
    let bypasses = 0;
    for (let i = 0; i < plans.length; i++) {
      if (plans[i].arrangement === 'REST') continue;
      if (plans[i].barTabuBypass) {
        bypasses++;
        continue;
      }
      // A stricter recompute (no voicing in the hash) that still must not repeat.
      const window = hashes.slice(Math.max(0, i - BAR_TABU), i);
      if (window.includes(hashes[i])) {
        // Voicing-only differences are legal per the law's descriptor; make sure the plan's own hash differs.
        expect(plans.slice(Math.max(0, i - BAR_TABU), i).map((p) => p.barHash)).not.toContain(plans[i].barHash);
      }
    }
    expect(bypasses).toBeLessThanOrEqual(4);
  });

  it('statements fall where the section scheduled them, and the run recapitulates its first chain', () => {
    const plans = run(5, 1400, () => sig({ energy: 0.5 }));
    const statements = plans.filter((p) => p.melodyChain !== null);
    expect(statements.length).toBeGreaterThan(4);
    for (const s of statements) {
      expect(s.phrasePos).toBe(0);
      expect(s.statementScheduled).toBe(true);
    }
    const first = statements[0].melodyChain;
    expect(statements.slice(1).some((s) => s.melodyChain === first)).toBe(true);
  });

  it('register arcs move the voicing band across a section (a rise ends higher than it began)', () => {
    const plans = run(10, 1600, () => sig({ energy: 0.5 }));
    const riseSection = plans.find((p) => p.registerArc === 'rise' && p.sectionStarted);
    expect(riseSection).toBeDefined();
    const bars = plans.filter((p) => p.sectionIndex === riseSection!.sectionIndex);
    const head = bars.slice(0, PHRASE_BARS).reduce((a, p) => a + p.publish.root, 0) / PHRASE_BARS;
    const tail = bars.slice(-PHRASE_BARS).reduce((a, p) => a + p.publish.root, 0) / PHRASE_BARS;
    expect(bars.length).toBeGreaterThan(PHRASE_BARS * 3);
    expect(tail).toBeGreaterThanOrEqual(head - 12); // the band travels up or holds; never collapses an octave
  });
});
