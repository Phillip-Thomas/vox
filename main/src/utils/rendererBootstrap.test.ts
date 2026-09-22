import { describe, expect, it, vi } from 'vitest';
import { createGameRenderer, GAME_CONTEXT_ATTRIBUTES, waitForGpuStartup } from './rendererBootstrap.ts';
type RendererFactoryProps = Parameters<typeof createGameRenderer>[0];

vi.mock('three', () => ({ WebGLRenderer: class {
  constructor(public parameters: unknown) {}
} }));

function gpu(statuses = [1]) {
  const fence = {} as WebGLSync;
  return {
    SYNC_GPU_COMMANDS_COMPLETE: 5, ALREADY_SIGNALED: 0, CONDITION_SATISFIED: 1, TIMEOUT_EXPIRED: 2, WAIT_FAILED: 3,
    fenceSync: vi.fn(() => fence), flush: vi.fn(), deleteSync: vi.fn(), isContextLost: vi.fn(() => false),
    clientWaitSync: vi.fn(() => statuses.shift() ?? 2)
  };
}
const context = (value: ReturnType<typeof gpu>) => value as unknown as WebGL2RenderingContext;
function clock() {
  let time = 0;
  return { now: () => time, yieldControl: vi.fn(async () => { time += 10; }), timeoutMs: 40 };
}

describe('renderer GPU bootstrap', () => {
  it('submits a fence and yields before polling with zero timeout', async () => {
    const gl = gpu([2, 2, 1]), timing = clock();
    const result = await waitForGpuStartup(context(gl), timing);
    expect(result).toEqual({ outcome: 'ready', startedAt: 0, elapsedMs: 30, polls: 3 });
    expect(gl.fenceSync).toHaveBeenCalledWith(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    expect(gl.flush).toHaveBeenCalledOnce();
    expect(gl.clientWaitSync.mock.calls).toEqual(Array.from({ length: 3 }, () => [gl.fenceSync.mock.results[0].value, 0, 0]));
    expect(timing.yieldControl.mock.invocationCallOrder[0]).toBeLessThan(gl.clientWaitSync.mock.invocationCallOrder[0]);
    expect(gl.deleteSync).toHaveBeenCalledWith(gl.fenceSync.mock.results[0].value);
  });

  it('bounds a pending fence and deletes it on timeout', async () => {
    const gl = gpu([]);
    expect(await waitForGpuStartup(context(gl), clock())).toMatchObject({ outcome: 'timeout', elapsedMs: 40, polls: 3 });
    expect(gl.deleteSync).toHaveBeenCalledOnce();
  });

  it('cancels before submitting work or deletes its pending fence when cancelled', async () => {
    const before = gpu();
    expect(await waitForGpuStartup(context(before), { ...clock(), isCancelled: () => true })).toMatchObject({ outcome: 'cancelled', polls: 0 });
    expect(before.fenceSync).not.toHaveBeenCalled();
    const pending = gpu([]), timing = clock();
    expect(await waitForGpuStartup(context(pending), { ...timing, isCancelled: () => timing.now() >= 10 })).toMatchObject({ outcome: 'cancelled', polls: 0 });
    expect(pending.deleteSync).toHaveBeenCalledOnce();
  });

  it('cleans up if the context is lost or a query fails', async () => {
    const lost = gpu(); lost.isContextLost.mockReturnValueOnce(false).mockReturnValue(true);
    expect(await waitForGpuStartup(context(lost), clock())).toMatchObject({ outcome: 'context-lost', polls: 0 });
    expect(lost.deleteSync).toHaveBeenCalledOnce();
    const failed = gpu([3]);
    expect(await waitForGpuStartup(context(failed), clock())).toMatchObject({ outcome: 'failed', polls: 1 });
    expect(failed.deleteSync).toHaveBeenCalledOnce();
  });

  it('cleans up its fence while preserving thrown errors', async () => {
    const gl = gpu(); gl.clientWaitSync.mockImplementation(() => { throw new Error('driver failure'); });
    await expect(waitForGpuStartup(context(gl), clock())).rejects.toThrow('driver failure');
    expect(gl.deleteSync).toHaveBeenCalledOnce();
    const flushFailure = gpu(); flushFailure.flush.mockImplementation(() => { throw new Error('flush failure'); });
    await expect(waitForGpuStartup(context(flushFailure), clock())).rejects.toThrow('flush failure');
    expect(flushFailure.deleteSync).toHaveBeenCalledOnce();
  });

  it('leaves WebGL1 and unavailable fences on the normal renderer path', async () => {
    expect(await waitForGpuStartup({ isContextLost: () => false } as WebGLRenderingContext, clock())).toMatchObject({ outcome: 'unsupported', polls: 0 });
    const gl = gpu(); gl.fenceSync.mockReturnValue(null as never);
    expect(await waitForGpuStartup(context(gl), clock())).toMatchObject({ outcome: 'unavailable', polls: 0 });
    expect(gl.deleteSync).not.toHaveBeenCalled();
    expect(gl.flush).not.toHaveBeenCalled();
  });

  it('preserves the actual canvas, context attributes and renderer parameters', async () => {
    const gl = gpu();
    const canvas = { getContext: vi.fn(() => gl) };
    const renderer = await createGameRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' } as unknown as RendererFactoryProps);
    expect(canvas.getContext).toHaveBeenCalledExactlyOnceWith('webgl2', GAME_CONTEXT_ATTRIBUTES);
    expect((renderer as unknown as { parameters: unknown }).parameters).toEqual({ canvas, context: gl, ...GAME_CONTEXT_ATTRIBUTES });
    expect(GAME_CONTEXT_ATTRIBUTES).toEqual({ antialias: false, alpha: false, depth: true, stencil: false, premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: false });
  });

  it('retains WebGL1 fallback ordering', async () => {
    const gl = { isContextLost: () => false };
    const canvas = { getContext: vi.fn().mockReturnValueOnce(null).mockReturnValueOnce(gl) };
    const renderer = await createGameRenderer({ canvas } as unknown as RendererFactoryProps);
    expect(canvas.getContext.mock.calls.map(call => call[0])).toEqual(['webgl2', 'webgl']);
    expect((renderer as unknown as { parameters: { context: unknown } }).parameters.context).toBe(gl);
  });
});
