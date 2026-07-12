import type { ArchetypeId } from '../../game/data/planetArchetypes.ts';
import { buildWindProfile, type WindProfile } from '../../utils/windProfile.ts';
import { fnv1a32, seededUnit } from '../../utils/worldCoordinates.ts';
import {
  createBedConductor,
  planBedBar,
  type BedBarPlan,
  type BedConductorState
} from './bedConductor.ts';
import { neutralBedSignals, type BedSignals } from './worldSignals.ts';
import { barDurationSec } from './transport.ts';
import { MODE_BRIGHTNESS_CHAIN, type ModeName } from './theory.ts';
import {
  ERA_ALIVE,
  ERA_COLOR,
  ERA_MATERIAL,
  GESTURE_TABU,
  MEDIANT_RATION,
  MODE_DRIFT_MIN_PHRASES,
  PARADOX_MEDIANT_RATION,
  PHRASE_BARS,
  PHRASE_TABU,
  SIDECHAIN_DEPTH,
  VL_COMMON_TONE_TENSION,
  VL_TOTAL_MAX,
  VL_VOICE_MAX
} from './tuning.ts';

// --- The soak harness (P4) — pure core -----------------------------------------------------------
//
// Everything the §10.4 soak must PROVE lives here as pure, seeded functions:
// deterministic world-signal scripts (scenarios), a per-bar audit collector
// that snapshots the harmony brain around every planBedBar call, and the
// audit battery — zero phrase-tabu violations, mediant ration ≤ 1/phrase,
// mode drift ≤ 1 accidental, independent legality recompute of every logged
// chord transition, finiteness, and no harmony deadlock. The same collector
// and audits run in three places: the vitest smoke, the vite-node CLI soak,
// and the in-browser OfflineAudioContext soak (audio/soak/offlineRender.ts).

// --- Harness constants (assertion thresholds and scenario shapes — NOT musical grammar) -----------

/**
 * Longest tolerated streak of failed chord-change attempts (deadlock guard).
 * Approach re-keys legitimately hold for a few bars while the walk gravitates
 * to the destination key (§8.4); a true deadlock (the pre-P3 band-jump bug)
 * is unbounded. 1.5 phrases is the line between "gravitating" and "stuck".
 */
export const SOAK_MAX_CONSECUTIVE_HELD = 12;
/** Samples at/above this absolute value count as clipped in audio soaks. */
export const SOAK_CLIP_LIMIT = 1.0;
/** Day/night period of the fullSoak scenario, seconds. */
export const SOAK_DAY_PERIOD_S = 600;
/** Golden window: daylight band center and half width (dawn/dusk shoulder). */
export const SOAK_GOLDEN_CENTER = 0.32;
export const SOAK_GOLDEN_HALF_WIDTH = 0.14;
/** Rail sweeps of the fullSoak scenario (seeded-phase sines, co-prime-ish periods). */
export const SOAK_ENERGY_BASE = 0.34;
export const SOAK_ENERGY_SWING = 0.34;
export const SOAK_ENERGY_PERIOD_S = 541;
export const SOAK_TENSION_BASE = 0.28;
export const SOAK_TENSION_SWING = 0.3;
export const SOAK_TENSION_PERIOD_S = 463;
/** fullSoak event segments, as fractions of the run duration. */
export const SOAK_WARP_FRAC: readonly [number, number] = [0.24, 0.27];
export const SOAK_SUBMERGE_FRAC: readonly [number, number] = [0.44, 0.5];
export const SOAK_APPROACH_FRAC: readonly [number, number] = [0.58, 0.7];
/** Region salt steps every this many seconds (simulated travel turns the rhythm). */
export const SOAK_REGION_STEP_S = 45;
/** World-signal event edges use a real ramp, never a rectangular gain/control step. */
export const SOAK_SIGNAL_EDGE_RAMP_S = 12;
/** Simulated travel through the shared visual/audio gust field. */
export const SOAK_WIND_TRAVEL_SPEED = 0.35;
export const SOAK_WIND_TRAVEL_RADIUS = 24;
export const SOAK_WIND_TRAVEL_PERIOD_S = 173;
/** Largest legal normalized bar-to-bar step among continuous signal controls. */
export const SOAK_SIGNAL_MAX_STEP = 0.7;

