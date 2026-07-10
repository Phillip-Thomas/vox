import { useSyncExternalStore } from 'react';

// --- The survey chart (map view) ------------------------------------------------------
//
// [M] swaps the live camera to a straight-down overhead of the current face —
// the top-down NAV VIEW from the story's ch1-nav era, retained as a tool. Not a
// minimap texture: the REAL world, rendered from above (the map IS the
// territory here, which the Authority would hate). Story saves unlock it by
// completing the nav rung; pure sandbox saves always have it.

let open = false;
const listeners = new Set<() => void>();

export function isMapViewOpen(): boolean {
  return open;
}

export function setMapViewOpen(next: boolean): void {
  if (open === next) return;
  open = next;
  for (const listener of listeners) listener();
}

export function toggleMapView(): void {
  setMapViewOpen(!open);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): boolean {
  return open;
}

export function useMapViewOpen(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Camera height of the chart view (world units above the player). */
export const MAP_VIEW_HEIGHT = 46;
