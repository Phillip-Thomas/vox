import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.PARAVOXIA_URL ?? 'http://127.0.0.1:5201/';
const chromePath = process.env.CHROME_PATH ?? '/snap/bin/chromium';
const onlyCase = process.env.PARAVOXIA_CASE ?? null;
const playTimeoutMs = Number(process.env.PARAVOXIA_PLAY_TIMEOUT_MS ?? 30_000);
const headed = process.env.PARAVOXIA_HEADED === '1' || process.argv.includes('--headed');
const outputDir = path.resolve('captures/primitive-loop');
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  headless: !headed,
  executablePath: chromePath,
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--ignore-gpu-blocklist',
    '--enable-webgl',
    ...(headed ? ['--use-angle=gl'] : ['--enable-unsafe-swiftshader'])
  ]
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

async function trustedMouseClick(page, locator) {
  // `force` skips Playwright's stability wait (the menu button intentionally
  // pulses forever) while still emitting a native browser input event.
  await locator.click({ force: true, timeout: 10_000 });
}

async function trustedPlayClick(page) {
  const target = await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')]
      .find(item => item.textContent?.includes('Play Now'));
    if (!(button instanceof HTMLButtonElement)) return null;
    const rect = button.getBoundingClientRect();
    const x = rect.x + rect.width / 2;
    const y = rect.y + rect.height / 2;
    const hit = document.elementFromPoint(x, y);
    return {
      x,
      y,
      width: rect.width,
      height: rect.height,
      disabled: button.disabled,
      hitTag: hit?.tagName ?? '',
      hitText: hit?.textContent?.trim().slice(0, 80) ?? ''
    };
  });
  if (!target || target.width <= 0 || target.height <= 0 || target.disabled) {
    throw new Error(`Play target is not click-ready: ${JSON.stringify(target)}`);
  }
  await page.mouse.click(target.x, target.y);
}

async function enterPlay(page) {
  await waitForPlay(page);
  if (headed) {
    await page.evaluate(() => {
      window.__primitiveProbeInput = [];
      document.addEventListener('click', event => {
        window.__primitiveProbeInput.push({ type: 'click', trusted: event.isTrusted, tag: event.target?.tagName ?? '' });
      }, { capture: true, once: true });
      document.addEventListener('pointerlockchange', () => {
        window.__primitiveProbeInput.push({ type: 'pointerlockchange', locked: document.pointerLockElement !== null });
      });
      document.addEventListener('pointerlockerror', () => {
        window.__primitiveProbeInput.push({ type: 'pointerlockerror' });
      });
    });
  }
  // Direct browser input works in both modes and keeps the shell smoke on the
  // same activation path as a person. Only headed mode claims pointer-lock proof.
  await trustedPlayClick(page);
  await page.waitForFunction(() => {
    return window.__paravoxiaAppState?.phase === 'playing';
  }, undefined, { timeout: 12_000 })
    .then(() => page.waitForFunction(() => ![...document.querySelectorAll('button')]
      .some(button => button.textContent?.includes('Play Now') || button.textContent?.includes('Generating world')), undefined, { timeout: 12_000 }))
    .catch(async error => {
      const receipt = await page.evaluate(() => {
        return {
          events: window.__primitiveProbeInput ?? [],
          locked: document.pointerLockElement !== null,
          activeTag: document.activeElement?.tagName ?? '',
          app: window.__paravoxiaAppState ?? null,
          playButtons: [...document.querySelectorAll('button')]
            .filter(button => button.textContent?.includes('Play Now'))
            .map(button => ({ text: button.textContent, disabled: button.disabled, connected: button.isConnected }))
        };
      });
      throw new Error(`Play menu did not close after trusted click: ${JSON.stringify(receipt)}; ${error.message}`);
    });
  if (headed) {
    await page.waitForFunction(() => document.pointerLockElement !== null, undefined, { timeout: 5_000 })
      .catch(async error => {
        const receipt = await page.evaluate(() => window.__primitiveProbeInput ?? []);
        throw new Error(`Pointer lock was not acquired after trusted click: ${JSON.stringify(receipt)}; ${error.message}`);
      });
  }
  await page.waitForTimeout(800);
  const resume = page.getByRole('button', { name: 'Resume', exact: true });
  if (await resume.isVisible().catch(() => false)) {
    if (headed) await trustedMouseClick(page, resume);
    else await resume.evaluate(button => button.click());
    await page.waitForTimeout(300);
  }
}

