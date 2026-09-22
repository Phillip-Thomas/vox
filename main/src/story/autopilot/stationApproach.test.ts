import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { spaceStationBody } from '../../game/spaceStation/spaceStationBody.ts';
import { approachHold, evaluateApproach } from '../../game/spaceStation/spaceStationApproach.ts';
import { movieStationApproach } from './stationApproach.ts';
import type { QuaternionTuple, Vec3Tuple } from '../../game/starSystem.ts';

const body = spaceStationBody({ system: { x: -1, y: -1 }, index: 0 });
const observed = {
  position: [-6817.096571115146, -1176.9709094508432, -1181.051693996322] as Vec3Tuple,
  velocity: [10.268096090516725, -1.6395046612264752, 48.83409459769259] as Vec3Tuple,
  quaternion: [0.0033605471772981186, 0.7874704598150744, 0.005890001912468458, -0.6163150894784062] as QuaternionTuple
};

describe('movie station approach', () => {
  it('leaves the observed hull-center orbit for the published approach corridor', () => {
    expect(evaluateApproach(body, observed).blocker).toBe('alignment');
    const plan = movieStationApproach(body, observed);
    expect(plan.target).toEqual(approachHold(body, 700));
    expect(evaluateApproach(body, { ...observed, position: plan.target }).insideCorridor).toBe(true);
    expect(plan.target).not.toEqual(body.systemPosition);
  });

  it('reaches real docking clearance from the captured orbit using thrust, steering and damping', () => {
    // Physical model of the shipped flight loop, not a runtime acceptance claim.
    // Starting velocity and orientation come from the failed hardware capture.
    const position = new THREE.Vector3(...observed.position);
    const velocity = new THREE.Vector3(...observed.velocity);
    const rotation = new THREE.Quaternion(...observed.quaternion);
    const dt = 1 / 60;
    let cleared = false;
    for (let frame = 0; frame < 120 * 60; frame++) {
      const ship = {
        position: position.toArray() as Vec3Tuple,
        velocity: velocity.toArray() as Vec3Tuple,
        quaternion: rotation.toArray() as QuaternionTuple
      };
      if (evaluateApproach(body, ship).canDock) { cleared = true; break; }
      const plan = movieStationApproach(body, ship);
      const direction = new THREE.Vector3(...plan.target).sub(position).normalize();
      const up = Math.abs(direction.y) < 0.88 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
      const desired = new THREE.Quaternion().setFromRotationMatrix(
        new THREE.Matrix4().lookAt(new THREE.Vector3(), direction, up)
      );
      rotation.slerp(desired, 1 - Math.exp(-2.4 * dt));
      if (plan.forward) velocity.addScaledVector(new THREE.Vector3(0, 0, -1).applyQuaternion(rotation), 60 * dt);
      velocity.multiplyScalar(Math.pow(0.6, dt));
      if (velocity.length() > 320) velocity.setLength(320);
      position.addScaledVector(velocity, dt);
    }
    expect(cleared).toBe(true);
  });
});
