// Re-render of the two carrier artifacts that predate the degree 14 -> 17
// re-pitch (octave double 26 -> 29):
//
//   evidence/score/carrier-illegal-control_no-carrier.wav
//   evidence/score/carrier-legality.json
//
// Same infrastructure as ch10-score-probe.mjs / ch10-score-repair-probe.mjs:
// deterministic OfflineAudioContext renders through the SHIPPED offline mirror
// on the canonical preview, combined music bus only. No realtime soak.
//
// carrier-legality.json now carries the CHORD-MEMBERSHIP check the original
// lacked: the carrier's pitch class against both home chord voicings, and the
// pitch class of the ninth it replaced, measured off the shipped exports.
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

// MODULE IDENTITY, not module path. After an edit the dev server serves the
// story score under an HMR-timestamped URL inside offlineRender's graph; a bare
// dynamic import of the same path yields a SECOND instance whose mood override
// the renderer cannot see. Read the specifier the renderer itself was rewritten
// to use, so both the override and the constants come off the instance that
// actually plays.
const SPECIFIER = await page.evaluate(async () => {
  const src = await (await fetch('/src/audio/soak/offlineRender.ts')).text();
  const m = src.match(/from\s*["']([^"']*storyScore\.ts[^"']*)["']/)?.[1];
  if (!m) throw new Error('could not resolve the renderer story-score specifier');
  return m;
});
console.log('[module-identity] storyScore specifier =', SPECIFIER);

/** Render one variant through the shipped mirror; optionally write the wav. */
async function render(name, {
  beat, intensity, seconds = 12, era = 1, legacyScene = 'deepSpace',
  ch10Variant = null, carrierAlive = false, steadyFrom = null, steadyTo = null,
  write = true
}) {
  const meta = await page.evaluate(async (o) => {
    const r = await import('/src/audio/soak/offlineRender.ts');
    const a = await import('/src/audio/soak/audioAnalysis.ts');
    const score = await import(/* @vite-ignore */ o.specifier);
    if (o.ch10Variant) {
      score.setStoryScoreMoodOverride(o.beat, score.getChapter10ScoreMood(o.ch10Variant, o.carrierAlive));
    } else {
      score.clearStoryScoreMoodOverride();
    }
    // Prove the override the renderer will read is the one we just installed.
    const installedChord = score.getStoryScoreMood(o.beat)?.chord ?? null;
    const result = await r.renderStoryBeatOffline({
      beat: o.beat, seconds: o.seconds, era: o.era, legacyScene: o.legacyScene,
      intensityAt: () => o.intensity
    });
    const channels = [];
    for (let ch = 0; ch < result.buffer.numberOfChannels; ch++) channels.push(result.buffer.getChannelData(ch));
    const sr = result.buffer.sampleRate;
    const c0 = channels[0];

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
    const steady = (from, to) => {
      let sum = 0, n = 0, peak = 0;
      for (const d of channels) {
        for (let i = Math.round(from * sr); i < Math.min(d.length, Math.round(to * sr)); i++) {
          sum += d[i] * d[i]; n++; peak = Math.max(peak, Math.abs(d[i]));
        }
      }
      return { rmsDb: 20 * Math.log10(Math.sqrt(sum / Math.max(1, n))), peak };
    };
    const steadyWindow = o.steadyFrom === null ? null : steady(o.steadyFrom, o.steadyTo);

    let maxStep = 0;
    for (let i = 1; i < c0.length; i++) maxStep = Math.max(maxStep, Math.abs(c0[i] - c0[i - 1]));

    const wav = a.encodeWavPcm16(channels, sr);
    window.__probeWav = new Uint8Array(wav);
    return {
      analysis: { ...result.analysis }, windowedRmsDb: windows,
      overallRmsDb: 20 * Math.log10(result.analysis.rms),
      steadyRmsDb: steadyWindow ? steadyWindow.rmsDb : null,
      steadyPeak: steadyWindow ? steadyWindow.peak : null,
      maxInterSampleStep: maxStep, sampleRate: sr, installedChord
    };
  }, {
    specifier: SPECIFIER, beat, intensity, seconds, era, legacyScene,
    ch10Variant, carrierAlive, steadyFrom, steadyTo
  });

  let sha = null;
  if (write) {
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
    sha = crypto.createHash('sha256').update(wav).digest('hex');
    console.log(`[wrote] ${name}.wav sha256=${sha.slice(0, 16)} bytes=${wav.length}`);
  }
  console.log(`[${name}] chord=${JSON.stringify(meta.installedChord)} rms=${meta.overallRmsDb.toFixed(4)}dB`
    + (meta.steadyRmsDb === null ? '' : ` steady=${meta.steadyRmsDb.toFixed(4)}dB`));
  return { name, sha256: sha, ...meta };
}

// --- the theory pass, read off the SAME module instance the renders use -------
const theory = await page.evaluate(async (specifier) => {
  const score = await import(/* @vite-ignore */ specifier);
  const dir = await import('/src/story/emergentScoreDirector.ts');
  const pc = (d) => ((d % 12) + 12) % 12;
  const carrier = score.CH10_CARRIER_DEGREE;
  const octave = score.CH10_CARRIER_OCTAVE_DEGREE;

  score.clearStoryScoreMoodOverride();
  const hearth = score.getStoryScoreMood('ch9-hearth');
  const crossing = score.getStoryScoreMood('ch8-crossing');

  const variants = ['cold-settled', 'fault-ledger', 'refused', 'crossing-back',
    'relay-ask', 'relay-answer', 'bearing-claimed', 'transit-hold', 'seam-ebb',
    'station-resolved'];
  const variantVoicing = variants.map((v) => {
    const m = score.getChapter10ScoreMood(v, true);
    const inChord = m.chord.includes(carrier);
    const inProgression = (m.progression ?? []).some(c => c.includes(carrier));
    const inMelodyScale = Boolean(m.melody?.scale?.includes(carrier));
    const inPattern = (m.pattern ?? []).some(d => d === carrier);
    return {
      variant: v, chord: m.chord,
      progression: m.progression ?? null,
      melodyScale: m.melody?.scale ?? null,
      pattern: m.pattern ?? null,
      voicesCarrier: inChord, inChord, inProgression, inMelodyScale, inPattern,
      voicesOctaveDouble: m.chord.includes(octave)
    };
  });
  const noCarrierResolved = score.getChapter10ScoreMood('station-resolved', false);

  const anchors = dir.CH10_ANCHOR_INTENSITY ?? {};
  const snap = typeof dir.getChapter10ScoreSnapshot === 'function' ? dir.getChapter10ScoreSnapshot() : null;

  // ENGINE-LEVEL: what the pad actually voices. The shipped pad is a fixed 4-voice
  // assignment, and when a mood publishes a progression the engine plays the
  // progression chords, not the static `chord`.
  const eng = await import('/src/audio/scoreEngine.ts');
  const resolvedWith = score.getChapter10ScoreMood('station-resolved', true);
  const resolvedWithout = score.getChapter10ScoreMood('station-resolved', false);
  const voiced = (c) => eng.resolveScorePadVoiceStates(c)
    .filter(v => v.active).map(v => v.semis);
  const engine = {
    padVoiceCount: eng.resolveScorePadVoiceStates([0, 0, 0, 0, 0, 0]).length,
    staticChordVoicedWithCarrier: voiced(resolvedWith.chord),
    staticChordVoicedWithoutCarrier: voiced(resolvedWithout.chord),
    progressionVoicedWithCarrier: (resolvedWith.progression ?? []).map(voiced),
    progressionVoicedWithoutCarrier: (resolvedWithout.progression ?? []).map(voiced),
    progressionIdenticalAcrossCarrierState:
      JSON.stringify(resolvedWith.progression) === JSON.stringify(resolvedWithout.progression)
  };

  return {
    engine,
    carrier, octave, carrierPc: pc(carrier), octavePc: pc(octave),
    hearthChord: hearth?.chord ?? null, crossingChord: crossing?.chord ?? null,
    hearthPcs: (hearth?.chord ?? []).map(pc),
    crossingPcs: (crossing?.chord ?? []).map(pc),
    variants, variantVoicing,
    noCarrierResolvedChord: noCarrierResolved.chord,
    anchorIntensity: anchors, snapshot: snap,
    maxAnchorIntensity: Math.max(...Object.values(anchors)),
    maxIntensityExport: dir.CH10_MAX_INTENSITY ?? null
  };
}, SPECIFIER);

const uniq = (a) => [...new Set(a)].sort((x, y) => x - y);
const NINTH_DEGREE = 14;           // the degree the carrier was re-pitched away from
const NINTH_PC = ((NINTH_DEGREE % 12) + 12) % 12;
const hearthPcs = uniq(theory.hearthPcs);
const crossingPcs = uniq(theory.crossingPcs);
const carrierPc = theory.carrierPc;

const firstCarrierIndex = theory.variantVoicing.findIndex(v => v.voicesCarrier);
const answerIndex = theory.variants.indexOf('relay-answer');
const beforeAnswer = theory.variantVoicing.slice(0, answerIndex);
const fromAnswer = theory.variantVoicing.slice(answerIndex);

// --- renders ------------------------------------------------------------------
// The pinned control artifact. 16s, NOT the 6s of the file it replaces: the
// octave double lives only in the SECOND progression chord, and the progression
// turns on a STEPS_PER_CHORD boundary at 2 bars = 7.06s at 68 bpm, so a 6s
// render cannot contain the moment the control exists to test.
const CONTROL_SECONDS = 16;
const noCarrier = await render('carrier-illegal-control_no-carrier', {
  beat: 'ch10-transit', intensity: 0.44, seconds: CONTROL_SECONDS,
  ch10Variant: 'station-resolved', carrierAlive: false,
  steadyFrom: 8, steadyTo: 16, write: true
});
// Matched with-carrier pair (NOT written: station-resolved_combined.wav is a
// separate pinned artifact and is not touched by this run).
const withCarrierMatched = await render('carrier-control-pair_with-carrier', {
  beat: 'ch10-transit', intensity: 0.44, seconds: CONTROL_SECONDS,
  ch10Variant: 'station-resolved', carrierAlive: true,
  steadyFrom: 8, steadyTo: 16, write: false
});
// The 12s with-carrier render, i.e. the params of the pinned
// station-resolved_combined.wav, kept so the historic field stays comparable.
const withCarrier12s = await render('carrier-reference_station-resolved-12s', {
  beat: 'ch10-transit', intensity: 0.44, seconds: 12,
  ch10Variant: 'station-resolved', carrierAlive: true,
  steadyFrom: 8, steadyTo: 12, write: false
});

// The 6s control never reaches the progression turn (STEPS_PER_CHORD = 2 bars =
// 7.06s at 68 bpm), and the octave double is only in the SECOND progression
// chord. Measure the pair again past that turn, and add a hand-filtered
// reference with 29 removed from the progression too, which is what an actually
// carrier-less resolve would sound like.
const past = await page.evaluate(async (specifier) => {
  const r = await import('/src/audio/soak/offlineRender.ts');
  const score = await import(/* @vite-ignore */ specifier);
  const one = async (mood, seconds) => {
    score.setStoryScoreMoodOverride('ch10-transit', mood);
    const res = await r.renderStoryBeatOffline({
      beat: 'ch10-transit', seconds, era: 1, legacyScene: 'deepSpace', intensityAt: () => 0.44
    });
    return { rmsDb: 20 * Math.log10(res.analysis.rms), data: res.buffer.getChannelData(0), sr: res.buffer.sampleRate };
  };
  const diff = (A, B, sr) => {
    let maxDiff = 0, first = -1;
    for (let i = 0; i < Math.min(A.length, B.length); i++) {
      const d = Math.abs(A[i] - B[i]);
      if (d > 1e-5 && first < 0) first = i;
      if (d > maxDiff) maxDiff = d;
    }
    return { maxAbsSampleDiff: maxDiff, firstAudibleDiffSec: first < 0 ? null : Number((first / sr).toFixed(4)) };
  };
  const withM = score.getChapter10ScoreMood('station-resolved', true);
  const noM = score.getChapter10ScoreMood('station-resolved', false);
  const handFiltered = { ...noM, progression: (noM.progression ?? []).map(c => c.filter(d => d !== score.CH10_CARRIER_OCTAVE_DEGREE)) };
  const a = await one(withM, 16);
  const b = await one(noM, 16);
  const c = await one(handFiltered, 16);
  // Determinism control: the SAME mood rendered twice in the same session. Any
  // difference here is renderer float noise and bounds what a carrier A/B can
  // legitimately claim.
  const a2 = await one(withM, 16);
  return {
    seconds: 16,
    withCarrierRmsDb: a.rmsDb,
    withoutCarrierRmsDb: b.rmsDb,
    handFilteredProgressionRmsDb: c.rmsDb,
    handFilteredProgression: handFiltered.progression,
    shippedProgressionWithoutCarrier: noM.progression,
    shippedPathDiff: diff(a.data, b.data, a.sr),
    handFilteredDiff: diff(a.data, c.data, a.sr),
    shippedVsHandFilteredDiff: diff(b.data, c.data, a.sr),
    repeatRenderDiff: diff(a.data, a2.data, a.sr),
    repeatRenderRmsDb: a2.rmsDb
  };
}, SPECIFIER);
console.log('[16s pair] with=%s without=%s handFiltered=%s shippedMaxDiff=%s handMaxDiff=%s',
  past.withCarrierRmsDb.toFixed(6), past.withoutCarrierRmsDb.toFixed(6),
  past.handFilteredProgressionRmsDb.toFixed(6),
  past.shippedPathDiff.maxAbsSampleDiff, past.handFilteredDiff.maxAbsSampleDiff);

const RMS_TOLERANCE_DB = 0.001;
const shippedPathAudiblyDiffers = past.shippedPathDiff.maxAbsSampleDiff > 1e-5;
const octaveDoubleIsAudibleAtAll = past.handFilteredDiff.maxAbsSampleDiff > 1e-5;

const carrierLegality = {
  deliverable: 'evidence/score/carrier-legality.json',
  regeneratedAt: new Date().toISOString(),
  regeneratedBecause: 'the carrier was re-pitched from scale degree 14 to degree 17 (pitch class 5, the suspended-fourth/eleventh colour) and its octave double from 26 to 29; this file and carrier-illegal-control_no-carrier.wav predated that change',
  moduleIdentity: {
    rule: 'constants, moods and the mood override are all read from the storyScore instance offlineRender.ts itself imports, resolved out of the transformed renderer source',
    storyScoreSpecifier: SPECIFIER
  },
  carrierPitch: {
    carrierDegree: theory.carrier,
    carrierDegreeExpected: 17,
    carrierDegreeMatches: theory.carrier === 17,
    octaveDoubleDegree: theory.octave,
    octaveDoubleExpected: 29,
    octaveDoubleMatches: theory.octave === 29,
    octaveDoubleIsCarrierPlus12: theory.octave === theory.carrier + 12,
    carrierPitchClass: carrierPc,
    carrierPitchClassExpected: 5,
    carrierPitchClassMatches: carrierPc === 5,
    octaveDoublePitchClass: theory.octavePc,
    octaveDoubleSamePitchClass: theory.octavePc === carrierPc,
    source: 'storyScore.ts exports CH10_CARRIER_DEGREE / CH10_CARRIER_OCTAVE_DEGREE'
  },
  chordMembership: {
    rule: 'the carrier must be a chord tone of NEITHER home voicing, and the ninth it replaced must be a chord tone of BOTH — that is why the ninth was not new information at birth',
    carrierPitchClass: carrierPc,
    replacedNinthDegree: NINTH_DEGREE,
    replacedNinthPitchClass: NINTH_PC,
    homeChords: {
      'ch9-hearth': { chord: theory.hearthChord, pitchClasses: hearthPcs },
      'ch8-crossing': { chord: theory.crossingChord, pitchClasses: crossingPcs }
    },
    carrierAbsentFromHearth: !hearthPcs.includes(carrierPc),
    carrierAbsentFromCrossing: !crossingPcs.includes(carrierPc),
    carrierAbsentFromBothHomeChords: !hearthPcs.includes(carrierPc) && !crossingPcs.includes(carrierPc),
    replacedNinthPresentInHearth: hearthPcs.includes(NINTH_PC),
    replacedNinthPresentInCrossing: crossingPcs.includes(NINTH_PC),
    replacedNinthPresentInBothHomeChords: hearthPcs.includes(NINTH_PC) && crossingPcs.includes(NINTH_PC),
    comparedAs: 'pitch classes (degree mod 12), so octave placement cannot hide a membership'
  },
  carrierLifespanByVariant: {
    rule: 'every ch10 variant from relay-answer onward voices the carrier degree in its chord; no variant before it does',
    variantOrder: theory.variants,
    carrierBornAtVariant: 'relay-answer',
    firstVariantVoicingCarrier: firstCarrierIndex >= 0 ? theory.variants[firstCarrierIndex] : null,
    bornAtRelayAnswer: firstCarrierIndex === answerIndex,
    allFromAnswerOnwardVoiceCarrier: fromAnswer.every(v => v.voicesCarrier),
    noneBeforeAnswerVoiceCarrier: beforeAnswer.every(v => !v.voicesCarrier),
    perVariant: theory.variantVoicing
  },
  anchorIntensity: theory.anchorIntensity,
  maxAnchorIntensity: theory.maxAnchorIntensity,
  maxIntensityRule: 'CH10_MAX_INTENSITY 0.44 is the run ceiling and is reported through scoreIntensityFor',
  maxIntensityExport: theory.maxIntensityExport,
  maxAnchorIntensityIs044: Math.abs(theory.maxAnchorIntensity - 0.44) < 1e-9,
  ceilingRespected: theory.maxAnchorIntensity <= 0.44 + 1e-9,
  carrierBirth: 'anc.ch10.relay-answer',
  carrierDeath: 'released at anc.ch10.threshold-handback via reset-score (releaseChapter10Score)',
  snapshotAtProbe: theory.snapshot,
  octaveDoubleRequiresCarrier: {
    rule: 'getChapter10ScoreMood(station-resolved, carrierAlive=false) filters CH10_CARRIER_OCTAVE_DEGREE out of the chord',
    ruleHoldsAtTheEngine: shippedPathAudiblyDiffers,
    chordWithCarrier: theory.variantVoicing[theory.variants.indexOf('station-resolved')].chord,
    chordWithoutCarrier: theory.noCarrierResolvedChord,
    octaveDoubleFilteredOut: !theory.noCarrierResolvedChord.includes(theory.octave),
    control: `evidence/score/carrier-illegal-control_no-carrier.wav — station-resolved, carrierAlive=false, ch10-transit, intensity 0.44, ${CONTROL_SECONDS}s, combined music bus`,
    controlDurationSeconds: CONTROL_SECONDS,
    controlDurationChangedFrom: 6,
    controlDurationChangeReason: 'the octave double is voiced only in the SECOND progression chord [0, 9, 17, 29], and the engine turns the progression on a STEPS_PER_CHORD boundary of 2 bars = 7.06s at 68 bpm. The previous 6s control ended before that turn, so it could not contain the moment it existed to disprove — with and without the carrier were sample-equivalent for a reason that had nothing to do with the carrier. The control is now 16s, which contains the turn with margin.',
    matchedRenderNote: `withCarrierRmsDb / withoutCarrierRmsDb are a MATCHED pair: identical beat, intensity, era, legacy scene and duration (${CONTROL_SECONDS}s), differing only in carrierAlive. The 12s figure below is the same render settings as the pinned station-resolved_combined.wav and is kept so the historic number stays comparable.`,
    withCarrierRmsDb: withCarrierMatched.overallRmsDb,
    withoutCarrierRmsDb: noCarrier.overallRmsDb,
    deltaDb: Number((withCarrierMatched.overallRmsDb - noCarrier.overallRmsDb).toFixed(6)),
    withCarrierSteadyRmsDb: withCarrierMatched.steadyRmsDb,
    withoutCarrierSteadyRmsDb: noCarrier.steadyRmsDb,
    steadyDeltaDb: Number((withCarrierMatched.steadyRmsDb - noCarrier.steadyRmsDb).toFixed(6)),
    steadyWindow: `8-16s of the ${CONTROL_SECONDS}s render, i.e. entirely past the 7.06s progression turn`,
    maxAbsSampleDiff: past.shippedPathDiff.maxAbsSampleDiff,
    firstAudibleDiffSec: past.shippedPathDiff.firstAudibleDiffSec,
    withCarrier12sRmsDb: withCarrier12s.overallRmsDb,
    withCarrier12sSteadyRmsDb: withCarrier12s.steadyRmsDb,
    rmsToleranceDb: RMS_TOLERANCE_DB,
    differs: Math.abs(withCarrierMatched.overallRmsDb - noCarrier.overallRmsDb) > RMS_TOLERANCE_DB,
    withCarrierLouder: withCarrierMatched.overallRmsDb - noCarrier.overallRmsDb > RMS_TOLERANCE_DB,
    controlWavSha256: noCarrier.sha256,
    // ---- the measurement the original file did not make -----------------------
    engine: theory.engine,
    pastProgressionTurn: past,
    finding: {
      status: shippedPathAudiblyDiffers
        ? 'PASS — carrierAlive=false audibly removes the octave double at the progression turn'
        : 'FAIL — the octave double sounds identically with and without the carrier',
      shippedPathAudiblyDiffers,
      shippedPathMaxAbsSampleDiff: past.shippedPathDiff.maxAbsSampleDiff,
      shippedPathFirstAudibleDiffSec: past.shippedPathDiff.firstAudibleDiffSec,
      shippedPathDiffIsFloatNoiseOnly: past.shippedPathDiff.maxAbsSampleDiff < 1e-5,
      octaveDoubleIsAudibleAtAll,
      octaveDoubleAudibleProof: 'removing 29 from the PROGRESSION by hand changes the render: first audible sample difference at the 2-bar progression turn, and the overall RMS drops',
      handFilteredFirstAudibleDiffSec: past.handFilteredDiff.firstAudibleDiffSec,
      handFilteredMaxAbsSampleDiff: past.handFilteredDiff.maxAbsSampleDiff,
      shippedFilterEqualsHandFilter: {
        rule: 'the shipped carrierAlive=false path should now produce exactly what removing 29 from the progression by hand produces',
        maxAbsSampleDiff: past.shippedVsHandFilteredDiff.maxAbsSampleDiff,
        equivalent: past.shippedVsHandFilteredDiff.maxAbsSampleDiff < 1e-5,
        shippedProgressionWithoutCarrier: past.shippedProgressionWithoutCarrier,
        handFilteredProgression: past.handFilteredProgression
      },
      priorDefect: {
        foundAt: 'the regeneration that preceded this one, against storyScore.ts before the progression filter was added',
        wasStatus: 'FAIL — with- and without-carrier renders were sample-equivalent (max abs diff 2.38e-7, RMS equal to 8 decimal places at both 6s and 16s)',
        cause: [
          'station-resolved publishes a `progression`, and scoreEngine plays `mood.progression[chordIndex]` on every 2-bar boundary; the static `chord` is only the no-progression fallback. getChapter10ScoreMood filtered CH10_CARRIER_OCTAVE_DEGREE out of `base.chord` ONLY, so the progression chord [0, 9, 17, 29] kept the octave double in both carrier states.',
          'SCORE_PAD_VOICE_COUNT is 4 and station-resolved.chord is the 5-tone [0, 7, 12, 17, 29], so degree 29 was truncated out of the static-chord voicing anyway — the filter removed a degree the pad never voiced.'
        ],
        fix: 'getChapter10ScoreMood now filters CH10_CARRIER_OCTAVE_DEGREE out of `chord` AND every entry of `progression`',
        secondDefect: 'the control was 6s and the progression turn is at 7.06s, so the artifact could not have detected the defect at any code revision; the control is now 16s'
      }
    }
  },
  renderDeterminism: {
    caveat: 'THIS WAV SHA WILL NOT RE-VERIFY. Identical probe invocations do not produce identical PCM.',
    sameMoodRepeatMaxAbsSampleDiff: past.repeatRenderDiff.maxAbsSampleDiff,
    sameMoodRepeatRmsDb: [past.withCarrierRmsDb, past.repeatRenderRmsDb],
    observedCrossSessionShas: {
      note: 'two earlier invocations of this probe with byte-identical parameters produced different SHA-256 for carrier-illegal-control_no-carrier.wav at the same 1058444 bytes',
      shas: [
        '6df48c882bcd72cf… (6s revision, run 1)',
        '74d1d3c79f9a3be3b1adb8890be8a87984f775b0ee2ccb5b1013319e5b90d676 (6s revision, run 2)'
      ]
    },
    magnitude: 'per-sample float divergence of order 1e-7, which crosses PCM16 quantization boundaries (1/32768 = 3.05e-5) on a small fraction of samples',
    consequence: 'a registry that pins this WAV by SHA-256 will report a mismatch on any re-render. Pin the measurements in this file, or re-pin the SHA whenever the WAV is regenerated.',
    doesNotAffect: 'the carrier A/B: the shipped-path difference is reported above alongside this noise floor, and is orders of magnitude larger'
  }
};

const assertions = {
  carrierDegreeIs17: carrierLegality.carrierPitch.carrierDegreeMatches,
  octaveDoubleIs29: carrierLegality.carrierPitch.octaveDoubleMatches,
  carrierPitchClassIs5: carrierLegality.carrierPitch.carrierPitchClassMatches,
  carrierAbsentFromBothHomeChords: carrierLegality.chordMembership.carrierAbsentFromBothHomeChords,
  replacedNinthPresentInBothHomeChords: carrierLegality.chordMembership.replacedNinthPresentInBothHomeChords,
  allFromRelayAnswerOnwardVoiceCarrier: carrierLegality.carrierLifespanByVariant.allFromAnswerOnwardVoiceCarrier,
  noVariantBeforeRelayAnswerVoicesCarrier: carrierLegality.carrierLifespanByVariant.noneBeforeAnswerVoiceCarrier,
  octaveDoubleFilteredFromStaticChordWithoutCarrier: carrierLegality.octaveDoubleRequiresCarrier.octaveDoubleFilteredOut,
  octaveDoubleCannotSoundWithoutCarrier: shippedPathAudiblyDiffers,
  maxAnchorIntensityIs044: carrierLegality.maxAnchorIntensityIs044
};
carrierLegality.assertions = assertions;
carrierLegality.allAssertionsPass = Object.values(assertions).every(Boolean);

fs.writeFileSync(path.join(OUT, 'carrier-legality.json'), JSON.stringify(carrierLegality, null, 2) + '\n');
await browser.close();

console.log('\n--- assertions ---');
for (const [k, v] of Object.entries(assertions)) console.log(`${v ? 'PASS' : 'FAIL'}  ${k}`);
console.log('allAssertionsPass =', carrierLegality.allAssertionsPass);
console.log('wrote', path.join(OUT, 'carrier-legality.json'));
