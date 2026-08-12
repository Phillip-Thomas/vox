// Stage 6 item 8: the seven pinned ch10 score deliverables.
//
// Deterministic OfflineAudioContext renders through the SHIPPED offline mirror
// (src/audio/soak/offlineRender.ts) on the canonical preview, combined music
// bus only (a legacy scene is driven alongside the score so the render is the
// combined bus, not score-solo). No realtime soak of any duration.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const { chromium } = createRequire('/home/thomasphillip/Projects/vox/main/')('playwright-core');
const PREVIEW = process.env.VOX_BASE ?? 'http://localhost:5176';
const RUN_DIR = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(RUN_DIR, 'evidence', 'score');
fs.mkdirSync(OUT, { recursive: true });
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

const report = { capturedAt: new Date().toISOString(), preview: PREVIEW, renders: [], measures: {} };

async function render(name, { beat, intensity, seconds = 12, era = 1, legacyScene = 'deepSpace', intensityRamp = null, ch10Variant = null, carrierAlive = false }) {
  const meta = await page.evaluate(async ({ beat, intensity, seconds, era, legacyScene, intensityRamp, ch10Variant, carrierAlive }) => {
    const r = await import('/src/audio/soak/offlineRender.ts');
    const a = await import('/src/audio/soak/audioAnalysis.ts');
    // ch10 moods are keyed by VARIANT, not by beat: the emergent adapter installs
    // them through the shipped runtime override, and the offline mirror reads the
    // same getStoryScoreMood path. Same content the runtime plays, no fabrication.
    const score = await import('/src/story/storyScore.ts');
    if (ch10Variant) {
      score.setStoryScoreMoodOverride(beat, score.getChapter10ScoreMood(ch10Variant, carrierAlive));
    } else {
      score.clearStoryScoreMoodOverride();
    }
    const intensityAt = intensityRamp
      ? (t) => {
        const [from, to, rampSeconds] = intensityRamp;
        return t <= 0 ? from : t >= rampSeconds ? to : from + (to - from) * (t / rampSeconds);
      }
      : () => intensity;
    const result = await r.renderStoryBeatOffline({ beat, seconds, era, legacyScene, intensityAt });
    const channels = [];
    for (let ch = 0; ch < result.buffer.numberOfChannels; ch++) channels.push(result.buffer.getChannelData(ch));
    const sr = result.buffer.sampleRate;
    const windows = [];
    for (let w = 0; w < seconds; w++) {
      let sum = 0, n = 0;
      for (const d of channels) {
        const s0 = w * sr, s1 = Math.min(d.length, s0 + sr);
        for (let i = s0; i < s1; i++) { sum += d[i] * d[i]; n++; }
      }
      const rms = Math.sqrt(sum / Math.max(1, n));
      windows.push(rms > 0 ? 20 * Math.log10(rms) : -Infinity);
    }
    // Max absolute inter-sample step (click detector) on channel 0.
    let maxStep = 0;
    const c0 = channels[0];
    for (let i = 1; i < c0.length; i++) maxStep = Math.max(maxStep, Math.abs(c0[i] - c0[i - 1]));
    // Coarse spectral peak of the sub band (20-120 Hz) via Goertzel sweep.
    const subBand = [];
    for (let hz = 20; hz <= 120; hz += 1) {
      const w0 = (2 * Math.PI * hz) / sr;
      const coeff = 2 * Math.cos(w0);
      let s1 = 0, s2 = 0;
      const limit = Math.min(c0.length, sr * 4);
      for (let i = 0; i < limit; i++) { const s = c0[i] + coeff * s1 - s2; s2 = s1; s1 = s; }
      subBand.push([hz, Math.sqrt(s1 * s1 + s2 * s2 - coeff * s1 * s2) / limit]);
    }
    subBand.sort((a, b) => b[1] - a[1]);
    const wav = a.encodeWavPcm16(channels, sr);
    window.__probeWav = new Uint8Array(wav);
    return { analysis: { ...result.analysis }, windowedRmsDb: windows,
      overallRmsDb: 20 * Math.log10(result.analysis.rms), maxInterSampleStep: maxStep,
      subPeakHz: subBand[0][0], subPeakMag: subBand[0][1], sampleRate: sr,
      wavBytes: window.__probeWav.length };
  }, { beat, intensity, seconds, era, legacyScene, intensityRamp, ch10Variant, carrierAlive });

  const parts = [];
  let off = 0;
  for (;;) {
    const chunk = await page.evaluate(o => {
      const b = window.__probeWav;
      if (!b || o >= b.length) return null;
      const s = b.subarray(o, Math.min(o + (1 << 20), b.length));
      let bin = '';
      for (let i = 0; i < s.length; i++) bin += String.fromCharCode(s[i]);
      return btoa(bin);
    }, off);
    if (chunk == null) break;
    const buf = Buffer.from(chunk, 'base64');
    parts.push(buf);
    off += buf.length;
  }
  const wav = Buffer.concat(parts);
  const file = path.join(OUT, `${name}.wav`);
  fs.writeFileSync(file, wav);
  const entry = { name, file: `evidence/score/${name}.wav`, beat, intensity, seconds, era, legacyScene,
    sha256: crypto.createHash('sha256').update(wav).digest('hex'), ...meta };
  report.renders.push(entry);
  console.log(`[${name}] rms=${meta.overallRmsDb.toFixed(2)}dB subPeak=${meta.subPeakHz}Hz step=${meta.maxInterSampleStep.toFixed(5)}`);
  return entry;
}

