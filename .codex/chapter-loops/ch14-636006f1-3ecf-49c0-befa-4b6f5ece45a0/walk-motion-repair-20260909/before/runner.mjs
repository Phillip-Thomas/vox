import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { VERSION, ROLES, INITIAL, TERMINAL, limitsFor, emptyUsage, nextStage, roleFor, beginRole, advance, validateResult, decision, budgetReason, addUsage, requireThat, sha, adaptiveBudget } from './contract.mjs';
import { readJson, writeJson, inside, reference, checkRef, snapshot, sourceSeal, differences, allowedPath, acquireLock, frozenInputs, assertFrozen, excerpt, pidAlive } from './store.mjs';
import { providerCommand, usageTracker } from './providers.mjs';
import { runProcess } from './process.mjs';
import { validateVerification, validateCommand, command, inspectReport, startPreview, archiveBundle, verifyBundle } from './evidence.mjs';
import { continuation } from './continuation.mjs';
import { beginChapter, elapsedClock, firstPlayableDeadline, budgetGuidance, commandDeadline } from './budget.mjs';
import { gameSnapshot, gameSourceSeal, findCachedCase, cacheCase, findCachedCommand, cacheCommand, proofArtifacts } from './cache.mjs';
import { previewBuildManifest } from '../lib/previewSnapshot.mjs';
import { currentProvenance } from './capture-case.mjs';
import { decodeRoleResult } from './role-result.mjs';
import { releasePolicySnapshot } from './finish-renewal.mjs';
import { perceptionScope } from './perceive-media.mjs';

const HOME = '.codex/chapter-loops';
const now = () => new Date().toISOString();
const statePath = run => path.join(run, 'state.json');
const save = (run, state) => writeJson(statePath(run), state);
const event = (run, type, data = {}) => fs.appendFileSync(path.join(run, 'events.jsonl'), JSON.stringify({ at: now(), type, ...data }) + '\n');
export const policySeal = state => sha({ brief: state.brief, limits: state.limits, frozen: state.frozen,
  ...(state.budgetPolicy ? { budgetPolicy: state.budgetPolicy } : {}),
  ...(state.compositionContinuation ? { compositionContinuation: state.compositionContinuation } : {}),
  ...(state.verificationContinuation ? { verificationContinuation: state.verificationContinuation } : {}),
  ...(state.budgetAdoption ? { budgetAdoption: state.budgetAdoption, continuationHandoff: state.continuationHandoff, accountingGaps: state.accountingGaps } : {}),
  ...(state.clock ? { clock: state.clock } : {}),
  ...(state.initialGameSource ? { initialGameSource: state.initialGameSource } : {}),
  ...(state.renewals ? { renewals: state.renewals } : {}),
  ...(state.finishRenewals ? { finishRenewals: state.finishRenewals, repairHandoff: state.repairHandoff } : {}),
  ...(state.protectedReleasePolicy ? { protectedReleasePolicy: state.protectedReleasePolicy } : {}),
  ...(state.providerHandoffs ? { providerHandoffs: state.providerHandoffs } : {}),
  ...(state.ownerRecoveries ? { ownerRecoveries: state.ownerRecoveries } : {}) });
const pinned = policySeal;
const recoveryAllowance = state => state.limits.infrastructureRetries + (state.ownerRecoveries?.length ?? 0);

export function validateBrief(repo, brief) {
  requireThat(brief?.schema === 'paravoxia.chapterBrief.v1' && /^ch[0-9]+[a-z0-9-]*$/.test(brief.chapter), 'Chapter brief schema/id required');
  requireThat(typeof brief.request === 'string' && brief.request.length >= 40 && typeof brief.authority === 'string' && brief.authority.length >= 20, 'Bounded request and existing owner authority required');
  requireThat(['claude', 'codex'].includes(brief.provider?.provider) && ['creative', 'mechanical'].every(k => typeof brief.provider.models?.[k] === 'string' && brief.provider.models[k]), 'Explicit provider/model bindings required');
  requireThat(!brief.budgetPolicy || ['adaptive', 'strict'].includes(brief.budgetPolicy.mode), 'Budget mode must be adaptive or explicitly strict');
  requireThat(!brief.budgetPolicy?.tokens || ['advisory', 'strict'].includes(brief.budgetPolicy.tokens), 'Token policy must be advisory or strict');
  requireThat(Array.isArray(brief.canon) && brief.canon.length > 0, 'Compact canon refs required');
  for (const ref of brief.canon) excerpt(repo, ref);
  requireThat(Buffer.byteLength(JSON.stringify(brief.canon.map(r => excerpt(repo, r)))) <= 20_000, 'Canon packet exceeds 20 KB; use chapter-relevant excerpts');
  requireThat(Array.isArray(brief.references) && brief.references.length >= 2, 'Previous chapter and an approved presentation reference required');
  for (const ref of brief.references) checkRef(repo, ref);
  requireThat(Array.isArray(brief.allowedPaths) && brief.allowedPaths.length > 0, 'Explicit implementation ownership required');
  for (const name of brief.allowedPaths) {
    inside(repo, name, { exists: false });
    requireThat(/^(main\/(src|public)\/|main\/chapter-[^/]+\.json$|main\/story-authority\.json$)/.test(name)
      || name === 'docs/architecture/workflow-orchestration/schemas/paravoxia-story-authority.schema.json', 'Creation may own game content and chapter manifests only');
  }
  requireThat(Array.isArray(brief.toolRefs) && brief.toolRefs.length > 0, 'Existing probe/tool references required');
  for (const ref of brief.toolRefs) checkRef(repo, ref);
  validateVerification(brief.verification);
  for (const check of brief.verification.checks ?? []) {
    requireThat(/^[a-z0-9-]+$/.test(check.id ?? ''), 'Static checks need a simple unique id');
    validateCommand(check);
  }
  requireThat(new Set((brief.verification.checks ?? []).map(c => c.id)).size === (brief.verification.checks ?? []).length, 'Static check ids must be unique');
  validateCommand(brief.verification.recovery);
  for (const kind of ['look', 'listen']) {
    const c = brief.verification.observe[kind];
    requireThat(c.report && c.schema && c.assertions?.hardware && c.assertions?.cleanup && Array.isArray(c.media), `${kind} evidence binding required`);
  }
  for (const name of ['ordinaryControls', 'acceptedAction', 'completePath']) requireThat(brief.verification.observe.look.assertions[name], `First playable requires ${name}`);
  requireThat(typeof brief.heavyLock === 'string' && path.isAbsolute(brief.heavyLock), 'Shared machine heavy lock path required');
  requireThat(brief.previewQuery && typeof brief.previewQuery.query === 'string' && ['normal-save', 'diagnostic'].includes(brief.previewQuery.kind), 'Preview entry must be labelled normal-save or diagnostic');
}

