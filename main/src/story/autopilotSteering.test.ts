import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  dominantFaceForPosition,
  FACE_NORMALS,
  transportControlFrame
} from '../utils/surfaceControls.ts';
import { EDGE_HYSTERESIS } from '../utils/cubeGravityConstants.ts';
import {
  advanceCrossFaceSurfaceLegPhase,
  beginsCrossFaceRouteHandoff,
  CROSS_FACE_SAFE_DOMINANCE_MARGIN,
  crossFaceApproachCandidates,
  crossFaceCrossingTarget,
  enteredPlannedSurfaceFace,
  planCrossFaceSurfaceLeg,
  reachedCrossFaceDestinationEntry,
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

  it('routes the reported opposite-face goal through a fixed dry right-face inset', () => {
    const player = new THREE.Vector3(16.35, -50.79, -15.83);
    const goal = new THREE.Vector3(18, 49.1, -18);
    const leg = planCrossFaceSurfaceLeg({
      player,
      goal,
      currentFace: 'bottom',
      goalFace: 'top',
      lookForward: new THREE.Vector3(0, -1, 0),
      planetRadius: 50,
      edgeEntryRadius: 48.2,
      cornerInset: 2
    });
    expect(leg?.nextFace).toBe('right');
    expect(leg?.remainingTransitions).toBe(2);
    expect(leg?.approach.x).toBeCloseTo(48.2);
    expect(leg?.approach.y).toBeCloseTo(-50.79);
    expect(leg?.approach.z).toBeCloseTo(-16.27, 1);
  });

  it('uses look direction and then stable face order to break exact opposite-face ties', () => {
    const base = {
      player: new THREE.Vector3(0, -50, 0),
      goal: new THREE.Vector3(0, 50, 0),
      currentFace: 'bottom' as const,
      goalFace: 'top' as const,
      planetRadius: 50,
      edgeEntryRadius: 48.2,
      cornerInset: 2
    };
    expect(planCrossFaceSurfaceLeg({
      ...base,
      lookForward: new THREE.Vector3(0, 0, 1)
    })?.nextFace).toBe('front');
    expect(planCrossFaceSurfaceLeg({
      ...base,
      lookForward: new THREE.Vector3(0, -1, 0)
    })?.nextFace).toBe('right');
  });

  it('plans adjacent and intermediate legs independently and recognizes every face entry', () => {
    const adjacent = planCrossFaceSurfaceLeg({
      player: new THREE.Vector3(0, -50, 0),
      goal: new THREE.Vector3(0, 0, -50),
      currentFace: 'bottom',
      goalFace: 'back',
      lookForward: new THREE.Vector3(1, 0, 0),
      planetRadius: 50,
      edgeEntryRadius: 48.2,
      cornerInset: 2
    });
    expect(adjacent?.nextFace).toBe('back');
    expect(adjacent?.remainingTransitions).toBe(1);
    expect(adjacent?.approach.z).toBeCloseTo(-48.2);

    const second = planCrossFaceSurfaceLeg({
      player: new THREE.Vector3(52.85, -50.79, -16.27),
      goal: new THREE.Vector3(18, 49.1, -18),
      currentFace: 'right',
      goalFace: 'top',
      lookForward: new THREE.Vector3(0, 1, 0),
      planetRadius: 50,
      edgeEntryRadius: 48.2,
      cornerInset: 2
    });
    expect(second?.nextFace).toBe('top');
    expect(enteredPlannedSurfaceFace('bottom', 'right', 'right')).toBe(true);
    expect(enteredPlannedSurfaceFace('bottom', 'right', 'front')).toBe(false);
  });

  it('latches crossing after the reported edge approach instead of oscillating back', () => {
    const accepted = advanceCrossFaceSurfaceLegPhase({
      phase: 'approach',
      currentFace: 'left',
      nextFace: 'top',
      approachDistance: 1.036,
      approachTolerance: 1.45
    });
    expect(accepted).toBe('crossing');

    // Run 07 moved toward the new face, making the old per-frame approach
    // distance rise to 2.056 and incorrectly sending the actor back to y=48.
    expect(advanceCrossFaceSurfaceLegPhase({
      phase: accepted as 'crossing',
      currentFace: 'left',
      nextFace: 'top',
      approachDistance: 2.056,
      approachTolerance: 1.45
    })).toBe('crossing');
    expect(advanceCrossFaceSurfaceLegPhase({
      phase: accepted as 'crossing',
      currentFace: 'top',
      nextFace: 'top',
      approachDistance: 4,
      approachTolerance: 1.45
    })).toBe('complete');
  });

  it('commits from the live body to a destination-dominant physical waypoint', () => {
    const player = new THREE.Vector3(-53.08, 49.07, -8.05);
    const before = player.clone();
    const crossing = crossFaceCrossingTarget({
      player,
      fromFace: 'left',
      nextFace: 'top',
      planetRadius: 50
    });
    const oldFaceScore = crossing.dot(FACE_NORMALS.left);
    const destinationScore = crossing.dot(FACE_NORMALS.top);

    expect(player.equals(before)).toBe(true);
    expect(crossing.x).toBeCloseTo(player.x);
    expect(crossing.z).toBeCloseTo(player.z);
    expect(crossing.y).toBeCloseTo(54.08);
    expect(destinationScore - oldFaceScore).toBeGreaterThanOrEqual(
      EDGE_HYSTERESIS + CROSS_FACE_SAFE_DOMINANCE_MARGIN - 1e-6
    );
    expect(dominantFaceForPosition(crossing)).toBe('top');
  });

  it('releases a destination handoff only inside the planner entry column', () => {
    const entry = new THREE.Vector3(12, 50.85, -36);

    // The v02 body had passed the entry along +Z, but remained 1.62 units off
    // laterally. A one-dimensional projection released into an invalid column.
    expect(reachedCrossFaceDestinationEntry(
      new THREE.Vector3(13.62, 48.39, -35.89),
      entry,
      'top'
    )).toBe(false);

    // Buoyancy height does not matter once both surface tangents are aligned.
    expect(reachedCrossFaceDestinationEntry(
      new THREE.Vector3(12.8, 47.2, -35.7),
      entry,
      'top'
    )).toBe(true);

    // A circular tolerance would accept this position even though the planner
    // rounds X into the adjacent x=14 column.
    expect(reachedCrossFaceDestinationEntry(
      new THREE.Vector3(13.1, 47.2, -36),
      entry,
      'top'
    )).toBe(false);
  });

  it('tries the goal-aligned point before fanning out along an isolated edge', () => {
    const goal = new THREE.Vector3(18, 49.05, -18);
    const leg = planCrossFaceSurfaceLeg({
      player: new THREE.Vector3(-20, 7.5, -50.79),
      goal,
      currentFace: 'back',
      goalFace: 'top',
      lookForward: new THREE.Vector3(0, 1, 0),
      planetRadius: 50,
      edgeEntryRadius: 48.2,
      cornerInset: 2
    });
    expect(leg).not.toBeNull();
    const candidates = crossFaceApproachCandidates({
      leg: leg!,
      goal,
      edgeEntryRadius: 48.2,
      cornerInset: 2
    });
    expect(candidates[0]?.x).toBeCloseTo(1.68, 1);
    expect(candidates[1]?.x).toBeCloseTo(18);
    expect(candidates.every(candidate => Math.abs(candidate.x) <= 46.2 + 1e-6)).toBe(true);
  });
});
