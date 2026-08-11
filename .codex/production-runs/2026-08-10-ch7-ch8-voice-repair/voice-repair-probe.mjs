// Mechanical proof probe for the 2026-08-10 ch7/ch8 voice-repair run.
//
// Subscribes to the LIVE story-text store, guided-objective store and UX
// feedback bus through the Vite dev server's ESM graph, so every emission is
// captured at emit time with the game's own pause-aware `storyNow()` stamp
// rather than sampled from the DOM. Read-only: no exported mutator is called.
//
// Modes (argv[2]):
//   ch7-flow      N cold movie runs of ch7-reconstruct -> ch7-board
//   ch8-flow      N cold movie runs of ch8-launch -> ch8-crossing
//   full-flow     one ch6-dive -> ch9-settle movie chain
//   ch8-captures  contract captureSpec offsets off the ch8 window origin
//   ch7-captures  ch7 stage-edge + exit-cadence strip
//   variants      reduced-motion / mobile / POTATO parity
//   resets        sandbox no-op, mid-ch7 deep link, pause+focus in the window
//   deep-ch8      standalone ch8 deep link (no chain) trace
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
const { chromium } = await import(
  '/home/thomasphillip/Projects/vox/main/node_modules/playwright-core/index.mjs'
);

const RUN_DIR = path.dirname(new URL(import.meta.url).pathname);
const OUT_DIR = path.join(RUN_DIR, 'evidence', 'verification');
const BASE = process.env.VOX_BASE ?? 'http://localhost:5176';
fs.mkdirSync(OUT_DIR, { recursive: true });

const pwDir = path.join(os.homedir(), '.cache/ms-playwright');
const chromeDir = fs.readdirSync(pwDir).filter(d => /^chromium-\d+$/.test(d)).sort().pop();
const executablePath = path.join(pwDir, chromeDir, 'chrome-linux/chrome');

// --- page-side instrumentation -------------------------------------------------
const INSTALL = `(() => {
  const w = window;
  if (w.__voxProbe) return;
  const events = [];
  w.__voxProbe = { events, ready: false, error: null };
  const stamp = (e) => {
    const now = w.__voxProbeClock ? w.__voxProbeClock() : performance.now();
    events.push(Object.assign({ wall: performance.now(), story: now, beat: w.__storyBeat ?? null }, e));
  };
  w.__voxProbeStamp = stamp;
  const boot = async () => {
    const st = await import('/src/story/storyText.ts');
    const obj = await import('/src/story/ux/objectiveDirector.ts');
    const fb = await import('/src/story/ux/feedbackCues.ts');
    const clock = await import('/src/story/storyClock.ts');
    const storyState = await import('/src/story/storyState.ts');
    const av = await import('/src/story/signedSceneAvRuntime.ts');
    w.__voxProbeClock = clock.storyNow;
    w.__voxAv = () => av.getSignedSceneAvDebugSnapshot();
    w.__voxObjective = () => {
      const o = obj.getActiveGuidedStoryObjective();
      return o ? { id: o.id, kind: o.kind, markerLabel: o.markerLabel, workOrder: [...o.workOrder],
        requiresMarker: o.requiresMarker, health: obj.getGuidedStoryObjectiveHealth() } : null;
    };
    w.__voxText = () => JSON.parse(JSON.stringify(st.getStoryText()));
    let lastCap = '\\u0000', lastAud = '\\u0000', lastWo = '\\u0000';
    st.subscribeStoryText(() => {
      const s = st.getStoryText();
      const capKey = s.caption ? s.caption.text + '@' + s.caption.shownAt : 'null';
      if (capKey !== lastCap) {
        lastCap = capKey;
        stamp({ ch: 'caption', text: s.caption ? s.caption.text : null,
          shownAt: s.caption ? s.caption.shownAt : null, ttlMs: s.caption ? s.caption.ttlMs : null });
      }
      const audKey = s.audit ? (s.audit.header || '') + '|' + s.audit.text + '@' + s.audit.shownAt : 'null';
      if (audKey !== lastAud) {
        lastAud = audKey;
        stamp({ ch: 'audit', text: s.audit ? s.audit.text : null, header: s.audit ? s.audit.header : null,
          shownAt: s.audit ? s.audit.shownAt : null, ttlMs: s.audit ? s.audit.ttlMs : null });
      }
      const woKey = JSON.stringify(s.workorder);
      if (woKey !== lastWo) { lastWo = woKey; stamp({ ch: 'workorder', lines: [...s.workorder] }); }
    });
    let lastObj = '\\u0000';
    obj.subscribeGuidedStoryObjective(() => {
      const o = w.__voxObjective();
      const key = JSON.stringify(o);
      if (key === lastObj) return;
      lastObj = key;
      stamp({ ch: 'objective', objective: o });
    });
    fb.subscribeStoryUxFeedback((cue) => stamp({ ch: 'feedback', cue: JSON.parse(JSON.stringify(cue)) }));
    let lastBeat = '\\u0000';
    storyState.subscribeStory(() => {
      const snap = storyState.getStoryStateSnapshot();
      if (snap.beat === lastBeat) return;
      lastBeat = snap.beat;
      stamp({ ch: 'beat', beat: snap.beat, active: snap.active, era: snap.era ?? null });
    });
    w.__voxProbe.ready = true;
  };
  let tries = 0;
  const attempt = () => {
    tries++;
    boot().catch((e) => {
      w.__voxProbe.error = String(e).slice(0, 200);
      if (tries < 60) setTimeout(attempt, 100);
    });
  };
  attempt();
})();`;

