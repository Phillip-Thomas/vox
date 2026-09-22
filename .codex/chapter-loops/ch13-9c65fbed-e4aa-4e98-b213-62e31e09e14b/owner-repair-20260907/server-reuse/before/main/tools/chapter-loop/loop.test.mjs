import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { VERSION, INITIAL, DEFAULT_LIMITS, limitsFor, emptyUsage, beginRole, advance, decision, validateResult, sha } from './contract.mjs';
import { inside, readJson, writeJson, reference, checkRef, snapshot } from './store.mjs';
import { usageTracker, providerCommand } from './providers.mjs';
import { runProcess } from './process.mjs';
import { initialize, runLoop, recover, observe } from './runner.mjs';
import { OBLIGATIONS, inspectReport, startPreview, verifyBundle } from './evidence.mjs';
import { continuation } from './continuation.mjs';
import { pauseProof, readManualProof } from './legacy-capture.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function fixture(t) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'chapter-loop-test-')); t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  execFileSync('git', ['init', '-q'], { cwd: repo });
  fs.mkdirSync(path.join(repo, 'main/src'), { recursive: true }); fs.writeFileSync(path.join(repo, 'main/src/game.js'), '// preserved dirty fixture\n');
  fs.mkdirSync(path.join(repo, 'docs'), { recursive: true }); fs.writeFileSync(path.join(repo, 'docs/canon.md'), 'Synthetic canon fixture only.\n');
  fs.writeFileSync(path.join(repo, '.gitignore'), '.codex/chapter-loops/\nmain/dist/\n');
  for (const name of ['main/tools/chapter-loop', '.claude/agents/chapter-loop']) fs.cpSync(path.join(root, name), path.join(repo, name), { recursive: true });
  fs.copyFileSync(path.join(root, 'main/tools/chapter-loop.mjs'), path.join(repo, 'main/tools/chapter-loop.mjs'));
  fs.mkdirSync(path.join(repo, 'main/tools/lib')); fs.copyFileSync(path.join(root, 'main/tools/lib/previewSnapshot.mjs'), path.join(repo, 'main/tools/lib/previewSnapshot.mjs'));
  const fixtureTool = path.join(repo, 'main/tools/synthetic-probe.mjs');
  fs.writeFileSync(fixtureTool, `import fs from 'node:fs'; import path from 'node:path';
const [kind, out, root] = process.argv.slice(2);
if(kind==='build'){fs.mkdirSync(path.join(root,'main/dist'),{recursive:true});fs.writeFileSync(path.join(root,'main/dist/index.html'),'<title>Paravoxia synthetic transport fixture</title>');}
else if(kind!=='recover') {fs.mkdirSync(out,{recursive:true});const report={schema:'synthetic.probe.v1',ordinaryControls:true,acceptedAction:1,completePath:true,interrupted:true,recovered:true,clickedContinue:true,stateEqual:true,newAcceptedAction:1,earnedEntry:true,earnedExit:true,noFixtures:true,videoDecodes:true,audioDecodes:true,framesNonblank:true,hardware:true,cleanup:true};
if(fs.existsSync(path.join(root,'FAIL_PROBE'))) report.stateEqual=false;
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report)); for(const n of ['video','audio','frame'])fs.writeFileSync(path.join(out,n+'.fixture'),'SYNTHETIC TEST ONLY');}
`);
  const cmd = kind => ({ argv: [process.execPath, 'main/tools/synthetic-probe.mjs', kind, '{out}', '{repo}'], cwd: '.', timeoutMs: 10_000 });
  const proof = kind => ({ ...cmd(kind), kind, report: 'report.json', schema: 'synthetic.probe.v1',
    assertions: Object.fromEntries([...(OBLIGATIONS[kind] ?? ['ordinaryControls', 'acceptedAction', 'completePath']), 'hardware', 'cleanup'].map(k => [k, { pointer: `/${k}`, ...(['acceptedAction', 'newAcceptedAction'].includes(k) ? { gte: 1 } : { equals: true }) }])),
    media: ['video', 'audio', 'frame'].map(kind => ({ kind, path: `${kind}.fixture` })) });
  const canon = reference(repo, path.join(repo, 'docs/canon.md'));
  const brief = { schema: 'paravoxia.chapterBrief.v1', chapter: 'ch99', request: 'Synthetic transport-only test. Never use this fixture as real chapter evidence.', authority: 'Test fixture authority only, no production work.',
    provider: { provider: 'claude', models: { creative: 'fixture', mechanical: 'fixture' } },
    canon: [{ ...canon, startLine: 1, endLine: 1 }], references: [canon, canon], allowedPaths: ['main/src/game.js'],
    toolRefs: [reference(repo, fixtureTool)], heavyLock: path.join(repo, '.test-heavy.lock'), previewQuery: { kind: 'diagnostic', query: '?synthetic=1' },
    verification: { build: cmd('build'), dist: 'main/dist', cases: Object.keys(OBLIGATIONS).map(proof), observe: { look: proof('look'), listen: proof('listen') }, recovery: cmd('recover') } };
  const briefFile = path.join(repo, 'brief.json'); writeJson(briefFile, brief);
  const providerFile = path.join(repo, 'synthetic-provider.mjs');
  fs.writeFileSync(providerFile, `import fs from 'node:fs';import path from 'node:path';import {createHash,randomUUID} from 'node:crypto';import {spawnSync} from 'node:child_process';
let input='';for await(const chunk of process.stdin)input+=chunk;const p=JSON.parse(input);const repo=process.env.TEST_REPO;const stage=p.stage.replace(/-final$/,'');const session=randomUUID();
const ref=file=>({path:path.relative(repo,file),sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')});
const emit=x=>console.log(JSON.stringify(x));emit({type:'system',subtype:'init',session_id:session,model:'synthetic-test-only'});
if(p.observe){const r=spawnSync(p.observe.command[0],p.observe.command.slice(1),{env:process.env,encoding:'utf8'});if(r.status!==0)throw Error(r.stderr);}
let result={schema:'paravoxia.chapterLoopRole.v1',summary:'Synthetic fixture only; validates runner transport, never artistic acceptance.',verdict:'PASS',evidence:[],findings:[],keep:['Preserve the synthetic baseline.']};
if(['plan','cinema','score-plan'].includes(stage)){result.direction={dramaticQuestion:'Synthetic question',playerActions:'Synthetic action',entryState:'Synthetic entry',exitState:'Synthetic exit',signatureMoment:'Synthetic moment'};result.anchors=['start','end'];}
if(stage==='council')result.acceptedRecipeSha256=p.recipeSha256;
if(stage==='player'){const f=path.join(p.outputDirectory,'attempt.json');fs.writeFileSync(f,JSON.stringify({schema:'paravoxia.blindPlayAttempt.v1',candidateSha256:p.playerEvidence.candidateSha256,ordinaryControls:true,acceptedActions:1,trace:['SYNTHETIC TEST ONLY'],cleanup:true}));result.playAttempt=ref(f);result.evidence=[ref(f)];result.candidateSha256=p.playerEvidence.candidateSha256;result.scores={discoverability:4,agency:4,recovery:4};}
if(stage==='av'){result.evidence=[p.avEvidence.media[0]];result.candidateSha256=p.avEvidence.candidateSha256;result.scores={composition:4,motion:4,music:4,cohesion:4};}
if(stage==='canon'){result.evidence=[p.evidence.artifacts[0]];result.candidateSha256=p.evidence.candidateSha256;result.scores={causality:4,characterKnowledge:4,continuity:4};}
if(stage==='player'&&process.env.TEST_REVISE==='1'){result.verdict='REVISE';result.scores.recovery=2;result.findings=[{severity:'major',description:'Synthetic revision request for state-machine testing only.',evidence:result.evidence}];}
if(stage==='build'&&process.env.TEST_ESCAPE==='1')fs.writeFileSync(path.join(repo,'main/src/outside.js'),'unauthorized fixture');
emit({type:'result',session_id:session,num_turns:1,usage:{input_tokens:7,cache_creation_input_tokens:3,cache_read_input_tokens:20,output_tokens:40},result:JSON.stringify(result)});
`);
  const hooks = extra => ({ runProcess: (_command, _args, options) => runProcess(process.execPath, [providerFile], { ...options, env: { ...options.env, TEST_REPO: repo, ...extra } }) });
  return { repo, briefFile, brief, hooks, init: overrides => initialize(repo, briefFile, overrides) };
}

