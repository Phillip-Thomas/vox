#!/usr/bin/env node
/**
 * Common Ground (ch13) journey probe — v2 of cg-lifecycle-probe.mjs, run-local
 * to 2026-09-05-after-the-hearth. The v1 probe is left untouched so the
 * pre-repair captures keep their exact generator.
 *
 * Adds, over v1:
 *   - ROOT CHECKPOINT CONTROL. verifier-control.json is re-read every
 *     `--control-ms` (default 10 s, always < the 45 s coordination bound). When
 *     root sets action `finish-current-and-checkpoint` (or `pause`/`stop`) the
 *     loop stops at the next sample, still writes every frame, the trace and a
 *     complete summary, and exits 0 with `checkpointed: true` plus the control
 *     record that stopped it. Nothing is left half-written.
 *   - PHYSICAL TRAVERSAL MEASUREMENT. Player pose (`__autopilot.pos`) and the
 *     audit worker's pose (`__auditWorker`) are integrated into an actual walked
 *     path length, with per-sample poses in the trace, a 1 Hz pose ledger, net
 *     displacement, and the ordered list of distinct positions. This measures
 *     real bodies, not the controller's own opinion of its progress.
 *   - RETARGET / SHORTCUT DETECTION. Records every time the walked path turns
 *     back toward a previously visited position (backtrack episodes) and the
 *     largest single-sample jump (teleport candidate).
 *   - STALL DETECTION. Longest window with no beat/objective/anchor/milestone
 *     change AND player displacement under `--stall-units`.
 *   - STOP PREDICATES: --until-beat, --until-anchor, --until-objective,
 *     --until-objective-clear, --until-milestone. Reaching one records
 *     `stopReason` and the elapsed time; not reaching one is a measured failure,
 *     never a rescue.
 *   - Optional HUD-suppressed perceptual frame beside each raw frame
 *     (`--percept`), so UX evidence and perceptual evidence stay distinct.
 *
 * It asserts nothing about taste, and grants nothing to the runtime: every
 * page interaction is read-only except explicitly requested key input.
 *
 *   node cg-journey-probe.mjs --beat ch13-home --lane movie --seconds 240 \
 *        --until-beat ch13-return --strip-s 5 --out post/home-movie-1
 */
