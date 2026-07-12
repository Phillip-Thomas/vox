import type { ArchetypeId } from '../../game/data/planetArchetypes.ts';
import { seededUnit } from '../../utils/worldCoordinates.ts';
import { setMusicChord } from '../musicPrimitives.ts';
import {
  chromaticMediants,
  degreeTriad,
  MODE_BRIGHTNESS_CHAIN,
  MODE_CADENCE_ROOTS,
  MODE_DEGREE_SETS,
  modeTonicTriad,
  pcMod,
  tonnetzDistance,
  triadId,
  type ChordQuality,
  type ModeName,
  type TriadSpec
} from './theory.ts';
import {
  isLegalTransition,
  leadVoices,
  leadVoicesRange,
  nearestPitchInBand,
  voiceTriad,
  type Voicing
} from './voiceLeading.ts';
import { chooseCurveShape, chordTension, colorIntentDissonance, planTensionCurve, type CurveShape } from './tension.ts';
import {
  musicSalt,
  musicUnit,
  SALT_CADENCE,
  SALT_CHORD_TIEBREAK,
  SALT_COLOR_DRAW,
  SALT_COLOR_INTENT,
  SALT_HOME_MODE,
  SALT_MEDIANT,
  SALT_MODE_DIR,
  SALT_MODE_DRIFT,
  SALT_TONIC,
  seededPickWeighted
} from './seededMusic.ts';
import {
  ARCHETYPE_MODE_WEIGHTS,
  BAND_SLEW_SEMIS,
  CADENCE_BIAS_P,
  CADENCE_START_POS,
  CHORD_TABU,
  CHORD_TIE_EPSILON,
  COLOR_INTENT_WEIGHTS,
  COLOR_P_SCALE,
  DEFAULT_MODE_WEIGHTS,
  GOLDEN_MEDIANT_MULT,
  GOLDEN_WINDOW_MIN,
  HARMONY_BARS_DEFAULT,
  HARMONY_BARS_FAST,
  HARMONY_BARS_REST,
  HARMONY_FAST_ENERGY_MIN,
  HARMONY_REST_ENERGY_MAX,
  IONIAN_WARMTH_GATE,
  MEDIANT_BASE_P,
  MEDIANT_P_MAX,
  MODE_DRIFT_DIR_BIAS,
  MODE_DRIFT_MIN_PHRASES,
  MODE_DRIFT_P,
  PHRASE_BARS,
  REGISTER_BAND_CENTER_BASE,
  REGISTER_BAND_HALF_WIDTH,
  REGISTER_WARMTH_LIFT_SEMIS,
  TENSION_COLOR_GATE,
  TENSION_PHRYGIAN_GATE
} from './tuning.ts';

// --- The harmony brain (§6.1) ----------------------------------------------------------------
//
// ONE pure module owns tonic, mode, current chord (root pc + quality + color +
// voicing), phrase position, and the scheduled tension curve. It is the ONLY
// publisher of setMusicChord once it leads (P3 wires it under AudioDirector).
// Advance it once per bar with the current rails; every stochastic choice is
// seeded on (planetSeed, barIndex, purpose) — any bar is reproducible given
// the same rail history. No Math.random anywhere.

export interface HarmonyRails {
  /** Drama rail, 0..1 (musicPrimitives.tension). */
  tension: number;
  /** Kinetic rail, 0..1 — drives harmonic rhythm, never bpm. */
  energy: number;
  /** Daylight rail, 0..1 — brightness drift bias + register lift. */
  warmth: number;
  /** Reality effect `chroma`, 0..1 — color-tone probability. */
  chroma: number;
  /** localGolden, 0..1 — the golden cadence window (mediant boost). */
  golden: number;
  /**
   * Voicing-band shift in semitones (P3: register macro-drift + night sink,
   * §7.3/§8.3). Optional; 0 when absent. Applies at chord changes only.
   */
  registerShift?: number;
}

