// --- The narrator's voice: pure grammar ----------------------------------------------
//
// Stage 6 of the 2026-09-04-audio-10x run. Everything here is deterministic and
// WebAudio-free so vitest can cover it; `voiceBus.ts` is the thin rim that turns a
// plan from this file into scheduled nodes on audioCore's `voice` category bus.
//
// The rules this file ENFORCES, from story-intent §4 and score-treatment §6:
//
//   One institutional voice. Terminals, the feed, the audit band, the ch10 relay
//   and the station's text panels — one seeded formant table used from `crawl` to
//   `station-resolved` without exception. The relay answer must be the same voice
//   the player has heard since the deployment notice.
//
//   It never speaks a lowercase caption (that voice is the player's interior, and
//   voicing it in the terminal's timbre would TELL). It never speaks the
//   parenthetical intrusions, the musings, or "i—". It never sounds like a person:
//   no gender, no accent, no affect, no breath, no question-prosody. Fidelity
//   rises across the era ladder; warmth does not.
//
// The refusal is at the API boundary and it is two-part, because either half alone
// leaks: a surface-id allowlist (only REGULATION-register surfaces may speak at
// all) AND a per-line register filter (even on an allowed surface, a lowercase-led
// line, a parenthetical intrusion or an em-dash "i—" is refused). Both must pass.

import type { StoryBeat } from '../../story/storyState.ts';
import { PAD_OCTAVE_SHIFT } from '../generative/tuning.ts';

// --- Chain constants (score-treatment §6) --------------------------------------------

export const VOICE_FORMANT_Q = 8;
export const VOICE_BP_LO = 300;
export const VOICE_BP_HI = 3400;
export const VOICE_SAT_K = 1.6;
export const VOICE_COMB_S = 1 / 1100;
export const VOICE_COMB_FB = 0.35;
export const VOICE_FLOOR_DB = -48;

/** Typewriter cadence: the voice rides `terminalKey` per character, never the transport. */
export const VOICE_KEY_INTERVAL_S = 0.022;

/** Two utterance slots exist so the ch10 relay overlap has somewhere to land. */
export const VOICE_SLOT_COUNT = 2;

// NOTE ON THE RELAY: score-treatment §6 scheduled the relay answer at
// `askLastKeyTime - RELAY_ANSWER_LEAD_S`. Chapter retired both symbols in the
// CN-N5 reconciliation: the answer's first glyph and first voice grain both key
// off `anc.ch10.relay-answer` in the same frame — simultaneity by shared anchor,
// never by tuned offsets. There is therefore no lead constant here, deliberately.

// --- The era ladder ------------------------------------------------------------------

/**
 * Bandwidth and grain climb with the WORLD'S REALITY STAGE, not the beat. The
 * source stays PSG/square-derived at every rung — the ch4 and ch10 square-wave
 * dramaturgy depends on it.
 */
export type VoiceRung = 'bare' | 'colour' | 'material' | 'alive';

/** The `resolveEraGates` fields each rung reads. Structural subset, so tests need no engine. */
export interface VoiceEraGates {
  chip: number;
  chipHarmony: number;
  padChoir: number;
  reverb: number;
}

export function resolveVoiceRung(gates: VoiceEraGates): VoiceRung {
  if (gates.reverb >= 0.99) return 'alive';
  if (gates.padChoir >= 0.5) return 'material';
  if (gates.chipHarmony > 0) return 'colour';
  return 'bare';
}

export interface VoiceRungSpec {
  rung: VoiceRung;
  /** Grains emitted per character. */
  grainsPerCharacter: number;
  /** Grain length in seconds. */
  grainSeconds: number;
  /** How many formant bands are driven (0 = none: a bare blip). */
  formantBands: 0 | 3;
  /** Seeded noise-floor level, linear. 0 at the dry rungs. */
  noiseFloor: number;
  /** Comb send, 0..1. Full only at `alive`. */
  comb: number;
  /** Grain envelope: a hard PSG gate, or a smoothed window. */
  envelope: 'gate' | 'smooth';
}

const NOISE_FLOOR_LINEAR = Math.pow(10, VOICE_FLOOR_DB / 20);

