import { beforeEach, describe, expect, it } from 'vitest';
import { getPlayerFlightState, resetPlayerFlightStates } from '../game/systems/playerFlightSystem.ts';
import { resetLocalActorId, setLocalActorId } from '../game/playerActors.ts';
import {
  WARP_DURATION,
  beginTravel,
  enterShip,
  exitShip,
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
});