export function initialize(repo, briefFile, overrides = {}) {
  const brief = readJson(briefFile); validateBrief(repo, brief);
  requireThat(brief.verification.preflight, 'Bind a real capability preflight before chapter creation');
  validateCommand(brief.verification.preflight);
  const clock = beginChapter(repo, brief.chapter, { startedAt: brief.requestedAt });
  const resumed = continuation(repo, brief);
  const limits = limitsFor(overrides);
  const root = path.join(repo, HOME); fs.mkdirSync(root, { recursive: true });
  const unlock = acquireLock(path.join(root, '.index.lock'));
  try {
    const indexFile = path.join(root, 'chapters.json'); const index = fs.existsSync(indexFile) ? readJson(indexFile) : {};
    requireThat(!index[brief.chapter], `Chapter already has a checkpoint: ${index[brief.chapter]}. Resume/status it; a new directory cannot reset its allowance.`);
    // Preserve the owner's explicit stop across workflow migration.
    const ownerStop = path.join(repo, '.codex/production-runs/2026-09-05-after-the-hearth/owner-stop-audit-checkpoint.json');
    requireThat(resumed || !/^ch13(?:-|$)/.test(brief.chapter) || !fs.existsSync(ownerStop), 'Chapter 13 remains stopped by the owner; workflow installation does not reopen it');
    const id = `${brief.chapter}-${randomUUID()}`; const run = path.join(root, id); fs.mkdirSync(run);
    const files = [...new Set([
      ...Object.values(ROLES).map(r => `.claude/agents/chapter-loop/${r.commission}.md`),
      ...fs.readdirSync(path.join(repo, 'main/tools/chapter-loop')).filter(n => n.endsWith('.mjs') && !n.includes('.test.')).map(n => `main/tools/chapter-loop/${n}`),
      'main/tools/chapter-loop.mjs', '.claude/agents/chapter-loop/result.md', ...brief.canon.map(r => r.path), ...brief.references.map(r => r.path), ...brief.toolRefs.map(r => r.path),
      ...(resumed?.refs.map(r => r.path) ?? []),
    ])];
    const state = { schema: VERSION, workload: 'throughput-v2', id, chapter: brief.chapter, createdAt: now(), clock,
      budgetPolicy: brief.budgetPolicy ?? { mode: 'adaptive', tokens: 'advisory' },
      status: 'RUNNING', queue: ['preflight', ...(resumed ? INITIAL.slice(INITIAL.indexOf('verify')) : INITIAL)], cursor: 0,
      brief, limits, frozen: frozenInputs(repo, files), activeMs: 0, usage: emptyUsage(), retries: 0, refinementUsed: false,
      activeRole: null, active: null, receipts: {}, sessions: [], initialGameSource: gameSnapshot(repo), acceptedSource: snapshot(repo), preview: null };
    if (brief.allowedPaths.includes('main/story-authority.json')) state.protectedReleasePolicy = releasePolicySnapshot(readJson(inside(repo, 'main/story-authority.json')));
    if (resumed) {
      const recipeFile = path.join(run, 'recipe.json'); writeJson(recipeFile, resumed.recipe);
      state.receipts.recipe = reference(repo, recipeFile); state.priorSpend = resumed.prior;
    }
    state.policySha256 = pinned(state); save(run, state); index[brief.chapter] = path.relative(repo, run); writeJson(indexFile, index);
    writeJson(path.join(run, 'observations.json'), { look: 0, listen: 0, firstPlayable: null, receipts: [] });
    event(run, 'initialized', { policySha256: state.policySha256 }); return run;
  } finally { unlock(); }
}
function assertState(repo, state) {
  requireThat(state.schema === VERSION && pinned(state) === state.policySha256, 'Run policy/budget changed');
  if (state.protectedReleasePolicy) requireThat(sha(releasePolicySnapshot(readJson(inside(repo, 'main/story-authority.json')))) === sha(state.protectedReleasePolicy),
    'Chapter implementation cannot change public release, demo or publishing policy');
  assertFrozen(repo, state.frozen);
  requireThat(sha(snapshot(repo)) === sha(state.acceptedSource), 'Source changed outside the recorded role; preserve edits and stop for a source handoff');
}
function resultAt(repo, state, stage) { return readJson(checkRef(repo, state.receipts[stage])); }
async function chapterPreview(repo, state, dist, log) {
  const ref = state.brief.continuation?.sourceManifest;
  if (!ref) return startPreview(dist, log);
  const manifestFile = checkRef(repo, ref);
  const file = path.join(path.dirname(manifestFile), 'verifier/artifacts/preview-ownership.json');
  if (!fs.existsSync(file)) return startPreview(dist, log);
  const owner = readJson(file);
  requireThat(owner.state === 'running' && owner.sourceManifestSha256 === ref.sha256 && pidAlive(owner.daemonPid), 'Existing continuation preview ownership is stale');
  return startPreview(dist, log, owner);
}
function observations(run) { return readJson(path.join(run, 'observations.json')); }
function remaining(state) { return adaptiveBudget(state) ? 2 * 60 * 60 * 1000 : Math.max(1, Math.min(state.limits.activeMs - state.activeMs, elapsedClock(state).remainingMs)); }
function stopReason(run, state, started = Date.now()) {
  if (fs.existsSync(path.join(run, 'STOP'))) return 'owner-stop';
  const elapsed = Date.now() - started;
  const wall = elapsedClock(state);
  if (!adaptiveBudget(state) && wall.remainingMs <= 0) return 'budget:endToEndMs';
  const reason = budgetReason(state, elapsed);
  if (reason) return `budget:${reason}`;
  if (!adaptiveBudget(state) && !observations(run).firstPlayable && (Date.now() >= firstPlayableDeadline(state) || state.activeMs + elapsed >= state.limits.firstPlayableMs)) return 'budget:firstPlayableMs';
  return false;
}
function disposition(reason, fallback = 'BLOCKED_INFRASTRUCTURE') {
  return reason === 'owner-stop' ? 'STOPPED' : (typeof reason === 'string' && reason.startsWith('budget:')) || reason === 'deadline' ? 'BUDGET_EXHAUSTED' : fallback;
}
function packet(repo, run, state, stage) {
  const role = roleFor(stage), base = stage.replace(/-final$/, ''); const p = {};
  const canon = state.brief.canon.map(r => excerpt(repo, r));
  const recipe = state.receipts.recipe ? resultAt(repo, state, 'recipe') : null;
  const bundle = state.receipts.evidence ? resultAt(repo, state, 'evidence')
    : base === 'refine' && state.receipts.implementationEvidence ? resultAt(repo, state, 'implementationEvidence') : null;
  for (const input of role.inputs) {
    if (input === 'brief') p.brief = { chapter: state.chapter, request: state.brief.request, authority: state.brief.authority, allowedPaths: state.brief.allowedPaths, references: state.brief.references };
    else if (input === 'canon') p.canon = canon;
    else if (input === 'recipe') p.recipe = recipe;
    else if (input === 'evidence') p.evidence = { ...bundle, artifacts: [state.receipts.evidence ?? state.receipts.implementationEvidence],
      note: bundle?.acceptance === false ? 'Retained implementation observations only; final verification and independent acceptance remain pending.'
        : 'Read this source-bound bundle for full raw reports; the packet contains the compact case results and media index.' };
    else if (input === 'playerEvidence') p.playerEvidence = { candidateSha256: bundle.candidateSha256, preview: state.preview, controls: 'Use the visible instructions and ordinary player controls. No debug progress setters.' };
    else if (input === 'avEvidence') p.avEvidence = { candidateSha256: bundle.candidateSha256, media: bundle.media, references: state.brief.references };
    else {
      const result = resultAt(repo, state, input);
      // Completed roles hand over decisions and artifact references, not their
      // growing conversation, transport logs or duplicated raw evidence.
      p[input] = Object.fromEntries(['summary', 'verdict', 'direction', 'anchors', 'anchorEvents', 'evidence', 'findings', 'keep']
        .filter(k => result[k] !== undefined).map(k => [k, result[k]]));
    }
  }
  if (base === 'council') {
    // Wire-format repair provenance lives in the source receipt; it is not a
    // creative decision and need not be repeated in every downstream packet.
    const lanes = Object.fromEntries(['plan', 'cinema', 'score-plan'].map(s =>
      [s, Object.fromEntries(Object.entries(resultAt(repo, state, s)).filter(([key]) => key !== 'normalization'))]));
    const anchors = lanes.plan.anchors;
    for (const lane of ['cinema', 'score-plan']) requireThat(sha(lanes[lane].anchors) === sha(anchors), 'Creative peers must share the same named event anchors');
    p.recipe = { schema: 'paravoxia.chapterRecipe.v1', chapter: state.chapter, anchors, lanes };
    p.recipeSha256 = sha(p.recipe);
    // The exact recipe already contains every lane. Do not send second copies
    // of those same decisions alongside it and exhaust the fixed packet cap.
    delete p.plan; delete p.cinema; delete p['score-plan'];
  }
  return p;
}
function dispatchInput(repo,run,state,stage,dir) {
  const role = roleFor(stage); const p = packet(repo, run, state, stage);
  if (stage === 'compose' || stage === 'refine' || stage.replace(/-final$/, '') === 'av') {
    const scopeFile = path.join(dir, 'media-scope.json');
    writeJson(scopeFile, perceptionScope(repo, run, stage, dir, p.avEvidence?.media ?? p.evidence?.media));
    p.mediaPerception = { command: ['node', path.join(repo, 'main/tools/chapter-loop/perceive-media.mjs'), '--scope', scopeFile],
      arguments: '--file <supplied audio/video path> --question <bounded question> --start <seconds> --seconds <up to 60>',
      available: Boolean(process.env.GEMINI_API_KEY),
      note: 'Native audio/video perception through Gemini, supplied media only. Use it to listen and inspect motion; make your own existing role judgment. Cite source media. Tool receipts record model, exact bytes, segment and usage. Prior reviews and hidden planning are never tool inputs.' };
  }
  if (state.repairHandoff && ['build', 'compose'].includes(stage)) p.repair = readJson(checkRef(repo, state.repairHandoff));
  if (state.continuationHandoff && ['build', 'compose', 'refine'].includes(stage)) p.continueFrom = readJson(checkRef(repo, state.continuationHandoff));
  const commission = fs.readFileSync(path.join(repo, `.claude/agents/chapter-loop/${role.commission}.md`), 'utf8');
  const system = `${commission}\n\n${fs.readFileSync(path.join(repo, '.claude/agents/chapter-loop/result.md'), 'utf8')}\nDo not dispatch agents, publish, alter the runner, or expand scope. Output only the final JSON result. Routine authorized reversible work does not require another permission request. Read only this packet and permitted files.\n${adaptiveBudget(state) ? 'Owner policy: time, work-item and observation counts are advisory targets, superseding older hard-stop wording. Read executionBudget.progressFile every few tool calls. At 80% of a target, save progress.md in your output directory; stop optional exploration/polish, then finish existing work and mandatory validation. Exceeding a target is not a reason to abandon the chapter or return BLOCKED. Real failures must be diagnosed honestly. Never weaken evidence or acceptance checks.\n' : ''}`;
  const prompt = JSON.stringify({ ...p, stage, outputDirectory: dir, repo: role.blind ? undefined : repo,
    executionBudget: { firstPlayableDeadlineAt: new Date(firstPlayableDeadline(state)).toISOString(),
      operationDeadlineAt: elapsedClock(state).deadlineAt,
      mode: adaptiveBudget(state) ? 'adaptive' : 'strict', progressFile: path.join(dir, 'budget.json'),
      tokenPolicy: state.budgetPolicy?.tokens ?? 'strict',
      targets: { roleWorkItems: state.limits.roleTurns, roleMinutes: state.limits.roleMs / 60000, totalWorkItems: state.limits.modelTurns, roleLaunches: state.limits.roleLaunches },
      remainingTokens: Object.fromEntries(['inputTokens', 'cacheReadTokens', 'outputTokens'].map(k => [k, Math.max(0, state.limits[k] - state.usage[k])])),
      note: adaptiveBudget(state) ? 'Scheduling targets trigger checkpointing and focus on completion, never process termination. Historical spend and overruns remain visible.' : 'Current checked deadlines supersede older scheduling text retained in the brief. Historical usage is retained.' },
    observe: role.observe ? { command: ['node', path.join(repo, 'main/tools/chapter-loop.mjs'), 'observe', '--run', run, '--kind', role.observe], limit: state.limits[`${role.observe}Cycles`] } : undefined });
  return {role,p,system,prompt};
}
export async function dispatch(repo, run, state, stage, hooks = {}) {
  const persist = () => hooks.parallel ? hooks.parallel.onState(state) : save(run, state);
  const dir = path.join(run, 'roles', `${state.usage.roleLaunches + 1}-${stage}`); fs.mkdirSync(dir, { recursive: true });
  const ticket = randomUUID(); const before = snapshot(repo);
  const {role,p,system,prompt}=dispatchInput(repo,run,state,stage,dir);
  requireThat(Buffer.byteLength(system + prompt) <= state.limits.promptBytes, 'Role packet exceeds context budget');
  writeJson(path.join(dir, 'packet.json'), JSON.parse(prompt));
  let reviewScope;
  if (['player', 'av', 'canon'].includes(stage.replace(/-final$/, ''))) {
    const bundle = resultAt(repo, state, 'evidence');
    const scopeFile = path.join(run, 'review-scopes', `${stage}-${ticket}.json`);
    writeJson(scopeFile, { schema: 'paravoxia.chapterLoopReviewScope.v1', stage,
      candidateSha256: bundle.candidateSha256, sourceSha256: bundle.source, buildSha256: bundle.build,
      evidence: state.receipts.evidence, recipe: state.receipts.recipe, canon: state.brief.canon, media: bundle.media });
    reviewScope = reference(repo, scopeFile);
  }
  beginRole(state, stage); const started = Date.now(); state.active = { stage, ticket, startedAt: now(), pid: null }; persist();
  event(run, 'dispatch', { stage, launch: state.usage.roleLaunches });
  const tracker = usageTracker(state.brief.provider.provider); let charged = emptyUsage();
  let warning = '';
  const updateGuidance = () => {
    const guidance = budgetGuidance(state, { roleItems: tracker.result().usage.modelTurns, roleElapsedMs: Date.now() - started, firstPlayable: Boolean(observations(run).firstPlayable) });
    writeJson(path.join(dir, 'budget.json'), guidance);
    const signature = guidance.nearing.map(k => `${k}:${guidance.targets[k].exceeded ? 'over' : 'near'}`).join(',');
    if (adaptiveBudget(state) && signature && signature !== warning) event(run, 'budget-guidance', { stage, action: guidance.action, targets: signature });
    warning = signature;
  };
  const meter = () => {
    const measured = tracker.result().usage;
    const perceptionDir = path.join(dir, 'perception');
    if (fs.existsSync(perceptionDir)) for (const file of fs.readdirSync(perceptionDir).filter(f => f.endsWith('.json'))) {
      const receipt = readJson(path.join(perceptionDir, file)), u = receipt.usage;
      if (receipt.schema !== 'paravoxia.mediaPerception.v1' || !u) continue;
      measured.inputTokens += Math.max(0, (u.promptTokenCount ?? 0) - (u.cachedContentTokenCount ?? 0));
      measured.cacheReadTokens += u.cachedContentTokenCount ?? 0;
      measured.outputTokens += (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0);
      measured.modelTurns++;
    }
    const delta = Object.fromEntries(Object.keys(measured).map(k => [k, Math.max(0, measured[k] - charged[k])]));
    addUsage(state, delta); hooks.parallel?.charge(delta);
    for (const k in charged) charged[k] = Math.max(charged[k], measured[k]); persist(); updateGuidance();
  };
  updateGuidance();
  const spec = providerCommand(state.brief.provider, { prompt, system, output: path.join(dir, 'last-message.txt'), role, remainingTurns: state.limits.roleTurns });
  const processRunner = hooks.runProcess ?? runProcess;
  const lockPlayer = stage.startsWith('player');
  const child = await processRunner(lockPlayer ? 'flock' : spec.command, lockPlayer ? ['-E', '75', '-w', '30', state.brief.heavyLock, spec.command, ...spec.args] : spec.args, { cwd: role.blind ? dir : repo, input: spec.input,
    env: { CHAPTER_LOOP_TICKET: ticket, CHAPTER_LOOP_RUN: run }, log: path.join(dir, 'transcript.jsonl'),
    timeoutMs: adaptiveBudget(state) ? undefined : Math.min(remaining(state), state.limits.roleMs), maxBytes: state.limits.transcriptBytes,
    onStart: pid => { state.active.pid = pid; persist(); },
    shouldStop: () => hooks.parallel?.stop() || stopReason(run, state, started),
    onLine: line => { tracker.ingest(line); meter(); const t = tracker.result();
      if (!adaptiveBudget(state) && t.usage.modelTurns >= state.limits.roleTurns) return 'budget:roleTurns';
      if (t.contextTokens > state.limits.contextTokens) return 'budget:contextTokens';
      return hooks.parallel?.stop() || stopReason(run, state, started); },
  });
  meter(); state.activeMs += Date.now() - started; state.active = null; state.activeRole = null;
  const obs = observations(run);
  if (obs.active?.pid) {
    // The gateway command is a separate process group. Reap only its recorded
    // PID if its owning model exits before the gateway's normal cleanup.
    try { process.kill(-obs.active.pid, 'SIGTERM'); } catch { /* already exited */ }
    obs.interrupted = obs.active; obs.active = null; writeJson(path.join(run, 'observations.json'), obs);
  }
  const telemetry = tracker.result();
  const perceptionReceipts = fs.existsSync(path.join(dir, 'perception')) ? fs.readdirSync(path.join(dir, 'perception'))
    .filter(n => n.endsWith('.json')).map(n => reference(repo, path.join(dir, 'perception', n))) : [];
  writeJson(path.join(dir, 'transport.json'), { ...child, ...telemetry, final: undefined, requestedModel: spec.model, reviewScope, perceptionReceipts,
    chargedUsage: charged });
  const after = snapshot(repo); const changes = differences(before, after);
  const escaped = changes.filter(f => !role.writes || !allowedPath(f, state.brief.allowedPaths));
  state.acceptedSource = after; // record, never revert another session's edits
  try {
    requireThat(!escaped.length, `Unauthorized/concurrent source edits: ${escaped.join(', ')}`);
    assertFrozen(repo, state.frozen);
    if (lockPlayer && child.exitCode === 75 && !telemetry.session) {
      state.usage.roleLaunches--; hooks.parallel?.notLaunched(); state.status = 'WAITING_RESOURCE'; persist(); return;
    }
    if (child.reason || child.exitCode !== 0) {
      state.status = disposition(child.reason, telemetry.reported || child.error?.includes('ENOENT') ? 'BLOCKED_INFRASTRUCTURE' : 'BLOCKED_CONTRACT');
      throw new Error(child.reason ?? child.error ?? 'Provider process failed');
    }
    requireThat(telemetry.reported && telemetry.completed && telemetry.session, 'Incomplete provider accounting/result; retained transcript cannot be replayed as a free retry');
    requireThat(!state.sessions.includes(telemetry.session), 'Provider reused a role session');
    // A completed last allowed role may still reach deterministic handback.
    const lateBudget = budgetReason({ ...state, activeRole: stage }) ? 'budget:cumulative' : fs.existsSync(path.join(run, 'STOP')) ? 'owner-stop' : false;
    if (lateBudget) { state.status = disposition(lateBudget); throw new Error(lateBudget); }
    const result = decodeRoleResult(stage, telemetry.final);
    requireThat(Buffer.byteLength(JSON.stringify(result)) <= 32_000, 'Role handoff exceeds 32 KB; keep decisions and artifact references');
    result.session = telemetry.session;
    if (reviewScope) { result.reviewScope = reviewScope; result.scopeSha256 = reviewScope.sha256; }
    validateResult(stage, result, { candidate: stage === 'council' ? p.recipeSha256 : p.evidence?.candidateSha256 ?? p.playerEvidence?.candidateSha256 ?? p.avEvidence?.candidateSha256, sessions: state.sessions });
    for (const ref of [...result.evidence, ...result.findings.flatMap(f => f.evidence)]) checkRef(repo, ref);
    if (role.blind) {
      const allowed = stage.startsWith('av') ? [...p.avEvidence.media, ...p.avEvidence.references].map(r => r.path) : null;
      if (allowed) requireThat(result.evidence.every(r => allowed.includes(r.path)), 'Blind AV judge cited hidden material');
    }
    if (stage.startsWith('player')) {
      const attempt = readJson(checkRef(repo, result.playAttempt));
      requireThat(attempt.schema === 'paravoxia.blindPlayAttempt.v1' && attempt.candidateSha256 === p.playerEvidence.candidateSha256 && attempt.ordinaryControls === true && attempt.acceptedActions >= 1 && attempt.cleanup === true && Array.isArray(attempt.trace) && attempt.trace.length > 0, 'Blind player must attempt ordinary controls on this candidate and clean up');
      requireThat(path.resolve(repo, result.playAttempt.path).startsWith(`${dir}${path.sep}`), 'Blind attempt must be fresh and role-owned');
    }
    if (stage === 'build') requireThat(observations(run).firstPlayable, 'Builder did not prove a complete rough playable path');
    if (stage === 'compose') requireThat(observations(run).listen > 0, 'Composer did not capture audible evidence');
    const resultFile = path.join(dir, 'result.json'); writeJson(resultFile, result); state.receipts[stage] = reference(repo, resultFile); state.sessions.push(telemetry.session);
    if (stage === 'council' && result.verdict === 'PASS') {
      const file = path.join(run, 'recipe.json'); writeJson(file, p.recipe); state.receipts.recipe = reference(repo, file);
    }
    advance(state, stage);
    // A refiner may await the runner's final proof. Retain its REVISE and run
    // those existing gates; BLOCKED stops and no second refinement is granted.
    if (!['player', 'av', 'canon'].includes(stage.replace(/-final$/, '')) && result.verdict !== 'PASS'
      && !(stage === 'refine' && result.verdict === 'REVISE')) state.status = 'NEEDS_REVISION';
    event(run, 'completed', { stage, verdict: result.verdict, changes });
  } catch (error) {
    if (!TERMINAL.has(state.status)) state.status = child.reason ? disposition(child.reason) : 'BLOCKED_CONTRACT';
    state.failure = { stage, message: error.message, at: now() }; event(run, 'blocked', state.failure);
  }
  persist();
}

