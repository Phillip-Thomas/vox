import type { InteractionId } from '../../game/systems/interactionSystem.ts';
import { getShipRepairStage } from '../../game/systems/shipRestoration.ts';
import { atLeast } from '../emergentCapabilities.ts';

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
  /**
   * Undefined = mining allowed (default everywhere). False only on beats with
   * no extract verb (ch1-depth pod recovery: pods are walk-over; digging the
   * row self-buries the player). Gates updateMining input, not build placement.
   */
  allowMine?: boolean;
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
  /**
   * Retires the feed-era 90° yaw snap for playable first-person look: yaw drags
   * smoothly (continuous) while the pinned CCTV pitch band (driven by feedBlend)
   * stays. Owner decision 2026-07-21; the snap machinery is retained for the
   * liberation blend and any feed cutscene that leaves this unset. Undefined =
   * snap era (feedBlend drives both yaw and pitch as before).
   */
  smoothYaw?: boolean;
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

export const allowAll = () => true;
export const allowNone = () => false;

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
export const CH3_RECIPES = new Set(['biofuel', 'stone_hatchet', 'stone_pickaxe', 'torch', 'campfire']);

/** The first day alive: the campfire chain plus the waterskin (carry the answer). */
export const CH3_TAIL_RECIPES = new Set([...CH3_RECIPES, 'waterskin']);

export function ch7RecipeAllowed(id: string): boolean {
  if (CH3_TAIL_RECIPES.has(id)) return true;
  const stage = getShipRepairStage();
  if (id === 'lift_cell') return atLeast(stage, 'hull_sealed');
  if (id === 'logic_wafer') return atLeast(stage, 'lift_online');
  return false;
}

export function ch9RecipeAllowed(id: string): boolean {
  return ch7RecipeAllowed(id)
    || (id === 'habitat_core' && atLeast(getShipRepairStage(), 'flight_ready'));
}

/** External-camera render crunch (retained for camera-owned feed variants). */
export const FEED_DPR = 0.85;
/** Raster (side-scroller) era: honest chunky pixels. */
export const RASTER_DPR = 0.4;
/** Isometric era: one fidelity ratchet up from raster, still visibly quantized. */
export const ISO_DPR = 0.55;

export function feedPolicy(): StoryInputPolicy {
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
export function embodiedSurveyPolicy(): StoryInputPolicy {
  // The player's own embodied first-person view: yaw drags smoothly (the feed-
  // era 90° snap is retired here by owner decision 2026-07-21) while the pinned
  // CCTV pitch band still holds from feedBlend 0.
  return { ...feedPolicy(), targetDpr: null, smoothYaw: true };
}

/** The 2D side-scroller era: A/D travel, jump on, plane-locked, chunky pixels. */
export function rasterPolicy(): StoryInputPolicy {
  return {
    ...feedPolicy(),
    moveSpeedScale: 0.55,
    allowJump: true,
    lookMode: 'side',
    sideBlend: 0,
    targetDpr: RASTER_DPR
  };
}

export function ch3Policy(): StoryInputPolicy {
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