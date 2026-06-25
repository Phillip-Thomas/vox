import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createPlayerPose } from '../game/playerPose.ts';
import { getPlayerLook, getPlayerWorldPosition, setPlayerLook, setPlayerWorldPosition } from '../state/playerFrame.ts';
import {
  REMOTE_AVATAR_MAX_LEAD_DISTANCE,
  REMOTE_AVATAR_VELOCITY_LEAD_SECONDS,
  createPlayerAvatarPresentation,
  createPlayerAvatarRenderTarget,
  createPlayerAvatarTransform
} from './PlayerAvatar.tsx';

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

  it('presents remote swim, jetpack, mining, and build states as distinct visuals', () => {
    const swim = createPlayerAvatarPresentation(createPlayerPose({
      playerId: 'remote-swim',
      worldId: '0,0',
      action: 'swim',
      submergence: 1
    }));
    expect(swim.bodyColor).toBe('#38bdf8');
    expect(swim.bodyRotation[0]).toBeCloseTo(Math.PI / 2);

    const jetpack = createPlayerAvatarPresentation(createPlayerPose({
      playerId: 'remote-jetpack',
      worldId: '0,0',
      action: 'jetpack',
      jetpackActive: true
    }));
    expect(jetpack.showJetpackFlame).toBe(true);

    const mine = createPlayerAvatarPresentation(createPlayerPose({
      playerId: 'remote-mine',
      worldId: '0,0',
      action: 'mine',
      miningProgress: 0.7
    }));
    expect(mine.bodyColor).toBe('#fbbf24');
    expect(mine.showMiningTool).toBe(true);
    expect(mine.miningToolOpacity).toBeCloseTo(0.7);

    const build = createPlayerAvatarPresentation(createPlayerPose({
      playerId: 'remote-build',
      worldId: '0,0',
      action: 'build'
    }));
    expect(build.bodyColor).toBe('#86efac');
    expect(build.showBuildPreview).toBe(true);
  });

  it('leads remote movement targets by velocity and clamps extreme speeds', () => {
    const walking = createPlayerAvatarRenderTarget(createPlayerPose({
      playerId: 'remote-walk',
      worldId: '0,0',
      position: [1, 2, 3],
      velocity: [4, 0, 0]
    }));
    expect(walking.position[0]).toBeCloseTo(1 + 4 * REMOTE_AVATAR_VELOCITY_LEAD_SECONDS);
    expect(walking.position[1]).toBeCloseTo(2);
    expect(walking.position[2]).toBeCloseTo(3);

    const sprinting = createPlayerAvatarRenderTarget(createPlayerPose({
      playerId: 'remote-sprint',
      worldId: '0,0',
      position: [1, 2, 3],
      velocity: [100, 0, 0]
    }));
    expect(sprinting.position[0]).toBeCloseTo(1 + REMOTE_AVATAR_MAX_LEAD_DISTANCE);
  });

  it('does not velocity-lead teleport poses', () => {
    const target = createPlayerAvatarRenderTarget(createPlayerPose({
      playerId: 'remote-respawn',
      worldId: '0,0',
      position: [1, 2, 3],
      velocity: [4, 0, 0],
      teleport: true
    }));
    expect(target.position).toEqual([1, 2, 3]);
  });
});
