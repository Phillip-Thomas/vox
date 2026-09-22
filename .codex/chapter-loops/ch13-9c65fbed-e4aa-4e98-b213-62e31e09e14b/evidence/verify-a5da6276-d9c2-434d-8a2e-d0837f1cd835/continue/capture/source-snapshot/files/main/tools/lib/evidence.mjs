// --- The shared evidence library -----------------------------------------------------
//
// Every capability the run-specific probes under .codex/production-runs/ each
// carried once — the HUD-suppressed twin, the trigger-driven strip with a
// before-frame buffer, story-clock targets and burst windows, the pixel stats,
// the contact sheet — lives here once, and the output is a percept
// `capture-bundle-v1` directory the judge lane consumes unchanged.
//
// Laws this module enforces:
//   * The browser is HEADED on the real GPU by default (assertHardwareGl from
//     ./previewServer.mjs refuses a software renderer). PARAVOXIA_ALLOW_SWIFTSHADER=1
//     is the deliberate software lane, and the bundle says so in capture.tier.
//   * Every frame is shot twice at the same instant: the HUD composite to hud/
//     (audit only) and the HUD-suppressed twin to frames/ — the frame of record.
//     Reviewers and pixel laws read the twin; nobody grades a debug overlay.
//   * Bursts are measured, not looked at: consecutive frames reduce to flicker
//     scalars in the manifest and the digest, and burst frames stay out of the
//     sheet and the commission.
//   * The sheet's red numbers are the manifest frame indices a verdict cites.
//   * State is read through the bridges a PRODUCTION build installs
//     (window.__storyBeat, __paravoxiaJourneyProbe with ?journeyprobe=1,
//     __paravoxiaBoundaryState, __autopilot in movie mode, __game with ?agent=1)
//     and the DOM. Nothing here fetches /src/*.tsx — that only worked on the
//     dev server, which no longer starts on this machine (ENOSPC).
//
// Story time: there is no steppable sim clock. In movie mode `__autopilot.clock`
// is the beat clock (seconds since beat entry) and is recorded as `simTime`;
// otherwise `simTime` is wall seconds since the page settled, and
// `capture.clock` in the bundle says which. Milestone latches and beat changes
// are the repeatable landmarks; timestamps are measurements, not addresses.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import { startParavoxiaPreview, assertHardwareGl, chromePath, CHROMIUM_ARGS } from './previewServer.mjs';
import { readPng, lum } from './pixel-laws.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const PERCEPT_DIR = process.env.PERCEPT_DIR ?? resolve(HERE, '..', '..', '..', '..', 'percept');

export const SWIFTSHADER = process.env.PARAVOXIA_ALLOW_SWIFTSHADER === '1';
export const CAPTURE_TIER = SWIFTSHADER ? 'swiftshader-low' : 'hardware-high';
export const DEFAULT_VIEWPORT = { width: 1280, height: 720 };

export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------------ browser ---
/**
 * Serve Paravoxia (identity-checked), launch the capture browser and open one
 * page. Headed real GPU unless PARAVOXIA_ALLOW_SWIFTSHADER=1. Returns the
 * renderer string so every artifact can record what drew it.
 */
export async function openParavoxia({
  url = '/', preview = null, build = true, viewport = DEFAULT_VIEWPORT, deviceScaleFactor = 1,
  reducedMotion = 'no-preference', isMobile = false, initScript = null, log = console.log,
  gotoTimeoutMs = 180_000, recordVideo = null,
} = {}) {
  const served = preview ?? await startParavoxiaPreview({ build, log });
  if (!SWIFTSHADER && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) process.env.DISPLAY = ':0';
  const args = SWIFTSHADER
    ? [...CHROMIUM_ARGS, `--window-size=${viewport.width},${viewport.height}`]
    : [...CHROMIUM_ARGS.filter((a) => a !== '--enable-unsafe-swiftshader'), '--enable-gpu', '--use-angle=gl',
      `--window-size=${viewport.width},${viewport.height}`];
  const browser = await chromium.launch({ executablePath: chromePath(), headless: SWIFTSHADER, args });
  const context = await browser.newContext({ viewport, deviceScaleFactor, reducedMotion, isMobile, hasTouch: isMobile,
    ...(recordVideo ? { recordVideo: { dir: recordVideo.dir, size: recordVideo.size ?? viewport } } : {}) });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 200)));
  if (initScript) await context.addInitScript(initScript);
  const full = new URL(url, served.url).toString();
  await page.goto(full, { waitUntil: 'load', timeout: gotoTimeoutMs });
  const renderer = await assertHardwareGl(page, log);
  const stop = async () => {
    await browser.close().catch(() => {});
    if (!preview) served.stop();
  };
  return { browser, context, page, renderer, headed: !SWIFTSHADER, tier: CAPTURE_TIER, viewport, url: full, pageErrors, preview: served, stop };
}

