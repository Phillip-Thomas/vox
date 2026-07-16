import { describe, expect, it } from 'vitest';
import {
  compileSceneAvContract,
  sampleSceneAvRail,
  SceneAvCueRailRuntime,
  type SceneAvContract
} from './sceneAvCueRail.ts';

function contract(): SceneAvContract {
  return {
    sceneId: 'ch5-maw',
    revision: 'contract-1',
    anchors: [
      { id: 'repair-start', timeSeconds: 2 },
      { id: 'core-wakes', timeSeconds: 6 }
    ],
    cues: [
      {
        id: 'repair-fov',
        channel: 'fov',
        owner: 'cinematography',
        anchorId: 'repair-start',
        durationSeconds: 2,
        from: 75,
        to: 52,
        reducedMotion: { from: 58, to: 58 }
      },
      {
        id: 'core-bloom',
        channel: 'bloom',
        owner: 'score',
        anchorId: 'core-wakes',
        durationSeconds: 1,
        from: 0,
        to: 0.8,
        noPostProcessFallback: { kind: 'emissive_pulse', targetId: 'maw-core' }
      }
    ]
  };
}

describe('scene AV cue rail', () => {
  it('compiles signed anchors into one deterministic timeline', () => {
    const rail = compileSceneAvContract(contract());
    expect(rail).toMatchObject({ sceneId: 'ch5-maw', revision: 'contract-1' });
    expect(rail.cues.map(cue => [cue.id, cue.startSeconds, cue.endSeconds])).toEqual([
      ['repair-fov', 2, 4],
      ['core-bloom', 6, 7]
    ]);
  });

  it('samples the same score timestamp for post FX and its low-tier fallback', () => {
    const rail = compileSceneAvContract(contract());
    expect(sampleSceneAvRail(rail, 6.5).bloom).toMatchObject({
      cueId: 'core-bloom',
      owner: 'score',
      amount: 0.4
    });
    expect(sampleSceneAvRail(rail, 6.5, { postProcessAvailable: false }).bloom).toMatchObject({
      fallback: { kind: 'emissive_pulse', targetId: 'maw-core' }
    });
  });

  it('preserves the meaning with a reduced-motion realization', () => {
    const rail = compileSceneAvContract(contract());
    expect(sampleSceneAvRail(rail, 3, { reducedMotion: true }).fov?.amount).toBe(58);
  });

  it('rejects overlapping writers on an audiovisual channel', () => {
    const invalid = contract();
    invalid.cues.push({
      id: 'competing-fov',
      channel: 'fov',
      owner: 'story',
      anchorId: 'repair-start',
      offsetSeconds: 1,
      durationSeconds: 2,
      from: 60,
      to: 50
    });
    expect(() => compileSceneAvContract(invalid)).toThrow(/overlapping owners\/cues/);
  });

  it('rejects meaningful bloom without a non-composer fallback', () => {
    const invalid = contract();
    delete invalid.cues[1]?.noPostProcessFallback;
    expect(() => compileSceneAvContract(invalid)).toThrow(/no-postprocess fallback/);
  });

  it('resets every cue owner at the scene boundary', () => {
    const runtime = new SceneAvCueRailRuntime();
    runtime.load(contract());
    expect(runtime.identity()).toEqual({ sceneId: 'ch5-maw', revision: 'contract-1' });
    runtime.reset();
    expect(runtime.identity()).toBeNull();
    expect(runtime.sample(3)).toEqual({});
  });
});