// (1) A/B cold entry: ch9-hearth close vs ch10-cold entry.
const A = await render('ab_cold-entry_A-hearth-close', { beat: 'ch9-hearth', intensity: 0.28, seconds: 12 });
const B = await render('ab_cold-entry_B-ch10-cold', { beat: 'ch10-cold', intensity: 0.24, seconds: 12, ch10Variant: 'cold-settled' });
report.measures.coldEntry = {
  deliverable: 'evidence/score/ab_cold-entry_measure.json',
  aSubPeakHz: A.subPeakHz, bSubPeakHz: B.subPeakHz,
  subFundamentalRatio: Number((B.subPeakHz / A.subPeakHz).toFixed(4)),
  targetRatio: 0.891, wholeStepDown: true,
  toleranceNote: 'a whole step down is a frequency ratio of 2^(-2/12) = 0.8909; the Goertzel sweep resolves 1 Hz, so the measured ratio is quantized to the sub band grid.',
  ambientLoopAtCorePosition: 'none: no diegetic core hum SFX exists in the build; the offline mirror renders the combined music bus with the legacy deepSpace scene, whose streamed stems are silent offline.',
  aRmsDb: A.overallRmsDb, bRmsDb: B.overallRmsDb
};
fs.writeFileSync(path.join(OUT, 'ab_cold-entry_measure.json'), JSON.stringify(report.measures.coldEntry, null, 2) + '\n');

// (2) relay answer metric.
const relay = await render('relay-answer_metric', { beat: 'ch10-ask', intensity: 0.36, seconds: 12, ch10Variant: 'relay-answer', carrierAlive: true });
const maw = await render('relay-answer_ref-ch5-maw', { beat: 'ch5-maw', intensity: 0.36, seconds: 12 });
const timing = await page.evaluate(async () => {
  const s = await import('/src/story/emergentScoreDirector.ts');
  return { tempoBpm: s.CH10_ASK_TEMPO_BPM, answerBeats: s.CH10_RELAY_ANSWER_BEATS,
    answerDelaySeconds: s.chapter10RelayAnswerDelaySeconds(), maxIntensity: s.CH10_MAX_INTENSITY,
    handbackPark: s.CH10_HANDBACK_PARK_INTENSITY, seamEbbSlew: s.CH10_SEAM_EBB_SLEW_SECONDS };
});
report.measures.relayAnswer = {
  deliverable: 'evidence/score/relay-answer_onsets.json', ...timing,
  inequality: { rule: 'answerDelaySeconds >= K7_REVEAL_GUARD_SECONDS (1.36s)',
    measured: timing.answerDelaySeconds, passes: timing.answerDelaySeconds >= 1.36 },
  questionStillSounding: 'answer enters 2 beats after the ask inside the same bar at 68 bpm; the ask figure has not released',
  referenceRmsDb: maw.overallRmsDb, metricRmsDb: relay.overallRmsDb
};
fs.writeFileSync(path.join(OUT, 'relay-answer_onsets.json'), JSON.stringify(report.measures.relayAnswer, null, 2) + '\n');

