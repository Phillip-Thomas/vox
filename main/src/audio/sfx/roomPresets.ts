import type { RoomPresetId } from '../mix/mixSnapshot.ts';
import { resolveEraGates } from '../generative/worldSignals.ts';
import type { VoxelRealityStage } from '../../game/systems/realityRenderSystem.ts';

export type SfxRoomWeights = Record<RoomPresetId, number>;
const clamp = (n: number) => Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;

/** The controller switches to flight before the boarding state observes camera
 * ownership. That intervening transfer frame is still an open hatch, not a
 * sealed cabin. A direct flight entry without a transaction is already inside. */
export function resolveInteriorRoomFraction(boarding: { phase: string; sealProgress: number }, controlMode: string): number {
  if (controlMode !== 'flight') return 0;
  if (boarding.phase === 'hatch_entering' || boarding.phase === 'transfer_requested') return 0;
  if (boarding.phase === 'sealing') return clamp(boarding.sealProgress);
  return 1;
}

/** Water and physical seals already carry their visual smoothing. Do not add a clock. */
export function resolveSfxRoomWeights(input: { era: number; stage?: VoxelRealityStage; submergence: number; interior?: number; station?: number }): SfxRoomWeights {
  const gate = resolveEraGates(input.era, input.stage ?? 'alive').reverb;
  const water = clamp(input.submergence), station = clamp(input.station ?? 0), interior = clamp(input.interior ?? 0);
  return { underwater: gate * water, station: gate * (1 - water) * station,
    interior: gate * (1 - water) * (1 - station) * interior,
    plain: gate * (1 - water) * (1 - station) * (1 - interior), cave: 0 };
}

export const SFX_ROOM_CROSSFADE_S = 1.2;
export const SFX_ROOM_PRESETS: Record<RoomPresetId, { seconds: number; dampingHz: number; send: number; preDelayMs: number }> = {
  plain: { seconds: 0.6, dampingHz: 4200, send: 0.035, preDelayMs: 8 },
  cave: { seconds: 2.4, dampingHz: 2400, send: 0.17, preDelayMs: 32 },
  interior: { seconds: 0.9, dampingHz: 3600, send: 0.1, preDelayMs: 10 },
  underwater: { seconds: 1.6, dampingHz: 800, send: 0.12, preDelayMs: 5 },
  station: { seconds: 1.3, dampingHz: 2900, send: 0.14, preDelayMs: 22 }
};

export function sfxRoomForTier(room: RoomPresetId, quality: 'full' | 'lean'): RoomPresetId {
  return quality === 'lean' && room !== 'underwater' ? 'plain' : room;
}
