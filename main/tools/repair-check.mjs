#!/usr/bin/env node
// Run the affected player action before broad checks. Successful deterministic
// checks may be reused only for the same complete source/command/environment.
// This report is verification evidence, never creative acceptance.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { resolve, join, dirname, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const hash = value => createHash('sha256').update(value).digest('hex');
const json = path => JSON.parse(readFileSync(path, 'utf8'));
const need = (ok, why) => { if (!ok) throw Error(why); };
function write(path, value) {
  mkdirSync(dirname(path), {recursive: true});
  const temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, JSON.stringify(value, null, 2) + '\n'); renameSync(temp, path);
}
export function sourceIdentity(root = ROOT) {
  const listed = spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--',
    'main/src', 'main/public', 'main/tools', 'main/*.json', 'main/*.ts', 'main/*.html', 'scripts', 'docs/architecture', 'package-lock.json'], {cwd: root, encoding: 'utf8'});
  need(listed.status === 0, 'cannot enumerate candidate source');
  return hash(JSON.stringify([...new Set(listed.stdout.split('\0').filter(Boolean))].sort().map(p => [p, existsSync(join(root,p)) ? hash(readFileSync(join(root,p))) : null])));
}
export function runChecks(plan, {root = ROOT, out, final = false, execute = spawnSync, identify = () => sourceIdentity(root)} = {}) {
  need(plan.schema === 'paravoxia.repairChecks.v1', 'invalid repair check plan');
  need(Array.isArray(plan.runtime) && plan.runtime.length > 0, 'at least one actual affected runtime probe is required');
  need(Array.isArray(plan.checks), 'focused check commands required');
  for (const argv of [...(plan.prepare ?? []), ...plan.runtime, ...plan.checks, ...(plan.final ?? [])]) {
    need(Array.isArray(argv) && argv.length && argv.every(a => typeof a === 'string' && a.length), 'commands must be nonempty argv arrays');
  }
  const source = identify();
  const identity = hash(JSON.stringify({source, plan, runner: hash(readFileSync(fileURLToPath(import.meta.url))),
    node: process.version, platform: process.platform, arch: process.arch,
    environment: hash(JSON.stringify(Object.entries(process.env).filter(([key]) => !['_', 'PWD', 'OLDPWD', 'SHLVL'].includes(key)).sort(([a], [b]) => a.localeCompare(b))))}));
  const cachePath = join(out, 'checks.json');
  let prior; try { prior = json(cachePath); } catch {}
  const report = {schema: 'paravoxia.repairCheckReport.v1', source, identity, scope: final ? 'candidate-final' : 'affected-runtime-and-checks',
    accepted: false, passed: false, checks: [], startedAt: new Date().toISOString()};
  mkdirSync(out, {recursive: true});
  const groups = [['prepare', plan.prepare ?? []], ['runtime', plan.runtime], ['checks', plan.checks], ...(final ? [['final', [...(plan.final ?? []).filter(argv => JSON.stringify(argv) !== JSON.stringify(['npm','run','verify'])), ['npm','run','verify']]]] : [])];
  for (const [group, commands] of groups) for (const [i, argv] of commands.entries()) {
    const key = `${group}-${i}`;
    const old = prior?.identity === identity && prior.checks.find(c => c.key === key && c.exitCode === 0 && JSON.stringify(c.argv) === JSON.stringify(argv));
    // Preparation rebuilds its outputs; browser/player evidence is always fresh. Reuse only exact deterministic
    // logs; a missing/edited log invalidates reuse instead of becoming a pass.
    let reusable = !['runtime', 'prepare'].includes(group) && old;
    if (reusable) try { reusable = hash(readFileSync(old.log)) === old.logSha256; } catch { reusable = false; }
    if (reusable) report.checks.push({...old, reused: true});
    else {
      const start = Date.now();
      const result = execute(argv[0], argv.slice(1), {cwd: join(root, 'main'), encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 30 * 60 * 1000});
      const log = join(out, `${key}.log`);
      writeFileSync(log, `${result.stdout ?? ''}${result.stderr ?? ''}${result.error ? '\n' + result.error.message : ''}`);
      report.checks.push({key, argv, exitCode: result.status ?? 1, ms: Date.now() - start, reused: false, log, logSha256: hash(readFileSync(log))});
    }
    const changed = identify() !== source;
    if (report.checks.at(-1).exitCode !== 0 || changed) {
      report.blocker = changed ? 'source-changed-during-checks' : `${key}-failed`;
      write(cachePath, report); return report;
    }
  }
  report.passed = true; report.finishedAt = new Date().toISOString();
  write(cachePath, report); return report;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = key => {const i = process.argv.indexOf('--' + key);return i < 0 ? null : process.argv[i + 1];};
  try {
    need(arg('plan') && arg('out'), 'usage: repair-check.mjs --plan PLAN.json --out EVIDENCE_DIR [--final]');
    const report = runChecks(json(resolve(arg('plan'))), {out: resolve(arg('out')), final: process.argv.includes('--final')});
    console.log(JSON.stringify({passed: report.passed, scope: report.scope, accepted: false, blocker: report.blocker, reused: report.checks.filter(c => c.reused).length}));
    if (!report.passed) process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 2; }
}
