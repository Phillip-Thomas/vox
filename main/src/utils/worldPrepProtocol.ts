import { blockToRenderMaterial } from '../game/adapters.ts';
import { ALL_BLOCK_IDS, type BlockId } from '../game/data/blocks.ts';
import { ALL_RESOURCE_IDS, type ResourceId } from '../game/data/resources.ts';
import type { ResourceDeposit } from '../game/generation/resourceDeposits.ts';
import { resolvePlanetProfile } from '../game/PlanetProfile.ts';
import { parsePlanetWorldId, planetSeedForAddress } from '../game/starSystem.ts';
import { MATERIAL_ORDER, type MaterialType } from '../types/materials.ts';
import { createResolvedWorldGenerator } from './resolvedWorldGenerator.ts';

export const WORLD_PREP_PROTOCOL_VERSION = 2;
export const MAX_WORLD_PREP_PLANET_SIZE = 4_096;

export type PackedCoordinate = [number, number, number];

export interface WorldPrepRequest {
  type: 'prepare_world';
  protocolVersion: typeof WORLD_PREP_PROTOCOL_VERSION;
  requestId: string;
  worldId: string;
  seed: number;
  profileId: string;
  profileVersion: number;
  profileHash: string;
  planetSize: number;
  activationEpoch: number;
}

export interface WorldPrepLookupTables {
  blocks: BlockId[];
  materials: MaterialType[];
  /** Color IDs deliberately resolve through the stable material palette. */
  colors: MaterialType[];
  resources: ResourceId[];
}

export interface WorldPrepCounts {
  voxels: number;
  exposedVoxels: number;
  waterVoxels: number;
  waterCells: number;
  waterFaces: number;
}

export interface PackedWorldPrepBuffers {
  voxelPositions: Int16Array;
  blockIds: Uint8Array;
  materialIds: Uint8Array;
  colorIds: Uint8Array;
  depositResourceIds: Uint8Array;
  depositRichness: Float32Array;
  depositScanLevels: Uint8Array;
  exposedVoxelIndices: Uint32Array;
  exposedPositions: Int16Array;
  waterVoxelPositions: Int16Array;
  waterVoxelTopFlags: Uint8Array;
  waterCellPositions: Int16Array;
  waterFacePositions: Int16Array;
  waterFaceDirections: Uint8Array;
  arrivalCandidate: Int16Array;
}

export interface PackedWorldPrepPayload {
  protocolVersion: typeof WORLD_PREP_PROTOCOL_VERSION;
  requestId: string;
  worldId: string;
  seed: number;
  profileId: string;
  profileVersion: number;
  profileHash: string;
  planetSize: number;
  activationEpoch: number;
  lookups: WorldPrepLookupTables;
  counts: WorldPrepCounts;
  buffers: PackedWorldPrepBuffers;
  /** Exact bytes owned by transferable typed-array buffers. */
  transferByteSize: number;
  /** Canonical scalar/lookup metadata bytes used by hashing and budget reports. */
  metadataByteSize: number;
  /** Exact canonical packed content bytes, excluding structured-clone envelope overhead. */
  byteSize: number;
  /** FNV-1a over canonical metadata and every packed buffer in fixed order. */
  hash: string;
}

export interface WorldPrepSuccess {
  type: 'world_prep_result';
  payload: PackedWorldPrepPayload;
}

export interface WorldPrepFailure {
  type: 'world_prep_error';
  requestId: string | null;
  worldId: string | null;
  activationEpoch: number | null;
  message: string;
}

export type WorldPrepWorkerResponse = WorldPrepSuccess | WorldPrepFailure;

export interface WorldPrepSemanticVoxel {
  position: PackedCoordinate;
  blockId: BlockId;
  material: MaterialType;
  colorId: MaterialType;
  deposit: ResourceDeposit | null;
}

export interface WorldPrepSemanticWaterVoxel {
  position: PackedCoordinate;
  isTopSurface: boolean;
}

export interface WorldPrepSemanticWaterFace {
  position: PackedCoordinate;
  faceDir: number;
}

/** Worker-local object form. It is packed before crossing the worker boundary. */
export interface WorldPrepSemanticData {
  voxels: WorldPrepSemanticVoxel[];
  exposedVoxelIndices: number[];
  waterVoxels: WorldPrepSemanticWaterVoxel[];
  /** Full flooded set, including interior cells needed for live dig faces. */
  waterCells: PackedCoordinate[];
  waterFaces: WorldPrepSemanticWaterFace[];
  arrivalCandidate: PackedCoordinate;
}

