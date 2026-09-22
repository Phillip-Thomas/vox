import { describe, expect, it } from 'vitest';
import { VOYAGE_STRANGE_LINES } from '../../story/storyScript.ts';
import {
  VOICE_BP_HI,
  VOICE_BP_LO,
  VOICE_KEY_INTERVAL_S,
  VOICE_PAD_REGISTER_SEMITONES,
  VOICE_RUNGS,
  VOICE_SILENT_BEATS,
  VOICE_SILENT_MOODS,
  VOICE_SURFACE_IDS,
  admitVoiceLine,
  classifyVoiceLine,
  createSpeakerTable,
  isVoiceSilent,
  isVoiceSurface,
  planUtterance,
  resolveVoiceRung,
  snapVoicePitch,
  voiceSemitoneToHz
} from './voiceGrammar.ts';
import type { VoiceChord } from './voiceGrammar.ts';

const CHORD: VoiceChord = { root: 3, chord: [0, 3, 7, 10] };
const speaker = () => createSpeakerTable('regulation-narrator', 0x5eed);

describe('the voice refuses what it must never say', () => {
  it('speaks only from allowlisted REGULATION surfaces', () => {
    for (const id of VOICE_SURFACE_IDS) expect(isVoiceSurface(id)).toBe(true);
    expect(isVoiceSurface('story-caption')).toBe(false);
    expect(
      admitVoiceLine({
        text: 'REGULATION ADVISORY.',
        surfaceId: 'story-caption',
        register: 'institutional'
      })
    ).toEqual({ admitted: false, reason: 'surface-not-allowlisted' });
  });

  it('refuses the lowercase register even on an allowlisted surface', () => {
    expect(
      admitVoiceLine({ text: 'ADVISORY.', surfaceId: 'terminal', register: 'lowercase' }).reason
    ).toBe('register-lowercase');
  });

  it('refuses a lowercase-led line even when the caller claims the institution', () => {
    expect(
      admitVoiceLine({
        text: 'the approach feels like remembering.',
        surfaceId: 'terminal',
        register: 'institutional'
      }).reason
    ).toBe('line-lowercase-led');
  });

  it('refuses the parenthetical intrusions and the em-dash "i—"', () => {
    expect(classifyVoiceLine('(strange. the approach feels like remembering.)')).toBe(
      'line-parenthetical-intrusion'
    );
    expect(classifyVoiceLine('i—')).toBe('line-em-dash-fragment');
    expect(classifyVoiceLine('i— ')).toBe('line-em-dash-fragment');
    expect(classifyVoiceLine('')).toBe('line-empty');
    expect(classifyVoiceLine('   ')).toBe('line-empty');
  });

  // scene-contract acceptanceCriteria[18]: the refusal test walks the shipped
  // lines and proves the split, with no copy string written out of storyText.ts.
  it('refuses every watcher intrusion in VOYAGE_STRANGE_LINES and admits every system line', () => {
    let watchers = 0;
    let systems = 0;
    for (const line of VOYAGE_STRANGE_LINES) {
      const admission = admitVoiceLine({
        text: line.text,
        surfaceId: 'feed',
        register: 'institutional'
      });
      if (line.voice === 'watcher') {
        watchers++;
        expect(admission.admitted).toBe(false);
      } else {
        systems++;
        expect(admission.admitted).toBe(true);
      }
    }
    expect(watchers).toBeGreaterThan(0);
    expect(systems).toBeGreaterThan(0);
  });

  it('admits a REGULATION line on an allowlisted surface', () => {
    expect(
      admitVoiceLine({
        text: 'NAV NOTE: SITE GEOMETRY RESOLVES BEFORE IT IS SURVEYED.',
        surfaceId: 'feed',
        register: 'institutional'
      })
    ).toEqual({ admitted: true, reason: null });
  });
});

