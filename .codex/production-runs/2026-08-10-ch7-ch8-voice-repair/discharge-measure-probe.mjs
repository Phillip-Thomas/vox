// CC1 discharge measurement probe (contract draft-v4, acceptance criteria [21]
// and [26]): ONE script that drives the canonical ordered-ignition route and
// measures the margin on that route itself.
//
// Route (acceptance criterion [21] / cap.ch8.paced-ladder Route A):
//   1. enter ch8-launch seated on a pristine deep link, LOW tier, no movie flag
//   2. NO control input until L2 timer-fires at t_L1 + CH8_L1_MIN_SLOT_SECONDS
//      (the standing control ignites at entry +10 s, which is after that)
//   3. commit [SPACE] to ignite, then sustain [W] climb through the atmosphere
//      boundary until deep_space is observed
//   4. hold steady state through the frozen exit window so the +0.0 .. +17.0 s
//      cadence is observed on this route
//
// The page-side instrumentation (INSTALL), the story-clock stamping, the
// beat-entry observer and the capture loop are copied unchanged from
// ladder-verify-probe.mjs so the two records are directly comparable.
//
// Read-only: the probe never writes app state; the only page interactions are a
// focus click on the canvas at beat entry and the scripted keyboard route above.
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
const { chromium } = await import(
  '/home/thomasphillip/Projects/vox/main/node_modules/playwright-core/index.mjs'
);

const RUN_DIR = path.dirname(new URL(import.meta.url).pathname);
// draft-v5 closing pass: --out selects the evidence folder; the default keeps
// the iteration-4 discharge record in place.
const outIdx = process.argv.indexOf('--out');
const OUT_DIR = outIdx >= 0
  ? path.join(RUN_DIR, 'evidence', process.argv[outIdx + 1], 'routeA-ordered')
  : path.join(RUN_DIR, 'evidence', 'verification-v3', 'routeA-ordered');
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
const L3_REVEAL_CONTRACT_SECONDS = 1.98;      // acceptance criterion [21] term
const L3_REVEAL_MEASURED_SECONDS = Number((L3.length * REVEAL_MS_PER_CHAR / 1000).toFixed(3));
const MARGIN_FLOOR_SECONDS = 0.3;

const CH8_L1_MIN_SLOT_SECONDS = 4.5;
const CH8_L2_MIN_SLOT_SECONDS = 3.0;

