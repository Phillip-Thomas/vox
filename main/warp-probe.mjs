import fs from 'node:fs';
import { chromium } from 'playwright-core';

const DEFAULT_EXES = [
  process.env.PLAYWRIGHT_CHROMIUM_EXE,
  'C:/Users/Phillip/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe'
].filter(Boolean);

function safeExists(path) {
  try {
    return fs.existsSync(path);
  } catch {
    return false;
  }
}

const executablePath = DEFAULT_EXES.find(path => safeExists(path));
if (!executablePath) {
  console.error('No Chromium executable found. Set PLAYWRIGHT_CHROMIUM_EXE to a browser path.');
  process.exit(1);
}

const url = process.argv[2] || 'http://127.0.0.1:5177/?world=0,0&warpprobe=1';
const [destX = '1', destY = '0'] = (process.argv[3] || '1,0').split(',');
const settleMs = Number(process.env.WARP_PROBE_SETTLE_MS || 5000);

const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding'
  ]
});

const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', error => console.log('PAGEERR', error.message));
page.on('console', message => console.log(`[browser:${message.type()}] ${message.text()}`));

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForFunction(() => window.__paravoxiaWarpProbe?.travelTo, null, { timeout: 30000 });
await page.waitForTimeout(settleMs);

await page.evaluate(
  ([x, y]) => window.__paravoxiaWarpProbe.travelTo(Number(x), Number(y)),
  [destX, destY]
);

try {
  await page.waitForFunction(() => window.__lastWarpMetrics, null, { timeout: 30000 });
} catch (error) {
  const debug = await page.evaluate(() => ({
    active: window.__activeWarpMetrics || null,
    last: window.__lastWarpMetrics || null,
    bodyText: document.body.innerText.slice(0, 1200)
  }));
  console.log(JSON.stringify({ timeout: true, debug }, null, 2));
  throw error;
}
const report = await page.evaluate(() => window.__lastWarpMetrics);
await browser.close();

const topDurations = [...report.events]
  .filter(event => typeof event.durationMs === 'number')
  .sort((a, b) => b.durationMs - a.durationMs)
  .slice(0, 12)
  .map(event => ({
    label: event.label,
    durationMs: event.durationMs,
    atMs: event.atMs,
    details: event.details || null
  }));

console.log(JSON.stringify({
  summary: {
    destination: report.destination,
    totalMs: report.totalMs,
    maxRafGapMs: report.maxRafGapMs,
    longFrameCount: report.longFrames.length,
    rafFrames: report.rafFrames
  },
  topDurations,
  longFrames: report.longFrames,
  events: report.events
}, null, 2));
