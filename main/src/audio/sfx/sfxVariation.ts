import type { SfxVoice } from '../sfxEngine.ts';

export const SFX_VARIATION = { pitch: 0.04, gain: 0.15, duration: 0.1, filter: 0.06 } as const;
// Leave headroom for the waveform/filter's own peak variation. The signed
// ±15% is an output bound, not permission to spend it twice in the source.
export const SFX_GAIN_JITTER_FRACTION = 0.4;
export const SFX_ROUND_ROBIN_SIBLINGS = 3;
export const ROUND_ROBIN_SFX = new Set(['mine', 'land', 'blocked']);
/** Institutional clocks remain mechanically identical, including new lifecycle signals. */
export const REGULATION_SFX = new Set([
  'terminalKey', 'terminalAdvance', 'terminalAlarm', 'terminalCorrupt', 'storyGlitch', 'storyAwaken', 'storySleep',
  'objectiveEnter', 'objectiveProgress', 'objectiveComplete', 'objectiveFail', 'markerAcquired',
  'uiHover', 'uiClick', 'uiBack', 'uiError'
]);
export const BODY_SFX = new Set(['footstep', 'jump', 'land', 'splashEnter', 'splashExit']);

function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let x = Math.imul(state ^ (state >>> 15), 1 | state);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function varySfxRecipe(event: string, voices: readonly SfxVoice[], seed: number, ordinal: number): readonly SfxVoice[] {
  if (REGULATION_SFX.has(event)) return voices;
  const draw = random(seed);
  const sibling = ROUND_ROBIN_SFX.has(event) ? (ordinal % SFX_ROUND_ROBIN_SIBLINGS) - 1 : 0;
  const factor = (span: number) => 1 + span * ((draw() * 2 - 1) * 0.75 + sibling * 0.25);
  const pitch = factor(SFX_VARIATION.pitch);
  const gain = factor(SFX_VARIATION.gain * SFX_GAIN_JITTER_FRACTION);
  const duration = factor(SFX_VARIATION.duration);
  const filter = factor(SFX_VARIATION.filter);
  return voices.map((voice) => ({
    ...voice, from: voice.from * (voice.kind === 'tone' ? pitch : filter),
    to: voice.to * (voice.kind === 'tone' ? pitch : filter), gain: voice.gain * gain,
    duration: voice.duration * duration,
    ...(voice.delay == null ? {} : { delay: voice.delay * duration })
  }));
}
