const { chromium } = require('playwright-core');
const fs = require('node:fs');
const path = require('node:path');

const runDir = __dirname;
const screenshotsDir = path.join(runDir, 'screenshots');
const url = process.env.PREVIEW_URL || 'http://127.0.0.1:5174/';
const executablePath = process.env.CHROMIUM_PATH || '/usr/bin/chromium-browser';

fs.mkdirSync(screenshotsDir, { recursive: true });

async function openCoopPanel(page) {
  await page.addInitScript(() => {
    const NativeWebSocket = window.WebSocket;
    window.__coopMessages = [];
    window.WebSocket = class InstrumentedWebSocket extends NativeWebSocket {
      constructor(...args) {
        super(...args);
        this.addEventListener('message', event => {
          try {
            const parsed = JSON.parse(String(event.data));
            window.__coopMessages.push(parsed.type);
          } catch {
            window.__coopMessages.push('unparsed');
          }
        });
      }
    };
  });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (
    [...document.querySelectorAll('button')]
      .some(button => /Co-op/i.test(button.textContent || ''))
  ), null, { timeout: 90_000 });
  await clickButtonText(page, /Co-op/i);
  await page.getByRole('button', { name: /Create room/i }).waitFor({ timeout: 20_000 });
}

async function clickButtonText(page, pattern) {
  await page.waitForFunction(source => {
    const regex = new RegExp(source, 'i');
    return [...document.querySelectorAll('button')]
      .some(candidate => regex.test(candidate.textContent || '') && !candidate.disabled);
  }, pattern.source, { timeout: 20_000 });
  await page.evaluate(source => {
    const regex = new RegExp(source, 'i');
    const button = [...document.querySelectorAll('button')]
      .find(candidate => regex.test(candidate.textContent || '') && !candidate.disabled);
    button?.click();
  }, pattern.source);
}

async function inviteCode(page) {
  await page.waitForFunction(() => /INVITE\s+[A-Z0-9_-]{6}/i.test(document.body.innerText || ''), null, { timeout: 90_000 });
  const text = await page.locator('body').innerText();
  const match = text.match(/INVITE\s+([A-Z0-9_-]{6})/i);
  if (!match?.[1]) throw new Error(`Invite code was not visible in body text: ${text}`);
  return match[1].toUpperCase();
}

async function waitForCrew(page, text) {
  const deadline = Date.now() + 45_000;
  let bodyText = '';
  while (Date.now() < deadline) {
    bodyText = await page.locator('body').innerText({ timeout: 1000 }).catch(() => bodyText);
    if (bodyText.includes(text)) return;
    await page.waitForTimeout(250);
  }
  bodyText = await page.locator('body').innerText({ timeout: 30_000 }).catch(() => bodyText);
  if (bodyText.includes(text)) return;
  throw new Error(`Timed out waiting for "${text}"`);
}

async function capture(browser, name, viewport) {
  const hostContext = await browser.newContext({ viewport, deviceScaleFactor: viewport.width <= 820 ? 2 : 1 });
  const joinContext = await browser.newContext({ viewport, deviceScaleFactor: viewport.width <= 820 ? 2 : 1 });
  const host = await hostContext.newPage();
  const joiner = await joinContext.newPage();
  const consoleErrors = [];
  for (const page of [host, joiner]) {
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', error => consoleErrors.push(error.message));
  }

  await openCoopPanel(host);
  await clickButtonText(host, /Create room/i);
  let code;
  try {
    code = await inviteCode(host);
  } catch (error) {
    await host.screenshot({ path: path.join(screenshotsDir, `${name}-create-failed.png`), fullPage: false, animations: 'disabled', timeout: 90_000 });
    console.log(JSON.stringify({
      failure: `${name}-create`,
      hostText: await host.locator('body').innerText()
    }, null, 2));
    throw error;
  }

  await openCoopPanel(joiner);
  const inviteInput = joiner.getByLabel(/Invite code/i);
  await inviteInput.fill(code);
  try {
    await inviteInput.press('Enter');
  } catch (error) {
    await joiner.screenshot({ path: path.join(screenshotsDir, `${name}-join-click-failed.png`), fullPage: false, animations: 'disabled', timeout: 90_000 });
    console.log(JSON.stringify({
      failure: `${name}-join-click`,
      code,
      joinerText: await joiner.locator('body').innerText()
    }, null, 2));
    throw error;
  }
  await host.bringToFront();

  try {
    await waitForCrew(host, '2/2 linked');
    await waitForCrew(joiner, '2/2 linked');
  } catch (error) {
    await host.screenshot({ path: path.join(screenshotsDir, `${name}-host-failed.png`), fullPage: false, animations: 'disabled', timeout: 90_000 });
    await joiner.screenshot({ path: path.join(screenshotsDir, `${name}-joiner-failed.png`), fullPage: false, animations: 'disabled', timeout: 90_000 });
    console.log(JSON.stringify({
      failure: name,
      hostText: await host.locator('body').innerText(),
      joinerText: await joiner.locator('body').innerText(),
      hostMessages: await host.evaluate(() => window.__coopMessages ?? []),
      joinerMessages: await joiner.evaluate(() => window.__coopMessages ?? [])
    }, null, 2));
    throw error;
  }

  const screenshotPath = path.join(screenshotsDir, `${name}.png`);
  await host.screenshot({ path: screenshotPath, fullPage: false, animations: 'disabled', timeout: 90_000 });
  const hostText = await host.locator('body').innerText();
  await hostContext.close();
  await joinContext.close();
  return {
    name,
    screenshotPath,
    inviteCode: code,
    hasRoster: /crew/i.test(hostText) && hostText.includes('2/2 linked'),
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
    process.exitCode = results.some(result => !result.hasRoster || result.consoleErrors.length > 0) ? 1 : 0;
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
