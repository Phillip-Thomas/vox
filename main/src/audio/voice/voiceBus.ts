// --- The narrator's voice: the WebAudio rim ------------------------------------------
//
// Stage 6 of the 2026-09-04-audio-10x run. `voiceGrammar.ts` decides WHAT is
// uttered and refuses what must not be; this file only turns an admitted plan into
// nodes and hangs them on the `voice` category bus that Stage 2 built in audioCore.
//
// Boundaries this file respects, and must keep respecting:
//   - It joins through `getGameAudioCategoryBusInput('voice')` — audioCore's public
//     API — and touches nothing inside audioCore.ts or src/audio/mix/**. The bus
//     applies the snapshot gain, the duck matrix's `voice` row and the sfx volume;
//     ui/voice deliberately BYPASS the underwater muffle, because the institution
//     is not underwater.
//   - It is not wired to any story surface. Nothing here is called yet: Stage 4/6
//     integration binds the emitters. `utter()` is safe to call before then and
//     simply reports what it would have done when no context exists.
//
// The chain, per score-treatment §6, one instance per slot:
//   grainSource -> formantBank (3 bandpass, Q 8) -> bandpass 300/3400
//   -> WaveShaper(tanh 1.6) -> comb (delay 1/1100, fb 0.35) -> +noise floor -48 dB
//   -> voice bus
//
// Everything is square-derived at every rung. The ch4 and ch10 square-wave
// dramaturgy depends on the SOURCE never becoming a nicer oscillator; only the
// bandwidth and the grain climb.

import { peekAudioContext, getGameAudioCategoryBusInput, applyGameAudioDuck } from '../audioCore.ts';
import { isScoreMoodLeading } from '../scoreEngine.ts';
import { getMusicChord } from '../musicPrimitives.ts';
import {
  VOICE_BP_HI,
  VOICE_BP_LO,
  VOICE_FORMANT_Q,
  VOICE_SAT_K,
  VOICE_SLOT_COUNT,
  VOICE_RUNGS,
  voiceRandom,
  admitVoiceLine,
  createSpeakerTable,
  planUtterance
} from './voiceGrammar.ts';
import { connectRadioComb } from './radioComb.ts';
import type {
  VoiceChord,
  VoiceRefusalReason,
  VoiceRegister,
  VoiceRung,
  VoiceSilenceContext,
  VoiceSpeakerTable,
  VoiceUtterancePlan
} from './voiceGrammar.ts';

export type { VoiceRefusalReason, VoiceRung, VoiceUtterancePlan } from './voiceGrammar.ts';

/** The one narrator. Station vendors take their own ids through the same chain. */
export const NARRATOR_SPEAKER_ID = 'regulation-narrator';

let runSeed = 0;
const speakerTables = new Map<string, VoiceSpeakerTable>();

/** Set once per session/render so every rim reproduces the same voice. */
export function setVoiceRunSeed(seed: number): void {
  if (seed >>> 0 === runSeed) return;
  runSeed = seed >>> 0;
  speakerTables.clear();
}

export function getVoiceRunSeed(): number {
  return runSeed;
}

export function voiceSpeakerTable(id: string = NARRATOR_SPEAKER_ID): VoiceSpeakerTable {
  let table = speakerTables.get(id);
  if (!table) {
    table = createSpeakerTable(id, runSeed);
    speakerTables.set(id, table);
  }
  return table;
}

// --- The chain -----------------------------------------------------------------------

export interface VoiceChain {
  /** Where a grain source connects. */
  input: AudioNode;
  /** The utterance-level gain, for the rim to duck or silence a slot. */
  slotGain: GainNode;
  /** Seeded noise floor, summed after the comb. */
  noiseGain: GainNode;
  /** The three parallel bandpasses. Empty when the rung has no formant bank. */
  formantBands: readonly BiquadFilterNode[];
  output: AudioNode;
  seed: number;
  /** Sources are stopped as well as disconnected when the visible context ends. */
  sources: Set<AudioScheduledSourceNode>;
  disconnect(): void;
}

