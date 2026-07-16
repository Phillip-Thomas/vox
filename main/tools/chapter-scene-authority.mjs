import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const defaultMainRoot = resolve(here, '..');
const defaultRepoRoot = resolve(defaultMainRoot, '..');

const REPORT_SCHEMA = 'paravoxia.chapterSceneAuthorityCertificationReport.v1';
const QUALITY_SCHEMA = 'paravoxia.creativeRunQualityReport.v1';
const LOCK_SCHEMA = 'paravoxia.productionLock.v1';
const SIGNOFFS_SCHEMA = 'paravoxia.directorSignoffs.v1';
const SIGNOFF_SCHEMA = 'paravoxia.directorSignoff.v1';
const HUMAN_SCHEMA = 'paravoxia.humanDecision.v1';
const DIRECTORS = ['chapter', 'score', 'cinematography'];
const SIGNOFF_FILES = {
  chapter: 'chapter-contract-signoff.json',
  score: 'score-contract-signoff.json',
  cinematography: 'cinematography-contract-signoff.json'
};
const EXISTING_ANCHOR_DOMAINS = ['story', 'camera', 'effect', 'score', 'control'];
const PLACEHOLDER = /\{\{|\}\}|\b(?:TODO|TBD|PLACEHOLDER|FILL[ -]?ME|REPLACE[ -]?ME|pending)\b/i;

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0 && !PLACEHOLDER.test(value);
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function staysWithin(root, candidate) {
  const path = relative(root, candidate);
  return path === '' || (path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path));
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function makeAudit() {
  return {
    checks: 0,
    failures: [],
    assert(condition, code, message, details = undefined) {
      this.checks += 1;
      if (!condition) this.failures.push({ code, message, ...(details === undefined ? {} : { details }) });
      return Boolean(condition);
    }
  };
}

function readRequiredJson(audit, path, code, label) {
  if (!audit.assert(existsSync(path), code, `${label} is required`, { path })) return null;
  try {
    return readJson(path);
  } catch (error) {
    audit.assert(false, code, `${label} must be valid JSON`, {
      path,
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

function runGit(repoRoot, args) {
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 15_000,
    maxBuffer: 4 * 1024 * 1024
  });
  return result.status === 0 ? String(result.stdout).trim() : null;
}

function runCurrentCreativeGate(repoRoot, runPath) {
  const gatePath = resolve(repoRoot, 'main/tools/creative-triad-gate.mjs');
  const result = spawnSync(
    process.execPath,
    [gatePath, '--run', runPath, '--phase', 'final', '--check-only'],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      timeout: 120_000,
      maxBuffer: 32 * 1024 * 1024
    }
  );
  const stdout = String(result.stdout ?? '');
  const stderr = String(result.stderr ?? '');
  const combined = `${stdout}${stderr}`;
  const failureCodes = [...new Set([...combined.matchAll(/^- \[([^\]]+)]/gm)].map((match) => match[1]))];
  return {
    command: 'node main/tools/creative-triad-gate.mjs --run <run> --phase final --check-only',
    exitCode: result.status,
    signal: result.signal ?? null,
    passed: result.status === 0,
    failureCodes,
    outputSha256: sha256(combined),
    error: result.error?.message ?? null
  };
}

function validateCatalogBinding(audit, link, contractPath, contract) {
  const bytes = existsSync(contractPath) ? readFileSync(contractPath) : null;
  const actualHash = bytes ? sha256(bytes) : null;
  audit.assert(actualHash === link.sha256, 'scene.certification.contract-hash', 'Scene contract bytes must match the registry catalog hash', {
    expected: link.sha256,
    actual: actualHash
  });
  audit.assert(contract?.sceneId === link.sceneId, 'scene.certification.contract-identity', 'Scene contract sceneId must match the registry catalog');
  audit.assert(contract?.contractVersion === link.contractVersion, 'scene.certification.contract-identity', 'Scene contract version must match the registry catalog');
  audit.assert(contract?.status === 'frozen', 'scene.certification.contract-status', 'Scene contract must be frozen before certification', {
    actual: contract?.status ?? null
  });
  return actualHash;
}

