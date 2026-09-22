import { useEffect, useRef } from 'react';
import { getFeedRuntime, FEED_BRACKET_SLOTS } from '../feedRuntime.ts';
import { getSurveyTargetPresentation, setSurveyTargetPresentation } from './surveyBrackets.ts';
import { theme } from '../../ui/theme.ts';
import { readEarlyFeedReservations, readStoryHudSafeAreaInsets } from '../ux/storyHudLayout.ts';
import { hudSurface } from '../../ui/hudSurfaces.ts';

// --- The survey bracket overlay -----------------------------------------------------
//
// DOM half of the bracket layer. Structure renders once; everything per-frame is
// a ref mutation inside this component's own rAF, reading the screen-space boxes
// SurveyBracketDriver wrote (the WarpOverlay pattern the rest of the feed uses).
//
// Visually this is the feed chrome's own corner-bracket idiom — four L-corners
// in the same dim ink, at the same weight — because it is meant to read as the
// site's survey designating its own quota targets, not as a game marker
// hovering over a collectable. It never fills, never tints, and never adds
// colour: the chapter's whole thesis is a world that has not resolved yet, and
// the bracket is the Authority pointing INTO that world, not the world
// resolving early.

const FEED_INK = 'rgba(228,236,231,0.92)';
const FEED_INK_DIM = 'rgba(228,236,231,0.55)';

/** L-corner arm length in px. */
const ARM = 9;

const CORNERS: readonly React.CSSProperties[] = [
  { top: 0, left: 0, borderTop: `2px solid ${FEED_INK_DIM}`, borderLeft: `2px solid ${FEED_INK_DIM}` },
  { top: 0, right: 0, borderTop: `2px solid ${FEED_INK_DIM}`, borderRight: `2px solid ${FEED_INK_DIM}` },
  { bottom: 0, left: 0, borderBottom: `2px solid ${FEED_INK_DIM}`, borderLeft: `2px solid ${FEED_INK_DIM}` },
  { bottom: 0, right: 0, borderBottom: `2px solid ${FEED_INK_DIM}`, borderRight: `2px solid ${FEED_INK_DIM}` }
];

export default function SurveyBracketOverlay(): React.ReactElement {
  const boxRefs = useRef<(HTMLDivElement | null)[]>([]);
  const frameRefs = useRef<(HTMLDivElement | null)[]>([]);
  const labelRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    let raf = 0;
    const tick = (): void => {
      raf = requestAnimationFrame(tick);
      const r = getFeedRuntime();
      const presentation = getSurveyTargetPresentation();
      const publishFit = (visible: boolean, rect?: { left: number; right: number; top: number; bottom: number }): void => {
        if (presentation && getSurveyTargetPresentation() === presentation) setSurveyTargetPresentation({ ...presentation,
          rect, fit: visible ? 'visible' : presentation.horizontalOffscreen ? 'offscreen' : 'unresolved' }, true);
      };
      for (let i = 0; i < FEED_BRACKET_SLOTS; i++) {
        const box = boxRefs.current[i];
        const label = labelRefs.current[i];
        const frame = frameRefs.current[i];
        if (!box || !label || !frame) continue;
        const b = r.brackets[i];
        // The brackets belong to the camera treatment: when the feed fades, so
        // do they. Same condition the survey marker uses.
        if (!b.visible || r.treatment <= 0.05) {
          box.style.display = 'none';
          publishFit(false);
          continue;
        }
        box.style.display = 'block';
        box.style.width = `${b.size}px`;
        box.style.height = `${b.size}px`;
        box.style.transform = `translate(${b.x}px, ${b.y}px) translate(-50%, -50%)`;
        label.textContent = b.label;
        const safe = readStoryHudSafeAreaInsets();
        const width = label.getBoundingClientRect().width;
        const height = label.getBoundingClientRect().height;
        const half = b.size / 2;
        const options = [
          { x: b.x + half + 6, y: b.y - height / 2 },
          { x: b.x - half - 6 - width, y: b.y - height / 2 },
          { x: b.x - width / 2, y: b.y - half - 6 - height }
        ];
        const occupied = readEarlyFeedReservations();
        const placement = options.find(p => {
          const left = Math.min(b.x - half, p.x), right = Math.max(b.x + half, p.x + width);
          const top = Math.min(b.y - half, p.y), bottom = Math.max(b.y + half, p.y + height);
          return left >= safe.left + 18 && right <= window.innerWidth - safe.right - 18
            && top >= safe.top + 18 && bottom <= window.innerHeight - safe.bottom - 18
            && occupied.every(r => right + 14 <= r.left || left >= r.right + 14 || bottom + 14 <= r.top || top >= r.bottom + 14);
        });
        if (!placement) { box.style.display = 'none'; publishFit(false); continue; }
        // Registry rectangle includes the entire label as well as the 46px designation.
        const left = Math.min(b.x - half, placement.x), top = Math.min(b.y - half, placement.y);
        const right = Math.max(b.x + half, placement.x + width), bottom = Math.max(b.y + half, placement.y + height);
        Object.assign(box.style, { left: `${left}px`, top: `${top}px`, width: `${right - left}px`, height: `${bottom - top}px`, transform: 'none' });
        Object.assign(frame.style, { left: `${b.x - half - left}px`, top: `${b.y - half - top}px`, width: `${b.size}px`, height: `${b.size}px` });
        label.style.left = `${placement.x - left}px`;
        label.style.top = `${placement.y - top}px`;
        label.style.right = 'auto';
        label.style.transform = 'none';
        box.dataset.surveyFrame = String(presentation?.frame ?? -1);
        box.dataset.surveyGeometry = presentation?.geometry ?? '';
        publishFit(true, { left, right, top, bottom });
      }
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); setSurveyTargetPresentation(null); };
  }, []);

  // The layer is a transparent full-bleed container; the BRACKETS below are
  // the real rects, so they carry the registry identity rather than this.
  return (
    <div
      aria-hidden
      data-survey-bracket-layer="true"
      data-hud-layer="fullbleed"
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: theme.z.hud + 2,
        fontFamily: theme.font.mono
      }}
    >
      {Array.from({ length: FEED_BRACKET_SLOTS }, (_, i) => (
        <div
          key={i}
          data-survey-bracket="true"
          {...hudSurface('survey-bracket-layer', 'marker')}
          ref={el => { boxRefs.current[i] = el; }}
          className="pv-survey-bracket"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            display: 'none',
            willChange: 'transform'
          }}
        >
          <div ref={el => { frameRefs.current[i] = el; }} data-survey-designation="true" style={{ position: 'absolute' }}>
            {CORNERS.map((corner, c) => (
              <div key={c} style={{ position: 'absolute', width: ARM, height: ARM, ...corner }} />
            ))}
          </div>
          <div
            ref={el => { labelRefs.current[i] = el; }}
            style={{
              position: 'absolute',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: 12,
              lineHeight: '18px',
              letterSpacing: '0.08em',
              whiteSpace: 'nowrap',
              color: FEED_INK,
              background: 'rgba(2,4,3,0.66)',
              padding: '2px 6px'
            }}
          />
        </div>
      ))}

    </div>
  );
}
