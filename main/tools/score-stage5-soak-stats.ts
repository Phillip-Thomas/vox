// --- Stage 5 long-form soak statistics (audio-10x run) ----------------------------------------------
//
// Runs the pure 32-minute fullSoak for the three reference planets and reports
// the long-form numbers the Stage 5 terms name: barNovelty, distinctChords,
// melodyStatements, tabuBypasses, the arrangement histogram, BLOOM episode
// count / lengths, the duplicate-bar breakdown by arrangement state, and (when
// the log carries them) the section planner's (statementSchedule, registerArc)
// pairs and the bloom-payment audit. Same numbers before and after: the tool
// reads optional fields defensively so one script measures both trees.
//
//   PROBE_NO_HMR=1 node node_modules/vite-node/vite-node.mjs tools/score-stage5-soak-stats.ts --out <dir> [--minutes 32]
//
import fs from 'node:fs';
import path from 'node:path';
import type { ArchetypeId } from '../src/game/data/planetArchetypes.ts';
import { fnv1a32 } from '../src/utils/worldCoordinates.ts';
import {
  formatSoakReport,
  runPureSoak,
  SOAK_CONTRAST_ARCHETYPE_A,
  SOAK_CONTRAST_ARCHETYPE_B,
  SOAK_CONTRAST_SEED_A,
  SOAK_CONTRAST_SEED_B,
  SOAK_HOME_ARCHETYPE,
  SOAK_HOME_SEED,
  type SoakBarRecord
} from '../src/audio/generative/soak.ts';
import { PHRASE_BARS } from '../src/audio/generative/tuning.ts';

const args = process.argv.slice(2);
const flag = (name: string): string | null => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : null;
};
const minutes = Number(flag('minutes') ?? 32);
const outDir = flag('out');
if (outDir) fs.mkdirSync(outDir, { recursive: true });

interface Planet {
  seed: number;
  archetype: ArchetypeId;
}
const planets: Planet[] = [
  { seed: SOAK_HOME_SEED, archetype: SOAK_HOME_ARCHETYPE },
  { seed: SOAK_CONTRAST_SEED_A, archetype: SOAK_CONTRAST_ARCHETYPE_A },
  { seed: SOAK_CONTRAST_SEED_B, archetype: SOAK_CONTRAST_ARCHETYPE_B }
];

/** The soak's whole-bar fingerprint (mirrors auditSoakLog's barNovelty hash). */
function barFingerprint(r: SoakBarRecord): number {
  const x = r as SoakBarRecord & { levels?: Record<string, number>; uppers?: number[] };
  const levels = x.levels
    ? Object.values(x.levels)
        .map((v) => Math.round(v * 20) / 20)
        .join(',')
    : '';
  return fnv1a32(
    `${r.chordId}|${r.uppers.join('.')}|${r.arrangement}|${r.melodyChain}|${r.ostinato
      .map((n) => n.slot + ':' + n.semis)
      .join(',')}|${r.percussion.join(',')}|${levels}`
  );
}

interface Episode {
  startBar: number;
  phrases: number;
}

function episodes(bars: readonly SoakBarRecord[], state: string): Episode[] {
  const out: Episode[] = [];
  let cur: Episode | null = null;
  for (const r of bars) {
    if (r.arrangement === state) {
      if (!cur) {
        cur = { startBar: r.barIndex, phrases: 0 };
        out.push(cur);
      }
      if (r.phrasePos === 0) cur.phrases += 1;
    } else {
      cur = null;
    }
  }
  return out;
}