async function assertSettledCanonicalSpawn(page) {
  await page.waitForFunction(() => {
    const player = window.__voxelDebug?.player;
    const spawn = window.__voxelDebug?.spawn;
    if (!spawn?.safe || !player?.grounded || !Array.isArray(player.velocity)) return false;
    return Math.hypot(...player.velocity) < 0.2;
  }, undefined, { timeout: 30_000 }).catch(async error => {
    const receipt = await page.evaluate(() => {
      return {
        app: window.__paravoxiaAppState ?? null,
        player: window.__voxelDebug?.player ?? null,
        pointerLocked: document.pointerLockElement !== null,
        buttons: [...document.querySelectorAll('button')]
          .map(button => button.textContent?.trim().slice(0, 80))
          .filter(Boolean)
      };
    });
    throw new Error(`Player did not settle on validated terrain: ${JSON.stringify(receipt)}; ${error.message}`);
  });

  const report = await page.evaluate(() => {
    const player = window.__voxelDebug?.player;
    const spawn = window.__voxelDebug?.spawn;
    if (!player || !Array.isArray(player.position)) return { ok: false, reason: 'missing player debug pose' };
    if (!spawn || !Array.isArray(spawn.playerExpectedSettled)) {
      return { ok: false, reason: 'missing scene spawn contract' };
    }
    // The production scene publishes the result of the same live/persisted
    // terrain contract it used to mount the player and ship. This keeps the
    // playthrough gate valid against both Vite source mode and a built preview.
    const expected = spawn.playerExpectedSettled;
    const actual = player.position;
    const distance = Math.hypot(
      actual[0] - expected[0],
      actual[1] - expected[1],
      actual[2] - expected[2]
    );
    return {
      ok: spawn.safe === true && distance <= 0.35,
      grounded: player.grounded,
      velocity: player.velocity,
      supportVoxel: spawn.supportVoxel,
      requested: spawn.playerRequested,
      shipRequested: spawn.shipRequested,
      expected,
      actual,
      distance
    };
  });
  if (!report.ok) throw new Error(`Unsafe or unsettled initial spawn: ${JSON.stringify(report)}`);
  return report;
}

async function primeCanonicalProbeWorld(page, coordinate = { x: -1, y: -1 }) {
  await page.addInitScript(({ x, y }) => {
    const guard = '__paravoxiaPrimitiveProbeWorldV1';
    if (sessionStorage.getItem(guard) === '1') return;
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('pvx.')) localStorage.removeItem(key);
    }
    const worldId = `${x},${y}`;
    localStorage.setItem('pvx.v1.global', JSON.stringify({
      inventory: {},
      mawCharge: 0,
      era: 'primitive',
      milestones: [],
      lastWorld: { x, y },
      lastPlanetWorldId: worldId
    }));
    sessionStorage.setItem(guard, '1');
  }, coordinate);
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
    const failureScreenshot = path.join(outputDir, `${label}-failure.png`);
    await page.screenshot({ path: failureScreenshot, timeout: 20_000 }).catch(() => undefined);
    results.push({ label, ok: false, errors, error: error instanceof Error ? error.message : String(error) });
    console.error(`[primitive-loop] FAIL ${label}: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await context.close().catch(() => undefined);
  }
}

await runCase('public-primitive-fabricator', async page => {
  await primeCanonicalProbeWorld(page);
  await page.goto(new URL('?profile=POTATO', baseUrl).toString(), { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await enterPlay(page);
  const spawn = await assertSettledCanonicalSpawn(page);
  await page.keyboard.press('c');
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
  return { screenshot: 'primitive-fabricator-potato.png', thermal: await thermal.innerText(), spawn };
});

await runCase('persisted-downed-recovery', async page => {
  await primeCanonicalProbeWorld(page);
  await page.goto(new URL('?profile=POTATO', baseUrl).toString(), { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await enterPlay(page);
  const initialSpawn = await assertSettledCanonicalSpawn(page);
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
  const recoveredSpawn = await assertSettledCanonicalSpawn(page);
  const health = await page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '{}').vitals?.health, saveKey);
  if (health !== 100) throw new Error(`Recovery did not persist full health: ${health}`);
  return { screenshot: 'downed-recovery.png', health, initialSpawn, recoveredSpawn };
});

await browser.close();
console.log(JSON.stringify({ baseUrl, outputDir, playTimeoutMs, headed, trustedPointerLockInput: headed, results }, null, 2));
process.exit(results.some(result => !result.ok || result.errors.length > 0) ? 1 : 0);