/** Exact publication token. Equality is reference identity, never just a line ID. */
export interface VoiceUtteranceOwnership {
  surfaceId: 'feed'; lineId: string; text: string;
  runVersion: number; restoreVersion: number; publication: object;
}
interface OwnedGrain {
  source: AudioScheduledSourceNode; env: GainNode; at: number; end: number;
  gain: number; smooth: boolean;
}
interface OwnedGrains {
  ctx: BaseAudioContext; chain: VoiceChain; grains: Set<OwnedGrain>; retired: boolean;
}
interface SharedWrite { at: number; value: number; owner: VoiceUtteranceOwnership | undefined; sequence: number }
interface SharedAutomation { initial: number; writes: SharedWrite[] }
const ownedGrains = new Map<VoiceUtteranceOwnership, OwnedGrains>();
const sharedAutomation = new WeakMap<VoiceChain, Map<AudioParam, SharedAutomation>>();
let writeSequence = 0;
function recordSharedWrite(chain: VoiceChain, param: AudioParam, value: number, at: number, now: number, owner?: VoiceUtteranceOwnership): void {
  let params = sharedAutomation.get(chain);
  if (!params) { params = new Map(); sharedAutomation.set(chain, params); }
  let record = params.get(param);
  if (!record) { record = { initial: param.value, writes: [] }; params.set(param, record); }
  // Retain one effective past write per still-live owner and all pending writes.
  // This is bounded by scheduled voices, not the duration of the game session.
  const past = new Map<VoiceUtteranceOwnership | undefined, SharedWrite>();
  const future: SharedWrite[] = [];
  for (const write of record.writes) {
    if (write.at > now) future.push(write);
    else {
      const key = write.owner && ownedGrains.has(write.owner) ? write.owner : undefined;
      const previous = past.get(key);
      if (!previous || write.at > previous.at || (write.at === previous.at && write.sequence > previous.sequence)) past.set(key, write);
    }
  }
  record.writes = [...past.values(), ...future, { at, value, owner, sequence: ++writeSequence }];
  param.setValueAtTime(value, at);
}

/** Retire this publication only; slot graph, peer sources and existing duck remain owned elsewhere. */
export function retireOwnedUtterance(owner: VoiceUtteranceOwnership): { grains: number; automationWrites: number } {
  const group = ownedGrains.get(owner);
  if (!group || group.retired) return { grains: 0, automationWrites: 0 };
  group.retired = true;
  const now = group.ctx.currentTime;
  let grains = 0, automationWrites = 0;
  for (const grain of group.grains) {
    if (grain.end <= now) continue;
    grains++;
    if (grain.at > now) {
      grain.env.gain.cancelScheduledValues(now); grain.env.gain.setValueAtTime(0, now);
      try { grain.source.stop(now); } catch { /* source already ended */ }
    } else {
      const phase = (now - grain.at) / (grain.end - grain.at);
      const value = grain.smooth ? grain.gain * (phase < 0.35 ? phase / 0.35 : (1 - phase) / 0.65) : grain.gain;
      grain.env.gain.cancelScheduledValues(now);
      grain.env.gain.setValueAtTime(Math.max(0, value), now);
      grain.env.gain.linearRampToValueAtTime(0, now + 0.005);
      try { grain.source.stop(now + 0.005); } catch { /* source already ended */ }
    }
  }
  for (const [param, record] of sharedAutomation.get(group.chain) ?? []) {
    const ordered = record.writes.slice().sort((a, b) => a.at - b.at || a.sequence - b.sequence);
    const removed = ordered.filter(write => write.owner === owner && write.at > now);
    if (!removed.length) continue;
    automationWrites += removed.length;
    const surviving = ordered.filter(write => write.owner !== owner || write.at <= now);
    // Rebuild the pending shared steps exactly. AudioParam has no owner-scoped cancellation.
    param.cancelScheduledValues(now);
    const past = surviving.filter(write => write.at <= now);
    const current = past[past.length - 1];
    param.setValueAtTime(current?.value ?? record.initial, now);
    // Noise has no filter tail of its own. Do not leave an active retired floor
    // orphaned when its former terminal zero is removed. Reconstruct the surviving
    // owner's current value at the end of the same bounded cancellation release.
    if (param === group.chain.noiseGain.gain && current?.owner === owner && current.value !== 0) {
      const peerPast = surviving.filter(write => write.at <= now && write.owner !== owner);
      const underlying = peerPast[peerPast.length - 1];
      const next = surviving.find(write => write.at > now);
      if (!next || next.at > now + 0.005) {
        const release = { at: now + 0.005, value: underlying?.value ?? record.initial, owner: undefined, sequence: ++writeSequence };
        surviving.push(release);
      }
    }
    surviving.sort((a, b) => a.at - b.at || a.sequence - b.sequence);
    for (const write of surviving) if (write.at >= now) param.setValueAtTime(write.value, write.at);
    record.writes = surviving;
  }
  return { grains, automationWrites };
}

