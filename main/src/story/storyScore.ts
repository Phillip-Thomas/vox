import type { StoryBeat } from './storyState.ts';
import {
  cancelPendingScheduledHits,
  getScoreMoodTonic,
  noteImmediateHit,
  readLiveBedTonic,
  resolveScorePlanetHomeRoot,
  scheduleHit,
  scoreHit,
  SCORE_ROOT_HZ,
  setScoreMood,
  unlockScore,
  type HitSchedule,
  type ScheduleHitKind,
  type ScoreMood
} from '../audio/scoreEngine.ts';
import type { HitQuantize } from '../audio/generative/transport.ts';
import type { HitQuantumRung } from '../audio/generative/hitSchedule.ts';
import type { MoodVoicingPolicy } from '../audio/generative/moodConstraint.ts';
import { LATENCY_COMP_MAX_S, SFX_BUNDLE_ARM_LEAD_S } from '../audio/generative/tuning.ts';
import { tailLatencyForSampleRate } from '../audio/mix/mixTuning.ts';
import { peekAudioContext } from '../audio/audioCore.ts';

// --- The story score ---------------------------------------------------------------------
//
// The STORY'S side of the score: the per-beat mood table. The instrument
// itself (voices, scheduler, rails, hits) lives in audio/scoreEngine.ts and
// plays through the shared music bus; this module owns WHAT it plays during
// the story. Every story beat gets a MOODS entry — one style per era, each
// style blending into the next (the same voices retune rather than swap):
// the terminal era is square-wave pulses, the raster era a chip ostinato, the
// constrained-survey era dark detuned-saw tension pads, and the awakenings get the full
// treatment — riser swells driven by the DIRECTOR'S OWN timeline values,
// braams at the cuts, and chord blooms when the world changes.

