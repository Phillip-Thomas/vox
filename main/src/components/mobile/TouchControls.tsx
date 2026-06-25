import { useEffect, useRef, useState } from 'react';
import {
  KEY_CODES,
  applyJoystickToKeys,
  dispatchLook,
  pressKey,
  releaseAllKeys,
  releaseKey,
  setTouchActive
} from '../../utils/mobileInput';
import { isBuildEnabled, subscribeBuildState } from '../../game/systems/buildState';

// On-screen virtual controls for touch devices. Feeds the EXISTING input paths
// by synthesizing keyboard + mousemove events (see mobileInput.ts), so neither
// the on-foot nor the ship controller needs input-consumption changes. Movement
// = left joystick (-> WASD), camera = any non-control drag (-> mouse look),
// actions = on-screen buttons (-> Space / F / Q / E).

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
  const joyId = useRef<number | null>(null);
  const joyCenter = useRef({ x: 0, y: 0 });
  const lookId = useRef<number | null>(null);
  const lookLast = useRef({ x: 0, y: 0 });

  useEffect(() => {
    setTouchActive(true);
    return () => {
      setTouchActive(false);
      releaseAllKeys();
    };
  }, []);

  useEffect(() => subscribeBuildState(() => setBuildActive(isBuildEnabled())), []);

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
    },
    onPointerMove: onLookMove,
    onPointerUp: (e: React.PointerEvent) => { releaseKey(code); onLookUp(e); },
    onPointerLeave: () => releaseKey(code),
    onPointerCancel: (e: React.PointerEvent) => { releaseKey(code); onLookUp(e); }
  });

  // `userSelect` alone is ignored by iOS Safari for touch — the WebkitUserSelect
  // + WebkitTouchCallout pair is what actually stops a press from selecting the
  // label text or popping the copy/paste callout mid-play.
  const noSelect: React.CSSProperties = {
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTouchCallout: 'none',
    WebkitTapHighlightColor: 'transparent'
  };

  const btnStyle: React.CSSProperties = {
    width: 64, height: 64, borderRadius: 32,
    background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(125,211,252,0.5)',
    color: '#cfe8ff', fontFamily: 'monospace', fontSize: 13, fontWeight: 'bold',
    touchAction: 'none', ...noSelect
  };
  const bigBtnStyle: React.CSSProperties = { ...btnStyle, width: 72, height: 72, borderRadius: 36 };

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 15, pointerEvents: 'none', touchAction: 'none' }}>
      {/* look region (under the controls) */}
      <div
        onPointerDown={onLookDown}
        onPointerMove={onLookMove}
        onPointerUp={onLookUp}
        onPointerCancel={onLookUp}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'auto', touchAction: 'none', ...noSelect }}
      />

      {/* left movement joystick */}
      <div
        data-testid="touch-joystick"
        onPointerDown={onJoyDown}
        onPointerMove={onJoyMove}
        onPointerUp={onJoyUp}
        onPointerCancel={onJoyUp}
        style={{
          position: 'absolute', left: 24, bottom: 24, zIndex: 1,
          width: JOYSTICK_SIZE, height: JOYSTICK_SIZE, borderRadius: JOYSTICK_SIZE / 2,
          background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(125,211,252,0.35)',
          pointerEvents: 'auto', touchAction: 'none', ...noSelect
        }}
      >
        <div style={{
          position: 'absolute',
          left: JOYSTICK_SIZE / 2 - KNOB_SIZE / 2 + knob.x,
          top: JOYSTICK_SIZE / 2 - KNOB_SIZE / 2 + knob.y,
          width: KNOB_SIZE, height: KNOB_SIZE, borderRadius: KNOB_SIZE / 2,
          background: 'rgba(125,211,252,0.4)'
        }} />
      </div>

      {/* action buttons (bottom-right). A 2-column grid so the cluster keeps a
          fixed, narrow footprint (~150px) and never extends left into the
          movement joystick on phone-width screens — the old single row of up to
          4 buttons did. Primary thrust/jump lands in the bottom-right thumb spot. */}
      <div style={{
        position: 'absolute', right: 20, bottom: 20, zIndex: 1,
        display: 'grid', gridTemplateColumns: 'repeat(2, auto)', gap: 12,
        justifyItems: 'center', alignItems: 'center', pointerEvents: 'auto'
      }}>
        {controlMode === 'flight' ? (
          <>
            <button {...holdBtn(KEY_CODES.rollLeft)} style={btnStyle}>Q</button>
            <button {...holdBtn(KEY_CODES.rollRight)} style={btnStyle}>E</button>
            <button {...holdBtn(KEY_CODES.board)} style={btnStyle}>F</button>
            <button {...holdBtn(KEY_CODES.jump)} style={bigBtnStyle}>THR</button>
          </>
        ) : (
          buildActive ? (
            <>
              <button {...holdBtn(KEY_CODES.deconstruct)} style={btnStyle}>REM</button>
              <button {...holdBtn(KEY_CODES.buildRotate)} style={btnStyle}>ROT</button>
              <button {...holdBtn(KEY_CODES.jump)} style={btnStyle}>JMP</button>
              <button {...holdBtn(KEY_CODES.mine)} style={bigBtnStyle}>PLACE</button>
            </>
          ) : (
            <>
              <button {...holdBtn(KEY_CODES.mine)} style={btnStyle}>MINE</button>
              <button {...holdBtn(KEY_CODES.board)} style={btnStyle}>F</button>
              <button {...holdBtn(KEY_CODES.jump)} style={{ ...bigBtnStyle, gridColumn: 2 }}>JMP</button>
              {/* Swim down while submerged (JMP = swim up). Harmless on land. */}
              <button {...holdBtn(KEY_CODES.descend)} style={btnStyle}>DIVE</button>
            </>
          )
        )}
      </div>
    </div>
  );
}