function makeSaturationCurve(k: number): Float32Array<ArrayBuffer> {
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(k * x);
  }
  return curve;
}

/** Source amplitude calibrated with >=3 s of active institutional grains. */
export const VOICE_SOURCE_GAIN = 0.164;
/** A negative-only trim reserved for the measured VOICE_ST_LUFS rail. */
export const VOICE_ALIVE_TRIM_DB = 0;

const SATURATION_CURVE = makeSaturationCurve(VOICE_SAT_K);
const SQUARE_TABLE_SAMPLES = 2048;
const squareTables = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>();

/** A seeded, band-limited square period reused by material/alive grains. */
function squareGrainBuffer(ctx: BaseAudioContext, frequencyHz: number, seed: number): AudioBuffer {
  let cache = squareTables.get(ctx);
  if (!cache) { cache = new Map(); squareTables.set(ctx, cache); }
  const harmonics = Math.max(1, Math.min(31, Math.floor(ctx.sampleRate / (2 * frequencyHz))));
  const key = `${seed}:${harmonics}`;
  const existing = cache.get(key);
  if (existing) return existing;
  const buffer = ctx.createBuffer(1, SQUARE_TABLE_SAMPLES, ctx.sampleRate);
  const samples = buffer.getChannelData(0);
  const phase = voiceRandom(seed)() * Math.PI * 2;
  for (let i = 0; i < samples.length; i++) {
    const angle = i * Math.PI * 2 / samples.length + phase;
    for (let harmonic = 1; harmonic <= harmonics; harmonic += 2) samples[i] += Math.sin(angle * harmonic) * 4 / (Math.PI * harmonic);
  }
  cache.set(key, buffer);
  // A reset can change the run seed while keeping the same AudioContext.
  while (cache.size > 64) cache.delete(cache.keys().next().value!);
  return buffer;
}

/**
 * Build one utterance slot's chain into any BaseAudioContext — the live context or
 * an OfflineAudioContext. Nothing about it depends on which, so the Stage 6
 * evidence render and the player's ear go through the same code.
 */
export function createVoiceChain(
  ctx: BaseAudioContext,
  destination: AudioNode,
  options: { formants?: boolean; comb?: number; seed?: number; trimDb?: number; sourceGain?: number } = {}
): VoiceChain {
  const slotGain = ctx.createGain();
  slotGain.gain.value = (options.sourceGain ?? VOICE_SOURCE_GAIN) * Math.pow(10, Math.min(0, options.trimDb ?? 0) / 20);

  // Formant bank: three bandpasses in PARALLEL, so the bands sum rather than
  // multiplying each other down to nothing.
  const formantIn = ctx.createGain();
  const formantOut = ctx.createGain();
  const formantBands: BiquadFilterNode[] = [];
  if (options.formants !== false) {
    for (let i = 0; i < 3; i++) {
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.Q.value = VOICE_FORMANT_Q;
      band.frequency.value = [500, 1500, 2700][i];
      formantIn.connect(band);
      band.connect(formantOut);
      formantBands.push(band);
    }
  } else {
    formantIn.connect(formantOut);
  }

  // The radio window.
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = VOICE_BP_LO;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = VOICE_BP_HI;

  const shaper = ctx.createWaveShaper();
  shaper.curve = SATURATION_CURVE;

  const noiseGain = ctx.createGain();
  noiseGain.gain.value = 0;
  const floor = ctx.createBufferSource();
  const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const noiseRandom = voiceRandom(options.seed ?? 0);
  const samples = noiseBuffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = noiseRandom() * 2 - 1;
  floor.buffer = noiseBuffer; floor.loop = true; floor.connect(noiseGain); floor.start();

  const out = ctx.createGain();
  out.gain.value = 1;

  slotGain.connect(formantIn);
  formantOut.connect(hp);
  hp.connect(lp);
  lp.connect(shaper);
  shaper.connect(out);
  const disconnectComb = connectRadioComb(ctx, shaper, out, options.comb ?? 1);
  noiseGain.connect(out);
  out.connect(destination);
  const sources = new Set<AudioScheduledSourceNode>();

  return {
    input: slotGain,
    slotGain,
    noiseGain,
    formantBands,
    output: out,
    seed: options.seed ?? 0,
    sources,
    disconnect() {
      for (const source of sources) { try { source.stop(); source.disconnect(); } catch { /* already ended */ } }
      sources.clear();
      for (const [owner, group] of ownedGrains) if (group.chain.sources === sources) ownedGrains.delete(owner);
      try {
        floor.stop(); floor.disconnect();
        disconnectComb();
        for (const node of [slotGain, formantIn, formantOut, ...formantBands, hp, lp, shaper, noiseGain, out]) node.disconnect();
      } catch {
        /* already torn down */
      }
    }
  };
}

