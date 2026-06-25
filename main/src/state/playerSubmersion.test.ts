import { beforeEach, describe, expect, it } from 'vitest';
import { resetLocalActorId, setLocalActorId } from '../game/playerActors.ts';
import {
  getPlayerDepthBelow,
  getPlayerSubmergence,
  getPlayerSubmersion,
  isPlayerSubmerged,
  resetPlayerSubmersion,
  setLocalPlayerSubmersion,
  setPlayerSubmersion
} from './playerSubmersion.ts';

beforeEach(() => {
  resetLocalActorId();
  resetPlayerSubmersion();
});

describe('player submersion state', () => {
  it('keeps local effect getters tied to the local player only', () => {
    setLocalActorId('alice');

    setLocalPlayerSubmersion(0.75, 4);
    setPlayerSubmersion('remote-bob', 1, 20);

    expect(getPlayerSubmergence()).toBe(0.75);
    expect(getPlayerDepthBelow()).toBe(4);
    expect(isPlayerSubmerged()).toBe(true);
    expect(getPlayerSubmersion('remote-bob')).toMatchObject({
      actorId: 'remote-bob',
      submergence: 1,
      depthBelow: 20
    });
  });

  it('normalizes actor-keyed values for pose and vitals consumers', () => {
    const state = setPlayerSubmersion('remote-bob', 2, -10);

    expect(state).toEqual({
      actorId: 'remote-bob',
      submergence: 1,
      depthBelow: 0
    });
  });

  it('can reset remote actors without clearing local effects', () => {
    setLocalActorId('alice');
    setLocalPlayerSubmersion(0.6, 2);
    setPlayerSubmersion('remote-bob', 1, 20);

    resetPlayerSubmersion('remote-bob');

    expect(getPlayerSubmergence()).toBe(0.6);
    expect(getPlayerSubmersion('remote-bob')).toMatchObject({
      actorId: 'remote-bob',
      submergence: 0,
      depthBelow: 0
    });
  });
});
