import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('/home/thomasphillip/Projects/vox/main/node_modules/playwright-core');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const url = process.env.HUD_URL ?? 'http://127.0.0.1:5173/?agent=1&world=0,0';
const screenshotDir = path.join(__dirname, 'screenshots');

function intersects(a, b) {
  if (!a || !b) return false;
  return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
}

async function ready(page) {
  await page.waitForFunction(() => window.__game && typeof window.__game.ready === 'function', { timeout: 20000 });
  await page.evaluate(async () => {
    await Promise.race([
      window.__game.ready(),
      new Promise(resolve => setTimeout(resolve, 12000))
    ]);
    window.__game.lookFrom(0, 56, 7.5, 0, 52.7, -2.6);
  });
  await page.waitForTimeout(700);
}

async function collectHudProof(page) {
  return page.evaluate(() => {
    const rect = selector => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        left: Math.round(r.left),
        top: Math.round(r.top),
        right: Math.round(r.right),
        bottom: Math.round(r.bottom),
        width: Math.round(r.width),
        height: Math.round(r.height)
      };
    };

    return {
      title: document.title,
      vitals: rect('[data-testid="vitals-meter"]'),
      inventoryPanel: rect('[data-testid="inventory-panel"]'),
      inventoryButton: rect('[data-testid="inventory-button"]'),
      inventoryExpanded: document.querySelector('[data-testid="inventory-button"]')?.getAttribute('aria-expanded') ?? null,
      inventoryContentVisible: Boolean(document.querySelector('[data-testid="inventory-contents"]')),
      mawRowDisplay: getComputedStyle(document.querySelector('[data-testid="maw-hud-row"]') ?? document.body).display,
      jetpackRow: rect('[data-testid="jetpack-hud-row"]'),
      joystick: rect('[data-testid="touch-joystick"]'),
      actionCluster: rect('[data-testid="touch-action-cluster"]'),
      actionLabels: Array.from(document.querySelectorAll('button[data-testid^="touch-action-"]'))
        .map(el => el.textContent?.trim())
        .filter(Boolean),
      hasDive: document.body.innerText.includes('DIVE'),
      hasBreath: document.body.innerText.includes('BREATH'),
      hasStandaloneJetpack: document.body.innerText.includes('JETPACK'),
      hasOxygenInSuitHud: document.body.innerText.includes('OXY'),
      hasJetpackInSuitHud: document.body.innerText.includes('JET'),
      bodyTextSample: document.body.innerText.slice(0, 400)
    };
  });
}

async function capture(page, name, viewport, mobile = false) {
  await page.setViewportSize(viewport);
  await page.goto(url, { waitUntil: 'networkidle' });
  if (mobile) {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'maxTouchPoints', { value: 5, configurable: true });
    });
    await page.reload({ waitUntil: 'networkidle' });
  }
  await ready(page);
  const proof = await collectHudProof(page);
  const file = path.join(screenshotDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return { name, file, proof };
}

const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium-browser',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});

const page = await browser.newPage();
const consoleIssues = [];
page.on('console', msg => {
  if (['error', 'warning'].includes(msg.type())) consoleIssues.push(`${msg.type()}: ${msg.text()}`);
});

const desktop = await capture(page, 'desktop-hud', { width: 1440, height: 900 }, false);
const mobile = await capture(page, 'mobile-hud', { width: 390, height: 844 }, true);
await page.click('[data-testid="inventory-button"]');
await page.waitForTimeout(150);
const mobileInventoryOpen = {
  name: 'mobile-inventory-open',
  file: path.join(screenshotDir, 'mobile-inventory-open.png'),
  proof: await collectHudProof(page)
};
await page.screenshot({ path: mobileInventoryOpen.file, fullPage: false });
await browser.close();

const mobileOverlap = intersects(mobile.proof.vitals, mobile.proof.joystick);
const mobileActionsOverlapJoystick = intersects(mobile.proof.actionCluster, mobile.proof.joystick);
const mobileInventoryOverlapJoystick = intersects(mobileInventoryOpen.proof.inventoryPanel, mobile.proof.joystick);

console.log(JSON.stringify({
  url,
  desktop,
  mobile,
  mobileInventoryOpen,
  assertions: {
    mobileVitalsOverlapJoystick: mobileOverlap,
    mobileActionsOverlapJoystick,
    mobileInventoryOverlapJoystick,
    mobileHasDive: mobile.proof.hasDive,
    mobileHasBreath: mobile.proof.hasBreath,
    mobileHasStandaloneJetpack: mobile.proof.hasStandaloneJetpack,
    mobileHasOxygenInSuitHud: mobile.proof.hasOxygenInSuitHud,
    mobileHasJetpackInSuitHud: mobile.proof.hasJetpackInSuitHud,
    mobileInventoryStartsCollapsed: mobile.proof.inventoryExpanded === 'false' && !mobile.proof.inventoryContentVisible,
    mobileInventoryOpens: mobileInventoryOpen.proof.inventoryExpanded === 'true' && mobileInventoryOpen.proof.inventoryContentVisible,
    mobileActionLabels: mobile.proof.actionLabels
  },
  consoleIssues
}, null, 2));

if (
  mobileOverlap ||
  mobileActionsOverlapJoystick ||
  mobileInventoryOverlapJoystick ||
  mobile.proof.hasDive ||
  mobile.proof.hasBreath ||
  mobile.proof.hasStandaloneJetpack ||
  !mobile.proof.hasOxygenInSuitHud ||
  !mobile.proof.hasJetpackInSuitHud ||
  mobile.proof.inventoryExpanded !== 'false' ||
  mobileInventoryOpen.proof.inventoryExpanded !== 'true'
) {
  process.exitCode = 1;
}
