import * as THREE from 'three';
import type { StoryBeat } from '../storyState.ts';
import { sideHarvestProbePointsOffRow, type SideLens } from '../sideLens.ts';
import { VOXEL_SCALE } from '../../utils/cubeGravityConstants.ts';

// --- The survey brackets ------------------------------------------------------------
//
// Chapter 1 runs the fidelity ladder at its lowest rung: `bare` reality is
// chroma 0, detail 0, organic 0 — every block in the world is the same
// untextured grey slab. Colour and material ARE the game's "this is a thing you
// can take" channel everywhere else, and this chapter deliberately switches
// them off. Nothing replaced them: the beat orders `HARVEST BIOFIBER` while
// biofiber drops only from grass, dirt drops nothing at all, and the two are
// pixel-identical. The informational HUD that would name the block
// (LookedAtIndicator, ResourceGainToast, InventoryPanel) is unmounted for all
// of ch1 by `storyHudTakeover`. So the player was told to find a thing the game
// had made unfindable, which is exactly what players reported.
//
// The bracket restores discovery WITHOUT restoring colour. It is the site's own
// surveillance survey tagging its own quota targets — the same two-border
// corner idiom the feed chrome already draws, at the same dim ink — so it reads
// as the Authority's overlay rather than a game marker, and it retires on its
// own when the ladder gives material cues back.
//
// This module is pure: candidate selection and geometry only. Projection is the
// driver's job (it owns the camera), rendering the overlay's.

/** What the survey is tagging this beat. `null` = the overlay does not mount. */
export type SurveyBracketMode = 'harvest' | 'salvage';

export interface SurveyBracketTarget {
  /** Stable across frames so the overlay can reuse DOM nodes. */
  key: string;
  position: THREE.Vector3;
  label: string;
  /** Standing pose admitted by the ordinary picker, never the voxel centre. */
  approach?: THREE.Vector3;
  facing?: 1 | -1;
}

/** Exactly one phase-matched actionable designation. */
export const SURVEY_BRACKET_LIMIT = 1;
let designatedTargetKey: string | null = null;
export function getDesignatedSurveyTargetKey(): string | null { return designatedTargetKey; }
export function setDesignatedSurveyTargetKey(key: string | null): void { designatedTargetKey = key; }

export interface SurveyTargetPresentation {
  objective: object; objectiveId: string; runVersion: number; restoreVersion: number;
  geometry: string; frame: number; viewportWidth: number; viewportHeight: number; targetKey: string | null;
  targetLabel: string | null; nativeActionable: boolean;
  horizontalOffscreen: boolean; direction: 'A' | 'D' | null;
  fit: 'pending' | 'visible' | 'unresolved' | 'offscreen';
  rect?: { left: number; right: number; top: number; bottom: number };
  approach?: readonly [number, number, number]; facing?: 1 | -1;
  movementRight?: readonly [number, number, number];
}
let targetPresentation: SurveyTargetPresentation | null = null;
let finalizedPresentation: SurveyTargetPresentation | null = null;
/** Finalized reads refer to the overlay's completed layout, never a driver's pending projection. */
export function getSurveyTargetPresentation(finalized = false): Readonly<SurveyTargetPresentation> | null { return finalized ? finalizedPresentation : targetPresentation; }
export function setSurveyTargetPresentation(next: SurveyTargetPresentation | null, finalized = false): void {
  targetPresentation = next;
  if (next === null || finalized) finalizedPresentation = next;
}

