import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  FACE_NORMALS,
  LAVA_MOVE_SPEED,
  LAVA_SINK_SPEED,
  LAVA_STRUGGLE_RISE,
  applyJumpImpulse,
  areAdjacentFaces,
  chooseFaceFromPosition,
  composeLavaVelocity,
  composeVelocity,
  getSurfaceState,
  gravityTupleForFace,
  movementDirectionFromBasis,
  planarCameraBasis,
  transitionVelocityAcrossEdge,
  transportControlFrame,
  transitionAssistVelocity,
  updateJumpState,
  wrapPositionAroundEdge
} from './surfaceControls';
import {
  PLAYER_CENTER_CLEARANCE,
  PLAYER_EDGE_RADIUS,
  PLAYER_STANDING_HEIGHT,
  VOXEL_SCALE
} from './cubeGravityConstants';
import type { CubeFace } from '../types/cube';

const faces = Object.keys(FACE_NORMALS) as CubeFace[];

function expectVectorClose(actual: THREE.Vector3, expected: THREE.Vector3, precision = 5) {
  expect(actual.x).toBeCloseTo(expected.x, precision);
  expect(actual.y).toBeCloseTo(expected.y, precision);
  expect(actual.z).toBeCloseTo(expected.z, precision);
}

describe('surface controls', () => {
  it('uses a standing player height that blocks 1-high channels but fits 2-high tunnels', () => {
    expect(PLAYER_STANDING_HEIGHT).toBeGreaterThan(VOXEL_SCALE);
    expect(PLAYER_STANDING_HEIGHT).toBeLessThan(VOXEL_SCALE * 2);
  });

  it('defines gravity as negative face up for every face', () => {
    for (const face of faces) {
      const state = getSurfaceState(face);
      expect(state.up.length()).toBeCloseTo(1);
      expectVectorClose(state.gravity, state.up.clone().multiplyScalar(-9.81));
      expect(gravityTupleForFace(face)).toEqual([state.gravity.x, state.gravity.y, state.gravity.z]);
    }
  });

  it('projects camera forward onto the active surface for movement', () => {
    const camera = new THREE.PerspectiveCamera();
    camera.rotation.set(0, -Math.PI / 2, 0);

    const basis = planarCameraBasis(
      camera,
      FACE_NORMALS.top,
      new THREE.Vector3(0, 0, -1)
    );
    const direction = movementDirectionFromBasis(
      { forward: true, backward: false, left: false, right: false },
      basis.forward,
      basis.right
    );

    expect(direction.x).toBeGreaterThan(0.99);
    expect(Math.abs(direction.z)).toBeLessThan(0.01);
  });

  it('preserves gravity-axis velocity while changing tangential movement', () => {
    const velocity = composeVelocity(
      new THREE.Vector3(0, -3, 0),
      new THREE.Vector3(1, 0, 0),
      FACE_NORMALS.top,
      5
    );

    expectVectorClose(velocity, new THREE.Vector3(5, -3, 0));
  });

  it('requires hysteresis before committing to a new face', () => {
    const planetRadius = 25;
    const rightIntent = new THREE.Vector3(1, 0, 0);

    expect(chooseFaceFromPosition(new THREE.Vector3(23, 25, 0), 'top', {
      planetRadius,
      movementDirection: rightIntent
    })).toBeNull();
    expect(chooseFaceFromPosition(new THREE.Vector3(24.2, 25, 0), 'top', {
      planetRadius,
      bodyRadius: 1,
      movementDirection: rightIntent
    })).toBe('right');
    expect(chooseFaceFromPosition(new THREE.Vector3(24.2, 25, 0), 'top', {
      planetRadius,
      bodyRadius: 1
    })).toBeNull();
  });

  it('only chooses adjacent cube faces', () => {
    expect(chooseFaceFromPosition(new THREE.Vector3(0, -30, 0), 'top', { planetRadius: 25 })).toBeNull();
  });

  it('resolves corner ties with movement intent and otherwise stays on the current face', () => {
    const planetRadius = 25;
    const corner = new THREE.Vector3(24.5, 25, 24.5);

    expect(chooseFaceFromPosition(corner, 'top', { planetRadius, bodyRadius: 1 })).toBeNull();
    expect(chooseFaceFromPosition(corner, 'top', {
      planetRadius,
      bodyRadius: 1,
      movementDirection: new THREE.Vector3(1, 0, 0)
    })).toBe('right');
    expect(chooseFaceFromPosition(corner, 'top', {
      planetRadius,
      bodyRadius: 1,
      movementDirection: new THREE.Vector3(0, 0, 1)
    })).toBe('front');
  });

  it('adds transition assist toward the target face at low speed', () => {
    const assisted = transitionAssistVelocity(new THREE.Vector3(0, 0, 0), FACE_NORMALS.right, 2);
    expectVectorClose(assisted, new THREE.Vector3(-2, 0, 0));
  });

  it('wraps body position around the shared cube edge during face changes', () => {
    const wrapped = wrapPositionAroundEdge(
      new THREE.Vector3(24.5, 27, 3),
      FACE_NORMALS.top,
      FACE_NORMALS.right,
      25,
      2
    );

    expectVectorClose(wrapped, new THREE.Vector3(27, 25.5, 3));
    expect(wrapped.dot(FACE_NORMALS.right)).toBeGreaterThanOrEqual(27);
    expect(chooseFaceFromPosition(wrapped, 'right', { planetRadius: 25, bodyRadius: 1 })).toBeNull();
    expect(chooseFaceFromPosition(wrapped, 'right', {
      planetRadius: 25,
      bodyRadius: 1,
      movementDirection: FACE_NORMALS.top
    })).toBe('top');
  });

  it('forces a face switch after crossing the hard escape threshold without input', () => {
    expect(chooseFaceFromPosition(new THREE.Vector3(26.2, 27, 0), 'top', {
      planetRadius: 25,
      bodyRadius: 1
    })).toBe('right');
  });

  it('wraps every directed adjacent edge with target clearance and preserved edge coordinate', () => {
    const planetRadius = 25;
    const clearance = 2;

    for (const fromFace of faces) {
      for (const toFace of faces) {
        if (!areAdjacentFaces(fromFace, toFace)) continue;

        const fromUp = FACE_NORMALS[fromFace];
        const toUp = FACE_NORMALS[toFace];
        const edgeAxis = new THREE.Vector3().crossVectors(fromUp, toUp).normalize();
        const source = new THREE.Vector3()
          .addScaledVector(fromUp, planetRadius + clearance)
          .addScaledVector(toUp, planetRadius - 0.25)
          .addScaledVector(edgeAxis, 3);
        const wrapped = wrapPositionAroundEdge(source, fromUp, toUp, planetRadius, clearance);

        expect(wrapped.dot(toUp)).toBeGreaterThanOrEqual(planetRadius + clearance - 0.0001);
        expect(wrapped.dot(edgeAxis)).toBeCloseTo(source.dot(edgeAxis), 5);
      }
    }
  });

  it('only starts directed edge transitions from positions supportable after wrapping', () => {
    const planetRadius = 25;
    const clearance = PLAYER_CENTER_CLEARANCE;

    for (const fromFace of faces) {
      for (const toFace of faces) {
        if (!areAdjacentFaces(fromFace, toFace)) continue;

        const fromUp = FACE_NORMALS[fromFace];
        const toUp = FACE_NORMALS[toFace];
        const edgeAxis = new THREE.Vector3().crossVectors(fromUp, toUp).normalize();
        const beforeSupportBand = new THREE.Vector3()
          .addScaledVector(fromUp, planetRadius + clearance)
          .addScaledVector(toUp, planetRadius - PLAYER_EDGE_RADIUS - 0.01)
          .addScaledVector(edgeAxis, 2);
        const firstSupportable = new THREE.Vector3()
          .addScaledVector(fromUp, planetRadius + clearance)
          .addScaledVector(toUp, planetRadius - PLAYER_EDGE_RADIUS + 0.01)
          .addScaledVector(edgeAxis, 2);

        expect(chooseFaceFromPosition(beforeSupportBand, fromFace, {
          planetRadius,
          bodyRadius: PLAYER_EDGE_RADIUS,
          movementDirection: toUp
        })).toBeNull();
        expect(chooseFaceFromPosition(firstSupportable, fromFace, {
          planetRadius,
          bodyRadius: PLAYER_EDGE_RADIUS,
          movementDirection: toUp
        })).toBe(toFace);

        const wrapped = wrapPositionAroundEdge(firstSupportable, fromUp, toUp, planetRadius, clearance);
        expect(wrapped.dot(toUp)).toBeGreaterThanOrEqual(planetRadius + clearance - 0.0001);
        expect(wrapped.dot(fromUp)).toBeLessThanOrEqual(planetRadius + PLAYER_EDGE_RADIUS + 0.0001);
      }
    }
  });

  it('transports velocity and control basis onto the target tangent plane', () => {
    const oldUp = FACE_NORMALS.top;
    const newUp = FACE_NORMALS.right;
    const velocity = transitionVelocityAcrossEdge(new THREE.Vector3(5, -1, 0), oldUp, newUp, 2);
    const frame = transportControlFrame({
      up: oldUp,
      forward: new THREE.Vector3(1, 0, 0),
      right: new THREE.Vector3(0, 0, 1)
    }, oldUp, newUp);

    expect(Math.abs(velocity.clone().projectOnVector(newUp).dot(newUp))).toBeGreaterThan(1.99);
    expect(frame.forward.dot(newUp)).toBeCloseTo(0, 5);
    expect(frame.right.dot(newUp)).toBeCloseTo(0, 5);
    expect(frame.forward.length()).toBeCloseTo(1, 5);
    expect(frame.right.length()).toBeCloseTo(1, 5);
  });

  it('fires jump once per press with coyote grounding', () => {
    const initial = {
      isGrounded: true,
      coyoteTimeRemaining: 0,
      jumpBufferRemaining: 0,
      previousJump: false
    };

    const first = updateJumpState(initial, true, true, 1 / 60);
    expect(first.shouldJump).toBe(true);

    const held = updateJumpState(first.next, true, false, 1 / 60);
    expect(held.shouldJump).toBe(false);

    const released = updateJumpState(held.next, false, true, 1 / 60);
    const second = updateJumpState(released.next, true, true, 1 / 60);
    expect(second.shouldJump).toBe(true);
  });

  it('does not synthesize a new jump when controls become active while space is already held', () => {
    const state = {
      isGrounded: true,
      coyoteTimeRemaining: 0,
      jumpBufferRemaining: 0,
      previousJump: true
    };

    const next = updateJumpState(state, true, true, 1 / 60);
    expect(next.shouldJump).toBe(false);
  });

  it('applies jump as a single upward impulse while preserving tangent velocity', () => {
    const jumped = applyJumpImpulse(new THREE.Vector3(2, -4, 0), FACE_NORMALS.top, 5.5);
    expectVectorClose(jumped, new THREE.Vector3(2, 5.5, 0));
  });
});

