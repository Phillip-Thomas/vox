// Build-ghost readout: where + WHAT the selected piece would snap, written each
// frame by EfficientPlayer's build loop and polled by the in-Canvas BuildGhost.

import type { BuildPieceType } from '../data/buildPieces.ts';

export type BuildBlockReason = 'no_target' | 'unsupported' | 'occupied' | 'materials' | null;

export interface BuildGhostState {
  active: boolean;
  cell: [number, number, number];
  face: number;
  type: BuildPieceType;
  valid: boolean; // can afford + valid target
  reason: BuildBlockReason;
  up: number;     // volume pieces: build-up axis + yaw step for the ghost orientation
  orient: number;
}

const state: BuildGhostState = {
  active: false,
  cell: [0, 0, 0],
  face: 0,
  type: 'foundation',
  valid: false,
  reason: 'no_target',
  up: 2,
  orient: 0
};
const listeners = new Set<() => void>();
let semanticSignature = 'false:false:no_target:foundation';

function emitIfSemanticStateChanged(): void {
  const next = `${state.active}:${state.valid}:${state.reason}:${state.type}`;
  if (next === semanticSignature) return;
  semanticSignature = next;
  listeners.forEach(listener => listener());
}

export function setBuildGhost(
  cell: [number, number, number],
  face: number,
  type: BuildPieceType,
  valid: boolean,
  up = 2,
  orient = 0,
  reason: BuildBlockReason = valid ? null : 'unsupported'
): void {
  state.active = true;
  state.cell = cell;
  state.face = face;
  state.type = type;
  state.valid = valid;
  state.reason = valid ? null : reason;
  state.up = up;
  state.orient = orient;
  emitIfSemanticStateChanged();
}

export function clearBuildGhost(reason: Extract<BuildBlockReason, 'no_target'> = 'no_target'): void {
  state.active = false;
  state.valid = false;
  state.reason = reason;
  emitIfSemanticStateChanged();
}

export function getBuildGhost(): BuildGhostState {
  return state;
}

export function subscribeBuildGhost(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
