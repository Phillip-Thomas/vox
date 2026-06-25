import { describe, expect, it } from 'vitest';
import { createPlayerPose } from '../game/playerPose.ts';
import { playerLabelsFromRoster, selectPosePlaybackPoses } from './PlayerAvatarPoseHarness.tsx';

describe('PlayerAvatarPoseHarness', () => {
  const poses = [
    createPlayerPose({ playerId: 'remote-b', worldId: '0,0', position: [2, 0, 0] }),
    createPlayerPose({ playerId: 'local', worldId: '0,0', position: [0, 0, 0] }),
    createPlayerPose({ playerId: 'remote-a', worldId: '0,0', position: [1, 0, 0] }),
    createPlayerPose({ playerId: 'remote-c', worldId: '1,0', position: [3, 0, 0] })
  ];

  it('filters out the local player by default and keeps stable actor order', () => {
    expect(selectPosePlaybackPoses(poses, { localActorId: 'local' }).map(pose => pose.playerId))
      .toEqual(['remote-a', 'remote-b', 'remote-c']);
  });

  it('can include the local player for debug playback', () => {
    expect(selectPosePlaybackPoses(poses, { includeLocal: true, localActorId: 'local' }).map(pose => pose.playerId))
      .toEqual(['local', 'remote-a', 'remote-b', 'remote-c']);
  });

  it('filters playback to the active world', () => {
    expect(selectPosePlaybackPoses(poses, { worldId: '0,0', localActorId: 'local' }).map(pose => pose.playerId))
      .toEqual(['remote-a', 'remote-b']);
  });

  it('maps roster display names onto remote avatar labels', () => {
    const labels = playerLabelsFromRoster([
      { playerId: 'remote-a', displayName: 'Alice', connected: true },
      { playerId: '0123456789abcdef', connected: true }
    ]);
    expect(labels.get('remote-a')).toBe('Alice');
    expect(labels.get('0123456789abcdef')).toBe('0123...cdef');
  });
});
