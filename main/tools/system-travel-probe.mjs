import { chromium } from 'playwright-core';

function readArg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function probeUrl(rawUrl) {
  const url = new URL(rawUrl);
  url.searchParams.set('systemprobe', '1');
  url.searchParams.set('bench', '1');
  return url.toString();
}

const url = probeUrl(readArg('--url', 'http://127.0.0.1:5173/'));
const windows = Math.max(1, Number(readArg('--windows', '3')) || 3);
const timeout = Math.max(10_000, Number(readArg('--timeout', '90000')) || 90_000);
const executablePath = process.env.CHROMIUM_PATH || '/usr/bin/chromium-browser';

const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ['--disable-dev-shm-usage', '--enable-precise-memory-info']
});

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
  await page.waitForFunction(
    minimum => window.__paravoxiaSystemProbe?.getSnapshot().windows.length >= minimum,
    windows,
    { timeout }
  );
  const snapshot = await page.evaluate(() => window.__paravoxiaSystemProbe?.getSnapshot() ?? null);
  process.stdout.write(`${JSON.stringify({ url, snapshot }, null, 2)}\n`);
} finally {
  await browser.close();
}
