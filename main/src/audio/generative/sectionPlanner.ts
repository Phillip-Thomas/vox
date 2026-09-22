import { fnv1a32 } from '../../utils/worldCoordinates.ts';
import { musicUnit, seededPickWeighted } from './seededMusic.ts';
import {
  BLOOM_PHRASES_MAX,
  BLOOM_PHRASES_MIN,
  BLOOM_TWO_PHRASE_P,
  BUILD_SPAN_MAX,
  BUILD_SPAN_MIN,
  BUILD_SPAN_WEIGHTS,
  ERA_MATERIAL,
  REGISTER_ARC_WEIGHTS,
  SECTION_BLOOM_P_BASE,
  SECTION_BLOOM_P_ENERGY,
  SECTION_DENSITY_MAX,
  SECTION_DENSITY_MIN,
  SECTION_INTRO_BUILD_PHRASES,
  SECTION_INTRO_BUILD_SPAN,
  SECTION_MAX_DRY_RUN,
  SECTION_PHRASES_MAX,
  SECTION_PHRASES_MIN,
  SECTION_PLAN_MAX_TRIES,
  SECTION_RECAP_P,
  SECTION_REGISTER_SEMIS,
  SECTION_STATEMENTS_MAX,
  SECTION_STATEMENTS_MIN,
  SECTION_WITHHOLD_DRY_P,
  WITHHELD_LAYERS,
  type RegisterArcName,
  type WithheldLayer
} from './tuning.ts';

// --- The section planner (Stage 5) — intention 4–8 phrases ahead -----------------------------------
//
// The arrangement machine (arrangement.ts) decides one phrase at a time; that
// is why thirty minutes of it read as weather rather than composition: every
// BUILD was one phrase, every BLOOM landed on the same budget, statements fell
// where a die said. The planner sits ABOVE the machine and emits a SECTION —
// a multi-phrase intention: where the statements fall, how the register
// travels, which layer is withheld and paid back at the bloom, whether this
// section blooms at all. The machine keeps its states, dwell bounds, era caps
// and forced gestures (warp, launch); it receives the intention as biases and
// caps (`ArrangementIntent`). Every draw is seeded on (planetSeed, sectionIndex,
// try) — a section is reproducible from the seed and its index alone. The
// drift clocks (worldSignals.resolveMacroDrift) continue beneath as weather.

export interface SectionPlan {
  sectionIndex: number;
  /** Absolute phrase index of the section's first phrase. */
  startPhrase: number;
  lengthPhrases: number;
  /** Phrase offsets (0-based, within the section) on which a melody statement is scheduled. */
  statementSchedule: number[];
  registerArc: RegisterArcName;
  /** Register-arc amplitude, semitones. */
  registerSemis: number;
  /** Density at the section's first and last phrase (0..1). */
  densityArc: [number, number];
  /** Layer withheld until the bloom enters (null: nothing withheld). */
  withheldLayer: WithheldLayer | null;
  /** 1: this section spends a BUILD→BLOOM; 0: it does not (forced gestures excepted). */
  bloomBudget: 0 | 1;
  /** Phrase offset where the planned BUILD begins (null when bloomBudget is 0). */
  buildPhrase: number | null;
  buildSpanPhrases: number;
  bloomPhrases: number;
  /** Phrase offset on which the run's first statement chain recapitulates (null: no recap). */
  recapPhrase: number | null;
  /** The section was planned first after a story hand-back: the world does not celebrate a refusal. */
  afterHandBack: boolean;
}

export interface SectionSignals {
  energy: number;
  wonder: number;
  tension: number;
  era: number;
  /** Reality stage is `bare` (only REST/BED reachable — no bloom budget). */
  bare: boolean;
  /** Scene REST weighting (deepSpace/storyTerminal ≥ 0.5 forbid a planned bloom). */
  restBoost: number;
  /** A story mood just handed authority back (contract [16]: bloomBudget 0, plateau|fall). */
  afterHandBack: boolean;
}

export interface SectionHistory {
  /** Every (statementSchedule, registerArc) pair already used in this run, oldest first. */
  pairs: string[];
  /** Consecutive sections planned with bloomBudget 0 (restraint ceiling). */
  drySections: number;
}

const SALT_SECTION = fnv1a32('score:section');
/** Draw slots per (section, try) — every planner decision gets its own salted unit. */
const SECTION_DRAWS = 32;
const SECTION_TRY_STRIDE = 1 << 12;

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

export function createSectionHistory(): SectionHistory {
  return { pairs: [], drySections: 0 };
}

/** The identity the contract forbids repeating: statement schedule × register arc. */
export function sectionPair(plan: Pick<SectionPlan, 'statementSchedule' | 'registerArc'>): string {
  return `${plan.statementSchedule.join('.')}|${plan.registerArc}`;
}

/** Restraint scenes: no planned bloom where the floor is the point. */
export const SECTION_REST_BOOST_NO_BLOOM = 0.5;

