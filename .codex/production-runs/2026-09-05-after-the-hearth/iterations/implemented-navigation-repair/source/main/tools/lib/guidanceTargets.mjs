const text = value => typeof value === 'string' && value.trim().length > 0;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const refs = value => Array.isArray(value) && value.length > 0 && value.every(text);
const count = value => Number.isInteger(value) && value >= 0;
const position = value => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
const rect = value => record(value) && ['left', 'top', 'right', 'bottom'].every(key => Number.isFinite(value[key]))
  && value.right > value.left && value.bottom > value.top;

export function guidanceTargetMode(objective) {
  return objective.targetMode ?? (objective.requiresMarker === true ? 'directional-marker' : null);
}

/** A survey designation or an action without a target must be declared explicitly. */
export function validateGuidanceTargetContract(objective, collector) {
  const mode = guidanceTargetMode(objective), target = objective.targetContract;
  const check = (ok, code, message) => collector.assert(ok, `ux.contract-${code}`, `${objective.id}: ${message}`);
  check(text(objective.markerLabel), 'marker-label', 'the exact objective label is required');
  if (objective.requiresMarker === true) {
    check(mode === 'directional-marker' && target === undefined, 'marker', 'required directional markers retain their original contract');
    return;
  }
  check(objective.requiresMarker === false && ['survey-bracket', 'none'].includes(mode), 'target-mode', 'marker-free guidance needs an explicit survey or no-target mode');
  check(record(target) && ['ownerRef', 'selectionRef', 'readinessCriterion', 'completionCriterion'].every(key => text(target[key]))
    && refs(target.evidenceFields) && new Set(target.evidenceFields).size === target.evidenceFields.length,
  'target-contract', 'target ownership, selection, readiness, completion and raw evidence fields are required');
  check(mode === 'survey-bracket'
    ? objective.kind === 'interact' && target?.maxVisibleTargets === 1
    : mode === 'none' && ['travel', 'wait', 'interact'].includes(objective.kind) && target?.maxVisibleTargets === 0,
  'target-ceiling', 'resource interactions have one survey target; explicit actions without a target have zero');
  if (mode === 'none' && objective.kind === 'interact') {
    check(['controlId', 'controlAvailable', 'controlInputActive'].every(field => target?.evidenceFields?.includes(field)),
      'control-fields', 'a target-free interaction must expose the actual named control, availability and input state');
  }
}

