import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { diagnosticScriptIdentity } from './audioDiagnosticIdentity.mjs';

export const SPARSE_SUCCESSOR_CONTRACT = '84e588044f4e830063895ae8e9d94bd8c69d759b3bf73243faa4e29aebc0ddda';
export const SPARSE_STRESS_WINDOWS = Object.freeze({
  'stress-shipcrash-bloom': 210, 'stress-mining-burst': 60,
  'stress-oxygen-dive': 60, 'stress-terminal-storylead': 60, 'stress-jetpack-splash': 60
});
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const digest = value => /^[a-f0-9]{64}$/.test(value ?? '');
const inputs = options => Object.fromEntries(Object.entries(options ?? {}).filter(([key]) => !['musicSilent', 'sfxAudible'].includes(key)).sort(([a], [b]) => a.localeCompare(b)));

/** Numeric classification only. Present/audible effects, musical acceptance and
 * the independent bed/BLOOM/floor/duck gates cannot be inferred from this floor. */
export function evaluateSparseStressPair(name, quality, sum, ducked, provenance) {
  const seconds = SPARSE_STRESS_WINDOWS[name];
  const s = sum?.diagnostics, d = ducked?.diagnostics;
  const sumI = sum?.loudness?.integratedLufs, duckedI = ducked?.loudness?.integratedLufs;
  const tp = sum?.loudness?.truePeakDbtp;
  const original = { integratedPass: Number.isFinite(sumI) && sumI >= -19.5 && sumI <= -16.5,
    truePeakPass: Number.isFinite(tp) && tp <= -1, lowerLufs: -19.5, upperLufs: -16.5 };
  original.pass = original.integratedPass && original.truePeakPass;
  const checks = {
    originalFixture: seconds != null && ['full', 'lean'].includes(quality),
    sameSource: provenance?.sourceUnchanged === true,
    declarationsBeforeRender: provenance?.declarationsMatched === true,
    actualFloatWavs: provenance?.wavsMatched === true,
    actualSum: s?.variant === 'sum' && s?.purpose === 'acceptance-sum' && s?.sourceOptions?.musicSilent === false && s?.sourceOptions?.sfxAudible === true,
    matchingDuckedMusic: d?.variant === 'music-ducked' && d?.sourceOptions?.musicSilent === false && d?.sourceOptions?.sfxAudible === false,
    sameInputs: Boolean(s && d && same(inputs(s.sourceOptions), inputs(d.sourceOptions))),
    fullWindowAndTier: [sum, ducked].every(row => row?.name === name && row?.seconds === seconds && row?.diagnostics?.sourceOptions?.seconds === seconds
      && row?.diagnostics?.sourceOptions?.bedQuality === quality && row?.diagnostics?.sourceOptions?.tail === 'shipped'
      && row?.diagnostics?.sourceOptions?.musicBusGlue === true),
    sameEventsAndDucks: false,
    completeMeterData: [sum, ducked].every(row => {
      const energy = row?.diagnostics?.energy;
      return energy && [44100, 48000].includes(energy.sampleRate) && energy.frames === seconds * energy.sampleRate
        && energy.seconds === seconds && energy.gateBlocks?.length === Math.floor((seconds - 0.4) / 0.1 + 1e-8) + 1
        && energy.shortTermWindows?.length === Math.floor((seconds - 3) / 0.1 + 1e-8) + 1
        && Number.isFinite(energy.meanGatedKPower) && Number.isFinite(energy.totalKWeightedEnergySeconds)
        && digest(row.pcmSha256) && digest(row.wavSha256) && row.analysis?.nanCount === 0;
    }),
    upperIntegrated: Number.isFinite(sumI) && sumI <= -16.5,
    truePeak: Number.isFinite(tp) && tp <= -1,
    relativeFloor: Number.isFinite(sumI) && Number.isFinite(duckedI) && sumI >= duckedI - 0.10
  };
  try {
    checks.sameEventsAndDucks = diagnosticScriptIdentity(sum) === diagnosticScriptIdentity(ducked)
      && same(s.scheduledCues, d.scheduledCues) && same(s.dispatchedCues, d.dispatchedCues)
      && same(s.drivingControls, d.drivingControls) && same(sum.stressEvidence?.density, ducked.stressEvidence?.density)
      && s.counts.originalScheduled === d.counts.originalScheduled
      && s.counts.variantScheduled === d.counts.variantScheduled && s.counts.offlineDispatched === d.counts.offlineDispatched;
  } catch { /* absent evidence fails; historical rows are never backfilled */ }
  return { name, quality, seconds, measured: { sumI, musicDuckedI: duckedI, deltaI: sumI - duckedI, truePeakDbtp: tp },
    original, successor: { pass: Object.values(checks).every(Boolean), relativeAllowanceLu: 0.10, checks },
    interpretation: 'Sparse numeric classification only; not an audibility, bed/BLOOM/floor, duck, recipe, runtime or listening verdict.' };
}

