#!/usr/bin/env node
/**
 * SpaceStation look-development capture harness.
 *
 * Drives the sandbox to a fixed set of vantage points and writes clean frames with
 * the debug HUD hidden and the crowd clock pinned, so two runs of the same build
 * produce comparable images and a visual change is attributable to the change
 * rather than to where the camera happened to be standing.
 *
 * Usage:
 *   node tools/spaceStation-shots.mjs --out <dir> [--url http://localhost:4321] [--label v3]
 *
 * Requires a server already serving the built app (npm run preview) or the dev
 * server. Uses the Playwright chromium in ~/.cache/ms-playwright with SwiftShader,
 * because the repo's own shot tools hardcode a Windows Chrome path.
 */

import { chromium } from 'playwright-core';
import { mkdirSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const OUT = resolve(argValue('out', 'captures/spaceStation/latest'));
const BASE = argValue('url', 'http://localhost:4321');
const LABEL = argValue('label', '');
const WIDTH = Number(argValue('width', '1600'));
const HEIGHT = Number(argValue('height', '900'));

/**
 * Vantage points. `run` is seconds of held forward input from the previous stop,
 * so the sequence walks the station rather than teleporting — which also exercises
 * locomotion and portal culling on every capture run.
 */
const STOPS = [
  { id: '01-dock', cell: 'apron', u: 0.12, note: 'just off the airlock, down the dock spine' },
  { id: '02-dock-mid', cell: 'apron', u: 0.55, note: 'mid dock, cargo both sides' },
  { id: '03-registry', cell: 'counter', u: 0.25, note: 'inside the registry corridor' },
  { id: '04-concourse-entry', cell: 'concourse', u: 0.06, note: 'entering the concourse' },
  { id: '05-concourse-mid', cell: 'concourse', u: 0.45, note: 'mid concourse, stalls both sides' },
  { id: '06-concourse-look', cell: 'concourse', u: 0.45, turn: -Math.PI / 2 + 0.95, note: 'facing a stall row' },
  { id: '06b-concourse-up', cell: 'concourse', u: 0.45, turn: -Math.PI / 2, pitch: 0.34, note: 'up at the canopies' },
  { id: '07-bureau', cell: 'floor', u: 0.18, note: 'the bureaucratic hall' },
  { id: '08-bureau-deep', cell: 'floor', u: 0.55, note: 'deep in the cubicle grid' },
  { id: '09-warehouse', cell: 'shelves', u: 0.3, note: 'racking in the warehouse' }
];

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

// hud=0 for a clean frame, t= to pin the crowd so figures land identically, and
// dock=0 because the arrival owns the camera and would fight every teleport.
await page.goto(`${BASE}/?spaceStation=1&hud=0&t=17.5&dock=0`, { waitUntil: 'networkidle', timeout: 90_000 });
await page.waitForTimeout(4_500);

for (const stop of STOPS) {
  const placed = await page.evaluate(
    ([cell, u, v]) => window.__spaceStationTeleport?.(cell, u, v) ?? false,
    [stop.cell, stop.u ?? 0.5, stop.v ?? 0.5]
  );
  if (!placed) throw new Error(`could not place viewer in cell "${stop.cell}"`);

  await page.evaluate(([yaw, pitch]) => {
    window.__spaceStationLook?.(yaw, pitch);
  }, [stop.turn ?? -Math.PI / 2, stop.pitch ?? 0]);

  // Let the walk state settle to the floor and the light pool reassign.
  await page.waitForTimeout(1_400);

  const name = LABEL ? `${stop.id}-${LABEL}.png` : `${stop.id}.png`;
  await page.screenshot({ path: resolve(OUT, name) });
  const state = await page.evaluate(() => window.__spaceStationState?.() ?? null);
  console.log(`${stop.id.padEnd(20)} ${String(state?.cellId).padEnd(10)} x=${Math.round(state?.position?.[0] ?? 0)}  ${stop.note}`);
}

if (problems.length > 0) {
  console.log(`\n${problems.length} runtime problem(s):`);
  for (const problem of problems.slice(0, 8)) console.log(`  ${problem}`);
}
console.log(`\nwrote ${STOPS.length} frames -> ${OUT}`);

await browser.close();
