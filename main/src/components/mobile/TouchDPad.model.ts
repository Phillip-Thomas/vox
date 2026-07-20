import { KEY_CODES } from '../../utils/mobileInput.ts';
import type { StoryBeat } from '../../story/storyState.ts';

// Pure model for the early-era virtual D-PAD. Kept separate from the React
// component so the mount action set, the era palette, and the discrete
// direction→WASD synthesis are all deterministically testable (node env).

export type DpadDirection = 'up' | 'down' | 'left' | 'right';

export type DpadActionSpec = {
  id: string;
  label: string;
  ariaLabel: string;
  /** KeyboardControls `code` this button synthesizes (same path as desktop). */
  code: string;
};

/**
 * Era palette for the monochrome ladder. Every beat that mounts the D-PAD
 * (`storyUsesEarlyTouchDpad`) is a pre-color CCTV/regulation-feed era, so the
 * control is styled in the exact regulation-feed ink-on-black language sourced
 * from RegulationFeedHud (FEED_INK / rgba(2,4,3) glass), never the cyan HUD
 * accent. The shape is retained as a function so an accent-tinted era could be
 * themed here later without touching the component.
 */
export interface DpadEraTheme {
  /** Bright ink for pressed segments, labels, and the action glyph. */
  ink: string;
  /** Dim ink for idle segment strokes and secondary text. */
  inkDim: string;
  /** Near-black regulation-feed glass fill. */
  glass: string;
  /** Stronger glass fill for a pressed/active segment. */
  glassActive: string;
  /** Whether this era renders in monochrome (true for the whole ch1 ladder). */
  monochrome: boolean;
}

// Sourced from src/story/feed/RegulationFeedHud.tsx (FEED_INK / FEED_INK_DIM and
// the rgba(2,4,3,*) feed glass) so the pad reads as the same CCTV surface.
export const FEED_DPAD_INK = 'rgba(228,236,231,0.92)';
export const FEED_DPAD_INK_DIM = 'rgba(228,236,231,0.5)';
export const FEED_DPAD_GLASS = 'rgba(2,4,3,0.62)';
export const FEED_DPAD_GLASS_ACTIVE = 'rgba(228,236,231,0.16)';

const MONOCHROME_FEED_THEME: DpadEraTheme = {
  ink: FEED_DPAD_INK,
  inkDim: FEED_DPAD_INK_DIM,
  glass: FEED_DPAD_GLASS,
  glassActive: FEED_DPAD_GLASS_ACTIVE,
  monochrome: true
};

export function dpadEraTheme(_beat: StoryBeat | null): DpadEraTheme {
  // The whole early ladder is the monochrome regulation-feed era.
  return MONOCHROME_FEED_THEME;
}

/** Map a discrete direction to the WASD `code` the controllers already listen for. */
export function dpadDirectionKey(direction: DpadDirection): string {
  switch (direction) {
    case 'up': return KEY_CODES.forward;
    case 'down': return KEY_CODES.backward;
    case 'left': return KEY_CODES.left;
    case 'right': return KEY_CODES.right;
  }
}

/**
 * The set of WASD codes that should be held for the currently-pressed direction
 * buttons. Multitouch (two adjacent segments) yields a diagonal — the discrete
 * 8-way behaviour — with no analog magnitude.
 */
export function dpadActiveKeys(directions: Iterable<DpadDirection>): string[] {
  const codes = new Set<string>();
  for (const direction of directions) codes.add(dpadDirectionKey(direction));
  return [...codes];
}

/**
 * The single contextual action button an early beat needs, or null for pure
 * traversal beats. The fixed-screen harvest and the raster quota both extract
 * with HOLD [E] on desktop (the `delete`/KeyE harvest path); the pods, nav, and
 * iso beats complete by walk-over/entry and need no button.
 */
export function dpadActionForBeat(beat: StoryBeat | null): DpadActionSpec | null {
  if (beat === 'ch1-fixed' || beat === 'ch1-raster') {
    return {
      id: 'extract',
      label: 'EXTRACT',
      ariaLabel: 'Extract — hold to harvest',
      code: KEY_CODES.mine // 'KeyE' — the desktop harvest/delete key.
    };
  }
  return null;
}
