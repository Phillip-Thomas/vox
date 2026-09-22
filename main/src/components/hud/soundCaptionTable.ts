// --- The sound-caption vocabulary ----------------------------------------------------
//
// CHAPTER OWNS THE WORDS. Cinematography owns the presentation (SoundCaption.tsx);
// this file is the word list and nothing else. Contract split recorded in
// cinematography-reconciliation CN-R4 and the chapter ruling on CN-N2 for the
// 2026-09-04-audio-10x run (scene-contract.json draft-v4).
//
// Every label here passes the BOTH-READINGS TEST: it must name a SOUND under the
// literal reading (a wreck's klaxon, a bad feed) and under the hidden reading (the
// institution's alarm, the narrator's own noise floor), and it must never name a
// SPEAKER. `[GLITCH]` was REFUSED for exactly that failure — it diagnoses a
// malfunction where the second reading hears a stutter of embodiment. `[STATIC]`
// replaces it and names the sound, not the cause.
//
// Two registers exist in this game's copy and they never mix:
//   institutional — UPPERCASE, bracketed, the regulation voice. Enters this surface.
//   lowercase     — the awakening interior. NEVER bracketed, NEVER enters this
//                   surface, and never voiced by the voice bus.
//
// Four cue families carry a bracket — alarm, static, impact, hatch — AND NO OTHERS
// (scene-contract acceptanceCriteria[19]). Everything else listed below is present
// so the table can state, in one place, WHY it carries no bracket and which surface
// discharges its parity instead. Adding a fifth bracketed family is a contract
// change, not an edit.
//
// This module is pure data plus lookups. It is not wired to any emitter: Stage 4/6
// integration binds the triggers to their call sites.

import type { StoryBeat } from '../../story/storyState.ts';
import type { SfxEvent } from '../../audio/sfxEngine.ts';
import { VOICE_SILENT_BEATS } from '../../audio/voice/voiceGrammar.ts';

/** The two registers of this game's copy. Only 'institutional' may be bracketed. */
export type SoundCaptionRegister = 'institutional' | 'lowercase';

/**
 * Trigger names the table keys on. `SfxEvent` members are the shipped cue ids;
 * the remaining literals are cues that exist as runtime events without an SFX id
 * of their own (the dock-hatch iris, the objective lifecycle, the voice bus).
 */
export type SoundCaptionTrigger =
  | SfxEvent
  | 'dockHatchIris'
  | 'objective-enter'
  | 'objective-progress'
  | 'objective-complete'
  | 'objective-fail'
  | 'marker-acquired'
  | 'oxygen-pulse'
  | 'narrator-utterance';

export type SoundCaptionId =
  // Bracketed families (the four, and only these four).
  | 'alarm'
  | 'static'
  | 'impact'
  | 'hatch'
  // Uncaptioned cues, listed with the parity carrier that discharges them.
  | 'oxygen-pulse'
  | 'objective-enter'
  | 'objective-progress'
  | 'objective-complete'
  | 'objective-fail'
  | 'marker-acquired'
  | 'narrator-utterance';

/**
 * How a caption behaves when the player has asked for reduced motion.
 * 'hard-cut' is the whole of the caption surface's RM form (contract
 * variants.reducedMotion: "the sound caption hard shows and hides with no fade").
 * 'not-applicable' marks the rows that never render here at all.
 */
export type SoundCaptionReducedMotionForm = 'hard-cut' | 'not-applicable';

export interface SoundCaptionEntry {
  id: SoundCaptionId;
  /**
   * The UPPERCASE bracketed label, or `null` when this cue is deliberately
   * uncaptioned. `null` is a ruling, not a gap — read `parityCarrier`.
   */
  label: string | null;
  register: SoundCaptionRegister;
  /** Runtime events that would raise this caption once Stage 4/6 wires them. */
  triggers: readonly SoundCaptionTrigger[];
  /**
   * The visual that already carries this cue's information. For a bracketed row
   * this is the caption itself plus whatever else is on screen; for a `null` row
   * it is the whole of the accessibility promise for that cue.
   */
  parityCarrier: string;
  /** Why these words survive the both-readings test (or why the row is silent). */
  bothReadings: string;
  reducedMotion: SoundCaptionReducedMotionForm;
}

/** Appear on the cue's tick, hold, fade. Cinematography's timings (treatment §3.2). */
export const SOUND_CAPTION_HOLD_MS = 1200;
export const SOUND_CAPTION_FADE_MS = 300;