import { mkdirSync, writeFileSync, appendFileSync, readFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import process from 'node:process';
import {
  loadContract, objectiveExpectations, anchorsByBeat, contingentAnchorIds,
  ART, CAPTURES, RUN_DIR, REPO_ROOT
} from './lib/cgContract.mjs';
import {
  openParavoxia, waitReady, readState, frameStats, hideUi, showUi,
  SWIFTSHADER, CAPTURE_TIER
} from '../../../../../main/tools/lib/evidence.mjs';
import {
  classifyCaptureProvenance, observation, pairProvenance, classifyLuma, FRAME_ROLES
} from './lib/captureProvenance.mjs';
import {
  selectPlayerPose, selectWorkerPose, normalizeEntities, deriveFootFrames,
  progressSignature, unavailableDiagnostic, scoreFromSnapshot, PATH_METRIC_SEMANTICS,
  CG_DIAGNOSTIC_HOOKS, CG_SCORE_DIAGNOSTIC_HOOKS, CAPSULE, SNAPSHOT_POSE_CANDIDATES
} from './lib/physicalPose.mjs';
import { StallWatch, DEFAULT_STALL_CONFIG } from './lib/stallWatch.mjs';
import { writeSourceSnapshot, snapshotRef, assertFreshOutputDir } from './lib/sourceSnapshot.mjs';
import { createOwnedSessionGuard, failureRecord } from './lib/ownedSession.mjs';

const arg = (name, fallback = null) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1] : fallback;
};
const has = (n) => process.argv.includes(`--${n}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tag = (m) => console.log(`[cg-journey] ${m}`);

const beat = arg('beat', 'ch13-home');
const lane = arg('lane', 'movie');
const seconds = Number(arg('seconds', '180'));
const variant = arg('variant', 'desktop');
const tier = arg('tier', null);
const outName = arg('out', `${beat}-${lane}-${variant}`);
const sampleMs = Number(arg('sample-ms', '100'));
const stripS = Number(arg('strip-s', '0'));
const extraQuery = arg('query', '');
const noShots = has('no-shots');
const percept = has('percept');
const controlMs = Number(arg('control-ms', '10000'));
const stallUnits = Number(arg('stall-units', '0.75'));
const untilBeat = arg('until-beat', null);
const untilAnchor = arg('until-anchor', null);
const untilObjective = arg('until-objective', null);
const untilObjectiveClear = arg('until-objective-clear', null);
const untilMilestone = arg('until-milestone', null);
const holdAfterMs = Number(arg('hold-after-ms', '0'));

// --- opt-in bounded stall predicate (see lib/stallWatch.mjs for the exact rule)
const stallFailMs = Number(arg('stall-fail-ms', '0'));           // 0 => OFF (default)
const stallPhases = (arg('stall-fail-phases', 'walk,interact,on-foot') || '')
  .split(',').map((s) => s.trim()).filter(Boolean);
const stallActorUnits = Number(arg('stall-actor-units', String(DEFAULT_STALL_CONFIG.actorUnits)));
const stallShipUnits = Number(arg('stall-ship-units', String(DEFAULT_STALL_CONFIG.shipUnits)));
const stallHoldMultiplier = Number(arg('stall-hold-multiplier', String(DEFAULT_STALL_CONFIG.holdMultiplier)));
const stallCueGraceMs = Number(arg('stall-cue-grace-ms', String(DEFAULT_STALL_CONFIG.cueGraceMs)));
// A DECLARED deliberate wait: the predicate is inert for this many ms from start.
const manualHoldMs = Number(arg('manual-hold-ms', '0'));
// Optional explicit hook name for the (not yet published) CommonGround diagnostic.
const cgDiagHook = arg('cg-diag-hook', null);
const cgScoreDiagHook = arg('cg-score-diag-hook', null);

const CONTROL_PATH = resolve(RUN_DIR, 'verifier-control.json');
const CHECKPOINT_ACTIONS = new Set(['finish-current-and-checkpoint', 'pause', 'stop', 'halt']);

// --------------------------------------------------------- self-test -------
// Exercises the checkpoint decision and the traversal math with no preview, no
// browser and no game source. Run before every measurement session.
if (has('self-test')) {
  const fail = (m) => { console.error(`[cg-journey self-test] FAIL ${m}`); process.exit(1); };
  const CHK = new Set(['finish-current-and-checkpoint', 'pause', 'stop', 'halt']);
  for (const a of ['finish-current-and-checkpoint', 'pause', 'stop', 'halt']) if (!CHK.has(a)) fail(`action ${a} not a checkpoint`);
  for (const a of ['continue', 'go', '', undefined]) if (CHK.has(String(a))) fail(`action ${a} wrongly a checkpoint`);
  const live = JSON.parse(readFileSync(CONTROL_PATH, 'utf8'));
  if (typeof live.action !== 'string') fail('live verifier-control.json has no action');
  const t = { name: 't', first: null, last: null, path: 0, path2d: 0, maxJump: 0, maxJumpAtMs: null, poses: [], samples: 0, backtracks: [], farthestFromFirst: 0 };
  const trk = (pos, at) => { // mirrors track()
    if (!Array.isArray(pos)) return;
    t.samples += 1;
    if (!t.first) { t.first = [...pos]; t.last = [...pos]; t.poses.push({ atMs: at, pos: [...pos] }); return; }
    const d = Math.hypot(pos[0] - t.last[0], pos[1] - t.last[1], pos[2] - t.last[2]);
    if (d > t.maxJump) { t.maxJump = d; }
    t.path += d;
    const ff = Math.hypot(pos[0] - t.first[0], pos[1] - t.first[1], pos[2] - t.first[2]);
    if (ff > t.farthestFromFirst) t.farthestFromFirst = ff;
    if (t.farthestFromFirst - ff > 1.5) t.backtracks.push({ at });
    t.last = [...pos];
  };
  // an L walk: 10 units +x, then 8 units +z => path 18, net hypot(10,8)=12.806
  for (let i = 0; i <= 10; i += 1) trk([i, 0, 0], i);
  for (let i = 1; i <= 8; i += 1) trk([10, 0, i], 10 + i);
  if (Math.abs(t.path - 18) > 1e-6) fail(`L-walk path ${t.path} != 18`);
  const net = Math.hypot(10, 0, 8);
  if (Math.abs(net - 12.8062) > 1e-3) fail('net displacement math');
  if (t.backtracks.length !== 0) fail('forward L-walk reported a backtrack');
  // a retarget-to-start regression: walk out 6 then return to origin
  for (let i = 5; i >= 0; i -= 1) trk([10, 0, i], 20 + (5 - i));
  if (t.backtracks.length === 0) fail('return toward start not detected as backtrack');
  console.log('[cg-journey self-test] OK — checkpoint actions, L-walk path=18.000, net=12.806, backtrack detection');
  // The behavioural suite for capture provenance, pose sourcing and the stall
  // predicate lives in cg-harness-selftest.mjs (also offline). Run it here too so
  // `--self-test` remains the single pre-session gate.
  const { spawnSync } = await import('node:child_process');
  const HERE_DIR = resolve(dirname(fileURLToPath(import.meta.url)));
  // Both offline suites, so `--self-test` remains the single pre-session gate:
  // the existing harness suite, and the prep suite covering the pre-capture
  // source snapshot and the owned-session cleanup guarantee.
  let status = 0;
  for (const suite of ['cg-harness-selftest.mjs', 'cg-harness-prep-selftest.mjs']) {
    const r = spawnSync(process.execPath, [resolve(HERE_DIR, suite)], { stdio: 'inherit' });
    if (r.status !== 0) status = 1;
  }
  process.exit(status);
}

const ownership = JSON.parse(readFileSync(resolve(ART, 'preview-ownership.json'), 'utf8'));
if (ownership.state !== 'running') {
  throw new Error(`owned preview is "${ownership.state}", not running — refusing to measure or to start one`);
}
const baseUrl = ownership.url;

const { contract, sha256: contractSha } = loadContract();
const expectations = objectiveExpectations(contract);
const beatAnchors = anchorsByBeat(contract).get(beat) ?? [];
const contingent = new Set(contingentAnchorIds(contract));

const outDir = resolve(CAPTURES, outName);
// FRESHNESS GUARD (root review correction). Refusing an existing SNAPSHOT is
// not the same as refusing an existing CAPTURE: every folder written before the
// snapshot feature — all retained failure evidence in verifier/captures/** —
// has no manifest, so a re-used --out name could still have truncated its
// trace.ndjson and overwritten its summary and PNGs. This refuses ANY existing
// nonempty folder, before mkdir and before any write.
const outDirFreshness = assertFreshOutputDir(outDir, { what: 'cg-journey-probe capture' });
mkdirSync(outDir, { recursive: true });

// ------------------------------------------------- pre-capture source snapshot
// Byte-exact copies of THIS probe and the modules it really imports (its local
// libs and the read-only repo probe helpers it pulls in), written into this
// capture's own folder BEFORE the browser opens, so the `probeSha256` recorded
// in summary.json stays reconstructable after the harness is edited again.
// It refuses to overwrite an existing snapshot — which also stops a re-run from
// clobbering an earlier capture, because the refusal happens before the trace is
// truncated. Captures taken before today have no snapshot and are untouched.
const sourceSnapshotManifest = writeSourceSnapshot({
  entryAbs: fileURLToPath(import.meta.url),
  outDir,
  repoRoot: REPO_ROOT,
  note: 'cg-journey-probe capture; source provenance only, no browser, renderer or game claim'
});
const sourceSnapshot = snapshotRef(sourceSnapshotManifest);

const tracePath = join(outDir, 'trace.ndjson');
writeFileSync(tracePath, '');
appendFileSync(tracePath, `${JSON.stringify({ kind: 'source-snapshot', atMs: Date.now(), sourceSnapshot })}\n`);
const frames = [];
const events = [];

const viewport = variant === 'mobile' ? { width: 390, height: 844 } : { width: 1280, height: 720 };
const query = new URLSearchParams({ story: beat, journeyprobe: '1', debug: '1' });
if (lane === 'movie') query.set('movie', '1');
if (tier) query.set('quality', tier);
for (const kv of extraQuery.split('&').filter(Boolean)) {
  const [k, v = '1'] = kv.split('=');
  query.set(k, v);
}
const url = `?${query.toString()}`;

tag(`beat=${beat} lane=${lane} variant=${variant}${tier ? ` tier=${tier}` : ''} url=${baseUrl}${url}`);

// ------------------------------------------------------------ control -------
let lastControlCheck = 0;
let controlStop = null;
let lastControlSeen = null;
function pollControl(force = false) {
  if (!force && Date.now() - lastControlCheck < controlMs) return null;
  lastControlCheck = Date.now();
  try {
    const raw = JSON.parse(readFileSync(CONTROL_PATH, 'utf8'));
    const sig = JSON.stringify(raw);
    if (sig !== lastControlSeen) {
      lastControlSeen = sig;
      appendFileSync(tracePath, `${JSON.stringify({ kind: 'control', atMs: Date.now(), control: raw })}\n`);
      tag(`control action=${raw.action} updatedAt=${raw.updatedAt}`);
    }
    if (CHECKPOINT_ACTIONS.has(String(raw.action))) { controlStop = raw; return raw; }
  } catch (e) {
    appendFileSync(tracePath, `${JSON.stringify({ kind: 'control-error', atMs: Date.now(), error: String(e).slice(0, 200) })}\n`);
  }
  return null;
}
pollControl(true);
if (controlStop) {
  tag(`root control is "${controlStop.action}" before the browser opened — not measuring`);
  writeFileSync(join(outDir, 'summary.json'), `${JSON.stringify({
    schema: 'paravoxia.verifier.cgJourneyProbe.v1', probe: 'cg-journey-probe.mjs',
    checkpointed: true, ranBrowser: false, control: controlStop,
    sourceSnapshot,
    request: { beat, lane, variant, tier, seconds }
  }, null, 2)}\n`);
  process.exit(0);
}

// ------------------------------------------------------------ session -------
// ---------------------------------------------------------- owned session ---
// The probe-owned browser is adopted by a guard and stopped in a `finally`, so a
// throw in sampling, capture, frameStats, summary writing or the checkpoint path
// can no longer leak it. The root-owned preview is NEVER stopped (the preview
// stub below has a no-op stop), no process is killed, and the original failure is
// re-thrown unchanged so the exit code still reports it.
const guard = createOwnedSessionGuard({ log: tag, label: 'cg-journey-probe owned session' });
let session = null;
let exitCode = 0;
try {
  session = guard.adopt(await openParavoxia({
    url,
    preview: { url: baseUrl, stop() {} },
    build: false,
    viewport,
    isMobile: variant === 'mobile',
    reducedMotion: variant === 'reduced-motion' ? 'reduce' : 'no-preference',
    log: tag
  }));
  const { page } = session;
  await waitReady(page, { timeoutMs: 180_000 });

  // The hook allow-list. `--cg-diag-hook window.__x.y` prepends ONE operator-named
  // candidate (once root/the engineer publish the exact read-only surface) without
  // widening what the probe may otherwise touch.
  const parseHook = (spec) => {
    if (!spec) return null;
    const parts = String(spec).replace(/^window\./, '').replace(/\(\)$/, '').split('.');
    return parts.length === 1
      ? { global: parts[0], member: null, kind: 'operator-supplied-global' }
      : { global: parts[0], member: parts.slice(1).join('.'), kind: 'operator-supplied-member' };
  };
  const DIAG_HOOKS = [parseHook(cgDiagHook), ...CG_DIAGNOSTIC_HOOKS].filter(Boolean).map((h) => ({ ...h }));
  const SCORE_HOOKS = [parseHook(cgScoreDiagHook), ...CG_SCORE_DIAGNOSTIC_HOOKS].filter(Boolean).map((h) => ({ ...h }));

  async function sample() {
    const base = await readState(page);
    const extra = await page.evaluate(() => {
      const out = {};
      try {
        const s = window.__paravoxiaJourneyProbe?.getSnapshot?.();
        if (s) {
          out.objectiveFull = s.objective ?? null;
          out.avFull = s.state?.signedSceneAv ?? null;
          out.receipts = s.receipts ?? null;
          out.entities = Array.isArray(s.entities)
            ? s.entities.map((e) => ({ id: e.id, kind: e.kind ?? null, pos: e.position ?? e.pos ?? null }))
            : null;
          out.prompts = s.interaction?.prompts ?? null;
          out.visiblePromptCount = s.interaction?.visiblePromptCount ?? null;
          out.interactionTrace = (s.interaction?.trace?.entries ?? []).slice(-6);
          out.interactionResolution = s.interaction?.resolution ?? null;
          out.input = s.input ? { keys: s.input.keys ?? null, mode: s.input.mode ?? null } : null;
          out.localActor = s.state?.localActor
            ? { id: s.state.localActor.id ?? null, milestones: s.state.localActor.milestones ?? null }
            : null;
        }
      } catch (e) { out.snapshotError = String(e).slice(0, 160); }
      try {
        const lc = window.__voxObjectiveLifecycle?.();
        if (lc) { out.objectiveLifecycleTrace = lc.map((e) => ({ ...e })); out.objectiveLifecycleCount = lc.length; }
      } catch { /* read-only */ }
      try {
        const t = window.__voxSfxTrace?.();
        if (t) {
          out.sfxTriggerCounts = t.triggerCounts ?? null;
          out.sfxRecent = (t.events ?? []).slice(-8);
          out.sfxTotal = (t.events ?? []).length;
        }
      } catch { /* read-only */ }
      try { out.auditWorker = window.__auditWorker ? { ...window.__auditWorker } : null; } catch { out.auditWorker = null; }
      try {
        const hud = document.querySelector('[data-story-guidance-hud]');
        out.hud = hud ? {
          objectiveId: hud.getAttribute('data-objective-id'),
          markerLabel: hud.getAttribute('data-objective-marker-label'),
          health: hud.getAttribute('data-objective-health'),
          requiresMarker: hud.getAttribute('data-objective-requires-marker'),
          lines: [...hud.querySelectorAll('li, p, span')].map((n) => n.textContent.trim()).filter(Boolean)
        } : null;
      } catch { /* read-only */ }
      try {
        out.markerCount = document.querySelectorAll('[data-objective-marker], [data-story-marker]').length;
      } catch { /* read-only */ }
      return out;
    });
    // -------------------------------------------------- physical + diagnostics
    // A separate, strictly READ-ONLY evaluate. It calls only names from the
    // harness's allow-list, so it can never reach a mutating route planner, a
    // preparation grant or a progress setter, and it swallows nothing silently.
    const phys = await page.evaluate(({ diagHooks, scoreHooks, poseCandidates }) => {
      const out = { hookProbe: { diagnostic: [], score: [] } };
      const readPath = (o, p) => p.split('.').reduce((x, k) => (x == null ? undefined : x[k]), o);
      const tryHooks = (hooks, bucket) => {
        for (const h of hooks) {
          const rec = { hook: h.member ? `window.${h.global}.${h.member}()` : `window.${h.global}()`, present: false, called: false, error: null };
          try {
            const root = window[h.global];
            const fn = h.member ? root?.[h.member] : root;
            rec.present = typeof fn === 'function';
            if (rec.present) {
              const v = h.member ? fn.call(root) : fn();
              rec.called = true;
              out[bucket] = { available: true, value: v, hookUsed: rec.hook };
            }
          } catch (e) { rec.error = String(e).slice(0, 160); }
          out.hookProbe[bucket === 'cgDiagnostic' ? 'diagnostic' : 'score'].push(rec);
          if (out[bucket]) break;
        }
      };
      tryHooks(diagHooks, 'cgDiagnostic');
      tryHooks(scoreHooks, 'cgScoreDiagnostic');
      try {
        const s = window.__paravoxiaJourneyProbe?.getSnapshot?.();
        if (s) {
          // Only `entities`, `schema` and the candidate pose paths are copied out.
          out.journeySnapshot = { entities: s.entities ?? null, schema: s.schema ?? null };
          for (const p of poseCandidates) {
            const v = readPath(s, p);
            if (v !== undefined) {
              // rebuild the nested shape selectPlayerPose expects
              const parts = p.split('.');
              let cur = out.journeySnapshot;
              for (let i = 0; i < parts.length - 1; i += 1) { cur[parts[i]] = cur[parts[i]] ?? {}; cur = cur[parts[i]]; }
              cur[parts[parts.length - 1]] = v;
            }
          }
        }
      } catch (e) { out.journeySnapshotError = String(e).slice(0, 160); }
      try {
        const cap = document.querySelector('[data-story-caption], [data-caption]');
        out.captionActive = Boolean(cap && (cap.textContent ?? '').trim().length > 0);
      } catch { out.captionActive = null; }
      return out;
    }, { diagHooks: DIAG_HOOKS, scoreHooks: SCORE_HOOKS, poseCandidates: [...SNAPSHOT_POSE_CANDIDATES] });

    const merged = { ...base, ...extra, ...phys, tMs: Date.now() };
    merged.entitiesNormalized = normalizeEntities(merged.journeySnapshot?.entities ?? merged.entities ?? null);
    merged.playerPose = selectPlayerPose(merged);
    merged.workerPose = selectWorkerPose(merged);
    merged.cgDiagnostic = merged.cgDiagnostic ?? unavailableDiagnostic(CG_DIAGNOSTIC_HOOKS, 'no candidate CommonGround diagnostic hook is exposed on window');
    // The shipped build exposes score state ONLY inside the probe snapshot, so
    // when no standalone score hook answers, read it from the snapshot already
    // fetched above rather than reporting it unavailable.
    merged.cgScoreDiagnostic = merged.cgScoreDiagnostic
      ?? scoreFromSnapshot(merged.cgDiagnostic)
      ?? unavailableDiagnostic(CG_SCORE_DIAGNOSTIC_HOOKS, 'no candidate CommonGround score diagnostic hook is exposed on window and the probe snapshot carried no score member');
    merged.cgProgressSig = merged.cgDiagnostic.available ? progressSignature(merged.cgDiagnostic.value) : null;
    return merged;
  }

  /** The minimal per-frame observation used for capture provenance. */
  const provObs = (s, atMs) => observation({
    beat: s?.beat ?? null,
    objectiveId: s?.hud?.objectiveId ?? s?.objectiveId ?? null,
    markerLabel: s?.hud?.markerLabel ?? s?.markerLabel ?? null,
    workOrder: s?.objectiveFull?.workOrder ?? null,
    anchorId: s?.avFull?.anchorId ?? null,
    activationSequence: s?.avFull?.activationSequence ?? null,
    milestones: s?.localActor?.milestones ?? s?.milestones ?? null,
    playerPos: s?.playerPose?.pos ?? s?.autopilot?.pos ?? null,
    workerPos: s?.workerPose?.pos ?? s?.auditWorker?.pos ?? null
  }, atMs);

  // Perceptual (HUD-suppressed) twins are expensive (hide + 2 shots + show) and
  // were observed to starve the 10 Hz state sampler during dense event bursts, so
  // they are paired only with coverage-strip and anchor frames. Event frames stay
  // raw HUD-inclusive, which is the evidence class UX review needs anyway.
  // ------------------------------------------------------ per-frame provenance
  // Every screenshot takes its OWN pre-shot and post-shot observation and records
  // the resulting WINDOW. No frame inherits a sibling's state, and a raw frame and
  // its HUD-suppressed partner are never described as simultaneous — the run
  // really does advance between the two shutters (up to ~1 s was observed in
  // post/home-movie-2). When state crosses mid-capture the frame is recorded as
  // lying inside a window rather than being pinned to a fabricated exact anchor.
  /**
   * A deliberately CHEAP observation (one small evaluate, no screenshots, no SFX
   * or interaction trace) so bracketing every frame does not starve the 10 Hz
   * sampler the way the full sample() would.
   */
  async function sampleProvenance() {
    const o = await page.evaluate(() => {
      const out = {};
      try {
        const hud = document.querySelector('[data-story-guidance-hud]');
        out.objectiveId = hud?.getAttribute('data-objective-id') ?? null;
        out.markerLabel = hud?.getAttribute('data-objective-marker-label') ?? null;
      } catch { /* read-only */ }
      try { out.beat = window.__storyBeat ?? null; } catch { /* read-only */ }
      try { out.playerPos = window.__autopilot?.pos ?? null; } catch { /* read-only */ }
      try { out.workerPos = window.__auditWorker?.pos ?? null; } catch { /* read-only */ }
      try {
        const s = window.__paravoxiaJourneyProbe?.getSnapshot?.();
        if (s) {
          out.workOrder = s.objective?.workOrder ?? null;
          out.anchorId = s.state?.signedSceneAv?.anchorId ?? null;
          out.activationSequence = s.state?.signedSceneAv?.activationSequence ?? null;
          out.milestones = s.state?.localActor?.milestones ?? null;
        }
      } catch { /* read-only */ }
      return out;
    });
    return observation(o, Date.now());
  }

  async function shootOne(file, role, label) {
    const pre = await sampleProvenance();
    const bytes = await page.screenshot({ path: file });
    const post = await sampleProvenance();
    const stats = frameStats(bytes);
    const rec = {
      file, label, kind: role.kind, role: { ...role },
      hudSuppressed: role.hudSuppressed,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      bytes: bytes.length, stats,
      luma: classifyLuma(stats),
      // Retained for backwards compatibility with existing readers of old
      // summaries. These are the frame's OWN post-shot values, not a shared state.
      atMs: post.atMs, beat: post.beat, objectiveId: post.objectiveId, anchor: post.anchorId,
      provenance: classifyCaptureProvenance(pre, post)
    };
    frames.push(rec);
    return rec;
  }

  async function shoot(label, { perceptPair = percept && /^(strip|anchor|after-anchor|stop|hold-after|stall-fail)/.test(label) } = {}) {
    if (noShots) return null;
    const idx = String(frames.length).padStart(4, '0');
    const safe = label.replace(/[^\w.-]+/g, '_');
    const file = join(outDir, `${idx}-${safe}.png`);
    const rec = await shootOne(file, FRAME_ROLES.raw, label);
    if (perceptPair) {
      let prec = null;
      try {
        await hideUi(page);
        const pfile = join(outDir, `${idx}-${safe}.percept.png`);
        prec = await shootOne(pfile, FRAME_ROLES.percept, `${label} (hud-suppressed)`);
        prec.pairedWith = file;
      } finally { await showUi(page); }
      if (prec) {
        const pair = pairProvenance(rec, prec);
        prec.pair = pair;
        rec.pairedWithPercept = prec.file;
        rec.pair = pair;
      }
    }
    return rec;
  }

  // ------------------------------------------------------- traversal math -----
  const dist = (a, b) => (Array.isArray(a) && Array.isArray(b) && a.length >= 3 && b.length >= 3)
    ? Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) : null;
  const dist2d = (a, b) => (Array.isArray(a) && Array.isArray(b) && a.length >= 3 && b.length >= 3)
    ? Math.hypot(a[0] - b[0], a[2] - b[2]) : null;

  function makeTracker(name) {
    return {
      name, first: null, last: null, path: 0, path2d: 0, maxJump: 0, maxJumpAtMs: null,
      poses: [], samples: 0, backtracks: [], farthestFromFirst: 0,
      // A change of POSE SOURCE (e.g. boot placeholder -> the published ch13
      // diagnostic) is a measurement discontinuity, not a body movement. It is
      // recorded separately and NEVER silently dropped.
      lastSource: null, sourceSwitches: [], maxJumpSameSource: 0, maxJumpSameSourceAtMs: null,
      pathSameSource: 0
    };
  }
  function track(t, pos, atMs, source = null) {
    if (!Array.isArray(pos) || pos.length < 3 || pos.some((n) => typeof n !== 'number' || !Number.isFinite(n))) return;
    t.samples += 1;
    const sameSource = t.lastSource === source;
    if (!t.first) {
      t.first = [...pos]; t.last = [...pos]; t.lastSource = source;
      t.poses.push({ atMs, pos: [...pos], source });
      return;
    }
    const d = dist(t.last, pos);
    const d2 = dist2d(t.last, pos);
    if (d === null) return;
    if (d > t.maxJump) { t.maxJump = d; t.maxJumpAtMs = atMs; }
    if (!sameSource) {
      t.sourceSwitches.push({ atMs, from: t.lastSource, to: source, apparentJumpUnits: Math.round(d * 1000) / 1000 });
    } else {
      if (d > t.maxJumpSameSource) { t.maxJumpSameSource = d; t.maxJumpSameSourceAtMs = atMs; }
      t.pathSameSource += d;
    }
    t.lastSource = source;
    t.path += d;
    t.path2d += d2 ?? 0;
    const fromFirst = dist(t.first, pos);
    if (fromFirst > t.farthestFromFirst) t.farthestFromFirst = fromFirst;
    // Backtrack: moving materially closer to the start after having been farther.
    if (t.farthestFromFirst - fromFirst > 1.5) {
      const lastBt = t.backtracks[t.backtracks.length - 1];
      if (!lastBt || atMs - lastBt.lastAtMs > 2000) {
        t.backtracks.push({ startedAtMs: atMs, lastAtMs: atMs, farthestFromFirst: t.farthestFromFirst, nowFromFirst: fromFirst });
      } else { lastBt.lastAtMs = atMs; lastBt.nowFromFirst = fromFirst; }
    }
    if (d > 0.05 || atMs - (t.poses[t.poses.length - 1]?.atMs ?? 0) > 1000) t.poses.push({ atMs, pos: [...pos] });
    t.last = [...pos];
  }
  function summarizeTracker(t) {
    return {
      name: t.name, samplesWithPose: t.samples,
      firstPos: t.first, lastPos: t.last,
      walkedPathUnits: Math.round(t.path * 1000) / 1000,
      walkedPathUnitsHorizontal: Math.round(t.path2d * 1000) / 1000,
      netDisplacementUnits: t.first && t.last ? Math.round(dist(t.first, t.last) * 1000) / 1000 : null,
      farthestFromStartUnits: Math.round(t.farthestFromFirst * 1000) / 1000,
      largestSingleSampleJumpUnits: Math.round(t.maxJump * 1000) / 1000,
      largestJumpAtMs: t.maxJumpAtMs,
      // The teleport-candidate figure that is actually about the BODY: jumps across
      // a pose-source change are excluded here and listed in poseSourceSwitches.
      largestSingleSampleJumpUnitsSameSource: Math.round(t.maxJumpSameSource * 1000) / 1000,
      largestJumpSameSourceAtMs: t.maxJumpSameSourceAtMs,
      walkedPathUnitsSameSource: Math.round(t.pathSameSource * 1000) / 1000,
      poseSourceSwitches: t.sourceSwitches,
      backtrackEpisodes: t.backtracks,
      poseLedgerCount: t.poses.length
    };
  }
  const player = makeTracker('player');
  const worker = makeTracker('audit-worker');

  // ------------------------------------------------------------- main loop ----
  // ---------------------------------------------- labelled prerequisite fixture
  // `--prereq-exit-ship` presses the SHIPPED ordinary disembark key (F, the same
  // handler a player uses: App.tsx binds KeyF while surface+flight) exactly once,
  // only if the entry actually booted aboard the ship. It is a PREREQUISITE
  // FIXTURE, recorded as such: it is not part of any cold-journey claim, it grants
  // no milestone, progress, position or route credit, and it is refused if the
  // entry was already on foot.
  const prerequisiteFixtures = [];
  if (has('prereq-exit-ship')) {
    const before = await sample();
    const aboard = before.spaceFlight?.controlMode === 'flight' && before.spaceFlight?.phase === 'surface';
    const rec = {
      type: 'ordinary-disembark',
      labelled: 'PREREQUISITE FIXTURE — not evidence of any journey, passage or beat entry',
      input: 'KeyF (the shipped surface+flight exit handler in App.tsx)',
      grantsProgress: false,
      appliedAt: new Date().toISOString(),
      stateBefore: { spaceFlight: before.spaceFlight ?? null, pos: before.autopilot?.pos ?? null, beat: before.beat ?? null },
      applied: false, stateAfter: null, refusedReason: null
    };
    if (!aboard) {
      rec.refusedReason = 'entry was not surface+flight — no disembark was needed or performed';
    } else {
      await page.keyboard.press('KeyF');
      await sleep(700);
      const after = await sample();
      rec.applied = true;
      rec.stateAfter = { spaceFlight: after.spaceFlight ?? null, pos: after.autopilot?.pos ?? null, beat: after.beat ?? null };
      rec.controlModeChanged = before.spaceFlight?.controlMode !== after.spaceFlight?.controlMode;
    }
    prerequisiteFixtures.push(rec);
    appendFileSync(tracePath, `${JSON.stringify({ kind: 'prerequisite-fixture', atMs: Date.now(), fixture: rec })}\n`);
    tag(`prerequisite-fixture ${JSON.stringify(rec).slice(0, 300)}`);
  }

  const started = Date.now();
  let last = null;
  let lastAnchor = null;
  let lastStrip = 0;
  let pendingAfterShot = null;
  let lastSampledBeat = null;
  let lastSampledObjective = null;
  let lastSampledAnchor = null;
  let stopReason = null;
  let stopAtMs = null;
  const objectiveEntries = [];
  const anchorLedger = [];
  const beatLedger = [];
  const milestoneLedger = [];
  let lastChangeAtMs = started;
  let lastChangePos = null;
  let longestStall = { ms: 0, fromMs: null, toMs: null, beat: null, objectiveId: null, playerMovedUnits: null };
  let stallAccumUnits = 0;
  let poseSourceRecord = null;
  let stallFailure = null;

  // The opt-in FAIL predicate. Disabled unless --stall-fail-ms is given. It never
  // rescues, nudges or grants: it only lets a measured stagnation stop early
  // instead of burning a 300 s GPU budget to learn one bit.
  const stallWatch = new StallWatch({
    enabled: stallFailMs > 0,
    windowMs: stallFailMs > 0 ? stallFailMs : DEFAULT_STALL_CONFIG.windowMs,
    playerUnits: stallUnits,
    actorUnits: stallActorUnits,
    shipUnits: stallShipUnits,
    cueGraceMs: stallCueGraceMs,
    holdMultiplier: stallHoldMultiplier,
    phases: stallPhases
  });

  function noteEvent(type, payload) {
    const rec = { type, atMs: Date.now(), elapsedMs: Date.now() - started, ...payload };
    events.push(rec);
    appendFileSync(tracePath, `${JSON.stringify({ kind: 'event', ...rec })}\n`);
    tag(`${type} ${JSON.stringify(payload).slice(0, 240)}`);
    return rec;
  }
  function markChange(now, s) {
    const stalled = now - lastChangeAtMs;
    if (stalled > longestStall.ms && stallAccumUnits < stallUnits) {
      longestStall = {
        ms: stalled, fromMs: lastChangeAtMs, toMs: now,
        beat: s?.beat ?? null, objectiveId: s?.hud?.objectiveId ?? null,
        playerMovedUnits: Math.round(stallAccumUnits * 1000) / 1000
      };
    }
    lastChangeAtMs = now;
    stallAccumUnits = 0;
    lastChangePos = null;
  }

  while (Date.now() - started < seconds * 1000) {
    const s = await sample();
    const now = Date.now();
    appendFileSync(tracePath, `${JSON.stringify({ kind: 'sample', elapsedMs: now - started, s })}\n`);

    const objId = s.hud?.objectiveId ?? s.objectiveId ?? null;
    const label = s.hud?.markerLabel ?? s.markerLabel ?? null;
    const workOrder = s.objectiveFull?.workOrder ?? null;
    const anchor = s.avFull?.anchorId ?? null;
    const sfxEnter = s.sfxTriggerCounts?.objectiveEnter ?? 0;
    // PRIMARY pose = the journey snapshot's live pose when the bridge exposes one;
    // the rounded __autopilot.pos is retained as SECONDARY either way.
    const playerPos = s.playerPose?.pos ?? s.autopilot?.pos ?? null;
    const workerPos = s.workerPose?.pos ?? s.auditWorker?.pos ?? null;
    if (!poseSourceRecord) {
      poseSourceRecord = {
        player: { ...s.playerPose, pos: undefined },
        worker: { ...s.workerPose, pos: undefined },
        capsule: { ...CAPSULE },
        footFramesAtFirstSample: deriveFootFrames(playerPos),
        cgDiagnostic: s.cgDiagnostic?.available
          ? { available: true, hookUsed: s.cgDiagnostic.hookUsed }
          : s.cgDiagnostic,
        cgScoreDiagnostic: s.cgScoreDiagnostic?.available
          ? { available: true, hookUsed: s.cgScoreDiagnostic.hookUsed }
          : s.cgScoreDiagnostic,
        hookProbe: s.hookProbe ?? null
      };
      appendFileSync(tracePath, `${JSON.stringify({ kind: 'pose-source', atMs: now, poseSource: poseSourceRecord })}\n`);
      tag(`pose-source player=${s.playerPose?.source ?? 'none'} worker=${s.workerPose?.source ?? 'none'} cgDiag=${s.cgDiagnostic?.available ? s.cgDiagnostic.hookUsed : 'UNAVAILABLE'}`);
    }
    const milestones = s.localActor?.milestones ?? s.milestones ?? null;
    lastSampledBeat = s.beat ?? null;
    lastSampledObjective = objId;
    lastSampledAnchor = anchor;

    const prevPlayerLast = player.last ? [...player.last] : null;
    track(player, playerPos, now, s.playerPose?.source ?? null);
    track(worker, workerPos, now, s.workerPose?.source ?? null);
    if (prevPlayerLast && player.last) stallAccumUnits += dist(prevPlayerLast, player.last) ?? 0;

    if (pendingAfterShot && now >= pendingAfterShot.at) {
      await shoot(`after-${pendingAfterShot.label}`);
      pendingAfterShot = null;
    }

    if (!last || last.beat !== (s.beat ?? null)) {
      if (last) noteEvent('beat-change', { from: last.beat, to: s.beat ?? null });
      beatLedger.push({ beat: s.beat ?? null, atMs: now, elapsedMs: now - started, objectiveId: objId, anchor });
      if (last) { await shoot(`beat-${s.beat ?? 'none'}`); markChange(now, s); }
    }

    if (!last || last.objId !== objId) {
      if (last?.objId) noteEvent('objective-clear', { objectiveId: last.objId, beat: s.beat, anchor });
      if (objId) {
        const exp = expectations.get(objId) ?? null;
        objectiveEntries.push({
          objectiveId: objId, atMs: now, elapsedMs: now - started,
          beat: s.beat, enterAnchor: anchor, markerLabel: label, workOrder,
          health: s.hud?.health ?? null, requiresMarker: s.hud?.requiresMarker ?? null,
          markerCountAtEntry: s.markerCount ?? null,
          sfxObjectiveEnterAtEntry: sfxEnter,
          expectedMarkerLabel: exp?.markerLabel ?? null,
          expectedWorkOrder: exp?.workOrder ?? null,
          conditionalWorkOrders: exp?.conditionalWorkOrders ?? [],
          markerLabelMatchesSigned: exp ? label === exp.markerLabel : null,
          playerPosAtEntry: playerPos, workerPosAtEntry: workerPos,
          textStates: []
        });
        noteEvent('objective-enter', { objectiveId: objId, markerLabel: label, workOrder, anchor, health: s.hud?.health ?? null });
        await shoot(`obj-enter-${objId}`);
      }
      markChange(now, s);
    } else if (objId && JSON.stringify(last.workOrder) !== JSON.stringify(workOrder)) {
      const entry = objectiveEntries[objectiveEntries.length - 1];
      entry?.textStates.push({
        atMs: now, elapsedMs: now - started, from: last.workOrder, to: workOrder,
        markerLabelBefore: last.label, markerLabelAfter: label, anchor,
        sfxObjectiveEnterCount: sfxEnter, healthAfter: s.hud?.health ?? null,
        playerPos, workerPos
      });
      noteEvent('objective-text-change', { objectiveId: objId, to: workOrder, markerLabel: label, anchor, sfxEnterCount: sfxEnter });
      await shoot(`obj-text-${objId}`);
      markChange(now, s);
    } else if (objId && last.label !== label) {
      noteEvent('objective-marker-label-change', { objectiveId: objId, from: last.label, to: label });
      markChange(now, s);
    }

    if (anchor !== lastAnchor) {
      await shoot(`anchor-${anchor ?? 'none'}`);
      anchorLedger.push({
        anchorId: anchor, atMs: now, elapsedMs: now - started,
        event: s.avFull?.anchorEvent ?? null, sequence: s.avFull?.activationSequence ?? null,
        beat: s.beat, objectiveId: objId, contingent: contingent.has(anchor),
        playerPos, workerPos
      });
      noteEvent('anchor-change', { from: lastAnchor, to: anchor, sequence: s.avFull?.activationSequence ?? null });
      pendingAfterShot = { label: `anchor-${anchor ?? 'none'}`, at: now + 1200 };
      lastAnchor = anchor;
      markChange(now, s);
    }

    const msSig = JSON.stringify(milestones ?? null);
    if (!last || last.msSig !== msSig) {
      if (last) {
        milestoneLedger.push({ atMs: now, elapsedMs: now - started, beat: s.beat, milestones });
        noteEvent('milestone-change', { beat: s.beat, milestones });
        markChange(now, s);
      } else milestoneLedger.push({ atMs: now, elapsedMs: now - started, beat: s.beat, milestones, initial: true });
    }

    if (stripS > 0 && now - lastStrip >= stripS * 1000) {
      lastStrip = now;
      await shoot(`strip-${s.beat ?? 'none'}`);
    }

    last = { objId, label, workOrder, anchor, beat: s.beat ?? null, msSig };

    // stop predicates
    if (untilBeat && s.beat === untilBeat) { stopReason = `reached-beat:${untilBeat}`; stopAtMs = now; }
    if (untilAnchor && anchor === untilAnchor) { stopReason = `reached-anchor:${untilAnchor}`; stopAtMs = now; }
    if (untilObjective && objId === untilObjective) { stopReason = `reached-objective:${untilObjective}`; stopAtMs = now; }
    if (untilObjectiveClear && events.some((e) => e.type === 'objective-clear' && e.objectiveId === untilObjectiveClear)) {
      stopReason = `cleared-objective:${untilObjectiveClear}`; stopAtMs = now;
    }
    if (untilMilestone && msSig && msSig.includes(untilMilestone)) { stopReason = `milestone:${untilMilestone}`; stopAtMs = now; }
    if (stopReason) {
      noteEvent('stop-predicate', { stopReason, elapsedMs: now - started });
      await shoot(`stop-${stopReason.replace(/[^\w.-]+/g, '_')}`);
      if (holdAfterMs > 0) {
        const holdEnd = Date.now() + holdAfterMs;
        while (Date.now() < holdEnd) {
          const hs = await sample();
          appendFileSync(tracePath, `${JSON.stringify({ kind: 'hold-sample', elapsedMs: Date.now() - started, s: hs })}\n`);
          track(player, hs.playerPose?.pos ?? hs.autopilot?.pos ?? null, Date.now(), hs.playerPose?.source ?? null);
          track(worker, hs.workerPose?.pos ?? hs.auditWorker?.pos ?? null, Date.now(), hs.workerPose?.source ?? null);
          await sleep(sampleMs);
        }
        await shoot(`hold-after-${stopReason.replace(/[^\w.-]+/g, '_')}`);
      }
      break;
    }

    // -------- opt-in bounded stall FAIL (evaluated AFTER the stop predicates so a
    // run that legitimately reached its target is never reclassified as stuck).
    const stallVerdict = stallWatch.update({
      atMs: now,
      // Phase label. LEAD = the chapter's OWN executed rail action from the ch13
      // diagnostic (walk / interact / fly / exit-ship): the legacy
      // `__autopilot.routeAction` reports 'idle' throughout this chapter's screening
      // rail, which silently put the stall predicate OUT OF SCOPE for the whole
      // 2026-09-06 survey probe. The autopilot action stays as the fallback.
      phase: (s.cgDiagnostic?.available ? (s.cgDiagnostic.value?.rail?.action ?? null) : null)
        ?? s.autopilot?.routeAction
        ?? ((s.interactionPrompts?.length ?? 0) > 0 ? 'interact' : (lane === 'movie' ? 'walk' : 'on-foot')),
      beat: s.beat ?? null, objectiveId: objId, markerLabel: label,
      workOrderSig: workOrder == null ? null : JSON.stringify(workOrder),
      anchorId: anchor, activationSequence: s.avFull?.activationSequence ?? null,
      milestoneSig: msSig,
      playerPos, workerPos,
      shipPos: s.system?.pos ?? null,
      controlMode: s.spaceFlight?.controlMode ?? null,
      cgProgressSig: s.cgProgressSig ?? undefined,
      // The PUBLISHED schema nests this under `.diagnostic`; the old flat read
      // always produced null, so a real hold never extended the stall window.
      cgHoldReason: s.cgDiagnostic?.available
        ? (s.cgDiagnostic.value?.diagnostic?.holdReason ?? s.cgDiagnostic.value?.holdReason ?? null)
        : null,
      captionActive: s.captionActive === true,
      manualHold: manualHoldMs > 0 && (now - started) < manualHoldMs
    });
    if (stallVerdict.fired) {
      stallFailure = stallVerdict.report;
      noteEvent('stall-fail', {
        verdict: 'FAIL-STALL', windowMs: stallFailure.windowMs,
        requiredWindowMs: stallFailure.requiredWindowMs,
        playerMovedUnits: stallFailure.playerMovedUnitsInWindow,
        physicalProgressObserved: stallFailure.physicalProgressObserved
      });
      // Capture the frozen moment, then fall through to the ordinary graceful
      // finalization path: trace, frames, summary, session.stop(). No rescue.
      await shoot('stall-fail');
      stopReason = 'stall-fail';
      stopAtMs = now;
      break;
    }

    if (pollControl()) {
      noteEvent('root-checkpoint', { action: controlStop.action, updatedAt: controlStop.updatedAt });
      await shoot('root-checkpoint');
      break;
    }

    await sleep(sampleMs);
  }

  markChange(Date.now(), last ? { beat: last.beat, hud: { objectiveId: last.objId } } : null);
  const finalState = await sample();
  const endedAt = Date.now();

  // A probe measures; it never accepts. `outcome` is the honest classification of
  // how this capture ENDED — none of its values is a pass, and a timeout, a stall
  // or a root checkpoint can never be read as success.
  const outcome = stallFailure
    ? 'FAIL-STALL'
    : controlStop
      ? 'CHECKPOINTED-INCONCLUSIVE'
      : stopReason
        ? 'REACHED-STOP-PREDICATE'
        : 'BUDGET-EXHAUSTED-INCONCLUSIVE';

  const summary = {
    schema: 'paravoxia.verifier.cgJourneyProbe.v2',
    supersedesSchema: 'paravoxia.verifier.cgJourneyProbe.v1',
    outcome,
    outcomeIsAcceptance: false,
    outcomeNote: 'Reaching a stop predicate means the requested state was OBSERVED, not that the chapter passed. A stall, timeout or checkpoint is never success. No visual-taste, audibility or chapter-acceptance claim is made anywhere in this file.',
    runId: '2026-09-05-after-the-hearth',
    probe: 'cg-journey-probe.mjs',
    probeSha256: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'),
    // The retained bytes behind that hash, inside THIS capture's own folder,
    // written before the capture started. It applies to this capture only and
    // makes no claim about earlier captures, which predate the feature.
    sourceSnapshot,
    outDirFreshness,
    probeSha256Reconstructable: sourceSnapshot.available === true && sourceSnapshot.entrySha256 != null,
    // PRE-CLEANUP. This is read inside the try block, so sessionStopped here is
    // the state BEFORE the finally runs. The actual outcome is written after the
    // finally to cleanup-receipt.json; prefer that file.
    cleanup: { ...guard.describe(), phase: 'pre-finally', isFinalCleanupOutcome: false, actualOutcomeAt: 'cleanup-receipt.json' },
    contractSha256: contractSha,
    preview: { url: baseUrl, indexSha256: ownership.indexSha256, buildHash: ownership.buildHash ?? null, ownershipState: ownership.state },
    renderer: session.renderer,
    rendererClass: /swiftshader|software|llvmpipe|swangle/i.test(String(session.renderer)) ? 'software' : 'hardware',
    headed: session.headed,
    captureTier: CAPTURE_TIER,
    swiftshaderAllowed: SWIFTSHADER,
    prerequisiteFixtures,
    prerequisiteFixtureNote: 'Any fixture listed here is explicitly labelled setup performed through shipped player input. A run containing a fixture is NOT a cold no-rescue journey and is never reported as one.',
    request: {
      beat, lane, variant, tier, seconds, url: `${baseUrl}${url}`, viewport,
      stopPredicates: { untilBeat, untilAnchor, untilObjective, untilObjectiveClear, untilMilestone }
    },
    startedAt: new Date(started).toISOString(),
    endedAt: new Date(endedAt).toISOString(),
    elapsedMs: endedAt - started,
    stopReason: stopReason ?? (controlStop ? 'root-checkpoint' : 'seconds-budget-exhausted'),
    stopElapsedMs: stopAtMs ? stopAtMs - started : null,
    checkpointed: Boolean(controlStop),
    control: controlStop ?? null,
    beatAnchorsExpected: beatAnchors.map((a) => ({ id: a.id, order: a.order, contingent: contingent.has(a.id) })),
    beatLedger,
    anchorLedger,
    objectiveEntries,
    milestoneLedger,
    traversal: {
      player: summarizeTracker(player),
      auditWorker: summarizeTracker(worker),
      semantics: PATH_METRIC_SEMANTICS,
      note: 'Walked path is integrated from actual sampled body poses at the probe sample rate; it is a lower bound on true path length and is independent of any runtime progress counter.'
    },
    // WHICH body, at WHAT precision, in WHICH frame — recorded once, honestly.
    poseSource: poseSourceRecord,
    physicalDiagnostics: {
      cgDiagnostic: finalState.cgDiagnostic ?? null,
      cgScoreDiagnostic: finalState.cgScoreDiagnostic ?? null,
      hookProbe: finalState.hookProbe ?? null,
      hookOverrides: { cgDiagHook, cgScoreDiagHook },
      readOnly: true,
      note: 'Diagnostics are FEATURE-DETECTED from an allow-list of candidate read-only hook names. No mutating route planner, preparation grant or progress setter is ever called, and no hook name is assumed. When nothing answers, the record says unavailable — that is an unmeasured gap, not a pass.'
    },
    stallObservational: {
      longest: longestStall,
      thresholdUnits: stallUnits,
      note: 'OBSERVATIONAL only: the longest window with no beat/objective/anchor/milestone change AND player displacement under the threshold. It never stopped the run.'
    },
    stallPredicate: {
      ...stallWatch.describe(),
      firedThisRun: Boolean(stallFailure),
      failure: stallFailure
    },
    playerPoseLedger: player.poses,
    workerPoseLedger: worker.poses,
    events,
    frames,
    capturePolicy: {
      perFrameProvenance: true,
      sharedStateAcrossFrames: false,
      rawAndPerceptSimultaneous: false,
      note: [
        'Each frame carries its OWN pre-shot and post-shot observation and the window between them. No frame inherits a sibling frame\'s state.',
        'A raw HUD-inclusive frame and its HUD-suppressed partner are two sequential screenshots taken up to ~1 s apart while gameplay advances. They are recorded with their real offset and are NEVER labelled simultaneous or used as exact before/at/after anchor evidence.',
        'When tracked state changes while the shutter is open the frame is reported as lying INSIDE a window (atStateClaimable:false) rather than pinned to a fabricated exact anchor instant.',
        'HUD suppression is the shipped evidence helper\'s intentional behaviour and is restored immediately after each perceptual frame. Original pixels are written once, hashed, and never re-encoded, cropped or filtered.',
        'A near-black/blank frame is boot or progression evidence only. luma.visualAcceptance is hard-false on every frame; this harness makes no visual-content or taste claim.'
      ]
    },
    objectiveLifecycleTrace: finalState.objectiveLifecycleTrace ?? null,
    finalState: {
      beat: finalState.beat,
      objectiveId: finalState.hud?.objectiveId ?? null,
      markerLabel: finalState.hud?.markerLabel ?? null,
      health: finalState.hud?.health ?? null,
      workOrder: finalState.objectiveFull?.workOrder ?? null,
      milestones: finalState.localActor?.milestones ?? finalState.milestones ?? null,
      anchor: finalState.avFull?.anchorId ?? null,
      autopilot: finalState.autopilot ?? null,
      auditWorker: finalState.auditWorker ?? null,
      prompts: finalState.interactionPrompts ?? null
    },
    pageErrors: session.pageErrors.slice(0, 20),
    sfxNote: 'objectiveEnter counts are runtime SFX queue observations; they are not an audibility or hearing claim.'
  };
  summary.stall = summary.stallObservational; // legacy alias for v1 readers
  writeFileSync(join(outDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  tag(`wrote ${join(outDir, 'summary.json')} (${frames.length} frames, ${events.length} events, stop=${summary.stopReason}, outcome=${outcome})`);
  // Media, trace and summary are fully finalized above before any non-zero exit.
  // A stall FAIL exits 3 so a batch runner stops early; a root checkpoint still
  // exits 0. The exit itself happens AFTER cleanup, so the code is unchanged and
  // the owned browser is never left behind.
  if (stallFailure) {
    tag(`FAIL-STALL after ${stallFailure.windowMs} ms with no observable change — captured and finalized, no rescue attempted`);
    exitCode = 3;
  }
} catch (err) {
  // Honest partial-failure record. Trace lines and frames already written stay
  // exactly as they are; a crashed capture is INCONCLUSIVE, never a pass, and no
  // summary.json is fabricated for it.
  const rec = failureRecord({
    probe: 'cg-journey-probe.mjs', error: err, phase: 'capture-or-summary',
    extra: {
      outDir, sourceSnapshot,
      framesWritten: frames.length, eventsWritten: events.length,
      request: { beat, lane, variant, tier, seconds }
    }
  });
  try { appendFileSync(tracePath, `${JSON.stringify({ kind: 'probe-failure', atMs: Date.now(), failure: rec })}\n`); } catch { /* keep the original error */ }
  try { writeFileSync(join(outDir, 'failure.json'), `${JSON.stringify(rec, null, 2)}\n`); } catch { /* keep the original error */ }
  tag(`FAILED: ${String(err && err.message ? err.message : err)} — ${frames.length} frame(s) and the partial trace are retained; browser cleanup runs next`);
  throw err;
} finally {
  // Exactly-once cleanup of the session this probe opened.
  await guard.stopOnce('probe-finally');
  // ACTUAL post-cleanup outcome, written AFTER the stop settled — including the
  // failure paths, where summary.json may not exist at all. It never changes the
  // original error or the exit code.
  try {
    const receipt = guard.cleanupReceipt({ probe: 'cg-journey-probe.mjs' });
    writeFileSync(join(outDir, 'cleanup-receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
    appendFileSync(tracePath, `${JSON.stringify({ kind: 'cleanup-receipt', atMs: Date.now(), receipt })}\n`);
    tag(`cleanup receipt: state=${receipt.state} stopInvocations=${receipt.sessionStopInvocations} error=${receipt.cleanupError ? 'yes' : 'none'}`);
  } catch (e) {
    tag(`could not write the cleanup receipt (${String(e).slice(0, 120)}) — the original outcome is unchanged`);
  }
}

if (exitCode !== 0) process.exit(exitCode);
