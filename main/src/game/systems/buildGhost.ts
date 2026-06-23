// Build-ghost readout: where the currently-selected piece would snap, written each
// frame by EfficientPlayer's build loop and polled by the in-Canvas BuildGhost. Same
// mutable-singleton pattern as miningProgress.

export interface BuildGhostState {
  active: boolean;
  cell: [number, number, number];
  face: number;
  valid: boolean; // can afford + valid target
}

const state: BuildGhostState = { active: false, cell: [0, 0, 0], face: 0, valid: false };

export function setBuildGhost(cell: [number, number, number], face: number, valid: boolean): void {
  state.active = true;
  state.cell = cell;
  state.face = face;
  state.valid = valid;
}

export function clearBuildGhost(): void {
  state.active = false;
}

export function getBuildGhost(): BuildGhostState {
  return state;
}
