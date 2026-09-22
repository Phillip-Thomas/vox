#!/usr/bin/env node
/**
 * Shipped-visual baseline probe for run 2026-09-04-audio-10x.
 *
 * Read-only. Captures a before/at/after still strip around each of the eleven
 * shipped `scoreHit(...)` call sites named in story-intent.md section 2, from
 * the shipped `?story=<beat>&movie=1` dev flows on the canonical preview
 * server (127.0.0.1:5212). No game source is modified.
 *
 * Hit detection uses only shipped runtime bridges:
 *   - `window.__storyBeat`          (beat transitions: the hit IS the transition)
 *   - `window.__voxSfxDiag()`       (co-fired SFX edge: storyAwaken/shipCrash/storyGlitch)
 *   - `window.__paravoxiaSceneAv`   (signed-scene anchor id, ch5-maw)
 *   - beat-entry elapsed time       (a3 bloom wave: no co-fired SFX exists)
 *
 * Usage: node baseline-hit-probe.mjs [--only <anchorId,...>]
 */

import { createRequire } from 'node:module';
const require_ = createRequire('/home/thomasphillip/Projects/vox/main/');
const { chromium } = require_('playwright-core');
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(HERE, 'captures', 'baseline');
const BASE_URL = process.env.PARAVOXIA_URL ?? 'http://127.0.0.1:5212/';
const CHROME = process.env.CHROME_PATH
  ?? '/home/thomasphillip/.cache/ms-playwright/chromium-1217/chrome-linux/chrome';
const PROFILE = process.env.PARAVOXIA_PROFILE ?? 'LOW';
const VIEWPORT = { width: 1280, height: 720 };
// The repo's usual `--enable-unsafe-swiftshader` flag set forces software
// rasterization on this box (~0.3 fps at 1280x720, screenshots ~12 s). ANGLE/GL
// resolves the real NVIDIA GB10. Renderer string is recorded in the trace.
const CHROME_ARGS = ['--no-sandbox', '--disable-dev-shm-usage', '--ignore-gpu-blocklist', '--enable-webgl', '--use-gl=angle', '--use-angle=gl', '--enable-gpu-rasterization'];
const POLL_MS = 220;
const PRE_ROLL_MS = 900;   // rolling "before" frame is at most this stale
const AFTER_MS = 1300;

const only = (() => {
  const i = process.argv.indexOf('--only');
  return i >= 0 ? new Set(process.argv[i + 1].split(',')) : null;
})();