/** Wait until the story runtime is up: a canvas, a beat mirror, and (with ?agent=1) `__game.ready()`. */
export async function waitReady(page, { timeoutMs = 120_000, settleMs = 0 } = {}) {
  await page.waitForFunction(
    () => !!document.querySelector('canvas') && ('__storyBeat' in window || !!window.__game),
    null, { timeout: timeoutMs },
  );
  const hasGame = await page.evaluate(() => !!window.__game);
  if (hasGame) await page.evaluate(() => window.__game.ready());
  if (settleMs) await sleep(settleMs);
}

// -------------------------------------------------------------------- state ---
/** runs in the page: one state record from the production bridges and the DOM. */
function pageReadState() {
  const w = window;
  const hud = document.querySelector('[data-story-guidance-hud]');
  const feed = document.querySelector('aside[aria-label="Current story objective"]');
  const caption = document.querySelector('[data-story-caption]');
  const qp = new URLSearchParams(location.search);
  const text = (el) => (el ? el.innerText.replace(/\s*\n\s*/g, ' | ').trim() : null);
  const out = {
    href: location.href,
    lane: qp.get('movie') === '1' ? 'movie' : 'manual',
    urlStory: qp.get('story'),
    wallMs: Math.round(performance.now()),
    beat: w.__storyBeat ?? null,
    objectiveId: hud?.getAttribute('data-objective-id') ?? null,
    markerLabel: hud?.getAttribute('data-objective-marker-label') ?? null,
    health: hud?.getAttribute('data-objective-health') ?? null,
    hudText: text(hud),
    feedText: text(feed),
    caption: caption ? caption.innerText.trim() : null,
    interactionPrompts: [...document.querySelectorAll('[data-interaction-prompt="primary"]')].map(text),
  };
  const ap = w.__autopilot;
  if (ap) {
    out.autopilot = { beat: ap.beat, clock: ap.clock, pos: ap.pos, stillTime: ap.stillTime,
      teleportNudgesTotal: ap.teleportNudgesTotal, routeAction: ap.routeAction ?? null };
  }
  try {
    const snap = w.__paravoxiaJourneyProbe?.snapshot?.();
    if (snap) {
      out.story = snap.story;
      out.objective = snap.objective ? { id: snap.objective.id, health: snap.objective.health, kind: snap.objective.kind ?? null } : null;
      out.milestones = snap.state?.localActor?.milestones ?? null;
      out.av = snap.state?.signedSceneAv ?? null;
      out.spaceFlight = snap.state?.spaceFlight ? { phase: snap.state.spaceFlight.phase, controlMode: snap.state.spaceFlight.controlMode } : null;
      const sf = snap.state?.systemFlight;
      if (sf) {
        out.system = { activePlanetId: sf.activePlanetId ?? null, locationMode: sf.locationMode ?? null,
          pos: (sf.pose?.position ?? []).map((n) => Math.round(n)),
          speed: Math.round(Math.hypot(...(sf.pose?.velocity ?? [0, 0, 0])) * 100) / 100 };
      }
    }
  } catch (e) { out.journeyProbeError = String(e).slice(0, 120); }
  try { const b = w.__paravoxiaBoundaryState; if (b) out.boundary = { durable: b.durable ?? null, beat: b.beat ?? null }; } catch { /* read-only */ }
  try { const av = w.__paravoxiaSceneAv; if (av && !out.av) out.av = typeof av === 'function' ? av() : av; } catch { /* read-only */ }
  try { if (w.__game?.metrics) out.metrics = w.__game.metrics(); } catch { /* read-only */ }
  out.contacts = w.__spaceStationContacts ? w.__spaceStationContacts() : null;
  return out;
}

export const readState = (page) => page.evaluate(pageReadState);

