import { createPlanetIdentity, buildStarSystemManifest, parsePlanetWorldId } from '../starSystem.ts';
import type { Vec3Tuple } from '../starSystem.ts';
import { addItem, getItemCount } from '../systems/inventorySystem.ts';
import {
  loadGlobal,
  restoreGlobal,
  saveGlobal,
  type GlobalSave
} from '../systems/persistence.ts';
import { hasMilestone, markMilestone } from '../systems/progressionSystem.ts';
import { STORY_COORDINATE } from '../../story/world/storyWorld.ts';
import { systemSpaceStations } from './spaceStationBody.ts';
import { spaceStationDockRoute } from './spaceStationDescriptor.ts';
import type { SpaceStationAddress, SpaceStationDescriptor } from './spaceStationTypes.ts';
import { certifiedComponentIssuer, type Vendor } from './spaceStationVendors.ts';

/**
 * The authored station visit that begins after Chapter 10's threshold hand-back.
 *
 * This page is a separate Vite/React entry from App, so it cannot borrow the live
 * Story director or App's boot-time persistence. The durable facts stay in the
 * same inventory/progression stores, while this small mission derives its local
 * objective entirely from those facts. Reloading the station therefore rebuilds
 * the same step instead of depending on React component history.
 */

export const BONDED_CELL_ITEM_ID = 'bonded_cell' as const;

export const STATION_STORY_MILESTONES = Object.freeze({
  docked: 'story:ch11-docked',
  designationPresented: 'story:ch11-designation-presented',
  registryRecorded: 'story:ch11-registry-recorded',
  concourseEntered: 'story:ch11-concourse-entered',
  habitatFaultPresented: 'story:ch11-habitat-fault-presented',
  bondedCellAcquired: 'story:ch11-bonded-cell-acquired',
  tradeUnlocked: 'story:station-trade-unlocked',
  bondedCellStowed: 'story:ch11-bonded-cell-stowed',
  stationDeparted: 'story:ch11-station-departed'
});

const CHAPTER_10_ENTRY_RECEIPTS = Object.freeze([
  'story:ch10-bearing-claimed',
  'story:ch10-complete',
  'story:station-docking-authorized'
]);

export type StationStoryStep = 'registry' | 'issuer' | 'depart' | 'complete';

export interface StationStorySession {
  address: SpaceStationAddress;
  /** Save loaded before station-local stores were restored. */
  sourceSave: GlobalSave;
  /** True only for the offline hard-navigation story seam. */
  offline: true;
}

export interface StationStoryObjective {
  id: string;
  markerLabel: string;
  workOrder: readonly string[];
  target: Vec3Tuple;
  reach: number;
  verb: string;
  targetKind: 'registry' | 'issuer' | 'airlock';
  vendorId?: string;
}

export interface StationStoryCommit {
  ok: boolean;
  changed: boolean;
  reason?: string;
}

export interface StationVendorTopic {
  id: string;
  label: string;
  playerLine: string;
  reply: string;
}

function sameAddress(a: SpaceStationAddress, b: SpaceStationAddress): boolean {
  return a.index === b.index && a.system.x === b.system.x && a.system.y === b.system.y;
}

/** The one station named by Chapter 10's claimed bearing. */
export function storyStationAddress(): SpaceStationAddress | null {
  const manifest = buildStarSystemManifest(STORY_COORDINATE);
  return systemSpaceStations(STORY_COORDINATE, manifest.systemSeed, 0)[0]?.address ?? null;
}

export function stationStoryEligible(
  address: SpaceStationAddress,
  save: GlobalSave | null,
  search: string
): boolean {
  if (!save) return false;
  if (new URLSearchParams(search).get('from') !== 'game') return false;
  const expected = storyStationAddress();
  if (!expected || !sameAddress(address, expected)) return false;
  const receipts = new Set(save.milestones ?? []);
  return CHAPTER_10_ENTRY_RECEIPTS.every(receipt => receipts.has(receipt));
}

/**
 * Hydrate the stores that App normally restores. Standalone station URLs never
 * call this path and retain their intentionally ephemeral sandbox state.
 */
export function bootstrapStationStorySession(
  address: SpaceStationAddress,
  search = typeof window === 'undefined' ? '' : window.location.search
): StationStorySession | null {
  const save = loadGlobal();
  if (!stationStoryEligible(address, save, search)) return null;
  restoreGlobal(save!);
  const session: StationStorySession = { address, sourceSave: save!, offline: true };
  if (reconcileStationStoryCargo().changed) persistStationStory(session);
  return session;
}

