import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { getInteraction, setInteraction } from '../game/systems/interactionSystem.ts';
import {
  clearStoryInteractionTrace,
  getStoryInteractionResolutionSnapshot,
  getStoryInteractionTrace,
  recordStoryInteractionOutcome,
  registerStoryInteraction,
  resolveStoryInteraction,
  type StoryInteractionResolver
} from './storyInteractions.ts';

const position = new Vector3();
const cleanups: Array<() => void> = [];

function register(resolver: StoryInteractionResolver): () => void {
  const unregister = registerStoryInteraction(resolver);
  cleanups.push(unregister);
  return unregister;
}

beforeEach(() => {
  clearStoryInteractionTrace();
  setInteraction(null);
});

afterEach(() => {
  while (cleanups.length > 0) cleanups.pop()?.();
  setInteraction(null);
  vi.restoreAllMocks();
});

describe('story interaction arbitration', () => {
  it('does not change its winner when resolver registration order is mutated', () => {
    const anomaly: StoryInteractionResolver = () => ({
      id: 'story-anomaly', verb: 'Touch', perform: () => undefined
    });
    const rest: StoryInteractionResolver = () => ({
      id: 'story-rest', verb: 'Rest', perform: () => undefined
    });

    const unregisterRest = register(rest);
    const unregisterAnomaly = register(anomaly);
    expect(resolveStoryInteraction(null, position)?.id).toBe('story-anomaly');
    unregisterRest();
    unregisterAnomaly();

    register(anomaly);
    register(rest);
    expect(resolveStoryInteraction(null, position)?.id).toBe('story-anomaly');
    expect(getStoryInteractionResolutionSnapshot().candidates.map(candidate => candidate.id))
      .toEqual(['story-anomaly', 'story-rest']);
  });

  it('always ranks required ship repair above an optional scar observation', () => {
    register(() => ({
      id: 'story-wreck-scar-attend',
      verb: 'Inspect Persistent Scar',
      priority: 10_000,
      perform: () => undefined
    }));
    register(() => ({
      id: 'story-ship-repair',
      verb: 'Repair Hull',
      perform: () => undefined
    }));

    const winner = resolveStoryInteraction(null, position);
    const snapshot = getStoryInteractionResolutionSnapshot();
    expect(winner?.id).toBe('story-ship-repair');
    expect(snapshot.winner).toMatchObject({
      id: 'story-ship-repair',
      interactionClass: 'required'
    });
    expect(snapshot.candidates[1]).toMatchObject({
      id: 'story-wreck-scar-attend',
      interactionClass: 'optional-observation'
    });
    expect(() => JSON.stringify(snapshot)).not.toThrow();
  });

  it('clears a stale winner and published prompt immediately on unregister', () => {
    const unregister = register(() => ({
      id: 'story-anomaly', verb: 'Touch', perform: () => undefined
    }));
    const winner = resolveStoryInteraction(null, position);
    setInteraction(winner ? { id: winner.id, verb: winner.verb } : null);
    expect(getInteraction()?.id).toBe('story-anomaly');

    unregister();

    expect(getStoryInteractionResolutionSnapshot().winner).toBeNull();
    expect(getInteraction()).toBeNull();
  });
});

describe('story interaction attempt trace', () => {
  it('distinguishes a returned no-op while invalidating its licensed prompt immediately', () => {
    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(1_010)
      .mockReturnValueOnce(1_020)
      .mockReturnValueOnce(1_080)
      .mockReturnValue(1_100);
    let eligible = true;
    register(() => eligible ? {
      id: 'story-wreck-scar-attend',
      verb: 'Inspect Persistent Scar',
      perform: () => undefined
    } : null);

    const winner = resolveStoryInteraction(null, position);
    setInteraction(winner ? { id: winner.id, verb: winner.verb } : null);
    winner?.perform();
    const returned = getStoryInteractionTrace().latest;
    expect(returned).toMatchObject({
      interactionId: 'story-wreck-scar-attend',
      performOutcome: 'returned',
      promptOutcome: 'cleared',
      replacementInteractionId: null
    });
    expect(getInteraction()).toBeNull();
    expect(returned?.clearingLatencyMs).toBeGreaterThanOrEqual(0);
    expect(returned).not.toBeNull();
    expect(recordStoryInteractionOutcome(returned!.attemptId, 'no-op', 'no state receipt')).toBe(true);
    expect(getStoryInteractionTrace().latest).toMatchObject({
      performOutcome: 'no-op',
      detail: 'no state receipt',
      promptOutcome: 'cleared'
    });

    eligible = false;
    resolveStoryInteraction(null, position);
    const cleared = getStoryInteractionTrace().latest;
    expect(cleared).toMatchObject({
      performOutcome: 'no-op',
      promptOutcome: 'cleared',
      replacementInteractionId: null
    });
    expect(() => JSON.stringify(getStoryInteractionTrace())).not.toThrow();
  });

  it('records thrown handlers and preserves the original exception', () => {
    register(() => ({
      id: 'story-anomaly',
      verb: 'Touch',
      perform: () => { throw new Error('broken interaction'); }
    }));

    const winner = resolveStoryInteraction(null, position);
    expect(() => winner?.perform()).toThrow('broken interaction');
    expect(getStoryInteractionTrace().latest).toMatchObject({
      performOutcome: 'threw',
      detail: 'broken interaction'
    });
  });
});
