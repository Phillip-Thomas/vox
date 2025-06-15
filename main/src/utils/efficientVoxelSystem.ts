import * as THREE from 'three';

/**
 * EFFICIENT VOXEL SYSTEM
 * 
 * Core Concept: Only track and render EXPOSED voxels
 * - Sparse storage: Map<coordKey, voxelData>
 * - Fixed GPU buffer: Reuse slots when voxels are deleted
 * - Instant updates: Direct mesh manipulation
 * - No rebuilds: Just hide/show individual voxels
 */

export interface VoxelData {
  position: [number, number, number];
  material: string;
  color: THREE.Color;
  meshSlot: number; // Which slot in the instancedMesh this voxel occupies
  rigidBodyRef?: any; // Reference to the RigidBody component for collision
}

export class EfficientVoxelSystem {
  // Core data: Only exposed voxels exist here
  private exposedVoxels = new Map<string, VoxelData>(); // "x,y,z" -> VoxelData
  
  // Original terrain: The permanent record of what the planet originally looked like
  private originalTerrain = new Map<string, {material: string, color: THREE.Color}>(); // "x,y,z" -> original voxel data
  
  // Deleted terrain: Positions that were originally terrain but have been deleted by player
  private deletedTerrain = new Set<string>(); // "x,y,z" -> positions that were deleted
  
  // GPU management - Dynamic allocation
  private availableSlots: number[] = []; // Reusable mesh slots
  private nextSlot = 0; // Next new slot to use
  private maxSlots: number;
  
  // References
  private mesh: THREE.InstancedMesh | null = null;
  private rigidBodies: any[] = [];
  
  constructor(initialCapacity: number = 1000) {
    // Start with initial capacity, but allow dynamic growth
    this.maxSlots = initialCapacity;
    this.availableSlots = [];
    // Don't pre-populate available slots, allocate on demand
  }
  
  /**
   * Dynamically expand the slot capacity if needed
   */
  expandCapacity(newSize: number) {
    if (newSize <= this.maxSlots) return;
    
    const oldMaxSlots = this.maxSlots;
    this.maxSlots = newSize;
    
    console.log(`🔄 DYNAMIC EXPANSION: Slot capacity expanded from ${oldMaxSlots} to ${this.maxSlots}`);
    
    // If we have a mesh, we need to inform about the expansion
    // Note: Three.js InstancedMesh capacity is set at creation time and cannot be expanded
    // This is handled at the Planet component level by setting initial capacity appropriately
  }
  
  setMesh(mesh: THREE.InstancedMesh) {
    this.mesh = mesh;
  }
  
  setRigidBodies(bodies: any[]) {
    this.rigidBodies = bodies;
  }
  
  /**
   * Set the original terrain - the permanent record of what the planet originally looked like
   */
  setOriginalTerrain(terrain: Array<{x: number, y: number, z: number, material: string, color: THREE.Color}>) {
    this.originalTerrain.clear();
    for (const voxel of terrain) {
      const coordKey = `${voxel.x},${voxel.y},${voxel.z}`;
      this.originalTerrain.set(coordKey, {
        material: voxel.material,
        color: voxel.color.clone()
      });
    }
    console.log(`🌍 Set original terrain with ${this.originalTerrain.size} voxels`);
  }
  
  /**
   * Check if a position was originally part of the terrain
   */
  wasOriginalTerrain(x: number, y: number, z: number): boolean {
    return this.originalTerrain.has(`${x},${y},${z}`);
  }
  
  /**
   * Check if a position is currently deleted (was terrain but removed by player)
   */
  isDeleted(x: number, y: number, z: number): boolean {
    return this.deletedTerrain.has(`${x},${y},${z}`);
  }
  
  /**
   * Get original terrain data for a position
   */
  getOriginalTerrain(x: number, y: number, z: number): {material: string, color: THREE.Color} | undefined {
    return this.originalTerrain.get(`${x},${y},${z}`);
  }
  
