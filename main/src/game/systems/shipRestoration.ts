import { emitEmergentStoryEvent } from '../../story/emergentStoryEvents.ts';
import {
  atLeast,
  commitStoryJetInstalled,
  nextShipRepairStage,
  type ShipRepairStage
} from '../../story/emergentCapabilities.ts';
import {
  commitTidegardenRouteOnline,
  isTidegardenRouteOnline
} from '../../story/tidegardenRoute.ts';
import type { ActorId } from '../playerActors.ts';

export const SHIP_RESTORATION_VERSION = 1 as const;

export interface ShipPose {
  position: [number, number, number];
  quaternion: [number, number, number, number];
}

export interface ShipSystemPose extends ShipPose {
  velocity: [number, number, number];
}

export interface ShipRepairCommit {
  eventId: string;
  from: ShipRepairStage;
  to: ShipRepairStage;
}

export interface ShipRestorationState {
  version: typeof SHIP_RESTORATION_VERSION;
  repairStage: ShipRepairStage;
  currentSystemId: string | null;
  currentWorldId: string | null;
  parkedPose: ShipPose | null;
  systemPose: ShipSystemPose | null;
  locationMode: 'surface' | 'atmosphere' | 'local_space';
  repairHistory: ShipRepairCommit[];
}

export interface ShipRepairResult {
  ok: boolean;
  idempotent: boolean;
  reason?: 'invalid-event-id' | 'out-of-order';
  state: ShipRestorationState;
}

let state = initialShipRestorationState();
const listeners = new Set<() => void>();

export function initialShipRestorationState(): ShipRestorationState {
  return {
    version: SHIP_RESTORATION_VERSION,
    repairStage: 'wrecked',
    currentSystemId: null,
    currentWorldId: null,
    parkedPose: null,
    systemPose: null,
    locationMode: 'surface',
    repairHistory: []
  };
}

export function getShipRestorationSnapshot(): ShipRestorationState {
  return cloneState(state);
}

/** Stable primitive snapshot for renderers and capability gates. */
export function getShipRepairStage(): ShipRepairStage {
  return state.repairStage;
}

