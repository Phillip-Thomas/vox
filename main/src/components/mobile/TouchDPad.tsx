import { useEffect, useRef, useState } from 'react';
import { pressKey, releaseAllKeys, releaseKey, setTouchActive } from '../../utils/mobileInput.ts';
import { theme } from '../../ui/theme.ts';
import { HUD_TOUCH_EDGE, TOUCH_DPAD_ARM_PX, TOUCH_DPAD_GAP_PX, hudNoSelect } from '../hud/hudChrome.ts';
import { useStoryState } from '../../story/storyState.ts';
import {
  dpadDirectionKey,
  dpadEraTheme,
  dpadSpecForBeat,
  dpadStaleHeldActionIds,
  dpadStaleHeldDirections,
  type DpadActionSpec,
  type DpadDirection
} from './TouchDPad.model.ts';
import { hudSurface } from '../../ui/hudSurfaces.ts';

// Chapter-themed virtual D-PAD for the early fixed-camera / CCTV-era beats
// (the monochrome ladder). TouchControls' analog joystick is authored for the
// free embodied eras; these camera-owned beats want a DISCRETE pad that reads as
// a regulation-feed control. It feeds the SAME synthetic-key bridge TouchControls
// uses (mobileInput: pressKey/releaseKey → WASD), so no controller changes: side
// and top-down eras interpret the held WASD per their own lookMode.
//
// Movement plus a couple of contextual buttons — no look stick (the era look is
// feed/side locked). The pure 2D side-scroller eras carry only ◀ ▶ and a JUMP
// button (plus an EXTRACT button on the harvest/quota beats); the top-down and
// isometric eras add ▲ ▼, which fade in as the new axis opens. Buttons are wired
// to the desktop keys (jump→Space, extract→KeyE) through the same synthetic-key
// bridge TouchControls uses.

const PAD_ARM = TOUCH_DPAD_ARM_PX; // one cross-arm cell (px)
const ACTION_SIZE = 72;
const AXIS_FADE_MS = 340; // ▲/▼ entrance when the second axis opens.

const DIRECTIONS: readonly { dir: DpadDirection; area: string; glyph: string; label: string }[] = [
  { dir: 'up', area: 'up', glyph: '▲', label: 'Move up' },
  { dir: 'left', area: 'left', glyph: '◀', label: 'Move left' },
  { dir: 'right', area: 'right', glyph: '▶', label: 'Move right' },
  { dir: 'down', area: 'down', glyph: '▼', label: 'Move down' }
];

/** Live read of the OS reduced-motion preference (instant axis reveal when set). */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => (
    typeof window !== 'undefined'
      && !!window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ));
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}