// Only independent, read-only roles may overlap. Each has a fresh packet,
// process and result directory; only this coordinator writes the checkpoint.
export async function dispatchParallel(repo, run, state, stages, hooks = {}) {
  requireThat(stages.length >= 2 && stages.every(s => roleFor(s) && !roleFor(s).writes), 'Only independent read-only roles may run together');
  requireThat(stages.every((s, i) => state.queue[state.cursor + i] === s), 'Parallel roles must be the next adjacent stages');
  requireThat(adaptiveBudget(state) || state.usage.roleLaunches + stages.length <= state.limits.roleLaunches, 'Parallel role reservation exceeds launch budget');
  const before = snapshot(repo), started = Date.now();
  const base = structuredClone(state); state.usage.roleLaunches += stages.length;
  state.activeRole = 'parallel'; state.active = { stage: stages.join('+'), startedAt: now(), pid: null, children: {} }; save(run, state);
  let groupFailure = null;
  const clones = stages.map(stage => {
    const clone = structuredClone(base); clone.queue = [stage]; clone.cursor = 0;
    clone.active = null; clone.activeRole = null;
    // Account reservations globally; each dispatch still obeys its role contract.
    clone.usage.roleLaunches = state.usage.roleLaunches - 1; return clone;
  });
  const settled = await Promise.allSettled(stages.map((stage, i) => dispatch(repo, run, clones[i], stage, {
    ...hooks, parallel: {
      onState: child => { state.active.children[stage] = child.active; save(run, state); },
      charge: delta => { addUsage(state, delta); save(run, state); },
      stop: () => groupFailure ? 'parallel-peer-failed' : stopReason(run, state, started),
      notLaunched: () => { state.usage.roleLaunches--; },
    },
  }).then(() => {
    if (!['RUNNING', 'WAITING_RESOURCE'].includes(clones[i].status) && !groupFailure)
      groupFailure = { status: clones[i].status, failure: clones[i].failure };
  }).catch(error => { groupFailure ??= { status: 'BLOCKED_CONTRACT', failure: { stage, message: error.message, at: now() } }; throw error; })));
  state.activeMs += Date.now() - started; state.active = null; state.activeRole = null;
  requireThat(sha(snapshot(repo)) === sha(before), 'Source changed during independent reviews');
  for (let i = 0; i < stages.length; i++) {
    const child = clones[i], stage = stages[i];
    if (settled[i].status === 'rejected') { state.status = 'BLOCKED_CONTRACT'; state.failure = { stage, message: settled[i].reason.message, at: now() }; continue; }
    if (child.receipts[stage]) {
      const result = readJson(checkRef(repo, child.receipts[stage]));
      requireThat(!state.sessions.includes(result.session), 'Parallel reviewers reused a provider session');
      state.receipts[stage] = child.receipts[stage]; state.sessions.push(result.session);
    }
    if (child.status !== 'RUNNING') { state.status = child.status; state.failure = child.failure; }
  }
  // Advance only the completed prefix. Completed peers are retained on a parked
  // GPU lock and skipped on resume, rather than dispatched again.
  while (stages.includes(state.queue[state.cursor]) && state.receipts[state.queue[state.cursor]]) state.cursor++;
  if (groupFailure) { state.status = groupFailure.status; state.failure = groupFailure.failure; }
  save(run, state);
}

