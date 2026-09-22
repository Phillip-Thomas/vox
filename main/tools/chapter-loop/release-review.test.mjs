import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { sha } from './contract.mjs';
import { readJson, writeJson, reference } from './store.mjs';
import { gameSnapshot, gameSourceSeal, commandKey } from './cache.mjs';
import { policySeal } from './runner.mjs';
import { MAX_CHAPTER_MS } from './budget.mjs';
import { OBLIGATIONS } from './evidence.mjs';
import { previewBuildManifest } from '../lib/previewSnapshot.mjs';
import { loadReleaseReviews, specialistTriggers, validateSpecialists, validateGateReceipt, finalizeReleaseReviews, releaseCommandBudget } from './release-review.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
// These fixtures test evidence validation, never chapter quality or acceptance.
function fixture(t, { sharedChange = false } = {}) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'release-review-test-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  execFileSync('git', ['init', '-q'], { cwd: repo });
  const put = (name, value) => { const file = path.join(repo, name); fs.mkdirSync(path.dirname(file), { recursive: true });
    if (typeof value === 'string') fs.writeFileSync(file, value); else writeJson(file, value);
    return reference(repo, file); };
  put('.gitignore', '.codex/\nmain/dist/\n');
  put('main/src/story/beats/ch99/arrival.ts', 'export const line = "Welcome";\n');
  put('main/chapter-registry.json', { schema: 'test.only', chapters: [{ id: 'ch99' }] });
  put('main/chapter-journey-contract.json', { chapters: [{ id: 'ch99', inputContracts: [{ id: 'move' }], interactionContracts: [], lifecycleContracts: [] }] });
  put('main/tools/chapter-registry-gate.mjs', 'console.log(JSON.stringify({ok:false,certified:false,failures:[{message:"fixture is not chapter acceptance"}]}));process.exitCode=1;');
  put('main/tools/chapter-journey-contract-gate.mjs', 'console.log(JSON.stringify({schema:"paravoxia.chapterJourneyContractGateReport.v1",status:"failed",issues:["fixture only"]}));process.exitCode=1;');
  for (const file of ['chapter-acceptance.mjs', 'chapter-journey-probe.mjs']) put(`main/tools/${file}`, '// fixture never launches a browser');
  const initial = gameSnapshot(repo);
  if (sharedChange) put('main/src/audio/musicEngine.ts', 'export const gain = 0.5;\n');
  const run = path.join(repo, '.codex/chapter-loops/ch99-test');
  const relative = path.relative(repo, run);
  const canon = put('docs/canon.md', 'Canon fixture for validator tests only.\n');
  const recipeRef = put(`${relative}/recipe.json`, { schema: 'paravoxia.chapterRecipe.v1', chapter: 'ch99', anchors: ['arrival'], lanes: {} });
  put('main/dist/index.html', '<title>Paravoxia</title>');
  const media = ['video', 'audio', 'frame'].map(kind => ({ ...put(`${relative}/evidence/${kind}.bin`, `fixture ${kind}`), kind }));
  const source = gameSourceSeal(repo), build = previewBuildManifest(path.join(repo, 'main/dist')).sha256;
  const bundle = { schema: 'paravoxia.chapterLoopEvidence.v1', sourceScope: 'game-v1', source, build,
    candidateSha256: sha({ source, build }), dist: 'main/dist', artifacts: media, media,
    cases: Object.entries(OBLIGATIONS).map(([kind, names]) => ({ kind, passed: true, checks: [...names, 'hardware', 'cleanup'].map(name => ({ name, passed: true })) })) };
  const evidenceRef = put(`${relative}/evidence/bundle.json`, bundle);
  const scope = { candidateSha256: bundle.candidateSha256, sourceSha256: source, buildSha256: build,
    evidence: evidenceRef, recipe: recipeRef, canon: [{ ...canon, startLine: 1, endLine: 1 }], media };
  const state = { schema: 'paravoxia.chapterLoop.v1', status: 'READY_FOR_REVIEW', chapter: 'ch99', active: null, activeRole: null,
    clock: { startedAt: new Date().toISOString() },
    brief: { provider: { provider: 'claude' }, canon: scope.canon, references: [canon], heavyLock: path.join(repo, 'heavy.lock') },
    receipts: { evidence: evidenceRef, recipe: recipeRef }, sessions: [], refinementUsed: false, initialGameSource: initial };
  const scores = { player: { discoverability: 4, agency: 5, recovery: 4 }, av: { composition: 4, motion: 4, music: 5, cohesion: 4 }, canon: { causality: 4, characterKnowledge: 4, continuity: 4 } };
  const events = [];
  for (const stage of ['player', 'av', 'canon']) {
    const dir = `${relative}/roles/${stage}`;
    const session = randomUUID();
    const reviewScope = put(`${dir}/review-scope.json`, { schema: 'paravoxia.chapterLoopReviewScope.v1', stage, ...scope });
    const result = { schema: 'paravoxia.chapterLoopRole.v1', summary: 'Evidence validator test; this is never chapter acceptance.',
      verdict: 'PASS', candidateSha256: bundle.candidateSha256, scores: scores[stage], evidence: [media[0]], findings: [], keep: ['Keep chapter identity bound.'] };
    if (stage === 'player') {
      result.playAttempt = put(`${dir}/attempt.json`, { schema: 'paravoxia.blindPlayAttempt.v1', candidateSha256: bundle.candidateSha256,
        ordinaryControls: true, acceptedActions: 1, cleanup: true, trace: ['validator test only'] });
      result.evidence = [result.playAttempt];
    }
    put(`${dir}/transcript.jsonl`, [
      { type: 'system', subtype: 'init', session_id: session, model: 'recorded-provider-model' },
      { type: 'result', session_id: session, num_turns: 1, usage: { input_tokens: 10, output_tokens: 10 }, result: JSON.stringify(result) },
    ].map(value => JSON.stringify(value)).join('\n') + '\n');
    put(`${dir}/transport.json`, { exitCode: 0, reason: null, completed: true, reported: true,
      requestedModel: 'recorded-provider-model', session, reviewScope });
    state.receipts[stage] = put(`${dir}/result.json`, { ...result, session, reviewScope, scopeSha256: reviewScope.sha256 });
    state.sessions.push(session);
    events.push({ type: 'dispatch', stage }, { type: 'completed', stage, verdict: 'PASS', changes: [] });
  }
  put(`${relative}/events.jsonl`, events.map(event => JSON.stringify(event)).join('\n') + '\n');
  const save = () => { state.policySha256 = policySeal(state); return put(`${relative}/state.json`, state); };
  save();
  return { repo, run, relative, state, scope, bundle, put, save,
    rewrite(stage, fn) { const result = readJson(path.join(repo, state.receipts[stage].path)); fn(result); state.receipts[stage] = put(state.receipts[stage].path, result); save(); } };
}

