import { describe, expect, it } from 'vitest';
import { AudioEventQueue, type AudioEvent } from './audioEventQueue.ts';

const ev = (id: string, priority = 0): AudioEvent => ({ id, category: 'player', priority });

describe('per-frame audio event queue (pure)', () => {
  it('dedupes by (id, frame): forty mines in one frame flush as one', () => {
    const q = new AudioEventQueue();
    const verdicts = Array.from({ length: 40 }, () => q.post(ev('mine'), 10));
    expect(verdicts[0]).toBe('queued');
    expect(verdicts.slice(1).every((v) => v === 'dedupe-same-frame')).toBe(true);
    expect(q.flush().map((e) => e.id)).toEqual(['mine']);
  });

  it('held-level law: the same id on consecutive frames sounds once, a one-frame gap is a new edge', () => {
    const q = new AudioEventQueue();
    expect(q.post(ev('mine'), 1)).toBe('queued');
    q.flush();
    expect(q.post(ev('mine'), 2)).toBe('held-level');
    q.flush();
    expect(q.post(ev('mine'), 3)).toBe('held-level');
    q.flush();
    // gap at frame 4
    expect(q.post(ev('mine'), 5)).toBe('queued');
  });

  it('different ids in consecutive frames are independent edges', () => {
    const q = new AudioEventQueue();
    expect(q.post(ev('jump'), 1)).toBe('queued');
    q.flush();
    expect(q.post(ev('land'), 2)).toBe('queued');
  });

  it('flushes highest priority first, stable within a priority, then empties', () => {
    const q = new AudioEventQueue();
    q.post(ev('mine', 0), 7);
    q.post(ev('shipCrash', 3), 7);
    q.post(ev('jump', 0), 7);
    q.post(ev('terminalAlarm', 2), 7);
    expect(q.flush().map((e) => e.id)).toEqual(['shipCrash', 'terminalAlarm', 'mine', 'jump']);
    expect(q.flush()).toEqual([]);
    expect(q.size).toBe(0);
  });

  it('a late flush keeps events posted across a frame boundary', () => {
    const q = new AudioEventQueue();
    q.post(ev('a'), 1);
    q.post(ev('b'), 2);
    expect(q.flush().map((e) => e.id)).toEqual(['a', 'b']);
  });
});
