import type { QualityProfile } from '../config/graphicsSettings.ts';
import type { ArchetypeId } from '../game/data/planetArchetypes.ts';

export interface AtlasSceneLayerCounts {
  voxels?: number;
  grass?: number;
  trees?: number;
  flora?: number;
  fauna?: number;
  water?: number;
  surfaceEffects?: number;
  stones?: number;
  meshes?: number;
  instancedMeshes?: number;
  [key: string]: number | undefined;
}

export interface AtlasSceneMetrics {
  fps: number;
  p50: number;
  p95: number;
  drawCalls: number;
  triangles: number;
  materialCount?: number;
  programCount?: number;
  layerCounts?: AtlasSceneLayerCounts;
}

export interface AtlasPixelStats {
  averageLuma: number;
  lumaP05: number;
  lumaP95: number;
  averageSaturation: number;
  dominantHueCoverage: number;
  sampledPixels: number;
}

export interface AtlasCaseSummary {
  archetype: ArchetypeId;
  quality: QualityProfile;
  metrics: AtlasSceneMetrics;
  pixels?: AtlasPixelStats | null;
  expectedRichEcology?: boolean;
}

export interface AtlasDefect {
  code:
    | 'low_fps'
    | 'slow_p95'
    | 'too_many_draw_calls'
    | 'too_many_triangles'
    | 'shader_explosion'
    | 'blank_frame'
    | 'low_contrast'
    | 'accent_overload'
    | 'empty_ecology';
  severity: 'low' | 'medium' | 'high';
  message: string;
}

interface PerfBudget {
  p95: number;
  fps: number;
  drawCalls: number;
  triangles: number;
  programs: number;
}

export const ATLAS_PERF_BUDGETS: Record<QualityProfile, PerfBudget> = {
  ULTRA: { p95: 28, fps: 45, drawCalls: 560, triangles: 9200000, programs: 54 },
  HIGH: { p95: 24, fps: 50, drawCalls: 440, triangles: 4200000, programs: 46 },
  MEDIUM: { p95: 28, fps: 45, drawCalls: 320, triangles: 1500000, programs: 34 },
  LOW: { p95: 24, fps: 50, drawCalls: 220, triangles: 1000000, programs: 36 },
  POTATO: { p95: 20, fps: 55, drawCalls: 140, triangles: 800000, programs: 20 }
};

export function detectAtlasDefects(summary: AtlasCaseSummary): AtlasDefect[] {
  const defects: AtlasDefect[] = [];
  const budget = ATLAS_PERF_BUDGETS[summary.quality];
  const metrics = summary.metrics;
  if (metrics.fps > 0 && metrics.fps < budget.fps) {
    defects.push({ code: 'low_fps', severity: summary.quality === 'POTATO' ? 'high' : 'medium', message: `${summary.quality} fps ${metrics.fps} below ${budget.fps}` });
  }
  if (metrics.p95 > budget.p95) {
    defects.push({ code: 'slow_p95', severity: metrics.p95 > budget.p95 * 1.35 ? 'high' : 'medium', message: `${summary.quality} p95 ${metrics.p95}ms above ${budget.p95}ms` });
  }
  if (metrics.drawCalls > budget.drawCalls) {
    defects.push({ code: 'too_many_draw_calls', severity: 'medium', message: `${metrics.drawCalls} draw calls above ${budget.drawCalls}` });
  }
  if (metrics.triangles > budget.triangles) {
    defects.push({ code: 'too_many_triangles', severity: 'medium', message: `${metrics.triangles} triangles above ${budget.triangles}` });
  }
  if ((metrics.programCount ?? 0) > budget.programs) {
    defects.push({ code: 'shader_explosion', severity: 'high', message: `${metrics.programCount} shader/material programs above ${budget.programs}` });
  }
  const pixels = summary.pixels;
  if (pixels) {
    if (pixels.sampledPixels < 1 || pixels.lumaP95 - pixels.lumaP05 < 0.04) {
      defects.push({ code: 'blank_frame', severity: 'high', message: 'screenshot has too little measurable visual signal' });
    } else if (pixels.lumaP95 - pixels.lumaP05 < 0.16) {
      defects.push({ code: 'low_contrast', severity: 'medium', message: `luma spread ${(pixels.lumaP95 - pixels.lumaP05).toFixed(3)} is low` });
    }
    if (pixels.dominantHueCoverage > 0.68 && pixels.averageSaturation > 0.48) {
      defects.push({ code: 'accent_overload', severity: 'medium', message: `dominant hue covers ${(pixels.dominantHueCoverage * 100).toFixed(1)}% at high saturation` });
    }
  }
  if (summary.expectedRichEcology && summary.quality !== 'POTATO') {
    const layers = metrics.layerCounts ?? {};
    const organicCount = (layers.grass ?? 0) + (layers.trees ?? 0) + (layers.flora ?? 0) + (layers.fauna ?? 0);
    if (organicCount <= 0) {
      defects.push({ code: 'empty_ecology', severity: 'high', message: `${summary.archetype} expected ecology but no organic layers were counted` });
    }
  }
  return defects;
}

export function summarizeAtlasDefects(cases: AtlasCaseSummary[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const summary of cases) {
    for (const defect of detectAtlasDefects(summary)) {
      counts[defect.code] = (counts[defect.code] ?? 0) + 1;
    }
  }
  return counts;
}
