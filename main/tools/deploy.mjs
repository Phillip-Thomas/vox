#!/usr/bin/env node
// --- Deploy through the front door ---------------------------------------------------
//
// The ch10 run shipped mid-run from an uncommitted tree because nothing in the
// governance chain stood between a shell and `firebase deploy`. This wrapper
// is the front door: it refuses a dirty tree unless told otherwise, runs
// `npm run verify` (typecheck, tests, gates, build) and only then deploys,
// recording the exact commit it shipped to .codex/deploys.jsonl.
//
//   npm run deploy                       # verify, then firebase deploy --only hosting
//   npm run deploy -- --allow-dirty      # deploy an uncommitted tree (the ch10 mistake, on purpose)
//   npm run deploy -- --skip-verify      # owner escape hatch; recorded as such
//
// firebase.json's own predeploy hook is a protected path in the chapter
// contract and changes only on the owner's decision
// (owner-decision-firebase-predeploy-gate); this wrapper does not depend on it.

import { execSync, spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const MAIN = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = resolve(MAIN, '..');
const has = (f) => process.argv.includes(f);
const git = (args) => execSync(`git ${args}`, { cwd: ROOT, encoding: 'utf8' }).trim();
const tag = (m) => console.log(`[deploy] ${m}`);

const sha = git('rev-parse HEAD');
const branch = git('branch --show-current');
const dirty = git('status --porcelain').split('\n').filter(Boolean);
if (dirty.length && !has('--allow-dirty')) {
  console.error(`[deploy] refusing: ${dirty.length} uncommitted change(s) on ${branch}. Commit, or pass --allow-dirty to ship an uncommitted tree deliberately.`);
  process.exit(2);
}
tag(`${branch} @ ${sha.slice(0, 12)}${dirty.length ? ` (+${dirty.length} uncommitted, --allow-dirty)` : ''}`);

let verify = 'skipped';
if (!has('--skip-verify')) {
  tag('verify…');
  const v = spawnSync('npm', ['run', 'verify'], { cwd: MAIN, stdio: 'inherit' });
  if (v.status !== 0) { console.error('[deploy] refusing: verify failed'); process.exit(1); }
  verify = 'passed';
} else tag('verify SKIPPED (--skip-verify)');

const d = spawnSync('firebase', ['deploy', '--only', 'hosting'], { cwd: ROOT, stdio: 'inherit' });
const record = { deployedAt: new Date().toISOString(), sha, branch, dirty: dirty.length, verify, exit: d.status ?? 1 };
mkdirSync(join(ROOT, '.codex'), { recursive: true });
appendFileSync(join(ROOT, '.codex', 'deploys.jsonl'), `${JSON.stringify(record)}\n`);
tag(`${d.status === 0 ? 'deployed' : 'FAILED'} — recorded in .codex/deploys.jsonl`);
process.exit(d.status ?? 1);