export async function preflight(repo, run, state) {
  const started = Date.now(), dir = path.join(run, 'preflight', randomUUID()); fs.mkdirSync(dir, { recursive: true });
  state.active = { stage: 'preflight', startedAt: now(), pid: null }; save(run, state);
  try {
    const result = await command(state.brief.verification.preflight, { repo, directory: path.join(dir, 'command'),
      variables: { repo, chapter: state.chapter, out: dir }, timeoutMs: Math.min(30_000, remaining(state)),
      shouldStop: () => stopReason(run, state, started), onStart: pid => { state.active.pid = pid; save(run, state); } });
    requireThat(result.exitCode === 0 && !result.reason, result.reason || 'Capability preflight failed');
    const capabilities = readJson(path.join(dir, 'capabilities.json'));
    requireThat(['paravoxia.runtimeCaptureCapabilities.v1', 'paravoxia.chapterToolingCapabilities.v1'].includes(capabilities.schema) && capabilities.supported === true && capabilities.sourceIdentity === true,
      'Capture capability preflight is incomplete');
    const tooling = capabilities.schema === 'paravoxia.chapterToolingCapabilities.v1';
    requireThat(tooling ? capabilities.chapter === state.chapter && capabilities.phase === 'before-authoring'
      && capabilities.acceptance === false && capabilities.sourceSha256 === gameSourceSeal(repo)
      : capabilities.config?.chapter === state.chapter && capabilities.route?.chapter === state.chapter,
      'Capture capability belongs to a different chapter');
    for (const kind of ['manual', 'recovery', 'continue', 'continuity', 'av']) requireThat(capabilities.bindings?.[kind] === true,
      `Missing real ${kind} binding; no creative roles will be launched`);
    assertState(repo, state);
    state.receipts.preflight = reference(repo, path.join(dir, 'capabilities.json')); advance(state, 'preflight');
    event(run, 'preflight-completed', { capabilities: state.receipts.preflight });
  } catch (error) {
    state.status = disposition(stopReason(run, state, started)); state.failure = { stage: 'preflight', message: error.message, at: now() };
  } finally { state.active = null; state.activeMs += Date.now() - started; save(run, state); }
}

