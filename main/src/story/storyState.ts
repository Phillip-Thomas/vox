import { useSyncExternalStore } from 'react';
import {
  setVoxelRealityStage,
  type VoxelRealityStage
} from '../game/systems/realityRenderSystem.ts';
import { hasMilestone, markMilestone } from '../game/systems/progressionSystem.ts';
import { addItem } from '../game/systems/inventorySystem.ts';
import { setStoryForcedDayPhase } from './storyDayPhase.ts';

// --- Story mode state ---------------------------------------------------------
//
// Singleton external store (the appState.ts pattern): the DOM overlays (terminal
// prologue, regulation feed HUD), the in-Canvas director driver, and the input
// gates in EfficientPlayer/CameraControls all read story progress, and React
// context does not cross the react-three-fiber reconciler boundary.
//
// The story is the fidelity ladder: each "awakening" beat raises the voxel
// reality stage (bare -> color -> material). Checkpoints persist as ordinary
// progression milestones (story:*), which already round-trip through the global
// save — the store itself holds only live session state.

export type StoryChapter = 'none' | 'prologue' | 'ch1' | 'ch2' | 'ch3' | 'complete';

export type StoryBeat =
  // prologue (terminal overlay, app phase stays 'menu')
  | 'crawl' | 'voyage' | 'deflect' | 'crash'
  // chapter 1 — raster side-scroller (quota) then the pan-tilt CCTV feed
  | 'ch1-raster' | 'ch1-anomaly' | 'a1-ramp'
  // chapter 2 — color, and the tree
  | 'ch2-color' | 'ch2-approach' | 'a2-awakening'
  // chapter 3 — grain
  | 'ch3-gather' | 'ch3-dusk' | 'ch3-await-rest' | 'a3-dawn'
  | 'done';

export interface StorySnapshot {
  active: boolean;
  chapter: StoryChapter;
  beat: StoryBeat | null;
}

// Milestone ids (persisted checkpoints). Free-form strings by design — see
// progressionSystem. Choices persist as `story:choice:<cardId>:<optionId>`.
export const STORY_MILESTONES = {
  started: 'story:started',
  prologueSeen: 'story:prologue-seen',
  ch1Quota: 'story:ch1:quota',
  a1: 'story:a1',
  a2: 'story:a2',
  a3: 'story:a3',
  complete: 'story:complete'
} as const;

let snapshot: StorySnapshot = { active: false, chapter: 'none', beat: null };

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function setSnapshot(patch: Partial<StorySnapshot>): void {
  snapshot = { ...snapshot, ...patch };
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): StorySnapshot {
  return snapshot;
}

export function useStoryState(): StorySnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Non-hook live read for per-frame loops / event handlers. */
export function getStoryStateSnapshot(): StorySnapshot {
  return snapshot;
}

export function subscribeStory(listener: () => void): () => void {
  return subscribe(listener);
}

// --- resume derivation --------------------------------------------------------

export interface StoryEntryPoint {
  chapter: StoryChapter;
  beat: StoryBeat;
}

/**
 * Where a (re)entering player lands, derived from persisted milestones. The
 * awakenings are the checkpoints; un-checkpointed sub-beats re-derive from world
 * state (e.g. quota progress re-reads the inventory).
 */
export function storyEntryPoint(): StoryEntryPoint {
  if (hasMilestone(STORY_MILESTONES.a3)) return { chapter: 'complete', beat: 'done' };
  if (hasMilestone(STORY_MILESTONES.a2)) return { chapter: 'ch3', beat: 'ch3-gather' };
  if (hasMilestone(STORY_MILESTONES.a1)) return { chapter: 'ch2', beat: 'ch2-color' };
  if (hasMilestone(STORY_MILESTONES.ch1Quota)) return { chapter: 'ch1', beat: 'ch1-anomaly' };
  if (hasMilestone(STORY_MILESTONES.prologueSeen)) return { chapter: 'ch1', beat: 'ch1-raster' };
  return { chapter: 'prologue', beat: 'crawl' };
}

/**
 * Single source of truth for which reality stage a story point renders at:
 * the feed chapters are unresolved (`bare`), A1 brings color, A3 brings material.
 * Post-slice sandbox keeps `material` — later awakenings raise it further.
 */
export function stageForStoryPoint(entry: StoryEntryPoint): VoxelRealityStage {
  if (entry.chapter === 'complete') return 'material';
  if (entry.chapter === 'ch3') return 'color';
  if (entry.chapter === 'ch2') return 'color';
  return 'bare';
}

/** True when a save exists mid-story (drives the menu's "Continue Story" label). */
export function canContinueStory(): boolean {
  return hasMilestone(STORY_MILESTONES.started) && !hasMilestone(STORY_MILESTONES.complete);
}

// --- deep links ---------------------------------------------------------------

export type StoryJump = 'ch1' | 'a1' | 'ch2' | 'a2' | 'ch3' | 'a3';

const STORY_JUMPS: Record<StoryJump, StoryEntryPoint> = {
  ch1: { chapter: 'ch1', beat: 'ch1-raster' },
  a1: { chapter: 'ch1', beat: 'ch1-anomaly' },
  ch2: { chapter: 'ch2', beat: 'ch2-color' },
  a2: { chapter: 'ch2', beat: 'ch2-approach' },
  ch3: { chapter: 'ch3', beat: 'ch3-gather' },
  a3: { chapter: 'ch3', beat: 'ch3-await-rest' }
};

