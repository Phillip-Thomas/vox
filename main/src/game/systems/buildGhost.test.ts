import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearBuildGhost,
  getBuildGhost,
  setBuildGhost,
  subscribeBuildGhost
} from './buildGhost.ts';

beforeEach(() => clearBuildGhost());

describe('build ghost feedback', () => {
  it('publishes a specific blocked reason and clears back to no target', () => {
    setBuildGhost([1, 2, 3], 0, 'wall', false, 2, 0, 'occupied');
    expect(getBuildGhost()).toMatchObject({ active: true, valid: false, reason: 'occupied' });
    clearBuildGhost();
    expect(getBuildGhost()).toMatchObject({ active: false, valid: false, reason: 'no_target' });
  });

  it('notifies the HUD only when semantic feedback changes', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeBuildGhost(listener);
    setBuildGhost([1, 2, 3], 0, 'wall', false, 2, 0, 'unsupported');
    setBuildGhost([2, 2, 3], 0, 'wall', false, 2, 0, 'unsupported');
    setBuildGhost([2, 2, 3], 0, 'wall', true, 2, 0, null);
    unsubscribe();
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
