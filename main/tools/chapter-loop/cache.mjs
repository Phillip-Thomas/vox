import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { builtinModules } from 'node:module';
import { fileURLToPath } from 'node:url';
import { sha } from './contract.mjs';
import { inside, readJson, writeJson, reference, checkRef } from './store.mjs';
import { inspectReport } from './evidence.mjs';

const VERSION = 'paravoxia.chapterLoopCache.v1';
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])])) : value;
const digest = value => sha(stable(value));
const codeFile = name => /\.[cm]?[jt]sx?$/.test(name);
const testFile = name => /(?:^|\/)(?:__tests__|__snapshots__|test|tests|fixtures)(?:\/|$)|[.-](?:test|spec)\.[^/]+$/.test(name);
const testDependency = name => /^(?:@playwright\/|@vitest\/|@jest\/|@testing-library\/|@types\/(?:jest|mocha|chai)$|playwright(?:-core)?$|vitest$|jest$|mocha$|chai$|c8$|nyc$)/.test(name);
const infrastructure = name => /(?:^|\/)(?:chapter-loop(?:\/|\.mjs$)|.*(?:-probe|-gate|-capture|-test|\.test|\.spec)\.[^/]+$)/.test(name) || testFile(name);
const infrastructureScript = name => /(?:^|:)(?:test|check|smoke|verify|probe|capture|loop|accept|evidence|workflow|repair|gate|soak|audition|fps|atlas|baseline|authority|trace|sweep|deploy|perf)(?::|$)/.test(name);
function inventory(repo) {
  return [...new Set(execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    { cwd: repo, maxBuffer: 32 * 1024 * 1024 }).toString().split('\0').filter(Boolean))].sort();
}
function packageInputs(data) {
  const result = {};
  for (const name of ['name', 'version', 'dependencies', 'optionalDependencies', 'peerDependencies', 'peerDependenciesMeta', 'overrides', 'resolutions', 'engines', 'type', 'imports', 'exports', 'main', 'module', 'browser', 'browserslist', 'workspaces', 'packageManager'])
    if (name in data) result[name] = data[name];
  if (data.devDependencies) result.devDependencies = Object.fromEntries(Object.entries(data.devDependencies).filter(([name]) => !testDependency(name)));
  if (data.scripts) result.scripts = Object.fromEntries(Object.entries(data.scripts).filter(([name]) => !infrastructureScript(name)));
  return result;
}
function lockInputs(data) {
  // npm's installed graph lets test-only packages drift without changing the
  // game candidate. Unknown lock formats stay conservative and hash in full.
  if (!data.packages?.['']) return data;
  const root = packageInputs(data.packages['']);
  const packages = { '': root };
  const visit = (name, from = '') => {
    let parent = from, entry;
    while (true) {
      const candidate = `${parent ? `${parent}/` : ''}node_modules/${name}`;
      if (candidate in data.packages) { entry = candidate; break; }
      if (!parent) return;
      const at = parent.lastIndexOf('/node_modules/');
      parent = at < 0 ? '' : parent.slice(0, at);
    }
    if (entry in packages) return;
    const value = data.packages[entry]; packages[entry] = value;
    if (value.link) {
      if (!data.packages[value.resolved]) throw new Error('Unresolved workspace lock entry');
      packages[value.resolved] = data.packages[value.resolved];
    }
    const dependencies = value.link ? data.packages[value.resolved] : value;
    for (const group of ['dependencies', 'optionalDependencies', 'peerDependencies'])
      for (const dependency of Object.keys(dependencies[group] ?? {})) visit(dependency, entry);
  };
  for (const group of ['dependencies', 'optionalDependencies', 'peerDependencies', 'devDependencies'])
    for (const name of Object.keys(root[group] ?? {})) visit(name);
  return { lockfileVersion: data.lockfileVersion, packages };
}

