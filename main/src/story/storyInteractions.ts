import type * as THREE from 'three';
import {
  getInteraction,
  setInteraction,
  type ActiveInteraction,
  type InteractionId
} from '../game/systems/interactionSystem.ts';

// --- Story context interactions ---------------------------------------------------
//
// Story world components register live candidate resolvers here. Every resolver
// is evaluated: arbitration is an explicit class/priority decision, never an
// accidental consequence of React mount order or Set insertion order.

export type StoryInteractionId = Extract<InteractionId, `story-${string}`>;
export type StoryInteractionClass = 'safety' | 'required' | 'optional-observation';

export interface StoryInteractionCandidate extends ActiveInteraction {
  perform: () => void;
  /** Candidate-level override for unusual, local arbitration requirements. */
  interactionClass?: StoryInteractionClass;
  /** Higher values win within a class; class precedence remains invariant. */
  priority?: number;
  /** Stable semantic source, for example "wreck-reconstruction". */
  owner?: string;
}

export type StoryInteractionResolver = (
  camera: THREE.Camera | null,
  position: THREE.Vector3
) => StoryInteractionCandidate | null;

export interface StoryInteractionRegistrationOptions {
  interactionClass?: StoryInteractionClass;
  priority?: number;
  owner?: string;
}

export interface StoryInteractionCandidateSnapshot {
  id: InteractionId;
  verb: string;
  interactionClass: StoryInteractionClass;
  priority: number;
  owner: string;
}

/** Serializable result of the most recent complete resolver evaluation. */
export interface StoryInteractionResolutionSnapshot {
  /** Increments on every resolution and immediate unregister reconciliation. */
  revision: number;
  resolvedAt: number;
  candidates: StoryInteractionCandidateSnapshot[];
  winner: StoryInteractionCandidateSnapshot | null;
}

export type StoryInteractionPerformOutcome =
  | 'pending'
  | 'returned'
  | 'succeeded'
  | 'no-op'
  | 'failed'
  | 'threw';

export type StoryInteractionPromptOutcome = 'active' | 'cleared' | 'replaced';

export interface StoryInteractionTraceEntry {
  attemptId: number;
  interactionId: InteractionId;
  verb: string;
  owner: string;
  source: string;
  resolutionRevision: number;
  attemptedAt: number;
  performOutcome: StoryInteractionPerformOutcome;
  performSettledAt: number | null;
  detail: string | null;
  promptOutcome: StoryInteractionPromptOutcome;
  promptSettledAt: number | null;
  /** Null until the prompt clears or is replaced. */
  clearingLatencyMs: number | null;
  replacementInteractionId: InteractionId | null;
  /** Live age of an uncleared prompt, useful for no-op timeout assertions. */
  activeForMs: number;
}

/** Serializable bounded attempt/outcome history for manual and movie probes. */
export interface StoryInteractionTraceSnapshot {
  revision: number;
  entries: StoryInteractionTraceEntry[];
  latest: StoryInteractionTraceEntry | null;
}

interface InteractionPolicy {
  interactionClass: StoryInteractionClass;
  priority: number;
}