/**
 * Schedule an admitted plan into a chain at an absolute context time.
 * Returns the number of grains actually scheduled.
 */
export function scheduleUtteranceInto(
  ctx: BaseAudioContext,
  chain: VoiceChain,
  plan: VoiceUtterancePlan,
  startTime: number,
  ownership?: VoiceUtteranceOwnership
): number {
  const spec = plan.rung;
  const smooth = spec === 'alive';
  const group: OwnedGrains | undefined = ownership ? { ctx, chain, grains: new Set(), retired: false } : undefined;
  if (ownership && group) ownedGrains.set(ownership, group);
  for (const grain of plan.grains) {
    const at = startTime + grain.atSeconds;
    let source: OscillatorNode | AudioBufferSourceNode;
    if (spec === 'material' || spec === 'alive') {
      const buffer = ctx.createBufferSource();
      buffer.buffer = squareGrainBuffer(ctx, grain.frequencyHz, chain.seed);
      buffer.loop = true;
      buffer.playbackRate.value = grain.frequencyHz * SQUARE_TABLE_SAMPLES / ctx.sampleRate;
      source = buffer;
    } else {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = grain.frequencyHz;
      source = osc;
    }
    const env = ctx.createGain();
    // A hard PSG gate below `alive`, a short window at it. No vibrato, no breath.
    if (smooth) {
      env.gain.setValueAtTime(0, at);
      env.gain.linearRampToValueAtTime(grain.gain, at + grain.durationSeconds * 0.35);
      env.gain.linearRampToValueAtTime(0, at + grain.durationSeconds);
    } else {
      env.gain.setValueAtTime(grain.gain, at);
      env.gain.setValueAtTime(0, at + grain.durationSeconds);
    }
    // Formants are per-CHARACTER and the bank is shared across the slot, so each
    // grain steps the three bands at its own onset rather than owning three
    // filters of its own — the same table, one node graph, no per-grain garbage.
    if (grain.formants && chain.formantBands.length === 3) {
      recordSharedWrite(chain, chain.formantBands[0].frequency, grain.formants.f1, at, ctx.currentTime, ownership);
      recordSharedWrite(chain, chain.formantBands[1].frequency, grain.formants.f2, at, ctx.currentTime, ownership);
      recordSharedWrite(chain, chain.formantBands[2].frequency, grain.formants.f3, at, ctx.currentTime, ownership);
    }
    source.connect(env);
    env.connect(chain.input);
    chain.sources.add(source);
    source.start(at);
    source.stop(at + grain.durationSeconds + 0.005);
    const owned = { source, env, at, end: at + grain.durationSeconds, gain: grain.gain, smooth };
    group?.grains.add(owned);
    source.onended = () => {
      source.disconnect(); env.disconnect(); chain.sources.delete(source);
      group?.grains.delete(owned);
      if (ownership && group?.grains.size === 0) ownedGrains.delete(ownership);
    };
    if (grain.noise > 0) {
      recordSharedWrite(chain, chain.noiseGain.gain, grain.noise, at, ctx.currentTime, ownership);
      recordSharedWrite(chain, chain.noiseGain.gain, 0, at + grain.durationSeconds, ctx.currentTime, ownership);
    }
  }
  return plan.grains.length;
}

// --- The public API ------------------------------------------------------------------

export interface UtterOptions {
  ownership?: VoiceUtteranceOwnership;
  surfaceId: string;
  register: VoiceRegister;
  rung: VoiceRung;
  /** Defaults to the narrator. Station vendors pass their own id. */
  speakerId?: string;
  /** Absolute context time. Defaults to `ctx.currentTime`. */
  startTime?: number;
  /** 0 or 1. Slot 1 exists for the ch10 relay overlap. */
  slot?: number;
  silence?: VoiceSilenceContext;
  /** ch10: the relay voice may land on the carrier pitch class. */
  carrierSemitone?: number;
  /** Override the published chord (evidence renders). */
  chord?: VoiceChord;
  seed?: number;
  characterRange?: readonly [number, number];
  quality?: 'full' | 'lean';
}

