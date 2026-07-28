#!/usr/bin/env node
/**
 * Does the station read at the right size, in the real game, next to a real planet?
 *
 * Loads the shipped app in deep space (?fly=1) rather than the spaceStation sandbox,
 * so the frames show the station lit by the game's own sun, in the game's own post
 * chain, against the game's own sky — which is the only place the sizing question
 * can actually be answered.
 *
 * Usage: node tools/spaceStation-system-probe.mjs --out <dir> [--url http://localhost:5180]
 */
import { chromium } from 'playwright-core';
import { mkdirSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const OUT = resolve(argValue('out', 'captures/spaceStation/system'));
const BASE = argValue('url', 'http://localhost:5180');

function chromiumPath() {
  const base = `${process.env.HOME}/.cache/ms-playwright`;
  const dir = readdirSync(base).find(e => e.startsWith('chromium-'));
  if (!dir) throw new Error(`no chromium in ${base}`);
  return `${base}/${dir}/chrome-linux/chrome`;
}

const browser = await chromium.launch({
  executablePath: chromiumPath(),
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--no-sandbox', '--disable-dev-shm-usage']
});
mkdirSync(OUT, { recursive: true });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
// Software rendering cannot drive the shipped scene at HIGH; the frame budget goes
// entirely to terrain and the post chain and screenshots time out. LOW still proves
// the thing being asked — where the station is and how big it looks.
await page.addInitScript(() => {
  try { window.localStorage.setItem('paravoxia.graphics.profile', 'LOW'); } catch { /* private mode */ }
});
const problems = [];
page.on('pageerror', e => problems.push(`pageerror: ${e.message}`));
page.on('console', m => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });

const failures = [];
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  \u2014 ${detail}` : ''}`);
  if (!ok) failures.push(label);
};

await page.goto(`${BASE}/?fly=1&systemBodies=1&stations=force`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
await page.waitForTimeout(30_000);
await page.screenshot({ path: resolve(OUT, '00-deep-space.png'), timeout: 120_000 });

const contacts = await page.evaluate(() => window.__spaceStationContacts?.() ?? null);
console.log('contacts:', JSON.stringify(contacts));
check('the driver is live in the shipped game', contacts !== null);
check('the system has a station', (contacts?.stations.length ?? 0) > 0,
  contacts ? contacts.stations.map(s => `${s.worldId} @ ${s.distance}`).join(', ') : '');

// Fly at the station. The ship tops out around 320 units/s and the station is
// roughly eight kilometres out, so this is a real trip rather than a teleport —
// which is the point: the probe exercises the same path a player flies.
await page.keyboard.down('ShiftLeft');
for (let i = 0; i < 14; i++) {
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(4_000);
  const now = await page.evaluate(() => window.__spaceStationContacts?.() ?? null);
  const nearest = now?.stations?.[0];
  console.log(`  t+${(i + 1) * 4}s  phase=${now?.phase}  range=${nearest?.distance}  ${nearest?.phase}`);
  await page.screenshot({ path: resolve(OUT, `fly-${String(i).padStart(2, '0')}.png`), timeout: 120_000 });
}
await page.keyboard.up('KeyW');
await page.keyboard.up('ShiftLeft');

const closed = await page.evaluate(() => window.__spaceStationContacts?.() ?? null);
const start = contacts?.stations?.[0]?.distance ?? 0;
const end = closed?.stations?.[0]?.distance ?? 0;
check('the ship actually moved relative to the station', Math.abs(end - start) > 500,
  `${start} -> ${end}`);
const hud = await page.evaluate(() =>
  document.querySelector('[data-testid="spaceStation-approach-hud"]')?.textContent ?? null);
check('station reads on the ship instruments once inside scan range',
  hud !== null || end > 5200,
  hud ? hud.replace(/\s+/g, ' ').slice(0, 80) : `still ${end} out, beyond the 5200 scan range`);
await page.screenshot({ path: resolve(OUT, '99-final.png'), timeout: 120_000 });

if (failures.length) console.error(`\n${failures.length} check(s) failed`);

if (problems.length) {
  console.log(`\n${problems.length} runtime problem(s):`);
  for (const p of problems.slice(0, 10)) console.log(`  ${p}`);
}
console.log(`\nframes -> ${OUT}`);
await browser.close();
