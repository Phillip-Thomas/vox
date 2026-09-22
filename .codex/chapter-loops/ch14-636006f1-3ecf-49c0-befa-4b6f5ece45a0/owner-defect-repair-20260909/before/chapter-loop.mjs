#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initialize, runLoop, recover, observe, handback, validateBrief, policySeal, reconcileNamedEvents } from './chapter-loop/runner.mjs';
import { renewVerification } from './chapter-loop/renewal.mjs';
import { handoffProvider } from './chapter-loop/provider-handoff.mjs';
import { renewFinish } from './chapter-loop/finish-renewal.mjs';
import { adoptAdaptiveBudget } from './chapter-loop/adaptive-budget.mjs';
import { continueComposition } from './chapter-loop/composition-continuation.mjs';
import { readJson, inside, checkRef } from './chapter-loop/store.mjs';
import { startPreview, verifyBundle } from './chapter-loop/evidence.mjs';
import { beginChapter } from './chapter-loop/budget.mjs';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2); const action = args.shift();
function option(name) { const i = args.indexOf(`--${name}`); return i < 0 ? null : args[i + 1]; }
const help = `Paravoxia Chapter Loop (creation only)
  begin --chapter <id> [--started-at <ISO>] start the eight-hour clock BEFORE preparation
  check --brief <json>                 validate capability/model/context bindings
  init --brief <json> [--limits <json>] initialize one durable chapter allowance
  run --run <directory>                advance or resume that checkpoint
  status --run <directory>             report verdict, evidence and budget
  stop --run <directory>               stop at the next process-control poll
  recover --run <directory>            one deterministic infrastructure recovery
  renew --run <directory> --authority <json> --brief <json> explicit renewed verification commission
  renew-finish --run <directory> --authority <json> explicit repair commission for a retained unsuccessful builder
  adopt-adaptive-budget --run <directory> --authority <json> preserve work and replace a scheduling hard stop with owner-directed guidance
  continue-composition --run <directory> --authority <json> use the existing final refinement for a completed composer REVISE
  continue-verification --run <directory> --authority <json> prove the completed refinement without another edit pass
  handoff-provider --run <directory> --authority <json> explicit zero-content quota recovery
  reconcile-named-events --run <directory> --repair-receipt <json> validate retained event objects without another model call
  preview --run <directory>            serve the archived candidate until Ctrl-C
  observe --run <directory> --kind look|listen  active builder/composer only
Paths are relative to the repository unless absolute. No command publishes.
See docs/chapter-loop.md and docs/chapter-loop/brief.example.json.`;
try {
  let result;
  if (!action || ['help', '--help', '-h'].includes(action)) { console.log(help); }
  else if (action === 'begin') result = beginChapter(repo, option('chapter'), { startedAt: option('started-at') });
  else if (['init', 'check'].includes(action)) {
    if (!option('brief')) throw new Error('--brief required');
    const file = path.resolve(repo, option('brief'));
    if (action === 'check') { validateBrief(repo, readJson(file)); result = { valid: true }; }
    else result = { run: initialize(repo, file, option('limits') ? readJson(path.resolve(repo, option('limits'))) : {}) };
  } else {
    if (!option('run')) throw new Error('--run required');
    const run = inside(repo, path.relative(repo, path.resolve(repo, option('run'))));
    if (action === 'run') result = await runLoop(repo, run);
    else if (action === 'status') result = handback(repo, run, readJson(path.join(run, 'state.json')));
    else if (action === 'stop') { fs.writeFileSync(path.join(run, 'STOP'), 'Owner stop\n'); result = { stopRequested: true, run }; }
    else if (action === 'recover') result = await recover(repo, run, option('repair-receipt') ? path.resolve(repo, option('repair-receipt')) : null);
    else if (action === 'reconcile-named-events') {
      if (!option('repair-receipt')) throw new Error('--repair-receipt required');
      result = reconcileNamedEvents(repo, run, path.resolve(repo, option('repair-receipt')));
    }
    else if (action === 'handoff-provider') {
      if (!option('authority')) throw new Error('--authority required');
      result = handoffProvider(repo, run, path.resolve(repo, option('authority')), { policySeal });
    }
    else if (action === 'renew') {
      if (!option('authority') || !option('brief')) throw new Error('--authority and --brief required');
      result = renewVerification(repo, run, path.resolve(repo, option('authority')), path.resolve(repo, option('brief')), { validateBrief, policySeal });
    }
    else if (action === 'renew-finish') {
      if (!option('authority')) throw new Error('--authority required');
      result = renewFinish(repo, run, path.resolve(repo, option('authority')), { validateBrief, policySeal });
    }
    else if (action === 'adopt-adaptive-budget') {
      if (!option('authority')) throw new Error('--authority required');
      result = adoptAdaptiveBudget(repo, run, path.resolve(repo, option('authority')), { validateBrief, policySeal });
    }
    else if (action === 'continue-composition' || action === 'continue-verification') {
      if (!option('authority')) throw new Error('--authority required');
      result = continueComposition(repo, run, path.resolve(repo, option('authority')), { validateBrief, policySeal, verificationOnly: action === 'continue-verification' });
    }
    else if (action === 'observe') result = await observe(repo, run, option('kind'));
    else if (action === 'preview') {
      const state = readJson(path.join(run, 'state.json')); const bundle = readJson(checkRef(repo, state.receipts.evidence)); verifyBundle(repo, bundle);
      const preview = await startPreview(inside(repo, bundle.dist), path.join(run, `preview-cli-${Date.now()}.log`));
      console.log(JSON.stringify({ url: preview.url + state.brief.previewQuery.query, kind: state.brief.previewQuery.kind, candidate: bundle.candidateSha256 }));
      await new Promise(resolve => { for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { preview.close(); resolve(); }); });
    } else throw new Error(`Unknown action: ${action}`);
  }
  if (result) { console.log(JSON.stringify(result, null, 2)); if (result.status && !['RUNNING', 'READY_FOR_REVIEW'].includes(result.status)) process.exitCode = result.status === 'WAITING_RESOURCE' ? 75 : 2; }
} catch (error) { console.error(`[chapter-loop] ${error.message}`); process.exitCode = 2; }