// EARLY-LADDER CALM LAWS (owner brief 2026-07): the monochrome/prologue moods
// stay primitive-substrate music, but pleasing and patient — lo-fi warmth over
// abrasion. Concretely, every beat before A2: sub ≤ 0.10 (no constant low
// tone on top of the mix), ostinato patterns keep at least three rests per
// bar (space is part of the pattern), and chip grooves stay at or under
// 112 BPM. The engine side (chip drone register/level, rounded chip note
// envelopes, darker chip ostinato filter) lives in audio/scoreEngine.ts.
// The awakening ramps (a1-ramp, a2-awakening) are intentionally exempt —
// they ARE the blooms this quiet ladder builds toward.
const MOODS: Partial<Record<StoryBeat, ScoreMood>> = {
  // The terminal era: patient machine pulses. Nothing hurries. Nothing hopes.
  crawl:    { chord: [0, 7], pattern: [0, null, null, null, 7, null, null, null], tempo: 52, wave: 'square', pad: 0.05, sub: 0.07, ost: 0.045, riser: 0.05, baseline: 0.25, octave: 24 },
  manifest: { chord: [0, 7], pattern: [0, null, 0, null, 7, null, 0, null], tempo: 60, wave: 'square', pad: 0.05, sub: 0.07, ost: 0.05, riser: 0.05, baseline: 0.3, octave: 24 },
  // The commute: a worried minor drift under the wireframes — with room to breathe.
  voyage:   { chord: [0, 3, 7], progression: [[0, 3, 7], [8, 12, 15]], melody: { scale: [0, 2, 3, 5, 7, 8, 10, 12], density: 0.35 }, pattern: [0, null, 7, 3, null, 7, 10, null], tempo: 66, wave: 'square', pad: 0.07, sub: 0.08, ost: 0.05, riser: 0.09, baseline: 0.35, octave: 24 },
  // Pong: the pulse doubles; the era's whole orchestra is one oscillator afraid.
  deflect:  { chord: [0, 5], pattern: [0, null, 0, null, 5, null, 0, 12], tempo: 112, wave: 'square', pad: 0.05, sub: 0.09, ost: 0.055, riser: 0.16, baseline: 0.55, octave: 24 },
  crash:    { chord: [0, 1], pattern: [0, null, 1, null, 0, null, 1, null], tempo: 88, wave: 'sawtooth', pad: 0.08, sub: 0.10, ost: 0.05, riser: 0.2, baseline: 0.7, octave: 12 },
  // Falling: a semitone of dread widening under the raster sky.
  descent:  { chord: [0, 1, 7], pattern: [0, null, null, 1, null, null, 0, null], tempo: 84, wave: 'sawtooth', pad: 0.1, sub: 0.10, ost: 0.045, riser: 0.22, baseline: 0.5, octave: 12 },
  // The bolted-frame era: one voice, blinking in a dark room. Density is a
  // privilege the ladder has not yet issued.
  'ch1-fixed': { chord: [0, 7], melody: { scale: [0, 3, 5, 7, 10, 12], density: 0.2 }, pattern: [0, null, null, null, null, null, 7, null], tempo: 92, wave: 'square', pad: 0.04, sub: 0.07, ost: 0.05, riser: 0.04, baseline: 0.3, octave: 24 },
  // The unbolt: eight seconds of held breath, then the pulse learns to walk.
  'ch1-track': { chord: [0, 5, 12], pattern: [0, null, null, null, 5, null, null, null], tempo: 72, wave: 'square', pad: 0.09, sub: 0.08, ost: 0.04, riser: 0.18, baseline: 0.55, octave: 24 },
  // The chip era: work becomes a groove (the one mood allowed to be fun) —
  // a syncopated cell with air in it, not a wall of eighth notes.
  'ch1-raster': { chord: [0, 3, 7, 10], progression: [[0, 3, 7], [8, 12, 15], [3, 7, 10], [10, 14, 17]], melody: { scale: [0, 2, 3, 5, 7, 8, 10, 12], density: 0.4 }, pattern: [0, null, 7, 3, null, 10, 7, null], tempo: 100, wave: 'square', pad: 0.06, sub: 0.08, ost: 0.055, riser: 0.08, baseline: 0.4, octave: 24 },
  // Work-line recovery: the raster groove grows a second voice before NAV opens depth.
  'ch1-depth': { chord: [0, 3, 7, 10], progression: [[0, 3, 7, 10], [5, 8, 12], [3, 7, 10], [8, 12, 15]], melody: { scale: [0, 2, 3, 5, 7, 8, 10, 12], density: 0.45 }, pattern: [0, null, 10, 7, null, 3, null, 12], tempo: 96, wave: 'square', pad: 0.07, sub: 0.08, ost: 0.06, riser: 0.08, baseline: 0.42, octave: 24 },
  // Nav view: staccato chart-reading — pellet energy, politely surveilled.
  'ch1-nav': { chord: [0, 5, 7], progression: [[0, 5, 7], [3, 7, 10], [5, 10, 12], [0, 7, 12]], melody: { scale: [0, 2, 5, 7, 9, 12], density: 0.45 }, pattern: [0, null, 0, 7, null, 5, null, null], tempo: 104, wave: 'square', pad: 0.05, sub: 0.08, ost: 0.06, riser: 0.07, baseline: 0.4, octave: 24 },
  // Isometric: the pad widens — height exists, and the music looks up at it.
  'ch1-iso': { chord: [0, 3, 7, 14], progression: [[0, 3, 7, 14], [8, 12, 15], [5, 8, 12, 19], [3, 7, 10]], melody: { scale: [0, 2, 3, 5, 7, 10, 12, 14], density: 0.4 }, pattern: [0, null, 7, null, 14, null, 7, null], tempo: 90, wave: 'square', pad: 0.1, sub: 0.09, ost: 0.06, riser: 0.12, baseline: 0.5, octave: 12 },
  // The lift: the groove decomposes into held wonder.
  'ch1-lift': { chord: [0, 3, 7, 12], pattern: [0, null, null, null, 7, null, null, null], tempo: 84, wave: 'sawtooth', pad: 0.13, sub: 0.09, ost: 0.03, riser: 0.24, baseline: 0.6, octave: 12 },
  // The embodied survey: tension pads, sparse heartbeat, a semitone that will not resolve.
  'ch1-anomaly': { chord: [0, 1, 7], progression: [[0, 3, 7], [1, 5, 8]], melody: { scale: [0, 2, 3, 5, 7, 8, 10, 12], density: 0.3 }, pattern: [0, null, null, null, 1, null, null, null], tempo: 58, wave: 'sawtooth', pad: 0.11, sub: 0.09, ost: 0.035, riser: 0.14, baseline: 0.4, octave: 12 },
  'a1-ramp': { chord: [0, 3, 7], pattern: [0, 3, 7, 12, 0, 3, 7, 12], tempo: 96, wave: 'sawtooth', pad: 0.12, sub: 0.14, ost: 0.05, riser: 0.3, baseline: 0.85, octave: 12 },
  'ch2-color': { chord: [0, 3, 8], progression: [[0, 3, 8], [5, 8, 12], [0, 3, 7], [1, 5, 8]], melody: { scale: [0, 2, 3, 5, 7, 8, 10, 12], density: 0.35 }, pattern: [0, null, 3, null, 8, null, 3, null], tempo: 64, wave: 'sawtooth', pad: 0.11, sub: 0.09, ost: 0.04, riser: 0.14, baseline: 0.4, octave: 12 },
  'ch2-approach': { chord: [0, 1, 8], progression: [[0, 1, 8], [0, 3, 8]], melody: { scale: [0, 1, 3, 5, 7, 8], density: 0.25 }, pattern: [0, null, 0, null, 1, null, 0, null], tempo: 72, wave: 'sawtooth', pad: 0.12, sub: 0.10, ost: 0.045, riser: 0.22, baseline: 0.55, octave: 12 },
  // A2: the flood is a cluster; the liberation build lives on the intensity rail.
  'a2-awakening': { chord: [0, 1, 6, 7], pattern: [0, 1, 0, 1, 0, 1, 0, 1], tempo: 132, wave: 'sawtooth', pad: 0.13, sub: 0.16, ost: 0.05, riser: 0.34, baseline: 0.8, octave: 12 },
  // Chapter 3: warmth earned — minor lifts toward its relative major.
  'ch3-gather': { chord: [0, 7, 12, 15], progression: [[0, 7, 12, 15], [3, 7, 12], [10, 14, 17], [7, 10, 14]], melody: { scale: [0, 2, 3, 5, 7, 9, 10, 12], density: 0.6 }, pattern: [0, null, 7, null, 12, null, 7, null], tempo: 76, wave: 'triangle', pad: 0.12, sub: 0.11, ost: 0.05, riser: 0.1, baseline: 0.35, octave: 12 },
  'ch3-dusk': { chord: [0, 7, 12, 16], progression: [[0, 7, 12, 16], [5, 12, 17, 21]], melody: { scale: [0, 2, 3, 5, 7, 9, 10, 12], density: 0.4 }, pattern: [0, null, null, null, 12, null, null, null], tempo: 66, wave: 'sawtooth', pad: 0.16, sub: 0.12, ost: 0.03, riser: 0.26, baseline: 0.7, octave: 12 },
  'ch3-await-rest': { chord: [0, 7, 15], progression: [[0, 7, 15], [5, 12, 17]], melody: { scale: [0, 3, 7, 10, 12], density: 0.25 }, pattern: [0, null, null, null, null, null, 7, null], tempo: 54, wave: 'triangle', pad: 0.1, sub: 0.1, ost: 0.03, riser: 0.08, baseline: 0.3, octave: 12 },
  // Dawn: the largest build in the slice, resolving major as texture arrives.
  'a3-dawn': { chord: [0, 4, 7, 11], progression: [[0, 4, 7, 11], [5, 9, 12, 16], [7, 11, 14], [0, 4, 7, 12]], melody: { scale: [0, 2, 4, 5, 7, 9, 11, 12], density: 0.7 }, pattern: [0, 4, 7, 11, 12, 11, 7, 4], tempo: 88, wave: 'sawtooth', pad: 0.17, sub: 0.13, ost: 0.05, riser: 0.32, baseline: 0.75, octave: 12 },
  // The first day alive: the dawn's major settled into a walking morning hymn.
  'ch3-thirst': { chord: [0, 7, 12, 16], progression: [[0, 7, 12, 16], [5, 9, 12], [7, 11, 14], [0, 4, 7, 12]], melody: { scale: [0, 2, 4, 7, 9, 12], density: 0.4 }, pattern: [0, null, null, null, 12, null, null, null], tempo: 72, wave: 'triangle', pad: 0.13, sub: 0.1, ost: 0.035, riser: 0.08, baseline: 0.3, octave: 12 },
  // Forage: the hymn grows off-beats — appetite is a rhythm.
  'ch3-forage': { chord: [0, 4, 9, 12], progression: [[0, 4, 9, 12], [5, 9, 14], [0, 4, 7], [7, 11, 16]], melody: { scale: [0, 2, 4, 7, 9, 12, 14], density: 0.5 }, pattern: [0, null, 4, null, 9, null, 4, null], tempo: 84, wave: 'triangle', pad: 0.11, sub: 0.1, ost: 0.05, riser: 0.08, baseline: 0.32, octave: 12 },
  // The klaxon: the first minor lift since A2 — urgency without machinery.
  'ch3-signal': { chord: [0, 3, 7], progression: [[0, 3, 7], [5, 8, 12], [3, 7, 10], [0, 3, 7]], melody: { scale: [0, 2, 3, 5, 7, 10, 12], density: 0.45 }, pattern: [0, 0, null, 3, null, 7, 0, null], tempo: 126, wave: 'triangle', pad: 0.09, sub: 0.13, ost: 0.06, riser: 0.2, baseline: 0.55, octave: 12 },
  // The vigil: ch3-await-rest DETUNED — one flatted degree; familiar, and wrong.
  'ch4-vigil': { chord: [0, 6, 15], progression: [[0, 6, 15], [5, 11, 17]], melody: { scale: [0, 3, 6, 10, 12], density: 0.22 }, pattern: [0, null, null, null, null, null, 6, null], tempo: 52, wave: 'triangle', pad: 0.11, sub: 0.11, ost: 0.03, riser: 0.1, baseline: 0.32, octave: 12 },
  // The arrival: warm strings hold — and the SQUARE WAVE returns underneath,
  // the ch1 timbre as a foreign body in the living world's mix.
  'ch4-arrival': { chord: [0, 7, 12, 16], progression: [[0, 7, 12, 16], [0, 7, 13, 16]], melody: { scale: [0, 2, 4, 7, 11, 12], density: 0.25 }, pattern: [0, null, 0, null, 7, null, 0, null], tempo: 60, wave: 'square', pad: 0.15, sub: 0.12, ost: 0.05, riser: 0.24, baseline: 0.5, octave: 24 },
  // The audit isolates the returning square cell from the living bed: the same
  // interval keeps reclassifying what the player has learned to hear as life.
  'ch4-audit': { chord: [0, 6, 7], progression: [[0, 6, 7], [0, 1, 7]], melody: { scale: [0, 1, 6, 7, 10, 12], density: 0.16 }, pattern: [0, null, null, 6, null, null, 7, null], tempo: 58, wave: 'square', pad: 0.1, sub: 0.14, ost: 0.035, riser: 0.12, baseline: 0.42, octave: 24 },
  // Compliance subtracts rather than intensifies. Each act removes a voice.
  'ch4-comply': { chord: [0, 1, 6], progression: [[0, 6], [0, 1]], melody: { scale: [0, 1, 6, 7], density: 0.1 }, pattern: [0, null, null, null, 1, null, null, null], tempo: 48, wave: 'square', pad: 0.07, sub: 0.11, ost: 0.022, riser: 0.04, baseline: 0.26, octave: 24 },
  // Refusal is small enough to be missed: almost no accompaniment beneath no.
  'ch4-defy': { chord: [0, 7], melody: { scale: [0, 7, 12], density: 0.04 }, pattern: [0, null, null, null, null, null, null, null], tempo: 42, wave: 'triangle', pad: 0.035, sub: 0.06, ost: 0.008, riser: 0.015, baseline: 0.1, octave: 12 },
  // Breath grows from the fixed shared onset; it is an ecosystem arriving, not
  // a victory fanfare, so the full chord opens one member at a time.
  'a4-exhale': { chord: [0, 4, 7, 9, 14], progression: [[0, 7], [0, 4, 7], [0, 4, 7, 9], [0, 4, 7, 9, 14]], melody: { scale: [0, 2, 4, 7, 9, 11, 12, 14], density: 0.62 }, pattern: [0, null, 7, null, 9, null, 14, null], tempo: 66, wave: 'triangle', pad: 0.18, sub: 0.1, ost: 0.04, riser: 0.3, baseline: 0.72, octave: 12 },
  // Direction: W-7744's square fifth catches once inside a hand-played repair
  // pulse, then the awakened Maw answers with a clean resonant interval.
  'ch5-maw': { chord: [0, 7, 10, 14], progression: [[0, 7, 10], [5, 10, 14], [0, 7, 14]], melody: { scale: [0, 2, 3, 5, 7, 10, 12, 14], density: 0.38 }, pattern: [0, null, 7, null, 10, null, 14, null], tempo: 70, wave: 'triangle', pad: 0.11, sub: 0.1, ost: 0.045, riser: 0.1, baseline: 0.34, octave: 12 },
  // Below stretches phrase length while the Maw's fifth and the independent O2
  // pulse remain distinguishable; vulnerability has room to count.
  'ch6-dive': { chord: [0, 5, 7, 14], progression: [[0, 5, 7], [3, 7, 10], [0, 7, 14]], melody: { scale: [0, 2, 3, 5, 7, 9, 10, 12, 14], density: 0.28 }, pattern: [0, null, null, 7, null, null, 14, null], tempo: 54, wave: 'sine', pad: 0.15, sub: 0.13, ost: 0.026, riser: 0.08, baseline: 0.32, octave: 12 },
  // Chapter 7's steady defaults are the quietest variants. The emergent score
  // director selects cumulative repair/boarding variants from committed facts.
  'ch7-reconstruct': { chord: [0, 7, 14], pattern: [0, null, null, null, null, null, 7, null], tempo: 64, wave: 'triangle', pad: 0.04, sub: 0.06, ost: 0.015, riser: 0.04, baseline: 0.26, octave: 12 },
  'ch7-board': { chord: [0, 7, 9, 14], progression: [[0, 7, 9, 14], [0, 5, 9, 14]], melody: { scale: [0, 2, 3, 5, 7, 9, 10, 12, 14], density: 0.52 }, pattern: [0, null, 7, 9, 14, null, 7, null], tempo: 64, wave: 'triangle', pad: 0.15, sub: 0.14, ost: 0.06, riser: 0.18, baseline: 0.56, octave: 12 },
  // Launch does not swap to a trailer track; repair pulses phase-lock into the
  // engine rhythm the player is physically steering.
  'ch8-launch': { chord: [0, 5, 9, 14], progression: [[0, 5, 9, 14], [2, 7, 9, 14], [5, 9, 12, 16]], melody: { scale: [0, 2, 3, 5, 7, 9, 10, 12, 14], density: 0.4 }, pattern: [0, null, 7, null, 9, null, 14, null], tempo: 72, wave: 'sawtooth', pad: 0.15, sub: 0.15, ost: 0.075, riser: 0.28, baseline: 0.5, octave: 12 },
  // The crossing holds origin B-Dorian memory until the canonical sibling
  // identity is targeted; AudioDirector then walks the bed toward Tidegarden.
  'ch8-crossing': { chord: [0, 3, 7, 9, 14], progression: [[0, 3, 7, 9], [5, 9, 12, 16], [7, 11, 14, 18]], melody: { scale: [0, 2, 3, 5, 7, 9, 10, 12, 14], density: 0.32 }, pattern: [0, null, 7, null, 9, null, 14, null], tempo: 68, wave: 'sawtooth', pad: 0.17, sub: 0.12, ost: 0.035, riser: 0.14, baseline: 0.42, octave: 12 },
  // Landfall resolves into the sibling's open Mixolydian colour without
  // implying that a richer world is morally or cosmically higher.
  'ch8-landfall': { chord: [0, 4, 7, 10, 14], progression: [[0, 4, 7, 10], [5, 9, 12, 15], [0, 4, 7, 10, 14]], melody: { scale: [0, 2, 4, 5, 7, 9, 10, 12, 14], density: 0.5 }, pattern: [0, null, 4, null, 10, null, 7, null], tempo: 74, wave: 'triangle', pad: 0.16, sub: 0.1, ost: 0.045, riser: 0.16, baseline: 0.46, octave: 12 },
  'ch9-settle': { chord: [0, 4, 7, 10, 14], progression: [[0, 4, 7], [5, 9, 12], [10, 14, 17], [0, 4, 7, 10]], melody: { scale: [0, 2, 4, 5, 7, 9, 10, 12, 14], density: 0.58 }, pattern: [0, 7, null, 10, 4, null, 14, null], tempo: 82, wave: 'triangle', pad: 0.14, sub: 0.09, ost: 0.055, riser: 0.09, baseline: 0.38, octave: 12 },
  // Two fires remembered at once: Tidegarden's open colour carries a quiet
  // origin interval, then recedes cleanly into free-play ecology.
  'ch9-hearth': { chord: [0, 4, 7, 10, 14], progression: [[0, 4, 7, 10], [7, 10, 14], [0, 7, 12]], melody: { scale: [0, 2, 4, 7, 9, 10, 12, 14], density: 0.26 }, pattern: [0, null, null, null, 7, null, null, null], tempo: 56, wave: 'triangle', pad: 0.17, sub: 0.08, ost: 0.024, riser: 0.05, baseline: 0.28, octave: 12 }
};

