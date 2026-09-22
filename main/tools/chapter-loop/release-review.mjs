// Deterministic release review consolidation. This module launches no model roles.
// Three Chapter Loop reviews remain three identities; they never impersonate the
// legacy lane's six auditors, moderator or cohesion judge.
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { requireThat, sha, validateResult, validRef, roleFor, adaptiveBudget } from './contract.mjs';
import { inside, readJson, writeJson, reference, checkRef, sourceSeal, differences } from './store.mjs';
import { gameSnapshot, gameSourceSeal, commandKey } from './cache.mjs';
import { policySeal } from './runner.mjs';
import { elapsedClock } from './budget.mjs';
import { usageTracker } from './providers.mjs';
import { verifyBundle, startPreview, OBLIGATIONS } from './evidence.mjs';
import { runProcess } from './process.mjs';

export const REVIEW_SCHEMA = 'paravoxia.chapterLoopReleaseReview.v1';
const COMMAND_SCHEMA = 'paravoxia.chapterLoopReleaseCommand.v1';
const ROLES = ['player', 'av', 'canon'];
const same = (a, b) => sha(a) === sha(b);
const refEqual = (a, b) => validRef(a) && validRef(b) && a.path === b.path && a.sha256 === b.sha256;
const refs = (repo, values) => { for (const value of values) checkRef(repo, value); };
const isTest = value => /(?:synthetic|fixture|test-only)/i.test(value ?? '');
const readRef = (repo, ref) => { requireThat(validRef(ref), 'Missing hash-bound evidence reference'); return readJson(checkRef(repo, ref)); };
const sourceNow = (repo, bundle) => bundle.sourceScope === 'game-v1' ? gameSourceSeal(repo) : sourceSeal(repo);
const mediaIdentity = media => media.map(ref => [ref.kind, ref.sha256]);

export function releaseCommandBudget(state, now = Date.now()) {
  const clock = elapsedClock(state, now);
  requireThat(adaptiveBudget(state) || clock.remainingMs > 0, 'Chapter end-to-end budget exhausted; release finalization shares the original eight-hour clock');
  return { ...clock, mode: adaptiveBudget(state) ? 'adaptive' : 'strict', timeoutMs: adaptiveBudget(state) ? 2 * 60 * 60 * 1000 : Math.min(2 * 60 * 60 * 1000, clock.remainingMs) };
}

function verifyReviewEvidence(repo, bundle) {
  requireThat(bundle.schema === 'paravoxia.chapterLoopEvidence.v1', 'Missing Chapter Loop evidence bundle');
  verifyBundle(repo, bundle);
  requireThat(sourceNow(repo, bundle) === bundle.source, 'Game candidate source changed since review');
  refs(repo, bundle.media);
  for (const [kind, required] of Object.entries(OBLIGATIONS)) {
    const cases = bundle.cases.filter(c => c.kind === kind);
    requireThat(cases.length === 1 && cases[0].passed === true
      && [...required, 'hardware', 'cleanup'].every(name => cases[0].checks.some(c => c.name === name && c.passed === true)), `Loop ${kind} evidence is incomplete`);
  }
}

