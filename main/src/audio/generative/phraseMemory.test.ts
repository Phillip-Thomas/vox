import { describe, expect, it } from 'vitest';
import {
  createPhraseMemory,
  hashBar,
  hashGesture,
  hashPhrase,
  isBarAllowed,
  isPhraseAllowed,
  recordBar,
  recordPhrase,
  type BarDescriptor,
  type PhraseDescriptor
} from './phraseMemory.ts';
import { BAR_LEVEL_QUANTUM, BAR_TABU, GESTURE_TABU, PHRASE_TABU } from './tuning.ts';

const desc = (over: Partial<PhraseDescriptor> = {}): PhraseDescriptor => ({
  chordIds: ['0:min', '8:maj', '5:min', '0:min'],
  operatorChain: 'fragment(3)+diminish',
  rhythmMask: 12345,
  registerBand: 12,
  ...over
});

describe('phrase hashing (§7.3)', () => {
  it('is stable for identical descriptors', () => {
    expect(hashPhrase(desc())).toBe(hashPhrase(desc()));
    expect(hashGesture('invert+augment')).toBe(hashGesture('invert+augment'));
  });

  it('is sensitive to every descriptor field', () => {
    const base = hashPhrase(desc());
    expect(hashPhrase(desc({ chordIds: ['0:min', '8:maj', '5:min', '3:maj'] }))).not.toBe(base);
    expect(hashPhrase(desc({ operatorChain: 'invert' }))).not.toBe(base);
    expect(hashPhrase(desc({ rhythmMask: 54321 }))).not.toBe(base);
    expect(hashPhrase(desc({ registerBand: 19 }))).not.toBe(base);
  });
});

describe('the tabu windows (§7.3 — anti-repetition you can measure)', () => {
  it('forbids the last PHRASE_TABU exact phrases, then forgets', () => {
    const mem = createPhraseMemory();
    const target = hashPhrase(desc());
    recordPhrase(mem, target, hashGesture('g0'));
    expect(isPhraseAllowed(mem, target, hashGesture('other'))).toBe(false);
    // Fill the window with distinct phrases; the target must age out.
    for (let i = 1; i <= PHRASE_TABU; i++) {
      recordPhrase(mem, hashPhrase(desc({ rhythmMask: i })), hashGesture(`g${i}`));
    }
    expect(mem.phrases.length).toBe(PHRASE_TABU);
    expect(isPhraseAllowed(mem, target, hashGesture('fresh'))).toBe(true);
  });

  it('blocks gesture-level ruts on the shorter window', () => {
    const mem = createPhraseMemory();
    const gesture = hashGesture('fragment(3)+diminish');
    recordPhrase(mem, hashPhrase(desc({ rhythmMask: 1 })), gesture);
    // A DIFFERENT phrase with the SAME gesture is still refused…
    expect(isPhraseAllowed(mem, hashPhrase(desc({ rhythmMask: 2 })), gesture)).toBe(false);
    // …until GESTURE_TABU other gestures push it out.
    for (let i = 0; i < GESTURE_TABU; i++) {
      recordPhrase(mem, hashPhrase(desc({ rhythmMask: 100 + i })), hashGesture(`g${i}`));
    }
    expect(mem.gestures.length).toBe(GESTURE_TABU);
    expect(isPhraseAllowed(mem, hashPhrase(desc({ rhythmMask: 2 })), gesture)).toBe(true);
  });
});

describe('the whole-bar fingerprint law (Stage 5)', () => {
  const bar = (over: Partial<BarDescriptor> = {}): BarDescriptor => ({
    chordId: '0:min',
    uppers: [12, 16, 19],
    arrangement: 'BED',
    melodyChain: null,
    ostinato: ['0:24', '4:26', '8:28'],
    percussion: [0, 6, 12],
    levels: [1, 1, 1, 1, 1, 0.6, 0],
    ...over
  });

  it('is stable, and sensitive to chord, voicing, state, notes, onsets and an audible level step', () => {
    const base = hashBar(bar());
    expect(hashBar(bar())).toBe(base);
    expect(hashBar(bar({ chordId: '5:maj' }))).not.toBe(base);
    expect(hashBar(bar({ uppers: [12, 17, 19] }))).not.toBe(base);
    expect(hashBar(bar({ arrangement: 'REST' }))).not.toBe(base);
    expect(hashBar(bar({ ostinato: ['0:24', '4:26', '8:40'] }))).not.toBe(base);
    expect(hashBar(bar({ percussion: [1, 7, 13] }))).not.toBe(base);
    expect(hashBar(bar({ levels: [1, 1, 1, 1, 1, 0.6 + BAR_LEVEL_QUANTUM * 2, 0] }))).not.toBe(base);
    expect(hashBar(bar({ melodyChain: 'invert' }))).not.toBe(base);
  });

  it('ignores sub-quantum level differences (two bars closer than the quantum share a dynamic)', () => {
    const base = hashBar(bar());
    expect(hashBar(bar({ levels: [1, 1, 1, 1, 1, 0.6 + BAR_LEVEL_QUANTUM * 0.2, 0] }))).toBe(base);
  });

  it('forbids a bar inside BAR_TABU bars, then forgets', () => {
    const mem = createPhraseMemory();
    const target = hashBar(bar());
    recordBar(mem, target);
    expect(isBarAllowed(mem, target)).toBe(false);
    for (let i = 1; i <= BAR_TABU; i++) recordBar(mem, hashBar(bar({ percussion: [i] })));
    expect(mem.bars.length).toBe(BAR_TABU);
    expect(isBarAllowed(mem, target)).toBe(true);
  });
});