export function subscribeShipRestoration(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * The repair sequence is monotonic and non-skippable. The final commit also
 * records the sole persisted Tidegarden route capability in the same
 * synchronous transaction boundary.
 */
export function commitShipRepairStage(
  eventIdInput: string,
  target: ShipRepairStage,
  actorId?: ActorId
): ShipRepairResult {
  const eventId = eventIdInput.trim();
  if (!eventId) return failure('invalid-event-id');
  const replay = state.repairHistory.find(commit => commit.eventId === eventId);
  if (replay) {
    if (replay.to !== target) return failure('out-of-order');
    // Replays are mutation-free, but can reconstruct capability receipts if a
    // partial legacy restore loaded ship history before player progression.
    if (atLeast(state.repairStage, 'lift_online')) commitStoryJetInstalled(actorId);
    if (state.repairStage === 'flight_ready') commitTidegardenRouteOnline();
    return { ok: true, idempotent: true, state: cloneState(state) };
  }
  const expected = nextShipRepairStage(state.repairStage);
  if (expected !== target) return failure('out-of-order');

  const from = state.repairStage;
  state = {
    ...state,
    repairStage: target,
    repairHistory: [...state.repairHistory, { eventId, from, to: target }]
  };
  if (target === 'lift_online') commitStoryJetInstalled(actorId);
  if (target === 'flight_ready') commitTidegardenRouteOnline();
  emitEmergentStoryEvent({
    id: eventId,
    type: 'ship_repair_stage',
    worldId: state.currentWorldId ?? undefined,
    payload: { from, to: target }
  });
  emit();
  return { ok: true, idempotent: false, state: cloneState(state) };
}

export function setShipRestorationLocation(input: Pick<
  ShipRestorationState,
  'currentSystemId' | 'currentWorldId' | 'parkedPose' | 'systemPose' | 'locationMode'
>): void {
  state = hydrateShipRestorationState({ ...state, ...input });
  emit();
}

export function hydrateShipRestorationState(value: unknown): ShipRestorationState {
  if (!isObject(value)) return initialShipRestorationState();
  const repairStage = isShipRepairStage(value.repairStage) ? value.repairStage : 'wrecked';
  const repairHistory = Array.isArray(value.repairHistory)
    ? value.repairHistory.map(parseRepairCommit).filter((item): item is ShipRepairCommit => item !== null)
    : [];
  const uniqueHistory = repairHistory.filter((commit, index, list) =>
    list.findIndex(candidate => candidate.eventId === commit.eventId) === index
  );
  return {
    version: SHIP_RESTORATION_VERSION,
    repairStage,
    currentSystemId: optionalId(value.currentSystemId),
    currentWorldId: optionalId(value.currentWorldId),
    parkedPose: parsePose(value.parkedPose),
    systemPose: parseSystemPose(value.systemPose),
    locationMode: value.locationMode === 'atmosphere' || value.locationMode === 'local_space'
      ? value.locationMode
      : 'surface',
    repairHistory: uniqueHistory
  };
}

export function applyShipRestorationSnapshot(value: unknown): void {
  state = hydrateShipRestorationState(value);
  // Capability migration: a restored lift-online-or-later ship must never load
  // with hover disabled, while earlier saves still cannot jetpack in Story.
  if (atLeast(state.repairStage, 'lift_online')) commitStoryJetInstalled();
  // Migration for early Packet 2 saves that reached flight-ready before the
  // route capability was folded into the same commit.
  if (state.repairStage === 'flight_ready' && !isTidegardenRouteOnline()) {
    commitTidegardenRouteOnline();
  }
  emit();
}

export function resetShipRestoration(): void {
  state = initialShipRestorationState();
  emit();
}

function failure(reason: ShipRepairResult['reason']): ShipRepairResult {
  return { ok: false, idempotent: false, reason, state: cloneState(state) };
}

function cloneState(source: ShipRestorationState): ShipRestorationState {
  return {
    ...source,
    parkedPose: source.parkedPose ? clonePose(source.parkedPose) : null,
    systemPose: source.systemPose
      ? { ...clonePose(source.systemPose), velocity: [...source.systemPose.velocity] }
      : null,
    repairHistory: source.repairHistory.map(commit => ({ ...commit }))
  };
}

function clonePose(pose: ShipPose): ShipPose {
  return { position: [...pose.position], quaternion: [...pose.quaternion] };
}

function parseRepairCommit(value: unknown): ShipRepairCommit | null {
  if (!isObject(value)) return null;
  const eventId = typeof value.eventId === 'string' ? value.eventId.trim() : '';
  if (!eventId || !isShipRepairStage(value.from) || !isShipRepairStage(value.to)) return null;
  if (nextShipRepairStage(value.from) !== value.to) return null;
  return { eventId, from: value.from, to: value.to };
}

function parsePose(value: unknown): ShipPose | null {
  if (!isObject(value)) return null;
  const position = tuple(value.position, 3);
  const quaternion = tuple(value.quaternion, 4);
  return position && quaternion
    ? { position: position as ShipPose['position'], quaternion: quaternion as ShipPose['quaternion'] }
    : null;
}

function parseSystemPose(value: unknown): ShipSystemPose | null {
  const pose = parsePose(value);
  if (!pose || !isObject(value)) return null;
  const velocity = tuple(value.velocity, 3);
  return velocity ? { ...pose, velocity: velocity as ShipSystemPose['velocity'] } : null;
}

function tuple(value: unknown, length: number): number[] | null {
  return Array.isArray(value)
    && value.length === length
    && value.every(item => typeof item === 'number' && Number.isFinite(item))
    ? [...value]
    : null;
}

function optionalId(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isShipRepairStage(value: unknown): value is ShipRepairStage {
  return value === 'wrecked'
    || value === 'bench_online'
    || value === 'frame_restored'
    || value === 'hull_sealed'
    || value === 'lift_online'
    || value === 'flight_ready';
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function emit(): void {
  for (const listener of listeners) listener();
}
