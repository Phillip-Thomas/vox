import assert from 'node:assert/strict';
import test from 'node:test';
import { guidanceTargetMode, validateGuidanceTargetContract, validateGuidanceTargetEvidence } from './guidanceTargets.mjs';

const binding = { sourceRevision: 'actual-source', contractSha256: 'actual-contract' };
const collect = run => {
  const failures = [];
  run({ assert: (ok, code) => { if (!ok) failures.push(code); } });
  return failures;
};
function fixture(mode = 'survey-bracket', kind = 'interact') {
  const objective = {
    id: 'ch1-fixed:recover-first-debris', kind, markerLabel: 'RECOVER DEBRIS.', requiresMarker: false, targetMode: mode,
    targetContract: {
      ownerRef: 'debris.ts', selectionRef: 'activeDebrisId', readinessCriterion: 'actual uncollected target',
      completionCriterion: 'committed loot receipt', maxVisibleTargets: mode === 'none' ? 0 : 1,
      evidenceFields: ['targetId', 'visibleTargetCount'],
    },
  };
  const rect = { left: 4, top: 5, right: 24, bottom: 25 };
  const completion = {
    ...binding, objectiveId: objective.id, predicateBefore: false, predicateAfter: true,
    progressionChangedByFeedback: false, causeId: 'committed-action-1', evidenceRefs: ['receipt.json'],
    kind: 'resource-receipt', committed: true, receiptId: 'receipt-1', itemDeltas: { wood: 2, stone: 2 },
  };
  if (kind === 'travel') Object.assign(completion, {
    kind: 'player-traversal', transferReason: 'player-traversal', geometryEpoch: 3, armedGeometryEpoch: 3,
    transferSequence: 5, armedTransferSequence: 4, movementAfterArm: true, presentedDestinationFrameId: 'frame-8',
  });
  if (kind === 'wait') Object.assign(completion, {
    kind: 'authored-bundle', bundleFired: true, bundleId: 'unbolt', authoredTimingSatisfied: true,
    firedAtSeconds: 7, completedAtSeconds: 7.02,
  });
  return { objective, evidence: {
    targetMode: mode, directionalMarkerCount: 0, entryCount: 1, maximumVisibleTargetCount: mode === 'none' ? 0 : 1,
    targetMissingWhileReadyFrames: 0,
    targetObservations: [{
      ...binding, objectiveId: objective.id, entryIndex: 0, presentedFrameId: 'frame-7', evidenceRefs: ['frame-7.png'],
      state: 'ready', visibleTargetCount: mode === 'none' ? 0 : 1, targetId: 'debris-0', targetLabel: objective.markerLabel,
      visible: true, actionable: true, depleted: false, legalApproach: true, worldPosition: [4, 0, 0], projectedRect: rect, labelRect: rect,
    }], completionEvidence: completion,
  } };
}
const validate = ({ objective, evidence }) => collect(c => {
  validateGuidanceTargetContract(objective, c);
  validateGuidanceTargetEvidence(evidence, objective, binding, c);
});

