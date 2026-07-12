import type { ArchetypeId } from '../../game/data/planetArchetypes.ts';
import { derivePlanetKey } from '../generative/harmonyBrain.ts';
import { deriveMotifGenome } from '../generative/motif.ts';
import {
  makeSoakScript,
  SOAK_CONTRAST_ARCHETYPE_A,
  SOAK_CONTRAST_ARCHETYPE_B,
  SOAK_CONTRAST_SEED_A,
  SOAK_CONTRAST_SEED_B,
  SOAK_HOME_ARCHETYPE,
  SOAK_HOME_SEED,
  type SoakReport
} from '../generative/soak.ts';
import { audioHealthPass, encodeWavPcm16, type AudioAnalysis } from './audioAnalysis.ts';
import {
  renderBedOffline,
  renderStoryBeatOffline,
  type HitCue
} from './offlineRender.ts';

// --- Owner-audition excerpts (P4) ------------------------------------------------------------------
//
// The §3 P4 list, verbatim: sandbox day, sandbox night, two contrasting
// planet seeds, one story beat, one era transition. Each excerpt renders the
// REAL engine offline and reports self-describing metadata (planet key, mode,
// tempo, meter) so the WAV filename tells the owner what they are hearing —
// with the §5-§8 tuning constants named beside each in the probe output.

/**
 * Bed-excerpt length. Deterministically sized so every reference planet's
 * window contains at least one BLOOM/melody statement (the C418 law keeps
 * the tune rare: home seed 5 first blooms at 123 s, volcanic seed 10 first
 * states at 185 s) — the audition must contain the tune, not just the bed.
 */
export const EXCERPT_SECONDS = 210;
/** Story-beat excerpt length (its arc is the scripted intensity ramp). */
export const STORY_EXCERPT_SECONDS = 90;
/** Era-transition excerpt length (the whole bare→alive ladder must fit). */
export const ERA_EXCERPT_SECONDS = 120;
/** The audited story beat: the largest build in the slice (a3-dawn). */
export const STORY_BEAT_EXCERPT = 'a3-dawn';
const STORY_INTENSITY_FLOOR = 0.35;
const STORY_BUILD_PEAK_FRAC = 0.6;
const STORY_BRAAM_FRAC = 0.25;

const NOTE_NAMES = ['A', 'As', 'B', 'C', 'Cs', 'D', 'Ds', 'E', 'F', 'Fs', 'G', 'Gs'];

export interface ExcerptResult {
  name: string;
  fileStem: string;
  description: string;
  seconds: number;
  analysis: AudioAnalysis;
  healthPass: boolean;
  report: SoakReport | null;
  wav: ArrayBuffer;
}

function planetStem(seed: number, archetype: ArchetypeId): string {
  const key = derivePlanetKey(seed, archetype);
  const genome = deriveMotifGenome(seed, archetype);
  const meter = genome.meter.sixteenthsPerBeat === 6 ? '6-8' : '4-4';
  return `seed${seed}-${archetype}_${NOTE_NAMES[key.tonicPc]}-${key.homeMode}_${Math.round(genome.baseTempo)}bpm-${meter}`;
}

async function bedExcerpt(
  name: string,
  description: string,
  seed: number,
  archetype: ArchetypeId,
  scenario: 'sandboxDay' | 'sandboxNight' | 'eraLadder',
  seconds: number,
  hitCues?: readonly HitCue[]
): Promise<ExcerptResult> {
  const result = await renderBedOffline({
    planetSeed: seed,
    archetype,
    seconds,
    scenario,
    script: makeSoakScript(scenario, seed, seconds),
    hitCues
  });
  const channels = Array.from({ length: result.buffer.numberOfChannels }, (_, c) =>
    result.buffer.getChannelData(c)
  );
  return {
    name,
    fileStem: `${name}_${planetStem(seed, archetype)}`,
    description,
    seconds,
    analysis: result.analysis,
    healthPass: audioHealthPass(result.analysis) && result.report.pass,
    report: result.report,
    wav: encodeWavPcm16(channels, result.buffer.sampleRate)
  };
}

export const EXCERPT_NAMES = [
  'bed-sandbox-day',
  'bed-sandbox-night',
  'bed-contrast-A',
  'bed-contrast-B',
  'story-beat',
  'era-transition'
] as const;
export type ExcerptName = (typeof EXCERPT_NAMES)[number];

