// D6 deliverable 6: the shipped chapter 1-9 mood regression table.
//
// The frozen MOODS block is extracted from the pinned source revision and from
// the working tree and compared line for line. "Additive only" is not a claim
// about diff size — it is the assertion that no shipped beat's authored line
// changed at all, which is what this measures.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const REPO = '/home/thomasphillip/Projects/vox';
const REV = '929e3d0a650fedccd2d04e68db792e09634d416e';
const RUN_DIR = path.dirname(new URL(import.meta.url).pathname);

const before = execSync(`git show ${REV}:main/src/story/storyScore.ts`,
  { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 24 });
const after = fs.readFileSync(path.join(REPO, 'main/src/story/storyScore.ts'), 'utf8');

function moodsBlock(src) {
  const start = src.indexOf('const MOODS:');
  const end = src.indexOf('\n};', start);
  return src.slice(start, end + 3);
}
const a = moodsBlock(before);
const b = moodsBlock(after);
const numstat = execSync(`git diff --numstat ${REV} -- main/src/story/storyScore.ts`,
  { cwd: REPO, encoding: 'utf8' }).trim().split(/\s+/);

const rows = [];
for (const line of a.split('\n')) {
  const beat = (line.match(/^\s*'?([a-z0-9-]+)'?\s*:\s*\{/) || [])[1];
  if (!beat || beat === 'chord' || beat === 'melody') continue;
  rows.push({
    beat,
    sha256: crypto.createHash('sha256').update(line.trim()).digest('hex').slice(0, 16),
    unchanged: b.includes(line)
  });
}

const out = {
  deliverable: 'evidence/score/regression_ch1-ch9_moods.json',
  method: 'the frozen MOODS table is extracted from the pinned source revision and from the working tree; every shipped beat entry is hashed line-for-line and counted unchanged only if its exact authored line survives byte-for-byte',
  pinnedRevision: REV,
  moodsTableByteIdentical: a === b,
  shippedBeatCount: rows.length,
  changedBeats: rows.filter(row => !row.unchanged).map(row => row.beat),
  fileNumstat: { added: Number(numstat[0]), deleted: Number(numstat[1]) },
  additiveOnly: {
    rule: 'chapter 10 lives in its own CH10_MOODS table; no shipped ch1-ch9 mood entry may be edited or removed',
    passes: a === b
  },
  beats: rows
};
fs.writeFileSync(path.join(RUN_DIR, 'evidence/score/regression_ch1-ch9_moods.json'),
  JSON.stringify(out, null, 2) + '\n');
console.log('moodsTableByteIdentical', out.moodsTableByteIdentical,
  'shippedBeats', out.shippedBeatCount, 'changed', out.changedBeats);
