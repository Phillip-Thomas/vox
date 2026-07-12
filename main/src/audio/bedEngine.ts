import type { ArchetypeId } from '../game/data/planetArchetypes.ts';
import { getMusicBus, makeNoiseBuffer, peekAudioContext } from './audioCore.ts';
import { setMusicChord } from './musicPrimitives.ts';
import {
  isScoreMoodLeading,
  registerBedQuantizer,
  scheduleHit,
  setGenerativeBedLead
} from './scoreEngine.ts';
import {
  createBedConductor,
  planBedBar,
  type BedBarPlan,
  type BedConductorState
} from './generative/bedConductor.ts';
import { neutralBedSignals, type BedSignals } from './generative/worldSignals.ts';
import {
  advanceTransportBar,
  barDurationSec,
  createTransport,
  nextQuantumTime,
  requestTransportMeter,
  requestTransportTempo,
  type HitQuantize,
  type TransportState
} from './generative/transport.ts';
import { humanizeOffsetMs, SLOTS_PER_BAR } from './generative/rhythm.ts';
import { musicUnit, SALT_PERC_PAN } from './generative/seededMusic.ts';
import {
  BED_LEAD_LEVEL,
  BED_MASTER_GAIN,
  BED_OST_LEVEL,
  BED_PAD_LEVEL,
  BED_PERC_LEVEL,
  BED_RESUME_FADE_S,
  BED_RISER_LEVEL,
  BED_SHIMMER_LEVEL,
  BED_SUB_LEVEL,
  BED_TICK_LEVEL,
  BED_WASH_LEVEL,
  BED_YIELD_FADE_S,
  DRIFT_TEXTURE_SPAN,
  HIT_MIN_LEAD_S,
  PAD_DETUNE_CENTS_MAX,
  PAD_DETUNE_CENTS_MIN,
  PAD_OCTAVE_SHIFT,
  PAD_WIDTH_MAX,
  PHRASE_BARS,
  REVERB_DECAY,
  REVERB_SECONDS,
  REVERB_WET_MAX,
  SHIMMER_OCTAVE_SHIFT,
  SIDECHAIN_RELEASE_BEATS,
  SUB_OCTAVE_SHIFT,
  TICK_GLIDE_S
} from './generative/tuning.ts';

// --- The generative bed engine (P3 rim) ------------------------------------------------------
//
// The thin WebAudio rim around the pure bed conductor: persistent voices,
// param automation, one lookahead scheduler on the shared context clock.
// EVERY musical decision comes from planBedBar (pure, seeded, tested); this
// file only converts plans into scheduled ramps and bounded-lifetime
// transients. rAF writes ONLY the signals snapshot (intent); nothing here is
// called per frame with node churn.
//
// Leadership: the bed is the sandbox foreground. While a story mood leads
// (frozen contract), the bed fades out, freezes its planner, and stops
// publishing the harmonic center — the mood plays the score engine exactly
// as shipped. When the mood ends the bed resumes where it left off.

// --- Rim-only synth constants (grouped; musical grammar lives in generative/tuning.ts) --------

const SCHEDULER_INTERVAL_MS = 60; // the shipped "Tale of Two Clocks" cadence
const LOOKAHEAD_S = 0.18;
/** Re-anchor the transport when it lags this many bars behind the clock (tab hides, story leads). */
const TRANSPORT_STALE_BARS = 1.5;
const PAD_FILTER_MIN_HZ = 260;
const PAD_FILTER_SPAN_HZ = 2400;
const PAD_GLIDE_TAU_S = 0.7;
const SUB_GLIDE_TAU_S = 0.25;
const SUB_MOTIF_GLIDE_TAU_S = 0.05;
const CHIP_DRONE_LEVEL = 0.028;
const CHIP_DRONE_OCTAVE = 12;
const OST_FILTER_MIN_HZ = 700;
const OST_FILTER_SPAN_HZ = 2600;
const OST_ATTACK_S = 0.008;
const LEAD_FILTER_HZ = 2200;
const LEAD_ATTACK_S = 0.05;
const LEAD_DELAY_MIX = 0.4;
const LEAD_DELAY_FEEDBACK = 0.3;
const SHIMMER_LFO_HZ = 0.13;
const SHIMMER_LFO_DEPTH = 0.4; // × base gain
const WASH_FILTER_MIN_HZ = 280;
const WASH_FILTER_SPAN_HZ = 520;
const WASH_GUST_LFO_DEPTH = 0.5; // × base gain
const WASH_GUST_LFO_BASE_HZ = 0.35;
const WASH_PAN_LFO_HZ = 0.05;
const PERC_FILTER_BASE_HZ = 2600;
const PERC_FILTER_METAL_LIFT_HZ = 3400;
const PERC_Q_BASE = 1.2;
const PERC_Q_METAL = 6;
const PERC_DECAY_S = 0.09;
const PERC_PAN_SPREAD = 0.6;
const RISER_FILTER_FROM_HZ = 220;
const RISER_FILTER_TO_HZ = 2300;
const RISER_CUT_S = 0.15;
const TICK_FREQ_WOOD_HZ = 1500;
const TICK_FREQ_METAL_HZ = 2900;
const TICK_PARTIAL_RATIO = 2.76; // inharmonic col-legno partial, scaled by `metal`
const TICK_DECAY_S = 0.055;
const TICK_BAR_FADE_FRAC = 0.4; // presence fades over whole bars (τ = frac × bar)
const WIND_STRENGTH_NORM = 1.7; // windProfile strength ceiling
const MASTER_TAU_S = 1.2;
const BAR_PARAM_TAU_S = 0.5;

