import {
  getAudioContext,
  getMusicBus,
  isMusicMuted,
  unlockAudio
} from './audioCore.ts';
import {
  getMusicPrimitives,
  setMusicChord,
  setMusicPrimitiveTargets
} from './musicPrimitives.ts';
import { nextGridStep, type HitQuantize } from './generative/transport.ts';
import { HIT_MIN_LEAD_S, PHRASE_BARS } from './generative/tuning.ts';

// --- The score engine --------------------------------------------------------------------
//
// A fully procedural (WebAudio, zero assets) film-score instrument. Hans-Zimmer
// grammar built from era-appropriate synthesis; ONE instrument whose voices
// retune rather than swap, played through moods (see story/storyScore.ts for
// the story's mood table).
//
// Voices: PAD (4 chord tones × 2 detuned saws → lowpass), SUB (sine drone),
// OSTINATO (lookahead-scheduled pluck pattern), MELODY (generative triangle
// phrases → dotted-8th delay), RISER (filtered noise swell), HITS (braam /
// bloom / boom one-shots). Output rides the shared music bus (audioCore), so
// the score ducks/muffles/compresses with the rest of the mix.

type Wave = 'square' | 'sawtooth' | 'triangle' | 'sine';

export interface ScoreMood {
  /** Semitones above the root (A1 = 55 Hz) for the pad chord (max 4 tones). */
  chord: number[];
  /**
   * Harmonic motion: chords cycled every 2 bars (pad/sub retune, ostinato
   * transposes to each chord's root). Omitted = static `chord` (cutscenes,
   * where the intensity rail IS the movement).
   */
  progression?: number[][];
  /** Ostinato pattern in semitones RELATIVE TO THE CURRENT CHORD ROOT. */
  pattern: Array<number | null>;
  /** Generative lead: scale (semis from root) + phrase probability per 4 bars. */
  melody?: { scale: number[]; density: number };
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

/**
 * The CELESTIAL IDLE BED: when no mood leads, the instrument never fully
 * leaves — it holds a soft consonant space pad (drifting through open fifths
 * and add9 colors, sparse distant lead) UNDER the streamed music, scaled by the
 * wonder/warmth primitives. Whatever combination of factors the world produces,
 * something harmonic is always breathing.
 */
const IDLE_MOOD: ScoreMood = {
  chord: [0, 7, 12],
  progression: [[0, 7, 12], [5, 12, 19], [7, 14, 19], [0, 7, 16]],
  pattern: [null, null, null, null, null, null, null, null],
  melody: { scale: [0, 7, 12, 14, 19, 24], density: 0.14 },
  tempo: 46,
  wave: 'triangle',
  pad: 0.07,
  sub: 0.05,
  ost: 0,
  riser: 0,
  baseline: 0.3,
  octave: 12
};

// --- engine state ---------------------------------------------------------------------

let built = false;
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

let melodyGain: GainNode | null = null;
let melodyFilter: BiquadFilterNode | null = null;
let melodyDelay: DelayNode | null = null;

// The idle bed leads from the very first unlock — the instrument is never off.
let mood: ScoreMood | null = IDLE_MOOD;
/** True when the celestial idle bed leads (no mood set) — extra quiet. */
let idle = true;
/**
 * P3: the generative bed (bedEngine) replaces the celestial idle bed as the
 * sandbox floor. While it leads AND no story mood is set, this engine's idle
 * voice stays silent and stops publishing the harmonic center — ONE harmonic
 * truth (the bed's harmony brain). Story moods keep full authority: any
 * non-null mood reclaims the instrument and the center instantly.
 */
let bedLead = false;
/** Grid quantizer registered by the generative bed (its transport owns the sandbox grid). */
let bedQuantizer: ((quantize: HitQuantize) => number | null) | null = null;
/** One-shot hit output at fixed gain, so grid hits sound even while idle yields. */
let hitBus: GainNode | null = null;
const HIT_BUS_GAIN = 0.9; // matches the shipped mood-era master level for hits
let intensity = IDLE_MOOD.baseline;
let schedulerTimer: number | null = null;
let nextNoteAt = 0;
let patternStep = 0;
let currentChord: number[] = [0];
let chordIndex = 0;
/** Melody phrase state: scale-degree index of the last note (random walk). */
let melodyDegree = 4;

const STEPS_PER_BAR = 8; // 8th notes, 4/4
const STEPS_PER_BEAT = 2; // quarter-note beat on the 8th-note step grid
const STEPS_PER_CHORD = STEPS_PER_BAR * 2;
const STEPS_PER_PHRASE_SLOT = STEPS_PER_BAR * 4;

const hzForSemis = (semis: number, octaveShift = 0) => ROOT_HZ * Math.pow(2, (semis + octaveShift) / 12);

function ensureScore(): AudioContext | null {
  const ctx = getAudioContext();
  const bus = getMusicBus();
  if (!ctx || !bus) return null;
  if (built) return ctx;
  built = true;

  master = ctx.createGain();
  master.gain.value = 0;
  master.connect(bus);

  hitBus = ctx.createGain();
  hitBus.gain.value = HIT_BUS_GAIN;
  hitBus.connect(bus);

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
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(padFilter!);
    const mk = (detune: number) => {
      const osc = ctx.createOscillator();
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
  // MELODY lead bus: triangle phrases → gentle lowpass → dotted-8th feedback
  // delay (the cinematic space that keeps sparse phrases alive).
  melodyFilter = ctx.createBiquadFilter();
  melodyFilter.type = 'lowpass';
  melodyFilter.frequency.value = 2200;
  melodyGain = ctx.createGain();
  melodyGain.gain.value = 0.9;
  const delay = ctx.createDelay(1.5);
  melodyDelay = delay;
  delay.delayTime.value = 0.42;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.32;
  const delayMix = ctx.createGain();
  delayMix.gain.value = 0.45;
  melodyFilter.connect(melodyGain);
  melodyGain.connect(master);
  melodyGain.connect(delay);
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(delayMix);
  delayMix.connect(master);

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
    const ctx = getAudioContext();
    if (!ctx || !mood) return;
    applyRails(ctx);
    // The generative bed owns the sandbox: while it leads and no story mood
    // is set, this engine's idle voice schedules nothing (master is at 0 and
    // the bed publishes the harmonic center).
    if (idle && bedLead) return;
    const stepSeconds = 60 / mood.tempo / 2; // 8th notes
    while (nextNoteAt < ctx.currentTime + 0.18) {
      if (nextNoteAt < ctx.currentTime) nextNoteAt = ctx.currentTime;

      // Harmonic motion: the progression turns every two bars; pad/sub glide
      // to the new chord and the ostinato transposes with its root.
      if (mood.progression && patternStep % STEPS_PER_CHORD === 0) {
        chordIndex = Math.floor(patternStep / STEPS_PER_CHORD) % mood.progression.length;
        currentChord = mood.progression[chordIndex];
        retuneVoices(ctx);
      }
      const chordRoot = currentChord[0] ?? 0;

      const semis = mood.pattern[patternStep % mood.pattern.length];
      // Humanize: soft velocity drift + the occasional dropped note when calm.
      const dropped = intensity < 0.45 && Math.random() < 0.08;
      if (semis != null && !dropped && ostFilter) {
        const osc = ctx.createOscillator();
        osc.type = mood.wave;
        osc.frequency.value = hzForSemis(chordRoot + semis, mood.octave);
        const velocity = 0.78 + Math.random() * 0.22;
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, nextNoteAt);
        env.gain.linearRampToValueAtTime(velocity, nextNoteAt + 0.008);
        env.gain.exponentialRampToValueAtTime(0.001, nextNoteAt + stepSeconds * 1.7);
        osc.connect(env);
        env.connect(ostFilter);
        osc.start(nextNoteAt);
        osc.stop(nextNoteAt + stepSeconds * 2);
      }

      // The lead: every four bars, maybe a phrase — a stepwise random walk over
      // the mood's scale, so the harmony always has a singer above it.
      if (mood.melody && patternStep % STEPS_PER_PHRASE_SLOT === 0 && Math.random() < mood.melody.density) {
        schedulePhrase(ctx, nextNoteAt, stepSeconds);
      }

      patternStep++;
      nextNoteAt += stepSeconds;
    }
  }, 60);
}

