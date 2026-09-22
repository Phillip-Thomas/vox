import { setWorkOrder } from '../storyText.ts';
import { cancelPendingStoryUxFeedback, emitStoryUxFeedbackCue, type StoryUxPresentationContext } from './feedbackCues.ts';
import { readGuidedObjectiveRestore, subscribeGuidedObjectiveRestore } from './objectiveRestore.ts';
export { beginGuidedObjectiveRestore } from './objectiveRestore.ts';

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
let markerAcknowledged = false;
const progressAcknowledged = new Set<string>();
const enteredIds = new Set<string>();
const completedIds = new Set<string>();
const acquiredMarkerIds = new Set<string>();
let restoring = false;
let restoredObjectiveId: string | null = null;
let presentationSilent = false;
let restoreVersion = 0;
let runVersion = readGuidedObjectiveRestore().runVersion;
let receiptLineage: (StoryUxPresentationContext & { objectiveId: string; restoreVersion: number }) | null = null;
export interface EarlyObjectiveReceipt { text: 'DEBRIS RECOVERED.' | 'BIOFIBER LOGGED.'; shownAt: number; receiptId: string }
let earlyReceipt: EarlyObjectiveReceipt | null = null;
interface ObjectiveLifecycleEvent {
  kind: 'activate' | 'progress' | 'complete' | 'marker' | 'clear';
  objectiveId: string | null; atPerfMs: number; restoreVersion: number; silent: boolean; detail: string | null;
}
const lifecycleTrace: ObjectiveLifecycleEvent[] = [];
function traceLifecycle(kind: ObjectiveLifecycleEvent['kind'], detail: string | null = null): void {
  lifecycleTrace.push({ kind, objectiveId: runtime.objective?.id ?? null, atPerfMs: typeof performance === 'undefined' ? Date.now() : performance.now(), restoreVersion, silent: presentationSilent, detail });
  if (lifecycleTrace.length > 256) lifecycleTrace.shift();
}
/** Semantic transitions only. Actual scheduled SFX are reported by the SFX rim. */
export function getGuidedObjectiveLifecycleTrace(): readonly ObjectiveLifecycleEvent[] { return lifecycleTrace; }
if (typeof window !== 'undefined') {
  (window as unknown as { __voxObjectiveLifecycle?: typeof getGuidedObjectiveLifecycleTrace }).__voxObjectiveLifecycle = getGuidedObjectiveLifecycleTrace;
}
export function getEarlyObjectiveReceipt(): EarlyObjectiveReceipt | null { return earlyReceipt; }
export function publishEarlyObjectiveReceipt(receiptId: string, text: EarlyObjectiveReceipt['text'], shownAt: number): void {
  earlyReceipt = { receiptId, text, shownAt }; emit();
}
subscribeGuidedObjectiveRestore(() => {
  cancelPendingStoryUxFeedback('restore'); receiptLineage = null; earlyReceipt = null;
  const nextRun = readGuidedObjectiveRestore().runVersion;
  if (nextRun !== runVersion) { runVersion = nextRun; resetGuidedObjectiveFeedbackForRun(); }
});

function emit(): void {
  version += 1;
  publishDebugSnapshot();
  for (const listener of listeners) listener();
}

/**
 * Dev affordance (mirrors `__storyBeat`): the ladder trace
 * (`tools/story-ladder-trace.mjs`) samples what the player is told from here,
 * so the story pipeline refactor can prove it left the ladder byte-identical.
 */
