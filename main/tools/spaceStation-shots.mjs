#!/usr/bin/env node
/**
 * SpaceStation look-development capture harness.
 *
 * Drives the sandbox to a fixed set of vantage points and writes clean frames with
 * the debug HUD hidden and the crowd clock pinned, so two runs of the same build
 * produce comparable images and a visual change is attributable to the change
 * rather than to where the camera happened to be standing.
 *
 * After capture it measures every frame — median and mean luma, the percentage of
 * pixels under 16/255 and over 235/255, standard deviation, and a lower-third
 * floor-band median — and asserts the colour script of production run
 * 2026-09-04-station-interior-light: per-vantage targets, the legibility floor, and
 * the monotonic district ordering hall < apron ≤ shelves ≤ counter < concourse.
 * The T-concourse-open strip proves the threshold fill ramp frame-exactly from the
 * lighting component's own diagnostic. Results go to `luma.json` beside the frames.
 *
 * Usage:
 *   node tools/spaceStation-shots.mjs --out <dir> [--url http://127.0.0.1:4321] [--label v3]
 *                                     [--no-assert] [--skip-strip] [--story-url <url>] [--swiftshader]
 *
 * Serves an immutable copy of the existing build by default. An explicit --url
 * must match the local archived dist bytes. Defaults to canonical headed hardware;
 * --swiftshader explicitly selects the signed software numeric-baseline lane. The served
 * page must report the Paravoxia title: a reused port can serve another project
 * with a 200 and a real canvas, and a measurement of that is worth nothing.
 */

import { chromium } from 'playwright-core';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { startParavoxiaPreview, CHROMIUM_ARGS, chromePath, assertHardwareGl } from './lib/previewServer.mjs';
import { assertPreviewBuild } from './lib/previewBuildProof.mjs';
import { captureStationThreshold, validateStationThreshold } from './lib/stationThresholdCapture.mjs';

const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const hasFlag = name => args.includes(`--${name}`);

const SWIFTSHADER = hasFlag('swiftshader');
const OUT = resolve(argValue('out', 'captures/spaceStation/latest'));
const suppliedUrl = argValue('url', '');
const preview = suppliedUrl ? null : await startParavoxiaPreview({ build: false });
const BASE = suppliedUrl || preview.url;
const buildAssets = Object.fromEntries(readdirSync('dist/assets').filter(x => /\.(js|css)$/.test(x)).map(name => [name,
  createHash('sha256').update(readFileSync(`dist/assets/${name}`)).digest('hex')]));
const previewBuildProof = await assertPreviewBuild(BASE, buildAssets);
const LABEL = argValue('label', '');
const WIDTH = Number(argValue('width', '1600'));
const HEIGHT = Number(argValue('height', '900'));
const ASSERT = !hasFlag('no-assert');
const SKIP_STRIP = hasFlag('skip-strip');
/**
 * Optional story-mode URL (a seeded story save is needed for the HUD to exist).
 * When given, the T-concourse-open strip is walked there as well so the low line's
 * presentation delay can be measured alongside the ramp.
 */
const STORY_URL = argValue('story-url', '');

/**
 * Vantage points. The camera's base yaw is -π/2 (looking down +X, deeper into the
 * station); `turn: +π/2` is the declared 180° reversal — the way back.
 */
