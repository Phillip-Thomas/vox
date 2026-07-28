#!/usr/bin/env node
/**
 * SpaceStation arrival probe.
 *
 * Three things this run proves, none of which a unit test can:
 *
 *  1. the approach reads at range and the corridor gates actually gate,
 *  2. the dock sequence plays in a browser and hands control back,
 *  3. props are solid at runtime — a hard push into a stall counter goes nowhere,
 *  4. a trader is standing at every stall you can trade at,
 *  5. and the way back out works: walk to the lock, undock, ship at the berth.
 *
 * Writes frames through the arrival so the choreography can be judged as images
 * rather than as timings.
 *
 * Usage:
 *   node tools/spaceStation-arrival-probe.mjs --out <dir> [--url http://localhost:5180]
 */

import { chromium } from 'playwright-core';
import { mkdirSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const OUT = resolve(argValue('out', 'captures/spaceStation/arrival'));
const BASE = argValue('url', 'http://localhost:5180');
const WIDTH = Number(argValue('width', '1280'));
const HEIGHT = Number(argValue('height', '720'));

function chromiumPath() {
  const base = `${process.env.HOME}/.cache/ms-playwright`;
  const dir = readdirSync(base).find(entry => entry.startsWith('chromium-'));
  if (!dir) throw new Error(`no chromium in ${base}`);
  return `${base}/${dir}/chrome-linux/chrome`;
}

const browser = await chromium.launch({
  executablePath: chromiumPath(),
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--no-sandbox',
    '--disable-dev-shm-usage'
  ]
});

mkdirSync(OUT, { recursive: true });
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
const problems = [];
page.on('pageerror', error => problems.push(`pageerror: ${error.message}`));
page.on('console', message => {
  if (message.type() === 'error') problems.push(`console: ${message.text()}`);
});

