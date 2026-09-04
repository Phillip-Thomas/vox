// Owner-reported defect (existing allowed scope; no new lock revision): "the read the fault interactable
// thing is in the middle of the planet when I start the chapter."
//
// This probe is the causal measurement, before and after the repair. For every
// beat that reconstructs the second hearth through
// bootstrapTidegardenHabitatDebug() it records, in ONE consistent frame:
//
//   * the habitat core's world position, straight from the habitat authority
//   * the player's world position and gravity up, from playerFrame
//   * the TRUE terrain surface height in the core's own column, marched from
//     the live voxel system plus the world generator (buried terrain included)
//   * euclidean distance vs the autopilot's gait distance, side by side
//   * the shared marker target the HUD actually points at
//   * whether the shipped ch10 interaction prompt resolves at that range
//
// The gait metric is the reason this survived every proximity check in the run:
// it discounts downward offset entirely, so a core buried 46 units straight
// down measures under 7. Both numbers are recorded here so the two can never
// again be confused for each other.
//
// Pure state + DOM text. No frames.
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
const { chromium } = await import(
  '/home/thomasphillip/Projects/vox/main/node_modules/playwright-core/index.mjs'
);

const RUN_DIR = path.dirname(new URL(import.meta.url).pathname);
const OUT_DIR = path.join(RUN_DIR, 'evidence', 'verification');
const BASE = process.env.VOX_BASE ?? 'http://localhost:5176';
const PHASE = process.env.VOX_PHASE ?? 'post-repair';
fs.mkdirSync(OUT_DIR, { recursive: true });
const pwDir = path.join(os.homedir(), '.cache/ms-playwright');
const chromeDir = fs.readdirSync(pwDir).filter(d => /^chromium-\d+$/.test(d)).sort().pop();

const TIDEGARDEN = { worldId: '-1,-1:p1', seed: 1600321158 };
const VOXEL_SCALE = 2;
/** emergentStoryDirector.ts CH10_CORE_INTERACT_DISTANCE */
const CORE_INTERACT_DISTANCE = 4.2;

