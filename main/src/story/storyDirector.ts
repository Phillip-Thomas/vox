import * as THREE from 'three';
import {
  clearVoxelRealityOverrides,
  overrideVoxelRealityEffects,
  setVoxelRealityStage,
  VOXEL_REALITY_PRESETS
} from '../game/systems/realityRenderSystem.ts';
import { getMilestones, hasMilestone, markMilestone } from '../game/systems/progressionSystem.ts';
import { getItemCount, subscribeInventory } from '../game/systems/inventorySystem.ts';
import { getCampfires, subscribeCampfires } from '../game/systems/campfires.ts';
import { getVitals, isStaminaExhausted, setVitals } from '../game/systems/survivalVitals.ts';
import { getWaterskinFill } from '../game/systems/consumeSystem.ts';
import { addMawCharge, getMawCharge, MAX_MAW_CHARGE, setMawCharge } from '../game/systems/mawSystem.ts';
import { getMiningProgress } from '../game/systems/miningProgress.ts';
import { playSfx } from '../audio/sfxEngine.ts';
import { DAY_LENGTH_SECONDS, getCurrentDayPhase, setDayPhaseOffset } from '../game/worldClock.ts';
import {
  advanceToBeat,
  completeStory,
  getStoryStateSnapshot,
  STORY_MILESTONES,
  subscribeStory,
  type StoryBeat
} from './storyState.ts';
import { registerStoryInteraction } from './storyInteractions.ts';
import {
  getStoryInputPolicy,
  setStoryLookMode,
  setStoryMoveScale,
  setStorySideBlend,
  setStoryTargetDpr,
  setStoryTargetFov,
  FEED_DPR,
  FEED_FOV,
  SANDBOX_FOV
} from './storyInputPolicy.ts';
import { getSideFacing, getSideLens, setLensRig, SIDE_RIG, type LensRig } from './sideLens.ts';
import { getPlayerWorldPosition } from '../state/playerFrame.ts';
import { clearLifeReveal, setLifeReveal } from '../game/lifeReveal.ts';
import { VOXEL_SCALE } from '../utils/cubeGravityConstants.ts';
import { debrisSalvageComplete } from './debrisSalvage.ts';
import { supplyPodsComplete } from './supplyPods.ts';
import { navWaypointsComplete, resetNavWaypoints } from './navWaypoints.ts';
import { anomalyStoneHandle } from './world/AnomalyStone.tsx';
import { wreckRelayHandle } from './world/WreckRelay.tsx';
import { getAuditWorkerPose, hideAuditWorker } from './world/AuditWorker.tsx';
import { storyAnchors } from './world/storyWorld.ts';
import { setStoryForcedDayPhase } from './storyDayPhase.ts';
import { setCinematicLookTarget, setCinematicLookWeight } from './cinematicLook.ts';
import { getFeedRuntime, resetFeedRuntime } from './feedRuntime.ts';
import { clearViolations, pushViolation, setWorkOrder, showAuditLine, showCaption } from './storyText.ts';
import {
  A1_RAMP_SECONDS,
  A2_CAPTIONS,
  A2_TIMELINE,
  A2_VIOLATION_LINES,
  A3_CAPTIONS,
  A3_TIMELINE,
  ANOMALY_SURVEY,
  ARRIVAL,
  ARRIVAL_CAPTIONS,
  ARRIVAL_LINES,
  CH1_ANOMALY_MASS_ORDER,
  CH1_ECHO_LINES,
  CH1_FLASH_SCHEDULE,
  CH1_FIXED_TUTORIAL,
  CH1_QUOTA,
  CH1_WORK_ORDERS,
  CH3_CAPTIONS,
  DUSK,
  FIRST_DAY,
  FIRST_DAY_CAPTIONS,
  MUSING_GAP_SECONDS,
  MUSINGS,
  SIGNAL,
  SIGNAL_LINES,
  VIGIL,
  VIGIL_LINES,
  VOYAGE_DECK
} from './storyScript.ts';
import { complianceToneLine, getArrivalCellCharge } from './voyageOutcome.ts';
import { scoreHit, setScoreBeat, setScoreIntensity } from './storyScore.ts';

// --- The story director -------------------------------------------------------------
//
// Non-React beat state machine + scripted timelines. Beat ENTRY side effects
// (work orders, runtime resets) fire from the story subscription; per-frame work
// (glitch flashes, the A1 chroma ramp, FOV easing, the feed frame counter) runs
// in tick(), called by the in-Canvas StoryDirectorDriver so shader uniforms and
// DOM overlay values land on the same frame.

// Deterministic flicker mask (mulberry32) so the A1 ramp is identical every run.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface DirectorRuntime {
  beat: StoryBeat | null;
  beatClock: number;
  /** Seconds of ch1 gameplay (drives the flash schedule). */
  ch1Clock: number;
  flashesFired: boolean[];
  flashFramesLeft: number;
  glitchDecay: number;
  a1FlickerNoise: () => number;
  /** A2 sub-state: next violation timestamp + one-shot latches. */
  a2NextViolationAt: number;
  a2ViolationIndex: number;
  a2HudDead: boolean;
  /** One-shot caption latches (keyed on beat + index). */
  captionsFired: Set<string>;
  /** Story-driven day phase (the director owns the sun until completion). */
  dayPhase: number;
  /** A3 one-shot: the dark-of-sleep world mutations fired. */
  a3Woke: boolean;
  /** A3 bloom-wave origin (captured at the ramp; zero until then). */
  bloomCenter: THREE.Vector3;
  /** The R3F clock at the latest tick (for releasing the world clock cleanly). */
  elapsedSeconds: number;
  restUnregister: (() => void) | null;
  /** Fractional harvester recharge carried between ticks (flushed whole points). */
  mawRechargeAccum: number;
  /** descent one-shot: the impact flash/sfx fired. */
  descentImpacted: boolean;
  /** ch1-fixed tutorial: distinct fixed-screen cells the worker has stood in. */
  fixedCells: Set<number>;
  /** ch1-lift one-shot: the mid-lift dpr snap + glitch mask fired. */
  liftSnapped: boolean;
  /** Scratch target for the lift's look-ahead pull. */
  liftLookTarget: THREE.Vector3;
  // --- the first day alive / chapter 4 ---
  /** Vitals from the previous tick (a discrete RISE = drank / ate). */
  prevThirst: number;
  prevHunger: number;
  /** Waterskin fill last tick (a rise from 0 = the first fill). */
  prevWaterskin: number;
  /** Musing lull tracking: elapsedSeconds of the last caption + current gap. */
  lastCaptionAt: number;
  musingGap: number;
  /** ch3-signal / ch4-vigil: the phase each lerp departs from. */
  signalPhaseFrom: number;
  vigilPhaseFrom: number;
  signalKlaxons: number;
  /** ch3-forage: beat-clock time of the first meal (-1 = not yet). */
  forageAteAt: number;
  /** ch1-anomaly staging: sweep sectors seen; true once the mass is designated. */
  anomalySectorsSeen: Set<number>;
  anomalyMassStage: boolean;
  /** Beat-clock time of the designation (-1 = not yet) — arms the touch. */
  anomalyDesignatedAt: number;
  /** ch4-arrival one-shots. */
  arrivalWoke: boolean;
  /** 2-frame BARE drop (the auditor's eyes) — inverse of the chroma flash. */
  bareFramesLeft: number;
  /** Scratch for the auditor's walk. */
  workerScratch: THREE.Vector3;
}

const d: DirectorRuntime = {
  beat: null,
  beatClock: 0,
  ch1Clock: 0,
  flashesFired: CH1_FLASH_SCHEDULE.map(() => false),
  flashFramesLeft: 0,
  glitchDecay: 0,
  a1FlickerNoise: mulberry32(0x7c07),
  a2NextViolationAt: 0,
  a2ViolationIndex: 0,
  a2HudDead: false,
  captionsFired: new Set(),
  dayPhase: 0.25,
  a3Woke: false,
  bloomCenter: new THREE.Vector3(),
  elapsedSeconds: 0,
  restUnregister: null,
  mawRechargeAccum: 0,
  descentImpacted: false,
  fixedCells: new Set(),
  liftSnapped: false,
  liftLookTarget: new THREE.Vector3(),
  prevThirst: -1,
  prevHunger: -1,
  prevWaterskin: -1,
  lastCaptionAt: 0,
  musingGap: MUSING_GAP_SECONDS[0],
  signalPhaseFrom: 0.25,
  vigilPhaseFrom: 0.42,
  signalKlaxons: 0,
  forageAteAt: -1,
  anomalySectorsSeen: new Set(),
  anomalyMassStage: false,
  anomalyDesignatedAt: -1,
  arrivalWoke: false,
  bareFramesLeft: 0,
  workerScratch: new THREE.Vector3()
};

/** Seconds since the current beat began (survey dwells, resolver gates). */
export function getStoryBeatClock(): number {
  return d.beatClock;
}

