import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { CHROMIUM_ARGS, assertHardwareGl, chromePath, startParavoxiaPreview } from './lib/previewServer.mjs';
import { assertPreviewBuild } from './lib/previewBuildProof.mjs';

// Bounded real-input checks on an already-built, source-bound runtime. This
// deliberately never grants inventory, advances a beat, or edits a player pose.
const cases = {
  color: { entry: 'ch2-color', exit: 'a2-awakening', capSeconds: 100, settleSeconds: 6 },
  gather: { entry: 'ch3-gather', exit: 'ch3-dusk', capSeconds: 45 },
  settlement: { entry: 'ch9-settle', exit: 'ch9-hearth', capSeconds: 150, settleSeconds: 6 },
  relay: { entry: 'ch10-ask', exit: 'ch10-transit', capSeconds: 330 }
};
const selected = (process.env.PARAVOXIA_RECOVERY_CASES ?? 'color,gather,settlement').split(',');
const output = path.resolve(process.env.PARAVOXIA_RECOVERY_OUTPUT ?? 'captures/story-recovery');
const profile = process.env.PARAVOXIA_RECOVERY_PROFILE ?? 'LOW';
await mkdir(output, { recursive: true });
const buildAssets = {};
for (const file of await readdir('dist/assets')) if (/\.(js|css)$/.test(file)) {
  buildAssets[file] = createHash('sha256').update(await readFile(`dist/assets/${file}`)).digest('hex');
}
const preview = await startParavoxiaPreview({ build: false });
const browser = await chromium.launch({ executablePath: chromePath(), headless: false, args: CHROMIUM_ARGS });
const results = [];
try {
  for (const name of selected) {
    const previewBuildProof = await assertPreviewBuild(preview.url, buildAssets);
    const scenario = cases[name];
    if (!scenario) throw new Error(`Unknown recovery scenario: ${name}`);
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    const samples = [];
    const url = `${preview.url}?story=${scenario.entry}&movie=1&profile=${profile}&systemprobe=1`;
    const started = Date.now();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const renderer = await assertHardwareGl(page);
    let entered = false;
    let completed = false;
    let completionSeconds = null;
    let lastBeat = null;
    let final;
    while (Date.now() - started < scenario.capSeconds * 1000) {
      final = await page.evaluate(() => ({
        beat: window.__storyBeat ?? null,
        objective: window.__storyObjective ?? null,
        autopilot: window.__autopilot ?? null,
        backstops: window.__railBackstops ?? [],
        stuck: window.__railStuck ?? [],
        app: window.__paravoxiaAppState ?? null,
        guidanceDom: [...document.querySelectorAll('[data-objective-id], [data-hud-surface]')].map(node => {
          const rect = node.getBoundingClientRect(); const style = getComputedStyle(node);
          return { id: node.getAttribute('data-objective-id'), surface: node.getAttribute('data-hud-surface'),
            markerLabel: node.getAttribute('data-objective-marker-label'), health: node.getAttribute('data-objective-health'),
            text: node.textContent, visible: rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden',
            rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } };
        })
      }));
      entered ||= final.beat === scenario.entry;
      const seconds = (Date.now() - started) / 1000;
      samples.push({ seconds, ...final });
      if (final.beat !== lastBeat) {
        lastBeat = final.beat;
        console.log(`[recovery:${name}] ${seconds.toFixed(1)}s ${final.beat} ${final.objective?.id ?? ''}`);
        await page.screenshot({ path: path.join(output, `${name}-${samples.length}-${final.beat ?? 'load'}.png`) });
      }
      if (final.beat === scenario.exit && !completed) {
        completed = true;
        completionSeconds = seconds;
      }
      // Retain the first terminal frame and the settled physical view. A beat
      // change alone does not prove the player has room to frame its objective.
      if (completed && seconds >= completionSeconds + (scenario.settleSeconds ?? 0)) break;
      if (final.stuck.length || final.backstops.length || errors.length) break;
      await page.waitForTimeout(1000);
    }
    await page.screenshot({ path: path.join(output, `${name}-final.png`) });
    const result = { name, ...scenario, generatedAt: new Date().toISOString(), url, profile,
      renderer, buildAssets, previewBuildProof, entered, completed, completionSeconds, errors, final, samples };
    result.ok = entered && completed && errors.length === 0
      && !final?.stuck.length && !final?.backstops.length;
    results.push(result);
    await writeFile(path.join(output, `${name}.json`), JSON.stringify(result, null, 2));
    await context.close();
  }
} finally {
  await browser.close();
  preview.stop();
}
await writeFile(path.join(output, 'summary.json'), JSON.stringify({ generatedAt: new Date().toISOString(),
  results: results.map(({ name, ok, entered, completed, renderer, errors, final }) => ({ name, ok, entered, completed, renderer, errors, final })) }, null, 2));
process.exitCode = results.every(result => result.ok) ? 0 : 1;
