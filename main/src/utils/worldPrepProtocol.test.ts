import { describe, expect, it } from 'vitest';
import { createPlanetIdentity } from '../game/starSystem.ts';
import { MaterialType } from '../types/materials.ts';
import {
  WORLD_PREP_PROTOCOL_VERSION,
  buildWorldPrepSemanticData,
  createWorldPrepRequest,
  isWorldPrepResultCurrent,
  packWorldPrepSemanticData,
  packedTransferByteSize,
  packedWorldPrepTransferList,
  semanticParityErrors,
  unpackWorldPrepPayload,
  validatePackedWorldPrepPayload,
  validateWorldPrepRequest,
  type PackedWorldPrepPayload,
  type WorldPrepRequest
} from './worldPrepProtocol.ts';
import {
  WorldPrepCancelledError,
  WorldPrepClient,
  WorldPrepStaleResultError,
  type WorldPrepWorkerLike
} from './worldPrepClient.ts';

describe('world prep protocol identity', () => {
  it('requires a canonical planet world ID, matching seed, size, version, and epoch', () => {
    const request = smallRequest(2);
    expect(() => validateWorldPrepRequest(request)).not.toThrow();
    expect(request.protocolVersion).toBe(WORLD_PREP_PROTOCOL_VERSION);

    expect(() => validateWorldPrepRequest({ ...request, worldId: '00,0:p1' })).toThrow(/not canonical/);
    expect(() => validateWorldPrepRequest({ ...request, seed: request.seed + 1 })).toThrow(/does not match/);
    expect(() => validateWorldPrepRequest({ ...request, activationEpoch: -1 })).toThrow(/activationEpoch/);
    expect(() => validateWorldPrepRequest({ ...request, protocolVersion: 99 as 1 })).toThrow(/protocol version/);
  });
});

describe('packed world preparation', () => {
  it('packs current generator semantics into transferable typed buffers', () => {
    const request = smallRequest(3);
    const semantic = buildWorldPrepSemanticData(request);
    const payload = packWorldPrepSemanticData(request, semantic);

    expect(payload.counts.voxels).toBeGreaterThan(0);
    expect(payload.counts.exposedVoxels).toBeGreaterThan(0);
    expect(payload.buffers.voxelPositions).toBeInstanceOf(Int16Array);
    expect(payload.buffers.exposedVoxelIndices).toBeInstanceOf(Uint32Array);
    expect(payload.buffers.waterFaceDirections).toBeInstanceOf(Uint8Array);
    expect(payload.buffers.arrivalCandidate).toHaveLength(3);
    expect(payload.transferByteSize).toBe(packedTransferByteSize(payload.buffers));
    expect(payload.byteSize).toBe(payload.transferByteSize + payload.metadataByteSize);
    expect(packedWorldPrepTransferList(payload).every(buffer => buffer instanceof ArrayBuffer)).toBe(true);
    expect(new Set(packedWorldPrepTransferList(payload)).size).toBe(packedWorldPrepTransferList(payload).length);
    expect(() => validatePackedWorldPrepPayload(payload)).not.toThrow();
  });

  it('unpacks with semantic parity, including identities, water, and arrival', () => {
    const request = smallRequest(4);
    const semantic = buildWorldPrepSemanticData(request);
    const payload = packWorldPrepSemanticData(request, semantic);
    const unpacked = unpackWorldPrepPayload(payload);

    expect(semanticParityErrors(payload, semantic)).toEqual([]);
    expect(unpacked.exposedVoxelIndices).toEqual(semantic.exposedVoxelIndices);
    expect(unpacked.waterVoxels).toEqual(semantic.waterVoxels);
    expect(unpacked.waterCells).toEqual(semantic.waterCells);
    expect(unpacked.waterFaces).toEqual(semantic.waterFaces);
    expect(unpacked.arrivalCandidate).toEqual(semantic.arrivalCandidate);
    expect(unpacked.voxels.map(voxel => voxel.blockId)).toEqual(semantic.voxels.map(voxel => voxel.blockId));
  });

  it('produces deterministic hashes and rejects content corruption', () => {
    const request = smallRequest(5);
    const semantic = buildWorldPrepSemanticData(request);
    const first = packWorldPrepSemanticData(request, semantic);
    const second = packWorldPrepSemanticData(request, semantic);
    expect(first.hash).toBe(second.hash);
    expect(first.byteSize).toBe(second.byteSize);

    second.buffers.blockIds[0] ^= 1;
    expect(() => validatePackedWorldPrepPayload(second)).toThrow(/hash differs/);
  });

  it('rejects results from a stale activation epoch or different canonical world', () => {
    const request = smallRequest(8);
    const payload = packWorldPrepSemanticData(request, buildWorldPrepSemanticData(request));
    expect(isWorldPrepResultCurrent(payload, request)).toBe(true);
    expect(isWorldPrepResultCurrent(payload, { worldId: request.worldId, activationEpoch: 9 })).toBe(false);
    expect(isWorldPrepResultCurrent(payload, { worldId: '0,0', activationEpoch: 8 })).toBe(false);
  });
});

