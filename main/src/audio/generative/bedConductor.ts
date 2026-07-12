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
  type MotifGenome
} from './motif.ts';
import { euclid, rotatePattern, SLOTS_PER_BAR } from './rhythm.ts';
import {
  createPhraseMemory,
  hashGesture,
  hashPhrase,
  isPhraseAllowed,
  recordPhrase,
  type PhraseMemory
} from './phraseMemory.ts';
import { planApproachModulation, type KeySpec, type ModulationDecision } from './approachModulation.ts';
import {
  resolveEraGates,
  resolveAudioGust,
  resolveMacroDrift,
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
  BED_SCENE_POLICY,
  FRAGMENT_DEFAULT_NOTES,
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
    phraseChordIds: []
  };
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

function planOstinato(
  state: BedConductorState,
  effectiveEnergy: number,
  bar: number
): BedNoteEvent[] {
  let figure = ostinatoCell(state.genome, FRAGMENT_DEFAULT_NOTES);
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
  for (const n of rendered) {
    emit(n.slot, n.durationSlots, n.semis);
    if (doubled) emit(n.slot + SLOTS_PER_BAR / 2, n.durationSlots, n.semis);
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
  chordIds: readonly string[]
): { notes: BedNoteEvent[]; chain: string | null } {
  const pool = MELODY_CHAIN_POOL;
  const start = Math.floor(musicUnit(state.planetSeed, SALT_MELODY_CHAIN, phraseIndex) * pool.length);
  for (let i = 0; i < Math.min(MELODY_TABU_CANDIDATES, pool.length); i++) {
    const chain = pool[(start + i) % pool.length];
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

  // Underwater the harmonic rhythm slows (§8.4) — energy is the lever.
  const effectiveEnergy = clamp01(s.energy * (1 - clamp01(s.submergence) * SUBMERGE_ENERGY_SCALE));
  const rails: HarmonyRails = {
    tension: s.tension,
    energy: effectiveEnergy,
    warmth: clamp01(s.warmth + drift.warmthBias),
    chroma: s.chroma,
    golden: s.golden,
    registerShift: drift.registerShift
  };

  const { landingPivot, landingPivotMediant } = handleEdges(state, s, effectiveEnergy);
  const stageBloom = state.pendingStageBloom;
  state.pendingStageBloom = false;

  // Phrase boundary: arrangement first (the harmony's forced curve follows it).
  const prePhrasePos = state.harmony.phrasePos;
  const prePhraseIndex = state.harmony.phraseIndex;
  let bloomEntered = false;
  if (prePhrasePos === 0) {
    const before = state.arrangement.name;
    advanceArrangementPhrase(state.arrangement, state.planetSeed, prePhraseIndex, {
      energy: effectiveEnergy,
      tension: s.tension,
      wonder: s.wonder,
      era: s.era,
      bare: s.stage === 'bare',
      restBoost: policy.restBoost,
      forceBuild: state.pendingForceBuild,
      forceEbb: state.pendingForceEbb
    });
    state.pendingForceBuild = false;
    state.pendingForceEbb = false;
    bloomEntered = state.arrangement.name === 'BLOOM' && before !== 'BLOOM';
  }

  const forcedShape: CurveShape | undefined =
    state.arrangement.name === 'BUILD' ? 'RISE' : state.arrangement.name === 'EBB' ? 'FALL' : undefined;

  // The `alive` awakening's promised mediant fires on the next phrase boundary.
  const stageMediantDue = state.pendingStageMediant && prePhrasePos === 0;
  if (stageMediantDue) state.pendingStageMediant = false;

  const event = advanceHarmonyBar(state.harmony, rails, {
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

  const gates = resolveEraGates(s.era, s.stage);
  const base = arrangementLevels(state.arrangement.name);
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

  const subMotifMix = smoothstep(
    SUB_MOTIF_BLEND_START,
    SUB_MOTIF_BLEND_END,
    clamp01(s.submergence)
  );

  // Bare (§8.5): the motif exists only as the lone chip arp of chord tones.
  const chipMono = s.stage === 'bare';
  const ostinato =
    levels.ostinato > 0 && !policy.subOnly
      ? chipMono
        ? planChipArp(state, event.barIndex)
        : planOstinato(state, effectiveEnergy, event.barIndex)
      : [];

  // Melody statements happen at phrase boundaries only, and rarely (C418 law).
  // Bare is monophonic: no statements — the chip arp IS the tune's only form.
  let melody: BedNoteEvent[] = [];
  let melodyChain: string | null = null;
  let melodyChordIds: string[] | null = null;
  if (prePhrasePos === 0 && levels.lead > 0 && !chipMono) {
    const p =
      state.arrangement.name === 'BLOOM'
        ? MELODY_BLOOM_P
        : state.arrangement.name === 'BED'
          ? MELODY_BED_P
          : state.arrangement.name === 'EBB'
            ? MELODY_EBB_P
            : 0;
    if (p > 0 && musicUnit(state.planetSeed, SALT_MELODY_STATE, prePhraseIndex) < p) {
      const statement = planMelodyStatement(
        state,
        s,
        prePhraseIndex,
        statementChordIds ?? [event.chordId]
      );
      melody = statement.notes;
      melodyChain = statement.chain;
      melodyChordIds = statement.chain !== null ? statementChordIds : null;
    }
  }

  // Percussion: Euclidean onsets, rotation salted by the player's region
  // (travel literally turns the rhythm, §8.2).
  let percussion: number[] = [];
  if (levels.percussion > 0 && gates.percussion > 0.01) {
    const k = Math.round(PERC_K_MIN + clamp01(effectiveEnergy * s.detail) * (PERC_K_MAX - PERC_K_MIN));
    percussion = rotatePattern(euclid(k, SLOTS_PER_BAR), SLOTS_PER_BAR, Math.floor(s.regionUnit * SLOTS_PER_BAR));
  }

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
    arrangement: state.arrangement.name,
    levels,
    gates,
    policy,
    ostinato,
    melody,
    melodyChain,
    melodyChordIds,
    percussion,
    tick,
    sidechainDepth: SIDECHAIN_DEPTH * effectiveEnergy * gates.sidechain,
    subMotifMix,
    wind,
    buildPhrase: state.arrangement.name === 'BUILD',
    bloomEntered,
    warpExitBoom: state.pendingWarpExitBoom,
    landingPivot,
    landingPivotMediant,
    stageBloom,
    stageMediant: stageMediantDue && event.mediant,
    chipMono,
    padBrightness: clamp01(
      PAD_BRIGHT_BASE +
        PAD_BRIGHT_WARMTH * rails.warmth +
        PAD_BRIGHT_PALETTE * (state.paletteBrightness - 0.5)
    ),
    textureLean: drift.textureLean,
    tempoBpm: state.genome.baseTempo
  };
  state.pendingWarpExitBoom = false;
  return plan;
}