const summary: Record<string, unknown> = { minutes, planets: {} };
const lines: string[] = [];
for (const planet of planets) {
  const { log, report } = runPureSoak({
    planetSeed: planet.seed,
    archetype: planet.archetype,
    minutes,
    scenario: 'fullSoak'
  });
  const bars = log.bars;
  lines.push(formatSoakReport(`fullSoak ${minutes}min seed=${planet.seed} (${planet.archetype})`, report));

  // Duplicate breakdown by state (global, whole run).
  const seen = new Map<number, number>();
  const dupByState: Record<string, { bars: number; dup: number }> = {};
  for (const r of bars) {
    const h = barFingerprint(r);
    const st = (dupByState[r.arrangement] ??= { bars: 0, dup: 0 });
    st.bars += 1;
    if (seen.has(h)) st.dup += 1;
    seen.set(h, (seen.get(h) ?? 0) + 1);
  }
  const globalNovelty = seen.size / bars.length;

  // Windowed novelty: bars whose fingerprint recurs inside the last 32 bars.
  let windowRepeats = 0;
  const recent: number[] = [];
  for (const r of bars) {
    const h = barFingerprint(r);
    if (recent.includes(h)) windowRepeats += 1;
    recent.push(h);
    while (recent.length > 32) recent.shift();
  }

  const blooms = episodes(bars, 'BLOOM');
  const builds = episodes(bars, 'BUILD');
  const statements = bars.filter((r) => r.melodyChain !== null);
  const statementGapsPhrases: number[] = [];
  for (let i = 1; i < statements.length; i++) {
    statementGapsPhrases.push((statements[i].barIndex - statements[i - 1].barIndex) / PHRASE_BARS);
  }
  const bloomGapsMin: number[] = [];
  const barSec = (minutes * 60) / bars.length;
  for (let i = 1; i < blooms.length; i++) {
    bloomGapsMin.push(((blooms[i].startBar - blooms[i - 1].startBar) * barSec) / 60);
  }

  // Section planner fields (after only).
  const sections = new Map<number, { pair: string; bloomBudget: number; withheld: string | null; arc: string }>();
  for (const r of bars as Array<SoakBarRecord & Record<string, unknown>>) {
    if (typeof r.sectionIndex === 'number' && !sections.has(r.sectionIndex)) {
      sections.set(r.sectionIndex, {
        pair: `${String(r.statementSchedule)}|${String(r.registerArc)}`,
        bloomBudget: Number(r.bloomBudget),
        withheld: (r.withheldLayer as string | null) ?? null,
        arc: String(r.registerArc)
      });
    }
  }
  const pairs = [...sections.values()].map((s) => s.pair);
  const repeatedPairs = pairs.length - new Set(pairs).size;

  const planetSummary = {
    seed: planet.seed,
    archetype: planet.archetype,
    pass: report.pass,
    stats: report.stats,
    checks: report.checks.map((c) => `${c.name}:${c.pass ? 'PASS' : 'FAIL'}:${c.violations}`),
    globalBarNovelty: Number(globalNovelty.toFixed(3)),
    windowRepeats32: windowRepeats,
    dupByState,
    blooms: { count: blooms.length, lengthsPhrases: blooms.map((b) => b.phrases), gapsMin: bloomGapsMin.map((g) => Number(g.toFixed(2))) },
    builds: { count: builds.length, lengthsPhrases: builds.map((b) => b.phrases) },
    statements: { count: statements.length, gapsPhrases: statementGapsPhrases },
    sections: { count: sections.size, repeatedPairs, pairs, bloomBudgets: [...sections.values()].map((s) => s.bloomBudget), withheld: [...sections.values()].map((s) => s.withheld) }
  };
  (summary.planets as Record<string, unknown>)[String(planet.seed)] = planetSummary;
  lines.push(
    `  · globalBarNovelty(+voicing,+levels): ${planetSummary.globalBarNovelty}  windowRepeats32: ${windowRepeats}`,
    `  · dupByState: ${JSON.stringify(dupByState)}`,
    `  · BLOOM episodes: ${blooms.length} lengths(phrases)=[${blooms.map((b) => b.phrases).join(',')}] gaps(min)=[${bloomGapsMin.map((g) => g.toFixed(1)).join(',')}]`,
    `  · BUILD episodes: ${builds.length} lengths(phrases)=[${builds.map((b) => b.phrases).join(',')}]`,
    `  · statements: ${statements.length} gaps(phrases)=[${statementGapsPhrases.join(',')}]`,
    `  · sections: ${sections.size} repeatedPairs=${repeatedPairs} bloomBudgets=[${planetSummary.sections.bloomBudgets.join(',')}] withheld=[${planetSummary.sections.withheld.join(',')}]`,
    ''
  );
  if (outDir) {
    fs.writeFileSync(path.join(outDir, `soak-log-seed${planet.seed}.json`), JSON.stringify(log));
  }
}

const text = lines.join('\n');
console.log(text);
if (outDir) {
  fs.writeFileSync(path.join(outDir, 'pure-soak-stats.txt'), text);
  fs.writeFileSync(path.join(outDir, 'pure-soak-stats.json'), JSON.stringify(summary, null, 2));
}
