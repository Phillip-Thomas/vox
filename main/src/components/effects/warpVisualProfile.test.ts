import { describe, expect, it } from 'vitest';
import type { WarpKind } from '../../game/playerFlight.ts';
import { warpVisualProfile } from './warpVisualProfile.ts';

describe('warp visual profile', () => {
  it('reserves radial motion for real interstellar travel', () => {
    const kinds: WarpKind[] = ['travel', 'enter', 'leave', 'system_handoff'];
    expect(kinds.filter(kind => warpVisualProfile(kind).radialStreaks)).toEqual(['travel']);
  });

  it('keeps atmosphere boundaries translucent and ownership handoffs covered', () => {
    expect(warpVisualProfile('enter').atmosphereBoundary).toBe(true);
    expect(warpVisualProfile('leave').atmosphereBoundary).toBe(true);
    expect(warpVisualProfile('enter').fullViewportCover).toBe(false);
    expect(warpVisualProfile('system_handoff').fullViewportCover).toBe(true);
  });
});
