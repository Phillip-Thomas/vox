import type { AgentSurfaceTerrainQuery } from '../../utils/agentSurfaceNavigation.ts';
import { getWorldGen } from '../../utils/worldGenCache.ts';
import { createStoryAnchorResolver, type StoryAnchorResolver } from './storyAnchorResolver.ts';
import { STORY_PRIMARY_WORLD_ID } from './storyWorldIdentity.ts';
import type { StoryPropPose, PondPose, FieldPackDropPoseAuthority, FieldPackDropPoseSource } from './storyAnchorTypes.ts';
import { clonePreparedAnchor } from './preparedStoryAnchors.ts';
export * from './storyWorldIdentity.ts';
export type { StoryPropPose, PondPose, FieldPackSafePose, FieldPackDropPoseAuthority, FieldPackDropPoseSource } from './storyAnchorTypes.ts';
export { MESA_HEIGHT, AUDIT_WORKER_GROUND_CLEARANCE, DEBRIS_MAX } from './storyAnchorResolver.ts';

const resolvers = new WeakMap<object, StoryAnchorResolver>();
function anchorSource(size: number, seed: number, worldId = STORY_PRIMARY_WORLD_ID) {
  const entry = getWorldGen(size, seed, worldId);
  let resolver = resolvers.get(entry);
  if (!resolver) { resolver = createStoryAnchorResolver(entry); resolvers.set(entry, resolver); }
  return { entry, resolver };
}

export function getSignalMesaPose(planetSize: number, terrainSeed: number): ReturnType<StoryAnchorResolver['getSignalMesaPose']> {
  const { entry, resolver } = anchorSource(planetSize, terrainSeed);
  // A supplied terrain query owns live edits and must never read the pristine worker answer.
  if (entry.preparedStoryAnchors) return clonePreparedAnchor(entry.preparedStoryAnchors.getSignalMesaPose);
  return resolver.getSignalMesaPose(planetSize, terrainSeed);
}

export function getSignalMesaSummit(planetSize: number, terrainSeed: number): ReturnType<StoryAnchorResolver['getSignalMesaSummit']> {
  const { entry, resolver } = anchorSource(planetSize, terrainSeed);
  // A supplied terrain query owns live edits and must never read the pristine worker answer.
  if (entry.preparedStoryAnchors) return clonePreparedAnchor(entry.preparedStoryAnchors.getSignalMesaSummit);
  return resolver.getSignalMesaSummit(planetSize, terrainSeed);
}

export function getAnomalyStonePose(planetSize: number, terrainSeed: number): ReturnType<StoryAnchorResolver['getAnomalyStonePose']> {
  const { entry, resolver } = anchorSource(planetSize, terrainSeed);
  // A supplied terrain query owns live edits and must never read the pristine worker answer.
  if (entry.preparedStoryAnchors) return clonePreparedAnchor(entry.preparedStoryAnchors.getAnomalyStonePose);
  return resolver.getAnomalyStonePose(planetSize, terrainSeed);
}

export function getNavWaypointPoses(planetSize: number, terrainSeed: number, terrain?: AgentSurfaceTerrainQuery): ReturnType<StoryAnchorResolver['getNavWaypointPoses']> {
  const { entry, resolver } = anchorSource(planetSize, terrainSeed);
  // A supplied terrain query owns live edits and must never read the pristine worker answer.
  if (!terrain && entry.preparedStoryAnchors) return clonePreparedAnchor(entry.preparedStoryAnchors.getNavWaypointPoses);
  return resolver.getNavWaypointPoses(planetSize, terrainSeed, terrain);
}

export function getStorySidePlane(planetSize: number, terrainSeed: number): ReturnType<StoryAnchorResolver['getStorySidePlane']> {
  const { entry, resolver } = anchorSource(planetSize, terrainSeed);
  // A supplied terrain query owns live edits and must never read the pristine worker answer.
  if (entry.preparedStoryAnchors) return clonePreparedAnchor(entry.preparedStoryAnchors.getStorySidePlane);
  return resolver.getStorySidePlane(planetSize, terrainSeed);
}

export function getPodImpactPose(planetSize: number, terrainSeed: number): ReturnType<StoryAnchorResolver['getPodImpactPose']> {
  const { entry, resolver } = anchorSource(planetSize, terrainSeed);
  // A supplied terrain query owns live edits and must never read the pristine worker answer.
  if (entry.preparedStoryAnchors) return clonePreparedAnchor(entry.preparedStoryAnchors.getPodImpactPose);
  return resolver.getPodImpactPose(planetSize, terrainSeed);
}

