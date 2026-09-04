import React, { useEffect, useId, useRef, useSyncExternalStore } from 'react';
import { theme } from '../../ui/theme.ts';
import { isTouchDevice, releaseAllKeys } from '../../utils/mobileInput.ts';
import {
  getActiveGuidedStoryObjective,
  getGuidedStoryObjectiveHealth,
  getGuidedStoryObjectiveVersion,
  subscribeGuidedStoryObjective
} from './objectiveDirector.ts';
import {
  setMeasuredStoryObjectiveCardHeight,
  STORY_HUD_TOUCH_CONTROL_CLEARANCE_PX
} from './storyHudLayout.ts';
import { presentStoryGuidanceLine } from './inputGlyphs.ts';
import { hudSurface } from '../../ui/hudSurfaces.ts';

// Re-exported so the awakened HUD's existing importers keep their call site.
export { presentStoryGuidanceLine };

export function getStoryGuidanceHudPlacement(touch: boolean): {
  left: string;
  bottom: string;
  width: string;
} {
  const side = touch ? 18 : 22;
  const bottom = touch ? STORY_HUD_TOUCH_CONTROL_CLEARANCE_PX : 28;
  return touch
    ? {
        left: `calc(${side}px + env(safe-area-inset-left, 0px))`,
        bottom: `calc(${bottom}px + env(safe-area-inset-bottom, 0px))`,
        width: `max(1px, min(360px, calc(100vw - ${side * 2}px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px))))`
      }
    : {
        left: `calc(${side}px + env(safe-area-inset-left, 0px))`,
        bottom: `calc(${bottom}px + env(safe-area-inset-bottom, 0px))`,
        width: `max(1px, min(360px, calc(100vw - ${side * 2}px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px))))`
      };
}

export function getStoryJournalTriggerPlacement(): React.CSSProperties {
  return {
    left: 'calc(160px + env(safe-area-inset-left, 0px))',
    top: 'calc(14px + env(safe-area-inset-top, 0px))'
  };
}

/**
 * The awakened-world counterpart to the feed work-order panel. It stays quiet
 * and diegetic, but never makes a required next action depend on memory or a
 * transient caption.
 */
