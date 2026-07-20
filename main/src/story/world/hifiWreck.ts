import { useSyncExternalStore } from 'react';
import * as THREE from 'three';
import { hasMilestone, subscribeProgression } from '../../game/systems/progressionSystem.ts';
import { STORY_MILESTONES } from '../storyState.ts';

// --- The crashed-ship fidelity conversion -------------------------------------
//
// The crash pod lands as the voxel DescentPod (boxes only). At the A3 material
// awakening the world gains texture and the pod CONVERTS into the high-fidelity
// ship at the same impact site — the wreck becomes what the wreck always was.
//
// The conversion is keyed on the PERSISTED a3 milestone (marked live by tickA3
// when the material stage lands, and seeded on resume/deep-link for any beat at
// or past ch3-thirst), so it survives reloads and derives from state, not from a
// transient cutscene flag.

/**
 * Module handle (the anomalyStoneHandle pattern) for the copy agent: the impact
 * site the hi-fi wreck occupies, and whether the conversion has happened. A
 * director tick can read `converted` + `position` to fire a "first time the
 * player looks at the ship" caption. `position` is set while the wreck is
 * mounted (a story world), regardless of stage; `converted` flips at A3.
 */
export const hifiWreckHandle: {
  position: THREE.Vector3 | null;
  workstationPosition: THREE.Vector3 | null;
  diagnosisTarget: THREE.Vector3 | null;
  hatchTarget: THREE.Vector3 | null;
  converted: boolean;
} = {
  position: null,
  workstationPosition: null,
  diagnosisTarget: null,
  hatchTarget: null,
  converted: false
};

/** Non-hook live read (per-frame loops / event handlers). */
export function isHifiWreckConverted(): boolean {
  return hasMilestone(STORY_MILESTONES.a3);
}

/** Reactive read: re-renders when the a3 milestone is marked (tickA3 / resume). */
export function useHifiWreckConverted(): boolean {
  return useSyncExternalStore(subscribeProgression, isHifiWreckConverted, isHifiWreckConverted);
}