async function newInstrumentedPage(browser, opts = {}) {
  const context = await browser.newContext({
    viewport: opts.viewport ?? { width: 1280, height: 720 },
    reducedMotion: opts.reducedMotion ?? 'no-preference',
    isMobile: opts.isMobile ?? false,
    hasTouch: opts.hasTouch ?? false,
    deviceScaleFactor: opts.deviceScaleFactor ?? 1
  });
  await context.addInitScript(INSTALL);
  const page = await context.newPage();
  page.__ctx = context;
  return page;
}

const readEvents = (page, from = 0) =>
  page.evaluate((n) => (window.__voxProbe ? window.__voxProbe.events.slice(n) : []), from);
const probeReady = (page) => page.evaluate(() => Boolean(window.__voxProbe && window.__voxProbe.ready));
const liveBeat = (page) => page.evaluate(() => window.__storyBeat ?? null);
const avSnap = (page) => page.evaluate(() => (window.__voxAv ? window.__voxAv() : null));

async function runScenario(browser, { url, stopBeat, capSeconds, tailSeconds = 3, pageOpts = {}, shotDir = null, shotIntervalMs = 0 }) {
  const page = await newInstrumentedPage(browser, pageOpts);
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 300)));
  const record = { url: BASE + '/' + url, startedAt: new Date().toISOString(), events: [], shots: [], pageErrors };
  const t0 = Date.now();
  try {
    await page.goto(BASE + '/' + url, { waitUntil: 'load', timeout: 90000 });
  } catch (e) { record.gotoError = String(e).slice(0, 300); }
  record.instrumentedMs = null;
  let stopAt = null;
  let lastShot = -1e9;
  let shotIndex = 0;
  while (true) {
    const elapsed = Date.now() - t0;
    if (elapsed / 1000 > capSeconds) { record.timedOut = stopAt === null; break; }
    if (record.instrumentedMs === null && (await probeReady(page))) record.instrumentedMs = elapsed;
    const beat = await liveBeat(page).catch(() => null);
    if (shotDir && shotIntervalMs && elapsed - lastShot >= shotIntervalMs) {
      const name = `${String(shotIndex).padStart(3, '0')}_${(elapsed / 1000).toFixed(1)}s_${beat ?? 'null'}.png`;
      try {
        await page.screenshot({ path: path.join(shotDir, name) });
        record.shots.push({ file: name, tSeconds: Number((elapsed / 1000).toFixed(2)), beat });
      } catch { /* absence records the miss */ }
      shotIndex++; lastShot = elapsed;
    }
    if (stopBeat && beat === stopBeat && stopAt === null) {
      stopAt = elapsed;
      record.stopBeatAtMs = elapsed;
    }
    if (stopAt !== null && elapsed - stopAt > tailSeconds * 1000) break;
    await new Promise(r => setTimeout(r, 60));
  }
  record.events = await readEvents(page);
  record.finalAv = await avSnap(page).catch(() => null);
  record.finalObjective = await page.evaluate(() => (window.__voxObjective ? window.__voxObjective() : null)).catch(() => null);
  record.reachedStopBeat = stopAt !== null;
  record.durationMs = Date.now() - t0;
  record.endedAt = new Date().toISOString();
  await page.__ctx.close();
  return record;
}

const launch = () => chromium.launch({
  executablePath,
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--window-size=1280,720']
});