/**
 * Save without collapsing a companion-planet id (for example `-1,-1:p1`) to
 * its system coordinate. That exact identity is what App must resume on undock.
 */
export function persistStationStory(session: StationStorySession): void {
  const planetAddress = session.sourceSave.lastPlanetWorldId
    ? parsePlanetWorldId(session.sourceSave.lastPlanetWorldId)
    : null;
  const world = planetAddress
    ? createPlanetIdentity(planetAddress)
    : session.sourceSave.lastWorld;
  saveGlobal(world, session.sourceSave.dayPhase);
}

export function deriveStationStoryStep(): StationStoryStep {
  if (hasMilestone(STATION_STORY_MILESTONES.stationDeparted)) return 'complete';
  if (hasMilestone(STATION_STORY_MILESTONES.bondedCellAcquired)
    && getItemCount(BONDED_CELL_ITEM_ID) > 0) return 'depart';
  if (hasMilestone(STATION_STORY_MILESTONES.registryRecorded)) return 'issuer';
  return 'registry';
}

export function commitStationDocked(): StationStoryCommit {
  return markOnce(STATION_STORY_MILESTONES.docked);
}

export function commitDesignationPresented(): StationStoryCommit {
  if (!hasMilestone(STATION_STORY_MILESTONES.docked)) {
    return refused('docking receipt required');
  }
  return markOnce(STATION_STORY_MILESTONES.designationPresented);
}

export function commitRegistryRecorded(): StationStoryCommit {
  if (!hasMilestone(STATION_STORY_MILESTONES.designationPresented)) {
    return refused('designation must be presented first');
  }
  return markOnce(STATION_STORY_MILESTONES.registryRecorded);
}

export function commitConcourseEntered(): StationStoryCommit {
  if (!hasMilestone(STATION_STORY_MILESTONES.registryRecorded)) {
    return refused('registry record required');
  }
  return markOnce(STATION_STORY_MILESTONES.concourseEntered);
}

export function commitHabitatFaultPresented(): StationStoryCommit {
  if (!hasMilestone(STATION_STORY_MILESTONES.registryRecorded)) {
    return refused('registry record required');
  }
  return markOnce(STATION_STORY_MILESTONES.habitatFaultPresented);
}

/**
 * The story component is issued, not bought through the sandbox commodity hold.
 * The milestone and the physical item reconcile each other, but the grant never
 * raises the held count above one.
 */
export function issueBondedCell(): StationStoryCommit {
  if (!hasMilestone(STATION_STORY_MILESTONES.habitatFaultPresented)) {
    return refused('habitat fault record required');
  }
  let changed = false;
  if (getItemCount(BONDED_CELL_ITEM_ID) === 0) {
    addItem(BONDED_CELL_ITEM_ID, 1);
    changed = true;
  }
  changed = markIfAbsent(STATION_STORY_MILESTONES.bondedCellAcquired) || changed;
  changed = markIfAbsent(STATION_STORY_MILESTONES.tradeUnlocked) || changed;
  return { ok: true, changed };
}

export function commitBondedCellStowed(): StationStoryCommit {
  if (!hasMilestone(STATION_STORY_MILESTONES.bondedCellAcquired)
    || getItemCount(BONDED_CELL_ITEM_ID) < 1) {
    return refused('bonded cell required');
  }
  return markOnce(STATION_STORY_MILESTONES.bondedCellStowed);
}

export function commitStationDeparted(): StationStoryCommit {
  if (!hasMilestone(STATION_STORY_MILESTONES.bondedCellStowed)) {
    return refused('bonded cell must be stowed first');
  }
  return markOnce(STATION_STORY_MILESTONES.stationDeparted);
}

/** Repair only interrupted partial writes; never duplicate or invent eligibility. */
export function reconcileStationStoryCargo(): StationStoryCommit {
  const hasReceipt = hasMilestone(STATION_STORY_MILESTONES.bondedCellAcquired);
  const count = getItemCount(BONDED_CELL_ITEM_ID);
  let changed = false;

  if (hasReceipt && count === 0) {
    addItem(BONDED_CELL_ITEM_ID, 1);
    changed = true;
  } else if (!hasReceipt && count > 0
    && hasMilestone(STATION_STORY_MILESTONES.registryRecorded)) {
    changed = markIfAbsent(STATION_STORY_MILESTONES.bondedCellAcquired) || changed;
  }
  if (hasMilestone(STATION_STORY_MILESTONES.bondedCellAcquired)) {
    changed = markIfAbsent(STATION_STORY_MILESTONES.tradeUnlocked) || changed;
  }
  return { ok: true, changed };
}