const STOPS = [
  { id: '01-dock', cell: 'apron', u: 0.12, district: 'apron', note: 'just off the airlock, down the dock spine' },
  { id: '01b-apron-back', cell: 'apron', u: 0.12, turn: Math.PI / 2, district: 'apron', ordering: false, note: '180° back at the unlit Kestrel lock frame' },
  { id: '02-dock-mid', cell: 'apron', u: 0.55, district: 'apron', note: 'mid dock, cargo both sides' },
  { id: '03-registry', cell: 'counter', u: 0.25, district: 'counter', note: 'inside the registry corridor' },
  { id: '03b-counter-exit', cell: 'counter', u: 0.92, district: 'counter', ordering: false, note: 'the concourse portal, warm, from the counter' },
  { id: '04-concourse-entry', cell: 'concourse', u: 0.06, district: 'concourse', note: 'entering the concourse' },
  { id: '05-concourse-mid', cell: 'concourse', u: 0.45, district: 'concourse', note: 'mid concourse, stalls both sides' },
  { id: '06-concourse-look', cell: 'concourse', u: 0.45, turn: -Math.PI / 2 + 0.95, district: 'concourse', note: 'facing a stall row' },
  { id: '06b-concourse-up', cell: 'concourse', u: 0.45, turn: -Math.PI / 2, pitch: 0.34, district: 'concourse-up', ordering: false, note: 'up at the canopies' },
  { id: '07-bureau', cell: 'floor', u: 0.18, district: 'floor', note: 'the bureaucratic hall' },
  { id: '07b-hall-back', cell: 'floor', u: 0.18, turn: Math.PI / 2, district: 'floor', ordering: false, note: '180° back at the concourse portal from the hall' },
  { id: '08-bureau-deep', cell: 'floor', u: 0.55, district: 'floor', note: 'deep in the cubicle grid' },
  { id: '09-warehouse', cell: 'shelves', u: 0.3, district: 'shelves', note: 'racking in the warehouse' }
];

/**
 * The colour script, as contracted (scene-contract draft-v1, evidence.acceptanceCriteria).
 * Median is the ordering metric; the legibility floor is median ≥ 22 and ≤ 35 % under 16.
 */
const TARGETS = {
  floor: { median: [22, 34], mean: [24, 38], under16Max: 35, over235Max: 2 },
  apron: { median: [30, 42], mean: [30, 44], under16Max: 25, over235Max: 3 },
  shelves: { median: [34, 46], mean: [34, 48], under16Max: 25, over235Max: 3 },
  counter: { median: [48, 62], mean: [50, 66], under16Max: 10, over235Max: 4 },
  concourse: { median: [56, 72], mean: [56, 76], under16Max: 12, over235Max: 5 },
  'concourse-up': { median: [30, 255], mean: [30, 255], under16Max: 40, over235Max: 5 }
};
const LEGIBILITY_FLOOR = { medianMin: 22, under16Max: 35 };
const ORDERING_DISTRICTS = ['floor', 'apron', 'shelves', 'counter', 'concourse'];

// --- PNG decode + luma ------------------------------------------------------------
//
// A minimal decoder for what Playwright writes: 8-bit RGB or RGBA, non-interlaced.
// Kept here because the repo carries neither sharp nor pngjs.

function decodePng(buffer) {
  const signature = '\x89PNG\r\n\x1a\n';
  if (buffer.toString('latin1', 0, 8) !== signature) throw new Error('not a PNG');
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  let bitDepth = 0;
  const idat = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('latin1', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      if (data[12] !== 0) throw new Error('interlaced PNG not supported');
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }
  if (bitDepth !== 8) throw new Error(`unsupported bit depth ${bitDepth}`);
  const channels = { 2: 3, 6: 4, 0: 1, 4: 2 }[colorType];
  if (!channels) throw new Error(`unsupported colour type ${colorType}`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const pixels = Buffer.alloc(stride * height);
  let previous = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const out = pixels.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? out[x - channels] : 0;
      const b = previous[x];
      const c = x >= channels ? previous[x - channels] : 0;
      let value = line[x];
      switch (filter) {
        case 0: break;
        case 1: value += a; break;
        case 2: value += b; break;
        case 3: value += (a + b) >> 1; break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          value += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          break;
        }
        default: throw new Error(`bad PNG filter ${filter}`);
      }
      out[x] = value & 0xff;
    }
    previous = out;
  }
  return { width, height, channels, pixels };
}