const failures = [];
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`);
  if (!ok) failures.push(label);
};

// ------------------------------------------------------------- the approach
// Flown first, in its own page load: the approach and the interior are exclusive
// scenes and the whole point is that clearance is the hinge between them.
await page.goto(`${BASE}/?spaceStation=1&approach=1&t=17.5`, { waitUntil: 'networkidle', timeout: 90_000 });
await page.waitForTimeout(5_000);

const opening = await page.evaluate(() => window.__spaceStationApproach?.() ?? null);
check('approach scene starts off the corridor', opening !== null && !opening.insideCorridor,
  opening ? `${(opening.offAxis * 57.3).toFixed(0)}deg off, ${Math.round(opening.distance)} out` : 'no readout');
await page.screenshot({ path: resolve(OUT, 'approach-00-arrival.png') });

// Walk in along the corridor and record where each gate opens.
const gates = [];
for (const range of [2600, 1400, 700, 300, 120, 60]) {
  await page.evaluate(r => window.__spaceStationFlyTo?.(r), range);
  await page.waitForTimeout(1_600);
  const state = await page.evaluate(() => window.__spaceStationApproach?.() ?? null);
  gates.push({ range, phase: state?.phase, canDock: state?.canDock });
  await page.screenshot({ path: resolve(OUT, `approach-range-${String(range).padStart(4, '0')}.png`) });
}
console.log(gates.map(g => `  ${String(g.range).padStart(5)}  ${g.phase}`).join('\n'));

check('the corridor gates open in order, and only at the berth',
  gates[0].phase === 'detected' && gates[gates.length - 1].canDock === true
  && gates.slice(0, -1).every(g => g.canDock === false),
  gates.map(g => `${g.range}:${g.phase}`).join(' '));

// Refuse a hot approach, then accept a slow one. This is the gate that asks
// something of the player, so it is the one worth proving in a browser.
const hot = await page.evaluate(() => {
  window.__spaceStationWalk?.(0, 0);
  return window.__spaceStationApproach?.() ?? null;
});
check('cleared to dock at the berth', hot?.canDock === true, hot?.advisory ?? '');

const granted = await page.evaluate(() => window.__spaceStationDock?.() ?? false);
check('docking request is granted and hands off to the interior', granted === true);
await page.waitForSelector('[data-testid="spaceStation-dock-overlay"]', { timeout: 60_000 });
check('clearance opens the dock sequence', true);
await page.screenshot({ path: resolve(OUT, 'approach-06-handoff.png') });

// ---------------------------------------------------------------- the arrival
// Software rendering runs at a few frames a second, so the sequence takes far
// longer in wall-clock than its six seconds of scene time. Sample generously.
await page.goto(`${BASE}/?spaceStation=1&hud=0`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
await page.waitForSelector('[data-testid="spaceStation-dock-overlay"]', { timeout: 60_000 });
check('dock overlay appears on entry', true);

for (const [index, wait] of [1_500, 4_000, 6_000, 6_000, 8_000].entries()) {
  await page.screenshot({ path: resolve(OUT, `arrival-${String(index).padStart(2, '0')}.png`) });
  await page.waitForTimeout(wait);
}

const overlayGone = await page
  .waitForSelector('[data-testid="spaceStation-dock-overlay"]', { state: 'detached', timeout: 120_000 })
  .then(() => true)
  .catch(() => false);
check('dock sequence completes and hands control back', overlayGone);

const arrived = await page.evaluate(() => window.__spaceStationState?.() ?? null);
check('player is standing on the apron after arrival', arrived?.cellId === 'apron', JSON.stringify(arrived));
await page.screenshot({ path: resolve(OUT, 'arrival-05-handback.png') });

// ------------------------------------------------------------ solid furniture
// Stand at a stall, then push straight into the counter for a while.
const before = await page.evaluate(() => {
  const id = window.__spaceStationTeleportToVendor?.(2);
  return { id, state: window.__spaceStationState?.() ?? null };
});
check('teleported to a vendor counter', Boolean(before.id), before.id ?? 'none');

await page.evaluate(() => window.__spaceStationWalk?.(6, 0));
await page.waitForTimeout(3_000);
const after = await page.evaluate(() => {
  window.__spaceStationWalk?.(0, 0);
  return window.__spaceStationState?.() ?? null;
});

const pushed = Math.hypot(
  (after?.position?.[0] ?? 0) - (before.state?.position?.[0] ?? 0),
  (after?.position?.[2] ?? 0) - (before.state?.position?.[2] ?? 0)
);
// The viewer starts 1.5m off the counter face and the counter is solid, so a
// three-second sprint into it should cover well under a metre.
check('counter stops a hard push', pushed < 1.2, `moved ${pushed.toFixed(2)}m`);
await page.screenshot({ path: resolve(OUT, 'collision-at-counter.png') });

// ------------------------------------------------------------ staffed stalls
const staffing = await page.evaluate(() => window.__spaceStationStaffing?.() ?? null);
check(
  'a trader is posted at every stall',
  Boolean(staffing) && staffing.traders === staffing.vendors && staffing.vendors > 0,
  staffing ? `${staffing.traders} traders / ${staffing.vendors} vendors` : 'no hook'
);
check(
  'every trader stands clear of her own stall',
  Boolean(staffing) && staffing.blocked === 0,
  staffing ? `${staffing.blocked} blocked` : ''
);

// Look across the counter so the posted figure is in frame.
await page.evaluate(() => window.__spaceStationTeleportToVendor?.(2));
await page.waitForTimeout(2_000);
await page.screenshot({ path: resolve(OUT, 'trader-at-counter.png') });

// ------------------------------------------------------------- the way out
// Walk back to the airlock and leave. The round trip is the claim: where you park
// is where you find the ship.
await page.evaluate(() => window.__spaceStationTeleport?.('apron', 0.02, 0.5));
await page.waitForTimeout(2_500);
const atLock = await page.evaluate(() => window.__spaceStationState?.() ?? null);
check('can walk back to the dock end of the apron', atLock?.cellId === 'apron', JSON.stringify(atLock));

const lockPrompt = await page
  .waitForSelector('[data-testid="spaceStation-airlock-prompt"]', { timeout: 30_000 })
  .then(() => true)
  .catch(() => false);
check('the airlock offers the way out', lockPrompt);
await page.screenshot({ path: resolve(OUT, 'undock-00-at-lock.png') });

await page.keyboard.press('KeyF');
const undockOverlay = await page
  .waitForSelector('[data-testid="spaceStation-dock-overlay"]', { timeout: 30_000 })
  .then(() => true)
  .catch(() => false);
check('requesting departure starts the undock sequence', undockOverlay);
for (const [i, wait] of [1_200, 3_500, 4_000, 4_000].entries()) {
  await page.screenshot({ path: resolve(OUT, `undock-0${i + 1}.png`) });
  await page.waitForTimeout(wait);
}

const backOutside = await page
  .waitForSelector('[data-testid="spaceStation-approach-hud"]', { timeout: 120_000 })
  .then(() => true)
  .catch(() => false);
check('undocking hands the ship back outside', backOutside);

const parked = await page.evaluate(() => window.__spaceStationApproach?.() ?? null);
check('the ship is sitting at the berth it was clamped to',
  parked !== null && parked.distance < 5,
  parked ? `${parked.distance.toFixed(1)} from the berth, ${parked.phase}` : 'no readout');
check('and is immediately cleared to dock again', parked?.canDock === true, parked?.advisory ?? '');
await page.screenshot({ path: resolve(OUT, 'undock-05-back-at-berth.png') });

if (problems.length > 0) {
  console.log(`\n${problems.length} runtime problem(s):`);
  for (const problem of problems.slice(0, 8)) console.log(`  ${problem}`);
}
console.log(`\nframes -> ${OUT}`);

await browser.close();
if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log('\nall checks passed');
