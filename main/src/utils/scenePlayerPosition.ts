import * as THREE from 'three';

export interface ScenePlayerPositionMailbox {
  /**
   * Stable live vector shared by imperative R3F consumers. Its identity never
   * changes; publishers only copy new coordinates into it.
   */
  readonly position: THREE.Vector3;
  publish(next: THREE.Vector3): void;
}

export interface ScenePlayerPositionPublishContext {
  readonly nowMs: number;
  readonly phase: 'surface' | 'launch' | 'approach' | 'descent' | 'deep_space';
  readonly controlMode: 'fps' | 'flight';
}

export interface ScenePlayerPositionPublication {
  readonly collision: boolean;
  readonly ecology: boolean;
}

export interface ScenePlayerPositionStreams {
  /** Terrain collision and close player-attached scene consumers. */
  readonly collision: ScenePlayerPositionMailbox;
  /** Expensive grass/flora/fauna recenter consumers. */
  readonly ecology: ScenePlayerPositionMailbox;
  publish(
    next: THREE.Vector3,
    context: ScenePlayerPositionPublishContext
  ): ScenePlayerPositionPublication;
}

export const FLIGHT_COLLISION_STREAM_INTERVAL_MS = 1000 / 15;
export const FLIGHT_ECOLOGY_STREAM_INTERVAL_MS = 400;
const NO_POSITION_PUBLICATION: ScenePlayerPositionPublication = Object.freeze({
  collision: false,
  ecology: false
});
const COLLISION_POSITION_PUBLICATION: ScenePlayerPositionPublication = Object.freeze({
  collision: true,
  ecology: false
});
const ALL_POSITION_PUBLICATION: ScenePlayerPositionPublication = Object.freeze({
  collision: true,
  ecology: true
});

/**
 * Bridge a physics/render-loop position into scene consumers without turning
 * every movement sample into React state. R3F consumers already read positions
 * imperatively in `useFrame`, so a stable mutable value is the correct boundary:
 * React owns scene structure while the render loop owns continuous coordinates.
 */
export function createScenePlayerPositionMailbox(
  initialPosition: THREE.Vector3
): ScenePlayerPositionMailbox {
  const position = initialPosition.clone();
  return {
    position,
    publish(next) {
      position.copy(next);
    }
  };
}

/**
 * Keep render-loop coordinates off React while preserving the two proven work
 * cadences: nearby collision may follow at 15 Hz, while atmosphere flight only
 * recenters the expensive ecology fields every 400 ms. Deep space does not move
 * either planet-local stream.
 */
export function createScenePlayerPositionStreams(
  initialPosition: THREE.Vector3
): ScenePlayerPositionStreams {
  const collision = createScenePlayerPositionMailbox(initialPosition);
  const ecology = createScenePlayerPositionMailbox(initialPosition);
  let lastCollisionAt = Number.NEGATIVE_INFINITY;
  let lastEcologyAt = Number.NEGATIVE_INFINITY;

  return {
    collision,
    ecology,
    publish(next, context) {
      if (context.phase === 'deep_space') {
        return NO_POSITION_PUBLICATION;
      }
      if (collision.position.distanceToSquared(next) <= 1) {
        return NO_POSITION_PUBLICATION;
      }
      if (context.nowMs - lastCollisionAt < FLIGHT_COLLISION_STREAM_INTERVAL_MS) {
        return NO_POSITION_PUBLICATION;
      }

      collision.publish(next);
      lastCollisionAt = context.nowMs;
      const publishEcology = context.controlMode === 'fps'
        || context.phase === 'surface'
        || context.nowMs - lastEcologyAt >= FLIGHT_ECOLOGY_STREAM_INTERVAL_MS;
      if (publishEcology) {
        ecology.publish(next);
        lastEcologyAt = context.nowMs;
      }
      return publishEcology
        ? ALL_POSITION_PUBLICATION
        : COLLISION_POSITION_PUBLICATION;
    }
  };
}
