import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  createSystemCompanionBodyTargetHandle,
  readSystemCompanionBodyTarget
} from './systemCompanionBodyTargets.ts';

describe('system companion body target bridge', () => {
  it('publishes an owned, stable render-loop position', () => {
    const handle = createSystemCompanionBodyTargetHandle('test-tidegarden-stable');
    const sample = new THREE.Vector3(10, 20, 30);

    handle.publish(sample);
    const published = handle.read();
    sample.set(100, 200, 300);
    handle.publish({ x: -4, y: 5, z: 6 });

    expect(published).not.toBe(sample);
    expect(handle.read()).toBe(published);
    expect(published?.toArray()).toEqual([-4, 5, 6]);
    handle.remove();
  });

  it('exposes mounted bodies by world id and removes them on teardown', () => {
    const tidegarden = createSystemCompanionBodyTargetHandle('test-tidegarden-read');
    const otherWorld = createSystemCompanionBodyTargetHandle('test-other-world-read');

    tidegarden.publish({ x: 1, y: 2, z: 3 });
    otherWorld.publish({ x: 7, y: 8, z: 9 });

    expect(readSystemCompanionBodyTarget(tidegarden.worldId)?.toArray()).toEqual([1, 2, 3]);
    expect(readSystemCompanionBodyTarget(otherWorld.worldId)?.toArray()).toEqual([7, 8, 9]);

    tidegarden.remove();
    otherWorld.remove();
    expect(readSystemCompanionBodyTarget(tidegarden.worldId)).toBeNull();
    expect(readSystemCompanionBodyTarget(otherWorld.worldId)).toBeNull();
  });

  it('does not let stale runtime cleanup remove a replacement publisher', () => {
    const worldId = 'test-tidegarden-replacement';
    const previousRuntime = createSystemCompanionBodyTargetHandle(worldId);
    const replacementRuntime = createSystemCompanionBodyTargetHandle(worldId);

    previousRuntime.publish({ x: 1, y: 1, z: 1 });
    replacementRuntime.publish({ x: 2, y: 2, z: 2 });
    previousRuntime.remove();

    expect(readSystemCompanionBodyTarget(worldId)?.toArray()).toEqual([2, 2, 2]);
    replacementRuntime.remove();
    expect(readSystemCompanionBodyTarget(worldId)).toBeNull();
  });
});
