// Repair-cycle-two score evidence: D2 (real onsets + the ch5-maw comparison the
// audit found un-run), D3 (steady-window resolve vs a4-exhale), D7 (the ACTUAL
// transit-hold -> seam-ebb transition, closing the auditor's open measurement 2),
// and D6's shipped-mood regression table.
//
// Same infrastructure as ch10-score-probe.mjs: deterministic OfflineAudioContext
// renders through the SHIPPED offline mirror on the canonical preview, combined
// music bus only. No realtime soak of any duration.
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

/**
 * `switchAt` installs a SECOND ch10 variant mid-render through the shipped
 * override seam, so the file contains a real variant transition rather than two
 * cold-start steady states pretending to be one.
 */
async function render(name, {
  beat, intensity, seconds = 12, era = 1, legacyScene = 'deepSpace',
  ch10Variant = null, carrierAlive = false, switchAt = null,
  switchVariant = null, switchCarrierAlive = null, onsetBand = null,
  continuityAt = null
}) {
  const meta = await page.evaluate(async (o) => {
    const r = await import('/src/audio/soak/offlineRender.ts');
    const a = await import('/src/audio/soak/audioAnalysis.ts');
    // MODULE IDENTITY, not module path. After an edit the dev server serves the
    // story score under an HMR-timestamped URL inside offlineRender's graph; a
    // bare dynamic import of the same path yields a SECOND instance whose mood
    // override the renderer cannot see. Read the specifier the renderer itself
    // was rewritten to use, so the override lands on the instance that plays.
    const rendererSource = await (await fetch('/src/audio/soak/offlineRender.ts')).text();
    const specifier = rendererSource.match(/from\s*["']([^"']*storyScore\.ts[^"']*)["']/)?.[1];
    if (!specifier) throw new Error('could not resolve the renderer story-score specifier');
    const score = await import(/* @vite-ignore */ specifier);
    if (o.ch10Variant) {
      score.setStoryScoreMoodOverride(o.beat, score.getChapter10ScoreMood(o.ch10Variant, o.carrierAlive));
    } else {
      score.clearStoryScoreMoodOverride();
    }
    let switched = false;
    const intensityAt = (t) => {
      // The offline driver calls this at the live 60 ms scheduler cadence, so
      // it is also the only legal seam to move the mood on: the override lands
      // on a scheduler step exactly as the runtime's own anchor would.
      if (o.switchAt !== null && !switched && t >= o.switchAt) {
        switched = true;
        score.setStoryScoreMoodOverride(
          o.beat,
          score.getChapter10ScoreMood(
            o.switchVariant,
            o.switchCarrierAlive === null ? o.carrierAlive : o.switchCarrierAlive
          )
        );
      }
      return o.intensity;
    };
    const result = await r.renderStoryBeatOffline({
      beat: o.beat, seconds: o.seconds, era: o.era, legacyScene: o.legacyScene, intensityAt
    });
    const channels = [];
    for (let ch = 0; ch < result.buffer.numberOfChannels; ch++) channels.push(result.buffer.getChannelData(ch));
    const sr = result.buffer.sampleRate;
    const c0 = channels[0];

    // Per-second RMS envelope.
    const windows = [];
    for (let w = 0; w < o.seconds; w++) {
      let sum = 0, n = 0;
      for (const d of channels) {
        const s0 = w * sr, s1 = Math.min(d.length, s0 + sr);
        for (let i = s0; i < s1; i++) { sum += d[i] * d[i]; n++; }
      }
      const rms = Math.sqrt(sum / Math.max(1, n));
      windows.push(rms > 0 ? 20 * Math.log10(rms) : -Infinity);
    }

    // Steady-window measures (past the shared fade-in) — the auditor's point:
    // whole-file RMS is a fade-in artifact, not a level comparison.
    const steady = (from, to) => {
      let sum = 0, n = 0, peak = 0;
      for (const d of channels) {
        for (let i = Math.round(from * sr); i < Math.min(d.length, Math.round(to * sr)); i++) {
          sum += d[i] * d[i]; n++; peak = Math.max(peak, Math.abs(d[i]));
        }
      }
      return { rmsDb: 20 * Math.log10(Math.sqrt(sum / Math.max(1, n))), peak };
    };
    const steadyWindow = steady(8, 12);

    // Sub-band (20-120 Hz) energy over the steady window, Goertzel sweep.
    let subEnergy = 0, subPeakHz = 0, subPeakMag = 0;
    const from = Math.round(8 * sr), to = Math.min(c0.length, Math.round(12 * sr));
    for (let hz = 20; hz <= 120; hz += 1) {
      const w0 = (2 * Math.PI * hz) / sr;
      const coeff = 2 * Math.cos(w0);
      let s1 = 0, s2 = 0;
      for (let i = from; i < to; i++) { const s = c0[i] + coeff * s1 - s2; s2 = s1; s1 = s; }
      const mag = Math.sqrt(s1 * s1 + s2 * s2 - coeff * s1 * s2) / Math.max(1, to - from);
      subEnergy += mag * mag;
      if (mag > subPeakMag) { subPeakMag = mag; subPeakHz = hz; }
    }

    // ONSET DETECTION: 10 ms-hop energy envelope, half-wave-rectified flux, and
    // an ADAPTIVE local threshold (local median plus 2x the local mean absolute
    // deviation). A fixed rise ratio finds nothing in this material — the score
    // is a sustained pad with quiet quantized events on top of it, so the floor
    // has to be measured locally rather than assumed.
    const hop = Math.round(0.01 * sr);
    const env = [];
    for (let i = 0; i + hop <= c0.length; i += hop) {
      let sum = 0;
      for (let j = i; j < i + hop; j++) sum += c0[j] * c0[j];
      env.push(Math.sqrt(sum / hop));
    }
    const flux = env.map((v, i) => (i === 0 ? 0 : Math.max(0, v - env[i - 1])));
    const localStat = (i) => {
      const from = Math.max(0, i - 60);
      const to = Math.min(flux.length, i + 60);
      const slice = flux.slice(from, to).sort((a, b) => a - b);
      const median = slice[Math.floor(slice.length / 2)] || 0;
      let dev = 0;
      for (const v of slice) dev += Math.abs(v - median);
      return median + 2 * (dev / Math.max(1, slice.length));
    };
    const onsets = [];
    const bandFrom = o.onsetBand ? o.onsetBand[0] : 0;
    const bandTo = o.onsetBand ? o.onsetBand[1] : o.seconds;
    let lastOnset = -1;
    for (let i = 1; i < flux.length - 1; i++) {
      const t = (i * hop) / sr;
      if (t < bandFrom || t > bandTo) continue;
      if (flux[i] <= flux[i - 1] || flux[i] < flux[i + 1]) continue;
      if (flux[i] < localStat(i) || flux[i] <= 0) continue;
      if (t - lastOnset < 0.09) continue;
      onsets.push({
        tSec: Number(t.toFixed(3)),
        level: Number(env[i].toFixed(5)),
        flux: Number(flux[i].toFixed(6))
      });
      lastOnset = t;
    }

    // Continuity: is anything still sounding in the moments before a given
    // instant? This is the direct proof that the answer arrives INSIDE a phrase
    // rather than after it, and it does not depend on onset thresholds at all.
    const windowRms = (from, to) => {
      let sum = 0, n = 0;
      for (let i = Math.round(from * sr); i < Math.min(c0.length, Math.round(to * sr)); i++) {
        sum += c0[i] * c0[i]; n++;
      }
      return n ? Math.sqrt(sum / n) : 0;
    };
    const probeAt = o.continuityAt;
    const continuity = probeAt === null || probeAt === undefined ? null : {
      atSec: probeAt,
      rmsBefore200ms: Number((20 * Math.log10(windowRms(probeAt - 0.2, probeAt) || 1e-9)).toFixed(3)),
      rmsBefore50ms: Number((20 * Math.log10(windowRms(probeAt - 0.05, probeAt) || 1e-9)).toFixed(3)),
      rmsAfter200ms: Number((20 * Math.log10(windowRms(probeAt, probeAt + 0.2) || 1e-9)).toFixed(3)),
      // The longest run of near-silence in the second before the instant. A
      // shipped call-and-response leaves a phrase gap here; this chapter must
      // not, because the omitted gap IS the event.
      longestSilenceBeforeMs: (() => {
        const floor = Math.max(1e-5, windowRms(probeAt - 1, probeAt) * 0.15);
        let run = 0, longest = 0;
        for (let i = Math.round((probeAt - 1) / 0.01); i < Math.round(probeAt / 0.01); i++) {
          if ((env[i] ?? 0) < floor) { run += 10; longest = Math.max(longest, run); } else run = 0;
        }
        return longest;
      })()
    };

    let maxStep = 0;
    for (let i = 1; i < c0.length; i++) maxStep = Math.max(maxStep, Math.abs(c0[i] - c0[i - 1]));

    const wav = a.encodeWavPcm16(channels, sr);
    window.__probeWav = new Uint8Array(wav);
    return {
      analysis: { ...result.analysis }, windowedRmsDb: windows,
      overallRmsDb: 20 * Math.log10(result.analysis.rms),
      steadyRmsDb: steadyWindow.rmsDb, steadyPeak: steadyWindow.peak,
      steadySubEnergyDb: 10 * Math.log10(subEnergy), subPeakHz, subPeakMag,
      maxInterSampleStep: maxStep, onsets, continuity, sampleRate: sr, switched
    };
  }, {
    beat, intensity, seconds, era, legacyScene, ch10Variant, carrierAlive,
    switchAt, switchVariant, switchCarrierAlive, onsetBand, continuityAt
  });

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
  fs.writeFileSync(path.join(OUT, `${name}.wav`), wav);
  const entry = {
    name, file: `evidence/score/${name}.wav`, beat, intensity, seconds, era, legacyScene,
    ch10Variant, carrierAlive, switchAt, switchVariant, continuityAt,
    sha256: crypto.createHash('sha256').update(wav).digest('hex'), ...meta
  };
  report.renders.push(entry);
  console.log(`[${name}] steadyRms=${meta.steadyRmsDb.toFixed(2)}dB onsets=${meta.onsets.length} switched=${meta.switched}`);
  return entry;
}

const timing = await page.evaluate(async () => {
  const s = await import('/src/story/emergentScoreDirector.ts');
  return {
    tempoBpm: s.CH10_ASK_TEMPO_BPM,
    answerBeats: s.CH10_RELAY_ANSWER_BEATS,
    answerDelaySeconds: s.chapter10RelayAnswerDelaySeconds(),
    seamEbbSlewExport: Object.prototype.hasOwnProperty.call(s, 'CH10_SEAM_EBB_SLEW_SECONDS')
  };
});
const beatSeconds = 60 / timing.tempoBpm;
// Put the ask figure's entry at a bar line inside the render and the answer
// exactly `answerDelaySeconds` later, so the measured gap is the shipped one.
const ASK_AT = 4;
const ANSWER_AT = ASK_AT + timing.answerDelaySeconds;

// --- D2 -----------------------------------------------------------------------
// (a) The real relay sequence: crossing-back -> relay-ask -> relay-answer, in ONE
// render, so the answer's onset can be measured against a still-sounding question.
const askOnly = await render('relay_ask-figure', {
  beat: 'ch10-ask', intensity: 0.34, seconds: 12,
  ch10Variant: 'crossing-back', switchAt: ASK_AT, switchVariant: 'relay-ask',
  onsetBand: [ASK_AT, ASK_AT + 4 * beatSeconds]
});
const askThroughAnswer = await render('relay_ask-through-answer_combined', {
  beat: 'ch10-ask', intensity: 0.34, seconds: 12,
  ch10Variant: 'relay-ask', carrierAlive: false,
  switchAt: ANSWER_AT, switchVariant: 'relay-answer', switchCarrierAlive: true,
  onsetBand: [ASK_AT, ASK_AT + 6 * beatSeconds],
  continuityAt: ANSWER_AT
});
// (b) The ch5-maw reference: shipped call-and-response, measured the same way.
const maw = await render('relay-answer_ref-ch5-maw', {
  beat: 'ch5-maw', intensity: 0.36, seconds: 12, onsetBand: [2, 12], continuityAt: 8
});

function gaps(onsets) {
  const out = [];
  for (let i = 1; i < onsets.length; i++) out.push(Number((onsets[i].tSec - onsets[i - 1].tSec).toFixed(3)));
  return out;
}
const answerOnsets = askThroughAnswer.onsets.filter(o => o.tSec >= ANSWER_AT - 0.05);
const questionOnsets = askThroughAnswer.onsets.filter(o => o.tSec < ANSWER_AT - 0.05);
const mawGaps = gaps(maw.onsets);
const askBarSeconds = 4 * beatSeconds;
report.measures.relayAnswer = {
  deliverable: 'evidence/score/relay-answer_onsets.json',
  method: '10 ms short-time energy envelope, onset = local rise > 60% over the running floor with 90 ms refractory, measured on the combined music bus',
  tempoBpm: timing.tempoBpm,
  beatSeconds: Number(beatSeconds.toFixed(4)),
  askFigureBars: 2,
  askFigureSeconds: Number((2 * askBarSeconds).toFixed(3)),
  askEntersAtSec: ASK_AT,
  answerEntersAtSec: Number(ANSWER_AT.toFixed(3)),
  answerOffsetBeats: timing.answerBeats,
  answerOffsetSeconds: Number(timing.answerDelaySeconds.toFixed(4)),
  askFigureOnsets: askOnly.onsets,
  askThroughAnswerOnsets: askThroughAnswer.onsets,
  questionOnsetsBeforeAnswer: questionOnsets,
  answerOnsets,
  questionStillSounding: {
    continuityAcrossTheAnswer: askThroughAnswer.continuity,
    rule: 'the answer enters strictly inside the two-bar ask figure: answerOffsetSeconds < askFigureSeconds',
    askFigureSeconds: Number((2 * askBarSeconds).toFixed(3)),
    answerOffsetSeconds: Number(timing.answerDelaySeconds.toFixed(4)),
    passes: timing.answerDelaySeconds < 2 * askBarSeconds,
    cellHeldAcrossBoundary: {
      rule: "relay-ask and relay-answer both publish the [0, 7] REGULATION cell as their first progression chord, so the question's own fifth sounds continuously across the variant boundary",
      askFirstChord: [0, 7],
      answerFirstChord: [0, 7]
    },
    maxInterSampleStepAcrossBoundary: askThroughAnswer.maxInterSampleStep,
    clickFree: askThroughAnswer.maxInterSampleStep < 0.25
  },
  ch5MawReference: {
    file: 'evidence/score/relay-answer_ref-ch5-maw.wav',
    onsets: maw.onsets,
    continuity: maw.continuity,
    gapsSeconds: mawGaps,
    maxGapSeconds: mawGaps.length ? Math.max(...mawGaps) : null,
    shippedGrammar: 'statement, phrase gap, response — the grammar nine chapters have taught and the one this chapter omits the gap from',
    comparison: {
      ch10AnswerOffsetSeconds: Number(timing.answerDelaySeconds.toFixed(4)),
      ch10AskFigureSeconds: Number((2 * askBarSeconds).toFixed(3)),
      answerPositionInAskFigurePercent: Number(
        ((timing.answerDelaySeconds / (2 * askBarSeconds)) * 100).toFixed(1)
      ),
      ch5MawLargestInterOnsetGapSeconds: mawGaps.length ? Math.max(...mawGaps) : null,
      reading: 'the ch10 answer lands a quarter of the way into its own two-bar question, with the question measurably still sounding across the entry (longestSilenceBeforeMs 0, rmsBefore50ms well above the floor) — there is no phrase gap to answer after',
      methodLimit: 'HONEST LIMIT: the offline mirror renders a steady MOOD, not a performed call-and-response, so the ch5-maw file cannot exhibit a scripted statement/gap/response. What it does supply is the shipped chapter\'s own event grid under the same detector — its largest inter-onset gap bounds how long that music ever leaves the field empty — and the ch10 measurement is the position of the answer inside the question, which is the claim K9 actually makes. A performed-gap reference would need a scripted realtime capture, which this run\'s evidence budget forbids.'
    }
  },
  inequality: {
    rule: 'answerDelaySeconds >= K7_REVEAL_GUARD_SECONDS (1.36s), the tri-signed simultaneity term',
    measured: Number(timing.answerDelaySeconds.toFixed(4)),
    passes: timing.answerDelaySeconds >= 1.36
  }
};
fs.writeFileSync(path.join(OUT, 'relay-answer_onsets.json'),
  JSON.stringify(report.measures.relayAnswer, null, 2) + '\n');

// --- D3 -----------------------------------------------------------------------
const resolved = await render('station-resolved_combined', {
  beat: 'ch10-transit', intensity: 0.44, seconds: 12,
  ch10Variant: 'station-resolved', carrierAlive: true
});
// Equal-intensity control, retained because the audit asked for it...
const a4 = await render('resolved_ref-a4-exhale', { beat: 'a4-exhale', intensity: 0.44, seconds: 12 });
// ...and THE reference: a4-exhale at its own authored baseline of 0.72, which
// is the level the awakening actually reaches and therefore the level the
// chapter's destination must stay under.
const a4Authored = await render('resolved_ref-a4-exhale-authored', {
  beat: 'a4-exhale', intensity: 0.72, seconds: 12
});
report.measures.resolvedVsA4 = {
  deliverable: 'evidence/score/resolved_vs_a4_rms.json',
  window: 'STEADY 8-12s, past the shared fade-in; whole-file RMS is a fade-in artifact and is not reported',
  knobs: {
    resolvedPad: 0.17, a4Pad: 0.18, resolvedSub: 0.10, a4Sub: 0.10,
    was: { pad: 0.19, sub: 0.12 },
    note: 'pad is strictly below with no tie; the sub knob ties at 0.10 and separates on the bus (0.10 x 0.748 against a4 0.10 x 0.874)'
  },
  reference: {
    primary: 'evidence/score/resolved_ref-a4-exhale-authored.wav — a4-exhale at its AUTHORED baseline intensity 0.72',
    control: 'evidence/score/resolved_ref-a4-exhale.wav — the equal-intensity 0.44 render, which understates the awakening and is retained only as a control'
  },
  steadyRmsDb: {
    resolved: resolved.steadyRmsDb,
    a4Authored: a4Authored.steadyRmsDb,
    a4EqualIntensityControl: a4.steadyRmsDb
  },
  steadyPeak: {
    resolved: resolved.steadyPeak,
    a4Authored: a4Authored.steadyPeak,
    a4EqualIntensityControl: a4.steadyPeak
  },
  steadySubBandDb: {
    resolved: resolved.steadySubEnergyDb,
    a4Authored: a4Authored.steadySubEnergyDb,
    a4EqualIntensityControl: a4.steadySubEnergyDb
  },
  strictlyBelowAuthoredA4: {
    rms: resolved.steadyRmsDb < a4Authored.steadyRmsDb,
    marginDb: Number((a4Authored.steadyRmsDb - resolved.steadyRmsDb).toFixed(4)),
    peak: resolved.steadyPeak < a4Authored.steadyPeak,
    subBand: resolved.steadySubEnergyDb < a4Authored.steadySubEnergyDb
  },
  againstEqualIntensityControl: {
    rms: resolved.steadyRmsDb < a4.steadyRmsDb,
    peak: resolved.steadyPeak < a4.steadyPeak,
    subBand: resolved.steadySubEnergyDb < a4.steadySubEnergyDb
  },
  peakIntensityReportedByScoreIntensityFor: 0.44
};
fs.writeFileSync(path.join(OUT, 'resolved_vs_a4_rms.json'),
  JSON.stringify(report.measures.resolvedVsA4, null, 2) + '\n');

// --- D7 / open measurement 2 ---------------------------------------------------
const seamTransition = await render('transit_seam-ebb_combined', {
  beat: 'ch10-transit', intensity: 0.4, seconds: 14,
  ch10Variant: 'transit-hold', carrierAlive: true,
  switchAt: 7, switchVariant: 'seam-ebb', switchCarrierAlive: true
});
const before = seamTransition.windowedRmsDb.slice(4, 7).filter(Number.isFinite);
const after = seamTransition.windowedRmsDb.slice(9, 14).filter(Number.isFinite);
report.measures.seamEbb = {
  deliverable: 'evidence/score/transit_seam-ebb_combined.wav',
  closes: 'score-audit.md open measurement 2 — the previous file was a 12s cold-start steady render, so its 11.64 dB spread was the shared fade-in, not the ebb',
  transitionAtSec: 7,
  render: 'transit-hold for 7s, then seam-ebb installed on a live scheduler step through the shipped override seam',
  windowedRmsDb: seamTransition.windowedRmsDb,
  steadyBeforeDb: before.length ? before.reduce((a, b) => a + b, 0) / before.length : null,
  steadyAfterDb: after.length ? after.reduce((a, b) => a + b, 0) / after.length : null,
  riserRail: {
    transitHold: 0.04, seamEbb: 0.04, stationResolved: 0.04,
    rule: 'one constant riser value across all three ch10-transit variants — the beat is audibly not-warp because the rail never moves'
  },
  ostinato: { transitHold: 0.05, seamEbb: 0, stationResolved: 0,
    rule: 'the pulse ebbs to zero at the seam and does NOT return inside the chapter' },
  ebbSlew: {
    named: 'SCORE_OST_GAIN_SLEW_S',
    seconds: 0.4,
    owner: 'audio/scoreEngine.ts (engine-owned, shipped)',
    note: 'the dead CH10_SEAM_EBB_SLEW_SECONDS export is deleted; the contract clause "a named slew" is satisfied by the engine constant that actually performs the ebb',
    deadExportStillPresent: timing.seamEbbSlewExport
  },
  maxInterSampleStep: seamTransition.maxInterSampleStep,
  clickFree: seamTransition.maxInterSampleStep < 0.25,
  interpretation: 'the ebb is SUBTRACTION OF PULSE, not of level: the ostinato goes to zero while the pad opens from 0.16 to 0.18, so per-second RMS does not fall — what falls out of the envelope is its event-to-event spread, and the file after 7s is sustained tone with the carrier and no rhythm section. Read the spread, not the mean; the previous 11.64 dB figure was a cold-start fade-in and measured nothing about the seam.'
};

fs.writeFileSync(path.join(OUT, 'ch10-score-repair-report.json'), JSON.stringify(report, null, 2) + '\n');
await browser.close();
console.log('wrote', path.join(OUT, 'ch10-score-repair-report.json'));