export interface WorldPrepResultLease {
  worldId: string;
  activationEpoch: number;
  profileHash: string;
}

const BLOCK_LOOKUP = Object.freeze([...ALL_BLOCK_IDS]);
const MATERIAL_LOOKUP = Object.freeze([...MATERIAL_ORDER]);
const RESOURCE_LOOKUP = Object.freeze([...ALL_RESOURCE_IDS]);
const BLOCK_INDEX = new Map<BlockId, number>(BLOCK_LOOKUP.map((id, index) => [id, index]));
const MATERIAL_INDEX = new Map<MaterialType, number>(MATERIAL_LOOKUP.map((id, index) => [id, index]));
const RESOURCE_INDEX = new Map<ResourceId, number>(RESOURCE_LOOKUP.map((id, index) => [id, index]));

const BUFFER_KEYS: ReadonlyArray<keyof PackedWorldPrepBuffers> = [
  'voxelPositions',
  'blockIds',
  'materialIds',
  'colorIds',
  'depositResourceIds',
  'depositRichness',
  'depositScanLevels',
  'exposedVoxelIndices',
  'exposedPositions',
  'waterVoxelPositions',
  'waterVoxelTopFlags',
  'waterCellPositions',
  'waterFacePositions',
  'waterFaceDirections',
  'arrivalCandidate'
];

export function createWorldPrepRequest(input: Omit<
  WorldPrepRequest,
  'type' | 'protocolVersion' | 'profileId' | 'profileVersion' | 'profileHash'
>): WorldPrepRequest {
  const resolution = resolvePlanetProfile({ worldId: input.worldId, seed: input.seed });
  const request: WorldPrepRequest = {
    type: 'prepare_world',
    protocolVersion: WORLD_PREP_PROTOCOL_VERSION,
    ...input,
    profileId: resolution.profileId,
    profileVersion: resolution.profileVersion,
    profileHash: resolution.profileHash
  };
  validateWorldPrepRequest(request);
  return request;
}

export function validateWorldPrepRequest(request: WorldPrepRequest): void {
  if (request.type !== 'prepare_world') throw new Error('unsupported world prep request type');
  if (request.protocolVersion !== WORLD_PREP_PROTOCOL_VERSION) {
    throw new Error(`unsupported world prep protocol version: ${request.protocolVersion}`);
  }
  if (!request.requestId) throw new Error('requestId must be non-empty');
  const address = parsePlanetWorldId(request.worldId);
  if (!address) throw new Error(`worldId is not canonical: ${request.worldId}`);
  const canonicalWorldId = address.slot === 0
    ? `${address.system.x},${address.system.y}`
    : `${address.system.x},${address.system.y}:p${address.slot}`;
  if (request.worldId !== canonicalWorldId) {
    throw new Error(`worldId is not canonical: ${request.worldId}`);
  }
  if (!Number.isSafeInteger(request.seed) || request.seed <= 0 || request.seed > 0xffff_ffff) {
    throw new RangeError('seed must be a non-zero uint32');
  }
  const expectedSeed = planetSeedForAddress(address);
  if (request.seed !== expectedSeed) {
    throw new Error(`seed ${request.seed} does not match canonical world ${request.worldId}`);
  }
  const resolution = resolvePlanetProfile({ worldId: request.worldId, seed: request.seed });
  if (request.profileId !== resolution.profileId) {
    throw new Error(`profileId differs for canonical world ${request.worldId}`);
  }
  if (request.profileVersion !== resolution.profileVersion) {
    throw new Error(`profileVersion differs for canonical world ${request.worldId}`);
  }
  if (request.profileHash !== resolution.profileHash) {
    throw new Error(`profileHash differs for canonical world ${request.worldId}`);
  }
  if (
    !Number.isSafeInteger(request.planetSize)
    || request.planetSize <= 0
    || request.planetSize > MAX_WORLD_PREP_PLANET_SIZE
  ) {
    throw new RangeError(`planetSize must be an integer in [1, ${MAX_WORLD_PREP_PLANET_SIZE}]`);
  }
  if (!Number.isSafeInteger(request.activationEpoch) || request.activationEpoch < 0) {
    throw new RangeError('activationEpoch must be a non-negative safe integer');
  }
}

