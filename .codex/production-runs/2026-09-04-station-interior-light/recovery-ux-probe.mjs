#!/usr/bin/env node
// Mechanical station proof. Uses production teleports for positioning and real
// prompt/action handlers; it does not claim a manual navigation or taste review.
// Run from vox/main: node ../.codex/production-runs/2026-09-04-station-interior-light/recovery-ux-probe.mjs
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { startParavoxiaPreview, CHROMIUM_ARGS, chromePath, assertHardwareGl } from '../../../main/tools/lib/previewServer.mjs';
import { assertPreviewBuild } from '../../../main/tools/lib/previewBuildProof.mjs';
import { captureStationThreshold, validateStationThreshold } from '../../../main/tools/lib/stationThresholdCapture.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const main = resolve(here, '../../../main');
const require = createRequire(resolve(main, 'package.json'));
const { chromium } = require('playwright-core');
const out = resolve(process.argv[2] ?? resolve(here, 'evidence/recovery-ux'));
mkdirSync(out, { recursive: true });
const failures = [];
const results = [];
const assert = (ok, label) => { if (!ok) failures.push(label); };
const preview = await startParavoxiaPreview({ build: false });
if (!preview.snapshotDir) throw new Error('Station proof requires its own immutable preview snapshot');
const buildAssets = Object.fromEntries(readdirSync(resolve(preview.snapshotDir, 'assets')).filter(x => /\.(js|css)$/.test(x)).map(name => [name,
  createHash('sha256').update(readFileSync(resolve(preview.snapshotDir, 'assets', name))).digest('hex')]));
const variants = [
  { id: 'desktop', width: 1600, height: 900, touch: false },
  { id: 'mobile', width: 390, height: 844, touch: true },
  { id: 'mobile-landscape', width: 844, height: 390, touch: true },
  { id: 'reduced', width: 1600, height: 900, touch: false, reduced: true }
];
const entry = ['story:ch10-bearing-claimed', 'story:ch10-complete', 'story:station-docking-authorized'];
const seed = { inventory: {}, mawCharge: 0, era: 'paravox_machina', milestones: entry,
  lastWorld: { x: -1, y: -1 }, lastPlanetWorldId: '-1,-1:p1', dayPhase: 0.73 };
