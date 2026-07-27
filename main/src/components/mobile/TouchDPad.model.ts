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

// --- per-beat pad configuration -----------------------------------------------
//
// Owner direction: the pure 2D side-scroller eras carry ONLY ◀ ▶ (one axis) plus
// jump and extract; the top-down / isometric eras open a second axis and add
// ▲ ▼. The arm set is declared per beat here so the component stays presentation
// only (it renders exactly the arms the model lists, and fades the new vertical
// arms in when they first appear).

/** The eras that move on a second (vertical) axis: top-down nav + isometric. */
const TWO_AXIS_DPAD_BEATS = new Set<StoryBeat>(['ch1-nav', 'ch1-iso']);

/** The interactive monochrome-ladder beats that mount the pad at all. */
const EARLY_DPAD_BEATS = new Set<StoryBeat>([
  'ch1-fixed', 'ch1-raster', 'ch1-depth', 'ch1-nav', 'ch1-iso'
]);

/** One-axis side-scroller arms (ch1-fixed/raster/depth). */
export const DPAD_SIDE_ARMS: readonly DpadDirection[] = ['left', 'right'];
/** Two-axis planar arms (ch1-nav/iso), once the new axis opens. */
export const DPAD_PLANAR_ARMS: readonly DpadDirection[] = ['up', 'down', 'left', 'right'];

/**
 * Which direction arms this beat's pad renders. The 2D eras expose only ◀ ▶
 * (W/S are dead there); the top-down/iso eras expose all four. Non-pad beats
 * default to the side arms — the component only mounts on the early ladder.
 */
export function dpadArmsForBeat(beat: StoryBeat | null): DpadDirection[] {
  return beat && TWO_AXIS_DPAD_BEATS.has(beat)
    ? [...DPAD_PLANAR_ARMS]
    : [...DPAD_SIDE_ARMS];
}

/**
 * The JUMP button, or null off the ladder. Every interactive monochrome-ladder
 * beat is a rasterPolicy variant with allowJump === true (storyInputPolicy):
 * the side eras hop, and the isometric era ("isometric height") makes the hop a
 * real traversal verb. So JUMP rides the whole ladder for a consistent thumb
 * position rather than blinking in and out between adjacent top-down beats. It
 * synthesizes Space — the desktop jump key (App KeyboardControls: jump→['Space']).
 */
export function dpadJumpForBeat(beat: StoryBeat | null): DpadActionSpec | null {
  if (!beat || !EARLY_DPAD_BEATS.has(beat)) return null;
  return {
    id: 'jump',
    label: 'JUMP',
    ariaLabel: 'Jump',
    code: KEY_CODES.jump // 'Space' — the desktop jump key.
  };
}

export interface DpadBeatSpec {
  /** Direction arms this beat renders (2 on the side eras, 4 top-down/iso). */
  arms: DpadDirection[];
  /** JUMP button spec (present across the ladder), or null off-ladder. */
  jump: DpadActionSpec | null;
  /** Contextual EXTRACT-style action, or null on pure traversal beats. */
  action: DpadActionSpec | null;
}

/** The complete declarative pad configuration for a beat. */
export function dpadSpecForBeat(beat: StoryBeat | null): DpadBeatSpec {
  return {
    arms: dpadArmsForBeat(beat),
    jump: dpadJumpForBeat(beat),
    action: dpadActionForBeat(beat)
  };
}

// --- held-control reconciliation across a beat transition ---------------------
//
// A finger can still be down on a direction arm or an action button at the exact
// frame the beat advances. If that control's button is no longer part of the new
// beat's spec, React unmounts the <button> WITHOUT firing pointerup/leave/cancel
// (the pointer was captured on the removed element), so the synthetic key it was
// holding would latch forever. The concrete report: holding EXTRACT as
// ch1-raster -> ch1-depth kept KeyE down (non-stop extraction) with no button
// left on screen to release it. The component releases exactly the stale controls
// on the beat seam; these pure predicates make the "which are stale" decision
// deterministically testable.

/** Held directions whose arm the new beat's pad no longer renders. */
export function dpadStaleHeldDirections(
  held: Iterable<DpadDirection>,
  spec: DpadBeatSpec
): DpadDirection[] {
  const live = new Set(spec.arms);
  return [...held].filter(dir => !live.has(dir));
}

/** Held action-button ids (JUMP / EXTRACT) whose button the new beat drops. */
export function dpadStaleHeldActionIds(
  heldIds: Iterable<string>,
  spec: DpadBeatSpec
): string[] {
  const live = new Set<string>();
  if (spec.jump) live.add(spec.jump.id);
  if (spec.action) live.add(spec.action.id);
  return [...heldIds].filter(id => !live.has(id));
}