// --- Engine state ------------------------------------------------------------------------------

let built = false;
let signals: BedSignals = neutralBedSignals();
let conductor: BedConductorState | null = null;
let transport: TransportState | null = null;
let schedulerTimer: number | null = null;
let yielding = false;
let tickHzLive = 1;
let tickHzTarget = 1;
let tickLevelApplied = -1;
let nextTickAt = 0;
let noteSalt = 0;
let leadDelay: DelayNode | null = null;
let shimmerLfoDepth: GainNode | null = null;

let bedMaster: GainNode | null = null;
let bedBus: GainNode | null = null;
let breathGain: GainNode | null = null;
let reverbSend: GainNode | null = null;
let reverbWet: GainNode | null = null;

interface PadVoice {
  oscA: OscillatorNode;
  oscB: OscillatorNode;
  gain: GainNode;
  pan: StereoPannerNode;
}
let padVoices: PadVoice[] = [];
let padFilter: BiquadFilterNode | null = null;
let padGain: GainNode | null = null;

let subOsc: OscillatorNode | null = null;
let subGain: GainNode | null = null;
let chipOsc: OscillatorNode | null = null;
let chipGain: GainNode | null = null;

let ostFilter: BiquadFilterNode | null = null;
let ostGain: GainNode | null = null;

let leadFilter: BiquadFilterNode | null = null;
let leadGain: GainNode | null = null;

let shimmerA: OscillatorNode | null = null;
let shimmerB: OscillatorNode | null = null;
let shimmerGain: GainNode | null = null;
let shimmerPan: StereoPannerNode | null = null;

let washFilter: BiquadFilterNode | null = null;
let washGain: GainNode | null = null;
let washPan: StereoPannerNode | null = null;
let washGustLfo: OscillatorNode | null = null;
let washGustDepth: GainNode | null = null;
let washPanLfo: OscillatorNode | null = null;
let washPanDepth: GainNode | null = null;

let percFilter: BiquadFilterNode | null = null;
let percGain: GainNode | null = null;
let percPan: StereoPannerNode | null = null;
let percNoise: AudioBuffer | null = null;

let riserFilter: BiquadFilterNode | null = null;
let riserGain: GainNode | null = null;

let tickGain: GainNode | null = null;

const hzOf = (semis: number): number => 55 * Math.pow(2, semis / 12);
const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

// --- Public API ----------------------------------------------------------------------------------

/** rAF writes the world snapshot here — intent only, never scheduling. */
export function updateBedSignals(next: BedSignals): void {
  signals = next;
  ensureBed();
}

/**
 * (Re)target the bed at a planet. New key, mode, motif, tempo, meter — a new
 * musical place. Tempo/meter changes land on the next bar line (§8.1 law).
 */
export function configureBedPlanet(
  planetSeed: number,
  archetype?: ArchetypeId,
  paletteBrightness?: number
): void {
  if (conductor && conductor.planetSeed === planetSeed) return;
  conductor = createBedConductor(planetSeed, { archetype, paletteBrightness });
  if (transport) {
    requestTransportTempo(transport, conductor.genome.baseTempo);
    requestTransportMeter(transport, conductor.genome.meter);
  }
}

/** The bed transport's grid, for scoreEngine.scheduleHit while the bed leads. */
function bedQuantize(quantize: HitQuantize): number | null {
  const ctx = peekAudioContext();
  if (!ctx || !transport) return null;
  return nextQuantumTime(transport, ctx.currentTime + HIT_MIN_LEAD_S, quantize, PHRASE_BARS);
}

