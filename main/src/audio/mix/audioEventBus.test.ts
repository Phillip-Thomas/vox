import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('live audio event bus (rim over the pure queue)', () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('flushes once per posting task in a microtask, deduped by (id, frame), highest priority first', async () => {
    const bus = await import('./audioEventBus.ts');
    bus.setAudioEventFrameForTests(100);
    const seen: string[] = [];
    bus.onAudioEvent((e) => seen.push(e.id));
    expect(bus.postAudioEvent({ id: 'mine', category: 'player', priority: 0 })).toBe('queued');
    expect(bus.postAudioEvent({ id: 'mine', category: 'player', priority: 0 })).toBe('dedupe-same-frame');
    expect(bus.postAudioEvent({ id: 'shipCrash', category: 'ship', priority: 3 })).toBe('queued');
    expect(seen).toEqual([]); // nothing sounds synchronously…
    await Promise.resolve(); // …the microtask flush runs at the end of the task
    expect(seen).toEqual(['shipCrash', 'mine']);
  });

  it('held-level law across frames: a call site posting every frame sounds once', async () => {
    const bus = await import('./audioEventBus.ts');
    const seen: string[] = [];
    bus.onAudioEvent((e) => seen.push(e.id));
    for (let frame = 1; frame <= 10; frame++) {
      bus.setAudioEventFrameForTests(frame);
      bus.postAudioEvent({ id: 'mine', category: 'player', priority: 0 });
      bus.flushAudioEventsNow();
    }
    expect(seen).toEqual(['mine']);
    // A one-frame gap re-arms the edge.
    bus.setAudioEventFrameForTests(12);
    bus.postAudioEvent({ id: 'mine', category: 'player', priority: 0 });
    bus.flushAudioEventsNow();
    expect(seen).toEqual(['mine', 'mine']);
  });

  it('unsubscribe stops delivery', async () => {
    const bus = await import('./audioEventBus.ts');
    bus.setAudioEventFrameForTests(5);
    const seen: string[] = [];
    const off = bus.onAudioEvent((e) => seen.push(e.id));
    off();
    bus.postAudioEvent({ id: 'jump', category: 'player', priority: 0 });
    bus.flushAudioEventsNow();
    expect(seen).toEqual([]);
  });
});