export type Chapter7ReconstructionScoreVariant =
  | 'diagnosis'
  | 'bench'
  | 'frame'
  | 'hull'
  | 'lift'
  | 'hover'
  | 'route'
  | 'calibration';

export type Chapter7BoardingScoreVariant =
  | 'outside'
  | 'hatch'
  | 'vehicle-owner'
  | 'cockpit';

export type Chapter10ScoreVariant =
  | 'cold-settled'
  | 'fault-ledger'
  | 'refused'
  | 'crossing-back'
  | 'relay-ask'
  | 'relay-answer'
  | 'bearing-claimed'
  | 'transit-hold'
  | 'seam-ebb'
  | 'station-resolved';

/** One owning-beat table for live selection and the 62-entry authored census. */
export const CH10_VARIANT_BEAT: Readonly<Record<Chapter10ScoreVariant, StoryBeat>> = Object.freeze({
  'cold-settled': 'ch10-cold', 'fault-ledger': 'ch10-cold', refused: 'ch10-cold',
  'crossing-back': 'ch10-ask', 'relay-ask': 'ch10-ask', 'relay-answer': 'ch10-ask', 'bearing-claimed': 'ch10-ask',
  'transit-hold': 'ch10-transit', 'seam-ebb': 'ch10-transit', 'station-resolved': 'ch10-transit'
});

/** Existing authored physical sequences plus the signed composed timelines.
 * The early fixed/track/raster clocks and all player controls remain unchanged. */
export const COMPOSED_TIMELINE_BEATS: ReadonlySet<StoryBeat> = new Set([
  'descent', 'ch1-lift', 'a1-ramp', 'a2-awakening', 'a3-dawn', 'a4-exhale', 'ch5-maw'
]);

/**
 * Chapter 10. Additive only: the frozen MOODS schema above is untouched, and
 * every entry here is authored relative to the beats' published tonics exactly
 * as the ch8/ch9 moods are. NO STATION KEY EXISTS THIS RUN — the station is
 * deliberately the first destination the score refuses a tonal home, and its
 * only pitch presence is the carrier (the 17, a suspended-fourth/eleventh
 * colour of both home keys and a chord tone of neither).
 *
 * The chapter's foreignness is three reuses and no inventions: the square wave
 * (institution since ch1), the carrier pitch, and machine time — REGULATION
 * figures carry uniform velocity, zero drop probability and fixed articulation
 * against the world's seeded velocity/drop/phrase variation. (The engine has no
 * timing humanize; "dead on the grid" was never the distinguisher it claimed.)
 */
