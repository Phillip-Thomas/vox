import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { theme } from '../ui/theme.ts';
import { getStoryText, getStoryTextVersion, subscribeStoryText } from './storyText.ts';

// --- The awakening voice -----------------------------------------------------------
//
// Bottom-center captions, lowercase, typewriter-revealed. This is the player's
// interior — it never uses the regulation register, never explains, and only
// exists once color does. System lines share the renderer with a dimmer ink.

const StoryCaptions: React.FC = () => {
  useSyncExternalStore(subscribeStoryText, getStoryTextVersion, getStoryTextVersion);
  const text = getStoryText();
  const captionRef = useRef<HTMLDivElement>(null);

  const active = text.caption ?? text.system;
  const isSystem = !text.caption && !!text.system;

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const el = captionRef.current;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!el) return;
      const elapsed = performance.now() - active.shownAt;
      const revealed = Math.min(active.text.length, Math.floor(elapsed / 34));
      el.textContent = active.text.slice(0, revealed);
      const fadeStart = active.ttlMs - 700;
      el.style.opacity = elapsed > fadeStart
        ? String(Math.max(0, 1 - (elapsed - fadeStart) / 700))
        : '1';
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  if (!active) return null;
  const expired = performance.now() - active.shownAt > active.ttlMs;
  if (expired) return null;

  return (
    <div
      aria-live="polite"
      style={{
        position: 'fixed',
        left: '50%',
        bottom: '12%',
        transform: 'translateX(-50%)',
        zIndex: theme.z.hud + 4,
        pointerEvents: 'none',
        fontFamily: theme.font.mono,
        fontSize: 15,
        letterSpacing: '0.06em',
        color: isSystem ? theme.color.textDim : theme.color.text,
        textShadow: '0 1px 14px rgba(0,0,0,0.75)',
        maxWidth: 'min(80vw, 640px)',
        textAlign: 'center'
      }}
    >
      <div ref={captionRef} />
    </div>
  );
};

export default StoryCaptions;
