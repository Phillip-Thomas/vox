import { useSyncExternalStore } from 'react';
import {
  setVoxelRealityStage,
  type VoxelRealityStage
} from '../game/systems/realityRenderSystem.ts';
import { hasMilestone, markMilestone } from '../game/systems/progressionSystem.ts';
import { addItem } from '../game/systems/inventorySystem.ts';
import { setStoryForcedDayPhase } from './storyDayPhase.ts';
import { seedDebrisCollected } from './debrisSalvage.ts';
import { seedSupplyPodsCollected } from './supplyPods.ts';
import { clearVoxelEditsForWorld } from '../game/systems/persistence.ts';
import { createWorldIdentity } from '../game/worldIdentity.ts';
import { STORY_COORDINATE } from './world/storyWorld.ts';

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

export type StoryChapter = 'none' | 'prologue' | 'ch1' | 'ch2' | 'ch3' | 'ch4' | 'complete';

export type StoryBeat =
  // prologue (terminal overlay, app phase stays 'menu')
  | 'crawl' | 'manifest' | 'voyage' | 'deflect' | 'crash'
  // chapter 1 — the monochrome ladder: crash-landing descent, then the history
  // of game perspectives one era at a time — fixed-screen, the tracking unlock,
  // the scrolling side-scroller (quota + salvage), the belt-scroll depth band,
  // top-down nav, isometric height, the 2D→3D lift, the pan-tilt CCTV feed
  | 'descent' | 'ch1-fixed' | 'ch1-track' | 'ch1-raster'
  | 'ch1-depth' | 'ch1-nav' | 'ch1-iso'
  | 'ch1-lift' | 'ch1-anomaly' | 'a1-ramp'
  // chapter 2 — color, and the tree
  | 'ch2-color' | 'ch2-approach' | 'a2-awakening'
  // chapter 3 — grain
  | 'ch3-gather' | 'ch3-dusk' | 'ch3-await-rest' | 'a3-dawn'
  // chapter 3's tail — the first day alive (each remaining sense gets its scene)
  | 'ch3-thirst' | 'ch3-forage' | 'ch3-signal'
  // chapter 4 — the other worker (shipped through the arrival; ch4-audit next)
  | 'ch4-vigil' | 'ch4-arrival'
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
  ch1Track: 'story:ch1:track',
  ch1Quota: 'story:ch1:quota',
  ch1Depth: 'story:ch1:depth',
  ch1Nav: 'story:ch1:nav',
  ch1Iso: 'story:ch1:iso',
  a1: 'story:a1',
  a2: 'story:a2',
  a3: 'story:a3',
  /** Survival senses arrive ONE BY ONE — each HUD element appears when the
   *  story first names its sensation (the self-discovery arc). */
  senseInventory: 'story:sense:inventory',
  senseHealth: 'story:sense:health',
  senseTemp: 'story:sense:temp',
  senseWater: 'story:sense:water',
  senseFood: 'story:sense:food',
  senseStamina: 'story:sense:stamina',
  senseOxygen: 'story:sense:oxygen',
  senseJet: 'story:sense:jet',
  senseMaw: 'story:sense:maw',
  /** Ch3's tail + chapter 4 checkpoints (the first day alive → the auditor). */
  ch3Drank: 'story:ch3:drank',
  ch3Ate: 'story:ch3:ate',
  ch3Signal: 'story:ch3:signal',
  ch4Vigil: 'story:ch4:vigil',
  ch4Arrived: 'story:ch4:arrived',
  /**
   * Legacy slice terminal. Saves that finished the A0→A3 slice carry it; the
   * story now CONTINUES past it (they resume at ch3-thirst). The live terminal
   * checkpoint is ch4Arrived until chapter 4's remaining beats ship (see
   * PARAVOXIA_CH4_PLAN.md §2 S6+).
   */
  complete: 'story:complete'
} as const;

