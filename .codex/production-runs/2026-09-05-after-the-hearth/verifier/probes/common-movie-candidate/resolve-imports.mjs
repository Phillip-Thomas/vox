/**
 * PRIVATE PREP VALIDATION (common-movie-candidate). CPU only.
 *
 * Walks every STATIC and every DYNAMIC-LITERAL relative import reachable from
 * the files in this folder and asserts each target exists ON DISK from THIS
 * folder's depth. It never imports or evaluates any module, because
 * `journey-probe.mjs` launches a browser at module top level: resolution here is
 * pure path arithmetic plus `statSync`, so it is safe to run with no GPU.
 *
 * Bare specifiers (`node:*`) are recorded and skipped. A missing target is a
 * hard failure and is printed once with its full chain, so a repeat of the
 * "three identical missing-import attempts" loop cannot happen.
 */
import { readFileSync, statSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOTS = process.argv.slice(2);
if (ROOTS.length === 0) { console.error('usage: resolve-imports.mjs <entry.mjs> [...]'); process.exit(2); }

// `from '...'` / `from "..."` (static) and `import('...')` (dynamic literal only).
const STATIC_RE = /(?:^|[\s;}])(?:import|export)\s[^;'"]*?from\s*['"]([^'"]+)['"]/g;
const SIDE_RE = /(?:^|[\s;}])import\s*['"]([^'"]+)['"]/g;
const DYN_RE = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
// A dynamic import whose argument is NOT a literal cannot be resolved statically.
const DYN_NONLITERAL_RE = /\bimport\s*\(\s*(?!['"])/g;

const specifiers = (src) => {
  const out = [];
  for (const re of [STATIC_RE, SIDE_RE, DYN_RE]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src)) !== null) out.push(m[1]);
  }
  return [...new Set(out)];
};

const seen = new Map();
const edges = [];
const problems = [];
const bare = new Set();
let nonLiteralDynamic = 0;

function visit(abs, chain) {
  if (seen.has(abs)) return;
  let src;
  try { src = readFileSync(abs, 'utf8'); }
  catch (e) { problems.push({ file: abs, chain, error: `unreadable: ${String(e).slice(0, 160)}` }); return; }
  seen.set(abs, null);
  DYN_NONLITERAL_RE.lastIndex = 0;
  nonLiteralDynamic += (src.match(DYN_NONLITERAL_RE) ?? []).length;
  for (const spec of specifiers(src)) {
    if (!spec.startsWith('.') && !spec.startsWith('/')) { bare.add(spec); continue; }
    const target = resolve(dirname(abs), spec);
    edges.push({ from: abs, spec, target });
    let ok = false;
    try { ok = statSync(target).isFile(); } catch { ok = false; }
    if (!ok) {
      problems.push({ file: abs, chain, spec, target, error: 'relative import target does not exist from this folder depth' });
      continue;
    }
    visit(target, [...chain, `${relative(HERE, abs)} -> ${spec}`]);
  }
}

for (const r of ROOTS) visit(resolve(HERE, r), []);

const report = {
  schema: 'paravoxia.verifier.commonMovieCandidate.importResolution.v1',
  here: HERE,
  entries: ROOTS,
  modulesVisited: [...seen.keys()].sort(),
  relativeEdges: edges.length,
  bareSpecifiers: [...bare].sort(),
  nonLiteralDynamicImports: nonLiteralDynamic,
  problems,
  ok: problems.length === 0 && [...bare].every((b) => b.startsWith('node:'))
};
console.log(JSON.stringify(report, null, 2));
if (!report.ok) {
  for (const p of problems) console.error(`[resolve-imports] MISSING ${p.spec ?? ''} -> ${p.target ?? p.file} (${p.error})`);
  process.exit(1);
}