function independentTransport(repo, result, transportRef, transcriptRef, provider, excludedSessions) {
  requireThat(['claude', 'codex'].includes(provider), 'Unsupported review provider');
  const transport = readRef(repo, transportRef);
  requireThat(transport.exitCode === 0 && !transport.reason && !transport.error
    && transport.completed === true && transport.reported === true, 'Review transport did not complete');
  requireThat(typeof result.session === 'string' && /^[a-f0-9-]{32,36}$/i.test(result.session)
    && !excludedSessions.includes(result.session), 'Review must have a fresh independent session');
  requireThat(!isTest(transport.requestedModel) && !isTest(transport.resolved), 'Fixture provider is not release evidence');
  const tracker = usageTracker(provider);
  const lines = fs.readFileSync(checkRef(repo, transcriptRef), 'utf8').trim().split('\n');
  let starts = 0;
  for (const line of lines) {
    let event; try { event = JSON.parse(line); } catch { throw new Error('Malformed provider transcript'); }
    if ((provider === 'claude' && event.type === 'system' && event.subtype === 'init')
      || (provider === 'codex' && event.type === 'thread.started')) starts++;
    tracker.ingest(line);
  }
  const observed = tracker.result();
  requireThat(starts === 1 && observed.completed && observed.reported && observed.usage.modelTurns > 0,
    'Review needs a fresh provider initialization and completed measured transcript');
  requireThat(observed.session === result.session && transport.session === result.session,
    'Review session is not backed by its provider transcript');
  requireThat(!isTest(observed.resolved), 'Fixture transcript is not release evidence');
  const raw = JSON.parse(observed.final.trim().replace(/^```(?:json)?\s*|\s*```$/g, ''));
  const authored = value => Object.fromEntries(Object.entries(value).filter(([key]) => !['session', 'reviewScope', 'scopeSha256', 'provenance'].includes(key)));
  requireThat(same(authored(raw), authored(result)), 'Review result differs from provider final output');
  return transport;
}

/** Content files are cheap; shared runtime changes require focused code review.
 * Unknown runtime modules fail into shared-engine, rather than allowing a new
 * shared module to evade the trigger by choosing an unrecognized filename. */