/** Audition/CLI reference planets (picked for maximal identity contrast). */
export const SOAK_HOME_SEED = 5;
export const SOAK_HOME_ARCHETYPE: ArchetypeId = 'verdant'; // D# dorian, 78 bpm, 4/4, CELL_GALLOP
export const SOAK_CONTRAST_SEED_A = 8;
export const SOAK_CONTRAST_ARCHETYPE_A: ArchetypeId = 'frozen'; // F lydian, 66 bpm, 6/8, CELL_HALF
export const SOAK_CONTRAST_SEED_B = 10;
export const SOAK_CONTRAST_ARCHETYPE_B: ArchetypeId = 'volcanic'; // G# aeolian, 83 bpm, 4/4, CELL_OFFBEAT

const SALT_SOAK_ENERGY = fnv1a32('soak:energy-phase');
const SALT_SOAK_TENSION = fnv1a32('soak:tension-phase');
const SALT_SOAK_REGION = fnv1a32('soak:region');
const SALT_SOAK_DEST = fnv1a32('soak:destination');

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const TAU = Math.PI * 2;

// --- Scenarios: deterministic world-signal scripts -------------------------------------------------

export type SoakScenarioName = 'sandboxDay' | 'sandboxNight' | 'eraLadder' | 'fullSoak';
export const SOAK_SCENARIO_NAMES: readonly SoakScenarioName[] = [
  'sandboxDay',
  'sandboxNight',
  'eraLadder',
  'fullSoak'
];

export type SoakScript = (tSec: number) => BedSignals;

/** AudioDirector's warmth/wonder formulas, mirrored so scenarios stay live-faithful. */
function railsFromDaylight(s: BedSignals, daylight: number): void {
  s.daylight = daylight;
  s.warmth = daylight * 0.85 + 0.1;
  s.wonder = clamp01((1 - daylight) * 0.55 + s.submergence * 0.35 + 0.15);
  s.golden = clamp01(1 - Math.abs(daylight - SOAK_GOLDEN_CENTER) / SOAK_GOLDEN_HALF_WIDTH);
}

function windAt(s: BedSignals, wind: WindProfile, tSec: number): void {
  s.windDirectionX = wind.direction.x;
  s.windDirectionY = wind.direction.y;
  s.windStrength = wind.strength;
  s.windGustStrength = wind.gustStrength;
  s.windGustScale = wind.gustScale;
  s.windGustSpeed = wind.gustSpeed;
  s.windTurbulence = wind.turbulence;
  s.windVeer = wind.veer;
  s.windOffsetX = wind.offset.x;
  s.windOffsetY = wind.offset.y;
  s.playerX = tSec * SOAK_WIND_TRAVEL_SPEED;
  s.playerZ = SOAK_WIND_TRAVEL_RADIUS * Math.sin(TAU * tSec / SOAK_WIND_TRAVEL_PERIOD_S);
}

function regionAt(s: BedSignals, planetSeed: number, tSec: number): void {
  s.regionUnit = seededUnit(planetSeed, SALT_SOAK_REGION ^ Math.floor(tSec / SOAK_REGION_STEP_S));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const u = clamp01((value - edge0) / Math.max(Number.EPSILON, edge1 - edge0));
  return u * u * (3 - 2 * u);
}

/** Smooth 0→1→0 envelope for a scenario segment in fractional run time. */
function segmentEnvelope(
  tSec: number,
  durationSec: number,
  range: readonly [number, number]
): number {
  const start = range[0] * durationSec;
  const end = range[1] * durationSec;
  const ramp = Math.min(SOAK_SIGNAL_EDGE_RAMP_S, Math.max(0, (end - start) / 2));
  if (ramp <= Number.EPSILON) return tSec >= start && tSec < end ? 1 : 0;
  const enter = smoothstep(start, start + ramp, tSec);
  const exit = 1 - smoothstep(end - ramp, end, tSec);
  return Math.min(enter, exit);
}

/** The era rung the §8.5 ladder names for a continuous era value (bare→alive). */
export function stageForEra(era: number): BedSignals['stage'] {
  if (era < ERA_COLOR) return 'bare';
  if (era < ERA_MATERIAL) return 'color';
  if (era < ERA_ALIVE) return 'material';
  return 'alive';
}

/**
 * Build a scenario script. Every value is a pure function of (name,
 * planetSeed, durationSec, tSec) — reproducible by construction.
 */
