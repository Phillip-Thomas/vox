import {
  coordinateKey,
  fnv1a32,
  normalizeCoordinate,
  sameSystemCoordinate
} from '../../utils/worldCoordinates.ts';
import { MAX_SYSTEM_COORDINATE_ABS, type SystemCoordinate } from '../starSystem.ts';
import type { SpaceStationAddress, SpaceStationIdentity } from './spaceStationTypes.ts';

/**
 * SpaceStation identity is durable save data, so its seed namespace is frozen exactly
 * like the planet ones. Layout may evolve; the seed a given spaceStation was built
 * from must not.
 */
/*
  The STRING is frozen durable identity; only the constant's name was renamed.

  It still reads `anchorage` because that was the name when the namespace was
  minted, and the whole purpose of freezing a seed namespace is that it survives
  the concept being renamed. Changing this string re-rolls every space station's
  seed — a different layout, a different position, different vendors — which is a
  data migration wearing a rename's clothes. If a re-roll is ever wanted, mint
  `:v2` deliberately; do not tidy this.
*/
export const SPACE_STATION_SEED_NAMESPACE = 'paravox:anchorage:v1';
export const SPACE_STATION_IDENTITY_VERSION = 1;

/**
 * World ids use an `:a<index>` suffix, deliberately disjoint from the planet
 * grammar (`:p1`, `:p2`) that `parsePlanetWorldId` and the state server's
 * `canonicalWorldId` both accept. A planet parser must reject an spaceStation id
 * rather than silently coerce it.
 */
/*
  Frozen for the same reason as the seed namespace: this is durable identity, not
  a label. The `a` is historical — the concept was called an anchorage when the
  grammar was set — and it stays because any id already written down uses it. What
  matters is that it remains disjoint from the planet grammar (`:p1`, `:p2`), so a
  planet parser rejects a station id rather than silently coercing it.
*/
const SPACE_STATION_WORLD_ID_PATTERN = /^(-?\d+),(-?\d+):a(\d+)$/;

export function normalizeSpaceStationAddress(address: SpaceStationAddress): SpaceStationAddress {
  return {
    system: normalizeCoordinate(address.system),
    index: Math.max(0, Math.trunc(address.index))
  };
}

export function spaceStationWorldId(address: SpaceStationAddress): string {
  const normalized = normalizeSpaceStationAddress(address);
  return `${coordinateKey(normalized.system)}:a${normalized.index}`;
}

export function spaceStationSeedForAddress(address: SpaceStationAddress): number {
  const normalized = normalizeSpaceStationAddress(address);
  const hash = fnv1a32(
    `${SPACE_STATION_SEED_NAMESPACE}:${normalized.system.x}:${normalized.system.y}:${normalized.index}`
  );
  return hash === 0 ? 1 : hash;
}

export function createSpaceStationIdentity(address: SpaceStationAddress): SpaceStationIdentity {
  const normalized = normalizeSpaceStationAddress(address);
  return {
    worldId: spaceStationWorldId(normalized),
    seed: spaceStationSeedForAddress(normalized),
    systemId: coordinateKey(normalized.system),
    address: normalized,
    spaceStationIdentityVersion: SPACE_STATION_IDENTITY_VERSION
  };
}

export function parseSpaceStationWorldId(worldId: string): SpaceStationAddress | null {
  const match = SPACE_STATION_WORLD_ID_PATTERN.exec(worldId.trim());
  if (!match) return null;
  const x = Number(match[1]);
  const y = Number(match[2]);
  const index = Number(match[3]);
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || !Number.isSafeInteger(index)) return null;
  if (Math.abs(x) > MAX_SYSTEM_COORDINATE_ABS || Math.abs(y) > MAX_SYSTEM_COORDINATE_ABS) return null;
  return { system: { x, y }, index };
}

export function isSpaceStationWorldId(worldId: string): boolean {
  return parseSpaceStationWorldId(worldId) !== null;
}

export function sameSpaceStationAddress(a: SpaceStationAddress, b: SpaceStationAddress): boolean {
  return a.index === b.index && sameSystemCoordinate(a.system, b.system);
}

export type { SpaceStationAddress, SpaceStationIdentity, SystemCoordinate };
