import { getLocalActorId, type ActorId } from '../playerActors.ts';
import { createPlayerPose, type PlayerPose, type PlayerPoseInput } from '../playerPose.ts';

export type PlayerPoseSnapshot = Record<ActorId, PlayerPose>;

const poses = new Map<ActorId, PlayerPose>();
const listeners = new Set<() => void>();
let reactSnapshot: readonly PlayerPose[] | null = Object.freeze([]);
const remoteReactSnapshots = new Map<ActorId, readonly PlayerPose[]>();

function invalidateReactSnapshot(): void {
  reactSnapshot = null;
}

function emit() {
  listeners.forEach(listener => listener());
}

export function setPlayerPose(input: PlayerPoseInput): PlayerPose {
  const pose = createPlayerPose(input);
  poses.set(pose.playerId, pose);
  invalidateReactSnapshot();
  emit();
  return pose;
}

export function getPlayerPose(actorId: ActorId): PlayerPose | null {
  return poses.get(actorId) ?? null;
}

export function getPlayerPoses(): PlayerPose[] {
  return [...poses.values()];
}

/**
 * Referentially stable snapshot for React's external-store contract. The
 * ordinary `getPlayerPoses` API intentionally keeps returning a caller-owned
 * array; React consumers use this cached read so an unchanged store cannot
 * manufacture another render while checking consistency.
 */
export function getPlayerPoseReactSnapshot(): readonly PlayerPose[] {
  reactSnapshot ??= Object.freeze([...poses.values()]);
  return reactSnapshot;
}

/**
 * Stable production snapshot for remote-avatar/minimap consumers. The local
 * physics body republishes every two rendered frames; shallow pose-reference
 * reuse keeps that local-only traffic from rerendering React subtrees which
 * immediately filter it back out.
 */
export function getRemotePlayerPoseReactSnapshot(
  localActorId: ActorId = getLocalActorId()
): readonly PlayerPose[] {
  const previous = remoteReactSnapshots.get(localActorId) ?? Object.freeze([]);
  const next = [...poses.values()].filter(pose => pose.playerId !== localActorId);
  if (next.length === previous.length
    && next.every((pose, index) => pose === previous[index])) {
    if (!remoteReactSnapshots.has(localActorId)) {
      remoteReactSnapshots.set(localActorId, previous);
    }
    return previous;
  }
  const snapshot = Object.freeze(next);
  remoteReactSnapshots.set(localActorId, snapshot);
  return snapshot;
}

export function resetPlayerPoses(): void {
  if (poses.size === 0) return;
  poses.clear();
  invalidateReactSnapshot();
  emit();
}

export function removePlayerPose(actorId: ActorId): void {
  if (!poses.delete(actorId)) return;
  invalidateReactSnapshot();
  emit();
}

export function clearRemotePlayerPoses(localActorId: ActorId = getLocalActorId()): void {
  let changed = false;
  for (const actorId of poses.keys()) {
    if (actorId === localActorId) continue;
    poses.delete(actorId);
    changed = true;
  }
  if (changed) {
    invalidateReactSnapshot();
    emit();
  }
}

export function subscribePlayerPoses(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

type PoseFrameScheduler = (callback: FrameRequestCallback) => number;
type PoseFrameCanceller = (handle: number) => void;

/**
 * Player poses are published from the fixed physics loop, which may run many
 * catch-up steps inside one rendered frame. React consumers must not schedule
 * a synchronous state update for every emission: doing so can recursively
 * re-enter an R3F root until React trips its maximum-update-depth guard.
 * Collapse each burst to one latest-snapshot read on the next animation frame.
 */
export function subscribePlayerPoseFrames(
  onStoreChange: () => void,
  scheduleFrame: PoseFrameScheduler = callback => window.requestAnimationFrame(callback),
  cancelFrame: PoseFrameCanceller = handle => window.cancelAnimationFrame(handle)
): () => void {
  let pendingFrame: number | null = null;
  const unsubscribe = subscribePlayerPoses(() => {
    if (pendingFrame !== null) return;
    pendingFrame = scheduleFrame(() => {
      pendingFrame = null;
      onStoreChange();
    });
  });
  return () => {
    unsubscribe();
    if (pendingFrame !== null) cancelFrame(pendingFrame);
    pendingFrame = null;
  };
}

export function getPlayerPoseSnapshot(): PlayerPoseSnapshot {
  return Object.fromEntries(poses) as PlayerPoseSnapshot;
}

export function applyPlayerPoseSnapshot(snapshot: PlayerPoseSnapshot, options: { replace?: boolean } = {}): void {
  if (options.replace ?? true) poses.clear();
  for (const pose of Object.values(snapshot)) {
    poses.set(pose.playerId, createPlayerPose(pose));
  }
  invalidateReactSnapshot();
  emit();
}
