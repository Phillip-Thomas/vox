import * as THREE from 'three';
import { voxelCoordToWorld } from './cubeGravityConstants';
import { materialId } from '../types/materials';
import type { MaterialType } from '../types/materials';
import { materialToLegacyBlock } from '../game/adapters';
import type { BlockId } from '../game/data/blocks';
import type { ResourceDeposit } from '../game/generation/resourceDeposits';

interface VoxelData {
  position: [number, number, number];
  material: string;
  blockId: BlockId;
  deposit: ResourceDeposit | null;
  color: THREE.Color;
  meshSlot: number;
  worldId: number;
  supportsSurfaceResources: boolean;
  rigidBodyRef?: { setEnabled?: (enabled: boolean) => void };
}

interface VoxelAddOptions {
  supportsSurfaceResources?: boolean;
  blockId?: BlockId;
  deposit?: ResourceDeposit | null;
}

interface InitialTerrainPopulateOptions {
  requestCollisions?: boolean;
  originalTerrainByCoord?: OriginalTerrainMap;
  initialTerrainMeshData?: InitialTerrainMeshData;
}

interface CollisionCallbacks {
  request: (x: number, y: number, z: number, worldId: number) => void;
  remove: (x: number, y: number, z: number, worldId: number) => void;
}

export interface TerrainVoxel {
  x: number;
  y: number;
  z: number;
  blockId?: BlockId;
  deposit?: ResourceDeposit | null;
  material: string;
  color: THREE.Color;
}

export interface OriginalTerrainData {
  blockId?: BlockId;
  deposit?: ResourceDeposit | null;
  material: string;
  color: THREE.Color;
}

export type OriginalTerrainMap = ReadonlyMap<string, OriginalTerrainData>;

export interface InitialTerrainMeshData {
  count: number;
  matrices: Float32Array;
  colors: Float32Array;
  instanceData: Float32Array;
}

const tempMatrix = new THREE.Matrix4();
const tempVector = new THREE.Vector3();

export class EfficientVoxelSystem {
  private exposedVoxels = new Map<string, VoxelData>();
  private originalTerrain: OriginalTerrainMap = new Map();
  private deletedTerrain = new Set<string>();
  private slotToCoord = new Map<number, string>();
  private mesh: THREE.InstancedMesh | null = null;
  // Per-instance shader data: x = packed material id, y = packed AO face mask.
  // Written exclusively inside updateMeshSlot so it stays in sync through slot
  // compaction (releaseMeshSlot reuses that same path).
  private instanceData: THREE.InstancedBufferAttribute | null = null;
  private maxSlots: number;
  private worldId = 0;
  private editVersion = 0;
  private collisionCallbacks: CollisionCallbacks | null = null;
  // Edit notifications for persistence. Fired ONLY by user-facing add/removeVoxel —
  // suppressed during populate/replay so loading a world never triggers an autosave.
  private editListeners = new Set<() => void>();
  private suppressEdits = false;

  constructor(initialCapacity = 1000) {
    this.maxSlots = initialCapacity;
  }

  static coordKey(x: number, y: number, z: number) {
    return `${x},${y},${z}`;
  }

  reset() {
    this.worldId += 1;
    this.exposedVoxels.clear();
    this.originalTerrain = new Map();
    this.deletedTerrain.clear();
    this.slotToCoord.clear();
    this.collisionCallbacks = null;

    if (this.mesh) {
      this.mesh.count = 0;
      this.invalidateMeshBounds();
      if (this.mesh.instanceMatrix) this.mesh.instanceMatrix.needsUpdate = true;
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }
  }

  getWorldId() {
    return this.worldId;
  }

  getEditVersion() {
    return this.editVersion;
  }

  /** Subscribe to USER voxel edits (mine/place) — for autosave. Not fired during
   *  populate or diff replay. Returns an unsubscribe fn. */
  subscribeVoxelEdits(cb: () => void): () => void {
    this.editListeners.add(cb);
    return () => this.editListeners.delete(cb);
  }

