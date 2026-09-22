import type { ArchetypeId } from '../../game/data/planetArchetypes.ts';
import {
  advanceHarmonyBar,
  createHarmonyBrain,
  derivePlanetKey,
  forceLandingPivot,
  harmonyBarsFor,
  harmonyPublishTones,
  retargetHarmonyKey,
  type HarmonyBarEvent,
  type HarmonyBrainState,
  type HarmonyRails
} from './harmonyBrain.ts';
import type { CurveShape } from './tension.ts';
import {
  advanceArrangementPhrase,
  arrangementLevels,
  createArrangement,
  type ArrangementIntent,
  type ArrangementState
} from './arrangement.ts';
import {
  applyOp,
  baseFigure,
  deriveMotifGenome,
  figureRhythmMask,
  opLegal,
  ostinatoCell,
  renderMotif,
  serializeOpChain,
  type MotifFigure,
  type MotifGenome,
  type MotifOp
} from './motif.ts';
import { euclid, rotatePattern, SLOTS_PER_BAR } from './rhythm.ts';
import {
  createPhraseMemory,
  hashBar,
  hashGesture,
  hashPhrase,
  isBarAllowed,
  isPhraseAllowed,
  recordBar,
  recordPhrase,
  type PhraseMemory
} from './phraseMemory.ts';
import {
  buildStartsAt,
  createSectionHistory,
  densityAt,
  liftBeforeBuildAt,
  planSection,
  recordSection,
  registerOffsetAt,
  sectionProgress,
  statementScheduledAt,
  type SectionHistory,
  type SectionPlan
} from './sectionPlanner.ts';
import { liftTarget, pulseBeats, pulseTarget, slewEnvelope, type LiftContext } from './pulse.ts';
import { fnv1a32 } from '../../utils/worldCoordinates.ts';
import { planApproachModulation, type KeySpec, type ModulationDecision } from './approachModulation.ts';
import {
  eraFade,
  resolveEraGates,
  resolveAudioGust,
  resolveMacroDrift,
  resolveOxygenControls,
  resolveWorldClockTick,
  STAGE_RANK,
  type BedSignals,
  type AudioGustControls,
  type EraGates,
  type WorldClockTick
} from './worldSignals.ts';
import { TRIAD_INTERVALS } from './theory.ts';
import type { VoxelRealityStage } from '../../game/systems/realityRenderSystem.ts';
import type { MusicScene } from '../musicDirector.ts';
import {
  musicUnit,
  SALT_MELODY_CHAIN,
  SALT_MELODY_STATE,
  SALT_OST_DROP,
  SALT_VELOCITY
} from './seededMusic.ts';
import {
  APPROACH_EXPECTED_BARS,
  BAR_VARIATION_MAX_TRIES,
  BED_SCENE_POLICY,
  BLOOM_RAIL_DB,
  BLOOM_RAIL_LEAD_DB,
  BLOOM_RAIL_OSTINATO_DB,
  BLOOM_RAIL_PERCUSSION_DB,
  BLOOM_RAIL_SUB_DB,
  DETAIL_DENSITY_FLOOR,
  ERA_ALIVE,
  ERA_MATERIAL,
  FRAGMENT_DEFAULT_NOTES,
  FRAGMENT_MIN_NOTES,
  OST_ORNAMENT_P,
  PERC_FILL_K,
  PERC_PHRASE_ROTATION_SLOTS,
  PHRASE_BARS,
  PULSE_BREATH_SCALE,
  REGISTER_SHIFT_MAX,
  REST_SUB_SWELL,
  REST_SWELL_PEAK_MAX,
  REST_SWELL_PEAK_MIN,
  WITHHELD_LEVEL,
  type RegisterArcName,
  type WithheldLayer,
  LEAD_ANCHOR_OFFSET_SEMIS,
  MELODY_BED_P,
  MELODY_BLOOM_P,
  MELODY_CHAIN_POOL,
  MELODY_EBB_P,
  MELODY_TABU_CANDIDATES,
  OST_ANCHOR_OFFSET_SEMIS,
  OST_CALM_ENERGY,
  OST_DROP_P,
  OST_VELOCITY_FLOOR,
  PAD_BRIGHT_BASE,
  PAD_BRIGHT_PALETTE,
  PAD_BRIGHT_WARMTH,
  PARADOX_MEDIANT_RATION,
  PERC_K_MAX,
  PERC_K_MIN,
  SIDECHAIN_DEPTH,
  SUB_MOTIF_BLEND_END,
  SUB_MOTIF_BLEND_START,
  SUBDIV_DOUBLE_ENERGY,
  SUBMERGE_ENERGY_SCALE,
  type ArrangementStateName,
  type BedLayerLevels,
  type BedScenePolicy
} from './tuning.ts';

// --- The bed conductor (P3) — one pure plan per bar ----------------------------------------------
//
// Composes the harmony brain (P1), the motif/rhythm engines and phrase memory
// (P2), the arrangement machine, the era ladder, the approach modulation, and
// the world-clock tick into ONE per-bar plan. The WebAudio rim (bedEngine)
// only turns plans into scheduled parameter automation — every musical
// decision is made here, seeded, reproducible, and unit-testable.

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const dbToLin = (db: number): number => Math.pow(10, db / 20);
/** Stage 5 musical-time salts (per-bar ornament, per-phrase percussion swing, REST swell peak). */
const SALT_OST_ORNAMENT = fnv1a32('score:ost-ornament');
const SALT_PERC_PHRASE_ROT = fnv1a32('score:perc-phrase-rotation');
const SALT_REST_SWELL = fnv1a32('score:rest-swell');
const smoothstep = (edge0: number, edge1: number, value: number): number => {
  const t = clamp01((value - edge0) / Math.max(Number.EPSILON, edge1 - edge0));
  return t * t * (3 - 2 * t);
};

