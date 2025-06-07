import * as THREE from 'three';
import { WORLD_CONFIG, MATERIAL_TYPES, MATERIAL_PROPERTIES } from '../constants/world';

export class VoxelCollisionSystem {
  constructor() {
    this.solidVoxels = new Set(); // Store solid voxel positions as "x,y,z" strings
    this.playerAABB = new THREE.Box3(); // Player bounding box
    this.playerSize = new THREE.Vector3(0.6, 1.8, 0.6); // Player dimensions (width, height, depth)
  }

  /**
   * Register terrain data for a chunk by adding solid voxels to the collision set
   * @param {number} chunkX - Chunk X coordinate
   * @param {number} chunkZ - Chunk Z coordinate
   * @param {Array} voxelData - 3D array of voxel data
   */
  registerChunk(chunkX, chunkZ, voxelData) {
    // Clear existing voxels for this chunk
    this.clearChunk(chunkX, chunkZ);
    
    let solidCount = 0;
    const chunkWorldSize = WORLD_CONFIG.CHUNK_SIZE * WORLD_CONFIG.VOXEL_SIZE;
    const chunkWorldOffsetX = chunkX * chunkWorldSize;
    const chunkWorldOffsetZ = chunkZ * chunkWorldSize;
    
    // Add solid voxels to the collision set
    for (let x = 0; x < WORLD_CONFIG.CHUNK_SIZE; x++) {
      for (let z = 0; z < WORLD_CONFIG.CHUNK_SIZE; z++) {
        for (let y = 0; y < WORLD_CONFIG.CHUNK_HEIGHT; y++) {
          const materialType = voxelData[x][z][y];
          const materialProps = MATERIAL_PROPERTIES[materialType];
          
          if (materialProps && materialProps.collisionEnabled && materialProps.solid) {
            // Convert to world coordinates
            const worldX = Math.floor((x - WORLD_CONFIG.CHUNK_SIZE / 2) + chunkWorldOffsetX / WORLD_CONFIG.VOXEL_SIZE);
            const worldY = y;
            const worldZ = Math.floor((z - WORLD_CONFIG.CHUNK_SIZE / 2) + chunkWorldOffsetZ / WORLD_CONFIG.VOXEL_SIZE);
            
            const voxelKey = `${worldX},${worldY},${worldZ}`;
            this.solidVoxels.add(voxelKey);
            solidCount++;
          }
        }
      }
    }
    
    console.log(`Registered chunk (${chunkX},${chunkZ}) with ${solidCount} solid voxels`);
  }

  /**
   * Clear voxels for a specific chunk
   * @param {number} chunkX - Chunk X coordinate
   * @param {number} chunkZ - Chunk Z coordinate
   */
  clearChunk(chunkX, chunkZ) {
    const chunkWorldSize = WORLD_CONFIG.CHUNK_SIZE * WORLD_CONFIG.VOXEL_SIZE;
    const chunkWorldOffsetX = chunkX * chunkWorldSize;
    const chunkWorldOffsetZ = chunkZ * chunkWorldSize;
    
    // Remove all voxels in this chunk's area
    for (const voxelKey of this.solidVoxels) {
      const [x, y, z] = voxelKey.split(',').map(Number);
      const voxelChunkX = Math.floor(x * WORLD_CONFIG.VOXEL_SIZE / chunkWorldSize);
      const voxelChunkZ = Math.floor(z * WORLD_CONFIG.VOXEL_SIZE / chunkWorldSize);
      
      if (voxelChunkX === chunkX && voxelChunkZ === chunkZ) {
        this.solidVoxels.delete(voxelKey);
      }
    }
  }

