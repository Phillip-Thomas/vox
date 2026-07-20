import { useSyncExternalStore } from 'react';
import {
  setVoxelRealityStage,
  type VoxelRealityStage
} from '../game/systems/realityRenderSystem.ts';
import {
  advanceEraTo,
  getMilestones,
  hasMilestone,
  markMilestone,
  removeMilestone,
  removeMilestonesByPrefix,
  replaceEraForRollback
} from '../game/systems/progressionSystem.ts';
import { addItem, getItemCount, removeItem, resetInventory } from '../game/systems/inventorySystem.ts';
import { setStoryForcedDayPhase } from './storyDayPhase.ts';
import { seedDebrisCollected } from './debrisSalvage.ts';
import { seedSupplyPodsCollected } from './supplyPods.ts';
import {
  clearCampfiresForWorld,
  clearPlayerPoseForWorld,
  clearVoxelEditsForWorld,
  clearWorldStateForWorld
} from '../game/systems/persistence.ts';
import { createWorldIdentity } from '../game/worldIdentity.ts';
import { STORY_COORDINATE } from './world/storyWorld.ts';
import { resetMaw } from '../game/systems/mawSystem.ts';
import { resetVitals } from '../game/systems/survivalVitals.ts';
import { resetWaterskin } from '../game/systems/consumeSystem.ts';
import { resetJetpackFuel } from '../game/systems/jetpackSystem.ts';
import { clearStoryText } from './storyText.ts';
import { resetStoryClock } from './storyClock.ts';
import {
  applyShipRestorationSnapshot,
  resetShipRestoration
} from '../game/systems/shipRestoration.ts';
import {
  debugStartInDescent,
  debugStartInSpace,
  resetTravel
} from '../state/spaceFlight.ts';
import {
  bootstrapTidegardenLandfallDebug,
  bootstrapTidegardenSurfaceDebug,
  resumeTidegardenLandfallFromSave
} from './tidegardenLandfallBootstrap.ts';
import { tidegardenIdentity } from './tidegardenRoute.ts';
import { resetEmergentStoryEvents } from './emergentStoryEvents.ts';
import { resetEmergentMawRepairRitual } from './emergentMawRepair.ts';
import { AUTHORED_DIVE_MILESTONES, resetAuthoredDiveRuntime } from './emergentDive.ts';
import { EMERGENT_CAPABILITY_MILESTONES } from './emergentCapabilities.ts';
import {
  PHYSICAL_BOARDING_MILESTONE,
  PHYSICAL_BOARDING_SEALED_MILESTONE
} from './physicalBoardingReceipts.ts';
import { bootstrapOriginLaunchDebug } from './originLaunchBootstrap.ts';

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

export type StoryChapter =
  | 'none' | 'prologue'
  | 'ch1' | 'ch2' | 'ch3' | 'ch4' | 'ch5' | 'ch6' | 'ch7' | 'ch8' | 'ch9'
  | 'complete';

export type StoryBeat =
  // prologue (terminal overlay, app phase stays 'menu')
  | 'crawl' | 'manifest' | 'voyage' | 'deflect' | 'crash'
  // chapter 1 — the monochrome ladder: crash-landing descent, then the history
  // of game perspectives one era at a time — fixed-screen, the tracking unlock,
  // the scrolling side-scroller (quota + salvage), its locked-row pod recovery,
  // top-down nav, isometric height, the 2D→3D lift, the embodied pan-tilt survey
  | 'descent' | 'ch1-fixed' | 'ch1-track' | 'ch1-raster'
  | 'ch1-depth' | 'ch1-nav' | 'ch1-iso'
  | 'ch1-lift' | 'ch1-anomaly' | 'a1-ramp'
  // chapter 2 — color, and the tree
  | 'ch2-color' | 'ch2-approach' | 'a2-awakening'
  // chapter 3 — grain
  | 'ch3-gather' | 'ch3-dusk' | 'ch3-await-rest' | 'a3-dawn'
  // chapter 3's tail — the first day alive (each remaining sense gets its scene)
  | 'ch3-thirst' | 'ch3-forage' | 'ch3-signal'
  // chapter 4 — the other worker, the ordered regression, and Breath
  | 'ch4-vigil' | 'ch4-arrival' | 'ch4-audit' | 'ch4-comply' | 'ch4-defy' | 'a4-exhale'
  // chapters 5–9 — repair the instrument, return with breath, restore and fly
  | 'ch5-maw' | 'ch6-dive'
  | 'ch7-reconstruct' | 'ch7-board'
  | 'ch8-launch' | 'ch8-crossing' | 'ch8-landfall'
  | 'ch9-settle' | 'ch9-hearth'
  | 'done';

