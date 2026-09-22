import { beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  commitHabitatCorePlacement,
  resetHabitats
} from '../game/systems/habitatSystem.ts';
import { addItem, getItemCount, resetInventory } from '../game/systems/inventorySystem.ts';
import { hasMilestone, markMilestone, resetProgression } from '../game/systems/progressionSystem.ts';
import { resetSystemFlightForInterstellarArrival, resetSystemFlightStoreForTests } from '../state/systemFlight.ts';
import { resetTravel } from '../state/spaceFlight.ts';
import {
  STATION_RETURN_MILESTONES,
  installTidegardenBondedCell,
  stationReturnMarkerTarget,
  stationReturnObjective,
  stationReturnPending
} from './stationReturnStory.ts';
import { TIDEGARDEN_WORLD_ID } from './tidegardenRoute.ts';

const CORE: [number, number, number] = [16, 50.24, -8];

beforeEach(() => {
  resetInventory();
  resetProgression();
  resetHabitats();
  resetTravel();
  resetSystemFlightStoreForTests();
});

function prepareReturn() {
  addItem('bonded_cell', 1);
  markMilestone(STATION_RETURN_MILESTONES.bondedCellAcquired);
  markMilestone(STATION_RETURN_MILESTONES.stationDeparted);
  commitHabitatCorePlacement({
    actorId: 'local',
    worldId: TIDEGARDEN_WORLD_ID,
    shelterId: 'habitat:test',
    cell: [8, 25, -4],
    supportCell: [8, 24, -4],
    position: CORE,
    up: [0, 1, 0],
    eventId: 'test:core'
  });
}

describe('station return story', () => {
  it('requires the actual cargo and station departure receipt', () => {
    markMilestone(STATION_RETURN_MILESTONES.bondedCellAcquired);
    markMilestone(STATION_RETURN_MILESTONES.stationDeparted);
    expect(stationReturnPending()).toBe(false);
    addItem('bonded_cell', 1);
    expect(stationReturnPending()).toBe(true);
  });

  it('installs once at the real second hearth, consumes cargo, and closes the objective', () => {
    prepareReturn();
    expect(installTidegardenBondedCell({
      worldId: TIDEGARDEN_WORLD_ID,
      playerPosition: new THREE.Vector3(CORE[0] + 1, CORE[1], CORE[2])
    })).toEqual({ ok: true, changed: true });
    expect(getItemCount('bonded_cell')).toBe(0);
    expect(hasMilestone(STATION_RETURN_MILESTONES.bondedCellInstalled)).toBe(true);
    expect(hasMilestone(STATION_RETURN_MILESTONES.hearthRestored)).toBe(true);
    expect(stationReturnPending()).toBe(false);
    expect(installTidegardenBondedCell({
      worldId: TIDEGARDEN_WORLD_ID,
      playerPosition: new THREE.Vector3(...CORE)
    })).toEqual({ ok: true, changed: false });
  });

  it('changes from a spatial return order to the real surface core target', () => {
    prepareReturn();
    expect(stationReturnObjective()).toMatchObject({
      id: 'station:return:tidegarden',
      kind: 'travel',
      markerLabel: 'TIDEGARDEN · SECOND HEARTH'
    });

    resetSystemFlightForInterstellarArrival({
      system: { x: -1, y: -1 },
      activePlanetId: TIDEGARDEN_WORLD_ID,
      locationMode: 'surface',
      pose: {
        position: [0, 0, 0],
        velocity: [0, 0, 0],
        quaternion: [0, 0, 0, 1]
      }
    });
    expect(stationReturnObjective()).toMatchObject({
      id: 'hearth:return:install-cell',
      kind: 'interact',
      markerLabel: 'SECOND HEARTH · INSTALL BONDED CELL'
    });
    expect(stationReturnMarkerTarget()).toMatchObject({
      label: 'SECOND HEARTH · INSTALL BONDED CELL',
      projectionSpace: 'surface'
    });
    expect(stationReturnMarkerTarget()?.position.toArray()).toEqual(CORE);
  });

  it('refuses remote or wrong-world installation without consuming the cell', () => {
    prepareReturn();
    expect(installTidegardenBondedCell({
      worldId: TIDEGARDEN_WORLD_ID,
      playerPosition: new THREE.Vector3(0, 0, 0)
    }).ok).toBe(false);
    expect(installTidegardenBondedCell({
      worldId: '-1,-1',
      playerPosition: new THREE.Vector3(...CORE)
    }).ok).toBe(false);
    expect(getItemCount('bonded_cell')).toBe(1);
  });
});
