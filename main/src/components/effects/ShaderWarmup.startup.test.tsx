import { act } from 'react';
import { readFileSync } from 'node:fs';
import { createRoot, extend, useFrame, type RootStore } from '@react-three/fiber';
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ShaderWarmup, { INITIAL_WARMUP_TIMEOUT_MS, type InitialWarmupOutcome } from './ShaderWarmup.tsx';
import { precompile } from './shaderWarmup.ts';

// Real reconciler/scene/warmup; sceneReady deliberately stays false because it
// requires painted frames. Avoid importing the unrelated story runtime here.
vi.mock('../../state/appState.ts', () => ({ useAppState: () => ({ sceneReady: false }) }));
vi.mock('../../story/storyState.ts', () => ({ useStoryState: () => ({ beat: 'ch4-arrival' }) }));
extend({ Mesh: THREE.Mesh });
const cleanups: Array<() => Promise<void>> = [];
const rafs = new Map<number, FrameRequestCallback>();
let nextRaf = 0;
let visibility: EventTarget & { hidden: boolean };
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  visibility = Object.assign(new EventTarget(), { hidden: false });
  vi.stubGlobal('document', visibility);
  vi.stubGlobal('window', { location: { search: '?systemprobe=1' }, devicePixelRatio: 1,
    requestIdleCallback: (callback: () => void) => setTimeout(callback, 0),
    setTimeout: (callback: () => void, ms: number) => setTimeout(callback, ms) });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { rafs.set(++nextRaf, callback); return nextRaf; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => rafs.delete(id));
});
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  await act(async () => { await vi.advanceTimersByTimeAsync(600); });
  for (const [id, callback] of [...rafs]) { rafs.delete(id); callback(performance.now()); }
  rafs.clear(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks();
});
const tickTimers = async (ms = 20) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
const tickFrame = async () => { await act(async () => {
  for (const [id, callback] of [...rafs]) { rafs.delete(id); callback(performance.now()); }
}); };

async function mount(options: { compile?: () => Promise<void>; gpuReady?: boolean; material?: THREE.Material;
  worldAvailable?: boolean; mountComplete?: boolean } = {}) {
  const canvas = Object.assign(new EventTarget(), { width: 128, height: 128, style: {} }) as unknown as HTMLCanvasElement;
  const order: string[] = [], outcomes: InitialWarmupOutcome[] = [];
  const programs: Array<{ isReady: () => boolean; getUniforms: () => void; getAttributes: () => void }> = [];
  const materials = new Set<THREE.Material>();
  const state = { gpuReady: options.gpuReady ?? true, frames: 0, ticks: 0 };
  const gl = { isContextLost: () => false, SYNC_GPU_COMMANDS_COMPLETE: 1, ALREADY_SIGNALED: 2,
    CONDITION_SATISFIED: 3, TIMEOUT_EXPIRED: 4, WAIT_FAILED: 5,
    fenceSync: () => { order.push('fence'); return {}; }, flush() {},
    clientWaitSync: () => state.gpuReady ? 3 : 4,
    deleteSync: vi.fn(() => { order.push('delete-fence'); }) };
  const renderer = {
    domElement: canvas, info: { programs }, getContext: () => gl,
    compileAsync: vi.fn(async (scene: THREE.Scene) => {
      order.push('compile');
      const material = (scene.children[0] as THREE.Mesh).material as THREE.Material;
      // Match installed Three prepareMaterial's real version-changing setters.
      if (material.transparent && material.side === THREE.DoubleSide && !material.forceSinglePass) {
        material.side = THREE.BackSide; material.needsUpdate = true;
        material.side = THREE.FrontSide; material.needsUpdate = true;
        material.side = THREE.DoubleSide;
      }
      if (options.compile) await options.compile();
      if (!materials.has(material)) {
        materials.add(material);
        programs.push({ isReady: () => true, getUniforms: () => { order.push('uniforms'); }, getAttributes: () => { order.push('attributes'); } });
      }
      order.push('compiled');
    }),
    render: vi.fn(() => { state.frames++; order.push('draw'); }), setPixelRatio() {}, setSize() {},
    xr: { enabled: false, isPresenting: false, addEventListener() {}, removeEventListener() {}, setAnimationLoop() {} }
  };
  function FrameCounter() { useFrame(() => { state.ticks++; }); return null; }
  const root = createRoot(canvas);
  await root.configure({ gl: renderer as never, frameloop: 'never', size: { width: 128, height: 128, top: 0, left: 0 } });
  let store: RootStore;
  const release = (outcome: InitialWarmupOutcome) => {
    outcomes.push(outcome); order.push(`release:${outcome}`);
    store.getState().setFrameloop('always');
  };
  const geometry = new THREE.BoxGeometry(), material = options.material ?? new THREE.MeshStandardMaterial();
  let worldAvailable = options.worldAvailable ?? true, mountComplete = options.mountComplete ?? true;
  let worldMaterial: THREE.Material | undefined;
  const render = async () => { await act(async () => { store = root.render(<>
    <mesh geometry={geometry} material={material} />
    {worldMaterial && <mesh geometry={geometry} material={worldMaterial} />}
    <FrameCounter /><ShaderWarmup onInitialRelease={release}
      initialWorldAvailable={worldAvailable} initialMountComplete={mountComplete} />
  </>); }); };
  await render();
  const updateWorld = async (available: boolean, complete: boolean, nextMaterial = worldMaterial) => {
    worldAvailable = available; mountComplete = complete; worldMaterial = nextMaterial; await render();
  };
  let unmounted = false;
  const unmount = async () => { if (!unmounted) { unmounted = true; await act(async () => { root.unmount(); }); } };
  cleanups.push(unmount);
  return { state, order, outcomes, renderer, gl, canvas, store: store!, unmount, updateWorld };
}