export interface BedNoteEvent {
  /** Onset slot on the canonical 16-slot bar grid (may exceed 16 for spanning figures). */
  slot: number;
  durationSlots: number;
  /** Semitones above A1. */
  semis: number;
  /** 0..1. */
  velocity: number;
}

interface ApproachRun {
  decision: ModulationDecision;
  destKey: KeySpec;
  waypointIdx: number;
}

export interface BedConductorState {
  planetSeed: number;
  archetype?: ArchetypeId;
  /** Palette luminance 0..1 (timbre brightness default, §8.4). */
  paletteBrightness: number;
  genome: MotifGenome;
  harmony: HarmonyBrainState;
  memory: PhraseMemory;
  arrangement: ArrangementState;
  prevScene: MusicScene | null;
  /**
   * Stage baseline for the §8.4 stage-transition event (null until the first
   * plan adopts the current stage silently — a fresh conductor never blooms).
   * The rim keeps this current while a story mood leads, so awakenings the
   * STORY scored never re-fire as deferred bed blooms on resume.
   */
  prevStage: VoxelRealityStage | null;
  warpWasActive: boolean;
  pendingForceBuild: boolean;
  pendingForceEbb: boolean;
  pendingWarpExitBoom: boolean;
  /** An upward stage transition fired: schedule a grid bloom this bar (§8.4). */
  pendingStageBloom: boolean;
  /** Reaching `alive`+ also promises a mediant on the next phrase boundary. */
  pendingStageMediant: boolean;
  approach: ApproachRun | null;
  /**
   * Chord ids sounded across the CURRENT phrase, in order, consecutive holds
   * collapsed (§7.3). At each phrase boundary the completed list becomes the
   * statement fingerprint's harmonic context, then restarts.
   */
  phraseChordIds: string[];
  // --- Stage 5 long form -----------------------------------------------------------------------
  /** The section in flight (null below material / at bare: the chip eras loop by authenticity). */
  section: SectionPlan | null;
  sectionHistory: SectionHistory;
  /** A story mood handed authority back: the next section carries no bloom budget (contract [16]). */
  pendingHandBack: boolean;
  /** The section's withheld layer has been paid back (the bloom entered). */
  withheldSpent: boolean;
  /** The run's first statement chain — the recapitulation material. */
  firstStatementChain: string | null;
  /** Previous bar's slewed BLOOM-rail lift and pulse level (the symphony law is stateful). */
  liftLevel: number;
  pulseLevel: number;
  /** Whole-bar tabu bypasses so far (audited against BAR_TABU_BYPASS_BUDGET in the soak). */
  barTabuBypasses: number;
}

/** The pulse plan for one bar (the sidechain source — bedEngine schedules it on the felt beats). */
export interface BedPulsePlan {
  /** 0..1 after the era sidechain gate and the bar slew; 0 outside BUILD/BLOOM and their release. */
  level: number;
  /** Body (pitch-drop sine) share, 0..1: the alive gate (contract [16]: click + tail alone at material). */
  body: number;
  /** Felt beats carrying an onset this bar. */
  beats: number[];
}

export interface BedBarPlan {
  barIndex: number;
  /** Phrase position of this bar, 0-based. */
  phrasePos: number;
  harmony: HarmonyBarEvent;
  /** Harmonic center to publish when the bed leads: [root, tones]. */
  publish: { root: number; tones: number[] };
  arrangement: ArrangementStateName;
  levels: BedLayerLevels;
  gates: EraGates;
  policy: BedScenePolicy;
  ostinato: BedNoteEvent[];
  /** Full melody statement starting on this bar (empty most bars — C418 law). */
  melody: BedNoteEvent[];
  /** Serialized operator chain of the statement (diagnostics / soak logging). */
  melodyChain: string | null;
  /**
   * The statement's §7.3 fingerprint context: chord ids sounded across the
   * just-completed phrase plus the chord under the statement's first bar
   * (the rest of the new phrase is undrawn at statement time). Null when no
   * statement was recorded this bar.
   */
  melodyChordIds: string[] | null;
  /** Percussion onset slots, canonical 16 grid. */
  percussion: number[];
  tick: WorldClockTick;
  sidechainDepth: number;
  /** Continuous ostinato → tuned-sub crossfade (0 dry land .. 1 underwater). */
  subMotifMix: number;
  /** Same moving gust cell as the vegetation, resolved to persistent-audio controls. */
  wind: AudioGustControls;
  /** BUILD phrase: the riser targets the next phrase boundary, exactly. */
  buildPhrase: boolean;
  /** First bar of a BLOOM (mediant permitted; the widest gesture). */
  bloomEntered: boolean;
  /** Warp exit — the rim schedules a grid boom. */
  warpExitBoom: boolean;
  /** An approach arrival fired this bar (key retargeted home, §8.4). */
  landingPivot: boolean;
  /** The arrival actually spent the phrase's awe-chord (mediant ration). */
  landingPivotMediant: boolean;
  /** A stage transition landed: the rim schedules a grid bloom (§8.4 stage row). */
  stageBloom: boolean;
  /** The `alive` awakening's promised mediant fired on this bar's change. */
  stageMediant: boolean;
  /** Bare monophony (§8.5): the pulse drone yields while the chip arp speaks. */
  chipMono: boolean;
  /** Pad filter brightness 0..1. */
  padBrightness: number;
  /** Texture reweight 0..1 (0 wash-leaning, 1 shimmer-leaning). */
  textureLean: number;
  tempoBpm: number;
  // --- Stage 5 long form -----------------------------------------------------------------------
  /** Section index and phrase offset inside it (−1 when no section is in flight). */
  sectionIndex: number;
  phraseInSection: number;
  /** A new section was planned on this bar. */
  sectionStarted: boolean;
  /** The planner scheduled a statement on this phrase (statements no longer fall where a die says). */
  statementScheduled: boolean;
  registerArc: RegisterArcName | null;
  withheldLayer: WithheldLayer | null;
  /** The withheld layer is being withheld on this bar (paid back at the bloom). */
  withheldActive: boolean;
  bloomBudget: 0 | 1;
  /** The BUILD/BLOOM in flight was forced (warp/launch) rather than planned. */
  forcedBuild: boolean;
  /** Bars from this bar's start to the planned bloom boundary while in BUILD (riser target), else null. */
  buildBarsToBloom: number | null;
  /** BLOOM-rail lift envelope, 0..1 (already applied to `levels`; the rim reads it for diagnostics). */
  bloomLift: number;
  pulse: BedPulsePlan;
  /** Whole-bar fingerprint (phraseMemory.hashBar) and its tabu outcome. */
  barHash: number;
  barTabuBypass: boolean;
  barVariationOps: number;
}