// --------------------------------------------------------- HUD twin doctrine ---
// visibility:hidden is inherited but overridable by any descendant rule, and
// several HUD layers set their own. An !important stylesheet rule that spares
// only the canvas and its ancestor chain cannot be overridden by a
// non-important declaration anywhere in the overlay.
function pageHideUi() {
  const canvas = document.querySelector('canvas');
  if (!canvas) return 0;
  let n = 0;
  for (let el = canvas; el; el = el.parentElement) { el.setAttribute('data-vox-keep', '1'); n++; }
  const style = document.createElement('style');
  style.id = 'vox-hide-ui';
  style.textContent = 'body *:not([data-vox-keep]) { visibility: hidden !important; } canvas { visibility: visible !important; }';
  document.head.appendChild(style);
  return n;
}
function pageShowUi() {
  document.getElementById('vox-hide-ui')?.remove();
  for (const el of document.querySelectorAll('[data-vox-keep]')) el.removeAttribute('data-vox-keep');
  return true;
}
function pageUiRects() {
  return [...document.querySelectorAll('body *')]
    .filter((e) => e.tagName !== 'CANVAS' && e.children.length === 0)
    .map((e) => { const r = e.getBoundingClientRect();
      return (r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0)
        ? { tag: e.tagName, text: (e.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 48),
          rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] } : null; })
    .filter(Boolean);
}
export const hideUi = (page) => page.evaluate(pageHideUi);
export const showUi = (page) => page.evaluate(pageShowUi);
export const uiRects = (page) => page.evaluate(pageUiRects);

// -------------------------------------------------------------- frame stats ---
/** Luma statistics of a PNG buffer, on the percept `stats` vocabulary. */
export function frameStats(pngBytes) {
  const { w, h, rgb } = readPng(pngBytes);
  const n = w * h;
  let sum = 0, sumSq = 0, max = 0, bright = 0, clipped = 0, black = 0, satW = 0, sumW = 0;
  for (let i = 0; i < n; i++) {
    const r = rgb[i * 3], g = rgb[i * 3 + 1], b = rgb[i * 3 + 2];
    const L = lum(r, g, b) / 255;
    sum += L; sumSq += L * L; if (L > max) max = L;
    if (L > 0.12) bright++;
    if (r >= 254 || g >= 254 || b >= 254) clipped++;
    if (L < 0.02) black++;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx > 0) { satW += (mx - mn) / mx * L; sumW += L; }
  }
  const mean = sum / n;
  const contrast = Math.sqrt(Math.max(0, sumSq / n - mean * mean));
  return {
    drawCalls: null,
    brightRatio: Number((bright / n).toFixed(4)),
    meanLuma: Number(mean.toFixed(4)),
    maxLuma: Number(max.toFixed(4)),
    contrast: Number(contrast.toFixed(4)),
    clipped: Number((clipped / n).toFixed(5)),
    nearBlack: Number((black / n).toFixed(4)),
    colorfulness: sumW > 1e-6 ? Number((satW / sumW).toFixed(4)) : 0,
    // the blank verdict frame-defect-scan.mjs used (std < 2/255) or a near-dark frame
    blank: contrast < 2 / 255 || max < 0.12,
    meanLuma255: Number((mean * 255).toFixed(2)),
  };
}

// ------------------------------------------------------------- burst scalars ---
// Ported from Paraform's judge-capture.mjs. Consecutive frames reduce to
// per-pixel luma deltas at 320x180: smooth motion accumulates (adjacent delta
// ~ net drift per frame, flickerRatio ~ 1); oscillation cancels (large
// adjacent deltas, near-zero net, flickerRatio >> 1, signFlips -> 0.5).
function pageBurstReset() { window.__voxBurst = { first: null, prev: null, prevDelta: null }; }
async function pageBurstStep(b64) {
  const W = 320; const H = 180; const MOVE = 0.02;
  const blob = await (await fetch('data:image/png;base64,' + b64)).blob();
  const bmp = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(W, H);
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(bmp, 0, 0, W, H);
  const d = g.getImageData(0, 0, W, H).data;
  const luma = new Float32Array(W * H);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) luma[p] = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
  const s = window.__voxBurst;
  if (!s.first) { s.first = luma; s.prev = luma; s.prevDelta = null; return { first: true }; }
  const n = luma.length; const delta = new Float32Array(n);
  let sum = 0, changed = 0, flips = 0, flipDenom = 0, vsFirstSum = 0;
  for (let p = 0; p < n; p++) {
    const dl = luma[p] - s.prev[p]; delta[p] = dl; const a = Math.abs(dl);
    sum += a; if (a > MOVE) changed++;
    if (s.prevDelta) { const pd = s.prevDelta[p]; if (Math.abs(pd) > MOVE && a > MOVE) { flipDenom++; if (pd * dl < 0) flips++; } }
    vsFirstSum += Math.abs(luma[p] - s.first[p]);
  }
  s.prev = luma; s.prevDelta = delta;
  return { adjDelta: sum / n, changedRatio: changed / n, signFlipRatio: flipDenom ? flips / flipDenom : null, vsFirst: vsFirstSum / n };
}
export const burstReset = (page) => page.evaluate(pageBurstReset);
export const burstStep = (page, pngBytes) => page.evaluate(pageBurstStep, pngBytes.toString('base64'));

