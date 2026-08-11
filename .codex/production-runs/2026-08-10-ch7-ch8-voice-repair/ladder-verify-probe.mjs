// Paced-ladder verification probe (contract draft-v3, defect vd-01 repair).
//
// Extends voice-repair-probe.mjs's live-store instrumentation with a per-rAF
// spaceFlight sampler, so the raw surface -> non-surface phase edge and the
// first deep_space observation are stamped on the SAME pause-aware story clock
// as every caption emission. Read-only except where a mode says otherwise
// (mode `seeded` calls the exported beat-entry seam; it says so in its record).
//
// Modes (argv[2]):
//   routeA   paced scripted deep link: ignite at entry +6.0 s. --shape space |
//            space-then-w | space-then-w-sprint decides what the pilot holds
//            after ignition. Dense climb strip = the tree-findability record.
//   routeB   chained movie (ch7-board -> ch8-launch): edge-caused L2, L3 drop,
//            full frozen exit-window cadence.
//   routeC   plain deep-link movie (?story=ch8-launch&movie=1).
//   routeD   POTATO / mobile / reduced-motion ladder parity.
//   seeded   entry whose phase is already non-surface.
//
// draft-v5 closing pass (iteration 6) adds, on the same instrumentation:
//   --out <dirname>  writes under evidence/<dirname> instead of verification-v3.
//   dive     exit to deep_space, let rows stamp, dive back under the boundary,
//            hold, re-exit. Proves the R4 held exit-window clock.
//   ch7queue ch7-reconstruct movie route: per-line screen life vs
//            revealSeconds(line) + 0.4, M6 no-drop, t_M7Anchor relation.
//   ch7manual paced manual-shape ch7 run (repair stages driven with >=5 s gaps).
//   ch7mobile ch7 exit-window recapture at 390x844 and 844x390 with the live
//            touch-control container rect stamped on every frame (CIN-01).
// Every mode from this pass also bridges getEmergentStoryVoiceDiag() so the
// derived moments (l2DueAt, l2Cause, t_calibrationReceipt, t_M7Anchor, the held
// exit clock) are read from the runtime rather than inferred from emissions.
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
const { chromium } = await import(
  '/home/thomasphillip/Projects/vox/main/node_modules/playwright-core/index.mjs'
);

const RUN_DIR = path.dirname(new URL(import.meta.url).pathname);
const outArgIdx = process.argv.indexOf('--out');
const OUT_DIR = path.join(
  RUN_DIR,
  'evidence',
  outArgIdx >= 0 ? process.argv[outArgIdx + 1] : 'verification-v3'
);
const BASE = process.env.VOX_BASE ?? 'http://localhost:5176';
fs.mkdirSync(OUT_DIR, { recursive: true });

const pwDir = path.join(os.homedir(), '.cache/ms-playwright');
const chromeDir = fs.readdirSync(pwDir).filter(d => /^chromium-\d+$/.test(d)).sort().pop();
const executablePath = path.join(pwDir, chromeDir, 'chrome-linux/chrome');

const L1 = 'the pond answered every time i asked. i am leaving anyway — that is what the answers were for.';
const L2 = 'hold it. this is the only order left, and i am the one giving it.';
const L3 = 'the site gets small. the tree does not. i keep finding it.';
const L4 = 'i came down this line without being asked. i am going back up it on purpose.';
const REVEAL_MS_PER_CHAR = 34;

const INSTALL = `(() => {
  const w = window;
  if (w.__voxProbe) return;
  const events = [];
  w.__voxProbe = { events, ready: false, error: null };
  const stamp = (e) => {
    const now = w.__voxProbeClock ? w.__voxProbeClock() : performance.now();
    // draft-v5 R4: every emission carries the director's OWN held exit-window
    // value and beat-runtime elapsed at the instant it fired, so a row's place
    // in the frozen table is read off the held clock rather than wall time.
    let held = null, dElapsed = null, dBeat = null;
    try {
      if (w.__voxDiag) {
        const d = w.__voxDiag();
        if (d) { dBeat = d.beat; dElapsed = d.elapsed; held = d.launch ? d.launch.exitHeldSeconds : null; }
      }
    } catch (err) { /* diag is read-only; a failure must never alter the run */ }
    events.push(Object.assign({ wall: performance.now(), story: now, beat: w.__storyBeat ?? null,
      heldExitSeconds: held, directorElapsed: dElapsed, directorBeat: dBeat }, e));
  };
  const boot = async () => {
    const st = await import('/src/story/storyText.ts');
    const obj = await import('/src/story/ux/objectiveDirector.ts');
    const fb = await import('/src/story/ux/feedbackCues.ts');
    const clock = await import('/src/story/storyClock.ts');
    const storyState = await import('/src/story/storyState.ts');
    const av = await import('/src/story/signedSceneAvRuntime.ts');
    const sf = await import('/src/state/spaceFlight.ts');
    const dir = await import('/src/story/emergentStoryDirector.ts');
    w.__voxProbeClock = clock.storyNow;
    w.__voxAv = () => av.getSignedSceneAvDebugSnapshot();
    // draft-v5: read-only derived-moment snapshot, bridged exactly like the AV
    // debug snapshot above. Creates no state and drives nothing.
    w.__voxDiag = () => (dir.getEmergentStoryVoiceDiag
      ? JSON.parse(JSON.stringify(dir.getEmergentStoryVoiceDiag()))
      : null);
    w.__voxFlight = () => { const f = sf.getSpaceFlightSnapshot(); return { phase: f.phase, controlMode: f.controlMode }; };
    w.__voxText = () => JSON.parse(JSON.stringify(st.getStoryText()));
    w.__voxObjective = () => {
      const o = obj.getActiveGuidedStoryObjective();
      return o ? { id: o.id, kind: o.kind, markerLabel: o.markerLabel, workOrder: [...o.workOrder],
        requiresMarker: o.requiresMarker, health: obj.getGuidedStoryObjectiveHealth() } : null;
    };
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
          shownAt: s.audit ? s.audit.shownAt : null });
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
    // Boot-time snapshot: on a cold module graph the subscription can land
    // AFTER the beat publish, and a missing entry stamp would otherwise look
    // like a missing beat. Marked initial so the host never mistakes it for a
    // measured entry.
    {
      const snap0 = storyState.getStoryStateSnapshot();
      lastBeat = snap0.beat;
      stamp({ ch: 'beat', beat: snap0.beat, active: snap0.active, initial: true });
    }
    storyState.subscribeStory(() => {
      const snap = storyState.getStoryStateSnapshot();
      if (snap.beat === lastBeat) return;
      lastBeat = snap.beat;
      stamp({ ch: 'beat', beat: snap.beat, active: snap.active, era: snap.era ?? null });
    });
    // Per-frame raw phase sampler: the accelerator edge and the exit fact are
    // physical state, not emissions, so they need their own observer.
    let prevPhase = null;
    const sample = () => {
      const f = sf.getSpaceFlightSnapshot();
      const key = f.phase + '|' + f.controlMode;
      if (key !== prevPhase) {
        prevPhase = key;
        stamp({ ch: 'flight', phase: f.phase, controlMode: f.controlMode });
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
    w.__voxFrame = () => {
      const t = clock.storyNow();
      const s = st.getStoryText();
      const f = sf.getSpaceFlightSnapshot();
      const cap = document.querySelector('[data-story-caption]');
      const lives = Array.from(document.querySelectorAll('div[aria-live="polite"]'));
      const hud = document.querySelector('[data-story-guidance-hud]');
      const audit = lives.find(el => !el.hasAttribute('data-story-caption') && !el.hasAttribute('data-story-guidance-hud'));
      const o = w.__voxObjective();
      const domCaption = cap ? cap.innerText.trim() : null;
      return {
        storyClock: t,
        beat: w.__storyBeat ?? null,
        phase: f.phase,
        controlMode: f.controlMode,
        storeCaption: s.caption ? s.caption.text : null,
        storeCaptionChars: s.caption ? s.caption.text.length : 0,
        domCaption,
        domCaptionChars: domCaption ? domCaption.length : 0,
        storeAudit: s.audit ? { header: s.audit.header ?? null, text: s.audit.text } : null,
        domAudit: audit ? audit.innerText.replace(/\\s*\\n\\s*/g, ' | ').trim() : null,
        hudDom: hud ? hud.innerText.replace(/\\s*\\n\\s*/g, ' | ').trim() : null,
        objectiveId: o ? o.id : null,
        objectiveHealth: o ? o.health : null,
        diag: w.__voxDiag ? w.__voxDiag() : null,
        av: (() => {
          if (!w.__voxAv) return null;
          try {
            const a = w.__voxAv();
            return {
              beat: a.beat, anchorId: a.anchorId, active: a.active,
              cameraAuthority: a.shot ? a.shot.cameraAuthority : null,
              appliedFovDeg: a.shot ? a.shot.lens.appliedFovDeg : null,
              transitionType: a.shot ? a.shot.transitionType : null,
              declaredCut: a.shot ? a.shot.declaredCut : null,
              shotId: a.shot ? a.shot.id : null,
              activeEffectIds: a.postFx ? [...a.postFx.activeEffectIds] : [],
              activatedAnchorIds: [...a.activatedAnchorIds],
              scoreCueRefs: a.score ? [...a.score.cueRefs] : []
            };
          } catch (e) { return { error: String(e).slice(0, 120) }; }
        })(),
        captionRect: cap ? (r => ({ x: Math.round(r.x), y: Math.round(r.y),
          w: Math.round(r.width), h: Math.round(r.height) }))(cap.getBoundingClientRect()) : null,
        touchRects: (() => {
          // CIN-01. Every on-screen touch control container that is actually
          // laid out, so a caption/control collision is a measured rect overlap
          // rather than a reading of the pixels.
          const sel = '[data-touch-controls], [data-mobile-controls], [class*="touch"], [class*="Touch"], button';
          return Array.from(document.querySelectorAll(sel))
            .map(el => ({ el, r: el.getBoundingClientRect() }))
            .filter(({ r }) => r.width > 8 && r.height > 8
              && r.bottom > 0 && r.top < window.innerHeight
              && r.right > 0 && r.left < window.innerWidth)
            .slice(0, 24)
            .map(({ el, r }) => ({
              tag: el.tagName.toLowerCase(),
              id: el.getAttribute('data-touch-controls') ?? el.id ?? null,
              cls: (el.className && typeof el.className === 'string' ? el.className : '').slice(0, 60),
              label: (el.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 24),
              x: Math.round(r.x), y: Math.round(r.y),
              w: Math.round(r.width), h: Math.round(r.height)
            }));
        })(),
        viewport: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio }
      };
    };
    w.__voxProbe.ready = true;
  };
  let tries = 0;
  const attempt = () => {
    tries++;
    boot().catch((e) => {
      w.__voxProbe.error = String(e).slice(0, 200);
      if (tries < 80) setTimeout(attempt, 100);
    });
  };
  attempt();
})();`;

const launch = () => chromium.launch({
  executablePath,
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--window-size=1280,720']
});