export function makeSoakScript(
  name: SoakScenarioName,
  planetSeed: number,
  durationSec: number
): SoakScript {
  const wind = buildWindProfile(planetSeed);
  return (tSec: number): BedSignals => {
    const s = neutralBedSignals();
    s.timeSec = tSec;
    s.scene = 'surface';
    windAt(s, wind, tSec);
    regionAt(s, planetSeed, tSec);

    switch (name) {
      case 'sandboxDay': {
        railsFromDaylight(s, 0.82);
        s.tension = 0.15;
        s.energy = 0.3;
        break;
      }
      case 'sandboxNight': {
        railsFromDaylight(s, 0.04);
        s.tension = 0.12;
        s.energy = 0.22;
        s.crystalline = 0.55;
        break;
      }
      case 'eraLadder': {
        // The awakening ramp: reality effects rise together; era follows
        // AudioDirector's blend; the stage steps through the rungs.
        const u = clamp01(tSec / Math.max(1, durationSec));
        s.chroma = u;
        s.detail = u;
        s.organic = u;
        s.atmosphere = 0.2 + 0.6 * u;
        s.era = clamp01(u * 0.35 + u * 0.3 + u * 0.35);
        s.stage = stageForEra(s.era);
        railsFromDaylight(s, 0.7);
        s.tension = 0.2;
        s.energy = 0.35;
        break;
      }
      case 'fullSoak': {
        const frac = tSec / Math.max(1, durationSec);
        const daylight = 0.5 + 0.5 * Math.sin(TAU * (tSec / SOAK_DAY_PERIOD_S - 0.25));
        const submergeEnvelope = segmentEnvelope(tSec, durationSec, SOAK_SUBMERGE_FRAC);
        s.submergence = 0.85 * submergeEnvelope;
        railsFromDaylight(s, daylight);
        const ePhase = seededUnit(planetSeed, SALT_SOAK_ENERGY);
        const tPhase = seededUnit(planetSeed, SALT_SOAK_TENSION);
        s.energy = clamp01(
          SOAK_ENERGY_BASE + SOAK_ENERGY_SWING * Math.sin(TAU * (tSec / SOAK_ENERGY_PERIOD_S + ePhase))
        );
        s.tension = clamp01(
          SOAK_TENSION_BASE + SOAK_TENSION_SWING * Math.sin(TAU * (tSec / SOAK_TENSION_PERIOD_S + tPhase))
        );
        if (frac >= SOAK_WARP_FRAC[0] && frac < SOAK_WARP_FRAC[1]) {
          const warpEnvelope = segmentEnvelope(tSec, durationSec, SOAK_WARP_FRAC);
          s.warpActive = true;
          s.warpProgress = (frac - SOAK_WARP_FRAC[0]) / (SOAK_WARP_FRAC[1] - SOAK_WARP_FRAC[0]);
          s.energy = clamp01(s.energy + 0.4 * warpEnvelope);
          s.tension = clamp01(s.tension + 0.25 * warpEnvelope);
        }
        if (frac >= SOAK_APPROACH_FRAC[0] && frac < SOAK_APPROACH_FRAC[1]) {
          // The approach IS the modulation (§8.4) — then back to the surface,
          // which fires the landing pivot if the walk did not finish.
          s.scene = 'approach';
          s.destinationSeed = ((planetSeed ^ SALT_SOAK_DEST) >>> 0) | 1;
        }
        break;
      }
    }
    return s;
  };
}

// --- The collector: snapshot the harmony brain around every planned bar ----------------------------

export interface SoakNote {
  slot: number;
  durationSlots: number;
  semis: number;
  velocity: number;
}