test('legacy directional contracts retain their exact existing requirement', () => {
  const objective = { id: 'pod', kind: 'interact', markerLabel: 'RECOVER POD.', requiresMarker: true };
  assert.equal(guidanceTargetMode(objective), 'directional-marker');
  assert.deepEqual(collect(c => validateGuidanceTargetContract(objective, c)), []);
  for (const extra of [{ targetMode: 'none' }, { markerLabel: '' }, { targetContract: {} }]) {
    assert.ok(collect(c => validateGuidanceTargetContract({ ...objective, ...extra }, c)).length);
  }
});
test('actual single survey, fresh traversal and authored wait evidence pass', () => {
  for (const pair of [[], ['none', 'travel'], ['none', 'wait']]) assert.deepEqual(validate(fixture(...pair)), []);
});
test('declaring no marker cannot waive ownership, readiness, kind or target ceiling', () => {
  for (const mutate of [
    f => delete f.objective.targetMode,
    f => delete f.objective.targetContract,
    f => f.objective.targetContract.ownerRef = '',
    f => f.objective.targetContract.evidenceFields = 'not-an-array',
    f => f.objective.targetContract.evidenceFields = ['same', 'same'],
    f => f.objective.kind = 'wait',
    f => f.objective.targetContract.maxVisibleTargets = 2,
  ]) { const f = fixture(); mutate(f); assert.ok(validate(f).length); }
});
test('multiple, invisible, depleted or unreachable targets fail even with a passing summary', () => {
  for (const change of [
    { visibleTargetCount: 2 }, { visible: false }, { actionable: false }, { depleted: true },
    { legalApproach: false }, { targetLabel: 'OTHER' }, { worldPosition: [0, NaN, 0] },
    { projectedRect: { left: 2, top: 2, right: 1, bottom: 3 } }, { targetId: '' },
  ]) { const f = fixture(); Object.assign(f.evidence.targetObservations[0], change); assert.ok(validate(f).length); }
});
test('evidence must bind the actual source, objective, contract and presented frame', () => {
  for (const field of ['sourceRevision', 'contractSha256', 'objectiveId', 'presentedFrameId', 'evidenceRefs', 'targetId']) {
    const f = fixture(); delete f.evidence.targetObservations[0][field]; assert.ok(validate(f).length, field);
  }
  const f = fixture(); f.evidence.markerObservations = [{}]; assert.ok(validate(f).length);
});
test('malformed or incomplete entry evidence fails without throwing or allocating from untrusted counts', () => {
  for (const entries of [0, -1, NaN, Infinity, 1.5, 2, Number.MAX_VALUE]) {
    const f = fixture(); f.evidence.entryCount = entries; assert.ok(validate(f).length);
  }
  for (const rows of [[], [null], [{}]]) { const f = fixture(); f.evidence.targetObservations = rows; assert.ok(validate(f).length); }
  const f = fixture(); f.evidence.targetObservations[0].state = 'unready'; assert.ok(validate(f).length);
});
test('each entry needs its own real ready observation', () => {
  const f = fixture(); f.evidence.entryCount = 2;
  f.evidence.targetObservations.push({ ...f.evidence.targetObservations[0] });
  assert.ok(validate(f).length);
  f.evidence.targetObservations[1].entryIndex = 1; assert.deepEqual(validate(f), []);
  f.evidence.targetObservations[1].state = 'unready'; assert.ok(validate(f).length);
});
test('resource completion requires a committed real receipt and causal predicate transition', () => {
  for (const change of [
    { committed: false }, { receiptId: '' }, { itemDeltas: {} }, { itemDeltas: { wood: 0 } },
    { itemDeltas: { wood: NaN } }, { predicateBefore: true }, { predicateAfter: false },
    { progressionChangedByFeedback: true }, { sourceRevision: 'stale' }, { evidenceRefs: [] },
  ]) { const f = fixture(); Object.assign(f.evidence.completionEvidence, change); assert.ok(validate(f).length); }
  const f = fixture(); delete f.evidence.completionEvidence.itemDeltas;
  f.evidence.completionEvidence.collectedReceiptId = 'real-after-commit'; assert.deepEqual(validate(f), []);
});
test('resize, old transfer, synthetic crossing or missing destination cannot complete travel', () => {
  for (const change of [
    { geometryEpoch: 4 }, { transferReason: 'resize' }, { movementAfterArm: false },
    { transferSequence: 4 }, { geometryEpoch: NaN }, { presentedDestinationFrameId: '' },
  ]) { const f = fixture('none', 'travel'); Object.assign(f.evidence.completionEvidence, change); assert.ok(validate(f).length); }
});
test('a zero-target wait still needs a real bundle at its authored timing', () => {
  for (const change of [
    { bundleFired: false }, { authoredTimingSatisfied: false }, { bundleId: '' },
    { firedAtSeconds: NaN }, { completedAtSeconds: 6 },
  ]) { const f = fixture('none', 'wait'); Object.assign(f.evidence.completionEvidence, change); assert.ok(validate(f).length); }
  const f = fixture('none', 'wait'); f.evidence.targetObservations[0].visibleTargetCount = 1;
  f.evidence.maximumVisibleTargetCount = 1; assert.ok(validate(f).length);
});
test('a variant cannot claim parity without its own target evidence', () => {
  const f = fixture(); f.evidence = undefined; assert.ok(validate(f).length);
});