/**
 * `bare` one blip per character; `colour` two-pulse formant pairs; `material`
 * granular grains 20-40 ms from a seeded square buffer through the formant bank;
 * `alive` smooth grains, full comb, floor.
 */
export const VOICE_RUNGS: Readonly<Record<VoiceRung, VoiceRungSpec>> = {
  bare: {
    rung: 'bare',
    grainsPerCharacter: 1,
    grainSeconds: 0.012,
    formantBands: 0,
    noiseFloor: 0,
    comb: 0,
    envelope: 'gate'
  },
  colour: {
    rung: 'colour',
    grainsPerCharacter: 2,
    grainSeconds: 0.016,
    formantBands: 3,
    noiseFloor: 0,
    comb: 0,
    envelope: 'gate'
  },
  material: {
    rung: 'material',
    grainsPerCharacter: 3,
    grainSeconds: 0.02,
    formantBands: 3,
    noiseFloor: NOISE_FLOOR_LINEAR * 0.5,
    comb: 0.5,
    envelope: 'gate'
  },
  alive: {
    rung: 'alive',
    grainsPerCharacter: 4,
    grainSeconds: 0.04,
    formantBands: 3,
    noiseFloor: NOISE_FLOOR_LINEAR,
    comb: 1,
    envelope: 'smooth'
  }
};

// --- Seeded determinism --------------------------------------------------------------

/** FNV-1a over a string, so a speaker table can be named rather than numbered. */
export function voiceSeedFromString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** mulberry32. Same seed, same stream, every run and every rim. */
export function voiceRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- The formant table ---------------------------------------------------------------

export interface VoiceFormants {
  f1: number;
  f2: number;
  f3: number;
}

/** Formant band ranges, chosen to sit inside the 300-3400 Hz radio window. */
const FORMANT_RANGES: readonly (readonly [number, number])[] = [
  [340, 760],
  [900, 2100],
  [2200, 3200]
];

export interface VoiceSpeakerTable {
  id: string;
  seed: number;
  /** Formants per printable character code, resolved lazily and cached. */
  formantFor(character: string): VoiceFormants;
}

/**
 * One seeded table per speaker. The narrator's table is built once from the run
 * seed and reused from `crawl` to `station-resolved`; station vendors get their own
 * ids through the same chain, so every speaker climbs one perceptual ladder.
 *
 * There is no affect here on purpose: the table maps a CHARACTER to a fixed triple.
 * Nothing in it varies with the sentence, so nothing can read as emphasis.
 */
export function createSpeakerTable(id: string, runSeed: number): VoiceSpeakerTable {
  const seed = (voiceSeedFromString(id) ^ (runSeed >>> 0)) >>> 0;
  const cache = new Map<string, VoiceFormants>();
  return {
    id,
    seed,
    formantFor(character: string): VoiceFormants {
      const key = character.toUpperCase();
      const cached = cache.get(key);
      if (cached) return cached;
      const rand = voiceRandom((seed ^ voiceSeedFromString(key)) >>> 0);
      const [f1, f2, f3] = FORMANT_RANGES.map(([lo, hi]) => lo + rand() * (hi - lo));
      const formants: VoiceFormants = { f1, f2, f3 };
      cache.set(key, formants);
      return formants;
    }
  };
}

// --- Pitch: snapped to the published chord -------------------------------------------

/** A440, semitones from A. Matches musicPrimitives' chord units. */
export function voiceSemitoneToHz(semitonesFromA: number): number {
  return 55 * Math.pow(2, semitonesFromA / 12);
}

export interface VoiceChord {
  /** Semitones from A, as published by `getMusicChord()`. */
  root: number;
  /** Absolute semitones from A1, exactly as the leading engine publishes. */
  chord: readonly number[];
}

/**
 * The pad register the voice sits an octave above. The voice never chooses a pitch
 * of its own: it lands on a published chord tone, so it can never be heard singing
 * against the score.
 */
export const VOICE_PAD_REGISTER_SEMITONES = PAD_OCTAVE_SHIFT;
export const VOICE_OCTAVE_ABOVE_PAD = 12;

/**
 * Snap a grain to a pitch class of the published chord, one octave above the pad.
 * `carrierOverride` exists for the ch10 constraint that the relay voice may land on
 * the carrier pitch class.
 */