// --- Node graph ------------------------------------------------------------------------------------

function ensureBed(): void {
  if (built) return;
  const ctx = peekAudioContext();
  const bus = getMusicBus();
  if (!ctx || !bus) return;
  built = true;

  bedMaster = ctx.createGain();
  bedMaster.gain.value = 0;
  bedMaster.connect(bus);

  bedBus = ctx.createGain();
  bedBus.gain.value = 1;
  bedBus.connect(bedMaster);

  // Reverb: generated exponential-decay impulse (deterministic), one
  // convolver. Only the air voices (pads/shimmer via breath, lead, delay,
  // percussion) feed the send — sub, tick, wash, and riser stay dry.
  reverbSend = ctx.createGain();
  reverbSend.gain.value = 0.5;
  const convolver = ctx.createConvolver();
  convolver.buffer = makeImpulse(ctx);
  reverbWet = ctx.createGain();
  reverbWet.gain.value = 0;
  reverbSend.connect(convolver);
  convolver.connect(reverbWet);
  reverbWet.connect(bedMaster);

  // Sidechain-style breathing bus (pads + shimmer duck on the beat).
  breathGain = ctx.createGain();
  breathGain.gain.value = 1;
  breathGain.connect(bedBus);
  breathGain.connect(reverbSend);

  // PAD CHOIR: 3 voices × 2 detuned saws, per-voice pan, shared lowpass.
  padFilter = ctx.createBiquadFilter();
  padFilter.type = 'lowpass';
  padFilter.frequency.value = 700;
  padFilter.Q.value = 0.6;
  padGain = ctx.createGain();
  padGain.gain.value = 0;
  padFilter.connect(padGain);
  padGain.connect(breathGain);
  padVoices = [0, 1, 2].map((i) => {
    const gain = ctx.createGain();
    gain.gain.value = 1 / 3;
    const pan = ctx.createStereoPanner();
    pan.pan.value = 0;
    gain.connect(pan);
    pan.connect(padFilter!);
    const mk = (detune: number): OscillatorNode => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = hzOf(12 + i * 4 + PAD_OCTAVE_SHIFT);
      osc.detune.value = detune;
      osc.connect(gain);
      osc.start();
      return osc;
    };
    return { oscA: mk(-PAD_DETUNE_CENTS_MIN), oscB: mk(PAD_DETUNE_CENTS_MIN), gain, pan };
  });

  // TUNED SUB (sine at alive, triangle bass in the chip eras).
  subOsc = ctx.createOscillator();
  subOsc.type = 'sine';
  subOsc.frequency.value = hzOf(SUB_OCTAVE_SHIFT);
  subGain = ctx.createGain();
  subGain.gain.value = 0;
  subOsc.connect(subGain);
  subGain.connect(bedBus);
  subOsc.start();

  // CHIP DRONE: the bare-era quiet-bed floor (a barely-there pulse) — and the
  // paradox fold-back texture.
  chipOsc = ctx.createOscillator();
  chipOsc.type = 'square';
  chipOsc.frequency.value = hzOf(CHIP_DRONE_OCTAVE);
  chipGain = ctx.createGain();
  chipGain.gain.value = 0;
  chipOsc.connect(chipGain);
  chipGain.connect(bedBus);
  chipOsc.start();

  // OSTINATO pluck bus.
  ostFilter = ctx.createBiquadFilter();
  ostFilter.type = 'lowpass';
  ostFilter.frequency.value = 1400;
  ostGain = ctx.createGain();
  ostGain.gain.value = 0;
  ostFilter.connect(ostGain);
  ostGain.connect(bedBus);

  // LEAD motif bus → gentle lowpass → dotted-8th feedback delay.
  leadFilter = ctx.createBiquadFilter();
  leadFilter.type = 'lowpass';
  leadFilter.frequency.value = LEAD_FILTER_HZ;
  leadGain = ctx.createGain();
  leadGain.gain.value = 0;
  leadFilter.connect(leadGain);
  leadGain.connect(bedBus);
  const delay = ctx.createDelay(1.5);
  delay.delayTime.value = 0.4;
  const feedback = ctx.createGain();
  feedback.gain.value = LEAD_DELAY_FEEDBACK;
  const delayMix = ctx.createGain();
  delayMix.gain.value = LEAD_DELAY_MIX;
  leadGain.connect(delay);
  leadGain.connect(reverbSend);
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(delayMix);
  delayMix.connect(bedBus);
  delayMix.connect(reverbSend);
  leadDelay = delay;

  // SHIMMER: two high chord tones, slow LFO breathing, panned wide.
  shimmerGain = ctx.createGain();
  shimmerGain.gain.value = 0;
  shimmerPan = ctx.createStereoPanner();
  shimmerPan.pan.value = 0;
  shimmerGain.connect(shimmerPan);
  shimmerPan.connect(breathGain);
  shimmerA = ctx.createOscillator();
  shimmerA.type = 'sine';
  shimmerA.frequency.value = hzOf(12 + SHIMMER_OCTAVE_SHIFT);
  shimmerB = ctx.createOscillator();
  shimmerB.type = 'sine';
  shimmerB.frequency.value = hzOf(19 + SHIMMER_OCTAVE_SHIFT);
  shimmerA.connect(shimmerGain);
  shimmerB.connect(shimmerGain);
  shimmerA.start();
  shimmerB.start();
  const shimmerLfo = ctx.createOscillator();
  shimmerLfo.frequency.value = SHIMMER_LFO_HZ;
  const shimmerDepth = ctx.createGain();
  shimmerDepth.gain.value = 0;
  shimmerLfo.connect(shimmerDepth);
  shimmerDepth.connect(shimmerGain.gain);
  shimmerLfo.start();
  shimmerLfoDepth = shimmerDepth;

  // WASH: filtered noise; its LFOs breathe with the planet's gust field.
  const washNoise = ctx.createBufferSource();
  washNoise.buffer = makeNoiseBuffer(ctx, 3);
  washNoise.loop = true;
  washFilter = ctx.createBiquadFilter();
  washFilter.type = 'lowpass';
  washFilter.frequency.value = WASH_FILTER_MIN_HZ;
  washFilter.Q.value = 0.4;
  washGain = ctx.createGain();
  washGain.gain.value = 0;
  washPan = ctx.createStereoPanner();
  washPan.pan.value = 0;
  washNoise.connect(washFilter);
  washFilter.connect(washGain);
  washGain.connect(washPan);
  washPan.connect(bedBus);
  washNoise.start();
  washGustLfo = ctx.createOscillator();
  washGustLfo.frequency.value = WASH_GUST_LFO_BASE_HZ;
  washGustDepth = ctx.createGain();
  washGustDepth.gain.value = 0;
  washGustLfo.connect(washGustDepth);
  washGustDepth.connect(washGain.gain);
  washGustLfo.start();
  washPanLfo = ctx.createOscillator();
  washPanLfo.frequency.value = WASH_PAN_LFO_HZ;
  washPanDepth = ctx.createGain();
  washPanDepth.gain.value = 0;
  washPanLfo.connect(washPanDepth);
  washPanDepth.connect(washPan.pan);
  washPanLfo.start();

  // PERCUSSION: shared bandpass + pan; per-hit noise transients.
  percNoise = makeNoiseBuffer(ctx, 1);
  percFilter = ctx.createBiquadFilter();
  percFilter.type = 'bandpass';
  percFilter.frequency.value = PERC_FILTER_BASE_HZ;
  percFilter.Q.value = PERC_Q_BASE;
  percGain = ctx.createGain();
  percGain.gain.value = 0;
  percPan = ctx.createStereoPanner();
  percPan.pan.value = 0;
  percFilter.connect(percGain);
  percGain.connect(percPan);
  percPan.connect(bedBus);
  percPan.connect(reverbSend);

  // RISER: looped noise → bandpass, ramped across BUILD phrases.
  const riserNoise = ctx.createBufferSource();
  riserNoise.buffer = makeNoiseBuffer(ctx, 2);
  riserNoise.loop = true;
  riserFilter = ctx.createBiquadFilter();
  riserFilter.type = 'bandpass';
  riserFilter.frequency.value = RISER_FILTER_FROM_HZ;
  riserFilter.Q.value = 1.1;
  riserGain = ctx.createGain();
  riserGain.gain.value = 0;
  riserNoise.connect(riserFilter);
  riserFilter.connect(riserGain);
  riserGain.connect(bedBus);
  riserNoise.start();

  // WORLD-CLOCK TICK bus (transients scheduled on their own non-musical clock).
  tickGain = ctx.createGain();
  tickGain.gain.value = 0;
  tickGain.connect(bedBus);

  // Leadership plumbing: the bed is the sandbox floor from now on.
  setGenerativeBedLead(true);
  registerBedQuantizer(bedQuantize);

  startScheduler();
}