/** Finalize one burst's samples into the scalars the digest prints. */
export function summarizeBurst(range, samples, dtMs) {
  const pairs = samples.filter((s) => !s.first);
  if (pairs.length < 2) return null;
  const avg = (v) => v.reduce((a, b) => a + b, 0) / v.length;
  const meanAdjDelta = avg(pairs.map((s) => s.adjDelta));
  const netDeltaPerFrame = pairs[pairs.length - 1].vsFirst / pairs.length;
  const flips = pairs.map((s) => s.signFlipRatio).filter((v) => v != null);
  return {
    t0: Number(range.t0.toFixed(3)), frameStart: range.frameStart, frameEnd: range.frameEnd,
    frames: range.frameIdx, dtMs: Number(dtMs.toFixed(1)),
    meanAdjDelta: Number(meanAdjDelta.toFixed(5)),
    netDeltaPerFrame: Number(netDeltaPerFrame.toFixed(5)),
    flickerRatio: Number((meanAdjDelta / Math.max(netDeltaPerFrame, 1e-4)).toFixed(2)),
    signFlipRatio: flips.length ? Number(avg(flips).toFixed(3)) : null,
    changedRatio: Number(avg(pairs.map((s) => s.changedRatio)).toFixed(3)),
    // luminance pop — frame-defect-scan.mjs's |Δmean| > 40 on the 0..255 scale
    pops: pairs.filter((s) => s.pop === true).length,
  };
}

// ----------------------------------------------------------- capture session ---
/**
 * Shoot one page for a while. Every frame is a twin (hud/ + frames/), stamped
 * with the state read BEFORE the shutter opened.
 *
 *   targets   [{ id, at }]           story-clock seconds; shot once when reached
 *   bursts    [{ from, to }]         story-clock windows shot every loop pass
 *   triggers  [{ key, pred(state), before, after, delay, onlyAfter }]  in order
 *   events    [{ key, pred(state) }]     unordered; each fires once, shot as a trigger frame
 *   onState(state, clock, addBurst(from, to, id))  may return 'stop'
 *   stripIntervalS                   coverage floor (0 disables)
 *   stills    [{ id, settleMs }]     long-settle heroes taken first, in order
 *   capMs / stopWhen(state)          end conditions
 */
