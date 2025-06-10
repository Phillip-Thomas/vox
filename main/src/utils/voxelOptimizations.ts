import * as THREE from 'three';

// Occlusion culling - check if a voxel is completely surrounded by other voxels
export function isVoxelOccluded(
  x: number, 
  y: number, 
  z: number, 
  voxelData: Set<string>,
  cubeSize: { x: number, y: number, z: number }
): boolean {
  const directions = [
    [1, 0, 0], [-1, 0, 0],  // x-axis
    [0, 1, 0], [0, -1, 0],  // y-axis
    [0, 0, 1], [0, 0, -1]   // z-axis
  ];
  
  for (const [dx, dy, dz] of directions) {
    const nx = x + dx;
    const ny = y + dy;
    const nz = z + dz;
    
    // If neighbor is out of bounds or doesn't exist, voxel is not occluded
    if (nx < 0 || nx >= cubeSize.x || 
        ny < 0 || ny >= cubeSize.y || 
        nz < 0 || nz >= cubeSize.z ||
        !voxelData.has(`${nx}_${ny}_${nz}`)) {
      return false;
    }
  }
  
  return true; // All neighbors exist, voxel is occluded
}

// Chunk management for better culling
export interface Chunk {
  position: [number, number, number];
  voxels: Array<{ x: number; y: number; z: number; position: [number, number, number] }>;
  boundingBox: THREE.Box3;
}

export function createChunks(
  voxelSize: number,
  cubeSize: { x: number, y: number, z: number },
  chunkSize: number,
  offset: [number, number, number]
): Chunk[] {
  const chunks: Chunk[] = [];
  
  for (let chunkX = 0; chunkX < Math.ceil(cubeSize.x / chunkSize); chunkX++) {
    for (let chunkY = 0; chunkY < Math.ceil(cubeSize.y / chunkSize); chunkY++) {
      for (let chunkZ = 0; chunkZ < Math.ceil(cubeSize.z / chunkSize); chunkZ++) {
        const chunk: Chunk = {
          position: [chunkX * chunkSize, chunkY * chunkSize, chunkZ * chunkSize],
          voxels: [],
          boundingBox: new THREE.Box3()
        };
        
        // Calculate chunk bounds
        const minX = chunkX * chunkSize;
        const maxX = Math.min((chunkX + 1) * chunkSize, cubeSize.x);
        const minY = chunkY * chunkSize;
        const maxY = Math.min((chunkY + 1) * chunkSize, cubeSize.y);
        const minZ = chunkZ * chunkSize;
        const maxZ = Math.min((chunkZ + 1) * chunkSize, cubeSize.z);
        
        // Add voxels to chunk
        for (let x = minX; x < maxX; x++) {
          for (let y = minY; y < maxY; y++) {
            for (let z = minZ; z < maxZ; z++) {
              const position: [number, number, number] = [
                x * voxelSize + offset[0],
                y * voxelSize + offset[1],
                z * voxelSize + offset[2],
              ];
              
              chunk.voxels.push({ x, y, z, position });
            }
          }
        }
        
        // Calculate bounding box for the chunk
        if (chunk.voxels.length > 0) {
          const positions = chunk.voxels.map(v => new THREE.Vector3(...v.position));
          chunk.boundingBox.setFromPoints(positions);
          chunk.boundingBox.expandByScalar(voxelSize * 0.5);
          chunks.push(chunk);
        }
      }
    }
  }
  
  return chunks;
}

// Frustum culling for chunks
export function isChunkVisible(chunk: Chunk, frustum: THREE.Frustum): boolean {
  return frustum.intersectsBox(chunk.boundingBox);
}

// Distance-based LOD calculation
export function calculateLOD(cameraPosition: THREE.Vector3, targetPosition: THREE.Vector3, lodDistances: number[]): number {
  const distance = cameraPosition.distanceTo(targetPosition);
  
  for (let i = 0; i < lodDistances.length; i++) {
    if (distance <= lodDistances[i]) {
      return i;
    }
  }
  
  return lodDistances.length; // Highest LOD level
}

// Memory-efficient voxel data structure
export class VoxelMap {
  private data: Set<string> = new Set();
  
  add(x: number, y: number, z: number): void {
    this.data.add(`${x}_${y}_${z}`);
  }
  
  has(x: number, y: number, z: number): boolean {
    return this.data.has(`${x}_${y}_${z}`);
  }
  
  remove(x: number, y: number, z: number): void {
    this.data.delete(`${x}_${y}_${z}`);
  }
  
  clear(): void {
    this.data.clear();
  }
  
  get size(): number {
    return this.data.size;
  }
}

// Performance monitoring
export class PerformanceMonitor {
  private frameTime: number = 0;
  private lastTime: number = 0;
  private frameCount: number = 0;
  private avgFrameTime: number = 0;
  
  update(): void {
    const currentTime = performance.now();
    if (this.lastTime > 0) {
      this.frameTime = currentTime - this.lastTime;
      this.frameCount++;
      this.avgFrameTime = (this.avgFrameTime * (this.frameCount - 1) + this.frameTime) / this.frameCount;
    }
    this.lastTime = currentTime;
  }
  
  getFPS(): number {
    return this.frameTime > 0 ? 1000 / this.frameTime : 0;
  }
  
  getAverageFPS(): number {
    return this.avgFrameTime > 0 ? 1000 / this.avgFrameTime : 0;
  }
  
  reset(): void {
    this.frameCount = 0;
    this.avgFrameTime = 0;
  }
} 