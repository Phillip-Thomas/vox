import type { SpaceStationAddress } from './spaceStationTypes.ts';

/**
 * The spaceStation is a development surface, not shipped content.
 *
 * `?spacestation=1` opens it; `?spacestation=<x>,<y>,<index>` opens a specific one so a
 * seed can be reproduced from a URL. Nothing in the shipped build routes here, and
 * the module that renders it is dynamically imported behind this flag so it never
 * enters the demo bundle.
 */

const DEFAULT_ADDRESS: SpaceStationAddress = { system: { x: -19, y: -17 }, index: 0 };

const RAW = typeof window !== 'undefined'
  ? new URLSearchParams(window.location.search).get('spacestation')
  : null;

export function isSpaceStationSandbox(): boolean {
  return RAW !== null && RAW !== '' && RAW !== '0';
}

/**
 * `&hud=0` hides the diagnostic overlay so a capture shows only the scene. The
 * refinement loop leans on this constantly — judging a look through a debug panel
 * is how you end up shipping a debug panel.
 */
export function spaceStationHudVisible(): boolean {
  if (typeof window === 'undefined') return true;
  return new URLSearchParams(window.location.search).get('hud') !== '0';
}

/**
 * `&approach=1` starts you in a ship a few kilometres out instead of inside.
 *
 * Not the default, because every existing capture and probe drives the interior
 * directly and a mode switch that silently relocates the camera would invalidate
 * all of them. Opt in to fly the whole thing: approach, clearance, dock, walk out.
 */
export function spaceStationApproachEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const raw = new URLSearchParams(window.location.search).get('approach');
  return raw !== null && raw !== '' && raw !== '0';
}

/**
 * `?stations=force` guarantees the current system has an spaceStation.
 *
 * Roughly two systems in three have none, so without this, exploring for a station
 * begins with a search for a system that has one. The station it forces is the same
 * seeded station that system would have had if the roll had gone the other way.
 *
 * Note for anyone reasoning about where a station is: the **story** system at
 * (-1,-1) does have one, at 6,976 from the primary, so story-mode flights need no
 * flag. `?fly=1` on its own drops into an arbitrary non-story system, which is why
 * it usually looks like there is nothing out there.
 */
export function forcedSpaceStationCount(): number {
  if (typeof window === 'undefined') return 0;
  const raw = new URLSearchParams(window.location.search).get('stations');
  if (raw === null) return 0;
  if (raw === 'force' || raw === '1') return 1;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.min(4, Math.trunc(value)) : 0;
}

/**
 * `&ruler=1` parks a planet-sized sphere alongside the station.
 *
 * The station is 830 units long against a planet's 89-unit bound radius, and the
 * two are never within eight kilometres of each other, so no in-game view can
 * answer "is this the right size" by comparison. This puts the comparison in one
 * frame at one viewing distance, which is the only way to actually see it.
 */
export function spaceStationRulerVisible(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('ruler') === '1';
}

/**
 * `&dock=0` drops you straight onto the deck.
 *
 * Arriving is the default because arriving is the experience, but a capture run
 * and a twenty-second iteration loop both want the station, not the six seconds of
 * ceremony in front of it.
 */
export function spaceStationDockEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('dock') !== '0';
}

/** `&t=<seconds>` pins the crowd clock so captures are byte-comparable run to run. */
export function spaceStationFixedTime(): number | null {
  if (typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('t');
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/**
 * The address requested by the URL, or the default when the flag is bare.
 * Returns null when the sandbox is off, so callers cannot accidentally build one.
 */
export function requestedSpaceStationAddress(): SpaceStationAddress | null {
  if (!isSpaceStationSandbox()) return null;
  return parseSpaceStationFlag(RAW);
}

/** Exported for tests: the flag grammar without touching `window`. */
export function parseSpaceStationFlag(raw: string | null): SpaceStationAddress | null {
  if (raw === null || raw === '' || raw === '0') return null;
  if (raw === '1') return DEFAULT_ADDRESS;

  const parts = raw.split(',').map(part => part.trim());
  if (parts.length < 2 || parts.length > 3) return DEFAULT_ADDRESS;

  const x = Number(parts[0]);
  const y = Number(parts[1]);
  const index = parts.length === 3 ? Number(parts[2]) : 0;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(index)) return DEFAULT_ADDRESS;

  return { system: { x: Math.trunc(x), y: Math.trunc(y) }, index: Math.max(0, Math.trunc(index)) };
}

export { DEFAULT_ADDRESS as DEFAULT_SPACE_STATION_ADDRESS };
