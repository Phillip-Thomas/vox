// Tier shot-parity probe — defect CIN-13.
//
// The av readout in the earlier capture sidecars threw
// `TypeError: Cannot read properties of undefined (reading 'declaredCut')`
// on every ANCHORED frame, because the bridge read `shot.transition.declaredCut`
// while getSignedSceneAvDebugSnapshot() publishes `shot.transitionType` and
// `shot.declaredCut` FLAT on the shot object. Unanchored frames never threw
// because `shot` is null there and the ternary short-circuits — which is why
// every successful av read in those files has anchorId null and no anchored
// frame carried camera/FOV state.
//
// This probe uses the corrected field access and captures the two anchors the
// contract's tier-parity claim rests on, at LOW, POTATO and mobile.
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
const { chromium } = await import(
  '/home/thomasphillip/Projects/vox/main/node_modules/playwright-core/index.mjs'
);

const RUN_DIR = path.dirname(new URL(import.meta.url).pathname);
const arg = (f, d) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : d; };
const OUT_DIR = path.join(RUN_DIR, 'evidence', arg('--out', 'verification-final'), 'tier-parity');
const BASE = process.env.VOX_BASE ?? 'http://localhost:5176';
fs.mkdirSync(OUT_DIR, { recursive: true });
const pwDir = path.join(os.homedir(), '.cache/ms-playwright');
const chromeDir = fs.readdirSync(pwDir).filter(d => /^chromium-\d+$/.test(d)).sort().pop();

const INSTALL = `(() => {
  const w = window;
  if (w.__voxTP) return;
  w.__voxTP = { ready: false };
  const boot = async () => {
    const av = await import('/src/story/signedSceneAvRuntime.ts');
    const clock = await import('/src/story/storyClock.ts');
    const st = await import('/src/story/storyText.ts');
    w.__voxTPState = () => {
      const s = av.getSignedSceneAvDebugSnapshot();
      const t = st.getStoryText();
      return {
        storyClock: clock.storyNow(), beat: w.__storyBeat ?? null,
        anchorId: s.anchorId, anchorEvent: s.anchorEvent,
        activatedAnchorIds: [...s.activatedAnchorIds],
        // CORRECTED SHAPE: transitionType and declaredCut are flat on shot.
        shot: s.shot ? {
          id: s.shot.id,
          cameraAuthority: s.shot.cameraAuthority,
          transitionType: s.shot.transitionType,
          declaredCut: s.shot.declaredCut,
          startFovDeg: s.shot.lens.startFovDeg,
          endFovDeg: s.shot.lens.endFovDeg,
          appliedFovDeg: s.shot.lens.appliedFovDeg,
          lensDurationMs: s.shot.lens.durationMs,
          reducedMotion: s.shot.lens.reducedMotion,
          agency: { ...s.shot.agency }
        } : null,
        postFx: { activeEffectIds: [...s.postFx.activeEffectIds],
          supportMix: s.postFx.supportMix, lowTierFallbacks: [...s.postFx.lowTierFallbacks] },
        score: { cueRefs: [...(s.score.cueRefs || [])], intensity: s.score.intensity },
        caption: t.caption ? t.caption.text : null,
        viewport: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio }
      };
    };
    w.__voxTP.ready = true;
  };
  let n = 0; const go = () => { n++; boot().catch(() => { if (n < 80) setTimeout(go, 100); }); }; go();
})();`;

const browser = await chromium.launch({
  executablePath: path.join(pwDir, chromeDir, 'chrome-linux/chrome'), headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--window-size=1280,720']
});

const TIERS = [
  { id: 'quality-low', profile: 'LOW', ctx: {} },
  { id: 'quality-potato', profile: 'POTATO', ctx: {} },
  { id: 'variant-mobile', profile: 'LOW', ctx: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } }
];
// The two anchors the tier-parity claim rests on.
const TARGETS = [
  { id: 'ch7 calibration reveal', beat: 'ch7-reconstruct', url: '?story=ch7-reconstruct&movie=1',
    anchorId: 'anc.reconstruct.calibration', stopBeat: 'ch7-board', capMs: 220000 },
  { id: 'ch8 window atmosphere-exit', beat: 'ch8-launch', url: '?story=ch8-launch&movie=1',
    anchorId: 'anc.launch.atmosphere-exit', stopBeat: 'ch8-crossing', capMs: 180000 }
];

