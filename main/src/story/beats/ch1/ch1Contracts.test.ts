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
  classifyStoryObjectiveGuidanceBeat
} from '../../storyObjectiveGuidance.ts';
import { policyForBeat } from '../../storyInputPolicy.ts';

// Registration/public-view checks. Historical compatibility is checked against
// the frozen browser trace in allContracts.test.ts and story:ladder:trace;
// aliases of the current resolver are not an independent legacy oracle.

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

  it('declares only descent and the first awakening as cinematic', () => {
    for (const contract of CH1_BEATS) {
      const expected = ['descent', 'a1-ramp'].includes(contract.id) ? 'cinematic' : 'objective';
      expect(contract.disposition, contract.id).toBe(expected);
      expect(contract.objective !== null, contract.id).toBe(expected === 'objective');
      expect(classifyStoryObjectiveGuidanceBeat(contract.id), contract.id).toBe(expected);
    }
  });

  it('publishes the registered input policy by value', () => {
    for (const contract of CH1_BEATS) {
      const { recipeAllowed: a, ...contractPolicy } = contract.input as unknown as Record<string, unknown>;
      const { recipeAllowed: b, ...publicPolicy } = policyForBeat(contract.id) as unknown as Record<string, unknown>;
      expect(contractPolicy, contract.id).toEqual(publicPolicy);
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

});
