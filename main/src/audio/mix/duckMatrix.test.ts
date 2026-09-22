import { describe, expect, it } from 'vitest';
import { DUCK_MATRIX, dbToGain, duckEnvelopePoints, resolveDuck } from './duckMatrix.ts';
import { DUCK_STORY_LEAD_CAP_DB } from './mixTuning.ts';


describe('duck matrix (pure)', () => {
  it('a ship impact ducks music -6 dB reaching depth at 40 ms, world -3 dB', () => {
    const row = resolveDuck('shipImpact', { storyLead: false });
    expect(row.music).toEqual({ db: -6, attackS: 0.04, holdS: 0.1, releaseS: 0.9 });
    expect(row.world?.db).toBe(-3);
    expect(row.player).toBeUndefined();
  });

  it('caps the music column at DUCK_STORY_LEAD_CAP_DB under a story lead, other columns untouched', () => {
    const lead = resolveDuck('voice', { storyLead: true });
    expect(lead.music?.db).toBe(DUCK_STORY_LEAD_CAP_DB);
    expect(lead.world?.db).toBe(DUCK_MATRIX.voice.world?.db);
    const free = resolveDuck('voice', { storyLead: false });
    expect(free.music?.db).toBe(-9);
  });

  it('never resolves a positive (makeup) depth', () => {
    for (const source of Object.keys(DUCK_MATRIX) as Array<keyof typeof DUCK_MATRIX>) {
      for (const state of [true, false]) {
        const row = resolveDuck(source, { storyLead: state });
        for (const s of Object.values(row)) expect(s!.db).toBeLessThan(0);
      }
    }
  });

  it('envelope points are literal: unity → depth at attack → hold → unity at attack+hold+release', () => {
    const pts = duckEnvelopePoints({ db: -6, attackS: 0.04, holdS: 0.1, releaseS: 0.9 });
    expect(pts.map((p) => p.offsetS)).toEqual([0, 0.04, 0.14000000000000001, 1.04]);
    expect(pts[1].gain).toBeCloseTo(dbToGain(-6), 9);
    expect(pts[0].gain).toBe(1);
    expect(pts[3].gain).toBe(1);
  });
});

// --- S2-D10: schedule-time cap resolution, pinned (Stage 3) -------------------------------------------
import { STORY_AUTHORITY_CROSSFADE_S } from '../scoreEngine.ts';


describe('S2-D10 schedule-time story-lead cap', () => {
  it('a duck scheduled with storyLead false keeps its full envelope when the story lead flips 0.2 s later', () => {
    const state = { storyLead: false };
    const row = resolveDuck('shipImpact', state);
    const points = duckEnvelopePoints(row.music!);
    // The lead begins mid-envelope: nothing about the already-scheduled points may move.
    state.storyLead = true;
    const after = duckEnvelopePoints(row.music!);
    expect(after).toEqual(points);
    expect(points[1].gain).toBeCloseTo(dbToGain(-6), 9);
    // A duck scheduled AFTER the flip resolves the cap — the only thing the state changes.
    expect(dbToGain(resolveDuck('shipImpact', state).music!.db)).toBeCloseTo(dbToGain(DUCK_STORY_LEAD_CAP_DB), 9);
  });

  it('every cap-affected row (music depth below the cap) completes inside STORY_AUTHORITY_CROSSFADE_S / 2', () => {
    const budget = STORY_AUTHORITY_CROSSFADE_S / 2;
    for (const [source, row] of Object.entries(DUCK_MATRIX)) {
      const music = row.music;
      if (!music) continue;
      const capAffected = music.db < DUCK_STORY_LEAD_CAP_DB;
      const total = music.attackS + music.holdS + music.releaseS;
      if (capAffected) expect(total, `${source} music row`).toBeLessThanOrEqual(budget);
    }
  });

  it('pins the exemption: oxygenCritical sits exactly at the cap on music, so schedule-time resolution cannot change it', () => {
    const music = DUCK_MATRIX.oxygenCritical.music!;
    expect(music.db).toBe(DUCK_STORY_LEAD_CAP_DB);
    expect(music.attackS + music.holdS + music.releaseS).toBeGreaterThan(STORY_AUTHORITY_CROSSFADE_S / 2);
    expect(resolveDuck('oxygenCritical', { storyLead: true }).music!.db).toBe(music.db);
  });
});
