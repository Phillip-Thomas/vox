import type { ShipRepairStage } from './emergentCapabilities.ts';
import { hasMilestone } from '../game/systems/progressionSystem.ts';
import { STORY_MILESTONES, type StoryBeat } from './storyState.ts';
import {
  clearStoryScoreMoodOverride,
  getChapter7BoardingScoreMood,
  getChapter7ReconstructionScoreMood,
  getChapter10ScoreMood,
  setStoryScoreMoodOverride,
  type Chapter7BoardingScoreVariant,
  type Chapter7ReconstructionScoreVariant,
  type Chapter10ScoreVariant
} from './storyScore.ts';
import {
  getStoryMusicEnvelopeSnapshot,
  releaseStoryMusicEnvelope,
  resetStoryMusicEnvelopeForTests,
  setStoryMusicEnvelopePaused,
  settleStoryMusicEnvelope,
  startPressureSealMusicEnvelope,
  PRESSURE_SEAL_FADE_UP_SECONDS,
  type StoryMusicEnvelopeSnapshot
} from './storyMusicEnvelope.ts';

export type Chapter7CalibrationState = 'none' | 'active' | 'complete';

export interface Chapter7ReconstructionScoreFacts {
  repairStage: ShipRepairStage;
  firstHoverComplete: boolean;
  groundedReturnComplete: boolean;
  calibrationState: Chapter7CalibrationState;
}

export type Chapter7BoardingPhase =
  | 'outside'
  | 'hatch-entered'
  | 'vehicle-owner'
  | 'cockpit-sealed'
  | 'cockpit-handback'
  | 'cancelled';

export interface Chapter7BoardingPhaseOptions {
  /** Stable physical-boarding transaction identity, used for one-shot silence. */
  transactionId?: string;
  /** False for hydration/recovery. Only a live seal edge may play the envelope. */
  live?: boolean;
}

export interface EmergentScoreSnapshot {
  beat: StoryBeat | null;
  ownsBeat: boolean;
  reconstructionFacts: Chapter7ReconstructionScoreFacts;
  reconstructionVariant: Chapter7ReconstructionScoreVariant | null;
  boardingPhase: Chapter7BoardingPhase;
  boardingVariant: Chapter7BoardingScoreVariant | null;
  shipHumMultiplier: number;
  shipHumSlewSeconds: number | null;
  musicEnvelope: StoryMusicEnvelopeSnapshot;
}

const OWNED_BEATS: readonly StoryBeat[] = [
  'ch7-reconstruct',
  'ch7-board',
  'ch10-cold',
  'ch10-ask',
  'ch10-transit'
];

// --- Chapter 10 -------------------------------------------------------------
//
// The chapter's foreignness is TIME, not timbre: REGULATION figures carry
// uniform velocity, zero drop probability and fixed articulation against the
// world's seeded velocity/drop/phrase variation, and the relay answering early
// is that law at maximum. (The engine owns no timing humanize — the salts drive
// velocity, drop and phrase choice — so "dead on the grid" named a mechanism
// that does not exist and is not the distinguisher here.) Every number below is
// a named constant grouped for owner retuning, and nothing touches the engine.

/** ch8 flight DNA's tempo, reused by the whole chapter. */
export const CH10_ASK_TEMPO_BPM = 68;
/** The answer enters on beat 3 of the ask figure's own bar: ask + 2 beats. */
export const CH10_RELAY_ANSWER_BEATS = 2;
/** Run maximum, below every awakening. Reported through `scoreIntensityFor`. */
export const CH10_MAX_INTENSITY = 0.44;
/** Where intensity parks when the rail releases at the threshold hand-back. */
export const CH10_HANDBACK_PARK_INTENSITY = 0.28;
// The seam's ebb slew is NOT declared here. The named slew the contract calls
// for is the engine's own shipped SCORE_OST_GAIN_SLEW_S (0.4s), which is what
// actually ebbs the pulse; a second constant beside it was read by nothing and
// documented a rate the music never took.

