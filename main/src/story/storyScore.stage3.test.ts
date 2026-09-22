import { beforeEach, describe, expect, it, vi } from 'vitest';

// Stage 3 (audio-10x): composed-sync anchors, pitch-locked tonic chains and the
// MOODS-as-constraints policy table, exercised through the story façade with the
// instrument mocked at its seams.
type HitScheduleLike = { kind: string; audioTime: number; armedAt: number; perfTime: number; quantumLanded: 'bar' | 'beat' | 'step'; slackMs: number; onsetAttackMs: number };
const engine = vi.hoisted(() => {
  const state = { bedTonic: null as number | null, seedRoot: 0, pending: 0, audioTime: null as number | null };
  return {
    state,
    setScoreMood: vi.fn(),
    unlockScore: vi.fn(),
    setScoreIntensity: vi.fn(),
    scoreHit: vi.fn(),
    scheduleHit: vi.fn((): HitScheduleLike | null => null),
    cancelPendingScheduledHits: vi.fn(() => {
      const n = state.pending;
      state.pending = 0;
      return n;
    }),
    readLiveBedTonic: vi.fn(() => state.bedTonic),
    resolveScorePlanetHomeRoot: vi.fn(() => state.seedRoot),
    noteImmediateHit: vi.fn(),
    getScoreMoodTonic: vi.fn(() => ({ tonicSemis: 0, voicingPolicy: 'literal' })),
    SCORE_ROOT_HZ: 55
  };
});
vi.mock('../audio/scoreEngine.ts', () => engine);
vi.mock('../audio/audioCore.ts', () => ({ peekAudioContext: () => engine.state.audioTime == null ? null : { currentTime: engine.state.audioTime, sampleRate: 44100 } }));

import { quantumFitsCapAtTempo } from '../audio/generative/hitSchedule.ts';
import { autopilotBeatTimeout } from './autopilot.ts';
import { STORY_BEAT_ORDER, type StoryBeat } from './storyState.ts';
import {
  armStoryHit,
  beatMs,
  bundleAudioClockDue,
  bundlePresentationDue,
  CH10_CARRIER_DEGREE,
  CH10_CARRIER_HZ,
  CH10_SUBTRACTIVE_VARIANTS,
  CH10_TONIC_OFFSET_SEMIS,
  COMPOSED_TIMELINE_BEATS,
  deriveChainTonic,
  fireStoryHitFallback,
  getChapter10ScoreMood,
  getHeldTonicChain,
  getStoryBundleTrace,
  getStoryScoreMood,
  HIT_CAP_MS,
  listStoryScoreMoodInventory,
  noteStoryBundleState,
  noteStoryBundleFired,
  MOOD_DEFAULT_VOICING,
  MOOD_TONIC_CHAINS,
  MOOD_VOICING_OVERRIDES,
  resetStoryScoreRuntime,
  resolveBeatTonic,
  resolveBundleLatency,
  resolveMoodVoicingPolicy,
  STORY_BUNDLE_MEMBERS,
  setScoreBeat,
  STORY_HIT_ANCHOR_IDS,
  STORY_HIT_ANCHORS,
  storyHitAnchorTempo,
  TONIC_CHAIN_POLICY,
  type StoryHitAnchorId,
  type TonicChainId
} from './storyScore.ts';

const lastMoodCall = () => engine.setScoreMood.mock.lastCall as [unknown, { tonicSemis?: number; voicingPolicy?: string }] | undefined;

beforeEach(() => {
  resetStoryScoreRuntime();
  engine.state.bedTonic = null;
  engine.state.seedRoot = 0;
  engine.state.pending = 0;
  engine.state.audioTime = null;
  engine.setScoreMood.mockClear();
  engine.scheduleHit.mockClear();
  engine.scoreHit.mockClear();
  engine.cancelPendingScheduledHits.mockClear();
});