/**
 * The ch3 chill (story-scoped temperature model — the sandbox holds warmth
 * full until a real model lands): warmth drains in the open, recovers fast
 * beside a fire, and never becomes lethal (floor well above zero). The fire is
 * built BECAUSE of this — the stat appears already falling.
 */
function tickStoryChill(dt: number, drainPerSecond: number): void {
  if (!hasMilestone(STORY_MILESTONES.senseTemp)) return;
  const v = getVitals();
  if (nearCampfire(getPlayerWorldPosition())) {
    if (v.warmth < 100) setVitals({ warmth: Math.min(100, v.warmth + dt * 6) });
  } else {
    setVitals({ warmth: Math.max(22, v.warmth - dt * drainPerSecond) });
  }
}

const _fixedRel = new THREE.Vector3();

/** ch1-fixed tutorial progress (HUD ledger line). */
export function fixedTutorialProgress(): { fiber: number; screens: number } {
  return {
    fiber: Math.min(getItemCount('biofiber'), CH1_FIXED_TUTORIAL.biofiber),
    screens: Math.min(d.fixedCells.size, CH1_FIXED_TUTORIAL.screens)
  };
}

function quotaCollected(): { fiber: number; stone: number; total: number; met: boolean } {
  const fiber = Math.min(getItemCount('biofiber'), CH1_QUOTA.biofiber);
  const stone = Math.min(getItemCount('stone'), CH1_QUOTA.stone);
  return {
    fiber,
    stone,
    total: fiber + stone,
    // The raster act completes on quota AND the descent's debris recovered.
    met: fiber >= CH1_QUOTA.biofiber && stone >= CH1_QUOTA.stone && debrisSalvageComplete()
  };
}

/** Prologue-choice echo lines the work order appends (the system remembers). */
function echoLines(): string[] {
  const chosen = getMilestones().filter(m => m.startsWith('story:choice:'));
  const lines: string[] = [];
  for (const milestone of chosen) {
    const [, , cardId, optionId] = milestone.split(':');
    const option = VOYAGE_DECK.cards[cardId]?.options.find(o => o.id === optionId);
    const line = option ? CH1_ECHO_LINES[option.echoLineId] : undefined;
    if (line && !lines.includes(line)) lines.push(line);
  }
  if (lines.length === 0) lines.push(CH1_ECHO_LINES['echo-neutral']);
  const tone = complianceToneLine();
  if (tone) lines.push(tone);
  // The paperwork stays readable: newest three echoes only.
  return lines.slice(-3);
}

// --- beat entry ----------------------------------------------------------------

/** Width (world units) of one fixed-screen cell — the era where the frame is bolted. */
const FIXED_SCREEN_CELL = 24;

/** Belt-scroll clearance in voxel ROWS — must cover the supply pods (±3 rows). */
const DEPTH_BAND_ROWS = 3.5;

const ISO_RIG: LensRig = {
  elevation: 0.6, // ~34° — the classic axonometric silhouette, not a high oblique
  azimuth: Math.PI / 4,
  distance: 26,
  lift: 2.4,
  focusLift: 1.2,
  followQuant: 0,
  depthBand: Infinity
};

/**
 * The monochrome ladder's camera, one era per rung. Every transition is a single
 * camera move (the rig blend), so each style dissolves into the next: bolted
 * screen → tracking → profile → belt depth → top-down → isometric → (lift).
 */
const ERA_RIGS: Partial<Record<StoryBeat, { rig: LensRig; seconds: number }>> = {
  'descent': { rig: { ...SIDE_RIG }, seconds: 0 },
  'ch1-fixed': { rig: { ...SIDE_RIG, followQuant: FIXED_SCREEN_CELL }, seconds: 0 },
  'ch1-track': { rig: { ...SIDE_RIG }, seconds: 6.5 }, // the unbolt IS the cutscene
  'ch1-raster': { rig: { ...SIDE_RIG }, seconds: 0 },
  'ch1-depth': { rig: { ...SIDE_RIG, depthBand: DEPTH_BAND_ROWS * VOXEL_SCALE, distance: 18 }, seconds: 2.5 },
  'ch1-nav': {
    rig: { elevation: Math.PI / 2, azimuth: 0, distance: 34, lift: 0, focusLift: 0, followQuant: 0, depthBand: Infinity },
    seconds: 5
  },
  'ch1-iso': { rig: { ...ISO_RIG }, seconds: 5 },
  'ch1-lift': { rig: { ...ISO_RIG }, seconds: 0 } // direct jumps start at the iso vantage
};