/**
 * The answer's offset from the ask, in seconds. The story lane asserts this
 * against `K7_REVEAL_GUARD_SECONDS`: the tempo is the score's to move, but only
 * inside the inequality 2 beats >= 1.36s (tempo <= ~88 bpm, which the shipped
 * TEMPO_MAX 88 already satisfies). At 68 bpm the answer sounds ~1.76s after the
 * ask — text-complete, phrase-incomplete.
 */
export function chapter10RelayAnswerDelaySeconds(): number {
  return (60 / CH10_ASK_TEMPO_BPM) * CH10_RELAY_ANSWER_BEATS;
}

/** Every ch10 anchor that moves the score, and the intensity it reports. */
export const CH10_ANCHOR_INTENSITY: Readonly<Record<string, number>> = Object.freeze({
  'anc.ch10.cold-noticed': 0.24,
  'anc.ch10.fault-read': 0.30,
  'anc.ch10.fabrication-refused': 0.22,
  'anc.ch10.relay-ask': 0.34,
  'anc.ch10.relay-answer': 0.36,
  'anc.ch10.bearing-claimed': 0.38,
  'anc.ch10.transit-ignite': 0.42,
  'anc.ch10.seam-of-light': 0.36,
  'anc.ch10.station-resolved': CH10_MAX_INTENSITY,
  'anc.ch10.threshold-handback': CH10_HANDBACK_PARK_INTENSITY
});

/** Which mood variant each anchor selects. Pure, and reload-safe. */
const CH10_ANCHOR_VARIANT: Readonly<Record<string, Chapter10ScoreVariant>> = Object.freeze({
  'anc.ch10.cold-noticed': 'cold-settled',
  'anc.ch10.fault-read': 'fault-ledger',
  'anc.ch10.fabrication-refused': 'refused',
  'anc.ch10.relay-ask': 'relay-ask',
  'anc.ch10.relay-answer': 'relay-answer',
  'anc.ch10.bearing-claimed': 'bearing-claimed',
  'anc.ch10.transit-ignite': 'transit-hold',
  'anc.ch10.seam-of-light': 'seam-ebb',
  'anc.ch10.station-resolved': 'station-resolved'
});

/**
 * The intensity each variant reports, DERIVED from the two tables above rather
 * than written a third time: every variant-selecting anchor carries exactly one
 * intensity, so the report is a function of the variant and therefore — like
 * the variant — a function of the durable milestones.
 */
const CH10_VARIANT_INTENSITY: Readonly<Partial<Record<Chapter10ScoreVariant, number>>> =
  Object.freeze(Object.fromEntries(
    Object.entries(CH10_ANCHOR_VARIANT)
      .map(([anchorId, variant]) => [variant, CH10_ANCHOR_INTENSITY[anchorId]])
  ));

/** The beat each ch10 variant belongs to; a variant may not cross a beat. */
const CH10_VARIANT_BEAT: Readonly<Record<Chapter10ScoreVariant, StoryBeat>> = Object.freeze({
  'cold-settled': 'ch10-cold',
  'fault-ledger': 'ch10-cold',
  refused: 'ch10-cold',
  'crossing-back': 'ch10-ask',
  'relay-ask': 'ch10-ask',
  'relay-answer': 'ch10-ask',
  'bearing-claimed': 'ch10-ask',
  'transit-hold': 'ch10-transit',
  'seam-ebb': 'ch10-transit',
  'station-resolved': 'ch10-transit'
});

/**
 * The chapter's durable score facts. Exactly the milestones the story lane
 * already persists — the score keeps NO progression of its own, which is what
 * makes a reload musically indistinguishable from a continuous run.
 */
export interface Chapter10ScoreMilestones {
  faultRead: boolean;
  relayAsked: boolean;
  relayAnswered: boolean;
  seamPassed: boolean;
  stationResolved: boolean;
}

export interface Chapter10ScoreState {
  variant: Chapter10ScoreVariant | null;
  carrierAlive: boolean;
}