describe('HIT_CAP_MS and the cap-fit law (check-scheduler-cap-fit)', () => {
  it('has exactly the ten contracted anchors', () => {
    expect(STORY_HIT_ANCHOR_IDS.sort()).toEqual([
      'anc.a1.color-stabilizes', 'anc.a2.feed-wall-falls', 'anc.a2.hand-back', 'anc.a3.first-blade',
      'anc.a3.material-lands', 'anc.a4.life-front', 'anc.descent.impact', 'anc.lift.perspective-issued',
      'anc.maw.repair-answer', 'anc.track.unbolt'
    ].sort());
  });

  it('writes the a2 and a4 rows as one published beat of their mood (an expression, not a literal)', () => {
    expect(HIT_CAP_MS['anc.a2.feed-wall-falls']).toBeCloseTo(beatMs(132), 6);
    expect(HIT_CAP_MS['anc.a2.hand-back']).toBeCloseTo(beatMs(132), 6);
    expect(HIT_CAP_MS['anc.a4.life-front']).toBeCloseTo(beatMs(66), 6);
    expect(storyHitAnchorTempo('anc.a2.feed-wall-falls')).toBe(getStoryScoreMood('a2-awakening')!.tempo);
    expect(storyHitAnchorTempo('anc.a4.life-front')).toBe(getStoryScoreMood('a4-exhale')!.tempo);
  });

  it('carries the literal caps the contract wrote', () => {
    expect(HIT_CAP_MS['anc.track.unbolt']).toBe(450);
    expect(HIT_CAP_MS['anc.a1.color-stabilizes']).toBe(400);
    expect(HIT_CAP_MS['anc.descent.impact']).toBe(400);
    expect(HIT_CAP_MS['anc.lift.perspective-issued']).toBe(400);
    expect(HIT_CAP_MS['anc.a3.first-blade']).toBe(2750);
    expect(HIT_CAP_MS['anc.a3.material-lands']).toBe(2750);
    expect(HIT_CAP_MS['anc.maw.repair-answer']).toBe(450);
  });

  it.each(STORY_HIT_ANCHOR_IDS)('%s: some rung from the written quantum down to the floor fits inside the cap at the published tempo', (id) => {
    const row = STORY_HIT_ANCHORS[id];
    const fit = quantumFitsCapAtTempo(storyHitAnchorTempo(id), row.quantize, HIT_CAP_MS[id], {
      mayLead: row.mayLead,
      floorRung: row.floorRung
    });
    expect(fit.fits).toBe(true);
  });

  it('lands the contract\'s expected rungs: 8th where the beat exceeds the cap, beat where the cap IS a beat, bar for a3', () => {
    const rung = (id: StoryHitAnchorId) => {
      const row = STORY_HIT_ANCHORS[id];
      return quantumFitsCapAtTempo(storyHitAnchorTempo(id), row.quantize, HIT_CAP_MS[id], { mayLead: row.mayLead, floorRung: row.floorRung }).rung;
    };
    expect(rung('anc.track.unbolt')).toBe('step');
    expect(rung('anc.a1.color-stabilizes')).toBe('step');
    expect(rung('anc.descent.impact')).toBe('step');
    expect(rung('anc.maw.repair-answer')).toBe('step');
    expect(rung('anc.lift.perspective-issued')).toBe('beat'); // lead permitted: ≤ 357 ms either side
    expect(rung('anc.a2.feed-wall-falls')).toBe('beat');
    expect(rung('anc.a2.hand-back')).toBe('beat');
    expect(rung('anc.a4.life-front')).toBe('beat');
    expect(rung('anc.a3.first-blade')).toBe('bar');
    expect(rung('anc.a3.material-lands')).toBe('bar');
  });

  it('the a2/a4 rows never degrade to the step and the a4 cue is a bloom, never a braam', () => {
    expect(STORY_HIT_ANCHORS['anc.a2.feed-wall-falls'].floorRung).toBe('beat');
    expect(STORY_HIT_ANCHORS['anc.a2.hand-back'].floorRung).toBe('beat');
    expect(STORY_HIT_ANCHORS['anc.a4.life-front'].floorRung).toBe('beat');
    expect(STORY_HIT_ANCHORS['anc.a4.life-front'].kind).toBe('bloom');
    expect(STORY_HIT_ANCHORS['anc.descent.impact'].kind).toBe('impact');
    expect(STORY_HIT_ANCHORS['anc.lift.perspective-issued'].mayLead).toBe(true);
  });

  it('movie-lane BEAT_TIMEOUT margin: no anchor beat may time out inside cap + 0.25 s of its arming tick', () => {
    // Every anchor arms at beat entry or inside its own authored timeline; a
    // timeout on the beat must clear the cap plus the LATENCY_COMP_MAX_S margin.
    for (const id of STORY_HIT_ANCHOR_IDS) {
      const timeout = autopilotBeatTimeout(STORY_HIT_ANCHORS[id].beat);
      if (timeout == null) continue;
      expect(timeout).toBeGreaterThan(HIT_CAP_MS[id] / 1000 + 0.25);
    }
  });
});

