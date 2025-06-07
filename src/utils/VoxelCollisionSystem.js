import * as THREE from 'three';
import { WORLD_CONFIG, MATERIAL_TYPES, MATERIAL_PROPERTIES } from '../constants/world';

export class VoxelCollisionSystem {
  constructor() {
    // Spatial hash for O(1) voxel lookups
    this.spatialHash = new Map();
    this.hashCellSize = WORLD_CONFIG.VOXEL_SIZE;
    
    // Player collision data with new body configuration
    this.playerAABB = new THREE.Box3();
    this.playerSize = new THREE.Vector3(
      WORLD_CONFIG.PLAYER_BODY.WIDTH,
      WORLD_CONFIG.PLAYER_BODY.HEIGHT,
      WORLD_CONFIG.PLAYER_BODY.DEPTH
    );
    this.lastPlayerPosition = new THREE.Vector3();
    this.playerBodyCenter = new THREE.Vector3(); // Track body center separately from camera
    
    // Performance optimization caches
    this.collisionCache = new Map();
    this.groundHeightCache = new Map();
    this.cacheFrameLife = 60; // Cache expires after 60 frames
    this.currentFrame = 0;
    
    // Predictive collision system - increased for larger body
    this.velocityInfluenceRadius = 3; // Increased for larger collision body
    this.activeCollisionRegion = new THREE.Box3();
    
    // Frame-based update system
    this.updateCallback = null;
    this.isRunning = false;
    this.lastUpdateTime = 0;
    this.updateFrequency = 16; // ~60fps
    
    // Statistics for debugging
    this.stats = {
      totalVoxels: 0,
      checksPerFrame: 0,
      cacheHits: 0,
      cacheMisses: 0,
      penetrationResolutions: 0
    };
  }

  /**
   * Start the frame-based collision system
   * @param {Function} updateCallback - Called each frame with collision results
   */
  startFrameUpdates(updateCallback) {
    this.updateCallback = updateCallback;
    this.isRunning = true;
    this.frameUpdate();
  }

  /**
   * Stop frame-based updates
   */
  stopFrameUpdates() {
    this.isRunning = false;
    this.updateCallback = null;
  }

  /**
   * Main frame update loop - called every animation frame
   */
  frameUpdate() {
    if (!this.isRunning) return;
    
    const now = performance.now();
    if (now - this.lastUpdateTime >= this.updateFrequency) {
      this.currentFrame++;
      this.cleanupCaches();
      
      // Auto-optimize performance every 5 seconds (300 frames at 60fps)
      if (this.currentFrame % 300 === 0) {
        this.optimizePerformance();
      }
      
      this.lastUpdateTime = now;
    }
    
    if (this.isRunning) {
      requestAnimationFrame(() => this.frameUpdate());
    }
  }

  /**
   * Spatial hash key generation for O(1) lookups
   */
  getHashKey(x, y, z) {
    const hashX = Math.floor(x / this.hashCellSize);
    const hashY = Math.floor(y / this.hashCellSize);
    const hashZ = Math.floor(z / this.hashCellSize);
    return `${hashX}:${hashY}:${hashZ}`;
  }

