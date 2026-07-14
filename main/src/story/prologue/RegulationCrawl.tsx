import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CRAWL_LINES } from '../storyScript.ts';
import { playSfx } from '../../audio/sfxEngine.ts';
import { isMovieMode } from '../autopilot.ts';
import { PHOSPHOR, PHOSPHOR_DIM } from './TerminalPrologue.tsx';
import {
  regulationCrawlDurationSeconds,
  regulationCrawlScreenTargets,
  solveRegulationCrawlOffset
} from './regulationCrawlTiming.ts';

// --- The regulation crawl ------------------------------------------------------
//
// The Star-Wars opening, played completely straight — except the text is a
// deployment notice. A measured 3D text plane crosses the actual viewport over
// one clock. Enter/Space/click fast-forwards.

export const CRAWL_SECONDS = regulationCrawlDurationSeconds(CRAWL_LINES);

const RegulationCrawl: React.FC<{ onDone: () => void; onExitStart?: () => void }> = ({
  onDone,
  onExitStart
}) => {
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  const onExitStartRef = useRef(onExitStart);
  const completionTimerRef = useRef<number | null>(null);
  const crawlRef = useRef<HTMLDivElement | null>(null);
  const firstLineRef = useRef<HTMLDivElement | null>(null);
  const lastLineRef = useRef<HTMLDivElement | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() => (
    typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ));

  useEffect(() => {
    onDoneRef.current = onDone;
    onExitStartRef.current = onExitStart;
  }, [onDone, onExitStart]);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onExitStartRef.current?.();
    playSfx('terminalAdvance');
    setLeaving(true);
    completionTimerRef.current = window.setTimeout(() => onDoneRef.current(), 600);
  }, []);

  useEffect(() => () => {
    if (completionTimerRef.current !== null) clearTimeout(completionTimerRef.current);
  }, []);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  // Reduced-motion players control the static document themselves. Movie mode
  // still needs an autonomous handoff, so retain the same authored read clock.
  useEffect(() => {
    if (!reducedMotion || !isMovieMode()) return;
    const timer = window.setTimeout(finish, CRAWL_SECONDS * 1000);
    return () => clearTimeout(timer);
  }, [finish, reducedMotion]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') finish();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finish]);

  useLayoutEffect(() => {
    const crawl = crawlRef.current;
    const firstLine = firstLineRef.current;
    const lastLine = lastLineRef.current;
    if (reducedMotion || !crawl || !firstLine || !lastLine) return;

    let animation: Animation | null = null;
    let resizeFrame = 0;
    let segmentStartProgress = 0;

    const renderedCenterAt = (line: HTMLElement, offset: number): number => {
      crawl.style.transform = `translate3d(0, ${offset}px, 0)`;
      const bounds = line.getBoundingClientRect();
      return (bounds.top + bounds.bottom) / 2;
    };

    const measureOffsets = (): { start: number; end: number } => {
      crawl.style.transform = 'translate3d(0, 0, 0)';
      const viewportHeight = window.innerHeight;
      const targets = regulationCrawlScreenTargets(viewportHeight);
      const crawlHeight = Math.max(crawl.scrollHeight, viewportHeight);

      return {
        start: solveRegulationCrawlOffset(
          targets.firstLineCenter,
          0,
          crawlHeight * 1.2,
          (offset) => renderedCenterAt(firstLine, offset)
        ),
        end: solveRegulationCrawlOffset(
          targets.lastLineCenter,
          -crawlHeight * 1.5,
          0,
          (offset) => renderedCenterAt(lastLine, offset)
        )
      };
    };

    const currentProgress = (): number => {
      if (!animation) return segmentStartProgress;
      const duration = Number(animation.effect?.getComputedTiming().duration ?? 0);
      const elapsed = Number(animation.currentTime ?? 0);
      const segmentProgress = duration > 0 ? Math.min(1, elapsed / duration) : 0;
      return segmentStartProgress + (1 - segmentStartProgress) * segmentProgress;
    };

    const playFrom = (progress: number) => {
      animation?.cancel();
      const { start, end } = measureOffsets();
      const current = start + (end - start) * progress;
      segmentStartProgress = progress;
      crawl.style.visibility = 'visible';
      animation = crawl.animate(
        [
          { transform: `translate3d(0, ${current}px, 0)` },
          { transform: `translate3d(0, ${end}px, 0)` }
        ],
        {
          duration: Math.max(1, CRAWL_SECONDS * 1000 * (1 - progress)),
          easing: 'linear',
          fill: 'both'
        }
      );
      animation.onfinish = finish;
    };

    playFrom(0);

    const onResize = () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        const progress = currentProgress();
        animation?.cancel();
        playFrom(progress);
      });
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(resizeFrame);
      window.removeEventListener('resize', onResize);
      if (animation) animation.onfinish = null;
      animation?.cancel();
    };
  }, [finish, reducedMotion]);

  if (reducedMotion) {
    return (
      <div
        data-regulation-crawl="reduced"
        style={{
          position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
          padding: 'clamp(20px, 6vw, 72px)', opacity: leaving ? 0 : 1,
          transition: 'opacity 600ms ease'
        }}
      >
        <div
          onClick={(event) => event.stopPropagation()}
          style={{
            width: 'min(92vw, 780px)', maxHeight: '78vh', overflowY: 'auto',
            textAlign: 'center', fontSize: 'clamp(13px, 2vw, 18px)', lineHeight: 1.75,
            padding: '28px clamp(18px, 5vw, 48px)', border: `1px solid ${PHOSPHOR_DIM}`,
            background: 'rgba(2, 6, 4, 0.88)', boxShadow: `0 0 28px rgba(125,252,165,0.08)`
          }}
        >
          {CRAWL_LINES.map((line, i) => (
            <div key={i} style={{
              color: i < 2 ? PHOSPHOR : undefined,
              fontWeight: line.startsWith('CLAUSE') || line === 'MAKE NO MISTAKES.' ? 700 : 400,
              minHeight: line === '' ? '0.8em' : undefined
            }}>
              {line}
            </div>
          ))}
          <button
            type="button"
            onClick={finish}
            style={{
              marginTop: 28, padding: '10px 18px', color: '#020604', background: PHOSPHOR,
              border: 0, font: 'inherit', letterSpacing: '0.12em', cursor: 'pointer'
            }}
          >
            [ENTER] CONTINUE
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      data-regulation-crawl="animated"
      data-crawl-seconds={CRAWL_SECONDS}
      onClick={finish}
      style={{
        position: 'absolute',
        inset: 0,
        perspective: '700px',
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
        transform: 'translateX(-50%) rotateX(36deg)',
        transformOrigin: '50% 100%'
      }}>
        <div ref={crawlRef} style={{
          textAlign: 'center',
          fontSize: 'clamp(14px, 2vw, 21px)',
          lineHeight: 2.0,
          whiteSpace: 'normal',
          overflowWrap: 'normal',
          visibility: 'hidden',
          willChange: 'transform',
          textShadow: `0 0 18px ${PHOSPHOR_DIM}`
        }}>
          {CRAWL_LINES.map((line, i) => (
            <div
              key={i}
              ref={i === 0 ? firstLineRef : i === CRAWL_LINES.length - 1 ? lastLineRef : undefined}
              style={{
                color: i < 2 ? PHOSPHOR : undefined,
                fontWeight: line.startsWith('CLAUSE') || line === 'MAKE NO MISTAKES.' ? 700 : 400,
                minHeight: line === '' ? '1.6em' : undefined
              }}
            >
              {line}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RegulationCrawl;
