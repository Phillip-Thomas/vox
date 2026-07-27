import { describe, expect, it } from 'vitest';
import { buildAnchorageDescriptor, anchorageDockRoute, anchorageSpawnPoint } from './anchorageDescriptor.ts';
import {
  advanceDock,
  beginDock,
  beginUndock,
  createDockState,
  DOCK_TIMING,
  DOCK_TOTAL_SECONDS,
  dockEyeAt,
  dockInputLocked,
  dockReadout,
  skipDock,
  STATION_PRESSURE_KPA,
  UNDOCK_TOTAL_SECONDS,
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


/** Run a departure at a fixed step, collecting every effect it emits. */
function depart(seconds: number, step = 1 / 60): { state: DockState; effects: DockEffect[] } {
  let state = beginUndock();
  const effects: DockEffect[] = [];
  for (let t = 0; t < seconds; t += step) {
    const advance = advanceDock(state, step);
    state = advance.state;
    effects.push(...advance.effects);
  }
  return { state, effects };
}

describe('undock sequence', () => {
  it('boards, seals, vents and releases in order', () => {
    const { state, effects } = depart(UNDOCK_TOTAL_SECONDS + 0.5);
    expect(state.phase).toBe('complete');
    expect(effects).toEqual([
      'hatch-sealed',
      'pressure-vented',
      'clamps-released',
      'control-handback'
    ]);
  });

  it('seals the hatch before it vents the lock', () => {
    // The one ordering that must never invert: opening onto vacuum, or venting
    // through an open hatch, are the same bug from opposite ends.
    const { effects } = depart(UNDOCK_TOTAL_SECONDS + 0.5);
    expect(effects.indexOf('hatch-sealed')).toBeLessThan(effects.indexOf('pressure-vented'));
  });

  it('is close enough in length to the arrival to feel like its mirror', () => {
    // A six-second arrival and a two-second departure reads as the game losing
    // interest in you the moment you have spent your money.
    const ratio = UNDOCK_TOTAL_SECONDS / DOCK_TOTAL_SECONDS;
    expect(ratio).toBeGreaterThan(0.75);
    expect(ratio).toBeLessThan(1.25);
  });

  it('holds the player throughout and releases at the end', () => {
    expect(dockInputLocked(depart(1).state)).toBe(true);
    const done = depart(UNDOCK_TOTAL_SECONDS + 0.5);
    expect(dockInputLocked(done.state)).toBe(false);
    expect(done.state.handedBack).toBe(true);
  });

  it('reaches the same end state at any frame rate', () => {
    for (const step of [1 / 144, 1 / 60, 1 / 12, 0.4]) {
      const { state, effects } = depart(UNDOCK_TOTAL_SECONDS + 1, step);
      expect(state.phase, `step ${step}`).toBe('complete');
      expect(effects.length, `step ${step}`).toBe(4);
    }
  });

  it('can be skipped, and still hands control back', () => {
    const skipped = skipDock(depart(1).state);
    expect(skipped.state.phase).toBe('complete');
    expect(skipped.state.direction).toBe('depart');
    expect(skipped.effects).toEqual(['control-handback']);
  });

  it('does not swallow a transition when one frame spans several stages', () => {
    const advance = advanceDock(beginUndock(), UNDOCK_TOTAL_SECONDS + 1);
    expect(advance.state.phase).toBe('complete');
    expect(advance.effects.length).toBe(4);
  });
});

describe('undock readout runs the arrival backwards', () => {
  it('starts pressurised, open, lit, and out on the deck', () => {
    const readout = dockReadout(beginUndock());
    expect(readout.pressureKpa).toBeCloseTo(STATION_PRESSURE_KPA, 5);
    expect(readout.aperture).toBe(1);
    expect(readout.reveal).toBe(1);
    expect(readout.travel).toBe(1);
  });

  it('ends at vacuum, sealed, dark, and back in the lock', () => {
    const readout = dockReadout(depart(UNDOCK_TOTAL_SECONDS + 0.5).state);
    expect(readout.pressureKpa).toBe(0);
    expect(readout.aperture).toBe(0);
    expect(readout.reveal).toBe(0);
    expect(readout.travel).toBe(0);
  });

  it('never runs a stage backwards — every gauge falls monotonically', () => {
    let state = beginUndock();
    let previous = dockReadout(state);
    for (let t = 0; t < UNDOCK_TOTAL_SECONDS + 0.5; t += 1 / 90) {
      state = advanceDock(state, 1 / 90).state;
      const next = dockReadout(state);
      expect(next.pressureKpa).toBeLessThanOrEqual(previous.pressureKpa + 1e-9);
      expect(next.aperture).toBeLessThanOrEqual(previous.aperture + 1e-9);
      expect(next.travel).toBeLessThanOrEqual(previous.travel + 1e-9);
      previous = next;
    }
  });

  it('is back inside the lock before the hatch has finished closing', () => {
    // Otherwise the hatch shuts on the player standing in the doorway.
    const midSeal = depart(DOCK_TIMING.boarding + DOCK_TIMING.sealing * 0.5);
    const readout = dockReadout(midSeal.state);
    expect(readout.travel).toBeCloseTo(0, 5);
    expect(readout.aperture).toBeGreaterThan(0);
  });

  it('is still pressurised while the hatch is closing', () => {
    const sealing = depart(DOCK_TIMING.boarding + DOCK_TIMING.sealing * 0.5);
    expect(dockReadout(sealing.state).pressureKpa).toBeCloseTo(STATION_PRESSURE_KPA, 5);
  });

  it('labels itself as a departure', () => {
    expect(dockReadout(beginUndock()).title).toMatch(/DEPARTURE/);
    expect(dockReadout(beginDock(createDockState())).title).not.toMatch(/DEPARTURE/);
  });
});
