// Rehash the 98 implementation-source-manifest paths against the live tree.
// Read-only. Prints JSON: {count, mismatches:[], manifestSha256}
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const RUN = resolve(new URL('../../..', import.meta.url).pathname);
const REPO = resolve(RUN, '../../..');
const m = JSON.parse(readFileSync(resolve(RUN, 'implementation-source-manifest.json'), 'utf8'));
const sha = (b) => createHash('sha256').update(b).digest('hex');
const entries = Object.entries(m.hashes);
const mismatches = [];
for (const [p, want] of entries) {
  let got = null;
  try { got = sha(readFileSync(resolve(REPO, p))); } catch (e) { got = `ERR:${e.code}`; }
  if (got !== want) mismatches.push({ path: p, want, got });
}
const manifestSha = sha(readFileSync(resolve(RUN, 'implementation-source-manifest.json')));
console.log(JSON.stringify({ at: new Date().toISOString(), count: entries.length, mismatches, manifestSha256: manifestSha }, null, 1));
process.exit(mismatches.length ? 3 : 0);
