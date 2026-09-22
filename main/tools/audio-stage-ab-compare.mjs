// A/B comparer for stage evidence folders produced by audio-stage-evidence-probe.mjs.
//
//   node tools/audio-stage-ab-compare.mjs <beforeDir> <afterDir> <outDir> [--noglue <afterNoGlueDir>]
//
// Writes ab-results.json and ab-results.md: per-render loudness/true-peak/
// correlation/band deltas, plus the bare-era regression (before vs after-no-glue
// WAVs compared sample-for-sample at 16-bit).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const [beforeDir, afterDir, outDir] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const ngIdx = process.argv.indexOf('--noglue');
const noGlueDir = ngIdx >= 0 ? process.argv[ngIdx + 1] : null;
if (!beforeDir || !afterDir || !outDir) {
  console.error('usage: audio-stage-ab-compare.mjs <beforeDir> <afterDir> <outDir> [--noglue <dir>]');
  process.exit(2);
}
const before = JSON.parse(fs.readFileSync(path.join(beforeDir, 'summary.json'), 'utf8'));
const after = JSON.parse(fs.readFileSync(path.join(afterDir, 'summary.json'), 'utf8'));
const noGlue = noGlueDir ? JSON.parse(fs.readFileSync(path.join(noGlueDir, 'summary.json'), 'utf8')) : null;

const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;
const rows = [];
for (const name of Object.keys(before.renders)) {
  const a = before.renders[name];
  const b = after.renders[name];
  if (!b) continue;
  const la = a.loudness;
  const lb = b.loudness;
  rows.push({
    name,
    seconds: b.seconds,
    before: {
      integratedLufs: r2(la.integratedLufs),
      shortTermMaxLufs: r2(la.shortTermMaxLufs),
      truePeakDbtp: r2(la.truePeakDbtp),
      loudnessRangeLu: r2(la.loudnessRangeLu),
      correlation: r3(la.correlation),
      bandFractions: la.spectral.bandFractions.map(r3),
      zcrHz: Math.round(la.spectral.meanZeroCrossingRate),
      smoothnessViolations: a.analysis.smoothnessViolations,
      pcmSha256: a.pcmSha256
    },
    after: {
      integratedLufs: r2(lb.integratedLufs),
      shortTermMaxLufs: r2(lb.shortTermMaxLufs),
      truePeakDbtp: r2(lb.truePeakDbtp),
      loudnessRangeLu: r2(lb.loudnessRangeLu),
      correlation: r3(lb.correlation),
      bandFractions: lb.spectral.bandFractions.map(r3),
      zcrHz: Math.round(lb.spectral.meanZeroCrossingRate),
      smoothnessViolations: b.analysis.smoothnessViolations,
      pcmSha256: b.pcmSha256
    },
    delta: {
      integratedLu: r2(lb.integratedLufs - la.integratedLufs),
      shortTermMaxLu: r2(lb.shortTermMaxLufs - la.shortTermMaxLufs),
      truePeakDb: r2(lb.truePeakDbtp - la.truePeakDbtp),
      correlation: r3(lb.correlation - la.correlation),
      bandFractions: lb.spectral.bandFractions.map((v, i) => r3(v - la.spectral.bandFractions[i])),
      zcrHz: Math.round(lb.spectral.meanZeroCrossingRate - la.spectral.meanZeroCrossingRate)
    }
  });
}

function readPcm16(file) {
  const buf = fs.readFileSync(file);
  // RIFF header: find the 'data' chunk.
  let off = 12;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === 'data') return { data: buf.subarray(off + 8, off + 8 + size), sha: crypto.createHash('sha256').update(buf).digest('hex') };
    off += 8 + size + (size % 2);
  }
  throw new Error(`no data chunk in ${file}`);
}
function compareWav(fileA, fileB) {
  const a = readPcm16(fileA);
  const b = readPcm16(fileB);
  const n = Math.min(a.data.length, b.data.length) / 2;
  let maxDelta = 0;
  let firstDiff = -1;
  let diffCount = 0;
  for (let i = 0; i < n; i++) {
    const d = Math.abs(a.data.readInt16LE(i * 2) - b.data.readInt16LE(i * 2));
    if (d > 0) {
      diffCount++;
      if (firstDiff < 0) firstDiff = i;
    }
    if (d > maxDelta) maxDelta = d;
  }
  return {
    identicalBytes: a.sha === b.sha,
    shaA: a.sha,
    shaB: b.sha,
    maxInt16Delta: maxDelta,
    maxDeltaDbfs: maxDelta > 0 ? r2(20 * Math.log10(maxDelta / 32768)) : -Infinity,
    differingSamples: diffCount,
    firstDifferenceS: firstDiff < 0 ? null : r3(firstDiff / 2 / 44100),
    lengthMismatch: a.data.length !== b.data.length
  };
}

const bareNames = ['bare-bed', 'bare-story-ch1-fixed', 'color-bed'];
/**
 * Bare/colour-era regression verdict (audio-10x D12): the renderer is not
 * bit-deterministic at the float floor across runs (independent re-renders of
 * UNCHANGED code differ by 1–2 LSB at 16 bit), so the gate asserts the windowed
 * fingerprint is identical AND every 16-bit sample delta is within this ceiling
 * (2 LSB ≈ −84 dBFS) — never a run-specific differing-sample count.
 */