function validateProductionLock(audit, repoRoot, runPath, contract, contractHash) {
  const lockRef = contract?.production?.productionLockRef;
  audit.assert(nonEmpty(lockRef) && !isAbsolute(lockRef) && !String(lockRef).split('/').includes('..'), 'scene.certification.lock-ref', 'Scene contract must name a run-local production lock');
  const lockPath = nonEmpty(lockRef) ? resolve(runPath, lockRef) : resolve(runPath, 'production-lock.json');
  audit.assert(staysWithin(runPath, lockPath), 'scene.certification.lock-ref', 'Production lock must stay inside the scene run directory');
  const lock = readRequiredJson(audit, lockPath, 'scene.certification.lock', 'Production lock');
  if (!lock) return { lock: null, lockPath, authorityHashesCurrent: false, sourceRevisionCurrent: false };

  audit.assert(lock.schema === LOCK_SCHEMA, 'scene.certification.lock-schema', `Production lock must use ${LOCK_SCHEMA}`);
  audit.assert(lock.status === 'locked', 'scene.certification.lock-status', 'Production lock must remain locked');
  audit.assert(lock.publishAllowed === false, 'scene.certification.publish-authority', 'Production lock may not grant publish authority');
  audit.assert(lock.mode === contract?.production?.mode, 'scene.certification.lock-mode', 'Production lock mode must match the scene contract');
  audit.assert(
    (contract?.scope?.beats ?? []).every((beat) => lock.lockedBeats?.includes(beat)),
    'scene.certification.lock-beats',
    'Production lock must include every contracted beat'
  );

  const authorityResults = [];
  for (const authority of lock.authority ?? []) {
    const authorityPath = resolve(repoRoot, authority?.path ?? '');
    const validPath = nonEmpty(authority?.path) && staysWithin(repoRoot, authorityPath) && existsSync(authorityPath);
    const actual = validPath ? sha256(readFileSync(authorityPath)) : null;
    const current = validPath && actual === authority.sha256;
    audit.assert(validPath, 'scene.certification.authority-path', 'Locked production authority must resolve inside the repository', {
      path: authority?.path ?? null
    });
    audit.assert(current, 'scene.certification.authority-hash', 'Locked production authority hash must match current bytes', {
      path: authority?.path ?? null,
      expected: authority?.sha256 ?? null,
      actual
    });
    authorityResults.push({ path: authority?.path ?? null, expectedSha256: authority?.sha256 ?? null, actualSha256: actual, current });
  }
  audit.assert(authorityResults.length > 0, 'scene.certification.authority', 'Production lock must bind at least one authority source');

  const expectedAuthorityRefs = (lock.authority ?? []).map((entry) => `${entry.path}#${entry.section}`);
  audit.assert(
    sameJson(contract?.production?.authorityRefs ?? [], expectedAuthorityRefs),
    'scene.certification.authority-refs',
    'Scene contract authorityRefs must exactly mirror the production lock',
    { expected: expectedAuthorityRefs, actual: contract?.production?.authorityRefs ?? [] }
  );

  const head = runGit(repoRoot, ['rev-parse', 'HEAD']);
  const trackedStatus = runGit(repoRoot, ['status', '--porcelain=v1', '--untracked-files=no']);
  const trackedClean = trackedStatus === '';
  const sourceRevisionCurrent = nonEmpty(head) && trackedClean && lock.sourceRevision === head;
  audit.assert(
    sourceRevisionCurrent,
    'scene.certification.source-revision',
    'Production lock must bind the exact clean tracked HEAD; timestamped working-tree labels are not reproducible certification hashes',
    { locked: lock.sourceRevision ?? null, head, trackedClean }
  );

  const checkResultsPath = resolve(runPath, 'check-results.json');
  const checkResults = readRequiredJson(audit, checkResultsPath, 'scene.certification.check-results', 'Production check results');
  if (checkResults) {
    audit.assert(checkResults.runId === lock.runId, 'scene.certification.check-results-identity', 'Check results must target the production lock run');
    audit.assert(checkResults.contractVersion === contract?.contractVersion, 'scene.certification.check-results-identity', 'Check results must target the scene contract version');
    audit.assert(checkResults.contractSha256 === contractHash, 'scene.certification.check-results-hash', 'Check results must bind the current scene contract bytes');
    audit.assert(checkResults.sourceRevision === lock.sourceRevision, 'scene.certification.check-results-source', 'Check results must bind the production lock source revision');
  }

  return {
    lock,
    lockPath,
    authorityHashesCurrent: authorityResults.length > 0 && authorityResults.every((entry) => entry.current),
    authorityResults,
    git: { head, trackedClean, sourceRevisionCurrent },
    checkResults
  };
}

