#!/usr/bin/env node
/**
 * FINALE-WINDOW CLOSURE CHECKS — focused, CPU-only, run-local.
 *
 * These are NOT the earlier 33 structural source-searches (which missed every
 * blocker in producer-finale-window-prep-review.json because they never ran
 * anything). Each check below executes the ACTUAL artefact:
 *   - the ACTUAL in-page sampler function, extracted from the ACTUAL installer
 *     string and run in a node:vm with a mocked window whose getSnapshot
 *     returns the EXACT shape of JourneyRuntimeProbeBridge.buildSnapshot;
 *   - the ACTUAL edge predicate on those produced samples;
 *   - the ACTUAL owned-session guard, with failing context/goto/assert stubs;
 *   - the ACTUAL runtime wrapper's ownership/teardown branches, with pactl and
 *     spawn stubs (no sink, no browser, no recorder is created here).
 * No browser, no GPU, no audio server, no game mutation.
 */
import vm from 'node:vm';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

import { buildInstallerSource, detectEdge, edgeReason, DEFAULT_WINDOW,
         AV_ANCHOR_COMPLETE, AV_ANCHOR_HANDBACK, CG_COMMON_ROUTE_UNITS } from './windowSampler.mjs';
import { parseSinkInputs, verifySinkOwnership, isInProcessTree, moduleIdPresent,
         runCombinedCapture, HARD_MAX_SESSION_S, PRE_EDGE_MS, POST_EDGE_MS,
         resolveSinkIndex, validateInheritedLockFd, buildStdio, assessCoverage } from './finale-window-runtime.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const results = [];
const check = (name, fn) => {
  try { const detail = fn(); results.push({ name, pass: true, detail: detail ?? null }); }
  catch (e) { results.push({ name, pass: false, error: String(e && e.message ? e.message : e).slice(0, 400) }); }
};
const acheck = async (name, fn) => {
  try { const detail = await fn(); results.push({ name, pass: true, detail: detail ?? null }); }
  catch (e) { results.push({ name, pass: false, error: String(e && e.message ? e.message : e).slice(0, 400) }); }
};
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };

/* ---- exact bridge-shaped snapshot (mirrors buildSnapshot's real members) ---- */
function bridgeSnapshot({ beat = 'done', active = false, anchorIds = [AV_ANCHOR_COMPLETE, AV_ANCHOR_HANDBACK],
                          omitAvMember = false, omitHistory = false } = {}) {
  const signedSceneAv = {
    active: false, suspended: false, beat: 'ch13-handback', anchorId: AV_ANCHOR_HANDBACK,
    anchorEvent: 'independent-action-settled', activationSequence: 7,
    ...(omitHistory ? {} : { activationHistoryAnchorIds: anchorIds })
  };
  const state = {
    localActor: { id: 'a1', era: 'common', milestones: ['m1'] },
    shipRestoration: {}, voyage: { 'worker-name': 'w' },
    ...(omitAvMember ? {} : { signedSceneAv })
  };
  return {
    schema: 'paravoxia.journeyRuntimeSnapshot.v1', sampledAt: Date.now(),
    story: { active, chapter: 'ch13', beat, runId: 'run-1' },
    objective: { id: 'obj.ch13.return', health: 'ok', revision: 3 },
    interaction: {}, entities: [], receipts: {}, state, input: {}, preparation: {}
  };
}
function cgProbeSnapshot({ committed = true, workerUnits = 18, terraUnits = 18,
  omitTerra = false, omitCommon = false, nullCommon = false } = {}) {
  const common = { stage: 'tested-common', comparisonProved: true,
    finalReferenceOffered: true, finalReferenceOccupied: true, workerUnits, committed,
    ...(omitTerra ? {} : { terraUnits }) };
  return {
    beat: 'ch13-complete', bodyCentre: [0, 51, 0], railCursor: 4, supported: true,
    score: { beat: 'final-texture', mood: 'settled', finalTextureSeconds: 12.5 },
    diagnostic: { beat: 'ch13-complete', anchors: [AV_ANCHOR_COMPLETE, AV_ANCHOR_HANDBACK],
      ...(omitCommon ? {} : { common: nullCommon ? null : common }) },
    pendingAnchors: []
  };
}

