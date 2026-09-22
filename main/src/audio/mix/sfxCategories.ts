import type { SfxEvent } from '../sfxEngine.ts';
import type { SfxBus } from './mixTuning.ts';
import type { DuckSource } from './duckMatrix.ts';

/**
 * Which category bus each shipped SFX event plays through. A table, not a
 * switch in the engine: Stage 4 adds positional/variation authority per
 * category, Stage 6 adds the voice bus, and the duck matrix reads the same key.
 */
export const SFX_CATEGORY: Record<SfxEvent, SfxBus> = {
  footstep: 'player', craftSuccess: 'player', buildSuccess: 'player', inventoryAcquire: 'player',
  uiHover: 'ui', uiClick: 'ui', uiBack: 'ui', uiError: 'ui',
  hatch: 'ship', stationHum: 'world', waterLap: 'world',
  objectiveEnter: 'ui', objectiveProgress: 'ui', objectiveComplete: 'ui', objectiveFail: 'ui', markerAcquired: 'ui',
  jump: 'player',
  land: 'player',
  mine: 'player',
  blocked: 'player',
  splashEnter: 'player',
  splashExit: 'player',
  boardShip: 'ship',
  exitShip: 'ship',
  shipLaunch: 'ship',
  shipBoost: 'ship',
  shipLand: 'ship',
  shipCrash: 'ship',
  terminalKey: 'ui',
  terminalAdvance: 'ui',
  terminalAlarm: 'ui',
  terminalCorrupt: 'ui',
  storyGlitch: 'ui',
  storyAwaken: 'world',
  storySleep: 'world'
};

/** The body clock and the two loops have no SfxEvent; they are player sounds. */
export const OXYGEN_PULSE_CATEGORY: SfxBus = 'player';
export const JETPACK_LOOP_CATEGORY: SfxBus = 'player';
export const SHIP_THRUST_LOOP_CATEGORY: SfxBus = 'ship';

/**
 * Which events are duck edges. Everything else plays without ducking anything
 * (a mining chip completes the bed; it does not push it aside). The lifecycle
 * cue row of the matrix has no live mapping this run: Stage 4 owns the
 * feedback-cue semantics and will bind it.
 */
export const SFX_DUCK_SOURCE: Partial<Record<SfxEvent, DuckSource>> = {
  shipCrash: 'shipImpact',
  shipLand: 'shipImpact',
  terminalAlarm: 'terminalAlarm',
  terminalCorrupt: 'terminalAlarm',
  objectiveEnter: 'lifecycleCue', objectiveProgress: 'lifecycleCue',
  objectiveComplete: 'lifecycleCue', objectiveFail: 'lifecycleCue', markerAcquired: 'lifecycleCue'
};

/**
 * Flush order inside one frame: higher first. Impacts and alarms lead so their
 * duck edge is applied before the quieter confirmations in the same frame.
 */
export const SFX_PRIORITY: Partial<Record<SfxEvent, number>> = {
  shipCrash: 3,
  terminalCorrupt: 3,
  terminalAlarm: 2,
  shipLand: 2,
  storyAwaken: 2,
  storySleep: 2,
  splashEnter: 1,
  splashExit: 1
};
