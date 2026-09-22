/**
 * selftest.mjs — CPU-only integrity suite for the SHORT survey lane.
 *
 * No browser, no preview, no build, no GPU, no game edit. It answers three
 * questions the pure logic suite cannot:
 *
 *   1. Are the helpers this lane owns still BYTE-IDENTICAL to the originals they
 *      were pinned from? (Concurrent roles may edit verifier/probes/lib/*.)
 *   2. Is the geometry this lane quotes still the geometry the FROZEN source
 *      actually contains? A quoted constant that drifts is a silent lie, so the
 *      numbers are re-extracted from commonGroundState.ts and compared.
 *   3. Do the SHIPPED predicate expectations this lane defers to still exist in
 *      the shipped unit suite, unchanged by sha?
 *
 * Run: node selftest.mjs      (add --require-pins to fail on original drift)
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import process from 'node:process';
import { CG_POSES, CG_ROUTE_SHORT, CG_ROUTE_LONG, SHIPPED_SHORT_PREDICATES, polylineLength } from './shortSurveyLogic.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const RUN_DIR = resolve(HERE, '..', '..', '..');
const REPO_ROOT = resolve(RUN_DIR, '..', '..', '..');
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
let failures = 0;
const ok = (cond, what, extra = '') => { if (!cond) { failures += 1; console.error(`FAIL ${what} ${extra}`); } else console.log(`ok   ${what}`); };

// --- 1. pinned bytes ---------------------------------------------------------------
const pin = JSON.parse(readFileSync(join(HERE, 'pin.json'), 'utf8'));
for (const entry of pin.pins) {
  const mine = join(HERE, entry.pinned.split('/').pop());
  ok(existsSync(mine), `pinned copy present: ${entry.pinned}`);
  if (!existsSync(mine)) continue;
  ok(sha(mine) === entry.pinnedSha256, `pinned copy unchanged: ${entry.pinned}`, sha(mine));
  const orig = resolve(RUN_DIR, entry.copiedFrom);
  if (!existsSync(orig)) { console.warn(`warn ORIGINAL MISSING ${entry.copiedFrom} — this lane still runs on its own bytes`); continue; }
  const drifted = sha(orig) !== entry.sourceSha256;
  if (drifted) {
    console.warn(`warn EXTERNAL DRIFT: ${entry.copiedFrom} is ${sha(orig)}, pinned at ${entry.sourceSha256}. Reported, NOT fixed by this lane.`);
    if (process.argv.includes('--require-pins')) failures += 1;
  } else console.log(`ok   original unchanged: ${entry.copiedFrom}`);
}

// --- 2. quoted geometry vs FROZEN source ------------------------------------------
const statePath = resolve(REPO_ROOT, 'main/src/story/commonGroundState.ts');
const stateSrc = readFileSync(statePath, 'utf8');
ok(sha(statePath) === pin.quotedSources['main/src/story/commonGroundState.ts'],
  'commonGroundState.ts is the sha this lane quoted', sha(statePath));

/** Pull the literal point list that follows an exported const name. */
function pointsAfter(name) {
  const at = stateSrc.indexOf(`export const ${name}`);
  if (at < 0) return null;
  const seg = stateSrc.slice(at, at + 2400);
  const end = seg.indexOf('].map');
  const body = end > 0 ? seg.slice(0, end) : seg;
  return [...body.matchAll(/\{\s*x:\s*(-?[\d.]+),\s*y:\s*(-?[\d.]+),\s*z:\s*(-?[\d.]+)\s*\}/g)].map((m) => [Number(m[1]), Number(m[2]), Number(m[3])]);
}
const srcShort = pointsAfter('CG_ROUTE_SHORT');
const srcLong = pointsAfter('CG_ROUTE_LONG');
ok(!!srcShort && JSON.stringify(srcShort) === JSON.stringify(CG_ROUTE_SHORT.map((p) => [...p])),
  'quoted CG_ROUTE_SHORT matches the frozen source literal', JSON.stringify(srcShort ?? null).slice(0, 200));