export function specialistTriggers(changedFiles) {
  const groups = {};
  for (const file of changedFiles) {
    if (!file.startsWith('main/src/') || /\.(?:test|spec)\.[^.]+$/.test(file)) continue;
    let domain;
    if (/\/(?:persistence|save|storage)\/|\/(?:saveGame|saveState|saveStore|persistence|checkpointStore)[^/]*\./i.test(file)) domain = 'persistence';
    else if (/^main\/src\/audio\//.test(file) && !/\/(?:chapters|scores|cues)\//.test(file)) domain = 'audio-engine';
    else if (/\/(?:render|rendering|shaders|materials|postprocessing)\/|\/(?:renderer|renderLoop)[^/]*\./i.test(file)) domain = 'rendering';
    else if (/^main\/src\/(?:chapters|scenes)\/|^main\/src\/story\/(?:chapters|scenes|content|dialogue)\/|^main\/src\/story\/beats\/ch[0-9]+\/|^main\/src\/audio\/(?:chapters|scores|cues)\//.test(file)) continue;
    else domain = 'shared-engine';
    (groups[domain] ??= []).push(file);
  }
  return Object.fromEntries(Object.entries(groups).map(([domain, files]) => [domain, files.sort()]));
}

/** Validate real archived reviews without declaring chapter acceptance. */
export function loadReleaseReviews(repo, input, { requireBudget = false } = {}) {
  const requested = path.resolve(repo, input);
  const run = ['state.json', 'run.json'].includes(path.basename(requested)) ? path.dirname(requested) : requested;
  requireThat(run.startsWith(path.join(path.resolve(repo), '.codex/chapter-loops') + path.sep), 'Expected an existing Chapter Loop run');
  const stateFile = inside(repo, path.relative(repo, path.join(run, 'state.json')));
  requireThat(fs.realpathSync(run) === run, 'Chapter Loop release run must not resolve through a symlink');
  const state = readJson(stateFile);
  requireThat(state.schema === 'paravoxia.chapterLoop.v1' && state.status === 'READY_FOR_REVIEW'
    && !state.active && !state.activeRole && !fs.existsSync(path.join(run, 'STOP')), 'Chapter Loop is not ready for review reuse');
  requireThat(state.policySha256 === policySeal(state), 'Chapter Loop policy or original game source inventory changed');
  if (requireBudget) releaseCommandBudget(state);
  if (state.initialGameSourceRef) requireThat(same(readRef(repo, state.initialGameSourceRef), state.initialGameSource), 'Original game source receipt differs from policy inventory');
  const bundle = readRef(repo, state.receipts.evidence);
  verifyReviewEvidence(repo, bundle);
  const validatedBundles = new Map([[`${state.receipts.evidence.path}:${state.receipts.evidence.sha256}`, bundle]]);
  const recipe = readRef(repo, state.receipts.recipe);
  requireThat(recipe.schema === 'paravoxia.chapterRecipe.v1' && recipe.chapter === state.chapter, 'Missing exact chapter recipe');
  requireThat(Array.isArray(state.brief.canon) && state.brief.canon.length > 0, 'Missing bound canon');
  refs(repo, state.brief.canon);
  const scope = {
    candidateSha256: bundle.candidateSha256, sourceSha256: bundle.source, buildSha256: bundle.build,
    evidence: state.receipts.evidence, recipe: state.receipts.recipe, canon: state.brief.canon, media: bundle.media,
  };
  const eventsRef = reference(repo, path.join(run, 'events.jsonl'));
  const events = fs.readFileSync(checkRef(repo, eventsRef), 'utf8').trim().split('\n').map(line => JSON.parse(line));
  const suffix = state.refinementUsed ? '-final' : '';
  const selected = ROLES.map(role => role + suffix);
  const selectedRefs = selected.map(stage => state.receipts[stage]);
  const otherSessions = Object.entries(state.receipts).filter(([stage, ref]) => roleFor(stage)
    && !selected.includes(stage) && !selectedRefs.some(selectedRef => refEqual(ref, selectedRef)))
    .map(([, ref]) => readRef(repo, ref).session).filter(Boolean);
  const reviews = [];
  for (const stage of selected) {
    const ref = state.receipts[stage];
    requireThat(validRef(ref), `Missing ${stage} review`);
    const result = readRef(repo, ref);
    const directory = path.dirname(checkRef(repo, ref));
    requireThat(directory.startsWith(path.join(run, 'roles') + path.sep), 'Review is not owned by this run');
    const transportRef = reference(repo, path.join(directory, 'transport.json'));
    const transcriptRef = reference(repo, path.join(directory, 'transcript.jsonl'));
    const transport = independentTransport(repo, result, transportRef, transcriptRef, state.brief.provider.provider, [...otherSessions, ...reviews.map(r => r.session)]);
    requireThat(state.sessions.filter(s => s === result.session).length === 1, 'Review session is absent or duplicated in adapter history');
    validateResult(stage, result, { candidate: scope.candidateSha256, sessions: otherSessions });
    requireThat(result.verdict === 'PASS', `${stage} requires revision; cannot consolidate as passing`);
    refs(repo, [...result.evidence, ...result.findings.flatMap(f => f.evidence)]);
    requireThat(refEqual(result.reviewScope, transport.reviewScope) && result.scopeSha256 === result.reviewScope.sha256,
      'Missing adapter-bound review scope; older reviews cannot be reused automatically');
    const recordedScope = readRef(repo, result.reviewScope);
    requireThat(recordedScope.schema === 'paravoxia.chapterLoopReviewScope.v1'
      && recordedScope.stage?.replace(/-final$/, '') === stage.replace(/-final$/, ''),
      'Review scope belongs to another role');
    for (const [key, value] of Object.entries(scope)) {
      if (key === 'evidence') continue;
      const matches = key === 'media' ? same(mediaIdentity(recordedScope.media), mediaIdentity(value)) : same(recordedScope[key], value);
      requireThat(matches, `${stage} review scope changed: ${key}`);
    }
    // Reverification may write a new bundle.json or archive directory while
    // preserving the exact candidate and captured media. Keep the review's
    // original evidence reference, validate its bytes, and compare its identity
    // instead of pretending that the reviewer saw the newer metadata artifact.
    requireThat(validRef(recordedScope.evidence), 'Missing original review evidence reference');
    const evidenceKey = `${recordedScope.evidence.path}:${recordedScope.evidence.sha256}`;
    let reviewedBundle = validatedBundles.get(evidenceKey);
    if (!reviewedBundle) {
      reviewedBundle = readRef(repo, recordedScope.evidence);
      verifyReviewEvidence(repo, reviewedBundle);
      validatedBundles.set(evidenceKey, reviewedBundle);
    }
    requireThat(reviewedBundle.candidateSha256 === scope.candidateSha256 && reviewedBundle.source === scope.sourceSha256
      && reviewedBundle.build === scope.buildSha256 && same(reviewedBundle.media, recordedScope.media), `${stage} original review evidence differs from its bound scope`);
    const dispatchedStage = recordedScope.stage;
    const dispatchIndex = events.findIndex(e => e.type === 'dispatch' && e.stage === dispatchedStage);
    requireThat(dispatchIndex >= 0 && events.slice(dispatchIndex + 1).some(e => e.type === 'completed' && e.stage === dispatchedStage
      && e.verdict === 'PASS' && Array.isArray(e.changes) && e.changes.length === 0), 'Missing read-only adapter dispatch/completion receipt');
    if (stage.startsWith('player')) {
      const attempt = readRef(repo, result.playAttempt);
      requireThat(path.dirname(checkRef(repo, result.playAttempt)) === directory && attempt.schema === 'paravoxia.blindPlayAttempt.v1'
        && attempt.candidateSha256 === scope.candidateSha256 && attempt.ordinaryControls === true && attempt.acceptedActions >= 1
        && attempt.cleanup === true && Array.isArray(attempt.trace) && attempt.trace.length > 0, 'Missing independent ordinary-controls play attempt');
    }
    if (stage.startsWith('av')) requireThat(result.evidence.every(ref => [...recordedScope.media, ...state.brief.references].some(allowed => refEqual(ref, allowed))), 'Blind AV review cites unpermitted evidence');
    reviews.push({ role: stage.replace(/-final$/, ''), stage: dispatchedStage, requestedStage: stage,
      reusedAtFinal: dispatchedStage !== stage, session: result.session, result: ref,
      transport: transportRef, transcript: transcriptRef, reviewScope: result.reviewScope,
      reviewedEvidence: recordedScope.evidence, currentEvidence: scope.evidence,
      evidenceMetadataReused: !refEqual(recordedScope.evidence, scope.evidence),
      scores: result.scores, findings: result.findings, keep: result.keep });
  }
  requireThat(state.initialGameSource && typeof state.initialGameSource === 'object', 'Missing original game source inventory for specialist risk assessment');
  const current = gameSnapshot(repo);
  const changed = differences(state.initialGameSource, current);
  return { repo, run, state, bundle, scope, reviews, current, changed, triggers: specialistTriggers(changed),
    provenance: { state: reference(repo, stateFile), events: eventsRef },
    identity: { chapter: state.chapter, candidateSha256: scope.candidateSha256, sourceSha256: scope.sourceSha256,
      buildSha256: scope.buildSha256, recipeSha256: scope.recipe.sha256, canonSha256: sha(scope.canon), mediaSha256: sha(mediaIdentity(scope.media)) } };
}

export function validateSpecialists(context, reviewRefs = []) {
  const { repo, triggers, identity, current } = context;
  const excluded = [...context.state.sessions];
  const accepted = [];
  for (const ref of reviewRefs) {
    const result = readRef(repo, ref);
    requireThat(result.schema === 'paravoxia.chapterLoopSpecialistReview.v1' && result.verdict === 'PASS'
      && Number.isFinite(result.scores?.correctness) && result.scores.correctness >= 4 && result.scores.correctness <= 5
      && Array.isArray(result.findings) && result.findings.every(f => f.severity === 'minor'), 'Focused specialist review has unresolved major/blocking findings or a score below 4/5');
    requireThat(Array.isArray(result.domains) && result.domains.length > 0 && result.domains.every(d => Object.hasOwn(triggers, d)), 'Specialist review must target a triggered code domain');
    for (const [key, value] of Object.entries(identity)) requireThat(result.scope?.[key] === value, `Specialist source-bound scope changed: ${key}`);
    for (const domain of result.domains) for (const file of triggers[domain]) requireThat(Object.hasOwn(result.scope.files ?? {}, file) && result.scope.files[file] === (current[file] ?? null), `Specialist review omitted changed file: ${file}`);
    requireThat(Array.isArray(result.evidence) && result.evidence.length > 0, 'Specialist needs evidence references');
    refs(repo, [...result.evidence, ...result.findings.flatMap(f => f.evidence ?? [])]);
    independentTransport(repo, result, result.provenance.transport, result.provenance.transcript, result.provenance.provider, excluded);
    excluded.push(result.session);
    accepted.push({ ref, session: result.session, domains: result.domains, scope: result.scope });
  }
  const missing = Object.keys(triggers).filter(domain => !accepted.some(review => review.domains.includes(domain)));
  return { triggers, accepted, missing, passed: missing.length === 0 };
}

function currentIdentity(context) {
  verifyBundle(context.repo, context.bundle);
  requireThat(sourceNow(context.repo, context.bundle) === context.bundle.source, 'Candidate changed during release checks');
  refs(context.repo, [context.scope.recipe, ...context.scope.canon, ...context.scope.media]);
  return context.identity;
}

function commandArguments(context, kind, output, options) {
  const main = path.join(context.repo, 'main');
  if (kind === 'registry') return ['tools/chapter-registry-gate.mjs', '--json'];
  if (kind === 'authority') return ['tools/chapter-registry-gate.mjs', '--certify', '--chapter', context.state.chapter];
  if (kind === 'journey-contract') return ['tools/chapter-journey-contract-gate.mjs'];
  const report = path.join(output, 'report.json');
  if (kind === 'mechanical') {
    const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: context.repo, encoding: 'utf8' }).trim();
    const args = ['tools/chapter-acceptance.mjs', '--chapter', context.state.chapter, '--candidate-revision', revision,
      '--output', output, '--report', report, '--runs', String(options.runs ?? 3)];
    if (options.headed) args.push('--headed');
    return args;
  }
  requireThat(kind === 'journey', 'Unknown deterministic release gate');
  const args = ['tools/chapter-journey-probe.mjs', '--chapter', context.state.chapter,
    '--manifest', path.join(main, 'chapter-journey-contract.json'), '--lane', options.journeyLane ?? 'continuous',
    '--mode', options.journeyMode ?? 'manual', '--hardware-only', '--base-url', options.preview,
    '--output', output, '--report', report];
  if (options.headed) args.push('--headed');
  return args;
}

