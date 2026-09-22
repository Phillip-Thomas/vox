import type { StoryBeat, StoryChapter } from '../storyState.ts';
import type { GuidedStoryObjective } from '../ux/objectiveDirector.ts';
import type { StoryObjectiveGuidanceFacts } from '../storyObjectiveGuidance.ts';
import type { StoryInputPolicy } from '../storyInputPolicy.ts';
import { resolveAuthoredObjective } from './objectivePrimitives.ts';

// --- The beat contract ---------------------------------------------------------------
//
// One declaration per story beat, from which every per-beat table in the
// runtime is DERIVED. See PARAVOXIA_STORY_PIPELINE_REFACTOR_PLAN.md.
//
// Today a beat is declared in roughly ten hand-maintained places across eight
// files, nothing checks that they agree, and when they disagree the game fails
// silently: copy lands on a channel the player never sees, a marker rung
// publishes before its target exists, a beat with no timeout entry hangs
// forever, and the screening runs code the player never runs. The contract
// makes a partial declaration a build failure instead of a runtime surprise.
//
// Batch 0 ships the TYPE and an empty registry. No beat behaviour changes until
// a contract is registered for it, and the ladder trace
// (`tools/story-ladder-trace.mjs`) must stay byte-identical when one is.

export type BeatDisposition = 'objective' | 'cinematic';

/** How the beat is entered. `reactivation-from-done` is chapter 10's shape. */
export type BeatEntry = 'sequence' | 'reactivation-from-done';

export interface BeatHudOwnership {
  /** The regulation feed treatment (scanlines, dither, chrome) is mounted. */
  feedEffects: boolean;
  /** The embodied objective HUD owns objective copy and the marker. */
  embodiedGuidance: boolean;
  /** The cross D-pad replaces the analog cluster on touch. */
  earlyTouchDpad: boolean;
  /** The frame belongs to a site camera (feed.externalCameraMix = 1). */
  externalCamera: boolean;
}

/**
 * The screening's rail for this beat. Batch 5 replaces the autopilot switch
 * with these. A rail may move, look and act; it may NEVER grant an item, mark a
 * milestone or advance a beat — a rail that cannot make progress reports
 * `stuck` and the wait overlay says so.
 */
export interface BeatRail {
  /** Seconds after which a rail reports itself stuck. Never a force-advance. */
  stuckAfterSeconds: number;
  /** Short phrase the wait overlay shows during a genuine hold. */
  waitReason: string | null;
  /** Player-control rail owned by this beat. Cinematic beats have none. */
  tick?: (context: import('../autopilot.ts').RailRuntime) => void;
}

export interface BeatContract<Id extends StoryBeat = StoryBeat> {
  id: Id;
  chapter: StoryChapter;
  disposition: BeatDisposition;
  entry: BeatEntry;
  /**
   * Presentation-only objective resolver. Null for cinematic beats. The copy
   * it returns is THE work order — there is no second channel.
   */
  objective: ((facts: Readonly<StoryObjectiveGuidanceFacts>) => GuidedStoryObjective) | null;
  input: StoryInputPolicy;
  hud: BeatHudOwnership;
  rail: BeatRail;
  marker?: ((handles: import('./worldHandles.ts').WorldHandles, candidate: Readonly<GuidedStoryObjective>) => import('./worldHandles.ts').MarkerPose | null) | null;
  /** Registry journey rows authored beside the beat, emitted by the generator. */
  journey?: readonly { id: string; beat: string; criticality: string; [key: string]: unknown }[];
}

/** Narrowing helper so a contract file cannot name a beat that does not exist. */
export function defineBeat<Id extends StoryBeat>(contract: BeatContract<Id>): BeatContract<Id> {
  const authored = contract.objective;
  return { ...contract, objective: authored ? facts => resolveAuthoredObjective(authored, facts) : null };
}