ok(!!srcLong && JSON.stringify(srcLong) === JSON.stringify(CG_ROUTE_LONG.map((p) => [...p])),
  'quoted CG_ROUTE_LONG matches the frozen source literal');
ok(Math.abs(polylineLength(CG_ROUTE_SHORT) - 16) < 1e-6 && Math.abs(polylineLength(CG_ROUTE_LONG) - 36) < 1e-6,
  'the two spans are still 16 and 36 walked units');
// The SHORT span is a straight z=12 line: it is NOT the long detour, and the
// witness pose is OFF it, which is the whole reason this lane exists.
ok(CG_ROUTE_SHORT.every((p) => p[2] === 12), 'the short span lies entirely on z=12');
ok(CG_POSES.W.z === 10 && CG_ROUTE_SHORT.every((p) => p[2] !== CG_POSES.W.z), 'the authored witness pose W is OFF the short span');
for (const [name, want] of [['S', CG_POSES.S], ['E', CG_POSES.E], ['W', CG_POSES.W], ['R', CG_POSES.R]]) {
  const m = stateSrc.match(new RegExp(`\\n  ${name}: Object\\.freeze\\(\\{ x: (-?[\\d.]+), y: (-?[\\d.]+), z: (-?[\\d.]+) \\}\\)`));
  ok(!!m && Number(m[1]) === want.x && Number(m[2]) === want.y && Number(m[3]) === want.z, `quoted pose ${name} matches frozen source`);
}
ok(CG_ROUTE_SHORT[0].join() === [CG_POSES.S.x, CG_POSES.S.y, CG_POSES.S.z].join()
  && CG_ROUTE_SHORT[CG_ROUTE_SHORT.length - 1].join() === [CG_POSES.E.x, CG_POSES.E.y, CG_POSES.E.z].join(),
  'the short span actually runs S -> E');

// --- 3. the shipped predicate snapshot --------------------------------------------
const testPath = resolve(REPO_ROOT, SHIPPED_SHORT_PREDICATES.source);
ok(sha(testPath) === SHIPPED_SHORT_PREDICATES.sourceSha256,
  'the shipped predicate suite is the sha this lane defers to', sha(testPath));
const testSrc = readFileSync(testPath, 'utf8');
ok(/completes the short route once the off-route witness at W is occupied/.test(testSrc),
  'the shipped suite still asserts short-completes-with-an-occupied-witness');
ok(/names the survey housing, not a generic failure, on the short route/.test(testSrc),
  'the shipped suite still asserts the named short-route hold cause');
ok(/completes the long route on the first try with no witness at all/.test(testSrc),
  'the shipped suite still asserts long-completes-with-the-fixed-reference-alone');
for (const reason of SHIPPED_SHORT_PREDICATES.shortHoldReasons) {
  ok(testSrc.includes(reason), `the shipped suite still names hold reason ${reason}`);
}

// --- 4. the director's class decision this lane depends on -------------------------
const dirSrc = readFileSync(resolve(REPO_ROOT, 'main/src/story/commonGroundDirector.ts'), 'utf8');
ok(/routeClass\s*:\s*SurveyRouteClass\s*=\s*held\s*\?\s*'held-reference'\s*:\s*'fixed-reference'/.test(dirSrc),
  'the runtime still earns held-reference ONLY from a live held socket');
ok(/survey\.witness\s*&&\s*survey\.witness\.offered\s*&&\s*survey\.witness\.occupied/.test(dirSrc),
  'the held socket still requires BOTH an offer and live occupancy');
ok(/if \(survey\.hold\.reason === 'footing-invalid'\) return false;/.test(dirSrc),
  'unsafe footing is still never repaired by witness occupancy');

// --- 5. the pure decision suite ----------------------------------------------------
const { status } = await import('node:child_process').then(({ spawnSync }) => spawnSync(
  process.execPath, [join(HERE, 'shortSurveyLogic.mjs'), '--self-test'], { encoding: 'utf8', stdio: 'inherit' }
));
ok(status === 0, 'the pure decision suite passes');

console.log(failures === 0 ? '[arrival-common-short selftest] OK' : `[arrival-common-short selftest] ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
