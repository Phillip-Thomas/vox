import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.PARAVOXIA_URL ?? 'http://127.0.0.1:5201/';
const chromePath = process.env.CHROME_PATH ?? '/snap/bin/chromium';
const onlyCase = process.env.PARAVOXIA_CASE ?? null;
const outputDir = path.resolve('captures/demo-shell');
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: chromePath,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader']
});

const results = [];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function capture(page, name) {
  const canvas = page.locator('canvas').first();
  const hasCanvas = await canvas.count();
  if (hasCanvas) await canvas.evaluate(element => { element.dataset.captureVisibility = element.style.visibility; element.style.visibility = 'hidden'; });
  await page.screenshot({ path: path.join(outputDir, name), fullPage: false, timeout: 20_000 });
  if (hasCanvas) await canvas.evaluate(element => { element.style.visibility = element.dataset.captureVisibility ?? ''; delete element.dataset.captureVisibility; });
}

async function waitForPlay(page) {
  const play = page.getByRole('button', { name: /Play Now|Generating world/ });
  await play.waitFor({ state: 'visible', timeout: 30_000 });
  await page.waitForFunction(() => {
    const button = [...document.querySelectorAll('button')].find(item => item.textContent?.includes('Play Now'));
    return button instanceof HTMLButtonElement && !button.disabled;
  }, undefined, { timeout: 30_000 });
  await play.click();
  await page.waitForTimeout(80);
}

async function waitForSceneReady(page) {
  await page.waitForFunction(() => {
    const button = [...document.querySelectorAll('button')].find(item => item.textContent?.includes('Play Now'));
    return button instanceof HTMLButtonElement && !button.disabled;
  }, undefined, { timeout: 30_000 });
}

async function openPause(page) {
  await page.evaluate(() => {
    if (document.pointerLockElement) document.exitPointerLock();
    else document.dispatchEvent(new Event('pointerlockchange'));
  });
  await page.getByRole('dialog').waitFor({ state: 'visible', timeout: 10_000 });
}