/** Builds the current generator's semantic data. Intended to run inside the worker. */
export function buildWorldPrepSemanticData(request: WorldPrepRequest): WorldPrepSemanticData {
  validateWorldPrepRequest(request);
  const planetRadius = request.planetSize / 2;
  const { generator } = createResolvedWorldGenerator({
    worldId: request.worldId,
    seed: request.seed,
    planetRadius
  });
  const positions = generator.getAllVoxelPositions();
  const occupied = new Set(positions.map(position => coordinateKey(position.x, position.y, position.z)));
  const voxels = positions.map(position => {
    const blockId = generator.generateBlockForPosition(position.x, position.y, position.z);
    const material = blockToRenderMaterial(blockId);
    return {
      position: [position.x, position.y, position.z] as PackedCoordinate,
      blockId,
      material,
      colorId: material,
      deposit: generator.generateDepositForPosition(position.x, position.y, position.z)
    };
  });
  const exposedVoxelIndices: number[] = [];
  for (let index = 0; index < positions.length; index++) {
    const { x, y, z } = positions[index];
    if (
      !occupied.has(coordinateKey(x + 1, y, z))
      || !occupied.has(coordinateKey(x - 1, y, z))
      || !occupied.has(coordinateKey(x, y + 1, z))
      || !occupied.has(coordinateKey(x, y - 1, z))
      || !occupied.has(coordinateKey(x, y, z + 1))
      || !occupied.has(coordinateKey(x, y, z - 1))
    ) {
      exposedVoxelIndices.push(index);
    }
  }
  const waterVoxels = generator.getExposedWaterVoxels().map(voxel => ({
    position: [voxel.x, voxel.y, voxel.z] as PackedCoordinate,
    isTopSurface: voxel.isTopSurface
  }));
  const waterCells: PackedCoordinate[] = [];
  const waterExtent = Math.floor(request.planetSize / 2) + 6;
  for (let x = -waterExtent; x <= waterExtent; x++) {
    for (let y = -waterExtent; y <= waterExtent; y++) {
      for (let z = -waterExtent; z <= waterExtent; z++) {
        if (generator.isWaterVoxel(x, y, z)) waterCells.push([x, y, z]);
      }
    }
  }
  const waterFaces = generator.getExposedWaterFaces().map(face => ({
    position: [face.x, face.y, face.z] as PackedCoordinate,
    faceDir: face.faceDir
  }));

  return {
    voxels,
    exposedVoxelIndices,
    waterVoxels,
    waterCells,
    waterFaces,
    arrivalCandidate: findArrivalCandidate(positions)
  };
}

export function buildPackedWorldPrepPayload(request: WorldPrepRequest): PackedWorldPrepPayload {
  return packWorldPrepSemanticData(request, buildWorldPrepSemanticData(request));
}

