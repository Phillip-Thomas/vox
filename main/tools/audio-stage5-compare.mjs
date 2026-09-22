// Stage 5 A/B comparer (audio-10x run): the four beds before/after, shipped tail and
// pre-tail tap, one verdict per contracted BLOOM-rail term and the named
// `composedSpread` field (pre-tail short-term max − pre-tail integrated, LU).
//
//   node tools/audio-stage5-compare.mjs <beforeShipped> <beforePretail> <afterShipped> <afterPretail> <outDir>
//
// Terms (contract draft-v4 acceptanceCriteria[16], amended [6]):
//   · S-max −14 ±1 LU on each bed-led BLOOM (shipped tail)
//   · bed-alone integrated −20.5 ±1 LU (shipped tail)
//   · true peak ≤ −1 dBTP
//   · composedSpread rises from the measured 2.5 LU toward the 6.5 LU the window needs
//   · bare/colour pcm hashes unchanged (the pulse and the rail are gated above material)
import fs from 'node:fs';
import path from 'node:path';

const [beforeDir, beforePreDir, afterDir, afterPreDir, outDir] = process.argv.slice(2);
if (!beforeDir || !beforePreDir || !afterDir || !afterPreDir || !outDir) {
  console.error('usage: audio-stage5-compare.mjs <beforeShipped> <beforePretail> <afterShipped> <afterPretail> <outDir>');
  process.exit(2);
}
const load = (dir) => JSON.parse(fs.readFileSync(path.join(dir, 'summary.json'), 'utf8')).renders;
const before = load(beforeDir);
const beforePre = load(beforePreDir);
const after = load(afterDir);
const afterPre = load(afterPreDir);

const BEDS = ['bed-sandbox-day', 'bed-sandbox-night', 'bed-contrast-A', 'bed-contrast-B'];
const CHIP = ['bare-bed', 'color-bed'];
const BLOOM_ST_LUFS = -14;
const BED_ALIVE_LUFS_I = -20.5;
const TARGET_TP_DBTP = -1;
const r2 = (v) => Math.round(v * 100) / 100;

function readPcm16(file) {
  const bytes = fs.readFileSync(file);
  let format;
  for (let at = 12; at + 8 <= bytes.length;) {
    const id = bytes.toString('ascii', at, at + 4);
    const size = bytes.readUInt32LE(at + 4);
    if (id === 'fmt ') format = { codec: bytes.readUInt16LE(at + 8), channels: bytes.readUInt16LE(at + 10), sampleRate: bytes.readUInt32LE(at + 12), bits: bytes.readUInt16LE(at + 22) };
    if (id === 'data') {
      if (format?.codec !== 1 || format.bits !== 16 || at + 8 + size > bytes.length) throw new Error(`invalid PCM16 WAV: ${file}`);
      return { format, data: bytes.subarray(at + 8, at + 8 + size) };
    }
    at += 8 + size + (size % 2);
  }
  throw new Error(`no WAV data: ${file}`);
}

function comparePcm16(beforeFile, afterFile) {
  const b = readPcm16(beforeFile), a = readPcm16(afterFile);
  let maxInt16Delta = 0, differingSamples = 0;
  for (let i = 0; i + 1 < Math.min(a.data.length, b.data.length); i += 2) {
    const delta = Math.abs(a.data.readInt16LE(i) - b.data.readInt16LE(i));
    maxInt16Delta = Math.max(maxInt16Delta, delta);
    if (delta) differingSamples++;
  }
  return { maxInt16Delta, differingSamples, lengthMismatch: a.data.length !== b.data.length, formatMismatch: JSON.stringify(a.format) !== JSON.stringify(b.format) };
}

