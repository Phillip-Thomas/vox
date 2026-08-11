// Live audio-event census across the implemented ch8 exit-hold window.
// READ-ONLY. Records every story UX feedback cue (the only SFX-emitting story
// surface on this path) and the SFX rate-limiter's own per-event census
// (`window.__voxSfxDiag`) from before the window opens to after the advance, so
// the run can state whether the new text emissions add or remove audio events.
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
const { chromium } = await import(
  '/home/thomasphillip/Projects/vox/main/node_modules/playwright-core/index.mjs'
);

const RUN_DIR = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(RUN_DIR, 'evidence', 'verification', 'audio-window-census.json');
const BASE = process.env.VOX_BASE ?? 'http://localhost:5176';
const L4 = 'i came down this line without being asked. i am going back up it on purpose.';

const pwDir = path.join(os.homedir(), '.cache/ms-playwright');
const chromeDir = fs.readdirSync(pwDir).filter(d => /^chromium-\d+$/.test(d)).sort().pop();
const browser = await chromium.launch({
  executablePath: path.join(pwDir, chromeDir, 'chrome-linux/chrome'),
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--autoplay-policy=no-user-gesture-required', '--mute-audio', '--window-size=1280,720']
});

const out = { capturedAt: new Date().toISOString(), base: BASE, cases: [] };
for (const spec of [
  { id: 'ch8-launch-window', url: '?story=ch8-launch&movie=1&profile=LOW' },
  { id: 'ch7-exit-window', url: '?story=ch7-reconstruct&movie=1&profile=LOW', origin: 'UNSCHEDULED HULL · SITE 7C-θ · INTEREST RAISED', stopBeat: 'ch7-board' }
]) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(BASE + '/' + spec.url, { waitUntil: 'load', timeout: 90000 }).catch(() => {});
  await page.evaluate(async () => {
    const st = await import('/src/story/storyText.ts');
    const fb = await import('/src/story/ux/feedbackCues.ts');
    const clock = await import('/src/story/storyClock.ts');
    window.__clk = clock.storyNow;
    window.__cues = [];
    window.__emissions = [];
    fb.subscribeStoryUxFeedback(c => window.__cues.push({ t: clock.storyNow(), cue: JSON.parse(JSON.stringify(c)) }));
    let lastCap = '', lastAud = '';
    st.subscribeStoryText(() => {
      const s = st.getStoryText();
      const c = s.caption ? s.caption.text + '@' + s.caption.shownAt : 'null';
      if (c !== lastCap) { lastCap = c; window.__emissions.push({ t: clock.storyNow(), ch: 'caption', text: s.caption?.text ?? null }); }
      const a = s.audit ? s.audit.text + '@' + s.audit.shownAt : 'null';
      if (a !== lastAud) { lastAud = a; window.__emissions.push({ t: clock.storyNow(), ch: 'audit', text: s.audit?.text ?? null }); }
    });
  });
  const originText = spec.origin ?? L4;
  const deadline = Date.now() + 180000;
  let origin = null;
  const sfx = [];
  while (Date.now() < deadline) {
    const s = await page.evaluate((needle) => ({
      t: window.__clk(),
      beat: window.__storyBeat ?? null,
      diag: typeof window.__voxSfxDiag === 'function' ? window.__voxSfxDiag() : null,
      originAt: (window.__emissions.find(e => e.text === needle) || {}).t ?? null
    }), originText);
    sfx.push({ t: Number((s.t / 1000).toFixed(2)), beat: s.beat, diag: s.diag });
    if (origin === null && s.originAt !== null) origin = s.originAt;
    if (origin !== null && s.t - origin > 20000) break;
    await new Promise(r => setTimeout(r, 500));
  }
  const cues = await page.evaluate(() => window.__cues);
  const emissions = await page.evaluate(() => window.__emissions);
  const rel = (t) => (origin === null ? null : Number(((t - origin) / 1000).toFixed(3)));
  out.cases.push({
    id: spec.id,
    url: BASE + '/' + spec.url,
    windowOriginText: originText,
    windowOriginStoryMs: origin,
    feedbackCues: cues.map(c => ({ windowOffsetSeconds: rel(c.t), ...c.cue })),
    emissions: emissions.map(e => ({ windowOffsetSeconds: rel(e.t), ch: e.ch, text: e.text })),
    sfxRateCensus: sfx.map(s => ({ windowOffsetSeconds: origin === null ? null : Number((s.t - origin / 1000).toFixed(2)), tSeconds: s.t, beat: s.beat, diag: s.diag })),
    sfxCensusDistinct: [...new Set(sfx.map(s => s.diag).filter(Boolean))]
  });
  console.log(`[${spec.id}] cues=${cues.length} emissions=${emissions.length} distinctSfxCensus=${out.cases.at(-1).sfxCensusDistinct.length}`);
  await page.close();
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
await browser.close();
console.log('wrote', OUT);