// Required story actions outrank free attention everywhere. Keeping the policy
// exhaustive makes adding an interaction a conscious arbitration decision.
const STORY_INTERACTION_POLICY = {
  'story-anomaly': { interactionClass: 'required', priority: 500 },
  'story-eat': { interactionClass: 'required', priority: 500 },
  'story-rest': { interactionClass: 'required', priority: 500 },
  'story-field-kit': { interactionClass: 'required', priority: 500 },
  'story-maw-repair': { interactionClass: 'required', priority: 520 },
  'story-maw-pond-attend': { interactionClass: 'required', priority: 500 },
  'story-keel-free': { interactionClass: 'required', priority: 500 },
  'story-keel-bank': { interactionClass: 'required', priority: 500 },
  'story-wreck-diagnosis': { interactionClass: 'required', priority: 540 },
  'story-wreck-salvage': { interactionClass: 'required', priority: 540 },
  'story-ship-repair': { interactionClass: 'required', priority: 560 },
  'story-wreck-scar-attend': { interactionClass: 'optional-observation', priority: 100 },
  'story-board-hatch': { interactionClass: 'required', priority: 550 },
  'story-board-cancel': { interactionClass: 'safety', priority: 1000 },
  'story-audit-fire': { interactionClass: 'required', priority: 500 },
  'story-audit-life': { interactionClass: 'required', priority: 500 },
  'story-audit-tree': { interactionClass: 'required', priority: 500 },
  'story-comply-fire': { interactionClass: 'required', priority: 500 },
  'story-comply-organics': { interactionClass: 'required', priority: 500 },
  'story-refuse-tree': { interactionClass: 'required', priority: 500 },
  'story-tidegarden-attend': { interactionClass: 'required', priority: 500 },
  'story-tidegarden-record': { interactionClass: 'optional-observation', priority: 100 },
  'story-tidegarden-choose-site': { interactionClass: 'required', priority: 500 },
  'story-habitat-core': { interactionClass: 'required', priority: 520 },
  'story-habitat-certify': { interactionClass: 'required', priority: 520 },
  'story-habitat-rest': { interactionClass: 'required', priority: 520 }
} as const satisfies Record<StoryInteractionId, InteractionPolicy>;

const FALLBACK_POLICY: InteractionPolicy = {
  interactionClass: 'required',
  priority: 500
};

const CLASS_PRIORITY: Record<StoryInteractionClass, number> = {
  safety: 1000,
  required: 500,
  'optional-observation': 100
};

interface ResolverRegistration {
  resolver: StoryInteractionResolver;
  options: StoryInteractionRegistrationOptions;
}

interface EvaluatedCandidate {
  registration: ResolverRegistration;
  interaction: StoryInteractionCandidate;
  snapshot: StoryInteractionCandidateSnapshot;
}

const registrations = new Set<ResolverRegistration>();
let evaluatedCandidates: EvaluatedCandidate[] = [];
let resolutionRevision = 0;
let resolutionSnapshot: StoryInteractionResolutionSnapshot = {
  revision: 0,
  resolvedAt: 0,
  candidates: [],
  winner: null
};

const TRACE_LIMIT = 64;
let traceRevision = 0;
let attemptSequence = 0;
let traceEntries: StoryInteractionTraceEntry[] = [];

function now(): number {
  return Date.now();
}

function policyFor(id: InteractionId): InteractionPolicy {
  if (id.startsWith('story-')) {
    return STORY_INTERACTION_POLICY[id as StoryInteractionId] ?? FALLBACK_POLICY;
  }
  return FALLBACK_POLICY;
}

function snapshotCandidate(
  interaction: StoryInteractionCandidate,
  options: StoryInteractionRegistrationOptions
): StoryInteractionCandidateSnapshot {
  const policy = policyFor(interaction.id);
  const interactionClass =
    interaction.interactionClass ?? options.interactionClass ?? policy.interactionClass;
  const classWasOverridden = interaction.interactionClass !== undefined
    || options.interactionClass !== undefined;
  return {
    id: interaction.id,
    verb: interaction.verb,
    interactionClass,
    priority: interaction.priority
      ?? options.priority
      ?? (classWasOverridden ? CLASS_PRIORITY[interactionClass] : policy.priority),
    owner: interaction.owner ?? options.owner ?? `story:${interaction.id}`
  };
}

function compareCandidates(a: EvaluatedCandidate, b: EvaluatedCandidate): number {
  return CLASS_PRIORITY[b.snapshot.interactionClass] - CLASS_PRIORITY[a.snapshot.interactionClass]
    || b.snapshot.priority - a.snapshot.priority
    || a.snapshot.id.localeCompare(b.snapshot.id)
    || a.snapshot.owner.localeCompare(b.snapshot.owner)
    || a.snapshot.verb.localeCompare(b.snapshot.verb);
}

