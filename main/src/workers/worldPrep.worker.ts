import {
  buildPackedWorldPrepPayload,
  packedWorldPrepTransferList,
  type WorldPrepFailure,
  type WorldPrepRequest,
  type WorldPrepSuccess
} from '../utils/worldPrepProtocol.ts';

interface WorldPrepWorkerScope {
  onmessage: ((event: MessageEvent<WorldPrepRequest>) => void) | null;
  postMessage(message: WorldPrepSuccess | WorldPrepFailure, transfer?: Transferable[]): void;
}

const workerScope = globalThis as unknown as WorldPrepWorkerScope;

workerScope.onmessage = event => {
  const request = event.data;
  try {
    const payload = buildPackedWorldPrepPayload(request);
    workerScope.postMessage(
      { type: 'world_prep_result', payload },
      packedWorldPrepTransferList(payload)
    );
  } catch (error) {
    workerScope.postMessage({
      type: 'world_prep_error',
      requestId: typeof request?.requestId === 'string' ? request.requestId : null,
      worldId: typeof request?.worldId === 'string' ? request.worldId : null,
      activationEpoch: Number.isSafeInteger(request?.activationEpoch) ? request.activationEpoch : null,
      message: error instanceof Error ? error.message : 'Unknown world preparation error'
    });
  }
};