export interface SoakBarRecord {
  barIndex: number;
  phrasePos: number;
  phraseIndex: number;
  chordId: string;
  changed: boolean;
  mediant: boolean;
  heldNoLegal: boolean;
  commonToneRelaxed: boolean;
  tabuBypass: boolean;
  cadenceBiased: boolean;
  modeDrifted: ModeName | null;
  prevMode: ModeName;
  mode: ModeName;
  tonicPc: number;
  prevUppers: [number, number, number];
  uppers: [number, number, number];
  bass: number;
  bandCenter: number;
  tension: number;
  era: number;
  daylight: number;
  golden: number;
  submergence: number;
  scene: string;
  landingPivot: boolean;
  /** The arrival spent the phrase's awe-chord — counted against the ration. */
  landingPivotMediant: boolean;
  warpExitBoom: boolean;
  /** A stage-transition bloom fired this bar (§8.4 stage row, P5). */
  stageBloom: boolean;
  /** The bar played under the paradox stage (mediant ration widens — §8.5). */
  paradox: boolean;
  arrangement: string;
  melodyChain: string | null;
  melody: SoakNote[];
  ostinato: SoakNote[];
  percussion: number[];
  publishRoot: number;
  publishTones: number[];
  tickHz: number;
  tickPresent: boolean;
  tickPresence: number;
  tickLevel: number;
  sidechainDepth: number;
  subMotifMix: number;
  padBrightness: number;
  textureLean: number;
  eraChip: number;
  eraPadChoir: number;
  eraStereoWidth: number;
  eraReverb: number;
  eraSidechain: number;
  eraPercussion: number;
  eraShimmer: number;
  eraSub: number;
  windGust: number;
  windDrive: number;
  windPan: number;
  windTurbulence: number;
  tempoBpm: number;
}

export interface SoakLog {
  planetSeed: number;
  archetype: string | null;
  scenario: string;
  bars: SoakBarRecord[];
}

export interface SoakCollector {
  onBar(plan: BedBarPlan, signals: BedSignals): void;
  finish(): SoakLog;
}

export function createSoakCollector(
  conductor: BedConductorState,
  scenario: string
): SoakCollector {
  let prevUppers = [...conductor.harmony.voicing.uppers] as [number, number, number];
  let prevMode: ModeName = conductor.harmony.mode;
  const bars: SoakBarRecord[] = [];
  const note = (n: { slot: number; durationSlots: number; semis: number; velocity: number }): SoakNote => ({
    slot: n.slot,
    durationSlots: n.durationSlots,
    semis: n.semis,
    velocity: n.velocity
  });
  return {
    onBar(plan: BedBarPlan, signals: BedSignals): void {
      const h = conductor.harmony;
      const e = plan.harmony;
      bars.push({
        barIndex: e.barIndex,
        phrasePos: e.phrasePos,
        phraseIndex: Math.floor(e.barIndex / PHRASE_BARS),
        chordId: e.chordId,
        changed: e.changed,
        mediant: e.mediant,
        heldNoLegal: e.heldNoLegal,
        commonToneRelaxed: e.commonToneRelaxed,
        tabuBypass: e.tabuBypass,
        cadenceBiased: e.cadenceBiased,
        modeDrifted: e.modeDrifted,
        prevMode,
        mode: h.mode,
        tonicPc: h.tonicPc,
        prevUppers: [...prevUppers] as [number, number, number],
        uppers: [...h.voicing.uppers] as [number, number, number],
        bass: h.voicing.bass,
        bandCenter: h.bandCenter,
        tension: signals.tension,
        era: signals.era,
        daylight: signals.daylight,
        golden: signals.golden,
        submergence: signals.submergence,
        scene: signals.scene,
        landingPivot: plan.landingPivot,
        landingPivotMediant: plan.landingPivotMediant,
        warpExitBoom: plan.warpExitBoom,
        stageBloom: plan.stageBloom,
        paradox: signals.stage === 'paradox',
        arrangement: plan.arrangement,
        melodyChain: plan.melodyChain,
        melody: plan.melody.map(note),
        ostinato: plan.ostinato.map(note),
        percussion: [...plan.percussion],
        publishRoot: plan.publish.root,
        publishTones: [...plan.publish.tones],
        tickHz: plan.tick.hz,
        tickPresent: plan.tick.present,
        tickPresence: plan.tick.presence,
        tickLevel: plan.tick.level,
        sidechainDepth: plan.sidechainDepth,
        subMotifMix: plan.subMotifMix,
        padBrightness: plan.padBrightness,
        textureLean: plan.textureLean,
        eraChip: plan.gates.chip,
        eraPadChoir: plan.gates.padChoir,
        eraStereoWidth: plan.gates.stereoWidth,
        eraReverb: plan.gates.reverb,
        eraSidechain: plan.gates.sidechain,
        eraPercussion: plan.gates.percussion,
        eraShimmer: plan.gates.shimmer,
        eraSub: plan.gates.sub,
        windGust: plan.wind.gust,
        windDrive: plan.wind.drive,
        windPan: plan.wind.pan,
        windTurbulence: plan.wind.turbulence,
        tempoBpm: plan.tempoBpm
      });
      prevUppers = [...h.voicing.uppers] as [number, number, number];
      prevMode = h.mode;
    },
    finish(): SoakLog {
      return {
        planetSeed: conductor.planetSeed,
        archetype: conductor.archetype ?? null,
        scenario,
        bars
      };
    }
  };
}