describe('world prep client cancellation', () => {
  it('terminates a monolithic worker when superseded and accepts only the new lease', async () => {
    const workers: FakeWorker[] = [];
    const client = new WorldPrepClient(() => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    });
    const firstRequest = smallRequest(11, 'first');
    const secondRequest = smallRequest(12, 'second');
    const firstPromise = client.prepare(firstRequest);
    const firstRejection = expect(firstPromise).rejects.toBeInstanceOf(WorldPrepCancelledError);
    const secondPromise = client.prepare(secondRequest);

    await firstRejection;
    expect(workers[0].terminated).toBe(true);
    const secondPayload = tinyPayload(secondRequest);
    workers[1].respond({ type: 'world_prep_result', payload: secondPayload });
    await expect(secondPromise).resolves.toBe(secondPayload);
    expect(workers[1].terminated).toBe(true);
  });

  it('rejects a response whose worker payload carries a stale epoch', async () => {
    let worker: FakeWorker | null = null;
    const client = new WorldPrepClient(() => (worker = new FakeWorker()));
    const request = smallRequest(20);
    const promise = client.prepare(request);
    worker!.respond({
      type: 'world_prep_result',
      payload: tinyPayload({ ...request, activationEpoch: request.activationEpoch - 1 })
    });
    await expect(promise).rejects.toBeInstanceOf(WorldPrepStaleResultError);
  });
});

function smallRequest(activationEpoch: number, requestId = `request-${activationEpoch}`): WorldPrepRequest {
  const identity = createPlanetIdentity({ system: { x: 0, y: 0 }, slot: 1 });
  return createWorldPrepRequest({
    requestId,
    worldId: identity.worldId,
    seed: identity.seed,
    planetSize: 8,
    activationEpoch
  });
}

function tinyPayload(request: WorldPrepRequest): PackedWorldPrepPayload {
  return packWorldPrepSemanticData(request, {
    voxels: [{
      position: [0, 0, 0],
      blockId: 'stone',
      material: MaterialType.STONE,
      colorId: MaterialType.STONE,
      deposit: null
    }],
    exposedVoxelIndices: [0],
    waterVoxels: [],
    waterCells: [],
    waterFaces: [],
    arrivalCandidate: [0, 0, 0]
  });
}

class FakeWorker implements WorldPrepWorkerLike {
  onmessage: ((event: MessageEvent<import('./worldPrepProtocol.ts').WorldPrepWorkerResponse>) => void) | null = null;
  onerror: Worker['onerror'] = null;
  terminated = false;
  posted: WorldPrepRequest[] = [];

  postMessage(message: WorldPrepRequest): void {
    this.posted.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  respond(response: import('./worldPrepProtocol.ts').WorldPrepWorkerResponse): void {
    this.onmessage?.({ data: response } as MessageEvent<import('./worldPrepProtocol.ts').WorldPrepWorkerResponse>);
  }
}