export interface CreateBedOptions {
  archetype?: ArchetypeId;
  /** Palette luminance 0..1 (defaults to neutral 0.5). */
  paletteBrightness?: number;
}

export function createBedConductor(planetSeed: number, opts?: CreateBedOptions): BedConductorState {
  return {
    planetSeed,
    archetype: opts?.archetype,
    paletteBrightness: opts?.paletteBrightness ?? 0.5,
    genome: deriveMotifGenome(planetSeed, opts?.archetype),
    harmony: createHarmonyBrain(planetSeed, { archetype: opts?.archetype }),
    memory: createPhraseMemory(),
    arrangement: createArrangement(),
    prevScene: null,
    prevStage: null,
    warpWasActive: false,
    pendingForceBuild: false,
    pendingForceEbb: false,
    pendingWarpExitBoom: false,
    pendingStageBloom: false,
    pendingStageMediant: false,
    approach: null,
    phraseChordIds: [],
    section: null,
    sectionHistory: createSectionHistory(),
    pendingHandBack: false,
    withheldSpent: false,
    firstStatementChain: null,
    liftLevel: 0,
    pulseLevel: 0,
    barTabuBypasses: 0
  };
}

/** The rim calls this when a story mood hands authority back (contract [16]). */
export function noteStoryHandBack(state: BedConductorState): void {
  state.pendingHandBack = true;
}

// --- Scene and warp edges --------------------------------------------------------------------------

interface EdgeEvents {
  /** An approach ended this bar: the key retargeted home (§8.4 arrival). */
  landingPivot: boolean;
  /** The landing pivot actually spent the phrase's awe-chord (mediant ration). */
  landingPivotMediant: boolean;
}

function handleEdges(state: BedConductorState, s: BedSignals, effectiveEnergy: number): EdgeEvents {
  let landingPivot = false;
  let landingPivotMediant = false;

  // Stage transitions are EVENTS (§8.4 stage row): an upward rung schedules a
  // grid bloom, and reaching `alive`+ promises a mediant on the next phrase
  // boundary. Under story authority the story's own hits score the awakening
  // (frozen contract) — the baseline just follows.
  if (state.prevStage === null) {
    state.prevStage = s.stage;
  } else if (s.stage !== state.prevStage) {
    const rose = STAGE_RANK[s.stage] > STAGE_RANK[state.prevStage];
    state.prevStage = s.stage;
    if (rose && !s.storyLeads) {
      state.pendingStageBloom = true;
      if (STAGE_RANK[s.stage] >= STAGE_RANK.alive) state.pendingStageMediant = true;
    }
  }

  // Warp edges: BUILD on entry, EBB + boom on exit (§8.4).
  if (s.warpActive && !state.warpWasActive) state.pendingForceBuild = true;
  if (!s.warpActive && state.warpWasActive) {
    state.pendingForceEbb = true;
    state.pendingWarpExitBoom = true;
  }
  state.warpWasActive = s.warpActive;

  if (s.scene !== state.prevScene) {
    // Launch: the authored BUILD→BLOOM curve.
    if (s.scene === 'launch') state.pendingForceBuild = true;

    // Leaving approach: arrive. An unfinished walk (early landing) or a
    // planned landing pivot spends the one awe-chord now (§8.4 fallback).
    if (state.prevScene === 'approach' && state.approach) {
      const run = state.approach;
      const unfinishedWalk =
        run.decision.kind === 'modulate' && run.waypointIdx < run.decision.waypoints.length;
      if (run.decision.kind === 'landingPivot' || unfinishedWalk) {
        // The pivot obeys the phrase's mediant ration (§6.3/§8.4) — paradox
        // widens it like every other mediant draw (§8.5).
        const pivot = forceLandingPivot(
          state.harmony,
          run.destKey.tonicPc,
          run.destKey.mode,
          s.stage === 'paradox' ? PARADOX_MEDIANT_RATION : undefined
        );
        landingPivot = true;
        landingPivotMediant = pivot.pivoted;
      }
      state.approach = null;
    }

    state.prevScene = s.scene;
  }

  // In approach with a destination and no plan yet (the destination may
  // resolve a beat after the scene flips): plan the modulation (ruling #1).
  if (s.scene === 'approach' && !state.approach && s.destinationSeed != null && !s.storyLeads) {
    const destKey = derivePlanetKey(
      s.destinationSeed,
      (s.destinationArchetype ?? undefined) as ArchetypeId | undefined
    );
    const decision = planApproachModulation(
      { tonicPc: state.harmony.tonicPc, mode: state.harmony.mode },
      { tonicPc: destKey.tonicPc, mode: destKey.homeMode },
      {
        approachBars: APPROACH_EXPECTED_BARS,
        harmonyBars: harmonyBarsFor(effectiveEnergy),
        storyLeads: s.storyLeads
      }
    );
    state.approach = {
      decision,
      destKey: { tonicPc: destKey.tonicPc, mode: destKey.homeMode },
      waypointIdx: 0
    };
  }
  return { landingPivot, landingPivotMediant };
}

