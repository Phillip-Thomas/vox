import * as THREE from 'three';
import { getStoryStateSnapshot, STORY_MILESTONES, type StoryBeat } from './storyState.ts';
import { getAppStateSnapshot } from '../state/appState.ts';
import { getPlayerWorldPosition, getPlayerUp } from '../state/playerFrame.ts';
import { requestPlayerNudge } from './playerNudge.ts';
import { addItem, getItemCount, removeItem } from '../game/systems/inventorySystem.ts';
import { getCampfires, placeCampfire } from '../game/systems/campfires.ts';
import { drink, feed } from '../game/systems/survivalVitals.ts';
import { markMilestone } from '../game/systems/progressionSystem.ts';
import { getItem } from '../game/data/items.ts';
import { nearestForageNodeWorld } from '../components/ForageField.tsx';
import { anomalyStoneHandle } from './world/AnomalyStone.tsx';
import { signalMesaHandle } from './world/SignalMesa.tsx';
import { heroTreeHandle } from './world/HeroAppleTree.tsx';
import { wreckRelayHandle } from './world/WreckRelay.tsx';
import { storyAnchors } from './world/storyWorld.ts';
import { isSpawnSettled } from '../game/spawnSettle.ts';
import { anomalyMassDesignated, beginA1, beginA2, vigilRestReady } from './storyDirector.ts';
import { advanceToBeat } from './storyState.ts';
import { setCinematicLookTarget, setCinematicLookWeight } from './cinematicLook.ts';
import { getLensRig, getSideLens, rigMoveBasis } from './sideLens.ts';
import {
  getDebrisPositions,
  getDebrisScattered,
  isDebrisCollected,
  seedDebrisCollected
} from './debrisSalvage.ts';
import { CH1_FIXED_TUTORIAL, CH1_QUOTA } from './storyScript.ts';
import { getSupplyPodPositions, isPodCollected, seedSupplyPodsCollected } from './supplyPods.ts';
import { currentNavWaypointPosition, seedNavWaypointsReached } from './navWaypoints.ts';

// --- Story autopilot (movie mode) -----------------------------------------------
//
// Dev-only: drives the player through the whole arc so the story can be WATCHED
// and critiqued end to end. `&movie=1` (any ?story= start point) turns it on.
// The autopilot publishes a virtual gamepad that EfficientPlayer merges over the
// real keyboard, aims via the cinematic look-pull, and every beat has a TIMEOUT
// that skips ahead — anything too hard to automate cannot stall the screening.
//
// Cutscene beats (a1-ramp, a2-awakening, ch3-dusk, a3-dawn) drive themselves;
// the autopilot goes hands-off and lets them play.

export interface AutopilotControls {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  sprint: boolean;   // the klaxon run (ch3-signal)
  delete: boolean;   // hold-to-mine
  interact: boolean; // F pulses
}

const controls: AutopilotControls = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  jump: false,
  sprint: false,
  delete: false,
  interact: false
};

const MOVIE = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('movie') === '1';

export function isMovieMode(): boolean {
  return MOVIE;
}

/** Beats the autopilot actively steers (cutscenes drive themselves). */
const DRIVEN_BEATS: ReadonlySet<StoryBeat> = new Set([
  'ch1-fixed', 'ch1-raster', 'ch1-depth', 'ch1-nav', 'ch1-iso',
  'ch1-anomaly', 'ch2-color', 'ch2-approach',
  'ch3-gather', 'ch3-await-rest',
  'ch3-thirst', 'ch3-forage', 'ch3-signal', 'ch4-vigil'
]);

export function isAutopilotDriving(): boolean {
  if (!MOVIE) return false;
  const story = getStoryStateSnapshot();
  return story.active && !!story.beat && DRIVEN_BEATS.has(story.beat)
    && getAppStateSnapshot().phase === 'playing';
}

export function getAutopilotControls(): Readonly<AutopilotControls> {
  return controls;
}

