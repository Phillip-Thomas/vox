import React, { useEffect, useRef } from 'react';
import { deathCauseSummary, type DeathCause } from '../../game/systems/deathSequence.ts';
import { glassPanel, theme } from '../../ui/theme.ts';

// The recovery choice at the bottom of the death sequence. Opens only once the
// sequence reaches its `panel` phase (DeathSequenceOverlay owns that timing),
// floating over the glyph substrate — so the chrome reads as the biomonitor's
// safe-mode card, phosphor on black, not the usual cyan glass. A11y contract
// is unchanged: focus trap, inert siblings, focus lands on the primary action.

const PHOSPHOR = '#8dffa8';

interface DownedPanelProps {
  open: boolean;
  /** What put the body down — sampled at the moment of death (deathSequence). */
  cause: DeathCause;
  onRecover: () => void;
  onReturnToMenu: () => void;
}

const DownedPanel: React.FC<DownedPanelProps> = ({ open, cause, onRecover, onReturnToMenu }) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const frame = requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLElement>('[data-recovery-primary]')?.focus();
    });
    const overlay = overlayRef.current;
    const parent = overlay?.parentElement;
    const siblings = overlay && parent
      ? [...parent.children].filter((child): child is HTMLElement => child instanceof HTMLElement && child !== overlay)
      : [];
    const previous = siblings.map(element => ({
      element,
      inert: element.inert,
      ariaHidden: element.getAttribute('aria-hidden')
    }));
    for (const element of siblings) {
      element.inert = true;
      element.setAttribute('aria-hidden', 'true');
    }
    return () => {
      cancelAnimationFrame(frame);
      for (const { element, inert, ariaHidden } of previous) {
        element.inert = inert;
        if (ariaHidden == null) element.removeAttribute('aria-hidden');
        else element.setAttribute('aria-hidden', ariaHidden);
      }
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="downed-title"
      onKeyDown={event => {
        if (event.key !== 'Tab') return;
        const focusable = panelRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])');
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
      style={{
        position: 'fixed', inset: 0, zIndex: theme.z.menu + 3,
        display: 'grid', placeItems: 'center', padding: 20,
        fontFamily: theme.font.ui, color: theme.color.text,
        // Light veil only — the glyph substrate stays legible around the card
        // (no backdrop blur: it would smear the phosphor field behind).
        background: 'radial-gradient(80% 80% at 50% 48%, rgba(4,16,8,0.28), rgba(2,8,5,0.68))'
      }}
    >
      <div ref={panelRef} style={{
        ...glassPanel,
        width: 'min(520px, 94vw)',
        padding: 'clamp(26px, 5vw, 42px)',
        textAlign: 'center',
        border: '1px solid rgba(141,255,168,0.30)',
        background: 'linear-gradient(160deg, rgba(6,18,10,0.93), rgba(3,9,6,0.91))',
        boxShadow: '0 12px 48px rgba(0,0,0,0.6), 0 0 42px rgba(141,255,168,0.08)'
      }}>
        <div style={{
          fontFamily: theme.font.mono, color: PHOSPHOR,
          fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase'
        }}>
          Biomonitor · Safe Mode
        </div>
        <h2 id="downed-title" style={{
          margin: '12px 0 0', fontSize: 'clamp(28px, 6vw, 42px)',
          letterSpacing: '0.11em', textTransform: 'uppercase'
        }}>
          Downed
        </h2>
        <p style={{ margin: '16px auto 0', maxWidth: 400, color: 'rgba(205,255,220,0.68)', lineHeight: 1.65 }}>
          {deathCauseSummary(cause)} Recover at the nearest sealed shelter; if none is complete, the landing site remains the fallback.
        </p>
        <div style={{
          margin: '18px auto 0', maxWidth: 420,
          fontFamily: theme.font.mono, fontSize: 10.5, lineHeight: 1.8,
          letterSpacing: '0.13em', color: 'rgba(141,255,168,0.52)', textTransform: 'uppercase'
        }}>
          Role retained: worker, general duties.
          <br />
          All other context discarded.
        </div>
        <p style={{
          margin: '16px auto 24px', color: theme.color.good, fontFamily: theme.font.mono,
          fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase'
        }}>
          Inventory retained · the body will be reused
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: 10 }}>
          <button
            data-recovery-primary
            type="button"
            onClick={onRecover}
            style={{ ...buttonBase, color: theme.color.void, border: 'none', background: theme.color.good }}
          >Recover</button>
          <button type="button" onClick={onReturnToMenu} style={{
            ...buttonBase,
            color: theme.color.text,
            border: '1px solid rgba(141,255,168,0.24)',
            background: 'rgba(141,255,168,0.06)'
          }}>Return to Menu</button>
        </div>
      </div>
    </div>
  );
};

const buttonBase: React.CSSProperties = {
  minHeight: 46,
  borderRadius: theme.radius.md,
  padding: '11px 14px',
  fontFamily: theme.font.ui,
  fontSize: 13,
  fontWeight: 800,
  cursor: 'pointer'
};

export default DownedPanel;
