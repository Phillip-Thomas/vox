import type { StoryBeat } from '../storyState.ts';
import type { GuidedStoryObjective } from '../ux/objectiveDirector.ts';
import type { WorldHandles, MarkerPose } from './worldHandles.ts';
import { BEAT_DEFINITIONS } from './definitions.ts';
import { storyWorldHandles } from '../storyWorldHandles.ts';

let mountedWorldHandles: WorldHandles | null = null;

/** Bind the live scene once; all chapter publishers share this readiness boundary. */
export function registerStoryMarkerWorld(handles: WorldHandles | null): () => void {
  mountedWorldHandles = handles;
  return () => { if (mountedWorldHandles === handles) mountedWorldHandles = null; };
}

export function isStoryMarkerWorldMounted(): boolean { return mountedWorldHandles !== null; }

export interface StoryMarkerTarget extends MarkerPose { label: string }

/** Publication and rendering resolve the same candidate through the same beat contract. */
export function resolveMarkerTarget(
  beat: StoryBeat | null,
  candidate: Readonly<GuidedStoryObjective> | null,
  handles: WorldHandles = mountedWorldHandles ?? storyWorldHandles
): StoryMarkerTarget | null {
  if (!beat || !candidate || candidate.requiresMarker === false) return null;
  const target = BEAT_DEFINITIONS[beat]?.marker?.(handles, candidate);
  return target ? { ...target, label: candidate.markerLabel } : null;
}