function publishDebugSnapshot(): void {
  if (typeof window === 'undefined') return;
  const objective = runtime.objective;
  (window as unknown as { __storyObjective?: unknown }).__storyObjective = objective
    ? {
        id: objective.id,
        kind: objective.kind,
        markerLabel: objective.markerLabel,
        workOrder: [...objective.workOrder],
        requiresMarker: objective.requiresMarker ?? true,
        health: !objective.requiresMarker || runtime.markerVisible ? 'ready' : 'missing-marker'
      }
    : null;
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
export function activateGuidedStoryObjective(objective: GuidedStoryObjective, markerLabel?: string | null): boolean {
  const restore = readGuidedObjectiveRestore();
  if (restore.version !== restoreVersion) {
    restoreVersion = restore.version;
    clearGuidedStoryObjective(restore.reason);
    restoring = true; restoredObjectiveId = null; presentationSilent = true;
  }
  validateObjective(objective);
  if (runtime.objective?.id === objective.id) return false;
  if (restoring && restoredObjectiveId != null && restoredObjectiveId !== objective.id) restoring = false;
  if (restoring && restoredObjectiveId == null) restoredObjectiveId = objective.id;
  presentationSilent = restoring;
  const successorContext = receiptLineage?.expectedSuccessor === objective.id ? receiptLineage : undefined;
  if (!successorContext) { cancelPendingStoryUxFeedback('replacement'); receiptLineage = null; }
  runtime.objective = Object.freeze({
    ...objective,
    workOrder: Object.freeze([...objective.workOrder]),
    requiresMarker: objective.requiresMarker ?? true
  });
  runtime.markerVisible = objective.requiresMarker === false || markerLabel === objective.markerLabel;
  markerAcknowledged = false;
  progressAcknowledged.clear();
  setWorkOrder(objective.workOrder);
  if (!presentationSilent && !enteredIds.has(objective.id)) {
    emitStoryUxFeedbackCue({ type: 'objective-enter', objectiveId: objective.id, action: objective.kind }, successorContext);
  }
  enteredIds.add(objective.id);
  traceLifecycle('activate');
  acknowledgeVisibleMarker();
  emit();
  return true;
}

/** Remove stale health state when leaving a guided chapter; HUD text is beat-owned. */
export type ObjectiveClearReason = 'satisfied' | 'replace' | 'transition' | 'seed' | 'inactive' | 'reset' | 'resume' | 'failed';
/** Receipt on the confirmed predicate edge; publication stays atomic until its successor is ready. */
export function acknowledgeGuidedStoryCompletion(objectiveId: string, confirmedAction = false, context?: StoryUxPresentationContext): boolean {
  // A seed transaction can notify a domain subscriber before the next objective
  // publication has consumed the restore token. It is never a player receipt.
  if (readGuidedObjectiveRestore().version !== restoreVersion) return false;
  if (/^ch1:(fixed|track|raster):/.test(objectiveId) && !confirmedAction) return false;
  if (runtime.objective?.id !== objectiveId || completedIds.has(objectiveId) || (presentationSilent && !confirmedAction)) return false;
  if (context) receiptLineage = { ...context, objectiveId, restoreVersion };
  const lineage = receiptLineage;
  emitStoryUxFeedbackCue({ type: 'objective-complete', objectiveId }, context && {
    ...context,
    valid: () => receiptLineage === lineage && readGuidedObjectiveRestore().version === restoreVersion
      && (runtime.objective?.id === objectiveId || runtime.objective?.id === context.expectedSuccessor
        || (context.expectedSuccessor === null && runtime.objective === null))
  });
  completedIds.add(objectiveId);
  traceLifecycle('complete', confirmedAction ? 'confirmed-action' : 'authored-predicate');
  if (confirmedAction) { restoring = false; presentationSilent = false; }
  return true;
}
export function clearGuidedStoryObjective(reason: ObjectiveClearReason = 'transition'): void {
  traceLifecycle('clear', reason);
  if (reason !== 'satisfied' || receiptLineage?.expectedSuccessor !== null) { cancelPendingStoryUxFeedback(reason); receiptLineage = null; }
  if (!runtime.objective && !runtime.markerVisible) return;
  if (runtime.objective && reason === 'satisfied') acknowledgeGuidedStoryCompletion(runtime.objective.id);
  if (runtime.objective && !presentationSilent && !completedIds.has(runtime.objective.id) && reason === 'failed') {
    emitStoryUxFeedbackCue({ type: 'objective-fail', objectiveId: runtime.objective.id });
    completedIds.add(runtime.objective.id);
    restoring = false;
  }
  runtime.objective = null;
  runtime.markerVisible = false;
  markerAcknowledged = false;
  progressAcknowledged.clear();
  emit();
}

export function resetGuidedObjectiveFeedbackForRun(): void {
  clearGuidedStoryObjective('reset');
  earlyReceipt = null;
  enteredIds.clear(); completedIds.clear(); acquiredMarkerIds.clear();
  restoring = false; restoredObjectiveId = null; presentationSilent = false;
  restoreVersion = readGuidedObjectiveRestore().version;
}

export function resetGuidedObjectiveFeedbackForTests(): void { resetGuidedObjectiveFeedbackForRun(); }

/** Called by the existing directional-marker driver after resolving its target. */
export function observeGuidedStoryMarker(markerLabel: string | null): void {
  const objective = runtime.objective;
  const visible = Boolean(
    objective
    && (!objective.requiresMarker || markerLabel === objective.markerLabel)
  );
  if (runtime.markerVisible === visible) return;
  runtime.markerVisible = visible;
  acknowledgeVisibleMarker();
  emit();
}

function acknowledgeVisibleMarker(): void {
  const objective = runtime.objective;
  if (runtime.markerVisible && objective?.requiresMarker && !markerAcknowledged) {
    markerAcknowledged = true;
    if (!presentationSilent && !acquiredMarkerIds.has(objective.id)) emitStoryUxFeedbackCue({ type: 'marker-acquired', objectiveId: objective.id });
    acquiredMarkerIds.add(objective.id);
    traceLifecycle('marker');
  }
}

/** A confirmed semantic progress edge. Polling the same edge cannot replay it. */
export function acknowledgeGuidedStoryProgress(progressId: string): boolean {
  if (readGuidedObjectiveRestore().version !== restoreVersion) return false;
  if (!runtime.objective || progressAcknowledged.has(progressId)) return false;
  restoring = false; presentationSilent = false;
  progressAcknowledged.add(progressId);
  traceLifecycle('progress', progressId);
  emitStoryUxFeedbackCue({ type: 'objective-progress', objectiveId: runtime.objective.id });
  return true;
}

export function getActiveGuidedStoryObjective(): Readonly<GuidedStoryObjective> | null {
  return runtime.objective;
}

/** Read-only presentation identity; geometry never republishes an objective. */
export function getGuidedObjectivePresentationState() {
  return { objective: runtime.objective, presentationSilent, runVersion, restoreVersion };
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
