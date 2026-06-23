// Mining-progress readout: how far the current hold-to-mine action has charged,
// written each frame by EfficientPlayer's mining loop and polled by the HUD
// crosshair ring. Module-singleton mutable (same shape as targeting.ts) so the
// 60fps progress never churns React state for the rest of the app — the HUD reads
// it via its own rAF, exactly like the deep-space engage charge.

export interface MiningProgressState {
  /** True while the player is actively holding to mine (or attempting to). */
  active: boolean;
  /** Progress toward breaking the block, 0..1. */
  pct: number;
  /** True when the targeted voxel needs a higher tool tier than equipped. */
  blocked: boolean;
}

const state: MiningProgressState = { active: false, pct: 0, blocked: false };

export function setMiningProgress(active: boolean, pct: number, blocked: boolean): void {
  state.active = active;
  state.pct = pct;
  state.blocked = blocked;
}

export function clearMiningProgress(): void {
  state.active = false;
  state.pct = 0;
  state.blocked = false;
}

export function getMiningProgress(): MiningProgressState {
  return state;
}
