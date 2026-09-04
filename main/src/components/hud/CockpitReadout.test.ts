import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ApproachReadout } from '../../game/spaceStation/spaceStationApproach.ts';
import { presentCockpitApproach } from './CockpitReadout.tsx';

function readout(overrides: Partial<ApproachReadout> = {}): ApproachReadout {
  return {
    phase: 'approach',
    distance: 420,
    hullDistance: 390,
    offAxis: 0,
    closingSpeed: 18,
    insideCorridor: true,
    canDock: false,
    blocker: 'range',
    advisory: 'on the corridor \u00b7 420 to the berth',
    ...overrides
  };
}

describe('Kestrel station approach presentation', () => {
  it('keeps the shipped approach in the cockpit instead of mounting a parallel HUD', () => {
    const appSource = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8');
    const sandboxSource = readFileSync(
      new URL('../spaceStation/SpaceStationSandbox.tsx', import.meta.url),
      'utf8'
    );

    expect(appSource).toContain('suppressedByStoryRoute={stationReturnRouteOwned}');
    expect(appSource).toContain('subscribeStationReturn');
    expect(appSource).not.toContain('<SpaceStationApproachHud');
    expect(appSource).not.toContain("from './components/hud/SpaceStationApproachHud.tsx'");
    expect(sandboxSource).toContain('data-testid="spaceStation-approach-hud"');
  });

  it('carries the procedural range, corridor, and closing gates into the cockpit rail', () => {
    expect(presentCockpitApproach(readout())).toEqual({
      status: 'CORRIDOR HELD',
      advisory: 'ON THE CORRIDOR \u00b7 420 TO THE BERTH',
      range: '420 U',
      alignment: 'ON CORRIDOR',
      closing: '18 / 34',
      canDock: false,
      tone: 'nominal',
      rangeWarning: true,
      alignmentWarning: false,
      closingWarning: false
    });
  });

  it('keeps alignment and speed refusals visible without inventing new gate math', () => {
    expect(presentCockpitApproach(readout({
      phase: 'berth',
      offAxis: Math.PI / 6,
      closingSpeed: 49,
      insideCorridor: false,
      blocker: 'alignment',
      advisory: 'at the berth but off the corridor \u00b7 line up on the mouth'
    }))).toMatchObject({
      status: 'DOCK MOUTH \u00b7 ALIGN',
      alignment: '30\u00b0 OFF',
      closing: '49 / 34',
      tone: 'warning',
      alignmentWarning: true,
      closingWarning: true
    });
  });

  it('publishes clearance as the ready state consumed by the existing F or LAND input', () => {
    expect(presentCockpitApproach(readout({
      phase: 'cleared',
      distance: 60,
      closingSpeed: 0,
      canDock: true,
      blocker: null,
      advisory: 'cleared to dock'
    }))).toEqual({
      status: 'CLEARANCE AVAILABLE',
      advisory: 'CLEARED TO DOCK',
      range: '60 U',
      alignment: 'ON CORRIDOR',
      closing: '0 / 34',
      canDock: true,
      tone: 'ready',
      rangeWarning: false,
      alignmentWarning: false,
      closingWarning: false
    });
  });

  it('colors only the failed gate while warning about unsafe closing speed early', () => {
    expect(presentCockpitApproach(readout({
      closingSpeed: 45,
      blocker: 'range'
    }))).toMatchObject({
      rangeWarning: true,
      alignmentWarning: false,
      closingWarning: true
    });

    expect(presentCockpitApproach(readout({
      phase: 'berth',
      distance: 45,
      closingSpeed: 46,
      blocker: 'speed',
      advisory: 'too fast to dock \u00b7 46 closing, limit 34'
    }))).toMatchObject({
      status: 'CLOSING SPEED HIGH',
      rangeWarning: false,
      alignmentWarning: false,
      closingWarning: true
    });
  });
});
