import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { VOXEL_SCALE } from '../utils/cubeGravityConstants.ts';
import { getWorldGen } from '../utils/worldGenCache.ts';
import {
  ARRIVAL_AUDIT_FOV,
  ARRIVAL_FOUND_FOV,
  ARRIVAL_GAIT_FOV,
  ARRIVAL_SEARCH_FOV,
  arrivalCameraWeightAt,
  arrivalFovAt,
  arrivalLookWeightAt,
  computeArrivalCameraFrame
} from './arrivalCinematography.ts';
import { SANDBOX_FOV } from './storyInputPolicy.ts';
import { ARRIVAL } from './storyScript.ts';
import { SIDE_RIG, type LensRig } from './sideLens.ts';
import {
  getAuditWorkerPath,
  getPodImpactPose,
  getStorySidePlane,
  getWreckRelayPose,
  STORY_SEED
} from './world/storyWorld.ts';

const PLANET_SIZE = 50;

function segmentPointDistance(a: THREE.Vector3, b: THREE.Vector3, point: THREE.Vector3): {
  distance: number;
  along: number;
} {
  const segment = b.clone().sub(a);
  const lengthSq = segment.lengthSq();
  const along = lengthSq > 0 ? point.clone().sub(a).dot(segment) / lengthSq : 0;
  const nearest = a.clone().addScaledVector(segment, Math.min(1, Math.max(0, along)));
  return { distance: nearest.distanceTo(point), along };
}

describe('arrival cinematography', () => {
  it('uses a motivated optical arc and restores the sandbox lens exactly', () => {
    expect(arrivalFovAt(ARRIVAL.holdBlackSeconds)).toBe(SANDBOX_FOV);
    expect(arrivalFovAt(ARRIVAL.someoneAt)).toBe(ARRIVAL_SEARCH_FOV);
    expect(arrivalFovAt(ARRIVAL.gaitAt)).toBe(ARRIVAL_GAIT_FOV);
    expect(arrivalFovAt(ARRIVAL.foundAt)).toBe(ARRIVAL_FOUND_FOV);
    expect(arrivalFovAt(ARRIVAL.auditAt)).toBe(ARRIVAL_AUDIT_FOV);
    expect(arrivalFovAt(ARRIVAL.endAt)).toBe(SANDBOX_FOV);
  });

  it('keeps the authored boom fully on W-7744 at someone, gait, and found', () => {
    for (const cue of [ARRIVAL.someoneAt, ARRIVAL.gaitAt, ARRIVAL.foundAt]) {
      expect(arrivalCameraWeightAt(cue)).toBe(1);
      expect(arrivalLookWeightAt(cue)).toBe(1);
    }
    expect(arrivalCameraWeightAt(ARRIVAL.zeroAt)).toBe(0);
    expect(arrivalLookWeightAt(ARRIVAL.auditAt + ARRIVAL.auditLineSeconds)).toBe(1);
    expect(arrivalLookWeightAt(ARRIVAL.endAt)).toBe(0);
  });

  it('holds the full 6.5 second audit band and a visual breath before completion', () => {
    const lineEnd = ARRIVAL.auditAt + ARRIVAL.auditLineSeconds;
    expect(ARRIVAL.auditLineSeconds).toBe(6.5);
    expect(ARRIVAL.endAt - lineEnd).toBe(ARRIVAL.visualBreathSeconds);
    expect(ARRIVAL.visualBreathSeconds).toBeGreaterThanOrEqual(3);
  });

  it('keeps the actor centered on terrain-clear sightlines in the pinned story world', () => {
    const lens = getStorySidePlane(PLANET_SIZE, STORY_SEED);
    const path = getAuditWorkerPath(PLANET_SIZE, STORY_SEED);
    const generator = getWorldGen(PLANET_SIZE, STORY_SEED).generator;
    const wreck = getPodImpactPose(PLANET_SIZE, STORY_SEED).position;
    const relay = getWreckRelayPose(PLANET_SIZE, STORY_SEED).position;
    const cues = [ARRIVAL.someoneAt, ARRIVAL.gaitAt, ARRIVAL.foundAt];
    const anchors = [path[0].position, path[Math.floor(path.length / 2)].position, path[path.length - 1].position];
    const eye = new THREE.Vector3();
    const target = new THREE.Vector3();
    const up = new THREE.Vector3();
    const rig: LensRig = { ...SIDE_RIG };

    cues.forEach((cue, index) => {
      const anchor = anchors[index];
      computeArrivalCameraFrame(lens, cue, anchor, eye, target, up, rig);

      const camera = new THREE.PerspectiveCamera(arrivalFovAt(cue), 16 / 9, 0.05, 500);
      camera.position.copy(eye);
      camera.up.copy(up);
      camera.lookAt(target);
      camera.updateMatrixWorld(true);
      const torso = anchor.clone().addScaledVector(lens.up, rig.focusLift).project(camera);
      expect(Math.abs(torso.x)).toBeLessThan(1e-6);
      expect(Math.abs(torso.y)).toBeLessThan(1e-6);
      expect(Math.abs(torso.z)).toBeLessThan(1);

      // Sample up to the actor's near edge. No generated terrain cell may cross
      // the lens-to-torso segment before W-7744, even at the distant sunrise cue.
      for (let step = 1; step <= 18; step++) {
        const point = eye.clone().lerp(target, step / 20);
        const x = Math.round(point.x / VOXEL_SCALE);
        const y = Math.round(point.y / VOXEL_SCALE);
        const z = Math.round(point.z / VOXEL_SCALE);
        expect(generator.shouldVoxelExist(x, y, z), `blocked at cue ${cue}s step ${step} by ${x},${y},${z}`).toBe(false);
      }

      // At the relay end, both large authored props remain behind/off-axis from
      // this dedicated row; neither can eclipse the actor's primary read.
      if (cue === ARRIVAL.foundAt) {
        for (const prop of [wreck, relay]) {
          const obstruction = segmentPointDistance(eye, target, prop.clone().addScaledVector(lens.up, 1.5));
          expect(obstruction.along <= 0 || obstruction.along >= 1 || obstruction.distance > 2.5).toBe(true);
        }
      }
    });
  });
});