describe('initial real-render ordering', () => {
  it('keeps App signed-AV and survey clocks paused through cold preparation and retains every later pause input', () => {
    // Evaluate the actual two App prop expressions, so the real component
    // wiring is covered rather than a duplicated test-only readiness predicate.
    const app = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8');
    for (const component of ['StoryDirectorDriver', 'SurveyBracketDriver']) {
      const expression = app.match(new RegExp(`<${component}\\s+paused=\\{([^}]+)\\}`))?.[1];
      expect(expression).toBeDefined();
      const inputs = { worldGenReady: true, initialRenderReleased: true, paused: false,
        hudBlockingOverlayOpen: false, downed: false, storyCompleteOpen: false, storyCompletePreview: false,
        isMovieMode: () => false, mapRecordOpen: false, objectiveJournalOpen: false };
      const evaluate = new Function(...Object.keys(inputs), `return (${expression});`);
      const paused = (patch = {}) => evaluate(...Object.values({ ...inputs, ...patch }));
      expect(paused({ initialRenderReleased: false })).toBe(true);
      expect(paused({ worldGenReady: false })).toBe(true);
      expect(paused()).toBe(false);
      for (const flag of ['paused', 'hudBlockingOverlayOpen', 'downed', 'storyCompleteOpen', 'storyCompletePreview']) {
        expect(paused({ [flag]: true })).toBe(true);
      }
    }
  });

  it('prepares sky while the CPU world loads, then waits for actual progressive mounts before its first draw', async () => {
    const world = await mount({ worldAvailable: false, mountComplete: false });
    await tickTimers(700); await tickFrame();
    expect(world.renderer.compileAsync).toHaveBeenCalledOnce();
    expect(world.outcomes).toEqual([]); expect(world.state.frames).toBe(0); expect(world.state.ticks).toBe(0);
    const material = new THREE.MeshStandardMaterial();
    await world.updateWorld(true, false, material); await tickTimers(50); await tickFrame();
    expect(world.renderer.compileAsync).toHaveBeenCalledTimes(2);
    expect(world.outcomes).toEqual([]); expect(world.state.frames).toBe(0);
    // Final ecology arrives after an empty pass over the initial terrain.
    world.store.getState().scene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
    await world.updateWorld(true, true); await tickTimers(50);
    expect(world.outcomes).toEqual(['ready']);
    expect(world.renderer.compileAsync).toHaveBeenCalledTimes(3);
    await tickFrame(); expect(world.state.frames).toBe(1); expect(world.state.ticks).toBe(1);
    expect(world.order.indexOf('draw')).toBeGreaterThan(world.order.lastIndexOf('attributes'));
    const spans = (window as unknown as { __paravoxiaSystemMeasuredSpans: Array<{ label: string;
      details: Record<string, number | string> }> }).__paravoxiaSystemMeasuredSpans;
    const sky = spans.find(span => span.label === 'shader-warmup:initial_sky_prepared')!;
    const available = spans.find(span => span.label === 'shader-warmup:initial_world_available')!;
    const mounted = spans.find(span => span.label === 'shader-warmup:initial_world_mounted')!;
    const released = spans.find(span => span.label === 'shader-warmup:initial_release')!;
    expect(sky.details.elapsedMs).toBeLessThan(700);
    expect(available.details.waitForWorldMs).toBe(700);
    expect(available.details.timeoutMs).toBe(500);
    expect(mounted.details.atMs).toBe(750);
    expect(released.details.elapsedMs).toBeGreaterThanOrEqual(750);
    expect(released.details.preparationElapsedMs).toBeLessThan(500);
    await world.updateWorld(false, false); await tickFrame();
    expect(world.outcomes).toEqual(['ready']); expect(world.state.frames).toBe(2);
  });

  it('uses timer yields only while the initial renderer loop is stopped', async () => {
    const idle = vi.spyOn(window, 'requestIdleCallback');
    const world = await mount(); await tickTimers();
    expect(world.outcomes).toEqual(['ready']); expect(idle).not.toHaveBeenCalled();
    const unregister = precompile(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
    cleanups.push(async () => unregister());
    await tickTimers(); expect(idle).toHaveBeenCalled();
  });

  it('fails open 500 ms after world availability if progressive mounting stalls, without resetting the deadline', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const world = await mount({ worldAvailable: false, mountComplete: false }); await tickTimers(700);
    await world.updateWorld(true, false); await tickTimers(400);
    // A replacement world cannot grant another 500 ms or release from old mounts.
    await world.updateWorld(false, false);
    // Effect teardown/rebinding for a real camera replacement keeps the same
    // deadline even when the replacement world's CPU data is not available yet.
    await act(async () => { world.store.setState({ camera: new THREE.PerspectiveCamera() }); });
    await tickTimers(99);
    expect(world.outcomes).toEqual([]);
    await tickTimers(1); await tickFrame();
    expect(world.outcomes).toEqual(['timeout']); expect(world.state.frames).toBe(1);
    expect(warn).toHaveBeenCalledWith('[shader-warmup] initial render released without complete preparation',
      expect.objectContaining({ outcome: 'timeout', elapsedMs: 1200, preparationElapsedMs: 500, worldMountedAtMs: null }));
  });
  it('releases as prepared rather than timing out on transparent double-sided material versions', async () => {
    const material = new THREE.MeshStandardMaterial({ transparent: true, side: THREE.DoubleSide });
    const world = await mount({ material });
    await tickTimers(100);
    expect(world.outcomes).toEqual(['ready']);
    expect(world.renderer.compileAsync).toHaveBeenCalledOnce();
    expect(material.version).toBe(2);
    await tickFrame(); expect(world.state.frames).toBe(1);
    await tickTimers(500);
    expect(world.outcomes).toEqual(['ready']);
    expect(world.order.indexOf('release:ready')).toBeGreaterThan(world.order.indexOf('attributes'));
  });

  it('stops frames until compilation, GPU readiness and reflection finish, independently of sceneReady', async () => {
    let compiled!: () => void;
    const wait = new Promise<void>(resolve => { compiled = resolve; });
    const world = await mount({ compile: () => wait, gpuReady: false });
    await tickTimers(); await tickFrame();
    expect(world.state.frames).toBe(0); expect(world.state.ticks).toBe(0);
    expect(world.renderer.compileAsync).toHaveBeenCalledOnce();
    await act(async () => { compiled(); }); await tickTimers(); await tickFrame();
    expect(world.order).toContain('fence'); expect(world.order).not.toContain('uniforms'); expect(world.state.frames).toBe(0);
    world.state.gpuReady = true; await tickTimers();
    expect(world.outcomes).toEqual(['ready']); expect(world.store.getState().frameloop).toBe('always');
    await tickFrame(); expect(world.state.frames).toBe(1); expect(world.state.ticks).toBe(1);
    expect(world.order.indexOf('draw')).toBeGreaterThan(world.order.indexOf('attributes'));
    expect(world.order.indexOf('release:ready')).toBeGreaterThan(world.order.indexOf('delete-fence'));
  });

  it('drains registrations arriving during compile and never closes the gate for later work', async () => {
    let complete!: () => void;
    const first = new Promise<void>(resolve => { complete = resolve; }); let calls = 0;
    const world = await mount({ compile: () => ++calls === 1 ? first : Promise.resolve() }); await tickTimers();
    const unregister = precompile(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
    cleanups.push(async () => unregister());
    await act(async () => { complete(); }); await tickTimers(60);
    expect(world.outcomes).toEqual(['ready']); expect(world.order.filter(item => item === 'attributes')).toHaveLength(2);
    const unregisterLater = precompile(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
    cleanups.push(async () => unregisterLater());
    expect(world.store.getState().frameloop).toBe('always'); await tickFrame(); await tickTimers();
    expect(world.outcomes).toEqual(['ready']); expect(world.order.filter(item => item === 'attributes')).toHaveLength(3);
  });

  it('recollects an ordinary mesh mounted during the initial asynchronous pass', async () => {
    let complete!: () => void;
    const first = new Promise<void>(resolve => { complete = resolve; }); let calls = 0;
    const world = await mount({ compile: () => ++calls === 1 ? first : Promise.resolve() });
    await tickTimers();
    // A scene attachment has no precompile registration to request another pass.
    world.store.getState().scene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
    await act(async () => { complete(); }); await tickTimers(60);
    expect(world.outcomes).toEqual(['ready']);
    expect(world.order.filter(item => item === 'attributes')).toHaveLength(2);
    await tickFrame();
    expect(world.order.indexOf('draw')).toBeGreaterThan(world.order.lastIndexOf('attributes'));
  });

  it('reports hung compilation and releases ordinary rendering at the existing 500 ms budget', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const world = await mount({ compile: () => new Promise(() => {}) });
    await tickTimers(INITIAL_WARMUP_TIMEOUT_MS - 1); expect(world.outcomes).toEqual([]);
    await tickTimers(1); await tickFrame();
    expect(world.outcomes).toEqual(['timeout']); expect(world.state.frames).toBe(1);
    expect(warn).toHaveBeenCalledWith('[shader-warmup] initial render released without complete preparation', expect.objectContaining({ outcome: 'timeout', elapsedMs: 500 }));
  });

  it('preserves compile diagnostics and releases normal rendering on error', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {}); const failure = new Error('compile failure');
    const world = await mount({ compile: async () => { throw failure; } }); await tickTimers(); await tickFrame();
    expect(world.outcomes).toEqual(['error']); expect(world.state.frames).toBe(1);
    expect(warn).toHaveBeenCalledWith('[shader-warmup] preparation failed', failure);
  });

  it('releases once on context loss even if compilation hangs and cleans up its listener', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const world = await mount({ compile: () => new Promise(() => {}), worldAvailable: false, mountComplete: false }); await tickTimers();
    await act(async () => { world.canvas.dispatchEvent(new Event('webglcontextlost')); });
    expect(world.outcomes).toEqual(['context-lost']); await tickTimers(500); expect(world.outcomes).toHaveLength(1);
    await world.unmount(); world.canvas.dispatchEvent(new Event('webglcontextlost')); expect(world.outcomes).toHaveLength(1);
  });

  it('never releases a stale unmounted gate and releases on initial visibility cancellation', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const world = await mount({ compile: () => new Promise(() => {}) }); await tickTimers();
    await world.unmount(); await tickTimers(500); expect(world.outcomes).toEqual([]);
    const hidden = await mount({ compile: () => new Promise(() => {}) });
    await act(async () => { visibility.hidden = true; visibility.dispatchEvent(new Event('visibilitychange')); });
    expect(hidden.outcomes).toEqual(['hidden']); expect(hidden.store.getState().frameloop).toBe('always');
  });
});