const out = { probe: 'tier-shot-parity-probe.mjs', defectRef: 'CIN-13', base: BASE,
  capturedAt: new Date().toISOString(),
  bugFixed: 'shot.transition.declaredCut -> shot.declaredCut / shot.transitionType (flat on the shot object)',
  results: [] };

for (const target of TARGETS) {
  for (const tier of TIERS) {
    const ctx = await browser.newContext({
      viewport: tier.ctx.viewport ?? { width: 1280, height: 720 },
      isMobile: tier.ctx.isMobile ?? false, hasTouch: tier.ctx.hasTouch ?? false
    });
    await ctx.addInitScript(INSTALL);
    const page = await ctx.newPage();
    const url = `${BASE}/${target.url}&profile=${tier.profile}`;
    await page.goto(url, { waitUntil: 'load', timeout: 120000 }).catch(() => {});
    const rdl = Date.now() + 45000;
    while (Date.now() < rdl) {
      const r = await page.evaluate(() => Boolean(window.__voxTP && window.__voxTP.ready)).catch(() => false);
      if (r) break;
      await new Promise(r2 => setTimeout(r2, 60));
    }
    const dir = path.join(OUT_DIR, `${target.anchorId}__${tier.id}`);
    fs.mkdirSync(dir, { recursive: true });
    const samples = [];
    let hit = null;
    const deadline = Date.now() + target.capMs;
    let errors = 0;
    while (Date.now() < deadline) {
      const s = await page.evaluate(() => {
        try { return window.__voxTPState(); } catch (e) { return { error: String(e).slice(0, 200) }; }
      }).catch(() => null);
      if (!s) break;
      if (s.error) { errors++; samples.push(s); }
      else if (s.anchorId === target.anchorId && !hit) {
        hit = s;
        const name = `anchor_${target.anchorId}_${tier.id}.png`;
        await page.screenshot({ path: path.join(dir, name) }).catch(() => {});
        hit.file = name;
        hit.stateReadOrder = 'state-before-shutter';
        break;
      }
      if (s.beat === target.stopBeat && !hit) break;
      await new Promise(r => setTimeout(r, 60));
    }
    out.results.push({ anchor: target.anchorId, anchorLabel: target.id, tier: tier.id,
      profile: tier.profile, url, avReadErrors: errors,
      observedAtAnchor: hit, frameDir: path.relative(RUN_DIR, dir) });
    console.log(`[${target.anchorId}/${tier.id}] hit=${Boolean(hit)} fov=${hit?.shot?.appliedFovDeg ?? null} authority=${hit?.shot?.cameraAuthority ?? null} avErrors=${errors}`);
    await ctx.close();
    fs.writeFileSync(path.join(OUT_DIR, 'tier-shot-parity.json'), `${JSON.stringify(out, null, 2)}\n`);
  }
}

// Parity comparison across tiers per anchor.
out.parity = TARGETS.map(t => {
  const rows = out.results.filter(r => r.anchor === t.anchorId && r.observedAtAnchor);
  const key = (r) => JSON.stringify({
    shotId: r.observedAtAnchor.shot?.id ?? null,
    cameraAuthority: r.observedAtAnchor.shot?.cameraAuthority ?? null,
    startFovDeg: r.observedAtAnchor.shot?.startFovDeg ?? null,
    endFovDeg: r.observedAtAnchor.shot?.endFovDeg ?? null,
    transitionType: r.observedAtAnchor.shot?.transitionType ?? null,
    declaredCut: r.observedAtAnchor.shot?.declaredCut ?? null
  });
  const keys = [...new Set(rows.map(key))];
  return { anchor: t.anchorId, tiersObserved: rows.map(r => r.tier),
    declaredShotIdentical: keys.length === 1, distinctShotDeclarations: keys.map(k => JSON.parse(k)),
    appliedFovDegByTier: Object.fromEntries(rows.map(r => [r.tier, r.observedAtAnchor.shot?.appliedFovDeg ?? null])),
    activeEffectIdsByTier: Object.fromEntries(rows.map(r => [r.tier, r.observedAtAnchor.postFx.activeEffectIds])),
    lowTierFallbacksByTier: Object.fromEntries(rows.map(r => [r.tier, r.observedAtAnchor.postFx.lowTierFallbacks])) };
});
fs.writeFileSync(path.join(OUT_DIR, 'tier-shot-parity.json'), `${JSON.stringify(out, null, 2)}\n`);
console.log('wrote', path.join(OUT_DIR, 'tier-shot-parity.json'));
await browser.close();
