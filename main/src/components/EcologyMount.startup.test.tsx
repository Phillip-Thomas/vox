import { act } from 'react';
import { createRoot, extend, type RootStore } from '@react-three/fiber';
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FloraField from './FloraField.tsx';
import FaunaField from './FaunaField.tsx';
import { FLORA_KINDS } from '../utils/floraField.ts';
import { FAUNA_KINDS } from '../utils/faunaField.ts';

const control = vi.hoisted(() => ({ empty: new Set<string>(), faunaDensity: 1 }));
vi.mock('../story/world/storyWorld.ts', () => ({ isStoryWorldSeed: () => false }));
vi.mock('../story/storyState.ts', () => ({ storyLifeDormant: () => false }));
vi.mock('./SkyController', () => ({ getMoonDirection() {}, getSunDirection() {} }));
vi.mock('../utils/efficientVoxelSystem', () => ({ voxelSystem: { getWorldId: () => 'test', getEditVersion: () => 0 } }));
vi.mock('../utils/worldGenCache', () => ({ getWorldGen: () => ({ generator: {} }) }));
vi.mock('../game/systems/persistence', () => ({ restoreFloraForWorld() {} }));
vi.mock('../game/systems/realityRenderSystem', () => ({ getVoxelRealityEffects() {}, lifeFieldsHidden: () => false }));
vi.mock('../utils/faunaNavigationObstacles.ts', () => ({ createLiveFaunaNavigationObstacles: () => ({}) }));
vi.mock('../config/graphicsSettings', () => ({
  getGraphicsQuality: () => ({ floraDensity: 1, floraMaxDistance: 100, faunaDensity: control.faunaDensity, faunaMaxDistance: 100, treeDensity: 1 }),
  getQualityProfile: () => 'LOW'
}));
vi.mock('../utils/floraField', async importOriginal => {
  const original = await importOriginal<typeof import('../utils/floraField.ts')>();
  return { ...original,
    buildFloraProfile: () => ({ wind: {}, artDirection: {} }),
    createFloraGeometry: () => new THREE.BoxGeometry(),
    createFloraMaterial: () => new THREE.MeshStandardMaterial(),
    countFloraVoxels: (kind: string) => control.empty.has(kind) ? 0 : 2,
    buildFloraInstances: (kind: string, mesh: THREE.InstancedMesh) => {
      mesh.count = 2; mesh.setColorAt(0, new THREE.Color('green'));
      mesh.userData.populatedKind = kind;
      return { count: 2, voxelCount: 2 };
    }
  };
});
vi.mock('../utils/faunaField', async importOriginal => {
  const original = await importOriginal<typeof import('../utils/faunaField.ts')>();
  return { ...original,
    buildFaunaProfile: () => ({ wind: {}, artDirection: {} }),
    createFaunaGeometry: () => new THREE.BoxGeometry(),
    createFaunaMaterial: () => new THREE.MeshStandardMaterial(),
    countFaunaVoxels: (kind: string) => control.empty.has(kind) ? 0 : 2,
    buildFaunaInstances: (kind: string, mesh: THREE.InstancedMesh) => {
      mesh.count = 2; mesh.setColorAt(0, new THREE.Color('brown'));
      mesh.userData.populatedKind = kind;
      return { count: 2, voxelCount: 2, agents: [] };
    }
  };
});

extend({ InstancedMesh: THREE.InstancedMesh });
const cleanups: Array<() => Promise<void>> = [];
let frameId = 0;
const frames = new Map<number, FrameRequestCallback>();
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  control.empty.clear(); control.faunaDensity = 1;
  const request = (fn: FrameRequestCallback) => { frames.set(++frameId, fn); return frameId; };
  vi.stubGlobal('requestAnimationFrame', request);
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  vi.stubGlobal('window', { location: { search: '' }, requestAnimationFrame: request,
    cancelAnimationFrame: (id: number) => frames.delete(id) });
});
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  frames.clear(); vi.unstubAllGlobals();
});
async function frame() {
  await act(async () => {
    for (const [id, callback] of [...frames]) { frames.delete(id); callback(performance.now()); }
  });
}
async function mount(kind: 'flora' | 'fauna') {
  const canvas = { width: 128, height: 128, style: {}, addEventListener() {}, removeEventListener() {} } as unknown as HTMLCanvasElement;
  const renderer = { render: vi.fn(), setPixelRatio() {}, setSize() {},
    xr: { enabled: false, isPresenting: false, addEventListener() {}, removeEventListener() {}, setAnimationLoop() {} } };
  const root = createRoot(canvas);
  await root.configure({ gl: renderer as never, frameloop: 'never', size: { width: 128, height: 128, top: 0, left: 0 } });
  let store: RootStore;
  const completed: Array<{ run: string; kinds: string[] }> = [];
  const Field = kind === 'flora' ? FloraField : FaunaField;
  const render = async (run: string) => {
    // Query the REAL reconciler scene at callback time, not the final test state.
    const ready = () => {
      const kinds: string[] = [];
      store.getState().scene.traverse(object => {
        if (!(object instanceof THREE.InstancedMesh)) return;
        expect(object.count).toBe(2); expect(object.instanceColor).not.toBeNull();
        expect(object.userData.populatedKind).toBeTypeOf('string');
        kinds.push(object.userData.populatedKind as string);
      });
      completed.push({ run, kinds });
    };
    await act(async () => { store = root.render(<Field key={run} terrainSeed={12345} progressiveMount onInitialMountComplete={ready} />); });
  };
  await render('first');
  let removed = false;
  const unmount = async () => { if (!removed) { removed = true; await act(async () => root.unmount()); } };
  cleanups.push(unmount);
  return { renderer, completed, render, unmount };
}

describe('actual progressive ecology mount completion with no R3F frames', () => {
  it.each(['flora', 'fauna'] as const)('reports %s only after every scheduled layer has actual instance attributes', async kind => {
    const kinds = kind === 'flora' ? FLORA_KINDS : FAUNA_KINDS;
    const world = await mount(kind);
    expect(world.completed).toEqual([]);
    for (let i = 1; i < kinds.length - 1; i++) { await frame(); expect(world.completed).toEqual([]); }
    await frame();
    expect(world.completed).toEqual([{ run: 'first', kinds: [...kinds] }]);
    expect(world.renderer.render).not.toHaveBeenCalled();
  });

  it.each(['flora', 'fauna'] as const)('counts empty %s layers as completed without creating a mesh', async kind => {
    const kinds = kind === 'flora' ? FLORA_KINDS : FAUNA_KINDS;
    control.empty.add(kinds[kinds.length - 1]);
    const world = await mount(kind);
    for (let i = 1; i < kinds.length; i++) await frame();
    expect(world.completed).toEqual([{ run: 'first', kinds: kinds.slice(0, -1) }]);
    expect(world.renderer.render).not.toHaveBeenCalled();
  });

  it.each(['flora', 'fauna'] as const)('cancels the old %s mount when a different world/run replaces it', async kind => {
    const world = await mount(kind); await frame();
    await world.render('replacement');
    for (let i = 0; i < 6; i++) await frame();
    expect(world.completed.map(value => value.run)).toEqual(['replacement']);
    await world.unmount(); await frame();
    expect(world.completed).toHaveLength(1);
  });

  it('does not wait for fauna meshes when the existing quality profile disables fauna', async () => {
    control.faunaDensity = 0;
    const world = await mount('fauna');
    expect(world.completed).toEqual([{ run: 'first', kinds: [] }]);
    expect(world.renderer.render).not.toHaveBeenCalled();
  });
});
