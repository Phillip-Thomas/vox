/**
 * Deterministic 32-bit voxel hash in [0, 1).
 *
 * Use Math.imul for every multiply so large 32-bit world seeds keep integer
 * entropy. Plain JS multiplication can exceed Number's exact integer range and
 * collapse nearby coordinates into visible stripes.
 */
export function seededVoxelUnit(
  x: number,
  y: number,
  z: number,
  salt: number,
  worldSeed = 0
): number {
  let hash =
    Math.imul(x | 0, 374761393) ^
    Math.imul(y | 0, 668265263) ^
    Math.imul(z | 0, 2147483647) ^
    Math.imul(salt | 0, 1013904223) ^
    Math.imul(worldSeed | 0, 1597334677);

  hash = Math.imul(hash ^ (hash >>> 15), 2246822519);
  hash = Math.imul(hash ^ (hash >>> 13), 3266489917);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 4294967296;
}
