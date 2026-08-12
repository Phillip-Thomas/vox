// Transit attitude, read through the APP'S OWN module specifiers.
//
// The engineer's D-5 repairs re-versioned the edited modules, so a bare
// `import('/src/story/autopilot.ts')` returns a pristine second instance whose
// module globals nobody writes — it reports targetSystemPosition null forever
// and the signed-AV history empty. Every module here is resolved from the URL
// the app itself was rewritten to import.
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
const { chromium } = await import(
  '/home/thomasphillip/Projects/vox/main/node_modules/playwright-core/index.mjs'
);

const RUN_DIR = path.dirname(new URL(import.meta.url).pathname);
const OUT_DIR = path.join(RUN_DIR, 'evidence', 'verification');
const BASE = process.env.VOX_BASE ?? 'http://localhost:5176';
const WATCH = Number(process.env.VOX_WATCH ?? 300);
fs.mkdirSync(OUT_DIR, { recursive: true });
const pwDir = path.join(os.homedir(), '.cache/ms-playwright');
const chromeDir = fs.readdirSync(pwDir).filter(d => /^chromium-\d+$/.test(d)).sort().pop();

const RESOLVE = async () => {
  // Walk a few known importers and keep the rewritten (HMR-timestamped) URLs.
  const hosts = ['/src/App.tsx', '/src/story/StoryDirectorDriver.tsx',
    '/src/story/emergentStoryDirector.ts', '/src/components/ShipController.tsx',
    '/src/components/SystemCompanionBodies.tsx'];
  const want = {
    autopilot: /autopilot\.ts/, signedAv: /signedSceneAvRuntime\.ts/,
    spaceFlight: /state\/spaceFlight\.ts/, systemFlight: /state\/systemFlight\.ts/,
    storyState: /story\/storyState\.ts/, progression: /progressionSystem\.ts/
  };
  const found = {};
  for (const h of hosts) {
    let src;
    try { src = await (await fetch(h)).text(); } catch { continue; }
    for (const [key, re] of Object.entries(want)) {
      if (found[key]) continue;
      for (const m of src.matchAll(/from\s*["']([^"']+)["']/g)) {
        if (re.test(m[1])) { found[key] = m[1]; break; }
      }
    }
  }
  window.__voxSpec = found;
  return found;
};

const READ = async () => {
  const w = window;
  const spec = w.__voxSpec ?? {};
  const out = { beat: w.__storyBeat ?? null, specifiers: spec };
  const hud = document.querySelector('[data-story-guidance-hud]');
  const caption = document.querySelector('[data-story-caption]');
  out.objectiveId = hud?.getAttribute('data-objective-id') ?? null;
  out.hudText = hud ? hud.innerText.replace(/\s*\n\s*/g, ' | ').trim() : null;
  out.caption = caption ? caption.innerText.trim() : null;
  const imp = async (key) => (spec[key] ? import(/* @vite-ignore */ spec[key]) : null);
  try {
    const ap = await imp('autopilot');
    if (ap) {
      const d = ap.getAutopilotFlightDirective();
      const tsp = d.targetSystemPosition;
      out.directive = {
        active: d.active, beat: d.beat, targetWorldId: d.targetWorldId ?? null,
        targetSystemPosition: tsp
          ? (Array.isArray(tsp) ? tsp.map(n => Math.round(n))
            : [Math.round(tsp.x), Math.round(tsp.y), Math.round(tsp.z)])
          : null,
        keys: Object.entries(d.controls ?? {}).filter(([, v]) => v === true).map(([k]) => k)
      };
    }
  } catch (e) { out.directiveError = String(e).slice(0, 140); }
  try {
    const av = await imp('signedAv');
    if (av) {
      const s = av.getSignedSceneAvDebugSnapshot();
      out.av = { active: s.active, beat: s.beat, anchorId: s.anchorId,
        history: s.activationHistoryAnchorIds ?? [],
        authority: s.shot?.cameraAuthority ?? null, fov: s.shot?.lens?.appliedFovDeg ?? null,
        agency: s.shot?.agency ?? null, postFx: s.postFx?.activeEffectIds ?? [] };
    }
  } catch (e) { out.avError = String(e).slice(0, 140); }
  try {
    const f = await imp('spaceFlight');
    if (f) { const s = f.getSpaceFlightSnapshot(); out.flight = { phase: s.phase, controlMode: s.controlMode }; }
  } catch { /* ignore */ }
  try {
    const s = await imp('systemFlight');
    if (s) {
      const v = s.getSystemFlightSnapshot();
      out.system = { activePlanetId: v.activePlanetId, locationMode: v.locationMode,
        pos: (v.pose?.position ?? []).map(n => Math.round(n)),
        quat: v.pose?.quaternion ?? null,
        speed: Math.round(Math.hypot(...(v.pose?.velocity ?? [0, 0, 0])) * 100) / 100 };
    }
  } catch { /* ignore */ }
  try {
    const st = await imp('storyState');
    const pr = await imp('progression');
    if (st && pr) {
      out.milestones = {
        transitIgnited: pr.hasMilestone(st.STORY_MILESTONES.ch10TransitIgnited),
        seamPassed: pr.hasMilestone(st.STORY_MILESTONES.ch10SeamPassed),
        stationResolved: pr.hasMilestone(st.STORY_MILESTONES.ch10StationResolved)
      };
    }
  } catch { /* ignore */ }
  out.contacts = w.__spaceStationContacts ? w.__spaceStationContacts() : null;
  // Attitude: the angle between the ship's nose and the claimed bearing.
  if (out.system?.quat && out.system?.pos && out.directive?.targetSystemPosition) {
    const [x, y, z, wq] = out.system.quat;
    const vx = -(2 * (x * z + wq * y));
    const vy = -(2 * (y * z - wq * x));
    const vz = -(1 - 2 * (x * x + y * y));
    const t = out.directive.targetSystemPosition;
    const tx = t[0] - out.system.pos[0], ty = t[1] - out.system.pos[1], tz = t[2] - out.system.pos[2];
    const fl = Math.hypot(vx, vy, vz), tl = Math.hypot(tx, ty, tz);
    if (fl > 0 && tl > 0) {
      const dot = (vx * tx + vy * ty + vz * tz) / (fl * tl);
      out.bearingErrorDeg = Number((Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI).toFixed(2));
      out.rangeToTarget = Math.round(tl);
    }
  }
  return out;
};

