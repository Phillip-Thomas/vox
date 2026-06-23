import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { placeCampfire, getCampfires, getCampfireVersion, resetCampfires } from './campfires.ts';

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

  it('reset clears all (world swap)', () => {
    placeCampfire(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0));
    resetCampfires();
    expect(getCampfires()).toHaveLength(0);
  });
});
