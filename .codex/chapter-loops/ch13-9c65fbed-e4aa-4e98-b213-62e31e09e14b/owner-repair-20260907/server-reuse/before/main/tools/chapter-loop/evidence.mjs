import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { requireThat, sha } from './contract.mjs';
import { inside, readJson, reference, writeJson, checkRef } from './store.mjs';
import { runProcess } from './process.mjs';
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
      requireThat(a && typeof a.pointer === 'string' && a.pointer.startsWith('/'), `Missing ${kind}.${name} assertion`);
      requireThat(a.equals === true || a.equals === 'passed' || a.equals === 'PASS' || (Number.isFinite(a.gte) && a.gte >= 1), `Assertion ${kind}.${name} must prove success`);
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
  }, log: path.join(directory, 'command.log'), timeoutMs: Math.min(timeoutMs, config.timeoutMs), shouldStop, onStart });
}
export async function startPreview(dist, log) {
  const manifest = previewBuildManifest(dist);
  // Serve only an immutable copy; never trust an existing localhost port.
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
    const verify = async () => {
      requireThat(previewBuildManifest(dist).sha256 === manifest.sha256, 'Archived build changed');
      for (const [file, expected] of Object.entries(manifest.files)) {
        const response = await fetch(new URL(file, url), { signal: AbortSignal.timeout(10_000) });
        requireThat(response.ok && sha(Buffer.from(await response.arrayBuffer())) === expected, `Served build differs: ${file}`);
      }
    };
    await verify();
    return { url, manifest, pid: child.pid, close, verify };
  } catch (e) { close(); throw e; }
}
export function verifyBundle(repo, bundle) {
  for (const ref of bundle.artifacts) checkRef(repo, ref);
  requireThat(bundle.candidateSha256 === sha({ source: bundle.source, build: bundle.build }), 'Candidate seal mismatch');
  requireThat(previewBuildManifest(inside(repo, bundle.dist)).sha256 === bundle.build, 'Archived candidate build changed');
}
export function archiveBundle(repo, directory, data) {
  writeJson(path.join(directory, 'bundle.json'), data);
  return reference(repo, path.join(directory, 'bundle.json'));
}
