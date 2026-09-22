import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import './index.ts';
import { getBeatContract, registeredBeats } from './registry.ts';
import {
  chapterForBeat,
  EARLY_TOUCH_DPAD_BEATS,
  STORY_BEAT_ORDER,
  type StoryBeat
} from '../storyState.ts';
import { EXTERNAL_CAMERA_BEATS } from '../storyDirector.ts';
import {
  classifyStoryObjectiveGuidanceBeat
} from '../storyObjectiveGuidance.ts';
import { policyForBeat } from '../storyInputPolicy.ts';

// Public-view consistency is distinct from historical compatibility. The frozen
// 2026-09-05 browser trace is the independent oracle for the observed beat census,
// objective disposition and stable input permissions below. Dynamic objectives,
// look mode and movement scale still require the actual runtime ladder comparison.
const baseline = JSON.parse(readFileSync(new URL(
  '../../../../.codex/production-runs/2026-09-story-pipeline/ladder-baseline.json', import.meta.url
), 'utf8')) as { trace: Record<string, Array<{ objective: unknown; policy: Record<string, unknown> }>> };
const stablePermissions = ['allowJump', 'allowSprint', 'allowBuild', 'allowCraft'] as const;

const ALL: readonly StoryBeat[] = STORY_BEAT_ORDER.filter(beat => beat !== 'done');
const embodiedFrom = STORY_BEAT_ORDER.indexOf('ch1-anomaly');

describe('registered contracts and the frozen runtime ladder', () => {
  it('registers exactly the story order minus the terminal', () => {
    expect([...registeredBeats()].sort()).toEqual([...ALL].sort());
    expect([...registeredBeats()].sort()).toEqual(Object.keys(baseline.trace).sort());
  });

  it('retains each observed objective disposition and stable input permission', () => {
    for (const beat of ALL) {
      const c = getBeatContract(beat)!;
      const samples = baseline.trace[beat];
      expect(samples.length, beat).toBeGreaterThan(0);
      expect(c.chapter, beat).toBe(chapterForBeat(beat));
      expect(c.disposition, beat).toBe(samples.some(sample => sample.objective) ? 'objective' : 'cinematic');
      expect(classifyStoryObjectiveGuidanceBeat(beat), beat).toBe(c.disposition);
      for (const sample of samples) {
        for (const key of stablePermissions) expect(c.input[key], `${beat}.${key}`).toBe(sample.policy[key]);
      }
    }
  });

  it('publishes the registered input policy by value', () => {
    for (const beat of ALL) {
      const { recipeAllowed: a, allowBaseInteraction: ab, ...contractPolicy } =
        getBeatContract(beat)!.input as unknown as Record<string, unknown>;
      const { recipeAllowed: b, allowBaseInteraction: bb, ...publicPolicy } =
        policyForBeat(beat) as unknown as Record<string, unknown>;
      expect(contractPolicy, beat).toEqual(publicPolicy);
      expect(typeof a, beat).toBe(typeof b);
      expect(typeof ab, beat).toBe(typeof bb);
    }
  });

  it('HUD ownership flags', () => {
    for (const beat of ALL) {
      const h = getBeatContract(beat)!.hud;
      const chapter = chapterForBeat(beat);
      expect(h.feedEffects, beat).toBe(chapter === 'ch1' || chapter === 'ch2');
      expect(h.embodiedGuidance, beat).toBe(STORY_BEAT_ORDER.indexOf(beat) >= embodiedFrom);
      expect(h.earlyTouchDpad, beat).toBe(EARLY_TOUCH_DPAD_BEATS.has(beat));
      expect(h.externalCamera, beat).toBe(EXTERNAL_CAMERA_BEATS.has(beat));
    }
  });

  it('only chapter 10 opens by reactivation', () => {
    for (const beat of ALL) {
      expect(getBeatContract(beat)!.entry, beat).toBe(beat === 'ch10-cold' ? 'reactivation-from-done' : 'sequence');
    }
  });
});
