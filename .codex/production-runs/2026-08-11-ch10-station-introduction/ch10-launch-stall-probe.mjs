// Blocking defect isolation: in the movie lane, ch10-ask boards the Kestrel on
// Tidegarden and then holds SPACE forever — flight.phase never leaves
// 'surface', so the return crossing never begins and the beat never completes.
// All three cold runs reproduce it identically.
//
// This probe dumps the full flight state at the stall and runs ch8-launch as
// the control: same autopilot grammar, shipped and known good.
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

const DUMP = async () => {
  const out = { beat: window.__storyBeat ?? null };
  const safe = (o) => JSON.parse(JSON.stringify(o, (k, v) => (typeof v === 'function' ? '[fn]' : v)));
  try {
    const f = await import('/src/state/spaceFlight.ts');
    out.spaceFlight = safe(f.getSpaceFlightSnapshot());
  } catch (e) { out.spaceFlightError = String(e).slice(0, 150); }
  try {
    const s = await import('/src/state/systemFlight.ts');
    out.systemFlight = safe(s.getSystemFlightSnapshot());
  } catch (e) { out.systemFlightError = String(e).slice(0, 150); }
  try {
    const p = await import('/src/story/storyInputPolicy.ts');
    out.inputPolicy = safe(p.getStoryInputPolicy());
  } catch (e) { out.policyError = String(e).slice(0, 150); }
  try {
    const r = await import('/src/story/shipRepair.ts');
    out.shipRepairStage = r.getShipRepairStage ? r.getShipRepairStage() : null;
  } catch { /* module name may differ */ }
  try {
    const st = await import('/src/story/storyState.ts');
    const snap = st.getStoryStateSnapshot();
    out.story = { beat: snap.beat, chapter: snap.chapter, active: snap.active };
  } catch { /* ignore */ }
  out.autopilot = window.__autopilot ? {
    beat: window.__autopilot.beat, clock: window.__autopilot.clock,
    pos: window.__autopilot.pos, controls: window.__autopilot.controls,
    stillTime: window.__autopilot.stillTime, nudges: window.__autopilot.nudges,
    surfaceContact: window.__autopilot.surfaceContact
  } : null;
  const hud = document.querySelector('[data-story-guidance-hud]');
  out.hudText = hud ? hud.innerText.replace(/\s*\n\s*/g, ' | ').trim() : null;
  return out;
};

const browser = await chromium.launch({
  executablePath: path.join(pwDir, chromeDir, 'chrome-linux/chrome'),
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--window-size=1280,720']
});

const report = { capturedAt: new Date().toISOString(), base: BASE, scenarios: {} };
const OUT = path.join(OUT_DIR, 'ch10-launch-stall.json');
const flush = () => fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');

for (const sc of [
  { id: 'ch10-ask-movie', url: '?story=ch10-ask&movie=1&profile=LOW', watch: 150 },
  { id: 'ch8-launch-movie-control', url: '?story=ch8-launch&movie=1&profile=LOW', watch: 150 }
]) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 180)));
  await page.goto(`${BASE}/${sc.url}`, { waitUntil: 'load', timeout: 120000 });
  await new Promise(r => setTimeout(r, 14000));
  const samples = [];
  const t0 = Date.now();
  let phaseChanged = false;
  let firstPhase = null;
  while ((Date.now() - t0) / 1000 < sc.watch) {
    const d = await page.evaluate(DUMP).catch(() => null);
    if (d) {
      const ph = d.spaceFlight?.phase ?? null;
      firstPhase ??= ph;
      if (ph !== firstPhase) phaseChanged = true;
      samples.push({ t: Number(((Date.now() - t0) / 1000).toFixed(1)), phase: ph,
        controlMode: d.spaceFlight?.controlMode ?? null,
        altitude: d.spaceFlight?.altitude ?? null,
        pos: d.autopilot?.pos ?? null,
        jump: d.autopilot?.controls?.jump ?? null,
        allowJump: d.inputPolicy?.allowJump ?? null,
        beat: d.beat });
    }
    await new Promise(r => setTimeout(r, 3000));
  }
  const full = await page.evaluate(DUMP).catch(() => null);
  // Does a REAL keypress do what the synthetic control flag cannot?
  await page.keyboard.down('Space');
  await new Promise(r => setTimeout(r, 8000));
  const afterHeldSpace = await page.evaluate(DUMP).catch(() => null);
  await page.keyboard.up('Space');
  report.scenarios[sc.id] = { url: sc.url, samples, phaseChanged, firstPhase,
    fullStateAtEnd: full, afterHeldRealSpace: {
      phase: afterHeldSpace?.spaceFlight?.phase ?? null,
      controlMode: afterHeldSpace?.spaceFlight?.controlMode ?? null,
      pos: afterHeldSpace?.autopilot?.pos ?? null },
    pageErrors: errs };
  flush();
  console.log(`[${sc.id}] firstPhase=${firstPhase} changed=${phaseChanged} endPhase=${full?.spaceFlight?.phase}`
    + ` afterRealSpace=${afterHeldSpace?.spaceFlight?.phase} errs=${errs.length}`);
  await page.close();
}

await browser.close();
flush();
console.log('wrote', OUT);