describe('pitch-locked tonic chains (sc.chain.tonic-authority)', () => {
  it('enumerates membership by beat id exactly as the contract folds it in', () => {
    const chainOf = (beat: StoryBeat) => MOOD_TONIC_CHAINS[beat] ?? null;
    const expectChain = (beats: StoryBeat[], chain: TonicChainId) => beats.forEach((b) => expect(chainOf(b)).toBe(chain));
    expectChain(['crawl', 'manifest', 'voyage', 'deflect', 'crash', 'descent', 'ch1-fixed', 'ch1-track', 'ch1-raster', 'ch1-depth', 'ch1-nav', 'ch1-iso', 'ch1-lift', 'ch1-anomaly', 'a1-ramp'], 'prologue');
    expectChain(['ch2-color', 'ch2-approach', 'a2-awakening'], 'colour');
    expectChain(['ch3-dusk', 'ch3-await-rest', 'a3-dawn'], 'dusk');
    expectChain(['ch4-vigil', 'ch4-arrival', 'ch4-audit', 'ch4-comply', 'ch4-defy', 'a4-exhale'], 'vigil');
    expectChain(['ch7-reconstruct', 'ch7-board'], 'reconstruct');
    expectChain(['ch10-cold', 'ch10-ask', 'ch10-transit'], 'ch10');
    for (const beat of ['ch3-gather', 'ch3-thirst', 'ch3-forage', 'ch3-signal', 'ch5-maw', 'ch6-dive', 'ch8-launch', 'ch8-crossing', 'ch8-landfall', 'ch9-settle', 'ch9-hearth'] as StoryBeat[]) {
      expect(chainOf(beat)).toBeNull();
    }
    // Every chain member is a real beat in the canonical order.
    for (const beat of Object.keys(MOOD_TONIC_CHAINS)) expect(STORY_BEAT_ORDER).toContain(beat);
  });

  it('prologue is seed-unconditional, ch10 absolute at offset 0, the rest live-then-seed', () => {
    expect(TONIC_CHAIN_POLICY).toEqual({ prologue: 'seed', colour: 'live', dusk: 'live', vigil: 'live', reconstruct: 'live', ch10: 'absolute' });
    engine.state.seedRoot = 7;
    engine.state.bedTonic = 2;
    expect(deriveChainTonic('prologue')).toBe(7); // the live bed is NOT consulted
    expect(deriveChainTonic('ch10')).toBe(CH10_TONIC_OFFSET_SEMIS);
    expect(CH10_TONIC_OFFSET_SEMIS).toBe(0);
    expect(deriveChainTonic('colour')).toBe(2);
    engine.state.bedTonic = null;
    expect(deriveChainTonic('colour')).toBe(7);
  });

  it('holds the tonic across every member of a chain and re-derives only at a chain boundary', () => {
    engine.state.seedRoot = 5;
    setScoreBeat('crawl');
    expect(lastMoodCall()?.[1].tonicSemis).toBe(5);
    engine.state.seedRoot = 9; // a seed change mid-chain (cannot happen live) proves the HOLD
    for (const beat of ['manifest', 'voyage', 'descent', 'ch1-track', 'a1-ramp'] as StoryBeat[]) {
      setScoreBeat(beat);
      expect(lastMoodCall()?.[1].tonicSemis).toBe(5);
      expect(getHeldTonicChain()?.id).toBe('prologue');
    }
    setScoreBeat('ch2-color'); // colour chain: no live bed → planetHomeRoot(seed)
    expect(lastMoodCall()?.[1].tonicSemis).toBe(9);
    expect(getHeldTonicChain()?.id).toBe('colour');
  });

  it('member → member keeps pending hits; a chain exit cancels them (reset-score)', () => {
    setScoreBeat('ch3-dusk');
    engine.state.pending = 2;
    setScoreBeat('ch3-await-rest');
    expect(engine.cancelPendingScheduledHits).not.toHaveBeenCalled();
    setScoreBeat('a3-dawn');
    expect(engine.cancelPendingScheduledHits).not.toHaveBeenCalled();
    const exit = resolveBeatTonic('ch3-thirst'); // dusk exits to unchained play
    expect(exit.chain).toBeNull();
    expect(exit.cancelledPending).toBe(2);
    expect(getHeldTonicChain()).toBeNull();
  });

  it('unchained beats hold the current tonic (no interval jump) and adopt the live bed when it leads', () => {
    engine.state.seedRoot = 4;
    setScoreBeat('a3-dawn');
    expect(lastMoodCall()?.[1].tonicSemis).toBe(4);
    setScoreBeat('ch3-thirst');
    expect(lastMoodCall()?.[1].tonicSemis).toBe(4);
    engine.state.bedTonic = 11;
    setScoreBeat('ch3-forage');
    expect(lastMoodCall()?.[1].tonicSemis).toBe(11);
  });

  it('chain entry from bed-led play reads the live bed tonic; a mid-chain reload re-derives planetHomeRoot(seed) with interval identity kept', () => {
    // Cold run: ch3-signal is bed-led with tonic 11; the vigil chain enters on 11.
    engine.state.bedTonic = 11;
    engine.state.seedRoot = 3;
    setScoreBeat('ch4-vigil');
    expect(lastMoodCall()?.[1].tonicSemis).toBe(11);
    engine.state.bedTonic = null; // the story leads now; the bed is silent
    const coldRoots: number[] = [];
    for (const beat of ['ch4-arrival', 'ch4-audit', 'ch4-comply', 'ch4-defy', 'a4-exhale'] as StoryBeat[]) {
      setScoreBeat(beat);
      coldRoots.push(lastMoodCall()![1].tonicSemis! + getStoryScoreMood(beat)!.chord[0]);
    }
    // Reload mid-chain (deep link to ch4-audit): no live bed → planetHomeRoot(seed).
    resetStoryScoreRuntime();
    engine.setScoreMood.mockClear();
    const reloadRoots: number[] = [];
    for (const beat of ['ch4-audit', 'ch4-comply', 'ch4-defy', 'a4-exhale'] as StoryBeat[]) {
      setScoreBeat(beat);
      expect(lastMoodCall()?.[1].tonicSemis).toBe(3);
      reloadRoots.push(lastMoodCall()![1].tonicSemis! + getStoryScoreMood(beat)!.chord[0]);
    }
    // Interval identity: successive root intervals are identical; absolute pitch differs by the constant (11 − 3).
    const intervals = (roots: number[]) => roots.slice(1).map((r, i) => r - roots[i]);
    expect(intervals(reloadRoots)).toEqual(intervals(coldRoots.slice(1)));
    reloadRoots.forEach((r, i) => expect(coldRoots[i + 1] - r).toBe(11 - 3));
    // Deterministic: the same reload derives the same tonic.
    resetStoryScoreRuntime();
    setScoreBeat('ch4-audit');
    expect(lastMoodCall()?.[1].tonicSemis).toBe(3);
  });

  it('sandbox (null) drops the chain and cancels pending hits; ch10 never consults the seed', () => {
    engine.state.seedRoot = 8;
    setScoreBeat('ch10-cold');
    expect(lastMoodCall()?.[1].tonicSemis).toBe(0);
    setScoreBeat('ch10-ask');
    setScoreBeat('ch10-transit');
    expect(lastMoodCall()?.[1].tonicSemis).toBe(0);
    engine.state.pending = 1;
    setScoreBeat(null);
    expect(engine.cancelPendingScheduledHits).toHaveBeenCalled();
    expect(getHeldTonicChain()).toBeNull();
    expect(engine.setScoreMood.mock.lastCall?.[0]).toBeNull();
  });

  it('the ch10 carrier is a pure function of the shipped relay-answer entry at the absolute offset', () => {
    const answer = getChapter10ScoreMood('relay-answer');
    expect(answer.chord).toContain(CH10_CARRIER_DEGREE);
    expect(answer.progression?.some((chord) => chord.includes(CH10_CARRIER_DEGREE))).toBe(true);
    expect(CH10_CARRIER_HZ).toBeCloseTo(55 * Math.pow(2, 17 / 12), 6);
  });
});