const commandConfig = argv => ({ argv: argv.map((value, index) => ({
  '--output': '{out}', '--report': '{out}/report.json', '--base-url': '{preview}',
})[argv[index - 1]] ?? value), cwd: 'main' });

async function executeGate(context, root, kind, options) {
  releaseCommandBudget(context.state);
  const directory = path.join(root, `${kind}-${randomUUID()}`);
  fs.mkdirSync(directory, { recursive: true });
  const before = currentIdentity(context);
  const args = commandArguments(context, kind, directory, options);
  const keyConfig = commandConfig([process.execPath, ...args]);
  const keyIdentity = { source: context.bundle.source, build: context.bundle.build, kind };
  const dependencyKey = commandKey(context.repo, keyConfig, keyIdentity);
  const toolRef = reference(context.repo, path.join(context.repo, 'main', args[0]));
  const log = path.join(directory, 'command.log');
  const startedAt = new Date().toISOString();
  // The gate runner owns the command receipt; caller-supplied JSON cannot replace
  // an actual invocation or silently turn a smoke probe into release evidence.
  const heavy = ['mechanical', 'journey'].includes(kind);
  requireThat(!heavy || path.isAbsolute(context.state.brief.heavyLock), 'Missing shared heavy-job lock');
  const budget = releaseCommandBudget(context.state);
  const result = await runProcess(heavy ? 'flock' : process.execPath,
    heavy ? ['-E', '75', '-w', '30', context.state.brief.heavyLock, process.execPath, ...args] : args, { cwd: path.join(context.repo, 'main'),
    log, timeoutMs: budget.timeoutMs, maxBytes: 16 * 1024 * 1024,
    env: { PARAVOXIA_ALLOW_SWIFTSHADER: '0' }, shouldStop: () => fs.existsSync(path.join(context.run, 'STOP')) ? 'owner-stop'
      : !adaptiveBudget(context.state) && elapsedClock(context.state).remainingMs <= 0 ? 'budget:endToEndMs' : false });
  const after = currentIdentity(context);
  const dependencyKeyAfter = commandKey(context.repo, keyConfig, keyIdentity);
  requireThat(!dependencyKey || dependencyKeyAfter === dependencyKey, `${kind} probe dependencies changed during execution`);
  const reportPath = path.join(directory, 'report.json');
  if (['registry', 'authority', 'journey-contract'].includes(kind)) {
    const text = fs.readFileSync(log, 'utf8');
    try { writeJson(reportPath, JSON.parse(text)); } catch { /* invalid output is blocked below */ }
  }
  const receipt = { schema: COMMAND_SCHEMA, kind, candidate: before, candidateAfter: after,
    argv: [process.execPath, ...args], cwd: 'main', tool: toolRef, heavyLock: heavy ? context.state.brief.heavyLock : null, startedAt, finishedAt: new Date().toISOString(),
    keyConfig, dependencyKey, dependencyKeyAfter,
    budget, exitCode: result.exitCode,
    reason: !adaptiveBudget(context.state) && elapsedClock(context.state).remainingMs <= 0 ? 'budget:endToEndMs' : result.reason ?? null,
    log: reference(context.repo, log),
    report: fs.existsSync(reportPath) ? reference(context.repo, reportPath) : null,
    inputs: { registry: reference(context.repo, path.join(context.repo, 'main/chapter-registry.json')),
      journeyContract: reference(context.repo, path.join(context.repo, 'main/chapter-journey-contract.json')) } };
  const receiptPath = path.join(directory, 'command.json'); writeJson(receiptPath, receipt);
  return reference(context.repo, receiptPath);
}