const RESOLVE = async () => {
  // MODULE IDENTITY, not module path: under HMR the app's live modules are
  // served at rewritten specifiers, and a bare import of the source path yields
  // a SECOND pristine instance describing a runtime nobody is playing.
  const hosts = ['/src/App.tsx', '/src/story/StoryDirectorDriver.tsx',
    '/src/story/emergentStoryDirector.ts', '/src/story/autopilot.ts',
    '/src/story/tidegardenLandfallBootstrap.ts', '/src/story/storyState.ts',
    '/src/components/SystemCompanionBodies.tsx', '/src/story/storyDirector.ts'];
  const want = {
    storyState: /story\/storyState\.ts/,
    director: /emergentStoryDirector\.ts/,
    habitat: /habitatSystem\.ts/,
    playerFrame: /state\/playerFrame\.ts/,
    tidegarden: /tidegardenRoute\.ts/,
    voxelSystem: /efficientVoxelSystem\.ts/,
    worldGen: /worldGenCache\.ts/,
    settlement: /tidegardenSettlement\.ts/,
    systemFlight: /state\/systemFlight\.ts/,
    storyWorld: /world\/storyWorld\.ts/,
    interactions: /interactionSystem\.ts/,
    objectiveDirector: /ux\/objectiveDirector\.ts/
  };
  const found = {};
  const seen = new Set();
  const scan = async (url, depth) => {
    if (seen.has(url) || depth > 2) return;
    seen.add(url);
    let src; try { src = await (await fetch(url)).text(); } catch { return; }
    const specs = [...src.matchAll(/from\s*["']([^"']+)["']/g)].map(m => m[1]);
    for (const [k, re] of Object.entries(want)) {
      if (found[k]) continue;
      const hit = specs.find(s => re.test(s));
      if (hit) found[k] = hit;
    }
    if (depth < 2) {
      for (const s of specs) {
        if (/^[./]/.test(s) || s.startsWith('/')) await scan(s, depth + 1);
      }
    }
  };
  for (const h of hosts) await scan(h, 0);
  window.__voxSpec = found;
  try {
    const cs = await (await fetch('/src/components/SystemCompanionBodies.tsx')).text();
    const threeUrl = cs.match(/from\s*["']([^"']*deps\/three\.js[^"']*)["']/)[1];
    window.__THREE = await import(/* @vite-ignore */ threeUrl);
  } catch (e) { window.__voxThreeError = String(e).slice(0, 160); }
  return found;
};

const MEASURE = async () => {
  const w = window, THREE = w.__THREE, spec = w.__voxSpec ?? {};
  const out = { spec: Object.keys(spec) };
  const imp = async (k) => (spec[k] ? import(/* @vite-ignore */ spec[k]) : null);
  try {
    const story = await imp('storyState');
    const snap = story.getStoryStateSnapshot();
    out.story = { chapter: snap.chapter, beat: snap.beat, active: snap.active };
  } catch (e) { out.storyError = String(e).slice(0, 200); }
  try {
    const sys = await imp('systemFlight');
    const s = sys.getSystemFlightSnapshot();
    out.systemFlight = { activePlanetId: s.activePlanetId, locationMode: s.locationMode };
  } catch (e) { out.systemFlightError = String(e).slice(0, 200); }

  const pf = await imp('playerFrame');
  const pp = pf.getPlayerWorldPosition();
  const up = pf.getPlayerUp();
  out.playerWorld = [pp.x, pp.y, pp.z].map(n => Number(n.toFixed(3)));
  out.playerUp = [up.x, up.y, up.z].map(n => Number(n.toFixed(3)));

  const h = await imp('habitat');
  const t = await imp('tidegarden');
  const st = h.getHabitatWorldState(t.TIDEGARDEN_WORLD_ID);
  out.habitatPresent = !!st;
  if (!st) return out;
  out.core = {
    shelterId: st.core.shelterId,
    cell: [...st.core.cell],
    supportCell: [...st.core.supportCell],
    position: st.core.position.map(n => Number(n.toFixed(3))),
    up: st.core.up ? [...st.core.up] : null
  };
  out.shelterCertified = !!st.shelterCertification;

  const cp = new THREE.Vector3(...st.core.position);
  // Euclidean: the honest "is the player at the thing" distance.
  out.euclidToPlayer = Number(cp.distanceTo(pp).toFixed(3));
  // The autopilot's gait measure (autopilot.ts gaitDistance): tangential range
  // plus max(0, vertical - 1). Recorded ONLY for contrast.
  const toGoal = cp.clone().sub(pp);
  const vertical = toGoal.dot(up);
  const tangential = toGoal.clone().addScaledVector(up, -vertical);
  out.verticalOffset = Number(vertical.toFixed(3));
  out.tangentialDistance = Number(tangential.length().toFixed(3));
  out.legacyGaitDistance = Number((tangential.length() + Math.max(0, vertical - 1)).toFixed(3));

  // TRUE surface height in the core's own column, on the player's dominant face.
  // hasVoxel catches placed + exposed terrain; the generator catches buried
  // terrain that has not been meshed yet.
  try {
    const vox = (await imp('voxelSystem')).voxelSystem;
    const wg = await imp('worldGen');
    const sw = await imp('storyWorld');
    const planetSize = sw?.storyAnchors?.planetSize ?? 50;
    out.anchors = {
      planetSize,
      terrainSeed: sw?.storyAnchors?.terrainSeed ?? null,
      voxelWorldId: vox.getWorldId?.() ?? null
    };
    const gen = wg.getWorldGen(planetSize, TIDEGARDEN_SEED, t.TIDEGARDEN_WORLD_ID).generator;
    const solid = (x, y, z) => vox.hasVoxel(x, y, z)
      || (gen.shouldVoxelExist(x, y, z) && !vox.isDeleted(x, y, z));
    // +Y face column through the core's cell.
    const cx = st.core.cell[0], cz = st.core.cell[2];
    let topCell = null;
    for (let y = 80; y >= -80; y--) { if (solid(cx, y, cz)) { topCell = y; break; } }
    out.terrain = {
      worldId: t.TIDEGARDEN_WORLD_ID,
      column: [cx, cz],
      topSolidCell: topCell,
      // The habitat cell sits one cell ABOVE the support voxel.
      expectedCoreCellY: topCell === null ? null : topCell + 1,
      surfaceWorldY: topCell === null ? null : (topCell + 1) * 2,
      coreCellY: st.core.cell[1],
      coreWorldY: Number(st.core.position[1].toFixed(3))
    };
    out.terrain.coreCellsBelowSurface = topCell === null
      ? null : (topCell + 1) - st.core.cell[1];
    // Same march under the PLAYER's own column, to prove the two agree.
    const px = Math.round(pp.x / 2), pz = Math.round(pp.z / 2);
    let ptop = null;
    for (let y = 80; y >= -80; y--) { if (solid(px, y, pz)) { ptop = y; break; } }
    out.terrain.playerColumn = [px, pz];
    out.terrain.playerColumnTopSolidCell = ptop;
    out.terrain.playerColumnSurfaceWorldY = ptop === null ? null : (ptop + 1) * 2;
  } catch (e) { out.terrainError = String(e).slice(0, 240); }

  // What the HUD marker points at, and whether the shipped prompt resolves.
  try {
    const d = await imp('director');
    const od = await imp('objectiveDirector');
    const objective = od?.getActiveGuidedStoryObjective?.() ?? null;
    out.objective = objective
      ? { id: objective.id, requiresMarker: objective.requiresMarker ?? true,
          markerLabel: objective.markerLabel ?? null }
      : null;
    const target = d.getChapter10MarkerTarget?.(out.story?.beat ?? null, objective) ?? null;
    out.markerTarget = target
      ? { position: [target.position.x, target.position.y, target.position.z]
            .map(n => Number(n.toFixed(3))),
          label: target.label ?? null,
          projectionSpace: target.projectionSpace ?? 'surface',
          euclidToPlayer: Number(target.position.distanceTo(pp).toFixed(3)) }
      : null;
  } catch (e) { out.markerError = String(e).slice(0, 240); }

  out.prompts = [...document.querySelectorAll('[data-interaction-prompt="primary"]')]
    .map(e => e.innerText.replace(/\s+/g, ' ').trim());
  out.promptActive = out.prompts.length > 0;
  return out;
};

const browser = await chromium.launch({
  executablePath: path.join(pwDir, chromeDir, 'chrome-linux/chrome'),
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--window-size=1280,720']
});

const report = {
  capturedAt: new Date().toISOString(),
  phase: PHASE,
  base: BASE,
  defect: {
    id: 'OD-habitat-core-burial',
    reportedBy: 'owner',
    lockRevision: 'existing-allowed-scope',
    report: 'the read the fault interactable thing is in the middle of the planet when I start the chapter',
    expected: TIDEGARDEN,
    coreInteractDistance: CORE_INTERACT_DISTANCE,
    voxelScale: VOXEL_SCALE
  },
  scenarios: {}
};
const OUT = path.join(OUT_DIR, `ch10-core-burial-${PHASE}.json`);
const flush = () => fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');

for (const beat of ['ch10-cold', 'ch10-ask', 'ch10-transit', 'ch9-hearth']) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.goto(`${BASE}/?story=${beat}&profile=LOW`, { waitUntil: 'load', timeout: 90000 });
  await new Promise(r => setTimeout(r, 11000));
  await page.evaluate(RESOLVE);
  await page.addScriptTag({ content: `window.TIDEGARDEN_SEED = ${TIDEGARDEN.seed};` });
  let state;
  try { state = await page.evaluate(MEASURE); }
  catch (e) { state = { measureError: String(e).slice(0, 400) }; }
  await page.close();

  const buried = state.verticalOffset != null && state.verticalOffset < -2;
  report.scenarios[beat] = {
    url: `?story=${beat}&profile=LOW`,
    pageErrors: errs,
    ...state,
    assertions: {
      coreReachableEuclid: state.euclidToPlayer != null
        && state.euclidToPlayer <= 60,
      coreNotBuried: !buried,
      coreOnSurface: state.terrain?.coreCellsBelowSurface != null
        ? Math.abs(state.terrain.coreCellsBelowSurface) <= 1
        : null,
      gaitDisagreesWithEuclid: state.legacyGaitDistance != null
        && state.euclidToPlayer != null
        && (state.euclidToPlayer - state.legacyGaitDistance) > 5,
      markerAgreesWithCore: state.markerTarget && state.core
        ? state.markerTarget.position.every(
            (v, i) => Math.abs(v - state.core.position[i]) < 0.01)
        : null
    }
  };
  flush();
  const a = report.scenarios[beat].assertions;
  console.log(
    `[${beat}] core=${JSON.stringify(state.core?.position ?? null)}`
    + ` player=${JSON.stringify(state.playerWorld ?? null)}`
    + ` vert=${state.verticalOffset} euclid=${state.euclidToPlayer}`
    + ` gait=${state.legacyGaitDistance}`
    + ` surfaceY=${state.terrain?.surfaceWorldY ?? '?'}`
    + ` belowSurfaceCells=${state.terrain?.coreCellsBelowSurface ?? '?'}`
    + ` buried=${buried} gaitHid=${a.gaitDisagreesWithEuclid}`
  );
}

await browser.close();
console.log('wrote', OUT);
