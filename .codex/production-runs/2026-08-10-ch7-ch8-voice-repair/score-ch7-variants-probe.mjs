// Score Director audition probe (READ-ONLY, sa-10): combined music-bus renders
// of all eight shipped ch7 reconstruction score variants through the SHIPPED
// offline render mirror (src/audio/soak/offlineRender.ts) served by the
// canonical preview at http://localhost:5176. No repo file is mutated; outputs
// land in this run folder's evidence/ dir.
//
//   node score-ch7-variants-probe.mjs
//
// Method: for each variant, setStoryScoreMoodOverride('ch7-reconstruct',
// getChapter7ReconstructionScoreMood(variant)) — the exact authority surface
// the shipped emergentScoreDirector uses — then renderStoryBeatOffline with
// the 'surface' legacy scene driven alongside (combined bus; streamed stems
// silent offline so live loudness >= measured). No intensityAt script: each
// variant rests at its own baseline exactly as the gameplay-derived ch7
// design intends (signed score intensity is excluded for ch7 by name).
// 24 s each, era 1 (emergent/alive, what the player hears in ch7).
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const { chromium } = createRequire('/home/thomasphillip/Projects/vox/main/')('playwright-core');

const PREVIEW = 'http://localhost:5176';
const runDir = path.dirname(new URL(import.meta.url).pathname);
const evidenceDir = path.join(runDir, 'evidence');
fs.mkdirSync(evidenceDir, { recursive: true });

const pwDir = path.join(os.homedir(), '.cache/ms-playwright');
const chromeDir = fs
  .readdirSync(pwDir)
  .filter((d) => /^chromium-\d+$/.test(d))
  .sort()
  .pop();
const executablePath = path.join(pwDir, chromeDir, 'chrome-linux/chrome');

const VARIANTS = [
  'diagnosis', 'bench', 'frame', 'hull', 'lift', 'hover', 'route', 'calibration'
];
const SECONDS = 24;
const ERA = 1;
const LEGACY_SCENE = 'surface';

const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--autoplay-policy=no-user-gesture-required', '--mute-audio']
});
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
  await page.goto(`${PREVIEW}/score-soak.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.__scoreSoak), null, { timeout: 30000 });

  const results = [];
  for (const variant of VARIANTS) {
    const meta = await page.evaluate(
      async ({ variant, seconds, era, legacyScene }) => {
        const render = await import('/src/audio/soak/offlineRender.ts');
        const analysis = await import('/src/audio/soak/audioAnalysis.ts');
        const ss = await import('/src/story/storyScore.ts');
        ss.setStoryScoreMoodOverride(
          'ch7-reconstruct',
          ss.getChapter7ReconstructionScoreMood(variant)
        );
        try {
          const result = await render.renderStoryBeatOffline({
            beat: 'ch7-reconstruct',
            seconds,
            era,
            legacyScene
          });
          const channels = [];
          for (let ch = 0; ch < result.buffer.numberOfChannels; ch++) {
            channels.push(result.buffer.getChannelData(ch));
          }
          const wav = analysis.encodeWavPcm16(channels, result.buffer.sampleRate);
          window.__probeWav = new Uint8Array(wav);
          return {
            analysis: { ...result.analysis },
            overallRmsDb: 20 * Math.log10(result.analysis.rms),
            wavBytes: window.__probeWav.length
          };
        } finally {
          ss.clearStoryScoreMoodOverride('ch7-reconstruct');
        }
      },
      { variant, seconds: SECONDS, era: ERA, legacyScene: LEGACY_SCENE }
    );

    const parts = [];
    let offset = 0;
    for (;;) {
      const chunk = await page.evaluate((off) => {
        const bytes = window.__probeWav;
        if (!bytes || off >= bytes.length) return null;
        const slice = bytes.subarray(off, Math.min(off + (1 << 20), bytes.length));
        let bin = '';
        for (let i = 0; i < slice.length; i++) bin += String.fromCharCode(slice[i]);
        return btoa(bin);
      }, offset);
      if (chunk == null) break;
      const buf = Buffer.from(chunk, 'base64');
      parts.push(buf);
      offset += buf.length;
    }
    const wavBuf = Buffer.concat(parts);
    const wavFile = path.join(evidenceDir, `score-ch7-variant_${variant}.wav`);
    fs.writeFileSync(wavFile, wavBuf);
    const sha256 = crypto.createHash('sha256').update(wavBuf).digest('hex');
    results.push({
      variant,
      seconds: SECONDS,
      era: ERA,
      legacyScene: LEGACY_SCENE,
      overallRmsDb: Number(meta.overallRmsDb.toFixed(2)),
      analysis: meta.analysis,
      wavFile: path.basename(wavFile),
      wavSha256: sha256
    });
    console.log(
      `[done] ${variant}: RMS ${meta.overallRmsDb.toFixed(2)} dBFS, peak ${meta.analysis.peak.toFixed(3)}, ` +
        `clip ${meta.analysis.clipCount}, nan ${meta.analysis.nanCount} -> ${path.basename(wavFile)} sha256=${sha256.slice(0, 16)}…`
    );
  }

  const summary = {
    probe: 'score-ch7-variants-probe',
    generatedAt: new Date().toISOString(),
    preview: PREVIEW,
    auditRef: 'score-audit.md sa-10',
    note:
      'Owner-audition combined-bus renders of the eight shipped ch7 reconstruction variants (setStoryScoreMoodOverride + renderStoryBeatOffline, surface legacy scene, era 1, each variant resting at its own gameplay-derived baseline; no synthetic intensity ramp — signed score intensity is excluded for ch7 by name). M6 taste material: route vs its neighbours; M7: calibration semitone field.',
    cases: results
  };
  const summaryFile = path.join(evidenceDir, 'score-ch7-variants-analysis.json');
  fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
  console.log(`\n[summary] ${summaryFile}`);
} finally {
  await browser.close();
}
