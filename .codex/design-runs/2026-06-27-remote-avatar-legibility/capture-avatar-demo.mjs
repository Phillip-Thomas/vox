#!/usr/bin/env node

import playwrightCore from '/home/thomasphillip/Projects/vox/main/node_modules/playwright-core/index.js';

const { chromium } = playwrightCore;

const url = process.env.DESIGN_URL || 'http://127.0.0.1:5173/?agent=1&world=0,0&avatarDemo=1';
const outDir = '/home/thomasphillip/Projects/vox/.codex/design-runs/2026-06-27-remote-avatar-legibility/screenshots';

const viewports = [
  ['desktop', 1440, 900, false],
  ['mobile', 390, 844, true]
];

const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium-browser',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});

const results = [];

try {
  for (const [name, width, height, isMobile] of viewports) {
    const context = await browser.newContext({
      viewport: { width, height },
      isMobile,
      hasTouch: isMobile,
      deviceScaleFactor: isMobile ? 2 : 1
    });
    const page = await context.newPage();
    const messages = [];
    page.on('console', message => {
      if (['error', 'warning'].includes(message.type())) messages.push(`${message.type()}: ${message.text()}`);
    });
    page.on('pageerror', error => messages.push(`pageerror: ${error.message}`));

    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('canvas', { timeout: 30000 });
    await page.waitForFunction(() => window.__game?.lookFrom, null, { timeout: 30000 });
    await page.evaluate(async () => {
      await Promise.race([
        window.__game.ready(),
        new Promise(resolve => setTimeout(resolve, 8000))
      ]);
      window.__game.lookFrom(0, 56, 7.5, 0, 52.7, -2.6);
    });
    await page.waitForTimeout(2200);

    const proof = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      const text = document.body.innerText;
      return {
        title: document.title,
        url: window.location.href,
        hasCanvas: Boolean(canvas),
        canvasSize: canvas ? { width: canvas.width, height: canvas.height } : null,
        hasDebugStats: text.includes('Efficient Voxel System'),
        hasWorldCoordinates: text.includes('World Coordinates')
      };
    });

    const file = `${outDir}/${name}-avatar-demo.png`;
    await page.screenshot({ path: file, fullPage: false });
    results.push({ name, viewport: `${width}x${height}`, file, proof, messages });
    await context.close();
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify({ url, results }, null, 2));