describe('the silence set', () => {
  it('covers ch4-defy and the four awakening ramps as WHOLE beats', () => {
    expect([...VOICE_SILENT_BEATS].sort()).toEqual(
      ['a1-ramp', 'a2-awakening', 'a3-dawn', 'a4-exhale', 'ch4-defy'].sort()
    );
  });

  it('silences seam-ebb through the mood, and the dive through oxygen', () => {
    expect(VOICE_SILENT_MOODS.has('seam-ebb')).toBe(true);
    expect(isVoiceSilent({ mood: 'seam-ebb' })).toBe(true);
    expect(isVoiceSilent({ beat: 'ch6-dive', underOxygen: true })).toBe(true);
    expect(isVoiceSilent({ beat: 'ch6-dive', underOxygen: false })).toBe(false);
  });

  it('does not include ch1-lift — that is the caption surface\'s own addition', () => {
    expect(VOICE_SILENT_BEATS.has('ch1-lift')).toBe(false);
  });

  it('refuses an otherwise admissible line during a silent beat', () => {
    expect(
      admitVoiceLine({
        text: 'REGULATION ADVISORY.',
        surfaceId: 'audit-band',
        register: 'institutional',
        silence: { beat: 'a2-awakening' }
      }).reason
    ).toBe('beat-silent');
  });
});

describe('the era ladder', () => {
  it('climbs with the reality stage, not the beat', () => {
    expect(resolveVoiceRung({ chip: 1, chipHarmony: 0, padChoir: 0, reverb: 0 })).toBe('bare');
    expect(resolveVoiceRung({ chip: 1, chipHarmony: 0.6, padChoir: 0, reverb: 0 })).toBe('colour');
    expect(resolveVoiceRung({ chip: 0.4, chipHarmony: 0, padChoir: 0.8, reverb: 0.2 })).toBe(
      'material'
    );
    expect(resolveVoiceRung({ chip: 0, chipHarmony: 0, padChoir: 1, reverb: 1 })).toBe('alive');
  });

  it('raises fidelity monotonically and never adds warmth', () => {
    const order = ['bare', 'colour', 'material', 'alive'] as const;
    for (let i = 1; i < order.length; i++) {
      const previous = VOICE_RUNGS[order[i - 1]];
      const rung = VOICE_RUNGS[order[i]];
      expect(rung.grainsPerCharacter).toBeGreaterThanOrEqual(previous.grainsPerCharacter);
      expect(rung.grainSeconds).toBeGreaterThanOrEqual(previous.grainSeconds);
      expect(rung.comb).toBeGreaterThanOrEqual(previous.comb);
      expect(rung.noiseFloor).toBeGreaterThanOrEqual(previous.noiseFloor);
    }
    expect(VOICE_RUNGS.bare.formantBands).toBe(0);
    expect(VOICE_RUNGS.colour.formantBands).toBe(3);
    // Only the top rung smooths; everything below is a hard PSG gate.
    expect(VOICE_RUNGS.alive.envelope).toBe('smooth');
    expect(VOICE_RUNGS.material.envelope).toBe('gate');
  });
});

describe('pitch snaps to the published chord', () => {
  it('lands only on chord tones, an octave above the pad', () => {
    for (let i = 0; i < 8; i++) {
      const hz = snapVoicePitch(CHORD, i);
      const tone = CHORD.chord[i % CHORD.chord.length];
      expect(hz).toBeCloseTo(voiceSemitoneToHz(tone + VOICE_PAD_REGISTER_SEMITONES + 12), 6);
    }
  });

  it('takes the carrier pitch class when ch10 asks for it', () => {
    expect(snapVoicePitch(CHORD, 0, 5)).toBeCloseTo(voiceSemitoneToHz(5 + VOICE_PAD_REGISTER_SEMITONES + 12), 6);
  });

  it('survives an empty chord rather than inventing a pitch', () => {
    expect(snapVoicePitch({ root: 0, chord: [] }, 3)).toBeCloseTo(voiceSemitoneToHz(VOICE_PAD_REGISTER_SEMITONES + 12), 6);
  });
  it('does not add the published bass root twice to absolute chord tones', () => {
    const published = { root: 5, chord: [5, 12, 17] };
    expect([0, 1, 2].map(index => Math.round(12 * Math.log2(snapVoicePitch(published, index) / 55)) % 12)).toEqual([5, 0, 5]);
    expect(snapVoicePitch({ root: 0, chord: [0] }, 0)).toBe(220);
  });
});

