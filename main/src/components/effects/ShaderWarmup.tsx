import { useEffect, useLayoutEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { useAppState } from '../../state/appState.ts';
import { useStoryState } from '../../story/storyState.ts';
import { subscribePrecompile, warmScenePrograms } from './shaderWarmup.ts';
import { measureWarpMetric } from '../../utils/warpMetrics.ts';

export type InitialWarmupOutcome = 'ready' | 'timeout' | 'error' | 'context-lost' | 'hidden';
// Bound full-world preparation, including a hung compile, once CPU data is available.
export const INITIAL_WARMUP_TIMEOUT_MS = 500;

interface ShaderWarmupProps {
  onInitialRelease?: (outcome: InitialWarmupOutcome) => void;
  /** CPU preparation has supplied the world subtree for this React commit. */
  initialWorldAvailable?: boolean;
  /** All progressively mounted initial resources have populated their attributes. */
  initialMountComplete?: boolean;
}

/** One serialized queue per Canvas; all preparation remains inside measured load time. */
export default function ShaderWarmup({ onInitialRelease, initialWorldAvailable = true,
  initialMountComplete = true }: ShaderWarmupProps): null {
  const gl = useThree(state => state.gl);
  const scene = useThree(state => state.scene);
  const camera = useThree(state => state.camera);
  const { sceneReady } = useAppState();
  const { beat } = useStoryState();
  const requestPass = useRef<() => void>(() => {});
  const initialCallback = useRef(onInitialRelease);
  initialCallback.current = onInitialRelease;
  const initialReleased = useRef(false);
  const initialStartedAt = useRef<number | null>(null);
  const preparationStartedAt = useRef<number | null>(null);
  const mountCompletedAt = useRef<number | null>(null);
  const skyPrepared = useRef(false);
  const initialWorld = useRef({ available: initialWorldAvailable, mounted: initialMountComplete });
  const updateInitialWorld = useRef<() => void>(() => {});
  useLayoutEffect(() => {
    // Only committed readiness can release the gate; a speculative React render
    // must not make the previous scene count as the populated incoming world.
    initialWorld.current = { available: initialWorldAvailable, mounted: initialMountComplete };
    updateInitialWorld.current();
  }, [initialWorldAvailable, initialMountComplete]);

  useEffect(() => {
    let disposed = false;
    let running = false;
    let pending = false;
    const compiled = new Set<string>();
    const reflectionReady = new WeakSet<object>();
    if (initialStartedAt.current === null) initialStartedAt.current = performance.now();
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const releaseInitial = (outcome: InitialWarmupOutcome) => {
      if (disposed || initialReleased.current || !initialCallback.current) return;
      initialReleased.current = true;
      clearTimeout(deadline);
      const now = performance.now();
      const details = { outcome, elapsedMs: now - initialStartedAt.current!, compiledTargets: compiled.size,
        worldAvailableAtMs: preparationStartedAt.current, worldMountedAtMs: mountCompletedAt.current,
        preparationElapsedMs: preparationStartedAt.current === null ? null : now - preparationStartedAt.current };
      measureWarpMetric('shader-warmup:initial_release', () => details, value => value);
      if (outcome !== 'ready') console.warn('[shader-warmup] initial render released without complete preparation', details);
      initialCallback.current(outcome);
    };
    const contextLost = () => releaseInitial('context-lost');
    gl.domElement.addEventListener('webglcontextlost', contextLost);
    const yieldControl = () => new Promise<void>(resolve => {
      // The cold Canvas has no rendering loop yet. Yield a timer task there;
      // normal foreground rendering keeps the existing idle-work scheduling.
      if ((!initialCallback.current || initialReleased.current) && window.requestIdleCallback) {
        window.requestIdleCallback(() => resolve(), { timeout: 250 });
      }
      else window.setTimeout(resolve, 0);
    });
    const request = () => {
      pending = true;
      if (running || disposed) return;
      running = true;
      void (async () => {
        try {
          while (pending && !disposed) {
            pending = false;
            await yieldControl();
            if (disposed || document.hidden) {
              if (document.hidden) releaseInitial('hidden');
              break;
            }
            const completed = await warmScenePrograms(gl, scene, camera, {
              compiled, reflectionReady, yieldControl, isCancelled: () => disposed || document.hidden
            });
            if (initialCallback.current && !initialReleased.current && !disposed) {
              if (document.hidden) releaseInitial('hidden');
              // Recollect after an async pass: registrations or scene signatures
              // can change while compilation/fences yield. Release only once an
              // empty pass and its registration queue have both drained.
              else if (completed > 0) pending = true;
              else if (!pending && initialWorld.current.available && initialWorld.current.mounted) releaseInitial('ready');
              else if (!pending && !initialWorld.current.available && !skyPrepared.current) {
                skyPrepared.current = true;
                measureWarpMetric('shader-warmup:initial_sky_prepared', () => compiled.size,
                  compiledTargets => ({ compiledTargets, elapsedMs: performance.now() - initialStartedAt.current! }));
              }
            }
          }
        } catch (error) {
          // Diagnostics remain observable. A context-loss/warmup failure must
          // leave ordinary rendering available rather than crash the scene.
          console.warn('[shader-warmup] preparation failed', error);
          releaseInitial('error');
        } finally { running = false; }
      })();
    };
    requestPass.current = request;
    const updateWorld = () => {
      if (disposed || initialReleased.current || !initialCallback.current) return;
      if (initialWorld.current.available && preparationStartedAt.current === null) {
        preparationStartedAt.current = performance.now();
        measureWarpMetric('shader-warmup:initial_world_available', () => preparationStartedAt.current,
          atMs => ({ atMs, waitForWorldMs: atMs! - initialStartedAt.current!, timeoutMs: INITIAL_WARMUP_TIMEOUT_MS }));
      }
      if (preparationStartedAt.current !== null) {
        // This is a separate 500 ms full-world preparation bound. Time spent
        // awaiting the existing worker remains in elapsedMs and navigation's
        // original cold window; it is never relabelled as prepared rendering.
        clearTimeout(deadline);
        deadline = setTimeout(() => releaseInitial('timeout'), Math.max(0,
          INITIAL_WARMUP_TIMEOUT_MS - (performance.now() - preparationStartedAt.current)));
        if (initialWorld.current.available && initialWorld.current.mounted && mountCompletedAt.current === null) {
          mountCompletedAt.current = performance.now();
          measureWarpMetric('shader-warmup:initial_world_mounted', () => mountCompletedAt.current, atMs => ({ atMs }));
        }
      }
      request();
    };
    updateInitialWorld.current = updateWorld;
    updateWorld();
    const unsubscribe = subscribePrecompile(request);
    const resume = () => {
      if (document.hidden) releaseInitial('hidden');
      else request();
    };
    document.addEventListener('visibilitychange', resume);
    request();
    return () => {
      disposed = true;
      clearTimeout(deadline);
      gl.domElement.removeEventListener('webglcontextlost', contextLost);
      unsubscribe();
      document.removeEventListener('visibilitychange', resume);
      requestPass.current = () => {};
      updateInitialWorld.current = () => {};
    };
  }, [gl, scene, camera]);

  useEffect(() => { requestPass.current(); }, [sceneReady, beat]);
  return null;
}