function cloneCandidate(
  candidate: StoryInteractionCandidateSnapshot | null
): StoryInteractionCandidateSnapshot | null {
  return candidate ? { ...candidate } : null;
}

function candidateContractMatches(
  entry: StoryInteractionTraceEntry,
  candidate: StoryInteractionCandidateSnapshot | null
): boolean {
  return Boolean(candidate
    && entry.interactionId === candidate.id
    && entry.verb === candidate.verb
    && entry.owner === candidate.owner);
}

function reconcilePendingPromptOutcomes(
  winner: StoryInteractionCandidateSnapshot | null,
  settledAt: number
): void {
  let changed = false;
  for (const entry of traceEntries) {
    if (entry.promptOutcome !== 'active' || candidateContractMatches(entry, winner)) continue;
    entry.promptOutcome = winner ? 'replaced' : 'cleared';
    entry.promptSettledAt = settledAt;
    entry.clearingLatencyMs = Math.max(0, settledAt - entry.attemptedAt);
    entry.replacementInteractionId = winner?.id ?? null;
    entry.activeForMs = entry.clearingLatencyMs;
    changed = true;
  }
  if (changed) traceRevision++;
}

/**
 * A performed story action invalidates the prompt that licensed it immediately.
 * The next player frame may publish a replacement after re-evaluating current
 * state, but a slow render frame must never leave the completed verb visibly
 * actionable for seconds or let it overlap the replacement UI.
 */
function clearPerformedPrompt(
  attempted: StoryInteractionCandidateSnapshot,
  settledAt: number
): void {
  const published = getInteraction();
  if (published
    && (published.id !== attempted.id || published.verb !== attempted.verb)) return;
  if (published) setInteraction(null);
  reconcilePendingPromptOutcomes(null, settledAt);
}

function publishResolution(next: EvaluatedCandidate[], resolvedAt = now()): void {
  evaluatedCandidates = [...next].sort(compareCandidates);
  const winner = evaluatedCandidates[0]?.snapshot ?? null;
  reconcilePendingPromptOutcomes(winner, resolvedAt);
  resolutionRevision++;
  resolutionSnapshot = {
    revision: resolutionRevision,
    resolvedAt,
    candidates: evaluatedCandidates.map(candidate => ({ ...candidate.snapshot })),
    winner: cloneCandidate(winner)
  };
}

function cloneTraceEntry(entry: StoryInteractionTraceEntry, sampledAt: number): StoryInteractionTraceEntry {
  return {
    ...entry,
    activeForMs: entry.promptOutcome === 'active'
      ? Math.max(0, sampledAt - entry.attemptedAt)
      : entry.activeForMs
  };
}

/** Register a live story resolver (returns the unregister). */
export function registerStoryInteraction(
  resolver: StoryInteractionResolver,
  options: StoryInteractionRegistrationOptions = {}
): () => void {
  const registration: ResolverRegistration = { resolver, options };
  registrations.add(registration);
  return () => {
    if (!registrations.delete(registration)) return;

    const previousWinner = resolutionSnapshot.winner;
    const remaining = evaluatedCandidates.filter(
      candidate => candidate.registration !== registration
    );
    publishResolution(remaining);

    // Component teardown must not leave one frame of a prompt whose resolver no
    // longer exists. The player loop will still perform its normal next-frame
    // resolution, including any newly eligible systemic action.
    const published = getInteraction();
    if (previousWinner
      && published?.id === previousWinner.id
      && published.verb === previousWinner.verb) {
      const winner = resolutionSnapshot.winner;
      setInteraction(winner ? { id: winner.id, verb: winner.verb } : null);
    }
  };
}