const CH10_MOODS: Readonly<Record<Chapter10ScoreVariant, ScoreMood>> = {
  // ch9-hearth's DNA with the melody cut and the FLOOR DROPPED A WHOLE STEP:
  // the same home over the wrong floor. A whole step, not a semitone — the
  // semitone is the shipped dread interval and this chapter has no antagonist.
  'cold-settled': mood({
    chord: [-2, 4, 7, 10, 14],
    progression: [[-2, 4, 7, 10], [-2, 7, 12]],
    melody: { scale: [0, 2, 4, 7, 9, 10, 12, 14], density: 0.12 },
    pattern: [0, null, null, null, 7, null, null, null],
    tempo: 56, wave: 'triangle', pad: 0.17, sub: 0.08, ost: 0.024, riser: 0.05,
    baseline: 0.24, octave: 12
  }),
  // One quantized square fifth under the triangle for the caption's breath.
  'fault-ledger': mood({
    chord: [-2, 4, 7, 10, 14],
    progression: [[-2, 4, 7, 10], [-2, 7, 12]],
    melody: { scale: [0, 7, 12], density: 0.1 },
    pattern: [0, null, null, null, 7, null, null, null],
    tempo: 56, wave: 'square', pad: 0.15, sub: 0.09, ost: 0.03, riser: 0.05,
    baseline: 0.3, octave: 24
  }),
  // PATTERN NOT HELD, realized as the pattern literally not held: the melody
  // voice does not return for the remainder of ch10-cold, and the beat exits
  // quiet. Refusal as subtraction, under the ch4-comply law.
  refused: mood({
    chord: [-2, 7, 12],
    pattern: [0, null, null, null, null, null, null, null],
    tempo: 56, wave: 'triangle', pad: 0.13, sub: 0.08, ost: 0.012, riser: 0.03,
    baseline: 0.22, octave: 12
  }),
  // ch8-crossing DNA at 68, mirrored memory, colder, and the dropped step still
  // riding in the sub the whole way: the reason for the trip travels with her.
  'crossing-back': mood({
    chord: [-2, 3, 7, 9, 14],
    progression: [[-2, 4, 7, 10], [0, 3, 7, 9], [5, 9, 12, 16]],
    melody: { scale: [0, 2, 3, 5, 7, 9, 10, 12, 14], density: 0.2 },
    pattern: [0, null, 7, null, 9, null, 14, null],
    tempo: 68, wave: 'sawtooth', pad: 0.17, sub: 0.12, ost: 0.03, riser: 0.08,
    baseline: 0.34, octave: 12
  }),
  // THE QUESTION, and it must have a body. Two bars of quantized square fifth
  // on the REGULATION cell, machine-punctual under the world's own pad: the ask
  // is a sounding phrase, not a caption with a timbre change behind it. Without
  // this the answer had nothing to interrupt, and "the answer came back before
  // the asking finished" could only bind to text that had visibly finished.
  'relay-ask': mood({
    chord: [-2, 3, 7, 9, 14],
    progression: [[0, 7], [0, 7, 12]],
    melody: { scale: [0, 7, 12], density: 0.12 },
    pattern: [0, null, 7, null, 0, null, 7, null],
    tempo: 68, wave: 'square', pad: 0.15, sub: 0.12, ost: 0.03, riser: 0.06,
    baseline: 0.34, octave: 24
  }),
  // The pillar spend. Same level, same timbre family, same register, zero
  // dynamic accent — the answer is a VOICE ARRIVING inside the question, not a
  // replacement for it: the [0, 7] cell keeps sounding straight through the
  // variant boundary and the final tone hangs and becomes the carrier.
  'relay-answer': mood({
    chord: [-2, 3, 7, 9, 17],
    progression: [[0, 7], [0, 7, 17]],
    melody: { scale: [0, 7, 12, 17], density: 0.14 },
    pattern: [0, null, 7, null, 17, null, null, null],
    tempo: 68, wave: 'square', pad: 0.15, sub: 0.12, ost: 0.03, riser: 0.06,
    baseline: 0.36, octave: 24
  }),
  // The pad re-voices AROUND the carrier: commitment sounds as the music making
  // room, never as impact. Nothing anticipates the claim, because the story
  // waits at it indefinitely and a build would convert the rite into a timer.
  'bearing-claimed': mood({
    chord: [0, 5, 9, 17],
    progression: [[0, 5, 9, 17], [0, 7, 9, 17]],
    melody: { scale: [0, 2, 5, 7, 9, 12, 17], density: 0.16 },
    pattern: [0, null, null, 9, null, null, 17, null],
    tempo: 68, wave: 'triangle', pad: 0.18, sub: 0.11, ost: 0.028, riser: 0.06,
    baseline: 0.38, octave: 12
  }),
  // ch8 flight DNA with the carrier held. No destination modulation exists,
  // because the station has no key; as the thing gets bigger, the texture thins.
  'transit-hold': mood({
    chord: [0, 5, 9, 17],
    progression: [[0, 5, 9, 17], [2, 7, 9, 17]],
    melody: { scale: [0, 2, 5, 7, 9, 12, 17], density: 0.22 },
    pattern: [0, null, 9, null, 17, null, 9, null],
    tempo: 68, wave: 'sawtooth', pad: 0.16, sub: 0.13, ost: 0.05, riser: 0.04,
    baseline: 0.42, octave: 12
  }),
  // A line with no body is music with no pulse: percussion and ostinato ebb to
  // zero, leaving pad, sub and carrier. Acknowledgment by subtraction.
  'seam-ebb': mood({
    chord: [0, 9, 17],
    pattern: [0, null, null, null, null, null, null, null],
    tempo: 68, wave: 'sawtooth', pad: 0.18, sub: 0.13, ost: 0, riser: 0.04,
    baseline: 0.36, octave: 12
  }),
  // A second voice doubles the carrier at the octave over ONE quotation of the
  // hearth's closing cell: both fires in the voicing, a third light above. No
  // mediant, no braam, no lead entrance — awe says vast, and this is a source.
  'station-resolved': mood({
    chord: [0, 7, 12, 17, 29],
    progression: [[0, 7, 12], [0, 9, 17, 29]],
    melody: { scale: [0, 7, 12, 17], density: 0.1 },
    pattern: [0, null, null, null, 17, null, null, null],
    // The destination may not out-measure the awakening: pad and sub sit
    // strictly under a4-exhale's (0.18 / 0.10) on the steady window, the riser
    // stays on the beat's flat rail, and the ostinato the seam ebbed away does
    // NOT return — the resolve's octave double is pad-voiced and needs no pulse.
    tempo: 68, wave: 'triangle', pad: 0.17, sub: 0.10, ost: 0, riser: 0.04,
    baseline: 0.44, octave: 12
  })
};

/**
 * The carrier tone, as a scale degree: a suspended-fourth/eleventh colour of
 * both home keys and a chord tone of NEITHER. Pitch-class 5 is scale-legal in
 * both home modes (Mixolydian and Dorian each carry the fourth) and is voiced
 * in neither home chord — which the ninth it replaced was not, being a member
 * of ch9-hearth AND ch8-crossing and therefore not new information at birth. A
 * sus-4 hanging against the relay's own fifth is an unresolved question colour:
 * an address without an invitation.
 *
 * It is born at the relay answer as that figure's unreleased final tone and is
 * present in every variant from there to the resolve, where a second voice
 * doubles it at the octave (degree 29). Because variant selection is a pure
 * resolver over durable milestones, a mid-transit reload re-establishes the
 * same voicing through the same mood boundary.
 */
export const CH10_CARRIER_DEGREE = 17;
/** The octave double at the resolve — the pitch confirmed as sounding elsewhere. */
export const CH10_CARRIER_OCTAVE_DEGREE = CH10_CARRIER_DEGREE + 12;

/**
 * Post-answer variants carry the carrier by construction; `carrierAlive` lets a
 * caller state that fact explicitly rather than inferring it from the voicing.
 * A variant that is not supposed to hold the carrier yet cannot be selected
 * before the answer, so this never has to subtract one.
 */
export function getChapter10ScoreMood(
  variant: Chapter10ScoreVariant,
  carrierAlive = false
): ScoreMood {
  const base = cloneMood(CH10_MOODS[variant]);
  if (carrierAlive || variant !== 'station-resolved') return base;
  // The octave double is the carrier's own confirmation and may never sound
  // without it. Filtering `chord` ALONE did not achieve that, and the control
  // render proved it: this mood publishes a `progression`, the engine plays
  // `progression[chordIndex]` on every bar boundary and falls back to `chord`
  // only when there is no progression — so degree 29 kept sounding out of
  // [0, 9, 17, 29] in BOTH carrier states and the "illegal" control was
  // sample-identical to the real resolve. (The pad also voices only
  // SCORE_PAD_VOICE_COUNT tones, so the trailing 29 of the five-tone static
  // chord was never voiced anyway — the filter was removing a degree nothing
  // played.) Both surfaces are filtered here, because the audible one is the
  // progression.
  const withoutOctaveDouble = (degrees: readonly number[]): number[] =>
    degrees.filter(degree => degree !== CH10_CARRIER_OCTAVE_DEGREE);
  return {
    ...base,
    chord: withoutOctaveDouble(base.chord),
    progression: base.progression?.map(withoutOctaveDouble)
  };
}

/**
 * Composite steady states: every later reconstruction variant retains the
 * previously earned pad/sub/ostinato relationship. Changing variant starts a
 * local phrase through the shipped setScoreMood boundary; no hit is involved.
 */
const CH7_RECONSTRUCTION_MOODS: Readonly<Record<Chapter7ReconstructionScoreVariant, ScoreMood>> = {
  diagnosis: mood({
    chord: [0, 7, 14],
    pattern: [0, null, null, null, null, null, 7, null],
    tempo: 64, wave: 'triangle', pad: 0.04, sub: 0.06, ost: 0.015, riser: 0.04,
    baseline: 0.26, octave: 12
  }),
  bench: mood({
    chord: [0, 7, 14],
    pattern: [0, null, null, null, 7, null, null, null],
    tempo: 64, wave: 'triangle', pad: 0.05, sub: 0.07, ost: 0.028, riser: 0.04,
    baseline: 0.3, octave: 12
  }),
  frame: mood({
    chord: [0, 7, 14],
    pattern: [0, null, 7, null, 0, null, 14, null],
    tempo: 64, wave: 'triangle', pad: 0.06, sub: 0.1, ost: 0.045, riser: 0.05,
    baseline: 0.36, octave: 12
  }),
  hull: mood({
    chord: [0, 5, 9, 14],
    melody: { scale: [0, 2, 3, 5, 7, 9, 10, 12, 14], density: 0.12 },
    pattern: [0, null, 7, null, 0, null, 14, null],
    tempo: 64, wave: 'triangle', pad: 0.12, sub: 0.1, ost: 0.045, riser: 0.07,
    baseline: 0.42, octave: 12
  }),
  lift: mood({
    chord: [0, 7, 9, 14],
    melody: { scale: [0, 2, 3, 5, 7, 9, 10, 12, 14], density: 0.18 },
    pattern: [0, null, 7, null, 0, null, 7, null],
    tempo: 64, wave: 'triangle', pad: 0.13, sub: 0.14, ost: 0.055, riser: 0.09,
    baseline: 0.48, octave: 12
  }),
  hover: mood({
    chord: [0, 7, 9, 14],
    melody: { scale: [0, 2, 3, 5, 7, 9, 10, 12, 14], density: 0.18 },
    pattern: [0, 7, 0, 7, 9, 7, 14, 7],
    tempo: 64, wave: 'triangle', pad: 0.13, sub: 0.14, ost: 0.055, riser: 0.09,
    baseline: 0.5, octave: 12
  }),
  route: mood({
    chord: [0, 7, 9, 14],
    progression: [[0, 7, 9, 14], [0, 5, 9, 14]],
    melody: { scale: [0, 2, 3, 5, 7, 9, 10, 12, 14], density: 0.52 },
    pattern: [0, null, 7, 9, 14, null, 7, null],
    tempo: 64, wave: 'triangle', pad: 0.15, sub: 0.14, ost: 0.06, riser: 0.18,
    baseline: 0.56, octave: 12
  }),
  calibration: mood({
    chord: [0, 7, 9, 14],
    // The second two-bar field keeps every repaired layer but leaves the
    // calibration image on an added semitone rather than claiming arrival.
    progression: [[0, 7, 9, 14], [0, 5, 9, 15]],
    melody: { scale: [0, 2, 3, 5, 7, 9, 10, 12, 14, 15], density: 0.46 },
    pattern: [0, null, 7, 9, 14, null, 9, null],
    tempo: 64, wave: 'triangle', pad: 0.15, sub: 0.14, ost: 0.06, riser: 0.18,
    baseline: 0.56, octave: 12
  })
};