/** Pure semantic-data packer used by both the worker and parity tests. */
export function packWorldPrepSemanticData(
  request: WorldPrepRequest,
  semantic: WorldPrepSemanticData
): PackedWorldPrepPayload {
  validateWorldPrepRequest(request);
  validateSemanticData(semantic);
  const voxelCount = semantic.voxels.length;
  const exposedCount = semantic.exposedVoxelIndices.length;
  const waterVoxelCount = semantic.waterVoxels.length;
  const waterCellCount = semantic.waterCells.length;
  const waterFaceCount = semantic.waterFaces.length;
  const buffers: PackedWorldPrepBuffers = {
    voxelPositions: new Int16Array(voxelCount * 3),
    blockIds: new Uint8Array(voxelCount),
    materialIds: new Uint8Array(voxelCount),
    colorIds: new Uint8Array(voxelCount),
    depositResourceIds: new Uint8Array(voxelCount),
    depositRichness: new Float32Array(voxelCount),
    depositScanLevels: new Uint8Array(voxelCount),
    exposedVoxelIndices: Uint32Array.from(semantic.exposedVoxelIndices),
    exposedPositions: new Int16Array(exposedCount * 3),
    waterVoxelPositions: new Int16Array(waterVoxelCount * 3),
    waterVoxelTopFlags: new Uint8Array(waterVoxelCount),
    waterCellPositions: new Int16Array(waterCellCount * 3),
    waterFacePositions: new Int16Array(waterFaceCount * 3),
    waterFaceDirections: new Uint8Array(waterFaceCount),
    arrivalCandidate: Int16Array.from(semantic.arrivalCandidate)
  };

  semantic.voxels.forEach((voxel, index) => {
    writeCoordinate(buffers.voxelPositions, index, voxel.position);
    buffers.blockIds[index] = requiredLookupIndex(BLOCK_INDEX, voxel.blockId, 'block');
    buffers.materialIds[index] = requiredLookupIndex(MATERIAL_INDEX, voxel.material, 'material');
    buffers.colorIds[index] = requiredLookupIndex(MATERIAL_INDEX, voxel.colorId, 'color');
    if (voxel.deposit) {
      buffers.depositResourceIds[index] = requiredLookupIndex(
        RESOURCE_INDEX,
        voxel.deposit.resourceId,
        'resource'
      ) + 1;
      buffers.depositRichness[index] = voxel.deposit.richness;
      buffers.depositScanLevels[index] = voxel.deposit.scanLevel;
    }
  });
  semantic.exposedVoxelIndices.forEach((voxelIndex, exposedIndex) => {
    writeCoordinate(buffers.exposedPositions, exposedIndex, semantic.voxels[voxelIndex].position);
  });
  semantic.waterVoxels.forEach((voxel, index) => {
    writeCoordinate(buffers.waterVoxelPositions, index, voxel.position);
    buffers.waterVoxelTopFlags[index] = voxel.isTopSurface ? 1 : 0;
  });
  semantic.waterCells.forEach((position, index) => {
    writeCoordinate(buffers.waterCellPositions, index, position);
  });
  semantic.waterFaces.forEach((face, index) => {
    writeCoordinate(buffers.waterFacePositions, index, face.position);
    buffers.waterFaceDirections[index] = face.faceDir;
  });

  const lookups: WorldPrepLookupTables = {
    blocks: [...BLOCK_LOOKUP],
    materials: [...MATERIAL_LOOKUP],
    colors: [...MATERIAL_LOOKUP],
    resources: [...RESOURCE_LOOKUP]
  };
  const counts: WorldPrepCounts = {
    voxels: voxelCount,
    exposedVoxels: exposedCount,
    waterVoxels: waterVoxelCount,
    waterCells: waterCellCount,
    waterFaces: waterFaceCount
  };
  const metadata = canonicalMetadata(request, lookups, counts);
  const metadataBytes = new TextEncoder().encode(metadata);
  const transferByteSize = packedTransferByteSize(buffers);
  const hash = hashPackedContent(metadataBytes, buffers);

  return {
    protocolVersion: WORLD_PREP_PROTOCOL_VERSION,
    requestId: request.requestId,
    worldId: request.worldId,
    seed: request.seed,
    profileId: request.profileId,
    profileVersion: request.profileVersion,
    profileHash: request.profileHash,
    planetSize: request.planetSize,
    activationEpoch: request.activationEpoch,
    lookups,
    counts,
    buffers,
    transferByteSize,
    metadataByteSize: metadataBytes.byteLength,
    byteSize: transferByteSize + metadataBytes.byteLength,
    hash
  };
}

/** Diagnostic/test unpacker. Runtime hydration should consume packed arrays directly. */
export function unpackWorldPrepPayload(payload: PackedWorldPrepPayload): WorldPrepSemanticData {
  validatePackedWorldPrepPayload(payload);
  const voxels: WorldPrepSemanticVoxel[] = [];
  for (let index = 0; index < payload.counts.voxels; index++) {
    const resourceCode = payload.buffers.depositResourceIds[index];
    const deposit = resourceCode === 0
      ? null
      : {
        resourceId: requiredLookupValue(payload.lookups.resources, resourceCode - 1, 'resource'),
        richness: payload.buffers.depositRichness[index],
        scanLevel: payload.buffers.depositScanLevels[index]
      };
    voxels.push({
      position: readCoordinate(payload.buffers.voxelPositions, index),
      blockId: requiredLookupValue(payload.lookups.blocks, payload.buffers.blockIds[index], 'block'),
      material: requiredLookupValue(payload.lookups.materials, payload.buffers.materialIds[index], 'material'),
      colorId: requiredLookupValue(payload.lookups.colors, payload.buffers.colorIds[index], 'color'),
      deposit
    });
  }

  return {
    voxels,
    exposedVoxelIndices: Array.from(payload.buffers.exposedVoxelIndices),
    waterVoxels: Array.from({ length: payload.counts.waterVoxels }, (_, index) => ({
      position: readCoordinate(payload.buffers.waterVoxelPositions, index),
      isTopSurface: payload.buffers.waterVoxelTopFlags[index] !== 0
    })),
    waterCells: Array.from(
      { length: payload.counts.waterCells },
      (_, index) => readCoordinate(payload.buffers.waterCellPositions, index)
    ),
    waterFaces: Array.from({ length: payload.counts.waterFaces }, (_, index) => ({
      position: readCoordinate(payload.buffers.waterFacePositions, index),
      faceDir: payload.buffers.waterFaceDirections[index]
    })),
    arrivalCandidate: readCoordinate(payload.buffers.arrivalCandidate, 0)
  };
}

