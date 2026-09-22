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
import { initialize, runLoop, recover, observe, verify, preflight, validateBrief, policySeal, dispatch } from './runner.mjs';
import { adoptAdaptiveBudget } from './adaptive-budget.mjs';
import { continueComposition } from './composition-continuation.mjs';
import { prepareRenewal, renewVerification } from './renewal.mjs';
import { prepareProviderHandoff, handoffProvider } from './provider-handoff.mjs';
import { OBLIGATIONS, validateVerification, inspectReport, startPreview, verifyBundle } from './evidence.mjs';
import { continuation } from './continuation.mjs';
import { pauseProof, readManualProof } from './legacy-capture.mjs';
import { beginChapter, elapsedClock, firstPlayableDeadline, MAX_CHAPTER_MS, budgetGuidance, commandDeadline } from './budget.mjs';
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
fs.appendFileSync(path.join(root,'commands.jsonl'),JSON.stringify({kind,out})+'\\n');
if(fs.existsSync(path.join(root,'FAIL_CASE_'+kind)))process.exit(2);
if(kind==='preflight'){fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'capabilities.json'),JSON.stringify({schema:'paravoxia.runtimeCaptureCapabilities.v1',supported:!fs.existsSync(path.join(root,'MISSING_CAPABILITY')),sourceIdentity:true,config:{chapter:fs.existsSync(path.join(root,'WRONG_CHAPTER'))?'ch98':'ch99'},route:{chapter:'ch99'},bindings:{manual:true,recovery:true,continue:true,continuity:true,av:true}}));}
else if(kind==='build'){fs.mkdirSync(path.join(root,'main/dist'),{recursive:true});fs.writeFileSync(path.join(root,'main/dist/index.html'),'<title>Paravoxia synthetic transport fixture</title>');}
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
    budgetPolicy: { mode: 'strict' },
    provider: { provider: 'claude', models: { creative: 'fixture', mechanical: 'fixture' } },
    canon: [{ ...canon, startLine: 1, endLine: 1 }], references: [canon, canon], allowedPaths: ['main/src/game.js'],
    toolRefs: [reference(repo, fixtureTool)], heavyLock: path.join(repo, '.test-heavy.lock'), previewQuery: { kind: 'diagnostic', query: '?synthetic=1' },
    verification: { preflight: cmd('preflight'), build: cmd('build'), dist: 'main/dist', cases: Object.keys(OBLIGATIONS).map(proof), observe: { look: proof('look'), listen: proof('listen') }, recovery: cmd('recover') } };
  const briefFile = path.join(repo, 'brief.json'); writeJson(briefFile, brief);
  const providerFile = path.join(repo, 'synthetic-provider.mjs');
  fs.writeFileSync(providerFile, `import fs from 'node:fs';import path from 'node:path';import {createHash,randomUUID} from 'node:crypto';import {spawnSync} from 'node:child_process';
let input='';for await(const chunk of process.stdin)input+=chunk;const p=JSON.parse(input);const repo=process.env.TEST_REPO;const stage=p.stage.replace(/-final$/,'');const session=randomUUID();
if(process.env.TEST_OVERLAP==='1'&&['cinema','score-plan','player','av','canon'].includes(stage)){fs.appendFileSync(path.join(repo,'overlap.jsonl'),JSON.stringify({stage,event:'start',at:Date.now()})+'\\n');await new Promise(r=>setTimeout(r,200));fs.appendFileSync(path.join(repo,'overlap.jsonl'),JSON.stringify({stage,event:'end',at:Date.now()})+'\\n');}
const ref=file=>({path:path.relative(repo,file),sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')});
const emit=x=>console.log(JSON.stringify(x));emit({type:'system',subtype:'init',session_id:session,model:'synthetic-test-only'});
if(p.observe){for(let i=0;i<(process.env.TEST_REPEAT_OBSERVE==='1'?2:1);i++){const r=spawnSync(p.observe.command[0],p.observe.command.slice(1),{env:process.env,encoding:'utf8'});if(r.status!==0)throw Error(r.stderr);}}
let result={schema:'paravoxia.chapterLoopRole.v1',summary:'Synthetic fixture only; validates runner transport, never artistic acceptance.',verdict:'PASS',evidence:[],findings:[],keep:['Preserve the synthetic baseline.']};
if(['plan','cinema','score-plan'].includes(stage)){result.direction={dramaticQuestion:'Synthetic question',playerActions:'Synthetic action',entryState:'Synthetic entry',exitState:'Synthetic exit',signatureMoment:'Synthetic moment'};result.anchors=['start','end'];}
if(stage==='council')result.acceptedRecipeSha256=p.recipeSha256;
if(stage==='player'){const f=path.join(p.outputDirectory,'attempt.json');fs.writeFileSync(f,JSON.stringify({schema:'paravoxia.blindPlayAttempt.v1',candidateSha256:p.playerEvidence.candidateSha256,ordinaryControls:true,acceptedActions:1,trace:['SYNTHETIC TEST ONLY'],cleanup:true}));result.playAttempt=ref(f);result.evidence=[ref(f)];result.candidateSha256=p.playerEvidence.candidateSha256;result.scores={discoverability:4,agency:4,recovery:4};}
if(stage==='av'){result.evidence=[p.avEvidence.media[0]];result.candidateSha256=p.avEvidence.candidateSha256;result.scores={composition:4,motion:4,music:4,cohesion:4};}
if(stage==='canon'){result.evidence=[p.evidence.artifacts[0]];result.candidateSha256=p.evidence.candidateSha256;result.scores={causality:4,characterKnowledge:4,continuity:4};}
if(stage==='player'&&process.env.TEST_REVISE==='1'){result.verdict='REVISE';result.scores.recovery=2;result.findings=[{severity:'major',description:'Synthetic revision request for state-machine testing only.',evidence:result.evidence}];}
if(stage==='compose'&&process.env.TEST_COMPOSE_REVISE==='1'){result.verdict='REVISE';result.evidence=[ref(path.join(p.outputDirectory,'packet.json'))];result.findings=[{severity:'major',description:'Synthetic composer revision for state-machine testing only.',evidence:result.evidence}];}
if(stage==='refine'&&process.env.TEST_REFINE_REVISE==='1'){result.verdict='REVISE';result.evidence=[ref(path.join(p.outputDirectory,'packet.json'))];result.findings=[{severity:'major',description:'Synthetic refinement awaiting final runtime verification.',evidence:result.evidence}];}
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
  writeJson(f.briefFile, brief); const run = f.init(); const state = readJson(path.join(run, 'state.json')); assert.deepEqual(state.queue.slice(0,2), ['preflight','verify']); assert.equal(state.usage.roleLaunches, 0); assert.equal(state.priorSpend.usage.cacheRead, 570758839);
  const revoked = readJson(path.join(dir, 'authority.json')); revoked.resume = false; const badRef = put('revoked.json', revoked);
  assert.throws(() => continuation(f.repo, { ...brief, continuation: { ...brief.continuation, authority: badRef } }), /does not infer/);
});
function renewalFixture(t) {
  const f = fixture(t);
  const put = (name, data) => { const file = path.join(f.repo, 'renewal-inputs', name); writeJson(file, data); return reference(f.repo, file); };
  const contract = put('contract.json', { status: 'frozen', story: {}, cinematography: {}, score: {}, palette: {}, syncAnchors: [{ id: 'entry' }], scope: { title: 'Existing', beats: ['ch99'] } });
  const signoffs = ['chapter', 'score', 'cinema'].map(director => put(`${director}.json`, { director, contractSha256: contract.sha256, disposition: 'approve' }));
  const sourceManifest = put('source.json', { contractSha256: contract.sha256, hashes: { 'main/src/game.js': sha(fs.readFileSync(path.join(f.repo, 'main/src/game.js'))) } });
  const priorUsage = put('prior.json', { totals: { turns: 50 } });
  const authority = put('old-owner.json', { schema: 'paravoxia.chapterLoopResumeAuthority.v1', chapter: 'ch99', instruction: 'now continue using this new workflow', resume: true, newBoundedAllowance: true });
  const brief = { ...f.brief, provider: { ...f.brief.provider, permissionMode: 'full' }, continuation: { contract, signoffs, sourceManifest, priorUsage, authority } };
  writeJson(f.briefFile, brief); const run = f.init(); const state = readJson(path.join(run, 'state.json'));
  state.createdAt = new Date(Date.now() - 2 * MAX_CHAPTER_MS).toISOString(); delete state.clock;
  state.queue.shift(); state.status = 'BLOCKED_INFRASTRUCTURE'; state.failure = { stage: 'verify', message: 'Retained fixture fault' };
  state.activeMs = 500; state.usage.inputTokens = 77; state.retries = 2;
  state.policySha256 = policySeal(state); writeJson(path.join(run, 'state.json'), state);
  const requestedAt = new Date(Date.now() - 1000).toISOString();
  const a = { schema: 'paravoxia.chapterLoopRenewalAuthority.v1', chapter: state.chapter, runId: state.id,
    request: 'do it all', explicitNewCommission: true, resumeVerification: true, extraInfrastructureRetries: 1,
    previousPolicySha256: state.policySha256, previousStateSha256: sha(state), requestedAt,
    deadlineAt: new Date(Date.parse(requestedAt) + MAX_CHAPTER_MS).toISOString(), briefSha256: sha(brief),
    recipeSha256: state.receipts.recipe.sha256, files: [], validation: put('checks.json', { passed: true, checks: ['synthetic fixture only'], handoffSha256: sha([]) }) };
  const helpers = { validateBrief, policySeal };
  return { ...f, state, run, a, brief, helpers, put };
}
test('explicit verification renewal archives exact bytes, keeps index and all spent counters', t => {
  const f = renewalFixture(t), before = fs.readFileSync(path.join(f.run, 'state.json'));
  const index = fs.readFileSync(path.join(f.repo, '.codex/chapter-loops/chapters.json'));
  const ar = f.put('new-owner.json', f.a), br = f.put('new-brief.json', f.brief);
  const result = renewVerification(f.repo, f.run, inside(f.repo, ar.path), inside(f.repo, br.path), f.helpers);
  const next = readJson(path.join(f.run, 'state.json'));
  assert.deepEqual(fs.readFileSync(inside(f.repo, result.renewal.previousState.path)), before);
  assert.deepEqual(fs.readFileSync(path.join(f.repo, '.codex/chapter-loops/chapters.json')), index);
  for (const key of ['id', 'createdAt', 'usage', 'activeMs', 'priorSpend', 'receipts', 'retries']) assert.deepEqual(next[key], f.state[key]);
  assert.deepEqual(next.queue, ['preflight', ...f.state.queue]);
  assert.equal(next.clock.startedAt, f.a.requestedAt); assert.equal(policySeal(next), next.policySha256);
  assert.throws(() => renewVerification(f.repo, f.run, inside(f.repo, ar.path), inside(f.repo, br.path), f.helpers), /unreplayed/);
});
test('verification renewal refuses missing authority, fake clock extension and another chapter', t => {
  const f = renewalFixture(t);
  for (const patch of [{ request: 'routine retry' }, { runId: 'another-run' }, { explicitNewCommission: false }, { deadlineAt: new Date(Date.parse(f.a.deadlineAt) + 1).toISOString() }]) {
    assert.throws(() => prepareRenewal(f.repo, f.state, { ...f.a, ...patch }, f.brief, f.helpers), /renewal|deadline/);
  }
});
test('verification renewal refuses changed recipe, unlisted source edits and completed role replay', t => {
  const f = renewalFixture(t);
  assert.throws(() => prepareRenewal(f.repo, f.state, { ...f.a, recipeSha256: '0'.repeat(64) }, f.brief, f.helpers), /recipe/);
  fs.writeFileSync(path.join(f.repo, 'main/src/foreign.js'), 'unowned');
  assert.throws(() => prepareRenewal(f.repo, f.state, f.a, f.brief, f.helpers), /Unlisted/);
  assert.throws(() => prepareRenewal(f.repo, { ...f.state, cursor: 1 }, f.a, f.brief, f.helpers), /unreplayed/);
});
function providerHandoffFixture(t) {
  const f=fixture(t),run=f.init(),state=readJson(path.join(run,'state.json'));
  state.status='BLOCKED_INFRASTRUCTURE';state.cursor=1;state.usage.roleLaunches=1;state.usage.modelTurns=1;
  state.failure={stage:'plan',at:new Date(Date.now()-5000).toISOString(),message:'Provider process failed'};
  state.activeMs=2300;writeJson(path.join(run,'state.json'),state);
  const put=(name,data)=>{const file=path.join(run,name);writeJson(file,data);return reference(f.repo,file);};
  const transport=put('quota-transport.json',{session:'quota-session',reported:true,completed:false,failed:true,requestedModel:'fixture'});
  const result={type:'result',session_id:'quota-session',is_error:true,api_error_status:429,usage:{input_tokens:0,output_tokens:0,cache_read_input_tokens:0,cache_creation_input_tokens:0}};
  const transcriptFile=path.join(run,'quota-transcript.jsonl');
  fs.writeFileSync(transcriptFile,JSON.stringify(result)+'\n');
  const transcript=reference(f.repo,transcriptFile);
  const a={schema:'paravoxia.chapterProviderHandoffAuthority.v1',runId:state.id,request:'RUN THAT BITCH',resume:true,
    previousStateSha256:sha(state),requestedAt:new Date(Date.now()-1000).toISOString(),transport,transcript,
    provider:{provider:'codex',permissionMode:'full',models:{creative:'gpt-6-astra',mechanical:'gpt-5.6-sol'}},
    files:[],validation:put('handoff-check.json',{passed:true,handoffSha256:sha([]),synthetic:true})};
  return {...f,run,state,a,put};
}
test('owner provider handoff preserves clock, index, spend and exact rejected checkpoint',t=>{
  const f=providerHandoffFixture(t),before=fs.readFileSync(path.join(f.run,'state.json'));
  const index=fs.readFileSync(path.join(f.repo,'.codex/chapter-loops/chapters.json'));
  const ar=f.put('owner-handoff.json',f.a);
  const result=handoffProvider(f.repo,f.run,inside(f.repo,ar.path),{policySeal});
  const next=readJson(path.join(f.run,'state.json'));
  assert.deepEqual(fs.readFileSync(inside(f.repo,next.providerHandoffs[0].previousState.path)),before);
  assert.deepEqual(fs.readFileSync(path.join(f.repo,'.codex/chapter-loops/chapters.json')),index);
  for(const k of ['id','createdAt','clock','limits','usage','activeMs','cursor','queue','receipts'])assert.deepEqual(next[k],f.state[k]);
  assert.equal(next.retries,f.state.retries+1);assert.equal(policySeal(next),next.policySha256);
  assert.equal(firstPlayableDeadline(next),Date.parse(result.firstPlayableDeadlineAt));
  assert.throws(()=>handoffProvider(f.repo,f.run,inside(f.repo,ar.path),{policySeal}),/zero-content/);
});
test('provider handoff refuses generated content, missing authority and stale state',t=>{
  const f=providerHandoffFixture(t);
  assert.throws(()=>prepareProviderHandoff(f.repo,f.state,{...f.a,resume:false},{policySeal}),/Explicit owner/);
  assert.throws(()=>prepareProviderHandoff(f.repo,{...f.state,usage:{...f.state.usage,inputTokens:1}},f.a,{policySeal}),/zero-content/);
  assert.throws(()=>prepareProviderHandoff(f.repo,f.state,{...f.a,previousStateSha256:'wrong'},{policySeal}),/checkpoint differs/);
  const bad=f.put('nonquota.jsonl',{type:'result',session_id:'quota-session',is_error:true,api_error_status:500,usage:{input_tokens:0,output_tokens:0}});
  assert.throws(()=>prepareProviderHandoff(f.repo,f.state,{...f.a,transcript:bad},{policySeal}),/quota rejection/);
});
test('provider handoff cannot extend overall deadline or waive an unlisted game edit',t=>{
  const f=providerHandoffFixture(t);
  const now=Date.parse(elapsedClock(f.state).deadlineAt)+1;
  assert.throws(()=>prepareProviderHandoff(f.repo,f.state,f.a,{policySeal,now}),/original operation/);
  fs.appendFileSync(path.join(f.repo,'main/src/game.js'),'changed');
  assert.throws(()=>prepareProviderHandoff(f.repo,f.state,f.a,{policySeal}),/Unlisted/);
});
test('full subprocess fixture reaches handback with cumulative budgets; second init is refused', async t => {
  const f = fixture(t), run = f.init(); const result = await runLoop(f.repo, run, f.hooks());
  assert.equal(result.status, 'READY_FOR_REVIEW', JSON.stringify(result.failure)); assert.equal(result.spent.roleLaunches, 9); assert.equal(result.spent.inputTokens, 90);
  assert.equal(result.preview.live, false); assert.ok(result.evidence.sha256); assert.equal(readJson(path.join(run, 'observations.json')).look, 1);
  assert.throws(() => f.init(), /already has a checkpoint/);
  const resumed = await runLoop(f.repo, run, f.hooks()); assert.deepEqual(resumed.spent, result.spent);
});
test('missing runtime capabilities stop before any model role is launched', async t => {
  const f = fixture(t); fs.writeFileSync(path.join(f.repo, 'MISSING_CAPABILITY'), 'synthetic missing capability');
  const run = f.init(); const result = await runLoop(f.repo, run, f.hooks());
  assert.equal(result.status, 'BLOCKED_INFRASTRUCTURE'); assert.equal(result.spent.roleLaunches, 0);
  assert.equal(result.failure.stage, 'preflight');
});
test('eight-hour chapter clock includes preparation and cannot reset on init or begin', async t => {
  const f = fixture(t); const start = Date.now() - MAX_CHAPTER_MS - 1000;
  const original = beginChapter(f.repo, 'ch99', { startedAt: new Date(start).toISOString() });
  assert.deepEqual(beginChapter(f.repo, 'ch99', { startedAt: new Date().toISOString() }), original);
  const run = f.init(); const result = await runLoop(f.repo, run, f.hooks());
  assert.equal(result.status, 'BUDGET_EXHAUSTED'); assert.equal(result.spent.roleLaunches, 0);
  assert.equal(result.clock.remainingMs, 0); assert.ok(result.clock.elapsedMs >= MAX_CHAPTER_MS);
  assert.throws(() => beginChapter(f.repo, 'ch100', { startedAt: new Date(Date.now() + 100000).toISOString() }), /non-future/);
});
test('independent planning and review roles overlap with one cumulative accounting record', async t => {
  const f = fixture(t), run = f.init(); const result = await runLoop(f.repo, run, f.hooks({ TEST_OVERLAP: '1' }));
  assert.equal(result.status, 'READY_FOR_REVIEW', JSON.stringify(result.failure));
  assert.equal(result.spent.roleLaunches, 9); assert.equal(result.spent.outputTokens, 360);
  const events = fs.readFileSync(path.join(f.repo, 'overlap.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  for (const group of [['cinema', 'score-plan'], ['player', 'av', 'canon']]) {
    const starts = events.filter(e => group.includes(e.stage) && e.event === 'start').map(e => e.at);
    const ends = events.filter(e => group.includes(e.stage) && e.event === 'end').map(e => e.at);
    assert.equal(starts.length, group.length); assert.ok(Math.max(...starts) < Math.min(...ends), `${group} did not overlap`);
  }
  const state = readJson(path.join(run, 'state.json')); const resultFile = checkRef(f.repo, state.receipts.player);
  const review = readJson(resultFile); const scope = readJson(checkRef(f.repo, review.reviewScope));
  assert.equal(scope.candidateSha256, result.candidateSha256); assert.equal(review.scopeSha256, review.reviewScope.sha256);
  const packet = readJson(path.join(path.dirname(resultFile), 'packet.json'));
  assert.equal(packet.canon, undefined); assert.equal(packet.recipe, undefined);
  assert.notEqual(path.dirname(checkRef(f.repo, review.reviewScope)), path.dirname(resultFile));
});
test('unchanged passing reviews are reused and a second refinement cannot reopen', async t => {
  const f = fixture(t), run = f.init(); const result = await runLoop(f.repo, run, f.hooks({ TEST_REVISE: '1' }));
  assert.equal(result.status, 'NEEDS_REVISION', JSON.stringify(result.failure)); assert.equal(result.spent.roleLaunches, 11);
  const state = readJson(path.join(run, 'state.json')); assert.equal(new Set(state.sessions).size, 11); assert.equal(state.queue.filter(x => x === 'refine').length, 1);
  assert.deepEqual(state.receipts.av, state.receipts['av-final']); assert.deepEqual(state.receipts.canon, state.receipts['canon-final']);
});
test('busy player GPU lock parks without spending a model launch or replaying completed roles', async t => {
  const f = fixture(t), run = f.init(); const base = f.hooks();
  const parked = await runLoop(f.repo, run, { runProcess: (cmd, args, options) => JSON.parse(options.input).stage === 'player' ? Promise.resolve({ exitCode: 75 }) : base.runProcess(cmd, args, options) });
  assert.equal(parked.status, 'WAITING_RESOURCE', JSON.stringify(parked.failure)); assert.equal(parked.spent.roleLaunches, 8);
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
  let after = readJson(stateFile); assert.equal(after.id, state.id); assert.equal(after.retries, 2);
  assert.equal(after.ownerRecoveries.length, 1); assert.deepEqual(after.limits, state.limits); assert.deepEqual(after.usage, state.usage);
  assert.ok(after.activeMs >= state.activeMs);
  const helper = 'main/tools/chapter-loop/evidence.mjs'; fs.appendFileSync(path.join(f.repo, helper), '\n// synthetic final repair adjustment\n');
  const amendment = { ...repair, ownerAuthorization: undefined, amends: reference(f.repo, receipt),
    files: [{ path: helper, before: after.frozen[helper], after: sha(fs.readFileSync(path.join(f.repo, helper))) }] };
  const amendmentFile = path.join(run, 'amendment.json'); writeJson(amendmentFile, amendment);
  assert.equal((await recover(f.repo, run, amendmentFile)).status, 'RUNNING');
  const adjusted = readJson(stateFile); assert.equal(adjusted.retries, 2); assert.equal(adjusted.activeMs, after.activeMs); assert.deepEqual(adjusted.usage, after.usage);
  after = adjusted;
  after.status = 'BLOCKED_INFRASTRUCTURE'; writeJson(stateFile, after);
  await assert.rejects(recover(f.repo, run, receipt), /replay a failure/);
  await assert.rejects(recover(f.repo, run), /Only one diagnosed/);
});
test('inactive transport maintenance preserves the creative revision verdict and every allowance', async t => {
  const f = fixture(t), run = f.init(), stateFile = path.join(run, 'state.json'), state = readJson(stateFile);
  state.status = 'NEEDS_REVISION'; state.cursor = state.queue.indexOf('verify'); state.retries = 1;
  state.failure = { stage: 'compose', message: 'Synthetic retained revision' };
  const prior = path.join(run, 'prior-repair.json'); writeJson(prior, { synthetic: true }); state.infrastructureRepair = reference(f.repo, prior);
  writeJson(stateFile, state);
  const name = 'main/tools/chapter-loop/evidence.mjs'; fs.appendFileSync(path.join(f.repo, name), '\n// synthetic socket repair\n');
  const repair = path.join(run, 'maintenance.json'); writeJson(repair, { schema: 'paravoxia.chapterLoopInfrastructureRepair.v1',
    runId: state.id, failureSha256: sha(state.failure), amends: state.infrastructureRepair, reconcileOnly: true,
    files: [{ path: name, before: state.frozen[name], after: sha(fs.readFileSync(path.join(f.repo, name))) }],
    validation: { passed: true, command: 'npm run chapter:loop:test' } });
  assert.equal((await recover(f.repo, run, repair)).status, 'NEEDS_REVISION');
  const after = readJson(stateFile);
  for (const key of ['status', 'cursor', 'queue', 'usage', 'limits', 'retries', 'activeMs', 'clock', 'refinementUsed', 'receipts']) assert.deepEqual(after[key], state[key], key);
  await assert.rejects(recover(f.repo, run, repair), /Repair amendment/);
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
test('persistent preview is reused only after byte verification and is not stopped by a borrower', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chapter-reuse-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const dist = path.join(dir, 'dist'); fs.mkdirSync(dist); fs.writeFileSync(path.join(dist, 'index.html'), '<title>Paravoxia</title>');
  const owner = await startPreview(dist, path.join(dir, 'owner.log')); t.after(owner.close);
  const receipt = { url: owner.url, files: owner.manifest.files, owner: 'synthetic-test-owner', daemonPid: owner.pid };
  const borrowed = await startPreview(dist, path.join(dir, 'borrow.log'), receipt);
  assert.equal(borrowed.reused, true); assert.equal(borrowed.pid, owner.pid); assert.equal(borrowed.url, owner.url);
  borrowed.close(); await owner.verify();
  await assert.rejects(startPreview(dist, path.join(dir, 'mismatch.log'), { ...receipt, files: { 'index.html': 'wrong' } }), /different build/);
  fs.writeFileSync(path.join(dist, 'index.html'), 'different bytes');
  await assert.rejects(borrowed.verify(), /Archived build changed/);
});

test('capability chapter mismatch fails before models and stale receipts cannot satisfy a fresh preflight', async t => {
  const f = fixture(t); fs.writeFileSync(path.join(f.repo, 'WRONG_CHAPTER'), 'fixture'); const run=f.init();
  const result=await runLoop(f.repo,run,f.hooks()); assert.equal(result.spent.roleLaunches,0); assert.match(result.failure.message,/different chapter/);
  const state=readJson(path.join(run,'state.json')); state.status='RUNNING';
  state.brief.verification.preflight.argv=[process.execPath,'-e','process.exit(0)'];
  await preflight(f.repo,run,state); assert.equal(state.status,'BLOCKED_INFRASTRUCTURE'); assert.equal(state.cursor,0);
});
test('conflicting comparators and zero-action thresholds cannot weaken evidence assertions', t => {
  const f=fixture(t), c=f.brief.verification.cases[0];
  c.assertions.acceptedAction={pointer:'/acceptedAction',equals:true,gte:0};
  assert.throws(()=>validateVerification(f.brief.verification),/one comparator/);
  delete c.assertions.acceptedAction.equals;
  assert.throws(()=>validateVerification(f.brief.verification),/one comparator/);
});
test('a single remaining launch is spent serially then stops as budget exhaustion', async t => {
  const f=fixture(t), run=f.init({roleLaunches:2}); const result=await runLoop(f.repo,run,f.hooks());
  assert.equal(result.status,'BUDGET_EXHAUSTED'); assert.equal(result.spent.roleLaunches,2);
});
test('failed parallel roles cancel their peers and preserve the original failure', async t => {
  const f=fixture(t),run=f.init(),base=f.hooks();let peerCancelled=false;
  const result=await runLoop(f.repo,run,{runProcess:async(cmd,args,options)=>{
    const stage=JSON.parse(options.input).stage;
    if(stage==='cinema')return {exitCode:0}; // No valid measured provider output.
    if(stage==='score-plan'){
      for(let i=0;i<100;i++){
        const reason=options.shouldStop();
        if(reason){peerCancelled=true;return {exitCode:null,reason};}
        await new Promise(r=>setTimeout(r,10));
      }
      throw Error('Peer was allowed to continue spending');
    }
    return base.runProcess(cmd,args,options);
  }});
  assert.equal(peerCancelled,true);assert.equal(result.status,'BLOCKED_CONTRACT');
  assert.match(result.failure.message,/accounting/);assert.equal(result.spent.roleLaunches,3);
});
test('successful checks build and earlier cases survive a later capture error', async t => {
  const f=fixture(t); const check={...f.brief.verification.build,id:'static',resource:'cpu'}; check.argv=[process.execPath,'main/tools/synthetic-probe.mjs','static','{out}','{repo}'];
  f.brief.verification.checks=[check];writeJson(f.briefFile,f.brief);
  fs.writeFileSync(path.join(f.repo,'FAIL_CASE_av'),'fixture');const run=f.init();
  const first=await runLoop(f.repo,run,f.hooks());assert.equal(first.status,'BLOCKED_INFRASTRUCTURE');
  fs.unlinkSync(path.join(f.repo,'FAIL_CASE_av')); const state=readJson(path.join(run,'state.json'));state.status='RUNNING';
  const preview=await verify(f.repo,run,state,'verify');preview?.close();assert.equal(state.status,'RUNNING',JSON.stringify(state.failure));
  const commands=fs.readFileSync(path.join(f.repo,'commands.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
  const counts=kind=>commands.filter(c=>c.kind===kind).length;
  assert.equal(counts('build'),1);assert.equal(counts('static'),1);assert.equal(counts('manual'),1);assert.equal(counts('av'),2);
  const bundle=readJson(checkRef(f.repo,state.receipts.evidence));assert.equal(bundle.cases.find(c=>c.kind==='manual').reused,true);
});

test('adaptive targets allow the complete checked loop beyond time, work, launch and observation targets', async t => {
  const f = fixture(t); delete f.brief.budgetPolicy; writeJson(f.briefFile, f.brief);
  const run = f.init({ roleTurns: 1, roleMs: 1, activeMs: 1, firstPlayableMs: 1, endToEndMs: 1, modelTurns: 1, roleLaunches: 1, lookCycles: 1, listenCycles: 1 });
  const result = await runLoop(f.repo, run, f.hooks({ TEST_REPEAT_OBSERVE: '1' }));
  assert.equal(result.status, 'READY_FOR_REVIEW');
  assert.equal(result.budgetGuidance.mode, 'adaptive');
  assert.ok(result.spent.roleLaunches > result.limits.roleLaunches);
  assert.ok(result.elapsedMs > result.limits.endToEndMs);
  assert.equal(readJson(path.join(run, 'observations.json')).look, 2);
  assert.equal(readJson(path.join(run, 'observations.json')).listen, 2);
  const packet = readJson(path.join(run, 'roles/1-plan/packet.json'));
  assert.equal(packet.executionBudget.targets.roleWorkItems, 1);
  assert.ok(fs.existsSync(packet.executionBudget.progressFile));
  assert.match(fs.readFileSync(path.join(run, 'events.jsonl'), 'utf8'), /budget-guidance/);
  const state = readJson(path.join(run, 'state.json'));
  assert.ok(Date.parse(commandDeadline(state)) > Date.now());
  assert.equal(state.refinementUsed, false);
});

test('Codex completes and reports real terminal usage after its advisory 60th work item', async t => {
  const f = fixture(t); f.brief.budgetPolicy = { mode: 'adaptive' }; f.brief.provider.provider = 'codex'; writeJson(f.briefFile, f.brief);
  const run = f.init(); const state = readJson(path.join(run, 'state.json')); state.cursor = 1;
  let packet;
  await dispatch(f.repo, run, state, 'plan', { runProcess: async (_command, _args, options) => {
    packet = JSON.parse(options.input); assert.equal(options.timeoutMs, undefined);
    const emit = event => { assert.equal(Boolean(options.onLine(JSON.stringify(event))), false); };
    emit({ type: 'thread.started', thread_id: 'adaptive-fixture-session' });
    for (let i = 0; i < 65; i++) emit({ type: 'item.completed', item: { type: 'command_execution', id: String(i) } });
    emit({ type: 'item.completed', item: { type: 'agent_message', text: JSON.stringify({ schema: VERSION.replace('chapterLoop.v1', 'chapterLoopRole.v1'), summary: 'Synthetic completed adaptive planning fixture.', verdict: 'PASS', evidence: [], findings: [], keep: [], anchors: ['start'], direction: { dramaticQuestion: 'Fixture question', playerActions: 'Fixture actions', entryState: 'Fixture entry', exitState: 'Fixture exit', signatureMoment: 'Fixture moment' } }) } });
    emit({ type: 'turn.completed', usage: { input_tokens: 100, cached_input_tokens: 70, output_tokens: 5 } });
    return { exitCode: 0, reason: null, bytes: 1000 };
  } });
  assert.equal(state.status, 'RUNNING'); assert.equal(state.cursor, 2);
  assert.equal(state.usage.modelTurns, 66); assert.equal(state.usage.inputTokens, 30); assert.equal(state.usage.cacheReadTokens, 70);
  assert.equal(readJson(packet.executionBudget.progressFile).targets.roleTurns.exceeded, true);
  assert.equal(readJson(path.join(run, 'roles/1-plan/transport.json')).reported, true);
});

test('advisory budget guidance requests checkpointing before the target, without altering counters', t => {
  const f = fixture(t), run = f.init(), state = readJson(path.join(run, 'state.json')); state.budgetPolicy = { mode: 'adaptive' };
  const before = structuredClone(state);
  const guidance = budgetGuidance(state, { roleItems: 48, firstPlayable: true });
  assert.equal(guidance.action, 'finish-existing-work'); assert.ok(guidance.nearing.includes('roleTurns'));
  assert.match(guidance.instruction, /progress.md/); assert.deepEqual(state, before);
});

test('adaptive mode still honors the owner stop and real usage/resource limits', async t => {
  const f = fixture(t); f.brief.budgetPolicy = { mode: 'adaptive' }; writeJson(f.briefFile, f.brief); const run = f.init();
  fs.writeFileSync(path.join(run, 'STOP'), 'Owner stop');
  assert.equal((await runLoop(f.repo, run, f.hooks())).status, 'STOPPED');
  const state = readJson(path.join(run, 'state.json')); assert.equal(state.usage.roleLaunches, 0);
  state.status = 'RUNNING'; state.cursor = 1; state.usage.inputTokens = state.limits.inputTokens;
  assert.throws(() => beginRole(state, 'plan'), /Budget exhausted/);
});

function adaptiveAdoptionFixture(t) {
  const f = fixture(t), run = f.init(), stateFile = path.join(run, 'state.json');
  const state = readJson(stateFile); state.cursor = 5; state.usage.roleLaunches = 7; state.usage.modelTurns = 121;
  state.status = 'BUDGET_EXHAUSTED'; state.failure = { stage: 'build', message: 'budget:roleTurns' }; writeJson(stateFile, state);
  const dir = path.join(run, 'roles/7-build'); fs.mkdirSync(dir, { recursive: true });
  writeJson(path.join(dir, 'transport.json'), { reported: false, completed: false, session: 'interrupted-fixture', usage: { modelTurns: 60, inputTokens: 0 } });
  const tool = 'main/tools/chapter-loop/budget.mjs'; const before = state.frozen[tool]; fs.appendFileSync(path.join(f.repo, tool), '\n// Synthetic policy migration fixture.\n');
  const files = [{ path: tool, before, after: sha(fs.readFileSync(path.join(f.repo, tool))) }];
  const log = path.join(run, 'synthetic-tests.log'); fs.writeFileSync(log, 'Synthetic fixture only.\n');
  const validation = path.join(run, 'synthetic-validation.json'); writeJson(validation, { status: 'passed', command: 'npm --prefix main run chapter:loop:test', filesSha256: sha(files), log: reference(f.repo, log) });
  const handoff = path.join(run, 'synthetic-handoff.json'); writeJson(handoff, { instruction: 'Retain partial source. Do not restart planning.' });
  const authority = path.join(run, 'synthetic-authority.json');
  const a = { schema: 'paravoxia.chapterBudgetPolicyChange.v1', runId: state.id, policy: 'adaptive', request: 'Synthetic owner policy correction: scheduling targets guide completion instead of stopping generation.', previousStateSha256: sha(fs.readFileSync(stateFile)), files, validation: reference(f.repo, validation), handoff: reference(f.repo, handoff) };
  writeJson(authority, a);
  return { ...f, run, stateFile, beforeState: state, authority, a };
}

test('checked adaptive adoption preserves history and unknown usage, then resumes the same stage', t => {
  const f = adaptiveAdoptionFixture(t), beforeObs = fs.readFileSync(path.join(f.run, 'observations.json'));
  const result = adoptAdaptiveBudget(f.repo, f.run, f.authority, { policySeal, validateBrief });
  assert.equal(result.status, 'RUNNING'); assert.equal(result.stage, 'build');
  const after = readJson(f.stateFile);
  for (const key of ['usage', 'limits', 'clock', 'activeMs', 'cursor', 'queue', 'receipts', 'retries', 'refinementUsed']) assert.deepEqual(after[key], f.beforeState[key]);
  assert.equal(after.accountingGaps[0].tokens, null); assert.equal(after.accountingGaps[0].retainedWorkItems, 60);
  assert.deepEqual(fs.readFileSync(path.join(f.run, 'observations.json')), beforeObs);
  assert.equal(after.policySha256, policySeal(after));
  assert.throws(() => adoptAdaptiveBudget(f.repo, f.run, f.authority, { policySeal, validateBrief }), /single-use/);
});

test('adaptive adoption cannot reopen owner stops, token caps or a changed game source', t => {
  for (const mode of ['stop', 'tokens', 'source', 'evidence']) {
    const f = adaptiveAdoptionFixture(t);
    if (mode === 'stop') fs.writeFileSync(path.join(f.run, 'STOP'), 'Owner stop');
    if (mode === 'tokens') { const state = readJson(f.stateFile); state.failure.message = 'budget:inputTokens'; writeJson(f.stateFile, state); f.a.previousStateSha256 = sha(fs.readFileSync(f.stateFile)); writeJson(f.authority, f.a); }
    if (mode === 'source') fs.appendFileSync(path.join(f.repo, 'main/src/game.js'), '// unlisted game edit\n');
    if (mode === 'evidence') { f.a.files[0].after = '0'.repeat(64); writeJson(f.authority, f.a); }
    assert.throws(() => adoptAdaptiveBudget(f.repo, f.run, f.authority, { policySeal, validateBrief }), /Owner stop|advisory scheduling stop|Unlisted source change|Changed infrastructure bytes/);
    assert.equal(readJson(f.stateFile).status, 'BUDGET_EXHAUSTED');
  }
});


test('preview identity survives pooled socket expiry during synchronous media decoding', async t => {
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'preview-expiry-'));
  t.after(() => fs.rmSync(dist, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dist, 'index.html'), '<title>Paravoxia</title>');
  const preview = await startPreview(dist, path.join(dist, '..', path.basename(dist) + '.log'));
  t.after(() => { preview.close(); fs.rmSync(path.join(dist, '..', path.basename(dist) + '.log'), { force: true }); });
  // Same event-loop stall as synchronous ffmpeg decode; the preview server
  // closes its idle socket while this process cannot consume that event.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 7500);
  await preview.verify();
  fs.writeFileSync(path.join(dist, 'index.html'), '<title>Another build</title>');
  await assert.rejects(preview.verify(), /Archived build changed/);
});

test('advisory token estimates preserve terminal accounting and complete past internal targets', async t => {
  const f = fixture(t); f.brief.budgetPolicy = { mode: 'adaptive', tokens: 'advisory' }; writeJson(f.briefFile, f.brief);
  const run = f.init({ inputTokens: 1, cacheReadTokens: 1, outputTokens: 1 });
  const result = await runLoop(f.repo, run, f.hooks());
  assert.equal(result.status, 'READY_FOR_REVIEW');
  assert.equal(result.spent.inputTokens, 90); assert.equal(result.spent.cacheReadTokens, 180);
  assert.equal(result.spent.outputTokens, 360); assert.equal(result.budgetGuidance.tokenPolicy, 'advisory');
});

async function compositionFixture(t) {
  const f = fixture(t); f.brief.budgetPolicy = { mode: 'adaptive' }; writeJson(f.briefFile, f.brief);
  const run = f.init(); const stopped = await runLoop(f.repo, run, f.hooks({ TEST_COMPOSE_REVISE: '1' }));
  assert.equal(stopped.status, 'NEEDS_REVISION');
  const stateFile = path.join(run, 'state.json'), state = readJson(stateFile);
  const tool = 'main/tools/chapter-loop/budget.mjs', before = state.frozen[tool];
  fs.appendFileSync(path.join(f.repo, tool), '\n// Synthetic completion handoff only.\n');
  const files = [{ path: tool, before, after: sha(fs.readFileSync(path.join(f.repo, tool))) }];
  const log = path.join(run, 'synthetic-tests.log'); fs.writeFileSync(log, 'Synthetic test receipt only.\n');
  const validation = path.join(run, 'synthetic-validation.json'); writeJson(validation, { passed: true, command: 'npm --prefix main run chapter:loop:test', filesSha256: sha(files), log: reference(f.repo, log) });
  const handoff = path.join(run, 'synthetic-handoff.json'); writeJson(handoff, { instruction: 'Use the existing final refinement, keep approved direction.' });
  const evidence = path.join(run, 'synthetic-implementation.json'); writeJson(evidence, { schema: 'paravoxia.chapterImplementationEvidence.v1', acceptance: false, composer: state.receipts.compose, artifacts: [state.receipts.compose], media: [] });
  const authority = path.join(run, 'synthetic-authority.json');
  const a = { schema: 'paravoxia.compositionContinuation.v1', runId: state.id, request: 'Continue the existing work.', useExistingRefinement: true,
    advisoryTokenTargets: true, previousStateSha256: sha(fs.readFileSync(stateFile)), files, validation: reference(f.repo, validation), handoff: reference(f.repo, handoff), implementationEvidence: reference(f.repo, evidence) };
  writeJson(authority, a); return { ...f, run, stateFile, beforeState: state, authority, a };
}

test('composer continuation spends one existing refinement and retains history through final independent reviews', async t => {
  const f = await compositionFixture(t);
  const beforeResult = fs.readFileSync(checkRef(f.repo, f.beforeState.receipts.compose));
  const result = continueComposition(f.repo, f.run, f.authority, { policySeal, validateBrief });
  assert.equal(result.next, 'refine'); const state = readJson(f.stateFile);
  for (const key of ['usage', 'limits', 'clock', 'activeMs', 'cursor', 'retries', 'sessions']) assert.deepEqual(state[key], f.beforeState[key]);
  assert.equal(state.refinementUsed, true); assert.equal(state.budgetPolicy.tokens, 'advisory');
  assert.deepEqual(fs.readFileSync(checkRef(f.repo, state.receipts.compose)), beforeResult);
  assert.equal(state.policySha256, policySeal(state));
  assert.equal((await runLoop(f.repo, f.run, f.hooks())).status, 'READY_FOR_REVIEW');
  const finished = readJson(f.stateFile);
  assert.ok(finished.receipts['player-final'] && finished.receipts['av-final'] && finished.receipts['canon-final']);
  assert.equal(finished.receipts.player, undefined);
  assert.equal(finished.usage.roleLaunches, f.beforeState.usage.roleLaunches + 4);
  assert.throws(() => continueComposition(f.repo, f.run, f.authority, { policySeal, validateBrief }), /unused refinement/);
});

test('composer continuation refuses owner stop, changed game, invalid evidence and consumed refinement', async t => {
  for (const mode of ['stop', 'game', 'evidence', 'refinement']) {
    const f = await compositionFixture(t);
    if (mode === 'stop') fs.writeFileSync(path.join(f.run, 'STOP'), 'Owner stop');
    if (mode === 'game') fs.appendFileSync(path.join(f.repo, 'main/src/game.js'), '// unrelated source\n');
    if (mode === 'evidence') { f.a.implementationEvidence.sha256 = '0'.repeat(64); writeJson(f.authority, f.a); }
    if (mode === 'refinement') { const state = readJson(f.stateFile); state.refinementUsed = true; writeJson(f.stateFile, state); }
    assert.throws(() => continueComposition(f.repo, f.run, f.authority, { policySeal, validateBrief }), /Owner stop|Unlisted source change|Evidence changed|unused refinement/);
    assert.equal(readJson(f.stateFile).status, 'NEEDS_REVISION');
  }
});

test('composer continuation retains current frozen tool pins after an older checked repair left stale brief refs', async t => {
  const f = await compositionFixture(t), state = readJson(f.stateFile);
  const tool = state.brief.toolRefs[0].path, current = state.frozen[tool];
  state.brief.toolRefs[0].sha256 = '0'.repeat(64); state.policySha256 = policySeal(state); writeJson(f.stateFile, state);
  f.a.previousStateSha256 = sha(fs.readFileSync(f.stateFile)); writeJson(f.authority, f.a);
  continueComposition(f.repo, f.run, f.authority, { policySeal, validateBrief });
  assert.equal(readJson(f.stateFile).brief.toolRefs[0].sha256, current);
});

test('a refiner awaiting runtime proof proceeds to final verification and independent review without another edit pass', async t => {
  const f = await compositionFixture(t);
  continueComposition(f.repo, f.run, f.authority, { policySeal, validateBrief });
  const result = await runLoop(f.repo, f.run, f.hooks({ TEST_REFINE_REVISE: '1' }));
  assert.equal(result.status, 'READY_FOR_REVIEW');
  const state = readJson(f.stateFile);
  assert.equal(readJson(checkRef(f.repo, state.receipts.refine)).verdict, 'REVISE');
  assert.equal(state.usage.roleLaunches, f.beforeState.usage.roleLaunches + 4);
  assert.ok(state.receipts['av-final']);
});

test('checked verification handoff preserves the completed refiner verdict, queue, allowance and source ownership', async t => {
  const f = await compositionFixture(t);
  continueComposition(f.repo, f.run, f.authority, { policySeal, validateBrief });
  const state = readJson(f.stateFile);
  await dispatch(f.repo, f.run, state, 'refine', f.hooks({ TEST_REFINE_REVISE: '1' }));
  // Reproduce the historical stop after an actually completed synthetic role.
  state.status = 'NEEDS_REVISION'; writeJson(f.stateFile, state);
  const tool = 'main/tools/chapter-loop/budget.mjs';
  fs.appendFileSync(path.join(f.repo, tool), '\n// Synthetic verification transition repair.\n');
  const files = [{ path: tool, before: state.frozen[tool], after: sha(fs.readFileSync(path.join(f.repo, tool))) }];
  const v = path.join(f.run, 'verification-validation.json');
  writeJson(v, { passed: true, command: 'npm --prefix main run chapter:loop:test', filesSha256: sha(files), log: reference(f.repo, path.join(f.run, 'synthetic-tests.log')) });
  const authority = path.join(f.run, 'verification-authority.json');
  writeJson(authority, { schema: 'paravoxia.implementationVerification.v1', runId: state.id, request: 'Continue the required final proof.',
    previousStateSha256: sha(fs.readFileSync(f.stateFile)), verifyExistingImplementation: true, files,
    validation: reference(f.repo, v), handoff: f.a.handoff });
  const options = { policySeal, validateBrief, verificationOnly: true };
  continueComposition(f.repo, f.run, authority, options);
  const after = readJson(f.stateFile);
  for (const key of ['usage', 'limits', 'clock', 'activeMs', 'cursor', 'queue', 'receipts', 'retries', 'refinementUsed', 'sessions', 'budgetPolicy']) assert.deepEqual(after[key], state[key]);
  assert.equal(readJson(checkRef(f.repo, after.receipts.refine)).verdict, 'REVISE');
  assert.equal(after.policySha256, policySeal(after));
  assert.throws(() => continueComposition(f.repo, f.run, authority, options), /inactive checkpoint/);
  assert.equal((await runLoop(f.repo, f.run, f.hooks())).status, 'READY_FOR_REVIEW');
});


test('blind player entry repair derives only this chapter from frozen controls before review dispatch',async t=>{
 const {reviewPreviewRepair}=await import('./runner.mjs');const f=fixture(t),run=f.init(),state=readJson(path.join(run,'state.json'));
 const file=path.join(f.repo,'main/chapter-controls.json');writeJson(file,{chapter:'ch99',manual:{beats:['ch99-entry']}});
 const ref=reference(f.repo,file);state.acceptedSource[ref.path]=ref.sha256;state.queue=['verify-final','player-final'];state.cursor=0;
 const repair={reviewPreviewConfig:ref};assert.deepEqual(reviewPreviewRepair(f.repo,state,repair),{kind:'diagnostic',query:'?story=ch99-entry&journeyprobe=1&profile=HIGH'});
 state.receipts['player-final']={};assert.throws(()=>reviewPreviewRepair(f.repo,state,repair),/before final verification/);delete state.receipts['player-final'];
 writeJson(file,{chapter:'ch98',manual:{beats:['ch98-entry']}});assert.throws(()=>reviewPreviewRepair(f.repo,state,repair));
 const other=reference(f.repo,file);state.acceptedSource[other.path]=other.sha256;assert.throws(()=>reviewPreviewRepair(f.repo,state,{reviewPreviewConfig:other}),/this chapter/);
});
