import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { gameSnapshot, gameSourceSeal, probeKey, commandKey, cacheCase, findCachedCase, cacheCommand, findCachedCommand } from './cache.mjs';
import { inspectReport } from './evidence.mjs';
import { writeJson, readJson, reference } from './store.mjs';

function fixture(t) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'chapter-cache-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  execFileSync('git', ['init', '-q'], { cwd: repo });
  const put = (name, text) => { const file = path.join(repo, name); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); return file; };
  const json = (name, data) => put(name, JSON.stringify(data));
  put('.gitignore', '.codex/\nmain/dist/\n');
  put('main/src/game.js', "import './value.js'; export const game = 'unchanged';\n");
  put('main/src/value.js', 'export const value = 1;\n');
  put('main/src/game.test.js', '// initial test\n');
  put('main/public/audio.wav', 'game audio');
  put('main/index.html', '<title>Paravoxia fixture</title>');
  put('main/vite.config.js', 'export default {};\n');
  put('main/tools/chapter-loop/runner.mjs', '// runner\n');
  put('main/tools/probe.mjs', "import './lib/a.mjs'; export const run = true;\n");
  put('main/tools/lib/a.mjs', "export { value } from './b.mjs';\n");
  put('main/tools/lib/b.mjs', 'export const value = 1;\n');
  put('scripts/generate-game.mjs', "import './shared.mjs';\n");
  put('scripts/shared.mjs', 'export const revision = 1;\n');
  const pkg = { type: 'module', dependencies: { runtime: '^1' }, devDependencies: { vite: '^1', vitest: '^1' }, scripts: { build: 'vite build', 'chapter:loop': 'node tools/chapter-loop/runner.mjs', test: 'vitest' } };
  json('main/package.json', pkg);
  json('main/package-lock.json', { lockfileVersion: 3, packages: { '': pkg, 'node_modules/runtime': { version: '1.0.0', dependencies: { nested: '^1' } }, 'node_modules/nested': { version: '1.0.0' }, 'node_modules/vite': { version: '1.0.0' }, 'node_modules/vitest': { version: '1.0.0' } } });
  const run = path.join(repo, '.codex/chapter-loops/test'); fs.mkdirSync(run, { recursive: true });
  const directory = path.join(run, 'capture'); fs.mkdirSync(directory);
  const raw = put(path.relative(repo, path.join(directory, 'raw.bin')), 'original raw bytes');
  const rawReport = path.join(directory, 'raw.json'); writeJson(rawReport, { raw: [reference(repo, raw)], observation: true });
  writeJson(path.join(directory, 'report.json'), { schema: 'fixture.v1', hardware: true, cleanup: true, action: 1, raw: [reference(repo, rawReport)], reused: false });
  put(path.relative(repo, path.join(directory, 'frame.png')), 'original frame');
  const config = { kind: 'manual', argv: [process.execPath, 'tools/probe.mjs', '{out}'], cwd: 'main', timeoutMs: 1000,
    report: 'report.json', schema: 'fixture.v1', assertions: { hardware: { pointer: '/hardware', equals: true }, cleanup: { pointer: '/cleanup', equals: true }, action: { pointer: '/action', gte: 1 } }, media: [{ kind: 'frame', path: 'frame.png' }] };
  const identity = () => ({ source: gameSourceSeal(repo), build: 'unchanged-build', kind: config.kind });
  return { repo, run, put, json, directory, config, identity, proof: () => inspectReport(config, directory), raw, rawReport };
}