// --- Voice planning ----------------------------------------------------------------------------------

/** Stage 5 per-bar variation state (the cheapest legal operators, applied in cost order on a bar-tabu collision). */
interface BarVariation {
  percRotation: number;
  percKDelta: number;
  ornament: boolean;
  noteDelta: number;
  dropLast: boolean;
  octaveShift: number;
  swellShift: number;
}

function planOstinato(
  state: BedConductorState,
  effectiveEnergy: number,
  bar: number,
  noteCount: number = FRAGMENT_DEFAULT_NOTES,
  variation: BarVariation | null = null
): BedNoteEvent[] {
  const maxNotes = baseFigure(state.genome).notes.length;
  const n = Math.max(1, Math.min(maxNotes, noteCount + (variation?.noteDelta ?? 0)));
  let figure = ostinatoCell(state.genome, n);
  let doubled = false;
  if (effectiveEnergy > SUBDIV_DOUBLE_ENERGY && opLegal(figure, { kind: 'diminish' })) {
    figure = applyOp(figure, { kind: 'diminish' });
    doubled = true; // double-time sparkle: repeat the halved cell (ODESZA law)
  }
  const rendered = renderMotif(figure, state.genome, {
    tonicPc: state.harmony.tonicPc,
    mode: state.harmony.mode,
    chordRootPc: state.harmony.chord.rootPc,
    chordQuality: state.harmony.chord.quality,
    chordShape: state.harmony.chord.shape,
    anchorSemis: state.harmony.bandCenter + OST_ANCHOR_OFFSET_SEMIS,
    snapLanding: false
  });
  const notes: BedNoteEvent[] = [];
  const emit = (slot: number, durationSlots: number, semis: number): void => {
    const salt = bar * 37 + slot;
    if (effectiveEnergy < OST_CALM_ENERGY && musicUnit(state.planetSeed, SALT_OST_DROP, salt) < OST_DROP_P) {
      return; // breathing: the calm bed drops the occasional note (seeded)
    }
    const velocity =
      OST_VELOCITY_FLOOR + (1 - OST_VELOCITY_FLOOR) * musicUnit(state.planetSeed, SALT_VELOCITY, salt);
    notes.push({ slot, durationSlots, semis, velocity });
  };
  const octave = variation?.octaveShift ?? 0;
  const last = rendered.length - 1;
  for (let i = 0; i < rendered.length; i++) {
    if (variation?.dropLast && i === last && rendered.length > 1) continue;
    const n = rendered[i];
    // Ornament: the cell's last note displaced an octave — still the same scale tone.
    const semis = n.semis + octave + (variation?.ornament && i === last ? 12 : 0);
    emit(n.slot, n.durationSlots, semis);
    if (doubled) emit(n.slot + SLOTS_PER_BAR / 2, n.durationSlots, semis);
  }
  return notes;
}

/**
 * The bare-era voice (§8.5): the motif exists only as a LONE CHIP ARP OF
 * CHORD TONES — the rhythm gene's fragment carries the planet's pulse, but
 * every pitch is a chord tone (root/third/fifth ascending), anchored in the
 * ostinato register. One PSG voice; the renderer keeps it monophonic.
 */
function planChipArp(state: BedConductorState, bar: number): BedNoteEvent[] {
  const figure = ostinatoCell(state.genome, FRAGMENT_DEFAULT_NOTES);
  const iv = TRIAD_INTERVALS[state.harmony.chord.quality];
  const anchor = state.harmony.bandCenter + OST_ANCHOR_OFFSET_SEMIS;
  const rootPc = state.harmony.chord.rootPc;
  const base = rootPc + 12 * Math.round((anchor - rootPc) / 12);
  return figure.notes.map((n, i) => ({
    slot: n.slot,
    durationSlots: n.durationSlots,
    semis: base + iv[i % 3] + 12 * Math.floor(i / 3),
    velocity:
      OST_VELOCITY_FLOOR +
      (1 - OST_VELOCITY_FLOOR) * musicUnit(state.planetSeed, SALT_VELOCITY, bar * 37 + n.slot)
  }));
}