function drawSection(
  planetSeed: number,
  sectionIndex: number,
  startPhrase: number,
  s: SectionSignals,
  history: SectionHistory,
  attempt: number
): SectionPlan {
  const u = (k: number): number =>
    musicUnit(planetSeed, SALT_SECTION, sectionIndex * SECTION_DRAWS + k + attempt * SECTION_TRY_STRIDE);
  const energy = clamp01(s.energy);

  let lengthPhrases =
    SECTION_PHRASES_MIN + Math.floor(u(0) * (SECTION_PHRASES_MAX - SECTION_PHRASES_MIN + 1));
  if (s.wonder > 0.6 && lengthPhrases < SECTION_PHRASES_MAX) lengthPhrases += 1;

  const bloomReachable =
    !s.bare && s.era >= ERA_MATERIAL && !s.afterHandBack && s.restBoost < SECTION_REST_BOOST_NO_BLOOM;
  let bloomBudget: 0 | 1 = 0;
  if (bloomReachable) {
    if (sectionIndex === 0 || history.drySections >= SECTION_MAX_DRY_RUN) bloomBudget = 1;
    else bloomBudget = u(1) < SECTION_BLOOM_P_BASE + SECTION_BLOOM_P_ENERGY * energy ? 1 : 0;
  }

  const buildSpanPhrases =
    sectionIndex === 0
      ? SECTION_INTRO_BUILD_SPAN
      : Math.min(
          BUILD_SPAN_MAX,
          Math.max(
            BUILD_SPAN_MIN,
            seededPickWeighted(
              BUILD_SPAN_WEIGHTS.map(([span, w, boost]) => [span, w + boost * energy] as const),
              u(2)
            )
          )
        );
  const bloomPhrases = Math.min(
    BLOOM_PHRASES_MAX,
    Math.max(BLOOM_PHRASES_MIN, u(3) < BLOOM_TWO_PHRASE_P ? 2 : 1)
  );

  let buildPhrase: number | null = null;
  if (bloomBudget === 1) {
    // Leave at least one phrase after the bloom for the release (EBB/REST).
    const need = buildSpanPhrases + bloomPhrases + 1;
    if (sectionIndex === 0) {
      buildPhrase = SECTION_INTRO_BUILD_PHRASES[Math.floor(u(4) * SECTION_INTRO_BUILD_PHRASES.length)];
    } else {
      const maxStart = Math.max(1, lengthPhrases - need);
      buildPhrase = 1 + Math.floor(u(4) * maxStart);
    }
    lengthPhrases = Math.max(lengthPhrases, buildPhrase + need);
    if (lengthPhrases > SECTION_PHRASES_MAX) {
      // Compress toward the cap rather than exceed it: shorter build first, then bloom.
      const over = lengthPhrases - SECTION_PHRASES_MAX;
      const spanCut = Math.min(over, buildSpanPhrases - BUILD_SPAN_MIN);
      lengthPhrases -= spanCut;
      const bloomCut = Math.min(lengthPhrases - SECTION_PHRASES_MAX, bloomPhrases - BLOOM_PHRASES_MIN);
      lengthPhrases -= Math.max(0, bloomCut);
      return drawSection(planetSeed, sectionIndex, startPhrase, s, history, attempt + 1);
    }
  }

  let withheldLayer: WithheldLayer | null = null;
  if (bloomBudget === 1 || u(5) < SECTION_WITHHOLD_DRY_P) {
    withheldLayer = WITHHELD_LAYERS[Math.floor(u(6) * WITHHELD_LAYERS.length)];
  }

  let registerArc: RegisterArcName;
  if (s.afterHandBack) {
    registerArc = u(7) < 0.5 ? 'plateau' : 'fall';
  } else {
    registerArc = seededPickWeighted(REGISTER_ARC_WEIGHTS, u(7));
  }

  const span = SECTION_DENSITY_MAX - SECTION_DENSITY_MIN;
  let densityArc: [number, number];
  if (bloomBudget === 1) {
    densityArc = [
      SECTION_DENSITY_MIN + span * 0.35 * u(8),
      SECTION_DENSITY_MIN + span * (0.65 + 0.35 * u(9))
    ];
  } else {
    densityArc = [SECTION_DENSITY_MIN + span * u(8), SECTION_DENSITY_MIN + span * u(9)];
  }

  // Statement schedule: the bloom's first phrase always carries the tune; a
  // seeded handful of further phrases outside the BUILD (no lead there).
  const buildPhrases = new Set<number>();
  if (buildPhrase !== null) {
    for (let i = 0; i < buildSpanPhrases; i++) buildPhrases.add(buildPhrase + i);
  }
  const schedule = new Set<number>();
  if (buildPhrase !== null) schedule.add(buildPhrase + buildSpanPhrases);
  const extra =
    SECTION_STATEMENTS_MIN + Math.floor(u(10) * (SECTION_STATEMENTS_MAX - SECTION_STATEMENTS_MIN + 1));
  const candidates: number[] = [];
  for (let p = 0; p < lengthPhrases; p++) if (!buildPhrases.has(p) && !schedule.has(p)) candidates.push(p);
  for (let i = 0; i < extra && candidates.length > 0; i++) {
    const idx = Math.floor(u(11 + i) * candidates.length);
    schedule.add(candidates[idx]);
    candidates.splice(idx, 1);
  }
  const statementSchedule = [...schedule].sort((a, b) => a - b);

  let recapPhrase: number | null = null;
  if (u(14) < SECTION_RECAP_P) {
    const bloomPhrase = buildPhrase === null ? -1 : buildPhrase + buildSpanPhrases;
    const slots = statementSchedule.filter((p) => p !== bloomPhrase);
    if (slots.length > 0) recapPhrase = slots[slots.length - 1];
  }

  return {
    sectionIndex,
    startPhrase,
    lengthPhrases,
    statementSchedule,
    registerArc,
    registerSemis: SECTION_REGISTER_SEMIS,
    densityArc,
    withheldLayer,
    bloomBudget,
    buildPhrase,
    buildSpanPhrases: bloomBudget === 1 ? buildSpanPhrases : BUILD_SPAN_MIN,
    bloomPhrases: bloomBudget === 1 ? bloomPhrases : BLOOM_PHRASES_MIN,
    recapPhrase,
    afterHandBack: s.afterHandBack
  };
}