export function snapVoicePitch(
  chord: VoiceChord,
  index: number,
  carrierOverride?: number
): number {
  if (carrierOverride != null) {
    return voiceSemitoneToHz(carrierOverride + VOICE_PAD_REGISTER_SEMITONES + VOICE_OCTAVE_ABOVE_PAD);
  }
  const tones = chord.chord.length ? chord.chord : [chord.root];
  const tone = tones[((index % tones.length) + tones.length) % tones.length];
  return voiceSemitoneToHz(
    tone + VOICE_PAD_REGISTER_SEMITONES + VOICE_OCTAVE_ABOVE_PAD
  );
}

// --- The surface allowlist -----------------------------------------------------------

/**
 * REGULATION-register surfaces, and only these. A surface not named here cannot
 * speak, whatever its copy looks like.
 */
export const VOICE_SURFACE_IDS = [
  'terminal',
  'feed',
  'audit-band',
  'ch10-relay',
  'station-panel'
] as const;

export type VoiceSurfaceId = typeof VOICE_SURFACE_IDS[number];

const SURFACE_SET: ReadonlySet<string> = new Set(VOICE_SURFACE_IDS);

export function isVoiceSurface(surfaceId: string): surfaceId is VoiceSurfaceId {
  return SURFACE_SET.has(surfaceId);
}

// --- The silence set -----------------------------------------------------------------

/**
 * Beats the voice is prohibited from: `ch4-defy` and the four awakening ramps —
 * the whole beats, per Chapter's ruling, not a window inside them.
 *
 * `soundCaptionTable.ts` imports THIS constant by reference and adds only its own
 * `ch1-lift` entry, so the two silences are one set and cannot drift.
 */
export const VOICE_SILENT_BEATS: ReadonlySet<StoryBeat> = new Set<StoryBeat>([
  'ch4-defy',
  'a1-ramp',
  'a2-awakening',
  'a3-dawn',
  'a4-exhale'
]);

/**
 * `seam-ebb` is a ch10 SCORE MOOD, not a beat, so it silences the voice through the
 * mood rather than the beat set.
 */
export const VOICE_SILENT_MOODS: ReadonlySet<string> = new Set(['seam-ebb']);

export interface VoiceSilenceContext {
  beat?: StoryBeat | null;
  mood?: string | null;
  /** True while the player is under oxygen in `ch6-dive`. */
  underOxygen?: boolean;
}

export function isVoiceSilent(context: VoiceSilenceContext): boolean {
  if (context.beat && VOICE_SILENT_BEATS.has(context.beat)) return true;
  if (context.mood && VOICE_SILENT_MOODS.has(context.mood)) return true;
  if (context.underOxygen) return true;
  return false;
}

// --- The per-line register filter ----------------------------------------------------

export type VoiceRefusalReason =
  | 'surface-not-allowlisted'
  | 'register-lowercase'
  | 'line-lowercase-led'
  | 'line-parenthetical-intrusion'
  | 'line-em-dash-fragment'
  | 'line-empty'
  | 'beat-silent';

export type VoiceRegister = 'institutional' | 'lowercase';

const LEADING_NON_LETTER = /^[^\p{L}]*/u;

/**
 * The per-line half of the refusal. An allowlisted surface is NOT enough: the
 * institution's copy is uppercase, and anything else on that surface belongs to
 * the other voice.
 *
 * Refused, in order:
 *   an empty or letterless line;
 *   a parenthetical intrusion — the watcher speaking inside the ledger;
 *   an em-dash fragment such as "i—", the ch1-lift tell;
 *   a line whose first letter is lowercase.
 */
export function classifyVoiceLine(text: string): VoiceRefusalReason | null {
  const line = text.trim();
  if (!line) return 'line-empty';
  if (line.startsWith('(') || line.startsWith('（')) return 'line-parenthetical-intrusion';
  const stripped = line.replace(LEADING_NON_LETTER, '');
  if (!stripped) return 'line-empty';
  const first = stripped[0];
  // An em-dash fragment is the tell whether or not it leads: "i—" is one letter
  // and a dash, and no REGULATION line is ever shaped like that.
  if (/^\p{Ll}\s*[—–-]/u.test(stripped)) return 'line-em-dash-fragment';
  if (first !== first.toUpperCase() || first === first.toLowerCase()) {
    // `first !== first.toUpperCase()` catches cased lowercase letters; the second
    // clause catches caseless scripts, which are not this game's institution.
    return 'line-lowercase-led';
  }
  return null;
}