  /**
   * Register terrain data using spatial hashing for ultra-fast lookups
   */
  registerChunk(chunkX, chunkZ, voxelData) {
    this.clearChunk(chunkX, chunkZ);
    
    let solidCount = 0;
    const chunkWorldSize = WORLD_CONFIG.CHUNK_SIZE * WORLD_CONFIG.VOXEL_SIZE;
    const chunkWorldOffsetX = chunkX * chunkWorldSize;
    const chunkWorldOffsetZ = chunkZ * chunkWorldSize;
    
    // Build spatial hash
    for (let x = 0; x < WORLD_CONFIG.CHUNK_SIZE; x++) {
      for (let z = 0; z < WORLD_CONFIG.CHUNK_SIZE; z++) {
        for (let y = 0; y < WORLD_CONFIG.CHUNK_HEIGHT; y++) {
          const materialType = voxelData[x][z][y];
          const materialProps = MATERIAL_PROPERTIES[materialType];
          
          if (materialProps && materialProps.collisionEnabled && materialProps.solid) {
            const worldX = Math.floor((x - WORLD_CONFIG.CHUNK_SIZE / 2) + chunkWorldOffsetX / WORLD_CONFIG.VOXEL_SIZE);
            const worldY = y;
            const worldZ = Math.floor((z - WORLD_CONFIG.CHUNK_SIZE / 2) + chunkWorldOffsetZ / WORLD_CONFIG.VOXEL_SIZE);
            
            const hashKey = this.getHashKey(worldX, worldY, worldZ);
            
            if (!this.spatialHash.has(hashKey)) {
              this.spatialHash.set(hashKey, new Set());
            }
            
            this.spatialHash.get(hashKey).add(`${worldX},${worldY},${worldZ}`);
            solidCount++;
          }
        }
      }
    }
    
    this.stats.totalVoxels += solidCount;

  }

  /**
   * Clear chunk data from spatial hash
   */
  clearChunk(chunkX, chunkZ) {
    const chunkWorldSize = WORLD_CONFIG.CHUNK_SIZE * WORLD_CONFIG.VOXEL_SIZE;
    const chunkWorldOffsetX = chunkX * chunkWorldSize;
    const chunkWorldOffsetZ = chunkZ * chunkWorldSize;
    
    // Clear spatial hash entries for this chunk
    for (const [hashKey, voxelSet] of this.spatialHash.entries()) {
      const voxelsToRemove = [];
      
      for (const voxelKey of voxelSet) {
        const [x, y, z] = voxelKey.split(',').map(Number);
        const voxelChunkX = Math.floor(x * WORLD_CONFIG.VOXEL_SIZE / chunkWorldSize);
        const voxelChunkZ = Math.floor(z * WORLD_CONFIG.VOXEL_SIZE / chunkWorldSize);
        
        if (voxelChunkX === chunkX && voxelChunkZ === chunkZ) {
          voxelsToRemove.push(voxelKey);
        }
      }
      
      voxelsToRemove.forEach(voxelKey => {
        voxelSet.delete(voxelKey);
        this.stats.totalVoxels--;
      });
      
      // Remove empty hash buckets
      if (voxelSet.size === 0) {
        this.spatialHash.delete(hashKey);
      }
    }
  }