export function semanticParityErrors(
  payload: PackedWorldPrepPayload,
  expected: WorldPrepSemanticData,
  floatTolerance = 1e-6
): string[] {
  const actual = unpackWorldPrepPayload(payload);
  const errors: string[] = [];
  if (actual.voxels.length !== expected.voxels.length) errors.push('voxel count differs');
  if (actual.exposedVoxelIndices.length !== expected.exposedVoxelIndices.length) errors.push('exposed count differs');
  if (actual.waterVoxels.length !== expected.waterVoxels.length) errors.push('water voxel count differs');
  if (actual.waterCells.length !== expected.waterCells.length) errors.push('water cell count differs');
  if (actual.waterFaces.length !== expected.waterFaces.length) errors.push('water face count differs');
  if (!sameCoordinate(actual.arrivalCandidate, expected.arrivalCandidate)) errors.push('arrival candidate differs');

  const voxelCount = Math.min(actual.voxels.length, expected.voxels.length);
  for (let index = 0; index < voxelCount; index++) {
    const a = actual.voxels[index];
    const b = expected.voxels[index];
    if (
      !sameCoordinate(a.position, b.position)
      || a.blockId !== b.blockId
      || a.material !== b.material
      || a.colorId !== b.colorId
      || a.deposit?.resourceId !== b.deposit?.resourceId
      || a.deposit?.scanLevel !== b.deposit?.scanLevel
      || Math.abs((a.deposit?.richness ?? 0) - (b.deposit?.richness ?? 0)) > floatTolerance
    ) {
      errors.push(`voxel ${index} differs`);
      break;
    }
  }
  if (!sameNumberArray(actual.exposedVoxelIndices, expected.exposedVoxelIndices)) {
    errors.push('exposed indices differ');
  }
  if (!sameWaterVoxels(actual.waterVoxels, expected.waterVoxels)) errors.push('water voxels differ');
  if (!sameCoordinateList(actual.waterCells, expected.waterCells)) errors.push('water cells differ');
  if (!sameWaterFaces(actual.waterFaces, expected.waterFaces)) errors.push('water faces differ');
  return errors;
}

