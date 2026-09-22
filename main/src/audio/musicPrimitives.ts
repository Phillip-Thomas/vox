// --- Global music primitives -----------------------------------------------------------
//
// ONE vocabulary for everything that makes sound. The world and the story write
// these rails; every engine (the streamed-layer mixer, the procedural score,
// future stems) reads them — so any combination of factors resolves to a
// coherent celestial harmony instead of systems talking over each other.
//
//   era     0..1  music fidelity ladder — follows the REALITY STAGE (bare
//                 terminal ⇒ procedural chip; alive world ⇒ recorded music)
//   warmth  0..1  daylight / safety / the campfire end of the palette
//   wonder  0..1  night sky, deep space, bioluminescence, the celestial axis
//   tension 0..1  drama rail (the story director's ramps; warp in sandbox)
//   energy  0..1  kinetic rail (warp, sprint, cutscene motion)
//
// Plus the HARMONIC CENTER — root (semitones from A) and chord — published by
// whichever engine is leading, consumed by every procedural voice, so nothing
// ever plays against the current key.
//
// Setters write TARGETS; `tickMusicPrimitives(dt)` (AudioDirector's rAF) smooths
// the live values so every consumer breathes at the same rate.

export interface MusicPrimitives {
  era: number;
  warmth: number;
  wonder: number;
  tension: number;
  energy: number;
}

/** The module's cold-start rails — also the offline harness's reset point. */
export const DEFAULT_MUSIC_PRIMITIVES: Readonly<MusicPrimitives> = {
  era: 1,
  warmth: 0.6,
  wonder: 0.4,
  tension: 0.15,
  energy: 0.2
};
const DEFAULT_CHORD_ROOT = 0;
const DEFAULT_CHORD: readonly number[] = [0, 7, 12];

const live: MusicPrimitives = { ...DEFAULT_MUSIC_PRIMITIVES };
const target: MusicPrimitives = { ...live };

let chordRoot = DEFAULT_CHORD_ROOT;
let chord: number[] = [...DEFAULT_CHORD];

/**
 * Offline-harness only: return the module globals to their cold-start values.
 * The live game has exactly one page-lifetime of these rails; a render harness
 * runs many renders in one page, and a render that inherits the previous
 * render's rails is not reproducible.
 */
export function resetMusicPrimitives(): void {
  Object.assign(live, DEFAULT_MUSIC_PRIMITIVES);
  Object.assign(target, DEFAULT_MUSIC_PRIMITIVES);
  chordRoot = DEFAULT_CHORD_ROOT;
  chord = [...DEFAULT_CHORD];
}

export function setMusicPrimitiveTargets(patch: Partial<MusicPrimitives>): void {
  for (const key of Object.keys(patch) as Array<keyof MusicPrimitives>) {
    const value = patch[key];
    if (value != null && Number.isFinite(value)) {
      target[key] = Math.min(1, Math.max(0, value));
    }
  }
}

/** Smooth live values toward targets (call once per frame from one place). */
export function tickMusicPrimitives(dt: number): void {
  const k = Math.min(1, dt * 1.6); // ~0.6s to close most of the gap
  for (const key of Object.keys(live) as Array<keyof MusicPrimitives>) {
    live[key] += (target[key] - live[key]) * k;
  }
}

export function getMusicPrimitives(): Readonly<MusicPrimitives> {
  return live;
}

/** The harmonic center: published by the leading engine, read by all voices. */
export function setMusicChord(root: number, tones: number[]): void {
  chordRoot = root;
  chord = tones.length ? [...tones] : [0];
}

export function getMusicChord(): { root: number; chord: readonly number[] } {
  return { root: chordRoot, chord };
}
