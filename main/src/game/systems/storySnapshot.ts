/**
 * Snapshot and restore the whole durable game state.
 *
 * Iterating on a story beat currently costs a full replay. Every `?story=<beat>`
 * jump wipes progression, inventory, vitals, both worlds' voxel edits and both
 * poses, then reconstructs only the *prerequisites* of that beat — never a point
 * partway through it. So retrying the last twenty seconds of a beat means playing
 * the whole chain up to it again, and any setup built by hand is gone.
 *
 * This is the general fix rather than another entry point. Instead of authoring a
 * URL flag for every interesting sub-state — "settle with the foundation placed",
 * "settle with the core installed" — the player reaches the moment once, snapshots
 * it, and returns to it in a reload from then on.
 *
 * The trick that makes it cheap and correct: a snapshot is a **copy of the keys the
 * game already persists**, not a bespoke serializer. There is nothing to keep in
 * step with the save format, because it *is* the save format. Anything the game
 * considers durable is captured by construction; anything it does not is not worth
 * capturing.
 *
 * Deliberately not captured: user preferences. Graphics profile, audio volumes and
 * mute state live under a different prefix and are left alone, because restoring a
 * snapshot must not silently change someone's quality tier or unmute their machine.
 */

/** The subset of the Storage API this module needs. Keeps it testable off-browser. */
export interface StorageLike {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Where snapshots themselves live. Outside the game namespace, or restoring would eat them. */
export const SNAPSHOT_PREFIX = 'pvxsnap.';

/**
 * Prefixes the game writes durable world/progression state under.
 *
 * `pvx.` covers the versioned global save (inventory, era, milestones — which is
 * where story beats live — vitals, ship restoration) and every per-world record
 * (structures, campfires, habitat, resources, voxel edits, player pose).
 */
const GAME_STATE_PREFIXES = ['pvx.', 'voxel.poses'] as const;

export interface Snapshot {
  name: string;
  /** Milliseconds since epoch, supplied by the caller so this module stays pure. */
  createdAt: number;
  /** The story beat this was taken at, for the picker. Display only. */
  beat: string | null;
  /** Free-text note from whoever took it. */
  note: string;
  entries: Record<string, string>;
}

export interface SnapshotSummary {
  name: string;
  createdAt: number;
  beat: string | null;
  note: string;
  keyCount: number;
  /** Approximate serialized size, so a slot about to blow the quota is visible. */
  bytes: number;
}

/** Whether a key belongs to the durable game state a snapshot should carry. */
export function isGameStateKey(key: string): boolean {
  if (key.startsWith(SNAPSHOT_PREFIX)) return false;
  return GAME_STATE_PREFIXES.some(prefix => key.startsWith(prefix));
}

/** Every game-state key currently present, in a stable order. */
export function gameStateKeys(storage: StorageLike): string[] {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key !== null && isGameStateKey(key)) keys.push(key);
  }
  // Sorted so two snapshots of identical state compare equal, which is what makes
  // "did this change anything?" answerable.
  return keys.sort();
}

export function captureSnapshot(
  storage: StorageLike,
  name: string,
  options: { now: number; beat?: string | null; note?: string }
): Snapshot {
  const entries: Record<string, string> = {};
  for (const key of gameStateKeys(storage)) {
    const value = storage.getItem(key);
    if (value !== null) entries[key] = value;
  }
  return {
    name,
    createdAt: options.now,
    beat: options.beat ?? null,
    note: options.note ?? '',
    entries
  };
}

export function writeSnapshot(storage: StorageLike, snapshot: Snapshot): void {
  storage.setItem(`${SNAPSHOT_PREFIX}${snapshot.name}`, JSON.stringify(snapshot));
}

export function readSnapshot(storage: StorageLike, name: string): Snapshot | null {
  const raw = storage.getItem(`${SNAPSHOT_PREFIX}${name}`);
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as Snapshot;
    // A slot written by an older build, or edited by hand, must not take the game
    // down on boot — the debug panel reads every slot to draw its list.
    if (!parsed || typeof parsed !== 'object' || typeof parsed.entries !== 'object') return null;
    return {
      name: typeof parsed.name === 'string' ? parsed.name : name,
      createdAt: typeof parsed.createdAt === 'number' ? parsed.createdAt : 0,
      beat: typeof parsed.beat === 'string' ? parsed.beat : null,
      note: typeof parsed.note === 'string' ? parsed.note : '',
      entries: parsed.entries ?? {}
    };
  } catch {
    return null;
  }
}

export function listSnapshots(storage: StorageLike): SnapshotSummary[] {
  const names: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith(SNAPSHOT_PREFIX)) names.push(key.slice(SNAPSHOT_PREFIX.length));
  }
  const summaries: SnapshotSummary[] = [];
  for (const name of names.sort()) {
    const snapshot = readSnapshot(storage, name);
    if (!snapshot) continue;
    const keys = Object.keys(snapshot.entries);
    summaries.push({
      name: snapshot.name,
      createdAt: snapshot.createdAt,
      beat: snapshot.beat,
      note: snapshot.note,
      keyCount: keys.length,
      bytes: keys.reduce((sum, key) => sum + key.length + snapshot.entries[key].length, 0)
    });
  }
  // Newest first: the slot you just took is the one you want next.
  return summaries.sort((a, b) => b.createdAt - a.createdAt);
}

export function deleteSnapshot(storage: StorageLike, name: string): void {
  storage.removeItem(`${SNAPSHOT_PREFIX}${name}`);
}

/**
 * Put the world back exactly as the snapshot found it.
 *
 * Clears the current game state before writing, which is the whole reason this is
 * not a loop of setItem. Restoring over the top leaves behind anything created
 * since the snapshot was taken — a structure you built, a milestone you crossed —
 * so the restore would return you to a state that never existed. The caller is
 * expected to reload afterwards; nothing in the running session re-reads these.
 */
export function restoreSnapshot(storage: StorageLike, snapshot: Snapshot): void {
  for (const key of gameStateKeys(storage)) storage.removeItem(key);
  for (const [key, value] of Object.entries(snapshot.entries)) {
    if (!isGameStateKey(key)) continue; // never let a hand-edited slot write outside the namespace
    storage.setItem(key, value);
  }
}

/** Restore by name. Returns false when the slot is missing or unreadable. */
export function restoreSnapshotByName(storage: StorageLike, name: string): boolean {
  const snapshot = readSnapshot(storage, name);
  if (!snapshot) return false;
  restoreSnapshot(storage, snapshot);
  return true;
}

/**
 * A name that is safe as a storage key and readable in a list.
 *
 * Snapshot names come from a free-text field, and a name containing the prefix
 * separator would collide with another slot.
 */
export function normaliseSnapshotName(raw: string): string {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_ ]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 48);
  return cleaned.length > 0 ? cleaned : 'slot';
}
