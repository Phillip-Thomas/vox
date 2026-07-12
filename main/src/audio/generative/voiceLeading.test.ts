import { describe, expect, it } from 'vitest';
import { pcMod, plrTransform, triadPcs, type TriadSpec } from './theory.ts';
import { isLegalTransition, leadVoices, voiceTriad, type TransitionResult } from './voiceLeading.ts';
import {
  REGISTER_BAND_CENTER_BASE,
  REGISTER_BAND_HALF_WIDTH,
  VL_COMMON_TONE_TENSION,
  VL_TOTAL_MAX,
  VL_VOICE_MAX
} from './tuning.ts';

const CENTER = REGISTER_BAND_CENTER_BASE;
const HW = REGISTER_BAND_HALF_WIDTH;

const allTriads: TriadSpec[] = [];
for (let pc = 0; pc < 12; pc++) {
  allTriads.push({ rootPc: pc, quality: 'maj' }, { rootPc: pc, quality: 'min' });
}

describe('voiceTriad', () => {
  it('places three upper voices inside the band with the triad pitch classes', () => {
    for (const t of allTriads) {
      const v = voiceTriad(t, CENTER, HW);
      expect(v.bass).toBe(pcMod(t.rootPc));
      const want = new Set(triadPcs(t));
      for (const upper of v.uppers) {
        expect(upper).toBeGreaterThanOrEqual(CENTER - HW);
        expect(upper).toBeLessThanOrEqual(CENTER + HW);
        expect(want.has(pcMod(upper))).toBe(true);
      }
      expect(new Set(v.uppers.map(pcMod)).size).toBe(3);
    }
  });
});

describe('leadVoices minimal motion', () => {
  it('finds the known-optimal Am → C transition (displacement 2, two common tones)', () => {
    const am: TriadSpec = { rootPc: 0, quality: 'min' };
    const c: TriadSpec = { rootPc: 3, quality: 'maj' };
    const prev = voiceTriad(am, CENTER, HW);
    const r = leadVoices(prev, c, CENTER, HW);
    expect(r.displacement).toBe(2);
    expect(r.commonTones).toBe(2);
    expect(r.voicing.bass).toBe(3);
  });

  it('keeps every PLR image within displacement 2 (they are the cheapest edges)', () => {
    for (const t of allTriads) {
      const prev = voiceTriad(t, CENTER, HW);
      for (const op of ['P', 'L', 'R'] as const) {
        const r = leadVoices(prev, plrTransform(t, op), CENTER, HW);
        expect(r.displacement, `${t.rootPc}:${t.quality} ${op}`).toBeLessThanOrEqual(2);
        expect(r.commonTones).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('returns voicings inside the band with the target pitch classes', () => {
    for (const a of allTriads) {
      const prev = voiceTriad(a, CENTER, HW);
      for (const b of [allTriads[5], allTriads[12], allTriads[20]]) {
        const r = leadVoices(prev, b, CENTER, HW);
        const want = new Set(triadPcs(b));
        for (const upper of r.voicing.uppers) {
          expect(upper).toBeGreaterThanOrEqual(CENTER - HW);
          expect(upper).toBeLessThanOrEqual(CENTER + HW);
          expect(want.has(pcMod(upper))).toBe(true);
        }
        expect(new Set(r.voicing.uppers.map(pcMod)).size).toBe(3);
      }
    }
  });

  it('never reports displacement below the true per-voice cost', () => {
    for (const a of allTriads.slice(0, 8)) {
      const prev = voiceTriad(a, CENTER, HW);
      for (const b of allTriads) {
        const r = leadVoices(prev, b, CENTER, HW);
        const sum = r.voicing.uppers.reduce((acc, p, i) => acc + Math.abs(p - prev.uppers[i]), 0);
        expect(r.displacement).toBe(sum);
        expect(r.maxVoice).toBeLessThanOrEqual(r.displacement);
      }
    }
  });
});

describe('isLegalTransition (§6.4 law)', () => {
  const base: TransitionResult = {
    voicing: { bass: 0, uppers: [7, 12, 15] },
    displacement: 4,
    maxVoice: 2,
    commonTones: 1
  };

  it('rejects total displacement over VL_TOTAL_MAX', () => {
    expect(isLegalTransition({ ...base, displacement: VL_TOTAL_MAX }, 0.5)).toBe(true);
    expect(isLegalTransition({ ...base, displacement: VL_TOTAL_MAX + 1 }, 0.5)).toBe(false);
  });

  it('rejects any single voice over VL_VOICE_MAX', () => {
    expect(isLegalTransition({ ...base, maxVoice: VL_VOICE_MAX }, 0.5)).toBe(true);
    expect(isLegalTransition({ ...base, maxVoice: VL_VOICE_MAX + 1 }, 0.5)).toBe(false);
  });

  it('requires a common tone below the tension gate, relaxes above it', () => {
    const noCommon = { ...base, commonTones: 0 };
    expect(isLegalTransition(noCommon, VL_COMMON_TONE_TENSION - 0.01)).toBe(false);
    expect(isLegalTransition(noCommon, VL_COMMON_TONE_TENSION)).toBe(true);
  });
});
