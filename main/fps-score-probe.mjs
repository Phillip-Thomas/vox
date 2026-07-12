// P4 FPS probe WITH THE GENERATIVE SCORE RUNNING (headless swiftshader).
// Boots ?story=<beat>&movie=1, settles, samples baseline fps, then unlocks
// audio (autoplay flag allows it without a gesture), hands the sandbox floor
// to the generative bed (setScoreBeat(null) -> bed leads), verifies the
// AudioContext is running and the harmony brain is publishing, and samples
// fps again. PASS = max post-score sample >= 60 (repo law).
//   node fps-score-probe.mjs [beat=ch4-vigil] [settleS=8] [samples=3]
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const beat = process.argv[2] ?? 'ch4-vigil';
const settleS = Number(process.argv[3] ?? 8);
const samples = Number(process.argv[4] ?? 3);
// This probe ALWAYS runs its own fresh dev server. It drives the app through
// dynamic module imports (unlock, setScoreBeat, chord reads), and a
// long-running dev server with HMR-invalidated modules serves the app graph
// under `?t=` URLs — a plain-URL dynamic import would then load a SECOND
// module instance and read the wrong singletons. A fresh server has no HMR
// history, so probe imports and app imports share one registry.
const PROBE_PORT = 5197;

const root = path.dirname(new URL(import.meta.url).pathname);

async function serverUp(port) {
  try {
    return (await fetch(`http://localhost:${port}/`)).ok;
  } catch {
    return false;
  }
}

let viteProc = null;
const port = PROBE_PORT;
if (!(await serverUp(port))) {
  console.log(`[probe] starting vite dev server on :${port}…`);
  viteProc = spawn(
    process.execPath,
    ['node_modules/vite/bin/vite.js', '--port', String(port), '--strictPort'],
    { cwd: root, stdio: 'ignore' }
  );
  for (let i = 0; i < 100 && !(await serverUp(port)); i++) {
    await new Promise((r) => setTimeout(r, 300));
  }
}

const pwDir = path.join(os.homedir(), '.cache/ms-playwright');
const chromeDir = fs
  .readdirSync(pwDir)
  .filter((d) => /^chromium-\d+$/.test(d))
  .sort()
  .pop();
const executablePath = path.join(pwDir, chromeDir, 'chrome-linux/chrome');

const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: [
    '--enable-unsafe-swiftshader',
    '--use-gl=angle',
    '--window-size=1280,720',
    '--autoplay-policy=no-user-gesture-required',
    '--mute-audio'
  ]
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
await page.goto(`http://localhost:${port}/?story=${beat}&movie=1`, { waitUntil: 'load' });

const t0 = Date.now();
let live = false;
while ((Date.now() - t0) / 1000 < 60) {
  const b = await page.evaluate(() => window.__storyBeat ?? null).catch(() => null);
  if (b === beat) {
    live = true;
    break;
  }
  await new Promise((r) => setTimeout(r, 300));
}
console.log(`beat ${beat} live=${live} at ${((Date.now() - t0) / 1000).toFixed(1)}s; settling ${settleS}s`);
await new Promise((r) => setTimeout(r, settleS * 1000));

const sample = () =>
  page.evaluate(
    () =>
      new Promise((resolve) => {
        let frames = 0;
        const begin = performance.now();
        const count = () => {
          frames++;
          if (performance.now() - begin < 2000) requestAnimationFrame(count);
          else resolve(Math.round(frames / ((performance.now() - begin) / 1000)));
        };
        requestAnimationFrame(count);
      })
  );

const baseline = [];
for (let i = 0; i < samples; i++) {
  baseline.push(await sample().catch(() => -1));
}
console.log(`baseline (no audio): [${baseline.join(', ')}] fps`);

// Unlock audio + hand the floor to the generative bed (no gesture needed
// under --autoplay-policy=no-user-gesture-required).
const unlockState = await page.evaluate(async () => {
  window.__scoreProbeMark = true; // reload detector
  const music = await import('/src/audio/musicEngine.ts');
  await music.unlockMusicAudio();
  const story = await import('/src/story/storyScore.ts');
  story.unlockStoryScore();
  story.setScoreBeat(null); // the generative bed takes the sandbox floor
  const core = await import('/src/audio/audioCore.ts');
  return core.peekAudioContext()?.state ?? 'none';
});
console.log(`context right after unlock: ${unlockState}`);
await new Promise((r) => setTimeout(r, 6000)); // bed builds + first bars play

const audio = await page.evaluate(async () => {
  const core = await import('/src/audio/audioCore.ts');
  const prim = await import('/src/audio/musicPrimitives.ts');
  const chord = prim.getMusicChord();
  return {
    reloaded: !window.__scoreProbeMark,
    contextState: core.peekAudioContext()?.state ?? 'none',
    chordRoot: chord.root,
    chordTones: [...chord.chord]
  };
});
if (audio.reloaded) console.log('WARNING: page reloaded after unlock');
console.log(
  `audio: context=${audio.contextState}, published chord root=${audio.chordRoot} tones=[${audio.chordTones.join(', ')}]`
);
const audioRunning = audio.contextState === 'running';
if (!audioRunning) console.log('WARNING: AudioContext is not running — score not audible');

const withScore = [];
for (let i = 0; i < samples; i++) {
  withScore.push(await sample().catch(() => -1));
  await new Promise((r) => setTimeout(r, 500));
}
const chordLater = await page.evaluate(async () => {
  const prim = await import('/src/audio/musicPrimitives.ts');
  return prim.getMusicChord().root;
});
console.log(`with score: [${withScore.join(', ')}] fps (chord root now ${chordLater})`);

const max = Math.max(...withScore);
const ok = max >= 60 && audioRunning;
console.log(
  `RESULT ${beat}: baseline max=${Math.max(...baseline)} withScore max=${max} audio=${audio.contextState} -> ${ok ? 'PASS(>=60 with score)' : 'FAIL'}`
);
await browser.close();
if (viteProc) viteProc.kill();
process.exit(ok ? 0 : 1);