test('game identity excludes unrelated runner, probe and test edits while retaining runtime assets and config', t => {
  const f = fixture(t), initial = gameSourceSeal(f.repo), key = probeKey(f.repo, f.config, f.identity());
  assert.ok(key); assert.ok(cacheCase(f.repo, f.run, f.config, f.identity(), f.proof()));
  f.put('main/tools/chapter-loop/runner.mjs', '// changed workflow only\n');
  f.put('main/src/game.test.js', '// changed test only\n');
  f.put('main/tools/unrelated-probe.mjs', '// unrelated probe\n');
  assert.equal(gameSourceSeal(f.repo), initial);
  assert.equal(probeKey(f.repo, f.config, f.identity()), key);
  assert.equal(findCachedCase(f.repo, f.run, f.config, f.identity()).reused, true);
  for (const name of ['main/src/value.js', 'main/public/audio.wav', 'main/vite.config.js', 'scripts/shared.mjs']) {
    const old = fs.readFileSync(path.join(f.repo, name)); f.put(name, old + '\n// changed\n');
    assert.notEqual(gameSourceSeal(f.repo), initial, name);
    assert.equal(findCachedCase(f.repo, f.run, f.config, f.identity()), null);
    f.put(name, old);
  }
  f.put('main/src/new-runtime.js', 'export const newRuntime = true;');
  assert.ok(gameSnapshot(f.repo)['main/src/new-runtime.js']);
  assert.notEqual(gameSourceSeal(f.repo), initial);
});

test('ignored game assets and local build env files remain source inputs', t => {
  const f = fixture(t);
  f.put('.gitignore', '.codex/\nmain/dist/\nmain/.env.local\nmain/public/generated/\n');
  const source = gameSourceSeal(f.repo);
  f.put('main/.env.local', 'VITE_FIXTURE=one'); assert.notEqual(gameSourceSeal(f.repo), source);
  const withEnv = gameSourceSeal(f.repo);
  f.put('main/public/generated/audio.wav', 'ignored generated audio'); assert.notEqual(gameSourceSeal(f.repo), withEnv);
});

test('runtime imports outside src and package metadata used by the game remain bound', t => {
  const f = fixture(t);
  f.put('main/src/game.js', "import '../../support/value.js'; import metadata from '../package.json';\n");
  f.put('support/value.js', 'export const value = 1;\n');
  const source = gameSourceSeal(f.repo);
  f.put('support/value.js', 'export const value = 2;\n'); assert.notEqual(gameSourceSeal(f.repo), source);
  f.put('support/value.js', 'export const value = 1;\n'); assert.equal(gameSourceSeal(f.repo), source);
  const pkg = readJson(path.join(f.repo, 'main/package.json')); pkg.description = 'Metadata read by runtime'; f.json('main/package.json', pkg);
  assert.notEqual(gameSourceSeal(f.repo), source);
});

test('runtime and build dependencies seal the candidate but test-only package and script changes do not', t => {
  const f = fixture(t), initial = gameSourceSeal(f.repo);
  const pkg = readJson(path.join(f.repo, 'main/package.json')); pkg.scripts['chapter:loop:test'] = 'node --test tools/chapter-loop/cache.test.mjs'; pkg.devDependencies.vitest = '^2'; f.json('main/package.json', pkg);
  const lock = readJson(path.join(f.repo, 'main/package-lock.json')); lock.packages[''] = pkg; lock.packages['node_modules/vitest'].version = '2.0.0'; f.json('main/package-lock.json', lock);
  assert.equal(gameSourceSeal(f.repo), initial);
  lock.packages['node_modules/nested'].version = '1.0.1'; f.json('main/package-lock.json', lock);
  assert.notEqual(gameSourceSeal(f.repo), initial);
  lock.packages['node_modules/nested'].version = '1.0.0'; f.json('main/package-lock.json', lock);
  pkg.devDependencies.vite = '^2'; f.json('main/package.json', pkg);
  assert.notEqual(gameSourceSeal(f.repo), initial);
});

