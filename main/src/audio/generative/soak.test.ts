import { describe, expect, it } from 'vitest';
import {
  auditSoakLog,
  makeSoakScript,
  runPureSoak,
  serializeSoakLog,
  soakLogHash,
  stageForEra,
  statementChordContext,
  statementHash,
  SOAK_CONTRAST_ARCHETYPE_A,
  SOAK_CONTRAST_ARCHETYPE_B,
  SOAK_CONTRAST_SEED_A,
  SOAK_CONTRAST_SEED_B,
  SOAK_HOME_ARCHETYPE,
  SOAK_HOME_SEED,
  SOAK_MAX_CONSECUTIVE_HELD,
  SOAK_SCENARIO_NAMES,
  type SoakLog
} from './soak.ts';
import { BAR_TABU, PHRASE_BARS, VL_TOTAL_MAX } from './tuning.ts';

// --- The P4 soak harness, smoke-tested on short renders --------------------------------------
//
// The full 30+ minute runs happen in the verify step (CLI + OfflineAudioContext
// probe); here the harness itself is proven: the audits pass on healthy runs,
// FAIL on doctored logs (an audit that cannot fail proves nothing), and the
// runs replay bit-identically per seed.

const SMOKE = { planetSeed: SOAK_HOME_SEED, archetype: SOAK_HOME_ARCHETYPE, minutes: 8, scenario: 'fullSoak' as const };
/** Full-length pure runs are milliseconds — the 30+ min laws are asserted HERE too. */
const FULL_MINUTES = 33;

