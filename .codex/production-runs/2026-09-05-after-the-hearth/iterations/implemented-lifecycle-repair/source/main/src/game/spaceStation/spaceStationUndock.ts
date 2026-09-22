import { spaceStationBody } from './spaceStationBody.ts';
import { parseSpaceStationWorldId } from './spaceStationAddress.ts';
import type { SpaceStationAddress } from './spaceStationTypes.ts';
import type { SystemShipPose } from '../../state/systemFlight.ts';

/**
 * Coming back out of a station.
 *
 * The trip in and the trip out are page navigations, because the station interior
 * and system space cannot share a depth buffer. That makes the return a state
 * reconstruction problem: the ship's position was lost with the previous page, and
 * the only thing carried across is which station was left.
 *
 * Which turns out to be enough. The berth is derived from the station's address,
 * and the ship was clamped to the berth — so the pose it should reappear at is
 * computable rather than something that had to be stored. Nothing is persisted, so
 * nothing can go stale, and a hand-written URL produces a correct arrival rather
 * than a ship in the wrong place.
 */

/** `?undock=<x>,<y>,<index>` — the station the player has just left. */
export function parseUndockFlag(raw: string | null): SpaceStationAddress | null {
  if (!raw) return null;

  // Accept a full world id too, since that is what everything else in the game
  // passes around and guessing which grammar a caller used is a bug farm.
  const asWorldId = parseSpaceStationWorldId(raw);
  if (asWorldId) return asWorldId;

  const parts = raw.split(',').map(part => part.trim());
  if (parts.length !== 3) return null;
  const x = Number(parts[0]);
  const y = Number(parts[1]);
  const index = Number(parts[2]);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(index)) return null;
  return { system: { x: Math.trunc(x), y: Math.trunc(y) }, index: Math.max(0, Math.trunc(index)) };
}

export function requestedUndockAddress(search: string = typeof window === 'undefined' ? '' : window.location.search): SpaceStationAddress | null {
  return parseUndockFlag(new URLSearchParams(search).get('undock'));
}

/**
 * The berth handoff is an event, not durable location state. Once App has used
 * it to reconstruct the ship, remove both halves of the debug-style deep link;
 * otherwise any later reload replays undocking and teleports a returning player
 * away from Tidegarden back to the station.
 */
export function searchAfterUndockConsumed(search: string): string {
  const params = new URLSearchParams(search);
  if (!parseUndockFlag(params.get('undock'))) return search;
  params.delete('undock');
  if (params.get('fly') === '1') params.delete('fly');
  const next = params.toString();
  return next ? `?${next}` : '';
}

/**
 * Where the ship is, the instant after it lets go.
 *
 * Sitting at the berth, at rest, nose still pointed back down the corridor at the
 * station. Facing outward would be tidier to fly but wrong to look at: a ship that
 * pushes back from a dock is looking at the dock, and turning away is the player's
 * first act rather than something that happened to them.
 */
export function undockedShipPose(address: SpaceStationAddress): SystemShipPose {
  const body = spaceStationBody(address);
  return {
    position: [body.berth[0], body.berth[1], body.berth[2]],
    velocity: [0, 0, 0],
    quaternion: quaternionLookingAlong(body.approachAxis)
  };
}

/**
 * A quaternion whose forward (-Z) points along `direction`.
 *
 * Written out rather than borrowed from three so this module stays pure — it is
 * consumed by the flight store, which has no business importing a renderer.
 */
function quaternionLookingAlong(
  direction: readonly [number, number, number]
): [number, number, number, number] {
  const forward = normalize(direction);
  // Rotation taking -Z onto `forward`.
  const from: [number, number, number] = [0, 0, -1];
  const dot = from[0] * forward[0] + from[1] * forward[1] + from[2] * forward[2];
  if (dot > 0.999999) return [0, 0, 0, 1];
  if (dot < -0.999999) return [0, 1, 0, 0];
  const axis: [number, number, number] = [
    from[1] * forward[2] - from[2] * forward[1],
    from[2] * forward[0] - from[0] * forward[2],
    from[0] * forward[1] - from[1] * forward[0]
  ];
  const quaternion: [number, number, number, number] = [axis[0], axis[1], axis[2], 1 + dot];
  const length = Math.hypot(...quaternion) || 1;
  return [
    quaternion[0] / length,
    quaternion[1] / length,
    quaternion[2] / length,
    quaternion[3] / length
  ];
}

function normalize(v: readonly [number, number, number]): [number, number, number] {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}
