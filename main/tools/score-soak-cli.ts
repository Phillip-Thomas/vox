// --- The pure 30-minute soak, from the CLI (P4) -----------------------------------------------------
//
// Runs the generative-score musical laws over 30+ minutes of MUSICAL time in
// milliseconds of wall time (no WebAudio — plans only), for the three
// reference planets, plus the replay-determinism and seed-divergence checks.
//
//   npx vite-node tools/score-soak-cli.ts                    # full battery, 32 min each
//   npx vite-node tools/score-soak-cli.ts --minutes 45
//   npx vite-node tools/score-soak-cli.ts --seed 123 --archetype oceanic --scenario fullSoak
//
// Audio-level soaks (OfflineAudioContext) live in score-soak-probe.mjs.

import type { ArchetypeId } from '../src/game/data/planetArchetypes.ts';
import {
  formatSoakReport,
  runPureSoak,
  serializeSoakLog,
  soakLogHash,
  SOAK_CONTRAST_ARCHETYPE_A,
  SOAK_CONTRAST_ARCHETYPE_B,
  SOAK_CONTRAST_SEED_A,
  SOAK_CONTRAST_SEED_B,
  SOAK_HOME_ARCHETYPE,
  SOAK_HOME_SEED,
  SOAK_SCENARIO_NAMES,
  type SoakScenarioName
} from '../src/audio/generative/soak.ts';

interface CliPlanet {
  seed: number;
  archetype: ArchetypeId | undefined;
}

const args = process.argv.slice(2);
const flag = (name: string): string | null => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : null;
};

const minutes = Number(flag('minutes') ?? 32);
const scenario = (flag('scenario') ?? 'fullSoak') as SoakScenarioName;
if (!SOAK_SCENARIO_NAMES.includes(scenario)) {
  console.error(`unknown scenario '${scenario}' (${SOAK_SCENARIO_NAMES.join(', ')})`);
  process.exit(2);
}

const seedFlag = flag('seed');
const planets: CliPlanet[] = seedFlag
  ? [{ seed: Number(seedFlag), archetype: (flag('archetype') ?? undefined) as ArchetypeId | undefined }]
  : [
      { seed: SOAK_HOME_SEED, archetype: SOAK_HOME_ARCHETYPE },
      { seed: SOAK_CONTRAST_SEED_A, archetype: SOAK_CONTRAST_ARCHETYPE_A },
      { seed: SOAK_CONTRAST_SEED_B, archetype: SOAK_CONTRAST_ARCHETYPE_B }
    ];

let allPass = true;
const hashes: number[] = [];

for (const planet of planets) {
  const label = `${scenario} ${minutes}min seed=${planet.seed}${planet.archetype ? ` (${planet.archetype})` : ''}`;
  const started = Date.now();
  const { log, report } = runPureSoak({
    planetSeed: planet.seed,
    archetype: planet.archetype,
    minutes,
    scenario
  });
  console.log(formatSoakReport(label, report));
  console.log(`  · wall time: ${((Date.now() - started) / 1000).toFixed(2)}s\n`);
  if (!report.pass) allPass = false;

  // Replay determinism: the identical run must serialize bit-identically.
  const replay = runPureSoak({
    planetSeed: planet.seed,
    archetype: planet.archetype,
    minutes,
    scenario
  });
  const identical = serializeSoakLog(replay.log) === serializeSoakLog(log);
  console.log(`  [${identical ? 'PASS' : 'FAIL'}] replay-determinism  seed ${planet.seed} re-run is bit-identical\n`);
  if (!identical) allPass = false;
  hashes.push(soakLogHash(log));
}

if (planets.length > 1) {
  const distinct = new Set(hashes).size === hashes.length;
  console.log(`[${distinct ? 'PASS' : 'FAIL'}] seed-divergence  every planet produced a different log`);
  if (!distinct) allPass = false;
}

console.log(`\n=== PURE SOAK ${allPass ? 'PASS' : 'FAIL'} ===`);
process.exit(allPass ? 0 : 1);
