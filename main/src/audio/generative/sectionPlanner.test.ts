import { describe, expect, it } from 'vitest';
import {
  buildStartsAt,
  createSectionHistory,
  densityAt,
  liftBeforeBuildAt,
  plannedBloomPhrase,
  planSection,
  recordSection,
  registerOffsetAt,
  sectionPair,
  statementScheduledAt,
  type SectionSignals
} from './sectionPlanner.ts';
import {
  BLOOM_PHRASES_MAX,
  BUILD_SPAN_MAX,
  SECTION_INTRO_BUILD_PHRASES,
  SECTION_MAX_DRY_RUN,
  SECTION_PHRASES_MAX,
  SECTION_PHRASES_MIN,
  SECTION_REGISTER_SEMIS
} from './tuning.ts';

const signals = (patch: Partial<SectionSignals> = {}): SectionSignals => ({
  energy: 0.5,
  wonder: 0.4,
  tension: 0.3,
  era: 1,
  bare: false,
  restBoost: 0,
  afterHandBack: false,
  ...patch
});

function planRun(seed: number, sections: number, sig: (i: number) => SectionSignals) {
  const history = createSectionHistory();
  const plans = [];
  let phrase = 0;
  for (let i = 0; i < sections; i++) {
    const plan = planSection(seed, i, phrase, sig(i), history);
    recordSection(history, plan);
    plans.push(plan);
    phrase += plan.lengthPhrases;
  }
  return plans;
}

