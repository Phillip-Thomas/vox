import type * as THREE from 'three';
import type { StoryBeat } from '../storyState.ts';

export interface MarkerPose {
  position: THREE.Vector3;
  surfaceUp?: THREE.Vector3 | null;
  projectionSpace?: 'surface' | 'spatial';
}
export type WorldMarkerHandle = 'anomaly' | 'summit' | 'pod' | 'waypoint' | 'tree'
  | 'origin-relay' | 'fire' | 'pond-surface' | 'pond-shore' | 'forage' | 'relay' | 'maw-pack' | 'keel'
  | 'wreck' | 'workstation' | 'hatch' | 'origin' | 'tidegarden' | 'station' | 'core' | 'fabricator';

/** The resolver knows positions and candidate facts, never React components. */
export interface WorldHandles {
  target(name: WorldMarkerHandle): MarkerPose | null;
  gather(resource: 'flint' | 'current'): MarkerPose | null;
  audit(beat: StoryBeat): MarkerPose | null;
  settlement(guidanceId: string): MarkerPose | null;
}
