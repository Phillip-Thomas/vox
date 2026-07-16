import React, { useEffect, useRef } from 'react';
import { theme } from '../ui/theme.ts';
import { isTouchDevice } from '../utils/mobileInput.ts';
import { getFeedRuntime } from './feedRuntime.ts';
import { getActiveGuidedStoryObjective } from './ux/objectiveDirector.ts';
import {
  deriveStoryHudTopLeftOcclusion,
  getMeasuredStoryObjectiveCardHeight,
  readStoryHudSafeAreaInsets,
  solveStoryHudLayout,
  solveStoryMarkerMotion,
  solveStoryMarkerPresentation,
  type StoryHudObservedRect,
  type StoryHudTopLeftOcclusion
} from './ux/storyHudLayout.ts';

// --- The free-era survey marker -------------------------------------------------------
//
// The suit's objective designator AFTER the feed dies: a small diamond (in
// frame) or edge chevron (out of frame) with a lowercase tag. Same feedRuntime
// marker struct + driver math as the feed-era bracket — only the chrome changed:
// the awakened world gets a whisper, not a work order. rAF-driven, zero React.

const INK = 'rgba(235, 245, 240, 0.72)';
const TOP_LEFT_HUD_SELECTOR = '[data-testid="vitals-meter"], [data-testid="inventory-panel"]';
const OCCLUSION_SAMPLE_INTERVAL_MS = 200;

function readVisibleTopLeftHudOcclusion(): StoryHudTopLeftOcclusion | undefined {
  const rects: StoryHudObservedRect[] = [];
  for (const node of document.querySelectorAll<HTMLElement>(TOP_LEFT_HUD_SELECTOR)) {
    const style = window.getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    if (Number.parseFloat(style.opacity || '1') <= 0.01) continue;
    if (node.getClientRects().length === 0) continue;
    const rect = node.getBoundingClientRect();
    rects.push({
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height
    });
  }
  return deriveStoryHudTopLeftOcclusion(rects, window.innerWidth, window.innerHeight);
}

const FreeMarker: React.FC = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const diamondRef = useRef<HTMLDivElement>(null);
  const chevronRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    let viewportWidth = -1;
    let viewportHeight = -1;
    let safeAreaInsets = readStoryHudSafeAreaInsets();
    let topLeftOcclusion: StoryHudTopLeftOcclusion | undefined;
    let lastOcclusionSampleAt = Number.NEGATIVE_INFINITY;
    const motionQuery = typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;
    let reducedMotion = motionQuery?.matches ?? false;
    const onMotionPreferenceChange = () => {
      reducedMotion = motionQuery?.matches ?? false;
      topLeftOcclusion = undefined;
      lastOcclusionSampleAt = Number.NEGATIVE_INFINITY;
    };
    motionQuery?.addEventListener('change', onMotionPreferenceChange);

    const tick = (frameTime: number) => {
      raf = requestAnimationFrame(tick);
      const root = rootRef.current;
      const diamond = diamondRef.current;
      const chevron = chevronRef.current;
      const label = labelRef.current;
      if (!root || !diamond || !chevron || !label) return;
      const m = getFeedRuntime().marker;
      if (!m.visible) {
        root.style.display = 'none';
        return;
      }
      if (viewportWidth !== window.innerWidth || viewportHeight !== window.innerHeight) {
        viewportWidth = window.innerWidth;
        viewportHeight = window.innerHeight;
        safeAreaInsets = readStoryHudSafeAreaInsets();
      }
      root.style.display = 'flex';
      const displayLabel = m.label.toLowerCase();
      if (label.textContent !== displayLabel) label.textContent = displayLabel;

      const touch = isTouchDevice();
      if (reducedMotion && touch
        && frameTime - lastOcclusionSampleAt >= OCCLUSION_SAMPLE_INTERVAL_MS) {
        topLeftOcclusion = readVisibleTopLeftHudOcclusion();
        lastOcclusionSampleAt = frameTime;
      } else if (!reducedMotion || !touch) {
        topLeftOcclusion = undefined;
      }
      const layout = solveStoryHudLayout({
        viewportWidth,
        viewportHeight,
        touch,
        objectivePresent: getActiveGuidedStoryObjective() !== null,
        objectiveHeight: getMeasuredStoryObjectiveCardHeight(),
        safeAreaInsets,
        topLeftOcclusion
      });
      const motion = solveStoryMarkerMotion({
        rawX: m.x,
        rawY: m.y,
        offscreen: m.offscreen,
        angle: m.angle,
        reducedMotion,
        layout
      });
      diamond.style.display = motion.glyph === 'diamond' ? 'block' : 'none';
      chevron.style.display = motion.glyph === 'chevron' ? 'block' : 'none';
      chevron.style.transform = `rotate(${motion.chevronAngle}rad)`;
      root.dataset.motionPresentation = motion.stabilized
        ? 'stable-directional'
        : 'projected';
      root.dataset.topLeftOcclusion = topLeftOcclusion ? 'observed' : 'none';
      label.style.maxWidth = `${motion.stabilized
        ? layout.marker.stableLabelMaxWidth
        : layout.marker.labelMaxWidth}px`;
      const presentation = solveStoryMarkerPresentation({
        rawX: m.x,
        rawY: m.y,
        labelWidth: label.getBoundingClientRect().width,
        overlayHeight: root.getBoundingClientRect().height,
        layout,
        stabilized: motion.stabilized
      });
      root.style.transform = `translate(${presentation.x}px, ${presentation.y}px) translate(-50%, -50%)`;
      label.style.transform = `translateX(${presentation.labelOffsetX}px)`;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      motionQuery?.removeEventListener('change', onMotionPreferenceChange);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      data-story-free-marker="true"
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        display: 'none',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 5,
        zIndex: theme.z.hud + 2,
        pointerEvents: 'none'
      }}
    >
      <div
        ref={diamondRef}
        style={{
          width: 9,
          height: 9,
          border: `1px solid ${INK}`,
          transform: 'rotate(45deg)',
          boxShadow: '0 0 8px rgba(0,0,0,0.5)'
        }}
      />
      <div
        ref={chevronRef}
        style={{
          width: 0,
          height: 0,
          borderTop: '5px solid transparent',
          borderBottom: '5px solid transparent',
          borderLeft: `9px solid ${INK}`
        }}
      />
      <div
        ref={labelRef}
        style={{
          fontFamily: theme.font.mono,
          fontSize: 11,
          letterSpacing: '0.08em',
          color: INK,
          textShadow: '0 1px 8px rgba(0,0,0,0.7)',
          lineHeight: 1.35,
          maxWidth: 'min(240px, calc(100vw - 36px))',
          overflowWrap: 'anywhere',
          textAlign: 'center',
          whiteSpace: 'normal'
        }}
      />
    </div>
  );
};

export default FreeMarker;
