import type { StoryBeat } from './storyState.ts';
import { setScoreMood, unlockScore, type ScoreMood } from '../audio/scoreEngine.ts';

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
  if (activeBeat === beat) setScoreMood(moodOverride.mood);
}

export function clearStoryScoreMoodOverride(beat?: StoryBeat): boolean {
  if (!moodOverride || (beat && moodOverride.beat !== beat)) return false;
  const clearedBeat = moodOverride.beat;
  moodOverride = null;
  if (activeBeat === clearedBeat) setScoreMood(MOODS[clearedBeat] ?? null);
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
  setScoreMood(beat ? getStoryScoreMood(beat) : null);
}

/** Test/lifecycle seam; Story run reset may also use this before a clean replay. */
export function resetStoryScoreRuntime(): void {
  activeBeat = null;
  moodOverride = null;
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
