// Stage 2 acceptance comparer (audio-10x, scene-contract draft-v3 acceptanceCriteria[5], [6]).
//
//   node tools/audio-stage2-compare.mjs <stage2EvidenceDir>
//
// Reads before/, after/, before-pretail/, after-pretail/ (summary.json + WAVs) written by
// audio-stage-evidence-probe.mjs and writes ab-results.json / ab-results.md with one
// verdict per contracted term. Numbers only; the owner audition is a separate gate.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { buildSparseStressReport } from './lib/sparseStressAcceptance.mjs';

// Explicit v6-only classification of a newly rendered matched diagnostic set.
// The original A/B mode and every original verdict below remain unchanged.
if (process.argv[2] === '--successor-sparse') {
  const directory = process.argv[3];
  if (!directory) throw new Error('usage: audio-stage2-compare.mjs --successor-sparse <fresh-stems-dir>');
  const destination = path.join(directory, 'successor-stress-results.json');
  if (fs.existsSync(destination)) throw new Error('Existing successor report is immutable; choose fresh evidence.');
  const report = buildSparseStressReport(directory);
  fs.writeFileSync(destination, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ originalPass: report.originalPass, successorPass: report.successorPass,
    rows: report.rows.map(({ name, quality, measured, original, successor }) => ({ name, quality, measured, original, successor })) }, null, 2));
  process.exit(report.successorPass ? 0 : 1);
}

const dir = process.argv[2];
if (!dir) {
  console.error('usage: audio-stage2-compare.mjs <stage2EvidenceDir>');
  process.exit(2);
}
const load = (sub) => JSON.parse(fs.readFileSync(path.join(dir, sub, 'summary.json'), 'utf8'));
const before = load('before');
const after = load('after');
const preBefore = load('before-pretail');
const preAfter = load('after-pretail');
const duckLead = fs.existsSync(path.join(dir, 'after-duck-storylead', 'summary.json')) ? load('after-duck-storylead') : null;
const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;

function readPcm16(file) {
  const buf = fs.readFileSync(file);
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
  let diffCount = 0;
  for (let i = 0; i < n; i++) {
    const d = Math.abs(a.data.readInt16LE(i * 2) - b.data.readInt16LE(i * 2));
    if (d > 0) diffCount++;
    if (d > maxDelta) maxDelta = d;
  }
  return {
    identicalBytes: a.sha === b.sha,
    maxInt16Delta: maxDelta,
    maxDeltaDbfs: maxDelta > 0 ? r2(20 * Math.log10(maxDelta / 32768)) : -Infinity,
    differingSamples: diffCount,
    lengthMismatch: a.data.length !== b.data.length
  };
}

const terms = [];
const term = (id, name, pass, measured, required) => {
  terms.push({ id, name, pass, measured, required });
};

// --- Per-render loudness table (every render, before → after).
const rows = [];
for (const name of Object.keys(before.renders)) {
  const a = before.renders[name];
  const b = after.renders[name];
  if (!b) continue;
  rows.push({
    name,
    seconds: b.seconds,
    before: { I: r2(a.loudness.integratedLufs), Smax: r2(a.loudness.shortTermMaxLufs), SmaxAtS: a.loudness.shortTermMaxAtS, TP: r2(a.loudness.truePeakDbtp), LRA: r2(a.loudness.loudnessRangeLu), corr: r3(a.loudness.correlation), smooth: a.analysis.smoothnessViolations },
    after: { I: r2(b.loudness.integratedLufs), Smax: r2(b.loudness.shortTermMaxLufs), SmaxAtS: b.loudness.shortTermMaxAtS, TP: r2(b.loudness.truePeakDbtp), LRA: r2(b.loudness.loudnessRangeLu), corr: r3(b.loudness.correlation), smooth: b.analysis.smoothnessViolations },
    delta: { I: r2(b.loudness.integratedLufs - a.loudness.integratedLufs), Smax: r2(b.loudness.shortTermMaxLufs - a.loudness.shortTermMaxLufs), TP: r2(b.loudness.truePeakDbtp - a.loudness.truePeakDbtp) }
  });
}