function onBeatEntered(beat: StoryBeat | null): void {
  d.beat = beat;
  d.beatClock = 0;
  const era = beat ? ERA_RIGS[beat] : null;
  if (era) setLensRig(era.rig, era.seconds);
  // Cutscene-scoped world state never survives a beat change.
  if (beat !== 'a3-dawn') {
    clearLifeReveal();
    d.bloomCenter.set(0, 0, 0);
  }
  // Cutscene state never survives a beat change (envelopes re-assert per frame).
  setCinematicLookWeight(0);
  setCinematicLookTarget(null);
  getFeedRuntime().cinematic = 0;
  // The score retunes to the beat's mood (null fades it out for the sandbox).
  setScoreBeat(beat);
  switch (beat) {
    case 'descent':
      resetFeedRuntime();
      getFeedRuntime().descent = 0; // the pod enters the frame
      d.descentImpacted = false;
      setStoryForcedDayPhase(0.25);
      break;
    case 'ch1-fixed':
      // First playable frame after the crash — the era where the frame itself
      // is bolted down. All the arrival initialization happens here.
      resetFeedRuntime();
      getFeedRuntime().descent = 1.1; // the wreck is a fact of the world now
      d.ch1Clock = 0;
      d.flashesFired = CH1_FLASH_SCHEDULE.map(() => false);
      // The construct runs standard illumination until the player earns time (A3).
      setStoryForcedDayPhase(0.25);
      // The harvester arrives with whatever the voyage left in the cell (full
      // minus recalibrations/forgettings; commendations topped it up). It
      // degrades to the broken/refuel loop when the survival act begins (ch3).
      setMawCharge(getArrivalCellCharge());
      d.fixedCells.clear();
      setWorkOrder([...CH1_WORK_ORDERS.fixed, ...echoLines()]);
      break;
    case 'ch1-track':
      // The mini-awakening: the frame unbolts and learns to follow the worker.
      playSfx('storyAwaken');
      scoreHit('bloom');
      setWorkOrder([...CH1_WORK_ORDERS.track]);
      break;
    case 'ch1-raster':
      // Direct jumps land here too — re-run the arrival init (idempotent).
      resetFeedRuntime();
      getFeedRuntime().descent = 1.1;
      d.ch1Clock = 0;
      d.flashesFired = CH1_FLASH_SCHEDULE.map(() => false);
      setStoryForcedDayPhase(0.25);
      setMawCharge(getArrivalCellCharge());
      setWorkOrder([...CH1_WORK_ORDERS.raster, ...echoLines()]);
      break;
    case 'ch1-depth':
      getFeedRuntime().descent = 1.1; // direct-jump safe
      setStoryForcedDayPhase(0.25);
      d.glitchDecay = 0.55; // each era hand-off announces itself
      setWorkOrder([...CH1_WORK_ORDERS.depth]);
      break;
    case 'ch1-nav':
      getFeedRuntime().descent = 1.1;
      setStoryForcedDayPhase(0.25);
      d.glitchDecay = 0.55;
      resetNavWaypoints();
      setWorkOrder([...CH1_WORK_ORDERS.nav]);
      break;
    case 'ch1-iso':
      getFeedRuntime().descent = 1.1;
      setStoryForcedDayPhase(0.25);
      d.glitchDecay = 0.7; // dpr ratchets 0.4→0.55 under this pulse (policy snap)
      playSfx('storyGlitch');
      setWorkOrder([...CH1_WORK_ORDERS.iso]);
      break;
    case 'ch1-anomaly':
      // The raster→pan-tilt upgrade announces itself with a glitch pulse.
      // STAGE 1: the calibration sweep — one goal at a time; the mass is not
      // designated (no marker, no [F]) until the era has been looked through.
      d.glitchDecay = 0.7;
      d.anomalySectorsSeen.clear();
      d.anomalyMassStage = false;
      d.anomalyDesignatedAt = -1;
      setWorkOrder([...CH1_WORK_ORDERS.anomaly]);
      break;
    case 'ch1-lift':
      d.liftSnapped = false;
      playSfx('storyAwaken');
      setWorkOrder(['PAN-TILT SURVEY: CALIBRATING…', 'HOLD POSITION. PERSPECTIVE IS BEING ISSUED.']);
      break;
    case 'a1-ramp':
      // Movement freezes via the beat policy; the timeline below owns the
      // visuals — and the system's voice goes with the grayscale (a clean
      // frame for the awakening; ch2's ticket re-fills it after).
      setWorkOrder([]);
      playSfx('storyAwaken');
      break;
    case 'ch2-color':
      // Post-A1 (also the deep-link/resume entry): color is through; the feed
      // chrome stays but the CAGE fails with it — the pan-tilt interlock goes
      // with the chroma suppressor, and the neck is suddenly the player's
      // (free look + diagonals; the policy grants it, this line explains it).
      getFeedRuntime().desat = 0;
      getFeedRuntime().treatment = 1;
      getFeedRuntime().descent = 1.1; // wreck present on direct jumps too
      setStoryForcedDayPhase(0.25);
      setWorkOrder([
        'SENSOR FAULT: CHROMATIC CHANNEL UNSUPPRESSED',
        'SENSOR FAULT: PAN-TILT INTERLOCK RELEASED. FULL ROTATION AVAILABLE.',
        'A REPAIR TICKET HAS BEEN FILED (Q: 44,207)',
        'RESUME QUOTA. DO NOT LOOK AT THE COLORS. DO NOT LOOK FREELY.'
      ]);
      break;
    case 'ch2-approach':
      getFeedRuntime().desat = 0; // post-A1 (direct debug jumps skip ch2-color)
      setWorkOrder([
        'RETURN TO THE SURVEY AREA',
        'THE OBJECT AHEAD IS NOT AN OBJECT',
        'THERE IS NO OBJECT'
      ]);
      break;
    case 'a2-awakening':
      getFeedRuntime().desat = 0; // post-A1 (direct debug jumps land here too)
      d.a2NextViolationAt = 0;
      d.a2ViolationIndex = 0;
      d.a2HudDead = false;
      clearViolations();
      break;
    case 'ch3-gather':
      // Post-A2 (also the deep-link/resume entry): the feed is gone entirely.
      getFeedRuntime().treatment = 0;
      getFeedRuntime().desat = 0;
      getFeedRuntime().redaction.visible = false;
      d.dayPhase = 0.25;
      setStoryForcedDayPhase(0.25); // noon holds until the scripted first dusk
      setWorkOrder([]);
      clearViolations();
      markMilestone(STORY_MILESTONES.senseHealth); // the suit reports A BODY — one row
      ensureRestInteraction();
      // (Timber/flint were EARNED as hull debris back in the raster act.)
      break;
    case 'ch3-dusk':
      // The first sun event: the story takes the camera for a few seconds.
      playSfx('storyAwaken');
      setStoryMoveScale(0);
      fireCaptionOnce('dusk', CH3_CAPTIONS.duskStart);
      ensureRestInteraction();
      break;
    case 'ch3-await-rest':
      // Direct entry (deep link / resume): start from the post-dusk sky.
      d.dayPhase = Math.max(d.dayPhase, DUSK.targetPhase);
      ensureRestInteraction();
      break;
    case 'a3-dawn':
      d.a3Woke = false;
      if (d.restUnregister) {
        d.restUnregister();
        d.restUnregister = null;
      }
      break;
    case 'ch3-thirst':
    case 'ch3-forage':
    case 'ch3-signal':
    case 'ch4-vigil': {
      // The first day alive (also the deep-link entries): the feed chrome is
      // long gone, the wreck is a fact of the world, and the sun stays the
      // director's until the arrival hands it to the live clock.
      const r = getFeedRuntime();
      r.treatment = 0;
      r.desat = 0;
      r.redaction.visible = false;
      r.descent = 1.1;
      setWorkOrder([]);
      clearViolations();
      // Direct jumps land mid-morning; a flowing run keeps the dawn's phase.
      if (d.dayPhase > 0.2 && d.dayPhase < 0.97) d.dayPhase = FIRST_DAY.morningPhase;
      // The needs arrive ALREADY FALLING (the TEMP pattern) — seeds clamp down.
      if (beat === 'ch3-thirst' && getVitals().thirst > FIRST_DAY.thirstSeed) {
        setVitals({ thirst: FIRST_DAY.thirstSeed });
      }
      if (beat === 'ch3-forage') {
        if (getVitals().hunger > FIRST_DAY.hungerSeed) setVitals({ hunger: FIRST_DAY.hungerSeed });
        d.forageAteAt = -1;
      }
      if (beat === 'ch3-signal') {
        d.signalPhaseFrom = d.dayPhase;
        d.signalKlaxons = 0;
        // The run must have a full budget — the sensation is CAUSED, on cue.
        setVitals({ stamina: 100 });
      }
      if (beat === 'ch4-vigil') {
        d.vigilPhaseFrom = Math.min(Math.max(d.dayPhase, SIGNAL.phaseTarget), DUSK.targetPhase);
        d.dayPhase = d.vigilPhaseFrom;
        ensureRestInteraction();
      }
      setStoryForcedDayPhase(d.dayPhase);
      const v = getVitals();
      d.prevThirst = v.thirst;
      d.prevHunger = v.hunger;
      d.prevWaterskin = getWaterskinFill();
      d.lastCaptionAt = d.elapsedSeconds;
      break;
    }
    case 'ch4-arrival':
      d.arrivalWoke = false;
      if (d.restUnregister) {
        d.restUnregister();
        d.restUnregister = null;
      }
      hideAuditWorker();
      getFeedRuntime().descent = 1.1;
      break;
    default:
      break;
  }
}

// --- rest interaction ([F] Rest at a campfire, at night) ---------------------------

const REST_DISTANCE = 4.2;

function nearCampfire(position: { x: number; y: number; z: number }): boolean {
  for (const fire of getCampfires()) {
    const dx = position.x - fire.pos[0];
    const dy = position.y - fire.pos[1];
    const dz = position.z - fire.pos[2];
    if (dx * dx + dy * dy + dz * dz <= REST_DISTANCE * REST_DISTANCE) return true;
  }
  return false;
}

function ensureRestInteraction(): void {
  if (d.restUnregister) return;
  d.restUnregister = registerStoryInteraction((_camera, position) => {
    const s = getStoryStateSnapshot();
    if (!s.active) return null;
    if (s.beat !== 'ch3-await-rest' && s.beat !== 'ch4-vigil') return null;
    const phase = getCurrentDayPhase();
    if (phase < DUSK.nightStart || phase > DUSK.nightEnd) return null;
    if (!nearCampfire(position)) return null;
    return {
      id: 'story-rest',
      verb: 'Rest',
      perform: s.beat === 'ch4-vigil' ? beginVigilSleep : beginA3
    };
  });
}

/** The campfire rest — begins the A3 material awakening. */
export function beginA3(): void {
  const s = getStoryStateSnapshot();
  if (!s.active || s.beat !== 'ch3-await-rest') return;
  playSfx('storySleep');
  advanceToBeat('a3-dawn');
}

/** The scheduled sleep — the vigil's ordered rest brings the auditor's dawn. */
export function beginVigilSleep(): void {
  const s = getStoryStateSnapshot();
  if (!s.active || s.beat !== 'ch4-vigil') return;
  playSfx('storySleep');
  markMilestone(STORY_MILESTONES.ch4Vigil);
  advanceToBeat('ch4-arrival');
}

let lastBeat: StoryBeat | null = null;
function syncBeat(): void {
  const s = getStoryStateSnapshot();
  const beat = s.active ? s.beat : null;
  if (beat !== lastBeat) {
    lastBeat = beat;
    onBeatEntered(beat);
  }
  // Deactivation (quit to menu / completion) drops the live rest resolver and
  // fades the score out (the sandbox owns its own music).
  if (!s.active) {
    setScoreBeat(null);
    if (s.chapter !== 'complete') clearLifeReveal(); // quit mid-cutscene: no stuck wave
    if (d.restUnregister) {
      d.restUnregister();
      d.restUnregister = null;
    }
  }
}
subscribeStory(syncBeat);
// Deep links activate the story BEFORE this module loads — catch up immediately.
syncBeat();

// Quota completion (in the raster side-scroller) opens the belt-scroll era.
subscribeInventory(() => {
  const s = getStoryStateSnapshot();
  if (!s.active || s.beat !== 'ch1-raster') return;
  if (quotaCollected().met) {
    markMilestone(STORY_MILESTONES.ch1Quota);
    advanceToBeat('ch1-depth');
  }
});

// The first campfire brings the first dusk (fire before dark — earned warmth),
// and the story acknowledges the act immediately.
subscribeCampfires(() => {
  const s = getStoryStateSnapshot();
  if (!s.active || s.chapter !== 'ch3') return;
  if (getCampfires().length === 0) return;
  fireCaptionOnce('fire-built', CH3_CAPTIONS.fireBuilt);
  if (s.beat === 'ch3-gather') advanceToBeat('ch3-dusk');
});

// --- external triggers (story world props call these) ----------------------------

/** True once ch1-anomaly's calibration sweep has returned the deviation —
 *  the marker, the [F] Touch, and beginA1 all gate on it (one goal at a time). */
export function anomalyMassDesignated(): boolean {
  return d.anomalyMassStage;
}

/** True once the designation has LANDED (order read, marker seen) — the
 *  stone's [F] and beginA1 gate here, one stage after the marker appears. */
export function anomalyTouchArmed(): boolean {
  return d.anomalyMassStage
    && d.beatClock >= d.anomalyDesignatedAt + ANOMALY_SURVEY.armSeconds;
}

