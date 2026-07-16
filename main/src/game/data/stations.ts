// --- Crafting stations -------------------------------------------------------
//
// A station is WHERE a recipe can be crafted. Recipes name a station; the player
// can only run a recipe whose station they currently have access to. The field
// kit permanently contributes `hand`; world objects and durable vehicle
// capabilities publish bounded runtime sources. Recipes and the crafting engine
// remain ignorant of how that access was earned.

import { ECONOMY_CATALOG } from './generatedEconomyCatalog.ts';

export type StationId = (typeof ECONOMY_CATALOG.stationIds)[number];

export interface StationDefinition {
  id: StationId;
  name: string;
  description: string;
}

export const STATIONS: Record<StationId, StationDefinition> = {
  hand: {
    id: 'hand', name: 'Field Kit',
    description: 'Basic on-the-spot fabrication with no station required.'
  },
  smelter: {
    id: 'smelter', name: 'Smelter',
    description: 'Reduces raw ore and grit into refined ingots, panes, and cells.'
  },
  assembler: {
    id: 'assembler', name: 'Assembler',
    description: 'Builds components, tools, suits, and modules from refined stock.'
  },
  survey_console: {
    id: 'survey_console', name: 'Survey Console',
    description: 'Tunes scanning optics — the home of Survey Lens upgrades.'
  }
};

export const ALL_STATION_IDS: StationId[] = [...ECONOMY_CATALOG.stationIds];
export const PORTABLE_DEMO_STATION_IDS: readonly StationId[] = ECONOMY_CATALOG.publicDemoStationIds;

const stationIds = new Set<StationId>(ALL_STATION_IDS);
const runtimeSources = new Map<string, readonly StationId[]>();
const accessListeners = new Set<() => void>();
let accessRevision = 0;

export function getStation(id: StationId): StationDefinition {
  return STATIONS[id];
}

/**
 * Current local station access. With no world source registered this is exactly
 * the hand-only field kit; active world/capability stations are unioned in catalog order.
 */
export function getAccessibleStations(): StationId[] {
  const accessible = new Set<StationId>(PORTABLE_DEMO_STATION_IDS);
  for (const source of runtimeSources.values()) {
    for (const station of source) accessible.add(station);
  }
  return ALL_STATION_IDS.filter(station => accessible.has(station));
}

/** Publish one world's or capability's currently usable stations. Empty access clears it. */
export function setStationAccessSource(sourceIdInput: string, stations: readonly StationId[]): void {
  const sourceId = sourceIdInput.trim();
  if (!sourceId) return;
  const next = ALL_STATION_IDS.filter(station => stationIds.has(station) && stations.includes(station));
  const current = runtimeSources.get(sourceId);
  if (next.length === 0) {
    clearStationAccessSource(sourceId);
    return;
  }
  if (current && current.length === next.length && current.every((station, index) => station === next[index])) return;
  runtimeSources.set(sourceId, next);
  emitStationAccessChanged();
}

export function clearStationAccessSource(sourceIdInput: string): void {
  const sourceId = sourceIdInput.trim();
  if (!sourceId || !runtimeSources.delete(sourceId)) return;
  emitStationAccessChanged();
}

export function subscribeStationAccess(listener: () => void): () => void {
  accessListeners.add(listener);
  return () => accessListeners.delete(listener);
}

/** Stable primitive snapshot for React.useSyncExternalStore. */
export function getStationAccessRevision(): number {
  return accessRevision;
}

/** Test/replay boundary; mounted world sources should normally clear themselves. */
export function resetStationAccessSources(): void {
  if (runtimeSources.size === 0) return;
  runtimeSources.clear();
  emitStationAccessChanged();
}

function emitStationAccessChanged(): void {
  accessRevision++;
  for (const listener of accessListeners) listener();
}
