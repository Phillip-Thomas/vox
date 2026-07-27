import {
  coordinateKey,
  fnv1a32,
  normalizeCoordinate,
  sameSystemCoordinate
} from '../../utils/worldCoordinates.ts';
import { MAX_SYSTEM_COORDINATE_ABS, type SystemCoordinate } from '../starSystem.ts';
import type { AnchorageAddress, AnchorageIdentity } from './anchorageTypes.ts';

/**
 * Anchorage identity is durable save data, so its seed namespace is frozen exactly
 * like the planet ones. Layout may evolve; the seed a given anchorage was built
 * from must not.
 */
export const ANCHORAGE_SEED_NAMESPACE = 'paravox:anchorage:v1';
export const ANCHORAGE_IDENTITY_VERSION = 1;

/**
 * World ids use an `:a<index>` suffix, deliberately disjoint from the planet
 * grammar (`:p1`, `:p2`) that `parsePlanetWorldId` and the state server's
 * `canonicalWorldId` both accept. A planet parser must reject an anchorage id
 * rather than silently coerce it.
 */
const ANCHORAGE_WORLD_ID_PATTERN = /^(-?\d+),(-?\d+):a(\d+)$/;

export function normalizeAnchorageAddress(address: AnchorageAddress): AnchorageAddress {
  return {
    system: normalizeCoordinate(address.system),
    index: Math.max(0, Math.trunc(address.index))
  };
}

export function anchorageWorldId(address: AnchorageAddress): string {
  const normalized = normalizeAnchorageAddress(address);
  return `${coordinateKey(normalized.system)}:a${normalized.index}`;
}

export function anchorageSeedForAddress(address: AnchorageAddress): number {
  const normalized = normalizeAnchorageAddress(address);
  const hash = fnv1a32(
    `${ANCHORAGE_SEED_NAMESPACE}:${normalized.system.x}:${normalized.system.y}:${normalized.index}`
  );
  return hash === 0 ? 1 : hash;
}

export function createAnchorageIdentity(address: AnchorageAddress): AnchorageIdentity {
  const normalized = normalizeAnchorageAddress(address);
  return {
    worldId: anchorageWorldId(normalized),
    seed: anchorageSeedForAddress(normalized),
    systemId: coordinateKey(normalized.system),
    address: normalized,
    anchorageIdentityVersion: ANCHORAGE_IDENTITY_VERSION
  };
}

export function parseAnchorageWorldId(worldId: string): AnchorageAddress | null {
  const match = ANCHORAGE_WORLD_ID_PATTERN.exec(worldId.trim());
  if (!match) return null;
  const x = Number(match[1]);
  const y = Number(match[2]);
  const index = Number(match[3]);
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || !Number.isSafeInteger(index)) return null;
  if (Math.abs(x) > MAX_SYSTEM_COORDINATE_ABS || Math.abs(y) > MAX_SYSTEM_COORDINATE_ABS) return null;
  return { system: { x, y }, index };
}

export function isAnchorageWorldId(worldId: string): boolean {
  return parseAnchorageWorldId(worldId) !== null;
}

export function sameAnchorageAddress(a: AnchorageAddress, b: AnchorageAddress): boolean {
  return a.index === b.index && sameSystemCoordinate(a.system, b.system);
}

export type { AnchorageAddress, AnchorageIdentity, SystemCoordinate };
