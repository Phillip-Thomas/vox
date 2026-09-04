import React, { useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { theme } from '../ui/theme.ts';
import { isTouchDevice } from '../utils/mobileInput.ts';
import { getStoryText, getStoryTextVersion, subscribeStoryText } from './storyText.ts';
import { storyNow } from './storyClock.ts';
import { getActiveGuidedStoryObjective } from './ux/objectiveDirector.ts';
import { presentInputGlyphs } from './ux/inputGlyphs.ts';
import {
  getMeasuredStoryObjectiveCardHeight,
  readStoryHudSafeAreaInsets,
  readTouchControlClearance,
  solveStoryHudLayout
} from './ux/storyHudLayout.ts';
import { hudSurface } from '../ui/hudSurfaces.ts';

/** How often the mounted-control clearance is re-measured (ms). */
const TOUCH_CONTROL_SAMPLE_MS = 200;

// --- The awakening voice -----------------------------------------------------------
//
// Bottom-center captions, lowercase, typewriter-revealed. This is the player's
// interior — it never uses the regulation register, never explains, and only
// exists once color does. System lines share the renderer with a dimmer ink.

const StoryCaptions: React.FC = () => {
  useSyncExternalStore(subscribeStoryText, getStoryTextVersion, getStoryTextVersion);
  const text = getStoryText();
  const rootRef = useRef<HTMLDivElement>(null);
  const captionRef = useRef<HTMLDivElement>(null);

  const active = text.caption ?? text.system;
  const isSystem = !text.caption && !!text.system;

  useLayoutEffect(() => {
    if (!active) return;
    let raf = 0;
    let viewportWidth = window.innerWidth;
    let viewportHeight = window.innerHeight;
    let safeAreaInsets = readStoryHudSafeAreaInsets();
    // Sampled, not read per frame: getBoundingClientRect + getComputedStyle
    // force layout, and the controls only change on beat/mode changes.
    let controlClearance = readTouchControlClearance();
    let controlSampledAt = 0;
    const el = captionRef.current;
    // Awakened captions carry key hints ([SHIFT] run, [M] chart, hold [E] …).
    // On touch they must name the mounted controls, so present the line once and
    // typewriter-reveal the presented text.
    const shownText = presentInputGlyphs(active.text, isTouchDevice());
    const refreshViewport = () => {
      viewportWidth = window.innerWidth;
      viewportHeight = window.innerHeight;
      safeAreaInsets = readStoryHudSafeAreaInsets();
    };
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const now = typeof performance === 'undefined' ? Date.now() : performance.now();
      if (now - controlSampledAt >= TOUCH_CONTROL_SAMPLE_MS) {
        controlSampledAt = now;
        controlClearance = readTouchControlClearance();
      }
      const root = rootRef.current;
      if (!el || !root) return;
      const layout = solveStoryHudLayout({
        viewportWidth,
        viewportHeight,
        touch: isTouchDevice(),
        objectivePresent: getActiveGuidedStoryObjective() !== null,
        objectiveHeight: getMeasuredStoryObjectiveCardHeight(),
        touchControlTopFromBottom: controlClearance,
        safeAreaInsets
      });
      root.style.left = `${layout.caption.left}px`;
      root.style.bottom = `${layout.caption.bottom}px`;
      root.style.maxWidth = `${layout.caption.maxWidth}px`;
      root.dataset.captionPlacement = layout.caption.placement;
      const elapsed = storyNow() - active.shownAt;
      const revealed = Math.min(shownText.length, Math.floor(elapsed / 34));
      el.textContent = shownText.slice(0, revealed);
      const fadeStart = active.ttlMs - 700;
      el.style.opacity = elapsed > fadeStart
        ? String(Math.max(0, 1 - (elapsed - fadeStart) / 700))
        : '1';
    };
    window.addEventListener('resize', refreshViewport);
    window.addEventListener('orientationchange', refreshViewport);
    window.visualViewport?.addEventListener('resize', refreshViewport);
    // Layout effects run before paint; applying the first safe-area-aware frame
    // synchronously prevents the caption from flashing through the card.
    tick();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', refreshViewport);
      window.removeEventListener('orientationchange', refreshViewport);
      window.visualViewport?.removeEventListener('resize', refreshViewport);
    };
  }, [active]);

  if (!active) return null;
  const expired = storyNow() - active.shownAt > active.ttlMs;
  if (expired) return null;
  const initialLayout = solveStoryHudLayout({
    viewportWidth: typeof window === 'undefined' ? 1280 : window.innerWidth,
    viewportHeight: typeof window === 'undefined' ? 720 : window.innerHeight,
    touch: isTouchDevice(),
    objectivePresent: getActiveGuidedStoryObjective() !== null,
    objectiveHeight: getMeasuredStoryObjectiveCardHeight()
  });

  return (
    <div
      ref={rootRef}
      aria-live="polite"
      data-story-caption="true"
      {...hudSurface('story-caption', 'caption')}
      data-caption-placement={initialLayout.caption.placement}
      style={{
        position: 'fixed',
        left: initialLayout.caption.left,
        bottom: initialLayout.caption.bottom,
        transform: 'translateX(-50%)',
        zIndex: theme.z.hud + 4,
        pointerEvents: 'none',
        fontFamily: theme.font.mono,
        fontSize: 15,
        letterSpacing: '0.06em',
        color: isSystem ? theme.color.textDim : theme.color.text,
        textShadow: '0 1px 14px rgba(0,0,0,0.75)',
        width: 'max-content',
        maxWidth: initialLayout.caption.maxWidth,
        boxSizing: 'border-box',
        paddingInline: 8,
        lineHeight: 1.55,
        overflowWrap: 'anywhere',
        textAlign: 'center'
      }}
    >
      <div ref={captionRef} />
    </div>
  );
};

export default StoryCaptions;