export interface StorySnapshot {
  active: boolean;
  chapter: StoryChapter;
  beat: StoryBeat | null;
  /** In-memory scene remount token for an explicit clean replay. */
  runId: number;
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
  ch4Audit: 'story:ch4:audit-complete',
  ch4Complied: 'story:ch4:compliance-complete',
  ch4Defied: 'story:ch4:refusal-complete',
  a4: 'story:a4',
  a4Handback: 'story:a4:handback',
  ch5Maw: 'story:ch5:maw-repaired',
  ch6Dive: 'story:ch6:keel-banked',
  ch7Reconstructed: 'story:ch7:flight-ready',
  ch7Boarded: 'story:ch7:boarded',
  ch8Launched: 'story:ch8:launched',
  ch8Crossed: 'story:ch8:crossed',
  ch8Landfall: 'story:ch8:landfall',
  ch9Settled: 'story:ch9:settled',
  ch9Hearth: 'story:ch9:hearth',
  /**
   * Legacy slice terminal. Saves that finished the A0→A3 slice carry it; the
   * story now CONTINUES past it (they resume at ch3-thirst). The live terminal
   * checkpoint is retained for old saves, but it is no longer a terminal.
   */
  complete: 'story:complete'
} as const;

let snapshot: StorySnapshot = { active: false, chapter: 'none', beat: null, runId: 0 };

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
  if (hasMilestone(STORY_MILESTONES.ch9Hearth)) return { chapter: 'complete', beat: 'done' };
  if (hasMilestone(STORY_MILESTONES.ch9Settled)) return { chapter: 'ch9', beat: 'ch9-hearth' };
  if (hasMilestone(STORY_MILESTONES.ch8Landfall)) return { chapter: 'ch9', beat: 'ch9-settle' };
  if (hasMilestone(STORY_MILESTONES.ch8Crossed)) return { chapter: 'ch8', beat: 'ch8-landfall' };
  if (hasMilestone(STORY_MILESTONES.ch8Launched)) return { chapter: 'ch8', beat: 'ch8-crossing' };
  if (hasMilestone(STORY_MILESTONES.ch7Boarded)) return { chapter: 'ch8', beat: 'ch8-launch' };
  if (hasMilestone(STORY_MILESTONES.ch7Reconstructed)) return { chapter: 'ch7', beat: 'ch7-board' };
  if (hasMilestone(STORY_MILESTONES.ch6Dive)) return { chapter: 'ch7', beat: 'ch7-reconstruct' };
  if (hasMilestone(STORY_MILESTONES.ch5Maw)) return { chapter: 'ch6', beat: 'ch6-dive' };
  if (hasMilestone(STORY_MILESTONES.a4Handback)) return { chapter: 'ch5', beat: 'ch5-maw' };
  if (hasMilestone(STORY_MILESTONES.a4)) return { chapter: 'ch4', beat: 'a4-exhale' };
  if (hasMilestone(STORY_MILESTONES.ch4Defied)) return { chapter: 'ch4', beat: 'a4-exhale' };
  if (hasMilestone(STORY_MILESTONES.ch4Complied)) return { chapter: 'ch4', beat: 'ch4-defy' };
  if (hasMilestone(STORY_MILESTONES.ch4Audit)) return { chapter: 'ch4', beat: 'ch4-comply' };
  if (hasMilestone(STORY_MILESTONES.ch4Arrived)) return { chapter: 'ch4', beat: 'ch4-audit' };
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
  if (entry.chapter === 'complete') return 'alive';
  if (entry.chapter === 'ch5' || entry.chapter === 'ch6' || entry.chapter === 'ch7'
    || entry.chapter === 'ch8' || entry.chapter === 'ch9') return 'alive';
  if (entry.chapter === 'ch4') {
    return entry.beat === 'a4-exhale' && hasMilestone(STORY_MILESTONES.a4)
      ? 'alive'
      : 'material';
  }
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
  return hasMilestone(STORY_MILESTONES.started) && !hasMilestone(STORY_MILESTONES.ch9Hearth);
}

