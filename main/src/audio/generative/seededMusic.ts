import { fnv1a32, seededUnit } from '../../utils/worldCoordinates.ts';

// --- Seeded choice for the generative score (grammar law: constrained randomness) ----------
//
// ALL stochastic choice flows through here: identity draws salt on the planet
// seed alone; musical-time draws salt on (planet seed, barIndex, purpose).
// seededUnit/fnv1a32 only — no Math.random anywhere in a generative path, so
// any bar is reproducible given the same rail history.

/** Purpose salts — fnv1a32 of stable strings, computed once at load. */
export const SALT_TONIC = fnv1a32('score:tonic');
export const SALT_HOME_MODE = fnv1a32('score:home-mode');
export const SALT_CHORD_TIEBREAK = fnv1a32('score:chord-tiebreak');
export const SALT_COLOR_DRAW = fnv1a32('score:color-draw');
export const SALT_COLOR_INTENT = fnv1a32('score:color-intent');
export const SALT_MEDIANT = fnv1a32('score:mediant');
export const SALT_CADENCE = fnv1a32('score:cadence');
export const SALT_MODE_DRIFT = fnv1a32('score:mode-drift');
export const SALT_MODE_DIR = fnv1a32('score:mode-dir');
export const SALT_CURVE_SHAPE = fnv1a32('score:curve-shape');
// Motif DNA (identity draws — salt on the planet seed alone; per-interval
// draws mix the interval index in via musicSalt).
export const SALT_CONTOUR_LEN = fnv1a32('score:contour-len');
export const SALT_CONTOUR_STEP = fnv1a32('score:contour-step');
export const SALT_CONTOUR_SIGN = fnv1a32('score:contour-sign');
export const SALT_RHYTHM_CELL = fnv1a32('score:rhythm-cell');
export const SALT_ANCHOR_START = fnv1a32('score:anchor-start');
export const SALT_ANCHOR_LAND = fnv1a32('score:anchor-land');
export const SALT_TEMPO = fnv1a32('score:tempo');
export const SALT_METER = fnv1a32('score:meter');
// Musical-time motif/rhythm draws.
export const SALT_EXTEND_STEP = fnv1a32('score:extend-step');
export const SALT_EXTEND_SIGN = fnv1a32('score:extend-sign');
export const SALT_HUMANIZE = fnv1a32('score:humanize');
// P3 bed: arrangement, statements, textures, macro-drift phases.
export const SALT_ARRANGE = fnv1a32('score:arrange');
export const SALT_ARRANGE_PICK = fnv1a32('score:arrange-pick');
export const SALT_MELODY_STATE = fnv1a32('score:melody-statement');
export const SALT_MELODY_CHAIN = fnv1a32('score:melody-chain');
export const SALT_VELOCITY = fnv1a32('score:velocity');
export const SALT_OST_DROP = fnv1a32('score:ost-drop');
export const SALT_PERC_PAN = fnv1a32('score:perc-pan');
export const SALT_DRIFT_MODE_PHASE = fnv1a32('score:drift-mode-phase');
export const SALT_DRIFT_REGISTER_PHASE = fnv1a32('score:drift-register-phase');
export const SALT_DRIFT_TEXTURE_PHASE = fnv1a32('score:drift-texture-phase');
export const SALT_REGION = fnv1a32('score:region');
// P5 story-mood melody generalization (§10.5): entry, chain pick, velocities.
export const SALT_MOOD_PHRASE = fnv1a32('score:mood-phrase');
export const SALT_MOOD_CHAIN = fnv1a32('score:mood-chain');
export const SALT_MOOD_VEL = fnv1a32('score:mood-velocity');

/** Musical-time salt: mixes a purpose salt with a bar (or phrase) index. */
export function musicSalt(purposeSalt: number, timeIndex: number): number {
  return (purposeSalt ^ Math.imul(timeIndex | 0, 2654435761)) | 0;
}

/** Deterministic unit draw for a musical-time decision. */
export function musicUnit(seed: number, purposeSalt: number, timeIndex: number): number {
  return seededUnit(seed, musicSalt(purposeSalt, timeIndex));
}

/** Weighted pick from [item, weight] entries via one seeded draw. */
export function seededPickWeighted<T>(
  entries: ReadonlyArray<readonly [T, number]>,
  unit: number
): T {
  let total = 0;
  for (const [, w] of entries) total += Math.max(0, w);
  if (total <= 0) return entries[0][0];
  let acc = 0;
  const target = unit * total;
  for (const [item, w] of entries) {
    acc += Math.max(0, w);
    if (target < acc) return item;
  }
  return entries[entries.length - 1][0];
}
