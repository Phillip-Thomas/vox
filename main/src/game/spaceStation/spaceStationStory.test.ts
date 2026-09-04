import { beforeEach, describe, expect, it } from 'vitest';
import { getItemCount, resetInventory } from '../systems/inventorySystem.ts';
import { hasMilestone, markMilestone, resetProgression } from '../systems/progressionSystem.ts';
import {
  loadGlobal,
  setLocalPersistenceMode,
  type GlobalSave
} from '../systems/persistence.ts';
import { buildSpaceStationDescriptor } from './spaceStationDescriptor.ts';
import { buildSpaceStationVendors, certifiedComponentIssuer } from './spaceStationVendors.ts';
import {
  BONDED_CELL_ITEM_ID,
  STATION_STORY_MILESTONES,
  commitBondedCellStowed,
  commitConcourseEntered,
  commitDesignationPresented,
  commitHabitatFaultPresented,
  commitRegistryRecorded,
  commitStationDeparted,
  commitStationDocked,
  deriveStationStoryStep,
  issueBondedCell,
  persistStationStory,
  reconcileStationStoryCargo,
  stationStoryEligible,
  stationStoryObjective,
  storyStationAddress
} from './spaceStationStory.ts';

class MemStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
  clear() { this.values.clear(); }
  key() { return null; }
  get length() { return this.values.size; }
}

function eligibleSave(): GlobalSave {
  return {
    inventory: {},
    mawCharge: 0,
    era: 'paravox_machina',
    milestones: [
      'story:ch10-bearing-claimed',
      'story:ch10-complete',
      'story:station-docking-authorized'
    ],
    lastWorld: { x: -1, y: -1 },
    lastPlanetWorldId: '-1,-1:p1',
    dayPhase: 0.73
  };
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemStorage }).localStorage = new MemStorage();
  setLocalPersistenceMode('offline');
  resetInventory();
  resetProgression();
});

describe('station story entry fence', () => {
  it('requires the shipped handoff, all Chapter 10 receipts, and the exact claimed station', () => {
    const address = storyStationAddress();
    expect(address).not.toBeNull();
    expect(stationStoryEligible(address!, eligibleSave(), '?spacestation=-1,-1,0&from=game')).toBe(true);
    expect(stationStoryEligible(address!, eligibleSave(), '?spacestation=-1,-1,0')).toBe(false);
    expect(stationStoryEligible(
      { ...address!, index: address!.index + 1 },
      eligibleSave(),
      '?spacestation=-1,-1,1&from=game'
    )).toBe(false);
    const missing = eligibleSave();
    missing.milestones = missing.milestones.filter(id => id !== 'story:ch10-complete');
    expect(stationStoryEligible(address!, missing, '?from=game')).toBe(false);
  });

  it('saves story cargo without collapsing the exact Tidegarden world id or day phase', () => {
    const sourceSave = eligibleSave();
    markMilestone(STATION_STORY_MILESTONES.registryRecorded);
    markMilestone(STATION_STORY_MILESTONES.habitatFaultPresented);
    issueBondedCell();
    persistStationStory({
      address: storyStationAddress()!,
      sourceSave,
      offline: true
    });

    expect(loadGlobal()).toMatchObject({
      inventory: { bonded_cell: 1 },
      lastWorld: { x: -1, y: -1 },
      lastPlanetWorldId: '-1,-1:p1',
      dayPhase: 0.73
    });
  });
});

describe('station story receipts', () => {
  it('cannot skip the counter or issue the cell before its fault record is presented', () => {
    expect(deriveStationStoryStep()).toBe('registry');
    expect(commitRegistryRecorded()).toMatchObject({ ok: false });
    expect(issueBondedCell()).toMatchObject({ ok: false });
    expect(commitBondedCellStowed()).toMatchObject({ ok: false });

    expect(commitStationDocked()).toMatchObject({ ok: true, changed: true });
    expect(commitDesignationPresented()).toMatchObject({ ok: true, changed: true });
    expect(commitRegistryRecorded()).toMatchObject({ ok: true, changed: true });
    expect(deriveStationStoryStep()).toBe('issuer');
    expect(commitConcourseEntered()).toMatchObject({ ok: true, changed: true });
    expect(issueBondedCell()).toMatchObject({ ok: false });
    expect(commitHabitatFaultPresented()).toMatchObject({ ok: true, changed: true });

    expect(issueBondedCell()).toMatchObject({ ok: true, changed: true });
    expect(getItemCount(BONDED_CELL_ITEM_ID)).toBe(1);
    expect(hasMilestone(STATION_STORY_MILESTONES.tradeUnlocked)).toBe(true);
    expect(deriveStationStoryStep()).toBe('depart');

    expect(commitStationDeparted()).toMatchObject({ ok: false });
    expect(commitBondedCellStowed()).toMatchObject({ ok: true, changed: true });
    expect(commitStationDeparted()).toMatchObject({ ok: true, changed: true });
    expect(deriveStationStoryStep()).toBe('complete');
  });

  it('is idempotent across repeat issuance and repairs either half of a partial save', () => {
    for (const id of [
      STATION_STORY_MILESTONES.docked,
      STATION_STORY_MILESTONES.designationPresented,
      STATION_STORY_MILESTONES.registryRecorded,
      STATION_STORY_MILESTONES.habitatFaultPresented
    ]) markMilestone(id);

    expect(issueBondedCell()).toMatchObject({ ok: true, changed: true });
    expect(issueBondedCell()).toMatchObject({ ok: true, changed: false });
    expect(getItemCount(BONDED_CELL_ITEM_ID)).toBe(1);

    resetInventory();
    expect(reconcileStationStoryCargo()).toMatchObject({ ok: true, changed: true });
    expect(getItemCount(BONDED_CELL_ITEM_ID)).toBe(1);

    resetProgression();
    markMilestone(STATION_STORY_MILESTONES.registryRecorded);
    expect(reconcileStationStoryCargo()).toMatchObject({ ok: true, changed: true });
    expect(hasMilestone(STATION_STORY_MILESTONES.bondedCellAcquired)).toBe(true);
    expect(hasMilestone(STATION_STORY_MILESTONES.tradeUnlocked)).toBe(true);
    expect(getItemCount(BONDED_CELL_ITEM_ID)).toBe(1);
  });
});

describe('station story world targets', () => {
  it('selects frozen certified issuer B-7073 Bell and keeps a target for every required step', () => {
    const address = storyStationAddress()!;
    const descriptor = buildSpaceStationDescriptor(address);
    const vendors = buildSpaceStationVendors(descriptor);
    const issuer = certifiedComponentIssuer(vendors);
    expect(issuer).toMatchObject({ designation: 'B-7073', name: 'Bell', specialty: 'certified' });

    expect(stationStoryObjective(descriptor, vendors)).toMatchObject({
      targetKind: 'registry',
      markerLabel: 'COUNTER · PRESENT DESIGNATION'
    });
    markMilestone(STATION_STORY_MILESTONES.registryRecorded);
    expect(stationStoryObjective(descriptor, vendors)).toMatchObject({
      targetKind: 'issuer',
      vendorId: issuer!.id
    });
    markMilestone(STATION_STORY_MILESTONES.habitatFaultPresented);
    issueBondedCell();
    expect(stationStoryObjective(descriptor, vendors)).toMatchObject({
      targetKind: 'airlock',
      markerLabel: 'KESTREL AIRLOCK · STOW THE CELL'
    });
  });
});