export function stationStoryObjective(
  descriptor: SpaceStationDescriptor,
  vendors: readonly Vendor[]
): StationStoryObjective | null {
  const step = deriveStationStoryStep();
  if (step === 'complete') return null;

  if (step === 'registry') {
    const counter = descriptor.graph.cells.find(cell => cell.kind === 'counter');
    if (!counter) return null;
    const length = counter.max[0] - counter.min[0];
    return {
      id: 'station:counter:registry-entry',
      markerLabel: 'COUNTER · PRESENT DESIGNATION',
      workOrder: [
        'FOLLOW THE REGISTRY CORRIDOR.',
        '[F] PRESENT THE SUIT RECORD.'
      ],
      // The desk fronts sit at maxZ - 1.6; this is the queue side of the middle desk.
      target: [counter.min[0] + length * 0.5, counter.min[1], counter.max[2] - 3.4],
      reach: 4.2,
      verb: 'Present the suit record',
      targetKind: 'registry'
    };
  }

  if (step === 'issuer') {
    const vendor = certifiedComponentIssuer(vendors);
    if (!vendor) return null;
    return {
      id: 'station:concourse:certified-source',
      markerLabel: `CERTIFIED COMPONENTS · ${vendor.designation} “${vendor.name.toUpperCase()}”`,
      workOrder: [
        'FIND THE CERTIFIED COMPONENT TRADER.',
        'PRESENT THE HABITAT FAULT RECORD.'
      ],
      target: [vendor.counter[0], vendor.counter[1], vendor.counter[2]],
      reach: 3.4,
      verb: 'Present the habitat fault',
      targetKind: 'issuer',
      vendorId: vendor.id
    };
  }

  const lock = spaceStationDockRoute(descriptor).lock;
  return {
    id: 'station:departure:stow-cell',
    markerLabel: 'KESTREL AIRLOCK · STOW THE CELL',
    workOrder: [
      'RETURN TO THE KESTREL.',
      '[F] STOW THE BONDED CELL AND DEPART.'
    ],
    target: lock,
    reach: 8,
    verb: 'Stow the bonded cell and depart',
    targetKind: 'airlock'
  };
}

/** Optional authored hooks. They can add texture, never receipts. */
export function stationVendorTopics(vendor: Vendor): readonly StationVendorTopic[] {
  if (vendor.designation === 'N-3651' || vendor.name === 'Esk') {
    return [
      {
        id: 'allowance',
        label: 'ASK WHAT AN ALLOWANCE IS',
        playerLine: 'what is an allowance?',
        reply: 'the right to make a thing you already know how to make.'
      },
      {
        id: 'sealed-volume',
        label: 'ASK ABOUT THE SEALED VOLUME',
        playerLine: 'what is in the sealed volume?',
        reply: 'nothing i am permitted to have an opinion about.'
      }
    ];
  }
  if (vendor.designation === 'S-7134' || vendor.name === 'Kite') {
    return [{
      id: 'water',
      label: 'ASK WHY WATER IS SOLD HERE',
      playerLine: 'why sell water here?',
      reply: 'cheap where it falls. dear where somebody has to carry it.'
    }];
  }
  if (vendor.designation === 'B-9259' || vendor.name === 'Salt') {
    return [{
      id: 'aged-lots',
      label: 'ASK ABOUT AGED LOTS',
      playerLine: 'what is an aged lot?',
      reply: 'it entered resettlement as one lot. it came back with more history than weight.'
    }];
  }
  return [];
}

export function stationStoryProbeSnapshot(): Record<string, unknown> {
  return {
    step: deriveStationStoryStep(),
    itemCount: getItemCount(BONDED_CELL_ITEM_ID),
    receipts: Object.fromEntries(
      Object.entries(STATION_STORY_MILESTONES).map(([key, id]) => [key, hasMilestone(id)])
    )
  };
}

function markIfAbsent(id: string): boolean {
  if (hasMilestone(id)) return false;
  markMilestone(id);
  return true;
}

function markOnce(id: string): StationStoryCommit {
  return { ok: true, changed: markIfAbsent(id) };
}

function refused(reason: string): StationStoryCommit {
  return { ok: false, changed: false, reason };
}
