import { describe, expect, it } from 'vitest';
import { CH1_BEATS } from './index.ts';
import { getBeatContract } from '../registry.ts';
import {
  chapterForBeat,
  storyHudTakeover,
  storyUsesEarlyTouchDpad,
  storyUsesEmbodiedGuidanceHud,
  type StoryBeat
} from '../../storyState.ts';
import { EXTERNAL_CAMERA_BEATS } from '../../storyDirector.ts';
import {
  classifyLegacyStoryObjectiveGuidanceBeat,
  classifyStoryObjectiveGuidanceBeat,
  resolveLegacyStoryObjectiveGuidance,
  resolveStoryObjectiveGuidance
} from '../../storyObjectiveGuidance.ts';
import { policyForBeat } from '../../storyInputPolicy.ts';

// Batch 1 gate (PARAVOXIA_STORY_PIPELINE_REFACTOR_PLAN.md): every chapter-1
// contract must agree, field by field, with the legacy table that field is
// about to be derived from. When the runtime switches to reading the registry
// for ch1, these are the assertions that make that switch a no-op.

const CH1_ORDER: readonly StoryBeat[] = [
  'descent', 'ch1-fixed', 'ch1-track', 'ch1-raster', 'ch1-depth',
  'ch1-nav', 'ch1-iso', 'ch1-lift', 'ch1-anomaly', 'a1-ramp'
];

const snapshot = (beat: StoryBeat) => ({ active: true, chapter: 'ch1' as const, beat, runId: 1 });

describe('chapter 1 contracts', () => {
  it('registers every chapter-1 beat, in story order, and nothing else', () => {
    expect(CH1_BEATS.map(c => c.id)).toEqual(CH1_ORDER);
    for (const beat of CH1_ORDER) expect(getBeatContract(beat)?.id).toBe(beat);
  });

  it('names the chapter the runtime derives for each beat', () => {
    for (const contract of CH1_BEATS) {
      expect(contract.chapter).toBe(chapterForBeat(contract.id));
    }
  });

  it('matches the shipped objective classification', () => {
    for (const contract of CH1_BEATS) {
      const shipped = classifyLegacyStoryObjectiveGuidanceBeat(contract.id);
      // `descent` is outside the guidance scope today; it is a cutscene.
      const expected = shipped === 'outside-scope' ? 'cinematic' : shipped;
      expect(contract.disposition, contract.id).toBe(expected);
      expect(contract.objective !== null, contract.id).toBe(expected === 'objective');
    }
  });

  it('resolves the identical objective the shipped resolver publishes', () => {
    for (const contract of CH1_BEATS) {
      if (!contract.objective) continue;
      const facts = {} as Parameters<typeof resolveLegacyStoryObjectiveGuidance>[1];
      expect(contract.objective(facts as never), contract.id)
        .toEqual(resolveLegacyStoryObjectiveGuidance(contract.id, facts));
    }
  });

  it('carries the shipped input policy by value', () => {
    for (const contract of CH1_BEATS) {
      const { recipeAllowed: a, ...contractPolicy } = contract.input as unknown as Record<string, unknown>;
      const { recipeAllowed: b, ...shippedPolicy } = policyForBeat(contract.id) as unknown as Record<string, unknown>;
      expect(contractPolicy, contract.id).toEqual(shippedPolicy);
      expect(typeof a, contract.id).toBe(typeof b);
    }
  });

  it('matches every HUD-ownership predicate the runtime evaluates today', () => {
    for (const contract of CH1_BEATS) {
      const s = snapshot(contract.id);
      expect(contract.hud.feedEffects, contract.id).toBe(storyHudTakeover(s));
      expect(contract.hud.embodiedGuidance, contract.id).toBe(storyUsesEmbodiedGuidanceHud(s));
      expect(contract.hud.earlyTouchDpad, contract.id).toBe(storyUsesEarlyTouchDpad(s));
      expect(contract.hud.externalCamera, contract.id).toBe(EXTERNAL_CAMERA_BEATS.has(contract.id));
    }
  });

  it('never declares a force-advance: rails may only report stuck', () => {
    for (const contract of CH1_BEATS) {
      expect(contract.rail.stuckAfterSeconds, contract.id).toBeGreaterThan(0);
      expect(Object.keys(contract.rail).filter(key => key !== 'tick').sort()).toEqual(['stuckAfterSeconds', 'waitReason']);
    }
  });

  it('derivation is a no-op: the public API answers exactly as the legacy tables', () => {
    // With ch1 registered, every runtime read that now consults the registry
    // must return what it returned before. This is the assertion that makes
    // the switch invisible to the ladder trace.
    for (const beat of CH1_ORDER) {
      expect(classifyStoryObjectiveGuidanceBeat(beat), beat)
        .toBe(classifyLegacyStoryObjectiveGuidanceBeat(beat) === 'outside-scope'
          ? 'cinematic'
          : classifyLegacyStoryObjectiveGuidanceBeat(beat));
      expect(resolveStoryObjectiveGuidance(beat, {}), beat)
        .toEqual(resolveLegacyStoryObjectiveGuidance(beat, {}));
    }
  });
});
