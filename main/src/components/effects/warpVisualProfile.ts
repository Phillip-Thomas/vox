import type { WarpKind } from '../../game/playerFlight.ts';

export interface WarpVisualProfile {
  radialStreaks: boolean;
  atmosphereBoundary: boolean;
  fullViewportCover: boolean;
}

/** Visual language follows the distance actually travelled, not just a phase flip. */
export function warpVisualProfile(kind: WarpKind): WarpVisualProfile {
  return {
    radialStreaks: kind === 'travel',
    atmosphereBoundary: kind === 'enter' || kind === 'leave',
    fullViewportCover: kind === 'system_handoff'
  };
}