const INSTALL = `(() => {
  const w = window;
  if (w.__voxProbe) return;
  const events = [];
  w.__voxProbe = { events, ready: false, error: null };
  const stamp = (e) => {
    const now = w.__voxProbeClock ? w.__voxProbeClock() : performance.now();
    events.push(Object.assign({ wall: performance.now(), story: now, beat: w.__storyBeat ?? null }, e));
  };
  const boot = async () => {
    const st = await import('/src/story/storyText.ts');
    const obj = await import('/src/story/ux/objectiveDirector.ts');
    const fb = await import('/src/story/ux/feedbackCues.ts');
    const clock = await import('/src/story/storyClock.ts');
    const storyState = await import('/src/story/storyState.ts');
    const sf = await import('/src/state/spaceFlight.ts');
    const dirmod = await import('/src/story/emergentStoryDirector.ts');
    // draft-v5: read-only derived-moment snapshot (l2DueAt / l2Cause / the ch7
    // anchor pair / the held exit clock), bridged like the AV debug snapshot.
    w.__voxDiag = () => (dirmod.getEmergentStoryVoiceDiag
      ? JSON.parse(JSON.stringify(dirmod.getEmergentStoryVoiceDiag()))
      : null);
    w.__voxProbeClock = clock.storyNow;
    w.__voxFlight = () => { const f = sf.getSpaceFlightSnapshot(); return { phase: f.phase, controlMode: f.controlMode }; };
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
        diag: w.__voxDiag ? w.__voxDiag() : null,
        objectiveHealth: o ? o.health : null,
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

async function newPage(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await context.addInitScript(INSTALL);
  const page = await context.newPage();
  page.__ctx = context;
  return page;
}

const readEvents = (page) => page.evaluate(() => (window.__voxProbe ? window.__voxProbe.events : []));
const frameState = (page) => page.evaluate(() => (window.__voxFrame ? window.__voxFrame() : null));
const nowClock = (page) => page.evaluate(() => (window.__voxProbeClock ? window.__voxProbeClock() : performance.now()));

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

async function waitForProbeReady(page, capMs = 30000) {
  const deadline = Date.now() + capMs;
  while (Date.now() < deadline) {
    const ready = await page.evaluate(() => Boolean(window.__voxProbe && window.__voxProbe.ready)).catch(() => false);
    if (ready) return true;
    await new Promise(r => setTimeout(r, 50));
  }
  return false;
}

async function warmUp(browser, url) {
  const page = await newPage(browser);
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

async function captureSession(page, dir, opts) {
  const { entryStory, stripIntervalMs = 220, stopWhen, capMs, targets = [], onState = null, action = null } = opts;
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
      diag: state.diag,
      // CIN-05: every field in this record is sampled BEFORE the shutter opens.
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
    const due = pending.filter(t => !t.taken && state.storyClock >= t.at).sort((a, b) => a.at - b.at)[0];
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
      await new Promise(r => setTimeout(r, 20));
    }
    if (stopWhen && stopWhen(state)) break;
  }
  return { frames, unmetTargets: pending.filter(t => !t.taken).map(t => t.id) };
}

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
  const tol = 0.05;
  const out = {};
  if (a.tL1 !== null && a.tL2 !== null) {
    const expected = a.tPhaseEdge === null
      ? a.tL1 + CH8_L1_MIN_SLOT_SECONDS
      : Math.min(a.tL1 + CH8_L1_MIN_SLOT_SECONDS, a.tPhaseEdge);
    out.l2Formula = { expectedSeconds: Number(expected.toFixed(3)), measuredSeconds: a.tL2,
      deltaSeconds: Number((a.tL2 - expected).toFixed(3)), pass: near(a.tL2, expected, tol),
      cause: a.tPhaseEdge !== null && Math.abs(a.tL2 - a.tPhaseEdge) <= tol ? 'phase-edge' : 'timer' };
  } else out.l2Formula = { pass: false, note: 'L1 or L2 absent' };
  if (a.tL2 !== null && a.tL3 !== null) {
    const expected = Math.max(a.tPhaseEdge ?? -Infinity, a.tL2 + CH8_L2_MIN_SLOT_SECONDS);
    out.l3Formula = { expectedSeconds: Number(expected.toFixed(3)), measuredSeconds: a.tL3,
      deltaSeconds: Number((a.tL3 - expected).toFixed(3)), pass: near(a.tL3, expected, tol),
      firedAtPhaseEdge: a.tPhaseEdge !== null && Math.abs(a.tL3 - a.tPhaseEdge) <= tol,
      edgeDeltaSeconds: a.tPhaseEdge === null ? null : Number((a.tL3 - a.tPhaseEdge).toFixed(3)) };
  } else out.l3Formula = { pass: null, note: 'L3 not rendered (drop rule or route ended first)' };
  if (a.tL3 !== null && a.tDeepSpace !== null) {
    const contractMargin = Number((a.tDeepSpace - (a.tL3 + L3_REVEAL_CONTRACT_SECONDS)).toFixed(3));
    const measuredMargin = Number((a.tDeepSpace - (a.tL3 + L3_REVEAL_MEASURED_SECONDS)).toFixed(3));
    out.dischargeMargin = {
      l3RevealContractSeconds: L3_REVEAL_CONTRACT_SECONDS,
      l3RevealMeasuredSeconds: L3_REVEAL_MEASURED_SECONDS,
      marginSeconds: contractMargin,
      marginAgainstMeasuredRevealSeconds: measuredMargin,
      floorSeconds: MARGIN_FLOOR_SECONDS,
      strictlyBefore: contractMargin > 0,
      underFloor: contractMargin < MARGIN_FLOOR_SECONDS
    };
  } else out.dischargeMargin = { marginSeconds: null, note: a.tL3 === null ? 'L3 dropped' : 'no deep_space observed' };
  out.onceOnly = { l1: a.l1Count <= 1, l2: a.l2Count <= 1, l3: a.l3Count <= 1,
    counts: { l1: a.l1Count, l2: a.l2Count, l3: a.l3Count, l4: a.l4Count } };
  const seq = a.captionOrder.filter(c => [L1, L2, L3].includes(c.text)).map(c => c.text);
  const canonical = [L1, L2, L3].filter(t => seq.includes(t));
  out.order = { observed: seq.map(t => t === L1 ? 'L1' : t === L2 ? 'L2' : 'L3'),
    pass: JSON.stringify(seq) === JSON.stringify(canonical), allThreeRendered: seq.length === 3 };
  return out;
}

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
  return { originSeconds: a.tL4, l4AtDeepSpaceDeltaSeconds: a.tDeepSpace === null ? null : Number((a.tL4 - a.tDeepSpace).toFixed(3)),
    rows, pass: rows.every(r => r.pass) };
}

/** Binds the contract's named anchor offsets to the nearest captured frame. */
function bindAnchorFrames(frames, a, igniteOffsetSeconds) {
  const anchors = [];
  const add = (id, targetOffset, basisTime, anchorRef) => {
    if (basisTime === null || basisTime === undefined) {
      anchors.push({ id, anchorRef, targetEntryOffsetSeconds: null, frame: null, deviationSeconds: null, note: 'basis time not observed' });
      return;
    }
    const target = Number((basisTime + targetOffset).toFixed(3));
    let best = null;
    for (const f of frames) {
      const d = Math.abs(f.entryOffsetSeconds - target);
      if (!best || d < best.d) best = { d, f };
    }
    const labeled = frames.find(f => f.label === id) ?? null;
    anchors.push({
      id, anchorRef,
      targetEntryOffsetSeconds: target,
      frame: best ? best.f.file : null,
      frameEntryOffsetSeconds: best ? best.f.entryOffsetSeconds : null,
      deviationSeconds: best ? Number((best.f.entryOffsetSeconds - target).toFixed(3)) : null,
      framePhase: best ? best.f.phase : null,
      frameDomCaption: best ? best.f.domCaption : null,
      frameRevealComplete: best ? best.f.revealComplete : null,
      labeledFrame: labeled ? labeled.file : null,
      labeledFrameEntryOffsetSeconds: labeled ? labeled.entryOffsetSeconds : null,
      labeledFrameDeviationSeconds: labeled ? Number((labeled.entryOffsetSeconds - target).toFixed(3)) : null
    });
  };
  add('ignition+0.2', 0.2, igniteOffsetSeconds === undefined ? null : igniteOffsetSeconds, 'anc.launch.ignition');
  add('L1+0.2', 0.2, a.tL1, 'anchor.ch8.at-the-controls');
  add('L2-0.5', -0.5, a.tL2, 'anchor.ch8.self-order');
  add('L2+0.2', 0.2, a.tL2, 'anchor.ch8.self-order');
  add('L2+0.7', 0.7, a.tL2, 'anchor.ch8.self-order');
  add('L3+1.0', 1.0, a.tL3, 'anchor.ch8.site-recedes');
  add('L3+2.0', 2.0, a.tL3, 'anchor.ch8.site-recedes');
  add('L3+3.0', 3.0, a.tL3, 'anchor.ch8.site-recedes');
  add('edge-0.3', -0.3, a.tPhaseEdge, 'anc.launch.liftoff');
  add('edge+0.2', 0.2, a.tPhaseEdge, 'anc.launch.liftoff');
  add('deepSpace-0.3', -0.3, a.tDeepSpace, 'anc.launch.atmosphere-exit');
  add('deepSpace+0.0', 0.0, a.tDeepSpace, 'anc.launch.atmosphere-exit');
  return anchors;
}

const arg = (flag, dflt) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : dflt;
};


const revealSecondsOf = (line) => (line.length * REVEAL_MS_PER_CHAR) / 1000;

/**
 * The director resets its beat runtime on entry to ch8-crossing, so a diag read
 * after the advance is zeroed. The authoritative snapshot is the richest
 * ch8-launch-scoped diag observed on the strip (all state-before-shutter).
 */
function pickLaunchDiag(frames, live) {
  const scoped = frames.map(f => f.diag).filter(d => d && d.beat === 'ch8-launch' && d.launch);
  if (scoped.length === 0) return live ?? null;
  const score = (x) => (x.launch.t_L1 >= 0 ? 1 : 0) + (x.launch.t_L2 >= 0 ? 1 : 0)
    + (x.launch.t_L3 >= 0 ? 1 : 0) + x.launch.exitHeldSeconds / 1000;
  return scoped.reduce((best, d) => (score(d) >= score(best) ? d : best));
}

/** Acceptance criteria [22]/[23]/[29] read off the runtime's own derived state. */
function diagAssertions(diag, expectedCause) {
  if (!diag || !diag.launch) return { pass: false, note: 'no ch8-launch diag snapshot observed' };
  const L = diag.launch;
  const guard = L.t_L1 >= 0 ? L.t_L1 + revealSecondsOf(L1) : null;
  const timer = L.t_L1 >= 0 ? L.t_L1 + CH8_L1_MIN_SLOT_SECONDS : null;
  const pulled = timer === null ? null : (L.t_phaseEdge < 0 ? timer : Math.min(timer, L.t_phaseEdge));
  const expectedDue = guard === null ? null : Math.max(guard, pulled);
  const margin = (L.t_L3 >= 0 && L.t_deepSpace >= 0)
    ? L.t_deepSpace - (L.t_L3 + revealSecondsOf(L3)) : null;
  return {
    l2Cause: L.l2Cause,
    causeAssertion: { expected: expectedCause, measured: L.l2Cause, pass: L.l2Cause === expectedCause },
    l2DueAtSeconds: L.l2DueAt >= 0 ? Number(L.l2DueAt.toFixed(3)) : null,
    diagMoments: {
      t_L1: L.t_L1 >= 0 ? Number(L.t_L1.toFixed(3)) : null,
      t_L2: L.t_L2 >= 0 ? Number(L.t_L2.toFixed(3)) : null,
      t_L3: L.t_L3 >= 0 ? Number(L.t_L3.toFixed(3)) : null,
      t_phaseEdge: L.t_phaseEdge >= 0 ? Number(L.t_phaseEdge.toFixed(3)) : null,
      t_deepSpace: L.t_deepSpace >= 0 ? Number(L.t_deepSpace.toFixed(3)) : null,
      exitHeldSeconds: Number(L.exitHeldSeconds.toFixed(3))
    },
    dueTimeFormula: expectedDue === null ? { pass: false, note: 'L1 never fired' } : {
      l1RevealSeconds: Number(revealSecondsOf(L1).toFixed(3)),
      revealGuardAt: Number(guard.toFixed(3)), timerAt: Number(timer.toFixed(3)),
      pulledAt: Number(pulled.toFixed(3)), expectedDueAt: Number(expectedDue.toFixed(3)),
      deltaSeconds: Number((L.l2DueAt - expectedDue).toFixed(4)),
      pass: Math.abs(L.l2DueAt - expectedDue) <= 1e-6
    },
    l2FiresAtDueTime: L.t_L2 >= 0 && L.l2DueAt >= 0
      ? { diffSeconds: Number((L.t_L2 - L.l2DueAt).toFixed(4)),
          pass: L.t_L2 >= L.l2DueAt - 1e-6 && L.t_L2 - L.l2DueAt <= 0.05 }
      : { pass: false, note: 'L2 never fired' },
    l1RevealNeverCut: guard === null || L.t_L2 < 0 ? { pass: null }
      : { revealCompleteAt: Number(guard.toFixed(3)), l2At: Number(L.t_L2.toFixed(3)),
          marginSeconds: Number((L.t_L2 - guard).toFixed(3)), pass: L.t_L2 >= guard - 1e-6 },
    marginFromDiag: margin === null ? { marginSeconds: null, note: 'L3 or deep_space absent' }
      : { l3RevealSeconds: Number(revealSecondsOf(L3).toFixed(3)),
          marginSeconds: Number(margin.toFixed(3)), floorSeconds: MARGIN_FLOOR_SECONDS,
          aboveFloor: margin >= MARGIN_FLOOR_SECONDS, flagBackToTriad: margin < MARGIN_FLOOR_SECONDS }
  };
}

const runs = Number(arg('--runs', '3'));
const igniteAt = Number(arg('--ignite', '10.0'));
const url = `${BASE}/?story=ch8-launch&profile=LOW`;
const browser = await launch();

const out = {
  schema: 'paravoxia.dischargeMeasurement.v1',
  runId: '2026-08-10-ch7-ch8-voice-repair',
  contractVersion: 'draft-v5',
  contractSha256: '36a7cb4f2bf9cc8d24d2413579225dcb50a4436b37a20fb762d79fec6cb4ecdb',
  route: 'canonical-ordered-ignition',
  routeScript: [
    'enter ch8-launch seated via pristine deep link (?story=ch8-launch&profile=LOW, no movie flag) at LOW, 1280x720',
    'focus click on the canvas at beat entry (focus only; no control binding)',
    `no control input until after L2 timer-fires at t_L1 + ${CH8_L1_MIN_SLOT_SECONDS}; standing control ignites at entry +${igniteAt.toFixed(1)} s`,
    'hold [SPACE] 0.6 s to ignite, then sustain [W] climb through the atmosphere boundary',
    'hold steady state through deep_space and the frozen exit window'
  ],
  base: BASE,
  url,
  igniteAtEntryOffsetSeconds: igniteAt,
  constants: {
    CH8_L1_MIN_SLOT_SECONDS,
    CH8_L2_MIN_SLOT_SECONDS,
    l3RevealContractSeconds: L3_REVEAL_CONTRACT_SECONDS,
    l3RevealMeasuredSeconds: L3_REVEAL_MEASURED_SECONDS,
    marginFloorSeconds: MARGIN_FLOOR_SECONDS
  },
  capturedAt: new Date().toISOString(),
  runs: []
};

await warmUp(browser, url);

// Hints carried run-to-run so the -0.3 s anchors can be scheduled ahead of a
// fact that is only knowable after it happens. Seeded from the iteration-3
// routeA measurements; overwritten by this route's own run 1.
let edgeAfterIgniteHint = Number(arg('--edgeHint', '1.5'));
let deepAfterEdgeHint = Number(arg('--deepHint', '3.8'));

for (let i = 0; i < runs; i++) {
  const page = await newPage(browser);
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e).slice(0, 300)));
  await page.goto(url, { waitUntil: 'load', timeout: 90000 }).catch(() => {});
  const entry = await waitForBeat(page, 'ch8-launch', 90000);
  const dir = path.join(OUT_DIR, `run${i + 1}`);
  const record = { run: i + 1, url, pageErrors, entryStoryClock: entry ? entry.story : null,
    edgeAfterIgniteHintSeconds: edgeAfterIgniteHint, deepAfterEdgeHintSeconds: deepAfterEdgeHint };
  if (!entry) {
    out.runs.push({ ...record, failed: 'ch8-launch never published' });
    console.log(`[ordered] run ${i + 1} FAILED: beat never published`);
    await page.__ctx.close();
    write();
    continue;
  }
  record.entryObserver = entry.observer ?? null;
  record.entryClockOffsetMs = entry.clockOffsetMs ?? null;
  record.probeReady = await waitForProbeReady(page);
  await page.mouse.click(640, 360).catch(() => {});
  record.focusClick = 'canvas click at beat entry, focus only';

  const igniteTarget = entry.story + igniteAt * 1000;
  let ignited = false;
  // The keyboard route must NOT block the capture loop: a blocking hold stalls
  // the shutter and mis-stamps the ignition frames. Space goes down inline (one
  // fast protocol message); the release and the [W] climb hold run on their own
  // chain and stamp their own measured clock.
  const action = async (s) => {
    if (ignited || s.storyClock < igniteTarget) return;
    ignited = true;
    await page.keyboard.down('Space');
    const t0 = await nowClock(page).catch(() => s.storyClock);
    record.ignitedAtEntryOffsetSeconds = Number(((t0 - entry.story) / 1000).toFixed(3));
    void (async () => {
      await new Promise(r => setTimeout(r, 600));
      await page.keyboard.up('Space').catch(() => {});
      await page.keyboard.down('KeyW').catch(() => {});
      const t = await nowClock(page).catch(() => null);
      if (t !== null) record.climbHeldAtEntryOffsetSeconds = Number(((t - entry.story) / 1000).toFixed(3));
    })();
  };

  let l1At = null, l2At = null, l3At = null, edgeAt = null, deepAt = null;
  let prevPhase = null;
  const session = await captureSession(page, dir, {
    entryStory: entry.story,
    stripIntervalMs: 220,
    capMs: 90000,
    action,
    targets: [
      // schedulable from the scripted route alone
      { id: 'ignition+0.2', at: igniteTarget + 200 },
      // -0.3 anchors scheduled off the carried hints; deviation reported
      { id: 'edge-0.3', at: igniteTarget + (edgeAfterIgniteHint - 0.3) * 1000 }
    ],
    onState: (s, addTarget, addBurst) => {
      if (l1At === null && s.storeCaption === L1) {
        l1At = s.storyClock;
        addTarget('L1+0.2', l1At + 200);
        // L2's timer slot is deterministic from L1, so -0.5 is schedulable.
        addTarget('L2-0.5', l1At + (CH8_L1_MIN_SLOT_SECONDS - 0.5) * 1000);
        addBurst(l1At + 3900, l1At + 5400);
      }
      if (l2At === null && s.storeCaption === L2) {
        l2At = s.storyClock;
        addTarget('L2+0.2', l2At + 200);
        addTarget('L2+0.7', l2At + 700);
      }
      if (edgeAt === null && prevPhase === 'surface' && s.phase !== 'surface' && s.controlMode === 'flight') {
        edgeAt = s.storyClock;
        addTarget('edge+0.2', edgeAt + 200);
        addTarget('deepSpace-0.3', edgeAt + (deepAfterEdgeHint - 0.3) * 1000);
      }
      prevPhase = s.phase;
      if (l3At === null && s.storeCaption === L3) {
        l3At = s.storyClock;
        addTarget('L3+1.0', l3At + 1000);
        addTarget('L3+2.0', l3At + 2000);
        addTarget('L3+3.0', l3At + 3000);
      }
      if (deepAt === null && s.phase === 'deep_space') {
        deepAt = s.storyClock;
        addTarget('deepSpace+0.0', s.storyClock);
      }
      return undefined;
    },
    // Dense climb window: ignition through 1.5 s past the exit fact.
    burstWindows: [{ from: igniteTarget - 200, to: igniteTarget + (edgeAfterIgniteHint + deepAfterEdgeHint + 1.5) * 1000 }],
    stopWhen: (s) => (deepAt !== null && s.storyClock - deepAt > 1600)
      || (s.storyClock - entry.story > (igniteAt + 30) * 1000)
  });

  // Steady state through the frozen exit window: no new input, keys stay held.
  const tail = Date.now() + 32000;
  let advanced = false;
  while (Date.now() < tail) {
    const b = await page.evaluate(() => window.__storyBeat ?? null).catch(() => null);
    if (b === 'ch8-crossing') { advanced = true; break; }
    await new Promise(r => setTimeout(r, 200));
  }
  await new Promise(r => setTimeout(r, 1200));
  await page.keyboard.up('KeyW').catch(() => {});
  await page.keyboard.up('Space').catch(() => {});

  const events = await readEvents(page);
  const a = analyse(events, entry.story);
  const assertions = ladderAssertions(a);
  const exitWindow = exitWindowAssertions(a);
  const anchorFrames = bindAnchorFrames(session.frames, a, record.ignitedAtEntryOffsetSeconds);
  if (a.tPhaseEdge !== null && record.ignitedAtEntryOffsetSeconds !== undefined) {
    edgeAfterIgniteHint = Number((a.tPhaseEdge - record.ignitedAtEntryOffsetSeconds).toFixed(3));
  }
  if (a.tDeepSpace !== null && a.tPhaseEdge !== null) {
    deepAfterEdgeHint = Number((a.tDeepSpace - a.tPhaseEdge).toFixed(3));
  }
  const liveDiag = await page.evaluate(() => (window.__voxDiag ? window.__voxDiag() : null)).catch(() => null);
  const launchDiag = pickLaunchDiag(session.frames, liveDiag);
  const diagChecks = diagAssertions(launchDiag, 'timer');
  out.runs.push({ ...record, advancedToCh8Crossing: advanced,
    frameDir: path.relative(RUN_DIR, dir), frameCount: session.frames.length,
    frames: session.frames, unmetTargets: session.unmetTargets,
    ladder: a, assertions, exitWindow, anchorFrames,
    launchDiag, diagAssertions: diagChecks, events });
  console.log(`[ordered] run ${i + 1} L1=${a.tL1} L2=${a.tL2}(diagCause=${diagChecks.l2Cause}) L3=${a.tL3} edge=${a.tPhaseEdge} deep=${a.tDeepSpace} margin=${assertions.dischargeMargin.marginSeconds} diagMargin=${diagChecks.marginFromDiag ? diagChecks.marginFromDiag.marginSeconds : null} L4=${a.tL4} exitPass=${exitWindow.pass} frames=${session.frames.length}`);
  await page.__ctx.close();
  write();
}

function write() {
  const p = path.join(OUT_DIR, 'routeA-ordered.json');
  fs.writeFileSync(p, `${JSON.stringify(out, null, 2)}\n`);
  console.log('wrote', p);
}

write();
await browser.close();