/** Install the ACTUAL sampler in a vm with a mocked window; return sampleNow(). */
function runActualSampler({ journey, cg, journeyThrows = false, noJourneyHook = false }) {
  const rafQueue = [];
  const win = {
    __paravoxiaCommonGround: cg === undefined ? undefined : { snapshot: () => cg },
    __paravoxiaJourneyProbe: noJourneyHook ? undefined
      : { getSnapshot: () => { if (journeyThrows) throw new Error('hook exploded'); return journey; } },
    requestAnimationFrame: (fn) => { rafQueue.push(fn); return rafQueue.length; },
    cancelAnimationFrame: () => {},
    setInterval: () => 0, clearInterval: () => {}, setTimeout: () => 0
  };
  const sandbox = {
    window: win, performance: { now: () => 1000, timeOrigin: 0 },
    document: { visibilityState: 'visible', hidden: false, hasFocus: () => true },
    Date, JSON, Math, Array, Object, String, Number, console,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    requestAnimationFrame: (fn) => { rafQueue.push(fn); return rafQueue.length; },
    cancelAnimationFrame: () => {}
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  const installer = vm.runInContext(`(${buildInstallerSource()})`, sandbox);
  const inv = installer({ ...DEFAULT_WINDOW, driver: 'timer' });
  if (inv && inv.installed === false && inv.reason) throw new Error(`installer refused: ${inv.reason}`);
  return { sample: win.__finaleWindowProbe.sampleNow(), win };
}

/* =============================== 1. imports ================================= */
await acheck('C1 every runtime import resolves from THIS folder (six parents), incl. playwright', async () => {
  const ev = await import('../../../../../../../main/tools/lib/evidence.mjs');
  const ps = await import('../../../../../../../main/tools/lib/previewServer.mjs');
  const os = await import('../lib/ownedSession.mjs');
  // The installed package is playwright-core, resolved BY PATH: a bare
  // specifier does not resolve from a folder outside main/.
  // (Imported by URL, not by importing the probe module, whose top-level
  // main() would start a run.)
  const PLAYWRIGHT_CORE_URL = pathToFileURL(
    resolve(HERE, '..', '..', '..', '..', '..', '..', '..', 'main/node_modules/playwright-core/index.mjs')).href;
  const probeSrc = readFileSync(resolve(HERE, 'finale-window-probe.mjs'), 'utf8');
  if (!probeSrc.includes("'playwright-core', 'index.mjs'")) throw new Error('probe does not resolve playwright-core by path');
  if (/await import\('playwright'\)/.test(probeSrc)) throw new Error('probe still uses the unresolvable bare specifier');
  const pw = await import(PLAYWRIGHT_CORE_URL);
  for (const [n, v] of [['openParavoxia', ev.openParavoxia], ['waitReady', ev.waitReady],
    ['chromePath', ps.chromePath], ['CHROMIUM_ARGS', ps.CHROMIUM_ARGS], ['assertHardwareGl', ps.assertHardwareGl],
    ['createOwnedSessionGuard', os.createOwnedSessionGuard], ['failureRecord', os.failureRecord],
    ['chromium', pw.chromium]]) if (v === undefined) throw new Error(`${n} did not resolve`);
  return { evidence: typeof ev.openParavoxia, previewServer: typeof ps.chromePath, playwrightCore: typeof pw.chromium, playwrightCoreUrl: PLAYWRIGHT_CORE_URL,
    note: 'imported only; no browser launched' };
});

check('C2 five-parent path does NOT resolve (the bug was real, not cosmetic)', () => {
  const bad = resolve(HERE, '..', '..', '..', '..', '..', '..', 'main/tools/lib/evidence.mjs');
  const good = resolve(HERE, '..', '..', '..', '..', '..', '..', '..', 'main/tools/lib/evidence.mjs');
  if (existsSync(bad)) throw new Error(`five parents unexpectedly exists: ${bad}`);
  if (!existsSync(good)) throw new Error(`six parents does not exist: ${good}`);
  return { bad, good };
});

/* ====================== 2. ACTUAL sampler on ACTUAL shape ==================== */
check('C3 actual sampler reads state.signedSceneAv.activationHistoryAnchorIds', () => {
  const { sample } = runActualSampler({ journey: bridgeSnapshot(), cg: cgProbeSnapshot() });
  eq(sample.story.available, true, 'story available');
  eq(sample.story.avMemberPresent, true, 'av member present');
  eq(sample.story.avHistoryPresent, true, 'history present');
  eq(sample.story.avHasCgComplete, true, 'anc.cg.complete membership');
  eq(sample.story.avHasCgHandback, true, 'anc.cg.handback membership');
  eq(sample.story.avHistoryCount, 2, 'history count');
  if ('avFullHasComplete' in sample.story) throw new Error('the presumed avFull fields are still emitted');
  return { anchorIds: sample.story.avHistoryAnchorIds, anchorId: sample.story.avAnchorId };
});

check('C4 a look-alike id does NOT satisfy exact membership (no substring/regex)', () => {
  const { sample } = runActualSampler({
    journey: bridgeSnapshot({ anchorIds: ['anc.cg.complete-pending', 'anc.cg.handback.rehearsal', 'ch13-complete'] }),
    cg: cgProbeSnapshot() });
  eq(sample.story.avHasCgComplete, false, 'look-alike complete');
  eq(sample.story.avHasCgHandback, false, 'look-alike handback');
  eq(detectEdge(sample), false, 'edge on look-alikes');
  eq(edgeReason(sample).reason, 'anchor-ids-missing', 'reason');
});

check('C5 an ABSENT av member is null+present:false, never false-as-if-read', () => {
  const a = runActualSampler({ journey: bridgeSnapshot({ omitAvMember: true }), cg: cgProbeSnapshot() }).sample;
  eq(a.story.avMemberPresent, false, 'member flag');
  eq(a.story.avHasCgComplete, null, 'absent must be null');
  eq(a.story.avHasCgHandback, null, 'absent must be null');
  eq(edgeReason(a).reason, 'av-member-absent', 'reason distinguishes absent');
  const b = runActualSampler({ journey: bridgeSnapshot({ omitHistory: true }), cg: cgProbeSnapshot() }).sample;
  eq(b.story.avMemberPresent, true, 'member present');
  eq(b.story.avHistoryPresent, false, 'history absent');
  eq(b.story.avHasCgComplete, null, 'absent history must be null');
  eq(edgeReason(b).reason, 'av-history-absent', 'reason');
});

check('C6 a throwing/absent hook stays {available:false,reason}, atomically', () => {
  const t = runActualSampler({ journey: bridgeSnapshot(), cg: cgProbeSnapshot(), journeyThrows: true }).sample;
  eq(t.story.available, false, 'threw => unavailable');
  if (!String(t.story.reason).startsWith('threw:')) throw new Error(`reason lost: ${t.story.reason}`);
  eq(detectEdge(t), false, 'no edge from an unavailable hook');
  const n = runActualSampler({ journey: null, cg: undefined, noJourneyHook: true }).sample;
  eq(n.story.available, false, 'absent hook');
  eq(n.cg.available, false, 'absent cg hook');
  eq(edgeReason(n).reason, 'story-unavailable', 'reason');
});

/* ======================= 3. edge requires BOTH facts ======================== */
check('C7 edge requires anchors AND live common committed terra 18 AND worker 18 in the SAME sample', () => {
  const good = runActualSampler({ journey: bridgeSnapshot(), cg: cgProbeSnapshot() }).sample;
  eq(good.cg.common.available, true, 'common read');
  eq(good.cg.common.committed, true, 'committed');
  eq(good.cg.common.workerUnits, CG_COMMON_ROUTE_UNITS, 'worker units');
  eq(good.cg.common.terraUnits, CG_COMMON_ROUTE_UNITS, 'terra units');
  eq(good.cg.common.terraUnitsPresent, true, 'terra presence recorded');
  eq(detectEdge(good), true, 'edge on the real completion shape (18/18 committed, exact anchors)');
  eq(edgeReason(good).reason, 'complete+handback+committed-terra18-worker18', 'reason');

  // The producer's requirement: worker alone is NOT enough.
  const terra6 = runActualSampler({ journey: bridgeSnapshot(), cg: cgProbeSnapshot({ terraUnits: 6 }) }).sample;
  eq(detectEdge(terra6), false, 'worker 18 with terra 6 must NOT be an edge');
  eq(edgeReason(terra6).reason, 'common-terra-not-18', 'reason');
  eq(edgeReason(terra6).evidence.terraUnits, 6, 'terra evidence carried');

  const terra17 = runActualSampler({ journey: bridgeSnapshot(), cg: cgProbeSnapshot({ terraUnits: 17.9 }) }).sample;
  eq(detectEdge(terra17), false, 'no widened epsilon: 17.9 terra is not 18');

  // An ABSENT terraUnits member is absence, never an observed value.
  const noTerra = runActualSampler({ journey: bridgeSnapshot(), cg: cgProbeSnapshot({ omitTerra: true }) }).sample;
  eq(noTerra.cg.common.terraUnitsPresent, false, 'absent terra is marked absent');
  eq(noTerra.cg.common.terraUnits, null, 'absent terra is null, not 0');
  eq(detectEdge(noTerra), false, 'missing terra must not be an edge');
  eq(edgeReason(noTerra).reason, 'cg-common-fields-absent', 'absence, not a negative observation');

  const nonNumericTerra = runActualSampler({ journey: bridgeSnapshot(), cg: cgProbeSnapshot({ terraUnits: '18' }) }).sample;
  eq(detectEdge(nonNumericTerra), false, 'a string "18" is not a numeric observation');

  const under = runActualSampler({ journey: bridgeSnapshot(), cg: cgProbeSnapshot({ workerUnits: 17.4 }) }).sample;
  eq(detectEdge(under), false, '17.4/18 worker must not be an edge');
  eq(edgeReason(under).reason, 'common-worker-not-18', 'reason');

  const uncommittedBoth18 = runActualSampler({ journey: bridgeSnapshot(), cg: cgProbeSnapshot({ committed: false }) }).sample;
  eq(edgeReason(uncommittedBoth18).reason, 'common-not-committed', 'both 18 but uncommitted is its own reason');

  const uncommitted = runActualSampler({ journey: bridgeSnapshot(), cg: cgProbeSnapshot({ committed: false }) }).sample;
  eq(detectEdge(uncommitted), false, 'uncommitted must not be an edge');

  const noAnchors = runActualSampler({ journey: bridgeSnapshot({ anchorIds: [AV_ANCHOR_COMPLETE] }), cg: cgProbeSnapshot() }).sample;
  eq(detectEdge(noAnchors), false, 'complete without handback is not an edge');

  const notDone = runActualSampler({ journey: bridgeSnapshot({ beat: 'ch13-return', active: true }), cg: cgProbeSnapshot() }).sample;
  eq(detectEdge(notDone), false, 'beat not done');
  eq(edgeReason(notDone).reason, 'story-not-done', 'reason');
});

check('C8 absent CG common is "unavailable", NOT a negative observation', () => {
  const omit = runActualSampler({ journey: bridgeSnapshot(), cg: cgProbeSnapshot({ omitCommon: true }) }).sample;
  eq(omit.cg.common.available, false, 'omitted common');
  eq(edgeReason(omit).reason, 'cg-common-unavailable', 'reason');
  const nul = runActualSampler({ journey: bridgeSnapshot(), cg: cgProbeSnapshot({ nullCommon: true }) }).sample;
  eq(nul.cg.common.available, true, 'null common is a READ value');
  eq(nul.cg.common.value, null, 'value null');
  eq(edgeReason(nul).reason, 'cg-common-unavailable', 'reason');
});

check('C9 in-page edge decision is the SAME function object as edgeReason', () => {
  const src = buildInstallerSource();
  if (!src.includes(edgeReason.toString())) throw new Error('installer does not embed edgeReason verbatim');
  if (/avFullHas(Complete|Handback)/.test(src)) throw new Error('installer still carries the presumed avFull predicate');
  return { embedded: true };
});

check('C10 missing signals stay honest (pause/context/cancel reason)', async () => {
  const { KNOWN_MISSING_SIGNALS } = await import('./windowSampler.mjs');
  const text = JSON.stringify(KNOWN_MISSING_SIGNALS);
  for (const s of ['cancellation reason', 'AudioContext', 'paused'])
    if (!text.includes(s)) throw new Error(`missing-signal declaration dropped: ${s}`);
  return { declared: KNOWN_MISSING_SIGNALS.length };
});

/* ================== 4. ACTUAL guard failure behaviour (stubs) =============== */
const { createOwnedSessionGuard } = await import('../lib/ownedSession.mjs');

/* ---- C11/C12 exercise THE ACTUAL startup helper the probe's main() calls ----
 * Not a copied happy path: startUnmutedOwnedSession IS the call site. The mock
 * Browser is PLAYWRIGHT-SHAPED, i.e. it deliberately has NO process() method,
 * so any reintroduction of browser.process() fails these checks instead of
 * passing against a Puppeteer-shaped double.
 */
const { startUnmutedOwnedSession, ownedBrowserPid } = await import('./finale-window-probe.mjs');

/** A playwright-core Browser double: newBrowserCDPSession, newContext, close — NO process(). */
function playwrightBrowserMock({ pidInfo = [{ type: 'browser', id: 4242 }, { type: 'renderer', id: 4243 }],
  cdpThrows = false, gotoThrows = false, contextThrows = false, closeThrows = false, counters } = {}) {
  const page = {
    on: () => {},
    goto: async () => { if (gotoThrows) throw new Error('goto failed'); },
  };
  const browser = {
    newBrowserCDPSession: async () => {
      if (cdpThrows) throw new Error('CDP attach failed');
      return { send: async () => ({ processInfo: pidInfo }), detach: async () => { counters.detached += 1; } };
    },
    newContext: async () => {
      if (contextThrows) throw new Error('newContext failed');
      return { newPage: async () => page };
    },
    close: async () => { counters.closed += 1; if (closeThrows) throw new Error('close failed'); }
  };
  if ('process' in browser) throw new Error('mock must not have a process member');
  return { browser, page };
}
function startArgs({ browser, guard, assertThrows = false, written }) {
  return {
    chromium: { launch: async () => browser },
    cleanup: guard,
    failureRecord: ({ probe, error, phase }) => ({ probe, phase, error: String(error.message) }),
    assertHardwareGl: async () => { if (assertThrows) throw new Error('assertHardwareGl failed'); return 'ANGLE (real)'; },
    writeOut: (file, value) => { written[file] = value; },
    url: 'http://127.0.0.1:5173/x', viewport: { width: 1280, height: 720 },
    args: ['--enable-gpu'], pulseSink: 'paravoxia_finale_window',
    launchOptions: { headless: false }, probePid: 111
  };
}

await acheck('C11 actual startup helper: playwright-shaped Browser (no process()) yields the REAL pid via owned CDP', async () => {
  const counters = { closed: 0, detached: 0 };
  const { browser } = playwrightBrowserMock({ counters });
  if (typeof browser.process !== 'undefined') throw new Error('mock is not playwright-shaped');
  const g = createOwnedSessionGuard({ label: 'test' });
  const written = {};
  const session = await startUnmutedOwnedSession(startArgs({ browser, guard: g, written }));
  eq(session.browserPid, 4242, 'pid comes from the type==="browser" SystemInfo entry');
  eq(written['browser-pid.json'].browserPid, 4242, 'published pid');
  eq(written['browser-pid.json'].probePid, 111, 'probe pid published for the wrapper tree check');
  eq(counters.detached, 1, 'the pid CDP session is detached');
  eq(counters.closed, 0, 'happy path does not close here');
  eq(session.renderer, 'ANGLE (real)', 'bring-up completed');
  return { browserPid: session.browserPid };
});

await acheck('C11b the old browser.process() call would have thrown BEFORE adoption (regression is real)', async () => {
  const counters = { closed: 0, detached: 0 };
  const { browser } = playwrightBrowserMock({ counters });
  let threw = null;
  try { browser.process(); } catch (e) { threw = e; }
  if (!threw) throw new Error('expected a TypeError from the unsupported API');
  if (!/not a function/.test(String(threw.message))) throw new Error(`unexpected: ${threw.message}`);
  const src = readFileSync(resolve(HERE, 'finale-window-probe.mjs'), 'utf8');
  if (/browser\.process\s*\(/.test(src.replace(/^\s*\*.*$/gm, ''))) {
    throw new Error('the probe still CALLS browser.process()');
  }
  return { typeError: threw.message };
});

for (const [name, opts, phase] of [
  ['pid-lookup (CDP attach throws)', { cdpThrows: true }, 'owned-browser-pid-lookup'],
  ['pid-lookup (no browser-type entry)', { pidInfo: [{ type: 'renderer', id: 9 }] }, 'owned-browser-pid-lookup'],
  ['newContext', { contextThrows: true }, 'custom-browser-bringup'],
  ['goto', { gotoThrows: true }, 'custom-browser-bringup']
]) {
  await acheck(`C12 ${name} failure closes the adopted browser, records the phase, publishes NO pid`, async () => {
    const counters = { closed: 0, detached: 0 };
    const { browser } = playwrightBrowserMock({ ...opts, counters });
    const g = createOwnedSessionGuard({ label: 'test' });
    const written = {};
    let threw = null;
    try { await startUnmutedOwnedSession(startArgs({ browser, guard: g, written })); }
    catch (e) { threw = e; }
    if (!threw) throw new Error('expected the startup failure to propagate');
    eq(counters.closed, 1, 'the owned browser is closed exactly once');
    eq(g.stopped, true, 'guard reports a real stop');
    eq(written['failure.json'].phase, phase, 'the actual failing phase is recorded');
    if (phase === 'owned-browser-pid-lookup' && written['browser-pid.json'] !== undefined) {
      throw new Error('a pid was published despite a failed lookup — the wrapper could claim a foreign owner');
    }
    if (!written['cleanup-receipt.json']) throw new Error('no cleanup receipt written');
    return { phase, closed: counters.closed, pidPublished: written['browser-pid.json'] !== undefined, error: threw.message };
  });
}

await acheck('C12e assertHardwareGl failure closes the adopted browser (pid already published)', async () => {
  const counters = { closed: 0, detached: 0 };
  const { browser } = playwrightBrowserMock({ counters });
  const g = createOwnedSessionGuard({ label: 'test' });
  const written = {};
  let threw = null;
  try { await startUnmutedOwnedSession(startArgs({ browser, guard: g, written, assertThrows: true })); }
  catch (e) { threw = e; }
  if (!threw || !/assertHardwareGl/.test(threw.message)) throw new Error('expected the GL assertion failure');
  eq(counters.closed, 1, 'closed exactly once');
  eq(written['failure.json'].phase, 'custom-browser-bringup', 'phase');
  return { closed: counters.closed };
});

await acheck('C12f a FAILING browser.close() is reported as stopError, never as a clean stop', async () => {
  const counters = { closed: 0, detached: 0 };
  const { browser } = playwrightBrowserMock({ counters, gotoThrows: true, closeThrows: true });
  const g = createOwnedSessionGuard({ label: 'test' });
  const written = {};
  try { await startUnmutedOwnedSession(startArgs({ browser, guard: g, written })); } catch { /* expected */ }
  eq(counters.closed, 1, 'close was attempted');
  eq(g.stopped, false, 'a failed close must NOT be recorded as stopped');
  if (!g.stopError || !/close failed/.test(g.stopError)) throw new Error('close failure was swallowed');
  return { stopped: g.stopped, stopError: g.stopError.split('\n')[0] };
});

await acheck('C12g ownedBrowserPid never guesses: it rejects a non-integer/absent id', async () => {
  const counters = { closed: 0, detached: 0 };
  const { browser } = playwrightBrowserMock({ counters, pidInfo: [{ type: 'browser', id: 'not-a-pid' }] });
  let threw = null;
  try { await ownedBrowserPid(browser); } catch (e) { threw = e; }
  if (!threw) throw new Error('expected a rejection of an unusable pid');
  eq(counters.detached, 1, 'the CDP session is detached even on rejection');
  return { error: threw.message };
});

await acheck('C13 stopOnce is idempotent (finally + explicit path cannot double-close)', async () => {
  const g = createOwnedSessionGuard({ label: 'test' });
  let closed = 0;
  g.adopt({ stop: async () => { closed += 1; } });
  await g.stopOnce('a'); await g.stopOnce('b'); await g.stopOnce('c');
  eq(closed, 1, 'underlying stop invocations');
  eq(g.stopRequests, 3, 'requests recorded');
  return { closed, requests: g.stopRequests };
});

/* ================= 5. ACTUAL runtime wrapper branches (stubs) =============== */
check('C14 sink-input parsing + process-tree ownership (real /proc for self)', () => {
  const text = `Sink Input #71\n\tSink: paravoxia_finale_window\n\t\tapplication.process.id = "4242"\n\t\tapplication.process.binary = "chrome"\n\t\tapplication.name = "Chromium"\n\nSink Input #72\n\tSink: alsa_output.x\n\t\tapplication.process.id = "999"\n`;
  const parsed = parseSinkInputs(text);
  eq(parsed.length, 2, 'parsed count');
  eq(parsed[0].pid, 4242, 'pid');
  const ok = verifySinkOwnership({ sinkName: 'paravoxia_finale_window', sinkIndex: 3, browserPid: 4242,
    sinkInputs: parsed, parentOf: () => 1 });
  eq(ok.ok, true, 'own stream accepted');
  // a REAL tree relation, read from /proc: this process under its own parent
  eq(isInProcessTree(process.pid, process.ppid, (p) => (p === process.pid ? process.ppid : 1)), true, 'real /proc tree');
  return { parsed: parsed.length, reason: ok.reason };
});

check('C15 a foreign stream on the owned sink is REFUSED, not recorded', () => {
  const parsed = parseSinkInputs(`Sink Input #80\n\tSink: paravoxia_finale_window\n\t\tapplication.process.id = "31337"\n\t\tapplication.name = "spotify"\n`);
  const v = verifySinkOwnership({ sinkName: 'paravoxia_finale_window', sinkIndex: 3, browserPid: 4242, sinkInputs: parsed, parentOf: () => 1 });
  eq(v.ok, false, 'must refuse');
  eq(v.reason, 'foreign-stream-on-owned-sink', 'reason');
  const none = verifySinkOwnership({ sinkName: 'paravoxia_finale_window', sinkIndex: 3, browserPid: 4242, sinkInputs: [], parentOf: () => 1 });
  eq(none.ok, false, 'no stream => refuse');
  eq(none.reason, 'no-stream-on-owned-sink', 'reason');
});

/* -- C16: the OWNED LOCK FD actually reaches the child, at the same number --- */
await acheck('C16 REAL cpu-only node child inherits the SAME open lock description at fd 9', async () => {
  const wdir = resolve(HERE, '..', '..', '..', '..', 'logs', 'finale-wrapper-transport');
  mkdirSync(wdir, { recursive: true });
  const lockPath = resolve(wdir, 'fd-transport.lock');
  writeFileSync(lockPath, '');

  // stdio shape first: 0/1/2 preserved, 3..8 closed, the parent's fd at child 9.
  const stdio = buildStdio({ parentFd: 9, childFd: 9 });
  eq(stdio.length, 10, 'stdio length');
  eq(stdio[0], 'ignore', 'stdin'); eq(stdio[1], 'pipe', 'stdout'); eq(stdio[2], 'pipe', 'stderr');
  for (let i = 3; i < 9; i += 1) eq(stdio[i], 'ignore', `fd ${i} not leaked`);
  eq(stdio[9], 9, 'owned lock fd placed at child fd 9');

  // The grandchild proves DESCRIPTOR IDENTITY (same inode/dev as the lock file)
  // and the SAME INHERITED FLOCK (an independent non-blocking flock must FAIL).
  // It never takes a second lock: the contention probe is -n and exits at once.
  const grandchild = `
    const fs=require('node:fs'), cp=require('node:child_process');
    const lock=process.argv[1];
    const o={fd9Open:false,fd9Target:null,identity:false,sameInode:false,contentionRefused:false,secondLockAcquired:false,fd8Target:null,fd8IsLock:false};
    try{o.fd9Target=fs.readlinkSync('/proc/self/fd/9');o.fd9Open=true;}catch(e){o.err=String(e.message);}
    o.identity = o.fd9Target===lock;
    try{const a=fs.fstatSync(9), b=fs.statSync(lock); o.sameInode = a.ino===b.ino && a.dev===b.dev;}catch(e){o.inoErr=String(e.message);}
    try{o.fd8Target=fs.readlinkSync('/proc/self/fd/8');}catch{o.fd8Target=null;}
    o.fd8IsLock = o.fd8Target===lock;
    try{cp.execFileSync('flock',['-n','-x',lock,'true'],{stdio:'ignore'});o.secondLockAcquired=true;}
    catch{o.contentionRefused=true;}
    process.stdout.write(JSON.stringify(o));`;

  // The harness runs UNDER a real exclusive flock on fd 9 (bash 'exec 9>' +
  // 'flock -x 9'), then spawns through the WRAPPER'S OWN buildStdio.
  const harness = resolve(wdir, 'fd-transport-harness.mjs');
  writeFileSync(harness, `import { spawn } from 'node:child_process';
import { buildStdio } from ${JSON.stringify(resolve(HERE, 'finale-window-runtime.mjs'))};
const [lock, code] = [process.argv[2], process.argv[3]];
const c = spawn(process.execPath, ['-e', code, lock], { stdio: buildStdio({ parentFd: 9, childFd: 9 }) });
let out = ''; c.stdout.on('data', (d) => { out += d; }); c.stderr.on('data', (d) => { out += d; });
c.on('close', (x) => { process.stdout.write(JSON.stringify({ childExit: x, child: out })); });
`);
  const codeFile = resolve(wdir, 'fd-transport-grandchild.js');
  writeFileSync(codeFile, grandchild);
  const raw = execFileSync('bash', ['-c',
    `exec 9>"$1"; flock -x 9 || exit 9; exec "$2" "$3" "$1" "$(cat "$4")"`,
    'bash', lockPath, process.execPath, harness, codeFile], { encoding: 'utf8', timeout: 60_000 });
  const res = JSON.parse(raw);
  const child = JSON.parse(res.child);
  eq(res.childExit, 0, `child exit (${res.child.slice(0, 300)})`);
  eq(child.fd9Open, true, 'fd 9 open in the child');
  eq(child.identity, true, `fd 9 points at the lock file, got ${child.fd9Target}`);
  eq(child.sameInode, true, 'fd 9 is the SAME file (dev+inode), not a re-open');
  eq(child.fd8IsLock, false, `fds 3..8 are /dev/null placeholders, not the lock (fd8=${child.fd8Target})`);
  eq(child.contentionRefused, true, 'the inherited flock is REAL: an independent flock -n must fail');
  eq(child.secondLockAcquired, false, 'the child must never acquire a second conflicting lock');
  rmSync(harness, { force: true }); rmSync(codeFile, { force: true }); rmSync(lockPath, { force: true });
  return { fd9Target: child.fd9Target, contentionRefused: true };
});

check('C16b the wrapper refuses a missing/wrong/low inherited lock fd (never opens one)', () => {
  eq(validateInheritedLockFd({ fd: null, lockPath: '/tmp/a.lock' }).ok, false, 'no fd');
  eq(validateInheritedLockFd({ fd: 2, lockPath: '/tmp/a.lock' }).ok, false, 'fd < 3');
  eq(validateInheritedLockFd({ fd: 9, lockPath: null }).ok, false, 'no lock path');
  eq(validateInheritedLockFd({ fd: 9, lockPath: '/tmp/a.lock', readLink: () => { throw new Error('ENOENT'); } }).ok, false, 'fd not open');
  eq(validateInheritedLockFd({ fd: 9, lockPath: '/tmp/a.lock', readLink: () => '/tmp/other' }).ok, false, 'wrong target');
  eq(validateInheritedLockFd({ fd: 9, lockPath: '/tmp/a.lock', readLink: () => '/tmp/a.lock' }).ok, true, 'valid inherited fd');
  const src = readFileSync(resolve(HERE, 'finale-window-runtime.mjs'), 'utf8');
  if (/flock|LOCK_EX|openSync\(.*lock/i.test(src.replace(/^\s*\*.*$/gm, ''))) throw new Error('the wrapper must never take a lock itself');
  return { refusals: 5 };
});

/* -- C17: the NUMERIC sink index, from realistic pactl rows ------------------ */
check('C17 owned sink index resolved from real `pactl list short sinks` rows', () => {
  const real = [
    '0\talsa_output.pci-0000_00_1f.3.analog-stereo\tmodule-alsa-card.c\ts16le 2ch 48000Hz\tSUSPENDED',
    '1\talsa_output.pci-0000_01_00.1.hdmi-stereo\tmodule-alsa-card.c\ts16le 2ch 48000Hz\tIDLE',
    '2\tparavoxia_finale_window\tmodule-null-sink.c\ts16le 2ch 44100Hz\tIDLE'
  ].join('\n') + '\n';
  const r = resolveSinkIndex(real, 'paravoxia_finale_window');
  eq(r.ok, true, 'resolved'); eq(r.index, 2, 'exact numeric index');
  eq(resolveSinkIndex(real, 'paravoxia_missing').reason, 'owned-sink-not-listed', 'missing => refuse');
  eq(resolveSinkIndex(`${real}3\tparavoxia_finale_window\tmodule-null-sink.c\t`, 'paravoxia_finale_window').reason, 'ambiguous-sink-name', 'ambiguous => refuse');
  eq(resolveSinkIndex('x\tparavoxia_finale_window\tmodule-null-sink.c\t', 'paravoxia_finale_window').reason, 'non-numeric-sink-index', 'non-numeric => refuse');
  // The real sink-input row carries the NUMERIC index; name-only never matched.
  const inputs = parseSinkInputs('Sink Input #92\n\tDriver: protocol-native.c\n\tSink: 2\n\t\tapplication.process.id = "5150"\n\t\tapplication.process.binary = "chrome"\n');
  eq(inputs[0].sink, '2', 'sink-input carries a numeric index');
  eq(verifySinkOwnership({ sinkName: 'paravoxia_finale_window', sinkIndex: null, browserPid: 5150, sinkInputs: inputs, parentOf: () => 1 }).reason,
    'unresolved-sink-index', 'a null index is a refusal, never a silent match');
  eq(verifySinkOwnership({ sinkName: 'paravoxia_finale_window', sinkIndex: 2, browserPid: 5150, sinkInputs: inputs, parentOf: () => 1 }).ok, true, 'numeric match accepted');
  eq(verifySinkOwnership({ sinkName: 'paravoxia_finale_window', sinkIndex: 2, browserPid: 4242, sinkInputs: inputs, parentOf: () => 1 }).reason,
    'foreign-stream-on-owned-sink', 'PID-tree ownership refusal retained');
  return { index: r.index };
});

/* -- the ACTUAL wrapper, driven end-to-end with fixtures (no shadow copy) ---- */
const CAPTURES_DIR = resolve(HERE, '..', '..', '..', 'captures');
const REAL_SINKS = '0\talsa_output.hdmi-stereo\tmodule-alsa-card.c\ts16le 2ch 48000Hz\tIDLE\n2\tparavoxia_finale_window\tmodule-null-sink.c\ts16le 2ch 44100Hz\tIDLE\n';
function harnessDir(name) {
  const d = resolve(CAPTURES_DIR, 'finale-window', name);
  rmSync(d, { recursive: true, force: true });
  mkdirSync(d, { recursive: true });
  return { outDir: d, probeOutName: `finale-window/${name}` };
}
/** A fake child that behaves like a real one: it stays alive until signalled. */
function fakeChild({ pid = 4242, aliveForever = false, exitCode = 0, onKill = null } = {}) {
  const c = { pid, exitCode: aliveForever ? null : exitCode, signalCode: null, handlers: {},
    stdout: { on() {} }, stderr: { on() {} },
    on(ev, fn) { (this.handlers[ev] ||= []).push(fn); return this; },
    emit(ev, v) { (this.handlers[ev] || []).forEach((f) => f(v)); },
    kill(sig) { if (onKill) onKill(sig, c); else { c.signalCode = sig; c.exitCode = null; } return true; } };
  return c;
}
function fixturePactl(calls, { sinks = REAL_SINKS, sinkInputs = '' } = {}) {
  let modules = ['77'];
  return (a) => {
    calls.push(a.join(' '));
    if (a[0] === 'get-default-sink') return 'alsa_output.hdmi-stereo\n';
    if (a[0] === 'load-module') return '77\n';
    if (a[0] === 'unload-module') { modules = modules.filter((m) => m !== a[1]); return ''; }
    if (a[0] === 'list' && a[1] === 'short' && a[2] === 'sinks') return sinks;
    if (a[0] === 'list' && a[1] === 'short' && a[2] === 'modules') return modules.map((m) => `${m}\tmodule-null-sink\t`).join('\n');
    if (a[0] === 'list' && a[1] === 'sink-inputs') return sinkInputs;
    return '';
  };
}
const okFd = () => ({ fd: 9, lockPath: '/run/lock/x', ok: true, problems: [], fdTarget: '/run/lock/x' });

await acheck('C17a ownership refusal: probe STOPPED+reaped, sink unloaded, audio preserved', async () => {
  const { outDir, probeOutName } = harnessDir('_closure-ownership');
  writeFileSync(resolve(outDir, 'browser-pid.json'), JSON.stringify({ browserPid: 5150 }));
  writeFileSync(resolve(outDir, 'owned-sink.wav'), Buffer.alloc(2048));
  const calls = [];
  const children = [];
  // a foreign stream sits on the owned sink => must refuse immediately
  const pactl = fixturePactl(calls, { sinkInputs: 'Sink Input #92\n\tSink: 2\n\t\tapplication.process.id = "31337"\n\t\tapplication.name = "spotify"\n' });
  const spawnFn = (cmd, args, o) => {
    const c = fakeChild({ pid: 1000 + children.length, aliveForever: true,
      onKill: (sig, self) => { self.signalCode = sig; setTimeout(() => { self.exitCode = 143; }, 50);
        writeFileSync(resolve(outDir, 'cleanup-receipt.json'), JSON.stringify({ schema: 'paravoxia.verifier.ownedSessionCleanupReceipt.v1', state: 'stopped', cleanupCompleted: true, sessionStopped: true, cleanupError: null, reason: `signal-${sig}` })); } });
    children.push({ cmd, args, stdio: o?.stdio, child: c });
    return c;
  };
  let rec = null;
  await runCombinedCapture({ outDir, probeOutName, pactl, spawnFn, parentOf: () => 1,
    heavyLockFd: 9, heavyLockPath: '/run/lock/x', validateFd: okFd, probePath: resolve(HERE, 'finale-window-probe.mjs') })
    .catch((e) => { rec = e.runtimeRecord; });
  if (!rec) throw new Error('expected the ownership refusal to propagate');
  eq(rec.ownership.reason, 'foreign-stream-on-owned-sink', 'refused a foreign stream');
  eq(rec.sinkIndex, 2, 'numeric index resolved before the gate');
  if (!rec.probeTeardown) throw new Error('the probe child was NOT owned through the finally');
  eq(rec.probeTeardown.stopFileWritten, true, 'cooperative stop file written');
  if (!rec.probeTeardown.signals.includes('SIGTERM')) throw new Error('own child not signalled');
  eq(rec.probeTeardown.browserTeardownProven, true, 'waited for exit + cleanup receipt');
  eq(rec.sinkTeardown.unloaded, true, 'exact module unloaded AFTER the probe exit');
  eq(rec.sinkTeardown.verifiedGone, true, 'unload verified');
  eq(rec.defaultSinkUnchanged, true, 'default sink unchanged');
  eq(existsSync(resolve(outDir, 'owned-sink.wav')), true, 'failure audio preserved');
  eq(children.every((c) => c.child.exitCode !== null || c.child.signalCode != null), true, 'no live child after finally');
  if (!calls.includes('unload-module 77')) throw new Error('exact-id unload not issued');
  if (calls.some((c) => c.startsWith('set-default-sink'))) throw new Error('wrapper attempted a global default change');
  // the recorder never started: ownership is verified BEFORE recording
  if (calls.some((c) => c.includes('parec'))) throw new Error('recorder started before ownership');
  eq(rec.recorder, null, 'no recording taken on an unverified sink');
  eq(rec.outcome, 'INCOMPLETE-EVIDENCE-RETAINED', 'labelled incomplete, evidence retained');
  rmSync(outDir, { recursive: true, force: true });
  return { outcome: rec.outcome, teardown: rec.probeTeardown.reason };
});

await acheck('C17b pid failure and spawn error: no live child, honest error records', async () => {
  const { outDir, probeOutName } = harnessDir('_closure-pidfail');
  const calls = [];
  const kids = [];
  const spawnFn = () => { const c = fakeChild({ aliveForever: true,
    onKill: (sig, self) => { self.signalCode = sig; self.exitCode = 143; } });
    kids.push(c); setTimeout(() => c.emit('error', new Error('spawn ENOENT')), 10); return c; };
  let rec = null;
  await runCombinedCapture({ outDir, probeOutName, pactl: fixturePactl(calls), spawnFn, parentOf: () => 1,
    heavyLockFd: 9, heavyLockPath: '/run/lock/x', validateFd: okFd, maxSessionS: 5 })
    .catch((e) => { rec = e.runtimeRecord; });
  if (!rec) throw new Error('expected propagation');
  if (!rec.spawnErrors.length) throw new Error("the child 'error' event was not recorded");
  eq(rec.browserPid, null, 'no pid claimed');
  eq(kids.every((c) => c.exitCode !== null || c.signalCode != null), true, 'no live child after finally');
  eq(rec.probeTeardown.signals.includes('SIGTERM'), true, 'own child stopped');
  if (!rec.incompleteCleanup.some((s) => /cleanup-receipt/.test(s))) throw new Error('a missing teardown receipt must be reported as incomplete, not assumed');
  eq(rec.sinkTeardown.unloaded, true, 'sink still unloaded');
  rmSync(outDir, { recursive: true, force: true });
  return { spawnErrors: rec.spawnErrors.length, incompleteCleanup: rec.incompleteCleanup };
});

await acheck('C17c ONE absolute session deadline bounds the whole run (not 360s after the waits)', async () => {
  const { outDir, probeOutName } = harnessDir('_closure-timeout');
  writeFileSync(resolve(outDir, 'browser-pid.json'), JSON.stringify({ browserPid: 5150 }));
  const calls = [];
  const kids = [];
  const spawnFn = () => { const c = fakeChild({ aliveForever: true,
    onKill: (sig, self) => { self.signalCode = sig; self.exitCode = 143;
      writeFileSync(resolve(outDir, 'cleanup-receipt.json'), JSON.stringify({ schema: 'paravoxia.verifier.ownedSessionCleanupReceipt.v1', state: 'stopped', cleanupCompleted: true, sessionStopped: true, cleanupError: null })); } });
    kids.push(c); return c; };
  const t0 = Date.now();
  let rec = null;
  await runCombinedCapture({ outDir, probeOutName, maxSessionS: 4,
    pactl: fixturePactl(calls, { sinkInputs: 'Sink Input #92\n\tSink: 2\n\t\tapplication.process.id = "5150"\n' }),
    spawnFn, parentOf: () => 1, heavyLockFd: 9, heavyLockPath: '/run/lock/x', validateFd: okFd })
    .catch((e) => { rec = e.runtimeRecord; });
  const elapsedS = (Date.now() - t0) / 1000;
  if (!rec) throw new Error('expected the timeout to propagate');
  if (!/absolute session bound/.test(rec.errors.join(' '))) throw new Error(`not the absolute-deadline path: ${rec.errors[0]?.slice(0, 200)}`);
  if (elapsedS > 12) throw new Error(`the whole session took ${elapsedS}s under a 4s bound`);
  if (rec.sessionDeadlineMs - rec.sessionStartMs !== 4000) throw new Error('deadline is not taken from session start');
  eq(rec.probe.timedOut, true, 'timeout recorded');
  eq(kids.every((c) => c.exitCode !== null || c.signalCode != null), true, 'no live child after finally');
  eq(rec.probeTeardown.browserTeardownProven, true, 'browser teardown waited for before releasing anything');
  eq(rec.recorder.stopReason, 'finally', 'recorder stopped and reaped');
  eq(rec.sinkTeardown.verifiedGone, true, 'sink unloaded after the child was gone');
  // teardown order: recorder, then probe, then sink unload
  const order = rec.phases.map((p) => p.name);
  const seq = ['recorder-stopped', 'probe-stopped'].map((n) => order.indexOf(n));
  if (seq[0] < 0 || seq[1] < 0 || seq[0] > seq[1]) throw new Error(`teardown order wrong: ${order.join(',')}`);
  if (order.indexOf('recorder-started') < order.indexOf('ownership-verified')) throw new Error('recorder must start AFTER ownership verification');
  rmSync(outDir, { recursive: true, force: true });
  return { elapsedS, order };
});

check('C17d coverage is bound to the ACTUAL edge wallclock, never a guessed duration', () => {
  eq(PRE_EDGE_MS, 3000, 'pre-edge span'); eq(POST_EDGE_MS, 11500, 'post-edge span');
  eq(HARD_MAX_SESSION_S, 360, 'session cap');
  const edgeWall = 1_800_000_000_000;
  const nd = [
    JSON.stringify({ tMs: 100, wallMs: edgeWall - 2000, edgeVerdict: { edge: false, reason: 'story-unavailable' } }),
    JSON.stringify({ tMs: 2100, wallMs: edgeWall, edgeVerdict: { edge: true, reason: 'complete+handback+committed-terra18-worker18' } }),
    JSON.stringify({ tMs: 13600, wallMs: edgeWall + 11500, edgeVerdict: { edge: false } })
  ].join('\n');
  const good = assessCoverage({ ndjsonText: nd, recorderStartWallMs: edgeWall - 30_000, recorderStopWallMs: edgeWall + 12_000 });
  eq(good.complete, true, `full coverage: ${good.reason}`);
  eq(good.edgeWallMs, edgeWall, 'edge wallclock taken from the actual sample');
  eq(assessCoverage({ ndjsonText: nd, recorderStartWallMs: edgeWall - 1000, recorderStopWallMs: edgeWall + 12_000 }).reason,
    'recorder-started-after-required-pre-edge-span', 'late start => incomplete');
  eq(assessCoverage({ ndjsonText: nd, recorderStartWallMs: edgeWall - 30_000, recorderStopWallMs: edgeWall + 9_000 }).reason,
    'recorder-stopped-before-required-post-edge-span', 'short tail => incomplete');
  // a 73.5s recording that does not contain the edge is NOT coverage
  eq(assessCoverage({ ndjsonText: nd, recorderStartWallMs: edgeWall + 60_000, recorderStopWallMs: edgeWall + 133_500 }).complete, false, 'duration alone proves nothing');
  eq(assessCoverage({ ndjsonText: '', recorderStartWallMs: 1, recorderStopWallMs: 2 }).reason, 'no-completion-edge-in-window', 'no edge => incomplete');
  return { pre: PRE_EDGE_MS, post: POST_EDGE_MS };
});

check('C17e the probe has a bounded stop path that closes only ITS OWN browser', () => {
  const src = readFileSync(resolve(HERE, 'finale-window-probe.mjs'), 'utf8');
  const code = src.split('\n').filter((l) => !/^\s*\*|^\s*\/\*|^\s*\/\//.test(l)).join('\n');
  if (!/process\.on\(sig, \(\) => terminate/.test(code)) throw new Error('no signal termination path');
  if (!/existsSync\(stopFile\)/.test(code)) throw new Error('no cooperative stop-file path');
  if (!/cleanup\.stopOnce/.test(code)) throw new Error('termination does not go through the owned-session guard');
  for (const bad of ['pkill', 'killall', 'process.kill(0', "execFileSync('kill'", 'pgrep'])
    if (code.includes(bad)) throw new Error(`probe reaches for foreign processes: ${bad}`);
  const wsrc = readFileSync(resolve(HERE, 'finale-window-runtime.mjs'), 'utf8')
    .split('\n').filter((l) => !/^\s*\*|^\s*\/\*|^\s*\/\//.test(l)).join('\n');
  for (const bad of ['pkill', 'killall', 'pgrep', 'chrome', '34413'])
    if (wsrc.includes(bad)) throw new Error(`wrapper reaches beyond its own child: ${bad}`);
  if (!/probe\.kill\('SIGTERM'\)/.test(wsrc)) throw new Error('wrapper does not stop its own child');
  return { ownChildOnly: true };
});

check('C18 wrapper never names a microphone, the default sink or a foreign device', () => {
  const src = readFileSync(resolve(HERE, 'finale-window-runtime.mjs'), 'utf8');
  const code = src.split('\n').filter((l) => !/^\s*\*|^\s*\/\*|^\s*\/\//.test(l)).join('\n');
  for (const bad of ['@DEFAULT_MONITOR@', '@DEFAULT_SOURCE@', 'set-default-sink', 'alsa_input', 'default.monitor'])
    if (code.includes(bad)) throw new Error(`wrapper references ${bad}`);
  if (!code.includes('${sinkName}.monitor')) throw new Error('recorder device is not the owned sink monitor');
  return { recordsOnly: '<owned sink>.monitor' };
});

/* ------------------------------------------------------------------ report -- */
const logDir = resolve(HERE, '..', '..', '..', '..', 'logs', 'finale-window-closure');
mkdirSync(logDir, { recursive: true });
const passed = results.filter((r) => r.pass).length;
const out = {
  schema: 'paravoxia.verifier.finaleWindowClosureChecks.v1',
  ranAt: new Date().toISOString(), cpuOnly: true,
  browserLaunched: false, gpuUsed: false, sinkCreated: false, recorderStarted: false, gameSourceTouched: false,
  total: results.length, passed, failed: results.length - passed, results
};
writeFileSync(resolve(logDir, 'closure-checks.json'), JSON.stringify(out, null, 1));
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.pass ? '' : `\n      ${r.error}`}`);
console.log(`\n${passed}/${results.length} focused runtime-behaviour checks passed`);
process.exit(passed === results.length ? 0 : 1);