// Per-beat timeouts (seconds) — the "skip what's too hard" guarantee.
const BEAT_TIMEOUT: Partial<Record<StoryBeat, number>> = {
  'ch1-fixed': 55,
  'ch1-raster': 95,
  'ch1-depth': 60,
  'ch1-nav': 75,
  'ch1-iso': 75,
  'ch1-anomaly': 62, // calibration sweep (stage 1) + the walk + dwell
  // 6s stand + ~70u walk to the tree radius. 20 cut the walk short every run;
  // 34 still truncated healthy-but-slow walks (34.3s observed on a green
  // screening, 2026-07-12) — swiftshader walk speed varies ~±20%. 45 = the
  // stand + ~1.7x the typical walk, matching ch2-approach's envelope.
  'ch2-color': 45,
  'ch2-approach': 45,
  'ch3-gather': 34,
  'ch3-await-rest': 70,
  'ch3-thirst': 75,
  'ch3-forage': 60,
  'ch3-signal': 60,
  // Raised for the stargaze: night lands ~42s in, then the 8-line sequence
  // (~45.5s) + the 18s reveal ramp + the held rest prompt push natural
  // completion to ~100s. 140 keeps the beat's own resolution well inside.
  'ch4-vigil': 140
};

let clockBeat: StoryBeat | null = null;
let beatClock = 0;
let interactPulseAt = 0;
const _target = new THREE.Vector3();
const _goalScratch = new THREE.Vector3();

// Goal continuity: nudges are counted PER GOAL so a beat handler can give up on
// an unreachable target (defer it) instead of teleport-hammering it forever.
const _goalRef = new THREE.Vector3(Infinity, Infinity, Infinity);
let nudgesOnGoal = 0;

function noteGoal(target: THREE.Vector3): void {
  if (_goalRef.distanceTo(target) > 2.5) {
    _goalRef.copy(target);
    nudgesOnGoal = 0;
  }
}

/** How many teleport-nudges the CURRENT goal has burned (deferral signal). */
function goalNudges(): number {
  return nudgesOnGoal;
}

// Stuck watchdog: when the pilot is pushing but not moving, jump-and-reverse
// until it breaks free (single-voxel lips + pond edges are the usual culprits;
// the water mantle in EfficientPlayer does the heavy lifting, this supplies
// the intent).
const _lastPos = new THREE.Vector3(Infinity, Infinity, Infinity);
let stillTime = 0;
let arrivedTime = 0;
let unstickUntil = -1;
let unstickFlips = 0;
/** True on ticks where walkToward set a live goal (enables the nudge escalation). */
let walkTargetLive = false;
const _nudge = new THREE.Vector3();
const _stillDelta = new THREE.Vector3();

function clearControls(): void {
  controls.forward = false;
  controls.backward = false;
  controls.left = false;
  controls.right = false;
  controls.jump = false;
  controls.sprint = false;
  controls.delete = false;
  controls.interact = false;
}

const _toGoal = new THREE.Vector3();

/**
 * Gait distance to a goal: HORIZONTAL range plus any un-climbed height beyond
 * a step. Pure 3D distance strands the pilot "close" to elevated goals (it
 * stops walking while still at the foot of the rise); pure horizontal releases
 * it directly UNDER them. This keeps the intent alive until both close.
 */
function gaitDistance(target: THREE.Vector3, player: THREE.Vector3): number {
  _toGoal.copy(target).sub(player);
  const up = getPlayerUp();
  const vertical = _toGoal.dot(up);
  _toGoal.addScaledVector(up, -vertical);
  return _toGoal.length() + Math.max(0, vertical - 1.0);
}

/** Base gaze lift over a goal: the camera aims at the SUBJECT, not its base. */
const LOOK_LIFT = 1.4;

const _aim = new THREE.Vector3();

/**
 * Where the camera should look for a given goal: the goal lifted to body
 * height, rising further as the walk closes in — so arrivals (and whatever
 * cutscene fires on them) land FRAMED on the object, never on the ground at
 * the player's feet.
 */
function aimAt(target: THREE.Vector3, distance: number, lookLift = LOOK_LIFT): THREE.Vector3 {
  const closeness = Math.max(0, 1 - distance / 8);
  return _aim.copy(target).addScaledVector(getPlayerUp(), lookLift + closeness * 1.1);
}

