import { describe, expect, it } from 'vitest';
import { makeNoiseBuffer, MUSIC_NOISE_CURVE } from './audioCore.ts';
import {
  fnv1a32,
  oxygenPulseVoices,
  sfxNoiseSeed,
  sfxRecipe,
  SFX_LIVE_RIM_SEED,
  SFX_NOISE_CURVE,
  SFX_NOISE_EXCITATION,
  SFX_NOISE_MEMORY,
  SFX_NOISE_OUTPUT_GAIN,
  type SfxEvent
} from './sfxEngine.ts';

// Stage 0: the SFX bus became reproducible. These pin the two things that
// change when it does — the recipes (which must not) and the seeding (which
// must be stable and per-trigger distinct).

const ALL_EVENTS: readonly SfxEvent[] = [
  'jump',
  'land',
  'mine',
  'blocked',
  'boardShip',
  'exitShip',
  'shipLaunch',
  'shipBoost',
  'shipLand',
  'shipCrash',
  'splashEnter',
  'splashExit',
  'terminalKey',
  'terminalAdvance',
  'terminalAlarm',
  'terminalCorrupt',
  'storyGlitch',
  'storyAwaken',
  'storySleep'
];

/** A BaseAudioContext stand-in with just the buffer factory makeNoiseBuffer uses. */
function fakeContext(sampleRate = 44100): {
  sampleRate: number;
  createBuffer(channels: number, frames: number, rate: number): { getChannelData(): Float32Array };
} {
  return {
    sampleRate,
    createBuffer(_channels: number, frames: number) {
      const data = new Float32Array(frames);
      return { getChannelData: () => data };
    }
  };
}

describe('sfx recipes', () => {
  it('covers every event with at least one voice', () => {
    for (const event of ALL_EVENTS) {
      expect(sfxRecipe(event).length, event).toBeGreaterThan(0);
    }
  });

  it('keeps the shipped constants byte-for-byte', () => {
    expect(sfxRecipe('mine')).toEqual([
      { kind: 'noise', type: 'bandpass', from: 1600, to: 700, duration: 0.09, gain: 0.04, q: 1.8 },
      { kind: 'tone', type: 'square', from: 190, to: 95, duration: 0.06, gain: 0.014 }
    ]);
    expect(sfxRecipe('shipCrash')).toEqual([
      { kind: 'tone', type: 'sawtooth', from: 70, to: 32, duration: 0.34, gain: 0.09 },
      { kind: 'noise', type: 'lowpass', from: 900, to: 110, duration: 0.3, gain: 0.08 }
    ]);
    expect(sfxRecipe('blocked')).toEqual([
      { kind: 'tone', type: 'triangle', from: 120, to: 70, duration: 0.1, gain: 0.03 }
    ]);
  });

  it('scales the oxygen body clock from its plan', () => {
    const voices = oxygenPulseVoices({
      active: true,
      oxygen: 0.1,
      urgency: 0.9,
      pulseIntervalSeconds: 0.6,
      pulseGain: 0.08,
      criticalBreathGain: 0.03,
      criticalBreathDurationSeconds: 0.9
    });
    expect(voices).toHaveLength(3);
    expect(voices[0].gain).toBeCloseTo(0.08, 6);
    expect(voices[1].gain).toBeCloseTo(0.08 * 0.62, 6);
    expect(voices[2].duration).toBeCloseTo(0.9, 6);
  });

  it('omits the critical breath when the plan does not call for one', () => {
    const voices = oxygenPulseVoices({
      active: true,
      oxygen: 0.8,
      urgency: 0.2,
      pulseIntervalSeconds: 1.4,
      pulseGain: 0.04,
      criticalBreathGain: 0,
      criticalBreathDurationSeconds: 0
    });
    expect(voices).toHaveLength(2);
  });
});

describe('sfx noise seeding', () => {
  it('hashes stably', () => {
    expect(fnv1a32('mine#1#0')).toBe(fnv1a32('mine#1#0'));
    expect(fnv1a32('mine#1#0')).not.toBe(fnv1a32('mine#2#0'));
  });

  it('gives every (event, trigger, voice) its own seed', () => {
    const seeds = new Set<number>();
    for (const event of ALL_EVENTS) {
      for (let trigger = 1; trigger <= 8; trigger++) {
        for (let voice = 0; voice < 3; voice++) {
          seeds.add(sfxNoiseSeed(event, trigger, voice, SFX_LIVE_RIM_SEED));
        }
      }
    }
    expect(seeds.size).toBe(ALL_EVENTS.length * 8 * 3);
  });

  it('separates rims by seed but replays a rim exactly', () => {
    expect(sfxNoiseSeed('mine', 3, 0, 0)).toBe(sfxNoiseSeed('mine', 3, 0, 0));
    expect(sfxNoiseSeed('mine', 3, 0, 0)).not.toBe(sfxNoiseSeed('mine', 3, 0, 0x51f7c0de));
  });

  it('keeps the SFX curve constants distinct from the music curve', () => {
    expect(SFX_NOISE_CURVE).toEqual({
      memory: SFX_NOISE_MEMORY,
      excitation: SFX_NOISE_EXCITATION,
      outputGain: SFX_NOISE_OUTPUT_GAIN
    });
    expect(SFX_NOISE_MEMORY).toBe(0.97);
    expect(SFX_NOISE_EXCITATION).toBe(0.03);
    expect(SFX_NOISE_OUTPUT_GAIN).toBe(2.4);
    expect(SFX_NOISE_CURVE).not.toEqual(MUSIC_NOISE_CURVE);
  });

  it('renders the same buffer for the same seed and a different one otherwise', () => {
    const ctx = fakeContext() as unknown as BaseAudioContext;
    const read = (seed: number): number[] =>
      Array.from(makeNoiseBuffer(ctx, 0.01, seed, SFX_NOISE_CURVE).getChannelData(0).slice(0, 32));
    const a = read(1234);
    const b = read(1234);
    const c = read(1235);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    // The curve is applied, not the music one: same seed, different colour.
    const music = Array.from(
      makeNoiseBuffer(ctx, 0.01, 1234, MUSIC_NOISE_CURVE).getChannelData(0).slice(0, 32)
    );
    expect(a).not.toEqual(music);
    expect(a.every((v) => Number.isFinite(v))).toBe(true);
  });
});