test('numeric caps, fixed stage order, and one refinement are enforced', () => {
  assert.throws(() => limitsFor({ roleLaunches: 15 }), /cannot exceed/); assert.throws(() => limitsFor({ outputTokens: 0 }), /positive/);
  const state = { status: 'RUNNING', queue: [...INITIAL], cursor: 0, limits: DEFAULT_LIMITS, usage: emptyUsage(), activeMs: 0 };
  assert.throws(() => beginRole(state, 'build'), /Out-of-order/); beginRole(state, 'plan'); assert.equal(state.usage.roleLaunches, 1); advance(state, 'plan');
  const revise = [{ verdict: 'REVISE', findings: [], keep: ['one'] }]; decision(state, revise); assert.equal(state.refinementUsed, true);
  assert.throws(() => decision(state, revise), /cannot reopen/); decision(state, revise, true); assert.equal(state.status, 'NEEDS_REVISION');
});
test('source references reject byte changes and escaping symlinks', t => {
  const f = fixture(t); const ref = f.brief.canon[0]; fs.appendFileSync(path.join(f.repo, ref.path), 'changed'); assert.throws(() => checkRef(f.repo, ref), /changed/);
  fs.symlinkSync(os.tmpdir(), path.join(f.repo, 'escape')); assert.throws(() => inside(f.repo, 'escape/file', { exists: false }), /Symlink/);
  assert.throws(() => inside(f.repo, '../outside'), /escapes/);
});
test('Claude telemetry reconciles usage without double counting or reducing it', () => {
  const t = usageTracker('claude');
  t.ingest(JSON.stringify({ type: 'assistant', message: { id: 'm', usage: { input_tokens: 10, cache_read_input_tokens: 20, output_tokens: 30 }, content: [] } }));
  t.ingest(JSON.stringify({ type: 'result', num_turns: 1, usage: { input_tokens: 10, cache_read_input_tokens: 20, output_tokens: 25 }, result: '{}' }));
  assert.deepEqual(t.result().usage, { roleLaunches: 0, modelTurns: 1, inputTokens: 10, cacheReadTokens: 20, outputTokens: 30 });
});
test('Codex usage separates cached input and requires terminal telemetry', () => {
  const t = usageTracker('codex'); t.ingest('{"type":"thread.started","thread_id":"fresh"}'); t.ingest('{"type":"item.completed","item":{"type":"agent_message","text":"{}"}}');
  assert.equal(t.result().reported, false); t.ingest('{"type":"turn.completed","usage":{"input_tokens":100,"cached_input_tokens":70,"output_tokens":5}}');
  assert.equal(t.result().usage.inputTokens, 30); assert.equal(t.result().usage.cacheReadTokens, 70); assert.equal(t.result().completed, true);
});
test('provider bindings give blind roles fresh writable evidence cwd without project instructions', () => {
  const spec = providerCommand({ provider: 'codex', models: { mechanical: 'explicit-model' } }, { role: { lane: 'mechanical', blind: true }, system: 'fixed commission', prompt: '{}', output: '/tmp/result', remainingTurns: 60 });
  assert.equal(spec.args[spec.args.indexOf('--sandbox') + 1], 'workspace-write'); assert.ok(spec.args.includes('project_doc_max_bytes=0')); assert.ok(spec.args.includes('--ephemeral'));
});
test('pause click alone cannot prove recovery; actual resumed UI and cleanup are required', () => {
  const summary = { headed: true, renderer: 'ANGLE NVIDIA GB10' };
  const runtime = { cleanupComplete: true, defaultSinkUnchanged: true };
  const seam = { attach: { pause: { pressedAtMono: 100, before: { at: 90 }, afterSettle: { at: 120, paused: true }, resumeClicked: false } }, events: { ev: [{ k: 'cancel', mono: 95, reasonArgObservable: true }] } };
  const paused = pauseProof(summary, seam, runtime); assert.equal(paused.interrupted, true); assert.equal(paused.recovered, false); assert.equal(paused.available, false);
  Object.assign(seam.attach.pause, { resumeClicked: true, resumed: { paused: false, resumeVisible: false, pauseButtonPresent: true } });
  const recovered = pauseProof(summary, seam, runtime); assert.equal(recovered.recovered, true); assert.equal(recovered.cancellationObserved, true);
  assert.equal(pauseProof(summary, seam, { ...runtime, cleanupComplete: false }).cleanup, false);
});
test('manual adapter reads embedded post-finally cleanup without a separate receipt', t => {
  const raw = fs.mkdtempSync(path.join(os.tmpdir(), 'chapter-manual-'));
  t.after(() => fs.rmSync(raw, { recursive: true, force: true }));
  const summary = { schema: 'paravoxia.verifier.commonPhysicalDiscriminator.v1', headed: true, renderer: 'ANGLE NVIDIA GB10',
    lane: 'MANUAL SHORT', verdict: 'SHORT-HELD-REFERENCE-PROVEN', finalCg: { common: { committed: true, workerUnits: 18 } }, closing: { ok: true },
    cleanup: { schema: 'paravoxia.verifier.ownedSessionGuard.v1', phase: 'post-finally', state: 'stopped', cleanupCompleted: true, sessionStopped: true, cleanupError: null } };
  const check = value => { writeJson(path.join(raw, 'summary.json'), value); return readManualProof(raw); };
  assert.deepEqual(check(summary), { hardware: true, cleanup: true, ordinaryControls: true, acceptedAction: 1 });
  assert.equal(fs.existsSync(path.join(raw, 'cleanup-receipt.json')), false);
  assert.throws(() => check({ ...summary, cleanup: undefined }), /cleanup evidence is missing/);
  assert.throws(() => check({ ...summary, cleanup: { ...summary.cleanup, phase: 'pre-finally' } }), /cleanup evidence is missing/);
  for (const patch of [{ sessionStopped: false }, { cleanupCompleted: false }, { cleanupError: 'stop failed' }]) {
    assert.throws(() => check({ ...summary, cleanup: { ...summary.cleanup, ...patch } }), /cleanup or closing checks failed/);
  }
  assert.throws(() => check({ ...summary, closing: { ok: false } }), /closing checks failed/);
  assert.equal(check({ ...summary, verdict: 'ERROR' }).acceptedAction, 0);
  assert.equal(check({ ...summary, renderer: 'NVIDIA via SwiftShader' }).hardware, false);
});
test('legacy migration requires renewed authority and retains signed directions and old spend', t => {
  const f = fixture(t); const dir = path.join(f.repo, 'legacy'); fs.mkdirSync(dir);
  const put = (name, data) => { const file = path.join(dir, name); writeJson(file, data); return reference(f.repo, file); };
  const contract = put('contract.json', { status: 'frozen', story: { purpose: 'existing approved purpose' }, cinematography: {}, score: {}, palette: {}, syncAnchors: [{ id: 'anchor' }], scope: { title: 'Existing chapter', beats: ['ch99'] } });
  const signoffs = ['chapter', 'score', 'cinema'].map(director => put(`${director}.json`, { director, contractSha256: contract.sha256, disposition: 'approve' }));
  const sourceManifest = put('source.json', { contractSha256: contract.sha256, hashes: { 'main/src/game.js': sha(fs.readFileSync(path.join(f.repo, 'main/src/game.js'))) } });
  const priorUsage = put('usage.json', { scope: 'historical fixture', totals: { turns: 5246, cacheRead: 570758839 } });
  const authority = put('authority.json', { schema: 'paravoxia.chapterLoopResumeAuthority.v1', chapter: 'ch99', instruction: 'now continue using this new workflow', resume: true, newBoundedAllowance: true });
  const brief = { ...f.brief, continuation: { contract, signoffs, sourceManifest, priorUsage, authority } };
  const imported = continuation(f.repo, brief); assert.equal(imported.prior.usage.turns, 5246); assert.equal(imported.recipe.lanes.plan.purpose, 'existing approved purpose');
  writeJson(f.briefFile, brief); const run = f.init(); const state = readJson(path.join(run, 'state.json')); assert.equal(state.queue[0], 'verify'); assert.equal(state.usage.roleLaunches, 0); assert.equal(state.priorSpend.usage.cacheRead, 570758839);
  const revoked = readJson(path.join(dir, 'authority.json')); revoked.resume = false; const badRef = put('revoked.json', revoked);
  assert.throws(() => continuation(f.repo, { ...brief, continuation: { ...brief.continuation, authority: badRef } }), /does not infer/);
});
test('full subprocess fixture reaches handback with cumulative budgets; second init is refused', async t => {
  const f = fixture(t), run = f.init(); const result = await runLoop(f.repo, run, f.hooks());
  assert.equal(result.status, 'READY_FOR_REVIEW', JSON.stringify(result.failure)); assert.equal(result.spent.roleLaunches, 9); assert.equal(result.spent.inputTokens, 90);
  assert.equal(result.preview.live, false); assert.ok(result.evidence.sha256); assert.equal(readJson(path.join(run, 'observations.json')).look, 1);
  assert.throws(() => f.init(), /already has a checkpoint/);
  const resumed = await runLoop(f.repo, run, f.hooks()); assert.deepEqual(resumed.spent, result.spent);
});
test('fresh final judges cannot reopen a second refinement', async t => {
  const f = fixture(t), run = f.init(); const result = await runLoop(f.repo, run, f.hooks({ TEST_REVISE: '1' }));
  assert.equal(result.status, 'NEEDS_REVISION', JSON.stringify(result.failure)); assert.equal(result.spent.roleLaunches, 13);
  const state = readJson(path.join(run, 'state.json')); assert.equal(new Set(state.sessions).size, 13); assert.equal(state.queue.filter(x => x === 'refine').length, 1);
});
test('busy player GPU lock parks without spending a model launch or replaying completed roles', async t => {
  const f = fixture(t), run = f.init(); const base = f.hooks();
  const parked = await runLoop(f.repo, run, { runProcess: (cmd, args, options) => JSON.parse(options.input).stage === 'player' ? Promise.resolve({ exitCode: 75 }) : base.runProcess(cmd, args, options) });
  assert.equal(parked.status, 'WAITING_RESOURCE', JSON.stringify(parked.failure)); assert.equal(parked.spent.roleLaunches, 6);
  const done = await runLoop(f.repo, run, f.hooks()); assert.equal(done.status, 'READY_FOR_REVIEW', JSON.stringify(done.failure)); assert.equal(done.spent.roleLaunches, 9);
  const bundle = readJson(checkRef(f.repo, done.evidence)); fs.appendFileSync(path.join(f.repo, bundle.dist, 'index.html'), 'stale archive'); assert.throws(() => verifyBundle(f.repo, bundle), /build changed/);
});
test('budget exhaustion is terminal and cannot reset on resume', async t => {
  const f = fixture(t), run = f.init({ roleLaunches: 1 }); const result = await runLoop(f.repo, run, f.hooks());
  assert.equal(result.status, 'BUDGET_EXHAUSTED'); assert.equal(result.spent.roleLaunches, 1);
  assert.deepEqual((await runLoop(f.repo, run, f.hooks())).spent, result.spent);
  await assert.rejects(recover(f.repo, run), /Only one diagnosed/);
});
test('stop is honored before dispatch and unused observation tickets fail', async t => {
  const f = fixture(t), run = f.init(); await assert.rejects(observe(f.repo, run, 'look'), /active owning/);
  fs.writeFileSync(path.join(run, 'STOP'), 'owner'); const result = await runLoop(f.repo, run, f.hooks()); assert.equal(result.status, 'STOPPED'); assert.equal(result.spent.roleLaunches, 0);
});
test('a source edit outside role ownership blocks without reverting dirty work', async t => {
  const f = fixture(t), run = f.init(); const before = fs.readFileSync(path.join(f.repo, 'main/src/game.js'), 'utf8');
  const result = await runLoop(f.repo, run, f.hooks({ TEST_ESCAPE: '1' })); assert.equal(result.status, 'BLOCKED_CONTRACT'); assert.match(result.failure.message, /source edits/);
  assert.equal(fs.readFileSync(path.join(f.repo, 'main/src/game.js'), 'utf8'), before); assert.ok(fs.existsSync(path.join(f.repo, 'main/src/outside.js')));
});
test('missing usage fails closed; no unmetered retry is permitted', async t => {
  const f = fixture(t), run = f.init(); const result = await runLoop(f.repo, run, { runProcess: async () => ({ exitCode: 0 }) });
  assert.equal(result.status, 'BLOCKED_CONTRACT'); assert.match(result.failure.message, /accounting/); await assert.rejects(recover(f.repo, run), /Only one/);
});
test('ordinary probe errors retain infrastructure classification and close the owned preview', async t => {
  const f = fixture(t); f.brief.verification.cases[0].argv = [process.execPath, '-e', 'process.exit(2)']; writeJson(f.briefFile, f.brief);
  const run = f.init(); const result = await runLoop(f.repo, run, f.hooks()); assert.equal(result.status, 'BLOCKED_INFRASTRUCTURE', JSON.stringify(result.failure));
  assert.equal(result.failure.classification, 'PROBE_ERROR_INCONCLUSIVE'); assert.equal(result.preview.live, false);
  await new Promise(resolve => setTimeout(resolve, 100)); assert.throws(() => process.kill(result.preview.pid, 0), /ESRCH/);
});
test('first playable deadline and interrupted dispatch cannot be evaded by resume', async t => {
  const f = fixture(t), run = f.init(); let state = readJson(path.join(run, 'state.json')); state.activeMs = state.limits.firstPlayableMs; writeJson(path.join(run, 'state.json'), state);
  assert.equal((await runLoop(f.repo, run, f.hooks())).status, 'BUDGET_EXHAUSTED');
  // A separate fixture simulates an actual interrupted checkpoint, not a reset.
  const g = fixture(t), other = g.init(); state = readJson(path.join(other, 'state.json')); state.active = { stage: 'plan', pid: null, startedAt: new Date(Date.now() - 500).toISOString() }; writeJson(path.join(other, 'state.json'), state);
  const result = await runLoop(g.repo, other, g.hooks()); assert.equal(result.status, 'BLOCKED_CONTRACT'); assert.ok(result.spent.activeMs >= 500); assert.equal(result.spent.roleLaunches, 0);
});
test('one corrected infrastructure recovery retains spend and cannot repeat', async t => {
  const f = fixture(t), run = f.init(); let first = true;
  const base = f.hooks();
  const result = await runLoop(f.repo, run, { runProcess: (...args) => {
    if (first) { first = false; return Promise.resolve({ exitCode: null, error: 'spawn claude ENOENT', bytes: 0 }); }
    return base.runProcess(...args);
  } });
  assert.equal(result.status, 'BLOCKED_INFRASTRUCTURE'); assert.equal(result.spent.roleLaunches, 1);
  const ready = await recover(f.repo, run); assert.equal(ready.status, 'RUNNING'); assert.equal(ready.spent.roleLaunches, 1);
  const done = await runLoop(f.repo, run, f.hooks()); assert.equal(done.status, 'READY_FOR_REVIEW', JSON.stringify(done.failure)); assert.equal(done.spent.roleLaunches, 10);
  await assert.rejects(recover(f.repo, run), /Only one diagnosed/);
});
test('audited transport repair updates only recorded hashes and consumes the existing recovery', async t => {
  const f = fixture(t), run = f.init(); const file = path.join(run, 'state.json'); const state = readJson(file);
  state.status = 'BLOCKED_CONTRACT'; state.failure = { message: 'reason?.startsWith is not a function' }; writeJson(file, state);
  const name = 'main/tools/chapter-loop/runner.mjs'; fs.appendFileSync(path.join(f.repo, name), '\n// synthetic infrastructure correction\n');
  const receiptFile = path.join(run, 'repair.json'); writeJson(receiptFile, { schema: 'paravoxia.chapterLoopInfrastructureRepair.v1', runId: state.id, failureSha256: sha(state.failure),
    files: [{ path: name, before: state.frozen[name], after: sha(fs.readFileSync(path.join(f.repo, name))) }], validation: { passed: true, command: 'npm run chapter:loop:test' } });
  const result = await recover(f.repo, run, receiptFile); assert.equal(result.status, 'RUNNING'); const after = readJson(file); assert.equal(after.retries, 1); assert.deepEqual(after.limits, state.limits); assert.deepEqual(after.usage, state.usage);
  await assert.rejects(recover(f.repo, run, receiptFile), /not an infrastructure failure|unused recovery/);
});
test('explicit owner repair grants one recovery for this failure and retains existing budgets', async t => {
  const f = fixture(t), run = f.init(), stateFile = path.join(run, 'state.json');
  const state = readJson(stateFile); state.status = 'BLOCKED_INFRASTRUCTURE'; state.retries = 1;
  state.failure = { stage: 'verify', message: 'Synthetic manual normalization failure' }; writeJson(stateFile, state);
  const name = 'main/tools/chapter-loop/legacy-capture.mjs'; fs.appendFileSync(path.join(f.repo, name), '\n// synthetic repair\n');
  const repair = { schema: 'paravoxia.chapterLoopInfrastructureRepair.v1', runId: state.id, failureSha256: sha(state.failure),
    files: [{ path: name, before: state.frozen[name], after: sha(fs.readFileSync(path.join(f.repo, name))) }], validation: { passed: true, command: 'npm run chapter:loop:test' } };
  const receipt = path.join(run, 'repair.json'); writeJson(receipt, repair);
  await assert.rejects(recover(f.repo, run, receipt), /unused recovery/);
  const authorityFile = path.join(run, 'owner.json');
  const authority = { schema: 'paravoxia.chapterLoopOwnerRepair.v1', runId: state.id, failureSha256: 'wrong', request: 'Synthetic explicit owner repair request', extraInfrastructureRetries: 1 };
  writeJson(authorityFile, authority); repair.ownerAuthorization = reference(f.repo, authorityFile); writeJson(receipt, repair);
  await assert.rejects(recover(f.repo, run, receipt), /Renewed owner repair authority/);
  authority.failureSha256 = sha(state.failure); writeJson(authorityFile, authority); repair.ownerAuthorization = reference(f.repo, authorityFile); writeJson(receipt, repair);
  const result = await recover(f.repo, run, receipt); assert.equal(result.status, 'RUNNING');
  const after = readJson(stateFile); assert.equal(after.id, state.id); assert.equal(after.retries, 2);
  assert.equal(after.ownerRecoveries.length, 1); assert.deepEqual(after.limits, state.limits); assert.deepEqual(after.usage, state.usage);
  assert.ok(after.activeMs >= state.activeMs);
  after.status = 'BLOCKED_INFRASTRUCTURE'; writeJson(stateFile, after);
  await assert.rejects(recover(f.repo, run, receipt), /replay a failure/);
  await assert.rejects(recover(f.repo, run), /Only one diagnosed/);
});
test('missing probe report is inconclusive while a measured Continue failure gets one refinement', async t => {
  const f = fixture(t); const c = f.brief.verification.cases.find(x => x.kind === 'continue');
  const dir = path.join(f.repo, 'raw'); fs.mkdirSync(dir);
  assert.throws(() => inspectReport(c, dir), /Missing artifact/);
  fs.writeFileSync(path.join(f.repo, 'FAIL_PROBE'), 'synthetic failure'); const run = f.init();
  const result = await runLoop(f.repo, run, f.hooks()); assert.equal(result.status, 'NEEDS_REVISION', JSON.stringify(result.failure));
  const state = readJson(path.join(run, 'state.json')); assert.equal(state.refinementUsed, true); assert.equal(state.queue.filter(x => x === 'refine').length, 1);
  const bundle = readJson(checkRef(f.repo, state.receipts.evidence)); assert.equal(bundle.cases.find(x => x.kind === 'continue').passed, false);
});
test('changed frozen policy and stale candidate reviews fail closed', async t => {
  const f = fixture(t), run = f.init(); const state = readJson(path.join(run, 'state.json')); state.limits.roleLaunches++; writeJson(path.join(run, 'state.json'), state);
  assert.equal((await runLoop(f.repo, run, f.hooks())).status, 'BLOCKED_CONTRACT');
  assert.throws(() => validateResult('av', { schema: 'paravoxia.chapterLoopRole.v1', summary: 'Actual candidate mismatch.', verdict: 'PASS', evidence: [f.brief.references[0]], findings: [], keep: [], candidateSha256: 'old' }, { candidate: 'new' }), /another candidate/);
});
test('timeout kills only the owned child group and preserves the timeout cause', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chapter-process-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const result = await runProcess(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { cwd: dir, log: path.join(dir, 'log'), timeoutMs: 80 });
  assert.equal(result.reason, 'deadline'); assert.throws(() => process.kill(result.pid, 0), /ESRCH/);
});
test('preview serves the archive, detects source bytes changed, and closes its own server', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chapter-preview-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const dist = path.join(dir, 'dist'); fs.mkdirSync(dist); fs.writeFileSync(path.join(dist, 'index.html'), '<title>Paravoxia</title>');
  const preview = await startPreview(dist, path.join(dir, 'log')); t.after(preview.close);
  assert.match(await (await fetch(preview.url)).text(), /Paravoxia/); fs.appendFileSync(path.join(dist, 'index.html'), 'changed'); await assert.rejects(preview.verify(), /changed/);
});
