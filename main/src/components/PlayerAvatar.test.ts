import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createPlayerPose } from '../game/playerPose.ts';
import { getPlayerLook, getPlayerWorldPosition, setPlayerLook, setPlayerWorldPosition } from '../state/playerFrame.ts';
import { createPlayerAvatarTransform } from './PlayerAvatar.tsx';

describe('PlayerAvatar transform', () => {
  it('derives a render transform from pose without writing local player singletons', () => {
    setPlayerWorldPosition(new THREE.Vector3(9, 8, 7));
    setPlayerLook(new THREE.Vector3(1, 0, 0), 0.25);

    const pose = createPlayerPose({
      playerId: 'remote',
      worldId: '0,0',
      position: [1, 2, 3],
      forward: [0, 0, 1],
      up: [0, 1, 0],
      action: 'walk'
    });
    const transform = createPlayerAvatarTransform(pose);

    expect(transform.position).toEqual([1, 2, 3]);
    expect(transform.quaternion).toHaveLength(4);
    expect(getPlayerWorldPosition().toArray()).toEqual([9, 8, 7]);
    expect(getPlayerLook().forward.toArray()).toEqual([1, 0, 0]);
    expect(getPlayerLook().pitch).toBe(0.25);
  });
});