let snapshot: StorySnapshot = { active: false, chapter: 'none', beat: null };

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function setSnapshot(patch: Partial<StorySnapshot>): void {
  snapshot = { ...snapshot, ...patch };
  // Dev affordance (mirrors window.__game): lets capture harnesses watch beats.
  if (typeof window !== 'undefined') {
    (window as unknown as { __storyBeat?: string | null }).__storyBeat = snapshot.beat;
  }
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
  if (hasMilestone(STORY_MILESTONES.ch4Arrived)) return { chapter: 'complete', beat: 'done' };
  if (hasMilestone(STORY_MILESTONES.ch4Vigil)) return { chapter: 'ch4', beat: 'ch4-arrival' };
  if (hasMilestone(STORY_MILESTONES.ch3Signal)) return { chapter: 'ch4', beat: 'ch4-vigil' };
  if (hasMilestone(STORY_MILESTONES.ch3Ate)) return { chapter: 'ch3', beat: 'ch3-signal' };
  if (hasMilestone(STORY_MILESTONES.ch3Drank)) return { chapter: 'ch3', beat: 'ch3-forage' };
  // Legacy slice-complete saves land here too (a3 is always marked with it):
  // the story continues into the first day alive.
  if (hasMilestone(STORY_MILESTONES.a3)) return { chapter: 'ch3', beat: 'ch3-thirst' };
  if (hasMilestone(STORY_MILESTONES.a2)) return { chapter: 'ch3', beat: 'ch3-gather' };
  if (hasMilestone(STORY_MILESTONES.a1)) return { chapter: 'ch2', beat: 'ch2-color' };
  if (hasMilestone(STORY_MILESTONES.ch1Iso)) return { chapter: 'ch1', beat: 'ch1-anomaly' };
  if (hasMilestone(STORY_MILESTONES.ch1Nav)) return { chapter: 'ch1', beat: 'ch1-iso' };
  if (hasMilestone(STORY_MILESTONES.ch1Depth)) return { chapter: 'ch1', beat: 'ch1-nav' };
  if (hasMilestone(STORY_MILESTONES.ch1Quota)) return { chapter: 'ch1', beat: 'ch1-depth' };
  if (hasMilestone(STORY_MILESTONES.ch1Track)) return { chapter: 'ch1', beat: 'ch1-raster' };
  if (hasMilestone(STORY_MILESTONES.prologueSeen)) return { chapter: 'ch1', beat: 'ch1-fixed' };
  return { chapter: 'prologue', beat: 'crawl' };
}

/**
 * Single source of truth for which reality stage a story point renders at:
 * the feed chapters are unresolved (`bare`), A1 brings color, A3 brings material
 * (which the first-day tail and chapter 4 keep — A4's `alive` comes later).
 */
export function stageForStoryPoint(entry: StoryEntryPoint): VoxelRealityStage {
  if (entry.chapter === 'complete') return 'material';
  if (entry.chapter === 'ch4') return 'material';
  if (entry.chapter === 'ch3') {
    // Chapter 3 straddles A3: the tail beats (the first day alive) are post-dawn.
    return beatIndex(entry.beat) >= beatIndex('ch3-thirst') ? 'material' : 'color';
  }
  if (entry.chapter === 'ch2') return 'color';
  return 'bare';
}

/** True when a save exists mid-story (drives the menu's "Continue Story" label).
 *  Keyed on the LIVE terminal (ch4Arrived), not the legacy slice terminal —
 *  finished-slice saves see "Continue Story" again and resume at ch3-thirst. */
export function canContinueStory(): boolean {
  return hasMilestone(STORY_MILESTONES.started) && !hasMilestone(STORY_MILESTONES.ch4Arrived);
}

// --- deep links / debug jumps ---------------------------------------------------
//
// EVERY beat is a jump target (`?story=<beat>`), which gives a "before" and an
// "after" for every key point: jumping to a transition beat (a1-ramp,
// a2-awakening, a3-dawn) plays that awakening immediately; jumping to the beat
// after it starts in the settled post-awakening state. Legacy short aliases kept.