/** True only once the two-world arc has returned control at the second hearth. */
export function hasCompletedStory(): boolean {
  return hasMilestone(STORY_MILESTONES.ch9Hearth);
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
  'ch4-vigil', 'ch4-arrival', 'ch4-audit', 'ch4-comply', 'ch4-defy', 'a4-exhale',
  'ch5-maw', 'ch6-dive',
  'ch7-reconstruct', 'ch7-board',
  'ch8-launch', 'ch8-crossing', 'ch8-landfall',
  'ch9-settle', 'ch9-hearth',
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
  ch4: 'ch4-vigil',
  audit: 'ch4-audit',
  breath: 'a4-exhale',
  maw: 'ch5-maw',
  dive: 'ch6-dive',
  repair: 'ch7-reconstruct',
  launch: 'ch8-launch',
  tidegarden: 'ch8-landfall',
  base: 'ch9-settle',
  hearth: 'ch9-hearth'
};

/** True ONLY for a `?story=<beat|alias>` dev jump — not `?story=1`, not the menu
 *  Story button. Debug-only world affordances (the campfire pre-place) gate here so
 *  they can never fire in a real run. */
export function isStoryDeepLink(): boolean {
  const p = parseStoryParam();
  return p !== null && p !== 'full';
}

/**
 * Physical prerequisite for isolated beat rehearsals. A normal story run
 * carries the player's own fire across these beats; a deep link reconstructs
 * it so audit/arrival interactions exercise the same world fact instead of
 * stalling on a milestone-only approximation.
 */
export function debugBeatNeedsCampfire(beat: StoryBeat | null): boolean {
  return beat === 'ch3-dusk'
    || beat === 'ch3-await-rest'
    || beat === 'a3-dawn'
    || beat === 'ch4-vigil'
    || beat === 'ch4-arrival'
    || beat === 'ch4-audit'
    || beat === 'ch4-comply';
}

/**
 * Before the fire is built (ch3-gather and everything upstream), the story world
 * must hold NO campfire. A phantom — a dev-jump's debug pre-place, autosaved into
 * the shared story-world save — would otherwise be restored and skip the player
 * past the craft (the director reads a standing fire as "built"). The rested
 * checkpoint (ch3-thirst+) resumes past ch3-dusk, so a real fire is kept.
 */
function clearStalePreFireCampfires(beat: StoryBeat): void {
  if (beatIndex(beat) >= beatIndex('ch3-dusk')) return;
  clearCampfiresForWorld(createWorldIdentity(STORY_COORDINATE));
}