export function getSupplyPodPoses(planetSize: number, terrainSeed: number): ReturnType<StoryAnchorResolver['getSupplyPodPoses']> {
  const { entry, resolver } = anchorSource(planetSize, terrainSeed);
  // A supplied terrain query owns live edits and must never read the pristine worker answer.
  if (entry.preparedStoryAnchors) return clonePreparedAnchor(entry.preparedStoryAnchors.getSupplyPodPoses);
  return resolver.getSupplyPodPoses(planetSize, terrainSeed);
}

export function getHeroTreePose(planetSize: number, terrainSeed: number): ReturnType<StoryAnchorResolver['getHeroTreePose']> {
  const { entry, resolver } = anchorSource(planetSize, terrainSeed);
  // A supplied terrain query owns live edits and must never read the pristine worker answer.
  if (entry.preparedStoryAnchors) return clonePreparedAnchor(entry.preparedStoryAnchors.getHeroTreePose);
  return resolver.getHeroTreePose(planetSize, terrainSeed);
}

export function getFieldPackPose(planetSize: number, terrainSeed: number, terrain?: AgentSurfaceTerrainQuery): ReturnType<StoryAnchorResolver['getFieldPackPose']> {
  const { entry, resolver } = anchorSource(planetSize, terrainSeed);
  // A supplied terrain query owns live edits and must never read the pristine worker answer.
  if (!terrain && entry.preparedStoryAnchors) return clonePreparedAnchor(entry.preparedStoryAnchors.getFieldPackPose);
  return resolver.getFieldPackPose(planetSize, terrainSeed, terrain);
}

export function getPondPose(planetSize: number, terrainSeed: number, worldId?: string): ReturnType<StoryAnchorResolver['getPondPose']> {
  const { entry, resolver } = anchorSource(planetSize, terrainSeed, worldId);
  // A supplied terrain query owns live edits and must never read the pristine worker answer.
  if (entry.preparedStoryAnchors) return clonePreparedAnchor(entry.preparedStoryAnchors.getPondPose);
  return resolver.getPondPose(planetSize, terrainSeed, worldId);
}

export function getKeelMemoryPose(planetSize: number, terrainSeed: number): ReturnType<StoryAnchorResolver['getKeelMemoryPose']> {
  const { entry, resolver } = anchorSource(planetSize, terrainSeed);
  // A supplied terrain query owns live edits and must never read the pristine worker answer.
  if (entry.preparedStoryAnchors) return clonePreparedAnchor(entry.preparedStoryAnchors.getKeelMemoryPose);
  return resolver.getKeelMemoryPose(planetSize, terrainSeed);
}

export function getWreckRelayPose(planetSize: number, terrainSeed: number): ReturnType<StoryAnchorResolver['getWreckRelayPose']> {
  const { entry, resolver } = anchorSource(planetSize, terrainSeed);
  // A supplied terrain query owns live edits and must never read the pristine worker answer.
  if (entry.preparedStoryAnchors) return clonePreparedAnchor(entry.preparedStoryAnchors.getWreckRelayPose);
  return resolver.getWreckRelayPose(planetSize, terrainSeed);
}

export function getAuditWorkerPath(planetSize: number, terrainSeed: number, terrain?: AgentSurfaceTerrainQuery): ReturnType<StoryAnchorResolver['getAuditWorkerPath']> {
  const { entry, resolver } = anchorSource(planetSize, terrainSeed);
  // A supplied terrain query owns live edits and must never read the pristine worker answer.
  if (!terrain && entry.preparedStoryAnchors) return clonePreparedAnchor(entry.preparedStoryAnchors.getAuditWorkerPath);
  return resolver.getAuditWorkerPath(planetSize, terrainSeed, terrain);
}

export function getDebrisPoses(planetSize: number, terrainSeed: number): ReturnType<StoryAnchorResolver['getDebrisPoses']> {
  const { entry, resolver } = anchorSource(planetSize, terrainSeed);
  // A supplied terrain query owns live edits and must never read the pristine worker answer.
  if (entry.preparedStoryAnchors) return clonePreparedAnchor(entry.preparedStoryAnchors.getDebrisPoses);
  return resolver.getDebrisPoses(planetSize, terrainSeed);
}

