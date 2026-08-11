// cap.seam-continuity strips — defect CIN-10.
//
// Three seams the contract requires and the run only partly delivered:
//   ch8      ch8-launch hold -> ch8-crossing entry, 500 ms across L4 +16.5 to
//            +18.5 s (the run held only +17.0 and +18.0, i.e. 1000 ms).
//   ch6      ch6-dive exit -> ch7-reconstruct entry, post-change strip.
//   landfall ch8-crossing -> ch8-landfall -> ch9 entry, post-change strip.
//
// Every frame's state is sampled BEFORE the shutter opens (CIN-05) and every
// record carries its own measured offset and shutter span.
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
const OUT_DIR = path.join(RUN_DIR, 'evidence', arg('--out', 'verification-final'), 'seams');
const BASE = process.env.VOX_BASE ?? 'http://localhost:5176';
fs.mkdirSync(OUT_DIR, { recursive: true });

const pwDir = path.join(os.homedir(), '.cache/ms-playwright');
const chromeDir = fs.readdirSync(pwDir).filter(d => /^chromium-\d+$/.test(d)).sort().pop();
const executablePath = path.join(pwDir, chromeDir, 'chrome-linux/chrome');

const L4 = 'i came down this line without being asked. i am going back up it on purpose.';

const INSTALL = `(() => {
  const w = window;
  if (w.__voxSeam) return;
  w.__voxSeam = { ready: false, marks: [] };
  const boot = async () => {
    const st = await import('/src/story/storyText.ts');
    const clock = await import('/src/story/storyClock.ts');
    const sf = await import('/src/state/spaceFlight.ts');
    const av = await import('/src/story/signedSceneAvRuntime.ts');
    w.__voxClock = clock.storyNow;
    let lastCap = '\\u0000';
    st.subscribeStoryText(() => {
      const s = st.getStoryText();
      const k = s.caption ? s.caption.text + '@' + s.caption.shownAt : 'null';
      if (k === lastCap) return;
      lastCap = k;
      w.__voxSeam.marks.push({ story: clock.storyNow(), text: s.caption ? s.caption.text : null });
    });
    w.__voxSeamState = () => {
      const s = st.getStoryText();
      const f = sf.getSpaceFlightSnapshot();
      const cap = document.querySelector('[data-story-caption]');
      const lives = Array.from(document.querySelectorAll('div[aria-live="polite"]'));
      const hud = document.querySelector('[data-story-guidance-hud]');
      const audit = lives.find(el => !el.hasAttribute('data-story-caption') && !el.hasAttribute('data-story-guidance-hud'));
      let a = null;
      try {
        const snap = av.getSignedSceneAvDebugSnapshot();
        a = { beat: snap.beat, anchorId: snap.anchorId,
          cameraAuthority: snap.shot ? snap.shot.cameraAuthority : null,
          appliedFovDeg: snap.shot ? snap.shot.lens.appliedFovDeg : null,
          transitionType: snap.shot ? snap.shot.transitionType : null,
          declaredCut: snap.shot ? snap.shot.declaredCut : null,
          activeEffectIds: snap.postFx ? [...snap.postFx.activeEffectIds] : [] };
      } catch (e) { a = { error: String(e).slice(0, 120) }; }
      return { storyClock: clock.storyNow(), beat: w.__storyBeat ?? null,
        phase: f.phase, controlMode: f.controlMode,
        storeCaption: s.caption ? s.caption.text : null,
        domCaption: cap ? cap.innerText.trim() : null,
        storeAudit: s.audit ? { header: s.audit.header ?? null, text: s.audit.text } : null,
        domAudit: audit ? audit.innerText.replace(/\\s*\\n\\s*/g, ' | ').trim() : null,
        hudDom: hud ? hud.innerText.replace(/\\s*\\n\\s*/g, ' | ').trim() : null,
        av: a, viewport: { w: window.innerWidth, h: window.innerHeight } };
    };
    w.__voxSeam.ready = true;
  };
  let n = 0;
  const go = () => { n++; boot().catch(() => { if (n < 80) setTimeout(go, 100); }); };
  go();
})();`;