export default function TouchDPad() {
  const story = useStoryState();
  const [pressed, setPressed] = useState<Set<DpadDirection>>(() => new Set());
  // Held action buttons as id -> synthesized `code` (JUMP / EXTRACT can be held
  // together / with a direction). Keeping the code lets the beat-seam reconcile
  // release the exact key when a held button leaves the pad on a beat change.
  const [heldActions, setHeldActions] = useState<Map<string, string>>(() => new Map());
  // pointerId -> the direction it is currently holding (for multitouch diagonals).
  const pointerDir = useRef<Map<number, DpadDirection>>(new Map());
  const reduceMotion = usePrefersReducedMotion();

  useEffect(() => {
    setTouchActive(true);
    return () => {
      setTouchActive(false);
      releaseAllKeys();
    };
  }, []);

  const beatTheme = dpadEraTheme(story.beat);
  const spec = dpadSpecForBeat(story.beat);
  const shownDirections = DIRECTIONS.filter(d => spec.arms.includes(d.dir));
  const hasVerticalAxis = spec.arms.includes('up');
  // Contextual buttons, bottom-right: JUMP rides the whole ladder, EXTRACT only
  // the harvest/quota beats. Newest-to-oldest so JUMP sits nearest the thumb.
  const actionButtons: DpadActionSpec[] = [spec.action, spec.jump].filter(
    (a): a is DpadActionSpec => a !== null
  );

  // Beat-change release seam. A finger can still be down on a direction arm or an
  // action button when the beat advances and that control leaves the pad (the
  // report: holding EXTRACT as ch1-raster -> ch1-depth, where ch1-depth drops the
  // verb). React unmounts the removed <button> WITHOUT firing pointerup — the
  // pointer was captured on it — so its synthetic key would latch (non-stop
  // extraction) with nothing on screen to release it. `story.beat` is the clean
  // per-beat seam (useStoryState re-renders on every beat change); on it, release
  // exactly the controls whose button/arm the new spec no longer renders and drop
  // them from the held sets. Still-valid controls (◀ ▶, JUMP) keep their hold.
  useEffect(() => {
    const staleDirs = dpadStaleHeldDirections(pressed, spec);
    if (staleDirs.length > 0) {
      const stale = new Set(staleDirs);
      for (const dir of staleDirs) releaseKey(dpadDirectionKey(dir));
      for (const [pointerId, dir] of pointerDir.current) {
        if (stale.has(dir)) pointerDir.current.delete(pointerId);
      }
      setPressed(prev => {
        const next = new Set(prev);
        for (const dir of staleDirs) next.delete(dir);
        return next;
      });
    }
    const staleActionIds = dpadStaleHeldActionIds(heldActions.keys(), spec);
    if (staleActionIds.length > 0) {
      for (const id of staleActionIds) {
        const code = heldActions.get(id);
        if (code) releaseKey(code);
      }
      setHeldActions(prev => {
        const next = new Map(prev);
        for (const id of staleActionIds) next.delete(id);
        return next;
      });
    }
    // Runs on the beat seam only; the held sets and spec are read from the render
    // that the beat change triggered (a beat change never mutates them itself).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story.beat]);

  // Fade + scale the vertical arms in the first time they appear (entering the
  // top-down era from a one-axis beat). Presentation only; reduced motion skips
  // straight to the shown state.
  const [axisIn, setAxisIn] = useState(false);
  useEffect(() => {
    if (!hasVerticalAxis) { setAxisIn(false); return; }
    if (reduceMotion) { setAxisIn(true); return; }
    setAxisIn(false);
    // Two frames so the opacity:0 start paints before the transition target.
    let inner = 0;
    const outer = requestAnimationFrame(() => { inner = requestAnimationFrame(() => setAxisIn(true)); });
    return () => { cancelAnimationFrame(outer); cancelAnimationFrame(inner); };
  }, [hasVerticalAxis, reduceMotion]);

  const holdDirection = (direction: DpadDirection) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      pointerDir.current.set(e.pointerId, direction);
      pressKey(dpadDirectionKey(direction));
      setPressed(prev => {
        if (prev.has(direction)) return prev;
        const next = new Set(prev);
        next.add(direction);
        return next;
      });
    },
    onPointerUp: (e: React.PointerEvent) => releasePointer(e.pointerId),
    onPointerCancel: (e: React.PointerEvent) => releasePointer(e.pointerId),
    onPointerLeave: (e: React.PointerEvent) => {
      // Only release on leave when the pointer isn't captured (hover devices).
      if (!e.currentTarget.hasPointerCapture?.(e.pointerId)) releasePointer(e.pointerId);
    }
  });

  const releasePointer = (pointerId: number) => {
    const direction = pointerDir.current.get(pointerId);
    if (!direction) return;
    pointerDir.current.delete(pointerId);
    // Another finger may still hold the same direction — only release the key
    // and clear the highlight once no pointer owns it.
    const stillHeld = [...pointerDir.current.values()].includes(direction);
    if (!stillHeld) {
      releaseKey(dpadDirectionKey(direction));
      setPressed(prev => {
        if (!prev.has(direction)) return prev;
        const next = new Set(prev);
        next.delete(direction);
        return next;
      });
    }
  };

  const setActionHeld = (id: string, code: string, held: boolean) => setHeldActions(prev => {
    if (prev.has(id) === held) return prev;
    const next = new Map(prev);
    if (held) next.set(id, code); else next.delete(id);
    return next;
  });

  const holdAction = (spec: DpadActionSpec) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      pressKey(spec.code);
      setActionHeld(spec.id, spec.code, true);
    },
    onPointerUp: () => { releaseKey(spec.code); setActionHeld(spec.id, spec.code, false); },
    onPointerCancel: () => { releaseKey(spec.code); setActionHeld(spec.id, spec.code, false); },
    onPointerLeave: () => { releaseKey(spec.code); setActionHeld(spec.id, spec.code, false); }
  });

  const segmentStyle = (active: boolean, area: string): React.CSSProperties => ({
    gridArea: area,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: theme.font.mono,
    fontSize: 15,
    lineHeight: 1,
    color: active ? beatTheme.ink : beatTheme.inkDim,
    background: active ? beatTheme.glassActive : beatTheme.glass,
    border: `1px solid ${active ? beatTheme.ink : beatTheme.inkDim}`,
    // Flat, ledger-like corners to match the regulation-feed brackets.
    borderRadius: 3,
    boxShadow: active ? `inset 0 0 14px ${beatTheme.glassActive}` : 'none',
    textShadow: '0 1px 6px rgba(0,0,0,0.8)',
    pointerEvents: 'auto',
    touchAction: 'none',
    padding: 0,
    ...hudNoSelect
  });

  return (
    <div
      data-testid="touch-dpad-layer"
      style={{ position: 'absolute', inset: 0, zIndex: 15, pointerEvents: 'none', touchAction: 'none' }}
    >
      {/* Discrete cross D-PAD (bottom-left, where the joystick would sit). */}
      <div
        data-testid="touch-dpad"
          {...hudSurface('touch-dpad', 'control')}
        style={{
          position: 'absolute',
          left: 'calc(16px + env(safe-area-inset-left, 0px))',
          bottom: `calc(${HUD_TOUCH_EDGE}px + env(safe-area-inset-bottom, 0px))`,
          display: 'grid',
          gridTemplateColumns: `${PAD_ARM}px ${PAD_ARM}px ${PAD_ARM}px`,
          gridTemplateRows: `${PAD_ARM}px ${PAD_ARM}px ${PAD_ARM}px`,
          gridTemplateAreas: '". up ." "left hub right" ". down ."',
          gap: TOUCH_DPAD_GAP_PX,
          pointerEvents: 'none'
        }}
      >
        {shownDirections.map(({ dir, area, glyph, label }) => {
          const vertical = dir === 'up' || dir === 'down';
          const entrance: React.CSSProperties = vertical
            ? {
                opacity: axisIn ? 1 : 0,
                transform: axisIn ? 'scale(1)' : 'scale(0.8)',
                transition: reduceMotion ? 'none' : `opacity ${AXIS_FADE_MS}ms ease, transform ${AXIS_FADE_MS}ms ease`
              }
            : {};
          return (
            <button
              key={dir}
              data-testid={`touch-dpad-${dir}`}
              type="button"
              aria-label={label}
              aria-pressed={pressed.has(dir)}
              {...holdDirection(dir)}
              style={{ ...segmentStyle(pressed.has(dir), area), ...entrance }}
            >
              {glyph}
            </button>
          );
        })}
        {/* Inert hub keeps the cross centred and reads as a CCTV crosshair. */}
        <div
          aria-hidden
          style={{
            gridArea: 'hub',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: beatTheme.inkDim,
            fontFamily: theme.font.mono,
            fontSize: 12,
            pointerEvents: 'none',
            ...hudNoSelect
          }}
        >
          +
        </div>
      </div>

      {/* Contextual buttons (bottom-right): JUMP always, plus EXTRACT on the
          harvest/quota beats. Same regulation-feed treatment, stacked in a column
          so JUMP sits nearest the resting thumb. */}
      {actionButtons.length > 0 && (
        <div
          data-testid="touch-dpad-actions"
          {...hudSurface('touch-dpad-actions', 'control')}
          style={{
            position: 'absolute',
            right: 'calc(18px + env(safe-area-inset-right, 0px))',
            bottom: `calc(${HUD_TOUCH_EDGE + 6}px + env(safe-area-inset-bottom, 0px))`,
            display: 'flex',
            flexDirection: 'column-reverse',
            gap: 8,
            pointerEvents: 'none'
          }}
        >
          {actionButtons.map(actionSpec => {
            const held = heldActions.has(actionSpec.id);
            return (
              <button
                key={actionSpec.id}
                data-testid={`touch-dpad-action-${actionSpec.id}`}
                type="button"
                aria-label={actionSpec.ariaLabel}
                {...holdAction(actionSpec)}
                style={{
                  width: ACTION_SIZE,
                  height: ACTION_SIZE,
                  borderRadius: 3,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: theme.font.mono,
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '0.14em',
                  color: held ? beatTheme.ink : beatTheme.inkDim,
                  background: held ? beatTheme.glassActive : beatTheme.glass,
                  border: `1px solid ${held ? beatTheme.ink : beatTheme.inkDim}`,
                  boxShadow: held ? `inset 0 0 16px ${beatTheme.glassActive}` : 'none',
                  textShadow: '0 1px 6px rgba(0,0,0,0.8)',
                  pointerEvents: 'auto',
                  touchAction: 'none',
                  padding: 0,
                  ...hudNoSelect
                }}
              >
                {actionSpec.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
