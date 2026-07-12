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
import { PHRASE_BARS, VL_TOTAL_MAX } from './tuning.ts';

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
