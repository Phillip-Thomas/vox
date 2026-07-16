import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { theme } from '../../ui/theme.ts';
import { isTouchDevice } from '../../utils/mobileInput.ts';
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

/**
 * The awakened-world counterpart to the feed work-order panel. It stays quiet
 * and diegetic, but never makes a required next action depend on memory or a
 * transient caption.
 */
const StoryGuidanceHud: React.FC = () => {
  useSyncExternalStore(
    subscribeGuidedStoryObjective,
    getGuidedStoryObjectiveVersion,
    getGuidedStoryObjectiveVersion
  );
  const objective = getActiveGuidedStoryObjective();
  const cardRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const card = cardRef.current;
    if (!objective || !card) {
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
  }, [objective?.id]);

  if (!objective) return null;
  const health = getGuidedStoryObjectiveHealth();
  const action = objective.workOrder[objective.workOrder.length - 1];
  const context = objective.workOrder.length > 1 ? objective.workOrder[0] : null;
  const placement = getStoryGuidanceHudPlacement(isTouchDevice());

  return (
    <aside
      ref={cardRef}
      aria-live="polite"
      aria-atomic="true"
      aria-label="Current story objective"
      data-story-guidance-hud="true"
      data-objective-id={objective.id}
      data-objective-marker-label={objective.markerLabel}
      data-objective-health={health}
      data-objective-requires-marker={String(objective.requiresMarker ?? true)}
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