let browser;
try {
  browser = await chromium.launch({ executablePath: chromePath(), headless: false, args: CHROMIUM_ARGS });
  for (const variant of variants) {
    const previewBuildProof = await assertPreviewBuild(preview.url, buildAssets);
    const context = await browser.newContext({ viewport: { width: variant.width, height: variant.height },
      deviceScaleFactor: 1, isMobile: variant.touch, hasTouch: variant.touch,
      reducedMotion: variant.reduced ? 'reduce' : 'no-preference' });
    await context.addInitScript(({ seed }) => {
      if (!localStorage.getItem('pvx.v1.global')) localStorage.setItem('pvx.v1.global', JSON.stringify(seed));
      // Keep station-only silence evidence across reloads. The returned game has
      // a separate audio contract and must not erase or contaminate this record.
      if (!new URLSearchParams(location.search).has('spacestation')) return;
      const counters = JSON.parse(sessionStorage.getItem('station-silence-proof') ?? 'null')
        ?? { AudioContext: 0, webkitAudioContext: 0, OfflineAudioContext: 0, mediaPlay: 0, sfxDiagnosticFrames: 0 };
      addEventListener('pagehide', () => sessionStorage.setItem('station-silence-proof', JSON.stringify(counters)));
      const observeDiagnostic = () => {
        if (window.__voxSfxDiag !== undefined) counters.sfxDiagnosticFrames++;
        requestAnimationFrame(observeDiagnostic);
      };
      requestAnimationFrame(observeDiagnostic);
      window.__stationSilenceProbe = counters;
      for (const name of ['AudioContext', 'webkitAudioContext', 'OfflineAudioContext']) {
        if (typeof window[name] === 'function') {
          window[name] = new Proxy(window[name], { construct(Target, args, NewTarget) {
            counters[name]++; return Reflect.construct(Target, args, NewTarget);
          } });
        }
      }
      const play = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function (...args) { counters.mediaPlay++; return play.apply(this, args); };
    }, { seed });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    const samples = [];
    // Keep completed measurements even when a later action or navigation fails.
    const result = { variant, previewBuildProof, errors, samples, completed: false };
    results.push(result);
    const sample = async name => {
      const data = await page.evaluate(() => {
        const surfaces = [...document.querySelectorAll('[data-hud-surface]')].filter(node => {
          const r = node.getBoundingClientRect(); const s = getComputedStyle(node);
          return r.width && r.height && s.display !== 'none' && s.visibility !== 'hidden' && !node.hidden;
        }).map(node => { const r = node.getBoundingClientRect(); return {
          id: node.dataset.hudSurface, text: node.textContent, x: r.x, y: r.y, width: r.width, height: r.height
        }; });
        const low = document.querySelector('[data-testid="spaceStation-low-line"]');
        const objective = document.querySelector('[data-objective-id]');
        const prompt = document.querySelector('[data-hud-surface="station-prompt"]');
        return { story: window.__spaceStationStory?.(), position: window.__spaceStationState?.(),
          fill: window.__spaceStationFill?.(), silence: window.__stationSilenceProbe,
          sfxDiagnosticAbsent: window.__voxSfxDiag === undefined,
          objectiveCount: document.querySelectorAll('[data-objective-id]').length,
          objective: objective?.getAttribute('data-objective-id') ?? null,
          objectiveText: objective?.textContent ?? null, prompt: prompt?.textContent ?? null,
          lowOpacity: low ? Number(getComputedStyle(low).opacity) : null,
          controlsHint: !!document.querySelector('[data-testid="spaceStation-controls-hint"]'), surfaces };
      });
      const file = `${variant.id}-${name}.png`;
      await page.screenshot({ path: resolve(out, file) });
      const sha256 = createHash('sha256').update(readFileSync(resolve(out, file))).digest('hex');
      samples.push({ name, file, sha256, ...data });
      assert(data.objectiveCount === 1, `${variant.id}/${name}: exactly one active objective`);
      assert(data.silence && Object.values(data.silence).every(n => n === 0) && data.sfxDiagnosticAbsent, `${variant.id}/${name}: station silence`);
      for (const surface of data.surfaces) {
        assert(surface.x >= 0 && surface.y >= 0 && surface.x + surface.width <= variant.width + 1 && surface.y + surface.height <= variant.height + 1,
          `${variant.id}/${name}: ${surface.id} inside viewport`);
      }
      for (let i = 0; i < data.surfaces.length; i++) for (let j = i + 1; j < data.surfaces.length; j++) {
        const a = data.surfaces[i], b = data.surfaces[j];
        const overlap = Math.min(a.x+a.width,b.x+b.width)>Math.max(a.x,b.x)+1 && Math.min(a.y+a.height,b.y+b.height)>Math.max(a.y,b.y)+1;
        assert(!overlap, `${variant.id}/${name}: overlap ${a.id}/${b.id}`);
      }
      return data;
    };
    const settle = () => page.waitForTimeout(1800);
    const target = async () => {
      const id = await page.evaluate(() => window.__spaceStationTeleportToStoryTarget?.());
      assert(!!id, `${variant.id}: story target resolves`); await settle();
    };
    const use = async () => {
      if (variant.touch) await page.getByTestId('touch-action-use').click();
      else {
        await page.locator('canvas').click({ position: { x: variant.width / 2, y: variant.height / 2 } });
        await page.waitForFunction(() => !!document.pointerLockElement);
        await page.keyboard.press('KeyF');
      }
      await page.waitForTimeout(100);
    };
    await page.goto(`${preview.url}?spacestation=-1,-1,0&from=game&hud=0&dock=0&t=17.5`, { waitUntil: 'networkidle' });
    assert(await page.title() === 'Paravoxia', `${variant.id}: application identity`);
    const renderer = await assertHardwareGl(page);
    Object.assign(result, { renderer, headed: true });
    if (!renderer || /swiftshader|software|llvmpipe/i.test(renderer)) throw new Error(`Hardware station proof refused renderer: ${renderer}`);
    await page.waitForFunction(() => !!window.__spaceStationStory && !!window.__spaceStationTeleportToStoryTarget);
    await settle();
    const initial = await sample('registry-entry');
    assert(initial.objective === 'station:counter:registry-entry', `${variant.id}: G1 entry`);
    assert(initial.controlsHint === !variant.touch, `${variant.id}: desktop-only controls hint`);
    await target();
    const registry = await sample('registry-prompt');
    assert(registry.prompt?.includes(variant.touch ? '[USE]' : '[F]'), `${variant.id}: input glyph matches controls`);
    await use();
    await page.getByTestId('spaceStation-present-suit-record').click();
    await page.getByTestId('spaceStation-declare-issued-component').click();
    await page.getByTestId('spaceStation-registry-continue').click();
    await page.evaluate(() => { window.__spaceStationTeleport?.('counter', 0.96, 0.5); window.__spaceStationLook?.(-Math.PI/2, 0); });
    await settle();
    const threshold = await captureStationThreshold(page, { capturePixels: false });
    result.threshold = threshold;
    for (const failure of validateStationThreshold(threshold, { requireLowLine: true, reducedMotion: !!variant.reduced })) {
      assert(false, `${variant.id}/threshold: ${failure}`);
    }
    await target();
    const issuer = await sample('issuer-prompt');
    assert(issuer.objective === 'station:concourse:certified-source', `${variant.id}: G2 entry`);
    assert(issuer.story?.receipts?.concourseEntered === true && issuer.lowOpacity === 1, `${variant.id}: concourse receipt and completed line`);
    await use();
    await page.getByTestId('spaceStation-present-habitat-fault').click();
    await page.getByTestId('spaceStation-accept-bonded-cell').click();
    await page.getByTestId('spaceStation-issuer-continue').click();
    await page.evaluate(() => { window.__spaceStationTeleport?.('floor', 0.18, 0.5); window.__spaceStationLook?.(-Math.PI/2, 0); });
    await settle();
    const depart = await sample('return-bearing');
    assert(depart.objective === 'station:departure:stow-cell' && depart.story?.itemCount === 1, `${variant.id}: G3 issued exactly one cell`);
    await target();
    const lock = await sample('return-prompt');
    assert(lock.prompt?.includes(variant.touch ? '[USE]' : '[F]'), `${variant.id}: return action discoverable`);
    await page.reload({ waitUntil: 'networkidle' }); await settle();
    const restored = await sample('reload');
    assert(restored.objective === 'station:departure:stow-cell' && restored.story?.itemCount === 1, `${variant.id}: reload restores G3 and single cell`);
    await target();
    await sample('restored-return-prompt');
    await use();
    await page.waitForURL(url => !url.searchParams.has('spacestation') && url.searchParams.has('undock'), { timeout: 60_000 });
    const departure = await page.evaluate(() => ({ url: location.href, save: JSON.parse(localStorage.getItem('pvx.v1.global') ?? 'null'),
      stationSilence: JSON.parse(sessionStorage.getItem('station-silence-proof') ?? 'null') }));
    result.departure = departure;
    for (const receipt of ['story:ch11-bonded-cell-stowed', 'story:ch11-station-departed']) {
      assert(departure.save?.milestones?.includes(receipt), `${variant.id}: actual departure earned ${receipt}`);
    }
    assert(departure.save?.inventory?.bonded_cell === 1, `${variant.id}: returned game retains exactly one earned bonded cell`);
    assert(departure.stationSilence && Object.values(departure.stationSilence).every(n => n === 0), `${variant.id}: silence through station departure`);
    await page.screenshot({ path: resolve(out, `${variant.id}-returned-to-ship.png`) });
    assert(errors.length === 0, `${variant.id}: zero browser errors (${errors.join('; ')})`);
    result.completed = true;
    await context.close();
  }
} catch (error) {
  failures.push(String(error?.stack ?? error));
} finally {
  writeFileSync(resolve(out, 'report.json'), JSON.stringify({ capturedAt: new Date().toISOString(),
    contractSha256: createHash('sha256').update(readFileSync(resolve(here, 'scene-contract.json'))).digest('hex'),
    renderer: 'headed ANGLE hardware required per variant, dpr1; no independent taste claim',
    buildHash: preview.buildHash, buildAssets,
    positioning: 'Existing production teleport hooks position the probe; actual input and panel actions earn story receipts. This is not manual navigation proof.',
    results, failures }, null, 2) + '\n');
  if (browser) await browser.close(); preview.stop();
}
console.log(`Station UX probe: ${results.length} variants, ${failures.length} failures; ${out}`);
for (const failure of failures) console.error(failure);
if (failures.length) process.exitCode = 1;
