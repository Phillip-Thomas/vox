import { beforeEach, describe, expect, it } from 'vitest';
import {
  DAY_LENGTH_MS,
  clearServerWorldClock,
  createLocalWorldClockSource,
  getCurrentDayPhase,
  getWorldClockSource,
  resolveWorldDayPhase,
  setCurrentDayPhase,
  setDayPhaseOffset,
  setServerWorldClock
} from './worldClock.ts';

beforeEach(() => {
  clearServerWorldClock();
  setDayPhaseOffset(0);
  setCurrentDayPhase(0.25);
});

describe('world clock seam', () => {
  it('restores a saved global day phase at reload and keeps cycling from there', () => {
    setDayPhaseOffset(0.42);

    expect(resolveWorldDayPhase({
      source: createLocalWorldClockSource(0, '0,0')
    })).toBeCloseTo(0.42);

    expect(resolveWorldDayPhase({
      source: createLocalWorldClockSource(DAY_LENGTH_MS / 1000 / 2, '0,0')
    })).toBeCloseTo(0.92);
  });

  it('keeps offline single-player on one global local-client clock across world swaps', () => {
    const elapsedSeconds = 37;
    const a = resolveWorldDayPhase({
      source: getWorldClockSource(elapsedSeconds, '0,0')
    });
    const b = resolveWorldDayPhase({
      source: getWorldClockSource(elapsedSeconds, '8,-3')
    });

    expect(getWorldClockSource(elapsedSeconds, '0,0')).toMatchObject({
      owner: 'local_client',
      worldId: '0,0'
    });
    expect(a).toBeCloseTo(b);
  });

  it('lets debug forced day phase override the active clock', () => {
    setDayPhaseOffset(0.5);

    expect(resolveWorldDayPhase({
      source: createLocalWorldClockSource(120, '0,0'),
      forcedDayPhase: 1.75
    })).toBe(0.75);
  });

  it('can be switched to a server-owned world clock without changing consumers', () => {
    setDayPhaseOffset(0.5);
    setServerWorldClock({
      worldId: '2,4',
      worldTimeMs: DAY_LENGTH_MS * 0.125,
      updatedAtMs: 10
    });

    const source = getWorldClockSource(999, '2,4', 1010);

    expect(source).toMatchObject({
      owner: 'server',
      worldId: '2,4',
      updatedAtMs: 10
    });
    expect(source.worldTimeMs).toBe(DAY_LENGTH_MS * 0.125 + 1000);
    // Local saved dayPhase offsets are offline-only; server room time is absolute.
    expect(resolveWorldDayPhase({ source })).toBeCloseTo(0.125 + 1000 / DAY_LENGTH_MS);

    expect(getWorldClockSource(5, '0,0', 1010)).toMatchObject({
      owner: 'local_client',
      worldId: '0,0',
      worldTimeMs: 5000
    });
  });

  it('stores the currently rendered day phase for save/debug readers', () => {
    setCurrentDayPhase(1.2);

    expect(getCurrentDayPhase()).toBeCloseTo(0.2);
  });
});