const CH7_BOARDING_MOODS: Readonly<Record<Chapter7BoardingScoreVariant, ScoreMood>> = {
  outside: mood({
    chord: [0, 7, 9, 14],
    progression: [[0, 7, 9, 14], [0, 5, 9, 14]],
    melody: { scale: [0, 2, 3, 5, 7, 9, 10, 12, 14], density: 0.52 },
    pattern: [0, null, 7, 9, 14, null, 7, null],
    tempo: 64, wave: 'triangle', pad: 0.15, sub: 0.14, ost: 0.06, riser: 0.18,
    baseline: 0.56, octave: 12
  }),
  hatch: mood({
    chord: [0, 7, 9, 14],
    melody: { scale: [0, 2, 3, 5, 7, 9, 10, 12, 14], density: 0.06 },
    pattern: [0, null, null, null, 7, null, null, null],
    tempo: 64, wave: 'triangle', pad: 0.11, sub: 0.14, ost: 0.05, riser: 0.1,
    baseline: 0.42, octave: 12
  }),
  'vehicle-owner': mood({
    chord: [0, 7, 14],
    pattern: [0, null, null, null, 7, null, null, null],
    tempo: 64, wave: 'triangle', pad: 0.075, sub: 0.14, ost: 0.045, riser: 0.04,
    baseline: 0.35, octave: 12
  }),
  cockpit: mood({
    chord: [0, 7, 9, 14],
    pattern: [0, 7, null, 7, 9, 7, null, 7],
    tempo: 64, wave: 'triangle', pad: 0.1, sub: 0.14, ost: 0.055, riser: 0.06,
    baseline: 0.42, octave: 12
  })
};

/**
 * Read-only inventory of every authored mood entry (the MOODS table plus the
 * chapter 7 and chapter 10 variant tables), for the render-identity harness.
 * Variants render under their owning beat through setStoryScoreMoodOverride —
 * the same path they take live — so a hash of each entry is a hash of what the
 * instrument plays for it. Defensive copies; nothing here can mutate a table.
 */
export interface StoryScoreMoodInventoryEntry {
  /** Stable name: the beat id, or `<beat>/<variant>` for a variant mood. */
  name: string;
  beat: StoryBeat;
  variant: string | null;
  mood: ScoreMood;
  /** Historical identity keys remain available for original literal-hash comparisons. */
  legacyName?: string;
  /** Full authored Ch10 entries use the carrier-present form; live false/true controls are separate fixtures. */
  carrierAlive?: boolean;
}

export function listStoryScoreMoodInventory(): StoryScoreMoodInventoryEntry[] {
  const entries: StoryScoreMoodInventoryEntry[] = [];
  for (const beat of Object.keys(MOODS) as StoryBeat[]) {
    entries.push({ name: beat, beat, variant: null, mood: cloneMood(MOODS[beat]!) });
  }
  for (const variant of Object.keys(CH7_RECONSTRUCTION_MOODS) as Chapter7ReconstructionScoreVariant[]) {
    entries.push({
      name: `ch7-reconstruct/${variant}`,
      beat: 'ch7-reconstruct',
      variant,
      mood: getChapter7ReconstructionScoreMood(variant)
    });
  }
  for (const variant of Object.keys(CH7_BOARDING_MOODS) as Chapter7BoardingScoreVariant[]) {
    entries.push({
      name: `ch7-board/${variant}`,
      beat: 'ch7-board',
      variant,
      mood: getChapter7BoardingScoreMood(variant)
    });
  }
  for (const variant of Object.keys(CH10_MOODS) as Chapter10ScoreVariant[]) {
    // The resolve renders its full literal (carrier alive) so the inventory
    // hashes what the authored entry says, not the pre-answer filtered form.
    entries.push({
      name: `${CH10_VARIANT_BEAT[variant]}/${variant}`,
      legacyName: `ch10-ask/${variant}`,
      beat: CH10_VARIANT_BEAT[variant],
      variant,
      carrierAlive: true,
      mood: getChapter10ScoreMood(variant, true)
    });
  }
  return entries;
}


// --- Stage 3 (audio-10x): the ten composed-sync anchors and their caps ---------------------------
//
// Contract scene-contract.json draft-v3 syncAnchors / score.cues. Every row is a
// scene-contract anchor id, never a timestamp: the kind, the written quantum,
// the cap ({ms} literal or {beats: 1} = one published beat of the beat's own
// mood, an EXPRESSION so a tempo retune moves the cap with the beat), whether
// the onset may lead the desired time, and the lowest rung the degrade chain
// may reach. `HIT_CAP_MS` is the derived table the scheduler and the fit test
// read. Sites are recorded for the audit; the live line numbers move.

export type StoryHitAnchorId =
  | 'anc.track.unbolt'
  | 'anc.a1.color-stabilizes'
  | 'anc.a2.feed-wall-falls'
  | 'anc.a2.hand-back'
  | 'anc.descent.impact'
  | 'anc.lift.perspective-issued'
  | 'anc.a3.first-blade'
  | 'anc.a3.material-lands'
  | 'anc.maw.repair-answer'
  | 'anc.a4.life-front';

export type StoryHitCap = { readonly ms: number } | { readonly beats: 1 };

export interface StoryHitAnchor {
  /** The beat whose mood tempo is the grid ("beat means the mood's own tempo"). */
  beat: StoryBeat;
  site: string;
  kind: ScheduleHitKind;
  quantize: HitQuantize;
  cap: StoryHitCap;
  /** ±cap: the nearer earlier quantum is admitted (the lift ruling). */
  mayLead?: boolean;
  /** Lowest rung the degrade chain may reach; 'beat' rows never degrade to the step. */
  floorRung?: HitQuantumRung;
  /** The bundle's SFX member, if any (C6: forward-scheduled to the music onset). */
  sfx: 'storyAwaken' | 'shipCrash' | 'storyGlitch' | null;
}

export const STORY_HIT_ANCHORS: Readonly<Record<StoryHitAnchorId, StoryHitAnchor>> = Object.freeze({
  'anc.track.unbolt': { beat: 'ch1-track', site: 'storyDirector.ts ch1-track entry', kind: 'bloom', quantize: 'beat', cap: { ms: 450 }, sfx: 'storyAwaken' },
  'anc.a1.color-stabilizes': { beat: 'a1-ramp', site: 'storyDirector.ts tickA1Ramp landing', kind: 'bloom', quantize: 'beat', cap: { ms: 400 }, sfx: null },
  'anc.a2.feed-wall-falls': { beat: 'a2-awakening', site: 'storyDirector.ts tickA2 liberation', kind: 'braam', quantize: 'beat', cap: { beats: 1 }, floorRung: 'beat', sfx: 'storyAwaken' },
  'anc.a2.hand-back': { beat: 'a2-awakening', site: 'storyDirector.ts tickA2 handoff', kind: 'bloom', quantize: 'beat', cap: { beats: 1 }, floorRung: 'beat', sfx: null },
  'anc.descent.impact': { beat: 'descent', site: 'storyDirector.ts tickDescent impact', kind: 'impact', quantize: 'beat', cap: { ms: 400 }, sfx: 'shipCrash' },
  'anc.lift.perspective-issued': { beat: 'ch1-lift', site: 'storyDirector.ts tickCh1Lift snap', kind: 'braam', quantize: 'beat', cap: { ms: 400 }, mayLead: true, sfx: 'storyGlitch' },
  'anc.a3.first-blade': { beat: 'a3-dawn', site: 'storyDirector.ts tickA3 wave start', kind: 'bloom', quantize: 'bar', cap: { ms: 2750 }, sfx: null },
  'anc.a3.material-lands': { beat: 'a3-dawn', site: 'storyDirector.ts tickA3 landing', kind: 'bloom', quantize: 'bar', cap: { ms: 2750 }, sfx: null },
  'anc.maw.repair-answer': { beat: 'ch5-maw', site: 'signedSceneAvRuntime.ts applyScore', kind: 'bloom', quantize: 'beat', cap: { ms: 450 }, sfx: null },
  'anc.a4.life-front': { beat: 'a4-exhale', site: 'emergentStoryDirector.ts tickA4', kind: 'bloom', quantize: 'beat', cap: { beats: 1 }, floorRung: 'beat', sfx: 'storyAwaken' }
});

