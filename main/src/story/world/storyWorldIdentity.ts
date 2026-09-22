import { archetypeForSeed } from '../../game/data/planetArchetypes.ts';
import { coordinateToSeed, type WorldCoordinate } from '../../utils/worldCoordinates.ts';

// --- The story world ------------------------------------------------------------
//
// Story mode plays on ONE pinned planet so every prop pose, quota resource, and
// scripted vantage is deterministic and art-directable. Verdant specifically:
// trees, grass, biofiber, loose stone, no hazards — everything Ch1's quota and
// Ch3's campfire need — and the hero apple tree reads against a green world.
//
// The coordinate is found by a deterministic outward ring scan (not a seeded rng)
// so the pin survives rng-implementation changes; asserted in storyWorld.test.ts.

function findStoryCoordinate(): WorldCoordinate {
  for (let radius = 1; radius <= 100; radius++) {
    for (let x = -radius; x <= radius; x++) {
      for (const y of x === -radius || x === radius
        ? rangeInclusive(-radius, radius)
        : [-radius, radius]) {
        if (archetypeForSeed(coordinateToSeed(x, y)) === 'verdant') return { x, y };
      }
    }
  }
  return { x: 0, y: 0 };
}

function rangeInclusive(a: number, b: number): number[] {
  const out: number[] = [];
  for (let v = a; v <= b; v++) out.push(v);
  return out;
}

export const STORY_COORDINATE: WorldCoordinate = findStoryCoordinate();

export const STORY_SEED = coordinateToSeed(STORY_COORDINATE.x, STORY_COORDINATE.y);

// Story geometry is authored against the canonical primary planet, never a
// second seed-only generator. Keeping the identity local avoids a dependency
// cycle through tidegardenRoute (which imports STORY_COORDINATE from here).
export const STORY_PRIMARY_WORLD_ID = `${STORY_COORDINATE.x},${STORY_COORDINATE.y}`;

export function isStoryWorld(coordinate: WorldCoordinate): boolean {
  return coordinate.x === STORY_COORDINATE.x && coordinate.y === STORY_COORDINATE.y;
}

export function isStoryWorldSeed(seed: number): boolean {
  return seed === STORY_SEED;
}

