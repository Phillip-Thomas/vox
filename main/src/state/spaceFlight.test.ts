import { beforeEach, describe, expect, it } from 'vitest';
import { getPlayerFlightState, resetPlayerFlightStates } from '../game/systems/playerFlightSystem.ts';
import { resetLocalActorId, setLocalActorId } from '../game/playerActors.ts';
import {
  WARP_DURATION,
  MINI_WARP_DURATION,
  beginSystemHandoff,
  beginTravel,
  debugStartInSpace,
  enterShip,
  exitShip,
  getWarp,
  resetTravel,
  tickWarp
} from './spaceFlight.ts';

beforeEach(() => {
  resetLocalActorId();
  setLocalActorId('alice');
  resetTravel();
  resetPlayerFlightStates();
});

describe('spaceFlight canonical player state publishing', () => {
  it('publishes per-player phase/control transitions while local visuals stay in spaceFlight', () => {
    enterShip();

    expect(getPlayerFlightState('alice')).toMatchObject({
      playerId: 'alice',
      phase: 'surface',
      controlMode: 'flight'
    });

    exitShip();

    expect(getPlayerFlightState('alice')).toMatchObject({
      phase: 'surface',
      controlMode: 'fps'
    });
  });

  it('publishes shard handoff status around travel warp boundaries', () => {
    const destination = { x: 9, y: -4 };

    beginTravel(destination);

    expect(getPlayerFlightState('alice')).toMatchObject({
      phase: 'approach',
      controlMode: 'fps',
      destination,
      target: destination,
      handoff: { status: 'requested', destination }
    });

    tickWarp(WARP_DURATION / 2);

    expect(getPlayerFlightState('alice')).toMatchObject({
      phase: 'deep_space',
      controlMode: 'flight',
      handoff: { status: 'midpoint', destination }
    });

    tickWarp(WARP_DURATION / 2);

    expect(getPlayerFlightState('alice')).toMatchObject({
      phase: 'deep_space',
      controlMode: 'flight',
      handoff: { status: 'complete', destination }
    });
  });

  it('holds a local system handoff at peak cover until the new scene paints', () => {
    debugStartInSpace();
    let ready = true;
    let midpointCalls = 0;
    let readyChecks = 0;
    expect(beginSystemHandoff({
      worldId: '0,0:p1',
      activationEpoch: 4,
      isCurrent: () => true,
      onMidpoint: () => {
        midpointCalls++;
        ready = false;
        return true;
      },
      readyToReveal: () => {
        readyChecks++;
        return ready;
      }
    })).toBe(true);

    tickWarp(MINI_WARP_DURATION / 2);
    expect(midpointCalls).toBe(1);
    expect(getWarp().progress).toBe(0.5);
    tickWarp(0.2);
    expect(getWarp().progress).toBe(0.5);

    ready = true;
    tickWarp(0.05);
    expect(getWarp().progress).toBeGreaterThan(0.5);
    const checksAtRelease = readyChecks;
    tickWarp(0.05);
    expect(readyChecks).toBe(checksAtRelease);
    tickWarp(MINI_WARP_DURATION / 2);
    expect(getWarp().active).toBe(false);
  });

  it('fades back without committing when the midpoint lease is stale', () => {
    debugStartInSpace();
    let midpointCalls = 0;
    let abortReason = '';
    expect(beginSystemHandoff({
      worldId: '0,0:p1',
      activationEpoch: 8,
      isCurrent: () => false,
      onMidpoint: () => {
        midpointCalls++;
        return true;
      },
      readyToReveal: () => true,
      onAbort: reason => { abortReason = reason; }
    })).toBe(true);

    tickWarp(MINI_WARP_DURATION / 2, 1_000);
    expect(midpointCalls).toBe(0);
    expect(abortReason).toBe('lease_invalidated');
    expect(getWarp().progress).toBe(0.5);
    tickWarp(MINI_WARP_DURATION / 2, 1_425);
    expect(getWarp().active).toBe(false);
  });

  it('uses elapsed wall time for the renderer-ready hold cap', () => {
    debugStartInSpace();
    expect(beginSystemHandoff({
      worldId: '0,0:p1',
      activationEpoch: 9,
      isCurrent: () => true,
      onMidpoint: () => true,
      readyToReveal: () => false
    })).toBe(true);

    tickWarp(MINI_WARP_DURATION / 2, 2_000);
    expect(getWarp().progress).toBe(0.5);
    tickWarp(0.01, 2_751);
    expect(getWarp().progress).toBeGreaterThan(0.5);
  });
});