export function chapterForBeat(beat: StoryBeat): StoryChapter {
  return beat === 'crawl' || beat === 'manifest' || beat === 'voyage' || beat === 'deflect' || beat === 'crash' ? 'prologue'
    : beat === 'descent' || beat.startsWith('ch1') || beat === 'a1-ramp' ? 'ch1'
    : beat.startsWith('ch2') || beat === 'a2-awakening' ? 'ch2'
    : beat.startsWith('ch4') || beat === 'a4-exhale' ? 'ch4'
    : beat.startsWith('ch5') ? 'ch5'
    : beat.startsWith('ch6') ? 'ch6'
    : beat.startsWith('ch7') ? 'ch7'
    : beat.startsWith('ch8') ? 'ch8'
    : beat.startsWith('ch9') ? 'ch9'
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
  if (at >= beatIndex('ch4-audit')) markMilestone(m.ch4Arrived);
  if (at >= beatIndex('ch4-comply')) {
    markMilestone(m.ch4Audit);
    markMilestone('story:audit:fire-mismatch');
    markMilestone('story:audit:life-mismatch');
    markMilestone('story:audit:tree-mismatch');
  }
  if (at >= beatIndex('ch4-defy')) {
    markMilestone(m.ch4Complied);
    markMilestone('story:comply:fire-doused');
    markMilestone('story:comply:organics-resolved');
    markMilestone('story:comply:regression-settled');
  }
  if (at >= beatIndex('a4-exhale')) {
    markMilestone(m.ch4Defied);
    markMilestone('story:defy:refusal-committed');
  }
  if (at >= beatIndex('ch5-maw')) {
    markMilestone(m.a4);
    markMilestone(m.a4Handback);
    markMilestone('story:a4:field-pack-dropped');
    if (getItemCount('faulty_maw') === 0 && getItemCount('iron_maw') === 0) addItem('faulty_maw', 1);
  }
  if (at >= beatIndex('ch6-dive')) {
    markMilestone(m.ch5Maw);
    markMilestone('maw_repaired');
    // Isolated dive rehearsals reconstruct the already-lived player direction
    // and its visible pond response; the dive itself still has to author water,
    // oxygen, sonar, acquisition, surfacing and dry banking from scratch.
    markMilestone('story:maw:first-direction-resolved');
    markMilestone('story:maw:pond-resonance-visible');
    markMilestone(m.senseMaw);
    const faultyMawCount = getItemCount('faulty_maw');
    if (faultyMawCount > 0) removeItem('faulty_maw', faultyMawCount);
    const repairKitCount = getItemCount('maw_repair_kit');
    if (repairKitCount > 0) removeItem('maw_repair_kit', repairKitCount);
    if (getItemCount('iron_maw') === 0) addItem('iron_maw', 1);
    advanceEraTo('emergent');
  }
  if (at >= beatIndex('ch7-reconstruct')) {
    markMilestone(m.ch6Dive);
    markMilestone(EMERGENT_CAPABILITY_MILESTONES.oxygenOnline);
    markMilestone(m.senseOxygen);
    markMilestone(AUTHORED_DIVE_MILESTONES.waterlineEntered);
    markMilestone(AUTHORED_DIVE_MILESTONES.keelSonarRevealed);
    markMilestone(AUTHORED_DIVE_MILESTONES.surfacedWithKeel);
    markMilestone('story:item:kestrel-keel-memory:acquired');
    markMilestone('story:item:kestrel-keel-memory:banked');
    if (getItemCount('kestrel_keel_memory') === 0) addItem('kestrel_keel_memory', 1);
  }
  if (at >= beatIndex('ch7-board')) {
    markMilestone(m.ch7Reconstructed);
    applyShipRestorationSnapshot({ repairStage: 'flight_ready' });
  }
  if (at >= beatIndex('ch8-launch')) {
    // Chapter 8 begins after the staged hatch transaction has completed. A
    // direct rehearsal must reconstruct that entire predecessor boundary, not
    // only its summary checkpoint, or the repaired hull correctly refuses to
    // expose either an exterior hatch or cockpit ownership.
    markMilestone(PHYSICAL_BOARDING_SEALED_MILESTONE);
    markMilestone(PHYSICAL_BOARDING_MILESTONE);
    markMilestone(m.ch7Boarded);
  }
  if (at >= beatIndex('ch8-crossing')) markMilestone(m.ch8Launched);
  if (at >= beatIndex('ch8-landfall')) markMilestone(m.ch8Crossed);
  if (at >= beatIndex('ch9-settle')) markMilestone(m.ch8Landfall);
  if (at >= beatIndex('ch9-hearth')) markMilestone(m.ch9Settled);
  if (at >= beatIndex('done')) {
    markMilestone(m.ch9Hearth);
    markMilestone(m.ch4Arrived);
    markMilestone(m.complete);
  }
}

