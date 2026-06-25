import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyPlayerFlightSnapshot,
  getPlayerFlightSnapshot,
  getPlayerFlightState,
  resetPlayerFlightStates,
  setPlayerFlightState
} from './playerFlightSystem.ts';

beforeEach(resetPlayerFlightStates);

describe('player flight system', () => {
  it('stores canonical flight state per actor', () => {
    setPlayerFlightState({
      playerId: 'alice',
      seq: 1,
      phase: 'deep_space',
      controlMode: 'flight',
      target: { x: 2, y: 3 }
    });
    setPlayerFlightState({
      playerId: 'bob',
      seq: 1,
      phase: 'surface',
      controlMode: 'fps'
    });

    expect(getPlayerFlightState('alice')).toMatchObject({
      phase: 'deep_space',
      controlMode: 'flight',
      target: { x: 2, y: 3 }
    });
    expect(getPlayerFlightState('bob')).toMatchObject({
      phase: 'surface',
      controlMode: 'fps'
    });
  });

  it('round-trips through snapshots', () => {
    setPlayerFlightState({
      playerId: 'alice',
      seq: 5,
      phase: 'approach',
      controlMode: 'flight',
      destination: { x: 4, y: -1 },
      handoff: { status: 'requested', destination: { x: 4, y: -1 } }
    });

    const saved = getPlayerFlightSnapshot();
    resetPlayerFlightStates();
    applyPlayerFlightSnapshot(saved);

    expect(getPlayerFlightState('alice')).toMatchObject({
      seq: 5,
      phase: 'approach',
      destination: { x: 4, y: -1 },
      handoff: { status: 'requested', destination: { x: 4, y: -1 } }
    });
  });

  it('replace mode clears stale actors', () => {
    setPlayerFlightState({ playerId: 'stale', phase: 'deep_space', controlMode: 'flight' });

    applyPlayerFlightSnapshot({}, { replace: true });

    expect(getPlayerFlightState('stale')).toBeNull();
  });
});
