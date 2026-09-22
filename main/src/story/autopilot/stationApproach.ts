import * as THREE from 'three';
import type { SystemShipPose } from '../../state/systemFlight.ts';
import type { SpaceStationBody } from '../../game/spaceStation/spaceStationBody.ts';
import {
  approachHold, CORRIDOR_RANGE, DOCK_SPEED_LIMIT, evaluateApproach
} from '../../game/spaceStation/spaceStationApproach.ts';

/** Fly the published approach corridor, then coast into the real berth. */
export function movieStationApproach(
  body: SpaceStationBody,
  ship: SystemShipPose
) {
  const readout = evaluateApproach(body, { position: [...ship.position], velocity: [...ship.velocity] });
  const target = readout.insideCorridor
    ? body.berth
    : approachHold(body, CORRIDOR_RANGE / 2);
  const direction = new THREE.Vector3(...target).sub(new THREE.Vector3(...ship.position)).normalize();
  const forward = new THREE.Vector3(0, 0, -1)
    .applyQuaternion(new THREE.Quaternion(...ship.quaternion));
  const closingSpeed = new THREE.Vector3(...ship.velocity).dot(direction);
  // Let the existing damping slow the ship while it turns or approaches the
  // speed gate. Constant thrust at a point makes the ship orbit that point.
  const speedLimit = readout.distance <= CORRIDOR_RANGE ? DOCK_SPEED_LIMIT * 0.7 : Infinity;
  return {
    target,
    forward: !readout.canDock && forward.dot(direction) > 0.98 && closingSpeed < speedLimit
  };
}
