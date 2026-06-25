// --- Domain events -----------------------------------------------------------
//
// Phase-0 seam: typed event envelopes without transport assumptions. Multiplayer
// can persist/replicate these later; single-player can subscribe in-process now.

export const DOMAIN_EVENT_TYPES = [
  'voxel_mined',
  'water_flooded',
  'structure_placed',
  'structure_removed',
  'door_toggled',
  'resource_taken',
  'campfire_placed',
  'vital_threshold',
  'player_died',
  'player_respawned',
  'world_clock_changed',
  'warp_requested',
  'recipe_crafted',
  'item_consumed',
  'water_drank',
  'waterskin_filled',
  'maw_refueled',
  'maw_repaired',
  'maw_charge_spent'
] as const;

export type DomainEventType = typeof DOMAIN_EVENT_TYPES[number];

export interface DomainEventEnvelope<TType extends string = DomainEventType, TPayload = unknown> {
  eventId: string;
  worldId: string;
  actorId: string;
  seq?: number;
  timeMs: number;
  type: TType;
  payload: TPayload;
}

export type DomainEvent = DomainEventEnvelope<string, unknown>;
export type DomainEventListener = (event: DomainEvent) => void;

let nextLocalEventId = 0;

export function createLocalEventId(prefix = 'evt'): string {
  nextLocalEventId += 1;
  return `${prefix}_${nextLocalEventId.toString(36)}`;
}

export function createDomainEvent<TType extends string, TPayload>(
  input: Omit<DomainEventEnvelope<TType, TPayload>, 'eventId' | 'timeMs'> &
    Partial<Pick<DomainEventEnvelope<TType, TPayload>, 'eventId' | 'timeMs'>>
): DomainEventEnvelope<TType, TPayload> {
  return {
    ...input,
    eventId: input.eventId ?? createLocalEventId(),
    timeMs: input.timeMs ?? Date.now()
  };
}

export class DomainEventBus {
  private readonly listeners = new Set<DomainEventListener>();

  subscribe(listener: DomainEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: DomainEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  clear(): void {
    this.listeners.clear();
  }
}

export function createDomainEventBus(): DomainEventBus {
  return new DomainEventBus();
}
