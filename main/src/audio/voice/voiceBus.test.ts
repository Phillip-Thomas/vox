import { planUtterance, createSpeakerTable, VOICE_RUNGS, type VoiceRung } from './voiceGrammar.ts';
import { afterEach, describe, expect, it } from 'vitest';
import {
  NARRATOR_SPEAKER_ID,
  createVoiceChain,
  scheduleUtteranceInto,
  retireOwnedUtterance,
  getVoiceRunSeed,
  resetVoiceBus,
  setVoiceRunSeed,
  utter,
  voiceSpeakerTable
} from './voiceBus.ts';

// No AudioContext exists in the vitest node environment, so `utter` reaches the
// grammar boundary and then reports 'no-audio-context'. That is exactly the surface
// under test here: the REFUSALS must happen BEFORE any node exists, so a refused
// line is refused identically whether or not audio is running.

afterEach(() => resetVoiceBus());

describe('the voice bus boundary', () => {
  it('refuses a lowercase caption before it ever reaches the audio graph', () => {
    const result = utter('(strange. the approach feels like remembering.)', {
      surfaceId: 'feed',
      register: 'institutional',
      rung: 'alive'
    });
    expect(result.spoken).toBe(false);
    expect(result.reason).toBe('line-parenthetical-intrusion');
    expect(result.plan).toBeNull();
    expect(result.grainsScheduled).toBe(0);
  });

  it('refuses an unlisted surface before planning anything', () => {
    const result = utter('REGULATION ADVISORY.', {
      surfaceId: 'story-caption',
      register: 'institutional',
      rung: 'bare'
    });
    expect(result.reason).toBe('surface-not-allowlisted');
    expect(result.plan).toBeNull();
  });

  it('refuses "i—" from the lift', () => {
    expect(
      utter('i—', { surfaceId: 'terminal', register: 'institutional', rung: 'colour' }).reason
    ).toBe('line-em-dash-fragment');
  });

  it('plans an admitted line, then reports the missing context rather than throwing', () => {
    const result = utter('NAV NOTE: SITE GEOMETRY RESOLVES BEFORE IT IS SURVEYED.', {
      surfaceId: 'feed',
      register: 'institutional',
      rung: 'material',
      chord: { root: 3, chord: [0, 3, 7] }
    });
    expect(result.spoken).toBe(false);
    expect(result.reason).toBe('no-audio-context');
    expect(result.plan).not.toBeNull();
    expect(result.plan!.grains.length).toBeGreaterThan(0);
    expect(result.plan!.speakerId).toBe(NARRATOR_SPEAKER_ID);
  });

  it('keeps ONE narrator table for the whole session', () => {
    setVoiceRunSeed(0x1234);
    expect(getVoiceRunSeed()).toBe(0x1234);
    const a = voiceSpeakerTable();
    const b = voiceSpeakerTable(NARRATOR_SPEAKER_ID);
    expect(b).toBe(a);
  });

  it('rebuilds the tables when the run seed changes, and only then', () => {
    setVoiceRunSeed(1);
    const first = voiceSpeakerTable();
    setVoiceRunSeed(1);
    expect(voiceSpeakerTable()).toBe(first);
    setVoiceRunSeed(2);
    expect(voiceSpeakerTable()).not.toBe(first);
  });

  it('honours the silence set at the bus, not only in the grammar', () => {
    expect(
      utter('REGULATION ADVISORY.', {
        surfaceId: 'audit-band',
        register: 'institutional',
        rung: 'alive',
        silence: { beat: 'ch4-defy' }
      }).reason
    ).toBe('beat-silent');
  });
});