export const STORY_HIT_ANCHOR_IDS = Object.keys(STORY_HIT_ANCHORS) as StoryHitAnchorId[];

/** One published beat at `tempo`, ms. */
export const beatMs = (tempo: number): number => 60000 / tempo;

/** The mood tempo an anchor's grid runs at (the beat's authored MOODS entry). */
export function storyHitAnchorTempo(id: StoryHitAnchorId): number {
  const mood = MOODS[STORY_HIT_ANCHORS[id].beat];
  if (!mood) throw new Error(`anchor ${id}: beat ${STORY_HIT_ANCHORS[id].beat} has no MOODS entry`);
  return mood.tempo;
}

/** The cap table, ms, keyed by anchor id — {beats: 1} rows resolve against the live MOODS tempo. */
export const HIT_CAP_MS: Readonly<Record<StoryHitAnchorId, number>> = Object.freeze(
  Object.fromEntries(
    STORY_HIT_ANCHOR_IDS.map((id) => {
      const cap = STORY_HIT_ANCHORS[id].cap;
      return [id, 'ms' in cap ? cap.ms : beatMs(storyHitAnchorTempo(id)) * cap.beats];
    })
  ) as Record<StoryHitAnchorId, number>
);

// --- Stage 3: pitch-locked tonic chains (contract sc.chain.tonic-authority) ------------------------
//
// One harmonic truth across beats: a chain reads its tonic ONCE at entry and
// holds it until the chain exits to bed-led play, so interval identity inside
// the chain is exact. Derivation, frozen by the contract:
//   prologue    — planetHomeRoot(seed) UNCONDITIONALLY (the deployment notice
//                 sounds in the planet's key before the planet is seen; a
//                 `?story=` jump cannot break the plant, nothing but the seed
//                 is consulted);
//   colour, dusk, vigil, reconstruct — the live bed's tonic if the bed leads and
//                 published within TONIC_LIVE_WINDOW_BARS, else planetHomeRoot(seed);
//   ch10        — 'absolute', offset 0: the literal MOODS roots untransposed. The
//                 station has no key; the seed is NOT consulted.
// Unchained beats hold the current tonic (no jump) and adopt the bed's centre
// when the bed leads at entry. A mid-chain reload has no live bed and re-derives
// planetHomeRoot(seed): interval identity is preserved, absolute pitch across a
// reload inside a chain is (per the intent) not protected. Zero save fields.

export type TonicChainId = 'prologue' | 'colour' | 'dusk' | 'vigil' | 'reconstruct' | 'ch10';
export type TonicChainPolicy = 'seed' | 'live' | 'absolute';

export const MOOD_TONIC_CHAINS: Readonly<Partial<Record<StoryBeat, TonicChainId>>> = Object.freeze({
  crawl: 'prologue', manifest: 'prologue', voyage: 'prologue', deflect: 'prologue', crash: 'prologue',
  descent: 'prologue', 'ch1-fixed': 'prologue', 'ch1-track': 'prologue', 'ch1-raster': 'prologue',
  'ch1-depth': 'prologue', 'ch1-nav': 'prologue', 'ch1-iso': 'prologue', 'ch1-lift': 'prologue',
  'ch1-anomaly': 'prologue', 'a1-ramp': 'prologue',
  'ch2-color': 'colour', 'ch2-approach': 'colour', 'a2-awakening': 'colour',
  'ch3-dusk': 'dusk', 'ch3-await-rest': 'dusk', 'a3-dawn': 'dusk',
  'ch4-vigil': 'vigil', 'ch4-arrival': 'vigil', 'ch4-audit': 'vigil', 'ch4-comply': 'vigil', 'ch4-defy': 'vigil', 'a4-exhale': 'vigil',
  'ch7-reconstruct': 'reconstruct', 'ch7-board': 'reconstruct',
  'ch10-cold': 'ch10', 'ch10-ask': 'ch10', 'ch10-transit': 'ch10'
});

export const TONIC_CHAIN_POLICY: Readonly<Record<TonicChainId, TonicChainPolicy>> = Object.freeze({
  prologue: 'seed',
  colour: 'live',
  dusk: 'live',
  vigil: 'live',
  reconstruct: 'live',
  ch10: 'absolute'
});

/** The ch10 chain's frozen offset: literal roots, untransposed. */
export const CH10_TONIC_OFFSET_SEMIS = 0;

// --- Stage 3: MOODS-as-constraints voicing policy per entry ----------------------------------------
//
// Default policy for every entry not listed. Commit A of the migration ships
// 'literal' (render-hash identical to the shipped stacks); commit B flips it to
// 'brain'. The overrides are canon regardless of the default: chords written as
// subtraction may never be re-voiced fuller, a4's one-member-at-a-time opening
// keeps its order, and every ch10 mood (the station has no key and the carrier
// is a fixed pitch) renders its literal.
export const MOOD_DEFAULT_VOICING: MoodVoicingPolicy = 'brain';

export const MOOD_VOICING_OVERRIDES: Readonly<Partial<Record<StoryBeat, MoodVoicingPolicy>>> = Object.freeze({
  'ch4-comply': 'subtractive',
  'a4-exhale': 'ordered',
  'ch10-cold': 'literal',
  'ch10-ask': 'literal',
  'ch10-transit': 'literal'
});

/** ch10 variant moods that are subtractions (the ch4-comply law); they render literal under the ch10 beat rule. */
export const CH10_SUBTRACTIVE_VARIANTS: ReadonlySet<Chapter10ScoreVariant> = new Set(['refused', 'seam-ebb']);

export function resolveMoodVoicingPolicy(beat: StoryBeat): MoodVoicingPolicy {
  return MOOD_VOICING_OVERRIDES[beat] ?? MOOD_DEFAULT_VOICING;
}

/**
 * The carrier as a fixed frequency: a pure function of the shipped
 * ch10-ask/relay-answer entry (its unreleased final tone, CH10_CARRIER_DEGREE)
 * under the ch10 chain's absolute offset. Survives every variant, beat boundary
 * and mid-transit reload with zero save fields because nothing but the table
 * is consulted.
 */
export const CH10_CARRIER_HZ = SCORE_ROOT_HZ * Math.pow(2, (CH10_CARRIER_DEGREE + CH10_TONIC_OFFSET_SEMIS) / 12);

interface HeldTonicChain {
  id: TonicChainId;
  tonicSemis: number;
}
let heldChain: HeldTonicChain | null = null;
/** The tonic the last beat was voiced under (unchained beats hold it). */
let currentTonicSemis = 0;

/** The chain currently held (null in bed-led / unchained play). Read-only inspection. */
export function getHeldTonicChain(): Readonly<HeldTonicChain> | null {
  return heldChain ? { ...heldChain } : null;
}

/** Derive a chain's tonic at entry per TONIC_CHAIN_POLICY (pure over the engine's live reads). */
export function deriveChainTonic(chain: TonicChainId): number {
  switch (TONIC_CHAIN_POLICY[chain]) {
    case 'absolute':
      return CH10_TONIC_OFFSET_SEMIS;
    case 'seed':
      return resolveScorePlanetHomeRoot();
    case 'live':
      return readLiveBedTonic() ?? resolveScorePlanetHomeRoot();
  }
}

/**
 * Resolve the tonic a beat is voiced under and update the held chain. Pure in
 * its decision given (heldChain, chain membership, live reads); the engine reads
 * are the only inputs that are not the beat id.
 */
export function resolveBeatTonic(beat: StoryBeat): { tonicSemis: number; chain: TonicChainId | null; cancelledPending: number } {
  const chain = MOOD_TONIC_CHAINS[beat] ?? null;
  let cancelled = 0;
  let tonic: number;
  if (chain) {
    if (heldChain?.id === chain) {
      tonic = heldChain.tonicSemis; // member → member keeps the held tonic and its pending hits
    } else {
      if (heldChain) cancelled = cancelPendingScheduledHits(); // chain → chain: the old chain exits
      tonic = deriveChainTonic(chain);
      heldChain = { id: chain, tonicSemis: tonic };
    }
  } else {
    if (heldChain) {
      cancelled = cancelPendingScheduledHits(); // chain exit to bed-led / unchained play
      heldChain = null;
    }
    tonic = readLiveBedTonic() ?? currentTonicSemis;
  }
  currentTonicSemis = tonic;
  return { tonicSemis: tonic, chain, cancelledPending: cancelled };
}

// --- Stage 3: the story-side arming façade (bundleAt derivation, C6) --------------------------------
//
// Directors arm a bundle ONCE at the ruling's arming tick and receive the
// beat-clock target every presentation member reads through its `>=` guard.
// State (milestones, advanceToBeat, commits, receipts) never waits — only the
// presentation bundle chases. Cinematography's derivation, verbatim:
//   bundleAt = beatClock + (audioTime − armedAt) + latencyComp
//   latencyComp = clamp(device + LATENCY_COMP_MUSIC_PATH_S, 0, LATENCY_COMP_MAX_S)
//   device = ctx.outputLatency if finite and > 0, else ctx.baseLatency if finite, else 0
// sampled once at arming and applied identically to every image member. A null
// schedule (no transport) keeps today's behaviour exactly: the target is the
// desired time and `fireStoryHitFallback` plays the reflex `scoreHit`.
// C6 (amended): the bundle's SFX member is forward-scheduled to
// audioTime + LATENCY_COMP_MUSIC_VS_SFX_S so its audible onset coincides with
// the audible music onset the image targets; unbundled playSfx is untouched.

