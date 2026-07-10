// --- Story text channels -------------------------------------------------------
//
// One tiny store for every authored line the story shows, keyed by channel:
//   workorder — the feed HUD's standing directive block (replaced wholesale)
//   violation — the A2 flood ticker (appended, ring-buffered)
//   caption   — the awakening voice (bottom-center, typewriter, ttl)
//   system    — neutral system lines (sleep fade, handoff)
//
// Renderers subscribe for structure changes; per-frame animation (typewriter
// reveal) happens in the renderers' own rAF against `shownAt`.

export type StoryTextChannel = 'workorder' | 'violation' | 'caption' | 'system';

export interface StoryTextState {
  workorder: string[];
  violation: string[];
  caption: { text: string; shownAt: number; ttlMs: number } | null;
  system: { text: string; shownAt: number; ttlMs: number } | null;
}

const MAX_VIOLATIONS = 7;

const state: StoryTextState = {
  workorder: [],
  violation: [],
  caption: null,
  system: null
};

const listeners = new Set<() => void>();
let version = 0;

function emit(): void {
  version++;
  for (const listener of listeners) listener();
}

export function getStoryText(): StoryTextState {
  return state;
}

/** Monotonic change token — pair with useSyncExternalStore (state mutates in place). */
export function getStoryTextVersion(): number {
  return version;
}

export function subscribeStoryText(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Replace the standing work-order block (the feed HUD's directive lines). */
export function setWorkOrder(lines: readonly string[]): void {
  state.workorder = [...lines];
  emit();
}

/** Append a violation line (A2 flood); ring-buffered to the newest few. */
export function pushViolation(line: string): void {
  state.violation.push(line);
  if (state.violation.length > MAX_VIOLATIONS) state.violation.shift();
  emit();
}

export function clearViolations(): void {
  if (state.violation.length === 0) return;
  state.violation = [];
  emit();
}

export function showCaption(text: string, ttlMs = 5200): void {
  state.caption = { text, shownAt: performance.now(), ttlMs };
  emit();
}

export function showSystemLine(text: string, ttlMs = 4000): void {
  state.system = { text, shownAt: performance.now(), ttlMs };
  emit();
}

export function clearStoryText(): void {
  state.workorder = [];
  state.violation = [];
  state.caption = null;
  state.system = null;
  emit();
}