const write = (name, data) => {
  const p = path.join(OUT_DIR, name);
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
  console.log('wrote', p);
};

const mode = process.argv[2];
const arg = (flag, dflt) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : dflt;
};

const browser = await launch();

if (mode === 'ch7-flow' || mode === 'ch8-flow') {
  const runs = Number(arg('--runs', '3'));
  const cfg = mode === 'ch7-flow'
    ? { url: '?story=ch7-reconstruct&movie=1&profile=LOW', stopBeat: 'ch7-board', capSeconds: 180 }
    : { url: '?story=ch8-launch&movie=1&profile=LOW', stopBeat: 'ch8-crossing', capSeconds: 180 };
  const out = { mode, capturedAt: new Date().toISOString(), base: BASE, runs: [] };
  for (let i = 0; i < runs; i++) {
    const r = await runScenario(browser, cfg);
    out.runs.push({ run: i + 1, ...r });
    console.log(`[${mode}] run ${i + 1} stop=${r.reachedStopBeat} ${(r.durationMs / 1000).toFixed(1)}s events=${r.events.length} errors=${r.pageErrors.length}`);
    write(`${mode}-trace.json`, out);
  }
} else if (mode === 'deep-ch8') {
  const out = { mode, capturedAt: new Date().toISOString(), base: BASE, runs: [] };
  const r = await runScenario(browser, { url: '?story=ch8-launch&movie=1&profile=LOW', stopBeat: 'ch8-crossing', capSeconds: 180, tailSeconds: 6 });
  out.runs.push(r);
  write('deep-ch8-trace.json', out);
} else if (mode === 'full-flow') {
  const out = { mode, capturedAt: new Date().toISOString(), base: BASE, runs: [] };
  const r = await runScenario(browser, {
    url: '?story=ch6-dive&movie=1&profile=LOW', stopBeat: 'ch9-settle', capSeconds: 600, tailSeconds: 6
  });
  out.runs.push(r);
  write('full-flow-trace.json', out);
} else if (mode === 'ch7-captures' || mode === 'ch8-captures') {
  // Offset-driven capture: watch for the origin emission, then shoot the exact
  // contract offsets off it.
  const isCh8 = mode === 'ch8-captures';
  const variant = arg('--variant', 'desktop');
  const label = arg('--label', variant);
  const dir = path.join(OUT_DIR, `${mode}-${label}`);
  fs.mkdirSync(dir, { recursive: true });
  const pageOpts = variant === 'mobile'
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
    : variant === 'mobile-landscape'
      ? { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }
      : variant === 'reduced-motion'
        ? { reducedMotion: 'reduce' }
        : {};
  const profile = arg('--profile', 'LOW');
  const url = isCh8
    ? `?story=ch8-launch&movie=1&profile=${profile}`
    : `?story=ch7-reconstruct&movie=1&profile=${profile}`;
  const originText = isCh8
    ? 'i came down this line without being asked. i am going back up it on purpose.'
    : 'UNSCHEDULED HULL · SITE 7C-θ · INTEREST RAISED';
  const offsets = isCh8
    ? [0.0, 1.2, 2.0, 4.0, 6.0, 8.5, 9.7, 11.5, 12.7, 14.0, 15.2, 17.0, 18.0]
    : [0.0, 0.4, 0.8, 1.5, 2.4, 2.8, 3.5, 4.8, 5.2, 6.5];
  const contractOffsets = isCh8 ? [0.0, 2.0, 4.0, 6.0, 8.5, 11.5, 14.0, 17.0, 18.0] : offsets;
  const page = await newInstrumentedPage(browser, pageOpts);
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 300)));
  const record = { mode, variant, label, profile, url: BASE + '/' + url, capturedAt: new Date().toISOString(), captures: [], pageErrors, contractOffsets };
  await page.goto(BASE + '/' + url, { waitUntil: 'load', timeout: 90000 }).catch(e => { record.gotoError = String(e).slice(0, 200); });
  const deadline = Date.now() + 200000;
  let origin = null;
  // Pre-origin strip for ch7 stage edges: continuous shots until the origin.
  const preDir = path.join(dir, 'pre-origin');
  if (!isCh8) fs.mkdirSync(preDir, { recursive: true });
  let preIndex = 0;
  let lastPre = 0;
  while (Date.now() < deadline && origin === null) {
    const evs = await readEvents(page);
    const hit = evs.find(e => (e.ch === 'audit' || e.ch === 'caption') && e.text === originText);
    if (hit) { origin = { wallPage: hit.wall, story: hit.story, detectedAtHostMs: Date.now() }; break; }
    if (!isCh8 && Date.now() - lastPre >= 400) {
      lastPre = Date.now();
      const b = await liveBeat(page).catch(() => null);
      const t = await page.evaluate(() => (window.__voxProbeClock ? window.__voxProbeClock() : performance.now()));
      const name = `pre_${String(preIndex).padStart(3, '0')}_${(t / 1000).toFixed(2)}s_${b ?? 'null'}.png`;
      await page.screenshot({ path: path.join(preDir, name) }).catch(() => {});
      const txt = await page.evaluate(() => (window.__voxText ? window.__voxText() : null)).catch(() => null);
      record.captures.push({ phase: 'pre-origin', file: `pre-origin/${name}`, storyClockSeconds: Number((t / 1000).toFixed(3)), beat: b, caption: txt?.caption?.text ?? null, audit: txt?.audit ? { header: txt.audit.header ?? null, text: txt.audit.text } : null });
      preIndex++;
    }
    await new Promise(r => setTimeout(r, 40));
  }
  if (origin === null) {
    record.originMissing = true;
  } else {
    record.origin = origin;
    // Shutter bias: a latch fires on the first director tick at or after its
    // constant, so a shutter opened exactly on the nominal offset can close
    // before the emission. The bias stays well inside the contract's 0.2 s
    // tolerance and every frame records its measured offset.
    const bias = Number(arg('--bias', '0.12')) * 1000;
    record.shutterBiasSeconds = bias / 1000;
    for (const off of offsets) {
      const targetStory = origin.story + off * 1000 + bias;
      // Busy-wait on the game's own clock so the offsets are honest.
      while (Date.now() < deadline) {
        const now = await page.evaluate(() => (window.__voxProbeClock ? window.__voxProbeClock() : performance.now()));
        if (now >= targetStory - 8) break;
        await new Promise(r => setTimeout(r, Math.min(60, Math.max(5, (targetStory - now) / 2))));
      }
      const beforeClock = await page.evaluate(() => (window.__voxProbeClock ? window.__voxProbeClock() : performance.now()));
      const b = await liveBeat(page).catch(() => null);
      const name = `off_${off.toFixed(1).replace('.', 'p')}s_${b ?? 'null'}.png`;
      await page.screenshot({ path: path.join(dir, name) }).catch(() => {});
      const afterClock = await page.evaluate(() => (window.__voxProbeClock ? window.__voxProbeClock() : performance.now()));
      const txt = await page.evaluate(() => (window.__voxText ? window.__voxText() : null)).catch(() => null);
      const obj = await page.evaluate(() => (window.__voxObjective ? window.__voxObjective() : null)).catch(() => null);
      const dom = await page.evaluate(() => {
        const cap = document.querySelector('[data-story-caption]');
        const lives = Array.from(document.querySelectorAll('div[aria-live="polite"]'));
        const hud = document.querySelector('[data-story-guidance-hud]');
        const audit = lives.find(el => !el.hasAttribute('data-story-caption') && !el.hasAttribute('data-story-guidance-hud'));
        const rect = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
        return {
          captionDom: cap ? cap.innerText.trim() : null,
          captionRect: rect(cap),
          captionPlacement: cap ? cap.getAttribute('data-caption-placement') : null,
          auditDom: audit ? audit.innerText.replace(/\s*\n\s*/g, ' | ').trim() : null,
          auditRect: rect(audit),
          hudDom: hud ? hud.innerText.replace(/\s*\n\s*/g, ' | ').trim() : null,
          hudRect: rect(hud),
          viewport: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio }
        };
      }).catch(() => null);
      record.captures.push({
        phase: 'offset',
        offsetSeconds: off,
        contractOffset: contractOffsets.includes(off),
        file: name,
        actualOffsetSeconds: Number(((beforeClock - origin.story) / 1000).toFixed(3)),
        shutterSpanMs: Number((afterClock - beforeClock).toFixed(1)),
        beat: b,
        storeCaption: txt?.caption?.text ?? null,
        storeAudit: txt?.audit ? { header: txt.audit.header ?? null, text: txt.audit.text } : null,
        objective: obj,
        dom
      });
      console.log(`[${mode}/${label}] +${off}s -> ${b} cap="${(txt?.caption?.text ?? '').slice(0, 40)}" audit="${(txt?.audit?.text ?? '').slice(0, 40)}"`);
    }
  }
  record.events = await readEvents(page);
  record.finalAv = await avSnap(page).catch(() => null);
  await page.__ctx.close();
  write(`${mode}-${label}.json`, record);
} else if (mode === 'l23-captures') {
  // cap.ch8.l2-l3-anchors: frames around the signed ignition and liftoff
  // anchors on both the deep-link and the chained path.
  const out = { mode, capturedAt: new Date().toISOString(), base: BASE, paths: [] };
  for (const entry of [
    { id: 'deep-link', url: '?story=ch8-launch&movie=1&profile=LOW' },
    { id: 'chained', url: '?story=ch7-board&movie=1&profile=LOW' }
  ]) {
    const dir = path.join(OUT_DIR, `l23-${entry.id}`);
    fs.mkdirSync(dir, { recursive: true });
    const page = await newInstrumentedPage(browser, {});
    await page.goto(BASE + '/' + entry.url, { waitUntil: 'load', timeout: 90000 }).catch(() => {});
    const rec = { id: entry.id, url: BASE + '/' + entry.url, frames: [], anchorTimeline: [] };
    const deadline = Date.now() + 90000;
    // Continuous 250 ms strip through the ignition/liftoff window, each frame
    // stamped with the live anchor set and the live caption.
    let i = 0;
    while (Date.now() < deadline) {
      const s = await page.evaluate(() => {
        const w = window;
        const av = w.__voxAv ? w.__voxAv() : null;
        const t = w.__voxProbeClock ? w.__voxProbeClock() : performance.now();
        const cap = document.querySelector('[data-story-caption]');
        return { t, beat: w.__storyBeat ?? null, activated: av ? [...av.activatedAnchorIds] : null,
          anchorId: av ? av.anchorId : null, captionDom: cap ? cap.innerText.trim() : null,
          storeCaption: w.__voxText ? (w.__voxText().caption?.text ?? null) : null };
      }).catch(() => null);
      if (!s) break;
      const name = `l23_${String(i).padStart(3, '0')}_${(s.t / 1000).toFixed(2)}s_${s.beat ?? 'null'}.png`;
      await page.screenshot({ path: path.join(dir, name) }).catch(() => {});
      rec.frames.push({ file: name, storyClockSeconds: Number((s.t / 1000).toFixed(3)), ...s });
      i++;
      if (s.activated && s.activated.includes('anc.launch.atmosphere-exit')) break;
      await new Promise(r => setTimeout(r, 250));
    }
    rec.events = await readEvents(page);
    await page.__ctx.close();
    out.paths.push(rec);
    console.log(`[l23/${entry.id}] frames=${rec.frames.length}`);
    write('l23-captures.json', out);
  }
} else if (mode === 'variants') {
  // One ch7 stage line + the ch8 window per variant, trace-only parity.
  const specs = [
    { id: 'mobile-portrait', pageOpts: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, profile: 'LOW' },
    { id: 'reduced-motion', pageOpts: { reducedMotion: 'reduce' }, profile: 'LOW' },
    { id: 'potato', pageOpts: {}, profile: 'POTATO' }
  ];
  const out = { mode, capturedAt: new Date().toISOString(), base: BASE, variants: [] };
  for (const spec of specs) {
    for (const beat of ['ch7-reconstruct', 'ch8-launch']) {
      const stopBeat = beat === 'ch7-reconstruct' ? 'ch7-board' : 'ch8-crossing';
      const r = await runScenario(browser, {
        url: `?story=${beat}&movie=1&profile=${spec.profile}`,
        stopBeat, capSeconds: 220, tailSeconds: 3, pageOpts: spec.pageOpts
      });
      out.variants.push({ variant: spec.id, beat, profile: spec.profile, ...r });
      console.log(`[variants/${spec.id}/${beat}] stop=${r.reachedStopBeat} events=${r.events.length}`);
      write('variants-trace.json', out);
    }
  }
} else if (mode === 'resets') {
  const out = { mode, capturedAt: new Date().toISOString(), base: BASE, cases: [] };
  // 1. sandbox no-op: story inactive.
  {
    const page = await newInstrumentedPage(browser, {});
    await page.goto(BASE + '/', { waitUntil: 'load', timeout: 90000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 45000));
    const events = await readEvents(page);
    const text = await page.evaluate(() => (window.__voxText ? window.__voxText() : null)).catch(() => null);
    const beat = await liveBeat(page);
    const av = await avSnap(page).catch(() => null);
    out.cases.push({ case: 'sandbox_noop', url: BASE + '/', beat, events, storyText: text, av });
    await page.__ctx.close();
    console.log('[resets] sandbox events=', events.length);
    write('resets-trace.json', out);
  }
  // 2. deep link mid-ch7 (ch7-board = post-reconstruct) proves no ch7 line replays.
  for (const link of ['ch7-board', 'ch8-crossing']) {
    const page = await newInstrumentedPage(browser, {});
    await page.goto(`${BASE}/?story=${link}&profile=LOW`, { waitUntil: 'load', timeout: 90000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 30000));
    const events = await readEvents(page);
    const beat = await liveBeat(page);
    const obj = await page.evaluate(() => (window.__voxObjective ? window.__voxObjective() : null)).catch(() => null);
    out.cases.push({ case: `deep_link:${link}`, url: `${BASE}/?story=${link}&profile=LOW`, beat, objective: obj, events });
    await page.__ctx.close();
    console.log(`[resets] deep-link ${link} events=`, events.length);
    write('resets-trace.json', out);
  }
  // 2b. deep link into a seeded ch7-reconstruct (no movie): the seeding path.
  {
    const page = await newInstrumentedPage(browser, {});
    await page.goto(`${BASE}/?story=ch7-reconstruct&profile=LOW`, { waitUntil: 'load', timeout: 90000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 30000));
    const events = await readEvents(page);
    const beat = await liveBeat(page);
    const obj = await page.evaluate(() => (window.__voxObjective ? window.__voxObjective() : null)).catch(() => null);
    out.cases.push({ case: 'deep_link:ch7-reconstruct', url: `${BASE}/?story=ch7-reconstruct&profile=LOW`, beat, objective: obj, events });
    await page.__ctx.close();
    write('resets-trace.json', out);
  }
  // 3. pause + focus loss during the ch8 window.
  for (const kind of ['pause', 'focus-loss']) {
    const page = await newInstrumentedPage(browser, {});
    const url = `${BASE}/?story=ch8-launch&movie=1&profile=LOW`;
    await page.goto(url, { waitUntil: 'load', timeout: 90000 }).catch(() => {});
    const deadline = Date.now() + 200000;
    let origin = null;
    while (Date.now() < deadline && origin === null) {
      const evs = await readEvents(page);
      const hit = evs.find(e => e.ch === 'caption' && e.text === 'i came down this line without being asked. i am going back up it on purpose.');
      if (hit) origin = hit;
      else await new Promise(r => setTimeout(r, 40));
    }
    let intervention = null;
    if (origin) {
      // Wait ~3 s into the window, then interrupt for 5 s.
      while (Date.now() < deadline) {
        const now = await page.evaluate(() => window.__voxProbeClock());
        if (now - origin.story >= 3000) break;
        await new Promise(r => setTimeout(r, 30));
      }
      const atStory = await page.evaluate(() => window.__voxProbeClock());
      if (kind === 'pause') {
        await page.keyboard.press('Escape');
      } else {
        await page.evaluate(() => {
          Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
          Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
          document.dispatchEvent(new Event('visibilitychange'));
          window.dispatchEvent(new Event('blur'));
        });
      }
      await new Promise(r => setTimeout(r, 5000));
      if (kind === 'pause') {
        await page.keyboard.press('Escape');
      } else {
        await page.evaluate(() => {
          Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
          Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
          document.dispatchEvent(new Event('visibilitychange'));
          window.dispatchEvent(new Event('focus'));
        });
      }
      const resumeStory = await page.evaluate(() => window.__voxProbeClock());
      intervention = { kind, atStoryClock: atStory, atWindowOffsetSeconds: Number(((atStory - origin.story) / 1000).toFixed(3)), resumeStoryClock: resumeStory, heldSeconds: Number(((resumeStory - atStory) / 1000).toFixed(3)) };
    }
    // Let the window finish.
    const stopDeadline = Date.now() + 90000;
    while (Date.now() < stopDeadline) {
      const b = await liveBeat(page).catch(() => null);
      if (b === 'ch8-crossing') break;
      await new Promise(r => setTimeout(r, 200));
    }
    await new Promise(r => setTimeout(r, 2000));
    const events = await readEvents(page);
    out.cases.push({ case: `interrupt:${kind}`, url, origin: origin ? { story: origin.story, wall: origin.wall } : null, intervention, finalBeat: await liveBeat(page).catch(() => null), events });
    await page.__ctx.close();
    console.log(`[resets] ${kind} done`);
    write('resets-trace.json', out);
  }
} else {
  console.error('unknown mode', mode);
}

await browser.close();
