import fs from 'node:fs';
import path from 'node:path';
import { requireThat, sha, FINAL, collectFindings } from './contract.mjs';
import { readJson, writeJson, checkRef, reference, snapshot, differences, assertFrozen, inside, acquireLock } from './store.mjs';

// The owner can spend the existing, unused final refinement on a completed
// composer's known defects. No planning replay, extra refinement or fake PASS.
export function continueComposition(repo, run, authorityFile, { policySeal, validateBrief }) {
  const unlock = acquireLock(path.join(run, '.runner.lock'));
  try {
    const file = path.join(run, 'state.json'), state = readJson(file), a = readJson(authorityFile);
    requireThat(!state.active && !state.activeRole && !state.refinementUsed && !state.compositionContinuation
      && state.policySha256 === policySeal(state), 'Continuation requires an intact inactive checkpoint and its unused refinement');
    requireThat(!fs.existsSync(path.join(run, 'STOP')), 'Owner stop remains authoritative');
    requireThat(state.status === 'NEEDS_REVISION' && state.queue[state.cursor - 1] === 'compose'
      && state.queue[state.cursor] === 'verify', 'Only a completed composer revision can take this path');
    requireThat(a.schema === 'paravoxia.compositionContinuation.v1' && a.runId === state.id
      && a.previousStateSha256 === sha(fs.readFileSync(file)) && typeof a.request === 'string' && a.request.trim()
      && a.useExistingRefinement === true, 'Exact owner continuation and existing allowance required');
    const result = readJson(checkRef(repo, state.receipts.compose));
    const transport = readJson(path.join(path.dirname(inside(repo, state.receipts.compose.path)), 'transport.json'));
    requireThat(result.verdict === 'REVISE' && result.findings.some(f => ['major', 'blocking'].includes(f.severity))
      && transport.completed && transport.reported && transport.session === result.session, 'Completed, accounted composer REVISE required');
    for (const ref of [...result.evidence, ...result.findings.flatMap(f => f.evidence)]) checkRef(repo, ref);
    const rows = a.files, listed = new Map(rows.map(r => [r.path, r]));
    requireThat(rows.length > 0 && listed.size === rows.length, 'Exact infrastructure handoff required');
    const current = snapshot(repo);
    for (const name of differences(state.acceptedSource, current)) requireThat(listed.has(name), `Unlisted source change: ${name}`);
    for (const row of rows) {
      requireThat(/^main\/tools\/chapter-loop(?:\/[^/]+\.mjs|\.mjs)$/.test(row.path)
        || ['CLAUDE.md', 'docs/chapter-loop.md'].includes(row.path), `Continuation cannot change game or commissions: ${row.path}`);
      requireThat(row.before === (state.frozen[row.path] ?? state.acceptedSource[row.path] ?? null)
        && row.after === sha(fs.readFileSync(inside(repo, row.path))), `Infrastructure hash differs: ${row.path}`);
    }
    assertFrozen(repo, Object.fromEntries(Object.entries(state.frozen).filter(([name]) => !listed.has(name))));
    const validation = readJson(checkRef(repo, a.validation));
    requireThat(validation.passed === true && validation.command === 'npm --prefix main run chapter:loop:test'
      && validation.filesSha256 === sha(rows), 'Passing adapter checks must bind the exact changes');
    checkRef(repo, validation.log); checkRef(repo, a.handoff);
    const implementation = readJson(checkRef(repo, a.implementationEvidence));
    requireThat(implementation.schema === 'paravoxia.chapterImplementationEvidence.v1' && implementation.acceptance === false
      && sha(implementation.composer) === sha(state.receipts.compose), 'Implementation observations must retain their unaccepted scope');
    for (const ref of [...implementation.artifacts, ...implementation.media]) checkRef(repo, ref);
    const archive = path.join(run, 'composition-continuation', sha(a)); fs.mkdirSync(archive, { recursive: true });
    fs.copyFileSync(file, path.join(archive, 'previous-state.json'), fs.constants.COPYFILE_EXCL);
    const findings = collectFindings([result]);
    const findingsFile = path.join(archive, 'findings.json'); writeJson(findingsFile, findings);
    state.receipts.findings = reference(repo, findingsFile);
    state.receipts.implementationEvidence = a.implementationEvidence;
    // Older checked infrastructure recoveries refreshed frozen hashes but left
    // the original brief's tool refs untouched. Reuse those already-validated
    // pins; never bless an unlisted or unpinned source change.
    state.brief.toolRefs = state.brief.toolRefs.map(ref => {
      const pin = listed.get(ref.path)?.after ?? state.frozen[ref.path];
      requireThat(pin, `Tool has no frozen provenance: ${ref.path}`);
      return { ...ref, sha256: pin };
    });
    if (a.controlAudioEvidence === true) for (const c of state.brief.verification.cases) {
      if (!['recovery', 'continue'].includes(c.kind)) continue;
      for (const media of [{ kind: 'audio', path: 'audio.wav' }, { kind: 'video', path: 'video.webm' }, { kind: 'frame', path: 'frame.png' }]) {
        if (!c.media.some(m => m.path === media.path && m.kind === media.kind)) c.media.push(media);
      }
      for (const key of ['audioDecodes', 'videoDecodes', 'audioIsolated', 'mediaCleanup']) {
        requireThat(!c.assertions[key] || sha(c.assertions[key]) === sha({ pointer: `/proof/${key}`, equals: true }), `Conflicting control media assertion: ${key}`);
        c.assertions[key] = { pointer: `/proof/${key}`, equals: true };
      }
    }
    validateBrief(repo, state.brief);
    if (a.advisoryTokenTargets === true) {
      requireThat(state.budgetPolicy?.mode === 'adaptive', 'Token guidance requires adaptive scheduling');
      state.budgetPolicy = { ...state.budgetPolicy, tokens: 'advisory' };
    }
    state.queue = state.queue.slice(0, state.cursor).concat(FINAL);
    state.refinementUsed = true;
    state.continuationHandoff = a.handoff;
    state.compositionContinuation = { authority: reference(repo, authorityFile), previousState: reference(repo, path.join(archive, 'previous-state.json')),
      composer: state.receipts.compose, previousFailure: state.failure ?? null, at: new Date().toISOString() };
    for (const row of rows) state.frozen[row.path] = row.after;
    for (const ref of [state.compositionContinuation.authority, state.compositionContinuation.previousState, a.handoff, a.validation, a.implementationEvidence]) state.frozen[ref.path] = ref.sha256;
    state.acceptedSource = current; state.status = 'RUNNING'; state.failure = null; state.policySha256 = policySeal(state);
    writeJson(file, state);
    fs.appendFileSync(path.join(run, 'events.jsonl'), JSON.stringify({ at: new Date().toISOString(), type: 'owner-composition-continuation',
      ...state.compositionContinuation, retainedUsage: state.usage, queue: state.queue.slice(state.cursor), budgetPolicy: state.budgetPolicy }) + '\n');
    return { status: state.status, next: state.queue[state.cursor], retainedUsage: state.usage, refinementUsed: true, budgetPolicy: state.budgetPolicy };
  } finally { unlock(); }
}
