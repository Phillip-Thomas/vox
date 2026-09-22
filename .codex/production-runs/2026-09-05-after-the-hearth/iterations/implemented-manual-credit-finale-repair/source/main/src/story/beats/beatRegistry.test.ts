import { afterEach, describe, expect, it } from 'vitest';
import { STORY_BEAT_ORDER } from '../storyState.ts';
import { chapterReactivationBeat, clearBeatRegistry, getBeatContract, registerBeat, registeredBeats } from './registry.ts';
import { defineBeat } from './beatContract.ts';
import { SANDBOX_POLICY } from '../storyInputPolicy.ts';

// The registry's invariants. The coverage test is the one that turns the
// refactor into a checklist: it names every beat still living in the legacy
// tables, and it flips from `todo` to a hard assertion when the last chapter
// lands (PARAVOXIA_STORY_PIPELINE_REFACTOR_PLAN.md, Batch 3).

afterEach(() => clearBeatRegistry());

describe('beat registry', () => {
  it('refuses a beat registered twice', () => {
    const contract = defineBeat({
      id: 'ch1-fixed',
      chapter: 'ch1',
      disposition: 'objective',
      entry: 'sequence',
      objective: null,
      input: SANDBOX_POLICY,
      hud: { feedEffects: true, embodiedGuidance: false, earlyTouchDpad: true, externalCamera: true },
      rail: { stuckAfterSeconds: 60, waitReason: null }
    });
    registerBeat(contract);
    expect(() => registerBeat(contract)).toThrow(/registered twice/);
  });

  it('only ever holds beats that exist in the story order', () => {
    // A contract whose id is not in STORY_BEAT_ORDER is a beat the runtime can
    // never enter — it would be dead declaration masquerading as coverage.
    for (const beat of registeredBeats()) {
      expect(STORY_BEAT_ORDER).toContain(beat);
    }
  });

  it('returns null for unregistered beats so the legacy tables keep serving them', () => {
    expect(getBeatContract('ch1-fixed')).toBeNull();
  });

  it('covers every beat in STORY_BEAT_ORDER except the runtime terminal', async () => {
    // Batch 3: the exhaustiveness assertion the plan promised, now hard. A beat
    // added to the order without a contract fails here, not in a player's hands.
    clearBeatRegistry();
    await import('./index.ts');
    const expected = STORY_BEAT_ORDER.filter(beat => beat !== 'done');
    const missing = expected.filter(beat => getBeatContract(beat) === null);
    expect(missing).toEqual([]);
    for (const beat of registeredBeats()) expect(expected).toContain(beat);
    // The same import is the only chance to see the loaded registry (ES modules
    // evaluate once): chapter 10's door from `done` is declared, no other chapter's is.
    expect(chapterReactivationBeat('ch10')).toBe('ch10-cold');
    expect(chapterReactivationBeat('ch1')).toBeNull();
    expect(chapterReactivationBeat('ch9')).toBeNull();
  });
});
