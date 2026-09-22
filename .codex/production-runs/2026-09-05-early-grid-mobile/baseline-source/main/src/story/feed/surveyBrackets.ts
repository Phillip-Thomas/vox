import * as THREE from 'three';
import type { StoryBeat } from '../storyState.ts';
import type { SideLens } from '../sideLens.ts';
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
}

/**
 * Four is the ceiling on purpose. The bracket answers "which shape pays?", and
 * one answer plus the next place to walk is the whole lesson; a screen of
 * brackets would be the clutter the ladder is trying to avoid, and would read
 * as decoration rather than designation.
 */
export const SURVEY_BRACKET_LIMIT = 4;

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
  return {
    harvest: outstanding.fiber,
    // Only the salvage beat has debris to designate.
    salvage: mode === 'salvage' && outstanding.debris
  };
}

/**
 * Slot budget when both kinds are outstanding. Debris is the sparser, more
 * findable target and is capped so it can never crowd the fiber brackets off
 * the screen the way it did before — the fiber is what the player cannot see.
 */
export const SURVEY_BRACKET_SALVAGE_SHARE = 2;

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
  limit = SURVEY_BRACKET_LIMIT
): SurveyBracketTarget[] {
  const found: { target: SurveyBracketTarget; distance: number }[] = [];
  const rows = [VOXEL_SCALE, -VOXEL_SCALE];
  for (let step = -SCAN_VOXELS; step <= SCAN_VOXELS; step++) {
    for (const row of rows) {
      _scan.copy(playerPosition)
        .addScaledVector(lens.travelAxis, step * VOXEL_SCALE)
        .addScaledVector(lens.up, -1.8)
        .addScaledVector(lens.depthAxis, row);
      const vx = Math.round(_scan.x / VOXEL_SCALE);
      const vy = Math.round(_scan.y / VOXEL_SCALE);
      const vz = Math.round(_scan.z / VOXEL_SCALE);
      const voxel = probe(vx, vy, vz);
      if (!voxel?.yields) continue;
      found.push({
        target: {
          key: `v:${vx},${vy},${vz}`,
          position: new THREE.Vector3(vx * VOXEL_SCALE, vy * VOXEL_SCALE, vz * VOXEL_SCALE),
          label: 'BIOFIBER'
        },
        distance: Math.abs(step)
      });
    }
  }
  found.sort((a, b) => a.distance - b.distance);
  return found.slice(0, limit).map(entry => entry.target);
}

/**
 * Uncollected hull debris, nearest first.
 *
 * `ch1-raster` will not advance until every scattered piece is recovered
 * (`debrisSalvageComplete()`), and the pieces are unmarked grey boxes spread
 * across a ±28 m strip. The signed journey contract already asserts that
 * "missed targets remain explicitly marked" for this rung; this is the
 * implementation of that clause.
 */
export function collectSalvageBracketTargets(
  playerPosition: THREE.Vector3,
  positions: readonly THREE.Vector3[],
  collected: (index: number) => boolean,
  limit = SURVEY_BRACKET_LIMIT
): SurveyBracketTarget[] {
  const found: { target: SurveyBracketTarget; distance: number }[] = [];
  positions.forEach((position, index) => {
    if (collected(index)) return;
    found.push({
      target: { key: `d:${index}`, position, label: 'DEBRIS' },
      distance: playerPosition.distanceTo(position)
    });
  });
  found.sort((a, b) => a.distance - b.distance);
  return found.slice(0, limit).map(entry => entry.target);
}

/**
 * Screen-space bracket box for a projected anchor, clamped so the label never
 * escapes the viewport. `size` is the full box edge in px.
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
  const x = clamp(anchorX, half, Math.max(half, viewportWidth - half));
  const y = clamp(anchorY, half, Math.max(half, viewportHeight - half));
  return {
    x,
    y,
    size,
    labelFlipped: x + half + labelWidth > viewportWidth
  };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