  /**
   * Check if a voxel position is solid
   * @param {number} x - Voxel X coordinate
   * @param {number} y - Voxel Y coordinate  
   * @param {number} z - Voxel Z coordinate
   * @returns {boolean} - Whether the voxel is solid
   */
  isSolid(x, y, z) {
    const voxelKey = `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
    return this.solidVoxels.has(voxelKey);
  }

  /**
   * Get the ground height at a specific X,Z position using simple iteration
   * @param {number} x - X coordinate
   * @param {number} z - Z coordinate
   * @returns {number} - Ground height in world units
   */
  getGroundHeight(x, z) {
    const voxelX = Math.floor(x);
    const voxelZ = Math.floor(z);
    
    // Start from a reasonable height and work down
    for (let y = WORLD_CONFIG.CHUNK_HEIGHT - 1; y >= 0; y--) {
      if (this.isSolid(voxelX, y, voxelZ)) {
        return (y + 1) * WORLD_CONFIG.VOXEL_SIZE; // Return top of the solid voxel
      }
    }
    
    return 0; // Default ground level
  }

  /**
   * Create an AABB for a voxel at the given position
   * @param {number} x - Voxel X coordinate
   * @param {number} y - Voxel Y coordinate
   * @param {number} z - Voxel Z coordinate
   * @returns {THREE.Box3} - AABB for the voxel
   */
  getVoxelAABB(x, y, z) {
    const voxelSize = WORLD_CONFIG.VOXEL_SIZE;
    const min = new THREE.Vector3(x * voxelSize, y * voxelSize, z * voxelSize);
    const max = new THREE.Vector3((x + 1) * voxelSize, (y + 1) * voxelSize, (z + 1) * voxelSize);
    return new THREE.Box3(min, max);
  }

  /**
   * Update player AABB based on position
   * @param {THREE.Vector3} position - Player center position
   */
  updatePlayerAABB(position) {
    const halfSize = this.playerSize.clone().multiplyScalar(0.5);
    this.playerAABB.setFromCenterAndSize(position, this.playerSize);
  }

  /**
   * Check collision for player movement using AABB intersection
   * @param {THREE.Vector3} currentPosition - Current player position
   * @param {THREE.Vector3} targetPosition - Target player position
   * @param {THREE.Vector3} velocity - Current velocity
   * @returns {Object} - Collision result with corrected position and velocity
   */
  checkPlayerCollision(currentPosition, targetPosition, velocity) {
    const result = {
      position: targetPosition.clone(),
      velocity: velocity.clone(),
      onGround: false,
      hitWall: false,
      hitCeiling: false
    };

    // Create player AABB at target position
    this.updatePlayerAABB(targetPosition);
    
    // Get the range of voxels that could potentially collide with the player
    const min = this.playerAABB.min.clone().divideScalar(WORLD_CONFIG.VOXEL_SIZE).floor();
    const max = this.playerAABB.max.clone().divideScalar(WORLD_CONFIG.VOXEL_SIZE).floor();

    const collisions = [];

    // Check all voxels in the player's potential collision area
    for (let x = min.x; x <= max.x; x++) {
      for (let y = min.y; y <= max.y; y++) {
        for (let z = min.z; z <= max.z; z++) {
          if (this.isSolid(x, y, z)) {
            const voxelAABB = this.getVoxelAABB(x, y, z);
            if (this.playerAABB.intersectsBox(voxelAABB)) {
              collisions.push({ x, y, z, aabb: voxelAABB });
            }
          }
        }
      }
    }

    if (collisions.length === 0) {
      // No collisions, check for ground
      const groundHeight = this.getGroundHeight(targetPosition.x, targetPosition.z);
      const playerBottom = targetPosition.y - this.playerSize.y / 2;
      
      if (playerBottom <= groundHeight + 0.1) {
        result.position.y = groundHeight + this.playerSize.y / 2;
        result.onGround = true;
        if (result.velocity.y <= 0) {
          result.velocity.y = 0;
        }
      }
      
      return result;
    }

    // Handle collisions by adjusting position
    const correction = new THREE.Vector3();
    
    for (const collision of collisions) {
      const voxelAABB = collision.aabb;
      const overlap = new THREE.Box3();
      overlap.copy(this.playerAABB).intersect(voxelAABB);
      
      const overlapSize = overlap.getSize(new THREE.Vector3());
      
      // Find the axis with minimum penetration for easiest resolution
      if (overlapSize.x <= overlapSize.y && overlapSize.x <= overlapSize.z) {
        // Resolve X collision
        if (targetPosition.x > collision.x * WORLD_CONFIG.VOXEL_SIZE) {
          correction.x = Math.max(correction.x, overlapSize.x);
        } else {
          correction.x = Math.min(correction.x, -overlapSize.x);
        }
        result.hitWall = true;
      } else if (overlapSize.y <= overlapSize.z) {
        // Resolve Y collision
        if (targetPosition.y > collision.y * WORLD_CONFIG.VOXEL_SIZE) {
          correction.y = Math.max(correction.y, overlapSize.y);
          result.onGround = true;
          if (result.velocity.y <= 0) {
            result.velocity.y = 0;
          }
        } else {
          correction.y = Math.min(correction.y, -overlapSize.y);
          result.hitCeiling = true;
          if (result.velocity.y >= 0) {
            result.velocity.y = 0;
          }
        }
      } else {
        // Resolve Z collision
        if (targetPosition.z > collision.z * WORLD_CONFIG.VOXEL_SIZE) {
          correction.z = Math.max(correction.z, overlapSize.z);
        } else {
          correction.z = Math.min(correction.z, -overlapSize.z);
        }
        result.hitWall = true;
      }
    }

    // Apply correction
    result.position.add(correction);

    return result;
  }

  /**
   * Simple raycast using step-through method
   * @param {THREE.Vector3} origin - Ray origin
   * @param {THREE.Vector3} direction - Ray direction (normalized)
   * @param {number} maxDistance - Maximum ray distance
   * @returns {Object|null} - Hit result or null
   */
  raycast(origin, direction, maxDistance = 100) {
    const step = WORLD_CONFIG.VOXEL_SIZE * 0.5;
    const normalizedDirection = direction.clone().normalize();
    
    for (let distance = 0; distance < maxDistance; distance += step) {
      const checkPos = origin.clone().add(normalizedDirection.clone().multiplyScalar(distance));
      if (this.isSolid(checkPos.x, checkPos.y, checkPos.z)) {
        return {
          distance,
          position: checkPos,
          voxelPosition: new THREE.Vector3(
            Math.floor(checkPos.x),
            Math.floor(checkPos.y),
            Math.floor(checkPos.z)
          )
        };
      }
    }
    
    return null;
  }

  /**
   * Get total number of solid voxels (for debugging)
   * @returns {number} - Number of solid voxels
   */
  getSolidVoxelCount() {
    return this.solidVoxels.size;
  }
}

// Create a global instance
export const globalCollisionSystem = new VoxelCollisionSystem(); 