function planMelodyStatement(
  state: BedConductorState,
  s: BedSignals,
  phraseIndex: number,
  chordIds: readonly string[],
  preferChain: string | null = null
): { notes: BedNoteEvent[]; chain: string | null } {
  const pool = MELODY_CHAIN_POOL;
  const start = Math.floor(musicUnit(state.planetSeed, SALT_MELODY_CHAIN, phraseIndex) * pool.length);
  // Recapitulation (Stage 5): the run's first chain is tried first, transposed
  // by the brain's current centre through the ordinary render; the tabu still rules.
  const order: Array<readonly MotifOp[]> = [];
  const preferred = preferChain === null ? -1 : pool.findIndex((c) => serializeOpChain(c) === preferChain);
  if (preferred >= 0) order.push(pool[preferred]);
  for (let i = 0; i < Math.min(MELODY_TABU_CANDIDATES, pool.length); i++) {
    const c = pool[(start + i) % pool.length];
    if (!order.includes(c)) order.push(c);
  }
  for (const chain of order) {
    // Legality-checked chain application (illegal ops disqualify the candidate
    // rather than silently collapsing into another gesture's identity).
    let figure: MotifFigure | null = baseFigure(state.genome);
    for (const op of chain) {
      if (!opLegal(figure, op, s.wonder)) {
        figure = null;
        break;
      }
      figure = applyOp(figure, op, s.wonder);
    }
    if (!figure) continue;
    const chainStr = serializeOpChain(chain);
    const descriptor = {
      chordIds,
      operatorChain: chainStr,
      rhythmMask: figureRhythmMask(figure),
      registerBand: state.harmony.bandCenter
    };
    const phraseHash = hashPhrase(descriptor);
    const gestureHash = hashGesture(chainStr);
    if (!isPhraseAllowed(state.memory, phraseHash, gestureHash)) continue;
    recordPhrase(state.memory, phraseHash, gestureHash);
    const rendered = renderMotif(figure, state.genome, {
      tonicPc: state.harmony.tonicPc,
      mode: state.harmony.mode,
      chordRootPc: state.harmony.chord.rootPc,
      chordQuality: state.harmony.chord.quality,
      chordShape: state.harmony.chord.shape,
      anchorSemis: state.harmony.bandCenter + LEAD_ANCHOR_OFFSET_SEMIS,
      snapLanding: true
    });
    const notes = rendered.map((n, idx) => ({
      slot: n.slot,
      durationSlots: n.durationSlots,
      semis: n.semis,
      velocity:
        OST_VELOCITY_FLOOR +
        (1 - OST_VELOCITY_FLOOR) * musicUnit(state.planetSeed, SALT_VELOCITY, phraseIndex * 61 + idx)
    }));
    return { notes, chain: chainStr };
  }
  // Every candidate tabu'd or illegal: silence is a valid, composed output.
  return { notes: [], chain: null };
}

// --- The per-bar plan ----------------------------------------------------------------------------------