/**
 * Evaluate every live story resolver and return the explicitly ranked winner.
 * The returned perform function records attempt/return/throw semantics for both
 * EfficientPlayer and movie-mode callers without either knowing about React.
 */
export function resolveStoryInteraction(
  camera: THREE.Camera | null,
  position: THREE.Vector3
): (ActiveInteraction & { perform: () => void }) | null {
  const next: EvaluatedCandidate[] = [];
  for (const registration of registrations) {
    const interaction = registration.resolver(camera, position);
    if (!interaction) continue;
    next.push({
      registration,
      interaction,
      snapshot: snapshotCandidate(interaction, registration.options)
    });
  }
  publishResolution(next);

  const winner = evaluatedCandidates[0];
  if (!winner) return null;
  const { interaction, snapshot } = winner;
  return {
    id: interaction.id,
    verb: interaction.verb,
    perform: () => {
      const attemptId = recordStoryInteractionAttempt(snapshot, 'resolver-perform');
      try {
        interaction.perform();
        recordStoryInteractionOutcome(attemptId, 'returned');
      } catch (error) {
        recordStoryInteractionOutcome(
          attemptId,
          'threw',
          error instanceof Error ? error.message : String(error)
        );
        throw error;
      } finally {
        clearPerformedPrompt(snapshot, now());
      }
    }
  };
}

/** Mutation-safe resolution state for the unified journey probe bridge. */
export function getStoryInteractionResolutionSnapshot(): StoryInteractionResolutionSnapshot {
  return {
    revision: resolutionSnapshot.revision,
    resolvedAt: resolutionSnapshot.resolvedAt,
    candidates: resolutionSnapshot.candidates.map(candidate => ({ ...candidate })),
    winner: cloneCandidate(resolutionSnapshot.winner)
  };
}

/** Begin an attempt from a resolver wrapper or an external/manual driver. */
export function recordStoryInteractionAttempt(
  interaction: Pick<ActiveInteraction, 'id' | 'verb'> & { owner?: string },
  source = 'external'
): number {
  const attemptedAt = now();
  const entry: StoryInteractionTraceEntry = {
    attemptId: ++attemptSequence,
    interactionId: interaction.id,
    verb: interaction.verb,
    owner: interaction.owner ?? `story:${interaction.id}`,
    source,
    resolutionRevision: resolutionSnapshot.revision,
    attemptedAt,
    performOutcome: 'pending',
    performSettledAt: null,
    detail: null,
    promptOutcome: 'active',
    promptSettledAt: null,
    clearingLatencyMs: null,
    replacementInteractionId: null,
    activeForMs: 0
  };
  traceEntries.push(entry);
  if (traceEntries.length > TRACE_LIMIT) {
    traceEntries = traceEntries.slice(traceEntries.length - TRACE_LIMIT);
  }
  traceRevision++;
  return entry.attemptId;
}

/** Attach an explicit semantic result, or the wrapper's neutral return/throw result. */
export function recordStoryInteractionOutcome(
  attemptId: number,
  outcome: Exclude<StoryInteractionPerformOutcome, 'pending'>,
  detail: string | null = null
): boolean {
  const entry = traceEntries.find(candidate => candidate.attemptId === attemptId);
  if (!entry) return false;
  entry.performOutcome = outcome;
  entry.performSettledAt = now();
  entry.detail = detail;
  traceRevision++;
  return true;
}

/** Serializable bounded attempt trace. Pending prompt age is sampled on read. */
export function getStoryInteractionTrace(): StoryInteractionTraceSnapshot {
  const sampledAt = now();
  const entries = traceEntries.map(entry => cloneTraceEntry(entry, sampledAt));
  return {
    revision: traceRevision,
    entries,
    latest: entries.length > 0 ? { ...entries[entries.length - 1] } : null
  };
}

/** Start a fresh trace window without disturbing live resolver registrations. */
export function clearStoryInteractionTrace(): void {
  traceEntries = [];
  traceRevision++;
}
