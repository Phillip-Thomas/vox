import { describe, expect, it } from 'vitest';
import { VOICE_SILENT_BEATS } from '../../audio/voice/voiceGrammar.ts';
import {
  SOUND_CAPTION_FADE_MS,
  SOUND_CAPTION_HOLD_MS,
  SOUND_CAPTION_ONLY_SILENT_BEATS,
  SOUND_CAPTION_SILENT_BEATS,
  SOUND_CAPTION_TABLE,
  bracketedSoundCaptions,
  isSoundCaptionSilentBeat,
  soundCaptionEntry,
  soundCaptionForTrigger,
  soundCaptionLabel
} from './soundCaptionTable.ts';

describe('the sound-caption vocabulary', () => {
  it('brackets the alarm, static, impact and hatch families AND NO OTHERS', () => {
    expect(bracketedSoundCaptions().map(entry => entry.label)).toEqual([
      '[ALARM]',
      '[STATIC]',
      '[IMPACT]',
      '[HATCH]'
    ]);
  });

  it('refuses [GLITCH] anywhere in the table — [STATIC] replaced it', () => {
    const words = JSON.stringify(SOUND_CAPTION_TABLE.map(e => e.label));
    expect(words).not.toContain('GLITCH');
    expect(soundCaptionLabel('storyGlitch')).toBe('[STATIC]');
    expect(soundCaptionLabel('terminalCorrupt')).toBe('[STATIC]');
  });

  it('renders every bracketed label uppercase and bracketed', () => {
    for (const entry of bracketedSoundCaptions()) {
      expect(entry.label).toMatch(/^\[[A-Z]+\]$/);
      expect(entry.label).toBe(entry.label!.toUpperCase());
      expect(entry.register).toBe('institutional');
    }
  });

  it('gives a voiced narrator line NO caption — the line on screen is the caption', () => {
    const entry = soundCaptionEntry('narrator-utterance');
    expect(entry?.label).toBeNull();
    expect(entry?.parityCarrier).toContain('caption');
  });

  it('gives every objective lifecycle cue and marker-acquired no caption', () => {
    for (const id of [
      'objective-enter',
      'objective-progress',
      'objective-complete',
      'objective-fail',
      'marker-acquired'
    ] as const) {
      expect(soundCaptionEntry(id)?.label).toBeNull();
      expect(soundCaptionEntry(id)?.parityCarrier).toBeTruthy();
    }
  });

  it('names a parity carrier for every uncaptioned cue', () => {
    for (const entry of SOUND_CAPTION_TABLE) {
      if (entry.label !== null) continue;
      expect(entry.parityCarrier.length).toBeGreaterThan(0);
      expect(entry.reducedMotion).toBe('not-applicable');
    }
  });

  it('gives the oxygen pulse the meter tick rather than a bracket', () => {
    const entry = soundCaptionEntry('oxygen-pulse');
    expect(entry?.label).toBeNull();
    expect(entry?.parityCarrier).toContain('EVERY level');
  });

  it('reads the voice silence set BY REFERENCE and adds only ch1-lift', () => {
    expect(SOUND_CAPTION_ONLY_SILENT_BEATS).toEqual(['ch1-lift']);
    for (const beat of VOICE_SILENT_BEATS) {
      expect(SOUND_CAPTION_SILENT_BEATS.has(beat)).toBe(true);
    }
    expect(SOUND_CAPTION_SILENT_BEATS.size).toBe(VOICE_SILENT_BEATS.size + 1);
    expect(isSoundCaptionSilentBeat('ch1-lift')).toBe(true);
    expect(isSoundCaptionSilentBeat('a2-awakening')).toBe(true);
    expect(isSoundCaptionSilentBeat('ch3-signal')).toBe(false);
    expect(isSoundCaptionSilentBeat(null)).toBe(false);
  });

  it('maps each trigger to exactly one entry', () => {
    expect(soundCaptionForTrigger('terminalAlarm')?.id).toBe('alarm');
    expect(soundCaptionForTrigger('shipCrash')?.id).toBe('impact');
    expect(soundCaptionForTrigger('dockHatchIris')?.id).toBe('hatch');
    const seen = new Set<string>();
    for (const entry of SOUND_CAPTION_TABLE) {
      for (const trigger of entry.triggers) {
        expect(seen.has(trigger)).toBe(false);
        seen.add(trigger);
      }
    }
  });

  it('never captions storyAwaken or storySleep', () => {
    expect(soundCaptionForTrigger('storyAwaken')).toBeUndefined();
    expect(soundCaptionForTrigger('storySleep')).toBeUndefined();
  });

  it('holds 1.2 s and fades 300 ms', () => {
    expect(SOUND_CAPTION_HOLD_MS).toBe(1200);
    expect(SOUND_CAPTION_FADE_MS).toBe(300);
  });
});
