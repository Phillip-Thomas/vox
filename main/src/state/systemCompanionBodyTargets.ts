import * as THREE from 'three';

export interface SystemCompanionBodyTargetPosition {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * Imperative render-loop bridge for a mounted companion body's physical center.
 *
 * The published vector is owned by the handle and keeps a stable identity, so
 * HUD consumers can read it every frame without React state or allocations.
 */
export interface SystemCompanionBodyTargetHandle {
  readonly worldId: string;
  publish(position: SystemCompanionBodyTargetPosition): void;
  read(): THREE.Vector3 | null;
  remove(): void;
}

interface PublishedSystemCompanionBodyTarget {
  readonly owner: symbol;
  readonly position: THREE.Vector3;
}

const publishedTargets = new Map<string, PublishedSystemCompanionBodyTarget>();

/**
 * Read the current physical render-space center for a mounted system body.
 * Consumers must treat the returned stable vector as readonly.
 */
export function readSystemCompanionBodyTarget(worldId: string): THREE.Vector3 | null {
  return publishedTargets.get(worldId)?.position ?? null;
}

export function createSystemCompanionBodyTargetHandle(
  worldId: string
): SystemCompanionBodyTargetHandle {
  if (worldId.length === 0) {
    throw new Error('System companion body target handles require a world id.');
  }

  const owner = Symbol(worldId);
  const position = new THREE.Vector3();

  return {
    worldId,
    publish(next) {
      position.set(next.x, next.y, next.z);
      publishedTargets.set(worldId, { owner, position });
    },
    read() {
      return readSystemCompanionBodyTarget(worldId);
    },
    remove() {
      if (publishedTargets.get(worldId)?.owner === owner) {
        publishedTargets.delete(worldId);
      }
    }
  };
}