export async function renderExcerpt(name: ExcerptName): Promise<ExcerptResult> {
  switch (name) {
    case 'bed-sandbox-day':
      return bedExcerpt(
        name,
        'The generative bed, home planet, full daylight (alive era).',
        SOAK_HOME_SEED,
        SOAK_HOME_ARCHETYPE,
        'sandboxDay',
        EXCERPT_SECONDS
      );
    case 'bed-sandbox-night':
      return bedExcerpt(
        name,
        'The same planet at night: register sinks, sub deepens, shimmer rises.',
        SOAK_HOME_SEED,
        SOAK_HOME_ARCHETYPE,
        'sandboxNight',
        EXCERPT_SECONDS
      );
    case 'bed-contrast-A':
      return bedExcerpt(
        name,
        'Contrast planet A — two planets must be different musical places.',
        SOAK_CONTRAST_SEED_A,
        SOAK_CONTRAST_ARCHETYPE_A,
        'sandboxDay',
        EXCERPT_SECONDS
      );
    case 'bed-contrast-B':
      return bedExcerpt(
        name,
        'Contrast planet B — same daylight script, different musical identity.',
        SOAK_CONTRAST_SEED_B,
        SOAK_CONTRAST_ARCHETYPE_B,
        'sandboxDay',
        EXCERPT_SECONDS
      );
    case 'era-transition': {
      // Stage flips are events (§8.4): since P5 the CONDUCTOR fires the rung
      // blooms itself (plus the promised mediant at `alive`) — the excerpt
      // just plays the ladder and the mechanism scores it.
      return bedExcerpt(
        name,
        'The fidelity ladder bare→color→material→alive; the stage-transition mechanism blooms the rungs.',
        SOAK_HOME_SEED,
        SOAK_HOME_ARCHETYPE,
        'eraLadder',
        ERA_EXCERPT_SECONDS
      );
    }
    case 'story-beat': {
      const seconds = STORY_EXCERPT_SECONDS;
      const peakAt = seconds * STORY_BUILD_PEAK_FRAC;
      const result = await renderStoryBeatOffline({
        beat: STORY_BEAT_EXCERPT,
        seconds,
        // P5 (§10.5): the home planet's tune haunts the beat, filtered by the
        // mood's own scale.
        planetSeed: SOAK_HOME_SEED,
        archetype: SOAK_HOME_ARCHETYPE,
        // The director's-own-timeline stand-in: floor → build → bloom → ebb.
        intensityAt: (t) =>
          t < peakAt
            ? STORY_INTENSITY_FLOOR + (1 - STORY_INTENSITY_FLOOR) * (t / peakAt)
            : 1 - 0.5 * ((t - peakAt) / (seconds - peakAt)),
        hits: [
          { atSec: seconds * STORY_BRAAM_FRAC, kind: 'braam' },
          { atSec: peakAt, kind: 'bloom' }
        ]
      });
      const channels = Array.from({ length: result.buffer.numberOfChannels }, (_, c) =>
        result.buffer.getChannelData(c)
      );
      return {
        name,
        fileStem: `${name}_${STORY_BEAT_EXCERPT}_intensity-build`,
        description: `Story mood '${STORY_BEAT_EXCERPT}' through the shipped instrument, riser build with braam and bloom.`,
        seconds,
        analysis: result.analysis,
        healthPass: audioHealthPass(result.analysis),
        report: null,
        wav: encodeWavPcm16(channels, result.buffer.sampleRate)
      };
    }
  }
}

export interface AudioSoakResult {
  minutes: number;
  planetSeed: number;
  archetype: ArchetypeId;
  bars: number;
  analysis: AudioAnalysis;
  report: SoakReport;
  pass: boolean;
}

/** The OfflineAudioContext soak: 30+ min of the real bed, audited + scanned. */
export async function runAudioSoak(
  minutes: number,
  planetSeed: number = SOAK_HOME_SEED,
  archetype: ArchetypeId = SOAK_HOME_ARCHETYPE
): Promise<AudioSoakResult> {
  const seconds = minutes * 60;
  const result = await renderBedOffline({
    planetSeed,
    archetype,
    seconds,
    scenario: 'fullSoak'
  });
  return {
    minutes,
    planetSeed,
    archetype,
    bars: result.bars,
    analysis: result.analysis,
    report: result.report,
    pass: result.report.pass && audioHealthPass(result.analysis)
  };
}
