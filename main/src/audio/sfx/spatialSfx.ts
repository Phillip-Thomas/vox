import { resolveEraGates } from '../generative/worldSignals.ts';
import type { VoxelRealityStage } from '../../game/systems/realityRenderSystem.ts';
export interface AudioPosition { x: number; y: number; z: number }
export interface SfxListener { position: AudioPosition; right: AudioPosition; era: number; stage?: VoxelRealityStage }
export const SFX_PAN_MAX = 0.85;
export const SFX_REFERENCE_DISTANCE = 4;
export const SFX_ROLLOFF = 1.2;
export const SFX_MAX_DISTANCE = 48;
export const NEUTRAL_SFX_LISTENER: SfxListener = { position: { x: 0, y: 0, z: 0 }, right: { x: 1, y: 0, z: 0 }, era: 1 };

export function resolveSpatialSfx(position: AudioPosition | undefined, listener: SfxListener): { pan: number; gain: number; cutoffHz: number } {
  if (!position) return { pan: 0, gain: 1, cutoffHz: 20000 };
  const dx = position.x - listener.position.x, dy = position.y - listener.position.y, dz = position.z - listener.position.z;
  const distance = Math.hypot(dx, dy, dz);
  if (!Number.isFinite(distance)) return { pan: 0, gain: 0, cutoffHz: 2500 };
  const gates = resolveEraGates(listener.era, listener.stage ?? 'alive');
  const width = gates.stereoWidth * SFX_PAN_MAX;
  const rightLength = Math.hypot(listener.right.x, listener.right.y, listener.right.z) || 1;
  const pan = distance > 0.001 ? Math.max(-1, Math.min(1, (dx * listener.right.x + dy * listener.right.y + dz * listener.right.z) / distance / rightLength)) * width : 0;
  const range = Math.min(1, Math.max(0, (distance - SFX_REFERENCE_DISTANCE) / (SFX_MAX_DISTANCE - SFX_REFERENCE_DISTANCE)));
  const gain = distance >= SFX_MAX_DISTANCE ? 0 : SFX_REFERENCE_DISTANCE / (SFX_REFERENCE_DISTANCE + SFX_ROLLOFF * Math.max(0, distance - SFX_REFERENCE_DISTANCE));
  return { pan, gain, cutoffHz: 20000 * Math.pow(2500 / 20000, range * gates.padChoir) };
}