/** One session may harvest several hits. */
const SESSIONS = [
  {
    id: 'ch1-track',
    entryBeat: 'ch1-fixed',
    hits: [{
      id: 'hit-01-ch1-track-unbolt',
      site: 'main/src/story/storyDirector.ts:846',
      timbre: 'bloom',
      beat: 'ch1-track',
      trigger: { type: 'beat', value: 'ch1-track' },
      note: 'ch1-track entry: the frame unbolts and learns to follow the worker.'
    }],
    timeoutMs: 240_000
  },
  {
    id: 'a1-ramp',
    entryBeat: 'a1-ramp',
    hits: [{
      id: 'hit-02-a1-ramp-color-landing',
      site: 'main/src/story/storyDirector.ts:1233',
      timbre: 'bloom',
      beat: 'a1-ramp',
      trigger: { type: 'beat', value: 'ch2-color' },
      note: 'a1-ramp lands EXACTLY on the color preset; chroma landing and stage cut.'
    }],
    timeoutMs: 180_000
  },
  {
    id: 'a2-awakening',
    entryBeat: 'a2-awakening',
    hits: [
      {
        id: 'hit-03-a2-liberation-braam',
        site: 'main/src/story/storyDirector.ts:1292',
        timbre: 'braam',
        beat: 'a2-awakening',
        trigger: { type: 'sfx', value: 'storyAwaken' },
        note: 'liberation start: the wall of the feed gives way (t~3.5s after a2 entry).'
      },
      {
        id: 'hit-04-a2-handoff-bloom',
        site: 'main/src/story/storyDirector.ts:1314',
        timbre: 'bloom',
        beat: 'a2-awakening',
        trigger: { type: 'beat', value: 'ch3-gather' },
        note: 'a2 handoff: look mode free, dpr released, treatment 0, chapter 3 begins.'
      }
    ],
    timeoutMs: 240_000
  },
  {
    id: 'descent',
    entryBeat: 'descent',
    hits: [{
      id: 'hit-05-06-descent-impact',
      site: 'main/src/story/storyDirector.ts:1362 + :1363',
      timbre: 'boom+braam',
      beat: 'descent',
      trigger: { type: 'sfx', value: 'shipCrash' },
      note: 'descent impact at DESCENT_IMPACT_AT=4.5s. Two scoreHit calls, one onset.'
    }],
    timeoutMs: 180_000
  },
  {
    id: 'ch1-lift',
    entryBeat: 'ch1-lift',
    hits: [{
      id: 'hit-07-ch1-lift-dpr-snap',
      site: 'main/src/story/storyDirector.ts:1434',
      timbre: 'braam',
      beat: 'ch1-lift',
      trigger: { type: 'sfx', value: 'storyGlitch' },
      note: 'mid-lift DPR snap at t=3.45s; glitch masks the framebuffer snap.'
    }],
    timeoutMs: 180_000
  },
  {
    id: 'a3-dawn',
    entryBeat: 'a3-dawn',
    hits: [
      {
        id: 'hit-08-a3-first-blade',
        site: 'main/src/story/storyDirector.ts:1741',
        timbre: 'bloom',
        beat: 'a3-dawn',
        trigger: { type: 'text', value: 'the wood remembers being a tree.', delayMs: 1000 },
        note: 'bloom wave start = wakeAt(4.5)+fadeUp(2.0)+bloomWaveDelay(4.0) = story t 10.5s. No SFX co-fires here, so the A3 caption at story t 9.5s ("the wood remembers being a tree.") is the landmark and the strip is taken 1.0 s later. Accuracy: +/- one poll (220 ms) plus caption-to-DOM latency.'
      },
      {
        id: 'hit-09-a3-material-landing',
        site: 'main/src/story/storyDirector.ts:1760',
        timbre: 'bloom',
        beat: 'a3-dawn',
        trigger: { type: 'beat', value: 'ch3-thirst' },
        note: 'lands EXACTLY on the material preset; clearLifeReveal and stage cut together.'
      }
    ],
    timeoutMs: 300_000
  },
  {
    id: 'ch5-maw',
    entryBeat: 'ch5-maw',
    hits: [{
      id: 'hit-10-maw-repair-committed',
      site: 'main/src/story/signedSceneAvRuntime.ts:445',
      timbre: 'bloom',
      beat: 'ch5-maw',
      trigger: { type: 'sceneAvAnchor', value: 'anc.maw.repair-committed' },
      note: 'signed-scene anchor: the Maw answers the commit.'
    }],
    timeoutMs: 420_000
  },
  {
    id: 'a4-exhale',
    entryBeat: 'a4-exhale',
    hits: [{
      id: 'hit-11-a4-exhale-life-front',
      site: 'main/src/story/emergentStoryDirector.ts:941',
      timbre: 'bloom',
      beat: 'a4-exhale',
      trigger: { type: 'sfx', value: 'storyAwaken' },
      note: 'life front at runtime.elapsed >= 1.75s; arrival, never victory.'
    }],
    timeoutMs: 240_000
  }
];

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function gitHead() {
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: HERE, encoding: 'utf8' }).trim();
}

/** Parse `__voxSfxDiag()` into { event: triggeredCount }. */
function parseSfx(text) {
  const out = {};
  if (typeof text !== 'string') return out;
  const head = text.split('||')[0];
  for (const m of head.matchAll(/([A-Za-z][A-Za-z0-9_]*)\s+(\d+)✓\/(\d+)/g)) {
    out[m[1]] = Number(m[2]);
  }
  return out;
}