test('accepts three exact source-bound review receipts without issuing chapter acceptance', t => {
  const f = fixture(t);
  const review = loadReleaseReviews(f.repo, f.relative);
  assert.equal(review.reviews.length, 3);
  assert.deepEqual(review.reviews.map(r => r.role), ['player', 'av', 'canon']);
  assert.equal(new Set(review.reviews.map(r => r.session)).size, 3);
  assert.equal(review.disposition, undefined);
  assert.deepEqual(review.triggers, {});
  assert.equal(validateSpecialists(review).passed, true);
});

test('game, build, media, recipe and canon changes each reject old review reuse', async t => {
  for (const kind of ['game', 'build', 'media', 'recipe', 'canon']) await t.test(kind, t => {
    const f = fixture(t);
    const file = { game: 'main/src/story/beats/ch99/arrival.ts', build: 'main/dist/index.html', media: f.bundle.media[0].path,
      recipe: f.state.receipts.recipe.path, canon: f.state.brief.canon[0].path }[kind];
    fs.appendFileSync(path.join(f.repo, file), '\nchanged');
    assert.throws(() => loadReleaseReviews(f.repo, f.relative), /changed|seal|candidate/i);
  });
});

test('forged session and edited provider final cannot pass independent review integrity', async t => {
  await t.test('forged session', t => {
    const f = fixture(t);
    f.rewrite('av', result => { result.session = randomUUID(); });
    assert.throws(() => loadReleaseReviews(f.repo, f.relative), /session.*transcript/i);
  });
  await t.test('changed result', t => {
    const f = fixture(t);
    f.rewrite('av', result => { result.scores.music = 5 - result.scores.music + 4; result.summary += ' edited'; });
    assert.throws(() => loadReleaseReviews(f.repo, f.relative), /differs from provider final/);
  });
  await t.test('missing archived scope', t => {
    const f = fixture(t);
    f.rewrite('canon', result => { delete result.reviewScope; });
    assert.throws(() => loadReleaseReviews(f.repo, f.relative), /adapter-bound review scope/);
  });
  await t.test('fixture provider', t => {
    const f = fixture(t);
    const file = `${f.relative}/roles/player/transport.json`, transport = readJson(path.join(f.repo, file));
    f.put(file, { ...transport, requestedModel: 'synthetic-test-only' });
    assert.throws(() => loadReleaseReviews(f.repo, f.relative), /Fixture provider/);
  });
});

