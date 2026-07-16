import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.PARAVOXIA_URL ?? 'http://127.0.0.1:5201/';
const chromePath = process.env.CHROME_PATH ?? '/snap/bin/chromium';
const requested = process.env.PARAVOXIA_STORY_CASES
  ?.split(',')
  .map(value => value.trim())
  .filter(Boolean);
const cases = requested?.length
  ? requested
  : ['ch5-maw', 'ch7-reconstruct', 'ch8-landfall', 'ch9-settle'];
const outputDir = path.resolve('captures/emergent-story');
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: chromePath,
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--ignore-gpu-blocklist',
    '--enable-webgl',
    '--enable-unsafe-swiftshader'
  ]
});

const results = [];
try {
  for (const beat of cases) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
    page.on('console', message => {
      if (message.type() === 'error') errors.push(`console: ${message.text()}`);
    });
    const url = new URL(baseUrl);
    url.searchParams.set('story', beat);
    url.searchParams.set('debug', '1');
    await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForFunction(() => {
      if (window.__paravoxiaAppState?.phase === 'playing') return true;
      const button = [...document.querySelectorAll('button')]
        .find(candidate => candidate.textContent?.includes('Play Now'));
      return button instanceof HTMLButtonElement && !button.disabled;
    }, undefined, { timeout: 45_000 }).catch(async error => {
      const diagnostic = await page.evaluate(() => ({
        app: window.__paravoxiaAppState ?? null,
        beat: window.__storyBeat ?? null,
        buttons: [...document.querySelectorAll('button')]
          .map(button => ({ text: button.textContent?.trim() ?? '', disabled: button.disabled })),
        body: document.body.textContent?.trim().slice(0, 1200) ?? ''
      }));
      throw new Error(`Story case never became playable: ${JSON.stringify(diagnostic)}; ${error.message}`);
    });
    const alreadyPlaying = await page.evaluate(() => window.__paravoxiaAppState?.phase === 'playing');
    if (!alreadyPlaying) {
      await page.getByRole('button', { name: /Play Now/i }).click({ force: true });
    }
    await page.waitForFunction(expectedBeat => (
      window.__paravoxiaAppState?.phase === 'playing'
      && window.__storyBeat === expectedBeat
      && document.querySelector('canvas') instanceof HTMLCanvasElement
    ), beat, { timeout: 45_000 });
    await page.waitForTimeout(2_500);
    const evidence = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      const gl = canvas?.getContext('webgl2') ?? canvas?.getContext('webgl');
      const debugInfo = gl?.getExtension('WEBGL_debug_renderer_info');
      return {
        beat: window.__storyBeat ?? null,
        app: window.__paravoxiaAppState ?? null,
        canvas: canvas instanceof HTMLCanvasElement
          ? { width: canvas.width, height: canvas.height, clientWidth: canvas.clientWidth, clientHeight: canvas.clientHeight }
          : null,
        renderer: gl && debugInfo
          ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
          : gl ? gl.getParameter(gl.RENDERER) : null,
        workOrder: [...document.querySelectorAll('*')]
          .map(element => element.textContent?.trim() ?? '')
          .find(text => text.includes('WORK ORDER'))
          ?.slice(0, 500) ?? null,
        spawn: window.__voxelDebug?.spawn ?? null
      };
    });
    const screenshot = path.join(outputDir, `${beat}.png`);
    let screenshotCaptured = false;
    let captureWarning = null;
    try {
      await page.screenshot({ path: screenshot, timeout: 60_000, animations: 'disabled' });
      screenshotCaptured = true;
    } catch (error) {
      // SwiftShader can keep Chromium's compositor busy long after the runtime
      // state is inspectable. Preserve the semantic/renderer telemetry and keep
      // probing later beats; a missing image remains an explicit review warning.
      captureWarning = error instanceof Error ? error.message : String(error);
    }
    const unexpectedErrors = errors.filter(message => !(
      message.includes('AudioContext')
      || message.includes('favicon')
      || message.includes('WebGL') && message.includes('ReadPixels')
    ));
    results.push({
      beat,
      url: url.toString(),
      screenshot: screenshotCaptured ? screenshot : null,
      screenshotCaptured,
      captureWarning,
      evidence,
      errors: unexpectedErrors,
      status: unexpectedErrors.length > 0
        ? 'failed'
        : screenshotCaptured
          ? 'passed'
          : 'capture-warning'
    });
    await context.close();
  }
} finally {
  await browser.close();
}

const reportPath = path.join(outputDir, 'runtime-report.json');
await writeFile(reportPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ reportPath, results }, null, 2)}\n`);
if (results.some(result => result.status === 'failed')) process.exitCode = 1;
