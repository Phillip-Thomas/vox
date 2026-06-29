import { useEffect, useMemo, useState } from 'react';
import PlayerAvatar from './PlayerAvatar.tsx';
import { createPlayerPose, type PlayerActionMode, type PlayerPose, type Vec3Tuple } from '../game/playerPose.ts';
import { getLocalActorId } from '../game/playerActors.ts';
import { getPlayerPoses, subscribePlayerPoses } from '../game/systems/playerPoseSystem.ts';
import {
  getMultiplayerSessionSnapshot,
  shortPlayerId,
  subscribeMultiplayerSession,
  type MultiplayerSessionSnapshot
} from '../game/multiplayerSession.ts';

const COLORS = ['#7dd3fc', '#fbbf24', '#a7f3d0', '#f0abfc', '#fca5a5', '#c4b5fd'];
const DEMO_ACTOR_PREFIX = 'paravoxia-demo-avatar';
const DEMO_ANCHOR_Y = 51.5;
const DEMO_LABELS = new Map([
  [`${DEMO_ACTOR_PREFIX}-swim`, 'Tide Runner'],
  [`${DEMO_ACTOR_PREFIX}-jetpack`, 'Lift Crew'],
  [`${DEMO_ACTOR_PREFIX}-mine`, 'Maw Drill'],
  [`${DEMO_ACTOR_PREFIX}-build`, 'Base Frame']
]);

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

export function playerLabelsFromRoster(players: MultiplayerSessionSnapshot['players']): Map<string, string> {
  return new Map(players.map(player => [
    player.playerId,
    player.displayName || shortPlayerId(player.playerId)
  ]));
}

function normalize(tuple: Vec3Tuple, fallback: Vec3Tuple): Vec3Tuple {
  const length = Math.hypot(tuple[0], tuple[1], tuple[2]);
  if (length <= 1e-6) return fallback;
  return [tuple[0] / length, tuple[1] / length, tuple[2] / length];
}

function cross(a: Vec3Tuple, b: Vec3Tuple): Vec3Tuple {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function addScaled(position: Vec3Tuple, direction: Vec3Tuple, scale: number): Vec3Tuple {
  return [
    position[0] + direction[0] * scale,
    position[1] + direction[1] * scale,
    position[2] + direction[2] * scale
  ];
}

function offsetFromAnchor(
  anchor: PlayerPose,
  right: Vec3Tuple,
  forward: Vec3Tuple,
  up: Vec3Tuple,
  rightScale: number,
  forwardScale: number,
  upScale: number
): Vec3Tuple {
  return addScaled(addScaled(addScaled(anchor.position, forward, forwardScale), right, rightScale), up, upScale);
}

export function createAvatarDemoPoses(anchor: PlayerPose): PlayerPose[] {
  const up = normalize(anchor.up, [0, 1, 0]);
  const forward = normalize(anchor.forward, [0, 0, -1]);
  const right = normalize(cross(forward, up), [1, 0, 0]);
  const specs: Array<{
    id: string;
    action: PlayerActionMode;
    offset: [number, number, number];
    submergence?: number;
    miningProgress?: number;
    jetpackActive?: boolean;
  }> = [
    { id: 'swim', action: 'swim', offset: [-1.45, 3.2, 1.1], submergence: 1 },
    { id: 'jetpack', action: 'jetpack', offset: [-0.45, 2.75, 1.45], jetpackActive: true },
    { id: 'mine', action: 'mine', offset: [0.55, 2.8, 1.15], miningProgress: 0.82 },
    { id: 'build', action: 'build', offset: [1.55, 3.25, 1.1] }
  ];

  return specs.map((spec, index) => createPlayerPose({
    playerId: `${DEMO_ACTOR_PREFIX}-${spec.id}`,
    worldId: anchor.worldId,
    seq: anchor.seq + index + 1,
    timeMs: anchor.timeMs,
    position: offsetFromAnchor(anchor, right, forward, up, spec.offset[0], spec.offset[1], spec.offset[2]),
    velocity: [0, 0, 0],
    forward: anchor.forward,
    up: anchor.up,
    action: spec.action,
    submergence: spec.submergence ?? 0,
    miningProgress: spec.miningProgress ?? 0,
    jetpackActive: spec.jetpackActive ?? false
  }));
}

export function isAvatarDemoEnabled(search = typeof window === 'undefined' ? '' : window.location.search): boolean {
  return new URLSearchParams(search).get('avatarDemo') === '1';
}

export function createAvatarDemoAnchor(worldId = '0,0', playerId = 'paravoxia-demo-anchor'): PlayerPose {
  return createPlayerPose({
    playerId,
    worldId,
    position: [0, DEMO_ANCHOR_Y, 0],
    forward: [0, 0, -1],
    up: [0, 1, 0]
  });
}

export default function PlayerAvatarPoseHarness({
  worldId,
  includeLocal = false
}: {
  worldId?: string;
  includeLocal?: boolean;
}) {
  const [poses, setPoses] = useState(() => getPlayerPoses());
  const [players, setPlayers] = useState(() => getMultiplayerSessionSnapshot().players);
  const avatarDemo = isAvatarDemoEnabled();
  const localActorId = getLocalActorId();

  useEffect(() => subscribePlayerPoses(() => setPoses(getPlayerPoses())), []);
  useEffect(() => subscribeMultiplayerSession(() => setPlayers(getMultiplayerSessionSnapshot().players)), []);

  const visible = useMemo(
    () => {
      const selected = selectPosePlaybackPoses(poses, { worldId, includeLocal, localActorId });
      if (!avatarDemo) return selected;
      const anchor = poses.find(pose => pose.playerId === localActorId && (!worldId || pose.worldId === worldId))
        ?? createAvatarDemoAnchor(worldId, localActorId);
      return [...selected, ...createAvatarDemoPoses(anchor)];
    },
    [avatarDemo, includeLocal, localActorId, poses, worldId]
  );
  const labels = useMemo(() => {
    const rosterLabels = playerLabelsFromRoster(players);
    if (!avatarDemo) return rosterLabels;
    return new Map([...rosterLabels, ...DEMO_LABELS]);
  }, [avatarDemo, players]);

  return (
    <group userData={{ debug: 'player-avatar-pose-harness' }}>
      {visible.map((pose, index) => (
        <PlayerAvatar
          key={pose.playerId}
          pose={pose}
          color={COLORS[index % COLORS.length]}
          label={labels.get(pose.playerId)}
        />
      ))}
    </group>
  );
}
