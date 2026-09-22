import { describe, expect, it } from 'vitest';
import {
  MIX_STATE_BUS_GAIN_DB,
  MUSIC_SUBMERGE_MUFFLED_HZ,
  MUSIC_SUBMERGE_OPEN_HZ,
  SFX_SUBMERGE_MUFFLED_HZ,
  SFX_SUBMERGE_OPEN_HZ,
  resolveMixSceneState,
  resolveMixSnapshot,
  sameBusGains,
  type MixSnapshotInput
} from './mixSnapshot.ts';
import { MIX_BUSES } from './mixTuning.ts';

const base: MixSnapshotInput = {
  phase: 'playing',
  storyLead: false,
  submergence: 0,
  station: false,
  quality: 'full'
};

describe('snapshot mixer (pure)', () => {
  it('sandbox is unity on every bus (sandbox law) and the plain room', () => {
    const s = resolveMixSnapshot(base);
    expect(s.state).toBe('sandbox');
    for (const bus of MIX_BUSES) expect(s.busGainDb[bus]).toBe(0);
    expect(s.roomPresetId).toBe('plain');
    expect(s.musicSubmergeCutoffHz).toBe(MUSIC_SUBMERGE_OPEN_HZ);
    expect(s.sfxSubmergeCutoffHz).toBe(SFX_SUBMERGE_OPEN_HZ);
    expect(s.sfxSubmerged).toBe(false);
  });

  it('precedence: station > dive > story-lead > menu > sandbox', () => {
    expect(resolveMixSceneState({ ...base, phase: 'menu' })).toBe('menu');
    expect(resolveMixSceneState({ ...base, phase: 'menu', storyLead: true })).toBe('story-lead');
    expect(resolveMixSceneState({ ...base, storyLead: true, submergence: 0.9 })).toBe('dive');
    expect(resolveMixSceneState({ ...base, submergence: 0.9, station: true })).toBe('station');
  });

  it('derives both submerge cutoffs from one scalar with one edge', () => {
    const shallow = resolveMixSnapshot({ ...base, submergence: 0.4 });
    expect(shallow.sfxSubmerged).toBe(false);
    expect(shallow.musicSubmergeCutoffHz).toBeLessThan(MUSIC_SUBMERGE_OPEN_HZ);
    const deep = resolveMixSnapshot({ ...base, submergence: 1 });
    expect(deep.sfxSubmerged).toBe(true);
    expect(deep.sfxSubmergeCutoffHz).toBe(SFX_SUBMERGE_MUFFLED_HZ);
    expect(deep.musicSubmergeCutoffHz).toBeCloseTo(MUSIC_SUBMERGE_MUFFLED_HZ, 6);
    expect(deep.roomPresetId).toBe('underwater');
  });

  it('never publishes a bus gain above 0 dB in any state', () => {
    for (const gains of Object.values(MIX_STATE_BUS_GAIN_DB)) {
      for (const db of Object.values(gains)) expect(db).toBeLessThanOrEqual(0);
    }
    expect(resolveMixSnapshot({ ...base, storyLead: true }).busGainDb.music).toBe(0);
  });

  it('dirty check: equal gains within epsilon are the same snapshot', () => {
    const a = resolveMixSnapshot(base);
    const b = resolveMixSnapshot({ ...base, quality: 'lean' });
    expect(sameBusGains(a, b, 0.05)).toBe(true);
    const c = resolveMixSnapshot({ ...base, storyLead: true });
    expect(sameBusGains(a, c, 0.05)).toBe(false);
  });
});