export interface HarmonyChord {
  rootPc: number;
  quality: ChordQuality;
  /** Color-tone intervals above the root, semitones (e.g. add9 → [14]). */
  colorIntervals: number[];
}

export interface HarmonyBrainState {
  planetSeed: number;
  tonicPc: number;
  homeMode: ModeName;
  mode: ModeName;
  chord: HarmonyChord;
  voicing: Voicing;
  bandCenter: number;
  /** Absolute bars elapsed (salt for musical-time draws). */
  barIndex: number;
  /** 0..PHRASE_BARS-1, position of the bar about to be processed. */
  phrasePos: number;
  /** Index of the current phrase. */
  phraseIndex: number;
  barsSinceChord: number;
  phrasesSinceModeDrift: number;
  mediantUsedThisPhrase: boolean;
  /** Last CHORD_TABU distinct chord ids (most recent last). */
  recentChordIds: string[];
  curve: number[];
  curveShape: CurveShape | null;
}

export interface HarmonyBarEvent {
  barIndex: number;
  phrasePos: number;
  /** Did the chord change on this bar? */
  changed: boolean;
  chordId: string;
  chord: HarmonyChord;
  /** Voice-leading stats of the transition (0s when no change). */
  displacement: number;
  maxVoice: number;
  commonTones: number;
  /** Curve target for this bar. */
  target: number;
  mediant: boolean;
  cadenceBiased: boolean;
  /** True when the tabu window had to be bypassed to keep a legal change. */
  tabuBypass: boolean;
  /** True when a change was due but no candidate was legal (held instead). */
  heldNoLegal: boolean;
  /** Non-null when the mode drifted at this bar's phrase boundary. */
  modeDrifted: ModeName | null;
  /** Non-null when a new phrase curve was planned at this bar. */
  curvePlanned: CurveShape | null;
}