/** The anomaly stone's [F] Touch — begins the A1 chroma awakening. */
export function beginA1(): void {
  const s = getStoryStateSnapshot();
  if (!s.active || s.beat !== 'ch1-anomaly') return;
  if (!anomalyTouchArmed()) return; // sweep → designation → THEN the answer
  advanceToBeat('a1-ramp');
}

/** The apple's [F] Eat — begins the A2 depth awakening (timeline lands in P4). */
export function beginA2(): void {
  const s = getStoryStateSnapshot();
  if (!s.active || s.beat !== 'ch2-approach') return;
  advanceToBeat('a2-awakening');
}

// --- per-frame tick ---------------------------------------------------------------

function smoothstep(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

function tickCh1Flashes(dt: number): void {
  d.ch1Clock += dt;
  // Never inside a beat's opening seconds: era hand-offs land CLEAN — one
  // thing at a time (the flashes were stacking onto rig lerps and new orders).
  if (d.beatClock < 4) return;
  const { total } = quotaCollected();
  CH1_FLASH_SCHEDULE.forEach((flash, i) => {
    if (d.flashesFired[i]) return;
    const timeDue = d.ch1Clock >= flash.atSeconds;
    const quotaDue = flash.afterQuotaCount != null && total >= flash.afterQuotaCount;
    if (timeDue || quotaDue) {
      d.flashesFired[i] = true;
      d.flashFramesLeft = 2;
      d.glitchDecay = 0.85;
      playSfx('storyGlitch');
    }
  });
}

// ch1-anomaly stage 1 → 2: the calibration sweep. The pan-tilt era's verb is
// LOOKING — the view must traverse the compass before the survey "finds" the
// mass. Sector visits come straight off the live camera; a time fallback keeps
// direct jumps and stuck screenings moving.
const _surveyDir = new THREE.Vector3();

function tickAnomalySurvey(camera: THREE.PerspectiveCamera | null): void {
  if (d.anomalyMassStage) return;
  if (camera) {
    camera.getWorldDirection(_surveyDir);
    const angle = Math.atan2(_surveyDir.x, _surveyDir.z) + Math.PI; // 0..2π
    const sector = Math.min(
      ANOMALY_SURVEY.sectors - 1,
      Math.floor((angle / (Math.PI * 2)) * ANOMALY_SURVEY.sectors)
    );
    d.anomalySectorsSeen.add(sector);
  }
  const swept = d.anomalySectorsSeen.size >= ANOMALY_SURVEY.required
    && d.beatClock >= ANOMALY_SURVEY.minSeconds;
  if (swept || d.beatClock >= ANOMALY_SURVEY.fallbackSeconds) {
    // STAGE 2: the deviation is returned — the marker + order land FIRST;
    // the touch arms armSeconds later (stages never stack).
    d.anomalyMassStage = true;
    d.anomalyDesignatedAt = d.beatClock;
    d.glitchDecay = 0.55;
    playSfx('storyGlitch');
    setWorkOrder([...CH1_ANOMALY_MASS_ORDER]);
  }
}

function tickA1Ramp(): void {
  const t = d.beatClock / A1_RAMP_SECONDS;
  if (t >= 1) {
    // Land EXACTLY on the color preset (chroma 1) — the stage cut is seamless.
    setVoxelRealityStage('color');
    clearVoxelRealityOverrides();
    const r = getFeedRuntime();
    r.desat = 0;
    r.glitch = 0;
    markMilestone(STORY_MILESTONES.a1);
    scoreHit('bloom'); // color arrives as a chord opening
    advanceToBeat('ch2-color');
    return;
  }
  // Chroma climbs; a seeded square-wave flicker drops it out, dense early.
  const base = smoothstep(t);
  const dropoutChance = t < 0.4 ? 0.30 : t < 0.75 ? 0.12 : 0;
  const dropped = d.a1FlickerNoise() < dropoutChance;
  const chroma = dropped ? Math.max(0, base - 0.85) : base;
  overrideVoxelRealityEffects({ chroma });
  setScoreIntensity(0.4 + base * 0.6); // the riser rides the chroma itself
  const r = getFeedRuntime();
  r.desat = 1 - chroma;
  r.glitch = dropped ? 0.7 : Math.max(0, r.glitch - 0.1);
  r.scanRoll = dropped ? 0.5 : Math.max(0, r.scanRoll - 0.06);
}

// A2 — the depth awakening. Four movements: the system panics (violation flood),
// the system dies (HUD death), the world opens (liberation: look/FOV/treatment
// lerp), and the handoff into free 3D. ~12 seconds that the whole game is about.
function tickA2(): void {
  const t = d.beatClock;
  const T = A2_TIMELINE;
  const r = getFeedRuntime();
  const floodEnd = T.violationFloodSeconds;
  const deathEnd = floodEnd + T.hudDeathSeconds;
  const libEnd = deathEnd + T.liberationSeconds;

  if (t < floodEnd) {
    if (t >= d.a2NextViolationAt && d.a2ViolationIndex < A2_VIOLATION_LINES.length) {
      pushViolation(A2_VIOLATION_LINES[d.a2ViolationIndex++]);
      playSfx('terminalAlarm');
      d.a2NextViolationAt = t + Math.max(0.07, 0.4 - 0.33 * (t / floodEnd));
    }
    r.glitch = Math.max(r.glitch, 0.3 + 0.4 * (t / floodEnd));
    r.garble = 0.15 + 0.45 * (t / floodEnd);
    r.redaction.visible = false;
    return;
  }
  if (t < deathEnd) {
    const k = (t - floodEnd) / T.hudDeathSeconds;
    r.garble = 1;
    r.glitch = 0.8 * (1 - k);
    r.scanRoll = 0.9 * (1 - k);
    r.redaction.visible = false;
    if (!d.a2HudDead && k > 0.55) {
      d.a2HudDead = true;
      setWorkOrder([]);
      clearViolations();
      // Snap to device resolution NOW, in one step, while the glitch chaos
      // masks it — a lerped dpr would reallocate framebuffers repeatedly right
      // through the liberation (the exact hitches a cutscene can't afford).
      setStoryTargetDpr(null);
    }
    return;
  }
  if (t < libEnd) {
    if (!d.captionsFired.has('a2-awaken-sfx')) {
      d.captionsFired.add('a2-awaken-sfx');
      playSfx('storyAwaken');
      scoreHit('braam'); // the wall of the feed gives way
    }
    const k = smoothstep((t - deathEnd) / T.liberationSeconds);
    // (The look is already free — ch2 runs unlocked since the A1 interlock
    // fault — so the liberation is carried by the FOV, the treatment, and the
    // resolution, not by a camera cage opening.)
    setStoryTargetFov(FEED_FOV + (SANDBOX_FOV - FEED_FOV) * k);
    setScoreIntensity(0.5 + k * 0.5); // the liberation IS the crescendo
    r.treatment = 1 - k;
    r.garble = 0;
    r.glitch = 0;
    r.scanRoll = 0;
    setStoryForcedDayPhase(0.25); // regulation noon holds through the reveal
    const sinceUnfreeze = t - deathEnd - T.unfreezeAtSeconds;
    if (sinceUnfreeze >= 0) setStoryMoveScale(Math.min(1, sinceUnfreeze / 1.5));
    return;
  }
  // Handoff (one shot): feed gone, device resolution, chapter 3 begins.
  setStoryLookMode('free');
  setStoryTargetDpr(null);
  r.treatment = 0;
  markMilestone(STORY_MILESTONES.a2);
  scoreHit('bloom'); // depth resolves into the warm chapter-3 key
  advanceToBeat('ch3-gather');
}

// The crash landing (~8.5s), watched from the ground in the raster lens: the
// pod streaks down the 2D frame, impact flashes white, and the smoking wreck
// becomes the first landmark of the strip the player is about to work.
const DESCENT_SECONDS = 8.5;
const DESCENT_IMPACT_AT = 4.5;

function tickDescent(dt: number): void {
  const t = d.beatClock;
  const r = getFeedRuntime();
  r.cinematic = envelope(t, 0, 0.8, DESCENT_SECONDS - 1.5, DESCENT_SECONDS);
  r.descent = Math.min(1.1, t / DESCENT_IMPACT_AT);
  // Tension climbs with the fall; the impact is the score's first boom.
  setScoreIntensity(Math.min(1, 0.4 + (t / DESCENT_IMPACT_AT) * 0.6));
  if (!d.descentImpacted && t >= DESCENT_IMPACT_AT) {
    d.descentImpacted = true;
    r.flash = 1;
    r.glitch = 1;
    r.scanRoll = 0.8;
    playSfx('shipCrash');
    scoreHit('boom');
    scoreHit('braam');
  }
  r.flash = Math.max(0, r.flash - dt * 1.4);
  r.glitch = Math.max(0, r.glitch - dt * 0.9);
  r.scanRoll = Math.max(0, r.scanRoll - dt * 0.7);
  if (t >= DESCENT_SECONDS) {
    r.descent = 1.1;
    advanceToBeat('ch1-fixed');
  }
}

// The TRACKING unbolt (~7s): the bolted frame learns to follow the worker — the
// rig blend (quantized anchor → continuous follow) IS the whole cutscene.
const TRACK_SECONDS = 7;

function tickTrackUnlock(): void {
  const t = d.beatClock;
  const r = getFeedRuntime();
  r.cinematic = envelope(t, 0, 0.8, TRACK_SECONDS - 1.4, TRACK_SECONDS);
  if (t >= TRACK_SECONDS) {
    markMilestone(STORY_MILESTONES.ch1Track);
    advanceToBeat('ch1-raster');
  }
}

// The 2D→3D LIFT (~7s): the camera physically travels from the side-scroller
// vantage INTO the worker's eyes while the world rotates from profile to first
// person — the single transition where the geometry of perception changes.
const LIFT_SECONDS = 7;

function tickCh1Lift(): void {
  const t = d.beatClock;
  const r = getFeedRuntime();
  const lens = getSideLens();

  // Letterbox frames the whole traverse; releases as the feed HUD returns.
  r.cinematic = envelope(t, 0, 1, LIFT_SECONDS - 1.6, LIFT_SECONDS);

  // The first-person endpoint should face down the strip the player just
  // worked: pull the (dormant) free-look refs toward it while the blend runs.
  if (lens) {
    d.liftLookTarget
      .copy(getPlayerWorldPosition())
      .addScaledVector(lens.travelAxis, getSideFacing() * 14)
      .addScaledVector(lens.up, 1.2);
    setCinematicLookTarget(d.liftLookTarget);
    setCinematicLookWeight(envelope(t, 0, 0.8, LIFT_SECONDS - 2, LIFT_SECONDS - 0.5));
  }

  // The traverse itself: profile → eyes over the middle 4.5 seconds.
  const liftBlend = smoothstep(Math.min(1, Math.max(0, (t - 1.2) / 4.5)));
  setStorySideBlend(liftBlend);
  // Consciousness arrives WITH the perspective: impersonal all the way in,
  // then the first pronoun in the story — one flicker before the feed clamps.
  if (t >= 2.4) fireCaptionOnce('lift-inward', 'the seeing is being moved inside.');
  if (t >= 5.4) fireCaptionOnce('lift-i', 'i—');
  setScoreIntensity(0.35 + liftBlend * 0.65); // the score rises with the camera

  // Mid-lift, one glitch pulse masks the single resolution snap (never lerp
  // dpr — framebuffer reallocation is a hitch a cutscene can't afford).
  if (!d.liftSnapped && t >= 1.2 + 4.5 * 0.5) {
    d.liftSnapped = true;
    setStoryTargetDpr(FEED_DPR);
    r.glitch = 0.8;
    r.scanRoll = 0.5;
    playSfx('storyGlitch');
    scoreHit('braam'); // perspective is being issued
  }
  r.glitch = Math.max(0, r.glitch - 0.02);
  r.scanRoll = Math.max(0, r.scanRoll - 0.015);

  if (t >= LIFT_SECONDS) {
    setStorySideBlend(1);
    advanceToBeat('ch1-anomaly'); // entry pulses + sets the pan-tilt work order
  }
}

/** One-shot captions keyed on beat+index (survive re-entry without repeating). */
function fireCaptionOnce(key: string, text: string): void {
  if (d.captionsFired.has(key)) return;
  d.captionsFired.add(key);
  d.lastCaptionAt = d.elapsedSeconds; // musings wait for a genuine lull
  showCaption(text);
}

/** One-shot AUDIT-band lines (the post-feed regulation voice). */
function fireAuditOnce(key: string, text: string, header?: string): void {
  if (d.captionsFired.has(key)) return;
  d.captionsFired.add(key);
  d.lastCaptionAt = d.elapsedSeconds;
  showAuditLine(text, header);
}

/** Trapezoid envelope: 0→1 over [inStart..inEnd], 1, then 1→0 over [outStart..outEnd]. */
function envelope(t: number, inStart: number, inEnd: number, outStart: number, outEnd: number): number {
  if (t <= inStart) return 0;
  if (t < inEnd) return (t - inStart) / (inEnd - inStart);
  if (t <= outStart) return 1;
  if (t < outEnd) return 1 - (t - outStart) / (outEnd - outStart);
  return 0;
}

/** Seconds the dusk cutscene holds the frame (camera pull + letterbox + freeze). */
const DUSK_CUTSCENE_SECONDS = 8;

// Chapter 3's sun: the director owns the forced phase through the scripted first
// dusk and the night, releasing it to the live world clock only at completion —
// so the cycle works identically on every graphics tier (non-animated profiles
// never advance the clock on their own).
function tickCh3Sun(dt: number): void {
  const s = getStoryStateSnapshot();
  if (s.beat === 'ch3-dusk') {
    const k = smoothstep(Math.min(1, d.beatClock / DUSK.lerpSeconds));
    d.dayPhase = 0.25 + (DUSK.targetPhase - 0.25) * k;
    // The cutscene: bars in, camera pulled to the setting sun, feet held — then
    // everything hands back while the light keeps leaving.
    const t = d.beatClock;
    getFeedRuntime().cinematic = envelope(t, 0, 1.2, 6, DUSK_CUTSCENE_SECONDS);
    setCinematicLookWeight(envelope(t, 0.2, 1.6, 5, 7));
    // Strings swell while the story holds the camera, then settle to dusk.
    setScoreIntensity(0.35 + envelope(t, 0, 2.5, 5.5, DUSK_CUTSCENE_SECONDS) * 0.65);
    if (t >= 6) setStoryMoveScale(Math.min(1, (t - 6) / 1.5));
    tickStoryChill(dt, 0.85);
    if (d.beatClock >= DUSK.lerpSeconds) advanceToBeat('ch3-await-rest');
  } else if (s.beat === 'ch3-await-rest') {
    d.dayPhase += dt / DAY_LENGTH_SECONDS; // the cycle rolls naturally into night
    // The senses cannot be missed: a fast fire skips the gather dwell, so the
    // introductions re-offer here, by the fire, waiting for dark.
    if (d.beatClock >= 3 && !d.captionsFired.has('sense-hold')) {
      fireCaptionOnce('sense-hold', 'things can be held. kept against later.');
      markMilestone(STORY_MILESTONES.senseInventory);
    }
    if (d.beatClock >= 8 && !d.captionsFired.has('sense-temp')) {
      fireCaptionOnce('sense-temp', 'warmth. i have it. it is leaving.');
      markMilestone(STORY_MILESTONES.senseTemp);
    }
    tickStoryChill(dt, 1.15); // night bites harder; the fire answers
    if (!d.captionsFired.has('night') && d.dayPhase >= DUSK.nightStart) {
      fireCaptionOnce('night', CH3_CAPTIONS.night);
    }
    // A beat later, the explicit nudge — rest is the ONLY forward action left.
    if (!d.captionsFired.has('rest-hint') && d.dayPhase >= DUSK.nightStart + 0.015) {
      fireCaptionOnce('rest-hint', CH3_CAPTIONS.restPrompt);
    }
  }
  setStoryForcedDayPhase(d.dayPhase);
}

// A3 — the material awakening. Sleep-fade to black, wake just before sunrise,
// and let texture arrive WITH the light: every effect family lerps from the
// `color` preset toward `material` as the sun crests.
function tickA3(dt: number): void {
  const t = d.beatClock;
  const T = A3_TIMELINE;
  const r = getFeedRuntime();
  const wakeAt = T.sleepFadeSeconds + T.holdBlackSeconds;
  const rampStart = wakeAt + T.fadeUpSeconds;
  const rampEnd = rampStart + T.materialRampSeconds;

  if (t < T.sleepFadeSeconds) {
    r.sleepFade = smoothstep(t / T.sleepFadeSeconds);
    return;
  }
  if (t < wakeAt) {
    r.sleepFade = 1;
    if (!d.a3Woke) {
      d.a3Woke = true;
      d.dayPhase = T.wakePhase; // just before sunrise, in the dark
      setStoryMoveScale(1); // wake able to walk into the dawn
    }
    setStoryForcedDayPhase(d.dayPhase);
    return;
  }
  // Dawn advances in real time through fade-up and the ramp — framed like the
  // dusk (letterbox + a gentle pull toward the rising sun as the eyes open).
  d.dayPhase = (d.dayPhase + dt / DAY_LENGTH_SECONDS) % 1;
  setStoryForcedDayPhase(d.dayPhase);
  r.cinematic = envelope(t, wakeAt, wakeAt + 1.5, rampEnd, rampEnd + 3);
  setCinematicLookWeight(envelope(t, wakeAt + 0.5, wakeAt + 2, wakeAt + 5, wakeAt + 7));
  if (t < rampStart) {
    r.sleepFade = 1 - smoothstep((t - wakeAt) / T.fadeUpSeconds);
    return;
  }
  r.sleepFade = 0;
  const k = smoothstep(Math.min(1, (t - rampStart) / T.materialRampSeconds));
  setScoreIntensity(0.3 + k * 0.7); // the dawn build rides the material ramp
  {
    // The sun gives the warmth back (the chill was the night's, not the world's).
    const v = getVitals();
    if (v.warmth < 100) setVitals({ warmth: Math.min(100, v.warmth + dt * 4) });
  }
  const target = VOXEL_REALITY_PRESETS.material;
  overrideVoxelRealityEffects({
    detail: target.detail * k,
    organic: target.organic * k,
    atmosphere: target.atmosphere * k,
    thermal: target.thermal * k,
    crystalline: target.crystalline * k,
    metal: target.metal * k
  });

  // THE BLOOM WAVE: the living world GROWS, radially, from where the player
  // slept. The reveal is armed at radius 0 the moment the ramp begins (so the
  // fields un-cull into invisibility — never a pop), holds while the grain
  // captions land, then the front races outward: blades rise around the feet
  // first, slow enough to watch, then the wave accelerates to the horizon.
  const waveStart = rampStart + T.bloomWaveDelaySeconds;
  const waveEnd = waveStart + T.bloomWaveSeconds;
  if (d.bloomCenter.lengthSq() < 1e-6) {
    const fire = getCampfires()[0];
    if (fire) d.bloomCenter.set(fire.pos[0], fire.pos[1], fire.pos[2]);
    else d.bloomCenter.copy(getPlayerWorldPosition());
  }
  if (t < waveStart) {
    setLifeReveal(d.bloomCenter, 0, 1);
  } else {
    if (!d.captionsFired.has('a3-bloom-hit')) {
      d.captionsFired.add('a3-bloom-hit');
      scoreHit('bloom'); // the first blade rises on a bloom
    }
    const wk = smoothstep(Math.min(1, (t - waveStart) / T.bloomWaveSeconds));
    const radius = T.bloomWaveRadius * Math.pow(wk, 1.6); // linger near, race far
    setLifeReveal(d.bloomCenter, radius, 5 + radius * 0.18);
  }

  A3_CAPTIONS.forEach((caption, i) => {
    if (t >= wakeAt + caption.atSeconds) fireCaptionOnce(`a3-${i}`, caption.text);
  });
  if (t >= Math.max(rampEnd + 4, waveEnd + 1.5) && d.captionsFired.has(`a3-${A3_CAPTIONS.length - 1}`)) {
    // Land EXACTLY on the material preset. The story no longer ends here: the
    // first day alive begins with NO CUT AT ALL — the score resolves and thins,
    // and only the world remains. (The sun stays the director's through the
    // tail; the live clock takes over at the arrival's end.)
    setVoxelRealityStage('material');
    clearVoxelRealityOverrides();
    clearLifeReveal();
    markMilestone(STORY_MILESTONES.a3);
    scoreHit('bloom'); // texture arrives; the score resolves major and recedes
    advanceToBeat('ch3-thirst');
  }
}

// --- the first day alive (ch3's tail: thirst → forage → the klaxon) -------------------

/** The tail's sun: the director keeps the phase, advancing it in real time. */
function advanceFirstDayPhase(dt: number): void {
  d.dayPhase = (d.dayPhase + dt / DAY_LENGTH_SECONDS) % 1;
  setStoryForcedDayPhase(d.dayPhase);
}

// Ambient musings (owner-directed): quiet epiphanies during LULLS — one per
// ~45–75s of caption silence, one-shot PER SAVE (milestone-latched, so a
// resumed save never repeats itself), never blocking anything.
const musingNoise = mulberry32(0x9e21);

function tickMusings(): void {
  if (d.beatClock < 12) return; // each beat's own opening lands first
  if (d.elapsedSeconds - d.lastCaptionAt < d.musingGap) return;
  for (const musing of MUSINGS) {
    const id = `story:musing:${musing.id}`;
    if (hasMilestone(id)) continue;
    markMilestone(id);
    d.lastCaptionAt = d.elapsedSeconds;
    d.musingGap = MUSING_GAP_SECONDS[0]
      + (MUSING_GAP_SECONDS[1] - MUSING_GAP_SECONDS[0]) * musingNoise();
    showCaption(musing.text, 6500);
    return;
  }
}

/** Shared by the tail beats: the waterskin's first fill earns its line. */
function tickWaterskinFilled(): void {
  const fill = getWaterskinFill();
  if (d.prevWaterskin === 0 && fill > 0) {
    fireCaptionOnce('day-skin-filled', FIRST_DAY_CAPTIONS.waterskinFilled);
  }
  d.prevWaterskin = fill;
}

// S1 — THIRST: the first unsupervised morning files the body's first request.
function tickThirst(dt: number): void {
  advanceFirstDayPhase(dt);
  const t = d.beatClock;
  if (t >= FIRST_DAY.freedomAt) fireCaptionOnce('day-freedom', FIRST_DAY_CAPTIONS.freedom);
  if (t >= FIRST_DAY.thirstCueAt) fireCaptionOnce('day-thirst-felt', FIRST_DAY_CAPTIONS.thirstFelt);
  if (t >= FIRST_DAY.thirstNameAt) {
    fireCaptionOnce('day-thirst-named', FIRST_DAY_CAPTIONS.thirstNamed);
    markMilestone(STORY_MILESTONES.senseWater); // the THIRST row lands with its name
  }
  if (t >= FIRST_DAY.seekAt) fireCaptionOnce('day-seek', FIRST_DAY_CAPTIONS.seek);
  if (t >= FIRST_DAY.chartHintAt) fireCaptionOnce('day-chart', FIRST_DAY_CAPTIONS.chartHint);
  // The drink: a discrete thirst RISE (pond mouthfuls or a filled skin).
  const v = getVitals();
  if (t > 1 && d.prevThirst >= 0 && v.thirst - d.prevThirst >= FIRST_DAY.drinkJump) {
    markMilestone(STORY_MILESTONES.senseWater); // even a drink ahead of the cue names it
    markMilestone(STORY_MILESTONES.ch3Drank);
    fireCaptionOnce('day-drank', FIRST_DAY_CAPTIONS.drank);
    advanceToBeat('ch3-forage');
  }
  d.prevThirst = v.thirst;
  tickWaterskinFilled();
  tickMusings();
}

// S2 — HUNGER (stage 1): the drink wakes its sibling; the world sets the table.
function tickForage(dt: number): void {
  advanceFirstDayPhase(dt);
  const t = d.beatClock;
  if (
    t >= FIRST_DAY.waterskinNudgeAt
    && getItemCount('waterskin') === 0
  ) {
    fireCaptionOnce('day-skin-nudge', FIRST_DAY_CAPTIONS.waterskinNudge);
  }
  if (t >= FIRST_DAY.hungerCueAt) {
    fireCaptionOnce('day-hunger-named', FIRST_DAY_CAPTIONS.hungerNamed);
    markMilestone(STORY_MILESTONES.senseFood); // the FOOD row lands with its name
  }
  if (t >= FIRST_DAY.forageSightAt) fireCaptionOnce('day-forage-sight', FIRST_DAY_CAPTIONS.forageSight);
  if (t >= FIRST_DAY.eatHintAt && getItemCount('berry') + getItemCount('root') > 0) {
    fireCaptionOnce('day-eat-hint', FIRST_DAY_CAPTIONS.eatHint);
  }
  // The first meal: a discrete hunger RISE.
  const v = getVitals();
  if (t > 1 && d.forageAteAt < 0 && d.prevHunger >= 0 && v.hunger - d.prevHunger >= FIRST_DAY.eatJump) {
    d.forageAteAt = t;
    markMilestone(STORY_MILESTONES.senseFood);
    markMilestone(STORY_MILESTONES.ch3Ate);
    fireCaptionOnce('day-ate', FIRST_DAY_CAPTIONS.ate);
  }
  d.prevHunger = v.hunger;
  if (d.forageAteAt >= 0) {
    if (t >= d.forageAteAt + FIRST_DAY.pillarAfterEat) {
      fireCaptionOnce('day-pillar', FIRST_DAY_CAPTIONS.pillar);
    }
    if (t >= d.forageAteAt + FIRST_DAY.pillarAfterEat + FIRST_DAY.advanceAfterPillar) {
      advanceToBeat('ch3-signal');
    }
  }
  tickWaterskinFilled();
  tickMusings();
}

// S3 — STAMINA + the ch4 bridge: the klaxon. Sound travels before meaning; the
// regulation voice returns as TEXT ON AIR (the AUDIT band), never as the feed.
function tickSignal(dt: number): void {
  const t = d.beatClock;
  // The afternoon turns: golden hour arrives WITH the summons.
  if (t < SIGNAL.phaseLerpSeconds) {
    const k = smoothstep(t / SIGNAL.phaseLerpSeconds);
    d.dayPhase = d.signalPhaseFrom + (SIGNAL.phaseTarget - d.signalPhaseFrom) * k;
    setStoryForcedDayPhase(d.dayPhase);
  } else {
    advanceFirstDayPhase(dt);
  }
  // Three klaxon tones from the wreck.
  if (d.signalKlaxons < SIGNAL.klaxonRepeats && t >= d.signalKlaxons * SIGNAL.klaxonGapSeconds) {
    d.signalKlaxons++;
    playSfx('terminalAlarm');
  }
  if (t >= SIGNAL.carrierAt) fireAuditOnce('sig-carrier', SIGNAL_LINES.carrier);
  if (t >= SIGNAL.orderAt) fireAuditOnce('sig-order', SIGNAL_LINES.order);
  if (t >= SIGNAL.runCueAt) fireCaptionOnce('sig-run', SIGNAL_LINES.runCue);
  // The sprint names STAMINA once it has visibly spent something.
  const v = getVitals();
  if (!hasMilestone(STORY_MILESTONES.senseStamina) && v.stamina <= SIGNAL.staminaCueBelow) {
    markMilestone(STORY_MILESTONES.senseStamina);
    fireCaptionOnce('sig-stamina', SIGNAL_LINES.staminaNamed);
  }
  if (hasMilestone(STORY_MILESTONES.senseStamina) && isStaminaExhausted()) {
    fireCaptionOnce('sig-floor', SIGNAL_LINES.exhausted);
  }
  setScoreIntensity(Math.min(1, 0.45 + t * 0.02));
  // Arrived: the network logs the response time; the vigil begins. The gate
  // waits for the summons itself — a worker already standing at the wreck
  // still hears the whole order before the scene resolves.
  if (t >= SIGNAL.runCueAt + 1.5 && wreckRelayHandle.position
    && getPlayerWorldPosition().distanceTo(wreckRelayHandle.position) <= SIGNAL.relayReach) {
    fireAuditOnce('sig-logged', SIGNAL_LINES.logged);
    markMilestone(STORY_MILESTONES.ch3Signal);
    advanceToBeat('ch4-vigil');
  }
}

// S4 — the vigil: ch3's tender rest re-issued as an order. Same verb, inverted.
function tickVigil(dt: number): void {
  const t = d.beatClock;
  if (t < VIGIL.duskLerpSeconds) {
    const k = smoothstep(t / VIGIL.duskLerpSeconds);
    d.dayPhase = d.vigilPhaseFrom + (DUSK.targetPhase - d.vigilPhaseFrom) * k;
    setStoryForcedDayPhase(d.dayPhase);
  } else {
    advanceFirstDayPhase(dt); // the cycle rolls into the scheduled dark
  }
  if (t >= VIGIL.linesStartAt) fireAuditOnce('vig-dispatched', VIGIL_LINES.dispatched);
  if (t >= VIGIL.linesStartAt + VIGIL.lineGapSeconds) fireAuditOnce('vig-remain', VIGIL_LINES.remain);
  if (t >= VIGIL.linesStartAt + VIGIL.lineGapSeconds * 2) fireAuditOnce('vig-scheduled', VIGIL_LINES.scheduled);
  if (t >= VIGIL.darkAsideAt) fireCaptionOnce('vig-aside', VIGIL_LINES.darkAside);
  tickStoryChill(dt, 0.9); // the second night bites; the fire still answers
  if (!d.captionsFired.has('vig-rest') && d.dayPhase >= DUSK.nightStart) {
    fireCaptionOnce('vig-rest', VIGIL_LINES.restPrompt);
  }
  tickMusings();
}

// S5 — the arrival: dawn 2, and the letterbox returns WITH the system's agent.
const _arrLook = new THREE.Vector3();
const _arrSeg = new THREE.Vector3();

/** Place the auditor at normalized progress u along his surface-snapped path. */
function placeAuditWorker(u: number): void {
  const path = storyAnchors.auditPath;
  const worker = getAuditWorkerPose();
  if (!path || path.length < 2) return;
  let total = 0;
  for (let i = 1; i < path.length; i++) total += path[i].position.distanceTo(path[i - 1].position);
  let remaining = Math.min(1, Math.max(0, u)) * total;
  worker.stride = remaining; // stride distance drives the metronome gait
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const len = a.position.distanceTo(b.position);
    if (remaining <= len || i === path.length - 1) {
      const k = len > 1e-6 ? Math.min(1, remaining / len) : 0;
      worker.position.copy(a.position).lerp(b.position, k);
      worker.up.copy(a.up).lerp(b.up, k).normalize();
      _arrSeg.copy(b.position).sub(a.position);
      if (_arrSeg.lengthSq() > 1e-6) worker.heading.copy(_arrSeg.normalize());
      return;
    }
    remaining -= len;
  }
}

