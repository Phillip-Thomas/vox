import { afterEach, describe, expect, it } from 'vitest';
import {
  clearVoxelRealityOverrides,
  getVoxelRealityEffects,
  getVoxelRealitySnapshot,
  parseVoxelRealityStage,
  resetVoxelRealityRenderState,
  setVoxelRealityStage,
  subscribeVoxelReality,
  overrideVoxelRealityEffects
} from './realityRenderSystem.ts';

afterEach(() => {
  resetVoxelRealityRenderState();
});

describe('reality render system', () => {
  it('defaults to the current rich voxel look', () => {
    const snapshot = getVoxelRealitySnapshot();
    expect(snapshot.stage).toBe('alive');
    expect(snapshot.effects.chroma).toBe(1);
    expect(snapshot.effects.detail).toBe(1);
    expect(snapshot.effects.organic).toBe(1);
    expect(snapshot.effects.atmosphere).toBe(1);
  });

  it('parses supported story stages and rejects unknown values', () => {
    expect(parseVoxelRealityStage('material')).toBe('material');
    expect(parseVoxelRealityStage('PARADOX')).toBe('paradox');
    expect(parseVoxelRealityStage('mesh')).toBeNull();
    expect(parseVoxelRealityStage(null)).toBeNull();
  });

  it('switches presets without mutating device quality', () => {
    setVoxelRealityStage('bare');
    expect(getVoxelRealityEffects()).toMatchObject({
      chroma: 0,
      detail: 0,
      organic: 0,
      atmosphere: 0,
      thermal: 0,
      crystalline: 0,
      metal: 0
    });

    setVoxelRealityStage('material');
    const material = getVoxelRealityEffects();
    expect(material.detail).toBeGreaterThan(0);
    expect(material.chroma).toBe(1);
    expect(material.detail).toBeLessThan(1);
    expect(material.thermal).toBeGreaterThan(0);
  });

  it('clamps overrides and can clear them', () => {
    overrideVoxelRealityEffects({ atmosphere: 8, metal: -2 });
    expect(getVoxelRealityEffects().atmosphere).toBe(1.5);
    expect(getVoxelRealityEffects().metal).toBe(0);

    clearVoxelRealityOverrides();
    expect(getVoxelRealityEffects().atmosphere).toBe(1);
    expect(getVoxelRealityEffects().metal).toBe(0.86);
  });

  it('notifies subscribers when the story render stage changes', () => {
    const seen: string[] = [];
    const unsubscribe = subscribeVoxelReality(snapshot => seen.push(snapshot.stage));
    setVoxelRealityStage('paradox');
    unsubscribe();
    setVoxelRealityStage('bare');

    expect(seen).toEqual(['paradox']);
  });
});
