import { useEffect, useMemo, useState } from 'react';
import PlayerAvatar from './PlayerAvatar.tsx';
import type { PlayerPose } from '../game/playerPose.ts';
import { getLocalActorId } from '../game/playerActors.ts';
import { getPlayerPoses, subscribePlayerPoses } from '../game/systems/playerPoseSystem.ts';

const COLORS = ['#7dd3fc', '#fbbf24', '#a7f3d0', '#f0abfc', '#fca5a5', '#c4b5fd'];

export interface PosePlaybackOptions {
  worldId?: string;
  includeLocal?: boolean;
  localActorId?: string;
}

export function selectPosePlaybackPoses(
  poses: PlayerPose[],
  { worldId, includeLocal = false, localActorId = getLocalActorId() }: PosePlaybackOptions = {}
): PlayerPose[] {
  return poses
    .filter(pose => !worldId || pose.worldId === worldId)
    .filter(pose => includeLocal || pose.playerId !== localActorId)
    .sort((a, b) => a.playerId.localeCompare(b.playerId));
}

export default function PlayerAvatarPoseHarness({
  worldId,
  includeLocal = false
}: {
  worldId?: string;
  includeLocal?: boolean;
}) {
  const [poses, setPoses] = useState(() => getPlayerPoses());

  useEffect(() => subscribePlayerPoses(() => setPoses(getPlayerPoses())), []);

  const visible = useMemo(
    () => selectPosePlaybackPoses(poses, { worldId, includeLocal }),
    [includeLocal, poses, worldId]
  );

  return (
    <group userData={{ debug: 'player-avatar-pose-harness' }}>
      {visible.map((pose, index) => (
        <PlayerAvatar
          key={pose.playerId}
          pose={pose}
          color={COLORS[index % COLORS.length]}
        />
      ))}
    </group>
  );
}