describe('section planner (Stage 5) — intention 4–8 phrases ahead', () => {
  it('is deterministic under (seed, index, signals, history)', () => {
    const a = planRun(5, 30, (i) => signals({ energy: 0.3 + 0.5 * Math.abs(Math.sin(i)) }));
    const b = planRun(5, 30, (i) => signals({ energy: 0.3 + 0.5 * Math.abs(Math.sin(i)) }));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('two planets plan different sections', () => {
    const a = planRun(5, 12, () => signals());
    const b = planRun(8, 12, () => signals());
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it('every section is well-formed: bounds, schedule inside, bloom fits with a release phrase', () => {
    for (const seed of [1, 5, 8, 10, 4242]) {
      for (const plan of planRun(seed, 40, (i) => signals({ energy: (i % 7) / 6, wonder: (i % 5) / 4 }))) {
        expect(plan.lengthPhrases).toBeGreaterThanOrEqual(SECTION_PHRASES_MIN);
        expect(plan.lengthPhrases).toBeLessThanOrEqual(SECTION_PHRASES_MAX);
        expect(plan.buildSpanPhrases).toBeGreaterThanOrEqual(1);
        expect(plan.buildSpanPhrases).toBeLessThanOrEqual(BUILD_SPAN_MAX);
        expect(plan.bloomPhrases).toBeLessThanOrEqual(BLOOM_PHRASES_MAX);
        for (const p of plan.statementSchedule) {
          expect(p).toBeGreaterThanOrEqual(0);
          expect(p).toBeLessThan(plan.lengthPhrases);
        }
        expect([...plan.statementSchedule]).toEqual([...plan.statementSchedule].sort((x, y) => x - y));
        if (plan.bloomBudget === 1) {
          expect(plan.buildPhrase).not.toBeNull();
          expect(plan.withheldLayer).not.toBeNull();
          const bloom = plannedBloomPhrase(plan)!;
          expect(bloom).toBeLessThan(plan.lengthPhrases); // at least one phrase of release follows
          expect(plan.statementSchedule).toContain(bloom); // the bloom carries the tune
          // No statement is scheduled inside the BUILD (no lead there).
          for (let p = plan.buildPhrase!; p < bloom; p++) expect(plan.statementSchedule).not.toContain(p);
        } else {
          expect(plan.buildPhrase).toBeNull();
        }
      }
    }
  });

  it('the opening section always blooms, starting its build on an intro phrase', () => {
    for (const seed of [1, 2, 3, 5, 8, 10, 77]) {
      const [first] = planRun(seed, 1, () => signals({ energy: 0.05 }));
      expect(first.bloomBudget).toBe(1);
      expect(SECTION_INTRO_BUILD_PHRASES).toContain(first.buildPhrase);
    }
  });

  it('never repeats a (statementSchedule, registerArc) pair in a run', () => {
    for (const seed of [5, 8, 10]) {
      const plans = planRun(seed, 60, (i) => signals({ energy: (i % 4) / 3 }));
      const pairs = plans.map(sectionPair);
      expect(new Set(pairs).size).toBe(pairs.length);
    }
  });

  it('restraint has a ceiling: no more than SECTION_MAX_DRY_RUN budget-0 sections in a row', () => {
    const plans = planRun(8, 80, () => signals({ energy: 0 }));
    let dry = 0;
    for (const plan of plans) {
      dry = plan.bloomBudget === 1 ? 0 : dry + 1;
      expect(dry).toBeLessThanOrEqual(SECTION_MAX_DRY_RUN);
    }
  });

  it('after a story hand-back the section carries no bloom budget and a plateau|fall arc (contract [16])', () => {
    for (const seed of [5, 8, 10, 99]) {
      const history = createSectionHistory();
      const plan = planSection(seed, 3, 40, signals({ energy: 1, afterHandBack: true }), history);
      expect(plan.bloomBudget).toBe(0);
      expect(['plateau', 'fall']).toContain(plan.registerArc);
      expect(plan.afterHandBack).toBe(true);
    }
  });

  it('bare, sub-material era and restraint scenes never plan a bloom', () => {
    const h = createSectionHistory();
    expect(planSection(5, 0, 0, signals({ bare: true, era: 0 }), h).bloomBudget).toBe(0);
    expect(planSection(5, 0, 0, signals({ era: 0.3 }), h).bloomBudget).toBe(0);
    expect(planSection(5, 0, 0, signals({ restBoost: 0.5 }), h).bloomBudget).toBe(0);
  });

  it('register and density arcs are bounded and shaped', () => {
    const plans = planRun(10, 20, () => signals());
    for (const plan of plans) {
      for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        expect(Math.abs(registerOffsetAt(plan, t))).toBeLessThanOrEqual(SECTION_REGISTER_SEMIS + 1e-9);
        expect(densityAt(plan, t)).toBeGreaterThanOrEqual(0);
        expect(densityAt(plan, t)).toBeLessThanOrEqual(1);
      }
      if (plan.registerArc === 'plateau') expect(registerOffsetAt(plan, 0.5)).toBe(0);
      if (plan.registerArc === 'rise') expect(registerOffsetAt(plan, 1)).toBeGreaterThan(registerOffsetAt(plan, 0));
      if (plan.registerArc === 'fall') expect(registerOffsetAt(plan, 1)).toBeLessThan(registerOffsetAt(plan, 0));
      if (plan.registerArc === 'arch') expect(registerOffsetAt(plan, 0.5)).toBeGreaterThan(registerOffsetAt(plan, 0));
      if (plan.bloomBudget === 1) expect(plan.densityArc[1]).toBeGreaterThan(plan.densityArc[0]);
    }
  });

  it('exposes the build/lift/statement queries the conductor keys on', () => {
    const plans = planRun(5, 10, () => signals({ energy: 0.9 }));
    const plan = plans.find((p) => p.bloomBudget === 1 && p.buildPhrase! > 1)!;
    expect(buildStartsAt(plan, plan.buildPhrase!)).toBe(true);
    expect(liftBeforeBuildAt(plan, plan.buildPhrase! - 1)).toBe(true);
    expect(buildStartsAt(plan, plan.buildPhrase! - 1)).toBe(false);
    expect(statementScheduledAt(plan, plannedBloomPhrase(plan)!)).toBe(true);
  });
});
