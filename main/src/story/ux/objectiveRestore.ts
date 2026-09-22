/** Import-safe entry intent, published before state reconstruction. */
export type ObjectiveRestoreReason = 'seed' | 'resume' | 'transition';
let version = 0;
let runVersion = 0;
let reason: ObjectiveRestoreReason = 'seed';
const listeners = new Set<() => void>();
export function beginGuidedObjectiveRestore(next: ObjectiveRestoreReason, newRun = false): void {
  reason = next; version += 1;
  if (newRun) runVersion += 1;
  for (const listener of listeners) listener();
}
export function readGuidedObjectiveRestore(): { version: number; reason: ObjectiveRestoreReason; runVersion: number } { return { version, reason, runVersion }; }
export function subscribeGuidedObjectiveRestore(listener: () => void): () => void { listeners.add(listener); return () => { listeners.delete(listener); }; }