  /**
   * Ultra-fast voxel solid check using spatial hash
   */
  isSolid(x, y, z) {
    const hashKey = this.getHashKey(x, y, z);
    const voxelSet = this.spatialHash.get(hashKey);
    
    if (!voxelSet) return false;
    
    const voxelKey = `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
    return voxelSet.has(voxelKey);
  }

  /**
   * Cached ground height calculation with spatial optimization
   */
  getGroundHeight(x, z) {
    const cacheKey = `${Math.floor(x)},${Math.floor(z)}`;
    const cached = this.groundHeightCache.get(cacheKey);
    
    if (cached && this.currentFrame - cached.frame < this.cacheFrameLife) {
      this.stats.cacheHits++;
      return cached.height;
    }
    
    this.stats.cacheMisses++;
    
    // Use spatial hash to find ground more efficiently
    const voxelX = Math.floor(x);
    const voxelZ = Math.floor(z);
    
    // Start from reasonable height and work down, but use spatial hash
    for (let y = WORLD_CONFIG.CHUNK_HEIGHT - 1; y >= 0; y--) {
      if (this.isSolid(voxelX, y, voxelZ)) {
        const height = (y + 1) * WORLD_CONFIG.VOXEL_SIZE;
        this.groundHeightCache.set(cacheKey, { height, frame: this.currentFrame });
        return height;
      }
    }
    
    const height = 0;
    this.groundHeightCache.set(cacheKey, { height, frame: this.currentFrame });
    return height;
  }

  /**
   * Predictive collision detection - checks where player will be based on velocity
   */
  getPredictiveCollisionRegion(position, velocity) {
    const influence = this.velocityInfluenceRadius;
    const velocityMagnitude = velocity.length();
    const predictiveDistance = Math.max(1, velocityMagnitude * 0.1); // Look ahead based on speed
    
    const expansion = new THREE.Vector3(
      influence + Math.abs(velocity.x) * predictiveDistance,
      influence + Math.abs(velocity.y) * predictiveDistance,
      influence + Math.abs(velocity.z) * predictiveDistance
    );
    
    const halfPlayerSize = this.playerSize.clone().multiplyScalar(0.5);
    const min = position.clone().sub(halfPlayerSize).sub(expansion);
    const max = position.clone().add(halfPlayerSize).add(expansion);
    
    return new THREE.Box3(min, max);
  }

  /**
   * Enhanced hierarchical collision detection with body-centered approach
   */
  checkPlayerCollision(currentCameraPosition, targetCameraPosition, velocity) {
    this.stats.checksPerFrame = 0;
    
    // Convert camera positions to body center positions
    const currentBodyCenter = this.getCameraToBodyCenter(currentCameraPosition);
    const targetBodyCenter = this.getCameraToBodyCenter(targetCameraPosition);
    
    // Update player AABB based on body center
    this.updatePlayerAABB(targetBodyCenter);
    this.playerBodyCenter.copy(targetBodyCenter);
    
    // BROAD PHASE: Get predictive collision region
    const collisionRegion = this.getPredictiveCollisionRegion(targetBodyCenter, velocity);
    this.activeCollisionRegion.copy(collisionRegion);
    
    // Get hash keys for the collision region (spatial partitioning)
    const minHash = new THREE.Vector3(
      Math.floor(collisionRegion.min.x / this.hashCellSize),
      Math.floor(collisionRegion.min.y / this.hashCellSize),
      Math.floor(collisionRegion.min.z / this.hashCellSize)
    );
    
    const maxHash = new THREE.Vector3(
      Math.floor(collisionRegion.max.x / this.hashCellSize),
      Math.floor(collisionRegion.max.y / this.hashCellSize),
      Math.floor(collisionRegion.max.z / this.hashCellSize)
    );

    const potentialCollisions = new Set();
    
    // Collect all potential collision voxels using spatial hash
    for (let hashX = minHash.x; hashX <= maxHash.x; hashX++) {
      for (let hashY = minHash.y; hashY <= maxHash.y; hashY++) {
        for (let hashZ = minHash.z; hashZ <= maxHash.z; hashZ++) {
          const hashKey = `${hashX}:${hashY}:${hashZ}`;
          const voxelSet = this.spatialHash.get(hashKey);
          
          if (voxelSet) {
            voxelSet.forEach(voxelKey => potentialCollisions.add(voxelKey));
          }
        }
      }
    }

    // NARROW PHASE: Check actual AABB intersections
    const actualCollisions = [];
    
    for (const voxelKey of potentialCollisions) {
      const [x, y, z] = voxelKey.split(',').map(Number);
      const voxelAABB = this.getVoxelAABB(x, y, z);
      
      if (this.playerAABB.intersectsBox(voxelAABB)) {
        actualCollisions.push({ x, y, z, aabb: voxelAABB });
        this.stats.checksPerFrame++;
      }
    }

    // Handle collisions
    let collisionResult;
    
    if (actualCollisions.length === 0) {
      // No collisions, check for ground with caching
      const groundHeight = this.getGroundHeight(targetBodyCenter.x, targetBodyCenter.z);
      const playerBottom = targetBodyCenter.y - this.playerSize.y / 2;
      
      collisionResult = {
        position: targetBodyCenter.clone(),
        velocity: velocity.clone(),
        onGround: false,
        hitWall: false,
        hitCeiling: false,
        penetrationResolved: false
      };
      
      if (playerBottom <= groundHeight + 0.1) {
        collisionResult.position.y = groundHeight + this.playerSize.y / 2;
        collisionResult.onGround = true;
        if (collisionResult.velocity.y <= 0) {
          collisionResult.velocity.y = 0;
        }
      }
    } else {
      // Use enhanced collision resolution
      collisionResult = this.resolveCollisionsEnhanced(actualCollisions, targetBodyCenter, velocity);
    }

    // Convert result back to camera position
    const resultCameraPosition = this.getBodyCenterToCamera(collisionResult.position);
    this.lastPlayerPosition.copy(collisionResult.position);
    
    return {
      position: resultCameraPosition,
      velocity: collisionResult.velocity,
      onGround: collisionResult.onGround,
      hitWall: collisionResult.hitWall,
      hitCeiling: collisionResult.hitCeiling,
      penetrationResolved: collisionResult.penetrationResolved,
      bodyCenter: collisionResult.position // Include body center for debugging
    };
  }

  /**
   * Update player AABB
   */
  updatePlayerAABB(position) {
    this.playerAABB.setFromCenterAndSize(position, this.playerSize);
  }

  /**
   * Get voxel AABB
   */
  getVoxelAABB(x, y, z) {
    const voxelSize = WORLD_CONFIG.VOXEL_SIZE;
    const min = new THREE.Vector3(x * voxelSize, y * voxelSize, z * voxelSize);
    const max = new THREE.Vector3((x + 1) * voxelSize, (y + 1) * voxelSize, (z + 1) * voxelSize);
    return new THREE.Box3(min, max);
  }

  /**
   * Optimized raycast using spatial hash
   */
  raycast(origin, direction, maxDistance = 100) {
    const step = WORLD_CONFIG.VOXEL_SIZE * 0.25; // Smaller steps for accuracy
    const normalizedDirection = direction.clone().normalize();
    
    for (let distance = 0; distance < maxDistance; distance += step) {
      const checkPos = origin.clone().add(normalizedDirection.clone().multiplyScalar(distance));
      
      // Use spatial hash for faster lookup
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
   * Clean up expired cache entries
   */
  cleanupCaches() {
    // Clean collision cache
    for (const [key, entry] of this.collisionCache.entries()) {
      if (this.currentFrame - entry.frame > this.cacheFrameLife) {
        this.collisionCache.delete(key);
      }
    }
    
    // Clean ground height cache
    for (const [key, entry] of this.groundHeightCache.entries()) {
      if (this.currentFrame - entry.frame > this.cacheFrameLife) {
        this.groundHeightCache.delete(key);
      }
    }
  }

  /**
   * Get performance statistics
   */
  getStats() {
    return {
      ...this.stats,
      spatialHashBuckets: this.spatialHash.size,
      collisionCacheSize: this.collisionCache.size,
      groundCacheSize: this.groundHeightCache.size,
      cacheHitRatio: this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses) || 0,
      playerBodySize: `${this.playerSize.x}×${this.playerSize.y}×${this.playerSize.z}`
    };
  }

  /**
   * Dynamic performance optimization - adjusts system parameters based on performance
   */
  optimizePerformance() {
    const stats = this.getStats();
    
    // Adjust cache lifetime based on cache hit ratio
    if (stats.cacheHitRatio < 0.7) {
      // Low cache hit ratio - increase cache lifetime
      this.cacheFrameLife = Math.min(120, this.cacheFrameLife + 10);
    } else if (stats.cacheHitRatio > 0.9) {
      // High cache hit ratio - can reduce cache lifetime to save memory
      this.cacheFrameLife = Math.max(30, this.cacheFrameLife - 5);
    }
    
    // Adjust velocity influence radius based on collision checks per frame
    if (stats.checksPerFrame > 50) {
      // Too many checks - reduce prediction radius
      this.velocityInfluenceRadius = Math.max(1, this.velocityInfluenceRadius - 0.1);
    } else if (stats.checksPerFrame < 10) {
      // Very few checks - can increase prediction for better collision detection
      this.velocityInfluenceRadius = Math.min(3, this.velocityInfluenceRadius + 0.1);
    }
    
    // Reset per-frame stats
    this.stats.checksPerFrame = 0;
  }

  /**
   * Advanced raycast with spatial hash optimization and early termination
   */
  raycastAdvanced(origin, direction, maxDistance = 100, options = {}) {
    const { 
      stepSize = WORLD_CONFIG.VOXEL_SIZE * 0.25,
      earlyTermination = true,
      returnAllHits = false 
    } = options;
    
    const normalizedDirection = direction.clone().normalize();
    const hits = [];
    let firstHit = null;
    
    for (let distance = 0; distance < maxDistance; distance += stepSize) {
      const checkPos = origin.clone().add(normalizedDirection.clone().multiplyScalar(distance));
      
      // Use spatial hash for faster lookup
      if (this.isSolid(checkPos.x, checkPos.y, checkPos.z)) {
        const hit = {
          distance,
          position: checkPos.clone(),
          voxelPosition: new THREE.Vector3(
            Math.floor(checkPos.x),
            Math.floor(checkPos.y),
            Math.floor(checkPos.z)
          )
        };
        
        if (!firstHit) firstHit = hit;
        
        if (returnAllHits) {
          hits.push(hit);
        }
        
        if (earlyTermination && !returnAllHits) {
          return firstHit;
        }
      }
    }
    
    return returnAllHits ? hits : firstHit;
  }

  /**
   * Batch collision check for multiple entities (future expansion)
   */
  batchCollisionCheck(entities) {
    const results = new Map();
    
    // Group entities by spatial regions for efficient processing
    const spatialGroups = new Map();
    
    entities.forEach(entity => {
      const hashKey = this.getHashKey(entity.position.x, entity.position.y, entity.position.z);
      if (!spatialGroups.has(hashKey)) {
        spatialGroups.set(hashKey, []);
      }
      spatialGroups.get(hashKey).push(entity);
    });
    
    // Process each spatial group
    spatialGroups.forEach(entityGroup => {
      entityGroup.forEach(entity => {
        const result = this.checkPlayerCollision(entity.currentPosition, entity.targetPosition, entity.velocity);
        results.set(entity.id, result);
      });
    });
    
    return results;
  }

  /**
   * Get total number of solid voxels
   */
  getSolidVoxelCount() {
    return this.stats.totalVoxels;
  }

  /**
   * Convert camera position to player body center position
   * @param {THREE.Vector3} cameraPosition - Camera position
   * @returns {THREE.Vector3} - Body center position
   */
  getCameraToBodyCenter(cameraPosition) {
    const offset = WORLD_CONFIG.PLAYER_BODY.CAMERA_OFFSET;
    return new THREE.Vector3(
      cameraPosition.x - offset.x,
      cameraPosition.y - offset.y,
      cameraPosition.z - offset.z
    );
  }

  /**
   * Convert player body center position to camera position
   * @param {THREE.Vector3} bodyCenterPosition - Body center position
   * @returns {THREE.Vector3} - Camera position
   */
  getBodyCenterToCamera(bodyCenterPosition) {
    const offset = WORLD_CONFIG.PLAYER_BODY.CAMERA_OFFSET;
    return new THREE.Vector3(
      bodyCenterPosition.x + offset.x,
      bodyCenterPosition.y + offset.y,
      bodyCenterPosition.z + offset.z
    );
  }

  /**
   * Enhanced collision resolution with robust penetration prevention
   * @param {Array} collisions - Array of collision objects
   * @param {THREE.Vector3} targetBodyCenter - Target body center position
   * @param {THREE.Vector3} velocity - Current velocity
   * @returns {Object} - Enhanced collision result
   */
  resolveCollisionsEnhanced(collisions, targetBodyCenter, velocity) {
    const result = {
      position: targetBodyCenter.clone(),
      velocity: velocity.clone(),
      onGround: false,
      hitWall: false,
      hitCeiling: false,
      penetrationResolved: false
    };

    if (collisions.length === 0) return result;

    const resolutionStrength = WORLD_CONFIG.PLAYER_BODY.PENETRATION_RESOLUTION;
    const damping = WORLD_CONFIG.PLAYER_BODY.VELOCITY_DAMPING;
    
    // Separate collisions by axis to handle them independently
    const xCollisions = [];
    const yCollisions = [];
    const zCollisions = [];

    for (const collision of collisions) {
      const voxelAABB = collision.aabb;
      const overlap = new THREE.Box3().copy(this.playerAABB).intersect(voxelAABB);
      const overlapSize = overlap.getSize(new THREE.Vector3());
      
      // Determine which axis has the smallest penetration (easiest to resolve)
      if (overlapSize.x <= overlapSize.y && overlapSize.x <= overlapSize.z) {
        xCollisions.push({ collision, overlapSize });
      } else if (overlapSize.y <= overlapSize.z) {
        yCollisions.push({ collision, overlapSize });
      } else {
        zCollisions.push({ collision, overlapSize });
      }
    }

    // Resolve Y-axis collisions first (ground/ceiling are critical)
    if (yCollisions.length > 0) {
      // Find the most significant Y collision
      let maxYOverlap = 0;
      let primaryYCollision = null;
      
      for (const { collision, overlapSize } of yCollisions) {
        if (overlapSize.y > maxYOverlap) {
          maxYOverlap = overlapSize.y;
          primaryYCollision = collision;
        }
      }
      
      if (primaryYCollision) {
        const direction = targetBodyCenter.y > primaryYCollision.y * WORLD_CONFIG.VOXEL_SIZE ? 1 : -1;
        const correction = maxYOverlap * direction * resolutionStrength;
        result.position.y += correction;
        
        if (direction > 0) {
          result.onGround = true;
          if (result.velocity.y <= 0) result.velocity.y = 0;
        } else {
          result.hitCeiling = true;
          if (result.velocity.y >= 0) result.velocity.y = 0;
        }
        result.penetrationResolved = true;
      }
    }

    // Resolve X-axis collisions (wall sliding)
    if (xCollisions.length > 0) {
      let maxXOverlap = 0;
      let primaryXCollision = null;
      
      for (const { collision, overlapSize } of xCollisions) {
        if (overlapSize.x > maxXOverlap) {
          maxXOverlap = overlapSize.x;
          primaryXCollision = collision;
        }
      }
      
      if (primaryXCollision && maxXOverlap > 0.01) { // Minimum threshold
        const direction = targetBodyCenter.x > primaryXCollision.x * WORLD_CONFIG.VOXEL_SIZE ? 1 : -1;
        const correction = maxXOverlap * direction * resolutionStrength;
        result.position.x += correction;
        result.hitWall = true;
        result.velocity.x *= 0.3; // Moderate friction
        result.penetrationResolved = true;
      }
    }

    // Resolve Z-axis collisions (wall sliding)
    if (zCollisions.length > 0) {
      let maxZOverlap = 0;
      let primaryZCollision = null;
      
      for (const { collision, overlapSize } of zCollisions) {
        if (overlapSize.z > maxZOverlap) {
          maxZOverlap = overlapSize.z;
          primaryZCollision = collision;
        }
      }
      
      if (primaryZCollision && maxZOverlap > 0.01) { // Minimum threshold
        const direction = targetBodyCenter.z > primaryZCollision.z * WORLD_CONFIG.VOXEL_SIZE ? 1 : -1;
        const correction = maxZOverlap * direction * resolutionStrength;
        result.position.z += correction;
        result.hitWall = true;
        result.velocity.z *= 0.3; // Moderate friction
        result.penetrationResolved = true;
      }
    }

    // Apply gentle velocity damping only to horizontal movement when on ground
    if (result.onGround) {
      result.velocity.x *= damping;
      result.velocity.z *= damping;
    } else {
      // Less damping when in air to maintain responsiveness
      result.velocity.multiplyScalar(0.99);
    }
    
    if (result.penetrationResolved) {
      this.stats.penetrationResolutions++;
    }

    return result;
  }
}

// Create a global instance
export const globalCollisionSystem = new VoxelCollisionSystem(); 