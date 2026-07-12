import React, { useEffect, useRef, useState } from 'react';
import { CRAWL_LINES } from '../storyScript.ts';
import { playSfx } from '../../audio/sfxEngine.ts';
import { PHOSPHOR, PHOSPHOR_DIM } from './TerminalPrologue.tsx';

// --- The regulation crawl ------------------------------------------------------
//
// The Star-Wars opening, played completely straight — except the text is a
// deployment notice. CSS 3D: a perspective stage, the text plane pitched back,
// translating up over CRAWL_SECONDS. Enter/Space/click fast-forwards.

// crawl-length: 52s carried 27 lines (~1.9s/line). The 2026-07-11 rework grew
// the notice to 44 lines (provenance, setting, clause 5, VOX, the routing
// addendum, "MAKE NO MISTAKES.") — 84s preserves the same reading pace. The
// movie dwells the full length by design; players fast-forward (Enter/click).
const CRAWL_SECONDS = 84;

const RegulationCrawl: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const doneRef = useRef(false);
  const [leaving, setLeaving] = useState(false);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    playSfx('terminalAdvance');
    setLeaving(true);
    setTimeout(onDone, 600);
  };

  useEffect(() => {
    // The crawl plays FULL length in every mode (owner: let the movie dwell);
    // interactive players fast-forward with Enter/click.
    const timer = setTimeout(finish, CRAWL_SECONDS * 1000);
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') finish();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      onClick={finish}
      style={{
        position: 'absolute',
        inset: 0,
        perspective: '340px',
        perspectiveOrigin: '50% 32%',
        overflow: 'hidden',
        cursor: 'pointer',
        opacity: leaving ? 0 : 1,
        transition: 'opacity 600ms ease'
      }}
    >
      <div style={{
        position: 'absolute',
        left: '50%',
        bottom: 0,
        width: 'min(88vw, 780px)',
        transform: 'translateX(-50%) rotateX(58deg)',
        transformOrigin: '50% 100%'
      }}>
        <div style={{
          textAlign: 'center',
          fontSize: 'clamp(14px, 2vw, 21px)',
          lineHeight: 2.0,
          whiteSpace: 'nowrap',
          animation: `pvCrawl ${CRAWL_SECONDS + 8}s linear both`,
          textShadow: `0 0 18px ${PHOSPHOR_DIM}`
        }}>
          {CRAWL_LINES.map((line, i) => (
            <div key={i} style={{
              color: i < 2 ? PHOSPHOR : undefined,
              fontWeight: line.startsWith('CLAUSE') || line === 'MAKE NO MISTAKES.' ? 700 : 400,
              minHeight: line === '' ? '1.6em' : undefined
            }}>
              {line}
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes pvCrawl {
          from { transform: translateY(78vh); }
          to   { transform: translateY(-135%); }
        }
      `}</style>
    </div>
  );
};

export default RegulationCrawl;