/**
 * Explicit debug/movie jumps are reproducible rehearsals, not checkpoint
 * resumes. Clear only Story-owned progression plus the pinned Story world's
 * authored state; unrelated sandbox worlds and milestones remain untouched.
 */
function resetDebugStoryRun(storyWorld: ReturnType<typeof createWorldIdentity>): void {
  removeMilestonesByPrefix('story:');
  removeMilestone('maw_repaired');
  replaceEraForRollback('primitive');
  resetInventory();
  resetMaw();
  resetVitals();
  resetWaterskin();
  resetJetpackFuel();
  resetShipRestoration();
  resetTravel();
  resetEmergentStoryEvents();
  resetEmergentMawRepairRitual();
  resetAuthoredDiveRuntime();
  for (const world of [storyWorld, tidegardenIdentity()]) {
    clearWorldStateForWorld(world);
    clearCampfiresForWorld(world);
    clearVoxelEditsForWorld(world);
    clearPlayerPoseForWorld(world);
  }
  clearStoryText();
  resetStoryClock();
  setStoryForcedDayPhase(null);
}

function movieRunRequested(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get('movie') === '1';
  } catch {
    return false;
  }
}

/**
 * Migrate durable predecessor evidence implied by a persisted Story checkpoint.
 * Surface persistence cannot distinguish cockpit from exterior occupancy, so
 * this intentionally does not transfer controls on Continue.
 */
function reconcileCompletedBoardingReceipts(entry: StoryEntryPoint): void {
  if (entry.chapter !== 'ch8' || entry.beat !== 'ch8-launch') return;
  if (!hasMilestone(STORY_MILESTONES.ch7Boarded)) return;
  // ch7Boarded is only authored after both physical receipts exist. Repair
  // early saves without guessing whether their persisted surface occupancy was
  // inside or outside the cockpit.
  markMilestone(PHYSICAL_BOARDING_SEALED_MILESTONE);
  markMilestone(PHYSICAL_BOARDING_MILESTONE);
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
  // Dev flows (`?story=` jumps, movie runs) start from PRISTINE terrain AND a
  // pristine spawn — debug sessions used to accumulate each other's
  // strip-mining, and a pose saved in a mined pit would resurrect INSIDE the
  // restored terrain. The menu path (beginStory, no param) keeps both.
  const storyWorld = createWorldIdentity(STORY_COORDINATE);
  for (const world of [storyWorld, tidegardenIdentity()]) {
    clearVoxelEditsForWorld(world);
    clearPlayerPoseForWorld(world);
  }
  if (param === 'full') {
    // A screening is a full deterministic rehearsal. Normal `?story=1` keeps
    // its Continue semantics; movie mode must never inherit completed pickups.
    if (movieRunRequested()) restartStory();
    else beginStory();
    return;
  }
  // Dev BEAT jumps start pristine, then reconstruct only the prerequisites for
  // their chosen beat. This prevents a replayed crash from inheriting completed
  // debris/pods and silently skipping the two profile collection acts.
  const runId = snapshot.runId + 1;
  resetDebugStoryRun(storyWorld);
  seedForBeat(param);
  const chapter = chapterForBeat(param);
  if (chapter === 'complete') {
    // The finished two-world arc returns to free play at the earned living stage.
    setVoxelRealityStage('alive');
    setSnapshot({ active: false, chapter: 'complete', beat: 'done', runId });
    return;
  }
  // Reconstruct the physical location before publishing the story beat. Store
  // subscribers (objective, score, camera) must never observe a crossing or
  // landfall paired with the previous surface-flight snapshot for one frame.
  if (param === 'ch8-launch') bootstrapOriginLaunchDebug();
  else if (param === 'ch8-crossing') debugStartInSpace();
  else if (param === 'ch8-landfall') {
    bootstrapTidegardenLandfallDebug();
    debugStartInDescent();
  } else if (param === 'ch9-settle' || param === 'ch9-hearth') {
    bootstrapTidegardenSurfaceDebug();
  }
  setVoxelRealityStage(stageForStoryPoint({ chapter, beat: param }));
  setSnapshot({ active: true, chapter, beat: param, runId });
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
  clearStalePreFireCampfires(entry.beat);
  // Crossing is a checkpoint before landing, not permission to materialize on
  // foot. Rehydrate the real atmospheric pose (or a safe approach fallback)
  // before publishing the landfall beat so its director can only observe future
  // physical touchdown and egress actions.
  reconcileCompletedBoardingReceipts(entry);
  if (entry.beat === 'ch8-landfall') resumeTidegardenLandfallFromSave();
  setVoxelRealityStage(stageForStoryPoint(entry));
  setSnapshot({ active: true, chapter: entry.chapter, beat: entry.beat });
}