/**
 * Plan the section that starts at `startPhrase`. Deterministic under
 * (planetSeed, sectionIndex, signals, history). Re-draws until the
 * (statementSchedule, registerArc) pair is unused in this run; after
 * SECTION_PLAN_MAX_TRIES the last draw's schedule is nudged deterministically
 * so the pair law still holds. Does NOT mutate `history` (see recordSection).
 */
export function planSection(
  planetSeed: number,
  sectionIndex: number,
  startPhrase: number,
  signals: SectionSignals,
  history: SectionHistory
): SectionPlan {
  let plan = drawSection(planetSeed, sectionIndex, startPhrase, signals, history, 0);
  for (let attempt = 1; attempt < SECTION_PLAN_MAX_TRIES && history.pairs.includes(sectionPair(plan)); attempt++) {
    plan = drawSection(planetSeed, sectionIndex, startPhrase, signals, history, attempt);
  }
  // Deterministic nudge: move the last free statement slot until the pair is fresh.
  let guard = 0;
  while (history.pairs.includes(sectionPair(plan)) && guard < plan.lengthPhrases * 4) {
    const bloomPhrase = plan.buildPhrase === null ? -1 : plan.buildPhrase + plan.buildSpanPhrases;
    const movable = plan.statementSchedule.filter((p) => p !== bloomPhrase);
    if (movable.length === 0) {
      plan.statementSchedule = [...new Set([...plan.statementSchedule, guard % plan.lengthPhrases])].sort((a, b) => a - b);
    } else {
      const last = movable[movable.length - 1];
      const next = (last + 1) % plan.lengthPhrases;
      const rest = plan.statementSchedule.filter((p) => p !== last);
      plan.statementSchedule = [...new Set([...rest, next])].sort((a, b) => a - b);
    }
    guard++;
  }
  return plan;
}

/** Commit a planned section to the run history (pair memory + dry-run counter). */
export function recordSection(history: SectionHistory, plan: SectionPlan): void {
  history.pairs.push(sectionPair(plan));
  history.drySections = plan.bloomBudget === 1 ? 0 : history.drySections + 1;
}

/** Normalized position 0..1 of a bar inside the section (phrase offset + bar fraction). */
export function sectionProgress(plan: SectionPlan, phraseInSection: number, barFraction: number): number {
  return clamp01((phraseInSection + barFraction) / Math.max(1, plan.lengthPhrases));
}

/** Register offset of the arc at progress t, semitones (−registerSemis..+registerSemis). */
export function registerOffsetAt(plan: SectionPlan, t: number): number {
  const a = plan.registerSemis;
  const x = clamp01(t);
  switch (plan.registerArc) {
    case 'rise':
      return -a + 2 * a * x;
    case 'fall':
      return a - 2 * a * x;
    case 'arch':
      return -a + 2 * a * Math.sin(Math.PI * x);
    case 'plateau':
      return 0;
  }
}

/** Density of the arc at progress t (0..1). */
export function densityAt(plan: SectionPlan, t: number): number {
  const [d0, d1] = plan.densityArc;
  return clamp01(d0 + (d1 - d0) * clamp01(t));
}

export function statementScheduledAt(plan: SectionPlan, phraseInSection: number): boolean {
  return plan.statementSchedule.includes(phraseInSection);
}

export function buildStartsAt(plan: SectionPlan, phraseInSection: number): boolean {
  return plan.bloomBudget === 1 && plan.buildPhrase === phraseInSection;
}

/** The phrase before a planned BUILD: the machine lifts out of REST so the build has a bed to rise from. */
export function liftBeforeBuildAt(plan: SectionPlan, phraseInSection: number): boolean {
  return plan.bloomBudget === 1 && plan.buildPhrase !== null && plan.buildPhrase - 1 === phraseInSection;
}

/** Phrase offset on which the planned bloom enters, or null. */
export function plannedBloomPhrase(plan: SectionPlan): number | null {
  return plan.buildPhrase === null ? null : plan.buildPhrase + plan.buildSpanPhrases;
}