describe('MOODS-as-constraints voicing policy', () => {
  it('every ch10 mood is literal; ch4-comply subtractive; a4-exhale ordered; everything else the default', () => {
    expect(resolveMoodVoicingPolicy('ch10-cold')).toBe('literal');
    expect(resolveMoodVoicingPolicy('ch10-ask')).toBe('literal');
    expect(resolveMoodVoicingPolicy('ch10-transit')).toBe('literal');
    expect(resolveMoodVoicingPolicy('ch4-comply')).toBe('subtractive');
    expect(resolveMoodVoicingPolicy('a4-exhale')).toBe('ordered');
    expect(resolveMoodVoicingPolicy('ch3-dusk')).toBe(MOOD_DEFAULT_VOICING);
    expect(new Set(CH10_SUBTRACTIVE_VARIANTS)).toEqual(new Set(['refused', 'seam-ebb']));
    expect(Object.keys(MOOD_VOICING_OVERRIDES).sort()).toEqual(['a4-exhale', 'ch10-ask', 'ch10-cold', 'ch10-transit', 'ch4-comply']);
  });

  it('passes the policy with every beat entry', () => {
    setScoreBeat('ch4-comply');
    expect(lastMoodCall()?.[1].voicingPolicy).toBe('subtractive');
    setScoreBeat('a4-exhale');
    expect(lastMoodCall()?.[1].voicingPolicy).toBe('ordered');
  });

  it('no MOODS literal changed: the authored table hashes to its pinned fingerprint', async () => {
    // Pinned from the working tree at the Stage 3 baseline (b631a52 + Stages 0–2).
    // The constraint layer interprets these entries; it never edits them.
    const inventory = listStoryScoreMoodInventory();
    expect(inventory).toHaveLength(62);
    const text = JSON.stringify(inventory.map((e) => ({ name: e.legacyName ?? e.name, mood: e.mood })));
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
    expect(hex).toBe(MOODS_LITERAL_FINGERPRINT);
  });

  it('records the actual 40+8+4+10 census and true Ch10 owning beats without changing authored pitches', () => {
    const inventory = listStoryScoreMoodInventory();
    expect(inventory.filter(e => e.variant === null)).toHaveLength(40);
    expect(inventory.filter(e => e.variant !== null && e.beat === 'ch7-reconstruct')).toHaveLength(8);
    expect(inventory.filter(e => e.variant !== null && e.beat === 'ch7-board')).toHaveLength(4);
    const chapter10 = inventory.filter(e => e.variant !== null && e.beat.startsWith('ch10-'));
    expect(chapter10.filter(e => e.beat === 'ch10-cold').map(e => e.variant)).toEqual(['cold-settled', 'fault-ledger', 'refused']);
    expect(chapter10.filter(e => e.beat === 'ch10-ask')).toHaveLength(4);
    expect(chapter10.filter(e => e.beat === 'ch10-transit').map(e => e.variant)).toEqual(['transit-hold', 'seam-ebb', 'station-resolved']);
    expect(chapter10.every(e => e.name === `${e.beat}/${e.variant}` && e.legacyName === `ch10-ask/${e.variant}` && e.carrierAlive)).toBe(true);
  });
});