export interface AdvanceOptions {
  /** Arrangement override for the phrase shape (P3 wiring). */
  forcedShape?: CurveShape;
  /** A grid-scheduled hit/bloom lands this bar — mediants become permitted. */
  hitScheduled?: boolean;
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const triadIdx = (t: TriadSpec): number => pcMod(t.rootPc) * 2 + (t.quality === 'maj' ? 1 : 0);

/** Realize a color intent for a chord quality as intervals above the root. */
function realizeColor(intent: string, quality: ChordQuality): number[] {
  switch (intent) {
    case 'add9': return [14];
    case 'add6': return [9];
    case 'seventh': return quality === 'maj' ? [11] : [10];
    case 'flat9': return [13];
    case 'sharp11': return [18];
    default: return [];
  }
}

/** Ionian's V is triad color only — never a 7th, never dressed (§6.3). */
function colorAllowed(candidate: TriadSpec, tonicPc: number, mode: ModeName): boolean {
  return !(mode === 'ionian' && candidate.quality === 'maj' && pcMod(candidate.rootPc - tonicPc) === 7);
}

// --- Creation ---------------------------------------------------------------------------------

export interface CreateHarmonyOptions {
  /** Planet archetype — weights the home-mode draw (§8.4). */
  archetype?: ArchetypeId;
}

/** Derive the planet's key: tonic pc + home mode, from the seed alone. */
export function derivePlanetKey(
  planetSeed: number,
  archetype?: ArchetypeId
): { tonicPc: number; homeMode: ModeName } {
  const tonicPc = Math.floor(seededUnit(planetSeed, SALT_TONIC) * 12) % 12;
  const weights = archetype ? ARCHETYPE_MODE_WEIGHTS[archetype] : DEFAULT_MODE_WEIGHTS;
  const homeMode = seededPickWeighted(weights, seededUnit(planetSeed, SALT_HOME_MODE));
  return { tonicPc, homeMode };
}

export function createHarmonyBrain(planetSeed: number, opts?: CreateHarmonyOptions): HarmonyBrainState {
  const { tonicPc, homeMode } = derivePlanetKey(planetSeed, opts?.archetype);
  const tonicTriad = modeTonicTriad(tonicPc, homeMode);
  const bandCenter = REGISTER_BAND_CENTER_BASE;
  return {
    planetSeed,
    tonicPc,
    homeMode,
    mode: homeMode,
    chord: { rootPc: tonicTriad.rootPc, quality: tonicTriad.quality, colorIntervals: [] },
    voicing: voiceTriad(tonicTriad, bandCenter, REGISTER_BAND_HALF_WIDTH),
    bandCenter,
    barIndex: 0,
    phrasePos: 0,
    phraseIndex: 0,
    barsSinceChord: 0,
    phrasesSinceModeDrift: 0,
    mediantUsedThisPhrase: false,
    recentChordIds: [triadId(tonicTriad)],
    curve: planTensionCurve('PLATEAU', 0),
    curveShape: null
  };
}

// --- Per-bar advance ----------------------------------------------------------------------------

export function harmonyBarsFor(energy: number): number {
  if (energy > HARMONY_FAST_ENERGY_MIN) return HARMONY_BARS_FAST;
  if (energy < HARMONY_REST_ENERGY_MAX) return HARMONY_BARS_REST;
  return HARMONY_BARS_DEFAULT;
}

/** Single-accidental mode drift at phrase boundaries (§6.2). */
function tryModeDrift(state: HarmonyBrainState, rails: HarmonyRails): ModeName | null {
  if (state.phrasesSinceModeDrift < MODE_DRIFT_MIN_PHRASES) return null;
  if (musicUnit(state.planetSeed, SALT_MODE_DRIFT, state.phraseIndex) >= MODE_DRIFT_P) return null;
  const pBright = clamp01(0.5 + MODE_DRIFT_DIR_BIAS * (rails.warmth - rails.tension));
  const bright = musicUnit(state.planetSeed, SALT_MODE_DIR, state.phraseIndex) < pBright;
  const idx = MODE_BRIGHTNESS_CHAIN.indexOf(state.mode) + (bright ? 1 : -1);
  if (idx < 0 || idx >= MODE_BRIGHTNESS_CHAIN.length) return null;
  const next = MODE_BRIGHTNESS_CHAIN[idx];
  if (next === 'ionian' && rails.warmth < IONIAN_WARMTH_GATE) return null; // major is EARNED
  if (next === 'phrygian' && rails.tension <= TENSION_PHRYGIAN_GATE) return null; // ♭2 is strain
  state.mode = next;
  state.phrasesSinceModeDrift = 0;
  return next;
}

/**
 * Advance the brain by ONE bar (call at each bar line, rAF never schedules).
 * Mutates `state`; returns the bar's event record (rich, for tests and logs).
 */
export function advanceHarmonyBar(
  state: HarmonyBrainState,
  rails: HarmonyRails,
  opts?: AdvanceOptions
): HarmonyBarEvent {
  let modeDrifted: ModeName | null = null;
  let curvePlanned: CurveShape | null = null;

  // Phrase boundary: ration reset, mode drift, curve planning.
  if (state.phrasePos === 0) {
    state.mediantUsedThisPhrase = false;
    if (state.barIndex > 0) state.phrasesSinceModeDrift++;
    modeDrifted = tryModeDrift(state, rails);
    const shape =
      opts?.forcedShape ??
      chooseCurveShape(state.planetSeed, state.phraseIndex, rails.tension, rails.energy, state.curveShape);
    state.curve = planTensionCurve(shape, rails.tension);
    state.curveShape = shape;
    curvePlanned = shape;
  }

  const target = state.curve[state.phrasePos];
  const event: HarmonyBarEvent = {
    barIndex: state.barIndex,
    phrasePos: state.phrasePos,
    changed: false,
    chordId: triadId(state.chord),
    chord: state.chord,
    displacement: 0,
    maxVoice: 0,
    commonTones: 3,
    target,
    mediant: false,
    cadenceBiased: false,
    tabuBypass: false,
    heldNoLegal: false,
    modeDrifted,
    curvePlanned
  };

  if (state.barsSinceChord >= harmonyBarsFor(rails.energy)) {
    changeChord(state, rails, opts, event);
  } else {
    state.barsSinceChord++;
  }

  // Advance musical time.
  state.barIndex++;
  state.phrasePos = (state.phrasePos + 1) % PHRASE_BARS;
  if (state.phrasePos === 0) state.phraseIndex++;
  return event;
}

interface ScoredCandidate {
  triad: TriadSpec;
  id: string;
  mediant: boolean;
  lead: ReturnType<typeof leadVoices>;
  diff: number;
}

function changeChord(
  state: HarmonyBrainState,
  rails: HarmonyRails,
  opts: AdvanceOptions | undefined,
  event: HarmonyBarEvent
): void {
  const seed = state.planetSeed;
  const bar = state.barIndex;
  const currentId = triadId(state.chord);
  // The band GLIDES toward its target (register weather, §8.3): slew-limited
  // per chord change, and widened to contain the previous voicing so a moving
  // band can never strand the voicing outside the §6.4 legality window.
  const targetCenter =
    REGISTER_BAND_CENTER_BASE +
    Math.round(rails.warmth * REGISTER_WARMTH_LIFT_SEMIS) +
    Math.round(rails.registerShift ?? 0);
  const bandCenter =
    state.bandCenter +
    Math.max(-BAND_SLEW_SEMIS, Math.min(BAND_SLEW_SEMIS, targetCenter - state.bandCenter));
  const bandLo = Math.min(bandCenter - REGISTER_BAND_HALF_WIDTH, ...state.voicing.uppers);
  const bandHi = Math.max(bandCenter + REGISTER_BAND_HALF_WIDTH, ...state.voicing.uppers);

  // 1. Candidate pool: the mode's degree set, plus rationed chromatic mediants.
  const pool = new Map<string, { triad: TriadSpec; mediant: boolean }>();
  for (const degree of MODE_DEGREE_SETS[state.mode]) {
    const triad = degreeTriad(state.tonicPc, degree);
    const id = triadId(triad);
    if (id !== currentId) pool.set(id, { triad, mediant: false });
  }
  const mediantPermitted =
    (state.phrasePos === 0 || opts?.hitScheduled === true) && !state.mediantUsedThisPhrase;
  if (mediantPermitted) {
    const p = Math.min(
      MEDIANT_P_MAX,
      MEDIANT_BASE_P * (rails.golden > GOLDEN_WINDOW_MIN ? GOLDEN_MEDIANT_MULT : 1)
    );
    if (musicUnit(seed, SALT_MEDIANT, bar) < p) {
      for (const triad of chromaticMediants(state.chord)) {
        const id = triadId(triad);
        if (id !== currentId && !pool.has(id)) pool.set(id, { triad, mediant: true });
      }
    }
  }

  // 2. Legality filter (voice-leading law) — computed on the optimal voicing.
  const legal: Array<{ triad: TriadSpec; id: string; mediant: boolean; lead: ReturnType<typeof leadVoices> }> = [];
  for (const { triad, mediant } of pool.values()) {
    const lead = leadVoicesRange(state.voicing, triad, bandLo, bandHi);
    if (isLegalTransition(lead, rails.tension)) legal.push({ triad, id: triadId(triad), mediant, lead });
  }
  if (legal.length === 0) {
    event.heldNoLegal = true; // hold the chord; retry next bar
    return;
  }

  // 3. Phrase-final bias: bars 7–8 lean home unless the curve says RISE (§6.5).
  let set = legal;
  if (
    state.phrasePos >= CADENCE_START_POS &&
    state.curveShape !== 'RISE' &&
    musicUnit(seed, SALT_CADENCE, bar) < CADENCE_BIAS_P
  ) {
    const cadenceRoots = MODE_CADENCE_ROOTS[state.mode];
    const cad = legal.filter(
      (c) => !c.mediant && cadenceRoots.includes(pcMod(c.triad.rootPc - state.tonicPc))
    );
    if (cad.length > 0) {
      set = cad;
      event.cadenceBiased = true;
    }
  }

  // 4. No-repeat window: forbid the last CHORD_TABU distinct chords (tonic
  //    exempt under cadence bias). Never at the cost of a wrong note: if the
  //    tabu empties the legal set, bypass it.
  const tonicId = triadId(modeTonicTriad(state.tonicPc, state.mode));
  const recent = state.recentChordIds.slice(-CHORD_TABU);
  const fresh = set.filter(
    (c) => !recent.includes(c.id) || (event.cadenceBiased && c.id === tonicId)
  );
  if (fresh.length > 0) {
    set = fresh;
  } else {
    event.tabuBypass = true;
  }

  // 5. Color intent — one draw per change, applied quality-appropriately.
  let intent = 'none';
  if (musicUnit(seed, SALT_COLOR_DRAW, bar) < rails.chroma * COLOR_P_SCALE) {
    const intents = COLOR_INTENT_WEIGHTS.filter(
      ([name]) => (name !== 'flat9' && name !== 'sharp11') || rails.tension > TENSION_COLOR_GATE
    );
    intent = seededPickWeighted(intents, musicUnit(seed, SALT_COLOR_INTENT, bar));
  }

  // 6. Score against the scheduled curve: argmin |T − target|, seeded tie-break.
  const scored: ScoredCandidate[] = set.map((c) => {
    const dressed = colorAllowed(c.triad, state.tonicPc, state.mode) ? intent : 'none';
    const voicingMean = (c.lead.voicing.uppers[0] + c.lead.voicing.uppers[1] + c.lead.voicing.uppers[2]) / 3;
    const t = chordTension(c.triad, {
      tonicPc: state.tonicPc,
      mode: state.mode,
      colorDissonance: colorIntentDissonance(dressed),
      voicingMean
    });
    return { ...c, diff: Math.abs(t - event.target) };
  });
  let bestDiff = Infinity;
  for (const s of scored) bestDiff = Math.min(bestDiff, s.diff);
  const contenders = scored.filter((s) => s.diff <= bestDiff + CHORD_TIE_EPSILON);
  let chosen = contenders[0];
  let bestRank = -1;
  for (const c of contenders) {
    const rank = seededUnit(seed, musicSalt(SALT_CHORD_TIEBREAK, bar) ^ Math.imul(triadIdx(c.triad) + 1, 668265263));
    if (rank > bestRank) {
      bestRank = rank;
      chosen = c;
    }
  }

  // 7. Commit.
  const dressed = colorAllowed(chosen.triad, state.tonicPc, state.mode) ? intent : 'none';
  state.chord = {
    rootPc: chosen.triad.rootPc,
    quality: chosen.triad.quality,
    colorIntervals: realizeColor(dressed, chosen.triad.quality)
  };
  state.voicing = chosen.lead.voicing;
  state.bandCenter = bandCenter;
  state.barsSinceChord = 1;
  if (chosen.mediant) state.mediantUsedThisPhrase = true;
  if (state.recentChordIds[state.recentChordIds.length - 1] !== chosen.id) {
    state.recentChordIds.push(chosen.id);
    while (state.recentChordIds.length > CHORD_TABU) state.recentChordIds.shift();
  }

  event.changed = true;
  event.chordId = chosen.id;
  event.chord = state.chord;
  event.displacement = chosen.lead.displacement;
  event.maxVoice = chosen.lead.maxVoice;
  event.commonTones = chosen.lead.commonTones;
  event.mediant = chosen.mediant;
}

// --- Publishing (the ONE harmonic truth) --------------------------------------------------------

/** The chord as musicPrimitives tones: [bass, uppers…, colors…], semitones above A1. */
export function harmonyPublishTones(state: HarmonyBrainState): { root: number; tones: number[] } {
  const tones = [state.voicing.bass, ...[...state.voicing.uppers].sort((a, b) => a - b)];
  for (const interval of state.chord.colorIntervals) {
    const pc = pcMod(state.chord.rootPc + interval);
    tones.push(
      nearestPitchInBand(
        pc,
        state.bandCenter + 4,
        state.bandCenter - REGISTER_BAND_HALF_WIDTH,
        state.bandCenter + REGISTER_BAND_HALF_WIDTH
      )
    );
  }
  return { root: state.voicing.bass, tones };
}

/** Publish the harmonic center — every pitched voice derives from this. */
export function publishHarmony(state: HarmonyBrainState): { root: number; tones: number[] } {
  const published = harmonyPublishTones(state);
  setMusicChord(published.root, published.tones);
  return published;
}

// --- Re-keying (P3 §8.4: the approach modulation walk) ------------------------------------------

/**
 * Retarget tonic/mode WITHOUT snapping the current chord — the walk gravitates
 * to the new tonic through the ordinary legality machinery (cadence bias,
 * degree pool). Waypoints of the approach modulation land here one at a time;
 * `asHome` marks the final arrival (the destination key becomes home).
 * Mode transit through any chain mode is permitted during modulation — the
 * §8.4 budget counts those accidental steps.
 */
export function retargetHarmonyKey(
  state: HarmonyBrainState,
  tonicPc: number,
  mode: ModeName,
  asHome = false
): void {
  state.tonicPc = pcMod(tonicPc);
  state.mode = mode;
  if (asHome) state.homeMode = mode;
  // The external key move counts as this phrase's drift — no double weather.
  state.phrasesSinceModeDrift = 0;
}

/**
 * The LANDING PIVOT (§8.4 fallback): ONE chromatic mediant of the current
 * chord, chosen nearest (Tonnetz) to the destination tonic triad, legality
 * still enforced — then the key retargets home and single-accidental drift
 * settles the rest. Consumes the phrase's mediant ration. When no mediant is
 * legal, the key still retargets (arrival without the awe-chord).
 */
export function forceLandingPivot(
  state: HarmonyBrainState,
  destTonicPc: number,
  destMode: ModeName
): { pivoted: boolean; chordId: string } {
  const destTriad = modeTonicTriad(pcMod(destTonicPc), destMode);
  let best: { triad: TriadSpec; lead: ReturnType<typeof leadVoices>; dist: number } | null = null;
  for (const triad of chromaticMediants(state.chord)) {
    const lead = leadVoices(state.voicing, triad, state.bandCenter, REGISTER_BAND_HALF_WIDTH);
    // The pivot is an awe gesture — use the relaxed (high-tension) legality.
    if (!isLegalTransition(lead, 1)) continue;
    const dist = tonnetzDistance(triad, destTriad);
    if (best === null || dist < best.dist) best = { triad, lead, dist };
  }
  if (best) {
    state.chord = { rootPc: best.triad.rootPc, quality: best.triad.quality, colorIntervals: [] };
    state.voicing = best.lead.voicing;
    state.barsSinceChord = 1;
    state.mediantUsedThisPhrase = true;
    const id = triadId(best.triad);
    if (state.recentChordIds[state.recentChordIds.length - 1] !== id) {
      state.recentChordIds.push(id);
      while (state.recentChordIds.length > CHORD_TABU) state.recentChordIds.shift();
    }
  }
  retargetHarmonyKey(state, destTonicPc, destMode, true);
  return { pivoted: best !== null, chordId: triadId(state.chord) };
}
