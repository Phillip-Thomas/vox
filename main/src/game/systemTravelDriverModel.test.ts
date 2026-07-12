import { describe, expect, it } from 'vitest';
import {
  createSystemTravelGateState,
  isWithinSystemActivationEnvelope,
  rejectSystemTravelActivation,
  retrySystemTravelPreparation,
  transitionSystemTravelGate
} from './systemTravelDriverModel.ts';

const FAR_TARGET = {
  worldId: '0,0:p1',
  distance: 800,
  nominalFaceRadius: 50,
  ready: false
};

describe('system travel driver gate', () => {
  it('includes the exact atmosphere-envelope boundary', () => {
    expect(isWithinSystemActivationEnvelope(185.001, 50)).toBe(false);
    expect(isWithinSystemActivationEnvelope(185, 50)).toBe(true);
    expect(isWithinSystemActivationEnvelope(120, 50)).toBe(true);
    expect(isWithinSystemActivationEnvelope(-1, 50)).toBe(false);
  });

  it('commits and prepares a newly aimed body once', () => {
    const initial = createSystemTravelGateState();
    const first = transitionSystemTravelGate(initial, FAR_TARGET);
    const steady = transitionSystemTravelGate(first.state, FAR_TARGET);

    expect(first.actions).toEqual({
      commit: true,
      cancel: false,
      prepare: true,
      activate: false
    });
    expect(first.state.preparedWorldIds).toEqual(['0,0:p1']);
    expect(first.state.preparedLockWorldId).toBe('0,0:p1');
    expect(steady.state).toBe(first.state);
    expect(steady.actions).toEqual({
      commit: false,
      cancel: false,
      prepare: false,
      activate: false
    });
  });

  it('activates once when the same lock crosses the analytical boundary', () => {
    const prepared = transitionSystemTravelGate(createSystemTravelGateState(), FAR_TARGET);
    const arrived = transitionSystemTravelGate(prepared.state, {
      ...FAR_TARGET,
      distance: 185,
      ready: true
    });
    const repeated = transitionSystemTravelGate(arrived.state, {
      ...FAR_TARGET,
      distance: 100,
      ready: true
    });

    expect(arrived.actions).toEqual({
      commit: false,
      cancel: false,
      prepare: false,
      activate: true
    });
    expect(repeated.state).toBe(arrived.state);
    expect(repeated.actions.activate).toBe(false);
  });

  it('retries an activation whose handoff start or midpoint was rejected', () => {
    const prepared = transitionSystemTravelGate(createSystemTravelGateState(), FAR_TARGET);
    const arrived = transitionSystemTravelGate(prepared.state, {
      ...FAR_TARGET,
      distance: 180,
      ready: true
    });
    const rejected = rejectSystemTravelActivation(arrived.state, FAR_TARGET.worldId);
    const retry = transitionSystemTravelGate(rejected, {
      ...FAR_TARGET,
      distance: 175,
      ready: true
    });

    expect(rejected.lockedWorldId).toBeNull();
    expect(rejected.activatedLockWorldId).toBeNull();
    expect(retry.actions.commit).toBe(true);
    expect(retry.actions.activate).toBe(true);
  });

  it('restarts preparation after a committed target loses cache residency', () => {
    const prepared = transitionSystemTravelGate(createSystemTravelGateState(), FAR_TARGET);
    const arrived = transitionSystemTravelGate(prepared.state, {
      ...FAR_TARGET,
      distance: 180,
      ready: true
    });
    const rejected = rejectSystemTravelActivation(arrived.state, FAR_TARGET.worldId);
    const retry = transitionSystemTravelGate(rejected, {
      ...FAR_TARGET,
      distance: 170,
      ready: false
    });

    expect(retry.actions.commit).toBe(true);
    expect(retry.actions.prepare).toBe(true);
    expect(retry.actions.activate).toBe(false);
  });

  it('holds the prepared lock inside the envelope until the target is ready', () => {
    const prepared = transitionSystemTravelGate(createSystemTravelGateState(), FAR_TARGET);
    const waiting = transitionSystemTravelGate(prepared.state, {
      ...FAR_TARGET,
      distance: 100,
      ready: false
    });
    const ready = transitionSystemTravelGate(waiting.state, {
      ...FAR_TARGET,
      distance: 100,
      ready: true
    });

    expect(waiting.state).toBe(prepared.state);
    expect(waiting.actions.activate).toBe(false);
    expect(waiting.actions.prepare).toBe(false);
    expect(ready.actions.activate).toBe(true);
  });

  it('retargets directly and only cancels when the aim is cleared', () => {
    const first = transitionSystemTravelGate(createSystemTravelGateState(), FAR_TARGET);
    const second = transitionSystemTravelGate(first.state, {
      worldId: '0,0:p2',
      distance: 700,
      nominalFaceRadius: 50,
      ready: false
    });
    const cleared = transitionSystemTravelGate(second.state, null);

    expect(second.actions).toEqual({
      commit: true,
      cancel: false,
      prepare: true,
      activate: false
    });
    expect(cleared.actions.cancel).toBe(true);
    expect(cleared.state.lockedWorldId).toBeNull();
  });

  it('retries a superseded target epoch unless the previous payload is still ready', () => {
    const prepared = transitionSystemTravelGate(createSystemTravelGateState(), FAR_TARGET);
    const cleared = transitionSystemTravelGate(prepared.state, null);
    const retry = transitionSystemTravelGate(cleared.state, FAR_TARGET);
    const clearedAgain = transitionSystemTravelGate(retry.state, null);
    const readyRevisit = transitionSystemTravelGate(clearedAgain.state, {
      ...FAR_TARGET,
      distance: 100,
      ready: true
    });

    expect(retry.actions).toEqual({
      commit: true,
      cancel: false,
      prepare: true,
      activate: false
    });
    expect(readyRevisit.actions).toEqual({
      commit: true,
      cancel: false,
      prepare: false,
      activate: true
    });
  });

  it('retries a failed asynchronous preparation without releasing aim', () => {
    const prepared = transitionSystemTravelGate(createSystemTravelGateState(), FAR_TARGET);
    const retryable = retrySystemTravelPreparation(prepared.state, FAR_TARGET.worldId);
    const retry = transitionSystemTravelGate(retryable, FAR_TARGET);

    expect(retryable.lockedWorldId).toBe(FAR_TARGET.worldId);
    expect(retryable.preparedLockWorldId).toBeNull();
    expect(retry.actions.commit).toBe(false);
    expect(retry.actions.prepare).toBe(true);
  });
});
