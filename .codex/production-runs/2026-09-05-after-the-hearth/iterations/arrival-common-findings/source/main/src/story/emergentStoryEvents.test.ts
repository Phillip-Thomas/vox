import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  emitEmergentStoryEvent,
  getEmergentStoryEvents,
  resetEmergentStoryEvents,
  subscribeEmergentStoryEvents
} from './emergentStoryEvents.ts';

describe('emergent story evidence events', () => {
  beforeEach(resetEmergentStoryEvents);

  it('publishes typed, ordered evidence without reading UI state', () => {
    emitEmergentStoryEvent({
      id: 'repair:1',
      type: 'maw_repaired',
      actorId: 'local',
      payload: { toolId: 'iron_maw' }
    });
    emitEmergentStoryEvent({
      id: 'dive:surface',
      type: 'dive_surfaced',
      payload: { oxygen: 31 }
    });
    expect(getEmergentStoryEvents().map(event => [event.type, event.sequence])).toEqual([
      ['maw_repaired', 1],
      ['dive_surfaced', 2]
    ]);
  });

  it('deduplicates replay by stable event id', () => {
    const first = emitEmergentStoryEvent({
      id: 'ship:frame',
      type: 'ship_repair_stage',
      payload: { from: 'bench_online', to: 'frame_restored' }
    });
    const replay = emitEmergentStoryEvent({
      id: 'ship:frame',
      type: 'ship_repair_stage',
      payload: { from: 'wrecked', to: 'flight_ready' }
    });
    expect(first).not.toBeNull();
    expect(replay).toBeNull();
    expect(getEmergentStoryEvents()).toHaveLength(1);
  });

  it('notifies adapters once for accepted evidence', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeEmergentStoryEvents(listener);
    emitEmergentStoryEvent({
      id: 'station:smelter',
      type: 'station_activated',
      payload: { stationId: 'smelter' }
    });
    unsubscribe();
    emitEmergentStoryEvent({
      id: 'station:assembler',
      type: 'station_activated',
      payload: { stationId: 'assembler' }
    });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
