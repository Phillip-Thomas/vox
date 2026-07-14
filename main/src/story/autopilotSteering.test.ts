import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FACE_NORMALS, transportControlFrame } from '../utils/surfaceControls.ts';
import {
  beginsCrossFaceRouteHandoff,
  surfaceFaceFromUp,
  surfaceSteeringIntent
} from './autopilotSteering.ts';

describe('autopilot surface steering', () => {
  it('uses gravity up rather than ambiguous seam position to identify the new face', () => {
    // An exact top/front seam is position-tied and dominantFaceForPosition would
    // prefer top. Physics has already committed to front, which is authoritative.
    expect(surfaceFaceFromUp(FACE_NORMALS.front)).toBe('front');
    expect(beginsCrossFaceRouteHandoff(
      'different-face-direct-fallback',
      'top',
      surfaceFaceFromUp(FACE_NORMALS.front),
      'front'
    )).toBe(true);
  });

  it('preserves forward intent when the camera basis transports across an edge', () => {
    const oldUp = FACE_NORMALS.top;
    const newUp = FACE_NORMALS.right;
    const oldForward = new THREE.Vector3(1, 0, 0); // toward the top→right edge
    const transported = transportControlFrame(
      { up: oldUp, forward: oldForward, right: oldForward.clone().cross(oldUp) },
      oldUp,
      newUp
    );
    const newRouteDirection = transported.forward.clone();
    const intent = surfaceSteeringIntent(newRouteDirection, newUp, transported.forward);
    expect(intent).toEqual({ forward: true, backward: false, left: false, right: false });

    // During the visual roll the old look may briefly be parallel to the new up.
    // The route fallback must still be forward-only, never a seam ping-pong.
    const midRoll = surfaceSteeringIntent(newRouteDirection, newUp, oldForward);
    expect(midRoll).toEqual({ forward: true, backward: false, left: false, right: false });
  });

  it('does not arm a handoff for ordinary replans or the wrong destination face', () => {
    expect(beginsCrossFaceRouteHandoff('dry-surface-path', 'top', 'right', 'right')).toBe(false);
    expect(beginsCrossFaceRouteHandoff(
      'different-face-direct-fallback', 'top', 'right', 'front'
    )).toBe(false);
  });
});
