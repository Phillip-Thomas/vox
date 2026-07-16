import type { InteractionId } from '../game/systems/interactionSystem.ts';
import { getStoryStateSnapshot, subscribeStory, type StoryBeat } from './storyState.ts';
import { getShipRepairStage } from '../game/systems/shipRestoration.ts';
import { atLeast } from './emergentCapabilities.ts';

// --- Story input policy ---------------------------------------------------------
//
// The single gate the sandbox code paths consult. Read imperatively inside frame
// loops and keydown handlers (cheap module-ref read, no React). When story mode is
// inactive this returns the frozen SANDBOX_POLICY — every gate in sandbox code is
// a truthy check against constants, i.e. a no-op.
//
// Beat changes swap in a fresh policy object; the director additionally mutates
// the live object during scripted sequences (movement freezes, the A2 liberation
// lerp driving feedBlend/targetFov per frame).

export interface StoryInputPolicy {
  /** Multiplies DEFAULT_MOVE_SPEED. Feed chapters walk slow; cutscenes freeze (0). */
  moveSpeedScale: number;
  allowJump: boolean;
  allowSprint: boolean;
  allowBuild: boolean;
  allowCraft: boolean;
  /** Crafting whitelist during story chapters (sandbox: everything). */
  recipeAllowed: (id: string) => boolean;
  /** Filters the sandbox context interactions (door/board/drink) per chapter. */
  allowBaseInteraction: (id: InteractionId) => boolean;
  /**
   * 'feed' = compass-snapped yaw + CCTV tilt band; 'side' = fixed side-scroller
   * camera + plane-locked movement (CameraControls / EfficientPlayer branches).
   */
  lookMode: 'free' | 'feed' | 'side';
  /** 0 = fully feed-locked look, 1 = free look. A2 lerps this open. */
  feedBlend: number;
  /** Side lens only: 0 = side camera, 1 = first person. The ch1-lift lerps it. */
  sideBlend: number;
  /** Camera FOV target; the driver eases the live camera toward it. */
  targetFov: number;
  /** Render pixel-ratio override (chunky-raster eras); null = device default. */
  targetDpr: number | null;
  /** Early chapters: props render as voxels (cube stones, no smooth meshes). */
  voxelPropsOnly: boolean;
  /**
   * Harvester idle recharge (charge/sec, jetpack-style). The Maw arrives with
   * whatever the voyage left in the cell (getArrivalCellCharge — full minus
   * recalibrations/forgettings, commendations topped it up) and trickles back
   * through the feed eras; the survival act (ch3) is where this returns to the
   * sandbox 0 and the broken-until-repaired loop begins.
   */
  mawRechargePerSecond: number;
}

const allowAll = () => true;
const allowNone = () => false;

export const SANDBOX_FOV = 75;
export const FEED_FOV = 50;

export const SANDBOX_POLICY: Readonly<StoryInputPolicy> = Object.freeze({
  moveSpeedScale: 1,
  allowJump: true,
  allowSprint: true,
  allowBuild: true,
  allowCraft: true,
  recipeAllowed: allowAll,
  allowBaseInteraction: allowAll,
  lookMode: 'free' as const,
  feedBlend: 1,
  sideBlend: 1,
  targetFov: SANDBOX_FOV,
  targetDpr: null,
  voxelPropsOnly: false,
  mawRechargePerSecond: 0
});

/** Chapter-3 crafting whitelist: exactly the campfire chain (plus its lights). */
const CH3_RECIPES = new Set(['biofuel', 'stone_hatchet', 'stone_pickaxe', 'torch', 'campfire']);

/** The first day alive: the campfire chain plus the waterskin (carry the answer). */
const CH3_TAIL_RECIPES = new Set([...CH3_RECIPES, 'waterskin']);

function ch7RecipeAllowed(id: string): boolean {
  if (CH3_TAIL_RECIPES.has(id)) return true;
  const stage = getShipRepairStage();
  if (id === 'lift_cell') return atLeast(stage, 'hull_sealed');
  if (id === 'logic_wafer') return atLeast(stage, 'lift_online');
  return false;
}

function ch9RecipeAllowed(id: string): boolean {
  return ch7RecipeAllowed(id)
    || (id === 'habitat_core' && atLeast(getShipRepairStage(), 'flight_ready'));
}

/** External-camera render crunch (retained for camera-owned feed variants). */
export const FEED_DPR = 0.85;
/** Raster (side-scroller) era: honest chunky pixels. */
export const RASTER_DPR = 0.4;
/** Isometric era: one fidelity ratchet up from raster, still visibly quantized. */
export const ISO_DPR = 0.55;

