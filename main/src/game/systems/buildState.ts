// --- Build mode state --------------------------------------------------------
//
// Whether the player is in build mode and which piece is selected. Module-singleton
// + subscribe (HUD reads it; EfficientPlayer reads it each frame for placement).
// Build mode keeps pointer lock (you aim) — unlike the crafting menu.

import { BUILD_PIECE_ORDER, type BuildPieceType } from '../data/buildPieces.ts';
import { ALL_BUILD_MATERIALS, type BuildMaterialId } from '../data/buildMaterials.ts';

let enabled = false;
let selected: BuildPieceType = 'foundation';
let selectedMaterial: BuildMaterialId = 'wood';
let rotation = 0; // 0..3 yaw nudge added on top of the auto facing (volume pieces)
const listeners = new Set<() => void>();

function emit() { listeners.forEach(l => l()); }

export function isBuildEnabled(): boolean { return enabled; }
export function getSelectedPiece(): BuildPieceType { return selected; }
export function getSelectedMaterial(): BuildMaterialId { return selectedMaterial; }
export function getBuildRotation(): number { return rotation; }

/** Cycle the manual rotation nudge (R while building). Added to the auto facing. */
export function cycleBuildRotation(): void {
  rotation = (rotation + 1) % 4;
  emit();
}

export function cycleSelectedMaterial(): void {
  const i = ALL_BUILD_MATERIALS.indexOf(selectedMaterial);
  selectedMaterial = ALL_BUILD_MATERIALS[(i + 1) % ALL_BUILD_MATERIALS.length];
  emit();
}

export function setBuildEnabled(on: boolean): void {
  if (enabled !== on) { enabled = on; emit(); }
}

export function toggleBuildMode(): void {
  enabled = !enabled;
  emit();
}

export function setSelectedPiece(type: BuildPieceType): void {
  if (selected !== type) { selected = type; emit(); }
}

/** Select by palette index (e.g. number keys 1..N). Ignores out-of-range. */
export function selectPieceByIndex(i: number): void {
  if (i >= 0 && i < BUILD_PIECE_ORDER.length) setSelectedPiece(BUILD_PIECE_ORDER[i]);
}

export function subscribeBuildState(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