function makeImpulse(ctx: AudioContext): AudioBuffer {
  const frames = Math.floor(ctx.sampleRate * REVERB_SECONDS);
  const buffer = ctx.createBuffer(2, frames, ctx.sampleRate);
  // Deterministic xorshift noise — reproducible tail, no Math.random.
  let s = 0x9e3779b9;
  const rand = (): number => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) / 4294967296) * 2 - 1;
  };
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < frames; i++) {
      data[i] = rand() * Math.pow(1 - i / frames, REVERB_DECAY);
    }
  }
  return buffer;
}

// --- The scheduler (one clock; bars planned ahead of ctx.currentTime) -------------------------------

function startScheduler(): void {
  if (schedulerTimer != null) return;
  schedulerTimer = window.setInterval(schedulerTick, SCHEDULER_INTERVAL_MS);
}

function schedulerTick(): void {
  const ctx = peekAudioContext();
  if (!ctx || !bedMaster || !conductor) return;
  const now = ctx.currentTime;
  const s = signals;

  // Story authority: fade out, freeze the planner, publish nothing.
  const storyLeads = isScoreMoodLeading();
  if (storyLeads) {
    if (!yielding) {
      yielding = true;
      bedMaster.gain.cancelScheduledValues(now);
      bedMaster.gain.setTargetAtTime(0, now, BED_YIELD_FADE_S / 3);
    }
    return;
  }
  if (yielding) {
    yielding = false;
    bedMaster.gain.setTargetAtTime(BED_MASTER_GAIN, now, BED_RESUME_FADE_S / 3);
  }

  if (!transport) {
    transport = createTransport(now + LOOKAHEAD_S, conductor.genome.baseTempo, conductor.genome.meter);
  }
  const barDur = barDurationSec(transport.bpm, transport.meter);
  // Tab hides / story leads leave the transport behind the clock: re-anchor
  // on a fresh bar instead of burst-replaying the gap.
  if (now > transport.barStartTime + barDur * TRANSPORT_STALE_BARS) {
    transport.barStartTime = now + 0.05;
  }

  // Plan and schedule every bar whose start enters the lookahead horizon.
  while (transport.barStartTime < now + LOOKAHEAD_S) {
    const plan = planBedBar(conductor, s);
    scheduleBar(ctx, plan, transport);
    advanceTransportBar(transport);
  }

  scheduleTicks(ctx, now);
}

