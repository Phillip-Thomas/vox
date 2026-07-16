import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  hasMilestone,
  markMilestone,
  resetProgression,
  subscribeProgression
} from '../game/systems/progressionSystem.ts';
import { getEmergentStoryEvents, resetEmergentStoryEvents } from './emergentStoryEvents.ts';
import {
  PHYSICAL_BOARDING_MILESTONE,
  PHYSICAL_BOARDING_SEALED_MILESTONE,
  advancePhysicalBoardingState,
  beginPhysicalBoarding,
  beginPhysicalBoardingState,
  cancelPhysicalBoarding,
  canCommitStagedShipEntry,
  createPhysicalBoardingState,
  getPhysicalBoardingGuidance,
  getPhysicalBoardingSnapshot,
  hasCompletedPhysicalBoarding,
  isPhysicalBoardingVehicleControlLocked,
  reconcilePhysicalBoardingSignedAvFromReceipt,
  resetPhysicalBoardingRuntimeForTests,
  tickPhysicalBoarding
} from './physicalBoarding.ts';
import {
  enterSignedSceneAvBeat,
  getSignedSceneAvDebugSnapshot,
  resetSignedSceneAvRuntime
} from './signedSceneAvRuntime.ts';
import {
  enterEmergentScoreBeat,
  getEmergentScoreSnapshot,
  resetEmergentScoreDirectorForTests
} from './emergentScoreDirector.ts';

const ACTOR = 'local';
const WORLD = '-1,-1';
const PLAYER = [0, 50, 2.6] as const;
const SHIP = [0, 50, 0] as const;

const beginInput = {
  actorId: ACTOR,
  worldId: WORLD,
  storyBeat: 'ch7-board' as const,
  repairStage: 'flight_ready',
  phase: 'surface' as const,
  controlMode: 'fps' as const,
  boardable: true,
  exteriorPosition: PLAYER,
  surfaceUp: [0, 1, 0] as const,
  shipPosition: SHIP
};

const tickInput = {
  actorId: ACTOR,
  worldId: WORLD,
  storyBeat: 'ch7-board' as const,
  phase: 'surface' as const,
  controlMode: 'fps' as const,
  boardable: true,
  playerPosition: PLAYER,
  focused: true,
  paused: false,
  dt: 0.1
};

beforeEach(() => {
  resetProgression();
  resetEmergentStoryEvents();
  resetPhysicalBoardingRuntimeForTests();
  resetEmergentScoreDirectorForTests();
  resetSignedSceneAvRuntime('quit');
});

afterEach(() => vi.unstubAllGlobals());

