// --- The cockpit probe ---------------------------------------------------------------
//
// Serves the current production build on a free port, drops into flight (`?fly=1`),
// and captures the Kestrel flight deck at rest and under boost, alongside the
// cockpit's draw statistics and a few rAF fps samples. Then it tears the server
// down again.
//
//   node tools/cockpit-probe.mjs                     # 1280x720, ULTRA
//   node tools/cockpit-probe.mjs out ULTRA 2560 720  # ultrawide, where the
//                                                    # peripheral MFDs live
//
// Two things here are deliberate rather than incidental:
//
// * It owns its port. Another project on this machine took a fixed probe port
//   mid-session and the probe happily measured THAT app — it rendered, it
//   returned 200, and nothing looked wrong. So this asks for a free port and
//   then checks the served page is actually Paravoxia before trusting a frame.
// * It samples fps at the requested resolution rather than a fixed one. The
//   cockpit is a near-field surface covering most of the screen, so its cost is
//   fill rate; a 720p sample says nothing about whether it holds up at 1440p.
//
// Note that boost samples fly the ship at speed, which streams world chunks —
// those numbers measure the world as much as the cabin. The at-rest samples are
// the ones that isolate the cockpit.

import { chromium } from 'playwright-core';
import { startParavoxiaPreview, assertHardwareGl, CHROMIUM_ARGS } from './lib/previewServer.mjs';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const outDir = process.argv[2] ?? path.join(os.tmpdir(), 'paravoxia-cockpit');
const profile = process.argv[3] ?? 'ULTRA';
const width = Number(process.argv[4] ?? 1280);
const height = Number(process.argv[5] ?? 720);
const settleS = Number(process.argv[6] ?? 14);

fs.mkdirSync(outDir, { recursive: true });
const preview = await startParavoxiaPreview({ build: false });
const url = preview.url;
const errors = [];
const report = { capturedAt: new Date().toISOString(), url, profile, viewport: { width, height }, errors };

let browser;
try {
  console.log(`[cockpit-probe] ${url} profile=${profile} ${width}x${height}`);

  const pwDir = path.join(os.homedir(), '.cache/ms-playwright');
  const chromeDir = fs.readdirSync(pwDir)
    .filter(name => /^chromium-\d+$/.test(name))
    .sort()
    .pop();
  const executablePath = path.join(pwDir, chromeDir, 'chrome-linux/chrome');

  browser = await chromium.launch({
    executablePath,
    headless: true,
    args: CHROMIUM_ARGS
  });
  const page = await browser.newPage({ viewport: { width, height } });
  page.on('pageerror', error => { errors.push(error.message); console.log(`[pageerror] ${error.message}`); });
  page.on('console', message => {
    if (message.type() === 'error') { errors.push(message.text()); console.log(`[console.error] ${message.text().slice(0, 600)}`); }
  });

  await page.goto(`${url}?fly=1&systemprobe=1&profile=${profile}`, { waitUntil: 'load' });
  report.renderer = await assertHardwareGl(page);
  await page.waitForFunction(() => window.__paravoxiaShipProbe, null, { timeout: 60_000 });
  await new Promise(resolve => setTimeout(resolve, settleS * 1000));

  const stats = await page.evaluate(() => window.__paravoxiaShipProbe.getCockpitStats());
  report.stats = stats;
  if (!stats.meshes || !stats.triangles || !stats.materials) errors.push('cockpit geometry or materials are missing');
  console.log(`[cockpit-probe] draws=${stats.meshes} triangles=${stats.triangles} materials=${stats.materials}`);

  const sample = () => page.evaluate(() => new Promise(resolve => {
    let frames = 0;
    const begin = performance.now();
    const count = () => {
      frames++;
      if (performance.now() - begin < 2000) requestAnimationFrame(count);
      else resolve(Math.round(frames / ((performance.now() - begin) / 1000)));
    };
    requestAnimationFrame(count);
  }));

  await page.screenshot({ path: path.join(outDir, 'cockpit-idle.png') });
  const rest = [];
  for (let i = 0; i < 3; i++) rest.push(await sample());
  console.log(`[cockpit-probe] at rest: [${rest.join(', ')}] fps`);
  report.restFps = rest;

  await page.mouse.click(Math.round(width / 2), Math.round(height / 2)).catch(() => {});
  await page.keyboard.down('KeyW');
  await page.keyboard.down('ShiftLeft');
  await new Promise(resolve => setTimeout(resolve, 4000));
  await page.screenshot({ path: path.join(outDir, 'cockpit-boost.png') });
  const boost = [];
  for (let i = 0; i < 2; i++) boost.push(await sample());
  await page.keyboard.up('KeyW');
  await page.keyboard.up('ShiftLeft');
  console.log(`[cockpit-probe] under boost: [${boost.join(', ')}] fps (also measures world streaming)`);
  report.boostFps = boost;
  console.log(`[cockpit-probe] wrote ${outDir}/cockpit-{idle,boost}.png`);
  if (errors.length) process.exitCode = 1;
} catch (error) {
  errors.push(String(error?.stack ?? error));
  process.exitCode = 1;
  console.error(error);
} finally {
  fs.writeFileSync(path.join(outDir, 'cockpit-report.json'), JSON.stringify(report, null, 2) + '\n');
  if (browser) await browser.close().catch(() => {});
  preview.stop();
}