/** A 5–8 note phrase: mostly stepwise, breathing rhythm, through the delay bus. */
function schedulePhrase(ctx: AudioContext, startAt: number, stepSeconds: number): void {
  if (!mood?.melody || !melodyFilter) return;
  const scale = mood.melody.scale;
  const chordRoot = currentChord[0] ?? 0;
  const noteCount = 5 + Math.floor(Math.random() * 4);
  let at = startAt;
  for (let i = 0; i < noteCount; i++) {
    // Random walk: mostly ±1 degree, occasional leap, gravity toward mid-scale.
    const drift = Math.random() < 0.2 ? (Math.random() < 0.5 ? -2 : 2) : (Math.random() < 0.5 ? -1 : 1);
    melodyDegree = Math.max(0, Math.min(scale.length - 1, melodyDegree + drift + (melodyDegree > scale.length - 2 ? -1 : 0)));
    const durSteps = [2, 2, 3, 4][Math.floor(Math.random() * 4)];
    const dur = durSteps * stepSeconds;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = hzForSemis(chordRoot + scale[melodyDegree], 36);
    const gain = (0.05 + 0.05 * intensity) * (0.8 + Math.random() * 0.2);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(gain, at + 0.06);
    env.gain.setValueAtTime(gain, at + dur * 0.6);
    env.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(env);
    env.connect(melodyFilter);
    osc.start(at);
    osc.stop(at + dur + 0.1);
    at += dur;
    // Breathe: occasional rest between notes.
    if (Math.random() < 0.25) at += stepSeconds;
  }
}

