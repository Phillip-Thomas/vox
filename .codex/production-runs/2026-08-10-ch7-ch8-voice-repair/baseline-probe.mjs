// Shipped-baseline capture probe for the 2026-08-10 ch7/ch8 voice-repair run.
//
// One long-running headless session walks the shipped ch6-exit -> ch7 -> ch8 ->
// ch9-entry surface at the LOW quality profile, stamping a per-second state
// trace (beat, objective id/marker/health, work-order copy, caption text, audit
// band text, autopilot pos/goal/keys) and a screenshot strip. It never writes
// game source and never mutates runtime state; every read is DOM or an already
// exposed dev global.
//
// Usage: node baseline-probe.mjs [scenarioId ...]
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
// Resolved from the game workspace: this probe lives outside `main/`, so
// playwright-core must be loaded from the repo's only install of it.
const { chromium } = await import(
  '/home/thomasphillip/Projects/vox/main/node_modules/playwright-core/index.mjs'
);

const RUN_DIR = path.dirname(new URL(import.meta.url).pathname);
const OUT_DIR = path.join(RUN_DIR, process.env.VOX_OUT ?? 'evidence');
// 5173/5174 on this machine are held by the sibling Paraform project; the
// Paravoxia dev server for this run is bound to 5176 with --strictPort.
const BASE = process.env.VOX_BASE ?? 'http://localhost:5176';
const SHOT_INTERVAL_MS = Number(process.env.VOX_SHOT_MS ?? 4000);
const POLL_MS = Number(process.env.VOX_POLL_MS ?? 1000);

const SCENARIOS = [
  { id: 'ch7-reconstruct', url: '?story=ch7-reconstruct&movie=1&profile=LOW', stopBeat: 'ch7-board', capSeconds: 300, tailSeconds: 10 },
  { id: 'ch8-launch', url: '?story=ch8-launch&movie=1&profile=LOW', stopBeat: 'ch8-crossing', capSeconds: 240, tailSeconds: 10 },
  { id: 'ch7-board-entry', url: '?story=ch7-board&profile=LOW', stopBeat: null, capSeconds: 25, tailSeconds: 0 },
  { id: 'ch8-crossing-entry', url: '?story=ch8-crossing&profile=LOW', stopBeat: null, capSeconds: 25, tailSeconds: 0 },
  { id: 'ch6-dive', url: '?story=ch6-dive&movie=1&profile=LOW', stopBeat: 'ch7-reconstruct', capSeconds: 300, tailSeconds: 12 },
  { id: 'ch8-landfall', url: '?story=ch8-landfall&movie=1&profile=LOW', stopBeat: 'ch9-settle', capSeconds: 300, tailSeconds: 12 }
];

const requested = process.argv.slice(2);
const scenarios = requested.length
  ? SCENARIOS.filter(s => requested.includes(s.id))
  : SCENARIOS;

fs.mkdirSync(OUT_DIR, { recursive: true });

const pwDir = path.join(os.homedir(), '.cache/ms-playwright');
const chromeDir = fs.readdirSync(pwDir).filter(d => /^chromium-\d+$/.test(d)).sort().pop();
const executablePath = path.join(pwDir, chromeDir, 'chrome-linux/chrome');

const READ_STATE = () => {
  const w = window;
  const hud = document.querySelector('[data-story-guidance-hud]');
  const caption = document.querySelector('[data-story-caption]');
  const lives = Array.from(document.querySelectorAll('div[aria-live="polite"]'));
  const audit = lives.find(el => !el.hasAttribute('data-story-caption')
    && !el.hasAttribute('data-story-guidance-hud'));
  const ap = w.__autopilot ?? null;
  return {
    beat: w.__storyBeat ?? null,
    objectiveId: hud?.getAttribute('data-objective-id') ?? null,
    markerLabel: hud?.getAttribute('data-objective-marker-label') ?? null,
    health: hud?.getAttribute('data-objective-health') ?? null,
    requiresMarker: hud?.getAttribute('data-objective-requires-marker') ?? null,
    hudText: hud ? hud.innerText.replace(/\s*\n\s*/g, ' | ').trim() : null,
    captionText: caption ? caption.innerText.trim() : null,
    auditText: audit ? audit.innerText.replace(/\s*\n\s*/g, ' | ').trim() : null,
    autopilot: ap
      ? {
        goal: ap.goal ?? null,
        keys: ap.keys ?? null,
        stillTime: ap.stillTime ?? null,
        nudges: ap.nudges ?? null,
        pos: ap.pos ?? null
      }
      : null
  };
};