// The actual scheduler writes these source/envelope/AudioParam doubles. This
// verifies ownership and exact timestamps; decoded waveform/tail proof remains runtime work.
class ScheduledParam {
  value = 0;
  events: { kind: 'set' | 'ramp'; value: number; at: number }[] = [];
  cancellations: number[] = [];
  setValueAtTime(value: number, at: number) { this.events.push({ kind: 'set', value, at }); return this; }
  linearRampToValueAtTime(value: number, at: number) { this.events.push({ kind: 'ramp', value, at }); return this; }
  cancelScheduledValues(at: number) { this.cancellations.push(at); this.events = this.events.filter(event => event.at < at); return this; }
}
class ScheduledNode {
  gain = new ScheduledParam(); frequency = new ScheduledParam(); Q = new ScheduledParam();
  playbackRate = new ScheduledParam(); delayTime = new ScheduledParam();
  connections: ScheduledNode[] = []; starts: number[] = []; stops: number[] = [];
  type = ''; loop = false; buffer: unknown; curve: unknown; onended: (() => void) | null = null;
  connect(node: ScheduledNode) { this.connections.push(node); return node; }
  disconnect() {}
  start(at = 0) { this.starts.push(at); }
  stop(at = 0) { this.stops.push(at); }
}
class ScheduledContext {
  currentTime = 0; sampleRate = 48000; state = 'running';
  sources: ScheduledNode[] = []; nodes: ScheduledNode[] = [];
  node() { const node = new ScheduledNode(); this.nodes.push(node); return node; }
  createGain = () => this.node(); createBiquadFilter = () => this.node(); createWaveShaper = () => this.node(); createDelay = () => this.node();
  createOscillator = () => { const node = this.node(); this.sources.push(node); return node; };
  createBufferSource = () => { const node = this.node(); this.sources.push(node); return node; };
  createBuffer(_channels: number, length: number, sampleRate: number) { const samples = new Float32Array(length); return { sampleRate, length, duration: length / sampleRate, getChannelData: () => samples }; }
}
function scheduledVoice(rung: VoiceRung) {
  const context = new ScheduledContext(), ctx = context as unknown as BaseAudioContext;
  const chain = createVoiceChain(ctx, context.node() as unknown as AudioNode, { formants: VOICE_RUNGS[rung].formantBands > 0, comb: VOICE_RUNGS[rung].comb, seed: 21 });
  const plan = planUtterance({ text: 'WALK OVER THE DEBRIS TO RECOVER IT.', rung, chord: { root: 0, chord: [0, 4, 7] }, speaker: createSpeakerTable('narrator', 21), seed: 21 });
  return { context, ctx, chain, plan };
}
function busOwner() { return { surfaceId: 'feed' as const, lineId: 'order:ch1:fixed:recover-first-debris:0', text: 'WALK OVER THE DEBRIS TO RECOVER IT.', runVersion: 1, restoreVersion: 0, publication: {} }; }
function sourceSchedule(context: ScheduledContext) {
  return context.sources.map(source => ({ type: source.type, frequency: source.frequency.value, playbackRate: source.playbackRate.value,
    starts: source.starts, stops: source.stops, envelope: source.connections[0]?.gain.events,
    samples: source.buffer ? Array.from((source.buffer as { getChannelData: () => Float32Array }).getChannelData().slice(0, 12)) : null }));
}
for (const rung of ['bare', 'colour', 'material', 'alive'] as const) describe(`owned scheduled ${rung} voice`, () => {
  it('leaves uncanceled plans, nodes, source data, envelopes and onset/stop times identical', () => {
    const original = scheduledVoice(rung), owned = scheduledVoice(rung);
    const count = scheduleUtteranceInto(original.ctx, original.chain, original.plan, 0);
    const ownedCount = scheduleUtteranceInto(owned.ctx, owned.chain, owned.plan, 0, busOwner());
    expect(ownedCount).toBe(count); expect(owned.plan).toEqual(original.plan);
    expect(sourceSchedule(owned.context)).toEqual(sourceSchedule(original.context));
    expect(owned.context.nodes.length).toBe(original.context.nodes.length);
    original.chain.disconnect(); owned.chain.disconnect();
  });
  it('stops future owned sources, releases only active owned envelopes in 5ms and preserves concurrent peer schedules', () => {
    const { context, ctx, chain, plan } = scheduledVoice(rung);
    const owner = busOwner();
    const start = context.sources.length;
    scheduleUtteranceInto(ctx, chain, plan, 0, owner);
    const ownSources = context.sources.slice(start);
    const peerStart = context.sources.length;
    const sharedParams = [...chain.formantBands.map(band => band.frequency), chain.noiseGain.gain];
    const beforePeerWrites = sharedParams.map(param => (param as unknown as ScheduledParam).events.length);
    scheduleUtteranceInto(ctx, chain, plan, 0.2);
    const peerSources = context.sources.slice(peerStart);
    const peerBefore = peerSources.map(source => JSON.stringify({ starts: source.starts, stops: source.stops, env: source.connections[0].gain.events }));
    const peerAutomation = [...chain.formantBands.map(band => band.frequency), chain.noiseGain.gain]
      .map((param, index) => (param as unknown as ScheduledParam).events.slice(beforePeerWrites[index]).map(event => ({ ...event })));
    context.currentTime = 0.003;
    expect(retireOwnedUtterance({ ...owner }).grains).toBe(0);
    const result = retireOwnedUtterance(owner);
    expect(result.grains).toBe(plan.grains.length);
    ownSources.forEach((source, i) => {
      const active = plan.grains[i].atSeconds <= context.currentTime;
      expect(source.stops[source.stops.length - 1]).toBeCloseTo(active ? 0.008 : 0.003, 10);
      const last = source.connections[0].gain.events[source.connections[0].gain.events.length - 1];
      expect(last).toEqual({ kind: active ? 'ramp' : 'set', value: 0, at: active ? 0.008 : 0.003 });
    });
    expect(peerSources.map(source => JSON.stringify({ starts: source.starts, stops: source.stops, env: source.connections[0].gain.events }))).toEqual(peerBefore);
    const params = [...chain.formantBands.map(band => band.frequency), chain.noiseGain.gain];
    params.forEach((param, index) => {
      const writes = (param as unknown as ScheduledParam).events;
      // Every peer event survives at the original timestamp/value (including same-time steps).
      for (const event of peerAutomation[index]) expect(writes).toContainEqual(event);
    });
    expect(retireOwnedUtterance(owner)).toEqual({ grains: 0, automationWrites: 0 });
    chain.disconnect();
  });
  it('does not touch the other slot or leave an orphan future noise floor', () => {
    const own = scheduledVoice(rung), other = scheduledVoice(rung), owner = busOwner();
    scheduleUtteranceInto(own.ctx, own.chain, own.plan, 0, owner);
    scheduleUtteranceInto(other.ctx, other.chain, other.plan, 0);
    const otherBefore = JSON.stringify(sourceSchedule(other.context));
    own.context.currentTime = 0.003;
    retireOwnedUtterance(owner);
    expect(JSON.stringify(sourceSchedule(other.context))).toBe(otherBefore);
    const noise = own.chain.noiseGain.gain as unknown as ScheduledParam;
    expect(noise.events.filter(event => event.at > 0.008 && event.value !== 0)).toEqual([]);
    if (VOICE_RUNGS[rung].noiseFloor > 0) expect(noise.events[noise.events.length - 1].value).toBe(0);
    own.chain.disconnect(); other.chain.disconnect();
  });
});
