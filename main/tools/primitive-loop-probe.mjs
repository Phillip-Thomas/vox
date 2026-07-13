import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.PARAVOXIA_URL ?? 'http://127.0.0.1:5201/';
const chromePath = process.env.CHROME_PATH ?? '/snap/bin/chromium';
const onlyCase = process.env.PARAVOXIA_CASE ?? null;
const playTimeoutMs = Number(process.env.PARAVOXIA_PLAY_TIMEOUT_MS ?? 30_000);
const outputDir = path.resolve('captures/primitive-loop');
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: chromePath,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader']
});

const results = [];

async function capture(page, name) {
  const canvas = page.locator('canvas').first();
  if (await canvas.count()) await canvas.evaluate(element => { element.style.visibility = 'hidden'; });
  await page.screenshot({ path: path.join(outputDir, name), timeout: 20_000 });
  if (await canvas.count()) await canvas.evaluate(element => { element.style.visibility = ''; });
}

async function waitForPlay(page) {
  await page.waitForFunction(() => {
    const button = [...document.querySelectorAll('button')].find(item => item.textContent?.includes('Play Now'));
    return button instanceof HTMLButtonElement && !button.disabled;
  }, undefined, { timeout: playTimeoutMs });
}

async function enterPlay(page) {
  await waitForPlay(page);
  // Native Playwright click waits on the pointer-lock gesture in headless Chromium.
  // DOM activation is sufficient for this shell probe; headed approval owns real lock.
  await page.getByRole('button', { name: /Play Now/ }).evaluate(button => button.click());
  await page.waitForFunction(() => ![...document.querySelectorAll('button')]
    .some(button => button.textContent?.includes('Play Now')), undefined, { timeout: 5_000 });
  await page.waitForTimeout(800);
  const resume = page.getByRole('button', { name: 'Resume', exact: true });
  if (await resume.isVisible().catch(() => false)) {
    await resume.evaluate(button => button.click());
    await page.waitForTimeout(300);
  }
}

async function runCase(label, task) {
  if (onlyCase && onlyCase !== label) return;
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    const detail = await task(page);
    results.push({ label, ok: true, errors, ...detail });
    console.error(`[primitive-loop] PASS ${label}`);
  } catch (error) {
    results.push({ label, ok: false, errors, error: error instanceof Error ? error.message : String(error) });
    console.error(`[primitive-loop] FAIL ${label}: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await context.close().catch(() => undefined);
  }
}

await runCase('public-primitive-fabricator', async page => {
  await page.goto(new URL('?profile=POTATO', baseUrl).toString(), { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await enterPlay(page);
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', {
    code: 'KeyC',
    key: 'c',
    bubbles: true
  })));
  const dialog = page.getByRole('dialog', { name: 'FABRICATOR' });
  await dialog.waitFor({ state: 'visible', timeout: 10_000 });
  const body = await dialog.innerText();
  for (const expected of ['Biofuel', 'Stone Hatchet', 'Stone Pickaxe', 'Torch', 'Campfire', 'Waterskin']) {
    if (!body.includes(expected)) throw new Error(`Missing public primitive recipe: ${expected}`);
  }
  for (const hidden of ['Smelter', 'Assembler', 'Survey Console', 'Iron Maw', 'Range Coil']) {
    if (body.includes(hidden)) throw new Error(`Future recipe surface leaked: ${hidden}`);
  }
  const craftButtons = dialog.getByRole('button', { name: /Craft|Owned/ });
  if (await craftButtons.count() !== 6) throw new Error(`Expected 6 primitive recipes, found ${await craftButtons.count()}`);
  await capture(page, 'primitive-fabricator-potato.png');
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden', timeout: 5_000 });
  const thermal = page.getByTestId('thermal-status');
  await thermal.waitFor({ state: 'visible', timeout: 5_000 });
  return { screenshot: 'primitive-fabricator-potato.png', thermal: await thermal.innerText() };
});

await runCase('persisted-downed-recovery', async page => {
  await page.goto(new URL('?profile=POTATO', baseUrl).toString(), { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await enterPlay(page);
  await page.waitForTimeout(1_100);
  const saveKey = await page.evaluate(() => Object.keys(localStorage).find(key => key.endsWith('.global')) ?? null);
  if (!saveKey) throw new Error('Global save did not initialize');
  await page.evaluate(key => {
    const save = JSON.parse(localStorage.getItem(key) ?? '{}');
    save.vitals = { ...(save.vitals ?? {}), health: 0, warmth: 0 };
    localStorage.setItem(key, JSON.stringify(save));
  }, saveKey);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 });
  await enterPlay(page);
  const dialog = page.getByRole('dialog', { name: 'Downed' });
  await dialog.waitFor({ state: 'visible', timeout: 10_000 });
  const body = await dialog.innerText();
  if (!body.includes('Inventory retained')) throw new Error('Downed recovery did not state inventory policy');
  await capture(page, 'downed-recovery.png');
  await dialog.getByRole('button', { name: 'Recover' }).click();
  await dialog.waitFor({ state: 'hidden', timeout: 10_000 });
  await page.waitForTimeout(1_000);
  const health = await page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '{}').vitals?.health, saveKey);
  if (health !== 100) throw new Error(`Recovery did not persist full health: ${health}`);
  return { screenshot: 'downed-recovery.png', health };
});

await browser.close();
console.log(JSON.stringify({ baseUrl, outputDir, playTimeoutMs, results }, null, 2));
process.exit(results.some(result => !result.ok || result.errors.length > 0) ? 1 : 0);