test('scope swap is rejected even after updating receipt hashes', t => {
  const f = fixture(t);
  const file = `${f.relative}/roles/canon/review-scope.json`;
  const scope = readJson(path.join(f.repo, file)); scope.recipe = f.state.receipts.evidence;
  const ref = f.put(file, scope);
  const transportFile = `${f.relative}/roles/canon/transport.json`;
  f.put(transportFile, { ...readJson(path.join(f.repo, transportFile)), reviewScope: ref });
  f.rewrite('canon', result => { result.reviewScope = ref; result.scopeSha256 = ref.sha256; });
  assert.throws(() => loadReleaseReviews(f.repo, f.relative), /scope changed: recipe/);
});

test('final-stage reuse keeps original source-identical review identities and stage provenance', t => {
  const f = fixture(t);
  f.state.refinementUsed = true;
  for (const stage of ['player', 'av', 'canon']) f.state.receipts[`${stage}-final`] = f.state.receipts[stage];
  f.save();
  const context = loadReleaseReviews(f.repo, f.relative);
  assert.equal(context.reviews.length, 3);
  assert.ok(context.reviews.every(review => review.reusedAtFinal && review.requestedStage === `${review.stage}-final`));
  assert.equal(new Set(context.reviews.map(review => review.session)).size, 3);
});

test('final-stage reuse accepts new bundle metadata while preserving each original reviewed evidence reference', t => {
  const f = fixture(t), original = loadReleaseReviews(f.repo, f.relative);
  f.state.refinementUsed = true;
  for (const stage of ['player', 'av', 'canon']) f.state.receipts[`${stage}-final`] = f.state.receipts[stage];
  const latestBundle = { ...f.bundle, cases: f.bundle.cases.map(value => ({ ...value, reused: true })), capturedAt: new Date().toISOString() };
  const latest = f.put(`${f.relative}/evidence/verify-final/bundle.json`, latestBundle);
  f.state.receipts.evidence = latest; f.save();
  const context = loadReleaseReviews(f.repo, f.relative);
  assert.deepEqual(context.identity, original.identity);
  assert.ok(context.reviews.every(review => review.evidenceMetadataReused));
  assert.ok(context.reviews.every(review => review.reviewedEvidence.path === f.scope.evidence.path));
  assert.ok(context.reviews.every(review => review.currentEvidence.path === latest.path));
  assert.deepEqual(context.reviews.map(review => review.session), original.reviews.map(review => review.session));
  // The newer metadata never replaces the original source being audited.
  fs.appendFileSync(path.join(f.repo, f.scope.evidence.path), '\nchanged');
  assert.throws(() => loadReleaseReviews(f.repo, f.relative), /Evidence changed/);
});

test('identical media bytes at a new archive path keep original review citations', t => {
  const f = fixture(t), original = loadReleaseReviews(f.repo, f.relative);
  const media = f.bundle.media.map(ref => ({ ...f.put(`${f.relative}/evidence/verify-final/${ref.kind}.bin`, fs.readFileSync(path.join(f.repo, ref.path), 'utf8')), kind: ref.kind }));
  f.state.receipts.evidence = f.put(`${f.relative}/evidence/verify-final/bundle.json`, { ...f.bundle, media, artifacts: media }); f.save();
  const context = loadReleaseReviews(f.repo, f.relative);
  assert.deepEqual(context.identity, original.identity);
  assert.equal(context.reviews.find(review => review.role === 'av').reviewedEvidence.path, f.scope.evidence.path);
});