/** Rec. 709 luma of the encoded (display) values, 0–255, as the eye meets them. */
function lumaMetrics(file) {
  const { width, height, channels, pixels } = decodePng(readFileSync(file));
  const histogram = new Uint32Array(256);
  const floorHistogram = new Uint32Array(256);
  const floorStart = Math.floor((height * 2) / 3);
  let sum = 0;
  let sumSquares = 0;
  const count = width * height;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const luma = Math.round(0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2]);
      histogram[luma]++;
      if (y >= floorStart) floorHistogram[luma]++;
      sum += luma;
      sumSquares += luma * luma;
    }
  }
  const percentile = (hist, total, fraction) => {
    let seen = 0;
    for (let v = 0; v < 256; v++) {
      seen += hist[v];
      if (seen >= total * fraction) return v;
    }
    return 255;
  };
  const under = (hist, limit) => {
    let n = 0;
    for (let v = 0; v < limit; v++) n += hist[v];
    return n;
  };
  const mean = sum / count;
  const variance = sumSquares / count - mean * mean;
  return {
    width,
    height,
    median: percentile(histogram, count, 0.5),
    mean: Number(mean.toFixed(1)),
    stdDev: Number(Math.sqrt(Math.max(0, variance)).toFixed(1)),
    pctUnder16: Number(((under(histogram, 16) / count) * 100).toFixed(1)),
    pctOver235: Number((((count - under(histogram, 236)) / count) * 100).toFixed(1)),
    floorBandMedian: percentile(floorHistogram, width * (height - floorStart), 0.5)
  };
}

// --- browser ------------------------------------------------------------------------

const browser = await chromium.launch({
  executablePath: chromePath(),
  headless: SWIFTSHADER,
  args: SWIFTSHADER ? [...CHROMIUM_ARGS, '--use-angle=swiftshader'] : CHROMIUM_ARGS
});
const renderers = [];

try {
mkdirSync(OUT, { recursive: true });

const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
const problems = [];
page.on('pageerror', error => problems.push(`pageerror: ${error.message}`));
page.on('console', message => {
  if (message.type() === 'error') problems.push(`console: ${message.text()}`);
});

async function openStation(url) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90_000 });
  const title = await page.title();
  if (title !== 'Paravoxia') {
    throw new Error(`identity check failed: ${url} serves "${title}", not Paravoxia — is the port reused?`);
  }
  await page.waitForTimeout(4_500);
  const renderer = SWIFTSHADER ? await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const gl = canvas?.getContext('webgl2') ?? canvas?.getContext('webgl');
    if (!gl) return null;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  }) : await assertHardwareGl(page);
  const software = !renderer || /swiftshader|software|llvmpipe/i.test(renderer);
  if (SWIFTSHADER ? !/swiftshader/i.test(renderer ?? '') : software) {
    throw new Error(`Requested ${SWIFTSHADER ? 'explicit signed SwiftShader numeric lane' : 'headed hardware'}, got ${renderer}`);
  }
  renderers.push({ url, renderer, headed: !SWIFTSHADER, measuredAt: new Date().toISOString() });
}

// hud=0 for a clean frame, t= to pin the crowd so figures land identically, and
// dock=0 because the arrival owns the camera and would fight every teleport.
await openStation(`${BASE}/?spacestation=1&hud=0&t=17.5&dock=0`);

