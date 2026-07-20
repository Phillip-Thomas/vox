import { useEffect, useRef, useState } from 'react';
import { pressKey, releaseAllKeys, releaseKey, setTouchActive } from '../../utils/mobileInput.ts';
import { theme } from '../../ui/theme.ts';
import { HUD_TOUCH_EDGE, hudNoSelect } from '../hud/hudChrome.ts';
import { useStoryState } from '../../story/storyState.ts';
import {
  dpadActionForBeat,
  dpadDirectionKey,
  dpadEraTheme,
  type DpadDirection
} from './TouchDPad.model.ts';

// Chapter-themed virtual D-PAD for the early fixed-camera / CCTV-era beats
// (the monochrome ladder). TouchControls' analog joystick is authored for the
// free embodied eras; these camera-owned beats want a DISCRETE pad that reads as
// a regulation-feed control. It feeds the SAME synthetic-key bridge TouchControls
// uses (mobileInput: pressKey/releaseKey → WASD), so no controller changes: side
// and top-down eras interpret the held WASD per their own lookMode.
//
// Movement only — no look stick (the era look is feed/side locked). One optional
// contextual EXTRACT button appears on the harvest/quota beats, wired to the
// desktop harvest key (KeyE).

const PAD_ARM = 50; // one cross-arm cell (px)
const ACTION_SIZE = 72;

const DIRECTIONS: readonly { dir: DpadDirection; area: string; glyph: string; label: string }[] = [
  { dir: 'up', area: 'up', glyph: '▲', label: 'Move up' },
  { dir: 'left', area: 'left', glyph: '◀', label: 'Move left' },
  { dir: 'right', area: 'right', glyph: '▶', label: 'Move right' },
  { dir: 'down', area: 'down', glyph: '▼', label: 'Move down' }
];

export default function TouchDPad() {
  const story = useStoryState();
  const [pressed, setPressed] = useState<Set<DpadDirection>>(() => new Set());
  const [actionHeld, setActionHeld] = useState(false);
  // pointerId -> the direction it is currently holding (for multitouch diagonals).
  const pointerDir = useRef<Map<number, DpadDirection>>(new Map());

  useEffect(() => {
    setTouchActive(true);
    return () => {
      setTouchActive(false);
      releaseAllKeys();
    };
  }, []);

  const beatTheme = dpadEraTheme(story.beat);
  const action = dpadActionForBeat(story.beat);

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

  const actionButton = action && {
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      pressKey(action.code);
      setActionHeld(true);
    },
    onPointerUp: () => { releaseKey(action.code); setActionHeld(false); },
    onPointerCancel: () => { releaseKey(action.code); setActionHeld(false); },
    onPointerLeave: () => { releaseKey(action.code); setActionHeld(false); }
  };

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
        style={{
          position: 'absolute',
          left: 'calc(16px + env(safe-area-inset-left, 0px))',
          bottom: `calc(${HUD_TOUCH_EDGE}px + env(safe-area-inset-bottom, 0px))`,
          display: 'grid',
          gridTemplateColumns: `${PAD_ARM}px ${PAD_ARM}px ${PAD_ARM}px`,
          gridTemplateRows: `${PAD_ARM}px ${PAD_ARM}px ${PAD_ARM}px`,
          gridTemplateAreas: '". up ." "left hub right" ". down ."',
          gap: 3,
          pointerEvents: 'none'
        }}
      >
        {DIRECTIONS.map(({ dir, area, glyph, label }) => (
          <button
            key={dir}
            data-testid={`touch-dpad-${dir}`}
            type="button"
            aria-label={label}
            aria-pressed={pressed.has(dir)}
            {...holdDirection(dir)}
            style={segmentStyle(pressed.has(dir), area)}
          >
            {glyph}
          </button>
        ))}
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

      {/* Optional contextual EXTRACT button (harvest/quota beats), bottom-right. */}
      {action && actionButton && (
        <button
          data-testid="touch-dpad-action"
          type="button"
          aria-label={action.ariaLabel}
          {...actionButton}
          style={{
            position: 'absolute',
            right: 'calc(18px + env(safe-area-inset-right, 0px))',
            bottom: `calc(${HUD_TOUCH_EDGE + 6}px + env(safe-area-inset-bottom, 0px))`,
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
            color: actionHeld ? beatTheme.ink : beatTheme.inkDim,
            background: actionHeld ? beatTheme.glassActive : beatTheme.glass,
            border: `1px solid ${actionHeld ? beatTheme.ink : beatTheme.inkDim}`,
            boxShadow: actionHeld ? `inset 0 0 16px ${beatTheme.glassActive}` : 'none',
            textShadow: '0 1px 6px rgba(0,0,0,0.8)',
            pointerEvents: 'auto',
            touchAction: 'none',
            padding: 0,
            ...hudNoSelect
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