  private emitEdit() {
    if (!this.suppressEdits) this.editListeners.forEach(l => l());
  }

  /** Count of generated original-terrain voxels for this world — a cheap generation
   *  fingerprint: if terrain gen changes (without a schema bump) this shifts, so a
   *  saved diff with a different fingerprint is refused (stale). */
  getOriginalTerrainSize(): number {
    return this.originalTerrain.size;
  }

  /** Snapshot of the player's removed-voxel coords (the persistable terrain diff). */
  getDeletedVoxels(): Array<[number, number, number]> {
    return [...this.deletedTerrain].map(k => k.split(',').map(Number) as [number, number, number]);
  }

  /**
   * Re-apply a saved removal diff after `populateInitialTerrain`, reproducing the
   * live-dug shell WITHOUT looping `removeVoxel` (which no-ops on not-yet-exposed
   * coords and never re-exposes interiors). Two batched passes, edit events
   * suppressed:
   *   1. mark every removed coord deleted + tear down any currently-exposed slot,
   *   2. expose the revealed interiors (gets supportsSurfaceResources:false, exactly
   *      as `exposeNeighbors` does for live digging).
   * One mesh refresh at the end. Bumps editVersion so the foliage fields rebuild.
   */
  applyTerrainDiff(removed: ReadonlyArray<[number, number, number]>): void {
    if (removed.length === 0) return;
    this.suppressEdits = true;
    for (const [x, y, z] of removed) {
      if (!this.wasOriginalTerrain(x, y, z)) continue; // only original cells can be dug
      const coordKey = EfficientVoxelSystem.coordKey(x, y, z);
      this.deletedTerrain.add(coordKey);
      const voxelData = this.exposedVoxels.get(coordKey);
      if (voxelData) {
        this.collisionCallbacks?.remove(x, y, z, this.worldId);
        this.exposedVoxels.delete(coordKey);
        this.releaseMeshSlot(voxelData.meshSlot);
        this.editVersion += 1;
      }
    }
    for (const [x, y, z] of removed) this.exposeNeighbors(x, y, z);
    this.markMeshDirty();
    this.suppressEdits = false;
  }

  restoreOriginalTerrainVoxel(x: number, y: number, z: number): boolean {
    const coordKey = EfficientVoxelSystem.coordKey(x, y, z);
    const originalData = this.originalTerrain.get(coordKey);
    if (!originalData || !this.deletedTerrain.has(coordKey)) return false;

    const previousSuppressEdits = this.suppressEdits;
    this.suppressEdits = true;
    let changed = false;
    this.deletedTerrain.delete(coordKey);
    this.editVersion += 1;
    changed = true;

    if (this.shouldBeExposed(x, y, z)) {
      changed = this.addVoxel(
        x,
        y,
        z,
        originalData.material,
        originalData.color,
        undefined,
        {
          supportsSurfaceResources: true,
          blockId: originalData.blockId,
          deposit: originalData.deposit ?? null
        }
      ) || changed;
    } else {
      changed = this.removeExposedVoxelIfPresent(x, y, z) || changed;
    }

    for (const [nx, ny, nz] of this.neighborCoords(x, y, z)) {
      if (!this.wasOriginalTerrain(nx, ny, nz) || this.isDeleted(nx, ny, nz)) continue;
      if (this.shouldBeExposed(nx, ny, nz)) continue;
      changed = this.removeExposedVoxelIfPresent(nx, ny, nz) || changed;
    }

    this.refreshNeighborAO(x, y, z);
    this.markMeshDirty();
    this.suppressEdits = previousSuppressEdits;
    if (changed) this.emitEdit();
    return changed;
  }

  expandCapacity(newSize: number) {
    if (newSize > this.maxSlots) {
      this.maxSlots = newSize;
    }
  }