/** Aim the camera at a world point and hold forward until within `stop` range.
 *  `lookLift` raises the gaze onto the goal's subject (trees want their crown). */
function walkToward(target: THREE.Vector3, stop: number, lookLift = LOOK_LIFT): number {
  const player = getPlayerWorldPosition();
  const distance = gaitDistance(target, player);
  setCinematicLookTarget(aimAt(target, distance, lookLift));
  setCinematicLookWeight(1);
  _target.copy(target); // gait/nudges steer at the BASE; only the gaze lifts
  noteGoal(target);
  walkTargetLive = true;
  controls.forward = distance > stop;
  // Hop periodically so single-block ledges never wall the walk.
  controls.jump = controls.forward && beatClock % 2.4 < 0.18;
  return distance;
}

const _lensFwd = new THREE.Vector3();
const _lensRight = new THREE.Vector3();
const _toTarget = new THREE.Vector3();

/**
 * Screen-relative walk under an external lens rig: maps the world-space
 * direction to the goal onto the rig's move basis (any elevation/azimuth), so
 * one helper drives the belt-scroll, nav, and iso eras. Falls back to the
 * free-look walkToward outside a lens.
 */
function walkTowardLens(target: THREE.Vector3, stop: number): number {
  const lens = getSideLens();
  if (!lens) return walkToward(target, stop);
  rigMoveBasis(lens, getLensRig(), _lensFwd, _lensRight);
  const player = getPlayerWorldPosition();
  _toTarget.copy(target).sub(player);
  const distance = gaitDistance(target, player);
  _target.copy(target); // the stuck watchdog's nudge steers toward this
  noteGoal(target);
  walkTargetLive = true;
  if (distance > stop) {
    const f = _toTarget.dot(_lensFwd);
    const r = _toTarget.dot(_lensRight);
    controls.forward = f > 0.4;
    controls.backward = f < -0.4;
    controls.right = r > 0.4;
    controls.left = r < -0.4;
  } else {
    controls.forward = false;
    controls.backward = false;
    controls.right = false;
    controls.left = false;
  }
  const pushing = controls.forward || controls.backward || controls.left || controls.right;
  controls.jump = pushing && beatClock % 2.4 < 0.18;
  return distance;
}

/**
 * The extraction gait: STAND and chew (hold-to-mine only charges on a stable
 * target), then TRAVEL a leg toward `to`, collecting stones/debris by proximity
 * en route. Stateless off the beat clock so the raster eras share it.
 */
function extractRhythm(to: THREE.Vector3 | null): void {
  controls.delete = true; // safe: the movie probe only chews quota-feeding blocks
  const cycle = beatClock % 6;
  if (cycle < 3.4 || !to) {
    controls.forward = false;
    controls.backward = false;
    controls.left = false;
    controls.right = false;
    controls.jump = false;
  } else {
    walkTowardLens(to, 0.9);
  }
}

/** A drift point down the strip, reversing every `period` seconds. */
function sweepGoal(period = 24, reach = 9): THREE.Vector3 | null {
  const lens = getSideLens();
  if (!lens) return null;
  const dir = Math.floor(beatClock / period) % 2 === 0 ? 1 : -1;
  return _goalScratch.copy(getPlayerWorldPosition()).addScaledVector(lens.travelAxis, dir * reach);
}

// Salvage commitment: stick with ONE debris piece until collected (no
// equidistant flip-flopping), and DEFER a piece that keeps eating nudges —
// unreachable geometry shouldn't hold the whole sweep hostage.
let debrisTargetIdx = -1;
const deferredDebris = new Set<number>();

// First-day state: the screening eats once, and forage scans are throttled
// (nearestForageNodeWorld walks the voxel map — twice a second is plenty).
let movieAte = false;
let forageGoal: THREE.Vector3 | null = null;
let forageGoalAt = -10;

