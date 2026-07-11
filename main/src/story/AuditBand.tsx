import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { theme } from '../ui/theme.ts';
import { getStoryText, getStoryTextVersion, subscribeStoryText } from './storyText.ts';

// --- The audit band ------------------------------------------------------------------
//
// The regulation voice AFTER the feed's death (ch3-signal onward): a small caps
// line at the top of the frame. Deliberately modest — no scanlines, no vignette,
// no chrome. The system is a voice in the player's world now, not the world
// itself. Typewriter reveal shares the caption grammar (same clock, colder ink).

const AuditBand: React.FC = () => {
  useSyncExternalStore(subscribeStoryText, getStoryTextVersion, getStoryTextVersion);
  const audit = getStoryText().audit;
  const lineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!audit) return;
    let raf = 0;
    const el = lineRef.current;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!el) return;
      const elapsed = performance.now() - audit.shownAt;
      const revealed = Math.min(audit.text.length, Math.floor(elapsed / 22));
      el.textContent = audit.text.slice(0, revealed);
      const fadeStart = audit.ttlMs - 600;
      el.parentElement!.style.opacity = elapsed > fadeStart
        ? String(Math.max(0, 1 - (elapsed - fadeStart) / 600))
        : '1';
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [audit]);

  if (!audit) return null;
  if (performance.now() - audit.shownAt > audit.ttlMs) return null;

  return (
    <div
      aria-live="polite"
      style={{
        position: 'fixed',
        left: '50%',
        // Below the letterbox bars (11vh) — the band must survive cutscenes.
        top: '13.5%',
        transform: 'translateX(-50%)',
        zIndex: theme.z.hud + 4,
        pointerEvents: 'none',
        fontFamily: theme.font.mono,
        textAlign: 'center',
        maxWidth: 'min(84vw, 720px)',
        // Legible over any sky: a quiet dark pill, not a chrome panel.
        background: 'rgba(4, 10, 8, 0.42)',
        padding: '6px 14px',
        borderRadius: 3
      }}
    >
      {audit.header && (
        <div
          style={{
            fontSize: 10,
            letterSpacing: '0.22em',
            color: theme.color.textDim,
            marginBottom: 4
          }}
        >
          {audit.header}
        </div>
      )}
      <div
        ref={lineRef}
        style={{
          fontSize: 13,
          letterSpacing: '0.14em',
          color: theme.color.text,
          textShadow: '0 1px 12px rgba(0,0,0,0.8)'
        }}
      />
    </div>
  );
};

export default AuditBand;
