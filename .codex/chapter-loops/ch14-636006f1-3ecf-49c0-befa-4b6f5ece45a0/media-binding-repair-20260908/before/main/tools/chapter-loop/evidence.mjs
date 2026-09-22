import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { requireThat, sha } from './contract.mjs';
import { inside, readJson, reference, writeJson, checkRef } from './store.mjs';
import { runProcess } from './process.mjs';
import { gameSourceSeal } from './cache.mjs';
import { previewBuildManifest } from '../lib/previewSnapshot.mjs';

// Names are semantic obligations. Their JSON pointers bind to existing probes;
// absent capabilities block initialization instead of inventing a chapter probe.
export const OBLIGATIONS = Object.freeze({
  manual: ['ordinaryControls', 'acceptedAction'],
  recovery: ['interrupted', 'recovered', 'acceptedAction'],
  continue: ['clickedContinue', 'stateEqual', 'newAcceptedAction'],
  continuity: ['earnedEntry', 'earnedExit', 'noFixtures'],
  av: ['videoDecodes', 'audioDecodes', 'framesNonblank'],
});
export function validateCommand(command) {
  requireThat(command && Array.isArray(command.argv) && command.argv.length > 0 && command.argv.every(x => typeof x === 'string'), 'Probe requires explicit argv');
  requireThat(typeof command.cwd === 'string' && Number.isSafeInteger(command.timeoutMs) && command.timeoutMs > 0, 'Probe needs cwd and timeoutMs');
}
function validateAssertion(rule, name) {
  requireThat(rule && typeof rule.pointer === 'string' && rule.pointer.startsWith('/'), `Missing ${name} assertion`);
  const numeric = Object.hasOwn(rule, 'gte'), equality = Object.hasOwn(rule, 'equals');
  requireThat(numeric !== equality && (numeric ? Number.isFinite(rule.gte) && rule.gte >= 1
    : rule.equals === true || rule.equals === 'passed' || rule.equals === 'PASS'), `Assertion ${name} must prove success with one comparator`);
}
export function validateVerification(config) {
  validateCommand(config?.build);
  requireThat(typeof config.dist === 'string', 'Build output directory required');
  requireThat(Array.isArray(config.cases), 'Existing deterministic probe bindings required');
  for (const [kind, names] of Object.entries(OBLIGATIONS)) {
    const cases = config.cases.filter(c => c.kind === kind);
    requireThat(cases.length === 1, `Exactly one ${kind} proof binding required`);
    const c = cases[0]; validateCommand(c);
    requireThat(typeof c.report === 'string' && !c.report.includes('{') && typeof c.schema === 'string', `${kind} raw report/schema required`);
    for (const name of [...names, 'hardware', 'cleanup']) {
      const a = c.assertions?.[name];
      validateAssertion(a, `${kind}.${name}`);
    }
    requireThat(Array.isArray(c.media) && (kind !== 'av' || ['video', 'audio', 'frame'].every(k => c.media.some(m => m.kind === k))), 'AV proof needs video, audible media and a frame');
  }
  for (const kind of ['look', 'listen']) validateCommand(config.observe?.[kind]);
}
export function pointer(value, p) {
  return p.split('/').slice(1).reduce((v, key) => v?.[key.replace(/~1/g, '/').replace(/~0/g, '~')], value);
}
export function inspectReport(config, directory) {
  const reportFile = inside(directory, config.report);
  const data = readJson(reportFile);
  requireThat(data.schema === config.schema, 'Unexpected probe report schema');
  const checks = Object.entries(config.assertions).map(([name, rule]) => {
    validateAssertion(rule, name);
    const actual = pointer(data, rule.pointer);
    return { name, pointer: rule.pointer, actual: actual ?? null, passed: 'gte' in rule ? typeof actual === 'number' && actual >= rule.gte : actual === rule.equals };
  });
  // A malformed probe/cleanup is inconclusive, never a game defect.
  requireThat(checks.find(x => x.name === 'hardware')?.passed, 'Hardware proof unavailable');
  requireThat(checks.find(x => x.name === 'cleanup')?.passed, 'Owned probe cleanup unproved');
  const media = config.media.map(m => {
    const file = inside(directory, m.path);
    requireThat(fs.statSync(file).size > 0 && ['video', 'audio', 'frame'].includes(m.kind), 'Empty/unknown media');
    return { kind: m.kind, file };
  });
  return { reportFile, checks, media, passed: checks.every(x => x.passed) };
}
export function expand(value, variables) {
  return value.replace(/\{([a-zA-Z]+)\}/g, (_, key) => {
    requireThat(key in variables, `Unknown command variable ${key}`); return variables[key];
  });
}
export async function command(config, { repo, directory, variables, timeoutMs, shouldStop, heavyLock, onStart }) {
  fs.mkdirSync(directory, { recursive: true });
  const args = config.argv.map(x => expand(x, variables));
  const cwd = config.cwd === '.' ? repo : inside(repo, config.cwd);
  const executable = heavyLock ? 'flock' : args.shift();
  if (heavyLock) { fs.mkdirSync(path.dirname(heavyLock), { recursive: true }); args.unshift('-E', '75', '-w', '30', heavyLock); }
  return runProcess(executable, args, { cwd, env: {
    PARAVOXIA_URL: variables.preview ?? '', CHAPTER_LOOP_OUTPUT: directory,
    CHAPTER_LOOP_CANDIDATE: variables.candidate ?? '',
    CHAPTER_LOOP_PROVENANCE: variables.provenance ?? '', CHAPTER_LOOP_DEADLINE: variables.deadline ?? '',
    PARAVOXIA_ALLOW_SWIFTSHADER: '0',
  }, log: path.join(directory, 'command.log'), timeoutMs: Math.min(timeoutMs, config.timeoutMs), shouldStop, onStart });
}
export async function startPreview(dist, log, reuse = null) {
  const manifest = previewBuildManifest(dist);
  const verifyAt = async url => {
    requireThat(previewBuildManifest(dist).sha256 === manifest.sha256, 'Archived build changed');
    for (const [file, expected] of Object.entries(manifest.files)) {
      const response = await fetch(new URL(file, url), { signal: AbortSignal.timeout(10_000) });
      requireThat(response.ok && sha(Buffer.from(await response.arrayBuffer())) === expected, `Served build differs: ${file}`);
    }
  };
  if (reuse) {
    const url = new URL(reuse.url);
    requireThat(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && !url.username && !url.password, 'Reusable preview must be local');
    requireThat(Object.keys(reuse.files ?? {}).length === Object.keys(manifest.files).length
      && Object.entries(manifest.files).every(([file, hash]) => reuse.files[file] === hash), 'Existing preview ownership identifies a different build');
    await verifyAt(url);
    fs.writeFileSync(log, JSON.stringify({ reused: true, url: url.href, owner: reuse.owner, pid: reuse.daemonPid, build: manifest.sha256 }) + '\n', { flag: 'wx' });
    // This run borrows the verified persistent server. Its original owner
    // retains process lifetime; probe cleanup must never stop it.
    return { url: url.href, manifest, pid: reuse.daemonPid, reused: true, close() {}, verify: () => verifyAt(url) };
  }
  // Start one owned immutable preview when no reusable owner is bound.
  const script = new URL('./preview.mjs', import.meta.url);
  const output = fs.openSync(log, 'wx');
  const child = spawn(process.execPath, [script.pathname, dist], { stdio: ['ignore', 'pipe', output], detached: true });
  fs.closeSync(output);
  const close = () => { try { process.kill(-child.pid, 'SIGTERM'); } catch { /* exited */ } };
  try {
    const url = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Preview did not start')), 10_000); let text = '';
      child.once('error', e => { clearTimeout(timer); reject(e); });
      child.once('exit', () => { clearTimeout(timer); reject(new Error('Preview exited')); });
      child.stdout.on('data', bytes => { text += bytes; if (text.includes('\n')) { clearTimeout(timer); resolve(text.trim()); } });
    });
    const verify = () => verifyAt(url);
    await verify();
    return { url, manifest, pid: child.pid, close, verify };
  } catch (e) { close(); throw e; }
}
export function verifyBundle(repo, bundle) {
  if (bundle.sourceScope === 'game-v1') requireThat(gameSourceSeal(repo) === bundle.source, 'Game source changed after evidence capture');
  for (const ref of bundle.artifacts) checkRef(repo, ref);
  requireThat(bundle.candidateSha256 === sha({ source: bundle.source, build: bundle.build }), 'Candidate seal mismatch');
  requireThat(previewBuildManifest(inside(repo, bundle.dist)).sha256 === bundle.build, 'Archived candidate build changed');
}
export function archiveBundle(repo, directory, data) {
  writeJson(path.join(directory, 'bundle.json'), data);
  return reference(repo, path.join(directory, 'bundle.json'));
}