async function newPage(browser, opts = {}) {
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

const readEvents = (page) => page.evaluate(() => (window.__voxProbe ? window.__voxProbe.events : []));
const frameState = (page) => page.evaluate(() => (window.__voxFrame ? window.__voxFrame() : null));
const nowClock = (page) => page.evaluate(() => (window.__voxProbeClock ? window.__voxProbeClock() : performance.now()));

const write = (name, data) => {
  const p = path.join(OUT_DIR, name);
  fs.writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`);
  console.log('wrote', p);
};

const arg = (flag, dflt) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : dflt;
};

/**
 * Waits for the beat and returns its story-clock stamp.
 *
 * The store subscription can lose the race with the publish on a warm module
 * graph, so the primary observer is the app's own `window.__storyBeat` mirror
 * polled from the host, converted onto the story clock (storyNow() is
 * performance.now() minus accumulated pause, and nothing is paused here; the
 * measured offset is recorded on every run).
 */
async function waitForBeat(page, beat, capMs) {
  const deadline = Date.now() + capMs;
  let raw = null;
  while (Date.now() < deadline) {
    const s = await page.evaluate(() => ({
      beat: window.__storyBeat ?? null,
      wall: performance.now(),
      story: window.__voxProbeClock ? window.__voxProbeClock() : null
    })).catch(() => null);
    if (s && s.beat === beat) { raw = s; break; }
    await new Promise(r => setTimeout(r, 30));
  }
  if (!raw) return null;
  // Prefer the subscription stamp when the probe won the race: it is exact.
  const evs = await readEvents(page).catch(() => []);
  const exact = evs.find(e => e.ch === 'beat' && e.beat === beat && !e.initial);
  if (exact) return { ...exact, observer: 'store-subscription' };
  const conv = await page.evaluate(() => ({
    wall: performance.now(),
    story: window.__voxProbeClock ? window.__voxProbeClock() : null
  })).catch(() => null);
  const offset = conv && conv.story !== null ? conv.story - conv.wall : 0;
  return { story: raw.wall + offset, wall: raw.wall, beat,
    observer: 'window.__storyBeat poll', clockOffsetMs: Number(offset.toFixed(2)) };
}

/** Blocks until the page-side instrumentation is installed. */
async function waitForProbeReady(page, capMs = 30000) {
  const deadline = Date.now() + capMs;
  while (Date.now() < deadline) {
    const ready = await page.evaluate(() => Boolean(window.__voxProbe && window.__voxProbe.ready)).catch(() => false);
    if (ready) return true;
    await new Promise(r => setTimeout(r, 50));
  }
  return false;
}

/** One throwaway load so the dev-server module graph is warm for run 1. */
async function warmUp(browser, url) {
  const page = await newPage(browser, {});
  await page.goto(url, { waitUntil: 'load', timeout: 90000 }).catch(() => {});
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const ready = await page.evaluate(() => Boolean(window.__voxProbe && window.__voxProbe.ready)).catch(() => false);
    if (ready) break;
    await new Promise(r => setTimeout(r, 200));
  }
  await new Promise(r => setTimeout(r, 3000));
  await page.__ctx.close();
}

/**
 * One climb-window capture session. Shoots a dense strip and any scheduled
 * absolute-story-time targets; every frame records its own measured clock so
 * shutter latency is visible rather than assumed.
 */
async function captureSession(page, dir, opts) {
  const {
    entryStory, stripIntervalMs = 200, stopWhen, capMs, targets = [], onState = null,
    action = null
  } = opts;
  const burstWindows = opts.burstWindows ?? [];
  fs.mkdirSync(dir, { recursive: true });
  const frames = [];
  const pending = targets.map(t => ({ ...t, taken: false }));
  const deadline = Date.now() + capMs;
  let index = 0;
  let lastStrip = -1e9;
  const shoot = async (label, state) => {
    const rel = ((state.storyClock - entryStory) / 1000).toFixed(2).replace('.', 'p');
    const name = `${String(index).padStart(3, '0')}_${label}_t${rel}s_${state.beat ?? 'null'}_${state.phase}.png`;
    const t0 = Date.now();
    await page.screenshot({ path: path.join(dir, name) }).catch(() => {});
    const after = await nowClock(page).catch(() => state.storyClock);
    frames.push({
      file: name,
      label,
      shutterOpenStoryClock: Number(state.storyClock.toFixed(1)),
      shutterSpanMs: Number((after - state.storyClock).toFixed(1)),
      hostShutterMs: Date.now() - t0,
      entryOffsetSeconds: Number(((state.storyClock - entryStory) / 1000).toFixed(3)),
      beat: state.beat,
      phase: state.phase,
      controlMode: state.controlMode,
      storeCaption: state.storeCaption,
      domCaption: state.domCaption,
      domCaptionChars: state.domCaptionChars,
      storeCaptionChars: state.storeCaptionChars,
      revealComplete: state.storeCaption !== null && state.domCaptionChars >= state.storeCaptionChars,
      storeAudit: state.storeAudit,
      hudDom: state.hudDom,
      objectiveId: state.objectiveId,
      objectiveHealth: state.objectiveHealth,
      diag: state.diag,
      av: state.av,
      captionRect: state.captionRect,
      touchRects: state.touchRects,
      // CIN-05. Every field above is sampled BEFORE page.screenshot() opens the
      // shutter; shutterSpanMs bounds how far the world could have moved during
      // the exposure. No field in this record is post-shutter.
      stateReadOrder: 'state-before-shutter',
      viewport: state.viewport
    });
    index++;
  };
  while (Date.now() < deadline) {
    const state = await frameState(page).catch(() => null);
    if (!state) break;
    if (action) await action(state);
    if (onState) {
      const extra = onState(
        state,
        (id, at) => pending.push({ id, at, taken: false }),
        (from, to) => burstWindows.push({ from, to })
      );
      if (extra === 'stop') break;
    }
    const due = pending.find(t => !t.taken && state.storyClock >= t.at);
    const inBurst = burstWindows.some(w => state.storyClock >= w.from && state.storyClock <= w.to);
    if (due) {
      due.taken = true;
      await shoot(due.id, state);
    } else if (inBurst) {
      await shoot('burst', state);
      lastStrip = state.storyClock;
    } else if (state.storyClock - lastStrip >= stripIntervalMs) {
      lastStrip = state.storyClock;
      await shoot('strip', state);
    } else {
      await new Promise(r => setTimeout(r, 25));
    }
    if (stopWhen && stopWhen(state)) break;
  }
  return { frames, unmetTargets: pending.filter(t => !t.taken).map(t => t.id) };
}

/** Derives ladder facts from one run's event list. */
function analyse(events, entryStory) {
  const rel = (ms) => Number(((ms - entryStory) / 1000).toFixed(3));
  const capAt = (text) => {
    const e = events.find(x => x.ch === 'caption' && x.text === text);
    return e ? rel(e.story) : null;
  };
  const flight = events.filter(e => e.ch === 'flight');
  let edge = null;
  for (let i = 0; i < flight.length; i++) {
    const cur = flight[i];
    const prev = flight[i - 1];
    if (cur.phase !== 'surface' && cur.controlMode === 'flight'
      && (prev ? prev.phase === 'surface' : false)) { edge = rel(cur.story); break; }
  }
  const deepEv = flight.find(e => e.phase === 'deep_space');
  const captions = events.filter(e => e.ch === 'caption' && e.text);
  const count = (text) => captions.filter(c => c.text === text).length;
  return {
    tEntrySeconds: 0,
    tL1: capAt(L1), tL2: capAt(L2), tL3: capAt(L3), tL4: capAt(L4),
    tPhaseEdge: edge,
    tDeepSpace: deepEv ? rel(deepEv.story) : null,
    l1Count: count(L1), l2Count: count(L2), l3Count: count(L3), l4Count: count(L4),
    captionOrder: captions.map(c => ({ t: rel(c.story), text: c.text })),
    auditOrder: events.filter(e => e.ch === 'audit' && e.text).map(e => ({ t: rel(e.story), header: e.header, text: e.text })),
    objectives: events.filter(e => e.ch === 'objective').map(e => ({ t: rel(e.story), id: e.objective ? e.objective.id : null, health: e.objective ? e.objective.health : null })),
    beats: events.filter(e => e.ch === 'beat').map(e => ({ t: rel(e.story), beat: e.beat })),
    flightPhases: flight.map(e => ({ t: rel(e.story), phase: e.phase, controlMode: e.controlMode }))
  };
}

function ladderAssertions(a) {
  const near = (x, y, tol) => x !== null && y !== null && Math.abs(x - y) <= tol;
  const tol = 0.05; // one director tick at 60 Hz plus sampler jitter
  const out = {};
  if (a.tL1 !== null && a.tL2 !== null) {
    const expected = a.tPhaseEdge === null
      ? a.tL1 + 4.5
      : Math.min(a.tL1 + 4.5, a.tPhaseEdge);
    out.l2Formula = { expectedSeconds: Number(expected.toFixed(3)), measuredSeconds: a.tL2,
      deltaSeconds: Number((a.tL2 - expected).toFixed(3)), pass: near(a.tL2, expected, tol),
      cause: a.tPhaseEdge !== null && Math.abs(a.tL2 - a.tPhaseEdge) <= tol ? 'phase-edge' : 'timer' };
  } else out.l2Formula = { pass: false, note: 'L1 or L2 absent' };
  if (a.tL2 !== null && a.tL3 !== null) {
    const expected = Math.max(a.tPhaseEdge ?? -Infinity, a.tL2 + 3.0);
    out.l3Formula = { expectedSeconds: Number(expected.toFixed(3)), measuredSeconds: a.tL3,
      deltaSeconds: Number((a.tL3 - expected).toFixed(3)), pass: near(a.tL3, expected, tol) };
  } else out.l3Formula = { pass: null, note: 'L3 not rendered (drop rule or route ended first)' };
  if (a.tL3 !== null && a.tDeepSpace !== null) {
    const revealSeconds = L3.length * REVEAL_MS_PER_CHAR / 1000;
    out.c3Margin = {
      l3RevealSeconds: Number(revealSeconds.toFixed(3)),
      marginSeconds: Number((a.tDeepSpace - (a.tL3 + revealSeconds)).toFixed(3)),
      strictlyBefore: a.tDeepSpace > a.tL3 + revealSeconds,
      underTriadFlagThreshold: (a.tDeepSpace - (a.tL3 + revealSeconds)) < 0.3
    };
  } else out.c3Margin = { marginSeconds: null, note: a.tL3 === null ? 'L3 dropped' : 'no deep_space observed' };
  out.onceOnly = { l1: a.l1Count <= 1, l2: a.l2Count <= 1, l3: a.l3Count <= 1,
    counts: { l1: a.l1Count, l2: a.l2Count, l3: a.l3Count } };
  const seq = a.captionOrder.filter(c => [L1, L2, L3].includes(c.text)).map(c => c.text);
  const canonical = [L1, L2, L3].filter(t => seq.includes(t));
  out.order = { observed: seq.map(t => t === L1 ? 'L1' : t === L2 ? 'L2' : 'L3'),
    pass: JSON.stringify(seq) === JSON.stringify(canonical) };
  return out;
}

const revealSeconds = (line) => (line.length * REVEAL_MS_PER_CHAR) / 1000;

/**
 * The director resets its whole beat runtime on beat entry, so a diag read
 * AFTER the advance to ch8-crossing is zeroed. The authoritative snapshot is
 * therefore the richest ch8-launch-scoped diag observed while the beat was
 * live — taken from the strip's own per-frame reads, which are all
 * state-before-shutter.
 */
function pickLaunchDiag(frames, live) {
  const scoped = frames
    .map(f => f.diag)
    .filter(d => d && d.beat === 'ch8-launch' && d.launch);
  if (scoped.length === 0) return live && live.beat === 'ch8-launch' ? live : (live ?? null);
  return scoped.reduce((best, d) => {
    const score = (x) => (x.launch.t_L1 >= 0 ? 1 : 0) + (x.launch.t_L2 >= 0 ? 1 : 0)
      + (x.launch.t_L3 >= 0 ? 1 : 0) + (x.launch.exitHeldSeconds > 0 ? 1 : 0)
      + x.launch.exitHeldSeconds / 1000;
    return score(d) >= score(best) ? d : best;
  });
}

/**
 * draft-v5 R1. Checks the emitted L2 moment against the runtime's OWN derived
 * due time and cause taxonomy, rather than re-deriving the formula host-side.
 * `entryStory` converts the diag's beat-runtime seconds onto the run's relative
 * axis (the director's runtime.elapsed is already beat-relative, so the two
 * axes coincide once the entry offset is removed).
 */
function diagLadderAssertions(diag, a, expectedCause) {
  if (!diag || !diag.launch) return { pass: false, note: 'no diag snapshot' };
  const L = diag.launch;
  const tol = 0.05;
  const out = {
    l2DueAtSeconds: L.l2DueAt >= 0 ? Number(L.l2DueAt.toFixed(3)) : null,
    l2Cause: L.l2Cause,
    diagTL1: L.t_L1 >= 0 ? Number(L.t_L1.toFixed(3)) : null,
    diagTL2: L.t_L2 >= 0 ? Number(L.t_L2.toFixed(3)) : null,
    diagTL3: L.t_L3 >= 0 ? Number(L.t_L3.toFixed(3)) : null,
    diagTPhaseEdge: L.t_phaseEdge >= 0 ? Number(L.t_phaseEdge.toFixed(3)) : null,
    diagTDeepSpace: L.t_deepSpace >= 0 ? Number(L.t_deepSpace.toFixed(3)) : null,
    exitHeldSeconds: Number(L.exitHeldSeconds.toFixed(3))
  };
  // t_L2 = l2DueAt within one director tick: the latch fires on the first tick
  // at or after the due time, so the emission can only be late, never early.
  if (L.t_L2 >= 0 && L.l2DueAt >= 0) {
    out.l2FiresAtDueTime = {
      diffSeconds: Number((L.t_L2 - L.l2DueAt).toFixed(4)),
      pass: L.t_L2 >= L.l2DueAt - 1e-6 && L.t_L2 - L.l2DueAt <= tol
    };
  } else out.l2FiresAtDueTime = { pass: false, note: 'L2 never fired' };
  // The reveal guard, re-derived from the frozen string and compared with the
  // runtime's own number so a string edit cannot silently pass.
  if (L.t_L1 >= 0 && L.l2DueAt >= 0) {
    const guard = L.t_L1 + revealSeconds(L1);
    const timer = L.t_L1 + 4.5;
    const pulled = L.t_phaseEdge < 0 ? timer : Math.min(timer, L.t_phaseEdge);
    const expected = Math.max(guard, pulled);
    out.dueTimeFormula = {
      l1RevealSeconds: Number(revealSeconds(L1).toFixed(3)),
      revealGuardAt: Number(guard.toFixed(3)),
      timerAt: Number(timer.toFixed(3)),
      pulledAt: Number(pulled.toFixed(3)),
      expectedDueAt: Number(expected.toFixed(3)),
      deltaSeconds: Number((L.l2DueAt - expected).toFixed(4)),
      pass: Math.abs(L.l2DueAt - expected) <= 1e-6
    };
    out.l1RevealNeverCut = {
      revealCompleteAt: Number(guard.toFixed(3)),
      l2At: L.t_L2 >= 0 ? Number(L.t_L2.toFixed(3)) : null,
      marginSeconds: L.t_L2 >= 0 ? Number((L.t_L2 - guard).toFixed(3)) : null,
      pass: L.t_L2 < 0 ? null : L.t_L2 >= guard - 1e-6
    };
  }
  if (expectedCause) {
    out.causeAssertion = { expected: expectedCause, measured: L.l2Cause,
      pass: L.l2Cause === expectedCause };
  }
  // Route A margin, computed from the diag's own moments (contract [22]).
  if (L.t_L3 >= 0 && L.t_deepSpace >= 0) {
    const margin = L.t_deepSpace - (L.t_L3 + revealSeconds(L3));
    out.marginFromDiag = {
      l3RevealSeconds: Number(revealSeconds(L3).toFixed(3)),
      marginSeconds: Number(margin.toFixed(3)),
      floorSeconds: 0.3,
      aboveFloor: margin >= 0.3,
      flagBackToTriad: margin < 0.3
    };
  } else out.marginFromDiag = { marginSeconds: null,
    note: L.t_L3 < 0 ? 'L3 dropped (authored degradation family)' : 'no deep_space' };
  if (a) {
    out.emissionVsDiag = {
      l1DeltaSeconds: a.tL1 !== null && L.t_L1 >= 0 ? Number((a.tL1 - L.t_L1).toFixed(3)) : null,
      l2DeltaSeconds: a.tL2 !== null && L.t_L2 >= 0 ? Number((a.tL2 - L.t_L2).toFixed(3)) : null,
      note: 'host emission axis minus director beat-runtime axis; a constant offset is the beat-entry lag, not a defect'
    };
  }
  return out;
}

/** Frozen ch8 exit-window cadence, measured off the L4 origin. */
function exitWindowAssertions(a) {
  const table = [
    { id: 'L4 atmosphere-exit caption', at: 0.0, kind: 'caption', text: L4 },
    { id: 'stack row 1', at: 2.0, kind: 'audit', text: 'AUTOMATED CONTACT · SITE 7C-θ · HULL LOGGED: DESTROYED' },
    { id: 'stack row 2', at: 4.0, kind: 'audit', text: 'REGISTRY QUERY · STATE DESIGNATION.' },
    { id: 'stack row 3', at: 6.0, kind: 'audit', text: 'NO DESIGNATION RETURNED.' },
    { id: 'contact logged', at: 8.5, kind: 'audit', text: 'CONTACT LOGGED.' },
    { id: 'designation caption', at: 11.5, kind: 'caption', text: 'they asked for a designation. what i have is not one.' },
    { id: 'L6 open query', at: 14.0, kind: 'caption', text: 'nothing answers. the query does not close.' },
    { id: 'advance to ch8-crossing', at: 17.0, kind: 'beat', text: 'ch8-crossing' }
  ];
  if (a.tL4 === null) return { origin: null, rows: [], pass: false, note: 'L4 never emitted' };
  const rows = table.map(row => {
    let t = null;
    if (row.kind === 'caption') { const m = a.captionOrder.find(c => c.text === row.text); t = m ? m.t : null; }
    if (row.kind === 'audit') { const m = a.auditOrder.find(c => c.text === row.text); t = m ? m.t : null; }
    if (row.kind === 'beat') { const m = a.beats.find(b => b.beat === row.text); t = m ? m.t : null; }
    const off = t === null ? null : Number((t - a.tL4).toFixed(3));
    return { id: row.id, contractOffsetSeconds: row.at, measuredOffsetSeconds: off,
      deltaSeconds: off === null ? null : Number((off - row.at).toFixed(3)),
      pass: off !== null && Math.abs(off - row.at) <= 0.2 };
  });
  return { originSeconds: a.tL4, rows, pass: rows.every(r => r.pass) };
}

/** Variant-D watch item: orbital-handoff publish vs stack row 1. */
function variantDOrdering(a) {
  if (a.tL4 === null) return { pass: null, note: 'no exit window' };
  const pub = a.objectives.find(o => o.id === 'ch8:launch:orbital-handoff');
  const row1 = a.auditOrder.find(x => x.text === 'AUTOMATED CONTACT · SITE 7C-θ · HULL LOGGED: DESTROYED');
  if (!pub || !row1) return { pass: false, publishOffsetSeconds: pub ? Number((pub.t - a.tL4).toFixed(3)) : null,
    stackOneOffsetSeconds: row1 ? Number((row1.t - a.tL4).toFixed(3)) : null, note: 'missing observation' };
  const p = Number((pub.t - a.tL4).toFixed(3));
  const s = Number((row1.t - a.tL4).toFixed(3));
  return { publishOffsetSeconds: p, stackOneOffsetSeconds: s,
    marginSeconds: Number((s - p).toFixed(3)), pass: p < s };
}

// --- draft-v5 closing-pass analysis ---------------------------------------

const CH7_LINES = [
  { id: 'M1', text: 'the wreck that brought me here will leave here. i will build the leaving.' },
  { id: 'M2', text: 'the keel takes the weight first. everything after this is allowed to be heavy.' },
  { id: 'M3', text: 'it remembers a straight line and goes back to it without being told. i watch that closely.' },
  { id: 'M4', text: 'i closed it, and something inside started listening again. i did that too.' },
  { id: 'M5', text: "the ground's hold is a habit, not a law." },
  { id: 'M6', text: 'the last part is the part that thinks. i am being watched now. i put it in anyway.' }
];
const CH7_M7_AUDIT = 'UNSCHEDULED HULL · SITE 7C-θ · INTEREST RAISED';
const CH7_M7_CAPTION = 'nothing has asked yet. something has started paying attention.';
const CH7_EXIT_CAPTION = 'the scar remains. now it can carry me.';
const CH7_STAGE_DWELL_SECONDS = 0.4;

/** Same reset problem as the launch diag: read the beat-scoped snapshot. */
function pickReconstructDiag(frames, live) {
  const scoped = frames.map(f => f.diag).filter(d => d && d.beat === 'ch7-reconstruct' && d.reconstruct);
  if (scoped.length === 0) return live ?? null;
  return scoped.reduce((best, d) => {
    const score = (x) => (x.reconstruct.t_M6 >= 0 ? 1 : 0)
      + (x.reconstruct.t_calibrationReceipt >= 0 ? 1 : 0)
      + (x.reconstruct.t_M7Anchor >= 0 ? 1 : 0);
    return score(d) >= score(best) ? d : best;
  });
}

/**
 * Screen life of every ch7 stage line: the interval from its own emission to
 * whatever next takes the single caption slot. The queue guard's obligation is
 * screenLife >= revealSeconds(line) + 0.4 s.
 */
function ch7QueueAssertions(events, entryStory, diag) {
  const rel = (ms) => Number(((ms - entryStory) / 1000).toFixed(3));
  const caps = events.filter(e => e.ch === 'caption' && e.text);
  const byText = (t) => caps.filter(c => c.text === t);
  const lines = [];
  for (const l of CH7_LINES) {
    const hits = byText(l.text);
    if (hits.length === 0) { lines.push({ id: l.id, fired: false, count: 0, dropped: true }); continue; }
    const first = hits[0];
    const next = caps.find(c => c.story > first.story);
    const endStory = next ? next.story : null;
    const required = revealSeconds(l.text) + CH7_STAGE_DWELL_SECONDS;
    lines.push({
      id: l.id, fired: true, count: hits.length,
      atSeconds: rel(first.story),
      chars: l.text.length,
      revealSeconds: Number(revealSeconds(l.text).toFixed(3)),
      requiredScreenLifeSeconds: Number(required.toFixed(3)),
      replacedBy: next ? (CH7_LINES.find(x => x.text === next.text) || {}).id
        ?? (next.text === CH7_M7_CAPTION ? 'M7-caption'
          : next.text === CH7_EXIT_CAPTION ? 'exit-line' : 'other') : null,
      screenLifeSeconds: endStory === null ? null : Number(((endStory - first.story) / 1000).toFixed(3)),
      slackSeconds: endStory === null ? null
        : Number((((endStory - first.story) / 1000) - required).toFixed(3)),
      meetsRevealPlusDwell: endStory === null ? null
        : ((endStory - first.story) / 1000) >= required - 0.02,
      meetsRevealOnly: endStory === null ? null
        : ((endStory - first.story) / 1000) >= revealSeconds(l.text) - 0.02
    });
  }
  const measured = lines.filter(l => typeof l.slackSeconds === 'number' && Number.isFinite(l.slackSeconds));
  const order = caps.filter(c => CH7_LINES.some(l => l.text === c.text))
    .map(c => CH7_LINES.find(l => l.text === c.text).id);
  const canonical = CH7_LINES.map(l => l.id).filter(id => order.includes(id));
  const r = diag && diag.reconstruct ? diag.reconstruct : null;
  const m6RevealDone = r && r.t_M6 >= 0 ? r.t_M6 + revealSeconds(CH7_LINES[5].text) : null;
  const receiptAudit = events.find(e => e.ch === 'audit' && e.text === CH7_M7_AUDIT);
  return {
    lines,
    minSlackSeconds: measured.length ? Number(Math.min(...measured.map(l => l.slackSeconds)).toFixed(3)) : null,
    allMeetRevealPlusDwell: measured.every(l => l.meetsRevealPlusDwell === true),
    allMeetRevealOnly: measured.every(l => l.meetsRevealOnly === true),
    measuredLineCount: measured.length,
    droppedLines: lines.filter(l => !l.fired).map(l => l.id),
    m6Dropped: !lines[5].fired,
    m6MayNotDropPass: lines[5].fired,
    onceOnly: lines.every(l => l.count <= 1),
    orderObserved: order,
    orderPass: JSON.stringify(order) === JSON.stringify(canonical),
    tM6: r && r.t_M6 >= 0 ? Number(r.t_M6.toFixed(3)) : null,
    tCalibrationReceipt: r && r.t_calibrationReceipt >= 0 ? Number(r.t_calibrationReceipt.toFixed(3)) : null,
    tM7Anchor: r && r.t_M7Anchor >= 0 ? Number(r.t_M7Anchor.toFixed(3)) : null,
    m6RevealDoneAtSeconds: m6RevealDone === null ? null : Number(m6RevealDone.toFixed(3)),
    // t_M7Anchor = max(t_calibrationReceipt, t_M6 + revealSeconds(M6)).
    anchorFormulaPass: r && r.t_M7Anchor >= 0 && r.t_calibrationReceipt >= 0
      ? Math.abs(r.t_M7Anchor - Math.max(r.t_calibrationReceipt, m6RevealDone ?? -1)) <= 1e-6
      : null,
    anchorEqualsReceipt: r && r.t_M7Anchor >= 0 && r.t_calibrationReceipt >= 0
      ? Math.abs(r.t_M7Anchor - r.t_calibrationReceipt) <= 1e-6 : null,
    anchorShiftSeconds: r && r.t_M7Anchor >= 0 && r.t_calibrationReceipt >= 0
      ? Number((r.t_M7Anchor - r.t_calibrationReceipt).toFixed(3)) : null,
    queueDrainedAtReceipt: r ? r.queuedCaptions.length === 0 : null,
    // The exit cadence must be real-time off the anchor.
    exitCadence: (() => {
      const at = (t, ch) => { const e = events.find(x => x.ch === ch && x.text === t); return e ? rel(e.story) : null; };
      const originRel = receiptAudit ? rel(receiptAudit.story) : null;
      const rows = [
        { id: 'M7 audit', contractOffsetSeconds: 0.0, measuredAtSeconds: at(CH7_M7_AUDIT, 'audit') },
        { id: 'M7 caption', contractOffsetSeconds: 0.6, measuredAtSeconds: at(CH7_M7_CAPTION, 'caption') },
        { id: 'exit line', contractOffsetSeconds: 3.0, measuredAtSeconds: at(CH7_EXIT_CAPTION, 'caption') },
        { id: 'advance to ch7-board', contractOffsetSeconds: 5.0,
          measuredAtSeconds: (() => { const b = events.find(e => e.ch === 'beat' && e.beat === 'ch7-board'); return b ? rel(b.story) : null; })() }
      ];
      return rows.map(row => {
        const off = row.measuredAtSeconds === null || originRel === null
          ? null : Number((row.measuredAtSeconds - originRel).toFixed(3));
        return { ...row, measuredOffsetSeconds: off,
          deltaSeconds: off === null ? null : Number((off - row.contractOffsetSeconds).toFixed(3)),
          pass: off !== null && Math.abs(off - row.contractOffsetSeconds) <= 0.2 };
      });
    })(),
    retiredStringEmitted: caps.some(c => /^\(/.test(c.text))
  };
}

/** cap.ch7.exit-window frame obligations, read off state-before-shutter fields. */
function exitWindowFrameAssertions(frames) {
  const anchored = frames.filter(f => f.label.startsWith('anchor+'));
  return anchored.map(f => ({
    file: f.file,
    targetOffsetSeconds: Number(f.label.replace('anchor+', '')),
    measuredEntryOffsetSeconds: f.entryOffsetSeconds,
    beat: f.beat,
    appliedFovDeg: f.av && f.av.appliedFovDeg !== undefined ? f.av.appliedFovDeg : null,
    cameraAuthority: f.av && f.av.cameraAuthority !== undefined ? f.av.cameraAuthority : null,
    activeEffectIds: f.av && Array.isArray(f.av.activeEffectIds) ? f.av.activeEffectIds : null,
    avError: f.av && f.av.error ? f.av.error : null,
    fovIs52: f.av && typeof f.av.appliedFovDeg === 'number' ? Math.abs(f.av.appliedFovDeg - 52) <= 0.5 : null,
    authorityIsCinematicLook: f.av && f.av.cameraAuthority !== undefined ? f.av.cameraAuthority === 'cinematic-look' : null,
    hasReconstruct09: f.av && Array.isArray(f.av.activeEffectIds) ? f.av.activeEffectIds.includes('fx.reconstruct.09') : null,
    storeCaption: f.storeCaption,
    domCaption: f.domCaption,
    revealComplete: f.revealComplete,
    storeAudit: f.storeAudit,
    shutterSpanMs: f.shutterSpanMs
  }));
}

/**
 * CIN-01. A measured rect overlap between the caption band and any laid-out
 * touch-control container, reported per frame. No pixel reading is involved.
 */
function touchCollisionAssertions(frames) {
  const overlap = (a, b) => {
    const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
    const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    return x * y;
  };
  const rows = frames
    .filter(f => f.captionRect && f.storeCaption)
    .map(f => {
      const hits = (f.touchRects || [])
        .map(t => ({ ...t, overlapPx: overlap(f.captionRect, t) }))
        .filter(t => t.overlapPx > 0)
        .sort((a, b) => b.overlapPx - a.overlapPx);
      return { file: f.file, label: f.label, beat: f.beat, viewport: f.viewport,
        captionRect: f.captionRect, collidingControls: hits,
        collides: hits.length > 0,
        maxOverlapPx: hits.length ? hits[0].overlapPx : 0 };
    });
  return { framesWithCaption: rows.length,
    collidingFrames: rows.filter(r => r.collides).length,
    worstOverlapPx: rows.length ? Math.max(0, ...rows.map(r => r.maxOverlapPx)) : 0,
    rows };
}

/** Ruling R4 held-clock behaviour over one dive-and-climb run. */
function diveAssertions(record, events) {
  const s = record.stages;
  const samples = record.samples;
  const dipSamples = samples.filter(x => s.dipStartAt !== null && s.resumeAt !== null
    && x.t >= s.dipStartAt && x.t <= s.resumeAt && x.phase !== 'deep_space');
  const heldDuringDip = dipSamples.map(x => x.held).filter(x => x !== null);
  const dipRows = events.filter(e => (e.ch === 'caption' || e.ch === 'audit') && e.text
    && s.dipStartAt !== null && s.resumeAt !== null
    && (e.story - record.entryStoryClock) / 1000 > s.dipStartAt
    && (e.story - record.entryStoryClock) / 1000 < s.resumeAt);
  const windowRows = [
    { id: 'L4 atmosphere-exit caption', at: 0.0, ch: 'caption', text: 'i came down this line without being asked. i am going back up it on purpose.' },
    { id: 'stack row 1', at: 2.0, ch: 'audit', text: 'AUTOMATED CONTACT · SITE 7C-θ · HULL LOGGED: DESTROYED' },
    { id: 'stack row 2', at: 4.0, ch: 'audit', text: 'REGISTRY QUERY · STATE DESIGNATION.' },
    { id: 'stack row 3', at: 6.0, ch: 'audit', text: 'NO DESIGNATION RETURNED.' },
    { id: 'contact logged', at: 8.5, ch: 'audit', text: 'CONTACT LOGGED.' },
    { id: 'designation caption', at: 11.5, ch: 'caption', text: 'they asked for a designation. what i have is not one.' },
    { id: 'L6 open query', at: 14.0, ch: 'caption', text: 'nothing answers. the query does not close.' }
  ].map(row => {
    const hits = events.filter(e => e.ch === row.ch && e.text === row.text);
    const first = hits[0];
    return { id: row.id, contractHeldOffsetSeconds: row.at,
      fireCount: hits.length, onceOnly: hits.length <= 1,
      heldAtEmissionSeconds: first && first.heldExitSeconds !== null
        ? Number(first.heldExitSeconds.toFixed(3)) : null,
      deltaSeconds: first && first.heldExitSeconds !== null
        ? Number((first.heldExitSeconds - row.at).toFixed(3)) : null,
      pass: Boolean(first) && first.heldExitSeconds !== null
        && Math.abs(first.heldExitSeconds - row.at) <= 0.2 && hits.length <= 1 };
  });
  const emittedTimes = windowRows.filter(r => r.heldAtEmissionSeconds !== null)
    .map(r => r.heldAtEmissionSeconds).sort((a, b) => a - b);
  let minGap = null;
  for (let i = 1; i < emittedTimes.length; i++) {
    const g = emittedTimes[i] - emittedTimes[i - 1];
    if (minGap === null || g < minGap) minGap = Number(g.toFixed(3));
  }
  const advSample = samples.filter(x => x.beat === 'ch8-crossing')[0] ?? null;
  const lastLaunchSample = [...samples].reverse().find(x => x.beat === 'ch8-launch' && x.held !== null) ?? null;
  return {
    clockFrozenDuringDip: {
      heldAtDipStart: s.heldAtDipStart,
      heldAtDipEnd: s.heldAtDipEnd,
      driftSeconds: s.heldAtDipStart !== null && s.heldAtDipEnd !== null
        ? Number((s.heldAtDipEnd - s.heldAtDipStart).toFixed(4)) : null,
      maxHeldObservedDuringDip: heldDuringDip.length ? Number(Math.max(...heldDuringDip).toFixed(4)) : null,
      dipSampleCount: dipSamples.length,
      dipWallSeconds: s.dipStartAt !== null && s.resumeAt !== null
        ? Number((s.resumeAt - s.dipStartAt).toFixed(3)) : null,
      pass: s.heldAtDipStart !== null && s.heldAtDipEnd !== null
        && Math.abs(s.heldAtDipEnd - s.heldAtDipStart) <= 0.05
    },
    noRowsDuringDip: { count: dipRows.length,
      rows: dipRows.map(e => ({ ch: e.ch, text: e.text })), pass: dipRows.length === 0 },
    resumedFromHeldValue: {
      heldAtResume: s.heldAtResume,
      heldAtDipEnd: s.heldAtDipEnd,
      regressionSeconds: s.heldAtResume !== null && s.heldAtDipEnd !== null
        ? Number((s.heldAtResume - s.heldAtDipEnd).toFixed(4)) : null,
      pass: s.heldAtResume !== null && s.heldAtDipEnd !== null
        && s.heldAtResume >= s.heldAtDipEnd - 1e-6
        && s.heldAtResume - s.heldAtDipEnd <= 0.2
    },
    noRowReFired: { pass: windowRows.every(r => r.onceOnly),
      repeated: windowRows.filter(r => !r.onceOnly).map(r => r.id) },
    noBurst: { minInterRowHeldGapSeconds: minGap,
      pass: minGap === null || minGap >= 1.0,
      note: 'the tightest frozen-table gap is 2.0 s; anything under 1.0 s would be a catch-up burst' },
    windowRows,
    advance: {
      advancedAtEntryOffsetSeconds: s.advancedAt,
      heldAtLastLaunchSample: lastLaunchSample ? lastLaunchSample.held : null,
      phaseAtAdvance: advSample ? advSample.phase : null,
      heldAtLeast17: lastLaunchSample ? lastLaunchSample.held >= 17.0 - 0.2 : null,
      phaseWasDeepSpace: lastLaunchSample ? lastLaunchSample.phase === 'deep_space' : null,
      pass: Boolean(advSample) && Boolean(lastLaunchSample)
        && lastLaunchSample.held >= 17.0 - 0.2 && lastLaunchSample.phase === 'deep_space'
    }
  };
}

const mode = process.argv[2];
const runs = Number(arg('--runs', '3'));
const browser = await launch();

if (mode === 'routeA') {
  // Paced scripted deep link. `shape` is what the pilot holds after ignition;
  // it is recorded because the measured exit time depends on it entirely.
  const shape = arg('--shape', 'space');
  const igniteAt = Number(arg('--ignite', '6.0'));
  const tag = arg('--tag', shape);
  const out = { mode, shape, tag, igniteAtEntryOffsetSeconds: igniteAt, base: BASE,
    capturedAt: new Date().toISOString(), runs: [] };
  await warmUp(browser, `${BASE}/?story=ch8-launch&profile=LOW`);
  for (let i = 0; i < runs; i++) {
    const page = await newPage(browser, {});
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(String(e).slice(0, 300)));
    const url = `${BASE}/?story=ch8-launch&profile=LOW`;
    await page.goto(url, { waitUntil: 'load', timeout: 90000 }).catch(() => {});
    const entry = await waitForBeat(page, 'ch8-launch', 90000);
    const dir = path.join(OUT_DIR, `routeA-${tag}-run${i + 1}`);
    const record = { run: i + 1, url, shape, pageErrors, entryStoryClock: entry ? entry.story : null };
    if (!entry) {
      out.runs.push({ ...record, failed: 'beat never published' });
      console.log(`[routeA/${shape}] run ${i + 1} FAILED: beat never published`);
      await page.__ctx.close();
      continue;
    }
    record.entryObserver = entry.observer ?? null;
    record.entryClockOffsetMs = entry.clockOffsetMs ?? null;
    record.probeReady = await waitForProbeReady(page);
    await page.mouse.click(640, 360).catch(() => {});
    // Scripted ignition on the game's own clock, executed from inside the
    // capture loop so the strip starts at beat entry and L1's own frames exist.
    const igniteTarget = entry.story + igniteAt * 1000;
    let ignited = false;
    const action = async (s) => {
      if (ignited || s.storyClock < igniteTarget) return;
      ignited = true;
      record.ignitedAtEntryOffsetSeconds = Number(((s.storyClock - entry.story) / 1000).toFixed(3));
      await page.keyboard.down('Space');
      if (shape !== 'space') {
        await new Promise(r => setTimeout(r, 600));
        await page.keyboard.up('Space');
        await page.keyboard.down('KeyW');
        if (shape === 'space-then-w-sprint') await page.keyboard.down('ShiftLeft');
      }
    };
    // Dense strip from beat entry through L3 reveal-complete / exit, plus the
    // contract's named anchor frames. Targets that can only be known after the
    // fact (edge -0.3, deepSpace -0.3) are covered by burst windows and the
    // strip; every frame carries its own measured offset.
    let deepAt = null;
    let l1At = null;
    let l2At = null;
    let edgeAt = null;
    let prevPhase = null;
    const session = await captureSession(page, dir, {
      entryStory: entry.story,
      stripIntervalMs: 220,
      capMs: 75000,
      action,
      onState: (s, addTarget, addBurst) => {
        if (l1At === null && s.storeCaption === L1) {
          l1At = s.storyClock;
          addTarget('L1+0.2', l1At + 200);
          // Predicted timer slot; brackets the edge too on this route.
          addBurst(l1At + 3700, l1At + 5400);
        }
        if (edgeAt === null && prevPhase === 'surface' && s.phase !== 'surface' && s.controlMode === 'flight') {
          edgeAt = s.storyClock;
          addTarget('edge+0.2', edgeAt + 200);
        }
        prevPhase = s.phase;
        if (l2At === null && s.storeCaption === L2) {
          l2At = s.storyClock;
          addTarget('L2+0.2', l2At + 200);
          addTarget('L2+0.7', l2At + 700);
          const l3 = Math.max(edgeAt ?? -Infinity, l2At + 3000);
          addTarget('L3-0.5', l3 - 500);
          addTarget('L3+0.2', l3 + 200);
          addTarget('L3+1.0', l3 + 1000);
          addTarget('L3+2.0', l3 + 2000);
          addTarget('L3+2.5', l3 + 2500);
        }
        if (deepAt === null && s.phase === 'deep_space') {
          deepAt = s.storyClock;
          addTarget('deepSpace+0.0', s.storyClock);
          addTarget('deepSpace+0.5', s.storyClock + 500);
        }
      },
      stopWhen: (s) => (deepAt !== null && s.storyClock - deepAt > 2500)
        || (s.storyClock - entry.story > (igniteAt + 16) * 1000)
    });
    await page.keyboard.up('Space').catch(() => {});
    await page.keyboard.up('KeyW').catch(() => {});
    await page.keyboard.up('ShiftLeft').catch(() => {});
    const events = await readEvents(page);
    const a = analyse(events, entry.story);
    const liveDiag = await page.evaluate(() => (window.__voxDiag ? window.__voxDiag() : null)).catch(() => null);
    const finalDiag = pickLaunchDiag(session.frames, liveDiag);
    out.runs.push({ ...record, frameDir: path.relative(RUN_DIR, dir), frames: session.frames,
      unmetTargets: session.unmetTargets, ladder: a, assertions: ladderAssertions(a),
      finalDiag, diagAssertions: diagLadderAssertions(finalDiag, a, arg('--cause', null)), events });
    console.log(`[routeA/${shape}] run ${i + 1} L1=${a.tL1} L2=${a.tL2} L3=${a.tL3} edge=${a.tPhaseEdge} deep=${a.tDeepSpace} frames=${session.frames.length}`);
    await page.__ctx.close();
    write(`routeA-${tag}.json`, out);
  }
} else if (mode === 'routeB' || mode === 'routeC') {
  const chained = mode === 'routeB';
  const profile = arg('--profile', 'LOW');
  const variant = arg('--variant', 'desktop');
  const label = arg('--label', variant);
  const pageOpts = variant === 'mobile'
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
    : variant === 'reduced-motion' ? { reducedMotion: 'reduce' } : {};
  // Burst hints let runs 2..N shoot tight pairs around edges found in run 1.
  let edgeHint = Number(arg('--edgeHint', 'NaN'));
  let deepHint = Number(arg('--deepHint', 'NaN'));
  const out = { mode, label, profile, variant, base: BASE, capturedAt: new Date().toISOString(), runs: [] };
  await warmUp(browser, chained
    ? `${BASE}/?story=ch7-board&profile=${profile}`
    : `${BASE}/?story=ch8-launch&profile=${profile}`);
  for (let i = 0; i < runs; i++) {
    const page = await newPage(browser, pageOpts);
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(String(e).slice(0, 300)));
    const url = chained
      ? `${BASE}/?story=ch7-board&movie=1&profile=${profile}`
      : `${BASE}/?story=ch8-launch&movie=1&profile=${profile}`;
    await page.goto(url, { waitUntil: 'load', timeout: 90000 }).catch(() => {});
    const entry = await waitForBeat(page, 'ch8-launch', 120000);
    const dir = path.join(OUT_DIR, `${mode}-${label}-run${i + 1}`);
    const record = { run: i + 1, url, pageErrors, entryStoryClock: entry ? entry.story : null,
      entryObserver: entry ? (entry.observer ?? null) : null };
    if (!entry) { out.runs.push({ ...record, failed: 'ch8-launch never published' }); await page.__ctx.close(); continue; }
    record.probeReady = await waitForProbeReady(page);
    const burstWindows = [];
    if (Number.isFinite(edgeHint)) burstWindows.push({ from: entry.story + (edgeHint - 0.45) * 1000, to: entry.story + (edgeHint + 0.45) * 1000 });
    if (Number.isFinite(deepHint)) burstWindows.push({ from: entry.story + (deepHint - 0.7) * 1000, to: entry.story + (deepHint + 0.7) * 1000 });
    let deepAt = null;
    let l1At = null;
    const session = await captureSession(page, dir, {
      entryStory: entry.story,
      stripIntervalMs: 500,
      capMs: 90000,
      burstWindows,
      onState: (s, addTarget) => {
        // draft-v5 Route B: the reveal-guard clamp pair. l2DueAt is knowable the
        // instant L1 fires (t_L1 + revealSeconds(L1) on this route), so the
        // -0.1/+0.2 frames are scheduled rather than hoped for.
        if (l1At === null && s.storeCaption === L1) {
          l1At = s.storyClock;
          const predictedL2 = l1At + revealSeconds(L1) * 1000;
          addTarget('L2-0.1', predictedL2 - 100);
          addTarget('L2-0.02', predictedL2 - 20);
          addTarget('L2+0.2', predictedL2 + 200);
        }
        if (deepAt === null && s.phase === 'deep_space') { deepAt = s.storyClock; addTarget('deepSpace+0.0', s.storyClock); addTarget('deepSpace+0.5', s.storyClock + 500); }
      },
      stopWhen: (s) => (deepAt !== null && s.storyClock - deepAt > 19000) || s.beat === 'ch8-crossing'
    });
    // Let the exit window finish so the frozen cadence is fully observed.
    const tail = Date.now() + 40000;
    while (Date.now() < tail) {
      const b = await page.evaluate(() => window.__storyBeat ?? null).catch(() => null);
      if (b === 'ch8-crossing') break;
      await new Promise(r => setTimeout(r, 250));
    }
    await new Promise(r => setTimeout(r, 1500));
    const events = await readEvents(page);
    const a = analyse(events, entry.story);
    const liveDiag = await page.evaluate(() => (window.__voxDiag ? window.__voxDiag() : null)).catch(() => null);
    const finalDiag = pickLaunchDiag(session.frames, liveDiag);
    if (!Number.isFinite(edgeHint) && a.tPhaseEdge !== null) edgeHint = a.tPhaseEdge;
    if (!Number.isFinite(deepHint) && a.tDeepSpace !== null) deepHint = a.tDeepSpace;
    out.runs.push({ ...record, frameDir: path.relative(RUN_DIR, dir), frames: session.frames,
      ladder: a, assertions: ladderAssertions(a), exitWindow: exitWindowAssertions(a),
      variantDOrdering: variantDOrdering(a),
      finalDiag, diagAssertions: diagLadderAssertions(finalDiag, a, arg('--cause', null)), events });
    console.log(`[${mode}/${label}] run ${i + 1} L1=${a.tL1} L2=${a.tL2} L3=${a.tL3} edge=${a.tPhaseEdge} deep=${a.tDeepSpace} L4=${a.tL4} frames=${session.frames.length}`);
    await page.__ctx.close();
    write(`${mode}-${label}.json`, out);
  }
} else if (mode === 'seeded') {
  // Two entries whose phase is already non-surface.
  const out = { mode, base: BASE, capturedAt: new Date().toISOString(), cases: [] };
  // Case 1: ?fly=1 boots the session straight into deep-space flight, so the
  // first ch8-launch tick observes a non-surface phase. Shipped debug route,
  // no probe-side mutation.
  {
    const page = await newPage(browser, {});
    const url = `${BASE}/?story=ch8-launch&fly=1&profile=LOW`;
    await page.goto(url, { waitUntil: 'load', timeout: 90000 }).catch(() => {});
    const entry = await waitForBeat(page, 'ch8-launch', 90000);
    const dir = path.join(OUT_DIR, 'seeded-fly-entry');
    fs.mkdirSync(dir, { recursive: true });
    let frame = null;
    if (entry) {
      while ((await nowClock(page)) - entry.story < 500) await new Promise(r => setTimeout(r, 25));
      const s = await frameState(page);
      const name = `entry+0.5s_${s.beat}_${s.phase}.png`;
      await page.screenshot({ path: path.join(dir, name) }).catch(() => {});
      frame = { file: name, ...s, entryOffsetSeconds: Number(((s.storyClock - entry.story) / 1000).toFixed(3)) };
    }
    await new Promise(r => setTimeout(r, 12000));
    const events = await readEvents(page);
    out.cases.push({ case: 'fly-debug-entry', url, entryStoryClock: entry ? entry.story : null,
      frameDir: path.relative(RUN_DIR, dir), emptySlotFrame: frame,
      ladder: entry ? analyse(events, entry.story) : null, events });
    await page.__ctx.close();
    write('seeded-entries.json', out);
  }
  // Case 2: genuine mid-flight beat re-entry. The probe calls the exported
  // beat-entry seam (enterEmergentStoryBeat) mid-climb -- a MUTATION, recorded
  // as such, because flight phase is not durable state and the shipped
  // snapshot/restore tool therefore always restores on the pad.
  {
    const page = await newPage(browser, {});
    const url = `${BASE}/?story=ch8-launch&movie=1&profile=LOW`;
    await page.goto(url, { waitUntil: 'load', timeout: 90000 }).catch(() => {});
    const entry = await waitForBeat(page, 'ch8-launch', 90000);
    const dir = path.join(OUT_DIR, 'seeded-midflight-reentry');
    fs.mkdirSync(dir, { recursive: true });
    let phaseAtReentry = null;
    let reentryClock = null;
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      const s = await frameState(page);
      if (s.phase !== 'surface' && s.phase !== 'deep_space' && s.controlMode === 'flight') {
        phaseAtReentry = s.phase;
        reentryClock = await page.evaluate(async () => {
          const d = await import('/src/story/emergentStoryDirector.ts');
          const c = await import('/src/story/storyClock.ts');
          d.enterEmergentStoryBeat('ch8-launch');
          return c.storyNow();
        });
        break;
      }
      await new Promise(r => setTimeout(r, 25));
    }
    let frame = null;
    if (reentryClock !== null) {
      while ((await nowClock(page)) - reentryClock < 500) await new Promise(r => setTimeout(r, 20));
      const s = await frameState(page);
      const name = `reentry+0.5s_${s.beat}_${s.phase}.png`;
      await page.screenshot({ path: path.join(dir, name) }).catch(() => {});
      frame = { file: name, ...s, reentryOffsetSeconds: Number(((s.storyClock - reentryClock) / 1000).toFixed(3)) };
    }
    await new Promise(r => setTimeout(r, 12000));
    const events = await readEvents(page);
    out.cases.push({ case: 'midflight-beat-reentry', url, mutation: 'probe called the exported enterEmergentStoryBeat seam',
      phaseAtReentry, reentryStoryClock: reentryClock, frameDir: path.relative(RUN_DIR, dir),
      emptySlotFrame: frame,
      captionsAfterReentry: events.filter(e => e.ch === 'caption' && reentryClock !== null && e.story >= reentryClock)
        .map(e => ({ tAfterReentrySeconds: Number(((e.story - reentryClock) / 1000).toFixed(3)), text: e.text })),
      events });
    await page.__ctx.close();
    write('seeded-entries.json', out);
  }
} else if (mode === 'seeded-frame') {
  // Tight empty-slot frame for the non-surface entry: the shutter is driven off
  // the app's own window.__storyBeat mirror and the raw DOM, so it does not wait
  // for the module-import instrumentation and can hit entry +0.5 s.
  const page = await newPage(browser, {});
  const url = `${BASE}/?story=ch8-launch&fly=1&profile=LOW`;
  await page.goto(url, { waitUntil: 'load', timeout: 90000 }).catch(() => {});
  const dir = path.join(OUT_DIR, 'seeded-fly-entry');
  fs.mkdirSync(dir, { recursive: true });
  let entryWall = null;
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    const s = await page.evaluate(() => ({ beat: window.__storyBeat ?? null, wall: performance.now() })).catch(() => null);
    if (s && s.beat === 'ch8-launch') { entryWall = s.wall; break; }
    await new Promise(r => setTimeout(r, 20));
  }
  const shots = [];
  if (entryWall !== null) {
    for (const off of [0.5, 1.5, 3.0]) {
      while (Date.now() < deadline) {
        const w = await page.evaluate(() => performance.now());
        if (w >= entryWall + off * 1000 - 20) break;
        await new Promise(r => setTimeout(r, 10));
      }
      const st = await page.evaluate(() => {
        const cap = document.querySelector('[data-story-caption]');
        return { wall: performance.now(), beat: window.__storyBeat ?? null,
          domCaption: cap ? cap.innerText.trim() : null };
      });
      const name = `entry+${off.toFixed(1)}s_${st.beat}.png`;
      await page.screenshot({ path: path.join(dir, name) }).catch(() => {});
      shots.push({ file: name, targetOffsetSeconds: off,
        measuredOffsetSeconds: Number(((st.wall - entryWall) / 1000).toFixed(3)),
        beat: st.beat, domCaption: st.domCaption, captionSlotEmpty: !st.domCaption });
      console.log('[seeded-frame]', name, 'domCaption=', JSON.stringify(st.domCaption));
    }
  }
  await page.__ctx.close();
  write('seeded-entry-frames.json', { mode, url, capturedAt: new Date().toISOString(),
    entryObserver: 'window.__storyBeat poll (raw DOM shutter)', shots });
} else if (mode === 'dive') {
  // Ruling R4 / acceptance criterion [31]. Exit to deep_space, let rows stamp,
  // dive back under the atmosphere boundary, hold, re-exit.
  const gapTarget = Number(arg('--accrue', '5.0'));
  const dipSeconds = Number(arg('--dip', '5.0'));
  const out = { mode, base: BASE, capturedAt: new Date().toISOString(),
    law: "acceptance criterion [31] (ruling R4): the ch8 exit-window clock accumulates ONLY on deep_space frames; a sub-boundary dive freezes it where it stands; a re-exit resumes from the held value; once-only latching is unchanged so no row re-fires and no burst occurs; the advance requires BOTH held >= 17.0 s AND a live deep_space phase.",
    accrueTargetSeconds: gapTarget, dipHoldSeconds: dipSeconds, runs: [] };
  await warmUp(browser, `${BASE}/?story=ch8-launch&profile=LOW`);
  for (let i = 0; i < runs; i++) {
    const page = await newPage(browser, {});
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(String(e).slice(0, 300)));
    const url = `${BASE}/?story=ch8-launch&profile=LOW`;
    await page.goto(url, { waitUntil: 'load', timeout: 90000 }).catch(() => {});
    const entry = await waitForBeat(page, 'ch8-launch', 90000);
    const dir = path.join(OUT_DIR, `dive-run${i + 1}`);
    fs.mkdirSync(dir, { recursive: true });
    const record = { run: i + 1, url, pageErrors, entryStoryClock: entry ? entry.story : null,
      entryObserver: entry ? (entry.observer ?? null) : null, samples: [], shots: [], stages: {} };
    if (!entry) { out.runs.push({ ...record, failed: 'ch8-launch never published' }); await page.__ctx.close(); write('dive.json', out); continue; }
    record.probeReady = await waitForProbeReady(page);
    await page.mouse.click(640, 360).catch(() => {});
    const samples = record.samples;
    const shoot = async (label) => {
      const s = await frameState(page).catch(() => null);
      if (!s) return;
      const name = `${String(record.shots.length).padStart(2, '0')}_${label}_${s.phase}.png`;
      await page.screenshot({ path: path.join(dir, name) }).catch(() => {});
      record.shots.push({ file: name, label, phase: s.phase, controlMode: s.controlMode,
        beat: s.beat, storeCaption: s.storeCaption, storeAudit: s.storeAudit,
        heldExitSeconds: s.diag && s.diag.launch ? Number(s.diag.launch.exitHeldSeconds.toFixed(3)) : null,
        stateReadOrder: 'state-before-shutter' });
    };
    const sample = async () => {
      const s = await frameState(page).catch(() => null);
      if (!s) return null;
      samples.push({ t: Number(((s.storyClock - entry.story) / 1000).toFixed(3)),
        phase: s.phase, controlMode: s.controlMode, beat: s.beat,
        held: s.diag && s.diag.launch ? Number(s.diag.launch.exitHeldSeconds.toFixed(4)) : null,
        elapsed: s.diag ? Number(s.diag.elapsed.toFixed(3)) : null,
        caption: s.storeCaption, audit: s.storeAudit ? s.storeAudit.text : null });
      return s;
    };
    const until = async (pred, capMs, tickMs = 90) => {
      const deadline = Date.now() + capMs;
      while (Date.now() < deadline) {
        const s = await sample();
        if (s && pred(s)) return s;
        await new Promise(r => setTimeout(r, tickMs));
      }
      return null;
    };
    // 1. Ignite and climb on the shipped physical controls.
    await until(s => s.storyClock - entry.story >= 3000, 12000);
    await page.keyboard.press('Space').catch(() => {});
    record.stages.ignitedAt = Number((((await nowClock(page)) - entry.story) / 1000).toFixed(3));
    await page.keyboard.down('KeyW').catch(() => {});
    const exited = await until(s => s.phase === 'deep_space', 90000);
    record.stages.firstDeepSpaceAt = exited ? Number(((exited.storyClock - entry.story) / 1000).toFixed(3)) : null;
    if (!exited) { out.runs.push({ ...record, failed: 'never reached deep_space' }); await page.keyboard.up('KeyW').catch(() => {}); await page.__ctx.close(); write('dive.json', out); continue; }
    await shoot('deepSpace-entry');
    // 2. Let the window accrue ~2 audit rows.
    const accrued = await until(s => s.diag && s.diag.launch && s.diag.launch.exitHeldSeconds >= gapTarget, 40000, 60);
    record.stages.heldAtAccrueTarget = accrued && accrued.diag ? Number(accrued.diag.launch.exitHeldSeconds.toFixed(3)) : null;
    await shoot('pre-dive');
    // 3. Dive. Reverse throttle drops the nose-axis altitude back under
    //    ATMOS_ENTER on the shipped bidirectional boundary; if the physical
    //    route does not cross within its cap the probe falls back to the
    //    shipped beginAtmosphereWarp action and RECORDS the substitution.
    const heldAtDiveCommand = (await sample()).diag.launch.exitHeldSeconds;
    record.stages.heldAtDiveCommand = Number(heldAtDiveCommand.toFixed(4));
    record.stages.diveCommandedAt = Number((((await nowClock(page)) - entry.story) / 1000).toFixed(3));
    await page.keyboard.up('KeyW').catch(() => {});
    await page.keyboard.down('KeyS').catch(() => {});
    let dipped = await until(s => s.phase !== 'deep_space', 45000, 60);
    record.diveMethod = 'physical reverse throttle [S]';
    if (!dipped) {
      record.diveMethod = 'FALLBACK MUTATION: probe called the shipped beginAtmosphereWarp("enter") action after the physical route did not cross the boundary inside 45 s';
      await page.evaluate(async () => {
        const sf = await import('/src/state/spaceFlight.ts');
        sf.beginAtmosphereWarp('enter');
      }).catch(() => {});
      dipped = await until(s => s.phase !== 'deep_space', 20000, 60);
    }
    await page.keyboard.up('KeyS').catch(() => {});
    record.stages.dipStartAt = dipped ? Number(((dipped.storyClock - entry.story) / 1000).toFixed(3)) : null;
    record.stages.dipPhase = dipped ? dipped.phase : null;
    record.stages.heldAtDipStart = dipped && dipped.diag ? Number(dipped.diag.launch.exitHeldSeconds.toFixed(4)) : null;
    if (!dipped) { out.runs.push({ ...record, failed: 'never left deep_space' }); await page.__ctx.close(); write('dive.json', out); continue; }
    await shoot('dip-start');
    // 4. Hold under the boundary.
    const dipEndClock = dipped.storyClock + dipSeconds * 1000;
    await until(s => s.storyClock >= dipEndClock, dipSeconds * 1000 + 15000, 60);
    await shoot('dip-end');
    const dipEnd = await sample();
    record.stages.heldAtDipEnd = Number(dipEnd.diag.launch.exitHeldSeconds.toFixed(4));
    // 5. Re-exit.
    record.stages.reexitCommandedAt = Number((((await nowClock(page)) - entry.story) / 1000).toFixed(3));
    await page.keyboard.down('KeyW').catch(() => {});
    let resumed = await until(s => s.phase === 'deep_space', 60000, 60);
    record.reexitMethod = 'physical forward throttle [W]';
    if (!resumed) {
      record.reexitMethod = 'FALLBACK MUTATION: probe called the shipped beginAtmosphereWarp("leave") action';
      await page.evaluate(async () => {
        const sf = await import('/src/state/spaceFlight.ts');
        sf.beginAtmosphereWarp('leave');
      }).catch(() => {});
      resumed = await until(s => s.phase === 'deep_space', 25000, 60);
    }
    record.stages.resumeAt = resumed ? Number(((resumed.storyClock - entry.story) / 1000).toFixed(3)) : null;
    record.stages.heldAtResume = resumed && resumed.diag ? Number(resumed.diag.launch.exitHeldSeconds.toFixed(4)) : null;
    await shoot('resume');
    // 6. Run the window out to the advance.
    const advanced = await until(s => s.beat === 'ch8-crossing', 80000, 60);
    await page.keyboard.up('KeyW').catch(() => {});
    record.stages.advancedAt = advanced ? Number(((advanced.storyClock - entry.story) / 1000).toFixed(3)) : null;
    await shoot('advance');
    const events = await readEvents(page);
    record.events = events;
    out.runs.push({ ...record, assertions: diveAssertions(record, events) });
    console.log(`[dive] run ${i + 1} deep=${record.stages.firstDeepSpaceAt} dipHeld=${record.stages.heldAtDipStart}->${record.stages.heldAtDipEnd} resumeHeld=${record.stages.heldAtResume} advance=${record.stages.advancedAt}`);
    await page.__ctx.close();
    write('dive.json', out);
  }
} else if (mode === 'ch7queue' || mode === 'ch7mobile') {
  // Ruling R3 / acceptance criterion [3] plus cap.ch7.exit-window.
  const variant = arg('--variant', 'desktop');
  const label = arg('--label', variant);
  const profile = arg('--profile', 'LOW');
  const pageOpts = variant === 'mobile'
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 }
    : variant === 'mobile-landscape'
      ? { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 }
      : variant === 'reduced-motion' ? { reducedMotion: 'reduce' } : {};
  const out = { mode, label, variant, profile, base: BASE, capturedAt: new Date().toISOString(),
    law: "acceptance criterion [3] (ruling R3): each fired ch7 stage line holds the single caption slot for revealSeconds(line) + CH7_STAGE_DWELL_SECONDS (0.4 s); stage commits, receipts, score variants, anchors and objectives stay real-time; the queue drops at the calibration receipt except M6; t_M7Anchor = max(t_calibrationReceipt, t_M6 + revealSeconds(M6)).",
    exitWindowOffsets: [0.0, 0.4, 0.8, 1.5, 2.4, 2.8, 3.5, 4.8, 5.2, 6.5], runs: [] };
  await warmUp(browser, `${BASE}/?story=ch7-reconstruct&profile=${profile}`);
  for (let i = 0; i < runs; i++) {
    const page = await newPage(browser, pageOpts);
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(String(e).slice(0, 300)));
    const url = `${BASE}/?story=ch7-reconstruct&movie=1&profile=${profile}`;
    await page.goto(url, { waitUntil: 'load', timeout: 120000 }).catch(() => {});
    const entry = await waitForBeat(page, 'ch7-reconstruct', 120000);
    const dir = path.join(OUT_DIR, `${mode}-${label}-run${i + 1}`);
    const record = { run: i + 1, url, pageErrors, entryStoryClock: entry ? entry.story : null,
      entryObserver: entry ? (entry.observer ?? null) : null };
    if (!entry) { out.runs.push({ ...record, failed: 'ch7-reconstruct never published' }); await page.__ctx.close(); write(`${mode}-${label}.json`, out); continue; }
    record.probeReady = await waitForProbeReady(page);
    let anchorStoryClock = null;
    let boardAt = null;
    const session = await captureSession(page, dir, {
      entryStory: entry.story,
      stripIntervalMs: 400,
      capMs: 240000,
      onState: (s, addTarget) => {
        // The exit-window frames are timed from t_M7Anchor, converted onto the
        // host axis with the SAME frame's director elapsed, so the conversion
        // carries no accumulated drift.
        if (anchorStoryClock === null && s.diag && s.diag.reconstruct
          && s.diag.reconstruct.t_M7Anchor >= 0 && s.diag.elapsed > 0) {
          const originClock = s.storyClock - s.diag.elapsed * 1000;
          anchorStoryClock = originClock + s.diag.reconstruct.t_M7Anchor * 1000;
          record.m7AnchorStoryClock = Number(anchorStoryClock.toFixed(1));
          record.m7AnchorEntryOffsetSeconds = Number(((anchorStoryClock - entry.story) / 1000).toFixed(3));
          for (const off of out.exitWindowOffsets) addTarget(`anchor+${off.toFixed(1)}`, anchorStoryClock + off * 1000);
        }
        if (boardAt === null && s.beat === 'ch7-board') boardAt = s.storyClock;
      },
      stopWhen: (s) => boardAt !== null && s.storyClock - boardAt > 6000
    });
    const events = await readEvents(page);
    const liveDiag = await page.evaluate(() => (window.__voxDiag ? window.__voxDiag() : null)).catch(() => null);
    const diag = pickReconstructDiag(session.frames, liveDiag);
    out.runs.push({ ...record, frameDir: path.relative(RUN_DIR, dir), frames: session.frames,
      unmetTargets: session.unmetTargets, diag,
      queue: ch7QueueAssertions(events, entry.story, diag),
      exitWindowFrames: exitWindowFrameAssertions(session.frames),
      touchCollision: touchCollisionAssertions(session.frames),
      events });
    const q = out.runs[out.runs.length - 1].queue;
    console.log(`[${mode}/${label}] run ${i + 1} lines=${q.lines.length} minSlackSeconds=${q.minSlackSeconds} m6Dropped=${q.m6Dropped} anchor=${q.tM7Anchor} receipt=${q.tCalibrationReceipt}`);
    await page.__ctx.close();
    write(`${mode}-${label}.json`, out);
  }
} else if (mode === 'replay') {
  // Defect ux-07 re-measure WITH frames. The iteration-1 record installed its
  // instrumentation with page.evaluate AFTER the reload, so every post-reload
  // emission landed in one subscription flush at one clock value. Here the
  // instrumentation is an init script, so it is live before the app boots and
  // each emission carries its own story-clock stamp; a 400 ms strip runs across
  // the reload so the post-replay ladder has frame evidence.
  const out = { mode, base: BASE, capturedAt: new Date().toISOString(),
    defectRef: 'ux-07 (replay/reload seam re-measure with frame capture)',
    methodNote: 'instrumentation installed via context.addInitScript (pre-boot), not page.evaluate after load; the iteration-1 single-timestamp artefact is a measurement bug in the old probe, reproduced and superseded here',
    cases: [] };
  for (const kind of ['replay-deep-link', 'quit-to-menu']) {
    const page = await newPage(browser, {});
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(String(e).slice(0, 300)));
    const url = `${BASE}/?story=ch8-launch&movie=1&profile=LOW`;
    await page.goto(url, { waitUntil: 'load', timeout: 90000 }).catch(() => {});
    const entry = await waitForBeat(page, 'ch8-launch', 120000);
    await waitForProbeReady(page);
    const dir = path.join(OUT_DIR, `replay-${kind}`);
    fs.mkdirSync(dir, { recursive: true });
    // Run into the exit window, then interrupt.
    let l4At = null;
    const dl = Date.now() + 150000;
    while (Date.now() < dl) {
      const st = await frameState(page).catch(() => null);
      if (st && st.storeCaption === L4) { l4At = st.storyClock; break; }
      await new Promise(r => setTimeout(r, 60));
    }
    if (l4At !== null) {
      const hold = l4At + 6000;
      while ((await nowClock(page)) < hold) await new Promise(r => setTimeout(r, 60));
    }
    const before = await frameState(page).catch(() => null);
    await page.screenshot({ path: path.join(dir, `00_pre-interrupt_${before ? before.beat : 'null'}.png`) }).catch(() => {});
    const beforeEvents = await readEvents(page);
    // The interrupt.
    if (kind === 'replay-deep-link') await page.reload({ waitUntil: 'load', timeout: 90000 }).catch(() => {});
    else await page.goto(`${BASE}/`, { waitUntil: 'load', timeout: 90000 }).catch(() => {});
    await waitForProbeReady(page);
    const reloadClock = await nowClock(page);
    // 400 ms strip across the whole post-interrupt ladder.
    const frames = [];
    const stop = Date.now() + 45000;
    let idx = 0;
    let last = -1e9;
    while (Date.now() < stop) {
      const st = await frameState(page).catch(() => null);
      if (!st) break;
      if (st.storyClock - last >= 400) {
        last = st.storyClock;
        const rel = ((st.storyClock - reloadClock) / 1000).toFixed(2).replace('.', 'p');
        const name = `${String(idx).padStart(3, '0')}_post_t${rel}s_${st.beat ?? 'null'}_${st.phase}.png`;
        const t0 = Date.now();
        await page.screenshot({ path: path.join(dir, name) }).catch(() => {});
        const after = await nowClock(page).catch(() => st.storyClock);
        frames.push({ file: name, offsetSeconds: Number(((st.storyClock - reloadClock) / 1000).toFixed(3)),
          shutterSpanMs: Number((after - st.storyClock).toFixed(1)), stateReadOrder: 'state-before-shutter',
          beat: st.beat, phase: st.phase, storeCaption: st.storeCaption, domCaption: st.domCaption,
          domCaptionChars: st.domCaptionChars, storeCaptionChars: st.storeCaptionChars,
          revealComplete: st.storeCaption !== null && st.domCaptionChars >= st.storeCaptionChars,
          storeAudit: st.storeAudit, hudDom: st.hudDom, objectiveId: st.objectiveId,
          objectiveHealth: st.objectiveHealth, diag: st.diag });
        idx++;
      } else await new Promise(r => setTimeout(r, 25));
    }
    const afterEvents = await readEvents(page);
    const caps = afterEvents.filter(e => e.ch === 'caption' && e.text);
    const stamps = caps.map(e => Number(((e.story - reloadClock) / 1000).toFixed(3)));
    const distinct = new Set(stamps.map(x => x.toFixed(3))).size;
    out.cases.push({ case: kind, url, pageErrors,
      preInterrupt: { l4ObservedStoryClock: l4At, beat: before ? before.beat : null,
        caption: before ? before.storeCaption : null, events: beforeEvents.length },
      reloadStoryClock: reloadClock, frameDir: path.relative(RUN_DIR, dir), frames,
      postCaptions: caps.map((e, i) => ({ atSecondsAfterReload: stamps[i], text: e.text })),
      distinctCaptionTimestamps: distinct,
      singleTimestampArtefactReproduced: caps.length > 1 && distinct === 1,
      ladderSpreadSeconds: stamps.length > 1
        ? Number((Math.max(...stamps) - Math.min(...stamps)).toFixed(3)) : null,
      finalDiag: pickLaunchDiag(frames, await page.evaluate(() => (window.__voxDiag ? window.__voxDiag() : null)).catch(() => null)),
      events: afterEvents });
    console.log(`[replay/${kind}] postCaptions=${caps.length} distinctStamps=${distinct} spread=${out.cases[out.cases.length - 1].ladderSpreadSeconds} frames=${frames.length}`);
    await page.__ctx.close();
    write('replay-remeasure.json', out);
  }
} else if (mode === 'ch7manual') {
  // The paced manual-shape run. Repair stages are committed through the SHIPPED
  // transaction API at realistic spacing; the mutation is declared in the record
  // because there is no headless route that walks the wreck and presses [F].
  const gap = Number(arg('--gap', '6.0'));
  const out = { mode, gapSeconds: gap, base: BASE, capturedAt: new Date().toISOString(),
    mutationDeclaration: "SCRIPTED, NOT MOVIE, NOT PLAYER-EMBODIED. The probe (a) commits the shipped commitWreckDiagnosis with a proof built from the live registered wreck binding at zero distance and full gaze alignment, (b) grants each stage's canonical BOM through the shipped addItem so affordability matches a player who gathered it, and (c) calls the shipped performWreckReconstructionAction once per stage at >= gapSeconds spacing. No director, caption, queue or cadence code is touched; every emission below is the runtime's own.",
    runs: [] };
  await warmUp(browser, `${BASE}/?story=ch7-reconstruct&profile=LOW`);
  for (let i = 0; i < runs; i++) {
    const page = await newPage(browser, {});
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(String(e).slice(0, 300)));
    const url = `${BASE}/?story=ch7-reconstruct&profile=LOW`;
    await page.goto(url, { waitUntil: 'load', timeout: 120000 }).catch(() => {});
    const entry = await waitForBeat(page, 'ch7-reconstruct', 120000);
    const dir = path.join(OUT_DIR, `ch7manual-run${i + 1}`);
    fs.mkdirSync(dir, { recursive: true });
    const record = { run: i + 1, url, pageErrors, entryStoryClock: entry ? entry.story : null, commits: [] };
    if (!entry) { out.runs.push({ ...record, failed: 'ch7-reconstruct never published' }); await page.__ctx.close(); write('ch7manual.json', out); continue; }
    record.probeReady = await waitForProbeReady(page);
    // Install the scripted commit bridge.
    await page.evaluate(async () => {
      const w = window;
      const emb = await import('/src/story/reconstructionEmbodiment.ts');
      const wr = await import('/src/story/wreckReconstruction.ts');
      const inv = await import('/src/game/systems/inventorySystem.ts');
      const tx = await import('/src/game/systems/shipRepairTransactions.ts');
      const rest = await import('/src/game/systems/shipRestoration.ts');
      const actors = await import('/src/game/playerActors.ts');
      const uniq = await import('/src/story/emergentUniqueItems.ts');
      const caps = await import('/src/story/emergentCapabilities.ts');
      const st = await import('/src/story/storyState.ts');
      const route = await import('/src/story/tidegardenRoute.ts');
      const actorId = actors.getLocalActorId();
      w.__voxCh7 = {
        actorId,
        stage: () => rest.getShipRepairStage(),
        diagnosed: () => emb.hasWreckDiagnosisReceipt(actorId),
        diagnose: () => emb.commitWreckDiagnosis({
          actorId,
          worldId: route.STORY_PRIMARY_WORLD_ID,
          storyBeat: st.getStoryStateSnapshot().beat,
          repairStage: rest.getShipRepairStage(),
          keelMemoryBanked: uniq.hasBankedKestrelKeelMemory(actorId),
          distanceSquared: 0,
          viewAlignment: 1
        }),
        act: () => {
          // Stock the NEXT stage's canonical BOM first: the shipped action
          // resolver only offers a repair the actor can already afford, and the
          // later stages' parts are crafted at the bench in embodied play.
          const cur = rest.getShipRepairStage();
          const next = caps.nextShipRepairStage(cur);
          const granted = [];
          if (next && next !== 'wrecked' && tx.SHIP_REPAIR_STAGE_COSTS[next]) {
            for (const s of tx.SHIP_REPAIR_STAGE_COSTS[next]) {
              const short = s.qty - inv.getItemCount(s.id, actorId);
              if (short > 0) { inv.addItem(s.id, short, actorId); granted.push(s.id + 'x' + short); }
            }
          }
          const a = wr.getWreckReconstructionAction(actorId);
          if (!a) return { none: true, stage: cur, nextStage: next, granted };
          const r = wr.performWreckReconstructionAction(a, actorId);
          return { kind: a.kind, target: a.target ?? null, ok: r.ok, stage: r.repairStage, granted };
        }
      };
    }).catch(e => { record.bridgeError = String(e).slice(0, 300); });
    // The wreck binding is registered by the scene; poll until diagnosis takes.
    const diagDeadline = Date.now() + 90000;
    let diagRes = null;
    while (Date.now() < diagDeadline) {
      diagRes = await page.evaluate(() => (window.__voxCh7 ? window.__voxCh7.diagnose() : null)).catch(() => null);
      if (diagRes && diagRes.ok) break;
      await new Promise(r => setTimeout(r, 500));
    }
    record.diagnosis = diagRes;
    record.diagnosisAtEntryOffsetSeconds = Number((((await nowClock(page)) - entry.story) / 1000).toFixed(3));
    if (!diagRes || !diagRes.ok) { out.runs.push({ ...record, failed: 'diagnosis never committed: ' + JSON.stringify(diagRes) }); await page.__ctx.close(); write('ch7manual.json', out); continue; }
    let boardAt = null;
    let nextCommitAt = (await nowClock(page)) + gap * 1000;
    let anchorStoryClock = null;
    const session = await captureSession(page, dir, {
      entryStory: entry.story,
      stripIntervalMs: 700,
      capMs: 240000,
      action: async (s) => {
        if (s.storyClock < nextCommitAt) return;
        if (s.beat !== 'ch7-reconstruct') return;
        const r = await page.evaluate(() => (window.__voxCh7 ? window.__voxCh7.act() : null)).catch(() => null);
        nextCommitAt = s.storyClock + gap * 1000;
        if (r && !r.none) record.commits.push({ atEntryOffsetSeconds: Number(((s.storyClock - entry.story) / 1000).toFixed(3)), ...r });
      },
      onState: (s, addTarget) => {
        if (anchorStoryClock === null && s.diag && s.diag.reconstruct
          && s.diag.reconstruct.t_M7Anchor >= 0 && s.diag.elapsed > 0) {
          const originClock = s.storyClock - s.diag.elapsed * 1000;
          anchorStoryClock = originClock + s.diag.reconstruct.t_M7Anchor * 1000;
          record.m7AnchorEntryOffsetSeconds = Number(((anchorStoryClock - entry.story) / 1000).toFixed(3));
          for (const off of [0.0, 0.6, 3.0, 5.0]) addTarget(`anchor+${off.toFixed(1)}`, anchorStoryClock + off * 1000);
        }
        if (boardAt === null && s.beat === 'ch7-board') boardAt = s.storyClock;
      },
      stopWhen: (s) => boardAt !== null && s.storyClock - boardAt > 4000
    });
    const events = await readEvents(page);
    const liveDiag = await page.evaluate(() => (window.__voxDiag ? window.__voxDiag() : null)).catch(() => null);
    const diag = pickReconstructDiag(session.frames, liveDiag);
    out.runs.push({ ...record, frameDir: path.relative(RUN_DIR, dir), frames: session.frames,
      diag, queue: ch7QueueAssertions(events, entry.story, diag), events });
    const q = out.runs[out.runs.length - 1].queue;
    console.log(`[ch7manual] run ${i + 1} commits=${record.commits.length} lines=${q.lines.length} minSlack=${q.minSlackSeconds} anchor=${q.tM7Anchor} receipt=${q.tCalibrationReceipt} equal=${q.anchorEqualsReceipt}`);
    await page.__ctx.close();
    write('ch7manual.json', out);
  }

} else {
  console.error('unknown mode', mode);
}

await browser.close();
