import * as THREE from 'three';
import type { SideLens } from './sideLens.ts';

// --- Profile-era task rail ----------------------------------------------------------
//
// The raster/profile camera shows one authored, physically traversable terrain
// row.  Task navigation in that view is therefore intentionally one-dimensional:
// screen-left / screen-right only.  Keeping this contract explicit prevents the
// movie pilot from trying to solve an off-row goal by holding W/S and repeatedly
// jetpacking over terrain lips that the side-on presentation hides.

/** The profile-era controller remains locked to the story plane. */
export const STORY_TASK_ROW_DEPTH_BAND = 0;

export interface TaskRowMoveIntent {
  left: boolean;
  right: boolean;
  forward: false;
  backward: false;
  /** Normal route following never burns the jetpack; obstacle recovery is separate. */
  jump: false;
  /** Signed distance from the authored row; diagnostic, never steering input. */
  crossRowOffset: number;
  /** Signed screen-horizontal distance to the target. */
  alongRowOffset: number;
}

const _delta = new THREE.Vector3();

/**
 * Resolve movie-mode movement toward a profile-era target.  This deliberately
 * cannot emit W/S: every required target in this era belongs on the authoritative
 * task row, and a non-zero crossRowOffset is an authoring defect rather than a
 * navigation problem the agent should attempt to brute-force.
 */
export function taskRowMoveIntent(
  lens: SideLens,
  player: THREE.Vector3,
  target: THREE.Vector3,
  deadZone = 0.4
): TaskRowMoveIntent {
  _delta.copy(target).sub(player);
  const alongRowOffset = _delta.dot(lens.travelAxis);
  const crossRowOffset = _delta.dot(lens.depthAxis);
  return {
    left: alongRowOffset < -deadZone,
    right: alongRowOffset > deadZone,
    forward: false,
    backward: false,
    jump: false,
    crossRowOffset,
    alongRowOffset
  };
}