const frames = [];
for (const stop of STOPS) {
  const placed = await page.evaluate(
    ([cell, u, v]) => window.__spaceStationTeleport?.(cell, u, v) ?? false,
    [stop.cell, stop.u ?? 0.5, stop.v ?? 0.5]
  );
  if (!placed) throw new Error(`could not place viewer in cell "${stop.cell}"`);

  await page.evaluate(([yaw, pitch]) => {
    window.__spaceStationLook?.(yaw, pitch);
  }, [stop.turn ?? -Math.PI / 2, stop.pitch ?? 0]);

  // Let the walk state settle to the floor, the light pool reassign, and the
  // threshold ramp (≤ 1.4 s) finish.
  await page.waitForTimeout(1_800);

  await page.waitForFunction(cell => {
    const state = window.__spaceStationState?.();
    const fill = window.__spaceStationFill?.();
    return state?.cellId === cell && fill?.district === cell && fill?.progress === 1;
  }, stop.cell, { timeout: 10_000 });
  // Bound the static PNG with actual rAF state, not a nominal 1.8s assumption.
  // Both sides must show the requested room and its completed fill.
  const sampleFrame = () => page.evaluate(() => new Promise(resolveFrame => {
    requestAnimationFrame(rafTimestamp => {
      const fill = window.__spaceStationFill?.();
      resolveFrame({ timeOrigin: performance.timeOrigin, rafTimestamp, now: performance.now(),
        state: window.__spaceStationState?.() ?? null,
        fill: fill ? { district: fill.district, from: fill.from, progress: fill.progress,
          elapsedSeconds: fill.elapsedSeconds, durationSeconds: fill.durationSeconds,
          frameTimestampMs: fill.frameTimestampMs, crossingTimestampMs: fill.crossingTimestampMs,
          ambientIntensity: fill.ambientIntensity, fogDensity: fill.fogDensity,
          poolSize: fill.poolSize, pooledFittings: fill.pooledFittings,
          unpooledFittings: fill.unpooledFittings } : null });
    });
  }));
  const before = await sampleFrame();
  const name = LABEL ? `${stop.id}-${LABEL}.png` : `${stop.id}.png`;
  const file = resolve(OUT, name);
  await page.screenshot({ path: file });
  const after = await sampleFrame();
  for (const sample of [before, after]) {
    if (sample.state?.cellId !== stop.cell || sample.fill?.district !== stop.cell || sample.fill?.progress !== 1) {
      throw new Error(`${stop.id}: static screenshot did not remain in its completed district fill`);
    }
  }
  const state = after.state;
  const fillState = after.fill;
  const metrics = lumaMetrics(file);
  frames.push({ ...stop, file: name, state, fill: fillState, captureWindow: { before, after }, metrics });
  console.log(
    `${stop.id.padEnd(20)} ${String(state?.cellId).padEnd(10)} x=${String(Math.round(state?.position?.[0] ?? 0)).padStart(4)}  ` +
      `median ${String(metrics.median).padStart(3)}  mean ${String(metrics.mean).padStart(5)}  <16 ${String(metrics.pctUnder16).padStart(5)}%  >235 ${String(metrics.pctOver235).padStart(4)}%  sd ${String(metrics.stdDev).padStart(5)}  ${stop.note}`
  );
}

// --- assertions: targets, legibility floor, ordering -----------------------------

const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
  return ok;
};

for (const frame of frames) {
  const target = TARGETS[frame.district];
  const m = frame.metrics;
  if (frame.ordering !== false && target) {
    check(m.median >= target.median[0] && m.median <= target.median[1], `${frame.id}: median ${m.median} outside ${target.median.join('–')}`);
    check(m.mean >= target.mean[0] && m.mean <= target.mean[1], `${frame.id}: mean ${m.mean} outside ${target.mean.join('–')}`);
    check(m.pctUnder16 <= target.under16Max, `${frame.id}: ${m.pctUnder16}% under 16 exceeds ${target.under16Max}%`);
    check(m.pctOver235 <= target.over235Max, `${frame.id}: ${m.pctOver235}% over 235 exceeds ${target.over235Max}%`);
  } else if (frame.district === 'concourse-up') {
    check(m.median >= target.median[0], `${frame.id}: median ${m.median} below ${target.median[0]}`);
    check(m.pctUnder16 <= target.under16Max, `${frame.id}: ${m.pctUnder16}% under 16 exceeds ${target.under16Max}%`);
  }
  // The legibility floor applies to every entered-district vantage, turn-arounds included.
  if (frame.district !== 'concourse-up') {
    check(m.median >= LEGIBILITY_FLOOR.medianMin, `${frame.id}: median ${m.median} below the legibility floor ${LEGIBILITY_FLOOR.medianMin}`);
    check(m.pctUnder16 <= LEGIBILITY_FLOOR.under16Max, `${frame.id}: ${m.pctUnder16}% under 16 exceeds the legibility floor ${LEGIBILITY_FLOOR.under16Max}%`);
  }
}