export function validateGateReceipt(context, ref, kind, { fresh = false } = {}) {
  const { repo, identity } = context;
  const receipt = readRef(repo, ref);
  requireThat(receipt.schema === COMMAND_SCHEMA && receipt.kind === kind && receipt.exitCode === 0 && !receipt.reason,
    `${kind} deterministic command did not pass`);
  requireThat(same(receipt.candidate, identity) && same(receipt.candidateAfter, identity), `${kind} receipt belongs to a stale candidate`);
  requireThat(Array.isArray(receipt.argv) && same(receipt.keyConfig, commandConfig(receipt.argv)), 'Gate dependency key must bind the executed command');
  const key = commandKey(repo, receipt.keyConfig, { source: context.bundle.source, build: context.bundle.build, kind });
  requireThat((key && key === receipt.dependencyKey && key === receipt.dependencyKeyAfter) || (fresh && !receipt.dependencyKey),
    `${kind} probe dependency identity changed or cannot be bounded; run this gate again`);
  requireThat(receipt.cwd === 'main' && Array.isArray(receipt.argv), `${kind} has no executable command provenance`);
  const expectedTool = kind === 'authority' || kind === 'registry' ? 'tools/chapter-registry-gate.mjs'
    : kind === 'journey-contract' ? 'tools/chapter-journey-contract-gate.mjs'
      : kind === 'mechanical' ? 'tools/chapter-acceptance.mjs' : 'tools/chapter-journey-probe.mjs';
  requireThat(receipt.argv[1] === expectedTool && receipt.tool.path === `main/${expectedTool}`
    && !receipt.argv.some(arg => ['--self-test', '--smoke', '--debug', '--skip-preflight', '--skip-predecessor', '--scenario'].includes(arg)), 'Noncertifying or unexpected gate command');
  refs(repo, [receipt.tool, receipt.log, receipt.inputs.registry, receipt.inputs.journeyContract]);
  requireThat(receipt.inputs.registry.path === 'main/chapter-registry.json'
    && receipt.inputs.journeyContract.path === 'main/chapter-journey-contract.json', 'Release uses canonical registry and journey contract');
  const report = readRef(repo, receipt.report);
  if (kind === 'journey-contract') requireThat(report.schema === 'paravoxia.chapterJourneyContractGateReport.v1'
    && report.status === 'passed' && report.issues?.length === 0, 'Journey contract gate failed');
  if (kind === 'registry') requireThat(report.ok === true && Array.isArray(report.failures) && report.failures.length === 0, 'Registry gate failed');
  if (kind === 'authority') requireThat(report.schema === 'paravoxia.chapterSceneAuthorityCertificationReport.v1'
    && report.chapterId === identity.chapter && report.certified === true && report.structural?.ok === true
    && report.failures?.length === 0 && report.sceneAuthority?.contracts?.length > 0, 'Current production/scene authority is not certified');
  if (kind === 'mechanical') {
    requireThat(report.schema === 'paravoxia.chapterMechanicalEvidence.v1' && report.chapter?.id === identity.chapter
      && report.execution?.certifyingMode === true && report.sourceVerification?.status === 'matched', 'Mechanical report is noncertifying or stale');
    const flags = ['targetChapterMatchesInput', 'candidateRevisionMatchesInput', 'requiredObjectiveBeatsPassed',
      'requiredVariantProfilesPassed', 'performanceBudgetsPassed', 'registeredEvidenceProofComplete',
      'boundaryProofComplete', 'preflightAuthorityCertified', 'machineReadyForCouncilReview'];
    requireThat(flags.every(flag => report[flag] === true) && report.runs?.length >= report.chapter.minimumColdRuns
      && report.runs.every(run => run.status === 'passed') && report.openGates?.length === 0, 'Full functional/variant/performance/boundary gates are incomplete');
    const revisionIndex = receipt.argv.indexOf('--candidate-revision');
    requireThat(revisionIndex > 0 && report.source?.revision === receipt.argv[revisionIndex + 1], 'Mechanical revision differs from recorded invocation');
  }
  if (kind === 'journey') {
    requireThat(report.schema === 'paravoxia.chapterJourneyEvidence.v1' && report.chapterId === identity.chapter
      && report.status === 'passed' && report.machineJourneyCertified === true
      && report.lane?.machineJourneyCertifying === true && report.lane.id !== 'direct-entry-diagnostic'
      && report.hardwareAttestation?.status === 'passed', 'Journey evidence is diagnostic or lacks hardware/certifying proof');
    requireThat(report.contract?.sha256 === receipt.inputs.journeyContract.sha256, 'Journey contract changed since runtime evidence');
    const contract = readRef(repo, receipt.inputs.journeyContract);
    const chapter = contract.chapters.find(chapter => chapter.id === identity.chapter);
    const required = [...(report.lane.requestedControlMode === 'manual' ? chapter.inputContracts ?? [] : []),
      ...chapter.interactionContracts ?? [], ...chapter.lifecycleContracts ?? []].map(value => value.id);
    requireThat(required.length > 0 && report.scenarios?.length === required.length
      && new Set(report.scenarios.map(result => result.id)).size === required.length
      && required.every(id => report.scenarios.some(result => result.id === id && result.status === 'passed')), 'Journey scenario coverage is incomplete');
  }
  return receipt;
}

