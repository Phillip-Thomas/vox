import { describe, it, expect, beforeEach } from 'vitest';
import {
  getInteraction,
  getInteractionProbeSnapshot,
  getInteractionScope,
  setInteraction,
  subscribeInteraction
} from './interactionSystem.ts';

beforeEach(() => setInteraction(null));

describe('interaction store', () => {
  it('publishes and reads the current interaction', () => {
    expect(getInteraction()).toBeNull();
    setInteraction({ id: 'door', verb: 'Open Door' });
    expect(getInteraction()).toEqual({ id: 'door', verb: 'Open Door' });
    setInteraction(null);
    expect(getInteraction()).toBeNull();
  });

  it('emits only when the interaction actually changes', () => {
    let n = 0;
    const un = subscribeInteraction(() => n++);
    setInteraction({ id: 'drink', verb: 'Drink' });
    expect(n).toBe(1);
    setInteraction({ id: 'drink', verb: 'Drink' }); // identical → no emit
    expect(n).toBe(1);
    setInteraction({ id: 'board', verb: 'Enter Ship' }); // changed
    expect(n).toBe(2);
    setInteraction(null);
    expect(n).toBe(3);
    un();
  });

  it('exposes a serializable revision without treating equivalent frames as changes', () => {
    const before = getInteractionProbeSnapshot();
    setInteraction({ id: 'story-ship-repair', verb: 'Repair Hull' });
    const published = getInteractionProbeSnapshot();

    expect(published).toMatchObject({
      revision: before.revision + 1,
      active: { id: 'story-ship-repair', verb: 'Repair Hull' }
    });
    expect(published.changedAt).toEqual(expect.any(Number));
    expect(() => JSON.stringify(published)).not.toThrow();

    setInteraction({ id: 'story-ship-repair', verb: 'Repair Hull' });
    expect(getInteractionProbeSnapshot().revision).toBe(published.revision);
  });

  it('labels story and systemic interaction scopes for prompt probes', () => {
    expect(getInteractionScope('story-wreck-scar-attend')).toBe('story');
    expect(getInteractionScope('drink')).toBe('systemic');
  });
});
