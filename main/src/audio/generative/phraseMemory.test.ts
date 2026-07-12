import { describe, expect, it } from 'vitest';
import {
  createPhraseMemory,
  hashGesture,
  hashPhrase,
  isPhraseAllowed,
  recordPhrase,
  type PhraseDescriptor
} from './phraseMemory.ts';
import { GESTURE_TABU, PHRASE_TABU } from './tuning.ts';

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
