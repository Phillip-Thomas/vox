/** Import-safe entry intent: storyState must not import the audio graph. */
export type ObjectiveRestoreReason = 'seed' | 'resume' | 'transition';
let version = 0;
let reason: ObjectiveRestoreReason = 'seed';
export function beginGuidedObjectiveRestore(next: ObjectiveRestoreReason): void { reason = next; version += 1; }
export function readGuidedObjectiveRestore(): { version: number; reason: ObjectiveRestoreReason } { return { version, reason }; }