  setMesh(mesh: THREE.InstancedMesh) {
    this.mesh = mesh;

    // Allocate the per-instance shader-data attribute sized to the mesh's GPU
    // capacity (instanceMatrix.count is the allocated buffer size). expandCapacity
    // only raises a logical limit and never reallocates the GPU buffer, and
    // getAvailableSlot clamps to instanceMatrix.count, so this sizing is correct.
    const capacity = mesh.instanceMatrix.count;
    const data = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 2), 2);
    data.setUsage(THREE.DynamicDrawUsage);
    mesh.geometry.setAttribute('aInstanceData', data);
    this.instanceData = data;
  }

  clearMesh(mesh?: THREE.InstancedMesh | null) {
    if (!mesh || this.mesh === mesh) {
      this.mesh = null;
      this.instanceData = null;
    }
  }

  setCollisionCallbacks(callbacks: CollisionCallbacks) {
    this.collisionCallbacks = callbacks;
  }

  clearCollisionCallbacks() {
    this.collisionCallbacks = null;
  }

  setOriginalTerrain(terrain: TerrainVoxel[]) {
    this.originalTerrain = EfficientVoxelSystem.buildOriginalTerrainMap(terrain);
  }

  populateInitialTerrain(
    originalTerrain: TerrainVoxel[],
    exposedTerrain: TerrainVoxel[],
    options: InitialTerrainPopulateOptions = {}
  ) {
    this.originalTerrain = options.originalTerrainByCoord
      ?? EfficientVoxelSystem.buildOriginalTerrainMap(originalTerrain);
    this.exposedVoxels.clear();
    this.deletedTerrain.clear();
    this.slotToCoord.clear();

    if (this.mesh) {
      this.mesh.count = 0;
    }
    const shouldRequestCollisions = options.requestCollisions ?? true;
    const meshCapacity = this.mesh?.instanceMatrix?.count ?? this.maxSlots;
    const meshData = options.initialTerrainMeshData && options.initialTerrainMeshData.count >= exposedTerrain.length
      ? options.initialTerrainMeshData
      : undefined;

    for (const voxel of exposedTerrain) {
      const coordKey = EfficientVoxelSystem.coordKey(voxel.x, voxel.y, voxel.z);
      if (this.exposedVoxels.has(coordKey)) continue;

      const meshSlot = this.slotToCoord.size;
      if (meshSlot >= meshCapacity) break;

      const voxelData: VoxelData = {
        position: [voxel.x, voxel.y, voxel.z],
        material: voxel.material,
        blockId: voxel.blockId ?? materialToLegacyBlock(voxel.material as MaterialType),
        deposit: voxel.deposit ?? null,
        color: voxel.color.clone(),
        meshSlot,
        worldId: this.worldId,
        supportsSurfaceResources: true
      };

      this.exposedVoxels.set(coordKey, voxelData);
      this.slotToCoord.set(meshSlot, coordKey);
      if (!meshData) {
        this.writeMeshSlot(meshSlot, voxel.x, voxel.y, voxel.z, voxel.color, voxel.material);
      }
    }

    const added = this.slotToCoord.size;
    if (meshData) {
      this.writeInitialMeshData(meshData, added);
    }
    this.editVersion += added;
    this.markMeshDirty();

    if (shouldRequestCollisions) {
      for (const voxelData of this.exposedVoxels.values()) {
        const [x, y, z] = voxelData.position;
        this.collisionCallbacks?.request(x, y, z, this.worldId);
      }
    }

    return added;
  }

  static buildOriginalTerrainMap(terrain: TerrainVoxel[]): Map<string, OriginalTerrainData> {
    const terrainByCoord = new Map<string, OriginalTerrainData>();
    for (const voxel of terrain) {
      terrainByCoord.set(EfficientVoxelSystem.coordKey(voxel.x, voxel.y, voxel.z), {
        blockId: voxel.blockId ?? materialToLegacyBlock(voxel.material as MaterialType),
        deposit: voxel.deposit ?? null,
        material: voxel.material,
        color: voxel.color.clone()
      });
    }
    return terrainByCoord;
  }

  wasOriginalTerrain(x: number, y: number, z: number) {
    return this.originalTerrain.has(EfficientVoxelSystem.coordKey(x, y, z));
  }

  isDeleted(x: number, y: number, z: number) {
    return this.deletedTerrain.has(EfficientVoxelSystem.coordKey(x, y, z));
  }

  /** All currently-dug original-terrain cells ("x,y,z" keys). Used by the water
   *  system to re-flood dug channels after a reload (deletions are persisted). */
  getDeletedTerrainKeys(): string[] {
    return [...this.deletedTerrain];
  }

  getOriginalTerrain(x: number, y: number, z: number) {
    return this.originalTerrain.get(EfficientVoxelSystem.coordKey(x, y, z));
  }

  addVoxel(
    x: number,
    y: number,
    z: number,
    material: string,
    color: THREE.Color,
    rigidBodyRef?: VoxelData['rigidBodyRef'],
    options: VoxelAddOptions = {}
  ) {
    const coordKey = EfficientVoxelSystem.coordKey(x, y, z);
    if (this.exposedVoxels.has(coordKey)) return false;

    const meshSlot = this.getAvailableSlot();
    if (meshSlot === -1) return false;

    const voxelData: VoxelData = {
      position: [x, y, z],
      material,
      blockId: options.blockId ?? materialToLegacyBlock(material as MaterialType),
      deposit: options.deposit ?? null,
      color: color.clone(),
      meshSlot,
      rigidBodyRef,
      worldId: this.worldId,
      supportsSurfaceResources: options.supportsSurfaceResources ?? true
    };

    this.exposedVoxels.set(coordKey, voxelData);
    this.editVersion += 1;
    this.slotToCoord.set(meshSlot, coordKey);
    this.updateMeshSlot(meshSlot, x, y, z, color, material);
    this.refreshNeighborAO(x, y, z);

    if (!rigidBodyRef) {
      this.collisionCallbacks?.request(x, y, z, this.worldId);
    }

    this.emitEdit();
    return true;
  }

  removeVoxel(x: number, y: number, z: number) {
    const coordKey = EfficientVoxelSystem.coordKey(x, y, z);
    const voxelData = this.exposedVoxels.get(coordKey);
    if (!voxelData) return false;

    if (this.wasOriginalTerrain(x, y, z)) {
      this.deletedTerrain.add(coordKey);
    }

    try {
      voxelData.rigidBodyRef?.setEnabled?.(false);
    } catch (error) {
      console.warn(`Failed to disable collision for voxel ${coordKey}:`, error);
    }

    this.collisionCallbacks?.remove(x, y, z, this.worldId);
    this.exposedVoxels.delete(coordKey);
    this.editVersion += 1;
    this.releaseMeshSlot(voxelData.meshSlot);
    this.refreshNeighborAO(x, y, z);
    this.emitEdit();
    return true;
  }

  private removeExposedVoxelIfPresent(x: number, y: number, z: number): boolean {
    const coordKey = EfficientVoxelSystem.coordKey(x, y, z);
    const voxelData = this.exposedVoxels.get(coordKey);
    if (!voxelData) return false;

    try {
      voxelData.rigidBodyRef?.setEnabled?.(false);
    } catch (error) {
      console.warn(`Failed to disable collision for voxel ${coordKey}:`, error);
    }

    this.collisionCallbacks?.remove(x, y, z, this.worldId);
    this.exposedVoxels.delete(coordKey);
    this.editVersion += 1;
    this.releaseMeshSlot(voxelData.meshSlot);
    this.refreshNeighborAO(x, y, z);
    return true;
  }

  hasVoxel(x: number, y: number, z: number) {
    return this.exposedVoxels.has(EfficientVoxelSystem.coordKey(x, y, z));
  }

  getVoxel(x: number, y: number, z: number) {
    return this.exposedVoxels.get(EfficientVoxelSystem.coordKey(x, y, z));
  }

  supportsSurfaceResources(x: number, y: number, z: number) {
    return this.getVoxel(x, y, z)?.supportsSurfaceResources ?? false;
  }

  getAllVoxels() {
    return new Map(this.exposedVoxels);
  }

  getCoordForSlot(slot: number) {
    const coordKey = this.slotToCoord.get(slot);
    if (!coordKey) return null;
    const [x, y, z] = coordKey.split(',').map(Number);
    return { x, y, z };
  }

  shouldBeExposed(x: number, y: number, z: number) {
    if (!this.wasOriginalTerrain(x, y, z) || this.isDeleted(x, y, z)) return false;

    for (const [nx, ny, nz] of this.neighborCoords(x, y, z)) {
      if (!this.wasOriginalTerrain(nx, ny, nz)) return true;
      if (this.isDeleted(nx, ny, nz)) return true;
    }

    return false;
  }

  exposeNeighbors(x: number, y: number, z: number) {
    let exposedCount = 0;

    for (const [nx, ny, nz] of this.neighborCoords(x, y, z)) {
      if (this.hasVoxel(nx, ny, nz)) continue;
      if (!this.shouldBeExposed(nx, ny, nz)) continue;

      const originalData = this.getOriginalTerrain(nx, ny, nz);
      if (originalData && this.addVoxel(
        nx,
        ny,
        nz,
        originalData.material,
        originalData.color,
        undefined,
        {
          supportsSurfaceResources: false,
          blockId: originalData.blockId,
          deposit: originalData.deposit ?? null
        }
      )) {
        exposedCount++;
      }
    }

    return exposedCount;
  }

  getStats() {
    return {
      worldId: this.worldId,
      exposedVoxels: this.exposedVoxels.size,
      activeSlots: this.slotToCoord.size,
      editVersion: this.editVersion,
      maxSlots: this.maxSlots,
      memoryEfficiency: `${((this.exposedVoxels.size / this.maxSlots) * 100).toFixed(1)}%`
    };
  }

  getSnapshot() {
    return {
      worldId: this.worldId,
      exposedVoxels: this.exposedVoxels.size,
      originalTerrain: this.originalTerrain.size,
      deletedTerrain: this.deletedTerrain.size,
      activeSlots: this.slotToCoord.size,
      editVersion: this.editVersion,
      hasMesh: Boolean(this.mesh),
      hasCollisionCallbacks: Boolean(this.collisionCallbacks)
    };
  }

  private getAvailableSlot() {
    const compactSlot = this.slotToCoord.size;
    const meshCapacity = this.mesh?.instanceMatrix?.count ?? this.maxSlots;

    if (compactSlot < meshCapacity) {
      return compactSlot;
    }

    return -1;
  }

  private updateMeshSlot(slot: number, x: number, y: number, z: number, color: THREE.Color, material: string) {
    this.writeMeshSlot(slot, x, y, z, color, material);
    this.markMeshDirty();
  }

  private writeMeshSlot(slot: number, x: number, y: number, z: number, color: THREE.Color, material: string) {
    if (!this.mesh) return;

    tempMatrix.identity();
    tempMatrix.setPosition(voxelCoordToWorld(x, y, z, tempVector));
    this.mesh.setMatrixAt(slot, tempMatrix);
    this.mesh.setColorAt(slot, color);
    this.mesh.count = Math.max(this.mesh.count, slot + 1);

    if (this.instanceData) {
      // x = material id (consumed by the voxel shader's PBR LUT).
      // y = 6-bit face-occupancy mask -> per-corner baked AO in the vertex shader.
      this.instanceData.setXY(slot, materialId(material), this.computeFaceMask(x, y, z));
    }
  }

  private writeInitialMeshData(meshData: InitialTerrainMeshData, count: number) {
    if (!this.mesh) return;

    const matrixElements = count * 16;
    this.mesh.instanceMatrix.array.set(meshData.matrices.subarray(0, matrixElements), 0);

    const colorElements = count * 3;
    if (!this.mesh.instanceColor || this.mesh.instanceColor.count < this.mesh.instanceMatrix.count) {
      this.mesh.instanceColor = new THREE.InstancedBufferAttribute(
        new Float32Array(this.mesh.instanceMatrix.count * 3),
        3
      );
    }
    this.mesh.instanceColor.array.set(meshData.colors.subarray(0, colorElements), 0);

    if (this.instanceData) {
      const instanceDataElements = count * 2;
      this.instanceData.array.set(meshData.instanceData.subarray(0, instanceDataElements), 0);
    }

    this.mesh.count = count;
  }

  private markMeshDirty() {
    if (!this.mesh) return;
    this.invalidateMeshBounds();
    if (this.mesh.instanceMatrix) this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    if (this.instanceData) this.instanceData.needsUpdate = true;
  }

  private releaseMeshSlot(slot: number) {
    const highestSlot = this.slotToCoord.size - 1;
    const removedCoord = this.slotToCoord.get(slot);
    if (!removedCoord) return;

    if (slot !== highestSlot) {
      const movedCoord = this.slotToCoord.get(highestSlot);
      const movedVoxel = movedCoord ? this.exposedVoxels.get(movedCoord) : undefined;

      if (movedCoord && movedVoxel) {
        const [x, y, z] = movedVoxel.position;
        movedVoxel.meshSlot = slot;
        this.updateMeshSlot(slot, x, y, z, movedVoxel.color, movedVoxel.material);
        this.slotToCoord.set(slot, movedCoord);
      }
    }

    this.slotToCoord.delete(highestSlot);
    this.hideMeshSlot(highestSlot);

    if (this.mesh) {
      this.mesh.count = this.slotToCoord.size;
    }
  }

  private hideMeshSlot(slot: number) {
    if (!this.mesh) return;
    tempMatrix.identity();
    tempMatrix.setPosition(100000, 100000, 100000);
    this.mesh.setMatrixAt(slot, tempMatrix);
    this.invalidateMeshBounds();
    if (this.mesh.instanceMatrix) this.mesh.instanceMatrix.needsUpdate = true;
  }

  private invalidateMeshBounds() {
    if (!this.mesh) return;
    this.mesh.boundingBox = null;
    this.mesh.boundingSphere = null;
  }

  private neighborCoords(x: number, y: number, z: number): Array<[number, number, number]> {
    return [
      [x + 1, y, z],
      [x - 1, y, z],
      [x, y + 1, z],
      [x, y - 1, z],
      [x, y, z + 1],
      [x, y, z - 1]
    ];
  }

  // A cell occludes ambient light if it is filled: original (non-deleted) terrain
  // — including buried interior voxels — or a player-placed voxel.
  private isSolid(x: number, y: number, z: number) {
    const key = EfficientVoxelSystem.coordKey(x, y, z);
    if (this.originalTerrain.has(key) && !this.deletedTerrain.has(key)) return true;
    return this.exposedVoxels.has(key);
  }

  // Pack which of the 6 face-neighbours are solid into bits 0..5, matching
  // neighborCoords order (+x,-x,+y,-y,+z,-z). 0..63, exact in float32.
  private computeFaceMask(x: number, y: number, z: number) {
    const n = this.neighborCoords(x, y, z);
    let mask = 0;
    for (let i = 0; i < 6; i++) {
      const [nx, ny, nz] = n[i];
      if (this.isSolid(nx, ny, nz)) mask |= 1 << i;
    }
    return mask;
  }

  // After an edit the occupancy around (x,y,z) changed, so recompute the AO mask
  // of every exposed neighbour that already has a mesh slot.
  private refreshNeighborAO(x: number, y: number, z: number) {
    if (!this.instanceData) return;
    let dirty = false;
    for (const [nx, ny, nz] of this.neighborCoords(x, y, z)) {
      const neighbor = this.exposedVoxels.get(EfficientVoxelSystem.coordKey(nx, ny, nz));
      if (!neighbor) continue;
      this.instanceData.setY(neighbor.meshSlot, this.computeFaceMask(nx, ny, nz));
      dirty = true;
    }
    if (dirty) this.instanceData.needsUpdate = true;
  }
}

export const voxelSystem = new EfficientVoxelSystem(1000);