/** The hero tree's crown height as a gaze lift (the redaction censors the
 *  whole tree; the SHOT should hold the canopy, not the trunk base). */
function treeCrownLift(): number {
  return heroTreeHandle.height > 0 ? heroTreeHandle.height * 0.45 : 2.5;
}

/** Movie-only: consume the richest held forage directly (UI stays untouched —
 *  the campfire-placement precedent). The director advances on the hunger rise. */
function movieEatForage(): boolean {
  for (const id of ['root', 'berry'] as const) {
    if (getItemCount(id) > 0 && removeItem(id, 1)) {
      const def = getItem(id);
      feed(def.foodValue ?? 12, def.waterValue ?? 0);
      return true;
    }
  }
  return false;
}

function committedDebrisTarget(): number {
  const scattered = getDebrisScattered();
  const valid = (i: number) =>
    i >= 0 && i < scattered && !isDebrisCollected(i) && !deferredDebris.has(i);
  if (goalNudges() >= 3 && valid(debrisTargetIdx)) {
    deferredDebris.add(debrisTargetIdx);
    debrisTargetIdx = -1;
  }
  if (valid(debrisTargetIdx)) return debrisTargetIdx;
  const player = getPlayerWorldPosition();
  let best = -1;
  let bestDist = Infinity;
  getDebrisPositions().forEach((pos, i) => {
    if (!valid(i)) return;
    const dist = player.distanceTo(pos);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  });
  if (best < 0 && deferredDebris.size > 0) {
    deferredDebris.clear(); // second chances, round-robin
    return committedDebrisTarget();
  }
  debrisTargetIdx = best;
  return best;
}

/** Pulse F once a second (the resolver decides whether anything happens). */
function pulseInteract(): void {
  controls.interact = beatClock - interactPulseAt < 0.15;
  if (beatClock - interactPulseAt > 1) interactPulseAt = beatClock;
}

function grantMissingCampfireMaterials(): void {
  const need = (id: 'flint' | 'biofuel' | 'wood', n: number) => {
    const have = getItemCount(id);
    if (have < n) addItem(id, n - have);
  };
  need('flint', 2);
  need('biofuel', 1);
  need('wood', 3);
}

