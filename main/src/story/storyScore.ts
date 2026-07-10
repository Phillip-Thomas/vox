import type { StoryBeat } from './storyState.ts';

// --- The story score -------------------------------------------------------------------
//
// A fully procedural (WebAudio, zero assets) film score for the story arc.
// Hans-Zimmer grammar built from era-appropriate synthesis: the terminal era is
// square-wave pulses, the raster era a chip ostinato, the CCTV era dark
// detuned-saw tension pads, and the awakenings get the full treatment — riser
// swells driven by the DIRECTOR'S OWN timeline values, braams at the cuts, and
// chord blooms when the world changes. One instrument, one style per era, each
// style blending into the next (the same voices retune rather than swap).
//
// Voices: PAD (4 chord tones × 2 detuned saws → lowpass), SUB (sine drone),
// OSTINATO (lookahead-scheduled pluck pattern), RISER (filtered noise swell),
// HITS (braam / bloom / boom one-shots). Everything hangs off a compressor so
// enthusiasm never clips.

type Wave = 'square' | 'sawtooth' | 'triangle' | 'sine';

interface ScoreMood {
  /** Semitones above the root (A1 = 55 Hz) for the pad chord (max 4 tones). */
  chord: number[];
  /** Ostinato pattern in semitones (null = rest), stepped in 8th notes. */
  pattern: Array<number | null>;
  tempo: number;
  wave: Wave;
  pad: number;      // pad gain
  sub: number;      // sub drone gain
  ost: number;      // ostinato gain
  riser: number;    // max riser gain at intensity 1
  baseline: number; // resting intensity for this mood
  octave: number;   // ostinato octave shift (semitones)
}

const ROOT_HZ = 55; // A1

