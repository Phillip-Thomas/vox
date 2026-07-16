import { describe, expect, it } from 'vitest';
import { createPlayerPose } from '../game/playerPose.ts';
import {
  getPlayerPoseReactSnapshot,
  getRemotePlayerPoseReactSnapshot,
  resetPlayerPoses,
  setPlayerPose,
  subscribePlayerPoseFrames
} from '../game/systems/playerPoseSystem.ts';
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

  it('coalesces fixed-step pose bursts into one React-facing frame snapshot', () => {
    resetPlayerPoses();
    const emptySnapshot = getPlayerPoseReactSnapshot();
    const emptyRemoteSnapshot = getRemotePlayerPoseReactSnapshot('local');
    expect(getPlayerPoseReactSnapshot()).toBe(emptySnapshot);
    expect(getRemotePlayerPoseReactSnapshot('local')).toBe(emptyRemoteSnapshot);
    const pending = new Map<number, FrameRequestCallback>();
    const cancelled: number[] = [];
    const snapshots: Array<readonly ReturnType<typeof createPlayerPose>[]> = [];
    let nextHandle = 1;
    const unsubscribe = subscribePlayerPoseFrames(
      () => snapshots.push(getPlayerPoseReactSnapshot()),
      callback => {
        const handle = nextHandle++;
        pending.set(handle, callback);
        return handle;
      },
      handle => {
        cancelled.push(handle);
        pending.delete(handle);
      }
    );

    for (let seq = 1; seq <= 80; seq++) {
      setPlayerPose({ playerId: 'local', worldId: '0,0', seq, position: [seq, 0, 0] });
    }
    expect(pending.size).toBe(1);
    expect(snapshots).toHaveLength(0);
    const burstSnapshot = getPlayerPoseReactSnapshot();
    expect(burstSnapshot).not.toBe(emptySnapshot);
    expect(getPlayerPoseReactSnapshot()).toBe(burstSnapshot);
    expect(burstSnapshot[0]).toMatchObject({ seq: 80, position: [80, 0, 0] });
    expect(getRemotePlayerPoseReactSnapshot('local')).toBe(emptyRemoteSnapshot);

    const [firstHandle, firstFrame] = [...pending.entries()][0]!;
    pending.delete(firstHandle);
    firstFrame(16);
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toBe(burstSnapshot);
    expect(snapshots[0][0]).toMatchObject({ seq: 80, position: [80, 0, 0] });

    setPlayerPose({ playerId: 'local', worldId: '0,0', seq: 81, position: [81, 0, 0] });
    expect(pending.size).toBe(1);
    const nextLocalSnapshot = getPlayerPoseReactSnapshot();
    expect(nextLocalSnapshot).not.toBe(burstSnapshot);
    expect(getPlayerPoseReactSnapshot()).toBe(nextLocalSnapshot);
    expect(getRemotePlayerPoseReactSnapshot('local')).toBe(emptyRemoteSnapshot);

    setPlayerPose({
      playerId: 'remote',
      worldId: '0,0',
      seq: 1,
      position: [4, 0, 0]
    });
    const remoteSnapshot = getRemotePlayerPoseReactSnapshot('local');
    expect(remoteSnapshot).not.toBe(emptyRemoteSnapshot);
    expect(getRemotePlayerPoseReactSnapshot('local')).toBe(remoteSnapshot);
    expect(remoteSnapshot.map(pose => pose.playerId)).toEqual(['remote']);
    const secondHandle = [...pending.keys()][0]!;
    unsubscribe();
    expect(cancelled).toEqual([secondHandle]);
    expect(pending.size).toBe(0);
    resetPlayerPoses();
  });

  it('keeps remote React snapshots stable across separately flushed local pose frames', () => {
    resetPlayerPoses();
    const pending = new Map<number, FrameRequestCallback>();
    let nextHandle = 1;
    let notifications = 0;
    let identityChanges = 0;
    let selectedSnapshot = getRemotePlayerPoseReactSnapshot('local');
    const unsubscribe = subscribePlayerPoseFrames(
      () => {
        notifications += 1;
        const nextSnapshot = getRemotePlayerPoseReactSnapshot('local');
        if (nextSnapshot !== selectedSnapshot) identityChanges += 1;
        selectedSnapshot = nextSnapshot;
      },
      callback => {
        const handle = nextHandle++;
        pending.set(handle, callback);
        return handle;
      },
      handle => pending.delete(handle)
    );
    const flushFrame = (time: number) => {
      expect(pending.size).toBe(1);
      const [handle, callback] = [...pending.entries()][0]!;
      pending.delete(handle);
      callback(time);
    };

    // This mirrors the runtime failure: one local publication every second
    // rendered frame, with the subscriber callback flushed between writes.
    for (let seq = 1; seq <= 60; seq++) {
      setPlayerPose({ playerId: 'local', worldId: '0,0', seq, position: [seq, 0, 0] });
      flushFrame(seq * 2);
    }
    expect(notifications).toBe(60);
    expect(identityChanges).toBe(0);
    expect(selectedSnapshot).toHaveLength(0);

    setPlayerPose({ playerId: 'remote', worldId: '0,0', seq: 1, position: [4, 0, 0] });
    flushFrame(122);
    expect(notifications).toBe(61);
    expect(identityChanges).toBe(1);
    expect(selectedSnapshot.map(pose => pose.playerId)).toEqual(['remote']);

    for (let seq = 61; seq <= 70; seq++) {
      setPlayerPose({ playerId: 'local', worldId: '0,0', seq, position: [seq, 0, 0] });
      flushFrame(seq * 2);
    }
    expect(notifications).toBe(71);
    expect(identityChanges).toBe(1);

    unsubscribe();
    resetPlayerPoses();
  });
});
