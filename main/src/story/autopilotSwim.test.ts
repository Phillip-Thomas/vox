import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  autopilotSwimPhysicsOverride,
  nextDiveAimReady,
  nextDiveColumnLock,
  nextDiveRecoveryState,
  planAutopilotSwim
} from './autopilotSwim.ts';

const UP = new THREE.Vector3(0, 1, 0);

describe('movie autopilot 6-DOF swim intent', () => {
  it('holds the shore setup until the embodied camera is pitched into the pond', () => {
    expect(nextDiveAimReady({
      active: false,
      pitch: -0.2,
      shoreDistance: 2.8,
      submergence: 0
    })).toBe(false);
    expect(nextDiveAimReady({
      active: false,
      pitch: -0.7,
      shoreDistance: 2.8,
      submergence: 0
    })).toBe(false);
    expect(nextDiveAimReady({
      active: false,
      pitch: -1.05,
      shoreDistance: 2.8,
      submergence: 0
    })).toBe(true);
    expect(nextDiveAimReady({
      active: false,
      pitch: 0,
      shoreDistance: 20,
      submergence: 0
    })).toBe(false);
    expect(nextDiveAimReady({
      active: false,
      pitch: 0,
      shoreDistance: 20,
      submergence: 0.02
    })).toBe(true);
  });

  it('switches fixed-step controls from pitched dive to player-axis ascent', () => {
    expect(autopilotSwimPhysicsOverride({
      submergence: 0,
      acquired: false,
      recoveryActive: false,
      oxygen: 100,
      columnLocked: false
    })).toBeNull();
    expect(autopilotSwimPhysicsOverride({
      submergence: 0.009,
      acquired: false,
      recoveryActive: false,
      oxygen: 100,
      columnLocked: false
    })).toBeNull();
    expect(autopilotSwimPhysicsOverride({
      submergence: 0.02,
      acquired: false,
      recoveryActive: false,
      oxygen: 100,
      columnLocked: false
    })).toBe('dive');
    expect(autopilotSwimPhysicsOverride({
      submergence: 0.2,
      acquired: false,
      recoveryActive: false,
      oxygen: 100,
      columnLocked: false
    })).toBe('dive');
    expect(autopilotSwimPhysicsOverride({
      submergence: 0.9,
      acquired: false,
      recoveryActive: false,
      oxygen: 90,
      columnLocked: true
    })).toBe('hold');
    expect(autopilotSwimPhysicsOverride({
      submergence: 0.9,
      acquired: true,
      surfaceReceipt: true,
      recoveryActive: false,
      oxygen: 90,
      columnLocked: true
    })).toBe('ascend');
    expect(autopilotSwimPhysicsOverride({
      submergence: 0.2,
      acquired: true,
      surfaceReceipt: false,
      recoveryActive: false,
      oxygen: 100,
      columnLocked: false
    })).toBe('dive');
    expect(autopilotSwimPhysicsOverride({
      submergence: 0.9,
      acquired: false,
      recoveryActive: false,
      oxygen: 37,
      columnLocked: true
    })).toBe('ascend');
  });

  it('pitches the real forward swim control toward a below-water target', () => {
    const plan = planAutopilotSwim({
      player: new THREE.Vector3(6, 50, -12),
      target: new THREE.Vector3(6, 44.8, -12),
      up: UP,
      submergence: 0.8,
      stopDistance: 2.4,
      mode: 'dive'
    });

    expect(plan.useFluidLook).toBe(true);
    expect(plan.useFluidMovement).toBe(true);
    expect(plan.surfaceMoveScale).toBe(1);
    expect(plan.forward).toBe(true);
    expect(plan.ascend).toBe(false);
    expect(plan.aligningOverTarget).toBe(false);
    expect(plan.lookDirection.dot(UP)).toBeLessThan(-0.95);
  });

  it('uses a precision surface gait only near the authored dive column', () => {
    const target = new THREE.Vector3(6, 44.8, -12);
    const near = planAutopilotSwim({
      player: new THREE.Vector3(9, 50, -12),
      target,
      up: UP,
      submergence: 0,
      stopDistance: 2.4,
      mode: 'dive'
    });
    const far = planAutopilotSwim({
      player: new THREE.Vector3(12, 50, -12),
      target,
      up: UP,
      submergence: 0,
      stopDistance: 2.4,
      mode: 'dive'
    });
    expect(near.surfaceMoveScale).toBeLessThan(0.2);
    expect(far.surfaceMoveScale).toBe(1);
  });

  it('clears a raised pond-floor lip laterally before pitching into the target column', () => {
    const approach = planAutopilotSwim({
      player: new THREE.Vector3(7.1, 48.8, -12.5),
      target: new THREE.Vector3(6, 44.8, -12),
      up: UP,
      submergence: 1,
      stopDistance: 2.4,
      mode: 'dive'
    });
    expect(approach.aligningOverTarget).toBe(true);
    expect(approach.lookDirection.dot(UP)).toBeCloseTo(0);
    expect(approach.lookDirection.x).toBeLessThan(0);
    expect(approach.lookDirection.z).toBeGreaterThan(0);

    const descend = planAutopilotSwim({
      player: new THREE.Vector3(6.25, 48.8, -12.2),
      target: new THREE.Vector3(6, 44.8, -12),
      up: UP,
      submergence: 1,
      stopDistance: 2.4,
      mode: 'dive'
    });
    expect(descend.aligningOverTarget).toBe(false);
    expect(descend.lookDirection.dot(UP)).toBeLessThan(-0.98);
  });

  it('locks a physically reached floor column through a long sonar dwell', () => {
    const target = new THREE.Vector3(6, 44.8, -12);
    expect(nextDiveColumnLock({
      active: false,
      player: new THREE.Vector3(6.6, 48.4, -12.5),
      target,
      up: UP,
      submergence: 0.99,
      stopDistance: 2.4
    })).toBe(false);
    expect(nextDiveColumnLock({
      active: true,
      player: new THREE.Vector3(6.6, 50.5, -12.5),
      target,
      up: UP,
      submergence: 0.2,
      stopDistance: 2.4
    })).toBe(false);
    expect(nextDiveColumnLock({
      active: false,
      player: new THREE.Vector3(5.5, 46.8, -11.5),
      target,
      up: UP,
      submergence: 0.99,
      stopDistance: 2.4
    })).toBe(true);
    expect(nextDiveColumnLock({
      active: true,
      player: new THREE.Vector3(7.4, 48.8, -12.8),
      target,
      up: UP,
      submergence: 0.8,
      stopDistance: 2.4
    })).toBe(true);
    expect(nextDiveColumnLock({
      active: false,
      player: new THREE.Vector3(6.6, 50.5, -12.5),
      target,
      up: UP,
      submergence: 0.2,
      stopDistance: 2.4
    })).toBe(false);

    const held = planAutopilotSwim({
      player: new THREE.Vector3(7.1, 48.8, -12.5),
      target,
      up: UP,
      submergence: 1,
      stopDistance: 2.4,
      mode: 'dive',
      columnLocked: true
    });
    expect(held.aligningOverTarget).toBe(false);
    expect(held.lookDirection.dot(UP)).toBeLessThan(-0.9);
  });

  it('keeps the entry ray pitched down until it reaches the pond floor', () => {
    const entry = planAutopilotSwim({
      player: new THREE.Vector3(5.6, 49.8, -11.7),
      target: new THREE.Vector3(6, 44.8, -12),
      up: UP,
      submergence: 0.95,
      stopDistance: 2.4,
      mode: 'dive'
    });
    expect(entry.aligningOverTarget).toBe(false);
    expect(entry.lookDirection.dot(UP)).toBeLessThan(-0.98);
  });

  it('ascends while returning, then walks and banks only after surfacing', () => {
    const underwater = planAutopilotSwim({
      player: new THREE.Vector3(6, 45, -12),
      target: new THREE.Vector3(8, 50, -8),
      up: UP,
      submergence: 0.9,
      stopDistance: 2.7,
      mode: 'surface'
    });
    expect(underwater.forward).toBe(true);
    expect(underwater.ascend).toBe(true);
    expect(underwater.lookDirection.dot(UP)).toBeGreaterThan(0.6);

    const shore = planAutopilotSwim({
      player: new THREE.Vector3(7.8, 50, -8.1),
      target: new THREE.Vector3(8, 50, -8),
      up: UP,
      submergence: 0.1,
      stopDistance: 2.7,
      mode: 'surface'
    });
    expect(shore.forward).toBe(false);
    expect(shore.ascend).toBe(false);
    expect(shore.useFluidLook).toBe(true);
    expect(shore.useFluidMovement).toBe(true);
  });

  it('pre-pitches toward the Keel while dry but keeps surface-constrained gait', () => {
    const plan = planAutopilotSwim({
      player: new THREE.Vector3(8, 52.8, -6),
      target: new THREE.Vector3(6, 44.8, -12),
      up: UP,
      submergence: 0,
      stopDistance: 2.4,
      mode: 'dive'
    });
    expect(plan.useFluidLook).toBe(true);
    expect(plan.useFluidMovement).toBe(false);
    expect(plan.lookDirection.dot(UP)).toBeLessThan(-0.7);
  });

  it('releases dry gait only after aligning over the water cell so gravity can enter it', () => {
    const aligned = planAutopilotSwim({
      player: new THREE.Vector3(5.8, 52.6, -12.2),
      target: new THREE.Vector3(6, 44.8, -12),
      up: UP,
      submergence: 0,
      stopDistance: 2.4,
      mode: 'dive'
    });
    expect(aligned.lateralDistance).toBeLessThan(0.58);
    expect(aligned.settlingIntoWater).toBe(true);
    expect(aligned.forward).toBe(false);

    const rim = planAutopilotSwim({
      player: new THREE.Vector3(7.1, 52.6, -12.6),
      target: new THREE.Vector3(6, 44.8, -12),
      up: UP,
      submergence: 0,
      stopDistance: 2.4,
      mode: 'dive'
    });
    expect(rim.settlingIntoWater).toBe(false);
    expect(rim.forward).toBe(true);
  });

  it('surfaces before oxygen is critical and resumes only after breathing', () => {
    expect(nextDiveRecoveryState({ active: false, oxygen: 37, submergence: 0.9 })).toBe(true);
    expect(nextDiveRecoveryState({ active: true, oxygen: 70, submergence: 0.1 })).toBe(true);
    expect(nextDiveRecoveryState({ active: true, oxygen: 86, submergence: 0.1 })).toBe(false);
  });
});
