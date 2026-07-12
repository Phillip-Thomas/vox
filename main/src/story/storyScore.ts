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
// CCTV era dark detuned-saw tension pads, and the awakenings get the full
// treatment — riser swells driven by the DIRECTOR'S OWN timeline values,
// braams at the cuts, and chord blooms when the world changes.

const MOODS: Partial<Record<StoryBeat, ScoreMood>> = {
  // The terminal era: patient machine pulses. Nothing hurries. Nothing hopes.
  crawl:    { chord: [0, 7], pattern: [0, null, null, null, 7, null, null, null], tempo: 52, wave: 'square', pad: 0.05, sub: 0.10, ost: 0.045, riser: 0.05, baseline: 0.25, octave: 24 },
  manifest: { chord: [0, 7], pattern: [0, null, 0, null, 7, null, 0, null], tempo: 60, wave: 'square', pad: 0.05, sub: 0.10, ost: 0.05, riser: 0.05, baseline: 0.3, octave: 24 },
  // The commute: a worried minor drift under the wireframes.
  voyage:   { chord: [0, 3, 7], progression: [[0, 3, 7], [8, 12, 15]], melody: { scale: [0, 2, 3, 5, 7, 8, 10, 12], density: 0.35 }, pattern: [0, 7, 3, 7, 0, 7, 10, 7], tempo: 66, wave: 'square', pad: 0.07, sub: 0.11, ost: 0.055, riser: 0.09, baseline: 0.35, octave: 24 },
  // Pong: the pulse doubles; the era's whole orchestra is one oscillator afraid.
  deflect:  { chord: [0, 5], pattern: [0, 0, null, 0, 5, 0, null, 12], tempo: 126, wave: 'square', pad: 0.05, sub: 0.13, ost: 0.07, riser: 0.16, baseline: 0.55, octave: 24 },
  crash:    { chord: [0, 1], pattern: [0, null, 1, null, 0, null, 1, null], tempo: 88, wave: 'sawtooth', pad: 0.08, sub: 0.15, ost: 0.05, riser: 0.2, baseline: 0.7, octave: 12 },
  // Falling: a semitone of dread widening under the raster sky.
  descent:  { chord: [0, 1, 7], pattern: [0, null, null, 1, null, null, 0, null], tempo: 84, wave: 'sawtooth', pad: 0.1, sub: 0.16, ost: 0.045, riser: 0.22, baseline: 0.5, octave: 12 },
  // The bolted-frame era: one voice, blinking in a dark room. Density is a
  // privilege the ladder has not yet issued.
  'ch1-fixed': { chord: [0, 7], melody: { scale: [0, 3, 5, 7, 10, 12], density: 0.2 }, pattern: [0, null, null, null, null, null, 7, null], tempo: 92, wave: 'square', pad: 0.04, sub: 0.1, ost: 0.06, riser: 0.04, baseline: 0.3, octave: 24 },
  // The unbolt: eight seconds of held breath, then the pulse learns to walk.
  'ch1-track': { chord: [0, 5, 12], pattern: [0, null, null, null, 5, null, null, null], tempo: 72, wave: 'square', pad: 0.09, sub: 0.11, ost: 0.04, riser: 0.18, baseline: 0.55, octave: 24 },
  // The chip era: work becomes a groove (the one mood allowed to be fun).
  'ch1-raster': { chord: [0, 3, 7, 10], progression: [[0, 3, 7], [8, 12, 15], [3, 7, 10], [10, 14, 17]], melody: { scale: [0, 2, 3, 5, 7, 8, 10, 12], density: 0.5 }, pattern: [0, 7, 3, 10, 7, 12, 3, 7], tempo: 112, wave: 'square', pad: 0.06, sub: 0.12, ost: 0.075, riser: 0.08, baseline: 0.4, octave: 24 },
  // Belt-scroll: the raster groove grows a second voice — a third axis exists.
  'ch1-depth': { chord: [0, 3, 7, 10], progression: [[0, 3, 7, 10], [5, 8, 12], [3, 7, 10], [8, 12, 15]], melody: { scale: [0, 2, 3, 5, 7, 8, 10, 12], density: 0.55 }, pattern: [0, 10, 3, 7, 0, 12, 7, 10], tempo: 108, wave: 'square', pad: 0.07, sub: 0.12, ost: 0.08, riser: 0.08, baseline: 0.42, octave: 24 },
  // Nav view: staccato chart-reading — pellet energy, politely surveilled.
  'ch1-nav': { chord: [0, 5, 7], progression: [[0, 5, 7], [3, 7, 10], [5, 10, 12], [0, 7, 12]], melody: { scale: [0, 2, 5, 7, 9, 12], density: 0.45 }, pattern: [0, 0, null, 7, null, 5, 0, null], tempo: 120, wave: 'square', pad: 0.05, sub: 0.11, ost: 0.085, riser: 0.07, baseline: 0.4, octave: 24 },
  // Isometric: the pad widens — height exists, and the music looks up at it.
  'ch1-iso': { chord: [0, 3, 7, 14], progression: [[0, 3, 7, 14], [8, 12, 15], [5, 8, 12, 19], [3, 7, 10]], melody: { scale: [0, 2, 3, 5, 7, 10, 12, 14], density: 0.4 }, pattern: [0, null, 7, null, 14, null, 7, null], tempo: 96, wave: 'square', pad: 0.1, sub: 0.12, ost: 0.06, riser: 0.12, baseline: 0.5, octave: 12 },
  // The lift: the groove decomposes into held wonder.
  'ch1-lift': { chord: [0, 3, 7, 12], pattern: [0, null, null, null, 7, null, null, null], tempo: 84, wave: 'sawtooth', pad: 0.13, sub: 0.13, ost: 0.03, riser: 0.24, baseline: 0.6, octave: 12 },
  // The CCTV era: tension pads, sparse heartbeat, a semitone that will not resolve.
  'ch1-anomaly': { chord: [0, 1, 7], progression: [[0, 3, 7], [1, 5, 8]], melody: { scale: [0, 2, 3, 5, 7, 8, 10, 12], density: 0.3 }, pattern: [0, null, null, null, 1, null, null, null], tempo: 58, wave: 'sawtooth', pad: 0.11, sub: 0.13, ost: 0.035, riser: 0.14, baseline: 0.4, octave: 12 },
  'a1-ramp': { chord: [0, 3, 7], pattern: [0, 3, 7, 12, 0, 3, 7, 12], tempo: 96, wave: 'sawtooth', pad: 0.12, sub: 0.14, ost: 0.05, riser: 0.3, baseline: 0.85, octave: 12 },
  'ch2-color': { chord: [0, 3, 8], progression: [[0, 3, 8], [5, 8, 12], [0, 3, 7], [1, 5, 8]], melody: { scale: [0, 2, 3, 5, 7, 8, 10, 12], density: 0.35 }, pattern: [0, null, 3, null, 8, null, 3, null], tempo: 64, wave: 'sawtooth', pad: 0.11, sub: 0.12, ost: 0.04, riser: 0.14, baseline: 0.4, octave: 12 },
  'ch2-approach': { chord: [0, 1, 8], progression: [[0, 1, 8], [0, 3, 8]], melody: { scale: [0, 1, 3, 5, 7, 8], density: 0.25 }, pattern: [0, null, 0, null, 1, null, 0, null], tempo: 72, wave: 'sawtooth', pad: 0.12, sub: 0.14, ost: 0.045, riser: 0.22, baseline: 0.55, octave: 12 },
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
  'ch4-arrival': { chord: [0, 7, 12, 16], progression: [[0, 7, 12, 16], [0, 7, 13, 16]], melody: { scale: [0, 2, 4, 7, 11, 12], density: 0.25 }, pattern: [0, null, 0, null, 7, null, 0, null], tempo: 60, wave: 'square', pad: 0.15, sub: 0.12, ost: 0.05, riser: 0.24, baseline: 0.5, octave: 24 }
};

// The instrument's timeline hooks, re-exported so story code keeps one import.
export { setScoreIntensity, scoreHit } from '../audio/scoreEngine.ts';

export function unlockStoryScore(): void {
  unlockScore();
}

/**
 * Beat entry hook: retunes the whole instrument to the beat's mood. `null`
 * (sandbox / story over) hands the instrument to the CELESTIAL IDLE BED —
 * the score never leaves, it recedes.
 */
export function setScoreBeat(beat: StoryBeat | null): void {
  setScoreMood(beat ? MOODS[beat] ?? null : null);
}
