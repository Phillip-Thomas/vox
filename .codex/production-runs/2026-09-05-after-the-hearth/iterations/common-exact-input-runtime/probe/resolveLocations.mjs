/**
 * resolveLocations.mjs — OWNED by role `common-exact-input-runtime`.
 *
 * PURPOSE (bounded): prove or falsify, ON THE LIVE IMMUTABLE BUNDLE, the one
 * claim the CPU preparation could not make: that the requested LP-A (callee
 * entry) and a CALLER-scope LP-B actually RESOLVE to real breakpoint locations
 * in the same script whose sha256 is the root-published bundle hash, and that
 * the caller-scope names g / i / I / stage / oldCredit are actually retained
 * there.
 *
 * It sets logpoint-style CONDITIONAL breakpoints whose condition returns false,
 * so the debugger never pauses. It writes to an inert global array. It never
 * calls a game predicate, never writes game state, never grants credit.
 *
 * This file does NOT drive the survey/common leg. It is the instrumentation
 * gate that must pass before any measured leg is meaningful.
 */
// HARNESS CORRECTION (authorized private probe fix, attempt-1 -> attempt-2):
// playwright-core is installed under main/node_modules, not at the repo root,
// so a bare specifier does not resolve from this probe's location. Bind to the
// absolute installed path. This is instrumentation only; no game code involved.
const { chromium } = await import('/home/thomasphillip/Projects/vox/main/node_modules/playwright-core/index.mjs');
import { createHash } from 'node:crypto';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const arg = (n, d = null) => {
  const i = process.argv.indexOf(n);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const OUT = arg('--out');
const URL_ROOT = arg('--url');
const EXPECT_BUNDLE = arg('--expect-bundle');
const CHROME = arg('--chrome');
if (!OUT || !URL_ROOT || !EXPECT_BUNDLE || !CHROME) {
  console.error('refusing: --out --url --expect-bundle --chrome are all required');
  process.exit(2);
}
mkdirSync(OUT, { recursive: true });
const sha = (b) => createHash('sha256').update(b).digest('hex');
const report = {
  schema: 'paravoxia.verifier.commonExactInput.locationResolution.v1',
  role: 'common-exact-input-runtime',
  startedUtc: new Date().toISOString(),
  url: URL_ROOT,
  expectBundleSha256: EXPECT_BUNDLE,
  observed: {},
  gates: [],
  limitations: []
};
const gate = (name, ok, detail) => {
  report.gates.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${JSON.stringify(detail).slice(0, 300)}`);
  return !!ok;
};

// The EXACT sites, quoted from the served bytes and re-verified below.
const LINE = 7839;
const COL_CALLEE = 193729;   // first statement of pwe (routeProgressUnits)
const COL_CALLER = 219885;   // start of the guarded credit statement in Kme

let browser = null;
let cleanup = { state: 'not-started', stopsRootPreview: false };
try {
  // ---- served-byte identity, before any GPU ----------------------------------
  const res = await fetch(new URL('/assets/index-BiDWGouH.js', URL_ROOT));
  const bytes = Buffer.from(await res.arrayBuffer());
  const bundleSha = sha(bytes);
  report.observed.servedBundle = { status: res.status, bytes: bytes.length, sha256: bundleSha };
  if (!gate('served-bundle-is-the-root-published-immutable-bundle',
    res.status === 200 && bundleSha === EXPECT_BUNDLE, report.observed.servedBundle)) {
    throw new Error('bundle identity mismatch');
  }
  const text = bytes.toString('utf8');
  const line = text.split('\n')[LINE];
  const calleeLit = 'function pwe(e,A,t,i,g=2.5){';
  const callerLit = '(g?fL(g,i,o,{extraSolids:n}):o.isSupported(i))&&GH(Q,RH(i),zKA()).ok&&(t.terraUnits=pwe(tQ,i,t.terraUnits,I))';
  report.observed.staticLiterals = {
    calleeStartsAt: line.indexOf(calleeLit),
    calleeBodyFirstStatementCol: line.indexOf(calleeLit) + calleeLit.length,
    callerStatementCol: line.indexOf(callerLit),
    callerLiteralPresent: line.includes(callerLit),
    pweOccurrences: (line.match(/pwe\(/g) || []).length,
    bodiesClearMinifiedPresentInGuard: line.slice(line.indexOf(callerLit), line.indexOf(callerLit) + callerLit.length).includes('TKA(')
  };
  gate('callee-first-statement-column-is-exactly-as-prepared',
    report.observed.staticLiterals.calleeBodyFirstStatementCol === COL_CALLEE,
    { expected: COL_CALLEE, actual: report.observed.staticLiterals.calleeBodyFirstStatementCol });
  gate('caller-guarded-credit-statement-column-is-exact',
    report.observed.staticLiterals.callerStatementCol === COL_CALLER,
    { expected: COL_CALLER, actual: report.observed.staticLiterals.callerStatementCol });
  gate('bodies-clear-is-ABSENT-from-this-credit-guard',
    report.observed.staticLiterals.bodiesClearMinifiedPresentInGuard === false,
    { note: 'reported absent, never fabricated true' });

  // ---- one OWNED browser ------------------------------------------------------
  browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--no-sandbox']
  });
  cleanup.state = 'open';
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const cdp = await page.context().newCDPSession(page);

  const scripts = [];
  let pauses = 0;
  cdp.on('Debugger.scriptParsed', (s) => { if (s.url && s.url.includes('index-BiDWGouH.js')) scripts.push(s); });
  cdp.on('Debugger.paused', () => { pauses += 1; });
  await cdp.send('Debugger.enable');
  await cdp.send('Runtime.enable');

  // Install the inert sink BEFORE the bundle runs. Nothing reads it back.
  await cdp.send('Page.enable');
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: 'globalThis.__cxSink={a:[],b:[],dropsA:0,dropsB:0,cap:2400};'
  });

  const entry = `${URL_ROOT.replace(/\/$/, '')}/?story=ch13-survey&journeyprobe=1&debug=1`;
  report.observed.entryUrl = entry;
  report.observed.entryFixtureLabel =
    'LABELLED DIAGNOSTIC FIXTURE: deep labelled survey entry, not full-story continuity, not an earned Continue, grants no acceptance.';
  await page.goto(entry, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);

  report.observed.scriptParsed = scripts.map((s) => ({
    scriptId: s.scriptId, url: s.url, hash: s.hash, length: s.length, hasSourceMapURL: !!s.sourceMapURL
  }));
  if (!gate('bundle-script-was-parsed-exactly-once', scripts.length === 1, { count: scripts.length })) {
    throw new Error('script identity ambiguous');
  }
  const scriptId = scripts[0].scriptId;

  // ---- ACTUAL debugger-resolved breakpoint locations --------------------------
  const poss = await cdp.send('Debugger.getPossibleBreakpoints', {
    start: { scriptId, lineNumber: LINE, columnNumber: COL_CALLEE - 40 },
    end: { scriptId, lineNumber: LINE, columnNumber: COL_CALLEE + 200 },
    restrictToFunction: false
  });
  report.observed.possibleNearCallee = poss.locations.map((l) => l.columnNumber);
  const possCaller = await cdp.send('Debugger.getPossibleBreakpoints', {
    start: { scriptId, lineNumber: LINE, columnNumber: COL_CALLER - 120 },
    end: { scriptId, lineNumber: LINE, columnNumber: COL_CALLER + 260 },
    restrictToFunction: false
  });
  report.observed.possibleNearCaller = possCaller.locations.map((l) => l.columnNumber);

  gate('callee-column-is-an-ACTUAL-possible-breakpoint',
    report.observed.possibleNearCallee.includes(COL_CALLEE),
    { requested: COL_CALLEE, offered: report.observed.possibleNearCallee.slice(0, 12) });
  gate('caller-column-is-an-ACTUAL-possible-breakpoint',
    report.observed.possibleNearCaller.includes(COL_CALLER),
    { requested: COL_CALLER, offered: report.observed.possibleNearCaller.slice(0, 12) });

  // ---- set both logpoints; condition MUST evaluate false ----------------------
  const condA = `(()=>{try{const s=globalThis.__cxSink;if(!s)return false;` +
    `if(s.a.length>=s.cap){s.dropsA++;return false;}` +
    `s.a.push({t:performance.now(),prevUnits:t,disp:i,corridor:g,routeLen:(e&&e.length)||null,` +
    `foot:A?[A.x,A.y,A.z]:null});}catch(_){}return false;})()`;
  const condB = `(()=>{try{const s=globalThis.__cxSink;if(!s)return false;` +
    `if(s.b.length>=s.cap){s.dropsB++;return false;}` +
    `s.b.push({t:performance.now(),stage:(t&&t.stage)||null,oldCredit:(t&&t.terraUnits),` +
    `priorFoot:g?[g.x,g.y,g.z]:null,curFoot:i?[i.x,i.y,i.z]:null,disp:I,` +
    `proved:(t&&t.comparisonProved)||false});}catch(_){}return false;})()`;

  const bpA = await cdp.send('Debugger.setBreakpointByUrl', {
    lineNumber: LINE, columnNumber: COL_CALLEE, urlRegex: 'assets/index-BiDWGouH\\.js$', condition: condA
  });
  const bpB = await cdp.send('Debugger.setBreakpointByUrl', {
    lineNumber: LINE, columnNumber: COL_CALLER, urlRegex: 'assets/index-BiDWGouH\\.js$', condition: condB
  });
  report.observed.resolved = {
    A: { breakpointId: bpA.breakpointId, locations: bpA.locations },
    B: { breakpointId: bpB.breakpointId, locations: bpB.locations }
  };
  const locA = bpA.locations[0] || null;
  const locB = bpB.locations[0] || null;
  gate('LP-A-resolved-without-relocation',
    !!locA && locA.lineNumber === LINE && locA.columnNumber === COL_CALLEE && locA.scriptId === scriptId,
    { requested: { LINE, COL_CALLEE }, actual: locA });
  gate('LP-B-resolved-without-relocation',
    !!locB && locB.lineNumber === LINE && locB.columnNumber === COL_CALLER && locB.scriptId === scriptId,
    { requested: { LINE, COL_CALLER }, actual: locB });

  await page.waitForTimeout(4000);
  const sink = await page.evaluate(() => {
    const s = globalThis.__cxSink;
    return s ? { a: s.a.length, b: s.b.length, dropsA: s.dropsA, dropsB: s.dropsB,
      firstA: s.a[0] ?? null, firstB: s.b[0] ?? null } : null;
  });
  report.observed.sinkAfterIdleAtSurveyEntry = sink;
  report.observed.debuggerPauses = pauses;
  gate('logpoints-never-paused-the-debugger', pauses === 0, { pauses });
  report.observed.note =
    'Zero records at the survey entry is EXPECTED and is not a failure: the credit call only runs in the COMMON beat at stage holding-h. Presence of records here would itself be a finding.';
  report.finishedUtc = new Date().toISOString();
} catch (err) {
  report.error = { message: String(err && err.message ? err.message : err) };
  report.finishedUtc = new Date().toISOString();
} finally {
  if (browser) {
    try { await browser.close(); cleanup = { state: 'stopped', cleanupCompleted: true, reason: 'probe-finally', stopsRootPreview: false }; }
    catch (e) { cleanup = { state: 'error', cleanupCompleted: false, error: String(e), stopsRootPreview: false }; }
  }
  report.cleanup = cleanup;
  writeFileSync(join(OUT, 'location-resolution.json'), JSON.stringify(report, null, 2) + '\n');
  console.log('WROTE ' + join(OUT, 'location-resolution.json'));
}
process.exit(report.error ? 2 : (report.gates.every((g) => g.ok) ? 0 : 3));
