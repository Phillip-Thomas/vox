const { chromium } = require('playwright-core');
const path = require('node:path');

const runDir = __dirname;
const screenshotsDir = path.join(runDir, 'screenshots');
const url = process.env.PREVIEW_URL || 'http://127.0.0.1:5173/';
const executablePath = process.env.CHROMIUM_PATH || '/usr/bin/chromium-browser';

async function readCanvasStats(page) {
  return page.locator('[data-testid="orbital-minimap"] canvas').evaluate(canvas => {
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return { ok: false, error: 'no webgl context' };
    const width = canvas.width;
    const height = canvas.height;
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let lit = 0;
    let alpha = 0;
    let max = 0;
    let total = 0;
    let hash = 2166136261;
    for (let i = 0; i < pixels.length; i += 4) {
      const a = pixels[i + 3];
      const sum = pixels[i] + pixels[i + 1] + pixels[i + 2];
      if (a > 0) alpha++;
      if (sum > 18) lit++;
      if (sum > max) max = sum;
      total += sum;
      if (i % 64 === 0) {
        hash ^= pixels[i] + (pixels[i + 1] << 8) + (pixels[i + 2] << 16) + (a << 24);
        hash = Math.imul(hash, 16777619) >>> 0;
      }
    }
    return {
      ok: true,
      width,
      height,
      lit,
      alpha,
      max,
      mean: total / Math.max(1, width * height * 3),
      hash
    };
  });
}

async function capture(browser, name, viewport) {
  const context = await browser.newContext({
    viewport,
    isMobile: viewport.width <= 820,
    hasTouch: viewport.width <= 820,
    deviceScaleFactor: viewport.width <= 820 ? 2 : 1
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', error => consoleErrors.push(error.message));

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (
    [...document.querySelectorAll('button')]
      .some(button => /Play Now/i.test(button.textContent || '') && !button.disabled)
  ), null, { timeout: 90_000 });
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')]
      .find(candidate => /Play Now/i.test(candidate.textContent || ''));
    button?.click();
  });
  const minimap = page.locator('[data-testid="orbital-minimap"]');
  await minimap.waitFor({ timeout: 45_000 });
  await page.waitForTimeout(1_200);

  const firstStats = await readCanvasStats(page);
  await page.waitForTimeout(900);
  const secondStats = await readCanvasStats(page);
  const box = await minimap.boundingBox();
  const screenshotPath = path.join(screenshotsDir, `${name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false });
  await context.close();

  return {
    name,
    viewport,
    screenshotPath,
    box,
    firstStats,
    secondStats,
    animated: firstStats.ok && secondStats.ok && firstStats.hash !== secondStats.hash,
    consoleErrors: consoleErrors.slice(0, 10)
  };
}

(async () => {
  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  try {
    const results = [];
    results.push(await capture(browser, 'desktop-1440x900', { width: 1440, height: 900 }));
    results.push(await capture(browser, 'mobile-390x844', { width: 390, height: 844 }));
    console.log(JSON.stringify({ url, results }, null, 2));
    const failed = results.some(result => (
      !result.firstStats.ok
      || !result.secondStats.ok
      || result.firstStats.lit < 80
      || result.secondStats.lit < 80
      || !result.animated
      || result.consoleErrors.length > 0
      || !result.box
    ));
    process.exitCode = failed ? 1 : 0;
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