// --- Bar rendering -----------------------------------------------------------------------------------

function scheduleBar(ctx: AudioContext, plan: BedBarPlan, t: TransportState): void {
  const barTime = t.barStartTime;
  const barDur = barDurationSec(t.bpm, t.meter);
  const slotSec = barDur / SLOTS_PER_BAR;
  const beatDur = barDur / t.meter.beatsPerBar;
  const s = signals;
  const g = plan.gates;
  const seed = conductor!.planetSeed;

  // ONE harmonic truth: the bed publishes while it leads (we only get here
  // when no story mood leads).
  setMusicChord(plan.publish.root, plan.publish.tones);

  // Master: scene gain (REST floor is carried by the arrangement levels — the
  // master itself never parks at zero while the bed leads).
  bedMaster!.gain.setTargetAtTime(BED_MASTER_GAIN * plan.policy.gain, barTime, MASTER_TAU_S);

  // -- Pads: retune to the voicing at the bar line, glide (retune-not-swap).
  const uppers = plan.publish.tones.slice(1, 4);
  const detune =
    PAD_DETUNE_CENTS_MIN + (PAD_DETUNE_CENTS_MAX - PAD_DETUNE_CENTS_MIN) * clamp01(s.chroma) * g.stereoWidth;
  const width = PAD_WIDTH_MAX * g.stereoWidth;
  padVoices.forEach((voice, i) => {
    const semis = uppers[i];
    if (semis == null) return;
    const hz = hzOf(semis + PAD_OCTAVE_SHIFT);
    voice.oscA.frequency.setTargetAtTime(hz, barTime, PAD_GLIDE_TAU_S);
    voice.oscB.frequency.setTargetAtTime(hz, barTime, PAD_GLIDE_TAU_S);
    voice.oscA.detune.setTargetAtTime(-detune, barTime, BAR_PARAM_TAU_S);
    voice.oscB.detune.setTargetAtTime(detune, barTime, BAR_PARAM_TAU_S);
    voice.pan.pan.setTargetAtTime((i - 1) * width, barTime, BAR_PARAM_TAU_S);
  });
  padGain!.gain.setTargetAtTime(BED_PAD_LEVEL * plan.levels.pad * g.padChoir, barTime, BAR_PARAM_TAU_S);
  padFilter!.frequency.setTargetAtTime(
    PAD_FILTER_MIN_HZ + plan.padBrightness * PAD_FILTER_SPAN_HZ,
    barTime,
    PAD_GLIDE_TAU_S
  );

  // -- Sub: root drone; chip eras get the triangle bass an octave up.
  const chipEra = g.padChoir < 0.5;
  if (subOsc!.type !== (chipEra ? 'triangle' : 'sine')) subOsc!.type = chipEra ? 'triangle' : 'sine';
  const subSemis = plan.publish.root + (chipEra ? 0 : SUB_OCTAVE_SHIFT);
  if (!plan.subTakesMotif) {
    subOsc!.frequency.setTargetAtTime(hzOf(subSemis), barTime, SUB_GLIDE_TAU_S);
  }
  subGain!.gain.setTargetAtTime(BED_SUB_LEVEL * plan.levels.sub * g.sub, barTime, BAR_PARAM_TAU_S);

  // -- Chip drone: the bare-era floor and the paradox fold-back.
  chipOsc!.frequency.setTargetAtTime(hzOf(plan.publish.root + CHIP_DRONE_OCTAVE), barTime, SUB_GLIDE_TAU_S);
  chipGain!.gain.setTargetAtTime(
    CHIP_DRONE_LEVEL * g.chip * Math.max(plan.levels.pad, 0.6 * plan.levels.sub),
    barTime,
    BAR_PARAM_TAU_S
  );

  // -- Ostinato: transient plucks — or, underwater, the sub sings the tune.
  ostGain!.gain.setTargetAtTime(
    BED_OST_LEVEL * plan.levels.ostinato * (plan.subTakesMotif ? 0 : 1),
    barTime,
    BAR_PARAM_TAU_S
  );
  ostFilter!.frequency.setTargetAtTime(
    OST_FILTER_MIN_HZ + clamp01(s.energy) * OST_FILTER_SPAN_HZ,
    barTime,
    BAR_PARAM_TAU_S
  );
  for (const note of plan.ostinato) {
    const jitter = humanizeOffsetMs(seed, noteSalt++, s.organic) / 1000;
    const at = Math.max(ctx.currentTime, barTime + note.slot * slotSec + jitter);
    if (plan.subTakesMotif) {
      // The tuned sub takes the motif (§8.4): glide the sub through the cell.
      subOsc!.frequency.setTargetAtTime(hzOf(note.semis - 24), at, SUB_MOTIF_GLIDE_TAU_S);
      continue;
    }
    pluck(ctx, at, note.semis, note.velocity, note.durationSlots * slotSec, g.chip > 0.5 ? 'square' : 'triangle');
  }

  // -- Lead statements (rare; the tune's entrances carry the emotion).
  leadGain!.gain.setTargetAtTime(BED_LEAD_LEVEL * plan.levels.lead, barTime, BAR_PARAM_TAU_S);
  leadDelay?.delayTime.setTargetAtTime(beatDur * 0.75, barTime, BAR_PARAM_TAU_S);
  for (const note of plan.melody) {
    const jitter = humanizeOffsetMs(seed, noteSalt++, s.organic) / 1000;
    const at = Math.max(ctx.currentTime, barTime + note.slot * slotSec + jitter);
    leadNote(ctx, at, note.semis, note.velocity, note.durationSlots * slotSec);
  }

  // -- Shimmer + wash: the texture family, reweighted by the texture drift clock.
  const shimmerLean = 1 - DRIFT_TEXTURE_SPAN + 2 * DRIFT_TEXTURE_SPAN * plan.textureLean;
  const shimmerBase =
    BED_SHIMMER_LEVEL *
    plan.levels.texture *
    g.shimmer *
    shimmerLean *
    (0.5 + 0.5 * clamp01(s.crystalline));
  shimmerGain!.gain.setTargetAtTime(shimmerBase, barTime, MASTER_TAU_S);
  shimmerLfoDepth?.gain.setTargetAtTime(shimmerBase * SHIMMER_LFO_DEPTH, barTime, MASTER_TAU_S);
  const shimTones = [plan.publish.tones[1] ?? 12, plan.publish.tones[3] ?? 19];
  shimmerA!.frequency.setTargetAtTime(hzOf(shimTones[0] + SHIMMER_OCTAVE_SHIFT), barTime, MASTER_TAU_S);
  shimmerB!.frequency.setTargetAtTime(hzOf(shimTones[1] + SHIMMER_OCTAVE_SHIFT), barTime, MASTER_TAU_S);
  shimmerPan!.pan.setTargetAtTime(0.4 * g.stereoWidth, barTime, MASTER_TAU_S);

  const windNorm = clamp01(s.windStrength / WIND_STRENGTH_NORM);
  const washLean = 1 - DRIFT_TEXTURE_SPAN + 2 * DRIFT_TEXTURE_SPAN * (1 - plan.textureLean);
  const washBase = BED_WASH_LEVEL * plan.levels.texture * g.riser * windNorm * washLean;
  washGain!.gain.setTargetAtTime(washBase, barTime, MASTER_TAU_S);
  washGustDepth?.gain.setTargetAtTime(washBase * WASH_GUST_LFO_DEPTH, barTime, MASTER_TAU_S);
  washGustLfo?.frequency.setTargetAtTime(
    WASH_GUST_LFO_BASE_HZ * (0.5 + s.windGustSpeed), barTime, MASTER_TAU_S
  );
  washFilter!.frequency.setTargetAtTime(
    WASH_FILTER_MIN_HZ + windNorm * WASH_FILTER_SPAN_HZ + clamp01(s.windTurbulence) * 160,
    barTime,
    MASTER_TAU_S
  );
  washPanDepth?.gain.setTargetAtTime(
    Math.min(1, s.windVeer / 2) * g.stereoWidth, barTime, MASTER_TAU_S
  );

  // -- Percussion: Euclidean transients (the noise channel from `color` up).
  percGain!.gain.setTargetAtTime(BED_PERC_LEVEL * plan.levels.percussion * g.percussion, barTime, BAR_PARAM_TAU_S);
  percFilter!.frequency.setTargetAtTime(
    PERC_FILTER_BASE_HZ + clamp01(s.metal) * PERC_FILTER_METAL_LIFT_HZ,
    barTime,
    BAR_PARAM_TAU_S
  );
  percFilter!.Q.setTargetAtTime(PERC_Q_BASE + clamp01(s.metal) * PERC_Q_METAL, barTime, BAR_PARAM_TAU_S);
  for (const slot of plan.percussion) {
    const jitter = humanizeOffsetMs(seed, noteSalt++, s.organic) / 1000;
    const at = Math.max(ctx.currentTime, barTime + slot * slotSec + jitter);
    percHit(ctx, at, plan.barIndex * 31 + slot, g.stereoWidth);
  }

  // -- Sidechain breathing: transport-keyed dips, sample-accurate (§8.2).
  if (breathGain) {
    const depth = plan.sidechainDepth;
    breathGain.gain.cancelScheduledValues(barTime);
    if (depth > 0.01) {
      const release = SIDECHAIN_RELEASE_BEATS * beatDur;
      for (let b = 0; b < t.meter.beatsPerBar; b++) {
        const at = barTime + b * beatDur;
        breathGain.gain.setValueAtTime(1 - depth, at);
        breathGain.gain.linearRampToValueAtTime(1, at + release);
      }
    } else {
      breathGain.gain.setTargetAtTime(1, barTime, 0.2);
    }
  }

  // -- Riser: one BUILD phrase, landing EXACTLY on the next phrase boundary.
  if (plan.buildPhrase && plan.phrasePos === 0 && riserGain && riserFilter) {
    const bloomTime = barTime + PHRASE_BARS * barDur;
    riserGain.gain.cancelScheduledValues(barTime);
    riserGain.gain.setValueAtTime(0.0001, barTime);
    riserGain.gain.exponentialRampToValueAtTime(
      Math.max(0.001, BED_RISER_LEVEL * g.riser), bloomTime
    );
    riserFilter.frequency.cancelScheduledValues(barTime);
    riserFilter.frequency.setValueAtTime(RISER_FILTER_FROM_HZ, barTime);
    riserFilter.frequency.exponentialRampToValueAtTime(RISER_FILTER_TO_HZ, bloomTime);
  }
  if (plan.bloomEntered && riserGain) {
    // The drop: the riser releases exactly on the bloom downbeat.
    riserGain.gain.cancelScheduledValues(barTime);
    riserGain.gain.setValueAtTime(Math.max(0.001, BED_RISER_LEVEL * g.riser), barTime);
    riserGain.gain.exponentialRampToValueAtTime(0.0001, barTime + RISER_CUT_S);
  }

  // -- Reverb space: era depth × atmosphere.
  reverbWet!.gain.setTargetAtTime(
    REVERB_WET_MAX * g.reverb * clamp01(s.atmosphere), barTime, MASTER_TAU_S
  );

  // -- The world-clock tick: presence/level fade over whole bars, at bar lines.
  const tickTarget = plan.tick.present ? BED_TICK_LEVEL * (0.3 + 0.7 * plan.tick.level) : 0;
  if (Math.abs(tickTarget - tickLevelApplied) > 0.005 && tickGain) {
    tickGain.gain.setTargetAtTime(tickTarget, barTime, barDur * TICK_BAR_FADE_FRAC);
    tickLevelApplied = tickTarget;
  }
  tickHzTarget = plan.tick.hz;

  // -- Warp exit / arrival: grid punctuation through the shared hit path
  // (scheduleHit rides THIS transport's grid while the bed leads).
  if (plan.warpExitBoom || plan.landingPivot) {
    scheduleHit(plan.landingPivot ? 'bloom' : 'boom', 'bar');
  }
}

