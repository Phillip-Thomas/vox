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

const INK = 'rgba(241, 255, 249, 0.92)';
const TOP_LEFT_HUD_SELECTOR = '[data-testid="vitals-meter"], [data-testid="inventory-panel"], [data-story-journal-trigger="true"]';
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
        root.style.visibility = 'hidden';
        root.dataset.markerLayout = 'pending';
        return;
      }
      // Never expose the root between display activation, label wrapping, and
      // final collision-aware placement. The previous cold-start seam briefly
      // rendered a 240px intrinsic label at 0,0 before this work completed.
      root.style.visibility = 'hidden';
      if (viewportWidth !== window.innerWidth || viewportHeight !== window.innerHeight) {
        viewportWidth = window.innerWidth;
        viewportHeight = window.innerHeight;
        safeAreaInsets = readStoryHudSafeAreaInsets();
      }
      root.style.display = 'flex';
      const displayLabel = m.label.toLowerCase();
      if (label.textContent !== displayLabel) {
        label.textContent = displayLabel;
      }

      const touch = isTouchDevice();
      if (touch && frameTime - lastOcclusionSampleAt >= OCCLUSION_SAMPLE_INTERVAL_MS) {
        const nextOcclusion = readVisibleTopLeftHudOcclusion();
        topLeftOcclusion = nextOcclusion;
        lastOcclusionSampleAt = frameTime;
      } else if (!touch) {
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
      const labelMaxWidth = `${motion.stabilized
        ? layout.marker.stableLabelMaxWidth
        : layout.marker.labelMaxWidth}px`;
      if (label.style.maxWidth !== labelMaxWidth) {
        label.style.maxWidth = labelMaxWidth;
      }
      // display/glyph/wrapping writes above must participate in this tick's
      // measurement. offsetWidth forces the browser to synchronously commit
      // them even when software WebGL is starving future animation frames.
      void root.offsetWidth;
      const overlayBounds = root.getBoundingClientRect();
      const presentation = solveStoryMarkerPresentation({
        rawX: m.x,
        rawY: m.y,
        labelWidth: label.getBoundingClientRect().width,
        overlayWidth: overlayBounds.width,
        overlayHeight: overlayBounds.height,
        layout,
        stabilized: motion.stabilized
      });
      if (motion.stabilized) {
        // Stable reduced-motion placement uses real layout coordinates. This
        // makes collision geometry deterministic without compositor lag.
        root.style.left = `${presentation.x - overlayBounds.width / 2}px`;
        root.style.top = `${presentation.y - overlayBounds.height / 2}px`;
        root.style.transform = 'none';
      } else {
        root.style.left = '0px';
        root.style.top = '0px';
        root.style.transform = `translate(${presentation.x}px, ${presentation.y}px) translate(-50%, -50%)`;
      }
      label.style.transform = `translateX(${presentation.labelOffsetX}px)`;
      root.dataset.objectiveAvoidance = presentation.displacedForObjective
        ? 'displaced'
        : 'projected';
      root.dataset.chromeAvoidance = presentation.displacedForTopChrome
        ? 'displaced'
        : 'projected';
      // Force the final left/top/transform into layout before revealing. The
      // first visible frame is therefore the positioned frame—no second rAF.
      void root.getBoundingClientRect();
      root.dataset.markerLayout = 'ready';
      root.style.visibility = 'visible';
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
      data-marker-layout="pending"
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        display: 'none',
        visibility: 'hidden',
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
          width: 10,
          height: 10,
          border: `2px solid ${INK}`,
          transform: 'rotate(45deg)',
          boxShadow: '0 0 0 1px rgba(0,0,0,0.34), 0 0 10px rgba(0,0,0,0.72)'
        }}
      />
      <div
        ref={chevronRef}
        style={{
          width: 0,
          height: 0,
          borderTop: '6px solid transparent',
          borderBottom: '6px solid transparent',
          borderLeft: `10px solid ${INK}`,
          filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.92))'
        }}
      />
      <div
        ref={labelRef}
        style={{
          fontFamily: theme.font.mono,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.08em',
          color: INK,
          textShadow: '0 1px 2px rgba(0,0,0,1), 0 0 8px rgba(0,0,0,0.92)',
          background: 'rgba(3,8,12,0.28)',
          borderRadius: 5,
          padding: '2px 5px',
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
