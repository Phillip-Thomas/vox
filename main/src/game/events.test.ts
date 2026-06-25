import { describe, expect, it } from 'vitest';
import { createDomainEvent, createDomainEventBus } from './events.ts';

describe('domain events', () => {
  it('creates the common event envelope', () => {
    const event = createDomainEvent({
      eventId: 'evt_test',
      timeMs: 123,
      worldId: '0,0',
      actorId: 'player-1',
      seq: 7,
      type: 'voxel_mined',
      payload: { voxel: [1, 2, 3] }
    });

    expect(event).toEqual({
      eventId: 'evt_test',
      timeMs: 123,
      worldId: '0,0',
      actorId: 'player-1',
      seq: 7,
      type: 'voxel_mined',
      payload: { voxel: [1, 2, 3] }
    });
  });

  it('publishes to subscribers and supports cleanup', () => {
    const bus = createDomainEventBus();
    const seen: string[] = [];
    const unsubscribe = bus.subscribe(event => seen.push(event.type));

    bus.emit(createDomainEvent({
      eventId: 'evt_1',
      timeMs: 1,
      worldId: '0,0',
      actorId: 'player-1',
      type: 'door_toggled',
      payload: {}
    }));
    unsubscribe();
    bus.emit(createDomainEvent({
      eventId: 'evt_2',
      timeMs: 2,
      worldId: '0,0',
      actorId: 'player-1',
      type: 'structure_placed',
      payload: {}
    }));

    expect(seen).toEqual(['door_toggled']);
  });
});