export interface UtterResult {
  ownership?: VoiceUtteranceOwnership;
  spoken: boolean;
  reason: VoiceRefusalReason | 'no-audio-context' | 'no-voice-bus' | null;
  plan: VoiceUtterancePlan | null;
  grainsScheduled: number;
}

const liveChains: ({ chain: VoiceChain; rung: VoiceRung; context: BaseAudioContext } | null)[] = Array.from({ length: VOICE_SLOT_COUNT }, () => null);
export function getVoiceBusDiagnostics() {
  return {
    slots: liveChains.flatMap((entry, slot) => entry ? [{ slot, rung: entry.rung, sourceNodes: entry.chain.sources.size, contextTime: entry.context.currentTime, contextState: entry.context.state }] : []),
    owned: [...ownedGrains].map(([ownership, group]) => ({ ownership, retired: group.retired,
      slot: liveChains.findIndex(entry => entry?.chain === group.chain), contextTime: group.ctx.currentTime,
      activeSources: [...group.grains].filter(grain => grain.at <= group.ctx.currentTime && grain.end > group.ctx.currentTime).length,
      futureSources: group.retired ? 0 : [...group.grains].filter(grain => grain.at > group.ctx.currentTime).length,
      pendingSharedWrites: [...(sharedAutomation.get(group.chain)?.values() ?? [])].reduce((count, record) => count + record.writes.filter(write => write.owner === ownership && write.at > group.ctx.currentTime).length, 0)
    }))
  };
}

function liveChain(slot: number, rung: VoiceRung): VoiceChain | null {
  const ctx = peekAudioContext();
  if (!ctx) return null;
  const bus = getGameAudioCategoryBusInput('voice');
  if (!bus) return null;
  const index = Math.max(0, Math.min(VOICE_SLOT_COUNT - 1, slot | 0));
  let current = liveChains[index];
  if (current && (current.rung !== rung || current.context !== ctx)) {
    current.chain.disconnect(); current = null;
  }
  if (!current) {
    const spec = VOICE_RUNGS[rung];
    current = { chain: createVoiceChain(ctx, bus, { formants: spec.formantBands > 0, comb: spec.comb, seed: runSeed, trimDb: rung === 'alive' ? VOICE_ALIVE_TRIM_DB : 0 }), rung, context: ctx };
    liveChains[index] = current;
  }
  return current.chain;
}

/** Drop all nodes on reset or a route/context teardown. */
export function resetVoiceBus(): void {
  for (let i = 0; i < liveChains.length; i++) {
    liveChains[i]?.chain.disconnect();
    liveChains[i] = null;
  }
}

function readChord(): VoiceChord {
  const published = getMusicChord();
  return { root: published.root, chord: published.chord };
}

/**
 * Speak one line, or refuse it and say why.
 *
 * The refusal is the point of this function. A caller cannot get a lowercase
 * caption, a parenthetical intrusion or "i—" through it by passing the right
 * surface, and cannot get an institutional line through on a surface that is not
 * on the allowlist. Both halves are checked before a single node exists.
 */
export function utter(text: string, options: UtterOptions): UtterResult {
  const admission = admitVoiceLine({
    text,
    surfaceId: options.surfaceId,
    register: options.register,
    silence: options.silence
  });
  if (!admission.admitted) {
    return { spoken: false, reason: admission.reason, plan: null, grainsScheduled: 0 };
  }

  let plan = planUtterance({
    text,
    rung: options.rung,
    chord: options.chord ?? readChord(),
    speaker: voiceSpeakerTable(options.speakerId ?? NARRATOR_SPEAKER_ID),
    seed: options.seed,
    carrierSemitone: options.carrierSemitone
  });

  if (options.characterRange) {
    const [first, end] = options.characterRange;
    const grains = plan.grains.filter(grain => grain.characterIndex >= first && grain.characterIndex < end)
      .map(grain => ({ ...grain, atSeconds: grain.atSeconds - first * plan.keyIntervalSeconds }));
    plan = { ...plan, grains, durationSeconds: grains.reduce((end, grain) => Math.max(end, grain.atSeconds + grain.durationSeconds), 0) };
  }
  const ctx = peekAudioContext();
  if (!ctx || ctx.state !== 'running') return { spoken: false, reason: 'no-audio-context', plan, grainsScheduled: 0 };
  const chain = liveChain(options.quality === 'lean' ? 0 : options.slot ?? 0, options.rung);
  if (!chain) return { spoken: false, reason: 'no-voice-bus', plan, grainsScheduled: 0 };

  const scheduled = scheduleUtteranceInto(
    ctx,
    chain,
    plan,
    options.startTime ?? ctx.currentTime,
    options.ownership
  );
  if (scheduled > 0) applyGameAudioDuck('voice', { storyLead: isScoreMoodLeading() }, options.startTime ?? ctx.currentTime);
  return { spoken: true, reason: null, plan, grainsScheduled: scheduled, ownership: options.ownership };
}