/** Ticked by StoryDirectorDriver every frame while in movie mode. */
export function autopilotTick(dt: number): void {
  if (!MOVIE) return;
  const story = getStoryStateSnapshot();
  const beat = story.active ? story.beat : null;
  if (beat !== clockBeat) {
    clockBeat = beat;
    beatClock = 0;
    interactPulseAt = -10;
    stillTime = 0;
    arrivedTime = 0;
    unstickUntil = -1;
    unstickFlips = 0;
    _lastPos.set(Infinity, Infinity, Infinity);
    _goalRef.set(Infinity, Infinity, Infinity);
    nudgesOnGoal = 0;
    debrisTargetIdx = -1;
    deferredDebris.clear();
    movieAte = false;
    forageGoal = null;
    forageGoalAt = -10;
    clearControls();
    setCinematicLookTarget(null);
  }
  // Never push (or rescue-nudge) an unsettled player: while the world is still
  // streaming in under the spawn, the pilot waits with everyone else.
  if (!isSpawnSettled()) {
    clearControls();
    return;
  }
  if (!beat || !isAutopilotDriving()) {
    clearControls();
    // MOVIE FRAMING: the awakening cutscenes drive themselves, but the SHOT
    // must hold its subject — begin and end on the thing that caused it,
    // never on the ground the pilot happened to be staring at.
    if (beat === 'a1-ramp' && anomalyStoneHandle.position) {
      // Look OVER the stone into the world: the stone anchors the lower
      // frame while the horizon takes the color — A1 is the WORLD changing.
      const up = getPlayerUp();
      _toGoal.copy(anomalyStoneHandle.position).sub(getPlayerWorldPosition());
      _toGoal.addScaledVector(up, -_toGoal.dot(up));
      if (_toGoal.lengthSq() < 0.09) _toGoal.set(1, 0, 0);
      _toGoal.normalize();
      _target.copy(anomalyStoneHandle.position).addScaledVector(_toGoal, 10).addScaledVector(up, 0.2);
      setCinematicLookTarget(_target);
      setCinematicLookWeight(0.85);
    } else if (beat === 'a2-awakening' && heroTreeHandle.position) {
      setCinematicLookTarget(_target.copy(heroTreeHandle.position).addScaledVector(getPlayerUp(), treeCrownLift()));
      setCinematicLookWeight(0.85);
    }
    return;
  }
  beatClock += dt;
  walkTargetLive = false; // walkToward re-asserts it below when a goal is live
  const timeout = BEAT_TIMEOUT[beat] ?? Infinity;

  switch (beat) {
    case 'ch1-fixed': {
      // Tutorial order: chew fiber first (stand-and-extract with drift legs),
      // then MARCH down the strip until the bolted frame flips a screen edge.
      const fiberDone = getItemCount('biofiber') >= CH1_FIXED_TUTORIAL.biofiber;
      if (!fiberDone) {
        extractRhythm(sweepGoal(20, 8));
      } else {
        controls.delete = false;
        const lens = getSideLens();
        if (lens) {
          walkTowardLens(
            _goalScratch.copy(getPlayerWorldPosition()).addScaledVector(lens.travelAxis, 30),
            1
          );
        }
      }
      if (beatClock > timeout) {
        // Screening must go on: grant the fiber and unbolt the frame.
        if (getItemCount('biofiber') < CH1_FIXED_TUTORIAL.biofiber) {
          addItem('biofiber', CH1_FIXED_TUTORIAL.biofiber);
        }
        advanceToBeat('ch1-track');
      }
      break;
    }
    case 'ch1-raster': {
      // Fiber unmet: stand-and-extract, with travel legs steering at the
      // COMMITTED salvage piece (walk-over collects it; loose stones come by
      // proximity en route). Fiber met: pure salvage runs until the strip is
      // clear. Deferral keeps one snagged piece from stalling the act.
      const fiberDone = getItemCount('biofiber') >= CH1_QUOTA.biofiber;
      const debrisIdx = committedDebrisTarget();
      const debrisGoal = debrisIdx >= 0 ? getDebrisPositions()[debrisIdx] : null;
      if (!fiberDone) {
        extractRhythm(debrisGoal ?? sweepGoal());
      } else if (debrisGoal) {
        controls.delete = false;
        walkTowardLens(debrisGoal, 0.9);
      } else {
        // Stone stragglers: keep drifting — proximity pickup needs motion.
        extractRhythm(sweepGoal());
      }
      if (beatClock > timeout) {
        // Screening must go on: top up whatever the walk didn't gather.
        if (getItemCount('biofiber') < CH1_QUOTA.biofiber) addItem('biofiber', CH1_QUOTA.biofiber);
        if (getItemCount('stone') < CH1_QUOTA.stone) addItem('stone', CH1_QUOTA.stone);
        seedDebrisCollected();
      }
      break;
    }
    case 'ch1-depth': {
      // Recovery run: nearest uncollected pod, screen-relative (W/S now live).
      const player = getPlayerWorldPosition();
      let nearest = -1;
      let nearestDist = Infinity;
      getSupplyPodPositions().forEach((pos, i) => {
        if (isPodCollected(i)) return;
        const dist = player.distanceTo(pos);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = i;
        }
      });
      if (nearest >= 0) walkTowardLens(getSupplyPodPositions()[nearest], 0.8);
      if (beatClock > timeout) seedSupplyPodsCollected(); // screening must go on
      break;
    }
    case 'ch1-nav': {
      const wp = currentNavWaypointPosition();
      if (wp) walkTowardLens(wp, 1.4);
      if (beatClock > timeout) {
        // Screening must go on: log the fixes and move to the climb.
        seedNavWaypointsReached();
        advanceToBeat('ch1-iso');
      }
      break;
    }
    case 'ch1-iso': {
      // The climb: steer at the mesa summit (the iso→lift gate keys on it); hops
      // + the stuck watchdog's upward nudges haul the capsule up the staircase.
      if (signalMesaHandle.summit) {
        walkTowardLens(signalMesaHandle.summit, 1.6);
      }
      if (beatClock > timeout) advanceToBeat('ch1-lift');
      break;
    }
    case 'ch1-anomaly': {
      // STAGE 1 — the calibration sweep: the era's verb is LOOKING. The pilot
      // pans the gaze around the horizon (eye height — never the ground) until
      // the survey returns the deviation.
      if (!anomalyMassDesignated()) {
        const a = beatClock * 0.6;
        _goalScratch.copy(getPlayerWorldPosition());
        _goalScratch.x += Math.cos(a) * 14;
        _goalScratch.z += Math.sin(a) * 14;
        _goalScratch.addScaledVector(getPlayerUp(), 1.6);
        setCinematicLookTarget(_goalScratch);
        setCinematicLookWeight(1);
        break;
      }
      // STAGE 2 — the mass: walk in with the gaze ON the stone (lift 1.1), so
      // the touch and the A1 ramp play framed on the subject.
      if (anomalyStoneHandle.position) {
        const distance = walkToward(anomalyStoneHandle.position, 2.6, 1.1);
        if (distance <= 4.2) pulseInteract();
      }
      if (beatClock > timeout) beginA1();
      break;
    }
    case 'ch2-color': {
      // Post-A1 breath: stand in the color for a moment (the shot holds the
      // stone the ramp ended on), then seek the tree — gaze on the CROWN, the
      // one saturated thing in a flat world (crossing the radius flips the beat).
      if (beatClock > 6 && heroTreeHandle.position) {
        walkToward(heroTreeHandle.position, 4.5, treeCrownLift());
      }
      if (beatClock > timeout && story.beat === 'ch2-color') advanceToBeat('ch2-approach');
      break;
    }
    case 'ch2-approach': {
      if (heroTreeHandle.position) {
        const distance = walkToward(heroTreeHandle.position, 3.6, treeCrownLift());
        if (distance <= 5.2) pulseInteract();
      }
      if (beatClock > timeout) beginA2();
      break;
    }
    case 'ch3-gather': {
      // The craft is UI-driven in real play — the screening skips straight to
      // the placed fire (which triggers the dusk). It waits for the CHILL:
      // the fire is a response to the falling TEMP (named at 18s — the body/
      // hold/gather/temp caption ladder precedes it), never before it.
      if (beatClock > 21 && getCampfires().length === 0) {
        grantMissingCampfireMaterials();
        placeCampfire(getPlayerWorldPosition().clone(), getPlayerUp().clone());
      }
      // Rescue (the autopilot guarantee: no beat can stall the screening).
      // Today the fire path is synchronous — place emits, the director's
      // campfire subscription advances — so this only fires if that chain
      // ever grows a failure mode. This was the one driven beat whose
      // BEAT_TIMEOUT entry was never consulted.
      if (beatClock > timeout) advanceToBeat('ch3-dusk');
      break;
    }
    case 'ch3-await-rest': {
      const fire = getCampfires()[0];
      if (fire) {
        const firePos = _target.set(fire.pos[0], fire.pos[1], fire.pos[2]);
        const distance = getPlayerWorldPosition().distanceTo(firePos);
        if (distance > 2.4) {
          walkToward(firePos, 2.4);
        } else {
          controls.forward = false;
          setCinematicLookWeight(0);
          pulseInteract(); // fires once night makes the rest resolver live
        }
      }
      if (beatClock > timeout) {
        // Long dark? Force the rest (the dawn is the point of the screening).
        advanceToBeat('a3-dawn');
      }
      break;
    }
    case 'ch3-thirst': {
      // FLOW, not just completion: the pilot waits for the seek cue ("water
      // finds the low places") before walking — the thirst must be felt and
      // named before it is answered, exactly as real play paces it.
      const pond = storyAnchors.pond;
      if (pond && beatClock > 36) {
        const distance = walkToward(pond.surface, 1.1);
        if (distance <= 3.4) pulseInteract();
      }
      if (beatClock > timeout) {
        drink(60); // screening must go on — the director advances on the rise
      }
      break;
    }
    case 'ch3-forage': {
      // Walk to the nearest berry bush (walk-over collects) once the sight cue
      // has landed; eat directly (UI crafting precedent) after the eat window
      // opens. The director advances ~18s after the meal.
      if (movieAte) {
        clearControls();
        setCinematicLookWeight(0);
        break;
      }
      if (getItemCount('berry') + getItemCount('root') > 0) {
        // The hunger was named at 12s and the rounds sighted at 18s — eat then.
        if (beatClock > 20) movieAte = movieEatForage();
        break;
      }
      if (beatClock > 6) {
        if (beatClock - forageGoalAt > 0.5 && storyAnchors.terrainSeed != null) {
          forageGoal = nearestForageNodeWorld(getPlayerWorldPosition(), storyAnchors.terrainSeed, 60);
          forageGoalAt = beatClock;
        }
        if (forageGoal) walkToward(forageGoal, 0.8);
      }
      if (beatClock > timeout && !movieAte) {
        addItem('berry', 2); // sparse seed? the screening still eats
        movieAte = movieEatForage();
      }
      break;
    }
    case 'ch3-signal': {
      // The klaxon run: hold for the summons (the network's lines must land),
      // then SPRINT at the wreck — stamina spends on the way, which is the
      // scene's whole point. The director resolves at the relay.
      if (wreckRelayHandle.position && beatClock > 12) {
        walkToward(wreckRelayHandle.position, 3.0);
        controls.sprint = controls.forward;
      }
      if (beatClock > timeout) {
        markMilestone(STORY_MILESTONES.ch3Signal);
        advanceToBeat('ch4-vigil');
      }
      break;
    }
    case 'ch4-vigil': {
      // The scheduled sleep: hold by the NEAREST fire, rest when dark is
      // issued. Stale saves can carry a distant fire from an older session —
      // if the walk hasn't closed by mid-beat, light a fresh one here (the
      // screening's campfire-placement precedent) so the rest stays honest.
      const player = getPlayerWorldPosition();
      let firePos: THREE.Vector3 | null = null;
      let fireDist = Infinity;
      for (const fire of getCampfires()) {
        const dist = player.distanceTo(_goalScratch.set(fire.pos[0], fire.pos[1], fire.pos[2]));
        if (dist < fireDist) {
          fireDist = dist;
          firePos = _target.set(fire.pos[0], fire.pos[1], fire.pos[2]);
        }
      }
      if (!firePos || (beatClock > 50 && fireDist > 4)) {
        grantMissingCampfireMaterials();
        placeCampfire(player.clone(), getPlayerUp().clone());
      } else if (fireDist > 2.4) {
        walkToward(firePos, 2.4); // reach the fire first, before the dark falls
      } else if (!vigilRestReady()) {
        // Hold a look-up framing through the stargaze + constellation reveal —
        // the pitch above the horizon both drives the director's look-up gate
        // and keeps the shot on the resolving sky, never the ground.
        controls.forward = false;
        controls.backward = false;
        controls.left = false;
        controls.right = false;
        const up = getPlayerUp();
        _toGoal.copy(firePos).sub(player);
        _toGoal.addScaledVector(up, -_toGoal.dot(up)); // horizontal component
        if (_toGoal.lengthSq() < 0.04) _toGoal.set(1, 0, 0);
        _toGoal.normalize();
        setCinematicLookTarget(
          _goalScratch.copy(player).addScaledVector(_toGoal, 4).addScaledVector(up, 10)
        );
        setCinematicLookWeight(1);
      } else {
        controls.forward = false;
        setCinematicLookWeight(0);
        pulseInteract(); // rests once the sky has finished and the prompt lands
      }
      if (beatClock > timeout) {
        markMilestone(STORY_MILESTONES.ch4Vigil);
        advanceToBeat('ch4-arrival');
      }
      break;
    }
    default:
      break;
  }

  // Dev affordance (movie only): capture harnesses sample the pilot's state.
  if (typeof window !== 'undefined') {
    const pos = getPlayerWorldPosition();
    (window as unknown as { __autopilot?: object }).__autopilot = {
      beat,
      clock: Math.round(beatClock * 10) / 10,
      pos: [Math.round(pos.x * 100) / 100, Math.round(pos.y * 100) / 100, Math.round(pos.z * 100) / 100],
      goal: walkTargetLive ? [Math.round(_target.x * 10) / 10, Math.round(_target.y * 10) / 10, Math.round(_target.z * 10) / 10] : null,
      controls: { ...controls },
      stillTime: Math.round(stillTime * 10) / 10,
      nudges: nudgesOnGoal,
      lens: (() => {
        const l = getSideLens();
        if (!l) return null;
        const drift = getPlayerWorldPosition().clone().sub(l.origin).dot(l.depthAxis);
        return {
          originZ: Math.round(l.origin.z * 10) / 10,
          depthAxisZ: l.depthAxis.z,
          band: getLensRig().depthBand,
          drift: Math.round(drift * 100) / 100
        };
      })()
    };
  }

  // --- stuck watchdog (runs over whatever the beat handler decided) -----------
  const pushing = controls.forward || controls.backward || controls.left || controls.right;
  const pos = getPlayerWorldPosition();
  if (Number.isFinite(_lastPos.x)) {
    // HORIZONTAL displacement only: jumping in place must read as STUCK —
    // vertical bounce used to reset this timer and starve the rescue chain.
    _stillDelta.copy(pos).sub(_lastPos);
    const up = getPlayerUp();
    _stillDelta.addScaledVector(up, -_stillDelta.dot(up));
    if (pushing && _stillDelta.length() < 0.06) stillTime += dt;
    else stillTime = 0;
  }
  _lastPos.copy(pos);
  if (pushing && stillTime > 2.2 && beatClock > unstickUntil) {
    unstickFlips++;
    stillTime = 0;
    // ESCALATION: three failed break-outs against the same geometry means the
    // straight line is unwalkable (a 2-block rise, a corner pocket). The
    // screening must go on: teleport-nudge toward the goal (movie-only; the
    // physics side is gated on isAutopilotDriving).
    if (unstickFlips >= 2 && walkTargetLive) {
      _nudge.copy(_target).sub(pos);
      const up = getPlayerUp();
      _nudge.addScaledVector(up, -_nudge.dot(up)); // horizontal component only
      if (_nudge.lengthSq() > 0.01) _nudge.normalize().multiplyScalar(2.4);
      _nudge.addScaledVector(up, 2.3); // over the lip, gravity settles the rest
      requestPlayerNudge(_nudge);
      nudgesOnGoal++;
      unstickFlips = 0;
      unstickUntil = beatClock; // no reverse dance after a nudge — just walk
    } else {
      unstickUntil = beatClock + 1.6;
    }
  }
  // Arrived-but-inert: the gait released at its stop radius, a goal is still
  // live, and nothing has advanced — the trigger volume must be inches away.
  // Shove gently toward the goal (and count it, so deferral can move on).
  if (walkTargetLive && !pushing) {
    arrivedTime += dt;
    if (arrivedTime > 4) {
      arrivedTime = 0;
      nudgesOnGoal++;
      _nudge.copy(_target).sub(pos);
      const upA = getPlayerUp();
      _nudge.addScaledVector(upA, -_nudge.dot(upA));
      if (_nudge.lengthSq() > 0.01) _nudge.normalize().multiplyScalar(1.2);
      _nudge.addScaledVector(upA, 0.4);
      requestPlayerNudge(_nudge);
    }
  } else {
    arrivedTime = 0;
  }

  if (beatClock < unstickUntil) {
    // Break-out routine: mash jump; on alternating attempts, briefly reverse.
    controls.jump = true;
    if (unstickFlips % 2 === 0 && beatClock < unstickUntil - 0.8) {
      const f = controls.forward;
      controls.forward = controls.backward;
      controls.backward = f;
      const l = controls.left;
      controls.left = controls.right;
      controls.right = l;
    }
  }
}
