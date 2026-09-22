import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { VERSION, ROLES, INITIAL, TERMINAL, limitsFor, emptyUsage, nextStage, roleFor, beginRole, advance, validateResult, decision, budgetReason, addUsage, requireThat, sha } from './contract.mjs';
import { readJson, writeJson, inside, reference, checkRef, snapshot, sourceSeal, differences, allowedPath, acquireLock, frozenInputs, assertFrozen, excerpt, pidAlive } from './store.mjs';
import { providerCommand, usageTracker } from './providers.mjs';
import { runProcess } from './process.mjs';
import { validateVerification, validateCommand, command, inspectReport, startPreview, archiveBundle, verifyBundle } from './evidence.mjs';
import { continuation } from './continuation.mjs';

const HOME = '.codex/chapter-loops';
const now = () => new Date().toISOString();
const statePath = run => path.join(run, 'state.json');
const save = (run, state) => writeJson(statePath(run), state);
const event = (run, type, data = {}) => fs.appendFileSync(path.join(run, 'events.jsonl'), JSON.stringify({ at: now(), type, ...data }) + '\n');
const pinned = state => sha({ brief: state.brief, limits: state.limits, frozen: state.frozen });

export function validateBrief(repo, brief) {
  requireThat(brief?.schema === 'paravoxia.chapterBrief.v1' && /^ch[0-9]+[a-z0-9-]*$/.test(brief.chapter), 'Chapter brief schema/id required');
  requireThat(typeof brief.request === 'string' && brief.request.length >= 40 && typeof brief.authority === 'string' && brief.authority.length >= 20, 'Bounded request and existing owner authority required');
  requireThat(['claude', 'codex'].includes(brief.provider?.provider) && ['creative', 'mechanical'].every(k => typeof brief.provider.models?.[k] === 'string' && brief.provider.models[k]), 'Explicit provider/model bindings required');
  requireThat(Array.isArray(brief.canon) && brief.canon.length > 0, 'Compact canon refs required');
  for (const ref of brief.canon) excerpt(repo, ref);
  requireThat(Array.isArray(brief.references) && brief.references.length >= 2, 'Previous chapter and an approved presentation reference required');
  for (const ref of brief.references) checkRef(repo, ref);
  requireThat(Array.isArray(brief.allowedPaths) && brief.allowedPaths.length > 0, 'Explicit implementation ownership required');
  for (const name of brief.allowedPaths) {
    inside(repo, name, { exists: false });
    requireThat(/^(main\/(src|public)\/|main\/chapter-[^/]+\.json$)/.test(name), 'Creation may own game content and chapter manifests only');
  }
  requireThat(Array.isArray(brief.toolRefs) && brief.toolRefs.length > 0, 'Existing probe/tool references required');
  for (const ref of brief.toolRefs) checkRef(repo, ref);
  validateVerification(brief.verification);
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
    const state = { schema: VERSION, id, chapter: brief.chapter, createdAt: now(), status: 'RUNNING', queue: resumed ? INITIAL.slice(INITIAL.indexOf('verify')) : [...INITIAL], cursor: 0,
      brief, limits, frozen: frozenInputs(repo, files), activeMs: 0, usage: emptyUsage(), retries: 0, refinementUsed: false,
      activeRole: null, active: null, receipts: {}, sessions: [], acceptedSource: snapshot(repo), preview: null };
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
  assertFrozen(repo, state.frozen);
  requireThat(sha(snapshot(repo)) === sha(state.acceptedSource), 'Source changed outside the recorded role; preserve edits and stop for a source handoff');
}
function resultAt(repo, state, stage) { return readJson(checkRef(repo, state.receipts[stage])); }
function observations(run) { return readJson(path.join(run, 'observations.json')); }
function remaining(state) { return Math.max(1, state.limits.activeMs - state.activeMs); }
function stopReason(run, state, started = Date.now()) {
  if (fs.existsSync(path.join(run, 'STOP'))) return 'owner-stop';
  const elapsed = Date.now() - started;
  const reason = budgetReason(state, elapsed);
  if (reason) return `budget:${reason}`;
  if (!observations(run).firstPlayable && state.activeMs + elapsed >= state.limits.firstPlayableMs) return 'budget:firstPlayableMs';
  return false;
}
function disposition(reason, fallback = 'BLOCKED_INFRASTRUCTURE') {
  return reason === 'owner-stop' ? 'STOPPED' : (typeof reason === 'string' && reason.startsWith('budget:')) || reason === 'deadline' ? 'BUDGET_EXHAUSTED' : fallback;
}
function persistResult(repo, run, state, stage, data, directory) {
  const file = path.join(directory, 'result.json'); writeJson(file, data); state.receipts[stage] = reference(repo, file); save(run, state);
}
function packet(repo, run, state, stage) {
  const role = roleFor(stage), base = stage.replace(/-final$/, ''); const p = {};
  const canon = state.brief.canon.map(r => excerpt(repo, r));
  const recipe = state.receipts.recipe ? resultAt(repo, state, 'recipe') : null;
  const bundle = state.receipts.evidence ? resultAt(repo, state, 'evidence') : null;
  for (const input of role.inputs) {
    if (input === 'brief') p.brief = { chapter: state.chapter, request: state.brief.request, authority: state.brief.authority, allowedPaths: state.brief.allowedPaths, references: state.brief.references };
    else if (input === 'canon') p.canon = canon;
    else if (input === 'recipe') p.recipe = recipe;
    else if (input === 'evidence') p.evidence = bundle;
    else if (input === 'playerEvidence') p.playerEvidence = { candidateSha256: bundle.candidateSha256, preview: state.preview, controls: 'Use the visible instructions and ordinary player controls. No debug progress setters.' };
    else if (input === 'avEvidence') p.avEvidence = { candidateSha256: bundle.candidateSha256, media: bundle.media, references: state.brief.references };
    else p[input] = resultAt(repo, state, input);
  }
  if (base === 'council') {
    const lanes = Object.fromEntries(['plan', 'cinema', 'score-plan'].map(s => [s, resultAt(repo, state, s)]));
    const anchors = lanes.plan.anchors;
    for (const lane of ['cinema', 'score-plan']) requireThat(sha(lanes[lane].anchors) === sha(anchors), 'Creative peers must share the same named event anchors');
    p.recipe = { schema: 'paravoxia.chapterRecipe.v1', chapter: state.chapter, anchors, lanes };
    p.recipeSha256 = sha(p.recipe);
  }
  return p;
}
export async function dispatch(repo, run, state, stage, hooks = {}) {
  const role = roleFor(stage); const p = packet(repo, run, state, stage);
  const dir = path.join(run, 'roles', `${state.usage.roleLaunches + 1}-${stage}`); fs.mkdirSync(dir, { recursive: true });
  const ticket = randomUUID(); const before = snapshot(repo);
  const commission = fs.readFileSync(path.join(repo, `.claude/agents/chapter-loop/${role.commission}.md`), 'utf8');
  const system = `${commission}\n\n${fs.readFileSync(path.join(repo, '.claude/agents/chapter-loop/result.md'), 'utf8')}\nDo not dispatch agents, publish, alter the runner, or expand scope. Output only the final JSON result. Routine authorized reversible work does not require another permission request. Read only this packet and permitted files.\n`;
  const prompt = JSON.stringify({ ...p, stage, outputDirectory: dir, repo: role.blind ? undefined : repo,
    observe: role.observe ? { command: ['node', path.join(repo, 'main/tools/chapter-loop.mjs'), 'observe', '--run', run, '--kind', role.observe], limit: state.limits[`${role.observe}Cycles`] } : undefined });
  requireThat(Buffer.byteLength(system + prompt) <= state.limits.promptBytes, 'Role packet exceeds context budget');
  beginRole(state, stage); const started = Date.now(); state.active = { stage, ticket, startedAt: now(), pid: null }; save(run, state);
  event(run, 'dispatch', { stage, launch: state.usage.roleLaunches });
  const tracker = usageTracker(state.brief.provider.provider); let charged = emptyUsage();
  const meter = () => {
    const measured = tracker.result().usage;
    const delta = Object.fromEntries(Object.keys(measured).map(k => [k, Math.max(0, measured[k] - charged[k])]));
    addUsage(state, delta); for (const k in charged) charged[k] = Math.max(charged[k], measured[k]); save(run, state);
  };
  const spec = providerCommand(state.brief.provider, { prompt, system, output: path.join(dir, 'last-message.txt'), role, remainingTurns: state.limits.roleTurns });
  const processRunner = hooks.runProcess ?? runProcess;
  const lockPlayer = stage.startsWith('player');
  const child = await processRunner(lockPlayer ? 'flock' : spec.command, lockPlayer ? ['-E', '75', '-w', '30', state.brief.heavyLock, spec.command, ...spec.args] : spec.args, { cwd: role.blind ? dir : repo, input: spec.input,
    env: { CHAPTER_LOOP_TICKET: ticket, CHAPTER_LOOP_RUN: run }, log: path.join(dir, 'transcript.jsonl'),
    timeoutMs: Math.min(remaining(state), state.limits.roleMs), maxBytes: state.limits.transcriptBytes,
    onStart: pid => { state.active.pid = pid; save(run, state); },
    shouldStop: () => stopReason(run, state, started),
    onLine: line => { tracker.ingest(line); meter(); const t = tracker.result();
      if (t.usage.modelTurns >= state.limits.roleTurns) return 'budget:roleTurns';
      if (t.contextTokens > state.limits.contextTokens) return 'budget:contextTokens';
      return stopReason(run, state, started); },
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
  writeJson(path.join(dir, 'transport.json'), { ...child, ...telemetry, final: undefined, requestedModel: spec.model });
  const after = snapshot(repo); const changes = differences(before, after);
  const escaped = changes.filter(f => !role.writes || !allowedPath(f, state.brief.allowedPaths));
  state.acceptedSource = after; // record, never revert another session's edits
  try {
    requireThat(!escaped.length, `Unauthorized/concurrent source edits: ${escaped.join(', ')}`);
    assertFrozen(repo, state.frozen);
    if (lockPlayer && child.exitCode === 75 && !telemetry.session) {
      state.usage.roleLaunches--; state.status = 'WAITING_RESOURCE'; save(run, state); return;
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
    const result = JSON.parse(telemetry.final.trim().replace(/^```(?:json)?\s*|\s*```$/g, ''));
    result.session = telemetry.session;
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
    persistResult(repo, run, state, stage, result, dir); state.sessions.push(telemetry.session);
    if (stage === 'council' && result.verdict === 'PASS') {
      const file = path.join(run, 'recipe.json'); writeJson(file, p.recipe); state.receipts.recipe = reference(repo, file);
    }
    advance(state, stage);
    if (!['player', 'av', 'canon'].includes(stage.replace(/-final$/, '')) && result.verdict !== 'PASS') state.status = 'NEEDS_REVISION';
    event(run, 'completed', { stage, verdict: result.verdict, changes });
  } catch (error) {
    if (!TERMINAL.has(state.status)) state.status = child.reason ? disposition(child.reason) : 'BLOCKED_CONTRACT';
    state.failure = { stage, message: error.message, at: now() }; event(run, 'blocked', state.failure);
  }
  save(run, state);
}

export async function verify(repo, run, state, stage) {
  const started = Date.now(); const source = sourceSeal(repo);
  state.active = { stage, startedAt: now(), pid: null }; save(run, state);
  const dir = path.join(run, 'evidence', `${stage}-${randomUUID()}`); fs.mkdirSync(dir, { recursive: true });
  const config = state.brief.verification; let preview, handedOff = false;
  const vars = { repo, chapter: state.chapter, out: dir, candidate: source };
  const options = { repo, directory: path.join(dir, 'build'), variables: vars, timeoutMs: remaining(state), shouldStop: () => stopReason(run, state, started), heavyLock: state.brief.heavyLock, onStart: pid => { state.active.pid = pid; save(run, state); } };
  try {
    const built = await command(config.build, options);
    if (built.exitCode === 75) { state.status = 'WAITING_RESOURCE'; return; }
    requireThat(!built.reason && built.exitCode === 0, built.reason ?? 'Build command failed');
    requireThat(sourceSeal(repo) === source, 'Source changed during build');
    const dist = path.join(dir, 'dist'); fs.cpSync(inside(repo, config.dist), dist, { recursive: true });
    preview = await startPreview(dist, path.join(dir, 'preview.log'));
    const candidate = sha({ source, build: preview.manifest.sha256 });
    const bundle = { schema: 'paravoxia.chapterLoopEvidence.v1', source, build: preview.manifest.sha256, candidateSha256: candidate, dist: path.relative(repo, dist), cases: [], artifacts: [], media: [] };
    state.preview = { url: preview.url + state.brief.previewQuery.query, kind: state.brief.previewQuery.kind, live: true, candidateSha256: candidate, pid: preview.pid }; save(run, state);
    for (const c of config.cases) {
      const out = path.join(dir, c.kind); fs.mkdirSync(out);
      const result = await command(c, { ...options, directory: out, variables: { ...vars, out, preview: preview.url, candidate }, timeoutMs: Math.max(1, remaining(state) - (Date.now() - started)) });
      if (result.exitCode === 75) { state.status = 'WAITING_RESOURCE'; return; }
      requireThat(!result.reason && [0, 1].includes(result.exitCode), result.reason ?? `Probe ${c.kind} failed to execute`);
      const proof = inspectReport(c, out);
      requireThat(result.exitCode === 0 || !proof.passed, 'Probe exit conflicts with report');
      bundle.cases.push({ kind: c.kind, checks: proof.checks, passed: proof.passed });
      bundle.artifacts.push(reference(repo, proof.reportFile));
      for (const m of proof.media) { const ref = { ...reference(repo, m.file), kind: m.kind }; bundle.media.push(ref); bundle.artifacts.push(ref); }
    }
    await preview.verify(); requireThat(sourceSeal(repo) === source, 'Source changed during capture');
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
    if (!handedOff || state.status !== 'RUNNING') { preview?.close(); if (state.preview) state.preview.live = false; }
    save(run, state);
  }
}

export function handback(repo, run, state) {
  const bundle = state.receipts.evidence ? resultAt(repo, state, 'evidence') : null;
  const data = { status: state.status, chapter: state.chapter, next: nextStage(state), spent: { activeMs: state.activeMs, ...state.usage }, limits: state.limits,
    remaining: { activeMs: Math.max(0, state.limits.activeMs - state.activeMs), ...Object.fromEntries(Object.keys(state.usage).map(k => [k, Math.max(0, state.limits[k] - state.usage[k])])) },
    priorSpend: state.priorSpend ?? null,
    preview: state.preview ? { ...state.preview, live: false, command: `npm --prefix main run chapter:loop -- preview --run ${path.relative(repo, run)}` } : null,
    evidence: state.receipts.evidence ?? null, candidateSha256: bundle?.candidateSha256 ?? null,
    findings: state.receipts.findings ?? null, failure: state.failure ?? null,
    release: 'Creation result only. Existing certification/release gates and publishing authority remain separate.',
    elapsedMs: Date.now() - Date.parse(state.createdAt) };
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
      requireThat(!pidAlive(state.active.pid), 'Prior role is still alive; stop its owned run before resuming');
      state.activeMs += Math.max(0, Date.now() - Date.parse(state.active.startedAt)); state.status = 'BLOCKED_CONTRACT';
      state.failure = { message: 'Interrupted role requires retained-telemetry reconciliation; automatic replay is forbidden' }; save(run, state); return handback(repo, run, state);
    }
    assertState(repo, state); state.status = 'RUNNING';
    while (nextStage(state)) {
      const stage = nextStage(state);
      const why = stopReason(run, state); if (why && !['decide', 'finish'].includes(stage)) { state.status = disposition(why); break; }
      assertState(repo, state);
      if (roleFor(stage)) {
        if (['player', 'av', 'canon'].includes(stage.replace(/-final$/, ''))) {
          const bundle = resultAt(repo, state, 'evidence'); verifyBundle(repo, bundle);
          if (!preview) { preview = await startPreview(inside(repo, bundle.dist), path.join(run, `preview-${randomUUID()}.log`)); state.preview = { ...state.preview, url: preview.url + state.brief.previewQuery.query, live: true, pid: preview.pid }; }
          await preview.verify();
        }
        await dispatch(repo, run, state, stage, hooks);
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
  } finally { preview?.close(); if (state) { if (state.preview) state.preview.live = false; save(run, state); } unlock(); }
  return handback(repo, run, state);
}

export async function observe(repo, run, kind) {
  requireThat(['look', 'listen'].includes(kind), 'Observation must be look or listen');
  const unlock = acquireLock(path.join(run, '.observe.lock'));
  try {
    const state = readJson(statePath(run));
    requireThat(state.status === 'RUNNING' && state.active && process.env.CHAPTER_LOOP_TICKET && state.active.ticket === process.env.CHAPTER_LOOP_TICKET && roleFor(state.active.stage)?.observe === kind && pidAlive(state.active.pid), 'Observation requires the active owning role ticket');
    const counts = observations(run); requireThat(counts[kind] < state.limits[`${kind}Cycles`], `${kind} cycle budget exhausted`);
    counts[kind]++; writeJson(path.join(run, 'observations.json'), counts);
    const dir = path.join(run, 'observations', `${kind}-${counts[kind]}`); fs.mkdirSync(dir, { recursive: true });
    const source = sourceSeal(repo); const config = state.brief.verification.observe[kind];
    const result = await command(config, { repo, directory: dir, variables: { repo, chapter: state.chapter, out: dir, candidate: source }, timeoutMs: remaining(state), shouldStop: () => fs.existsSync(path.join(run, 'STOP')) || !pidAlive(state.active.pid), heavyLock: state.brief.heavyLock, onStart: pid => { counts.active = { kind, pid, startedAt: now() }; writeJson(path.join(run, 'observations.json'), counts); } });
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
      requireThat(pinned(state) === state.policySha256 && state.retries === 0 && !state.active, 'Infrastructure reconciliation requires intact policy and unused recovery');
      requireThat(state.status === 'BLOCKED_INFRASTRUCTURE' || (state.status === 'BLOCKED_CONTRACT' && state.failure?.message === 'reason?.startsWith is not a function' && state.usage.roleLaunches === 0), 'This verdict is not an infrastructure failure');
      const repair = readJson(repairFile);
      requireThat(repair.schema === 'paravoxia.chapterLoopInfrastructureRepair.v1' && repair.runId === state.id && repair.failureSha256 === sha(state.failure), 'Repair receipt belongs to a different failure');
      const current = snapshot(repo), changed = differences(state.acceptedSource, current);
      const listed = new Map(repair.files.map(r => [r.path, r]));
      for (const name of new Set([...changed, ...Object.keys(state.frozen).filter(n => sha(fs.readFileSync(inside(repo, n))) !== state.frozen[n])])) requireThat(listed.has(name), `Unlisted change during recovery: ${name}`);
      for (const [name, ref] of listed) {
        requireThat(!allowedPath(name, state.brief.allowedPaths) && name !== 'main/tools/chapter-loop/contract.mjs' && !name.startsWith('.claude/') && (name.startsWith('main/tools/chapter-loop') || state.brief.toolRefs.some(r => r.path === name)), 'Recovery may change capture/transport infrastructure only');
        requireThat(ref.before === (state.frozen[name] ?? state.acceptedSource[name] ?? null), `Repair before-hash mismatch: ${name}`);
        requireThat(sha(fs.readFileSync(inside(repo, name))) === ref.after, `Repair after-hash mismatch: ${name}`);
        if (state.frozen[name] || name.startsWith('main/tools/chapter-loop')) state.frozen[name] = ref.after;
      }
      requireThat(repair.validation?.passed === true && repair.validation.command === 'npm run chapter:loop:test', 'Repair needs relevant passing checks');
      state.acceptedSource = current; state.policySha256 = pinned(state); state.status = 'BLOCKED_INFRASTRUCTURE';
      state.infrastructureRepair = reference(repo, repairFile); event(run, 'infrastructure-reconciled', { receipt: state.infrastructureRepair, originalFailure: state.failure }); save(run, state);
    }
    requireThat(state.status === 'BLOCKED_INFRASTRUCTURE' && state.retries < state.limits.infrastructureRetries && !state.active, 'Only one diagnosed infrastructure recovery is available');
    assertState(repo, state); requireThat(!stopReason(run, state), 'No budget/authority remains');
    const started = Date.now(); state.retries++; state.active = { stage: 'infrastructure-recovery', startedAt: now(), pid: null }; save(run, state);
    const dir = path.join(run, 'recovery', String(state.retries)); fs.mkdirSync(dir, { recursive: true });
    const result = await command(state.brief.verification.recovery, { repo, directory: dir, variables: { repo, chapter: state.chapter, out: dir }, timeoutMs: remaining(state), shouldStop: () => stopReason(run, state, started), heavyLock: state.brief.heavyLock, onStart: pid => { state.active.pid = pid; save(run, state); } });
    state.activeMs += Date.now() - started; state.active = null; save(run, state); assertState(repo, state);
    state.status = result.exitCode === 0 && !result.reason ? 'RUNNING' : disposition(result.reason);
    event(run, 'infrastructure-recovery', { result, attempt: state.retries }); save(run, state); return handback(repo, run, state);
  } finally { unlock(); }
}
