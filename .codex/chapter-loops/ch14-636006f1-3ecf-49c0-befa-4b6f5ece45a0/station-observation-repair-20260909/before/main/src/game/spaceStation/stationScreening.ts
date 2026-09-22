// --- The station screening flag ------------------------------------------------------
//
// Docking is a hard page navigation: `enterSpaceStation` assigns
// `?spacestation=…` and deliberately strips `story`, `movie`, `journeyprobe` and
// the rest of the story query first. That stripping is CORRECT and must stay —
// carrying `?story=ch10-transit` across the seam makes `initStoryFromSave` read
// it as a fresh rehearsal and erase the completion and docking receipts the
// player just crossed the seam with.
//
// But it also ended the screening at the airlock. The movie flew the whole
// claimed bearing, docked, and then the page reloaded into an ordinary station
// visit with nobody driving.
//
// So the screening gets its OWN flag rather than a reprieve for `movie`. It
// carries one fact — "a screening is in progress" — and it is not part of the
// story query, so it cannot be mistaken for a rehearsal instruction by anything
// that reads `?story=`. The station side reads it to decide whether to drive
// itself; nothing else may key behaviour off it.

export const STATION_SCREENING_PARAM = 'stationmovie';

function search(): URLSearchParams | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search);
}

/** True when this page load is the continuation of a movie run. */
export function isStationScreening(): boolean {
  return search()?.get(STATION_SCREENING_PARAM) === '1';
}

/**
 * Add the screening flag to the params a dock navigation is about to assign.
 * Called only when the departing page was itself a screening.
 */
export function markStationScreening(params: URLSearchParams): void {
  params.set(STATION_SCREENING_PARAM, '1');
}