const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--window-size=1280,720']
});

const report = { capturedAt: new Date().toISOString(), base: BASE, scenarios: [] };
const reportPath = path.join(OUT_DIR, process.env.VOX_TRACE ?? 'baseline-trace.json');

for (const scenario of scenarios) {
  const dir = path.join(OUT_DIR, scenario.id);
  fs.mkdirSync(dir, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const consoleErrors = [];
  page.on('pageerror', e => consoleErrors.push(String(e).slice(0, 300)));
  const record = {
    id: scenario.id,
    url: BASE + '/' + scenario.url,
    startedAt: new Date().toISOString(),
    trace: [],
    shots: [],
    reachedStopBeat: false,
    timedOut: false,
    pageErrors: consoleErrors
  };
  try {
    await page.goto(BASE + '/' + scenario.url, { waitUntil: 'load', timeout: 90000 });
  } catch (e) {
    record.gotoError = String(e).slice(0, 300);
  }
  const t0 = Date.now();
  let lastShot = -SHOT_INTERVAL_MS;
  let shotIndex = 0;
  let stopAt = null;
  let prevKey = null;
  while (true) {
    const elapsed = Date.now() - t0;
    if (elapsed / 1000 > scenario.capSeconds) { record.timedOut = !record.reachedStopBeat; break; }
    let state;
    try {
      state = await page.evaluate(READ_STATE);
    } catch (e) {
      state = { error: String(e).slice(0, 200) };
    }
    const at = Math.round(elapsed / 1000);
    const key = JSON.stringify([state.beat, state.objectiveId, state.markerLabel, state.health,
      state.hudText, state.captionText, state.auditText]);
    if (key !== prevKey) {
      record.trace.push({ t: Number((elapsed / 1000).toFixed(2)), ...state, changed: true });
      prevKey = key;
    } else if (POLL_MS >= 1000 && at % 5 === 0) {
      record.trace.push({ t: at, beat: state.beat, objectiveId: state.objectiveId, changed: false,
        autopilot: state.autopilot });
    }
    if (elapsed - lastShot >= SHOT_INTERVAL_MS) {
      const name = `${String(shotIndex).padStart(3, '0')}_${String(at).padStart(3, '0')}s_${state.beat ?? 'null'}.png`;
      try {
        await page.screenshot({ path: path.join(dir, name) });
        record.shots.push({ file: `${path.basename(OUT_DIR)}/${scenario.id}/${name}`, t: at, beat: state.beat ?? null,
          objectiveId: state.objectiveId ?? null, caption: state.captionText ?? null });
      } catch { /* frame miss is recorded by absence */ }
      shotIndex++;
      lastShot = elapsed;
    }
    if (scenario.stopBeat && state.beat === scenario.stopBeat && stopAt === null) {
      record.reachedStopBeat = true;
      record.stopBeatAtSeconds = at;
      stopAt = elapsed;
    }
    if (stopAt !== null && elapsed - stopAt > scenario.tailSeconds * 1000) break;
    await new Promise(r => setTimeout(r, POLL_MS));
  }
  record.endedAt = new Date().toISOString();
  record.durationSeconds = Math.round((Date.now() - t0) / 1000);
  await page.close();
  report.scenarios.push(record);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`[${scenario.id}] ${record.durationSeconds}s reachedStop=${record.reachedStopBeat} timedOut=${record.timedOut} shots=${record.shots.length}`);
}

await browser.close();
console.log('wrote', reportPath);
