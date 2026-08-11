// Per-rAF objective marker-health probe (final-phase gate repair).
//
// Why this exists: objective-lifecycle-evidence.json's `missingMarkerFrames`
// field is a FRAME count, but the number recorded in it was derived from
// objective-store EMISSIONS. An emission that is superseded 12 ms later may
// occupy no rendered frame at all. This probe samples the live objective and
// its marker health once per requestAnimationFrame, so the reported number is
// what the field actually names, and it splits the count by whether the marker
// had been ACQUIRED yet — the distinction draft-v5 acceptance criterion [35]
// turns on.
//
// It also drives `ch8:launch:reboard`, which the run previously recorded as an
// unreachable headed-only gap (ux-05): pressing [F] in the cockpit on the
// surface calls the shipped exitShip(), which publishes the reboard objective.
//
// Modes: ch7 | reboard | resets
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
const { chromium } = await import(
  '/home/thomasphillip/Projects/vox/main/node_modules/playwright-core/index.mjs'
);

const RUN_DIR = path.dirname(new URL(import.meta.url).pathname);
const arg = (flag, dflt) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : dflt;
};
const OUT_DIR = path.join(RUN_DIR, 'evidence', arg('--out', 'verification-final'), 'objective-health');
const BASE = process.env.VOX_BASE ?? 'http://localhost:5176';
fs.mkdirSync(OUT_DIR, { recursive: true });

const pwDir = path.join(os.homedir(), '.cache/ms-playwright');
const chromeDir = fs.readdirSync(pwDir).filter(d => /^chromium-\d+$/.test(d)).sort().pop();
const executablePath = path.join(pwDir, chromeDir, 'chrome-linux/chrome');

// Per-rAF sampler. Runs inside the page so every rendered frame is counted.
const INSTALL = `(() => {
  const w = window;
  if (w.__voxOH) return;
  w.__voxOH = { ready: false, frames: 0, rows: [], transitions: [] };
  const boot = async () => {
    const obj = await import('/src/story/ux/objectiveDirector.ts');
    const clock = await import('/src/story/storyClock.ts');
    const fb = await import('/src/story/ux/feedbackCues.ts');
    const sf = await import('/src/state/spaceFlight.ts');
    const S = w.__voxOH;
    S.feedback = [];
    fb.subscribeStoryUxFeedback((cue) => S.feedback.push({
      t: clock.storyNow(), objectiveId: cue.objectiveId ?? null, kind: cue.kind ?? null
    }));
    // rows[] accumulates ONE record per objective id per contiguous activation.
    let cur = null;
    const tick = () => {
      S.frames++;
      const o = obj.getActiveGuidedStoryObjective();
      const id = o ? o.id : null;
      const health = o ? obj.getGuidedStoryObjectiveHealth() : null;
      const f = sf.getSpaceFlightSnapshot();
      if (!cur || cur.id !== id) {
        if (cur) { cur.clearedAt = clock.storyNow(); cur.replacedBy = id; }
        cur = id === null ? null : {
          id, kind: o.kind, markerLabel: o.markerLabel, workOrder: [...o.workOrder],
          requiresMarker: o.requiresMarker, enteredAt: clock.storyNow(),
          frames: 0, acquired: false, firstAcquiredAt: null,
          preAcquisitionMissingMarkerFrames: 0,
          acquiredWindowMissingMarkerFrames: 0,
          postCompletionMissingMarkerFrames: 0,
          healthRuns: [], markerLabels: [], clearedAt: null, replacedBy: null
        };
        if (cur) S.rows.push(cur);
        S.transitions.push({ t: clock.storyNow(), id, health, phase: f.phase, controlMode: f.controlMode });
      }
      if (cur) {
        cur.frames++;
        if (!cur.markerLabels.includes(o.markerLabel)) cur.markerLabels.push(o.markerLabel);
        if (health === 'ready' && !cur.acquired) { cur.acquired = true; cur.firstAcquiredAt = clock.storyNow(); }
        if (health === 'missing-marker') {
          if (!cur.acquired) cur.preAcquisitionMissingMarkerFrames++;
          else cur.acquiredWindowMissingMarkerFrames++;
        }
        const last = cur.healthRuns[cur.healthRuns.length - 1];
        if (last && last.health === health) last.frames++;
        else cur.healthRuns.push({ health, frames: 1, fromStoryClock: clock.storyNow() });
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    w.__voxOHState = () => {
      const o = obj.getActiveGuidedStoryObjective();
      const f = sf.getSpaceFlightSnapshot();
      return { t: clock.storyNow(), beat: w.__storyBeat ?? null, phase: f.phase,
        controlMode: f.controlMode, frames: S.frames,
        objectiveId: o ? o.id : null, health: o ? obj.getGuidedStoryObjectiveHealth() : null,
        markerLabel: o ? o.markerLabel : null, workOrder: o ? [...o.workOrder] : null };
    };
    S.ready = true;
  };
  let n = 0;
  const go = () => { n++; boot().catch(() => { if (n < 80) setTimeout(go, 100); }); };
  go();
})();`;