function feedPolicy(): StoryInputPolicy {
  return {
    moveSpeedScale: 0.45,
    allowJump: false,
    allowSprint: false,
    allowBuild: false,
    allowCraft: false,
    recipeAllowed: allowNone,
    allowBaseInteraction: allowNone,
    lookMode: 'feed',
    feedBlend: 0,
    sideBlend: 1,
    targetFov: FEED_FOV,
    targetDpr: FEED_DPR,
    voxelPropsOnly: true,
    mawRechargePerSecond: 6
  };
}

/**
 * The first-person survey keeps the regulation movement/look constraints, but
 * it is the player's embodied view: no external-camera resolution treatment.
 */
function embodiedSurveyPolicy(): StoryInputPolicy {
  return { ...feedPolicy(), targetDpr: null };
}

/** The 2D side-scroller era: A/D travel, jump on, plane-locked, chunky pixels. */
function rasterPolicy(): StoryInputPolicy {
  return {
    ...feedPolicy(),
    moveSpeedScale: 0.55,
    allowJump: true,
    lookMode: 'side',
    sideBlend: 0,
    targetDpr: RASTER_DPR
  };
}

function ch3Policy(): StoryInputPolicy {
  return {
    moveSpeedScale: 1,
    allowJump: true,
    allowSprint: true,
    allowBuild: false,
    allowCraft: true,
    recipeAllowed: id => CH3_RECIPES.has(id),
    allowBaseInteraction: id => id !== 'board',
    lookMode: 'free',
    feedBlend: 1,
    sideBlend: 1,
    targetFov: SANDBOX_FOV,
    targetDpr: null,
    voxelPropsOnly: false,
    // Ch3 is where the damage bites: no trickle until the Maw is repaired.
    mawRechargePerSecond: 0
  };
}

function buildPolicyForBeat(beat: StoryBeat | null): StoryInputPolicy {
  switch (beat) {
    // Prologue runs over the menu — the on-foot controller isn't live, but keep
    // everything locked in case of races around the hard cut.
    case 'crawl':
    case 'manifest':
    case 'voyage':
    case 'deflect':
    case 'crash':
      return { ...rasterPolicy(), moveSpeedScale: 0 };
    // The crash-landing cutscene and the TRACKING unbolt: side lens held, feet held.
    case 'descent':
    case 'ch1-track':
      return { ...rasterPolicy(), moveSpeedScale: 0 };
    // The 2D→3D lift launches from the iso era's fidelity.
    case 'ch1-lift':
      return { ...rasterPolicy(), moveSpeedScale: 0, targetDpr: ISO_DPR };
    // The monochrome ladder: all external-lens eras share the raster policy —
    // camera rigs and depth freedom come from the lens rig, not the policy.
    case 'ch1-fixed':
    case 'ch1-raster':
    case 'ch1-depth':
      return rasterPolicy();
    // Nav/iso read as orthographic: long lens (rig dollies out), narrow fov.
    case 'ch1-nav':
      return { ...rasterPolicy(), targetFov: 36 };
    case 'ch1-iso':
      return { ...rasterPolicy(), targetDpr: ISO_DPR, targetFov: 38 };
    case 'ch1-anomaly':
      return embodiedSurveyPolicy();
    // Post-A1: the chroma suppressor AND the pan-tilt interlock fail together.
    // Regulation tickets/redaction remain on the embodied HUD, but the neck is
    // the player's: full free look, camera-relative (diagonal) movement. CCTV
    // pixels already ended with the lift.
    case 'ch2-color':
    case 'ch2-approach':
      return { ...embodiedSurveyPolicy(), lookMode: 'free', feedBlend: 1 };
    // Scripted sequences start frozen; their timelines unfreeze/lerp the live
    // object (setStoryMoveScale / setStoryTargetFov below).
    case 'a1-ramp':
      return { ...embodiedSurveyPolicy(), moveSpeedScale: 0 };
    case 'a2-awakening':
      return { ...embodiedSurveyPolicy(), lookMode: 'free', feedBlend: 1, moveSpeedScale: 0 };
    case 'ch3-gather':
    case 'ch3-dusk':
    case 'ch3-await-rest':
      return ch3Policy();
    case 'a3-dawn':
      return { ...ch3Policy(), moveSpeedScale: 0, allowCraft: false };
    // The first day alive: free play, waterskin joins the whitelist.
    case 'ch3-thirst':
    case 'ch3-forage':
    case 'ch3-signal':
    case 'ch4-vigil':
      return { ...ch3Policy(), recipeAllowed: id => CH3_TAIL_RECIPES.has(id) };
    // The auditor's arrival: a staged dawn — the timeline releases the feet.
    case 'ch4-arrival':
      return {
        ...ch3Policy(),
        recipeAllowed: id => CH3_TAIL_RECIPES.has(id),
        moveSpeedScale: 0,
        allowCraft: false
      };
    case 'ch4-audit':
    case 'ch4-comply':
    case 'ch4-defy':
      return {
        ...ch3Policy(),
        allowCraft: false,
        recipeAllowed: allowNone,
        allowBaseInteraction: id => id === 'drink' || id === 'door'
      };
    case 'a4-exhale':
      return {
        ...ch3Policy(),
        moveSpeedScale: 0,
        allowJump: false,
        allowSprint: false,
        allowCraft: false,
        recipeAllowed: allowNone,
        allowBaseInteraction: allowNone
      };
    case 'ch5-maw':
    case 'ch6-dive':
      return {
        ...SANDBOX_POLICY,
        allowBuild: false,
        recipeAllowed: id => CH3_TAIL_RECIPES.has(id),
        allowBaseInteraction: id => id !== 'board'
      };
    case 'ch7-reconstruct':
      return {
        ...SANDBOX_POLICY,
        allowBuild: false,
        recipeAllowed: ch7RecipeAllowed,
        allowBaseInteraction: id => id !== 'board'
      };
    case 'ch7-board':
    case 'ch8-launch':
    case 'ch8-crossing':
      return { ...SANDBOX_POLICY, allowBuild: false, allowCraft: false, recipeAllowed: allowNone };
    case 'ch8-landfall':
      return { ...SANDBOX_POLICY, allowBuild: false, allowCraft: false, recipeAllowed: allowNone };
    case 'ch9-settle':
    case 'ch9-hearth':
      return {
        ...SANDBOX_POLICY,
        recipeAllowed: ch9RecipeAllowed
      };
    default:
      return { ...SANDBOX_POLICY };
  }
}