/** Only an actual horizontal projection and admitted approach can issue a bearing. */
export function resolveSurveyTargetPresentation(input: {
  ndc: THREE.Vector3; player: THREE.Vector3; approach: THREE.Vector3 | undefined;
  movementRight: THREE.Vector3; validApproach: boolean; nativeActionable: boolean;
}): { horizontalOffscreen: boolean; direction: 'A' | 'D' | null } {
  const { ndc, player, approach, movementRight } = input;
  const horizontalOffscreen = [ndc.x, ndc.y, ndc.z].every(Number.isFinite)
    && ndc.z >= -1 && ndc.z <= 1 && Math.abs(ndc.y) <= 1 && Math.abs(ndc.x) > 1;
  if (!horizontalOffscreen || input.nativeActionable || !input.validApproach || !approach) return { horizontalOffscreen, direction: null };
  const signedDistance = (approach.x - player.x) * movementRight.x
    + (approach.y - player.y) * movementRight.y + (approach.z - player.z) * movementRight.z;
  return { horizontalOffscreen, direction: Number.isFinite(signedDistance) && Math.abs(signedDistance) > 0.01 ? signedDistance > 0 ? 'D' : 'A' : null };
}


/** Half-width of the row scan, in voxels either side of the player. */
const SCAN_VOXELS = 7;

/**
 * The beats whose work order names a target the 1-bit render cannot
 * distinguish. `ch1-depth` onward already carry a real directional marker, and
 * every later chapter has colour back, so neither needs this.
 *
 * This decides MOUNTING only. What actually gets designated is
 * `surveyBracketDemand`, because both beats can want either kind.
 */
export function surveyBracketMode(beat: StoryBeat | null): SurveyBracketMode | null {
  if (beat === 'ch1-fixed') return 'harvest';
  if (beat === 'ch1-raster') return 'salvage';
  return null;
}

/** What the survey should be designating right now, by outstanding condition. */
export interface SurveyBracketDemand {
  harvest: boolean;
  salvage: boolean;
}

export interface SurveyBracketOutstanding {
  /** The biofiber quota for this beat is not yet met. */
  fiber: boolean;
  /** Scattered hull debris remains uncollected (ch1-raster's third gate). */
  debris: boolean;
}

/**
 * Keying the designation to the BEAT rather than to the outstanding condition
 * was a real, reproduced stall: at `ch1-raster` the layer only ever drew debris
 * brackets, so once the debris was clear every bracket went dark while the
 * fiber quota — the actual remaining gate — stayed invisible in a world with no
 * material cues. A capture of that beat showed four DEBRIS labels and zero
 * BIOFIBER labels while the ledger read `FIBER 0/6`.
 */
export function surveyBracketDemand(
  beat: StoryBeat | null,
  outstanding: SurveyBracketOutstanding
): SurveyBracketDemand {
  const mode = surveyBracketMode(beat);
  if (!mode) return { harvest: false, salvage: false };
  return { harvest: !outstanding.debris && outstanding.fiber, salvage: outstanding.debris };
}

/**
 * Slot budget when both kinds are outstanding. Debris is the sparser, more
 * findable target and is capped so it can never crowd the fiber brackets off
 * the screen the way it did before — the fiber is what the player cannot see.
 */
export const SURVEY_BRACKET_SALVAGE_SHARE = 1;

/** A block the extractor will actually pay out for, by drop table. */
export type VoxelYieldProbe = (
  x: number,
  y: number,
  z: number
) => { yields: boolean } | null;

const _scan = new THREE.Vector3();

/**
 * Grass/wood voxels along the work row that the extractor would actually pay
 * for, nearest first.
 *
 * The scan uses the same ROWS extraction reaches (ground level, ±1 voxel off
 * the walked plane — the off-row probe set) but a wider travel span than a
 * standing extract can touch: the probe reaches travel offsets 0 and 1.6, while
 * this sweeps ±SCAN_VOXELS. That is deliberate and is not a false promise. The
 * nearest pair is always within reach from a standstill, and the further
 * brackets answer the other half of what a stuck player needs — WHICH WAY there
 * is more, since a cell yields once and the quota cannot be met without
 * walking. Read them as "nearest is actionable, the rest are where to go".
 */