const BARE_ERA_LSB_CEILING = 2;
const bareEraVerdict = (fingerprintIdentical, wav) => ({
  fingerprintIdentical,
  lsbCeiling: BARE_ERA_LSB_CEILING,
  withinLsbCeiling: !wav.lengthMismatch && wav.maxInt16Delta <= BARE_ERA_LSB_CEILING,
  pass: fingerprintIdentical && !wav.lengthMismatch && wav.maxInt16Delta <= BARE_ERA_LSB_CEILING
});
const bareEra = {};
for (const name of bareNames) {
  const a = before.renders[name];
  if (!a) continue;
  const entry = { before: { pcmSha256: a.pcmSha256, fingerprintSha256: a.fingerprintSha256 } };
  const b = after.renders[name];
  if (b) {
    entry.afterWithGlue = {
      pcmSha256: b.pcmSha256,
      fingerprintSha256: b.fingerprintSha256,
      fingerprintIdentical: b.fingerprintSha256 === a.fingerprintSha256,
      wav: compareWav(path.join(beforeDir, a.wavFile), path.join(afterDir, b.wavFile)),
      integratedLuDelta: r2(b.loudness.integratedLufs - a.loudness.integratedLufs)
    };
  }
  const c = noGlue?.renders[name];
  if (c) {
    entry.afterNoGlue = {
      pcmSha256: c.pcmSha256,
      fingerprintSha256: c.fingerprintSha256,
      fingerprintIdentical: c.fingerprintSha256 === a.fingerprintSha256,
      pcmIdentical: c.pcmSha256 === a.pcmSha256,
      wav: compareWav(path.join(beforeDir, a.wavFile), path.join(noGlueDir, c.wavFile))
    };
    entry.afterNoGlue.verdict = bareEraVerdict(entry.afterNoGlue.fingerprintIdentical, entry.afterNoGlue.wav);
  }
  bareEra[name] = entry;
}

const result = {
  schema: 'paravoxia.audioStageAb.v1',
  generatedAt: new Date().toISOString(),
  beforeDir: path.relative(process.cwd(), beforeDir),
  afterDir: path.relative(process.cwd(), afterDir),
  noGlueDir: noGlueDir ? path.relative(process.cwd(), noGlueDir) : null,
  rows,
  bareEra,
  sweeps: { before: before.sweeps, after: after.sweeps }
};
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'ab-results.json'), JSON.stringify(result, null, 2));

const md = [];
md.push('# Stage 1 A/B — six owner excerpts plus gate renders', '');
md.push('| render | s | I before | I after | ΔI (LU) | S-max before | S-max after | TP before | TP after | LRA b→a | corr b→a | bands before [<200, 200–800, 800–3.2k, >3.2k] | bands after | smooth b→a |');
md.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of rows) {
  md.push(
    `| ${r.name} | ${r.seconds} | ${r.before.integratedLufs} | ${r.after.integratedLufs} | ${r.delta.integratedLu} | ${r.before.shortTermMaxLufs} | ${r.after.shortTermMaxLufs} | ${r.before.truePeakDbtp} | ${r.after.truePeakDbtp} | ${r.before.loudnessRangeLu}→${r.after.loudnessRangeLu} | ${r.before.correlation}→${r.after.correlation} | [${r.before.bandFractions.join(', ')}] | [${r.after.bandFractions.join(', ')}] | ${r.before.smoothnessViolations}→${r.after.smoothnessViolations} |`
  );
}
md.push('', '## Bare/colour-era regression', '');
for (const [name, e] of Object.entries(bareEra)) {
  md.push(`- **${name}**: before pcm ${e.before.pcmSha256.slice(0, 16)} / fp ${e.before.fingerprintSha256.slice(0, 16)}`);
  if (e.afterNoGlue) {
    const w = e.afterNoGlue.wav;
    md.push(`  - after (glue bypassed): pcm ${e.afterNoGlue.pcmSha256.slice(0, 16)} pcmIdentical=${e.afterNoGlue.pcmIdentical} fingerprintIdentical=${e.afterNoGlue.fingerprintIdentical}; 16-bit WAV identical=${w.identicalBytes}, max |Δ| ${w.maxInt16Delta} LSB (${w.maxDeltaDbfs} dBFS), ${w.differingSamples} differing samples${w.firstDifferenceS != null ? `, first at ${w.firstDifferenceS}s` : ''}`);
    md.push(`  - verdict: ${e.afterNoGlue.verdict.pass ? 'PASS' : 'FAIL'} — fingerprint identical=${e.afterNoGlue.verdict.fingerprintIdentical}, max |Δ| ≤ ${e.afterNoGlue.verdict.lsbCeiling} LSB (≤ −84 dBFS)=${e.afterNoGlue.verdict.withinLsbCeiling} (the differing-sample count is a per-run observation at the renderer's float floor, not a bound)`);
  }
  if (e.afterWithGlue) {
    const w = e.afterWithGlue.wav;
    md.push(`  - after (with glue): ΔI ${e.afterWithGlue.integratedLuDelta} LU, fingerprintIdentical=${e.afterWithGlue.fingerprintIdentical}, max |Δ| ${w.maxInt16Delta} LSB`);
  }
}
if (before.sweeps || after.sweeps) {
  md.push('', '## Smoothness battery', '');
  for (const [k, v] of Object.entries(after.sweeps ?? {})) md.push(`- after ${k}: ${JSON.stringify(v).slice(0, 300)}`);
  for (const [k, v] of Object.entries(before.sweeps ?? {})) md.push(`- before ${k}: ${JSON.stringify(v).slice(0, 300)}`);
}
fs.writeFileSync(path.join(outDir, 'ab-results.md'), md.join('\n') + '\n');
console.log(md.join('\n'));
