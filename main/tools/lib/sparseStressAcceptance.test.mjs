import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateSparseStressPair } from './sparseStressAcceptance.mjs';

const name = 'stress-mining-burst';
const ok = { sourceUnchanged: true, declarationsMatched: true, wavsMatched: true };
function row(variant, integratedLufs = -20.5) {
  return { name, seconds: 60, pcmSha256: 'a'.repeat(64), wavSha256: 'b'.repeat(64), analysis: { nanCount: 0 },
    loudness: { integratedLufs, truePeakDbtp: -2 }, stressEvidence: { density: { declared: 'same original script' } },
    diagnostics: { variant, purpose: variant === 'sum' ? 'acceptance-sum' : 'diagnostic-only',
      sourceOptions: { seconds: 60, planetSeed: 5, sfxSeed: 1375191262, bedQuality: 'full', tail: 'shipped', musicBusGlue: true, musicSilent: false, sfxAudible: variant === 'sum' },
      originalSfxScriptSha256: 'c'.repeat(64), drivingSignalsSha256: 'd'.repeat(64),
      scheduledCues: [{ t: 20, event: 'mine' }], dispatchedCues: [{ cue: { t: 20, event: 'mine' }, dispatchedAtS: 19.92 }],
      drivingControls: [{ atS: 0, storyLeads: false }], counts: { originalScheduled: 1, variantScheduled: 1, offlineDispatched: 1 },
      energy: { sampleRate: 44100, frames: 2646000, seconds: 60, meanGatedKPower: 0.01, totalKWeightedEnergySeconds: 0.6,
        gateBlocks: Array(597).fill({ kPower: 0.01 }), shortTermWindows: Array(571).fill({ kPower: 0.01 }) } } };
}
const compare = (sum = row('sum'), duck = row('music-ducked'), provenance = ok, fixture = name) => evaluateSparseStressPair(fixture, 'full', sum, duck, provenance);

test('keeps old sparse failure alongside explicit successor pass without an absolute lower bound', () => {
  const result = compare();
  assert.equal(result.original.integratedPass, false);
  assert.equal(result.original.pass, false);
  assert.equal(result.successor.pass, true);
  assert.equal(result.measured.deltaI, 0);
});
test('relative floor is exact and never rounded into a pass', () => {
  assert.equal(compare(row('sum', -20.6)).successor.pass, true);
  assert.equal(compare(row('sum', -20.600000001)).successor.pass, false);
});
test('upper integrated and true peak limits are independently retained', () => {
  assert.equal(compare(row('sum', -16.499999)).successor.checks.upperIntegrated, false);
  const sum = row('sum'); sum.loudness.truePeakDbtp = -0.999999;
  assert.equal(compare(sum).successor.checks.truePeak, false);
});
test('missing source, predeclared input or actual float-WAV proof cannot pass', () => {
  for (const key of Object.keys(ok)) assert.equal(compare(undefined, undefined, { ...ok, [key]: false }).successor.pass, false);
});
test('different source controls, event time, dispatch or duck traces fail matching', () => {
  const cases = [
    d => { d.diagnostics.sourceOptions.planetSeed = 8; },
    d => { d.diagnostics.scheduledCues[0].t = 21; },
    d => { d.diagnostics.dispatchedCues[0].dispatchedAtS = 20; },
    d => { d.diagnostics.drivingSignalsSha256 = 'e'.repeat(64); }
  ];
  for (const change of cases) { const duck = row('music-ducked'); change(duck); assert.equal(compare(undefined, duck).successor.pass, false); }
});
test('short windows, missing meter blocks and other fixtures cannot inherit the correction', () => {
  const sum = row('sum'); sum.diagnostics.energy.gateBlocks.pop();
  assert.equal(compare(sum).successor.pass, false);
  assert.equal(compare(undefined, undefined, ok, 'bed-sandbox-day').successor.pass, false);
  const duck = row('music-ducked'); duck.seconds = 59;
  assert.equal(compare(undefined, duck).successor.pass, false);
});
test('a solo or non-shared-tail render is never an actual sum', () => {
  const sum = row('sum'); sum.diagnostics.purpose = 'diagnostic-only';
  assert.equal(compare(sum).successor.pass, false);
  sum.diagnostics.purpose = 'acceptance-sum'; sum.diagnostics.sourceOptions.tail = 'pre-tail';
  assert.equal(compare(sum).successor.pass, false);
});