/** Smooth the mood/intensity-dependent parameters toward their targets. */
function applyRails(ctx: AudioContext): void {
  if (!master) return;
  const now = ctx.currentTime;
  const prim = getMusicPrimitives();
  // Volume and mute live on the shared music bus (audioCore); the score master
  // carries only the score's own place in the mix.
  const on = mood != null && !(idle && bedLead);
  // The idle bed sits UNDER the streamed music, lifted by the wonder axis.
  const idleScale = idle ? 0.32 * (0.5 + 0.7 * prim.wonder) : 1;
  master.gain.setTargetAtTime(on ? 0.9 * idleScale : 0, now, idle ? 1.2 : 0.4);
  if (!mood) return;
  if (idle) intensity = 0.2 + 0.5 * prim.wonder; // the sky sets the idle breath
  const boost = 0.55 + 0.45 * intensity;
  padGain?.gain.setTargetAtTime(mood.pad * boost, now, 0.8);
  subGain?.gain.setTargetAtTime(mood.sub * boost, now, 0.8);
  ostGain?.gain.setTargetAtTime(mood.ost * (0.35 + 0.65 * intensity), now, 0.4);
  // Warmth opens the pad; tension (via intensity) opens everything else.
  padFilter?.frequency.setTargetAtTime(320 + intensity * 2100 + prim.warmth * 500, now, 0.7);
  ostFilter?.frequency.setTargetAtTime(700 + intensity * 2600, now, 0.5);
  riserGain?.gain.setTargetAtTime(mood.riser * intensity * intensity, now, 0.35);
  riserFilter?.frequency.setTargetAtTime(220 + intensity * 1900, now, 0.4);
}

function retuneVoices(ctx: AudioContext): void {
  if (!mood) return;
  const now = ctx.currentTime;
  padVoices.forEach((voice, i) => {
    const semis = currentChord[i];
    const active = semis != null;
    voice.gain.gain.setTargetAtTime(active ? 0.5 : 0, now, 1.2);
    if (active) {
      const hz = hzForSemis(semis, 12);
      voice.oscA.frequency.setTargetAtTime(hz, now, 0.9);
      voice.oscB.frequency.setTargetAtTime(hz, now, 0.9);
    }
  });
  subOsc?.frequency.setTargetAtTime(hzForSemis(currentChord[0] ?? 0, 0), now, 1.0);
  // The lead's echo keeps time with the mood (dotted 8th).
  melodyDelay?.delayTime.setTargetAtTime((60 / mood.tempo) * 0.75, now, 0.5);
  // Publish the harmonic center — every other voice in the game reads this.
  // ONE harmonic truth: while the generative bed leads the sandbox, ITS
  // harmony brain is the sole publisher and the idle voice stays quiet.
  if (!(idle && bedLead)) setMusicChord(currentChord[0] ?? 0, currentChord);
}

// --- public API -------------------------------------------------------------------------

export function unlockScore(): void {
  ensureScore();
  unlockAudio();
}

/**
 * P3: the generative bed announces itself as the sandbox floor. While true
 * and no story mood leads, the celestial idle voice yields (silent, no chord
 * publishing) — the bed IS the idle bed now. Story moods are unaffected.
 */
