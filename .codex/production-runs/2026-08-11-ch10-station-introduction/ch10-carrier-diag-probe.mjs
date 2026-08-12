// Diagnostic: why does the 6s station-resolved control render identically with
// and without the carrier? Renders long enough for the progression to turn
// (STEPS_PER_CHORD = 2 bars = 7.06s at 68 bpm) and compares sample-exactly.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const { chromium } = createRequire('/home/thomasphillip/Projects/vox/main/')('playwright-core');
const PREVIEW = process.env.VOX_BASE ?? 'http://localhost:5176';
const pwDir = path.join(os.homedir(), '.cache/ms-playwright');
const chromeDir = fs.readdirSync(pwDir).filter(d => /^chromium-\d+$/.test(d)).sort().pop();

const browser = await chromium.launch({
  executablePath: path.join(pwDir, chromeDir, 'chrome-linux/chrome'),
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle',
    '--autoplay-policy=no-user-gesture-required', '--mute-audio']
});
const page = await browser.newPage();
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(`${PREVIEW}/score-soak.html`, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => Boolean(window.__scoreSoak), null, { timeout: 30000 });

const out = await page.evaluate(async () => {
  const rendererSource = await (await fetch('/src/audio/soak/offlineRender.ts')).text();
  const specifier = rendererSource.match(/from\s*["']([^"']*storyScore\.ts[^"']*)["']/)?.[1];
  const score = await import(/* @vite-ignore */ specifier);
  const eng = await import('/src/audio/scoreEngine.ts');
  const r = await import('/src/audio/soak/offlineRender.ts');

  const withM = score.getChapter10ScoreMood('station-resolved', true);
  const noM = score.getChapter10ScoreMood('station-resolved', false);

  const one = async (mood, seconds) => {
    score.setStoryScoreMoodOverride('ch10-transit', mood);
    const res = await r.renderStoryBeatOffline({
      beat: 'ch10-transit', seconds, era: 1, legacyScene: 'deepSpace',
      intensityAt: () => 0.44
    });
    const d = res.buffer.getChannelData(0);
    return { data: Array.from(d.slice(0, 0)), rms: res.analysis.rms, buf: res.buffer };
  };

  const cmp = async (seconds) => {
    const a = await one(withM, seconds);
    const b = await one(noM, seconds);
    const A = a.buf.getChannelData(0), B = b.buf.getChannelData(0);
    let maxDiff = 0, firstDiffSample = -1, diffCount = 0;
    for (let i = 0; i < Math.min(A.length, B.length); i++) {
      const d = Math.abs(A[i] - B[i]);
      if (d > 1e-9) { diffCount++; if (firstDiffSample < 0) firstDiffSample = i; }
      if (d > maxDiff) maxDiff = d;
    }
    const sr = a.buf.sampleRate;
    return {
      seconds, sampleRate: sr,
      withRmsDb: 20 * Math.log10(a.rms), noRmsDb: 20 * Math.log10(b.rms),
      identical: diffCount === 0, diffCount, maxDiff,
      firstDiffSec: firstDiffSample < 0 ? null : firstDiffSample / sr
    };
  };

  // Hand-filtered control: 29 removed from the PROGRESSION too. If this differs
  // audibly from the with-carrier render, the octave double really does sound
  // and the shipped carrierAlive=false path simply fails to remove it.
  const fullyFiltered = {
    ...noM,
    progression: (noM.progression ?? []).map(c => c.filter(d => d !== 29))
  };

  const cmpMoods = async (a, b, seconds) => {
    score.setStoryScoreMoodOverride('ch10-transit', a);
    const ra = await r.renderStoryBeatOffline({ beat: 'ch10-transit', seconds, era: 1, legacyScene: 'deepSpace', intensityAt: () => 0.44 });
    score.setStoryScoreMoodOverride('ch10-transit', b);
    const rb = await r.renderStoryBeatOffline({ beat: 'ch10-transit', seconds, era: 1, legacyScene: 'deepSpace', intensityAt: () => 0.44 });
    const A = ra.buffer.getChannelData(0), B = rb.buffer.getChannelData(0);
    let maxDiff = 0, first = -1;
    for (let i = 0; i < Math.min(A.length, B.length); i++) {
      const d = Math.abs(A[i] - B[i]);
      if (d > 1e-5 && first < 0) first = i;
      if (d > maxDiff) maxDiff = d;
    }
    return { seconds, aRmsDb: 20 * Math.log10(ra.analysis.rms), bRmsDb: 20 * Math.log10(rb.analysis.rms),
      maxDiff, firstAudibleDiffSec: first < 0 ? null : first / ra.buffer.sampleRate };
  };

  return {
    withChord: withM.chord, noChord: noM.chord,
    fullyFilteredProgression: fullyFiltered.progression,
    cmpWithVsFullyFiltered16: await cmpMoods(withM, fullyFiltered, 16),
    withProgression: withM.progression, noProgression: noM.progression,
    padVoiceStatesWith: eng.resolveScorePadVoiceStates(withM.chord),
    padVoiceStatesNo: eng.resolveScorePadVoiceStates(noM.chord),
    padVoiceStatesProgWith: (withM.progression ?? []).map(c => eng.resolveScorePadVoiceStates(c)),
    padVoiceStatesProgNo: (noM.progression ?? []).map(c => eng.resolveScorePadVoiceStates(c)),
    cmp6: await cmp(6),
    cmp16: await cmp(16)
  };
});
console.log(JSON.stringify(out, null, 2));
await browser.close();
