// Signed-AV state trace for the shipped ch7/ch8 baseline.
//
// Reads the LIVE runtime modules through the Vite dev server's ESM graph
// (`import('/src/story/...')` resolves to the same module instance the app is
// running), so camera authority, applied FOV, active anchor/shot, repair stage
// and reality stage are observed rather than inferred. Read-only: no exported
// mutator is called.
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
const { chromium } = await import(
  '/home/thomasphillip/Projects/vox/main/node_modules/playwright-core/index.mjs'
);

const RUN_DIR = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(RUN_DIR, 'evidence-hires', 'av-state-trace.json');
const BASE = process.env.VOX_BASE ?? 'http://localhost:5176';
const POLL_MS = 200;

const SCENARIOS = [
  { id: 'ch7-reconstruct', url: '?story=ch7-reconstruct&movie=1&profile=LOW', stopBeat: 'ch7-board', capSeconds: 120, tailSeconds: 8 },
  { id: 'ch8-launch', url: '?story=ch8-launch&movie=1&profile=LOW', stopBeat: 'ch8-crossing', capSeconds: 120, tailSeconds: 8 }
];

const READ = async () => {
  const w = window;
  const out = { beat: w.__storyBeat ?? null };
  try {
    const av = await import('/src/story/signedSceneAvRuntime.ts');
    out.av = av.getSignedSceneAvDebugSnapshot();
  } catch (e) { out.avError = String(e).slice(0, 160); }
  try {
    const ship = await import('/src/game/systems/shipRestoration.ts');
    out.repairStage = ship.getShipRepairStage();
  } catch (e) { out.repairError = String(e).slice(0, 160); }
  try {
    const policy = await import('/src/story/storyInputPolicy.ts');
    out.inputPolicy = typeof policy.getStoryInputPolicy === 'function'
      ? policy.getStoryInputPolicy()
      : null;
  } catch (e) { out.policyError = String(e).slice(0, 160); }
  try {
    const reality = await import('/src/game/systems/realityRenderSystem.ts');
    out.realityStage = typeof reality.getVoxelRealityStage === 'function'
      ? reality.getVoxelRealityStage()
      : null;
  } catch (e) { out.realityError = String(e).slice(0, 160); }
  try {
    const flight = await import('/src/state/spaceFlight.ts');
    const snap = flight.getSpaceFlightSnapshot();
    out.flight = { phase: snap.phase, controlMode: snap.controlMode };
  } catch (e) { out.flightError = String(e).slice(0, 160); }
  return out;
};

const pwDir = path.join(os.homedir(), '.cache/ms-playwright');
const chromeDir = fs.readdirSync(pwDir).filter(d => /^chromium-\d+$/.test(d)).sort().pop();
const browser = await chromium.launch({
  executablePath: path.join(pwDir, chromeDir, 'chrome-linux/chrome'),
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--window-size=1280,720']
});

const report = { capturedAt: new Date().toISOString(), base: BASE, scenarios: [] };
for (const scenario of SCENARIOS) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const record = { id: scenario.id, url: BASE + '/' + scenario.url, trace: [], reachedStopBeat: false };
  await page.goto(BASE + '/' + scenario.url, { waitUntil: 'load', timeout: 90000 }).catch(e => {
    record.gotoError = String(e).slice(0, 200);
  });
  const t0 = Date.now();
  let prev = null;
  let stopAt = null;
  while (true) {
    const elapsed = Date.now() - t0;
    if (elapsed / 1000 > scenario.capSeconds) break;
    const state = await page.evaluate(READ).catch(e => ({ error: String(e).slice(0, 160) }));
    const key = JSON.stringify(state);
    if (key !== prev) {
      record.trace.push({ t: Number((elapsed / 1000).toFixed(2)), ...state });
      prev = key;
    }
    if (scenario.stopBeat && state.beat === scenario.stopBeat && stopAt === null) {
      record.reachedStopBeat = true;
      stopAt = elapsed;
    }
    if (stopAt !== null && elapsed - stopAt > scenario.tailSeconds * 1000) break;
    await new Promise(r => setTimeout(r, POLL_MS));
  }
  await page.close();
  report.scenarios.push(record);
  console.log(`[${scenario.id}] samples=${record.trace.length} reachedStop=${record.reachedStopBeat}`);
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
await browser.close();
console.log('wrote', OUT);
