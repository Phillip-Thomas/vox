import * as THREE from 'three';
import { getStoryStateSnapshot, type StoryBeat } from './storyState.ts';
import { getAppStateSnapshot } from '../state/appState.ts';
import { getPlayerWorldPosition, getPlayerUp } from '../state/playerFrame.ts';
import { addItem, getItemCount } from '../game/systems/inventorySystem.ts';
import { getCampfires, placeCampfire } from '../game/systems/campfires.ts';
import { anomalyStoneHandle } from './world/AnomalyStone.tsx';
import { heroTreeHandle } from './world/HeroAppleTree.tsx';
import { beginA1, beginA2 } from './storyDirector.ts';
import { advanceToBeat } from './storyState.ts';
import { setCinematicLookTarget, setCinematicLookWeight } from './cinematicLook.ts';
import { CH1_QUOTA } from './storyScript.ts';

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
  'ch1-raster', 'ch1-anomaly', 'ch2-color', 'ch2-approach',
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
  'ch1-raster': 75,
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

function clearControls(): void {
  controls.forward = false;
  controls.backward = false;
  controls.left = false;
  controls.right = false;
  controls.jump = false;
  controls.delete = false;
  controls.interact = false;
}

/** Aim the camera at a world point and hold forward until within `stop` range. */
function walkToward(target: THREE.Vector3, stop: number): number {
  const player = getPlayerWorldPosition();
  const distance = player.distanceTo(target);
  setCinematicLookTarget(_target.copy(target));
  setCinematicLookWeight(1);
  controls.forward = distance > stop;
  // Hop periodically so single-block ledges never wall the walk.
  controls.jump = controls.forward && beatClock % 2.4 < 0.18;
  return distance;
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
    clearControls();
    setCinematicLookTarget(null);
  }
  if (!beat || !isAutopilotDriving()) {
    clearControls();
    return;
  }
  beatClock += dt;
  const timeout = BEAT_TIMEOUT[beat] ?? Infinity;

  switch (beat) {
    case 'ch1-raster': {
      // Rhythm: walk a stretch, then STAND and extract — hold-to-mine only
      // charges on a stable target, so a perpetual walk never harvests. Stones
      // collect by proximity during the walks; fiber breaks during the stands.
      const cycle = beatClock % 6;
      const walking = cycle < 2.6;
      const sweepRight = Math.floor(beatClock / 24) % 2 === 0; // long sweeps out and back
      controls.right = walking && sweepRight;
      controls.left = walking && !sweepRight;
      controls.delete = true;
      controls.jump = walking && cycle % 2.2 < 0.16;
      if (beatClock > timeout) {
        // Screening must go on: top up whatever the walk didn't gather.
        if (getItemCount('biofiber') < CH1_QUOTA.biofiber) addItem('biofiber', CH1_QUOTA.biofiber);
        if (getItemCount('stone') < CH1_QUOTA.stone) addItem('stone', CH1_QUOTA.stone);
      }
      break;
    }
    case 'ch1-anomaly': {
      if (anomalyStoneHandle.position) {
        const distance = walkToward(anomalyStoneHandle.position, 3.2);
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
        const distance = walkToward(heroTreeHandle.position, 4.2);
        if (distance <= 5.4) pulseInteract();
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
        if (distance > 3) {
          walkToward(firePos, 3);
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
}
