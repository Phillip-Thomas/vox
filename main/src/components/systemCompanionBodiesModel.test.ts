import { describe, expect, it } from 'vitest';
import {
  buildCompanionBodyModels,
  companionVisualBudget,
  createCompanionSurfaceGeometry
} from './systemCompanionBodiesModel.ts';

describe('system companion body model', () => {
  it('returns no sibling for authored one-body systems and at most two otherwise', () => {
    expect(buildCompanionBodyModels({
      coordinate: { x: 4, y: -2 },
      forceSingleBody: true
    })).toEqual([]);

    const companions = buildCompanionBodyModels({
      coordinate: { x: 4, y: -2 },
      bodyCountOverride: 3
    });
    expect(companions).toHaveLength(2);
    expect(companions.every(body => body.descriptor.address.slot !== 0)).toBe(true);
    expect(companions.every(body => body.descriptor.terrainQuaternion.join(',') === '0,0,0,1')).toBe(true);
  });

  it('resolves physical positions relative to any active planet', () => {
    const fromPrimary = buildCompanionBodyModels({
      coordinate: { x: 7, y: 9 },
      activePlanetSlot: 0,
      bodyCountOverride: 3
    });
    const fromCompanion = buildCompanionBodyModels({
      coordinate: { x: 7, y: 9 },
      activePlanetSlot: 1,
      bodyCountOverride: 3
    });

    expect(fromPrimary).toHaveLength(2);
    expect(fromCompanion).toHaveLength(2);
    const primarySeenFromP1 = fromCompanion.find(body => body.descriptor.address.slot === 0);
    expect(primarySeenFromP1?.relativePosition).toEqual(
      fromPrimary[0].relativePosition.map(value => -value)
    );
  });

  it('reduces tessellation and secondary shells monotonically by quality', () => {
    const ultra = companionVisualBudget('ULTRA');
    const high = companionVisualBudget('HIGH');
    const medium = companionVisualBudget('MEDIUM');
    const low = companionVisualBudget('LOW');
    const potato = companionVisualBudget('POTATO');

    expect([
      ultra.surfaceSubdivisions,
      high.surfaceSubdivisions,
      medium.surfaceSubdivisions,
      low.surfaceSubdivisions,
      potato.surfaceSubdivisions
    ]).toEqual([20, 16, 12, 8, 4]);
    expect(ultra.separateCloudShell).toBe(true);
    expect(high.separateCloudShell).toBe(true);
    expect(medium.separateCloudShell).toBe(false);
    expect(potato.ringSegments).toBeLessThan(low.ringSegments);
  });

  it('builds finite colored dominant-face geometry rather than a sphere', () => {
    const geometry = createCompanionSurfaceGeometry(1609750163, 8);
    const position = geometry.getAttribute('position');
    const color = geometry.getAttribute('color');
    const index = geometry.getIndex();
    let minRadius = Infinity;
    let maxRadius = 0;

    for (let vertex = 0; vertex < position.count; vertex++) {
      const x = position.getX(vertex);
      const y = position.getY(vertex);
      const z = position.getZ(vertex);
      expect(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)).toBe(true);
      const radius = Math.hypot(x, y, z);
      minRadius = Math.min(minRadius, radius);
      maxRadius = Math.max(maxRadius, radius);
    }

    expect(position.count).toBe(6 * 9 * 9);
    expect(color.count).toBe(position.count);
    expect(index?.count).toBe(6 * 8 * 8 * 6);
    expect(maxRadius / minRadius).toBeGreaterThan(1.45);
    expect(geometry.boundingSphere?.radius).toBeGreaterThan(1.6);
    geometry.dispose();
  });
});