/** `?story=1` = full run from the menu; `?story=ch1|a1|ch2|a2|ch3|a3` = dev jump. */
export function parseStoryParam(): 'full' | StoryJump | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = new URLSearchParams(window.location.search).get('story');
    if (!raw) return null;
    if (raw === '1') return 'full';
    return raw in STORY_JUMPS ? (raw as StoryJump) : null;
  } catch {
    return null;
  }
}

/** Milestones a jump point presumes reached (marked so resume/HUD logic agrees). */
function seedJumpMilestones(jump: StoryJump): void {
  const m = STORY_MILESTONES;
  const before: Record<StoryJump, string[]> = {
    ch1: [m.started, m.prologueSeen],
    a1: [m.started, m.prologueSeen, m.ch1Quota],
    ch2: [m.started, m.prologueSeen, m.ch1Quota, m.a1],
    a2: [m.started, m.prologueSeen, m.ch1Quota, m.a1],
    ch3: [m.started, m.prologueSeen, m.ch1Quota, m.a1, m.a2],
    a3: [m.started, m.prologueSeen, m.ch1Quota, m.a1, m.a2]
  };
  for (const id of before[jump]) markMilestone(id);
}

// --- lifecycle ----------------------------------------------------------------

/**
 * Called once at App boot, AFTER restoreGlobal() (milestones are loaded). Handles
 * the `?story=` deep links; the menu Story button drives the normal path via
 * beginStory(). Does nothing on a plain sandbox boot.
 */
export function initStoryFromSave(): void {
  const param = parseStoryParam();
  if (!param) return;
  if (param === 'full') {
    beginStory();
    return;
  }
  seedJumpMilestones(param);
  const entry = STORY_JUMPS[param];
  // Jumps past the quota carry its yield (the HUD ledger stays consistent).
  if (param !== 'ch1') {
    addItem('biofiber', 6);
    addItem('stone', 4);
  }
  // Ch3 jumps need the campfire chain testable without replaying Ch1's harvest.
  if (param === 'ch3' || param === 'a3' || param === 'a2') {
    addItem('flint', 2);
    addItem('biofuel', 1);
    addItem('wood', 3);
  }
  setVoxelRealityStage(stageForStoryPoint(entry));
  setSnapshot({ active: true, chapter: entry.chapter, beat: entry.beat });
}

/**
 * Enter story mode (menu Story button / ?story=1). Resumes from the persisted
 * checkpoint; a fresh save starts at the prologue.
 */
export function beginStory(): void {
  markMilestone(STORY_MILESTONES.started);
  const entry = storyEntryPoint();
  if (entry.chapter === 'complete') {
    // Finished players re-enter their world as sandbox, at their earned stage.
    setVoxelRealityStage(stageForStoryPoint(entry));
    setSnapshot({ active: false, chapter: 'complete', beat: 'done' });
    return;
  }
  setVoxelRealityStage(stageForStoryPoint(entry));
  setSnapshot({ active: true, chapter: entry.chapter, beat: entry.beat });
}

/** Director-only: move to the next beat (and chapter, when the beat crosses). */
export function advanceToBeat(beat: StoryBeat): void {
  const chapter: StoryChapter =
    beat === 'crawl' || beat === 'voyage' || beat === 'deflect' || beat === 'crash' ? 'prologue'
    : beat.startsWith('ch1') || beat === 'a1-ramp' ? 'ch1'
    : beat.startsWith('ch2') || beat === 'a2-awakening' ? 'ch2'
    : beat === 'done' ? 'complete'
    : 'ch3';
  setSnapshot({ chapter, beat });
}

/** The slice's end: hand the world back to the sandbox at the earned stage. */
export function completeStory(): void {
  markMilestone(STORY_MILESTONES.a3);
  markMilestone(STORY_MILESTONES.complete);
  setVoxelRealityStage('material');
  setStoryForcedDayPhase(null); // the day cycle is the player's now
  setSnapshot({ active: false, chapter: 'complete', beat: 'done' });
}

/** Quit-to-menu mid-story: progress is already in milestones; go dormant. */
export function deactivateStory(): void {
  if (!snapshot.active) return;
  setStoryForcedDayPhase(null); // never leave the sandbox sun frozen
  setSnapshot({ active: false });
}

/** Persist a prologue event-card choice (echoed by Ch1's work order). */
export function recordStoryChoice(cardId: string, optionId: string): void {
  markMilestone(`story:choice:${cardId}:${optionId}`);
}

// --- derived reads ------------------------------------------------------------

/** The Regulation Feed owns the screen (sandbox HUD hidden) until A2 completes. */
export function storyHudTakeover(s: StorySnapshot = snapshot): boolean {
  if (!s.active || !s.beat) return false;
  return s.chapter === 'ch1' || s.chapter === 'ch2';
}

/** Ship/star-map affordances stay hidden while any story chapter is live. */
export function storyHudMask(s: StorySnapshot = snapshot): boolean {
  return s.active;
}
