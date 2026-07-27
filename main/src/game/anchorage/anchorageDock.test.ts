import { describe, expect, it } from 'vitest';
import { buildAnchorageDescriptor, anchorageDockRoute, anchorageSpawnPoint } from './anchorageDescriptor.ts';
import {
  advanceDock,
  beginDock,
  createDockState,
  DOCK_TIMING,
  DOCK_TOTAL_SECONDS,
  dockEyeAt,
  dockInputLocked,
  dockReadout,
  skipDock,
  STATION_PRESSURE_KPA,
  type DockEffect,
  type DockState
} from './anchorageDock.ts';

/** Run the sequence at a fixed step, collecting every effect it emits. */
function run(seconds: number, step = 1 / 60): { state: DockState; effects: DockEffect[] } {
  let state = beginDock(createDockState());
  const effects: DockEffect[] = [];
  for (let t = 0; t < seconds; t += step) {
    const advance = advanceDock(state, step);
    state = advance.state;
    effects.push(...advance.effects);
  }
  return { state, effects };
}

describe('dock sequence', () => {
  it('does nothing until it is begun', () => {
    const idle = createDockState();
    expect(idle.phase).toBe('idle');
    expect(advanceDock(idle, 10).state.phase).toBe('idle');
    expect(dockInputLocked(idle)).toBe(false);
  });

  it('runs clamps, pressure, hatch and disembark in order', () => {
    const { state, effects } = run(DOCK_TOTAL_SECONDS + 0.5);
    expect(state.phase).toBe('complete');
    expect(effects).toEqual([
      'clamps-engaged',
      'pressure-equalised',
      'hatch-open',
      'control-handback'
    ]);
  });

  it('holds the player through the whole sequence and releases at the end', () => {
    const midway = run(DOCK_TIMING.clamping + 0.4);
    expect(dockInputLocked(midway.state)).toBe(true);
    expect(midway.state.handedBack).toBe(false);

    const done = run(DOCK_TOTAL_SECONDS + 0.5);
    expect(dockInputLocked(done.state)).toBe(false);
    expect(done.state.handedBack).toBe(true);
  });

  it('does not swallow a transition when one frame spans several stages', () => {
    // A long frame during arrival is exactly when a hitch happens; dropping the
    // hatch cue because the delta was big would lose a sound with no error.
    const advance = advanceDock(beginDock(createDockState()), DOCK_TOTAL_SECONDS + 1);
    expect(advance.state.phase).toBe('complete');
    expect(advance.effects).toEqual([
      'clamps-engaged',
      'pressure-equalised',
      'hatch-open',
      'control-handback'
    ]);
  });

  it('reaches the same end state at any frame rate', () => {
    for (const step of [1 / 144, 1 / 60, 1 / 12, 0.4]) {
      const { state, effects } = run(DOCK_TOTAL_SECONDS + 1, step);
      expect(state.phase, `step ${step}`).toBe('complete');
      expect(effects.length, `step ${step}`).toBe(4);
    }
  });

  it('can be skipped, and still hands control back', () => {
    const partway = run(DOCK_TIMING.clamping + 0.2);
    const skipped = skipDock(partway.state);
    expect(skipped.state.phase).toBe('complete');
    expect(skipped.state.handedBack).toBe(true);
    expect(skipped.effects).toEqual(['control-handback']);
  });

  it('is inert to a skip once it is already over', () => {
    const done = run(DOCK_TOTAL_SECONDS + 0.5);
    expect(skipDock(done.state).effects).toEqual([]);
  });
});

describe('dock readout', () => {
  it('starts sealed, dark and at vacuum', () => {
    const readout = dockReadout(beginDock(createDockState()));
    expect(readout.pressureKpa).toBe(0);
    expect(readout.aperture).toBe(0);
    expect(readout.reveal).toBe(0);
    expect(readout.travel).toBe(0);
  });

  it('brings the lock to station pressure before the hatch moves', () => {
    const beforeHatch = run(DOCK_TIMING.clamping + DOCK_TIMING.pressurising - 0.05);
    const readout = dockReadout(beforeHatch.state);
    expect(readout.pressureKpa).toBeGreaterThan(STATION_PRESSURE_KPA * 0.9);
    expect(readout.aperture).toBe(0);
  });

  it('opens the hatch and lights the deck before it starts moving you', () => {
    const opening = run(DOCK_TIMING.clamping + DOCK_TIMING.pressurising + DOCK_TIMING.hatch - 0.05);
    const readout = dockReadout(opening.state);
    expect(readout.aperture).toBeGreaterThan(0.9);
    expect(readout.reveal).toBeGreaterThan(0.7);
    expect(readout.travel).toBe(0);
  });

  it('ends fully open, fully lit, fully arrived, with the lock panel gone', () => {
    const readout = dockReadout(run(DOCK_TOTAL_SECONDS + 0.5).state);
    expect(readout.aperture).toBe(1);
    expect(readout.reveal).toBe(1);
    expect(readout.travel).toBe(1);
    expect(readout.panelOpacity).toBe(0);
  });

  it('never runs a stage backwards', () => {
    let state = beginDock(createDockState());
    let previous = dockReadout(state);
    for (let t = 0; t < DOCK_TOTAL_SECONDS + 0.5; t += 1 / 90) {
      state = advanceDock(state, 1 / 90).state;
      const next = dockReadout(state);
      expect(next.pressureKpa).toBeGreaterThanOrEqual(previous.pressureKpa - 1e-9);
      expect(next.aperture).toBeGreaterThanOrEqual(previous.aperture - 1e-9);
      expect(next.travel).toBeGreaterThanOrEqual(previous.travel - 1e-9);
      previous = next;
    }
  });
});

describe('dock route', () => {
  const descriptor = buildAnchorageDescriptor({ system: { x: -19, y: -17 }, index: 0 });
  const route = anchorageDockRoute(descriptor);
  const apron = descriptor.graph.cells.find(cell => cell.kind === 'apron')!;

  it('puts the lock at the dock end of the apron and walks you inward', () => {
    expect(route.lock[0]).toBeGreaterThan(apron.min[0]);
    expect(route.deck[0]).toBeGreaterThan(route.lock[0]);
    expect(route.deck[0]).toBeLessThan(apron.max[0]);
  });

  it('sets you down exactly where a plain spawn would put you', () => {
    expect(anchorageSpawnPoint(descriptor)).toEqual(route.deck);
  });

  it('carries the eye from the lock to the deck without leaving the floor', () => {
    const start = dockEyeAt(route, 0, 1.68);
    const end = dockEyeAt(route, 1, 1.68);
    expect(start[0]).toBeCloseTo(route.lock[0], 6);
    expect(end[0]).toBeCloseTo(route.deck[0], 6);
    expect(start[1]).toBeCloseTo(apron.min[1] + 1.68, 6);
    expect(end[1]).toBeCloseTo(apron.min[1] + 1.68, 6);
  });
});
