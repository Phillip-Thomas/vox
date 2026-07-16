import {
  clearStationAccessSource,
  setStationAccessSource
} from '../game/data/stations.ts';
import {
  getShipRepairStage,
  getShipRestorationSnapshot,
  subscribeShipRestoration
} from '../game/systems/shipRestoration.ts';
import { TIDEGARDEN_WORLD_ID } from './tidegardenRoute.ts';

export const KESTREL_FABRICATOR_SOURCE_ID = 'story:kestrel-integrated-fabricator';
export const KESTREL_FABRICATOR_STATIONS = ['smelter', 'assembler'] as const;

/**
 * Flight readiness means the wreck bench has been integrated into the Kestrel.
 * This is a durable ship capability, not a proximity effect owned by Ch7's
 * wreck component, so it survives boarding and planet/world remounts.
 */
export function reconcileKestrelFabricatorAccess(activeWorldId: string): boolean {
  const ship = getShipRestorationSnapshot();
  const available = getShipRepairStage() === 'flight_ready'
    && (
      ship.currentWorldId === activeWorldId
      // Early Ch9 saves predate persisted ship locations. Tidegarden visibly
      // mounts the landed Kestrel, so repair that one legacy boundary without
      // projecting its Fabricator into arbitrary worlds.
      || (ship.currentWorldId === null && activeWorldId === TIDEGARDEN_WORLD_ID)
    );
  if (available) {
    setStationAccessSource(KESTREL_FABRICATOR_SOURCE_ID, KESTREL_FABRICATOR_STATIONS);
  } else {
    clearStationAccessSource(KESTREL_FABRICATOR_SOURCE_ID);
  }
  return available;
}

/** App-lifetime bridge from durable ship state into the Fabricator station UI. */
export function installKestrelFabricatorAccess(getActiveWorldId: () => string): () => void {
  const reconcile = () => reconcileKestrelFabricatorAccess(getActiveWorldId());
  reconcile();
  const unsubscribe = subscribeShipRestoration(reconcile);
  return () => {
    unsubscribe();
    clearStationAccessSource(KESTREL_FABRICATOR_SOURCE_ID);
  };
}
