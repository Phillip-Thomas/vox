import type * as THREE from 'three';
import {
  clearVoxelRealityOverrides,
  overrideVoxelRealityEffects,
  setVoxelRealityStage,
  VOXEL_REALITY_PRESETS
} from '../game/systems/realityRenderSystem.ts';
import { getMilestones, markMilestone } from '../game/systems/progressionSystem.ts';
import { getItemCount, subscribeInventory } from '../game/systems/inventorySystem.ts';
import { getCampfires, subscribeCampfires } from '../game/systems/campfires.ts';
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
  setStoryFeedBlend,
  setStoryLookMode,
  setStoryMoveScale,
  setStoryTargetDpr,
  setStoryTargetFov,
  FEED_DPR,
  FEED_FOV,
  SANDBOX_FOV
} from './storyInputPolicy.ts';
import { setStoryForcedDayPhase } from './storyDayPhase.ts';
import { setCinematicLookTarget, setCinematicLookWeight } from './cinematicLook.ts';
import { getFeedRuntime, resetFeedRuntime } from './feedRuntime.ts';
import { clearViolations, pushViolation, setWorkOrder, showCaption } from './storyText.ts';
import {
  A1_RAMP_SECONDS,
  A2_CAPTIONS,
  A2_TIMELINE,
  A2_VIOLATION_LINES,
  A3_CAPTIONS,
  A3_TIMELINE,
  CH1_ECHO_LINES,
  CH1_FLASH_SCHEDULE,
  CH1_QUOTA,
  CH1_WORK_ORDERS,
  CH3_CAPTIONS,
  DUSK,
  PROLOGUE_EVENTS
} from './storyScript.ts';

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
  /** The R3F clock at the latest tick (for releasing the world clock cleanly). */
  elapsedSeconds: number;
  restUnregister: (() => void) | null;
  /** Fractional harvester recharge carried between ticks (flushed whole points). */
  mawRechargeAccum: number;
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
  elapsedSeconds: 0,
  restUnregister: null,
  mawRechargeAccum: 0
};

function quotaCollected(): { fiber: number; stone: number; total: number; met: boolean } {
  const fiber = Math.min(getItemCount('biofiber'), CH1_QUOTA.biofiber);
  const stone = Math.min(getItemCount('stone'), CH1_QUOTA.stone);
  return {
    fiber,
    stone,
    total: fiber + stone,
    met: fiber >= CH1_QUOTA.biofiber && stone >= CH1_QUOTA.stone
  };
}

/** Prologue-choice echo lines the work order appends (the system remembers). */
function echoLines(): string[] {
  const chosen = getMilestones().filter(m => m.startsWith('story:choice:'));
  if (chosen.length === 0) return [CH1_ECHO_LINES['echo-neutral']];
  const lines: string[] = [];
  for (const milestone of chosen) {
    const [, , cardId, optionId] = milestone.split(':');
    const option = PROLOGUE_EVENTS.find(c => c.id === cardId)?.options.find(o => o.id === optionId);
    const line = option ? CH1_ECHO_LINES[option.echoLineId] : undefined;
    if (line) lines.push(line);
  }
  return lines.length ? lines : [CH1_ECHO_LINES['echo-neutral']];
}

// --- beat entry ----------------------------------------------------------------

