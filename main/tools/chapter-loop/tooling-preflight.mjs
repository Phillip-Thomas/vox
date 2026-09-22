import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { gameSnapshot, gameSourceSeal } from './cache.mjs';
import { writeJson } from './store.mjs';
import { captureRuntime } from './runtime-capture.mjs';
import { captureControls, validateControlConfig } from './control-capture.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

// New content is authored after tooling preflight. No claim about that future
// chapter's actions, route, build, media or ability to pass is made here.
export function describeTooling({ repo = ROOT, chapter, checkTools = true } = {}) {
  const blockers = [];
  if (!/^ch\d+[a-z0-9-]*$/.test(chapter ?? '')) blockers.push('Chapter id required');
  let source = null;
  try {
    if (!Object.keys(gameSnapshot(repo)).length) throw Error('Game source unavailable');
    source = gameSourceSeal(repo);
    createRequire(import.meta.url).resolve('playwright-core');
    if (typeof captureControls !== 'function' || typeof validateControlConfig !== 'function' || typeof captureRuntime !== 'function') throw Error('Capture transport unavailable');
    if (checkTools) {
      for (const [tool, argv] of [['ffmpeg', ['-version']], ['ffprobe', ['-version']], ['pactl', ['info']], ['parec', ['--version']]]) execFileSync(tool, argv, { stdio: 'pipe', timeout: 10000 });
      if (!fs.existsSync(process.env.CHROME_PATH ?? '/snap/bin/chromium')) throw Error('Chromium unavailable');
      if (process.env.PARAVOXIA_ALLOW_SWIFTSHADER === '1') throw Error('Software renderer override enabled');
    }
  } catch (e) { blockers.push(e.message); }
  return { schema: 'paravoxia.chapterToolingCapabilities.v1', phase: 'before-authoring', chapter,
    supported: blockers.length === 0, sourceIdentity: Boolean(source), sourceSha256: source,
    bindings: Object.fromEntries(['manual', 'recovery', 'continue', 'continuity', 'av'].map(k => [k, blockers.length === 0])),
    pending: ['chapter control configuration', 'authored journey contract', 'candidate build', 'observed runtime and media'],
    acceptance: false, blockers };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const value = name => process.argv[process.argv.indexOf(`--${name}`) + 1];
  const result = describeTooling({ chapter: value('chapter') });
  writeJson(path.join(value('out'), 'capabilities.json'), result);
  console.log(JSON.stringify(result)); process.exitCode = result.supported ? 0 : 2;
}
