import { getLocalActorId, type ActorId } from '../playerActors.ts';
import { createPlayerPose, type PlayerPose, type PlayerPoseInput } from '../playerPose.ts';

export type PlayerPoseSnapshot = Record<ActorId, PlayerPose>;

const poses = new Map<ActorId, PlayerPose>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach(listener => listener());
}

export function setPlayerPose(input: PlayerPoseInput): PlayerPose {
  const pose = createPlayerPose(input);
  poses.set(pose.playerId, pose);
  emit();
  return pose;
}

export function getPlayerPose(actorId: ActorId): PlayerPose | null {
  return poses.get(actorId) ?? null;
}

export function getPlayerPoses(): PlayerPose[] {
  return [...poses.values()];
}

export function resetPlayerPoses(): void {
  if (poses.size === 0) return;
  poses.clear();
  emit();
}

export function removePlayerPose(actorId: ActorId): void {
  if (!poses.delete(actorId)) return;
  emit();
}

export function clearRemotePlayerPoses(localActorId: ActorId = getLocalActorId()): void {
  let changed = false;
  for (const actorId of poses.keys()) {
    if (actorId === localActorId) continue;
    poses.delete(actorId);
    changed = true;
  }
  if (changed) emit();
}

export function subscribePlayerPoses(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getPlayerPoseSnapshot(): PlayerPoseSnapshot {
  return Object.fromEntries(poses) as PlayerPoseSnapshot;
}

export function applyPlayerPoseSnapshot(snapshot: PlayerPoseSnapshot, options: { replace?: boolean } = {}): void {
  if (options.replace ?? true) poses.clear();
  for (const pose of Object.values(snapshot)) {
    poses.set(pose.playerId, createPlayerPose(pose));
  }
  emit();
}