function reusableReview(repo, state, stage) {
  const base = stage.replace(/-final$/, '');
  if (!['player', 'av', 'canon'].includes(base)) return null;
  const ref = state.receipts[stage] ?? (stage.endsWith('-final') ? state.receipts[base] : null);
  if (!ref) return null;
  try {
    const result = readJson(checkRef(repo, ref)), bundle = resultAt(repo, state, 'evidence');
    if (result.verdict !== 'PASS' || result.candidateSha256 !== bundle.candidateSha256 || !result.reviewScope || result.scopeSha256 !== result.reviewScope.sha256) return null;
    const scope = readJson(checkRef(repo, result.reviewScope));
    if (scope.schema !== 'paravoxia.chapterLoopReviewScope.v1' || scope.candidateSha256 !== bundle.candidateSha256 || scope.sourceSha256 !== bundle.source || scope.buildSha256 !== bundle.build) return null;
    if (scope.stage.replace(/-final$/, '') !== base || sha(scope.recipe) !== sha(state.receipts.recipe) || sha(scope.canon) !== sha(state.brief.canon)) return null;
    if (sha(scope.media.map(m => [m.kind, m.sha256])) !== sha(bundle.media.map(m => [m.kind, m.sha256]))) return null;
    verifyBundle(repo, readJson(checkRef(repo, scope.evidence)));
    for (const r of [...result.evidence, ...result.findings.flatMap(f => f.evidence)]) checkRef(repo, r);
    return ref;
  } catch { return null; }
}

export async function verify(repo, run, state, stage) {
  const started = Date.now(); const source = gameSourceSeal(repo);
  state.active = { stage, startedAt: now(), pid: null }; save(run, state);
  const dir = path.join(run, 'evidence', `${stage}-${randomUUID()}`); fs.mkdirSync(dir, { recursive: true });
  const config = state.brief.verification; let preview, handedOff = false;
  const vars = { repo, chapter: state.chapter, out: dir, candidate: source, deadline: commandDeadline(state) };
  const options = { repo, directory: path.join(dir, 'build'), variables: vars, timeoutMs: remaining(state), shouldStop: () => stopReason(run, state, started), heavyLock: state.brief.heavyLock, onStart: pid => { state.active.pid = pid; save(run, state); } };
  try {
    for (const check of config.checks ?? []) {
      const effective = { ...check, dependencies: check.dependencies ?? state.brief.toolRefs.map(r => r.path) };
      const identity = { source, build: null, kind: check.id ?? 'static' };
      const cached = findCachedCommand(repo, run, effective, identity);
      if (cached) { event(run, 'check-reused', { id: check.id, source }); continue; }
      const checkDir = path.join(dir, `check-${check.id}`);
      const result = await command(check, { ...options, directory: checkDir, heavyLock: check.resource === 'cpu' ? null : options.heavyLock });
      if (result.exitCode === 75) { state.status = 'WAITING_RESOURCE'; return; }
      requireThat(!result.reason && result.exitCode === 0, result.reason || `Static check ${check.id} failed`);
      requireThat(gameSourceSeal(repo) === source, 'Game source changed during static checks');
      cacheCommand(repo, run, effective, identity, { ...result, artifacts: [reference(repo, path.join(checkDir, 'command.log'))] });
      event(run, 'check-completed', { id: check.id, source });
    }
    const buildConfig = { ...config.build, dependencies: config.build.dependencies ?? state.brief.toolRefs.map(r => r.path) };
    const buildIdentity = { source, build: null, kind: 'build' };
    const cachedBuild = findCachedCommand(repo, run, buildConfig, buildIdentity);
    const dist = path.join(dir, 'dist');
    if (cachedBuild && previewBuildManifest(inside(repo, cachedBuild.dist)).sha256 === cachedBuild.buildSha256) {
      fs.cpSync(inside(repo, cachedBuild.dist), dist, { recursive: true });
      event(run, 'build-reused', { source, build: cachedBuild.buildSha256 });
    } else {
      const built = await command(config.build, options);
      if (built.exitCode === 75) { state.status = 'WAITING_RESOURCE'; return; }
      requireThat(!built.reason && built.exitCode === 0, built.reason ?? 'Build command failed');
      requireThat(gameSourceSeal(repo) === source, 'Game source changed during build');
      const beforeBuild = previewBuildManifest(inside(repo, config.dist));
      fs.cpSync(inside(repo, config.dist), dist, { recursive: true });
      const manifest = previewBuildManifest(dist);
      requireThat(manifest.sha256 === beforeBuild.sha256 && manifest.sha256 === previewBuildManifest(inside(repo, config.dist)).sha256, 'Build changed while archiving');
      cacheCommand(repo, run, buildConfig, buildIdentity, { ...built, dist: path.relative(repo, dist), buildSha256: manifest.sha256,
        artifacts: [reference(repo, path.join(options.directory, 'command.log')), ...Object.keys(manifest.files).map(f => reference(repo, path.join(dist, f)))] });
    }
    preview = await chapterPreview(repo, state, dist, path.join(dir, 'preview.log'));
    const provenanceFile = path.join(dir, 'candidate-context.json');
    writeJson(provenanceFile, currentProvenance(repo, preview));
    vars.provenance = provenanceFile;
    const candidate = sha({ source, build: preview.manifest.sha256 });
    const bundle = { schema: 'paravoxia.chapterLoopEvidence.v1', sourceScope: 'game-v1', source, build: preview.manifest.sha256, candidateSha256: candidate, dist: path.relative(repo, dist), cases: [], artifacts: [], media: [] };
    state.preview = { url: preview.url + state.brief.previewQuery.query, kind: state.brief.previewQuery.kind, live: true, reused: preview.reused === true, candidateSha256: candidate, pid: preview.pid }; save(run, state);
    for (const c of config.cases) {
      const effective = { ...c, dependencies: c.dependencies ?? state.brief.toolRefs.map(r => r.path) };
      const identity = { source, build: bundle.build, kind: c.kind };
      const cached = findCachedCase(repo, run, effective, identity);
      if (cached) {
        bundle.cases.push({ kind: c.kind, checks: cached.checks, passed: true, reused: true });
        bundle.artifacts.push(...cached.artifacts);
        for (const m of cached.media) bundle.media.push({ ...reference(repo, m.file), kind: m.kind });
        event(run, 'probe-reused', { kind: c.kind, report: reference(repo, cached.reportFile) });
        continue;
      }
      const out = path.join(dir, c.kind); fs.mkdirSync(out);
      const result = await command(c, { ...options, directory: out, variables: { ...vars, out, preview: preview.url, candidate }, timeoutMs: Math.max(1, remaining(state) - (Date.now() - started)) });
      if (result.exitCode === 75) { state.status = 'WAITING_RESOURCE'; return; }
      requireThat(!result.reason && [0, 1].includes(result.exitCode), result.reason ?? `Probe ${c.kind} failed to execute`);
      const proof = inspectReport(c, out);
      requireThat(result.exitCode === 0 || !proof.passed, 'Probe exit conflicts with report');
      bundle.cases.push({ kind: c.kind, checks: proof.checks, passed: proof.passed, reused: false });
      bundle.artifacts.push(...proofArtifacts(repo, proof));
      for (const m of proof.media) bundle.media.push({ ...reference(repo, m.file), kind: m.kind });
      // Persist each successful case immediately. A later infrastructure fault
      // must not erase the proofs already produced for this candidate.
      cacheCase(repo, run, effective, identity, proof);
    }
    await preview.verify(); requireThat(gameSourceSeal(repo) === source, 'Game source changed during capture');
    state.receipts.evidence = archiveBundle(repo, dir, bundle);
    if (bundle.cases.some(c => !c.passed)) {
      // Proven gameplay failures get the same one refinement allowance as taste.
      const findings = { findings: bundle.cases.flatMap(c => c.checks.filter(x => !x.passed).map(x => ({ severity: 'blocking', description: `${c.kind}: ${x.name} failed (${JSON.stringify(x.actual)})`, evidence: [state.receipts.evidence] }))), keep: [] };
      const file = path.join(run, 'findings.json'); writeJson(file, findings); state.receipts.findings = reference(repo, file);
      if (state.refinementUsed) state.finalMechanicalFailure = true;
      else { state.refinementUsed = true; state.queue = state.queue.slice(0, state.cursor + 1).concat(['refine', 'verify-final', 'player-final', 'av-final', 'canon-final', 'finish']); }
    }
    advance(state, stage);
    if (state.finalMechanicalFailure) state.status = 'NEEDS_REVISION';
    handedOff = true; return preview;
  } catch (error) {
    state.status = disposition(stopReason(run, state, started), 'BLOCKED_INFRASTRUCTURE');
    state.failure = { stage, message: error.message, classification: 'PROBE_ERROR_INCONCLUSIVE', at: now() };
  } finally {
    state.active = null;
    state.activeMs += Date.now() - started;
    if (!handedOff || state.status !== 'RUNNING') { preview?.close(); if (state.preview) state.preview.live = preview?.reused === true; }
    save(run, state);
  }
}

