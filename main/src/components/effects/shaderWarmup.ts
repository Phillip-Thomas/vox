import * as THREE from 'three';
import { waitForGpuStartup } from '../../utils/rendererBootstrap.ts';
import { measureWarpMetric } from '../../utils/warpMetrics.ts';

// Three r160 compile traverses hidden materials too. Its async promise covers
// linking, but uniform/attribute reflection and diagnostics still run on first
// use. Compile the real shader variants and finish that work in bounded passes.
const registrations = new Set<THREE.Object3D>();
const registrationListeners = new Set<() => void>();
export function precompile(root: THREE.Object3D): () => void {
  registrations.add(root);
  for (const listener of registrationListeners) listener();
  return () => { registrations.delete(root); };
}
export function subscribePrecompile(listener: () => void): () => void {
  registrationListeners.add(listener);
  return () => { registrationListeners.delete(listener); };
}

export interface MaterialProxy {
  proxy: THREE.Object3D;
  key: string;
}

function materialProxy(source: THREE.Mesh): THREE.Object3D {
  // InstancedMesh.clone allocates another full matrix buffer. Share the actual
  // attributes instead, retaining instancing/color and all morph/skinning flags.
  if ((source as THREE.InstancedMesh).isInstancedMesh) {
    const original = source as THREE.InstancedMesh;
    const proxy = new THREE.InstancedMesh(original.geometry, original.material, 0);
    proxy.instanceMatrix = original.instanceMatrix;
    proxy.instanceColor = original.instanceColor;
    proxy.count = original.count;
    proxy.morphTargetInfluences = original.morphTargetInfluences;
    proxy.morphTargetDictionary = original.morphTargetDictionary;
    return proxy;
  }
  return source.clone(false);
}

function effectivelyVisible(object: THREE.Object3D): boolean {
  for (let current: THREE.Object3D | null = object; current; current = current.parent) {
    if (!current.visible) return false;
  }
  return true;
}

function materialProxyKey(mesh: THREE.Mesh): string {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  return `${materials.map(m => `${m.uuid}:${m.version}`).join(',')}:${mesh.geometry.uuid}:${mesh.type}:${(mesh as THREE.InstancedMesh).instanceColor?.itemSize ?? 0}`;
}

/** Proxies retain material, geometry, object class and shader-affecting attributes. */
export function collectMaterialProxies(root: THREE.Object3D, hiddenOnly = false): MaterialProxy[] {
  const proxies: MaterialProxy[] = [];
  const seen = new Set<string>();
  root.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.material || !mesh.geometry || (hiddenOnly && effectivelyVisible(mesh))) return;
    const key = materialProxyKey(mesh);
    if (seen.has(key)) return;
    seen.add(key);
    const proxy = materialProxy(mesh);
    proxy.visible = true;
    proxy.frustumCulled = false;
    proxies.push({ proxy, key });
  });
  return proxies;
}

export function collectHiddenMaterialProxies(root: THREE.Object3D): THREE.Mesh[] {
  return collectMaterialProxies(root, true).map(({ proxy }) => proxy as THREE.Mesh);
}

export interface WarmupOptions {
  isCancelled?: () => boolean;
  yieldControl?: () => Promise<void>;
  /** Cache is scoped to one renderer, scene and camera in the Canvas driver. */
  compiled?: Set<string>;
  reflectionReady?: WeakSet<object>;
  hiddenOnly?: boolean;
}

type WarmupRenderer = Pick<THREE.WebGLRenderer, 'compileAsync' | 'info'>
  & Partial<Pick<THREE.WebGLRenderer, 'getContext'>>;

const REFLECTION_SLICE_MS = 2.5;

function lightingSignature(scene: THREE.Scene, camera: THREE.Camera): string {
  const lights: string[] = [];
  scene.traverseVisible(object => {
    const light = object as THREE.Light;
    if (light.isLight && light.layers.test(camera.layers)) lights.push(`${light.type}:${light.castShadow}`);
  });
  return `${lights.sort().join(',')}:${scene.fog?.constructor.name ?? ''}:${scene.environment?.uuid ?? ''}`;
}

