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
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';

import { buildInstallerSource, detectEdge, edgeReason, DEFAULT_WINDOW,
         AV_ANCHOR_COMPLETE, AV_ANCHOR_HANDBACK, CG_COMMON_ROUTE_UNITS } from './windowSampler.mjs';
import { parseSinkInputs, verifySinkOwnership, isInProcessTree, moduleIdPresent,
         runCombinedCapture, HARD_MAX_SESSION_S, MIN_RECORDER_S } from './finale-window-runtime.mjs';

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
  const ev = await import('../../../../../../main/tools/lib/evidence.mjs');
  const ps = await import('../../../../../../main/tools/lib/previewServer.mjs');
  const os = await import('../lib/ownedSession.mjs');
  // The installed package is playwright-core, resolved BY PATH: a bare
  // specifier does not resolve from a folder outside main/.
  // (Imported by URL, not by importing the probe module, whose top-level
  // main() would start a run.)
  const PLAYWRIGHT_CORE_URL = pathToFileURL(
    resolve(HERE, '..', '..', '..', '..', '..', '..', 'main/node_modules/playwright-core/index.mjs')).href;
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
  const bad = resolve(HERE, '..', '..', '..', '..', '..', 'main/tools/lib/evidence.mjs');
  const good = resolve(HERE, '..', '..', '..', '..', '..', '..', 'main/tools/lib/evidence.mjs');
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
  const ok = verifySinkOwnership({ sinkName: 'paravoxia_finale_window', browserPid: 4242,
    sinkInputs: parsed, parentOf: () => 1 });
  eq(ok.ok, true, 'own stream accepted');
  // a REAL tree relation, read from /proc: this process under its own parent
  eq(isInProcessTree(process.pid, process.ppid, (p) => (p === process.pid ? process.ppid : 1)), true, 'real /proc tree');
  return { parsed: parsed.length, reason: ok.reason };
});

check('C15 a foreign stream on the owned sink is REFUSED, not recorded', () => {
  const parsed = parseSinkInputs(`Sink Input #80\n\tSink: paravoxia_finale_window\n\t\tapplication.process.id = "31337"\n\t\tapplication.name = "spotify"\n`);
  const v = verifySinkOwnership({ sinkName: 'paravoxia_finale_window', browserPid: 4242, sinkInputs: parsed, parentOf: () => 1 });
  eq(v.ok, false, 'must refuse');
  eq(v.reason, 'foreign-stream-on-owned-sink', 'reason');
  const none = verifySinkOwnership({ sinkName: 'paravoxia_finale_window', browserPid: 4242, sinkInputs: [], parentOf: () => 1 });
  eq(none.ok, false, 'no stream => refuse');
  eq(none.reason, 'no-stream-on-owned-sink', 'reason');
});

check('C16 recorder lifetime bound rejects a too-short recording (the 60s bug)', async () => {
  if (MIN_RECORDER_S < 73) throw new Error(`MIN_RECORDER_S ${MIN_RECORDER_S} does not cover ~62s completion + 11.5s hold`);
  if (HARD_MAX_SESSION_S !== 360) throw new Error('session cap must be 360s');
  let rejected = null;
  await runCombinedCapture({ outDir: resolve(HERE, '..', '..', '..', 'logs', 'finale-window-closure', 'selftest'),
    recorderMinS: 60 }).catch((e) => { rejected = e.message; });
  if (!rejected || !/shorter than the observed completion/.test(rejected))
    throw new Error(`a 60s recorder lifetime was not rejected: ${rejected}`);
  return { minRecorderS: MIN_RECORDER_S, rejected };
});

await acheck('C17 failure path: recorder stopped, module unloaded+verified, audio PRESERVED', async () => {
  const outDir = resolve(HERE, '..', '..', '..', 'logs', 'finale-window-closure', 'selftest');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, 'owned-sink.wav'), Buffer.alloc(2048));   // stand-in for a partial recording
  const calls = [];
  let modulesLoaded = ['77'];
  const pactl = (a) => {
    calls.push(a.join(' '));
    if (a[0] === 'get-default-sink') return 'alsa_output.platform-NVDA2014_00.hdmi-stereo\n';
    if (a[0] === 'load-module') return '77\n';
    if (a[0] === 'unload-module') { modulesLoaded = modulesLoaded.filter((m) => m !== a[1]); return ''; }
    if (a[0] === 'list' && a[1] === 'short') return modulesLoaded.map((m) => `${m}\tmodule-null-sink\t`).join('\n');
    if (a[0] === 'list') return '';   // no sink-inputs => ownership refusal
    return '';
  };
  const spawnFn = () => ({ pid: 1234, exitCode: 0, stdout: { on() {} }, stderr: { on() {} }, kill() {} });
  let rec = null;
  await runCombinedCapture({ outDir, pactl, spawnFn, parentOf: () => 1,
    probeArgs: [] }).catch((e) => { rec = e.runtimeRecord; });
  if (!rec) throw new Error('expected the ownership refusal to propagate');
  eq(rec.sinkTeardown.unloaded, true, 'module unloaded');
  eq(rec.sinkTeardown.verifiedGone, true, 'unload verified');
  eq(rec.sinkTeardown.moduleId, '77', 'exact module id');
  eq(rec.defaultSinkUnchanged, true, 'default sink unchanged');
  eq(existsSync(resolve(outDir, 'owned-sink.wav')), true, 'failure audio preserved');
  if (!calls.includes('unload-module 77')) throw new Error('exact-id unload not issued');
  if (calls.some((c) => c.startsWith('set-default-sink'))) throw new Error('wrapper attempted a global default change');
  eq(moduleIdPresent('78\tmodule-x\t', '77'), false, 'module presence parser');
  return { outcome: rec.outcome, pactlCalls: calls };
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
const logDir = resolve(HERE, '..', '..', '..', 'logs', 'finale-window-closure');
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
