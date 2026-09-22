import fs from 'node:fs';
import path from 'node:path';
import { requireThat, sha } from './contract.mjs';
import { MAX_CHAPTER_MS } from './budget.mjs';
import { acquireLock, readJson, writeJson, reference, checkRef, snapshot, differences, inside } from './store.mjs';

export function releasePolicySnapshot(value, prefix = '') {
  const result = {};
  for (const [key, child] of Object.entries(value ?? {})) {
    const name = `${prefix}/${key}`;
    if (/release|publish|demo/i.test(key)) result[name] = child;
    else if (child && typeof child === 'object') Object.assign(result, releasePolicySnapshot(child, name));
  }
  return result;
}

// A new owner commission may finish a retained, unsuccessful builder. It does
// not replay planning, change its recipe, replenish tokens or invent evidence.
export function prepareFinishRenewal(repo, state, a, { now = Date.now(), policySeal, validateBrief } = {}) {
  requireThat(a?.schema === 'paravoxia.chapterFinishAuthority.v1'
    && a.request === 'lets fix the blockers you encountered and finish it up'
    && a.runId === state.id && a.chapter === state.chapter && a.extraInfrastructureRetries === 1,
  'Explicit owner finish commission required');
  requireThat(!state.active && !state.finishRenewals?.length && state.status === 'BLOCKED_CONTRACT'
    && state.queue[state.cursor] === 'build' && !state.receipts.build && state.receipts.recipe,
  'Finish renewal requires the retained unsuccessful builder');
  requireThat(policySeal(state) === state.policySha256 && a.previousPolicySha256 === state.policySha256
    && a.previousStateSha256 === sha(state), 'Finish renewal checkpoint differs');
  const started = Date.parse(a.requestedAt), deadline = Date.parse(a.deadlineAt);
  requireThat(Number.isFinite(started) && started <= now && deadline === started + MAX_CHAPTER_MS
    && deadline > now && Date.parse(state.clock?.deadlineAt) <= started,
  'Finish renewal must use the new request time after the old deadline');
  requireThat(a.recipeSha256 === state.receipts.recipe.sha256, 'Finish renewal cannot replace the recipe');
  checkRef(repo, state.receipts.recipe);
  const transport = readJson(checkRef(repo, a.builderTransport));
  const rawFile = checkRef(repo, a.builderResult), raw = readJson(rawFile);
  requireThat(transport.completed && transport.reported && transport.exitCode === 0 && !transport.reason
    && transport.session && raw.verdict === 'BLOCKED', 'Retained completed BLOCKED builder required');
  const roleDir = `${path.relative(repo, a.runPath)}/roles/${state.usage.roleLaunches}-build`;
  requireThat(a.builderTransport.path === `${roleDir}/transport.json` && a.builderResult.path === `${roleDir}/last-message.txt`
    && a.builderPacket.path === `${roleDir}/packet.json`, 'Builder artifacts must belong to the retained last role');
  const events = fs.readFileSync(inside(repo, `${roleDir}/transcript.jsonl`), 'utf8').split('\n')
    .flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
  const final = events.findLast(e => e.type === 'item.completed' && e.item?.type === 'agent_message')?.item?.text;
  requireThat(typeof final === 'string' && sha(final.trim()) === sha(fs.readFileSync(rawFile, 'utf8').trim()),
    'Builder result differs from the retained provider transcript');
  const transcript = readJson(checkRef(repo, a.builderPacket));
  requireThat(transcript.stage === 'build', 'Builder packet required');
  const current = snapshot(repo), listed = new Map((a.files ?? []).map(f => [f.path, f]));
  requireThat(listed.size === a.files?.length, 'Finish repair file list must be unique');
  for (const name of new Set([...differences(state.acceptedSource, current), ...Object.keys(state.frozen)
    .filter(n => sha(fs.readFileSync(inside(repo, n))) !== state.frozen[n])]))
    requireThat(listed.has(name), `Unlisted finish repair: ${name}`);
  for (const [name, f] of listed) {
    requireThat(name === 'main/tools/chapter-loop.mjs' || name.startsWith('main/tools/chapter-loop/')
      || name === 'docs/chapter-loop/control-config.md', 'Finish preparation owns transport and its schema documentation only');
    requireThat(name !== 'main/tools/chapter-loop/contract.mjs', 'Finish renewal cannot change numerical ceilings or role commissions');
    requireThat(f.before === (state.frozen[name] ?? state.acceptedSource[name] ?? null)
      && f.after === sha(fs.readFileSync(inside(repo, name))), `Finish source hash differs: ${name}`);
  }
  const validation = readJson(checkRef(repo, a.validation));
  requireThat(validation.passed === true && validation.handoffSha256 === sha(a.files)
    && validation.checks?.length && validation.review, 'Exact tests and independent handoff review required');
  for (const ref of [...validation.checks, validation.review]) checkRef(repo, ref);
  const review = readJson(checkRef(repo, validation.review));
  requireThat(review.verdict === 'PASS' && review.handoffSha256 === sha(a.files), 'Independent handoff review must bind the exact repair');
  checkRef(repo, a.handoff);
  const brief = structuredClone(state.brief);
  requireThat(sha(a.allowedPathAdditions) === sha(['main/story-authority.json', 'main/src/game/systems/interactionSystem.ts'])
    && sha(a.lookMedia) === sha([{kind:'frame',path:'frame.png'}]), 'Finish ownership and frame binding must be declared in the authority');
  brief.allowedPaths = [...new Set([...brief.allowedPaths, ...a.allowedPathAdditions])];
  brief.verification.observe.look.media = a.lookMedia;
  // Tool refs may include edited transport; retain their paths, refresh only
  // source hashes proven in this preparation, never replace their semantics.
  brief.toolRefs = brief.toolRefs.map(ref => listed.has(ref.path) ? { ...ref, sha256: listed.get(ref.path).after } : ref);
  validateBrief(repo, brief);
  const frozen = { ...state.frozen };
  for (const [name, f] of listed) frozen[name] = f.after;
  return { ...state, brief, frozen, acceptedSource: current, status: 'RUNNING', activeRole: null,
    clock: { schema: 'paravoxia.chapterClock.v1', chapter: state.chapter, startedAt: a.requestedAt,
      deadlineAt: a.deadlineAt, maxElapsedMs: MAX_CHAPTER_MS, existingRun: state.id },
    repairHandoff: a.handoff, protectedReleasePolicy: releasePolicySnapshot(readJson(inside(repo, 'main/story-authority.json'))) };
}

