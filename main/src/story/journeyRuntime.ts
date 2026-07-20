export interface JourneyEntityState {
  id: string;
  mounted: boolean;
  visible: boolean;
  position: readonly [number, number, number] | null;
  phase: string | null;
  source: string;
  revision: number;
  updatedAt: number;
}

export interface JourneyEntityEvent extends JourneyEntityState {
  sequence: number;
}

export interface JourneyEntitySnapshot {
  revision: number;
  entities: Record<string, JourneyEntityState>;
  events: JourneyEntityEvent[];
}

export interface PublishJourneyEntityState {
  mounted: boolean;
  visible: boolean;
  position?: readonly [number, number, number] | null;
  phase?: string | null;
  source: string;
}

const MAX_EVENTS = 256;
const entities = new Map<string, JourneyEntityState>();
const events: JourneyEntityEvent[] = [];
let revision = 0;
let sequence = 0;

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function samePosition(
  left: readonly [number, number, number] | null,
  right: readonly [number, number, number] | null
): boolean {
  return left === right || Boolean(
    left
    && right
    && left[0] === right[0]
    && left[1] === right[1]
    && left[2] === right[2]
  );
}

function roundedPosition(
  value: readonly [number, number, number] | null | undefined
): readonly [number, number, number] | null {
  if (!value) return null;
  return value.map(component => Math.round(component * 100) / 100) as [number, number, number];
}

/**
 * Publish one player-visible story entity fact. Repeated identical frames are
 * intentionally coalesced; lifecycle changes remain in a bounded event trace.
 */
export function publishJourneyEntityState(
  id: string,
  next: PublishJourneyEntityState
): JourneyEntityState {
  if (!id.trim()) throw new Error('Journey entity id must be non-empty.');
  const previous = entities.get(id);
  const position = roundedPosition(next.position);
  const phase = next.phase ?? null;
  if (
    previous
    && previous.mounted === next.mounted
    && previous.visible === next.visible
    && previous.phase === phase
    && previous.source === next.source
    && samePosition(previous.position, position)
  ) {
    return previous;
  }

  revision += 1;
  sequence += 1;
  const state: JourneyEntityState = Object.freeze({
    id,
    mounted: next.mounted,
    visible: next.visible,
    position,
    phase,
    source: next.source,
    revision,
    updatedAt: now()
  });
  entities.set(id, state);
  events.push(Object.freeze({ ...state, sequence }));
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
  return state;
}

/** Preserve explicit absence instead of deleting the fact during unmount. */
export function clearJourneyEntityState(
  id: string,
  source: string,
  phase = 'unmounted'
): JourneyEntityState {
  return publishJourneyEntityState(id, {
    mounted: false,
    visible: false,
    position: null,
    phase,
    source
  });
}

export function getJourneyEntitySnapshot(): JourneyEntitySnapshot {
  return {
    revision,
    entities: Object.fromEntries(
      [...entities.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([id, state]) => [id, { ...state }])
    ),
    events: events.map(event => ({ ...event }))
  };
}

export function resetJourneyEntityRuntimeForTests(): void {
  entities.clear();
  events.length = 0;
  revision = 0;
  sequence = 0;
}
