// Score Director ruling probe (READ-ONLY): combined music-bus renders of the
// ch8-launch atmosphere-exit hold window vs its neighbours, through the SHIPPED
// offline render mirror (src/audio/soak/offlineRender.ts) served by the
// canonical preview at http://localhost:5176. No repo file is mutated; outputs
// land in this run folder's evidence/ dir.
//
//   node score-ch8-window-probe.mjs
//
// Cases (all 20 s, era 1, legacy 'deepSpace' scene driven alongside the score
// so the render is the COMBINED music bus, not score-only; offline the
// streamed deepSpace/shimmer stems are silent, so live loudness >= measured):
//   A ch8-hold-contact-logged  : ch8-launch mood @ intensity 0.5000
//                                (the generic-ramp value the atmosphere-exit
//                                anchor applies once the R2 hold lets it land;
//                                this is the state at CONTACT LOGGED +10.0 s)
//   B ch8-liftoff-state        : ch8-launch mood @ intensity 0.4375
//                                (the measured shipped value at the liftoff
//                                anchor — what the baseline traces recorded)
//   C ch8-crossing-seam        : ch8-crossing mood @ intensity 0.35
//                                (the post-advance seam value, reached only
//                                at hold end, +17.0 s — AFTER the stack)
//   D near-silence-ref-defy    : ch4-defy mood @ intensity 0.10
//                                (the score's canonical composed near-silence,
//                                the refusal — the yardstick for "emptiest air")
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const { chromium } = createRequire('/home/thomasphillip/Projects/vox/main/')('playwright-core');

const PREVIEW = 'http://localhost:5176';
const runDir = path.dirname(new URL(import.meta.url).pathname);
const evidenceDir = path.join(runDir, 'evidence', 'verification');
fs.mkdirSync(evidenceDir, { recursive: true });

const pwDir = path.join(os.homedir(), '.cache/ms-playwright');
const chromeDir = fs
  .readdirSync(pwDir)
  .filter((d) => /^chromium-\d+$/.test(d))
  .sort()
  .pop();
const executablePath = path.join(pwDir, chromeDir, 'chrome-linux/chrome');

const CASES = [
  { name: 'ch8-hold-contact-logged', beat: 'ch8-launch', intensity: 0.5, legacyScene: 'deepSpace' },
  { name: 'ch8-liftoff-state', beat: 'ch8-launch', intensity: 0.4375, legacyScene: 'deepSpace' },
  { name: 'ch8-crossing-seam', beat: 'ch8-crossing', intensity: 0.35, legacyScene: 'deepSpace' },
  { name: 'near-silence-ref-defy', beat: 'ch4-defy', intensity: 0.1, legacyScene: 'deepSpace' }
];
const SECONDS = 20;
const ERA = 1;

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
  for (const c of CASES) {
    const meta = await page.evaluate(
      async ({ beat, intensity, legacyScene, seconds, era }) => {
        const render = await import('/src/audio/soak/offlineRender.ts');
        const analysis = await import('/src/audio/soak/audioAnalysis.ts');
        const result = await render.renderStoryBeatOffline({
          beat,
          seconds,
          era,
          legacyScene,
          intensityAt: () => intensity
        });
        const channels = [];
        for (let ch = 0; ch < result.buffer.numberOfChannels; ch++) {
          channels.push(result.buffer.getChannelData(ch));
        }
        // Windowed RMS (1 s windows) across all channels, in dBFS.
        const sr = result.buffer.sampleRate;
        const windows = [];
        for (let w = 0; w < seconds; w++) {
          let sum = 0;
          let n = 0;
          for (const data of channels) {
            const start = w * sr;
            const end = Math.min(data.length, start + sr);
            for (let i = start; i < end; i++) {
              sum += data[i] * data[i];
              n++;
            }
          }
          const rms = Math.sqrt(sum / Math.max(1, n));
          windows.push(rms > 0 ? 20 * Math.log10(rms) : -Infinity);
        }
        const wav = analysis.encodeWavPcm16(channels, sr);
        const bytes = new Uint8Array(wav);
        window.__probeWav = bytes;
        return {
          analysis: { ...result.analysis },
          windowedRmsDb: windows,
          overallRmsDb: 20 * Math.log10(result.analysis.rms),
          wavBytes: bytes.length
        };
      },
      { beat: c.beat, intensity: c.intensity, legacyScene: c.legacyScene, seconds: SECONDS, era: ERA }
    );

    // Pull the WAV in 1 MiB base64 chunks.
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
    const wavFile = path.join(evidenceDir, `score-ch8-window-verify_${c.name}.wav`);
    fs.writeFileSync(wavFile, wavBuf);
    const sha256 = crypto.createHash('sha256').update(wavBuf).digest('hex');
    results.push({
      ...c,
      seconds: SECONDS,
      era: ERA,
      overallRmsDb: meta.overallRmsDb,
      windowedRmsDb: meta.windowedRmsDb,
      analysis: meta.analysis,
      wavFile: path.basename(wavFile),
      wavSha256: sha256
    });
    console.log(
      `[done] ${c.name}: beat=${c.beat} intensity=${c.intensity} ` +
        `overall RMS ${meta.overallRmsDb.toFixed(2)} dBFS, peak ${meta.analysis.peak.toFixed(3)} ` +
        `-> ${path.basename(wavFile)} sha256=${sha256.slice(0, 16)}…`
    );
  }

  const relative = results.map((r) => ({
    name: r.name,
    beat: r.beat,
    intensity: r.intensity,
    overallRmsDb: Number(r.overallRmsDb.toFixed(2)),
    dbAboveDefyRef: Number((r.overallRmsDb - results[3].overallRmsDb).toFixed(2))
  }));
  const summary = {
    probe: 'score-ch8-window-verify-probe',
    generatedAt: new Date().toISOString(),
    preview: PREVIEW,
    sourceRevision: '03e975a666767dd3d75fc339a3b3d61dfa755c4c',
    note:
      'Combined music-bus offline renders (score + legacy deepSpace procedural voices; streamed stems silent offline, so live loudness >= measured). Intensity values are the deterministic generic-ramp outputs: 0.5 = atmosphere-exit anchor applied during the R2 hold; 0.4375 = measured shipped liftoff value; 0.35 = crossing seam.',
    cases: results,
    relative
  };
  const summaryFile = path.join(evidenceDir, 'score-ch8-window-verify-analysis.json');
  fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
  console.log(`\n[summary] ${summaryFile}`);
  for (const r of relative) {
    console.log(
      `  ${r.name.padEnd(24)} ${String(r.intensity).padEnd(7)} ${r.overallRmsDb} dBFS ` +
        `(${r.dbAboveDefyRef >= 0 ? '+' : ''}${r.dbAboveDefyRef} dB vs defy near-silence ref)`
    );
  }
} finally {
  await browser.close();
}