function validateSignoffs(audit, runPath, contract, contractHash) {
  const compiledPath = resolve(runPath, 'director-signoffs.json');
  const compiled = readRequiredJson(audit, compiledPath, 'scene.certification.signoffs', 'Compiled director signoffs');
  const results = {};
  if (compiled) {
    audit.assert(compiled.schema === SIGNOFFS_SCHEMA, 'scene.certification.signoffs-schema', `Compiled signoffs must use ${SIGNOFFS_SCHEMA}`);
    audit.assert(compiled.contractRevision === contract?.contractVersion, 'scene.certification.signoffs-revision', 'Compiled signoffs must target the current contract version');
    audit.assert(compiled.contractSha256 === contractHash, 'scene.certification.signoffs-hash', 'Compiled signoffs must bind the current contract bytes');
    audit.assert(compiled.sameRevision === true, 'scene.certification.signoffs-revision', 'All three directors must sign the same revision');
  }

  for (const director of DIRECTORS) {
    const path = resolve(runPath, SIGNOFF_FILES[director]);
    const individual = readRequiredJson(audit, path, 'scene.certification.signoff', `${director} signoff`);
    const aggregate = compiled?.[director];
    const dispositionApproved = ['approve', 'approve-with-notes'].includes(individual?.disposition);
    audit.assert(individual?.schema === SIGNOFF_SCHEMA && individual?.director === director, 'scene.certification.signoff-schema', `${director} must own a ${SIGNOFF_SCHEMA} artifact`);
    audit.assert(individual?.contractVersion === contract?.contractVersion, 'scene.certification.signoff-revision', `${director} signoff must target the current contract version`);
    audit.assert(individual?.contractSha256 === contractHash, 'scene.certification.signoff-hash', `${director} signoff must bind the current contract bytes`);
    audit.assert(dispositionApproved, 'scene.certification.signoff-disposition', `${director} must approve the current contract`);
    audit.assert(nonEmpty(individual?.signedBy) && nonEmpty(individual?.signedAt) && !Number.isNaN(Date.parse(individual?.signedAt)), 'scene.certification.signoff-identity', `${director} signoff must carry a real signer and timestamp`);
    const expectedAggregate = individual ? {
      disposition: individual.disposition,
      revision: individual.contractVersion,
      contractSha256: individual.contractSha256,
      signedBy: individual.signedBy,
      signedAt: individual.signedAt
    } : null;
    audit.assert(sameJson(aggregate, expectedAggregate), 'scene.certification.signoff-assembly', `${director} compiled signoff must losslessly reproduce its owned artifact`);
    results[director] = {
      approved: dispositionApproved,
      signer: individual?.signedBy ?? null,
      signedAt: individual?.signedAt ?? null,
      contractHashMatches: individual?.contractSha256 === contractHash
    };
  }
  return { compiled, directors: results };
}