export function handback(repo, run, state) {
  const bundle = state.receipts.evidence ? resultAt(repo, state, 'evidence') : null;
  const data = { status: state.status, chapter: state.chapter, next: nextStage(state), spent: { activeMs: state.activeMs, ...state.usage }, limits: state.limits,
    remaining: { activeMs: Math.max(0, state.limits.activeMs - state.activeMs), ...Object.fromEntries(Object.keys(state.usage).map(k => [k, Math.max(0, state.limits[k] - state.usage[k])])) },
    priorSpend: state.priorSpend ?? null, budgetGuidance: budgetGuidance(state, { firstPlayable: Boolean(observations(run).firstPlayable) }),
    accountingComplete: !(state.accountingGaps?.length), accountingGaps: state.accountingGaps ?? [],
    preview: state.preview ? { ...state.preview, live: state.preview.reused === true && state.preview.live === true, command: `npm --prefix main run chapter:loop -- preview --run ${path.relative(repo, run)}` } : null,
    evidence: state.receipts.evidence ?? null, candidateSha256: bundle?.candidateSha256 ?? null,
    findings: state.receipts.findings ?? null, failure: state.failure ?? null,
    release: 'Creation result only. Existing certification/release gates and publishing authority remain separate.',
    clock: elapsedClock(state),
    elapsedMs: elapsedClock(state).elapsedMs };
  writeJson(path.join(run, 'handback.json'), data); return data;
}
export async function runLoop(repo, run, hooks = {}) {
  const unlock = acquireLock(path.join(run, '.runner.lock')); let preview; let state;
  try {
    state = readJson(statePath(run));
    if (TERMINAL.has(state.status)) return handback(repo, run, state);
    if (fs.existsSync(path.join(run, 'STOP'))) { state.status = 'STOPPED'; save(run, state); return handback(repo, run, state); }
    if (state.active) {
      // A crash consumes its elapsed allocation; never restart an unaccounted role.
      requireThat(!pidAlive(state.active.pid) && !Object.values(state.active.children ?? {}).some(c => pidAlive(c?.pid)), 'Prior role is still alive; stop its owned run before resuming');
      state.activeMs += Math.max(0, Date.now() - Date.parse(state.active.startedAt)); state.status = 'BLOCKED_CONTRACT';
      state.failure = { message: 'Interrupted role requires retained-telemetry reconciliation; automatic replay is forbidden' }; save(run, state); return handback(repo, run, state);
    }
    assertState(repo, state); state.status = 'RUNNING';
    while (nextStage(state)) {
      const stage = nextStage(state);
      const why = stopReason(run, state); if (why && !['decide', 'finish'].includes(stage)) { state.status = disposition(why); break; }
      assertState(repo, state);
      if (stage === 'preflight') { await preflight(repo, run, state); }
      else if (roleFor(stage)) {
        const reused = reusableReview(repo, state, stage);
        if (reused) { state.receipts[stage] = reused; advance(state, stage); event(run, 'review-reused', { stage, original: reused }); save(run, state); continue; }
        if (['player', 'av', 'canon'].includes(stage.replace(/-final$/, ''))) {
          const bundle = resultAt(repo, state, 'evidence'); verifyBundle(repo, bundle);
          if (!preview) { preview = await chapterPreview(repo, state, inside(repo, bundle.dist), path.join(run, `preview-${randomUUID()}.log`)); state.preview = { ...state.preview, url: preview.url + state.brief.previewQuery.query, live: true, reused: preview.reused === true, pid: preview.pid }; }
          await preview.verify();
        }
        const family = stage === 'cinema' ? ['cinema', 'score-plan']
          : ['player', 'av', 'canon'].includes(stage.replace(/-final$/, ''))
            ? ['player', 'av', 'canon'].map(s => s + (stage.endsWith('-final') ? '-final' : '')) : [];
        const group = [];
        for (const s of state.queue.slice(state.cursor)) {
          if (!family.includes(s) || reusableReview(repo, state, s)) break;
          group.push(s);
        }
        const availableGroup = adaptiveBudget(state) ? group : group.slice(0, Math.max(0, state.limits.roleLaunches - state.usage.roleLaunches));
        if (state.workload === 'throughput-v2' && availableGroup.length > 1) await dispatchParallel(repo, run, state, availableGroup, hooks);
        else await dispatch(repo, run, state, stage, hooks);
      } else if (stage.startsWith('verify')) { preview?.close(); preview = await verify(repo, run, state, stage); }
      else {
        verifyBundle(repo, resultAt(repo, state, 'evidence')); await preview?.verify();
        const final = stage === 'finish'; const suffix = final ? '-final' : '';
        const findings = decision(state, ['player', 'av', 'canon'].map(s => resultAt(repo, state, s + suffix)), final);
        const file = path.join(run, 'findings.json'); writeJson(file, findings); state.receipts.findings = reference(repo, file);
        state.cursor++; save(run, state);
      }
      if (state.status === 'WAITING_RESOURCE') break;
    }
  } catch (error) {
    if (!state) throw error;
    state.status = 'BLOCKED_CONTRACT'; state.failure = { message: error.message, at: now() };
  } finally { preview?.close(); if (state) { if (state.preview) state.preview.live = state.preview.reused === true && state.preview.live === true; save(run, state); } unlock(); }
  return handback(repo, run, state);
}