export function validatePackedWorldPrepPayload(payload: PackedWorldPrepPayload): void {
  if (payload.protocolVersion !== WORLD_PREP_PROTOCOL_VERSION) throw new Error('packed protocol version differs');
  const request = createWorldPrepRequest({
    requestId: payload.requestId,
    worldId: payload.worldId,
    seed: payload.seed,
    planetSize: payload.planetSize,
    activationEpoch: payload.activationEpoch
  });
  if (payload.profileId !== request.profileId) throw new Error('packed profileId differs');
  if (payload.profileVersion !== request.profileVersion) throw new Error('packed profileVersion differs');
  if (payload.profileHash !== request.profileHash) throw new Error('packed profileHash differs');
  const counts = payload.counts;
  assertBufferLength(payload.buffers.voxelPositions, counts.voxels * 3, 'voxelPositions');
  assertBufferLength(payload.buffers.blockIds, counts.voxels, 'blockIds');
  assertBufferLength(payload.buffers.materialIds, counts.voxels, 'materialIds');
  assertBufferLength(payload.buffers.colorIds, counts.voxels, 'colorIds');
  assertBufferLength(payload.buffers.depositResourceIds, counts.voxels, 'depositResourceIds');
  assertBufferLength(payload.buffers.depositRichness, counts.voxels, 'depositRichness');
  assertBufferLength(payload.buffers.depositScanLevels, counts.voxels, 'depositScanLevels');
  assertBufferLength(payload.buffers.exposedVoxelIndices, counts.exposedVoxels, 'exposedVoxelIndices');
  assertBufferLength(payload.buffers.exposedPositions, counts.exposedVoxels * 3, 'exposedPositions');
  assertBufferLength(payload.buffers.waterVoxelPositions, counts.waterVoxels * 3, 'waterVoxelPositions');
  assertBufferLength(payload.buffers.waterVoxelTopFlags, counts.waterVoxels, 'waterVoxelTopFlags');
  assertBufferLength(payload.buffers.waterCellPositions, counts.waterCells * 3, 'waterCellPositions');
  assertBufferLength(payload.buffers.waterFacePositions, counts.waterFaces * 3, 'waterFacePositions');
  assertBufferLength(payload.buffers.waterFaceDirections, counts.waterFaces, 'waterFaceDirections');
  assertBufferLength(payload.buffers.arrivalCandidate, 3, 'arrivalCandidate');

  const metadataBytes = new TextEncoder().encode(canonicalMetadata(request, payload.lookups, counts));
  const transferByteSize = packedTransferByteSize(payload.buffers);
  if (payload.transferByteSize !== transferByteSize) throw new Error('transferByteSize differs');
  if (payload.metadataByteSize !== metadataBytes.byteLength) throw new Error('metadataByteSize differs');
  if (payload.byteSize !== transferByteSize + metadataBytes.byteLength) throw new Error('byteSize differs');
  if (payload.hash !== hashPackedContent(metadataBytes, payload.buffers)) throw new Error('packed hash differs');
}

export function packedWorldPrepTransferList(payload: PackedWorldPrepPayload): ArrayBuffer[] {
  return BUFFER_KEYS.map(key => payload.buffers[key].buffer as ArrayBuffer);
}

export function packedTransferByteSize(buffers: PackedWorldPrepBuffers): number {
  return BUFFER_KEYS.reduce((total, key) => total + buffers[key].byteLength, 0);
}

export function isWorldPrepResultCurrent(
  payload: Pick<PackedWorldPrepPayload, 'worldId' | 'activationEpoch' | 'profileHash'>,
  lease: WorldPrepResultLease
): boolean {
  return payload.worldId === lease.worldId
    && payload.activationEpoch === lease.activationEpoch
    && payload.profileHash === lease.profileHash;
}

function findArrivalCandidate(
  positions: ReadonlyArray<{ x: number; y: number; z: number }>,
  preferred = { x: 4, z: -4 }
): PackedCoordinate {
  const topByColumn = new Map<string, PackedCoordinate>();
  for (const voxel of positions) {
    if (voxel.y < 0) continue;
    const key = `${voxel.x},${voxel.z}`;
    const current = topByColumn.get(key);
    if (!current || voxel.y > current[1]) topByColumn.set(key, [voxel.x, voxel.y, voxel.z]);
  }
  let best: PackedCoordinate | null = null;
  let bestDistanceSq = Number.POSITIVE_INFINITY;
  for (const voxel of topByColumn.values()) {
    const dx = voxel[0] - preferred.x;
    const dz = voxel[2] - preferred.z;
    const distanceSq = dx * dx + dz * dz;
    if (distanceSq < bestDistanceSq || (distanceSq === bestDistanceSq && best && voxel[1] > best[1])) {
      best = voxel;
      bestDistanceSq = distanceSq;
    }
  }
  return best ?? [0, 0, 0];
}

function canonicalMetadata(
  request: WorldPrepRequest,
  lookups: WorldPrepLookupTables,
  counts: WorldPrepCounts
): string {
  return JSON.stringify({
    protocolVersion: WORLD_PREP_PROTOCOL_VERSION,
    requestId: request.requestId,
    worldId: request.worldId,
    seed: request.seed,
    profileId: request.profileId,
    profileVersion: request.profileVersion,
    profileHash: request.profileHash,
    planetSize: request.planetSize,
    activationEpoch: request.activationEpoch,
    lookups,
    counts
  });
}

