import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { collectHiddenMaterialProxies, precompile, warmScenePrograms } from './shaderWarmup.ts';

function hiddenMesh(material = new THREE.MeshStandardMaterial()): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
  mesh.visible = false;
  return mesh;
}
const immediate = async () => {};

// Installed Three r160 prepareMaterial performs these synchronous transitions.
// Use real Material setters so this tests the actual version invalidation rule.
function prepareDoubleSide(material: THREE.Material): void {
  material.side = THREE.BackSide; material.needsUpdate = true;
  material.side = THREE.FrontSide; material.needsUpdate = true;
  material.side = THREE.DoubleSide;
}

describe('shader warm-up', () => {
  it('reflects cheap programs together without yielding after their covering GPU fence', async () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(0);
    let queuedEpoch = 0, fencedEpoch = -1;
    const uniforms = vi.fn(() => { expect(fencedEpoch).toBe(queuedEpoch); });
    const attributes = vi.fn(() => { expect(fencedEpoch).toBe(queuedEpoch); });
    const programs = Array.from({ length: 20 }, () => ({ isReady: () => true, getUniforms: uniforms, getAttributes: attributes }));
    const gl = {
      isContextLost: () => false, SYNC_GPU_COMMANDS_COMPLETE: 1, ALREADY_SIGNALED: 2,
      CONDITION_SATISFIED: 3, TIMEOUT_EXPIRED: 4, WAIT_FAILED: 5,
      fenceSync: vi.fn(() => { fencedEpoch = queuedEpoch; return {}; }),
      flush() {}, clientWaitSync: () => 3, deleteSync: vi.fn()
    };
    const renderer = { info: { programs }, getContext: () => gl, compileAsync: vi.fn(async () => {}) };
    const scene = new THREE.Scene(); scene.add(hiddenMesh());
    // Every yield allows an ordinary frame to queue new command-buffer work.
    const yieldControl = vi.fn(async () => { queuedEpoch++; });
    try {
      expect(await warmScenePrograms(renderer as never, scene, new THREE.PerspectiveCamera(), { yieldControl })).toBe(1);
      expect(uniforms).toHaveBeenCalledTimes(20); expect(attributes).toHaveBeenCalledTimes(20);
      expect(renderer.compileAsync).toHaveBeenCalledOnce();
      expect(gl.fenceSync).toHaveBeenCalledOnce(); expect(gl.deleteSync).toHaveBeenCalledOnce();
      expect(yieldControl).toHaveBeenCalledTimes(2); // Before compile and before the fenced reflection slice.
    } finally { now.mockRestore(); }
  });

  it('yields after the reflection budget and renews the fence before each remaining slice', async () => {
    let clock = 0, queuedEpoch = 0, fencedEpoch = -1;
    const now = vi.spyOn(performance, 'now').mockImplementation(() => clock);
    const reflected: number[] = [];
    const programs = Array.from({ length: 3 }, (_, index) => ({
      isReady: () => true,
      getUniforms: () => { expect(fencedEpoch).toBe(queuedEpoch); clock += 2; },
      getAttributes: () => { clock += 1; reflected.push(index); }
    }));
    const gl = {
      isContextLost: () => false, SYNC_GPU_COMMANDS_COMPLETE: 1, ALREADY_SIGNALED: 2,
      CONDITION_SATISFIED: 3, TIMEOUT_EXPIRED: 4, WAIT_FAILED: 5,
      fenceSync: vi.fn(() => { fencedEpoch = queuedEpoch; return {}; }),
      flush() {}, clientWaitSync: () => 3, deleteSync: vi.fn()
    };
    const renderer = { info: { programs }, getContext: () => gl, compileAsync: vi.fn(async () => {}) };
    const scene = new THREE.Scene(); scene.add(hiddenMesh());
    const reflectedAtYields: number[] = [];
    try {
      expect(await warmScenePrograms(renderer as never, scene, new THREE.PerspectiveCamera(), {
        yieldControl: async () => { queuedEpoch++; reflectedAtYields.push(reflected.length); }
      })).toBe(1);
      expect(reflected).toEqual([0, 1, 2]);
      expect(reflectedAtYields).toEqual([0, 0, 1, 2]);
      expect(gl.fenceSync).toHaveBeenCalledTimes(3); expect(gl.deleteSync).toHaveBeenCalledTimes(3);
      expect(renderer.compileAsync).toHaveBeenCalledOnce();
    } finally { now.mockRestore(); }
  });

  it('keeps a partly reflected target uncached on cancellation and finishes remaining programs on resume', async () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(0);
    let cancelled = false;
    const first = { isReady: () => true, getUniforms: vi.fn(), getAttributes: vi.fn(() => { cancelled = true; }) };
    const second = { isReady: () => true, getUniforms: vi.fn(), getAttributes: vi.fn() };
    const renderer = { info: { programs: [first, second] }, compileAsync: vi.fn(async () => {}) };
    const scene = new THREE.Scene(); scene.add(hiddenMesh());
    const compiled = new Set<string>(), reflectionReady = new WeakSet<object>();
    const options = { compiled, reflectionReady, yieldControl: immediate, isCancelled: () => cancelled };
    try {
      expect(await warmScenePrograms(renderer as never, scene, new THREE.PerspectiveCamera(), options)).toBe(0);
      expect(compiled.size).toBe(0); expect(second.getUniforms).not.toHaveBeenCalled();
      cancelled = false;
      expect(await warmScenePrograms(renderer as never, scene, new THREE.PerspectiveCamera(), options)).toBe(1);
      expect(first.getUniforms).toHaveBeenCalledOnce(); expect(second.getUniforms).toHaveBeenCalledOnce();
      expect(compiled.size).toBe(1);
    } finally { now.mockRestore(); }
  });

  it('caches the synchronous double-sided submission version so initial draining terminates', async () => {
    const material = new THREE.MeshStandardMaterial({ transparent: true, side: THREE.DoubleSide });
    const scene = new THREE.Scene(); scene.add(hiddenMesh(material));
    const renderer = { info: { programs: [] }, compileAsync: vi.fn(() => {
      prepareDoubleSide(material);
      return Promise.resolve();
    }) };
    const options = { compiled: new Set<string>(), yieldControl: immediate };
    expect(await warmScenePrograms(renderer as never, scene, new THREE.PerspectiveCamera(), options)).toBe(1);
    expect(material.version).toBe(2); expect(material.side).toBe(THREE.DoubleSide);
    expect(await warmScenePrograms(renderer as never, scene, new THREE.PerspectiveCamera(), options)).toBe(0);
    expect(renderer.compileAsync).toHaveBeenCalledOnce();
  });

  it('does not cache an external material edit made after submission while linking is pending', async () => {
    const material = new THREE.MeshStandardMaterial({ transparent: true, side: THREE.DoubleSide });
    const scene = new THREE.Scene(); scene.add(hiddenMesh(material));
    let notifySubmitted!: () => void, finishLinking!: () => void;
    const submitted = new Promise<void>(resolve => { notifySubmitted = resolve; });
    const linking = new Promise<void>(resolve => { finishLinking = resolve; });
    let first = true;
    const renderer = { info: { programs: [] }, compileAsync: vi.fn(() => {
      prepareDoubleSide(material);
      notifySubmitted();
      if (first) { first = false; return linking; }
      return Promise.resolve();
    }) };
    const options = { compiled: new Set<string>(), yieldControl: immediate };
    const pending = warmScenePrograms(renderer as never, scene, new THREE.PerspectiveCamera(), options);
    await submitted;
    material.defines = { NEW_EXTERNAL_FEATURE: 1 }; material.needsUpdate = true;
    finishLinking();
    expect(await pending).toBe(1);
    expect(await warmScenePrograms(renderer as never, scene, new THREE.PerspectiveCamera(), options)).toBe(1);
    expect(await warmScenePrograms(renderer as never, scene, new THREE.PerspectiveCamera(), options)).toBe(0);
    expect(renderer.compileAsync).toHaveBeenCalledTimes(2);
  });

  it('leaves a lighting signature changed during compilation eligible for another pass', async () => {
    const scene = new THREE.Scene(); scene.add(hiddenMesh());
    let first = true;
    const renderer = { info: { programs: [] }, compileAsync: vi.fn(async () => {
      await Promise.resolve();
      if (first) { first = false; scene.add(new THREE.PointLight()); }
    }) };
    const options = { compiled: new Set<string>(), yieldControl: immediate };
    const camera = new THREE.PerspectiveCamera();
    expect(await warmScenePrograms(renderer as never, scene, camera, options)).toBe(1);
    expect(await warmScenePrograms(renderer as never, scene, camera, options)).toBe(1);
    expect(await warmScenePrograms(renderer as never, scene, camera, options)).toBe(0);
  });

  it('finds hidden descendants without modifying their visibility or parent', () => {
    const scene = new THREE.Scene();
    const hidden = hiddenMesh();
    const shown = hiddenMesh(); shown.visible = true;
    const parent = new THREE.Group(); parent.visible = false;
    const child = hiddenMesh(); child.visible = true;
    parent.add(child); scene.add(hidden, shown, parent);
    const proxies = collectHiddenMaterialProxies(scene);
    expect(proxies.map(p => p.material)).toEqual([hidden.material, child.material]);
    expect(proxies[0].geometry).toBe(hidden.geometry);
    expect(child.parent).toBe(parent);
    expect(child.visible).toBe(true);
    expect(parent.visible).toBe(false);
  });

  it('preserves the instanced color, skinning and morph shader variants', () => {
    const scene = new THREE.Scene(); scene.visible = false;
    const geometry = new THREE.BoxGeometry();
    geometry.morphAttributes.position = [geometry.attributes.position.clone()];
    const material = new THREE.MeshStandardMaterial();
    const instances = new THREE.InstancedMesh(geometry, material, 100);
    instances.setColorAt(0, new THREE.Color('red'));
    const skin = new THREE.SkinnedMesh(geometry, material);
    const skeleton = new THREE.Skeleton([new THREE.Bone()]); skin.bind(skeleton);
    scene.add(instances, skin, new THREE.Mesh(geometry, material));
    const [instancedProxy, skinProxy, meshProxy] = collectHiddenMaterialProxies(scene);
    expect(instancedProxy).toBeInstanceOf(THREE.InstancedMesh);
    expect((instancedProxy as THREE.InstancedMesh).instanceColor).toBe(instances.instanceColor);
    expect((instancedProxy as THREE.InstancedMesh).instanceMatrix).toBe(instances.instanceMatrix);
    expect(skinProxy).toBeInstanceOf(THREE.SkinnedMesh);
    expect((skinProxy as THREE.SkinnedMesh).skeleton).toBe(skeleton);
    expect(meshProxy.morphTargetInfluences).toEqual([0]);
    expect(collectHiddenMaterialProxies(scene)).toHaveLength(3);
  });

  it('awaits compilation before reflecting programs, yields, and retains errors', async () => {
    const scene = new THREE.Scene(); scene.add(hiddenMesh(), hiddenMesh());
    const camera = new THREE.PerspectiveCamera();
    let ready = false;
    const order: string[] = [];
    const program = { isReady: () => ready, getUniforms: () => { order.push('uniforms'); }, getAttributes: () => { order.push('attributes'); } };
    const renderer = {
      info: { programs: [program] },
      compileAsync: vi.fn(async (_stage, actualCamera, actualScene) => {
        expect(actualCamera).toBe(camera); expect(actualScene).toBe(scene);
        order.push('compile'); await Promise.resolve(); ready = true; order.push('ready');
      })
    };
    const compiled = new Set<string>();
    const reflectionReady = new WeakSet<object>();
    const yieldControl = async () => { order.push('yield'); };
    expect(await warmScenePrograms(renderer as never, scene, camera, { compiled, reflectionReady, yieldControl })).toBe(2);
    expect(order.indexOf('uniforms')).toBeGreaterThan(order.indexOf('ready'));
    expect(order.filter(event => event === 'uniforms')).toHaveLength(1);
    expect(order.filter(event => event === 'yield').length).toBeGreaterThanOrEqual(3);
    expect(await warmScenePrograms(renderer as never, scene, camera, { compiled, reflectionReady, yieldControl })).toBe(0);
    const bad = { info: { programs: [] }, compileAsync: async () => { throw new Error('GL context lost'); } };
    await expect(warmScenePrograms(bad as never, scene, camera, { yieldControl: immediate })).rejects.toThrow('GL context lost');
  });

  it('warms registrations before other content and honors cancellation', async () => {
    const scene = new THREE.Scene(); const ordinary = hiddenMesh(); scene.add(ordinary);
    const knownCut = hiddenMesh(); const unregister = precompile(knownCut);
    const seen: THREE.Material[] = [];
    const renderer = { info: { programs: [] }, compileAsync: async (stage: THREE.Scene) => {
      seen.push((stage.children[0] as THREE.Mesh).material as THREE.Material);
    } };
    try {
      await warmScenePrograms(renderer as never, scene, new THREE.PerspectiveCamera(), { yieldControl: immediate, isCancelled: () => seen.length > 0 });
      expect(seen).toEqual([knownCut.material]);
      expect(knownCut.parent).toBeNull();
    } finally { unregister(); }
  });

  it('waits for an owned GPU fence before diagnostics and excludes later programs from that fence', async () => {
    const scene = new THREE.Scene(); scene.add(hiddenMesh());
    const order: string[] = [];
    const program = { isReady: () => true, getUniforms: () => { order.push('uniforms'); }, getAttributes: () => { order.push('attributes'); } };
    const later = { isReady: () => true, getUniforms: vi.fn(), getAttributes: vi.fn() };
    const programs = [program];
    const fence = {};
    let polls = 0;
    const gl = {
      isContextLost: () => false,
      SYNC_GPU_COMMANDS_COMPLETE: 1, ALREADY_SIGNALED: 2, CONDITION_SATISFIED: 3, TIMEOUT_EXPIRED: 4, WAIT_FAILED: 5,
      fenceSync: vi.fn(() => { order.push('fence'); return fence; }),
      flush: () => { order.push('flush'); programs.push(later); },
      clientWaitSync: vi.fn(() => { order.push('poll'); return ++polls < 2 ? 4 : 3; }),
      deleteSync: vi.fn(() => { order.push('delete'); })
    };
    const renderer = { info: { programs }, getContext: () => gl, compileAsync: async () => { order.push('compiled'); } };
    await warmScenePrograms(renderer as never, scene, new THREE.PerspectiveCamera(), { yieldControl: immediate });
    expect(order).toEqual(['compiled', 'fence', 'flush', 'poll', 'poll', 'delete', 'uniforms', 'attributes']);
    expect(gl.clientWaitSync.mock.calls).toEqual([[fence, 0, 0], [fence, 0, 0]]);
    expect(gl.deleteSync).toHaveBeenCalledWith(fence);
    expect(later.getUniforms).not.toHaveBeenCalled();
  });

  it('cleans up a cancelled GPU wait and completes diagnostics on resume', async () => {
    const scene = new THREE.Scene(); scene.add(hiddenMesh());
    const compiled = new Set<string>(), reflectionReady = new WeakSet<object>();
    const program = { isReady: () => true, getUniforms: vi.fn(), getAttributes: vi.fn() };
    let cancelled = false, interrupt = true;
    const gl = {
      isContextLost: () => false,
      SYNC_GPU_COMMANDS_COMPLETE: 1, ALREADY_SIGNALED: 2, CONDITION_SATISFIED: 3, TIMEOUT_EXPIRED: 4, WAIT_FAILED: 5,
      fenceSync: () => ({}), flush() {}, deleteSync: vi.fn(),
      clientWaitSync: () => { if (interrupt) { cancelled = true; return 4; } return 3; }
    };
    const renderer = { info: { programs: [program] }, getContext: () => gl, compileAsync: vi.fn(async () => {}) };
    const options = { compiled, reflectionReady, yieldControl: immediate, isCancelled: () => cancelled };
    expect(await warmScenePrograms(renderer as never, scene, new THREE.PerspectiveCamera(), options)).toBe(0);
    expect(program.getUniforms).not.toHaveBeenCalled();
    expect(compiled.size).toBe(0);
    expect(gl.deleteSync).toHaveBeenCalledOnce();
    cancelled = false; interrupt = false;
    expect(await warmScenePrograms(renderer as never, scene, new THREE.PerspectiveCamera(), options)).toBe(1);
    expect(program.getUniforms).toHaveBeenCalledOnce();
    expect(program.getAttributes).toHaveBeenCalledOnce();
    expect(gl.deleteSync).toHaveBeenCalledTimes(2);
  });

  it('reports a failed fence while retaining normal shader diagnostics', async () => {
    const scene = new THREE.Scene(); scene.add(hiddenMesh());
    const program = { isReady: () => true, getUniforms: vi.fn(), getAttributes: vi.fn() };
    const gl = {
      isContextLost: () => false,
      SYNC_GPU_COMMANDS_COMPLETE: 1, ALREADY_SIGNALED: 2, CONDITION_SATISFIED: 3, TIMEOUT_EXPIRED: 4, WAIT_FAILED: 5,
      fenceSync: () => ({}), flush() {}, deleteSync: vi.fn(), clientWaitSync: () => 5
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const renderer = { info: { programs: [program] }, getContext: () => gl, compileAsync: async () => {} };
      await warmScenePrograms(renderer as never, scene, new THREE.PerspectiveCamera(), { yieldControl: immediate });
      expect(warn).toHaveBeenCalledWith('[shader-warmup] GPU readiness wait', expect.objectContaining({ outcome: 'failed' }));
      expect(program.getUniforms).toHaveBeenCalledOnce();
      expect(program.getAttributes).toHaveBeenCalledOnce();
      expect(gl.deleteSync).toHaveBeenCalledOnce();
    } finally { warn.mockRestore(); }
  });

  it('does not reflect a program released while the GPU wait is pending', async () => {
    const scene = new THREE.Scene(); scene.add(hiddenMesh());
    const program = { isReady: () => true, getUniforms: vi.fn(), getAttributes: vi.fn() };
    const programs = [program];
    const gl = {
      isContextLost: () => false,
      SYNC_GPU_COMMANDS_COMPLETE: 1, ALREADY_SIGNALED: 2, CONDITION_SATISFIED: 3, TIMEOUT_EXPIRED: 4, WAIT_FAILED: 5,
      fenceSync: () => ({}), flush: () => { programs.length = 0; }, deleteSync: vi.fn(), clientWaitSync: () => 3
    };
    const renderer = { info: { programs }, getContext: () => gl, compileAsync: async () => {} };
    await warmScenePrograms(renderer as never, scene, new THREE.PerspectiveCamera(), { yieldControl: immediate });
    expect(program.getUniforms).not.toHaveBeenCalled();
    expect(program.getAttributes).not.toHaveBeenCalled();
    expect(gl.deleteSync).toHaveBeenCalledOnce();
  });
});