export function setGenerativeBedLead(lead: boolean): void {
  bedLead = lead;
}

/** True while a story mood (not the idle/generative floor) leads the score. */
export function isScoreMoodLeading(): boolean {
  return !idle;
}

/**
 * The generative bed registers its transport's quantizer so grid-synced hits
 * land on the SANDBOX grid while the bed leads (one clock, §8.1).
 */
export function registerBedQuantizer(fn: ((quantize: HitQuantize) => number | null) | null): void {
  bedQuantizer = fn;
}

/**
 * Retune the whole instrument to a mood. `null` hands the instrument to the
 * CELESTIAL IDLE BED — the score never leaves, it recedes.
 */
export function setScoreMood(next: ScoreMood | null): void {
  idle = next == null;
  mood = next ?? IDLE_MOOD;
  intensity = mood.baseline;
  patternStep = 0;
  chordIndex = 0;
  currentChord = mood.progression?.[0] ?? mood.chord;
  melodyDegree = 4;
  const ctx = built ? getAudioContext() : null;
  if (ctx) retuneVoices(ctx);
  // Publish the drama rails while a mood leads.
  if (!idle) setMusicPrimitiveTargets({ tension: mood.baseline, energy: Math.min(1, mood.tempo / 130) });
}

/** Timeline hook: the story director drives this with its OWN ramp values. */
export function setScoreIntensity(value: number): void {
  intensity = Math.min(1, Math.max(0, value));
  if (!idle) setMusicPrimitiveTargets({ tension: intensity, energy: intensity * 0.85 });
}

/**
 * One-shot punctuation.
 *   braam — the Zimmer horn (stacked saws, slow bite, long tail)
 *   bloom — a major chord opening (the color/texture arrivals)
 *   boom  — sub impact (the pod hitting the ground)
 */
export function scoreHit(kind: 'braam' | 'bloom' | 'boom'): void {
  const context = ensureScore();
  if (!context || !master || isMusicMuted()) return;
  renderHit(context, kind, context.currentTime);
}

/**
 * Grid-synced punctuation (P2, §8.1): schedule a hit ON the musical grid and
 * return the exact audio time it will land, so VISUALS can chase AUDIO — a
 * drop that lands off-grid is a defect. Additive API; `scoreHit` stays for
 * legacy reflex moments. Returns null when the score cannot sound (no
 * context / muted). Quantization rides the shipped scheduler's step grid
 * ('phrase' = PHRASE_BARS bars); P3 migrates it onto the generative
 * transport when that clock takes over.
 */
export function scheduleHit(kind: 'braam' | 'bloom' | 'boom', quantize: HitQuantize): number | null {
  const context = ensureScore();
  if (!context || !master || isMusicMuted() || !mood) return null;
  // While the generative bed leads the sandbox, ITS transport owns the grid.
  if (idle && bedLead && bedQuantizer) {
    const time = bedQuantizer(quantize);
    if (time != null) {
      renderHit(context, kind, time);
      return time;
    }
    return null;
  }
  const stepSeconds = 60 / mood.tempo / 2; // 8th notes, matching the scheduler
  const stepsPerUnit =
    quantize === 'beat' ? STEPS_PER_BEAT :
    quantize === 'bar' ? STEPS_PER_BAR :
    STEPS_PER_BAR * PHRASE_BARS;
  const notBefore = context.currentTime + HIT_MIN_LEAD_S;
  // The scheduler clamps a stale nextNoteAt to currentTime before scheduling
  // step `patternStep` — mirror that so our grid matches the audible one. A
  // never-started grid (nextNoteAt 0) anchors at the lead horizon.
  const base = nextNoteAt > 0 ? Math.max(nextNoteAt, context.currentTime) : notBefore;
  const { time } = nextGridStep(patternStep, base, stepSeconds, stepsPerUnit, notBefore);
  renderHit(context, kind, time);
  return time;
}

function renderHit(context: AudioContext, kind: 'braam' | 'bloom' | 'boom', now: number): void {
  // Hits ride a fixed-gain bus so grid punctuation (blooms/booms the bed
  // schedules) still sounds while the idle voice yields to the bed.
  if (!hitBus) return;
  const out = context.createGain();
  out.connect(hitBus);

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
    filter.connect(hitBus);
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
