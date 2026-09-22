// Compatibility transport for frozen, already-implemented legacy chapters.
// Runs existing probes unchanged in purpose; never copies their implementations
// or turns their explicitly diagnostic results into chapter continuity proof.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { requireThat, sha } from './contract.mjs';
import { readJson, writeJson, reference } from './store.mjs';
import { captureRuntime, describeRuntimeCapabilities } from './runtime-capture.mjs';

const hardware = d => d?.headed === true && /NVIDIA|AMD|Intel|Apple/i.test(d.renderer ?? '') && !/swiftshader|software|llvmpipe/i.test(d.renderer ?? '');
export function pauseProof(summary, seam, runtime) {
  const p = seam?.attach?.pause;
  const paused = p?.afterSettle;
  const resumed = p?.resumed;
  const interrupted = Boolean(p?.pressedAtMono && (paused?.paused === true || paused?.starMapVisible === true || paused?.resumeVisible === true));
  const recovered = Boolean(p?.resumeClicked && resumed && resumed.paused !== true && resumed.resumeVisible === false && resumed.pauseButtonPresent === true);
  return { hardware: hardware(summary),
    cleanup: runtime?.cleanupComplete === true && runtime?.defaultSinkUnchanged === true,
    interrupted, recovered, acceptedAction: recovered ? 1 : 0,
    cancellationObserved: (seam?.events?.ev ?? []).some(x => x.k === 'cancel' && x.reasonArgObservable && x.mono >= p?.before?.at && x.mono <= p?.afterSettle?.at),
    available: Boolean(p?.before && p?.afterSettle && p?.resumed) };
}
export function readManualProof(raw) {
  const d = readJson(path.join(raw, 'summary.json'));
  // This probe writes its final cleanup receipt into summary.json after its
  // finally block. Continue uses a separate receipt; their formats differ.
  requireThat(d.schema === 'paravoxia.verifier.commonPhysicalDiscriminator.v1', 'Unexpected manual probe schema');
  const cleanup = d.cleanup;
  requireThat(cleanup?.schema === 'paravoxia.verifier.ownedSessionGuard.v1' && cleanup.phase === 'post-finally', 'Manual post-finally cleanup evidence is missing');
  requireThat(cleanup.state === 'stopped' && cleanup.cleanupCompleted === true && cleanup.sessionStopped === true && cleanup.cleanupError === null && d.closing?.ok === true,
    'Manual probe cleanup or closing checks failed; capture is inconclusive');
  return { hardware: hardware(d),
    cleanup: true, ordinaryControls: d.lane?.startsWith('MANUAL SHORT') === true,
    acceptedAction: d.verdict === 'SHORT-HELD-REFERENCE-PROVEN' && d.finalCg?.common?.committed === true && d.finalCg?.common?.workerUnits >= 18 ? 1 : 0 };
}
async function child(entry, args, env, inheritedFd = null) {
  return new Promise((resolve, reject) => {
    const stdio = ['ignore', 'inherit', 'inherit']; if (inheritedFd !== null) stdio[3] = inheritedFd;
    const processChild = spawn(process.execPath, [entry, ...args], { stdio, env: { ...process.env, ...env } });
    const stop = signal => { try { processChild.kill(signal); } catch { /* exited */ } };
    const term = () => stop('SIGTERM'); process.on('SIGTERM', term); process.on('SIGINT', term);
    processChild.once('error', reject);
    processChild.once('close', code => { process.removeListener('SIGTERM', term); process.removeListener('SIGINT', term); resolve(code); });
  });
}
export async function capture({ repo, legacy, out, kind, preview, config = {} }) {
  if (kind === 'capabilities') {
    const result = describeRuntimeCapabilities({ repo, legacy, config });
    writeJson(path.join(out, 'capabilities.json'), result);
    requireThat(result.supported, Object.entries(result.capabilities).filter(([, c]) => !c.supported).map(([k, c]) => `${k}: ${c.blockers.join('; ')}`).join('\n'));
    return result;
  }
  if (kind === 'av' || kind === 'continuity') return captureRuntime({ repo, legacy, out, kind, preview, config });
  const manifest = readJson(path.join(legacy, 'implementation-source-manifest.json'));
  for (const [name, expected] of Object.entries(manifest.hashes)) requireThat(sha(fs.readFileSync(path.join(repo, name))) === expected, `Legacy source changed: ${name}; a new source handoff is required`);
  const owned = readJson(path.join(legacy, 'verifier/artifacts/preview-ownership.json'));
  // Both URLs must serve exactly the frozen baseline. No port-liveness shortcut.
  for (const url of [...new Set([owned.url, preview].filter(Boolean))]) {
    for (const [file, expected] of Object.entries(owned.files)) {
      const response = await fetch(new URL(file, url), { signal: AbortSignal.timeout(10000) });
      requireThat(response.ok && sha(Buffer.from(await response.arrayBuffer())) === expected, `Legacy preview bytes differ: ${file}`);
    }
  }
  fs.mkdirSync(out, { recursive: true });
  if (kind === 'source') { writeJson(path.join(out, 'source-check.json'), { intact: true, files: Object.keys(manifest.hashes).length }); return; }
  const raw = path.join(out, 'capture'); requireThat(!fs.existsSync(raw), 'Capture directory must be fresh');
  const controlFile = path.join(legacy, 'verifier-control.json');
  const before = readJson(controlFile); writeJson(path.join(out, 'previous-control.json'), before);
  const roles = { recovery: 'finale-authority-seam-runtime', continue: 'continue-spawn-verifier', manual: 'manual-grounded-recovery-runtime' };
  let proof, media = [], exitCode = 0;
  try {
    if (roles[kind]) writeJson(controlFile, { ...before, action: 'continue', activeRole: roles[kind], instruction: `Owner resumed via Chapter Loop. One bounded ${kind} capture; no extra roles, source changes or publishing.`, chapterLoopOutput: out, updatedAt: new Date().toISOString() });
    if (kind === 'recovery') {
      exitCode = await child(path.join(legacy, 'verifier/probes/manual-credit-finale/finale-cancellation-candidate/finale-window-runtime.mjs'),
        ['--out', raw, '--heavy-lock-fd', '3', '--child-lock-fd', '3', '--heavy-lock', path.resolve(repo, '../Paraform/harness/output/.heavy.lock'), '--max-session-s', '105'], { SEAM_SCENARIO: 'pause-button-cancel' }, 3);
      const summary = readJson(path.join(raw, 'summary.json'));
      proof = pauseProof(summary, readJson(path.join(raw, 'seam-events.json')), readJson(path.join(raw, 'runtime-record.json')));
      if (!proof.available) throw new Error('Pause/Resume was not fully observed; probe is inconclusive');
    } else if (kind === 'continue') {
      exitCode = await child(path.join(legacy, 'verifier/probes/continue-spawn-candidate/earned-continue-3d-probe.mjs'),
        ['--url', owned.url, '--out', raw, '--heavy-lock-fd', '3', '--expect-source-manifest', sha(fs.readFileSync(path.join(legacy, 'implementation-source-manifest.json'))), '--role', roles[kind]], {}, 3);
      const d = readJson(path.join(raw, 'summary.json')), cleanup = readJson(path.join(raw, 'cleanup-receipt.json'));
      proof = { hardware: hardware(d), cleanup: cleanup.cleanupCompleted === true && cleanup.sessionStopped === true,
        clickedContinue: d.phases?.continue?.uiActions?.some(a => a.action === 'click' && /Continue/.test(a.label)) === true,
        stateEqual: d.requiredGates?.worldSaveEquality === true, newAcceptedAction: d.requiredGates?.actualAcceptedNewAction === true ? 1 : 0 };
    } else if (kind === 'manual') {
      exitCode = await child(path.join(legacy, 'verifier/probes/manual-credit-finale/grounded-recovery-candidate/common-entry-crossing-probe.mjs'),
        ['--url', owned.url, '--out', raw, '--heavy-lock-fd', '3', '--expect-source-manifest', sha(fs.readFileSync(path.join(legacy, 'implementation-source-manifest.json')))], { CUT_MODE: '1' }, 3);
      proof = readManualProof(raw);
    } else throw new Error(`No legacy capability binding for ${kind}`);
    const refs = fs.readdirSync(raw).filter(n => /\.(json|ndjson|png|wav)$/.test(n)).map(n => reference(repo, path.join(raw, n)));
    const data = { schema: 'paravoxia.chapterLoopProbe.v1', candidateSha256: process.env.CHAPTER_LOOP_CANDIDATE, kind, proof, raw: refs, media, exitCode, reused: false };
    writeJson(path.join(out, 'report.json'), data);
    requireThat(exitCode === 0, `Existing ${kind} probe returned ${exitCode}; inspect retained report`);
  } finally {
    const current = readJson(controlFile);
    if (current.chapterLoopOutput === out) writeJson(controlFile, { ...current, action: 'hold', instruction: 'Chapter Loop capture finished; only the checked runner may release another case.' });
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = n => { const i = process.argv.indexOf(`--${n}`); return i < 0 ? undefined : process.argv[i + 1]; };
  try { await capture({ repo: arg('repo') ? path.resolve(arg('repo')) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..'), legacy: arg('legacy'), out: arg('out'), kind: arg('case'), preview: arg('preview')?.startsWith('http') ? arg('preview') : undefined, config: arg('config') ?? {} }); }
  catch (error) { console.error(`PROBE-ERROR-INCONCLUSIVE: ${error.message}`); process.exitCode = 2; }
}