describe('arming façade (composed sync)', () => {
  it('with no transport the site keeps its shipped timing: fallback, desired delay, immediate hit on fire', () => {
    engine.scheduleHit.mockReturnValueOnce(null);
    const arm = armStoryHit('anc.a1.color-stabilizes', { beatClock: 0, desiredDelayS: 8 });
    expect(arm.fallback).toBe(true);
    expect(arm.bundleDelayS).toBe(8);
    expect(arm.sfxAudioTime).toBeNull();
    expect(engine.noteImmediateHit).toHaveBeenCalledWith('bloom', 'anc.a1.color-stabilizes');
    fireStoryHitFallback('anc.a1.color-stabilizes');
    expect(engine.scoreHit).toHaveBeenLastCalledWith('bloom');
    fireStoryHitFallback('anc.descent.impact');
    expect(engine.scoreHit.mock.calls.slice(-2).map((c) => c[0])).toEqual(['boom', 'braam']);
  });

  it('with a schedule the bundle chases audioTime + latencyComp and the SFX member is forward-scheduled by the music-vs-SFX offset', () => {
    engine.scheduleHit.mockReturnValueOnce({
      kind: 'bloom', audioTime: 12.4, armedAt: 12.0, perfTime: 0, quantumLanded: 'step' as const, slackMs: 400, onsetAttackMs: 90
    });
    const arm = armStoryHit('anc.track.unbolt', { beatClock: 0 });
    expect(arm.fallback).toBe(false);
    expect(arm.fitsCap).toBe(true);
    // No context in this test → device 0; music-path 25.215 ms.
    expect(arm.latency.deviceS).toBe(0);
    expect(arm.bundleDelayS).toBeCloseTo(0.4 + 0.025215, 6);
    expect(arm.sfxAudioTime).toBeCloseTo(12.4 + (0.025215 - 0.01034), 6);
    expect(arm.sfxArmDelayS).toBeLessThan(arm.bundleDelayS);
    const req = engine.scheduleHit.mock.lastCall as unknown as [string, string, { capMs: number; anchorId: string; mayLead?: boolean; floorRung?: string }];
    expect(req[0]).toBe('bloom');
    expect(req[1]).toBe('beat');
    expect(req[2].capMs).toBe(450);
    expect(req[2].anchorId).toBe('anc.track.unbolt');
    const trace = getStoryBundleTrace();
    expect(trace[trace.length - 1]?.bundleAt).toBeCloseTo(arm.bundleDelayS, 9);
  });

  it('reports fitsCap false when the scheduler could not honour the cap (design error surfaces, never silent)', () => {
    engine.scheduleHit.mockReturnValueOnce({
      kind: 'bloom', audioTime: 13, armedAt: 12, perfTime: 0, quantumLanded: 'step' as const, slackMs: 1000, onsetAttackMs: 90
    });
    expect(armStoryHit('anc.maw.repair-answer', { beatClock: 3 }).fitsCap).toBe(false);
  });

  it('passes notBefore and mayLead through to the scheduler (a2 HUD-death floor, lift lead)', () => {
    engine.scheduleHit.mockReturnValueOnce(null);
    armStoryHit('anc.a2.feed-wall-falls', { beatClock: 0, desiredDelayS: 3.5, notBeforeDelayS: 2.825 });
    type Req = [string, string, { desired: number; notBefore?: number; floorRung?: string; mayLead?: boolean }];
    let req = engine.scheduleHit.mock.lastCall as unknown as Req;
    expect(req[2].notBefore).toBeCloseTo(2.825, 9);
    expect(req[2].desired).toBeCloseTo(3.5, 9);
    expect(req[2].floorRung).toBe('beat');
    engine.scheduleHit.mockReturnValueOnce(null);
    armStoryHit('anc.lift.perspective-issued', { beatClock: 0, desiredDelayS: 3.45 });
    req = engine.scheduleHit.mock.lastCall as unknown as Req;
    expect(req[2].mayLead).toBe(true);
  });
});

