import { describe, expect, it } from 'vitest';
import { createPlayerPose, PLAYER_ACTION_MODES } from './playerPose.ts';

describe('player pose schema', () => {
  it('defines the locomotion/action modes needed for remote presentation', () => {
    expect(PLAYER_ACTION_MODES).toEqual([
      'idle',
      'walk',
      'swim',
      'jetpack',
      'climb',
      'sprint',
      'mine',
      'build',
      'drink',
      'warp'
    ]);
  });

  it('normalizes missing and unsafe pose values', () => {
    const pose = createPlayerPose({
      playerId: 'alice',
      worldId: '0,0',
      seq: 3.7,
      timeMs: Number.NaN,
      position: [1, Number.NaN, 3],
      submergence: 2,
      miningProgress: -1,
      jetpackActive: true
    });

    expect(pose.seq).toBe(3);
    expect(pose.timeMs).toBe(0);
    expect(pose.position).toEqual([1, 0, 3]);
    expect(pose.velocity).toEqual([0, 0, 0]);
    expect(pose.forward).toEqual([0, 0, -1]);
    expect(pose.up).toEqual([0, 1, 0]);
    expect(pose.action).toBe('idle');
    expect(pose.submergence).toBe(1);
    expect(pose.miningProgress).toBe(0);
    expect(pose.jetpackActive).toBe(true);
  });
});
