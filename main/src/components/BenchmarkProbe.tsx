import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

export interface BenchmarkSample {
  fps: number;
  p50: number; // median frame time (ms)
  p95: number; // 95th percentile frame time (ms)
  drawCalls: number;
  triangles: number;
  profile: string;
}

interface BenchmarkProbeProps {
  /** Frames per measurement window. */
  windowFrames?: number;
  profile?: string;
  onSample?: (sample: BenchmarkSample) => void;
  /** Also console.log each sample as JSON (for diffing phases). */
  log?: boolean;
}

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.floor((p / 100) * sortedAsc.length));
  return sortedAsc[idx];
}

/**
 * In-canvas frame-time / draw-call probe. Deterministic comparison procedure:
 * fixed seed (TERRAIN_SEEDS.DEFAULT) + stand at spawn + read the window after it
 * settles. Reports p50/p95 frame time (ms), draw calls and triangles per window.
 */
export default function BenchmarkProbe({
  windowFrames = 120,
  profile = 'HIGH',
  onSample,
  log = true
}: BenchmarkProbeProps) {
  const gl = useThree(state => state.gl);
  const samples = useRef<number[]>([]);
  const last = useRef<number>(0);

  useFrame(() => {
    const now = performance.now();
    if (last.current !== 0) {
      samples.current.push(now - last.current);
    }
    last.current = now;

    if (samples.current.length >= windowFrames) {
      const sorted = [...samples.current].sort((a, b) => a - b);
      const p50 = percentile(sorted, 50);
      const p95 = percentile(sorted, 95);
      const mean = sorted.reduce((s, v) => s + v, 0) / sorted.length;
      const sample: BenchmarkSample = {
        fps: Math.round(1000 / mean),
        p50: Number(p50.toFixed(2)),
        p95: Number(p95.toFixed(2)),
        drawCalls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        profile
      };
      if (log) console.log('[bench]', JSON.stringify(sample));
      onSample?.(sample);
      samples.current.length = 0;
    }
  });

  return null;
}