interface StoryGuidanceHudProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const StoryGuidanceHud: React.FC<StoryGuidanceHudProps> = ({
  open = false,
  onOpenChange
}) => {
  useSyncExternalStore(
    subscribeGuidedStoryObjective,
    getGuidedStoryObjectiveVersion,
    getGuidedStoryObjectiveVersion
  );
  const objective = getActiveGuidedStoryObjective();
  const cardRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogId = useId();
  const dialogTitleId = useId();
  const dialogDescriptionId = useId();
  const touch = isTouchDevice();

  useEffect(() => {
    const card = cardRef.current;
    if (touch || !objective || !card) {
      setMeasuredStoryObjectiveCardHeight(0);
      return;
    }

    const measure = () => {
      setMeasuredStoryObjectiveCardHeight(card.getBoundingClientRect().height);
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(card);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      setMeasuredStoryObjectiveCardHeight(0);
    };
  }, [objective?.id, touch]);

  useEffect(() => {
    if (objective || !open) return;
    onOpenChange?.(false);
  }, [objective, onOpenChange, open]);

  useEffect(() => {
    if (!touch || !open) return undefined;
    releaseAllKeys();
    const frame = requestAnimationFrame(() => closeRef.current?.focus());
    const overlay = overlayRef.current;
    const parent = overlay?.parentElement;
    const siblings = overlay && parent
      ? [...parent.children].filter((child): child is HTMLElement => (
          child instanceof HTMLElement && child !== overlay
        ))
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
      requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
    };
  }, [open, touch]);

  if (!objective) return null;
  const health = getGuidedStoryObjectiveHealth();
  const action = presentStoryGuidanceLine(
    objective.workOrder[objective.workOrder.length - 1],
    touch
  );
  const context = objective.workOrder.length > 1
    ? presentStoryGuidanceLine(objective.workOrder[0], touch)
    : null;
  const [objectiveHeadline, ...objectiveDetailParts] = objective.markerLabel.split(' · ');
  const objectiveDetail = objectiveDetailParts.join(' · ');
  const objectiveData = {
    ...hudSurface('story-guidance-card', 'informational'),
    'data-story-guidance-hud': 'true',
    'data-objective-id': objective.id,
    'data-objective-marker-label': objective.markerLabel,
    'data-objective-health': health,
    'data-objective-requires-marker': String(objective.requiresMarker ?? true)
  } as const;

  if (touch) {
    const closeJournal = () => onOpenChange?.(false);
    return (
      <>
        <button
          ref={triggerRef}
          className="pv-mobile-journal-trigger"
          type="button"
          aria-label="Current story objective"
          aria-expanded={open}
          aria-controls={dialogId}
          onClick={() => onOpenChange?.(!open)}
          {...objectiveData}
          data-story-journal-trigger="true"
      {...hudSurface('story-journal-trigger', 'control')}
          style={{
            position: 'fixed',
            ...getStoryJournalTriggerPlacement(),
            width: 92,
            minHeight: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '0 10px',
            borderRadius: theme.radius.md,
            border: health === 'missing-marker'
              ? '1px solid rgba(255, 213, 145, 0.66)'
              : theme.glass.border,
            background: 'linear-gradient(180deg, rgba(14,22,38,0.82), rgba(6,10,18,0.72))',
            color: theme.color.text,
            boxShadow: '0 10px 28px rgba(0,0,0,0.34)',
            backdropFilter: theme.glass.blur,
            WebkitBackdropFilter: theme.glass.blur,
            fontFamily: theme.font.mono,
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: '0.08em',
            cursor: 'pointer',
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
            zIndex: theme.z.hud + 7
          }}
        >
          <span aria-hidden="true" style={{ display: 'grid', gap: 2 }}>
            <span style={{ display: 'block', width: 12, height: 1, background: theme.color.accent }} />
            <span style={{ display: 'block', width: 9, height: 1, background: theme.color.accent }} />
            <span style={{ display: 'block', width: 12, height: 1, background: theme.color.accent }} />
          </span>
          <span className="pv-mobile-journal-label">JOURNAL</span>
          {health === 'missing-marker' && (
            <span
              aria-hidden="true"
              style={{
                width: 5,
                height: 5,
                flex: '0 0 auto',
                borderRadius: 999,
                background: '#ffd591',
                boxShadow: '0 0 9px rgba(255,213,145,0.72)'
              }}
            />
          )}
        </button>

        {open && (
          <div
            ref={overlayRef}
            id={dialogId}
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
            aria-describedby={dialogDescriptionId}
            onPointerDown={event => {
              if (event.target === event.currentTarget) closeJournal();
            }}
            onKeyDown={event => {
              if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                closeJournal();
                return;
              }
              if (event.key !== 'Tab') return;
              const focusable = sheetRef.current?.querySelectorAll<HTMLElement>(
                'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
              );
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
              position: 'fixed',
              inset: 0,
              zIndex: theme.z.menu + 1,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              padding: 'max(12px, env(safe-area-inset-top, 0px)) max(12px, env(safe-area-inset-right, 0px)) max(12px, env(safe-area-inset-bottom, 0px)) max(12px, env(safe-area-inset-left, 0px))',
              background: 'rgba(3, 7, 13, 0.66)',
              fontFamily: theme.font.mono,
              color: theme.color.text,
              overscrollBehavior: 'contain'
            }}
          >
            <section
              ref={sheetRef}
              style={{
                position: 'relative',
                width: 'min(560px, 100%)',
                maxHeight: 'min(72dvh, 620px)',
                overflowY: 'auto',
                overscrollBehavior: 'contain',
                padding: '18px 18px 20px',
                border: '1px solid rgba(125,211,252,0.28)',
                borderLeft: '2px solid rgba(180,232,214,0.86)',
                borderRadius: `${theme.radius.lg}px ${theme.radius.lg}px ${theme.radius.md}px ${theme.radius.md}px`,
                background: 'linear-gradient(150deg, rgba(10,18,30,0.98), rgba(5,10,17,0.96))',
                boxShadow: '0 -18px 52px rgba(0,0,0,0.52), inset 0 1px 0 rgba(255,255,255,0.05)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 9, letterSpacing: '0.2em', color: 'rgba(180,232,214,0.62)' }}>
                    FIELD JOURNAL · ACTIVE ROUTE
                  </div>
                  <h2
                    id={dialogTitleId}
                    style={{
                      margin: '7px 0 0',
                      fontFamily: theme.font.mono,
                      fontSize: 15,
                      lineHeight: 1.35,
                      letterSpacing: '0.07em',
                      color: 'rgba(230,248,241,0.98)',
                      textWrap: 'balance',
                      overflowWrap: 'anywhere'
                    }}
                  >
                    <span>{objectiveHeadline}</span>
                    {objectiveDetail && (
                      <span style={{ display: 'block', marginTop: 2, color: 'rgba(180,232,214,0.82)', fontSize: 12 }}>
                        {objectiveDetail}
                      </span>
                    )}
                  </h2>
                </div>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={closeJournal}
                  aria-label="Close objective journal"
                  style={{
                    width: 44,
                    height: 44,
                    flex: '0 0 44px',
                    borderRadius: theme.radius.md,
                    border: theme.glass.border,
                    background: 'rgba(125,211,252,0.07)',
                    color: theme.color.text,
                    fontSize: 19,
                    cursor: 'pointer',
                    touchAction: 'manipulation'
                  }}
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>

              <div
                id={dialogDescriptionId}
                style={{ marginTop: 18, paddingTop: 15, borderTop: '1px solid rgba(125,211,252,0.14)' }}
              >
                {context && (
                  <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: 'rgba(230,248,241,0.66)', overflowWrap: 'anywhere' }}>
                    {context}
                  </p>
                )}
                <p style={{ margin: context ? '9px 0 0' : 0, fontSize: 13, lineHeight: 1.55, color: 'rgba(230,248,241,0.96)', overflowWrap: 'anywhere' }}>
                  {action}
                </p>
              </div>

              <div
                aria-live="polite"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: 17,
                  paddingTop: 13,
                  borderTop: '1px solid rgba(125,211,252,0.1)',
                  color: health === 'missing-marker' ? 'rgba(255,213,145,0.94)' : 'rgba(180,232,214,0.7)',
                  fontSize: 9,
                  lineHeight: 1.5,
                  letterSpacing: '0.1em'
                }}
              >
                <span aria-hidden="true">{health === 'missing-marker' ? '△' : '◇'}</span>
                <span>
                  {health === 'missing-marker'
                    ? 'ROUTE RECALIBRATING · OBJECTIVE REMAINS ACTIVE'
                    : 'DIRECTIONAL LINK REMAINS ACTIVE WHEN JOURNAL IS CLOSED'}
                </span>
              </div>
            </section>
          </div>
        )}
      </>
    );
  }

  const placement = getStoryGuidanceHudPlacement(false);

  return (
    <aside
      ref={cardRef}
      aria-live="polite"
      aria-atomic="true"
      aria-label="Current story objective"
      {...objectiveData}
      style={{
        position: 'fixed',
        ...placement,
        padding: '12px 14px 13px',
        borderLeft: '2px solid rgba(180, 232, 214, 0.82)',
        background: 'linear-gradient(90deg, rgba(8, 18, 18, 0.78), rgba(8, 18, 18, 0.18))',
        boxShadow: '0 8px 28px rgba(0,0,0,0.26)',
        color: 'rgba(230, 248, 241, 0.94)',
        fontFamily: theme.font.mono,
        boxSizing: 'border-box',
        overflowWrap: 'anywhere',
        pointerEvents: 'none',
        zIndex: theme.z.hud + 1
      }}
    >
      <div style={{ fontSize: 10, letterSpacing: '0.16em', color: 'rgba(180, 232, 214, 0.68)' }}>
        CURRENT OBJECTIVE
      </div>
      <div style={{ marginTop: 5, fontSize: 12, letterSpacing: '0.075em', lineHeight: 1.35 }}>
        {objective.markerLabel}
      </div>
      {context && (
        <div style={{ marginTop: 7, fontSize: 11, lineHeight: 1.5, color: 'rgba(230, 248, 241, 0.7)' }}>
          {context}
        </div>
      )}
      <div style={{ marginTop: 4, fontSize: 11, lineHeight: 1.5 }}>
        {action}
      </div>
      {health === 'missing-marker' && (
        <div style={{ marginTop: 7, fontSize: 10, letterSpacing: '0.08em', color: 'rgba(255, 213, 145, 0.92)' }}>
          ROUTE RECALIBRATING · OBJECTIVE REMAINS ACTIVE
        </div>
      )}
    </aside>
  );
};

export default StoryGuidanceHud;
