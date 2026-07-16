import { beforeEach, describe, expect, it } from 'vitest';
import { markMilestone, resetProgression } from '../game/systems/progressionSystem.ts';
import { getAccomplishment, resetAccomplishments } from '../game/systems/accomplishmentLedger.ts';
import { emitEmergentStoryEvent, resetEmergentStoryEvents } from './emergentStoryEvents.ts';
import {
  FIRST_HOVER_HOLD_SECONDS,
  RECONSTRUCTION_EMBODIMENT_MILESTONES,
  advanceFirstHoverProof,
  automatedFirstHoverThrustDecision,
  commitWreckDiagnosis,
  createFirstHoverProofState,
  hasFirstHoverGroundedReturn,
  hasFirstLegalHoverReceipt,
  hasWreckDiagnosisReceipt,
  needsAutomatedFirstHover,
  observeFirstLegalHover,
  registerPhysicalWreckBinding,
  reconcileReconstructionSignedAvFromReceipts,
  resetReconstructionEmbodimentRuntimeForTests,
  validateWreckDiagnosisProof
} from './reconstructionEmbodiment.ts';
import { RECONSTRUCTION_CALIBRATION_MILESTONE } from './reconstructionCalibration.ts';
import {
  DEFAULT_JUMP_SPEED,
  GRAVITY_STRENGTH,
  JETPACK_MAX_UP_SPEED,
  JETPACK_THRUST
} from '../utils/surfaceControls.ts';
import {
  enterSignedSceneAvBeat,
  getSignedSceneAvDebugSnapshot,
  resetSignedSceneAvRuntime
} from './signedSceneAvRuntime.ts';

const ACTOR = 'local';
const WORLD = '-1,-1';
const WRECK = [0, 50, 0] as const;
const HOVER_SOCKET = [0, 51.5, 0] as const;

beforeEach(() => {
  resetProgression();
  resetAccomplishments();
  resetEmergentStoryEvents();
  resetReconstructionEmbodimentRuntimeForTests();
  resetSignedSceneAvRuntime('quit');
});