const MOODS: Partial<Record<StoryBeat, ScoreMood>> = {
  // The terminal era: patient machine pulses. Nothing hurries. Nothing hopes.
  crawl:    { chord: [0, 7], pattern: [0, null, null, null, 7, null, null, null], tempo: 52, wave: 'square', pad: 0.05, sub: 0.10, ost: 0.045, riser: 0.05, baseline: 0.25, octave: 24 },
  manifest: { chord: [0, 7], pattern: [0, null, 0, null, 7, null, 0, null], tempo: 60, wave: 'square', pad: 0.05, sub: 0.10, ost: 0.05, riser: 0.05, baseline: 0.3, octave: 24 },
  // The commute: a worried minor drift under the wireframes.
  voyage:   { chord: [0, 3, 7], pattern: [0, 7, 3, 7, 0, 7, 10, 7], tempo: 66, wave: 'square', pad: 0.07, sub: 0.11, ost: 0.055, riser: 0.09, baseline: 0.35, octave: 24 },
  // Pong: the pulse doubles; the era's whole orchestra is one oscillator afraid.
  deflect:  { chord: [0, 5], pattern: [0, 0, null, 0, 5, 0, null, 12], tempo: 126, wave: 'square', pad: 0.05, sub: 0.13, ost: 0.07, riser: 0.16, baseline: 0.55, octave: 24 },
  crash:    { chord: [0, 1], pattern: [0, null, 1, null, 0, null, 1, null], tempo: 88, wave: 'sawtooth', pad: 0.08, sub: 0.15, ost: 0.05, riser: 0.2, baseline: 0.7, octave: 12 },
  // Falling: a semitone of dread widening under the raster sky.
  descent:  { chord: [0, 1, 7], pattern: [0, null, null, 1, null, null, 0, null], tempo: 84, wave: 'sawtooth', pad: 0.1, sub: 0.16, ost: 0.045, riser: 0.22, baseline: 0.5, octave: 12 },
  // The chip era: work becomes a groove (the one mood allowed to be fun).
  'ch1-raster': { chord: [0, 3, 7, 10], pattern: [0, 7, 3, 10, 7, 12, 3, 7], tempo: 112, wave: 'square', pad: 0.06, sub: 0.12, ost: 0.075, riser: 0.08, baseline: 0.4, octave: 24 },
  // The lift: the groove decomposes into held wonder.
  'ch1-lift': { chord: [0, 3, 7, 12], pattern: [0, null, null, null, 7, null, null, null], tempo: 84, wave: 'sawtooth', pad: 0.13, sub: 0.13, ost: 0.03, riser: 0.24, baseline: 0.6, octave: 12 },
  // The CCTV era: tension pads, sparse heartbeat, a semitone that will not resolve.
  'ch1-anomaly': { chord: [0, 1, 7], pattern: [0, null, null, null, 1, null, null, null], tempo: 58, wave: 'sawtooth', pad: 0.11, sub: 0.13, ost: 0.035, riser: 0.14, baseline: 0.4, octave: 12 },
  'a1-ramp': { chord: [0, 3, 7], pattern: [0, 3, 7, 12, 0, 3, 7, 12], tempo: 96, wave: 'sawtooth', pad: 0.12, sub: 0.14, ost: 0.05, riser: 0.3, baseline: 0.85, octave: 12 },
  'ch2-color': { chord: [0, 3, 8], pattern: [0, null, 3, null, 8, null, 3, null], tempo: 64, wave: 'sawtooth', pad: 0.11, sub: 0.12, ost: 0.04, riser: 0.14, baseline: 0.4, octave: 12 },
  'ch2-approach': { chord: [0, 1, 8], pattern: [0, null, 0, null, 1, null, 0, null], tempo: 72, wave: 'sawtooth', pad: 0.12, sub: 0.14, ost: 0.045, riser: 0.22, baseline: 0.55, octave: 12 },
  // A2: the flood is a cluster; the liberation build lives on the intensity rail.
  'a2-awakening': { chord: [0, 1, 6, 7], pattern: [0, 1, 0, 1, 0, 1, 0, 1], tempo: 132, wave: 'sawtooth', pad: 0.13, sub: 0.16, ost: 0.05, riser: 0.34, baseline: 0.8, octave: 12 },
  // Chapter 3: warmth earned — minor lifts toward its relative major.
  'ch3-gather': { chord: [0, 7, 12, 15], pattern: [0, null, 7, null, 12, null, 7, null], tempo: 76, wave: 'triangle', pad: 0.12, sub: 0.11, ost: 0.05, riser: 0.1, baseline: 0.35, octave: 12 },
  'ch3-dusk': { chord: [0, 7, 12, 16], pattern: [0, null, null, null, 12, null, null, null], tempo: 66, wave: 'sawtooth', pad: 0.16, sub: 0.12, ost: 0.03, riser: 0.26, baseline: 0.7, octave: 12 },
  'ch3-await-rest': { chord: [0, 7, 15], pattern: [0, null, null, null, null, null, 7, null], tempo: 54, wave: 'triangle', pad: 0.1, sub: 0.1, ost: 0.03, riser: 0.08, baseline: 0.3, octave: 12 },
  // Dawn: the largest build in the slice, resolving major as texture arrives.
  'a3-dawn': { chord: [0, 4, 7, 11], pattern: [0, 4, 7, 11, 12, 11, 7, 4], tempo: 88, wave: 'sawtooth', pad: 0.17, sub: 0.13, ost: 0.05, riser: 0.32, baseline: 0.75, octave: 12 }
};

// --- engine state ---------------------------------------------------------------------

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let padGain: GainNode | null = null;
let padFilter: BiquadFilterNode | null = null;
let subGain: GainNode | null = null;
let subOsc: OscillatorNode | null = null;
let ostGain: GainNode | null = null;
let ostFilter: BiquadFilterNode | null = null;
let riserGain: GainNode | null = null;
let riserFilter: BiquadFilterNode | null = null;

interface PadVoice { oscA: OscillatorNode; oscB: OscillatorNode; gain: GainNode }
let padVoices: PadVoice[] = [];

let mood: ScoreMood | null = null;
let intensity = 0;
let volume = 0.78;
let muted = false;
let schedulerTimer: number | null = null;
let nextNoteAt = 0;
let patternStep = 0;

const hzForSemis = (semis: number, octaveShift = 0) => ROOT_HZ * Math.pow(2, (semis + octaveShift) / 12);

function ensureContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (ctx) return ctx;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();

  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -20;
  compressor.ratio.value = 8;
  compressor.connect(ctx.destination);
  master = ctx.createGain();
  master.gain.value = 0;
  master.connect(compressor);

  // PAD: 4 chord tones × 2 detuned saws → shared lowpass.
  padFilter = ctx.createBiquadFilter();
  padFilter.type = 'lowpass';
  padFilter.frequency.value = 600;
  padFilter.Q.value = 0.6;
  padGain = ctx.createGain();
  padGain.gain.value = 0;
  padFilter.connect(padGain);
  padGain.connect(master);
  padVoices = Array.from({ length: 4 }, () => {
    const gain = ctx!.createGain();
    gain.gain.value = 0;
    gain.connect(padFilter!);
    const mk = (detune: number) => {
      const osc = ctx!.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = ROOT_HZ * 2;
      osc.detune.value = detune;
      osc.connect(gain);
      osc.start();
      return osc;
    };
    return { oscA: mk(-7), oscB: mk(7), gain };
  });

  // SUB drone.
  subOsc = ctx.createOscillator();
  subOsc.type = 'sine';
  subOsc.frequency.value = ROOT_HZ;
  subGain = ctx.createGain();
  subGain.gain.value = 0;
  subOsc.connect(subGain);
  subGain.connect(master);
  subOsc.start();

  // OSTINATO bus.
  ostFilter = ctx.createBiquadFilter();
  ostFilter.type = 'lowpass';
  ostFilter.frequency.value = 1200;
  ostGain = ctx.createGain();
  ostGain.gain.value = 0;
  ostFilter.connect(ostGain);
  ostGain.connect(master);

  // RISER: looped noise → bandpass.
  const noiseSeconds = 2;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * noiseSeconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  noise.loop = true;
  riserFilter = ctx.createBiquadFilter();
  riserFilter.type = 'bandpass';
  riserFilter.frequency.value = 300;
  riserFilter.Q.value = 1.1;
  riserGain = ctx.createGain();
  riserGain.gain.value = 0;
  noise.connect(riserFilter);
  riserFilter.connect(riserGain);
  riserGain.connect(master);
  noise.start();

  startScheduler();
  return ctx;
}

// --- the lookahead scheduler (ostinato notes + smoothed control rails) ------------------

function startScheduler(): void {
  if (schedulerTimer != null) return;
  schedulerTimer = window.setInterval(() => {
    if (!ctx || !mood) return;
    applyRails();
    const stepSeconds = 60 / mood.tempo / 2; // 8th notes
    while (nextNoteAt < ctx.currentTime + 0.18) {
      if (nextNoteAt < ctx.currentTime) nextNoteAt = ctx.currentTime;
      const semis = mood.pattern[patternStep % mood.pattern.length];
      if (semis != null && ostFilter) {
        const osc = ctx.createOscillator();
        osc.type = mood.wave;
        osc.frequency.value = hzForSemis(semis, mood.octave);
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, nextNoteAt);
        env.gain.linearRampToValueAtTime(1, nextNoteAt + 0.008);
        env.gain.exponentialRampToValueAtTime(0.001, nextNoteAt + stepSeconds * 1.7);
        osc.connect(env);
        env.connect(ostFilter);
        osc.start(nextNoteAt);
        osc.stop(nextNoteAt + stepSeconds * 2);
      }
      patternStep++;
      nextNoteAt += stepSeconds;
    }
  }, 60);
}

/** Smooth the mood/intensity-dependent parameters toward their targets. */
function applyRails(): void {
  if (!ctx || !master) return;
  const now = ctx.currentTime;
  const on = mood != null && !muted;
  master.gain.setTargetAtTime(on ? volume * 0.9 : 0, now, 0.4);
  if (!mood) return;
  const boost = 0.55 + 0.45 * intensity;
  padGain?.gain.setTargetAtTime(mood.pad * boost, now, 0.8);
  subGain?.gain.setTargetAtTime(mood.sub * boost, now, 0.8);
  ostGain?.gain.setTargetAtTime(mood.ost * (0.35 + 0.65 * intensity), now, 0.4);
  padFilter?.frequency.setTargetAtTime(320 + intensity * 2400, now, 0.7);
  ostFilter?.frequency.setTargetAtTime(700 + intensity * 2600, now, 0.5);
  riserGain?.gain.setTargetAtTime(mood.riser * intensity * intensity, now, 0.35);
  riserFilter?.frequency.setTargetAtTime(220 + intensity * 1900, now, 0.4);
}