function tickArrival(dt: number): void {
  const t = d.beatClock;
  const T = ARRIVAL;
  const r = getFeedRuntime();
  if (!d.arrivalWoke) {
    d.arrivalWoke = true;
    d.dayPhase = T.wakePhase; // just before sunrise 2 — he comes out of the light
  }
  if (t < T.holdBlackSeconds) {
    r.sleepFade = 1;
    setStoryForcedDayPhase(d.dayPhase);
    return;
  }
  advanceFirstDayPhase(dt);
  r.sleepFade = Math.max(0, 1 - (t - T.holdBlackSeconds) / T.fadeUpSeconds);
  // The first letterbox since A3 — cinema grammar returns with its agent.
  r.cinematic = envelope(t, T.holdBlackSeconds, T.holdBlackSeconds + 1.5, T.endAt - 2, T.endAt);

  // The auditor walks his straight lines, ridge → relay.
  const worker = getAuditWorkerPose();
  const u = (t - T.walkStartAt) / T.walkSeconds;
  if (t >= T.walkStartAt - 1.5) {
    placeAuditWorker(u);
    worker.visible = true;
    worker.walk = u > 0 && u < 1 ? 1 : 0;
    if (u >= 1) {
      // Standing at the relay, he faces the anomalous worker. He waits.
      d.workerScratch.copy(getPlayerWorldPosition()).sub(worker.position);
      if (d.workerScratch.lengthSq() > 0.5) worker.heading.copy(d.workerScratch.normalize());
    }
    // The camera stays on him for the whole approach — the arrival IS the
    // shot — and releases only after he has spoken.
    _arrLook.copy(worker.position).addScaledVector(worker.up, 1.4);
    setCinematicLookTarget(_arrLook);
    setCinematicLookWeight(
      envelope(t, T.holdBlackSeconds + 1, T.holdBlackSeconds + 2.5, T.zeroAt, T.zeroAt + 3)
    );
  }
  if (t >= T.freezeUntilSeconds) setStoryMoveScale(Math.min(1, (t - T.freezeUntilSeconds) / 1.5));

  if (t >= T.someoneAt) fireCaptionOnce('arr-someone', ARRIVAL_CAPTIONS.someone);
  if (t >= T.gaitAt) fireCaptionOnce('arr-gait', ARRIVAL_CAPTIONS.gait);
  if (t >= T.foundAt) fireAuditOnce('arr-found', ARRIVAL_LINES.found, ARRIVAL_LINES.header);
  if (t >= T.zeroAt) fireAuditOnce('arr-zero', ARRIVAL_LINES.zero, ARRIVAL_LINES.header);
  // The bare-blink: two frames of HIS seeing (the ch1 chroma flash, inverted).
  if (t >= T.blinkAt && !d.captionsFired.has('arr-blink')) {
    d.captionsFired.add('arr-blink');
    d.bareFramesLeft = 2;
    playSfx('storyGlitch');
  }
  if (t >= T.borrowedAt) fireCaptionOnce('arr-borrowed', ARRIVAL_CAPTIONS.borrowed);
  setScoreIntensity(0.35 + envelope(t, T.holdBlackSeconds, T.holdBlackSeconds + 6, T.endAt - 6, T.endAt) * 0.45);

  if (t >= T.endAt) {
    // Hand the sun to the live clock at dawn-2's phase (the A3 grammar).
    setDayPhaseOffset(d.dayPhase - d.elapsedSeconds / DAY_LENGTH_SECONDS);
    hideAuditWorker();
    // TEMPORARY: ch4-audit continues from here (see PARAVOXIA_CH4_PLAN.md §2 S6).
    // Until it ships, the story banks the arrival checkpoint and hands back to
    // the sandbox with the same guarantees the slice's completion gave.
    completeStory();
  }
}

