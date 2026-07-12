import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { getWarp } from '../state/spaceFlight.ts';
import { getSystemFlightSnapshot } from '../state/systemFlight.ts';

export interface SystemProbeWindow {
  capturedAt: number;
  frames: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxFrameGapMs: number;
  longFrameCount: number;
  drawCalls: number;
  triangles: number;
  programs: number;
  geometries: number;
  textures: number;
  usedJsHeapBytes: number | null;
}

export interface SystemProbeContext {
  systemId: string;
  activeWorldId: string;
  bodyIds: string[];
  activeFullWorldCount: number;
  locationMode: string;
  profile: string;
}

export interface SystemProbeSnapshot {
  enabled: true;
  startedAt: number;
  context: SystemProbeContext;
  canonicalFlight: {
    systemId: string;
    activePlanetId: string | null;
    locationMode: string;
    position: number[];
    velocity: number[];
    quaternion: number[];
    renderOrigin: number[];
    activationEpoch: number;
    target: string | null;
  };
  warp: {
    active: boolean;
    kind: string;
    progress: number;
    intensity: number;
    midpointFired: boolean;
  };
  windows: SystemProbeWindow[];
  observedLongTasks: number;
  maxObservedLongTaskMs: number;
}

export interface SystemProbeBridge {
  getSnapshot(): SystemProbeSnapshot;
  clear(): void;
}

declare global {
  interface Window {
    __paravoxiaSystemProbe?: SystemProbeBridge;
  }
}

interface SystemTravelProbeProps extends SystemProbeContext {
  windowFrames?: number;
  maxWindows?: number;
}

interface ChromiumPerformance extends Performance {
  memory?: {
    usedJSHeapSize?: number;
  };
}

function probeEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('systemprobe') === '1';
}

function percentile(sorted: number[], value: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * value));
  return sorted[index];
}

function rounded(value: number): number {
  return Number(value.toFixed(3));
}

export default function SystemTravelProbe({
  systemId,
  activeWorldId,
  bodyIds,
  activeFullWorldCount,
  locationMode,
  profile,
  windowFrames = 180,
  maxWindows = 20
}: SystemTravelProbeProps) {
  const gl = useThree(state => state.gl);
  const enabled = useRef(probeEnabled()).current;
  const startedAt = useRef(typeof performance === 'undefined' ? Date.now() : performance.now());
  const frameTimes = useRef<number[]>([]);
  const windows = useRef<SystemProbeWindow[]>([]);
  const previousFrameAt = useRef(0);
  const longTasks = useRef(0);
  const maxLongTaskMs = useRef(0);
  const contextRef = useRef<SystemProbeContext>({
    systemId,
    activeWorldId,
    bodyIds: [...bodyIds],
    activeFullWorldCount,
    locationMode,
    profile
  });

  contextRef.current = {
    systemId,
    activeWorldId,
    bodyIds: [...bodyIds],
    activeFullWorldCount,
    locationMode,
    profile
  };

  useEffect(() => {
    if (!enabled) return undefined;

    const getSnapshot = (): SystemProbeSnapshot => {
      const flight = getSystemFlightSnapshot();
      const warp = getWarp();
      return {
        enabled: true,
        startedAt: startedAt.current,
        context: {
          ...contextRef.current,
          bodyIds: [...contextRef.current.bodyIds]
        },
        canonicalFlight: {
          systemId: flight.systemId,
          activePlanetId: flight.activePlanetId,
          locationMode: flight.locationMode,
          position: [...flight.pose.position],
          velocity: [...flight.pose.velocity],
          quaternion: [...flight.pose.quaternion],
          renderOrigin: [...flight.renderOrigin],
          activationEpoch: flight.activationEpoch,
          target: flight.target?.kind === 'system_body'
            ? flight.target.worldId
            : flight.target?.systemId ?? null
        },
        warp: {
          active: warp.active,
          kind: warp.kind,
          progress: rounded(warp.progress),
          intensity: rounded(warp.intensity),
          midpointFired: warp.midpointFired
        },
        windows: windows.current.map(window => ({ ...window })),
        observedLongTasks: longTasks.current,
        maxObservedLongTaskMs: rounded(maxLongTaskMs.current)
      };
    };

    const bridge: SystemProbeBridge = {
      getSnapshot,
      clear: () => {
        frameTimes.current.length = 0;
        windows.current.length = 0;
        previousFrameAt.current = 0;
        longTasks.current = 0;
        maxLongTaskMs.current = 0;
        startedAt.current = performance.now();
      }
    };
    window.__paravoxiaSystemProbe = bridge;

    let observer: PerformanceObserver | null = null;
    if (typeof PerformanceObserver !== 'undefined') {
      try {
        observer = new PerformanceObserver(list => {
          for (const entry of list.getEntries()) {
            longTasks.current += 1;
            maxLongTaskMs.current = Math.max(maxLongTaskMs.current, entry.duration);
          }
        });
        observer.observe({ entryTypes: ['longtask'] });
      } catch {
        observer = null;
      }
    }

    return () => {
      observer?.disconnect();
      if (window.__paravoxiaSystemProbe === bridge) {
        delete window.__paravoxiaSystemProbe;
      }
    };
  }, [enabled]);

  useFrame(() => {
    if (!enabled) return;
    const now = performance.now();
    if (previousFrameAt.current > 0) {
      frameTimes.current.push(now - previousFrameAt.current);
    }
    previousFrameAt.current = now;
    if (frameTimes.current.length < windowFrames) return;

    const sorted = [...frameTimes.current].sort((a, b) => a - b);
    const memory = (performance as ChromiumPerformance).memory;
    const renderer = gl.info;
    const sample: SystemProbeWindow = {
      capturedAt: rounded(now),
      frames: sorted.length,
      p50Ms: rounded(percentile(sorted, 0.5)),
      p95Ms: rounded(percentile(sorted, 0.95)),
      p99Ms: rounded(percentile(sorted, 0.99)),
      maxFrameGapMs: rounded(sorted[sorted.length - 1] ?? 0),
      longFrameCount: sorted.filter(value => value >= 50).length,
      drawCalls: renderer.render.calls,
      triangles: renderer.render.triangles,
      programs: renderer.programs?.length ?? 0,
      geometries: renderer.memory.geometries,
      textures: renderer.memory.textures,
      usedJsHeapBytes: typeof memory?.usedJSHeapSize === 'number'
        ? memory.usedJSHeapSize
        : null
    };

    windows.current.push(sample);
    if (windows.current.length > maxWindows) windows.current.shift();
    frameTimes.current.length = 0;
  });

  return null;
}
