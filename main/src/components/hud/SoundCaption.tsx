// --- The sound-caption surface -------------------------------------------------------
//
// The accessibility promise of the 2026-09-04-audio-10x run, made visible: no
// information exists only in audio. When the "sound captions" setting is on, the
// four bracketed cue families (soundCaptionTable.ts) appear here as UPPERCASE
// bracketed sound names.
//
// Cinematography owns this presentation; CHAPTER OWNS THE WORDS, which live in
// soundCaptionTable.ts and are never authored here.
//
// Why this is its own surface and not the caption home:
//   Layer 'informational', NOT 'caption'. The HUD sweep then FORBIDS it from ever
//   sitting under `story-caption` or `audit-band`. A bracketed institutional
//   sound name and a lowercase interior caption must never share a strip of screen;
//   the whole two-register law depends on the player never confusing them.
//   Typography is therefore the AUDIT BAND's — mono 12 px / 0.14em uppercase — and
//   deliberately not the lowercase caption's 15 px / 0.06em.
//
// Placement: top-right on desktop. On touch it sits above the measured
// touch-action-cluster clearance and NEVER bottom-centre, which is the captions'
// home.
//
// This component is NOT wired to any emitter. It renders from its own event API
// (`postSoundCaption` / `subscribeSoundCaptions`) so any emitter — the SFX rim, the
// story director, a probe — can raise a caption once Stage 4/6 binds the call
// sites. Until then it renders nothing and the surface is silent by construction.

import { useEffect, useState } from 'react';
import { theme } from '../../ui/theme.ts';
import { hudSurface } from '../../ui/hudSurfaces.ts';
import { readTouchControlClearance } from '../../story/ux/storyHudLayout.ts';
import {
  SOUND_CAPTION_FADE_MS,
  SOUND_CAPTION_HOLD_MS,
  soundCaptionEntry
} from './soundCaptionTable.ts';
import type { SoundCaptionId } from './soundCaptionTable.ts';

// --- Placement (pure, so the sweep's expectations can be unit-tested) -----------------

/** Clears the vitals-meter band at the top of the frame. */
export const SOUND_CAPTION_DESKTOP_TOP_PX = 96;
export const SOUND_CAPTION_DESKTOP_RIGHT_PX = 18;
/** Gap above whatever the touch controls actually occupy. */
export const SOUND_CAPTION_TOUCH_GAP_PX = 16;
/** Below this width the desktop top-right corner is too crowded to use. */
export const SOUND_CAPTION_NARROW_WIDTH_PX = 820;

export interface SoundCaptionPlacementInput {
  viewportWidthPx: number;
  touch: boolean;
  /** From `readTouchControlClearance()`; ignored when `touch` is false. */
  touchControlClearancePx: number;
}

export interface SoundCaptionPlacement {
  /** CSS `top`, or null when the surface is anchored from the bottom. */
  top: string | null;
  bottom: string | null;
  right: string;
  /** Never 'center': bottom-centre is the captions' home and is refused here. */
  align: 'right';
}

export function solveSoundCaptionPlacement(
  input: SoundCaptionPlacementInput
): SoundCaptionPlacement {
  if (input.touch || input.viewportWidthPx < SOUND_CAPTION_NARROW_WIDTH_PX) {
    const clearance = Math.max(0, input.touchControlClearancePx);
    return {
      top: null,
      bottom: `${clearance + SOUND_CAPTION_TOUCH_GAP_PX}px`,
      right: `${SOUND_CAPTION_DESKTOP_RIGHT_PX}px`,
      align: 'right'
    };
  }
  return {
    top: `${SOUND_CAPTION_DESKTOP_TOP_PX}px`,
    bottom: null,
    right: `${SOUND_CAPTION_DESKTOP_RIGHT_PX}px`,
    align: 'right'
  };
}

// --- The event API -------------------------------------------------------------------

