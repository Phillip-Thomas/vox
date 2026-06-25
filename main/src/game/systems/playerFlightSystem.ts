import type { ActorId } from '../playerActors.ts';
import {
  createPlayerFlightState,
  type PlayerFlightInput,
  type PlayerFlightState
} from '../playerFlight.ts';

export type PlayerFlightSnapshot = Record<ActorId, PlayerFlightState>;

const flights = new Map<ActorId, PlayerFlightState>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach(listener => listener());
}

export function setPlayerFlightState(input: PlayerFlightInput): PlayerFlightState {
  const state = createPlayerFlightState(input);
  flights.set(state.playerId, state);
  emit();
  return state;
}

export function getPlayerFlightState(actorId: ActorId): PlayerFlightState | null {
  return flights.get(actorId) ?? null;
}

export function getPlayerFlightStates(): PlayerFlightState[] {
  return [...flights.values()];
}

export function resetPlayerFlightStates(): void {
  if (flights.size === 0) return;
  flights.clear();
  emit();
}

export function subscribePlayerFlightStates(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getPlayerFlightSnapshot(): PlayerFlightSnapshot {
  return Object.fromEntries(flights) as PlayerFlightSnapshot;
}

export function applyPlayerFlightSnapshot(snapshot: PlayerFlightSnapshot, options: { replace?: boolean } = {}): void {
  if (options.replace ?? true) flights.clear();
  for (const state of Object.values(snapshot)) {
    flights.set(state.playerId, createPlayerFlightState(state));
  }
  emit();
}