test('transitive static imports, config, build and lockfile drift invalidate a successful case', t => {
  const f = fixture(t), identity = f.identity();
  assert.ok(cacheCase(f.repo, f.run, f.config, identity, f.proof()));
  assert.ok(findCachedCase(f.repo, f.run, f.config, identity));
  const key = probeKey(f.repo, f.config, identity);
  f.put('main/tools/lib/b.mjs', 'export const value = 2;');
  assert.notEqual(probeKey(f.repo, f.config, identity), key);
  assert.equal(findCachedCase(f.repo, f.run, f.config, identity), null);
  f.put('main/tools/lib/b.mjs', 'export const value = 1;\n');
  assert.ok(findCachedCase(f.repo, f.run, f.config, identity));
  for (const config of [{ ...f.config, timeoutMs: 2000 }, { ...f.config, argv: [...f.config.argv, '--changed'] }, { ...f.config, assertions: { ...f.config.assertions, action: { pointer: '/action', gte: 2 } } }, { ...f.config, media: [] }]) assert.equal(findCachedCase(f.repo, f.run, config, identity), null);
  assert.equal(findCachedCase(f.repo, f.run, f.config, { ...identity, build: 'other-build' }), null);
  fs.appendFileSync(path.join(f.repo, 'main/package-lock.json'), '\n');
  assert.equal(findCachedCase(f.repo, f.run, f.config, identity), null);
});

test('raw evidence is hash checked recursively and reuse preserves original report bytes and provenance', t => {
  const f = fixture(t), identity = f.identity(), before = fs.readFileSync(path.join(f.directory, 'report.json'));
  const cached = cacheCase(f.repo, f.run, f.config, identity, f.proof()); assert.equal(cached.artifacts.length, 4);
  const found = findCachedCase(f.repo, f.run, f.config, identity);
  assert.equal(found.reused, true); assert.equal(found.reportFile, path.join(f.directory, 'report.json'));
  assert.deepEqual(fs.readFileSync(found.reportFile), before); assert.equal(readJson(found.reportFile).reused, false);
  fs.writeFileSync(f.raw, 'changed raw observation');
  assert.equal(findCachedCase(f.repo, f.run, f.config, identity), null);
  assert.equal(cacheCase(f.repo, f.run, f.config, identity, f.proof()), null);
});

test('missing or changed report and media files invalidate the cache', async t => {
  for (const name of ['report.json', 'frame.png', 'raw.json']) await t.test(name, t => {
    const f = fixture(t), identity = f.identity(); assert.ok(cacheCase(f.repo, f.run, f.config, identity, f.proof()));
    fs.appendFileSync(path.join(f.directory, name), ' ');
    assert.equal(findCachedCase(f.repo, f.run, f.config, identity), null);
    fs.unlinkSync(path.join(f.directory, name));
    assert.equal(findCachedCase(f.repo, f.run, f.config, identity), null);
  });
});

test('failed, inconclusive and fabricated passed flags never populate reusable evidence', t => {
  const f = fixture(t), identity = f.identity();
  assert.ok(cacheCase(f.repo, f.run, f.config, identity, f.proof()));
  const file = path.join(f.directory, 'report.json'), original = readJson(file);
  writeJson(file, { ...original, action: 0 });
  const failed = f.proof(); assert.equal(failed.passed, false);
  assert.equal(cacheCase(f.repo, f.run, f.config, identity, failed), null);
  assert.equal(cacheCase(f.repo, f.run, f.config, identity, { ...failed, passed: true }), null);
  writeJson(file, { ...original, cleanup: false });
  assert.equal(cacheCase(f.repo, f.run, f.config, identity, { ...failed, passed: true }), null);
  assert.equal(findCachedCase(f.repo, f.run, f.config, identity), null);
});

