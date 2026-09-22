// CPU-only declaration: reads an actual standalone bed measurement, then reports
// the same scripts and nominal recipes that the OfflineAudioContext renders.
// PROBE_NO_HMR=1 node node_modules/vite-node/vite-node.mjs tools/audio-stress-density.ts <bed-summary.json> <output.json>
import fs from 'node:fs';
import path from 'node:path';
import { STAGE_EVIDENCE_NAMES, stressSfxScript, EXCERPT_SECONDS, STRESS_EVIDENCE_SECONDS } from '../src/audio/soak/excerpts.ts';
import { describeStressDensity } from '../src/audio/soak/stressDensity.ts';

const [summaryFile, outputFile] = process.argv.slice(2);
if (!summaryFile || !outputFile) throw new Error('usage: audio-stress-density.ts <bed-summary.json> <output.json>');
const summary = JSON.parse(fs.readFileSync(summaryFile, 'utf8'));
const bed = summary.renders?.['bed-sandbox-day'];
if (!Number.isFinite(bed?.loudness?.shortTermMaxAtS)) throw new Error('current standalone day bed measurement missing');
const result = {
  generatedAt: new Date().toISOString(),
  standaloneBedSource: path.resolve(summaryFile),
  standaloneBedPcmSha256: bed.pcmSha256,
  measuredBloomWindowStartS: bed.loudness.shortTermMaxAtS,
  note: 'Declaration only. Nominal source amplitudes precede seeded variation, buses, room sends, ducking and mastering. No extra trigger or gain is inserted for the loudness target.',
  scripts: Object.fromEntries(STAGE_EVIDENCE_NAMES.filter(name => name.startsWith('stress-')).map(name => [
    name,
    describeStressDensity(stressSfxScript(name, bed.loudness.shortTermMaxAtS), name === 'stress-shipcrash-bloom' ? EXCERPT_SECONDS : STRESS_EVIDENCE_SECONDS)
  ]))
};
fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(Object.fromEntries(Object.entries(result.scripts).map(([name, r]) => [name, {
  oneShots: r.oneShots.map(v => `${v.family}:${v.triggersPerMinute}/min`),
  loops: r.loops.map(v => `${v.family}:${v.activeSeconds.toFixed(1)}s/${r.seconds}s`)
}]))));