/** Reads the durable facts. The only impure step, and it is a read. */
export function chapter10ScoreMilestones(): Chapter10ScoreMilestones {
  return {
    faultRead: hasMilestone(STORY_MILESTONES.ch10FaultRead),
    relayAsked: hasMilestone(STORY_MILESTONES.ch10RelayAsked),
    relayAnswered: hasMilestone(STORY_MILESTONES.ch10RelayAnswered),
    seamPassed: hasMilestone(STORY_MILESTONES.ch10SeamPassed),
    stationResolved: hasMilestone(STORY_MILESTONES.ch10StationResolved)
  };
}

/**
 * THE RESOLVER. Variant and carrier are a pure function of the beat and the
 * durable milestones — never of which edges this session happened to see.
 *
 * The rail this replaced latched the carrier on the `anc.ch10.relay-answer`
 * edge and re-entered every beat on a fixed variant, so a mid-transit reload
 * restored the pulse the seam had ebbed away and dropped the octave double at
 * the resolve: the two gestures the chapter is FOR, lost to a refresh. Anchors
 * still drive the live seams (that is the music moving in the moment); this is
 * what the chapter sounds like at rest, and the two agree by construction
 * because they are keyed off the same durable facts.
 */
export function resolveChapter10ScoreState(
  beat: StoryBeat | null,
  milestones: Chapter10ScoreMilestones
): Chapter10ScoreState {
  if (!isChapter10Beat(beat)) return { variant: null, carrierAlive: false };
  // The carrier is born at the relay answer and dies at the hand-back, which
  // leaves the chapter — so inside chapter 10 it is exactly "has she asked and
  // been answered", with no session state in the question.
  const carrierAlive = milestones.relayAnswered;
  if (beat === 'ch10-cold') {
    return { variant: milestones.faultRead ? 'fault-ledger' : 'cold-settled', carrierAlive };
  }
  if (beat === 'ch10-ask') {
    // The question is a sounding phrase with a durable fact of its own, so a
    // reload between asking and being answered comes back mid-question rather
    // than back on the crossing.
    return {
      variant: milestones.relayAnswered ? 'relay-answer'
        : milestones.relayAsked ? 'relay-ask'
        : 'crossing-back',
      carrierAlive
    };
  }
  return {
    variant: milestones.stationResolved
      ? 'station-resolved'
      : milestones.seamPassed ? 'seam-ebb' : 'transit-hold',
    carrierAlive
  };
}

/**
 * The bounded carrier: born at the relay answer as the answer figure's
 * unreleased final tone, dead at the threshold hand-back via reset-score. Zero
 * free-play survival — the continuous-pedal thesis is a deferred packet and
 * nothing here anticipates it.
 *
 * Birth has no constant here on purpose: it is the `relayAnswered` milestone the
 * resolver above reads, not an anchor id this module watches go by. Death stays
 * an anchor because the hand-back is an act, not a state.
 */
const CH10_CARRIER_DIES_AT = 'anc.ch10.threshold-handback';

let chapter10Variant: Chapter10ScoreVariant | null = null;
let chapter10CarrierAlive = false;
/** The carrier state the currently installed mood was built with. */
let chapter10CarrierVoiced = false;
let chapter10Intensity: number | null = null;
const DEFAULT_RECONSTRUCTION_FACTS: Chapter7ReconstructionScoreFacts = {
  repairStage: 'wrecked',
  firstHoverComplete: false,
  groundedReturnComplete: false,
  calibrationState: 'none'
};

let activeBeat: StoryBeat | null = null;
let reconstructionFacts: Chapter7ReconstructionScoreFacts = {
  ...DEFAULT_RECONSTRUCTION_FACTS
};
let reconstructionVariant: Chapter7ReconstructionScoreVariant | null = null;
let boardingPhase: Chapter7BoardingPhase = 'outside';
let boardingVariant: Chapter7BoardingScoreVariant | null = null;
let shipHumMultiplier = 1;
let lastPressureSealOwner: string | null = null;

