import { setWorkOrder } from '../storyText.ts';
import { emitStoryUxFeedbackCue } from './feedbackCues.ts';

/**
 * The small contract between story, score/cinema, and the player-facing HUD.
 * A guided objective is only valid when it says what to do and can be found.
 * This deliberately does not invent a second marker UI: the existing marker
 * renderer observes this state and remains the one visual language everywhere.
 */
export interface GuidedStoryObjective {
  /** Stable, progression-derived identifier; changing it acknowledges progress. */
  id: string;
  /** Semantic verb available to score/cinema feedback without owning progression. */
  kind: 'travel' | 'interact' | 'craft' | 'build' | 'wait';
  /** Exact label shown by the shared directional marker. */
  markerLabel: string;
  /** Standing, imperative HUD copy. The final line names the next input/action. */
  workOrder: readonly string[];
  /** Every non-cinematic objective must resolve through the shared marker. */
  requiresMarker?: boolean;
}

export type ObjectiveHealth = 'idle' | 'ready' | 'missing-marker';

interface ObjectiveRuntime {
  objective: Readonly<GuidedStoryObjective> | null;
  markerVisible: boolean;
}

const runtime: ObjectiveRuntime = {
  objective: null,
  markerVisible: false
};
const listeners = new Set<() => void>();
let version = 0;

function emit(): void {
  version += 1;
  for (const listener of listeners) listener();
}

function validateObjective(objective: GuidedStoryObjective): void {
  if (!objective.id.trim()) throw new Error('Guided story objective requires an id.');
  if (!objective.markerLabel.trim()) throw new Error(`Objective ${objective.id} requires a marker label.`);
  if (objective.workOrder.length === 0 || objective.workOrder.some(line => !line.trim())) {
    throw new Error(`Objective ${objective.id} requires actionable work-order copy.`);
  }
}

/**
 * Publish an objective only when its progression state changes. This gives the
 * player one clear audiovisual acknowledgement instead of re-playing a cue on
 * every director frame.
 */
export function activateGuidedStoryObjective(objective: GuidedStoryObjective): boolean {
  validateObjective(objective);
  if (runtime.objective?.id === objective.id) return false;
  runtime.objective = Object.freeze({
    ...objective,
    workOrder: Object.freeze([...objective.workOrder]),
    requiresMarker: objective.requiresMarker ?? true
  });
  runtime.markerVisible = false;
  setWorkOrder(objective.workOrder);
  emitStoryUxFeedbackCue({
    type: 'objective-enter',
    objectiveId: objective.id,
    action: objective.kind
  });
  emit();
  return true;
}

/** Remove stale health state when leaving a guided chapter; HUD text is beat-owned. */
export function clearGuidedStoryObjective(): void {
  if (!runtime.objective && !runtime.markerVisible) return;
  runtime.objective = null;
  runtime.markerVisible = false;
  emit();
}

/** Called by the existing directional-marker driver after resolving its target. */
export function observeGuidedStoryMarker(markerLabel: string | null): void {
  const objective = runtime.objective;
  const visible = Boolean(
    objective
    && (!objective.requiresMarker || markerLabel === objective.markerLabel)
  );
  if (runtime.markerVisible === visible) return;
  runtime.markerVisible = visible;
  emit();
}

export function getActiveGuidedStoryObjective(): Readonly<GuidedStoryObjective> | null {
  return runtime.objective;
}

/** External-store API for the persistent free-era objective card. */
export function getGuidedStoryObjectiveVersion(): number {
  return version;
}

export function subscribeGuidedStoryObjective(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Testable deadlock signal: a mandatory objective is never allowed to go targetless. */
export function getGuidedStoryObjectiveHealth(): ObjectiveHealth {
  const objective = runtime.objective;
  if (!objective) return 'idle';
  return !objective.requiresMarker || runtime.markerVisible ? 'ready' : 'missing-marker';
}