/** Validate captured mode-specific proof without inventing directional marker observations. */
export function validateGuidanceTargetEvidence(evidence, contracted, binding, collector, context = contracted.id) {
  const mode = guidanceTargetMode(contracted), target = contracted.targetContract;
  const check = (ok, code, message) => collector.assert(ok, `ux.lifecycle-${code}`, `${context}: ${message}`);
  check(record(evidence) && evidence.targetMode === mode, 'target-mode', 'observed target mode must match the contract');
  if (!record(evidence)) return;
  check(evidence.directionalMarkerCount === 0 && (!evidence.markerObservations || evidence.markerObservations.length === 0),
    'target-no-directional-marker', 'survey/no-target proof cannot fabricate a directional marker');
  const observations = Array.isArray(evidence.targetObservations) ? evidence.targetObservations : [];
  const entries = evidence.entryCount ?? 1;
  const validEntries = Number.isSafeInteger(entries) && entries > 0 && observations.length >= entries;
  const seenEntries = new Set(observations.map(row => row?.entryIndex));
  check(validEntries, 'target-observations', 'every normal-route entry needs presented target observations');
  check(validEntries && seenEntries.size === entries
    && observations.every(row => count(row?.entryIndex) && row.entryIndex < entries),
  'target-entry-coverage', 'observations must identify every normal-route entry');
  const observedMaximum = observations.reduce((maximum, row) => Math.max(maximum, row?.visibleTargetCount), 0);
  check(count(evidence.maximumVisibleTargetCount) && evidence.maximumVisibleTargetCount === observedMaximum
    && observedMaximum <= target?.maxVisibleTargets, 'target-count', 'reported and observed visible target counts must agree within the exact ceiling');
  for (const row of observations) {
    check(record(row) && refs(target?.evidenceFields) && target.evidenceFields.every(field => Object.hasOwn(row, field)),
      'target-raw-fields', 'all contracted raw observation fields must be present');
    check(row?.objectiveId === contracted.id && row?.sourceRevision === binding.sourceRevision
      && row?.contractSha256 === binding.contractSha256 && text(row?.presentedFrameId) && refs(row?.evidenceRefs),
    'target-binding', 'observations must bind the objective, source, contract and presented-frame evidence');
    check(count(row?.visibleTargetCount) && row.visibleTargetCount <= target?.maxVisibleTargets,
      'target-observed-count', 'observations cannot exceed the declared target count');
    if (mode === 'survey-bracket' && row?.state === 'ready') {
      check(row.visibleTargetCount === 1 && text(row.targetId) && row.targetLabel === contracted.markerLabel
        && row.visible === true && row.actionable === true && row.depleted === false
        && row.legalApproach === true && position(row.worldPosition) && rect(row.projectedRect) && rect(row.labelRect),
      'target-ready', 'a ready survey objective needs its exact visible, actionable, nondepleted target and legal approach');
    }
    if (mode === 'none' && contracted.kind === 'interact') {
      check(text(row?.controlId) && typeof row.controlAvailable === 'boolean'
        && typeof row.controlInputActive === 'boolean' && (row.state !== 'ready' || row.controlAvailable),
      'control-observation', 'control observations must identify real availability and input; ready requires an available control');
    }
  }
  if (mode === 'survey-bracket') {
    check(evidence.targetMissingWhileReadyFrames === 0, 'target-ready-health', 'a required survey target cannot be missing while ready');
    const readyEntries = new Set(observations.filter(row => row?.state === 'ready'
      && count(row.entryIndex) && row.entryIndex < entries).map(row => row.entryIndex));
    check(validEntries && readyEntries.size === entries,
      'target-ready-entry', 'each normal-route entry needs a ready survey observation');
  }
  const completion = evidence.completionEvidence;
  check(record(completion) && completion.objectiveId === contracted.id
    && completion.sourceRevision === binding.sourceRevision && completion.contractSha256 === binding.contractSha256
    && completion.predicateBefore === false && completion.predicateAfter === true
    && completion.progressionChangedByFeedback === false && text(completion.causeId) && refs(completion.evidenceRefs),
  'target-completion-binding', 'completion must bind the actual causal predicate transition and source evidence');
  if (!record(completion)) return;
  if (mode === 'survey-bracket') {
    const deltas = completion.itemDeltas;
    const positiveYield = record(deltas) && Object.values(deltas).every(Number.isFinite) && Object.values(deltas).some(value => value > 0);
    check(completion.kind === 'resource-receipt' && completion.committed === true && text(completion.receiptId)
      && (positiveYield || text(completion.collectedReceiptId)),
    'target-completion-receipt', 'survey completion needs a committed positive yield or actual collected receipt');
  } else if (contracted.kind === 'travel') {
    check(completion.kind === 'player-traversal' && completion.transferReason === 'player-traversal'
      && count(completion.geometryEpoch) && completion.geometryEpoch === completion.armedGeometryEpoch
      && count(completion.transferSequence) && count(completion.armedTransferSequence)
      && completion.transferSequence > completion.armedTransferSequence && completion.movementAfterArm === true
      && text(completion.presentedDestinationFrameId),
    'target-completion-transfer', 'a camera transfer needs fresh movement after arming within the same valid geometry epoch');
  } else if (contracted.kind === 'interact') {
    check(completion.kind === 'control-input' && text(completion.controlId)
      && completion.inputAccepted === true && Number.isFinite(completion.inputStartedAtSeconds)
      && Number.isFinite(completion.completedAtSeconds) && completion.completedAtSeconds >= completion.inputStartedAtSeconds
      && text(completion.controlStateBefore) && text(completion.controlStateAfter)
      && completion.controlStateBefore !== completion.controlStateAfter
      && observations.some(row => row.controlId === completion.controlId && row.controlAvailable && row.controlInputActive),
    'target-completion-control', 'a control interaction needs accepted fresh input and an actual state transition, never a timed bundle');
  } else {
    check(completion.kind === 'authored-bundle' && completion.bundleFired === true && text(completion.bundleId)
      && completion.authoredTimingSatisfied === true && Number.isFinite(completion.firedAtSeconds)
      && Number.isFinite(completion.completedAtSeconds) && completion.completedAtSeconds >= completion.firedAtSeconds,
    'target-completion-bundle', 'a wait needs the actual fired bundle and its authored timing evidence');
  }
}