export async function captureSession(page, dir, opts = {}) {
  const {
    targets = [], bursts = [], triggers = [], events = [], stripIntervalS = 4, stills = [],
    capMs = 120_000, stopWhen = null, onState = null, startIndex = 0, pollMs = 150, log = console.log,
  } = opts;
  mkdirSync(join(dir, 'frames'), { recursive: true });
  mkdirSync(join(dir, 'hud'), { recursive: true });
  const frames = [];
  const burstRecords = [];
  let index = startIndex;
  const t0 = Date.now();
  // the autopilot beat clock restarts at every beat entry; keep simTime monotone
  // by carrying the previous beat's span forward as an offset
  let clockOffset = opts.clockOffset ?? 0; let lastRaw = null; let maxRaw = 0;
  const clockOf = (state) => {
    if (state.autopilot?.clock == null) return (Date.now() - t0) / 1000;
    const raw = Number(state.autopilot.clock);
    if (lastRaw != null && raw < lastRaw - 0.5) { clockOffset += maxRaw; maxRaw = 0; }
    lastRaw = raw; maxRaw = Math.max(maxRaw, raw);
    return clockOffset + raw;
  };
  const beatClockOf = (state) => (state.autopilot?.clock != null ? Number(state.autopilot.clock) : null);
  const clockKind = (state) => (state.autopilot?.clock != null ? 'autopilot-beat-clock' : 'wall-since-settle');

  const shoot = async (role, label, state, { burstRange = null, pngOverride = null } = {}) => {
    const t = clockOf(state);
    const name = `f${String(index).padStart(4, '0')}_t${t.toFixed(2)}s_${label}.png`;
    const hudPng = pngOverride ?? await page.screenshot();
    await hideUi(page);
    const twinPng = await page.screenshot();
    await showUi(page);
    writeFileSync(join(dir, 'hud', name), hudPng);
    writeFileSync(join(dir, 'frames', name), twinPng);
    const stats = frameStats(twinPng);
    const rec = {
      index, file: `frames/${name}`, hudFile: `hud/${name}`, role, label,
      frame: index, simTime: Number(t.toFixed(3)), clock: clockKind(state),
      beat: state.beat ?? null, objectiveId: state.objectiveId ?? null, caption: state.caption ?? null,
      anchorId: state.av?.anchorId ?? null, milestones: state.milestones?.length ?? null,
      sha256: sha256(twinPng), hudSha256: sha256(hudPng), stats,
      stateReadOrder: 'state-before-shutter',
    };
    if (burstRange) {
      const sample = await burstStep(page, twinPng);
      if (!sample.first && burstRange.samples.length) {
        const prevMean = burstRange.samples[burstRange.samples.length - 1].mean255;
        sample.pop = Math.abs(stats.meanLuma255 - prevMean) > 40;
      }
      sample.mean255 = stats.meanLuma255;
      burstRange.samples.push(sample);
      burstRange.frameIdx.push(index);
      burstRange.lastWall = Date.now();
    }
    frames.push(rec);
    index++;
    log?.(`  [${name}] ${role} beat=${rec.beat} clock=${rec.clock} blank=${stats.blank}`);
    return rec;
  };

  // hero stills first: long settles, then the twin
  for (const still of stills) {
    if (still.settleMs) await sleep(still.settleMs);
    const state = await readState(page);
    await shoot(still.role ?? 'still', still.id, state);
  }

  const pending = targets.map((x) => ({ ...x, taken: false }));
  const mkWindow = (b) => ({ ...b, active: false, samples: [], frameIdx: [], t0: b.from, firstWall: null, lastWall: null });
  const windows = bursts.map(mkWindow);
  const addBurst = (from, to, id) => { windows.push(mkWindow({ from, to, id })); };
  const fired = new Set();
  const deadline = Date.now() + capMs;
  let lastStrip = -1e9;
  let ti = 0;
  let prevShot = null; let prevState = null;

  while (Date.now() < deadline) {
    const state = await readState(page).catch(() => null);
    if (!state) { await sleep(pollMs); continue; }
    const clock = clockOf(state);
    if (onState) { const r = onState(state, clock, addBurst); if (r === 'stop') break; }

    // unordered one-shot events (milestone latches, anchor activations, caption changes)
    let firedNow = false;
    for (const ev of events) {
      if (fired.has(ev.key)) continue;
      let hit = false;
      try { hit = !!ev.pred(state, clock); } catch { hit = false; }
      if (!hit) continue;
      fired.add(ev.key);
      await shoot('trigger', ev.key, state);
      firedNow = true;
      break;
    }
    if (firedNow) continue;

    // ordered triggers, with the retroactive before-frame
    const trig = triggers[ti];
    if (trig) {
      if (trig.delay) {
        await sleep(trig.delay);
        const s = await readState(page);
        await shoot('trigger', trig.key, s);
        ti++; prevShot = null; prevState = null;
        continue;
      }
      if (trig.pred(state, clock)) {
        if (trig.before && prevShot) {
          await shoot('trigger', `${trig.key}-before`, prevState, { pngOverride: prevShot });
        }
        if (!trig.onlyAfter) await shoot('trigger', trig.before ? `${trig.key}-at` : trig.key, state);
        if (trig.after) {
          await sleep(trig.after);
          const s2 = await readState(page);
          await shoot('trigger', trig.onlyAfter ? trig.key : `${trig.key}-after`, s2);
        }
        ti++; prevShot = null; prevState = null;
        continue;
      }
    }

    const due = pending.find((x) => !x.taken && clock >= x.at);
    const beatClock = beatClockOf(state) ?? clock;
    // a per-beat window that has run past its end on this beat is finished for this beat
    for (const w of windows) if (w.perBeat && w.active && w.activeBeat === state.beat && beatClock > w.to) w.doneForBeat = state.beat;
    const win = windows.find((w) => (w.perBeat ? beatClock : clock) >= w.from && (w.perBeat ? beatClock : clock) <= w.to && !(w.perBeat && w.doneForBeat === state.beat));
    if (due) {
      due.taken = true;
      await shoot('keyframe', due.id, state);
    } else if (win) {
      if (!win.active || (win.perBeat && win.activeBeat !== state.beat)) {
        if (win.active && win.samples.length >= 3) { const done = summarizeBurst(win, win.samples, win.lastWall && win.firstWall ? (win.lastWall - win.firstWall) / Math.max(1, win.samples.length - 1) : 0); if (done) burstRecords.push({ ...done, beat: win.activeBeat }); }
        win.active = true; win.activeBeat = state.beat; win.frameStart = index; win.firstWall = Date.now(); win.samples = []; win.frameIdx = []; win.t0 = clock; await burstReset(page);
      }
      await shoot('burst', `burst-${win.id ?? Math.round(win.from)}`, state, { burstRange: win });
      win.frameEnd = index - 1;
      lastStrip = clock;
    } else if (stripIntervalS > 0 && clock - lastStrip >= stripIntervalS) {
      lastStrip = clock;
      await shoot('temporal', 'strip', state);
    } else {
      // keep a before-frame for the next trigger without writing it
      if (trig?.before) { prevShot = await page.screenshot(); prevState = state; }
      await sleep(pollMs);
    }
    if (stopWhen && stopWhen(state, clock)) break;
    if (ti >= triggers.length && pending.every((x) => x.taken) && windows.every((w) => clock > w.to) && stripIntervalS === 0) break;
  }

  for (const w of windows) {
    if (w.samples.length < 3) continue;
    const dtMs = w.lastWall && w.firstWall && w.samples.length > 1 ? (w.lastWall - w.firstWall) / (w.samples.length - 1) : 0;
    const rec = summarizeBurst(w, w.samples, dtMs);
    if (rec) burstRecords.push({ ...rec, beat: w.activeBeat ?? null });
  }
  return {
    frames, bursts: burstRecords, nextIndex: index, clockOffset: clockOffset + maxRaw,
    unmetTargets: pending.filter((x) => !x.taken).map((x) => x.id),
    completedTriggers: ti, allTriggersHit: ti === triggers.length,
  };
}

