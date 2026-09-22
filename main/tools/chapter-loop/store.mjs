import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { sha, requireThat } from './contract.mjs';

export const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
export function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(data, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  fs.renameSync(temporary, file);
}
export function inside(root, name, { exists = true } = {}) {
  requireThat(typeof name === 'string' && name.length > 0 && !path.isAbsolute(name), 'Expected a relative artifact path');
  const absolute = path.resolve(root, name);
  requireThat(absolute.startsWith(`${path.resolve(root)}${path.sep}`), 'Path escapes its owner');
  let check = absolute;
  while (!fs.existsSync(check)) check = path.dirname(check);
  const realRoot = fs.realpathSync(root);
  const real = fs.realpathSync(check);
  requireThat(real === realRoot || real.startsWith(`${realRoot}${path.sep}`), 'Symlink escapes its owner');
  if (exists) requireThat(fs.existsSync(absolute), `Missing artifact: ${name}`);
  return absolute;
}
export function reference(root, file) {
  const relative = path.relative(root, file);
  const actual = inside(root, relative);
  requireThat(fs.statSync(actual).isFile(), 'Evidence must be a file');
  return { path: relative, sha256: sha(fs.readFileSync(actual)) };
}
export function checkRef(root, ref) {
  const actual = inside(root, ref.path);
  requireThat(reference(root, actual).sha256 === ref.sha256, `Evidence changed: ${ref.path}`);
  return actual;
}
export function snapshot(repo) {
  // Git's file inventory includes dirty and untracked source, never a checkout/reset.
  const names = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: repo, maxBuffer: 16 * 1024 * 1024 }).toString().split('\0');
  return Object.fromEntries([...new Set(names)].filter(n => n && (
    /^(main\/(src\/|public\/|tools\/|[^/]+\.(json|[mc]?js|ts)$)|scripts\/)/.test(n)
  )).sort().map(n => {
    const file = inside(repo, n, { exists: false });
    return [n, fs.existsSync(file) ? sha(fs.readFileSync(file)) : null];
  }));
}
export function differences(before, after) {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(p => before[p] !== after[p]);
}
export function allowedPath(file, prefixes) {
  return prefixes.some(p => file === p || (p.endsWith('/') && file.startsWith(p)));
}
export function sourceSeal(repo) { return sha(snapshot(repo)); }
export function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}
export function acquireLock(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let fd;
  try { fd = fs.openSync(file, 'wx', 0o600); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const previous = readJson(file);
    requireThat(!pidAlive(previous.pid), `Runner already active (PID ${previous.pid})`);
    // Only remove a proved-dead owner's lock; state still decides whether resume is legal.
    fs.unlinkSync(file);
    fd = fs.openSync(file, 'wx', 0o600);
  }
  fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
  fs.closeSync(fd);
  return () => { if (fs.existsSync(file) && readJson(file).pid === process.pid) fs.unlinkSync(file); };
}
export function frozenInputs(repo, files) {
  return Object.fromEntries(files.map(name => [name, sha(fs.readFileSync(inside(repo, name)))]));
}
export function assertFrozen(repo, hashes) {
  for (const [name, hash] of Object.entries(hashes)) requireThat(sha(fs.readFileSync(inside(repo, name))) === hash, `Frozen workflow/input changed: ${name}`);
}
export function excerpt(repo, ref) {
  const file = checkRef(repo, ref);
  requireThat(Number.isInteger(ref.startLine) && ref.startLine > 0 && Number.isInteger(ref.endLine) && ref.endLine >= ref.startLine, 'Context needs a bounded line range');
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  requireThat(ref.endLine <= lines.length, 'Context range extends beyond file');
  return { ...ref, text: lines.slice(ref.startLine - 1, ref.endLine).join('\n') };
}