// --- The audits (§10.4 — measured, not vibes) --------------------------------------------------------

export interface SoakCheck {
  name: string;
  pass: boolean;
  violations: number;
  detail: string;
}

export interface SoakReport {
  pass: boolean;
  checks: SoakCheck[];
  stats: Record<string, number | string>;
}

function finiteDeep(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(finiteDeep);
  if (value !== null && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).every(finiteDeep);
  }
  return true;
}

/**
 * The §7.3 chord context of a statement bar, re-derived INDEPENDENTLY from
 * the log (never trusting the conductor's bookkeeping): chord ids sounded
 * across the previous phrase plus the statement bar's chord, consecutive
 * holds collapsed. Statements land only on phrase boundaries, so the trailing
 * PHRASE_BARS window is exactly the just-completed phrase.
 */
export function statementChordContext(bars: readonly SoakBarRecord[], index: number): string[] {
  const ids: string[] = [];
  for (let i = Math.max(0, index - PHRASE_BARS); i <= index; i++) {
    const id = bars[i].chordId;
    if (ids[ids.length - 1] !== id) ids.push(id);
  }
  return ids;
}

/** Independent rendered-statement identity (mirrors the phraseMemory descriptor). */
export function statementHash(rec: SoakBarRecord, chordIds: readonly string[]): number {
  const rhythm = rec.melody.map((n) => `${n.slot}:${n.durationSlots}:${n.semis}`).join(',');
  return fnv1a32(`${chordIds.join(',')}|${rec.melodyChain}|${rhythm}|${rec.bandCenter}`);
}

const SMOOTH_SIGNAL_CONTROLS = [
  'era',
  'daylight',
  'golden',
  'submergence',
  'subMotifMix',
  'sidechainDepth',
  'padBrightness',
  'textureLean',
  'eraChip',
  'eraPadChoir',
  'eraStereoWidth',
  'eraReverb',
  'eraSidechain',
  'eraPercussion',
  'eraShimmer',
  'eraSub',
  'windDrive',
  'windPan',
  'windTurbulence'
] as const;

type SmoothSignalControl = (typeof SMOOTH_SIGNAL_CONTROLS)[number];

/** Normalize every audited continuous control to 0..1 before derivative checks. */
function normalizedSignalControl(rec: SoakBarRecord, key: SmoothSignalControl): number {
  if (key === 'sidechainDepth') return clamp01(rec.sidechainDepth / SIDECHAIN_DEPTH);
  if (key === 'windPan') return clamp01((rec.windPan + 1) / 2);
  return clamp01(rec[key]);
}

