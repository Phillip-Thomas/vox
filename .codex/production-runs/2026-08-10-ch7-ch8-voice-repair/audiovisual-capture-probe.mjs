// Continuous audiovisual capture — final-phase gate item `media.audio-stream`.
//
// The run's continuous video (evidence/verification/video/ch8-launch-window.webm)
// was recorded by Playwright's page video recorder, which captures no audio at
// all, so the manifest's continuousVideo entry has probe.audio === null and the
// gate's continuous-video requirement { video, audio, duration } cannot be met.
//
// This probe records BOTH tracks simultaneously from inside the page:
//   video  <canvas>.captureStream() — the same frames the player sees
//   audio  a parallel MediaStreamAudioDestinationNode fed from the LIVE graph's
//          music bus and sfx join node (audioCore.getMusicBus() /
//          getGameAudioSfxJoinNode()), tapped alongside the existing direct
//          route rather than replacing it
// Nothing is re-rendered offline and nothing is muxed after the fact: the two
// tracks are captured together, in one MediaRecorder, off the running game.
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
const { chromium } = await import(
  '/home/thomasphillip/Projects/vox/main/node_modules/playwright-core/index.mjs'
);

const RUN_DIR = path.dirname(new URL(import.meta.url).pathname);
const arg = (f, d) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : d; };
const OUT_DIR = path.join(RUN_DIR, 'evidence', arg('--out', 'verification-final'), 'video');
const BASE = process.env.VOX_BASE ?? 'http://localhost:5176';
fs.mkdirSync(OUT_DIR, { recursive: true });
const pwDir = path.join(os.homedir(), '.cache/ms-playwright');
const chromeDir = fs.readdirSync(pwDir).filter(d => /^chromium-\d+$/.test(d)).sort().pop();

const browser = await chromium.launch({
  executablePath: path.join(pwDir, chromeDir, 'chrome-linux/chrome'),
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--window-size=1280,720',
    '--autoplay-policy=no-user-gesture-required']
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
page.on('console', m => { if (/voxcap/i.test(m.text())) console.log('[page]', m.text()); });

const url = `${BASE}/?story=ch8-launch&movie=1&profile=LOW`;
await page.goto(url, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(6000);
await page.mouse.click(640, 360).catch(() => {});
await page.waitForTimeout(2000);

const started = await page.evaluate(async () => {
  const core = await import('/src/audio/audioCore.ts');
  core.unlockAudio();
  const context = core.getAudioContext();
  if (!context) return { ok: false, reason: 'no AudioContext' };
  if (context.state !== 'running') { try { await context.resume(); } catch (e) { /* reported below */ } }
  const canvas = document.querySelector('canvas');
  if (!canvas) return { ok: false, reason: 'no canvas' };
  const dest = context.createMediaStreamDestination();
  const taps = [];
  const bus = core.getMusicBus();
  if (bus) { bus.connect(dest); taps.push('musicBus'); }
  const sfx = core.getGameAudioSfxJoinNode();
  if (sfx) { sfx.connect(dest); taps.push('sfxJoinNode'); }
  if (taps.length === 0) return { ok: false, reason: 'no tappable audio nodes' };
  const video = canvas.captureStream(30);
  const stream = new MediaStream([...video.getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const mime = ['video/webm;codecs=vp8,opus', 'video/webm'].find(m => MediaRecorder.isTypeSupported(m));
  if (!mime) return { ok: false, reason: 'no supported webm mime' };
  const chunks = [];
  const rec = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 128000 });
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  window.__voxCapStop = () => new Promise((resolve) => {
    rec.onstop = async () => {
      const blob = new Blob(chunks, { type: mime });
      const buf = await blob.arrayBuffer();
      resolve(Array.from(new Uint8Array(buf)));
    };
    rec.stop();
  });
  rec.start(250);
  console.log('voxcap started', mime, taps.join('+'));
  return { ok: true, mime, taps, audioContextState: context.state,
    audioTracks: dest.stream.getAudioTracks().length, videoTracks: video.getVideoTracks().length };
});
console.log('recorder:', JSON.stringify(started));
if (!started.ok) { await browser.close(); process.exit(1); }

// Record the whole ch8-launch window through the advance, like the original.
const deadline = Date.now() + 60000;
while (Date.now() < deadline) {
  const b = await page.evaluate(() => window.__storyBeat ?? null).catch(() => null);
  if (b === 'ch8-crossing') break;
  await page.waitForTimeout(250);
}
await page.waitForTimeout(4000);
const bytes = await page.evaluate(() => window.__voxCapStop());
const file = path.join(OUT_DIR, 'ch8-launch-window-av.webm');
fs.writeFileSync(file, Buffer.from(bytes));
console.log('wrote', file, fs.statSync(file).size, 'bytes');
await browser.close();