function validateOwnerAndHumanApproval(audit, runPath, contract, contractHash, lock) {
  const ownerDecisionRefs = contract?.production?.ownerDecisionRefs ?? [];
  const ownerScopeAuthorized = Array.isArray(ownerDecisionRefs) && ownerDecisionRefs.length > 0 && ownerDecisionRefs.every(nonEmpty);
  audit.assert(ownerScopeAuthorized, 'scene.certification.owner-scope', 'Scene contract must cite a concrete owner scope decision');

  const humanPath = resolve(runPath, 'human-decision.json');
  const decision = readRequiredJson(audit, humanPath, 'scene.certification.human-decision', 'Final human decision');
  const humanReleaseApproved = Boolean(
    decision?.schema === HUMAN_SCHEMA &&
      decision?.runId === lock?.runId &&
      decision?.contractVersion === contract?.contractVersion &&
      decision?.contractSha256 === contractHash &&
      decision?.decision === 'approved' &&
      decision?.scopeMatchesProductionLock === true &&
      nonEmpty(decision?.reviewer) &&
      nonEmpty(decision?.reviewedAt) &&
      !Number.isNaN(Date.parse(decision?.reviewedAt)) &&
      (contract?.production?.mode !== 'flagship' && contract?.evidence?.headedTaste?.required !== true || decision?.headedRealGpuEvidence === true)
  );
  audit.assert(decision?.schema === HUMAN_SCHEMA, 'scene.certification.human-schema', `Final human decision must use ${HUMAN_SCHEMA}`);
  audit.assert(decision?.runId === lock?.runId, 'scene.certification.human-identity', 'Final human decision must target the production run');
  audit.assert(decision?.contractVersion === contract?.contractVersion && decision?.contractSha256 === contractHash, 'scene.certification.human-contract', 'Final human decision must bind the current contract bytes');
  audit.assert(decision?.decision === 'approved' && decision?.scopeMatchesProductionLock === true, 'scene.certification.human-approval', 'Final human taste and scope decision must be approved');
  audit.assert(nonEmpty(decision?.reviewer) && nonEmpty(decision?.reviewedAt) && !Number.isNaN(Date.parse(decision?.reviewedAt)), 'scene.certification.human-identity', 'Final human decision must identify its reviewer and timestamp');
  if (contract?.production?.mode === 'flagship' || contract?.evidence?.headedTaste?.required === true) {
    audit.assert(decision?.headedRealGpuEvidence === true, 'scene.certification.human-headed', 'Flagship or headed-taste work requires real-GPU human evidence');
  }
  return { ownerDecisionRefs, ownerScopeAuthorized, humanReleaseApproved, decision };
}

function validateQualityAuthority(audit, runPath, runCurrentGate) {
  const reportPath = resolve(runPath, 'creative-run-quality-report.json');
  const quality = readRequiredJson(audit, reportPath, 'scene.certification.quality-report', 'Creative production quality report');
  const currentGate = runCurrentGate();
  audit.assert(quality?.schema === QUALITY_SCHEMA, 'scene.certification.quality-schema', `Quality report must use ${QUALITY_SCHEMA}`);
  const qualityRunPath = nonEmpty(quality?.runPath) ? resolve(quality.runPath) : null;
  audit.assert(qualityRunPath === runPath, 'scene.certification.quality-run', 'Quality report must identify this exact production run directory', {
    expected: runPath,
    actual: qualityRunPath
  });
  audit.assert(quality?.phase === 'final', 'scene.certification.quality-phase', 'Only a final-phase production quality report can certify a scene', {
    actual: quality?.phase ?? null
  });
  const storedChecksConsistent = Array.isArray(quality?.checks) &&
    quality.checkCount === quality.checks.length &&
    quality.failureCount === quality.checks.filter((check) => check?.passed === false && check?.level === 'error').length &&
    quality.warningCount === quality.checks.filter((check) => check?.passed === false && check?.level === 'warning').length;
  audit.assert(storedChecksConsistent, 'scene.certification.quality-integrity', 'Quality report counts must exactly match its stored checks');
  audit.assert(quality?.passed === true && quality?.failureCount === 0 && storedChecksConsistent, 'scene.certification.quality-report', 'Persisted final production quality report must pass with no failures', {
    phase: quality?.phase ?? null,
    passed: quality?.passed ?? null,
    failureCount: quality?.failureCount ?? null
  });
  audit.assert(nonEmpty(quality?.checkedAt) && !Number.isNaN(Date.parse(quality?.checkedAt)), 'scene.certification.quality-time', 'Quality report must have a valid checkedAt timestamp');
  audit.assert(currentGate.passed, 'scene.certification.current-quality-gate', 'Current scene artifacts must still pass the final creative production gate', {
    exitCode: currentGate.exitCode,
    failureCodes: currentGate.failureCodes,
    error: currentGate.error
  });
  return {
    path: reportPath,
    sha256: existsSync(reportPath) ? sha256(readFileSync(reportPath)) : null,
    schema: quality?.schema ?? null,
    phase: quality?.phase ?? null,
    checkedAt: quality?.checkedAt ?? null,
    persistedPassed: quality?.passed === true && quality?.failureCount === 0,
    currentGate
  };
}

