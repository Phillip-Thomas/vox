import {
  MIX_BUSES,
  type MixBus
} from './mixTuning.ts';
import { resolveSfxRoomWeights, type SfxRoomWeights } from '../sfx/roomPresets.ts';
import type { VoxelRealityStage } from '../../game/systems/realityRenderSystem.ts';

// --- The snapshot mixer (pure) ---------------------------------------------------------------------------
//
// resolveMixSnapshot(input) → per-bus gains (dB), the two submerge cutoffs
// derived from ONE submergence scalar, a room preset id (Stage 4 drives the
// rooms; the id is published now so the plumbing exists), and the quality tier.
// The sandbox state is all-unity by law: nothing this run adds is audible in
// the sandbox path. The snapshot never sets a music gain above 0 dB and never
// touches setScoreIntensity.

export type MixSceneState = 'menu' | 'sandbox' | 'story-lead' | 'dive' | 'station';
export type MixQualityTier = 'full' | 'lean';
export type RoomPresetId = 'plain' | 'underwater' | 'interior' | 'station' | 'cave';

export interface MixSnapshotInput {
  /** App phase: the landing menu or play. */
  phase: 'menu' | 'playing';
  /** A story MOODS beat leads the instrument. */
  storyLead: boolean;
  /** Smoothed camera submergence 0..1 (the same scalar the post pass reads). */
  submergence: number;
  /** Docked at the space station (no live driver this run). */
  station: boolean;
  interior?: boolean;
  interiorFraction?: number;
  stationFraction?: number;
  era?: number;
  stage?: VoxelRealityStage;
  quality: MixQualityTier;
}

export interface MixSnapshot {
  state: MixSceneState;
  busGainDb: Record<MixBus, number>;
  /** Continuous music muffle cutoff, Hz (exponential in depth). */
  musicSubmergeCutoffHz: number;
  /** Edge-driven SFX muffle: the cutoff the submerged buses take, Hz. */
  sfxSubmergeCutoffHz: number;
  /** The SFX edge state (the splash fires on its change). */
  sfxSubmerged: boolean;
  roomPresetId: RoomPresetId;
  roomWeights?: SfxRoomWeights;
  quality: MixQualityTier;
}

// One documented submerge pair per bus (audit-2 D14 unified). Music follows the
// continuous depth; SFX snaps at the edge with its own enter/exit slews (the
// "clunk" and the "gasp"), both reading the same scalar.
export const MUSIC_SUBMERGE_OPEN_HZ = 20000;
export const MUSIC_SUBMERGE_MUFFLED_HZ = 540;
export const SFX_SUBMERGE_OPEN_HZ = 20000;
export const SFX_SUBMERGE_MUFFLED_HZ = 560;
export const SFX_SUBMERGE_EDGE = 0.5;

/** Bus gains per state, dB. Sandbox is unity by law; the others step the world back a hair. */
export const MIX_STATE_BUS_GAIN_DB: Record<MixSceneState, Partial<Record<MixBus, number>>> = {
  menu: {},
  sandbox: {},
  'story-lead': { world: -2 },
  dive: { world: -1.5 },
  station: {}
};

export const MIX_STATE_ROOM: Record<MixSceneState, RoomPresetId> = {
  menu: 'plain',
  sandbox: 'plain',
  'story-lead': 'plain',
  dive: 'underwater',
  station: 'station'
};

export function musicSubmergeCutoffHz(submergence: number): number {
  const a = Math.min(1, Math.max(0, submergence));
  return MUSIC_SUBMERGE_OPEN_HZ * Math.pow(MUSIC_SUBMERGE_MUFFLED_HZ / MUSIC_SUBMERGE_OPEN_HZ, a);
}

/** Precedence: station > dive > story-lead > menu > sandbox. */
export function resolveMixSceneState(input: MixSnapshotInput): MixSceneState {
  if (input.station) return 'station';
  if (input.submergence > SFX_SUBMERGE_EDGE) return 'dive';
  if (input.storyLead) return 'story-lead';
  if (input.phase === 'menu') return 'menu';
  return 'sandbox';
}

export function resolveMixSnapshot(input: MixSnapshotInput): MixSnapshot {
  const state = resolveMixSceneState(input);
  const gains = MIX_STATE_BUS_GAIN_DB[state];
  const busGainDb = {} as Record<MixBus, number>;
  for (const bus of MIX_BUSES) busGainDb[bus] = Math.min(0, gains[bus] ?? 0);
  const sfxSubmerged = input.submergence > SFX_SUBMERGE_EDGE;
  return {
    state,
    busGainDb,
    musicSubmergeCutoffHz: musicSubmergeCutoffHz(input.submergence),
    sfxSubmergeCutoffHz: sfxSubmerged ? SFX_SUBMERGE_MUFFLED_HZ : SFX_SUBMERGE_OPEN_HZ,
    sfxSubmerged,
    roomPresetId: state !== 'dive' && state !== 'station' && input.interior ? 'interior' : MIX_STATE_ROOM[state],
    roomWeights: resolveSfxRoomWeights({ era: input.era ?? 0, stage: input.stage, submergence: input.submergence,
      interior: input.interiorFraction ?? (input.interior ? 1 : 0), station: input.stationFraction ?? (input.station ? 1 : 0) }),
    quality: input.quality
  };
}

/** True when two snapshots would write the same bus gains (the dirty check). */
export function sameBusGains(a: MixSnapshot, b: MixSnapshot, epsilonDb: number): boolean {
  for (const bus of MIX_BUSES) {
    if (Math.abs(a.busGainDb[bus] - b.busGainDb[bus]) > epsilonDb) return false;
  }
  return true;
}