describe('soak scenarios', () => {
  it('scripts are deterministic and in-range for every scenario', () => {
    for (const name of SOAK_SCENARIO_NAMES) {
      const script = makeSoakScript(name, 77, 600);
      const again = makeSoakScript(name, 77, 600);
      for (let t = 0; t < 600; t += 37) {
        const a = script(t);
        const b = again(t);
        expect(b).toEqual(a);
        for (const key of ['tension', 'energy', 'warmth', 'wonder', 'daylight', 'golden'] as const) {
          expect(a[key]).toBeGreaterThanOrEqual(0);
          expect(a[key]).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('eraLadder climbs the §8.5 rungs in order', () => {
    const script = makeSoakScript('eraLadder', 5, 100);
    const stages = [0, 20, 45, 70, 99].map((t) => script(t).stage);
    expect(stages[0]).toBe('bare');
    expect(stages[stages.length - 1]).toBe('alive');
    const order = ['bare', 'color', 'material', 'alive'];
    for (let i = 1; i < stages.length; i++) {
      expect(order.indexOf(stages[i])).toBeGreaterThanOrEqual(order.indexOf(stages[i - 1]));
    }
    expect(stageForEra(0)).toBe('bare');
    expect(stageForEra(1)).toBe('alive');
  });

  it('fullSoak exercises warp, submergence, and the approach walk', () => {
    const script = makeSoakScript('fullSoak', SMOKE.planetSeed, 1000);
    const samples = Array.from({ length: 1000 }, (_, t) => script(t));
    expect(samples.some((s) => s.warpActive)).toBe(true);
    expect(samples.some((s) => s.submergence > 0.5)).toBe(true);
    expect(samples.some((s) => s.scene === 'approach' && s.destinationSeed !== null)).toBe(true);
    expect(samples.some((s) => s.golden > 0.5)).toBe(true);
  });

  it('fullSoak ramps submergence/warp rails instead of scripting rectangular steps', () => {
    const script = makeSoakScript('fullSoak', SMOKE.planetSeed, 1000);
    const samples = Array.from({ length: 1001 }, (_, t) => script(t));
    expect(samples.some((s) => s.submergence > 0 && s.submergence < 0.85)).toBe(true);
    let maxSubmergenceStep = 0;
    let maxEnergyStep = 0;
    for (let i = 1; i < samples.length; i++) {
      maxSubmergenceStep = Math.max(
        maxSubmergenceStep,
        Math.abs(samples[i].submergence - samples[i - 1].submergence)
      );
      maxEnergyStep = Math.max(maxEnergyStep, Math.abs(samples[i].energy - samples[i - 1].energy));
    }
    expect(maxSubmergenceStep).toBeLessThan(0.2);
    expect(maxEnergyStep).toBeLessThan(0.2);
  });
});

describe('pure soak runs (the musical laws hold across every scenario)', () => {
  it('fullSoak passes the full audit battery for the home planet', () => {
    const { log, report } = runPureSoak(SMOKE);
    expect(log.bars.length).toBeGreaterThan(100);
    expect(report.checks.map((c) => `${c.name}:${c.pass}`).join(' ')).toBe(
      report.checks.map((c) => `${c.name}:true`).join(' ')
    );
    expect(report.pass).toBe(true);
  });

  it('a FULL 33-minute fullSoak passes for all three reference planets', () => {
    // Regression guard for the frozen-seed-8 harmony freeze the P4 soak
    // found (94 held bars before the HELD_RELAX_BARS escape hatch existed).
    for (const [planetSeed, archetype] of [
      [SOAK_HOME_SEED, SOAK_HOME_ARCHETYPE],
      [SOAK_CONTRAST_SEED_A, SOAK_CONTRAST_ARCHETYPE_A],
      [SOAK_CONTRAST_SEED_B, SOAK_CONTRAST_ARCHETYPE_B]
    ] as const) {
      const { report } = runPureSoak({ planetSeed, archetype, minutes: FULL_MINUTES, scenario: 'fullSoak' });
      expect(report.pass, `seed ${planetSeed} (${archetype}):\n${report.checks.map((c) => `${c.name}=${c.pass} ${c.detail}`).join('\n')}`).toBe(true);
    }
  });

  it('sandboxDay, sandboxNight, and eraLadder pass', () => {
    for (const scenario of ['sandboxDay', 'sandboxNight', 'eraLadder'] as const) {
      const { report } = runPureSoak({ ...SMOKE, minutes: 4, scenario });
      expect(report.pass, scenario).toBe(true);
    }
  });

  it('two planets are different musical places (different logs)', () => {
    const a = runPureSoak({
      planetSeed: SOAK_CONTRAST_SEED_A,
      archetype: SOAK_CONTRAST_ARCHETYPE_A,
      minutes: 3,
      scenario: 'sandboxDay'
    });
    const b = runPureSoak({
      planetSeed: SOAK_CONTRAST_SEED_B,
      archetype: SOAK_CONTRAST_ARCHETYPE_B,
      minutes: 3,
      scenario: 'sandboxDay'
    });
    expect(soakLogHash(a.log)).not.toBe(soakLogHash(b.log));
    expect(a.log.bars[0].tonicPc).not.toBe(b.log.bars[0].tonicPc);
  });
});

describe('seed determinism (replay law)', () => {
  it('the same run replays bit-identically', () => {
    const a = runPureSoak(SMOKE);
    const b = runPureSoak(SMOKE);
    expect(serializeSoakLog(b.log)).toBe(serializeSoakLog(a.log));
    expect(soakLogHash(b.log)).toBe(soakLogHash(a.log));
  });
});

describe('the audits can FAIL (a green light that cannot turn red proves nothing)', () => {
  const healthy = (): SoakLog => runPureSoak({ ...SMOKE, minutes: 6 }).log;

  it('flags an illegal chord transition', () => {
    const log = healthy();
    const changed = log.bars.find((r) => r.changed && !r.landingPivot)!;
    changed.uppers = [
      changed.prevUppers[0] + VL_TOTAL_MAX + 3,
      changed.prevUppers[1],
      changed.prevUppers[2]
    ];
    const report = auditSoakLog(log);
    expect(report.checks.find((c) => c.name === 'chord-legality')!.pass).toBe(false);
  });

  it('flags a phrase-tabu repeat inside the window', () => {
    const log = healthy();
    const indices: number[] = [];
    log.bars.forEach((r, i) => {
      if (r.melodyChain !== null) indices.push(i);
    });
    expect(indices.length).toBeGreaterThanOrEqual(2);
    const [i1, i2] = indices;
    const first = log.bars[i1];
    const second = log.bars[i2];
    second.melodyChain = first.melodyChain;
    second.melody = first.melody.map((n) => ({ ...n }));
    second.bandCenter = first.bandCenter;
    // The fingerprint now spans the phrase's chord context (§7.3): flatten
    // both statements' windows onto one chord so the contexts collide too.
    for (let k = 0; k <= PHRASE_BARS; k++) {
      if (i1 - k >= 0) log.bars[i1 - k].chordId = first.chordId;
      if (i2 - k >= 0) log.bars[i2 - k].chordId = first.chordId;
    }
    expect(statementHash(second, statementChordContext(log.bars, i2))).toBe(
      statementHash(first, statementChordContext(log.bars, i1))
    );
    const report = auditSoakLog(log);
    expect(report.checks.find((c) => c.name === 'phrase-tabu')!.pass).toBe(false);
  });

  it('the statement fingerprint distinguishes identical gestures over different phrase harmony', () => {
    const log = healthy();
    const indices: number[] = [];
    log.bars.forEach((r, i) => {
      if (r.melodyChain !== null) indices.push(i);
    });
    expect(indices.length).toBeGreaterThanOrEqual(2);
    const [i1, i2] = indices;
    const first = log.bars[i1];
    const second = log.bars[i2];
    // Identical gesture, register, and current chord…
    second.melodyChain = first.melodyChain;
    second.melody = first.melody.map((n) => ({ ...n }));
    second.bandCenter = first.bandCenter;
    second.chordId = first.chordId;
    // …but a different chord path across the phrase window ⇒ different hash.
    log.bars[i2 - 1].chordId = '11:maj';
    log.bars[i2 - 2].chordId = '6:min';
    expect(statementHash(second, statementChordContext(log.bars, i2))).not.toBe(
      statementHash(first, statementChordContext(log.bars, i1))
    );
  });

  it('flags a double mediant in one phrase', () => {
    const log = healthy();
    const mediantBar = log.bars.find((r) => r.mediant) ?? log.bars.find((r) => r.changed)!;
    mediantBar.mediant = true;
    const sibling = log.bars.find(
      (r) => r.phraseIndex === mediantBar.phraseIndex && r.barIndex !== mediantBar.barIndex
    )!;
    sibling.mediant = true;
    const report = auditSoakLog(log);
    expect(report.checks.find((c) => c.name === 'mediant-ration')!.pass).toBe(false);
  });

  it('counts a landing-pivot awe-chord against the phrase ration (§8.4, no exemption)', () => {
    const log = healthy();
    const bar = log.bars.find((r) => !r.paradox && !r.mediant)!;
    bar.landingPivot = true;
    bar.landingPivotMediant = true;
    const sibling = log.bars.find(
      (r) => r.phraseIndex === bar.phraseIndex && r.barIndex !== bar.barIndex
    )!;
    sibling.mediant = true;
    const report = auditSoakLog(log);
    expect(report.checks.find((c) => c.name === 'mediant-ration')!.pass).toBe(false);
  });

  it('allows the widened ration on paradox phrases but flags the same double elsewhere (§8.5)', () => {
    const log = healthy();
    const pivotPhrases = new Set(log.bars.filter((r) => r.landingPivot).map((r) => r.phraseIndex));
    const mediantBar = log.bars.find((r) => r.changed && !pivotPhrases.has(r.phraseIndex))!;
    mediantBar.mediant = true;
    const sibling = log.bars.find(
      (r) => r.phraseIndex === mediantBar.phraseIndex && r.barIndex !== mediantBar.barIndex
    )!;
    sibling.mediant = true;
    expect(auditSoakLog(log).checks.find((c) => c.name === 'mediant-ration')!.pass).toBe(false);
    for (const rec of log.bars) {
      if (rec.phraseIndex === mediantBar.phraseIndex) rec.paradox = true;
    }
    expect(auditSoakLog(log).checks.find((c) => c.name === 'mediant-ration')!.pass).toBe(true);
  });

  it('flags a two-accidental mode jump and an unexplained mode change', () => {
    const log = healthy();
    const bar = log.bars.find((r) => !r.modeDrifted && r.scene !== 'approach' && !r.landingPivot)!;
    bar.modeDrifted = 'lydian';
    bar.prevMode = 'aeolian';
    let report = auditSoakLog(log);
    expect(report.checks.find((c) => c.name === 'mode-drift')!.pass).toBe(false);

    const log2 = healthy();
    const bar2 = log2.bars.find((r) => !r.modeDrifted && r.scene !== 'approach' && !r.landingPivot)!;
    bar2.prevMode = 'dorian';
    bar2.mode = 'lydian';
    report = auditSoakLog(log2);
    expect(report.checks.find((c) => c.name === 'mode-drift')!.pass).toBe(false);
  });

  it('flags NaN in a plan field and a harmony deadlock', () => {
    const log = healthy();
    log.bars[10].publishTones = [Number.NaN];
    let report = auditSoakLog(log);
    expect(report.checks.find((c) => c.name === 'finite-plans')!.pass).toBe(false);

    const log2 = healthy();
    for (const rec of log2.bars.slice(0, SOAK_MAX_CONSECUTIVE_HELD + 2)) {
      rec.heldNoLegal = true;
      rec.changed = false;
    }
    report = auditSoakLog(log2);
    expect(report.checks.find((c) => c.name === 'no-deadlock')!.pass).toBe(false);
  });

  it('flags a doctored 0→1 continuous-control step (smoothness can turn red)', () => {
    const log = healthy();
    const index = 10;
    log.bars[index - 1].subMotifMix = 0;
    log.bars[index].subMotifMix = 1;
    const report = auditSoakLog(log);
    const smoothness = report.checks.find((c) => c.name === 'signal-smoothness')!;
    expect(smoothness.pass).toBe(false);
    expect(smoothness.violations).toBeGreaterThan(0);
    expect(smoothness.detail).toContain('subMotifMix');
  });
});

describe('soak evidence quality', () => {
  it('the 8-minute fullSoak actually exercises the grammar space', () => {
    const { log, report } = runPureSoak(SMOKE);
    const stats = report.stats;
    expect(Number(stats.chordChanges)).toBeGreaterThan(20);
    expect(Number(stats.distinctChords)).toBeGreaterThanOrEqual(4);
    expect(Number(stats.melodyStatements)).toBeGreaterThanOrEqual(1);
    // Phrase positions stay aligned to the 8-bar grid the whole way.
    for (const rec of log.bars) {
      expect(rec.phrasePos).toBe(rec.barIndex % PHRASE_BARS);
    }
  });
});

describe('the Stage 5 audits can FAIL too', () => {
  const healthy = (): SoakLog => runPureSoak({ ...SMOKE, minutes: 12 }).log;

  it('a doctored log carrying an unpaid bloom fails the red test', () => {
    const log = healthy();
    expect(auditSoakLog(log).checks.find((c) => c.name === 'bloom-paid')!.pass).toBe(true);
    const i = log.bars.findIndex(
      (r, k) => r.arrangement === 'BLOOM' && k > 0 && log.bars[k - 1].arrangement !== 'BLOOM' && !r.forcedBuild
    );
    expect(i).toBeGreaterThan(0);
    const section = log.bars[i].sectionIndex;
    // Erase the payment: the withheld layer sounded at full level before the build.
    for (const r of log.bars) {
      if (r.sectionIndex === section && r.barIndex < log.bars[i].barIndex) {
        r.withheldActive = false;
        r.levels = { sub: 1, pad: 1, ostinato: 1, texture: 1, lead: 1, percussion: 0.6, riser: 0 };
      }
    }
    expect(auditSoakLog(log).checks.find((c) => c.name === 'bloom-paid')!.pass).toBe(false);
  });

  it('a bloom inside a budget-0 section fails bloom-budget', () => {
    const log = healthy();
    const i = log.bars.findIndex(
      (r, k) => r.arrangement === 'BLOOM' && k > 0 && log.bars[k - 1].arrangement !== 'BLOOM' && !r.forcedBuild
    );
    log.bars[i].bloomBudget = 0;
    expect(auditSoakLog(log).checks.find((c) => c.name === 'bloom-budget')!.pass).toBe(false);
  });

  it('a sounding bar copied inside the tabu window fails bar-tabu; a flagged bypass over budget fails too', () => {
    const log = healthy();
    expect(auditSoakLog(log).checks.find((c) => c.name === 'bar-tabu')!.pass).toBe(true);
    const i = log.bars.findIndex(
      (r, k) => k > BAR_TABU && r.arrangement === 'BED' && r.sectionIndex >= 0 && log.bars[k - 3].arrangement !== 'REST'
    );
    expect(i).toBeGreaterThan(BAR_TABU);
    const src = log.bars[i - 3];
    const dst = log.bars[i];
    dst.chordId = src.chordId;
    dst.uppers = [...src.uppers] as [number, number, number];
    dst.arrangement = src.arrangement;
    dst.melodyChain = src.melodyChain;
    dst.ostinato = src.ostinato.map((n) => ({ ...n }));
    dst.percussion = [...src.percussion];
    dst.levels = { ...src.levels };
    dst.barTabuBypass = false;
    expect(auditSoakLog(log).checks.find((c) => c.name === 'bar-tabu')!.pass).toBe(false);
    // Flagging the copy as a bypass is legal — until the budget is spent.
    dst.barTabuBypass = true;
    expect(auditSoakLog(log).checks.find((c) => c.name === 'bar-tabu')!.pass).toBe(true);
    let flagged = 0;
    for (const r of log.bars) {
      if (r.arrangement !== 'REST' && r.sectionIndex >= 0 && flagged < 40) {
        r.barTabuBypass = true;
        flagged++;
      }
    }
    expect(auditSoakLog(log).checks.find((c) => c.name === 'bar-tabu')!.pass).toBe(false);
  });

  it('a repeated (schedule, arc) section pair fails section-pairs', () => {
    const log = healthy();
    const sections = [...new Set(log.bars.map((r) => r.sectionIndex).filter((i) => i >= 0))];
    expect(sections.length).toBeGreaterThanOrEqual(2);
    const first = log.bars.find((r) => r.sectionIndex === sections[0])!;
    for (const r of log.bars) {
      if (r.sectionIndex === sections[1]) {
        r.statementSchedule = first.statementSchedule;
        r.registerArc = first.registerArc;
      }
    }
    expect(auditSoakLog(log).checks.find((c) => c.name === 'section-pairs')!.pass).toBe(false);
  });

  it('the 33-minute fullSoak meets the Stage 5 long-form terms for all three reference planets', () => {
    for (const [planetSeed, archetype] of [
      [SOAK_HOME_SEED, SOAK_HOME_ARCHETYPE],
      [SOAK_CONTRAST_SEED_A, SOAK_CONTRAST_ARCHETYPE_A],
      [SOAK_CONTRAST_SEED_B, SOAK_CONTRAST_ARCHETYPE_B]
    ] as const) {
      const { report } = runPureSoak({ planetSeed, archetype, minutes: FULL_MINUTES, scenario: 'fullSoak' });
      expect(report.pass, `${planetSeed}: ${report.checks.filter((c) => !c.pass).map((c) => c.detail).join('; ')}`).toBe(true);
      expect(Number(report.stats.barNovelty)).toBeGreaterThanOrEqual(0.85);
      expect(Number(report.stats.barTabuBypasses)).toBeLessThanOrEqual(4);
      expect(Number(report.stats.blooms)).toBeGreaterThanOrEqual(4);
      expect(Number(report.stats.sections)).toBeGreaterThanOrEqual(6);
    }
  });
});