// A deliberately bounded JS lexer. Unsupported loaders and computed imports
// disable reuse. Strings/comments are not executable import declarations.
function tokens(source) {
  const result = []; let i = 0;
  const scan = (templateExpression = false) => {
    let depth = 0;
    while (i < source.length) {
      const c = source[i];
      if (/\s/.test(c)) { i++; continue; }
      if (source.startsWith('//', i)) { i = source.indexOf('\n', i + 2); if (i < 0) i = source.length; continue; }
      if (source.startsWith('/*', i)) { const end = source.indexOf('*/', i + 2); if (end < 0) throw new Error('Unclosed comment'); i = end + 2; continue; }
      if (c === '"' || c === "'") {
        const quote = c; let value = ''; i++;
        while (i < source.length && source[i] !== quote) {
          if (source[i] !== '\\') { value += source[i++]; continue; }
          i++; const escaped = source[i++];
          if (escaped === 'u' || escaped === 'x') {
            const count = escaped === 'x' ? 2 : 4;
            if (source[i] === '{') { const end = source.indexOf('}', ++i); if (end < 0) throw new Error('Invalid escape'); value += String.fromCodePoint(parseInt(source.slice(i, end), 16)); i = end + 1; }
            else { value += String.fromCharCode(parseInt(source.slice(i, i + count), 16)); i += count; }
          } else value += ({ n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', '0': '\0', '\n': '' })[escaped] ?? escaped;
        }
        if (source[i++] !== quote) throw new Error('Unclosed string');
        result.push({ type: 'string', value }); continue;
      }
      if (c === '`') {
        i++; result.push({ type: 'template', value: '`' });
        while (i < source.length && source[i] !== '`') {
          if (source[i] === '\\') { i += 2; continue; }
          if (source.startsWith('${', i)) { i += 2; scan(true); } else i++;
        }
        if (source[i++] !== '`') throw new Error('Unclosed template');
        result.push({ type: 'template', value: '`' }); continue;
      }
      if (c === '/' && [')', '}'].includes(result.at(-1)?.value)) throw new Error('Ambiguous regex/division requires fresh execution');
      if (c === '/' && ((!['word', 'number', 'string', 'template'].includes(result.at(-1)?.type) && ![']'].includes(result.at(-1)?.value)) || ['return', 'throw', 'case', 'delete', 'void', 'typeof', 'yield', 'await', 'else', 'do', 'break', 'continue'].includes(result.at(-1)?.value))) {
        i++; let bracket = false;
        while (i < source.length) {
          if (source[i] === '\\') { i += 2; continue; }
          if (source[i] === '[') bracket = true; if (source[i] === ']') bracket = false;
          if (source[i] === '/' && !bracket) break;
          if (source[i] === '\n') throw new Error('Unbounded regex'); i++;
        }
        if (source[i++] !== '/') throw new Error('Unclosed regex');
        while (/[a-z]/i.test(source[i] ?? '') && i < source.length) i++;
        result.push({ type: 'regex', value: '/' }); continue;
      }
      if (/[A-Za-z_$]/.test(c)) { const start = i++; while (/[\w$]/.test(source[i] ?? '') && i < source.length) i++; result.push({ type: 'word', value: source.slice(start, i) }); continue; }
      if (/[0-9]/.test(c)) { const start = i++; while (/[\w.]/.test(source[i] ?? '') && i < source.length) i++; result.push({ type: 'number', value: source.slice(start, i) }); continue; }
      if (c === '\\') throw new Error('Unsupported escaped identifier');
      if (templateExpression && c === '}' && depth === 0) { i++; return; }
      if (c === '{') depth++; if (c === '}') depth--;
      result.push({ type: 'punct', value: c }); i++;
    }
    if (templateExpression) throw new Error('Unclosed template expression');
  };
  scan(); return result;
}
function imports(source, { literalDynamic = false } = {}) {
  const ts = tokens(source), specs = [], localUrls = []; let subprocess = false;
  for (let i = 0; i < ts.length; i++) {
    const token = ts[i]; if (token.type !== 'word') continue;
    if (['eval', 'Function', 'createRequire', 'registerHooks'].includes(token.value)) throw new Error('Unbounded executable loader');
    if (token.value === 'require') {
      if (ts[i + 1]?.value !== '(' || ts[i + 2]?.type !== 'string' || ts[i + 3]?.value !== ')') throw new Error('Computed or aliased require');
      specs.push(ts[i + 2].value);
    }
    if (token.value === 'import') {
      if (ts[i + 1]?.value === '(') {
        if (!literalDynamic || ts[i + 2]?.type !== 'string' || ts[i + 3]?.value !== ')') throw new Error('Dynamic import requires fresh execution');
        specs.push(ts[i + 2].value); continue;
      }
      if (ts[i + 1]?.value === '.') {
        if (ts[i + 3]?.value === '.' && ts[i + 4]?.value === 'resolve') throw new Error('Dynamic import resolver');
        continue;
      }
      if (ts[i + 1]?.type === 'string') { specs.push(ts[i + 1].value); continue; }
      let j = i + 1;
      while (j < ts.length && ts[j].value !== ';' && ts[j].value !== 'from') j++;
      if (ts[j]?.value !== 'from' || ts[j + 1]?.type !== 'string') throw new Error('Unresolved import');
      specs.push(ts[j + 1].value);
    }
    if (token.value === 'from' && ts[i + 1]?.type === 'string') specs.push(ts[i + 1].value);
    if (token.value === 'URL' && ts[i + 1]?.value === '(' && ts[i + 2]?.type === 'string' && ts[i + 3]?.value === ',' && ts[i + 4]?.value === 'import') localUrls.push(ts[i + 2].value);
  }
  for (const spec of specs) {
    if (['vm', 'node:vm', 'module', 'node:module'].includes(spec)) throw new Error('Unbounded executable loader');
    if (['child_process', 'node:child_process', 'worker_threads', 'node:worker_threads'].includes(spec)) subprocess = true;
  }
  return { specs: [...new Set(specs)], localUrls, subprocess };
}
function resolveLocal(repo, from, spec) {
  let base;
  if (spec.startsWith('file:')) base = fileURLToPath(spec);
  else if (path.isAbsolute(spec)) base = spec;
  else base = path.resolve(path.dirname(from), spec.split(/[?#]/)[0]);
  for (const candidate of [base, ...['.mjs', '.js', '.cjs', '.ts', '.tsx', '.jsx', '.json'].map(ext => base + ext), ...['index.mjs', 'index.js', 'index.ts'].map(n => path.join(base, n))]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return inside(repo, path.relative(repo, candidate));
  }
  throw new Error(`Missing local dependency: ${spec}`);
}
function isLocal(spec) { return spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('file:'); }
function addTree(repo, name, files, visited = new Set()) {
  const absolute = inside(repo, name);
  if (fs.statSync(absolute).isDirectory()) {
    const real = fs.realpathSync(absolute); if (visited.has(real)) throw new Error('Recursive dependency directory'); visited.add(real);
    for (const child of fs.readdirSync(absolute).sort()) addTree(repo, path.join(name, child), files, visited);
    visited.delete(real);
  } else files.add(name);
}
function graph(repo, roots, { declared = false, tolerate = false } = {}) {
  const hashes = {}, packages = new Set(), pending = [...roots]; let incomplete = false;
  while (pending.length) {
    const name = pending.pop(); if (name in hashes) continue;
    const file = inside(repo, name), bytes = fs.readFileSync(file); hashes[name] = sha(bytes);
    if (!codeFile(name)) continue;
    try {
      const info = imports(bytes.toString(), { literalDynamic: tolerate });
      if (info.subprocess && !declared) throw new Error('Subprocess dependencies must be declared');
      for (const spec of [...info.specs, ...info.localUrls]) {
        if (isLocal(spec)) pending.push(path.relative(repo, resolveLocal(repo, file, spec)));
        else if (!builtinModules.includes(spec.replace(/^node:/, ''))) {
          if (spec.includes(':') || spec.startsWith('#')) throw new Error('Unresolved dependency alias');
          packages.add(spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0]);
        }
      }
    } catch (error) { if (!tolerate) throw error; incomplete = true; }
  }
  return { hashes, packages, incomplete };
}

export function gameSnapshot(repo) {
  const files = new Set(inventory(repo));
  // Ignored runtime assets and local Vite env inputs still affect built bytes.
  for (const name of ['main/src', 'main/public', 'main/assets', 'src', 'public', 'assets', 'shared', 'config']) if (fs.existsSync(path.join(repo, name))) addTree(repo, name, files);
  for (const directory of ['', 'main']) if (fs.existsSync(path.join(repo, directory)))
    for (const name of fs.readdirSync(path.join(repo, directory))) if (/^\.env(?:\.|$)|^\.(?:npmrc|browserslistrc)$/.test(name)) files.add(path.join(directory, name));
  const names = [...files].sort(), selected = names.filter(name => !testFile(name) && (
    /^(?:main\/(?:src|public|assets)\/|(?:src|public|assets|shared|config)\/)/.test(name)
    || /^(?:main\/)?(?:\.env(?:\.[^/]*)?|\.(?:npmrc|browserslistrc)|(?:pnpm-lock\.yaml|yarn\.lock|bun\.lockb?))$/.test(name)
    || (/^(?:main\/)?[^/]+\.(?:json|[mc]?js|ts|html|ya?ml)$/.test(name) && !infrastructure(name) && !/(?:test|soak|probe|capture|gate)[^/]*\.(?:html|[mc]?js|ts)$/.test(name))
    || (/^(?:scripts\/|main\/tools\/)/.test(name) && !infrastructure(name) && (/^scripts\//.test(name) || /(?:^|\/)(?:generate[-.]|[^/]+-generate\.)|\.config\.[^/]+$/.test(name)))
  ));
  const result = {};
  for (const name of selected) {
    const file = inside(repo, name, { exists: false });
    if (!fs.existsSync(file)) { result[name] = null; continue; }
    if (path.basename(name) === 'package.json') result[name] = digest(packageInputs(readJson(file)));
    else if (path.basename(name) === 'package-lock.json') result[name] = digest(lockInputs(readJson(file)));
    else result[name] = sha(fs.readFileSync(file));
  }
  // Runtime imports can cross the normal src/assets roots. A generator with an
  // unbounded loader retains all shared tools conservatively, but never the
  // Chapter Loop transport or probes in the game identity.
  const closure = graph(repo, selected.filter(name => result[name] !== null && codeFile(name)), { declared: true, tolerate: true });
  // If runtime code imports package.json itself, every byte becomes game input,
  // including metadata normally omitted by the dependency-only projection.
  for (const [name, hash] of Object.entries(closure.hashes)) if (!(name in result) || !codeFile(name)) result[name] = hash;
  if (closure.incomplete) for (const name of names.filter(n => /^(?:main\/tools\/|scripts\/)/.test(n) && !infrastructure(n))) {
    const file = inside(repo, name, { exists: false }); result[name] = fs.existsSync(file) ? sha(fs.readFileSync(file)) : null;
  }
  return stable(result);
}
export function gameSourceSeal(repo) { return digest(gameSnapshot(repo)); }

function executableHash(command) {
  const executable = path.isAbsolute(command) ? command : (process.env.PATH ?? '').split(path.delimiter).map(dir => path.join(dir, command)).find(file => fs.existsSync(file) && fs.statSync(file).isFile());
  if (!executable) throw new Error('Missing executable');
  // The running Node version is immutable during this process. Other binaries
  // (including optional ffmpeg/ffprobe dependencies) use their actual bytes.
  if (fs.realpathSync(executable) === fs.realpathSync(process.execPath)) return { executable: fs.realpathSync(executable), node: process.version };
  return { executable: fs.realpathSync(executable), sha256: sha(fs.readFileSync(executable)) };
}
function dependencyKey(repo, config, identity, { allowUnbuilt = false } = {}) {
  try {
    if (!config || !Array.isArray(config.argv) || !config.argv.length || !identity?.source || (!identity?.build && !(allowUnbuilt && identity?.build === null)) || !identity?.kind) return null;
    const cwd = config.cwd === '.' ? repo : inside(repo, config.cwd), roots = new Set();
    const declared = Array.isArray(config.dependencies) && config.dependencies.length > 0;
    for (const name of config.dependencies ?? []) addTree(repo, name, roots);
    let entry = false;
    for (const arg of config.argv.slice(1)) {
      if (typeof arg !== 'string') return null;
      if (arg === '-e' || arg === '--eval' || arg === '-p' || arg === '--print' || /^(?:--eval|--print)=/.test(arg)) return null;
      if (/^(?:--(?:experimental-)?loader|--import|--require|-r)(?:=|$)/.test(arg)) return null;
      const expanded = arg.replaceAll('{repo}', repo);
      if (expanded.includes('{') || expanded.startsWith('-')) continue;
      const file = path.resolve(cwd, expanded);
      if (fs.existsSync(file) && fs.statSync(file).isFile()) { roots.add(path.relative(repo, inside(repo, path.relative(repo, file)))); if (codeFile(file)) entry = true; }
      else if (codeFile(expanded)) return null;
    }
    // Opaque npm/shell commands are cacheable only with an explicit input graph.
    if (!entry && !declared) return null;
    const closure = graph(repo, roots, { declared });
    const locks = {};
    for (const name of inventory(repo).filter(n => /(?:^|\/)(?:package\.json|package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|\.npmrc)$/.test(n) && !/^(?:\.codex|captures|archive)\//.test(n))) {
      const file = inside(repo, name, { exists: false });
      locks[name] = fs.existsSync(file) ? sha(fs.readFileSync(file)) : null;
    }
    // Bare imports require an installed package declaration and a lockfile.
    for (const name of closure.packages) {
      const manifests = Object.keys(locks).filter(n => path.basename(n) === 'package.json').map(n => readJson(inside(repo, n)));
      if (!manifests.some(m => ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'].some(k => name in (m[k] ?? {})))) return null;
      if (!Object.keys(locks).some(n => /(?:lock|shrinkwrap)/.test(n))) return null;
    }
    const binaries = Object.fromEntries([config.argv[0], ...(config.binaryDependencies ?? [])].map(binary => [binary, executableHash(binary)]));
    const implementation = Object.fromEntries(['cache.mjs', 'evidence.mjs', 'store.mjs', 'contract.mjs'].map(name => [name, sha(fs.readFileSync(new URL(name, import.meta.url)))]));
    return digest({ schema: VERSION, identity, config, files: closure.hashes, locks, binaries, implementation,
      nodeOptions: process.env.NODE_OPTIONS ?? '', nodePath: process.env.NODE_PATH ?? '', platform: process.platform, arch: process.arch });
  } catch { return null; }
}
export function probeKey(repo, config, identity) { return dependencyKey(repo, config, identity); }
export function commandKey(repo, config, identity) { return dependencyKey(repo, config, identity, { allowUnbuilt: true }); }

function cacheFile(repo, run, space, key) {
  const directory = inside(repo, path.relative(repo, run));
  return inside(repo, path.relative(repo, path.join(directory, 'cache', space, `${key}.json`)), { exists: false });
}
export function proofArtifacts(repo, proof) {
  const refs = new Map(), seen = new Set();
  const visit = file => {
    const ref = reference(repo, file);
    if (seen.has(ref.path)) return;
    seen.add(ref.path); refs.set(ref.path, ref);
    if (!/\.(?:json|jsonl|ndjson)$/.test(file)) return;
    const documents = /\.(?:jsonl|ndjson)$/.test(file) ? fs.readFileSync(file, 'utf8').split('\n').filter(line => line.trim()).map(line => JSON.parse(line)) : [readJson(file)];
    const walk = raw => {
      if (Array.isArray(raw)) { raw.forEach(walk); return; }
      if (!raw || typeof raw !== 'object') throw new Error('Invalid raw evidence reference');
      if ('path' in raw) {
        if (typeof raw.sha256 !== 'string') throw new Error('Raw evidence is not hash bound');
        visit(checkRef(repo, raw)); return;
      }
      Object.values(raw).forEach(walk);
    };
    for (const data of documents) if (data.raw !== undefined) walk(data.raw);
  };
  visit(proof.reportFile);
  for (const media of proof.media) visit(media.file);
  return [...refs.values()].sort((a, b) => a.path.localeCompare(b.path));
}
function currentProof(repo, config, proof) {
  const suffix = path.normalize(config.report), report = path.normalize(proof.reportFile);
  if (!report.endsWith(`${path.sep}${suffix}`)) throw new Error('Report binding differs');
  const directory = report.slice(0, -(suffix.length + 1));
  const checked = inspectReport(config, directory);
  if (proof.passed !== true || checked.passed !== true || digest(checked.checks) !== digest(proof.checks) || digest(checked.media) !== digest(proof.media)) return null;
  return { ...checked, artifacts: proofArtifacts(repo, checked) };
}
export function cacheCase(repo, run, config, identity, proof) {
  try {
    const key = probeKey(repo, config, identity); if (!key) return null;
    const file = cacheFile(repo, run, 'cases', key);
    // A later failed attempt must never fall back to an earlier passing case.
    if (fs.existsSync(file)) fs.unlinkSync(file);
    if (proof?.passed !== true) return null;
    const checked = currentProof(repo, config, proof); if (!checked) return null;
    const entry = { schema: VERSION, key, identity, proof: checked, createdAt: new Date().toISOString() };
    writeJson(file, entry);
    return { ...checked, reused: false };
  } catch { return null; }
}
export function findCachedCase(repo, run, config, identity) {
  try {
    const key = probeKey(repo, config, identity); if (!key) return null;
    const entry = readJson(cacheFile(repo, run, 'cases', key));
    if (entry.schema !== VERSION || entry.key !== key || digest(entry.identity) !== digest(identity)) return null;
    for (const ref of entry.proof.artifacts) checkRef(repo, ref);
    const checked = currentProof(repo, config, entry.proof);
    if (!checked || digest(checked.artifacts) !== digest(entry.proof.artifacts)) return null;
    return { ...checked, reused: true, originalReport: reference(repo, checked.reportFile) };
  } catch { return null; }
}
function successful(receipt) {
  return receipt && (receipt.code === 0 || receipt.exitCode === 0) && (receipt.code === undefined || receipt.code === 0) && (receipt.exitCode === undefined || receipt.exitCode === 0)
    && !receipt.signal && !receipt.error && !receipt.reason && !receipt.timedOut && !receipt.stopped && !receipt.stopReason && Array.isArray(receipt.artifacts);
}
export function cacheCommand(repo, run, config, identity, receipt) {
  try {
    const key = commandKey(repo, config, identity); if (!key) return null;
    const file = cacheFile(repo, run, 'commands', key);
    if (fs.existsSync(file)) fs.unlinkSync(file);
    if (!successful(receipt)) return null;
    for (const ref of receipt.artifacts) checkRef(repo, ref);
    writeJson(file, { schema: VERSION, key, identity, receipt, createdAt: new Date().toISOString() });
    return { ...receipt, reused: false };
  } catch { return null; }
}
export function findCachedCommand(repo, run, config, identity) {
  try {
    const key = commandKey(repo, config, identity); if (!key) return null;
    const entry = readJson(cacheFile(repo, run, 'commands', key));
    if (entry.schema !== VERSION || entry.key !== key || digest(entry.identity) !== digest(identity) || !successful(entry.receipt)) return null;
    for (const ref of entry.receipt.artifacts) checkRef(repo, ref);
    return { ...entry.receipt, reused: true };
  } catch { return null; }
}
