import * as THREE from 'three';

export interface ScenePlayerPositionMailbox {
  /**
   * Stable live vector shared by imperative R3F consumers. Its identity never
   * changes; publishers only copy new coordinates into it.
   */
  readonly position: THREE.Vector3;
  publish(next: THREE.Vector3): void;
}

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