describe('physical boarding transaction', () => {
  it('is cancel-safe before ownership transfer and resets the hatch', () => {
    const begun = beginPhysicalBoardingState(createPhysicalBoardingState(), beginInput, 7);
    expect(begun).toMatchObject({ phase: 'hatch_entering', hatchProgress: 0 });
    const moving = advancePhysicalBoardingState(begun, { ...tickInput, dt: 0.3 });
    expect(moving.state.hatchProgress).toBeGreaterThan(0);
    const cancelled = advancePhysicalBoardingState(moving.state, {
      ...tickInput,
      focused: false
    });
    expect(cancelled.state).toMatchObject({
      phase: 'cancelled',
      hatchProgress: 0,
      cancelReason: 'focus-lost'
    });
  });

  it('orders hatch, sole camera owner, physical seal, then the canonical board event', () => {
    enterEmergentScoreBeat('ch7-board');
    enterSignedSceneAvBeat('ch7-board');
    expect(beginPhysicalBoarding(beginInput)).toBe(true);
    expect(isPhysicalBoardingVehicleControlLocked()).toBe(true);
    expect(getEmergentScoreSnapshot()).toMatchObject({
      boardingPhase: 'hatch-entered',
      shipHumMultiplier: 0
    });

    let effects: readonly string[] = [];
    for (let index = 0; index < 8; index++) effects = tickPhysicalBoarding(tickInput);
    expect(effects).toContain('request-vehicle-transfer');
    expect(canCommitStagedShipEntry()).toBe(true);
    expect(getSignedSceneAvDebugSnapshot()).toMatchObject({ anchorId: 'anc.board.hatch-enter' });

    expect(tickPhysicalBoarding({
      ...tickInput,
      controlMode: 'flight',
      boardable: false,
      focused: false
    })).toEqual([]);
    expect(getPhysicalBoardingSnapshot().phase).toBe('transfer_requested');

    effects = tickPhysicalBoarding({
      ...tickInput,
      controlMode: 'flight',
      boardable: false
    });
    expect(effects).toContain('activate-camera-owner-vehicle');
    expect(getSignedSceneAvDebugSnapshot()).toMatchObject({ anchorId: 'anc.board.camera-transfer' });
    expect(getEmergentScoreSnapshot()).toMatchObject({
      boardingPhase: 'vehicle-owner',
      shipHumMultiplier: 0
    });
    const suspendedSeal = getPhysicalBoardingSnapshot();
    expect(tickPhysicalBoarding({
      ...tickInput,
      controlMode: 'flight',
      boardable: false,
      paused: true
    })).toEqual([]);
    expect(getPhysicalBoardingSnapshot()).toEqual(suspendedSeal);

    for (let index = 0; index < 4; index++) {
      effects = tickPhysicalBoarding({
        ...tickInput,
        controlMode: 'flight',
        boardable: false
      });
    }
    expect(effects).toContain('activate-cockpit-sealed');
    expect(getSignedSceneAvDebugSnapshot()).toMatchObject({ anchorId: 'anc.board.pressure-seal' });
    expect(hasMilestone(PHYSICAL_BOARDING_SEALED_MILESTONE, ACTOR)).toBe(true);
    expect(getEmergentScoreSnapshot()).toMatchObject({
      boardingPhase: 'cockpit-sealed',
      shipHumMultiplier: 1,
      musicEnvelope: {
        ownerId: 'ch7-board:pressure-seal:story:board:local:-1,-1:1',
        status: 'complete'
      }
    });

    for (let index = 0; index < 2; index++) {
      effects = tickPhysicalBoarding({
        ...tickInput,
        controlMode: 'flight',
        boardable: false
      });
    }
    expect(effects).not.toContain('complete-physical-boarding');
    expect(hasMilestone(PHYSICAL_BOARDING_MILESTONE, ACTOR)).toBe(false);
    let handbackPublishedBeforeCompletion = false;
    const unsubscribe = subscribeProgression(() => {
      if (!hasMilestone(PHYSICAL_BOARDING_MILESTONE, ACTOR)) return;
      handbackPublishedBeforeCompletion = getSignedSceneAvDebugSnapshot()
        .activationHistoryAnchorIds.includes('anc.board.cockpit-handback');
    });
    effects = tickPhysicalBoarding({
      ...tickInput,
      controlMode: 'flight',
      boardable: false
    });
    unsubscribe();
    expect(effects).toContain('complete-physical-boarding');
    expect(handbackPublishedBeforeCompletion).toBe(true);
    expect(getPhysicalBoardingSnapshot().phase).toBe('complete');
    expect(isPhysicalBoardingVehicleControlLocked()).toBe(false);
    expect(hasMilestone(PHYSICAL_BOARDING_MILESTONE, ACTOR)).toBe(true);
    expect(getEmergentScoreSnapshot()).toMatchObject({
      boardingPhase: 'cockpit-handback',
      shipHumMultiplier: 1
    });

    expect(getEmergentStoryEvents().filter(event => event.type === 'ship_boarded')).toHaveLength(1);
    expect(getSignedSceneAvDebugSnapshot()).toMatchObject({
      anchorId: 'anc.board.cockpit-handback',
      activatedAnchorIds: [
        'anc.board.hatch-enter',
        'anc.board.camera-transfer',
        'anc.board.pressure-seal',
        'anc.board.cockpit-handback'
      ]
    });
  });

  it('supports touch-equivalent same-action cancellation before transfer', () => {
    expect(beginPhysicalBoarding(beginInput)).toBe(true);
    expect(cancelPhysicalBoarding('player-cancelled')).toBe(true);
    expect(getPhysicalBoardingSnapshot()).toMatchObject({
      phase: 'cancelled',
      cancelReason: 'player-cancelled'
    });
    expect(cancelPhysicalBoarding()).toBe(false);
  });

  it('returns score ownership when runtime validation cancels the hatch', () => {
    enterEmergentScoreBeat('ch7-board');
    expect(beginPhysicalBoarding(beginInput)).toBe(true);
    expect(tickPhysicalBoarding({ ...tickInput, focused: false })).toEqual([]);
    expect(getPhysicalBoardingSnapshot().phase).toBe('cancelled');
    expect(getEmergentScoreSnapshot()).toMatchObject({
      boardingPhase: 'cancelled',
      shipHumMultiplier: 0
    });
  });

  it('hydrates the signed pressure boundary from a durable completed receipt', () => {
    markMilestone(PHYSICAL_BOARDING_MILESTONE, ACTOR);
    enterSignedSceneAvBeat('ch7-board');
    expect(reconcilePhysicalBoardingSignedAvFromReceipt(ACTOR, WORLD)).toBe(true);
    expect(getSignedSceneAvDebugSnapshot()).toMatchObject({
      anchorId: 'anc.board.cockpit-handback',
      activatedAnchorIds: [
        'anc.board.hatch-enter',
        'anc.board.camera-transfer',
        'anc.board.pressure-seal',
        'anc.board.cockpit-handback'
      ]
    });
  });

  it('keeps boarding actionable at the hatch and markerless during camera ownership', () => {
    expect(getPhysicalBoardingGuidance(createPhysicalBoardingState())).toMatchObject({
      id: 'board:enter-hatch',
      kind: 'interact',
      markerLabel: 'KESTREL HATCH · BOARD',
      requiresMarker: true
    });
    const entering = beginPhysicalBoardingState(createPhysicalBoardingState(), beginInput, 2);
    expect(getPhysicalBoardingGuidance(entering)).toMatchObject({
      id: 'board:hatch-in-progress',
      kind: 'wait',
      workOrder: ['HATCH TRANSFER IN PROGRESS.', 'HOLD POSITION · ESC TO STEP BACK.'],
      requiresMarker: false
    });
    expect(getPhysicalBoardingGuidance(entering, 'touch')).toMatchObject({
      id: 'board:hatch-in-progress',
      workOrder: ['HATCH TRANSFER IN PROGRESS.', 'HOLD POSITION · USE TO STEP BACK.']
    });
    expect(getPhysicalBoardingGuidance(createPhysicalBoardingState(), 'touch')).toMatchObject({
      id: 'board:enter-hatch',
      workOrder: ['APPROACH THE KESTREL HATCH.', 'USE · ENTER THROUGH THE HATCH.']
    });
  });

  it('infers touch-language from the same narrow viewport that mounts touch controls', () => {
    vi.stubGlobal('window', { innerWidth: 390 });
    const entering = beginPhysicalBoardingState(createPhysicalBoardingState(), beginInput, 3);

    expect(getPhysicalBoardingGuidance(entering).workOrder).toEqual([
      'HATCH TRANSFER IN PROGRESS.',
      'HOLD POSITION · USE TO STEP BACK.'
    ]);
  });

  it('never accepts an origin boarding receipt on another world', () => {
    markMilestone(PHYSICAL_BOARDING_MILESTONE, ACTOR);
    expect(hasCompletedPhysicalBoarding(ACTOR, WORLD)).toBe(true);
    expect(hasCompletedPhysicalBoarding(ACTOR, `${WORLD}:p1`)).toBe(false);
  });
});