/** Canonical beat order — drives milestone/item seeding and the debug panel. */
export const STORY_BEAT_ORDER: readonly StoryBeat[] = [
  'crawl', 'manifest', 'voyage', 'deflect', 'crash',
  'descent', 'ch1-fixed', 'ch1-track', 'ch1-raster',
  'ch1-depth', 'ch1-nav', 'ch1-iso',
  'ch1-lift', 'ch1-anomaly', 'a1-ramp',
  'ch2-color', 'ch2-approach', 'a2-awakening',
  'ch3-gather', 'ch3-dusk', 'ch3-await-rest', 'a3-dawn',
  'ch3-thirst', 'ch3-forage', 'ch3-signal',
  'ch4-vigil', 'ch4-arrival',
  'done'
];

const JUMP_ALIASES: Record<string, StoryBeat> = {
  ch1: 'ch1-raster',
  a1: 'ch1-anomaly',
  ch2: 'ch2-color',
  a2: 'ch2-approach',
  ch3: 'ch3-gather',
  a3: 'ch3-await-rest',
  day: 'ch3-thirst',
  ch4: 'ch4-vigil'
};

export function chapterForBeat(beat: StoryBeat): StoryChapter {
  return beat === 'crawl' || beat === 'manifest' || beat === 'voyage' || beat === 'deflect' || beat === 'crash' ? 'prologue'
    : beat === 'descent' || beat.startsWith('ch1') || beat === 'a1-ramp' ? 'ch1'
    : beat.startsWith('ch2') || beat === 'a2-awakening' ? 'ch2'
    : beat.startsWith('ch4') ? 'ch4'
    : beat === 'done' ? 'complete'
    : 'ch3';
}

function beatIndex(beat: StoryBeat): number {
  return STORY_BEAT_ORDER.indexOf(beat);
}

/** `?story=1` = full run from the menu; `?story=<beat|alias>` = dev jump. */
export function parseStoryParam(): 'full' | StoryBeat | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = new URLSearchParams(window.location.search).get('story');
    if (!raw) return null;
    if (raw === '1') return 'full';
    if (raw in JUMP_ALIASES) return JUMP_ALIASES[raw];
    return (STORY_BEAT_ORDER as readonly string[]).includes(raw) ? (raw as StoryBeat) : null;
  } catch {
    return null;
  }
}

/**
 * Everything a beat presumes has already happened: milestones (so resume/HUD
 * logic agrees) and inventory (so the ledger and the campfire chain are live).
 */
function seedForBeat(beat: StoryBeat): void {
  const m = STORY_MILESTONES;
  const at = beatIndex(beat);
  markMilestone(m.started);
  if (at >= beatIndex('descent')) markMilestone(m.prologueSeen);
  if (at >= beatIndex('ch1-raster')) markMilestone(m.ch1Track);
  if (at >= beatIndex('ch1-depth')) {
    markMilestone(m.ch1Quota);
    addItem('biofiber', 6);
    addItem('stone', 4);
    seedDebrisCollected(); // wood/flint arrive as the recovered hull debris
  }
  if (at >= beatIndex('ch1-nav')) {
    markMilestone(m.ch1Depth);
    seedSupplyPodsCollected(); // biofuel/flint/wood arrive as the recovered pods
  }
  if (at >= beatIndex('ch1-iso')) markMilestone(m.ch1Nav);
  if (at >= beatIndex('ch1-lift')) markMilestone(m.ch1Iso);
  if (at >= beatIndex('ch2-color')) markMilestone(m.a1);
  if (at >= beatIndex('ch3-gather')) markMilestone(m.a2); // campfire mats all earned upstream
  if (at >= beatIndex('ch3-gather')) markMilestone(m.senseHealth); // embodiment reports a body
  if (at >= beatIndex('ch3-dusk')) {
    // Introduced during the gather act — later jumps arrive with them.
    markMilestone(m.senseInventory);
    markMilestone(m.senseTemp);
  }
  // The first day alive: each tail beat presumes the previous scene resolved.
  if (at >= beatIndex('ch3-thirst')) markMilestone(m.a3);
  if (at >= beatIndex('ch3-forage')) {
    markMilestone(m.senseWater);
    markMilestone(m.ch3Drank);
  }
  if (at >= beatIndex('ch3-signal')) {
    markMilestone(m.senseFood);
    markMilestone(m.ch3Ate);
  }
  if (at >= beatIndex('ch4-vigil')) {
    markMilestone(m.ch3Signal);
    markMilestone(m.senseStamina);
  }
  if (at >= beatIndex('ch4-arrival')) markMilestone(m.ch4Vigil);
  if (at >= beatIndex('done')) {
    markMilestone(m.ch4Arrived);
    markMilestone(m.complete);
  }
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
  // Dev flows (`?story=` jumps, movie runs) start from PRISTINE terrain — debug
  // sessions used to accumulate each other's strip-mining. The menu path
  // (beginStory, no param) keeps the player's real world edits.
  clearVoxelEditsForWorld(createWorldIdentity(STORY_COORDINATE));
  if (param === 'full') {
    beginStory();
    return;
  }
  seedForBeat(param);
  const chapter = chapterForBeat(param);
  if (chapter === 'complete') {
    // "After A3": the finished world — sandbox at the earned stage.
    setVoxelRealityStage('material');
    setSnapshot({ active: false, chapter: 'complete', beat: 'done' });
    return;
  }
  setVoxelRealityStage(stageForStoryPoint({ chapter, beat: param }));
  setSnapshot({ active: true, chapter, beat: param });
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
  setSnapshot({ chapter: chapterForBeat(beat), beat });
}