// --- Stress scripts: TP <= -1, I within 1.5 LU of -18.
const STRESS = ['stress-shipcrash-bloom', 'stress-mining-burst', 'stress-oxygen-dive', 'stress-terminal-storylead', 'stress-jetpack-splash'];
for (const name of STRESS) {
  const l = after.renders[name]?.loudness;
  if (!l) continue;
  term(`stress.tp.${name}`, `${name} true peak`, l.truePeakDbtp <= -1, `${r2(l.truePeakDbtp)} dBTP`, '<= -1 dBTP');
  term(`stress.lufs.${name}`, `${name} integrated`, Math.abs(l.integratedLufs + 18) <= 1.5, `${r2(l.integratedLufs)} LUFS`, '-18 ±1.5 LU (see README deviation: bed alone is contracted at -20.5)');
}

// --- BLOOM S-max -14 ±1 on bed-sandbox-day and shipCrash-over-BLOOM; bed alone still -20.5 ±1.
for (const name of ['bed-sandbox-day', 'stress-shipcrash-bloom']) {
  const l = after.renders[name]?.loudness;
  if (!l) continue;
  term(`bloom.smax.${name}`, `${name} BLOOM short-term max`, Math.abs(l.shortTermMaxLufs + 14) <= 1, `${r2(l.shortTermMaxLufs)} LUFS at ${l.shortTermMaxAtS}s`, '-14 ±1 LU');
}
for (const name of ['bed-sandbox-day', 'bed-sandbox-night', 'bed-contrast-A', 'bed-contrast-B']) {
  const l = after.renders[name]?.loudness;
  if (!l) continue;
  term(`bed.alive.${name}`, `${name} bed alone integrated`, Math.abs(l.integratedLufs + 20.5) <= 1, `${r2(l.integratedLufs)} LUFS`, '-20.5 ±1 LU');
}

// --- Re-baseline (a): pre-tail tap identical (fingerprint + <= 2 LSB).
const BARE = ['bare-bed', 'bare-story-ch1-fixed', 'color-bed'];
const preTail = {};
for (const name of BARE) {
  const a = preBefore.renders[name];
  const b = preAfter.renders[name];
  if (!a || !b) continue;
  const wav = compareWav(path.join(dir, 'before-pretail', a.wavFile), path.join(dir, 'after-pretail', b.wavFile));
  const fp = a.fingerprintSha256 === b.fingerprintSha256;
  preTail[name] = { fingerprintIdentical: fp, ...wav };
  term(`rebaseline.pretail.${name}`, `${name} pre-tail tap identical`, fp && !wav.lengthMismatch && wav.maxInt16Delta <= 2, `fingerprint ${fp ? 'identical' : 'DIFFERENT'}, max |Δ| ${wav.maxInt16Delta} LSB (${wav.maxDeltaDbfs} dBFS)`, 'fingerprint identical and <= 2 LSB');
}
// --- Re-baseline (b): through the tail, I within 0.3 LU, S every 3 s window within 1 LU, TP within 0.5 dB.
const throughTail = {};
for (const name of BARE) {
  const a = before.renders[name]?.loudness;
  const b = after.renders[name]?.loudness;
  if (!a || !b) continue;
  const n = Math.min(a.shortTermSeriesLufs.length, b.shortTermSeriesLufs.length);
  let maxS = 0;
  let maxSAt = 0;
  for (let i = 0; i < n; i++) {
    const d = Math.abs(b.shortTermSeriesLufs[i] - a.shortTermSeriesLufs[i]);
    if (Number.isFinite(d) && d > maxS) {
      maxS = d;
      maxSAt = i;
    }
  }
  throughTail[name] = { deltaI: r3(b.integratedLufs - a.integratedLufs), deltaTp: r3(b.truePeakDbtp - a.truePeakDbtp), maxShortTermDeltaLu: r3(maxS), maxShortTermDeltaAtS: maxSAt, windows: n };
  term(`rebaseline.tail.I.${name}`, `${name} through-tail integrated`, Math.abs(b.integratedLufs - a.integratedLufs) <= 0.3, `Δ ${r3(b.integratedLufs - a.integratedLufs)} LU`, 'within 0.3 LU');
  term(`rebaseline.tail.S.${name}`, `${name} through-tail short-term (every 3 s window)`, maxS <= 1, `max Δ ${r3(maxS)} LU at ${maxSAt}s over ${n} windows`, 'within 1 LU');
  term(`rebaseline.tail.TP.${name}`, `${name} through-tail true peak`, Math.abs(b.truePeakDbtp - a.truePeakDbtp) <= 0.5, `Δ ${r3(b.truePeakDbtp - a.truePeakDbtp)} dB`, 'within 0.5 dB');
}