export interface EstablishFieldPackDropPoseInput {
  planetSize: number;
  terrainSeed: number;
  terrain: AgentSurfaceTerrainQuery;
  worldId: string;
  terrainRevision: string;
  storyRunId: number;
  source: FieldPackDropPoseSource;
}

let fieldPackDropPoseAuthority: FieldPackDropPoseAuthority | null = null;

function sameFieldPackScope(
  authority: FieldPackDropPoseAuthority,
  worldId: string,
  storyRunId: number
): boolean {
  return authority.worldId === worldId && authority.storyRunId === storyRunId;
}

function fieldPackPoseLocked(authority: FieldPackDropPoseAuthority): boolean {
  return authority.source === 'physical-tear' || authority.source === 'direct-ch5-fallback';
}

/**
 * Select or commit the one live-terrain pack pose for this run and world.
 * A planned A4 pose may move when the edit/water revision changes before the
 * physical tear. Once torn (or reconstructed by a direct Ch5 entry), the pose
 * is immutable for the rest of that run so render and interaction cannot fork.
 */
export function establishFieldPackDropPose(
  input: EstablishFieldPackDropPoseInput
): FieldPackDropPoseAuthority | null {
  const existing = fieldPackDropPoseAuthority;
  if (existing && !sameFieldPackScope(existing, input.worldId, input.storyRunId)) {
    resetFieldPackDropPoseAuthority();
  } else if (existing && fieldPackPoseLocked(existing)) {
    return existing;
  } else if (
    existing
    && existing.terrainRevision === input.terrainRevision
    && existing.source === input.source
  ) {
    return existing;
  }

  const safe = getFieldPackPose(input.planetSize, input.terrainSeed, input.terrain);
  if (!safe) {
    if (fieldPackDropPoseAuthority && !fieldPackPoseLocked(fieldPackDropPoseAuthority)) {
      fieldPackDropPoseAuthority = null;
      storyAnchors.fieldPack = null;
    }
    return null;
  }
  const authority: FieldPackDropPoseAuthority = Object.freeze({
    position: safe.position.clone(),
    up: safe.up.clone(),
    supportVoxel: safe.supportVoxel,
    relocated: safe.relocated,
    worldId: input.worldId,
    terrainRevision: input.terrainRevision,
    storyRunId: input.storyRunId,
    source: input.source
  });
  fieldPackDropPoseAuthority = authority;
  storyAnchors.fieldPack = authority;
  return authority;
}

export function getFieldPackDropPoseAuthority(
  worldId?: string,
  storyRunId?: number
): FieldPackDropPoseAuthority | null {
  const authority = fieldPackDropPoseAuthority;
  if (!authority) return null;
  if (worldId !== undefined && authority.worldId !== worldId) return null;
  if (storyRunId !== undefined && authority.storyRunId !== storyRunId) return null;
  return authority;
}

/** Scope-aware cleanup prevents an old React effect from clearing a new world. */
export function resetFieldPackDropPoseAuthority(
  scope?: { worldId: string; storyRunId: number }
): void {
  if (
    scope
    && fieldPackDropPoseAuthority
    && !sameFieldPackScope(fieldPackDropPoseAuthority, scope.worldId, scope.storyRunId)
  ) return;
  fieldPackDropPoseAuthority = null;
  storyAnchors.fieldPack = null;
}

// --- the first day alive / chapter 4 -------------------------------------------------

/**
 * Live world anchors for the director/autopilot (the anomalyStoneHandle
 * pattern, computed once per mount by StoryWorldProps — the director never
 * needs planetSize/terrainSeed itself).
 */
export const storyAnchors: {
  pond: PondPose | null;
  auditPath: StoryPropPose[] | null;
  /** One live-edited, run/world-scoped receipt shared by all pack consumers. */
  fieldPack: FieldPackDropPoseAuthority | null;
  worldId: string | null;
  storyRunId: number | null;
  /** The live story world's seed (forage probes need it). */
  terrainSeed: number | null;
  /** Rendered cube radius in world units (shared agent navigation needs it). */
  planetSize: number | null;
} = {
  pond: null,
  auditPath: null,
  fieldPack: null,
  worldId: null,
  storyRunId: null,
  terrainSeed: null,
  planetSize: null
};