test('missing, computed, undeclared and escaped imports conservatively miss while literal transitive requires are covered', t => {
  const f = fixture(t), identity = f.identity();
  for (const source of ["import './missing.mjs';", "const file = './lib/a.mjs'; await import(file);", "await import('./lib/a.mjs');", "const r = require; r('./lib/a.mjs');", "const file = './lib/a.mjs'; require(file);", "import unknown from 'not-declared';", "const t = `${await import('./lib/a.mjs')}`;", "import { spawn } from 'node:child_process'; spawn('node', ['unknown.mjs']);", "const evaluate = eval; evaluate('require(file)');", "import { createRequire as load } from 'node:module';"]) {
    f.put('main/tools/probe.mjs', source); assert.equal(probeKey(f.repo, f.config, identity), null, source);
  }
  f.put('main/tools/probe.mjs', "const x = require('./lib/\\u0061.mjs');");
  const key = probeKey(f.repo, f.config, identity); assert.ok(key);
  f.put('main/tools/lib/b.mjs', 'export const value = 99;'); assert.notEqual(probeKey(f.repo, f.config, identity), key);
});

test('declared subprocess helpers participate in the key including new directory members', t => {
  const f = fixture(t), identity = f.identity();
  f.put('main/tools/probe.mjs', "import { spawn } from 'node:child_process'; spawn('node', ['helper.mjs']);");
  const config = { ...f.config, dependencies: ['main/tools/lib'] };
  const key = probeKey(f.repo, config, identity); assert.ok(key);
  f.put('main/tools/lib/new-helper.mjs', 'export const newHelper = true;');
  assert.notEqual(probeKey(f.repo, config, identity), key);
  assert.equal(probeKey(f.repo, { ...config, dependencies: ['missing-directory'] }, identity), null);
});

test('static command receipts reuse exact successful artifacts and reject failed or interrupted commands', t => {
  const f = fixture(t), identity = { ...f.identity(), kind: 'static' }, config = { argv: f.config.argv, cwd: f.config.cwd, timeoutMs: f.config.timeoutMs };
  const receipt = { code: 0, artifacts: [reference(f.repo, f.raw)], elapsedMs: 12 };
  assert.ok(cacheCommand(f.repo, f.run, config, identity, receipt));
  assert.equal(findCachedCommand(f.repo, f.run, config, identity).reused, true);
  for (const bad of [{ ...receipt, code: 1 }, { ...receipt, exitCode: 1 }, { ...receipt, signal: 'SIGTERM' }, { ...receipt, timedOut: true }, { ...receipt, stopped: 'deadline' }, { ...receipt, reason: 'deadline' }, { ...receipt, error: 'spawn error' }]) assert.equal(cacheCommand(f.repo, f.run, config, { ...identity, kind: 'failed' }, bad), null);
  f.put('main/tools/chapter-loop/runner.mjs', '// infrastructure repair');
  assert.ok(findCachedCommand(f.repo, f.run, config, identity));
  fs.writeFileSync(f.raw, 'modified receipt');
  assert.equal(findCachedCommand(f.repo, f.run, config, identity), null);
});

test('pre-build command identities accept explicit null build while runtime probe keys require a build', t => {
  const f = fixture(t), config = { argv: f.config.argv, cwd: f.config.cwd, timeoutMs: f.config.timeoutMs };
  const identity = { ...f.identity(), build: null, kind: 'static' };
  assert.ok(commandKey(f.repo, config, identity));
  assert.equal(commandKey(f.repo, config, { source: identity.source, kind: 'static' }), null);
  assert.equal(probeKey(f.repo, f.config, { ...identity, kind: 'manual' }), null);
  assert.equal(cacheCase(f.repo, f.run, f.config, { ...identity, kind: 'manual' }, f.proof()), null);
  const receipt = { exitCode: 0, artifacts: [reference(f.repo, f.raw)] };
  assert.ok(cacheCommand(f.repo, f.run, config, identity, receipt));
  assert.equal(findCachedCommand(f.repo, f.run, config, identity).reused, true);
  assert.equal(findCachedCommand(f.repo, f.run, config, { ...identity, kind: 'build' }), null);
  f.put('main/tools/lib/b.mjs', 'export const value = 9;');
  assert.equal(findCachedCommand(f.repo, f.run, config, identity), null);
});