export async function observe(repo, run, kind) {
  requireThat(['look', 'listen'].includes(kind), 'Observation must be look or listen');
  const unlock = acquireLock(path.join(run, '.observe.lock'));
  try {
    const state = readJson(statePath(run));
    requireThat(state.status === 'RUNNING' && state.active && process.env.CHAPTER_LOOP_TICKET && state.active.ticket === process.env.CHAPTER_LOOP_TICKET && roleFor(state.active.stage)?.observe === kind && pidAlive(state.active.pid), 'Observation requires the active owning role ticket');
    const counts = observations(run); requireThat(adaptiveBudget(state) || counts[kind] < state.limits[`${kind}Cycles`], `${kind} cycle budget exhausted`);
    counts[kind]++; writeJson(path.join(run, 'observations.json'), counts);
    const dir = path.join(run, 'observations', `${kind}-${counts[kind]}`); fs.mkdirSync(dir, { recursive: true });
    const source = sourceSeal(repo); const config = state.brief.verification.observe[kind];
    const result = await command(config, { repo, directory: dir, variables: { repo, chapter: state.chapter, out: dir, candidate: source, deadline: commandDeadline(state) }, timeoutMs: remaining(state), shouldStop: () => fs.existsSync(path.join(run, 'STOP')) || !pidAlive(state.active.pid), heavyLock: state.brief.heavyLock, onStart: pid => { counts.active = { kind, pid, startedAt: now() }; writeJson(path.join(run, 'observations.json'), counts); } });
    counts.active = null; writeJson(path.join(run, 'observations.json'), counts);
    requireThat(result.exitCode === 0 && !result.reason, result.reason ?? `Observation command exited ${result.exitCode}`);
    const proof = inspectReport(config, dir); requireThat(proof.passed && source === sourceSeal(repo), 'Observation failed or source changed during it');
    const receipt = { kind, at: now(), source, report: reference(repo, proof.reportFile), media: proof.media.map(m => ({ ...reference(repo, m.file), kind: m.kind })) };
    counts.receipts.push(receipt);
    if (kind === 'look' && !counts.firstPlayable) counts.firstPlayable = receipt;
    writeJson(path.join(run, 'observations.json'), counts); return receipt;
  } finally { unlock(); }
}
export async function recover(repo, run, repairFile = null) {
  const unlock = acquireLock(path.join(run, '.runner.lock'));
  try {
    const state = readJson(statePath(run));
    if (repairFile) {
      requireThat(pinned(state) === state.policySha256 && !state.active, 'Infrastructure reconciliation requires intact policy and no active work');
      const repair = readJson(repairFile);
      requireThat(repair.schema === 'paravoxia.chapterLoopInfrastructureRepair.v1' && repair.runId === state.id && repair.failureSha256 === sha(state.failure), 'Repair receipt belongs to a different failure');
      const mediaBinding = validateMediaBindingRecovery(repo, state, repair);
      // Finish an already authorized repair before the next capture/role starts.
      // This reconciles its final bytes without replaying work or granting retries.
      const lastEvent = JSON.parse(fs.readFileSync(path.join(run, 'events.jsonl'), 'utf8').trim().split('\n').at(-1));
      // Inactive source maintenance may complete an already authorized repair
      // without reopening a creative REVISE, changing its queue, or buying retries.
      const reconcileOnly = repair.reconcileOnly === true && state.status === 'NEEDS_REVISION';
      const amending = Boolean(repair.amends && sha(repair.amends) === sha(state.infrastructureRepair)
        && (reconcileOnly || state.status === 'RUNNING'
          && ['infrastructure-recovery', 'infrastructure-reconciled'].includes(lastEvent.type)));
      if (repair.reconcileOnly) requireThat(reconcileOnly && repair.amends && !repair.blockedRole && !repair.ownerAuthorization,
        'Maintenance preserves an inactive revision verdict and cannot grant a continuation');
      if (repair.amends) { checkRef(repo, repair.amends); requireThat(amending, 'Repair amendment requires the unchanged repaired checkpoint before resumed work'); }
      requireThat(mediaBinding || amending || state.status === 'BLOCKED_INFRASTRUCTURE' || (state.status === 'BLOCKED_CONTRACT' && state.failure?.message === 'reason?.startsWith is not a function' && state.usage.roleLaunches === 0), 'This verdict is not an infrastructure failure');
      let ownerRecovery;
      if (repair.ownerAuthorization) {
        requireThat(!amending, 'Repair amendment cannot grant another recovery');
        const authority = readJson(checkRef(repo, repair.ownerAuthorization));
        requireThat(authority.schema === 'paravoxia.chapterLoopOwnerRepair.v1' && authority.runId === state.id && authority.failureSha256 === sha(state.failure)
          && typeof authority.request === 'string' && authority.request.trim().length > 0 && authority.extraInfrastructureRetries === 1,
        'Renewed owner repair authority must identify this run, failure, request and one extra recovery');
        requireThat(state.retries === recoveryAllowance(state) && !state.ownerRecoveries?.some(r => r.failureSha256 === sha(state.failure)),
          'Owner repair authority cannot duplicate an allowance or replay a failure');
        ownerRecovery = { authority: repair.ownerAuthorization, failureSha256: sha(state.failure), at: now() };
      }
      requireThat(amending || state.retries < recoveryAllowance(state) || ownerRecovery, 'Infrastructure reconciliation requires unused recovery or renewed owner repair authority');
      const current = snapshot(repo), changed = differences(state.acceptedSource, current);
      const listed = new Map(repair.files.map(r => [r.path, r]));
      for (const name of new Set([...changed, ...Object.keys(state.frozen).filter(n => sha(fs.readFileSync(inside(repo, n))) !== state.frozen[n])])) requireThat(listed.has(name), `Unlisted change during recovery: ${name}`);
      for (const [name, ref] of listed) {
        requireThat(!allowedPath(name, state.brief.allowedPaths) && name !== 'main/tools/chapter-loop/contract.mjs' && !name.startsWith('.claude/') && (name.startsWith('main/tools/chapter-loop') || state.brief.toolRefs.some(r => r.path === name)), 'Recovery may change capture/transport infrastructure only');
        requireThat(ref.before === (state.frozen[name] ?? state.acceptedSource[name] ?? null), `Repair before-hash mismatch: ${name}`);
        requireThat(sha(fs.readFileSync(inside(repo, name))) === ref.after, `Repair after-hash mismatch: ${name}`);
        if (state.frozen[name] || name.startsWith('main/tools/chapter-loop')) state.frozen[name] = ref.after;
      }
      state.brief.toolRefs = state.brief.toolRefs.map(ref => listed.has(ref.path) ? { ...ref, sha256: listed.get(ref.path).after } : ref);
      requireThat(repair.validation?.passed === true && repair.validation.command === 'npm run chapter:loop:test', 'Repair needs relevant passing checks');
      if (ownerRecovery) {
        state.ownerRecoveries = [...(state.ownerRecoveries ?? []), ownerRecovery];
        state.frozen[ownerRecovery.authority.path] = ownerRecovery.authority.sha256;
        event(run, 'owner-authorized-infrastructure-repair', ownerRecovery);
      }
      if (mediaBinding) {
        event(run, 'media-binding-recovery', { blockedResult: state.receipts.compose, priorFailure: state.failure, next: 'compose' });
        state.cursor--;
        state.failure = { stage: 'compose', message: 'Missing native media perception binding in completed composer', result: state.receipts.compose, at: now() };
        state.continuationHandoff = repair.handoff;
        state.frozen[repair.handoff.path] = repair.handoff.sha256;
      }
      state.acceptedSource = current; state.policySha256 = pinned(state); state.status = reconcileOnly ? state.status : amending ? 'RUNNING' : 'BLOCKED_INFRASTRUCTURE';
      state.infrastructureRepair = reference(repo, repairFile); event(run, 'infrastructure-reconciled', { receipt: state.infrastructureRepair, originalFailure: state.failure }); save(run, state);
      if (amending) return handback(repo, run, state);
    }
    requireThat(state.status === 'BLOCKED_INFRASTRUCTURE' && state.retries < recoveryAllowance(state) && !state.active, 'Only one diagnosed infrastructure recovery is available without renewed owner repair authority');
    assertState(repo, state); requireThat(!stopReason(run, state), 'No budget/authority remains');
    const started = Date.now(); state.retries++; state.active = { stage: 'infrastructure-recovery', startedAt: now(), pid: null }; save(run, state);
    const dir = path.join(run, 'recovery', String(state.retries)); fs.mkdirSync(dir, { recursive: true });
    const result = await command(state.brief.verification.recovery, { repo, directory: dir, variables: { repo, chapter: state.chapter, out: dir }, timeoutMs: remaining(state), shouldStop: () => stopReason(run, state, started), heavyLock: state.brief.heavyLock, onStart: pid => { state.active.pid = pid; save(run, state); } });
    state.activeMs += Date.now() - started; state.active = null; save(run, state); assertState(repo, state);
    state.status = result.exitCode === 0 && !result.reason ? 'RUNNING' : disposition(result.reason);
    event(run, 'infrastructure-recovery', { result, attempt: state.retries }); save(run, state); return handback(repo, run, state);
  } finally { unlock(); }
}