describe('bundle census (contract acceptanceCriteria[8], Chapter condition NEW 6)', () => {
  it('lists every anchor, and no state member is ever an image or SFX member', () => {
    for (const id of STORY_HIT_ANCHOR_IDS) {
      const m = STORY_BUNDLE_MEMBERS[id];
      expect(m).toBeDefined();
      for (const state of m.state) {
        expect(m.image).not.toContain(state);
        expect((m.sfx as readonly string[])).not.toContain(state);
      }
    }
  });

  it('distinguishes immediate Maw/A4 input commits from authored future landing commits', () => {
    expect(STORY_BUNDLE_MEMBERS['anc.a4.life-front'].immediateState).toContain('commitA4Alive');
    expect(STORY_BUNDLE_MEMBERS['anc.maw.repair-answer'].immediateState).toEqual(expect.arrayContaining(['repair receipt', 'repair commit']));
    for (const id of ['anc.a1.color-stabilizes', 'anc.a2.hand-back', 'anc.a3.material-lands'] as const) {
      expect(STORY_BUNDLE_MEMBERS[id].immediateState).toEqual([]);
      expect(STORY_BUNDLE_MEMBERS[id].timelineState.some((s) => s.startsWith('advanceToBeat'))).toBe(true);
    }
    expect(STORY_BUNDLE_MEMBERS['anc.a1.color-stabilizes'].state).toContain('setVoxelRealityStage(color)');
    expect(STORY_BUNDLE_MEMBERS['anc.a3.material-lands'].state).toContain('setVoxelRealityStage(material)');
  });

  it('records scheduling, actual commitment and presentation separately without retiming a late frame', () => {
    armStoryHit('anc.a3.material-lands', { beatClock: 0, desiredDelayS: 30 });
    const row = getStoryBundleTrace()[getStoryBundleTrace().length - 1]!;
    expect(row.schedulingArmAt.beatClock).toBe(0);
    expect(row.authoredCommitAt).toBeNull();
    expect(row.bundleAt).toBe(30);
    noteStoryBundleState('anc.a3.material-lands', 30.4);
    noteStoryBundleFired('anc.a3.material-lands', 30.4);
    expect(row.bundleAt).toBe(30);
    expect(row.authoredCommitAt?.beatClock).toBe(30.4);
    expect(row.authoredCommits[0].cause).toBe('timeline');
    expect(row.fired?.beatClock).toBe(30.4);
    armStoryHit('anc.maw.repair-answer', { beatClock: 2, desiredDelayS: 0.3 });
    noteStoryBundleState('anc.maw.repair-answer', 2);
    const maw = getStoryBundleTrace()[getStoryBundleTrace().length - 1]!;
    expect(maw.authoredCommitAt?.beatClock).toBe(maw.schedulingArmAt.beatClock);
    expect(maw.authoredCommitAt!.beatClock).toBeLessThan(maw.bundleAt);
  });

  it('extends the bounded foreground clock only to the signed composed timelines', () => {
    expect([...COMPOSED_TIMELINE_BEATS]).toEqual(['descent', 'ch1-lift', 'a1-ramp', 'a2-awakening', 'a3-dawn', 'a4-exhale', 'ch5-maw']);
    for (const beat of ['ch1-fixed', 'ch1-track', 'ch1-raster', 'ch3-gather', 'ch6-dive'] as const) expect(COMPOSED_TIMELINE_BEATS.has(beat)).toBe(false);
  });

  it('exactly five SFX-bearing bundles: storyAwaken ×3 (unbolt, a2 liberation, a4 alive), shipCrash, storyGlitch — matching the anchor table', () => {
    const sfxBearing = STORY_HIT_ANCHOR_IDS.filter((id) => STORY_BUNDLE_MEMBERS[id].sfx.length > 0).sort();
    expect(sfxBearing).toEqual(['anc.a2.feed-wall-falls', 'anc.a4.life-front', 'anc.descent.impact', 'anc.lift.perspective-issued', 'anc.track.unbolt'].sort());
    for (const id of STORY_HIT_ANCHOR_IDS) {
      expect(STORY_BUNDLE_MEMBERS[id].sfx[0] ?? null).toBe(STORY_HIT_ANCHORS[id].sfx);
    }
    const awaken = sfxBearing.filter((id) => STORY_BUNDLE_MEMBERS[id].sfx.includes('storyAwaken'));
    expect(awaken).toHaveLength(3);
  });
});