async function runPage(label, options, task) {
  if (onlyCase && onlyCase !== label) return;
  const context = await browser.newContext(options);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    const detail = await task(page);
    results.push({ label, ok: true, errors, ...detail });
    console.error(`[demo-shell] PASS ${label}`);
  } catch (error) {
    results.push({ label, ok: false, errors, error: error instanceof Error ? error.message : String(error) });
    console.error(`[demo-shell] FAIL ${label}: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await Promise.race([context.close(), delay(2_000)]);
  }
}

await runPage('landing-desktop-controls', { viewport: { width: 1440, height: 900 } }, async page => {
  await page.goto(new URL('?profile=POTATO', baseUrl).toString(), { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.getByText('Make no mistakes').waitFor({ state: 'visible' });
  const button = page.getByRole('button', { name: 'Controls' });
  await button.click();
  await page.getByText('Ship flight', { exact: true }).waitFor();
  if (await button.getAttribute('aria-expanded') !== 'true') throw new Error('Landing controls disclosure did not expose aria-expanded');
  await capture(page, 'landing-controls-desktop.png');
  return { screenshot: 'landing-controls-desktop.png' };
});

await runPage('landing-mobile-controls', {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1
}, async page => {
  await page.goto(new URL('?profile=POTATO', baseUrl).toString(), { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.getByRole('button', { name: 'Controls' }).click();
  await page.waitForTimeout(120);
  await capture(page, 'landing-controls-mobile.png');
  return { screenshot: 'landing-controls-mobile.png' };
});

await runPage('story-pause-freeze', { viewport: { width: 1440, height: 900 } }, async page => {
  console.error('[demo-shell] story pause: navigate');
  await page.goto(new URL('?story=a1-ramp&profile=POTATO', baseUrl).toString(), { waitUntil: 'domcontentloaded', timeout: 30_000 });
  console.error(`[demo-shell] story pause body: ${(await page.locator('body').innerText()).slice(0, 300).replaceAll('\n', ' | ')}`);
  console.error('[demo-shell] story pause: open pause');
  await openPause(page);
  const body = await page.locator('body').innerText();
  const bodyLower = body.toLowerCase();
  if (bodyLower.includes('star map') || bodyLower.includes('set course')) throw new Error('Story pause exposed world travel');
  if (!bodyLower.includes('on foot · current')) throw new Error('Story pause did not expose current controls');
  const before = await page.evaluate(() => window.__storyBeat);
  console.error(`[demo-shell] story pause: frozen at ${before}`);
  await page.waitForTimeout(9_000);
  const after = await page.evaluate(() => window.__storyBeat);
  if (before !== 'a1-ramp' || after !== before) throw new Error(`Story beat advanced while paused: ${before} -> ${after}`);
  await capture(page, 'story-pause-desktop.png');
  console.error('[demo-shell] story pause: captured');
  return { screenshot: 'story-pause-desktop.png', pausedBeat: before };
});

await runPage('sandbox-pause-travel', { viewport: { width: 1440, height: 900 } }, async page => {
  console.error('[demo-shell] sandbox pause: navigate');
  await page.goto(new URL('?world=0,0&profile=POTATO', baseUrl).toString(), { waitUntil: 'domcontentloaded', timeout: 30_000 });
  console.error('[demo-shell] sandbox pause: open pause');
  await openPause(page);
  await page.getByText('Star Map', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Set Course' }).waitFor();
  await capture(page, 'sandbox-pause-desktop.png');
  return { screenshot: 'sandbox-pause-desktop.png' };
});

await runPage('completed-save-landing', { viewport: { width: 1440, height: 900 } }, async page => {
  console.error('[demo-shell] completed save: navigate');
  await page.goto(new URL('?story=done&profile=POTATO', baseUrl).toString(), { waitUntil: 'domcontentloaded', timeout: 30_000 });
  // Navigating away runs the production unload save; the plain entry must then
  // derive completed-save landing copy from persisted milestones.
  await page.waitForTimeout(500);
  await page.goto(new URL('?profile=POTATO', baseUrl).toString(), { waitUntil: 'domcontentloaded', timeout: 30_000 });
  console.error('[demo-shell] completed save: open replay confirmation');
  await page.getByRole('button', { name: /Return to Site/ }).waitFor();
  await page.getByRole('button', { name: 'Replay Story' }).evaluate(element => element.click());
  await page.waitForTimeout(120);
  await page.getByRole('button', { name: 'Replay from Beginning' }).waitFor();
  await capture(page, 'completed-save-landing.png');
  return { screenshot: 'completed-save-landing.png' };
});

await runPage('completed-return-to-site', { viewport: { width: 1440, height: 900 } }, async page => {
  console.error('[demo-shell] completed return: seed completed save');
  await page.goto(new URL('?story=done&profile=POTATO', baseUrl).toString(), { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForTimeout(500);
  await page.goto(new URL('?world=7,7&profile=POTATO', baseUrl).toString(), { waitUntil: 'domcontentloaded', timeout: 30_000 });
  const button = page.getByRole('button', { name: /Return to Site/ });
  await button.waitFor({ state: 'visible', timeout: 30_000 });
  await button.click();
  await page.getByRole('button', { name: /Preparing Site/ }).waitFor({ state: 'visible', timeout: 5_000 });
  await page.waitForFunction(() => !document.body.innerText.includes('Preparing Site'), undefined, { timeout: 30_000 });
  const savedWorld = await page.evaluate(() => {
    const key = Object.keys(localStorage).find(item => item.endsWith('.global'));
    return key ? JSON.parse(localStorage.getItem(key) ?? 'null').lastWorld : null;
  });
  if (savedWorld?.x !== -1 || savedWorld?.y !== -1) {
    throw new Error(`Return to Site persisted the wrong world: ${JSON.stringify(savedWorld)}`);
  }
  return { savedWorld };
});

await runPage('fabricator-focus', { viewport: { width: 1440, height: 900 } }, async page => {
  await page.goto(new URL('?world=0,0&profile=POTATO', baseUrl).toString(), { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await waitForPlay(page);
  await page.keyboard.press('c');
  const dialog = page.getByRole('dialog', { name: 'FABRICATOR' });
  await dialog.waitFor({ state: 'visible', timeout: 10_000 });
  const focused = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
  if (focused !== 'Close fabricator') throw new Error(`Fabricator did not take focus: ${focused}`);
  const backgroundInteractive = await dialog.evaluate(element => {
    const parent = element.parentElement;
    return parent ? [...parent.children].some(child => child !== element && child instanceof HTMLElement && !child.inert) : true;
  });
  if (backgroundInteractive) throw new Error('Fabricator left a background sibling interactive');
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden', timeout: 5_000 });
  return { focused };
});

await runPage('story-completion-dialog', { viewport: { width: 1440, height: 900 } }, async page => {
  console.error('[demo-shell] completion dialog: open debug visual state');
  await page.goto(new URL('?storyCompletePreview=1&profile=POTATO', baseUrl).toString(), { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.getByRole('heading', { name: 'Story Demo Complete' }).waitFor({ state: 'visible', timeout: 10_000 });
  await page.getByRole('button', { name: 'Replay Story' }).click();
  const focused = await page.evaluate(() => document.activeElement?.textContent?.trim());
  if (focused !== 'Cancel') throw new Error(`Replay confirmation did not refocus Cancel: ${focused}`);
  const dialog = page.getByRole('dialog', { name: 'Story Demo Complete' });
  const backgroundInteractive = await dialog.evaluate(element => {
    const parent = element.parentElement;
    return parent ? [...parent.children].some(child => child !== element && child instanceof HTMLElement && !child.inert) : true;
  });
  if (backgroundInteractive) throw new Error('Completion dialog left a background sibling interactive');
  console.error('[demo-shell] completion dialog: capture confirmation');
  await capture(page, 'story-complete-desktop.png');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Replay Story' }).waitFor({ state: 'visible', timeout: 5_000 });
  return { screenshot: 'story-complete-desktop.png', focused };
});

await Promise.race([browser.close(), delay(2_000)]);
console.log(JSON.stringify({ baseUrl, outputDir, results }, null, 2));
process.exit(results.some(result => !result.ok || result.errors.length > 0) ? 1 : 0);
