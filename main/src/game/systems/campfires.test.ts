import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { canPlaceCampfire, placeCampfire, getCampfires, getCampfireVersion, resetCampfires, restoreCampfires } from './campfires.ts';

beforeEach(() => resetCampfires());

describe('placed campfires', () => {
  it('placing records position + up and bumps the version', () => {
    const v0 = getCampfireVersion();
    placeCampfire(new THREE.Vector3(1, 2, 3), new THREE.Vector3(0, 1, 0));
    expect(getCampfires()).toHaveLength(1);
    expect(getCampfires()[0].pos).toEqual([1, 2, 3]);
    expect(getCampfireVersion()).toBeGreaterThan(v0);
  });

  it('each placement gets a distinct id', () => {
    placeCampfire(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0));
    placeCampfire(new THREE.Vector3(5, 0, 0), new THREE.Vector3(0, 1, 0));
    const [a, b] = getCampfires();
    expect(a.id).not.toBe(b.id);
  });

  it('rejects a second fire inside the clear-ground spacing', () => {
    placeCampfire(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0));
    expect(canPlaceCampfire(new THREE.Vector3(1, 0, 0))).toEqual({ ok: false, reason: 'too_close' });
    expect(canPlaceCampfire(new THREE.Vector3(3, 0, 0))).toEqual({ ok: true });
  });

  it('records and restores owner metadata', () => {
    placeCampfire(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0), 'alice');
    expect(getCampfires()[0]).toMatchObject({ ownerId: 'alice', placedBy: 'alice' });

    resetCampfires();
    restoreCampfires([{ pos: [1.25, 2.5, 3.75], up: [0, 0.707, 0.707], ownerId: 'alice', placedBy: 'bob' }]);

    expect(getCampfires()[0]).toMatchObject({ pos: [1.25, 2.5, 3.75], ownerId: 'alice', placedBy: 'bob' });
  });

  it('does not duplicate restored campfires at the same world position', () => {
    const saved = { pos: [1.25, 2.5, 3.75] as [number, number, number], up: [0, 0.707, 0.707] as [number, number, number], ownerId: 'alice', placedBy: 'bob' };

    restoreCampfires([saved]);
    restoreCampfires([saved]);

    expect(getCampfires()).toHaveLength(1);
  });

  it('reset clears all (world swap)', () => {
    placeCampfire(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0));
    resetCampfires();
    expect(getCampfires()).toHaveLength(0);
  });
});
