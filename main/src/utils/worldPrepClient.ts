import {
  isWorldPrepResultCurrent,
  type PackedWorldPrepPayload,
  type WorldPrepRequest,
  type WorldPrepWorkerResponse
} from './worldPrepProtocol.ts';

export interface WorldPrepWorkerLike {
  onmessage: ((event: MessageEvent<WorldPrepWorkerResponse>) => void) | null;
  onerror: Worker['onerror'];
  postMessage(message: WorldPrepRequest): void;
  terminate(): void;
}

export type WorldPrepWorkerFactory = () => WorldPrepWorkerLike;

export class WorldPrepCancelledError extends Error {
  constructor(message = 'World preparation was cancelled') {
    super(message);
    this.name = 'WorldPrepCancelledError';
  }
}

export class WorldPrepStaleResultError extends Error {
  constructor(message = 'World preparation result did not match the active lease') {
    super(message);
    this.name = 'WorldPrepStaleResultError';
  }
}

interface PendingPreparation {
  generation: number;
  request: WorldPrepRequest;
  reject: (reason: Error) => void;
}

/**
 * Single-job client. Cancellation always terminates the monolithic worker and a
 * later request creates a fresh worker; no in-band cancel message can be starved
 * behind the generator scan.
 */
export class WorldPrepClient {
  private worker: WorldPrepWorkerLike | null = null;
  private pending: PendingPreparation | null = null;
  private generation = 0;

  constructor(private readonly workerFactory: WorldPrepWorkerFactory = defaultWorkerFactory) {}

  prepare(request: WorldPrepRequest): Promise<PackedWorldPrepPayload> {
    this.cancel('World preparation was superseded');
    const generation = ++this.generation;
    const worker = this.workerFactory();
    this.worker = worker;

    return new Promise((resolve, reject) => {
      this.pending = { generation, request, reject };
      worker.onmessage = event => {
        if (!this.pending || this.pending.generation !== generation) return;
        const response = event.data;
        if (response.type === 'world_prep_error') {
          this.finishWorker(worker);
          reject(new Error(response.message));
          return;
        }
        if (!isWorldPrepResultCurrent(response.payload, request)) {
          this.finishWorker(worker);
          reject(new WorldPrepStaleResultError());
          return;
        }
        this.finishWorker(worker);
        resolve(response.payload);
      };
      worker.onerror = event => {
        if (!this.pending || this.pending.generation !== generation) return;
        this.finishWorker(worker);
        reject(new Error(event.message ?? 'World preparation worker failed'));
      };
      worker.postMessage(request);
    });
  }

  cancel(message?: string): void {
    this.generation++;
    const pending = this.pending;
    this.pending = null;
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    pending?.reject(new WorldPrepCancelledError(message));
  }

  dispose(): void {
    this.cancel('World preparation client was disposed');
  }

  private finishWorker(worker: WorldPrepWorkerLike): void {
    if (this.worker === worker) {
      worker.terminate();
      this.worker = null;
    }
    this.pending = null;
  }
}

function defaultWorkerFactory(): WorldPrepWorkerLike {
  return new Worker(
    new URL('../workers/worldPrep.worker.ts', import.meta.url),
    { type: 'module', name: 'paravoxia-world-prep' }
  );
}