export function validateMediaBindingRecovery(repo, state, repair) {
  if (!repair.blockedRole) return false;
  requireThat(state.status === 'NEEDS_REVISION' && state.queue[state.cursor - 1] === 'compose'
    && repair.blockedRole.stage === 'compose' && sha(repair.blockedRole.result) === sha(state.receipts.compose), 'Media recovery must identify the exact completed composer');
  const resultFile = checkRef(repo, repair.blockedRole.result), result = readJson(resultFile);
  const directory = path.dirname(resultFile), packet = readJson(path.join(directory, 'packet.json')), transport = readJson(path.join(directory, 'transport.json'));
  requireThat(result.verdict === 'BLOCKED' && !packet.mediaPerception && transport.completed && transport.reported
    && transport.session === result.session, 'Only the completed composer lacking its media binding can be continued');
  const probe = readJson(checkRef(repo, repair.perceptionCapability));
  requireThat(probe.schema === 'paravoxia.mediaPerception.v1' && probe.status === 'observed' && probe.usage
    && probe.source.kind === 'audio' && probe.description, 'A real native audio capability receipt is required');
  checkRef(repo, probe.source); checkRef(repo, repair.handoff);
  return true;
}

// Complete validation of retained provider bytes after the id/event wire-format
// repair. No model call, new creative choice, retry grant or budget reset.
export function reconcileNamedEvents(repo,run,receiptFile) {
  const unlock=acquireLock(path.join(run,'.runner.lock'));
  try{
    const state=readJson(statePath(run)),receipt=readJson(receiptFile);
    const packetOnly=state.queue[state.cursor]==='council'&&state.failure?.message==='Role packet exceeds context budget'
      &&receipt.kind==='deduplicate-council-packet'&&!state.receipts.council;
    requireThat(state.status==='BLOCKED_CONTRACT'&&!state.active&&(packetOnly||(state.queue[state.cursor]==='plan'
      &&state.failure?.message==='Named event anchors required'&&!state.receipts.plan)),
    'Only a retained named-event result or undispatched duplicate council packet can be reconciled');
    requireThat(pinned(state)===state.policySha256&&receipt.schema==='paravoxia.namedEventRepair.v1'
      &&receipt.ownerRequest==='RUN THAT BITCH'&&receipt.runId===state.id&&receipt.previousStateSha256===sha(state),
    'Named-event reconciliation needs the exact retained state and authorized repair');
    requireThat(!stopReason(run,state),'No original budget remains');
    const current=snapshot(repo),listed=new Map(receipt.files.map(f=>[f.path,f]));
    for(const name of differences(state.acceptedSource,current))requireThat(listed.has(name),`Unlisted schema repair: ${name}`);
    for(const [name,f]of listed){
      requireThat(name==='main/tools/chapter-loop.mjs'||/^main\/tools\/chapter-loop\/(?:runner|role-result(?:\.test)?)\.mjs$/.test(name),
        'Named-event repair cannot modify game, commissions, budgets or other validation');
      requireThat(f.before===(state.frozen[name]??state.acceptedSource[name]??null)
        &&f.after===sha(fs.readFileSync(inside(repo,name))),`Schema repair hash differs: ${name}`);
    }
    const validation=readJson(checkRef(repo,receipt.validation));
    requireThat(validation.passed===true&&validation.handoffSha256===sha(receipt.files),'Exact schema repair tests required');
    if(packetOnly){
      const dir=path.join(run,'roles',`${state.usage.roleLaunches+1}-council`);
      requireThat(!fs.existsSync(path.join(dir,'transcript.jsonl'))&&!fs.existsSync(path.join(dir,'transport.json')),
        'Council reconciliation cannot replay a dispatched role');
      const payload=dispatchInput(repo,run,state,'council',dir),bytes=Buffer.byteLength(payload.system+payload.prompt);
      requireThat(bytes<=state.limits.promptBytes,`Deduplicated council packet still exceeds ${state.limits.promptBytes} bytes (${bytes})`);
      const prior=path.join(path.dirname(receiptFile),'previous-state.json');fs.copyFileSync(statePath(run),prior,fs.constants.COPYFILE_EXCL);
      state.acceptedSource=current;for(const [name,f]of listed)state.frozen[name]=f.after;
      const ref=reference(repo,receiptFile);state.frozen[ref.path]=ref.sha256;state.policySha256=pinned(state);state.status='RUNNING';
      assertState(repo,state);save(run,state);event(run,'council-packet-deduplicated',{bytes,receipt:ref,previousState:reference(repo,prior),modelReplayed:false});
      return {status:state.status,next:'council',packetBytes:bytes,spent:state.usage};
    }
    const dir=path.join(run,'roles',`${state.usage.roleLaunches}-plan`),transport=readJson(path.join(dir,'transport.json'));
    requireThat(transport.completed===true&&transport.reported===true&&transport.exitCode===0&&!transport.reason
      &&transport.session&&!state.sessions.includes(transport.session),'Completed independent provider accounting required');
    const original=fs.readFileSync(path.join(dir,'last-message.txt'),'utf8');
    const events=fs.readFileSync(path.join(dir,'transcript.jsonl'),'utf8').split('\n').flatMap(l=>{try{return [JSON.parse(l)];}catch{return [];}});
    const final=events.findLast(e=>e.type==='item.completed'&&e.item?.type==='agent_message')?.item?.text;
    requireThat(typeof final==='string'&&sha(final.trim())===sha(original.trim()),'Retained final output differs from provider transcript');
    const result=decodeRoleResult('plan',original);result.session=transport.session;
    validateResult('plan',result,{sessions:state.sessions});
    for(const ref of [...result.evidence,...result.findings.flatMap(f=>f.evidence)])checkRef(repo,ref);
    requireThat(result.verdict==='PASS'&&result.anchorEvents?.length===result.anchors.length,'Repair cannot promote a creative revision');
    const prior=path.join(run,'named-event-repair','previous-state.json');fs.mkdirSync(path.dirname(prior),{recursive:true});
    fs.copyFileSync(statePath(run),prior,fs.constants.COPYFILE_EXCL);
    result.normalization={original:reference(repo,path.join(dir,'last-message.txt')),transport:reference(repo,path.join(dir,'transport.json')),repair:reference(repo,receiptFile)};
    const file=path.join(dir,'result.json');writeJson(file,result);state.receipts.plan=reference(repo,file);state.sessions.push(transport.session);
    state.acceptedSource=current;for(const [name,f]of listed)state.frozen[name]=f.after;
    const ref=reference(repo,receiptFile);state.frozen[ref.path]=ref.sha256;state.policySha256=pinned(state);
    state.status='RUNNING';advance(state,'plan');assertState(repo,state);save(run,state);
    event(run,'retained-plan-normalized',{original:result.normalization,previousState:reference(repo,prior),modelReplayed:false});
    return {status:state.status,next:state.queue[state.cursor],receipt:state.receipts.plan,spent:state.usage};
  }finally{unlock();}
}