function retuneVoices(): void {
  if (!ctx || !mood) return;
  const now = ctx.currentTime;
  padVoices.forEach((voice, i) => {
    const semis = mood!.chord[i];
    const active = semis != null;
    voice.gain.gain.setTargetAtTime(active ? 0.5 : 0, now, 1.2);
    if (active) {
      const hz = hzForSemis(semis, 12);
      voice.oscA.frequency.setTargetAtTime(hz, now, 0.9);
      voice.oscB.frequency.setTargetAtTime(hz, now, 0.9);
    }
  });
  subOsc?.frequency.setTargetAtTime(hzForSemis(mood.chord[0] ?? 0, 0), now, 1.0);
}

// --- public API -------------------------------------------------------------------------

export function unlockStoryScore(): void {
  const context = ensureContext();
  if (context && context.state === 'suspended') void context.resume();
}

export function setStoryScoreOutput(nextVolume: number, nextMuted: boolean): void {
  volume = Math.min(1, Math.max(0, nextVolume));
  muted = nextMuted;
}

/** Beat entry hook: retunes the whole instrument to the beat's mood. */
export function setScoreBeat(beat: StoryBeat | null): void {
  const next = beat ? MOODS[beat] ?? null : null;
  mood = next;
  intensity = next ? next.baseline : 0;
  if (next && ctx) retuneVoices();
}

/** Timeline hook: the director drives this with its OWN ramp values. */
export function setScoreIntensity(value: number): void {
  intensity = Math.min(1, Math.max(0, value));
}

/**
 * One-shot punctuation.
 *   braam — the Zimmer horn (stacked saws, slow bite, long tail)
 *   bloom — a major chord opening (the color/texture arrivals)
 *   boom  — sub impact (the pod hitting the ground)
 */
export function scoreHit(kind: 'braam' | 'bloom' | 'boom'): void {
  const context = ensureContext();
  if (!context || !master || muted) return;
  const now = context.currentTime;
  const out = context.createGain();
  out.connect(master);

  const tone = (semis: number, octave: number, type: Wave, gain: number, attack: number, hold: number, release: number) => {
    const osc = context.createOscillator();
    osc.type = type;
    osc.frequency.value = hzForSemis(semis, octave);
    const env = context.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(Math.max(0.001, gain), now + attack);
    env.gain.setValueAtTime(Math.max(0.001, gain), now + attack + hold);
    env.gain.exponentialRampToValueAtTime(0.0001, now + attack + hold + release);
    osc.connect(env);
    env.connect(out);
    osc.start(now);
    osc.stop(now + attack + hold + release + 0.1);
  };

  if (kind === 'braam') {
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(220, now);
    filter.frequency.exponentialRampToValueAtTime(1600, now + 0.5);
    filter.frequency.exponentialRampToValueAtTime(400, now + 2.8);
    out.disconnect();
    out.connect(filter);
    filter.connect(master);
    tone(0, 0, 'sawtooth', 0.16, 0.35, 0.5, 2.2);
    tone(0, -12, 'sawtooth', 0.14, 0.35, 0.5, 2.2);
    tone(7, 0, 'sawtooth', 0.09, 0.4, 0.5, 2.0);
  } else if (kind === 'bloom') {
    for (const [i, semis] of [0, 4, 7, 14].entries()) {
      tone(semis, 24, 'triangle', 0.07 - i * 0.01, 0.05 + i * 0.06, 0.4, 2.6);
    }
    tone(0, 12, 'sine', 0.06, 0.1, 0.5, 3.0);
  } else {
    tone(0, -12, 'sine', 0.3, 0.01, 0.05, 1.2);
    tone(1, -12, 'sine', 0.12, 0.01, 0.02, 0.5);
  }
}