const districtStats = {};
for (const district of ORDERING_DISTRICTS) {
  const members = frames.filter(frame => frame.district === district && frame.ordering !== false);
  const avg = key => Number((members.reduce((sum, frame) => sum + frame.metrics[key], 0) / members.length).toFixed(1));
  districtStats[district] = {
    frames: members.map(frame => frame.id),
    median: avg('median'),
    mean: avg('mean'),
    stdDev: avg('stdDev'),
    pctUnder16: avg('pctUnder16')
  };
}
const d = districtStats;
const ordering = [
  ['hall + 6 ≤ apron', d.floor.median + 6 <= d.apron.median],
  ['apron ≤ shelves', d.apron.median <= d.shelves.median],
  ['shelves ≤ counter', d.shelves.median <= d.counter.median],
  ['counter ≤ concourse − 6', d.counter.median <= d.concourse.median - 6],
  ['concourse is the maximum', ORDERING_DISTRICTS.every(k => d[k].median <= d.concourse.median)],
  ['hall is the minimum', ORDERING_DISTRICTS.every(k => d[k].median >= d.floor.median)],
  ['counter has the lowest std-dev', ORDERING_DISTRICTS.every(k => d.counter.stdDev <= d[k].stdDev)],
  ['counter has the lowest % under 16', ORDERING_DISTRICTS.every(k => d.counter.pctUnder16 <= d[k].pctUnder16)]
];
console.log('\nordering (district medians: ' + ORDERING_DISTRICTS.map(k => `${k} ${d[k].median}`).join(', ') + ')');
for (const [label, ok] of ordering) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`);
  check(ok, `ordering: ${label}`);
}
// These numeric bands were signed against SwiftShader at DPR1. Retain their
// calculation on hardware as a comparison, but never treat it as satisfaction
// (or rejection) of the separate software-bound numeric gate.
const numericFailures = failures.slice();
if (!SWIFTSHADER) failures.length = 0;

// --- T-concourse-open strip -----------------------------------------------------------

async function walkConcourseStrip(tag) {
  const placed = await page.evaluate(() => window.__spaceStationTeleport?.('counter', 0.96, 0.5) ?? false);
  if (!placed) throw new Error('could not place the strip start in the counter');
  await page.evaluate(() => window.__spaceStationLook?.(-Math.PI / 2, 0));
  await page.waitForTimeout(1_800);

  const record = await captureStationThreshold(page);
  const strip = { tag, ...record, assertions: [] };
  for (const frame of strip.frames) {
    const label = frame.requestedOffsetSeconds < 0 ? 'pre' : `p${frame.requestedOffsetSeconds.toFixed(1).replace('.', '_')}`;
    const name = `T-concourse-open-${label}${LABEL ? `-${LABEL}` : ''}-${tag}.png`;
    if (typeof frame.png !== 'string' || !frame.png.startsWith('data:image/png;base64,')) {
      check(false, `${tag} strip: rendered canvas capture failed at ${frame.offsetSeconds}s: ${JSON.stringify(frame.png)}`);
      delete frame.png;
      continue;
    }
    const file = resolve(OUT, name);
    writeFileSync(file, Buffer.from(frame.png.split(',')[1], 'base64'));
    delete frame.png;
    frame.file = name;
    frame.metrics = lumaMetrics(file);
    check(frame.metrics.mean > 0, `${tag} strip: captured canvas is not empty at ${frame.offsetSeconds}s`);
  }
  for (const failure of validateStationThreshold(strip, { requireLowLine: tag === 'story' })) {
    strip.assertions.push({ ok: false, message: failure });
    check(false, `${tag} strip: ${failure}`);
  }
  const at14 = strip.frames.find(frame => frame.requestedOffsetSeconds === 1.4);
  const target = TARGETS.concourse;
  strip.concourseLumaAt14 = { applicableSignedLane: SWIFTSHADER,
    target: target.median, actual: at14?.metrics?.median ?? null,
    insideBand: at14?.metrics?.median >= target.median[0] && at14.metrics.median <= target.median[1] };
  if (SWIFTSHADER) check(strip.concourseLumaAt14.insideBand,
    `${tag} strip: concourse median inside ${target.median.join('–')} on actual +1.4-second frame (got ${at14?.metrics?.median} at ${at14?.offsetSeconds}s)`);
  // Composite HUD screenshot is context only. Exact timing evidence above comes
  // from actual rAF canvas snapshots and computed DOM opacity on those frames.
  strip.contextFile = `T-concourse-open-settled-context-${tag}.png`;
  await page.screenshot({ path: resolve(OUT, strip.contextFile) });
  strip.contextCapturedAt = await page.evaluate(() => performance.now());
  console.log(`\nT-concourse-open (${tag}): ${strip.samples.length} actual rAF samples`);
  for (const frame of strip.frames) {
    console.log(`  requested ${frame.requestedOffsetSeconds}s, actual ${frame.offsetSeconds.toFixed(3)}s: progress ${frame.progress}, median ${frame.metrics?.median}, low line ${frame.lowLineOpacity}`);
  }

  return strip;
}

const strips = [];
if (!SKIP_STRIP) {
  for (const tag of STORY_URL ? ['sandbox', 'story'] : ['sandbox']) {
    try {
      if (tag === 'story') await openStation(STORY_URL);
      strips.push(await walkConcourseStrip(tag));
    } catch (error) {
      const message = String(error?.stack ?? error);
      strips.push({ tag, error: message });
      check(false, `${tag} strip capture failed: ${message}`);
    }
  }
}

// --- report ---------------------------------------------------------------------------

writeFileSync(
  resolve(OUT, 'luma.json'),
  JSON.stringify(
    {
      schema: 'paravoxia.stationLuma.v1',
      url: BASE,
      identity: 'Paravoxia',
      previewBuildProof, buildAssets, buildHash: preview?.buildHash ?? null,
      viewport: `${WIDTH}x${HEIGHT}`,
      renderers,
      captureLane: SWIFTSHADER ? 'explicit signed SwiftShader numeric baseline lane' : 'headed ANGLE hardware candidate; software-baseline equivalence is not claimed',
      headed: !SWIFTSHADER,
      signedNumericGate: { applicable: SWIFTSHADER, passed: SWIFTSHADER ? numericFailures.length === 0 : null,
        referenceFailures: numericFailures,
        note: 'Per-vantage and ordering gate only; threshold timing/luma and all other gates remain separate.' },
      capturedAt: new Date().toISOString(),
      targets: TARGETS,
      legibilityFloor: LEGIBILITY_FLOOR,
      frames: frames.map(({ file, id, cell, u, turn, pitch, district, ordering, note, state, fill, captureWindow, metrics }) => ({
        id, file, cell, u, turn: turn ?? -Math.PI / 2, pitch: pitch ?? 0, district, inOrdering: ordering !== false, note, state, fill, captureWindow, metrics
      })),
      districts: districtStats,
      ordering: ordering.map(([label, ok]) => ({ label, ok })),
      strips,
      failures,
      problems
    },
    null,
    2
  )
);

if (problems.length > 0) {
  console.log(`\n${problems.length} runtime problem(s):`);
  for (const problem of problems.slice(0, 8)) console.log(`  ${problem}`);
}
console.log(`\nwrote ${frames.length} frames + luma.json -> ${OUT}`);
if (failures.length > 0) {
  console.log(`\n${failures.length} assertion failure(s):`);
  for (const failure of failures) console.log(`  FAIL  ${failure}`);
}

if (ASSERT && (failures.length > 0 || problems.length > 0)) process.exitCode = 1;
} finally {
  await browser.close();
  preview?.stop();
}