const browser = await chromium.launch({
  executablePath, headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--window-size=1280,720']
});

const VARIANTS = {
  desktop: {},
  mobile: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  reducedMotion: { reducedMotion: 'reduce' },
  lowestQuality: { profile: 'POTATO' }
};

async function open(url, opts = {}) {
  const ctx = await browser.newContext({
    viewport: opts.viewport ?? { width: 1280, height: 720 },
    reducedMotion: opts.reducedMotion ?? 'no-preference',
    isMobile: opts.isMobile ?? false, hasTouch: opts.hasTouch ?? false
  });
  await ctx.addInitScript(INSTALL);
  const page = await ctx.newPage();
  page.__ctx = ctx;
  await page.goto(url, { waitUntil: 'load', timeout: 120000 }).catch(() => {});
  const dl = Date.now() + 45000;
  while (Date.now() < dl) {
    const r = await page.evaluate(() => Boolean(window.__voxOH && window.__voxOH.ready)).catch(() => false);
    if (r) break;
    await new Promise(r2 => setTimeout(r2, 60));
  }
  return page;
}
const dump = (p) => p.evaluate(() => JSON.parse(JSON.stringify(window.__voxOH)));
const st = (p) => p.evaluate(() => (window.__voxOHState ? window.__voxOHState() : null));
const write = (n, d) => {
  fs.writeFileSync(path.join(OUT_DIR, n), `${JSON.stringify(d, null, 2)}\n`);
  console.log('wrote', path.join(OUT_DIR, n));
};

const mode = process.argv[2];

