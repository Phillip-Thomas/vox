import { afterEach, describe, expect, it } from 'vitest';
import {
  getSystemTravelAssistTarget,
  resetSystemTravelAssistForTests,
  setSystemTravelAssistTarget,
  systemApproachSpeedLimit
} from './systemTravelAssist.ts';

afterEach(resetSystemTravelAssistForTests);

describe('system travel approach assist', () => {
  it('holds an unready target outside the activation envelope', () => {
    expect(systemApproachSpeedLimit(900, false)).toBe(320);
    expect(systemApproachSpeedLimit(400, false)).toBe(65);
    expect(systemApproachSpeedLimit(300, false)).toBe(0);
    expect(systemApproachSpeedLimit(185, false)).toBe(0);
  });

  it('slows a ready approach continuously without stopping cruise', () => {
    expect(systemApproachSpeedLimit(900, true)).toBe(320);
    expect(systemApproachSpeedLimit(715, true)).toBe(320);
    expect(systemApproachSpeedLimit(185, true)).toBe(55);
    expect(systemApproachSpeedLimit(100, true)).toBe(55);
    expect(systemApproachSpeedLimit(400, true)).toBeGreaterThan(55);
    expect(systemApproachSpeedLimit(400, true)).toBeLessThan(320);
  });

  it('copies target positions so descriptors cannot mutate live assist state', () => {
    const position: [number, number, number] = [1, 2, 3];
    setSystemTravelAssistTarget({ worldId: '0,0:p1', systemPosition: position, ready: false });
    position[0] = 999;
    expect(getSystemTravelAssistTarget()).toEqual({
      worldId: '0,0:p1',
      systemPosition: [1, 2, 3],
      ready: false
    });
  });

  it('preserves the snapshot when a frame repeats an unchanged target', () => {
    setSystemTravelAssistTarget({
      worldId: '0,0:p1',
      systemPosition: [10, 20, 30],
      ready: true
    });
    const initial = getSystemTravelAssistTarget();

    setSystemTravelAssistTarget({
      worldId: '0,0:p1',
      systemPosition: [10, 20, 30],
      ready: true
    });

    expect(getSystemTravelAssistTarget()).toBe(initial);
  });
});
