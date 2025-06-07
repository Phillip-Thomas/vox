import * as THREE from 'three';
import { WORLD_CONFIG } from '../constants/world';

export class PlanetGeometry {
  constructor() {
    this.planetCenter = new THREE.Vector3(...WORLD_CONFIG.PLANET.GRAVITY.CENTER);
    this.planetSize = WORLD_CONFIG.PLANET.SIZE;
    this.borderRadius = WORLD_CONFIG.PLANET.BORDER_RADIUS;
  }

  /**
   * Convert world position to planetary coordinates
   * Returns: { face, localX, localY, distanceFromCenter, isOnPlanet }
   */
  worldToPlanetCoords(worldPos) {
    const relativePos = worldPos.clone().sub(this.planetCenter);
    const distance = relativePos.length();
    
    // Determine which face this position is closest to
    const face = this.getNearestFace(relativePos);
    
    if (!face) {
      return {
        face: null,
        localX: 0,
        localY: 0,
        distanceFromCenter: distance,
        isOnPlanet: false
      };
    }

    // Project position onto the face plane
    const faceNormal = new THREE.Vector3(...face.normal);
    const faceRight = new THREE.Vector3(...face.right);
    const faceUp = new THREE.Vector3(...face.up);
    
    // Calculate local coordinates on the face
    const localX = relativePos.dot(faceRight);
    const localY = relativePos.dot(faceUp);
    
    return {
      face: face,
      localX,
      localY,
      distanceFromCenter: distance,
      isOnPlanet: this.isPositionOnPlanet(relativePos)
    };
  }

  /**
   * Convert planetary coordinates back to world position
   */
  planetToWorldCoords(faceName, localX, localY, height = 0) {
    const face = this.faces[faceName];
    if (!face) return null;

    const faceNormal = new THREE.Vector3(...face.normal);
    const faceRight = new THREE.Vector3(...face.right);
    const faceUp = new THREE.Vector3(...face.up);

    // Start at face center
    const faceCenter = faceNormal.clone().multiplyScalar(this.planetSize);
    
    // Add local offsets
    const localOffset = faceRight.clone().multiplyScalar(localX)
      .add(faceUp.clone().multiplyScalar(localY));
    
    // Add height (outward from face)
    const heightOffset = faceNormal.clone().multiplyScalar(height);
    
    // Apply rounding at edges
    const roundedPosition = this.applyEdgeRounding(faceCenter.add(localOffset).add(heightOffset));
    
    return roundedPosition.add(this.planetCenter);
  }


  /**
   * Check if a position is on the planet surface
   */
  isPositionOnPlanet(relativePos) {
    const distance = relativePos.length();
    return distance <= this.planetSize + WORLD_CONFIG.PLANET.TERRAIN.HEIGHT_VARIATION;
  }

  /**
   * Calculate radial gravity vector for a position
   */
  getRadialGravity(worldPos) {
    if (WORLD_CONFIG.PLANET.GRAVITY.MODE !== 'RADIAL') {
      // Fallback to standard downward gravity
      return new THREE.Vector3(0, -WORLD_CONFIG.PLANET.GRAVITY.STRENGTH, 0);
    }

    const relativePos = worldPos.clone().sub(this.planetCenter);
    const distance = relativePos.length();
    
    if (distance === 0) {
      return new THREE.Vector3(0, 0, 0);
    }

    // Gravity points toward planet center, strength decreases with distance
    const gravityDirection = relativePos.clone().normalize().multiplyScalar(-1);
    const gravityStrength = WORLD_CONFIG.PLANET.GRAVITY.STRENGTH * 
      Math.max(0.1, Math.min(1, this.planetSize / distance));
    
    return gravityDirection.multiplyScalar(gravityStrength);
  }

  /**
   * Get surface height at a specific face coordinate
   */
  getSurfaceHeight(faceName, localX, localY) {
    // Use noise generation to create varied surface height
    const noiseValue = this.generateSurfaceNoise(localX, localY);
    const baseHeight = WORLD_CONFIG.PLANET.TERRAIN.BASE_OFFSET;
    const heightVariation = WORLD_CONFIG.PLANET.TERRAIN.HEIGHT_VARIATION;
    
    return baseHeight + noiseValue * heightVariation;
  }

  /**
   * Generate surface noise for terrain variation
   */
  generateSurfaceNoise(x, y) {
    // Simple noise implementation for now - can be enhanced with actual noise library
    const scale = 0.01;
    const amplitude = 1;
    
    // Basic pseudo-noise
    const noise = Math.sin(x * scale) * Math.cos(y * scale) * amplitude;
    return (noise + 1) / 2; // Normalize to 0-1
  }

  /**
   * Get the "up" direction for a position on the planet
   */
  getUpDirection(worldPos) {
    if (WORLD_CONFIG.PLANET.GRAVITY.MODE !== 'RADIAL') {
      return new THREE.Vector3(0, 1, 0);
    }

    const relativePos = worldPos.clone().sub(this.planetCenter);
    return relativePos.normalize();
  }

  /**
   * Check if two positions are on the same face
   */
  areOnSameFace(worldPos1, worldPos2) {
    const coords1 = this.worldToPlanetCoords(worldPos1);
    const coords2 = this.worldToPlanetCoords(worldPos2);
    
    return coords1.face && coords2.face && coords1.face.name === coords2.face.name;
  }

  /**
   * Get smoothed orientation for player on planet surface
   */
  getPlayerOrientation(worldPos, currentOrientation) {
    const upDirection = this.getUpDirection(worldPos);
    const smoothing = WORLD_CONFIG.PLAYER_BODY.GROUND_ATTACHMENT.ORIENTATION_SMOOTHING || 0.85;
    
    // Smoothly interpolate player orientation to match planet surface
    return currentOrientation.clone().lerp(upDirection, smoothing);
  }

  /**
   * Debug information for a world position
   */
  getDebugInfo(worldPos) {
    const coords = this.worldToPlanetCoords(worldPos);
    const gravity = this.getRadialGravity(worldPos);
    const upDir = this.getUpDirection(worldPos);
    
    return {
      planetCoords: coords,
      gravity: {
        direction: gravity.normalize(),
        strength: gravity.length()
      },
      upDirection: upDir,
      isOnPlanet: coords.isOnPlanet
    };
  }
}

// Create global instance
export const globalPlanetGeometry = new PlanetGeometry(); 