  /**
   * Add a voxel to the world (expose it)
   */
  addVoxel(x: number, y: number, z: number, material: string, color: THREE.Color, rigidBodyRef?: any): boolean {
    const coordKey = `${x},${y},${z}`;
    
    // Don't add if already exists
    if (this.exposedVoxels.has(coordKey)) {
      return false;
    }
    
    // Get a mesh slot
    const meshSlot = this.getAvailableSlot();
    if (meshSlot === -1) {
      console.warn('No available mesh slots');
      return false;
    }
    
    // Create voxel data
    const voxelData: VoxelData = {
      position: [x, y, z],
      material,
      color: color.clone(),
      meshSlot,
      rigidBodyRef
    };
    
    // Add to system
    this.exposedVoxels.set(coordKey, voxelData);
    
    // Update mesh
    this.updateMeshSlot(meshSlot, x, y, z, color);
    
    // If no rigid body provided, request dynamic collision body creation
    if (!rigidBodyRef) {
      // Import the function dynamically to avoid circular dependency
      import('../components/EfficientPlanet').then(({ addDynamicCollisionBody }) => {
        if (addDynamicCollisionBody) {
          addDynamicCollisionBody(x, y, z);
        }
      });
    }
    
    // console.log(`✅ Added voxel at (${x},${y},${z}) to slot ${meshSlot}`);
    return true;
  }
  
  /**
   * Remove a voxel from the world
   */
  removeVoxel(x: number, y: number, z: number): boolean {
    const coordKey = `${x},${y},${z}`;
    const voxelData = this.exposedVoxels.get(coordKey);
    
    if (!voxelData) {
      return false; // Voxel doesn't exist
    }
    
    // Mark as deleted if it was original terrain
    if (this.wasOriginalTerrain(x, y, z)) {
      this.deletedTerrain.add(coordKey);
      console.log(`🗑️ Marked original terrain at (${x},${y},${z}) as deleted`);
    }
    
    // Hide the mesh slot
    this.hideMeshSlot(voxelData.meshSlot);
    
    // Remove collision body completely
    if (voxelData.rigidBodyRef) {
      try {
        voxelData.rigidBodyRef.setEnabled(false);
        console.log(`🚫 Disabled collision for voxel at (${x},${y},${z})`);
      } catch (error) {
        console.warn(`Failed to disable collision for voxel at (${x},${y},${z}):`, error);
      }
    }
    
    // Remove collision body from the planet component immediately
    if ((window as any).removeDynamicCollisionBody) {
      (window as any).removeDynamicCollisionBody(x, y, z);
    }
    
    // Return slot to available pool
    this.availableSlots.push(voxelData.meshSlot);
    
    // Remove from system
    this.exposedVoxels.delete(coordKey);
    
    console.log(`🗑️ Removed voxel at (${x},${y},${z}) from slot ${voxelData.meshSlot}`);
    return true;
  }
  
  /**
   * Check if a voxel exists at coordinates
   */
  hasVoxel(x: number, y: number, z: number): boolean {
    return this.exposedVoxels.has(`${x},${y},${z}`);
  }
  
  /**
   * Get voxel data at coordinates
   */
  getVoxel(x: number, y: number, z: number): VoxelData | undefined {
    return this.exposedVoxels.get(`${x},${y},${z}`);
  }
  
  /**
   * Get all exposed voxels
   */
  getAllVoxels(): Map<string, VoxelData> {
    return new Map(this.exposedVoxels);
  }
  