function onBeatEntered(beat: StoryBeat | null): void {
  d.beat = beat;
  d.beatClock = 0;
  // Cutscene state never survives a beat change (envelopes re-assert per frame).
  setCinematicLookWeight(0);
  setCinematicLookTarget(null);
  getFeedRuntime().cinematic = 0;
  switch (beat) {
    case 'ch1-raster':
      resetFeedRuntime();
      d.ch1Clock = 0;
      d.flashesFired = CH1_FLASH_SCHEDULE.map(() => false);
      // The construct runs standard illumination until the player earns time (A3).
      setStoryForcedDayPhase(0.25);
      // The harvester arrives CHARGED — the crash damaged it, but the cell held.
      // It degrades to the broken/refuel loop when the survival act begins (ch3).
      setMawCharge(MAX_MAW_CHARGE);
      setWorkOrder([...CH1_WORK_ORDERS.raster, ...echoLines()]);
      break;
    case 'ch1-anomaly':
      // The raster→pan-tilt upgrade announces itself with a glitch pulse.
      d.glitchDecay = 0.7;
      setWorkOrder([...CH1_WORK_ORDERS.anomaly]);
      break;
    case 'a1-ramp':
      // Movement freezes via the beat policy; the timeline below owns the visuals.
      playSfx('storyAwaken');
      break;
    case 'ch2-color':
      // Post-A1 (also the deep-link/resume entry): color is through; feed intact.
      getFeedRuntime().desat = 0;
      getFeedRuntime().treatment = 1;
      setStoryForcedDayPhase(0.25);
      setWorkOrder([
        'SENSOR FAULT: CHROMATIC CHANNEL UNSUPPRESSED',
        'A REPAIR TICKET HAS BEEN FILED (Q: 44,207)',
        'RESUME QUOTA. DO NOT LOOK AT THE COLORS.'
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
      ensureRestInteraction();
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
    if (!s.active || s.beat !== 'ch3-await-rest') return null;
    const phase = getCurrentDayPhase();
    if (phase < DUSK.nightStart || phase > DUSK.nightEnd) return null;
    if (!nearCampfire(position)) return null;
    return { id: 'story-rest', verb: 'Rest', perform: beginA3 };
  });
}

/** The campfire rest — begins the A3 material awakening. */
export function beginA3(): void {
  const s = getStoryStateSnapshot();
  if (!s.active || s.beat !== 'ch3-await-rest') return;
  playSfx('storySleep');
  advanceToBeat('a3-dawn');
}

let lastBeat: StoryBeat | null = null;
function syncBeat(): void {
  const s = getStoryStateSnapshot();
  const beat = s.active ? s.beat : null;
  if (beat !== lastBeat) {
    lastBeat = beat;
    onBeatEntered(beat);
  }
  // Deactivation (quit to menu / completion) drops the live rest resolver.
  if (!s.active && d.restUnregister) {
    d.restUnregister();
    d.restUnregister = null;
  }
}
subscribeStory(syncBeat);
// Deep links activate the story BEFORE this module loads — catch up immediately.
syncBeat();

// Quota completion (in the raster side-scroller) restores the pan-tilt feed.
subscribeInventory(() => {
  const s = getStoryStateSnapshot();
  if (!s.active || s.beat !== 'ch1-raster') return;
  if (quotaCollected().met) {
    markMilestone(STORY_MILESTONES.ch1Quota);
    advanceToBeat('ch1-anomaly');
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

/** The anomaly stone's [F] Touch — begins the A1 chroma awakening. */
export function beginA1(): void {
  const s = getStoryStateSnapshot();
  if (!s.active || s.beat !== 'ch1-anomaly') return;
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
    advanceToBeat('ch2-color');
    return;
  }
  // Chroma climbs; a seeded square-wave flicker drops it out, dense early.
  const base = smoothstep(t);
  const dropoutChance = t < 0.4 ? 0.30 : t < 0.75 ? 0.12 : 0;
  const dropped = d.a1FlickerNoise() < dropoutChance;
  const chroma = dropped ? Math.max(0, base - 0.85) : base;
  overrideVoxelRealityEffects({ chroma });
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
    }
    return;
  }
  if (t < libEnd) {
    if (!d.captionsFired.has('a2-awaken-sfx')) {
      d.captionsFired.add('a2-awaken-sfx');
      playSfx('storyAwaken');
    }
    const k = smoothstep((t - deathEnd) / T.liberationSeconds);
    setStoryFeedBlend(k);
    setStoryTargetFov(FEED_FOV + (SANDBOX_FOV - FEED_FOV) * k);
    setStoryTargetDpr(FEED_DPR + (1 - FEED_DPR) * k); // render crunch dissolves too
    r.treatment = 1 - k;
    r.garble = 0;
    r.glitch = 0;
    r.scanRoll = 0;
    setStoryForcedDayPhase(0.25); // regulation noon holds through the reveal
    const sinceUnfreeze = t - deathEnd - T.unfreezeAtSeconds;
    if (sinceUnfreeze >= 0) setStoryMoveScale(Math.min(1, sinceUnfreeze / 1.5));
    return;
  }
  // Handoff (one shot): free look, feed gone, device resolution, chapter 3 begins.
  setStoryLookMode('free');
  setStoryFeedBlend(1);
  setStoryTargetDpr(null);
  r.treatment = 0;
  markMilestone(STORY_MILESTONES.a2);
  advanceToBeat('ch3-gather');
}

/** One-shot captions keyed on beat+index (survive re-entry without repeating). */
function fireCaptionOnce(key: string, text: string): void {
  if (d.captionsFired.has(key)) return;
  d.captionsFired.add(key);
  showCaption(text);
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
    if (t >= 6) setStoryMoveScale(Math.min(1, (t - 6) / 1.5));
    if (d.beatClock >= DUSK.lerpSeconds) advanceToBeat('ch3-await-rest');
  } else if (s.beat === 'ch3-await-rest') {
    d.dayPhase += dt / DAY_LENGTH_SECONDS; // the cycle rolls naturally into night
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
  const target = VOXEL_REALITY_PRESETS.material;
  overrideVoxelRealityEffects({
    detail: target.detail * k,
    organic: target.organic * k,
    atmosphere: target.atmosphere * k,
    thermal: target.thermal * k,
    crystalline: target.crystalline * k,
    metal: target.metal * k
  });
  A3_CAPTIONS.forEach((caption, i) => {
    if (t >= wakeAt + caption.atSeconds) fireCaptionOnce(`a3-${i}`, caption.text);
  });
  if (t >= rampEnd + 4 && d.captionsFired.has(`a3-${A3_CAPTIONS.length - 1}`)) {
    // Land EXACTLY on the material preset, release the sun to the live clock,
    // and hand the world to the sandbox.
    setVoxelRealityStage('material');
    clearVoxelRealityOverrides();
    setDayPhaseOffset(d.dayPhase - d.elapsedSeconds / DAY_LENGTH_SECONDS);
    completeStory(); // marks a3 + complete, clears the forced phase
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
    case 'ch1-raster':
      tickCh1Flashes(dt);
      // Belt-and-braces: a resume that ARRIVES with the quota already met fires
      // no inventory event, so the watcher alone could strand the beat.
      if (quotaCollected().met) {
        markMilestone(STORY_MILESTONES.ch1Quota);
        advanceToBeat('ch1-anomaly');
      }
      break;
    case 'ch1-anomaly':
      tickCh1Flashes(dt);
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
      if (d.beatClock >= 12) fireCaptionOnce('ch3-gather', CH3_CAPTIONS.gather);
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