/**
 * Called every R3F frame by StoryDirectorDriver (in-Canvas). `camera` is the
 * live default camera (the on-foot PerspectiveCamera while playing);
 * `elapsedSeconds` is the R3F clock (the same clock the world clock reads).
 */
export function storyDirectorTick(
  dt: number,
  camera: THREE.PerspectiveCamera | null,
  elapsedSeconds = d.elapsedSeconds + dt
): void {
  const s = getStoryStateSnapshot();
  if (!s.active) return;
  d.beatClock += dt;
  d.elapsedSeconds = elapsedSeconds;

  const r = getFeedRuntime();
  r.frame += 1;

  // FOV eases toward the policy target (feed 50 <-> free 75; A2 lerps the target).
  const policy = getStoryInputPolicy();

  // Harvester idle recharge (jetpack-style): trickles while NOT extracting,
  // flushed in whole points so the meter/save churn stays low.
  if (policy.mawRechargePerSecond > 0 && !getMiningProgress().active && getMawCharge() < MAX_MAW_CHARGE) {
    d.mawRechargeAccum += policy.mawRechargePerSecond * dt;
    if (d.mawRechargeAccum >= 1) {
      const whole = Math.floor(d.mawRechargeAccum);
      d.mawRechargeAccum -= whole;
      addMawCharge(whole);
    }
  }
  if (camera && Math.abs(camera.fov - policy.targetFov) > 0.01) {
    camera.fov += (policy.targetFov - camera.fov) * Math.min(1, 1 - Math.exp(-6 * dt));
    if (Math.abs(camera.fov - policy.targetFov) < 0.01) camera.fov = policy.targetFov;
    camera.updateProjectionMatrix();
  }

  switch (s.beat) {
    case 'descent':
      tickDescent(dt);
      break;
    case 'ch1-fixed': {
      tickCh1Flashes(dt);
      // The first tutorial: extract fiber (hold-to-mine) and cross a screen
      // edge — feeling the bolted frame hard-flip is the whole point.
      const lens = getSideLens();
      if (lens) {
        const along = _fixedRel.copy(getPlayerWorldPosition()).sub(lens.origin).dot(lens.travelAxis);
        const cell = Math.floor(along / FIXED_SCREEN_CELL);
        if (!d.fixedCells.has(cell)) {
          d.fixedCells.add(cell);
          if (d.fixedCells.size === CH1_FIXED_TUTORIAL.screens) {
            fireCaptionOnce('fixed-flip', 'The frame did not follow you. It was never going to.');
          }
        }
      }
      if (
        getItemCount('biofiber') >= CH1_FIXED_TUTORIAL.biofiber
        && d.fixedCells.size >= CH1_FIXED_TUTORIAL.screens
      ) {
        advanceToBeat('ch1-track');
      }
      break;
    }
    case 'ch1-track':
      tickTrackUnlock();
      break;
    case 'ch1-raster':
      tickCh1Flashes(dt);
      // Belt-and-braces: a resume that ARRIVES with the quota already met fires
      // no inventory event, so the watcher alone could strand the beat.
      if (quotaCollected().met) {
        markMilestone(STORY_MILESTONES.ch1Quota);
        advanceToBeat('ch1-depth');
      }
      break;
    case 'ch1-depth':
      tickCh1Flashes(dt);
      if (d.beatClock >= 3.5) {
        fireCaptionOnce('depth-word', 'the world has a depth. wait — what is "depth"? how is that word known?');
      }
      // All pods recovered (or a resume that arrives with them recovered).
      if (d.beatClock >= 1 && supplyPodsComplete()) {
        markMilestone(STORY_MILESTONES.ch1Depth);
        advanceToBeat('ch1-nav');
      }
      break;
    case 'ch1-nav':
      tickCh1Flashes(dt);
      // The ordered route complete (beacons mark fixes on proximity).
      if (d.beatClock >= 1 && navWaypointsComplete()) {
        markMilestone(STORY_MILESTONES.ch1Nav);
        advanceToBeat('ch1-iso');
      }
      break;
    case 'ch1-iso':
      tickCh1Flashes(dt);
      // Height, earned: standing at the stone means standing ON the mesa
      // (from the ground the 3D distance can never close this far). The dwell
      // floor guarantees the 45° reveal is SEEN even if the player arrives tall.
      if (d.beatClock >= 9 && anomalyStoneHandle.position
        && getPlayerWorldPosition().distanceTo(anomalyStoneHandle.position) <= 2.6) {
        markMilestone(STORY_MILESTONES.ch1Iso);
        advanceToBeat('ch1-lift');
      }
      break;
    case 'ch1-lift':
      tickCh1Lift();
      break;
    case 'ch1-anomaly':
      tickCh1Flashes(dt);
      tickAnomalySurvey(camera);
      break;
    case 'a1-ramp':
      tickA1Ramp();
      break;
    case 'a2-awakening':
      tickA2();
      break;
    case 'ch3-gather': {
      // First words of the awakening voice, timed off the A2 liberation's end.
      const libEnd = A2_TIMELINE.violationFloodSeconds + A2_TIMELINE.hudDeathSeconds + A2_TIMELINE.liberationSeconds;
      A2_CAPTIONS.forEach((caption, i) => {
        if (d.beatClock >= Math.max(0.5, caption.atSeconds - libEnd)) {
          fireCaptionOnce(`a2-${i}`, caption.text);
        }
      });
      if (d.beatClock >= 8 && !d.captionsFired.has('sense-hold')) {
        fireCaptionOnce('sense-hold', 'things can be held. kept against later.');
        markMilestone(STORY_MILESTONES.senseInventory); // the inventory appears
      }
      if (d.beatClock >= 12) fireCaptionOnce('ch3-gather', CH3_CAPTIONS.gather);
      if (d.beatClock >= 15 && !d.captionsFired.has('sense-temp')) {
        fireCaptionOnce('sense-temp', 'warmth. i have it. it is leaving.');
        markMilestone(STORY_MILESTONES.senseTemp); // TEMP appears — already draining
      }
      if (d.beatClock >= 30) {
        fireCaptionOnce('sense-chart', 'the view from above is still in here. [M]');
      }
      tickStoryChill(dt, 0.55); // the chill that motivates the fire
      // Belt-and-braces: a resume that arrives with a fire already standing
      // fires no campfire event — the dusk must still come.
      if (d.beatClock >= 2 && getCampfires().length > 0) {
        fireCaptionOnce('fire-built', CH3_CAPTIONS.fireBuilt);
        advanceToBeat('ch3-dusk');
      }
      // Fallback: if no fire gets built, the light leaves anyway (cold teaches).
      if (d.beatClock >= 180) advanceToBeat('ch3-dusk');
      break;
    }
    case 'ch3-dusk':
    case 'ch3-await-rest':
      tickCh3Sun(dt);
      break;
    case 'a3-dawn':
      tickA3(dt);
      break;
    case 'ch3-thirst':
      tickThirst(dt);
      break;
    case 'ch3-forage':
      tickForage(dt);
      break;
    case 'ch3-signal':
      tickSignal(dt);
      break;
    case 'ch4-vigil':
      tickVigil(dt);
      break;
    case 'ch4-arrival':
      tickArrival(dt);
      break;
    default:
      break;
  }

  // 2-frame full-chroma flashes (shader + DOM drop on the SAME tick — the reason
  // this runs inside the R3F frame).
  if (d.flashFramesLeft > 0) {
    overrideVoxelRealityEffects({ chroma: 1 });
    r.desat = 0;
    d.flashFramesLeft -= 1;
    if (d.flashFramesLeft === 0) {
      clearVoxelRealityOverrides();
      r.desat = 1;
    }
  }
  // 2-frame BARE drops (the auditor's eyes) — the same grammar, inverted: the
  // player's first glitch was two frames of color; his presence is two frames
  // of the old grey. Uniform writes only, no stage change, no rebuild.
  if (d.bareFramesLeft > 0) {
    overrideVoxelRealityEffects({ ...VOXEL_REALITY_PRESETS.bare });
    d.bareFramesLeft -= 1;
    if (d.bareFramesLeft === 0) clearVoxelRealityOverrides();
  }
  if (d.glitchDecay > 0 && s.beat !== 'a1-ramp') {
    r.glitch = d.glitchDecay;
    r.scanRoll = d.glitchDecay * 0.4;
    d.glitchDecay = Math.max(0, d.glitchDecay - dt * 1.6);
    if (d.glitchDecay === 0) {
      r.glitch = 0;
      r.scanRoll = 0;
    }
  }
}

// --- free-era survey marker ------------------------------------------------------------

const _markerFire = new THREE.Vector3();

/**
 * The post-feed objective designator (rendered by FreeMarker, projected by
 * StoryDirectorDriver): the current scene's quiet goal — the pond once the seek
 * cue lands, the wreck during the summons, the fire once the scheduled dark
 * arrives. Null everywhere else; the free world is not a checklist.
 */
export function storyFreeMarkerTarget(): { position: THREE.Vector3; label: string } | null {
  const s = getStoryStateSnapshot();
  if (!s.active) return null;
  switch (s.beat) {
    case 'ch3-thirst':
      return d.beatClock >= FIRST_DAY.seekAt && storyAnchors.pond
        ? { position: storyAnchors.pond.surface, label: 'water' }
        : null;
    case 'ch3-signal':
      return wreckRelayHandle.position
        ? { position: wreckRelayHandle.position, label: 'the wreck' }
        : null;
    case 'ch4-vigil': {
      if (d.dayPhase < DUSK.nightStart) return null;
      const fire = getCampfires()[0];
      if (!fire) return null;
      _markerFire.set(fire.pos[0], fire.pos[1], fire.pos[2]);
      return { position: _markerFire, label: 'rest' };
    }
    default:
      return null;
  }
}