test('shared code requires focused specialist review; chapter beat content does not add blanket reviewers', t => {
  const f = fixture(t, { sharedChange: true });
  const review = loadReleaseReviews(f.repo, f.relative);
  const specialists = validateSpecialists(review);
  assert.equal(specialists.passed, false);
  assert.deepEqual(specialists.missing, ['audio-engine']);
  assert.deepEqual(specialistTriggers(['main/src/story/beats/ch13/ending.ts', 'main/src/story/dialogue/conversation.ts']), {});
  assert.deepEqual(Object.keys(specialistTriggers(['main/src/saveGame.ts', 'main/src/rendering/world.ts', 'main/src/gameLoop.ts'])).sort(), ['persistence', 'rendering', 'shared-engine']);
});

test('focused specialist approval requires its own provider session and exact changed-file scope', t => {
  const f = fixture(t, { sharedChange: true }), context = loadReleaseReviews(f.repo, f.relative);
  const directory = `${f.relative}/specialist`, session = randomUUID();
  const result = { schema: 'paravoxia.chapterLoopSpecialistReview.v1', summary: 'Validator-only focused code review test.', verdict: 'PASS',
    scores: { correctness: 4 }, findings: [], domains: ['audio-engine'],
    scope: { ...context.identity, files: { 'main/src/audio/musicEngine.ts': context.current['main/src/audio/musicEngine.ts'] } },
    evidence: [reference(f.repo, path.join(f.repo, 'main/src/audio/musicEngine.ts'))] };
  const transcript = f.put(`${directory}/transcript.jsonl`, [
    { type: 'system', subtype: 'init', session_id: session, model: 'recorded-provider-model' },
    { type: 'result', session_id: session, num_turns: 1, usage: { input_tokens: 10, output_tokens: 10 }, result: JSON.stringify(result) },
  ].map(value => JSON.stringify(value)).join('\n') + '\n');
  const transport = f.put(`${directory}/transport.json`, { exitCode: 0, completed: true, reported: true, requestedModel: 'recorded-provider-model', session });
  const report = { ...result, session, provenance: { provider: 'claude', transcript, transport } };
  const ref = f.put(`${directory}/result.json`, report);
  assert.equal(validateSpecialists(context, [ref]).passed, true);
  report.session = context.reviews[0].session;
  assert.throws(() => validateSpecialists(context, [f.put(`${directory}/result.json`, report)]), /fresh independent session/);
  report.session = session; report.scope.files = {};
  assert.throws(() => validateSpecialists(context, [f.put(`${directory}/result.json`, report)]), /omitted changed file/);
});

test('original game baseline cannot change without invalidating its pinned policy', t => {
  const f = fixture(t, { sharedChange: true });
  f.state.initialGameSource = gameSnapshot(f.repo);
  f.put(`${f.relative}/state.json`, f.state);
  assert.throws(() => loadReleaseReviews(f.repo, f.relative), /policy or original game source/);
});

