import { describe, it, expect, beforeEach } from 'vitest';
import { getInteraction, setInteraction, subscribeInteraction } from './interactionSystem.ts';

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
});
