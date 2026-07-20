import type { ShipRepairStage } from './emergentCapabilities.ts';
import type { StoryBeat } from './storyState.ts';
import {
  clearStoryScoreMoodOverride,
  getChapter7BoardingScoreMood,
  getChapter7ReconstructionScoreMood,
  setStoryScoreMoodOverride,
  type Chapter7BoardingScoreVariant,
  type Chapter7ReconstructionScoreVariant
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

const OWNED_BEATS: readonly StoryBeat[] = ['ch7-reconstruct', 'ch7-board'];
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

  activeBeat = beat;
  reconstructionVariant = null;
  boardingVariant = null;
  shipHumMultiplier = 1;
  if (hydratedFacts) reconstructionFacts = cloneReconstructionFacts(hydratedFacts);

  if (beat === 'ch7-reconstruct') applyReconstructionVariant();
  if (beat === 'ch7-board') applyBoardingVariant();
  return isEmergentScoreOwnedBeat(beat);
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