/** Run light gates once, optionally run full deterministic probes, and reuse
 * exact command receipts. The disposition never grants human/publication rights. */
export async function finalizeReleaseReviews(repo, input, options = {}) {
  const context = loadReleaseReviews(repo, input, { requireBudget: true });
  releaseCommandBudget(context.state);
  const specialists = validateSpecialists(context, options.specialistReviews ?? []);
  const out = inside(repo, path.relative(repo, path.join(context.run, 'release')), { exists: false });
  requireThat(!fs.existsSync(out) || !fs.lstatSync(out).isSymbolicLink(), 'Release output must not be a symlink');
  fs.mkdirSync(out, { recursive: true });
  const packetPath = path.join(out, 'release-gates.json');
  const packet = options.releaseGates ? readJson(inside(repo, options.releaseGates))
    : fs.existsSync(packetPath) ? readJson(packetPath) : { schema: 'paravoxia.chapterLoopReleaseGates.v1', commands: {} };
  requireThat(packet.schema === 'paravoxia.chapterLoopReleaseGates.v1' && packet.commands && typeof packet.commands === 'object', 'Expected a release gate command packet');
  const gates = {}, blockers = [], freshReceipts = new Set();
  const check = (kind, ref) => {
    try { validateGateReceipt(context, ref, kind, { fresh: freshReceipts.has(ref?.path) }); gates[kind] = { status: 'passed', receipt: ref }; return true; }
    catch (error) { gates[kind] = { status: 'blocked', receipt: ref ?? null, reason: error.message }; return false; }
  };
  for (const kind of ['registry', 'authority', 'journey-contract']) {
    // Authority dependencies are external to the game identity. Re-evaluate
    // signatures/current final quality rather than trusting yesterday's receipt.
    packet.commands[kind] = await executeGate(context, out, kind, options);
    writeJson(packetPath, packet);
    freshReceipts.add(packet.commands[kind].path);
    check(kind, packet.commands[kind]);
  }
  for (const kind of ['mechanical', 'journey']) {
    const requested = kind === 'mechanical' ? options.runMechanical : options.runJourney;
    if (requested && !check(kind, packet.commands[kind])) {
      if (['registry', 'authority', 'journey-contract'].some(gate => gates[gate].status !== 'passed')) {
        gates[kind].reason = 'Current registry, authority and journey-contract gates must pass before an expensive runtime probe';
        continue;
      }
      let preview;
      try {
        releaseCommandBudget(context.state);
        if (kind === 'journey') preview = await startPreview(inside(repo, context.bundle.dist), path.join(out, `preview-${randomUUID()}.log`));
        packet.commands[kind] = await executeGate(context, out, kind, { ...options, preview: preview?.url });
        writeJson(packetPath, packet);
        freshReceipts.add(packet.commands[kind].path);
        if (preview) await preview.verify();
      } finally { preview?.close(); }
    }
    check(kind, packet.commands[kind]);
  }
  writeJson(packetPath, packet);
  for (const [kind, gate] of Object.entries(gates)) if (gate.status !== 'passed') blockers.push(`${kind}: ${gate.reason}`);
  blockers.push(...specialists.missing.map(domain => `Focused ${domain} code review required for: ${specialists.triggers[domain].join(', ')}`));
  currentIdentity(context);
  const clock = releaseCommandBudget(context.state);
  const report = {
    schema: REVIEW_SCHEMA, createdAt: new Date().toISOString(), mode: 'deterministic-chapter-loop-consolidation',
    identity: context.identity, provenance: context.provenance, reviewStatus: 'three-independent-reviews-validated', clock,
    reviews: context.reviews, specialistReview: specialists, deterministicGates: gates,
    findings: context.reviews.flatMap(review => review.findings.map(finding => ({ ...finding, reviewRole: review.role, session: review.session }))),
    keep: [...new Set(context.reviews.flatMap(review => review.keep))],
    disposition: blockers.length ? 'blocked-authority-or-evidence' : 'machine-ready-for-human-taste',
    blockers, humanTaste: { status: 'pending', automatedDecisionAllowed: false }, publication: { authorized: false },
    scope: 'Reuse only these exact game source/build/media and recipe/canon reviews. Fixture/unit tests never certify a chapter.',
    continueCommand: `node main/tools/creative-chapter-acceptance-workflow.mjs --chapter-loop ${path.relative(repo, context.run)} --run-mechanical --run-journey --journey-lane continuous --journey-mode manual --headed`,
  };
  const reportPath = path.join(out, 'release-review.json'); writeJson(reportPath, report);
  return { report, reportPath, packetPath };
}
