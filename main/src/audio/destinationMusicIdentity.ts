import {
  buildPlanetProfile,
  resolvePlanetProfile
} from '../game/PlanetProfile.ts';
import {
  parsePlanetWorldId,
  planetSeedForAddress
} from '../game/starSystem.ts';
import type { SystemFlightTarget } from '../state/systemFlight.ts';
import {
  coordinateToSeed,
  type WorldCoordinate
} from '../utils/worldCoordinates.ts';

/** Canonical destination facts shared by score, bed modulation, and evidence. */
export interface DestinationMusicIdentity {
  worldId: string | null;
  seed: number;
  profileId: string;
  profileVersion: number;
  profileHash: string;
  archetype: string;
}

/**
 * Resolve a same-system body through its canonical world identity. The system
 * coordinate is deliberately insufficient: sibling planets share it.
 */
export function resolveSystemBodyMusicIdentity(
  target: SystemFlightTarget | null
): DestinationMusicIdentity | null {
  if (target?.kind !== 'system_body') return null;
  const address = parsePlanetWorldId(target.worldId);
  if (!address) return null;
  const seed = planetSeedForAddress(address) >>> 0;
  const resolved = resolvePlanetProfile({ worldId: target.worldId, seed });
  return {
    worldId: target.worldId,
    seed,
    profileId: resolved.profileId,
    profileVersion: resolved.profileVersion,
    profileHash: resolved.profileHash,
    archetype: resolved.profile.archetype
  };
}

/** Preserve the established procedural identity for interstellar coordinate travel. */
export function resolveCoordinateMusicIdentity(
  coordinate: WorldCoordinate
): DestinationMusicIdentity {
  const seed = coordinateToSeed(coordinate.x, coordinate.y) >>> 0;
  const profile = buildPlanetProfile(seed);
  const resolved = resolvePlanetProfile({ seed });
  return {
    worldId: null,
    seed,
    profileId: resolved.profileId,
    profileVersion: resolved.profileVersion,
    profileHash: resolved.profileHash,
    archetype: profile.archetype
  };
}