function inspectWav(directory, row) {
  if (!row?.wavFile || path.basename(row.wavFile) !== row.wavFile) return false;
  const bytes = fs.readFileSync(path.join(directory, row.wavFile));
  if (hash(bytes) !== row.wavSha256 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') return false;
  let format, data;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const length = bytes.readUInt32LE(offset + 4), end = offset + 8 + length;
    if (end > bytes.length) return false;
    const chunk = bytes.toString('ascii', offset, offset + 4);
    if (chunk === 'fmt ') format = bytes.subarray(offset + 8, end);
    if (chunk === 'data') data = bytes.subarray(offset + 8, end);
    offset = end + (length % 2);
  }
  if (!format || format.length < 16 || !data || format.readUInt16LE(0) !== 3 || format.readUInt16LE(14) !== 32) return false;
  const channels = format.readUInt16LE(2), rate = format.readUInt32LE(4);
  if (channels !== 2 || rate !== row.diagnostics?.energy?.sampleRate || data.length !== row.seconds * rate * channels * 4 || hash(data) !== row.pcmSha256) return false;
  for (let offset = 0; offset < data.length; offset += 4) if (!Number.isFinite(data.readFloatLE(offset))) return false;
  return true;
}

/** A fresh report: no historical summary, measurement, or verdict is rewritten. */
export function buildSparseStressReport(directory) {
  const read = name => JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'));
  const summary = read('summary.json'), before = read('source-hashes-before.json'), after = read('source-hashes-after.json');
  const declarations = read('input-declarations.json');
  const sourceFilesSha256 = hash(JSON.stringify(before));
  const sourceUnchanged = summary.sourceUnchanged === true && same(before, after)
    && ['src/audio/generative/tuning.ts', 'src/audio/bedEngine.ts', 'src/audio/soak/excerpts.ts', 'src/audio/sfxEngine.ts', 'src/audio/audioCore.ts'].every(file => digest(before[file]));
  const rows = [];
  for (const name of Object.keys(SPARSE_STRESS_WINDOWS)) for (const quality of ['full', 'lean']) {
    const sum = summary.renders[`${name}@${quality}@sum`], ducked = summary.renders[`${name}@${quality}@music-ducked`];
    let declarationsMatched = true, wavsMatched = true;
    const errors = [];
    for (const [variant, row] of [['sum', sum], ['music-ducked', ducked]]) {
      const entry = declarations[`${name}@${quality}@${variant}`], declared = entry?.declaration;
      declarationsMatched &&= Boolean(declared && entry?.beforeStressRender && Number.isFinite(Date.parse(entry.declaredAt))
        && entry.sourceFilesSha256 === sourceFilesSha256 && entry.declarationSha256 === hash(JSON.stringify(declared))
        && declared.name === name && declared.quality === quality && declared.variant === variant
        && digest(declared.nominalDrivingSignalsSha256)
        && same(inputs(declared.sourceOptions), inputs(row?.diagnostics?.sourceOptions))
        && declared.originalSfxScriptSha256 === row?.diagnostics?.originalSfxScriptSha256
        && same(declared.scheduledCues, row?.diagnostics?.scheduledCues)
        && same(declared.density, row?.stressEvidence?.density));
      try { wavsMatched &&= inspectWav(directory, row); } catch (error) { wavsMatched = false; errors.push(String(error)); }
    }
    const a = declarations[`${name}@${quality}@sum`]?.declaration, b = declarations[`${name}@${quality}@music-ducked`]?.declaration;
    declarationsMatched &&= Boolean(a && b && a.nominalDrivingSignalsSha256 === b.nominalDrivingSignalsSha256 && a.bloomWindowStartS === b.bloomWindowStartS);
    const row = evaluateSparseStressPair(name, quality, sum, ducked, { sourceUnchanged, declarationsMatched, wavsMatched });
    row.inputErrors = errors;
    // Preserve all K-energy/gate and 3-second observations, not just averages.
    row.evidence = Object.fromEntries([['sum', sum], ['music-ducked', ducked]].map(([key, value]) => [key, value ? {
      pcmSha256: value.pcmSha256, wavSha256: value.wavSha256, wavFile: value.wavFile,
      loudness: value.loudness, diagnostics: value.diagnostics, stressEvidence: value.stressEvidence,
      declaration: declarations[`${name}@${quality}@${key}`]
    } : null]));
    rows.push(row);
  }
  return { generatedAt: new Date().toISOString(), contractSha256: SPARSE_SUCCESSOR_CONTRACT, sourceFilesSha256,
    sourceUnchanged, rows, originalPass: rows.every(row => row.original.pass), successorPass: rows.every(row => row.successor.pass),
    scope: 'Exactly five original sparse fixtures in both tiers. Nominal -18 reference retained. No historical failures reclassified; no other acceptance gate changed.' };
}
