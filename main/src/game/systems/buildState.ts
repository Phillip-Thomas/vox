// --- Build mode state --------------------------------------------------------
//
// Whether the player is in build mode and which piece is selected. Module-singleton
// + subscribe (HUD reads it; EfficientPlayer reads it each frame for placement).
// Build mode keeps pointer lock (you aim) — unlike the crafting menu.

import { BUILD_PIECE_ORDER, type BuildPieceType } from '../data/buildPieces.ts';

let enabled = false;
let selected: BuildPieceType = 'foundation';
const listeners = new Set<() => void>();

function emit() { listeners.forEach(l => l()); }

export function isBuildEnabled(): boolean { return enabled; }
export function getSelectedPiece(): BuildPieceType { return selected; }

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
