import { describe, expect, it } from 'vitest';
import chapterRegistry from '../../chapter-registry.json';
import type { StoryBeat } from './storyState.ts';
import {
  classifyStoryObjectiveGuidanceBeat,
  DEFAULT_STORY_OBJECTIVE_GUIDANCE_FACTS,
  resolveStoryObjectiveGuidance,
  STORY_OBJECTIVE_GUIDANCE_CLASSIFICATION,
  type StoryObjectiveGuidanceFacts
} from './storyObjectiveGuidance.ts';

const CINEMATIC_BEATS = [
  'a1-ramp',
  'a2-awakening',
  'ch3-dusk',
  'a3-dawn',
  'ch4-arrival',
  'a4-exhale'
] as const satisfies readonly StoryBeat[];

const AUTHORED_CHAPTERS = new Set(['ch1', 'ch2', 'ch3', 'ch4', 'ch8']);

function resolve(
  beat: StoryBeat,
  facts: Readonly<Partial<StoryObjectiveGuidanceFacts>> = {}
) {
  return resolveStoryObjectiveGuidance(beat, facts);
}

function requiredAuthoredObjectiveBeats(): StoryBeat[] {
  return chapterRegistry.chapters
    .filter(chapter => AUTHORED_CHAPTERS.has(chapter.id))
    .flatMap(chapter => chapter.acceptance.requiredObjectiveBeats as StoryBeat[]);
}