const READ_STATE = () => {
  const w = window;
  let sceneAv = null;
  try {
    const s = w.__paravoxiaSceneAv;
    if (s) sceneAv = { beat: s.beat ?? null, anchorId: s.anchorId ?? null, anchorEvent: s.anchorEvent ?? null, active: s.active ?? null };
  } catch { sceneAv = null; }
  const card = document.querySelector('[aria-label="Current story objective"]');
  const objective = card instanceof HTMLElement
    ? {
      id: card.dataset.objectiveId ?? null,
      markerLabel: card.dataset.objectiveMarkerLabel ?? null,
      health: card.dataset.objectiveHealth ?? null,
      requiresMarker: card.dataset.objectiveRequiresMarker ?? null,
      text: (card.innerText || '').split('\n').map(l => l.trim()).filter(Boolean)
    }
    : null;
  return {
    beat: w.__storyBeat ?? null,
    phase: w.__paravoxiaAppState?.phase ?? null,
    sfx: typeof w.__voxSfxDiag === 'function' ? w.__voxSfxDiag() : null,
    sceneAv,
    objective,
    dpr: window.devicePixelRatio,
    bodyText: document.body.innerText || '',
    now: Math.round(performance.now())
  };
};

async function runSession(browser, session, results, trace) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    reducedMotion: 'no-preference'
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));

  const url = new URL(BASE_URL);
  url.searchParams.set('story', session.entryBeat);
  url.searchParams.set('movie', '1');
  url.searchParams.set('profile', PROFILE);

  const sessionTrace = { session: session.id, url: url.toString(), samples: [], errors, reached: [], missed: [] };
  trace.push(sessionTrace);

  try {
    await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForFunction(() => {
      if (window.__paravoxiaAppState?.phase === 'playing') return true;
      return [...document.querySelectorAll('button')].some(b => b.textContent?.includes('Free Play') && !b.disabled);
    }, undefined, { timeout: 90_000 });
    if (!(await page.evaluate(() => window.__paravoxiaAppState?.phase === 'playing'))) {
      await page.getByRole('button', { name: /Free Play/i }).click({ force: true });
    }
    await page.waitForFunction(b => window.__storyBeat === b && document.querySelector('canvas'), session.entryBeat, { timeout: 120_000 });
    sessionTrace.renderer = await page.evaluate(() => {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      if (!gl) return 'no-webgl';
      const d = gl.getExtension('WEBGL_debug_renderer_info');
      return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    });

    const pending = session.hits.filter(h => !only || only.has(h.id));
    if (pending.length === 0) return;

    const startedAt = Date.now();
    let beatEnteredAt = Date.now();
    let lastBeat = session.entryBeat;
    let sfxBase = {};
    let rolling = null;         // { buffer, at }
    let rollingTakenAt = 0;

    while (pending.length > 0 && Date.now() - startedAt < session.timeoutMs) {
      const state = await page.evaluate(READ_STATE);
      const sfx = parseSfx(state.sfx);
      if (state.beat !== lastBeat) {
        beatEnteredAt = Date.now();
        lastBeat = state.beat;
        sfxBase = sfx;
      }
      const beatElapsed = (Date.now() - beatEnteredAt) / 1000;
      sessionTrace.samples.push({ t: Date.now() - startedAt, beat: state.beat, beatElapsed: Number(beatElapsed.toFixed(2)), sfx: state.sfx, sceneAv: state.sceneAv, objective: state.objective, dpr: state.dpr, captions: state.bodyText.split('\n').map(l => l.trim()).filter(Boolean).slice(-6) });

      const hit = pending[0];
      const g = hit.trigger;
      let fired = false;
      if (g.type === 'beat') fired = state.beat === g.value;
      else if (g.type === 'sfx') fired = (sfx[g.value] ?? 0) > (sfxBase[g.value] ?? 0);
      else if (g.type === 'sceneAvAnchor') fired = state.sceneAv?.anchorId === g.value;
      else if (g.type === 'beatElapsed') fired = state.beat === hit.beat && beatElapsed >= g.value;
      else if (g.type === 'text') fired = state.beat === hit.beat && state.bodyText.includes(g.value);

      if (fired) {
        pending.shift();
        const prefix = hit.id;
        const frames = [];
        if (g.delayMs) {
          rolling = await page.screenshot({ type: 'png' });
          rollingTakenAt = Date.now();
          await page.waitForTimeout(g.delayMs);
        }
        if (rolling && Date.now() - rollingTakenAt <= PRE_ROLL_MS * 3 + (g.delayMs ?? 0)) {
          frames.push({ tag: 'before', buffer: rolling, offsetMs: -(Date.now() - rollingTakenAt) });
        }
        frames.push({ tag: 'at', buffer: await page.screenshot({ type: 'png' }), offsetMs: 0 });
        const atState = await page.evaluate(READ_STATE);
        await page.waitForTimeout(AFTER_MS);
        frames.push({ tag: 'after', buffer: await page.screenshot({ type: 'png' }), offsetMs: AFTER_MS });
        const afterState = await page.evaluate(READ_STATE);

        const written = [];
        for (const f of frames) {
          const name = `${prefix}_${f.tag}.png`;
          await writeFile(path.join(OUT_DIR, name), f.buffer);
          written.push({ tag: f.tag, file: name, sha256: sha256(f.buffer), offsetMs: f.offsetMs, bytes: f.buffer.length });
        }
        results.push({
          hitId: hit.id,
          site: hit.site,
          timbre: hit.timbre,
          beat: hit.beat,
          note: hit.note,
          trigger: g,
          observedBeatAtHit: state.beat,
          observedBeatElapsedSeconds: Number(beatElapsed.toFixed(2)),
          sceneAvAtHit: state.sceneAv,
          objectiveAtHit: state.objective,
          objectiveAfterHit: afterState.objective,
          dpr: state.dpr,
          sfxAtHit: atState.sfx,
          frames: written
        });
        sessionTrace.reached.push(hit.id);
        // Re-baseline so the next hit in this session sees fresh edges.
        sfxBase = parseSfx(afterState.sfx);
        rolling = null;
        continue;
      }

      if (!rolling || Date.now() - rollingTakenAt >= PRE_ROLL_MS) {
        rolling = await page.screenshot({ type: 'png' });
        rollingTakenAt = Date.now();
      }
      await page.waitForTimeout(POLL_MS);
    }
    for (const h of pending) sessionTrace.missed.push({ id: h.id, reason: `not reached within ${session.timeoutMs}ms; last beat ${lastBeat}` });
  } catch (error) {
    sessionTrace.missed.push({ id: session.id, reason: `session error: ${error.message}` });
  } finally {
    await context.close();
  }
}

await mkdir(OUT_DIR, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: CHROME,
  args: CHROME_ARGS
});
const results = [];
const trace = [];
try {
  for (const session of SESSIONS) {
    if (only && !session.hits.some(h => only.has(h.id))) continue;
    process.stdout.write(`[session] ${session.id}\n`);
    await runSession(browser, session, results, trace);
    process.stdout.write(`[session] ${session.id} done (${results.length} hits so far)\n`);
  }
} finally {
  await browser.close();
}

const report = {
  schema: 'paravoxia.audio10xBaselineHitProbe.v1',
  runId: '2026-09-04-audio-10x',
  sourceRevision: gitHead(),
  baseUrl: BASE_URL,
  viewport: `${VIEWPORT.width}x${VIEWPORT.height}`,
  qualityTier: PROFILE,
  capturedAt: new Date().toISOString(),
  hits: results,
  trace
};
await writeFile(path.join(OUT_DIR, 'baseline-hit-trace.json'), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`captured ${results.length} hits -> ${OUT_DIR}\n`);