// ----------------------------------------------------------------- the sheet ---
/** runs in the page: chronological tiles, timestamp+beat top-left, red frame index bottom-right. */
async function pageComposeSheet({ tiles, meta }) {
  const cols = Math.ceil(Math.sqrt(tiles.length));
  const rows = Math.ceil(tiles.length / cols);
  const M = 8; const HEADER = 34;
  const W = cols * (meta.tileW + M) + M;
  const H = HEADER + rows * (meta.tileH + M) + M;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d');
  g.fillStyle = '#101018'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#cfd4ff'; g.font = '16px monospace';
  g.fillText(`${meta.title}  ${tiles.length} moments, chronological — red number = frame index`, M, 22);
  for (let i = 0; i < tiles.length; i++) {
    const img = new Image();
    img.src = 'data:image/png;base64,' + tiles[i].png;
    await img.decode();
    const cx = M + (i % cols) * (meta.tileW + M);
    const cy = HEADER + M + Math.floor(i / cols) * (meta.tileH + M);
    g.drawImage(img, cx, cy, meta.tileW, meta.tileH);
    g.font = '13px monospace';
    const label = `t=${tiles[i].t.toFixed(2)}s ${tiles[i].label ?? ''}`.trim();
    g.fillStyle = 'rgba(0,0,0,0.65)'; g.fillRect(cx + 4, cy + 4, g.measureText(label).width + 10, 19);
    g.fillStyle = '#ffffff'; g.fillText(label, cx + 9, cy + 18);
    // NumPro: red, bottom-right, modest — bigger or centered hurts
    g.font = 'bold 26px monospace';
    const idx = String(tiles[i].idx);
    const iw = g.measureText(idx).width;
    g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(cx + meta.tileW - iw - 16, cy + meta.tileH - 32, iw + 12, 28);
    g.fillStyle = '#ff3b30'; g.fillText(idx, cx + meta.tileW - iw - 10, cy + meta.tileH - 10);
  }
  return canvas.toDataURL('image/png').split(',')[1];
}

