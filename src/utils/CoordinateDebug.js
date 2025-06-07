import { WORLD_CONFIG } from '../constants/world.js';

/**
 * Coordinate Debug Utility
 * Helps verify coordinate calculations between terrain and vegetation systems
 */
export class CoordinateDebug {
  
  /**
   * Calculate terrain voxel world position using exact same formula as Terrain.js
   */
  static getTerrainVoxelWorldPosition(chunkX, chunkZ, localX, localY, localZ) {
    const chunkWorldOffsetX = chunkX * WORLD_CONFIG.CHUNK_SIZE * WORLD_CONFIG.VOXEL_SIZE;
    const chunkWorldOffsetZ = chunkZ * WORLD_CONFIG.CHUNK_SIZE * WORLD_CONFIG.VOXEL_SIZE;
    
    const worldX = (localX - WORLD_CONFIG.CHUNK_SIZE / 2) * WORLD_CONFIG.VOXEL_SIZE + chunkWorldOffsetX;
    const worldY = localY * WORLD_CONFIG.VOXEL_SIZE;
    const worldZ = (localZ - WORLD_CONFIG.CHUNK_SIZE / 2) * WORLD_CONFIG.VOXEL_SIZE + chunkWorldOffsetZ;
    
    return { worldX, worldY, worldZ };
  }
  
  /**
   * Calculate tree placement position to verify it matches voxel surface
   */
  static getTreePlacementPosition(chunkX, chunkZ, localX, localZ, surfaceHeight) {
    const chunkWorldOffsetX = chunkX * WORLD_CONFIG.CHUNK_SIZE * WORLD_CONFIG.VOXEL_SIZE;
    const chunkWorldOffsetZ = chunkZ * WORLD_CONFIG.CHUNK_SIZE * WORLD_CONFIG.VOXEL_SIZE;
    
    const treeWorldX = (localX - WORLD_CONFIG.CHUNK_SIZE / 2) * WORLD_CONFIG.VOXEL_SIZE + chunkWorldOffsetX;
    const treeWorldY = surfaceHeight * WORLD_CONFIG.VOXEL_SIZE;
    const treeWorldZ = (localZ - WORLD_CONFIG.CHUNK_SIZE / 2) * WORLD_CONFIG.VOXEL_SIZE + chunkWorldOffsetZ;
    
    return { treeWorldX, treeWorldY, treeWorldZ };
  }
  
  /**
   * Verify that tree position exactly matches voxel surface position
   */
  static verifyTreePlacement(chunkX, chunkZ, localX, localZ, surfaceHeight) {
    // Get voxel position for the solid block (surface is Y+1 above solid)
    const solidVoxelY = surfaceHeight - 1;
    const voxelPos = this.getTerrainVoxelWorldPosition(chunkX, chunkZ, localX, solidVoxelY, localZ);
    
    // Get tree placement position
    const treePos = this.getTreePlacementPosition(chunkX, chunkZ, localX, localZ, surfaceHeight);
    
    // Tree should be placed exactly on top of the voxel
    const expectedTreeY = voxelPos.worldY + WORLD_CONFIG.VOXEL_SIZE; // Top of solid voxel
    
    const verification = {
      solidVoxelPosition: voxelPos,
      treePlacementPosition: treePos,
      expectedTreeY,
      isCorrect: {
        x: Math.abs(voxelPos.worldX - treePos.treeWorldX) < 0.001,
        y: Math.abs(expectedTreeY - treePos.treeWorldY) < 0.001,
        z: Math.abs(voxelPos.worldZ - treePos.treeWorldZ) < 0.001
      },
      errors: {
        x: voxelPos.worldX - treePos.treeWorldX,
        y: expectedTreeY - treePos.treeWorldY,
        z: voxelPos.worldZ - treePos.treeWorldZ
      }
    };
    
    return verification;
  }
  
  /**
   * Log detailed coordinate verification
   */
  static logCoordinateVerification(chunkX, chunkZ, localX, localZ, surfaceHeight) {
    const verification = this.verifyTreePlacement(chunkX, chunkZ, localX, localZ, surfaceHeight);
    
    console.log(`🔍 Coordinate Verification for chunk(${chunkX},${chunkZ}) local(${localX},${localZ})`);
    console.log(`   Solid Voxel: (${verification.solidVoxelPosition.worldX.toFixed(3)}, ${verification.solidVoxelPosition.worldY.toFixed(3)}, ${verification.solidVoxelPosition.worldZ.toFixed(3)})`);
    console.log(`   Tree Position: (${verification.treePlacementPosition.treeWorldX.toFixed(3)}, ${verification.treePlacementPosition.treeWorldY.toFixed(3)}, ${verification.treePlacementPosition.treeWorldZ.toFixed(3)})`);
    console.log(`   Expected Tree Y: ${verification.expectedTreeY.toFixed(3)}`);
    console.log(`   Correct: X=${verification.isCorrect.x}, Y=${verification.isCorrect.y}, Z=${verification.isCorrect.z}`);
    
    if (!verification.isCorrect.x || !verification.isCorrect.y || !verification.isCorrect.z) {
      console.log(`   ❌ Errors: X=${verification.errors.x.toFixed(3)}, Y=${verification.errors.y.toFixed(3)}, Z=${verification.errors.z.toFixed(3)}`);
    } else {
      console.log(`   ✅ Perfect coordinate match!`);
    }
    
    return verification;
  }
  
  /**
   * Generate test placements for debugging
   */
  static generateTestPlacements(chunkX = 0, chunkZ = 0) {
    const testPlacements = [];
    
    // Test a few key positions
    const testPositions = [
      { x: 32, z: 32 }, // Center
      { x: 16, z: 16 }, // Quarter
      { x: 48, z: 48 }, // Three quarters
      { x: 8, z: 8 },   // Near edge
    ];
    
    testPositions.forEach(pos => {
      // Assume surface height of 10 for testing
      const surfaceHeight = 10;
      const verification = this.verifyTreePlacement(chunkX, chunkZ, pos.x, pos.z, surfaceHeight);
      
      testPlacements.push({
        localPosition: pos,
        surfaceHeight,
        verification
      });
    });
    
    return testPlacements;
  }
}

// Export for debugging
window.CoordinateDebug = CoordinateDebug; 