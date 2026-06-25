import type { ActorId } from './playerActors.ts';

export type Vec3Tuple = [number, number, number];

export const PLAYER_ACTION_MODES = [
  'idle',
  'walk',
  'swim',
  'jetpack',
  'climb',
  'sprint',
  'mine',
  'build',
  'drink',
  'warp'
] as const;

export type PlayerActionMode = typeof PLAYER_ACTION_MODES[number];

export interface PlayerPose {
  playerId: ActorId;
  worldId: string;
  seq: number;
  timeMs: number;
  position: Vec3Tuple;
  velocity: Vec3Tuple;
  forward: Vec3Tuple;
  up: Vec3Tuple;
  pitch: number;
  action: PlayerActionMode;
  teleport?: boolean;
  warp?: boolean;
  submergence: number;
  miningProgress: number;
  jetpackActive: boolean;
  torchActive: boolean;
  shipPhase?: 'surface' | 'flight' | 'space' | 'warp';
}

export type PlayerPoseInput = Pick<PlayerPose, 'playerId' | 'worldId'> & Partial<Omit<PlayerPose, 'playerId' | 'worldId'>>;

const ZERO: Vec3Tuple = [0, 0, 0];
const UP: Vec3Tuple = [0, 1, 0];
const FORWARD: Vec3Tuple = [0, 0, -1];

function finite(n: number, fallback = 0): number {
  return Number.isFinite(n) ? n : fallback;
}

function vec3(value: Vec3Tuple | undefined, fallback: Vec3Tuple): Vec3Tuple {
  return [
    finite(value?.[0] ?? fallback[0]),
    finite(value?.[1] ?? fallback[1]),
    finite(value?.[2] ?? fallback[2])
  ];
}

function clamp01(n: number | undefined): number {
  return Math.max(0, Math.min(1, finite(n ?? 0)));
}

export function createPlayerPose(input: PlayerPoseInput): PlayerPose {
  return {
    playerId: input.playerId,
    worldId: input.worldId,
    seq: Math.max(0, Math.trunc(finite(input.seq ?? 0))),
    timeMs: Math.max(0, finite(input.timeMs ?? Date.now())),
    position: vec3(input.position, ZERO),
    velocity: vec3(input.velocity, ZERO),
    forward: vec3(input.forward, FORWARD),
    up: vec3(input.up, UP),
    pitch: finite(input.pitch ?? 0),
    action: input.action ?? 'idle',
    teleport: input.teleport,
    warp: input.warp,
    submergence: clamp01(input.submergence),
    miningProgress: clamp01(input.miningProgress),
    jetpackActive: Boolean(input.jetpackActive),
    torchActive: Boolean(input.torchActive),
    shipPhase: input.shipPhase
  };
}