// --- Story floors: within 0.25 LU (criterion 5) and S after <= before + 0.5 (criterion 6).
const FLOORS = ['floor-ch4-defy', 'floor-refused', 'floor-seam-ebb'];
for (const name of FLOORS) {
  const a = before.renders[name]?.loudness;
  const b = after.renders[name]?.loudness;
  if (!a || !b) continue;
  term(`floor.I.${name}`, `${name} integrated old vs new tail`, Math.abs(b.integratedLufs - a.integratedLufs) <= 0.25, `Δ ${r3(b.integratedLufs - a.integratedLufs)} LU (${r2(a.integratedLufs)} → ${r2(b.integratedLufs)})`, 'within 0.25 LU');
  term(`floor.S.${name}`, `${name} short-term after <= before + 0.5`, b.shortTermMaxLufs <= a.shortTermMaxLufs + 0.5, `${r2(a.shortTermMaxLufs)} → ${r2(b.shortTermMaxLufs)}`, 'after <= before + 0.5 LU');
  const pa = preBefore.renders[name];
  const pb = preAfter.renders[name];
  if (pa && pb) {
    const wav = compareWav(path.join(dir, 'before-pretail', pa.wavFile), path.join(dir, 'after-pretail', pb.wavFile));
    preTail[name] = { fingerprintIdentical: pa.fingerprintSha256 === pb.fingerprintSha256, ...wav };
  }
}

// --- Duck matrix: depth within 1 dB, -6 dB on music within 40 ms of a ship impact.
// The trace is measured at the OUTPUT of the tail. The duck gain and the impact
// both sit upstream of the post-join limiter, so both reach the output late by the
// same LATENCY_COMP_SFX_PATH_S; timing relative to the audible impact onset is the
// raw trace time minus that latency.
const postJoinLatencyS = after.tailLatency?.sfx?.latencyS ?? 0;
const ducks = {};
const duckTerms = (key, d, capped) => {
  const rel = (t) => (t == null ? null : r3(t - postJoinLatencyS));
  ducks[key] = { source: d.source, expectedDb: d.expectedDb, minDb: d.minDb, minAtS: d.minAtS, minAtOnsetRelS: rel(d.minAtS), dbAtAttack: d.dbAtAttack, reachedAtS: d.reachedAtS, reachedAtOnsetRelS: rel(d.reachedAtS), recoveredAtS: d.recoveredAtS, recoveredAtOnsetRelS: rel(d.recoveredAtS), postJoinLatencyS };
  if (d.expectedDb == null) return;
  term(`duck.depth.${key}`, `${key} music duck depth`, Math.abs(d.minDb - d.expectedDb) <= 1, `${d.minDb} dB (min at +${rel(d.minAtS)}s after the audible onset; +${d.minAtS}s raw)`, `${d.expectedDb} ±1 dB${capped ? ' (story-lead cap)' : ''}`);
  term(`duck.attack.${key}`, `${key} music duck reaches depth`, d.reachedAtS != null && rel(d.reachedAtS) <= d.expectedAttackS, `within 1 dB of depth at +${rel(d.reachedAtS)}s after onset (raw +${d.reachedAtS}s)`, `<= ${d.expectedAttackS} s`);
};
for (const [key, d] of Object.entries(after.duckTraces ?? {})) duckTerms(key, d, false);
if (duckLead) {
  for (const [key, d] of Object.entries(duckLead.duckTraces ?? {})) {
    duckTerms(key, d, true);
    if (d.expectedDb != null) term(`duck.cap.${key}`, `${key} music column capped under story lead`, d.expectedDb >= -3 && d.minDb >= -4, `${d.minDb} dB (cap ${d.expectedDb})`, 'DUCK_STORY_LEAD_CAP_DB -3, measured >= -4 dB');
  }
}