/** Explicit, destructive replay requested by the player. Preserves non-Story
 * progression and every non-Story world, but resets the carried loadout and the
 * pinned Story site so the opening cannot inherit completed-run advantages. */
export function restartStory(): void {
  const storyWorld = createWorldIdentity(STORY_COORDINATE);
  removeMilestonesByPrefix('story:');
  removeMilestone('maw_repaired');
  replaceEraForRollback('primitive');
  resetInventory();
  resetMaw();
  resetVitals();
  resetWaterskin();
  resetJetpackFuel();
  resetShipRestoration();
  resetTravel();
  resetEmergentStoryEvents();
  resetEmergentMawRepairRitual();
  resetAuthoredDiveRuntime();
  // This arc owns two authored planets. Replay must reset both or the old p1
  // Habitat receipt survives while every `story:` actor receipt is removed,
  // leaving the new run unable to install, certify, or rest at its second hearth.
  for (const world of [storyWorld, tidegardenIdentity()]) {
    clearWorldStateForWorld(world);
    clearVoxelEditsForWorld(world);
    clearPlayerPoseForWorld(world);
  }
  clearStoryText();
  resetStoryClock();
  setStoryForcedDayPhase(null);
  setVoxelRealityStage('bare');
  setSnapshot({ active: false, chapter: 'none', beat: null, runId: snapshot.runId + 1 });
  beginStory();
}

/** Director-only: move to the next beat (and chapter, when the beat crosses). */
export function advanceToBeat(beat: StoryBeat): void {
  setSnapshot({ chapter: chapterForBeat(beat), beat });
}