function validateBoundaryAuthority(audit, runPath, chapter, contract, contractHash, lock) {
  const path = resolve(runPath, 'verification-report.json');
  const verification = readRequiredJson(
    audit,
    path,
    'scene.certification.boundary-verification',
    'Scene verification report'
  );
  audit.assert(verification?.schema === 'paravoxia.sceneVerificationReport.v1', 'scene.certification.boundary-verification-schema', 'Boundary proof must come from a scene verification report');
  audit.assert(verification?.runId === lock?.runId, 'scene.certification.boundary-run', 'Boundary verification must target the production run');
  audit.assert(verification?.contractVersion === contract?.contractVersion && verification?.contractSha256 === contractHash, 'scene.certification.boundary-contract', 'Boundary verification must bind the current contract bytes');
  audit.assert(verification?.sourceRevision === lock?.sourceRevision, 'scene.certification.boundary-source', 'Boundary verification must bind the production source revision');

  const requiredAnchorIds = [...new Set(
    ['entry', 'exit']
      .flatMap((side) => chapter?.avBoundary?.[side]?.anchorRefs ?? [])
      .map((ref) => /^scene:[^#]+#anchor:(.+)$/.exec(ref)?.[1])
      .filter(Boolean)
  )];
  const exactAnchors = Array.isArray(verification?.exactAnchors) ? verification.exactAnchors : [];
  const anchorCoverage = requiredAnchorIds.map((anchorId) => {
    const evidence = exactAnchors.find((entry) => (entry?.anchor ?? entry?.id) === anchorId);
    const passedDomains = Object.fromEntries(EXISTING_ANCHOR_DOMAINS.map((domain) => [domain, evidence?.[domain] === 'passed']));
    const passed = Boolean(evidence) && Object.values(passedDomains).every(Boolean) && Array.isArray(evidence?.evidenceRefs) && evidence.evidenceRefs.length > 0;
    audit.assert(passed, 'scene.certification.boundary-anchor', `${chapter.id} boundary anchor ${anchorId} must have exact story, camera, effect, score, and control evidence`, { passedDomains });
    return { anchorId, present: Boolean(evidence), passedDomains, evidenceRefs: evidence?.evidenceRefs ?? [] };
  });
  audit.assert(requiredAnchorIds.length > 0, 'scene.certification.boundary-anchor', `${chapter.id} must declare scene entry and exit anchors`);

  // The current verifier has no machine fields for these claims. Do not infer them
  // from source refs, prose, intended positions, or expected-settled flags.
  const unsupportedClaims = [
    {
      code: 'scene.certification.boundary-save-state',
      claim: 'save and resume state are identical at predecessor exit, entry, exit, and successor entry',
      reason: 'verification-report.json has reset outcomes but no boundary save-state snapshots'
    },
    {
      code: 'scene.certification.boundary-palette',
      claim: 'runtime palette continuity matches the chapter contract',
      reason: 'registry paletteRefs are source pointers, not captured runtime palette telemetry'
    },
    {
      code: 'scene.certification.boundary-mix',
      claim: 'score and live mix ownership remain continuous across the boundary',
      reason: 'exact anchors expose score status but no live mix or audio-owner state'
    },
    {
      code: 'scene.certification.actual-spawn',
      claim: 'player, required NPCs, and ships actually settle on validated dry support',
      reason: 'available probes expose intended or expected-settled values, not actual settled actor telemetry'
    },
    {
      code: 'scene.certification.actual-water-traversal',
      claim: 'agents avoid same-face water walking or use an authored intelligent traversal',
      reason: 'existing evidence counts selected dry-route violations but does not prove same-face water or NPC traversal behavior'
    },
    {
      code: 'scene.certification.actual-height-correction',
      claim: 'no player, NPC, or ship uses a visible nonphysical height correction',
      reason: 'no current evidence artifact records actual settled height corrections per actor'
    }
  ];
  for (const blocker of unsupportedClaims) {
    audit.assert(false, blocker.code, `${chapter.id} cannot certify: ${blocker.claim}`, { reason: blocker.reason });
  }

  return {
    path,
    schema: verification?.schema ?? null,
    sourceRevision: verification?.sourceRevision ?? null,
    requiredAnchorIds,
    anchorCoverage,
    unsupportedClaims,
    limitation: 'Only evidence fields already emitted by the current verifier are evaluated. Unrepresented claims remain blockers rather than being inferred.'
  };
}

function certifyContract({ audit, repoRoot, chapter, link, runCurrentGate }) {
  const contractPath = resolve(repoRoot, link.path);
  audit.assert(staysWithin(repoRoot, contractPath), 'scene.certification.contract-path', 'Scene contract must stay inside the repository', { path: link.path });
  const contract = readRequiredJson(audit, contractPath, 'scene.certification.contract', 'Scene contract');
  if (!contract) return { id: link.id, path: link.path, certified: false };
  const contractHash = validateCatalogBinding(audit, link, contractPath, contract);
  const runPath = dirname(contractPath);
  const lockResult = validateProductionLock(audit, repoRoot, runPath, contract, contractHash);
  const signoffs = validateSignoffs(audit, runPath, contract, contractHash);
  const approval = validateOwnerAndHumanApproval(audit, runPath, contract, contractHash, lockResult.lock);
  const quality = validateQualityAuthority(audit, runPath, () => runCurrentGate(repoRoot, runPath));
  const boundary = validateBoundaryAuthority(audit, runPath, chapter, contract, contractHash, lockResult.lock);
  return {
    id: link.id,
    sceneId: link.sceneId,
    contractVersion: link.contractVersion,
    path: link.path,
    contractSha256: contractHash,
    catalogSha256: link.sha256,
    runPath: relative(repoRoot, runPath).split(sep).join('/'),
    productionLock: {
      runId: lockResult.lock?.runId ?? null,
      sourceRevision: lockResult.lock?.sourceRevision ?? null,
      authorityHashesCurrent: lockResult.authorityHashesCurrent,
      authorityFiles: lockResult.authorityResults ?? [],
      git: lockResult.git ?? null
    },
    signoffs: signoffs.directors,
    approval: {
      ownerDecisionRefs: approval.ownerDecisionRefs,
      ownerScopeAuthorized: approval.ownerScopeAuthorized,
      humanReleaseApproved: approval.humanReleaseApproved
    },
    quality,
    boundary
  };
}

export function certifyChapterSceneAuthority({
  registry,
  structuralReport,
  chapterId,
  repoRoot = defaultRepoRoot,
  currentGateRunner = runCurrentCreativeGate
}) {
  const audit = makeAudit();
  audit.assert(structuralReport?.ok === true, 'scene.certification.registry-structural', 'Structural chapter registry gate must pass before certification', {
    failureCodes: structuralReport?.failures?.map((failure) => failure.code) ?? []
  });
  const chapter = registry?.chapters?.find?.((entry) => entry?.id === chapterId) ?? null;
  audit.assert(Boolean(chapter), 'scene.certification.chapter', `Unknown chapter ${chapterId}`, {
    available: registry?.chapters?.map?.((entry) => entry.id) ?? []
  });
  const declaredIds = chapter?.avBoundary?.sceneContractRefs ?? [];
  audit.assert(declaredIds.length > 0, 'scene.certification.missing-contract', `${chapterId} has no scene contract and cannot be certified against the current cut`);
  const catalog = new Map((registry?.sceneContracts ?? []).map((link) => [link.id, link]));
  const contracts = [];
  const gateCache = new Map();
  const cachedCurrentGate = (root, runPath) => {
    if (!gateCache.has(runPath)) gateCache.set(runPath, currentGateRunner(root, runPath));
    return gateCache.get(runPath);
  };
  for (const id of declaredIds) {
    const link = catalog.get(id);
    audit.assert(Boolean(link), 'scene.certification.catalog', `Chapter ${chapterId} references missing scene catalog entry ${id}`);
    if (link) contracts.push(certifyContract({ audit, repoRoot, chapter, link, runCurrentGate: cachedCurrentGate }));
  }
  const certified = audit.failures.length === 0;
  return {
    schema: REPORT_SCHEMA,
    ok: certified,
    certified,
    chapterId,
    checkedAt: new Date().toISOString(),
    structural: {
      ok: structuralReport?.ok === true,
      checks: structuralReport?.checks ?? null,
      failureCodes: structuralReport?.failures?.map((failure) => failure.code) ?? []
    },
    sceneAuthority: {
      required: true,
      declaredContractIds: declaredIds,
      contracts
    },
    checks: audit.checks,
    failures: audit.failures
  };
}

export { EXISTING_ANCHOR_DOMAINS, REPORT_SCHEMA };
