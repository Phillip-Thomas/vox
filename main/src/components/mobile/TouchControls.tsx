import { useEffect, useRef, useState } from 'react';
import {
  applyJoystickToKeys,
  dispatchLook,
  pressKey,
  releaseAllKeys,
  releaseKey,
  setTouchActive
} from '../../utils/mobileInput';
import { isBuildEnabled, subscribeBuildState } from '../../game/systems/buildState';
import { getStoryInputPolicy } from '../../story/storyInputPolicy.ts';
import { subscribeStory } from '../../story/storyState.ts';
import { theme } from '../../ui/theme.ts';
import { touchActionButtonStyle, HUD_TOUCH_EDGE, hudNoSelect } from '../hud/hudChrome.ts';
import { createTouchActionGrid, createTouchActionSpecs, staleHeldTouchActionCodes, TOUCH_ACTION_GRID_GAP_PX } from './TouchControls.model.ts';
import { hudSurface } from '../../ui/hudSurfaces.ts';

// On-screen virtual controls for touch devices. Feeds the EXISTING input paths
// by synthesizing keyboard + mousemove events (see mobileInput.ts), so neither
// the on-foot nor the ship controller needs input-consumption changes. Movement
// = left joystick (-> WASD), camera = any non-control drag (-> mouse look),
// actions = on-screen buttons (-> Space / F / G / Q / E).

interface TouchControlsProps {
  /** 'fps' on foot, 'flight' in the ship — selects which action buttons show. */
  controlMode: 'fps' | 'flight';
}

const JOYSTICK_SIZE = 132;
const KNOB_SIZE = 58;
const LOOK_SENSITIVITY_X = 1.72;
const LOOK_SENSITIVITY_Y = 1.38;

