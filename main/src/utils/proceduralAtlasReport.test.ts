import { describe, expect, it } from 'vitest';
import { detectAtlasDefects, summarizeAtlasDefects, type AtlasCaseSummary } from './proceduralAtlasReport.ts';

const healthy: AtlasCaseSummary = {
  archetype: 'verdant',
  quality: 'HIGH',
  expectedRichEcology: true,
  metrics: {
    fps: 58,
    p50: 15,
    p95: 20,
    drawCalls: 180,
    triangles: 500000,
    materialCount: 18,
    programCount: 18,
    layerCounts: { grass: 3200, trees: 60, flora: 120, fauna: 12 }
  },
  pixels: {
    averageLuma: 0.42,
    lumaP05: 0.12,
    lumaP95: 0.82,
    averageSaturation: 0.34,
    dominantHueCoverage: 0.31,
    sampledPixels: 2048
  }
};

describe('procedural atlas report flags', () => {
  it('does not flag a healthy case', () => {
    expect(detectAtlasDefects(healthy)).toEqual([]);
  });

  it('flags performance, blankness, shader, accent, and ecology defects', () => {
    const defects = detectAtlasDefects({
      ...healthy,
      metrics: {
        fps: 20,
        p50: 35,
        p95: 60,
        drawCalls: 900,
        triangles: 5200000,
        programCount: 80,
        layerCounts: {}
      },
      pixels: {
        averageLuma: 0.5,
        lumaP05: 0.49,
        lumaP95: 0.5,
        averageSaturation: 0.7,
        dominantHueCoverage: 0.9,
        sampledPixels: 64
      }
    });
    expect(defects.map(defect => defect.code)).toEqual(expect.arrayContaining([
      'low_fps',
      'slow_p95',
      'too_many_draw_calls',
      'too_many_triangles',
      'shader_explosion',
      'blank_frame',
      'empty_ecology'
    ]));
  });

  it('summarizes defects by code', () => {
    const counts = summarizeAtlasDefects([
      healthy,
      { ...healthy, metrics: { ...healthy.metrics, fps: 10, p95: 50 } }
    ]);
    expect(counts.low_fps).toBe(1);
    expect(counts.slow_p95).toBe(1);
  });
});
