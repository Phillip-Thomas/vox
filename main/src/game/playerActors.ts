export type ActorId = string;

export const LOCAL_ACTOR_ID: ActorId = 'local';

let localActorId: ActorId = LOCAL_ACTOR_ID;
const listeners = new Set<() => void>();

export function getLocalActorId(): ActorId {
  return localActorId;
}

export function setLocalActorId(actorId: ActorId): void {
  const next = actorId || LOCAL_ACTOR_ID;
  if (next === localActorId) return;
  localActorId = next;
  emit();
}

export function resetLocalActorId(): void {
  setLocalActorId(LOCAL_ACTOR_ID);
}

export function subscribeLocalActorId(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(): void {
  for (const listener of listeners) listener();
}
