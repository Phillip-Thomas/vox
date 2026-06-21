// Mobile / touch input bridge.
//
// The on-foot and ship controllers consume input through (a) drei
// KeyboardControls + raw key listeners and (b) document 'mousemove' (gated by
// pointer lock). Mobile has no keyboard and can't pointer-lock, so the virtual
// controls (TouchControls.tsx) feed those SAME paths by SYNTHESIZING DOM events
// — no change to the consumption code — plus a global "touch active" flag the
// controllers OR into their pointer-lock gates so look/move work without a lock.

let touchActive = false;

/** True while the on-screen touch controls are mounted (a touch device). The
 *  controllers treat this like "pointer locked" so movement + look are enabled. */
export function isTouchActive(): boolean {
  return touchActive;
}

export function setTouchActive(value: boolean): void {
  touchActive = value;
}

/** Heuristic: a touch-first device (also covers narrow viewports for testing). */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'ontouchstart' in window ||
    (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) ||
    window.innerWidth <= 820
  );
}

// Map the mapped action names to their KeyboardControls `code`s so the virtual
// joystick/buttons can press the exact keys the controllers already listen for.
export const KEY_CODES = {
  forward: 'KeyW',
  backward: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  jump: 'Space',
  board: 'KeyF',
  rollLeft: 'KeyQ',
  rollRight: 'KeyE'
} as const;

const pressed = new Set<string>();

// Dispatch on `document` with bubbles:true so the event reaches BOTH document
// listeners (ShipController's raw Q/E/F/Space) AND window listeners (drei
// KeyboardControls, App hotkeys) via bubbling — exactly once each, no doubles.
/** Synthesize a keydown for `code` (idempotent — no auto-repeat storms). */
export function pressKey(code: string): void {
  if (pressed.has(code)) return;
  pressed.add(code);
  document.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
}

/** Synthesize a keyup for `code`. */
export function releaseKey(code: string): void {
  if (!pressed.has(code)) return;
  pressed.delete(code);
  document.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
}

/** Release every currently-held synthetic key (call on unmount / mode switch). */
export function releaseAllKeys(): void {
  for (const code of [...pressed]) releaseKey(code);
}

/** Synthesize a relative mouse-look delta (drives the controllers' mousemove
 *  look path, which reads movementX/movementY). */
export function dispatchLook(movementX: number, movementY: number): void {
  document.dispatchEvent(new MouseEvent('mousemove', { movementX, movementY, bubbles: true }));
}

/**
 * Translate a joystick vector (components in [-1,1], y up) into the held WASD
 * set, with a deadzone. Presses/releases keys to match. Returns the active set.
 */
export function applyJoystickToKeys(x: number, y: number, deadzone = 0.25): void {
  const want = new Set<string>();
  if (Math.hypot(x, y) >= deadzone) {
    if (y > deadzone) want.add(KEY_CODES.forward);
    if (y < -deadzone) want.add(KEY_CODES.backward);
    if (x > deadzone) want.add(KEY_CODES.right);
    if (x < -deadzone) want.add(KEY_CODES.left);
  }
  for (const code of [KEY_CODES.forward, KEY_CODES.backward, KEY_CODES.left, KEY_CODES.right]) {
    if (want.has(code)) pressKey(code);
    else releaseKey(code);
  }
}