if (mode === 'ch7') {
  // Per-rAF marker health across the ch7 reconstruct ladder, all four variants.
  const out = { mode, base: BASE, capturedAt: new Date().toISOString(),
    method: 'objective + getGuidedStoryObjectiveHealth() sampled once per requestAnimationFrame; missing-marker frames split by whether the marker had ever resolved for that activation',
    runs: [] };
  for (const [variant, opts] of Object.entries(VARIANTS)) {
    for (let i = 0; i < Number(arg('--runs', '1')); i++) {
      const profile = opts.profile ?? 'LOW';
      const url = `${BASE}/?story=ch7-reconstruct&movie=1&profile=${profile}`;
      const page = await open(url, opts);
      const dl = Date.now() + 200000;
      while (Date.now() < dl) {
        const s = await st(page).catch(() => null);
        if (s && s.beat === 'ch7-board') break;
        await new Promise(r => setTimeout(r, 150));
      }
      await new Promise(r => setTimeout(r, 4000));
      const d = await dump(page);
      out.runs.push({ variant, run: i + 1, url, totalFrames: d.frames, rows: d.rows,
        feedback: d.feedback, transitions: d.transitions });
      console.log(`[ch7/${variant}] frames=${d.frames} objectives=${d.rows.length}`);
      await page.__ctx.close();
      write('ch7-objective-health.json', out);
    }
  }
} else if (mode === 'reboard') {
  // ch8:launch:reboard, previously recorded as a headed-only gap (ux-05).
  // [F] in the cockpit on the surface calls the shipped exitShip().
  const out = { mode, base: BASE, capturedAt: new Date().toISOString(),
    route: 'deep link ?story=ch8-launch, press [F] in the cockpit on the surface to call the shipped exitShip(), observe ch8:launch:reboard, then [F] again at the hatch to re-board',
    runs: [] };
  for (const [variant, opts] of Object.entries(VARIANTS)) {
    const profile = opts.profile ?? 'LOW';
    const url = `${BASE}/?story=ch8-launch&profile=${profile}`;
    const page = await open(url, opts);
    const dir = path.join(OUT_DIR, `reboard-${variant}`);
    fs.mkdirSync(dir, { recursive: true });
    const rec = { variant, url, frames: [] };
    await page.mouse.click(640, 360).catch(() => {});
    // Wait for the seated ignite objective, then exit the ship.
    const dl = Date.now() + 60000;
    while (Date.now() < dl) {
      const s = await st(page).catch(() => null);
      if (s && s.objectiveId === 'ch8:launch:ignite') break;
      await new Promise(r => setTimeout(r, 100));
    }
    rec.beforeExit = await st(page);
    await page.keyboard.press('KeyF').catch(() => {});
    const dl2 = Date.now() + 30000;
    while (Date.now() < dl2) {
      const s = await st(page).catch(() => null);
      if (s && s.objectiveId === 'ch8:launch:reboard') break;
      await new Promise(r => setTimeout(r, 60));
    }
    rec.afterExit = await st(page);
    {
      const s = await st(page);
      const name = `reboard-active_${variant}_${s.objectiveId}.png`;
      await page.screenshot({ path: path.join(dir, name) }).catch(() => {});
      rec.frames.push({ file: name, stateReadOrder: 'state-before-shutter', ...s });
    }
    // Re-board: the hatch is within reach immediately after egress.
    await new Promise(r => setTimeout(r, 2500));
    let boarded = false;
    for (let attempt = 0; attempt < 12 && !boarded; attempt++) {
      await page.keyboard.press('KeyF').catch(() => {});
      await new Promise(r => setTimeout(r, 700));
      const s = await st(page).catch(() => null);
      if (s && s.objectiveId !== 'ch8:launch:reboard') { boarded = true; rec.reboardedAfterAttempts = attempt + 1; }
      if (!boarded && attempt === 5) {
        // Step toward the hull if the first press was out of reach.
        await page.keyboard.down('KeyW');
        await new Promise(r => setTimeout(r, 500));
        await page.keyboard.up('KeyW');
      }
    }
    rec.afterReboard = await st(page);
    {
      const s = await st(page);
      const name = `reboard-cleared_${variant}_${s.objectiveId}.png`;
      await page.screenshot({ path: path.join(dir, name) }).catch(() => {});
      rec.frames.push({ file: name, stateReadOrder: 'state-before-shutter', ...s });
    }
    await new Promise(r => setTimeout(r, 2000));
    const d = await dump(page);
    rec.totalFrames = d.frames;
    rec.rows = d.rows;
    rec.feedback = d.feedback;
    rec.reboardRow = d.rows.find(r => r.id === 'ch8:launch:reboard') ?? null;
    rec.frameDir = path.relative(RUN_DIR, dir);
    out.runs.push(rec);
    console.log(`[reboard/${variant}] reboardObserved=${Boolean(rec.reboardRow)} cleared=${rec.reboardRow ? rec.reboardRow.clearedAt !== null : null} replacedBy=${rec.reboardRow ? rec.reboardRow.replacedBy : null}`);
    await page.__ctx.close();
    write('reboard-lifecycle.json', out);
  }
} else if (mode === 'resets') {
  // Reset matrix for ch8:launch:reboard specifically.
  const out = { mode, base: BASE, capturedAt: new Date().toISOString(), cases: [] };
  const reach = async (page) => {
    await page.mouse.click(640, 360).catch(() => {});
    const dl = Date.now() + 60000;
    while (Date.now() < dl) {
      const s = await st(page).catch(() => null);
      if (s && s.objectiveId === 'ch8:launch:ignite') break;
      await new Promise(r => setTimeout(r, 100));
    }
    await page.keyboard.press('KeyF').catch(() => {});
    const dl2 = Date.now() + 30000;
    while (Date.now() < dl2) {
      const s = await st(page).catch(() => null);
      if (s && s.objectiveId === 'ch8:launch:reboard') return true;
      await new Promise(r => setTimeout(r, 60));
    }
    return false;
  };
  const url = `${BASE}/?story=ch8-launch&profile=LOW`;
  for (const kind of ['beat-exit', 'deep-link', 'replay', 'pause', 'quit', 'focus-loss', 'completion', 'sandbox']) {
    const page = await open(url, {});
    const reached = kind === 'sandbox' ? false : await reach(page);
    const before = await st(page);
    let after = null;
    if (kind === 'beat-exit') {
      await page.evaluate(async () => {
        const d = await import('/src/story/emergentStoryDirector.ts');
        d.enterEmergentStoryBeat('ch8-crossing');
      }).catch(() => {});
      await new Promise(r => setTimeout(r, 1500));
      after = await st(page);
    } else if (kind === 'deep-link') {
      await page.goto(`${BASE}/?story=ch8-crossing&profile=LOW`, { waitUntil: 'load', timeout: 90000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 12000));
      after = await st(page);
    } else if (kind === 'replay') {
      await page.reload({ waitUntil: 'load', timeout: 90000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 12000));
      after = await st(page);
    } else if (kind === 'pause' || kind === 'focus-loss') {
      await page.keyboard.press('Escape').catch(() => {});
      await new Promise(r => setTimeout(r, 1500));
      const mid = await st(page);
      await page.evaluate(() => window.dispatchEvent(new Event('blur'))).catch(() => {});
      await new Promise(r => setTimeout(r, 2500));
      after = await st(page);
      after.midPause = mid;
    } else if (kind === 'quit') {
      await page.goto(`${BASE}/`, { waitUntil: 'load', timeout: 90000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 15000));
      after = await st(page);
    } else if (kind === 'completion') {
      // Re-board completes it; then fly out so the beat completes past it.
      for (let i = 0; i < 12; i++) {
        await page.keyboard.press('KeyF').catch(() => {});
        await new Promise(r => setTimeout(r, 600));
        const s = await st(page).catch(() => null);
        if (s && s.objectiveId !== 'ch8:launch:reboard') break;
      }
      await new Promise(r => setTimeout(r, 2000));
      after = await st(page);
    } else if (kind === 'sandbox') {
      await new Promise(r => setTimeout(r, 15000));
      after = await st(page);
    }
    const d = await dump(page);
    const row = d.rows.find(r => r.id === 'ch8:launch:reboard') ?? null;
    out.cases.push({ case: kind, url, reachedReboard: reached, before, after,
      reboardRow: row,
      staleObjectiveAfter: after && after.objectiveId === 'ch8:launch:reboard' && kind !== 'completion',
      totalFrames: d.frames });
    console.log(`[reset/${kind}] reached=${reached} after=${after ? after.objectiveId : null} beat=${after ? after.beat : null}`);
    await page.__ctx.close();
    write('reboard-resets.json', out);
  }
} else {
  console.error('unknown mode', mode);
}
await browser.close();