export function planBedBar(state: BedConductorState, s: BedSignals): BedBarPlan {
  const policy = BED_SCENE_POLICY[s.scene];
  const drift = resolveMacroDrift(state.planetSeed, s.timeSec, s.daylight);
  const gates = resolveEraGates(s.era, s.stage);
  const oxygen = resolveOxygenControls(s);

  // Underwater the harmonic rhythm slows (§8.4) — energy is the lever.
  const effectiveEnergy = clamp01(s.energy * (1 - clamp01(s.submergence) * SUBMERGE_ENERGY_SCALE));

  const { landingPivot, landingPivotMediant } = handleEdges(state, s, effectiveEnergy);
  const stageBloom = state.pendingStageBloom;
  state.pendingStageBloom = false;

  const prePhrasePos = state.harmony.phrasePos;
  const prePhraseIndex = state.harmony.phraseIndex;

  // --- Stage 5: the section planner (long form arms at material; the chip eras loop by authenticity).
  // Below material the shipped one-phrase machine, statement draws, ostinato cell
  // and percussion are untouched by construction (bare/colour renders identical).
  const longForm = !(s.stage === 'bare') && s.era >= ERA_MATERIAL;
  let sectionStarted = false;
  if (!longForm) {
    state.section = null;
  } else if (prePhrasePos === 0) {
    const cur = state.section;
    const ended = cur === null || prePhraseIndex - cur.startPhrase >= cur.lengthPhrases;
    if (ended || state.pendingHandBack) {
      if (state.pendingHandBack && (state.arrangement.name === 'BUILD' || state.arrangement.name === 'BLOOM')) {
        // The world does not celebrate a refusal: an in-flight gesture releases now.
        state.pendingForceEbb = true;
      }
      const plan = planSection(
        state.planetSeed,
        cur ? cur.sectionIndex + 1 : 0,
        prePhraseIndex,
        {
          energy: effectiveEnergy,
          wonder: s.wonder,
          tension: s.tension,
          era: s.era,
          bare: false,
          restBoost: policy.restBoost,
          afterHandBack: state.pendingHandBack
        },
        state.sectionHistory
      );
      recordSection(state.sectionHistory, plan);
      state.section = plan;
      state.withheldSpent = false;
      state.pendingHandBack = false;
      sectionStarted = true;
    }
  }
  const section = state.section;
  const phraseInSection = section ? prePhraseIndex - section.startPhrase : -1;
  const progress = section ? sectionProgress(section, phraseInSection, prePhrasePos / PHRASE_BARS) : 0;
  const sectionRegister = section ? Math.round(registerOffsetAt(section, progress)) : 0;
  const density = section ? densityAt(section, progress) * oxygen.densityScale : 1;
  const detailMix = DETAIL_DENSITY_FLOOR + (1 - DETAIL_DENSITY_FLOOR) * clamp01(s.detail);

  const rails: HarmonyRails = {
    biomeWeights: longForm ? s.biomeWeights : undefined,
    tension: s.tension,
    energy: effectiveEnergy,
    warmth: clamp01(s.warmth + drift.warmthBias),
    chroma: s.chroma,
    golden: s.golden,
    registerShift: Math.max(
      -REGISTER_SHIFT_MAX,
      Math.min(REGISTER_SHIFT_MAX, drift.registerShift + sectionRegister)
    )
  };

  // Phrase boundary: arrangement first (the harmony's forced curve follows it).
  let bloomEntered = false;
  if (prePhrasePos === 0) {
    const before = state.arrangement.name;
    const intent: ArrangementIntent | undefined = section
      ? {
          buildNow: buildStartsAt(section, phraseInSection),
          liftNow: liftBeforeBuildAt(section, phraseInSection),
          buildSpan: section.buildSpanPhrases,
          bloomPhrases: section.bloomPhrases,
          randomBuildAllowed: false
        }
      : undefined;
    advanceArrangementPhrase(state.arrangement, state.planetSeed, prePhraseIndex, {
      energy: effectiveEnergy,
      tension: s.tension,
      wonder: s.wonder,
      era: s.era,
      bare: s.stage === 'bare',
      restBoost: policy.restBoost,
      forceBuild: state.pendingForceBuild,
      forceEbb: state.pendingForceEbb,
      intent
    });
    state.pendingForceBuild = false;
    state.pendingForceEbb = false;
    bloomEntered = state.arrangement.name === 'BLOOM' && before !== 'BLOOM';
    if (bloomEntered) state.withheldSpent = true;
  }
  const arrangement = state.arrangement.name;
  const inGesture = arrangement === 'BUILD' || arrangement === 'BLOOM';

  // Stage 5 envelopes: the BLOOM-rail lift and the pulse level, slewed per bar (the symphony law).
  const liftCtx: LiftContext = {
    arrangement,
    dwell: state.arrangement.dwell,
    phrasePos: prePhrasePos,
    buildSpan: state.arrangement.buildSpan,
    bloomPhrases: state.arrangement.bloomPhrases
  };
  const bloomLift = slewEnvelope(state.liftLevel, liftTarget(liftCtx));
  state.liftLevel = bloomLift;
  const pulseLevel = slewEnvelope(state.pulseLevel, pulseTarget(liftCtx) * gates.sidechain);
  state.pulseLevel = pulseLevel;
  const pulse: BedPulsePlan = {
    level: pulseLevel,
    body: eraFade(s.era, ERA_ALIVE),
    beats: pulseBeats(state.genome.meter.beatsPerBar, arrangement, pulseLevel)
  };
  const buildBarsToBloom =
    arrangement === 'BUILD'
      ? (state.arrangement.buildSpan - state.arrangement.dwell) * PHRASE_BARS + (PHRASE_BARS - prePhrasePos)
      : null;

  const forcedShape: CurveShape | undefined =
    arrangement === 'BUILD' ? 'RISE' : arrangement === 'EBB' ? 'FALL' : undefined;

  // The `alive` awakening's promised mediant fires on the next phrase boundary.
  const stageMediantDue = state.pendingStageMediant && prePhrasePos === 0;
  if (stageMediantDue) state.pendingStageMediant = false;

  const event = advanceHarmonyBar(state.harmony, rails, {
    expandedVocabulary: longForm,
    forcedShape,
    hitScheduled: bloomEntered || stageBloom,
    forceMediant: stageMediantDue,
    mediantRation: s.stage === 'paradox' ? PARADOX_MEDIANT_RATION : undefined
  });

  // Approach walk: one waypoint per chord change while approaching (§8.4).
  if (
    s.scene === 'approach' &&
    state.approach &&
    state.approach.decision.kind === 'modulate' &&
    event.changed
  ) {
    const run = state.approach;
    const waypoints = (run.decision as { kind: 'modulate'; waypoints: KeySpec[] }).waypoints;
    if (run.waypointIdx < waypoints.length) {
      const wp = waypoints[run.waypointIdx];
      const isLast = run.waypointIdx === waypoints.length - 1;
      retargetHarmonyKey(state.harmony, wp.tonicPc, wp.mode, isLast);
      run.waypointIdx += 1;
    }
  }

  // §7.3 phrase chord context. At a boundary the just-completed phrase's list
  // (plus this bar's chord — the one under a statement's first bar) becomes
  // the statement fingerprint; the accumulator then restarts for the new
  // phrase. Consecutive holds collapse: chords SOUNDED, in order.
  let statementChordIds: string[] | null = null;
  if (prePhrasePos === 0) {
    const context = state.phraseChordIds;
    if (context[context.length - 1] !== event.chordId) context.push(event.chordId);
    statementChordIds = context;
    state.phraseChordIds = [];
  }
  if (state.phraseChordIds[state.phraseChordIds.length - 1] !== event.chordId) {
    state.phraseChordIds.push(event.chordId);
  }

  const base = arrangementLevels(arrangement);
  const levels: BedLayerLevels = policy.subOnly
    ? { sub: base.sub, pad: 0, ostinato: 0, texture: 0, lead: 0, percussion: 0, riser: 0 }
    : {
        sub: base.sub,
        pad: base.pad,
        ostinato: base.ostinato,
        texture: base.texture,
        lead: policy.melody ? base.lead : 0,
        percussion: policy.percussion ? base.percussion : 0,
        riser: base.riser
      };

  // Stage 5 arrangement rail: the BLOOM lift is an ARRANGEMENT property (the
  // layers rise), never a tail retune. Zero outside a gesture; zero at bare/colour
  // by construction (no BUILD is reachable below material).
  if (bloomLift > 0) {
    const liftOf = (db: number): number => 1 + (dbToLin(db) - 1) * bloomLift;
    levels.pad *= liftOf(BLOOM_RAIL_DB);
    levels.texture *= liftOf(BLOOM_RAIL_DB);
    levels.ostinato *= liftOf(BLOOM_RAIL_OSTINATO_DB);
    levels.lead *= liftOf(BLOOM_RAIL_LEAD_DB);
    levels.percussion *= liftOf(BLOOM_RAIL_PERCUSSION_DB);
    levels.sub *= liftOf(BLOOM_RAIL_SUB_DB);
  }
  // Withheld layer: held back until the bloom pays it out.
  const withheldLayer = section?.withheldLayer ?? null;
  const withheldActive = withheldLayer !== null && !state.withheldSpent && arrangement !== 'BLOOM';
  if (withheldActive && withheldLayer) {
    const key: keyof BedLayerLevels = withheldLayer === 'shimmer' ? 'texture' : withheldLayer;
    levels[key] *= WITHHELD_LEVEL[withheldLayer];
  }
  // REST sub-swell (owner ruling #4: the swell is the REST gesture) — seeded peak bar per phrase.
  const restSwell = (shift: number): number => {
    if (!longForm || arrangement !== 'REST') return 1;
    const span = REST_SWELL_PEAK_MAX - REST_SWELL_PEAK_MIN + 1;
    const peak =
      REST_SWELL_PEAK_MIN +
      ((Math.floor(musicUnit(state.planetSeed, SALT_REST_SWELL, prePhraseIndex) * span) + shift) % span);
    const swell = 1 - Math.abs(prePhrasePos - peak) / Math.max(peak, PHRASE_BARS - 1 - peak);
    return 1 + REST_SUB_SWELL * clamp01(swell);
  };
  const baseSub = levels.sub;
  levels.sub = baseSub * restSwell(0);

  const subMotifMix = smoothstep(
    SUB_MOTIF_BLEND_START,
    SUB_MOTIF_BLEND_END,
    clamp01(s.submergence)
  );

  // Bare (§8.5): the motif exists only as the lone chip arp of chord tones.
  const chipMono = s.stage === 'bare';
  const ostinatoNotes = longForm
    ? Math.max(
        FRAGMENT_MIN_NOTES,
        Math.round(
          FRAGMENT_MIN_NOTES +
            (baseFigure(state.genome).notes.length - FRAGMENT_MIN_NOTES) * clamp01(density * detailMix)
        )
      )
    : FRAGMENT_DEFAULT_NOTES;
  const ornamentDraw =
    longForm && musicUnit(state.planetSeed, SALT_OST_ORNAMENT, event.barIndex) < OST_ORNAMENT_P;
  const variation: BarVariation = {
    percRotation: 0,
    percKDelta: 0,
    ornament: ornamentDraw,
    noteDelta: 0,
    dropLast: false,
    octaveShift: 0,
    swellShift: 0
  };
  const renderOstinato = (): BedNoteEvent[] =>
    levels.ostinato > 0 && !policy.subOnly
      ? chipMono
        ? planChipArp(state, event.barIndex)
        : planOstinato(state, effectiveEnergy, event.barIndex, ostinatoNotes, longForm ? variation : null)
      : [];

  // Percussion: Euclidean onsets, rotation salted by the player's region
  // (travel literally turns the rhythm, §8.2). Stage 5: the density arc and
  // reality `detail` shape k, the phrase's last bar fills, rotation swings per phrase.
  const renderPercussion = (): number[] => {
    if (!(levels.percussion > 0 && gates.percussion > 0.01)) return [];
    let k: number;
    let rotation = Math.floor(s.regionUnit * SLOTS_PER_BAR);
    if (longForm) {
      k = Math.round(
        PERC_K_MIN + clamp01(effectiveEnergy * detailMix) * (0.5 + 0.5 * density) * (PERC_K_MAX - PERC_K_MIN)
      );
      if (prePhrasePos === PHRASE_BARS - 1) k += PERC_FILL_K;
      k = Math.min(SLOTS_PER_BAR, Math.max(1, k + variation.percKDelta));
      rotation +=
        Math.floor(musicUnit(state.planetSeed, SALT_PERC_PHRASE_ROT, prePhraseIndex) * PERC_PHRASE_ROTATION_SLOTS) +
        variation.percRotation;
    } else {
      k = Math.round(PERC_K_MIN + clamp01(effectiveEnergy * s.detail) * (PERC_K_MAX - PERC_K_MIN));
    }
    return rotatePattern(euclid(k, SLOTS_PER_BAR), SLOTS_PER_BAR, rotation);
  };

  let ostinato = renderOstinato();
  let percussion = renderPercussion();

  // Melody statements happen at phrase boundaries only, and rarely (C418 law).
  // Bare is monophonic: no statements — the chip arp IS the tune's only form.
  // Stage 5: with a section in flight the planner's statement schedule decides;
  // below material the shipped per-state draws stand.
  let melody: BedNoteEvent[] = [];
  let melodyChain: string | null = null;
  let melodyChordIds: string[] | null = null;
  const statementScheduled = section ? statementScheduledAt(section, phraseInSection) : false;
  if (prePhrasePos === 0 && levels.lead > 0 && !chipMono) {
    let fire = false;
    if (section) {
      // The planner's schedule decides — and every bloom still carries the tune
      // (a forced warp/launch bloom is not on the schedule; MELODY_BLOOM_P = 1 law).
      fire = statementScheduled || bloomEntered;
    } else {
      const p =
        arrangement === 'BLOOM'
          ? MELODY_BLOOM_P
          : arrangement === 'BED'
            ? MELODY_BED_P
            : arrangement === 'EBB'
              ? MELODY_EBB_P
              : 0;
      fire = p > 0 && musicUnit(state.planetSeed, SALT_MELODY_STATE, prePhraseIndex) < p;
    }
    if (fire) {
      const recap =
        section && section.recapPhrase === phraseInSection ? state.firstStatementChain : null;
      const statement = planMelodyStatement(
        state,
        s,
        prePhraseIndex,
        statementChordIds ?? [event.chordId],
        recap
      );
      melody = statement.notes;
      melodyChain = statement.chain;
      melodyChordIds = statement.chain !== null ? statementChordIds : null;
      if (statement.chain !== null && state.firstStatementChain === null) {
        state.firstStatementChain = statement.chain;
      }
    }
  }

  // --- Stage 5 whole-bar fingerprint law: no bar recurs inside BAR_TABU bars.
  // On a collision the cheapest legal variation operator applies, in cost
  // order, and the bar is re-checked; the bypass is an audited exception.
  const fingerprint = (): number =>
    hashBar({
      chordId: event.chordId,
      uppers: state.harmony.voicing.uppers,
      arrangement,
      melodyChain,
      ostinato: ostinato.map((n) => `${n.slot}:${n.semis}`),
      percussion,
      levels: [levels.sub, levels.pad, levels.ostinato, levels.texture, levels.lead, levels.percussion, levels.riser]
    });
  let barHash = fingerprint();
  let barVariationOps = 0;
  let barTabuBypass = false;
  // REST is composed stillness (sub + one soft pad on a held chord, owner
  // ruling #4): a rest recurring is not a loop, so the law binds the sounding
  // states and REST bars are recorded but never varied or counted as bypasses.
  if (longForm && arrangement !== 'REST') {
    while (!isBarAllowed(state.memory, barHash)) {
      if (barVariationOps >= BAR_VARIATION_MAX_TRIES) {
        barTabuBypass = true;
        state.barTabuBypasses += 1;
        break;
      }
      switch (barVariationOps) {
        case 0:
          if (percussion.length > 0) variation.percRotation += 1;
          else variation.ornament = !variation.ornament;
          break;
        case 1:
          variation.ornament = !variation.ornament;
          break;
        case 2:
          variation.noteDelta = ostinatoNotes < baseFigure(state.genome).notes.length ? 1 : -1;
          break;
        case 3:
          if (percussion.length > 0) variation.percKDelta += 1;
          else variation.octaveShift = 12;
          break;
        case 4:
          variation.dropLast = true;
          break;
        default:
          variation.octaveShift = -12;
          break;
      }
      barVariationOps += 1;
      levels.sub = baseSub * restSwell(variation.swellShift);
      ostinato = renderOstinato();
      percussion = renderPercussion();
      barHash = fingerprint();
    }
  }
  if (longForm) recordBar(state.memory, barHash);

  const tick = resolveWorldClockTick(s);
  if (policy.tickForce) {
    tick.present = true;
    tick.presence = 1;
  }
  const wind = resolveAudioGust(s);

  const plan: BedBarPlan = {
    barIndex: event.barIndex,
    phrasePos: prePhrasePos,
    harmony: event,
    publish: harmonyPublishTones(state.harmony),
    arrangement,
    levels,
    gates,
    policy,
    ostinato,
    melody,
    melodyChain,
    melodyChordIds,
    percussion,
    tick,
    // The breath dips key off the pulse and nowhere else (Stage 5): no pumping without a source.
    sidechainDepth: SIDECHAIN_DEPTH * PULSE_BREATH_SCALE * pulseLevel,
    subMotifMix,
    wind,
    buildPhrase: arrangement === 'BUILD',
    bloomEntered,
    warpExitBoom: state.pendingWarpExitBoom,
    landingPivot,
    landingPivotMediant,
    stageBloom,
    stageMediant: stageMediantDue && event.mediant,
    chipMono,
    padBrightness: clamp01(
      (PAD_BRIGHT_BASE +
        PAD_BRIGHT_WARMTH * rails.warmth +
        PAD_BRIGHT_PALETTE * (state.paletteBrightness - 0.5)) *
        oxygen.padBrightnessScale
    ),
    textureLean: drift.textureLean,
    tempoBpm: state.genome.baseTempo,
    sectionIndex: section ? section.sectionIndex : -1,
    phraseInSection,
    sectionStarted,
    statementScheduled,
    registerArc: section ? section.registerArc : null,
    withheldLayer,
    withheldActive,
    bloomBudget: section ? section.bloomBudget : 0,
    forcedBuild: inGesture && state.arrangement.forcedBuild,
    buildBarsToBloom,
    bloomLift,
    pulse,
    barHash,
    barTabuBypass,
    barVariationOps
  };
  state.pendingWarpExitBoom = false;
  return plan;
}