export function collectHarvestBracketTargets(
  playerPosition: THREE.Vector3,
  lens: SideLens,
  probe: VoxelYieldProbe,
  limit = SURVEY_BRACKET_LIMIT,
  canApproach: (position: THREE.Vector3) => boolean = () => true
): SurveyBracketTarget[] {
  const found: SurveyBracketTarget[] = [];
  const seen = new Set<string>();
  const approaches = [0, ...Array.from({ length: SCAN_VOXELS }, (_, i) => [i + 1, -(i + 1)]).flat()];
  for (const step of approaches) {
    _scan.copy(playerPosition).addScaledVector(lens.travelAxis, step * VOXEL_SCALE);
    const along = _scan.clone().sub(lens.origin).dot(lens.travelAxis);
    if (Math.abs(along) > 29 || !canApproach(_scan)) continue;
    for (const facing of [1, -1] as const) {
      const selected = pickSideHarvestVoxel(_scan, lens, facing, probe, true);
      if (!selected) continue;
      const key = `v:${selected.x},${selected.y},${selected.z}`;
      if (seen.has(key)) continue;
      seen.add(key);
      found.push({ key, position: new THREE.Vector3(selected.x, selected.y, selected.z).multiplyScalar(VOXEL_SCALE), label: 'BIOFIBER', approach: _scan.clone(), facing });
      if (found.length >= limit) return found;
    }
  }
  return found;
}

/** Remaining required indices 0..2, nearest first; optional pieces stay collectible and unmarked. */
export function collectSalvageBracketTargets(
  playerPosition: THREE.Vector3,
  positions: readonly THREE.Vector3[],
  collected: (index: number) => boolean,
  limit = SURVEY_BRACKET_LIMIT
): SurveyBracketTarget[] {
  const found: { target: SurveyBracketTarget; distance: number }[] = [];
  positions.forEach((position, index) => {
    if (index > 2 || collected(index)) return;
    found.push({
      target: { key: `d:${index}`, position, label: 'DEBRIS' },
      distance: playerPosition.distanceTo(position)
    });
  });
  found.sort((a, b) => a.distance - b.distance);
  return found.slice(0, limit).map(entry => entry.target);
}

/**
 * Screen-space bracket box at its actual projected anchor. Full label placement
 * is measured by the DOM overlay without moving this anchor. `size` is the full box edge in px.
 *
 * The box does not scale with range: a designator that shrinks with distance
 * stops reading as a designator and starts reading as an object, and at 1-bit
 * with no depth cues the player cannot use the size as distance information
 * anyway.
 */
export interface SurveyBracketRect {
  x: number;
  y: number;
  size: number;
  /** True when the label should render to the left of the box instead. */
  labelFlipped: boolean;
}

export function solveSurveyBracketRect(
  anchorX: number,
  anchorY: number,
  size: number,
  viewportWidth: number,
  viewportHeight: number,
  labelWidth = 74
): SurveyBracketRect {
  const half = size / 2;
  const x = Number.isFinite(anchorX) ? anchorX : 0;
  const y = Number.isFinite(anchorY) ? anchorY : 0;
  void viewportHeight;
  return {
    x,
    y,
    size,
    labelFlipped: x + half + labelWidth > viewportWidth
  };
}

/** Shared ordinary-picker priority; read-only probes retain tool admission and fallback semantics. */
const _harvestPoints = Array.from({ length: 6 }, () => new THREE.Vector3());
export function pickSideHarvestVoxel(
  position: THREE.Vector3, lens: SideLens, facing: 1 | -1, probe: VoxelYieldProbe, yieldingOnly = false
): { x: number; y: number; z: number } | null {
  const points = sideHarvestProbePointsOffRow(position, lens, facing, _harvestPoints);
  let fallback: { x: number; y: number; z: number } | null = null;
  for (const point of points) {
    const coord = { x: Math.round(point.x / VOXEL_SCALE), y: Math.round(point.y / VOXEL_SCALE), z: Math.round(point.z / VOXEL_SCALE) };
    const voxel = probe(coord.x, coord.y, coord.z);
    if (!voxel) continue;
    if (voxel.yields) return coord;
    if (!yieldingOnly && !fallback) fallback = coord;
  }
  return fallback;
}