/**
 * TTS-ready input. A future pipeline hands this an already-rendered buffer of
 * words; it goes through the SAME radio chain, so a synthesized line and a
 * granular one arrive in one room and one register.
 *
 * The register filter still applies: `speak` takes the line's TEXT beside the
 * buffer precisely so a buffer cannot smuggle a lowercase caption past the
 * boundary that `utter` enforces.
 */
export function speak(
  buffer: AudioBuffer,
  options: Omit<UtterOptions, 'rung'> & { text: string }
): UtterResult {
  const admission = admitVoiceLine({
    text: options.text,
    surfaceId: options.surfaceId,
    register: options.register,
    silence: options.silence
  });
  if (!admission.admitted) {
    return { spoken: false, reason: admission.reason, plan: null, grainsScheduled: 0 };
  }
  const ctx = peekAudioContext();
  if (!ctx || ctx.state !== 'running') return { spoken: false, reason: 'no-audio-context', plan: null, grainsScheduled: 0 };
  const chain = liveChain(options.quality === 'lean' ? 0 : options.slot ?? 0, 'alive');
  if (!chain) return { spoken: false, reason: 'no-voice-bus', plan: null, grainsScheduled: 0 };
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(chain.input);
  chain.sources.add(source);
  source.start(options.startTime ?? ctx.currentTime);
  source.onended = () => { source.disconnect(); chain.sources.delete(source); };
  return { spoken: true, reason: null, plan: null, grainsScheduled: 0 };
}

// --- Offline evidence ----------------------------------------------------------------

export interface OfflineVoiceOptions {
  text: string;
  rung: VoiceRung;
  chord: VoiceChord;
  speakerId?: string;
  seed?: number;
  runSeed?: number;
  carrierSemitone?: number;
  startTime?: number;
  slot?: number;
  /** Measurement sweep of the named source amplitude; never a master trim. */
  sourceGain?: number;
}

/**
 * Render one utterance into an existing offline context and destination — the hook
 * `soak/offlineRender.ts` can call from a combined render so Stage 6 evidence
 * (band-energy intelligibility per rung, duck depth, narration over a BLOOM holding
 * -1 dBTP) measures the SAME chain the player hears rather than a stand-in.
 *
 * It takes a context rather than making one because the combined render owns the
 * context, the music chain and the SFX rim; the voice joins them.
 */
export function renderVoiceInto(
  ctx: BaseAudioContext,
  destination: AudioNode,
  options: OfflineVoiceOptions,
  existingChain?: VoiceChain
): { plan: VoiceUtterancePlan; chain: VoiceChain; grainsScheduled: number } {
  const speaker = createSpeakerTable(
    options.speakerId ?? NARRATOR_SPEAKER_ID,
    options.runSeed ?? runSeed
  );
  const plan = planUtterance({
    text: options.text,
    rung: options.rung,
    chord: options.chord,
    speaker,
    seed: options.seed,
    carrierSemitone: options.carrierSemitone
  });
  const spec = VOICE_RUNGS[options.rung];
  const chain = existingChain ?? createVoiceChain(ctx, destination, { formants: spec.formantBands > 0, comb: spec.comb, seed: options.runSeed ?? runSeed, trimDb: options.rung === 'alive' ? VOICE_ALIVE_TRIM_DB : 0, sourceGain: options.sourceGain });
  const grainsScheduled = scheduleUtteranceInto(ctx, chain, plan, options.startTime ?? 0);
  return { plan, chain, grainsScheduled };
}
