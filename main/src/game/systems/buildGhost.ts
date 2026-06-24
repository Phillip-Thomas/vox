// Build-ghost readout: where + WHAT the selected piece would snap, written each
// frame by EfficientPlayer's build loop and polled by the in-Canvas BuildGhost.

import type { BuildPieceType } from '../data/buildPieces.ts';

export interface BuildGhostState {
  active: boolean;
  cell: [number, number, number];
  face: number;
  type: BuildPieceType;
  valid: boolean; // can afford + valid target
  up: number;     // volume pieces: build-up axis + yaw step for the ghost orientation
  orient: number;
}

const state: BuildGhostState = { active: false, cell: [0, 0, 0], face: 0, type: 'foundation', valid: false, up: 2, orient: 0 };

export function setBuildGhost(cell: [number, number, number], face: number, type: BuildPieceType, valid: boolean, up = 2, orient = 0): void {
  state.active = true;
  state.cell = cell;
  state.face = face;
  state.type = type;
  state.valid = valid;
  state.up = up;
  state.orient = orient;
}

export function clearBuildGhost(): void {
  state.active = false;
}

export function getBuildGhost(): BuildGhostState {
  return state;
}
