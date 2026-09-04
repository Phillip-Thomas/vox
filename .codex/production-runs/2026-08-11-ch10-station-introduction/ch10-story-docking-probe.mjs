#!/usr/bin/env node
/**
 * Browser proof for the owner-reported Chapter 10 docking fence.
 *
 * This accelerates only the long physical approach by placing the real story
 * ship on the real claimed station's final. It then waits for the shipped
 * StoryDirector hand-back, uses a trusted KeyF event, crosses the production
 * page-navigation seam, and proves both arrival and departure.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const { chromium } = await import(
  '/home/thomasphillip/Projects/vox/main/node_modules/playwright-core/index.mjs'
);

const RUN_DIR = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(RUN_DIR, 'evidence', 'verification', 'ch10-story-docking-post-repair.json');
const BASE = process.env.VOX_BASE ?? 'http://127.0.0.1:5176';
const pwDir = path.join(os.homedir(), '.cache/ms-playwright');
const chromeDir = fs.readdirSync(pwDir).filter(name => /^chromium-\d+$/.test(name)).sort().pop();
if (!chromeDir) throw new Error(`No Playwright Chromium install found in ${pwDir}`);

const report = {
  schema: 'paravoxia.ch10StoryDockingProbe.v1',
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
const flush = () => fs.writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);

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

try {
  const context = await browser.newContext({ viewport: { width: 960, height: 540 } });
  const page = await context.newPage();
  page.on('pageerror', error => report.runtimeProblems.push(`pageerror: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') report.runtimeProblems.push(`console: ${message.text()}`);
  });

  const storyUrl = `${BASE}/?story=ch10-transit&profile=POTATO&systemprobe=1&journeyprobe=1&fly=1`;
  await page.goto(storyUrl, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.waitForFunction(
    () => Boolean(window.__paravoxiaJourneyProbe && window.__paravoxiaShipProbe),
    { timeout: 120_000 }
  );
  // App first mounts a cheap default world while the chapter's deterministic
  // terrain is prepared. Do not mistake that transient controller (world 0,0)
  // for the Chapter 10 ship; wait until the story system and active planet own
  // the pose-writer lease.
  await page.waitForFunction(async () => {
    const story = await import('/src/story/emergentStoryDirector.ts');
    const stars = await import('/src/game/starSystem.ts');
    const body = story.chapter10ClaimedStationBody();
    if (!body) return false;
    const runtime = window.__paravoxiaJourneyProbe?.snapshot();
    const snapshot = runtime?.state?.systemFlight;
    if (!snapshot || runtime?.state?.spaceFlight?.phase !== 'deep_space') return false;
    const manifest = stars.buildStarSystemManifest(body.address.system);
    return snapshot.systemId === `${body.address.system.x},${body.address.system.y}`
      && manifest.planets.some(candidate => candidate.worldId === snapshot.activePlanetId)
      && Boolean(window.__paravoxiaShipProbe);
  }, { timeout: 180_000 });

  const before = await page.evaluate(() => {
    const snapshot = window.__paravoxiaJourneyProbe.snapshot();
    return {
      story: snapshot.story,
      milestones: snapshot.state.localActor.milestones,
      prompt: document.querySelector('[data-testid="spaceStation-dock-prompt"]')?.textContent?.trim() ?? null
    };
  });
  check(
    'the transit starts fenced before the threshold hand-back',
    before.story.active === true
      && before.story.chapter === 'ch10'
      && before.story.beat === 'ch10-transit'
      && !before.milestones.includes('story:station-docking-authorized')
      && before.prompt === null,
    JSON.stringify(before)
  );

  // `fly=1` enters the real flight controller without waiting for the surface
  // launch. Place that controller on the claimed station's final. No story
  // receipt is injected: the director still has to observe the seam, resolve,
  // hold, and perform its own threshold hand-back.
  const placement = await page.evaluate(async () => {
    const story = await import('/src/story/emergentStoryDirector.ts');
    const approach = await import('/src/game/spaceStation/spaceStationApproach.ts');
    const stars = await import('/src/game/starSystem.ts');
    const body = story.chapter10ClaimedStationBody();
    if (!body) throw new Error('Chapter 10 has no claimed station body');
    const runtime = window.__paravoxiaJourneyProbe.snapshot();
    const snapshot = runtime.state.systemFlight;
    const manifest = stars.buildStarSystemManifest(body.address.system);
    const planet = manifest.planets.find(candidate => candidate.worldId === snapshot.activePlanetId);
    if (!planet) throw new Error(`Active planet ${snapshot.activePlanetId} is absent from story manifest`);
    const hold = approach.approachHold(body, 60);
    const local = hold.map((value, index) => value - planet.systemPosition[index]);
    window.__paravoxiaShipProbe.setLocalPosition(local[0], local[1], local[2]);
    return {
      address: body.address,
      worldId: body.worldId,
      activePlanetId: snapshot.activePlanetId,
      hold,
      local
    };
  });
  report.placement = placement;

  await page.waitForFunction(() => {
    const snapshot = window.__paravoxiaJourneyProbe?.snapshot();
    const milestones = snapshot?.state?.localActor?.milestones ?? [];
    const station = window.__spaceStationContacts?.().stations?.[0];
    const prompt = document.querySelector('[data-testid="spaceStation-dock-prompt"]');
    return snapshot?.story?.active === false
      && snapshot?.story?.chapter === 'complete'
      && milestones.includes('story:ch10-complete')
      && milestones.includes('story:station-docking-authorized')
      && station?.canDock === true
      && Boolean(prompt);
  }, { timeout: 120_000 });

  const cleared = await page.evaluate(() => {
    const snapshot = window.__paravoxiaJourneyProbe.snapshot();
    const contacts = window.__spaceStationContacts();
    const prompt = document.querySelector('[data-testid="spaceStation-dock-prompt"]');
    const cockpit = document.querySelector('[data-testid="cockpit-readout"]');
    return {
      story: snapshot.story,
      milestones: snapshot.state.localActor.milestones,
      contact: contacts.stations[0],
      prompt: prompt?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
      genericApproachHudCount: document.querySelectorAll('[data-testid="spaceStation-approach-hud"]').length,
      cockpitApproach: cockpit?.getAttribute('data-station-approach') ?? null,
      cockpitText: cockpit?.textContent?.replace(/\s+/g, ' ').trim() ?? null
    };
  });
  report.cleared = cleared;
  check(
    'Chapter 10 hand-back publishes the normal clearance prompt',
    cleared.story.active === false
      && cleared.story.chapter === 'complete'
      && cleared.milestones.includes('story:station-docking-authorized')
      && cleared.contact.phase === 'cleared'
      && cleared.contact.canDock === true
      && cleared.genericApproachHudCount === 0
      && cleared.cockpitApproach === 'integrated'
      && /clearance available.*range.*60 u.*alignment.*on corridor.*closing.*0 \/ 34/i.test(cleared.cockpitText ?? '')
      && /\[F\].*request docking clearance/i.test(cleared.prompt ?? ''),
    JSON.stringify(cleared)
  );

  await page.keyboard.press('KeyF');
  await page.waitForURL(url => new URL(url).searchParams.has('spacestation'), { timeout: 120_000 });
  const stationEntryUrl = new URL(page.url());
  report.stationEntryUrl = stationEntryUrl.toString();
  const scrubbedKeys = ['story', 'movie', 'journeyprobe', 'systemprobe', 'agent', 'world', 'descent', 'fly', 'undock', 'keep'];
  check(
    'trusted KeyF enters the claimed station without replaying the debug story',
    stationEntryUrl.searchParams.get('spacestation')
      === `${placement.address.system.x},${placement.address.system.y},${placement.address.index}`
      && stationEntryUrl.searchParams.get('from') === 'game'
      && scrubbedKeys.every(key => !stationEntryUrl.searchParams.has(key)),
    stationEntryUrl.search
  );

  await page.waitForSelector('[data-testid="spaceStation-dock-overlay"]', { timeout: 120_000 });
  check('station entry starts the shipped docking choreography', true);
  await page.keyboard.press('KeyK');
  await page.waitForSelector('[data-testid="spaceStation-dock-overlay"]', {
    state: 'detached',
    timeout: 120_000
  });
  await page.waitForFunction(() => window.__spaceStationState?.().cellId === 'apron', { timeout: 60_000 });
  const interior = await page.evaluate(() => window.__spaceStationState());
  report.interior = interior;
  check('docking hands the player to the station apron', interior.cellId === 'apron', JSON.stringify(interior));

  // Exercise the inverse page seam too. This catches the historical camel-case
  // query deletion bug that trapped a story arrival inside the sandbox forever.
  const teleported = await page.evaluate(() => window.__spaceStationTeleport?.('apron', 0.02, 0.5) ?? false);
  check('the station airlock remains reachable after story docking', teleported === true);
  await page.waitForSelector('[data-testid="spaceStation-airlock-prompt"]', { timeout: 60_000 });
  await page.keyboard.press('KeyF');
  await page.waitForSelector('[data-testid="spaceStation-dock-overlay"]', { timeout: 60_000 });
  await page.keyboard.press('KeyK');
  await page.waitForURL(url => new URL(url).searchParams.get('fly') === '1', { timeout: 120_000 });

  const returnUrl = new URL(page.url());
  report.returnUrl = returnUrl.toString();
  check(
    'undocking returns to the game instead of reopening the station sandbox',
    returnUrl.searchParams.get('fly') === '1'
      && returnUrl.searchParams.has('undock')
      && !returnUrl.searchParams.has('spacestation')
      && !returnUrl.searchParams.has('story'),
    returnUrl.search
  );

  await page.waitForSelector('[data-testid="spaceStation-dock-prompt"]', { timeout: 120_000 });
  const restored = await page.evaluate(async () => {
    const flags = await import('/src/game/spaceStation/spaceStationDevFlag.ts');
    const story = await import('/src/story/storyState.ts');
    const progression = await import('/src/game/systems/progressionSystem.ts');
    return {
      dockingAuthorized: flags.spaceStationDockingAuthorized(),
      entry: story.storyEntryPoint(),
      milestones: progression.getMilestones(),
      prompt: document.querySelector('[data-testid="spaceStation-dock-prompt"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? null
    };
  });
  report.restored = restored;
  check(
    'the completed save still offers docking after the full station round trip',
    restored.dockingAuthorized === true
      && restored.entry.chapter === 'complete'
      && restored.entry.beat === 'done'
      && restored.milestones.includes('story:ch10-complete')
      && restored.milestones.includes('story:station-docking-authorized')
      && /\[F\].*request docking clearance/i.test(restored.prompt ?? ''),
    JSON.stringify(restored)
  );

  await context.close();

  // The contracted mobile-POTATO variant uses the same story route. Prove the
  // actual touch labels and synthesized-key buttons across the page seam so a
  // player cannot LAND into an interior that has no way back out.
  const touchContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true
  });
  const touchPage = await touchContext.newPage();
  touchPage.on('pageerror', error => report.runtimeProblems.push(`touch pageerror: ${error.message}`));
  touchPage.on('console', message => {
    if (message.type() === 'error') report.runtimeProblems.push(`touch console: ${message.text()}`);
  });
  await touchPage.goto(storyUrl, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await touchPage.waitForFunction(
    () => Boolean(window.__paravoxiaJourneyProbe && window.__paravoxiaShipProbe),
    { timeout: 120_000 }
  );
  await touchPage.waitForFunction(async () => {
    const story = await import('/src/story/emergentStoryDirector.ts');
    const stars = await import('/src/game/starSystem.ts');
    const body = story.chapter10ClaimedStationBody();
    const runtime = window.__paravoxiaJourneyProbe?.snapshot();
    const snapshot = runtime?.state?.systemFlight;
    if (!body || !snapshot || runtime?.state?.spaceFlight?.phase !== 'deep_space') return false;
    const manifest = stars.buildStarSystemManifest(body.address.system);
    return snapshot.systemId === `${body.address.system.x},${body.address.system.y}`
      && manifest.planets.some(candidate => candidate.worldId === snapshot.activePlanetId);
  }, { timeout: 180_000 });
  const touchPlacement = await touchPage.evaluate(async () => {
    const story = await import('/src/story/emergentStoryDirector.ts');
    const approach = await import('/src/game/spaceStation/spaceStationApproach.ts');
    const stars = await import('/src/game/starSystem.ts');
    const body = story.chapter10ClaimedStationBody();
    if (!body) throw new Error('Touch run has no claimed station body');
    const snapshot = window.__paravoxiaJourneyProbe.snapshot().state.systemFlight;
    const manifest = stars.buildStarSystemManifest(body.address.system);
    const planet = manifest.planets.find(candidate => candidate.worldId === snapshot.activePlanetId);
    if (!planet) throw new Error(`Touch run active planet ${snapshot.activePlanetId} is absent`);
    const hold = approach.approachHold(body, 60);
    const local = hold.map((value, index) => value - planet.systemPosition[index]);
    window.__paravoxiaShipProbe.setLocalPosition(local[0], local[1], local[2]);
    return { address: body.address, local };
  });
  await touchPage.waitForFunction(() => {
    const prompt = document.querySelector('[data-testid="spaceStation-dock-prompt"]');
    return /LAND.*request docking clearance/i.test(prompt?.textContent ?? '')
      && Boolean(document.querySelector('[data-testid="touch-action-land"]'));
  }, { timeout: 120_000 });
  const touchClearance = await touchPage.evaluate(() => {
    const rect = selector => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const box = node.getBoundingClientRect();
      return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
    };
    const panel = rect('[data-testid="cockpit-readout"]');
    const actions = rect('[data-testid="touch-action-cluster"]');
    const systemsMenu = rect('[aria-label="Open systems menu"]');
    const overlaps = (a, b) => Boolean(a && b
      && a.left < b.right && a.right > b.left
      && a.top < b.bottom && a.bottom > b.top);
    return {
      prompt: document.querySelector('[data-testid="spaceStation-dock-prompt"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
      genericApproachHudCount: document.querySelectorAll('[data-testid="spaceStation-approach-hud"]').length,
      cockpitApproach: document.querySelector('[data-testid="cockpit-readout"]')?.getAttribute('data-station-approach') ?? null,
      panel,
      actions,
      systemsMenu,
      overlapsActions: overlaps(panel, actions),
      overlapsSystemsMenu: overlaps(panel, systemsMenu)
    };
  });
  report.touch = { placement: touchPlacement, clearance: touchClearance };
  check(
    'touch clearance names LAND and keeps its instrument clear of the action cluster',
    /LAND.*request docking clearance/i.test(touchClearance.prompt ?? '')
      && touchClearance.genericApproachHudCount === 0
      && touchClearance.cockpitApproach === 'integrated'
      && touchClearance.panel !== null
      && touchClearance.overlapsActions === false
      && touchClearance.overlapsSystemsMenu === false,
    JSON.stringify(touchClearance)
  );

  await touchPage.locator('[data-testid="touch-action-land"]').tap();
  await touchPage.waitForURL(url => new URL(url).searchParams.has('spacestation'), { timeout: 120_000 });
  await touchPage.waitForSelector('[data-testid="spaceStation-dock-overlay"]', { timeout: 120_000 });
  await touchPage.locator('[data-testid="spaceStation-dock-overlay"]').tap({ position: { x: 20, y: 20 } });
  await touchPage.waitForSelector('[data-testid="spaceStation-dock-overlay"]', {
    state: 'detached',
    timeout: 180_000
  });
  await touchPage.waitForFunction(
    () => window.__spaceStationState?.().cellId === 'apron'
      && Boolean(document.querySelector('[data-testid="touch-joystick"]'))
      && Boolean(document.querySelector('[data-testid="touch-action-use"]')),
    { timeout: 60_000 }
  );
  check('touch LAND and tap-to-skip reach an explorable interior with movement and USE controls', true);

  await touchPage.evaluate(() => window.__spaceStationTeleport?.('apron', 0.02, 0.5));
  await touchPage.waitForFunction(() => {
    const prompt = document.querySelector('[data-testid="spaceStation-airlock-prompt"]');
    return /USE.*return to ship/i.test(prompt?.textContent ?? '');
  }, { timeout: 60_000 });
  const touchAirlockPrompt = await touchPage
    .locator('[data-testid="spaceStation-airlock-prompt"]')
    .textContent();
  await touchPage.locator('[data-testid="touch-action-use"]').tap();
  await touchPage.waitForSelector('[data-testid="spaceStation-dock-overlay"]', { timeout: 60_000 });
  await touchPage.locator('[data-testid="spaceStation-dock-overlay"]').tap({ position: { x: 20, y: 20 } });
  await touchPage.waitForURL(url => new URL(url).searchParams.get('fly') === '1', { timeout: 120_000 });
  report.touch.airlockPrompt = touchAirlockPrompt?.replace(/\s+/g, ' ').trim() ?? null;
  check(
    'touch USE and tap-to-skip return the player to the ship',
    /USE.*return to ship/i.test(report.touch.airlockPrompt ?? '')
      && new URL(touchPage.url()).searchParams.get('fly') === '1',
    report.touch.airlockPrompt
  );
  await touchContext.close();
} catch (error) {
  report.fatal = error instanceof Error ? `${error.stack ?? error.message}` : String(error);
  failures.push('probe completed without a fatal runtime error');
  process.stderr.write(`${report.fatal}\n`);
} finally {
  await browser.close();
  report.status = failures.length === 0 ? 'passed' : 'failed';
  flush();
}

process.stdout.write(`evidence: ${OUT}\n`);
if (failures.length > 0) {
  process.stderr.write(`${failures.length} failed check(s): ${failures.join('; ')}\n`);
  process.exit(1);
}