export interface VoiceAdmissionRequest {
  text: string;
  surfaceId: string;
  register: VoiceRegister;
  silence?: VoiceSilenceContext;
}

export interface VoiceAdmission {
  admitted: boolean;
  reason: VoiceRefusalReason | null;
}

/**
 * The whole boundary in one function. Both halves must pass, and the silence set
 * is checked last so a refusal names the copy problem when there is one.
 */
export function admitVoiceLine(request: VoiceAdmissionRequest): VoiceAdmission {
  if (!isVoiceSurface(request.surfaceId)) {
    return { admitted: false, reason: 'surface-not-allowlisted' };
  }
  if (request.register !== 'institutional') {
    return { admitted: false, reason: 'register-lowercase' };
  }
  const lineReason = classifyVoiceLine(request.text);
  if (lineReason) return { admitted: false, reason: lineReason };
  if (request.silence && isVoiceSilent(request.silence)) {
    return { admitted: false, reason: 'beat-silent' };
  }
  return { admitted: true, reason: null };
}

// --- The grain schedule --------------------------------------------------------------

export interface VoiceGrain {
  /** Seconds from the utterance's own start. Absolute time is the rim's business. */
  atSeconds: number;
  durationSeconds: number;
  /** Square-derived source pitch, snapped to the published chord. */
  frequencyHz: number;
  /** Null at `bare`, where there is no formant bank. */
  formants: VoiceFormants | null;
  /** Linear peak gain of the grain window. */
  gain: number;
  /** Seeded noise-floor contribution, linear. */
  noise: number;
  /** Index of the source character, for caption/typewriter alignment tests. */
  characterIndex: number;
}

export interface VoiceUtterancePlan {
  text: string;
  rung: VoiceRung;
  speakerId: string;
  seed: number;
  /** The typewriter interval this plan rode. */
  keyIntervalSeconds: number;
  /** Total length from first grain onset to last grain end. */
  durationSeconds: number;
  grains: readonly VoiceGrain[];
}

export interface VoiceUtterancePlanOptions {
  text: string;
  rung: VoiceRung;
  chord: VoiceChord;
  speaker: VoiceSpeakerTable;
  /** Extra entropy on top of the speaker table's seed (per-utterance). */
  seed?: number;
  keyIntervalSeconds?: number;
  /** ch10: land the whole utterance on the carrier pitch class. */
  carrierSemitone?: number;
}

/**
 * Text to grains. Whitespace advances the cadence and emits nothing — a space is a
 * space, not a breath.
 *
 * Grain gain is FLAT across the utterance. Any per-character shaping would read as
 * prosody, and prosody reads as a person.
 */
export function planUtterance(options: VoiceUtterancePlanOptions): VoiceUtterancePlan {
  const spec = VOICE_RUNGS[options.rung];
  const keyInterval = options.keyIntervalSeconds ?? VOICE_KEY_INTERVAL_S;
  const seed = ((options.seed ?? 0) ^ options.speaker.seed) >>> 0;
  const rand = voiceRandom(seed);
  const grains: VoiceGrain[] = [];
  let end = 0;

  for (let i = 0; i < options.text.length; i++) {
    const character = options.text[i];
    const charStart = i * keyInterval;
    if (!character.trim()) continue;
    for (let g = 0; g < spec.grainsPerCharacter; g++) {
      const at = charStart + (g * spec.grainSeconds) / spec.grainsPerCharacter;
      const frequencyHz = snapVoicePitch(options.chord, i + g, options.carrierSemitone);
      const noise = spec.noiseFloor * rand();
      grains.push({
        atSeconds: at,
        durationSeconds: spec.grainSeconds,
        frequencyHz,
        formants: spec.formantBands === 0 ? null : options.speaker.formantFor(character),
        gain: 1,
        noise,
        characterIndex: i
      });
      end = Math.max(end, at + spec.grainSeconds);
    }
  }

  return {
    text: options.text,
    rung: options.rung,
    speakerId: options.speaker.id,
    seed,
    keyIntervalSeconds: keyInterval,
    durationSeconds: end,
    grains
  };
}