export function renewFinish(repo, run, authorityFile, helpers) {
  const unlock = acquireLock(path.join(run, '.runner.lock'));
  try {
    const file = path.join(run, 'state.json'), previous = readJson(file), a = readJson(authorityFile);
    requireThat(a.runPath === run, 'Finish authority run path differs');
    const next = prepareFinishRenewal(repo, previous, a, helpers), authority = reference(repo, authorityFile);
    const dir = path.join(run, 'finish-renewals', authority.sha256); fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(file, path.join(dir, 'previous-state.json'), fs.constants.COPYFILE_EXCL);
    fs.copyFileSync(path.join(run, 'observations.json'), path.join(dir, 'previous-observations.json'), fs.constants.COPYFILE_EXCL);
    const renewal = { authority, previousState: reference(repo, path.join(dir, 'previous-state.json')),
      previousObservations: reference(repo, path.join(dir, 'previous-observations.json')),
      firstPlayableDeadlineAt: new Date(Date.parse(a.requestedAt) + next.limits.firstPlayableMs).toISOString(),
      at: new Date().toISOString(), retainedSpend: { usage: previous.usage, activeMs: previous.activeMs, retries: previous.retries } };
    next.finishRenewals = [renewal];
    next.ownerRecoveries = [...(previous.ownerRecoveries ?? []), { authority, failureSha256: sha(previous.failure), at: renewal.at }];
    for (const ref of [authority, renewal.previousState, renewal.previousObservations, a.handoff]) next.frozen[ref.path] = ref.sha256;
    next.policySha256 = helpers.policySeal(next);
    writeJson(path.join(repo, '.codex/chapter-loops/clocks', `${next.chapter}.json`), next.clock);
    writeJson(file, next);
    fs.appendFileSync(path.join(run, 'events.jsonl'), JSON.stringify({ type: 'owner-renewed-finish', ...renewal }) + '\n');
    return { status: next.status, next: next.queue[next.cursor], clock: next.clock, retainedSpend: renewal.retainedSpend };
  } finally { unlock(); }
}