/** Pure, reload-safe derivation. No separate score progression is persisted. */
export function resolveChapter7ReconstructionScoreVariant(
  facts: Chapter7ReconstructionScoreFacts
): Chapter7ReconstructionScoreVariant {
  switch (facts.repairStage) {
    case 'wrecked':
      return 'diagnosis';
    case 'bench_online':
      return 'bench';
    case 'frame_restored':
      return 'frame';
    case 'hull_sealed':
      return 'hull';
    case 'lift_online':
      return facts.firstHoverComplete ? 'hover' : 'lift';
    case 'flight_ready':
      // Flight readiness is the ordered repair transaction. The former origin
      // hover/grounded-return rehearsal is no longer on its critical path; an
      // optional Tidegarden aerial survey may happen later without retarding
      // this reconstruction phrase.
      return facts.calibrationState === 'none' ? 'route' : 'calibration';
    default:
      return 'diagnosis';
  }
}

export function isEmergentScoreOwnedBeat(beat: StoryBeat | null): boolean {
  return beat !== null && OWNED_BEATS.includes(beat);
}

/** Beat lifecycle integration point for storyDirector. */
export function enterEmergentScoreBeat(
  beat: StoryBeat | null,
  hydratedFacts?: Chapter7ReconstructionScoreFacts
): boolean {
  if (activeBeat === beat) {
    if (hydratedFacts) syncChapter7ReconstructionScore(hydratedFacts);
    return isEmergentScoreOwnedBeat(beat);
  }

  const previousBeat = activeBeat;
  if (previousBeat && isEmergentScoreOwnedBeat(previousBeat)) {
    clearStoryScoreMoodOverride(previousBeat);
  }
  if (previousBeat === 'ch7-board') releaseStoryMusicEnvelope();

  if (previousBeat !== null && isChapter10Beat(previousBeat) && !isChapter10Beat(beat)) {
    // Leaving chapter 10 in any direction releases the carrier through
    // reset-score. It never survives into free play.
    releaseChapter10Score();
  }

  activeBeat = beat;
  reconstructionVariant = null;
  boardingVariant = null;
  shipHumMultiplier = 1;
  if (hydratedFacts) reconstructionFacts = cloneReconstructionFacts(hydratedFacts);

  if (beat === 'ch7-reconstruct') applyReconstructionVariant();
  if (beat === 'ch7-board') applyBoardingVariant();
  if (isChapter10Beat(beat)) {
    // Installed BEFORE storyDirector's setScoreBeat asks the instrument for the
    // beat mood, so a deep link, a mid-chapter reload and a continuous run all
    // retune identically — the resolver is the only authority for both values.
    const state = resolveChapter10ScoreState(beat, chapter10ScoreMilestones());
    chapter10CarrierAlive = state.carrierAlive;
    if (state.variant) applyChapter10Variant(state.variant);
  }
  return isEmergentScoreOwnedBeat(beat);
}

export function isChapter10Beat(beat: StoryBeat | null): boolean {
  return beat === 'ch10-cold' || beat === 'ch10-ask' || beat === 'ch10-transit';
}

/**
 * The single seam the story director moves the chapter-10 score through. One
 * anchor, one variant, one intensity — no second clock, no tuned offsets, and
 * no hit type of any kind anywhere in the chapter.
 */
export function noteChapter10ScoreAnchor(anchorId: string): Chapter10ScoreVariant | null {
  if (!isChapter10Beat(activeBeat)) return null;
  // Carrier presence is RE-READ from the durable milestones at every anchor,
  // never latched on the birth edge. The story lane marks its milestone before
  // it publishes the anchor, so the live frame and a later reload agree by
  // construction rather than by two rails happening to stay in step.
  chapter10CarrierAlive = resolveChapter10ScoreState(
    activeBeat,
    chapter10ScoreMilestones()
  ).carrierAlive;
  const intensity = CH10_ANCHOR_INTENSITY[anchorId];
  if (intensity !== undefined) chapter10Intensity = intensity;
  if (anchorId === CH10_CARRIER_DIES_AT) {
    releaseChapter10Score();
    return null;
  }
  const variant = CH10_ANCHOR_VARIANT[anchorId];
  if (!variant || CH10_VARIANT_BEAT[variant] !== activeBeat) return chapter10Variant;
  return applyChapter10Variant(variant);
}