export const SOUND_CAPTION_TABLE: readonly SoundCaptionEntry[] = [
  {
    id: 'alarm',
    label: '[ALARM]',
    register: 'institutional',
    triggers: ['terminalAlarm'],
    parityCarrier:
      'The violation band and the one-frame audit-band ember pulse fire on the same tick as playSfx(\'terminalAlarm\').',
    bothReadings:
      'A wreck\'s klaxon on the literal reading; the institution\'s alarm on the second. Names the sound, names no speaker.',
    reducedMotion: 'hard-cut'
  },
  {
    id: 'static',
    label: '[STATIC]',
    register: 'institutional',
    triggers: ['terminalCorrupt', 'storyGlitch'],
    parityCarrier: 'The shipped glitch displacement on the feed/terminal surface, same frame.',
    bothReadings:
      'A bad feed on the literal reading; the narrator\'s own noise floor on the second. Replaces the REFUSED [GLITCH], which diagnosed a cause instead of naming a sound.',
    reducedMotion: 'hard-cut'
  },
  {
    id: 'impact',
    label: '[IMPACT]',
    register: 'institutional',
    triggers: ['shipCrash'],
    parityCarrier: 'The shipped crash flash.',
    bothReadings:
      'A hull meeting ground on either reading. A physical event, not an utterance.',
    reducedMotion: 'hard-cut'
  },
  {
    id: 'hatch',
    label: '[HATCH]',
    register: 'institutional',
    triggers: ['dockHatchIris'],
    parityCarrier: 'The dock-hatch iris.',
    bothReadings:
      'A mechanism opening on either reading. Says nothing about who opened it.',
    reducedMotion: 'hard-cut'
  },

  // --- Uncaptioned by ruling -----------------------------------------------------
  {
    id: 'oxygen-pulse',
    label: null,
    register: 'institutional',
    triggers: ['oxygen-pulse'],
    parityCarrier:
      'The OxygenMeter tick, now firing at EVERY level rather than only under the alarm threshold — the body clock a deaf player reads instead of the pulse.',
    bothReadings:
      'Silent here by ruling: the meter is the parity, and a bracket over the breath gauge would double the same information in the busiest corner of the frame.',
    reducedMotion: 'not-applicable'
  },
  {
    id: 'objective-enter',
    label: null,
    register: 'institutional',
    triggers: ['objective-enter'],
    parityCarrier: 'The guidance card\'s work-order text (StoryGuidanceHud).',
    bothReadings:
      'Silent here by ruling: parity is intrinsic — the card IS the visual, and a second surface would compete with it for the same read.',
    reducedMotion: 'not-applicable'
  },
  {
    id: 'objective-progress',
    label: null,
    register: 'institutional',
    triggers: ['objective-progress'],
    parityCarrier: 'The guidance card\'s count.',
    bothReadings: 'Silent here by ruling, as objective-enter.',
    reducedMotion: 'not-applicable'
  },
  {
    id: 'objective-complete',
    label: null,
    register: 'institutional',
    triggers: ['objective-complete'],
    parityCarrier: 'The guidance card\'s strike-through.',
    bothReadings: 'Silent here by ruling, as objective-enter.',
    reducedMotion: 'not-applicable'
  },
  {
    id: 'objective-fail',
    label: null,
    register: 'institutional',
    triggers: ['objective-fail'],
    parityCarrier: 'The guidance card\'s failed state.',
    bothReadings: 'Silent here by ruling, as objective-enter.',
    reducedMotion: 'not-applicable'
  },
  {
    id: 'marker-acquired',
    label: null,
    register: 'institutional',
    triggers: ['marker-acquired'],
    parityCarrier: 'FreeMarker appearing IS marker-acquired.',
    bothReadings: 'Silent here by ruling, as objective-enter.',
    reducedMotion: 'not-applicable'
  },
  {
    id: 'narrator-utterance',
    label: null,
    register: 'institutional',
    triggers: ['narrator-utterance'],
    parityCarrier:
      'The REGULATION line already painting on the terminal, feed, audit band, relay or station panel. The line on screen IS the caption.',
    bothReadings:
      'Silent here by law, not taste: bracketing a voiced line would name a speaker where the copy deliberately does not, which is the both-readings failure the whole surface exists to avoid.',
    reducedMotion: 'not-applicable'
  }
];

/**
 * The caption surface's silence set: the voice bus's own silent beats, READ BY
 * REFERENCE from voiceGrammar so the two silences cannot drift, plus the one
 * caption-only addition ruled by Chapter — the whole of `ch1-lift`, whose snap
 * glitch is its own parity (storyDirector r.glitch = 0.8).
 */
export const SOUND_CAPTION_ONLY_SILENT_BEATS: readonly StoryBeat[] = ['ch1-lift'];

export const SOUND_CAPTION_SILENT_BEATS: ReadonlySet<StoryBeat> = new Set<StoryBeat>([
  ...VOICE_SILENT_BEATS,
  ...SOUND_CAPTION_ONLY_SILENT_BEATS
]);

const BY_ID = new Map<SoundCaptionId, SoundCaptionEntry>(
  SOUND_CAPTION_TABLE.map(entry => [entry.id, entry])
);

const BY_TRIGGER = new Map<SoundCaptionTrigger, SoundCaptionEntry>();
for (const entry of SOUND_CAPTION_TABLE) {
  for (const trigger of entry.triggers) BY_TRIGGER.set(trigger, entry);
}

export function soundCaptionEntry(id: SoundCaptionId): SoundCaptionEntry | undefined {
  return BY_ID.get(id);
}

export function soundCaptionForTrigger(
  trigger: SoundCaptionTrigger
): SoundCaptionEntry | undefined {
  return BY_TRIGGER.get(trigger);
}

/** The bracketed label a trigger raises, or null when the cue is uncaptioned. */
export function soundCaptionLabel(trigger: SoundCaptionTrigger): string | null {
  return BY_TRIGGER.get(trigger)?.label ?? null;
}

/** The four bracketed families, in table order. */
export function bracketedSoundCaptions(): readonly SoundCaptionEntry[] {
  return SOUND_CAPTION_TABLE.filter(entry => entry.label !== null);
}

/** True when the caption surface must show nothing at all for this beat. */
export function isSoundCaptionSilentBeat(beat: StoryBeat | null | undefined): boolean {
  return beat != null && SOUND_CAPTION_SILENT_BEATS.has(beat);
}