export interface StoryBundleLatency {
  deviceS: number;
  /** LATENCY_COMP_MUSIC_PATH_S at the selected sample-rate key (measured table, never derived). */
  musicPathS: number;
  /** LATENCY_COMP_MUSIC_VS_SFX_S at the selected key — the SFX member's forward offset. */
  musicVsSfxS: number;
  totalS: number;
  /** The pinned table key chosen for ctx.sampleRate (nearest), named in the capture overlay. */
  sampleRateKey: number;
  contextSampleRate: number | null;
}

export interface StoryHitArm {
  anchorId: StoryHitAnchorId;
  schedule: HitSchedule | null;
  /** Beat-clock delay from the arming tick to the presentation bundle. */
  bundleDelayS: number;
  /** Beat-clock delay after which the SFX member should be POSTED (it is scheduled to `sfxAudioTime`). */
  sfxArmDelayS: number;
  /** Exact audio-clock start for the SFX member (null = fallback, fire at the bundle tick). */
  sfxAudioTime: number | null;
  /**
   * The audible music onset on the AUDIO clock (audioTime + latencyComp), fixed at
   * arming. The beat clock can only lose time on a dropped frame, so a guard that
   * also watches this target fires no earlier than the beat-clock guard would on a
   * perfect frame loop and no later than the onset itself under a hitch.
   */
  audibleAudioTime: number | null;
  latency: StoryBundleLatency;
  /** True when no transport answered and the site keeps its shipped immediate timing. */
  fallback: boolean;
  fitsCap: boolean;
}

export interface StoryBundleTraceEntry {
  seq: number;
  anchorId: StoryHitAnchorId;
  beat: StoryBeat | null;
  armedBeatClock: number;
  desiredDelayS: number;
  notBeforeDelayS: number | null;
  bundleAt: number;
  arm: StoryHitArm;
  perfNow: number;
  schedulingArmAt: { beatClock: number; perfNow: number; audioTime: number | null };
  /** Actual causal state events; prearming a future timeline is never a commit. */
  authoredCommitAt: { beatClock: number; perfNow: number; audioTime: number | null } | null;
  authoredCommits: { beatClock: number; perfNow: number; audioTime: number | null; cause: 'immediate' | 'timeline'; members: readonly string[] }[];
  /** Historical alias for the first authored commit, retained for old evidence readers. */
  stateAt: { beatClock: number; perfNow: number } | null;
  fired: { beatClock: number; perfNow: number; audioTime: number | null } | null;
  sfxPosted: { beatClock: number; perfNow: number; audioTime: number | null; atAudioTime: number | null } | null;
}
const BUNDLE_TRACE_MAX = 32;
let bundleTrace: StoryBundleTraceEntry[] = [];
let bundleTraceSeq = 0;

export function resolveBundleLatency(ctx: { outputLatency?: number; baseLatency?: number; sampleRate?: number } | null): StoryBundleLatency {
  const out = ctx?.outputLatency;
  const base = ctx?.baseLatency;
  const deviceS = Number.isFinite(out) && (out as number) > 0 ? (out as number) : Number.isFinite(base) ? (base as number) : 0;
  const contextSampleRate = Number.isFinite(ctx?.sampleRate) ? (ctx!.sampleRate as number) : null;
  const tail = tailLatencyForSampleRate(contextSampleRate ?? 44100);
  const totalS = Math.min(LATENCY_COMP_MAX_S, Math.max(0, deviceS + tail.musicPathS));
  return {
    deviceS,
    musicPathS: tail.musicPathS,
    musicVsSfxS: tail.musicVsSfxS,
    totalS,
    sampleRateKey: tail.pinnedRate,
    contextSampleRate
  };
}

export interface ArmStoryHitOptions {
  /** The director's beat clock at the arming tick. */
  beatClock: number;
  /** Desired onset, seconds after the arming tick (the timeline constant; default 0). */
  desiredDelayS?: number;
  /** Hard floor, seconds after the arming tick (the a2 HUD-death / a3 caption holds). */
  notBeforeDelayS?: number;
}

/**
 * Arm one contracted hit. Returns the timing the site's presentation bundle
 * chases; the hit itself is already scheduled on the grid (or, with no
 * transport, left for `fireStoryHitFallback` at the bundle tick).
 */
export function armStoryHit(anchorId: StoryHitAnchorId, options: ArmStoryHitOptions): StoryHitArm {
  const row = STORY_HIT_ANCHORS[anchorId];
  const desiredDelayS = Math.max(0, options.desiredDelayS ?? 0);
  const ctx = peekAudioContext();
  const now = ctx?.currentTime ?? 0;
  const latency = resolveBundleLatency(ctx);
  const schedule = scheduleHit(row.kind, row.quantize, {
    anchorId,
    desired: now + desiredDelayS,
    notBefore: options.notBeforeDelayS != null ? now + Math.max(0, options.notBeforeDelayS) : undefined,
    capMs: HIT_CAP_MS[anchorId],
    mayLead: row.mayLead,
    floorRung: row.floorRung
  });
  let arm: StoryHitArm;
  if (!schedule) {
    noteImmediateHit(row.kind, anchorId);
    arm = {
      anchorId, schedule: null, bundleDelayS: desiredDelayS, sfxArmDelayS: desiredDelayS, sfxAudioTime: null,
      audibleAudioTime: null, latency, fallback: true, fitsCap: true
    };
  } else {
    const bundleDelayS = (schedule.audioTime - schedule.armedAt) + latency.totalS;
    const sfxAudioTime = schedule.audioTime + latency.musicVsSfxS;
    arm = {
      anchorId, schedule, bundleDelayS,
      sfxArmDelayS: Math.max(0, bundleDelayS - latency.totalS - SFX_BUNDLE_ARM_LEAD_S),
      sfxAudioTime, audibleAudioTime: schedule.audioTime + latency.totalS, latency, fallback: false,
      fitsCap: Math.abs(schedule.slackMs) <= HIT_CAP_MS[anchorId] + 1e-6
    };
  }
  const perfNow = typeof performance !== 'undefined' ? performance.now() : 0;
  bundleTrace.push({
    seq: ++bundleTraceSeq, anchorId, beat: activeBeat, armedBeatClock: options.beatClock, desiredDelayS,
    notBeforeDelayS: options.notBeforeDelayS ?? null, bundleAt: options.beatClock + arm.bundleDelayS, arm,
    perfNow, schedulingArmAt: { beatClock: options.beatClock, perfNow, audioTime: ctx?.currentTime ?? null },
    authoredCommitAt: null, authoredCommits: [], stateAt: null, fired: null, sfxPosted: null
  });
  if (bundleTrace.length > BUNDLE_TRACE_MAX) bundleTrace.splice(0, bundleTrace.length - BUNDLE_TRACE_MAX);
  return arm;
}

/**
 * True when the audio clock has reached a bundle's fixed-at-arming audible onset
 * (false with no context or in fallback). Directors OR this with their beat-clock
 * `>=` guard: the beat clock only lags the audio clock (dropped frames), so the
 * union fires no earlier than a perfect frame loop would and never after the
 * onset by more than one frame. `leadS` shifts the target earlier (the SFX post).
 */
export function bundleAudioClockDue(audibleAudioTime: number | null, leadS = 0): boolean {
  if (audibleAudioTime == null) return false;
  const now = peekAudioContext()?.currentTime;
  return now != null && now >= audibleAudioTime - leadS;
}

/** Both fixed targets must be due. An audio clock that continues through a
 * render hitch cannot skip an authored timeline; a faster scene cannot lead
 * its sound. Any resulting lateness is measured, never hidden by retiming. */
export function bundlePresentationDue(beatClock: number, bundleAt: number, audibleAudioTime: number | null): boolean {
  return beatClock >= bundleAt && (audibleAudioTime == null || bundleAudioClockDue(audibleAudioTime));
}

/** The no-transport fallback at the bundle tick: today's reflex hit, exactly (impact = boom + braam). */
export function fireStoryHitFallback(anchorId: StoryHitAnchorId): void {
  const kind = STORY_HIT_ANCHORS[anchorId].kind;
  if (kind === 'impact') {
    scoreHit('boom');
    scoreHit('braam');
  } else {
    scoreHit(kind);
  }
}