const browser = await chromium.launch({
  executablePath, headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--window-size=1280,720']
});

async function open(url) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(INSTALL);
  const page = await ctx.newPage();
  page.__ctx = ctx;
  await page.goto(url, { waitUntil: 'load', timeout: 120000 }).catch(() => {});
  const dl = Date.now() + 40000;
  while (Date.now() < dl) {
    const r = await page.evaluate(() => Boolean(window.__voxSeam && window.__voxSeam.ready)).catch(() => false);
    if (r) break;
    await new Promise(r2 => setTimeout(r2, 60));
  }
  return page;
}

const nowClock = (p) => p.evaluate(() => (window.__voxClock ? window.__voxClock() : performance.now()));
const state = (p) => p.evaluate(() => (window.__voxSeamState ? window.__voxSeamState() : null));

/** Shoots a 500 ms strip across [fromMs, toMs] on the game's own clock. */
async function strip(page, dir, originClock, fromS, toS, stepS, tag) {
  fs.mkdirSync(dir, { recursive: true });
  const frames = [];
  for (let off = fromS; off <= toS + 1e-9; off += stepS) {
    const target = originClock + off * 1000;
    const dl = Date.now() + 60000;
    while (Date.now() < dl) {
      const t = await nowClock(page);
      if (t >= target - 8) break;
      await new Promise(r => setTimeout(r, Math.min(50, Math.max(4, (target - t) / 2))));
    }
    const s = await state(page);
    if (!s) break;
    const rel = ((s.storyClock - originClock) / 1000).toFixed(2).replace('.', 'p').replace('-', 'm');
    const name = `${tag}_t${rel}s_${s.beat ?? 'null'}.png`;
    const t0 = Date.now();
    await page.screenshot({ path: path.join(dir, name) }).catch(() => {});
    const after = await nowClock(page).catch(() => s.storyClock);
    frames.push({ file: name, targetOffsetSeconds: Number(off.toFixed(3)),
      measuredOffsetSeconds: Number(((s.storyClock - originClock) / 1000).toFixed(3)),
      shutterSpanMs: Number((after - s.storyClock).toFixed(1)),
      hostShutterMs: Date.now() - t0,
      stateReadOrder: 'state-before-shutter',
      beat: s.beat, phase: s.phase, controlMode: s.controlMode,
      storeCaption: s.storeCaption, domCaption: s.domCaption,
      storeAudit: s.storeAudit, domAudit: s.domAudit, hudDom: s.hudDom, av: s.av });
  }
  return frames;
}

const mode = process.argv[2];
const out = { mode, base: BASE, capturedAt: new Date().toISOString(), contractVersion: 'draft-v5',
  contractSha256: '36a7cb4f2bf9cc8d24d2413579225dcb50a4436b37a20fb762d79fec6cb4ecdb',
  defectRef: 'CIN-10 (cap.seam-continuity partially delivered)', seams: [] };

if (mode === 'ch8' || mode === 'all') {
  // ch8 hold -> ch8-crossing, 500 ms across L4 +16.5 .. +18.5 s.
  const url = `${BASE}/?story=ch8-launch&movie=1&profile=LOW`;
  const page = await open(url);
  let origin = null;
  const dl = Date.now() + 150000;
  while (Date.now() < dl) {
    const marks = await page.evaluate(() => window.__voxSeam.marks).catch(() => []);
    const hit = marks.find(m => m.text === L4);
    if (hit) { origin = hit.story; break; }
    await new Promise(r => setTimeout(r, 50));
  }
  const dir = path.join(OUT_DIR, 'ch8-hold-to-crossing');
  const frames = origin === null ? [] : await strip(page, dir, origin, 16.5, 18.5, 0.5, 'seam');
  out.seams.push({ id: 'ch8 hold -> ch8-crossing entry', url,
    originEvent: 'L4 atmosphere-exit caption', originStoryClock: origin,
    contractWindow: '+16.5 to +18.5 s at 500 ms', frameDir: path.relative(RUN_DIR, dir), frames });
  console.log('[ch8 seam]', frames.length, 'frames', frames.map(f => f.beat).join(','));
  await page.__ctx.close();
  fs.writeFileSync(path.join(OUT_DIR, `seams-${mode}.json`), `${JSON.stringify(out, null, 2)}\n`);
}

