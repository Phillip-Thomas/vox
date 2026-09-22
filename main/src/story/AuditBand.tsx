import React, { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { theme } from '../ui/theme.ts';
import { getStoryText, getStoryTextVersion, subscribeStoryText } from './storyText.ts';
import { storyNow } from './storyClock.ts';
import { hudSurface } from '../ui/hudSurfaces.ts';
import { readTopLeftHudOcclusion } from './ux/storyHudLayout.ts';
import { voiceVisibleText } from '../audio/voice/voicePresentation.ts';

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

// --- The klaxon ember pulse (parity member) ------------------------------------------
//
// A deaf player must be able to SEE the klaxon. The parity is one frame of ember on
// the band itself — audit family #ff5a3c, no screen flash, no chrome, no second
// surface. It is already a single frame, so reduced motion leaves it unchanged:
// there is nothing to reduce.
//
// It fires on the same tick as `playSfx('terminalAlarm')` (storyDirector.ts, the
// ch3-signal klaxon repeat). NOTHING CALLS IT YET — Stage 4/6 integration binds the
// emitter, and until it does the band renders exactly as it shipped.
//
// The ember rides the band, so it shows only while the band is on screen. Where the
// klaxon fires with no band — the a2 violation flood — parity is the violation band
// and the klaxon flash already on screen, per the chapter ruling.

export const AUDIT_EMBER_COLOR = '#ff5a3c';

type EmberListener = (token: number) => void;
const emberListeners = new Set<EmberListener>();
let emberToken = 0;

/** Raise one frame of ember on the audit band. */
export function pulseAuditEmber(): void {
  emberToken += 1;
  for (const listener of emberListeners) listener(emberToken);
}

export function subscribeAuditEmber(listener: EmberListener): () => void {
  emberListeners.add(listener);
  return () => {
    emberListeners.delete(listener);
  };
}

export function readAuditEmberToken(): number {
  return emberToken;
}

const AuditBand: React.FC = () => {
  useSyncExternalStore(subscribeStoryText, getStoryTextVersion, getStoryTextVersion);
  const audit = getStoryText().audit;
  const lineRef = useRef<HTMLDivElement>(null);
  const [ember, setEmber] = useState(false);

  // ONE FRAME. The pulse arms on the klaxon tick and disarms on the next animation
  // frame, so it can never become a throb: a throb reads as an ongoing state, and
  // the klaxon is an event.
  useEffect(() => {
    let raf = 0;
    const unsubscribe = subscribeAuditEmber(() => {
      setEmber(true);
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setEmber(false));
    });
    return () => {
      cancelAnimationFrame(raf);
      unsubscribe();
    };
  }, []);

  useLayoutEffect(() => {
    if (!audit) return;
    let raf = 0;
    const el = lineRef.current;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!el) return;
      const elapsed = storyNow() - audit.shownAt;
      const revealed = Math.min(audit.text.length, Math.floor(elapsed / 22) + (audit.voice?.surfaceId === 'ch10-relay' ? 1 : 0));
      el.textContent = audit.text.slice(0, revealed);
      voiceVisibleText(`audit:${audit.shownAt}`, audit.text, revealed, audit.voice?.surfaceId ?? 'audit-band', { slot: audit.voice?.slot });
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
    // The relay anchor publishes the line synchronously; paint and first grain
    // begin in this commit, with subsequent characters on the existing clock.
    if (audit.voice?.surfaceId === 'ch10-relay') tick();
    else raf = requestAnimationFrame(tick);
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
        borderRadius: 3,
        // The klaxon's visual parity, on the band and nowhere else.
        boxShadow: ember ? `inset 0 0 0 1px ${AUDIT_EMBER_COLOR}` : 'none'
      }}
      data-audit-ember={ember ? 'true' : 'false'}
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