describe('lava wade (viscous sink)', () => {
  const up = FACE_NORMALS.top;
  const look = new THREE.Vector3(0, 0, -1);
  const idle = { forward: false, backward: false, left: false, right: false, struggle: false };
  const step = 1 / 60;

  function settle(start: THREE.Vector3, input = idle, seconds = 2) {
    let velocity = start.clone();
    for (let i = 0; i < seconds * 60; i++) {
      velocity = composeLavaVelocity(velocity, look, up, input, step);
    }
    return velocity;
  }

  it('settles toward the slow sink speed with no input', () => {
    const settled = settle(new THREE.Vector3());
    expectVectorClose(settled, new THREE.Vector3(0, -LAVA_SINK_SPEED, 0), 3);
  });

  it('swallows a jump impulse: upward launch speed converges back to the sink', () => {
    const jumped = new THREE.Vector3(0, 6.8, 0); // DEFAULT_JUMP_SPEED launch
    const settled = settle(jumped, idle, 2);
    expect(settled.dot(up)).toBeCloseTo(-LAVA_SINK_SPEED, 3);
  });

  it('claws upward while struggling, slightly faster than the sink', () => {
    const settled = settle(new THREE.Vector3(), { ...idle, struggle: true });
    expect(settled.dot(up)).toBeCloseTo(LAVA_STRUGGLE_RISE, 3);
    expect(LAVA_STRUGGLE_RISE).toBeGreaterThan(LAVA_SINK_SPEED); // escape must be possible
  });

  it('wades tangentially at a crawl — capped at LAVA_MOVE_SPEED, still sinking', () => {
    const settled = settle(new THREE.Vector3(), { ...idle, forward: true });
    const vertical = settled.dot(up);
    const tangent = settled.clone().addScaledVector(up, -vertical);
    expect(tangent.length()).toBeCloseTo(LAVA_MOVE_SPEED, 3);
    expect(vertical).toBeCloseTo(-LAVA_SINK_SPEED, 3);
  });

  it('wade direction ignores look pitch (tangent-plane trudge, not a 3D swim)', () => {
    const pitchedLook = new THREE.Vector3(0, -0.9, -0.45).normalize(); // staring into the melt
    let velocity = new THREE.Vector3();
    for (let i = 0; i < 120; i++) {
      velocity = composeLavaVelocity(velocity, pitchedLook, up, { ...idle, forward: true }, step);
    }
    expect(velocity.dot(up)).toBeCloseTo(-LAVA_SINK_SPEED, 3); // pitch never adds dive speed
  });

  it('is pure: does not mutate the incoming velocity', () => {
    const velocity = new THREE.Vector3(1, 2, 3);
    composeLavaVelocity(velocity, look, up, idle, step);
    expectVectorClose(velocity, new THREE.Vector3(1, 2, 3));
  });
});
