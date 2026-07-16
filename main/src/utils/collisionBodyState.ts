export interface CollisionBodyIdentity {
  key: string;
}

/** Preserve React state identity when streamed collider membership/order did not change. */
export function preserveUnchangedCollisionBodies<T extends CollisionBodyIdentity>(
  previous: T[],
  next: T[]
): T[] {
  if (previous.length !== next.length) return next;
  for (let index = 0; index < previous.length; index++) {
    if (previous[index]?.key !== next[index]?.key) return next;
  }
  return previous;
}
