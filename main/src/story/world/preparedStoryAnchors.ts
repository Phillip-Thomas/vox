import * as THREE from 'three';
import type { PreparedStoryAnchors } from './storyAnchorResolver.ts';
import type { StoryPropPose, FieldPackSafePose, PondPose } from './storyAnchorTypes.ts';

/** All coordinates stay Float64, including signed zero; no JSON/Float32 rounding. */
export function packPreparedStoryAnchors(anchors: PreparedStoryAnchors | null): Float64Array {
  if (!anchors) return new Float64Array();
  const values: number[] = [1];
  const vector = (v: THREE.Vector3) => values.push(v.x, v.y, v.z);
  const pose = (p: StoryPropPose) => { vector(p.position); vector(p.up); };
  const poses = (ps: StoryPropPose[]) => { values.push(ps.length); ps.forEach(pose); };
  pose(anchors.getSignalMesaPose);
  pose(anchors.getSignalMesaSummit);
  pose(anchors.getAnomalyStonePose);
  poses(anchors.getNavWaypointPoses);
  for (const key of ['origin', 'travelAxis', 'depthAxis', 'up'] as const) vector(anchors.getStorySidePlane[key]);
  pose(anchors.getPodImpactPose);
  poses(anchors.getSupplyPodPoses);
  pose(anchors.getHeroTreePose);
  const fieldPack = anchors.getFieldPackPose;
  values.push(fieldPack ? 1 : 0);
  if (fieldPack) {
    pose(fieldPack);
    values.push(fieldPack.supportVoxel.x, fieldPack.supportVoxel.y, fieldPack.supportVoxel.z, fieldPack.relocated ? 1 : 0);
  }
  const pond = anchors.getPondPose;
  values.push(pond ? 1 : 0);
  if (pond) {
    for (const key of ['surface', 'shore', 'floor', 'up'] as const) vector(pond[key]);
    values.push(pond.depth);
  }
  values.push(anchors.getKeelMemoryPose ? 1 : 0);
  if (anchors.getKeelMemoryPose) pose(anchors.getKeelMemoryPose);
  pose(anchors.getWreckRelayPose);
  poses(anchors.getAuditWorkerPath);
  poses(anchors.getDebrisPoses);
  return Float64Array.from(values);
}

/** Bounds and shape are checked before any prepared answer becomes observable. */
export function unpackPreparedStoryAnchors(values: Float64Array): PreparedStoryAnchors | null {
  if (values.length === 0) return null;
  let cursor = 0;
  const number = () => {
    const value = values[cursor++];
    if (!Number.isFinite(value)) throw new Error('Invalid prepared story anchor coordinate');
    return value;
  };
  const count = (max: number) => {
    const value = number();
    if (!Number.isInteger(value) || value < 0 || value > max) throw new Error('Invalid prepared story anchor count');
    return value;
  };
  if (number() !== 1) throw new Error('Unsupported prepared story anchor version');
  const vector = () => new THREE.Vector3(number(), number(), number());
  const pose = (): StoryPropPose => ({ position: vector(), up: vector() });
  const poses = () => Array.from({ length: count(8192) }, pose);
  const getSignalMesaPose = pose();
  const getSignalMesaSummit = pose();
  const getAnomalyStonePose = pose();
  const getNavWaypointPoses = poses();
  const getStorySidePlane = { origin: vector(), travelAxis: vector(), depthAxis: vector(), up: vector() };
  const getPodImpactPose = pose();
  const getSupplyPodPoses = poses();
  const getHeroTreePose = pose();
  const getFieldPackPose: FieldPackSafePose | null = count(1) ? {
    ...pose(), supportVoxel: Object.freeze({ x: number(), y: number(), z: number() }), relocated: count(1) === 1
  } : null;
  const getPondPose: PondPose | null = count(1) ? {
    surface: vector(), shore: vector(), floor: vector(), up: vector(), depth: count(8)
  } : null;
  const getKeelMemoryPose = count(1) ? pose() : null;
  const getWreckRelayPose = pose();
  const getAuditWorkerPath = poses();
  const getDebrisPoses = poses();
  if (cursor !== values.length) throw new Error('Trailing prepared story anchor data');
  return { getSignalMesaPose, getSignalMesaSummit, getAnomalyStonePose, getNavWaypointPoses, getStorySidePlane,
    getPodImpactPose, getSupplyPodPoses, getHeroTreePose, getFieldPackPose, getPondPose, getKeelMemoryPose,
    getWreckRelayPose, getAuditWorkerPath, getDebrisPoses };
}

/** Consumers historically receive mutable vectors; never expose the cached worker answer. */
export function clonePreparedAnchor<T>(value: T): T {
  if (value instanceof THREE.Vector3) return value.clone() as T;
  if (Array.isArray(value)) return value.map(item => clonePreparedAnchor(item)) as T;
  if (value && typeof value === 'object') {
    const copy = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clonePreparedAnchor(item)]));
    return (Object.isFrozen(value) ? Object.freeze(copy) : copy) as T;
  }
  return value;
}