/** Record the tick a site's state members (milestone, advanceToBeat, commit, receipt, stage) executed. */
export function noteStoryBundleState(anchorId: StoryHitAnchorId, beatClock: number, cause?: 'immediate' | 'timeline'): void {
  const entry = [...bundleTrace].reverse().find((e) => e.anchorId === anchorId);
  if (!entry) return;
  const census = STORY_BUNDLE_MEMBERS[anchorId];
  const resolvedCause = cause ?? (census.immediateState.length ? 'immediate' : 'timeline');
  const members = resolvedCause === 'immediate' ? census.immediateState : census.timelineState;
  if (members.length === 0 || entry.authoredCommits.some(event => event.cause === resolvedCause)) return;
  const at = { beatClock, perfNow: typeof performance !== 'undefined' ? performance.now() : 0, audioTime: peekAudioContext()?.currentTime ?? null };
  entry.authoredCommits.push({ ...at, cause: resolvedCause, members });
  if (!entry.authoredCommitAt) { entry.authoredCommitAt = at; entry.stateAt = at; }
}

/**
 * Bundle census (contract acceptanceCriteria[8], Chapter condition NEW 6):
 * Scheduling an authored future landing is not its causal commit. Immediate
 * state stays on the causing input; timeline state stays at the named landing.
 * Presentation and SFX retain their existing shared target.
 */
export interface StoryBundleMembers {
  armedAt: 'beat-entry' | 'first-live-tick' | 'event';
  state: readonly string[];
  immediateState: readonly string[];
  timelineState: readonly string[];
  image: readonly string[];
  sfx: readonly ('storyAwaken' | 'shipCrash' | 'storyGlitch')[];
}
function bundleMembers(armedAt: StoryBundleMembers['armedAt'], immediateState: readonly string[], timelineState: readonly string[], image: readonly string[], sfx: StoryBundleMembers['sfx']): StoryBundleMembers {
  return { armedAt, immediateState, timelineState, state: [...immediateState, ...timelineState], image, sfx };
}
export const STORY_BUNDLE_MEMBERS: Readonly<Record<StoryHitAnchorId, StoryBundleMembers>> = Object.freeze({
  'anc.track.unbolt': bundleMembers('beat-entry', ['setWorkOrder(track)'], ['markMilestone(ch1Track)', 'advanceToBeat(ch1-raster)'], ['setLensRig(ch1-track)', 'letterbox origin'], ['storyAwaken']),
  'anc.a1.color-stabilizes': bundleMembers('beat-entry', [], ['setVoxelRealityStage(color)', 'clearVoxelRealityOverrides', 'desat 0', 'glitch 0', 'markMilestone(a1)', 'advanceToBeat(ch2-color)'], [], []),
  'anc.a2.feed-wall-falls': bundleMembers('beat-entry', [], ['HUD-death work-order/violation/DPR clear'], ['FOV liberation origin', 'treatment decay origin', 'setStoryMoveScale unfreeze origin'], ['storyAwaken']),
  'anc.a2.hand-back': bundleMembers('beat-entry', [], ['setStoryLookMode(free)', 'setStoryTargetDpr(null)', 'treatment 0', 'markMilestone(a2)', 'advanceToBeat(ch3-gather)'], [], []),
  'anc.descent.impact': bundleMembers('first-live-tick', [], ['descentImpacted'], ['flash 1', 'glitch 1', 'scanRoll 0.8', 'descent curve origin'], ['shipCrash']),
  'anc.lift.perspective-issued': bundleMembers('beat-entry', [], ['liftSnapped'], ['setStoryTargetDpr(null)', 'glitch 0.8', 'scanRoll 0.5'], ['storyGlitch']),
  'anc.a3.first-blade': bundleMembers('beat-entry', [], [], ['setLifeReveal wave origin'], []),
  'anc.a3.material-lands': bundleMembers('beat-entry', [], ['setVoxelRealityStage(material)', 'clearVoxelRealityOverrides', 'clearLifeReveal', 'markMilestone(a3)', 'advanceToBeat(ch3-thirst)'], [], []),
  'anc.maw.repair-answer': bundleMembers('event', ['repair receipt', 'repair commit', 'anchor activation'], [], ['intensity step', 'answer cue rail (postFx entry effects)'], []),
  'anc.a4.life-front': bundleMembers('event', ['commitA4Alive', 'setScoreIntensity(0.8)'], [], ['caption', 'lifeProgress origin'], ['storyAwaken'])
});

/** Record the tick a bundle's presentation members fired (evidence: image-vs-onset). */
export function noteStoryBundleFired(anchorId: StoryHitAnchorId, beatClock: number): void {
  const entry = [...bundleTrace].reverse().find((e) => e.anchorId === anchorId && !e.fired);
  if (!entry) return;
  entry.fired = {
    beatClock,
    perfNow: typeof performance !== 'undefined' ? performance.now() : 0,
    audioTime: peekAudioContext()?.currentTime ?? null
  };
}

/** Record the tick a bundle's SFX member was posted and the audio time it was scheduled to. */
export function noteStoryBundleSfxPosted(anchorId: StoryHitAnchorId, beatClock: number, atAudioTime: number | null): void {
  const entry = [...bundleTrace].reverse().find((e) => e.anchorId === anchorId && !e.sfxPosted);
  if (!entry) return;
  entry.sfxPosted = {
    beatClock,
    perfNow: typeof performance !== 'undefined' ? performance.now() : 0,
    audioTime: peekAudioContext()?.currentTime ?? null,
    atAudioTime
  };
}

export function getStoryBundleTrace(): readonly StoryBundleTraceEntry[] {
  return bundleTrace;
}

if (typeof window !== 'undefined') {
  (window as unknown as { __voxBundleDiag?: () => unknown }).__voxBundleDiag = () => ({
    trace: bundleTrace,
    heldChain,
    tonic: getScoreMoodTonic(),
    caps: HIT_CAP_MS
  });
}

let activeBeat: StoryBeat | null = null;
let moodOverride: { beat: StoryBeat; mood: ScoreMood } | null = null;

// The instrument's timeline hooks, re-exported so story code keeps one import.
export { setScoreIntensity, scoreHit } from '../audio/scoreEngine.ts';

export function unlockStoryScore(): void {
  unlockScore();
}

/** Read-only harness access; the frozen MOODS schema and ownership stay here. */
export function getStoryScoreMood(beat: StoryBeat): ScoreMood | null {
  return moodOverride?.beat === beat ? moodOverride.mood : MOODS[beat] ?? null;
}

export function getChapter7ReconstructionScoreMood(
  variant: Chapter7ReconstructionScoreVariant
): ScoreMood {
  return cloneMood(CH7_RECONSTRUCTION_MOODS[variant]);
}

export function getChapter7BoardingScoreMood(
  variant: Chapter7BoardingScoreVariant
): ScoreMood {
  return cloneMood(CH7_BOARDING_MOODS[variant]);
}

/**
 * Runtime-only content override for the emergent score adapter. The adapter
 * derives this value from durable gameplay facts; this module never persists a
 * parallel score state. If the beat already leads, retune immediately.
 */
export function setStoryScoreMoodOverride(beat: StoryBeat, next: ScoreMood): void {
  moodOverride = { beat, mood: cloneMood(next) };
  if (activeBeat === beat) setScoreMood(moodOverride.mood, { voicingPolicy: resolveMoodVoicingPolicy(beat) });
}

export function clearStoryScoreMoodOverride(beat?: StoryBeat): boolean {
  if (!moodOverride || (beat && moodOverride.beat !== beat)) return false;
  const clearedBeat = moodOverride.beat;
  moodOverride = null;
  if (activeBeat === clearedBeat) {
    setScoreMood(MOODS[clearedBeat] ?? null, { voicingPolicy: resolveMoodVoicingPolicy(clearedBeat) });
  }
  return true;
}

export function hasStoryScoreMoodOverride(beat: StoryBeat): boolean {
  return moodOverride?.beat === beat;
}

/**
 * Beat entry hook: retunes the whole instrument to the beat's mood. `null`
 * (sandbox / story over) hands the instrument to the CELESTIAL IDLE BED —
 * the score never leaves, it recedes.
 */
export function setScoreBeat(beat: StoryBeat | null): void {
  activeBeat = beat;
  if (!beat) {
    // Sandbox / story over / deep-link seam: the chain drops and every pending
    // scheduled hit outside the commit grace is cancelled (contract reset-score).
    heldChain = null;
    cancelPendingScheduledHits();
    setScoreMood(null);
    return;
  }
  const { tonicSemis } = resolveBeatTonic(beat);
  setScoreMood(getStoryScoreMood(beat), { tonicSemis, voicingPolicy: resolveMoodVoicingPolicy(beat) });
}

/** Test/lifecycle seam; Story run reset may also use this before a clean replay. */
export function resetStoryScoreRuntime(): void {
  activeBeat = null;
  moodOverride = null;
  heldChain = null;
  currentTonicSemis = 0;
  bundleTrace = [];
  cancelPendingScheduledHits();
}

function mood(value: ScoreMood): ScoreMood {
  return Object.freeze(cloneMood(value));
}

function cloneMood(value: ScoreMood): ScoreMood {
  return {
    ...value,
    chord: [...value.chord],
    progression: value.progression?.map(chord => [...chord]),
    pattern: [...value.pattern],
    melody: value.melody
      ? { scale: [...value.melody.scale], density: value.melody.density }
      : undefined
  };
}
