#!/usr/bin/env node
/** Live browser proof for the post-Chapter-10 station story visit. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const { chromium } = await import(
  '/home/thomasphillip/Projects/vox/main/node_modules/playwright-core/index.mjs'
);

const RUN_DIR = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(RUN_DIR, 'evidence', 'verification', 'ch11-station-story.json');
const BASE = process.env.VOX_BASE ?? 'http://127.0.0.1:5176';
const GLOBAL_KEY = 'pvx.v1.global';
const STATION_URL = `${BASE}/?spacestation=-1,-1,0&from=game&profile=POTATO&dock=0&ai=off`;
const pwDir = path.join(os.homedir(), '.cache/ms-playwright');
const chromeDir = fs.readdirSync(pwDir).filter(name => /^chromium-\d+$/.test(name)).sort().pop();
if (!chromeDir) throw new Error(`No Playwright Chromium install found in ${pwDir}`);

const report = {
  schema: 'paravoxia.ch11StationStoryProbe.v1',
  capturedAt: new Date().toISOString(),
  base: BASE,
  checks: [],
  runtimeProblems: []
};
const failures = [];
const check = (name, pass, detail = null) => {
  const row = { name, pass: Boolean(pass), detail };
  report.checks.push(row);
  process.stdout.write(`${row.pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}\n`);
  if (!row.pass) failures.push(name);
};

const initialSave = {
  inventory: {},
  mawCharge: 0,
  era: 'paravox_machina',
  milestones: [
    'story:started',
    'story:complete',
    'story:ch9:hearth',
    'story:ch10-bearing-claimed',
    'story:ch10-station-resolved',
    'story:ch10-complete',
    'story:station-docking-authorized'
  ],
  lastWorld: { x: -1, y: -1 },
  lastPlanetWorldId: '-1,-1:p1',
  dayPhase: 0.73
};

const returnSave = {
  ...initialSave,
  inventory: { bonded_cell: 1 },
  milestones: [
    ...initialSave.milestones,
    'story:ch11-docked',
    'story:ch11-designation-presented',
    'story:ch11-registry-recorded',
    'story:ch11-concourse-entered',
    'story:ch11-habitat-fault-presented',
    'story:ch11-bonded-cell-acquired',
    'story:station-trade-unlocked',
    'story:ch11-bonded-cell-stowed',
    'story:ch11-station-departed'
  ]
};

const tidegardenHabitat = {
  schemaVersion: 1,
  worldId: '-1,-1:p1',
  core: {
    actorId: 'local',
    worldId: '-1,-1:p1',
    shelterId: 'habitat:-1,-1:p1:8,25,-4',
    cell: [8, 25, -4],
    supportCell: [8, 24, -4],
    position: [16, 50.24, -8],
    up: [0, 1, 0],
    eventId: 'story:tidegarden:local:habitat-core-online'
  },
  shelterCertification: {
    shelterId: 'habitat:-1,-1:p1:8,25,-4',
    cell: [8, 25, -4],
    insulation: 1,
    interiorCellCount: 1,
    eventId: 'story:tidegarden:local:shelter-certified'
  }
};

const browser = await chromium.launch({
  executablePath: path.join(pwDir, chromeDir, 'chrome-linux', 'chrome'),
  headless: true,
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--no-sandbox',
    '--disable-dev-shm-usage'
  ]
});

async function seedOnce(context) {
  await context.addInitScript(({ key, save }) => {
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
    if (sessionStorage.getItem('paravoxia.ch11-probe-seeded') === '1') return;
    localStorage.setItem(key, JSON.stringify(save));
    sessionStorage.setItem('paravoxia.ch11-probe-seeded', '1');
  }, { key: GLOBAL_KEY, save: initialSave });
}

function watch(page, prefix) {
  page.on('pageerror', error => report.runtimeProblems.push(`${prefix} pageerror: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') report.runtimeProblems.push(`${prefix} console: ${message.text()}`);
  });
}

async function waitForStation(page) {
  await page.waitForFunction(
    () => Boolean(window.__spaceStationState && window.__spaceStationStory && window.__spaceStationTeleportToStoryTarget),
    { timeout: 120_000 }
  );
  await page.waitForFunction(
    () => window.__spaceStationStory?.().receipts?.docked === true,
    { timeout: 60_000 }
  );
}

async function teleportToStoryTarget(page) {
  const id = await page.evaluate(() => window.__spaceStationTeleportToStoryTarget?.() ?? null);
  if (!id) throw new Error('No station story target is available');
  await page.waitForFunction(
    () => Boolean(document.querySelector(
      '[data-testid="spaceStation-registry-prompt"], [data-testid="spaceStation-issuer-prompt"], [data-testid="spaceStation-story-airlock-prompt"]'
    )),
    { timeout: 60_000 }
  );
  return id;
}

try {
  const context = await browser.newContext({ viewport: { width: 960, height: 540 } });
  await seedOnce(context);
  const page = await context.newPage();
  watch(page, 'desktop');
  await page.goto(STATION_URL, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await waitForStation(page);

  const entry = await page.evaluate(() => ({
    mission: window.__spaceStationStory(),
    objective: document.querySelector('[data-testid="spaceStation-story-objective"]')?.textContent?.replace(/\s+/g, ' ').trim(),
    raw: JSON.parse(localStorage.getItem('pvx.v1.global'))
  }));
  report.entry = entry;
  check(
    'story docking enters a durable registry objective',
    entry.mission.step === 'registry'
      && entry.mission.receipts.docked === true
      && /COUNTER · PRESENT DESIGNATION/.test(entry.objective ?? '')
      && entry.raw.milestones.includes('story:ch11-docked'),
    JSON.stringify(entry)
  );

  await teleportToStoryTarget(page);
  await page.keyboard.press('KeyF');
  await page.waitForSelector('[data-testid="spaceStation-registry-panel"]');
  await page.locator('[data-testid="spaceStation-present-suit-record"]').click();
  await page.locator('[data-testid="spaceStation-declare-issued-component"]').click();
  const registry = await page.locator('[data-testid="spaceStation-registry-transcript"]')
    .textContent();
  check(
    'the counter records W-7743 and an issued habitat component without defining wider status',
    /W-7743 · RECORD ACCEPTED/.test(registry ?? '')
      && /BONDED CELL \/ HABITAT GRADE/.test(registry ?? '')
      && !/cleared|wanted|worker 7744|maker/i.test(registry ?? ''),
    registry?.replace(/\s+/g, ' ').trim() ?? null
  );
  await page.locator('[data-testid="spaceStation-registry-continue"]').click();

  // Optional people remain people before the required issuance, but their shelf
  // cannot consume the mission and their conversation cannot advance it.
  const optional = await page.evaluate(() => {
    const vendors = window.__spaceStationVendors?.() ?? [];
    const index = vendors.findIndex(vendor => vendor.designation !== 'B-7073');
    const id = window.__spaceStationTeleportToVendor?.(Math.max(0, index)) ?? null;
    return { index, id, vendor: vendors[Math.max(0, index)] ?? null };
  });
  await page.waitForSelector('[data-testid="spaceStation-interaction-prompt"]');
  await page.keyboard.press('KeyF');
  await page.waitForSelector('[data-testid="spaceStation-vendor-panel"]');
  const hold = await page.locator('[data-testid="spaceStation-vendor-panel"]').textContent();
  check(
    'optional vendors can be spoken to while ordinary trading waits for the issued cell',
    optional.id !== null && /trade held until issued cargo is secured/i.test(hold ?? ''),
    JSON.stringify(optional)
  );
  const topic = page.locator('[data-testid^="spaceStation-vendor-topic-"]').first();
  if (await topic.count()) await topic.click();
  await page.getByRole('button', { name: 'Close vendor panel' }).click();
  check(
    'an optional vendor leaves required progress unchanged',
    (await page.evaluate(() => window.__spaceStationStory().step)) === 'issuer'
  );

  await teleportToStoryTarget(page);
  await page.keyboard.press('KeyF');
  await page.waitForSelector('[data-testid="spaceStation-issuer-panel"]');
  await page.locator('[data-testid="spaceStation-present-habitat-fault"]').click();
  await page.locator('[data-testid="spaceStation-ask-bond"]').click();
  await page.locator('[data-testid="spaceStation-accept-bonded-cell"]').click();
  await page.waitForSelector('[data-testid="spaceStation-bonded-cell-receipt"]');
  const issued = await page.evaluate(() => ({
    mission: window.__spaceStationStory(),
    raw: JSON.parse(localStorage.getItem('pvx.v1.global')),
    receipt: document.querySelector('[data-testid="spaceStation-bonded-cell-receipt"]')?.textContent?.replace(/\s+/g, ' ').trim()
  }));
  report.issued = issued;
  check(
    'Bell issues exactly one real bonded cell and saves it before navigation',
    issued.mission.step === 'depart'
      && issued.mission.itemCount === 1
      && issued.raw.inventory.bonded_cell === 1
      && issued.raw.milestones.includes('story:ch11-bonded-cell-acquired')
      && issued.raw.milestones.includes('story:station-trade-unlocked')
      && /BONDED CELL \(HABITAT\) · SEAL INTACT/.test(issued.receipt ?? ''),
    JSON.stringify(issued)
  );
  check(
    'station saves preserve exact Tidegarden identity and clock',
    issued.raw.lastPlanetWorldId === '-1,-1:p1'
      && issued.raw.lastWorld.x === -1
      && issued.raw.lastWorld.y === -1
      && issued.raw.dayPhase === 0.73,
    JSON.stringify({
      lastPlanetWorldId: issued.raw.lastPlanetWorldId,
      lastWorld: issued.raw.lastWorld,
      dayPhase: issued.raw.dayPhase
    })
  );
  await page.locator('[data-testid="spaceStation-issuer-continue"]').click();

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120_000 });
  await waitForStation(page);
  const reloaded = await page.evaluate(() => ({
    mission: window.__spaceStationStory(),
    objective: document.querySelector('[data-testid="spaceStation-story-objective"]')?.textContent?.replace(/\s+/g, ' ').trim()
  }));
  report.reloaded = reloaded;
  check(
    'reload resumes at departure without duplicating the cell',
    reloaded.mission.step === 'depart'
      && reloaded.mission.itemCount === 1
      && /KESTREL AIRLOCK · STOW THE CELL/.test(reloaded.objective ?? ''),
    JSON.stringify(reloaded)
  );

  await teleportToStoryTarget(page);
  await page.keyboard.press('KeyF');
  await page.waitForSelector('[data-testid="spaceStation-dock-overlay"]');
  await page.keyboard.press('KeyK');
  await page.waitForURL(url => !new URL(url).searchParams.has('spacestation'), { timeout: 120_000 });
  await page.waitForFunction(
    () => window.__paravoxiaAppState?.phase === 'playing'
      && !new URLSearchParams(location.search).has('undock')
      && !new URLSearchParams(location.search).has('fly'),
    { timeout: 120_000 }
  );
  const returned = await page.evaluate(() => ({
    url: location.href,
    raw: JSON.parse(localStorage.getItem('pvx.v1.global')),
    app: window.__paravoxiaAppState
  }));
  report.returned = returned;
  check(
    'stowing and undocking return to the game with cell and departure receipts intact',
    !new URL(returned.url).searchParams.has('undock')
      && !new URL(returned.url).searchParams.has('fly')
      && !new URL(returned.url).searchParams.has('spacestation')
      && returned.app.phase === 'playing'
      && returned.raw.inventory.bonded_cell === 1
      && returned.raw.milestones.includes('story:ch11-bonded-cell-stowed')
      && returned.raw.milestones.includes('story:ch11-station-departed'),
    returned.url
  );
  await page.waitForSelector('[data-objective-id="station:return:tidegarden"]', {
    timeout: 120_000
  });
  const returnObjective = await page.locator('[data-objective-id="station:return:tidegarden"]')
    .textContent();
  report.returnObjective = returnObjective?.replace(/\s+/g, ' ').trim() ?? null;
  check(
    'undocking publishes an explicit return-to-Tidegarden work order',
    /RETURN TO TIDEGARDEN/.test(returnObjective ?? '')
      && /DELIVER THE BONDED CELL TO THE SECOND HEARTH/.test(returnObjective ?? ''),
    report.returnObjective
  );
  await context.close();

  // The actual undock leaves the player in flight. This second context starts
  // from the same durable save after the player has completed that ordinary
  // flight/landing leg, proving the real surface interaction and save receipt.
  const installContext = await browser.newContext({ viewport: { width: 960, height: 540 } });
  await installContext.addInitScript(({ globalKey, save, habitat }) => {
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
    if (sessionStorage.getItem('paravoxia.ch12-install-seeded') === '1') return;
    localStorage.setItem(globalKey, JSON.stringify(save));
    localStorage.setItem('pvx.v1.world.-1,-1:p1', JSON.stringify({
      worldId: '-1,-1:p1',
      seed: 1600321158,
      structures: [],
      campfires: [],
      trees: [],
      stones: [],
      forage: [],
      flora: [],
      habitat
    }));
    localStorage.setItem('pvx.v1.world.-1,-1:p1.player', JSON.stringify({
      pos: [13.5, 50.789, -8],
      forward: [1, 0, 0],
      pitch: 0
    }));
    sessionStorage.setItem('paravoxia.ch12-install-seeded', '1');
  }, { globalKey: GLOBAL_KEY, save: returnSave, habitat: tidegardenHabitat });
  const installPage = await installContext.newPage();
  watch(installPage, 'install');
  await installPage.goto(`${BASE}/?world=-1,-1:p1&profile=POTATO&journeyprobe=1`, {
    waitUntil: 'domcontentloaded',
    timeout: 120_000
  });
  await installPage.waitForSelector('[data-objective-id="hearth:return:install-cell"]', {
    timeout: 120_000
  });
  await installPage.waitForSelector('[data-interaction-id="story-ch12-install-bonded-cell"]', {
    timeout: 120_000
  });
  const installReady = await installPage.evaluate(() => ({
    objective: document.querySelector('[data-objective-id="hearth:return:install-cell"]')
      ?.textContent?.replace(/\s+/g, ' ').trim(),
    prompt: document.querySelector('[data-interaction-id="story-ch12-install-bonded-cell"]')
      ?.textContent?.replace(/\s+/g, ' ').trim()
  }));
  check(
    'the landed return points at the real second hearth and offers installation',
    /DELIVER THE BONDED CELL TO THE SECOND HEARTH/.test(installReady.objective ?? '')
      && /Install the Sealed Bonded Cell/.test(installReady.prompt ?? ''),
    JSON.stringify(installReady)
  );
  await installPage.locator('canvas').first().click({ position: { x: 480, y: 270 } });
  await installPage.waitForFunction(
    () => document.pointerLockElement instanceof HTMLCanvasElement,
    { timeout: 30_000 }
  );
  // Surface input is sampled by the frame loop rather than handled directly on
  // keydown. Hold across painted frames so this remains a trusted player input.
  await installPage.keyboard.down('KeyF');
  await installPage.waitForTimeout(3_000);
  await installPage.keyboard.up('KeyF');
  await installPage.waitForFunction(() => {
    const raw = JSON.parse(localStorage.getItem('pvx.v1.global') ?? 'null');
    return raw
      && (raw.inventory?.bonded_cell ?? 0) === 0
      && raw.milestones?.includes('story:ch12-bonded-cell-installed')
      && raw.milestones?.includes('story:ch12-hearth-restored');
  }, { timeout: 60_000 });
  const installed = await installPage.evaluate(() => ({
    raw: JSON.parse(localStorage.getItem('pvx.v1.global')),
    objective: document.querySelector('[data-objective-id="hearth:return:install-cell"]')?.textContent ?? null,
    prompt: document.querySelector('[data-interaction-id="story-ch12-install-bonded-cell"]')?.textContent ?? null
  }));
  report.installed = installed;
  check(
    'installing consumes exactly one cell and durably restores the second hearth',
    (installed.raw.inventory.bonded_cell ?? 0) === 0
      && installed.raw.milestones.includes('story:ch12-bonded-cell-installed')
      && installed.raw.milestones.includes('story:ch12-hearth-restored')
      && installed.objective === null
      && installed.prompt === null,
    JSON.stringify(installed)
  );
  await installPage.reload({ waitUntil: 'domcontentloaded', timeout: 120_000 });
  await installPage.waitForFunction(
    () => window.__paravoxiaAppState?.sceneReady === true,
    null,
    { timeout: 120_000 }
  );
  const installedReload = await installPage.evaluate(() => ({
    raw: JSON.parse(localStorage.getItem('pvx.v1.global')),
    objective: document.querySelector('[data-objective-id="hearth:return:install-cell"]')?.textContent ?? null,
    prompt: document.querySelector('[data-interaction-id="story-ch12-install-bonded-cell"]')?.textContent ?? null
  }));
  report.installedReload = installedReload;
  check(
    'reload keeps the hearth restored without reissuing or reinstalling the cell',
    (installedReload.raw.inventory.bonded_cell ?? 0) === 0
      && installedReload.raw.milestones.includes('story:ch12-hearth-restored')
      && installedReload.objective === null
      && installedReload.prompt === null,
    JSON.stringify(installedReload)
  );
  await installContext.close();

  const touchContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true
  });
  await seedOnce(touchContext);
  const touchPage = await touchContext.newPage();
  watch(touchPage, 'touch');
  await touchPage.goto(STATION_URL, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await waitForStation(touchPage);
  await teleportToStoryTarget(touchPage);
  await touchPage.locator('[data-testid="touch-action-use"]').tap();
  await touchPage.waitForSelector('[data-testid="spaceStation-registry-panel"]');
  const mobileRect = await touchPage.locator('[data-testid="spaceStation-registry-panel"] > section')
    .evaluate(node => {
      const rect = node.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right };
    });
  check(
    'touch USE opens a registry panel contained by the mobile viewport',
    mobileRect.top >= 0 && mobileRect.left >= 0 && mobileRect.right <= 390 && mobileRect.bottom <= 844,
    JSON.stringify(mobileRect)
  );
  await touchPage.locator('[data-testid="spaceStation-present-suit-record"]').tap();
  await touchPage.locator('[data-testid="spaceStation-declare-issued-component"]').tap();
  await touchPage.locator('[data-testid="spaceStation-registry-continue"]').tap();
  await teleportToStoryTarget(touchPage);
  await touchPage.locator('[data-testid="touch-action-use"]').tap();
  await touchPage.locator('[data-testid="spaceStation-present-habitat-fault"]').tap();
  await touchPage.locator('[data-testid="spaceStation-accept-bonded-cell"]').tap();
  await touchPage.waitForSelector('[data-testid="spaceStation-bonded-cell-receipt"]');
  const touchIssued = await touchPage.evaluate(() => ({
    mission: window.__spaceStationStory(),
    raw: JSON.parse(localStorage.getItem('pvx.v1.global'))
  }));
  report.touch = { mobileRect, issued: touchIssued };
  check(
    'touch completes the same durable issuance path',
    touchIssued.mission.itemCount === 1
      && touchIssued.mission.step === 'depart'
      && touchIssued.raw.inventory.bonded_cell === 1,
    JSON.stringify(touchIssued)
  );
  await touchContext.close();

  const sandboxContext = await browser.newContext({ viewport: { width: 960, height: 540 } });
  const sandboxPage = await sandboxContext.newPage();
  watch(sandboxPage, 'sandbox');
  await sandboxPage.goto(`${BASE}/?spacestation=1&profile=POTATO&dock=0&ai=off`, {
    waitUntil: 'domcontentloaded',
    timeout: 120_000
  });
  await sandboxPage.waitForFunction(() => Boolean(window.__spaceStationState && window.__spaceStationTeleportToVendor));
  const sandbox = await sandboxPage.evaluate(() => ({
    storyHook: typeof window.__spaceStationStory,
    objective: Boolean(document.querySelector('[data-testid="spaceStation-story-objective"]')),
    save: localStorage.getItem('pvx.v1.global'),
    vendor: window.__spaceStationTeleportToVendor?.(0)
  }));
  await sandboxPage.waitForSelector('[data-testid="spaceStation-interaction-prompt"]');
  await sandboxPage.keyboard.press('KeyF');
  await sandboxPage.waitForSelector('[data-testid="spaceStation-vendor-panel"]');
  check(
    'bare station sandbox remains story-free and its ordinary vendor still opens',
    sandbox.storyHook === 'undefined'
      && sandbox.objective === false
      && sandbox.save === null
      && sandbox.vendor !== null,
    JSON.stringify(sandbox)
  );
  await sandboxContext.close();
} catch (error) {
  report.fatal = error instanceof Error ? `${error.stack ?? error.message}` : String(error);
  failures.push('probe completed without a fatal runtime error');
  process.stderr.write(`${report.fatal}\n`);
} finally {
  await browser.close();
  report.status = failures.length === 0 ? 'passed' : 'failed';
  fs.writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
}

process.stdout.write(`evidence: ${OUT}\n`);
if (failures.length > 0) {
  process.stderr.write(`${failures.length} failed check(s): ${failures.join('; ')}\n`);
  process.exit(1);
}