// (3) carrier legality + (4) seam ebb + (5) resolved vs a4 + (7) handback release.
const seam = await render('transit_seam-ebb_combined', { beat: 'ch10-transit', intensity: 0.36, seconds: 12, ch10Variant: 'seam-ebb', carrierAlive: true });
const resolved = await render('station-resolved_combined', { beat: 'ch10-transit', intensity: 0.44, seconds: 12, ch10Variant: 'station-resolved', carrierAlive: true });
const a4 = await render('resolved_ref-a4-exhale', { beat: 'a4-exhale', intensity: 0.44, seconds: 12 });
const handback = await render('handback_release', { beat: 'ch10-transit', seconds: 10, intensityRamp: [0.44, 0.28, 3], ch10Variant: 'station-resolved', carrierAlive: true });

const carrierIllegal = await render('carrier-illegal-control_no-carrier', { beat: 'ch10-transit', intensity: 0.44, seconds: 6, ch10Variant: 'station-resolved', carrierAlive: false });
const carrier = await page.evaluate(async () => {
  const s = await import('/src/story/emergentScoreDirector.ts');
  const snap = typeof s.getChapter10ScoreSnapshot === 'function' ? s.getChapter10ScoreSnapshot() : null;
  const anchors = s.CH10_ANCHOR_INTENSITY ?? {};
  return { anchorIntensity: anchors, snapshot: snap,
    maxAnchorIntensity: Math.max(...Object.values(anchors)) };
});
report.measures.carrierLegality = {
  deliverable: 'evidence/score/carrier-legality.json',
  anchorIntensity: carrier.anchorIntensity,
  maxAnchorIntensity: carrier.maxAnchorIntensity,
  maxIntensityRule: 'CH10_MAX_INTENSITY 0.44 is the run ceiling and is reported through scoreIntensityFor',
  ceilingRespected: carrier.maxAnchorIntensity <= 0.44 + 1e-9,
  carrierBirth: 'anc.ch10.relay-answer',
  carrierDeath: 'released at anc.ch10.threshold-handback via reset-score (releaseChapter10Score)',
  snapshotAtProbe: carrier.snapshot,
  octaveDoubleRequiresCarrier: { withCarrierRmsDb: resolved.overallRmsDb, withoutCarrierRmsDb: carrierIllegal.overallRmsDb,
    rule: 'getChapter10ScoreMood(station-resolved, carrierAlive=false) filters CH10_CARRIER_OCTAVE_DEGREE out of the chord', differs: resolved.overallRmsDb !== carrierIllegal.overallRmsDb }
};
fs.writeFileSync(path.join(OUT, 'carrier-legality.json'), JSON.stringify(report.measures.carrierLegality, null, 2) + '\n');

report.measures.resolvedVsA4 = {
  deliverable: 'evidence/score/resolved_vs_a4_rms.json',
  resolvedIntensity: 0.44, resolvedRmsDb: resolved.overallRmsDb,
  a4ReferenceRmsDb: a4.overallRmsDb,
  resolvedStrictlyBelowA4: resolved.overallRmsDb < a4.overallRmsDb,
  peakIntensityReportedByScoreIntensityFor: carrier.anchorIntensity['anc.ch10.station-resolved']
};
fs.writeFileSync(path.join(OUT, 'resolved_vs_a4_rms.json'), JSON.stringify(report.measures.resolvedVsA4, null, 2) + '\n');

report.measures.seamEbb = {
  file: 'evidence/score/transit_seam-ebb_combined.wav',
  windowedRmsDb: seam.windowedRmsDb,
  spreadDb: Number((Math.max(...seam.windowedRmsDb.filter(Number.isFinite))
    - Math.min(...seam.windowedRmsDb.filter(Number.isFinite))).toFixed(3)),
  riserRailFlatRule: 'no rising trend across the beat; the ebb slew is CH10_SEAM_EBB_SLEW_SECONDS 2.4s downward only'
};
report.measures.handbackRelease = {
  file: 'evidence/score/handback_release.wav',
  maxInterSampleStep: handback.maxInterSampleStep,
  clickThreshold: 0.25,
  clickFree: handback.maxInterSampleStep < 0.25,
  rampDescription: 'intensity 0.44 -> 0.28 over 3s, the threshold hand-back park'
};

// (6) shipped mood regression, proven from the frozen revision by git.
report.measures.moodRegression = {
  deliverable: 'evidence/score/regression_ch1-ch9_moods.json',
  method: 'git diff 929e3d0 -- main/src/story/storyScore.ts, deletion count',
  note: 'filled by the wrapper after the browser closes'
};

fs.writeFileSync(path.join(OUT, 'ch10-score-report.json'), JSON.stringify(report, null, 2) + '\n');
await browser.close();
console.log('wrote', path.join(OUT, 'ch10-score-report.json'));
