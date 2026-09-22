/**
 * CPU-ONLY self-test. No browser, no GPU, no build, no game-source read-write.
 * Proves (a) the minified binding is still unique in the immutable 34413 bundle,
 * (b) the logpoint condition strings parse and evaluate to false against a
 * simulated argument frame, and (c) the record shape / return-chaining is exact.
 *
 * Run: node verifier/probes/common-exact-input/selftest.mjs
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { BUNDLE, SITES, LP_A, SINK_INSTALL, chainReturns } from './creditCallLogpoints.mjs';

const BUNDLE_FILE = process.env.CG_BUNDLE
  ?? '/tmp/paravoxia-preview-BzLmel/dist/assets/index-BiDWGouH.js';

const results = [];
const check = (name, ok, detail) => { results.push({ name, ok: !!ok, detail }); };

// --- 1. bundle identity + binding uniqueness ---------------------------------
let src = null;
try { src = readFileSync(BUNDLE_FILE, 'utf8'); } catch (e) { check('bundle-readable', false, String(e.message)); }
if (src !== null) {
  const sha = createHash('sha256').update(readFileSync(BUNDLE_FILE)).digest('hex');
  check('bundle-sha256-matches-preview-ownership', sha === BUNDLE.sha256, { sha, expected: BUNDLE.sha256 });
  const count = (s, n) => s.split(n).length - 1;
  check('unique-corridor-default', count(src, '=2.5){') === 1, count(src, '=2.5){'));
  check('unique-decl', count(src, 'function pwe(e,A,t,i,g=2.5)') === 1, null);
  check('exactly-one-call-site', (src.match(/(?<![\w$])pwe\(/g) || []).length === 2, null);
  check('call-site-arity-and-args', src.includes('t.terraUnits=pwe(tQ,i,t.terraUnits,I)'), null);
  check('guard-chain-is-support-then-reference',
    src.includes('(g?fL(g,i,o,{extraSolids:n}):o.isSupported(i))&&GH(Q,RH(i),zKA()).ok&&(t.terraUnits=pwe('), null);
  check('bodiesClear-NOT-in-credit-guard',
    !src.includes('TKA(') || !/TKA\([^)]*\)&&[^;]*pwe\(/.test(src), 'bodiesClear absent from credit path');
  // exact CDP coordinates
  const off = src.indexOf('function pwe(e,A,t,i,g=2.5)');
  const line = src.slice(0, off).split('\n').length - 1;
  const col = off - (src.lastIndexOf('\n', off) + 1);
  check('decl-line-col-exact', line === SITES.creditDecl.lineNumber && col === SITES.creditDecl.columnNumber,
    { line, col });
}

// --- 2. logpoint condition parses, returns false, never pauses ---------------
globalThis.__cgXi = undefined;
const installed = (0, eval)(SINK_INSTALL);
check('sink-installs-once', installed === 'installed' && (0, eval)(SINK_INSTALL) === 'already', installed);
// Simulate the exact V8 frame: e=route, A=body, t=prev, i=disp, g=corridor.
const frame = (prev, disp, foot) => {
  const e = new Array(10).fill(0), A = { x: foot[0], y: foot[1], z: foot[2] },
    t = prev, i = disp, g = 2.5;
  // eslint-disable-next-line no-eval
  return eval(LP_A.condition);
};
const r1 = frame(4.008321486093145, 0.0836, [-44.028859, 50.989046, 16.164333]);
const r2 = frame(6, 0.0836, [-44.2, 50.989, 16.164333]);
const r3 = frame(6, 0.0836, [-44.4, 50.989, 16.164333]);
check('condition-returns-false-always', r1 === false && r2 === false && r3 === false, [r1, r2, r3]);
check('records-appended', globalThis.__cgXi.rec.length === 3, globalThis.__cgXi.rec.length);
const rec0 = globalThis.__cgXi.rec[0];
check('record-shape-exact',
  ['k', 'n', 't', 'prev', 'disp', 'foot', 'corridor', 'routeLen'].every(k => k in rec0)
  && rec0.foot.length === 3 && rec0.corridor === 2.5, rec0);

// --- 3. bounded cap actually bounds -----------------------------------------
globalThis.__cgXi.cap = 4;
frame(6, 0.0836, [0, 0, 0]); frame(6, 0.0836, [0, 0, 0]);
check('cap-bounds-and-counts-drops', globalThis.__cgXi.rec.length === 4 && globalThis.__cgXi.drop === 1,
  { len: globalThis.__cgXi.rec.length, drop: globalThis.__cgXi.drop });

// --- 4. return chaining is actual, final stays MISSING -----------------------
const chained = chainReturns(globalThis.__cgXi.rec.slice(0, 3));
check('returned-credit-from-actual-next-prev', chained[0].returned === 6
  && chained[0].returnedSource === 'actual-next-call-previousUnits', chained[0]);
check('final-return-is-missing-not-interpolated',
  chained[2].returned === null && chained[2].returnedSource === 'MISSING-final-call', chained[2]);
check('ceiling-and-refusal-derived-not-assumed',
  Math.abs(chained[1].ceiling - 6.0836) < 1e-9 && chained[1].refusedByCeiling === true, chained[1]);

const failed = results.filter(r => !r.ok);
console.log(JSON.stringify({ bundleFile: BUNDLE_FILE, passed: results.length - failed.length,
  failed: failed.length, results }, null, 1));
process.exit(failed.length ? 1 : 0);
