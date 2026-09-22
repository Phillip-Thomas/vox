import { WebGLRenderer, type WebGLRendererParameters } from 'three';
import type { CanvasProps } from '@react-three/fiber';
import { measureWarpMetric } from './warpMetrics.ts';

type FunctionArgument<T> = T extends (props: infer P) => unknown ? P : never;
type RendererFactoryProps = FunctionArgument<CanvasProps['gl']>;

// These are the existing Canvas options plus the unchanged Three r160 defaults
// passed to getContext. Creating the context separately must not change its mode.
export const GAME_CONTEXT_ATTRIBUTES: Readonly<WebGLContextAttributes> = Object.freeze({
  antialias: false,
  alpha: false,
  powerPreference: 'high-performance',
  stencil: false,
  depth: true,
  premultipliedAlpha: true,
  preserveDrawingBuffer: false,
  failIfMajorPerformanceCaveat: false
});

interface StartupWaitOptions {
  now?: () => number;
  yieldControl?: () => Promise<void>;
  timeoutMs?: number;
  metricPrefix?: string;
  isCancelled?: () => boolean;
}
export interface StartupWaitResult {
  outcome: 'ready' | 'timeout' | 'context-lost' | 'unsupported' | 'unavailable' | 'failed' | 'cancelled';
  startedAt: number;
  elapsedMs: number;
  polls: number;
}

/** Submit pending GPU work, then poll without blocking the main thread. */
export async function waitForGpuStartup(
  context: WebGLRenderingContext | WebGL2RenderingContext,
  options: StartupWaitOptions = {}
): Promise<StartupWaitResult> {
  const now = options.now ?? (() => performance.now());
  const yieldControl = options.yieldControl ?? (() => new Promise(resolve => setTimeout(resolve, 0)));
  const startedAt = now();
  const deadline = startedAt + (options.timeoutMs ?? 500);
  const metricPrefix = options.metricPrefix ?? 'renderer';
  let polls = 0;
  const result = (outcome: StartupWaitResult['outcome']): StartupWaitResult => ({ outcome, startedAt, elapsedMs: now() - startedAt, polls });
  if (options.isCancelled?.()) return result('cancelled');
  if (context.isContextLost()) return result('context-lost');
  if (!('fenceSync' in context)) return result('unsupported');
  const gl = context as WebGL2RenderingContext;
  const fence = measureWarpMetric(`${metricPrefix}:fence_submit`, () => gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0));
  if (!fence) return result('unavailable');
  try {
    measureWarpMetric(`${metricPrefix}:fence_flush`, () => gl.flush());
    // WebGL fences may only become observable after returning to the event loop.
    while (now() < deadline) {
      await yieldControl();
      if (options.isCancelled?.()) return result('cancelled');
      if (gl.isContextLost()) return result('context-lost');
      if (now() >= deadline) break;
      const status = gl.clientWaitSync(fence, 0, 0);
      polls++;
      if (status === gl.ALREADY_SIGNALED || status === gl.CONDITION_SATISFIED) return result('ready');
      if (status === gl.WAIT_FAILED) return result('failed');
    }
    return result('timeout');
  } finally {
    gl.deleteSync(fence);
  }
}

/** R3F awaits this supported renderer factory before mounting its scene. */
export async function createGameRenderer(defaults: RendererFactoryProps): Promise<WebGLRenderer> {
  const canvas = defaults.canvas as HTMLCanvasElement;
  const parameters: WebGLRendererParameters = { ...defaults, ...GAME_CONTEXT_ATTRIBUTES, canvas };
  const context = measureWarpMetric('renderer:context_create', () => {
    // Preserve Three r160's WebGL2 -> WebGL1 fallback order.
    for (const kind of ['webgl2', 'webgl', 'experimental-webgl']) {
      const candidate = canvas.getContext(kind, GAME_CONTEXT_ATTRIBUTES);
      if (candidate) return candidate as WebGLRenderingContext | WebGL2RenderingContext;
    }
    return null;
  });
  if (context) {
    const wait = await waitForGpuStartup(context);
    measureWarpMetric('renderer:gpu_wait_complete', () => wait, value => ({ ...value }));
    if (wait.outcome !== 'ready' && wait.outcome !== 'unsupported') {
      console.warn('[renderer-bootstrap] GPU startup wait', wait);
    }
    parameters.context = context;
  }
  // No renderer methods, diagnostics, tone mapping or frame semantics are wrapped.
  // If no context exists, Three retains its normal context-creation error path.
  return measureWarpMetric('renderer:three_init', () => new WebGLRenderer(parameters));
}