export async function warmScenePrograms(
  renderer: WarmupRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  options: WarmupOptions = {}
): Promise<number> {
  const yieldControl = options.yieldControl ?? (() => new Promise(resolve => setTimeout(resolve, 0)));
  const compiled = options.compiled ?? new Set<string>();
  const reflectionReady = options.reflectionReady ?? new WeakSet<object>();
  const signature = lightingSignature(scene, camera);
  const targets = new Map<string, MaterialProxy>();
  // Known cut content comes first, including roots prepared before scene mount.
  for (const root of [...registrations, scene]) {
    for (const target of collectMaterialProxies(root, options.hiddenOnly)) {
      if (!compiled.has(`${signature}:${target.key}`)) targets.set(target.key, target);
    }
  }
  let count = 0;
  for (const { proxy } of targets.values()) {
    await yieldControl();
    if (options.isCancelled?.()) break;
    const stage = new THREE.Scene();
    stage.add(proxy);
    try {
      // Awaiting is essential: changing currentProgram while an earlier pass
      // polls its readiness can resolve the wrong variant or race a disposed one.
      const compilation = renderer.compileAsync(stage, camera, scene);
      // Three compiles synchronously before returning this promise. Preparing a
      // transparent DoubleSide material bumps its version for the back/front
      // passes. Cache that submitted version, not the now-stale collected key.
      // Capture BEFORE awaiting: an external edit while linking must remain
      // uncached and trigger another pass, rather than being marked prepared.
      const submittedKey = materialProxyKey(proxy as THREE.Mesh);
      await compilation;
      if (options.isCancelled?.()) break;
      // Snapshot before the fence: programs created by a later render are not
      // covered by it. KHR compilation readiness alone does not establish that
      // the GPU command queue has completed before Three's diagnostic queries.
      const programs = (renderer.info.programs ?? []).filter(program => {
        if (reflectionReady.has(program)) return false;
        const ready = (program as unknown as { isReady?: () => boolean }).isReady;
        return !ready || ready.call(program);
      });
      let nextProgram = 0;
      while (nextProgram < programs.length) {
        // Yield BEFORE the fence. Yielding between a ready fence and reflection
        // lets normal frames enqueue more GPU work and makes that fence stale.
        await yieldControl();
        if (options.isCancelled?.()) break;
        const context = renderer.getContext?.();
        if (context) {
          const wait = await waitForGpuStartup(context, {
            metricPrefix: 'shader-warmup', isCancelled: options.isCancelled
          });
          measureWarpMetric('shader-warmup:gpu_wait_complete', () => wait, value => ({ ...value, programs: programs.length - nextProgram }));
          if (wait.outcome === 'cancelled') break;
          if (wait.outcome === 'context-lost') throw new Error('GL context lost during shader preparation');
          if (wait.outcome !== 'ready' && wait.outcome !== 'unsupported') {
            // Retain ordinary diagnostics on timeout/failure; never turn a fence
            // problem into a silently accepted or permanently hidden program.
            console.warn('[shader-warmup] GPU readiness wait', wait);
          }
        }
        if (options.isCancelled?.()) break;
        measureWarpMetric('shader-warmup:reflection_batch', () => {
          const startedAt = performance.now();
          let reflected = 0;
          while (nextProgram < programs.length && !options.isCancelled?.()) {
            const program = programs[nextProgram++];
            // A world/material can unmount while the fence is pending. Never
            // query a program the renderer has already released during that wait.
            if (!renderer.info.programs?.includes(program)) continue;
            // Keep the complete diagnostic/reflection pair atomic. A single GL
            // query can exceed this cooperative budget; its real cost is measured.
            program.getUniforms();
            program.getAttributes();
            reflectionReady.add(program);
            reflected++;
            if (performance.now() - startedAt >= REFLECTION_SLICE_MS) break;
          }
          return reflected;
        }, reflected => ({ reflected, remaining: programs.length - nextProgram }));
      }
      // A cancelled pass must remain eligible to complete on visibility resume.
      if (options.isCancelled?.()) break;
      compiled.add(`${signature}:${submittedKey}`);
      count++;
    } finally { stage.clear(); }
    if (options.isCancelled?.()) break;
  }
  return measureWarpMetric('shader-warmup:pass_complete', () => count, completed => ({
    completed, targets: targets.size, cancelled: options.isCancelled?.() ?? false
  }));
}

export async function warmHiddenPrograms(
  renderer: WarmupRenderer,
  root: THREE.Scene,
  camera: THREE.Camera,
  _lightsFrom: THREE.Scene,
  options: WarmupOptions = {}
): Promise<number> {
  return warmScenePrograms(renderer, root, camera, { ...options, hiddenOnly: true });
}
