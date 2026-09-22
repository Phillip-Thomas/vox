import type * as THREE from 'three';

export interface StoryPropPose {
  position: THREE.Vector3;
  up: THREE.Vector3;
}

export interface FieldPackSafePose extends StoryPropPose {
  readonly supportVoxel: Readonly<{ x: number; y: number; z: number }>;
  readonly relocated: boolean;
}

export type FieldPackDropPoseSource =
  | 'a4-planned-tear'
  | 'physical-tear'
  | 'direct-ch5-fallback';

/** One scoped receipt owns every Chapter 5 pack consumer. */
export interface FieldPackDropPoseAuthority extends FieldPackSafePose {
  readonly worldId: string;
  readonly terrainRevision: string;
  readonly storyRunId: number;
  readonly source: FieldPackDropPoseSource;
}

export interface PondPose {
  /** A point on the water surface at the pond's near edge (drink/marker goal). */
  surface: THREE.Vector3;
  /** The last land column before the water — a dry approach point. */
  shore: THREE.Vector3;
  /** The pond floor beneath the deepest found column (ch4-dive's kit rests here). */
  floor: THREE.Vector3;
  up: THREE.Vector3;
  /** Water depth (voxels) at the found column. */
  depth: number;
}