/** Compose sheet.png from the frames of record (never burst or strip frames). */
export async function composeSheet(page, dir, frames, { title = 'paravoxia', tileW = 480, tileH = 270 } = {}) {
  const tiles = frames
    .filter((f) => f.role !== 'burst' && f.role !== 'temporal' && !f.stats?.blank)
    .map((f) => ({ png: readFileSync(join(dir, f.file)).toString('base64'), t: f.simTime, label: [f.beat, f.label].filter(Boolean).join(' '), idx: f.index }));
  if (!tiles.length) return null;
  const b64 = await page.evaluate(pageComposeSheet, { tiles, meta: { title, tileW, tileH } });
  const bytes = Buffer.from(b64, 'base64');
  writeFileSync(join(dir, 'sheet.png'), bytes);
  return { file: 'sheet.png', tileW, tileH, tiles: tiles.length, sha256: sha256(bytes) };
}

// ---------------------------------------------------------------- the digest ---
/** digest.md — the text channel: beat timeline, milestones, captions, bursts. */
export function writeDigest(dir, { subject, capture, frames, bursts, sessions = [] }) {
  const L = [];
  L.push(`# digest — ${subject.id}`, '');
  L.push('All timing, order, frequency and causality questions are answered HERE; frames are for shape, color, composition, light.', '');
  L.push(`Capture: ${capture.tier} (${capture.adapter}), ${capture.headed ? 'headed' : 'headless'}, ${capture.resolution.w}x${capture.resolution.h}, clock=${capture.clock}, build=${capture.buildSha ?? 'n/a'}`, '');
  L.push('## Beat timeline (story clock, seconds)');
  let lastBeat = null;
  for (const f of frames) {
    if (f.beat !== lastBeat) { L.push(`- t=${f.simTime.toFixed(2)}s beat=${f.beat ?? 'null'} (frame ${f.index})`); lastBeat = f.beat; }
  }
  L.push('', '## Objective / caption changes');
  let lastObj = null, lastCap = null;
  for (const f of frames) {
    if (f.objectiveId !== lastObj) { L.push(`- t=${f.simTime.toFixed(2)}s objective=${f.objectiveId ?? 'none'} (frame ${f.index})`); lastObj = f.objectiveId; }
    if (f.caption !== lastCap && f.caption) { L.push(`- t=${f.simTime.toFixed(2)}s caption="${f.caption.slice(0, 80)}" (frame ${f.index})`); lastCap = f.caption; }
  }
  L.push('', '## Signed-AV anchors');
  let lastAnchor = null;
  for (const f of frames) if (f.anchorId !== lastAnchor) { L.push(`- t=${f.simTime.toFixed(2)}s anchor=${f.anchorId ?? 'none'} (frame ${f.index})`); lastAnchor = f.anchorId; }
  L.push('', `## Frames: ${frames.length} (${frames.filter((f) => f.stats?.blank).length} blank)`);
  L.push('Captured-frame telemetry (idx | t | role | label | beat | meanLuma | blank):');
  for (const f of frames) L.push(`  ${f.index} | ${f.simTime.toFixed(2)} | ${f.role} | ${f.label} | ${f.beat ?? 'null'} | ${f.stats.meanLuma} | ${f.stats.blank}`);
  L.push('', '## Adjacent-frame bursts (consecutive frames at the capture cadence, at declared hotspots)');
  if (!bursts.length) L.push('(no bursts captured — flicker and frame-to-frame smoothness are UNMEASURED; do not assume smooth)');
  L.push('Smooth motion: adjacent delta ~ net drift per frame (flickerRatio near 1). Oscillation/flicker: large adjacent deltas that cancel (high ratio + high signFlips).');
  for (const b of bursts) {
    const klass = b.flickerRatio > 2.5 && (b.signFlipRatio ?? 0) > 0.4 ? 'FLICKER' : b.flickerRatio > 2.5 || (b.signFlipRatio ?? 0) > 0.4 ? 'suspect' : 'smooth';
    L.push(`BURST @t=${b.t0.toFixed(2)}s (frames ${b.frameStart}-${b.frameEnd}, ${b.dtMs.toFixed(0)}ms apart): meanAdjDelta=${b.meanAdjDelta.toFixed(4)} netPerFrame=${b.netDeltaPerFrame.toFixed(4)} flickerRatio=${b.flickerRatio.toFixed(1)} signFlips=${b.signFlipRatio == null ? 'n/a' : b.signFlipRatio.toFixed(2)} changed=${b.changedRatio.toFixed(2)} pops=${b.pops} → ${klass}`);
  }
  for (const s of sessions) if (s.note) L.push('', `## ${s.id}`, s.note);
  const text = L.join('\n') + '\n';
  writeFileSync(join(dir, 'digest.md'), text);
  return { file: 'digest.md', sha256: sha256(text) };
}

