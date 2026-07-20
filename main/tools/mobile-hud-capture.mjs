import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.PARAVOXIA_URL ?? 'http://127.0.0.1:5173/';
const outputDir = path.resolve(process.env.PARAVOXIA_MOBILE_HUD_OUTPUT ?? 'captures/mobile-hud');
const beat = process.env.PARAVOXIA_MOBILE_HUD_BEAT ?? 'ch5-maw';
const chromePath = process.env.CHROME_PATH ?? '/snap/bin/chromium';

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

const report = { beat, baseUrl, screenshots: [], assertions: {}, errors: [] };

async function enterStory(page) {
  page.on('pageerror', error => report.errors.push(`pageerror: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') report.errors.push(`console: ${message.text()}`);
  });
  const url = new URL(baseUrl);
  url.searchParams.set('story', beat);
  url.searchParams.set('profile', 'POTATO');
  await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForFunction(() => (
    window.__paravoxiaAppState?.phase === 'playing'
    || [...document.querySelectorAll('button')].some(button => button.textContent?.includes('Play Now') && !button.disabled)
  ), undefined, { timeout: 60_000 });
  if (!await page.evaluate(() => window.__paravoxiaAppState?.phase === 'playing')) {
    await page.getByRole('button', { name: /Play Now/i }).click({ force: true });
  }
  await page.waitForFunction(expectedBeat => (
    window.__paravoxiaAppState?.phase === 'playing'
    && window.__storyBeat === expectedBeat
    && document.querySelector('canvas') instanceof HTMLCanvasElement
  ), beat, { timeout: 45_000 });
  await page.waitForSelector('[aria-label="Current story objective"]', { state: 'visible', timeout: 10_000 });
  await page.waitForFunction(() => {
    const marker = document.querySelector('[data-story-free-marker="true"]');
    const objective = document.querySelector('[aria-label="Current story objective"]');
    if (!(objective instanceof HTMLElement)) return false;
    if (objective.dataset.objectiveRequiresMarker !== 'true') return true;
    return objective.dataset.objectiveHealth === 'ready'
      && marker instanceof HTMLElement
      && marker.dataset.markerLayout === 'ready';
  }, undefined, { timeout: 45_000 }).catch(() => undefined);
  // Software WebGL can publish scene readiness one frame before the first
  // composed world frame. Keep screenshots from certifying a black canvas.
  await page.waitForTimeout(1_000);
}

async function hideDeveloperChrome(page) {
  await page.evaluate(() => {
    for (const button of document.querySelectorAll('button')) {
      const text = button.textContent?.trim() ?? '';
      if (text.startsWith('DBG') || text.startsWith('⛿ STORY')) {
        const owner = button.parentElement;
        if (owner) owner.style.display = 'none';
      }
    }
  });
}

async function capture(page, id) {
  const screenshotPath = path.join(outputDir, `${id}.png`);
  await page.screenshot({ path: screenshotPath });
  report.screenshots.push({ id, path: screenshotPath, viewport: page.viewportSize() });
}

try {
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    reducedMotion: 'no-preference'
  });
  const page = await mobile.newPage();
  await enterStory(page);
  await hideDeveloperChrome(page);

  await capture(page, 'mobile-portrait-closed');
  report.assertions.closed = await page.evaluate(() => ({
    objectiveText: document.querySelector('[aria-label="Current story objective"]')?.textContent?.trim(),
    journalOpen: Boolean(document.querySelector('[role="dialog"][aria-modal="true"]')),
    touchControls: Boolean(document.querySelector('[data-testid="touch-joystick"]')),
    vitalsExpanded: document.querySelector('[data-testid="vitals-meter"]')?.getAttribute('data-mobile-expanded'),
    systemButtonCount: document.querySelector('[aria-label="HUD quick actions"]')?.querySelectorAll(':scope > button').length
  }));

  await page.getByRole('button', { name: 'Current story objective' }).click();
  await page.getByRole('dialog').waitFor({ state: 'visible' });
  await capture(page, 'mobile-portrait-journal');
  report.assertions.journal = await page.evaluate(() => ({
    touchControls: Boolean(document.querySelector('[data-testid="touch-joystick"]')),
    closeFocused: document.activeElement?.getAttribute('aria-label') === 'Close objective journal',
    dialogInsideViewport: (() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!(dialog instanceof HTMLElement)) return false;
      const rect = dialog.getBoundingClientRect();
      return rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight;
    })()
  }));
  await page.getByRole('button', { name: 'Close objective journal' }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });

  await page.getByRole('button', { name: 'Show survival vitals' }).click();
  await capture(page, 'mobile-portrait-suit-open');

  await page.getByRole('button', { name: 'Open systems menu' }).click();
  await page.getByTestId('mobile-hud-systems-menu').waitFor({ state: 'visible' });
  await capture(page, 'mobile-portrait-systems-open');
  report.assertions.disclosureOwnership = await page.evaluate(() => ({
    suitExpanded: document.querySelector('[data-testid="vitals-meter"]')?.getAttribute('data-mobile-expanded'),
    touchControls: Boolean(document.querySelector('[data-testid="touch-joystick"]'))
  }));
  await page.locator('button[aria-hidden="true"][tabindex="-1"]').click({ position: { x: 20, y: 200 } });

  await page.getByRole('button', { name: 'Show inventory' }).click();
  await capture(page, 'mobile-portrait-inventory-open');
  report.assertions.inventory = await page.evaluate(() => {
    const button = document.querySelector('[data-testid="inventory-button"]');
    const panel = document.querySelector('[data-testid="inventory-panel"]');
    if (!(button instanceof HTMLElement) || !(panel instanceof HTMLElement)) return null;
    return {
      targetHeight: button.getBoundingClientRect().height,
      panelInsideViewport: panel.getBoundingClientRect().bottom <= innerHeight,
      touchControls: Boolean(document.querySelector('[data-testid="touch-joystick"]'))
    };
  });
  await page.getByRole('button', { name: 'Hide inventory' }).click();

  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(100);
  await capture(page, 'mobile-landscape-closed');
  report.assertions.landscape = await page.evaluate(() => {
    const marker = document.querySelector('[data-story-free-marker="true"]');
    if (!(marker instanceof HTMLElement)) return null;
    const markerRect = marker.getBoundingClientRect();
    const hudRects = [
      '[data-testid="vitals-meter"]',
      '[data-testid="inventory-panel"]',
      '[data-story-journal-trigger="true"]',
      '[aria-label="Open systems menu"]'
    ].flatMap(selector => {
      const element = document.querySelector(selector);
      return element instanceof HTMLElement ? [element.getBoundingClientRect()] : [];
    });
    const intersects = hudRects.some(rect => (
      markerRect.left < rect.right
      && markerRect.right > rect.left
      && markerRect.top < rect.bottom
      && markerRect.bottom > rect.top
    ));
    return { markerClearOfHud: !intersects };
  });
  await page.getByRole('button', { name: 'Current story objective' }).click();
  await page.getByRole('dialog').waitFor({ state: 'visible' });
  await capture(page, 'mobile-landscape-journal');
  await page.getByRole('button', { name: 'Close objective journal' }).click();

  await page.setViewportSize({ width: 320, height: 568 });
  await page.waitForTimeout(100);
  await capture(page, 'mobile-320x568-closed');
  report.assertions.narrowControls = await page.evaluate(() => {
    const joystick = document.querySelector('[data-testid="touch-joystick"]');
    const actions = document.querySelector('[data-testid="touch-action-cluster"]');
    if (!(joystick instanceof HTMLElement) || !(actions instanceof HTMLElement)) return null;
    const joystickRect = joystick.getBoundingClientRect();
    const actionRect = actions.getBoundingClientRect();
    return {
      gap: actionRect.left - joystickRect.right,
      separated: joystickRect.right + 8 <= actionRect.left
    };
  });
  await page.getByRole('button', { name: 'Current story objective' }).click();
  await page.getByRole('dialog').waitFor({ state: 'visible' });
  await capture(page, 'mobile-320x568-journal-stress');
  report.assertions.stress = await page.evaluate(() => {
    const sheet = document.querySelector('[role="dialog"] section');
    if (!(sheet instanceof HTMLElement)) return null;
    const rect = sheet.getBoundingClientRect();
    return {
      insideViewport: rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight,
      scrollable: sheet.scrollHeight >= sheet.clientHeight
    };
  });
  await mobile.close();

  const desktop = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    hasTouch: false,
    isMobile: false,
    reducedMotion: 'no-preference'
  });
  const desktopPage = await desktop.newPage();
  await enterStory(desktopPage);
  await hideDeveloperChrome(desktopPage);
  await capture(desktopPage, 'desktop-card-preserved');
  report.assertions.desktop = await desktopPage.evaluate(() => ({
    objectiveText: document.querySelector('[aria-label="Current story objective"]')?.textContent?.trim(),
    compactTrigger: Boolean(document.querySelector('[data-story-journal-trigger="true"]'))
  }));
  await desktop.close();
} finally {
  await browser.close();
}

await writeFile(path.join(outputDir, 'mobile-hud-report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));

const passed = report.errors.length === 0
  && report.assertions.closed?.objectiveText === 'JOURNAL'
  && report.assertions.closed?.journalOpen === false
  && report.assertions.closed?.touchControls === true
  && report.assertions.closed?.vitalsExpanded === 'false'
  && report.assertions.closed?.systemButtonCount === 1
  && report.assertions.journal?.touchControls === false
  && report.assertions.journal?.closeFocused === true
  && report.assertions.journal?.dialogInsideViewport === true
  && report.assertions.disclosureOwnership?.suitExpanded === 'false'
  && report.assertions.disclosureOwnership?.touchControls === false
  && report.assertions.inventory?.targetHeight >= 44
  && report.assertions.inventory?.panelInsideViewport === true
  && report.assertions.inventory?.touchControls === false
  && report.assertions.landscape?.markerClearOfHud === true
  && report.assertions.narrowControls?.separated === true
  && report.assertions.stress?.insideViewport === true
  && report.assertions.desktop?.compactTrigger === false
  && report.assertions.desktop?.objectiveText?.includes('CURRENT OBJECTIVE');

if (!passed) process.exitCode = 1;