describe('story objective guidance authoring', () => {
  it('covers every required objective beat in the chapter registry', () => {
    const requiredBeats = requiredAuthoredObjectiveBeats();

    expect(requiredBeats.length).toBeGreaterThan(0);
    for (const beat of requiredBeats) {
      expect(classifyStoryObjectiveGuidanceBeat(beat), beat).toBe('objective');
      expect(resolve(beat), beat).not.toBeNull();
    }

    const ids = requiredBeats.map(beat => resolve(beat)!.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('classifies exactly the registry objectives plus the intentional cinematics', () => {
    const expected = new Set<StoryBeat>([
      ...requiredAuthoredObjectiveBeats(),
      ...CINEMATIC_BEATS
    ]);
    expect(new Set(Object.keys(STORY_OBJECTIVE_GUIDANCE_CLASSIFICATION))).toEqual(expected);
  });

  it('classifies every excluded transition as an intentional cinematic null', () => {
    for (const beat of CINEMATIC_BEATS) {
      expect(classifyStoryObjectiveGuidanceBeat(beat), beat).toBe('cinematic');
      expect(resolve(beat), beat).toBeNull();
    }
    expect(Object.values(STORY_OBJECTIVE_GUIDANCE_CLASSIFICATION).filter(
      disposition => disposition === 'cinematic'
    )).toHaveLength(CINEMATIC_BEATS.length);
  });

  it('does not replace existing Ch5-Ch7 objective ownership', () => {
    for (const beat of ['ch5-maw', 'ch6-dive', 'ch7-reconstruct', 'ch7-board'] as const) {
      expect(classifyStoryObjectiveGuidanceBeat(beat)).toBe('outside-scope');
      expect(resolve(beat)).toBeNull();
    }
  });

  it('changes identity when anomaly calibration becomes a marked interaction', () => {
    const calibration = resolve('ch1-anomaly', { anomalyDesignated: false })!;
    const designation = resolve('ch1-anomaly', { anomalyDesignated: true })!;

    expect(calibration.id).not.toBe(designation.id);
    expect(calibration.requiresMarker).toBe(false);
    expect(designation).toMatchObject({
      markerLabel: 'UNCHARTED MASS',
      requiresMarker: true
    });
  });

  it('keeps triangulation identity and label on the same bounded waypoint fact', () => {
    expect(resolve('ch1-nav', { navWaypointIndex: 1, navWaypointCount: 3 })).toMatchObject({
      id: 'ch1:nav:triangulation-2-of-3',
      markerLabel: 'TRIANGULATION 2/3'
    });
    expect(resolve('ch1-nav', { navWaypointIndex: 99, navWaypointCount: 3 })).toMatchObject({
      id: 'ch1:nav:triangulation-3-of-3',
      markerLabel: 'TRIANGULATION 3/3'
    });
  });

  it('authors the complete branch-aware gather chain with distinct actions', () => {
    const stages = ['materials', 'hatchet', 'pickaxe', 'flint', 'biofuel', 'campfire'] as const;
    const objectives = stages.map(gatherStage => resolve('ch3-gather', { gatherStage })!);

    expect(new Set(objectives.map(entry => entry.id)).size).toBe(stages.length);
    expect(objectives.map(entry => entry.requiresMarker)).toEqual([
      true,
      false,
      false,
      true,
      false,
      false
    ]);
    const finalObjective = objectives[objectives.length - 1];
    expect(finalObjective?.workOrder[finalObjective.workOrder.length - 1]).toContain('[C]');
  });

  it('changes the fire objective when waiting becomes an available rest action', () => {
    const waiting = resolve('ch3-await-rest', { restPhase: 'wait-for-night' })!;
    const ready = resolve('ch3-await-rest', { restPhase: 'rest-at-fire' })!;

    expect(waiting.id).not.toBe(ready.id);
    expect(waiting.markerLabel).toContain('CAMPFIRE');
    expect(ready.workOrder[ready.workOrder.length - 1]).toContain('[F]');
  });

  it('distinguishes finding, eating, and settling the first meal', () => {
    const find = resolve('ch3-forage')!;
    const eat = resolve('ch3-forage', { forageHasEdible: true })!;
    const settle = resolve('ch3-forage', { forageHasEdible: true, forageAte: true })!;

    expect(new Set([find.id, eat.id, settle.id]).size).toBe(3);
    expect(find).toMatchObject({ requiresMarker: true, kind: 'travel' });
    expect(find.workOrder[find.workOrder.length - 1]).toBe('WALK THROUGH THE FRUIT TO GATHER IT.');
    expect(eat).toMatchObject({ requiresMarker: false, kind: 'interact' });
    expect(settle).toMatchObject({ requiresMarker: false, kind: 'wait' });
  });

  it('authors each vigil, audit, compliance, and refusal handoff as a new identity', () => {
    const families = [
      ['ch4-vigil', 'vigilPhase', ['remain-at-wreck', 'observe-sky', 'rest-at-fire']],
      ['ch4-audit', 'auditStage', ['fire', 'life', 'tree', 'complete']],
      ['ch4-comply', 'complianceStage', ['fire', 'organics', 'complete']],
      ['ch4-defy', 'defianceStage', ['test-maw', 'refuse', 'complete']]
    ] as const;

    for (const [beat, fact, states] of families) {
      const ids = states.map(state => resolve(beat, { [fact]: state })!.id);
      expect(new Set(ids).size, `${beat}:${fact}`).toBe(states.length);
    }

    expect(resolve('ch4-vigil', { vigilPhase: 'observe-sky' })?.requiresMarker).toBe(false);
    const refusal = resolve('ch4-defy', { defianceStage: 'refuse' });
    expect(refusal?.workOrder[refusal.workOrder.length - 1]).toContain('[F]');
  });

  it('authors launch, crossing, and landfall from explicit flight facts', () => {
    const launch = ['surface-on-foot', 'surface-flight', 'launching', 'deep-space'] as const;
    const crossing = ['acquire-sibling', 'hold-course', 'approach-envelope'] as const;
    const landfall = ['descent', 'surface-flight', 'surface-fps'] as const;

    const launchObjectives = launch.map(ch8LaunchState => resolve('ch8-launch', { ch8LaunchState })!);
    const crossingObjectives = crossing.map(ch8CrossingState => resolve('ch8-crossing', { ch8CrossingState })!);
    const landfallObjectives = landfall.map(ch8LandfallState => resolve('ch8-landfall', { ch8LandfallState })!);

    for (const objectives of [launchObjectives, crossingObjectives, landfallObjectives]) {
      expect(new Set(objectives.map(entry => entry.id)).size).toBe(objectives.length);
    }
    expect(launchObjectives.map(entry => entry.requiresMarker)).toEqual([true, false, false, false]);
    expect(crossingObjectives.map(entry => entry.requiresMarker)).toEqual([true, true, false]);
    expect(landfallObjectives.map(entry => entry.requiresMarker)).toEqual([false, false, false]);
  });

  it('returns complete actionable contracts for every default objective beat', () => {
    const objectiveBeats = Object.entries(STORY_OBJECTIVE_GUIDANCE_CLASSIFICATION)
      .filter(([, disposition]) => disposition === 'objective')
      .map(([beat]) => beat as StoryBeat);

    for (const beat of objectiveBeats) {
      const guidance = resolve(beat, DEFAULT_STORY_OBJECTIVE_GUIDANCE_FACTS);
      expect(guidance, beat).not.toBeNull();
      expect(guidance!.id.trim(), beat).not.toBe('');
      expect(guidance!.markerLabel.trim(), beat).not.toBe('');
      expect(guidance!.workOrder.length, beat).toBeGreaterThan(0);
      expect(guidance!.workOrder.every(line => line.trim().length > 0), beat).toBe(true);
      expect(typeof guidance!.requiresMarker, beat).toBe('boolean');
    }
  });
});