  /**
   * Check if a position should be exposed (has at least one missing neighbor)
   * A position should be exposed if:
   * 1. It was originally part of the terrain
   * 2. It's not currently deleted
   * 3. It has at least one neighbor that is missing (either outside original terrain or deleted)
   */
  shouldBeExposed(x: number, y: number, z: number): boolean {
    // First check: This position must have been original terrain
    if (!this.wasOriginalTerrain(x, y, z)) {
      return false;
    }
    
    // Second check: This position must not be currently deleted
    if (this.isDeleted(x, y, z)) {
      return false;
    }
    
    const neighbors = [
      [x+1, y, z], [x-1, y, z],
      [x, y+1, z], [x, y-1, z],
      [x, y, z+1], [x, y, z-1]
    ];
    
    // Check if any neighbor is missing (either outside original terrain or deleted)
    for (const [nx, ny, nz] of neighbors) {
      const neighborWasOriginal = this.wasOriginalTerrain(nx, ny, nz);
      const neighborHasVoxel = this.hasVoxel(nx, ny, nz);
      
      // If neighbor was original terrain but doesn't have a voxel (deleted), this voxel should be exposed
      if (neighborWasOriginal && !neighborHasVoxel) {
        return true;
      }
      // If neighbor was not original terrain (air/outside), this voxel should be exposed
      if (!neighborWasOriginal) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * When a voxel is removed, check neighbors to see if they should be exposed
   */
  exposeNeighbors(x: number, y: number, z: number, materialGenerator: (x: number, y: number, z: number) => {material: string, color: THREE.Color}) {
    console.log(`🔍 Checking neighbors of deleted voxel at (${x},${y},${z})`);
    
    const neighbors = [
      [x+1, y, z], [x-1, y, z],
      [x, y+1, z], [x, y-1, z],
      [x, y, z+1], [x, y, z-1]
    ];
    
    let exposedCount = 0;
    
    for (const [nx, ny, nz] of neighbors) {
      // CRITICAL: Never expose a voxel in the same position that was just deleted
      if (nx === x && ny === y && nz === z) {
        continue;
      }
      
      // Skip if already exposed
      if (this.hasVoxel(nx, ny, nz)) {
        continue;
      }
      
      // Skip if not original terrain
      if (!this.wasOriginalTerrain(nx, ny, nz)) {
        continue;
      }
      
      // Check if this position should now be exposed
      const shouldExpose = this.shouldBeExposed(nx, ny, nz);
      
      if (shouldExpose) {
        // Use original terrain data instead of generating new material
        const originalData = this.getOriginalTerrain(nx, ny, nz);
        if (originalData) {
          this.addVoxel(nx, ny, nz, originalData.material, originalData.color);
          exposedCount++;
        }
      }
    }
    
    if (exposedCount > 0) {
      console.log(`🌟 Exposed ${exposedCount} original terrain voxels after deletion of (${x},${y},${z})`);
    }
  }
  
  // Private helper methods
  
  private getAvailableSlot(): number {
    if (this.availableSlots.length > 0) {
      return this.availableSlots.pop()!;
    }
    
    // Check actual mesh capacity (not mesh.count which is render count)
    if (this.mesh) {
      // The actual capacity is stored in the geometry's attributes
      const meshCapacity = this.mesh.instanceMatrix?.count || 0;
      
      if (this.nextSlot < meshCapacity) {
        return this.nextSlot++;
      } else {
        console.warn(`⚠️ MESH CAPACITY REACHED: Slot ${this.nextSlot} >= Mesh capacity ${meshCapacity}`);
        console.warn(`🔧 SOLUTION: The instancedMesh needs to be created with higher initial capacity`);
        console.warn(`📊 Current usage: ${this.nextSlot}/${meshCapacity} slots, Available pool: ${this.availableSlots.length}`);
        return -1; // Can't expand Three.js InstancedMesh at runtime
      }
    }
    
    // Fallback: allow slots up to maxSlots when no mesh is attached (for initialization)
    if (this.nextSlot < this.maxSlots) {
      return this.nextSlot++;
    }
    
    // Dynamic expansion - increase maxSlots if needed
    this.expandCapacity(this.maxSlots + 10000);
    return this.nextSlot++;
  }
  
  private updateMeshSlot(slot: number, x: number, y: number, z: number, color: THREE.Color) {
    if (!this.mesh) return;
    
    // Set position matrix
    const matrix = new THREE.Matrix4();
    matrix.setPosition(x * 2, y * 2, z * 2); // Assuming 2-unit voxel size
    this.mesh.setMatrixAt(slot, matrix);
    
    // Set color
    this.mesh.setColorAt(slot, color);
    
    // Update mesh
    if (this.mesh.instanceMatrix) this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    
    // Update mesh count to include this slot
    this.mesh.count = Math.max(this.mesh.count, slot + 1);
  }
  
  private hideMeshSlot(slot: number) {
    if (!this.mesh) return;
    
    // Move voxel far away (effectively hiding it)
    const matrix = new THREE.Matrix4();
    matrix.setPosition(100000, 100000, 100000);
    this.mesh.setMatrixAt(slot, matrix);
    
    if (this.mesh.instanceMatrix) this.mesh.instanceMatrix.needsUpdate = true;
  }
  
  /**
   * Get statistics about the system
   */
  getStats() {
    return {
      exposedVoxels: this.exposedVoxels.size,
      availableSlots: this.availableSlots.length,
      usedSlots: this.nextSlot - this.availableSlots.length,
      maxSlots: this.maxSlots,
      memoryEfficiency: (this.exposedVoxels.size / this.maxSlots * 100).toFixed(1) + '%'
    };
  }
}

// Global instance - Dynamic allocation based on planet size
// Initial capacity will be adjusted based on actual planet configuration
export const voxelSystem = new EfficientVoxelSystem(1000); 