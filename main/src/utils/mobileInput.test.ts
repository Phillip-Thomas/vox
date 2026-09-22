import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyJoystickToKeys,
  allowsMousePointerLock,
  KEY_CODES,
  pressKey,
  releaseAllKeys,
  releaseKey,
  setTouchActive
} from './mobileInput.ts';

// mobileInput synthesizes DOM KeyboardEvents on `document` so the (unchanged)
// controllers see the same keydown/keyup a physical keyboard produces. The suite
// runs in the node env (no DOM), so stub exactly the two globals the bridge
// touches and record what it dispatches. The module-level "currently down"
// registry is a singleton across the module's lifetime, so each test starts by
// flushing it — that is also the property under test (releaseAll clears it).

type Dispatched = { type: string; code: string };
let dispatched: Dispatched[];

beforeEach(() => {
  setTouchActive(false);
  dispatched = [];
  vi.stubGlobal(
    'KeyboardEvent',
    class {
      type: string;
      code: string;
      bubbles: boolean;
      constructor(type: string, init: { code: string; bubbles?: boolean }) {
        this.type = type;
        this.code = init.code;
        this.bubbles = init.bubbles ?? false;
      }
    }
  );
  vi.stubGlobal('document', {
    dispatchEvent: (event: Dispatched) => {
      dispatched.push({ type: event.type, code: event.code });
      return true;
    }
  });
  releaseAllKeys(); // flush any residue held by the singleton from a prior test
  dispatched.length = 0; // and ignore those flush keyups
});

afterEach(() => {
  setTouchActive(false);
  releaseAllKeys();
  vi.unstubAllGlobals();
});

const keydowns = () => dispatched.filter(e => e.type === 'keydown').map(e => e.code);
const keyups = () => dispatched.filter(e => e.type === 'keyup').map(e => e.code);

describe('pointer lock after a touch control changes scene', () => {
  it('rejects a touch compatibility click after the held control unmounts', () => {
    setTouchActive(true);
    pressKey('KeyD');
    releaseAllKeys();
    setTouchActive(false);
    expect(allowsMousePointerLock({ pointerType: 'touch' } as unknown as MouseEvent)).toBe(false);
    // The next scene can take a fresh ordinary hold without retaining old keys.
    pressKey('KeyE');
    expect(keyups()).toEqual(['KeyD']);
    expect(keydowns()).toEqual(['KeyD', 'KeyE']);
  });

  it('recognizes touch-generated MouseEvents without pointerType', () => {
    const click = { sourceCapabilities: { firesTouchEvents: true } } as unknown as MouseEvent;
    expect(allowsMousePointerLock(click)).toBe(false);
  });

  it('keeps real desktop mouse clicks eligible after touch controls retire', () => {
    const click = { pointerType: 'mouse' } as unknown as MouseEvent;
    setTouchActive(true);
    expect(allowsMousePointerLock(click)).toBe(false);
    setTouchActive(false);
    expect(allowsMousePointerLock(click)).toBe(true);
    expect(allowsMousePointerLock({} as MouseEvent)).toBe(true);
  });
});

describe('mobileInput synthetic-key registry', () => {
  it('presses a code exactly once until it is released (no auto-repeat storm)', () => {
    pressKey('KeyE');
    pressKey('KeyE');
    pressKey('KeyE');
    expect(keydowns()).toEqual(['KeyE']);
    expect(keyups()).toEqual([]);
  });

  it('releases a down code once and is idempotent on repeat releases', () => {
    pressKey('KeyE');
    dispatched.length = 0;

    releaseKey('KeyE');
    releaseKey('KeyE');
    expect(keyups()).toEqual(['KeyE']);
  });

  it('never dispatches a keyup for a code that was never pressed (synthetic-only)', () => {
    // A code the registry does not own must not synthesize a phantom keyup — the
    // registry tracks ONLY synthetic presses and must not fabricate keyboard state.
    releaseKey('KeyW');
    releaseKey('ShiftLeft');
    expect(dispatched).toEqual([]);
  });

  it('can re-press a code after it has been released', () => {
    pressKey('KeyE');
    releaseKey('KeyE');
    dispatched.length = 0;

    pressKey('KeyE');
    expect(keydowns()).toEqual(['KeyE']);
  });

  it('tracks distinct codes independently', () => {
    pressKey('KeyW');
    pressKey('Space');
    expect(keydowns()).toEqual(['KeyW', 'Space']);

    releaseKey('KeyW');
    expect(keyups()).toEqual(['KeyW']); // Space stays down
  });

  it('releaseAllKeys releases every held code once and clears the registry', () => {
    pressKey('KeyW');
    pressKey('KeyE');
    pressKey('Space');
    dispatched.length = 0;

    releaseAllKeys();
    expect(keyups().sort()).toEqual(['KeyE', 'KeyW', 'Space']);

    // Registry is empty now: a second sweep dispatches nothing...
    dispatched.length = 0;
    releaseAllKeys();
    expect(dispatched).toEqual([]);

    // ...and a fresh press after the sweep dispatches a new keydown.
    pressKey('KeyW');
    expect(keydowns()).toEqual(['KeyW']);
  });
});

describe('mobileInput joystick → WASD synthesis', () => {
  it('presses the matching directions inside the deadzone and releases them when centered', () => {
    applyJoystickToKeys(1, 0); // full right
    expect(keydowns()).toContain(KEY_CODES.right);
    expect(keydowns()).not.toContain(KEY_CODES.left);

    dispatched.length = 0;
    applyJoystickToKeys(0, 0); // recenter → release everything held
    expect(keyups()).toContain(KEY_CODES.right);
  });

  it('holds a code across successive frames without re-pressing it', () => {
    applyJoystickToKeys(0, 1); // forward
    dispatched.length = 0;
    applyJoystickToKeys(0, 1); // still forward, next frame
    expect(dispatched).toEqual([]); // idempotent: no duplicate keydown
  });
});
