export const CUBE_SIZE_X = 22; // Reduced from 20 - Size on X axis in voxels
export const CUBE_SIZE_Y = 22; // Reduced from 20 - Size on Y axis in voxels
export const CUBE_SIZE_Z = 22; // Reduced from 20 - Size on Z axis in voxels

/**
 * Creates a set of all voxel positions including the special center cube
 */
export function createVoxelPositionSet(): Set<string> {
  const voxelExists = new Set<string>();
  
  // Populate the set with all voxel positions
  for (let x = 0; x < CUBE_SIZE_X; x++) {
    for (let y = 0; y < CUBE_SIZE_Y; y++) {
      for (let z = 0; z < CUBE_SIZE_Z; z++) {
        voxelExists.add(`${x},${y},${z}`);
      }
    }
  }
  
  // Add the additional center cube position
  const centerX = Math.floor(CUBE_SIZE_X / 2);
  const centerZ = Math.floor(CUBE_SIZE_Z / 2);
  const topY = CUBE_SIZE_Y;
  voxelExists.add(`${centerX},${topY},${centerZ}`);
  
  return voxelExists;
}

/**
 * Checks if a voxel should be rendered (has at least one exposed face)
 */
export function isVoxelExposed(x: number, y: number, z: number, voxelExists: Set<string>): boolean {
  const neighbors = [
    [x + 1, y, z], // right
    [x - 1, y, z], // left
    [x, y + 1, z], // up
    [x, y - 1, z], // down
    [x, y, z + 1], // forward
    [x, y, z - 1], // backward
  ];
  
  // Check if any neighbor position is empty (no voxel instance)
  const isExposed = neighbors.some(([nx, ny, nz]) => {
    return !voxelExists.has(`${nx},${ny},${nz}`);
  });
  
  return isExposed;
}

/**
 * Calculates the world position offset to center the chunk at the world origin
 */
export function calculateWorldOffset(voxelSize: number): readonly [number, number, number] {
  return [
    -((CUBE_SIZE_X - 1) * voxelSize) / 2,
    -((CUBE_SIZE_Y - 1) * voxelSize) / 2,
    -((CUBE_SIZE_Z - 1) * voxelSize) / 2,
  ] as const;
}

/**
 * Converts voxel coordinates to world position
 */
export function voxelToWorldPosition(
  x: number, 
  y: number, 
  z: number, 
  voxelSize: number, 
  offset: readonly [number, number, number]
): [number, number, number] {
  return [
    x * voxelSize + offset[0],
    y * voxelSize + offset[1],
    z * voxelSize + offset[2],
  ];
}

/**
 * Gets the center cube coordinates
 */
export function getCenterCubeCoordinates(): { x: number, y: number, z: number } {
  return {
    x: Math.floor(CUBE_SIZE_X / 2),
    y: CUBE_SIZE_Y,
    z: Math.floor(CUBE_SIZE_Z / 2)
  };
} 