describe('physical reconstruction embodiment', () => {
  it('refuses diagnosis without the banked memory, scar gaze, or physical reach', () => {
    const base = {
      actorId: ACTOR,
      worldId: WORLD,
      storyBeat: 'ch7-reconstruct' as const,
      repairStage: 'wrecked' as const,
      keelMemoryBanked: true,
      distanceSquared: 9,
      viewAlignment: 0.9
    };
    expect(validateWreckDiagnosisProof({ ...base, keelMemoryBanked: false }).reason)
      .toBe('keel-not-banked');
    expect(validateWreckDiagnosisProof({ ...base, worldId: `${WORLD}:p1` }).reason)
      .toBe('wrong-world');
    expect(validateWreckDiagnosisProof({ ...base, distanceSquared: 100 }).reason)
      .toBe('out-of-reach');
    expect(validateWreckDiagnosisProof({ ...base, viewAlignment: 0.2 }).reason)
      .toBe('not-looking-at-scar');
    expect(hasWreckDiagnosisReceipt(ACTOR)).toBe(false);
  });

  it('commits diagnosis and a sustained legal hover into the signed causal rail', () => {
    enterSignedSceneAvBeat('ch7-reconstruct');
    const unregister = registerPhysicalWreckBinding({
      actorId: ACTOR,
      worldId: WORLD,
      position: WRECK,
      hoverSocketPosition: HOVER_SOCKET
    });
    expect(commitWreckDiagnosis({
      actorId: ACTOR,
      worldId: WORLD,
      storyBeat: 'ch7-reconstruct',
      repairStage: 'wrecked',
      keelMemoryBanked: true,
      distanceSquared: 9,
      viewAlignment: 0.9
    })).toMatchObject({ ok: true, idempotent: false, avActivated: true });
    expect(hasWreckDiagnosisReceipt(ACTOR)).toBe(true);

    for (const [from, to] of [
      ['wrecked', 'bench_online'],
      ['bench_online', 'frame_restored'],
      ['frame_restored', 'hull_sealed'],
      ['hull_sealed', 'lift_online']
    ] as const) {
      emitEmergentStoryEvent({
        id: `test:repair:${to}`,
        type: 'ship_repair_stage',
        payload: { from, to }
      });
    }

    for (let elapsed = 0; elapsed <= FIRST_HOVER_HOLD_SECONDS; elapsed += 0.1) {
      observeFirstLegalHover({
        actorId: ACTOR,
        worldId: WORLD,
        storyBeat: 'ch7-reconstruct',
        repairStage: 'lift_online',
        position: [0.5, 51.4, 0],
        surfaceUp: [0, 1, 0],
        grounded: false,
        jetpackActive: true,
        verticalSpeed: 1.2,
        dt: 0.1
      });
    }
    expect(hasFirstLegalHoverReceipt(ACTOR)).toBe(true);
    expect(getAccomplishment('ground_relents', ACTOR)).toBeDefined();
    expect(hasFirstHoverGroundedReturn(ACTOR)).toBe(false);
    observeFirstLegalHover({
      actorId: ACTOR,
      worldId: WORLD,
      storyBeat: 'ch7-reconstruct',
      repairStage: 'lift_online',
      position: [0.5, 50.4, 0],
      surfaceUp: [0, 1, 0],
      grounded: true,
      jetpackActive: false,
      verticalSpeed: 0,
      dt: 0.1
    });
    expect(hasFirstHoverGroundedReturn(ACTOR)).toBe(true);
    unregister();
    expect(getSignedSceneAvDebugSnapshot()).toMatchObject({
      anchorId: 'anc.reconstruct.first-hover'
    });
  });

  it('resets partial hover dwell and rejects ground, drift, and pre-lift stages', () => {
    const base = {
      actorId: ACTOR,
      worldId: WORLD,
      storyBeat: 'ch7-reconstruct' as const,
      repairStage: 'lift_online' as const,
      position: [0, 51.5, 0] as const,
      surfaceUp: [0, 1, 0] as const,
      wreckPosition: WRECK,
      hoverSocketPosition: HOVER_SOCKET,
      grounded: false,
      jetpackActive: true,
      verticalSpeed: 1,
      dt: 0.25
    };
    const first = advanceFirstHoverProof(createFirstHoverProofState(), base);
    expect(first.state.holdSeconds).toBe(0.1);
    const featheredCoast = advanceFirstHoverProof(first.state, {
      ...base,
      jetpackActive: false,
      verticalSpeed: 0.4
    });
    expect(featheredCoast).toMatchObject({
      eligible: true,
      state: { holdSeconds: 0.2, thrustObserved: true }
    });
    const grounded = advanceFirstHoverProof(first.state, { ...base, grounded: true });
    expect(grounded.state.holdSeconds).toBe(0);
    expect(advanceFirstHoverProof(first.state, {
      ...base,
      position: [9, 51.5, 0]
    }).eligible).toBe(false);
    expect(advanceFirstHoverProof(first.state, {
      ...base,
      repairStage: 'hull_sealed'
    }).eligible).toBe(false);
  });

  it('feathers real thrust toward a bounded apex and catches the fall', () => {
    expect(automatedFirstHoverThrustDecision({
      verticalDelta: 3,
      verticalSpeed: 6,
      grounded: false
    })).toBe(true);
    expect(automatedFirstHoverThrustDecision({
      verticalDelta: 1,
      verticalSpeed: 6,
      grounded: false
    })).toBe(false);
    expect(automatedFirstHoverThrustDecision({
      verticalDelta: 0.25,
      verticalSpeed: -0.8,
      grounded: false
    })).toBe(true);
    expect(automatedFirstHoverThrustDecision({
      verticalDelta: -0.8,
      verticalSpeed: -2,
      grounded: false
    })).toBe(false);
    expect(automatedFirstHoverThrustDecision({
      verticalDelta: 2,
      verticalSpeed: 0,
      grounded: true
    })).toBe(true);
  });

  it('completes a sustained socket dwell through the normal jump and jet constants', () => {
    const dt = 1 / 60;
    let height = -0.7;
    let speed = 0;
    let grounded = true;
    let proof = createFirstHoverProofState();
    let completedAt = -1;

    for (let frame = 0; frame < 360; frame++) {
      const jumpHeld = automatedFirstHoverThrustDecision({
        verticalDelta: 2.25 - height,
        verticalSpeed: speed,
        grounded
      });
      let jetpackActive = false;
      if (grounded && jumpHeld) {
        speed = DEFAULT_JUMP_SPEED;
        grounded = false;
      } else {
        speed -= GRAVITY_STRENGTH * dt;
        if (jumpHeld) {
          jetpackActive = true;
          speed = Math.min(JETPACK_MAX_UP_SPEED, speed + JETPACK_THRUST * dt);
        }
      }
      height += speed * dt;
      if (height <= -0.7) {
        height = -0.7;
        speed = 0;
        grounded = true;
      }
      const advanced = advanceFirstHoverProof(proof, {
        actorId: ACTOR,
        worldId: WORLD,
        storyBeat: 'ch7-reconstruct',
        repairStage: 'lift_online',
        position: [0, height, 0],
        surfaceUp: [0, 1, 0],
        wreckPosition: [0, 0, 0],
        hoverSocketPosition: [0, 2.25, 0],
        grounded,
        jetpackActive,
        verticalSpeed: speed,
        dt
      });
      proof = advanced.state;
      if (advanced.completedNow) {
        completedAt = frame * dt;
        break;
      }
    }

    expect(completedAt).toBeGreaterThan(FIRST_HOVER_HOLD_SECONDS);
    expect(completedAt).toBeLessThan(2.5);
    expect(Math.abs(height - 2.25)).toBeLessThan(0.5);
    expect(proof).toMatchObject({ complete: true, thrustObserved: true });
  });

  it('offers movie hover intent only inside the bound origin envelope', () => {
    registerPhysicalWreckBinding({
      actorId: ACTOR,
      worldId: WORLD,
      position: WRECK,
      hoverSocketPosition: HOVER_SOCKET
    });
    expect(needsAutomatedFirstHover({
      actorId: ACTOR,
      worldId: WORLD,
      storyBeat: 'ch7-reconstruct',
      repairStage: 'lift_online',
      position: [1, 50, 0],
      surfaceUp: [0, 1, 0]
    })).toBe(false);
    markMilestone(RECONSTRUCTION_EMBODIMENT_MILESTONES.diagnosis, ACTOR);
    expect(needsAutomatedFirstHover({
      actorId: ACTOR,
      worldId: WORLD,
      storyBeat: 'ch7-reconstruct',
      repairStage: 'lift_online',
      position: [1, 50, 0],
      surfaceUp: [0, 1, 0]
    })).toBe(true);
    expect(needsAutomatedFirstHover({
      actorId: ACTOR,
      worldId: WORLD,
      storyBeat: 'ch7-reconstruct',
      repairStage: 'lift_online',
      position: [20, 50, 0],
      surfaceUp: [0, 1, 0]
    })).toBe(false);
  });

  it('recovers a legacy flight-ready hull through a fresh physical lift rehearsal and cold AV hydration', () => {
    enterSignedSceneAvBeat('ch7-reconstruct');
    registerPhysicalWreckBinding({
      actorId: ACTOR,
      worldId: WORLD,
      position: WRECK,
      hoverSocketPosition: HOVER_SOCKET
    });
    expect(commitWreckDiagnosis({
      actorId: ACTOR,
      worldId: WORLD,
      storyBeat: 'ch7-reconstruct',
      repairStage: 'flight_ready',
      keelMemoryBanked: true,
      distanceSquared: 4,
      viewAlignment: 0.92
    }).ok).toBe(true);
    for (let index = 0; index < 12; index++) {
      observeFirstLegalHover({
        actorId: ACTOR,
        worldId: WORLD,
        storyBeat: 'ch7-reconstruct',
        repairStage: 'flight_ready',
        position: [0, 51.5, 0],
        surfaceUp: [0, 1, 0],
        grounded: false,
        jetpackActive: true,
        verticalSpeed: 0.8,
        dt: 0.1
      });
    }
    observeFirstLegalHover({
      actorId: ACTOR,
      worldId: WORLD,
      storyBeat: 'ch7-reconstruct',
      repairStage: 'flight_ready',
      position: [0, 50.4, 0],
      surfaceUp: [0, 1, 0],
      grounded: true,
      jetpackActive: false,
      verticalSpeed: 0,
      dt: 0.1
    });
    expect(hasFirstHoverGroundedReturn(ACTOR)).toBe(true);

    // A cold beat has no transient anchor history; durable receipts rebuild it
    // in order without replaying gameplay events.
    resetSignedSceneAvRuntime('quit');
    enterSignedSceneAvBeat('ch7-reconstruct');
    reconcileReconstructionSignedAvFromReceipts(ACTOR, 'flight_ready');
    expect(getSignedSceneAvDebugSnapshot()).toMatchObject({
      anchorId: 'anc.reconstruct.route-online'
    });
    markMilestone(RECONSTRUCTION_CALIBRATION_MILESTONE, ACTOR);
    reconcileReconstructionSignedAvFromReceipts(ACTOR, 'flight_ready');
    expect(getSignedSceneAvDebugSnapshot()).toMatchObject({
      anchorId: 'anc.reconstruct.calibration',
      activatedAnchorIds: [
        'anc.reconstruct.diagnosis',
        'anc.reconstruct.bench-online',
        'anc.reconstruct.frame-restored',
        'anc.reconstruct.hull-sealed',
        'anc.reconstruct.lift-online',
        'anc.reconstruct.first-hover',
        'anc.reconstruct.route-online',
        'anc.reconstruct.calibration'
      ]
    });
  });
});
