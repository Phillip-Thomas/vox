// Stage 6 closeout: the per-anchor signed-AV state trace at all four registry
// variant profiles (desktop HIGH, desktop MEDIUM + reduced motion, desktop LOW,
// mobile POTATO). The predecessor sampled all four but only before any anchor
// was live, so camera authority / FOV / agency / post-effect / reset reason per
// anchor was uncaptured. Zero frames — state only.
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

const ANCHORS = ['anc.ch10.cold-noticed', 'anc.ch10.fault-read', 'anc.ch10.fabrication-refused',
  'anc.ch10.relay-ask', 'anc.ch10.relay-answer', 'anc.ch10.bearing-claimed',
  'anc.ch10.transit-ignite', 'anc.ch10.seam-of-light', 'anc.ch10.station-resolved',
  'anc.ch10.threshold-handback'];

const VARIANTS = [
  { id: 'desktop-high', profile: 'HIGH', viewport: { width: 1280, height: 720 }, reducedMotion: 'no-preference', settle: 40000, slow: true },
  { id: 'desktop-medium-reduced-motion', profile: 'MEDIUM', viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce', settle: 20000 },
  { id: 'desktop-low', profile: 'LOW', viewport: { width: 1280, height: 720 }, reducedMotion: 'no-preference', settle: 14000 },
  { id: 'mobile-potato', profile: 'POTATO', viewport: { width: 390, height: 844 }, isMobile: true, reducedMotion: 'no-preference', settle: 14000 }
];

const READ = async () => {
  const w = window;
  const hud = document.querySelector('[data-story-guidance-hud]');
  const caption = document.querySelector('[data-story-caption]');
  const out = {
    beat: w.__storyBeat ?? null,
    objectiveId: hud?.getAttribute('data-objective-id') ?? null,
    markerLabel: hud?.getAttribute('data-objective-marker-label') ?? null,
    health: hud?.getAttribute('data-objective-health') ?? null,
    requiresMarker: hud?.getAttribute('data-objective-requires-marker') ?? null,
    hudText: hud ? hud.innerText.replace(/\s*\n\s*/g, ' | ').trim() : null,
    caption: caption ? caption.innerText.trim() : null
  };
  try {
    const av = await import('/src/story/signedSceneAvRuntime.ts');
    const s = av.getSignedSceneAvDebugSnapshot();
    out.av = { active: s.active, beat: s.beat, anchorId: s.anchorId,
      authority: s.shot?.cameraAuthority ?? null,
      fov: s.shot?.lens?.appliedFovDeg ?? null,
      agency: s.shot?.agency ?? null,
      letterbox: s.shot?.letterbox ?? null,
      postFx: s.postFx?.activeEffectIds ?? [],
      score: s.score ?? null,
      history: s.activationHistoryAnchorIds ?? [],
      reset: s.lastResetReason ?? null };
  } catch (e) { out.avError = String(e).slice(0, 140); }
  try {
    const score = await import('/src/story/emergentScoreDirector.ts');
    out.score = score.getChapter10ScoreSnapshot();
  } catch { /* ignore */ }
  return out;
};

const COMMIT = fn => new Function('return (async () => { const d = await import("/src/story/emergentStoryDirector.ts"); return d.' + fn + '(); })()');

const browser = await chromium.launch({
  executablePath: path.join(pwDir, chromeDir, 'chrome-linux/chrome'),
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--window-size=1280,720']
});

const report = { capturedAt: new Date().toISOString(), base: BASE, anchors: ANCHORS, variants: {} };
const OUT = path.join(OUT_DIR, 'ch10-variant-anchor-trace.json');
const flush = () => fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');

for (const v of VARIANTS) {
  const rec = { id: v.id, profile: v.profile, viewport: `${v.viewport.width}x${v.viewport.height}`,
    reducedMotion: v.reducedMotion === 'reduce', isMobile: !!v.isMobile,
    byAnchor: {}, pageErrors: [], notes: [] };
  report.variants[v.id] = rec;

  const openPage = async (url) => {
    const page = await browser.newPage({ viewport: v.viewport, isMobile: !!v.isMobile,
      hasTouch: !!v.isMobile, reducedMotion: v.reducedMotion });
    page.on('pageerror', e => rec.pageErrors.push(String(e).slice(0, 180)));
    await page.goto(`${BASE}/${url}&profile=${v.profile}`, { waitUntil: 'load', timeout: 180000 });
    await new Promise(r => setTimeout(r, v.settle));
    return page;
  };
  // Sample whenever the live anchor is one we have not recorded yet.
  const sampleLoop = async (page, capSeconds, stopWhen) => {
    const t0 = Date.now();
    while ((Date.now() - t0) / 1000 < capSeconds) {
      const s = await page.evaluate(READ).catch(() => null);
      if (s) {
        const a = s.av?.anchorId;
        if (a && ANCHORS.includes(a) && !rec.byAnchor[a]) {
          rec.byAnchor[a] = { at: new Date().toISOString(), beat: s.beat,
            authority: s.av.authority, fov: s.av.fov, agency: s.av.agency,
            letterbox: s.av.letterbox, postFx: s.av.postFx, avScore: s.av.score,
            reset: s.av.reset, objectiveId: s.objectiveId, markerLabel: s.markerLabel,
            health: s.health, requiresMarker: s.requiresMarker, hudText: s.hudText,
            caption: s.caption, scoreSnapshot: s.score };
          flush();
        }
        if (stopWhen && stopWhen(s)) return s;
      }
      await new Promise(r => setTimeout(r, v.slow ? 900 : 400));
    }
    return null;
  };

  try {
    // --- ch10-cold: entry anchor, then the two committed verbs
    const cold = await openPage('?story=ch10-cold');
    await sampleLoop(cold, v.slow ? 120 : 45, s => s.av?.history?.includes('anc.ch10.cold-noticed'));
    await cold.evaluate(COMMIT('commitChapter10FaultRead')).catch(e => rec.notes.push('faultRead ' + String(e).slice(0, 90)));
    await sampleLoop(cold, v.slow ? 60 : 20, s => s.av?.history?.includes('anc.ch10.fault-read'));
    await cold.evaluate(COMMIT('commitChapter10FabricationAttempt')).catch(e => rec.notes.push('fab ' + String(e).slice(0, 90)));
    await sampleLoop(cold, v.slow ? 60 : 20, s => s.av?.history?.includes('anc.ch10.fabrication-refused'));
    await cold.close();

    // --- ch10-ask: the request, its answer, and the claim rite
    const ask = await openPage('?story=ch10-ask');
    await sampleLoop(ask, v.slow ? 40 : 12);
    await ask.evaluate(COMMIT('commitChapter10RelayRequest')).catch(e => rec.notes.push('relay ' + String(e).slice(0, 90)));
    await sampleLoop(ask, v.slow ? 90 : 30, s => s.av?.history?.includes('anc.ch10.relay-answer'));
    await ask.evaluate(COMMIT('commitChapter10BearingClaim')).catch(e => rec.notes.push('claim ' + String(e).slice(0, 90)));
    await sampleLoop(ask, v.slow ? 60 : 25, s => s.av?.history?.includes('anc.ch10.bearing-claimed'));
    await ask.close();

    // --- ch10-transit: flight facts only, so the movie lane must fly it
    const transit = await openPage('?story=ch10-transit&movie=1');
    await sampleLoop(transit, v.slow ? 900 : 420, s => s.av?.history?.includes('anc.ch10.threshold-handback'));
    await sampleLoop(transit, 20);
    await transit.close();
  } catch (e) {
    rec.notes.push('variant aborted: ' + String(e).slice(0, 200));
  }
  rec.anchorsCaptured = Object.keys(rec.byAnchor).length;
  rec.missingAnchors = ANCHORS.filter(a => !rec.byAnchor[a]);
  flush();
  console.log(`[${v.id}] anchors=${rec.anchorsCaptured}/10 missing=${rec.missingAnchors.join(',')} errs=${rec.pageErrors.length}`);
}

await browser.close();
flush();
console.log('wrote', OUT);