export interface SoundCaptionEvent {
  id: SoundCaptionId;
  label: string;
  /** Monotonic counter; a restart of the same family bumps it. */
  token: number;
  reducedMotion: boolean;
}

export interface PostSoundCaptionOptions {
  reducedMotion?: boolean;
  /** Test/probe seam: the clock the hold is measured against. */
  now?: number;
}

type Listener = (event: SoundCaptionEvent | null) => void;

const listeners = new Set<Listener>();
let current: SoundCaptionEvent | null = null;
let token = 0;
let holdTimer: ReturnType<typeof setTimeout> | null = null;

function publish(next: SoundCaptionEvent | null): void {
  current = next;
  for (const listener of listeners) listener(next);
}

/**
 * Raise a caption for a cue.
 *
 * Returns false when the cue is deliberately uncaptioned — the lifecycle cues, the
 * oxygen pulse and every voiced narrator line. That is not a failure: the table
 * names the surface that carries their parity instead, and a bracket over a voiced
 * line would name a speaker.
 *
 * One caption per cue kind at a time. A second klaxon RESTARTS the hold; it does
 * not stack, because two brackets in the corner is a list, and a list is not a
 * sound.
 */
export function postSoundCaption(
  id: SoundCaptionId,
  options: PostSoundCaptionOptions = {}
): boolean {
  const entry = soundCaptionEntry(id);
  if (!entry || entry.label === null) return false;
  if (holdTimer) clearTimeout(holdTimer);
  token += 1;
  publish({
    id,
    label: entry.label,
    token,
    reducedMotion: options.reducedMotion ?? false
  });
  const life = SOUND_CAPTION_HOLD_MS + (options.reducedMotion ? 0 : SOUND_CAPTION_FADE_MS);
  holdTimer = setTimeout(() => {
    holdTimer = null;
    publish(null);
  }, life);
  return true;
}

export function subscribeSoundCaptions(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function readSoundCaption(): SoundCaptionEvent | null {
  return current;
}

/** Drop the surface immediately — a beat exit, a reset, or a test between cases. */
export function clearSoundCaptions(): void {
  if (holdTimer) clearTimeout(holdTimer);
  holdTimer = null;
  publish(null);
}

// --- The component -------------------------------------------------------------------

const SoundCaption: React.FC = () => {
  const [event, setEvent] = useState<SoundCaptionEvent | null>(() => readSoundCaption());

  useEffect(() => subscribeSoundCaptions(setEvent), []);

  if (!event) return null;

  const touch = typeof window !== 'undefined' && 'ontouchstart' in window;
  const viewportWidthPx = typeof window === 'undefined' ? 1920 : window.innerWidth;
  const clearance = touch ? readTouchControlClearance() : 0;
  const placement = solveSoundCaptionPlacement({
    viewportWidthPx,
    touch,
    touchControlClearancePx: clearance
  });

  return (
    <div
      aria-live="polite"
      data-sound-caption={event.id}
      data-sound-caption-reduced-motion={event.reducedMotion ? 'true' : 'false'}
      {...hudSurface('sound-caption', 'informational')}
      style={{
        position: 'fixed',
        right: placement.right,
        ...(placement.top === null ? { bottom: placement.bottom! } : { top: placement.top }),
        zIndex: theme.z.hud + 3,
        pointerEvents: 'none',
        // The AUDIT BAND's type, not the caption's: this is the institution
        // naming a sound, and it must read as the same voice.
        fontFamily: theme.font.mono,
        fontSize: 12,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: theme.color.text,
        background: 'rgba(4, 10, 8, 0.42)',
        padding: '4px 10px',
        borderRadius: 3,
        textShadow: '0 1px 12px rgba(0,0,0,0.8)',
        // Reduced motion: hard show and hide, never a fade and never a pulse.
        transition: event.reducedMotion ? 'none' : `opacity ${SOUND_CAPTION_FADE_MS}ms linear`
      }}
    >
      {event.label}
    </div>
  );
};

export default SoundCaption;
