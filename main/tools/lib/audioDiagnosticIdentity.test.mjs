import assert from 'node:assert/strict';
import test from 'node:test';
import { diagnosticScriptIdentity } from './audioDiagnosticIdentity.mjs';

const fixture = () => ({
  diagnostics: { originalSfxScriptSha256: 'a'.repeat(64), drivingSignalsSha256: 'b'.repeat(64) },
  stressEvidence: { bloomReference: { windowStartS: 77.5, impactAtS: 78.7, shortTermMaxLufs: -14.653310052297273 } },
});
test('repeat meter variation leaves identical render inputs matched without altering observations', () => {
  const a = fixture(), b = fixture();
  b.stressEvidence.bloomReference.shortTermMaxLufs = -14.653308117343286;
  const before = structuredClone(b);
  assert.equal(diagnosticScriptIdentity(a), diagnosticScriptIdentity(b));
  assert.deepEqual(b, before);
});
test('every actual script, driving signal and BLOOM input time remains exact', () => {
  const a = fixture();
  for (const change of [
    b => b.diagnostics.originalSfxScriptSha256 = 'c'.repeat(64),
    b => b.diagnostics.drivingSignalsSha256 = 'c'.repeat(64),
    b => b.stressEvidence.bloomReference.windowStartS += 0.000001,
    b => b.stressEvidence.bloomReference.impactAtS += 0.000001,
    b => b.stressEvidence.bloomReference = null,
  ]) {
    const b = fixture(); change(b);
    assert.notEqual(diagnosticScriptIdentity(a), diagnosticScriptIdentity(b));
  }
});
test('missing hashes or invalid BLOOM times cannot agree accidentally', () => {
  const a = fixture(); delete a.diagnostics.drivingSignalsSha256;
  assert.throws(() => diagnosticScriptIdentity(a), /input hash/);
  for (const value of [undefined, null, NaN, Infinity, '77.5']) {
    const b = fixture(); b.stressEvidence.bloomReference.windowStartS = value;
    assert.throws(() => diagnosticScriptIdentity(b), /input time/);
  }
  const c = fixture(); delete c.stressEvidence.bloomReference;
  assert.equal(typeof diagnosticScriptIdentity(c), 'string');
});