/** The two-world arc's end: hand the world back without erasing either world. */
export function completeStory(): void {
  markMilestone(STORY_MILESTONES.a3);
  markMilestone(STORY_MILESTONES.ch4Arrived);
  markMilestone(STORY_MILESTONES.ch9Hearth);
  markMilestone(STORY_MILESTONES.complete);
  // The earned senses are part of the earned world — never strand the HUD gates.
  // (Oxygen/jet/maw stay UNDISCOVERED: they arrive live, or in chapter 4's coda.)
  markMilestone(STORY_MILESTONES.senseInventory);
  markMilestone(STORY_MILESTONES.senseHealth);
  markMilestone(STORY_MILESTONES.senseTemp);
  markMilestone(STORY_MILESTONES.senseWater);
  markMilestone(STORY_MILESTONES.senseFood);
  markMilestone(STORY_MILESTONES.senseStamina);
  setVoxelRealityStage('alive');
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

const WORKER_NAME_PREFIX = 'story:name:';

/**
 * Persist the name the player gave the fellow worker in the voyage naming
 * interstitial. Rides the milestone store (no new save field) — the name is
 * stored (and always read) lowercase.
 */
export function recordWorkerName(name: string): void {
  const clean = name.trim().toLowerCase();
  if (clean) markMilestone(`${WORKER_NAME_PREFIX}${clean}`);
}

/**
 * The name the player gave the fellow worker (lowercase), or null if unnamed.
 * Scans milestones for `story:name:<name>` — downstream copy (VOYAGE_STRANGE_LINES
 * `{name}`, and any later chapter that refers to the worker) reads it here.
 */
export function getWorkerName(): string | null {
  const found = getMilestones().find(id => id.startsWith(WORKER_NAME_PREFIX));
  return found ? found.slice(WORKER_NAME_PREFIX.length) : null;
}

// --- derived reads ------------------------------------------------------------

/** The Regulation Feed owns the screen (sandbox HUD hidden) until A2 completes. */
export function storyHudTakeover(s: StorySnapshot = snapshot): boolean {
  if (!s.active || !s.beat) return false;
  return s.chapter === 'ch1' || s.chapter === 'ch2';
}

/**
 * The persistent objective card belongs to the player's embodied view. The
 * ch1 lift remains regulation-camera owned for its entire authored blend; its
 * hand-off completes at `ch1-anomaly`, and every later active beat keeps the
 * same objective/marker presentation even when the regulation feed still owns
 * other chapter chrome.
 */
export function storyUsesEmbodiedGuidanceHud(s: StorySnapshot = snapshot): boolean {
  if (!s.active || !s.beat) return false;
  const beat = beatIndex(s.beat);
  return beat >= beatIndex('ch1-anomaly');
}

/**
 * The early monochrome-ladder beats that (a) are camera-owned takeover eras with
 * no embodied guidance HUD yet, but (b) still accept player locomotion. These
 * are exactly the interactive external-camera beats — the fixed-screen harvest,
 * the raster quota, the work-line pods, top-down nav, and the isometric climb.
 * The frozen "plays" cutscenes around them (descent, the tracking unbolt, the
 * 2D→3D lift) hold the feet at moveSpeedScale 0 and are deliberately excluded,
 * as are the prologue overlays (which own their own input) and every later beat
 * (ch1-anomaly onward already mounts the embodied touch controls).
 *
 * On touch, these beats otherwise leave the player with no movement affordance,
 * so a themed virtual D-PAD mounts here in place of the analog joystick.
 */
const EARLY_TOUCH_DPAD_BEATS = new Set<StoryBeat>([
  'ch1-fixed',
  'ch1-raster',
  'ch1-depth',
  'ch1-nav',
  'ch1-iso'
]);

export function storyUsesEarlyTouchDpad(s: StorySnapshot = snapshot): boolean {
  if (!s.active || !s.beat) return false;
  return EARLY_TOUCH_DPAD_BEATS.has(s.beat);
}

/** Ship/star-map affordances stay hidden while any story chapter is live. */
export function storyHudMask(s: StorySnapshot = snapshot): boolean {
  return s.active;
}

/**
 * The monochrome ladder ANCHORS to the deterministic arrival site (the strip,
 * the wreck, the pods, the mesa are all placed off it). While those chapters
 * run, the spawn is the arrival — a saved pose (off-row, in the pond, mid-map)
 * must never override it. Free chapters (ch2+) resume where the player stood.
 */
export function storyAnchoredSpawn(s: StorySnapshot = snapshot): boolean {
  if (!s.active) return false;
  return s.chapter === 'prologue' || s.chapter === 'ch1';
}

// Survival chrome is INTRODUCED, not assumed: each sense appears when the story
// names it (ch3's "so that is thirst. how strange, to need."), then stays. Pure
// sandbox saves (story never started) see everything — the gates only exist
// inside a story save.

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
