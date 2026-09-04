// --- The HUD surface registry -------------------------------------------------------
//
// One declared identity per screen-space surface, so overlap can be MEASURED
// instead of reasoned about.
//
// The problem this exists to solve: the HUD changes shape over the story —
// chapters 1-2 hand the whole screen to the regulation feed, the embodied HUD
// takes over at ch1-anomaly, vitals and inventory appear on milestones, the
// touch controls swap between a cross D-pad and an analog cluster whose height
// depends on `allowSprint`, and cutscenes veil parts of it. Roughly forty-five
// surfaces are placed independently, most of them from literal pixel values,
// viewport percentages, or `calc(env(...))` strings that only a real layout
// engine can resolve. Nothing checked whether any two of them could be on
// screen at once in the same place, so they routinely were.
//
// Every surface listed here is swept for collisions by
// `tools/hud-overlap-sweep.mjs` across beats, breakpoints and input modes. A
// new surface that renders without registering is invisible to the sweep — so
// the sweep also fails on any positioned element it finds carrying no
// `data-hud-surface`. Registering is not optional bookkeeping; it is how the
// invariant stays true after everyone here has moved on.

export const HUD_SURFACE_LAYERS = [
  /** Story/caption prose. Must never sit under a control or another caption. */
  'caption',
  /** Anything the player presses. Owns its space absolutely. */
  'control',
  /** Readouts, ledgers, meters, work orders. */
  'informational',
  /** Projected designators that track world positions. */
  'marker',
  /** Takes the whole screen and suspends play. Exempt from the invariant. */
  'modal',
  /** Full-bleed effect layers with no legible content. Exempt. */
  'fullbleed'
] as const;

export type HudSurfaceLayer = typeof HUD_SURFACE_LAYERS[number];

/** Layers whose members may overlap anything — they carry no readable content. */
export const EXEMPT_HUD_SURFACE_LAYERS: readonly HudSurfaceLayer[] = ['modal', 'fullbleed'];

/**
 * Every registered surface id. Grouped by owner, matching the components.
 * Keep ids stable: the sweep's allow-list and its reports key on them.
 */
export const HUD_SURFACE_IDS = [
  // Story captions and voice
  'story-caption',
  'audit-band',
  // Regulation feed (chapters 1-2)
  'feed-work-order',
  'feed-camera-status',
  'feed-violation-flood',
  'feed-ledger',
  'feed-nav-title',
  'feed-interaction-prompt',
  'feed-harvest-readout',
  'feed-objective-marker',
  'feed-redaction-box',
  'feed-redaction-indicator',
  'survey-bracket-layer',
  // Embodied story guidance
  'story-guidance-card',
  'story-journal-trigger',
  'free-marker',
  // Core HUD
  'vitals-meter',
  'inventory-panel',
  'build-hotbar',
  'build-palette',
  'looked-at-indicator',
  'interaction-prompt',
  'resource-gain-toast',
  'orbital-minimap',
  'cockpit-readout',
  'multiplayer-status',
  'hud-corner-actions',
  'hud-systems-menu',
  'map-overlay-chrome',
  'pointer-lock-recovery',
  'target-reticle',
  'mining-progress',
  // Touch controls
  'touch-joystick',
  'touch-action-cluster',
  'touch-dpad',
  'touch-dpad-actions',
  // Screening chrome (movie mode only)
  'movie-status'
] as const;

export type HudSurfaceId = typeof HUD_SURFACE_IDS[number];

/**
 * Pairs permitted to intersect, with the reason. Keep this list SHORT and
 * justified — every entry is a place the player can see two things stacked.
 */
export const ALLOWED_HUD_SURFACE_OVERLAPS: ReadonlyArray<{
  a: HudSurfaceId;
  b: HudSurfaceId;
  because: string;
}> = [
  {
    a: 'vitals-meter',
    b: 'inventory-panel',
    because: 'The mobile suit disclosure expands vitals over the inventory it also hides.'
  },
  {
    a: 'map-overlay-chrome',
    b: 'free-marker',
    because: 'The survey chart is a deliberate full-screen takeover; the marker rides above it.'
  }
];

/**
 * Spread onto a surface's root element:
 *   <div {...hudSurface('story-caption', 'caption')} />
 */
export function hudSurface(
  id: HudSurfaceId,
  layer: HudSurfaceLayer
): { 'data-hud-surface': HudSurfaceId; 'data-hud-layer': HudSurfaceLayer } {
  return { 'data-hud-surface': id, 'data-hud-layer': layer };
}

/** True when the pair is explicitly permitted to intersect, in either order. */
export function hudOverlapAllowed(a: string, b: string): boolean {
  return ALLOWED_HUD_SURFACE_OVERLAPS.some(
    entry => (entry.a === a && entry.b === b) || (entry.a === b && entry.b === a)
  );
}
