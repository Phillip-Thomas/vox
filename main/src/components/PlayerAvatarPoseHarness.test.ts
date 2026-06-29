import { describe, expect, it } from 'vitest';
import { createPlayerPose } from '../game/playerPose.ts';
import {
  createAvatarDemoAnchor,
  createAvatarDemoPoses,
  isAvatarDemoEnabled,
  playerLabelsFromRoster,
  selectPosePlaybackPoses
} from './PlayerAvatarPoseHarness.tsx';

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

  it('creates debug-only avatar demo poses near the local player', () => {
    const demo = createAvatarDemoPoses(createPlayerPose({
      playerId: 'local',
      worldId: '0,0',
      seq: 10,
      timeMs: 1000,
      position: [0, 50, 0],
      forward: [0, 0, -1],
      up: [0, 1, 0]
    }));

    expect(demo.map(pose => pose.action)).toEqual(['swim', 'jetpack', 'mine', 'build']);
    expect(demo.every(pose => pose.worldId === '0,0')).toBe(true);
    expect(demo.every(pose => pose.playerId.startsWith('paravoxia-demo-avatar-'))).toBe(true);
    expect(demo[0].position[2]).toBeLessThan(0);
  });

  it('creates a fixed avatar demo anchor for agent-camera screenshots', () => {
    const anchor = createAvatarDemoAnchor('2,-1', 'local-demo');

    expect(anchor.playerId).toBe('local-demo');
    expect(anchor.worldId).toBe('2,-1');
    expect(anchor.position).toEqual([0, 51.5, 0]);
    expect(anchor.forward).toEqual([0, 0, -1]);
  });

  it('enables avatar demo only through the explicit query flag', () => {
    expect(isAvatarDemoEnabled('?avatarDemo=1')).toBe(true);
    expect(isAvatarDemoEnabled('?debug=1')).toBe(false);
    expect(isAvatarDemoEnabled('?avatarDemo=true')).toBe(false);
  });
});