const rows = [];
const verdicts = [];
for (const name of BEDS) {
  const b = before[name]?.loudness;
  const a = after[name]?.loudness;
  const bp = beforePre[name]?.loudness;
  const ap = afterPre[name]?.loudness;
  if (!b || !a || !bp || !ap) {
    verdicts.push({ id: `missing.${name}`, term: 'required before/after shipped/pre-tail evidence', target: 'all four rows', measured: 'missing', met: false });
    continue;
  }
  const spreadBefore = bp.shortTermMaxLufs - bp.integratedLufs;
  const spreadAfter = ap.shortTermMaxLufs - ap.integratedLufs;
  rows.push({
    name,
    seconds: after[name].seconds,
    before: { I: r2(b.integratedLufs), sMax: r2(b.shortTermMaxLufs), sAt: b.shortTermMaxAtS, TP: r2(b.truePeakDbtp), LRA: r2(b.loudnessRangeLu), composedSpread: r2(spreadBefore) },
    after: { I: r2(a.integratedLufs), sMax: r2(a.shortTermMaxLufs), sAt: a.shortTermMaxAtS, TP: r2(a.truePeakDbtp), LRA: r2(a.loudnessRangeLu), composedSpread: r2(spreadAfter) },
    smoothnessViolations: { before: before[name].analysis.smoothnessViolations, after: after[name].analysis.smoothnessViolations }
  });
  verdicts.push(
    { id: `bloom.smax.${name}`, term: `${name} BLOOM short-term max`, target: `${BLOOM_ST_LUFS} ±1 LU`, measured: `${r2(a.shortTermMaxLufs)} LU at ${a.shortTermMaxAtS}s`, met: Math.abs(a.shortTermMaxLufs - BLOOM_ST_LUFS) <= 1 },
    { id: `bed.lufs.${name}`, term: `${name} bed-alone integrated`, target: `${BED_ALIVE_LUFS_I} ±1 LU`, measured: `${r2(a.integratedLufs)} LU`, met: Math.abs(a.integratedLufs - BED_ALIVE_LUFS_I) <= 1 },
    { id: `bed.tp.${name}`, term: `${name} true peak`, target: `≤ ${TARGET_TP_DBTP} dBTP`, measured: `${r2(a.truePeakDbtp)} dBTP`, met: a.truePeakDbtp <= TARGET_TP_DBTP },
    { id: `bed.spread.${name}`, term: `${name} composedSpread (pre-tail S-max − I)`, target: 'rises from ≈2.5 toward 6.5 LU', measured: `${r2(spreadBefore)} → ${r2(spreadAfter)} LU`, met: spreadAfter > spreadBefore },
    { id: `bed.smooth.${name}`, term: `${name} smoothness violations`, target: '0', measured: String(after[name].analysis.smoothnessViolations), met: after[name].analysis.smoothnessViolations === 0 }
  );
}
for (const name of CHIP) {
  const b = before[name];
  const a = after[name];
  if (!b || !a) {
    verdicts.push({ id: `missing.${name}`, term: 'required chip regression evidence', target: 'before and after', measured: 'missing', met: false });
    continue;
  }
  // The 16-bit fingerprint is the pinned identity (Stage 2 re-baseline); the raw float pcm
  // hash differs between two renders of the SAME tree (stage-2/after vs stage-5/before), so it
  // is reported, not judged.
  const wav = comparePcm16(path.join(beforeDir, b.wavFile), path.join(afterDir, a.wavFile));
  verdicts.push({
    id: `chip.hash.${name}`,
    term: `${name} fingerprint unchanged (pulse/rail gated above material); pcm ${b.pcmSha256.slice(0, 8)}→${a.pcmSha256.slice(0, 8)} informational`,
    target: b.fingerprintSha256.slice(0, 16),
    measured: a.fingerprintSha256.slice(0, 16),
    met: b.fingerprintSha256 === a.fingerprintSha256
  });
  verdicts.push({
    id: `chip.samples.${name}`, term: `${name} every PCM16 sample within the existing renderer-floor bound`,
    target: 'same format/length and maximum delta <= 2 LSB', measured: JSON.stringify(wav),
    met: !wav.lengthMismatch && !wav.formatMismatch && wav.maxInt16Delta <= 2
  });
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'ab-results.json'), JSON.stringify({ rows, verdicts }, null, 2));
const md = [
  '# Stage 5 A/B — the four beds (shipped tail) and composedSpread (pre-tail)',
  '',
  '| render | s | I before | I after | S-max before | S-max after | TP before | TP after | LRA before | LRA after | composedSpread before | after | smooth |',
  '|---|---|---|---|---|---|---|---|---|---|---|---|---|',
  ...rows.map((r) =>
    `| ${r.name} | ${r.seconds} | ${r.before.I} | ${r.after.I} | ${r.before.sMax} (${r.before.sAt}s) | ${r.after.sMax} (${r.after.sAt}s) | ${r.before.TP} | ${r.after.TP} | ${r.before.LRA} | ${r.after.LRA} | ${r.before.composedSpread} | ${r.after.composedSpread} | ${r.smoothnessViolations.before}→${r.smoothnessViolations.after} |`
  ),
  '',
  '| id | term | target | measured | verdict |',
  '|---|---|---|---|---|',
  ...verdicts.map((v) => `| ${v.id} | ${v.term} | ${v.target} | ${v.measured} | ${v.met ? 'met' : '**not met**'} |`)
].join('\n');
fs.writeFileSync(path.join(outDir, 'ab-results.md'), md + '\n');
console.log(md);
if (verdicts.some(v => !v.met)) process.exitCode = 1;