export default function TouchControls({ controlMode }: TouchControlsProps) {
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [buildActive, setBuildActive] = useState(() => isBuildEnabled());
  // The desktop-Shift equivalent: expose SPRINT only when the live story policy
  // allows it (embodied chapters + sandbox). Feed/side eras report allowSprint
  // false, so the button stays hidden there.
  const [allowSprint, setAllowSprint] = useState(() => getStoryInputPolicy().allowSprint);
  const joyId = useRef<number | null>(null);
  const joyCenter = useRef({ x: 0, y: 0 });
  const lookId = useRef<number | null>(null);
  const lookLast = useRef({ x: 0, y: 0 });
  // Codes currently held by an action button (for the grid-reshape release seam).
  const heldCodes = useRef<Set<string>>(new Set());

  useEffect(() => {
    setTouchActive(true);
    return () => {
      setTouchActive(false);
      releaseAllKeys();
    };
  }, []);

  useEffect(() => subscribeBuildState(() => setBuildActive(isBuildEnabled())), []);
  useEffect(() => subscribeStory(() => setAllowSprint(getStoryInputPolicy().allowSprint)), []);

  // --- left movement joystick ------------------------------------------------
  const onJoyDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const r = e.currentTarget.getBoundingClientRect();
    joyCenter.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    joyId.current = e.pointerId;
    updateJoy(e.clientX, e.clientY);
  };
  const onJoyMove = (e: React.PointerEvent) => {
    if (joyId.current !== e.pointerId) return;
    updateJoy(e.clientX, e.clientY);
  };
  const onJoyUp = (e: React.PointerEvent) => {
    if (joyId.current !== e.pointerId) return;
    joyId.current = null;
    setKnob({ x: 0, y: 0 });
    applyJoystickToKeys(0, 0); // release all WASD
  };
  const updateJoy = (cx: number, cy: number) => {
    const max = JOYSTICK_SIZE / 2;
    let dx = cx - joyCenter.current.x;
    let dy = cy - joyCenter.current.y;
    const len = Math.hypot(dx, dy);
    if (len > max) { dx = (dx / len) * max; dy = (dy / len) * max; }
    setKnob({ x: dx, y: dy });
    // Screen y is down; joystick "up" = forward, so negate y.
    applyJoystickToKeys(dx / max, -dy / max);
  };

  // --- camera look -----------------------------------------------------------
  // Full-screen behind the explicit controls. The joystick/action buttons are
  // painted above it and capture their own pointers, while every other patch of
  // glass remains a reliable look-drag surface. This avoids the old mobile
  // dead-zone where the left 45% of the screen felt like an invisible blocker.
  const beginLook = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    lookId.current = e.pointerId;
    lookLast.current = { x: e.clientX, y: e.clientY };
  };
  const onLookDown = (e: React.PointerEvent) => {
    beginLook(e);
  };
  const onLookMove = (e: React.PointerEvent) => {
    if (lookId.current !== e.pointerId) return;
    const dx = e.clientX - lookLast.current.x;
    const dy = e.clientY - lookLast.current.y;
    lookLast.current = { x: e.clientX, y: e.clientY };
    dispatchLook(dx * LOOK_SENSITIVITY_X, dy * LOOK_SENSITIVITY_Y);
  };
  const onLookUp = (e: React.PointerEvent) => {
    if (lookId.current === e.pointerId) lookId.current = null;
  };

  // --- action buttons --------------------------------------------------------
  const holdBtn = (code: string) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      beginLook(e);
      pressKey(code);
      heldCodes.current.add(code);
    },
    onPointerMove: onLookMove,
    onPointerUp: (e: React.PointerEvent) => { releaseKey(code); heldCodes.current.delete(code); onLookUp(e); },
    onPointerLeave: () => { releaseKey(code); heldCodes.current.delete(code); },
    onPointerCancel: (e: React.PointerEvent) => { releaseKey(code); heldCodes.current.delete(code); onLookUp(e); }
  });

  // `userSelect` alone is ignored by iOS Safari for touch — the WebkitUserSelect
  // + WebkitTouchCallout pair is what actually stops a press from selecting the
  // label text or popping the copy/paste callout mid-play.
  // Sprint only joins the on-foot grid (fps, not building) where policy allows it.
  const sprintEnabled = controlMode === 'fps' && !buildActive && allowSprint;
  // Viewport width decides which axis the sprint cluster spends; see
  // touchActionClusterMetrics, which the caption lane derives its clearance from.
  const actionGrid = createTouchActionGrid(
    controlMode,
    buildActive,
    sprintEnabled,
    typeof window === 'undefined' ? Number.POSITIVE_INFINITY : window.innerWidth
  );
  const actionSpecs = createTouchActionSpecs(controlMode, buildActive, sprintEnabled);

  // Grid-reshape release seam. A finger can still be down on an action button when
  // the grid changes and that button leaves it — SPRINT hidden by build mode or a
  // story policy that revokes allowSprint, or the whole cluster swapping on a
  // build / control-mode change. React unmounts the removed <button> WITHOUT a
  // pointerup (the pointer was captured on it via beginLook), so its synthetic key
  // (e.g. ShiftLeft) would latch into a non-stop sprint. On any reshape, release
  // exactly the held codes that no longer map to a live button. (WASD from the
  // joystick is unaffected — that surface never disappears and releases on lift.)
  useEffect(() => {
    const stale = staleHeldTouchActionCodes(heldCodes.current, controlMode, buildActive, sprintEnabled);
    for (const code of stale) {
      releaseKey(code);
      heldCodes.current.delete(code);
    }
  }, [controlMode, buildActive, sprintEnabled]);

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 15, pointerEvents: 'none', touchAction: 'none' }}>
      {/* look region (under the controls) */}
      <div
        onPointerDown={onLookDown}
        onPointerMove={onLookMove}
        onPointerUp={onLookUp}
        onPointerCancel={onLookUp}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'auto', touchAction: 'none', ...hudNoSelect }}
      />

      {/* left movement joystick */}
      <div
        data-testid="touch-joystick"
          {...hudSurface('touch-joystick', 'control')}
        onPointerDown={onJoyDown}
        onPointerMove={onJoyMove}
        onPointerUp={onJoyUp}
        onPointerCancel={onJoyUp}
        style={{
          position: 'absolute',
          left: 'calc(12px + env(safe-area-inset-left, 0px))',
          bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
          zIndex: 1,
          width: JOYSTICK_SIZE, height: JOYSTICK_SIZE, borderRadius: JOYSTICK_SIZE / 2,
          background: 'radial-gradient(circle at 50% 50%, rgba(125,211,252,0.08), rgba(5,8,15,0.34) 70%)',
          border: '1px solid rgba(125,211,252,0.32)',
          boxShadow: '0 14px 34px rgba(0,0,0,0.34), inset 0 0 30px rgba(125,211,252,0.06)',
          pointerEvents: 'auto', touchAction: 'none', ...hudNoSelect
        }}
      >
        <div style={{
          position: 'absolute',
          left: JOYSTICK_SIZE / 2 - KNOB_SIZE / 2 + knob.x,
          top: JOYSTICK_SIZE / 2 - KNOB_SIZE / 2 + knob.y,
          width: KNOB_SIZE, height: KNOB_SIZE, borderRadius: KNOB_SIZE / 2,
          background: 'radial-gradient(circle at 35% 28%, rgba(236,251,255,0.42), rgba(125,211,252,0.44) 52%, rgba(56,189,248,0.22) 100%)',
          boxShadow: '0 8px 22px rgba(0,0,0,0.34), 0 0 24px rgba(125,211,252,0.18)'
        }} />
      </div>

      {/* action buttons (bottom-right). On-foot, build, and flight modes keep
          their four required commands in one compact 2x2 grid. */}
      <div
        data-testid="touch-action-cluster"
        {...hudSurface('touch-action-cluster', 'control')}
        style={{
          position: 'absolute',
          right: 'calc(14px + env(safe-area-inset-right, 0px))',
          bottom: `calc(${HUD_TOUCH_EDGE}px + env(safe-area-inset-bottom, 0px))`,
          zIndex: 1,
          display: 'grid',
          gridTemplateColumns: actionGrid.templateColumns,
          gridTemplateRows: actionGrid.templateRows,
          gridTemplateAreas: actionGrid.templateAreas,
          gap: TOUCH_ACTION_GRID_GAP_PX,
          justifyItems: 'center', alignItems: 'center', pointerEvents: 'auto'
        }}
      >
        {actionSpecs.map(action => (
          <button
            key={action.id}
            data-testid={`touch-action-${action.id}`}
            type="button"
            aria-label={action.ariaLabel}
            {...holdBtn(action.code)}
            style={{
              ...touchActionButtonStyle(action.intent === 'primary'),
              gridArea: action.area,
              borderColor: action.intent === 'primary' ? 'rgba(125,211,252,0.72)' : 'rgba(125,211,252,0.28)',
              color: action.intent === 'primary' ? '#ecfbff' : theme.color.text
            }}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