export function auditSoakLog(log: SoakLog): SoakReport {
  const checks: SoakCheck[] = [];
  const bars = log.bars;
  const push = (name: string, violations: number, detail: string): void => {
    checks.push({ name, pass: violations === 0, violations, detail });
  };

  // 1. Finiteness: no NaN/Infinity anywhere in any plan-derived field.
  let nanBars = 0;
  let firstNan = '';
  for (const rec of bars) {
    if (!finiteDeep(rec)) {
      nanBars++;
      if (!firstNan) firstNan = `bar ${rec.barIndex}`;
    }
  }
  push('finite-plans', nanBars, nanBars ? `first at ${firstNan}` : 'every plan field finite');

  // 2. Chord-transition legality (§6.4) — recomputed HERE from the raw
  //    voicings, independently of the voice-leading engine's own numbers.
  //    Landing-pivot bars use the relaxed awe-gesture legality by design and
  //    may stack a pivot + change in one bar; they are audited for bounds only.
  let vlViolations = 0;
  let vlDetail = '';
  let displacementSum = 0;
  let changeCount = 0;
  for (const rec of bars) {
    const disp = [0, 1, 2].map((i) => Math.abs(rec.uppers[i] - rec.prevUppers[i]));
    const total = disp[0] + disp[1] + disp[2];
    const maxVoice = Math.max(...disp);
    const common = disp.filter((d) => d === 0).length;
    const moved = total > 0;
    if (rec.landingPivot) continue;
    if (rec.changed) {
      changeCount++;
      displacementSum += total;
      const overTotal = total > VL_TOTAL_MAX;
      const overVoice = maxVoice > VL_VOICE_MAX;
      // The held-escape hatch (HELD_RELAX_BARS) legally bypasses the
      // common-tone rule — displacement bounds never relax.
      const noCommon = rec.tension < VL_COMMON_TONE_TENSION && common < 1 && !rec.commonToneRelaxed;
      if (overTotal || overVoice || noCommon) {
        vlViolations++;
        if (!vlDetail) {
          vlDetail = `bar ${rec.barIndex} ${rec.chordId}: total=${total} max=${maxVoice} common=${common} tension=${rec.tension.toFixed(2)}`;
        }
      }
    } else if (moved) {
      vlViolations++;
      if (!vlDetail) vlDetail = `bar ${rec.barIndex}: voicing moved without a chord change`;
    }
  }
  push(
    'chord-legality',
    vlViolations,
    vlViolations
      ? vlDetail
      : `${changeCount} transitions, mean displacement ${(changeCount ? displacementSum / changeCount : 0).toFixed(2)} st`
  );

  // 3. Phrase tabu — ZERO violations across the render (§7.3). Rendered
  //    statements are re-hashed independently (chord context re-derived from
  //    the raw per-bar log); a repeat inside the PHRASE_TABU window (or a
  //    gesture repeat inside GESTURE_TABU) fails.
  const statementIndices: number[] = [];
  bars.forEach((r, i) => {
    if (r.melodyChain !== null) statementIndices.push(i);
  });
  const statements = statementIndices.map((i) => bars[i]);
  const hashes = statementIndices.map((i) => statementHash(bars[i], statementChordContext(bars, i)));
  const chains = statements.map((r) => r.melodyChain as string);
  let tabuViolations = 0;
  let gestureViolations = 0;
  let tabuDetail = '';
  for (let i = 0; i < statements.length; i++) {
    const phraseWindow = hashes.slice(Math.max(0, i - PHRASE_TABU), i);
    if (phraseWindow.includes(hashes[i])) {
      tabuViolations++;
      if (!tabuDetail) tabuDetail = `statement at bar ${statements[i].barIndex} repeats inside the window`;
    }
    const gestureWindow = chains.slice(Math.max(0, i - GESTURE_TABU), i);
    if (gestureWindow.includes(chains[i])) {
      gestureViolations++;
      if (!tabuDetail) tabuDetail = `gesture "${chains[i]}" repeats at bar ${statements[i].barIndex}`;
    }
  }
  push(
    'phrase-tabu',
    tabuViolations + gestureViolations,
    tabuViolations + gestureViolations
      ? tabuDetail
      : `${statements.length} statements, ${new Set(hashes).size} distinct`
  );

  // 4. Mediant ration per phrase (§6.3). A landing pivot SPENDS the phrase's
  //    awe-chord (§8.4 fallback) — pivot spends are COUNTED against the
  //    ration, not exempted (the pre-polish audit exempted pivot phrases
  //    entirely); paradox phrases run the widened §8.5 ration.
  const mediantByPhrase = new Map<number, number>();
  const pivotPhrases = new Set<number>();
  const paradoxPhrases = new Set<number>();
  for (const rec of bars) {
    if (rec.landingPivot) pivotPhrases.add(rec.phraseIndex);
    if (rec.paradox) paradoxPhrases.add(rec.phraseIndex);
    const spend = (rec.mediant ? 1 : 0) + (rec.landingPivotMediant ? 1 : 0);
    if (spend > 0) {
      mediantByPhrase.set(rec.phraseIndex, (mediantByPhrase.get(rec.phraseIndex) ?? 0) + spend);
    }
  }
  let mediantViolations = 0;
  let mediantTotal = 0;
  for (const [phrase, count] of mediantByPhrase) {
    mediantTotal += count;
    const ration = paradoxPhrases.has(phrase) ? PARADOX_MEDIANT_RATION : MEDIANT_RATION;
    if (count > ration) mediantViolations++;
  }
  push(
    'mediant-ration',
    mediantViolations,
    `${mediantTotal} mediants (incl. pivot awe-chords) over ${Math.ceil(bars.length / PHRASE_BARS)} phrases (ration ${MEDIANT_RATION}/phrase; paradox ${PARADOX_MEDIANT_RATION})`
  );

  // 5. Mode drift: single accidental per step, spaced ≥ MODE_DRIFT_MIN_PHRASES
  //    (§6.2). Key retargets are only legal inside the approach walk or at the
  //    landing pivot, and reset the drift spacing like the engine does.
  let driftViolations = 0;
  let driftDetail = '';
  let driftCount = 0;
  let lastDriftPhrase: number | null = null;
  for (const rec of bars) {
    if (rec.modeDrifted) {
      driftCount++;
      // Compare against the drift STEP itself — an approach retarget may move
      // the mode again later in the same bar (waypoints land on chord changes).
      const from = MODE_BRIGHTNESS_CHAIN.indexOf(rec.prevMode);
      const to = MODE_BRIGHTNESS_CHAIN.indexOf(rec.modeDrifted);
      const retargetSameBar = rec.scene === 'approach' || rec.landingPivot;
      if (from < 0 || to < 0 || Math.abs(to - from) !== 1 || (!retargetSameBar && rec.mode !== rec.modeDrifted)) {
        driftViolations++;
        if (!driftDetail) driftDetail = `bar ${rec.barIndex}: ${rec.prevMode} → ${rec.modeDrifted} is not one accidental`;
      }
      if (lastDriftPhrase !== null && rec.phraseIndex - lastDriftPhrase < MODE_DRIFT_MIN_PHRASES) {
        driftViolations++;
        if (!driftDetail) {
          driftDetail = `bar ${rec.barIndex}: drift after ${rec.phraseIndex - lastDriftPhrase} phrases (< ${MODE_DRIFT_MIN_PHRASES})`;
        }
      }
      lastDriftPhrase = rec.phraseIndex;
    } else if (rec.mode !== rec.prevMode) {
      const retargetLegal = rec.scene === 'approach' || rec.landingPivot;
      if (!retargetLegal) {
        driftViolations++;
        if (!driftDetail) driftDetail = `bar ${rec.barIndex}: unexplained mode change ${rec.prevMode} → ${rec.mode}`;
      }
      lastDriftPhrase = rec.phraseIndex; // retarget resets the spacing clock
    }
  }
  push('mode-drift', driftViolations, driftViolations ? driftDetail : `${driftCount} drift steps, all single-accidental`);

  // 6. Signal smoothness (the symphony law): continuous world-driven audible
  //    controls may travel, but may never jump rail-to-rail in one planned bar.
  //    Discrete musical events (notes, hits, arrangement names) are deliberately
  //    absent: their rim envelopes/crossfades have a separate rendered audit.
  let signalStepViolations = 0;
  let worstSignalStep = 0;
  let signalStepDetail = '';
  for (let i = 1; i < bars.length; i++) {
    for (const key of SMOOTH_SIGNAL_CONTROLS) {
      const previous = normalizedSignalControl(bars[i - 1], key);
      const next = normalizedSignalControl(bars[i], key);
      const delta = Math.abs(next - previous);
      if (delta > worstSignalStep) worstSignalStep = delta;
      if (delta > SOAK_SIGNAL_MAX_STEP) {
        signalStepViolations++;
        if (!signalStepDetail) {
          signalStepDetail = `bar ${bars[i].barIndex} ${key} ${previous.toFixed(3)}→${next.toFixed(3)} (Δ${delta.toFixed(3)}, limit ${SOAK_SIGNAL_MAX_STEP})`;
        }
      }
    }
  }
  push(
    'signal-smoothness',
    signalStepViolations,
    signalStepViolations
      ? signalStepDetail
      : `worst normalized bar step ${worstSignalStep.toFixed(3)} (limit ${SOAK_SIGNAL_MAX_STEP})`
  );

  // 7. No harmony deadlock: the longest streak of failed change attempts
  //    (heldNoLegal among bars that attempted a change) stays short.
  let heldStreak = 0;
  let worstStreak = 0;
  let heldTotal = 0;
  for (const rec of bars) {
    if (rec.heldNoLegal) {
      heldTotal++;
      heldStreak++;
      worstStreak = Math.max(worstStreak, heldStreak);
    } else if (rec.changed) {
      heldStreak = 0;
    }
  }
  push(
    'no-deadlock',
    worstStreak > SOAK_MAX_CONSECUTIVE_HELD ? 1 : 0,
    `heldNoLegal ${heldTotal} bars, worst streak ${worstStreak} (limit ${SOAK_MAX_CONSECUTIVE_HELD})`
  );

  // Stats (informational — novelty and occupancy, for the report).
  const chordIds = new Set(bars.map((r) => r.chordId));
  const barHashes = new Set(
    bars.map((r) =>
      fnv1a32(
        `${r.chordId}|${r.arrangement}|${r.melodyChain}|${r.ostinato.map((n) => n.slot + ':' + n.semis).join(',')}|${r.percussion.join(',')}`
      )
    )
  );
  const modeHist: Record<string, number> = {};
  for (const rec of bars) modeHist[rec.mode] = (modeHist[rec.mode] ?? 0) + 1;
  const arrangeHist: Record<string, number> = {};
  for (const rec of bars) arrangeHist[rec.arrangement] = (arrangeHist[rec.arrangement] ?? 0) + 1;
  const stats: Record<string, number | string> = {
    bars: bars.length,
    phrases: Math.ceil(bars.length / PHRASE_BARS),
    chordChanges: changeCount,
    distinctChords: chordIds.size,
    mediants: mediantTotal,
    landingPivots: pivotPhrases.size,
    stageBlooms: bars.filter((r) => r.stageBloom).length,
    modeDrifts: driftCount,
    melodyStatements: statements.length,
    distinctStatements: new Set(hashes).size,
    barNovelty: bars.length ? Number((barHashes.size / bars.length).toFixed(3)) : 1,
    tabuBypasses: bars.filter((r) => r.tabuBypass).length,
    commonToneRelaxes: bars.filter((r) => r.commonToneRelaxed).length,
    worstSignalStep: Number(worstSignalStep.toFixed(3)),
    modes: Object.entries(modeHist)
      .map(([m, n]) => `${m}:${n}`)
      .join(' '),
    arrangement: Object.entries(arrangeHist)
      .map(([a, n]) => `${a}:${n}`)
      .join(' ')
  };

  return { pass: checks.every((c) => c.pass), checks, stats };
}