describe('the grain plan', () => {
  it('rides the typewriter per character and emits nothing for whitespace', () => {
    const plan = planUtterance({ text: 'AB C', rung: 'bare', chord: CHORD, speaker: speaker() });
    expect(plan.grains).toHaveLength(3);
    expect(plan.grains.map(g => g.characterIndex)).toEqual([0, 1, 3]);
    expect(plan.grains[1].atSeconds).toBeCloseTo(VOICE_KEY_INTERVAL_S, 9);
    expect(plan.grains[2].atSeconds).toBeCloseTo(VOICE_KEY_INTERVAL_S * 3, 9);
  });

  it('is deterministic under the seed', () => {
    const a = planUtterance({ text: 'REGULATION.', rung: 'alive', chord: CHORD, speaker: speaker(), seed: 7 });
    const b = planUtterance({ text: 'REGULATION.', rung: 'alive', chord: CHORD, speaker: speaker(), seed: 7 });
    expect(b.grains).toEqual(a.grains);
    expect(b.seed).toBe(a.seed);

    const c = planUtterance({ text: 'REGULATION.', rung: 'alive', chord: CHORD, speaker: speaker(), seed: 8 });
    expect(c.grains).not.toEqual(a.grains);
  });

  it('gives a bare rung one blip per character and no formants', () => {
    const plan = planUtterance({ text: 'ABC', rung: 'bare', chord: CHORD, speaker: speaker() });
    expect(plan.grains).toHaveLength(3);
    expect(plan.grains.every(g => g.formants === null)).toBe(true);
  });

  it('gives colour two-pulse formant pairs', () => {
    const plan = planUtterance({ text: 'ABC', rung: 'colour', chord: CHORD, speaker: speaker() });
    expect(plan.grains).toHaveLength(6);
    expect(plan.grains.every(g => g.formants !== null)).toBe(true);
  });

  it('keeps every formant inside the radio window', () => {
    const plan = planUtterance({
      text: 'THE QUICK BROWN FOX 0123456789',
      rung: 'alive',
      chord: CHORD,
      speaker: speaker()
    });
    for (const grain of plan.grains) {
      if (!grain.formants) continue;
      for (const f of [grain.formants.f1, grain.formants.f2, grain.formants.f3]) {
        expect(f).toBeGreaterThanOrEqual(VOICE_BP_LO);
        expect(f).toBeLessThanOrEqual(VOICE_BP_HI);
      }
    }
  });

  it('carries no prosody: gain is flat across the whole utterance', () => {
    const plan = planUtterance({
      text: 'IS THIS A QUESTION?',
      rung: 'alive',
      chord: CHORD,
      speaker: speaker()
    });
    expect(new Set(plan.grains.map(g => g.gain)).size).toBe(1);
  });

  it('maps a character to the SAME formants everywhere it appears', () => {
    const table = speaker();
    const plan = planUtterance({ text: 'AXA', rung: 'material', chord: CHORD, speaker: table });
    const firstA = plan.grains.find(g => g.characterIndex === 0)!.formants!;
    const lastA = plan.grains.find(g => g.characterIndex === 2)!.formants!;
    expect(lastA).toEqual(firstA);
  });

  it('gives distinct speakers distinct tables under one run seed', () => {
    const narrator = createSpeakerTable('regulation-narrator', 0x5eed);
    const vendor = createSpeakerTable('station-vendor-a', 0x5eed);
    expect(vendor.formantFor('A')).not.toEqual(narrator.formantFor('A'));
    // …and the narrator is stable across rebuilds of the same table.
    expect(createSpeakerTable('regulation-narrator', 0x5eed).formantFor('A')).toEqual(
      narrator.formantFor('A')
    );
  });
});