/** reset-score for chapter 10: rail released, carrier dead, intensity parked. */
export function releaseChapter10Score(): void {
  chapter10CarrierAlive = false;
  chapter10CarrierVoiced = false;
  chapter10Variant = null;
  chapter10Intensity = CH10_HANDBACK_PARK_INTENSITY;
  clearStoryScoreMoodOverride();
}

export interface Chapter10ScoreSnapshot {
  variant: Chapter10ScoreVariant | null;
  carrierAlive: boolean;
  intensity: number | null;
  maxIntensity: number;
}

export function getChapter10ScoreSnapshot(): Chapter10ScoreSnapshot {
  return {
    variant: chapter10Variant,
    carrierAlive: chapter10CarrierAlive,
    intensity: chapter10Intensity,
    maxIntensity: CH10_MAX_INTENSITY
  };
}

function applyChapter10Variant(next: Chapter10ScoreVariant): Chapter10ScoreVariant {
  const beat = CH10_VARIANT_BEAT[next];
  const stale = chapter10Variant !== next || chapter10CarrierVoiced !== chapter10CarrierAlive;
  const reported = CH10_VARIANT_INTENSITY[next];
  if (reported !== undefined) chapter10Intensity = reported;
  if (activeBeat === beat && stale) {
    setStoryScoreMoodOverride(beat, getChapter10ScoreMood(next, chapter10CarrierAlive));
    chapter10CarrierVoiced = chapter10CarrierAlive;
  }
  chapter10Variant = next;
  return next;
}

/** Full hydration/update seam; the returned variant is deterministic. */
export function syncChapter7ReconstructionScore(
  facts: Chapter7ReconstructionScoreFacts
): Chapter7ReconstructionScoreVariant {
  reconstructionFacts = cloneReconstructionFacts(facts);
  return applyReconstructionVariant();
}

export function setChapter7RepairStage(
  repairStage: ShipRepairStage
): Chapter7ReconstructionScoreVariant {
  return syncChapter7ReconstructionScore({ ...reconstructionFacts, repairStage });
}

export function noteChapter7FirstHover(): Chapter7ReconstructionScoreVariant {
  return syncChapter7ReconstructionScore({
    ...reconstructionFacts,
    firstHoverComplete: true
  });
}

export function noteChapter7GroundedReturn(): Chapter7ReconstructionScoreVariant {
  return syncChapter7ReconstructionScore({
    ...reconstructionFacts,
    groundedReturnComplete: true
  });
}

export function startChapter7Calibration(): Chapter7ReconstructionScoreVariant {
  return syncChapter7ReconstructionScore({
    ...reconstructionFacts,
    calibrationState: 'active'
  });
}

export function completeChapter7Calibration(): Chapter7ReconstructionScoreVariant {
  return syncChapter7ReconstructionScore({
    ...reconstructionFacts,
    calibrationState: 'complete'
  });
}

/** Live physical-boarding phase integration point. */
export function setChapter7BoardingPhase(
  next: Chapter7BoardingPhase,
  options: Chapter7BoardingPhaseOptions = {}
): Chapter7BoardingScoreVariant {
  const changed = boardingPhase !== next;
  boardingPhase = next;

  if (next === 'cancelled' && changed) releaseStoryMusicEnvelope();
  if (next === 'cockpit-sealed' && options.live && options.transactionId) {
    const owner = pressureSealOwner(options.transactionId);
    if (lastPressureSealOwner !== owner) {
      lastPressureSealOwner = owner;
      startPressureSealMusicEnvelope(owner);
    }
  }

  return applyBoardingVariant();
}

/**
 * Rebuild the boarding mix from committed ownership on reload. A sealed save is
 * steady cockpit audio and explicitly spends its transaction without silence.
 */