// --- The pure runner (no WebAudio — 30 musical minutes in milliseconds) ------------------------------

export interface PureSoakOptions {
  planetSeed: number;
  archetype?: ArchetypeId;
  minutes: number;
  scenario: SoakScenarioName;
}

export interface SoakRunResult {
  log: SoakLog;
  report: SoakReport;
}

export function runPureSoak(opts: PureSoakOptions): SoakRunResult {
  const conductor = createBedConductor(opts.planetSeed, { archetype: opts.archetype });
  const collector = createSoakCollector(conductor, opts.scenario);
  const barDur = barDurationSec(conductor.genome.baseTempo, conductor.genome.meter);
  const durationSec = opts.minutes * 60;
  const script = makeSoakScript(opts.scenario, opts.planetSeed, durationSec);
  const totalBars = Math.ceil(durationSec / barDur);
  for (let bar = 0; bar < totalBars; bar++) {
    const signals = script(bar * barDur);
    const plan = planBedBar(conductor, signals);
    collector.onBar(plan, signals);
  }
  const log = collector.finish();
  return { log, report: auditSoakLog(log) };
}

/** Deterministic serialization for replay comparison (same seed ⇒ same string). */
export function serializeSoakLog(log: SoakLog): string {
  return JSON.stringify(log.bars);
}

export function soakLogHash(log: SoakLog): number {
  return fnv1a32(serializeSoakLog(log));
}

/** One line per check, CLI-friendly. */
export function formatSoakReport(label: string, report: SoakReport): string {
  const lines = [`=== ${label}: ${report.pass ? 'PASS' : 'FAIL'} ===`];
  for (const c of report.checks) {
    lines.push(`  [${c.pass ? 'PASS' : 'FAIL'}] ${c.name.padEnd(16)} ${c.detail}`);
  }
  for (const [k, v] of Object.entries(report.stats)) {
    lines.push(`  · ${k}: ${v}`);
  }
  return lines.join('\n');
}
