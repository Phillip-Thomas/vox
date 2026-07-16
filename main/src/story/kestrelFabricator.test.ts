import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearStationAccessSource,
  getAccessibleStations,
  resetStationAccessSources,
  setStationAccessSource
} from '../game/data/stations.ts';
import {
  applyShipRestorationSnapshot,
  resetShipRestoration
} from '../game/systems/shipRestoration.ts';
import {
  installKestrelFabricatorAccess,
  KESTREL_FABRICATOR_SOURCE_ID
} from './kestrelFabricator.ts';
import { TIDEGARDEN_WORLD_ID } from './tidegardenRoute.ts';

describe('durable Kestrel Fabricator capability', () => {
  beforeEach(() => {
    resetStationAccessSources();
    resetShipRestoration();
  });

  afterEach(() => {
    resetStationAccessSources();
    resetShipRestoration();
  });

  it('survives the wreck-bench source unmount and clears only with ship reset', () => {
    const uninstall = installKestrelFabricatorAccess(() => 'tidegarden');
    expect(getAccessibleStations()).toEqual(['hand']);

    setStationAccessSource('story-wreck-bench', ['smelter', 'assembler']);
    applyShipRestorationSnapshot({ repairStage: 'flight_ready', currentWorldId: 'tidegarden' });
    clearStationAccessSource('story-wreck-bench');
    expect(getAccessibleStations()).toEqual(['hand', 'smelter', 'assembler']);

    clearStationAccessSource(KESTREL_FABRICATOR_SOURCE_ID);
    expect(getAccessibleStations()).toEqual(['hand']);
    applyShipRestorationSnapshot({ repairStage: 'flight_ready', currentWorldId: 'tidegarden' });
    expect(getAccessibleStations()).toEqual(['hand', 'smelter', 'assembler']);

    resetShipRestoration();
    expect(getAccessibleStations()).toEqual(['hand']);
    uninstall();
  });

  it('does not project the Kestrel station link into a world where the ship is absent', () => {
    const uninstall = installKestrelFabricatorAccess(() => 'origin');
    applyShipRestorationSnapshot({ repairStage: 'flight_ready', currentWorldId: 'tidegarden' });
    expect(getAccessibleStations()).toEqual(['hand']);
    uninstall();
  });

  it('repairs pre-location Ch9 saves only on the world where the landed Kestrel is visible', () => {
    const uninstall = installKestrelFabricatorAccess(() => TIDEGARDEN_WORLD_ID);
    applyShipRestorationSnapshot({ repairStage: 'flight_ready', currentWorldId: null });
    expect(getAccessibleStations()).toEqual(['hand', 'smelter', 'assembler']);
    uninstall();

    const origin = installKestrelFabricatorAccess(() => '-1,-1');
    expect(getAccessibleStations()).toEqual(['hand']);
    origin();
  });
});