describe('two-clock guard', () => {
  it('neither clock releases a future authored or audio target; a late frame does not move either target', () => {
    engine.state.audioTime = 9.99;
    expect(bundlePresentationDue(10.1, 10, 10)).toBe(false);
    engine.state.audioTime = 10;
    expect(bundlePresentationDue(9.99, 10, 10)).toBe(false);
    expect(bundlePresentationDue(10, 10, 10)).toBe(true);
    engine.state.audioTime = 10.4;
    expect(bundlePresentationDue(10.4, 10, 10)).toBe(true);
    expect(bundlePresentationDue(9.99, 10, null)).toBe(false);
    expect(bundlePresentationDue(10, 10, null)).toBe(true);
  });
  it('the audio-clock target is fixed at arming (audioTime + latencyComp) and is never due without a context or in fallback', () => {
    engine.scheduleHit.mockReturnValueOnce({
      kind: 'bloom', audioTime: 12.4, armedAt: 12.0, perfTime: 0, quantumLanded: 'step' as const, slackMs: 400, onsetAttackMs: 90
    });
    const arm = armStoryHit('anc.track.unbolt', { beatClock: 0 });
    expect(arm.audibleAudioTime).toBeCloseTo(12.4 + arm.latency.totalS, 9);
    expect(bundleAudioClockDue(arm.audibleAudioTime)).toBe(false); // no context in this test
    expect(bundleAudioClockDue(null)).toBe(false);
    engine.scheduleHit.mockReturnValueOnce(null);
    expect(armStoryHit('anc.a1.color-stabilizes', { beatClock: 0, desiredDelayS: 8 }).audibleAudioTime).toBeNull();
  });
});

