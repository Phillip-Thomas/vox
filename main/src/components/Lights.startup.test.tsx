import { act } from 'react';
import { advance, createRoot, extend, type RootStore } from '@react-three/fiber';
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Campfires } from './Lights.tsx';
import { getCampfires, placeCampfire, removeCampfireAt, resetCampfires } from '../game/systems/campfires.ts';
import { saveWorld } from '../game/systems/persistence.ts';

extend({
  Group: THREE.Group, Mesh: THREE.Mesh, PointLight: THREE.PointLight,
  TorusGeometry: THREE.TorusGeometry, CylinderGeometry: THREE.CylinderGeometry,
  ConeGeometry: THREE.ConeGeometry, MeshStandardMaterial: THREE.MeshStandardMaterial
});
const cleanups: Array<() => Promise<void>> = [];
beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key)
  });
  resetCampfires();
});
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  resetCampfires();
  vi.unstubAllGlobals();
});

// Exercise the installed R3F reconciler and actual scene lights; only the final
// WebGL draw endpoint is replaced so this ordering test requires no GPU lease.
async function scene(seed: number, prerequisite: { pos: [number, number, number]; up: [number, number, number] } | null) {
  const canvas = { width: 128, height: 128, style: {}, addEventListener() {}, removeEventListener() {} } as unknown as HTMLCanvasElement;
  const frames: THREE.PointLight[][] = [];
  const renderer = {
    render(scene: THREE.Scene) {
      const lights: THREE.PointLight[] = [];
      scene.traverseVisible(object => { if (object instanceof THREE.PointLight) lights.push(object); });
      frames.push(lights);
    },
    setPixelRatio() {}, setSize() {},
    xr: { enabled: false, isPresenting: false, addEventListener() {}, removeEventListener() {}, setAnimationLoop() {} }
  };
  const root = createRoot(canvas);
  await root.configure({ gl: renderer as never, frameloop: 'never', size: { width: 128, height: 128, top: 0, left: 0 } });
  let store: RootStore;
  await act(async () => { store = root.render(<Campfires terrainSeed={seed} hydrationPrerequisite={prerequisite} />); });
  cleanups.push(async () => { await act(async () => { root.unmount(); }); });
  return {
    draw: () => { advance(0, true, store!.getState()); return frames[frames.length - 1]; }
  };
}

describe('initial campfire light cardinality', () => {
  it('restores saved real fire lights before the first world draw and retains later place/remove updates', async () => {
    placeCampfire(new THREE.Vector3(1, 50, 3), new THREE.Vector3(0, 1, 0));
    placeCampfire(new THREE.Vector3(5, 50, 7), new THREE.Vector3(0, 1, 0));
    saveWorld(12345);
    resetCampfires();
    const world = await scene(12345, { pos: [20, 50, 20], up: [0, 1, 0] });
    const initial = world.draw();
    expect(initial).toHaveLength(2);
    expect(getCampfires()).toHaveLength(2); // A saved fire suppresses the rehearsal prerequisite.
    expect(initial.map(light => [light.distance, light.decay, light.castShadow])).toEqual([[28, 2, false], [28, 2, false]]);
    await act(async () => { placeCampfire(new THREE.Vector3(10, 50, 10), new THREE.Vector3(0, 1, 0)); });
    expect(world.draw()).toHaveLength(3);
    await act(async () => { removeCampfireAt([1, 50, 3], [0, 1, 0]); });
    expect(world.draw()).toHaveLength(2);
  });

  it('installs exactly the rehearsal fire when the saved world has none', async () => {
    const world = await scene(6789, { pos: [4, 51, -4], up: [0, 1, 0] });
    expect(world.draw()).toHaveLength(1);
    expect(getCampfires().map(fire => fire.pos)).toEqual([[4, 51, -4]]);
  });

  it('does not create any light in an empty world without a prerequisite', async () => {
    const world = await scene(9999, null);
    expect(world.draw()).toHaveLength(0);
    expect(getCampfires()).toHaveLength(0);
  });
});