// --- Transients (bounded lifetimes, like the shipped score voices) -----------------------------------

function pluck(
  ctx: AudioContext,
  at: number,
  semis: number,
  velocity: number,
  holdSec: number,
  wave: OscillatorType
): void {
  if (!ostFilter) return;
  const osc = ctx.createOscillator();
  osc.type = wave;
  osc.frequency.value = hzOf(semis);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(velocity, at + OST_ATTACK_S);
  env.gain.exponentialRampToValueAtTime(0.001, at + Math.max(0.08, holdSec * 1.7));
  osc.connect(env);
  env.connect(ostFilter);
  osc.start(at);
  osc.stop(at + Math.max(0.1, holdSec * 2));
}

function leadNote(ctx: AudioContext, at: number, semis: number, velocity: number, durSec: number): void {
  if (!leadFilter) return;
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = hzOf(semis);
  const env = ctx.createGain();
  const peak = velocity;
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(Math.max(0.001, peak), at + LEAD_ATTACK_S);
  env.gain.setValueAtTime(Math.max(0.001, peak), at + Math.max(LEAD_ATTACK_S, durSec * 0.6));
  env.gain.exponentialRampToValueAtTime(0.0001, at + Math.max(0.2, durSec));
  osc.connect(env);
  env.connect(leadFilter);
  osc.start(at);
  osc.stop(at + Math.max(0.3, durSec) + 0.1);
}

