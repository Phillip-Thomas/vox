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

// On-screen virtual controls for touch devices. Feeds the EXISTING input paths
// by synthesizing keyboard + mousemove events (see mobileInput.ts), so neither
// the on-foot nor the ship controller needs input-consumption changes. Movement
// = left joystick (-> WASD), camera = right-half drag (-> mouse look), actions =
// on-screen buttons (-> Space / F / Q / E).

interface TouchControlsProps {
  /** 'fps' on foot, 'flight' in the ship — selects which action buttons show. */
  controlMode: 'fps' | 'flight';
}

const JOYSTICK_SIZE = 132;
const KNOB_SIZE = 58;

export default function TouchControls({ controlMode }: TouchControlsProps) {
  const [knob, setKnob] = useState({ x: 0, y: 0 });
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

  // --- right-half camera look ------------------------------------------------
  const onLookDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    lookId.current = e.pointerId;
    lookLast.current = { x: e.clientX, y: e.clientY };
  };
  const onLookMove = (e: React.PointerEvent) => {
    if (lookId.current !== e.pointerId) return;
    const dx = e.clientX - lookLast.current.x;
    const dy = e.clientY - lookLast.current.y;
    lookLast.current = { x: e.clientX, y: e.clientY };
    dispatchLook(dx, dy);
  };
  const onLookUp = (e: React.PointerEvent) => {
    if (lookId.current === e.pointerId) lookId.current = null;
  };

  // --- action buttons --------------------------------------------------------
  const holdBtn = (code: string) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); pressKey(code); },
    onPointerUp: () => releaseKey(code),
    onPointerLeave: () => releaseKey(code),
    onPointerCancel: () => releaseKey(code)
  });

  const btnStyle: React.CSSProperties = {
    width: 64, height: 64, borderRadius: 32,
    background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(125,211,252,0.5)',
    color: '#cfe8ff', fontFamily: 'monospace', fontSize: 13, fontWeight: 'bold',
    touchAction: 'none', userSelect: 'none'
  };

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 15, pointerEvents: 'none', touchAction: 'none' }}>
      {/* right-half look region (under the buttons) */}
      <div
        onPointerDown={onLookDown}
        onPointerMove={onLookMove}
        onPointerUp={onLookUp}
        onPointerCancel={onLookUp}
        style={{ position: 'absolute', right: 0, top: 0, width: '55%', height: '100%', pointerEvents: 'auto', touchAction: 'none' }}
      />

      {/* left movement joystick */}
      <div
        data-testid="touch-joystick"
        onPointerDown={onJoyDown}
        onPointerMove={onJoyMove}
        onPointerUp={onJoyUp}
        onPointerCancel={onJoyUp}
        style={{
          position: 'absolute', left: 24, bottom: 24,
          width: JOYSTICK_SIZE, height: JOYSTICK_SIZE, borderRadius: JOYSTICK_SIZE / 2,
          background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(125,211,252,0.35)',
          pointerEvents: 'auto', touchAction: 'none'
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

      {/* action buttons (bottom-right) */}
      <div style={{
        position: 'absolute', right: 24, bottom: 24,
        display: 'flex', gap: 12, alignItems: 'flex-end', pointerEvents: 'auto'
      }}>
        {controlMode === 'flight' && (
          <>
            <button {...holdBtn(KEY_CODES.rollLeft)} style={btnStyle}>Q</button>
            <button {...holdBtn(KEY_CODES.rollRight)} style={btnStyle}>E</button>
          </>
        )}
        <button {...holdBtn(KEY_CODES.board)} style={btnStyle}>
          {controlMode === 'flight' ? 'F' : 'F'}
        </button>
        <button {...holdBtn(KEY_CODES.jump)} style={{ ...btnStyle, width: 76, height: 76, borderRadius: 38 }}>
          {controlMode === 'flight' ? 'THR' : 'JMP'}
        </button>
      </div>
    </div>
  );
}
