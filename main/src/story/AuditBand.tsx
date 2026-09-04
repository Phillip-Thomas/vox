import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { theme } from '../ui/theme.ts';
import { getStoryText, getStoryTextVersion, subscribeStoryText } from './storyText.ts';
import { storyNow } from './storyClock.ts';
import { hudSurface } from '../ui/hudSurfaces.ts';
import { readTopLeftHudOcclusion } from './ux/storyHudLayout.ts';

/** Below the 11vh letterbox bars; the band must survive cutscenes. */
const DEFAULT_TOP_FRACTION = 0.135;
const DEFAULT_TOP = `${DEFAULT_TOP_FRACTION * 100}%`;
const OCCLUSION_GAP_PX = 14;
const OCCLUSION_SAMPLE_INTERVAL_MS = 200;
let occlusionSampledAt = 0;
let occludedTop: number | null = null;

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
      const elapsed = storyNow() - audit.shownAt;
      const revealed = Math.min(audit.text.length, Math.floor(elapsed / 22));
      el.textContent = audit.text.slice(0, revealed);
      const fadeStart = audit.ttlMs - 600;
      const root = el.parentElement!;
      root.style.opacity = elapsed > fadeStart
        ? String(Math.max(0, 1 - (elapsed - fadeStart) / 600))
        : '1';
      // The band is a CENTRED banner near the top of the frame, and on a narrow
      // phone the vitals/inventory corner reaches into that centre — the HUD
      // overlap sweep caught it clipping the inventory panel by 24x37px at
      // ch4-audit on a 320px viewport. Drop below whatever is actually occupying
      // the corner, measured, rather than guessing a percentage that happens to
      // clear today's panel widths.
      const now = typeof performance === 'undefined' ? Date.now() : performance.now();
      if (now - occlusionSampledAt >= OCCLUSION_SAMPLE_INTERVAL_MS) {
        occlusionSampledAt = now;
        const occlusion = readTopLeftHudOcclusion();
        const rect = root.getBoundingClientRect();
        // Compare against the band's RESTING position, never its current one.
        // Measuring where the band is right now makes the test depend on its
        // own output: once displaced it clears the corner, so the corner reads
        // as free, so it snaps back and collides again — a 200ms oscillation
        // that also left the overlap on screen half the time. Horizontal extent
        // is unaffected by the displacement, so it is safe to read live.
        const restingTop = window.innerHeight * DEFAULT_TOP_FRACTION;
        const reachesBand = !!occlusion
          && occlusion.right > rect.left
          && occlusion.bottom > restingTop;
        occludedTop = reachesBand && occlusion
          ? occlusion.bottom + OCCLUSION_GAP_PX
          : null;
      }
      root.style.top = occludedTop === null ? DEFAULT_TOP : `${occludedTop}px`;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [audit]);

  if (!audit) return null;
  if (storyNow() - audit.shownAt > audit.ttlMs) return null;

  return (
    <div
      aria-live="polite"
      {...hudSurface('audit-band', 'caption')}
      style={{
        position: 'fixed',
        left: '50%',
        // Below the letterbox bars (11vh) — the band must survive cutscenes.
        // Re-solved per frame when top-left chrome reaches into the centre.
        top: DEFAULT_TOP,
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
