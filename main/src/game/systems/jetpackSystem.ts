import { JETPACK_MAX_FUEL } from '../../utils/surfaceControls.ts';
import { getLocalActorId, type ActorId } from '../playerActors.ts';

export type JetpackSnapshot = Record<ActorId, number>;

const fuels = new Map<ActorId, number>();
const listeners = new Set<() => void>();

function actorKey(actorId?: ActorId): ActorId {
  return actorId ?? getLocalActorId();
}

function emit() {
  listeners.forEach(listener => listener());
}

export function getJetpackFuelAmount(actorId?: ActorId): number {
  return fuels.get(actorKey(actorId)) ?? JETPACK_MAX_FUEL;
}

export function getJetpackFuelFraction(actorId?: ActorId): number {
  return getJetpackFuelAmount(actorId) / JETPACK_MAX_FUEL;
}

export function setJetpackFuelAmount(amount: number, actorId?: ActorId): void {
  fuels.set(actorKey(actorId), Math.max(0, Math.min(JETPACK_MAX_FUEL, amount)));
  emit();
}

export function refillJetpackFuel(amount: number, actorId?: ActorId): number {
  if (amount <= 0) return getJetpackFuelAmount(actorId);
  const next = Math.min(JETPACK_MAX_FUEL, getJetpackFuelAmount(actorId) + amount);
  setJetpackFuelAmount(next, actorId);
  return next;
}

export function consumeJetpackFuel(amount: number, actorId?: ActorId): number {
  if (amount <= 0) return 0;
  const before = getJetpackFuelAmount(actorId);
  const next = Math.max(0, before - amount);
  setJetpackFuelAmount(next, actorId);
  return before - next;
}

export function resetJetpackFuel(actorId?: ActorId): void {
  setJetpackFuelAmount(JETPACK_MAX_FUEL, actorId);
}

export function resetAllJetpackFuel(): void {
  fuels.clear();
  emit();
}

export function subscribeJetpackFuel(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getJetpackSnapshot(): JetpackSnapshot {
  return Object.fromEntries(fuels) as JetpackSnapshot;
}

export function applyJetpackSnapshot(snapshot: JetpackSnapshot, options: { replace?: boolean } = {}): void {
  if (options.replace ?? true) fuels.clear();
  for (const [actorId, amount] of Object.entries(snapshot) as [ActorId, number][]) {
    fuels.set(actorId, Math.max(0, Math.min(JETPACK_MAX_FUEL, amount)));
  }
  emit();
}