describe('bundle latency (C6, per sample-rate table)', () => {
  it('selects the pinned entry by ctx.sampleRate and reports the key, device and music-path terms', () => {
    const at48 = resolveBundleLatency({ outputLatency: 0.02, baseLatency: 0.005, sampleRate: 48000 });
    expect(at48.sampleRateKey).toBe(48000);
    expect(at48.musicPathS).toBeCloseTo(0.024667, 6);
    expect(at48.musicVsSfxS).toBeCloseTo(0.014667, 6);
    expect(at48.deviceS).toBe(0.02);
    expect(at48.totalS).toBeCloseTo(0.044667, 6);
    const at44 = resolveBundleLatency({ outputLatency: 0, baseLatency: 0.011, sampleRate: 44100 });
    expect(at44.sampleRateKey).toBe(44100);
    expect(at44.deviceS).toBe(0.011); // outputLatency 0 is not "finite and positive" → baseLatency
    expect(at44.musicPathS).toBeCloseTo(0.025215, 6);
    const odd = resolveBundleLatency({ sampleRate: 96000 });
    expect(odd.sampleRateKey).toBe(48000); // nearest pinned key, never interpolated
  });
  it('clamps the whole term to LATENCY_COMP_MAX_S and treats a missing context as device 0 at the 44.1 kHz key', () => {
    expect(resolveBundleLatency({ outputLatency: 5, sampleRate: 44100 }).totalS).toBe(0.25);
    const none = resolveBundleLatency(null);
    expect(none.deviceS).toBe(0);
    expect(none.sampleRateKey).toBe(44100);
    expect(none.contextSampleRate).toBeNull();
  });
});

// The authored table's fingerprint (see 'no MOODS literal changed'). Regenerate ONLY
// with a contracted mood edit: node -e on listStoryScoreMoodInventory().
const MOODS_LITERAL_FINGERPRINT = '4653eec4f930cc129de8116414aa7551562bc10be8a7d6fc51cd075d84525847';
