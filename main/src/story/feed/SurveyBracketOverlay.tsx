import { useEffect, useRef } from 'react';
import { getFeedRuntime, FEED_BRACKET_SLOTS } from '../feedRuntime.ts';
import { theme } from '../../ui/theme.ts';
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
  const labelRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    let raf = 0;
    const tick = (): void => {
      raf = requestAnimationFrame(tick);
      const r = getFeedRuntime();
      for (let i = 0; i < FEED_BRACKET_SLOTS; i++) {
        const box = boxRefs.current[i];
        const label = labelRefs.current[i];
        if (!box || !label) continue;
        const b = r.brackets[i];
        // The brackets belong to the camera treatment: when the feed fades, so
        // do they. Same condition the survey marker uses.
        if (!b.visible || r.treatment <= 0.05) {
          box.style.display = 'none';
          continue;
        }
        box.style.display = 'block';
        box.style.width = `${b.size}px`;
        box.style.height = `${b.size}px`;
        box.style.transform = `translate(${b.x}px, ${b.y}px) translate(-50%, -50%)`;
        label.textContent = b.label;
        // Keep the label inside the frame without moving the designation.
        label.style.left = b.labelFlipped ? 'auto' : `${b.size + 6}px`;
        label.style.right = b.labelFlipped ? `${b.size + 6}px` : 'auto';
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
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
            willChange: 'transform',
            animation: 'pvSurveyBracket 2.2s steps(2, jump-none) infinite'
          }}
        >
          {CORNERS.map((corner, c) => (
            <div key={c} style={{ position: 'absolute', width: ARM, height: ARM, ...corner }} />
          ))}
          <div
            ref={el => { labelRefs.current[i] = el; }}
            style={{
              position: 'absolute',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: 9,
              letterSpacing: '0.16em',
              whiteSpace: 'nowrap',
              color: FEED_INK,
              background: 'rgba(2,4,3,0.66)',
              padding: '2px 6px'
            }}
          />
        </div>
      ))}
      <style>{`
        @keyframes pvSurveyBracket { 0%, 82% { opacity: 1 } 83%, 100% { opacity: 0.45 } }
        @media (prefers-reduced-motion: reduce) {
          .pv-survey-bracket { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