function gateFixture(f, context, kind = 'mechanical') {
  const directory = `${f.relative}/release/${kind}`;
  const tool = kind === 'mechanical' ? 'chapter-acceptance.mjs' : 'chapter-journey-probe.mjs';
  const mechanical = { schema: 'paravoxia.chapterMechanicalEvidence.v1', chapter: { id: 'ch99', minimumColdRuns: 3 },
    source: { revision: 'abc123' }, sourceVerification: { status: 'matched' }, execution: { certifyingMode: true },
    runs: [{ status: 'passed' }, { status: 'passed' }, { status: 'passed' }], openGates: [] };
  for (const flag of ['targetChapterMatchesInput', 'candidateRevisionMatchesInput', 'requiredObjectiveBeatsPassed',
    'requiredVariantProfilesPassed', 'performanceBudgetsPassed', 'registeredEvidenceProofComplete',
    'boundaryProofComplete', 'preflightAuthorityCertified', 'machineReadyForCouncilReview']) mechanical[flag] = true;
  const report = kind === 'mechanical' ? mechanical : { schema: 'paravoxia.chapterJourneyEvidence.v1', chapterId: 'ch99', status: 'passed',
    machineJourneyCertified: true, lane: { machineJourneyCertifying: true, id: 'continuous-manual', requestedControlMode: 'manual' },
    hardwareAttestation: { status: 'passed' }, contract: { sha256: reference(f.repo, path.join(f.repo, 'main/chapter-journey-contract.json')).sha256 },
    scenarios: [{ id: 'move', status: 'passed' }] };
  const receipt = { schema: 'paravoxia.chapterLoopReleaseCommand.v1', kind, candidate: context.identity, candidateAfter: context.identity,
    cwd: 'main', argv: [process.execPath, `tools/${tool}`, '--candidate-revision', 'abc123'], exitCode: 0, reason: null,
    tool: reference(f.repo, path.join(f.repo, 'main/tools', tool)),
    log: f.put(`${directory}/command.log`, 'Test-only command validation fixture.'), report: f.put(`${directory}/report.json`, report),
    inputs: { registry: reference(f.repo, path.join(f.repo, 'main/chapter-registry.json')),
      journeyContract: reference(f.repo, path.join(f.repo, 'main/chapter-journey-contract.json')) } };
  receipt.keyConfig = { argv: [...receipt.argv], cwd: 'main' };
  receipt.dependencyKey = commandKey(f.repo, receipt.keyConfig, { source: context.bundle.source, build: context.bundle.build, kind });
  receipt.dependencyKeyAfter = receipt.dependencyKey;
  return { ref: f.put(`${directory}/command.json`, receipt), receipt, report, directory };
}

test('deterministic full release receipts are reusable only for their exact scope', t => {
  const f = fixture(t), context = loadReleaseReviews(f.repo, f.relative);
  const gate = gateFixture(f, context);
  assert.equal(validateGateReceipt(context, gate.ref, 'mechanical').kind, 'mechanical');
  const stale = { ...gate.receipt, candidate: { ...context.identity, buildSha256: 'a'.repeat(64) } };
  assert.throws(() => validateGateReceipt(context, f.put(`${gate.directory}/stale.json`, stale), 'mechanical'), /stale candidate/);
  const smoke = { ...gate.receipt, argv: [...gate.receipt.argv, '--smoke'] };
  assert.throws(() => validateGateReceipt(context, f.put(`${gate.directory}/smoke.json`, smoke), 'mechanical'), /Noncertifying|executed command/);
  assert.throws(() => validateGateReceipt(context, gate.receipt.report, 'mechanical'), /command did not pass/);
  const journey = gateFixture(f, context, 'journey');
  assert.equal(validateGateReceipt(context, journey.ref, 'journey').kind, 'journey');
  journey.report.scenarios = [];
  journey.receipt.report = f.put(`${journey.directory}/report.json`, journey.report);
  assert.throws(() => validateGateReceipt(context, f.put(`${journey.directory}/command.json`, journey.receipt), 'journey'), /coverage is incomplete/);
});

test('a transitive probe dependency edit invalidates a reusable command receipt', t => {
  const f = fixture(t), context = loadReleaseReviews(f.repo, f.relative);
  f.put('main/tools/receipt-helper.mjs', 'export const version = 1;');
  f.put('main/tools/chapter-acceptance.mjs', 'import { version } from "./receipt-helper.mjs"; console.log(version);');
  const gate = gateFixture(f, context);
  assert.equal(validateGateReceipt(context, gate.ref, 'mechanical').kind, 'mechanical');
  f.put('main/tools/receipt-helper.mjs', 'export const version = 2;');
  assert.throws(() => validateGateReceipt(context, gate.ref, 'mechanical'), /probe dependency identity changed/);
});

test('finalization writes truthful review consolidation and blocks missing release evidence without model dispatch', async t => {
  const f = fixture(t);
  const result = await finalizeReleaseReviews(f.repo, f.relative);
  assert.equal(result.report.disposition, 'blocked-authority-or-evidence');
  assert.equal(result.report.reviews.length, 3);
  assert.equal(result.report.humanTaste.status, 'pending');
  assert.equal(result.report.publication.authorized, false);
  assert.ok(result.report.blockers.some(reason => reason.startsWith('mechanical:')));
  assert.ok(result.report.blockers.some(reason => reason.startsWith('journey:')));
  assert.ok(fs.existsSync(result.reportPath));
  assert.equal(readJson(result.packetPath).schema, 'paravoxia.chapterLoopReleaseGates.v1');
  assert.equal(result.report.clock.limitMs, MAX_CHAPTER_MS);
});