function hashPackedContent(metadata: Uint8Array, buffers: PackedWorldPrepBuffers): string {
  let hash = 2166136261;
  hash = fnvBytes(hash, metadata);
  for (const key of BUFFER_KEYS) {
    hash = fnvBytes(
      hash,
      new Uint8Array(buffers[key].buffer, buffers[key].byteOffset, buffers[key].byteLength)
    );
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function fnvBytes(initial: number, bytes: Uint8Array): number {
  let hash = initial;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function validateSemanticData(semantic: WorldPrepSemanticData): void {
  semantic.voxels.forEach(voxel => {
    validateCoordinate(voxel.position);
    if (!BLOCK_INDEX.has(voxel.blockId)) throw new Error(`unknown block: ${voxel.blockId}`);
    if (!MATERIAL_INDEX.has(voxel.material)) throw new Error(`unknown material: ${voxel.material}`);
    if (!MATERIAL_INDEX.has(voxel.colorId)) throw new Error(`unknown color id: ${voxel.colorId}`);
    if (voxel.deposit) {
      if (!RESOURCE_INDEX.has(voxel.deposit.resourceId)) throw new Error(`unknown resource: ${voxel.deposit.resourceId}`);
      if (!Number.isFinite(voxel.deposit.richness)) throw new Error('deposit richness must be finite');
      if (!Number.isInteger(voxel.deposit.scanLevel) || voxel.deposit.scanLevel < 0 || voxel.deposit.scanLevel > 255) {
        throw new Error('deposit scanLevel must fit uint8');
      }
    }
  });
  for (const index of semantic.exposedVoxelIndices) {
    if (!Number.isSafeInteger(index) || index < 0 || index >= semantic.voxels.length) {
      throw new Error(`invalid exposed voxel index: ${index}`);
    }
  }
  semantic.waterVoxels.forEach(voxel => validateCoordinate(voxel.position));
  semantic.waterCells.forEach(validateCoordinate);
  semantic.waterFaces.forEach(face => {
    validateCoordinate(face.position);
    if (!Number.isInteger(face.faceDir) || face.faceDir < 0 || face.faceDir > 5) {
      throw new Error(`invalid water face direction: ${face.faceDir}`);
    }
  });
  validateCoordinate(semantic.arrivalCandidate);
}

function validateCoordinate(coordinate: PackedCoordinate): void {
  if (coordinate.length !== 3 || coordinate.some(value => !Number.isInteger(value) || value < -32768 || value > 32767)) {
    throw new RangeError('packed coordinate must contain three signed int16 values');
  }
}

function writeCoordinate(target: Int16Array, index: number, coordinate: PackedCoordinate): void {
  target[index * 3] = coordinate[0];
  target[index * 3 + 1] = coordinate[1];
  target[index * 3 + 2] = coordinate[2];
}

function readCoordinate(source: Int16Array, index: number): PackedCoordinate {
  return [source[index * 3], source[index * 3 + 1], source[index * 3 + 2]];
}

function requiredLookupIndex<T>(lookup: ReadonlyMap<T, number>, value: T, label: string): number {
  const index = lookup.get(value);
  if (index === undefined || index > 254) throw new Error(`${label} lookup overflow or missing value`);
  return index;
}

function requiredLookupValue<T>(lookup: readonly T[], index: number, label: string): T {
  const value = lookup[index];
  if (value === undefined) throw new Error(`${label} lookup index out of bounds: ${index}`);
  return value;
}

function assertBufferLength(buffer: ArrayLike<number>, expected: number, label: string): void {
  if (buffer.length !== expected) throw new Error(`${label} length ${buffer.length} differs from ${expected}`);
}

function coordinateKey(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

function sameCoordinate(a: PackedCoordinate, b: PackedCoordinate): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

function sameNumberArray(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function sameWaterVoxels(a: readonly WorldPrepSemanticWaterVoxel[], b: readonly WorldPrepSemanticWaterVoxel[]): boolean {
  return a.length === b.length && a.every((voxel, index) => (
    sameCoordinate(voxel.position, b[index].position) && voxel.isTopSurface === b[index].isTopSurface
  ));
}

function sameCoordinateList(a: readonly PackedCoordinate[], b: readonly PackedCoordinate[]): boolean {
  return a.length === b.length && a.every((coordinate, index) => sameCoordinate(coordinate, b[index]));
}

function sameWaterFaces(a: readonly WorldPrepSemanticWaterFace[], b: readonly WorldPrepSemanticWaterFace[]): boolean {
  return a.length === b.length && a.every((face, index) => (
    sameCoordinate(face.position, b[index].position) && face.faceDir === b[index].faceDir
  ));
}
