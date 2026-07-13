import React, { useEffect, useRef, useState } from 'react';
import { glassPanel, theme } from '../../ui/theme.ts';

interface StoryCompletePanelProps {
  open: boolean;
  onContinue: () => void;
  onReturnToMenu: () => void;
  onReplay: () => void;
}

const StoryCompletePanel: React.FC<StoryCompletePanelProps> = ({
  open,
  onContinue,
  onReturnToMenu,
  onReplay
}) => {
  const [confirmReplay, setConfirmReplay] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setConfirmReplay(false);
      return undefined;
    }
    const frame = requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLElement>('[data-complete-primary]')?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open, confirmReplay]);

  useEffect(() => {
    if (!open) return undefined;
    const overlay = overlayRef.current;
    const parent = overlay?.parentElement;
    if (!overlay || !parent) return undefined;
    const siblings = [...parent.children].filter((child): child is HTMLElement => (
      child instanceof HTMLElement && child !== overlay
    ));
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
      for (const { element, inert, ariaHidden } of previous) {
        element.inert = inert;
        if (ariaHidden == null) element.removeAttribute('aria-hidden');
        else element.setAttribute('aria-hidden', ariaHidden);
      }
    };
  }, [open]);

  if (!open) return null;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (confirmReplay) setConfirmReplay(false);
      else onContinue();
      return;
    }
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
  };

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="story-complete-title"
      onKeyDown={handleKeyDown}
      onBlurCapture={event => {
        const next = event.relatedTarget;
        if (next instanceof Node && panelRef.current?.contains(next)) return;
        requestAnimationFrame(() => {
          panelRef.current?.querySelector<HTMLElement>('[data-complete-primary]')?.focus();
        });
      }}
      style={{
        position: 'fixed', inset: 0, zIndex: theme.z.menu + 2,
        display: 'grid', placeItems: 'center', padding: 20,
        fontFamily: theme.font.ui, color: theme.color.text,
        background: 'radial-gradient(100% 90% at 50% 45%, rgba(5,8,15,0.42), rgba(5,8,15,0.9))',
        backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)'
      }}
    >
      <div ref={panelRef} style={{
        ...glassPanel,
        width: 'min(520px, 94vw)',
        padding: 'clamp(24px, 5vw, 42px)',
        background: 'linear-gradient(145deg, rgba(8,13,24,0.94), rgba(8,20,28,0.82))',
        border: '1px solid rgba(125,211,252,0.34)',
        textAlign: 'center'
      }}>
        <div style={{
          fontFamily: theme.font.mono, fontSize: 10, letterSpacing: '0.28em',
          textTransform: 'uppercase', color: theme.color.accent, marginBottom: 12
        }}>
          Current boundary reached
        </div>
        <h2 id="story-complete-title" style={{
          margin: 0, fontSize: 'clamp(24px, 5vw, 36px)', letterSpacing: '0.08em',
          textTransform: 'uppercase'
        }}>
          Story Demo Complete
        </h2>

        {!confirmReplay ? (
          <>
            <p style={{ margin: '16px auto 24px', maxWidth: 410, color: theme.color.textDim, lineHeight: 1.65 }}>
              The current Story Demo ends here. Your completed site remains playable.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)', gap: 10 }}>
              <button data-complete-primary onClick={onContinue} style={primaryStyle}>Continue at Site</button>
              <button onClick={onReturnToMenu} style={secondaryStyle}>Return to Menu</button>
              <button onClick={() => setConfirmReplay(true)} style={{ ...secondaryStyle, gridColumn: '1 / -1' }}>
                Replay Story
              </button>
            </div>
          </>
        ) : (
          <>
            <p style={{ margin: '16px auto 10px', maxWidth: 410, color: theme.color.text, lineHeight: 1.65 }}>
              Replay from the beginning?
            </p>
            <p style={{ margin: '0 auto 24px', maxWidth: 410, color: theme.color.textDim, lineHeight: 1.55, fontSize: 13 }}>
              This resets Story progress, the Story site, carried inventory, suit status, and saved Story pose. Worlds outside the Story site remain saved.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button data-complete-primary onClick={() => setConfirmReplay(false)} style={secondaryStyle}>Cancel</button>
              <button onClick={onReplay} style={dangerStyle}>Replay from Beginning</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const baseButtonStyle: React.CSSProperties = {
  minHeight: 46,
  borderRadius: theme.radius.md,
  padding: '11px 14px',
  fontFamily: theme.font.ui,
  fontSize: 13,
  fontWeight: 750,
  cursor: 'pointer'
};

const primaryStyle: React.CSSProperties = {
  ...baseButtonStyle,
  color: theme.color.void,
  background: `linear-gradient(180deg, ${theme.color.accent}, ${theme.color.accentStrong})`,
  border: 'none',
  boxShadow: '0 8px 24px rgba(56,189,248,0.28)'
};

const secondaryStyle: React.CSSProperties = {
  ...baseButtonStyle,
  color: theme.color.text,
  background: 'rgba(125,211,252,0.08)',
  border: '1px solid rgba(125,211,252,0.25)'
};

const dangerStyle: React.CSSProperties = {
  ...baseButtonStyle,
  color: theme.color.danger,
  background: 'rgba(252,165,165,0.08)',
  border: '1px solid rgba(252,165,165,0.3)'
};

export default StoryCompletePanel;