export function hydrateChapter7BoardingScore(input: {
  sealed: boolean;
  transactionId?: string;
}): Chapter7BoardingScoreVariant {
  if (input.sealed) {
    boardingPhase = 'cockpit-handback';
    lastPressureSealOwner = input.transactionId
      ? pressureSealOwner(input.transactionId)
      : null;
    settleStoryMusicEnvelope(lastPressureSealOwner ?? undefined);
  } else {
    boardingPhase = 'outside';
    lastPressureSealOwner = null;
    releaseStoryMusicEnvelope(0);
  }
  return applyBoardingVariant();
}

export function setEmergentScorePaused(next: boolean): void {
  setStoryMusicEnvelopePaused(next);
}

/** AudioDirector may read this without importing story progression internals. */
export function getEmergentScoreMixSnapshot(): {
  shipHumMultiplier: number;
  shipHumSlewSeconds: number | null;
} {
  return {
    shipHumMultiplier,
    // The hum is established during the pressure silence, before the shared
    // music envelope completes its named 120 ms recovery.
    shipHumSlewSeconds: activeBeat === 'ch7-board'
      ? PRESSURE_SEAL_FADE_UP_SECONDS
      : null
  };
}

export function getEmergentScoreSnapshot(): EmergentScoreSnapshot {
  return {
    beat: activeBeat,
    ownsBeat: isEmergentScoreOwnedBeat(activeBeat),
    reconstructionFacts: cloneReconstructionFacts(reconstructionFacts),
    reconstructionVariant,
    boardingPhase,
    boardingVariant,
    shipHumMultiplier,
    shipHumSlewSeconds: activeBeat === 'ch7-board'
      ? PRESSURE_SEAL_FADE_UP_SECONDS
      : null,
    musicEnvelope: getStoryMusicEnvelopeSnapshot()
  };
}

export function resetEmergentScoreDirectorForTests(): void {
  if (activeBeat && isEmergentScoreOwnedBeat(activeBeat)) {
    clearStoryScoreMoodOverride(activeBeat);
  }
  chapter10Variant = null;
  chapter10CarrierAlive = false;
  chapter10CarrierVoiced = false;
  chapter10Intensity = null;
  activeBeat = null;
  reconstructionFacts = { ...DEFAULT_RECONSTRUCTION_FACTS };
  reconstructionVariant = null;
  boardingPhase = 'outside';
  boardingVariant = null;
  shipHumMultiplier = 1;
  lastPressureSealOwner = null;
  resetStoryMusicEnvelopeForTests();
}

function applyReconstructionVariant(): Chapter7ReconstructionScoreVariant {
  const next = resolveChapter7ReconstructionScoreVariant(reconstructionFacts);
  if (activeBeat === 'ch7-reconstruct' && reconstructionVariant !== next) {
    setStoryScoreMoodOverride(
      'ch7-reconstruct',
      getChapter7ReconstructionScoreMood(next)
    );
  }
  reconstructionVariant = next;
  return next;
}

function applyBoardingVariant(): Chapter7BoardingScoreVariant {
  const next = resolveBoardingVariant(boardingPhase);
  if (activeBeat === 'ch7-board' && boardingVariant !== next) {
    setStoryScoreMoodOverride('ch7-board', getChapter7BoardingScoreMood(next));
  }
  boardingVariant = next;
  shipHumMultiplier = activeBeat === 'ch7-board'
    ? (isSealedBoardingPhase(boardingPhase) ? 1 : 0)
    : 1;
  return next;
}

function resolveBoardingVariant(phase: Chapter7BoardingPhase): Chapter7BoardingScoreVariant {
  if (phase === 'hatch-entered') return 'hatch';
  if (phase === 'vehicle-owner') return 'vehicle-owner';
  if (isSealedBoardingPhase(phase)) return 'cockpit';
  return 'outside';
}

function isSealedBoardingPhase(phase: Chapter7BoardingPhase): boolean {
  return phase === 'cockpit-sealed' || phase === 'cockpit-handback';
}

function pressureSealOwner(transactionId: string): string {
  return `ch7-board:pressure-seal:${transactionId}`;
}

function cloneReconstructionFacts(
  facts: Chapter7ReconstructionScoreFacts
): Chapter7ReconstructionScoreFacts {
  return { ...facts };
}