let current: StoryInputPolicy = SANDBOX_POLICY as StoryInputPolicy;

function refresh(): void {
  const story = getStoryStateSnapshot();
  current = story.active ? buildPolicyForBeat(story.beat) : (SANDBOX_POLICY as StoryInputPolicy);
}

subscribeStory(refresh);
refresh();

export function getStoryInputPolicy(): StoryInputPolicy {
  return current;
}

/**
 * Recipe knowledge survives Story handback independently of input/camera mode.
 * A repaired Kestrel keeps only the patterns actually earned through its
 * monotonic repair stages; an untouched sandbox retains its normal catalog.
 */
export function isFabricatorRecipeAllowed(id: string): boolean {
  const story = getStoryStateSnapshot();
  if (story.active) return current.recipeAllowed(id);
  return getShipRepairStage() === 'wrecked' ? true : ch9RecipeAllowed(id);
}

// --- director live-mutation hooks (no-ops against the frozen sandbox object) ----

function mutable(): StoryInputPolicy | null {
  return current === SANDBOX_POLICY ? null : current;
}

/** Timeline movement control (0 freezes; beat changes reset to the beat default). */
export function setStoryMoveScale(scale: number): void {
  const p = mutable();
  if (p) p.moveSpeedScale = scale;
}

/** A2 liberation: 0 = feed-locked look, 1 = free. Consumed by CameraControls. */
export function setStoryFeedBlend(blend: number): void {
  const p = mutable();
  if (p) p.feedBlend = Math.min(1, Math.max(0, blend));
}

/** The ch1 lift: 0 = side camera, 1 = first person. Consumed by CameraControls. */
export function setStorySideBlend(blend: number): void {
  const p = mutable();
  if (p) p.sideBlend = Math.min(1, Math.max(0, blend));
}

export function setStoryTargetFov(fov: number): void {
  const p = mutable();
  if (p) p.targetFov = fov;
}

/** A2 liberation: lerp the render crunch away (null restores the device dpr). */
export function setStoryTargetDpr(dpr: number | null): void {
  const p = mutable();
  if (p) p.targetDpr = dpr;
}

/** A2's final handoff flips the look free without waiting for a beat rebuild. */
export function setStoryLookMode(mode: 'free' | 'feed'): void {
  const p = mutable();
  if (p) p.lookMode = mode;
}