test('release command timeout is bounded by the original end-to-end chapter deadline', () => {
  const start = 1_000_000, state = { clock: { startedAt: new Date(start).toISOString() } };
  assert.equal(releaseCommandBudget(state, start).timeoutMs, 2 * 60 * 60 * 1000);
  assert.equal(releaseCommandBudget(state, start + MAX_CHAPTER_MS - 250).timeoutMs, 250);
  assert.throws(() => releaseCommandBudget(state, start + MAX_CHAPTER_MS), /budget exhausted/);
  assert.equal(releaseCommandBudget({ ...state, limits: { endToEndMs: 1000 } }, start + 800).timeoutMs, 200);
});

test('expired chapters reject release before evidence hashing or deterministic commands', async t => {
  const f = fixture(t);
  f.state.clock.startedAt = new Date(Date.now() - MAX_CHAPTER_MS - 1000).toISOString(); f.save();
  fs.appendFileSync(path.join(f.repo, f.scope.evidence.path), '\ninvalid stale evidence');
  await assert.rejects(finalizeReleaseReviews(f.repo, f.relative, { runMechanical: true, runJourney: true }), /end-to-end budget exhausted/);
  assert.equal(fs.existsSync(path.join(f.run, 'release')), false);
});

test('deadline terminates an in-flight release command and prevents the next gate from starting', async t => {
  const f = fixture(t);
  f.put('main/tools/chapter-registry-gate.mjs', 'setTimeout(() => console.log(JSON.stringify({ok:true,failures:[]})), 8000);');
  f.state.clock.startedAt = new Date(Date.now() - MAX_CHAPTER_MS + 1500).toISOString(); f.save();
  await assert.rejects(finalizeReleaseReviews(f.repo, f.relative), /end-to-end budget exhausted/);
  const out = path.join(f.run, 'release'), packet = readJson(path.join(out, 'release-gates.json'));
  const receipt = readJson(path.join(f.repo, packet.commands.registry.path));
  assert.ok(receipt.budget.timeoutMs > 0 && receipt.budget.timeoutMs <= 1500);
  assert.equal(receipt.reason, 'budget:endToEndMs');
  assert.deepEqual(Object.keys(packet.commands), ['registry']);
  assert.equal(fs.readdirSync(out).some(name => name.startsWith('authority-')), false);
});

test('CLI --chapter-loop reaches consolidation without Terra or model bindings', t => {
  const f = fixture(t);
  for (const name of ['main/tools/chapter-loop', 'main/tools/lib']) fs.cpSync(path.join(root, name), path.join(f.repo, name), { recursive: true });
  fs.copyFileSync(path.join(root, 'main/tools/creative-chapter-acceptance-workflow.mjs'), path.join(f.repo, 'main/tools/creative-chapter-acceptance-workflow.mjs'));
  const execution = spawnSync(process.execPath, ['main/tools/creative-chapter-acceptance-workflow.mjs', '--chapter-loop', f.relative], { cwd: f.repo, encoding: 'utf8', timeout: 30_000 });
  assert.equal(execution.status, 1, execution.stderr);
  assert.match(execution.stdout, /Three independent review sessions reused/);
  assert.match(execution.stdout, /blocked-authority-or-evidence/);
  assert.doesNotMatch(execution.stderr, /Terra|adapter bindings/);
});

test('adaptive elapsed target never prevents required release validation', () => {
  const start = Date.now() - MAX_CHAPTER_MS - 1000;
  const state = { createdAt: new Date(start).toISOString(), limits: { endToEndMs: MAX_CHAPTER_MS }, budgetPolicy: { mode: 'adaptive' } };
  const budget = releaseCommandBudget(state);
  assert.equal(budget.remainingMs, 0); assert.equal(budget.mode, 'adaptive'); assert.equal(budget.timeoutMs, 2 * 60 * 60 * 1000);
});
