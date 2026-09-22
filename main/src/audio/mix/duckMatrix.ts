import { DUCK_MIN_DB, DUCK_STORY_LEAD_CAP_DB, type MixBus } from './mixTuning.ts';

// --- The duck matrix (pure) -----------------------------------------------------------------------------
//
// dB depth and time shape per (edge source × target bus), keyed further by the
// score state. Applied from EVENTS only (a category-bus gain slews on the edge
// and recovers); never per frame. Under a story lead the music column is
// capped at DUCK_STORY_LEAD_CAP_DB: the score holds authority while a beat is
// active. No makeup exists anywhere in the chain, so a duck can only subtract.
//
// Schedule-time resolution (Score Director decision S2-D10, audio-10x Stage 3,
// ACCEPT-AND-DOCUMENT): the story-lead cap is resolved ONCE when the duck is
// scheduled (sfxEngine's scoreState()/stateAt() at the event) and is never
// re-resolved when a story lead begins mid-envelope. A beat that opens inside a
// duck has its mood at most ~23 % into STORY_AUTHORITY_CROSSFADE_S when the
// longest cap-affected row (shipImpact, 1.04 s) has fully released; the worst
// case is 3 dB of extra duck on a voice that has not yet arrived. Re-resolving
// would add a mid-envelope cancel-and-re-ramp on the music bus for a difference
// the ear cannot place. duckMatrix.test.ts pins both: the envelope points are a
// function of the state at schedule time only, and every cap-affected row's
// attack + hold + release stays at or under STORY_AUTHORITY_CROSSFADE_S / 2 so
// the decision reopens automatically if a longer cap-affected row is added.
// (oxygenCritical is 2.6 s but sits AT the cap on its music column, so the cap's
// resolution time cannot change it; the test pins that exemption explicitly.)

export type DuckSource = 'shipImpact' | 'voice' | 'terminalAlarm' | 'oxygenCritical' | 'lifecycleCue';

export interface DuckShape {
  /** Depth, dB (negative). */
  db: number;
  /** Time to reach the depth, seconds (a literal linear ramp). */
  attackS: number;
  /** Time held at depth before the release begins, seconds. */
  holdS: number;
  /** Time to recover to unity, seconds (a literal linear ramp). */
  releaseS: number;
}

export interface ScoreState {
  /** A story MOODS beat currently leads the instrument. */
  storyLead: boolean;
}

export type DuckRow = Partial<Record<MixBus, DuckShape>>;

const shape = (db: number, attackS: number, holdS: number, releaseS: number): DuckShape => ({
  db,
  attackS,
  holdS,
  releaseS
});

/** Rows are edge sources; columns are the buses they push aside. */
export const DUCK_MATRIX: Record<DuckSource, DuckRow> = {
  shipImpact: {
    music: shape(-6, 0.04, 0.1, 0.9),
    world: shape(-3, 0.04, 0.1, 0.6)
  },
  voice: {
    music: shape(-9, 0.08, 0.2, 1.2),
    world: shape(-4, 0.08, 0.2, 1.0),
    player: shape(-2, 0.08, 0.2, 1.0)
  },
  terminalAlarm: {
    music: shape(-4, 0.03, 0.15, 0.7),
    world: shape(-6, 0.03, 0.15, 0.7)
  },
  oxygenCritical: {
    music: shape(-3, 0.2, 0.4, 2.0),
    world: shape(-6, 0.2, 0.4, 2.0)
  },
  lifecycleCue: {
    music: shape(-2, 0.05, 0.1, 0.6),
    world: shape(-2, 0.05, 0.1, 0.6)
  }
};

/**
 * The duck an edge applies in the given score state. Depths shallower than
 * DUCK_MIN_DB are dropped; the music column is capped under a story lead.
 */
export function resolveDuck(source: DuckSource, state: ScoreState): DuckRow {
  const row = DUCK_MATRIX[source];
  const out: DuckRow = {};
  for (const bus of Object.keys(row) as MixBus[]) {
    const s = row[bus];
    if (!s) continue;
    let db = Math.min(0, s.db);
    if (bus === 'music' && state.storyLead) db = Math.max(db, DUCK_STORY_LEAD_CAP_DB);
    if (db > DUCK_MIN_DB) continue;
    out[bus] = { ...s, db };
  }
  return out;
}

export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

/**
 * The literal automation points of one duck, relative to its edge time: a
 * start anchor at unity (or the given start gain), the depth at attack, held,
 * then unity again at attack + hold + release.
 */
export function duckEnvelopePoints(
  s: DuckShape,
  startGain = 1
): ReadonlyArray<{ offsetS: number; gain: number }> {
  const depth = dbToGain(s.db);
  return [
    { offsetS: 0, gain: startGain },
    { offsetS: s.attackS, gain: depth },
    { offsetS: s.attackS + s.holdS, gain: depth },
    { offsetS: s.attackS + s.holdS + s.releaseS, gain: 1 }
  ];
}