/** The shipped arc's end: hand the world back to the sandbox at the earned stage.
 *  (Now reached AFTER the first day alive + the auditor's arrival — see the
 *  director's TEMPORARY hand-off note; ch4-audit continues from here.) */
export function completeStory(): void {
  markMilestone(STORY_MILESTONES.a3);
  markMilestone(STORY_MILESTONES.ch4Arrived);
  markMilestone(STORY_MILESTONES.complete);
  // The earned senses are part of the earned world — never strand the HUD gates.
  // (Oxygen/jet/maw stay UNDISCOVERED: they arrive live, or in chapter 4's coda.)
  markMilestone(STORY_MILESTONES.senseInventory);
  markMilestone(STORY_MILESTONES.senseHealth);
  markMilestone(STORY_MILESTONES.senseTemp);
  markMilestone(STORY_MILESTONES.senseWater);
  markMilestone(STORY_MILESTONES.senseFood);
  markMilestone(STORY_MILESTONES.senseStamina);
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

// Survival chrome is INTRODUCED, not assumed: each sense appears when the story
// names it (ch3's "why am i… thirsty?"), then stays. Pure sandbox saves (story
// never started) see everything — the gates only exist inside a story save.

/**
 * Flora/fauna dormancy in the story world: life beyond trees and grass belongs
 * to a LATER awakening (A4 "Breath"). Milestone-driven so no cutscene's effect
 * ramps can flash a glimpse; lifts the moment the future awakening marks it.
 */
export function storyLifeDormant(): boolean {
  if (!hasMilestone(STORY_MILESTONES.started)) return false;
  return !hasMilestone('story:a4');
}

export function storyHudHideVitals(): boolean {
  if (!hasMilestone(STORY_MILESTONES.started)) return false;
  return !hasMilestone(STORY_MILESTONES.senseHealth);
}

/** Which suit-HUD stat rows have been DISCOVERED (pure sandbox: everything). */
export type SuitStat =
  | 'health' | 'hunger' | 'thirst' | 'warmth' | 'stamina' | 'oxygen'
  | 'jet' | 'maw';

const STAT_SENSE: Record<SuitStat, string> = {
  health: STORY_MILESTONES.senseHealth,
  hunger: STORY_MILESTONES.senseFood,
  thirst: STORY_MILESTONES.senseWater,
  warmth: STORY_MILESTONES.senseTemp,
  stamina: STORY_MILESTONES.senseStamina,
  oxygen: STORY_MILESTONES.senseOxygen,
  jet: STORY_MILESTONES.senseJet,
  maw: STORY_MILESTONES.senseMaw
};

export function storyStatVisible(stat: SuitStat): boolean {
  if (!hasMilestone(STORY_MILESTONES.started)) return true;
  return hasMilestone(STAT_SENSE[stat]);
}

export function storyHudHideInventory(): boolean {
  if (!hasMilestone(STORY_MILESTONES.started)) return false;
  return !hasMilestone(STORY_MILESTONES.senseInventory);
}