if (mode === 'ch6' || mode === 'all') {
  // ch6-dive exit -> ch7-reconstruct entry.
  const url = `${BASE}/?story=ch6-dive&movie=1&profile=LOW`;
  const page = await open(url);
  let origin = null;
  const dl = Date.now() + 260000;
  while (Date.now() < dl) {
    const b = await page.evaluate(() => window.__storyBeat ?? null).catch(() => null);
    if (b === 'ch7-reconstruct') { origin = await nowClock(page); break; }
    await new Promise(r => setTimeout(r, 40));
  }
  const dir = path.join(OUT_DIR, 'ch6-dive-to-ch7');
  // The transition is already observed when the strip starts, so the window
  // runs forward from the observation and its 0.0 frame is the entry itself.
  const frames = origin === null ? [] : await strip(page, dir, origin, 0.0, 3.0, 0.5, 'seam');
  out.seams.push({ id: 'ch6-dive exit -> ch7-reconstruct entry', url,
    originEvent: 'first host observation of beat ch7-reconstruct',
    originStoryClock: origin, contractWindow: 'entry +0.0 to +3.0 s at 500 ms',
    note: origin === null ? 'ch7-reconstruct never reached inside the 260 s cap' : null,
    frameDir: path.relative(RUN_DIR, dir), frames });
  console.log('[ch6 seam]', frames.length, 'frames', frames.map(f => f.beat).join(','));
  await page.__ctx.close();
  fs.writeFileSync(path.join(OUT_DIR, `seams-${mode}.json`), `${JSON.stringify(out, null, 2)}\n`);
}

if (mode === 'landfall' || mode === 'all') {
  // ch8-landfall -> ch9 entry, proving nothing changed there.
  const url = `${BASE}/?story=ch8-landfall&movie=1&profile=LOW`;
  const page = await open(url);
  const entryClock = await nowClock(page);
  const dir = path.join(OUT_DIR, 'ch8-landfall-to-ch9');
  const frames = await strip(page, dir, entryClock, 0.0, 20.0, 1.0, 'seam');
  let ch9 = null;
  const dl = Date.now() + 180000;
  while (Date.now() < dl) {
    const b = await page.evaluate(() => window.__storyBeat ?? null).catch(() => null);
    if (b && b.startsWith('ch9')) { ch9 = { beat: b, storyClock: await nowClock(page) }; break; }
    await new Promise(r => setTimeout(r, 200));
  }
  let ch9Frames = [];
  if (ch9) ch9Frames = await strip(page, dir, ch9.storyClock, 0.0, 2.0, 0.5, 'ch9entry');
  out.seams.push({ id: 'ch8-landfall -> ch9 entry', url, originStoryClock: entryClock,
    contractWindow: 'landfall entry +0.0 to +20.0 s at 1000 ms, then ch9 entry +0.0 to +2.0 s at 500 ms',
    ch9Observed: ch9,
    note: ch9 ? null : 'ch9 never reached inside the 180 s cap after the landfall strip (vd-02 records a ch8-landfall stall)',
    frameDir: path.relative(RUN_DIR, dir), frames, ch9Frames });
  console.log('[landfall seam]', frames.length + ch9Frames.length, 'frames ch9=', ch9 ? ch9.beat : null);
  await page.__ctx.close();
  fs.writeFileSync(path.join(OUT_DIR, `seams-${mode}.json`), `${JSON.stringify(out, null, 2)}\n`);
}

await browser.close();
console.log('wrote', path.join(OUT_DIR, `seams-${mode}.json`));
