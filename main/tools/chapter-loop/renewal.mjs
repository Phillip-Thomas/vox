import fs from 'node:fs';
import path from 'node:path';
import { ROLES, limitsFor, requireThat, sha } from './contract.mjs';
import { readJson, writeJson, reference, checkRef, snapshot, differences, frozenInputs, inside, acquireLock } from './store.mjs';
import { MAX_CHAPTER_MS } from './budget.mjs';
import { continuation } from './continuation.mjs';

// A new explicit commission resumes only an expired, imported verification
// checkpoint. It never replays a model role or erases its previous allowance.
export function prepareRenewal(repo, state, authorization, brief, { now = Date.now(), validateBrief, policySeal } = {}) {
  const a = authorization;
  requireThat(a?.schema === 'paravoxia.chapterLoopRenewalAuthority.v1'
    && a.runId === state.id && a.chapter === state.chapter && a.request === 'do it all'
    && a.explicitNewCommission === true && a.resumeVerification === true
    && a.extraInfrastructureRetries === 1, 'Explicit owner verification renewal required');
  requireThat(!state.active && state.cursor === 0 && state.queue[0] === 'verify'
    && state.brief.continuation && ['BLOCKED_INFRASTRUCTURE', 'BUDGET_EXHAUSTED'].includes(state.status)
    && Object.keys(state.receipts).every(k => k === 'recipe') && !state.renewals?.length,
  'Renewal is restricted to an unreplayed imported verification checkpoint');
  requireThat(policySeal(state) === state.policySha256 && a.previousPolicySha256 === state.policySha256
    && a.previousStateSha256 === sha(state), 'Renewal requires the exact retained checkpoint');
  const started = Date.parse(a.requestedAt), deadline = Date.parse(a.deadlineAt);
  requireThat(Number.isFinite(started) && started <= now && started > Date.parse(state.createdAt)
    && deadline === started + MAX_CHAPTER_MS && deadline > now, 'Renewal must retain the actual request clock and eight-hour deadline');
  requireThat(Date.parse(state.clock?.startedAt ?? state.createdAt) + MAX_CHAPTER_MS <= started,
    'The original elapsed allowance has not expired');
  requireThat(brief.chapter === state.chapter && a.briefSha256 === sha(brief), 'Renewal brief binding differs');
  validateBrief(repo, brief);
  requireThat(brief.verification.preflight && brief.provider.permissionMode === 'full', 'Renewal requires capability preflight and owner-authorized full permissions');
  requireThat(sha(brief.continuation) === sha(state.brief.continuation)
    && sha(brief.canon) === sha(state.brief.canon) && sha(brief.references) === sha(state.brief.references)
    && sha(brief.allowedPaths) === sha(state.brief.allowedPaths), 'Verification renewal cannot change approved creative direction or ownership');
  continuation(repo, brief);
  checkRef(repo, state.receipts.recipe);
  requireThat(a.recipeSha256 === state.receipts.recipe.sha256, 'Renewal cannot replace the signed recipe');
  const current = snapshot(repo);
  const changes = [...new Set([...differences(state.acceptedSource, current),
    ...Object.keys(state.frozen).filter(n => sha(fs.readFileSync(inside(repo, n))) !== state.frozen[n])])];
  requireThat(Array.isArray(a.files) && new Set(a.files.map(f => f.path)).size === a.files.length,
    'Renewal requires an exact source handoff');
  const listed = new Map(a.files.map(f => [f.path, f]));
  for (const name of changes) requireThat(listed.has(name), `Unlisted renewal source handoff: ${name}`);
  for (const [name, f] of listed) {
    requireThat(f.before === (state.frozen[name] ?? state.acceptedSource[name] ?? null)
      && f.after === sha(fs.readFileSync(inside(repo, name))), `Renewal source hash mismatch: ${name}`);
    requireThat(!name.startsWith('.claude/'), 'Renewal cannot rewrite creative commissions');
  }
  const validation = readJson(checkRef(repo, a.validation));
  requireThat(validation.passed === true && Array.isArray(validation.checks) && validation.checks.length > 0
    && validation.handoffSha256 === sha(a.files),
    'Renewal needs retained passing repair validation');
  const limits = limitsFor();
  // All old counters remain cumulative; the renewal does not replenish tokens.
  for (const k of Object.keys(limits)) if (Number.isFinite(state.limits[k])) limits[k] = Math.min(limits[k], state.limits[k]);
  const files = [...new Set([...Object.keys(state.frozen), ...Object.values(ROLES).map(r => `.claude/agents/chapter-loop/${r.commission}.md`),
    ...fs.readdirSync(path.join(repo, 'main/tools/chapter-loop')).filter(n => n.endsWith('.mjs') && !n.includes('.test.')).map(n => `main/tools/chapter-loop/${n}`),
    'main/tools/chapter-loop.mjs', ...brief.toolRefs.map(r => r.path)])];
  return { ...state, workload: 'throughput-v2', status: 'RUNNING', brief, limits,
    clock: { schema: 'paravoxia.chapterClock.v1', chapter: state.chapter, startedAt: a.requestedAt,
      deadlineAt: a.deadlineAt, maxElapsedMs: MAX_CHAPTER_MS, existingRun: state.id },
    queue: ['preflight', ...state.queue], cursor: 0, acceptedSource: current, frozen: frozenInputs(repo, files),
    preview: null };
}

export function renewVerification(repo, run, authorityFile, briefFile, helpers) {
  const unlock = acquireLock(path.join(run, '.runner.lock'));
  try {
    const file = path.join(run, 'state.json'), bytes = fs.readFileSync(file), previous = JSON.parse(bytes);
    const authorityRef = reference(repo, authorityFile), briefRef = reference(repo, briefFile);
    const next = prepareRenewal(repo, previous, readJson(authorityFile), readJson(briefFile), helpers);
    const dir = path.join(run, 'renewals', authorityRef.sha256);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'previous-state.json'), bytes, { flag: 'wx', mode: 0o400 });
    const renewal = { authority: authorityRef, brief: briefRef, previousState: reference(repo, path.join(dir, 'previous-state.json')),
      originalCreatedAt: previous.createdAt, originalPolicySha256: previous.policySha256,
      at: new Date().toISOString(), retainedSpend: { activeMs: previous.activeMs, usage: previous.usage, retries: previous.retries } };
    next.renewals = [renewal];
    next.ownerRecoveries = [...(previous.ownerRecoveries ?? []), { authority: authorityRef, failureSha256: sha(previous.failure), at: renewal.at }];
    next.frozen[authorityRef.path] = authorityRef.sha256;
    next.frozen[briefRef.path] = briefRef.sha256;
    next.frozen[renewal.previousState.path] = renewal.previousState.sha256;
    next.policySha256 = helpers.policySeal(next);
    writeJson(path.join(repo, '.codex/chapter-loops/clocks', `${next.chapter}.json`), next.clock);
    writeJson(file, next);
    fs.appendFileSync(path.join(run, 'events.jsonl'), JSON.stringify({ type: 'owner-renewed-verification', ...renewal }) + '\n');
    return { status: next.status, run, renewal, clock: next.clock };
  } finally { unlock(); }
}