// -------------------------------------------------------------- media probe ---
/** ffprobe a file into exactly the shape creative-triad-gate.mjs probeMedia() records. */
export function probeMedia(filePath) {
  const result = spawnSync('ffprobe', ['-v', 'error',
    '-show_entries', 'format=format_name,duration:stream=codec_type,codec_name,width,height,sample_rate,channels',
    '-of', 'json', filePath], { encoding: 'utf8' });
  if (result.status !== 0) return null;
  let parsed;
  try { parsed = JSON.parse(result.stdout); } catch { return null; }
  const video = (parsed.streams || []).find((st) => st.codec_type === 'video');
  const audio = (parsed.streams || []).find((st) => st.codec_type === 'audio');
  const duration = Number(parsed.format?.duration);
  return {
    formatName: parsed.format?.format_name || 'unknown',
    durationSeconds: Number.isFinite(duration) ? Number(duration.toFixed(3)) : 0,
    video: video ? { codec: video.codec_name, width: video.width, height: video.height } : null,
    audio: audio ? { codec: audio.codec_name, sampleRate: Number(audio.sample_rate), channels: audio.channels } : null,
  };
}

// ---------------------------------------------------------------- the bundle ---
let perceptBundle = null;
async function loadPercept() {
  if (perceptBundle) return perceptBundle;
  const p = join(PERCEPT_DIR, 'core', 'bundle.mjs');
  if (!existsSync(p)) throw new Error(`percept not found at ${PERCEPT_DIR} (set PERCEPT_DIR)`);
  perceptBundle = await import(pathToFileURL(p).href);
  return perceptBundle;
}

/** Write bundle.json (percept capture-bundle-v1) and validate it against the files on disk. */
export async function writeBundle(dir, { subject, capture, frames, bursts = [], sheet = null, digest = null, provenance = {} }) {
  const { canonicalBundleSha256, validateBundle } = await loadPercept();
  const manifest = {
    schema: 'capture-bundle-v1',
    subject: { id: subject.id, kind: subject.kind ?? 'paravoxia-chapter', prompt: subject.prompt ?? null },
    capture: {
      lane: 'external',
      tier: capture.tier, adapter: capture.adapter, headed: capture.headed,
      resolution: capture.resolution, seed: String(capture.seed ?? 'default'),
      deterministic: false, motionRequired: true, clock: capture.clock,
      buildSha: capture.buildSha ?? null, viewport: capture.viewport ?? null,
      loop: { looping: false, periodSeconds: null },
    },
    build: { compileOk: true, runtimeOk: true },
    frames: frames.map((f) => ({
      file: f.file,
      // percept's role vocabulary is temporal|keyframe|boot|seam-pre|seam-post|burst; stills and
      // trigger frames are the keyframes here, and the vox role rides beside for the digest
      role: f.role === 'still' || f.role === 'trigger' ? 'keyframe' : f.role, voxRole: f.role,
      ...(f.label && f.role !== 'temporal' ? { label: f.label } : {}),
      frame: f.frame, simTime: f.simTime, salience: f.role === 'still' || f.role === 'keyframe' || f.role === 'trigger' ? 1 : f.role === 'temporal' ? 0.5 : 0,
      sha256: f.sha256, stats: f.stats, beat: f.beat, hudFile: f.hudFile,
    })).sort((a, b) => a.frame - b.frame),
    ...(bursts.length ? { bursts } : {}),
    ...(sheet ? { sheet } : {}),
    ...(digest ? { digest } : {}),
    provenance: { generator: 'paravoxia-chapter-evidence@v1', generatedAt: new Date().toISOString(), ...provenance },
  };
  // percept requires non-decreasing simTime; sort by frame index already does when the clock is monotone,
  // but a wall clock that reset between sessions must not break the contract
  let last = -Infinity;
  for (const f of manifest.frames) { if (f.simTime < last) f.simTime = last; last = f.simTime; }
  manifest.provenance.bundleSha256 = canonicalBundleSha256(manifest);
  writeFileSync(join(dir, 'bundle.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  const validity = validateBundle(manifest, { baseDir: dir });
  if (!validity.ok) throw new Error(`bundle invalid: ${validity.detail}`);
  return manifest;
}
