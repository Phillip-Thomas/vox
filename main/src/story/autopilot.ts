import * as THREE from 'three';
import { getStoryStateSnapshot, type StoryBeat } from './storyState.ts';
import { getAppStateSnapshot } from '../state/appState.ts';
import { getPlayerWorldPosition, getPlayerUp } from '../state/playerFrame.ts';
import { requestPlayerNudge } from './playerNudge.ts';
import { addItem, getItemCount } from '../game/systems/inventorySystem.ts';
import { getCampfires, placeCampfire } from '../game/systems/campfires.ts';
import { anomalyStoneHandle } from './world/AnomalyStone.tsx';
import { heroTreeHandle } from './world/HeroAppleTree.tsx';
import { beginA1, beginA2 } from './storyDirector.ts';
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
  delete: boolean;   // hold-to-mine
  interact: boolean; // F pulses
}

const controls: AutopilotControls = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  jump: false,
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
  'ch3-gather', 'ch3-await-rest'
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
  'ch1-anomaly': 50,
  'ch2-color': 20,
  'ch2-approach': 45,
  'ch3-gather': 12,
  'ch3-await-rest': 70
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

/** Aim the camera at a world point and hold forward until within `stop` range. */
function walkToward(target: THREE.Vector3, stop: number): number {
  const player = getPlayerWorldPosition();
  const distance = gaitDistance(target, player);
  setCinematicLookTarget(_target.copy(target));
  setCinematicLookWeight(1);
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
    clearControls();
    setCinematicLookTarget(null);
  }
  if (!beat || !isAutopilotDriving()) {
    clearControls();
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
      // The climb: steer at the stone; hops + the stuck watchdog's upward
      // nudges haul the capsule up the staircase treads.
      if (anomalyStoneHandle.position) {
        walkTowardLens(anomalyStoneHandle.position, 1.6);
      }
      if (beatClock > timeout) advanceToBeat('ch1-lift');
      break;
    }
    case 'ch1-anomaly': {
      if (anomalyStoneHandle.position) {
        const distance = walkToward(anomalyStoneHandle.position, 2.6);
        if (distance <= 4.2) pulseInteract();
      }
      if (beatClock > timeout) beginA1();
      break;
    }
    case 'ch2-color': {
      // Post-A1 breath: stand in the color for a moment, then seek the tree
      // (crossing the approach radius flips the beat).
      if (beatClock > 6 && heroTreeHandle.position) {
        walkToward(heroTreeHandle.position, 4.5);
      }
      if (beatClock > timeout && story.beat === 'ch2-color') advanceToBeat('ch2-approach');
      break;
    }
    case 'ch2-approach': {
      if (heroTreeHandle.position) {
        const distance = walkToward(heroTreeHandle.position, 3.6);
        if (distance <= 5.2) pulseInteract();
      }
      if (beatClock > timeout) beginA2();
      break;
    }
    case 'ch3-gather': {
      // The craft is UI-driven in real play — the screening skips straight to
      // the placed fire (which triggers the dusk).
      if (beatClock > 4 && getCampfires().length === 0) {
        grantMissingCampfireMaterials();
        placeCampfire(getPlayerWorldPosition().clone(), getPlayerUp().clone());
      }
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