const browser = await chromium.launch({
  executablePath: path.join(pwDir, chromeDir, 'chrome-linux/chrome'),
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--window-size=1280,720']
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e).slice(0, 180)));
await page.goto(`${BASE}/?story=ch10-transit&movie=1&profile=LOW`, { waitUntil: 'load', timeout: 120000 });
await new Promise(r => setTimeout(r, 10000));
const specifiers = await page.evaluate(RESOLVE);
const report = { capturedAt: new Date().toISOString(), base: BASE,
  url: `${BASE}/?story=ch10-transit&movie=1&profile=LOW`,
  note: 'every module read through the app-resolved (HMR-timestamped) specifier',
  specifiers, samples: [], pageErrors };
const OUT = path.join(OUT_DIR, 'ch10-attitude.json');
const t0 = Date.now();
while ((Date.now() - t0) / 1000 < WATCH) {
  let s;
  try { s = await page.evaluate(READ); } catch (e) { report.readError = String(e).slice(0, 160); break; }
  report.samples.push({ t: Number(((Date.now() - t0) / 1000).toFixed(1)), ...s });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');
  await new Promise(r => setTimeout(r, 3000));
}
const withAttitude = report.samples.filter(s => s.bearingErrorDeg != null);
report.summary = {
  samples: report.samples.length,
  samplesWithDirectiveTarget: report.samples.filter(s => s.directive?.targetSystemPosition).length,
  samplesWithAttitude: withAttitude.length,
  bearingErrorRange: withAttitude.length
    ? [Math.min(...withAttitude.map(s => s.bearingErrorDeg)), Math.max(...withAttitude.map(s => s.bearingErrorDeg))]
    : null,
  finalBearingErrorDeg: withAttitude.at(-1)?.bearingErrorDeg ?? null,
  stationDistanceFirst: report.samples.find(s => s.contacts?.stations?.[0])?.contacts.stations[0].distance ?? null,
  stationDistanceLast: [...report.samples].reverse().find(s => s.contacts?.stations?.[0])?.contacts.stations[0].distance ?? null,
  anchorHistory: [...new Set(report.samples.flatMap(s => s.av?.history ?? []))],
  milestonesLast: report.samples.at(-1)?.milestones ?? null
};
fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');
await browser.close();
console.log(JSON.stringify(report.summary, null, 1));
console.log('wrote', OUT);