// --- Static gains, latency, ceiling, sweeps.
const g = after.tailStageGains ?? {};
if (g.safety) term('gain.safety', 'safety stage static gain after SAFETY_MAKEUP_COMP_DB', Math.abs(g.safety.trimmedGainDb) <= 0.05, `${r3(g.safety.trimmedGainDb)} dB (baked ${r3(g.safety.bakedGainDb)})`, '|gain| <= 0.05 dB');
if (g.limiter) term('gain.limiter', 'limiter stage static gain after LIM_MAKEUP_COMP_DB', Math.abs(g.limiter.trimmedGainDb) <= 0.05, `${r3(g.limiter.trimmedGainDb)} dB (baked ${r3(g.limiter.bakedGainDb)})`, '|gain| <= 0.05 dB');
if (g.tail) term('gain.tail', 'shipped tail vs pre-Stage-2 tail static gain at -30 dBFS', Math.abs(g.tail.trimmedGainDb) <= 0.1, `${r3(g.tail.trimmedGainDb)} dB (tail carries ${r3(g.tail.bakedGainDb)} dB = TAIL_REFERENCE_GAIN_DB)`, 'within 0.1 dB');
if (after.tailLatency) term('latency', 'LATENCY_COMP_MUSIC_PATH_S measured after the limiter', true, `music ${r3(after.tailLatency.music.latencyS * 1000)} ms, sfx ${r3(after.tailLatency.sfx.latencyS * 1000)} ms (before: music ${r3((before.tailLatency?.music.latencyS ?? 0) * 1000)} ms, sfx 0)`, 'published as a named constant');
if (after.ceiling) {
  const worst = Math.max(...Object.values(after.ceiling).map((c) => c.truePeakDbtp));
  term('ceiling', 'ceiling true peak on -6…+12 dBFS bursts (4× oversampled)', worst <= -1, `${r3(worst)} dBTP worst`, '<= -1 dBTP');
}
const sweepsSummary = after.sweeps ? after : fs.existsSync(path.join(dir, 'after-sweeps', 'summary.json')) ? load('after-sweeps') : null;
if (sweepsSummary?.sweeps) {
  after.sweeps = sweepsSummary.sweeps;
  const v = Object.entries(after.sweeps).map(([k, s]) => `${k} ${s.analysis.smoothnessViolations}`);
  term('smoothness', 'smoothness battery', Object.values(after.sweeps).every((s) => s.analysis.smoothnessViolations === 0), v.join(', '), '0 violations');
}
const ALL = Object.keys(after.renders);
term('tp.all', 'true peak on every after render', ALL.every((n) => after.renders[n].loudness.truePeakDbtp <= -1), `worst ${r2(Math.max(...ALL.map((n) => after.renders[n].loudness.truePeakDbtp)))} dBTP`, '<= -1 dBTP');

const result = { generatedAt: new Date().toISOString(), rows, preTail, throughTail, ducks, tailStageGains: g, tailLatency: after.tailLatency, ceiling: after.ceiling, terms, pass: terms.every((t) => t.pass) };
fs.writeFileSync(path.join(dir, 'ab-results.json'), JSON.stringify(result, null, 2));
const md = [];
md.push('# Stage 2 A/B results', '', `Generated ${result.generatedAt}. Verdict per contracted term; owner audition is separate.`, '');
md.push('## Loudness table (before → after, combined tail)', '', '| render | s | I before | I after | ΔI | S-max before | S-max after | ΔS | TP before | TP after | ΔTP | LRA after | corr after | smooth |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of rows) md.push(`| ${r.name} | ${r.seconds} | ${r.before.I} | ${r.after.I} | ${r.delta.I} | ${r.before.Smax} (${r.before.SmaxAtS}s) | ${r.after.Smax} (${r.after.SmaxAtS}s) | ${r.delta.Smax} | ${r.before.TP} | ${r.after.TP} | ${r.delta.TP} | ${r.after.LRA} | ${r.after.corr} | ${r.before.smooth}→${r.after.smooth} |`);
md.push('', '## Terms', '', '| id | term | required | measured | verdict |', '|---|---|---|---|---|');
for (const t of terms) md.push(`| ${t.id} | ${t.name} | ${t.required} | ${t.measured} | ${t.pass ? 'met' : '**not met**'} |`);
md.push('', `Overall: ${result.pass ? 'all numeric terms met' : 'some terms NOT met (see README deviations)'}`);
fs.writeFileSync(path.join(dir, 'ab-results.md'), md.join('\n') + '\n');
for (const t of terms) console.log(`[${t.pass ? 'met' : 'NOT'}] ${t.id}: ${t.measured} (required ${t.required})`);
console.log(result.pass ? 'ALL TERMS MET' : 'SOME TERMS NOT MET');
