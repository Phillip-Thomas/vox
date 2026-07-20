// Query-facing keyboard/application receipts used by the chapter journey probe.
// Gameplay never reads this state, so instrumentation cannot steer the story.

export interface JourneyInputEvent {
  sequence: number;
  at: number;
  type: 'gameplay-hotkey-boundary' | 'application-submit';
  code?: string;
  targetEditable?: boolean;
  value?: string;
}

export interface JourneyInputSnapshot {
  revision: number;
  hotkeyActivations: number;
  submitCount: number;
  lastSubmittedValue: string | null;
  events: JourneyInputEvent[];
}

const GAMEPLAY_HOTKEY_CODES = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight',
  'KeyB', 'KeyC', 'KeyF', 'KeyH', 'KeyM', 'KeyR', 'Escape',
  'Digit0', 'Digit1', 'Digit2', 'Digit3', 'Digit4',
  'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9'
]);

const MAX_EVENTS = 80;
let revision = 0;
let hotkeyActivations = 0;
let submitCount = 0;
let lastSubmittedValue: string | null = null;
const events: JourneyInputEvent[] = [];

function append(event: Omit<JourneyInputEvent, 'sequence' | 'at'>): void {
  revision += 1;
  events.push({ sequence: revision, at: Date.now(), ...event });
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
}

/**
 * Records a gameplay shortcut candidate that reached the window-level input
 * boundary. Editable controls must stop their keystrokes before this boundary.
 */
export function recordJourneyGameplayHotkeyBoundary(code: string, targetEditable: boolean): void {
  if (!GAMEPLAY_HOTKEY_CODES.has(code)) return;
  hotkeyActivations += 1;
  append({ type: 'gameplay-hotkey-boundary', code, targetEditable });
}

/** Records a successful application-level naming submission, not a DOM Enter. */
export function recordJourneyInputSubmission(value: string): void {
  submitCount += 1;
  lastSubmittedValue = value;
  append({ type: 'application-submit', value });
}

export function getJourneyInputSnapshot(): JourneyInputSnapshot {
  return {
    revision,
    hotkeyActivations,
    submitCount,
    lastSubmittedValue,
    events: events.map(event => ({ ...event }))
  };
}

/** Test/probe-run isolation only; ordinary gameplay has no reason to call it. */
export function resetJourneyInputRuntime(): void {
  revision = 0;
  hotkeyActivations = 0;
  submitCount = 0;
  lastSubmittedValue = null;
  events.splice(0, events.length);
}