function percHit(ctx: AudioContext, at: number, salt: number, width: number): void {
  if (!percFilter || !percNoise || !percPan || !conductor) return;
  const src = ctx.createBufferSource();
  src.buffer = percNoise;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(1, at + 0.003);
  env.gain.exponentialRampToValueAtTime(0.001, at + PERC_DECAY_S);
  src.connect(env);
  env.connect(percFilter);
  const pan = (musicUnit(conductor.planetSeed, SALT_PERC_PAN, salt) * 2 - 1) * PERC_PAN_SPREAD * width;
  percPan.pan.setValueAtTime(pan, at);
  src.start(at);
  src.stop(at + PERC_DECAY_S + 0.05);
}

// --- The world-clock tick (its own clock — NEVER the musical grid; §8.1) -------------------------------

function scheduleTicks(ctx: AudioContext, now: number): void {
  if (!tickGain) return;
  // Rate GLIDES (≥ TICK_GLIDE_S): smooth the live rate toward its target.
  const k = Math.min(1, SCHEDULER_INTERVAL_MS / 1000 / TICK_GLIDE_S);
  tickHzLive += (tickHzTarget - tickHzLive) * k;
  if (nextTickAt < now) nextTickAt = now + 1 / tickHzLive;
  while (nextTickAt < now + LOOKAHEAD_S) {
    tickHit(ctx, nextTickAt);
    nextTickAt += 1 / tickHzLive;
  }
}

function tickHit(ctx: AudioContext, at: number): void {
  if (!tickGain) return;
  const metal = clamp01(signals.metal);
  const base = TICK_FREQ_WOOD_HZ + (TICK_FREQ_METAL_HZ - TICK_FREQ_WOOD_HZ) * metal;
  const mk = (freq: number, gain: number): void => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(gain, at + 0.002);
    env.gain.exponentialRampToValueAtTime(0.001, at + TICK_DECAY_S);
    osc.connect(env);
    env.connect(tickGain!);
    osc.start(at);
    osc.stop(at + TICK_DECAY_S + 0.05);
  };
  mk(base, 1);
  if (metal > 0.05) mk(base * TICK_PARTIAL_RATIO, 0.5 * metal);
}
