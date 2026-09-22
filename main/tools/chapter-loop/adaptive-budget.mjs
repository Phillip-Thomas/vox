import fs from 'node:fs';
import path from 'node:path';
import { requireThat, sha, SCHEDULING_TARGETS } from './contract.mjs';
import { readJson, writeJson, inside, checkRef, reference, snapshot, differences, acquireLock, assertFrozen } from './store.mjs';

// A policy correction, not a new chapter or a fabricated result from the killed
// provider. Preserve the old failure, source, clock, usage and observation bytes.
export function adoptAdaptiveBudget(repo, run, authorityFile, { policySeal, validateBrief }) {
  const unlock = acquireLock(path.join(run, '.runner.lock'));
  try {
    const file = path.join(run, 'state.json'), state = readJson(file), a = readJson(authorityFile);
    requireThat(!state.active && !state.budgetAdoption && state.policySha256 === policySeal(state), 'Adaptive adoption needs an inactive intact checkpoint and is single-use');
    requireThat(!fs.existsSync(path.join(run, 'STOP')), 'Owner stop remains authoritative');
    requireThat(a.schema === 'paravoxia.chapterBudgetPolicyChange.v1' && a.runId === state.id
      && a.policy === 'adaptive' && typeof a.request === 'string' && a.request.length >= 40
      && a.previousStateSha256 === sha(fs.readFileSync(file)), 'Policy change needs the actual owner instruction and exact previous state');
    const reason = state.failure?.message?.replace(/^budget:/, '');
    requireThat(state.status === 'BUDGET_EXHAUSTED' && state.failure?.message?.startsWith('budget:')
      && SCHEDULING_TARGETS.has(reason), 'Only an advisory scheduling stop can be reopened by this transition');
    const obsFile = path.join(run, 'observations.json'), obs = readJson(obsFile);
    requireThat(!obs.active, 'Observation is still active');
    const rows = a.files;
    requireThat(Array.isArray(rows) && rows.length && new Set(rows.map(r => r.path)).size === rows.length, 'Exact changed infrastructure files required');
    const listed = new Map(rows.map(r => [r.path, r]));
    const current = snapshot(repo);
    for (const name of differences(state.acceptedSource, current)) requireThat(listed.has(name), `Unlisted source change: ${name}`);
    for (const row of rows) {
      requireThat(/^main\/tools\/chapter-loop(?:\/[^/]+\.mjs|\.mjs)$/.test(row.path)
        || ['CLAUDE.md', 'docs/chapter-loop.md'].includes(row.path), `Policy change cannot alter game, commissions or unrelated files: ${row.path}`);
      requireThat(sha(fs.readFileSync(inside(repo, row.path))) === row.after, `Changed infrastructure bytes: ${row.path}`);
      const pinnedBefore = state.frozen[row.path] ?? state.acceptedSource[row.path];
      if (pinnedBefore) requireThat(row.before === pinnedBefore, `Wrong pre-change source: ${row.path}`);
    }
    assertFrozen(repo, Object.fromEntries(Object.entries(state.frozen).filter(([name]) => !listed.has(name))));
    const tests = readJson(checkRef(repo, a.validation));
    requireThat(tests.status === 'passed' && tests.command === 'npm --prefix main run chapter:loop:test'
      && tests.filesSha256 === sha(rows), 'Policy change requires passing checks bound to these exact bytes');
    checkRef(repo, tests.log);
    checkRef(repo, a.handoff);
    const additions = a.additionalOwnedPaths ?? [];
    requireThat(additions.every(n => n === 'docs/architecture/workflow-orchestration/schemas/paravoxia-story-authority.schema.json'), 'Only the declared authority-schema integration may be added');
    state.brief.allowedPaths = [...new Set([...state.brief.allowedPaths, ...additions])];
    state.brief.toolRefs = state.brief.toolRefs.map(ref => listed.has(ref.path) ? { ...ref, sha256: listed.get(ref.path).after } : ref);
    validateBrief(repo, state.brief);
    const authority = reference(repo, authorityFile), archive = path.join(run, 'budget-policy-changes', authority.sha256);
    fs.mkdirSync(archive, { recursive: true });
    fs.copyFileSync(file, path.join(archive, 'previous-state.json'));
    fs.copyFileSync(obsFile, path.join(archive, 'previous-observations.json'));
    const roleDir = path.join(run, 'roles', `${state.usage.roleLaunches}-${state.queue[state.cursor]}`);
    const transportFile = path.join(roleDir, 'transport.json');
    state.accountingGaps ??= [];
    if (fs.existsSync(transportFile)) {
      const transport = readJson(transportFile);
      if (!transport.reported) state.accountingGaps.push({ role: path.basename(roleDir), transport: reference(repo, transportFile),
        session: transport.session, retainedWorkItems: transport.usage?.modelTurns ?? null, tokens: null,
        explanation: 'Previous scheduling hard stop prevented terminal usage reporting. Reported totals exclude this unknown spend; this role is not replayed as a free call.' });
    }
    state.budgetPolicy = { mode: 'adaptive' };
    state.continuationHandoff = a.handoff;
    state.budgetAdoption = { authority, previousState: reference(repo, path.join(archive, 'previous-state.json')),
      previousObservations: reference(repo, path.join(archive, 'previous-observations.json')), previousFailure: state.failure, at: new Date().toISOString() };
    for (const row of rows) state.frozen[row.path] = row.after;
    for (const ref of [authority, a.validation, a.handoff, state.budgetAdoption.previousState, state.budgetAdoption.previousObservations]) state.frozen[ref.path] = ref.sha256;
    state.acceptedSource = current; state.status = 'RUNNING'; state.policySha256 = policySeal(state);
    writeJson(file, state);
    fs.appendFileSync(path.join(run, 'events.jsonl'), JSON.stringify({ at: new Date().toISOString(), type: 'owner-budget-policy-changed',
      authority, previousFailure: state.failure, mode: 'adaptive', retainedUsage: state.usage, accountingGaps: state.accountingGaps }) + '\n');
    return { status: state.status, chapter: state.chapter, stage: state.queue[state.cursor], budgetPolicy: state.budgetPolicy, accountingGaps: state.accountingGaps };
  } finally { unlock(); }
}
